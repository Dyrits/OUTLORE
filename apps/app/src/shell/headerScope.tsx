import { type ReactNode, useContext } from "react";
import { PhoneHeaderSetter } from "../foundation/shellContext";

/**
 * Lets the conversation beneath it hand the narrow window's top bar its title and actions only while it is the screen on
 * show (CHG-0773). A conversation kept mounted out of sight, under a form or another screen, must not take the bar.
 */
export function HeaderScope({ children, isActive }: { children: ReactNode; isActive: boolean }) {
  const setHeader = useContext(PhoneHeaderSetter);
  return <PhoneHeaderSetter.Provider value={isActive ? setHeader : null}>{children}</PhoneHeaderSetter.Provider>;
}
