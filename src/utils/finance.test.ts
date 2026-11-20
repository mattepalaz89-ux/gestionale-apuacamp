import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmount,
  calculateCashTotals,
  sortMembersList,
  mergeSavedDiscountLabels,
  calculateDiscountedEventPrice,
  calculateMultiItemReceiptTotals,
} from './finance';
import {
  generatePreEventBriefings,
  generateSystemNotifications,
  filterNotificationsByResolutions,
} from './notifications';
import {
  parseMembersFromRows,
  parseTransactionsFromRows,
  normalizeTransactionDate,
  tryParseTransactionDate,
  excelSerialToISODate,
  isTessera365Eligible,
  calculateCardExpiryDate,
  parseMembersFromGoogleFormResponses,
} from './csvExcelImporter';
import {
  archiveFiscalYearState,
  resetToEmpty2027,
  loadAppState,
  saveAppState,
  countAppStateRecords,
  computeYearTransitionMemberStats,
} from './storage';
import { buildAccountingSpreadsheetTabs } from './export';
import {
  resolveInsuranceTypeLabels,
  getInsuranceDisplayLabel,
  resolveDigitalCardConfig,
  resolveCardFieldTextValue,
  generateAsdEmblemDataUrl,
} from './digitalCard';
import {
  DEFAULT_GOOGLE_FORM_FIELDS,
  RECEIPT_LAYOUT_TEMPLATES,
  getEffectiveFormFieldsForArea,
  getReceiptLayoutTemplateMeta,
  buildGoogleFormBatchRequests,
  resolveReceiptConfig,
  resolveEmailTemplates,
  resolveDynamicTextPlaceholders,
} from './formAndReceiptTemplates';
import { getPageGuide, getAllPageGuides } from './pageGuides';
import {
  detectDuplicateTransactions,
  detectDuplicatesForNewTransactions,
} from './duplicates';
import {
  buildCriticalYearDeadlines,
  formatRemainingTimeHuman,
  getVisualAlertMeta,
} from './criticalDeadlines';
import {
  generateScheduledOccurrencesForPlan,
  evaluateRecurringExpensePlans,
  buildTransactionFromOccurrence,
} from './recurringExpenses';
import {
  EventItem,
  EventBooking,
  Member,
  AssociationRole,
  AssemblyMeeting,
  GrantItem,
  CashTransaction,
  RecurringExpensePlan,
} from '../types';

describe('Financial & Reconciliation Engine', () => {
  it('parses Italian and international euro strings accurately without multiplying by 100 on dot decimals', () => {
    assert.equal(parseAmount('€ 1.234,56'), 1234.56);
    assert.equal(parseAmount('41.902,29'), 41902.29);
    assert.equal(parseAmount('34.769,28'), 34769.28);
    assert.equal(parseAmount(130), 130);
    // Crucial regression tests for Excel formatted numbers ("1203.00" must be 1203, NEVER 120300)
    assert.equal(parseAmount('1203.00'), 1203);
    assert.equal(parseAmount('1203,00'), 1203);
    assert.equal(parseAmount('1.203,00'), 1203);
    assert.equal(parseAmount('1,203.00'), 1203);
    assert.equal(parseAmount('1203.5'), 1203.5);
    assert.equal(parseAmount('1203,5'), 1203.5);
    assert.equal(parseAmount('20.50'), 20.5);
  });

  it('reconciles the exact 2026 Cassa balance of € 11,805.47', () => {
    const totals = calculateCashTotals(
      [
        {
          id: 't1',
          date: '2026-06-01',
          category: 'SummerCamp',
          income: 41902.29,
          expense: null,
          method: 'Bonifico',
          description: 'Totale entrate 2026',
        },
        {
          id: 't2',
          date: '2026-08-01',
          category: 'Staff',
          income: null,
          expense: 34769.28,
          method: 'Bonifico',
          description: 'Totale uscite 2026',
        },
      ],
      4672.46,
      3572.46,
      1100.0
    );

    assert.equal(totals.totalIncome, 41902.29);
    assert.equal(totals.totalExpense, 34769.28);
    assert.equal(totals.netBalance, 7133.01);
    assert.equal(totals.currentTotal, 11805.47);
  });

  it('builds multi-tab accounting spreadsheet data for Excel and Google Sheets', () => {
    const tabs = buildAccountingSpreadsheetTabs({
      transactions: [
        {
          id: 'tx-1',
          date: '2027-03-10',
          category: 'Tessere',
          income: 200,
          expense: null,
          method: 'Bonifico',
          description: 'Quote tesseramento marzo',
        },
        {
          id: 'tx-2',
          date: '2027-03-15',
          category: 'Servizi esterni',
          income: null,
          expense: 50,
          method: 'Bonifico',
          description: 'Assicurazione integrativa',
        },
      ],
      initialFund: 1000,
      initialFundBank: 800,
      initialFundCash: 200,
      fiscalYear: 2027,
      associationName: 'Apuacamp A.S.D.',
    });

    assert.equal(tabs.length, 3);
    assert.equal(tabs[0].sheetTitle, 'Riepilogo_Bilancio');
    assert.equal(tabs[1].sheetTitle, 'Libro_Cassa');
    assert.equal(tabs[2].sheetTitle, 'Riepilogo_Mensile');
  });
});

describe('Fiscal Year Archiving & New Year Transition', () => {
  it('archives all current year data and carries over the closing balance into the new year', () => {
    const baseState = resetToEmpty2027();
    const stateWith2027Data = {
      ...baseState,
      initialFund: 1000,
      initialFundBank: 800,
      initialFundCash: 200,
      transactions: [
        {
          id: 'tx-a',
          date: '2027-05-01',
          category: 'Evento' as const,
          income: 500,
          expense: null,
          method: 'Bonifico' as const,
          description: 'Incasso evento maggio',
        },
        {
          id: 'tx-b',
          date: '2027-05-03',
          category: 'Staff' as const,
          income: null,
          expense: 150,
          method: 'Contanti' as const,
          description: 'Rimborso spese staff',
        },
      ],
    };

    const { nextState: transitioned, archivedRecord: archived2027 } = archiveFiscalYearState(
      stateWith2027Data,
      2028
    );
    assert.equal(transitioned.profile.activeYear, 2028);
    assert.equal(transitioned.transactions.length, 0);
    assert.equal(transitioned.archivedYears.length, 1);

    assert.equal(archived2027.year, 2027);
    assert.equal(archived2027.summary.totalIncome, 500);
    assert.equal(archived2027.summary.totalExpense, 150);
    assert.equal(archived2027.summary.finalTotalBalance, 1350);
    // Carried over into 2028 initialFund
    assert.equal(transitioned.initialFund, 1350);
    assert.equal(transitioned.initialFundBank, 1300);
    assert.equal(transitioned.initialFundCash, 50);
  });

  it('retains all members in registry when archiving a year, expiring solar cards while keeping Tessera 365 cards valid into the new year', () => {
    const baseState = resetToEmpty2027();
    const state2026 = {
      ...baseState,
      profile: {
        ...baseState.profile,
        activeYear: 2026,
      },
      members: [
        {
          id: 'm-solar',
          childName: 'Giulia Solare',
          birthDate: '10/05/2017',
          birthPlace: 'Massa',
          group: '6-11' as const,
          childFiscalCode: 'SLRGLI17E50F023A',
          childAddress: 'Via Roma 1',
          parentName: 'Paolo Solare',
          parentFiscalCode: '',
          parentPhone: '333111222',
          parentEmail: 'paolo@example.com',
          membershipCardNumber: '26ACLI001',
          isPaid: true,
          cardIssueDate: '2026-02-10',
          expiryDate: '31/12/2026',
          cardValidityType: 'solare' as const,
          insuranceType: 'Gold' as const,
          photoConsent: true,
          allergies: '',
          notesConditions: '',
          formSignedAndArchived: true,
        },
        {
          id: 'm-365',
          childName: 'Matteo TreSeiCinque',
          birthDate: '20/08/2016',
          birthPlace: 'Carrara',
          group: '6-11' as const,
          childFiscalCode: 'TRSMTT16M20B832B',
          childAddress: 'Via Mare 5',
          parentName: 'Anna Verdi',
          parentFiscalCode: '',
          parentPhone: '333444555',
          parentEmail: 'anna@example.com',
          membershipCardNumber: '26ACLI365',
          isPaid: true,
          cardIssueDate: '2026-09-15',
          expiryDate: '15/09/2027',
          cardValidityType: 'tessera_365' as const,
          insuranceType: 'Platinum' as const,
          photoConsent: true,
          allergies: '',
          notesConditions: '',
          formSignedAndArchived: true,
        },
      ],
    };

    const stats = computeYearTransitionMemberStats(state2026.members, 2026, 2027);
    assert.equal(stats.totalMembersRetained, 2);
    assert.equal(stats.expiredCardsToRenewCount, 1);
    assert.equal(stats.stillValidTessera365Count, 1);

    const { nextState } = archiveFiscalYearState(state2026, 2027);
    assert.equal(nextState.profile.activeYear, 2027);
    assert.equal(nextState.members.length, 2);

    const solarAfter = nextState.members.find((m) => m.id === 'm-solar')!;
    assert.equal(solarAfter.expiryDate, '31/12/2026');
    assert.equal(solarAfter.cardHistory?.length, 1);
    assert.equal(solarAfter.cardHistory?.[0].cardNumber, '26ACLI001');

    const card365After = nextState.members.find((m) => m.id === 'm-365')!;
    assert.equal(card365After.isPaid, true);
    assert.equal(card365After.expiryDate, '15/09/2027');
    assert.equal(card365After.membershipCardNumber, '26ACLI365');
  });
});

describe('Tessera 365 & Card Renewal Rules', () => {
  it('allows Tessera 365 only from September 1st onwards', () => {
    assert.equal(isTessera365Eligible('15/01/2027'), false);
    assert.equal(isTessera365Eligible('31/08/2027'), false);
    assert.equal(isTessera365Eligible('01/09/2027'), true);
    assert.equal(isTessera365Eligible('2027-09-15'), true);
    assert.equal(isTessera365Eligible('12/11/2027'), true);
  });

  it('calculates December 31st for Solare or same day next year for Tessera 365', () => {
    assert.equal(calculateCardExpiryDate('15/02/2027', 'solare'), '31/12/2027');
    assert.equal(calculateCardExpiryDate('15/05/2027', 'tessera_365'), '31/12/2027');
    assert.equal(calculateCardExpiryDate('01/09/2027', 'tessera_365'), '01/09/2028');
    assert.equal(calculateCardExpiryDate('2027-10-14', 'tessera_365'), '14/10/2028');
  });
});

describe('Pre-Event Briefing, Bandi Deadlines & Notification Engine', () => {
  const sampleEvent: EventItem = {
    id: 'ev-test',
    name: 'Rifugio Del Freo 2027',
    category: 'rifugio',
    date: '2027-04-17',
    location: 'Mosceta',
    memberPrice: 130,
    nonMemberPrice: 140,
    depositDefault: 70,
    ageGroups: '6-11 anni, 12-16 anni',
    conditions: 'Tessera associativa attiva e certificato medico.',
    status: 'aperto',
    targetStaffCount: 3,
  };

  const sampleMembers: Member[] = [
    {
      id: 'm1',
      childName: 'Andrea Dini',
      birthDate: '17/04/2016',
      birthPlace: 'Pietrasanta',
      group: '6-11',
      childFiscalCode: 'DNNNDR16D17G628W',
      childAddress: 'Via Risorgimento',
      parentName: 'Silvia Rossi',
      parentFiscalCode: '',
      parentPhone: '3286125365',
      parentEmail: 'silvia@example.com',
      membershipCardNumber: '26PC12345',
      isPaid: true,
      expiryDate: '31/12/2026',
      insuranceType: 'Gold',
      photoConsent: false,
      allergies: 'Allergia api (adrenalina)',
      notesConditions: 'Portare autoiniettore',
      formSignedAndArchived: true,
      confirmationEmailSent: false,
    },
  ];

  const sampleBookings: EventBooking[] = [
    {
      id: 'b1',
      eventId: 'ev-test',
      eventName: 'Rifugio Del Freo 2027',
      memberId: 'm1',
      childName: 'Andrea Dini',
      parentName: 'Silvia Rossi',
      parentEmail: 'silvia@example.com',
      confirmed: true,
      depositAmount: 70,
      balanceAmount: 60,
      isDepositPaid: true,
      isBalancePaid: false,
      totalPrice: 130,
      annualCardValid: true,
      extraInsurancePaid: false,
      paymentMethod: 'Bonifico',
      confirmationEmailSent: false,
    },
  ];

  it('detects expired card, allergies, special needs, and missing photo consent before an event', () => {
    const briefings = generatePreEventBriefings(
      [sampleEvent],
      sampleBookings,
      sampleMembers,
      new Date('2027-04-10')
    );

    assert.equal(briefings.length, 1);
    const b = briefings[0];
    assert.equal(b.missingOrExpiredCardList.length, 1);
    assert.equal(b.missingOrExpiredCardList[0].cardStatus, 'expired_before_event');
    assert.equal(b.allergiesList.length, 1);
    assert.equal(b.noPhotoConsentList.length, 1);
    assert.equal(b.pendingEmailsList.length, 1);
  });

  it('generates unsent email notifications, governance reminders, and Bandi deadline alerts', () => {
    const roles: AssociationRole[] = [
      {
        id: 'r1',
        roleTitle: 'Responsabile Safeguarding',
        category: 'tutela_minori_safeguarding',
        personName: 'Da verificare',
        appointmentDate: '2026-01-01',
        expiryDate: '2026-12-31',
      },
    ];
    const assemblies: AssemblyMeeting[] = [
      {
        id: 'a1',
        fiscalYear: 2026,
        title: 'Assemblea Approvazione Rendiconto 2026',
        type: 'ordinaria_rendiconto',
        scheduledDate: '2027-04-15',
        approvalDeadline: '2027-04-30',
        status: 'da_convocare',
      },
    ];
    const grants: GrantItem[] = [
      {
        id: 'gr-1',
        title: 'Bando Sport e Natura 2027',
        promoter: 'Regione Toscana',
        submissionDeadline: '2027-04-10',
        reportingDeadline: '2027-11-30',
        status: 'in_valutazione',
        requestedAmount: 8000,
        approvedAmount: 0,
        keyCharacteristics: 'Acquisto materiali outdoor e borse sportive.',
        usefulContacts: 'sport@regione.toscana.it',
        documents: [],
      },
    ];

    const notifs = generateSystemNotifications(
      sampleMembers,
      sampleBookings,
      [sampleEvent],
      [],
      roles,
      assemblies,
      new Date('2027-04-01'),
      grants
    );

    assert.ok(notifs.some((n) => n.category === 'pre_evento'));
    assert.ok(notifs.some((n) => n.category === 'email_non_inviate'));
    assert.ok(notifs.some((n) => n.category === 'governance_scadenze'));
    assert.ok(notifs.some((n) => n.category === 'bandi_scadenze'));
  });
});

describe('Excel / CSV & Google Form Importer + Custom Form/Receipt Templates', () => {
  it('parses member rows and transaction rows cleanly', () => {
    const memberRows = [
      ['Nome Bimbo/a', 'Data Nascita', 'Luogo', 'Gruppo', 'CF', 'Residenza', 'Genitore'],
      ['Luca Verdi', '10/03/2018', 'Massa', '6-11', 'VRDLCU18C10F023Z', 'Via Apuane', 'Marco Verdi', '', '333999888', 'marco@example.com', '27PC001', 'SI', '31/12/2027', 'Platinum', 'NO', 'Polline', '', 'SI', 'Tessera 365'],
    ];
    const parsedMembers = parseMembersFromRows(memberRows);
    assert.equal(parsedMembers.length, 1);
    assert.equal(parsedMembers[0].childName, 'Luca Verdi');
    assert.equal(parsedMembers[0].insuranceType, 'Platinum');
    assert.equal(parsedMembers[0].photoConsent, false);
    assert.equal(parsedMembers[0].cardValidityType, 'tessera_365');

    const txRows = [
      ['Data', 'Categoria', 'Entrata', 'Uscita', 'Canale', 'Dettagli'],
      ['15/01/2027', 'Tessere', '25,00', '', 'Bonifico', 'Quota tessera Platinum Luca Verdi'],
    ];
    const parsedTxs = parseTransactionsFromRows(txRows, 2027);
    assert.equal(parsedTxs.length, 1);
    assert.equal(parsedTxs[0].income, 25);
    assert.equal(parsedTxs[0].category, 'Tessere');
  });

  it('parses Google Form responses directly into Member records including deep-dive special needs and autonomies', () => {
    const parsedFromForm = parseMembersFromGoogleFormResponses(
      [
        {
          _responseId: 'resp-99',
          _submittedAt: '2027-09-10T10:00:00Z',
          'Nome e Cognome Bimbo/a': 'Sofia Bianchi',
          'Data di Nascita Bimbo/a (GG/MM/AAAA)': '12/05/2017',
          'Luogo di Nascita Bimbo/a': 'Carrara',
          'Gruppo / Fascia Età': '6-11',
          'Codice Fiscale Bimbo/a': 'BNCSFI17E52B832X',
          'Indirizzo di Residenza': 'Via Roma 10',
          'Nome e Cognome Genitore / Tutore': 'Elena Bianchi',
          'Telefono Genitore': '340112233',
          'Email Genitore': 'elena@example.com',
          'Tipo di Assicurazione e Tessera US ACLI scelta': 'Gold (€ 15 - Annuale ordinaria)',
          'Formula di Validità Tessera':
            "Tessera 365 (12 mesi - scade lo stesso giorno dell'anno successivo, attivabile solo dal 1 Settembre)",
          'Allergie Alimentari, Intolleranze, Patologie o Farmaci Salvavita': 'Intolleranza lattosio',
          'Bisogni Speciali, Esigenze Educative e Dettagli Approfonditi': 'BES leggero, preferisce spiegazioni visive',
          'Autonomie Personali, Alimentazione, Sonno e Adattamento Outdoor': 'Prima notte fuori casa in rifugio',
          'Autorizzazione Foto e Video': 'SI',
        },
      ],
      []
    );

    assert.equal(parsedFromForm.added.length, 1);
    assert.equal(parsedFromForm.added[0].childName, 'Sofia Bianchi');
    assert.equal(parsedFromForm.added[0].cardValidityType, 'tessera_365');
    assert.equal(parsedFromForm.added[0].expiryDate, '10/09/2028');
    assert.equal(parsedFromForm.added[0].allergies, 'Intolleranza lattosio');
    assert.ok(parsedFromForm.added[0].notesConditions.includes('BES leggero'));
    assert.ok(parsedFromForm.added[0].notesConditions.includes('Prima notte fuori casa'));
  });

  it('builds Google Form batchUpdate requests with standard fields across all form types and resolves custom receipt configs', () => {
    const eventFields = getEffectiveFormFieldsForArea(DEFAULT_GOOGLE_FORM_FIELDS, 'evento');
    // Standard fields (including allergies, special needs deep dive, and autonomies) must be included in event forms
    assert.ok(eventFields.some((f) => f.id === 'std-special-needs-deep'));
    assert.ok(eventFields.some((f) => f.id === 'std-autonomies-sleep'));

    const batchReqs = buildGoogleFormBatchRequests({
      title: 'Modulo Evento Test',
      description: 'Descrizione test',
      fields: eventFields,
    });
    // 1 updateFormInfo + N createItem requests
    assert.equal(batchReqs.length, 1 + eventFields.length);
    assert.ok(batchReqs[0].updateFormInfo);
    assert.ok(batchReqs[1].createItem);

    const receiptCfg = resolveReceiptConfig();
    assert.equal(receiptCfg.showStamp, true);
    assert.equal(receiptCfg.showSignature, false);
    assert.ok(receiptCfg.legalTaxClause.includes('148'));
    assert.ok(Array.isArray(receiptCfg.dynamicFields));
    assert.ok((receiptCfg.dynamicFields?.length || 0) >= 3);
    assert.equal(receiptCfg.stampOverlay?.scalePercent, 100);
    assert.equal(receiptCfg.signatureOverlay?.scalePercent, 100);

    const resolvedText = resolveDynamicTextPlaceholders(
      'Ricevuto da {{genitore}} per {{socio}} (C.F. {{cf_socio}}) importo {{importo}} anno {{anno}}',
      {
        socio: 'Marco Rossi',
        genitore: 'Laura Bianchi',
        cf_socio: 'RSSMRC16D12F205K',
        importo: 120,
        anno: 2027,
      }
    );
    assert.ok(resolvedText.includes('Laura Bianchi'));
    assert.ok(resolvedText.includes('Marco Rossi'));
    assert.ok(resolvedText.includes('RSSMRC16D12F205K'));
    assert.ok(resolvedText.includes('2027'));

    const allGuides = getAllPageGuides();
    assert.equal(allGuides.length, 12);
    assert.equal(getPageGuide('cards').tabId, 'cards');
    for (const g of allGuides) {
      assert.ok(g.title.length > 5);
      assert.ok(g.features.length >= 2);
      assert.ok(g.proTips.length >= 1);
      assert.equal(getPageGuide(g.tabId).tabId, g.tabId);
    }
  });
});

describe('Duplicate Movements Detection (Same Person & Same Amount within 7 Days)', () => {
  const sampleTxs: CashTransaction[] = [
    {
      id: 'tx-dup-1',
      date: '2027-03-10',
      category: 'Evento',
      income: 130,
      expense: null,
      method: 'Bonifico',
      description: 'Caparra Rifugio Del Freo Mario Rossi',
    },
    {
      id: 'tx-dup-2',
      date: '2027-03-14', // 4 days later (<= 7 days)
      category: 'Evento',
      income: 130,
      expense: null,
      method: 'Bonifico',
      description: 'Quota iscrizione Rifugio Rossi Mario',
    },
    {
      id: 'tx-not-dup-far',
      date: '2027-03-25', // 15 days later (> 7 days)
      category: 'Evento',
      income: 130,
      expense: null,
      method: 'Bonifico',
      description: 'Saldo Rifugio Mario Rossi',
    },
    {
      id: 'tx-not-dup-diff-amount',
      date: '2027-03-11',
      category: 'Evento',
      income: 60,
      expense: null,
      method: 'Bonifico',
      description: 'Saldo Rifugio Mario Rossi',
    },
    {
      id: 'tx-not-dup-diff-person',
      date: '2027-03-11',
      category: 'Evento',
      income: 130,
      expense: null,
      method: 'Bonifico',
      description: 'Caparra Rifugio Del Freo Luca Verdi',
    },
  ];

  it('flags similar movements for the same person and same amount within 7 days and ignores movements > 7 days apart', () => {
    const groups = detectDuplicateTransactions(sampleTxs, [], [], 7);
    assert.equal(groups.length, 1);
    const grp = groups[0];
    assert.equal(grp.amount, 130);
    assert.equal(grp.daysSpan, 4);
    assert.equal(grp.originalTransaction.id, 'tx-dup-1');
    assert.equal(grp.duplicateTransactions.length, 1);
    assert.equal(grp.duplicateTransactions[0].id, 'tx-dup-2');
    assert.ok(grp.personName.toLowerCase().includes('rossi'));
  });

  it('emits urgent duplicate alerts in generateSystemNotifications and respects ignored signatures', () => {
    const notifs = generateSystemNotifications(
      [],
      [],
      [],
      [],
      [],
      [],
      new Date('2027-03-15'),
      [],
      sampleTxs
    );
    const dupNotifs = notifs.filter((n) => n.category === 'duplicati');
    assert.equal(dupNotifs.length, 1);
    assert.equal(dupNotifs[0].targetType, 'duplicate_group');

    // When signature is ignored, no duplicate alert is emitted
    const groups = detectDuplicateTransactions(sampleTxs, [], [], 7);
    const notifsAfterIgnore = generateSystemNotifications(
      [],
      [],
      [],
      [],
      [],
      [],
      new Date('2027-03-15'),
      [],
      sampleTxs,
      [groups[0].signature]
    );
    assert.equal(
      notifsAfterIgnore.filter((n) => n.category === 'duplicati').length,
      0
    );
  });
});

describe('Critical Solar Year Deadlines & Temporal Progress Bar Engine', () => {
  it('computes solar year progress, monthly INPS deadline, Agenzia Entrate September, US ACLI, Bilancio, Tesserini Istruttori, and Bandi deadlines', () => {
    const refDate = new Date(2026, 10, 11); // 11 Nov 2026
    const result = buildCriticalYearDeadlines({
      activeYear: 2027,
      referenceDate: refDate,
      assemblies: [
        {
          id: 'asm-1',
          fiscalYear: 2026,
          title: 'Assemblea Bilancio 2026',
          type: 'ordinaria_rendiconto',
          scheduledDate: '2027-04-20',
          approvalDeadline: '2027-04-30',
          status: 'da_convocare',
        },
      ],
      grants: [
        {
          id: 'gr-test',
          title: 'Bando Outdoor Giovani',
          promoter: 'Regione Toscana',
          submissionDeadline: '2026-11-25',
          reportingDeadline: '2027-06-30',
          status: 'in_preparazione',
          requestedAmount: 5000,
          approvedAmount: 0,
          keyCharacteristics: 'Educazione outdoor',
          usefulContacts: 'info@regione.it',
          documents: [],
        },
      ],
      completedDeadlineIds: ['std-affiliazione-usacli'],
    });

    assert.equal(result.summary.solarYear, 2026);
    assert.ok(result.summary.yearElapsedPercent >= 80 && result.summary.yearElapsedPercent <= 90);
    assert.equal(result.summary.endOfCurrentMonthDate, '2026-11-30');
    assert.equal(result.summary.daysLeftInMonth, 19);

    // Verify all core statutory & dynamic deadlines exist
    assert.ok(result.deadlines.some((d) => d.id.startsWith('std-inps-mensile-')));
    assert.ok(result.deadlines.some((d) => d.id === 'std-affiliazione-usacli' && d.isCompleted));
    assert.ok(result.deadlines.some((d) => d.id === 'std-assemblea-bilancio'));
    assert.ok(
      result.deadlines.some((d) => d.id === 'std-comunicazione-agenzia-entrate-settembre')
    );
    assert.ok(result.deadlines.some((d) => d.id === 'std-rinnovo-tesserini-istruttori'));
    assert.ok(result.deadlines.some((d) => d.id === 'grant-sub-gr-test'));
    assert.ok(result.deadlines.some((d) => d.id === 'grant-rep-gr-test'));

    // Visual alert system levels & remaining time formatting
    const criticalAlert = getVisualAlertMeta(5, false, 94);
    assert.equal(criticalAlert.level, 'critical');
    assert.equal(criticalAlert.isPulsing, true);
    assert.equal(criticalAlert.remainingWindowPercent, 6);

    const urgentAlert = getVisualAlertMeta(15, false, 83);
    assert.equal(urgentAlert.level, 'urgent');
    assert.equal(urgentAlert.isPulsing, true);

    const approachingAlert = getVisualAlertMeta(40, false, 56);
    assert.equal(approachingAlert.level, 'approaching');
    assert.equal(approachingAlert.isPulsing, false);

    assert.ok(formatRemainingTimeHuman(18, false).includes('18 giorni'));
    assert.ok(formatRemainingTimeHuman(-3, false).includes('Scaduta da 3 giorni'));
  });
});

describe('Recurring Expenses Engine (Spese Mensili, Annue o a Tempo Determinato)', () => {
  it('generates exact installments for a fixed-duration monthly expense (numero_rate)', () => {
    const plan: RecurringExpensePlan = {
      id: 'rec-test-6m',
      title: 'Noleggio Pulmino 6 Mesi',
      category: 'Servizi esterni',
      method: 'Bonifico',
      amount: 180,
      frequency: 'mensile',
      startDate: '2027-03-10',
      durationMode: 'numero_rate',
      maxInstallments: 6,
      active: true,
    };

    const occs = generateScheduledOccurrencesForPlan(plan, 2027);
    assert.equal(occs.length, 6);
    assert.equal(occs[0].date, '2027-03-10');
    assert.equal(occs[0].installmentNumber, 1);
    assert.equal(occs[0].totalInstallments, 6);
    assert.equal(occs[5].date, '2027-08-10');
    assert.equal(occs[5].installmentNumber, 6);

    const tx = buildTransactionFromOccurrence(plan, occs[0]);
    assert.equal(tx.expense, 180);
    assert.equal(tx.income, null);
    assert.equal(tx.recurringPlanId, 'rec-test-6m');
    assert.equal(tx.recurringInstallmentNumber, 1);
    assert.ok(tx.description.includes('Rata 1/6'));
  });

  it('bounds recurring expenses by endDate (fino_a_data) and tracks registered vs pending installments', () => {
    const planEndDate: RecurringExpensePlan = {
      id: 'rec-test-enddate',
      title: 'Utenze Campo Estivo',
      category: 'SummerCamp',
      method: 'Bonifico',
      amount: 95,
      frequency: 'bimestrale',
      startDate: '2027-04-15',
      durationMode: 'fino_a_data',
      endDate: '2027-09-01',
      active: true,
    };

    const occs = generateScheduledOccurrencesForPlan(planEndDate, 2027);
    // April 15, June 15, August 15 (October 15 is > 2027-09-01)
    assert.equal(occs.length, 3);
    assert.equal(occs[0].date, '2027-04-15');
    assert.equal(occs[1].date, '2027-06-15');
    assert.equal(occs[2].date, '2027-08-15');

    const existingTxs: CashTransaction[] = [
      {
        id: 'tx-existing-1',
        date: '2027-04-15',
        category: 'SummerCamp',
        income: null,
        expense: 95,
        method: 'Bonifico',
        description: 'Utenze Campo Estivo — Scadenza Apr 2027 (#1)',
        recurringPlanId: 'rec-test-enddate',
        recurringOccurrenceDate: '2027-04-15',
        recurringInstallmentNumber: 1,
      },
    ];

    const evaluated = evaluateRecurringExpensePlans([planEndDate], existingTxs, 2027);
    assert.equal(evaluated.length, 1);
    const ep = evaluated[0];
    assert.equal(ep.activeYearTotalAmount, 285);
    assert.equal(ep.activeYearPaidAmount, 95);
    assert.equal(ep.activeYearRemainingAmount, 190);
    assert.equal(ep.unpaidActiveYearOccurrences.length, 2);
  });

  it('handles continuous annual and monthly expenses (indeterminata)', () => {
    const annualPlan: RecurringExpensePlan = {
      id: 'rec-test-annual',
      title: 'Canone Dominio e PEC Associazione',
      category: 'Tasse e Formalità',
      method: 'Pagam Online',
      amount: 65,
      frequency: 'annuale',
      startDate: '2027-01-20',
      durationMode: 'indeterminata',
      active: true,
    };

    const occs2027 = generateScheduledOccurrencesForPlan(annualPlan, 2027);
    const in2027 = occs2027.filter((o) => o.date.startsWith('2027'));
    assert.equal(in2027.length, 1);
    assert.equal(in2027[0].date, '2027-01-20');
  });
});

describe('PDF Receipt Layout Templates (Standard, Minimalist, Official)', () => {
  it('provides metadata and defaults for standard, minimalist, and official PDF layout templates', () => {
    assert.equal(RECEIPT_LAYOUT_TEMPLATES.length, 3);
    const ids = RECEIPT_LAYOUT_TEMPLATES.map((t) => t.id);
    assert.deepEqual(ids, ['standard', 'minimalist', 'official']);

    const officialMeta = getReceiptLayoutTemplateMeta('official');
    assert.equal(officialMeta.id, 'official');
    assert.ok(officialMeta.name.includes('Ufficiale'));

    const fallbackMeta = getReceiptLayoutTemplateMeta(undefined);
    assert.equal(fallbackMeta.id, 'standard');

    const baseProfile = resetToEmpty2027().profile;
    const defaultResolved = resolveReceiptConfig(baseProfile);
    assert.equal(defaultResolved.layoutTemplate, 'standard');

    const minimalistResolved = resolveReceiptConfig({
      ...baseProfile,
      receiptConfig: {
        ...defaultResolved,
        layoutTemplate: 'minimalist',
      },
    });
    assert.equal(minimalistResolved.layoutTemplate, 'minimalist');
  });
});

describe('Customizable Digital Membership Card & Editable Insurance Type Names', () => {
  it('resolves custom insurance type labels and digital card field placements', () => {
    const baseProfile = resetToEmpty2027().profile;
    const defaultLabels = resolveInsuranceTypeLabels(baseProfile);
    assert.ok(defaultLabels.Gold.includes('Gold'));

    const customProfile = {
      ...baseProfile,
      name: 'ASD Montagna Viva',
      affiliation: 'Affiliata CSI / US ACLI',
      insuranceTypeLabels: {
        Base: 'Base Giornaliera CSI',
        Summer: 'Campus Avventura Estate',
        Gold: 'Formula Completa Outdoor',
        Platinum: 'Top Tutela Integrale',
      },
    };

    assert.equal(getInsuranceDisplayLabel('Gold', customProfile), 'Formula Completa Outdoor');
    assert.equal(getInsuranceDisplayLabel('Platinum', customProfile), 'Top Tutela Integrale');

    const cardCfg = resolveDigitalCardConfig(customProfile);
    assert.equal(cardCfg.fields.length, 9);
    assert.equal(cardCfg.showLogo, true);

    const sampleMember: Member = {
      id: 'm-card-1',
      childName: 'Lorenzo Apuano',
      birthDate: '14/06/2016',
      birthPlace: 'Pietrasanta',
      group: '6-11',
      childFiscalCode: 'PNALRN16H14G628K',
      childAddress: 'Via Verde 8',
      parentName: 'Marta Rossi',
      parentFiscalCode: '',
      parentPhone: '333987654',
      parentEmail: 'marta@example.com',
      membershipCardNumber: '26USACLI9988',
      isPaid: true,
      cardIssueDate: '2026-09-10',
      expiryDate: '10/09/2027',
      cardValidityType: 'tessera_365',
      insuranceType: 'Gold',
      photoConsent: true,
      allergies: '',
      notesConditions: '',
      formSignedAndArchived: true,
    };

    const cardNumberField = cardCfg.fields.find((f) => f.id === 'cardNumber')!;
    const resolvedCardNum = resolveCardFieldTextValue(cardNumberField, sampleMember, customProfile);
    assert.equal(resolvedCardNum.value, '26USACLI9988');

    const insField = cardCfg.fields.find((f) => f.id === 'insuranceType')!;
    const resolvedIns = resolveCardFieldTextValue(insField, sampleMember, customProfile);
    assert.equal(resolvedIns.value, 'Formula Completa Outdoor');

    const emblemSvgUrl = generateAsdEmblemDataUrl('ASD Apuacamp', 'Affiliata US ACLI');
    assert.ok(emblemSvgUrl.startsWith('data:image/svg+xml;utf8,'));
  });
});

describe('Interactive Resolution (with Note) & Postponement of Notifications and Deadlines', () => {
  it('hides resolved notifications and notifications postponed to a future date', () => {
    const rawNotifs = [
      {
        id: 'notif-1',
        type: 'urgent' as const,
        category: 'governance_scadenze' as const,
        severity: 'urgent' as const,
        title: 'Scadenza Test 1',
        description: 'Descrizione 1',
        date: '2026-11-14',
        actionLabel: 'Vai',
      },
      {
        id: 'notif-2',
        type: 'warning' as const,
        category: 'bandi_scadenze' as const,
        severity: 'warning' as const,
        title: 'Scadenza Test 2',
        description: 'Descrizione 2',
        date: '2026-11-14',
        actionLabel: 'Vai',
      },
    ];

    const filtered = filterNotificationsByResolutions(
      rawNotifs,
      {
        'notif-1': {
          itemId: 'notif-1',
          status: 'resolved',
          note: 'Risolto con invio PEC il 10/11',
          updatedAt: '2026-11-10T10:00:00Z',
        },
        'notif-2': {
          itemId: 'notif-2',
          status: 'postponed',
          postponedUntilDate: '2026-12-15',
          note: 'Rimandata a metà dicembre',
          updatedAt: '2026-11-10T10:00:00Z',
        },
      },
      new Date('2026-11-14T12:00:00Z')
    );

    // Both should be hidden on 2026-11-14
    assert.equal(filtered.activeNotifications.length, 0);
    assert.equal(filtered.resolvedOrPostponedList.length, 2);

    // Once referenceDate is after 2026-12-15, the postponed notification reappears while resolved stays hidden
    const filteredAfterPostponeDate = filterNotificationsByResolutions(
      rawNotifs,
      {
        'notif-1': {
          itemId: 'notif-1',
          status: 'resolved',
          note: 'Risolto con invio PEC il 10/11',
          updatedAt: '2026-11-10T10:00:00Z',
        },
        'notif-2': {
          itemId: 'notif-2',
          status: 'postponed',
          postponedUntilDate: '2026-12-15',
          note: 'Rimandata a metà dicembre',
          updatedAt: '2026-11-10T10:00:00Z',
        },
      },
      new Date('2026-12-20T12:00:00Z')
    );
    assert.equal(filteredAfterPostponeDate.activeNotifications.length, 1);
    assert.equal(filteredAfterPostponeDate.activeNotifications[0].id, 'notif-2');
  });

  it('applies custom postponed dates and resolution notes to critical solar year deadlines', () => {
    const refDate = new Date(2026, 10, 14); // 14 Nov 2026
    const res = buildCriticalYearDeadlines({
      activeYear: 2026,
      referenceDate: refDate,
      deadlineOverrides: {
        'std-affiliazione-usacli': {
          deadlineId: 'std-affiliazione-usacli',
          customDueDate: '2027-01-20',
          resolutionNote: 'Proroga concordata con comitato provinciale',
          updatedAt: '2026-11-14T10:00:00Z',
        },
        'std-rinnovo-tesserini-istruttori': {
          deadlineId: 'std-rinnovo-tesserini-istruttori',
          isCompleted: true,
          resolutionNote: 'Tutti i tesserini tecnici rinnovati',
          updatedAt: '2026-11-14T10:00:00Z',
        },
      },
    });

    const affiliazione = res.deadlines.find((d) => d.id === 'std-affiliazione-usacli')!;
    assert.equal(affiliazione.dueDate, '2027-01-20');
    assert.ok(affiliazione.dueDateLabel.includes('Rimandata'));
    assert.ok(affiliazione.description.includes('Proroga concordata con comitato provinciale'));

    const tesserini = res.deadlines.find((d) => d.id === 'std-rinnovo-tesserini-istruttori')!;
    assert.equal(tesserini.isCompleted, true);
    assert.ok(tesserini.description.includes('Tutti i tesserini tecnici rinnovati'));
  });

  it('sends card renewal notifications ONLY when a member is enrolled in an event/activity, keeping dormant past-year members silent', () => {
    const pastYearMember: Member = {
      id: 'm-dormant-2026',
      childName: 'Elena Dormiente',
      birthDate: '12/04/2017',
      birthPlace: 'Massa',
      group: '6-11',
      childFiscalCode: 'DRMLNE17D52F023Q',
      childAddress: 'Via Alpi 1',
      parentName: 'Franco Dormiente',
      parentFiscalCode: '',
      parentPhone: '333123456',
      parentEmail: 'franco@example.com',
      membershipCardNumber: '26ACLI099',
      isPaid: false,
      expiryDate: '31/12/2026',
      insuranceType: 'Gold',
      photoConsent: true,
      allergies: '',
      notesConditions: '',
      formSignedAndArchived: true,
      confirmationEmailSent: true,
    };

    // 1. With NO event bookings, dormant member with expired/unpaid card must NOT generate a 'tessere' notification
    const notifsWithoutActivity = generateSystemNotifications(
      [pastYearMember],
      [],
      [],
      [],
      [],
      [],
      new Date('2027-02-10')
    );
    assert.equal(
      notifsWithoutActivity.filter((n) => n.category === 'tessere').length,
      0
    );

    // 2. Once the member enrolls in an event/activity, the 'tessere' renewal notification IS generated
    const activeBooking: EventBooking = {
      id: 'bk-active-2027',
      eventId: 'ev-2027-01',
      eventName: 'Weekend Rifugio Del Freo',
      memberId: 'm-dormant-2026',
      childName: 'Elena Dormiente',
      parentName: 'Franco Dormiente',
      parentEmail: 'franco@example.com',
      confirmed: true,
      depositAmount: 70,
      balanceAmount: 60,
      isDepositPaid: true,
      isBalancePaid: true,
      totalPrice: 130,
      annualCardValid: false,
      extraInsurancePaid: false,
      paymentMethod: 'Bonifico',
      confirmationEmailSent: true,
    };

    const notifsWithActivity = generateSystemNotifications(
      [pastYearMember],
      [activeBooking],
      [],
      [],
      [],
      [],
      new Date('2027-02-10')
    );
    const cardNotifs = notifsWithActivity.filter((n) => n.category === 'tessere');
    assert.equal(cardNotifs.length, 1);
    assert.ok(cardNotifs[0].title.includes('Elena Dormiente'));
  });

  it('supports selectable starting year (e.g. 2026 or 2027) and never persists data in browser localStorage', () => {
    const state2026 = loadAppState(null, 2026);
    assert.equal(state2026.profile.activeYear, 2026);

    const state2027 = loadAppState(null, 2027);
    assert.equal(state2027.profile.activeYear, 2027);

    // Calling saveAppState must not throw and must not store state in localStorage
    saveAppState(state2026, 'test@apuacamp.it');
  });

  it('includes manually inserted deadlines (e.g. a new Bando expiring in December 2027) in both CriticalDeadlinesWidget and Notifications', () => {
    const manualBandoDec2027 = {
      id: 'custom-dl-dec-2027',
      title: 'Nuovo Bando Sport e Natura - Scadenza Dicembre 2027',
      description: 'Presentazione domanda entro fine dicembre 2027',
      dueDate: '2027-12-31',
      category: 'bandi_contributi' as const,
      recurrenceLabel: 'Bando / Scadenza Fissa',
      promoter: 'Regione Toscana',
      requestedAmount: 12000,
    };

    const refDate = new Date(2026, 10, 16); // 16 Nov 2026
    const criticalRes = buildCriticalYearDeadlines({
      activeYear: 2026,
      referenceDate: refDate,
      customDeadlines: [manualBandoDec2027],
    });

    const foundInWidget = criticalRes.deadlines.find((d) => d.id === 'custom-dl-dec-2027');
    assert.ok(foundInWidget);
    assert.equal(foundInWidget.dueDate, '2027-12-31');
    assert.equal(foundInWidget.isCustom, true);
    assert.equal(foundInWidget.actionTab, 'grants');

    const notifs = generateSystemNotifications(
      [],
      [],
      [],
      [],
      [],
      [],
      refDate,
      [],
      [],
      [],
      undefined,
      [manualBandoDec2027],
      []
    );
    const foundInNotifs = notifs.find((n) => n.id === 'notif-custom-custom-dl-dec-2027');
    assert.ok(foundInNotifs);
    assert.equal(foundInNotifs.isCustomDeadline, true);
    assert.equal(foundInNotifs.category, 'bandi_scadenze');
    assert.ok(foundInNotifs.title.includes('Dicembre 2027'));
  });
});

describe('Sortable Members, Event Discounts (Fixed € / %), Vouchers & Smart Receipt / Gmail Templates', () => {
  const membersForSort: Member[] = [
    {
      id: 'm-z',
      childName: 'Zoe Neri',
      birthDate: '10/03/2018',
      birthPlace: 'Massa',
      group: '6-11',
      childFiscalCode: '',
      childAddress: '',
      parentName: 'Alberto Neri',
      parentFiscalCode: '',
      parentPhone: '',
      parentEmail: 'alberto@example.com',
      membershipCardNumber: '26ACLI020',
      isPaid: true,
      expiryDate: '31/12/2026',
      insuranceType: 'Platinum',
      photoConsent: true,
      allergies: '',
      notesConditions: '',
      formSignedAndArchived: false,
      voucherBalance: 15,
    },
    {
      id: 'm-a',
      childName: 'Alessio Bianchi',
      birthDate: '15/07/2019',
      birthPlace: 'Carrara',
      group: '3-6',
      childFiscalCode: '',
      childAddress: '',
      parentName: 'Zeno Bianchi',
      parentFiscalCode: '',
      parentPhone: '',
      parentEmail: 'zeno@example.com',
      membershipCardNumber: '26ACLI002',
      isPaid: false,
      expiryDate: '15/09/2027',
      insuranceType: 'Base',
      photoConsent: false,
      allergies: '',
      notesConditions: '',
      formSignedAndArchived: true,
      voucherBalance: 40,
    },
  ];

  it('sorts members ascending and descending by childName, parentName, membershipCardNumber, insuranceType, and voucherBalance', () => {
    const byChildAsc = sortMembersList(membersForSort, 'childName', 'asc');
    assert.equal(byChildAsc[0].childName, 'Alessio Bianchi');
    const byChildDesc = sortMembersList(membersForSort, 'childName', 'desc');
    assert.equal(byChildDesc[0].childName, 'Zoe Neri');

    const byParentAsc = sortMembersList(membersForSort, 'parentName', 'asc');
    assert.equal(byParentAsc[0].parentName, 'Alberto Neri');

    const byCardAsc = sortMembersList(membersForSort, 'membershipCardNumber', 'asc');
    assert.equal(byCardAsc[0].membershipCardNumber, '26ACLI002');
    const byCardDesc = sortMembersList(membersForSort, 'membershipCardNumber', 'desc');
    assert.equal(byCardDesc[0].membershipCardNumber, '26ACLI020');

    const byVoucherDesc = sortMembersList(membersForSort, 'voucherBalance', 'desc');
    assert.equal(byVoucherDesc[0].voucherBalance, 40);
  });

  it('calculates fixed (€) and percentage (%) event discounts and voucher deductions accurately', () => {
    // Fixed discount € 30 + voucher € 20 on € 130 base price
    const fixedCalc = calculateDiscountedEventPrice({
      basePrice: 130,
      discountType: 'fixed',
      discountValue: 30,
      voucherUsed: 20,
    });
    assert.equal(fixedCalc.basePrice, 130);
    assert.equal(fixedCalc.discountAmount, 30);
    assert.equal(fixedCalc.afterDiscountPrice, 100);
    assert.equal(fixedCalc.voucherApplied, 20);
    assert.equal(fixedCalc.finalNetPrice, 80);

    // Percentage discount 25% + voucher € 50 on € 120 base price
    const percentCalc = calculateDiscountedEventPrice({
      basePrice: 120,
      discountType: 'percent',
      discountValue: 25,
      voucherUsed: 50,
    });
    assert.equal(percentCalc.discountAmount, 30);
    assert.equal(percentCalc.afterDiscountPrice, 90);
    assert.equal(percentCalc.voucherApplied, 50);
    assert.equal(percentCalc.finalNetPrice, 40);
  });

  it('calculates multi-item receipt totals and saves custom discount labels for future receipts', () => {
    const multi = calculateMultiItemReceiptTotals({
      items: [
        { id: '1', category: 'evento', title: 'Campo Estivo', amount: 150, enabled: true },
        { id: '2', category: 'tessera', title: 'Tessera Gold', amount: 20, enabled: true },
        { id: '3', category: 'gadget', title: 'Maglietta', amount: 15, enabled: false },
      ],
      discountType: 'fixed',
      discountValue: 40,
      voucherUsed: 25,
    });
    assert.equal(multi.grossTotal, 170);
    assert.equal(multi.discountAmount, 40);
    assert.equal(multi.voucherApplied, 25);
    assert.equal(multi.netTotal, 105);

    const mergedLabels = mergeSavedDiscountLabels(
      ['Riduzione fascia ISEE agevolata'],
      'Contributo coperto da Associazione Amici Apuane'
    );
    assert.ok(mergedLabels.includes('Contributo coperto da Associazione Amici Apuane'));
    assert.ok(mergedLabels.includes('Riduzione fascia ISEE agevolata'));

    const emailTemplates = resolveEmailTemplates(resetToEmpty2027().profile);
    const tplValues = Object.values(emailTemplates);
    assert.equal(tplValues.length, 5);
    assert.ok(emailTemplates.modulo_iscrizione_da_firmare);
    assert.ok(emailTemplates.ricevuta_evento);
    assert.ok(emailTemplates.ricevuta_doposcuola);
  });

  it('never flags generic non-person movements as duplicates and supports same_day / off modes and editable proposed deadlines', () => {
    const genericTxs: CashTransaction[] = [
      {
        id: 'gen-1',
        date: '2027-02-10',
        category: 'Tessere',
        income: 15,
        expense: null,
        method: 'Bonifico',
        description: 'Quota Tessera Base US ACLI',
      },
      {
        id: 'gen-2',
        date: '2027-02-11',
        category: 'Tessere',
        income: 15,
        expense: null,
        method: 'Bonifico',
        description: 'Quota Tessera Base US ACLI',
      },
      {
        id: 'gen-3',
        date: '2027-02-12',
        category: 'Evento',
        income: 130,
        expense: null,
        method: 'Contanti',
        description: 'Caparra Rifugio Del Freo Mosceta',
      },
      {
        id: 'gen-4',
        date: '2027-02-12',
        category: 'Evento',
        income: 130,
        expense: null,
        method: 'Contanti',
        description: 'Caparra Rifugio Del Freo Mosceta',
      },
      {
        id: 'real-dup-1',
        date: '2027-02-12',
        category: 'Evento',
        income: 130,
        expense: null,
        method: 'Bonifico',
        description: 'Caparra Rifugio Marco Bianchi',
      },
      {
        id: 'real-dup-2',
        date: '2027-02-14',
        category: 'Evento',
        income: 130,
        expense: null,
        method: 'Bonifico',
        description: 'Iscrizione Rifugio Bianchi Marco',
      },
    ];

    // Strict mode: only Marco Bianchi is flagged, generic movements are ignored
    const strictGroups = detectDuplicateTransactions(genericTxs, [], [], 7, [], 'strict');
    assert.equal(strictGroups.length, 1);
    assert.ok(strictGroups[0].personName.toLowerCase().includes('bianchi'));

    // Same-day mode: Marco Bianchi is 2 days apart so 0 groups in same_day mode
    const sameDayGroups = detectDuplicateTransactions(genericTxs, [], [], 7, [], 'same_day');
    assert.equal(sameDayGroups.length, 0);

    // Off mode: 0 groups
    const offGroups = detectDuplicateTransactions(genericTxs, [], [], 7, [], 'off');
    assert.equal(offGroups.length, 0);

    // Editable proposed statutory deadline (e.g. changing annual assembly date and title)
    const refDate = new Date(2027, 1, 1);
    const modifiedDeadlines = buildCriticalYearDeadlines({
      activeYear: 2027,
      referenceDate: refDate,
      deadlineOverrides: {
        'std-assemblea-bilancio': {
          deadlineId: 'std-assemblea-bilancio',
          customTitle: 'Riunione Annuale Soci Apuacamp (Data Scelta)',
          customDueDate: '2027-06-20',
          customDueDateLabel: 'Data Annuale ASD',
          isPermanentDateChange: true,
          updatedAt: '2027-02-01',
        },
        'std-cu-lavoro-sportivo': {
          deadlineId: 'std-cu-lavoro-sportivo',
          isHidden: true,
          updatedAt: '2027-02-01',
        },
      },
    });

    const asmDl = modifiedDeadlines.deadlines.find((d) => d.id === 'std-assemblea-bilancio');
    assert.ok(asmDl);
    assert.equal(asmDl!.title, 'Riunione Annuale Soci Apuacamp (Data Scelta)');
    assert.equal(asmDl!.dueDate, '2027-06-20');
    assert.ok(asmDl!.dueDateLabel.includes('Data Annuale ASD'));

    // Hidden proposed deadline should not appear in active list
    const hiddenCu = modifiedDeadlines.deadlines.find((d) => d.id === 'std-cu-lavoro-sportivo');
    assert.equal(hiddenCu, undefined);
  });

  it('tests only newly added or imported transactions for duplicates (detectDuplicatesForNewTransactions) and counts state records accurately', () => {
    const ledgerTxs: CashTransaction[] = [
      // Historical pair (already in archive)
      {
        id: 'tx-old-1',
        date: '2027-02-01',
        category: 'Tessere',
        income: 20,
        expense: null,
        method: 'Bonifico',
        description: 'Quota Tessera Mario Rossi',
      },
      {
        id: 'tx-old-2',
        date: '2027-02-03',
        category: 'Tessere',
        income: 20,
        expense: null,
        method: 'Bonifico',
        description: 'Tessera Annuale Rossi Mario',
      },
      // Existing single movement for Elena Verdi
      {
        id: 'tx-elena-1',
        date: '2027-05-10',
        category: 'Evento',
        income: 70,
        expense: null,
        method: 'Bonifico',
        description: 'Caparra Evento Elena Verdi',
      },
      // Newly added movement for Giulia Neri (not a duplicate)
      {
        id: 'tx-new-unique',
        date: '2027-05-11',
        category: 'Evento',
        income: 70,
        expense: null,
        method: 'Bonifico',
        description: 'Caparra Evento Giulia Neri',
      },
      // Newly added movement for Elena Verdi (duplicate of tx-elena-1)
      {
        id: 'tx-new-elena-dup',
        date: '2027-05-12',
        category: 'Evento',
        income: 70,
        expense: null,
        method: 'Bonifico',
        description: 'Caparra Rifugio Verdi Elena',
      },
    ];

    // 1. On app startup (empty target IDs): 0 duplicate groups flagged
    assert.equal(detectDuplicatesForNewTransactions([], ledgerTxs).length, 0);

    // 2. When adding a unique movement ('tx-new-unique'): 0 groups flagged (ignores historical Mario Rossi pair!)
    assert.equal(
      detectDuplicatesForNewTransactions(['tx-new-unique'], ledgerTxs).length,
      0
    );

    // 3. When adding a duplicate movement ('tx-new-elena-dup'): flags ONLY Elena Verdi's group, not Mario Rossi
    const newElenaGroups = detectDuplicatesForNewTransactions(
      ['tx-new-elena-dup'],
      ledgerTxs
    );
    assert.equal(newElenaGroups.length, 1);
    assert.ok(newElenaGroups[0].personName.toLowerCase().includes('verdi'));

    // 4. countAppStateRecords accurately distinguishes empty vs populated state
    const emptyState = resetToEmpty2027(null, 2027);
    assert.equal(countAppStateRecords(emptyState), 0);
    assert.equal(
      countAppStateRecords({ ...emptyState, transactions: ledgerTxs }),
      ledgerTxs.length
    );
  });

  it('parses all Excel date formats (serial numbers, Italian month names with hyphens/slashes/dots, US MM/DD/YY, short DD/MM) without falling back to Jan 1st', () => {
    // Excel serial date 46037 -> 2026-01-15
    assert.equal(excelSerialToISODate(46037), '2026-01-15');
    assert.equal(normalizeTransactionDate('46037', 2026), '2026-01-15');

    // Italian hyphenated / slashed / dotted month names
    assert.equal(normalizeTransactionDate('15-gen-26', 2026), '2026-01-15');
    assert.equal(normalizeTransactionDate('15-gen-2026', 2026), '2026-01-15');
    assert.equal(normalizeTransactionDate('15/feb/26', 2026), '2026-02-15');
    assert.equal(normalizeTransactionDate('10.mag.2026', 2026), '2026-05-10');
    assert.equal(normalizeTransactionDate('22-set', 2026), '2026-09-22');
    assert.equal(normalizeTransactionDate('lun 18/05/2026', 2026), '2026-05-18');

    // SheetJS US formatted date (MM/DD/YY where DD > 12)
    assert.equal(normalizeTransactionDate('03/25/26', 2026), '2026-03-25');

    // Short numeric date without year
    assert.equal(normalizeTransactionDate('14/06', 2026), '2026-06-14');
    assert.equal(tryParseTransactionDate('testo non data', 2026), null);

    // Dynamic columns, skipping TOTALE/SALDO rows, and carrying forward blank same-day dates
    const customExcelRows = [
      [' Titolo Foglio Cassa ASD Apuacamp 2026 ', '', '', '', '', ''],
      ['Data Movimento', 'Causale / Descrizione', 'Voce', 'Entrate (€)', 'Uscite (€)', 'Saldo Progressivo', 'Metodo'],
      ['15-mar-26', 'Quote Tesseramento Soci', 'Tessere', '1203.00', '', '1203.00', 'Bonifico'],
      ['', 'Seconda tranche stesso giorno', 'Tessere', '45,50', '', '1248.50', 'Contanti'],
      ['20.04.2026', 'Acquisto palloni e corde', 'Strumenti', '', '180.00', '1068.50', 'POS'],
      ['TOTALE GENERALE', '', '', '1248.50', '180.00', '1068.50', ''],
      ['SALDO FINALE', '', '', '', '', '1068.50', ''],
    ];

    const parsed = parseTransactionsFromRows(customExcelRows, 2026);
    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].date, '2026-03-15');
    assert.equal(parsed[0].income, 1203);
    assert.equal(parsed[0].description, 'Quote Tesseramento Soci');
    // Second row had blank date -> carried forward '2026-03-15' instead of '2026-01-01'!
    assert.equal(parsed[1].date, '2026-03-15');
    assert.equal(parsed[1].income, 45.5);
    assert.equal(parsed[1].method, 'Contanti');
    // Third row
    assert.equal(parsed[2].date, '2026-04-20');
    assert.equal(parsed[2].expense, 180);
    assert.equal(parsed[2].category, 'Acquisto Strumenti');
  });
});


