import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { ServerFrame } from "@outlore/contracts";
import { linkCodeOf, type ResumeOptions } from "@outlore/controller";
import { Effect, FiberSet } from "effect";
import { SqlClient } from "effect/sql";
import { WebSocket, WebSocketServer } from "ws";
import { Sessions } from "./core/index.ts";
import { answerText, encodeServerFrame, type HostChannel, openHostChannel, RemoteConfig } from "./remote/index.ts";
import { Service } from "./service.ts";

const sameToken = (given: string | null, expected: string) => {
  if (given === null) return false;
  const givenBytes = Buffer.from(given);
  const expectedBytes = Buffer.from(expected);
  return givenBytes.length === expectedBytes.length && timingSafeEqual(givenBytes, expectedBytes);
};

const tokenOf = (request: IncomingMessage) => new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("token");

/**
 * Serves the owner on one loopback WebSocket. The per-launch token in the
 * connection URL is the owner's credential; any other connection is refused.
 */
export const serveLoopback = (options: {
  readonly openHostChannel?: typeof openHostChannel;
  readonly port: number;
  readonly token: string;
}) =>
  Effect.gen(function* () {
    const openChannel = options.openHostChannel ?? openHostChannel;
    const service = yield* Service;
    const sessions = yield* Sessions;
    const sql = yield* SqlClient.SqlClient;
    const remote = yield* RemoteConfig;
    const run = yield* FiberSet.makeRuntimePromise();

    const wss = yield* Effect.acquireRelease(
      Effect.callback<WebSocketServer, Error>((resume) => {
        const server = new WebSocketServer({
          host: "127.0.0.1",
          port: options.port,
          verifyClient: ({ req }: { req: IncomingMessage }) => sameToken(tokenOf(req), options.token),
        });
        server.once("listening", () => resume(Effect.succeed(server)));
        server.once("error", (error) => resume(Effect.fail(error)));
      }),
      (server) =>
        Effect.callback<void>((resume) => {
          for (const client of server.clients) client.terminate();
          server.close(() => resume(Effect.void));
        }),
    );

    const sendTo = (socket: WebSocket) => (frame: ServerFrame) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(encodeServerFrame(frame));
    };

    /**
     * Joins the app to a paired host: the service opens an encrypted link to it and passes each frame both ways, so the
     * app speaks to the host's service as to its own. A link that cannot open closes the socket with code 4000 and the
     * reason the owner reads, or 4002 when the host refuses this installation; a link that ends closes it with 4001.
     */
    const bridgeToHost = (socket: WebSocket, hostId: string, options: ResumeOptions = {}) => {
      const waiting: string[] = [];
      let link: HostChannel | null = null;
      let isClosed = false;
      socket.on("message", (data) => {
        if (link === null) waiting.push(data.toString());
        else link.sendText(data.toString());
      });
      socket.on("close", () => {
        isClosed = true;
        link?.close();
      });
      const opening = openChannel(hostId, options).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.provideService(RemoteConfig, remote),
        Effect.map((channel) => ({ channel, closeCode: 4000, message: "" })),
        // A host that refuses this installation will keep refusing: say so with a code that ends the app's retries.
        Effect.catch((failure) =>
          Effect.succeed({
            channel: null,
            closeCode: linkCodeOf[failure.kind],
            message: failure.message,
          }),
        ),
      );
      void run(opening)
        .then((outcome) => {
          if (outcome.channel === null) {
            socket.close(outcome.closeCode, outcome.message.slice(0, 120));
            return;
          }
          const channel = outcome.channel;
          if (isClosed) {
            channel.close();
            return;
          }
          link = channel;
          channel.onText((text) => {
            if (socket.readyState === WebSocket.OPEN) socket.send(text);
          });
          channel.onClose(() => socket.close(4001, "The host disconnected."));
          for (const text of waiting.splice(0)) channel.sendText(text);
        })
        .catch(() => {
          // A defect while opening the link rejects instead of failing, and would leave the app's socket open for good.
          link?.close();
          socket.close(4000, "The host link failed.");
        });
    };

    wss.on("connection", (socket, request) => {
      const hostPath = /^\/host\/([A-Za-z0-9-]+)(\/update)?$/.exec(
        new URL(request.url ?? "/", "http://127.0.0.1").pathname,
      );
      if (hostPath?.[1] !== undefined) {
        // `/host/<id>/update` is the link that updates a host of another release: it keeps that link where the plain one
        // would end with the release mismatch.
        bridgeToHost(socket, hostPath[1], hostPath[2] === undefined ? {} : { acceptOtherRelease: true });
        return;
      }
      const send = sendTo(socket);
      const remove = sessions.add(send);
      socket.on("close", remove);
      socket.on("message", (data) => {
        void run(answerText(service.handle, data.toString(), send, { isPairedDevice: false })).catch(() => {
          if (socket.readyState === WebSocket.OPEN) socket.close(1011, "The local service could not answer.");
        });
      });
    });

    const address = wss.address();
    return { port: typeof address === "object" && address !== null ? address.port : options.port };
  });
