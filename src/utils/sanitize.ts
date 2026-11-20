import { ArchivedFiscalYear } from '../types';

const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r', '\n']);

/**
 * Verifica se una stringa che inizia con '+' o '-' è in realtà un semplice numero valido
 * (es. "-120.50", "+45", "-12,30") e non una formula (es. "-1+1", "+cmd|' /C calc'!A0").
 */
function isPlainSignedNumber(str: string): boolean {
  const trimmed = str.trim();
  return /^[+-]\d+(?:[.,]\d+)?$/.test(trimmed);
}

/**
 * Sanifica un valore destinato a una cella CSV o foglio di calcolo per prevenire
 * attacchi o errori di Formula Injection (CSV Injection / DDE Injection).
 * Antepone un apostrofo `'` a qualsiasi stringa che inizi con `=`, `+`, `-`, `@`,
 * tabulazione o ritorno a capo, ad eccezione dei numeri puri con segno.
 */
export function sanitizeSpreadsheetCell(
  val: string | number | boolean | null | undefined
): string | number | boolean {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : '';
  }
  if (typeof val === 'boolean') {
    return val;
  }

  const str = String(val);
  if (str.length === 0) return '';

  const firstChar = str[0];
  const trimmedFirstChar = str.trimStart()[0];

  const triggersOnFirst = FORMULA_TRIGGER_CHARS.has(firstChar);
  const triggersOnTrimmed =
    trimmedFirstChar !== undefined && FORMULA_TRIGGER_CHARS.has(trimmedFirstChar);

  if (triggersOnFirst || triggersOnTrimmed) {
    if (isPlainSignedNumber(str)) {
      return str;
    }
    return `'${str}`;
  }

  return str;
}

/**
 * Versione di `sanitizeSpreadsheetCell` che restituisce sempre una stringa pronta per CSV.
 */
export function sanitizeSpreadsheetCellString(
  val: string | number | boolean | null | undefined
): string {
  const res = sanitizeSpreadsheetCell(val);
  return res === null || res === undefined ? '' : String(res);
}

/**
 * Sanifica un'intera matrice di righe destinata a Excel (.xlsx) o CSV.
 */
export function sanitizeSpreadsheetRows(
  rows: (string | number | boolean | null | undefined)[][]
): (string | number | boolean)[][] {
  return rows.map((row) => row.map((cell) => sanitizeSpreadsheetCell(cell)));
}

/**
 * Rimuove `\r`, `\n` e caratteri di controllo da un header email (To, Reply-To, Subject, Filename)
 * per prevenire Email Header Injection.
 */
export function sanitizeEmailHeader(val: string | null | undefined): string {
  if (!val) return '';
  return String(val)
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\x00-\x1F\x7F]+/g, '')
    .trim();
}

/**
 * Valida un indirizzo email verificando l'assenza di caratteri di ritorno a capo/spazi
 * e la presenza di un dominio valido.
 */
export function isValidEmailAddress(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = String(email);
  if (/[\r\n\x00-\x1F\x7F]/.test(raw)) return false;
  const trimmed = raw.trim();
  return /^[^\s@<>",;:\\]+@[^\s@<>",;:\\]+\.[^\s@<>",;:\\]{2,}$/.test(trimmed);
}

function encodeUtf8Base64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Pulisce e codifica il nome di un file allegato MIME secondo RFC 2047 / RFC 5987
 * se contiene caratteri non ASCII, rimuovendo sempre `\r`, `\n`, `"` e separatori di path.
 */
export function encodeMimeAttachmentFilename(rawFilename: string): {
  asciiSafeName: string;
  mimeNameParam: string;
  dispositionFilenameParam: string;
} {
  const cleaned = sanitizeEmailHeader(rawFilename)
    .replace(/["\\/]+/g, '_')
    .trim() || 'allegato.pdf';

  const hasNonAscii = /[^\x20-\x7E]/.test(cleaned);
  const asciiSafeName = cleaned
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');

  if (!hasNonAscii) {
    return {
      asciiSafeName,
      mimeNameParam: `name="${asciiSafeName}"`,
      dispositionFilenameParam: `filename="${asciiSafeName}"`,
    };
  }

  const rfc2047 = `=?UTF-8?B?${encodeUtf8Base64(cleaned)}?=`;
  const rfc5987 = encodeURIComponent(cleaned).replace(/['()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return {
    asciiSafeName,
    mimeNameParam: `name="${rfc2047}"`,
    dispositionFilenameParam: `filename="${asciiSafeName}"; filename*=UTF-8''${rfc5987}`,
  };
}

/**
 * Estrae l'ID di un Foglio Google (spreadsheetId) sia da un URL completo di Google Sheets
 * (es. https://docs.google.com/spreadsheets/d/1AbCdEf.../edit#gid=0) sia da un ID puro incollato dall'utente.
 */
export function extractGoogleSpreadsheetId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  const driveOpenMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]{15,})/);
  if (driveOpenMatch && driveOpenMatch[1]) {
    return driveOpenMatch[1];
  }

  if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * Anonimizza i dati sanitari e le note mediche dei minori (`allergies` e `notesConditions`)
 * all'interno degli snapshot soci delle annualità archiviate (`archivedYears`).
 * Se `minAgeYears` è > 0, anonimizza solo gli archivi con `currentYear - arch.year >= minAgeYears`.
 * Se `minAgeYears` è 0 o non specificato, anonimizza tutti gli archivi storici presenti.
 */
export function anonymizeArchivedHealthData(
  archivedYears: ArchivedFiscalYear[],
  minAgeYears: number = 0,
  currentYear: number = new Date().getFullYear()
): {
  updatedArchives: ArchivedFiscalYear[];
  anonymizedMembersCount: number;
  affectedArchivesCount: number;
} {
  let anonymizedMembersCount = 0;
  let affectedArchivesCount = 0;

  const updatedArchives = (archivedYears || []).map((arch) => {
    const age = currentYear - arch.year;
    if (minAgeYears > 0 && age < minAgeYears) {
      return arch;
    }

    let archiveTouched = false;
    const nextMembers = (arch.membersSnapshot || []).map((m) => {
      const hasHealthData =
        Boolean(m.allergies && m.allergies.trim()) ||
        Boolean(m.notesConditions && m.notesConditions.trim());
      if (!hasHealthData) return m;

      archiveTouched = true;
      anonymizedMembersCount++;
      return {
        ...m,
        allergies: '',
        notesConditions: '',
      };
    });

    if (archiveTouched) {
      affectedArchivesCount++;
      return {
        ...arch,
        membersSnapshot: nextMembers,
      };
    }
    return arch;
  });

  return {
    updatedArchives,
    anonymizedMembersCount,
    affectedArchivesCount,
  };
}
