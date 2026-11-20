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
  Undo2,
  Redo2,
  CheckSquare,
  Square,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  CashTransaction,
  CashCategory,
  PaymentMethod,
  PaymentAccountId,
  CustomPaymentAccount,
  StaffPaymentKind,
  Member,
  StaffMember,
  AssociationProfile,
  DuplicateTransactionGroup,
  RecurringExpensePlan,
} from '../types';
import {
  formatEuro,
  calculateCashTotals,
  parseAmount,
  sortCashTransactions,
  CashSortField,
  CashSortDirection,
} from '../utils/finance';
import { todayIso } from '../utils/dates';
import { newId } from '../utils/ids';
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
  staff?: StaffMember[];
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
  onDeleteMultipleTransactions?: (ids: string[]) => void;
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
  onOpenReceiptsRegistry?: () => void;
  receiptsCount?: number;
  canUndo?: boolean;
  lastUndoLabel?: string | null;
  onUndo?: () => void;
  canRedo?: boolean;
  onRedo?: () => void;
}

export const CashFlowView: React.FC<CashFlowViewProps> = ({
  transactions,
  members,
  staff = [],
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
  onDeleteMultipleTransactions,
  onImportTransactions,
  onUpdateInitialFunds,
  onUpdateProfile,
  onOpenReceiptModalForTransaction,
  onNavigateToArchive,
  onOpenReceiptsRegistry,
  receiptsCount = 0,
  canUndo = false,
  lastUndoLabel = null,
  onUndo,
  canRedo = false,
  onRedo,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [sortField, setSortField] = useState<CashSortField>('date');
  const [sortDirection, setSortDirection] = useState<CashSortDirection>('desc');
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
    linkUrl?: string;
    linkLabel?: string;
  } | null>(null);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);
  const [excelImportMode, setExcelImportMode] = useState<'append' | 'replace'>('append');

  // Multi-select state for bulk deletion
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // Edit existing transaction modal state
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editType, setEditType] = useState<'income' | 'expense'>('income');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editCategory, setEditCategory] = useState<CashCategory>('Evento');
  const [editMethod, setEditMethod] = useState<PaymentMethod>('Bonifico');
  const [editAccountId, setEditAccountId] = useState<PaymentAccountId | ''>('');
  const [editMemberId, setEditMemberId] = useState<string>('');
  const [editStaffId, setEditStaffId] = useState<string>('');
  const [editStaffPaymentKind, setEditStaffPaymentKind] =
    useState<StaffPaymentKind>('compenso_sportivo');
  const [editDescription, setEditDescription] = useState<string>('');

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

  // Edit Initial Fund & Payment Accounts Modal
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [editBank, setEditBank] = useState(String(initialFundBank));
  const [editCash, setEditCash] = useState(String(initialFundCash));
  const [editPaypal, setEditPaypal] = useState(String(profile.initialFundPaypal || 0));
  const [editCustomAccounts, setEditCustomAccounts] = useState<CustomPaymentAccount[]>(
    profile.customPaymentAccounts || []
  );
  const [newCustomAccName, setNewCustomAccName] = useState('');
  const [newCustomAccInitial, setNewCustomAccInitial] = useState('0');

  // Modal State for adding transaction
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDateMode, setNewDateMode] = useState<'today' | 'custom'>('today');
  const [newDate, setNewDate] = useState(() => todayIso());
  const [newCategory, setNewCategory] = useState<CashCategory>('Evento');
  const [newMethod, setNewMethod] = useState<PaymentMethod>('Bonifico');
  const [newAccountId, setNewAccountId] = useState<PaymentAccountId | ''>('');
  const [newMemberId, setNewMemberId] = useState<string>('');
  const [newStaffId, setNewStaffId] = useState<string>('');
  const [newStaffPaymentKind, setNewStaffPaymentKind] =
    useState<StaffPaymentKind>('compenso_sportivo');
  const [newType, setNewType] = useState<'income' | 'expense'>('income');
  const [newAmount, setNewAmount] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');

  const totals = calculateCashTotals(
    transactions,
    initialFund,
    initialFundBank,
    initialFundCash,
    {
      initialPaypal: profile.initialFundPaypal || 0,
      paymentAccounts: profile.paymentAccounts,
      paypalExpenseSourceAccount: profile.paypalExpenseSourceAccount,
      customPaymentAccounts: profile.customPaymentAccounts,
    }
  );

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
    const filtered = transactions.filter((t) => {
      if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;
      if (selectedMethod !== 'ALL' && t.method !== selectedMethod) return false;
      if (selectedType === 'INCOME' && (!t.income || t.income <= 0)) return false;
      if (selectedType === 'EXPENSE' && (!t.expense || t.expense <= 0)) return false;
      if (search) {
        const q = search.toLowerCase();
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const catMatch = (t.category || '').toLowerCase().includes(q);
        const methMatch = (t.method || '').toLowerCase().includes(q);
        const dateMatch = (t.date || '').toLowerCase().includes(q);
        const memberNameMatch = (t.relatedMemberName || '').toLowerCase().includes(q);
        return descMatch || catMatch || methMatch || dateMatch || memberNameMatch;
      }
      return true;
    });
    return sortCashTransactions(filtered, sortField, sortDirection);
  }, [transactions, selectedCategory, selectedMethod, selectedType, search, sortField, sortDirection]);

  const handleToggleSortColumn = (field: CashSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Text fields default to A->Z ('asc'), dates and amounts default to 'desc' (most recent / largest)
      setSortDirection(
        field === 'category' || field === 'description' || field === 'method' || field === 'type'
          ? 'asc'
          : 'desc'
      );
    }
  };

  const renderSortIcon = (field: CashSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover/th:text-slate-500 shrink-0" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-700 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-700 shrink-0" />
    );
  };

  // Keep only valid existing IDs in selectedTxIds
  const activeSelectedIds = useMemo(() => {
    const existingSet = new Set(transactions.map((t) => t.id));
    const valid: string[] = [];
    selectedTxIds.forEach((id) => {
      if (existingSet.has(id)) valid.push(id);
    });
    return valid;
  }, [selectedTxIds, transactions]);

  const allFilteredSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((t) => selectedTxIds.has(t.id));

  const handleToggleSelectRow = (id: string) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        filteredTransactions.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedTxIds((prev) => {
        const next = new Set(prev);
        filteredTransactions.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const handleBulkDeleteSelected = () => {
    if (activeSelectedIds.length === 0) return;
    if (
      !confirm(
        `Confermi l'eliminazione simultanea di ${activeSelectedIds.length} ${
          activeSelectedIds.length === 1 ? 'movimento selezionato' : 'movimenti selezionati'
        }?\n\n(Potrai comunque annullare l'operazione con il pulsante "Annulla" in alto).`
      )
    ) {
      return;
    }
    if (onDeleteMultipleTransactions) {
      onDeleteMultipleTransactions(activeSelectedIds);
    } else {
      activeSelectedIds.forEach((id) => onDeleteTransaction(id));
    }
    setSelectedTxIds(new Set());
    setBannerMsg({
      type: 'ok',
      text: `Eliminati ${activeSelectedIds.length} movimenti di cassa. Usa "Annulla" se vuoi ripristinarli.`,
    });
  };

  const handleOpenEditModal = (tx: CashTransaction) => {
    setEditingTx(tx);
    setEditDate(tx.date);
    const isInc = (tx.income ?? 0) > 0;
    setEditType(isInc ? 'income' : 'expense');
    setEditAmount(String(isInc ? tx.income : tx.expense || 0));
    setEditCategory(tx.category);
    setEditMethod(tx.method);
    setEditAccountId(
      tx.accountId ||
        (tx.method === 'Paypal'
          ? isInc
            ? 'paypal'
            : profile.paypalExpenseSourceAccount || 'banca'
          : '')
    );
    setEditMemberId(tx.memberId || '');
    setEditStaffId(tx.staffId || '');
    setEditStaffPaymentKind(tx.staffPaymentKind || 'compenso_sportivo');
    setEditDescription(tx.description);
  };

  const handleSaveEditedTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !onUpdateTransaction) return;
    const parsed = parseAmount(editAmount);
    if (parsed <= 0 || !editDescription.trim()) return;

    const linkedMember = editMemberId
      ? members.find((m) => m.id === editMemberId)
      : undefined;
    const effectiveAccountId: PaymentAccountId | undefined =
      editMethod === 'Paypal'
        ? editAccountId ||
          (editType === 'expense'
            ? profile.paypalExpenseSourceAccount || 'banca'
            : 'paypal')
        : editAccountId || undefined;

    onUpdateTransaction({
      ...editingTx,
      date: editDate || editingTx.date,
      category: editCategory,
      method: editMethod,
      accountId: effectiveAccountId,
      memberId: editMemberId || undefined,
      relatedMemberName: linkedMember
        ? linkedMember.childName
        : editMemberId
        ? editingTx.relatedMemberName
        : undefined,
      staffId: editCategory === 'Staff' && editStaffId ? editStaffId : undefined,
      staffPaymentKind:
        editCategory === 'Staff' && editStaffId ? editStaffPaymentKind : undefined,
      income: editType === 'income' ? parsed : null,
      expense: editType === 'expense' ? parsed : null,
      description: editDescription.trim(),
    });

    setEditingTx(null);
    setBannerMsg({
      type: 'ok',
      text: `Movimento "${editDescription.trim()}" aggiornato con successo!`,
    });
  };

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(newAmount);
    if (isNaN(parsed) || parsed <= 0 || !newDescription.trim()) return;

    const effectiveDate =
      newDateMode === 'today' ? todayIso() : newDate;

    const linkedMember = newMemberId
      ? members.find((m) => m.id === newMemberId)
      : undefined;
    const effectiveAccountId: PaymentAccountId | undefined =
      newMethod === 'Paypal'
        ? newAccountId ||
          (newType === 'expense'
            ? profile.paypalExpenseSourceAccount || 'banca'
            : 'paypal')
        : newAccountId || undefined;

    onAddTransaction({
      date: effectiveDate,
      category: newCategory,
      method: newMethod,
      accountId: effectiveAccountId,
      memberId: newMemberId || undefined,
      relatedMemberName: linkedMember ? linkedMember.childName : undefined,
      staffId: newCategory === 'Staff' && newStaffId ? newStaffId : undefined,
      staffPaymentKind:
        newCategory === 'Staff' && newStaffId ? newStaffPaymentKind : undefined,
      income: newType === 'income' ? parsed : null,
      expense: newType === 'expense' ? parsed : null,
      description: newDescription.trim(),
    });

    setIsAddModalOpen(false);
    setNewAmount('');
    setNewDescription('');
    setNewAccountId('');
    setNewMemberId('');
    setNewStaffId('');
  };

  const handleSaveFunds = (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseAmount(editBank);
    const c = parseAmount(editCash);
    const p = parseAmount(editPaypal);
    const customTotal = editCustomAccounts.reduce(
      (sum, acc) => sum + (Number.isFinite(acc.initialBalance) ? acc.initialBalance : 0),
      0
    );
    const totalInit = Math.round((b + c + p + customTotal) * 100) / 100;
    onUpdateInitialFunds({
      initialFund: totalInit,
      initialFundBank: b,
      initialFundCash: c,
    });
    onUpdateProfile({
      ...profile,
      initialFundPaypal: p,
      customPaymentAccounts: editCustomAccounts,
      initialFundMismatchNotice: undefined,
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
          text: 'Nessun movimento valido trovato nel file. Verifica che siano presenti le colonne Data e Entrata/Uscita.',
        });
      } else {
        onImportTransactions(parsed, excelImportMode);
        setSelectedTxIds(new Set());
        setBannerMsg({
          type: 'ok',
          text:
            excelImportMode === 'replace'
              ? `Sostituito il Libro Cassa con ${parsed.length} movimenti importati dal file "${file.name}"! (Puoi cliccare "Annulla" se vuoi tornare indietro).`
              : `Importati ${parsed.length} movimenti di cassa dal file "${file.name}"! (Puoi cliccare "Annulla" se vuoi annullare l'importazione).`,
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
      initialFundPaypal: profile.initialFundPaypal || 0,
      paymentAccounts: profile.paymentAccounts,
      paypalExpenseSourceAccount: profile.paypalExpenseSourceAccount,
      customPaymentAccounts: profile.customPaymentAccounts,
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
        initialFundPaypal: profile.initialFundPaypal || 0,
        paymentAccounts: profile.paymentAccounts,
        paypalExpenseSourceAccount: profile.paypalExpenseSourceAccount,
        customPaymentAccounts: profile.customPaymentAccounts,
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
      {/* Streamlined Top Bar + Undo/Redo + Collapsible Import / Google Sheets / Strumenti Drawer */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>Contabilità & Libro Cassa {profile.activeYear}</span>
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Undo / Redo Buttons */}
            {onUndo && (
              <div className="flex items-center">
                <button
                  id="btn-cashflow-undo"
                  type="button"
                  onClick={onUndo}
                  disabled={!canUndo}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border transition-colors ${
                    onRedo ? 'rounded-l-lg' : 'rounded-lg'
                  } ${
                    canUndo
                      ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200 shadow-2xs'
                      : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                  }`}
                  title={
                    canUndo && lastUndoLabel
                      ? `Annulla ultima operazione: ${lastUndoLabel} (Ctrl+Z)`
                      : 'Nessuna operazione recente da annullare'
                  }
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>
                    {canUndo && lastUndoLabel ? `Annulla (${lastUndoLabel})` : 'Annulla'}
                  </span>
                </button>
                {onRedo && (
                  <button
                    id="btn-cashflow-redo"
                    type="button"
                    onClick={onRedo}
                    disabled={!canRedo}
                    className={`p-1.5 text-xs font-semibold border border-l-0 rounded-r-lg transition-colors ${
                      canRedo
                        ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                    }`}
                    title="Ripeti operazione annullata (Ctrl+Y)"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-600 font-medium">Modalità importazione Excel/CSV:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setExcelImportMode('append')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    excelImportMode === 'append'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Aggiunge i movimenti del file Excel a quelli già presenti"
                >
                  Accoda ai presenti
                </button>
                <button
                  type="button"
                  onClick={() => setExcelImportMode('replace')}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    excelImportMode === 'replace'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Sostituisce tutti i movimenti correnti con quelli del file Excel caricato"
                >
                  Sostituisci cassa corrente
                </button>
              </div>
            </div>

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
                <span>
                  {excelImportMode === 'replace'
                    ? 'Importa e Sostituisci Excel/CSV'
                    : 'Importa Cassa Excel/CSV'}
                </span>
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

              {onOpenReceiptsRegistry && (
                <button
                  type="button"
                  onClick={onOpenReceiptsRegistry}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                  title="Apri il Registro Progressivo delle Ricevute Emesse e verifica la numerazione per il 730"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-700" />
                  <span>Registro Ricevute ({receiptsCount})</span>
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
            {canUndo && onUndo && (
              <button
                type="button"
                onClick={onUndo}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800 font-bold hover:bg-slate-100 transition-colors"
              >
                <Undo2 className="w-3 h-3" />
                <span>Annulla Operazione</span>
              </button>
            )}
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

      {/* One-time notice if initialFund was realigned during migration */}
      {profile.initialFundMismatchNotice && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Il Fondo Iniziale totale è stato riallineato automaticamente alla somma dei conti (da{' '}
              {formatEuro(profile.initialFundMismatchNotice.oldInitialFund)} a{' '}
              {formatEuro(profile.initialFundMismatchNotice.realignedInitialFund)}).
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateProfile({
                ...profile,
                initialFundMismatchNotice: undefined,
              })
            }
            className="text-amber-800 hover:text-amber-950 font-bold px-2 py-0.5 rounded hover:bg-amber-100 shrink-0"
          >
            Ho capito ✕
          </button>
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
            Fondo iniziale: {formatEuro(totals.initialFund)}
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
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] text-slate-500 font-medium">
              Disponibilità per Conto (C/C, PayPal, Cassa)
            </div>
            <div className="text-[11px] font-mono text-slate-700 mt-1 flex flex-col gap-0.5">
              <span>Banca (C/C): {formatEuro(totals.currentBank)}</span>
              <span>PayPal: {formatEuro(totals.currentPaypal)}</span>
              <span>Contanti: {formatEuro(totals.currentCash)}</span>
              {(totals.customAccountBalances || []).map((ca) => (
                <span key={ca.id}>
                  {ca.name}: {formatEuro(ca.currentBalance)}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              setEditBank(String(initialFundBank));
              setEditCash(String(initialFundCash));
              setEditPaypal(String(profile.initialFundPaypal || 0));
              setEditCustomAccounts(profile.customPaymentAccounts || []);
              setIsFundModalOpen(true);
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0"
            title="Imposta il fondo cassa di partenza e i conti di pagamento"
          >
            <Edit3 className="w-3 h-3" />
            <span>Fondo &amp; Conti</span>
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
              placeholder="Filtra per data, causale o socio..."
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

          <div className="flex items-center gap-1.5">
            <select
              id="select-cashflow-sort"
              aria-label="Ordina movimenti del Libro Cassa"
              value={`${sortField}:${sortDirection}`}
              onChange={(e) => {
                const [f, d] = e.target.value.split(':') as [CashSortField, CashSortDirection];
                setSortField(f);
                setSortDirection(d);
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
              title="Ordina il Libro Cassa per data, categoria, causale, canale, tipologia o importo (A→Z e Z→A)"
            >
              <option value="date:desc">Ordina: Data (dal più recente Z→A)</option>
              <option value="date:asc">Ordina: Data (cronologico A→Z)</option>
              <option value="category:asc">Ordina: Categoria / Tipologia (A → Z)</option>
              <option value="category:desc">Ordina: Categoria / Tipologia (Z → A)</option>
              <option value="description:asc">Ordina: Causale &amp; Dettagli (A → Z)</option>
              <option value="description:desc">Ordina: Causale &amp; Dettagli (Z → A)</option>
              <option value="method:asc">Ordina: Canale pagamento (A → Z)</option>
              <option value="method:desc">Ordina: Canale pagamento (Z → A)</option>
              <option value="type:asc">Ordina: Tipologia (prima Entrate A→Z)</option>
              <option value="type:desc">Ordina: Tipologia (prima Uscite Z→A)</option>
              <option value="amount:desc">Ordina: Importo (dal più alto)</option>
              <option value="amount:asc">Ordina: Importo (dal più basso)</option>
              <option value="income:desc">Ordina: Entrata (importo decrescente)</option>
              <option value="income:asc">Ordina: Entrata (importo crescente)</option>
              <option value="expense:desc">Ordina: Uscita (importo decrescente)</option>
              <option value="expense:asc">Ordina: Uscita (importo crescente)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {filteredTransactions.length > 0 && (
            <button
              id="btn-cashflow-select-all-filtered"
              type="button"
              onClick={handleToggleSelectAllFiltered}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              title="Seleziona o deseleziona tutti i movimenti mostrati per eliminarli insieme"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
              ) : (
                <Square className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>
                {allFilteredSelected
                  ? 'Deseleziona Tutti'
                  : `Seleziona Tutti (${filteredTransactions.length})`}
              </span>
            </button>
          )}

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
              setNewDate(todayIso());
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Aggiungi Movimento</span>
          </button>
        </div>
      </div>

      {/* Bulk Multi-Select Action Bar when 1 or more transactions are checked */}
      {activeSelectedIds.length > 0 && (
        <div
          id="cashflow-bulk-selection-bar"
          className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-2.5 py-1 rounded-md bg-emerald-600 font-mono font-bold text-white">
              {activeSelectedIds.length}{' '}
              {activeSelectedIds.length === 1 ? 'voce selezionata' : 'voci selezionate'}
            </span>
            <span className="text-slate-300">
              Puoi eliminare tutte le voci selezionate con un solo clic oppure deselezionarle.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!allFilteredSelected && filteredTransactions.length > activeSelectedIds.length && (
              <button
                type="button"
                onClick={handleToggleSelectAllFiltered}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
              >
                Seleziona tutti i {filteredTransactions.length} filtrati
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedTxIds(new Set())}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Deseleziona
            </button>
            <button
              id="btn-cashflow-bulk-delete-selected"
              type="button"
              onClick={handleBulkDeleteSelected}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Elimina Selezionati ({activeSelectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 pl-4 pr-2 w-10 text-center">
                  <input
                    id="checkbox-cashflow-select-all"
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectAllFiltered}
                    disabled={filteredTransactions.length === 0}
                    className="w-3.5 h-3.5 rounded-xs border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    title="Seleziona o deseleziona tutti i movimenti mostrati"
                  />
                </th>
                <th className="py-3 px-3 w-28">
                  <button
                    type="button"
                    onClick={() => handleToggleSortColumn('date')}
                    className="group/th inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-900 transition-colors cursor-pointer"
                    title="Clicca per ordinare cronologicamente per Data (A→Z / Z→A)"
                  >
                    <span>Data</span>
                    {renderSortIcon('date')}
                  </button>
                </th>
                <th className="py-3 px-3 w-36">
                  <button
                    type="button"
                    onClick={() => handleToggleSortColumn('category')}
                    className="group/th inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-900 transition-colors cursor-pointer"
                    title="Clicca per ordinare alfabeticamente per Categoria / Tipologia (A→Z / Z→A)"
                  >
                    <span>Categoria</span>
                    {renderSortIcon('category')}
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleToggleSortColumn('description')}
                    className="group/th inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-900 transition-colors cursor-pointer"
                    title="Clicca per ordinare alfabeticamente per Causale & Dettagli (A→Z / Z→A)"
                  >
                    <span>Causale &amp; Dettagli</span>
                    {renderSortIcon('description')}
                  </button>
                </th>
                <th className="py-3 px-3 w-28">
                  <button
                    type="button"
                    onClick={() => handleToggleSortColumn('method')}
                    className="group/th inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-900 transition-colors cursor-pointer"
                    title="Clicca per ordinare alfabeticamente per Canale di pagamento (A→Z / Z→A)"
                  >
                    <span>Canale</span>
                    {renderSortIcon('method')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right w-28">
                  <button
                    type="button"
                    onClick={() => handleToggleSortColumn('income')}
                    className="group/th inline-flex items-center justify-end gap-1 uppercase tracking-wider hover:text-slate-900 transition-colors cursor-pointer ml-auto"
                    title="Clicca per ordinare per importo Entrata (crescente / decrescente)"
                  >
                    <span>Entrata</span>
                    {renderSortIcon('income')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right w-28">
                  <button
                    type="button"
                    onClick={() => handleToggleSortColumn('expense')}
                    className="group/th inline-flex items-center justify-end gap-1 uppercase tracking-wider hover:text-slate-900 transition-colors cursor-pointer ml-auto"
                    title="Clicca per ordinare per importo Uscita (crescente / decrescente)"
                  >
                    <span>Uscita</span>
                    {renderSortIcon('expense')}
                  </button>
                </th>
                <th className="py-3 px-4 text-center w-36">Azioni &amp; Modifica</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
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
                  const isSelected = selectedTxIds.has(tx.id);
                  return (
                    <tr
                      key={tx.id}
                      className={`transition-colors group ${
                        isSelected
                          ? 'bg-emerald-50/70 hover:bg-emerald-50'
                          : dupInfo?.isSuggestedDuplicate
                          ? 'bg-amber-50/60 hover:bg-amber-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 pl-4 pr-2 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(tx.id)}
                          aria-label={`Seleziona movimento ${tx.description}`}
                          className="w-3.5 h-3.5 rounded-xs border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
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
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        <span className="inline-block text-[11px] text-slate-500">{tx.method}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums whitespace-nowrap">
                        {tx.income ? `+${formatEuro(tx.income)}` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700 tabular-nums whitespace-nowrap">
                        {tx.expense ? `-${formatEuro(tx.expense)}` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {onUpdateTransaction && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(tx)}
                              title="Modifica questo movimento (data, importo, categoria, causale)"
                              className="p-1 text-slate-500 hover:text-indigo-700 rounded-md hover:bg-indigo-50 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {tx.income && tx.income > 0 && (
                            <button
                              type="button"
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
                            type="button"
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
            {activeSelectedIds.length > 0 ? ` · ${activeSelectedIds.length} selezionati` : ''}
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

      {/* Edit Existing Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>Modifica Movimento Cassa</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedTransaction} className="space-y-4 text-xs">
              <div className="flex rounded-lg border border-slate-200 p-1 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setEditType('income')}
                  className={`flex-1 py-2 rounded-md font-semibold text-center transition-all ${
                    editType === 'income'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Entrata (+)
                </button>
                <button
                  type="button"
                  onClick={() => setEditType('expense')}
                  className={`flex-1 py-2 rounded-md font-semibold text-center transition-all ${
                    editType === 'expense'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Uscita / Spesa (-)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Data Movimento *
                  </label>
                  <input
                    id="input-cashflow-edit-date"
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Importo (€) *</label>
                  <input
                    id="input-cashflow-edit-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Categoria *</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as CashCategory)}
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
                    value={editMethod}
                    onChange={(e) => {
                      const nextM = e.target.value as PaymentMethod;
                      setEditMethod(nextM);
                      if (nextM === 'Paypal') {
                        setEditAccountId(
                          editType === 'expense'
                            ? profile.paypalExpenseSourceAccount || 'banca'
                            : 'paypal'
                        );
                      } else {
                        setEditAccountId('');
                      }
                    }}
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

              {(editMethod === 'Paypal' ||
                (profile.customPaymentAccounts && profile.customPaymentAccounts.length > 0)) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <label className="block text-slate-800 font-semibold">
                    {editMethod === 'Paypal'
                      ? editType === 'expense'
                        ? 'Strumento di pagamento usato dentro PayPal (da quale conto esce?)'
                        : 'Conto di destinazione entrata PayPal'
                      : 'Conto su cui registrare il movimento'}
                  </label>
                  <select
                    value={
                      editAccountId ||
                      (editMethod === 'Paypal'
                        ? editType === 'expense'
                          ? profile.paypalExpenseSourceAccount || 'banca'
                          : 'paypal'
                        : editMethod === 'Contanti'
                        ? 'cassa'
                        : 'banca')
                    }
                    onChange={(e) => setEditAccountId(e.target.value as PaymentAccountId)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="banca">
                      Conto Corrente Bancario (carta/IBAN collegato - predefinito per uscite)
                    </option>
                    <option value="paypal">Saldo Conto PayPal</option>
                    <option value="cassa">Cassa Contanti</option>
                    {(profile.customPaymentAccounts || []).map((ca) => (
                      <option key={ca.id} value={ca.id}>
                        {ca.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Socio collegato (opzionale)
                  </label>
                  <select
                    value={editMemberId}
                    onChange={(e) => setEditMemberId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="">-- Nessun socio collegato --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.childName}{' '}
                        {m.membershipCardNumber ? `(Tess. ${m.membershipCardNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {editCategory === 'Staff' && staff.length > 0 && (
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Collaboratore sportivo collegato
                    </label>
                    <select
                      value={editStaffId}
                      onChange={(e) => setEditStaffId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="">-- Nessun collaboratore --</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {editCategory === 'Staff' && editStaffId && (
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Natura erogazione collaboratore (D.Lgs. 36/2021)
                  </label>
                  <select
                    value={editStaffPaymentKind}
                    onChange={(e) =>
                      setEditStaffPaymentKind(e.target.value as StaffPaymentKind)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="compenso_sportivo">
                      Compenso sportivo / collaboratore (concorre alle soglie 5.000 € / 15.000 €)
                    </option>
                    <option value="rimborso_spese">
                      Rimborso spese documentato / piè di lista (escluso dalle soglie)
                    </option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Descrizione / Causale *
                </label>
                <input
                  id="input-cashflow-edit-description"
                  type="text"
                  required
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  id="btn-cashflow-save-edit"
                  type="submit"
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Initial Fund & Payment Accounts Modal */}
      {isFundModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Fondo Cassa Iniziale &amp; Conti ({profile.activeYear})
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
                Imposta i saldi iniziali di apertura esercizio per Conto Corrente Bancario, Cassa
                Contanti, Conto PayPal ed eventuali altri conti o carte dell&apos;associazione. Il
                fondo iniziale totale è sempre pari alla somma dei conti.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Conto Corrente Bancario (€)
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
                    Conto PayPal (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPaypal}
                    onChange={(e) => setEditPaypal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Cassa Contanti (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editCash}
                    onChange={(e) => setEditCash(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              {/* Custom additional accounts (e.g. Second Bank Account, Prepaid Card) */}
              <div className="border-t border-slate-100 pt-3 space-y-2.5">
                <div className="font-bold text-slate-800">
                  Altri Conti / Metodi Personalizzati (es. Secondo C/C, Carta Prepagata)
                </div>

                {editCustomAccounts.length > 0 && (
                  <div className="space-y-2">
                    {editCustomAccounts.map((acc, idx) => (
                      <div
                        key={acc.id}
                        className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200"
                      >
                        <input
                          type="text"
                          value={acc.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditCustomAccounts((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                            );
                          }}
                          className="flex-1 px-2.5 py-1.5 rounded border border-slate-200 bg-white"
                          placeholder="Nome conto"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={acc.initialBalance}
                          onChange={(e) => {
                            const val = parseAmount(e.target.value);
                            setEditCustomAccounts((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, initialBalance: val } : item
                              )
                            );
                          }}
                          className="w-28 px-2.5 py-1.5 rounded border border-slate-200 bg-white font-mono"
                          placeholder="Fondo €"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setEditCustomAccounts((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                          title="Rimuovi conto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Es. Secondo Conto / Carta Prepagata"
                    value={newCustomAccName}
                    onChange={(e) => setNewCustomAccName(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Fondo €"
                    value={newCustomAccInitial}
                    onChange={(e) => setNewCustomAccInitial(e.target.value)}
                    className="w-24 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCustomAccName.trim()) return;
                      const created: CustomPaymentAccount = {
                        id: newId('acc'),
                        name: newCustomAccName.trim(),
                        initialBalance: parseAmount(newCustomAccInitial),
                      };
                      setEditCustomAccounts((prev) => [...prev, created]);
                      setNewCustomAccName('');
                      setNewCustomAccInitial('0');
                    }}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg shrink-0"
                  >
                    + Aggiungi Conto
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditBank('10539.47');
                    setEditCash('1266.00');
                    setEditPaypal('0');
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
                    setEditPaypal('0');
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
                  Salva Fondo &amp; Conti
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 max-h-[92vh] overflow-y-auto">
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
                  onClick={() => {
                    setNewType('income');
                    if (newMethod === 'Paypal') setNewAccountId('paypal');
                  }}
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
                  onClick={() => {
                    setNewType('expense');
                    if (newMethod === 'Paypal') {
                      setNewAccountId(profile.paypalExpenseSourceAccount || 'banca');
                    }
                  }}
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
                    onChange={(e) => {
                      const nextM = e.target.value as PaymentMethod;
                      setNewMethod(nextM);
                      if (nextM === 'Paypal') {
                        setNewAccountId(
                          newType === 'expense'
                            ? profile.paypalExpenseSourceAccount || 'banca'
                            : 'paypal'
                        );
                      } else {
                        setNewAccountId('');
                      }
                    }}
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

              {(newMethod === 'Paypal' ||
                (profile.customPaymentAccounts && profile.customPaymentAccounts.length > 0)) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <label className="block text-slate-800 font-semibold">
                    {newMethod === 'Paypal'
                      ? newType === 'expense'
                        ? 'Strumento di pagamento usato dentro PayPal (da quale conto esce?)'
                        : 'Conto di destinazione entrata PayPal'
                      : 'Conto su cui registrare il movimento'}
                  </label>
                  <select
                    value={
                      newAccountId ||
                      (newMethod === 'Paypal'
                        ? newType === 'expense'
                          ? profile.paypalExpenseSourceAccount || 'banca'
                          : 'paypal'
                        : newMethod === 'Contanti'
                        ? 'cassa'
                        : 'banca')
                    }
                    onChange={(e) => setNewAccountId(e.target.value as PaymentAccountId)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="banca">
                      Conto Corrente Bancario (carta/IBAN collegato - predefinito per uscite)
                    </option>
                    <option value="paypal">Saldo Conto PayPal</option>
                    <option value="cassa">Cassa Contanti</option>
                    {(profile.customPaymentAccounts || []).map((ca) => (
                      <option key={ca.id} value={ca.id}>
                        {ca.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Socio collegato (opzionale)
                  </label>
                  <select
                    value={newMemberId}
                    onChange={(e) => setNewMemberId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="">-- Nessun socio collegato --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.childName}{' '}
                        {m.membershipCardNumber ? `(Tess. ${m.membershipCardNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {newCategory === 'Staff' && staff.length > 0 && (
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Collaboratore sportivo collegato
                    </label>
                    <select
                      value={newStaffId}
                      onChange={(e) => setNewStaffId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="">-- Nessun collaboratore --</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {newCategory === 'Staff' && newStaffId && (
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Natura erogazione collaboratore (D.Lgs. 36/2021)
                  </label>
                  <select
                    value={newStaffPaymentKind}
                    onChange={(e) =>
                      setNewStaffPaymentKind(e.target.value as StaffPaymentKind)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="compenso_sportivo">
                      Compenso sportivo / collaboratore (concorre alle soglie 5.000 € / 15.000 €)
                    </option>
                    <option value="rimborso_spese">
                      Rimborso spese documentato / piè di lista (escluso dalle soglie)
                    </option>
                  </select>
                </div>
              )}

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
