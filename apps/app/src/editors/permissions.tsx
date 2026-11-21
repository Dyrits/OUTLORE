import type { MissionId, StandingPermission, ThreadPermissionMode } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Choice } from "../ui/pickers";
import { questionOriginOf } from "../ui/questionOrigin";
import { QuestionLine } from "../ui/questions";
import { permissionModeLabels, permissionModeOptions } from "./permissionModes";

/** What each mode means for a thread, shown under the Workshop's choice. */
const modeDescriptions = {
  Auto: "Sandbox-covered commands and edits inside the workspace run without asking; everything else asks.",
  AutoAcceptEdits: "Edits inside the workspace run without asking; commands and everything else asks.",
  FullAccess:
    "Every thread you open runs with its harness's requests approved automatically, including errands other threads open, and commands may leave the sandbox. Outlore's own approvals, such as publishing, still ask.",
  Supervised: "Commands and edits the harness submits for approval each ask.",
} as const satisfies Record<ThreadPermissionMode, string>;

/** Whether a standing permission was widened to every mission and workspace. */
const isEverywhere = (permission: StandingPermission) =>
  permission.workspaceId === null && permission.missionId === null;

/** Where a standing permission applies: its workspace, its mission, or everywhere. */
const scopeOf = (permission: StandingPermission) =>
  isEverywhere(permission)
    ? "Everywhere"
    : permission.workspaceId !== null
      ? `In realm ${permission.workspaceName}`
      : `In ${permission.missionTitle}`;

/** The default permission mode, standing permissions, and the history of answers. */
export function PermissionsScreen({ client, onBack }: { client: ServiceClient; onBack: () => void }) {
  const [missionFilter, setMissionFilter] = useState<MissionId | null>(null);
  const { data: view, error } = useServiceQuery(
    client,
    { _tag: "ReadPermissions", missionId: missionFilter },
    `permissions-${missionFilter ?? "all"}`,
  );
  const { data: list } = useServiceQuery(client, allMissions.request, allMissions.key);
  const missions = list?.missions ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const act = (work: Promise<unknown>) =>
    work.then(
      () => setActionError(null),
      (reason) => setActionError(messageOf(reason)),
    );
  const missionTitle = (id: MissionId | null) =>
    id === null ? "All quests" : (missions?.find((mission) => mission.id === id)?.title ?? "Quest");
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack}>
          <Text style={styles.link}>← Workshop</Text>
        </Pressable>
        <Text style={styles.heading}>Permissions</Text>
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {actionError !== null && <Text style={styles.error}>{actionError}</Text>}
      {view && (
        <>
          <View style={styles.section}>
            <Text style={styles.label}>Permission mode</Text>
            <Choice
              label={(mode) => permissionModeLabels[mode]}
              onChange={(defaultPermissionMode) =>
                act(client.request({ _tag: "ChangeSettings", change: { defaultPermissionMode } }))
              }
              options={permissionModeOptions}
              value={view.defaultMode}
            />
            <Text style={styles.muted}>{modeDescriptions[view.defaultMode]}</Text>
            <Text style={styles.muted}>
              Every thread without a mode of its own runs with this mode, and the composer names it under Default
              permissions. Only you can change this; a thread cannot.
            </Text>
            {view.sandboxProblem !== null && (view.defaultMode === "Auto" || view.defaultMode === "FullAccess") && (
              <Text style={styles.muted}>
                {view.sandboxProblem}{" "}
                {view.defaultMode === "Auto"
                  ? "Commands run without it; only sensitive actions ask."
                  : "Commands run without it and without asking."}
              </Text>
            )}
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Standing permissions</Text>
            {view.permissions.length === 0 && <Text style={styles.muted}>None yet. Always allow adds one.</Text>}
            {view.permissions.map((permission) => (
              <View key={permission.id} style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.body}>{permission.sentence}</Text>
                  <Text style={styles.muted}>
                    {permission.pattern} · {scopeOf(permission)}
                  </Text>
                </View>
                {!isEverywhere(permission) && (
                  <Pressable
                    onPress={() => act(client.request({ _tag: "WidenPermission", permissionId: permission.id }))}
                  >
                    <Text style={styles.link}>Allow everywhere</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => act(client.request({ _tag: "RemovePermission", permissionId: permission.id }))}
                >
                  <Text style={styles.error}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>History</Text>
            <Choice
              label={missionTitle}
              onChange={setMissionFilter}
              options={[null, ...(missions ?? []).map((mission) => mission.id)]}
              value={missionFilter}
            />
            {view.history.length === 0 && <Text style={styles.muted}>No answers yet.</Text>}
            {view.history.map((question) => (
              <View key={question.id}>
                {questionOriginOf(question).map((line) => (
                  <Text key={line.key} numberOfLines={1} style={styles.muted}>
                    {line.title}
                  </Text>
                ))}
                <Text style={styles.body}>{question.summary}</Text>
                <QuestionLine question={question} />
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}
