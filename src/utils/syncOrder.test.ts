import test from 'node:test';
import assert from 'node:assert/strict';
import { decideSyncAction } from './syncOrder';

test('decideSyncAction - 1. primo ingresso (local === null, remote presente) -> use-remote', () => {
  const decision = decideSyncAction(
    null,
    { version: 5, updatedAt: '2026-04-18T10:00:00.000Z' },
    null
  );
  assert.equal(decision, 'use-remote');
});

test('decideSyncAction - 2. caricamento iniziale (local presente, remote === null) -> push-local', () => {
  const decision = decideSyncAction(
    { version: 2, updatedAt: '2026-04-18T10:00:00.000Z' },
    null,
    null
  );
  assert.equal(decision, 'push-local');
});

test('decideSyncAction - 3. nulla da fare (stessa version e stesso updatedAt) -> noop', () => {
  const decision = decideSyncAction(
    { version: 7, updatedAt: '2026-04-18T10:00:00.000Z' },
    { version: 7, updatedAt: '2026-04-18T10:00:00.000Z' },
    7
  );
  assert.equal(decision, 'noop');
});

test('decideSyncAction - 4. utente ha modificato in locale senza toccare il remoto -> push-local', () => {
  const decision = decideSyncAction(
    { version: 10, updatedAt: '2026-04-18T12:00:00.000Z' },
    { version: 8, updatedAt: '2026-04-18T09:00:00.000Z' },
    8
  );
  assert.equal(decision, 'push-local');
});

test('decideSyncAction - 5. un altro PC ha aggiornato il remoto senza che il locale sia stato toccato -> use-remote', () => {
  const decision = decideSyncAction(
    { version: 8, updatedAt: '2026-04-18T09:00:00.000Z' },
    { version: 12, updatedAt: '2026-04-18T14:00:00.000Z' },
    8
  );
  assert.equal(decision, 'use-remote');
});

test('decideSyncAction - 6. entrambi modificati indipendentemente -> conflict', () => {
  // Caso A: entrambi sono andati avanti rispetto a lastSyncedVersion=8 con versioni diverse (9 e 11)
  const decisionA = decideSyncAction(
    { version: 9, updatedAt: '2026-04-18T11:00:00.000Z' },
    { version: 11, updatedAt: '2026-04-18T13:00:00.000Z' },
    8
  );
  assert.equal(decisionA, 'conflict');

  // Caso B: entrambi sono partiti da v8 e hanno fatto +1 indipendentemente (entrambi v9 ma updatedAt diverso)
  const decisionB = decideSyncAction(
    { version: 9, updatedAt: '2026-04-18T11:00:00.000Z' },
    { version: 9, updatedAt: '2026-04-18T11:05:00.000Z' },
    8
  );
  assert.equal(decisionB, 'conflict');
});

test('decideSyncAction - 7. file senza version (trattato come version = 1)', () => {
  // File remoto legacy senza version/updatedAt, locale fermo alla versione 1 sincronizzata -> use-remote
  const decisionUseRemote = decideSyncAction(
    { version: 1, updatedAt: '' },
    {},
    null
  );
  assert.equal(decisionUseRemote, 'use-remote');

  // File remoto legacy (version undefined -> 1) e locale modificato dall'utente (version 3) con base sincronizzata = 1 -> push-local
  const decisionPushLocal = decideSyncAction(
    { version: 3, updatedAt: '2026-04-18T15:00:00.000Z' },
    { updatedAt: '2026-01-10T08:00:00.000Z' },
    1
  );
  assert.equal(decisionPushLocal, 'push-local');

  // File remoto legacy (version undefined -> 1) e locale a v1 ma con due timestamp differenti -> conflict
  const decisionConflict = decideSyncAction(
    { version: 1, updatedAt: '2026-04-18T15:00:00.000Z' },
    { updatedAt: '2026-04-17T08:00:00.000Z' },
    null
  );
  assert.equal(decisionConflict, 'conflict');
});
