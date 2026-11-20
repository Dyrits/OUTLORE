import type { ThreadId } from "@outlore/contracts";

/** The channel slot in a pane chain. */
export const channelId = "channel";

/** The errand starter slot in a pane chain. */
export const starterId = "errand-starter";

/** A conversation or auxiliary slot in a pane chain. */
export type PaneId = ThreadId | typeof channelId | typeof starterId;

/** Whether the slot holds an existing conversation. */
export const isThreadPane = (id: PaneId): id is ThreadId => id !== channelId && id !== starterId;
