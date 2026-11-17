// The words of the Charter's Code Mode switch (connectors, Code Mode).

/** The switch's name, as the specification gives it. */
export const codeModeLabel = "Code Mode for connectors";

/** The mark beside the switch: the option is a trial, and its gains are not yet measured. */
export const experimentalLabel = "Experimental";

/** What the switch does in plain words, and what it does not do yet. */
export const codeModeExplanation =
  "With it on, a thread reaches its connectors' tools by writing a short piece of code that calls them, instead of calling each tool one by one. No connectors exist yet, so for now it changes nothing you can see. A change applies from a thread's next turn.";

/** The line under the switch saying what its state means for a thread. */
export const codeModeStateOf = (isOn: boolean) =>
  isOn
    ? "On: a thread writes code to call its connectors' tools."
    : "Off: a thread sees each connector tool and calls it one by one.";
