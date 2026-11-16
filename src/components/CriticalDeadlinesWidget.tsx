import React, { useState, useMemo } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Plus,
  ArrowRight,
  Award,
  ShieldCheck,
  Landmark,
  FileCheck2,
  Trash2,
  Edit3,
  X,
  BellRing,
  Sparkles,
} from 'lucide-react';
import {
  AssemblyMeeting,
  AssociationProfile,
  AssociationRole,
  CriticalDeadlineCategory,
  CustomCriticalDeadline,
  DeadlineOverrideRecord,
  GrantItem,
} from '../types';
import {
  buildCriticalYearDeadlines,
  formatRemainingTimeHuman,
  getVisualAlertMeta,
} from '../utils/criticalDeadlines';
import { NavTab } from './Sidebar';

interface CriticalDeadlinesWidgetProps {
  profile: AssociationProfile;
  assemblies: AssemblyMeeting[];
  grants: GrantItem[];
  roles: AssociationRole[];
  onUpdateProfile: (profile: AssociationProfile) => void;
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
  { label: string; shortLabel: string; badgeClass: string }
> = {
  fisco_inps: {
    label: 'Scadenze Fiscali (Agenzia Entrate & INPS)',
    shortLabel: 'Scadenze Fiscali',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  affiliazione_tesserini: {
    label: 'Affiliazione US ACLI & Tesserini',
    shortLabel: 'Affiliazione & Tesserini',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  bilancio_governance: {
    label: 'Assemblea di Bilancio & Governance',
    shortLabel: 'Bilancio & Governance',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  bandi_contributi: {
    label: 'Scadenze Bandi & Rendicontazioni',
    shortLabel: 'Bandi & Progetti',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
};

type SimulationPresetId = 'real' | 'sim_affiliazione' | 'sim_bilancio' | 'sim_fisco_settembre';

export const CriticalDeadlinesWidget: React.FC<CriticalDeadlinesWidgetProps> = ({
  profile,
  assemblies,
  grants,
  roles,
  onUpdateProfile,
  onAddGrant,
  setActiveTab,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | CriticalDeadlineCategory>('ALL');
  const [simPreset, setSimPreset] = useState<SimulationPresetId>('real');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDate, setNewDate] = useState('2027-12-31');
  const [newCategory, setNewCategory] = useState<CriticalDeadlineCategory>('bandi_contributi');
  const [newRecurrenceLabel, setNewRecurrenceLabel] = useState('Bando / Scadenza Fissa');
  const [alsoCreateGrant, setAlsoCreateGrant] = useState<boolean>(true);
  const [newGrantPromoter, setNewGrantPromoter] = useState<string>('Regione / Ente Erogatore');
  const [newGrantAmount, setNewGrantAmount] = useState<string>('5000');

  // Inline Resolve with Note or Postpone Date state per deadline card
  const [editingActionItemId, setEditingActionItemId] = useState<string | null>(null);
  const [editingActionMode, setEditingActionMode] = useState<'resolve' | 'postpone'>('resolve');
  const [actionNoteText, setActionNoteText] = useState<string>('');
  const [actionPostponeDate, setActionPostponeDate] = useState<string>('');
  const [hideResolved, setHideResolved] = useState<boolean>(
    Boolean(profile.hideResolvedDeadlines)
  );

  const effectiveReferenceDate = useMemo(() => {
    if (simPreset === 'sim_affiliazione') {
      return new Date(profile.activeYear, 0, 25); // 25 Jan (-6 gg da Affiliazione US ACLI 31 Gen)
    }
    if (simPreset === 'sim_bilancio') {
      return new Date(profile.activeYear, 3, 22); // 22 Apr (-8 gg da Assemblea Bilancio 30 Apr)
    }
    if (simPreset === 'sim_fisco_settembre') {
      return new Date(profile.activeYear, 7, 30); // 30 Ago (-6 gg da Agenzia Entrate 5 Set)
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

  // Next active deadline for each of the 3 statutory pillars requested by the user:
  // 1) Affiliazione, 2) Bilancio, 3) Scadenze Fiscali
  const statutoryPillars = useMemo(() => {
    const findNextForCategory = (cat: CriticalDeadlineCategory) =>
      deadlines.find((d) => d.category === cat && !d.isCompleted) ||
      deadlines.find((d) => d.category === cat);

    return [
      {
        id: 'pillar-affiliazione',
        category: 'affiliazione_tesserini' as CriticalDeadlineCategory,
        pillarTitle: '1. Affiliazione & Tesserini',
        pillarSubtitle: 'Rinnovo US ACLI, RASD & Tesserini Tecnici',
        icon: Award,
        accentColor: 'emerald',
        item: findNextForCategory('affiliazione_tesserini'),
      },
      {
        id: 'pillar-bilancio',
        category: 'bilancio_governance' as CriticalDeadlineCategory,
        pillarTitle: '2. Bilancio & Governance',
        pillarSubtitle: 'Assemblea Rendiconto & Safeguarding',
        icon: ShieldCheck,
        accentColor: 'purple',
        item: findNextForCategory('bilancio_governance'),
      },
      {
        id: 'pillar-fisco',
        category: 'fisco_inps' as CriticalDeadlineCategory,
        pillarTitle: '3. Scadenze Fiscali & INPS',
        pillarSubtitle: 'INPS Mensile, CU & Agenzia Entrate',
        icon: Landmark,
        accentColor: 'blue',
        item: findNextForCategory('fisco_inps'),
      },
    ];
  }, [deadlines]);

  const [isAllDeadlinesExpanded, setIsAllDeadlinesExpanded] = useState(false);
  const [showSimulatorBar, setShowSimulatorBar] = useState(false);

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
    return filteredDeadlines.slice(0, 4);
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
      deadlineId,
      customDueDate: existing?.customDueDate,
      resolutionNote: actionNoteText.trim() || 'Risolto e archiviato',
      isCompleted: true,
      updatedAt: new Date().toISOString().slice(0, 10),
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
      deadlineId,
      customDueDate: actionPostponeDate,
      resolutionNote:
        actionNoteText.trim() ||
        existing?.resolutionNote ||
        `Rimandata al ${actionPostponeDate}`,
      isCompleted: false,
      updatedAt: new Date().toISOString().slice(0, 10),
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

  const handleAddCustomDeadline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;

    if (editingCustomId) {
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
        id: `custom-dl-${Date.now()}`,
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
      className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
    >
      {/* Top Header Strip */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold uppercase tracking-wider">
              <CalendarClock className="w-3 h-3 text-emerald-700" />
              Scadenziario Solare ASD · Timeline & Avvisi Visivi
            </span>
            {approachingOrUrgentDeadlines.length > 0 && (
              <span
                id="badge-active-visual-alerts-count"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-rose-600 text-white font-mono text-[10px] font-bold uppercase shadow-2xs"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <span>
                  {approachingOrUrgentDeadlines.length}{' '}
                  {approachingOrUrgentDeadlines.length === 1
                    ? 'Avviso Visivo Attivo (Data in Avvicinamento)'
                    : 'Avvisi Visivi Attivi (Date in Avvicinamento)'}
                </span>
              </span>
            )}
          </div>
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight">
            Scadenze Critiche (Affiliazione, Bilancio, Scadenze Fiscali, Bandi & Manuali)
          </h3>
          <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
            Monitoraggio in tempo reale di quanto manca a ciascuna scadenza obbligatoria o
            inserita manualmente:{' '}
            <strong>Rinnovo Affiliazione US ACLI</strong>,{' '}
            <strong>Assemblea di Bilancio</strong>,{' '}
            <strong>Scadenze Fiscali (Agenzia Entrate Settembre, CU e INPS Mensile)</strong>,{' '}
            <strong>Rinnovo Tesserini Istruttori</strong>, <strong>Nuovi Bandi</strong> (es.
            scadenza Dicembre 2027) e qualsiasi altro promemoria personalizzato.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            id="btn-open-add-custom-deadline"
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Inserisci Scadenza Manuale (Bando o Altro)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            <span>Centro Alert Completo</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* VISUAL ALERT SYSTEM BANNER WHEN DEADLINES ARE APPROACHING */}
      {approachingOrUrgentDeadlines.length > 0 && (
        <div
          id="critical-deadlines-visual-alert-banner"
          className={`px-5 py-3.5 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
            summary.urgentOrOverdueCount > 0
              ? 'bg-amber-50/90 border-amber-300 text-amber-950'
              : 'bg-blue-50/70 border-blue-200 text-slate-900'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white shadow-2xs ${
                summary.urgentOrOverdueCount > 0 ? 'bg-amber-600' : 'bg-blue-600'
              }`}
            >
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-xs sm:text-sm">
                  Sistema di Avvisi Visivi — Scadenze in Avvicinamento:
                </span>
                <span className="px-2 py-0.5 rounded-sm bg-rose-600 text-white font-mono text-[10px] font-bold uppercase">
                  {summary.urgentOrOverdueCount > 0
                    ? `${summary.urgentOrOverdueCount} Entro 20 Giorni`
                    : `${approachingOrUrgentDeadlines.length} in Finestra di Preavviso`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {approachingOrUrgentDeadlines.slice(0, 4).map((dl) => {
                  const alertMeta = getVisualAlertMeta(
                    dl.daysRemaining,
                    dl.isCompleted,
                    dl.temporalProgressPercent
                  );
                  return (
                    <button
                      key={`alert-chip-${dl.id}`}
                      type="button"
                      onClick={() => setActiveTab(dl.actionTab)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                        alertMeta.level === 'overdue' || alertMeta.level === 'critical'
                          ? 'bg-rose-100 hover:bg-rose-200 text-rose-950 border-rose-300'
                          : alertMeta.level === 'urgent'
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300'
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                      }`}
                    >
                      {alertMeta.isPulsing && (
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                      )}
                      <span className="truncate max-w-[230px]">{dl.title}</span>
                      <span className="font-mono font-extrabold underline">
                        ({dl.daysRemaining <= 0 ? 'OGGI/SCADUTA' : `-${dl.daysRemaining} gg`})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Discreet Toggle for Date Simulation Bar (Soluzione 4) */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              id="btn-toggle-date-simulator"
              type="button"
              onClick={() => setShowSimulatorBar((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white border border-amber-200/80 text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
              title="Mostra o nascondi il simulatore di date per testare gli avvisi in avvicinamento"
            >
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>{showSimulatorBar ? 'Chiudi Simulatore' : 'Simula date'}</span>
            </button>

            {showSimulatorBar && (
              <div className="flex flex-wrap items-center gap-1 bg-white/95 p-1 rounded-lg border border-amber-200/80 text-[11px] animate-in fade-in duration-150">
                {[
                  { id: 'real', label: 'Data Reale Oggi' },
                  { id: 'sim_affiliazione', label: 'Pre-Affiliazione (-6 gg)' },
                  { id: 'sim_bilancio', label: 'Pre-Bilancio (-8 gg)' },
                  { id: 'sim_fisco_settembre', label: 'Pre-Fisco Set (-6 gg)' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    id={`btn-sim-deadline-${btn.id}`}
                    type="button"
                    onClick={() => setSimPreset(btn.id as SimulationPresetId)}
                    className={`px-2 py-1 rounded-md font-semibold transition-colors ${
                      simPreset === btn.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3 STATUTORY PILLARS FOCUS STRIP: 1. Affiliazione, 2. Bilancio, 3. Scadenze Fiscali */}
      <div
        id="critical-deadlines-pillars-strip"
        className="p-5 bg-slate-50/50 border-b border-slate-200/80 grid grid-cols-1 lg:grid-cols-3 gap-3.5"
      >
        {statutoryPillars.map((pillar) => {
          const IconComp = pillar.icon;
          const dl = pillar.item;
          if (!dl) return null;

          const alertMeta = getVisualAlertMeta(
            dl.daysRemaining,
            dl.isCompleted,
            dl.temporalProgressPercent
          );

          const isClose =
            !dl.isCompleted &&
            (alertMeta.level === 'overdue' ||
              alertMeta.level === 'critical' ||
              alertMeta.level === 'urgent');

          const barColor = dl.isCompleted
            ? 'bg-emerald-600'
            : alertMeta.level === 'overdue' || alertMeta.level === 'critical'
            ? 'bg-rose-600'
            : alertMeta.level === 'urgent'
            ? 'bg-amber-500'
            : alertMeta.level === 'approaching'
            ? 'bg-blue-600'
            : 'bg-teal-600';

          return (
            <div
              key={pillar.id}
              onClick={() => setSelectedCategory(pillar.category)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setSelectedCategory(pillar.category);
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                isClose
                  ? 'bg-amber-50/60 border-amber-300 ring-1 ring-amber-300/70 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900">
                        {pillar.pillarTitle}
                      </div>
                      <div className="text-[10px] text-slate-500">{pillar.pillarSubtitle}</div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono text-[10px] font-extrabold uppercase ${
                      dl.isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : alertMeta.level === 'overdue' || alertMeta.level === 'critical'
                        ? 'bg-rose-600 text-white'
                        : alertMeta.level === 'urgent'
                        ? 'bg-amber-500 text-slate-950'
                        : alertMeta.level === 'approaching'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {alertMeta.isPulsing && (
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                    )}
                    <span>{alertMeta.badgeText}</span>
                  </span>
                </div>

                <div className="pt-1">
                  <div className="text-xs font-bold text-slate-900 line-clamp-1">
                    Prossima: {dl.title}
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium flex items-center justify-between mt-0.5">
                    <span>Scadenza: {dl.dueDateLabel}</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatRemainingTimeHuman(dl.daysRemaining, dl.isCompleted)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pillar Temporal Progress Bar */}
              <div className="space-y-1 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Barra temporale avvicinamento</span>
                  <span className="font-mono font-bold text-slate-800">
                    {dl.temporalProgressPercent}% trascorso · {alertMeta.remainingWindowPercent}%
                    residuo
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${dl.temporalProgressPercent}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Temporal Progress Bars Section (Solar Year Timeline + Monthly INPS + Completion Rate) */}
      <div className="p-5 bg-white border-b border-slate-100 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 1. Main Solar Year Temporal Progress Bar (Jan -> Dec with Milestone Pins) */}
          <div className="lg:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>
                  Barra di Avanzamento Temporale Anno Solare ({summary.solarYear})
                </span>
              </div>
              <span className="font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-sm text-[11px]">
                Giorno {summary.dayOfYear}/{summary.totalDaysInYear} ({summary.yearElapsedPercent}%
                trascorso · mancano {summary.totalDaysInYear - summary.dayOfYear} gg a fine anno)
              </span>
            </div>

            {/* Progress Track with Milestone Markers */}
            <div className="relative pt-1 pb-1">
              <div
                id="solar-year-progress-bar"
                className="w-full h-3 bg-slate-200 rounded-full overflow-hidden relative"
              >
                <div
                  style={{ width: `${summary.yearElapsedPercent}%` }}
                  className="h-full bg-linear-to-r from-emerald-600 via-teal-600 to-amber-500 rounded-full transition-all duration-500"
                />
              </div>

              {/* Milestone Dots along the 12-month bar */}
              {deadlines.slice(0, 8).map((dl) => (
                <div
                  key={`pin-${dl.id}`}
                  style={{ left: `${Math.min(98, Math.max(2, dl.yearPositionPercent))}%` }}
                  title={`${dl.title} — ${dl.dueDateLabel} (${formatRemainingTimeHuman(
                    dl.daysRemaining,
                    dl.isCompleted
                  )})`}
                  className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-xs absolute top-1.5 -translate-x-1/2 pointer-events-auto cursor-help ${
                    dl.isCompleted
                      ? 'bg-emerald-600'
                      : dl.status === 'urgent' || dl.status === 'overdue'
                      ? 'bg-rose-600 animate-pulse'
                      : 'bg-slate-800'
                  }`}
                />
              ))}
            </div>

            {/* 12 Months Axis Labels */}
            <div className="grid grid-cols-12 text-[10px] font-mono text-slate-500 pt-0.5">
              {MONTHS_SHORT.map((m, idx) => (
                <div
                  key={m}
                  className={`text-center ${
                    idx === summary.currentMonthIndex
                      ? 'font-extrabold text-emerald-800 underline'
                      : ''
                  }`}
                >
                  {m}
                </div>
              ))}
            </div>

            {/* Key Annual Milestones Legend */}
            <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <strong>Gen:</strong> Affiliazione US ACLI
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-600" />
                <strong>Apr:</strong> Assemblea Bilancio
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <strong>Inizio Set:</strong> Agenzia Entrate & Tessera 365
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                <strong>Fine Mese:</strong> INPS Lavoro Sportivo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <strong>Dic:</strong> Tesserini Istruttori
              </span>
            </div>
          </div>

          {/* 2. Monthly INPS Countdown Bar & Annual Completion Progress */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-3">
            {/* Monthly INPS Lavoro Sportivo Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <Landmark className="w-3.5 h-3.5 text-blue-600" />
                  INPS Lavoro Sportivo (Fine {summary.currentMonthName})
                </span>
                <span className="font-mono text-[11px] font-bold text-blue-800">
                  Mancano {summary.daysLeftInMonth} gg ({summary.endOfCurrentMonthLabel})
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  style={{ width: `${summary.monthElapsedPercent}%` }}
                  className={`h-full rounded-full transition-all ${
                    summary.daysLeftInMonth <= 7
                      ? 'bg-rose-600'
                      : summary.daysLeftInMonth <= 20
                      ? 'bg-amber-500'
                      : 'bg-blue-600'
                  }`}
                />
              </div>
            </div>

            {/* Overall Annual Deadlines Completion Bar */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200/70">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                  Adempimenti Completati
                </span>
                <span className="font-mono text-[11px] font-bold text-emerald-800">
                  {summary.completedCount}/{summary.totalDeadlinesCount} (
                  {summary.completionRatePercent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  style={{ width: `${summary.completionRatePercent}%` }}
                  className="h-full bg-emerald-600 rounded-full transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
          {[
            { id: 'ALL', label: `Tutte le Scadenze (${deadlines.length})` },
            {
              id: 'affiliazione_tesserini',
              label: `Affiliazione US ACLI & Tesserini (${
                deadlines.filter((d) => d.category === 'affiliazione_tesserini').length
              })`,
            },
            {
              id: 'bilancio_governance',
              label: `Assemblea Bilancio & Governance (${
                deadlines.filter((d) => d.category === 'bilancio_governance').length
              })`,
            },
            {
              id: 'fisco_inps',
              label: `Scadenze Fiscali: Agenzia Entrate & INPS (${
                deadlines.filter((d) => d.category === 'fisco_inps').length
              })`,
            },
            {
              id: 'bandi_contributi',
              label: `Scadenze Bandi (${
                deadlines.filter((d) => d.category === 'bandi_contributi').length
              })`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            id="btn-toggle-hide-resolved-deadlines"
            type="button"
            onClick={() => {
              const nextVal = !hideResolved;
              setHideResolved(nextVal);
              onUpdateProfile({ ...profile, hideResolvedDeadlines: nextVal });
            }}
            className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
              hideResolved
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {hideResolved
              ? `Mostra anche Risolte (${summary.completedCount})`
              : `Nascondi Scadenze Risolte (${summary.completedCount})`}
          </button>
        </div>
      </div>

      {/* Deadlines Cards Grid with Individual Temporal Progress Bars & Visual Warnings (Focus Mode: Top 4 by default) */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-50/40">
        {visibleDeadlines.map((item) => {
          const catMeta = CATEGORY_META[item.category];
          const alertMeta = getVisualAlertMeta(
            item.daysRemaining,
            item.isCompleted,
            item.temporalProgressPercent
          );

          const isHighAlert =
            !item.isCompleted &&
            (alertMeta.level === 'overdue' ||
              alertMeta.level === 'critical' ||
              alertMeta.level === 'urgent');
          const isApproachingAlert =
            !item.isCompleted && alertMeta.level === 'approaching';

          const barColorClass = item.isCompleted
            ? 'bg-emerald-600'
            : alertMeta.level === 'overdue' || alertMeta.level === 'critical'
            ? 'bg-rose-600'
            : alertMeta.level === 'urgent'
            ? 'bg-amber-500'
            : alertMeta.level === 'approaching'
            ? 'bg-blue-600'
            : 'bg-teal-600';

          const humanCountdown = formatRemainingTimeHuman(
            item.daysRemaining,
            item.isCompleted
          );

          return (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                item.isCompleted
                  ? 'bg-emerald-50/30 border-emerald-200/80 opacity-85'
                  : isHighAlert
                  ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-300/60 shadow-xs'
                  : isApproachingAlert
                  ? 'bg-blue-50/20 border-blue-200 shadow-2xs'
                  : 'bg-white border-slate-200 shadow-2xs'
              }`}
            >
              <div className="space-y-2">
                {/* Top Badges Row with Visual Alert Indicator */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border ${catMeta.badgeClass}`}
                    >
                      {catMeta.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                      {item.dueDateLabel}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 font-mono text-[11px] font-extrabold px-2.5 py-0.5 rounded-sm ${
                      item.isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : alertMeta.level === 'overdue' || alertMeta.level === 'critical'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : alertMeta.level === 'urgent'
                        ? 'bg-amber-200 text-amber-950 border border-amber-400'
                        : alertMeta.level === 'approaching'
                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {alertMeta.isPulsing && (
                      <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                    )}
                    <span>{alertMeta.badgeText}</span>
                  </span>
                </div>

                {/* Title & Description */}
                <div className="flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleComplete(item.id)}
                    title={
                      item.isCompleted
                        ? 'Clicca per riaprire la scadenza'
                        : 'Clicca per segnare la scadenza come completata'
                    }
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      item.isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white border-slate-300 hover:border-emerald-600 text-transparent'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <h4
                      className={`font-bold text-xs sm:text-sm leading-snug ${
                        item.isCompleted ? 'line-through text-slate-500' : 'text-slate-900'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Per-Deadline Temporal Progress Bar Showing Explicitly How Much Time Remains */}
              <div className="pt-2.5 border-t border-slate-100 space-y-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap">
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>Quanto manca:</span>
                      <strong
                        className={
                          isHighAlert
                            ? 'text-rose-700 font-extrabold'
                            : 'text-slate-900 font-bold'
                        }
                      >
                        {humanCountdown}
                      </strong>
                    </span>
                    <span className="font-mono text-[10px] font-bold text-slate-600">
                      Avanzamento: {item.temporalProgressPercent}%
                      {!item.isCompleted &&
                        ` (${alertMeta.remainingWindowPercent}% tempo residuo)`}
                    </span>
                  </div>

                  {/* Segmented Temporal Progress Bar with 75% Preavviso & 90% Critico markers */}
                  <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${item.temporalProgressPercent}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${barColorClass}`}
                    />
                    <div
                      style={{ left: '75%' }}
                      className="absolute top-0 bottom-0 w-px bg-white/70"
                      title="Soglia Preavviso (75%)"
                    />
                    <div
                      style={{ left: '90%' }}
                      className="absolute top-0 bottom-0 w-px bg-white/90"
                      title="Soglia Allerta Critica (90%)"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(item.id)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors ${
                        item.isCompleted
                          ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {item.isCompleted ? 'Riapri Scadenza' : 'Segna Completata ✓'}
                    </button>

                    <button
                      id={`btn-resolve-note-${item.id}`}
                      type="button"
                      onClick={() => {
                        setEditingActionItemId(
                          editingActionItemId === item.id && editingActionMode === 'resolve'
                            ? null
                            : item.id
                        );
                        setEditingActionMode('resolve');
                        setActionNoteText(
                          profile.deadlineOverrides?.[item.id]?.resolutionNote || 'Risolto: '
                        );
                      }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
                    >
                      Digita Risolto / Nota
                    </button>

                    <button
                      id={`btn-postpone-date-${item.id}`}
                      type="button"
                      onClick={() => {
                        setEditingActionItemId(
                          editingActionItemId === item.id && editingActionMode === 'postpone'
                            ? null
                            : item.id
                        );
                        setEditingActionMode('postpone');
                        setActionPostponeDate(item.dueDate);
                        setActionNoteText(
                          profile.deadlineOverrides?.[item.id]?.resolutionNote || ''
                        );
                      }}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 transition-colors"
                    >
                      Rimanda Data
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.isCustom && (
                      <>
                        <button
                          id={`btn-edit-custom-deadline-${item.id}`}
                          type="button"
                          onClick={() => openEditCustomDeadline(item.id)}
                          className="p-1 text-slate-500 hover:text-emerald-700 rounded-md hover:bg-emerald-50 transition-colors"
                          title="Modifica scadenza inserita manualmente"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-delete-custom-deadline-${item.id}`}
                          type="button"
                          onClick={() => handleDeleteCustomDeadline(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                          title="Elimina scadenza inserita manualmente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveTab(item.actionTab)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
                    >
                      <span>{item.actionLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Inline Editor for Typing Resolution Note or Postponing to Another Date */}
                {editingActionItemId === item.id && (
                  <div className="mt-2 p-3 rounded-xl bg-slate-100 border border-slate-300 space-y-2 text-xs">
                    {editingActionMode === 'resolve' ? (
                      <>
                        <div className="font-bold text-slate-800">
                          Digita esito o nota di risoluzione (farà scomparire l&apos;avviso di scadenza):
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            id={`input-resolve-note-${item.id}`}
                            type="text"
                            placeholder="Es. Risolto: inviato F24 / verbale caricato su Drive..."
                            value={actionNoteText}
                            onChange={(e) => setActionNoteText(e.target.value)}
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                          />
                          <button
                            id={`btn-confirm-resolve-${item.id}`}
                            type="button"
                            onClick={() => handleSaveResolveWithNote(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shrink-0"
                          >
                            Conferma Risolto ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingActionItemId(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 font-semibold"
                          >
                            Annulla
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-bold text-slate-800">
                          Rimanda / Posticipa la scadenza a un&apos;altra data:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              Nuova Data Scadenza:
                            </label>
                            <input
                              id={`input-postpone-date-${item.id}`}
                              type="date"
                              value={actionPostponeDate}
                              onChange={(e) => setActionPostponeDate(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              Nota opzionale sul rinvio:
                            </label>
                            <input
                              type="text"
                              placeholder="Es. Proroga o nuova convocazione..."
                              value={actionNoteText}
                              onChange={(e) => setActionNoteText(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            id={`btn-confirm-postpone-${item.id}`}
                            type="button"
                            onClick={() => handleSavePostponeDate(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold"
                          >
                            Salva Nuova Data
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingActionItemId(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 font-semibold"
                          >
                            Annulla
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expand / Collapse All Deadlines Footer Bar (Soluzione 4) */}
      {selectedCategory === 'ALL' && filteredDeadlines.length > 4 && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-600 font-medium">
            {isAllDeadlinesExpanded
              ? `Visualizzate tutte le ${filteredDeadlines.length} scadenze attive dell'anno.`
              : `Modalità Focus: mostrate le 4 scadenze più vicine su ${filteredDeadlines.length} totali.`}
          </span>
          <button
            id="btn-toggle-expand-all-deadlines"
            type="button"
            onClick={() => setIsAllDeadlinesExpanded((prev) => !prev)}
            className="px-3.5 py-1.5 rounded-lg font-bold text-emerald-900 bg-emerald-100/80 hover:bg-emerald-200/80 border border-emerald-300 transition-colors"
          >
            {isAllDeadlinesExpanded
              ? 'Riduci alle 4 scadenze principali ▴'
              : `Mostra tutte le ${filteredDeadlines.length} scadenze dell'anno ▾`}
          </button>
        </div>
      )}

      {/* Modal to Add or Edit a Manual Deadline (e.g. Nuovo Bando scadenza Dicembre 2027 or other custom deadline) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  {editingCustomId
                    ? 'Modifica Scadenza Inserita Manualmente'
                    : 'Inserisci Nuova Scadenza Manuale (Bando, Fisco o Altro)'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  La scadenza comparirà sia nello Scadenziario della Dashboard sia in &quot;Scadenze &amp; Notifiche&quot;.
                </p>
              </div>
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
                <label className="block text-slate-700 font-bold mb-1">
                  Categoria / Tipo di Scadenza *
                </label>
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
                  id="input-custom-deadline-title"
                  type="text"
                  required
                  placeholder="Es. Bando Sport e Natura 2027 / Rinnovo Convenzione / Altro..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
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
                      id="input-custom-deadline-date"
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      Etichetta / Ricorrenza
                    </label>
                    <input
                      id="input-custom-deadline-recurrence"
                      type="text"
                      placeholder="Es. Bando / Una tantum / Annuale"
                      value={newRecurrenceLabel}
                      onChange={(e) => setNewRecurrenceLabel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900"
                    />
                  </div>
                </div>

                {/* Quick Date Presets including Dicembre 2027 */}
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
                      onClick={() => setNewDate(preset.date)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors ${
                        newDate === preset.date
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional automatic creation in Bandi & Progetti when category is bandi_contributi */}
              {!editingCustomId && newCategory === 'bandi_contributi' && onAddGrant && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                    <input
                      id="checkbox-custom-deadline-create-grant"
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
                          value={newGrantPromoter}
                          onChange={(e) => setNewGrantPromoter(e.target.value)}
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
                          value={newGrantAmount}
                          onChange={(e) => setNewGrantAmount(e.target.value)}
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
                  id="textarea-custom-deadline-desc"
                  rows={2}
                  placeholder="Es. Preparare preventivo spese, allegati tecnici e relazione per invio entro dicembre 2027..."
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
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-2xs"
                >
                  {editingCustomId ? 'Salva Modifiche Scadenza' : 'Salva Scadenza Manuale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
