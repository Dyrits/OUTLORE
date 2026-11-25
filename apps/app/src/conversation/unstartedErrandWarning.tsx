import type { MissionDetail } from "@outlore/contracts";
import { useState } from "react";
import { View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { LoreScreen } from "../lore/lore";
import { StartingContextWarning } from "./startingContextWarning";

/**
 * The starting-context warning in the pane of an errand a Reply opened, shown before its first message wakes it:
 * the Reply opens the errand at once, so this is where the owner meets the warning (thread-tree, Opening a thread).
 * It reads the same preview as a new errand's form, for the errand's own model and the quest it hangs from.
 */
export function UnstartedErrandWarning({
  act,
  client,
  thread,
}: {
  /** Runs a request the owner asked for and shows its failure, as the conversation's other actions do. */
  act: (request: Promise<unknown>) => Promise<void>;
  client: ServiceClient;
  thread: MissionDetail["thread"];
}) {
  const [isTrimming, setIsTrimming] = useState(false);
  const { data: context } = useServiceQuery(
    client,
    {
      _tag: "PreviewStartingContext",
      harness: thread.harness,
      model: thread.model,
      parentThreadId: thread.parentId ?? thread.id,
      text: "",
    },
    `starting:${thread.parentId}:${thread.harness}:${thread.model}:`,
  );
  if (context === null || !context.isOverWarning) return null;
  return (
    <>
      <StartingContextWarning
        context={context}
        onChooseModel={(model) =>
          act(
            client.request({
              _tag: "ChangeThreadRunner",
              accountId: thread.accountId,
              effort: thread.effort,
              harness: thread.harness,
              model,
              threadId: thread.id,
            }),
          )
        }
        onTrim={() => setIsTrimming(true)}
      />
      {isTrimming && (
        <View style={styles.trimPanel}>
          <LoreScreen
            client={client}
            onBack={() => setIsTrimming(false)}
            threadId={thread.id}
            title={`Trim lore · ${thread.title}`}
          />
        </View>
      )}
    </>
  );
}
