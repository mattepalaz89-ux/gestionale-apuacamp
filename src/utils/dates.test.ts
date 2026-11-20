import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  todayIso,
  excelSerialToIsoDate,
  parseToIsoDate,
  parseDayMonthYear,
  parseIsoToLocalDate,
  formatIsoToDisplay,
  compareIsoDates,
} from './dates';
import { parseAnyDate } from './notifications';
import {
  tryParseTransactionDate,
  excelSerialToISODate,
  parseDayMonthYear as importerParseDayMonthYear,
} from './csvExcelImporter';

describe('Date normalization and timezone safety (Phase 2.3, 6.4 & Blocco 3.1)', () => {
  it('todayIso uses local calendar date without UTC midnight shift', () => {
    // 00:30 local time on Jan 15, 2026
    const localAfterMidnight = new Date(2026, 0, 15, 0, 30, 0);
    assert.equal(todayIso(localAfterMidnight), '2026-01-15');
  });

  it('excelSerialToIsoDate converts Excel 1900 serial numbers accurately', () => {
    // 46023 -> 2026-01-01
    assert.equal(excelSerialToIsoDate(46023), '2026-01-01');
    assert.equal(excelSerialToIsoDate(46096), '2026-03-15');
    assert.equal(excelSerialToIsoDate(-5), null);
    assert.equal(excelSerialToIsoDate(Number.NaN), null);
  });

  it('parseToIsoDate parses Italian DD/MM/YYYY, ISO YYYY-MM-DD, textual months, and Excel serials', () => {
    assert.equal(parseToIsoDate('15/03/2026'), '2026-03-15');
    assert.equal(parseToIsoDate('15-03-2026'), '2026-03-15');
    assert.equal(parseToIsoDate('15.03.26'), '2026-03-15');
    assert.equal(parseToIsoDate('2026-03-15'), '2026-03-15');
    assert.equal(parseToIsoDate('15 marzo 2026'), '2026-03-15');
    assert.equal(parseToIsoDate('3 feb 26'), '2026-02-03');
    assert.equal(parseToIsoDate('Jan 15, 2026'), '2026-01-15');
    assert.equal(parseToIsoDate('marzo 15', 2026), '2026-03-15');
    assert.equal(parseToIsoDate('15° mag 2026'), '2026-05-15');
    assert.equal(parseToIsoDate('15/03', 2026), '2026-03-15');
    assert.equal(parseToIsoDate('46096'), '2026-03-15');
  });

  it('parseToIsoDate rejects invalid calendar dates and never silently falls back to Jan 1', () => {
    assert.equal(parseToIsoDate('31/02/2026'), null);
    assert.equal(parseToIsoDate('29/02/2027'), null);
    assert.equal(parseToIsoDate('99/99/2026'), null);
    assert.equal(parseToIsoDate('data-non-valida'), null);
    assert.equal(parseToIsoDate(''), null);
    assert.equal(parseToIsoDate(null), null);
  });

  it('parseDayMonthYear, parseIsoToLocalDate, notifications.parseAnyDate, and csvExcelImporter helpers share canonical validation', () => {
    assert.deepEqual(parseDayMonthYear('14/09/2026'), { year: 2026, month: 9, day: 14 });
    assert.deepEqual(importerParseDayMonthYear('14-09-26'), { year: 2026, month: 9, day: 14 });
    assert.equal(parseDayMonthYear('31/02/2026'), null);

    const d1 = parseIsoToLocalDate('15/03/2026');
    const d2 = parseAnyDate('15 marzo 2026');
    assert.ok(d1 instanceof Date);
    assert.ok(d2 instanceof Date);
    assert.equal(d1?.getFullYear(), 2026);
    assert.equal(d1?.getMonth(), 2);
    assert.equal(d1?.getDate(), 15);
    assert.equal(d1?.getTime(), d2?.getTime());

    // Invalid calendar dates like Feb 31 must return null in notifications.parseAnyDate too
    assert.equal(parseAnyDate('31/02/2026'), null);
    assert.equal(tryParseTransactionDate('31/02/2026', 2026), null);
    assert.equal(tryParseTransactionDate('15-gen-27', 2027), '2027-01-15');
    assert.equal(excelSerialToISODate(46096), '2026-03-15');
  });

  it('formatIsoToDisplay formats ISO and Italian dates to DD/MM/YYYY', () => {
    assert.equal(formatIsoToDisplay('2026-03-15'), '15/03/2026');
    assert.equal(formatIsoToDisplay('5/4/2026'), '05/04/2026');
    assert.equal(formatIsoToDisplay(''), '');
    assert.equal(formatIsoToDisplay(null), '');
  });

  it('compareIsoDates sorts mixed ISO and DD/MM/YYYY dates chronologically', () => {
    assert.equal(compareIsoDates('02/01/2026', '2026-01-15'), -1);
    assert.equal(compareIsoDates('2026-05-10', '10/05/2026'), 0);
    assert.equal(compareIsoDates('20/12/2026', '2026-03-01'), 1);
  });
});
