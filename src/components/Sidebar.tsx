import React, { useState } from 'react';
import {
  LayoutDashboard,
  Wallet,
  Users,
  CreditCard,
  Compass,
  ShoppingBag,
  UserCheck,
  Scale,
  Bell,
  Database,
  ArrowUpRight,
  ShieldCheck,
  Award,
  Sliders,
  Edit3,
  Check,
  Sparkles,
  X,
  HardDrive,
  Mail,
  RefreshCw,
  LogOut,
  LogIn,
} from 'lucide-react';
import { formatEuro } from '../utils/finance';
import { AssociationProfile } from '../types';

export type NavTab =
  | 'dashboard'
  | 'cashflow'
  | 'members'
  | 'cards'
  | 'events'
  | 'gadgets'
  | 'grants'
  | 'staff'
  | 'governance'
  | 'receipts_config'
  | 'notifications'
  | 'backup';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  notificationCount: number;
  currentBalance: number;
  totalMembersCount: number;
  activeCardsCount?: number;
  gadgetOrdersCount?: number;
  grantsCount?: number;
  activeYear?: number;
  associationName?: string;
  affiliation?: string;
  profile?: AssociationProfile;
  onUpdateProfile?: (profile: AssociationProfile) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  googleUserEmail?: string | null;
  onGoogleSignIn?: (forceConsent?: boolean) => void;
  onGoogleLogout?: () => void;
  driveSyncState?: 'idle' | 'loading' | 'saving' | 'saved' | 'error';
  lastDriveSavedAt?: string | null;
  onReloadFromDrive?: () => void;
  onOpenLegalPage?: (page: 'privacy' | 'termini') => void;
  onOpenOnboardingWizard?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  notificationCount,
  currentBalance,
  totalMembersCount,
  activeCardsCount,
  gadgetOrdersCount,
  grantsCount,
  activeYear = 2027,
  associationName = 'ASD Apuacamp',
  affiliation = 'Affiliata US ACLI',
  profile,
  onUpdateProfile,
  isMobileOpen = false,
  onCloseMobile,
  googleUserEmail,
  onGoogleSignIn,
  onGoogleLogout,
  driveSyncState = 'idle',
  lastDriveSavedAt,
  onReloadFromDrive,
  onOpenLegalPage,
  onOpenOnboardingWizard,
}) => {
  const [isEditingBrand, setIsEditingBrand] = useState(false);
  const [draftName, setDraftName] = useState(associationName);
  const [draftAffiliation, setDraftAffiliation] = useState(affiliation);
  const [draftYear, setDraftYear] = useState<number>(activeYear);

  const openBrandEditor = () => {
    setDraftName(profile?.name || associationName);
    setDraftAffiliation(profile?.affiliation || affiliation);
    setDraftYear(profile?.activeYear || activeYear);
    setIsEditingBrand(true);
  };

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (profile && onUpdateProfile) {
      onUpdateProfile({
        ...profile,
        name: draftName.trim() || 'ASD Apuacamp',
        affiliation: draftAffiliation.trim() || 'Affiliata US ACLI',
        activeYear: Number(draftYear) || 2026,
      });
    }
    setIsEditingBrand(false);
  };

  const navGroups: {
    groupTitle: string;
    items: {
      id: NavTab;
      label: string;
      icon: React.ReactNode;
      badge?: number | string;
    }[];
  }[] = [
    {
      groupTitle: 'Operatività Quotidiana',
      items: [
        {
          id: 'dashboard',
          label: 'Dashboard & Scadenze',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          id: 'members',
          label: 'Anagrafica Soci',
          icon: <Users className="w-4 h-4" />,
          badge: totalMembersCount,
        },
        {
          id: 'cards',
          label: 'Tessere & Coperture',
          icon: <CreditCard className="w-4 h-4" />,
          badge: activeCardsCount !== undefined ? activeCardsCount : totalMembersCount,
        },
        {
          id: 'events',
          label: 'Eventi & Briefing',
          icon: <Compass className="w-4 h-4" />,
        },
        {
          id: 'cashflow',
          label: 'Flusso di Cassa',
          icon: <Wallet className="w-4 h-4" />,
        },
      ],
    },
    {
      groupTitle: 'Attività & Progetti',
      items: [
        {
          id: 'gadgets',
          label: 'Gadget & Prenotazioni',
          icon: <ShoppingBag className="w-4 h-4" />,
          badge: gadgetOrdersCount && gadgetOrdersCount > 0 ? gadgetOrdersCount : undefined,
        },
        {
          id: 'grants',
          label: 'Bandi & Progetti',
          icon: <Award className="w-4 h-4" />,
          badge: grantsCount && grantsCount > 0 ? grantsCount : undefined,
        },
      ],
    },
    {
      groupTitle: 'Vita Associativa & Alert',
      items: [
        {
          id: 'staff',
          label: 'Staff & Compensi',
          icon: <UserCheck className="w-4 h-4" />,
        },
        {
          id: 'governance',
          label: 'Governance & Verbali',
          icon: <Scale className="w-4 h-4" />,
        },
        {
          id: 'notifications',
          label: 'Scadenze & Notifiche',
          icon: <Bell className="w-4 h-4" />,
          badge: notificationCount > 0 ? notificationCount : undefined,
        },
      ],
    },
    {
      groupTitle: 'Configurazione & Archivio',
      items: [
        {
          id: 'receipts_config',
          label: 'Modelli Ricevute & PDF',
          icon: <Sliders className="w-4 h-4" />,
        },
        {
          id: 'backup',
          label: 'Archivio Anni & Impostazioni ASD',
          icon: <Database className="w-4 h-4" />,
        },
      ],
    },
  ];

  const brandInitial = (associationName || 'A').trim().charAt(0).toUpperCase();

  const handleSelectNav = (tab: NavTab) => {
    setActiveTab(tab);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile / Tablet Backdrop Overlay */}
      {isMobileOpen && (
        <div
          id="mobile-sidebar-backdrop"
          onClick={onCloseMobile}
          className="no-print fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden animate-in fade-in duration-150"
        />
      )}

      <aside
        id="app-sidebar"
        className={`no-print w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col shrink-0 select-none transition-transform duration-200 z-50 ${
          isMobileOpen
            ? 'fixed inset-y-0 left-0 translate-x-0 shadow-2xl'
            : 'hidden lg:flex'
        }`}
      >
        {/* Top Brand Bar */}
        <div className="p-4 border-b border-slate-800">
          {/* Permanent Creator Attribution Badge: ASD Apuacamp always visible */}
          <div
            id="apuacamp-creator-badge"
            className="mb-2.5 px-2.5 py-1 rounded-md bg-emerald-950/90 border border-emerald-700/50 flex items-center justify-between text-[10px]"
          >
            <span className="flex items-center gap-1.5 text-emerald-300 font-semibold tracking-tight">
              <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Progetto ASD Apuacamp</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono uppercase text-emerald-400/90">Multi-ASD</span>
              {onCloseMobile && (
                <button
                  id="btn-sidebar-close-mobile"
                  type="button"
                  onClick={onCloseMobile}
                  className="lg:hidden ml-1 p-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-800"
                  title="Chiudi menu laterale"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {profile?.logoImageDataUrl ? (
                <img
                  src={profile.logoImageDataUrl}
                  alt={associationName}
                  className="w-9 h-9 rounded-lg object-contain bg-white p-0.5 shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                  {brandInitial}
                </div>
              )}
              <div className="min-w-0">
                <h1
                  id="sidebar-active-asd-name"
                  className="font-bold text-white text-sm tracking-tight leading-tight truncate"
                  title={associationName}
                >
                  {associationName}
                </h1>
                <p className="text-[11px] text-slate-400 font-medium truncate">
                  Gestionale Sport & Natura
                </p>
              </div>
            </div>

            {onUpdateProfile && (
              <button
                id="btn-sidebar-edit-asd-year"
                type="button"
                onClick={() => (isEditingBrand ? setIsEditingBrand(false) : openBrandEditor())}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
                title="Modifica Nome Associazione Sportiva o Anno Attivo"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isEditingBrand && profile && onUpdateProfile ? (
            <form
              onSubmit={handleSaveBrand}
              className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-slate-700 space-y-2 text-[11px]"
            >
              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                  Nome Associazione (Multi-ASD)
                </label>
                <input
                  id="input-sidebar-asd-name"
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="Es. ASD Apuacamp"
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-semibold text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">
                  Affiliazione / Ente (es. US ACLI)
                </label>
                <input
                  id="input-sidebar-asd-affiliation"
                  type="text"
                  value={draftAffiliation}
                  onChange={(e) => setDraftAffiliation(e.target.value)}
                  placeholder="Affiliata US ACLI"
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 text-[11px]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-semibold mb-1">
                  Anno Sportivo Attivo (o Consulta Archivio)
                </label>
                <div className="flex items-center gap-1 mb-1.5">
                  {[2026, 2027, 2028, 2029].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setDraftYear(yr)}
                      className={`flex-1 py-1 rounded font-mono font-bold text-[10px] border transition-colors ${
                        draftYear === yr
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
                <input
                  id="input-sidebar-asd-year"
                  type="number"
                  value={draftYear}
                  onChange={(e) => setDraftYear(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-300 font-mono font-bold text-xs"
                />
              </div>
              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingBrand(false);
                    handleSelectNav('backup');
                  }}
                  className="text-[10px] text-emerald-400 hover:underline"
                >
                  Archivio Anni →
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditingBrand(false)}
                    className="px-2 py-1 rounded text-[10px] text-slate-400 hover:text-white"
                  >
                    Annulla
                  </button>
                  <button
                    id="btn-sidebar-save-asd"
                    type="submit"
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]"
                  >
                    <Check className="w-3 h-3" />
                    <span>Applica</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 gap-2">
              <span className="flex items-center gap-1.5 text-emerald-400 truncate">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{affiliation || 'ASD / SSD'}</span>
              </span>
              <button
                id="btn-sidebar-year-picker"
                type="button"
                onClick={openBrandEditor}
                className="font-mono text-slate-300 hover:text-white hover:border-emerald-500/50 font-semibold shrink-0 px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-[10px] transition-colors"
                title="Clicca sull'anno per cambiare l'anno sportivo attivo o consultare un altro anno"
              >
                Anno {activeYear} ▾
              </button>
            </div>
          )}

          {/* Direct Google Account (Drive + Gmail) Login & Sync Status right below ASD Name & Anno */}
          <div
            id="sidebar-google-account-box"
            className="mt-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-[11px]"
          >
            {googleUserEmail ? (
              <>
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span
                      className="font-semibold text-white truncate text-[11px]"
                      title={googleUserEmail}
                    >
                      {googleUserEmail}
                    </span>
                  </div>
                  {onGoogleLogout && (
                    <button
                      id="btn-sidebar-google-logout"
                      type="button"
                      onClick={onGoogleLogout}
                      className="p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors shrink-0"
                      title="Disconnetti Account Google"
                    >
                      <LogOut className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Status Badges for Drive AND Gmail */}
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div className="px-2 py-1 rounded bg-emerald-950/70 border border-emerald-700/40 text-emerald-300 flex items-center gap-1 truncate">
                    <HardDrive className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate font-medium">
                      {driveSyncState === 'saving'
                        ? 'Salvataggio...'
                        : driveSyncState === 'loading'
                        ? 'Lettura...'
                        : lastDriveSavedAt
                        ? `Drive ${lastDriveSavedAt}`
                        : 'Drive Attivo'}
                    </span>
                  </div>
                  <button
                    id="btn-sidebar-gmail-permissions"
                    type="button"
                    onClick={() => onGoogleSignIn && onGoogleSignIn(true)}
                    className="px-2 py-1 rounded bg-blue-950/70 hover:bg-blue-900/80 border border-blue-700/40 text-blue-200 flex items-center justify-center gap-1 truncate transition-colors"
                    title="Gmail è collegato allo stesso login Google. Clicca qui se vuoi riaprire la schermata dei permessi Google per spuntare l'invio email Gmail."
                  >
                    <Mail className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="truncate font-medium">Gmail Attivo ✓</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px] text-slate-400">
                  {onReloadFromDrive && (
                    <button
                      type="button"
                      onClick={onReloadFromDrive}
                      className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
                      title="Sincronizza ora con Google Drive"
                    >
                      <RefreshCw
                        className={`w-2.5 h-2.5 ${
                          driveSyncState === 'loading' || driveSyncState === 'saving'
                            ? 'animate-spin'
                            : ''
                        }`}
                      />
                      <span>Sincronizza Drive</span>
                    </button>
                  )}
                  {onGoogleSignIn && (
                    <button
                      type="button"
                      onClick={() => onGoogleSignIn(true)}
                      className="text-blue-300 hover:underline"
                      title="Riapri il consenso Google per verificare i permessi Drive + Gmail"
                    >
                      Permessi Mail/Drive
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1 font-medium text-amber-300">
                    <HardDrive className="w-3 h-3 text-amber-400" />
                    <span>Drive & Gmail non connessi</span>
                  </span>
                </div>
                {onGoogleSignIn && (
                  <button
                    id="btn-sidebar-google-login"
                    type="button"
                    onClick={() => onGoogleSignIn(false)}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Connetti Google (Drive + Mail)</span>
                  </button>
                )}
                <div className="text-[9px] text-slate-400 leading-tight">
                  Un solo login attiva il salvataggio automatico su <strong>Drive</strong> e l&apos;invio ricevute con <strong>Gmail</strong>.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Grouped Navigation List (4 Logical Sections) */}
        <nav className="flex-1 px-3 py-2.5 space-y-3.5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-0.5">
              <div className="px-2.5 pb-1 text-[10px] uppercase tracking-wider font-bold text-slate-500">
                {group.groupTitle}
              </div>
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-tab-${item.id}`}
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-600/20 text-emerald-400 font-semibold border border-emerald-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 text-left min-w-0">
                      <span className={isActive ? 'text-emerald-400' : 'text-slate-400'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-medium shrink-0 ${
                          item.id === 'notifications'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Financial Health Mini-Widget + ASD Apuacamp Footer */}
        <div className="p-3 m-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
          <div>
            <div className="text-[11px] text-slate-400 flex items-center justify-between mb-0.5">
              <span>Saldo Cassa {activeYear}</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono tabular-nums tracking-tight">
              {formatEuro(currentBalance)}
            </div>
            <div className="text-[10px] text-slate-400">Include liquidità C/C e contanti</div>
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate">
                Creato da <strong className="text-emerald-400">Matteo Palazzi</strong> (ASD Apuacamp)
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onOpenOnboardingWizard) {
                    onOpenOnboardingWizard();
                  } else {
                    handleSelectNav('backup');
                  }
                }}
                className="text-emerald-400 hover:underline font-semibold shrink-0"
              >
                Configura ASD
              </button>
            </div>
            {onOpenLegalPage && (
              <div className="flex items-center justify-between text-[9.5px] text-slate-500 pt-0.5">
                <a
                  href="/privacy"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenLegalPage('privacy');
                  }}
                  className="hover:text-emerald-300 hover:underline transition-colors"
                >
                  Privacy (/privacy)
                </a>
                <span>•</span>
                <a
                  href="/termini"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenLegalPage('termini');
                  }}
                  className="hover:text-emerald-300 hover:underline transition-colors"
                >
                  Termini & Licenza (/termini)
                </a>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

