import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header, DriveLiveSyncState } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CashFlowView } from './components/CashFlowView';
import { MembersView } from './components/MembersView';
import { CardsView } from './components/CardsView';
import { EventsView } from './components/EventsView';
import { GadgetsView } from './components/GadgetsView';
import { StaffView } from './components/StaffView';
import { GovernanceView } from './components/GovernanceView';
import { GrantsView } from './components/GrantsView';
import { NotificationsView } from './components/NotificationsView';
import { BackupView } from './components/BackupView';
import { ReceiptConfigView } from './components/ReceiptConfigView';
import { ReceiptModal } from './components/ReceiptModal';
import { DigitalMemberCardModal } from './components/DigitalMemberCardModal';
import { PageGuideBanner } from './components/PageGuideBanner';
import { DuplicateTransactionsModal } from './components/DuplicateTransactionsModal';
import {
  loadAppState,
  saveAppState,
  resetToEmpty2027,
  archiveFiscalYearState,
  exportBackupJSON,
  parseBackupJSON,
  AppState,
} from './utils/storage';
import {
  isFileSystemAccessSupported,
  openLocalDatabaseFileWithPicker,
  saveAsLocalDatabaseFileWithPicker,
  writeToLocalFileHandle,
  downloadLocalDatabaseFile,
} from './utils/localFileStorage';
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
  RecurringExpensePlan,
} from './types';
import { exportAccountingToExcel } from './utils/export';
import { calculateCashTotals, formatEuro } from './utils/finance';
import { generateSystemNotifications } from './utils/notifications';
import {
  detectDuplicateTransactions,
  createSampleDuplicateTransactions,
} from './utils/duplicates';
import {
  generateScheduledOccurrencesForPlan,
  buildTransactionFromOccurrence,
} from './utils/recurringExpenses';
import {
  initAuth,
  googleSignIn,
  logout,
  loadLiveDatabaseFromDrive,
  saveLiveDatabaseToDrive,
} from './services/googleWorkspace';

export default function App() {
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(() => loadAppState(null));
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPageGuideExpanded, setIsPageGuideExpanded] = useState<boolean>(false);
  const [isFullManualOpen, setIsFullManualOpen] = useState<boolean>(false);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState<boolean>(false);
  const [ignoredDuplicateSignatures, setIgnoredDuplicateSignatures] = useState<string[]>([]);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Local PC File (.json for PC / OneDrive / Dropbox) state
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const [lastLocalSavedAt, setLastLocalSavedAt] = useState<string | null>(null);
  const localFileHandleRef = useRef<any | null>(null);
  const localJsonInputRef = useRef<HTMLInputElement | null>(null);

  // Real-time Google Drive persistence state ("Salvataggio in diretta su Drive")
  const [driveSyncState, setDriveSyncState] = useState<DriveLiveSyncState>('idle');
  const [lastDriveSavedAt, setLastDriveSavedAt] = useState<string | null>(null);
  const liveDriveFileIdRef = useRef<string | undefined>(undefined);
  const isHydratingFromDriveRef = useRef<boolean>(false);
  const lastSavedJsonRef = useRef<string>('');

  // Receipt Modal State
  const [receiptModal, setReceiptModal] = useState<{
    isOpen: boolean;
    member?: Member;
    booking?: EventBooking;
    transaction?: CashTransaction;
    gadgetOrder?: GadgetOrder;
  }>({
    isOpen: false,
  });

  // Digital Membership Card Modal State
  const [digitalCardModal, setDigitalCardModal] = useState<{
    isOpen: boolean;
    member?: Member | null;
  }>({
    isOpen: false,
    member: null,
  });

  // Pull latest state from the connected account's Google Drive ("database_gestionale_asd.json")
  const pullStateFromGoogleDrive = useCallback(async (email: string) => {
    setDriveSyncState('loading');
    try {
      const remoteDb = await loadLiveDatabaseFromDrive();
      if (remoteDb && remoteDb.content) {
        const parsed = parseBackupJSON(remoteDb.content);
        if (parsed) {
          isHydratingFromDriveRef.current = true;
          liveDriveFileIdRef.current = remoteDb.fileId || undefined;
          lastSavedJsonRef.current = exportBackupJSON(parsed);
          setAppState(parsed);
          saveAppState(parsed, email);
          const timeStr = remoteDb.modifiedTime
            ? new Date(remoteDb.modifiedTime).toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : new Date().toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
              });
          setLastDriveSavedAt(timeStr);
          setDriveSyncState('saved');
          setTimeout(() => {
            isHydratingFromDriveRef.current = false;
          }, 300);
          return;
        }
      }
      // If no live DB file exists yet on this Drive, create it immediately from current state
      const currentScoped = loadAppState(email);
      const jsonStr = exportBackupJSON(currentScoped);
      const uploaded = await saveLiveDatabaseToDrive(jsonStr);
      liveDriveFileIdRef.current = uploaded.id;
      lastSavedJsonRef.current = jsonStr;
      setLastDriveSavedAt(
        new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      );
      setDriveSyncState('saved');
    } catch (err) {
      console.warn('Background Drive sync notice:', err);
      setDriveSyncState('idle');
    }
  }, []);

  // Initialize Google Workspace Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        const email = user.email || user.displayName || 'Account Google Connesso';
        setGoogleUserEmail(email);
      },
      () => {
        setGoogleUserEmail(null);
        setDriveSyncState('idle');
        setLastDriveSavedAt(null);
        liveDriveFileIdRef.current = undefined;
      }
    );
    return () => unsubscribe();
  }, []);

  // When the connected Google profile changes, load the state scoped to that profile
  // and immediately sync with that Google account's Drive ("Gestionale ASD / 07_Backup_Sistema / database_gestionale_asd.json")
  useEffect(() => {
    const profileScopedState = loadAppState(googleUserEmail);
    setAppState(profileScopedState);

    if (googleUserEmail) {
      pullStateFromGoogleDrive(googleUserEmail);
    }
  }, [googleUserEmail, pullStateFromGoogleDrive]);

  // Auto-save in real time to connected Local PC File (if a file handle is active) and/or Google Drive when connected (zero browser localStorage)
  useEffect(() => {
    saveAppState(appState, googleUserEmail);

    const currentJson = exportBackupJSON(appState);

    // If a local PC file handle is connected via File System Access API, write to it automatically
    if (localFileHandleRef.current) {
      const handle = localFileHandleRef.current;
      writeToLocalFileHandle(handle, currentJson)
        .then(() => {
          setLastLocalSavedAt(
            new Date().toLocaleTimeString('it-IT', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
        })
        .catch((err) => {
          console.warn('Auto-save to local file handle notice:', err);
        });
    }

    if (!googleUserEmail || isHydratingFromDriveRef.current) return;
    if (currentJson === lastSavedJsonRef.current) return;

    const timer = setTimeout(async () => {
      setDriveSyncState('saving');
      try {
        const uploaded = await saveLiveDatabaseToDrive(
          currentJson,
          liveDriveFileIdRef.current
        );
        liveDriveFileIdRef.current = uploaded.id;
        lastSavedJsonRef.current = currentJson;
        setLastDriveSavedAt(
          new Date().toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
        setDriveSyncState('saved');
      } catch (err) {
        console.error('Live Drive auto-save error:', err);
        setDriveSyncState('error');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [appState, googleUserEmail]);

  // Connect / Open a Local PC .json File (OneDrive / Dropbox / Hard Disk)
  const handleConnectLocalFile = async () => {
    if (isFileSystemAccessSupported()) {
      try {
        const res = await openLocalDatabaseFileWithPicker();
        if (res) {
          const parsed = parseBackupJSON(res.content);
          if (parsed) {
            localFileHandleRef.current = res.handle;
            setLocalFileName(res.fileName);
            setAppState(parsed);
            setLastLocalSavedAt(
              new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
            );
            return;
          }
        }
      } catch {
        // Fallback to standard file input below
      }
    }
    localJsonInputRef.current?.click();
  };

  const handleFallbackLocalFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parsed = parseBackupJSON(content);
      if (parsed) {
        setLocalFileName(file.name);
        setAppState(parsed);
        setLastLocalSavedAt(
          new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Save immediately to Local PC .json File
  const handleSaveLocalFile = async () => {
    const jsonStr = exportBackupJSON(appState);
    const defaultName =
      localFileName ||
      `Database_${appState.profile.name.replace(/\s+/g, '_')}_${appState.profile.activeYear}.json`;

    if (localFileHandleRef.current) {
      try {
        const ok = await writeToLocalFileHandle(localFileHandleRef.current, jsonStr);
        if (ok) {
          setLastLocalSavedAt(
            new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
          );
          return;
        }
      } catch {
        // Fallback below if handle permission expired
      }
    }

    if (isFileSystemAccessSupported()) {
      const res = await saveAsLocalDatabaseFileWithPicker(defaultName, jsonStr);
      if (res) {
        localFileHandleRef.current = res.handle;
        setLocalFileName(res.fileName);
        setLastLocalSavedAt(
          new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
        );
        return;
      }
      return;
    }

    downloadLocalDatabaseFile(defaultName, jsonStr);
    setLocalFileName(defaultName);
    setLastLocalSavedAt(
      new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    );
  };

  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res?.user) {
        const email = res.user.email || res.user.displayName || 'Account Google Connesso';
        setGoogleUserEmail(email);
      }
    } catch (err) {
      console.error('Google Sign-In error:', err);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUserEmail(null);
    setDriveSyncState('idle');
    setLastDriveSavedAt(null);
    liveDriveFileIdRef.current = undefined;
  };

  // Derived financial summary
  const totals = calculateCashTotals(
    appState.transactions,
    appState.initialFund,
    appState.initialFundBank,
    appState.initialFundCash
  );

  // Detect potential duplicate movements (same person & same amount within 7 days max)
  const duplicateGroups = useMemo(
    () =>
      detectDuplicateTransactions(
        appState.transactions,
        appState.members,
        appState.staff,
        7,
        ignoredDuplicateSignatures
      ),
    [appState.transactions, appState.members, appState.staff, ignoredDuplicateSignatures]
  );

  const totalExtraDuplicatesCount = useMemo(
    () => duplicateGroups.reduce((acc, g) => acc + g.duplicateTransactions.length, 0),
    [duplicateGroups]
  );

  // System notifications across all modules (filtered by user-resolved or postponed notifications, including manual deadlines)
  const notifications = generateSystemNotifications(
    appState.members,
    appState.bookings,
    appState.events,
    appState.gadgetOrders,
    appState.roles,
    appState.assemblies,
    new Date(),
    appState.grants,
    appState.transactions,
    ignoredDuplicateSignatures,
    appState.profile.notificationResolutions,
    appState.profile.customDeadlines || [],
    appState.profile.completedDeadlineIds || []
  );

  // --- Handlers for Cash Transactions & Funds ---
  const handleAddTransaction = (newTx: Omit<CashTransaction, 'id'>) => {
    const id = `tx-${Date.now()}`;
    const tx: CashTransaction = { id, ...newTx };
    setAppState((prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions],
    }));
  };

  const handleUpdateTransaction = (updatedTx: CashTransaction) => {
    setAppState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t)),
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    setAppState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  const handleDeleteMultipleTransactions = (ids: string[]) => {
    const idSet = new Set(ids);
    setAppState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => !idSet.has(t.id)),
    }));
  };

  const handleLoadSampleDuplicates = () => {
    const sampleTxs = createSampleDuplicateTransactions(appState.profile.activeYear);
    setIgnoredDuplicateSignatures([]);
    setAppState((prev) => ({
      ...prev,
      transactions: [...sampleTxs, ...prev.transactions],
    }));
  };

  const handleImportTransactions = (
    txs: CashTransaction[],
    mode: 'append' | 'replace',
    newFunds?: { initialFund: number; initialFundBank: number; initialFundCash: number }
  ) => {
    setAppState((prev) => ({
      ...prev,
      transactions: mode === 'replace' ? txs : [...txs, ...prev.transactions],
      ...(newFunds
        ? {
            initialFund: newFunds.initialFund,
            initialFundBank: newFunds.initialFundBank,
            initialFundCash: newFunds.initialFundCash,
          }
        : {}),
    }));
  };

  const handleUpdateInitialFunds = (funds: {
    initialFund: number;
    initialFundBank: number;
    initialFundCash: number;
  }) => {
    setAppState((prev) => ({
      ...prev,
      ...funds,
    }));
  };

  // --- Handlers for Recurring Expenses (Spese Ricorrenti) ---
  const handleAddRecurringExpense = (
    newPlan: Omit<RecurringExpensePlan, 'id'>,
    autoGenerateCurrentYearTransactions: boolean
  ) => {
    const planId = `rec-${Date.now()}`;
    const fullPlan: RecurringExpensePlan = { id: planId, ...newPlan };

    setAppState((prev) => {
      let generatedTransactions: CashTransaction[] = [];
      if (autoGenerateCurrentYearTransactions) {
        const occurrences = generateScheduledOccurrencesForPlan(
          fullPlan,
          prev.profile.activeYear
        );
        const filteredOccurrences =
          fullPlan.durationMode === 'numero_rate'
            ? occurrences
            : occurrences.filter((occ) =>
                occ.date.startsWith(String(prev.profile.activeYear))
              );
        generatedTransactions = filteredOccurrences.map((occ, idx) => ({
          id: `tx-rec-${Date.now()}-${idx}`,
          ...buildTransactionFromOccurrence(fullPlan, occ),
        }));
      }

      return {
        ...prev,
        recurringExpenses: [fullPlan, ...(prev.recurringExpenses || [])],
        transactions: [...generatedTransactions, ...prev.transactions],
      };
    });
  };

  const handleDeleteRecurringExpense = (id: string) => {
    setAppState((prev) => ({
      ...prev,
      recurringExpenses: (prev.recurringExpenses || []).filter((p) => p.id !== id),
    }));
  };

  const handleRegisterRecurringOccurrences = (
    newTransactions: Omit<CashTransaction, 'id'>[]
  ) => {
    const now = Date.now();
    const txsWithId: CashTransaction[] = newTransactions.map((tx, idx) => ({
      id: `tx-rec-${now}-${idx}`,
      ...tx,
    }));
    setAppState((prev) => ({
      ...prev,
      transactions: [...txsWithId, ...prev.transactions],
    }));
  };

  // --- Handlers for Members ---
  const handleAddMember = (newMember: Omit<Member, 'id'>): Member => {
    const id = `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const member: Member = { id, ...newMember };
    setAppState((prev) => ({
      ...prev,
      members: [member, ...prev.members],
    }));
    return member;
  };

  const handleImportMembers = (imported: Member[], mode: 'append' | 'replace') => {
    setAppState((prev) => ({
      ...prev,
      members: mode === 'replace' ? imported : [...imported, ...prev.members],
    }));
  };

  const handleUpdateMember = (updated: Member) => {
    setAppState((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
    }));
  };

  const handleDeleteMember = (id: string) => {
    setAppState((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== id),
    }));
  };

  // --- Handlers for Events & Bookings ---
  const handleAddEvent = (newEv: Omit<EventItem, 'id'>) => {
    const id = `ev-${Date.now()}`;
    setAppState((prev) => ({
      ...prev,
      events: [...prev.events, { id, ...newEv }],
    }));
  };

  const handleUpdateEvent = (updatedEv: EventItem) => {
    setAppState((prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === updatedEv.id ? updatedEv : e)),
      bookings: prev.bookings.map((b) =>
        b.eventId === updatedEv.id ? { ...b, eventName: updatedEv.name } : b
      ),
    }));
  };

  const handleDeleteEvent = (eventId: string) => {
    setAppState((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== eventId),
      bookings: prev.bookings.filter((b) => b.eventId !== eventId),
    }));
  };

  const handleAddBooking = (newBooking: Omit<EventBooking, 'id'>) => {
    const id = `bk-${Date.now()}`;
    const booking: EventBooking = { id, ...newBooking };
    setAppState((prev) => ({
      ...prev,
      bookings: [booking, ...prev.bookings],
    }));
  };

  const handleUpdateBooking = (updated: EventBooking) => {
    setAppState((prev) => ({
      ...prev,
      bookings: prev.bookings.map((b) => (b.id === updated.id ? updated : b)),
    }));
  };

  const handleDeleteBooking = (bookingId: string) => {
    setAppState((prev) => ({
      ...prev,
      bookings: prev.bookings.filter((b) => b.id !== bookingId),
    }));
  };

  // --- Handlers for Grants (Bandi & Progetti) ---
  const handleAddGrant = (newGrant: Omit<GrantItem, 'id'>) => {
    const id = `gr-${Date.now()}`;
    setAppState((prev) => ({
      ...prev,
      grants: [{ id, ...newGrant }, ...prev.grants],
    }));
  };

  const handleUpdateGrant = (updatedGrant: GrantItem) => {
    setAppState((prev) => ({
      ...prev,
      grants: prev.grants.map((g) => (g.id === updatedGrant.id ? updatedGrant : g)),
    }));
  };

  const handleDeleteGrant = (grantId: string) => {
    setAppState((prev) => ({
      ...prev,
      grants: prev.grants.filter((g) => g.id !== grantId),
    }));
  };

  // --- Handlers for Gadgets & Gadget Orders ---
  const handleAddGadgetItem = (item: Omit<GadgetItem, 'id'>) => {
    const id = `gd-${Date.now()}`;
    setAppState((prev) => ({
      ...prev,
      gadgets: [...prev.gadgets, { id, ...item }],
    }));
  };

  const handleAddGadgetOrder = (
    order: Omit<GadgetOrder, 'id'>,
    registerInCashFlow: boolean
  ) => {
    const id = `go-${Date.now()}`;
    const fullOrder: GadgetOrder = { id, ...order };

    setAppState((prev) => {
      const nextTransactions =
        registerInCashFlow && order.isPaid && order.totalPrice > 0
          ? [
              {
                id: `tx-gd-${Date.now()}`,
                date: order.date,
                category: 'Gadget' as const,
                income: order.totalPrice,
                expense: null,
                method: order.paymentMethod,
                description: `Gadget ${order.gadgetName} (${order.variant}) - ${order.childName}`,
              },
              ...prev.transactions,
            ]
          : prev.transactions;

      return {
        ...prev,
        gadgetOrders: [fullOrder, ...prev.gadgetOrders],
        transactions: nextTransactions,
      };
    });
  };

  const handleUpdateGadgetOrder = (updated: GadgetOrder) => {
    setAppState((prev) => ({
      ...prev,
      gadgetOrders: prev.gadgetOrders.map((o) => (o.id === updated.id ? updated : o)),
    }));
  };

  const handleDeleteGadgetOrder = (id: string) => {
    setAppState((prev) => ({
      ...prev,
      gadgetOrders: prev.gadgetOrders.filter((o) => o.id !== id),
    }));
  };

  const handleImportGadgetOrders = (orders: GadgetOrder[]) => {
    setAppState((prev) => ({
      ...prev,
      gadgetOrders: [...orders, ...prev.gadgetOrders],
    }));
  };

  // --- Handlers for Governance Roles & Assemblies ---
  const handleAddRole = (role: Omit<AssociationRole, 'id'>) => {
    const id = `role-${Date.now()}`;
    setAppState((prev) => ({
      ...prev,
      roles: [...prev.roles, { id, ...role }],
    }));
  };

  const handleUpdateRole = (updated: AssociationRole) => {
    setAppState((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r.id === updated.id ? updated : r)),
    }));
  };

  const handleDeleteRole = (id: string) => {
    setAppState((prev) => ({
      ...prev,
      roles: prev.roles.filter((r) => r.id !== id),
    }));
  };

  const handleAddAssembly = (asm: Omit<AssemblyMeeting, 'id'>) => {
    const id = `asm-${Date.now()}`;
    setAppState((prev) => ({
      ...prev,
      assemblies: [
        { id, ...asm },
        ...prev.assemblies,
      ],
    }));
  };

  const handleUpdateAssembly = (updated: AssemblyMeeting) => {
    setAppState((prev) => ({
      ...prev,
      assemblies: prev.assemblies.map((a) => (a.id === updated.id ? updated : a)),
    }));
  };

  // --- Handlers for Staff ---
  const handleAddStaffMember = (newStaff: StaffMember) => {
    setAppState((prev) => ({
      ...prev,
      staff: [...prev.staff, newStaff],
    }));
  };

  // --- Handlers for Profile, Fiscal Year Archiving & Backup ---
  const handleUpdateProfile = (profile: AssociationProfile) => {
    setAppState((prev) => ({ ...prev, profile }));
  };

  const handleArchiveFiscalYear = (targetNewYear: number): ArchivedFiscalYear | null => {
    const { nextState, archivedRecord } = archiveFiscalYearState(appState, targetNewYear);
    setAppState(nextState);
    return archivedRecord || null;
  };

  const handleRestoreState = (restored: AppState) => {
    setAppState(restored);
  };

  const handleResetToDefaults = () => {
    const empty2027 = resetToEmpty2027(googleUserEmail);
    setAppState(empty2027);
  };

  // Quick navigation helpers for receipts
  const openReceiptForMember = (member: Member) => {
    setReceiptModal({
      isOpen: true,
      member,
    });
  };

  const openReceiptForBooking = (booking: EventBooking, member?: Member) => {
    setReceiptModal({
      isOpen: true,
      booking,
      member,
    });
  };

  const openReceiptForTransaction = (transaction: CashTransaction) => {
    setReceiptModal({
      isOpen: true,
      transaction,
    });
  };

  const openReceiptForGadget = (gadgetOrder: GadgetOrder, member?: Member) => {
    setReceiptModal({
      isOpen: true,
      gadgetOrder,
      member,
    });
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 overflow-hidden font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Hidden input fallback for opening a local PC .json file */}
      <input
        ref={localJsonInputRef}
        type="file"
        accept=".json"
        onChange={handleFallbackLocalFileInput}
        className="hidden"
      />

      {/* Sidebar Navigation (Desktop Fixed + Mobile/Tablet Slide-Over Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notificationCount={notifications.length}
        currentBalance={totals.currentTotal}
        totalMembersCount={appState.members.length}
        gadgetOrdersCount={appState.gadgetOrders.length}
        grantsCount={appState.grants.length}
        activeYear={appState.profile.activeYear}
        associationName={appState.profile.name}
        affiliation={appState.profile.affiliation}
        profile={appState.profile}
        onUpdateProfile={handleUpdateProfile}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onOpenNewTransaction={() => setActiveTab('cashflow')}
          onOpenNewMember={() => setActiveTab('members')}
          onOpenNewBooking={() => setActiveTab('events')}
          onOpenNewGadgetOrder={() => setActiveTab('gadgets')}
          onExportExcel={() =>
            exportAccountingToExcel({
              transactions: appState.transactions,
              initialFund: appState.initialFund,
              initialFundBank: appState.initialFundBank,
              initialFundCash: appState.initialFundCash,
              fiscalYear: appState.profile.activeYear,
              associationName: appState.profile.name,
            })
          }
          notificationCount={notifications.length}
          googleUserEmail={googleUserEmail}
          associationName={appState.profile.name}
          activeYear={appState.profile.activeYear}
          onChangeActiveYear={(yr) =>
            handleUpdateProfile({ ...appState.profile, activeYear: yr })
          }
          driveSyncState={driveSyncState}
          lastDriveSavedAt={lastDriveSavedAt}
          onReloadFromDrive={
            googleUserEmail ? () => pullStateFromGoogleDrive(googleUserEmail) : undefined
          }
          isPageGuideExpanded={isPageGuideExpanded}
          onTogglePageGuide={() => setIsPageGuideExpanded((prev) => !prev)}
          onOpenFullManual={() => setIsFullManualOpen(true)}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          localFileName={localFileName}
          lastLocalSavedAt={lastLocalSavedAt}
          onConnectLocalFile={handleConnectLocalFile}
          onSaveLocalFile={handleSaveLocalFile}
        />

        {/* View Switcher Container */}
        <main className="p-3 sm:p-6 flex-1 max-w-7xl w-full mx-auto">
          <PageGuideBanner
            activeTab={activeTab}
            onNavigateTab={setActiveTab}
            isExpanded={isPageGuideExpanded}
            onToggleExpanded={() => setIsPageGuideExpanded((prev) => !prev)}
            isFullManualOpen={isFullManualOpen}
            onOpenFullManual={() => setIsFullManualOpen(true)}
            onCloseFullManual={() => setIsFullManualOpen(false)}
          />

          {/* Global Clickable Alert Banner when potential duplicate movements exist (on tabs other than cashflow which has its own detailed banner) */}
          {duplicateGroups.length > 0 && activeTab !== 'cashflow' && (
            <div
              id="global-duplicate-alert-banner"
              onClick={() => setIsDuplicatesModalOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setIsDuplicatesModalOpen(true);
              }}
              className="no-print mb-5 bg-amber-50 hover:bg-amber-100/80 border-2 border-amber-300 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 cursor-pointer transition-all shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-extrabold">
                    Alert Duplicati nel File Cassa ({duplicateGroups.length}{' '}
                    {duplicateGroups.length === 1 ? 'gruppo' : 'gruppi'} ·{' '}
                    {totalExtraDuplicatesCount}{' '}
                    {totalExtraDuplicatesCount === 1 ? 'movimento doppio' : 'movimenti doppi'}):
                  </span>{' '}
                  Rilevati movimenti simili per la stessa persona e stesso importo entro 7 giorni (
                  {duplicateGroups
                    .slice(0, 3)
                    .map((g) => `${g.personName} ${formatEuro(g.amount)}`)
                    .join(', ')}
                  ). Clicca per aprire il popup e cancellarli.
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDuplicatesModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 self-end sm:self-auto"
              >
                Verifica & Cancella Duplicati
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              transactions={appState.transactions}
              members={appState.members}
              bookings={appState.bookings}
              events={appState.events}
              profile={appState.profile}
              assemblies={appState.assemblies}
              grants={appState.grants}
              roles={appState.roles}
              initialFund={appState.initialFund}
              initialFundBank={appState.initialFundBank}
              initialFundCash={appState.initialFundCash}
              googleUserEmail={googleUserEmail}
              localFileName={localFileName}
              onConnectLocalFile={handleConnectLocalFile}
              onSaveLocalFile={handleSaveLocalFile}
              setActiveTab={setActiveTab}
              onUpdateProfile={handleUpdateProfile}
              onAddGrant={handleAddGrant}
              onSelectMemberForReceipt={openReceiptForMember}
            />
          )}

          {activeTab === 'cashflow' && (
            <CashFlowView
              transactions={appState.transactions}
              members={appState.members}
              profile={appState.profile}
              googleUserEmail={googleUserEmail}
              initialFund={appState.initialFund}
              initialFundBank={appState.initialFundBank}
              initialFundCash={appState.initialFundCash}
              duplicateGroups={duplicateGroups}
              onOpenDuplicatesModal={() => setIsDuplicatesModalOpen(true)}
              onLoadSampleDuplicates={handleLoadSampleDuplicates}
              recurringExpenses={appState.recurringExpenses}
              onAddRecurringExpense={handleAddRecurringExpense}
              onDeleteRecurringExpense={handleDeleteRecurringExpense}
              onRegisterRecurringOccurrences={handleRegisterRecurringOccurrences}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onImportTransactions={handleImportTransactions}
              onUpdateInitialFunds={handleUpdateInitialFunds}
              onUpdateProfile={handleUpdateProfile}
              onOpenReceiptModalForTransaction={openReceiptForTransaction}
              onNavigateToArchive={() => setActiveTab('backup')}
            />
          )}

          {activeTab === 'members' && (
            <MembersView
              members={appState.members}
              profile={appState.profile}
              googleUserEmail={googleUserEmail}
              onAddMember={handleAddMember}
              onImportMembers={handleImportMembers}
              onUpdateMember={handleUpdateMember}
              onDeleteMember={handleDeleteMember}
              onUpdateProfile={handleUpdateProfile}
              onAddTransaction={handleAddTransaction}
              onSelectMemberForReceipt={openReceiptForMember}
              onOpenDigitalCardModal={(member) =>
                setDigitalCardModal({
                  isOpen: true,
                  member: member || appState.members[0] || null,
                })
              }
            />
          )}

          {activeTab === 'cards' && (
            <CardsView
              members={appState.members}
              bookings={appState.bookings}
              profile={appState.profile}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onAddTransaction={handleAddTransaction}
              onOpenDigitalCardModal={(member) =>
                setDigitalCardModal({
                  isOpen: true,
                  member: member || appState.members[0] || null,
                })
              }
              onSelectMemberForReceipt={openReceiptForMember}
              onNavigateToMembers={() => setActiveTab('members')}
            />
          )}

          {activeTab === 'events' && (
            <EventsView
              events={appState.events}
              bookings={appState.bookings}
              members={appState.members}
              profile={appState.profile}
              googleUserEmail={googleUserEmail}
              onAddEvent={handleAddEvent}
              onUpdateEvent={handleUpdateEvent}
              onDeleteEvent={handleDeleteEvent}
              onAddBooking={handleAddBooking}
              onUpdateBooking={handleUpdateBooking}
              onDeleteBooking={handleDeleteBooking}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onAddTransaction={handleAddTransaction}
              onUpdateProfile={handleUpdateProfile}
              onOpenReceiptModalForBooking={openReceiptForBooking}
            />
          )}

          {activeTab === 'gadgets' && (
            <GadgetsView
              gadgets={appState.gadgets}
              gadgetOrders={appState.gadgetOrders}
              members={appState.members}
              profile={appState.profile}
              onAddGadgetItem={handleAddGadgetItem}
              onAddGadgetOrder={handleAddGadgetOrder}
              onUpdateGadgetOrder={handleUpdateGadgetOrder}
              onDeleteGadgetOrder={handleDeleteGadgetOrder}
              onImportGadgetOrders={handleImportGadgetOrders}
              onOpenReceiptModalForGadget={openReceiptForGadget}
            />
          )}

          {activeTab === 'staff' && (
            <StaffView
              staff={appState.staff}
              transactions={appState.transactions}
              profile={appState.profile}
              onAddTransaction={handleAddTransaction}
              onAddStaffMember={handleAddStaffMember}
            />
          )}

          {activeTab === 'grants' && (
            <GrantsView
              grants={appState.grants}
              googleUserEmail={googleUserEmail}
              onAddGrant={handleAddGrant}
              onUpdateGrant={handleUpdateGrant}
              onDeleteGrant={handleDeleteGrant}
            />
          )}

          {activeTab === 'governance' && (
            <GovernanceView
              roles={appState.roles}
              assemblies={appState.assemblies}
              profile={appState.profile}
              googleUserEmail={googleUserEmail}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleLogout={handleGoogleLogout}
              onAddRole={handleAddRole}
              onUpdateRole={handleUpdateRole}
              onDeleteRole={handleDeleteRole}
              onAddAssembly={handleAddAssembly}
              onUpdateAssembly={handleUpdateAssembly}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsView
              members={appState.members}
              events={appState.events}
              bookings={appState.bookings}
              gadgetOrders={appState.gadgetOrders}
              roles={appState.roles}
              assemblies={appState.assemblies}
              grants={appState.grants}
              transactions={appState.transactions}
              profile={appState.profile}
              onUpdateProfile={handleUpdateProfile}
              onAddGrant={handleAddGrant}
              ignoredDuplicateSignatures={ignoredDuplicateSignatures}
              onOpenDuplicatesModal={() => setIsDuplicatesModalOpen(true)}
              onNavigateTab={setActiveTab}
              onSelectMember={(member) => {
                setActiveTab('members');
                openReceiptForMember(member);
              }}
              onSelectBooking={(booking) => {
                setActiveTab('events');
                openReceiptForBooking(booking);
              }}
            />
          )}

          {activeTab === 'receipts_config' && (
            <ReceiptConfigView
              profile={appState.profile}
              members={appState.members}
              onUpdateProfile={handleUpdateProfile}
              onOpenSampleReceiptModal={() =>
                setReceiptModal({
                  isOpen: true,
                  member: appState.members[0],
                })
              }
            />
          )}

          {activeTab === 'backup' && (
            <BackupView
              appState={appState}
              googleUserEmail={googleUserEmail}
              onGoogleSignIn={handleGoogleSignIn}
              onGoogleLogout={handleGoogleLogout}
              onRestoreState={handleRestoreState}
              onResetToDefaults={handleResetToDefaults}
              onArchiveFiscalYear={handleArchiveFiscalYear}
              onUpdateProfile={handleUpdateProfile}
              onImportMembers={handleImportMembers}
              onImportTransactions={handleImportTransactions}
              onOpenReceiptCustomizer={() => setActiveTab('receipts_config')}
              onOpenDigitalCardDesigner={() =>
                setDigitalCardModal({
                  isOpen: true,
                  member: appState.members[0] || null,
                })
              }
              localFileName={localFileName}
              lastLocalSavedAt={lastLocalSavedAt}
              onConnectLocalFile={handleConnectLocalFile}
              onSaveLocalFile={handleSaveLocalFile}
            />
          )}
        </main>
      </div>

      {/* Global Duplicate Transactions Popup Modal */}
      <DuplicateTransactionsModal
        isOpen={isDuplicatesModalOpen}
        onClose={() => setIsDuplicatesModalOpen(false)}
        duplicateGroups={duplicateGroups}
        onDeleteTransactions={handleDeleteMultipleTransactions}
        onIgnoreGroupSignature={(sig) =>
          setIgnoredDuplicateSignatures((prev) =>
            prev.includes(sig) ? prev : [...prev, sig]
          )
        }
        ignoredCount={ignoredDuplicateSignatures.length}
        onResetIgnoredGroups={() => setIgnoredDuplicateSignatures([])}
        onLoadSampleDuplicates={handleLoadSampleDuplicates}
      />

      {/* Global Receipt & Estimate Modal */}
      <ReceiptModal
        isOpen={receiptModal.isOpen}
        onClose={() => setReceiptModal({ isOpen: false })}
        member={receiptModal.member}
        booking={receiptModal.booking}
        transaction={receiptModal.transaction}
        gadgetOrder={receiptModal.gadgetOrder}
        events={appState.events}
        gadgets={appState.gadgets}
        googleUserEmail={googleUserEmail}
        profile={appState.profile}
        onUpdateProfile={handleUpdateProfile}
        onUpdateMember={handleUpdateMember}
        onUpdateBooking={handleUpdateBooking}
        onUpdateGadgetOrder={handleUpdateGadgetOrder}
        onOpenFullConfigPanel={() => setActiveTab('receipts_config')}
      />

      {/* Global Digital Membership Card Generator & Template Designer Modal */}
      <DigitalMemberCardModal
        isOpen={digitalCardModal.isOpen}
        onClose={() => setDigitalCardModal({ isOpen: false, member: null })}
        member={digitalCardModal.member}
        members={appState.members}
        profile={appState.profile}
        onUpdateProfile={handleUpdateProfile}
        onUpdateMember={handleUpdateMember}
      />
    </div>
  );
}

