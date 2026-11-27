import type { AccountId, AccountStatus, HarnessList, HarnessName } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { harnessLabels } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { InlineTerminal } from "../terminal/inlineTerminal";
import { ActionMenu } from "../ui/actionMenu";
import { Button } from "../ui/button";
import { RowIcon } from "../ui/rowIcons";
import { ReplaceKey } from "./keyAccountForm";
import { providerStyles } from "./providerStyles";

/** What a sign-in state says on an account's badge. */
const signInLabels = {
  SignedIn: "Signed in",
  SignedOut: "Signed out",
  Unknown: "Sign-in unknown",
} as const satisfies Record<AccountStatus["signIn"], string>;

/** A small pill: a dot and a word, green when the thing is fine and quiet otherwise. */
export function StatusPill({ isGood, label }: { isGood: boolean; label: string }) {
  return (
    <View style={[providerStyles.pill, isGood && providerStyles.pillGood]}>
      <View style={[providerStyles.pillDot, isGood && providerStyles.pillDotGood]} />
      <Text style={[providerStyles.pillText, isGood && providerStyles.pillTextGood]}>{label}</Text>
    </View>
  );
}

/** One account of a harness: its name, sign-in state, and the actions on it, with the inline terminal while an interactive sign-in runs. */
export function AccountRow({
  account,
  client,
  harness,
  onChanged,
  onError,
}: {
  account: AccountStatus;
  client: ServiceClient;
  harness: HarnessName;
  onChanged: (list: HarnessList) => void;
  onError: (message: string | null) => void;
}) {
  // "Browser" while a sign-in without a terminal waits for the owner in the browser; "Terminal" while an interactive sign-in runs inside Outlore's inline terminal.
  const [signingIn, setSigningIn] = useState<
    | null
    | { readonly _tag: "Browser" }
    | { readonly _tag: "Terminal"; readonly terminalId: string; readonly title: string }
  >(null);
  // The new name while renaming; null when not. A harness's own sign-in may be left blank to take the computer's name.
  const [name, setName] = useState<string | null>(null);
  // Whether the field that replaces an API key account's key is open.
  const [isReplacingKey, setReplacingKey] = useState(false);
  const refreshHarnesses = () =>
    void client.request({ _tag: "ListHarnesses" }).then(
      (list) => onChanged(list),
      (reason) => onError(messageOf(reason)),
    );
  const signIn = () => {
    // A second press while the first waits would collide with it on the harness's local port.
    if (signingIn?._tag === "Browser") return;
    setSigningIn({ _tag: "Browser" });
    return client.request({ _tag: "SignInAccount", accountId: account.id, harness }).then(
      (result) => {
        if (result._tag === "Finished") {
          setSigningIn(null);
          onChanged(result.harnesses);
        } else {
          setSigningIn({ _tag: "Terminal", terminalId: result.terminal.terminalId, title: result.terminal.title });
        }
        onError(null);
      },
      (reason) => {
        setSigningIn(null);
        onError(messageOf(reason));
      },
    );
  };
  const remove = (accountId: AccountId) =>
    client.request({ _tag: "RemoveAccount", accountId }).then(
      (list) => {
        onChanged(list);
        onError(null);
      },
      (reason) => onError(messageOf(reason)),
    );
  const rename = (label: string) =>
    client
      .request(
        account.id === null
          ? { _tag: "RenameOwnAccount", harness, label }
          : { _tag: "RenameAccount", accountId: account.id, label },
      )
      .then(
        (list) => {
          setName(null);
          onChanged(list);
          onError(null);
        },
        (reason) => onError(messageOf(reason)),
      );
  const accountId = account.id;
  const actions = [
    // An API key account has no sign-in to run: its key is what it takes.
    account.keyProvider === undefined
      ? { label: account.signIn === "SignedIn" ? "Sign in again" : "Sign in", onPress: signIn }
      : { label: "Replace API key", onPress: () => setReplacingKey(true) },
    ...(accountId === null ? [] : [{ label: "Remove", onPress: () => remove(accountId) }]),
  ];
  return (
    <View style={providerStyles.accountBlock}>
      <View style={providerStyles.account}>
        <RowIcon name="account" tint={colors.textMuted} />
        <View style={providerStyles.accountName}>
          {name === null ? (
            <Text numberOfLines={1} style={providerStyles.accountNameText}>
              {account.label}
            </Text>
          ) : (
            <TextInput
              accessibilityLabel={`Name of the ${harnessLabels[harness]} account ${account.label}`}
              autoFocus
              maxLength={80}
              onChangeText={setName}
              onSubmitEditing={() => rename(name)}
              placeholder={accountId === null ? "Blank takes the computer's name" : "Name of the account"}
              style={[styles.input, providerStyles.renameInput]}
              value={name}
            />
          )}
        </View>
        <Text style={[styles.muted, providerStyles.accountDetail]}>
          {signingIn?._tag === "Browser"
            ? "Finish signing in in your browser."
            : signingIn?._tag === "Terminal"
              ? "Finish signing in below."
              : (account.detail ?? signInLabels[account.signIn])}
        </Text>
        <StatusPill isGood={account.signIn === "SignedIn"} label={signInLabels[account.signIn]} />
        {name === null ? (
          <Pressable accessibilityRole="button" onPress={() => setName(account.label)}>
            <Text style={styles.link}>Rename</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={name.trim() === account.label || (accountId !== null && name.trim() === "")}
              onPress={() => rename(name)}
            >
              <Text style={styles.link}>Save</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setName(null)}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
          </>
        )}
        <ActionMenu
          accessibilityLabel={`More for ${harnessLabels[harness]} account ${account.label}`}
          actions={actions}
        />
      </View>
      {isReplacingKey && accountId !== null && (
        <ReplaceKey
          accountId={accountId}
          client={client}
          label={account.label}
          onChanged={onChanged}
          onClose={() => setReplacingKey(false)}
          onError={onError}
        />
      )}
      {signingIn?._tag === "Terminal" && (
        <InlineTerminal
          client={client}
          mode="command"
          onClose={() => {
            setSigningIn(null);
            refreshHarnesses();
          }}
          onExit={(exitCode) => {
            refreshHarnesses();
            if (exitCode === 0) {
              void client.request({ _tag: "CloseTerminal", id: signingIn.terminalId }).catch(() => {});
              setSigningIn(null);
            }
          }}
          terminalId={signingIn.terminalId}
          title={signingIn.title}
        />
      )}
    </View>
  );
}

/** The foot of a harness's accounts: Add account, which opens a name field in place. */
export function AddAccount({
  client,
  harness,
  onChanged,
  onError,
}: {
  client: ServiceClient;
  harness: HarnessName;
  onChanged: (list: HarnessList) => void;
  onError: (message: string | null) => void;
}) {
  // The new account's name while adding; null when not.
  const [label, setLabel] = useState<string | null>(null);
  if (label === null) {
    return (
      <View style={providerStyles.addRow}>
        <Button isPrimary={false} label="+ Add account" onPress={() => setLabel("")} />
      </View>
    );
  }
  const add = () =>
    client.request({ _tag: "AddAccount", harness, label }).then(
      (list) => {
        setLabel(null);
        onChanged(list);
        onError(null);
      },
      (reason) => onError(messageOf(reason)),
    );
  return (
    <View style={providerStyles.addRow}>
      <TextInput
        accessibilityLabel={`New ${harnessLabels[harness]} account name`}
        autoFocus
        maxLength={80}
        onChangeText={setLabel}
        onSubmitEditing={add}
        placeholder="Name of another account, such as Work"
        style={[styles.input, styles.flex, providerStyles.addInput]}
        value={label}
      />
      <Button label="Add account" onPress={add} />
      <Pressable accessibilityRole="button" onPress={() => setLabel(null)}>
        <Text style={styles.link}>Cancel</Text>
      </Pressable>
    </View>
  );
}
