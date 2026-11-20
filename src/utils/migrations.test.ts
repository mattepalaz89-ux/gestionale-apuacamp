import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateState, CURRENT_SCHEMA_VERSION } from './migrations';

test('migrateState - migra uno stato v1 (senza schemaVersion) a v2 preservando tutti i campi e normalizzando le date', () => {
  const rawV1 = {
    profile: {
      name: 'Associazione Test A.S.D.',
      legalType: 'ASD',
      fiscalCode: '90000000001',
      address: 'Via Roma 1',
      president: 'Mario Rossi',
      iban: 'IT00X000000000',
      affiliation: 'US ACLI',
      email: 'info@associazione-test.it',
      phone: '3330000000',
      activeYear: 2026,
    },
    initialFundBank: 1200,
    initialFundCash: 300,
    members: [
      {
        id: 'm-1',
        childName: 'Luca Bianchi',
        birthDate: '10/05/2016',
        birthPlace: 'Massa',
        group: '6-11',
        childFiscalCode: 'BNCLCU16E10F023Z',
        childAddress: 'Via Apuane 10',
        parentName: 'Marco Bianchi',
        parentFiscalCode: 'BNCMRC80A01F023X',
        parentPhone: '3331234567',
        parentEmail: 'marco@example.com',
        membershipCardNumber: '26ACLI010',
        isPaid: true,
        cardIssueDate: '15/01/2026',
        expiryDate: '31/12/2026',
        cardValidityType: 'solare',
        insuranceType: 'Gold',
        photoConsent: true,
        allergies: 'Nessuna',
        notesConditions: '',
        formSignedAndArchived: true,
      },
    ],
    transactions: [
      {
        id: 'tx-1',
        date: '15/03/2026',
        category: 'Tessere',
        income: 25,
        expense: null,
        method: 'Bonifico',
        description: 'Quota tessera Luca Bianchi',
      },
      {
        id: 'tx-2',
        date: 'data-illeggibile-originale',
        category: 'Altro',
        income: 10,
        expense: null,
        method: 'Contanti',
        description: 'Movimento con data anomala da non perdere',
      },
    ],
    customExtraProperty: 'valore-preservato',
  };

  const migrated = migrateState(rawV1, 2026);

  assert.equal(migrated.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.version, 1);
  assert.equal(migrated.initialFund, 1500);
  assert.equal(migrated.members.length, 1);
  assert.equal(migrated.members[0].birthDate, '2016-05-10');
  assert.equal(migrated.members[0].cardIssueDate, '2026-01-15');
  assert.equal(migrated.members[0].expiryDate, '2026-12-31');

  assert.equal(migrated.transactions.length, 2);
  assert.equal(migrated.transactions[0].date, '2026-03-15');
  // La data illeggibile NON viene trasformata in 2026-01-01, ma conservata intatta
  assert.equal(migrated.transactions[1].date, 'data-illeggibile-originale');

  assert.ok(Array.isArray(migrated.receipts));
  assert.equal(migrated.receipts.length, 0);
  assert.equal((migrated as unknown as Record<string, unknown>).customExtraProperty, 'valore-preservato');

  // Idempotenza: migrateState(migrateState(v1)) === migrateState(v1)
  const migratedTwice = migrateState(migrated, 2026);
  assert.deepEqual(migratedTwice, migrated);
});

test('migrateState - popola le tassonomie multi-associazione predefinite e imposta Member.isMinor a true se assente', () => {
  const raw = {
    profile: {
      name: 'ASD Polisportiva Alpi',
      affiliation: 'Affiliata CSEN',
      activeYear: 2027,
    },
    members: [
      {
        id: 'm-min',
        childName: 'Sofia Verdi',
        birthDate: '2018-04-12',
        group: '6-11',
      },
      {
        id: 'm-adult',
        isMinor: false,
        childName: 'Paolo Neri',
        birthDate: '1985-09-20',
        group: 'Adulti',
      },
    ],
  };

  const migrated = migrateState(raw, 2027);

  assert.equal(migrated.members[0].isMinor, true);
  assert.equal(migrated.members[1].isMinor, false);
  assert.ok(Array.isArray(migrated.profile.cardTypes));
  assert.ok((migrated.profile.cardTypes?.length || 0) >= 4);
  assert.ok(Array.isArray(migrated.profile.ageGroups));
  assert.ok((migrated.profile.ageGroups?.length || 0) >= 3);
  assert.ok(Array.isArray(migrated.profile.cashCategories));
  assert.ok((migrated.profile.cashCategories?.length || 0) >= 10);
  assert.ok(Array.isArray(migrated.profile.eventCategories));
  assert.ok(Array.isArray(migrated.profile.deadlineTemplates));
  assert.equal(migrated.profile.deadlinePreset, 'asd_generica');
});

