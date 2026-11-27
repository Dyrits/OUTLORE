import type { ApplePermissionStatus } from "@outlore/contracts";

// Observed macOS Automation permission statuses per connector and app, kept in memory for the lifetime of the host service.
// macOS remains authoritative; a fresh service starts with no observed grants and never probes from a paired device.

/** In-memory store for observed Apple Automation permissions and their monotonic revision counter. */
export interface ApplePermissions {
  /** Drops all observed permissions for one connector (used on removal) and advances the revision. */
  readonly clear: (connectorId: string) => void;
  /** The last observed status for one app of a connector, or `NotAskedYet`. */
  readonly read: (connectorId: string, app: string) => ApplePermissionStatus;
  /** Records a completed probe report only when no revocation or removal happened while the probe ran. */
  readonly recordIfCurrent: (
    connectorId: string,
    expectedRevision: number,
    entries: ReadonlyArray<{ readonly app: string; readonly status: ApplePermissionStatus }>,
  ) => boolean;
  /** The current revision counter, read before starting an asynchronous probe. */
  readonly revision: () => number;
  /** Marks one app as refused by macOS and advances the revision so any concurrent probe does not overwrite it. */
  readonly revoke: (connectorId: string, app: string) => void;
}

/** Creates an isolated Apple Automation permission tracker owned by the connectors service. */
export const makeApplePermissions = (): ApplePermissions => {
  const byConnector = new Map<string, Map<string, ApplePermissionStatus>>();
  let currentRevision = 0;
  return {
    clear: (connectorId) => {
      currentRevision += 1;
      byConnector.delete(connectorId);
    },
    read: (connectorId, app) => byConnector.get(connectorId)?.get(app) ?? "NotAskedYet",
    recordIfCurrent: (connectorId, expectedRevision, entries) => {
      if (expectedRevision !== currentRevision) return false;
      byConnector.set(connectorId, new Map(entries.map(({ app, status }) => [app, status])));
      return true;
    },
    revision: () => currentRevision,
    revoke: (connectorId, app) => {
      currentRevision += 1;
      const statuses = byConnector.get(connectorId) ?? new Map<string, ApplePermissionStatus>();
      statuses.set(app, "NotAllowed");
      byConnector.set(connectorId, statuses);
    },
  };
};
