/** Cut-short text of a thread's latest message from one sender, for the sample on a reply line (conversation panes). */
const sampleLength = 160;

/** SQL that reads the latest non-empty message a sender wrote in the thread, cut to a sample; null when there is none. */
export const lastSampleOf = (threadRef: string, sender: "user" | "agent") =>
  `(SELECT substr(x.text, 1, ${sampleLength}) FROM messages x WHERE x.thread_id = ${threadRef} AND x.sender_kind = '${sender}' AND x.text <> '' ORDER BY x.sent_at DESC, x.sequence DESC LIMIT 1)`;

/**
 * SQL that counts the replies in a thread (conversation panes, Thread root): its non-system messages and the questions it asked the owner, less its opening message when that message is its own root.
 * A thread hanging from an anchor message has its root in the parent conversation, so every message of its own is a reply.
 * A thread with no anchor, or one whose opening message repeats its anchor (a quest or an errand started without a Reply leaves a copy of its text in its parent conversation), counts from the message after the first.
 */
export const replyCountOf = (threadRef: string) =>
  `MAX(0, (SELECT COUNT(*) FROM messages rm WHERE rm.thread_id = ${threadRef}.id AND rm.sender_kind != 'system')
    + (SELECT COUNT(*) FROM questions rq WHERE rq.thread_id = ${threadRef}.id AND rq.source = 'Thread')
    - CASE WHEN ${threadRef}.anchor_message_id IS NULL OR
      (SELECT fm.text FROM messages fm WHERE fm.thread_id = ${threadRef}.id AND fm.sender_kind != 'system' ORDER BY fm.sequence LIMIT 1)
        = (SELECT am.text FROM messages am WHERE am.id = ${threadRef}.anchor_message_id) THEN 1 ELSE 0 END)`;
