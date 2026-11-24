import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../../app/src/foundation/desktopBridge.ts";
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
  /** The system menu bar's File > Workshop… (⌘,) asks the window to open the Workshop. */
  workshopMenu: {
    listen: (onOpen: () => void) => {
      const onOpenWorkshop = () => onOpen();
      ipcRenderer.on("outlore:openWorkshop", onOpenWorkshop);
      return () => {
        ipcRenderer.removeListener("outlore:openWorkshop", onOpenWorkshop);
      };
    },
  },
} satisfies DesktopBridge);
