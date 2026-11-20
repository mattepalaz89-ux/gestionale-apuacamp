const ITALIAN_MONTHS_MAP: Record<string, number> = {
  gen: 1,
  gennaio: 1,
  jan: 1,
  feb: 2,
  febbraio: 2,
  mar: 3,
  marzo: 3,
  apr: 4,
  aprile: 4,
  mag: 5,
  maggio: 5,
  may: 5,
  giu: 6,
  giugno: 6,
  jun: 6,
  lug: 7,
  luglio: 7,
  jul: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  set: 9,
  sett: 9,
  settembre: 9,
  sep: 9,
  ott: 10,
  ottobre: 10,
  oct: 10,
  nov: 11,
  novembre: 11,
  dic: 12,
  dicembre: 12,
  dec: 12,
};

function isValidCalendarYMD(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

function formatYMDToIso(year: number, month: number, day: number): string | null {
  if (!isValidCalendarYMD(year, month, day)) return null;
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function expandTwoDigitYear(yy: number): number {
  if (yy >= 100) return yy;
  return yy < 70 ? 2000 + yy : 1900 + yy;
}

/**
 * Returns the local calendar date in `'YYYY-MM-DD'` format without UTC shift.
 * Ensures actions performed between 00:00 and 02:00 Italian time have the right local date.
 */
export function todayIso(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Converts an Excel serial day number (1900 date system, accounting for Excel's 1900 leap-year bug)
 * to an ISO `'YYYY-MM-DD'` string.
 */
export function excelSerialToIsoDate(serial: number): string | null {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const days = Math.floor(serial);
  // Reasonable serial bounds: ~1954 (20000) to ~2095 (71500)
  if (days < 20000 || days > 80000) return null;
  // Excel epoch is Dec 30, 1899 UTC because Excel erroneously treats 1900 as a leap year
  const utcMs = Date.UTC(1899, 11, 30) + days * 86_400_000;
  const d = new Date(utcMs);
  return formatYMDToIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Parses a date from any common Italian/European/ISO/Excel format into `'YYYY-MM-DD'`.
 * Returns `null` if the input is empty or cannot be recognized as a valid calendar date.
 * NEVER falls back silently to January 1st.
 */
export function parseToIsoDate(
  input: unknown,
  fallbackYear?: number
): string | null {
  if (input === null || input === undefined) return null;

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return formatYMDToIso(
      input.getFullYear(),
      input.getMonth() + 1,
      input.getDate()
    );
  }

  if (typeof input === 'number') {
    return excelSerialToIsoDate(input);
  }

  if (typeof input !== 'string') return null;

  // Strip time portion or day-of-week prefixes like "lun 15/03/2026"
  let s = input
    .trim()
    .replace(
      /^(lun|mar|mer|gio|ven|sab|dom|luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)[.,\s]+/i,
      ''
    )
    .trim();

  if (!s) return null;

  // 1. Pure Excel serial number in string form (e.g. "46096" or "46096.0")
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = parseFloat(s);
    const iso = excelSerialToIsoDate(serial);
    if (iso) return iso;
  }

  // 2. ISO YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (with optional time suffix)
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return formatYMDToIso(year, month, day);
  }

  // 3. Numeric DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY (or SheetJS US MM/DD/YY when unambiguous)
  const dmyMatch = s.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/
  );
  if (dmyMatch) {
    const first = Number(dmyMatch[1]);
    const second = Number(dmyMatch[2]);
    const rawYear = Number(dmyMatch[3]);
    const year = dmyMatch[3].length === 2 ? expandTwoDigitYear(rawYear) : rawYear;

    // Italian DD/MM/YYYY takes priority whenever valid (second <= 12)
    if (second >= 1 && second <= 12 && first >= 1 && first <= 31) {
      return formatYMDToIso(year, second, first);
    }
    // Unambiguous US MM/DD/YYYY (e.g. "03/25/2026" or "03/25/26" from SheetJS raw formatting)
    if (first >= 1 && first <= 12 && second > 12 && second <= 31) {
      return formatYMDToIso(year, first, second);
    }
    return null;
  }

  // 4. Short numeric DD/MM or DD-MM without year (only if fallbackYear is provided)
  if (fallbackYear && Number.isInteger(fallbackYear)) {
    const shortMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})$/);
    if (shortMatch) {
      const first = Number(shortMatch[1]);
      const second = Number(shortMatch[2]);
      if (second >= 1 && second <= 12 && first >= 1 && first <= 31) {
        return formatYMDToIso(fallbackYear, second, first);
      }
      return null;
    }
  }

  // 5. Textual Italian/English month name: e.g. "15 gen 2026", "15-gen-26", "3 febbraio 2026", "15/mar/2026", "15 mar"
  const textMonthMatch = s.match(
    /^(\d{1,2})[\s\-/.°ª]+([a-zA-Zàèéìòù]+)(?:[\s\-/.,]+(\d{2}|\d{4}))?$/
  );
  if (textMonthMatch) {
    const day = Number(textMonthMatch[1]);
    const monthKey = textMonthMatch[2].toLowerCase();
    const month = ITALIAN_MONTHS_MAP[monthKey];
    if (!month) return null;

    let year: number | undefined;
    if (textMonthMatch[3]) {
      const rawYear = Number(textMonthMatch[3]);
      year = textMonthMatch[3].length === 2 ? expandTwoDigitYear(rawYear) : rawYear;
    } else if (fallbackYear && Number.isInteger(fallbackYear)) {
      year = fallbackYear;
    }

    if (!year) return null;
    return formatYMDToIso(year, month, day);
  }

  return null;
}

/**
 * Formats an ISO date (`'YYYY-MM-DD'`) or any valid date string into Italian display format `'DD/MM/YYYY'`.
 * If empty, returns `''`. If unparseable, returns the trimmed string as-is.
 */
export function formatIsoToDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (!trimmed) return '';
  const iso = parseToIsoDate(trimmed);
  if (!iso) return trimmed;
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Chronologically compares two date strings (converting both to ISO `'YYYY-MM-DD'`).
 */
export function compareIsoDates(
  a: string | null | undefined,
  b: string | null | undefined
): number {
  const isoA = parseToIsoDate(a) || (a || '').trim();
  const isoB = parseToIsoDate(b) || (b || '').trim();
  if (isoA === isoB) return 0;
  return isoA < isoB ? -1 : 1;
}
