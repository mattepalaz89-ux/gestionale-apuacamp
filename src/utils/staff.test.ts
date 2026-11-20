import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStaffAnnualSummary,
  findLegacyUnlinkedStaffPayments,
  matchesLegacyStaffFullName,
  matchMemberForRegistration,
} from './staff';
import { calculateCashTotals } from './finance';
import { CashTransaction, Member, StaffMember } from '../types';

test('Staff Totals & Whole-Word Matching - Emma e Gemma separati, Nicola omonimi separati, rimborsi esclusi', () => {
  const emma: StaffMember = {
    id: 'st-emma',
    name: 'Emma',
    role: 'Educatrice',
  };
  const gemma: StaffMember = {
    id: 'st-gemma',
    name: 'Gemma',
    role: 'Educatrice',
  };
  const nicolaRossi: StaffMember = {
    id: 'st-nicola-1',
    name: 'Nicola Rossi',
    role: 'Guida',
  };
  const nicolaBianchi: StaffMember = {
    id: 'st-nicola-2',
    name: 'Nicola Bianchi',
    role: 'Guida',
  };

  assert.equal(matchesLegacyStaffFullName('Gemma - Quota lavoro sportivo', 'Emma'), false);
  assert.equal(matchesLegacyStaffFullName('Emma - Quota lavoro sportivo', 'Emma'), true);
  assert.equal(
    matchesLegacyStaffFullName('Nicola Rossi - Servizi guida', 'Nicola Bianchi'),
    false
  );

  const txs: CashTransaction[] = [
    {
      id: 'tx-1',
      date: '2027-03-10',
      category: 'Staff',
      income: null,
      expense: 600,
      method: 'Bonifico',
      description: 'Emma - Quota lavoro sportivo',
    },
    {
      id: 'tx-2',
      date: '2027-03-15',
      category: 'Staff',
      income: null,
      expense: 900,
      method: 'Bonifico',
      description: 'Gemma - Quota lavoro sportivo',
    },
    {
      id: 'tx-3',
      date: '2027-04-01',
      category: 'Staff',
      income: null,
      expense: 150,
      method: 'Bonifico',
      staffId: 'st-emma',
      staffPaymentKind: 'rimborso_spese',
      description: 'Emma - Rimborso spese vive (piè di lista)',
    },
    {
      id: 'tx-4',
      date: '2027-04-12',
      category: 'Staff',
      income: null,
      expense: 400,
      method: 'Bonifico',
      description: 'Nicola Rossi - Servizi guida',
    },
    {
      id: 'tx-5',
      date: '2027-04-15',
      category: 'Staff',
      income: null,
      expense: 750,
      method: 'Bonifico',
      description: 'Nicola Bianchi - Servizi guida',
    },
  ];

  const emmaSummary = calculateStaffAnnualSummary(emma, txs, 2027);
  const gemmaSummary = calculateStaffAnnualSummary(gemma, txs, 2027);
  const nicola1Summary = calculateStaffAnnualSummary(nicolaRossi, txs, 2027);
  const nicola2Summary = calculateStaffAnnualSummary(nicolaBianchi, txs, 2027);

  // Emma ha 600 € di compenso sportivo + 150 € di rimborso spese (escluso dalle soglie)
  assert.equal(emmaSummary.asdCompensation, 600);
  assert.equal(emmaSummary.asdReimbursements, 150);
  assert.equal(emmaSummary.totalAsdPaid, 750);
  assert.equal(emmaSummary.cumulativeAnnualCompensation, 600);

  // Gemma ha solo i suoi 900 €
  assert.equal(gemmaSummary.asdCompensation, 900);
  assert.equal(gemmaSummary.cumulativeAnnualCompensation, 900);

  // I due Nicola non si sommano
  assert.equal(nicola1Summary.asdCompensation, 400);
  assert.equal(nicola2Summary.asdCompensation, 750);

  // Azione "Collega i vecchi pagamenti" trova i 4 movimenti senza staffId
  const legacyMatches = findLegacyUnlinkedStaffPayments(
    [emma, gemma, nicolaRossi, nicolaBianchi],
    txs
  );
  assert.equal(legacyMatches.length, 4);
});

test('Staff Thresholds D.Lgs. 36/2021 - 4.000 € (warning 80%), 5.001 € (INPS), 15.001 € (IRPEF) inclusi compensi presso altre ASD', () => {
  const collab: StaffMember = {
    id: 'st-1',
    name: 'Marco Valli',
    role: 'Istruttore Sportivo',
    otherAssociationsCompensationByYear: {
      2027: 2500, // 2.500 € percepiti presso altre ASD
    },
  };

  // 1) 1.500 € nostra ASD + 2.500 € altre ASD = 4.000 € -> warning_inps (80% di 5.000 €)
  const txs4000: CashTransaction[] = [
    {
      id: 'tx-a',
      date: '2027-05-10',
      category: 'Staff',
      income: null,
      expense: 1500,
      method: 'Bonifico',
      staffId: 'st-1',
      staffPaymentKind: 'compenso_sportivo',
      description: 'Marco Valli - Compenso sportivo',
    },
  ];
  const sum4000 = calculateStaffAnnualSummary(collab, txs4000, 2027);
  assert.equal(sum4000.cumulativeAnnualCompensation, 4000);
  assert.equal(sum4000.thresholdStatus, 'warning_inps');
  assert.equal(sum4000.inpsExcessAmount, 0);

  // 2) 2.501 € nostra ASD + 2.500 € altre ASD = 5.001 € -> exceeded_inps (> 5.000 €)
  const txs5001: CashTransaction[] = [
    ...txs4000,
    {
      id: 'tx-b',
      date: '2027-06-10',
      category: 'Staff',
      income: null,
      expense: 1001,
      method: 'Bonifico',
      staffId: 'st-1',
      staffPaymentKind: 'compenso_sportivo',
      description: 'Marco Valli - Compenso giugno',
    },
  ];
  const sum5001 = calculateStaffAnnualSummary(collab, txs5001, 2027);
  assert.equal(sum5001.cumulativeAnnualCompensation, 5001);
  assert.equal(sum5001.thresholdStatus, 'exceeded_inps');
  assert.equal(sum5001.inpsExcessAmount, 1);
  assert.equal(sum5001.irpefExcessAmount, 0);

  // 3) 12.501 € nostra ASD + 2.500 € altre ASD = 15.001 € -> exceeded_irpef (> 15.000 €)
  const txs15001: CashTransaction[] = [
    ...txs5001,
    {
      id: 'tx-c',
      date: '2027-09-10',
      category: 'Staff',
      income: null,
      expense: 10000,
      method: 'Bonifico',
      staffId: 'st-1',
      staffPaymentKind: 'compenso_sportivo',
      description: 'Marco Valli - Compenso estate',
    },
  ];
  const sum15001 = calculateStaffAnnualSummary(collab, txs15001, 2027);
  assert.equal(sum15001.cumulativeAnnualCompensation, 15001);
  assert.equal(sum15001.thresholdStatus, 'exceeded_irpef');
  assert.equal(sum15001.inpsExcessAmount, 10001);
  assert.equal(sum15001.irpefExcessAmount, 1);
});

test('Saldi con PayPal separato dal Conto Corrente Bancario e scelta strumento per uscite PayPal', () => {
  const txs: CashTransaction[] = [
    // Entrata con Bonifico -> Banca (+200)
    {
      id: 't1',
      date: '2027-02-01',
      category: 'Tessere',
      income: 200,
      expense: null,
      method: 'Bonifico',
      description: 'Quote tessere bonifico',
    },
    // Entrata con PayPal -> Conto PayPal (+80)
    {
      id: 't2',
      date: '2027-02-02',
      category: 'Evento',
      income: 80,
      expense: null,
      method: 'Paypal',
      description: 'Iscrizione evento via PayPal',
    },
    // Entrata in Contanti -> Cassa (+50)
    {
      id: 't3',
      date: '2027-02-03',
      category: 'Gadget',
      income: 50,
      expense: null,
      method: 'Contanti',
      description: 'Gadget contanti',
    },
    // Uscita con PayPal addebitata di default sul Conto Corrente Bancario (accountId: 'banca', -30)
    {
      id: 't4',
      date: '2027-02-04',
      category: 'Acquisto Strumenti',
      income: null,
      expense: 30,
      method: 'Paypal',
      accountId: 'banca',
      description: 'Acquisto materiale con PayPal (carta banca)',
    },
  ];

  // Fondo iniziale: Banca 1000 €, Cassa 100 €, PayPal 0 € -> initialFund calcolato = 1100 €
  const totals = calculateCashTotals(txs, 9999, 1000, 100, {
    initialPaypal: 0,
  });

  assert.equal(totals.initialFund, 1100);
  // Banca: 1000 + 200 (bonifico) - 30 (uscita PayPal addebitata su banca) = 1170 €
  assert.equal(totals.currentBank, 1170);
  // PayPal: 0 + 80 (entrata PayPal) = 80 € (separato dalla banca!)
  assert.equal(totals.currentPaypal, 80);
  // Cassa: 100 + 50 = 150 €
  assert.equal(totals.currentCash, 150);
  // Totale complessivo: 1170 + 80 + 150 = 1400 €
  assert.equal(totals.currentTotal, 1400);
});

test('matchMemberForRegistration - associa prima per CF, poi per nome+data di nascita, e segnala omonimi', () => {
  const members: Member[] = [
    {
      id: 'm-1',
      childName: 'Luca Bianchi',
      birthDate: '2016-05-10',
      birthPlace: 'Massa',
      group: '6-11',
      childFiscalCode: 'BNCLCU16E10F023A',
      childAddress: 'Via Roma 1',
      parentName: 'Paolo Bianchi',
      parentFiscalCode: '',
      parentPhone: '',
      parentEmail: '',
      membershipCardNumber: '001',
      isPaid: true,
      expiryDate: '2027-12-31',
      insuranceType: 'Gold',
      photoConsent: true,
      allergies: '',
      notesConditions: '',
      formSignedAndArchived: true,
    },
    {
      id: 'm-2',
      childName: 'Luca Bianchi',
      birthDate: '2018-09-22',
      birthPlace: 'Carrara',
      group: '6-11',
      childFiscalCode: 'BNCLCU18P22B832Z',
      childAddress: 'Via Verdi 5',
      parentName: 'Marco Bianchi',
      parentFiscalCode: '',
      parentPhone: '',
      parentEmail: '',
      membershipCardNumber: '002',
      isPaid: true,
      expiryDate: '2027-12-31',
      insuranceType: 'Gold',
      photoConsent: true,
      allergies: '',
      notesConditions: '',
      formSignedAndArchived: true,
    },
  ];

  // 1. Match per Codice Fiscale -> disambigua i due omonimi
  const byCf = matchMemberForRegistration(members, {
    childName: 'Luca Bianchi',
    childFiscalCode: 'BNCLCU18P22B832Z',
  });
  assert.equal(byCf.status, 'unique');
  assert.equal(byCf.member?.id, 'm-2');

  // 2. Match per Nome + Data di nascita -> disambigua i due omonimi
  const byBirth = matchMemberForRegistration(members, {
    childName: 'Luca Bianchi',
    birthDate: '10/05/2016',
  });
  assert.equal(byBirth.status, 'unique');
  assert.equal(byBirth.member?.id, 'm-1');

  // 3. Solo nome in presenza di omonimi -> ambiguous
  const ambiguous = matchMemberForRegistration(members, {
    childName: 'Luca Bianchi',
  });
  assert.equal(ambiguous.status, 'ambiguous');
  assert.equal(ambiguous.candidates.length, 2);
});
