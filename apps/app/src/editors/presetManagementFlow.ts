/** Where Delete stands in the management of a saved preset: nothing asked, asking to confirm, or deleting. */
export type ManagementStep = { error: string | null; stage: "confirming" | "deleting" | "idle" };

/** What happens to the management of a preset: Delete is asked, cancelled, started, refused with a message, or done. */
export type ManagementEvent =
  | { kind: "ask" }
  | { kind: "cancel" }
  | { kind: "start" }
  | { kind: "failed"; message: string }
  | { kind: "done" };

const steps = {
  ask: () => ({ error: null, stage: "confirming" }),
  cancel: () => ({ error: null, stage: "idle" }),
  done: () => ({ error: null, stage: "idle" }),
  failed: (event) => ({ error: event.kind === "failed" ? event.message : null, stage: "confirming" }),
  start: () => ({ error: null, stage: "deleting" }),
} satisfies Record<ManagementEvent["kind"], (event: ManagementEvent) => ManagementStep>;

/** The step after an event: Delete asks first, a refusal stays under the buttons for another try, and Cancel or a deletion clears it. */
export const nextStep = (event: ManagementEvent): ManagementStep => steps[event.kind](event);
