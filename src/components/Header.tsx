import React, { useState } from 'react';
import {
  Search,
  Plus,
  FileSpreadsheet,
  Bell,
  Wallet,
  UserPlus,
  CreditCard,
  CalendarPlus,
  ShoppingBag,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  HelpCircle,
  Menu,
  FolderOpen,
  Save,
  Calendar,
  Undo2,
  Redo2,
} from 'lucide-react';
import { NavTab } from './Sidebar';

export type DriveLiveSyncState = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

interface HeaderProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenNewTransaction: () => void;
  onOpenNewMember: () => void;
  onOpenNewCard?: () => void;
  onOpenNewBooking: () => void;
  onOpenNewGadgetOrder?: () => void;
  onExportExcel: () => void;
  notificationCount: number;
  googleUserEmail?: string | null;
  associationName?: string;
  activeYear?: number;
  onChangeActiveYear?: (year: number) => void;
  driveSyncState?: DriveLiveSyncState;
  lastDriveSavedAt?: string | null;
  onReloadFromDrive?: () => void;
  localFileName?: string | null;
  lastLocalSavedAt?: string | null;
  onConnectLocalFile?: () => void;
  onSaveLocalFile?: () => void;
  isPageGuideExpanded?: boolean;
  onTogglePageGuide?: () => void;
  onOpenFullManual?: () => void;
  onOpenMobileMenu?: () => void;
  canUndo?: boolean;
  lastUndoLabel?: string | null;
  onUndo?: () => void;
  canRedo?: boolean;
  onRedo?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onOpenNewTransaction,
  onOpenNewMember,
  onOpenNewCard,
  onOpenNewBooking,
  onOpenNewGadgetOrder,
  onExportExcel,
  notificationCount,
  googleUserEmail,
  associationName = 'Associazione',
  activeYear = 2027,
  onChangeActiveYear,
  driveSyncState = 'idle',
  lastDriveSavedAt,
  onReloadFromDrive,
  localFileName,
  lastLocalSavedAt,
  onConnectLocalFile,
  onSaveLocalFile,
  isPageGuideExpanded = false,
  onTogglePageGuide,
  onOpenFullManual,
  onOpenMobileMenu,
  canUndo = false,
  lastUndoLabel = null,
  onUndo,
  canRedo = false,
  onRedo,
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isYearMenuOpen, setIsYearMenuOpen] = useState(false);

  const tabLabels: Record<NavTab, { title: string }> = {
    dashboard: { title: 'Dashboard' },
    cashflow: { title: 'Flusso di Cassa' },
    members: { title: 'Anagrafica Soci' },
    cards: { title: 'Tessere & Coperture' },
    events: { title: 'Eventi & Campi Estivi' },
    gadgets: { title: 'Gadget & Prenotazioni' },
    staff: { title: 'Staff & Compensi' },
    grants: { title: 'Bandi & Progetti' },
    governance: { title: 'Governance & Verbali' },
    receipts_config: { title: 'Modelli Ricevute & Mail' },
    notifications: { title: 'Scadenze & Notifiche' },
    backup: { title: 'Archivio & Impostazioni ASD' },
  };

  const currentTab = tabLabels[activeTab] || tabLabels.dashboard;

  return (
    <header className="no-print bg-white border-b border-slate-200 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-20">
      {/* Zone 1: Hamburger Menu (Mobile/Tablet) + Clean Page Title + Clickable Year */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onOpenMobileMenu && (
          <button
            id="btn-header-mobile-menu"
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 border border-slate-200 shrink-0"
            title="Apri menu di navigazione laterale"
            aria-label="Apri menu di navigazione"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
            {currentTab.title}
          </h2>

          {/* Discreet Clickable Year Badge */}
          <div className="relative inline-block shrink-0">
            <button
              id="btn-header-year-picker"
              type="button"
              onClick={() => setIsYearMenuOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 font-mono font-bold text-[11px] whitespace-nowrap transition-colors"
              title="Clicca sull'anno per cambiare l'anno sportivo attivo o consultare l'archivio degli anni passati"
            >
              <Calendar className="w-3 h-3 text-emerald-700 shrink-0" />
              <span>{activeYear} ▾</span>
            </button>

            {isYearMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsYearMenuOpen(false)}
                />
                <div className="absolute left-0 mt-1.5 w-60 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-40 space-y-2.5 text-xs">
                  <div className="font-bold text-slate-800 text-[11px]">
                    Anno Sportivo Attivo ({associationName})
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[2026, 2027, 2028, 2029].map((yr) => (
                      <button
                        key={yr}
                        id={`btn-header-select-year-${yr}`}
                        type="button"
                        onClick={() => {
                          if (onChangeActiveYear) onChangeActiveYear(yr);
                          setIsYearMenuOpen(false);
                        }}
                        className={`py-1.5 rounded-lg font-mono font-bold text-xs border transition-colors ${
                          activeYear === yr
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Archivio & Chiusura</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsYearMenuOpen(false);
                        setActiveTab('backup');
                      }}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Archivio Anni Passati →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Zone 2: Global Search */}
      <div className="flex-1 max-w-sm hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cerca socio, tessera, transazione o evento..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 hover:bg-slate-150 focus:bg-white text-xs pl-9 pr-4 py-2 rounded-lg border border-transparent focus:border-emerald-500 focus:outline-hidden transition-all text-slate-800 placeholder-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 px-1"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Zone 3: Storage Status (Google Drive OR Local PC File) & Compact On-Demand Guide / Utilities */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Google Drive Live Badge */}
        {googleUserEmail ? (
          <div className="hidden xl:flex items-center">
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-l-lg border transition-colors ${
                driveSyncState === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
              title="Salvataggio automatico in diretta su Google Drive (Gestionale ASD / 07_Backup_Sistema / database_gestionale_asd.json)"
            >
              {driveSyncState === 'saving' || driveSyncState === 'loading' ? (
                <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
              ) : driveSyncState === 'error' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>
                {driveSyncState === 'loading'
                  ? 'Lettura Drive...'
                  : driveSyncState === 'saving'
                  ? 'Salvataggio Drive...'
                  : driveSyncState === 'error'
                  ? 'Errore Sync Drive'
                  : lastDriveSavedAt
                  ? `Drive Live (${lastDriveSavedAt})`
                  : 'Drive Live'}
              </span>
            </button>
            {onReloadFromDrive && (
              <button
                onClick={onReloadFromDrive}
                className="p-1.5 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-l-0 border-emerald-200 rounded-r-lg transition-colors"
                title="Ricarica l'ultima versione dal Google Drive condiviso dell'ASD"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${driveSyncState === 'loading' ? 'animate-spin' : ''}`}
                />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setActiveTab('backup')}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border bg-white text-slate-600 hover:bg-slate-50 border-slate-200 transition-colors"
            title="Connetti Google Drive per attivare il salvataggio automatico in diretta"
          >
            <HardDrive className="w-3.5 h-3.5 text-emerald-600" />
            <span>Drive Live</span>
          </button>
        )}

        {/* Local File on PC (OneDrive / Dropbox / Hard Disk) Quick Controls */}
        {onConnectLocalFile && (
          <div className="hidden sm:flex items-center">
            <button
              id="btn-header-connect-local-file"
              type="button"
              onClick={onConnectLocalFile}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-l-lg border transition-colors ${
                localFileName
                  ? 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title={
                localFileName
                  ? `File Locale PC collegato: ${localFileName}${
                      lastLocalSavedAt ? ` (Salvato alle ${lastLocalSavedAt})` : ''
                    } — Clicca per aprire un altro file .JSON dal tuo PC / OneDrive / Dropbox`
                  : 'Apri o Collega un File Database .JSON sul tuo PC (compatibile con cartelle OneDrive / Dropbox)'
              }
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate max-w-[115px]">
                {localFileName ? localFileName : 'File PC'}
              </span>
            </button>
            {onSaveLocalFile && (
              <button
                id="btn-header-save-local-file"
                type="button"
                onClick={onSaveLocalFile}
                className="p-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-l-0 border-blue-200 rounded-r-lg transition-colors"
                title="Salva subito i dati nel File Locale su PC (.json) / Cartella OneDrive o Dropbox"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Soluzione 2: On-Demand Contextual Guide (? Guida) & Manual Buttons in Header */}
        {onTogglePageGuide && (
          <div className="flex items-center">
            <button
              id="btn-header-toggle-guide"
              type="button"
              onClick={onTogglePageGuide}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border transition-colors shadow-2xs ${
                onOpenFullManual ? 'rounded-l-lg' : 'rounded-lg'
              } ${
                isPageGuideExpanded
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
              }`}
              title="Mostra o nascondi la Guida Contestuale di questa pagina"
              aria-label="Guida Pagina"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Guida</span>
            </button>
            {onOpenFullManual && (
              <button
                id="btn-header-open-manual"
                type="button"
                onClick={onOpenFullManual}
                className="p-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-l-0 border-emerald-200 rounded-r-lg transition-colors"
                title="Apri il Manuale Operativo Completo (12 Pagine)"
                aria-label="Manuale Completo"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Global Undo / Redo Buttons */}
        {onUndo && (
          <div className="flex items-center">
            <button
              id="btn-header-undo"
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border transition-colors shadow-2xs ${
                onRedo ? 'rounded-l-lg' : 'rounded-lg'
              } ${
                canUndo
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
              title={
                canUndo && lastUndoLabel
                  ? `Annulla ultima operazione: ${lastUndoLabel} (Ctrl+Z)`
                  : 'Nessuna operazione recente da annullare'
              }
              aria-label="Annulla operazione"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Annulla</span>
            </button>
            {onRedo && (
              <button
                id="btn-header-redo"
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className={`p-1.5 text-xs font-semibold border border-l-0 rounded-r-lg transition-colors ${
                  canRedo
                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                    : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
                title="Ripeti operazione annullata (Ctrl+Y)"
                aria-label="Ripeti operazione"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        <button
          id="btn-header-export-excel"
          onClick={onExportExcel}
          className="p-2 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs"
          title="Esporta Contabilità Completa in Excel (.xlsx a 3 schede)"
          aria-label="Esporta Contabilità Excel"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        </button>

        <button
          id="btn-header-notifications"
          onClick={() => setActiveTab('notifications')}
          className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          title="Centro Notifiche, Scadenze e Alert Pre-Evento"
          aria-label="Notifiche e Scadenze"
        >
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
          )}
        </button>

        {/* Primary Action: Multi-action Add Dropdown */}
        <div className="relative">
          <button
            id="btn-header-new-menu"
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-all shadow-xs whitespace-nowrap"
            title="Registra rapidamente un nuovo movimento, socio, tessera o iscrizione evento"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuovo</span>
          </button>

          {isAddMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsAddMenuOpen(false)} />
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-40">
                <button
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    onOpenNewTransaction();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors text-left"
                >
                  <Wallet className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-medium">Nuovo Movimento Cassa</div>
                    <div className="text-[10px] text-slate-400">
                      Entrata/uscita con scelta data reale
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    onOpenNewMember();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors text-left border-t border-slate-100"
                >
                  <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-medium">Nuovo Socio in Anagrafica</div>
                    <div className="text-[10px] text-slate-400">
                      Dati bimbo, genitore, allergie e foto
                    </div>
                  </div>
                </button>

                {onOpenNewCard && (
                  <button
                    onClick={() => {
                      setIsAddMenuOpen(false);
                      onOpenNewCard();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors text-left border-t border-slate-100"
                  >
                    <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-medium">Gestione Tessere & Rinnovi</div>
                      <div className="text-[10px] text-slate-400">
                        Sezione dedicata Tessere & Tessera 365
                      </div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    onOpenNewBooking();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors text-left border-t border-slate-100"
                >
                  <CalendarPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-medium">Nuova Iscrizione Evento</div>
                    <div className="text-[10px] text-slate-400">
                      Rifugio, campo estivo o Selva
                    </div>
                  </div>
                </button>

                {onOpenNewGadgetOrder && (
                  <button
                    onClick={() => {
                      setIsAddMenuOpen(false);
                      onOpenNewGadgetOrder();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors text-left border-t border-slate-100"
                  >
                    <ShoppingBag className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-medium">Nuova Prenotazione Gadget</div>
                      <div className="text-[10px] text-slate-400">
                        Maglietta, tazza, cappellino
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
