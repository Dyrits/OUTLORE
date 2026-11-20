import type { ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { Commands } from "../../src/work/commands.ts";
import { changed } from "../../src/work/followUps.ts";
import { insertThread } from "../../src/work/tree.ts";

/** Seeds the stored topology of an older quest without using today's OpenThread admission rules. */
export const seedLegacyErrand = Effect.fnUntraced(function* (parentId: ThreadId, text: string, isOpenedByAgent = true) {
  const commands = yield* Commands;
  return yield* commands.run(
    insertThread({
      backups: null,
      choice: {},
      isAside: false,
      isOpenedByAgent,
      isOwnCopyAsked: false,
      parentId,
      text,
      title: null,
    }).pipe(Effect.map((opened) => changed(opened, { threadsToWake: [opened.threadId] }))),
  );
});
