import React, { useState, useMemo } from 'react';
import {
  Repeat,
  Plus,
  CheckCircle2,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  Layers,
} from 'lucide-react';
import {
  CashCategory,
  CashTransaction,
  PaymentMethod,
  RecurringExpenseDurationMode,
  RecurringExpenseFrequency,
  RecurringExpensePlan,
} from '../types';
import {
  evaluateRecurringExpensePlans,
  buildTransactionFromOccurrence,
  FREQUENCY_LABELS,
  RecurringExpenseOccurrence,
} from '../utils/recurringExpenses';
import { formatEuro } from '../utils/finance';

interface RecurringExpensesPanelProps {
  recurringExpenses: RecurringExpensePlan[];
  transactions: CashTransaction[];
  activeYear: number;
  onAddRecurringExpense: (
    plan: Omit<RecurringExpensePlan, 'id'>,
    autoGenerateCurrentYearTransactions: boolean
  ) => void;
  onDeleteRecurringExpense: (id: string) => void;
  onRegisterOccurrencesInCashFlow: (newTransactions: Omit<CashTransaction, 'id'>[]) => void;
}

const CATEGORIES: CashCategory[] = [
  'Tasse e Formalità',
  'Servizi esterni',
  'Acquisto Strumenti',
  'Marketing',
  'Staff',
  'Evento',
  'SummerCamp',
  'Selva',
  'Tessere',
  'Gadget',
  'Bandi e Fondi Pubbl',
  'Donazioni enti',
  'Altro',
];

const METHODS: PaymentMethod[] = [
  'Bonifico',
  'Contanti',
  'POS',
  'Bancomat',
  'Paypal',
  'Pagam Online',
];

export const RecurringExpensesPanel: React.FC<RecurringExpensesPanelProps> = ({
  recurringExpenses,
  transactions,
  activeYear,
  onAddRecurringExpense,
  onDeleteRecurringExpense,
  onRegisterOccurrencesInCashFlow,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);

  // Form states for creating a new recurring expense
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CashCategory>('Servizi esterni');
  const [method, setMethod] = useState<PaymentMethod>('Bonifico');
  const [frequency, setFrequency] = useState<RecurringExpenseFrequency>('mensile');
  const [durationMode, setDurationMode] =
    useState<RecurringExpenseDurationMode>('numero_rate');
  const [startDate, setStartDate] = useState(`${activeYear}-01-15`);
  const [maxInstallments, setMaxInstallments] = useState('6');
  const [endDate, setEndDate] = useState(`${activeYear}-06-30`);
  const [notes, setNotes] = useState('');
  const [autoGenerateInLedger, setAutoGenerateInLedger] = useState(true);

  const evaluatedPlans = useMemo(
    () => evaluateRecurringExpensePlans(recurringExpenses, transactions, activeYear),
    [recurringExpenses, transactions, activeYear]
  );

  const totalAnnualCommitment = useMemo(
    () =>
      Math.round(
        evaluatedPlans.reduce((acc, p) => acc + p.activeYearTotalAmount, 0) * 100
      ) / 100,
    [evaluatedPlans]
  );

  const totalAnnualPaid = useMemo(
    () =>
      Math.round(
        evaluatedPlans.reduce((acc, p) => acc + p.activeYearPaidAmount, 0) * 100
      ) / 100,
    [evaluatedPlans]
  );

  const totalAnnualRemaining = useMemo(
    () =>
      Math.round(
        evaluatedPlans.reduce((acc, p) => acc + p.activeYearRemainingAmount, 0) * 100
      ) / 100,
    [evaluatedPlans]
  );

  const totalUnpaidCount = useMemo(
    () =>
      evaluatedPlans.reduce((acc, p) => acc + p.unpaidActiveYearOccurrences.length, 0),
    [evaluatedPlans]
  );

  const applyPreset = (preset: {
    title: string;
    amount: string;
    category: CashCategory;
    frequency: RecurringExpenseFrequency;
    durationMode: RecurringExpenseDurationMode;
    maxInstallments?: string;
    endDate?: string;
  }) => {
    setTitle(preset.title);
    setAmount(preset.amount);
    setCategory(preset.category);
    setFrequency(preset.frequency);
    setDurationMode(preset.durationMode);
    if (preset.maxInstallments) setMaxInstallments(preset.maxInstallments);
    if (preset.endDate) setEndDate(preset.endDate);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!title.trim() || isNaN(parsedAmount) || parsedAmount <= 0 || !startDate) return;

    const parsedMaxInstallments =
      durationMode === 'numero_rate'
        ? Math.max(1, parseInt(maxInstallments, 10) || 6)
        : undefined;

    onAddRecurringExpense(
      {
        title: title.trim(),
        category,
        amount: parsedAmount,
        method,
        frequency,
        durationMode,
        startDate,
        maxInstallments: parsedMaxInstallments,
        endDate: durationMode === 'fino_a_data' ? endDate : undefined,
        active: true,
        notes: notes.trim() || undefined,
      },
      autoGenerateInLedger
    );

    setTitle('');
    setAmount('');
    setNotes('');
    setIsAddModalOpen(false);
  };

  const handleRegisterSingleOccurrence = (
    plan: RecurringExpensePlan,
    occ: RecurringExpenseOccurrence
  ) => {
    const txPayload = buildTransactionFromOccurrence(plan, occ);
    onRegisterOccurrencesInCashFlow([txPayload]);
  };

  const handleRegisterAllForPlan = (evalPlan: (typeof evaluatedPlans)[0]) => {
    if (evalPlan.unpaidActiveYearOccurrences.length === 0) return;
    const payloads = evalPlan.unpaidActiveYearOccurrences.map((occ) =>
      buildTransactionFromOccurrence(evalPlan.plan, occ)
    );
    onRegisterOccurrencesInCashFlow(payloads);
  };

  const handleRegisterAllAcrossAllPlans = () => {
    const payloads: Omit<CashTransaction, 'id'>[] = [];
    for (const ep of evaluatedPlans) {
      for (const occ of ep.unpaidActiveYearOccurrences) {
        payloads.push(buildTransactionFromOccurrence(ep.plan, occ));
      }
    }
    if (payloads.length > 0) {
      onRegisterOccurrencesInCashFlow(payloads);
    }
  };

  const previewAmountNum = parseFloat(amount.replace(',', '.')) || 0;
  const previewInstallmentsNum = Math.max(1, parseInt(maxInstallments, 10) || 1);

  return (
    <div
      id="cashflow-recurring-expenses-panel"
      className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden"
    >
      {/* Header Bar */}
      <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-purple-100 text-purple-900 font-mono text-[10px] font-bold uppercase">
              <Repeat className="w-3 h-3 text-purple-700" />
              Spese Ricorrenti & Rateizzazioni
            </span>
            <h3 className="font-bold text-slate-900 text-sm">
              Piani di Spesa Mensili, Annuali o a Durata Determinata ({recurringExpenses.length})
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Imposta canoni mensili, spese annuali o pagamenti che durano un tot di tempo (es. 6
            rate o fino a una data specifica) e registrali nel Libro Cassa con un clic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {totalUnpaidCount > 0 && (
            <button
              id="btn-register-all-recurring-year"
              type="button"
              onClick={handleRegisterAllAcrossAllPlans}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
              title="Registra nel Libro Cassa tutte le rate non ancora contabilizzate per l'anno attivo"
            >
              <Layers className="w-3.5 h-3.5 text-purple-700" />
              <span>
                Contabilizza Rate Pendenti ({totalUnpaidCount} rate ·{' '}
                {formatEuro(totalAnnualRemaining)})
              </span>
            </button>
          )}

          <button
            id="btn-open-new-recurring-expense"
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova Spesa Ricorrente</span>
          </button>
        </div>
      </div>

      {/* Summary Strip & Plans List */}
      {evaluatedPlans.length === 0 ? (
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs bg-white">
          <div className="text-slate-500">
            Nessuna spesa ricorrente configurata (es. canone banca mensile, commercialista,
            assicurazione/affitto annuale o rateizzazione attrezzature per N mesi).
          </div>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Configura Prima Spesa Ricorrente</span>
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* KPI Mini Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 font-medium">
                Impegno Spese Ricorrenti ({activeYear})
              </span>
              <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                {formatEuro(totalAnnualCommitment)}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium">
                Già Registrate nel Libro Cassa
              </span>
              <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                {formatEuro(totalAnnualPaid)}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 font-medium">
                Rate Restanti da Contabilizzare
              </span>
              <div className="text-base font-bold text-purple-800 font-mono mt-0.5">
                {formatEuro(totalAnnualRemaining)} ({totalUnpaidCount} scadenze)
              </div>
            </div>
          </div>

          {/* List of Recurring Expense Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {evaluatedPlans.map((ep) => {
              const { plan } = ep;
              const isExpanded = expandedPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-sm bg-purple-100 text-purple-900 font-mono text-[10px] font-bold uppercase">
                            {ep.frequencyLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                            {ep.durationSummaryLabel}
                          </span>
                          <span className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600 text-[10px] font-medium">
                            {plan.category} · {plan.method}
                          </span>
                        </div>

                        <h4 className="font-bold text-slate-900 text-sm">{plan.title}</h4>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono font-extrabold text-sm text-rose-700">
                          -{formatEuro(plan.amount)}
                          <span className="text-[10px] font-normal text-slate-500"> / rata</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Tot. {activeYear}: {formatEuro(ep.activeYearTotalAmount)}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar of installments */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>
                          Avanzamento rate contabilizzate ({ep.paidOccurrencesCount}/
                          {ep.activeYearOccurrences.length})
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          {ep.completionPercent}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${ep.completionPercent}%` }}
                          className="h-full bg-purple-600 rounded-full transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons & Expandable Installments Schedule */}
                  <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedPlanId(isExpanded ? null : plan.id)
                        }
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 hover:text-slate-950"
                      >
                        <Calendar className="w-3.5 h-3.5 text-purple-600" />
                        <span>
                          {isExpanded
                            ? 'Nascondi calendario rate'
                            : `Vedi calendario (${ep.activeYearOccurrences.length} scadenze)`}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <div className="flex items-center gap-1.5">
                        {ep.nextUnpaidOccurrence ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleRegisterSingleOccurrence(plan, ep.nextUnpaidOccurrence!)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition-colors"
                            title="Registra subito la prossima rata nel Libro Cassa"
                          >
                            <Plus className="w-3 h-3" />
                            <span>
                              Registra {ep.nextUnpaidOccurrence.label} (
                              {ep.nextUnpaidOccurrence.date})
                            </span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tutte le rate registrate
                          </span>
                        )}

                        {ep.unpaidActiveYearOccurrences.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRegisterAllForPlan(ep)}
                            className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-semibold transition-colors"
                            title="Registra tutte le rate rimanenti di questo piano nel Libro Cassa"
                          >
                            Tutte ({ep.unpaidActiveYearOccurrences.length})
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteRecurringExpense(plan.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                          title="Elimina piano di spesa ricorrente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="bg-slate-50 rounded-lg border border-slate-200/80 divide-y divide-slate-200/60 max-h-48 overflow-y-auto">
                        {ep.activeYearOccurrences.map((occ) => (
                          <div
                            key={`${plan.id}-${occ.installmentNumber}`}
                            className="px-3 py-2 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-slate-600">{occ.date}</span>
                              <span className="font-semibold text-slate-800 truncate">
                                {occ.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-bold text-rose-700">
                                -{formatEuro(occ.amount)}
                              </span>
                              {occ.isPaidInCashFlow ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" />
                                  In Cassa
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRegisterSingleOccurrence(plan, occ)}
                                  className="px-2 py-0.5 rounded-sm bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 font-semibold text-[10px]"
                                >
                                  + Registra
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal for Adding a New Recurring Expense */}
      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recurring-expense-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <span className="px-2 py-0.5 rounded-sm bg-purple-100 text-purple-900 font-mono text-[10px] font-bold uppercase">
                  Pianificazione Uscite Fisse o Rateali
                </span>
                <h3
                  id="recurring-expense-modal-title"
                  className="font-extrabold text-slate-900 text-base mt-1"
                >
                  Inserisci Nuova Spesa Ricorrente (Mensile, Annua o a Durata)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span>Modelli rapidi pre-compilati (clicca per compilare):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  id="preset-recurring-6-months"
                  type="button"
                  onClick={() =>
                    applyPreset({
                      title: 'Noleggio / Rateizzazione Tende & Materiale Montagna',
                      amount: '85.00',
                      category: 'Acquisto Strumenti',
                      frequency: 'mensile',
                      durationMode: 'numero_rate',
                      maxInstallments: '6',
                    })
                  }
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition-colors"
                >
                  Rateizzazione 6 Mesi (€ 85/mese)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      title: 'Canone Mensile Conto Corrente Bancario ASD',
                      amount: '12.00',
                      category: 'Tasse e Formalità',
                      frequency: 'mensile',
                      durationMode: 'indeterminata',
                    })
                  }
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Canone Banca Mensile (€ 12/mese)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      title: 'Consulenza Fiscale & Commercialista ASD',
                      amount: '150.00',
                      category: 'Servizi esterni',
                      frequency: 'trimestrale',
                      durationMode: 'indeterminata',
                    })
                  }
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Commercialista Trimestrale (€ 150)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      title: 'Rinnovo Dominio, Hosting Sito Web & PEC',
                      amount: '90.00',
                      category: 'Marketing',
                      frequency: 'annuale',
                      durationMode: 'indeterminata',
                    })
                  }
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Sito Web & PEC Annuale (€ 90/anno)
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Descrizione / Titolo Spesa Ricorrente *
                </label>
                <input
                  id="input-recurring-title"
                  type="text"
                  required
                  placeholder="Es. Affitto magazzino attrezzature / Canone banca / Rateizzazione tende"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Importo Rata (€) *
                  </label>
                  <input
                    id="input-recurring-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="Es. 85.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Periodicità *
                  </label>
                  <select
                    id="select-recurring-frequency"
                    value={frequency}
                    onChange={(e) =>
                      setFrequency(e.target.value as RecurringExpenseFrequency)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {(
                      Object.keys(FREQUENCY_LABELS) as RecurringExpenseFrequency[]
                    ).map((freq) => (
                      <option key={freq} value={freq}>
                        {FREQUENCY_LABELS[freq]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Data 1ª Scadenza *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              {/* Duration Mode Selector: Indeterminata vs Numero di Rate vs Data di Fine */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="block text-slate-800 font-bold">
                  Durata della Spesa nel Tempo *
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'numero_rate',
                      title: 'Per un tot di rate/mesi',
                      sub: 'Es. 6 mesi, 10 rate, 24 mesi',
                    },
                    {
                      id: 'fino_a_data',
                      title: 'Fino a una data precisa',
                      sub: 'Scadenza contratto / noleggio',
                    },
                    {
                      id: 'indeterminata',
                      title: 'Spesa fissa continua',
                      sub: 'Mensile o annuale fissa',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setDurationMode(opt.id as RecurringExpenseDurationMode)
                      }
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        durationMode === opt.id
                          ? 'bg-purple-50 border-purple-500 text-purple-950 ring-1 ring-purple-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold text-xs">{opt.title}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>

                {durationMode === 'numero_rate' && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="flex-1">
                      <label className="block text-slate-700 font-semibold mb-1">
                        Numero totale di rate / scadenze *
                      </label>
                      <input
                        id="input-recurring-installments"
                        type="number"
                        min="1"
                        max="120"
                        required
                        value={maxInstallments}
                        onChange={(e) => setMaxInstallments(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                      />
                    </div>
                    {previewAmountNum > 0 && (
                      <div className="p-2.5 rounded-lg bg-purple-100/70 border border-purple-200 text-purple-950 shrink-0">
                        <div className="text-[10px] uppercase font-bold">
                          Costo Totale Complessivo ({previewInstallmentsNum} rate)
                        </div>
                        <div className="font-mono font-extrabold text-sm">
                          {formatEuro(previewAmountNum * previewInstallmentsNum)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {durationMode === 'fino_a_data' && (
                  <div className="pt-1">
                    <label className="block text-slate-700 font-semibold mb-1">
                      Data Fine Contratto / Ultima Scadenza Inclusa *
                    </label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full sm:w-60 px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Categoria Contabile *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CashCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Canale di Pagamento *
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerateInLedger}
                  onChange={(e) => setAutoGenerateInLedger(e.target.checked)}
                  className="w-4 h-4 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-500"
                />
                <span className="text-xs text-emerald-950 font-medium">
                  <strong>Contabilizza subito nel Libro Cassa:</strong> genera automaticamente le
                  uscite previste per l'anno {activeYear} nella tabella dei movimenti qui sotto.
                </span>
              </label>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                >
                  Annulla
                </button>
                <button
                  id="btn-save-recurring-expense"
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold shadow-xs"
                >
                  Salva Spesa Ricorrente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
