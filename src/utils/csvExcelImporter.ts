import * as XLSX from 'xlsx';
import {
  Member,
  CashTransaction,
  CashCategory,
  PaymentMethod,
  InsuranceType,
  AgeGroup,
  CardValidityType,
} from '../types';
import { parseAmount } from './finance';

const ITALIAN_MONTHS_MAP: Record<string, string> = {
  gen: '01',
  gennaio: '01',
  feb: '02',
  febbraio: '02',
  mar: '03',
  marzo: '03',
  apr: '04',
  aprile: '04',
  mag: '05',
  maggio: '05',
  giu: '06',
  giugno: '06',
  lug: '07',
  luglio: '07',
  ago: '08',
  agosto: '08',
  set: '09',
  sett: '09',
  settembre: '09',
  ott: '10',
  ottobre: '10',
  nov: '11',
  novembre: '11',
  dic: '12',
  dicembre: '12',
};

/**
 * Helper to extract { day, month, year } from "YYYY-MM-DD" or "DD/MM/YYYY"
 */
export function parseDayMonthYear(raw?: string): { day: number; month: number; year: number } | null {
  if (!raw) return null;
  const clean = String(raw).trim().replace(/\\/g, '/');

  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1], 10),
      month: parseInt(isoMatch[2], 10),
      day: parseInt(isoMatch[3], 10),
    };
  }

  const itMatch = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (itMatch) {
    let year = parseInt(itMatch[3], 10);
    if (year < 100) year += 2000;
    return {
      day: parseInt(itMatch[1], 10),
      month: parseInt(itMatch[2], 10),
      year,
    };
  }

  return null;
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

export function normalizeTransactionDate(raw: string, fallbackYear: number = 2027): string {
  if (!raw) return `${fallbackYear}-01-01`;
  const trimmed = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const slashMatch = trimmed.match(/^(\d{1,2})[\/\\-](\d{1,2})[\/\\-](\d{2,4})$/);
  if (slashMatch) {
    const d = slashMatch[1].padStart(2, '0');
    const m = slashMatch[2].padStart(2, '0');
    let y = slashMatch[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }

  const textMatch = trimmed
    .toLowerCase()
    .match(/^(\d{1,2})\s+([a-z]+)(?:[\/\s-](\d{2,4}))?/);
  if (textMatch) {
    const d = textMatch[1].padStart(2, '0');
    const mName = textMatch[2];
    const m = ITALIAN_MONTHS_MAP[mName] || ITALIAN_MONTHS_MAP[mName.slice(0, 3)] || '01';
    let y = textMatch[3] ? textMatch[3] : String(fallbackYear);
    if (y.length === 2) y = '20' + y;
    return `${y}-${m}-${d}`;
  }

  return `${fallbackYear}-01-01`;
}

export function normalizeBirthOrExpiryDate(raw: string): string {
  if (!raw) return '';
  const trimmed = String(raw).trim().replace(/\\/g, '/').replace(/-/g, '/');
  const fixedTypo = trimmed.replace(/^(\d{2}\/\d{2})7(\d{4})$/, '$1/$2');
  return fixedTypo;
}

export function normalizeInsuranceType(raw: string): InsuranceType {
  const lower = (raw || '').toLowerCase().trim();
  if (lower.includes('platinum') || lower.includes('platinu')) return 'Platinum';
  if (lower.includes('gold')) return 'Gold';
  if (lower.includes('summer')) return 'Summer';
  return 'Base';
}

export function normalizeAgeGroup(raw: string): AgeGroup {
  const clean = (raw || '').trim();
  if (clean.includes('3-6')) return '3-6';
  if (clean.includes('11-14')) return '11-14';
  return '6-11';
}

export function normalizeCashCategory(raw: string): CashCategory {
  const lower = (raw || '').toLowerCase().trim();
  if (lower.includes('summer')) return 'SummerCamp';
  if (lower.includes('evento')) return 'Evento';
  if (lower.includes('selva')) return 'Selva';
  if (lower.includes('tesser')) return 'Tessere';
  if (lower.includes('staff')) return 'Staff';
  if (lower.includes('tasse') || lower.includes('formalit')) return 'Tasse e Formalità';
  if (lower.includes('servizi')) return 'Servizi esterni';
  if (lower.includes('strumenti')) return 'Acquisto Strumenti';
  if (lower.includes('gadget')) return 'Gadget';
  if (lower.includes('marketing')) return 'Marketing';
  if (lower.includes('bandi') || lower.includes('fondi')) return 'Bandi e Fondi Pubbl';
  if (lower.includes('donazion')) return 'Donazioni enti';
  return 'Altro';
}

export function normalizePaymentMethod(raw: string): PaymentMethod {
  const lower = (raw || '').toLowerCase().trim();
  if (lower.includes('contanti')) return 'Contanti';
  if (lower.includes('pos')) return 'POS';
  if (lower.includes('bancomat')) return 'Bancomat';
  if (lower.includes('paypal')) return 'Paypal';
  if (lower.includes('online')) return 'Pagam Online';
  return 'Bonifico';
}

/**
 * Reads an uploaded File (.xlsx, .xls, .csv) and converts it to a 2D array of strings
 */
export async function readUploadedSpreadsheetRows(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', raw: false });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return rows.map((r) => r.map((cell) => String(cell ?? '').trim()));
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

  dataRows.forEach((row, idx) => {
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
      id: `m-imp-${Date.now()}-${idx}`,
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
      ? r._submittedAt.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

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
      id: `m-gform-${Date.now()}-${i}`,
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
 * Parses a 2D array of rows into CashTransaction[]
 */
export function parseTransactionsFromRows(
  rows: string[][],
  defaultYear: number = 2027
): CashTransaction[] {
  if (!rows || rows.length === 0) return [];

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const joined = rows[i].join(' ').toLowerCase();
    if (joined.includes('data') && (joined.includes('entrata') || joined.includes('uscita'))) {
      headerRowIdx = i;
      break;
    }
  }

  const dataRows = rows.slice(headerRowIdx + 1);
  const transactions: CashTransaction[] = [];

  dataRows.forEach((row, idx) => {
    const rawDate = (row[0] || '').trim();
    const rawCat = (row[1] || '').trim();
    const rawInc = (row[2] || '').trim();
    const rawExp = (row[3] || '').trim();
    const rawMethod = (row[4] || '').trim();
    const rawDesc = (row[5] || '').trim();

    const inc = parseAmount(rawInc);
    const exp = parseAmount(rawExp);

    if (inc === 0 && exp === 0) return;

    transactions.push({
      id: `tx-imp-${Date.now()}-${idx}`,
      date: normalizeTransactionDate(rawDate, defaultYear),
      category: normalizeCashCategory(rawCat),
      income: inc > 0 ? inc : null,
      expense: exp > 0 ? exp : null,
      method: normalizePaymentMethod(rawMethod),
      description: rawDesc || rawCat || 'Movimento importato',
    });
  });

  return transactions;
}

/**
 * Downloads an empty Excel (.xlsx) template ready to be filled and uploaded
 */
export function downloadEmptyExcelTemplate(type: 'soci' | 'cassa' | 'eventi' | 'gadget') {
  let headers: string[] = [];
  let sampleRow: string[] = [];
  let filename = '';
  let sheetName = '';

  if (type === 'soci') {
    sheetName = 'Modello_Soci_2027';
    filename = 'Modello_Vuoto_Soci_Apuacamp_2027.xlsx';
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
      'Num Tessera UsAcli',
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
    filename = 'Modello_Vuoto_Cassa_Apuacamp_2027.xlsx';
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
    filename = 'Modello_Vuoto_Iscritti_Evento_2027.xlsx';
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
    filename = 'Modello_Vuoto_Gadget_Apuacamp_2027.xlsx';
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
      'Maglietta Apuacamp',
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
