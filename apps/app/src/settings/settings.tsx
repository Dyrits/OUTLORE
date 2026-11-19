import { BudgetPeriod, type SettingsChange } from "@outlore/contracts";
import { type ReactNode, useRef, useState } from "react";
import { Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from "react-native";
import { BudgetEditor } from "../editors/budgets";
import { levelLabels } from "../editors/permissions";
import { useHarnesses } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { useHasSidebar, useHasTopBar } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Choice } from "../ui/pickers";
import { ToggleRow } from "../ui/toggleRow";
import { UsageScreen } from "../usage";
import { AccountBudgetsCard } from "./accountBudgetsCard";
import { BrowsableRootsCard } from "./browsableRootsCard";
import { ComputerNameCard } from "./computerNameCard";
import { ConnectorsSection } from "./connectorsSection";
import { DefaultCompanionCard } from "./defaultCompanionCard";
import { LookCard } from "./lookCard";
import { NumberField, NumberSetting } from "./numberSetting";
import { PresetsCard } from "./presetsCard";
import { PricesCard } from "./pricesCard";
import { ProvidersSection } from "./providers";
import { RemoteAccessCard } from "./remoteAccessCard";
import { SettingsCard, SettingsHeading, SettingsMenu, SettingsRule } from "./settingsParts";
import type { SettingsSectionId } from "./settingsSections";
import { UpdatesCard } from "./updatesCard";
import { WorkshopTabsProvider } from "./workshopTabs";

// Stored and wire names keep `intel` so existing data and agents still work: settings keys (`intelHalfLives`, `intelWarningPercent`).

/** One section of the page: its cards, drawn only while the menu has it chosen. */
function Section({ active, children, id }: { active: SettingsSectionId; children: ReactNode; id: SettingsSectionId }) {
  return id === active ? <View style={local.section}>{children}</View> : null;
}

/** The Workshop (Settings), where the owner chooses how Outlore runs their threads. */
export function SettingsScreen({
  active,
  client,
  onBack,
  onSection,
  onPermissions,
}: {
  active: SettingsSectionId;
  client: ServiceClient;
  onBack: () => void;
  onSection: (section: SettingsSectionId) => void;
  onPermissions: () => void;
}) {
  const hasSidebar = useHasSidebar();
  // With a top bar, the sidebar or the narrow window's menu leads away; the page keeps no Back link.
  const hasTopBar = useHasTopBar();
  const { data: settings, error } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [saveError, setSaveError] = useState<string | null>(null);
  const harnesses = useHarnesses(client);
  const scroll = useRef<ScrollViewInstance>(null);
  const save = (change: SettingsChange) => {
    if (settings === null) return;
    client.request({ _tag: "ChangeSettings", change }).then(
      () => setSaveError(null),
      (reason) => setSaveError(messageOf(reason)),
    );
  };
  const choose = (id: SettingsSectionId) => {
    onSection(id);
    scroll.current?.scrollTo({ animated: false, y: 0 });
  };
  const menu = <SettingsMenu active={active} isCompact={!hasSidebar} onChoose={choose} />;
  return (
    <View style={[local.page, hasSidebar && local.pageWide]}>
      {hasSidebar && <View style={local.menuColumn}>{menu}</View>}
      <ScrollView contentContainerStyle={local.content} ref={scroll} style={styles.flex}>
        {!hasSidebar && !hasTopBar && (
          <Pressable onPress={onBack}>
            <Text style={[styles.link, local.back]}>← Back</Text>
          </Pressable>
        )}
        <SettingsHeading />
        {!hasSidebar && menu}
        {error !== null && <Text style={local.error}>{error}</Text>}
        {saveError !== null && <Text style={local.error}>{saveError}</Text>}
        {settings && (
          <>
            <Section active={active} id="permissions">
              <SettingsCard
                icon="shield"
                onPress={onPermissions}
                summary={levelLabels[settings.approvalLevel]}
                title="Permissions"
              />
            </Section>
            <Section active={active} id="defaults">
              <LookCard />
              <SettingsCard icon="hourglass" title="Quest upkeep">
                <NumberSetting
                  label="Ask about a quest after this many days without activity"
                  minimum={1}
                  onInvalid={setSaveError}
                  onSave={(inactivityDays) => save({ inactivityDays })}
                  value={settings.inactivityDays}
                />
                <SettingsRule />
                <ToggleRow
                  label="Archive done quests automatically"
                  onChange={(shouldAutoArchive) => save({ shouldAutoArchive })}
                  value={settings.shouldAutoArchive}
                />
                <NumberSetting
                  label="Days after a quest is marked done before it is archived"
                  minimum={1}
                  onInvalid={setSaveError}
                  onSave={(autoArchiveDays) => save({ autoArchiveDays })}
                  value={settings.autoArchiveDays}
                />
                <SettingsRule />
                <ToggleRow
                  label="Open an off-topic message as a new quest without asking when no other quest fits"
                  onChange={(shouldOpenOffTopicMissions) => save({ shouldOpenOffTopicMissions })}
                  value={settings.shouldOpenOffTopicMissions}
                />
                <ToggleRow
                  label="Show replies as they're written"
                  onChange={(shouldStreamReplies) => save({ shouldStreamReplies })}
                  value={settings.shouldStreamReplies}
                />
              </SettingsCard>
              <SettingsCard icon="gem" title="Default budget for new quests">
                <BudgetEditor
                  key={`default:${JSON.stringify(settings.defaultMissionBudget)}`}
                  limits={settings.defaultMissionBudget}
                  onSave={(defaultMissionBudget) =>
                    client.request({ _tag: "ChangeSettings", change: { defaultMissionBudget } })
                  }
                  saveLabel="Save default"
                />
              </SettingsCard>
            </Section>
            <Section active={active} id="providers">
              <ComputerNameCard client={client} onRenamed={harnesses.refresh} />
              <ProvidersSection
                client={client}
                harnesses={harnesses.data}
                onChanged={harnesses.setData}
                onRefresh={harnesses.refresh}
              />
            </Section>
            <Section active={active} id="companions">
              <WorkshopTabsProvider>
                <DefaultCompanionCard client={client} harnesses={harnesses.data} onSave={save} settings={settings} />
                <PresetsCard client={client} onSave={save} settings={settings} />
              </WorkshopTabsProvider>
            </Section>
            <Section active={active} id="connectors">
              <ConnectorsSection client={client} onSave={save} settings={settings} />
            </Section>
            <Section active={active} id="remote">
              <RemoteAccessCard client={client} />
              <BrowsableRootsCard client={client} />
            </Section>
            <Section active={active} id="messaging">
              <SettingsCard icon="hourglass" title="Errands opened by agents">
                <ToggleRow
                  label="Show errands opened by agents"
                  onChange={(shouldShowAgentThreads) => save({ shouldShowAgentThreads })}
                  value={settings.shouldShowAgentThreads}
                />
              </SettingsCard>
              <SettingsCard
                icon="chat"
                title="Chatter guard · messages between quests and errands"
                trailing={
                  <NumberField
                    label="Chatter guard · messages between quests and errands"
                    minimum={2}
                    onInvalid={setSaveError}
                    onSave={(chatterThreshold) => save({ chatterThreshold })}
                    value={settings.chatterThreshold}
                  />
                }
              />
            </Section>
            <Section active={active} id="limits">
              <SettingsCard
                icon="layers"
                title="Briefing limit · tokens a quest's briefing may hold"
                trailing={
                  <NumberField
                    label="Briefing limit · tokens a quest's briefing may hold"
                    minimum={1}
                    onInvalid={setSaveError}
                    onSave={(briefingLimit) => save({ briefingLimit })}
                    value={settings.briefingLimit}
                  />
                }
              />
              <SettingsCard
                icon="scroll"
                title="Lore warning · percent of a model's context window before a quest or errand's lore icon turns red"
                trailing={
                  <NumberField
                    label="Lore warning · percent of a model's context window before a quest or errand's lore icon turns red"
                    minimum={1}
                    onInvalid={setSaveError}
                    onSave={(intelWarningPercent) => save({ intelWarningPercent: Math.min(intelWarningPercent, 100) })}
                    value={settings.intelWarningPercent}
                  />
                }
              />
              <SettingsCard icon="hourglass" title="Lore half-life · days for an unused lore to fade by half">
                {(["preference", "decision", "fact", "temporary"] as const).map((kind) => (
                  <NumberSetting
                    key={kind}
                    label={`Lore half-life · days for an unused ${kind} lore to fade by half`}
                    minimum={1}
                    onInvalid={setSaveError}
                    onSave={(days) => save({ intelHalfLives: { ...settings.intelHalfLives, [kind]: days } })}
                    value={settings.intelHalfLives[kind]}
                  />
                ))}
              </SettingsCard>
              <PricesCard client={client} onSave={save} settings={settings} />
              <AccountBudgetsCard client={client} />
              <SettingsCard icon="gem" title="Global budget, over the period">
                <Choice
                  label={(period) => period}
                  onChange={(globalBudgetPeriod) => save({ globalBudgetPeriod })}
                  options={BudgetPeriod.literals}
                  value={settings.globalBudgetPeriod}
                />
                <BudgetEditor
                  key={`global:${JSON.stringify(settings.globalBudget)}`}
                  limits={settings.globalBudget}
                  onSave={(globalBudget) => client.request({ _tag: "ChangeSettings", change: { globalBudget } })}
                  saveLabel="Save global budget"
                />
              </SettingsCard>
            </Section>
            <Section active={active} id="reserves">
              <UsageScreen client={client} isEmbedded />
            </Section>
            <Section active={active} id="updates">
              <UpdatesCard />
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const local = StyleSheet.create({
  back: { color: colors.highlight },
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 20 },
  error: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.md },
  menuColumn: { paddingLeft: 20, paddingTop: 20 },
  page: { backgroundColor: colors.page, flex: 1 },
  pageWide: { flexDirection: "row" },
  section: { gap: 14 },
});
