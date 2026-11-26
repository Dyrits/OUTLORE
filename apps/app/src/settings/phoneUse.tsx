import { Text } from "react-native";
import { styles } from "../foundation/styles";
import { phoneGroupOrder, phoneGroupTexts, phoneUseNotice } from "../phone/phoneGroupTexts";
import { usePhoneGroups } from "../phone/usePhoneGroups";
import { ToggleRow } from "../ui/toggleRow";
import { SettingsCard } from "./settingsParts";

/**
 * Let threads use this phone: one switch per group of `phone_*` tools, all off until the owner turns them on, kept on
 * the phone and changeable only here (phone-control). Only the phone app shows it; a browser or the desktop never does.
 */
export function PhoneUseCard() {
  const { groups, set } = usePhoneGroups();
  return (
    <SettingsCard icon="shield" title="Let threads use this phone">
      <Text style={styles.muted}>{phoneUseNotice}</Text>
      {phoneGroupOrder.map((group) => (
        <ToggleRow
          key={group}
          label={`${phoneGroupTexts[group].label}: ${phoneGroupTexts[group].description}`}
          onChange={(isOn) => set(group, isOn)}
          value={groups.includes(group)}
        />
      ))}
    </SettingsCard>
  );
}
