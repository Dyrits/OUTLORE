// The words of the Connectors section's Code Mode switch (connectors specification, Code Mode).

/** The switch's name: Code Mode covers Outlore's own tools as well as the connectors' (CHG-0446). */
export const codeModeLabel = "Code Mode";

/** The mark beside the switch: the option is a trial, and its gains are not yet measured. */
export const experimentalLabel = "Experimental";

/** What the switch does in plain words, and what it leaves alone. */
export const codeModeExplanation =
  "With it on, a thread reaches Outlore's tools and its connectors' tools by writing a short piece of code that calls them, instead of calling each tool one by one. A tool that asks you still asks you while the code runs. A thread's own commands and file edits are not affected. A change applies from a thread's next turn.";

/** The line under the switch saying what its state means for a thread. */
export const codeModeStateOf = (isOn: boolean) =>
  isOn
    ? "On: a thread writes code to call Outlore's tools and its connectors' tools."
    : "Off: a thread sees each tool and calls it one by one.";
