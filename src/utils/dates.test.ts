import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  todayIso,
  excelSerialToIsoDate,
  parseToIsoDate,
  formatIsoToDisplay,
  compareIsoDates,
} from './dates';

describe('Date normalization and timezone safety (Phase 2.3 & 6.4)', () => {
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
    assert.equal(parseToIsoDate('15/03', 2026), '2026-03-15');
    assert.equal(parseToIsoDate('46096'), '2026-03-15');
  });

  it('parseToIsoDate rejects invalid calendar dates and never silently falls back to Jan 1', () => {
    assert.equal(parseToIsoDate('31/02/2026'), null);
    assert.equal(parseToIsoDate('99/99/2026'), null);
    assert.equal(parseToIsoDate('data-non-valida'), null);
    assert.equal(parseToIsoDate(''), null);
    assert.equal(parseToIsoDate(null), null);
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
