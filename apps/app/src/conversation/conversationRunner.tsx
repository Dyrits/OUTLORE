import { type MissionDetail, ThreadPermissionMode } from "@outlore/contracts";
import { permissionModeLabels } from "../editors/permissionModes";
import { RunnerPickers } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Menu } from "../ui/pickers";
import { ThreadBackups } from "./threadBackups";
import type { useThreadConversation } from "./useThreadConversation";

/** The conversation's current runner, presets and backups, shared by quests and Chronicler. */
export function ConversationRunner({
  client,
  thread,
  conversation,
  isChronicler = false,
  isFullPanel = false,
  isTabOpen = false,
  onOpenTab,
}: {
  client: ServiceClient;
  thread: MissionDetail["thread"];
  conversation: ReturnType<typeof useThreadConversation>;
  isChronicler?: boolean;
  isFullPanel?: boolean;
  isTabOpen?: boolean;
  onOpenTab?: (() => void) | undefined;
}) {
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  return (
    <>
      {!isFullPanel && (
        <Menu
          accessibilityLabel="Thread permissions"
          label={(mode) =>
            mode === null
              ? settings == null
                ? "Default permissions"
                : `Default permissions (${permissionModeLabels[settings.defaultPermissionMode]})`
              : permissionModeLabels[mode]
          }
          onChange={(mode) =>
            conversation.act(client.request({ _tag: "SetThreadPermissionMode", mode, threadId: thread.id }))
          }
          options={[null, ...ThreadPermissionMode.literals]}
          value={thread.permissionMode ?? null}
        />
      )}
      <RunnerPickers
        client={client}
        {...(isChronicler ? { dockRank: 1 } : {})}
        extra={<ThreadBackups client={client} key={thread.id} threadId={thread.id} />}
        harnesses={conversation.harnesses}
        isChronicler={isChronicler}
        isCompact
        isFullPanel={isFullPanel}
        isTabOpen={isTabOpen}
        onChange={(next) =>
          conversation.act(client.request({ _tag: "ChangeThreadRunner", ...next, threadId: thread.id }))
        }
        onOpenTab={onOpenTab}
        presetChoice={conversation.presetChoice}
        value={thread}
      />
    </>
  );
}
