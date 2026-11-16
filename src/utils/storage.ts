import {
  Member,
  CashTransaction,
  EventItem,
  EventBooking,
  StaffMember,
  AssociationProfile,
  GadgetItem,
  GadgetOrder,
  AssociationRole,
  AssemblyMeeting,
  GrantItem,
  ArchivedFiscalYear,
  RecurringExpensePlan,
} from '../types';
import {
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
  INITIAL_EVENTS,
  INITIAL_BOOKINGS,
  INITIAL_STAFF,
  INITIAL_ASSOCIATION_PROFILE,
  INITIAL_CASH_SUMMARY,
  INITIAL_GADGETS,
  INITIAL_GADGET_ORDERS,
  INITIAL_ROLES,
  INITIAL_ASSEMBLIES,
  INITIAL_GRANTS,
  INITIAL_ARCHIVED_YEARS,
} from '../data/initialData';
import { calculateCashTotals } from './finance';

export interface AppState {
  members: Member[];
  transactions: CashTransaction[];
  events: EventItem[];
  bookings: EventBooking[];
  staff: StaffMember[];
  profile: AssociationProfile;
  initialFund: number;
  initialFundBank: number;
  initialFundCash: number;
  gadgets: GadgetItem[];
  gadgetOrders: GadgetOrder[];
  roles: AssociationRole[];
  assemblies: AssemblyMeeting[];
  grants: GrantItem[];
  archivedYears: ArchivedFiscalYear[];
  recurringExpenses: RecurringExpensePlan[];
}

function getScopedKey(baseKey: string, userEmail?: string | null): string {
  const cleanUser = (userEmail || 'local_private').toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  return `apuacamp_v3_${cleanUser}_${baseKey}`;
}

const BASE_KEYS = [
  'members',
  'transactions',
  'events',
  'bookings',
  'staff',
  'profile',
  'cash_summary',
  'gadgets',
  'gadget_orders',
  'roles',
  'assemblies',
  'grants',
  'archived_years',
  'recurring_expenses',
];

export function clearLegacyBrowserStorage(userEmail?: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    BASE_KEYS.forEach((b) => {
      window.localStorage.removeItem(getScopedKey(b, userEmail));
      window.localStorage.removeItem(getScopedKey(b, null));
    });
  } catch {
    // ignore in non-browser environment
  }
}

export function loadAppState(userEmail?: string | null, startYear?: number): AppState {
  clearLegacyBrowserStorage(userEmail);
  return resetToEmpty2027(userEmail, startYear);
}

/**
 * Browser localStorage persistence is intentionally disabled so member & accounting data
 * is stored exclusively on Google Drive or in a local file on the user's PC (OneDrive/Dropbox/Disk).
 */
export function saveAppState(_state: AppState, userEmail?: string | null): void {
  clearLegacyBrowserStorage(userEmail);
}

export function resetToEmpty2027(userEmail?: string | null, startYear?: number): AppState {
  clearLegacyBrowserStorage(userEmail);
  const effectiveYear = startYear ?? INITIAL_ASSOCIATION_PROFILE.activeYear;
  return {
    members: INITIAL_MEMBERS,
    transactions: INITIAL_TRANSACTIONS,
    events: INITIAL_EVENTS,
    bookings: INITIAL_BOOKINGS,
    staff: INITIAL_STAFF,
    profile: {
      ...INITIAL_ASSOCIATION_PROFILE,
      activeYear: effectiveYear,
    },
    initialFund: INITIAL_CASH_SUMMARY.initialFund,
    initialFundBank: INITIAL_CASH_SUMMARY.initialFundBank,
    initialFundCash: INITIAL_CASH_SUMMARY.initialFundCash,
    gadgets: INITIAL_GADGETS,
    gadgetOrders: INITIAL_GADGET_ORDERS,
    roles: INITIAL_ROLES,
    assemblies: INITIAL_ASSEMBLIES,
    grants: INITIAL_GRANTS,
    archivedYears: INITIAL_ARCHIVED_YEARS,
    recurringExpenses: [],
  };
}

export interface YearTransitionMemberStats {
  totalMembersRetained: number;
  expiredCardsToRenewCount: number;
  stillValidTessera365Count: number;
}

function parseMemberExpiryYearAndTime(expiryStr?: string): { year: number; time: number } | null {
  if (!expiryStr) return null;
  const clean = expiryStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    return { year: y, time: Date.UTC(y, m - 1, d) };
  }
  const match = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (match) {
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    let y = parseInt(match[3], 10);
    if (y < 100) y += 2000;
    return { year: y, time: Date.UTC(y, m - 1, d) };
  }
  return null;
}

export function computeYearTransitionMemberStats(
  members: Member[],
  closedYear: number,
  newYear: number = closedYear + 1
): YearTransitionMemberStats {
  const newYearStartUTC = Date.UTC(newYear, 0, 1);
  let expiredCardsToRenewCount = 0;
  let stillValidTessera365Count = 0;

  for (const m of members) {
    const parsedExp = parseMemberExpiryYearAndTime(m.expiryDate);
    const isStillValidInNewYear =
      m.cardValidityType === 'tessera_365' && parsedExp !== null && parsedExp.time >= newYearStartUTC;
    if (isStillValidInNewYear) {
      stillValidTessera365Count++;
    } else {
      expiredCardsToRenewCount++;
    }
  }

  return {
    totalMembersRetained: members.length,
    expiredCardsToRenewCount,
    stillValidTessera365Count,
  };
}

/**
 * Pure function that archives the closing fiscal year and transitions the state to the new year,
 * carrying over ONLY the closing bank and cash balances as the new initialFund ("residuo a bilancio"),
 * keeping all members in the registry while expiring cards whose validity ended with the closed year.
 */
export function archiveFiscalYearState(
  currentState: AppState,
  targetNewYear?: number
): {
  nextState: AppState;
  archivedRecord: ArchivedFiscalYear;
  memberTransitionStats: YearTransitionMemberStats;
} {
  const closedYear = currentState.profile.activeYear;
  const newYear = targetNewYear ?? closedYear + 1;
  const newYearStartUTC = Date.UTC(newYear, 0, 1);

  const totals = calculateCashTotals(
    currentState.transactions,
    currentState.initialFund,
    currentState.initialFundBank,
    currentState.initialFundCash
  );

  const archivedRecord: ArchivedFiscalYear = {
    id: `arch-${closedYear}-${Date.now()}`,
    year: closedYear,
    archivedAt: new Date().toISOString().slice(0, 10),
    summary: {
      initialFund: totals.initialFund,
      totalIncome: totals.totalIncome,
      totalExpense: totals.totalExpense,
      netBalance: totals.netBalance,
      finalTotalBalance: totals.currentTotal,
      finalBankBalance: totals.currentBank,
      finalCashBalance: totals.currentCash,
      membersCount: currentState.members.length,
      eventsCount: currentState.events.length,
      bookingsCount: currentState.bookings.length,
    },
    transactions: [...currentState.transactions],
    events: [...currentState.events],
    bookings: [...currentState.bookings],
    gadgetOrders: [...currentState.gadgetOrders],
    membersSnapshot: [...currentState.members],
  };

  // Transition members: keep all members in the registry; expire cards that end on or before Dec 31 of closedYear
  const transitionedMembers: Member[] = currentState.members.map((m) => {
    const parsedExp = parseMemberExpiryYearAndTime(m.expiryDate);
    const isStillValidInNewYear =
      m.cardValidityType === 'tessera_365' &&
      parsedExp !== null &&
      parsedExp.time >= newYearStartUTC;

    if (isStillValidInNewYear) {
      return { ...m };
    }

    const previousExpiry = m.expiryDate || `31/12/${closedYear}`;
    const existingHistory = m.cardHistory || [];
    const alreadyInHistory = existingHistory.some(
      (h) => h.cardNumber === m.membershipCardNumber && h.expiryDate === previousExpiry
    );

    const updatedHistory =
      m.membershipCardNumber && !alreadyInHistory
        ? [
            {
              id: `hist-${closedYear}-${m.id}`,
              cardNumber: m.membershipCardNumber,
              issueDate: m.cardIssueDate || `01/01/${closedYear}`,
              expiryDate: previousExpiry,
              validityType: m.cardValidityType || ('solare' as const),
              insuranceType: m.insuranceType,
              notes: `Tessera Anno ${closedYear} (scaduta a fine esercizio)`,
            },
            ...existingHistory,
          ]
        : existingHistory;

    // Ensure expiryDate reflects the expired date (<= 31/12/closedYear) so the member stays in registry with expired card
    const effectiveExpiredDate =
      parsedExp && parsedExp.time < newYearStartUTC ? m.expiryDate : `31/12/${closedYear}`;

    return {
      ...m,
      expiryDate: effectiveExpiredDate,
      cardHistory: updatedHistory,
    };
  });

  const memberTransitionStats = computeYearTransitionMemberStats(
    currentState.members,
    closedYear,
    newYear
  );

  // Create statutory Assembly reminder for the closed year if not already present
  const approvalAssemblyTitle = `Assemblea Ordinaria Soci - Approvazione Rendiconto Economico-Finanziario ${closedYear}`;
  const hasAssembly = currentState.assemblies.some(
    (a) => a.fiscalYear === closedYear && a.type === 'ordinaria_rendiconto'
  );
  const nextAssemblies: AssemblyMeeting[] = hasAssembly
    ? currentState.assemblies
    : [
        {
          id: `asm-${closedYear}-bilancio-${Date.now()}`,
          fiscalYear: closedYear,
          title: approvalAssemblyTitle,
          type: 'ordinaria_rendiconto',
          scheduledDate: `${newYear}-04-15`,
          approvalDeadline: `${newYear}-04-30`,
          status: 'da_convocare',
          minutesSummary: `Approvazione del rendiconto economico-finanziario dell'esercizio chiuso al 31/12/${closedYear} (Residuo a bilancio riportato al ${newYear}: € ${totals.currentTotal.toFixed(
            2
          )}).`,
        },
        ...currentState.assemblies,
      ];

  const nextState: AppState = {
    ...currentState,
    members: transitionedMembers,
    profile: {
      ...currentState.profile,
      activeYear: newYear,
      accountingGoogleSheetId: undefined,
      accountingGoogleSheetUrl: undefined,
    },
    initialFund: totals.currentTotal,
    initialFundBank: totals.currentBank,
    initialFundCash: totals.currentCash,
    transactions: [],
    bookings: [],
    gadgetOrders: [],
    assemblies: nextAssemblies,
    archivedYears: [
      archivedRecord,
      ...currentState.archivedYears.filter((a) => a.year !== closedYear),
    ],
  };

  return { nextState, archivedRecord, memberTransitionStats };
}

export function exportBackupJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseBackupJSON(jsonText: string): AppState | null {
  try {
    const data = JSON.parse(jsonText);
    if (!Array.isArray(data.members) && !Array.isArray(data.transactions)) {
      throw new Error('Formato backup non valido');
    }
    return {
      members: Array.isArray(data.members) ? data.members : INITIAL_MEMBERS,
      transactions: Array.isArray(data.transactions) ? data.transactions : INITIAL_TRANSACTIONS,
      events: Array.isArray(data.events) ? data.events : INITIAL_EVENTS,
      bookings: Array.isArray(data.bookings) ? data.bookings : INITIAL_BOOKINGS,
      staff: Array.isArray(data.staff) ? data.staff : INITIAL_STAFF,
      profile: data.profile || INITIAL_ASSOCIATION_PROFILE,
      initialFund: typeof data.initialFund === 'number' ? data.initialFund : 0,
      initialFundBank: typeof data.initialFundBank === 'number' ? data.initialFundBank : 0,
      initialFundCash: typeof data.initialFundCash === 'number' ? data.initialFundCash : 0,
      gadgets: Array.isArray(data.gadgets) ? data.gadgets : INITIAL_GADGETS,
      gadgetOrders: Array.isArray(data.gadgetOrders) ? data.gadgetOrders : INITIAL_GADGET_ORDERS,
      roles: Array.isArray(data.roles) ? data.roles : INITIAL_ROLES,
      assemblies: Array.isArray(data.assemblies) ? data.assemblies : INITIAL_ASSEMBLIES,
      grants: Array.isArray(data.grants) ? data.grants : INITIAL_GRANTS,
      archivedYears: Array.isArray(data.archivedYears)
        ? data.archivedYears
        : INITIAL_ARCHIVED_YEARS,
      recurringExpenses: Array.isArray(data.recurringExpenses)
        ? data.recurringExpenses
        : [],
    };
  } catch (e) {
    console.error('Failed to parse backup JSON:', e);
    return null;
  }
}
