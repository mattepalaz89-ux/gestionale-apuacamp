export type BuiltInInsuranceType = 'Base' | 'Summer' | 'Gold' | 'Platinum';
export type InsuranceType = BuiltInInsuranceType | (string & {});

export type BuiltInAgeGroup = '3-6' | '6-11' | '11-14';
export type AgeGroup = BuiltInAgeGroup | (string & {});

export type CardValidityType = 'solare' | 'tessera_365';

export interface CardTypeConfig {
  id: string;
  label: string;
  defaultPrice?: number;
  color?: string;
}

export interface AgeGroupConfig {
  id: string;
  label: string;
  minAge?: number;
  maxAge?: number;
}

export interface CashCategoryConfig {
  id: string;
  label: string;
  kind: 'entrata' | 'uscita' | 'entrambe';
}

export interface EventCategoryConfig {
  id: string;
  label: string;
  cashCategoryId: string;
}

export interface DeadlineTemplateConfig {
  id: string;
  title: string;
  month: number;
  day: number;
  recurrence: 'annuale' | 'mensile';
  enabled: boolean;
}

export interface MemberCardRecord {
  id: string;
  cardNumber: string;
  issueDate: string; // DD/MM/YYYY or YYYY-MM-DD
  expiryDate: string; // DD/MM/YYYY
  validityType: CardValidityType;
  insuranceType: InsuranceType;
  amountPaid?: number;
  notes?: string;
}

export interface Member {
  id: string;
  isMinor?: boolean; // default true per retrocompatibilità; se false: socio adulto (campi genitore non obbligatori)
  childName: string;
  birthDate: string;
  birthPlace: string;
  group: AgeGroup;
  childFiscalCode: string;
  childAddress: string;
  parentName: string;
  parentFiscalCode: string;
  parentPhone: string;
  parentEmail: string;
  membershipCardNumber: string;
  isPaid: boolean;
  cardIssueDate?: string;
  expiryDate: string;
  cardValidityType?: CardValidityType;
  insuranceType: InsuranceType;
  photoConsent: boolean;
  allergies: string;
  notesConditions: string;
  formSignedAndArchived: boolean;
  signedFormSentAt?: string;
  voucherBalance?: number; // Buono spesa disponibile (€) per compensare i costi delle attività in tutto o in parte
  voucherNotes?: string; // Note sul buono (es. "Buono recupero uscita pioggia" o "Bonus famiglia")
  needsLevelUp?: boolean | string;
  confirmationEmailSent?: boolean;
  confirmationEmailSentAt?: string;
  googleFormResponseId?: string;
  cardHistory?: MemberCardRecord[];
  createdAt?: string;
}

export type BuiltInCashCategory =
  | 'Evento'
  | 'SummerCamp'
  | 'Selva'
  | 'Tessere'
  | 'Staff'
  | 'Tasse e Formalità'
  | 'Servizi esterni'
  | 'Acquisto Strumenti'
  | 'Gadget'
  | 'Marketing'
  | 'Bandi e Fondi Pubbl'
  | 'Donazioni enti'
  | 'Altro';

export type CashCategory = BuiltInCashCategory | (string & {});

export type PaymentMethod =
  | 'Bonifico'
  | 'Contanti'
  | 'POS'
  | 'Bancomat'
  | 'Paypal'
  | 'Pagam Online';

export type RecurringExpenseFrequency =
  | 'mensile'
  | 'bimestrale'
  | 'trimestrale'
  | 'semestrale'
  | 'annuale';

export type RecurringExpenseDurationMode =
  | 'indeterminata'
  | 'numero_rate'
  | 'fino_a_data';

export interface RecurringExpensePlan {
  id: string;
  title: string;
  category: CashCategory;
  amount: number;
  method: PaymentMethod;
  frequency: RecurringExpenseFrequency;
  durationMode: RecurringExpenseDurationMode;
  startDate: string; // YYYY-MM-DD (data prima rata / decorrenza)
  maxInstallments?: number; // se durationMode === 'numero_rate' (es. 6 mesi, 12 rate, 36 rate)
  endDate?: string; // YYYY-MM-DD se durationMode === 'fino_a_data'
  active: boolean;
  notes?: string;
}

export type StaffPaymentKind =
  | 'compenso_sportivo'
  | 'servizi_guida'
  | 'progettazione'
  | 'rimborso_spese';

export type BuiltInPaymentAccountId = 'banca' | 'paypal' | 'cassa';
export type PaymentAccountId = BuiltInPaymentAccountId | string;

export interface CustomPaymentAccount {
  id: string;
  name: string;
  initialBalance: number;
}

export type PaymentAccountsMap = Partial<Record<PaymentMethod | string, PaymentAccountId>>;

export interface StaffThresholdsConfig {
  inpsExemption: number; // default 5000 (soglia contributiva INPS D.Lgs. 36/2021)
  irpefExemption: number; // default 15000 (soglia fiscale IRPEF D.Lgs. 36/2021)
  warningPercent: number; // default 80 (80% di 5000 = 4000 €)
}

export interface CashTransaction {
  id: string;
  date: string; // ISO "YYYY-MM-DD" or "DD/MM/YYYY"
  category: CashCategory;
  income: number | null;
  expense: number | null;
  method: PaymentMethod;
  description: string;
  memberId?: string;
  bookingId?: string;
  staffId?: string;
  gadgetOrderId?: string;
  receiptId?: string;
  staffPaymentKind?: StaffPaymentKind;
  accountId?: PaymentAccountId; // Conto effettivo movimentato (es. 'banca', 'paypal', 'cassa' o conto personalizzato)
  relatedMemberName?: string;
  relatedEventId?: string;
  invoiceArchivedUrl?: string;
  invoiceFileName?: string;
  recurringPlanId?: string;
  recurringOccurrenceDate?: string;
  recurringInstallmentNumber?: number;
}

export type EventDiscountType = 'none' | 'fixed' | 'percent';

export type BuiltInEventCategory =
  | 'rifugio'
  | 'summer_camp'
  | 'wild_camp'
  | 'selva'
  | 'giornata'
  | 'altro';

export type EventCategoryId = BuiltInEventCategory | (string & {});

export interface EventItem {
  id: string;
  name: string;
  category: EventCategoryId;
  date: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  location: string;
  ageGroups?: string; // es. "6-11, 11-14 anni" o "8-13 anni"
  conditions?: string; // Condizioni di partecipazione, caparra, sconto fratelli, equipaggiamento, tessera richiesta
  depositDefault?: number; // Caparra standard richiesta (€)
  memberPrice: number;
  nonMemberPrice: number;
  defaultDiscountType?: EventDiscountType;
  defaultDiscountValue?: number;
  defaultDiscountLabel?: string;
  notes?: string;
  status: 'aperto' | 'concluso' | 'in_corso' | 'annullato';
  targetStaffCount?: number;
  googleFormId?: string;
  googleFormUrl?: string;
  driveSheetId?: string;
  driveSheetUrl?: string;
}

export interface EventBooking {
  id: string;
  eventId: string;
  eventName: string;
  memberId?: string;
  childName: string;
  parentName: string;
  parentEmail?: string;
  parentPhone?: string;
  confirmed: boolean;
  basePrice?: number; // Quota lorda prima di sconti e buoni
  discountType?: EventDiscountType; // 'none' | 'fixed' | 'percent'
  discountValue?: number; // Valore numerico dello sconto (€ se fixed, % se percent)
  discountAmount?: number; // Sconto effettivo in € calcolato sull'evento
  discountLabel?: string; // Dicitura sconto per la ricevuta (es. "Quota coperta da Associazione / ISEE")
  voucherApplied?: number; // Importo buono spesa applicato (€)
  depositAmount: number;
  balanceAmount: number;
  isDepositPaid: boolean;
  isBalancePaid: boolean;
  totalPrice: number; // Netto da pagare (dopo sconto evento e buono spesa)
  annualCardValid: boolean;
  extraInsurancePaid: boolean;
  paymentMethod: PaymentMethod;
  notes?: string;
  confirmationEmailSent?: boolean;
  confirmationEmailSentAt?: string;
}

export interface GadgetItem {
  id: string;
  name: string;
  category: 'abbigliamento' | 'accessori' | 'attrezzatura';
  unitPrice: number;
  variants: string; // e.g. "Taglie: 6-8, 9-11, 12-14, S, M, L"
  stockCount: number;
}

export interface GadgetOrder {
  id: string;
  date: string;
  memberId?: string;
  childName: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  gadgetId: string;
  gadgetName: string;
  variant: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isPaid: boolean;
  isDelivered: boolean;
  paymentMethod: PaymentMethod;
  confirmationEmailSent: boolean;
  confirmationEmailSentAt?: string;
  notes?: string;
}

export type GovernanceRoleCategory =
  | 'consiglio_direttivo'
  | 'tutela_minori_safeguarding'
  | 'sicurezza_rspp'
  | 'revisore_altro';

export interface AssociationRole {
  id: string;
  roleTitle: string;
  category: GovernanceRoleCategory;
  personName: string;
  fiscalCode?: string;
  phone?: string;
  email?: string;
  appointmentDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  driveDocumentUrl?: string;
  notes?: string;
}

export interface AssemblyMeeting {
  id: string;
  fiscalYear: number;
  title: string;
  type: 'ordinaria_rendiconto' | 'straordinaria' | 'consiglio_direttivo';
  scheduledDate: string; // YYYY-MM-DD
  approvalDeadline: string; // YYYY-MM-DD
  status: 'da_convocare' | 'convocata' | 'svolta_approvata';
  driveFileId?: string;
  driveFileName?: string;
  driveFileUrl?: string;
  minutesSummary?: string;
}

export type GrantStatus =
  | 'in_valutazione'
  | 'in_preparazione'
  | 'presentato'
  | 'approvato_finanziato'
  | 'in_rendicontazione'
  | 'chiuso_rendicontato'
  | 'non_ammesso';

export interface GrantDocument {
  id: string;
  name: string;
  category: 'bando_avviso' | 'domanda_progetto' | 'allegato_tecnico' | 'rendicontazione_fatture' | 'altro';
  uploadedAt: string;
  driveFileId?: string;
  driveFileUrl?: string;
  notes?: string;
}

export interface GrantItem {
  id: string;
  title: string;
  promoter: string; // Ente erogatore (Regione, Sport e Salute, Fondazione, Comune, ecc.)
  submissionDeadline: string; // YYYY-MM-DD (Scadenza presentazione domanda)
  reportingDeadline: string; // YYYY-MM-DD (Scadenza rendicontazione)
  status: GrantStatus;
  requestedAmount: number;
  approvedAmount: number;
  keyCharacteristics: string; // Caratteristiche fondamentali del bando (spese ammissibili, vincoli, cofinanziamento, target)
  usefulContacts: string; // Contatti utili (RUP, email, telefono, sportello)
  portalUrl?: string;
  documents: GrantDocument[];
  notes?: string;
}

export interface ArchivedFiscalYear {
  id: string;
  year: number;
  archivedAt: string;
  summary: {
    initialFund: number;
    initialBankBalance?: number;
    initialCashBalance?: number;
    initialPaypalBalance?: number;
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    finalTotalBalance: number;
    finalBankBalance: number;
    finalCashBalance: number;
    finalPaypalBalance?: number;
    customAccountBalances?: {
      id: string;
      name: string;
      initialBalance: number;
      income: number;
      expense: number;
      currentBalance: number;
    }[];
    membersCount: number;
    eventsCount: number;
    bookingsCount: number;
  };
  transactions: CashTransaction[];
  events: EventItem[];
  bookings: EventBooking[];
  gadgetOrders: GadgetOrder[];
  membersSnapshot: Member[];
  receipts?: IssuedReceipt[];
  driveFileId?: string;
  driveWebViewLink?: string;
  isLightSummaryOnly?: boolean;
  driveArchiveJsonUrl?: string;
  driveArchiveSheetUrl?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  fiscalCode?: string;
  phone?: string;
  email?: string;
  iban?: string;
  /** Compensi sportivi percepiti presso altre ASD/SSD/enti nell'anno solare per il calcolo delle soglie 5.000 € INPS / 15.000 € IRPEF */
  otherAssociationsCompensation?: number;
  /** Mappa annuale opzionale: anno -> compensi percepiti presso altri enti in quell'anno solare */
  otherAssociationsCompensationByYear?: Record<number, number>;
  /** Note o riferimento autocertificazione compensi altri enti */
  otherAssociationsNotes?: string;
}

export interface StaffPayment {
  id: string;
  date: string;
  staffName: string;
  amount: number;
  type: 'quota_lavoro_sportivo' | 'servizi_guida' | 'progettazione' | 'rimborso_spese';
  method: PaymentMethod;
  description: string;
  receiptNumber?: string;
}

export type NotificationCategory =
  | 'duplicati'
  | 'pre_evento'
  | 'email_non_inviate'
  | 'governance_scadenze'
  | 'bandi_scadenze'
  | 'scadenze_manuali'
  | 'tessere'
  | 'pagamenti'
  | 'moduli'
  | 'staff_soglie';

export interface NotificationItem {
  id: string;
  type: 'urgent' | 'warning' | 'info';
  category: NotificationCategory;
  title: string;
  description: string;
  date: string;
  targetId?: string;
  targetType?:
    | 'member'
    | 'booking'
    | 'transaction'
    | 'duplicate_group'
    | 'gadget_order'
    | 'event'
    | 'governance'
    | 'grant'
    | 'custom_deadline'
    | 'staff';
  actionLabel?: string;
  isCustomDeadline?: boolean;
}

export interface DuplicateTransactionGroup {
  groupId: string;
  signature: string;
  personName: string;
  matchReason: string;
  amount: number;
  direction: 'income' | 'expense';
  category: CashCategory;
  daysSpan: number;
  originalTransaction: CashTransaction;
  duplicateTransactions: CashTransaction[];
  allTransactions: CashTransaction[];
}

export interface PreEventParticipantAlert {
  bookingId: string;
  childName: string;
  parentName: string;
  parentPhone?: string;
  parentEmail?: string;
  memberFound: boolean;
  cardStatus: 'ok' | 'missing' | 'unpaid' | 'expired_before_event' | 'expiring_soon';
  cardDetails: string;
  allergies: string;
  specialConditions: string;
  photoConsent: boolean;
  emailSent: boolean;
  balancePending: number;
}

export interface PreEventBriefing {
  event: EventItem;
  daysUntilEvent: number;
  totalConfirmed: number;
  missingOrExpiredCardList: PreEventParticipantAlert[];
  allergiesList: PreEventParticipantAlert[];
  specialNeedsList: PreEventParticipantAlert[];
  noPhotoConsentList: PreEventParticipantAlert[];
  pendingEmailsList: PreEventParticipantAlert[];
  allParticipants: PreEventParticipantAlert[];
}

export type GoogleFormQuestionType = 'short_text' | 'paragraph' | 'radio' | 'checkbox';

export type GoogleFormTargetArea = 'tesseramento' | 'evento' | 'gadget';

export type MemberFieldMapping =
  | 'childName'
  | 'parentName'
  | 'parentEmail'
  | 'parentPhone'
  | 'birthDate'
  | 'birthPlace'
  | 'group'
  | 'childFiscalCode'
  | 'childAddress'
  | 'parentFiscalCode'
  | 'insuranceType'
  | 'cardValidityType'
  | 'allergies'
  | 'notesConditions'
  | 'photoConsent'
  | 'custom_note';

export interface GoogleFormFieldConfig {
  id: string;
  title: string;
  description?: string;
  questionType: GoogleFormQuestionType;
  options?: string[];
  required: boolean;
  isStandardForAllForms: boolean;
  applicableAreas: GoogleFormTargetArea[];
  enabledByDefault: boolean;
  mapsTo?: MemberFieldMapping;
}

export interface ReceiptCustomLine {
  id: string;
  label: string;
  value: string;
}

export type ReceiptDynamicFieldType =
  | 'auto_variable'
  | 'editable_text'
  | 'editable_date'
  | 'editable_select';

export type ReceiptDynamicFieldPosition = 'header_box' | 'table_row' | 'footer_box';

export interface ReceiptDynamicField {
  id: string;
  label: string;
  valueTemplate: string; // Supports {{socio}}, {{genitore}}, {{cf_genitore}}, {{cf_socio}}, {{tessera}}, {{importo}}, etc.
  fieldType: ReceiptDynamicFieldType;
  options?: string[];
  position: ReceiptDynamicFieldPosition;
  enabled: boolean;
}

export interface ImageOverlayConfig {
  scalePercent: number; // 50 to 180 (default 100)
  rotationDeg: number; // -25 to +25 (default -6 for stamp, 0 for signature)
  opacity: number; // 0.3 to 1.0 (default 0.9)
  offsetX: number; // -120 to +120 px
  offsetY: number; // -80 to +80 px
  overlapMode: 'dedicated_box' | 'overlap_signature';
}

export type ReceiptLayoutTemplateId = 'standard' | 'minimalist' | 'official';

export interface ReceiptTemplateConfig {
  layoutTemplate?: ReceiptLayoutTemplateId;
  showFiscalCodeAsd: boolean;
  showAffiliation: boolean;
  showMemberAddress: boolean;
  showCardNumberAndInsurance: boolean;
  showParentFiscalCode: boolean;
  showParentContact: boolean;
  showPaymentMethod: boolean;
  showIbanOnReceipt: boolean;
  showLegalNotice: boolean;
  showStamp: boolean;
  showSignature: boolean;
  showQuietanzaLine: boolean;
  showIntroDeclaration?: boolean;
  documentTitleReceipt: string;
  documentTitleQuote: string;
  documentTitleReminder: string;
  introDeclarationText?: string;
  activityDescriptionSubtext: string;
  legalTaxClause: string;
  footerNotes: string;
  customLines: ReceiptCustomLine[];
  dynamicFields?: ReceiptDynamicField[];
  stampOverlay?: ImageOverlayConfig;
  signatureOverlay?: ImageOverlayConfig;
}

export type CriticalDeadlineCategory =
  | 'affiliazione_tesserini'
  | 'bilancio_governance'
  | 'fisco_inps'
  | 'bandi_contributi';

export interface CustomCriticalDeadline {
  id: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  category: CriticalDeadlineCategory;
  recurrenceLabel?: string;
  linkedGrantId?: string;
  promoter?: string;
  requestedAmount?: number;
}

export interface CriticalDeadlineItem {
  id: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  dueDateLabel: string; // e.g. "30 Nov 2026 (Fine Mese)" or "05 Set 2027"
  category: CriticalDeadlineCategory;
  recurrence: 'annuale' | 'mensile' | 'bando' | 'governance' | 'personalizzata';
  daysRemaining: number;
  temporalProgressPercent: number; // 0 to 100 temporal urgency / progression bar
  yearPositionPercent: number; // 0 to 100 position along the Jan 1 -> Dec 31 solar year bar
  status: 'completed' | 'overdue' | 'urgent' | 'upcoming' | 'scheduled';
  isCompleted: boolean;
  actionTab:
    | 'governance'
    | 'staff'
    | 'grants'
    | 'members'
    | 'cashflow'
    | 'notifications'
    | 'backup';
  actionLabel: string;
  isCustom?: boolean;
}

export type InsuranceTypeLabels = Record<string, string>;

export type DigitalCardFieldId =
  | 'associationName'
  | 'affiliation'
  | 'cardTitle'
  | 'memberName'
  | 'cardNumber'
  | 'insuranceType'
  | 'validityDates'
  | 'fiscalCode'
  | 'customFooter';

export interface DigitalCardFieldPlacement {
  id: DigitalCardFieldId;
  label: string;
  visible: boolean;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  fontSize: number; // px on standard card (e.g. 10 to 26)
  color: string; // hex color
  align: 'left' | 'center' | 'right';
  showLabelPrefix: boolean;
  customPrefix?: string;
}

export type DigitalCardThemePreset =
  | 'apuacamp_emerald'
  | 'usacli_sport_blue'
  | 'gold_prestige'
  | 'minimal_light';

export interface DigitalCardTemplateConfig {
  themePreset: DigitalCardThemePreset;
  backgroundDataUrl?: string; // Image or rendered PDF page DataURL
  backgroundRawPdfDataUrl?: string; // Original PDF DataURL if a .pdf was uploaded
  backgroundFileName?: string;
  backgroundOpacity: number; // 0.1 to 1.0
  showLogo: boolean;
  logoXPercent: number; // 0 to 100
  logoYPercent: number; // 0 to 100
  logoScalePercent: number; // 40 to 180
  showQrVerificationBadge: boolean;
  qrXPercent: number;
  qrYPercent: number;
  customFooterText: string;
  fields: DigitalCardFieldPlacement[];
}

export interface NotificationResolutionRecord {
  itemId: string;
  status: 'resolved' | 'postponed';
  note: string;
  updatedAt: string; // ISO date YYYY-MM-DD
  postponedUntilDate?: string; // YYYY-MM-DD
  originalTitle?: string;
}

export interface DeadlineOverrideRecord {
  deadlineId: string;
  customTitle?: string; // Custom title set by the ASD for a proposed/statutory deadline
  customDescription?: string; // Custom description set by the ASD
  customDueDate?: string; // YYYY-MM-DD when rescheduled or permanently changed
  customDueDateLabel?: string; // Custom label (e.g. "Data Annuale ASD" or "Rimandata")
  isPermanentDateChange?: boolean; // True when the ASD permanently changed the recurring/statutory date
  isHidden?: boolean; // True if the ASD chose to hide/delete this proposed deadline
  resolutionNote?: string; // User-typed note when resolved or postponed
  isCompleted?: boolean;
  updatedAt: string;
}

export type DuplicateDetectionMode = 'strict' | 'same_day' | 'off';

export type ReceiptLineItemCategory =
  | 'evento'
  | 'doposcuola'
  | 'tessera'
  | 'gadget'
  | 'custom';

export interface ReceiptLineItem {
  id: string;
  category: ReceiptLineItemCategory;
  title: string;
  subtitle?: string;
  amount: number;
  enabled: boolean;
}

export interface TaxDeductionRules {
  minAge: number; // default 5
  maxAge: number; // default 18
  maxAnnualAmountPerChild: number; // default 210
}

export interface IssuedReceipt {
  id: string;
  year: number;               // anno di emissione
  progressive: number;        // 1, 2, 3, ...
  number: string;             // es. "12/2027" (formato configurabile)
  manualNumber?: boolean;     // true se l'utente ha scritto il numero a mano
  issueDate: string;          // YYYY-MM-DD
  status: 'emessa' | 'annullata';
  cancelReason?: string;
  cancelledAt?: string;
  createdAt?: string;
  payerName: string;
  payerFiscalCode?: string;
  payerEmail?: string;
  participantName?: string;   // praticante (es. il bambino)
  participantFiscalCode?: string;
  participantBirthDate?: string;
  description: string;
  lineItems?: ReceiptLineItem[];
  amount: number;
  paymentMethod: PaymentMethod;
  memberId?: string;
  bookingId?: string;
  transactionId?: string;
  gadgetOrderId?: string;
  driveFileId?: string;
  driveUrl?: string;
  sentTo?: string;
  sentAt?: string;
  forTaxDeduction?: boolean;
}

export type EmailTemplateId =
  | 'ricevuta_evento'
  | 'ricevuta_tessera'
  | 'ricevuta_doposcuola'
  | 'ricevuta_gadget'
  | 'modulo_iscrizione_da_firmare';

export interface EmailTemplateConfig {
  id: EmailTemplateId;
  name: string;
  description: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface AssociationProfile {
  associationId?: string;
  name: string;
  legalType: string;
  fiscalCode: string;
  address: string;
  president: string;
  iban: string;
  affiliation: string;
  email: string;
  phone: string;
  activeYear: number;
  driveRootFolderId?: string;
  driveRootFolderUrl?: string;
  driveMinutesFolderId?: string;
  driveBackupsFolderId?: string;
  membersGoogleFormId?: string;
  membersGoogleFormUrl?: string;
  membersGoogleSheetId?: string;
  membersGoogleSheetUrl?: string;
  accountingGoogleSheetId?: string;
  accountingGoogleSheetUrl?: string;
  logoImageDataUrl?: string;
  stampImageDataUrl?: string;
  signatureImageDataUrl?: string;
  insuranceTypeLabels?: InsuranceTypeLabels;
  digitalCardConfig?: DigitalCardTemplateConfig;
  formStandardFields?: GoogleFormFieldConfig[];
  receiptConfig?: ReceiptTemplateConfig;
  savedDiscountLabels?: string[]; // Diciture sconto salvate e selezionabili per ricevute ed eventi futuri
  emailTemplates?: Record<EmailTemplateId, EmailTemplateConfig>; // Modelli email Gmail personalizzabili
  completedDeadlineIds?: string[];
  customDeadlines?: CustomCriticalDeadline[];
  deadlineOverrides?: Record<string, DeadlineOverrideRecord>;
  notificationResolutions?: Record<string, NotificationResolutionRecord>;
  hideResolvedDeadlines?: boolean;
  duplicateDetectionMode?: DuplicateDetectionMode;
  ignoredDuplicateSignatures?: string[];
  receiptNumberFormat?: string; // default "{n}/{anno}"
  taxDeductionRules?: TaxDeductionRules;
  staffThresholds?: StaffThresholdsConfig;
  paymentAccounts?: PaymentAccountsMap; // default { Bonifico: 'banca', POS: 'banca', Bancomat: 'banca', 'Pagam Online': 'banca', Paypal: 'paypal', Contanti: 'cassa' }
  paypalExpenseSourceAccount?: PaymentAccountId; // default 'banca' (strumento predefinito dentro PayPal per le uscite)
  customPaymentAccounts?: CustomPaymentAccount[]; // conti aggiuntivi configurabili dall'utente
  initialFundPaypal?: number; // saldo iniziale conto PayPal (default 0)
  initialFundMismatchNotice?: {
    oldInitialFund: number;
    realignedInitialFund: number;
  };
  archiveHealthDataRetentionYears?: number; // 0 o undefined = disattivato; >0 = anonimizza allergie/note salute negli archivi più vecchi di N anni
  onboardingCompleted?: boolean; // true quando l'associazione ha completato il wizard di primo avvio
  hasAdultMembers?: boolean; // se true, l'associazione gestisce anche soci adulti (etichette "Socio/Partecipante" e campi genitore facoltativi)
  showApuacampAttributionInDocs?: boolean; // se true, mostra l'attribuzione piattaforma anche nei PDF/tessere generati
  cardTypes?: CardTypeConfig[];
  ageGroups?: AgeGroupConfig[];
  cashCategories?: CashCategoryConfig[];
  eventCategories?: EventCategoryConfig[];
  deadlineTemplates?: DeadlineTemplateConfig[];
  deadlinePreset?: 'us_acli' | 'asd_generica';
}

export interface CashFlowSummary {
  initialFund: number;
  initialFundBank: number;
  initialFundCash: number;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  currentCash: number;
}

export interface AppState {
  schemaVersion: number;
  version: number;
  updatedAt: string;
  updatedBy: string;
  profile: AssociationProfile;
  initialFund: number;
  initialFundBank: number;
  initialFundCash: number;
  members: Member[];
  transactions: CashTransaction[];
  recurringExpenses: RecurringExpensePlan[];
  events: EventItem[];
  bookings: EventBooking[];
  gadgets: GadgetItem[];
  gadgetOrders: GadgetOrder[];
  staff: StaffMember[];
  staffPayments?: StaffPayment[];
  roles: AssociationRole[];
  assemblies: AssemblyMeeting[];
  grants: GrantItem[];
  archivedYears: ArchivedFiscalYear[];
  receipts: IssuedReceipt[];
}

export type DriveBackupReason =
  | 'daily'
  | 'pre-import'
  | 'pre-archive'
  | 'pre-bulk-delete'
  | 'pre-overwrite'
  | 'manual';

export interface DriveBackupEntry {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  reason?: DriveBackupReason;
  version?: number;
}

export interface DriveDbCandidate {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
  folderName?: string;
}



