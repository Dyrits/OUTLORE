/** Cut-short text of a thread's latest message from one sender, for the sample on a reply line (conversation panes). */
const sampleLength = 160;

/** SQL that reads the latest non-empty message a sender wrote in the thread, cut to a sample; null when there is none. */
export const lastSampleOf = (threadRef: string, sender: "user" | "agent") =>
  `(SELECT substr(x.text, 1, ${sampleLength}) FROM messages x WHERE x.thread_id = ${threadRef} AND x.sender_kind = '${sender}' AND x.text <> '' ORDER BY x.sent_at DESC, x.sequence DESC LIMIT 1)`;
