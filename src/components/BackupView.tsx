import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  Upload,
  RotateCcw,
  FileSpreadsheet,
  Save,
  CheckCircle2,
  HardDrive,
  ExternalLink,
  RefreshCw,
  LogOut,
  FileText,
  FolderTree,
  Archive,
  ArrowRight,
  FolderOpen,
  Stamp,
  PenTool,
  Sliders,
  CreditCard,
  Users,
  Calendar,
} from 'lucide-react';
import {
  AppState,
  exportBackupJSON,
  parseBackupJSON,
  computeYearTransitionMemberStats,
  downloadJsonBackup,
} from '../utils/storage';
import {
  exportTransactionsToCSV,
  exportMembersToCSV,
  exportAccountingToExcel,
  exportArchivedYearToExcel,
} from '../utils/export';
import { formatEuro, calculateCashTotals } from '../utils/finance';
import { todayIso } from '../utils/dates';
import {
  AssociationProfile,
  Member,
  CashTransaction,
  ArchivedFiscalYear,
  GoogleFormFieldConfig,
  DriveBackupEntry,
} from '../types';
import {
  DriveFileItem,
  DRIVE_ROOT_FOLDER_NAME,
  DRIVE_CATEGORY_FOLDERS,
  DriveCategoryKey,
  ensureGestionaleDriveStructure,
  listDriveFiles,
  uploadFileToDrive,
  createAndPopulateSpreadsheet,
  getSpreadsheetMetadata,
  readSpreadsheetSheet,
  createGoogleFormForActivity,
  createDriveBackupSnapshot,
  listDriveBackups,
  loadDriveBackupById,
  saveArchivedYearFileToDrive,
  loadArchivedYearFileFromDrive,
} from '../services/googleWorkspace';
import {
  downloadEmptyExcelTemplate,
  parseMembersFromRows,
  parseTransactionsFromRows,
} from '../utils/csvExcelImporter';
import { compressImageFileToDataUrl } from '../utils/formAndReceiptTemplates';
import { extractGoogleSpreadsheetId } from '../utils/sanitize';
import { GoogleSignInButton } from './GoogleSignInButton';
import { GoogleFormBuilderModal } from './GoogleFormBuilderModal';

interface BackupViewProps {
  appState: AppState;
  googleUserEmail: string | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onRestoreState: (state: AppState) => void;
  onResetToDefaults: () => void;
  onArchiveFiscalYear: (targetNewYear: number) => ArchivedFiscalYear | null;
  onUpdateArchivedYear?: (updated: ArchivedFiscalYear) => void;
  onAnonymizeArchivedHealthData?: (minAgeYears?: number) => number;
  onUpdateProfile: (profile: AssociationProfile) => void;
  onImportMembers: (members: Member[], mode: 'append' | 'replace') => void;
  onImportTransactions: (txs: CashTransaction[], mode: 'append' | 'replace') => void;
  onOpenReceiptCustomizer?: () => void;
  onOpenDigitalCardDesigner?: () => void;
  onOpenOnboardingWizard?: () => void;
  localFileName?: string | null;
  lastLocalSavedAt?: string | null;
  onConnectLocalFile?: () => void;
  onSaveLocalFile?: () => void;
}

export const BackupView: React.FC<BackupViewProps> = ({
  appState,
  googleUserEmail,
  onGoogleSignIn,
  onGoogleLogout,
  onRestoreState,
  onResetToDefaults,
  onArchiveFiscalYear,
  onUpdateArchivedYear,
  onAnonymizeArchivedHealthData,
  onUpdateProfile,
  onImportMembers,
  onImportTransactions,
  onOpenReceiptCustomizer,
  onOpenDigitalCardDesigner,
  onOpenOnboardingWizard,
  localFileName,
  lastLocalSavedAt,
  onConnectLocalFile,
  onSaveLocalFile,
}) => {
  const [profileForm, setProfileForm] = useState<AssociationProfile>(appState.profile);
  const [profileSaved, setProfileSaved] = useState(false);
  const [targetNewYear, setTargetNewYear] = useState<number>(appState.profile.activeYear + 1);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);

  useEffect(() => {
    setProfileForm(appState.profile);
    setTargetNewYear(appState.profile.activeYear + 1);
  }, [appState.profile]);

  // Google Workspace state
  const [isSyncing, setIsSyncing] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState<{
    type: 'ok' | 'err';
    text: string;
    linkUrl?: string;
    linkLabel?: string;
  } | null>(null);
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<DriveFileItem[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [pastedSheetUrlOrId, setPastedSheetUrlOrId] = useState<string>('');
  const [importTargetType, setImportTargetType] = useState<'soci' | 'cassa'>('soci');
  const [driveStructureLinks, setDriveStructureLinks] = useState<
    Record<string, DriveFileItem> | null
  >(null);
  const [driveBackups, setDriveBackups] = useState<DriveBackupEntry[]>([]);
  const [isLoadingDriveBackups, setIsLoadingDriveBackups] = useState(false);

  const refreshDriveBackupsList = async () => {
    if (!googleUserEmail) {
      setDriveBackups([]);
      return;
    }
    try {
      setIsLoadingDriveBackups(true);
      const list = await listDriveBackups();
      setDriveBackups(list);
    } catch {
      // ignore if token expired or offline
    } finally {
      setIsLoadingDriveBackups(false);
    }
  };

  useEffect(() => {
    if (googleUserEmail) {
      void refreshDriveBackupsList();
    } else {
      setDriveBackups([]);
    }
  }, [googleUserEmail]);

  const handleCreateManualDriveSnapshot = async () => {
    try {
      setIsLoadingDriveBackups(true);
      const entry = await createDriveBackupSnapshot(appState, 'manual');
      setWorkspaceStatus({
        type: 'ok',
        text: `Punto di ripristino creato su Google Drive: ${entry.name} (v${appState.version || 1})`,
        linkUrl: entry.webViewLink,
        linkLabel: 'Apri file su Drive',
      });
      await refreshDriveBackupsList();
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'err',
        text: err?.message || 'Impossibile creare il punto di ripristino su Google Drive',
      });
    } finally {
      setIsLoadingDriveBackups(false);
    }
  };

  const handleDownloadDriveSnapshot = async (entry: DriveBackupEntry) => {
    try {
      setIsLoadingDriveBackups(true);
      const state = await loadDriveBackupById(entry.id);
      downloadJsonBackup(state, entry.name);
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'err',
        text: err?.message || 'Impossibile scaricare il backup selezionato da Google Drive',
      });
    } finally {
      setIsLoadingDriveBackups(false);
    }
  };

  const handleRestoreDriveSnapshot = async (entry: DriveBackupEntry) => {
    try {
      setIsLoadingDriveBackups(true);
      // Save current state as a pre-overwrite backup first so nothing is ever lost
      await createDriveBackupSnapshot(appState, 'pre-overwrite').catch(() => {});
      const restoredState = await loadDriveBackupById(entry.id);
      onRestoreState(restoredState);
      setWorkspaceStatus({
        type: 'ok',
        text: `Ripristinato con successo il backup "${entry.name}". La versione precedente è stata salvata in Backup_Automatici.`,
      });
      await refreshDriveBackupsList();
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'err',
        text: err?.message || 'Errore durante il ripristino del backup da Google Drive',
      });
    } finally {
      setIsLoadingDriveBackups(false);
    }
  };

  const currentTotals = calculateCashTotals(
    appState.transactions,
    appState.initialFund,
    appState.initialFundBank,
    appState.initialFundCash
  );

  const memberTransitionStats = computeYearTransitionMemberStats(
    appState.members,
    appState.profile.activeYear,
    targetNewYear
  );

  const loadUserSpreadsheets = async () => {
    if (!googleUserEmail) return;
    try {
      const files = await listDriveFiles(
        "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
      );
      setDriveSpreadsheets(files);
      if (files.length > 0 && !selectedSheetId) {
        setSelectedSheetId(files[0].id);
      }
    } catch (err) {
      console.error('Error listing spreadsheets:', err);
    }
  };

  useEffect(() => {
    if (googleUserEmail) {
      loadUserSpreadsheets();
    } else {
      setDriveSpreadsheets([]);
      setDriveStructureLinks(null);
    }
  }, [googleUserEmail]);

  // Initialize / Sync the full "Gestionale ASD" folder tree on Google Drive
  const handleInitGestionaleDriveFolders = async () => {
    if (!googleUserEmail) {
      setWorkspaceStatus({
        type: 'err',
        text: 'Connetti prima il tuo account Google per creare la cartella "Gestionale ASD" sul tuo Google Drive.',
      });
      return;
    }

    const confirmed = confirm(
      `Vuoi creare o verificare sul tuo Google Drive la cartella principale "${DRIVE_ROOT_FOLDER_NAME}" e tutte le 7 sottocartelle ripartite per categoria (Anagrafica Soci, Contabilità e Cassa, Eventi, Verbali e Governance, Bandi, Archivio Annualità, Backup)?`
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setWorkspaceStatus(null);
    try {
      const res = await ensureGestionaleDriveStructure();
      setDriveStructureLinks(res.subfolders);
      onUpdateProfile({
        ...appState.profile,
        driveRootFolderId: res.rootFolder.id,
        driveRootFolderUrl: res.rootFolder.webViewLink,
      });
      setWorkspaceStatus({
        type: 'ok',
        text: `Struttura Google Drive "${DRIVE_ROOT_FOLDER_NAME}" (con 7 sottocartelle categorizzate) pronta e sincronizzata!`,
        linkUrl: res.rootFolder.webViewLink,
        linkLabel: `Apri Cartella "${DRIVE_ROOT_FOLDER_NAME}" su Drive`,
      });
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'err',
        text: err?.message || 'Errore nella creazione della struttura cartelle su Google Drive.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Archive current fiscal year and transition to new year
  const handleArchiveAndTransitionYear = async () => {
    const currentYear = appState.profile.activeYear;
    const confirmed = confirm(
      `Confermi la chiusura e l'archiviazione dell'Anno Sportivo ${currentYear} e il passaggio al nuovo Anno ${targetNewYear}?\n\n` +
        `• FLUSSI DI CASSA ARCHIVIATI: Tutti i movimenti di cassa (${appState.transactions.length}) e le prenotazioni del ${currentYear} verranno salvati nell'Archivio Storico Annualità.\n` +
        `• RESIDUO A BILANCIO MANTENUTO: Il saldo finale attuale (${formatEuro(currentTotals.currentTotal)}, di cui Banca ${formatEuro(currentTotals.currentBank)} e Contanti ${formatEuro(currentTotals.currentCash)}) verrà mantenuto e riportato come Fondo Cassa Iniziale del ${targetNewYear}.\n` +
        `• SOCI MANTENUTI IN ANAGRAFICA CON SCADENZA TESSERINO: Tutti i ${memberTransitionStats.totalMembersRetained} soci restano salvati in Anagrafica! Per ${memberTransitionStats.expiredCardsToRenewCount} soci con tessera solare scadrà il tesserino al 31/12/${currentYear} (spostato nello storico tessere), mentre ${memberTransitionStats.stillValidTessera365Count} soci con Tessera 365 manterranno la tessera attiva anche nel ${targetNewYear}.`
    );
    if (!confirmed) return;

    const archivedSnapshot = onArchiveFiscalYear(targetNewYear);

    if (archivedSnapshot && googleUserEmail) {
      setIsSyncing(true);
      try {
        const uploaded = await saveArchivedYearFileToDrive(
          archivedSnapshot,
          appState.profile.name
        );
        onUpdateArchivedYear?.({
          ...archivedSnapshot,
          driveFileId: uploaded.fileId,
          driveWebViewLink: uploaded.webViewLink,
        });
        setWorkspaceStatus({
          type: 'ok',
          text: `Anno ${currentYear} archiviato! Ora sei nell'esercizio ${targetNewYear}: mantenuto il residuo a bilancio (${formatEuro(currentTotals.currentTotal)}) e tutti i ${memberTransitionStats.totalMembersRetained} soci in anagrafica (${memberTransitionStats.expiredCardsToRenewCount} tesserini scaduti da rinnovare, ${memberTransitionStats.stillValidTessera365Count} Tessere 365 ancora valide).`,
          linkUrl: uploaded.webViewLink,
          linkLabel: `Vedi Archivio ${currentYear} su Drive`,
        });
      } catch {
        setWorkspaceStatus({
          type: 'ok',
          text: `Anno ${currentYear} archiviato! Ora sei nell'esercizio ${targetNewYear}: mantenuto il residuo a bilancio di ${formatEuro(currentTotals.currentTotal)} e tutti i ${memberTransitionStats.totalMembersRetained} soci in anagrafica (${memberTransitionStats.expiredCardsToRenewCount} tesserini scaduti da rinnovare).`,
        });
      } finally {
        setIsSyncing(false);
      }
    } else {
      setWorkspaceStatus({
        type: 'ok',
        text: `Anno ${currentYear} archiviato con successo! Ora sei nell'esercizio ${targetNewYear}: mantenuto solo il residuo a bilancio (${formatEuro(currentTotals.currentTotal)}) e mantenuti tutti i ${memberTransitionStats.totalMembersRetained} soci in anagrafica (${memberTransitionStats.expiredCardsToRenewCount} tesserini scaduti al 31/12/${currentYear}).`,
      });
    }
  };

  // Save a specific archived year to Google Drive (06_Archivio_Annualita_Storiche)
  const handleSaveArchivedYearToDrive = async (arch: ArchivedFiscalYear) => {
    if (!googleUserEmail) {
      setWorkspaceStatus({
        type: 'err',
        text: 'Connetti prima il tuo account Google per salvare l\'annualità archiviata su Google Drive.',
      });
      return;
    }

    setIsSyncing(true);
    setWorkspaceStatus(null);
    try {
      const uploaded = await saveArchivedYearFileToDrive(arch, appState.profile.name);
      onUpdateArchivedYear?.({
        ...arch,
        driveFileId: uploaded.fileId,
        driveWebViewLink: uploaded.webViewLink,
      });
      setWorkspaceStatus({
        type: 'ok',
        text: `Archivio Anno ${arch.year} salvato in "Gestionale ASD / 06_Archivio_Annualita_Storiche"!`,
        linkUrl: uploaded.webViewLink,
        linkLabel: 'Apri Archivio su Google Drive',
      });
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'err',
        text: err?.message || 'Errore nel salvataggio dell\'annualità su Google Drive.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Phase 6.2: Toggle hybrid light-summary mode (keep full detail arrays on Drive only, or reload them on demand)
  const handleToggleLightArchivedYear = async (arch: ArchivedFiscalYear) => {
    if (!arch.driveFileId || !onUpdateArchivedYear) return;

    if (!arch.isLightSummaryOnly) {
      // Offload heavy arrays in main database_gestionale_asd.json while keeping summary & driveFileId
      onUpdateArchivedYear({
        ...arch,
        transactions: [],
        membersSnapshot: [],
        events: [],
        bookings: [],
        gadgetOrders: [],
        isLightSummaryOnly: true,
      });
      setWorkspaceStatus({
        type: 'ok',
        text: `Archivio Anno ${arch.year} alleggerito nel database principale: il riepilogo bilanci rimane visibile e i dettagli completi sono custoditi nel file dedicato su Google Drive.`,
        linkUrl: arch.driveWebViewLink,
        linkLabel: 'Vedi file completo su Drive',
      });
    } else {
      // Reload full details from Drive file
      setIsSyncing(true);
      setWorkspaceStatus(null);
      try {
        const fullArchive = await loadArchivedYearFileFromDrive(arch.driveFileId);
        onUpdateArchivedYear({
          ...fullArchive,
          id: arch.id,
          driveFileId: arch.driveFileId,
          driveWebViewLink: arch.driveWebViewLink,
          isLightSummaryOnly: false,
        });
        setWorkspaceStatus({
          type: 'ok',
          text: `Dettagli completi dell'Archivio Anno ${arch.year} ricaricati da Google Drive!`,
        });
      } catch (err: any) {
        setWorkspaceStatus({
          type: 'err',
          text:
            err?.message ||
            `Impossibile ricaricare i dettagli dell'Anno ${arch.year} da Google Drive.`,
        });
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleExportArchivedYearExcelWithOnDemandLoad = async (arch: ArchivedFiscalYear) => {
    if (arch.isLightSummaryOnly && arch.driveFileId) {
      setIsSyncing(true);
      try {
        const fullArchive = await loadArchivedYearFileFromDrive(arch.driveFileId);
        await exportArchivedYearToExcel(fullArchive, appState.profile.name);
        return;
      } catch (err: any) {
        setWorkspaceStatus({
          type: 'err',
          text:
            err?.message ||
            `Connetti Google Drive per scaricare i dettagli completi dell'Anno ${arch.year} prima dell'esportazione Excel.`,
        });
        return;
      } finally {
        setIsSyncing(false);
      }
    }
    await exportArchivedYearToExcel(arch, appState.profile.name);
  };

  const handleExportAllToGoogleSheets = async () => {
    if (!googleUserEmail) return;
    const confirmed = confirm(
      'Vuoi creare un nuovo foglio Google Sheets nella cartella "Gestionale ASD / 07_Backup_Sistema" contenente tutte le tabelle aggiornate (Soci, Flusso di Cassa, Iscritti Eventi e Ordini Gadget)?'
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setWorkspaceStatus(null);
    try {
      const sociRows: (string | number | boolean)[][] = [
        [
          'Nome Bimbo/a',
          'Data Nascita',
          'Luogo Nascita',
          'Gruppo',
          'CF Bimbo',
          'Residenza',
          'Genitore',
          'CF Genitore',
          'Telefono',
          'Email',
          'Num Tessera',
          'Pagata',
          'Scadenza',
          'Assicurazione',
          'Consenso Foto',
          'Allergie',
          'Note / Condizioni',
          'Email Conferma Inviata',
        ],
        ...appState.members.map((m) => [
          m.childName,
          m.birthDate,
          m.birthPlace,
          m.group,
          m.childFiscalCode,
          m.childAddress,
          m.parentName,
          m.parentFiscalCode,
          m.parentPhone,
          m.parentEmail,
          m.membershipCardNumber,
          m.isPaid ? 'SI' : 'NO',
          m.expiryDate,
          m.insuranceType,
          m.photoConsent ? 'SI' : 'NO',
          m.allergies,
          m.notesConditions,
          m.confirmationEmailSent !== false ? 'SI' : 'NO',
        ]),
      ];

      const cassaRows: (string | number | boolean)[][] = [
        ['Data', 'Categoria', 'Entrata (€)', 'Uscita (€)', 'Canale', 'Dettagli / Causale'],
        ...appState.transactions.map((t) => [
          t.date,
          t.category,
          t.income ?? '',
          t.expense ?? '',
          t.method,
          t.description,
        ]),
      ];

      const eventiRows: (string | number | boolean)[][] = [
        [
          'Evento',
          'Bimbo/a',
          'Genitore',
          'Email',
          'Confermato',
          'Caparra (€)',
          'Caparra Pagata',
          'Saldo (€)',
          'Saldo Pagato',
          'Canale',
          'Email Inviata',
        ],
        ...appState.bookings.map((b) => [
          b.eventName,
          b.childName,
          b.parentName,
          b.parentEmail || '',
          b.confirmed ? 'SI' : 'NO',
          b.depositAmount,
          b.isDepositPaid ? 'SI' : 'NO',
          b.balanceAmount,
          b.isBalancePaid ? 'SI' : 'NO',
          b.paymentMethod,
          b.confirmationEmailSent ? 'SI' : 'NO',
        ]),
      ];

      const gadgetRows: (string | number | boolean)[][] = [
        [
          'Data',
          'Bimbo/a',
          'Genitore',
          'Articolo',
          'Taglia / Variante',
          'Quantità',
          'Totale (€)',
          'Pagato',
          'Consegnato',
          'Email Inviata',
        ],
        ...appState.gadgetOrders.map((g) => [
          g.date,
          g.childName,
          g.parentName,
          g.gadgetName,
          g.variant,
          g.quantity,
          g.totalPrice,
          g.isPaid ? 'SI' : 'NO',
          g.isDelivered ? 'SI' : 'NO',
          g.confirmationEmailSent ? 'SI' : 'NO',
        ]),
      ];

      const safeSlug =
        (appState.profile.name || 'ASD')
          .trim()
          .replace(/[^a-zA-Z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'ASD';
      const res = await createAndPopulateSpreadsheet(
        `Gestionale_${safeSlug}_${appState.profile.activeYear}_${new Date()
          .toISOString()
          .slice(0, 10)}`,
        [
          { sheetTitle: 'Anagrafica_Soci', rows: sociRows },
          { sheetTitle: 'Flusso_Cassa', rows: cassaRows },
          { sheetTitle: 'Iscritti_Eventi', rows: eventiRows },
          { sheetTitle: 'Ordini_Gadget', rows: gadgetRows },
        ],
        'backup_sistema'
      );

      await loadUserSpreadsheets();
      setWorkspaceStatus({
        type: 'ok',
        text: 'Foglio Google Sheets creato nella cartella "Gestionale ASD / 07_Backup_Sistema"!',
        linkUrl: res.spreadsheetUrl,
        linkLabel: 'Apri Foglio Google Sheets',
      });
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'err',
        text: err?.message || 'Errore durante l\'esportazione su Google Sheets.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportFromGoogleSheet = async () => {
    const effectiveSheetId = extractGoogleSpreadsheetId(pastedSheetUrlOrId) || selectedSheetId;
    if (!effectiveSheetId) return;
    setIsSyncing(true);
    setWorkspaceStatus(null);
    try {
      const meta = await getSpreadsheetMetadata(effectiveSheetId);
      let targetTab = meta.sheets[0] || 'Sheet1';
      if (importTargetType === 'cassa' && meta.sheets.length > 1) {
        const cashTab = meta.sheets.find((s) => {
          const l = s.toLowerCase();
          return (
            !l.includes('riepilogo') &&
            (l.includes('libro_cassa') ||
              l.includes('libro cassa') ||
              l.includes('flusso') ||
              l.includes('cassa') ||
              l.includes('movimenti'))
          );
        });
        if (cashTab) targetTab = cashTab;
      } else if (importTargetType === 'soci' && meta.sheets.length > 1) {
        const sociTab = meta.sheets.find((s) => {
          const l = s.toLowerCase();
          return l.includes('soci') || l.includes('anagrafica') || l.includes('tesser');
        });
        if (sociTab) targetTab = sociTab;
      }

      const rows = await readSpreadsheetSheet(effectiveSheetId, targetTab);

      if (importTargetType === 'soci') {
        const parsed = parseMembersFromRows(rows);
        onImportMembers(parsed, 'append');
        setWorkspaceStatus({
          type: 'ok',
          text: `Importati ${parsed.length} soci dal foglio Google "${meta.title}" (${targetTab})!`,
          linkUrl: meta.spreadsheetUrl,
          linkLabel: 'Vedi Foglio Sorgente',
        });
      } else {
        const parsed = parseTransactionsFromRows(rows, appState.profile.activeYear);
        onImportTransactions(parsed, 'append');
        setWorkspaceStatus({
          type: 'ok',
          text: `Importati ${parsed.length} movimenti di cassa dal foglio Google "${meta.title}" (${targetTab})!`,
          linkUrl: meta.spreadsheetUrl,
          linkLabel: 'Vedi Foglio Sorgente',
        });
      }
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'err',
        text: err?.message || 'Errore nell\'importazione da Google Sheets.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveBackupToGoogleDrive = async () => {
    if (!googleUserEmail) return;
    const confirmed = confirm(
      'Confermi il salvataggio del file di backup JSON completo nella cartella Google Drive "Gestionale ASD / 07_Backup_Sistema"?'
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setWorkspaceStatus(null);
    try {
      const jsonStr = exportBackupJSON(appState);
      const safeSlug =
        (appState.profile.name || 'ASD')
          .trim()
          .replace(/[^a-zA-Z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '') || 'ASD';
      const fileName = `Backup_${safeSlug}_${appState.profile.activeYear}_${todayIso()}.json`;
      const uploaded = await uploadFileToDrive({
        name: fileName,
        content: jsonStr,
        mimeType: 'application/json',
        category: 'backup_sistema',
      });
      setWorkspaceStatus({
        type: 'ok',
        text: `Backup "${uploaded.name}" salvato in "Gestionale ASD / 07_Backup_Sistema"!`,
        linkUrl: uploaded.webViewLink,
        linkLabel: 'Apri su Google Drive',
      });
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'err',
        text: err?.message || 'Errore nel salvataggio del backup su Google Drive.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateMembershipGoogleForm = async (customParams?: {
    title: string;
    description: string;
    fields: GoogleFormFieldConfig[];
  }) => {
    if (!googleUserEmail) return;
    const ok = confirm(
      `Vuoi creare automaticamente il Modulo Google personalizzato nella cartella "Gestionale ASD / 01_Anagrafica_Soci_e_Tessere" per il Tesseramento Soci ${appState.profile.activeYear}?`
    );
    if (!ok) return;

    setIsSyncing(true);
    setWorkspaceStatus(null);
    try {
      const form = await createGoogleFormForActivity({
        title:
          customParams?.title ||
          `Modulo Tesseramento Annuale ${appState.profile.activeYear} - ${appState.profile.name}`,
        description:
          customParams?.description ||
          `Richiesta di iscrizione e tesseramento US ACLI ${appState.profile.activeYear} per le attività di ${appState.profile.name}.`,
        formType: 'tesseramento',
        customFields: customParams?.fields,
      });
      setIsFormBuilderOpen(false);
      setWorkspaceStatus({
        type: 'ok',
        text: `Modulo Google personalizzato per il Tesseramento ${appState.profile.activeYear} creato e salvato in "Gestionale ASD / 01_Anagrafica_Soci_e_Tessere"!`,
        linkUrl: form.responderUri,
        linkLabel: 'Apri Modulo Google Tesseramento',
      });
    } catch (err: any) {
      setWorkspaceStatus({
        type: 'err',
        text: err?.message || 'Errore nella creazione del Google Form.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadBackup = () => {
    const jsonStr = exportBackupJSON(appState);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeSlug =
      (appState.profile.name || 'ASD')
        .trim()
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'ASD';
    a.download = `Backup_${safeSlug}_${appState.profile.activeYear}_${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseBackupJSON(content);
      if (parsed) {
        if (
          confirm(
            'Confermi il ripristino del backup? I dati correnti verranno sostituiti con quelli del file.'
          )
        ) {
          onRestoreState(parsed);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(profileForm);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const categoryDescriptions: { key: DriveCategoryKey; folder: string; desc: string }[] = [
    {
      key: 'anagrafica_soci',
      folder: DRIVE_CATEGORY_FOLDERS.anagrafica_soci.folderName,
      desc: 'Foglio Google Anagrafica Soci, Modulo Google Tesseramento e rinnovi Tessera 365',
    },
    {
      key: 'contabilita_cassa',
      folder: DRIVE_CATEGORY_FOLDERS.contabilita_cassa.folderName,
      desc: 'Foglio Google Contabilità ufficiale, bilanci Excel e giustificativi/fatture',
    },
    {
      key: 'eventi_iscritti',
      folder: DRIVE_CATEGORY_FOLDERS.eventi_iscritti.folderName,
      desc: 'Fogli Google iscritti per ogni evento, briefing pre-evento e Moduli Google iscrizione',
    },
    {
      key: 'verbali_governance',
      folder: DRIVE_CATEGORY_FOLDERS.verbali_governance.folderName,
      desc: 'Verbali Assemblea Soci approvazione rendiconto, nomine Safeguarding e RSPP',
    },
    {
      key: 'bandi_progetti',
      folder: DRIVE_CATEGORY_FOLDERS.bandi_progetti.folderName,
      desc: 'Documentazione bandi, avvisi pubblici, allegati progettuali e rendicontazione',
    },
    {
      key: 'archivio_annualita',
      folder: DRIVE_CATEGORY_FOLDERS.archivio_annualita.folderName,
      desc: 'Archivi storici completi di fine anno sportivo (JSON ed Excel multi-scheda)',
    },
    {
      key: 'backup_sistema',
      folder: DRIVE_CATEGORY_FOLDERS.backup_sistema.folderName,
      desc: 'Backup integrali di sicurezza del gestionale ASD',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* SECTION 0A: FILE LOCALE SU PC (COMPATIBILE CON ONEDRIVE / DROPBOX / DISCO FISSO — ZERO MEMORIA BROWSER) */}
      <div className="bg-white p-6 rounded-xl border-2 border-emerald-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base">
                  Salvataggio su File Locale PC (OneDrive / Dropbox / Disco Fisso) & Copia di Sicurezza Locale
                </h3>
                {localFileName ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    File attivo: {localFileName}
                    {lastLocalSavedAt ? ` (Salvato alle ${lastLocalSavedAt})` : ''}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    Nessun file locale collegato in questa sessione
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Puoi lavorare direttamente su un file <strong className="font-mono">.json</strong> sul tuo
                computer (anche dentro una cartella sincronizzata <strong>OneDrive, Dropbox o iCloud Drive</strong>)
                oppure usare <strong>Google Drive</strong> qui sotto. Per proteggerti da chiusure impreviste,
                l&apos;app mantiene una copia locale di sicurezza su questo computer (IndexedDB) che puoi
                cancellare in un clic quando ti disconnetti scegliendo{' '}
                <strong>&ldquo;Esci e cancella i dati da questo computer&rdquo;</strong>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onConnectLocalFile && (
              <button
                id="btn-backup-connect-local-file"
                type="button"
                onClick={onConnectLocalFile}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5 text-emerald-700" />
                <span>Apri / Collega File .JSON da PC</span>
              </button>
            )}
            {onSaveLocalFile && (
              <button
                id="btn-backup-save-local-file"
                type="button"
                onClick={onSaveLocalFile}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salva Subito su File .JSON PC</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 0: GOOGLE DRIVE FOLDER STRUCTURE "Gestionale ASD" */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <FolderTree className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base">
                  Archivio Cloud Google Drive — Cartella "{DRIVE_ROOT_FOLDER_NAME}" Ripartita per Categoria
                </h3>
                {googleUserEmail && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Connesso: {googleUserEmail}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                 Tutte le funzioni del gestionale (Soci, Contabilità, Eventi, Verbali, Bandi e
                Archivio Annualità) salvano automaticamente i documenti nella cartella{' '}
                <strong className="font-mono text-slate-800">"{DRIVE_ROOT_FOLDER_NAME}"</strong>{' '}
                suddivisa in 7 sottocartelle ordinate.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!googleUserEmail ? (
              <GoogleSignInButton onClick={onGoogleSignIn} label="Connetti Google Drive" />
            ) : (
              <>
                <button
                  onClick={handleInitGestionaleDriveFolders}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FolderTree className="w-3.5 h-3.5" />
                  )}
                  <span>Sincronizza Cartella "Gestionale ASD"</span>
                </button>
                {appState.profile.driveRootFolderUrl && (
                  <a
                    href={appState.profile.driveRootFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Apri "Gestionale ASD"</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={onGoogleLogout}
                  className="p-2 text-xs font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
                  title="Disconnetti Account Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {workspaceStatus && (
          <div
            className={`p-4 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
              workspaceStatus.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <span className="font-medium">{workspaceStatus.text}</span>
            <div className="flex items-center gap-3">
              {workspaceStatus.linkUrl && (
                <a
                  href={workspaceStatus.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold underline"
                >
                  <span>{workspaceStatus.linkLabel || 'Apri in Google Drive'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={() => setWorkspaceStatus(null)}
                className="font-bold text-slate-500 hover:text-slate-800"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 7 Categorized Subfolders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {categoryDescriptions.map((cat) => {
            const linkedFolder = driveStructureLinks?.[cat.key];
            return (
              <div
                key={cat.key}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="font-mono font-bold text-slate-800 text-[11px] flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      {DRIVE_ROOT_FOLDER_NAME} / {cat.folder}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{cat.desc}</p>
                </div>
                {linkedFolder?.webViewLink && (
                  <a
                    href={linkedFolder.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline pt-1"
                  >
                    <span>Apri sottocartella su Drive</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>

        {/* VERSIONED AUTOMATIC BACKUPS ON GOOGLE DRIVE (Phase 1.6) */}
        {googleUserEmail && (
          <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-emerald-600" />
                  <span>
                    Punti di Ripristino e Backup Automatici su Google Drive (v
                    {appState.version || 1})
                  </span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Il gestionale salva automaticamente copie datate in{' '}
                  <code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                    07_Backup_Sistema / Backup_Automatici
                  </code>{' '}
                  una volta al giorno (ultimi 30 conservati) e prima di ogni importazione,
                  eliminazione multipla o chiusura annuale.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={refreshDriveBackupsList}
                  disabled={isLoadingDriveBackups}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isLoadingDriveBackups ? 'animate-spin' : ''}`}
                  />
                  <span>Aggiorna Elenco</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateManualDriveSnapshot}
                  disabled={isLoadingDriveBackups}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Crea Punto di Ripristino Ora</span>
                </button>
              </div>
            </div>

            {driveBackups.length === 0 ? (
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                {isLoadingDriveBackups
                  ? 'Ricerca punti di ripristino su Google Drive in corso...'
                  : 'Nessun punto di ripristino automatico ancora presente. Clicca su "Crea Punto di Ripristino Ora" oppure esegui una modifica per generare il primo snapshot.'}
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white">
                {driveBackups.slice(0, 20).map((b) => {
                  const reasonLabels: Record<string, { label: string; color: string }> = {
                    daily: {
                      label: 'Giornaliero',
                      color: 'bg-sky-50 text-sky-700 border-sky-200',
                    },
                    'pre-import': {
                      label: 'Pre-Importazione',
                      color: 'bg-amber-50 text-amber-800 border-amber-200',
                    },
                    'pre-bulk-delete': {
                      label: 'Pre-Eliminazione',
                      color: 'bg-rose-50 text-rose-700 border-rose-200',
                    },
                    'pre-archive': {
                      label: 'Pre-Chiusura Anno',
                      color: 'bg-purple-50 text-purple-700 border-purple-200',
                    },
                    'pre-overwrite': {
                      label: 'Pre-Ripristino / Conflitto',
                      color: 'bg-orange-50 text-orange-800 border-orange-200',
                    },
                    manual: {
                      label: 'Punto Manuale',
                      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    },
                  };
                  const badge =
                    reasonLabels[b.reason || 'manual'] || reasonLabels.manual;
                  return (
                    <div
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        <span className="font-mono font-semibold text-slate-800 truncate">
                          {b.name}
                        </span>
                        {b.version && (
                          <span className="text-[11px] font-mono text-slate-500">
                            (v{b.version})
                          </span>
                        )}
                        {b.modifiedTime && (
                          <span className="text-[11px] text-slate-400">
                            {new Date(b.modifiedTime).toLocaleString('it-IT')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDownloadDriveSnapshot(b)}
                          disabled={isLoadingDriveBackups}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px]"
                        >
                          <Download className="w-3 h-3" />
                          <span>Scarica</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestoreDriveSnapshot(b)}
                          disabled={isLoadingDriveBackups}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-[11px]"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Ripristina</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 1: CHIUSURA E ARCHIVIAZIONE ANNO SPORTIVO & PASSAGGIO ALL'ANNO NUOVO (2026 E ANNI FUTURI) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Archive className="w-5 h-5 text-emerald-600" />
              Gestione Multi-Anno (2026 e Anni Futuri), Archiviazione Flussi Cassa & Scadenza Tesserini Soci
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Puoi utilizzare l'app per il <strong>2026</strong>, <strong>2027</strong> e tutti gli anni a venire.
              Quando archivi un'annualità (<strong>{appState.profile.activeYear}</strong>), i flussi di cassa vengono
              archiviati mantenendo <strong>solo il residuo a bilancio</strong> (C/C + Contanti) come Fondo Iniziale,
              mentre <strong>tutti i soci restano in Anagrafica</strong> e scade semplicemente il tesserino per quelli
              con scadenza a fine anno.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200">
            <div className="text-xs">
              <span className="text-slate-600 font-medium">Nuovo Anno:</span>
              <input
                id="input-archive-target-year"
                type="number"
                value={targetNewYear}
                onChange={(e) => setTargetNewYear(Number(e.target.value))}
                className="ml-1.5 w-20 px-2 py-1 rounded-md border border-emerald-300 bg-white font-mono font-bold text-slate-900 text-xs"
              />
            </div>
            <button
              id="btn-archive-fiscal-year"
              onClick={handleArchiveAndTransitionYear}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>
                Archivia Flussi {appState.profile.activeYear} e Passa al {targetNewYear}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Direct Year Selector (2026, 2027, 2028, 2029) without archiving if user just wants to set active year */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
            <div>
              <span className="font-bold text-slate-900">
                Selettore Rapido Anno Sportivo Attivo (2026 e Anni Futuri):
              </span>{' '}
              <span className="text-slate-500">
                Imposta subito l'anno di lavoro corrente senza archiviare i movimenti attuali.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {[2026, 2027, 2028, 2029].map((yr) => (
              <button
                key={yr}
                id={`btn-quick-year-${yr}`}
                type="button"
                onClick={() => {
                  const updated = { ...appState.profile, activeYear: yr };
                  setProfileForm(updated);
                  onUpdateProfile(updated);
                  setWorkspaceStatus({
                    type: 'ok',
                    text: `Anno Sportivo attivo impostato su ${yr}! Tutte le scadenze, le tessere e i report ora fanno riferimento al ${yr}.`,
                  });
                }}
                className={`px-3 py-1.5 rounded-lg font-mono font-bold text-xs border transition-all ${
                  appState.profile.activeYear === yr
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                }`}
              >
                Anno {yr}
              </button>
            ))}
          </div>
        </div>

        {/* Current Year Summary before archiving (Cash Carryover + Member Retention & Card Expiry) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[11px] text-slate-500">Anno Attivo Corrente</div>
            <div className="text-lg font-extrabold font-mono text-slate-900 mt-0.5">
              {appState.profile.activeYear}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {appState.transactions.length} movimenti registrati
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
            <div className="text-[11px] text-emerald-800 font-semibold">
              Residuo a Bilancio Mantenuto
            </div>
            <div className="text-lg font-extrabold font-mono text-emerald-700 mt-0.5">
              {formatEuro(currentTotals.currentTotal)}
            </div>
            <div className="text-[10px] text-emerald-700/80 font-mono mt-0.5">
              Banca {formatEuro(currentTotals.currentBank)} · Contanti{' '}
              {formatEuro(currentTotals.currentCash)}
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200">
            <div className="text-[11px] text-blue-900 font-semibold flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-blue-700" />
              <span>Soci Mantenuti & Scadenza Tessere</span>
            </div>
            <div className="text-sm font-extrabold font-mono text-slate-900 mt-0.5">
              {memberTransitionStats.totalMembersRetained} soci restano in Anagrafica
            </div>
            <div className="text-[10px] text-slate-600 mt-0.5">
              <strong className="text-amber-800">
                {memberTransitionStats.expiredCardsToRenewCount}
              </strong>{' '}
              tesserini scadono ·{' '}
              <strong className="text-purple-800">
                {memberTransitionStats.stillValidTessera365Count}
              </strong>{' '}
              Tessere 365 restano valide
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500">Bilancio Excel {appState.profile.activeYear}</div>
              <button
                onClick={() =>
                  exportAccountingToExcel({
                    transactions: appState.transactions,
                    initialFund: appState.initialFund,
                    initialFundBank: appState.initialFundBank,
                    initialFundCash: appState.initialFundCash,
                    fiscalYear: appState.profile.activeYear,
                    associationName: appState.profile.name,
                  })
                }
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Scarica Contabilità .xlsx</span>
              </button>
            </div>
          </div>
        </div>

        {/* List of Archived Fiscal Years */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Annualità Archiviate nello Storico ({appState.archivedYears.length})
            </h4>

            {/* Phase 5.2: Health Data Retention Policy in Historical Archives */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <span className="font-semibold text-slate-700">
                Conservazione dati sanitari negli archivi (Allergie/BES):
              </span>
              <select
                value={appState.profile.archiveHealthDataRetentionYears ?? 0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const updated = {
                    ...appState.profile,
                    archiveHealthDataRetentionYears: val > 0 ? val : undefined,
                  };
                  setProfileForm(updated);
                  onUpdateProfile(updated);
                }}
                className="px-2 py-1 rounded border border-slate-300 bg-white font-semibold text-slate-800 text-xs"
              >
                <option value={0}>Conserva fino ad anonimizzazione manuale</option>
                <option value={1}>Anonimizza archivi oltre 1 anno</option>
                <option value={2}>Anonimizza archivi oltre 2 anni</option>
                <option value={3}>Anonimizza archivi oltre 3 anni</option>
                <option value={5}>Anonimizza archivi oltre 5 anni</option>
              </select>
              {onAnonymizeArchivedHealthData && appState.archivedYears.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const minAge = appState.profile.archiveHealthDataRetentionYears ?? 0;
                    const count = onAnonymizeArchivedHealthData(minAge);
                    setWorkspaceStatus({
                      type: 'ok',
                      text:
                        count > 0
                          ? `Anonimizzati i campi allergie e note sanitarie/BES per ${count} schede negli archivi storici.`
                          : 'Nessun dato sanitario da anonimizzare negli archivi selezionati.',
                    });
                  }}
                  className="px-2.5 py-1 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-semibold text-[11px] transition-colors"
                >
                  Anonimizza dati sanitari negli archivi
                </button>
              )}
            </div>
          </div>

          {appState.archivedYears.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-400">
              Nessuna annualità ancora archiviata. Quando chiuderai l'esercizio{' '}
              {appState.profile.activeYear}, comparirà qui con il riepilogo contabile e l'export
              Excel dedicato.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {appState.archivedYears.map((arch) => (
                <div
                  key={arch.id}
                  className="p-4 bg-white hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono font-bold text-xs">
                        Anno {arch.year}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        Archiviato il {new Date(arch.archivedAt).toLocaleDateString('it-IT')}
                      </span>
                      {arch.driveFileId && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[10px]">
                          Su Google Drive
                        </span>
                      )}
                      {arch.isLightSummaryOnly && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px]">
                          Archivio Leggero (dettagli su Drive)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-1.5 font-mono text-[11px] text-slate-600">
                      <span>
                        Saldo Finale:{' '}
                        <strong className="text-emerald-700">
                          {formatEuro(arch.summary.finalTotalBalance)}
                        </strong>
                      </span>
                      <span>Entrate: +{formatEuro(arch.summary.totalIncome)}</span>
                      <span>Uscite: -{formatEuro(arch.summary.totalExpense)}</span>
                      <span>
                        {arch.isLightSummaryOnly
                          ? `${arch.summary.membersCount} soci · ${arch.summary.eventsCount} eventi (dettagli su Drive)`
                          : `${arch.transactions.length} movimenti · ${arch.membersSnapshot.length} soci · ${arch.events.length} eventi`}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleExportArchivedYearExcelWithOnDemandLoad(arch)}
                      disabled={isSyncing}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Esporta Excel ({arch.year})</span>
                    </button>
                    {googleUserEmail && !arch.isLightSummaryOnly && (
                      <button
                        onClick={() => handleSaveArchivedYearToDrive(arch)}
                        disabled={isSyncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                      >
                        <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                        <span>{arch.driveFileId ? 'Aggiorna su Drive' : 'Salva su Drive'}</span>
                      </button>
                    )}
                    {googleUserEmail && arch.driveFileId && onUpdateArchivedYear && (
                      <button
                        type="button"
                        onClick={() => handleToggleLightArchivedYear(arch)}
                        disabled={isSyncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                      >
                        <Database className="w-3.5 h-3.5" />
                        <span>
                          {arch.isLightSummaryOnly
                            ? 'Ricarica dettagli da Drive'
                            : 'Alleggerisci (dettagli su Drive)'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: AZIONI RAPIDE GOOGLE SHEETS & MODULI GOOGLE */}
      {googleUserEmail && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base">
            Strumenti Google Sheets & Moduli Google (Sincronizzati con "{DRIVE_ROOT_FOLDER_NAME}")
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Esporta Riepilogo Globale su Sheets
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Crea un foglio Google in "07_Backup_Sistema" con 4 schede: Soci, Cassa, Iscritti
                  Eventi e Ordini Gadget.
                </p>
              </div>
              <button
                onClick={handleExportAllToGoogleSheets}
                disabled={isSyncing}
                className="w-full py-2 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Crea Foglio Google Sheets</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                  Salva Backup JSON su Drive
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Salva l'intero database nella sottocartella "Gestionale ASD / 07_Backup_Sistema".
                </p>
              </div>
              <button
                onClick={handleSaveBackupToGoogleDrive}
                disabled={isSyncing}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Salva su Google Drive</span>
              </button>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600" />
                  Genera Modulo Google Soci
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Crea un Google Form in "01_Anagrafica_Soci_e_Tessere" per raccogliere i
                  tesseramenti.
                </p>
              </div>
              <button
                onClick={() => setIsFormBuilderOpen(true)}
                disabled={isSyncing}
                className="w-full py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Personalizza & Crea Form Soci</span>
              </button>
            </div>

            <div className="md:col-span-3 p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900">
                  Importa Dati da un Foglio Google Sheets nel tuo Drive
                </div>
                <p className="text-[11px] text-slate-500">
                  Seleziona un foglio creato dal gestionale (permesso <code className="font-mono">drive.file</code>) oppure incolla il link o l&apos;ID di qualsiasi Foglio Google del tuo account.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={importTargetType}
                  onChange={(e) => setImportTargetType(e.target.value as 'soci' | 'cassa')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium"
                >
                  <option value="soci">Importa come: Soci</option>
                  <option value="cassa">Importa come: Movimenti Cassa</option>
                </select>
                <select
                  value={selectedSheetId}
                  onChange={(e) => setSelectedSheetId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white max-w-xs"
                >
                  {driveSpreadsheets.length === 0 ? (
                    <option value="">Fogli creati dall&apos;app (nessuno)</option>
                  ) : (
                    driveSpreadsheets.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))
                  )}
                </select>
                <input
                  type="text"
                  value={pastedSheetUrlOrId}
                  onChange={(e) => setPastedSheetUrlOrId(e.target.value)}
                  placeholder="Oppure incolla link / ID Foglio Google..."
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white min-w-[220px]"
                />
                <button
                  onClick={handleImportFromGoogleSheet}
                  disabled={
                    (!selectedSheetId && !extractGoogleSpreadsheetId(pastedSheetUrlOrId)) ||
                    isSyncing
                  }
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
                >
                  Importa da Foglio
                </button>
                <button
                  onClick={loadUserSpreadsheets}
                  className="p-1.5 text-slate-500 hover:text-slate-800 border border-slate-200 bg-white rounded-lg"
                  title="Ricarica lista fogli da Drive"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DOWNLOADABLE EMPTY EXCEL TEMPLATES (.XLSX) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            Modelli Excel Vuoti Scaricabili (.xlsx) — Pronti da Compilare e Ricaricare
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Scarica i modelli vuoti con le intestazioni ufficiali per compilarli offline in Excel e
            ricaricarli nelle rispettive sezioni del gestionale.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              type: 'soci' as const,
              title: 'Modello Anagrafica Soci',
              desc: '18 colonne (Bimbo, Genitore, CF, Tessera, Assicurazione, Allergie, Foto)',
            },
            {
              type: 'cassa' as const,
              title: 'Modello Libro Cassa',
              desc: 'Data, Categoria, Entrata, Uscita, Canale di Pagamento e Causale',
            },
            {
              type: 'eventi' as const,
              title: 'Modello Iscritti Evento',
              desc: 'Partecipante, Genitore, Caparra, Saldo, Stato e Note evento',
            },
            {
              type: 'gadget' as const,
              title: 'Modello Ordini Gadget',
              desc: 'Prenotazione magliette, tazze, cappellini, taglie e stato pagamento',
            },
          ].map((tpl) => (
            <div
              key={tpl.type}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="font-bold text-slate-900 text-xs">{tpl.title}</div>
                <p className="text-[11px] text-slate-500 mt-1">{tpl.desc}</p>
              </div>
              <button
                onClick={() => downloadEmptyExcelTemplate(tpl.type, appState.profile.name)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Scarica .xlsx</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: LOCAL BACKUP & EXPORT */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            Backup Locale sul Computer (.JSON / .XLSX / .CSV)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Salva o ripristina una copia locale dell'intero gestionale sul tuo computer.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
              <Database className="w-4 h-4 text-emerald-600" />
              Scarica File Backup Completo (.JSON)
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Include soci ({appState.members.length}), movimenti cassa (
              {appState.transactions.length}), eventi, bandi ({appState.grants.length}), annualità
              archiviate ({appState.archivedYears.length}) e verbali.
            </p>
            <button
              onClick={handleDownloadBackup}
              className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica Backup Sul Computer</span>
            </button>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
              <Upload className="w-4 h-4 text-blue-600" />
              Ripristina da File Backup (.JSON)
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Carica un file .JSON salvato in precedenza per ripristinare tutti gli archivi.
            </p>
            <label className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Seleziona File JSON...</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 font-medium">
            Esportazione rapida contabilità in Excel (.xlsx) e tabelle CSV:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() =>
                exportAccountingToExcel({
                  transactions: appState.transactions,
                  initialFund: appState.initialFund,
                  initialFundBank: appState.initialFundBank,
                  initialFundCash: appState.initialFundCash,
                  fiscalYear: appState.profile.activeYear,
                  associationName: appState.profile.name,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Esporta Contabilità (.XLSX)</span>
            </button>
            <button
              onClick={() =>
                exportTransactionsToCSV(appState.transactions, appState.profile.name)
              }
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Flusso Cassa (.CSV)</span>
            </button>
            <button
              onClick={() => exportMembersToCSV(appState.members, appState.profile.name)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Anagrafica Soci (.CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 5: ASSOCIATION PROFILE SETTINGS (MULTI-ASD READY) */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Dati Istituzionali della tua ASD (Anno Sportivo {profileForm.activeYear}) — Multi-ASD
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Qualsiasi ASD che accede con il proprio account Google può personalizzare qui i propri
              dati (Denominazione, CF, Ente di Affiliazione, IBAN, Tessere, Categorie e Soci Adulti):
              il gestionale, le ricevute PDF e il salvataggio in diretta sul proprio Google Drive si
              adattano automaticamente.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenOnboardingWizard && (
              <button
                type="button"
                onClick={onOpenOnboardingWizard}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                <span>Configurazione Guidata (Tessere, Categorie, Ente, Soci Adulti)</span>
              </button>
            )}
            {profileSaved && (
              <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Salvato!
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Denominazione ASD *</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Codice Fiscale ASD *</label>
              <input
                type="text"
                required
                value={profileForm.fiscalCode}
                onChange={(e) => setProfileForm({ ...profileForm, fiscalCode: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Anno Sportivo Attivo</label>
              <input
                type="number"
                value={profileForm.activeYear}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, activeYear: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Ente di Affiliazione (EPS / FSN)
              </label>
              <input
                type="text"
                placeholder="Es. Affiliata US ACLI, UISP, CSI, AICS..."
                value={profileForm.affiliation}
                onChange={(e) => setProfileForm({ ...profileForm, affiliation: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Sede Legale / Indirizzo
              </label>
              <input
                type="text"
                value={profileForm.address}
                onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Presidente / Rappresentante Legale
              </label>
              <input
                type="text"
                value={profileForm.president}
                onChange={(e) => setProfileForm({ ...profileForm, president: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">
                IBAN per Bonifici Quota
              </label>
              <input
                type="text"
                value={profileForm.iban}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, iban: e.target.value.toUpperCase() })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Email Istituzionale</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Telefono Segreteria</label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(profileForm.hasAdultMembers)}
                onChange={(e) =>
                  setProfileForm({ ...profileForm, hasAdultMembers: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-300 text-emerald-600"
              />
              <div>
                <div className="font-bold text-slate-900">
                  Gestione Soci Adulti (oltre ai minori)
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Attiva l&apos;opzione &ldquo;Socio Adulto (Maggiorenne)&rdquo; nell&apos;Anagrafica
                  Soci (campi genitore facoltativi ed etichetta &ldquo;Socio / Partecipante&rdquo;).
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(profileForm.showApuacampAttributionInDocs)}
                onChange={(e) =>
                  setProfileForm({
                    ...profileForm,
                    showApuacampAttributionInDocs: e.target.checked,
                  })
                }
                className="mt-0.5 rounded border-slate-300 text-emerald-600"
              />
              <div>
                <div className="font-bold text-slate-900">
                  Includi dicitura &ldquo;Piattaforma Gestionale ideata da ASD Apuacamp&rdquo; nei
                  PDF/Tessere
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Se disattivato, le ricevute e le tessere generate riportano esclusivamente la
                  denominazione della tua associazione.
                </p>
              </div>
            </label>
          </div>

          {/* Stamp & Signature Upload + Custom Form & Receipt Templates */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                Timbro Ufficiale ASD, Firma Presidente & Personalizzazione Moduli Google / Ricevute
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Carica il timbro dell'associazione e la firma del legale rappresentante per
                applicarli automaticamente sulle ricevute e quietanze generate dal gestionale.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Timbro ASD */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Stamp className="w-4 h-4 text-emerald-700" />
                    <span>Timbro dell'ASD (PNG / JPG)</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Viene applicato in automatico sulle ricevute PDF e sulle quietanze compensi.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {profileForm.stampImageDataUrl ? 'Sostituisci Timbro' : 'Carica Timbro ASD'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const dataUrl = await compressImageFileToDataUrl(file, 360, 220);
                          const updated = { ...profileForm, stampImageDataUrl: dataUrl };
                          setProfileForm(updated);
                          onUpdateProfile(updated);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                    {profileForm.stampImageDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...profileForm, stampImageDataUrl: undefined };
                          setProfileForm(updated);
                          onUpdateProfile(updated);
                        }}
                        className="text-rose-600 hover:underline text-[11px] font-medium"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>
                {profileForm.stampImageDataUrl && (
                  <img
                    src={profileForm.stampImageDataUrl}
                    alt="Timbro ASD"
                    className="h-16 w-auto object-contain bg-white border border-slate-200 rounded-lg p-1"
                  />
                )}
              </div>

              {/* Firma Presidente */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-blue-700" />
                    <span>Firma del Presidente / Legale Rappr.</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Firma autografa scansionata per sottoscrivere automaticamente le ricevute.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {profileForm.signatureImageDataUrl
                          ? 'Sostituisci Firma'
                          : 'Carica Firma Presidente'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const dataUrl = await compressImageFileToDataUrl(file, 360, 180);
                          const updated = { ...profileForm, signatureImageDataUrl: dataUrl };
                          setProfileForm(updated);
                          onUpdateProfile(updated);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                    {profileForm.signatureImageDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...profileForm, signatureImageDataUrl: undefined };
                          setProfileForm(updated);
                          onUpdateProfile(updated);
                        }}
                        className="text-rose-600 hover:underline text-[11px] font-medium"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>
                {profileForm.signatureImageDataUrl && (
                  <img
                    src={profileForm.signatureImageDataUrl}
                    alt="Firma Presidente ASD"
                    className="h-14 w-auto object-contain bg-white border border-slate-200 rounded-lg p-1"
                  />
                )}
              </div>
            </div>

            {/* Quick Triggers for Custom Google Form Fields & Custom Receipt Template */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-purple-50/50 border border-purple-200">
              <div className="space-y-0.5">
                <div className="font-bold text-slate-900">
                  Personalizzazione Campi Standard Moduli Google & Modello Ricevute
                </div>
                <p className="text-[11px] text-slate-600">
                  Configura le domande standard per bisogni speciali approfonditi nei Google Form e
                  scegli i campi e i testi fiscali predefiniti per le ricevute PDF.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {onOpenDigitalCardDesigner && (
                  <button
                    type="button"
                    onClick={onOpenDigitalCardDesigner}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors shadow-2xs"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Personalizza Tessera Digitale & Nomi Assicurazioni</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFormBuilderOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-purple-900 bg-white hover:bg-purple-100 border border-purple-300 rounded-lg transition-colors shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-700" />
                  <span>Configura Campi Standard Moduli Google</span>
                </button>
                {onOpenReceiptCustomizer && (
                  <button
                    type="button"
                    onClick={onOpenReceiptCustomizer}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                  >
                    <Sliders className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Personalizza Campi e Testi Ricevute</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salva Dati della Tua ASD</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 6: RESET TO EMPTY */}
      <div className="bg-rose-50/50 p-6 rounded-xl border border-rose-200 shadow-2xs space-y-3">
        <div>
          <h4 className="font-bold text-rose-950 text-sm">
            Reset Gestionale Vuoto per l'Anno Sportivo {appState.profile.activeYear}
          </h4>
          <p className="text-xs text-rose-700 mt-0.5">
            Azzera i flussi di cassa, le prenotazioni e l'anagrafica soci per ripartire con il
            gestionale pulito.
          </p>
        </div>
        <button
          onClick={() => {
            if (
              confirm(
                'Confermi il reset del gestionale allo stato vuoto (flussi di cassa e soci azzerati)?'
              )
            ) {
              onResetToDefaults();
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-100 border border-rose-300 rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Azzera e Ripristina Gestionale Vuoto</span>
        </button>
      </div>

      {/* Custom Google Form Field Builder Modal */}
      <GoogleFormBuilderModal
        isOpen={isFormBuilderOpen}
        onClose={() => setIsFormBuilderOpen(false)}
        initialFormType="tesseramento"
        initialTitle={`Modulo Tesseramento Annuale ${appState.profile.activeYear} - ${appState.profile.name}`}
        initialDescription={`Richiesta di iscrizione e tesseramento ${appState.profile.activeYear} per le attività di ${appState.profile.name}.`}
        profile={appState.profile}
        googleUserEmail={googleUserEmail}
        onSaveStandardFieldsToProfile={(updatedFields) => {
          const updated = { ...appState.profile, formStandardFields: updatedFields };
          setProfileForm(updated);
          onUpdateProfile(updated);
        }}
        onConfirmGenerateForm={async (params) => {
          await handleCreateMembershipGoogleForm(params);
        }}
        isGenerating={isSyncing}
      />
    </div>
  );
};
