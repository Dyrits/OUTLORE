import type { HarnessInfo, HarnessList } from "@outlore/contracts";
import { Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { harnessLabels } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { Button } from "../ui/button";
import { ProviderMark } from "../ui/providerMarks";
import { AccountRow, AddAccount, StatusPill } from "./accountRows";
import { AddKeyAccount } from "./keyAccountForm";
import { canAddAccount, versionOf } from "./providerRules";
import { providerStyles } from "./providerStyles";

/** What a harness's head says beside its name: that it is ready and any update on offer, or what is wrong. */
function HarnessState({ harness, isUpdating }: { harness: HarnessInfo; isUpdating: boolean }) {
  if (isUpdating) return <Text style={styles.muted}>{harness.problem === null ? "Updating…" : "Installing…"}</Text>;
  if (harness.problem !== null) return <StatusPill isGood={false} label="Not ready" />;
  return (
    <>
      <StatusPill isGood label="Ready" />
      {harness.update !== null && <Text style={styles.muted}>Update available · {harness.update}</Text>}
    </>
  );
}

/**
 * One harness and its accounts in one card: its logo, name, version, whether it can run, and Update (or Install when it is missing);
 * then the computer's own sign-in and the accounts added here, each signed in through the harness's own sign-in inside Outlore's inline terminal when interactive, so Outlore never sees the credentials (provider-accounts).
 */
export function HarnessCard({
  client,
  error,
  harness,
  isBusy,
  isUpdating,
  onChanged,
  onError,
  onUpdate,
}: {
  client: ServiceClient;
  error: string | null;
  harness: HarnessInfo;
  isBusy: boolean;
  isUpdating: boolean;
  onChanged: (list: HarnessList) => void;
  onError: (message: string | null) => void;
  onUpdate: () => void;
}) {
  const version = versionOf(harness);
  const hasAction = harness.problem !== null || harness.update !== null;
  return (
    <View style={providerStyles.card}>
      <View style={providerStyles.head}>
        <ProviderMark harness={harness.name} size={40} />
        <Text style={providerStyles.name}>{harnessLabels[harness.name]}</Text>
        {version !== null && (
          <View style={providerStyles.version}>
            <Text style={providerStyles.versionText}>{version}</Text>
          </View>
        )}
        <View style={providerStyles.state}>
          <HarnessState harness={harness} isUpdating={isUpdating} />
        </View>
        {hasAction && !isUpdating && (
          <Button isDisabled={isBusy} label={harness.problem === null ? "Update" : "Install"} onPress={onUpdate} />
        )}
      </View>
      {error !== null && (
        <Text accessibilityRole="alert" style={[styles.error, providerStyles.problem]}>
          {error}
        </Text>
      )}
      {harness.problem !== null ? (
        error === null && <Text style={[styles.error, providerStyles.problem]}>{harness.problem}</Text>
      ) : (
        <View style={providerStyles.accounts}>
          {harness.accounts.map((account) => (
            <AccountRow
              account={account}
              client={client}
              harness={harness.name}
              key={account.id ?? "own"}
              onChanged={onChanged}
              onError={onError}
            />
          ))}
          {canAddAccount(harness) ? (
            <AddAccount client={client} harness={harness.name} onChanged={onChanged} onError={onError} />
          ) : (
            <Text style={styles.muted}>Uses this computer's sign-in only.</Text>
          )}
          <AddKeyAccount client={client} harness={harness.name} onChanged={onChanged} onError={onError} />
        </View>
      )}
    </View>
  );
}

/** A harness that is not installed yet, in the "Install another provider" list: its logo, name, Install, and any failure. */
export function MissingRow({
  error,
  harness,
  isBusy,
  isUpdating,
  onInstall,
}: {
  error: string | null;
  harness: HarnessInfo;
  isBusy: boolean;
  isUpdating: boolean;
  onInstall: () => void;
}) {
  return (
    <View style={providerStyles.card}>
      <View style={providerStyles.head}>
        <ProviderMark harness={harness.name} size={40} />
        <Text style={providerStyles.name}>{harnessLabels[harness.name]}</Text>
        <View style={providerStyles.state}>{isUpdating && <Text style={styles.muted}>Installing…</Text>}</View>
        {!isUpdating && <Button isDisabled={isBusy} label="Install" onPress={onInstall} />}
      </View>
      {error !== null && (
        <Text accessibilityRole="alert" style={[styles.error, providerStyles.problem]}>
          {error}
        </Text>
      )}
    </View>
  );
}
