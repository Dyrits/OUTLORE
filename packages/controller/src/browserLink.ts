import { decodeBase64Url, encodeBase64Url, type SecureChannel } from "@outlore/channel";
import { Effect } from "effect";
import { pairWithCode, resumeHost } from "./hostLink.ts";
import type { PairedHostStore } from "./hostStore.ts";
import { LinkFailure, linkCodeOf } from "./linkFailure.ts";
import type { PairedHosts } from "./pairedHosts.ts";
import { hostLinkCodes, type OpenTransport } from "./transport.ts";

/** Settings of the web app's page, or of the mobile app, which links to a host the same way. */
export interface PageSettings {
  readonly allowLocalRelay: boolean;
  /** The mobile app says it is a phone; a page in a browser leaves this out. */
  readonly kind?: "phone";
  readonly release: string;
}

const browserStore = (hosts: PairedHosts): PairedHostStore => ({
  link: async (id) => {
    const stored = hosts.link(id);
    const key = stored === null ? null : decodeBase64Url(stored.hostPublicKey);
    return stored === null || key === null ? null : { ...stored, hostPublicKey: key };
  },
  save: async (host, now) => hosts.save({ ...host, hostPublicKey: encodeBase64Url(host.hostPublicKey) }, now),
  touch: async (id, name, now) => hosts.touch(id, name, now),
});

/** Pairs a browser (or the mobile app) and keeps the pairing in its storage. */
export const pairFromBrowser = (code: string, name: string, hosts: PairedHosts, page: PageSettings) =>
  Effect.runPromise(pairWithCode(code, name, browserStore(hosts), { ...page, kind: page.kind ?? "browser" }));

/**
 * The transport to a paired host for a `ServiceClient`. It reports itself open at once, as the desktop's loopback
 * socket does while the service opens the link, and holds what is sent until the link is up; a link that cannot open
 * closes with the codes the desktop uses: 4000 to try again later, 4002 when trying again cannot help, 4001 when the
 * host ended it.
 */
export const openBrowserTransport =
  (hosts: PairedHosts, hostId: string, page: PageSettings): OpenTransport =>
  (handlers) => {
    const waiting: string[] = [];
    let channel: SecureChannel | null = null;
    let isClosed = false;
    // The link is opened by a fiber of its own, so closing the transport cancels an opening in progress, which closes
    // whatever it had opened. The first yield lets the caller finish setting the transport up before it hears of it.
    const opening = Effect.runFork(
      Effect.gen(function* () {
        yield* Effect.yieldNow;
        if (isClosed) return;
        handlers.onOpen();
        return yield* resumeHost(browserStore(hosts), hostId, { ...page, kind: page.kind ?? "browser" });
      }).pipe(
        Effect.match({
          onFailure: (reason) => {
            if (isClosed) return;
            const code = reason instanceof LinkFailure ? linkCodeOf[reason.kind] : hostLinkCodes.couldNotOpen;
            handlers.onClose(code, reason.message.slice(0, 200));
          },
          onSuccess: (opened) => {
            if (opened === undefined) return;
            if (isClosed) return opened.channel.close();
            channel = opened.channel;
            opened.listen((text) => handlers.onText(text));
            opened.channel.onClose(() => {
              if (!isClosed) handlers.onClose(hostLinkCodes.ended, "The host disconnected.");
            });
            for (const text of waiting.splice(0)) opened.channel.sendText(text);
          },
        }),
      ),
    );
    return {
      close: () => {
        isClosed = true;
        channel?.close();
        opening.interruptUnsafe();
      },
      get isOpen() {
        return !isClosed;
      },
      send: (text) => {
        if (channel === null) waiting.push(text);
        else channel.sendText(text);
      },
    };
  };
