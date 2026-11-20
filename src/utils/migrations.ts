import {
  AppState,
  AssociationProfile,
  AssociationRole,
  AssemblyMeeting,
  ArchivedFiscalYear,
  CashTransaction,
  EventBooking,
  EventItem,
  GadgetItem,
  GadgetOrder,
  GrantItem,
  Member,
  RecurringExpensePlan,
  StaffMember,
  StaffPayment,
  CardTypeConfig,
  AgeGroupConfig,
  CashCategoryConfig,
  EventCategoryConfig,
  DeadlineTemplateConfig,
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
import { parseToIsoDate } from './dates';

export const CURRENT_SCHEMA_VERSION = 2;
export const DEFAULT_ASSOCIATION_ID = 'asd-apuacamp';

export const DEFAULT_CARD_TYPES: CardTypeConfig[] = [
  { id: 'Base', label: 'Tessera Base', defaultPrice: 10, color: '#059669' },
  { id: 'Summer', label: 'Tessera Summer / Estiva', defaultPrice: 10, color: '#d97706' },
  { id: 'Gold', label: 'Tessera Gold / Integrativa', defaultPrice: 15, color: '#eab308' },
  { id: 'Platinum', label: 'Tessera Platinum / Completa', defaultPrice: 20, color: '#4f46e5' },
];

export const DEFAULT_AGE_GROUPS: AgeGroupConfig[] = [
  { id: '3-6', label: '3-6 anni', minAge: 3, maxAge: 6 },
  { id: '6-11', label: '6-11 anni', minAge: 6, maxAge: 11 },
  { id: '11-14', label: '11-14 anni', minAge: 11, maxAge: 14 },
];

export const DEFAULT_CASH_CATEGORIES: CashCategoryConfig[] = [
  { id: 'Evento', label: 'Evento', kind: 'entrambe' },
  { id: 'SummerCamp', label: 'SummerCamp / Campi Estivi', kind: 'entrambe' },
  { id: 'Selva', label: 'Selva / Doposcuola / Corsi', kind: 'entrambe' },
  { id: 'Tessere', label: 'Tessere Associative', kind: 'entrambe' },
  { id: 'Staff', label: 'Staff & Collaboratori', kind: 'uscita' },
  { id: 'Tasse e Formalità', label: 'Tasse e Formalità', kind: 'uscita' },
  { id: 'Servizi esterni', label: 'Servizi esterni', kind: 'uscita' },
  { id: 'Acquisto Strumenti', label: 'Acquisto Strumenti', kind: 'uscita' },
  { id: 'Gadget', label: 'Gadget Associativi', kind: 'entrambe' },
  { id: 'Marketing', label: 'Marketing & Comunicazione', kind: 'uscita' },
  { id: 'Bandi e Fondi Pubbl', label: 'Bandi e Fondi Pubblici', kind: 'entrata' },
  { id: 'Donazioni enti', label: 'Donazioni & Contributi', kind: 'entrata' },
  { id: 'Altro', label: 'Altro', kind: 'entrambe' },
];

export const DEFAULT_EVENT_CATEGORIES: EventCategoryConfig[] = [
  { id: 'rifugio', label: 'Rifugio / Weekend', cashCategoryId: 'Evento' },
  { id: 'summer_camp', label: 'Summer Camp', cashCategoryId: 'SummerCamp' },
  { id: 'wild_camp', label: 'Wild Camp', cashCategoryId: 'SummerCamp' },
  { id: 'selva', label: 'Selva / Doposcuola', cashCategoryId: 'Selva' },
  { id: 'giornata', label: 'Uscita Giornata', cashCategoryId: 'Evento' },
  { id: 'altro', label: 'Altra Attività', cashCategoryId: 'Evento' },
];

export const DEFAULT_DEADLINE_TEMPLATES_US_ACLI: DeadlineTemplateConfig[] = [
  {
    id: 'tpl-affiliazione-usacli',
    title: 'Rinnovo Affiliazione Annuale US ACLI & Registro RASD',
    month: 9,
    day: 1,
    recurrence: 'annuale',
    enabled: true,
  },
  {
    id: 'tpl-rendiconto-annuale',
    title: 'Approvazione Rendiconto Economico-Finanziario Annuale (Assemblea Soci)',
    month: 4,
    day: 30,
    recurrence: 'annuale',
    enabled: true,
  },
  {
    id: 'tpl-inps-rasd-mensile',
    title: 'Comunicazione INPS & RASD Lavoro Sportivo (fine mese)',
    month: 12,
    day: 31,
    recurrence: 'mensile',
    enabled: true,
  },
  {
    id: 'tpl-cu-770',
    title: 'Certificazione Unica (CU) Lavoratori Sportivi',
    month: 3,
    day: 16,
    recurrence: 'annuale',
    enabled: true,
  },
];

export const DEFAULT_DEADLINE_TEMPLATES_GENERIC_ASD: DeadlineTemplateConfig[] = [
  {
    id: 'tpl-affiliazione-ente',
    title: 'Rinnovo Affiliazione Annuale EPS/FSN & Registro Nazionale RASD',
    month: 9,
    day: 1,
    recurrence: 'annuale',
    enabled: true,
  },
  {
    id: 'tpl-rendiconto-annuale',
    title: 'Approvazione Rendiconto Economico-Finanziario Annuale (Assemblea Soci)',
    month: 4,
    day: 30,
    recurrence: 'annuale',
    enabled: true,
  },
  {
    id: 'tpl-inps-rasd-mensile',
    title: 'Comunicazione INPS & RASD Lavoro Sportivo (fine mese)',
    month: 12,
    day: 31,
    recurrence: 'mensile',
    enabled: true,
  },
  {
    id: 'tpl-cu-770',
    title: 'Certificazione Unica (CU) Lavoratori Sportivi',
    month: 3,
    day: 16,
    recurrence: 'annuale',
    enabled: true,
  },
];

export function deriveAssociationId(profile?: Partial<AssociationProfile>): string {
  if (profile?.associationId && profile.associationId.trim().length > 0) {
    return profile.associationId.trim();
  }
  const fiscalCode = (profile?.fiscalCode || '').trim();
  if (fiscalCode) {
    return `asd-${fiscalCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }
  const name = (profile?.name || '').trim();
  if (name) {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || DEFAULT_ASSOCIATION_ID
    );
  }
  return DEFAULT_ASSOCIATION_ID;
}

function normalizeDatePreservingOriginal(
  val: string | undefined,
  fallbackYear?: number
): string {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed) return '';
  const iso = parseToIsoDate(trimmed, fallbackYear);
  return iso ?? trimmed;
}

function normalizeOptionalDatePreservingOriginal(
  val: string | undefined,
  fallbackYear?: number
): string | undefined {
  if (val === undefined) return undefined;
  return normalizeDatePreservingOriginal(val, fallbackYear);
}

/**
 * Step v1 -> v2 migration:
 * - Normalizes date fields across members, transactions, events, gadgetOrders, roles, assemblies, grants, and recurringExpenses
 *   into `'YYYY-MM-DD'` while preserving any unparseable string untouched.
 * - Initializes `version`, `updatedAt`, `updatedBy`, `receipts: []`, and `schemaVersion: 2`.
 */
function migrateV1ToV2(state: AppState): AppState {
  const activeYear = state.profile?.activeYear || 2027;

  const members: Member[] = (state.members || []).map((m) => ({
    ...m,
    isMinor: m.isMinor ?? true,
    birthDate: normalizeDatePreservingOriginal(m.birthDate),
    cardIssueDate: normalizeOptionalDatePreservingOriginal(m.cardIssueDate, activeYear),
    expiryDate: normalizeDatePreservingOriginal(m.expiryDate, activeYear),
    cardHistory: Array.isArray(m.cardHistory)
      ? m.cardHistory.map((ch) => ({
          ...ch,
          issueDate: normalizeDatePreservingOriginal(ch.issueDate, activeYear),
          expiryDate: normalizeDatePreservingOriginal(ch.expiryDate, activeYear),
        }))
      : m.cardHistory,
  }));

  const transactions: CashTransaction[] = (state.transactions || []).map((tx) => ({
    ...tx,
    date: normalizeDatePreservingOriginal(tx.date, activeYear),
    recurringOccurrenceDate: normalizeOptionalDatePreservingOriginal(
      tx.recurringOccurrenceDate,
      activeYear
    ),
  }));

  const recurringExpenses: RecurringExpensePlan[] = (state.recurringExpenses || []).map(
    (plan) => ({
      ...plan,
      startDate: normalizeDatePreservingOriginal(plan.startDate, activeYear),
      endDate: normalizeOptionalDatePreservingOriginal(plan.endDate, activeYear),
    })
  );

  const events: EventItem[] = (state.events || []).map((ev) => ({
    ...ev,
    date: normalizeDatePreservingOriginal(ev.date, activeYear),
    endDate: normalizeOptionalDatePreservingOriginal(ev.endDate, activeYear),
  }));

  const gadgetOrders: GadgetOrder[] = (state.gadgetOrders || []).map((go) => ({
    ...go,
    date: normalizeDatePreservingOriginal(go.date, activeYear),
  }));

  const roles: AssociationRole[] = (state.roles || []).map((r) => ({
    ...r,
    appointmentDate: normalizeDatePreservingOriginal(r.appointmentDate, activeYear),
    expiryDate: normalizeDatePreservingOriginal(r.expiryDate, activeYear),
  }));

  const assemblies: AssemblyMeeting[] = (state.assemblies || []).map((asm) => ({
    ...asm,
    scheduledDate: normalizeDatePreservingOriginal(asm.scheduledDate, asm.fiscalYear || activeYear),
    approvalDeadline: normalizeDatePreservingOriginal(
      asm.approvalDeadline,
      asm.fiscalYear || activeYear
    ),
  }));

  const grants: GrantItem[] = (state.grants || []).map((g) => ({
    ...g,
    submissionDeadline: normalizeDatePreservingOriginal(g.submissionDeadline, activeYear),
    reportingDeadline: normalizeDatePreservingOriginal(g.reportingDeadline, activeYear),
  }));

  const receipts = Array.isArray(state.receipts)
    ? state.receipts.map((r) => ({
        ...r,
        issueDate: normalizeDatePreservingOriginal(r.issueDate, r.year || activeYear),
      }))
    : [];

  return {
    ...state,
    schemaVersion: 2,
    members,
    transactions,
    recurringExpenses,
    events,
    gadgetOrders,
    roles,
    assemblies,
    grants,
    receipts,
  };
}

/**
 * Pure, idempotent schema migration function.
 * Accepts any raw JSON object (v1 without `schemaVersion` or v2) and upgrades it to `CURRENT_SCHEMA_VERSION`
 * without ever discarding fields or silently corrupting unparseable dates.
 */
export function migrateState(raw: unknown, fallbackYear = 2027): AppState {
  const parsed =
    raw && typeof raw === 'object'
      ? (raw as Partial<AppState> & {
          governanceRoles?: AssociationRole[];
          recurringPlans?: RecurringExpensePlan[];
        })
      : {};

  const mergedProfile: AssociationProfile = {
    ...INITIAL_ASSOCIATION_PROFILE,
    activeYear: fallbackYear,
    ...(parsed.profile || {}),
  };
  mergedProfile.associationId = deriveAssociationId(mergedProfile);
  if (!Array.isArray(mergedProfile.cardTypes) || mergedProfile.cardTypes.length === 0) {
    mergedProfile.cardTypes = DEFAULT_CARD_TYPES.map((c) => ({ ...c }));
  }
  if (!Array.isArray(mergedProfile.ageGroups) || mergedProfile.ageGroups.length === 0) {
    mergedProfile.ageGroups = DEFAULT_AGE_GROUPS.map((g) => ({ ...g }));
  }
  if (!Array.isArray(mergedProfile.cashCategories) || mergedProfile.cashCategories.length === 0) {
    mergedProfile.cashCategories = DEFAULT_CASH_CATEGORIES.map((c) => ({ ...c }));
  }
  if (!Array.isArray(mergedProfile.eventCategories) || mergedProfile.eventCategories.length === 0) {
    mergedProfile.eventCategories = DEFAULT_EVENT_CATEGORIES.map((c) => ({ ...c }));
  }
  if (
    !Array.isArray(mergedProfile.deadlineTemplates) ||
    mergedProfile.deadlineTemplates.length === 0
  ) {
    const isUsAcli = (mergedProfile.affiliation || '').toUpperCase().includes('ACLI');
    mergedProfile.deadlinePreset = mergedProfile.deadlinePreset || (isUsAcli ? 'us_acli' : 'asd_generica');
    mergedProfile.deadlineTemplates = (
      mergedProfile.deadlinePreset === 'us_acli'
        ? DEFAULT_DEADLINE_TEMPLATES_US_ACLI
        : DEFAULT_DEADLINE_TEMPLATES_GENERIC_ASD
    ).map((d) => ({ ...d }));
  }
  if (mergedProfile.digitalCardConfig?.backgroundRawPdfDataUrl) {
    const { backgroundRawPdfDataUrl: _unusedRawPdf, ...cleanCardConfig } =
      mergedProfile.digitalCardConfig;
    mergedProfile.digitalCardConfig = cleanCardConfig;
  }

  const rawVersion =
    typeof parsed.version === 'number' && Number.isFinite(parsed.version) && parsed.version >= 1
      ? Math.floor(parsed.version)
      : 1;

  const rawUpdatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '';

  const rawUpdatedBy =
    typeof parsed.updatedBy === 'string' && parsed.updatedBy.trim().length > 0
      ? parsed.updatedBy.trim()
      : 'local';

  const initialFundBank =
    typeof parsed.initialFundBank === 'number'
      ? parsed.initialFundBank
      : typeof parsed.initialFund === 'number'
        ? parsed.initialFund
        : INITIAL_CASH_SUMMARY.initialFundBank;

  const initialFundCash =
    typeof parsed.initialFundCash === 'number'
      ? parsed.initialFundCash
      : INITIAL_CASH_SUMMARY.initialFundCash;

  const initialFundPaypal =
    typeof mergedProfile.initialFundPaypal === 'number'
      ? mergedProfile.initialFundPaypal
      : 0;

  const customInitialSum = Array.isArray(mergedProfile.customPaymentAccounts)
    ? mergedProfile.customPaymentAccounts.reduce(
        (acc, ca) => acc + (Number(ca?.initialBalance) || 0),
        0
      )
    : 0;

  const realignedInitialFund = Number(
    (initialFundBank + initialFundCash + initialFundPaypal + customInitialSum).toFixed(2)
  );

  if (
    typeof parsed.initialFund === 'number' &&
    Math.abs(parsed.initialFund - realignedInitialFund) >= 0.01 &&
    !mergedProfile.initialFundMismatchNotice
  ) {
    mergedProfile.initialFundMismatchNotice = {
      oldInitialFund: parsed.initialFund,
      realignedInitialFund,
    };
  }

  const initialFund = realignedInitialFund;

  const rolesList = Array.isArray(parsed.roles)
    ? (parsed.roles as AssociationRole[])
    : Array.isArray(parsed.governanceRoles)
      ? (parsed.governanceRoles as AssociationRole[])
      : [...INITIAL_ROLES];

  const recurringList = Array.isArray(parsed.recurringExpenses)
    ? (parsed.recurringExpenses as RecurringExpensePlan[])
    : Array.isArray(parsed.recurringPlans)
      ? (parsed.recurringPlans as RecurringExpensePlan[])
      : [];

  const incomingSchemaVersion =
    typeof parsed.schemaVersion === 'number' && Number.isFinite(parsed.schemaVersion)
      ? Math.floor(parsed.schemaVersion)
      : 1;

  let baseState: AppState = {
    ...(parsed as Record<string, unknown>),
    schemaVersion: incomingSchemaVersion,
    version: rawVersion,
    updatedAt: rawUpdatedAt,
    updatedBy: rawUpdatedBy,
    profile: mergedProfile,
    initialFund,
    initialFundBank,
    initialFundCash,
    members: Array.isArray(parsed.members) ? (parsed.members as Member[]) : [...INITIAL_MEMBERS],
    transactions: Array.isArray(parsed.transactions)
      ? (parsed.transactions as CashTransaction[])
      : [...INITIAL_TRANSACTIONS],
    recurringExpenses: recurringList,
    events: Array.isArray(parsed.events) ? (parsed.events as EventItem[]) : [...INITIAL_EVENTS],
    bookings: Array.isArray(parsed.bookings)
      ? (parsed.bookings as EventBooking[])
      : [...INITIAL_BOOKINGS],
    gadgets: Array.isArray(parsed.gadgets) ? (parsed.gadgets as GadgetItem[]) : [...INITIAL_GADGETS],
    gadgetOrders: Array.isArray(parsed.gadgetOrders)
      ? (parsed.gadgetOrders as GadgetOrder[])
      : [...INITIAL_GADGET_ORDERS],
    staff: Array.isArray(parsed.staff) ? (parsed.staff as StaffMember[]) : [...INITIAL_STAFF],
    staffPayments: Array.isArray(parsed.staffPayments)
      ? (parsed.staffPayments as StaffPayment[])
      : [],
    roles: rolesList,
    assemblies: Array.isArray(parsed.assemblies)
      ? (parsed.assemblies as AssemblyMeeting[])
      : [...INITIAL_ASSEMBLIES],
    grants: Array.isArray(parsed.grants) ? (parsed.grants as GrantItem[]) : [...INITIAL_GRANTS],
    archivedYears: Array.isArray(parsed.archivedYears)
      ? (parsed.archivedYears as ArchivedFiscalYear[])
      : [...INITIAL_ARCHIVED_YEARS],
    receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
  };

  if (baseState.schemaVersion < 2) {
    baseState = migrateV1ToV2(baseState);
  }

  // Always run v1->v2 date & field normalization idempotently even if schemaVersion was already 2
  baseState = {
    ...migrateV1ToV2(baseState),
    schemaVersion: Math.max(baseState.schemaVersion, CURRENT_SCHEMA_VERSION),
  };

  return baseState;
}
