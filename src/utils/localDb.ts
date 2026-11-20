import type { AppState } from '../types';

const IDB_NAME = 'gestionale_asd_local';
const IDB_VERSION = 1;
const STORE_SNAPSHOTS = 'snapshots';

const LEGACY_SNAPSHOT_KEY_LATEST = 'gestionale_asd_db_snapshot_latest';
const LEGACY_SNAPSHOT_KEY_PREFIX = 'gestionale_asd_db_snapshot_user_';

// Real legacy keys used in production up to commit 5ca3e9f
const LEGACY_V4_KEY_PREFIX = 'apuacamp_working_snapshot_v4_';
const LEGACY_V4_KEY_LATEST = 'apuacamp_working_snapshot_v4_latest';
const LEGACY_V4_KEY_LOCAL_PRIVATE = 'apuacamp_working_snapshot_v4_local_private';
const LEGACY_V3_KEY_PREFIX = 'apuacamp_v3_';

const KNOWN_V3_SECTIONS = [
  'profile',
  'initialFund',
  'initialFundBank',
  'initialFundCash',
  'cashSummary',
  'members',
  'transactions',
  'recurringExpenses',
  'recurringPlans',
  'events',
  'bookings',
  'gadgets',
  'gadgetOrders',
  'staff',
  'staffPayments',
  'roles',
  'governanceRoles',
  'assemblies',
  'grants',
  'archivedYears',
  'receipts',
] as const;

export interface LocalSnapshotRecord {
  key: string;
  email: string;
  state: AppState;
  lastSyncedVersion: number | null;
  savedAt: string;
  lastDailyBackupDate?: string;
}

// Fallback in-memory store for Node test environment or strict private browsing without IndexedDB
const memoryStore = new Map<string, LocalSnapshotRecord>();

export function normalizeAccountKey(email?: string | null): string {
  const clean = (email || '').trim().toLowerCase();
  return clean || 'local';
}

function makeStoreKey(email?: string | null): string {
  return `snapshot:${normalizeAccountKey(email)}`;
}

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB non disponibile'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossibile aprire IndexedDB'));
  });
}

async function idbGetRecord(key: string): Promise<LocalSnapshotRecord | null> {
  if (!hasIndexedDB()) {
    return memoryStore.get(key) || null;
  }
  try {
    const db = await openLocalDb();
    return await new Promise<LocalSnapshotRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as LocalSnapshotRecord) || null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return memoryStore.get(key) || null;
  }
}

async function idbPutRecord(record: LocalSnapshotRecord): Promise<void> {
  memoryStore.set(record.key, record);
  if (!hasIndexedDB()) {
    return;
  }
  try {
    const db = await openLocalDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.put(record);
      req.onsuccess = () => {
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('Salvataggio IndexedDB non riuscito, usato fallback in memoria:', err);
  }
}

async function idbDeleteRecord(key: string): Promise<void> {
  memoryStore.delete(key);
  if (!hasIndexedDB()) {
    return;
  }
  try {
    const db = await openLocalDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.delete(key);
      req.onsuccess = () => {
        db.close();
        resolve();
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    // ignore
  }
}

function parseV3Key(storageKey: string): { userKey: string; section: string } | null {
  if (!storageKey.startsWith(LEGACY_V3_KEY_PREFIX)) return null;
  const remainder = storageKey.slice(LEGACY_V3_KEY_PREFIX.length);
  for (const section of KNOWN_V3_SECTIONS) {
    const suffix = `_${section}`;
    if (remainder.endsWith(suffix) && remainder.length > suffix.length) {
      const rawUser = remainder.slice(0, remainder.length - suffix.length).trim().toLowerCase();
      const userKey = rawUser === 'local_private' || rawUser === 'latest' ? 'local' : rawUser;
      return { userKey, section };
    }
  }
  return null;
}

/**
 * Migrazione una-tantum da localStorage a IndexedDB:
 * - Migra le chiavi reali del vecchio codice (`apuacamp_working_snapshot_v4_<email>`,
 *   `apuacamp_working_snapshot_v4_local_private`, `apuacamp_working_snapshot_v4_latest`,
 *   `apuacamp_v3_<user>_<section>`) e le eventuali chiavi intermedie (`gestionale_asd_db_snapshot_user_<email>`).
 * - `apuacamp_working_snapshot_v4_latest` viene migrata solo verso `snapshot:local` (mai verso un account email)
 *   e solo se `snapshot:local` non esiste già e non corrisponde a uno snapshot email già migrato.
 * - Rimuove tutte le chiavi legacy da localStorage dopo la copia.
 */
export async function migrateLegacyLocalStorageSnapshots(
  hydrateFn?: (raw: Partial<AppState>) => AppState,
  storageOverride?: Pick<Storage, 'length' | 'key' | 'getItem' | 'removeItem'>
): Promise<void> {
  const storage =
    storageOverride || (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!storage) return;

  try {
    const allKeys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k) allKeys.push(k);
    }

    const v4EmailKeys: Array<{ key: string; email: string }> = [];
    const intermediateEmailKeys: Array<{ key: string; email: string }> = [];
    const v3Keys: Array<{ key: string; userKey: string; section: string }> = [];
    let hasV4LocalPrivate = false;
    let hasV4Latest = false;

    for (const k of allKeys) {
      if (k === LEGACY_V4_KEY_LOCAL_PRIVATE) {
        hasV4LocalPrivate = true;
      } else if (k === LEGACY_V4_KEY_LATEST) {
        hasV4Latest = true;
      } else if (k.startsWith(LEGACY_V4_KEY_PREFIX)) {
        const email = k.slice(LEGACY_V4_KEY_PREFIX.length).trim().toLowerCase();
        if (email && email !== 'latest' && email !== 'local_private') {
          v4EmailKeys.push({ key: k, email });
        }
      } else if (k.startsWith(LEGACY_SNAPSHOT_KEY_PREFIX)) {
        const email = k.slice(LEGACY_SNAPSHOT_KEY_PREFIX.length).trim().toLowerCase();
        if (email) {
          intermediateEmailKeys.push({ key: k, email });
        }
      } else if (k.startsWith(LEGACY_V3_KEY_PREFIX)) {
        const parsedV3 = parseV3Key(k);
        if (parsedV3) {
          v3Keys.push({ key: k, ...parsedV3 });
        }
      }
    }

    const migratedRawJsons = new Set<string>();

    // 1. Migra le chiavi v4 per-email (`apuacamp_working_snapshot_v4_<email>`) e intermedie
    for (const { key, email } of [...v4EmailKeys, ...intermediateEmailKeys]) {
      const rawJson = storage.getItem(key);
      if (email && rawJson) {
        try {
          const parsed = JSON.parse(rawJson);
          if (parsed && typeof parsed === 'object') {
            migratedRawJsons.add(rawJson.trim());
            const existing = await idbGetRecord(makeStoreKey(email));
            if (!existing) {
              const state: AppState = hydrateFn ? hydrateFn(parsed) : (parsed as AppState);
              await saveLocalSnapshot(email, state, state.version || 1);
            }
          }
        } catch {
          // ignore malformed legacy entry
        }
      }
      storage.removeItem(key);
    }

    // 2. Migra `apuacamp_working_snapshot_v4_local_private` -> `snapshot:local`
    if (hasV4LocalPrivate) {
      const rawLocal = storage.getItem(LEGACY_V4_KEY_LOCAL_PRIVATE);
      if (rawLocal) {
        try {
          const parsed = JSON.parse(rawLocal);
          if (parsed && typeof parsed === 'object') {
            const existingLocal = await idbGetRecord(makeStoreKey('local'));
            if (!existingLocal) {
              const state: AppState = hydrateFn ? hydrateFn(parsed) : (parsed as AppState);
              await saveLocalSnapshot('local', state, state.version || 1);
            }
          }
        } catch {
          // ignore malformed legacy entry
        }
      }
      storage.removeItem(LEGACY_V4_KEY_LOCAL_PRIVATE);
    }

    // 3. Migra `apuacamp_working_snapshot_v4_latest` -> `snapshot:local` (MAI su un account email)
    // solo se `snapshot:local` non esiste già e il payload non era semplicemente duplicato di un account email già migrato
    if (hasV4Latest) {
      const rawLatest = storage.getItem(LEGACY_V4_KEY_LATEST);
      if (rawLatest && !migratedRawJsons.has(rawLatest.trim())) {
        try {
          const parsed = JSON.parse(rawLatest);
          if (parsed && typeof parsed === 'object') {
            const existingLocal = await idbGetRecord(makeStoreKey('local'));
            if (!existingLocal) {
              const state: AppState = hydrateFn ? hydrateFn(parsed) : (parsed as AppState);
              await saveLocalSnapshot('local', state, state.version || 1);
            }
          }
        } catch {
          // ignore malformed legacy entry
        }
      }
      storage.removeItem(LEGACY_V4_KEY_LATEST);
    }

    // Rimuovi sempre anche la chiave intermedia condivisa
    storage.removeItem(LEGACY_SNAPSHOT_KEY_LATEST);

    // 4. Migra eventuali chiavi `apuacamp_v3_<user>_<section>` se lo snapshot corrispondente non esiste ancora
    if (v3Keys.length > 0) {
      const byUser = new Map<string, Record<string, unknown>>();
      for (const { key, userKey, section } of v3Keys) {
        const rawVal = storage.getItem(key);
        if (rawVal !== null) {
          try {
            const parsedVal: unknown = JSON.parse(rawVal);
            const acc = byUser.get(userKey) || {};
            if (section === 'cashSummary' && parsedVal && typeof parsedVal === 'object') {
              const summaryObj = parsedVal as Record<string, unknown>;
              if (typeof summaryObj.initialFund === 'number') acc.initialFund = summaryObj.initialFund;
              if (typeof summaryObj.initialFundBank === 'number') acc.initialFundBank = summaryObj.initialFundBank;
              if (typeof summaryObj.initialFundCash === 'number') acc.initialFundCash = summaryObj.initialFundCash;
            } else {
              acc[section] = parsedVal;
            }
            byUser.set(userKey, acc);
          } catch {
            // ignore malformed section
          }
        }
        storage.removeItem(key);
      }

      for (const [userKey, partialState] of byUser.entries()) {
        const existing = await idbGetRecord(makeStoreKey(userKey));
        if (!existing && Object.keys(partialState).length > 0) {
          const state: AppState = hydrateFn
            ? hydrateFn(partialState as Partial<AppState>)
            : (partialState as unknown as AppState);
          await saveLocalSnapshot(userKey, state, state.version || 1);
        }
      }
    }

    // 5. Pulizia finale di qualsiasi chiave residua con prefisso `apuacamp_v3_` o `apuacamp_working_snapshot_v4_`
    for (const k of allKeys) {
      if (k.startsWith(LEGACY_V3_KEY_PREFIX) || k.startsWith(LEGACY_V4_KEY_PREFIX)) {
        storage.removeItem(k);
      }
    }
  } catch (err) {
    console.warn('Impossibile completare la migrazione legacy da localStorage:', err);
  }
}

export async function saveLocalSnapshot(
  email: string,
  state: AppState,
  lastSyncedVersion?: number | null
): Promise<void> {
  const normEmail = normalizeAccountKey(email);
  const key = makeStoreKey(normEmail);
  const existing = await idbGetRecord(key);

  const resolvedLastSynced =
    lastSyncedVersion !== undefined
      ? lastSyncedVersion
      : existing?.lastSyncedVersion ?? null;

  const record: LocalSnapshotRecord = {
    key,
    email: normEmail,
    state,
    lastSyncedVersion: resolvedLastSynced,
    savedAt: new Date().toISOString(),
    lastDailyBackupDate: existing?.lastDailyBackupDate,
  };

  await idbPutRecord(record);
}

export async function loadLocalSnapshotRecord(
  email: string
): Promise<LocalSnapshotRecord | null> {
  const key = makeStoreKey(email);
  return await idbGetRecord(key);
}

export async function loadLocalSnapshot(email: string): Promise<AppState | null> {
  const record = await loadLocalSnapshotRecord(email);
  return record ? record.state : null;
}

export async function updateLastSyncedVersion(
  email: string,
  version: number
): Promise<void> {
  const record = await loadLocalSnapshotRecord(email);
  if (!record) return;
  record.lastSyncedVersion = version;
  record.savedAt = new Date().toISOString();
  await idbPutRecord(record);
}

export async function getLastDailyBackupDate(email: string): Promise<string | null> {
  const record = await loadLocalSnapshotRecord(email);
  return record?.lastDailyBackupDate || null;
}

export async function setLastDailyBackupDate(
  email: string,
  isoDateYYYYMMDD: string
): Promise<void> {
  const record = await loadLocalSnapshotRecord(email);
  if (!record) return;
  record.lastDailyBackupDate = isoDateYYYYMMDD;
  await idbPutRecord(record);
}

export async function deleteLocalSnapshot(email: string): Promise<void> {
  const key = makeStoreKey(email);
  await idbDeleteRecord(key);
}

/**
 * Cancella i dati locali dell'account da questo computer (consigliato sui PC condivisi al logout):
 * - elimina `snapshot:<email>` e `snapshot:local` da IndexedDB
 * - rimuove eventuali chiavi legacy (`apuacamp_working_snapshot_v4_*`, `apuacamp_v3_*`) e `driveDbFileId:<email>` / `lastDailyBackup:<email>` in localStorage
 * - svuota i token OAuth in sessionStorage
 */
export async function clearLocalAccountData(email?: string | null): Promise<void> {
  const norm = normalizeAccountKey(email);
  await idbDeleteRecord(makeStoreKey(norm));
  if (norm !== 'local') {
    await idbDeleteRecord(makeStoreKey('local'));
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LEGACY_SNAPSHOT_KEY_LATEST);
      localStorage.removeItem(`${LEGACY_SNAPSHOT_KEY_PREFIX}${norm}`);
      localStorage.removeItem(LEGACY_V4_KEY_LATEST);
      localStorage.removeItem(LEGACY_V4_KEY_LOCAL_PRIVATE);
      localStorage.removeItem(`${LEGACY_V4_KEY_PREFIX}${norm}`);
      localStorage.removeItem(`driveDbFileId:${norm}`);
      localStorage.removeItem(`lastDailyBackup:${norm}`);

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith(`${LEGACY_V3_KEY_PREFIX}${norm}_`) ||
            k.startsWith(`${LEGACY_V3_KEY_PREFIX}local_private_`) ||
            k.startsWith(`${LEGACY_V3_KEY_PREFIX}latest_`))
        ) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore storage errors
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('apuacamp_google_oauth_token');
      sessionStorage.removeItem('apuacamp_google_oauth_expiry');
    }
  } catch {
    // ignore storage errors
  }
}

export async function listStoredAccounts(): Promise<string[]> {
  if (!hasIndexedDB()) {
    return Array.from(memoryStore.values()).map((r) => r.email);
  }
  try {
    const db = await openLocalDb();
    return await new Promise<string[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        const records = (req.result as LocalSnapshotRecord[]) || [];
        resolve(records.map((r) => r.email));
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return Array.from(memoryStore.values()).map((r) => r.email);
  }
}

export function clearMemoryStoreForTests(): void {
  memoryStore.clear();
}


