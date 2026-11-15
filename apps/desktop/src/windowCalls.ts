import type { IpcMain, IpcMainInvokeEvent } from "electron";

interface Frame {
  readonly url: string;
}
interface Contents {
  readonly mainFrame: Frame;
}
interface Sender {
  readonly sender: Contents;
  readonly senderFrame: Frame | null;
}

/** Only the designated window's main frame on the app's origin can call its privileged handlers. */
export const isTrustedSender = (event: Sender, contents: Contents, appUrl: string): boolean => {
  if (event.sender !== contents || event.senderFrame !== contents.mainFrame) return false;
  try {
    const source = new URL(event.senderFrame.url);
    const app = new URL(appUrl);
    // Custom schemes can have the opaque origin "null"; compare protocol and host as well.
    return source.origin === app.origin && source.protocol === app.protocol && source.host === app.host;
  } catch {
    return false;
  }
};

/** Registers privileged window calls with the same sender guard, before the handler touches any state. */
export const createWindowHandlers =
  (ipc: Pick<IpcMain, "handle">, contents: Contents, appUrl: string) =>
  <Args extends unknown[], Result>(channel: string, handler: (...args: Args) => Result) => {
    ipc.handle(channel, (event: IpcMainInvokeEvent, ...args: Args) => {
      if (!isTrustedSender(event, contents, appUrl))
        throw new Error("This call is only available in Outlore's desktop window.");
      return handler(...args);
    });
  };
