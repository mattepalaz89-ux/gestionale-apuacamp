import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Printer,
  Download,
  Upload,
  RotateCcw,
  Edit3,
  Wallet,
  HardDrive,
  ExternalLink,
  RefreshCw,
  Paperclip,
  Archive,
  AlertTriangle,
  CopyCheck,
} from 'lucide-react';
import {
  CashTransaction,
  CashCategory,
  PaymentMethod,
  Member,
  AssociationProfile,
  DuplicateTransactionGroup,
  RecurringExpensePlan,
} from '../types';
import { formatEuro, calculateCashTotals } from '../utils/finance';
import { RecurringExpensesPanel } from './RecurringExpensesPanel';
import { TransactionDateSelector } from './TransactionDateSelector';
import {
  exportTransactionsToCSV,
  exportAccountingToExcel,
  buildAccountingSpreadsheetTabs,
} from '../utils/export';
import {
  downloadEmptyExcelTemplate,
  readUploadedSpreadsheetRows,
  parseTransactionsFromRows,
} from '../utils/csvExcelImporter';
import {
  syncAccountingGoogleSheet,
  uploadFileToDrive,
} from '../services/googleWorkspace';

interface CashFlowViewProps {
  transactions: CashTransaction[];
  members: Member[];
  profile: AssociationProfile;
  googleUserEmail: string | null;
  initialFund: number;
  initialFundBank: number;
  initialFundCash: number;
  duplicateGroups?: DuplicateTransactionGroup[];
  onOpenDuplicatesModal?: () => void;
  onLoadSampleDuplicates?: () => void;
  recurringExpenses?: RecurringExpensePlan[];
  onAddRecurringExpense?: (
    plan: Omit<RecurringExpensePlan, 'id'>,
    autoGenerateCurrentYearTransactions: boolean
  ) => void;
  onDeleteRecurringExpense?: (id: string) => void;
  onRegisterRecurringOccurrences?: (newTransactions: Omit<CashTransaction, 'id'>[]) => void;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onUpdateTransaction?: (tx: CashTransaction) => void;
  onDeleteTransaction: (id: string) => void;
  onImportTransactions: (
    txs: CashTransaction[],
    mode: 'append' | 'replace',
    newFunds?: { initialFund: number; initialFundBank: number; initialFundCash: number }
  ) => void;
  onUpdateInitialFunds: (funds: {
    initialFund: number;
    initialFundBank: number;
    initialFundCash: number;
  }) => void;
  onUpdateProfile: (profile: AssociationProfile) => void;
  onOpenReceiptModalForTransaction: (tx: CashTransaction) => void;
  onNavigateToArchive?: () => void;
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  transactions,
  profile,
  googleUserEmail,
  initialFund,
  initialFundBank,
  initialFundCash,
  duplicateGroups = [],
  onOpenDuplicatesModal,
  onLoadSampleDuplicates,
  recurringExpenses = [],
  onAddRecurringExpense,
  onDeleteRecurringExpense,
  onRegisterRecurringOccurrences,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onImportTransactions,
  onUpdateInitialFunds,
  onUpdateProfile,
  onOpenReceiptModalForTransaction,
  onNavigateToArchive,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
    linkUrl?: string;
    linkLabel?: string;
  } | null>(null);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);

  // Set of transaction IDs involved in any duplicate group
  const duplicateTxInfoMap = useMemo(() => {
    const map = new Map<string, { isSuggestedDuplicate: boolean; personName: string; daysSpan: number }>();
    for (const grp of duplicateGroups) {
      map.set(grp.originalTransaction.id, {
        isSuggestedDuplicate: false,
        personName: grp.personName,
        daysSpan: grp.daysSpan,
      });
      for (const dup of grp.duplicateTransactions) {
        map.set(dup.id, {
          isSuggestedDuplicate: true,
          personName: grp.personName,
          daysSpan: grp.daysSpan,
        });
      }
    }
    return map;
  }, [duplicateGroups]);

  const totalExtraDuplicatesCount = useMemo(
    () => duplicateGroups.reduce((acc, g) => acc + g.duplicateTransactions.length, 0),
    [duplicateGroups]
  );

  // Edit Initial Fund Modal
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [editBank, setEditBank] = useState(String(initialFundBank));
  const [editCash, setEditCash] = useState(String(initialFundCash));

  // Modal State for adding transaction
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDateMode, setNewDateMode] = useState<'today' | 'custom'>('today');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newCategory, setNewCategory] = useState<CashCategory>('Evento');
  const [newMethod, setNewMethod] = useState<PaymentMethod>('Bonifico');
  const [newType, setNewType] = useState<'income' | 'expense'>('income');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');

  const totals = calculateCashTotals(transactions, initialFund, initialFundBank, initialFundCash);

  const categories: CashCategory[] = [
    'Evento',
    'SummerCamp',
    'Selva',
    'Tessere',
    'Staff',
    'Tasse e Formalità',
    'Servizi esterni',
    'Acquisto Strumenti',
    'Gadget',
    'Marketing',
    'Bandi e Fondi Pubbl',
    'Donazioni enti',
    'Altro',
  ];

  const methods: PaymentMethod[] = [
    'Bonifico',
    'Contanti',
    'POS',
    'Bancomat',
    'Paypal',
    'Pagam Online',
  ];

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;
      if (selectedMethod !== 'ALL' && t.method !== selectedMethod) return false;
      if (selectedType === 'INCOME' && (!t.income || t.income <= 0)) return false;
      if (selectedType === 'EXPENSE' && (!t.expense || t.expense <= 0)) return false;
      if (search) {
        const q = search.toLowerCase();
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const catMatch = (t.category || '').toLowerCase().includes(q);
        const methMatch = (t.method || '').toLowerCase().includes(q);
        return descMatch || catMatch || methMatch;
      }
      return true;
    });
  }, [transactions, selectedCategory, selectedMethod, selectedType, search]);

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(newAmount.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0 || !newDescription.trim()) return;

    const effectiveDate =
      newDateMode === 'today' ? new Date().toISOString().slice(0, 10) : newDate;

    onAddTransaction({
      date: effectiveDate,
      category: newCategory,
      method: newMethod,
      income: newType === 'income' ? parsed : null,
      expense: newType === 'expense' ? parsed : null,
      description: newDescription.trim(),
    });

    setIsAddModalOpen(false);
    setNewAmount('');
    setNewDescription('');
  };

  const handleSaveFunds = (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseFloat(editBank.replace(',', '.')) || 0;
    const c = parseFloat(editCash.replace(',', '.')) || 0;
    onUpdateInitialFunds({
      initialFund: Math.round((b + c) * 100) / 100,
      initialFundBank: b,
      initialFundCash: c,
    });
    setIsFundModalOpen(false);
  };

  const handleUploadCashFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readUploadedSpreadsheetRows(file);
      const parsed = parseTransactionsFromRows(rows, profile.activeYear);
      if (parsed.length === 0) {
        setBannerMsg({
          type: 'err',
          text: 'Nessun movimento valido trovato nel file. Verifica le colonne del Modello Vuoto.',
        });
      } else {
        onImportTransactions(parsed, 'append');
        setBannerMsg({
          type: 'ok',
          text: `Importati ${parsed.length} movimenti di cassa dal file "${file.name}"!`,
        });
      }
    } catch (err: any) {
      setBannerMsg({
        type: 'err',
        text: err?.message || 'Errore nella lettura del file Excel/CSV.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleExportAccountingExcel = () => {
    exportAccountingToExcel({
      transactions,
      initialFund,
      initialFundBank,
      initialFundCash,
      fiscalYear: profile.activeYear,
      associationName: profile.name,
    });
    setBannerMsg({
      type: 'ok',
      text: `File Excel contabilità multi-scheda (Riepilogo Bilancio, Libro Cassa e Riepilogo Mensile ${profile.activeYear}) scaricato con successo!`,
    });
  };

  // Save or update the Accounting Google Sheet inside "Gestionale ASD / 02_Contabilita_e_Cassa"
  const handleSyncAccountingGoogleSheet = async () => {
    if (!googleUserEmail) {
      setBannerMsg({
        type: 'err',
        text: 'Connetti prima il tuo account Google Workspace per salvare e aggiornare il foglio contabilità su Google Sheets.',
      });
      return;
    }

    const actionText = profile.accountingGoogleSheetId
      ? `Confermi l'aggiornamento del Foglio Google di Contabilità (${profile.activeYear}) nella cartella Google Drive "Gestionale ASD / 02_Contabilita_e_Cassa"?`
      : `Confermi la creazione e il salvataggio del Foglio Google di Contabilità (${profile.activeYear}) nella cartella Google Drive "Gestionale ASD / 02_Contabilita_e_Cassa"?`;

    if (!confirm(actionText)) return;

    setIsSyncingGoogle(true);
    setBannerMsg(null);
    try {
      const tabs = buildAccountingSpreadsheetTabs({
        transactions,
        initialFund,
        initialFundBank,
        initialFundCash,
        fiscalYear: profile.activeYear,
        associationName: profile.name,
      });

      const res = await syncAccountingGoogleSheet({
        existingSpreadsheetId: profile.accountingGoogleSheetId,
        title: `Contabilita_Cassa_${profile.name.replace(/\s+/g, '_')}_${profile.activeYear}`,
        tabs,
      });

      onUpdateProfile({
        ...profile,
        accountingGoogleSheetId: res.spreadsheetId,
        accountingGoogleSheetUrl: res.spreadsheetUrl,
      });

      setBannerMsg({
        type: 'ok',
        text: `Foglio Google di Contabilità ${profile.activeYear} salvato e aggiornato nella cartella "Gestionale ASD / 02_Contabilita_e_Cassa"!`,
        linkUrl: res.spreadsheetUrl,
        linkLabel: 'Apri Foglio Contabilità su Google Sheets',
      });
    } catch (err: any) {
      setBannerMsg({
        type: 'err',
        text: err?.message || 'Errore nella sincronizzazione del foglio contabilità su Google Sheets.',
      });
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  // Upload invoice/receipt attachment for a transaction directly to "Gestionale ASD / 02_Contabilita_e_Cassa"
  const handleUploadInvoiceToDrive = async (
    e: React.ChangeEvent<HTMLInputElement>,
    tx: CashTransaction
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!googleUserEmail) {
      setBannerMsg({
        type: 'err',
        text: 'Connetti il tuo account Google per archiviare fatture e giustificativi nella cartella "Gestionale ASD / 02_Contabilita_e_Cassa".',
      });
      e.target.value = '';
      return;
    }

    if (
      !confirm(
        `Vuoi archiviare il giustificativo/fattura "${file.name}" per il movimento "${tx.description}" nella cartella Google Drive "Gestionale ASD / 02_Contabilita_e_Cassa"?`
      )
    ) {
      e.target.value = '';
      return;
    }

    setIsSyncingGoogle(true);
    try {
      const uploaded = await uploadFileToDrive({
        name: `Giustificativo_${tx.date}_${file.name}`,
        content: file,
        mimeType: file.type || 'application/octet-stream',
        category: 'contabilita_cassa',
      });

      if (onUpdateTransaction) {
        onUpdateTransaction({
          ...tx,
          invoiceArchivedUrl: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
        });
      }

      setBannerMsg({
        type: 'ok',
        text: `Giustificativo "${uploaded.name}" salvato in "Gestionale ASD / 02_Contabilita_e_Cassa"!`,
        linkUrl: uploaded.webViewLink,
        linkLabel: 'Vedi Fattura su Drive',
      });
    } catch (err: any) {
      setBannerMsg({
        type: 'err',
        text: err?.message || 'Errore nel caricamento del giustificativo su Google Drive.',
      });
    } finally {
      setIsSyncingGoogle(false);
      e.target.value = '';
    }
  };

  const handleZeroCashFlow = () => {
    if (
      confirm(
        `Confermi l'azzeramento completo dei flussi di cassa e del fondo iniziale dell'anno ${profile.activeYear}?`
      )
    ) {
      onImportTransactions([], 'replace', {
        initialFund: 0,
        initialFundBank: 0,
        initialFundCash: 0,
      });
      setBannerMsg({
        type: 'ok',
        text: `Flussi di cassa azzerati per l'esercizio ${profile.activeYear}.`,
      });
    }
  };

  return (
    <div className="space-y-5">
      {/* Streamlined Top Bar + Collapsible Import / Google Sheets / Strumenti Drawer (Soluzione 5) */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>Contabilità & Libro Cassa {profile.activeYear}</span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenDuplicatesModal && (
              <button
                id="btn-cashflow-open-duplicates-modal"
                type="button"
                onClick={onOpenDuplicatesModal}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  duplicateGroups.length > 0
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
                title="Apri il popup di controllo ed eliminazione movimenti duplicati (stessa persona e stesso importo entro 7 giorni)"
              >
                {duplicateGroups.length > 0 ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                ) : (
                  <CopyCheck className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>
                  {duplicateGroups.length > 0
                    ? `Alert Duplicati (${totalExtraDuplicatesCount})`
                    : 'Controlla Duplicati'}
                </span>
              </button>
            )}

            <button
              onClick={handleExportAccountingExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Esporta Excel (.xlsx)</span>
            </button>

            <button
              id="btn-cashflow-toggle-import-drawer"
              type="button"
              onClick={() => setIsImportDrawerOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                isImportDrawerOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
              title="Apri o chiudi il cassetto per importare da Excel/CSV, sincronizzare Google Sheets o archiviare l'annualità"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Importa / Google Sheets & Strumenti {isImportDrawerOpen ? '▴' : '▾'}</span>
            </button>
          </div>
        </div>

        {isImportDrawerOpen && (
          <div
            id="cashflow-import-drawer-panel"
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150"
          >
            <span className="text-slate-600 font-medium">
              Importazione Excel/CSV, sincronizzazione Google Sheets e strumenti avanzati:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => downloadEmptyExcelTemplate('cassa')}
                title="Scarica Modello Cassa Vuoto (.xlsx)"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Modello Cassa Vuoto</span>
              </button>

              <label
                title="Importa movimenti di cassa da file Excel (.xlsx) o CSV"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importa Cassa Excel/CSV</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleUploadCashFile}
                  className="hidden"
                />
              </label>

              <button
                onClick={handleSyncAccountingGoogleSheet}
                disabled={isSyncingGoogle}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                title="Salva o aggiorna il foglio contabilità nella cartella Google Drive Gestionale ASD / 02_Contabilita_e_Cassa"
              >
                {isSyncingGoogle ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <HardDrive className="w-3.5 h-3.5" />
                )}
                <span>
                  {profile.accountingGoogleSheetId
                    ? 'Aggiorna Google Sheets'
                    : 'Salva su Google Sheets'}
                </span>
              </button>

              {profile.accountingGoogleSheetUrl && (
                <a
                  href={profile.accountingGoogleSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                >
                  <span>Apri Foglio Google</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {duplicateGroups.length === 0 && onLoadSampleDuplicates && (
                <button
                  id="btn-cashflow-simulate-duplicates"
                  type="button"
                  onClick={onLoadSampleDuplicates}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                  title="Carica 2 coppie di movimenti simili entro 7 giorni per testare l'alert e il popup di cancellazione duplicati"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simula Duplicati (Test)</span>
                </button>
              )}

              {onNavigateToArchive && (
                <button
                  onClick={onNavigateToArchive}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                  title="Archivia l'annualità corrente e passa al nuovo anno"
                >
                  <Archive className="w-3.5 h-3.5 text-slate-600" />
                  <span>Archivia Anno {profile.activeYear}</span>
                </button>
              )}

              {(transactions.length > 0 || initialFund > 0) && (
                <button
                  onClick={handleZeroCashFlow}
                  title={`Azzera Cassa ${profile.activeYear}`}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Azzera Cassa</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Prominent Clickable Duplicate Alert Banner inside CashFlowView */}
      {duplicateGroups.length > 0 && onOpenDuplicatesModal && (
        <div
          id="cashflow-duplicate-alert-banner"
          onClick={onOpenDuplicatesModal}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenDuplicatesModal();
          }}
          className="bg-amber-50 hover:bg-amber-100/80 border-2 border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 cursor-pointer transition-all shadow-xs"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-amber-950 flex items-center gap-2 flex-wrap">
                <span>
                  Attenzione: Rilevati {duplicateGroups.length}{' '}
                  {duplicateGroups.length === 1
                    ? 'gruppo di possibili movimenti duplicati'
                    : 'gruppi di possibili movimenti duplicati'}{' '}
                  ({totalExtraDuplicatesCount}{' '}
                  {totalExtraDuplicatesCount === 1 ? 'movimento doppio' : 'movimenti doppi'})
                </span>
                <span className="px-2 py-0.5 rounded-sm bg-rose-600 text-white font-mono text-[10px] uppercase">
                  Entro 7 giorni max
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-0.5">
                Sono presenti movimenti simili riferiti alla <strong>stessa persona</strong> e dello{' '}
                <strong>stesso importo</strong> a distanza di massimo una settimana:{' '}
                <strong>
                  {duplicateGroups
                    .map((g) => `${g.personName} (${formatEuro(g.amount)})`)
                    .join(' · ')}
                </strong>
                . Clicca qui per aprire il popup e cancellarli tutti insieme o uno per uno.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDuplicatesModal();
            }}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 self-end sm:self-auto shadow-2xs"
          >
            Apri Popup Duplicati ({totalExtraDuplicatesCount})
          </button>
        </div>
      )}

      {bannerMsg && (
        <div
          className={`px-4 py-3 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 border ${
            bannerMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="font-medium">{bannerMsg.text}</span>
          <div className="flex items-center gap-3">
            {bannerMsg.linkUrl && (
              <a
                href={bannerMsg.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold underline"
              >
                <span>{bannerMsg.linkLabel || 'Apri in Google Drive'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={() => setBannerMsg(null)} className="font-bold px-2">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Financial Health Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="text-[11px] text-slate-500 font-medium">Saldo Totale Attuale</div>
          <div className="text-xl font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
            {formatEuro(totals.currentTotal)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
            Fondo iniziale: {formatEuro(initialFund)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 font-medium">Entrate Registrate</div>
          <div className="text-xl font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
            {formatEuro(totals.totalIncome)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500 font-medium">Uscite e Spese</div>
          <div className="text-xl font-bold text-rose-700 font-mono tabular-nums mt-0.5">
            {formatEuro(totals.totalExpense)}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Disponibilità C/C + Cassa</div>
            <div className="text-xs font-mono text-slate-700 mt-1 flex flex-col">
              <span>Banca: {formatEuro(totals.currentBank)}</span>
              <span>Contanti: {formatEuro(totals.currentCash)}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setEditBank(String(initialFundBank));
              setEditCash(String(initialFundCash));
              setIsFundModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Imposta il fondo cassa di partenza"
          >
            <Edit3 className="w-3 h-3" />
            <span>Fondo Iniziale</span>
          </button>
        </div>
      </div>

      {/* Recurring Expenses Panel (Spese Ricorrenti Mensili, Annue o a Tempo Determinato) */}
      {onAddRecurringExpense && onDeleteRecurringExpense && onRegisterRecurringOccurrences && (
        <RecurringExpensesPanel
          recurringExpenses={recurringExpenses}
          transactions={transactions}
          activeYear={profile.activeYear}
          onAddRecurringExpense={(newPlan, autoGenerate) => {
            onAddRecurringExpense(newPlan, autoGenerate);
            setBannerMsg({
              type: 'ok',
              text: autoGenerate
                ? `Spesa ricorrente "${newPlan.title}" salvata e rate registrate nel Libro Cassa!`
                : `Piano di spesa ricorrente "${newPlan.title}" configurato con successo.`,
            });
          }}
          onDeleteRecurringExpense={(id) => {
            onDeleteRecurringExpense(id);
            setBannerMsg({
              type: 'ok',
              text: 'Piano di spesa ricorrente rimosso (i movimenti già contabilizzati restano nel Libro Cassa).',
            });
          }}
          onRegisterOccurrencesInCashFlow={(newTxs) => {
            onRegisterRecurringOccurrences(newTxs);
            setBannerMsg({
              type: 'ok',
              text: `Contabilizzate ${newTxs.length} ${
                newTxs.length === 1 ? 'rata di spesa ricorrente' : 'rate di spesa ricorrente'
              } nel Libro Cassa!`,
            });
          }}
        />
      )}

      {/* Control Bar: Search, Category Filter, Method Filter, Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtra per causale o socio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">Tutte le Categorie ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">Tutti i Canali</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            <button
              onClick={() => setSelectedType('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tutti ({transactions.length})
            </button>
            <button
              onClick={() => setSelectedType('INCOME')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedType === 'INCOME'
                  ? 'bg-white text-emerald-800 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entrate
            </button>
            <button
              onClick={() => setSelectedType('EXPENSE')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedType === 'EXPENSE'
                  ? 'bg-white text-rose-800 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Uscite
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => exportTransactionsToCSV(filteredTransactions)}
            title="Esporta Movimenti Filtrati in CSV"
            aria-label="Esporta Movimenti Filtrati in CSV"
            className="flex items-center justify-center p-2 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </button>

          <button
            id="btn-cashflow-add-transaction"
            onClick={() => {
              setNewDateMode('today');
              setNewDate(new Date().toISOString().slice(0, 10));
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Aggiungi Movimento</span>
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-28">Data</th>
                <th className="py-3 px-4 w-32">Categoria</th>
                <th className="py-3 px-4">Causale & Dettagli</th>
                <th className="py-3 px-4 w-28">Canale</th>
                <th className="py-3 px-4 text-right w-28">Entrata</th>
                <th className="py-3 px-4 text-right w-28">Uscita</th>
                <th className="py-3 px-4 text-center w-28">Azioni & Drive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="max-w-md mx-auto space-y-1.5">
                      <div className="text-slate-700 font-bold text-sm">
                        {transactions.length === 0
                          ? `Libro Cassa ${profile.activeYear} pronto (0 movimenti)`
                          : 'Nessun movimento trovato per i filtri selezionati'}
                      </div>
                      <p className="text-xs text-slate-400">
                        {transactions.length === 0
                          ? 'Aggiungi un nuovo movimento o importa un foglio Excel/CSV compilato.'
                          : 'Modifica i filtri sopra per visualizzare altri movimenti.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const dupInfo = duplicateTxInfoMap.get(tx.id);
                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors group ${
                        dupInfo?.isSuggestedDuplicate
                          ? 'bg-amber-50/60 hover:bg-amber-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                        {tx.category}
                      </td>
                      <td className="py-2.5 px-4 text-slate-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium line-clamp-1">{tx.description}</span>
                          {tx.recurringPlanId && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-[10px] font-bold uppercase">
                              Spesa Ricorrente
                              {tx.recurringInstallmentNumber ? ` #${tx.recurringInstallmentNumber}` : ''}
                            </span>
                          )}
                          {dupInfo && onOpenDuplicatesModal && (
                            <button
                              type="button"
                              onClick={onOpenDuplicatesModal}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono text-[10px] font-bold uppercase transition-colors ${
                                dupInfo.isSuggestedDuplicate
                                  ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                                  : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                              }`}
                              title="Clicca per aprire il popup di verifica ed eliminazione movimenti duplicati"
                            >
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>
                                {dupInfo.isSuggestedDuplicate
                                  ? 'Possibile Duplicato (Verifica)'
                                  : 'Coppia Simile entro 7 gg'}
                              </span>
                            </button>
                          )}
                        </div>
                        {tx.invoiceArchivedUrl && (
                          <a
                            href={tx.invoiceArchivedUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:underline mt-0.5"
                          >
                            <HardDrive className="w-2.5 h-2.5" />
                            <span>Giustificativo su Drive (02_Contabilita)</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                        <span className="inline-block text-[11px] text-slate-500">{tx.method}</span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                        {tx.income ? `+${formatEuro(tx.income)}` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-700 tabular-nums whitespace-nowrap">
                        {tx.expense ? `-${formatEuro(tx.expense)}` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                        {tx.income && tx.income > 0 && (
                          <button
                            onClick={() => onOpenReceiptModalForTransaction(tx)}
                            title="Genera ricevuta di pagamento"
                            className="p-1 text-slate-400 hover:text-emerald-700 rounded-md hover:bg-slate-100"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <label
                          title="Carica fattura/ricevuta in Gestionale ASD / 02_Contabilita_e_Cassa su Drive"
                          className="p-1 text-slate-400 hover:text-blue-600 rounded-md hover:bg-slate-100 cursor-pointer"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <input
                            type="file"
                            onChange={(e) => handleUploadInvoiceToDrive(e, tx)}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Confermi l'eliminazione del movimento: "${tx.description}"?`
                              )
                            ) {
                              onDeleteTransaction(tx.id);
                            }
                          }}
                          title="Elimina movimento"
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrati {filteredTransactions.length} di {transactions.length} movimenti
          </span>
          <div className="flex items-center gap-4 font-mono font-medium">
            <span className="text-emerald-800">
              Entrate filtrate: +
              {formatEuro(filteredTransactions.reduce((acc, t) => acc + (t.income || 0), 0))}
            </span>
            <span className="text-rose-800">
              Uscite filtrate: -
              {formatEuro(filteredTransactions.reduce((acc, t) => acc + (t.expense || 0), 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Initial Fund Modal */}
      {isFundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Imposta Fondo Cassa Iniziale ({profile.activeYear})
              </h3>
              <button
                onClick={() => setIsFundModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveFunds} className="space-y-4 text-xs">
              <p className="text-slate-500 leading-relaxed">
                Imposta la liquidità iniziale di apertura esercizio (oppure clicca su "Usa Saldo
                Finale 2026" per riportare il saldo attivo di € 11.805,47).
              </p>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Fondo Iniziale Conto Corrente Bancario (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editBank}
                  onChange={(e) => setEditBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Fondo Iniziale Cassa Contanti (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editCash}
                  onChange={(e) => setEditCash(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditBank('10539.47');
                    setEditCash('1266.00');
                  }}
                  className="text-emerald-700 hover:underline font-semibold"
                >
                  Usa Saldo Finale 2026 (€ 11.805,47)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditBank('0');
                    setEditCash('0');
                  }}
                  className="text-rose-600 hover:underline font-medium"
                >
                  Azzera a € 0,00
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFundModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  Salva Fondo Iniziale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Registra Nuovo Movimento Cassa
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4 text-xs">
              <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setNewType('income')}
                  className={`flex-1 py-2 rounded-md font-semibold text-center transition-all ${
                    newType === 'income'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Entrata (+)
                </button>
                <button
                  type="button"
                  onClick={() => setNewType('expense')}
                  className={`flex-1 py-2 rounded-md font-semibold text-center transition-all ${
                    newType === 'expense'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Uscita / Spesa (-)
                </button>
              </div>

              <TransactionDateSelector
                mode={newDateMode}
                customDate={newDate}
                onChangeMode={setNewDateMode}
                onChangeCustomDate={setNewDate}
                label="Con quale data vuoi registrare questo movimento nel Flusso di Cassa?"
                idPrefix="cashflow-new-tx"
              />

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Importo (€) *</label>
                  <input
                    id="input-cashflow-new-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Es. 130.00"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Categoria *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as CashCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Canale Pagamento *
                  </label>
                  <select
                    value={newMethod}
                    onChange={(e) => setNewMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {methods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Descrizione / Dettagli *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Caparra Rifugio Del Freo Mario Rossi"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Salva Movimento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
