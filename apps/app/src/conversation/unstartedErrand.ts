import type { MissionDetail } from "@outlore/contracts";

/**
 * Whether the thread is an errand a Reply opened that has no message yet: nothing but notices, so no turn has started
 * and its starting context is still the owner's to change (conversation-panes, Reply and Comment).
 */
export const isUnstartedErrand = (thread: MissionDetail["thread"], messages: MissionDetail["messages"]) =>
  thread.parentId !== null && messages.every((message) => message.sender === "system");
