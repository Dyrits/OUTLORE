import { mentionTokensOf, referenceOf, type Skill, type WorkspaceEntry } from "@outlore/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { ServiceClient } from "../foundation/client";
import { emblemPaths } from "../foundation/emblems";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { useMentionables } from "../foundation/useMentionables";
import { chipsOf } from "./chipPlaces";
import { errandIconPath } from "./composerIcons";

// A chosen skill, workspace path, quest, errand, or realm drawn as a small chip with an icon, in the conversation and
// in the suggestion list.

const ICON_SIZE = 12;

/** The drawings shared by the picker, the message editor, and sent message chips. */
export const chipIcons = {
  borderlands: {
    paths: ["M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z", "M15.5 8.5l-2 5-5 2 2-5z", "M12 3v2M12 19v2M3 12h2M19 12h2"],
    viewBox: "0 0 24 24",
  },
  errand: { paths: [errandIconPath], viewBox: "0 0 20 20" },
  file: { paths: ["M3.5 1.5 H9.5 L12.5 4.5 V14.5 H3.5 Z", "M9.5 1.5 V4.5 H12.5"], viewBox: "0 0 16 16" },
  folder: { paths: ["M1.5 3.5 H6 L7.5 5 H14.5 V13 H1.5 Z"], viewBox: "0 0 16 16" },
  quest: { paths: emblemPaths.sword, viewBox: "0 0 24 24" },
  realm: {
    paths: ["M3 5h18", "M12 2v3", "M5 5v12l7 5 7-5V5", "M8 8v7l4 3 4-3V8", "M12 9l1.5 3-1.5 2-1.5-2z"],
    viewBox: "0 0 24 24",
  },
  ritual: { paths: emblemPaths.moon, viewBox: "0 0 24 24" },
  skill: { paths: ["M2.5 5.5 H6 a1.5 1.5 0 0 1 3 0 H11.5 V8 a1.5 1.5 0 0 1 0 3 V13.5 H2.5 Z"], viewBox: "0 0 16 16" },
} as const;

/** The kinds of thing a chip can stand for. */
export type ChipKind = keyof typeof chipIcons;

/** The small outline icon for a chip's kind. */
export function ChipIcon({
  kind,
  size = ICON_SIZE,
  color = colors.accentText,
}: {
  kind: ChipKind;
  size?: number;
  color?: string;
}) {
  const { paths, viewBox } = chipIcons[kind];
  return (
    <Svg
      fill="none"
      height={size}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox={viewBox}
      width={size}
    >
      {paths.map((path) => (
        <Path d={path} key={path} />
      ))}
    </Svg>
  );
}

/** What a path in a workspace is, or null when it is not there; known answers are kept while the app runs. */
const kinds = new Map<string, WorkspaceEntry["kind"] | null>();

/** Which of the `@`-paths name a file or a folder of the workspace; the others are plain text. */
function useMentionKinds(
  client: ServiceClient | undefined,
  workspacePath: string | null,
  paths: ReadonlyArray<string>,
): ReadonlyMap<string, WorkspaceEntry["kind"]> {
  const [, setVersion] = useState(0);
  const key = paths.join("\0");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key identifies the paths.
  useEffect(() => {
    if (client === undefined || workspacePath === null) return;
    let isCurrent = true;
    for (const path of new Set(paths)) {
      const known = `${workspacePath}\0${path}`;
      if (kinds.has(known)) continue;
      kinds.set(known, null);
      client.request({ _tag: "ListWorkspaceEntries", query: path, workspacePath }).then(
        (entries) => {
          kinds.set(known, entries.find((entry) => entry.path === path)?.kind ?? null);
          if (isCurrent) setVersion((version) => version + 1);
        },
        () => kinds.delete(known),
      );
    }
    return () => {
      isCurrent = false;
    };
  }, [client, workspacePath, key]);
  const found = new Map<string, WorkspaceEntry["kind"]>();
  for (const path of paths) {
    const kind = workspacePath === null ? null : kinds.get(`${workspacePath}\0${path}`);
    if (kind !== null && kind !== undefined) found.set(path, kind);
  }
  return found;
}

/** The chips of a text: skills, workspace paths as the service knows them, and quests, errands, and realms. */
function useChipsOf({
  client,
  skills,
  text,
  workspacePath,
}: {
  client: ServiceClient;
  skills: ReadonlyArray<Skill>;
  text: string;
  workspacePath: string | null;
}) {
  const tokens = mentionTokensOf(text);
  const entries = useMentionKinds(
    client,
    workspacePath,
    tokens.filter((token) => referenceOf(token.path) === null).map((token) => token.path),
  );
  const mentionables = useMentionables(
    client,
    tokens.some((token) => referenceOf(token.path) !== null),
  );
  return chipsOf(text, { entries, mentionables, skills });
}

/** A message's text with each chosen skill, workspace path, quest, errand, or realm as a chip with its icon. */
export function ChipText({
  client,
  skills,
  text,
  workspacePath,
}: {
  client: ServiceClient;
  skills: ReadonlyArray<Skill>;
  text: string;
  workspacePath: string | null;
}) {
  const chips = useChipsOf({ client, skills, text, workspacePath });
  if (chips.length === 0) return <Text style={styles.body}>{text}</Text>;
  const parts: ReactNode[] = [];
  let at = 0;
  for (const chip of chips) {
    parts.push(text.slice(at, chip.start));
    parts.push(
      <View key={chip.start} style={styles.mentionChip}>
        <ChipIcon kind={chip.kind} />
        <Text style={styles.mentionChipText}>{chip.label}</Text>
      </View>,
    );
    at = chip.end;
  }
  parts.push(text.slice(at));
  return <Text style={styles.body}>{parts}</Text>;
}
