import React, { useState, useMemo } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Trash2,
  Edit3,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  AssemblyMeeting,
  AssociationProfile,
  AssociationRole,
  CriticalDeadlineCategory,
  CriticalDeadlineItem,
  CustomCriticalDeadline,
  DeadlineOverrideRecord,
  GrantItem,
} from '../types';
import {
  buildCriticalYearDeadlines,
  formatRemainingTimeHuman,
  getVisualAlertMeta,
} from '../utils/criticalDeadlines';
import { todayIso } from '../utils/dates';
import { newId } from '../utils/ids';
import { NavTab } from './Sidebar';

interface CriticalDeadlinesWidgetProps {
  profile: AssociationProfile;
  assemblies: AssemblyMeeting[];
  grants: GrantItem[];
  roles: AssociationRole[];
  onUpdateProfile: (profile: AssociationProfile) => void;
  onUpdateAssembly?: (assembly: AssemblyMeeting) => void;
  onAddGrant?: (grant: Omit<GrantItem, 'id'>) => void;
  setActiveTab: (tab: NavTab) => void;
}

const MONTHS_SHORT = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
];

const CATEGORY_META: Record<
  CriticalDeadlineCategory,
  { label: string; shortLabel: string; dotColor: string }
> = {
  fisco_inps: {
    label: 'Scadenze Fiscali (Agenzia Entrate & INPS)',
    shortLabel: 'Fisco & INPS',
    dotColor: 'bg-blue-600',
  },
  affiliazione_tesserini: {
    label: 'Affiliazione US ACLI & Tesserini',
    shortLabel: 'Affiliazione & Tesserini',
    dotColor: 'bg-emerald-600',
  },
  bilancio_governance: {
    label: 'Assemblea di Bilancio & Governance',
    shortLabel: 'Bilancio & Governance',
    dotColor: 'bg-purple-600',
  },
  bandi_contributi: {
    label: 'Scadenze Bandi & Rendicontazioni',
    shortLabel: 'Bandi & Progetti',
    dotColor: 'bg-amber-600',
  },
};

type SimulationPresetId = 'real' | 'sim_affiliazione' | 'sim_bilancio' | 'sim_fisco_settembre';

export const CriticalDeadlinesWidget: React.FC<CriticalDeadlinesWidgetProps> = ({
  profile,
  assemblies,
  grants,
  roles,
  onUpdateProfile,
  onUpdateAssembly,
  onAddGrant,
  setActiveTab,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | CriticalDeadlineCategory>('ALL');
  const [simPreset, setSimPreset] = useState<SimulationPresetId>('real');
  const [expandedDeadlineId, setExpandedDeadlineId] = useState<string | null>(null);
  const [showTimelineDrawer, setShowTimelineDrawer] = useState<boolean>(false);
  const [isAllDeadlinesExpanded, setIsAllDeadlinesExpanded] = useState<boolean>(false);

  // Add / Edit Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [editingProposedId, setEditingProposedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('2027-12-31');
  const [newCategory, setNewCategory] = useState<CriticalDeadlineCategory>('bandi_contributi');
  const [newRecurrenceLabel, setNewRecurrenceLabel] = useState('Bando / Scadenza Fissa');
  const [alsoCreateGrant, setAlsoCreateGrant] = useState<boolean>(true);
  const [newGrantPromoter, setNewGrantPromoter] = useState<string>('Regione / Ente Erogatore');
  const [newGrantAmount, setNewGrantAmount] = useState<string>('5000');

  // Inline Resolve with Note or Postpone Date state per deadline row
  const [editingActionItemId, setEditingActionItemId] = useState<string | null>(null);
  const [editingActionMode, setEditingActionMode] = useState<'resolve' | 'postpone'>('resolve');
  const [actionNoteText, setActionNoteText] = useState<string>('');
  const [actionPostponeDate, setActionPostponeDate] = useState<string>('');
  const [hideResolved, setHideResolved] = useState<boolean>(
    Boolean(profile.hideResolvedDeadlines)
  );

  const effectiveReferenceDate = useMemo(() => {
    if (simPreset === 'sim_affiliazione') {
      return new Date(profile.activeYear, 0, 25);
    }
    if (simPreset === 'sim_bilancio') {
      return new Date(profile.activeYear, 3, 22);
    }
    if (simPreset === 'sim_fisco_settembre') {
      return new Date(profile.activeYear, 7, 30);
    }
    return new Date();
  }, [simPreset, profile.activeYear]);

  const { deadlines, summary } = useMemo(
    () =>
      buildCriticalYearDeadlines({
        activeYear: profile.activeYear,
        referenceDate: effectiveReferenceDate,
        assemblies,
        grants,
        roles,
        completedDeadlineIds: profile.completedDeadlineIds || [],
        customDeadlines: profile.customDeadlines || [],
        deadlineOverrides: profile.deadlineOverrides || {},
      }),
    [
      profile.activeYear,
      profile.completedDeadlineIds,
      profile.customDeadlines,
      profile.deadlineOverrides,
      assemblies,
      grants,
      roles,
      effectiveReferenceDate,
    ]
  );

  const approachingOrUrgentDeadlines = useMemo(
    () =>
      deadlines.filter(
        (d) =>
          !d.isCompleted &&
          (d.status === 'overdue' || d.status === 'urgent' || d.status === 'upcoming')
      ),
    [deadlines]
  );

  const filteredDeadlines = useMemo(() => {
    const byCat =
      selectedCategory === 'ALL'
        ? deadlines
        : deadlines.filter((d) => d.category === selectedCategory);
    if (hideResolved) {
      return byCat.filter((d) => !d.isCompleted);
    }
    return byCat;
  }, [deadlines, selectedCategory, hideResolved]);

  const visibleDeadlines = useMemo(() => {
    if (isAllDeadlinesExpanded || selectedCategory !== 'ALL') {
      return filteredDeadlines;
    }
    return filteredDeadlines.slice(0, 6);
  }, [filteredDeadlines, isAllDeadlinesExpanded, selectedCategory]);

  const handleToggleComplete = (deadlineId: string) => {
    const current = profile.completedDeadlineIds || [];
    const exists = current.includes(deadlineId);
    const next = exists
      ? current.filter((id) => id !== deadlineId)
      : [...current, deadlineId];

    const currentOverrides = { ...(profile.deadlineOverrides || {}) };
    if (currentOverrides[deadlineId]) {
      currentOverrides[deadlineId] = {
        ...currentOverrides[deadlineId],
        isCompleted: !exists,
      };
    }

    onUpdateProfile({
      ...profile,
      completedDeadlineIds: next,
      deadlineOverrides: currentOverrides,
    });
  };

  const handleSaveResolveWithNote = (deadlineId: string) => {
    const current = profile.completedDeadlineIds || [];
    const nextCompleted = current.includes(deadlineId)
      ? current
      : [...current, deadlineId];
    const currentOverrides = { ...(profile.deadlineOverrides || {}) };
    const existing = currentOverrides[deadlineId];

    const record: DeadlineOverrideRecord = {
      ...existing,
      deadlineId,
      customDueDate: existing?.customDueDate,
      resolutionNote: actionNoteText.trim() || 'Risolto e archiviato',
      isCompleted: true,
      updatedAt: todayIso(),
    };

    onUpdateProfile({
      ...profile,
      completedDeadlineIds: nextCompleted,
      deadlineOverrides: {
        ...currentOverrides,
        [deadlineId]: record,
      },
    });
    setEditingActionItemId(null);
    setActionNoteText('');
  };

  const handleSavePostponeDate = (deadlineId: string) => {
    if (!actionPostponeDate) return;
    const current = (profile.completedDeadlineIds || []).filter((id) => id !== deadlineId);
    const currentOverrides = { ...(profile.deadlineOverrides || {}) };
    const existing = currentOverrides[deadlineId];

    const record: DeadlineOverrideRecord = {
      ...existing,
      deadlineId,
      customDueDate: actionPostponeDate,
      resolutionNote:
        actionNoteText.trim() ||
        existing?.resolutionNote ||
        `Rimandata al ${actionPostponeDate}`,
      isCompleted: false,
      updatedAt: todayIso(),
    };

    onUpdateProfile({
      ...profile,
      completedDeadlineIds: current,
      deadlineOverrides: {
        ...currentOverrides,
        [deadlineId]: record,
      },
    });
    setEditingActionItemId(null);
    setActionNoteText('');
  };

  const openCreateModal = () => {
    setEditingCustomId(null);
    setEditingProposedId(null);
    setNewTitle('');
    setNewDesc('');
    setNewDate('2027-12-31');
    setNewCategory('bandi_contributi');
    setNewRecurrenceLabel('Bando / Scadenza Fissa');
    setAlsoCreateGrant(true);
    setNewGrantPromoter('Regione / Ente Erogatore');
    setNewGrantAmount('5000');
    setIsAddModalOpen(true);
  };

  const openEditCustomDeadline = (customId: string) => {
    const existing = (profile.customDeadlines || []).find((c) => c.id === customId);
    if (!existing) return;
    setEditingCustomId(existing.id);
    setEditingProposedId(null);
    setNewTitle(existing.title);
    setNewDesc(existing.description);
    setNewDate(existing.dueDate);
    setNewCategory(existing.category);
    setNewRecurrenceLabel(existing.recurrenceLabel || 'Scadenza Manuale');
    setAlsoCreateGrant(false);
    setNewGrantPromoter(existing.promoter || 'Regione / Ente Erogatore');
    setNewGrantAmount(String(existing.requestedAmount || 5000));
    setIsAddModalOpen(true);
  };

  const openEditProposedDeadline = (item: CriticalDeadlineItem) => {
    const ov = profile.deadlineOverrides?.[item.id];
    setEditingCustomId(null);
    setEditingProposedId(item.id);
    setNewTitle(ov?.customTitle || item.title);
    const cleanDesc =
      ov?.customDescription ||
      item.description.replace(/^\[Nota registrata: ".*?"\] — /, '');
    setNewDesc(cleanDesc);
    setNewDate(item.dueDate);
    setNewCategory(item.category);
    setNewRecurrenceLabel(ov?.customDueDateLabel || 'Data Scelta ASD');
    setAlsoCreateGrant(false);
    setIsAddModalOpen(true);
  };

  const handleHideProposedDeadline = (deadlineId: string) => {
    const currentOverrides = { ...(profile.deadlineOverrides || {}) };
    const existing = currentOverrides[deadlineId];
    onUpdateProfile({
      ...profile,
      deadlineOverrides: {
        ...currentOverrides,
        [deadlineId]: {
          ...existing,
          deadlineId,
          isHidden: true,
          updatedAt: todayIso(),
        },
      },
    });
  };

  const handleRestoreHiddenProposedDeadlines = () => {
    const currentOverrides = { ...(profile.deadlineOverrides || {}) };
    for (const key of Object.keys(currentOverrides)) {
      if (currentOverrides[key]?.isHidden) {
        currentOverrides[key] = {
          ...currentOverrides[key],
          isHidden: false,
        };
      }
    }
    onUpdateProfile({
      ...profile,
      deadlineOverrides: currentOverrides,
    });
  };

  const hiddenProposedCount = useMemo(
    () =>
      Object.values(profile.deadlineOverrides || {}).filter((ov) => ov?.isHidden).length,
    [profile.deadlineOverrides]
  );

  const handleAddCustomDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;

    if (editingProposedId) {
      const currentOverrides = { ...(profile.deadlineOverrides || {}) };
      const existing = currentOverrides[editingProposedId];
      const record: DeadlineOverrideRecord = {
        ...existing,
        deadlineId: editingProposedId,
        customTitle: newTitle.trim(),
        customDescription: newDesc.trim(),
        customDueDate: newDate,
        customDueDateLabel: newRecurrenceLabel.trim() || 'Data Scelta ASD',
        isPermanentDateChange: true,
        isHidden: false,
        updatedAt: todayIso(),
      };
      onUpdateProfile({
        ...profile,
        deadlineOverrides: {
          ...currentOverrides,
          [editingProposedId]: record,
        },
      });

      if (editingProposedId === 'std-assemblea-bilancio' && onUpdateAssembly) {
        const rendicontoAsm = assemblies.find((a) => a.type === 'ordinaria_rendiconto');
        if (rendicontoAsm) {
          onUpdateAssembly({
            ...rendicontoAsm,
            title: newTitle.trim() || rendicontoAsm.title,
            scheduledDate: newDate,
            approvalDeadline: newDate,
          });
        }
      }
    } else if (editingCustomId) {
      const updatedList = (profile.customDeadlines || []).map((c) =>
        c.id === editingCustomId
          ? {
              ...c,
              title: newTitle.trim(),
              description:
                newDesc.trim() ||
                'Scadenza personalizzata inserita manualmente nello scadenziario ASD.',
              dueDate: newDate,
              category: newCategory,
              recurrenceLabel: newRecurrenceLabel.trim() || 'Scadenza Manuale',
            }
          : c
      );
      onUpdateProfile({
        ...profile,
        customDeadlines: updatedList,
      });
    } else {
      const customItem: CustomCriticalDeadline = {
        id: newId('custom-dl'),
        title: newTitle.trim(),
        description:
          newDesc.trim() ||
          (newCategory === 'bandi_contributi'
            ? `Scadenza bando inserita manualmente (${
                newGrantPromoter.trim() || 'Ente'
              }${Number(newGrantAmount) > 0 ? ` · Importo: € ${newGrantAmount}` : ''}).`
            : 'Scadenza personalizzata inserita manualmente nello scadenziario ASD.'),
        dueDate: newDate,
        category: newCategory,
        recurrenceLabel: newRecurrenceLabel.trim() || 'Scadenza Manuale',
        promoter: newCategory === 'bandi_contributi' ? newGrantPromoter.trim() : undefined,
        requestedAmount:
          newCategory === 'bandi_contributi' ? Number(newGrantAmount) || 0 : undefined,
      };

      onUpdateProfile({
        ...profile,
        customDeadlines: [customItem, ...(profile.customDeadlines || [])],
      });

      if (newCategory === 'bandi_contributi' && alsoCreateGrant && onAddGrant) {
        onAddGrant({
          title: newTitle.trim(),
          promoter: newGrantPromoter.trim() || 'Ente Promotore',
          submissionDeadline: newDate,
          reportingDeadline: '',
          status: 'in_preparazione',
          requestedAmount: Number(newGrantAmount) || 0,
          approvedAmount: 0,
          keyCharacteristics:
            newDesc.trim() || 'Inserito manualmente dallo scadenziario.',
          usefulContacts: '',
          documents: [],
          notes: `Scadenza inserita manualmente: ${newDate}`,
        });
      }
    }

    setNewTitle('');
    setNewDesc('');
    setEditingCustomId(null);
    setEditingProposedId(null);
    setIsAddModalOpen(false);
  };

  const handleDeleteCustomDeadline = (id: string) => {
    onUpdateProfile({
      ...profile,
      customDeadlines: (profile.customDeadlines || []).filter((c) => c.id !== id),
      completedDeadlineIds: (profile.completedDeadlineIds || []).filter((cid) => cid !== id),
    });
  };

  return (
    <section
      id="dashboard-critical-deadlines-widget"
      className="bg-white rounded-xl border border-slate-200 flex flex-col justify-between overflow-hidden"
    >
      <div>
        {/* Clean Header Bar — Zero walls of text */}
        <div className="px-4 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <CalendarClock className="w-4 h-4 text-emerald-700 shrink-0" />
            <h3 className="font-bold text-slate-900 text-sm tracking-tight truncate">
              Scadenze Annuali &amp; Bandi
            </h3>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              · {summary.completedCount}/{summary.totalDeadlinesCount} completate
            </span>
            {approachingOrUrgentDeadlines.length > 0 && (
              <span
                id="badge-active-visual-alerts-count"
                className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-rose-600"
              >
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>{approachingOrUrgentDeadlines.length} in scadenza</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              id="btn-toggle-date-simulator"
              type="button"
              onClick={() => setShowTimelineDrawer((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1"
              title="Mostra o nascondi la barra temporale dell'anno solare e il simulatore date"
            >
              <span>Timeline Anno</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  showTimelineDrawer ? 'rotate-180' : ''
                }`}
              />
            </button>

            <button
              id="btn-open-add-custom-deadline"
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuova Scadenza</span>
            </button>
          </div>
        </div>

        {/* Collapsible Solar Year Timeline & Simulator Drawer (Hidden by default to keep Dashboard ultra-clean) */}
        {showTimelineDrawer && (
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 space-y-2.5 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold text-slate-700">
                Avanzamento Anno Solare {summary.solarYear} · Giorno {summary.dayOfYear}/
                {summary.totalDaysInYear} ({summary.yearElapsedPercent}%)
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600 mr-0.5" />
                {[
                  { id: 'real', label: 'Oggi' },
                  { id: 'sim_affiliazione', label: 'Sim. Gen (-6gg)' },
                  { id: 'sim_bilancio', label: 'Sim. Apr (-8gg)' },
                  { id: 'sim_fisco_settembre', label: 'Sim. Set (-6gg)' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    id={`btn-sim-deadline-${btn.id}`}
                    type="button"
                    onClick={() => setSimPreset(btn.id as SimulationPresetId)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      simPreset === btn.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative pt-1 pb-1">
              <div
                id="solar-year-progress-bar"
                className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"
              >
                <div
                  style={{ width: `${summary.yearElapsedPercent}%` }}
                  className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                />
              </div>
              <div className="grid grid-cols-12 text-[10px] font-mono text-slate-400 pt-1">
                {MONTHS_SHORT.map((m, idx) => (
                  <div
                    key={m}
                    className={`text-center ${
                      idx === summary.currentMonthIndex ? 'font-bold text-emerald-800' : ''
                    }`}
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compact Filter Bar */}
        <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 p-0.5 bg-slate-200/70 rounded-lg">
            {[
              { id: 'ALL', label: 'Tutte' },
              { id: 'affiliazione_tesserini', label: 'Affiliazione' },
              { id: 'bilancio_governance', label: 'Governance' },
              { id: 'fisco_inps', label: 'Fisco & INPS' },
              { id: 'bandi_contributi', label: 'Bandi' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id as any)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            id="btn-toggle-hide-resolved-deadlines"
            type="button"
            onClick={() => {
              const nextVal = !hideResolved;
              setHideResolved(nextVal);
              onUpdateProfile({ ...profile, hideResolvedDeadlines: nextVal });
            }}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-900 whitespace-nowrap px-2 py-1"
          >
            {hideResolved
              ? `Mostra risolte (${summary.completedCount})`
              : `Nascondi risolte (${summary.completedCount})`}
          </button>
        </div>

        {/* Single-Line Expandable Accordion Rows (Click row to reveal details & buttons) */}
        <div className="divide-y divide-slate-100">
          {visibleDeadlines.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Nessuna scadenza attiva in questa categoria.
            </div>
          ) : (
            visibleDeadlines.map((item) => {
              const catMeta = CATEGORY_META[item.category];
              const alertMeta = getVisualAlertMeta(
                item.daysRemaining,
                item.isCompleted,
                item.temporalProgressPercent
              );
              const isExpanded = expandedDeadlineId === item.id;
              const isUrgent =
                !item.isCompleted &&
                (alertMeta.level === 'overdue' ||
                  alertMeta.level === 'critical' ||
                  alertMeta.level === 'urgent');

              const statusDotClass = item.isCompleted
                ? 'bg-emerald-500'
                : alertMeta.level === 'overdue' || alertMeta.level === 'critical'
                ? 'bg-rose-600 animate-pulse'
                : alertMeta.level === 'urgent'
                ? 'bg-amber-500'
                : catMeta.dotColor;

              const daysText = item.isCompleted
                ? 'Completata ✓'
                : item.daysRemaining < 0
                ? `Scaduta (${Math.abs(item.daysRemaining)} gg)`
                : item.daysRemaining === 0
                ? 'Scade OGGI'
                : `-${item.daysRemaining} gg`;

              return (
                <div
                  key={item.id}
                  className={`transition-colors ${
                    item.isCompleted
                      ? 'bg-slate-50/50 opacity-75'
                      : isUrgent
                      ? 'bg-amber-50/30'
                      : 'bg-white'
                  }`}
                >
                  {/* 1-Line Compact Header Row */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedDeadlineId((prev) => (prev === item.id ? null : item.id))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedDeadlineId((prev) => (prev === item.id ? null : item.id));
                      }
                    }}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleComplete(item.id);
                        }}
                        title={
                          item.isCompleted
                            ? 'Riapri scadenza'
                            : 'Segna scadenza come completata'
                        }
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          item.isCompleted
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white border-slate-300 hover:border-emerald-600 text-transparent'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </button>

                      <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass}`} />

                      <span
                        className={`text-xs font-semibold truncate ${
                          item.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 text-xs">
                      <span className="text-slate-500 font-mono text-[11px] hidden sm:inline tabular-nums">
                        {item.dueDateLabel.split(' (')[0]}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-bold tabular-nums min-w-[68px] text-right ${
                          item.isCompleted
                            ? 'text-emerald-700'
                            : alertMeta.level === 'overdue' || alertMeta.level === 'critical'
                            ? 'text-rose-600'
                            : alertMeta.level === 'urgent'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {daysText}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details & Action Buttons Drawer (Only visible on click) */}
                  {isExpanded && (
                    <div className="px-4 pb-3.5 pt-1 bg-slate-50/80 border-t border-slate-100 space-y-2.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-700">{catMeta.label}</span>
                        <span>·</span>
                        <span className="font-mono">{item.dueDateLabel}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {formatRemainingTimeHuman(item.daysRemaining, item.isCompleted)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleToggleComplete(item.id)}
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                              item.isCompleted
                                ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            {item.isCompleted ? 'Riapri Scadenza' : 'Segna Completata ✓'}
                          </button>

                          <button
                            id={`btn-resolve-note-${item.id}`}
                            type="button"
                            onClick={() => {
                              setEditingActionItemId(
                                editingActionItemId === item.id &&
                                  editingActionMode === 'resolve'
                                  ? null
                                  : item.id
                              );
                              setEditingActionMode('resolve');
                              setActionNoteText(
                                profile.deadlineOverrides?.[item.id]?.resolutionNote ||
                                  'Risolto: '
                              );
                            }}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
                          >
                            Nota / Risolto
                          </button>

                          <button
                            id={`btn-postpone-date-${item.id}`}
                            type="button"
                            onClick={() => {
                              setEditingActionItemId(
                                editingActionItemId === item.id &&
                                  editingActionMode === 'postpone'
                                  ? null
                                  : item.id
                              );
                              setEditingActionMode('postpone');
                              setActionPostponeDate(item.dueDate);
                              setActionNoteText(
                                profile.deadlineOverrides?.[item.id]?.resolutionNote || ''
                              );
                            }}
                            className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
                          >
                            Rimanda
                          </button>

                          <button
                            id={`btn-edit-any-deadline-${item.id}`}
                            type="button"
                            onClick={() =>
                              item.isCustom
                                ? openEditCustomDeadline(item.id)
                                : openEditProposedDeadline(item)
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
                            title="Modifica titolo, data annuale fissa o descrizione di questa scadenza"
                          >
                            <Edit3 className="w-3 h-3 text-slate-500" />
                            <span>Modifica / Cambia Data</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {item.isCustom ? (
                            <button
                              id={`btn-delete-custom-deadline-${item.id}`}
                              type="button"
                              onClick={() => handleDeleteCustomDeadline(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                              title="Elimina scadenza manuale"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              id={`btn-hide-proposed-deadline-${item.id}`}
                              type="button"
                              onClick={() => handleHideProposedDeadline(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                              title="Nascondi questa scadenza proposta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setActiveTab(item.actionTab)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                          >
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Editor for Resolution Note or Postponing */}
                      {editingActionItemId === item.id && (
                        <div className="mt-2 p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-xs">
                          {editingActionMode === 'resolve' ? (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                id={`input-resolve-note-${item.id}`}
                                type="text"
                                placeholder="Es. Risolto: verbale caricato su Drive..."
                                value={actionNoteText}
                                onChange={(e) => setActionNoteText(e.target.value)}
                                className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                              />
                              <button
                                id={`btn-confirm-resolve-${item.id}`}
                                type="button"
                                onClick={() => handleSaveResolveWithNote(item.id)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shrink-0"
                              >
                                Conferma ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingActionItemId(null)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-medium"
                              >
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  id={`input-postpone-date-${item.id}`}
                                  type="date"
                                  value={actionPostponeDate}
                                  onChange={(e) => setActionPostponeDate(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                                />
                                <input
                                  type="text"
                                  placeholder="Nota opzionale sul rinvio..."
                                  value={actionNoteText}
                                  onChange={(e) => setActionNoteText(e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                                />
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  id={`btn-confirm-postpone-${item.id}`}
                                  type="button"
                                  onClick={() => handleSavePostponeDate(item.id)}
                                  className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                                >
                                  Salva Data
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingActionItemId(null)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-medium"
                                >
                                  Annulla
                                </button>
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
      </div>

      {/* Compact Footer Bar */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          {selectedCategory === 'ALL' && filteredDeadlines.length > 6 && (
            <button
              id="btn-toggle-expand-all-deadlines"
              type="button"
              onClick={() => setIsAllDeadlinesExpanded((prev) => !prev)}
              className="font-semibold text-slate-700 hover:text-slate-900"
            >
              {isAllDeadlinesExpanded
                ? 'Mostra solo le prime 6 ▴'
                : `Mostra tutte (${filteredDeadlines.length}) ▾`}
            </button>
          )}
          {hiddenProposedCount > 0 && (
            <button
              type="button"
              onClick={handleRestoreHiddenProposedDeadlines}
              className="text-[11px] font-medium text-amber-800 hover:underline"
            >
              Ripristina {hiddenProposedCount} nascoste
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
        >
          <span>Tutte le Notifiche</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Modal to Add or Edit a Deadline (Proposed Statutory or Manual Custom) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                {editingProposedId
                  ? 'Modifica Scadenza / Cambia Data Annuale'
                  : editingCustomId
                  ? 'Modifica Scadenza Manuale'
                  : 'Nuova Scadenza Manuale'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomDeadline} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Categoria *</label>
                <select
                  id="select-custom-deadline-category"
                  value={newCategory}
                  onChange={(e) => {
                    const cat = e.target.value as CriticalDeadlineCategory;
                    setNewCategory(cat);
                    if (cat === 'bandi_contributi') {
                      setNewRecurrenceLabel('Bando / Contributo');
                    } else if (cat === 'fisco_inps') {
                      setNewRecurrenceLabel('Adempimento Fiscale');
                    } else if (cat === 'affiliazione_tesserini') {
                      setNewRecurrenceLabel('Affiliazione / Tesserini');
                    } else {
                      setNewRecurrenceLabel('Governance / Altro');
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                >
                  <option value="bandi_contributi">Bando / Contributo / Rendicontazione</option>
                  <option value="fisco_inps">Scadenza Fiscale (Agenzia Entrate, INPS, CU)</option>
                  <option value="affiliazione_tesserini">
                    Affiliazione US ACLI o Tesserini Istruttori
                  </option>
                  <option value="bilancio_governance">
                    Assemblea Soci, Governance o Convenzioni
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Titolo Scadenza *</label>
                <input
                  id="input-custom-deadline-title"
                  type="text"
                  required
                  placeholder="Es. Riunione Annuale Soci / Bando Sport 2027..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Data Scadenza *</label>
                  <input
                    id="input-custom-deadline-date"
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Etichetta</label>
                  <input
                    id="input-custom-deadline-recurrence"
                    type="text"
                    placeholder="Es. Data Annuale ASD / Bando"
                    value={newRecurrenceLabel}
                    onChange={(e) => setNewRecurrenceLabel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                  />
                </div>
              </div>

              {!editingCustomId &&
                !editingProposedId &&
                newCategory === 'bandi_contributi' &&
                onAddGrant && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                      <input
                        id="checkbox-custom-deadline-create-grant"
                        type="checkbox"
                        checked={alsoCreateGrant}
                        onChange={(e) => setAlsoCreateGrant(e.target.checked)}
                        className="rounded border-amber-400 text-emerald-700"
                      />
                      <span>Crea scheda anche in &quot;Bandi &amp; Progetti&quot;</span>
                    </label>
                    {alsoCreateGrant && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <input
                          type="text"
                          value={newGrantPromoter}
                          onChange={(e) => setNewGrantPromoter(e.target.value)}
                          placeholder="Ente Erogatore"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-slate-900"
                        />
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={newGrantAmount}
                          onChange={(e) => setNewGrantAmount(e.target.value)}
                          placeholder="Importo (€)"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white font-mono text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">Note / Dettagli</label>
                <textarea
                  id="textarea-custom-deadline-desc"
                  rows={2}
                  placeholder="Dettagli o documenti da preparare..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Annulla
                </button>
                <button
                  id="btn-save-custom-deadline"
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                >
                  {editingProposedId || editingCustomId ? 'Salva Modifiche' : 'Salva Scadenza'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
