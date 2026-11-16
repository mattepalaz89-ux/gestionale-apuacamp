import { CashTransaction, CashCategory, EventItem, EventBooking } from '../types';

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
