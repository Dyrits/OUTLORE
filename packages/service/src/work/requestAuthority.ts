import { type Request, type RequestSource, sourceRulesOf } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type FolderAccess, ServiceFailure } from "../core/index.ts";
import { requireReachableFolder } from "./reachedFolders.ts";

/** Admits a request's authenticated source and supplies its folder reach and answering-device label. */
export const admitRequestSource = Effect.fnUntraced(function* (source: RequestSource, request: Request) {
  if (source.isPairedDevice && sourceRulesOf(request).isHostOnly)
    return yield* new ServiceFailure({ kind: "AccessRefused", message: "Only the host itself can do this." });
  const folderAccess: FolderAccess = source.isPairedDevice ? "roots" : "anywhere";
  yield* requireReachableFolder(request, folderAccess);
  if (!source.isPairedDevice) return { deviceLabel: "host window", folderAccess };
  const sql = yield* SqlClient.SqlClient;
  const [device] = yield* sql<{
    name: string;
    kind: string;
  }>`SELECT name, kind FROM paired_devices WHERE id = ${source.deviceId ?? null}`;
  return { deviceLabel: device === undefined ? "paired device" : device.name.trim() || device.kind, folderAccess };
});
