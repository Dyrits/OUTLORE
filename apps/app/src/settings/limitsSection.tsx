import { BudgetPeriod, type Settings, type SettingsChange } from "@outlore/contracts";
import { BudgetEditor } from "../editors/budgets";
import type { ServiceClient } from "../foundation/client";
import { Choice } from "../ui/pickers";
import { AccountBudgetsCard } from "./accountBudgetsCard";
import { NumberField, NumberSetting } from "./numberSetting";
import { PricesCard } from "./pricesCard";
import { SettingsCard } from "./settingsParts";

/** The Limits section: how much a quest's briefing and lore may hold, lore fading, prices, and the budgets of accounts and the global one. */
export function LimitsSection({
  client,
  onInvalid,
  onSave,
  settings,
}: {
  client: ServiceClient;
  onInvalid: (message: string) => void;
  onSave: (change: SettingsChange) => void;
  settings: Settings;
}) {
  return (
    <>
      <SettingsCard
        icon="layers"
        title="Briefing limit · tokens a quest's briefing may hold"
        trailing={
          <NumberField
            label="Briefing limit · tokens a quest's briefing may hold"
            minimum={1}
            onInvalid={onInvalid}
            onSave={(briefingLimit) => onSave({ briefingLimit })}
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
            onInvalid={onInvalid}
            onSave={(intelWarningPercent) => onSave({ intelWarningPercent: Math.min(intelWarningPercent, 100) })}
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
            onInvalid={onInvalid}
            onSave={(days) => onSave({ intelHalfLives: { ...settings.intelHalfLives, [kind]: days } })}
            value={settings.intelHalfLives[kind]}
          />
        ))}
      </SettingsCard>
      <PricesCard client={client} onSave={onSave} settings={settings} />
      <AccountBudgetsCard client={client} />
      <SettingsCard icon="gem" title="Global budget, over the period">
        <Choice
          label={(period) => period}
          onChange={(globalBudgetPeriod) => onSave({ globalBudgetPeriod })}
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
    </>
  );
}
