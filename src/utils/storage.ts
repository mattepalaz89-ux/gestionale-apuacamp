import {
  AppState,
  AssociationProfile,
  AssociationRole,
  Member,
  MemberCardRecord,
  RecurringExpensePlan,
  ArchivedFiscalYear,
} from '../types';
import {
  INITIAL_ASSOCIATION_PROFILE,
  INITIAL_CASH_SUMMARY,
  INITIAL_MEMBERS,
  INITIAL_TRANSACTIONS,
  INITIAL_BOOKINGS,
  INITIAL_GADGET_ORDERS,
  INITIAL_ARCHIVED_YEARS,
  INITIAL_STAFF,
  INITIAL_EVENTS,
  INITIAL_GADGETS,
  INITIAL_ROLES,
  INITIAL_ASSEMBLIES,
  INITIAL_GRANTS,
} from '../data/initialData';
import { calculateCashTotals } from './finance';
import { saveLocalSnapshot } from './localDb';
import { newId } from './ids';
import { todayIso } from './dates';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_ASSOCIATION_ID,
  deriveAssociationId,
  migrateState,
} from './migrations';

export type { AppState };
export { CURRENT_SCHEMA_VERSION, DEFAULT_ASSOCIATION_ID, deriveAssociationId, migrateState };

export function createDefaultAppState(activeYear = 2027): AppState {
  const profile: AssociationProfile = {
    ...INITIAL_ASSOCIATION_PROFILE,
    activeYear,
    associationId: deriveAssociationId(INITIAL_ASSOCIATION_PROFILE),
  };
  return migrateState(
    {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      version: 1,
      updatedAt: '',
      updatedBy: 'local',
      profile,
      initialFund: INITIAL_CASH_SUMMARY.initialFund,
      initialFundBank: INITIAL_CASH_SUMMARY.initialFundBank,
      initialFundCash: INITIAL_CASH_SUMMARY.initialFundCash,
      members: [...INITIAL_MEMBERS],
      transactions: [...INITIAL_TRANSACTIONS],
      recurringExpenses: [],
      events: [...INITIAL_EVENTS],
      bookings: [...INITIAL_BOOKINGS],
      gadgets: [...INITIAL_GADGETS],
      gadgetOrders: [...INITIAL_GADGET_ORDERS],
      staff: [...INITIAL_STAFF],
      staffPayments: [],
      roles: [...INITIAL_ROLES],
      assemblies: [...INITIAL_ASSEMBLIES],
      grants: [...INITIAL_GRANTS],
      archivedYears: [...INITIAL_ARCHIVED_YEARS],
      receipts: [],
    },
    activeYear
  );
}

export function resetToEmpty2027(
  _userEmail?: string | null,
  activeYear = 2027
): AppState {
  return createDefaultAppState(activeYear);
}

export function hydrateAppState(
  parsed?: Partial<AppState> & {
    governanceRoles?: AssociationRole[];
    recurringPlans?: RecurringExpensePlan[];
  } | null,
  fallbackYear = 2027
): AppState {
  if (!parsed || typeof parsed !== 'object') {
    return createDefaultAppState(fallbackYear);
  }
  return migrateState(parsed, fallbackYear);
}

/**
 * Increments the optimistic concurrency `version` counter (using `floorVersion` if higher than `state.version`)
 * and records `updatedAt` and `updatedBy`.
 */
export function bumpStateVersion(
  state: AppState,
  userEmail?: string | null,
  floorVersion?: number
): AppState {
  const currentVersion =
    typeof state.version === 'number' && Number.isFinite(state.version) && state.version >= 1
      ? Math.floor(state.version)
      : 1;
  const safeFloor =
    typeof floorVersion === 'number' && Number.isFinite(floorVersion) && floorVersion >= 1
      ? Math.floor(floorVersion)
      : 0;
  const baseVersion = Math.max(currentVersion, safeFloor);
  const cleanEmail = (userEmail || '').trim().toLowerCase() || state.updatedBy || 'local';
  const safeSchemaVersion =
    typeof state.schemaVersion === 'number' &&
    Number.isFinite(state.schemaVersion) &&
    state.schemaVersion > CURRENT_SCHEMA_VERSION
      ? Math.floor(state.schemaVersion)
      : CURRENT_SCHEMA_VERSION;
  return {
    ...state,
    schemaVersion: safeSchemaVersion,
    version: baseVersion + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: cleanEmail,
  };
}

/**
 * Synchronous initial state loader (never reads from shared localStorage keys).
 * Per-account IndexedDB snapshots are loaded asynchronously via `loadLocalSnapshot(email)` in `localDb.ts`.
 */
export function loadAppState(
  _userEmail?: string | null,
  activeYear = 2027
): AppState {
  return createDefaultAppState(activeYear);
}

/**
 * Persists an account-scoped snapshot into IndexedDB (never into localStorage, and never into a global key).
 */
export function saveAppState(state: AppState, userEmail?: string | null): void {
  if (!userEmail || !userEmail.trim()) return;
  void saveLocalSnapshot(userEmail.trim().toLowerCase(), state);
}

/**
 * Counts user-populated operational records (members, transactions, bookings, gadgetOrders, archivedYears)
 * to distinguish a populated database from an empty initial skeleton.
 */
export function countAppStateRecords(state?: Partial<AppState> | null): number {
  if (!state) return 0;
  return (
    (state.members?.length || 0) +
    (state.transactions?.length || 0) +
    (state.bookings?.length || 0) +
    (state.gadgetOrders?.length || 0) +
    (state.archivedYears?.length || 0) +
    (state.receipts?.length || 0)
  );
}

export interface YearTransitionMemberStats {
  totalMembersRetained: number;
  expiredCardsToRenewCount: number;
  stillValidTessera365Count: number;
}

function isCardValidForNewYear(member: Member, targetNewYear: number): boolean {
  if (member.cardValidityType !== 'tessera_365') return false;
  const exp = (member.expiryDate || '').trim();
  if (!exp) return false;
  const yearMatch = exp.match(/(\d{4})/);
  if (!yearMatch) return false;
  const expYear = Number(yearMatch[1]);
  return Number.isFinite(expYear) && expYear >= targetNewYear;
}

export function computeYearTransitionMemberStats(
  members: Member[],
  _closingYear: number,
  targetNewYear: number
): YearTransitionMemberStats {
  let stillValidTessera365Count = 0;
  let expiredCardsToRenewCount = 0;

  for (const m of members) {
    if (isCardValidForNewYear(m, targetNewYear)) {
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

export function archiveFiscalYearState(
  currentState: AppState,
  targetNewYear: number
): { nextState: AppState; archivedRecord: ArchivedFiscalYear } {
  const closingYear = currentState.profile.activeYear;
  const totals = calculateCashTotals(
    currentState.transactions,
    currentState.initialFund,
    currentState.initialFundBank,
    currentState.initialFundCash,
    {
      initialPaypal: currentState.profile.initialFundPaypal || 0,
      paymentAccounts: currentState.profile.paymentAccounts,
      paypalExpenseSourceAccount: currentState.profile.paypalExpenseSourceAccount,
      customPaymentAccounts: currentState.profile.customPaymentAccounts,
    }
  );

  const closingYearReceipts = Array.isArray(currentState.receipts)
    ? currentState.receipts
        .filter((r) => r && r.year === closingYear)
        .map((r) => ({ ...r }))
    : [];

  const archivedRecord: ArchivedFiscalYear = {
    id: newId(`arch-${closingYear}`),
    year: closingYear,
    archivedAt: todayIso(),
    summary: {
      initialFund: totals.initialFund,
      initialBankBalance: totals.initialBank,
      initialCashBalance: totals.initialCash,
      initialPaypalBalance: totals.initialPaypal,
      totalIncome: totals.totalIncome,
      totalExpense: totals.totalExpense,
      netBalance: totals.netBalance,
      finalTotalBalance: totals.currentTotal,
      finalBankBalance: totals.currentBank,
      finalCashBalance: totals.currentCash,
      finalPaypalBalance: totals.currentPaypal,
      customAccountBalances: totals.customAccountBalances.map((ca) => ({ ...ca })),
      membersCount: currentState.members.length,
      eventsCount: currentState.events.length,
      bookingsCount: currentState.bookings.length,
    },
    transactions: [...currentState.transactions],
    events: [...currentState.events],
    bookings: [...currentState.bookings],
    gadgetOrders: [...currentState.gadgetOrders],
    membersSnapshot: currentState.members.map((m) => ({ ...m })),
    receipts: closingYearReceipts,
  };

  // Transition members: retain all members in registry; archive solar cards into cardHistory while keeping valid Tessera 365
  const transitionedMembers: Member[] = currentState.members.map((m) => {
    const isValidInNewYear = isCardValidForNewYear(m, targetNewYear);

    const historyEntry: MemberCardRecord | null = m.membershipCardNumber
      ? {
          id: `card-${closingYear}-${m.id}`,
          cardNumber: m.membershipCardNumber,
          issueDate: m.cardIssueDate || `${closingYear}-01-01`,
          expiryDate: m.expiryDate || `${closingYear}-12-31`,
          validityType: m.cardValidityType || 'solare',
          insuranceType: m.insuranceType,
        }
      : null;

    const existingHistory = Array.isArray(m.cardHistory) ? [...m.cardHistory] : [];
    if (
      historyEntry &&
      !existingHistory.some((h) => h.cardNumber === historyEntry.cardNumber)
    ) {
      existingHistory.push(historyEntry);
    }

    if (isValidInNewYear) {
      return {
        ...m,
        cardHistory: existingHistory,
      };
    }

    return {
      ...m,
      isPaid: false,
      cardHistory: existingHistory,
    };
  });

  const nextCustomPaymentAccounts = Array.isArray(currentState.profile.customPaymentAccounts)
    ? currentState.profile.customPaymentAccounts.map((acc) => {
        const closingAcc = totals.customAccountBalances.find((cb) => cb.id === acc.id);
        return {
          ...acc,
          initialBalance: closingAcc ? closingAcc.currentBalance : acc.initialBalance,
        };
      })
    : currentState.profile.customPaymentAccounts;

  const safeSchemaVersion =
    typeof currentState.schemaVersion === 'number' &&
    Number.isFinite(currentState.schemaVersion) &&
    currentState.schemaVersion > CURRENT_SCHEMA_VERSION
      ? Math.floor(currentState.schemaVersion)
      : CURRENT_SCHEMA_VERSION;

  const nextState: AppState = {
    ...currentState,
    schemaVersion: safeSchemaVersion,
    version: (currentState.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    profile: {
      ...currentState.profile,
      activeYear: targetNewYear,
      initialFundPaypal: totals.currentPaypal,
      customPaymentAccounts: nextCustomPaymentAccounts,
    },
    initialFund: totals.currentTotal,
    initialFundBank: totals.currentBank,
    initialFundCash: totals.currentCash,
    members: transitionedMembers,
    transactions: [],
    bookings: [],
    gadgetOrders: [],
    archivedYears: [
      archivedRecord,
      ...currentState.archivedYears.filter((a) => a.year !== closingYear),
    ],
  };

  return { nextState, archivedRecord };
}

/**
 * Pure referential-integrity helper: deletes a member while preserving all historical accounting transactions,
 * bookings, gadget orders, and receipts (unlinking `memberId` to `undefined` and retaining `relatedMemberName`).
 */
export function deleteMemberFromState(state: AppState, memberId: string): AppState {
  const deletedMember = state.members.find((m) => m.id === memberId);
  return {
    ...state,
    members: state.members.filter((m) => m.id !== memberId),
    transactions: state.transactions.map((t) =>
      t.memberId === memberId
        ? {
            ...t,
            memberId: undefined,
            relatedMemberName: t.relatedMemberName || deletedMember?.childName,
          }
        : t
    ),
    bookings: state.bookings.map((b) =>
      b.memberId === memberId ? { ...b, memberId: undefined } : b
    ),
    gadgetOrders: state.gadgetOrders.map((o) =>
      o.memberId === memberId ? { ...o, memberId: undefined } : o
    ),
    receipts: (state.receipts || []).map((r) =>
      r.memberId === memberId ? { ...r, memberId: undefined } : r
    ),
  };
}

/**
 * Pure referential-integrity helper: deletes an event and its bookings while preserving all accounting
 * transactions and receipts (unlinking `relatedEventId` and `bookingId` to `undefined`).
 */
export function deleteEventFromState(state: AppState, eventId: string): AppState {
  const removedBookingIds = new Set(
    state.bookings.filter((b) => b.eventId === eventId).map((b) => b.id)
  );
  return {
    ...state,
    events: state.events.filter((e) => e.id !== eventId),
    bookings: state.bookings.filter((b) => b.eventId !== eventId),
    transactions: state.transactions.map((t) => {
      const clearEvent = t.relatedEventId === eventId;
      const clearBooking = Boolean(t.bookingId && removedBookingIds.has(t.bookingId));
      if (!clearEvent && !clearBooking) return t;
      return {
        ...t,
        ...(clearEvent ? { relatedEventId: undefined } : {}),
        ...(clearBooking ? { bookingId: undefined } : {}),
      };
    }),
    receipts: (state.receipts || []).map((r) =>
      r.bookingId && removedBookingIds.has(r.bookingId)
        ? { ...r, bookingId: undefined }
        : r
    ),
  };
}

/**
 * Pure referential-integrity helper: deletes an event booking, either deleting or unlinking its linked
 * transactions, and unlinking `bookingId` (plus any deleted `transactionId`) on emitted receipts.
 */
export function deleteBookingFromState(
  state: AppState,
  bookingId: string,
  alsoDeleteLinkedTransactions = false
): AppState {
  const deletedTxIds = alsoDeleteLinkedTransactions
    ? new Set(state.transactions.filter((t) => t.bookingId === bookingId).map((t) => t.id))
    : new Set<string>();

  return {
    ...state,
    bookings: state.bookings.filter((b) => b.id !== bookingId),
    transactions: alsoDeleteLinkedTransactions
      ? state.transactions.filter((t) => t.bookingId !== bookingId)
      : state.transactions.map((t) =>
          t.bookingId === bookingId ? { ...t, bookingId: undefined } : t
        ),
    receipts: (state.receipts || []).map((r) => {
      const clearBooking = r.bookingId === bookingId;
      const clearTx = Boolean(r.transactionId && deletedTxIds.has(r.transactionId));
      if (!clearBooking && !clearTx) return r;
      return {
        ...r,
        ...(clearBooking ? { bookingId: undefined } : {}),
        ...(clearTx ? { transactionId: undefined } : {}),
      };
    }),
  };
}

/**
 * Pure referential-integrity helper: deletes a gadget order while preserving accounting transactions
 * and receipts (unlinking `gadgetOrderId` to `undefined`).
 */
export function deleteGadgetOrderFromState(state: AppState, orderId: string): AppState {
  return {
    ...state,
    gadgetOrders: state.gadgetOrders.filter((o) => o.id !== orderId),
    transactions: state.transactions.map((t) =>
      t.gadgetOrderId === orderId ? { ...t, gadgetOrderId: undefined } : t
    ),
    receipts: (state.receipts || []).map((r) =>
      r.gadgetOrderId === orderId ? { ...r, gadgetOrderId: undefined } : r
    ),
  };
}

/**
 * Pure referential-integrity helper: deletes one or more transactions and unlinks `transactionId`
 * on any emitted receipts that referenced them.
 */
export function deleteTransactionsFromState(
  state: AppState,
  transactionIds: string[]
): AppState {
  if (!transactionIds || transactionIds.length === 0) return state;
  const idSet = new Set(transactionIds);
  return {
    ...state,
    transactions: state.transactions.filter((t) => !idSet.has(t.id)),
    receipts: (state.receipts || []).map((r) =>
      r.transactionId && idSet.has(r.transactionId)
        ? { ...r, transactionId: undefined }
        : r
    ),
  };
}

/**
 * Pure referential-integrity helper: deletes a staff collaborator while preserving all historical
 * accounting transactions (unlinking `staffId` to `undefined` and retaining `relatedMemberName`).
 */
export function deleteStaffMemberFromState(state: AppState, staffId: string): AppState {
  const deletedStaff = state.staff.find((s) => s.id === staffId);
  return {
    ...state,
    staff: state.staff.filter((s) => s.id !== staffId),
    transactions: state.transactions.map((t) =>
      t.staffId === staffId
        ? {
            ...t,
            staffId: undefined,
            relatedMemberName: t.relatedMemberName || deletedStaff?.name,
          }
        : t
    ),
  };
}

/**
 * Compact JSON serialization without indentation for fast internal autosave (IndexedDB / Drive SaveQueue).
 */
export function serializeAppStateCompact(state: AppState): string {
  return JSON.stringify(state);
}

/**
 * Pretty-printed JSON serialization with 2-space indentation for user-downloaded .json files.
 */
export function exportBackupJSON(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseBackupJSON(jsonString: string): AppState | null {
  try {
    if (!jsonString || !jsonString.trim()) return null;
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.profile && !Array.isArray(parsed.transactions) && !Array.isArray(parsed.members)) {
      return null;
    }
    return migrateState(parsed, parsed.profile?.activeYear || 2027);
  } catch {
    return null;
  }
}

export function downloadJsonBackup(data: AppState, customFileName?: string): void {
  const json = exportBackupJSON(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = todayIso();
  a.href = url;
  a.download = customFileName || `backup_apuacamp_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
