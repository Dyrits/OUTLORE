import type { DesktopBridge } from "./desktopBridge";

/**
 * Bounces the desktop app's Dock icon for a new quest or errand in Attention. The bounce is a nudge: when the desktop app cannot make it,
 * the notification and the dashboard still show it. Without a desktop app (a browser), there is no Dock.
 */
export async function bounceDesktopDock(bridge: Pick<DesktopBridge, "requestAttention"> | undefined): Promise<void> {
  try {
    await bridge?.requestAttention();
  } catch {
    // The Dock stays still.
  }
}
