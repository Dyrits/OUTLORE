import { type CreateRepositoryRealm, type RealmArchivePreview, realmSlugOf } from "@outlore/contracts";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { messageOf } from "../foundation/client";
import { colors } from "../foundation/theme";
import { FolderPicker } from "./folderPicker";
import { folderNameOf } from "./realmLabels";
import { realmModalStyles as local } from "./realmModalStyles";
import { proposedRealmOf } from "./realmRecovery";
import { RealmRecoveryModal } from "./realmRecoveryModal";
import { type RealmSource, RealmSourceChoices } from "./realmSourceChoices";

/** A realm being made: named. The path is empty until a folder is chosen, and stays so for a realm tied to none. */
export type NewRealm = { name: string; path: string };

/**
 * Names a realm for a selected folder, or offers all sources when opened from the sidebar.
 */
export function NewRealmModal({
  client,
  isFolderRequired = true,
  initial,
  onCancel,
  onCreated,
}: {
  client: ServiceClient;
  /** When opened from a quest, skip the source choice and name the selected folder. */
  isFolderRequired?: boolean;
  initial: NewRealm;
  onCancel: () => void;
  /** Selects the successfully created or recovered realm in the calling form. */
  onCreated?: (realm: NewRealm) => void;
}) {
  const [editing, setEditing] = useState(initial);
  const [isChoosingSource, setIsChoosingSource] = useState(!isFolderRequired);
  const [source, setSource] = useState<RealmSource>("Folder");
  const [repository, setRepository] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);
  const [isBusy, setBusy] = useState(false);
  const [isDuplicate, setDuplicate] = useState(false);
  const [archived, setArchived] = useState<RealmArchivePreview | null>(null);
  const isClone = source === "GitHub" || source === "GitUrl";
  const isRepository = source === "Project" || isClone;
  const proposed = source === "Folder" ? proposedRealmOf(editing) : { ...editing, name: realmSlugOf(editing.name) };
  const repositorySource: (typeof CreateRepositoryRealm.Type)["source"] | null =
    source === "Project"
      ? { _tag: "Project" }
      : source === "GitHub"
        ? { _tag: "GitHub", repository }
        : source === "GitUrl"
          ? { _tag: "GitUrl", url: repository }
          : null;
  const isReady =
    !isChoosingSource &&
    proposed.name !== "" &&
    (source === "Empty" || proposed.path !== "") &&
    (!isClone || repository.trim() !== "") &&
    !isBusy;
  const complete = () => {
    onCreated?.(proposed);
    onCancel();
  };
  const cancel = () => {
    if (!isBusy) onCancel();
  };
  const create = async (shouldAllowDuplicateName = false) => {
    if (!isReady) return;
    setBusy(true);
    setError(null);
    try {
      const name = proposed.name;
      const allowDuplicateName = shouldAllowDuplicateName;
      const outcome =
        repositorySource === null
          ? await client.request({
              _tag: "CreateRealm",
              allowDuplicateName,
              name,
              path: source === "Empty" ? null : proposed.path,
              shouldAnswerOutcome: true,
            })
          : await client.request({
              _tag: "CreateRepositoryRealm",
              allowDuplicateName,
              name,
              parent: proposed.path,
              source: repositorySource,
            });
      if (outcome?._tag === "ArchivedMatch") {
        setArchived(outcome.archived);
        return;
      }
      if (outcome?._tag === "NameTaken") {
        setDuplicate(true);
        return;
      }
      complete();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  const choose = (path: string) => {
    setIsPicking(false);
    setError(null);
    setDuplicate(false);
    setEditing({
      ...editing,
      name: source === "Folder" && editing.name.trim() === "" ? folderNameOf(path) : editing.name,
      path,
    });
  };
  const chooseSource = (next: RealmSource) => {
    setIsChoosingSource(false);
    if (next !== source) {
      setSource(next);
      setEditing({ ...editing, path: "" });
      setRepository("");
      setDuplicate(false);
      setError(null);
    }
  };
  if (archived !== null)
    return (
      <RealmRecoveryModal
        client={client}
        initial={archived}
        onCancel={() => setArchived(null)}
        onRecovered={complete}
        proposed={proposed}
      />
    );
  return (
    <Modal animationType="fade" onRequestClose={cancel} transparent visible>
      <View style={local.backdrop}>
        <Pressable accessibilityLabel="Close" disabled={isBusy} onPress={cancel} style={StyleSheet.absoluteFill} />
        <ScrollView contentContainerStyle={local.menu} keyboardShouldPersistTaps="handled" style={local.scroll}>
          <Text style={local.menuTitle}>Visit a new realm</Text>
          {isChoosingSource ? (
            <>
              <RealmSourceChoices onChoose={chooseSource} />
              <Pressable accessibilityRole="button" onPress={cancel} style={local.menuButton}>
                <Text style={local.menuButtonText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              {isClone && (
                <View style={local.menuFields}>
                  <Text style={local.menuLabel}>
                    {source === "GitHub" ? "GitHub repository (owner/repo)" : "Git URL"}
                  </Text>
                  <TextInput
                    accessibilityLabel={source === "GitHub" ? "GitHub repository (owner/repo)" : "Git URL"}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    editable={!isBusy}
                    onChangeText={(value) => {
                      setRepository(value);
                      setDuplicate(false);
                      setError(null);
                    }}
                    placeholder={source === "GitHub" ? "owner/repo" : "https://host/owner/repo.git"}
                    placeholderTextColor={colors.placeholder}
                    spellCheck={false}
                    style={local.nameInput}
                    value={repository}
                  />
                </View>
              )}
              {source !== "Empty" && (
                <View style={local.folderRow}>
                  <Text numberOfLines={2} style={[local.menuPath, editing.path === "" && local.menuPathEmpty]}>
                    {editing.path !== ""
                      ? editing.path
                      : isRepository
                        ? "Choose where to create the realm's folder"
                        : "No folder chosen"}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isBusy}
                    onPress={() => setIsPicking(true)}
                    style={local.menuButton}
                  >
                    <Text style={local.menuButtonText}>
                      {editing.path !== "" ? "Change folder…" : isRepository ? "Choose destination…" : "Choose folder…"}
                    </Text>
                  </Pressable>
                </View>
              )}
              <View style={local.namingRow}>
                <View style={local.menuFields}>
                  <Text style={local.menuLabel}>{isRepository ? "Realm and folder name" : "Realm name"}</Text>
                  <TextInput
                    accessibilityLabel={isRepository ? "Realm and folder name" : "Realm name"}
                    autoFocus={!isClone}
                    editable={!isBusy}
                    maxLength={80}
                    onChangeText={(name) => {
                      setEditing({ ...editing, name });
                      setDuplicate(false);
                      setError(null);
                    }}
                    placeholder="Name the realm"
                    placeholderTextColor={colors.placeholder}
                    style={local.nameInput}
                    value={editing.name}
                  />
                </View>
              </View>
              {isDuplicate && (
                <Text style={local.error}>Another active realm is named "{proposed.name}". Use this name too?</Text>
              )}
              {error !== null && (
                <Text accessibilityRole="alert" style={local.error}>
                  {error}
                </Text>
              )}
              <View style={local.menuFooter}>
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={isFolderRequired ? cancel : () => setIsChoosingSource(true)}
                  style={local.menuButton}
                >
                  <Text style={local.menuButtonText}>{isFolderRequired ? "Cancel" : "Back"}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!isReady}
                  onPress={() => {
                    void create(isDuplicate);
                  }}
                  style={[local.menuDone, !isReady && local.menuDoneOff]}
                >
                  <Text accessibilityLiveRegion="polite" style={local.menuDoneText}>
                    {isBusy ? (isClone ? "Cloning…" : "Creating…") : isDuplicate ? "Use this name" : "Visit the realm"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
      {isPicking && <FolderPicker client={client} onCancel={() => setIsPicking(false)} onChoose={choose} />}
    </Modal>
  );
}
