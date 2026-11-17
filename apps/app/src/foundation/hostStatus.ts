/** Facts from the selected link; the window never combines them itself. */
export type HostLink = {
  failure: string | null;
  hasConnected: boolean;
  hasGivenUp: boolean;
  needsPairing: boolean;
};

/** Derives the window's connection state and the recovery actions it can offer. */
export const hostStatusOf = (input: {
  isBrowser: boolean;
  hasHosts: boolean;
  hostId: string | null;
  name: string;
  link: HostLink | null;
  failure: string | null;
}) => {
  const isPairing = input.isBrowser && !input.hasHosts;
  const failure = input.link?.failure ?? input.failure;
  const hasConnected = input.link?.hasConnected === true;
  return {
    canPair: input.isBrowser && (isPairing || input.link?.needsPairing === true),
    canRetry: failure !== null && input.link?.needsPairing !== true,
    canUseComputer: !input.isBrowser && input.hostId !== null,
    failure,
    isRetrying: failure !== null && input.link?.hasGivenUp === false,
    kind: isPairing ? "pairing" : hasConnected ? "content" : "connecting",
    message:
      failure ?? (input.hostId === null ? "Connecting to this computer's service…" : `Connecting to ${input.name}…`),
  };
};

/** All mutable facts about one link, advanced by transport events. */
type HostLinkState = HostLink & { failures: number };

/** Transport-independent initial state; failures from the first attempt are recoverable. */
export const initialHostLink: HostLinkState = {
  failure: null,
  failures: 0,
  hasConnected: false,
  hasGivenUp: false,
  needsPairing: false,
};

/** Advances a link's life; final closes and explicit cancellation stop later attempts. */
export const advanceHostLink = (
  state: HostLinkState,
  event:
    | { type: "open" }
    | { type: "failure"; message: string | null }
    | { type: "message" }
    | { type: "close"; isFinal: boolean; isRefused: boolean }
    | { type: "end" },
): HostLinkState => {
  if (event.type === "end") return { ...state, hasGivenUp: true };
  if (state.hasGivenUp) return state;
  if (event.type === "open") return { ...state, hasConnected: true };
  if (event.type === "failure") return { ...state, failure: event.message };
  if (event.type === "message") return { ...state, failures: 0 };
  return { ...state, failures: state.failures + 1, hasGivenUp: event.isFinal, needsPairing: event.isRefused };
};
