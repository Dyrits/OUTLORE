import type { Activity, FileDiff, ThreadId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { DiffView } from "./diffView";
import { callTextOf, changeCountsOf } from "./stepLabels";

/** What the fold of a modified file's step holds: nothing yet, the diff being read, the diff, or why it could not be read. */
type Reading =
  | { status: "closed" }
  | { status: "loading" }
  | { diff: FileDiff; status: "ready" }
  | { message: string; status: "failed" };

/**
 * One reported tool call as a line of its turn's steps. A call that modified a file carries its +/− counts and unfolds
 * to the diff, read from the host when the fold first opens (never with the steps list).
 */
export function CallStep({
  activity,
  at,
  client,
  threadId,
}: {
  activity: Activity;
  at: number;
  client: ServiceClient;
  threadId: ThreadId;
}) {
  const [reading, setReading] = useState<Reading>({ status: "closed" });
  const [isOpen, setIsOpen] = useState(false);
  const change = activity.change;
  if (change === undefined)
    return (
      <View style={styles.questionLine}>
        <Text style={styles.muted}>{callTextOf(activity, at)}</Text>
      </View>
    );
  const counts = changeCountsOf(change);
  const load = () => {
    setReading({ status: "loading" });
    client.request({ _tag: "ReadFileDiff", activityId: activity.id, threadId }).then(
      (diff) => setReading({ diff, status: "ready" }),
      (reason: unknown) => setReading({ message: messageOf(reason), status: "failed" }),
    );
  };
  const toggle = () => {
    if (!isOpen && (reading.status === "closed" || reading.status === "failed")) load();
    setIsOpen(!isOpen);
  };
  return (
    <View style={[styles.questionLine, { alignSelf: "stretch", maxWidth: "100%" }]}>
      <Pressable
        accessibilityLabel={`${callTextOf(activity, at)}, ${isOpen ? "hide" : "show"} the changes`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={toggle}
        style={[styles.stepsHeader, { alignSelf: "stretch", flexWrap: "wrap" }]}
      >
        {/* A long path wraps inside the line instead of pushing the counts out of a narrow screen. */}
        <Text style={[styles.muted, { flexShrink: 1 }]}>{callTextOf(activity, at)}</Text>
        {counts !== null && (
          <>
            <Text style={[styles.muted, { color: colors.successText }]}>{counts.added}</Text>
            <Text style={[styles.muted, { color: colors.dangerText }]}>{counts.removed}</Text>
          </>
        )}
        <Text style={styles.muted}>{isOpen ? "⌃" : "⌄"}</Text>
      </Pressable>
      {isOpen && reading.status === "loading" && <Text style={styles.muted}>Reading the changes…</Text>}
      {isOpen && reading.status === "failed" && (
        <Text style={styles.muted}>Could not read the changes: {reading.message}</Text>
      )}
      {isOpen && reading.status === "ready" && <DiffView diff={reading.diff} />}
    </View>
  );
}
