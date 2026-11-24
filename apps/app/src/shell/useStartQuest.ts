import type { MissionId, WorkspaceId } from "@outlore/contracts";
import { useRef, useState } from "react";
import { messageOf, newRequestId, type ServiceClient } from "../foundation/client";

export function useStartQuest(client: ServiceClient, realmId: WorkspaceId | null, onOpen: (id: MissionId) => void) {
  const pending = useRef(false);
  const [isStarting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const start = async () => {
    if (pending.current) return;
    pending.current = true;
    setStarting(true);
    setFailure(null);
    try {
      const quest = await client.request({ _tag: "StartEmptyQuest", realmId, requestId: newRequestId() });
      onOpen(quest.missionId);
    } catch (reason) {
      setFailure(messageOf(reason));
    } finally {
      pending.current = false;
      setStarting(false);
    }
  };
  return { failure, isStarting, start };
}
