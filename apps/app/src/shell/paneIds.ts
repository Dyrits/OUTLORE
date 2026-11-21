import type { ThreadId } from "@outlore/contracts";

/** The channel slot in a pane chain. */
export const channelId = "channel";

/** The errand starter slot in a pane chain. */
export const starterId = "errand-starter";

/** A conversation or auxiliary slot in a pane chain. */
export type PaneId = ThreadId | typeof channelId | typeof starterId;

/** The content assigned to a pane before the layout decides whether to fold it. */
export type PaneContent =
  | { kind: "channel"; id: typeof channelId }
  | { kind: "starter"; id: typeof starterId }
  | { kind: "quest" | "errand"; id: ThreadId };

/** Places the channel, quest and selected errand or starter into the desktop row. */
export const paneContentsOf = (quest: ThreadId | null, selected: ThreadId | null): ReadonlyArray<PaneContent> =>
  quest === null
    ? []
    : [
        { id: channelId, kind: "channel" },
        { id: quest, kind: "quest" },
        selected === null || selected === quest ? { id: starterId, kind: "starter" } : { id: selected, kind: "errand" },
      ];

/** Whether the slot holds an existing conversation. */
export const isThreadPane = (id: PaneId): id is ThreadId => id !== channelId && id !== starterId;
