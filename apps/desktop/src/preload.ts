import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge, TerminalSession } from "../../app/src/foundation/desktopBridge.ts";
import type { Theme } from "../../app/src/foundation/themeName.ts";
import type { UpdateState } from "../../app/src/foundation/updateState.ts";

// The endpoint carries the per-launch owner token for the local service.
contextBridge.exposeInMainWorld("outlore", {
  endpoint: (): Promise<string> => ipcRenderer.invoke("outlore:endpoint"),
  /** Whether the window has no system title bar on macOS, so the app draws its own beside the traffic lights. */
  hasOwnTitleBar: process.platform === "darwin",
  pairingLinks: {
    listen: (onLink: (link: string) => void) => {
      const onPairingLink = (_event: Electron.IpcRendererEvent, link: string) => onLink(link);
      ipcRenderer.on("outlore:pairingLink", onPairingLink);
      return () => {
        ipcRenderer.removeListener("outlore:pairingLink", onPairingLink);
      };
    },
    take: (): Promise<string | null> => ipcRenderer.invoke("outlore:pairingLinkTake"),
  },
  requestAttention: (): Promise<void> => ipcRenderer.invoke("outlore:requestAttention"),
  setTheme: (theme: Theme): Promise<void> => ipcRenderer.invoke("outlore:setTheme", theme),
  terminalClose: (id: string): Promise<void> => ipcRenderer.invoke("outlore:terminalClose", id),
  terminalListen: (data: (id: string, text: string, sequence: number) => void, exit: (id: string) => void) => {
    const onData = (_event: Electron.IpcRendererEvent, id: string, text: string, sequence: number) =>
      data(id, text, sequence);
    const onExit = (_event: Electron.IpcRendererEvent, id: string) => exit(id);
    ipcRenderer.on("outlore:terminalData", onData);
    ipcRenderer.on("outlore:terminalExit", onExit);
    return () => {
      ipcRenderer.removeListener("outlore:terminalData", onData);
      ipcRenderer.removeListener("outlore:terminalExit", onExit);
    };
  },
  terminalOpen: (id: string, cwd: string | null): Promise<TerminalSession> =>
    ipcRenderer.invoke("outlore:terminalOpen", id, cwd),
  terminalResize: (id: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke("outlore:terminalResize", id, cols, rows),
  terminalWrite: (id: string, data: string): Promise<void> => ipcRenderer.invoke("outlore:terminalWrite", id, data),
  updates: {
    check: (): Promise<UpdateState> => ipcRenderer.invoke("outlore:updateCheck"),
    install: (): Promise<void> => ipcRenderer.invoke("outlore:updateInstall"),
    listen: (onState: (state: UpdateState) => void) => {
      const onChanged = (_event: Electron.IpcRendererEvent, state: UpdateState) => onState(state);
      ipcRenderer.on("outlore:updateChanged", onChanged);
      return () => {
        ipcRenderer.removeListener("outlore:updateChanged", onChanged);
      };
    },
    openReleasePage: (url: string): Promise<void> => ipcRenderer.invoke("outlore:updateOpenReleasePage", url),
    setEnabled: (isEnabled: boolean): Promise<UpdateState> => ipcRenderer.invoke("outlore:updateSetEnabled", isEnabled),
    state: (): Promise<UpdateState> => ipcRenderer.invoke("outlore:updateState"),
  },
} satisfies DesktopBridge);
