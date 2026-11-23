import type { CompanionPresetEdit, Tier } from "@outlore/contracts";
import { useState } from "react";
import { Text, View } from "react-native";
import { BackupsEditor } from "../editors/backupsEditor";
import { PresetNameForm } from "../editors/presetNameForm";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";

/** Sends one preset edit without replacing the rest of the library. */
export const savePresetEdit = (client: ServiceClient, edit: CompanionPresetEdit) =>
  client.request({ _tag: "ChangeCompanionPreset", edit });

/** Rename or delete a saved preset from the Workshop. */
export function PresetActions({ client, name }: { client: ServiceClient; name: string }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await savePresetEdit(client, { _tag: "Delete", name });
      setIsConfirming(false);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      {isConfirming ? (
        <>
          <Text style={styles.body}>Delete “{name}”?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Button isDisabled={isDeleting} label="Delete preset" onPress={remove} />
            <Button
              isDisabled={isDeleting}
              isPrimary={false}
              label="Cancel"
              onPress={() => {
                setIsConfirming(false);
                setError(null);
              }}
            />
          </View>
        </>
      ) : (
        <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <PresetNameForm
            initialName={name}
            label="Rename"
            onSave={(nextName) => savePresetEdit(client, { _tag: "Rename", name, nextName })}
          />
          <Button isPrimary={false} label="Delete" onPress={() => setIsConfirming(true)} />
        </View>
      )}
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
    </View>
  );
}

/** Edits a new custom preset's full stack before adding it to the library. */
export function AddPreset({ client, defaults }: { client: ServiceClient; defaults: Tier }) {
  const [draft, setDraft] = useState<Tier | null>(null);
  const stack = draft ?? defaults;
  return (
    <PresetNameForm
      label="Add preset"
      onCancel={() => setDraft(null)}
      onSave={async (name) => {
        await savePresetEdit(client, { _tag: "Add", name, stack });
        setDraft(null);
      }}
    >
      <PresetStackPicker client={client} onChange={setDraft} stack={stack} />
    </PresetNameForm>
  );
}

/** Changes the stack of a custom preset while keeping its name. */
export function EditPreset({ client, name, saved }: { client: ServiceClient; name: string; saved: Tier }) {
  const [draft, setDraft] = useState<Tier | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (draft === null) return;
    setIsSaving(true);
    setError(null);
    try {
      await savePresetEdit(client, { _tag: "SetStack", name, stack: draft });
      setDraft(null);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setIsSaving(false);
    }
  };
  return draft === null ? (
    <Button isPrimary={false} label="Edit Companions" onPress={() => setDraft(saved)} />
  ) : (
    <View style={{ gap: 8 }}>
      <PresetStackPicker client={client} onChange={setDraft} stack={draft} />
      {error !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button isDisabled={isSaving} label="Save changes" onPress={save} />
        <Button
          isDisabled={isSaving}
          isPrimary={false}
          label="Cancel"
          onPress={() => {
            setDraft(null);
            setError(null);
          }}
        />
      </View>
    </View>
  );
}

function PresetStackPicker({
  client,
  onChange,
  stack,
}: {
  client: ServiceClient;
  onChange: (stack: Tier) => void;
  stack: Tier;
}) {
  const { data: harnesses } = useHarnesses(client);
  return (
    <>
      <RunnerPickers
        client={client}
        harnesses={harnesses}
        isCompact={false}
        onChange={(runner) => onChange({ ...runner, backups: stack.backups })}
        value={stack}
      />
      <Text style={styles.body}>Backup companions</Text>
      <BackupsEditor
        backups={stack.backups}
        harnesses={harnesses}
        isCompact={false}
        onChange={(backups) => onChange({ ...stack, backups })}
      />
    </>
  );
}
