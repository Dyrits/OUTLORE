import {
  type AccountId,
  type HarnessList,
  type HarnessName,
  type KeyProviderName,
  keyProviders,
} from "@outlore/contracts";
import { Redacted } from "effect";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { Button } from "../ui/button";
import {
  canSubmitNewKeyAccount,
  canSubmitReplacementKey,
  keyAccountLabelOf,
  keyProvidersOf,
  modelsPlaceholderOf,
  namedModelsOf,
} from "./providerRules";
import { providerStyles } from "./providerStyles";

/** What entering a key says: it goes to the Vault once and is never shown again. */
const keyNote = "Shown once as you type; Outlore seals it in the Vault and never shows it again.";

/** The foot of a harness's accounts: "Add API key account", which opens its provider, name, key and models in place. */
export function AddKeyAccount({
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
  const providers = keyProvidersOf(harness);
  const [provider, setProvider] = useState<KeyProviderName | null>(null);
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [models, setModels] = useState("");
  const [isBusy, setBusy] = useState(false);
  if (providers.length === 0) return null;
  if (provider === null) {
    return (
      <View style={providerStyles.addRow}>
        <Button isPrimary={false} label="+ Add API key account" onPress={() => setProvider(providers[0] ?? null)} />
      </View>
    );
  }
  const named = namedModelsOf(models);
  const close = () => {
    setProvider(null);
    setLabel("");
    setKey("");
    setModels("");
  };
  const add = () => {
    setBusy(true);
    client
      .request({
        _tag: "AddKeyAccount",
        key: Redacted.make(key),
        label: keyAccountLabelOf(provider, label),
        ...(named.length === 0 ? {} : { models: named }),
        provider,
      })
      .then(
        (list) => {
          close();
          onChanged(list);
          onError(null);
        },
        (reason) => onError(messageOf(reason)),
      )
      .finally(() => setBusy(false));
  };
  return (
    <View style={providerStyles.keyForm}>
      <View style={providerStyles.addRow}>
        {providers.map((name) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: name === provider }}
            key={name}
            onPress={() => setProvider(name)}
          >
            <View style={[providerStyles.pill, name === provider && providerStyles.pillGood]}>
              <Text style={[providerStyles.pillText, name === provider && providerStyles.pillTextGood]}>
                {keyProviders[name].label}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      <TextInput
        accessibilityLabel="Name of the API key account"
        maxLength={80}
        onChangeText={setLabel}
        placeholder={`Name of the account (${keyProviders[provider].label})`}
        style={[styles.input, providerStyles.addInput]}
        value={label}
      />
      <Text style={styles.muted}>{keyNote}</Text>
      <TextInput
        accessibilityLabel={`${keyProviders[provider].label} API key`}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!isBusy}
        onChangeText={setKey}
        placeholder="API key"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        style={[styles.input, providerStyles.addInput]}
        value={key}
      />
      <TextInput
        accessibilityLabel="Model names"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setModels}
        placeholder={modelsPlaceholderOf(provider)}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, providerStyles.addInput]}
        value={models}
      />
      <View style={providerStyles.addRow}>
        <Button
          isDisabled={!canSubmitNewKeyAccount({ isBusy, key, models, provider })}
          label="Add account"
          onPress={add}
        />
        <Pressable accessibilityRole="button" onPress={close}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** The inline field that replaces an API key account's key; the old one is gone once the new one is sealed. */
export function ReplaceKey({
  accountId,
  client,
  label,
  onChanged,
  onClose,
  onError,
}: {
  accountId: AccountId;
  client: ServiceClient;
  label: string;
  onChanged: (list: HarnessList) => void;
  onClose: () => void;
  onError: (message: string | null) => void;
}) {
  const [key, setKey] = useState("");
  const [isBusy, setBusy] = useState(false);
  const replace = () => {
    setBusy(true);
    client
      .request({ _tag: "ReplaceAccountKey", accountId, key: Redacted.make(key) })
      .then(
        (list) => {
          onClose();
          onChanged(list);
          onError(null);
        },
        (reason) => onError(messageOf(reason)),
      )
      .finally(() => setBusy(false));
  };
  return (
    <View style={providerStyles.keyForm}>
      <Text style={styles.muted}>{keyNote}</Text>
      <TextInput
        accessibilityLabel={`New API key for ${label}`}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        editable={!isBusy}
        onChangeText={setKey}
        onSubmitEditing={replace}
        placeholder="New API key"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        style={[styles.input, providerStyles.addInput]}
        value={key}
      />
      <View style={providerStyles.addRow}>
        <Button isDisabled={!canSubmitReplacementKey({ isBusy, key })} label="Replace key" onPress={replace} />
        <Pressable accessibilityRole="button" onPress={onClose}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
