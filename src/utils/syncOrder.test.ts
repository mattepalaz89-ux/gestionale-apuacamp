import test from 'node:test';
import assert from 'node:assert/strict';
import { decideSyncAction, decideSaveAction } from './syncOrder';
import { bumpStateVersion, createDefaultAppState } from './storage';
import { uploadFileToDrive, saveLiveDatabaseToDrive } from '../services/googleWorkspace';

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

test('Blocco 1.1: decideSaveAction verifica knownDriveVersion vs currentDriveVersion', () => {
  // Versione Drive invariata + modifiche locali in attesa -> write
  assert.equal(
    decideSaveAction({
      knownDriveVersion: '10',
      currentDriveVersion: '10',
      hasLocalPending: true,
    }),
    'write'
  );

  // Versione Drive invariata + nessuna modifica locale -> noop
  assert.equal(
    decideSaveAction({
      knownDriveVersion: '10',
      currentDriveVersion: '10',
      hasLocalPending: false,
    }),
    'noop'
  );

  // Versione Drive cambiata da un altro dispositivo + nessuna modifica locale -> pull-remote
  assert.equal(
    decideSaveAction({
      knownDriveVersion: '10',
      currentDriveVersion: '14',
      hasLocalPending: false,
    }),
    'pull-remote'
  );

  // Versione Drive cambiata da un altro dispositivo + modifiche locali in attesa -> conflict
  assert.equal(
    decideSaveAction({
      knownDriveVersion: '10',
      currentDriveVersion: '14',
      hasLocalPending: true,
    }),
    'conflict'
  );
});

test('Blocco 1.1: saveLiveDatabaseToDrive blocca la PATCH e lancia REMOTE_CHANGED se la version remota su Drive è cambiata', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || 'GET';
    calls.push({ url, method });
    // Metadata check returns Drive version '99' while expectedDriveVersion is '42'
    return new Response(
      JSON.stringify({
        id: 'file-db-1',
        version: '99',
        modifiedTime: '2026-04-20T10:00:00.000Z',
        trashed: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  await assert.rejects(
    async () => {
      await saveLiveDatabaseToDrive('{"version":5}', 'file-db-1', {
        associationId: 'asd-test',
        expectedDriveVersion: '42',
        fetchImpl: fakeFetch,
        accessTokenOverride: 'fake-token',
      });
    },
    (err: any) => err?.message === 'REMOTE_CHANGED'
  );

  // Deve aver fatto solo la GET dei metadati, nessuna PATCH o POST
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
});

test('Blocco 1.2: uploadFileToDrive con existingFileId che riceve HTTP 500 lancia errore e NON esegue alcuna POST /files', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fakeFetch500: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || 'GET';
    calls.push({ url, method });
    return new Response(
      JSON.stringify({ error: { message: 'Internal Server Error' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  };

  await assert.rejects(
    async () => {
      await uploadFileToDrive({
        name: 'database_gestionale_asd.json',
        content: '{"test":true}',
        mimeType: 'application/json',
        existingFileId: 'existing-file-123',
        fetchImpl: fakeFetch500,
        accessTokenOverride: 'fake-token',
      });
    },
    /Internal Server Error|500/
  );

  const postCalls = calls.filter((c) => c.method === 'POST');
  assert.equal(postCalls.length, 0, 'Non deve mai creare un nuovo file (POST) su errore 500');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'PATCH');
});

test('Blocco 1.2: uploadFileToDrive con existingFileId che riceve HTTP 404 ricrea il file con POST /files', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fakeFetch404: typeof fetch = async (input, init) => {
    const url = String(input);
    const method = init?.method || 'GET';
    calls.push({ url, method });

    if (calls.length === 1 && method === 'PATCH') {
      // Prima PATCH sul file eliminato restituisce 404
      return new Response(JSON.stringify({ error: { message: 'File not found' } }), {
        status: 404,
      });
    }
    if (method === 'POST') {
      return new Response(
        JSON.stringify({ id: 'new-file-456', name: 'database_gestionale_asd.json', version: '1' }),
        { status: 200 }
      );
    }
    // Seconda PATCH per caricare il contenuto del nuovo file
    return new Response(
      JSON.stringify({
        id: 'new-file-456',
        name: 'database_gestionale_asd.json',
        mimeType: 'application/json',
        version: '2',
      }),
      { status: 200 }
    );
  };

  const uploaded = await uploadFileToDrive({
    name: 'database_gestionale_asd.json',
    content: '{"test":true}',
    mimeType: 'application/json',
    existingFileId: 'deleted-file-123',
    fetchImpl: fakeFetch404,
    accessTokenOverride: 'fake-token',
  });

  assert.equal(uploaded.id, 'new-file-456');
  assert.equal(uploaded.version, '2');
  const postCalls = calls.filter((c) => c.method === 'POST');
  assert.equal(postCalls.length, 1, 'Su 404 deve ricreare il file con una POST');
});

test('Blocco 1.6: bumpStateVersion con floorVersion garantisce sempre maxKnownVersion + 1 dopo Undo, Ripristino o Reset', () => {
  const baseState = createDefaultAppState();
  // Stato corrente arrivato a v15
  const stateV15 = { ...baseState, version: 15 };
  // L'utente fa Undo tornando a uno stato precedente che aveva version = 14
  const undoneStateV14 = { ...baseState, version: 14 };

  const bumpedAfterUndo = bumpStateVersion(
    undoneStateV14,
    'segreteria@asd.it',
    stateV15.version
  );
  assert.equal(bumpedAfterUndo.version, 16);

  // L'utente ripristina un vecchio backup con version = 3 mentre maxKnownVersion è 16
  const oldBackupV3 = { ...baseState, version: 3 };
  const bumpedAfterRestore = bumpStateVersion(
    oldBackupV3,
    'segreteria@asd.it',
    bumpedAfterUndo.version
  );
  assert.equal(bumpedAfterRestore.version, 17);
});

