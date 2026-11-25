import type { HarnessInfo, HarnessList, HarnessName } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";
import { HarnessCard, MissingRow } from "./harnessCards";
import { providerStyles } from "./providerStyles";

/**
 * The Workshop's Providers section: a card for each installed harness holding its version, its update, and its
 * accounts (the Harnesses and Accounts cards, merged). Refresh asks each harness again; installed ones with a newer
 * version offer Update. The missing ones stay out of sight behind "Install another provider", which lists them with
 * Install.
 */
export function ProvidersSection({
  client,
  harnesses,
  onChanged,
  onRefresh,
}: {
  client: ServiceClient;
  harnesses: HarnessList | null;
  onChanged: (list: HarnessList) => void;
  onRefresh: () => void;
}) {
  const [updating, setUpdating] = useState<HarnessName | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [error, setError] = useState<{ harness: HarnessName; message: string } | null>(null);
  const update = (harness: HarnessInfo) => {
    if (updating !== null) return;
    setUpdating(harness.name);
    setError(null);
    return client
      .request({ _tag: harness.problem === null ? "UpdateHarness" : "InstallHarness", harness: harness.name })
      .then(
        (list) => {
          setUpdating(null);
          onChanged(list);
        },
        (reason: unknown) => {
          setUpdating(null);
          setError({ harness: harness.name, message: messageOf(reason) });
        },
      );
  };
  const missing = harnesses?.harnesses.filter((harness) => harness.problem !== null) ?? [];
  return (
    <>
      <View style={providerStyles.intro}>
        <Text style={[styles.muted, styles.flex]}>
          Each account keeps its own sign-in and conversations. Quests and errands use the account chosen when they
          start.
        </Text>
        <Pressable accessibilityRole="button" onPress={onRefresh}>
          <Text style={styles.link}>Refresh</Text>
        </Pressable>
      </View>
      {harnesses === null ? (
        <Text style={styles.muted}>Asking each harness who is signed in…</Text>
      ) : (
        <>
          {harnesses.harnesses
            .filter((harness) => harness.problem === null)
            .map((harness) => (
              <HarnessCard
                client={client}
                error={error?.harness === harness.name ? error.message : null}
                harness={harness}
                isBusy={updating !== null}
                isUpdating={updating === harness.name}
                key={harness.name}
                onChanged={onChanged}
                onError={(message) => setError(message === null ? null : { harness: harness.name, message })}
                onUpdate={() => update(harness)}
              />
            ))}
          {missing.length > 0 && (
            <>
              <View style={providerStyles.more}>
                <Button
                  label={isPickerOpen ? "Hide providers to install" : "Install another provider"}
                  onPress={() => setIsPickerOpen(!isPickerOpen)}
                />
              </View>
              {isPickerOpen &&
                missing.map((harness) => (
                  <MissingRow
                    error={error?.harness === harness.name ? error.message : null}
                    harness={harness}
                    isBusy={updating !== null}
                    isUpdating={updating === harness.name}
                    key={harness.name}
                    onInstall={() => update(harness)}
                  />
                ))}
            </>
          )}
        </>
      )}
    </>
  );
}
