import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header, DriveLiveSyncState } from './components/Header';
import { PageGuideBanner } from './components/PageGuideBanner';
import { DuplicateTransactionsModal } from './components/DuplicateTransactionsModal';
import { SyncConflictModal } from './components/SyncConflictModal';
import { OnboardingWizardModal } from './components/OnboardingWizardModal';
import { LegalPagesView, LegalPageType } from './components/LegalPagesModal';

const DashboardView = lazy(() =>
  import('./components/DashboardView').then((m) => ({ default: m.DashboardView }))
);
const CashFlowView = lazy(() =>
  import('./components/CashFlowView').then((m) => ({ default: m.CashFlowView }))
);
const MembersView = lazy(() =>
  import('./components/MembersView').then((m) => ({ default: m.MembersView }))
);
const CardsView = lazy(() =>
  import('./components/CardsView').then((m) => ({ default: m.CardsView }))
);
const EventsView = lazy(() =>
  import('./components/EventsView').then((m) => ({ default: m.EventsView }))
);
const GadgetsView = lazy(() =>
  import('./components/GadgetsView').then((m) => ({ default: m.GadgetsView }))
);
const StaffView = lazy(() =>
  import('./components/StaffView').then((m) => ({ default: m.StaffView }))
);
const GovernanceView = lazy(() =>
  import('./components/GovernanceView').then((m) => ({ default: m.GovernanceView }))
);
const GrantsView = lazy(() =>
  import('./components/GrantsView').then((m) => ({ default: m.GrantsView }))
);
const NotificationsView = lazy(() =>
  import('./components/NotificationsView').then((m) => ({ default: m.NotificationsView }))
);
const BackupView = lazy(() =>
  import('./components/BackupView').then((m) => ({ default: m.BackupView }))
);
const ReceiptConfigView = lazy(() =>
  import('./components/ReceiptConfigView').then((m) => ({ default: m.ReceiptConfigView }))
);
const ReceiptModal = lazy(() =>
  import('./components/ReceiptModal').then((m) => ({ default: m.ReceiptModal }))
);
const DigitalMemberCardModal = lazy(() =>
  import('./components/DigitalMemberCardModal').then((m) => ({
    default: m.DigitalMemberCardModal,
  }))
);

import {
  loadAppState,
  saveAppState,
  resetToEmpty2027,
  archiveFiscalYearState,
  exportBackupJSON,
  serializeAppStateCompact,
  parseBackupJSON,
  countAppStateRecords,
  hydrateAppState,
  bumpStateVersion,
  deriveAssociationId,
  AppState,
} from './utils/storage';
import {
  loadLocalSnapshotRecord,
  saveLocalSnapshot,
  updateLastSyncedVersion,
  getLastDailyBackupDate,
  setLastDailyBackupDate,
  migrateLegacyLocalStorageSnapshots,
  clearLocalAccountData,
} from './utils/localDb';
import { anonymizeArchivedHealthData } from './utils/sanitize';
import { decideSyncAction } from './utils/syncOrder';
import { createSaveQueue, SaveQueue } from './utils/saveQueue';
import { newId } from './utils/ids';
import { todayIso } from './utils/dates';
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
  DriveDbCandidate,
  DriveBackupReason,
  IssuedReceipt,
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
  loadLiveDatabaseFileById,
  saveLiveDatabaseToDrive,
  ensureGestionaleDriveStructure,
  createDriveBackupSnapshot,
} from './services/googleWorkspace';

function detectLegalRouteFromLocation(): LegalPageType | null {
  if (typeof window === 'undefined') return null;
  const path = (window.location.pathname || '').toLowerCase().replace(/\/+$/, '');
  const hash = (window.location.hash || '').toLowerCase();
  const params = new URLSearchParams(window.location.search || '');
  const pageParam = (params.get('page') || '').toLowerCase();
  if (path === '/privacy' || hash === '#/privacy' || hash === '#privacy' || pageParam === 'privacy') {
    return 'privacy';
  }
  if (path === '/termini' || hash === '#/termini' || hash === '#termini' || pageParam === 'termini') {
    return 'termini';
  }
  return null;
}

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
  const [isOnboardingWizardOpen, setIsOnboardingWizardOpen] = useState<boolean>(false);
  const [standaloneLegalRoute, setStandaloneLegalRoute] = useState<LegalPageType | null>(() =>
    detectLegalRouteFromLocation()
  );
  const [modalLegalPage, setModalLegalPage] = useState<LegalPageType | null>(null);

  useEffect(() => {
    const handlePopState = () => {
      setStandaloneLegalRoute(detectLegalRouteFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);
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
  const initialDefaultJsonRef = useRef<string>('');
  if (!initialDefaultJsonRef.current) {
    initialDefaultJsonRef.current = serializeAppStateCompact(appState);
  }

  // Receipt Modal State
  const [receiptModal, setReceiptModal] = useState<{
    isOpen: boolean;
    member?: Member;
    booking?: EventBooking;
    transaction?: CashTransaction;
    gadgetOrder?: GadgetOrder;
    existingReceipt?: IssuedReceipt | null;
    initialOpenGmailPanel?: boolean;
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

  // Sync Conflict & Multiple DB Candidates Modal State (Phase 1.2 & 1.1)
  const [syncConflictModal, setSyncConflictModal] = useState<{
    isOpen: boolean;
    remoteState: AppState | null;
    candidates?: DriveDbCandidate[];
    selectedCandidateId?: string;
    isResolving?: boolean;
  }>({
    isOpen: false,
    remoteState: null,
  });

  const googleUserEmailRef = useRef<string | null>(googleUserEmail);
  googleUserEmailRef.current = googleUserEmail;

  // Migrate legacy localStorage keys once on app mount and purge SNAPSHOT_KEY_LATEST
  useEffect(() => {
    void migrateLegacyLocalStorageSnapshots(hydrateAppState);
  }, []);

  // Helper to strip volatile version/timestamp fields when comparing whether actual business data changed
  const getBusinessPayloadSignature = useCallback((state: AppState): string => {
    const { version: _v, updatedAt: _u, updatedBy: _b, ...businessData } = state;
    return JSON.stringify(businessData);
  }, []);

  const lastBusinessSignatureRef = useRef<string>(getBusinessPayloadSignature(appState));

  // Helper to trigger a background automatic backup on Google Drive before destructive operations
  const triggerPreActionDriveBackup = useCallback(
    (reason: DriveBackupReason) => {
      if (!googleUserEmailRef.current) return;
      void createDriveBackupSnapshot(appStateRef.current, reason).catch((err) => {
        console.warn(`Pre-action Drive backup (${reason}) skipped:`, err);
      });
    },
    []
  );

  // Push current state to Google Drive immediately (and trigger daily automatic backup if not yet done today)
  const pushStateToGoogleDriveNow = useCallback(async (stateToPush: AppState, email: string) => {
    const jsonStr = serializeAppStateCompact(stateToPush);
    const assocId = deriveAssociationId(stateToPush.profile);
    setDriveSyncState('saving');
    try {
      const uploaded = await saveLiveDatabaseToDrive(
        jsonStr,
        liveDriveFileIdRef.current,
        { associationId: assocId }
      );
      liveDriveFileIdRef.current = uploaded.id;
      lastSavedJsonRef.current = jsonStr;
      await saveLocalSnapshot(email, stateToPush, stateToPush.version || 1);
      await updateLastSyncedVersion(email, stateToPush.version || 1);
      setDriveAuthExpiredNotice(false);
      setLastDriveSavedAt(
        new Date().toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
      setDriveSyncState('saved');

      // Phase 1.6: Automatic daily backup (once per calendar day on first save)
      const todayIsoDate = todayIso();
      const lastDaily = await getLastDailyBackupDate(email);
      if (lastDaily !== todayIsoDate && countAppStateRecords(stateToPush) > 0) {
        await setLastDailyBackupDate(email, todayIsoDate);
        void createDriveBackupSnapshot(stateToPush, 'daily').catch(() => {});
      }
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        setDriveAuthExpiredNotice(true);
      }
      console.warn('Google Drive save notice:', err);
      setDriveSyncState('error');
      throw err;
    }
  }, []);

  // Debounced, serialized SaveQueue instance (Phase 1.4)
  const driveSaveQueueRef = useRef<SaveQueue<AppState> | null>(null);
  if (!driveSaveQueueRef.current) {
    driveSaveQueueRef.current = createSaveQueue<AppState>(
      async (snapshotToSave) => {
        const email = googleUserEmailRef.current;
        if (!email) return;
        await pushStateToGoogleDriveNow(snapshotToSave, email);
      },
      2000
    );
  }

  // Flush pending Drive saves when tab becomes hidden or before unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void driveSaveQueueRef.current?.flush();
      }
    };
    const handleBeforeUnload = () => {
      void driveSaveQueueRef.current?.flush();
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Apply remote state cleanly into memory & IndexedDB without triggering a save loop
  const applyRemoteStateLocally = useCallback(
    async (remoteState: AppState, email: string, modifiedTime?: string) => {
      isHydratingFromDriveRef.current = true;
      const jsonStr = serializeAppStateCompact(remoteState);
      lastSavedJsonRef.current = jsonStr;
      lastBusinessSignatureRef.current = getBusinessPayloadSignature(remoteState);
      setAppState(remoteState);
      await saveLocalSnapshot(email, remoteState, remoteState.version || 1);
      setDriveAuthExpiredNotice(false);
      const timeStr = modifiedTime
        ? new Date(modifiedTime).toLocaleTimeString('it-IT', {
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
    },
    [getBusinessPayloadSignature]
  );

  // Pull latest state from the connected account's Google Drive ("database_gestionale_asd.json")
  // using optimistic concurrency (decideSyncAction) and per-account IndexedDB snapshot
  const pullStateFromGoogleDrive = useCallback(
    async (email: string) => {
      setDriveSyncState('loading');
      try {
        // Ensure the "Gestionale ASD" folder structure exists on Drive (serialized under module lock)
        ensureGestionaleDriveStructure().catch(() => {});

        const idbRecord = await loadLocalSnapshotRecord(email);
        const inMemoryState = appStateRef.current;

        // Determine effective local state for this account
        let localCandidate: AppState | null = null;
        if (
          hasUnsavedPreLoginEditsRef.current &&
          countAppStateRecords(inMemoryState) > 0
        ) {
          localCandidate = inMemoryState;
        } else if (idbRecord?.state) {
          localCandidate = idbRecord.state;
        }

        const remoteDb = await loadLiveDatabaseFromDrive({
          knownRootFolderId:
            localCandidate?.profile?.driveRootFolderId ||
            inMemoryState.profile?.driveRootFolderId,
          associationId: deriveAssociationId(
            localCandidate?.profile || inMemoryState.profile
          ),
        });

        const remoteState =
          remoteDb && remoteDb.content ? parseBackupJSON(remoteDb.content) : null;

        if (remoteDb?.fileId) {
          liveDriveFileIdRef.current = remoteDb.fileId;
        }

        // If multiple database_gestionale_asd.json files were found on Drive, let user inspect/confirm
        if (remoteDb?.candidates && remoteDb.candidates.length > 1 && remoteState) {
          setSyncConflictModal({
            isOpen: true,
            remoteState,
            candidates: remoteDb.candidates,
            selectedCandidateId: remoteDb.fileId,
          });
          setDriveSyncState('idle');
          return;
        }

        const localCount = countAppStateRecords(localCandidate);
        const remoteCount = countAppStateRecords(remoteState);

        // Safety fast-paths when one side is completely empty (0 records) and the other has data
        if (remoteState && remoteCount > 0 && localCount === 0) {
          await applyRemoteStateLocally(remoteState, email, remoteDb?.modifiedTime);
          return;
        }
        if (localCandidate && localCount > 0 && (!remoteState || remoteCount === 0)) {
          if (localCandidate !== inMemoryState) {
            isHydratingFromDriveRef.current = true;
            lastBusinessSignatureRef.current = getBusinessPayloadSignature(localCandidate);
            setAppState(localCandidate);
            setTimeout(() => {
              isHydratingFromDriveRef.current = false;
            }, 250);
          }
          await pushStateToGoogleDriveNow(localCandidate, email);
          return;
        }

        const decision = decideSyncAction(
          localCandidate,
          remoteState,
          idbRecord?.lastSyncedVersion ?? null
        );

        if (decision === 'use-remote' && remoteState) {
          await applyRemoteStateLocally(remoteState, email, remoteDb?.modifiedTime);
          return;
        }

        if (decision === 'push-local') {
          const stateToUpload = localCandidate || inMemoryState;
          if (stateToUpload !== inMemoryState) {
            isHydratingFromDriveRef.current = true;
            lastBusinessSignatureRef.current = getBusinessPayloadSignature(stateToUpload);
            setAppState(stateToUpload);
            setTimeout(() => {
              isHydratingFromDriveRef.current = false;
            }, 250);
          }
          await pushStateToGoogleDriveNow(stateToUpload, email);
          return;
        }

        if (decision === 'noop') {
          const syncedState = remoteState || localCandidate || inMemoryState;
          await applyRemoteStateLocally(syncedState, email, remoteDb?.modifiedTime);
          if (
            remoteCount === 0 &&
            localCount === 0 &&
            !syncedState.profile?.onboardingCompleted
          ) {
            setIsOnboardingWizardOpen(true);
          }
          return;
        }

        // decision === 'conflict' -> Pause auto-save and show explicit conflict resolution dialog
        if (remoteState && localCandidate) {
          if (localCandidate !== inMemoryState) {
            isHydratingFromDriveRef.current = true;
            lastBusinessSignatureRef.current = getBusinessPayloadSignature(localCandidate);
            setAppState(localCandidate);
            setTimeout(() => {
              isHydratingFromDriveRef.current = false;
            }, 250);
          }
          setSyncConflictModal({
            isOpen: true,
            remoteState,
            candidates: remoteDb?.candidates,
            selectedCandidateId: remoteDb?.fileId,
          });
          setDriveSyncState('idle');
          return;
        }
      } catch (err: any) {
        if (err?.message === 'AUTH_REQUIRED') {
          setDriveAuthExpiredNotice(true);
        }
        console.warn('Background Drive sync notice:', err);
        setDriveSyncState('error');
      }
    },
    [applyRemoteStateLocally, getBusinessPayloadSignature, pushStateToGoogleDriveNow]
  );

  // Handlers for SyncConflictModal (Phase 1.2)
  const handleResolveConflictUseRemote = useCallback(async () => {
    const email = googleUserEmailRef.current;
    const remoteState = syncConflictModal.remoteState;
    if (!remoteState || !email) {
      setSyncConflictModal({ isOpen: false, remoteState: null });
      return;
    }
    setSyncConflictModal((prev) => ({ ...prev, isResolving: true }));
    try {
      // Save local state as a pre-overwrite backup on Drive before replacing it with remote
      if (countAppStateRecords(appStateRef.current) > 0) {
        await createDriveBackupSnapshot(appStateRef.current, 'pre-overwrite').catch(() => {});
      }
      await applyRemoteStateLocally(remoteState, email);
      setSyncConflictModal({ isOpen: false, remoteState: null });
    } finally {
      setSyncConflictModal((prev) => ({ ...prev, isResolving: false }));
    }
  }, [applyRemoteStateLocally, syncConflictModal.remoteState]);

  const handleResolveConflictPushLocal = useCallback(async () => {
    const email = googleUserEmailRef.current;
    const remoteState = syncConflictModal.remoteState;
    if (!email) {
      setSyncConflictModal({ isOpen: false, remoteState: null });
      return;
    }
    setSyncConflictModal((prev) => ({ ...prev, isResolving: true }));
    try {
      // Save remote state as a pre-overwrite backup on Drive before overwriting it with local
      if (remoteState && countAppStateRecords(remoteState) > 0) {
        await createDriveBackupSnapshot(remoteState, 'pre-overwrite').catch(() => {});
      }
      const currentLocal = appStateRef.current;
      const nextVersion =
        Math.max(currentLocal.version || 1, remoteState?.version || 1) + 1;
      const bumpedLocal: AppState = {
        ...currentLocal,
        version: nextVersion,
        updatedAt: new Date().toISOString(),
        updatedBy: email,
      };
      isHydratingFromDriveRef.current = true;
      lastBusinessSignatureRef.current = getBusinessPayloadSignature(bumpedLocal);
      setAppState(bumpedLocal);
      setTimeout(() => {
        isHydratingFromDriveRef.current = false;
      }, 250);
      await pushStateToGoogleDriveNow(bumpedLocal, email);
      setSyncConflictModal({ isOpen: false, remoteState: null });
    } finally {
      setSyncConflictModal((prev) => ({ ...prev, isResolving: false }));
    }
  }, [getBusinessPayloadSignature, pushStateToGoogleDriveNow, syncConflictModal.remoteState]);

  const handleSelectDriveCandidate = useCallback(
    async (fileId: string) => {
      setSyncConflictModal((prev) => ({ ...prev, isResolving: true }));
      try {
        const assocId = deriveAssociationId(appStateRef.current.profile);
        const loaded = await loadLiveDatabaseFileById(fileId, assocId);
        if (loaded && loaded.content) {
          const parsed = parseBackupJSON(loaded.content);
          if (parsed) {
            liveDriveFileIdRef.current = fileId;
            setSyncConflictModal((prev) => ({
              ...prev,
              remoteState: parsed,
              selectedCandidateId: fileId,
              isResolving: false,
            }));
            return;
          }
        }
      } catch (err) {
        console.warn('Errore caricamento candidato Drive:', err);
      }
      setSyncConflictModal((prev) => ({ ...prev, isResolving: false }));
    },
    []
  );

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
      pullStateFromGoogleDrive(googleUserEmail).then(() => {
        hasUnsavedPreLoginEditsRef.current = false;
      });
    }
  }, [googleUserEmail, pullStateFromGoogleDrive]);

  // Auto-save in real time on every change to Local IndexedDB, Local PC File, and Google Drive (via SaveQueue)
  useEffect(() => {
    if (isHydratingFromDriveRef.current || syncConflictModal.isOpen) return;

    const currentSignature = getBusinessPayloadSignature(appState);
    const hasBusinessDataChanged = currentSignature !== lastBusinessSignatureRef.current;

    // If business data changed, bump version + updatedAt + updatedBy
    let effectiveState = appState;
    if (hasBusinessDataChanged) {
      lastBusinessSignatureRef.current = currentSignature;
      effectiveState = bumpStateVersion(appState, googleUserEmail);
      isHydratingFromDriveRef.current = true;
      setAppState(effectiveState);
      setTimeout(() => {
        isHydratingFromDriveRef.current = false;
      }, 0);
    }

    const currentCompactJson = serializeAppStateCompact(effectiveState);
    if (!googleUserEmail && currentCompactJson !== initialDefaultJsonRef.current) {
      hasUnsavedPreLoginEditsRef.current = true;
    }

    // Persist account-scoped snapshot in IndexedDB
    saveAppState(effectiveState, googleUserEmail || 'local');

    // If a local PC file handle is connected via File System Access API, write indented JSON to it
    if (localFileHandleRef.current) {
      const handle = localFileHandleRef.current;
      writeToLocalFileHandle(handle, exportBackupJSON(effectiveState))
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

    if (!googleUserEmail) return;
    if (currentCompactJson === lastSavedJsonRef.current) return;

    // Enqueue into the serialized 2000ms debounced Drive save queue
    driveSaveQueueRef.current?.enqueue(effectiveState);
  }, [appState, googleUserEmail, getBusinessPayloadSignature, syncConflictModal.isOpen]);

  // Periodic Automatic Google Drive Sync Timer (every 90 seconds) to ensure any pending state is flushed
  useEffect(() => {
    if (!googleUserEmail) return;
    const interval = setInterval(async () => {
      if (isHydratingFromDriveRef.current || syncConflictModal.isOpen) return;
      if (driveSaveQueueRef.current?.getStatus() === 'pending') {
        await driveSaveQueueRef.current.flush();
        return;
      }
      const currentState = appStateRef.current;
      const currentCompactJson = serializeAppStateCompact(currentState);
      if (currentCompactJson !== lastSavedJsonRef.current || !liveDriveFileIdRef.current) {
        driveSaveQueueRef.current?.enqueue(currentState);
      }
    }, 90_000);
    return () => clearInterval(interval);
  }, [googleUserEmail, syncConflictModal.isOpen]);

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

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);

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
    setIsLogoutModalOpen(true);
  };

  const confirmGoogleLogout = async (wipeLocalData: boolean) => {
    const emailToClear = googleUserEmail;
    setIsLogoutModalOpen(false);
    try {
      await driveSaveQueueRef.current?.flush();
    } catch {
      // ignore flush errors on logout
    }
    await logout();
    setGoogleUserEmail(null);
    setDriveSyncState('idle');
    setLastDriveSavedAt(null);
    liveDriveFileIdRef.current = undefined;

    if (wipeLocalData) {
      await clearLocalAccountData(emailToClear);
      const cleanState = resetToEmpty2027(null);
      isHydratingFromDriveRef.current = true;
      appStateRef.current = cleanState;
      lastBusinessSignatureRef.current = getBusinessPayloadSignature(cleanState);
      lastSavedJsonRef.current = '';
      undoStackRef.current = [];
      redoStackRef.current = [];
      setUndoStack([]);
      setRedoStack([]);
      setTargetDuplicateTxIds([]);
      setAppState(cleanState);
      setTimeout(() => {
        isHydratingFromDriveRef.current = false;
      }, 200);
    }
  };

  // Derived financial summary
  const totals = calculateCashTotals(
    appState.transactions,
    appState.initialFund,
    appState.initialFundBank,
    appState.initialFundCash,
    {
      initialPaypal: appState.profile.initialFundPaypal || 0,
      paymentAccounts: appState.profile.paymentAccounts,
      paypalExpenseSourceAccount: appState.profile.paypalExpenseSourceAccount,
      customPaymentAccounts: appState.profile.customPaymentAccounts,
    }
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

  // Phase 6.2: Reference date tick updated once per minute so notifications are memoized across unrelated renders
  const [notifMinuteTick, setNotifMinuteTick] = useState<number>(() =>
    Math.floor(Date.now() / 60_000)
  );
  useEffect(() => {
    const timer = setInterval(() => {
      setNotifMinuteTick(Math.floor(Date.now() / 60_000));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // System notifications across all modules (memoized, filtered by user-resolved or postponed notifications)
  const notifications = useMemo(
    () =>
      generateSystemNotifications(
        appState.members,
        appState.bookings,
        appState.events,
        appState.gadgetOrders,
        appState.roles,
        appState.assemblies,
        new Date(notifMinuteTick * 60_000),
        appState.grants,
        targetDuplicateTxIds.length > 0 ? appState.transactions : [],
        ignoredDuplicateSignatures,
        appState.profile.notificationResolutions,
        appState.profile.customDeadlines || [],
        appState.profile.completedDeadlineIds || [],
        duplicateDetectionMode,
        appState.staff,
        appState.profile.activeYear,
        appState.profile.staffThresholds
      ),
    [
      appState.members,
      appState.bookings,
      appState.events,
      appState.gadgetOrders,
      appState.roles,
      appState.assemblies,
      notifMinuteTick,
      appState.grants,
      targetDuplicateTxIds.length,
      appState.transactions,
      ignoredDuplicateSignatures,
      appState.profile.notificationResolutions,
      appState.profile.customDeadlines,
      appState.profile.completedDeadlineIds,
      duplicateDetectionMode,
      appState.staff,
      appState.profile.activeYear,
      appState.profile.staffThresholds,
    ]
  );

  // --- Multi-Step Undo / Redo History Stack (up to 30 operations, Phase 2.4 pure applyAction) ---
  const [undoStack, setUndoStack] = useState<{ state: AppState; label: string }[]>([]);
  const [redoStack, setRedoStack] = useState<{ state: AppState; label: string }[]>([]);
  const undoStackRef = useRef<{ state: AppState; label: string }[]>([]);
  const redoStackRef = useRef<{ state: AppState; label: string }[]>([]);
  const lastActionTimestampRef = useRef<number>(0);

  const applyAction = useCallback((label: string, updater: (prev: AppState) => AppState) => {
    const prev = appStateRef.current;
    const next = updater(prev);
    if (next === prev) return;

    const now = Date.now();
    // Coalesce sub-actions fired synchronously within the same UI click (<50ms) into a single atomic Undo entry
    const isCompositeSubAction = now - lastActionTimestampRef.current < 50;
    lastActionTimestampRef.current = now;

    if (!isCompositeSubAction) {
      const nextUndo = [{ state: prev, label }, ...undoStackRef.current].slice(0, 30);
      undoStackRef.current = nextUndo;
      setUndoStack(nextUndo);
      redoStackRef.current = [];
      setRedoStack([]);
    }

    appStateRef.current = next;
    setAppState(next);
  }, []);

  const handleUndo = useCallback(() => {
    const currentUndo = undoStackRef.current;
    if (currentUndo.length === 0) return;
    const [latest, ...rest] = currentUndo;
    const currentSnap = appStateRef.current;
    const nextRedo = [{ state: currentSnap, label: latest.label }, ...redoStackRef.current].slice(
      0,
      30
    );
    undoStackRef.current = rest;
    redoStackRef.current = nextRedo;
    appStateRef.current = latest.state;
    setUndoStack(rest);
    setRedoStack(nextRedo);
    setTargetDuplicateTxIds([]);
    setAppState(latest.state);
  }, []);

  const handleRedo = useCallback(() => {
    const currentRedo = redoStackRef.current;
    if (currentRedo.length === 0) return;
    const [latest, ...rest] = currentRedo;
    const currentSnap = appStateRef.current;
    const nextUndo = [{ state: currentSnap, label: latest.label }, ...undoStackRef.current].slice(
      0,
      30
    );
    redoStackRef.current = rest;
    undoStackRef.current = nextUndo;
    appStateRef.current = latest.state;
    setRedoStack(rest);
    setUndoStack(nextUndo);
    setTargetDuplicateTxIds([]);
    setAppState(latest.state);
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
    const id = newId('tx');
    const tx: CashTransaction = { id, ...newTx };
    // Test ONLY this newly added movement against existing movements
    setTargetDuplicateTxIds([id]);
    applyAction('Aggiunta movimento cassa', (prev) => ({
      ...prev,
      transactions: [tx, ...prev.transactions],
    }));
    const current = appStateRef.current;
    const foundForNew = detectDuplicatesForNewTransactions(
      [id],
      current.transactions,
      current.members,
      current.staff,
      7,
      current.profile.ignoredDuplicateSignatures || [],
      current.profile.duplicateDetectionMode || 'strict'
    );
    if (foundForNew.length > 0) {
      setIsDuplicatesModalOpen(true);
    }
  };

  const handleUpdateTransaction = (updatedTx: CashTransaction) => {
    applyAction('Modifica movimento cassa', (prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === updatedTx.id ? updatedTx : t)),
    }));
  };

  const handleDeleteTransaction = (id: string) => {
    setTargetDuplicateTxIds((prev) => prev.filter((item) => item !== id));
    applyAction('Eliminazione movimento cassa', (prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }));
  };

  const handleDeleteMultipleTransactions = (ids: string[]) => {
    if (ids.length === 0) return;
    triggerPreActionDriveBackup('pre-bulk-delete');
    const idSet = new Set(ids);
    setTargetDuplicateTxIds((prev) => prev.filter((item) => !idSet.has(item)));
    applyAction(`Eliminazione ${ids.length} movimenti`, (prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => !idSet.has(t.id)),
    }));
  };

  const handleLoadSampleDuplicates = () => {
    const sampleTxs = createSampleDuplicateTransactions(appStateRef.current.profile.activeYear);
    setTargetDuplicateTxIds(sampleTxs.map((t) => t.id));
    applyAction('Simulazione duplicati', (prev) => ({
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
    triggerPreActionDriveBackup('pre-import');
    const label =
      txs.length === 0 && mode === 'replace'
        ? 'Azzeramento cassa'
        : `Importazione ${txs.length} movimenti`;
    const importedIds = txs.map((t) => t.id);
    // Run duplicate check once on the newly imported dataset
    setTargetDuplicateTxIds(importedIds);
    applyAction(label, (prev) => ({
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
    const current = appStateRef.current;
    const foundOnImport = detectDuplicatesForNewTransactions(
      importedIds,
      current.transactions,
      current.members,
      current.staff,
      7,
      current.profile.ignoredDuplicateSignatures || [],
      current.profile.duplicateDetectionMode || 'strict'
    );
    if (foundOnImport.length > 0) {
      setIsDuplicatesModalOpen(true);
    }
  };

  const handleUpdateInitialFunds = (funds: {
    initialFund: number;
    initialFundBank: number;
    initialFundCash: number;
  }) => {
    applyAction('Modifica fondo iniziale', (prev) => ({
      ...prev,
      ...funds,
    }));
  };

  // --- Handlers for Recurring Expenses (Spese Ricorrenti) ---
  const handleAddRecurringExpense = (
    newPlan: Omit<RecurringExpensePlan, 'id'>,
    autoGenerateCurrentYearTransactions: boolean
  ) => {
    const planId = newId('rec');
    const fullPlan: RecurringExpensePlan = { id: planId, ...newPlan };

    applyAction('Aggiunta spesa ricorrente', (prev) => {
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
        generatedTransactions = filteredOccurrences.map((occ) => ({
          id: newId('tx-rec'),
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
    applyAction('Rimozione spesa ricorrente', (prev) => ({
      ...prev,
      recurringExpenses: (prev.recurringExpenses || []).filter((p) => p.id !== id),
    }));
  };

  const handleRegisterRecurringOccurrences = (
    newTransactions: Omit<CashTransaction, 'id'>[]
  ) => {
    const txsWithId: CashTransaction[] = newTransactions.map((tx) => ({
      id: newId('tx-rec'),
      ...tx,
    }));
    applyAction(`Contabilizzazione ${newTransactions.length} rate`, (prev) => ({
      ...prev,
      transactions: [...txsWithId, ...prev.transactions],
    }));
  };

  // --- Handlers for Members ---
  const handleAddMember = (newMember: Omit<Member, 'id'>): Member => {
    const id = newId('m');
    const member: Member = { id, ...newMember };
    applyAction('Aggiunta socio', (prev) => ({
      ...prev,
      members: [member, ...prev.members],
    }));
    return member;
  };

  const handleImportMembers = (imported: Member[], mode: 'append' | 'replace') => {
    triggerPreActionDriveBackup('pre-import');
    applyAction(`Importazione ${imported.length} soci`, (prev) => ({
      ...prev,
      members: mode === 'replace' ? imported : [...imported, ...prev.members],
    }));
  };

  const handleUpdateMember = (updated: Member) => {
    applyAction('Modifica socio', (prev) => ({
      ...prev,
      members: prev.members.map((m) => (m.id === updated.id ? updated : m)),
    }));
  };

  const handleDeleteMember = (id: string) => {
    // Phase 4.4: Deleting a member preserves all accounting transactions and unlinks memberId
    applyAction('Eliminazione socio', (prev) => ({
      ...prev,
      members: prev.members.filter((m) => m.id !== id),
      transactions: prev.transactions.map((t) =>
        t.memberId === id ? { ...t, memberId: undefined } : t
      ),
      bookings: prev.bookings.map((b) =>
        b.memberId === id ? { ...b, memberId: '' } : b
      ),
      gadgetOrders: prev.gadgetOrders.map((o) =>
        o.memberId === id ? { ...o, memberId: undefined } : o
      ),
    }));
  };

  // --- Handlers for Events & Bookings ---
  const handleAddEvent = (newEv: Omit<EventItem, 'id'>) => {
    const id = newId('ev');
    applyAction('Nuovo evento', (prev) => ({
      ...prev,
      events: [...prev.events, { id, ...newEv }],
    }));
  };

  const handleUpdateEvent = (updatedEv: EventItem) => {
    applyAction('Modifica evento', (prev) => ({
      ...prev,
      events: prev.events.map((e) => (e.id === updatedEv.id ? updatedEv : e)),
      bookings: prev.bookings.map((b) =>
        b.eventId === updatedEv.id ? { ...b, eventName: updatedEv.name } : b
      ),
    }));
  };

  const handleDeleteEvent = (eventId: string) => {
    applyAction('Eliminazione evento', (prev) => ({
      ...prev,
      events: prev.events.filter((e) => e.id !== eventId),
      bookings: prev.bookings.filter((b) => b.eventId !== eventId),
    }));
  };

  const handleAddBooking = (newBooking: Omit<EventBooking, 'id'>): EventBooking => {
    const id = newId('bk');
    const booking: EventBooking = { id, ...newBooking };
    applyAction('Nuova iscrizione evento', (prev) => ({
      ...prev,
      bookings: [booking, ...prev.bookings],
    }));
    return booking;
  };

  const handleUpdateBooking = (updated: EventBooking) => {
    applyAction('Modifica iscrizione evento', (prev) => ({
      ...prev,
      bookings: prev.bookings.map((b) => (b.id === updated.id ? updated : b)),
    }));
  };

  const handleDeleteBooking = (
    bookingId: string,
    alsoDeleteLinkedTransactions: boolean = false
  ) => {
    applyAction('Eliminazione iscrizione evento', (prev) => ({
      ...prev,
      bookings: prev.bookings.filter((b) => b.id !== bookingId),
      transactions: alsoDeleteLinkedTransactions
        ? prev.transactions.filter((t) => t.bookingId !== bookingId)
        : prev.transactions.map((t) =>
            t.bookingId === bookingId ? { ...t, bookingId: undefined } : t
          ),
    }));
  };

  // --- Handlers for Grants (Bandi & Progetti) ---
  const handleAddGrant = (newGrant: Omit<GrantItem, 'id'>) => {
    const id = newId('gr');
    applyAction('Nuovo bando', (prev) => ({
      ...prev,
      grants: [{ id, ...newGrant }, ...prev.grants],
    }));
  };

  const handleUpdateGrant = (updatedGrant: GrantItem) => {
    applyAction('Modifica bando', (prev) => ({
      ...prev,
      grants: prev.grants.map((g) => (g.id === updatedGrant.id ? updatedGrant : g)),
    }));
  };

  const handleDeleteGrant = (grantId: string) => {
    applyAction('Eliminazione bando', (prev) => ({
      ...prev,
      grants: prev.grants.filter((g) => g.id !== grantId),
    }));
  };

  // --- Handlers for Gadgets & Gadget Orders ---
  const handleAddGadgetItem = (item: Omit<GadgetItem, 'id'>) => {
    const id = newId('gd');
    applyAction('Nuovo articolo gadget', (prev) => ({
      ...prev,
      gadgets: [...prev.gadgets, { id, ...item }],
    }));
  };

  const handleAddGadgetOrder = (
    order: Omit<GadgetOrder, 'id'>,
    registerInCashFlow: boolean
  ) => {
    const id = newId('go');
    const fullOrder: GadgetOrder = { id, ...order };

    applyAction('Nuova prenotazione gadget', (prev) => {
      const nextTransactions =
        registerInCashFlow && order.isPaid && order.totalPrice > 0
          ? [
              {
                id: newId('tx-gd'),
                date: order.date,
                category: 'Gadget' as const,
                income: order.totalPrice,
                expense: null,
                method: order.paymentMethod,
                description: `Gadget ${order.gadgetName} (${order.variant}) - ${order.childName}`,
                gadgetOrderId: id,
                memberId: order.memberId || undefined,
                relatedMemberName: order.childName,
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
    applyAction('Modifica ordine gadget', (prev) => ({
      ...prev,
      gadgetOrders: prev.gadgetOrders.map((o) => (o.id === updated.id ? updated : o)),
    }));
  };

  const handleDeleteGadgetOrder = (id: string) => {
    applyAction('Eliminazione ordine gadget', (prev) => ({
      ...prev,
      gadgetOrders: prev.gadgetOrders.filter((o) => o.id !== id),
    }));
  };

  const handleImportGadgetOrders = (orders: GadgetOrder[]) => {
    applyAction(`Importazione ${orders.length} ordini gadget`, (prev) => ({
      ...prev,
      gadgetOrders: [...orders, ...prev.gadgetOrders],
    }));
  };

  // --- Handlers for Governance Roles & Assemblies ---
  const handleAddRole = (role: Omit<AssociationRole, 'id'>) => {
    const id = newId('role');
    applyAction('Nuova carica sociale', (prev) => ({
      ...prev,
      roles: [...prev.roles, { id, ...role }],
    }));
  };

  const handleUpdateRole = (updated: AssociationRole) => {
    applyAction('Modifica carica sociale', (prev) => ({
      ...prev,
      roles: prev.roles.map((r) => (r.id === updated.id ? updated : r)),
    }));
  };

  const handleDeleteRole = (id: string) => {
    applyAction('Eliminazione carica sociale', (prev) => ({
      ...prev,
      roles: prev.roles.filter((r) => r.id !== id),
    }));
  };

  const handleAddAssembly = (asm: Omit<AssemblyMeeting, 'id'>) => {
    const id = newId('asm');
    applyAction('Nuova assemblea', (prev) => ({
      ...prev,
      assemblies: [
        { id, ...asm },
        ...prev.assemblies,
      ],
    }));
  };

  const handleUpdateAssembly = (updated: AssemblyMeeting) => {
    applyAction('Modifica assemblea', (prev) => ({
      ...prev,
      assemblies: prev.assemblies.map((a) => (a.id === updated.id ? updated : a)),
    }));
  };

  // --- Handlers for Staff ---
  const handleAddStaffMember = (newStaff: StaffMember) => {
    applyAction('Nuovo collaboratore staff', (prev) => ({
      ...prev,
      staff: [...prev.staff, newStaff],
    }));
  };

  const handleUpdateStaffMember = (updatedStaff: StaffMember) => {
    applyAction(`Aggiornamento collaboratore ${updatedStaff.name}`, (prev) => ({
      ...prev,
      staff: prev.staff.map((s) => (s.id === updatedStaff.id ? updatedStaff : s)),
    }));
  };

  const handleLinkLegacyStaffPayments = (
    links: {
      transactionId: string;
      staffId: string;
      staffPaymentKind: 'compenso_sportivo' | 'servizi_guida' | 'progettazione' | 'rimborso_spese';
    }[]
  ) => {
    if (links.length === 0) return;
    const linkMap = new Map(links.map((l) => [l.transactionId, l]));
    applyAction(`Collegamento ${links.length} pagamenti storici staff`, (prev) => ({
      ...prev,
      transactions: prev.transactions.map((tx) => {
        const matched = linkMap.get(tx.id);
        if (!matched) return tx;
        return {
          ...tx,
          staffId: matched.staffId,
          staffPaymentKind: matched.staffPaymentKind,
        };
      }),
    }));
  };

  // --- Handlers for Profile, Fiscal Year Archiving & Backup ---
  const handleUpdateProfile = (profile: AssociationProfile) => {
    setAppState((prev) => {
      const next = { ...prev, profile };
      appStateRef.current = next;
      return next;
    });
  };

  const handleArchiveFiscalYear = (targetNewYear: number): ArchivedFiscalYear | null => {
    triggerPreActionDriveBackup('pre-archive');
    let archived: ArchivedFiscalYear | null = null;
    applyAction(`Archiviazione anno ${appStateRef.current.profile.activeYear}`, (prev) => {
      const { nextState, archivedRecord } = archiveFiscalYearState(prev, targetNewYear);
      archived = archivedRecord || null;
      const retentionYears = nextState.profile.archiveHealthDataRetentionYears ?? 0;
      if (retentionYears > 0 && nextState.archivedYears.length > 0) {
        const { updatedArchives: cleanedArchives } = anonymizeArchivedHealthData(
          nextState.archivedYears,
          retentionYears,
          nextState.profile.activeYear
        );
        return {
          ...nextState,
          archivedYears: cleanedArchives,
        };
      }
      return nextState;
    });
    return archived;
  };

  const handleAnonymizeArchivedHealthData = (minAgeYears: number = 0): number => {
    let totalAnonymized = 0;
    applyAction('Anonimizzazione dati sanitari negli archivi storici', (prev) => {
      const { updatedArchives: nextArchives, anonymizedMembersCount } =
        anonymizeArchivedHealthData(
          prev.archivedYears,
          minAgeYears,
          prev.profile.activeYear
        );
      totalAnonymized = anonymizedMembersCount;
      if (anonymizedMembersCount === 0) return prev;
      return {
        ...prev,
        archivedYears: nextArchives,
      };
    });
    return totalAnonymized;
  };

  const handleUpdateArchivedYear = (updatedArch: ArchivedFiscalYear) => {
    applyAction(`Aggiornamento archivio anno ${updatedArch.year}`, (prev) => ({
      ...prev,
      archivedYears: prev.archivedYears.map((a) =>
        a.id === updatedArch.id || a.year === updatedArch.year ? updatedArch : a
      ),
    }));
  };

  const handleRestoreState = (restored: AppState) => {
    triggerPreActionDriveBackup('pre-overwrite');
    applyAction('Ripristino backup', () => restored);
  };

  const handleResetToDefaults = () => {
    triggerPreActionDriveBackup('pre-overwrite');
    const empty2027 = resetToEmpty2027(googleUserEmail);
    applyAction('Reset gestionale', () => empty2027);
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

  // --- Handlers for Progressive Receipt Registry (Phase 3 & Phase 4.1) ---
  const handleIssueReceipt = (issued: IssuedReceipt) => {
    applyAction(`Emissione ricevuta N° ${issued.number}`, (prev) => {
      const currentReceipts = Array.isArray(prev.receipts) ? prev.receipts : [];
      const existingIndex = currentReceipts.findIndex((r) => r.id === issued.id);
      const nextReceipts =
        existingIndex >= 0
          ? currentReceipts.map((r, idx) => (idx === existingIndex ? issued : r))
          : [issued, ...currentReceipts];

      const nextTransactions = issued.transactionId
        ? prev.transactions.map((t) =>
            t.id === issued.transactionId ? { ...t, receiptId: issued.id } : t
          )
        : prev.transactions;

      return {
        ...prev,
        receipts: nextReceipts,
        transactions: nextTransactions,
      };
    });
  };

  const handleCancelReceipt = (receiptId: string, cancelReason: string) => {
    const trimmedReason = cancelReason.trim();
    if (!trimmedReason) return;
    const target = (appStateRef.current.receipts || []).find((r) => r.id === receiptId);
    applyAction(`Annullamento ricevuta N° ${target?.number || receiptId}`, (prev) => ({
      ...prev,
      receipts: (prev.receipts || []).map((r) =>
        r.id === receiptId
          ? {
              ...r,
              status: 'annullata',
              cancelReason: trimmedReason,
              cancelledAt: new Date().toISOString(),
            }
          : r
      ),
    }));
  };

  const handleReopenReceiptFromRegistry = (
    receipt: IssuedReceipt,
    openGmailPanel: boolean = false
  ) => {
    const matchedMember = receipt.memberId
      ? appState.members.find((m) => m.id === receipt.memberId)
      : undefined;
    const matchedBooking = receipt.bookingId
      ? appState.bookings.find((b) => b.id === receipt.bookingId)
      : undefined;
    const matchedTx = receipt.transactionId
      ? appState.transactions.find((t) => t.id === receipt.transactionId)
      : undefined;

    setReceiptModal({
      isOpen: true,
      member: matchedMember,
      booking: matchedBooking,
      transaction: matchedTx,
      existingReceipt: receipt,
      initialOpenGmailPanel: openGmailPanel,
    });
  };

  if (standaloneLegalRoute) {
    return (
      <LegalPagesView
        page={standaloneLegalRoute}
        isStandalonePage={true}
        onSwitchPage={(nextPage) => {
          try {
            window.history.pushState({}, '', `/${nextPage}`);
          } catch {
            // ignore pushState error in restricted iframe
          }
          setStandaloneLegalRoute(nextPage);
        }}
        onClose={() => {
          try {
            window.history.pushState({}, '', '/');
          } catch {
            // ignore pushState error in restricted iframe
          }
          setStandaloneLegalRoute(null);
        }}
      />
    );
  }

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
        onOpenLegalPage={(page) => setModalLegalPage(page)}
        onOpenOnboardingWizard={() => setIsOnboardingWizardOpen(true)}
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

          <Suspense
            fallback={
              <div className="p-8 text-center text-xs text-slate-500 font-medium">
                Caricamento sezione...
              </div>
            }
          >
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
              staff={appState.staff}
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
              onOpenReceiptsRegistry={() => setActiveTab('receipts_config')}
              receiptsCount={(appState.receipts || []).length}
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
              bookings={appState.bookings}
              transactions={appState.transactions}
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
              transactions={appState.transactions}
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
              onUpdateStaffMember={handleUpdateStaffMember}
              onLinkLegacyStaffPayments={handleLinkLegacyStaffPayments}
              onUpdateProfile={handleUpdateProfile}
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
              staff={appState.staff}
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
              receipts={appState.receipts || []}
              onUpdateProfile={handleUpdateProfile}
              onCancelReceipt={handleCancelReceipt}
              onReopenReceiptPdf={(rec) => handleReopenReceiptFromRegistry(rec, false)}
              onResendReceiptEmail={(rec) => handleReopenReceiptFromRegistry(rec, true)}
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
              onUpdateArchivedYear={handleUpdateArchivedYear}
              onAnonymizeArchivedHealthData={handleAnonymizeArchivedHealthData}
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
              onOpenOnboardingWizard={() => setIsOnboardingWizardOpen(true)}
              localFileName={localFileName}
              lastLocalSavedAt={lastLocalSavedAt}
              onConnectLocalFile={handleConnectLocalFile}
              onSaveLocalFile={handleSaveLocalFile}
            />
          )}
          </Suspense>
        </main>
      </div>

      {/* Phase 5.2: Logout Confirmation Modal with Local Data Wipe (Default: Yes) */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="space-y-1.5">
              <h3 className="text-base font-extrabold text-slate-900">
                Disconnessione Account Google
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Vuoi cancellare i dati dell&apos;associazione da questo computer?{' '}
                <strong className="text-slate-800">(consigliato sui PC condivisi)</strong>
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                I dati salvati su Google Drive o nel tuo file <code className="font-mono">.json</code> non
                verranno toccati e saranno ricaricati automaticamente al prossimo accesso.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                autoFocus
                onClick={() => confirmGoogleLogout(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors shadow-xs"
              >
                Sì, esci e cancella i dati da questo computer (Consigliato)
              </button>
              <button
                type="button"
                onClick={() => confirmGoogleLogout(false)}
                className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs border border-slate-200 transition-colors"
              >
                No, esci mantenendo la copia locale su questo PC
              </button>
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="w-full py-1.5 px-4 rounded-xl text-slate-500 hover:text-slate-800 font-medium text-xs transition-colors"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Global Receipt & Estimate Modal (Lazy-loaded on open) */}
      {receiptModal.isOpen && (
        <Suspense fallback={null}>
          <ReceiptModal
            isOpen={receiptModal.isOpen}
            onClose={() => setReceiptModal({ isOpen: false })}
            member={receiptModal.member}
            booking={receiptModal.booking}
            transaction={receiptModal.transaction}
            gadgetOrder={receiptModal.gadgetOrder}
            existingReceipt={receiptModal.existingReceipt}
            initialOpenGmailPanel={receiptModal.initialOpenGmailPanel}
            receipts={appState.receipts || []}
            events={appState.events}
            gadgets={appState.gadgets}
            googleUserEmail={googleUserEmail}
            profile={appState.profile}
            onUpdateProfile={handleUpdateProfile}
            onUpdateMember={handleUpdateMember}
            onUpdateBooking={handleUpdateBooking}
            onUpdateGadgetOrder={handleUpdateGadgetOrder}
            onIssueReceipt={handleIssueReceipt}
            onOpenFullConfigPanel={() => setActiveTab('receipts_config')}
          />
        </Suspense>
      )}

      {/* Global Digital Membership Card Generator & Template Designer Modal (Lazy-loaded on open) */}
      {digitalCardModal.isOpen && (
        <Suspense fallback={null}>
          <DigitalMemberCardModal
            isOpen={digitalCardModal.isOpen}
            onClose={() => setDigitalCardModal({ isOpen: false, member: null })}
            member={digitalCardModal.member}
            members={appState.members}
            profile={appState.profile}
            onUpdateProfile={handleUpdateProfile}
            onUpdateMember={handleUpdateMember}
          />
        </Suspense>
      )}

      {/* Global Google Drive Sync Conflict & Multi-Candidate Resolution Modal (Phase 1) */}
      <SyncConflictModal
        isOpen={syncConflictModal.isOpen}
        localState={appState}
        remoteState={syncConflictModal.remoteState}
        candidates={syncConflictModal.candidates}
        selectedCandidateId={syncConflictModal.selectedCandidateId}
        isResolving={syncConflictModal.isResolving}
        onUseRemote={handleResolveConflictUseRemote}
        onPushLocal={handleResolveConflictPushLocal}
        onSelectCandidate={handleSelectDriveCandidate}
      />

      {/* Phase 7: Guided First-Start & Multi-Association Onboarding Wizard Modal */}
      <OnboardingWizardModal
        isOpen={isOnboardingWizardOpen}
        profile={appState.profile}
        onClose={() => setIsOnboardingWizardOpen(false)}
        onSaveProfile={(updatedProfile) => {
          handleUpdateProfile(updatedProfile);
        }}
      />

      {/* Phase 7: Privacy (/privacy) and Terms (/termini) Modal View */}
      {modalLegalPage && (
        <LegalPagesView
          page={modalLegalPage}
          isStandalonePage={false}
          onSwitchPage={(nextPage) => setModalLegalPage(nextPage)}
          onClose={() => setModalLegalPage(null)}
        />
      )}
    </div>
  );
}

