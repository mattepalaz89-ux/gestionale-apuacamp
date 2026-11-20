import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeSpreadsheetCell,
  sanitizeSpreadsheetCellString,
  sanitizeEmailHeader,
  isValidEmailAddress,
  encodeMimeAttachmentFilename,
  extractGoogleSpreadsheetId,
  anonymizeArchivedHealthData,
} from './sanitize';
import { ArchivedFiscalYear } from '../types';

describe('Fase 5 — Sicurezza, Sanitizzazione CSV/Excel, Email Headers e Privacy', () => {
  it('sanitizeSpreadsheetCell neutralizza formule (=, +, -, @, tab, newline) ma preserva numeri negativi/positivi', () => {
    assert.equal(sanitizeSpreadsheetCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.equal(sanitizeSpreadsheetCell('+cmd|\' /C calc\'!A0'), "'+cmd|' /C calc'!A0");
    assert.equal(sanitizeSpreadsheetCell('-2+3+cmd'), "'-2+3+cmd");
    assert.equal(sanitizeSpreadsheetCell('@IMPORTXML(...)'), "'@IMPORTXML(...)");
    assert.equal(sanitizeSpreadsheetCell('\t=1+1'), "'\t=1+1");
    assert.equal(sanitizeSpreadsheetCell('\n=1+1'), "'\n=1+1");
    assert.equal(sanitizeSpreadsheetCell('  =HYPERLINK("http://evil")'), "'  =HYPERLINK(\"http://evil\")");

    // Veri numeri con segno e numeri normali non vengono alterati
    assert.equal(sanitizeSpreadsheetCell('-125.50'), '-125.50');
    assert.equal(sanitizeSpreadsheetCell('-125,50'), '-125,50');
    assert.equal(sanitizeSpreadsheetCell('+45'), '+45');
    assert.equal(sanitizeSpreadsheetCell(-120.5), -120.5);
    assert.equal(sanitizeSpreadsheetCell(250), 250);
    assert.equal(sanitizeSpreadsheetCellString('Mario Rossi'), 'Mario Rossi');
  });

  it('sanitizeEmailHeader e isValidEmailAddress bloccano CRLF injection e codificano allegati non-ASCII', () => {
    assert.equal(
      sanitizeEmailHeader('genitore@example.com\r\nBcc: attacker@evil.com'),
      'genitore@example.com Bcc: attacker@evil.com'
    );
    assert.equal(
      isValidEmailAddress('genitore@example.com\r\nBcc: attacker@evil.com'),
      false
    );
    assert.equal(isValidEmailAddress('genitore@example.com'), true);
    assert.equal(isValidEmailAddress('invalido@'), false);

    const asciiFile = encodeMimeAttachmentFilename('Ricevuta_2027_01.pdf');
    assert.equal(asciiFile.mimeNameParam, 'name="Ricevuta_2027_01.pdf"');

    const utf8File = encodeMimeAttachmentFilename('Ricevuta_Nicolò_Più_2027.pdf\r\n');
    assert.ok(utf8File.mimeNameParam.startsWith('name="=?UTF-8?B?'));
    assert.ok(utf8File.dispositionFilenameParam.includes("filename*=UTF-8''"));
    assert.ok(!utf8File.asciiSafeName.includes('\r'));
    assert.ok(!utf8File.asciiSafeName.includes('\n'));
  });

  it('extractGoogleSpreadsheetId estrae correttamente ID da link Google Sheets completi o ID diretti', () => {
    assert.equal(
      extractGoogleSpreadsheetId(
        'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing#gid=0'
      ),
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
    );
    assert.equal(
      extractGoogleSpreadsheetId('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'),
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
    );
    assert.equal(extractGoogleSpreadsheetId('non-valido'), null);
  });

  it('anonymizeArchivedHealthData rimuove allergie e condizioni mediche dagli archivi storici', () => {
    const sampleArchives: ArchivedFiscalYear[] = [
      {
        id: 'arch-2024',
        year: 2024,
        archivedAt: '2025-01-10',
        summary: {
          initialFund: 0,
          totalIncome: 100,
          totalExpense: 0,
          netBalance: 100,
          finalTotalBalance: 100,
          finalBankBalance: 100,
          finalCashBalance: 0,
          membersCount: 1,
          eventsCount: 0,
          bookingsCount: 0,
        },
        transactions: [],
        events: [],
        bookings: [],
        gadgetOrders: [],
        membersSnapshot: [
          {
            id: 'm1',
            childName: 'Luca Bianchi',
            birthDate: '2016-05-10',
            birthPlace: 'Massa',
            group: '6-11',
            childFiscalCode: 'BNCLCU16E10F023A',
            childAddress: 'Via Roma 1',
            parentName: 'Marco Bianchi',
            parentFiscalCode: '',
            parentPhone: '3330000000',
            parentEmail: 'marco@example.com',
            membershipCardNumber: '24001',
            isPaid: true,
            expiryDate: '2024-12-31',
            insuranceType: 'Base',
            photoConsent: true,
            allergies: 'Allergia arachidi',
            notesConditions: 'Portare antistaminico',
            formSignedAndArchived: true,
          },
        ],
      },
    ];

    const res = anonymizeArchivedHealthData(sampleArchives, 1, 2027);
    assert.equal(res.anonymizedMembersCount, 1);
    assert.equal(res.affectedArchivesCount, 1);
    assert.equal(res.updatedArchives[0].membersSnapshot[0].allergies, '');
    assert.equal(res.updatedArchives[0].membersSnapshot[0].notesConditions, '');
    assert.equal(res.updatedArchives[0].membersSnapshot[0].childName, 'Luca Bianchi');
  });
});
