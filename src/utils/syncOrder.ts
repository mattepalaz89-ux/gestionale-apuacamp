export type SyncDecision = 'use-remote' | 'push-local' | 'conflict' | 'noop';

export interface SyncVersionMeta {
  version?: number;
  updatedAt?: string;
}

function normalizeMeta(meta: SyncVersionMeta | null | undefined): {
  version: number;
  updatedAt: string;
} | null {
  if (!meta) return null;
  const rawVersion = typeof meta.version === 'number' && Number.isFinite(meta.version) && meta.version >= 1
    ? Math.floor(meta.version)
    : 1;
  const rawUpdatedAt = typeof meta.updatedAt === 'string' && meta.updatedAt.trim().length > 0
    ? meta.updatedAt.trim()
    : '';
  return {
    version: rawVersion,
    updatedAt: rawUpdatedAt,
  };
}

/**
 * Pure function that decides the synchronization action between a local snapshot
 * and a remote Google Drive database file using optimistic concurrency (version + updatedAt)
 * and the last known synced version (`lastSyncedVersion`).
 */
export function decideSyncAction(
  localInput: SyncVersionMeta | null | undefined,
  remoteInput: SyncVersionMeta | null | undefined,
  lastSyncedVersion: number | null | undefined
): SyncDecision {
  const local = normalizeMeta(localInput);
  const remote = normalizeMeta(remoteInput);
  const syncedVer =
    typeof lastSyncedVersion === 'number' && Number.isFinite(lastSyncedVersion) && lastSyncedVersion >= 1
      ? Math.floor(lastSyncedVersion)
      : null;

  // 1. Both absent
  if (!local && !remote) {
    return 'noop';
  }

  // 2. First login on this browser/account: no local snapshot, remote exists on Drive
  if (!local && remote) {
    return 'use-remote';
  }

  // 3. Initial bootstrap on Drive: local snapshot exists, nothing on Drive yet
  if (local && !remote) {
    return 'push-local';
  }

  // From here on, both local and remote exist
  const l = local!;
  const r = remote!;

  // 4. Same version number
  if (l.version === r.version) {
    // Only noop if both have a valid non-empty updatedAt timestamp that matches
    // (or if both have empty updatedAt AND lastSyncedVersion already equals this version)
    if (l.updatedAt && l.updatedAt === r.updatedAt) {
      return 'noop';
    }
    if (!l.updatedAt && !r.updatedAt) {
      return syncedVer === l.version ? 'noop' : 'use-remote';
    }
    // Legacy migration edge case: one side had no updatedAt yet and hasn't diverged from syncedVer
    if (!r.updatedAt && syncedVer === l.version) {
      return 'push-local';
    }
    if (!l.updatedAt && (syncedVer === r.version || syncedVer === null)) {
      return 'use-remote';
    }
    // Same version number but different non-empty timestamps -> two devices independently bumped from v(N-1) to vN!
    return 'conflict';
  }

  // 5. Local is ahead of remote
  if (l.version > r.version) {
    // Safe fast-forward push ONLY if remote is still at the exact version we last synced with
    if (syncedVer !== null && syncedVer === r.version) {
      return 'push-local';
    }
    // Otherwise remote also changed (or we have no common ancestor record) -> conflict
    return 'conflict';
  }

  // 6. Remote is ahead of local (r.version > l.version)
  if (r.version > l.version) {
    // Safe fast-forward pull ONLY if local is still at the exact version we last synced with
    if (syncedVer !== null && syncedVer === l.version) {
      return 'use-remote';
    }
    // Special case for unversioned legacy local default state (version 1, empty updatedAt) when remote has real version > 1
    if (syncedVer === null && l.version === 1 && !l.updatedAt) {
      return 'use-remote';
    }
    // Otherwise local also has unsynced edits -> conflict
    return 'conflict';
  }

  return 'conflict';
}

export type SaveActionDecision = 'write' | 'noop' | 'pull-remote' | 'conflict';

/**
 * Pure function that decides how to handle a Google Drive write or periodic poll
 * by comparing the `knownDriveVersion` (from the last load/save) against the
 * `currentDriveVersion` (currently on Google Drive metadata) and `hasLocalPending`.
 */
export function decideSaveAction(params: {
  knownDriveVersion?: string | number | null;
  currentDriveVersion?: string | number | null;
  hasLocalPending: boolean;
}): SaveActionDecision {
  const known =
    params.knownDriveVersion !== null &&
    params.knownDriveVersion !== undefined &&
    String(params.knownDriveVersion).trim() !== ''
      ? String(params.knownDriveVersion).trim()
      : null;

  const current =
    params.currentDriveVersion !== null &&
    params.currentDriveVersion !== undefined &&
    String(params.currentDriveVersion).trim() !== ''
      ? String(params.currentDriveVersion).trim()
      : null;

  // If we don't have both versions or they are identical, no remote change occurred
  if (!known || !current || known === current) {
    return params.hasLocalPending ? 'write' : 'noop';
  }

  // Remote Drive version changed since our last load/save
  if (!params.hasLocalPending) {
    return 'pull-remote';
  }

  return 'conflict';
}

