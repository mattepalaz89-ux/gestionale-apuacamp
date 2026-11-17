import {
  CashTransaction,
  CashCategory,
  EventItem,
  EventBooking,
  Member,
  EventDiscountType,
  ReceiptLineItem,
} from '../types';

export interface MonthlyCashFlow {
  monthKey: string; // e.g. "2026-01"
  monthLabel: string; // e.g. "Gennaio 2026"
  income: number;
  expense: number;
  net: number;
}

export interface CategorySummary {
  category: CashCategory;
  totalIncome: number;
  totalExpense: number;
  count: number;
}

export function formatEuro(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '€ 0,00';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseAmount(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  // clean € and spaces, replace Italian comma with dot
  const clean = val.replace(/€/g, '').replace(/\s+/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateCashTotals(
  transactions: CashTransaction[],
  initialFund: number = 0,
  initialBank: number = 0,
  initialCash: number = 0
) {
  let totalIncome = 0;
  let totalExpense = 0;
  let bankIncome = 0;
  let bankExpense = 0;
  let cashIncome = 0;
  let cashExpense = 0;

  for (const t of transactions) {
    const inc = t.income || 0;
    const exp = t.expense || 0;
    totalIncome += inc;
    totalExpense += exp;

    if (t.method === 'Contanti') {
      cashIncome += inc;
      cashExpense += exp;
    } else {
      // Bonifico, POS, Bancomat, Paypal, Pagam Online are electronic/bank
      bankIncome += inc;
      bankExpense += exp;
    }
  }

  totalIncome = round2(totalIncome);
  totalExpense = round2(totalExpense);
  const netBalance = round2(totalIncome - totalExpense);
  const currentTotal = round2(initialFund + netBalance);
  const currentBank = round2(initialBank + (bankIncome - bankExpense));
  const currentCash = round2(initialCash + (cashIncome - cashExpense));

  return {
    initialFund: round2(initialFund),
    initialBank: round2(initialBank),
    initialCash: round2(initialCash),
    totalIncome,
    totalExpense,
    netBalance,
    currentTotal,
    currentBank,
    currentCash,
  };
}

const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export function calculateMonthlyCashFlow(transactions: CashTransaction[]): MonthlyCashFlow[] {
  const map = new Map<string, { income: number; expense: number }>();

  for (const t of transactions) {
    if (!t.date) continue;
    // Normalize date: support "YYYY-MM-DD" or "DD/MM/YYYY" or "DD mes/YY"
    let year = 2026;
    let monthIndex = 0;

    if (t.date.includes('-')) {
      const parts = t.date.split('-');
      year = parseInt(parts[0], 10) || 2026;
      monthIndex = (parseInt(parts[1], 10) || 1) - 1;
    } else if (t.date.includes('/')) {
      const parts = t.date.split('/');
      monthIndex = (parseInt(parts[1], 10) || 1) - 1;
      year = parts[2] ? (parseInt(parts[2], 10) < 100 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10)) : 2026;
    } else {
      // Fallback
      monthIndex = 0;
    }

    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const curr = map.get(key) || { income: 0, expense: 0 };
    curr.income += t.income || 0;
    curr.expense += t.expense || 0;
    map.set(key, curr);
  }

  // Ensure chronological order for 2026 months Jan-Oct at minimum
  const result: MonthlyCashFlow[] = [];
  const sortedKeys = Array.from(map.keys()).sort();

  for (const key of sortedKeys) {
    const [yearStr, monthStr] = key.split('-');
    const mIdx = parseInt(monthStr, 10) - 1;
    const data = map.get(key)!;
    result.push({
      monthKey: key,
      monthLabel: `${MONTH_NAMES_IT[mIdx] || monthStr} ${yearStr}`,
      income: data.income,
      expense: data.expense,
      net: data.income - data.expense,
    });
  }

  return result;
}

export function calculateCategoryBreakdown(transactions: CashTransaction[]): {
  incomeCategories: CategorySummary[];
  expenseCategories: CategorySummary[];
} {
  const map = new Map<CashCategory, { income: number; expense: number; count: number }>();

  for (const t of transactions) {
    const entry = map.get(t.category) || { income: 0, expense: 0, count: 0 };
    entry.income += t.income || 0;
    entry.expense += t.expense || 0;
    entry.count += 1;
    map.set(t.category, entry);
  }

  const incomeCategories: CategorySummary[] = [];
  const expenseCategories: CategorySummary[] = [];

  for (const [cat, data] of map.entries()) {
    if (data.income > 0) {
      incomeCategories.push({
        category: cat,
        totalIncome: data.income,
        totalExpense: data.expense,
        count: data.count,
      });
    }
    if (data.expense > 0) {
      expenseCategories.push({
        category: cat,
        totalIncome: data.income,
        totalExpense: data.expense,
        count: data.count,
      });
    }
  }

  incomeCategories.sort((a, b) => b.totalIncome - a.totalIncome);
  expenseCategories.sort((a, b) => b.totalExpense - a.totalExpense);

  return { incomeCategories, expenseCategories };
}

export function calculateEventFinancials(event: EventItem, bookings: EventBooking[]) {
  const eventBookings = bookings.filter((b) => b.eventId === event.id);
  const confirmedCount = eventBookings.filter((b) => b.confirmed).length;

  let totalCollected = 0;
  let totalPending = 0;

  for (const b of eventBookings) {
    if (b.confirmed) {
      const paid = (b.isDepositPaid ? b.depositAmount : 0) + (b.isBalancePaid ? b.balanceAmount : 0);
      totalCollected += paid;
      totalPending += Math.max(0, b.totalPrice - paid);
    }
  }

  // Live calculation or fallback to event default benchmark notes
  const targetStaff = event.targetStaffCount || 3;
  const benchmarkCost = event.id === 'ev-01' ? 1100 : Math.round(totalCollected * 0.4);
  const reserveFund = event.id === 'ev-01' ? 75 : Math.round(totalCollected * 0.05);
  const netToDivide = Math.max(0, totalCollected - benchmarkCost - reserveFund);
  const perStaffShare = targetStaff > 0 ? Math.round(netToDivide / targetStaff) : 0;

  return {
    totalBookings: eventBookings.length,
    confirmedCount,
    totalCollected,
    totalPending,
    benchmarkCost,
    reserveFund,
    netToDivide,
    perStaffShare,
    targetStaff,
  };
}

// ============================================================================
// SORTING SOCI & TESSERE (A->Z / Z->A PER INTESTAZIONE TABELLA)
// ============================================================================

export type MemberSortField =
  | 'childName'
  | 'parentName'
  | 'group'
  | 'membershipCardNumber'
  | 'insuranceType'
  | 'cardValidityType'
  | 'expiryDate'
  | 'voucherBalance'
  | 'isPaid';

export type SortDirection = 'asc' | 'desc';

function parseSortableDateVal(dateStr?: string): number {
  if (!dateStr) return 0;
  const s = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(s).getTime() || 0;
  }
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime() || 0;
  }
  return 0;
}

const GROUP_ORDER: Record<string, number> = {
  '3-6': 1,
  '6-11': 2,
  '11-14': 3,
};

const INSURANCE_ORDER: Record<string, number> = {
  Base: 1,
  Summer: 2,
  Gold: 3,
  Platinum: 4,
};

export function sortMembersList(
  members: Member[],
  field: MemberSortField,
  direction: SortDirection = 'asc'
): Member[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...members].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'childName':
        cmp = (a.childName || '').localeCompare(b.childName || '', 'it', {
          sensitivity: 'base',
        });
        break;
      case 'parentName':
        cmp = (a.parentName || '').localeCompare(b.parentName || '', 'it', {
          sensitivity: 'base',
        });
        break;
      case 'group':
        cmp = (GROUP_ORDER[a.group] || 99) - (GROUP_ORDER[b.group] || 99);
        break;
      case 'membershipCardNumber':
        cmp = (a.membershipCardNumber || '').localeCompare(
          b.membershipCardNumber || '',
          'it',
          { numeric: true, sensitivity: 'base' }
        );
        break;
      case 'insuranceType':
        cmp =
          (INSURANCE_ORDER[a.insuranceType] || 0) -
          (INSURANCE_ORDER[b.insuranceType] || 0);
        break;
      case 'cardValidityType':
        cmp = (a.cardValidityType || 'solare').localeCompare(
          b.cardValidityType || 'solare',
          'it'
        );
        break;
      case 'expiryDate':
        cmp = parseSortableDateVal(a.expiryDate) - parseSortableDateVal(b.expiryDate);
        break;
      case 'voucherBalance':
        cmp = (a.voucherBalance || 0) - (b.voucherBalance || 0);
        break;
      case 'isPaid':
        cmp = (a.isPaid ? 1 : 0) - (b.isPaid ? 1 : 0);
        break;
      default:
        cmp = 0;
    }
    if (cmp === 0) {
      return (a.childName || '').localeCompare(b.childName || '', 'it', {
        sensitivity: 'base',
      });
    }
    return cmp * factor;
  });
}

// ============================================================================
// SCONTI EVENTO (QUOTA FISSA € O PERCENTUALE %) + BUONI SPESA & DICITURE SALVABILI
// ============================================================================

export const DEFAULT_SAVED_DISCOUNT_LABELS: string[] = [
  'Riduzione fascia ISEE agevolata',
  'Quota coperta da Comune / Ente Pubblico',
  'Contributo coperto da Associazione Partner / Fondazione',
  'Sconto Fratelli / Sorelle iscritti',
  'Borsa Sportiva / Fondo Solidarietà ASD',
];

export function mergeSavedDiscountLabels(
  existingLabels: string[] | undefined,
  newLabel?: string
): string[] {
  const base =
    existingLabels && existingLabels.length > 0
      ? [...existingLabels]
      : [...DEFAULT_SAVED_DISCOUNT_LABELS];
  const trimmed = (newLabel || '').trim();
  if (!trimmed) return base;
  const alreadyPresent = base.some((l) => l.trim().toLowerCase() === trimmed.toLowerCase());
  if (!alreadyPresent) {
    return [trimmed, ...base];
  }
  return base;
}

export function calculateDiscountedEventPrice(params: {
  basePrice: number;
  discountType?: EventDiscountType;
  discountValue?: number;
  voucherUsed?: number;
}): {
  basePrice: number;
  discountAmount: number;
  afterDiscountPrice: number;
  voucherApplied: number;
  finalNetPrice: number;
} {
  const base = Math.max(0, round2(params.basePrice || 0));
  const dType = params.discountType || 'none';
  const dVal = Math.max(0, Number(params.discountValue) || 0);

  let discountAmount = 0;
  if (dType === 'fixed') {
    discountAmount = Math.min(base, round2(dVal));
  } else if (dType === 'percent') {
    const pct = Math.min(100, dVal);
    discountAmount = round2((base * pct) / 100);
  }

  const afterDiscountPrice = Math.max(0, round2(base - discountAmount));
  const rawVoucher = Math.max(0, round2(params.voucherUsed || 0));
  const voucherApplied = Math.min(afterDiscountPrice, rawVoucher);
  const finalNetPrice = Math.max(0, round2(afterDiscountPrice - voucherApplied));

  return {
    basePrice: base,
    discountAmount,
    afterDiscountPrice,
    voucherApplied,
    finalNetPrice,
  };
}

export function calculateMultiItemReceiptTotals(params: {
  items: ReceiptLineItem[];
  discountType?: EventDiscountType;
  discountValue?: number;
  voucherUsed?: number;
}): {
  enabledItems: ReceiptLineItem[];
  grossTotal: number;
  discountAmount: number;
  voucherApplied: number;
  netTotal: number;
} {
  const enabledItems = (params.items || []).filter((i) => i.enabled);
  const grossTotal = round2(
    enabledItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  );
  const calc = calculateDiscountedEventPrice({
    basePrice: grossTotal,
    discountType: params.discountType,
    discountValue: params.discountValue,
    voucherUsed: params.voucherUsed,
  });

  return {
    enabledItems,
    grossTotal: calc.basePrice,
    discountAmount: calc.discountAmount,
    voucherApplied: calc.voucherApplied,
    netTotal: calc.finalNetPrice,
  };
}

