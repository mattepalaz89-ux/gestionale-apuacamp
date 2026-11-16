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
  name: 'Apuacamp A.S.D.',
  legalType: 'Associazione Sportiva Dilettantistica',
  fiscalCode: '92040180455',
  address: 'Via delle Alpi Apuane, 54100 Massa (MS)',
  president: 'Matteo Palazzi',
  iban: 'IT89A0306912345100000012345',
  affiliation: 'US ACLI (Ente di Promozione Sportiva riconosciuto dal CONI / RASD)',
  email: 'info@apuacamp.it',
  phone: '+39 349 0000000',
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

export const INITIAL_STAFF: StaffMember[] = [
  {
    id: 'st-01',
    name: 'Matteo Palazzi',
    role: 'Presidente / Guida Ambientale Escursionistica / Responsabile Tecnico',
    phone: '3281234567',
    email: 'matte.palaz89@gmail.com',
  },
  {
    id: 'st-02',
    name: 'Sara Ferrari',
    role: 'Coordinatrice Pedagogica / Educatrice Outdoor',
    phone: '3291234568',
    email: 'sara@apuacamp.it',
  },
  {
    id: 'st-03',
    name: 'Margherita (Lucia Ceccarelli)',
    role: 'Educatrice Outdoor / Istruttrice Attività Sportive',
    phone: '3471234569',
    email: 'margherita@apuacamp.it',
  },
  {
    id: 'st-04',
    name: 'Emma Sigismondi',
    role: 'Educatrice Campus & Assistente Guide',
    phone: '3481234570',
    email: 'emma@apuacamp.it',
  },
  {
    id: 'st-05',
    name: 'Semma',
    role: 'Animatrice e Supporto Logistico Campus',
    phone: '3391234571',
    email: 'semma@apuacamp.it',
  },
  {
    id: 'st-06',
    name: 'Nicola De Luca',
    role: 'Istruttore Outdoor / Progetto Branco',
    phone: '3331234572',
    email: 'nicola@apuacamp.it',
  },
];

export const INITIAL_EVENTS: EventItem[] = [
  {
    id: 'ev-2027-01',
    name: 'Invernale in Rifugio - Forte dei Marmi 2027',
    category: 'rifugio',
    date: '2027-02-06',
    location: 'Alpi Apuane - Rifugio Forte dei Marmi',
    ageGroups: '6-11 anni, 11-14 anni',
    conditions: 'Tessera US ACLI attiva obbligatoria, sacco a pelo e scarponcini da trekking.',
    depositDefault: 65,
    memberPrice: 130,
    nonMemberPrice: 140,
    status: 'aperto',
    notes: 'Uscita invernale con pernottamento in rifugio.',
    targetStaffCount: 3,
  },
  {
    id: 'ev-2027-02',
    name: 'Selva Academy - Percorso Mensile 2027',
    category: 'selva',
    date: '2027-03-01',
    location: 'Massa e boschi Apuani',
    ageGroups: '3-6 anni, 6-11 anni',
    conditions: 'Iscrizione mensile continuativa, abbigliamento antipioggia e cambio completo.',
    depositDefault: 30,
    memberPrice: 60,
    nonMemberPrice: 70,
    status: 'aperto',
    notes: 'Attività sportiva ed educativa continuativa mensile in natura.',
    targetStaffCount: 2,
  },
  {
    id: 'ev-2027-03',
    name: 'Trekking Rifugio Del Freo 2027',
    category: 'rifugio',
    date: '2027-04-17',
    location: 'Mosceta - Pania della Croce',
    ageGroups: '6-11 anni, 11-14 anni',
    conditions: 'Caparra € 70 alla prenotazione, saldo entro 7 giorni dalla partenza.',
    depositDefault: 70,
    memberPrice: 130,
    nonMemberPrice: 140,
    status: 'aperto',
    notes: 'Trekking primaverile di due giorni con pernottamento.',
    targetStaffCount: 3,
  },
  {
    id: 'ev-2027-04',
    name: 'Summer Camp Apuacamp 2027',
    category: 'summer_camp',
    date: '2027-06-14',
    location: 'Massa e vallate Apuane',
    ageGroups: '3-6 anni, 6-11 anni, 11-14 anni',
    conditions: 'Sconto fratelli 10% sulla seconda quota. Richiesta copertura assicurativa Summer/Gold/Platinum.',
    depositDefault: 85,
    memberPrice: 185,
    nonMemberPrice: 210,
    status: 'aperto',
    notes: 'Campi estivi settimanali outdoor per bambini e ragazzi.',
    targetStaffCount: 4,
  },
  {
    id: 'ev-2027-05',
    name: 'Wild Camp - Avventura in Tenda & Grotte 2027',
    category: 'wild_camp',
    date: '2027-08-02',
    location: 'Lunigiana & Alpi Apuane',
    ageGroups: '11-14 anni',
    conditions: 'Esperienza residenziale per ragazzi 11-14 anni; richiesta tessera Gold o Platinum.',
    depositDefault: 100,
    memberPrice: 225,
    nonMemberPrice: 250,
    status: 'aperto',
    notes: 'Esperienza residenziale itinerante in tenda e speleologia.',
    targetStaffCount: 3,
  },
];

export const INITIAL_GADGETS: GadgetItem[] = [
  {
    id: 'gd-01',
    name: 'Maglietta Tecnica / Cotone Apuacamp',
    category: 'abbigliamento',
    unitPrice: 15.0,
    variants: 'Taglie: 5-6, 7-8, 9-11, 12-14, S, M, L, XL',
    stockCount: 50,
  },
  {
    id: 'gd-02',
    name: 'Tazza Smaltata da Rifugio Apuacamp',
    category: 'accessori',
    unitPrice: 10.0,
    variants: 'Misura unica da zaino con moschettone',
    stockCount: 35,
  },
  {
    id: 'gd-03',
    name: 'Cappellino / Bandana Outdoor',
    category: 'abbigliamento',
    unitPrice: 12.0,
    variants: 'Taglia Junior / Adulto',
    stockCount: 30,
  },
  {
    id: 'gd-04',
    name: 'Sacco Speleo / Zainetto Impermeabile',
    category: 'attrezzatura',
    unitPrice: 25.0,
    variants: 'Modello 20L Speleo',
    stockCount: 15,
  },
];

export const INITIAL_ROLES: AssociationRole[] = [
  {
    id: 'role-01',
    roleTitle: 'Presidente e Legale Rappresentante',
    category: 'consiglio_direttivo',
    personName: 'Matteo Palazzi',
    phone: '3281234567',
    email: 'matte.palaz89@gmail.com',
    appointmentDate: '2024-01-15',
    expiryDate: '2028-01-15',
    notes: 'Mandato quadriennale Consiglio Direttivo',
  },
  {
    id: 'role-02',
    roleTitle: 'Vicepresidente / Consigliere',
    category: 'consiglio_direttivo',
    personName: 'Sara Ferrari',
    phone: '3291234568',
    email: 'sara@apuacamp.it',
    appointmentDate: '2024-01-15',
    expiryDate: '2028-01-15',
    notes: 'Coordinamento pedagogico e segreteria',
  },
  {
    id: 'role-03',
    roleTitle: 'Consigliere / Tesoriere',
    category: 'consiglio_direttivo',
    personName: 'Lucia Ceccarelli (Margherita)',
    phone: '3471234569',
    email: 'margherita@apuacamp.it',
    appointmentDate: '2024-01-15',
    expiryDate: '2028-01-15',
    notes: 'Gestione tesseramenti e attività sportive',
  },
  {
    id: 'role-04',
    roleTitle: 'Responsabile Tutela dei Minori (Safeguarding Officer)',
    category: 'tutela_minori_safeguarding',
    personName: 'Da verificare / Rinnovare nomina annuale',
    phone: '',
    email: 'safeguarding@apuacamp.it',
    appointmentDate: '2024-07-01',
    expiryDate: '2026-12-31',
    notes: 'Nomina obbligatoria D.Lgs. 39/2021 e delibera CONI per prevenzione abusi e tutela minori (MOG e Codice di Condotta).',
  },
  {
    id: 'role-05',
    roleTitle: 'Responsabile Sicurezza e Primo Soccorso (RSPP / Emergenze)',
    category: 'sicurezza_rspp',
    personName: 'Matteo Palazzi',
    phone: '3281234567',
    email: 'info@apuacamp.it',
    appointmentDate: '2025-01-10',
    expiryDate: '2027-01-10',
    notes: 'Verifica periodica kit primo soccorso, DPI speleo, BLSD e protocolli allergie/adrenalina.',
  },
];

export const INITIAL_ASSEMBLIES: AssemblyMeeting[] = [
  {
    id: 'asm-2026-bilancio',
    fiscalYear: 2026,
    title: 'Assemblea Ordinaria Soci - Approvazione Rendiconto Economico-Finanziario 2026',
    type: 'ordinaria_rendiconto',
    scheduledDate: '2027-04-15',
    approvalDeadline: '2027-04-30',
    status: 'da_convocare',
    minutesSummary:
      'Approvazione del rendiconto economico-finanziario dell\'esercizio chiuso al 31/12/2026 (entro 120 giorni dalla chiusura dell\'esercizio sociale) e relazione sulle attività istituzionali.',
  },
  {
    id: 'asm-2027-programmazione',
    fiscalYear: 2027,
    title: 'Riunione Consiglio Direttivo - Quote Associative, Assicurazioni UsAcli e Calendario 2027',
    type: 'consiglio_direttivo',
    scheduledDate: '2027-01-10',
    approvalDeadline: '2027-01-31',
    status: 'da_convocare',
    minutesSummary:
      'Delibera quote tesseramento 2027 (Base, Summer, Gold, Platinum), calendario uscite, campi estivi e incarichi collaboratori sportivi.',
  },
];

export const INITIAL_GRANTS: GrantItem[] = [
  {
    id: 'bando-2027-01',
    title: 'Bando Educazione Outdoor & Sport in Natura 2027',
    promoter: 'Regione Toscana / Sport e Salute',
    submissionDeadline: '2027-03-31',
    reportingDeadline: '2027-11-30',
    status: 'in_preparazione',
    requestedAmount: 8500,
    approvedAmount: 0,
    keyCharacteristics:
      'Finanziamento a fondo perduto fino all\'80% per progetti sportivi dilettantistici rivolti a minori 3-14 anni in ambiente naturale. Spese ammissibili: compensi collaboratori sportivi, acquisto attrezzature outdoor/speleo, trasporti e coperture assicurative.',
    usefulContacts:
      'Ufficio Sport e Terzo Settore — Dott.ssa Bianchi (bandisport@regione.toscana.it - Tel. 055 4382111)',
    portalUrl: 'https://www.regione.toscana.it/bandi',
    documents: [
      {
        id: 'doc-b1',
        name: 'Avviso_Pubblico_Sport_Natura_2027.pdf',
        category: 'bando_avviso',
        uploadedAt: '2027-01-10',
        notes: 'Testo ufficiale del bando e griglia punteggi',
      },
    ],
    notes: 'Allegare statuto ASD registrato, certificato iscrizione RASD e verbale direttivo di approvazione progetto.',
  },
];
