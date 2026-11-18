import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Send,
  Calendar,
  FileText,
  Award,
  Plus,
  Edit3,
  Trash2,
  X,
  CalendarClock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  Member,
  EventItem,
  EventBooking,
  GadgetOrder,
  AssociationProfile,
  AssociationRole,
  AssemblyMeeting,
  GrantItem,
  CashTransaction,
  NotificationCategory,
  NotificationResolutionRecord,
  CriticalDeadlineCategory,
  CustomCriticalDeadline,
} from '../types';
import {
  generateSystemNotifications,
  generatePreEventBriefings,
  filterNotificationsByResolutions,
  parseAnyDate,
  diffDays,
} from '../utils/notifications';
import { formatEuro } from '../utils/finance';
import { NavTab } from './Sidebar';

interface NotificationsViewProps {
  members: Member[];
  events: EventItem[];
  bookings: EventBooking[];
  gadgetOrders: GadgetOrder[];
  roles: AssociationRole[];
  assemblies: AssemblyMeeting[];
  grants: GrantItem[];
  transactions?: CashTransaction[];
  profile: AssociationProfile;
  onUpdateProfile: (profile: AssociationProfile) => void;
  onAddGrant?: (grant: Omit<GrantItem, 'id'>) => void;
  ignoredDuplicateSignatures?: string[];
  onOpenDuplicatesModal?: () => void;
  onNavigateTab: (tab: NavTab) => void;
  onSelectMember: (member: Member) => void;
  onSelectBooking: (booking: EventBooking) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  members,
  events,
  bookings,
  gadgetOrders,
  roles,
  assemblies,
  grants,
  transactions = [],
  profile,
  onUpdateProfile,
  onAddGrant,
  ignoredDuplicateSignatures = [],
  onOpenDuplicatesModal,
  onNavigateTab,
  onSelectMember,
  onSelectBooking,
}) => {
  const [filterCategory, setFilterCategory] = useState<
    'ALL' | NotificationCategory | 'RESOLVED_ARCHIVE'
  >('ALL');

  // Manual Deadline Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualDate, setManualDate] = useState('2027-12-31');
  const [manualCategory, setManualCategory] =
    useState<CriticalDeadlineCategory>('bandi_contributi');
  const [manualRecurrence, setManualRecurrence] = useState('Bando / Scadenza Fissa');
  const [alsoCreateGrant, setAlsoCreateGrant] = useState<boolean>(true);
  const [manualGrantPromoter, setManualGrantPromoter] = useState('Regione / Ente Erogatore');
  const [manualGrantAmount, setManualGrantAmount] = useState('5000');

  // Accordion & Expandable Row states
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);
  const [isPreEventOpen, setIsPreEventOpen] = useState<boolean>(false);
  const [isManualListOpen, setIsManualListOpen] = useState<boolean>(false);

  // Inline Resolve with Note or Postpone to Date state
  const [activeActionNotifId, setActiveActionNotifId] = useState<string | null>(null);
  const [activeActionMode, setActiveActionMode] = useState<'resolve' | 'postpone'>('resolve');
  const [noteInput, setNoteInput] = useState<string>('');
  const [postponeDateInput, setPostponeDateInput] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const rawNotifications = useMemo(
    () =>
      generateSystemNotifications(
        members,
        bookings,
        events,
        gadgetOrders,
        roles,
        assemblies,
        new Date(),
        grants,
        transactions,
        ignoredDuplicateSignatures,
        undefined,
        profile.customDeadlines || [],
        profile.completedDeadlineIds || [],
        profile.duplicateDetectionMode || 'strict'
      ),
    [
      members,
      bookings,
      events,
      gadgetOrders,
      roles,
      assemblies,
      grants,
      transactions,
      ignoredDuplicateSignatures,
      profile.customDeadlines,
      profile.completedDeadlineIds,
      profile.duplicateDetectionMode,
    ]
  );

  const { activeNotifications: notifications, resolvedOrPostponedList } = useMemo(
    () =>
      filterNotificationsByResolutions(
        rawNotifications,
        profile.notificationResolutions || {},
        new Date()
      ),
    [rawNotifications, profile.notificationResolutions]
  );

  const eventBriefings = useMemo(
    () => generatePreEventBriefings(events, bookings, members),
    [events, bookings, members]
  );

  const filteredNotifications =
    filterCategory === 'ALL'
      ? notifications
      : filterCategory === 'RESOLVED_ARCHIVE'
      ? []
      : filterCategory === 'scadenze_manuali'
      ? notifications.filter((n) => n.isCustomDeadline || n.category === 'scadenze_manuali')
      : notifications.filter((n) => n.category === filterCategory);

  const handleResolveNotification = (notifId: string, notifTitle: string) => {
    const currentMap = { ...(profile.notificationResolutions || {}) };
    const record: NotificationResolutionRecord = {
      itemId: notifId,
      status: 'resolved',
      note: noteInput.trim() || 'Risolto',
      updatedAt: new Date().toISOString().slice(0, 10),
      originalTitle: notifTitle,
    };
    onUpdateProfile({
      ...profile,
      notificationResolutions: {
        ...currentMap,
        [notifId]: record,
      },
    });
    setActiveActionNotifId(null);
    setNoteInput('');
  };

  const handlePostponeNotification = (notifId: string, notifTitle: string) => {
    if (!postponeDateInput) return;
    const currentMap = { ...(profile.notificationResolutions || {}) };
    const record: NotificationResolutionRecord = {
      itemId: notifId,
      status: 'postponed',
      note: noteInput.trim() || `Rimandata al ${postponeDateInput}`,
      postponedUntilDate: postponeDateInput,
      updatedAt: new Date().toISOString().slice(0, 10),
      originalTitle: notifTitle,
    };
    onUpdateProfile({
      ...profile,
      notificationResolutions: {
        ...currentMap,
        [notifId]: record,
      },
    });
    setActiveActionNotifId(null);
    setNoteInput('');
  };

  const handleReopenNotification = (notifId: string) => {
    const currentMap = { ...(profile.notificationResolutions || {}) };
    delete currentMap[notifId];
    onUpdateProfile({
      ...profile,
      notificationResolutions: currentMap,
    });
  };

  const openCreateManualDeadline = () => {
    setEditingCustomId(null);
    setManualTitle('');
    setManualDesc('');
    setManualDate('2027-12-31');
    setManualCategory('bandi_contributi');
    setManualRecurrence('Bando / Scadenza Fissa');
    setAlsoCreateGrant(true);
    setManualGrantPromoter('Regione / Ente Erogatore');
    setManualGrantAmount('5000');
    setIsManualModalOpen(true);
  };

  const openEditManualDeadline = (customId: string) => {
    const existing = (profile.customDeadlines || []).find((c) => c.id === customId);
    if (!existing) return;
    setEditingCustomId(existing.id);
    setManualTitle(existing.title);
    setManualDesc(existing.description);
    setManualDate(existing.dueDate);
    setManualCategory(existing.category);
    setManualRecurrence(existing.recurrenceLabel || 'Scadenza Manuale');
    setAlsoCreateGrant(false);
    setManualGrantPromoter(existing.promoter || 'Regione / Ente Erogatore');
    setManualGrantAmount(String(existing.requestedAmount || 5000));
    setIsManualModalOpen(true);
  };

  const handleSaveManualDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualDate) return;

    if (editingCustomId) {
      const nextList = (profile.customDeadlines || []).map((c) =>
        c.id === editingCustomId
          ? {
              ...c,
              title: manualTitle.trim(),
              description:
                manualDesc.trim() ||
                'Scadenza personalizzata inserita manualmente nello scadenziario ASD.',
              dueDate: manualDate,
              category: manualCategory,
              recurrenceLabel: manualRecurrence.trim() || 'Scadenza Manuale',
            }
          : c
      );
      onUpdateProfile({
        ...profile,
        customDeadlines: nextList,
      });
    } else {
      const customItem: CustomCriticalDeadline = {
        id: `custom-dl-${Date.now()}`,
        title: manualTitle.trim(),
        description:
          manualDesc.trim() ||
          (manualCategory === 'bandi_contributi'
            ? `Scadenza bando inserita manualmente (${
                manualGrantPromoter.trim() || 'Ente'
              }${Number(manualGrantAmount) > 0 ? ` · Importo: € ${manualGrantAmount}` : ''}).`
            : 'Scadenza personalizzata inserita manualmente nello scadenziario ASD.'),
        dueDate: manualDate,
        category: manualCategory,
        recurrenceLabel: manualRecurrence.trim() || 'Scadenza Manuale',
        promoter:
          manualCategory === 'bandi_contributi' ? manualGrantPromoter.trim() : undefined,
        requestedAmount:
          manualCategory === 'bandi_contributi' ? Number(manualGrantAmount) || 0 : undefined,
      };

      onUpdateProfile({
        ...profile,
        customDeadlines: [customItem, ...(profile.customDeadlines || [])],
      });

      if (manualCategory === 'bandi_contributi' && alsoCreateGrant && onAddGrant) {
        onAddGrant({
          title: manualTitle.trim(),
          promoter: manualGrantPromoter.trim() || 'Ente Promotore',
          submissionDeadline: manualDate,
          reportingDeadline: '',
          status: 'in_preparazione',
          requestedAmount: Number(manualGrantAmount) || 0,
          approvedAmount: 0,
          keyCharacteristics:
            manualDesc.trim() || 'Inserito manualmente da Scadenze & Notifiche.',
          usefulContacts: '',
          documents: [],
          notes: `Scadenza inserita manualmente: ${manualDate}`,
        });
      }
    }

    setIsManualModalOpen(false);
    setEditingCustomId(null);
    setManualTitle('');
    setManualDesc('');
  };

  const handleDeleteManualDeadline = (id: string) => {
    onUpdateProfile({
      ...profile,
      customDeadlines: (profile.customDeadlines || []).filter((c) => c.id !== id),
      completedDeadlineIds: (profile.completedDeadlineIds || []).filter((cid) => cid !== id),
    });
  };

  const duplicateAlertsCount = notifications.filter((n) => n.category === 'duplicati').length;
  const preEventAlertsCount = notifications.filter((n) => n.category === 'pre_evento').length;
  const unsentEmailsCount = notifications.filter(
    (n) => n.category === 'email_non_inviate'
  ).length;
  const governanceAlertsCount = notifications.filter(
    (n) => n.category === 'governance_scadenze'
  ).length;
  const grantsAlertsCount = notifications.filter(
    (n) => n.category === 'bandi_scadenze'
  ).length;
  const manualDeadlinesCount = notifications.filter((n) => n.isCustomDeadline).length;
  const unpaidBookings = bookings.filter(
    (b) => b.confirmed && !b.isBalancePaid && b.balanceAmount > 0
  );
  const totalUnpaidBookingsAmount = unpaidBookings.reduce(
    (sum, b) => sum + b.balanceAmount,
    0
  );

  return (
    <div className="space-y-4">
      {/* Compact Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Alert Pre-Evento</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700 font-mono mt-1 tabular-nums">
            {preEventAlertsCount}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Email da Inviare</span>
            <Send className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700 font-mono mt-1 tabular-nums">
            {unsentEmailsCount}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Governance &amp; Bandi</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-purple-800 font-mono mt-1 tabular-nums">
            {governanceAlertsCount + grantsAlertsCount}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Saldi da Incassare</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1 tabular-nums">
            {formatEuro(totalUnpaidBookingsAmount)}
          </div>
        </div>
      </div>

      {/* Collapsible Secondary Strips: 1) Scadenze Manuali | 2) Monitoraggio Pre-Evento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Accordion 1: Scadenze Manuali */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsManualListOpen((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-bold text-slate-900 hover:text-emerald-800 text-left flex-1"
            >
              {isManualListOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <CalendarClock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Scadenze Manuali ({(profile.customDeadlines || []).length})</span>
            </button>
            <button
              id="btn-notifications-add-manual-deadline"
              type="button"
              onClick={openCreateManualDeadline}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuova Scadenza</span>
            </button>
          </div>

          {isManualListOpen && (
            <div className="px-4 pb-3 pt-1 border-t border-slate-100 divide-y divide-slate-100">
              {(profile.customDeadlines || []).length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  Nessuna scadenza manuale salvata.
                </div>
              ) : (
                (profile.customDeadlines || []).map((c) => {
                  const parsed = parseAnyDate(c.dueDate);
                  const dLeft = parsed ? diffDays(parsed, new Date()) : 0;
                  return (
                    <div
                      key={c.id}
                      className="py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{c.title}</div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {c.dueDate} ·{' '}
                          {dLeft < 0 ? `Scaduta da ${Math.abs(dLeft)} gg` : `Tra ${dLeft} gg`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditManualDeadline(c.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100"
                          title="Modifica"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteManualDeadline(c.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Elimina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Accordion 2: Monitoraggio Pre-Evento */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsPreEventOpen((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-bold text-slate-900 hover:text-emerald-800 text-left flex-1"
            >
              {isPreEventOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Briefing Sicurezza Pre-Evento ({eventBriefings.length} eventi)</span>
            </button>
            <button
              onClick={() => onNavigateTab('events')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 shrink-0"
            >
              <span>Eventi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {isPreEventOpen && (
            <div className="px-4 pb-3 pt-1 border-t border-slate-100 divide-y divide-slate-100">
              {eventBriefings.map((b) => (
                <div
                  key={b.event.id}
                  onClick={() => onNavigateTab('events')}
                  className="py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 cursor-pointer"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900">{b.event.name}</span>
                    <span className="text-[11px] font-mono text-slate-400 ml-2">
                      {b.event.date} · {b.totalConfirmed} iscritti
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
                    {b.missingOrExpiredCardList.length > 0 && (
                      <span className="text-rose-600 font-bold" title="Tessere assenti/scadute">
                        {b.missingOrExpiredCardList.length} tess.
                      </span>
                    )}
                    {b.allergiesList.length > 0 && (
                      <span className="text-amber-700 font-bold" title="Allergie segnalate">
                        {b.allergiesList.length} allerg.
                      </span>
                    )}
                    {b.noPhotoConsentList.length > 0 && (
                      <span className="text-slate-600" title="Senza consenso foto">
                        {b.noPhotoConsentList.length} no-foto
                      </span>
                    )}
                    {b.pendingEmailsList.length > 0 && (
                      <span className="text-blue-600" title="Email da inviare">
                        {b.pendingEmailsList.length} mail
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {[
            { id: 'ALL', label: `Tutti gli Alert (${notifications.length})` },
            {
              id: 'scadenze_manuali',
              label: `Scadenze Manuali (${manualDeadlinesCount})`,
            },
            {
              id: 'bandi_scadenze',
              label: `Scadenze Bandi (${grantsAlertsCount})`,
            },
            {
              id: 'governance_scadenze',
              label: `Governance & Assemblea (${governanceAlertsCount})`,
            },
            { id: 'duplicati', label: `Duplicati Cassa (${duplicateAlertsCount})` },
            { id: 'pre_evento', label: `Briefing Pre-Evento (${preEventAlertsCount})` },
            { id: 'email_non_inviate', label: `Email da Inviare (${unsentEmailsCount})` },
            { id: 'tessere', label: 'Tessere & Assicurazioni' },
            { id: 'pagamenti', label: 'Saldi & Caparre' },
            {
              id: 'RESOLVED_ARCHIVE',
              label: `Risolte & Rimandate (${resolvedOrPostponedList.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              id={
                tab.id === 'RESOLVED_ARCHIVE'
                  ? 'tab-notif-resolved-archive'
                  : `tab-notif-${tab.id}`
              }
              onClick={() => setFilterCategory(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterCategory === tab.id
                  ? 'bg-slate-900 text-white'
                  : tab.id === 'RESOLVED_ARCHIVE'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List OR Resolved/Postponed Archive */}
      {filterCategory === 'RESOLVED_ARCHIVE' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs divide-y divide-slate-100">
          {resolvedOrPostponedList.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              Nessuna notifica ancora segnata come risolta o rimandata. Usa i pulsanti &quot;Digita Risolto&quot; o &quot;Rimanda Data&quot; su qualsiasi alert per gestirlo.
            </div>
          ) : (
            resolvedOrPostponedList.map(({ notification, record }) => (
              <div
                key={record.itemId}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        record.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {record.status === 'resolved'
                        ? 'Risolta ✓'
                        : `Rimandata al ${record.postponedUntilDate}`}
                    </span>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                      {notification?.title || record.originalTitle || record.itemId}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Aggiornata il {record.updatedAt}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-900 font-semibold bg-emerald-50/80 px-2.5 py-1 rounded border border-emerald-200 inline-block">
                    Nota digitata: &ldquo;{record.note}&rdquo;
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleReopenNotification(record.itemId)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 self-end sm:self-auto"
                >
                  Riapri Alert
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs divide-y divide-slate-100">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              Nessuna notifica pendente per questa categoria. Tutte le scadenze sono in regola!
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isUrgent = notif.type === 'urgent';
              const isWarning = notif.type === 'warning';
              const isEditingThis = activeActionNotifId === notif.id;
              const isExpanded = expandedNotifId === notif.id || isEditingThis;

              return (
                <div
                  key={notif.id}
                  className="transition-colors"
                >
                  {/* 1-Line Compact Notification Header Row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedNotifId((prev) => (prev === notif.id ? null : notif.id))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedNotifId((prev) => (prev === notif.id ? null : notif.id));
                      }
                    }}
                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          isUrgent
                            ? 'bg-rose-600'
                            : isWarning
                            ? 'bg-amber-500'
                            : 'bg-blue-500'
                        }`}
                      />
                      <h4 className="font-semibold text-slate-900 text-xs sm:text-sm truncate">
                        {notif.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 text-xs">
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {notif.date}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details & Action Buttons (Visible on click) */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 bg-slate-50/70 border-t border-slate-100 space-y-3 text-xs">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {notif.description}
                      </p>

                      {/* Direct Action + Resolve / Postpone Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                      <button
                        id={`btn-notif-resolve-${notif.id}`}
                        type="button"
                        onClick={() => {
                          setActiveActionNotifId(
                            isEditingThis && activeActionMode === 'resolve'
                              ? null
                              : notif.id
                          );
                          setActiveActionMode('resolve');
                          setNoteInput('Risolto: ');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Digita Risolto</span>
                      </button>

                      <button
                        id={`btn-notif-postpone-${notif.id}`}
                        type="button"
                        onClick={() => {
                          setActiveActionNotifId(
                            isEditingThis && activeActionMode === 'postpone'
                              ? null
                              : notif.id
                          );
                          setActiveActionMode('postpone');
                          setNoteInput('');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-700" />
                        <span>Rimanda a Data</span>
                      </button>

                      {notif.targetType === 'duplicate_group' && (
                        <button
                          onClick={() => {
                            if (onOpenDuplicatesModal) {
                              onOpenDuplicatesModal();
                            } else {
                              onNavigateTab('cashflow');
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300 shadow-2xs"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-800" />
                          <span>{notif.actionLabel || 'Apri Popup Duplicati'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {notif.targetType === 'member' && notif.targetId && (
                        <button
                          onClick={() => {
                            const target = members.find((m) => m.id === notif.targetId);
                            if (target) onSelectMember(target);
                            else onNavigateTab('members');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                        >
                          <span>{notif.actionLabel || 'Apri Socio'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {notif.targetType === 'booking' && notif.targetId && (
                        <button
                          onClick={() => {
                            const target = bookings.find((b) => b.id === notif.targetId);
                            if (target) onSelectBooking(target);
                            else onNavigateTab('events');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                        >
                          <span>{notif.actionLabel || 'Gestisci Iscrizione'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {notif.targetType === 'event' && (
                        <button
                          onClick={() => onNavigateTab('events')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                        >
                          <span>{notif.actionLabel || 'Vai a Evento'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {notif.targetType === 'gadget_order' && (
                        <button
                          onClick={() => onNavigateTab('gadgets')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                        >
                          <span>{notif.actionLabel || 'Vai a Gadget'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {notif.targetType === 'governance' && (
                        <button
                          onClick={() => onNavigateTab('governance')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
                        >
                          <span>{notif.actionLabel || 'Vai a Governance & Drive'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {notif.targetType === 'grant' && (
                        <button
                          onClick={() => onNavigateTab('grants')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>{notif.actionLabel || 'Apri Scheda Bando'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {notif.targetType === 'custom_deadline' && notif.targetId && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditManualDeadline(notif.targetId!)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200"
                            title="Modifica questa scadenza manuale"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Modifica</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteManualDeadline(notif.targetId!)}
                            className="p-1.5 text-slate-500 hover:text-rose-700 bg-white hover:bg-rose-50 rounded-lg border border-slate-200"
                            title="Elimina questa scadenza manuale"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inline Resolve / Postpone Form */}
                  {isEditingThis && (
                    <div className="ml-0 sm:ml-12 p-3.5 rounded-xl bg-slate-100 border border-slate-300 space-y-2.5 text-xs">
                      {activeActionMode === 'resolve' ? (
                        <div className="space-y-2">
                          <label className="block font-bold text-slate-800">
                            Digita nota di risoluzione (la notifica scomparirà dagli alert attivi):
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              id={`input-notif-resolve-${notif.id}`}
                              type="text"
                              placeholder="Es. Risolto: inviata tessera e ricevuta..."
                              value={noteInput}
                              onChange={(e) => setNoteInput(e.target.value)}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                            />
                            <button
                              id={`btn-confirm-notif-resolve-${notif.id}`}
                              type="button"
                              onClick={() =>
                                handleResolveNotification(notif.id, notif.title)
                              }
                              className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shrink-0"
                            >
                              Conferma Risolto & Nascondi ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveActionNotifId(null)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 font-semibold"
                            >
                              Annulla
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="block font-bold text-slate-800">
                            Rimanda la notifica a un&apos;altra data (scomparirà fino alla data scelta):
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <span className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                Nuova Data Promemoria:
                              </span>
                              <input
                                id={`input-notif-postpone-date-${notif.id}`}
                                type="date"
                                value={postponeDateInput}
                                onChange={(e) => setPostponeDateInput(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <span className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                Nota opzionale sul rinvio:
                              </span>
                              <input
                                type="text"
                                placeholder="Es. Da risentire a inizio mese prossimo..."
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              {[
                                { label: '+7 giorni', days: 7 },
                                { label: '+15 giorni', days: 15 },
                                { label: '+30 giorni', days: 30 },
                              ].map((q) => (
                                <button
                                  key={q.days}
                                  type="button"
                                  onClick={() => {
                                    const d = new Date();
                                    d.setDate(d.getDate() + q.days);
                                    setPostponeDateInput(d.toISOString().slice(0, 10));
                                  }}
                                  className="px-2 py-1 rounded bg-white border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  {q.label}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                id={`btn-confirm-notif-postpone-${notif.id}`}
                                type="button"
                                onClick={() =>
                                  handlePostponeNotification(notif.id, notif.title)
                                }
                                className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                              >
                                Rimanda a questa Data
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveActionNotifId(null)}
                                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 font-semibold"
                              >
                                Annulla
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal to Add or Edit a Manual Deadline directly from Scadenze & Notifiche */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingCustomId
                    ? 'Modifica Scadenza Manuale'
                    : 'Inserisci Nuova Scadenza Manuale (Bando, Fisco o Altro)'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Sincronizzata automaticamente con lo Scadenziario della Dashboard e con gli Alert.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveManualDeadline} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Categoria / Tipo di Scadenza *
                </label>
                <select
                  id="select-notif-manual-category"
                  value={manualCategory}
                  onChange={(e) => {
                    const cat = e.target.value as CriticalDeadlineCategory;
                    setManualCategory(cat);
                    if (cat === 'bandi_contributi') {
                      setManualRecurrence('Bando / Contributo');
                    } else if (cat === 'fisco_inps') {
                      setManualRecurrence('Adempimento Fiscale');
                    } else if (cat === 'affiliazione_tesserini') {
                      setManualRecurrence('Affiliazione / Tesserini');
                    } else {
                      setManualRecurrence('Governance / Altro');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                >
                  <option value="bandi_contributi">
                    Nuovo Bando / Contributo / Rendicontazione (es. Scadenza Dicembre 2027)
                  </option>
                  <option value="fisco_inps">
                    Scadenza Fiscale (Agenzia Entrate, INPS, F24, CU)
                  </option>
                  <option value="affiliazione_tesserini">
                    Affiliazione US ACLI, Tesserini Istruttori o Assicurazioni
                  </option>
                  <option value="bilancio_governance">
                    Assemblea, Governance, Convenzioni o Altro Promemoria ASD
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Titolo della Scadenza *
                </label>
                <input
                  id="input-notif-manual-title"
                  type="text"
                  required
                  placeholder="Es. Bando Sport e Natura - Scadenza Dicembre 2027"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Data di Scadenza *
                    </label>
                    <input
                      id="input-notif-manual-date"
                      type="date"
                      required
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Etichetta / Ricorrenza
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Bando / Una tantum / Annuale"
                      value={manualRecurrence}
                      onChange={(e) => setManualRecurrence(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-bold text-slate-500">Scelta rapida data:</span>
                  {[
                    { label: 'Dicembre 2026', date: '2026-12-31' },
                    { label: 'Marzo 2027', date: '2027-03-31' },
                    { label: 'Giugno 2027', date: '2027-06-30' },
                    { label: 'Settembre 2027', date: '2027-09-30' },
                    { label: 'Dicembre 2027', date: '2027-12-31' },
                    { label: 'Dicembre 2028', date: '2028-12-31' },
                  ].map((preset) => (
                    <button
                      key={preset.date}
                      type="button"
                      onClick={() => setManualDate(preset.date)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${
                        manualDate === preset.date
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {!editingCustomId && manualCategory === 'bandi_contributi' && onAddGrant && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={alsoCreateGrant}
                      onChange={(e) => setAlsoCreateGrant(e.target.checked)}
                      className="rounded border-amber-400 text-emerald-700"
                    />
                    <span>
                      Crea automaticamente la scheda anche in &quot;Bandi &amp; Progetti&quot;
                    </span>
                  </label>
                  {alsoCreateGrant && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                          Ente Erogatore / Promotore
                        </label>
                        <input
                          type="text"
                          value={manualGrantPromoter}
                          onChange={(e) => setManualGrantPromoter(e.target.value)}
                          placeholder="Es. Regione Toscana / Sport e Salute"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-amber-900 mb-0.5">
                          Importo / Contributo Previsto (€)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={manualGrantAmount}
                          onChange={(e) => setManualGrantAmount(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-mono text-slate-900"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Note / Dettagli / Documenti da preparare
                </label>
                <textarea
                  id="textarea-notif-manual-desc"
                  rows={2}
                  placeholder="Es. Preparare domanda e allegati per invio entro dicembre 2027..."
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Annulla
                </button>
                <button
                  id="btn-notif-save-manual-deadline"
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-2xs"
                >
                  {editingCustomId ? 'Salva Modifiche' : 'Salva Scadenza Manuale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
