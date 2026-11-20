import type * as XLSXTypes from 'xlsx';
import {
  Member,
  CashTransaction,
  CashCategory,
  PaymentMethod,
  InsuranceType,
  AgeGroup,
  CardValidityType,
  CardTypeConfig,
  AgeGroupConfig,
  CashCategoryConfig,
} from '../types';
import { parseAmount } from './finance';
import { newId } from './ids';
import {
  todayIso,
  parseToIsoDate,
  excelSerialToIsoDate,
  parseDayMonthYear as parseCanonicalDayMonthYear,
} from './dates';

/**
 * Helper to extract { day, month, year } from "YYYY-MM-DD" or "DD/MM/YYYY"
 * Delegates to canonical date parser in `./dates`.
 */
export function parseDayMonthYear(raw?: string): { day: number; month: number; year: number } | null {
  return parseCanonicalDayMonthYear(raw);
}

/**
 * Checks whether "Tessera 365" can be activated on the given issue date.
 * Rule: "Tessera 365" is ONLY selectable from September 1st onwards (months 9, 10, 11, 12).
 */
export function isTessera365Eligible(issueDateStr?: string): boolean {
  const parsed = parseDayMonthYear(issueDateStr);
  if (!parsed) return false;
  return parsed.month >= 9 && parsed.month <= 12;
}

/**
 * Calculates the membership card expiry date ("GG/MM/AAAA") based on the issue date and validity type:
 * - 'solare': expires on 31/12 of the issue year (e.g. 15/03/2027 -> 31/12/2027)
 * - 'tessera_365': if issued on or after September 1st, expires on the exact same day of the next year (e.g. 14/09/2026 -> 14/09/2027)
 */
export function calculateCardExpiryDate(
  issueDateStr: string,
  validityType: CardValidityType
): string {
  const parsed = parseDayMonthYear(issueDateStr);
  if (!parsed) {
    const currentYear = new Date().getFullYear();
    return `31/12/${currentYear}`;
  }

  if (validityType === 'tessera_365' && isTessera365Eligible(issueDateStr)) {
    const nextYear = parsed.year + 1;
    const dd = String(parsed.day).padStart(2, '0');
    const mm = String(parsed.month).padStart(2, '0');
    return `${dd}/${mm}/${nextYear}`;
  }

  return `31/12/${parsed.year}`;
}

/**
 * Converts an Excel serial date number (e.g. 46037) to "YYYY-MM-DD".
 * Delegates to canonical `excelSerialToIsoDate` in `./dates`.
 */
export function excelSerialToISODate(serial: number): string | null {
  return excelSerialToIsoDate(serial);
}

/**
 * Attempts to parse any Italian/International/Excel date representation into "YYYY-MM-DD".
 * Returns null if the input does not contain a valid date.
 * Delegates to canonical `parseToIsoDate` in `./dates`.
 */
export function tryParseTransactionDate(
  raw: string | number | Date | undefined | null,
  fallbackYear: number = 2027
): string | null {
  return parseToIsoDate(raw, fallbackYear);
}

export function normalizeTransactionDate(raw: string, fallbackYear: number = 2027): string {
  const iso = parseToIsoDate(raw, fallbackYear);
  if (iso) return iso;
  return (raw || '').trim();
}

export function normalizeBirthOrExpiryDate(raw: string): string {
  if (!raw) return '';
  const trimmed = String(raw).trim().replace(/\\/g, '/').replace(/-/g, '/');
  const fixedTypo = trimmed.replace(/^(\d{2}\/\d{2})7(\d{4})$/, '$1/$2');
  return fixedTypo;
}

export function normalizeInsuranceType(
  raw: string,
  customTypes?: CardTypeConfig[]
): InsuranceType {
  const lower = (raw || '').toLowerCase().trim();
  if (lower && Array.isArray(customTypes) && customTypes.length > 0) {
    const exactMatch = customTypes.find(
      (ct) => ct.id.toLowerCase() === lower || ct.label.toLowerCase() === lower
    );
    if (exactMatch) return exactMatch.id;
    const partialMatch = customTypes.find(
      (ct) =>
        lower.includes(ct.id.toLowerCase()) || lower.includes(ct.label.toLowerCase())
    );
    if (partialMatch) return partialMatch.id;
  }
  if (lower.includes('platinum') || lower.includes('platinu')) return 'Platinum';
  if (lower.includes('gold')) return 'Gold';
  if (lower.includes('summer')) return 'Summer';
  return 'Base';
}

export function normalizeAgeGroup(
  raw: string,
  customGroups?: AgeGroupConfig[]
): AgeGroup {
  const clean = (raw || '').trim();
  const lower = clean.toLowerCase();
  if (lower && Array.isArray(customGroups) && customGroups.length > 0) {
    const exactMatch = customGroups.find(
      (ag) => ag.id.toLowerCase() === lower || ag.label.toLowerCase() === lower
    );
    if (exactMatch) return exactMatch.id;
    const partialMatch = customGroups.find(
      (ag) =>
        lower.includes(ag.id.toLowerCase()) || lower.includes(ag.label.toLowerCase())
    );
    if (partialMatch) return partialMatch.id;
  }
  if (clean.includes('3-6')) return '3-6';
  if (clean.includes('11-14')) return '11-14';
  if (lower.includes('adult')) return 'Adulti';
  return '6-11';
}

export function normalizeCashCategory(
  raw: string,
  customCategories?: CashCategoryConfig[]
): CashCategory {
  const lower = (raw || '').toLowerCase().trim();
  if (lower && Array.isArray(customCategories) && customCategories.length > 0) {
    const exactMatch = customCategories.find(
      (cc) => cc.id.toLowerCase() === lower || cc.label.toLowerCase() === lower
    );
    if (exactMatch) return exactMatch.id;
  }
  if (lower.includes('summer') || lower.includes('campo estivo') || lower.includes('campi estivi'))
    return 'SummerCamp';
  if (lower.includes('evento') || lower.includes('rifugio') || lower.includes('escursion'))
    return 'Evento';
  if (lower.includes('selva')) return 'Selva';
  if (lower.includes('tesser') || lower.includes('quota associativa') || lower.includes('usacli') || lower.includes('acli'))
    return 'Tessere';
  if (lower.includes('staff') || lower.includes('compens') || lower.includes('collaborator') || lower.includes('educator'))
    return 'Staff';
  if (lower.includes('tasse') || lower.includes('formalit') || lower.includes('impost') || lower.includes('bollo') || lower.includes('commission'))
    return 'Tasse e Formalità';
  if (lower.includes('servizi') || lower.includes('assicurazion') || lower.includes('utenze') || lower.includes('affitt'))
    return 'Servizi esterni';
  if (lower.includes('strumenti') || lower.includes('attrezzatur') || lower.includes('material'))
    return 'Acquisto Strumenti';
  if (lower.includes('gadget') || lower.includes('magliett') || lower.includes('abbigliament'))
    return 'Gadget';
  if (lower.includes('marketing') || lower.includes('pubblicit') || lower.includes(' volant') || lower.includes('social'))
    return 'Marketing';
  if (lower.includes('bandi') || lower.includes('fondi') || lower.includes('contribut'))
    return 'Bandi e Fondi Pubbl';
  if (lower.includes('donazion') || lower.includes('erogazion') || lower.includes('liberal'))
    return 'Donazioni enti';
  return 'Altro';
}

export function normalizePaymentMethod(raw: string): PaymentMethod {
  const lower = (raw || '').toLowerCase().trim();
  if (lower.includes('contant') || lower.includes('cash') || lower === 'cassa') return 'Contanti';
  if (lower.includes('pos')) return 'POS';
  if (lower.includes('bancomat') || lower.includes('carta')) return 'Bancomat';
  if (lower.includes('paypal')) return 'Paypal';
  if (lower.includes('online') || lower.includes('stripe') || lower.includes('satispay'))
    return 'Pagam Online';
  return 'Bonifico';
}

/**
 * Extracts a 2D array of string cells from a SheetJS worksheet while preserving:
 * - Exact ISO dates ("YYYY-MM-DD") for Excel date cells (avoiding US MM/DD/YY formatting bugs)
 * - Exact numeric values (e.g. "1203" or "1203.5") for Excel numeric cells (avoiding ".00" or thousand separator bugs)
 */
function extractCleanRowsFromWorksheet(
  XLSX: typeof XLSXTypes,
  sheet: XLSXTypes.WorkSheet
): string[][] {
  const ref = sheet['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const maxRow = Math.min(range.e.r, range.s.r + 5000);
  const maxCol = Math.min(range.e.c, range.s.c + 40);

  const rows: string[][] = [];
  for (let r = range.s.r; r <= maxRow; r++) {
    const rowCells: string[] = [];
    let hasNonEmpty = false;
    for (let c = range.s.c; c <= maxCol; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr] as XLSXTypes.CellObject | undefined;
      if (!cell || cell.v === undefined || cell.v === null) {
        rowCells.push('');
        continue;
      }

      let valStr = '';
      if (cell.t === 'd' && cell.v instanceof Date) {
        valStr = parseToIsoDate(cell.v) || String(cell.w ?? '').trim();
      } else if (cell.t === 'n' && typeof cell.v === 'number') {
        const formattedText = String(cell.w ?? '').trim();
        // Check if this numeric cell is formatted as an Excel date
        const looksLikeFormattedDate =
          cell.v >= 30000 &&
          cell.v <= 65000 &&
          (/\d{1,4}[\/\-.\s]\d{1,2}[\/\-.\s]\d{1,4}/.test(formattedText) ||
            /\d{1,2}[\s\/\-._]+(?:gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|may|jun|jul|aug|sep|oct|dec)/i.test(
              formattedText
            ));

        if (looksLikeFormattedDate) {
          valStr = excelSerialToISODate(cell.v) || formattedText;
        } else {
          // Pure numeric value: keep exact number without US thousand commas or ".00" padding
          const rounded = Math.round(cell.v * 100) / 100;
          valStr = String(rounded);
        }
      } else {
        valStr = String(cell.w ?? cell.v ?? '').trim();
      }

      if (valStr !== '') hasNonEmpty = true;
      rowCells.push(valStr);
    }
    if (hasNonEmpty) {
      rows.push(rowCells);
    }
  }
  return rows;
}

/**
 * Reads an uploaded File (.xlsx, .xls, .csv) and converts it to a 2D array of strings.
 * Automatically picks the best worksheet if the workbook has multiple tabs (e.g. skips "Riepilogo_Bilancio" and picks "Libro_Cassa").
 */
export async function readUploadedSpreadsheetRows(file: File): Promise<string[][]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, cellNF: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) return [];

  // Choose the best sheet if there are multiple tabs
  let chosenSheetName = workbook.SheetNames[0];
  if (workbook.SheetNames.length > 1) {
    const preferredByName = workbook.SheetNames.find((name) => {
      const lower = name.toLowerCase();
      if (lower.includes('riepilogo')) return false;
      return (
        lower.includes('libro_cassa') ||
        lower.includes('libro cassa') ||
        lower.includes('flusso') ||
        lower.includes('movimenti') ||
        lower.includes('prima nota') ||
        lower.includes('cassa') ||
        lower.includes('soci') ||
        lower.includes('anagrafica')
      );
    });

    if (preferredByName) {
      chosenSheetName = preferredByName;
    } else {
      // Fallback: inspect first 15 rows of each sheet for transaction or member headers
      for (const name of workbook.SheetNames) {
        if (name.toLowerCase().includes('riepilogo')) continue;
        const candidateRows = extractCleanRowsFromWorksheet(XLSX, workbook.Sheets[name]);
        const headText = candidateRows
          .slice(0, 15)
          .map((r) => r.join(' ').toLowerCase())
          .join(' ');
        if (
          (headText.includes('data') &&
            (headText.includes('entrat') ||
              headText.includes('uscit') ||
              headText.includes('importo'))) ||
          (headText.includes('nome') && headText.includes('genitore'))
        ) {
          chosenSheetName = name;
          break;
        }
      }
    }
  }

  const sheet = workbook.Sheets[chosenSheetName];
  return extractCleanRowsFromWorksheet(XLSX, sheet);
}

/**
 * Parses a 2D array of rows into Member[]
 */
export function parseMembersFromRows(rows: string[][]): Member[] {
  if (!rows || rows.length === 0) return [];

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (
      (joined.includes('nome') || joined.includes('bimbo')) &&
      (joined.includes('genitore') || joined.includes('nascita') || joined.includes('assicurazione'))
    ) {
      headerRowIdx = i;
      break;
    }
  }

  const dataRows = rows.slice(headerRowIdx + 1);
  const members: Member[] = [];

  dataRows.forEach((row) => {
    const childName = (row[0] || '').trim();
    if (
      !childName ||
      childName.toLowerCase() === 'nome' ||
      childName.toLowerCase().includes('esempio')
    ) {
      return;
    }

    const birthDate = normalizeBirthOrExpiryDate(row[1] || '');
    const birthPlace = (row[2] || '').trim();
    const group = normalizeAgeGroup(row[3] || '6-11');
    const childFiscalCode = (row[4] || '').trim().toUpperCase();
    const childAddress = (row[5] || '').trim();
    const parentName = (row[6] || '').trim();
    const parentFiscalCode = (row[7] || '').trim().toUpperCase();
    const parentPhone = (row[8] || '').trim();
    const parentEmail = (row[9] || '').trim();
    const rawCard = (row[10] || '').trim();
    const rawPaid = (row[11] || '').toUpperCase().trim();
    const isPaid =
      rawPaid === 'TRUE' ||
      rawPaid === 'SI' ||
      rawPaid === 'SÌ' ||
      rawPaid === '1' ||
      rawPaid === 'PAGATA';
    const expiryDate = normalizeBirthOrExpiryDate(row[12] || '');
    const insuranceType = normalizeInsuranceType(row[13] || '');
    const rawPhoto = (row[14] || '').toUpperCase().trim();
    const photoConsent = rawPhoto !== 'FALSE' && rawPhoto !== 'NO' && rawPhoto !== '0';
    const allergies = (row[15] || '').trim();
    const notesConditions = (row[16] || '').trim();
    const rawSigned = (row[17] || '').toUpperCase().trim();
    const formSignedAndArchived =
      rawSigned === 'TRUE' || rawSigned === 'SI' || rawSigned === 'SÌ' || rawSigned === '1';

    const rawValidity = (row[18] || '').toLowerCase();
    const parsedExp = parseDayMonthYear(expiryDate);
    const is365 =
      rawValidity.includes('365') ||
      (parsedExp !== null && !(parsedExp.day === 31 && parsedExp.month === 12));

    const needsLevelUp =
      rawCard.toLowerCase().includes('level up') ||
      rawCard.toLowerCase().includes('lelev up') ||
      notesConditions.toLowerCase().includes('level up');

    members.push({
      id: newId('m-imp'),
      childName,
      birthDate,
      birthPlace,
      group,
      childFiscalCode,
      childAddress,
      parentName,
      parentFiscalCode,
      parentPhone,
      parentEmail,
      membershipCardNumber: rawCard,
      isPaid,
      expiryDate,
      cardValidityType: is365 ? 'tessera_365' : 'solare',
      insuranceType,
      photoConsent,
      allergies,
      notesConditions,
      formSignedAndArchived,
      needsLevelUp,
      confirmationEmailSent: isPaid && !!rawCard && !rawCard.toLowerCase().includes('attesa'),
    });
  });

  return members;
}

/**
 * Converts Google Form responses from the Anagrafica Soci Google Form directly into Member records.
 * Supports both default fields and any custom/deep-dive fields (Bisogni Speciali, Autonomie, Protocolli Medici, ecc.)
 * configured by the user on the gestionale.
 */
export function parseMembersFromGoogleFormResponses(
  responses: Record<string, string>[],
  existingMembers: Member[]
): { added: Member[]; updatedCount: number } {
  const added: Member[] = [];
  let updatedCount = 0;

  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    const responseId = r._responseId || '';
    const submittedAt = r._submittedAt
      ? parseToIsoDate(r._submittedAt) || r._submittedAt.slice(0, 10)
      : todayIso();

    const consumedKeys = new Set<string>(['_responseId', '_submittedAt']);

    // Find first matching field by keywords and mark key as consumed
    const getSingleField = (keywords: string[], excludeKeywords: string[] = []): string => {
      for (const [k, v] of Object.entries(r)) {
        if (consumedKeys.has(k)) continue;
        const lowerK = k.toLowerCase();
        if (excludeKeywords.some((ex) => lowerK.includes(ex))) continue;
        if (keywords.some((kw) => lowerK.includes(kw))) {
          consumedKeys.add(k);
          return (v || '').trim();
        }
      }
      return '';
    };

    // Collect and join multiple matching fields (e.g. multiple deep-dive allergy or special needs questions)
    const getCombinedFields = (keywords: string[]): string => {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(r)) {
        if (consumedKeys.has(k)) continue;
        const lowerK = k.toLowerCase();
        if (keywords.some((kw) => lowerK.includes(kw))) {
          consumedKeys.add(k);
          const cleanVal = (v || '').trim();
          if (
            cleanVal &&
            cleanVal.toLowerCase() !== 'no' &&
            cleanVal.toLowerCase() !== 'nessuna' &&
            cleanVal.toLowerCase() !== 'nessuno'
          ) {
            parts.push(parts.length === 0 ? cleanVal : `${k}: ${cleanVal}`);
          }
        }
      }
      return parts.join(' | ');
    };

    const childName = getSingleField([
      'nome e cognome bimbo',
      'nome bimbo',
      'partecipante',
      'minore',
    ]);
    if (!childName) continue;

    const childFiscalCode = getSingleField(
      ['codice fiscale bimbo', 'cf bimbo', 'codice fiscale minore'],
      ['genitore', 'tutore']
    ).toUpperCase();

    const alreadyExists = existingMembers.some(
      (m) =>
        (responseId && m.googleFormResponseId === responseId) ||
        (childFiscalCode && m.childFiscalCode === childFiscalCode) ||
        m.childName.trim().toLowerCase() === childName.toLowerCase()
    );

    if (alreadyExists) {
      updatedCount++;
      continue;
    }

    const birthDate = normalizeBirthOrExpiryDate(
      getSingleField(['data di nascita', 'nascita'], ['luogo', 'comune'])
    );
    const birthPlace = getSingleField(['luogo di nascita', 'comune di nascita', 'luogo']);
    const group = normalizeAgeGroup(getSingleField(['gruppo', 'fascia d', 'fascia et']));
    const childAddress = getSingleField(['residenza', 'indirizzo']);
    const parentName = getSingleField(['nome e cognome genitore', 'genitore', 'tutore']);
    const parentFiscalCode = getSingleField([
      'codice fiscale genitore',
      'cf genitore',
      'intestatario ricevute',
    ]).toUpperCase();
    const parentPhone = getSingleField(['telefono', 'cellulare', 'reperibilit']);
    const parentEmail = getSingleField(['email', 'mail']);
    const insuranceType = normalizeInsuranceType(getSingleField(['assicurazione']));
    const rawValidityChoice = getSingleField(['validit', '365', 'scadenza']).toLowerCase();
    const wants365 = rawValidityChoice.includes('365') && isTessera365Eligible(submittedAt);
    const validityType: CardValidityType = wants365 ? 'tessera_365' : 'solare';
    const expiryDate = calculateCardExpiryDate(submittedAt, validityType);
    const rawPhoto = getSingleField(['foto', 'video']).toUpperCase();
    const photoConsent = rawPhoto !== 'NO' && rawPhoto !== 'FALSE';

    const allergies = getCombinedFields([
      'allergie',
      'intolleranze',
      'farmaci',
      'patologie',
      'protocollo medico',
      'regime alimentare',
      'dieta',
    ]);

    const specialNeedsAndNotes = getCombinedFields([
      'bisogni',
      'speciali',
      'bes',
      'autonomie',
      'sonno',
      'condizioni',
      'note',
      'esigenze',
      'accoglienza',
      'emergenza',
      'delegat',
    ]);

    // Capture any remaining custom questions added by the ASD so no answer is ever lost
    const extraCustomAnswers: string[] = [];
    for (const [k, v] of Object.entries(r)) {
      if (consumedKeys.has(k)) continue;
      const cleanVal = (v || '').trim();
      if (cleanVal) {
        extraCustomAnswers.push(`${k}: ${cleanVal}`);
      }
    }

    const notesConditions = [specialNeedsAndNotes, ...extraCustomAnswers]
      .filter(Boolean)
      .join(' | ');

    added.push({
      id: newId('m-gform'),
      childName,
      birthDate,
      birthPlace,
      group,
      childFiscalCode,
      childAddress,
      parentName,
      parentFiscalCode,
      parentPhone,
      parentEmail,
      membershipCardNumber: 'Da assegnare (da Modulo Google)',
      isPaid: false,
      cardIssueDate: submittedAt,
      expiryDate,
      cardValidityType: validityType,
      insuranceType,
      photoConsent,
      allergies,
      notesConditions,
      formSignedAndArchived: true,
      confirmationEmailSent: false,
      googleFormResponseId: responseId,
      createdAt: submittedAt,
    });
  }

  return { added, updatedCount };
}


/**
 * Parses a 2D array of rows into CashTransaction[] with dynamic column detection,
 * flexible date parsing, summary-row filtering, and same-day date carry-forward.
 */
export function parseTransactionsFromRows(
  rows: string[][],
  defaultYear: number = 2027
): CashTransaction[] {
  if (!rows || rows.length === 0) return [];

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const joined = rows[i].map((c) => (c || '').toLowerCase().trim()).join(' | ');
    const hasDate = joined.includes('data') || joined.includes('giorno');
    const hasAmountCols =
      joined.includes('entrat') ||
      joined.includes('uscit') ||
      joined.includes('incass') ||
      joined.includes('spes') ||
      joined.includes('importo') ||
      joined.includes('dare') ||
      joined.includes('avere');
    if (hasDate && hasAmountCols) {
      headerRowIdx = i;
      break;
    }
  }

  // Default column indices matching standard Apuacamp template:
  // [0: Data, 1: Categoria, 2: Entrata, 3: Uscita, 4: Canale, 5: Dettagli/Causale]
  let dateCol = 0;
  let catCol = 1;
  let incCol = 2;
  let expCol = 3;
  let singleAmountCol = -1;
  let typeCol = -1;
  let methodCol = 4;
  let descCol = 5;

  if (headerRowIdx >= 0) {
    const headerCells = rows[headerRowIdx].map((c) => (c || '').toLowerCase().trim());
    let foundDate = -1;
    let foundCat = -1;
    let foundInc = -1;
    let foundExp = -1;
    let foundSingleAmt = -1;
    let foundType = -1;
    let foundMethod = -1;
    const foundDescCols: number[] = [];

    headerCells.forEach((h, idx) => {
      if (!h) return;
      // Ignore progressive balance columns ("Saldo Progressivo", "Saldo Finale")
      if (h.includes('saldo') || h.includes('progressiv') || h.includes('residuo')) {
        return;
      }
      if (foundDate === -1 && (h.includes('data') || h === 'giorno')) {
        foundDate = idx;
      } else if (
        foundInc === -1 &&
        (h.includes('entrat') || h.includes('incass') || h.includes('avere') || h.includes('accredit'))
      ) {
        foundInc = idx;
      } else if (
        foundExp === -1 &&
        (h.includes('uscit') || h.includes('spes') || h.includes('dare') || h.includes('addebit'))
      ) {
        foundExp = idx;
      } else if (foundSingleAmt === -1 && (h.includes('importo') || h.includes('ammontare') || h === 'euro' || h === '€')) {
        foundSingleAmt = idx;
      } else if (foundType === -1 && (h === 'tipo' || h.includes('tipo mov') || h.includes('segno'))) {
        foundType = idx;
      } else if (
        foundCat === -1 &&
        (h.includes('categori') || h.includes('voce') || h.includes('ambito') || h.includes('settore'))
      ) {
        foundCat = idx;
      } else if (
        foundMethod === -1 &&
        (h.includes('canal') ||
          h.includes('metod') ||
          h.includes('pagamento') ||
          h.includes('mezzo') ||
          h.includes('cassa/banca') ||
          h.includes('conto'))
      ) {
        foundMethod = idx;
      } else if (
        h.includes('dettagli') ||
        h.includes('causal') ||
        h.includes('descrizion') ||
        h.includes('note') ||
        h.includes('oggetto') ||
        h.includes('motiv') ||
        h.includes('socio') ||
        h.includes('beneficiario')
      ) {
        foundDescCols.push(idx);
      }
    });

    if (foundDate !== -1) dateCol = foundDate;
    if (foundCat !== -1) catCol = foundCat;
    if (foundInc !== -1) incCol = foundInc;
    if (foundExp !== -1) expCol = foundExp;
    if (foundInc === -1 && foundExp === -1 && foundSingleAmt !== -1) {
      singleAmountCol = foundSingleAmt;
      incCol = -1;
      expCol = -1;
    }
    if (foundType !== -1) typeCol = foundType;
    if (foundMethod !== -1) methodCol = foundMethod;
    if (foundDescCols.length > 0) descCol = foundDescCols[0];
  } else {
    headerRowIdx = 0;
  }

  const dataRows = rows.slice(headerRowIdx + 1);
  const transactions: CashTransaction[] = [];
  let lastValidDate = '';

  dataRows.forEach((row) => {
    if (!row || row.length === 0) return;

    const nonEmptyCells = row.map((c) => (c || '').trim()).filter(Boolean);
    if (nonEmptyCells.length === 0) return;

    // Skip summary / total / balance / example rows
    const rowLowerJoined = nonEmptyCells.join(' ').toLowerCase();
    if (
      rowLowerJoined.includes('cancella questa riga') ||
      rowLowerJoined.includes('esempio quota') ||
      /^(?:totale|totali|saldo\s+finale|saldo\s+iniziale|saldo\s+attuale|fondo\s+cassa|fondo\s+iniziale|riporto)\b/i.test(
        nonEmptyCells[0]
      ) ||
      /^(?:totale|totali|saldo\s+finale|saldo\s+iniziale|fondo\s+cassa|riporto)\b/i.test(
        nonEmptyCells[1] || ''
      )
    ) {
      return;
    }

    // Parse date from dateCol; if empty or not found in dateCol, check adjacent cells or carry forward lastValidDate
    const rawDateCell = (row[dateCol] || '').trim();
    let parsedDate =
      tryParseTransactionDate(rawDateCell, defaultYear) ||
      parseToIsoDate(rawDateCell, defaultYear);
    if (!parsedDate) {
      for (let c = 0; c < Math.min(3, row.length); c++) {
        if (c === incCol || c === expCol || c === singleAmountCol) continue;
        const cellCandidate = (row[c] || '').trim();
        const candidate =
          tryParseTransactionDate(cellCandidate, defaultYear) ||
          parseToIsoDate(cellCandidate, defaultYear);
        if (candidate) {
          parsedDate = candidate;
          break;
        }
      }
    }

    if (parsedDate) {
      lastValidDate = parsedDate;
    }
    const hadUnrecognizedNonEmptyDate = Boolean(rawDateCell && !parsedDate);
    const effectiveDate = parsedDate || lastValidDate || todayIso();

    // Parse amounts
    let inc = 0;
    let exp = 0;

    if (singleAmountCol !== -1) {
      const rawAmt = (row[singleAmountCol] || '').trim();
      const rawType = typeCol !== -1 ? (row[typeCol] || '').toLowerCase().trim() : '';
      const isNegative = rawAmt.startsWith('-') || rawAmt.startsWith('(');
      const amt = parseAmount(rawAmt);
      if (isNegative || rawType.includes('uscit') || rawType.includes('spes') || rawType === 'u' || rawType === '-') {
        exp = amt;
      } else {
        inc = amt;
      }
    } else {
      const rawInc = incCol >= 0 ? (row[incCol] || '').trim() : '';
      const rawExp = expCol >= 0 ? (row[expCol] || '').trim() : '';
      inc = parseAmount(rawInc);
      exp = parseAmount(rawExp);
    }

    if (inc === 0 && exp === 0) return;

    const rawCat = catCol >= 0 && catCol < row.length ? (row[catCol] || '').trim() : '';
    const rawMethod = methodCol >= 0 && methodCol < row.length ? (row[methodCol] || '').trim() : '';
    const rawDesc = descCol >= 0 && descCol < row.length ? (row[descCol] || '').trim() : '';

    // If description is empty, check any other text columns that weren't used for date/cat/method/amount
    let finalDesc = rawDesc;
    if (!finalDesc) {
      const extraTextParts: string[] = [];
      row.forEach((cellVal, cIdx) => {
        const clean = (cellVal || '').trim();
        if (!clean) return;
        if (
          cIdx === dateCol ||
          cIdx === catCol ||
          cIdx === incCol ||
          cIdx === expCol ||
          cIdx === singleAmountCol ||
          cIdx === methodCol
        ) {
          return;
        }
        // Skip pure numbers
        if (/^[+-]?[\d.,€\s]+$/.test(clean)) return;
        extraTextParts.push(clean);
      });
      finalDesc = extraTextParts.join(' - ');
    }

    const baseDescription = finalDesc || rawCat || 'Movimento importato';
    const descriptionWithDateWarning = hadUnrecognizedNonEmptyDate
      ? `${baseDescription} [Data da verificare: "${rawDateCell}"]`
      : baseDescription;

    transactions.push({
      id: newId('tx-imp'),
      date: effectiveDate,
      category: normalizeCashCategory(rawCat || finalDesc),
      income: inc > 0 ? inc : null,
      expense: exp > 0 ? exp : null,
      method: normalizePaymentMethod(rawMethod),
      description: descriptionWithDateWarning,
    });
  });

  return transactions;
}

/**
 * Downloads an empty Excel (.xlsx) template ready to be filled and uploaded
 */
export async function downloadEmptyExcelTemplate(
  type: 'soci' | 'cassa' | 'eventi' | 'gadget',
  associationName?: string
): Promise<void> {
  const XLSX = await import('xlsx');
  const safeSlug =
    (associationName || 'ASD')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'ASD';
  let headers: string[] = [];
  let sampleRow: string[] = [];
  let filename = '';
  let sheetName = '';

  if (type === 'soci') {
    sheetName = 'Modello_Soci_2027';
    filename = `Modello_Vuoto_Soci_${safeSlug}_2027.xlsx`;
    headers = [
      'Nome Bimbo/a',
      'Data Nascita (GG/MM/AAAA)',
      'Luogo Nascita',
      'Gruppo (3-6 / 6-11 / 11-14)',
      'Codice Fiscale Bimbo/a',
      'Residenza',
      'Nome Genitore',
      'Codice Fiscale Genitore',
      'Telefono Genitore',
      'Email Genitore',
      'Num Tessera Ente',
      'Pagata (SI/NO)',
      'Scadenza Tessera (GG/MM/AAAA)',
      'Tipo Assicurazione (Base/Summer/Gold/Platinum)',
      'Autorizzazione Foto (SI/NO)',
      'Allergie / Intolleranze',
      'Altre Condizioni / Note Educative',
      'Modulo Firmato Archiviato (SI/NO)',
      'Tipo Validità (Solare / Tessera 365)',
    ];
    sampleRow = [
      'Mario Rossi (Esempio - cancella riga)',
      '15/05/2017',
      'Massa',
      '6-11',
      'RSSMRA17E15F023A',
      'Via Roma 10, 54100 Massa',
      'Laura Bianchi',
      'BNCLRA82A41F023B',
      '3331234567',
      'laura.bianchi@example.com',
      '27PC00001',
      'SI',
      '31/12/2027',
      'Gold',
      'SI',
      'Nessuna',
      'Nessuna nota particolare',
      'SI',
      'Solare',
    ];
  } else if (type === 'cassa') {
    sheetName = 'Modello_Cassa_2027';
    filename = `Modello_Vuoto_Cassa_${safeSlug}_2027.xlsx`;
    headers = [
      'Data (AAAA-MM-GG o GG/MM/AAAA)',
      'Categoria (Evento / SummerCamp / Selva / Tessere / Staff / Tasse e Formalità / Servizi esterni / Acquisto Strumenti / Gadget / Marketing / Bandi e Fondi Pubbl / Donazioni enti)',
      'Entrata (€)',
      'Uscita (€)',
      'Canale (Bonifico / Contanti / POS / Bancomat / Paypal)',
      'Dettagli / Causale',
    ];
    sampleRow = [
      '2027-01-15',
      'Tessere',
      '20,00',
      '',
      'Bonifico',
      'Esempio quota tessera Gold (cancella questa riga)',
    ];
  } else if (type === 'eventi') {
    sheetName = 'Modello_Iscritti_Evento';
    filename = `Modello_Vuoto_Iscritti_Evento_${safeSlug}_2027.xlsx`;
    headers = [
      'Nome Bimbo/a',
      'Genitore / Tutore',
      'Email Genitore',
      'Telefono Genitore',
      'Confermato (SI/NO)',
      'Caparra (€)',
      'Caparra Pagata (SI/NO)',
      'Saldo (€)',
      'Saldo Pagato (SI/NO)',
      'Canale Pagamento',
      'Note / Allergie / Richieste',
    ];
    sampleRow = [
      'Mario Rossi (Esempio)',
      'Laura Bianchi',
      'laura@example.com',
      '3331234567',
      'SI',
      '70,00',
      'SI',
      '60,00',
      'NO',
      'Bonifico',
      'Vegetariano',
    ];
  } else {
    sheetName = 'Modello_Prenotazioni_Gadget';
    filename = `Modello_Vuoto_Gadget_${safeSlug}_2027.xlsx`;
    headers = [
      'Data',
      'Nome Bimbo/a',
      'Nome Genitore',
      'Email Genitore',
      'Telefono Genitore',
      'Articolo Gadget',
      'Taglia / Variante',
      'Quantità',
      'Prezzo Unitario (€)',
      'Pagato (SI/NO)',
      'Consegnato (SI/NO)',
      'Canale Pagamento',
      'Note',
    ];
    sampleRow = [
      '2027-02-01',
      'Mario Rossi (Esempio)',
      'Laura Bianchi',
      'laura@example.com',
      '3331234567',
      'Maglietta Associativa',
      'Taglia 9-11 anni',
      '1',
      '15,00',
      'SI',
      'NO',
      'Bonifico',
      '',
    ];
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
