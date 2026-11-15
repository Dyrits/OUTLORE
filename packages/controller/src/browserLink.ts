import { decodeBase64Url, encodeBase64Url, type SecureChannel } from "@outlore/channel";
import { pairWithCode, resumeHost } from "./hostLink.ts";
import type { PairedHostStore } from "./hostStore.ts";
import { LinkFailure, linkCodeOf, linkTexts } from "./linkFailure.ts";
import type { PairedHosts } from "./pairedHosts.ts";
import { hostLinkCodes, type OpenTransport } from "./transport.ts";

/** Settings of the web app's page. */
export interface PageSettings {
  readonly allowLocalRelay: boolean;
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

/** Pairs a browser and keeps the pairing in its storage. */
export const pairFromBrowser = (code: string, name: string, hosts: PairedHosts, page: PageSettings) =>
  pairWithCode(code, name, browserStore(hosts), { ...page, kind: "browser" });

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
    void Promise.resolve().then(async () => {
      if (isClosed) return;
      handlers.onOpen();
      try {
        const opened = await resumeHost(browserStore(hosts), hostId, { ...page, kind: "browser" });
        if (isClosed) return opened.channel.close();
        channel = opened.channel;
        opened.listen((text) => handlers.onText(text));
        opened.channel.onClose(() => {
          if (!isClosed) handlers.onClose(hostLinkCodes.ended, "The host disconnected.");
        });
        for (const text of waiting.splice(0)) opened.channel.sendText(text);
      } catch (reason) {
        if (isClosed) return;
        const code = reason instanceof LinkFailure ? linkCodeOf[reason.kind] : hostLinkCodes.couldNotOpen;
        const message = reason instanceof Error ? reason.message : linkTexts.unreachable;
        handlers.onClose(code, message.slice(0, 200));
      }
    });
    return {
      close: () => {
        isClosed = true;
        channel?.close();
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
