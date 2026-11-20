import { IssuedReceipt, PaymentMethod, TaxDeductionRules } from '../types';
import { parseToIsoDate } from './dates';

export const DEFAULT_RECEIPT_NUMBER_FORMAT = '{n}/{anno}';

export const DEFAULT_TAX_DEDUCTION_RULES: TaxDeductionRules = {
  minAge: 5,
  maxAge: 18,
  maxAnnualAmountPerChild: 210,
};

/**
 * Calcola il prossimo numero progressivo per l'anno specificato:
 * max(progressive delle ricevute dell'anno, incluse le annullate) + 1.
 * Se non ci sono ricevute per quell'anno, restituisce 1.
 */
export function nextReceiptProgressive(
  receipts: IssuedReceipt[] | undefined | null,
  year: number
): number {
  if (!Array.isArray(receipts) || receipts.length === 0) return 1;
  let maxProg = 0;
  for (const r of receipts) {
    if (r && r.year === year && typeof r.progressive === 'number' && Number.isFinite(r.progressive)) {
      if (r.progressive > maxProg) {
        maxProg = Math.floor(r.progressive);
      }
    }
  }
  return maxProg + 1;
}

/**
 * Formatta il numero ricevuta secondo il formato configurato nel profilo (default "{n}/{anno}").
 * Supporta i token:
 * - {n} -> progressivo intero (es. 1, 2, 12)
 * - {n3} -> progressivo a 3 cifre (es. 001, 012)
 * - {anno} -> anno a 4 cifre (es. 2027)
 */
export function formatReceiptNumber(
  progressive: number,
  year: number,
  format?: string
): string {
  const tpl = (format || '').trim() || DEFAULT_RECEIPT_NUMBER_FORMAT;
  const nStr = String(Math.max(1, Math.floor(progressive)));
  const n3Str = nStr.padStart(3, '0');
  const yStr = String(year);
  return tpl
    .split('{n3}')
    .join(n3Str)
    .split('{n}')
    .join(nStr)
    .split('{anno}')
    .join(yStr);
}

/**
 * Verifica se esiste già una ricevuta con lo stesso numero nello stesso anno
 * (escludendo opzionalmente l'ID della ricevuta che si sta visualizzando/modificando).
 */
export function findDuplicateReceiptNumber(
  receipts: IssuedReceipt[] | undefined | null,
  year: number,
  numberStr: string,
  excludeReceiptId?: string
): IssuedReceipt | undefined {
  if (!Array.isArray(receipts) || !numberStr) return undefined;
  const target = numberStr.trim().toLowerCase();
  if (!target) return undefined;
  return receipts.find(
    (r) =>
      r &&
      r.year === year &&
      r.id !== excludeReceiptId &&
      (r.number || '').trim().toLowerCase() === target
  );
}

/**
 * Rileva eventuali "buchi" nella sequenza dei numeri progressivi dell'anno
 * tra 1 e il massimo progressivo emesso/annullato.
 */
export function detectReceiptNumberGaps(
  receipts: IssuedReceipt[] | undefined | null,
  year: number
): number[] {
  if (!Array.isArray(receipts) || receipts.length === 0) return [];
  const used = new Set<number>();
  let maxProg = 0;
  for (const r of receipts) {
    if (
      r &&
      r.year === year &&
      typeof r.progressive === 'number' &&
      Number.isFinite(r.progressive) &&
      r.progressive >= 1
    ) {
      const p = Math.floor(r.progressive);
      used.add(p);
      if (p > maxProg) maxProg = p;
    }
  }
  if (maxProg <= 1) return [];
  const gaps: number[] = [];
  for (let i = 1; i <= maxProg; i++) {
    if (!used.has(i)) {
      gaps.push(i);
    }
  }
  return gaps;
}

/**
 * Cerca una ricevuta già emessa (non annullata) collegata al contesto corrente
 * (per ID diretto, movimento di cassa, iscrizione evento o ordine gadget).
 */
export function findExistingReceiptForContext(
  receipts: IssuedReceipt[] | undefined | null,
  ctx: {
    receiptId?: string;
    transactionId?: string;
    bookingId?: string;
    gadgetOrderId?: string;
    memberId?: string;
    year?: number;
  }
): IssuedReceipt | undefined {
  if (!Array.isArray(receipts) || receipts.length === 0) return undefined;

  if (ctx.receiptId) {
    const byId = receipts.find((r) => r.id === ctx.receiptId);
    if (byId) return byId;
  }

  const activeReceipts = receipts.filter((r) => r.status === 'emessa');

  if (ctx.transactionId) {
    const byTx = activeReceipts.find((r) => r.transactionId === ctx.transactionId);
    if (byTx) return byTx;
  }

  if (ctx.bookingId) {
    const byBk = activeReceipts.find((r) => r.bookingId === ctx.bookingId);
    if (byBk) return byBk;
  }

  if (ctx.gadgetOrderId) {
    const byGo = activeReceipts.find((r) => r.gadgetOrderId === ctx.gadgetOrderId);
    if (byGo) return byGo;
  }

  return undefined;
}

/**
 * Calcola l'età in anni compiuti del praticante alla data di emissione/pagamento.
 * Restituisce null se una delle due date non è valida.
 */
export function calculateAgeAtDate(
  birthDateRaw?: string,
  referenceDateRaw?: string
): number | null {
  const birthIso = parseToIsoDate(birthDateRaw);
  const refIso = parseToIsoDate(referenceDateRaw);
  if (!birthIso || !refIso) return null;

  const [by, bm, bd] = birthIso.split('-').map((n) => parseInt(n, 10));
  const [ry, rm, rd] = refIso.split('-').map((n) => parseInt(n, 10));

  let age = ry - by;
  if (rm < bm || (rm === bm && rd < bd)) {
    age -= 1;
  }
  return age;
}

export function isPlaceholderFiscalCode(cf?: string): boolean {
  if (!cf) return true;
  const trimmed = cf.trim();
  if (!trimmed || trimmed === '-') return true;
  const lower = trimmed.toLowerCase();
  return (
    lower.includes('registrato agli atti') ||
    lower.includes('da inserire') ||
    lower.includes('mancante') ||
    trimmed.length < 11
  );
}

/**
 * Estrae l'anno a 4 cifre dalla data del documento (supporta sia YYYY-MM-DD sia DD/MM/YYYY),
 * con fallback all'anno attivo del profilo.
 */
export function extractReceiptYearFromDate(
  dateStr?: string,
  fallbackYear = 2027
): number {
  const iso = parseToIsoDate(dateStr);
  if (iso) {
    const yr = Number(iso.slice(0, 4));
    if (Number.isFinite(yr) && yr >= 1900 && yr <= 2100) return yr;
  }
  const directYr = Number((dateStr || '').trim().slice(0, 4));
  if (Number.isFinite(directYr) && directYr >= 1900 && directYr <= 2100) {
    return directYr;
  }
  return fallbackYear;
}

/**
 * Estrae il numero progressivo da una stringa numero ricevuta (es. "12/2027", "2027-015", "RIC-2027-4")
 * ignorando il token corrispondente all'anno di emissione a 4 cifre.
 */
export function parseProgressiveFromReceiptNumber(
  numberStr: string | undefined | null,
  year: number,
  fallbackProgressive: number
): number {
  if (!numberStr) return fallbackProgressive;
  const groups = numberStr.match(/\d+/g);
  if (!groups || groups.length === 0) return fallbackProgressive;

  const yearStr = String(year);
  const nonYearGroup = groups.find((g) => g !== yearStr);
  if (nonYearGroup) {
    const parsed = parseInt(nonYearGroup, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  if (groups.length >= 2 && groups[0] === yearStr) {
    const parsedSecond = parseInt(groups[1], 10);
    if (Number.isFinite(parsedSecond) && parsedSecond > 0) return parsedSecond;
  }

  return fallbackProgressive;
}

/**
 * Calcola il totale già pagato (ricevute emesse non annullate) nello stesso anno per lo stesso praticante,
 * confrontando per:
 * 1) `memberId` (se presente), oppure
 * 2) `participantFiscalCode` valido (non segnaposto), oppure
 * 3) `participantName` normalizzato.
 */
export function calculatePreviousPaidSameYearForParticipant(
  receipts: IssuedReceipt[] | undefined | null,
  criteria: {
    year: number;
    excludeReceiptId?: string;
    memberId?: string;
    participantFiscalCode?: string;
    participantName?: string;
  }
): number {
  if (!Array.isArray(receipts) || receipts.length === 0) return 0;
  const cleanMemberId = (criteria.memberId || '').trim();
  const cleanCf = !isPlaceholderFiscalCode(criteria.participantFiscalCode)
    ? (criteria.participantFiscalCode || '').trim().toUpperCase()
    : '';
  const cleanName = (criteria.participantName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const isGenericName = !cleanName || cleanName === 'socio tesserato';

  let sum = 0;
  for (const r of receipts) {
    if (!r || r.status !== 'emessa' || r.year !== criteria.year) continue;
    if (criteria.excludeReceiptId && r.id === criteria.excludeReceiptId) continue;

    let matches = false;
    if (cleanMemberId && r.memberId && r.memberId.trim() === cleanMemberId) {
      matches = true;
    } else if (
      cleanCf &&
      !isPlaceholderFiscalCode(r.participantFiscalCode) &&
      (r.participantFiscalCode || '').trim().toUpperCase() === cleanCf
    ) {
      matches = true;
    } else if (!isGenericName && r.participantName) {
      const rName = r.participantName.trim().toLowerCase().replace(/\s+/g, ' ');
      if (rName === cleanName) {
        matches = true;
      }
    }

    if (matches) {
      sum += Number(r.amount) || 0;
    }
  }
  return Math.round(sum * 100) / 100;
}

export function isTaxDeductionClausePresent(params: {
  forTaxDeduction?: boolean;
  legalTaxClause?: string;
  introDeclarationText?: string;
  activityDescriptionSubtext?: string;
}): boolean {
  if (params.forTaxDeduction !== undefined) {
    return params.forTaxDeduction;
  }
  const combined = [
    params.legalTaxClause || '',
    params.introDeclarationText || '',
    params.activityDescriptionSubtext || '',
  ]
    .join(' ')
    .toLowerCase();
  return (
    combined.includes('detra') ||
    combined.includes('19%') ||
    combined.includes('i-quinquies') ||
    combined.includes('730') ||
    combined.includes('art. 15')
  );
}

export type Receipt730WarningCode =
  | 'missing_asd_cf'
  | 'missing_payer_name'
  | 'missing_payer_cf'
  | 'missing_participant_name'
  | 'missing_participant_cf'
  | 'missing_description'
  | 'missing_amount'
  | 'missing_date'
  | 'untraceable_payment_method'
  | 'age_out_of_range'
  | 'annual_cap_exceeded'
  | 'annual_cap_info';

export interface Receipt730Warning {
  code: Receipt730WarningCode;
  severity: 'warning' | 'info';
  message: string;
}

export interface Receipt730ValidationInput {
  asdFiscalCode?: string;
  payerName?: string;
  payerFiscalCode?: string;
  participantName?: string;
  participantFiscalCode?: string;
  participantBirthDate?: string;
  description?: string;
  amount: number;
  issueDate?: string;
  paymentMethod: PaymentMethod | string;
  previousPaidSameYearForParticipant?: number;
}

export interface Receipt730ValidationResult {
  warnings: Receipt730Warning[];
  hasCriticalWarnings: boolean;
  calculatedAge: number | null;
  rules: TaxDeductionRules;
  consultantDisclaimer: string;
}

/**
 * Controlli per la detrazione 730 (avvisi non bloccanti, punto 3.4):
 * - avvisa se mancano: CF associazione, nome e CF di chi paga, nome e CF del praticante,
 *   descrizione attività sportiva, importo, data;
 * - avvisa se il metodo di pagamento è Contanti ("per la detrazione il pagamento deve essere tracciabile");
 * - avvisa se l'età del praticante alla data del pagamento è fuori dall'intervallo 5–18 anni (configurabile);
 * - avvisa (informativo) che la spesa detraibile ha un tetto di 210 € per figlio all'anno (configurabile).
 */
export function validateReceiptFor730(
  input: Receipt730ValidationInput,
  customRules?: Partial<TaxDeductionRules>
): Receipt730ValidationResult {
  const rules: TaxDeductionRules = {
    ...DEFAULT_TAX_DEDUCTION_RULES,
    ...(customRules || {}),
  };

  const warnings: Receipt730Warning[] = [];

  if (isPlaceholderFiscalCode(input.asdFiscalCode)) {
    warnings.push({
      code: 'missing_asd_cf',
      severity: 'warning',
      message: "Manca il Codice Fiscale dell'Associazione nel profilo ASD.",
    });
  }

  const cleanPayerName = (input.payerName || '').trim();
  if (
    !cleanPayerName ||
    cleanPayerName.toLowerCase().includes('genitore / tutore') ||
    cleanPayerName.toLowerCase().includes('esercente la responsabilità')
  ) {
    warnings.push({
      code: 'missing_payer_name',
      severity: 'warning',
      message: 'Manca il nome e cognome reale di chi effettua il pagamento (genitore/pagante).',
    });
  }

  if (isPlaceholderFiscalCode(input.payerFiscalCode)) {
    warnings.push({
      code: 'missing_payer_cf',
      severity: 'warning',
      message:
        'Manca il Codice Fiscale di chi effettua il pagamento (obbligatorio per la detrazione 730).',
    });
  }

  const cleanParticipantName = (input.participantName || '').trim();
  if (!cleanParticipantName || cleanParticipantName.toLowerCase() === 'socio tesserato') {
    warnings.push({
      code: 'missing_participant_name',
      severity: 'warning',
      message: 'Manca il nome e cognome del praticante (bambino/ragazzo).',
    });
  }

  if (isPlaceholderFiscalCode(input.participantFiscalCode)) {
    warnings.push({
      code: 'missing_participant_cf',
      severity: 'warning',
      message:
        'Manca il Codice Fiscale del praticante (bambino/ragazzo), richiesto nella quietanza per il 730.',
    });
  }

  if (!(input.description || '').trim()) {
    warnings.push({
      code: 'missing_description',
      severity: 'warning',
      message: "Manca la descrizione dell'attività sportiva dilettantistica.",
    });
  }

  if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
    warnings.push({
      code: 'missing_amount',
      severity: 'warning',
      message: "L'importo della ricevuta deve essere maggiore di zero.",
    });
  }

  const validIsoDate = parseToIsoDate(input.issueDate);
  if (!validIsoDate) {
    warnings.push({
      code: 'missing_date',
      severity: 'warning',
      message: 'La data del documento non è valida.',
    });
  }

  const methodNorm = (input.paymentMethod || '').trim().toLowerCase();
  if (methodNorm === 'contanti' || methodNorm === 'cash' || methodNorm === 'cassa') {
    warnings.push({
      code: 'untraceable_payment_method',
      severity: 'warning',
      message:
        'Metodo di pagamento "Contanti": per la detrazione nel 730 il pagamento deve essere tracciabile (Bonifico, POS, Bancomat, Carta o sistema tracciato).',
    });
  }

  const calculatedAge = calculateAgeAtDate(input.participantBirthDate, validIsoDate || undefined);
  if (calculatedAge !== null && (calculatedAge < rules.minAge || calculatedAge > rules.maxAge)) {
    warnings.push({
      code: 'age_out_of_range',
      severity: 'warning',
      message: `L'età del praticante alla data del pagamento è di ${calculatedAge} anni (fuori dall'intervallo ${rules.minAge}–${rules.maxAge} anni previsto per la detrazione sportiva minori).`,
    });
  }

  const prevPaid = input.previousPaidSameYearForParticipant || 0;
  const cumulativeAmount = prevPaid + (Number.isFinite(input.amount) ? input.amount : 0);

  if (cumulativeAmount > rules.maxAnnualAmountPerChild) {
    warnings.push({
      code: 'annual_cap_exceeded',
      severity: 'info',
      message: `La spesa cumulativa nell'anno per il praticante (€ ${cumulativeAmount.toFixed(
        2
      )}) supera il tetto massimo detraibile di € ${rules.maxAnnualAmountPerChild} per figlio all'anno (la detrazione del 19% si calcola fino a € ${rules.maxAnnualAmountPerChild}).`,
    });
  } else {
    warnings.push({
      code: 'annual_cap_info',
      severity: 'info',
      message: `Promemoria 730: la spesa sportiva detraibile al 19% ha un tetto massimo di € ${rules.maxAnnualAmountPerChild} per figlio all'anno.`,
    });
  }

  const hasCriticalWarnings = warnings.some((w) => w.severity === 'warning');

  return {
    warnings,
    hasCriticalWarnings,
    calculatedAge,
    rules,
    consultantDisclaimer: 'Verificare i requisiti aggiornati con il proprio consulente.',
  };
}
