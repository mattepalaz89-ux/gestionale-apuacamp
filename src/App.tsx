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
  countAppStateRecords,
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
  detectDuplicatesForNewTransactions,
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
  ensureGestionaleDriveStructure,
} from './services/googleWorkspace';

export default function App() {
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>(() => loadAppState(null));
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPageGuideExpanded, setIsPageGuideExpanded] = useState<boolean>(false);
  const [isFullManualOpen, setIsFullManualOpen] = useState<boolean>(false);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [driveAuthExpiredNotice, setDriveAuthExpiredNotice] = useState<boolean>(false);
  // IDs of transactions to check for duplicates (empty on normal app startup; populated only on initial import or when a new movement is added)
  const [targetDuplicateTxIds, setTargetDuplicateTxIds] = useState<string[]>([]);
  const hasUnsavedPreLoginEditsRef = useRef<boolean>(false);
  const appStateRef = useRef<AppState>(appState);
  appStateRef.current = appState;

  // Persisted ignored duplicate signatures and detection mode inside profile (so they are saved on Google Drive & Local File)
  const ignoredDuplicateSignatures = useMemo(
    () => appState.profile.ignoredDuplicateSignatures || [],
    [appState.profile.ignoredDuplicateSignatures]
  );
  const duplicateDetectionMode = appState.profile.duplicateDetectionMode || 'strict';

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
  const initialDefaultJsonRef = useRef<string>(exportBackupJSON(appState));

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

  // Push current state to Google Drive immediately
  const pushStateToGoogleDriveNow = useCallback(async (stateToPush: AppState, email: string) => {
    const jsonStr = exportBackupJSON(stateToPush);
    setDriveSyncState('saving');
    try {
      const uploaded = await saveLiveDatabaseToDrive(jsonStr, liveDriveFileIdRef.current);
      liveDriveFileIdRef.current = uploaded.id;
      lastSavedJsonRef.current = jsonStr;
      saveAppState(stateToPush, email);
      setDriveAuthExpiredNotice(false);
      setLastDriveSavedAt(
        new Date().toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setDriveSyncState('saved');
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        setDriveAuthExpiredNotice(true);
      }
      console.warn('Google Drive save notice:', err);
      setDriveSyncState('error');
    }
  }, []);

  // Pull latest state from the connected account's Google Drive ("database_gestionale_asd.json")
  const pullStateFromGoogleDrive = useCallback(async (email: string) => {
    setDriveSyncState('loading');
    try {
      // Ensure the "Gestionale ASD" folder structure exists on Drive
      ensureGestionaleDriveStructure().catch(() => {});

      const localCurrent = appStateRef.current;
      const localCount = countAppStateRecords(localCurrent);

      const remoteDb = await loadLiveDatabaseFromDrive();
      if (remoteDb && remoteDb.content) {
        const parsed = parseBackupJSON(remoteDb.content);
        if (parsed) {
          const remoteCount = countAppStateRecords(parsed);
          liveDriveFileIdRef.current = remoteDb.fileId || undefined;

          // Safety Protection: Never overwrite non-empty local data with an empty remote DB file,
          // and preserve pre-login edits if the user just imported data before connecting Drive
          if (
            (remoteCount === 0 && localCount > 0) ||
            (hasUnsavedPreLoginEditsRef.current && localCount > remoteCount)
          ) {
            await pushStateToGoogleDriveNow(localCurrent, email);
            return;
          }

          isHydratingFromDriveRef.current = true;
          lastSavedJsonRef.current = exportBackupJSON(parsed);
          setAppState(parsed);
          saveAppState(parsed, email);
          setDriveAuthExpiredNotice(false);
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

      // If no live DB file exists yet on this Drive, create it immediately from the current in-memory state (or cached profile state if richer)
      const cachedScoped = loadAppState(email);
      const stateToUpload =
        countAppStateRecords(localCurrent) >= countAppStateRecords(cachedScoped)
          ? localCurrent
          : cachedScoped;
      if (stateToUpload !== localCurrent) {
        setAppState(stateToUpload);
      }
      await pushStateToGoogleDriveNow(stateToUpload, email);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        setDriveAuthExpiredNotice(true);
      }
      console.warn('Background Drive sync notice:', err);
      setDriveSyncState('error');
    }
  }, [pushStateToGoogleDriveNow]);

  // Initialize Google Workspace Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        const email = user.email || user.displayName || 'Account Google Connesso';
        setGoogleUserEmail(email);
        setDriveAuthExpiredNotice(false);
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

  // When the connected Google profile changes, sync with that Google account's Drive ("Gestionale ASD / 07_Backup_Sistema / database_gestionale_asd.json")
  useEffect(() => {
    if (googleUserEmail) {
      if (!hasUnsavedPreLoginEditsRef.current) {
        const profileScopedState = loadAppState(googleUserEmail);
        if (countAppStateRecords(profileScopedState) > countAppStateRecords(appStateRef.current)) {
          setAppState(profileScopedState);
        }
      }
      pullStateFromGoogleDrive(googleUserEmail).then(() => {
        hasUnsavedPreLoginEditsRef.current = false;
      });
    }
  }, [googleUserEmail, pullStateFromGoogleDrive]);

  // Auto-save in real time on every change to Local Browser Cache, Local PC File, and Google Drive
  useEffect(() => {
    saveAppState(appState, googleUserEmail);

    const currentJson = exportBackupJSON(appState);
    if (!googleUserEmail && currentJson !== initialDefaultJsonRef.current) {
      hasUnsavedPreLoginEditsRef.current = true;
    }

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
        setDriveAuthExpiredNotice(false);
        setLastDriveSavedAt(
          new Date().toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
        setDriveSyncState('saved');
      } catch (err: any) {
        if (err?.message === 'AUTH_REQUIRED') {
          setDriveAuthExpiredNotice(true);
        }
        console.error('Live Drive auto-save error:', err);
        setDriveSyncState('error');
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [appState, googleUserEmail]);

  // Periodic Automatic Google Drive Sync Timer (every 90 seconds) to ensure Drive folder & database file are always aligned
  useEffect(() => {
    if (!googleUserEmail) return;
    const interval = setInterval(async () => {
      if (isHydratingFromDriveRef.current) return;
      const currentState = appStateRef.current;
      const currentJson = exportBackupJSON(currentState);
      if (currentJson !== lastSavedJsonRef.current || !liveDriveFileIdRef.current) {
        await pushStateToGoogleDriveNow(currentState, googleUserEmail);
      }
    }, 90_000);
    return () => clearInterval(interval);
  }, [googleUserEmail, pushStateToGoogleDriveNow]);

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

  const handleGoogleSignIn = async (forceConsent: boolean = false) => {
    try {
      const res = await googleSignIn(Boolean(forceConsent));
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

  // Detect potential duplicate movements ONLY for newly imported or newly added transactions (targetDuplicateTxIds)
  // Does NOT run automatically on app startup or login!
  const duplicateGroups = useMemo(
    () =>
      detectDuplicatesForNewTransactions(
        targetDuplicateTxIds,
        appState.transactions,
        appState.members,
        appState.staff,
        7,
        ignoredDuplicateSignatures,
        duplicateDetectionMode
      ),
    [
      targetDuplicateTxIds,
      appState.transactions,
      appState.members,
      appState.staff,
      ignoredDuplicateSignatures,
      duplicateDetectionMode,
    ]
  );

  const totalExtraDuplicatesCount = useMemo(
    () => duplicateGroups.reduce((acc, g) => acc + g.duplicateTransactions.length, 0),
    [duplicateGroups]
  );

  // System notifications across all modules (filtered by user-resolved or postponed notifications, including manual deadlines)
  // Pass transactions for duplicate notifications ONLY when targetDuplicateTxIds is active
  const notifications = generateSystemNotifications(
    appState.members,
    appState.bookings,
    appState.events,
    appState.gadgetOrders,
    appState.roles,
    appState.assemblies,
    new Date(),
    appState.grants,
    targetDuplicateTxIds.length > 0 ? appState.transactions : [],
    ignoredDuplicateSignatures,
    appState.profile.notificationResolutions,
    appState.profile.customDeadlines || [],
    appState.profile.completedDeadlineIds || [],
    duplicateDetectionMode
  );

  // --- Multi-Step Undo / Redo History Stack (up to 30 operations) ---
  const [undoStack, setUndoStack] = useState<{ state: AppState; label: string }[]>([]);
  const [redoStack, setRedoStack] = useState<{ state: AppState; label: string }[]>([]);

  const recordUndoSnapshot = useCallback((label: string, snapshotState?: AppState) => {
    const snap = snapshotState ?? appStateRef.current;
    setUndoStack((prev) => [{ state: snap, label }, ...prev].slice(0, 30));
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) return prevUndo;
      const [latest, ...rest] = prevUndo;
      const currentSnap = appStateRef.current;
      setRedoStack((prevRedo) => [{ state: currentSnap, label: latest.label }, ...prevRedo].slice(0, 30));
      setTargetDuplicateTxIds([]);
      setAppState(latest.state);
      return rest;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;
      const [latest, ...rest] = prevRedo;
      const currentSnap = appStateRef.current;
      setUndoStack((prevUndo) => [{ state: currentSnap, label: latest.label }, ...prevUndo].slice(0, 30));
      setTargetDuplicateTxIds([]);
      setAppState(latest.state);
      return rest;
    });
  }, []);

  // Global keyboard shortcuts: Ctrl+Z / Cmd+Z for Undo, Ctrl+Y / Cmd+Shift+Z for Redo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        if (redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoStack.length, redoStack.length, handleUndo, handleRedo]);

  // --- Handlers for Cash Transactions & Funds ---
  const handleAddTransaction = (newTx: Omit<CashTransaction, 'id'>) => {
    recordUndoSnapshot('Aggiunta movimento cassa');
    const id = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const tx: CashTransaction = { id, ...newTx };
    // Test ONLY this newly added movement against existing movements
    setTargetDuplicateTxIds([id]);
    setAppState((prev) => {
      const nextTxs = [tx, ...prev.transactions];
      const foundForNew = detectDuplicatesForNewTransactions(
        [id],
        nextTxs,
        prev.members,
        prev.staff,
        7,
        prev.profile.ignoredDuplicateSignatures || [],
        prev.profile.duplicateDetectionMode || 'strict'
      );
      if (foundForNew.length > 0) {
        setIsDuplicatesModalOpen(true);
      }
      return {
        ...prev,
        transactions: nextTxs,
      };
    });
  };

  const handleUpdateTransaction = (updatedTx: CashTransaction) => {
    recordUndoSnapshot('Modifica movimento cassa');
    setAppState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t)),
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    recordUndoSnapshot('Eliminazione movimento cassa');
    setTargetDuplicateTxIds((prev) => prev.filter((item) => item !== id));
    setAppState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  const handleDeleteMultipleTransactions = (ids: string[]) => {
    if (ids.length === 0) return;
    recordUndoSnapshot(`Eliminazione ${ids.length} movimenti`);
    const idSet = new Set(ids);
    setTargetDuplicateTxIds((prev) => prev.filter((item) => !idSet.has(item)));
    setAppState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => !idSet.has(t.id)),
    }));
  };

  const handleLoadSampleDuplicates = () => {
    recordUndoSnapshot('Simulazione duplicati');
    const sampleTxs = createSampleDuplicateTransactions(appState.profile.activeYear);
    setTargetDuplicateTxIds(sampleTxs.map((t) => t.id));
    setAppState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        ignoredDuplicateSignatures: [],
        duplicateDetectionMode: 'strict',
      },
      transactions: [...sampleTxs, ...prev.transactions],
    }));
  };

  const handleRunManualFullDuplicateScan = () => {
    setTargetDuplicateTxIds(appState.transactions.map((t) => t.id));
  };

  const handleImportTransactions = (
    txs: CashTransaction[],
    mode: 'append' | 'replace',
    newFunds?: { initialFund: number; initialFundBank: number; initialFundCash: number }
  ) => {
    recordUndoSnapshot(
      txs.length === 0 && mode === 'replace'
        ? 'Azzeramento cassa'
        : `Importazione ${txs.length} movimenti`
    );
    const importedIds = txs.map((t) => t.id);
    // Run duplicate check once on the newly imported dataset
    setTargetDuplicateTxIds(importedIds);
    setAppState((prev) => {
      const nextTxs = mode === 'replace' ? txs : [...txs, ...prev.transactions];
      const foundOnImport = detectDuplicatesForNewTransactions(
        importedIds,
        nextTxs,
        prev.members,
        prev.staff,
        7,
        prev.profile.ignoredDuplicateSignatures || [],
        prev.profile.duplicateDetectionMode || 'strict'
      );
      if (foundOnImport.length > 0) {
        setIsDuplicatesModalOpen(true);
      }
      return {
        ...prev,
        transactions: nextTxs,
        ...(newFunds
          ? {
              initialFund: newFunds.initialFund,
              initialFundBank: newFunds.initialFundBank,
              initialFundCash: newFunds.initialFundCash,
            }
          : {}),
      };
    });
  };

  const handleUpdateInitialFunds = (funds: {
    initialFund: number;
    initialFundBank: number;
    initialFundCash: number;
  }) => {
    recordUndoSnapshot('Modifica fondo iniziale');
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
    recordUndoSnapshot('Aggiunta spesa ricorrente');
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
    recordUndoSnapshot('Rimozione spesa ricorrente');
    setAppState((prev) => ({
      ...prev,
      recurringExpenses: (prev.recurringExpenses || []).filter((p) => p.id !== id),
    }));
  };

  const handleRegisterRecurringOccurrences = (
    newTransactions: Omit<CashTransaction, 'id'>[]
  ) => {
    recordUndoSnapshot(`Contabilizzazione ${newTransactions.length} rate`);
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
    recordUndoSnapshot('Aggiunta socio');
    const id = `m-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const member: Member = { id, ...newMember };
    setAppState((prev) => ({
      ...prev,
      members: [member, ...prev.members],
    }));
    return member;
  };

  const handleImportMembers = (imported: Member[], mode: 'append' | 'replace') => {
    recordUndoSnapshot(`Importazione ${imported.length} soci`);
    setAppState((prev) => ({
      ...prev,
      members: mode === 'replace' ? imported : [...imported, ...prev.members],
    }));
  };

  const handleUpdateMember = (updated: Member) => {
    recordUndoSnapshot('Modifica socio');
    setAppState((prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
    }));
  };

  const handleDeleteMember = (id: string) => {
    recordUndoSnapshot('Eliminazione socio');
    setAppState((prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== id),
    }));
  };

  // --- Handlers for Events & Bookings ---
  const handleAddEvent = (newEv: Omit<EventItem, 'id'>) => {
    recordUndoSnapshot('Nuovo evento');
    const id = `ev-${Date.now()}`;
    setAppState((prev) => ({
      ...prev,
      events: [...prev.events, { id, ...newEv }],
    }));
  };

  const handleUpdateEvent = (updatedEv: EventItem) => {
    recordUndoSnapshot('Modifica evento');
    setAppState((prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === updatedEv.id ? updatedEv : e)),
      bookings: prev.bookings.map((b) =>
        b.eventId === updatedEv.id ? { ...b, eventName: updatedEv.name } : b
      ),
    }));
  };

  const handleDeleteEvent = (eventId: string) => {
    recordUndoSnapshot('Eliminazione evento');
    setAppState((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== eventId),
      bookings: prev.bookings.filter((b) => b.eventId !== eventId),
    }));
  };

  const handleAddBooking = (newBooking: Omit<EventBooking, 'id'>) => {
    recordUndoSnapshot('Nuova iscrizione evento');
    const id = `bk-${Date.now()}`;
    const booking: EventBooking = { id, ...newBooking };
    setAppState((prev) => ({
      ...prev,
      bookings: [booking, ...prev.bookings],
    }));
  };

  const handleUpdateBooking = (updated: EventBooking) => {
    recordUndoSnapshot('Modifica iscrizione evento');
    setAppState((prev) => ({
      ...prev,
      bookings: prev.bookings.map((b) => (b.id === updated.id ? updated : b)),
    }));
  };

  const handleDeleteBooking = (bookingId: string) => {
    recordUndoSnapshot('Eliminazione iscrizione evento');
    setAppState((prev) => ({
      ...prev,
      bookings: prev.bookings.filter((b) => b.id !== bookingId),
    }));
  };

  // --- Handlers for Grants (Bandi & Progetti) ---
  const handleAddGrant = (newGrant: Omit<GrantItem, 'id'>) => {
    recordUndoSnapshot('Nuovo bando');
    const id = `gr-${Date.now()}`;
    setAppState((prev) => ({
      ...prev,
      grants: [{ id, ...newGrant }, ...prev.grants],
    }));
  };

  const handleUpdateGrant = (updatedGrant: GrantItem) => {
    recordUndoSnapshot('Modifica bando');
    setAppState((prev) => ({
      ...prev,
      grants: prev.grants.map((g) => (g.id === updatedGrant.id ? updatedGrant : g)),
    }));
  };

  const handleDeleteGrant = (grantId: string) => {
    recordUndoSnapshot('Eliminazione bando');
    setAppState((prev) => ({
      ...prev,
      grants: prev.grants.filter((g) => g.id !== grantId),
    }));
  };

  // --- Handlers for Gadgets & Gadget Orders ---
  const handleAddGadgetItem = (item: Omit<GadgetItem, 'id'>) => {
    recordUndoSnapshot('Nuovo articolo gadget');
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
    recordUndoSnapshot('Nuova prenotazione gadget');
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
    recordUndoSnapshot('Modifica ordine gadget');
    setAppState((prev) => ({
      ...prev,
      gadgetOrders: prev.gadgetOrders.map((o) => (o.id === updated.id ? updated : o)),
    }));
  };

  const handleDeleteGadgetOrder = (id: string) => {
    recordUndoSnapshot('Eliminazione ordine gadget');
    setAppState((prev) => ({
      ...prev,
      gadgetOrders: prev.gadgetOrders.filter((o) => o.id !== id),
    }));
  };

  const handleImportGadgetOrders = (orders: GadgetOrder[]) => {
    recordUndoSnapshot(`Importazione ${orders.length} ordini gadget`);
    setAppState((prev) => ({
      ...prev,
      gadgetOrders: [...orders, ...prev.gadgetOrders],
    }));
  };

  // --- Handlers for Governance Roles & Assemblies ---
  const handleAddRole = (role: Omit<AssociationRole, 'id'>) => {
    recordUndoSnapshot('Nuova carica sociale');
    const id = `role-${Date.now()}`;
    setAppState((prev) => ({
      ...prev,
      roles: [...prev.roles, { id, ...role }],
    }));
  };

  const handleUpdateRole = (updated: AssociationRole) => {
    recordUndoSnapshot('Modifica carica sociale');
    setAppState((prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r.id === updated.id ? updated : r)),
    }));
  };

  const handleDeleteRole = (id: string) => {
    recordUndoSnapshot('Eliminazione carica sociale');
    setAppState((prev) => ({
      ...prev,
      roles: prev.roles.filter((r) => r.id !== id),
    }));
  };

  const handleAddAssembly = (asm: Omit<AssemblyMeeting, 'id'>) => {
    recordUndoSnapshot('Nuova assemblea');
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
    recordUndoSnapshot('Modifica assemblea');
    setAppState((prev) => ({
      ...prev,
      assemblies: prev.assemblies.map((a) => (a.id === updated.id ? updated : a)),
    }));
  };

  // --- Handlers for Staff ---
  const handleAddStaffMember = (newStaff: StaffMember) => {
    recordUndoSnapshot('Nuovo collaboratore staff');
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
    recordUndoSnapshot(`Archiviazione anno ${appState.profile.activeYear}`);
    const { nextState, archivedRecord } = archiveFiscalYearState(appState, targetNewYear);
    setAppState(nextState);
    return archivedRecord || null;
  };

  const handleRestoreState = (restored: AppState) => {
    recordUndoSnapshot('Ripristino backup');
    setAppState(restored);
  };

  const handleResetToDefaults = () => {
    recordUndoSnapshot('Reset gestionale');
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
        googleUserEmail={googleUserEmail}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleLogout={handleGoogleLogout}
        driveSyncState={driveSyncState}
        lastDriveSavedAt={lastDriveSavedAt}
        onReloadFromDrive={
          googleUserEmail ? () => pullStateFromGoogleDrive(googleUserEmail) : undefined
        }
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
          canUndo={undoStack.length > 0}
          lastUndoLabel={undoStack[0]?.label || null}
          onUndo={handleUndo}
          canRedo={redoStack.length > 0}
          onRedo={handleRedo}
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

          {/* Banner if Google OAuth token expired while editing so user can reconnect in 1 click without losing anything */}
          {driveAuthExpiredNotice && (
            <div className="no-print mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-950 shadow-2xs">
              <div>
                <strong>Sessione Google Drive scaduta:</strong> i tuoi dati sono salvati al sicuro
                nella memoria locale del browser, ma per aggiornare il file nella cartella{' '}
                <span className="font-mono font-semibold">Gestionale ASD</span> su Google Drive è
                necessario riconnettere l&apos;account.
              </div>
              <button
                type="button"
                onClick={() => handleGoogleSignIn(false)}
                className="px-3.5 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg transition-colors shrink-0"
              >
                Riconnetti Google Drive Ora
              </button>
            </div>
          )}

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
              onUpdateAssembly={handleUpdateAssembly}
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
              onDeleteMultipleTransactions={handleDeleteMultipleTransactions}
              onImportTransactions={handleImportTransactions}
              onUpdateInitialFunds={handleUpdateInitialFunds}
              onUpdateProfile={handleUpdateProfile}
              onOpenReceiptModalForTransaction={openReceiptForTransaction}
              onNavigateToArchive={() => setActiveTab('backup')}
              canUndo={undoStack.length > 0}
              lastUndoLabel={undoStack[0]?.label || null}
              onUndo={handleUndo}
              canRedo={redoStack.length > 0}
              onRedo={handleRedo}
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
        onClose={() => {
          // When closing the modal, mark any remaining displayed groups as reviewed/ignored so they don't keep nagging
          if (duplicateGroups.length > 0) {
            const current = new Set(appState.profile.ignoredDuplicateSignatures || []);
            duplicateGroups.forEach((g) => current.add(g.signature));
            handleUpdateProfile({
              ...appState.profile,
              ignoredDuplicateSignatures: Array.from(current),
            });
          }
          setTargetDuplicateTxIds([]);
          setIsDuplicatesModalOpen(false);
        }}
        duplicateGroups={duplicateGroups}
        onDeleteTransactions={handleDeleteMultipleTransactions}
        onIgnoreGroupSignature={(sig) => {
          const current = appState.profile.ignoredDuplicateSignatures || [];
          if (!current.includes(sig)) {
            handleUpdateProfile({
              ...appState.profile,
              ignoredDuplicateSignatures: [...current, sig],
            });
          }
        }}
        onIgnoreAllGroups={(sigs) => {
          const current = new Set(appState.profile.ignoredDuplicateSignatures || []);
          sigs.forEach((s) => current.add(s));
          handleUpdateProfile({
            ...appState.profile,
            ignoredDuplicateSignatures: Array.from(current),
          });
          setTargetDuplicateTxIds([]);
        }}
        ignoredCount={ignoredDuplicateSignatures.length}
        onResetIgnoredGroups={() => {
          handleUpdateProfile({
            ...appState.profile,
            ignoredDuplicateSignatures: [],
          });
          setTargetDuplicateTxIds(appState.transactions.map((t) => t.id));
        }}
        onLoadSampleDuplicates={handleLoadSampleDuplicates}
        onRunManualFullScan={handleRunManualFullDuplicateScan}
        duplicateDetectionMode={duplicateDetectionMode}
        onChangeDuplicateDetectionMode={(mode) =>
          handleUpdateProfile({
            ...appState.profile,
            duplicateDetectionMode: mode,
          })
        }
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

