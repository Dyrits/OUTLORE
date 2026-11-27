import { useImperativeHandle, useState } from "react";
import { TextInput } from "react-native";
import { spacedTranscriptOf } from "../dictation/dictation";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { type ChipEditorProps, triggerLengthOf, triggerOfEnd } from "./chipEditorTypes";

/** The message box's text field where chips cannot be drawn inside the text: a chosen skill or path is written into it as its token. */
export function ChipEditor({ initialText = "", onChange, onKeyDown, placeholder, ref }: ChipEditorProps) {
  const [text, setText] = useState(initialText);
  const change = (value: string) => {
    setText(value);
    onChange(value, triggerOfEnd(value));
  };
  useImperativeHandle(ref, () => ({
    clear: () => change(""),
    insertChip: (chip) => {
      const typed = triggerOfEnd(text);
      change(`${text.slice(0, text.length - (typed === null ? 0 : triggerLengthOf(typed)))}${chip.token} `);
    },
    // The field reports no caret, so the words go at the end.
    insertText: (spoken) => change(`${text}${spacedTranscriptOf(text, "", spoken)}`),
  }));
  return (
    <TextInput
      multiline
      onChangeText={change}
      onKeyPress={(event) => {
        // The web reports the Shift key on the event; React Native's types do not declare it.
        const { nativeEvent } = event;
        const isShiftHeld = "shiftKey" in nativeEvent && nativeEvent.shiftKey === true;
        if (onKeyDown({ key: nativeEvent.key, shiftKey: isShiftHeld })) event.preventDefault();
      }}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      style={styles.composerInput}
      value={text}
    />
  );
}
