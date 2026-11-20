import React, { useState, useMemo } from 'react';
import {
  Shield,
  Plus,
  Printer,
  UserPlus,
  AlertTriangle,
  Link2,
  Edit3,
  Settings,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  StaffMember,
  CashTransaction,
  PaymentMethod,
  AssociationProfile,
  StaffPaymentKind,
  PaymentAccountId,
} from '../types';
import { formatEuro } from '../utils/finance';
import { todayIso } from '../utils/dates';
import { newId } from '../utils/ids';
import {
  calculateStaffAnnualSummary,
  findLegacyUnlinkedStaffPayments,
  getStaffExternalCompensationForYear,
  isStaffReimbursement,
  DEFAULT_STAFF_THRESHOLDS,
  STAFF_PAYMENT_KIND_LABELS,
} from '../utils/staff';
import { TransactionDateSelector } from './TransactionDateSelector';

interface StaffViewProps {
  staff: StaffMember[];
  transactions: CashTransaction[];
  profile: AssociationProfile;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onAddStaffMember: (member: StaffMember) => void;
  onUpdateStaffMember?: (member: StaffMember) => void;
  onUpdateProfile?: (profile: AssociationProfile) => void;
  onLinkLegacyStaffPayments?: (
    links: { transactionId: string; staffId: string; staffPaymentKind: StaffPaymentKind }[]
  ) => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  staff,
  transactions,
  profile,
  onAddTransaction,
  onAddStaffMember,
  onUpdateStaffMember,
  onUpdateProfile,
  onLinkLegacyStaffPayments,
}) => {
  const activeYear = profile.activeYear || 2027;
  const thresholds = useMemo(
    () => ({
      ...DEFAULT_STAFF_THRESHOLDS,
      ...(profile.staffThresholds || {}),
    }),
    [profile.staffThresholds]
  );

  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [editingStaffMember, setEditingStaffMember] = useState<StaffMember | null>(null);
  const [isLegacyLinkModalOpen, setIsLegacyLinkModalOpen] = useState(false);
  const [isThresholdsConfigOpen, setIsThresholdsConfigOpen] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<CashTransaction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Threshold config form state
  const [inpsLimitInput, setInpsLimitInput] = useState<number>(thresholds.inpsExemption);
  const [irpefLimitInput, setIrpefLimitInput] = useState<number>(thresholds.irpefExemption);
  const [warnPercentInput, setWarnPercentInput] = useState<number>(thresholds.warningPercent);

  // New collaborator form state
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Istruttore Sportivo / Educatore Outdoor');
  const [newStaffFiscalCode, setNewStaffFiscalCode] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffOtherComp, setNewStaffOtherComp] = useState('0');
  const [newStaffOtherNotes, setNewStaffOtherNotes] = useState('');

  // Edit collaborator / external compensation modal state
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editFiscalCode, setEditFiscalCode] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOtherComp, setEditOtherComp] = useState('0');
  const [editOtherNotes, setEditOtherNotes] = useState('');

  // Annual summaries per collaborator (strictly using staffId or whole-word full name for legacy, excluding reimbursements from threshold)
  const staffSummaries = useMemo(
    () =>
      staff.map((s) =>
        calculateStaffAnnualSummary(s, transactions, activeYear, thresholds)
      ),
    [staff, transactions, activeYear, thresholds]
  );

  // Legacy unlinked staff payments that match full name (whole word)
  const legacyMatches = useMemo(
    () => findLegacyUnlinkedStaffPayments(staff, transactions),
    [staff, transactions]
  );
  const [selectedLegacyTxIds, setSelectedLegacyTxIds] = useState<string[]>([]);

  // Filter staff transactions from cash ledger
  const staffTransactions = useMemo(
    () => transactions.filter((t) => t.category === 'Staff' || Boolean(t.staffId)),
    [transactions]
  );

  const totalStaffPaid = useMemo(
    () => staffTransactions.reduce((sum, t) => sum + (t.expense || 0), 0),
    [staffTransactions]
  );

  const selectedSummary = useMemo(
    () =>
      selectedStaffId === 'ALL'
        ? null
        : staffSummaries.find((s) => s.member.id === selectedStaffId) || null,
    [selectedStaffId, staffSummaries]
  );

  const displayedTransactions = useMemo(() => {
    if (selectedStaffId === 'ALL') return staffTransactions;
    return selectedSummary ? selectedSummary.transactions : [];
  }, [selectedStaffId, staffTransactions, selectedSummary]);

  // Form state for adding staff payment
  const [payStaffId, setPayStaffId] = useState<string>(staff[0]?.id || '');
  const [payAmount, setPayAmount] = useState('');
  const [payDateMode, setPayDateMode] = useState<'today' | 'custom'>('today');
  const [payDate, setPayDate] = useState(todayIso());
  const [payKind, setPayKind] = useState<StaffPaymentKind>('compenso_sportivo');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bonifico');
  const [payPaypalSourceAccount, setPayPaypalSourceAccount] = useState<PaymentAccountId>(
    profile.paypalExpenseSourceAccount || 'banca'
  );
  const [payNotes, setPayNotes] = useState('');

  const activePaymentStaffSummary = useMemo(
    () => staffSummaries.find((s) => s.member.id === payStaffId) || staffSummaries[0] || null,
    [staffSummaries, payStaffId]
  );

  const parsedDraftPayAmount = useMemo(() => {
    const n = parseFloat((payAmount || '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  }, [payAmount]);

  const projectedCumulativeCompensation = useMemo(() => {
    if (!activePaymentStaffSummary) return 0;
    const addedComp = payKind === 'rimborso_spese' ? 0 : parsedDraftPayAmount;
    return Math.round((activePaymentStaffSummary.cumulativeAnnualCompensation + addedComp) * 100) / 100;
  }, [activePaymentStaffSummary, payKind, parsedDraftPayAmount]);

  const handleOpenEditStaffModal = (member: StaffMember, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingStaffMember(member);
    setEditName(member.name);
    setEditRole(member.role);
    setEditFiscalCode(member.fiscalCode || '');
    setEditPhone(member.phone || '');
    setEditEmail(member.email || '');
    setEditOtherComp(String(getStaffExternalCompensationForYear(member, activeYear)));
    setEditOtherNotes(member.otherAssociationsNotes || '');
  };

  const handleSaveEditedStaffMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffMember || !onUpdateStaffMember) return;
    const extAmt = Math.max(0, parseFloat(editOtherComp.replace(',', '.')) || 0);
    const updated: StaffMember = {
      ...editingStaffMember,
      name: editName.trim() || editingStaffMember.name,
      role: editRole.trim() || editingStaffMember.role,
      fiscalCode: editFiscalCode.trim() || undefined,
      phone: editPhone.trim() || undefined,
      email: editEmail.trim() || undefined,
      otherAssociationsCompensation: extAmt,
      otherAssociationsCompensationByYear: {
        ...(editingStaffMember.otherAssociationsCompensationByYear || {}),
        [activeYear]: extAmt,
      },
      otherAssociationsNotes: editOtherNotes.trim() || undefined,
    };
    onUpdateStaffMember(updated);
    setEditingStaffMember(null);
  };

  const handleCreateStaffPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amt = parseFloat(payAmount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setFormError('Inserisci un importo valido maggiore di zero.');
      return;
    }

    const targetStaff =
      staff.find((s) => s.id === payStaffId) || staff[0];
    if (!targetStaff) {
      setFormError('Seleziona un collaboratore sportivo.');
      return;
    }

    const desc = `${targetStaff.name} - ${STAFF_PAYMENT_KIND_LABELS[payKind] || 'Compenso'}${
      payNotes ? ` (${payNotes})` : ''
    }`;
    const effectiveDate = payDateMode === 'today' ? todayIso() : payDate;

    onAddTransaction({
      date: effectiveDate,
      category: 'Staff',
      income: null,
      expense: amt,
      method: payMethod,
      accountId:
        payMethod === 'Paypal'
          ? payPaypalSourceAccount
          : payMethod === 'Contanti'
            ? 'cassa'
            : 'banca',
      staffId: targetStaff.id,
      staffPaymentKind: payKind,
      relatedMemberName: targetStaff.name,
      description: desc,
    });

    setIsAddPaymentModalOpen(false);
    setPayAmount('');
    setPayNotes('');
  };

  const handleCreateStaffMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    const extAmt = Math.max(0, parseFloat(newStaffOtherComp.replace(',', '.')) || 0);
    const newCollab: StaffMember = {
      id: newId('st'),
      name: newStaffName.trim(),
      role: newStaffRole.trim() || 'Collaboratore Sportivo',
      fiscalCode: newStaffFiscalCode.trim() || undefined,
      phone: newStaffPhone.trim(),
      email: newStaffEmail.trim(),
      otherAssociationsCompensation: extAmt,
      otherAssociationsCompensationByYear: {
        [activeYear]: extAmt,
      },
      otherAssociationsNotes: newStaffOtherNotes.trim() || undefined,
    };
    onAddStaffMember(newCollab);
    setPayStaffId(newCollab.id);
    setNewStaffName('');
    setNewStaffFiscalCode('');
    setNewStaffPhone('');
    setNewStaffEmail('');
    setNewStaffOtherComp('0');
    setNewStaffOtherNotes('');
    setIsAddStaffModalOpen(false);
  };

  const handleSaveThresholdsConfig = () => {
    if (!onUpdateProfile) return;
    onUpdateProfile({
      ...profile,
      staffThresholds: {
        inpsExemption: Math.max(100, Number(inpsLimitInput) || 5000),
        irpefExemption: Math.max(500, Number(irpefLimitInput) || 15000),
        warningPercent: Math.min(99, Math.max(10, Number(warnPercentInput) || 80)),
      },
    });
    setIsThresholdsConfigOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Normative Banner (Riforma dello Sport D.Lgs. 36/2021) */}
      <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Shield className="w-4 h-4" />
              Conformità Riforma dello Sport (D.Lgs. 36/2021 e D.Lgs. 120/2023)
            </div>
            <h3 className="text-lg font-bold tracking-tight">
              Registro Compensi, Soglie INPS ({formatEuro(thresholds.inpsExemption)}) / IRPEF ({formatEuro(thresholds.irpefExemption)}) &amp; Autocertificazioni Altri Enti
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Tracciamento strutturato per ID collaboratore (`staffId`), separazione tra compensi sportivi e rimborsi spese a piè di lista, e calcolo delle soglie cumulative annue comprensive dei compensi percepiti presso altre ASD/SSD.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
            {onUpdateProfile && (
              <button
                type="button"
                onClick={() => {
                  setInpsLimitInput(thresholds.inpsExemption);
                  setIrpefLimitInput(thresholds.irpefExemption);
                  setWarnPercentInput(thresholds.warningPercent);
                  setIsThresholdsConfigOpen((prev) => !prev);
                }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Soglie ({formatEuro(thresholds.inpsExemption)} / {formatEuro(thresholds.irpefExemption)})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsAddStaffModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuovo Collaboratore</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                if (!payStaffId && staff[0]) {
                  setPayStaffId(staff[0].id);
                }
                setIsAddPaymentModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuovo Compenso Staff</span>
            </button>
          </div>
        </div>

        {/* Fixed Statutory Note (Phase 4.3) */}
        <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700 text-[11px] text-amber-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong>Nota importante sul calcolo delle soglie per lavoratore:</strong>{' '}
            <em>
              &ldquo;Le soglie si calcolano sul totale dei compensi sportivi percepiti dal collaboratore da tutti gli enti nell&apos;anno solare, non solo dalla nostra associazione: chiedere al collaboratore un&apos;autocertificazione all&apos;atto del pagamento e inserire qui l&apos;importo percepito presso altre ASD/SSD. La soglia di {formatEuro(thresholds.inpsExemption)} è contributiva (INPS Gestione Separata), mentre la soglia di {formatEuro(thresholds.irpefExemption)} è fiscale (IRPEF). Verificare con il consulente.&rdquo;
            </em>
          </div>
        </div>
      </div>

      {/* Collapsible Thresholds Configuration Drawer */}
      {isThresholdsConfigOpen && onUpdateProfile && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs">
          <div className="font-bold text-slate-900">
            Configurazione Soglie Compensi Sportivi (D.Lgs. 36/2021)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Soglia Esenzione Contributiva INPS (€)
              </label>
              <input
                type="number"
                value={inpsLimitInput}
                onChange={(e) => setInpsLimitInput(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Soglia Esenzione Fiscale IRPEF (€)
              </label>
              <input
                type="number"
                value={irpefLimitInput}
                onChange={(e) => setIrpefLimitInput(Number(e.target.value) || 0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Preavviso Avvicinamento Soglia INPS (%)
              </label>
              <input
                type="number"
                min={10}
                max={99}
                value={warnPercentInput}
                onChange={(e) => setWarnPercentInput(Number(e.target.value) || 80)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsThresholdsConfigOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSaveThresholdsConfig}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold"
            >
              Salva Soglie
            </button>
          </div>
        </div>
      )}

      {/* Action Banner: Collega i vecchi pagamenti privi di staffId (Phase 4.3) */}
      {legacyMatches.length > 0 && onLinkLegacyStaffPayments && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-950">
          <div className="flex items-start gap-2.5">
            <Link2 className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
            <div>
              <strong>
                Rilevati {legacyMatches.length} pagamenti storici privi di collegamento strutturato (`staffId`):
              </strong>{' '}
              Questi movimenti sono stati individuati tramite corrispondenza sul nome e cognome completo del collaboratore. Vuoi verificare e salvare il collegamento definitivo `staffId`?
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedLegacyTxIds(legacyMatches.map((m) => m.transaction.id));
              setIsLegacyLinkModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-lg transition-colors shrink-0"
          >
            Collega i vecchi pagamenti ({legacyMatches.length})
          </button>
        </div>
      )}

      {/* Staff Collaborator Cards with Threshold Progress & External ASD Compensation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffSummaries.map((summary) => {
          const {
            member,
            asdCompensation,
            asdReimbursements,
            otherAssociationsCompensation,
            cumulativeAnnualCompensation,
            paymentCount,
            lastPaymentDate,
            thresholdStatus,
            inpsExemptionLimit,
            irpefExemptionLimit,
            inpsExcessAmount,
            irpefExcessAmount,
            inpsProgressPercent,
          } = summary;

          const isSelected = selectedStaffId === member.id;

          const badgeConfig =
            thresholdStatus === 'exceeded_irpef'
              ? {
                  label: `SUPERATA SOGLIA IRPEF ${formatEuro(irpefExemptionLimit)} (+${formatEuro(irpefExcessAmount)})`,
                  className: 'bg-rose-700 text-white border-rose-800',
                  barClass: 'bg-rose-600',
                  cardBorder: 'border-rose-400',
                }
              : thresholdStatus === 'exceeded_inps'
                ? {
                    label: `SUPERATA SOGLIA INPS ${formatEuro(inpsExemptionLimit)} (+${formatEuro(inpsExcessAmount)})`,
                    className: 'bg-rose-100 text-rose-900 border-rose-300',
                    barClass: 'bg-rose-600',
                    cardBorder: 'border-rose-300',
                  }
                : thresholdStatus === 'warning_inps'
                  ? {
                      label: `AVVISO ${inpsProgressPercent}% SOGLIA INPS (${formatEuro(inpsExemptionLimit)})`,
                      className: 'bg-amber-100 text-amber-900 border-amber-300',
                      barClass: 'bg-amber-500',
                      cardBorder: 'border-amber-300',
                    }
                  : {
                      label: `ENTRO SOGLIA INPS (${inpsProgressPercent}%)`,
                      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                      barClass: 'bg-emerald-600',
                      cardBorder: 'border-slate-200',
                    };

          return (
            <div
              key={member.id}
              onClick={() =>
                setSelectedStaffId(isSelected ? 'ALL' : member.id)
              }
              className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs flex flex-col justify-between ${
                isSelected
                  ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                  : `${badgeConfig.cardBorder} hover:border-slate-300`
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{member.name}</h4>
                    <p className="text-xs text-slate-500 line-clamp-1">{member.role}</p>
                    {member.fiscalCode && (
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        C.F. {member.fiscalCode}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onUpdateStaffMember && (
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditStaffModal(member, e)}
                        title="Inserisci / Modifica compensi percepiti presso altre ASD e dati collaboratore"
                        className="px-2 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Altre ASD / Dati</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Threshold Status Badge & Progress Bar */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold border ${badgeConfig.className}`}
                    >
                      {thresholdStatus !== 'ok' && <AlertTriangle className="w-3 h-3 shrink-0" />}
                      <span>{badgeConfig.label}</span>
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full transition-all ${badgeConfig.barClass}`}
                      style={{ width: `${Math.min(100, inpsProgressPercent)}%` }}
                    />
                  </div>
                </div>

                {/* Breakdown: Nostra ASD vs Altre Associazioni vs Rimborsi */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 block">
                      Compensi Nostra ASD ({activeYear}):
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatEuro(asdCompensation)}
                    </span>
                  </div>
                  <div
                    onClick={(e) => {
                      if (onUpdateStaffMember) {
                        handleOpenEditStaffModal(member, e);
                      }
                    }}
                    className="p-2 rounded-lg bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 transition-colors"
                    title="Clicca per aggiornare i compensi percepiti dal lavoratore presso altre ASD/SSD nell'anno"
                  >
                    <span className="text-[10px] text-amber-900 font-semibold block">
                      Presso Altre ASD ({activeYear}):
                    </span>
                    <span className="font-mono font-bold text-amber-950 tabular-nums">
                      {formatEuro(otherAssociationsCompensation)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">
                    Totale Cumulativo Soggetto a Soglia:
                  </span>
                  <span className="font-mono font-extrabold text-slate-900 text-base tabular-nums">
                    {formatEuro(cumulativeAnnualCompensation)}
                  </span>
                  {asdReimbursements > 0 && (
                    <span className="text-[10px] text-slate-500 block">
                      + {formatEuro(asdReimbursements)} rimborsi piè di lista (esenti)
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">
                    Ult: {lastPaymentDate}
                  </span>
                  <span className="text-slate-600 font-mono font-medium">
                    {paymentCount} pagamenti
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff Payments Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Storico Compensi e Rimborsi Erogati ({displayedTransactions.length} movimenti)
            </h4>
            <p className="text-xs text-slate-500">
              {selectedSummary
                ? `Filtrati per collaboratore: ${selectedSummary.member.name}`
                : 'Tutti i compensi sportivi e rimborsi registrati a bilancio'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selectedStaffId !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedStaffId('ALL')}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Mostra tutti
              </button>
            )}
            <div className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg">
              Totale Erogato ASD: {formatEuro(totalStaffPaid)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-28">Data</th>
                <th className="py-3 px-4">Collaboratore &amp; Causale</th>
                <th className="py-3 px-4 w-36">Tipologia</th>
                <th className="py-3 px-4 w-28">Canale</th>
                <th className="py-3 px-4 text-right w-32">Importo Erogato</th>
                <th className="py-3 px-4 text-center w-28">Quietanza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Nessun pagamento registrato per questo collaboratore.
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((tx) => {
                  const isReimb = isStaffReimbursement(tx);
                  const linkedCollab = tx.staffId
                    ? staff.find((s) => s.id === tx.staffId)
                    : undefined;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-2.5 px-4 text-slate-900 font-medium">
                        <div>{tx.description}</div>
                        {linkedCollab && (
                          <span className="text-[10px] text-emerald-700 font-semibold">
                            Collegato a: {linkedCollab.name}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {isReimb ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                            Rimborso piè di lista (esente)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold text-[10px]">
                            Compenso sportivo
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                        {tx.method}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-800 tabular-nums whitespace-nowrap">
                        {formatEuro(tx.expense)}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptPayment(tx)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors text-[11px] font-medium"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Quietanza PDF</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Payment Modal with Live Threshold Alert (5.000 € INPS / 15.000 € IRPEF) */}
      {isAddPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Registra Compenso o Rimborso Collaboratore</h3>
              <button
                type="button"
                onClick={() => setIsAddPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaffPayment} className="space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Collaboratore / Operatore *
                </label>
                <select
                  value={payStaffId}
                  onChange={(e) => setPayStaffId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden bg-white"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Threshold Summary & Pre-Payment Alert for Selected Collaborator */}
              {activePaymentStaffSummary && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    projectedCumulativeCompensation > thresholds.irpefExemption
                      ? 'bg-rose-100 border-rose-400 text-rose-950'
                      : projectedCumulativeCompensation > thresholds.inpsExemption
                        ? 'bg-rose-50 border-rose-300 text-rose-950'
                        : projectedCumulativeCompensation >=
                            (thresholds.inpsExemption * thresholds.warningPercent) / 100
                          ? 'bg-amber-50 border-amber-300 text-amber-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>
                      Situazione Soglie {activeYear} — {activePaymentStaffSummary.member.name}
                    </span>
                    <span className="font-mono">
                      Post-pagamento: {formatEuro(projectedCumulativeCompensation)}
                    </span>
                  </div>
                  <div className="text-[11px] flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Già erogati nostra ASD:{' '}
                      <strong className="font-mono">
                        {formatEuro(activePaymentStaffSummary.asdCompensation)}
                      </strong>
                    </span>
                    <span>
                      Percepiti presso altre ASD:{' '}
                      <strong className="font-mono">
                        {formatEuro(activePaymentStaffSummary.otherAssociationsCompensation)}
                      </strong>
                    </span>
                  </div>
                  {payKind !== 'rimborso_spese' &&
                    projectedCumulativeCompensation > thresholds.irpefExemption && (
                      <div className="pt-1 font-bold text-rose-900 flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                        <span>
                          ATTENZIONE CRITICA: Con questo pagamento il collaboratore supera la soglia fiscale IRPEF di{' '}
                          {formatEuro(thresholds.irpefExemption)} (eccedenza IRPEF:{' '}
                          {formatEuro(projectedCumulativeCompensation - thresholds.irpefExemption)}; eccedenza contributiva INPS:{' '}
                          {formatEuro(projectedCumulativeCompensation - thresholds.inpsExemption)})!
                        </span>
                      </div>
                    )}
                  {payKind !== 'rimborso_spese' &&
                    projectedCumulativeCompensation > thresholds.inpsExemption &&
                    projectedCumulativeCompensation <= thresholds.irpefExemption && (
                      <div className="pt-1 font-bold text-rose-900 flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                        <span>
                          ATTENZIONE SOGLIA INPS: Con questo pagamento il collaboratore supera la soglia contributiva INPS di{' '}
                          {formatEuro(thresholds.inpsExemption)} per{' '}
                          {formatEuro(projectedCumulativeCompensation - thresholds.inpsExemption)} (sulla parte eccedente sono dovuti i contributi previdenziali INPS Gestione Separata).
                        </span>
                      </div>
                    )}
                  {payKind !== 'rimborso_spese' &&
                    projectedCumulativeCompensation >=
                      (thresholds.inpsExemption * thresholds.warningPercent) / 100 &&
                    projectedCumulativeCompensation <= thresholds.inpsExemption && (
                      <div className="pt-1 font-semibold text-amber-900 flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <span>
                          Preavviso: il collaboratore supera l&apos;{thresholds.warningPercent}% della soglia contributiva INPS ({formatEuro(thresholds.inpsExemption)}). Richiedere autocertificazione aggiornata.
                        </span>
                      </div>
                    )}
                </div>
              )}

              <TransactionDateSelector
                mode={payDateMode}
                customDate={payDate}
                onChangeMode={setPayDateMode}
                onChangeCustomDate={setPayDate}
                label="Con quale data registrare il movimento nel Flusso di Cassa?"
                idPrefix="staff-payment-cash"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Importo Netto (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Es. 450.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tipologia *</label>
                  <select
                    value={payKind}
                    onChange={(e) => setPayKind(e.target.value as StaffPaymentKind)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden bg-white"
                  >
                    <option value="compenso_sportivo">Lavoro Sportivo Dilettantistico</option>
                    <option value="servizi_guida">Servizi Guida Ambientale</option>
                    <option value="progettazione">Progettazione e Coordinamento</option>
                    <option value="rimborso_spese">Rimborso Spese a Piè di Lista (Esente soglie)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Canale Pagamento *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden bg-white"
                  >
                    <option value="Bonifico">Bonifico Bancario</option>
                    <option value="Paypal">PayPal</option>
                    <option value="POS">Bancomat / POS</option>
                    <option value="Contanti">Contanti</option>
                  </select>
                </div>
              </div>

              {payMethod === 'Paypal' && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                  <label className="block text-[11px] font-bold text-blue-950">
                    Strumento di pagamento usato dentro PayPal (Conto addebitato per l&apos;uscita):
                  </label>
                  <select
                    value={payPaypalSourceAccount}
                    onChange={(e) => setPayPaypalSourceAccount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-blue-300 bg-white font-semibold text-slate-900"
                  >
                    <option value="banca">Conto Corrente Bancario (Predefinito - Carta/IBAN collegato a PayPal)</option>
                    <option value="paypal">Saldo Conto PayPal</option>
                    <option value="cassa">Cassa Contanti</option>
                    {(profile.customPaymentAccounts || []).map((ca) => (
                      <option key={ca.id} value={ca.id}>
                        {ca.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">Note o Riferimento Evento</label>
                <input
                  type="text"
                  placeholder="Es. Evento rifugio Forte dei Marmi, benzina..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors font-semibold shadow-xs"
                >
                  Registra Liquidazione
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Collaborator Modal (including external ASD compensation) */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Aggiungi Collaboratore Sportivo</h3>
              <button
                type="button"
                onClick={() => setIsAddStaffModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaffMember} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nome e Cognome *</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Marco Verdi"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Ruolo / Qualifica *</label>
                  <input
                    type="text"
                    required
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Codice Fiscale</label>
                  <input
                    type="text"
                    placeholder="Es. VRDMRC..."
                    value={newStaffFiscalCode}
                    onChange={(e) => setNewStaffFiscalCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Telefono</label>
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                <label className="block text-amber-950 font-bold">
                  Compensi sportivi percepiti presso ALTRE ASD/SSD nell&apos;anno {activeYear} (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newStaffOtherComp}
                  onChange={(e) => setNewStaffOtherComp(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white font-mono font-bold"
                />
                <input
                  type="text"
                  placeholder="Note autocertificazione (es. Autocertificazione del 10/03/2027 - ASD Montagna)"
                  value={newStaffOtherNotes}
                  onChange={(e) => setNewStaffOtherNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-amber-200 bg-white"
                />
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  Salva Collaboratore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Collaborator & External ASD Compensation Modal */}
      {editingStaffMember && onUpdateStaffMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Compensi Altre Associazioni &amp; Dati Collaboratore
              </h3>
              <button
                type="button"
                onClick={() => setEditingStaffMember(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedStaffMember} className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 space-y-2">
                <label className="block text-amber-950 font-bold text-sm">
                  Compensi percepiti presso ALTRE ASD/SSD nell&apos;anno {activeYear} (€)
                </label>
                <p className="text-[11px] text-amber-900">
                  Il conteggio delle soglie di {formatEuro(thresholds.inpsExemption)} (INPS) e {formatEuro(thresholds.irpefExemption)} (IRPEF) è sul singolo lavoratore nell&apos;anno solare. Inserisci quanto dichiarato dal collaboratore per gli altri enti:
                </p>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editOtherComp}
                  onChange={(e) => setEditOtherComp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-amber-400 bg-white font-mono font-extrabold text-sm text-slate-900"
                />
                <input
                  type="text"
                  placeholder="Riferimento autocertificazione / nome altre ASD..."
                  value={editOtherNotes}
                  onChange={(e) => setEditOtherNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-amber-300 bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Nome e Cognome *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Ruolo / Qualifica</label>
                  <input
                    type="text"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Codice Fiscale</label>
                  <input
                    type="text"
                    value={editFiscalCode}
                    onChange={(e) => setEditFiscalCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Telefono</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStaffMember(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  Salva Modifiche
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Collega i vecchi pagamenti (Phase 4.3) */}
      {isLegacyLinkModalOpen && onLinkLegacyStaffPayments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 text-xs max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">
                Conferma Collegamento Pagamenti Storici ai Collaboratori (`staffId`)
              </h3>
              <button
                type="button"
                onClick={() => setIsLegacyLinkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-600">
              Seleziona gli abbinamenti trovati sul nome e cognome completo del collaboratore per salvare in modo permanente `staffId` e la tipologia di pagamento:
            </p>
            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl divide-y divide-slate-100">
              {legacyMatches.map((m) => {
                const checked = selectedLegacyTxIds.includes(m.transaction.id);
                return (
                  <label
                    key={m.transaction.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLegacyTxIds((prev) => [...prev, m.transaction.id]);
                          } else {
                            setSelectedLegacyTxIds((prev) =>
                              prev.filter((id) => id !== m.transaction.id)
                            );
                          }
                        }}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-bold text-slate-900">
                          {m.transaction.date} — {m.transaction.description}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-semibold">
                          → Collaboratore: {m.staffMember.name} ({STAFF_PAYMENT_KIND_LABELS[m.inferredKind]})
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-rose-800 shrink-0">
                      {formatEuro(m.transaction.expense)}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsLegacyLinkModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={selectedLegacyTxIds.length === 0}
                onClick={() => {
                  const toLink = legacyMatches
                    .filter((m) => selectedLegacyTxIds.includes(m.transaction.id))
                    .map((m) => ({
                      transactionId: m.transaction.id,
                      staffId: m.staffMember.id,
                      staffPaymentKind: m.inferredKind,
                    }));
                  onLinkLegacyStaffPayments(toLink);
                  setIsLegacyLinkModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white font-bold flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Conferma e Collega ({selectedLegacyTxIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Staff Payment Receipt Modal */}
      {selectedReceiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Quietanza di Pagamento Compenso Sportivo</h3>
              <button
                type="button"
                onClick={() => setSelectedReceiptPayment(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4 text-xs font-sans">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase">{profile.name}</h4>
                  <p className="text-[11px] text-slate-500">C.F. {profile.fiscalCode} | {profile.address}</p>
                  <p className="text-[11px] text-slate-500">{profile.affiliation}</p>
                </div>
                <div className="text-right font-mono text-[11px] text-slate-500">
                  Data: {selectedReceiptPayment.date}
                </div>
              </div>

              <div>
                <p className="text-slate-700 leading-relaxed">
                  Si attesta l&apos;avvenuta corresponsione della somma di{' '}
                  <strong className="font-mono text-slate-900">
                    {formatEuro(selectedReceiptPayment.expense)}
                  </strong>{' '}
                  a favore del collaboratore sportivo per le prestazioni e le attività svolte in attuazione degli scopi istituzionali dell&apos;associazione.
                </p>
                <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Causale registrata:</span>
                  <span className="font-medium text-slate-900">{selectedReceiptPayment.description}</span>
                  <span className="text-slate-500 block mt-1">Canale di accredito: {selectedReceiptPayment.method}</span>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-lg text-[10px] text-emerald-900 border border-emerald-100">
                <strong>Clausola normativa D.Lgs. 36/2021:</strong> I compensi da lavoro sportivo nell&apos;area del dilettantismo non costituiscono base imponibile ai fini fiscali (IRPEF) fino all&apos;importo complessivo annuo di {formatEuro(thresholds.irpefExemption)} e sono esenti da contributi previdenziali (INPS Gestione Separata) fino a {formatEuro(thresholds.inpsExemption)} annui complessivi percepiti da tutti gli enti.
              </div>

              <div className="pt-4 flex flex-wrap justify-between items-end gap-4 text-[11px] text-slate-600">
                <div>
                  Firma del Presidente:<br />
                  <span className="font-semibold text-slate-900 block">{profile.president}</span>
                  {profile.signatureImageDataUrl && (
                    <img
                      src={profile.signatureImageDataUrl}
                      alt="Firma Presidente ASD"
                      className="h-11 w-auto object-contain mt-1"
                    />
                  )}
                </div>
                {profile.stampImageDataUrl && (
                  <div className="flex flex-col items-center">
                    <img
                      src={profile.stampImageDataUrl}
                      alt="Timbro Ufficiale ASD"
                      className="h-16 w-auto object-contain opacity-90"
                    />
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">
                      Timbro ASD
                    </span>
                  </div>
                )}
                <div className="text-right">
                  Firma per quietanza e autocertificazione soglie:<br />
                  <span className="italic text-slate-400">Firma del Collaboratore</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedReceiptPayment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Chiudi
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Stampa Documento</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
