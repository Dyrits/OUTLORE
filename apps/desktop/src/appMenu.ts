import type { MenuItemConstructorOptions } from "electron";

/** The owner's way to the Workshop from the system menu bar: File, and on macOS the app menu too. */
const workshopItem = (openWorkshop: () => void): MenuItemConstructorOptions => ({
  accelerator: "CmdOrCtrl+,",
  click: openWorkshop,
  label: "Workshop…",
});

/**
 * The menu bar: Electron's standard menus, with the Workshop added to File (and, on macOS, to the app menu where
 * Settings belongs by convention).
 */
export const appMenuTemplateOf = (
  platform: NodeJS.Platform,
  openWorkshop: () => void,
): MenuItemConstructorOptions[] => {
  const isMac = platform === "darwin";
  return [
    ...(isMac
      ? [
          {
            label: "Outlore",
            submenu: [
              { role: "about" },
              { type: "separator" },
              workshopItem(openWorkshop),
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "File",
      submenu: [workshopItem(openWorkshop), { type: "separator" }, isMac ? { role: "close" } : { role: "quit" }],
    },
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
};
