import React, { useState, useMemo } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Plus,
  Edit3,
  Receipt,
  History,
  CalendarCheck,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  Member,
  InsuranceType,
  CardValidityType,
  AssociationProfile,
  PaymentMethod,
  CashTransaction,
  EventBooking,
  AgeGroup,
} from '../types';
import {
  isTessera365Eligible,
  calculateCardExpiryDate,
} from '../utils/csvExcelImporter';
import { parseAnyDate, diffDays } from '../utils/notifications';
import { getInsuranceDisplayLabel } from '../utils/digitalCard';
import {
  TransactionDateSelector,
  getTodayIsoDate,
} from './TransactionDateSelector';
import {
  MemberSortField,
  SortDirection,
  sortMembersList,
} from '../utils/finance';

interface CardsViewProps {
  members: Member[];
  bookings: EventBooking[];
  profile: AssociationProfile;
  onUpdateMember: (member: Member) => void;
  onAddMember: (member: Omit<Member, 'id'>) => Member;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onOpenDigitalCardModal: (member?: Member) => void;
  onSelectMemberForReceipt: (member: Member) => void;
  onNavigateToMembers: () => void;
}

export const CardsView: React.FC<CardsViewProps> = ({
  members,
  bookings,
  profile,
  onUpdateMember,
  onAddMember,
  onAddTransaction,
  onOpenDigitalCardModal,
  onSelectMemberForReceipt,
  onNavigateToMembers,
}) => {
  const [search, setSearch] = useState('');
  const [selectedInsurance, setSelectedInsurance] = useState<string>('ALL');
  const [selectedCardStatus, setSelectedCardStatus] = useState<string>('ALL');
  const [sortField, setSortField] = useState<MemberSortField>('childName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const handleToggleSort = (field: MemberSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: MemberSortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-70 inline ml-1" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-700 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-700 inline ml-1" />
    );
  };

  // Modal for editing / renewing ONLY the card of an existing member
  const [editingCardMember, setEditingCardMember] = useState<Member | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [insuranceType, setInsuranceType] = useState<InsuranceType>('Gold');
  const [validityType, setValidityType] = useState<CardValidityType>('solare');
  const [issueDate, setIssueDate] = useState(getTodayIsoDate());
  const [expiryDate, setExpiryDate] = useState('');
  const [isPaid, setIsPaid] = useState(true);
  const [recordInCashFlow, setRecordInCashFlow] = useState(false);
  const [cashAmount, setCashAmount] = useState<number>(20);
  const [cashMethod, setCashMethod] = useState<PaymentMethod>('Bonifico');
  const [cashTxDate, setCashTxDate] = useState(getTodayIsoDate());
  const [archivePreviousCard, setArchivePreviousCard] = useState(false);

  // Modal for issuing a brand new card (also adds to Anagrafica automatically if new person)
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newParentName, setNewParentName] = useState('');
  const [newParentEmail, setNewParentEmail] = useState('');
  const [newParentPhone, setNewParentPhone] = useState('');
  const [newGroup, setNewGroup] = useState<AgeGroup>('6-11');
  const [newCardNum, setNewCardNum] = useState('');
  const [newInsType, setNewInsType] = useState<InsuranceType>('Gold');
  const [newValType, setNewValType] = useState<CardValidityType>('solare');
  const [newIssueDate, setNewIssueDate] = useState(getTodayIsoDate());
  const [newIsPaid, setNewIsPaid] = useState(true);
  const [newRecordCash, setNewRecordCash] = useState(true);
  const [newCashAmount, setNewCashAmount] = useState<number>(20);
  const [newCashMethod, setNewCashMethod] = useState<PaymentMethod>('Bonifico');
  const [newCashDate, setNewCashDate] = useState(getTodayIsoDate());

  const getMemberCardState = (m: Member) => {
    const num = (m.membershipCardNumber || '').trim();
    const hasValidNumber =
      num.length > 0 &&
      !num.toLowerCase().includes('attesa') &&
      !num.toLowerCase().includes('assegnare') &&
      !num.toLowerCase().includes('mandare');
    const exp = parseAnyDate(m.expiryDate);
    const days = exp ? diffDays(exp) : -1;
    const isExpired = exp ? days < 0 : false;
    const isExpiringSoon = exp ? days >= 0 && days <= 30 : false;

    const normalizedName = m.childName.trim().toLowerCase();
    const activeBookings = bookings.filter(
      (b) =>
        b.confirmed &&
        ((b.memberId && b.memberId === m.id) ||
          b.childName.trim().toLowerCase() === normalizedName)
    );
    const isEnrolledInActivity = activeBookings.length > 0;

    return {
      hasValidNumber,
      days,
      isExpired,
      isExpiringSoon,
      isEnrolledInActivity,
      activeBookings,
      isActiveAndOk: hasValidNumber && m.isPaid && !isExpired,
    };
  };

  const stats = useMemo(() => {
    let activeCount = 0;
    let tessera365Count = 0;
    let expiredCount = 0;
    let enrolledNeedsRenewalCount = 0;

    for (const m of members) {
      const st = getMemberCardState(m);
      if (st.isActiveAndOk) activeCount++;
      if (m.cardValidityType === 'tessera_365') tessera365Count++;
      if (st.isExpired || !st.hasValidNumber || !m.isPaid) {
        expiredCount++;
        if (st.isEnrolledInActivity) enrolledNeedsRenewalCount++;
      }
    }
    return {
      activeCount,
      tessera365Count,
      expiredCount,
      enrolledNeedsRenewalCount,
    };
  }, [members, bookings]);

  const filteredMembers = useMemo(() => {
    const filtered = members.filter((m) => {
      if (selectedInsurance !== 'ALL' && m.insuranceType !== selectedInsurance) return false;
      const st = getMemberCardState(m);
      if (selectedCardStatus === 'ACTIVE' && !st.isActiveAndOk) return false;
      if (selectedCardStatus === 'EXPIRED' && !st.isExpired) return false;
      if (selectedCardStatus === 'UNPAID_OR_MISSING' && (st.hasValidNumber && m.isPaid))
        return false;
      if (selectedCardStatus === 'TESSERA_365' && m.cardValidityType !== 'tessera_365')
        return false;
      if (
        selectedCardStatus === 'ENROLLED_NEEDS_RENEWAL' &&
        !(st.isEnrolledInActivity && !st.isActiveAndOk)
      )
        return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = m.childName.toLowerCase().includes(q);
        const matchParent = (m.parentName || '').toLowerCase().includes(q);
        const matchCard = (m.membershipCardNumber || '').toLowerCase().includes(q);
        return matchName || matchParent || matchCard;
      }
      return true;
    });
    return sortMembersList(filtered, sortField, sortDirection);
  }, [members, bookings, selectedInsurance, selectedCardStatus, search, sortField, sortDirection]);

  const openEditCardModal = (m: Member, asRenewal: boolean = false) => {
    const today = getTodayIsoDate();
    const baseIssue = asRenewal ? today : m.cardIssueDate || today;
    const can365 = isTessera365Eligible(baseIssue);
    const valType: CardValidityType =
      m.cardValidityType === 'tessera_365' && can365 ? 'tessera_365' : 'solare';

    setEditingCardMember(m);
    setCardNumber(asRenewal ? '' : m.membershipCardNumber || '');
    setInsuranceType(m.insuranceType || 'Gold');
    setValidityType(valType);
    setIssueDate(baseIssue);
    setExpiryDate(
      asRenewal
        ? calculateCardExpiryDate(baseIssue, valType)
        : m.expiryDate || calculateCardExpiryDate(baseIssue, valType)
    );
    setIsPaid(asRenewal ? true : m.isPaid);
    setArchivePreviousCard(asRenewal && !!m.membershipCardNumber);
    setRecordInCashFlow(asRenewal);
    setCashAmount(m.insuranceType === 'Platinum' ? 25 : 20);
    setCashMethod('Bonifico');
    setCashTxDate(today);
  };

  const handleSaveCardUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCardMember) return;

    const can365 = isTessera365Eligible(issueDate);
    const effectiveValidity: CardValidityType =
      validityType === 'tessera_365' && can365 ? 'tessera_365' : 'solare';
    const finalExpiry =
      expiryDate.trim() || calculateCardExpiryDate(issueDate, effectiveValidity);

    const prevHistory = editingCardMember.cardHistory || [];
    const nextHistory =
      archivePreviousCard && editingCardMember.membershipCardNumber
        ? [
            {
              id: `ch-${Date.now()}`,
              cardNumber: editingCardMember.membershipCardNumber,
              issueDate: editingCardMember.cardIssueDate || 'Storico',
              expiryDate: editingCardMember.expiryDate || '-',
              validityType: editingCardMember.cardValidityType || ('solare' as const),
              insuranceType: editingCardMember.insuranceType,
            },
            ...prevHistory,
          ]
        : prevHistory;

    const updatedMember: Member = {
      ...editingCardMember,
      membershipCardNumber: cardNumber.trim() || 'In emissione US ACLI',
      insuranceType,
      cardValidityType: effectiveValidity,
      cardIssueDate: issueDate,
      expiryDate: finalExpiry,
      isPaid,
      cardHistory: nextHistory,
    };

    onUpdateMember(updatedMember);

    if (recordInCashFlow && isPaid && cashAmount > 0) {
      onAddTransaction({
        date: cashTxDate,
        category: 'Tessere',
        income: cashAmount,
        expense: null,
        method: cashMethod,
        description: `Quota Tessera ${getInsuranceDisplayLabel(insuranceType, profile)} (${
          effectiveValidity === 'tessera_365' ? 'Tessera 365' : 'Solare'
        }) - ${updatedMember.childName}`,
      });
    }

    setEditingCardMember(null);
    setBannerMsg(
      `Tessera di "${updatedMember.childName}" aggiornata (N° ${updatedMember.membershipCardNumber}, Scad. ${updatedMember.expiryDate}) e sincronizzata automaticamente con l'Anagrafica Soci${
        recordInCashFlow && isPaid ? ` e registrata nel Flusso di Cassa in data ${cashTxDate}` : ''
      }!`
    );
  };

  const handleCreateNewCardAndMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim()) return;

    const can365 = isTessera365Eligible(newIssueDate);
    const effectiveVal: CardValidityType =
      newValType === 'tessera_365' && can365 ? 'tessera_365' : 'solare';
    const computedExp = calculateCardExpiryDate(newIssueDate, effectiveVal);

    const created = onAddMember({
      childName: newChildName.trim(),
      birthDate: '',
      birthPlace: '',
      group: newGroup,
      childFiscalCode: '',
      childAddress: '',
      parentName: newParentName.trim(),
      parentFiscalCode: '',
      parentPhone: newParentPhone.trim(),
      parentEmail: newParentEmail.trim(),
      membershipCardNumber: newCardNum.trim() || 'In emissione US ACLI',
      isPaid: newIsPaid,
      cardIssueDate: newIssueDate,
      expiryDate: computedExp,
      cardValidityType: effectiveVal,
      insuranceType: newInsType,
      photoConsent: true,
      allergies: '',
      notesConditions: '',
      formSignedAndArchived: false,
      confirmationEmailSent: false,
    });

    if (newRecordCash && newIsPaid && newCashAmount > 0) {
      onAddTransaction({
        date: newCashDate,
        category: 'Tessere',
        income: newCashAmount,
        expense: null,
        method: newCashMethod,
        description: `Nuova Tessera ${getInsuranceDisplayLabel(newInsType, profile)} - ${created.childName}`,
      });
    }

    setIsNewCardModalOpen(false);
    setNewChildName('');
    setNewParentName('');
    setNewParentEmail('');
    setNewParentPhone('');
    setNewCardNum('');
    setBannerMsg(
      `Nuova tessera creata per "${created.childName}" e socio aggiunto automaticamente in Anagrafica!`
    );
  };

  const getInsuranceBadgeClass = (type: InsuranceType) => {
    switch (type) {
      case 'Platinum':
        return 'text-purple-800 bg-purple-50 border-purple-200';
      case 'Gold':
        return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'Summer':
        return 'text-emerald-800 bg-emerald-50 border-emerald-200';
      case 'Base':
      default:
        return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  const editEligible365 = isTessera365Eligible(issueDate);
  const newEligible365 = isTessera365Eligible(newIssueDate);

  return (
    <div className="space-y-5">
      {/* Header Card & Quick Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-900 font-mono text-[10px] font-bold uppercase">
              <CreditCard className="w-3 h-3" />
              Sezione Autonoma Sincronizzata
            </span>
            <h3 className="font-bold text-slate-900 text-base">
              Gestione Tessere US ACLI, Coperture Assicurative & Tessere Digitali ({profile.activeYear})
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            In questa sezione gestisci <strong>esclusivamente le tessere e le coperture assicurative</strong>{' '}
            in modo rapido e separato dai dettagli anagrafici. Ogni modifica o rinnovo fatto qui{' '}
            <strong>aggiorna automaticamente l&apos;Anagrafica Soci e gli Eventi</strong>. I soci degli
            anni passati che non partecipano ad attività restano salvati senza generare notifiche.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onOpenDigitalCardModal(members[0])}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors shadow-2xs"
            title="Personalizza la grafica della Tessera Digitale PDF, lo sfondo e i nomi delle polizze assicurative"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
            <span>Grafica Tessera Digitale & Nomi Polizze</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToMembers}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Vai alla vista Anagrafica Soci completa"
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            id="btn-cards-new-card"
            type="button"
            onClick={() => setIsNewCardModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova Tessera</span>
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs flex items-center justify-between gap-3">
          <span className="font-medium">{bannerMsg}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="font-bold text-emerald-800 px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Strip for Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">Tessere Attive e Regolari</div>
          <div className="text-xl font-extrabold text-emerald-700 font-mono mt-1">
            {stats.activeCount}{' '}
            <span className="text-xs font-normal text-slate-400">/ {members.length}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Numero assegnato e quota pagata</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">Formula &quot;Tessera 365&quot;</div>
          <div className="text-xl font-extrabold text-purple-700 font-mono mt-1">
            {stats.tessera365Count}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Validità 12 mesi (dal 1° Settembre)</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">
            Iscritti a Eventi da Rinnovare
          </div>
          <div className="text-xl font-extrabold text-rose-700 font-mono mt-1">
            {stats.enrolledNeedsRenewalCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Generano notifica perché iscritti ad attività
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">
            Soci in Archivio Non Attivi Quest&apos;Anno
          </div>
          <div className="text-xl font-extrabold text-slate-700 font-mono mt-1">
            {Math.max(0, stats.expiredCount - stats.enrolledNeedsRenewalCount)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Conservati in archivio (0 notifiche)
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca per numero tessera, bimbo o genitore..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          <select
            value={selectedInsurance}
            onChange={(e) => setSelectedInsurance(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">Tutte le Polizze Assicurative</option>
            <option value="Platinum">{getInsuranceDisplayLabel('Platinum', profile)}</option>
            <option value="Gold">{getInsuranceDisplayLabel('Gold', profile)}</option>
            <option value="Summer">{getInsuranceDisplayLabel('Summer', profile)}</option>
            <option value="Base">{getInsuranceDisplayLabel('Base', profile)}</option>
          </select>

          <select
            value={selectedCardStatus}
            onChange={(e) => setSelectedCardStatus(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
          >
            <option value="ALL">Tutti gli Stati Tessera ({members.length})</option>
            <option value="ACTIVE">Tessere Attive e Pagate</option>
            <option value="ENROLLED_NEEDS_RENEWAL">
              Iscritti ad Attività con Tessera da Rinnovare
            </option>
            <option value="EXPIRED">Tessere Scadute (anche soci non attivi)</option>
            <option value="UNPAID_OR_MISSING">Senza Numero / Quota da Pagare</option>
            <option value="TESSERA_365">Solo Formula &quot;Tessera 365&quot;</option>
          </select>
        </div>
      </div>

      {/* Cards Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th
                  onClick={() => handleToggleSort('membershipCardNumber')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                >
                  N° Tessera US ACLI {renderSortIcon('membershipCardNumber')}
                </th>
                <th className="py-2.5 px-4 select-none">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleSort('childName')}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded uppercase text-[10px] font-bold transition ${
                        sortField === 'childName'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'hover:bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      Socio {renderSortIcon('childName')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSort('parentName')}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded uppercase text-[10px] font-bold transition ${
                        sortField === 'parentName'
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'hover:bg-slate-200/70 text-slate-600'
                      }`}
                    >
                      Genitore {renderSortIcon('parentName')}
                    </button>
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('insuranceType')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                >
                  Polizza Assicurativa {renderSortIcon('insuranceType')}
                </th>
                <th
                  onClick={() => handleToggleSort('cardValidityType')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                >
                  Formula & Emissione {renderSortIcon('cardValidityType')}
                </th>
                <th
                  onClick={() => handleToggleSort('expiryDate')}
                  className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                >
                  Scadenza {renderSortIcon('expiryDate')}
                </th>
                <th
                  onClick={() => handleToggleSort('isPaid')}
                  className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                >
                  Stato Tessera {renderSortIcon('isPaid')}
                </th>
                <th className="py-3 px-4 text-right">Azioni Rapide Tessera</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {members.length === 0
                      ? 'Nessuna tessera presente. Clicca su "Nuova Tessera" o importa l\'anagrafica soci.'
                      : 'Nessuna tessera corrisponde ai filtri selezionati.'}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => {
                  const st = getMemberCardState(m);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono">
                        {st.hasValidNumber ? (
                          <span className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            {m.membershipCardNumber}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditCardModal(m, false)}
                            className="text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded text-[11px] font-sans font-semibold"
                          >
                            + Assegna N° Tessera
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                          <span>{m.childName}</span>
                          {st.isEnrolledInActivity && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold"
                              title={`Iscritto a: ${st.activeBookings
                                .map((b) => b.eventName)
                                .join(', ')}`}
                            >
                              Iscritto Attività ({st.activeBookings.length})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Genitore: {m.parentName || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-sm text-[11px] font-semibold border ${getInsuranceBadgeClass(
                            m.insuranceType
                          )}`}
                        >
                          {getInsuranceDisplayLabel(m.insuranceType, profile)}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {m.cardValidityType === 'tessera_365' ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-semibold text-[10px]">
                              Tessera 365 (12 mesi)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium">
                              Solare (31/12)
                            </span>
                          )}
                        </div>
                        {m.cardIssueDate && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Emessa: {m.cardIssueDate}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono">
                        <span
                          className={
                            st.isExpired
                              ? 'text-rose-700 font-bold'
                              : st.isExpiringSoon
                              ? 'text-amber-700 font-bold'
                              : 'text-slate-800'
                          }
                        >
                          {m.expiryDate || 'N/D'}
                        </span>
                        {m.cardHistory && m.cardHistory.length > 0 && (
                          <div
                            className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5 mt-0.5"
                            title={`Storico tessere precedenti: ${m.cardHistory
                              .map((h) => `${h.cardNumber} (${h.expiryDate})`)
                              .join(', ')}`}
                          >
                            <History className="w-2.5 h-2.5" />
                            <span>{m.cardHistory.length} prec.</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {st.isActiveAndOk ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" /> Attiva & Pagata
                          </span>
                        ) : st.isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            {st.isEnrolledInActivity
                              ? 'Scaduta (Iscritto Evento!)'
                              : 'Scaduta (Non iscritto)'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px]">
                            <XCircle className="w-3 h-3" />
                            {!m.isPaid ? 'Quota da pagare' : 'N° da assegnare'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditCardModal(m, false)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Modifica numero tessera, assicurazione, scadenza o pagamento"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Modifica Tessera</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditCardModal(m, true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
                            title="Rinnova la tessera per il nuovo anno o con formula Tessera 365"
                          >
                            <CalendarCheck className="w-3.5 h-3.5" />
                            <span>Rinnova</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenDigitalCardModal(m)}
                            className="p-1.5 text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                            title="Genera e scarica la Tessera Digitale PDF per questo socio"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectMemberForReceipt(m)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Genera Ricevuta PDF quota tessera"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: EDIT / RENEW SINGLE CARD */}
      {editingCardMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Gestione Tessera: {editingCardMember.childName}
                </h3>
                <p className="text-xs text-slate-500">
                  Genitore: {editingCardMember.parentName || '-'} · Sincronizzato con Anagrafica Soci
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCardMember(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCardUpdate} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Numero Tessera US ACLI
                  </label>
                  <input
                    type="text"
                    placeholder="Es. 26ACLI00123"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Tipo Assicurazione
                  </label>
                  <select
                    value={insuranceType}
                    onChange={(e) => setInsuranceType(e.target.value as InsuranceType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                  >
                    <option value="Gold">{getInsuranceDisplayLabel('Gold', profile)}</option>
                    <option value="Platinum">{getInsuranceDisplayLabel('Platinum', profile)}</option>
                    <option value="Summer">{getInsuranceDisplayLabel('Summer', profile)}</option>
                    <option value="Base">{getInsuranceDisplayLabel('Base', profile)}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Data Emissione
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => {
                      const nextIssue = e.target.value;
                      setIssueDate(nextIssue);
                      const can365 = isTessera365Eligible(nextIssue);
                      const nextVal: CardValidityType =
                        validityType === 'tessera_365' && can365 ? 'tessera_365' : 'solare';
                      setValidityType(nextVal);
                      setExpiryDate(calculateCardExpiryDate(nextIssue, nextVal));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Formula Validità
                  </label>
                  <select
                    value={validityType}
                    onChange={(e) => {
                      const nextVal = e.target.value as CardValidityType;
                      setValidityType(nextVal);
                      setExpiryDate(calculateCardExpiryDate(issueDate, nextVal));
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="solare">Solare (31/12)</option>
                    <option value="tessera_365" disabled={!editEligible365}>
                      Tessera 365 (dal 1° Set)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Data Scadenza
                  </label>
                  <input
                    type="text"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold bg-slate-50"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-600"
                  />
                  <span>Quota Tessera Pagata</span>
                </label>

                {editingCardMember.membershipCardNumber && (
                  <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                    <input
                      type="checkbox"
                      checked={archivePreviousCard}
                      onChange={(e) => setArchivePreviousCard(e.target.checked)}
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span>
                      Archivia tessera precedente ({editingCardMember.membershipCardNumber}) nello
                      storico
                    </span>
                  </label>
                )}
              </div>

              {/* Optional CashFlow Registration with Date Choice (Today vs Custom Date) */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-900">
                  <input
                    type="checkbox"
                    checked={recordInCashFlow}
                    onChange={(e) => setRecordInCashFlow(e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-600"
                  />
                  <span>Registra incasso quota tessera nel Flusso di Cassa</span>
                </label>

                {recordInCashFlow && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Importo Quota (€)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={cashAmount}
                          onChange={(e) => setCashAmount(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Canale Pagamento
                        </label>
                        <select
                          value={cashMethod}
                          onChange={(e) => setCashMethod(e.target.value as PaymentMethod)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="Bonifico">Bonifico</option>
                          <option value="Contanti">Contanti</option>
                          <option value="POS">POS</option>
                          <option value="Paypal">Paypal</option>
                        </select>
                      </div>
                    </div>

                    <TransactionDateSelector
                      value={cashTxDate}
                      onChange={setCashTxDate}
                      compact
                      idPrefix="card-edit-tx-date"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCardMember(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Salva Tessera & Sincronizza Anagrafica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ISSUE NEW CARD (AND AUTO-CREATE IN ANAGRAFICA) */}
      {isNewCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Emetti Nuova Tessera (+ Sincronizzazione Automatica Anagrafica)
                </h3>
                <p className="text-xs text-slate-500">
                  Il nuovo tesserato verrà inserito automaticamente anche in Anagrafica Soci.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCardModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewCardAndMember} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">
                    Nome e Cognome Socio (Bimbo/a) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newChildName}
                    onChange={(e) => setNewChildName(e.target.value)}
                    placeholder="Es. Lorenzo Bianchi"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Fascia Età</label>
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value as AgeGroup)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="3-6">3-6 anni</option>
                    <option value="6-11">6-11 anni</option>
                    <option value="11-14">11-14 anni</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Genitore</label>
                  <input
                    type="text"
                    value={newParentName}
                    onChange={(e) => setNewParentName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Telefono</label>
                  <input
                    type="text"
                    value={newParentPhone}
                    onChange={(e) => setNewParentPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={newParentEmail}
                    onChange={(e) => setNewParentEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">N° Tessera US ACLI</label>
                  <input
                    type="text"
                    placeholder="Es. 26ACLI0099"
                    value={newCardNum}
                    onChange={(e) => setNewCardNum(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Assicurazione</label>
                  <select
                    value={newInsType}
                    onChange={(e) => setNewInsType(e.target.value as InsuranceType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Gold">{getInsuranceDisplayLabel('Gold', profile)}</option>
                    <option value="Platinum">{getInsuranceDisplayLabel('Platinum', profile)}</option>
                    <option value="Summer">{getInsuranceDisplayLabel('Summer', profile)}</option>
                    <option value="Base">{getInsuranceDisplayLabel('Base', profile)}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Data Emissione</label>
                  <input
                    type="date"
                    value={newIssueDate}
                    onChange={(e) => {
                      const d = e.target.value;
                      setNewIssueDate(d);
                      if (!isTessera365Eligible(d) && newValType === 'tessera_365') {
                        setNewValType('solare');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Formula Validità</label>
                <select
                  value={newValType}
                  onChange={(e) => setNewValType(e.target.value as CardValidityType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="solare">
                    Ordinaria Solare (Scade il {calculateCardExpiryDate(newIssueDate, 'solare')})
                  </option>
                  <option value="tessera_365" disabled={!newEligible365}>
                    Tessera 365 (Scade il {calculateCardExpiryDate(newIssueDate, 'tessera_365')} —
                    dal 1° Settembre)
                  </option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={newIsPaid}
                      onChange={(e) => setNewIsPaid(e.target.checked)}
                    />
                    <span>Quota Pagata</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-emerald-900">
                    <input
                      type="checkbox"
                      checked={newRecordCash}
                      onChange={(e) => setNewRecordCash(e.target.checked)}
                    />
                    <span>Registra incasso nel Flusso di Cassa</span>
                  </label>
                </div>

                {newRecordCash && newIsPaid && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">Importo (€)</label>
                        <input
                          type="number"
                          value={newCashAmount}
                          onChange={(e) => setNewCashAmount(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">Canale</label>
                        <select
                          value={newCashMethod}
                          onChange={(e) => setNewCashMethod(e.target.value as PaymentMethod)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="Bonifico">Bonifico</option>
                          <option value="Contanti">Contanti</option>
                          <option value="POS">POS</option>
                          <option value="Paypal">Paypal</option>
                        </select>
                      </div>
                    </div>

                    <TransactionDateSelector
                      value={newCashDate}
                      onChange={setNewCashDate}
                      compact
                      idPrefix="new-card-tx-date"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCardModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Emetti Tessera & Aggiungi Socio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
