import type { BackupCompanion, HarnessList, Tier } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { messageOf } from "../foundation/client";
import { runnerSummaryOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Button } from "../ui/button";
import { Fold, FoldGroup } from "../ui/fold";
import { BackupsEditor } from "./backupsEditor";
import { withBackups, withRunner } from "./presetEntries";
import { RunnerPickers } from "./runners";
import { useOwnBackups } from "./useOwnBackups";

/** The title row of the Companions tab's details: what they show at the left, one button at the top right. */
export function DetailsHeader({ action, title }: { action: ReactNode; title: string }) {
  return (
    <View style={local.header}>
      <Text numberOfLines={1} style={local.title}>
        {title}
      </Text>
      {action}
    </View>
  );
}

/**
 * Edit mode of the Companions tab: a saved preset's own Companion and backups, in the same folds and pickers as the thread's, in place of the thread's.
 * Every change goes to `onSave` at once, as the Workshop's panel saves it, and a failure shows on an error line.
 * It owns no way to change the thread: that is what keeps the thread's Companion as it was.
 */
export function PresetEditor({
  harnesses,
  name,
  onDone,
  onSave,
  stack,
}: {
  harnesses: HarnessList | null;
  name: string;
  onDone: () => void;
  onSave: (stack: Tier) => Promise<unknown>;
  stack: Tier;
}) {
  const [error, setError] = useState<string | null>(null);
  const { backups, discard, edit } = useOwnBackups(stack.backups);
  const save = (next: Tier, onFailure?: () => void) => {
    setError(null);
    onSave(next).catch((reason) => {
      onFailure?.();
      setError(messageOf(reason));
    });
  };
  const saveBackups = (next: ReadonlyArray<BackupCompanion>) => {
    edit(next);
    save(withBackups(stack, next), discard);
  };
  return (
    <FoldGroup initial="main">
      <View style={local.body}>
        <DetailsHeader action={<Button label="Done" onPress={onDone} />} title={`Editing ${name}`} />
        <Text style={local.note}>
          Changes are saved to {name} at once. This thread keeps its own Companion; choose {name} again to put the
          edited preset in place.
        </Text>
        <Fold harness={stack.harness} id="main" summary={runnerSummaryOf(harnesses, stack)} title="Companion">
          <RunnerPickers
            harnesses={harnesses}
            isCompact={false}
            isPanel={true}
            onChange={(runner) => save(withRunner(stack, runner))}
            value={stack}
          />
        </Fold>
        <View style={local.backups}>
          <Text style={local.sectionTitle}>Backup companions</Text>
          <BackupsEditor
            backups={backups}
            harnesses={harnesses}
            isCompact={false}
            isFolded={true}
            onChange={saveBackups}
          />
        </View>
        {error !== null && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
    </FoldGroup>
  );
}

const local = StyleSheet.create({
  backups: { gap: 8, paddingTop: 8 },
  body: { gap: 8 },
  header: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between", minHeight: 32 },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  sectionTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  title: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
});
