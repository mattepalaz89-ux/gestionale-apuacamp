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
} from '../types';

export const INITIAL_ASSOCIATION_PROFILE: AssociationProfile = {
  name: 'La Tua A.S.D.',
  legalType: 'Associazione Sportiva Dilettantistica',
  fiscalCode: '',
  address: '',
  president: '',
  iban: '',
  affiliation: 'Ente di Promozione Sportiva riconosciuto dal CONI / RASD',
  email: '',
  phone: '',
  activeYear: 2027,
};

export const INITIAL_MEMBERS: Member[] = [];

export const INITIAL_TRANSACTIONS: CashTransaction[] = [];

export const INITIAL_BOOKINGS: EventBooking[] = [];

export const INITIAL_GADGET_ORDERS: GadgetOrder[] = [];

export const INITIAL_ARCHIVED_YEARS: ArchivedFiscalYear[] = [];

export const INITIAL_CASH_SUMMARY = {
  initialFund: 0.0,
  initialFundBank: 0.0,
  initialFundCash: 0.0,
};

export const INITIAL_STAFF: StaffMember[] = [];

export const INITIAL_EVENTS: EventItem[] = [];

export const INITIAL_GADGETS: GadgetItem[] = [];

export const INITIAL_ROLES: AssociationRole[] = [];

export const INITIAL_ASSEMBLIES: AssemblyMeeting[] = [];

export const INITIAL_GRANTS: GrantItem[] = [];
