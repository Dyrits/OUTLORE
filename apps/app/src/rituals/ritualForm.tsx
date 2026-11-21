import {
  type MissionId,
  type Ritual,
  type RitualSchedule,
  type RitualScopeEntry,
  RitualScopeOperation,
  startingModel,
} from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { type Runner, RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";
import { Emblem } from "../foundation/emblems";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { RealmChooser } from "../realms/workspaces";
import { Toggle } from "../ui/controls";
import { Menu } from "../ui/pickers";
import { createRequestOf } from "./ritualCreate";
import { isTimeValid } from "./ritualLabels";
import { ritualStyles } from "./ritualStyles";
import { Part, ScheduleRow, Word } from "./scheduleRow";

/** How the Ritual form names each action its scope can allow. */
const scopeOperationLabels: Record<RitualScopeEntry["operation"], string> = {
  Archive: "Archive a quest",
  ChangeSetting: "Change a setting",
  Done: "Mark a quest Done",
  Rename: "Rename a quest",
  Stop: "Stop a quest's threads",
};

/** Whether the action takes an exact new value: a quest's new title, or a setting's new value. */
const isValued = (operation: RitualScopeEntry["operation"]) => operation === "Rename" || operation === "ChangeSetting";

/** Whether the schedule can be sent: a valid time, or hours within the allowed range. */
const isScheduleValid = (schedule: RitualSchedule) =>
  schedule._tag === "Hourly" ? schedule.hours >= 1 && schedule.hours <= 168 : isTimeValid(schedule.time);

/**
 * Makes a Ritual, or edits one: its title, instruction, schedule, the Companion it runs on, and the Companions it falls
 * back to, in order, when a run fails. A new Ritual is an entity of its realm, beside the quests; scheduled from an
 * open quest it takes that quest's realm and keeps a link to it.
 */
export function RitualForm({
  client,
  initialWorkspacePath = null,
  onCancel,
  onDone,
  originMissionId = null,
  ritual,
}: {
  client: ServiceClient;
  /** The folder of the realm a "+ Ritual" was pressed in; the form can change it. */
  initialWorkspacePath?: string | null;
  onCancel: () => void;
  /** Called once saved, with the Ritual's own conversation. */
  onDone: (missionId: MissionId) => void;
  /** The quest the Ritual is scheduled from: its realm is then taken, and no realm is chosen in the form. */
  originMissionId?: MissionId | null;
  /** The Ritual to edit, or null to make one. */
  ritual: Ritual | null;
}) {
  const { data: harnesses } = useHarnesses(client);
  const { data: known } = useServiceQuery(client, allMissions.request, allMissions.key);
  const [title, setTitle] = useState(ritual?.title ?? "");
  const [instruction, setInstruction] = useState(ritual?.instruction ?? "");
  const [scope, setScope] = useState<ReadonlyArray<RitualScopeEntry & { readonly id: string }>>(
    (ritual?.scope ?? []).map((entry) => ({ ...entry, id: newRequestId() })),
  );
  const [schedule, setSchedule] = useState<RitualSchedule>(ritual?.schedule ?? { _tag: "Daily", time: "07:00" });
  const [primary, setPrimary] = useState<Runner>(
    ritual?.primary ?? { accountId: null, effort: "default", harness: "claude", model: startingModel },
  );
  const [fallbacks, setFallbacks] = useState<ReadonlyArray<Runner>>(ritual?.fallbacks ?? []);
  const [isOn, setIsOn] = useState(ritual?.isOn ?? true);
  const [workspacePath, setWorkspacePath] = useState<string | null>(initialWorkspacePath);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const canSave =
    title.trim() !== "" &&
    instruction.trim() !== "" &&
    scope.every(
      (entry) => entry.target.trim() !== "" && (!isValued(entry.operation) || (entry.payload ?? "").trim() !== ""),
    ) &&
    isScheduleValid(schedule) &&
    !isSaving;
  const scopeToSave = scope.map(({ operation, payload, target }) => ({
    operation,
    payload: isValued(operation) ? (payload ?? "").trim() : null,
    target: target.trim(),
  }));
  const changeEntry = (index: number, change: Partial<RitualScopeEntry>) =>
    setScope(scope.map((entry, at) => (at === index ? { ...entry, ...change } : entry)));
  const addFallback = () => {
    // The first harness other than the primary's, on its first listed model.
    const other = harnesses?.harnesses.find((candidate) => candidate.name !== primary.harness);
    setFallbacks([
      ...fallbacks,
      {
        accountId: null,
        effort: "default",
        harness: other?.name ?? "codex",
        model: other?.models[0]?.id ?? "default",
      },
    ]);
  };
  const save = () => {
    setIsSaving(true);
    setError(null);
    const saved =
      ritual === null
        ? client
            .request(
              createRequestOf({
                fallbacks,
                instruction: instruction.trim(),
                originMissionId,
                primary,
                requestId: newRequestId(),
                schedule,
                scope: scopeToSave,
                title: title.trim(),
                workspacePath,
              }),
            )
            .then((created) => created.missionId)
        : client
            .request({
              _tag: "UpdateRitual",
              fallbacks,
              instruction: instruction.trim(),
              isOn,
              primary,
              ritualId: ritual.id,
              schedule,
              scope: scopeToSave,
              title: title.trim(),
            })
            .then(() => ritual.missionId);
    saved.then(onDone, (reason) => setError(messageOf(reason))).finally(() => setIsSaving(false));
  };
  return (
    <View style={ritualStyles.form}>
      <View style={ritualStyles.formHeading}>
        <Emblem name="moon" size={26} tint={colors.violet} />
        <Text style={ritualStyles.formTitle}>{ritual === null ? "New Ritual" : "Edit Ritual"}</Text>
      </View>
      <Part name="Name">
        <TextInput
          accessibilityLabel="Ritual title"
          maxLength={80}
          onChangeText={setTitle}
          placeholder="Morning digest"
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          value={title}
        />
      </Part>
      <Part name="Instruction, sent on each run">
        <TextInput
          accessibilityLabel="Ritual instruction"
          multiline
          numberOfLines={4}
          onChangeText={setInstruction}
          placeholder="Summarise what changed in the repository since yesterday."
          placeholderTextColor={colors.placeholder}
          style={[styles.input, ritualStyles.instruction]}
          value={instruction}
        />
      </Part>
      <Part name="Actions its runs may take without asking">
        <Text style={styles.muted}>
          Commands run on their own in the sandbox. Only these exact actions on a quest or a setting run unasked in this
          Ritual's runs; anything else asks you. Remove one to revoke it.
        </Text>
        {scope.map((entry, index) => (
          <View key={entry.id}>
            <Menu
              accessibilityLabel={`Allowed action ${index + 1}`}
              label={(operation) => scopeOperationLabels[operation]}
              onChange={(operation) =>
                changeEntry(index, { operation, payload: isValued(operation) ? entry.payload : null })
              }
              options={RitualScopeOperation.literals}
              value={entry.operation}
            />
            <TextInput
              accessibilityLabel={`Allowed action target ${index + 1}`}
              onChangeText={(target) => changeEntry(index, { target })}
              placeholder={
                entry.operation === "ChangeSetting"
                  ? "Setting name, such as shouldShowFinishedQuests"
                  : "Quest title or id"
              }
              placeholderTextColor={colors.placeholder}
              style={styles.input}
              value={entry.target}
            />
            {isValued(entry.operation) ? (
              <TextInput
                accessibilityLabel={`Allowed action new value ${index + 1}`}
                onChangeText={(payload) => changeEntry(index, { payload })}
                placeholder={entry.operation === "ChangeSetting" ? "New value as JSON, such as true" : "New title"}
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                value={entry.payload ?? ""}
              />
            ) : null}
            <Pressable onPress={() => setScope(scope.filter((_, at) => at !== index))}>
              <Text style={styles.link}>Remove this action</Text>
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={() => setScope([...scope, { id: newRequestId(), operation: "Archive", payload: null, target: "" }])}
        >
          <Text style={styles.link}>Allow an action</Text>
        </Pressable>
      </Part>
      <Part name="Runs">
        <ScheduleRow onChange={setSchedule} value={schedule} />
      </Part>
      <Part name="Companion">
        <View style={ritualStyles.sentence}>
          <RunnerPickers harnesses={harnesses} isCompact={true} onChange={setPrimary} value={primary} />
        </View>
      </Part>
      <Part name="If a run fails, fall back to">
        {fallbacks.map((fallback, index) => (
          // A fallback has no identity but its place in the list.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <View key={index} style={ritualStyles.sentence}>
            <Word text={index === 0 ? "first" : "then"} />
            <RunnerPickers
              harnesses={harnesses}
              isCompact={true}
              onChange={(next) => setFallbacks(fallbacks.map((current, other) => (other === index ? next : current)))}
              value={fallback}
            />
            <Pressable
              accessibilityLabel={`Remove fallback ${index + 1}`}
              accessibilityRole="button"
              onPress={() => setFallbacks(fallbacks.filter((_, other) => other !== index))}
            >
              <Text style={ritualStyles.remove}>Remove</Text>
            </Pressable>
          </View>
        ))}
        {fallbacks.length < 5 && (
          <Pressable accessibilityRole="button" onPress={addFallback}>
            <Text style={styles.link}>+ Add a fallback Companion</Text>
          </Pressable>
        )}
      </Part>
      {ritual === null && originMissionId === null ? (
        <Part name="Realm">
          <RealmChooser
            client={client}
            onChange={setWorkspacePath}
            realms={known?.workspaces ?? []}
            value={workspacePath}
          />
        </Part>
      ) : ritual === null ? (
        // The origin quest names the realm the Ritual lives in (CHG-0616, Creation): its realm is already taken.
        <Part name="Realm">
          <Text style={styles.muted}>This Ritual takes the realm of the quest it is scheduled from.</Text>
        </Part>
      ) : (
        <View style={ritualStyles.sentence}>
          <Toggle onValueChange={setIsOn} value={isOn} />
          <Text style={styles.body}>{isOn ? "On: runs on its schedule" : "Off: runs only when you run it"}</Text>
        </View>
      )}
      {error !== null && <Text style={styles.error}>{error}</Text>}
      <View style={ritualStyles.sentence}>
        <Pressable
          accessibilityLabel={ritual === null ? "Create Ritual" : "Save Ritual"}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          disabled={!canSave}
          onPress={save}
          style={[styles.button, !canSave && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{ritual === null ? "Create Ritual" : "Save"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.buttonSecondary}>
          <Text style={styles.buttonSecondaryText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
