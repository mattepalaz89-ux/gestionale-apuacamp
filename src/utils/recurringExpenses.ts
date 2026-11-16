import {
  CashTransaction,
  RecurringExpenseDurationMode,
  RecurringExpenseFrequency,
  RecurringExpensePlan,
} from '../types';
import { parseAnyDate } from './notifications';

export interface RecurringExpenseOccurrence {
  planId: string;
  installmentNumber: number;
  totalInstallments?: number;
  date: string; // YYYY-MM-DD
  amount: number;
  label: string; // e.g. "Rata 3/6" or "Mensilità Mar 2027" or "Annualità 2027"
  isPaidInCashFlow: boolean;
  matchedTransactionId?: string;
}

export interface EvaluatedRecurringExpensePlan {
  plan: RecurringExpensePlan;
  frequencyLabel: string;
  durationSummaryLabel: string;
  allOccurrences: RecurringExpenseOccurrence[];
  activeYearOccurrences: RecurringExpenseOccurrence[];
  paidOccurrencesCount: number;
  unpaidActiveYearOccurrences: RecurringExpenseOccurrence[];
  nextUnpaidOccurrence: RecurringExpenseOccurrence | null;
  activeYearTotalAmount: number;
  activeYearPaidAmount: number;
  activeYearRemainingAmount: number;
  totalPlanCommitmentAmount: number | null; // null if indeterminata
  completionPercent: number;
}

const SHORT_MONTHS_IT = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
];

export const FREQUENCY_MONTH_STEP: Record<RecurringExpenseFrequency, number> = {
  mensile: 1,
  bimestrale: 2,
  trimestrale: 3,
  semestrale: 6,
  annuale: 12,
};

export const FREQUENCY_LABELS: Record<RecurringExpenseFrequency, string> = {
  mensile: 'Mensile (ogni mese)',
  bimestrale: 'Bimestrale (ogni 2 mesi)',
  trimestrale: 'Trimestrale (ogni 3 mesi)',
  semestrale: 'Semestrale (ogni 6 mesi)',
  annuale: 'Annuale (1 volta l\'anno)',
};

export const DURATION_MODE_LABELS: Record<RecurringExpenseDurationMode, string> = {
  indeterminata: 'Continuativa (Spesa fissa mensile/annua)',
  numero_rate: 'Per un tot di rate/scadenze (Durata fissa)',
  fino_a_data: 'Fino a una data di scadenza contratto',
};

/**
 * Adds N months to a (year, month0Based, anchorDay) safely clamping to the last day of the target month
 */
export function addMonthsClamped(
  baseYear: number,
  baseMonth0: number,
  anchorDay: number,
  monthsToAdd: number
): string {
  const totalMonths = baseYear * 12 + baseMonth0 + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth0 = ((totalMonths % 12) + 12) % 12;
  const maxDayInTargetMonth = new Date(targetYear, targetMonth0 + 1, 0).getDate();
  const clampedDay = Math.min(anchorDay, maxDayInTargetMonth);
  return `${targetYear}-${String(targetMonth0 + 1).padStart(2, '0')}-${String(clampedDay).padStart(
    2,
    '0'
  )}`;
}

/**
 * Generates the scheduled occurrences for a recurring expense plan.
 */
export function generateScheduledOccurrencesForPlan(
  plan: RecurringExpensePlan,
  activeYear: number = 2027
): Omit<RecurringExpenseOccurrence, 'isPaidInCashFlow' | 'matchedTransactionId'>[] {
  const startParsed = parseAnyDate(plan.startDate);
  if (!startParsed) return [];

  const startYear = startParsed.getFullYear();
  const startMonth0 = startParsed.getMonth();
  const anchorDay = startParsed.getDate();
  const monthStep = FREQUENCY_MONTH_STEP[plan.frequency] || 1;

  // Horizon for "indeterminata": generate up to the end of activeYear (or startYear + 1 if startYear > activeYear)
  const horizonYear = Math.max(activeYear, startYear);
  const defaultHorizonDate = `${horizonYear}-12-31`;

  const maxCap =
    plan.durationMode === 'numero_rate' && plan.maxInstallments && plan.maxInstallments > 0
      ? Math.min(120, Math.round(plan.maxInstallments))
      : 60;

  const occurrences: Omit<
    RecurringExpenseOccurrence,
    'isPaidInCashFlow' | 'matchedTransactionId'
  >[] = [];

  for (let i = 0; i < maxCap; i++) {
    const occDate = addMonthsClamped(startYear, startMonth0, anchorDay, i * monthStep);

    if (plan.durationMode === 'fino_a_data' && plan.endDate && occDate > plan.endDate) {
      break;
    }

    if (plan.durationMode === 'indeterminata' && occDate > defaultHorizonDate && i > 0) {
      break;
    }

    const [yStr, mStr] = occDate.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    const monthLabel = `${SHORT_MONTHS_IT[mIdx] || mStr} ${yStr}`;

    let label = '';
    if (plan.durationMode === 'numero_rate' && plan.maxInstallments) {
      label = `Rata ${i + 1}/${plan.maxInstallments} (${monthLabel})`;
    } else if (plan.frequency === 'annuale') {
      label = `Annualità ${yStr}`;
    } else {
      label = `Scadenza ${monthLabel} (#${i + 1})`;
    }

    occurrences.push({
      planId: plan.id,
      installmentNumber: i + 1,
      totalInstallments:
        plan.durationMode === 'numero_rate' ? plan.maxInstallments : undefined,
      date: occDate,
      amount: plan.amount,
      label,
    });
  }

  return occurrences;
}

/**
 * Evaluates all recurring expense plans against the current CashFlow transactions.
 */
export function evaluateRecurringExpensePlans(
  plans: RecurringExpensePlan[],
  transactions: CashTransaction[],
  activeYear: number = 2027
): EvaluatedRecurringExpensePlan[] {
  return plans.map((plan) => {
    const rawOccurrences = generateScheduledOccurrencesForPlan(plan, activeYear);

    const allOccurrences: RecurringExpenseOccurrence[] = rawOccurrences.map((occ) => {
      const matchedTx = transactions.find(
        (tx) =>
          (tx.recurringPlanId === plan.id &&
            (tx.recurringOccurrenceDate === occ.date ||
              tx.recurringInstallmentNumber === occ.installmentNumber)) ||
          (tx.recurringPlanId === plan.id && tx.date === occ.date)
      );

      return {
        ...occ,
        isPaidInCashFlow: !!matchedTx,
        matchedTransactionId: matchedTx?.id,
      };
    });

    const yearPrefix = `${activeYear}-`;
    const activeYearOccurrences = allOccurrences.filter((o) => o.date.startsWith(yearPrefix));
    // If none fall in activeYear (e.g., plan starts in another year), show allOccurrences as fallback
    const effectiveYearOccurrences =
      activeYearOccurrences.length > 0 ? activeYearOccurrences : allOccurrences;

    const paidOccurrencesCount = allOccurrences.filter((o) => o.isPaidInCashFlow).length;
    const unpaidActiveYearOccurrences = effectiveYearOccurrences.filter(
      (o) => !o.isPaidInCashFlow
    );
    const nextUnpaidOccurrence =
      allOccurrences.find((o) => !o.isPaidInCashFlow) || null;

    const activeYearTotalAmount =
      Math.round(
        effectiveYearOccurrences.reduce((acc, o) => acc + o.amount, 0) * 100
      ) / 100;
    const activeYearPaidAmount =
      Math.round(
        effectiveYearOccurrences
          .filter((o) => o.isPaidInCashFlow)
          .reduce((acc, o) => acc + o.amount, 0) * 100
      ) / 100;
    const activeYearRemainingAmount = Math.max(
      0,
      Math.round((activeYearTotalAmount - activeYearPaidAmount) * 100) / 100
    );

    const totalPlanCommitmentAmount =
      plan.durationMode === 'indeterminata'
        ? null
        : Math.round(allOccurrences.reduce((acc, o) => acc + o.amount, 0) * 100) / 100;

    const denom =
      plan.durationMode === 'indeterminata'
        ? effectiveYearOccurrences.length
        : allOccurrences.length;
    const numer =
      plan.durationMode === 'indeterminata'
        ? effectiveYearOccurrences.filter((o) => o.isPaidInCashFlow).length
        : paidOccurrencesCount;
    const completionPercent = denom > 0 ? Math.min(100, Math.round((numer / denom) * 100)) : 0;

    let durationSummaryLabel = 'Continuativa';
    if (plan.durationMode === 'numero_rate' && plan.maxInstallments) {
      durationSummaryLabel = `${plan.maxInstallments} rate (${paidOccurrencesCount}/${plan.maxInstallments} pagate)`;
    } else if (plan.durationMode === 'fino_a_data' && plan.endDate) {
      durationSummaryLabel = `Fino al ${plan.endDate} (${allOccurrences.length} scadenze)`;
    } else {
      durationSummaryLabel = `Continuativa (${effectiveYearOccurrences.length} scadenze nel ${activeYear})`;
    }

    return {
      plan,
      frequencyLabel: FREQUENCY_LABELS[plan.frequency] || plan.frequency,
      durationSummaryLabel,
      allOccurrences,
      activeYearOccurrences: effectiveYearOccurrences,
      paidOccurrencesCount,
      unpaidActiveYearOccurrences,
      nextUnpaidOccurrence,
      activeYearTotalAmount,
      activeYearPaidAmount,
      activeYearRemainingAmount,
      totalPlanCommitmentAmount,
      completionPercent,
    };
  });
}

/**
 * Converts a scheduled recurring occurrence into a CashTransaction payload ready to be added to Libro Cassa
 */
export function buildTransactionFromOccurrence(
  plan: RecurringExpensePlan,
  occurrence: Pick<
    RecurringExpenseOccurrence,
    'date' | 'amount' | 'label' | 'installmentNumber'
  >
): Omit<CashTransaction, 'id'> {
  return {
    date: occurrence.date,
    category: plan.category,
    income: null,
    expense: occurrence.amount,
    method: plan.method,
    description: `${plan.title} — ${occurrence.label}`,
    recurringPlanId: plan.id,
    recurringOccurrenceDate: occurrence.date,
    recurringInstallmentNumber: occurrence.installmentNumber,
  };
}
