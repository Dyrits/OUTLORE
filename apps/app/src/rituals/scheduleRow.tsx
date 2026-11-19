import type { RitualSchedule } from "@outlore/contracts";
import type { ReactNode } from "react";
import { Text, TextInput, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { Menu } from "../ui/pickers";
import { isTimeValid, scheduleKindLabels, scheduleKinds, scheduleOfKind, weekdayLabelOf } from "./ritualLabels";
import { ritualStyles } from "./ritualStyles";

const weekdays = ["0", "1", "2", "3", "4", "5", "6"] as const;

const monthDays = Array.from({ length: 28 }, (_, index) => String(index + 1));

/** A word in a row of fields, such as the "at" between a day and a time. */
export function Word({ text }: { text: string }) {
  return <Text style={ritualStyles.word}>{text}</Text>;
}

/** When the Ritual runs, as a sentence of pickers: "Every week on Monday at 07:00". */
export function ScheduleRow({
  onChange,
  value,
}: {
  onChange: (schedule: RitualSchedule) => void;
  value: RitualSchedule;
}) {
  return (
    <View style={ritualStyles.sentence}>
      <Menu
        accessibilityLabel="Schedule"
        label={(kind) => scheduleKindLabels[kind]}
        onChange={(kind) => onChange(scheduleOfKind(kind, value))}
        options={scheduleKinds}
        value={value._tag}
      />
      {value._tag === "Weekly" && (
        <>
          <Word text="on" />
          <Menu
            accessibilityLabel="Day of the week"
            label={(day) => weekdayLabelOf(Number(day))}
            onChange={(day) => onChange({ ...value, day: Number(day) })}
            options={weekdays}
            value={String(value.day) as (typeof weekdays)[number]}
          />
        </>
      )}
      {value._tag === "Monthly" && (
        <>
          <Word text="on day" />
          <Menu
            accessibilityLabel="Day of the month"
            label={(day) => day}
            onChange={(day) => onChange({ ...value, day: Number(day) })}
            options={monthDays}
            value={String(value.day)}
          />
        </>
      )}
      {value._tag === "Hourly" ? (
        <>
          <Word text="every" />
          <TextInput
            accessibilityLabel="Hours between runs"
            keyboardType="numeric"
            onChangeText={(text) => onChange({ ...value, hours: Number.parseInt(text, 10) || 0 })}
            style={[styles.input, ritualStyles.small, (value.hours < 1 || value.hours > 168) && ritualStyles.invalid]}
            value={value.hours === 0 ? "" : String(value.hours)}
          />
          <Word text="hours (1 to 168)" />
        </>
      ) : (
        <>
          <Word text="at" />
          <TextInput
            accessibilityLabel="Time of day"
            onChangeText={(time) => onChange({ ...value, time })}
            placeholder="07:00"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, ritualStyles.small, !isTimeValid(value.time) && ritualStyles.invalid]}
            value={value.time}
          />
          <Word text="(24-hour)" />
        </>
      )}
    </View>
  );
}

/** One labelled part of the form, under a small gilt rule. */
export function Part({ children, name }: { children: ReactNode; name: string }) {
  return (
    <View style={ritualStyles.part}>
      <Text style={ritualStyles.partName}>{name}</Text>
      {children}
    </View>
  );
}
