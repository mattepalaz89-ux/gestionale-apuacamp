import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nextReceiptProgressive,
  formatReceiptNumber,
  findDuplicateReceiptNumber,
  detectReceiptNumberGaps,
  validateReceiptFor730,
} from './receipts';
import { IssuedReceipt } from '../types';

function makeReceipt(overrides: Partial<IssuedReceipt>): IssuedReceipt {
  return {
    id: overrides.id || 'rec-1',
    year: overrides.year ?? 2027,
    progressive: overrides.progressive ?? 1,
    number: overrides.number ?? `${overrides.progressive ?? 1}/${overrides.year ?? 2027}`,
    issueDate: overrides.issueDate || '2027-03-15',
    status: overrides.status || 'emessa',
    payerName: overrides.payerName || 'Laura Bianchi',
    payerFiscalCode: overrides.payerFiscalCode || 'BNCLRA82M45F205Z',
    participantName: overrides.participantName || 'Marco Rossi',
    participantFiscalCode: overrides.participantFiscalCode || 'RSSMRC17D12F205K',
    participantBirthDate: overrides.participantBirthDate || '2017-04-12',
    description: overrides.description || 'Quota Campus Outdoor',
    amount: overrides.amount ?? 120,
    paymentMethod: overrides.paymentMethod || 'Bonifico',
    ...overrides,
  };
}

test('nextReceiptProgressive - anno vuoto restituisce 1, considera anche le annullate, anni diversi sono indipendenti', () => {
  assert.equal(nextReceiptProgressive([], 2027), 1);
  assert.equal(nextReceiptProgressive(undefined, 2027), 1);

  const list: IssuedReceipt[] = [
    makeReceipt({ id: 'r1', year: 2026, progressive: 14, number: '14/2026' }),
    makeReceipt({ id: 'r2', year: 2027, progressive: 1, number: '1/2027', status: 'emessa' }),
    makeReceipt({
      id: 'r3',
      year: 2027,
      progressive: 2,
      number: '2/2027',
      status: 'annullata',
      cancelReason: 'Errore importo',
    }),
  ];

  // In 2027, progressive 2 is cancelled so next must be 3 (never reuses 2!)
  assert.equal(nextReceiptProgressive(list, 2027), 3);
  // In 2026, max is 14 so next is 15
  assert.equal(nextReceiptProgressive(list, 2026), 15);
  // In 2028, empty so next is 1
  assert.equal(nextReceiptProgressive(list, 2028), 1);
});

test('formatReceiptNumber & findDuplicateReceiptNumber & detectReceiptNumberGaps', () => {
  assert.equal(formatReceiptNumber(1, 2027), '1/2027');
  assert.equal(formatReceiptNumber(12, 2027, '{n3}/{anno}'), '012/2027');
  assert.equal(formatReceiptNumber(5, 2027, '{anno}/R-{n}'), '2027/R-5');

  const list: IssuedReceipt[] = [
    makeReceipt({ id: 'r1', year: 2027, progressive: 1, number: '1/2027' }),
    makeReceipt({ id: 'r2', year: 2027, progressive: 3, number: '3/2027' }),
    makeReceipt({ id: 'r3', year: 2027, progressive: 5, number: '5/2027' }),
  ];

  // Duplicate detection in same year
  const dup = findDuplicateReceiptNumber(list, 2027, ' 3/2027 ');
  assert.ok(dup);
  assert.equal(dup.id, 'r2');

  // Excluding self returns undefined
  assert.equal(findDuplicateReceiptNumber(list, 2027, '3/2027', 'r2'), undefined);
  // Different year is not a duplicate
  assert.equal(findDuplicateReceiptNumber(list, 2028, '3/2027'), undefined);

  // Gap detection finds missing 2 and 4
  assert.deepEqual(detectReceiptNumberGaps(list, 2027), [2, 4]);
});

test('validateReceiptFor730 - avvisa per Contanti, età fuori 5-18 (es. 4 anni) e CF mancante', () => {
  // 1. Valid 10-year-old with Bonifico and all CFs -> no critical warnings, only annual cap info
  const validRes = validateReceiptFor730({
    asdFiscalCode: '94012340456',
    payerName: 'Laura Bianchi',
    payerFiscalCode: 'BNCLRA82M45F205Z',
    participantName: 'Marco Rossi',
    participantFiscalCode: 'RSSMRC17D12F205K',
    participantBirthDate: '2017-03-10',
    description: 'Corso sportivo outdoor',
    amount: 120,
    issueDate: '2027-05-15',
    paymentMethod: 'Bonifico',
  });
  assert.equal(validRes.hasCriticalWarnings, false);
  assert.equal(validRes.calculatedAge, 10);
  assert.ok(validRes.warnings.some((w) => w.code === 'annual_cap_info'));
  assert.ok(validRes.consultantDisclaimer.includes('consulente'));

  // 2. Contanti -> untraceable_payment_method warning
  const cashRes = validateReceiptFor730({
    asdFiscalCode: '94012340456',
    payerName: 'Laura Bianchi',
    payerFiscalCode: 'BNCLRA82M45F205Z',
    participantName: 'Marco Rossi',
    participantFiscalCode: 'RSSMRC17D12F205K',
    participantBirthDate: '2017-03-10',
    description: 'Corso sportivo outdoor',
    amount: 120,
    issueDate: '2027-05-15',
    paymentMethod: 'Contanti',
  });
  assert.equal(cashRes.hasCriticalWarnings, true);
  assert.ok(cashRes.warnings.some((w) => w.code === 'untraceable_payment_method'));

  // 3. Age 4 -> age_out_of_range warning
  const age4Res = validateReceiptFor730({
    asdFiscalCode: '94012340456',
    payerName: 'Laura Bianchi',
    payerFiscalCode: 'BNCLRA82M45F205Z',
    participantName: 'Luca Rossi',
    participantFiscalCode: 'RSSLCA23D12F205K',
    participantBirthDate: '2023-04-10',
    description: 'Psicomotricità outdoor',
    amount: 90,
    issueDate: '2027-05-15',
    paymentMethod: 'Bonifico',
  });
  assert.equal(age4Res.calculatedAge, 4);
  assert.equal(age4Res.hasCriticalWarnings, true);
  assert.ok(age4Res.warnings.some((w) => w.code === 'age_out_of_range'));

  // 4. Missing CF -> missing_payer_cf & missing_participant_cf
  const missingCfRes = validateReceiptFor730({
    asdFiscalCode: '94012340456',
    payerName: 'Laura Bianchi',
    payerFiscalCode: 'Registrato agli atti',
    participantName: 'Marco Rossi',
    participantFiscalCode: '',
    participantBirthDate: '2017-03-10',
    description: 'Corso sportivo outdoor',
    amount: 250,
    issueDate: '2027-05-15',
    paymentMethod: 'Bonifico',
  });
  assert.equal(missingCfRes.hasCriticalWarnings, true);
  assert.ok(missingCfRes.warnings.some((w) => w.code === 'missing_payer_cf'));
  assert.ok(missingCfRes.warnings.some((w) => w.code === 'missing_participant_cf'));
  assert.ok(missingCfRes.warnings.some((w) => w.code === 'annual_cap_exceeded'));
});
