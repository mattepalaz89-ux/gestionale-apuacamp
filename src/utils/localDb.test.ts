import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveLocalSnapshot,
  loadLocalSnapshot,
  loadLocalSnapshotRecord,
  updateLastSyncedVersion,
  deleteLocalSnapshot,
  listStoredAccounts,
  migrateLegacyLocalStorageSnapshots,
  clearMemoryStoreForTests,
} from './localDb';
import { createDefaultAppState, hydrateAppState } from './storage';

function createFakeLocalStorage(initial: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index: number): string | null {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(k: string): string | null {
      return map.has(k) ? map.get(k)! : null;
    },
    removeItem(k: string): void {
      map.delete(k);
    },
    dumpKeys(): string[] {
      return Array.from(map.keys());
    },
  };
}

test('localDb - isolamento tra account email diversi e gestione lastSyncedVersion', async () => {
  clearMemoryStoreForTests();
  const stateA = createDefaultAppState();
  stateA.version = 4;
  stateA.profile = { ...stateA.profile, name: 'ASD Alfa' };

  const stateB = createDefaultAppState();
  stateB.version = 9;
  stateB.profile = { ...stateB.profile, name: 'ASD Beta' };

  await saveLocalSnapshot('alfa@esempio.it', stateA, 3);
  await saveLocalSnapshot('beta@esempio.it', stateB, 9);

  const loadedA = await loadLocalSnapshot('alfa@esempio.it');
  const loadedB = await loadLocalSnapshot('beta@esempio.it');
  const loadedUnknown = await loadLocalSnapshot('ignoto@esempio.it');

  assert.ok(loadedA);
  assert.equal(loadedA.profile.name, 'ASD Alfa');
  assert.equal(loadedA.version, 4);

  assert.ok(loadedB);
  assert.equal(loadedB.profile.name, 'ASD Beta');
  assert.equal(loadedB.version, 9);

  assert.equal(loadedUnknown, null);

  const recordA = await loadLocalSnapshotRecord('alfa@esempio.it');
  assert.equal(recordA?.lastSyncedVersion, 3);

  await updateLastSyncedVersion('alfa@esempio.it', 4);
  const recordAAfter = await loadLocalSnapshotRecord('alfa@esempio.it');
  assert.equal(recordAAfter?.lastSyncedVersion, 4);

  const accounts = await listStoredAccounts();
  assert.ok(accounts.includes('alfa@esempio.it'));
  assert.ok(accounts.includes('beta@esempio.it'));

  await deleteLocalSnapshot('alfa@esempio.it');
  assert.equal(await loadLocalSnapshot('alfa@esempio.it'), null);
});

test('Blocco 1.4: migrateLegacyLocalStorageSnapshots migra le chiavi reali v4 (per-email, local_private, latest) e v3 ed elimina le chiavi da localStorage', async () => {
  clearMemoryStoreForTests();

  const emailSnap = createDefaultAppState();
  emailSnap.version = 11;
  emailSnap.profile = { ...emailSnap.profile, name: 'ASD Email V4' };

  const localPrivateSnap = createDefaultAppState();
  localPrivateSnap.version = 6;
  localPrivateSnap.profile = { ...localPrivateSnap.profile, name: 'ASD Local Private V4' };

  const fakeStorage = createFakeLocalStorage({
    'apuacamp_working_snapshot_v4_presidente@apuacamp.it': JSON.stringify(emailSnap),
    'apuacamp_working_snapshot_v4_local_private': JSON.stringify(localPrivateSnap),
    'apuacamp_working_snapshot_v4_latest': JSON.stringify(emailSnap),
    'apuacamp_v3_tesoriere@apuacamp.it_profile': JSON.stringify({
      name: 'ASD Tesoriere V3',
      activeYear: 2026,
    }),
    'apuacamp_v3_tesoriere@apuacamp.it_cashSummary': JSON.stringify({
      initialFund: 500,
      initialFundBank: 400,
      initialFundCash: 100,
    }),
    'unrelated_key': 'keep-me',
  });

  await migrateLegacyLocalStorageSnapshots(hydrateAppState, fakeStorage);

  const migratedEmail = await loadLocalSnapshot('presidente@apuacamp.it');
  assert.ok(migratedEmail);
  assert.equal(migratedEmail.profile.name, 'ASD Email V4');
  assert.equal(migratedEmail.version, 11);

  const migratedLocal = await loadLocalSnapshot('local');
  assert.ok(migratedLocal);
  assert.equal(migratedLocal.profile.name, 'ASD Local Private V4');
  assert.equal(migratedLocal.version, 6);

  const migratedV3 = await loadLocalSnapshot('tesoriere@apuacamp.it');
  assert.ok(migratedV3);
  assert.equal(migratedV3.profile.name, 'ASD Tesoriere V3');
  assert.equal(migratedV3.initialFund, 500);

  // Tutte le chiavi apuacamp_working_snapshot_v4_* e apuacamp_v3_* devono essere state rimosse
  assert.deepEqual(fakeStorage.dumpKeys(), ['unrelated_key']);
});

test('Blocco 1.4: apuacamp_working_snapshot_v4_latest viene migrata su snapshot:local se è l\'unica chiave presente (utente senza login)', async () => {
  clearMemoryStoreForTests();

  const offlineSnap = createDefaultAppState();
  offlineSnap.version = 3;
  offlineSnap.profile = { ...offlineSnap.profile, name: 'ASD Offline Senza Login' };

  const fakeStorage = createFakeLocalStorage({
    'apuacamp_working_snapshot_v4_latest': JSON.stringify(offlineSnap),
  });

  await migrateLegacyLocalStorageSnapshots(hydrateAppState, fakeStorage);

  const migratedLocal = await loadLocalSnapshot('local');
  assert.ok(migratedLocal);
  assert.equal(migratedLocal.profile.name, 'ASD Offline Senza Login');
  assert.equal(migratedLocal.version, 3);
  assert.deepEqual(fakeStorage.dumpKeys(), []);
});

