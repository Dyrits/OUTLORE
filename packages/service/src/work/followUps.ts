/** What a command leaves to do once its storage work has committed. */
export type FollowUps = {
  /** Whether state the owner sees changed, so open screens refetch. */
  readonly isChanged: boolean;
  /** Deleted quests whose service-owned scratch folder can now be removed. */
  readonly missionsToRemoveScratch: ReadonlyArray<string>;
  /** Missions whose waiting threads may now run, a running slot having freed. */
  readonly missionsToWake: ReadonlyArray<string>;
  /** Whether a connector's switch changed in a way that may take a tool from a thread: calls underway are stopped. */
  readonly shouldStopConnectorCalls: boolean;
  /** Threads with messages to deliver. */
  readonly threadsToWake: ReadonlyArray<string>;
  /** Threads whose pending owner questions must be withdrawn before any wake. */
  readonly threadsToWithdraw: ReadonlyArray<string>;
  /** Threads whose turns the operation invalidated and that must now end. */
  readonly turnsToCancel: ReadonlyArray<string>;
};

/** A domain operation's value with its follow-ups. */
export type WithFollowUps<A> = {
  readonly followUps: FollowUps;
  readonly value: A;
};

/** The follow-ups of an operation that changed nothing the owner sees and leaves nothing to do. */
export const noFollowUps: FollowUps = {
  isChanged: false,
  missionsToRemoveScratch: [],
  missionsToWake: [],
  shouldStopConnectorCalls: false,
  threadsToWake: [],
  threadsToWithdraw: [],
  turnsToCancel: [],
};

type FurtherFollowUps = Partial<Omit<FollowUps, "isChanged">>;

/** A value whose operation changed what the owner sees, with any further follow-ups. */
export const changed = <A>(value: A, further: FurtherFollowUps = {}): WithFollowUps<A> => ({
  followUps: { ...noFollowUps, ...further, isChanged: true },
  value,
});

/** A value whose operation changed nothing the owner sees, with any further follow-ups. */
export const unchanged = <A>(value: A, further: FurtherFollowUps = {}): WithFollowUps<A> => ({
  followUps: { ...noFollowUps, ...further, isChanged: false },
  value,
});
