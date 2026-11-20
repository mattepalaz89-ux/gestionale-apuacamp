import type { AppState } from '../types';

const IDB_NAME = 'gestionale_asd_local';
const IDB_VERSION = 1;
const STORE_SNAPSHOTS = 'snapshots';

const LEGACY_SNAPSHOT_KEY_LATEST = 'gestionale_asd_db_snapshot_latest';
const LEGACY_SNAPSHOT_KEY_PREFIX = 'gestionale_asd_db_snapshot_user_';

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

/**
 * Migrazione una-tantum da localStorage a IndexedDB:
 * - Rimuove SNAPSHOT_KEY_LATEST così non può mai contaminare un altro account Google.
 * - Sposta eventuali snapshot per-utente (`gestionale_asd_db_snapshot_user_<email>`) dentro IndexedDB
 *   e libera lo spazio di localStorage.
 */
export async function migrateLegacyLocalStorageSnapshots(
  hydrateFn?: (raw: Partial<AppState>) => AppState
): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  try {
    // 1. Elimina sempre la vecchia chiave condivisa non legata ad account
    localStorage.removeItem(LEGACY_SNAPSHOT_KEY_LATEST);

    // 2. Migra le chiavi per-utente esistenti
    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LEGACY_SNAPSHOT_KEY_PREFIX)) {
        keysToMigrate.push(k);
      }
    }

    for (const storageKey of keysToMigrate) {
      const email = storageKey.slice(LEGACY_SNAPSHOT_KEY_PREFIX.length).trim().toLowerCase();
      const rawJson = localStorage.getItem(storageKey);
      if (email && rawJson) {
        try {
          const parsed = JSON.parse(rawJson);
          if (parsed && typeof parsed === 'object') {
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
      localStorage.removeItem(storageKey);
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
 * - rimuove eventuali chiavi `driveDbFileId:<email>` / `lastDailyBackup:<email>` in localStorage
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
      localStorage.removeItem(`driveDbFileId:${norm}`);
      localStorage.removeItem(`lastDailyBackup:${norm}`);
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

