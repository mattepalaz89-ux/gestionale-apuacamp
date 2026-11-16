import * as XLSX from 'xlsx';
import {
  CashTransaction,
  Member,
  AssociationProfile,
  ArchivedFiscalYear,
} from '../types';
import {
  formatEuro,
  calculateCashTotals,
  calculateCategoryBreakdown,
  calculateMonthlyCashFlow,
} from './finance';

/**
 * Downloads a file to the user's computer via browser blob
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string = 'text/csv;charset=utf-8;'
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Builds structured accounting tabs (Riepilogo_Bilancio, Libro_Cassa, Riepilogo_Mensile)
 * used both for Excel (.xlsx) export and Google Sheets sync.
 */
export function buildAccountingSpreadsheetTabs(params: {
  transactions: CashTransaction[];
  initialFund: number;
  initialFundBank: number;
  initialFundCash: number;
  fiscalYear: number;
  associationName: string;
}): { sheetTitle: string; rows: (string | number | boolean)[][] }[] {
  const {
    transactions,
    initialFund,
    initialFundBank,
    initialFundCash,
    fiscalYear,
    associationName,
  } = params;

  const totals = calculateCashTotals(
    transactions,
    initialFund,
    initialFundBank,
    initialFundCash
  );
  const { incomeCategories, expenseCategories } = calculateCategoryBreakdown(transactions);
  const monthly = calculateMonthlyCashFlow(transactions);

  const riepilogoRows: (string | number | boolean)[][] = [
    [`RENDICONTO ECONOMICO-FINANZIARIO ESERCIZIO ${fiscalYear} — ${associationName}`, ''],
    ['Data generazione prospetto', new Date().toLocaleDateString('it-IT')],
    ['', ''],
    ['1. RIEPILOGO SALDI E LIQUIDITÀ', 'IMPORTO (€)'],
    ['Fondo Iniziale Totale (Apertura Esercizio)', totals.initialFund],
    ['  di cui Fondo Iniziale Conto Corrente Bancario', totals.initialBank],
    ['  di cui Fondo Iniziale Cassa Contanti', totals.initialCash],
    ['Totale Entrate Esercizio (+)', totals.totalIncome],
    ['Totale Uscite e Spese Esercizio (-)', totals.totalExpense],
    ['Avanzo / Disavanzo Netto di Esercizio', totals.netBalance],
    ['SALDO TOTALE FINALE DISPONIBILE (Fondo + Flusso)', totals.currentTotal],
    ['  di cui Saldo Finale Conto Corrente Bancario', totals.currentBank],
    ['  di cui Saldo Finale Cassa Contanti', totals.currentCash],
    ['', ''],
    ['2. ENTRATE PER CATEGORIA ISTITUZIONALE', 'TOTALE (€)', 'N. OPERAZIONI'],
    ...incomeCategories.map((c) => [c.category, c.totalIncome, c.count]),
    ['', '', ''],
    ['3. USCITE E SPESE PER CATEGORIA', 'TOTALE (€)', 'N. OPERAZIONI'],
    ...expenseCategories.map((c) => [c.category, c.totalExpense, c.count]),
  ];

  const libroCassaRows: (string | number | boolean)[][] = [
    [
      'Data',
      'Categoria',
      'Entrata (€)',
      'Uscita (€)',
      'Canale Pagamento',
      'Causale / Descrizione Operazione',
      'Documento / Fattura su Drive',
    ],
    ...transactions.map((t) => [
      t.date,
      t.category,
      t.income !== null && t.income !== undefined ? t.income : '',
      t.expense !== null && t.expense !== undefined ? t.expense : '',
      t.method,
      t.description,
      t.invoiceArchivedUrl || '',
    ]),
  ];

  const mensileRows: (string | number | boolean)[][] = [
    ['Mese', 'Entrate (€)', 'Uscite (€)', 'Saldo Mensile (€)'],
    ...monthly.map((m) => [
      m.monthLabel,
      m.income,
      m.expense,
      Math.round((m.income - m.expense) * 100) / 100,
    ]),
  ];

  return [
    { sheetTitle: 'Riepilogo_Bilancio', rows: riepilogoRows },
    { sheetTitle: 'Libro_Cassa', rows: libroCassaRows },
    { sheetTitle: 'Riepilogo_Mensile', rows: mensileRows },
  ];
}

/**
 * Exports a multi-tab Excel (.xlsx) accounting workbook for the current or archived fiscal year
 */
export function exportAccountingToExcel(params: {
  transactions: CashTransaction[];
  initialFund: number;
  initialFundBank: number;
  initialFundCash: number;
  fiscalYear: number;
  associationName?: string;
}) {
  const tabs = buildAccountingSpreadsheetTabs({
    ...params,
    associationName: params.associationName || 'Apuacamp A.S.D.',
  });

  const wb = XLSX.utils.book_new();
  for (const tab of tabs) {
    const ws = XLSX.utils.aoa_to_sheet(tab.rows);
    XLSX.utils.book_append_sheet(wb, ws, tab.sheetTitle);
  }

  const filename = `Contabilita_Cassa_ASD_${params.fiscalYear}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * Exports an archived fiscal year into a complete Excel (.xlsx) workbook
 */
export function exportArchivedYearToExcel(
  archived: ArchivedFiscalYear,
  associationName: string = 'Apuacamp A.S.D.'
) {
  const accountingTabs = buildAccountingSpreadsheetTabs({
    transactions: archived.transactions,
    initialFund: archived.summary.initialFund,
    initialFundBank: archived.summary.finalBankBalance,
    initialFundCash: archived.summary.finalCashBalance,
    fiscalYear: archived.year,
    associationName,
  });

  const wb = XLSX.utils.book_new();
  for (const tab of accountingTabs) {
    const ws = XLSX.utils.aoa_to_sheet(tab.rows);
    XLSX.utils.book_append_sheet(wb, ws, tab.sheetTitle);
  }

  const sociRows = [
    [
      'Nome Bimbo/a',
      'Data Nascita',
      'Gruppo',
      'CF Bimbo',
      'Genitore',
      'Telefono',
      'Email',
      'Num Tessera',
      'Pagata',
      'Scadenza',
      'Assicurazione',
    ],
    ...archived.membersSnapshot.map((m) => [
      m.childName,
      m.birthDate,
      m.group,
      m.childFiscalCode,
      m.parentName,
      m.parentPhone,
      m.parentEmail,
      m.membershipCardNumber,
      m.isPaid ? 'SI' : 'NO',
      m.expiryDate,
      m.insuranceType,
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(sociRows),
    `Soci_${archived.year}`
  );

  XLSX.writeFile(wb, `Archivio_Annualita_${archived.year}_Apuacamp.xlsx`);
}

/**
 * Exports cash ledger transactions directly into an Excel-friendly CSV with UTF-8 BOM and Italian format.
 */
export function exportTransactionsToCSV(transactions: CashTransaction[]) {
  const headers = [
    'Data',
    'Categoria',
    'Entrata (€)',
    'Uscita (€)',
    'Canale Pagamento',
    'Descrizione',
  ];
  const rows = transactions.map((t) => [
    t.date,
    t.category,
    t.income !== null && t.income !== undefined ? t.income.toFixed(2).replace('.', ',') : '',
    t.expense !== null && t.expense !== undefined ? t.expense.toFixed(2).replace('.', ',') : '',
    t.method,
    `"${(t.description || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const filename = `Flusso_Cassa_Apuacamp_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Exports members registry to Excel-friendly CSV
 */
export function exportMembersToCSV(members: Member[]) {
  const headers = [
    'Bimbo/a',
    'Data Nascita',
    'Luogo Nascita',
    'Gruppo',
    'Codice Fiscale Bimbo',
    'Residenza',
    'Genitore',
    'Codice Fiscale Genitore',
    'Telefono',
    'Email',
    'Num Tessera',
    'Tessera Pagata',
    'Scadenza',
    'Tipo Assicurazione',
    'Consenso Foto',
    'Allergie',
    'Condizioni Particolari',
    'Modulo Firmato',
  ];

  const rows = members.map((m) => [
    `"${m.childName.replace(/"/g, '""')}"`,
    m.birthDate,
    `"${m.birthPlace.replace(/"/g, '""')}"`,
    m.group,
    m.childFiscalCode,
    `"${m.childAddress.replace(/"/g, '""')}"`,
    `"${m.parentName.replace(/"/g, '""')}"`,
    m.parentFiscalCode,
    m.parentPhone,
    m.parentEmail,
    m.membershipCardNumber,
    m.isPaid ? 'SI' : 'NO',
    m.expiryDate,
    m.insuranceType,
    m.photoConsent ? 'SI' : 'NO',
    `"${(m.allergies || '').replace(/"/g, '""')}"`,
    `"${(m.notesConditions || '').replace(/"/g, '""')}"`,
    m.formSignedAndArchived ? 'SI' : 'NO',
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const filename = `Anagrafica_Soci_Apuacamp_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * Generates email mailto link for payment receipt or quote
 */
export function generateReceiptEmailLink(params: {
  toEmail: string;
  parentName: string;
  childName: string;
  activityName: string;
  amount: number;
  type: 'ricevuta' | 'preventivo' | 'sollecito';
  receiptNumber?: string;
  insuranceType?: string;
  association: AssociationProfile;
}): string {
  const {
    toEmail,
    parentName,
    childName,
    activityName,
    amount,
    type,
    receiptNumber,
    insuranceType,
    association,
  } = params;

  let subject = '';
  let body = '';

  if (type === 'ricevuta') {
    subject = `[${association.name}] Ricevuta di Pagamento n. ${
      receiptNumber || '2027-X'
    } - ${childName}`;
    body =
      `Gentile ${parentName},\n\n` +
      `Confermiamo la ricezione del pagamento di ${formatEuro(
        amount
      )} per la quota di partecipazione di ${childName} all'attività:\n` +
      `▶ ${activityName}\n` +
      (insuranceType ? `▶ Copertura assicurativa UsAcli: ${insuranceType}\n` : '') +
      `\nLa quota è registrata come corrispettivo non commerciale / quota associativa istituzionale ai sensi dell'art. 148 del TUIR.\n\n` +
      `In allegato troverà la ricevuta quietanzata in formato PDF.\n\n` +
      `Un caro saluto,\n` +
      `Lo Staff di ${association.name}\n` +
      `${association.email} | ${association.phone}`;
  } else if (type === 'preventivo') {
    subject = `[${association.name}] Riepilogo Iscrizione e Preventivo Quota - ${childName}`;
    body =
      `Gentile ${parentName},\n\n` +
      `Ti inviamo il prospetto informativo e riepilogo delle quote previste per l'iscrizione di ${childName} all'attività:\n` +
      `▶ ${activityName}\n` +
      `▶ Quota totale prevista: ${formatEuro(amount)}\n` +
      (insuranceType ? `▶ Livello assicurativo UsAcli selezionato: ${insuranceType}\n` : '') +
      `\nPer confermare la prenotazione, ti ricordiamo di effettuare il versamento della caparra / quota tramite bonifico a:\n` +
      `IBAN: ${association.iban}\n` +
      `Intestato a: ${association.name}\n` +
      `Causale: ${activityName} - ${childName}\n\n` +
      `A presto sui sentieri!\n` +
      `Lo Staff di ${association.name}`;
  } else {
    subject = `[${association.name}] Promemoria Saldo Quota - ${activityName} - ${childName}`;
    body =
      `Gentile ${parentName},\n\n` +
      `Ti inviamo un gentile promemoria relativo al saldo della quota di ${formatEuro(
        amount
      )} per l'attività in programma:\n` +
      `▶ ${activityName} per ${childName}\n\n` +
      `Ti invitiamo a regolarizzare la quota tramite bonifico (IBAN: ${association.iban}) o al ritrovo della partenza.\n\n` +
      `Grazie per la collaborazione!\n` +
      `${association.name}`;
  }

  return `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
