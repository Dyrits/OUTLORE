import type { Request, Settings, ThreadId } from "@outlore/contracts";
import { actWith } from "../foundation/acting";
import type { ServiceClient } from "../foundation/client";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { type PresetChoice, presetChangeOf, presetStackRequest, presetsOf } from "./presets";

/** What a thread's presets ask of the service: the one request it sends. */
type PresetClient = { request: (request: Request) => Promise<unknown> };

/**
 * The presets of a thread's Companions tab for the settings and backups read: what choosing one asks of the service, a failure shown through `setError`, and what saves a preset.
 * Saving a preset (`onOverwritePreset`, also edit mode's) sends only `ChangeCompanionPreset`: it never changes the thread's Companion.
 */
export const presetChoiceOf = (
  client: PresetClient,
  threadId: ThreadId,
  settings: Pick<Settings, "companionPresets" | "tiers">,
  backups: PresetChoice["backups"],
  setError: (error: string | null) => void,
): PresetChoice => ({
  backups,
  onDeletePreset: (name) => client.request({ _tag: "ChangeCompanionPreset", edit: { _tag: "Delete", name } }),
  onOverwritePreset: (name, stack) => client.request(presetStackRequest(name, stack)),
  onPreset: (preset) =>
    actWith(setError)(client.request({ _tag: "ChangeThreadRunner", ...presetChangeOf(preset), threadId })),
  onRenamePreset: (name, nextName) =>
    client.request({ _tag: "ChangeCompanionPreset", edit: { _tag: "Rename", name, nextName } }),
  onSavePreset: (name, stack) => client.request({ _tag: "ChangeCompanionPreset", edit: { _tag: "Add", name, stack } }),
  presets: presetsOf(settings.tiers, settings.companionPresets),
});

/** What a thread's Companion picker needs to offer the presets: the thread's current backups, the presets set in the Workshop, and what choosing one asks of the service, with a failure shown through `setError`. */
export function useThreadPresets(
  client: ServiceClient,
  threadId: ThreadId,
  setError: (error: string | null) => void,
): PresetChoice | null {
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: panel } = useServiceQuery(client, { _tag: "ReadThreadPanel", threadId }, `companion:${threadId}`);
  return settings === null ? null : presetChoiceOf(client, threadId, settings, panel?.backups ?? null, setError);
}
