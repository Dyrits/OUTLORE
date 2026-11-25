import type { MessageId } from "@outlore/contracts";
import { createContext, useContext } from "react";

// Reply and the errand anchor (conversation panes): a message of a main conversation can be replied to, which opens an
// empty quest in the Chronicle or an empty errand beneath a quest, hung from the message and opened at once. Its own
// composer takes the first message. An errand's own conversation offers no Reply.

/** How a conversation's messages are replied to: which message, and its text for the quote. */
export type RepliesApi = { readonly start: (message: { id: MessageId; text: string }) => void };

/** Offered where a Reply starts something — the Chronicle and a quest's own conversation; absent in an errand's pane. */
const RepliesContext = createContext<RepliesApi | null>(null);
export const RepliesProvider = RepliesContext.Provider;
export const useReplies = () => useContext(RepliesContext);
