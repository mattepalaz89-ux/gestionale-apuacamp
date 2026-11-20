import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveLocalSnapshot,
  loadLocalSnapshot,
  loadLocalSnapshotRecord,
  updateLastSyncedVersion,
  deleteLocalSnapshot,
  listStoredAccounts,
} from './localDb';
import { createDefaultAppState } from './storage';

test('localDb - isolamento tra account email diversi e gestione lastSyncedVersion', async () => {
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
