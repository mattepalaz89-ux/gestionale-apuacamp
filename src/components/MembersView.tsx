import React, { useState, useMemo } from 'react';
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Receipt,
  Download,
  Upload,
  Users,
  Send,
  Trash2,
  Edit3,
  RefreshCw,
  CreditCard,
  CalendarCheck,
  FileText,
  ExternalLink,
  Save,
  History,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileSignature,
  Ticket,
} from 'lucide-react';
import {
  Member,
  InsuranceType,
  AgeGroup,
  CardValidityType,
  AssociationProfile,
  PaymentMethod,
  CashTransaction,
  GoogleFormFieldConfig,
} from '../types';
import { exportMembersToCSV } from '../utils/export';
import {
  downloadEmptyExcelTemplate,
  readUploadedSpreadsheetRows,
  parseMembersFromRows,
  isTessera365Eligible,
  calculateCardExpiryDate,
  parseMembersFromGoogleFormResponses,
} from '../utils/csvExcelImporter';
import { parseAnyDate, diffDays } from '../utils/notifications';
import {
  createGoogleFormForActivity,
  fetchGoogleFormResponses,
  createAndPopulateSpreadsheet,
  updateMembersGoogleSheet,
} from '../services/googleWorkspace';
import { GoogleFormBuilderModal } from './GoogleFormBuilderModal';
import { MemberDataConsentModal } from './MemberDataConsentModal';
import { getInsuranceDisplayLabel } from '../utils/digitalCard';
import { TransactionDateSelector } from './TransactionDateSelector';
import {
  formatEuro,
  MemberSortField,
  SortDirection,
  sortMembersList,
} from '../utils/finance';

interface MembersViewProps {
  members: Member[];
  profile: AssociationProfile;
  googleUserEmail: string | null;
  onAddMember: (member: Omit<Member, 'id'>) => void;
  onImportMembers: (members: Member[], mode: 'append' | 'replace') => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  onUpdateProfile: (profile: AssociationProfile) => void;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onSelectMemberForReceipt: (member: Member) => void;
  onOpenDigitalCardModal?: (member?: Member) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  members,
  profile,
  googleUserEmail,
  onAddMember,
  onImportMembers,
  onUpdateMember,
  onDeleteMember,
  onUpdateProfile,
  onAddTransaction,
  onSelectMemberForReceipt,
  onOpenDigitalCardModal,
}) => {
  // Sub-view mode: 'registry' (Anagrafica Completa) vs 'renewals' (Sezione Nuove Tessere & Rinnovi / Tessera 365)
  const [subView, setSubView] = useState<'registry' | 'renewals'>('registry');

  const [search, setSearch] = useState('');
  const [selectedInsurance, setSelectedInsurance] = useState<string>('ALL');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [sortField, setSortField] = useState<MemberSortField>('childName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [consentModalMember, setConsentModalMember] = useState<Member | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [importBannerMsg, setImportBannerMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [customFormIdInput, setCustomFormIdInput] = useState(profile.membersGoogleFormId || '');

  // Primo tap ordina A->Z (asc), secondo tap sulla stessa colonna inverte Z->A (desc)
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

  // Card Renewal / Issue Modal State
  const [renewalMember, setRenewalMember] = useState<Member | null>(null);
  const [renewIssueDate, setRenewIssueDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [renewValidityType, setRenewValidityType] = useState<CardValidityType>('solare');
  const [renewCardNumber, setRenewCardNumber] = useState<string>('');
  const [renewInsurance, setRenewInsurance] = useState<InsuranceType>('Gold');
  const [renewIsPaid, setRenewIsPaid] = useState<boolean>(true);
  const [renewAmount, setRenewAmount] = useState<number>(20);
  const [renewMethod, setRenewMethod] = useState<PaymentMethod>('Bonifico');
  const [renewRecordCash, setRenewRecordCash] = useState<boolean>(true);
  const [renewCashDateMode, setRenewCashDateMode] = useState<'today' | 'custom'>('today');
  const [renewCashCustomDate, setRenewCashCustomDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // New member form state
  const defaultIssueDate = new Date().toISOString().slice(0, 10);
  const [newMemberRecordCash, setNewMemberRecordCash] = useState<boolean>(false);
  const [newMemberCashAmount, setNewMemberCashAmount] = useState<number>(20);
  const [newMemberCashMethod, setNewMemberCashMethod] = useState<PaymentMethod>('Bonifico');
  const [newMemberCashDateMode, setNewMemberCashDateMode] = useState<'today' | 'custom'>('today');
  const [newMemberCashCustomDate, setNewMemberCashCustomDate] = useState<string>(defaultIssueDate);
  const [formData, setFormData] = useState<Omit<Member, 'id'>>({
    childName: '',
    birthDate: '',
    birthPlace: '',
    group: '6-11',
    childFiscalCode: '',
    childAddress: '',
    parentName: '',
    parentFiscalCode: '',
    parentPhone: '',
    parentEmail: '',
    membershipCardNumber: '',
    isPaid: true,
    cardIssueDate: defaultIssueDate,
    expiryDate: calculateCardExpiryDate(defaultIssueDate, 'solare'),
    cardValidityType: 'solare',
    insuranceType: 'Gold',
    photoConsent: true,
    allergies: '',
    notesConditions: '',
    formSignedAndArchived: false,
    voucherBalance: 0,
    voucherNotes: '',
    needsLevelUp: false,
    confirmationEmailSent: false,
  });

  // Helper to convert Member[] to 2D sheet rows for Google Sheets sync
  const buildMembersSheetRows = (list: Member[]): (string | number | boolean)[][] => [
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
      'Modulo Firmato',
      'Tipo Validità',
    ],
    ...list.map((m) => [
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
      m.formSignedAndArchived ? 'SI' : 'NO',
      m.cardValidityType === 'tessera_365' ? 'Tessera 365' : 'Solare (31/12)',
    ]),
  ];

  // Auto-sync to linked Google Sheet if configured
  const syncWithLinkedGoogleSheet = async (updatedList: Member[]) => {
    if (!googleUserEmail || !profile.membersGoogleSheetId) return;
    try {
      await updateMembersGoogleSheet(
        profile.membersGoogleSheetId,
        buildMembersSheetRows(updatedList)
      );
    } catch (e) {
      console.error('Background sheet sync warning:', e);
    }
  };

  // Filtered & sorted members for registry view
  const filteredMembers = useMemo(() => {
    const filtered = members.filter((m) => {
      if (selectedInsurance !== 'ALL' && m.insuranceType !== selectedInsurance) return false;
      if (selectedGroup !== 'ALL' && m.group !== selectedGroup) return false;
      if (selectedStatus === 'PAID' && !m.isPaid) return false;
      if (selectedStatus === 'UNPAID' && m.isPaid) return false;
      if (selectedStatus === 'TESSERA_365' && m.cardValidityType !== 'tessera_365') return false;
      if (selectedStatus === 'WITH_VOUCHER' && !(m.voucherBalance && m.voucherBalance > 0))
        return false;
      if (selectedStatus === 'UNSIGNED_FORM' && m.formSignedAndArchived) return false;
      if (selectedStatus === 'EMAIL_PENDING' && m.confirmationEmailSent !== false) return false;
      if (selectedStatus === 'MEDICAL' && !m.allergies && !m.notesConditions) return false;
      if (selectedStatus === 'NO_PHOTO' && m.photoConsent) return false;

      if (search) {
        const q = search.toLowerCase();
        const nameMatch = m.childName.toLowerCase().includes(q);
        const parentMatch = m.parentName.toLowerCase().includes(q);
        const cfMatch = (m.childFiscalCode || '').toLowerCase().includes(q);
        const phoneMatch = (m.parentPhone || '').includes(q);
        const cardMatch = (m.membershipCardNumber || '').toLowerCase().includes(q);
        return nameMatch || parentMatch || cfMatch || phoneMatch || cardMatch;
      }
      return true;
    });
    return sortMembersList(filtered, sortField, sortDirection);
  }, [members, selectedInsurance, selectedGroup, selectedStatus, search, sortField, sortDirection]);

  // Members needing card renewal or new card
  const membersNeedingRenewal = useMemo(() => {
    return members.filter((m) => {
      const cardNum = (m.membershipCardNumber || '').trim();
      if (!cardNum || cardNum.toLowerCase().includes('attesa') || cardNum.toLowerCase().includes('assegnare')) {
        return true;
      }
      if (!m.isPaid) return true;
      const exp = parseAnyDate(m.expiryDate);
      if (!exp) return true;
      return diffDays(exp) <= 60;
    });
  }, [members]);

  // Create new member handler
  const handleSaveNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.childName.trim()) return;

    const canUse365 = isTessera365Eligible(formData.cardIssueDate);
    const finalValidity: CardValidityType =
      formData.cardValidityType === 'tessera_365' && canUse365 ? 'tessera_365' : 'solare';
    const finalExpiry =
      formData.expiryDate ||
      calculateCardExpiryDate(formData.cardIssueDate || defaultIssueDate, finalValidity);

    const newMemberPayload: Omit<Member, 'id'> = {
      ...formData,
      cardValidityType: finalValidity,
      expiryDate: finalExpiry,
    };

    onAddMember(newMemberPayload);

    if (newMemberRecordCash && formData.isPaid && newMemberCashAmount > 0) {
      const txDate =
        newMemberCashDateMode === 'today'
          ? new Date().toISOString().slice(0, 10)
          : newMemberCashCustomDate;
      onAddTransaction({
        date: txDate,
        category: 'Tessere',
        income: newMemberCashAmount,
        expense: null,
        method: newMemberCashMethod,
        description: `Nuova Tessera ${
          finalValidity === 'tessera_365' ? '365' : 'Annuale'
        } (${formData.insuranceType}) - ${formData.childName}`,
      });
    }

    setIsAddModalOpen(false);
    setImportBannerMsg({
      type: 'ok',
      text: `Socio "${formData.childName}" aggiunto in Anagrafica (${
        finalValidity === 'tessera_365' ? 'Tessera 365' : 'Tessera Solare'
      } - Scad. ${finalExpiry}).`,
    });
  };

  // Save edited member handler
  const handleSaveEditedMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    onUpdateMember(editingMember);
    const nextList = members.map((m) => (m.id === editingMember.id ? editingMember : m));
    await syncWithLinkedGoogleSheet(nextList);
    setEditingMember(null);
    setImportBannerMsg({
      type: 'ok',
      text: `Anagrafica di "${editingMember.childName}" aggiornata con successo!`,
    });
  };

  // Open Renewal Modal for a Member
  const openRenewalModal = (member: Member) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const eligible365 = isTessera365Eligible(todayIso);
    const initialValType: CardValidityType = eligible365 ? 'tessera_365' : 'solare';

    setRenewalMember(member);
    setRenewIssueDate(todayIso);
    setRenewValidityType(initialValType);
    setRenewCardNumber('');
    setRenewInsurance(member.insuranceType || 'Gold');
    setRenewIsPaid(true);
    setRenewAmount(member.insuranceType === 'Platinum' ? 25 : 20);
    setRenewMethod('Bonifico');
    setRenewRecordCash(true);
    setRenewCashDateMode('today');
    setRenewCashCustomDate(todayIso);
  };

  // Confirm Renewal / New Card
  const handleConfirmRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewalMember) return;

    const eligible365 = isTessera365Eligible(renewIssueDate);
    const effectiveValidity: CardValidityType =
      renewValidityType === 'tessera_365' && eligible365 ? 'tessera_365' : 'solare';
    const computedExpiry = calculateCardExpiryDate(renewIssueDate, effectiveValidity);

    // Archive old card in history if present
    const previousHistory = renewalMember.cardHistory || [];
    const updatedHistory = renewalMember.membershipCardNumber
      ? [
          {
            id: `ch-${Date.now()}`,
            cardNumber: renewalMember.membershipCardNumber,
            issueDate: renewalMember.cardIssueDate || 'Storico',
            expiryDate: renewalMember.expiryDate || '-',
            validityType: renewalMember.cardValidityType || 'solare',
            insuranceType: renewalMember.insuranceType,
          },
          ...previousHistory,
        ]
      : previousHistory;

    const updatedMember: Member = {
      ...renewalMember,
      membershipCardNumber: renewCardNumber.trim() || 'In emissione US ACLI',
      cardIssueDate: renewIssueDate,
      expiryDate: computedExpiry,
      cardValidityType: effectiveValidity,
      insuranceType: renewInsurance,
      isPaid: renewIsPaid,
      confirmationEmailSent: false,
      cardHistory: updatedHistory,
    };

    onUpdateMember(updatedMember);

    if (renewRecordCash && renewIsPaid && renewAmount > 0) {
      const txDate =
        renewCashDateMode === 'today'
          ? new Date().toISOString().slice(0, 10)
          : renewCashCustomDate;
      onAddTransaction({
        date: txDate,
        category: 'Tessere',
        income: renewAmount,
        expense: null,
        method: renewMethod,
        description: `Rinnovo Tessera ${
          effectiveValidity === 'tessera_365' ? '365' : 'Annuale'
        } (${renewInsurance}) - ${renewalMember.childName}`,
      });
    }

    const nextList = members.map((m) => (m.id === updatedMember.id ? updatedMember : m));
    await syncWithLinkedGoogleSheet(nextList);

    setRenewalMember(null);
    setImportBannerMsg({
      type: 'ok',
      text: `Tessera rinnovata per ${updatedMember.childName}! Formula: ${
        effectiveValidity === 'tessera_365' ? 'Tessera 365 (12 mesi)' : 'Ordinaria 31/12'
      } — Nuova scadenza: ${computedExpiry}.`,
    });
  };

  // Excel / CSV Upload
  const handleUploadExcelOrCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readUploadedSpreadsheetRows(file);
      const parsed = parseMembersFromRows(rows);
      if (parsed.length === 0) {
        setImportBannerMsg({
          type: 'err',
          text: 'Nessun socio trovato nel file caricato. Verifica di usare le colonne del Modello Vuoto.',
        });
      } else {
        onImportMembers(parsed, 'append');
        await syncWithLinkedGoogleSheet([...parsed, ...members]);
        setImportBannerMsg({
          type: 'ok',
          text: `Importati con successo ${parsed.length} soci dal file "${file.name}"!`,
        });
      }
    } catch (err: any) {
      setImportBannerMsg({
        type: 'err',
        text: err?.message || 'Errore nella lettura del file Excel/CSV.',
      });
    } finally {
      e.target.value = '';
    }
  };

  // Create dedicated Google Form + Linked Google Sheet for Anagrafica Soci with customized fields
  const handleCreateAndLinkGoogleFormSoci = async (customParams?: {
    title: string;
    description: string;
    fields: GoogleFormFieldConfig[];
  }) => {
    if (!googleUserEmail) {
      setImportBannerMsg({
        type: 'err',
        text: 'Effettua prima l\'accesso con il tuo account Google (in alto o in Google Workspace) per creare il Modulo Google e il Foglio Anagrafica Soci sul tuo Drive.',
      });
      return;
    }

    const confirmed = confirm(
      'Vuoi generare nella cartella Google Drive "Gestionale ASD / 01_Anagrafica_Soci_e_Tessere":\n1) Il Modulo Google personalizzato con i campi scelti per l\'Anagrafica Soci\n2) Il File Google Sheets "Anagrafica_Soci" sincronizzato direttamente col gestionale?'
    );
    if (!confirmed) return;

    setIsSyncingGoogle(true);
    setImportBannerMsg(null);
    try {
      const createdForm = await createGoogleFormForActivity({
        title:
          customParams?.title || `Modulo Iscrizione & Anagrafica Soci - ${profile.name}`,
        description:
          customParams?.description ||
          'Compila i dati anagrafici del bambino/a e del genitore, indica eventuali bisogni speciali o allergie e scegli il livello assicurativo.',
        formType: 'tesseramento',
        customFields: customParams?.fields,
      });

      const createdSheet = await createAndPopulateSpreadsheet(
        `Anagrafica_Soci_${profile.name.replace(/\s+/g, '_')}_${profile.activeYear}`,
        [{ sheetTitle: 'Anagrafica_Soci', rows: buildMembersSheetRows(members) }],
        'anagrafica_soci'
      );

      const updatedProfile: AssociationProfile = {
        ...profile,
        membersGoogleFormId: createdForm.formId,
        membersGoogleFormUrl: createdForm.responderUri,
        membersGoogleSheetId: createdSheet.spreadsheetId,
        membersGoogleSheetUrl: createdSheet.spreadsheetUrl,
      };
      onUpdateProfile(updatedProfile);
      setCustomFormIdInput(createdForm.formId);
      setIsFormBuilderOpen(false);

      setImportBannerMsg({
        type: 'ok',
        text: 'Modulo Google Anagrafica Soci (con i campi personalizzati e standard) e Foglio Google Sheets salvati nella cartella Google Drive "Gestionale ASD / 01_Anagrafica_Soci_e_Tessere"!',
      });
    } catch (err: any) {
      setImportBannerMsg({
        type: 'err',
        text: err?.message || 'Errore nella creazione del Modulo Google / Foglio Soci.',
      });
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  // Pull responses from the Google Form directly into Anagrafica Soci AND update the Google Sheet
  const handleSyncFromGoogleFormSoci = async () => {
    if (!googleUserEmail) {
      setImportBannerMsg({
        type: 'err',
        text: 'Connetti prima il tuo account Google per leggere le risposte del Modulo Google.',
      });
      return;
    }

    const rawId = (customFormIdInput || profile.membersGoogleFormId || '').trim();
    if (!rawId) {
      setImportBannerMsg({
        type: 'err',
        text: 'Crea prima il Modulo Google con il pulsante "Crea Modulo + Foglio Google" oppure incolla l\'ID del tuo Google Form.',
      });
      return;
    }

    // Extract formId if user pasted a full URL like https://docs.google.com/forms/d/12345/edit
    const matchUrl = rawId.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
    const formId = matchUrl ? matchUrl[1] : rawId;

    setIsSyncingGoogle(true);
    setImportBannerMsg(null);
    try {
      const formDataRes = await fetchGoogleFormResponses(formId);
      const { added, updatedCount } = parseMembersFromGoogleFormResponses(
        formDataRes.responses,
        members
      );

      if (added.length > 0) {
        onImportMembers(added, 'append');
      }

      const fullUpdatedList = [...added, ...members];

      // Also write directly into the user's Google Sheet on Drive (creating it if not yet created)
      let sheetUrl = profile.membersGoogleSheetUrl;
      let sheetId = profile.membersGoogleSheetId;
      if (sheetId) {
        sheetUrl = await updateMembersGoogleSheet(sheetId, buildMembersSheetRows(fullUpdatedList));
      } else {
        const createdSheet = await createAndPopulateSpreadsheet(
          `Anagrafica_Soci_${profile.name.replace(/\s+/g, '_')}_${profile.activeYear}`,
          [{ sheetTitle: 'Anagrafica_Soci', rows: buildMembersSheetRows(fullUpdatedList) }]
        );
        sheetId = createdSheet.spreadsheetId;
        sheetUrl = createdSheet.spreadsheetUrl;
      }

      onUpdateProfile({
        ...profile,
        membersGoogleFormId: formId,
        membersGoogleSheetId: sheetId,
        membersGoogleSheetUrl: sheetUrl,
      });

      setImportBannerMsg({
        type: 'ok',
        text: `Sincronizzazione completata da "${formDataRes.formTitle}": ${added.length} nuovi soci aggiunti in Anagrafica (${updatedCount} già presenti) e salvati direttamente nel file Google Sheets sul tuo Drive!`,
      });
    } catch (err: any) {
      setImportBannerMsg({
        type: 'err',
        text: err?.message || 'Errore nella sincronizzazione delle risposte dal Google Form.',
      });
    } finally {
      setIsSyncingGoogle(false);
    }
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

  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);

  const newMemberEligible365 = isTessera365Eligible(formData.cardIssueDate);
  const renewEligible365 = isTessera365Eligible(renewIssueDate);
  const editEligible365 = editingMember
    ? isTessera365Eligible(editingMember.cardIssueDate || '2027-09-01')
    : false;

  return (
    <div className="space-y-5">
      {/* Top Sub-Navigation Switcher + Primary Actions + Collapsible Import Drawer Toggle (Soluzione 5) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSubView('registry')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                subView === 'registry'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Anagrafica Soci ({members.length})</span>
            </button>

            <button
              onClick={() => setSubView('renewals')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                subView === 'renewals'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Rinnovi & Opzione &quot;Tessera 365&quot;</span>
              {membersNeedingRenewal.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded-full bg-amber-500 text-white">
                  {membersNeedingRenewal.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenDigitalCardModal && (
              <button
                id="btn-open-digital-card-designer"
                type="button"
                onClick={() => onOpenDigitalCardModal(members[0])}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors shadow-2xs"
              >
                <CreditCard className="w-3.5 h-3.5 text-purple-700" />
                <span>Modello Tessera Digitale</span>
              </button>
            )}

            <button
              id="btn-members-toggle-import-drawer"
              type="button"
              onClick={() => setIsImportDrawerOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                isImportDrawerOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
              }`}
              title="Apri o chiudi il cassetto di importazione da Modulo Google (Google Form) o File Excel/CSV"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-600" />
              <span>Importa / Google Form & Excel {isImportDrawerOpen ? '▴' : '▾'}</span>
            </button>

            <button
              id="btn-members-new-member"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-all shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuovo Socio</span>
            </button>
          </div>
        </div>

        {/* Collapsible Drawer: Google Form -> Anagrafica Soci Sync + Excel Upload/Template (Soluzione 5) */}
        {isImportDrawerOpen && (
          <div
            id="members-import-drawer-panel"
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-150"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-0.5 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm">
                    Importazione Soci da Modulo Google (Google Form) o File Excel / CSV
                  </h3>
                  {profile.membersGoogleSheetUrl && (
                    <a
                      href={profile.membersGoogleSheetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 hover:underline"
                    >
                      <span>Apri Google Sheets Soci su Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {profile.membersGoogleFormUrl && (
                    <a
                      href={profile.membersGoogleFormUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 hover:underline"
                    >
                      <span>Apri Modulo Google Soci</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Sincronizza le risposte compilate dai genitori nel Modulo Google oppure carica un
                  foglio Excel (`.xlsx`) o CSV sul tuo PC.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => downloadEmptyExcelTemplate('soci')}
                  title="Scarica Modello Excel Vuoto (.xlsx) per Anagrafica Soci"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Modello Excel Vuoto</span>
                </button>

                <label
                  title="Importa soci da file Excel (.xlsx) o CSV"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Carica Excel/CSV</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleUploadExcelOrCsv}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="ID o Link Google Form Soci..."
                  value={customFormIdInput}
                  onChange={(e) => setCustomFormIdInput(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono w-52"
                />

                <button
                  onClick={handleSyncFromGoogleFormSoci}
                  disabled={isSyncingGoogle}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
                  title="Importa le nuove risposte dal Google Form in Anagrafica Soci e aggiorna il file Google Sheets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingGoogle ? 'animate-spin' : ''}`} />
                  <span>Sincronizza Risposte Modulo Google</span>
                </button>

                <button
                  onClick={() => setIsFormBuilderOpen(true)}
                  disabled={isSyncingGoogle}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Personalizza & Genera Modulo Google</span>
                </button>
              </div>

              {members.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Vuoi svuotare la lista soci su questo profilo?')) {
                      onImportMembers([], 'replace');
                    }
                  }}
                  title="Svuota intera Anagrafica Soci"
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Svuota Anagrafica</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {importBannerMsg && (
        <div
          className={`px-4 py-3 rounded-xl text-xs flex items-center justify-between border ${
            importBannerMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="font-medium">{importBannerMsg.text}</span>
          <button
            onClick={() => setImportBannerMsg(null)}
            className="font-bold px-2 opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* =====================================================================
          SUBVIEW 2: SEZIONE NUOVE TESSERE, RINNOVI & OPZIONE "TESSERA 365"
         ===================================================================== */}
      {subView === 'renewals' && (
        <div className="space-y-5">
          {/* Explanation & Quick Issue Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-emerald-600" />
                Emissione Tessere, Rinnovi & Formula &quot;Tessera 365&quot;
              </h3>
              <div className="flex items-center gap-3 shrink-0">
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
                  <span className="text-slate-600 block text-[10px] uppercase font-bold">
                    Tessere 365 Attive
                  </span>
                  <span className="font-mono font-bold text-emerald-800 text-base">
                    {members.filter((m) => m.cardValidityType === 'tessera_365').length}
                  </span>
                </div>
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                  <span className="text-slate-600 block text-[10px] uppercase font-bold">
                    Da Rinnovare / In Scadenza
                  </span>
                  <span className="font-mono font-bold text-amber-800 text-base">
                    {membersNeedingRenewal.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Table of members to renew or all members */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th
                      onClick={() => handleToggleSort('childName')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                    >
                      Socio (Bimbo/a) {renderSortIcon('childName')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('parentName')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                    >
                      Genitore {renderSortIcon('parentName')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('membershipCardNumber')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                    >
                      Tessera Attuale {renderSortIcon('membershipCardNumber')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('cardValidityType')}
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                    >
                      Formula Validità {renderSortIcon('cardValidityType')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('expiryDate')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                    >
                      Scadenza Attuale {renderSortIcon('expiryDate')}
                    </th>
                    <th
                      onClick={() => handleToggleSort('isPaid')}
                      className="py-3 px-4 text-center cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                    >
                      Stato {renderSortIcon('isPaid')}
                    </th>
                    <th className="py-3 px-4 text-right">Azione Rinnovo / Nuova Tessera</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400">
                        Nessun socio presente in anagrafica. Importa un file Excel/CSV o aggiungi un
                        nuovo socio.
                      </td>
                    </tr>
                  ) : (
                    sortMembersList(members, sortField, sortDirection).map((m) => {
                      const exp = parseAnyDate(m.expiryDate);
                      const days = exp ? diffDays(exp) : -1;
                      const isExpired = days < 0;
                      const isExpiring = days >= 0 && days <= 60;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-bold text-slate-900">{m.childName}</td>
                          <td className="py-3 px-4 text-slate-600">{m.parentName || '-'}</td>
                          <td className="py-3 px-4 font-mono text-slate-800">
                            {m.membershipCardNumber || (
                              <span className="text-rose-600 italic">Da assegnare</span>
                            )}{' '}
                            <span
                              className={`ml-1 px-1.5 py-0.5 rounded-sm text-[10px] border ${getInsuranceBadgeClass(
                                m.insuranceType
                              )}`}
                            >
                              {getInsuranceDisplayLabel(m.insuranceType, profile)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {m.cardValidityType === 'tessera_365' ? (
                              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-semibold text-[10px]">
                                Tessera 365 (12 mesi)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium">
                                Solare (31 Dicembre)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono">
                            {m.expiryDate || 'N/D'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isExpired || !m.isPaid ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[10px]">
                                {isExpired ? 'Scaduta' : 'Non pagata'}
                              </span>
                            ) : isExpiring ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[10px]">
                                Scade tra {days} gg
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                                Attiva ✓
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {onOpenDigitalCardModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenDigitalCardModal(m)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                                  title="Genera e invia la Tessera Digitale del socio"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Tessera Digitale</span>
                                </button>
                              )}
                              <button
                                onClick={() => openRenewalModal(m)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Inserisci Nuova Tessera / Rinnova</span>
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
        </div>
      )}

      {/* =====================================================================
          SUBVIEW 1: ANAGRAFICA COMPLETA SOCI
         ===================================================================== */}
      {subView === 'registry' && (
        <>
          {/* Search and Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[210px] flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cerca bimbo, genitore, CF, tessera..."
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
                <option value="ALL">Tutte le Assicurazioni</option>
                <option value="Platinum">{getInsuranceDisplayLabel('Platinum', profile)}</option>
                <option value="Gold">{getInsuranceDisplayLabel('Gold', profile)}</option>
                <option value="Summer">{getInsuranceDisplayLabel('Summer', profile)}</option>
                <option value="Base">{getInsuranceDisplayLabel('Base', profile)}</option>
              </select>

              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
              >
                <option value="ALL">Tutte le Età</option>
                <option value="3-6">Gruppo 3-6 anni</option>
                <option value="6-11">Gruppo 6-11 anni</option>
                <option value="11-14">Gruppo 11-14 anni</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
              >
                <option value="ALL">Tutti gli Stati</option>
                <option value="PAID">Tessera Pagata</option>
                <option value="UNPAID">Da Pagare / In Attesa</option>
                <option value="TESSERA_365">Con Tessera 365</option>
                <option value="WITH_VOUCHER">Con Buono Spesa Attivo</option>
                <option value="UNSIGNED_FORM">Modulo Firma da Ricevere</option>
                <option value="EMAIL_PENDING">Email Conferma NON Inviata</option>
                <option value="MEDICAL">Con Allergie / Note Mediche</option>
                <option value="NO_PHOTO">Senza Consenso Foto</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => exportMembersToCSV(filteredMembers)}
                title="Esporta Soci Filtrati in CSV"
                aria-label="Esporta Soci Filtrati in CSV"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Esporta CSV</span>
              </button>
            </div>
          </div>

          {/* Members Registry Grid / Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th
                      onClick={() => handleToggleSort('childName')}
                      title="Clicca per ordinare per Nome Bimbo/a (1° tap A→Z, 2° tap Z→A)"
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                    >
                      <span className="inline-flex items-center">
                        Bimbo/a & Data Nascita {renderSortIcon('childName')}
                      </span>
                    </th>
                    <th
                      onClick={() => handleToggleSort('group')}
                      title="Clicca per ordinare per Gruppo d'Età (1° tap crescente, 2° tap decrescente)"
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                    >
                      <span className="inline-flex items-center">
                        Gruppo {renderSortIcon('group')}
                      </span>
                    </th>
                    <th
                      onClick={() => handleToggleSort('parentName')}
                      title="Clicca per ordinare per Genitore (1° tap A→Z, 2° tap Z→A)"
                      className="py-3 px-4 cursor-pointer hover:bg-slate-100 hover:text-slate-900 select-none transition-colors"
                    >
                      <span className="inline-flex items-center">
                        Genitore & Contatti {renderSortIcon('parentName')}
                      </span>
                    </th>
                    <th className="py-2.5 px-4 select-none">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSort('membershipCardNumber')}
                          title="Ordina per Numero di Tessera (1° tap A→Z, 2° tap Z→A)"
                          className={`inline-flex items-center px-1.5 py-0.5 rounded uppercase text-[10px] font-bold transition ${
                            sortField === 'membershipCardNumber'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'hover:bg-slate-200/70 text-slate-600'
                          }`}
                        >
                          N° Tessera {renderSortIcon('membershipCardNumber')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSort('insuranceType')}
                          title="Ordina per Tipo Polizza (Base, Summer, Gold, Platinum)"
                          className={`inline-flex items-center px-1.5 py-0.5 rounded uppercase text-[10px] font-bold transition ${
                            sortField === 'insuranceType'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'hover:bg-slate-200/70 text-slate-600'
                          }`}
                        >
                          Tipo {renderSortIcon('insuranceType')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSort('expiryDate')}
                          title="Ordina per Data di Scadenza Tessera"
                          className={`inline-flex items-center px-1.5 py-0.5 rounded uppercase text-[10px] font-bold transition ${
                            sortField === 'expiryDate'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'hover:bg-slate-200/70 text-slate-600'
                          }`}
                        >
                          Scad. {renderSortIcon('expiryDate')}
                        </button>
                      </div>
                    </th>
                    <th className="py-2.5 px-4 text-center select-none">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleSort('isPaid')}
                          title="Ordina per Stato Pagamento Quota"
                          className={`inline-flex items-center px-1.5 py-0.5 rounded uppercase text-[10px] font-bold transition ${
                            sortField === 'isPaid'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'hover:bg-slate-200/70 text-slate-600'
                          }`}
                        >
                          Quota {renderSortIcon('isPaid')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSort('voucherBalance')}
                          title="Ordina per Credito Buono Spesa Disponibile"
                          className={`inline-flex items-center px-1.5 py-0.5 rounded uppercase text-[10px] font-bold transition ${
                            sortField === 'voucherBalance'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'hover:bg-slate-200/70 text-slate-600'
                          }`}
                        >
                          Buono {renderSortIcon('voucherBalance')}
                        </button>
                      </div>
                    </th>
                    <th className="py-3 px-4">Allergie, Note & Firma</th>
                    <th className="py-3 px-4 text-center">Azioni Rapide</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center">
                        <div className="max-w-md mx-auto space-y-2">
                          <div className="text-slate-700 font-bold text-sm">
                            {members.length === 0
                              ? 'Anagrafica Soci privata e vuota'
                              : 'Nessun socio corrisponde ai filtri selezionati'}
                          </div>
                          <p className="text-xs text-slate-400">
                            {members.length === 0
                              ? 'I dati dei soci sono privati e visibili solo sul tuo profilo connesso. Carica il tuo file Excel/CSV formattato oppure sincronizza le risposte dal tuo Modulo Google.'
                              : 'Prova a modificare i criteri di ricerca.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const hasAllergies = !!m.allergies;
                      const hasConditions = !!m.notesConditions;
                      const emailSent = m.confirmationEmailSent !== false;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{m.childName}</div>
                            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                              <span>{m.birthDate || 'Data n/d'}</span>
                              {m.birthPlace && <span>· {m.birthPlace}</span>}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-sm">
                              {m.group || '6-11'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-800">{m.parentName || '-'}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              {m.parentPhone && (
                                <a
                                  href={`tel:${m.parentPhone}`}
                                  className="text-slate-600 hover:text-emerald-700 flex items-center gap-1 font-mono"
                                >
                                  <Phone className="w-3 h-3" />
                                  {m.parentPhone}
                                </a>
                              )}
                              {m.parentEmail && (
                                <a
                                  href={`mailto:${m.parentEmail}`}
                                  className="text-slate-400 hover:text-emerald-700"
                                  title={m.parentEmail}
                                >
                                  <Mail className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold border ${getInsuranceBadgeClass(
                                  m.insuranceType
                                )}`}
                              >
                                {getInsuranceDisplayLabel(m.insuranceType, profile)}
                              </span>
                              {m.cardValidityType === 'tessera_365' && (
                                <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                  365
                                </span>
                              )}
                              <span className="font-mono text-[11px] text-slate-600">
                                {m.membershipCardNumber || (
                                  <span className="text-rose-500 italic">Senza N°</span>
                                )}
                              </span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                              Scad: {m.expiryDate || 'n/d'}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => onUpdateMember({ ...m, isPaid: !m.isPaid })}
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  m.isPaid
                                    ? 'text-emerald-700 bg-emerald-50'
                                    : 'text-rose-700 bg-rose-50'
                                }`}
                              >
                                {m.isPaid ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" /> Pagata
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-3 h-3" /> Da pagare
                                  </>
                                )}
                              </button>

                              <button
                                onClick={() =>
                                  onUpdateMember({
                                    ...m,
                                    confirmationEmailSent: !emailSent,
                                  })
                                }
                                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                  emailSent
                                    ? 'bg-slate-50 text-slate-600 border-slate-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                                }`}
                              >
                                <Send className="w-2.5 h-2.5" />
                                {emailSent ? 'Email Inviata ✓' : 'Email da Inviare !'}
                              </button>

                              {(m.voucherBalance || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setEditingMember({ ...m })}
                                  title={
                                    m.voucherNotes
                                      ? `Buono Spesa: ${m.voucherNotes}`
                                      : 'Buono spesa utilizzabile per compensare i costi delle attività'
                                  }
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-300 hover:bg-teal-100 transition"
                                >
                                  <Ticket className="w-2.5 h-2.5 text-teal-700" />
                                  <span>Buono: {formatEuro(m.voucherBalance || 0)}</span>
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            {hasAllergies && (
                              <div className="text-[11px] text-rose-700 font-semibold flex items-center gap-1 line-clamp-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {m.allergies}
                              </div>
                            )}
                            {hasConditions && (
                              <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                                {m.notesConditions}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              {!m.photoConsent && (
                                <span className="inline-block text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-sm border border-rose-200">
                                  NO FOTO
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setConsentModalMember(m)}
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm border transition ${
                                  m.formSignedAndArchived
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                }`}
                                title="Clicca per aprire, scaricare in PDF o inviare via Gmail il Modulo Riepilogo Dati da Firmare"
                              >
                                <FileSignature className="w-2.5 h-2.5" />
                                <span>
                                  {m.formSignedAndArchived ? 'Modulo Firmato ✓' : 'Modulo da Firmare'}
                                </span>
                              </button>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                id={`btn-member-consent-pdf-${m.id}`}
                                type="button"
                                onClick={() => setConsentModalMember(m)}
                                className="px-2 py-1 text-[10px] font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors flex items-center gap-1"
                                title="Scarica PDF Riepilogo Dati da Firmare o invia al genitore con Gmail"
                              >
                                <FileSignature className="w-3.5 h-3.5 text-blue-700" />
                                <span>Modulo Firma</span>
                              </button>
                              {onOpenDigitalCardModal && (
                                <button
                                  id={`btn-member-digital-card-${m.id}`}
                                  type="button"
                                  onClick={() => onOpenDigitalCardModal(m)}
                                  className="px-2 py-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors flex items-center gap-1"
                                  title="Genera e invia Tessera Digitale personalizzata (PDF/PNG/WhatsApp/Email)"
                                >
                                  <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>Tessera</span>
                                </button>
                              )}
                              <button
                                onClick={() => setEditingMember({ ...m })}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Modifica Anagrafica Completa e Buono Spesa"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => openRenewalModal(m)}
                                className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Inserisci Nuova Tessera / Rinnova (anche Tessera 365)"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  onUpdateMember({ ...m, confirmationEmailSent: true });
                                  onSelectMemberForReceipt(m);
                                }}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Emetti Ricevuta / Preventivo PDF o invia via Gmail"
                              >
                                <Receipt className="w-4 h-4" />
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
            <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap justify-between gap-2">
              <span>
                {filteredMembers.length} tesserati visualizzati su {members.length} registrati
              </span>
              <div className="flex gap-4 font-mono">
                <span>
                  Tessera 365:{' '}
                  {members.filter((m) => m.cardValidityType === 'tessera_365').length}
                </span>
                <span>Platinum: {members.filter((m) => m.insuranceType === 'Platinum').length}</span>
                <span>Gold: {members.filter((m) => m.insuranceType === 'Gold').length}</span>
                <span>Summer: {members.filter((m) => m.insuranceType === 'Summer').length}</span>
                <span>Base: {members.filter((m) => m.insuranceType === 'Base').length}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          MODAL 1: MODIFICA COMPLETA ANAGRAFICA SOCIO (TUTTI I CAMPI EDITABILI)
         ===================================================================== */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Modifica Anagrafica Socio: {editingMember.childName}
                </h3>
                <p className="text-xs text-slate-500">
                  Modifica qualsiasi dato anagrafico, assicurativo, sanitario o di tesseramento
                </p>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="text-slate-400 hover:text-slate-600 p-1 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedMember} className="mt-4 space-y-4 text-xs">
              {/* Dati Bimbo Editabili */}
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-3 border border-slate-100">
                <div className="font-semibold text-slate-900 uppercase tracking-wide text-[10px]">
                  1. Dati Anagrafici Bambino/a
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-slate-600 block mb-1 font-medium">
                      Nome e Cognome Bimbo/a *
                    </label>
                    <input
                      type="text"
                      required
                      value={editingMember.childName}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, childName: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Gruppo d'Età</label>
                    <select
                      value={editingMember.group}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          group: e.target.value as AgeGroup,
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    >
                      <option value="3-6">3-6 anni</option>
                      <option value="6-11">6-11 anni</option>
                      <option value="11-14">11-14 anni</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Data di Nascita (GG/MM/AAAA)
                    </label>
                    <input
                      type="text"
                      value={editingMember.birthDate}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, birthDate: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Luogo di Nascita
                    </label>
                    <input
                      type="text"
                      value={editingMember.birthPlace}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, birthPlace: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Codice Fiscale Bimbo/a
                    </label>
                    <input
                      type="text"
                      value={editingMember.childFiscalCode}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          childFiscalCode: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono uppercase"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-slate-600 block mb-1 font-medium">
                      Indirizzo di Residenza
                    </label>
                    <input
                      type="text"
                      value={editingMember.childAddress}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, childAddress: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Dati Genitore Editabili */}
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-3 border border-slate-100">
                <div className="font-semibold text-slate-900 uppercase tracking-wide text-[10px]">
                  2. Dati Genitore / Tutore
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Nome e Cognome Genitore
                    </label>
                    <input
                      type="text"
                      value={editingMember.parentName}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, parentName: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Codice Fiscale Genitore
                    </label>
                    <input
                      type="text"
                      value={editingMember.parentFiscalCode}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          parentFiscalCode: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Telefono Genitore
                    </label>
                    <input
                      type="text"
                      value={editingMember.parentPhone}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, parentPhone: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">Email Genitore</label>
                    <input
                      type="email"
                      value={editingMember.parentEmail}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, parentEmail: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Tessera, Assicurazione & Opzione Tessera 365 */}
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-3 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 uppercase tracking-wide text-[10px]">
                    3. Tessera US ACLI, Assicurazione & Opzione "Tessera 365"
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const m = editingMember;
                      setEditingMember(null);
                      openRenewalModal(m);
                    }}
                    className="text-[11px] font-semibold text-purple-700 hover:underline flex items-center gap-1"
                  >
                    <CreditCard className="w-3 h-3" />
                    <span>Apri Procedura Rinnovo Tessera</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Assicurazione US ACLI
                    </label>
                    <select
                      value={editingMember.insuranceType}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          insuranceType: e.target.value as InsuranceType,
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold"
                    >
                      <option value="Gold">{getInsuranceDisplayLabel('Gold', profile)}</option>
                      <option value="Platinum">{getInsuranceDisplayLabel('Platinum', profile)}</option>
                      <option value="Summer">{getInsuranceDisplayLabel('Summer', profile)}</option>
                      <option value="Base">{getInsuranceDisplayLabel('Base', profile)}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Numero Tessera US ACLI
                    </label>
                    <input
                      type="text"
                      value={editingMember.membershipCardNumber}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          membershipCardNumber: e.target.value,
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Data Emissione / Attivazione
                    </label>
                    <input
                      type="date"
                      value={editingMember.cardIssueDate || '2027-01-15'}
                      onChange={(e) => {
                        const newIssue = e.target.value;
                        const can365 = isTessera365Eligible(newIssue);
                        const nextVal: CardValidityType =
                          editingMember.cardValidityType === 'tessera_365' && can365
                            ? 'tessera_365'
                            : 'solare';
                        setEditingMember({
                          ...editingMember,
                          cardIssueDate: newIssue,
                          cardValidityType: nextVal,
                          expiryDate: calculateCardExpiryDate(newIssue, nextVal),
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-slate-600 block mb-1 font-medium">
                      Formula Validità (Solare 31/12 vs Tessera 365 dal 1° Settembre)
                    </label>
                    <select
                      value={editingMember.cardValidityType || 'solare'}
                      onChange={(e) => {
                        const val = e.target.value as CardValidityType;
                        const issue = editingMember.cardIssueDate || '2027-09-01';
                        setEditingMember({
                          ...editingMember,
                          cardValidityType: val,
                          expiryDate: calculateCardExpiryDate(issue, val),
                        });
                      }}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-medium"
                    >
                      <option value="solare">
                        Tessera Ordinaria Solare (Scade il 31 Dicembre dell'anno)
                      </option>
                      <option value="tessera_365" disabled={!editEligible365}>
                        Tessera 365 (Scade lo stesso giorno dell'anno dopo — solo dal 1° Settembre)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Data Scadenza Tessera
                    </label>
                    <input
                      type="text"
                      value={editingMember.expiryDate}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, expiryDate: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Storico Tessere Precedenti se presente */}
                {editingMember.cardHistory && editingMember.cardHistory.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <div className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1 mb-1">
                      <History className="w-3 h-3" /> Storico Tessere Precedenti
                    </div>
                    <div className="space-y-1">
                      {editingMember.cardHistory.map((h) => (
                        <div
                          key={h.id}
                          className="text-[11px] font-mono text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200 flex justify-between"
                        >
                          <span>
                            N° {h.cardNumber} ({h.insuranceType} -{' '}
                            {h.validityType === 'tessera_365' ? 'Tessera 365' : 'Solare'})
                          </span>
                          <span>Scaduta il: {h.expiryDate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Salute, Allergie & Consensi Editabili */}
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-3 border border-slate-100">
                <div className="font-semibold text-slate-900 uppercase tracking-wide text-[10px]">
                  4. Salute, Allergie, Note Educative & Consensi
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Allergie / Intolleranze / Protocolli
                    </label>
                    <input
                      type="text"
                      value={editingMember.allergies}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, allergies: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1 font-medium">
                      Condizioni Particolari / Note Educative
                    </label>
                    <input
                      type="text"
                      value={editingMember.notesConditions}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, notesConditions: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-5 pt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingMember.isPaid}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, isPaid: e.target.checked })
                      }
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span className="font-medium">Quota Tessera Pagata</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingMember.photoConsent}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, photoConsent: e.target.checked })
                      }
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span className="font-medium">Autorizzazione Foto / Video</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingMember.formSignedAndArchived}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          formSignedAndArchived: e.target.checked,
                        })
                      }
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span className="font-medium">Modulo Firmato Archiviato</span>
                  </label>
                </div>
              </div>

              {/* 5. Buono Spesa / Credito Attività (NO Sconti fissi in anagrafica: gli sconti si applicano nei singoli Eventi e Ricevute) */}
              <div className="p-3.5 bg-teal-50/70 rounded-xl space-y-2.5 border border-teal-200">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-teal-950 uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-teal-700" />
                    <span>5. Buono Spesa / Credito da Spendere nelle Attività</span>
                  </div>
                  <span className="text-[10px] text-teal-700">
                    Utilizzabile in tutto o in parte per compensare quote eventi/attività
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-teal-900 block mb-1 font-semibold">
                      Credito Buono Disponibile (€)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={editingMember.voucherBalance ?? 0}
                      onChange={(e) =>
                        setEditingMember({
                          ...editingMember,
                          voucherBalance: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-lg font-mono font-bold text-teal-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-teal-900 block mb-1 font-medium">
                      Causale / Note Buono Spesa (opzionale)
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Recupero uscita annullata per pioggia / Bonus famiglia..."
                      value={editingMember.voucherNotes || ''}
                      onChange={(e) =>
                        setEditingMember({ ...editingMember, voucherNotes: e.target.value })
                      }
                      className="w-full px-3 py-1.5 bg-white border border-teal-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Confermi l'eliminazione definitiva di "${editingMember.childName}" dall'Anagrafica Soci?`
                        )
                      ) {
                        onDeleteMember(editingMember.id);
                        setEditingMember(null);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Elimina Socio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const m = { ...editingMember };
                      onUpdateMember(m);
                      setEditingMember(null);
                      setConsentModalMember(m);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    <span>Modulo Riepilogo da Firmare</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const m = { ...editingMember, confirmationEmailSent: true };
                      onUpdateMember(m);
                      setEditingMember(null);
                      onSelectMemberForReceipt(m);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Ricevuta / Email</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salva Modifiche Anagrafica</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: INSERIMENTO NUOVA TESSERA / RINNOVO (CON OPZIONE "TESSERA 365")
         ===================================================================== */}
      {renewalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  Nuova Tessera / Rinnovo per {renewalMember.childName}
                </h3>
                <p className="text-xs text-slate-500">
                  Tessera precedente: {renewalMember.membershipCardNumber || 'Nessuna'} (Scad.{' '}
                  {renewalMember.expiryDate || 'n/d'})
                </p>
              </div>
              <button
                onClick={() => setRenewalMember(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmRenewal} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Data Emissione / Rinnovo *
                  </label>
                  <input
                    type="date"
                    required
                    value={renewIssueDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setRenewIssueDate(nextDate);
                      if (!isTessera365Eligible(nextDate) && renewValidityType === 'tessera_365') {
                        setRenewValidityType('solare');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Nuovo Numero Tessera US ACLI
                  </label>
                  <input
                    type="text"
                    placeholder="Es. 27PC00150"
                    value={renewCardNumber}
                    onChange={(e) => setRenewCardNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              {/* Opzione Tessera 365 vs Solare */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <label className="block text-slate-800 font-bold">
                  Formula di Scadenza Tessera *
                </label>

                <label className="flex items-start gap-2.5 p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="validityType"
                    checked={renewValidityType === 'solare'}
                    onChange={() => setRenewValidityType('solare')}
                    className="mt-0.5 text-emerald-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">
                      Tessera Ordinaria Solare (Scadenza 31 Dicembre)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Scade il{' '}
                      <strong className="font-mono text-slate-800">
                        {calculateCardExpiryDate(renewIssueDate, 'solare')}
                      </strong>
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                    renewEligible365
                      ? 'bg-white border-purple-200 cursor-pointer'
                      : 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="validityType"
                    disabled={!renewEligible365}
                    checked={renewValidityType === 'tessera_365' && renewEligible365}
                    onChange={() => setRenewValidityType('tessera_365')}
                    className="mt-0.5 text-purple-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <span>Opzione "Tessera 365" (Stesso giorno dell'anno successivo)</span>
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-800 font-bold">
                        Dal 1° Settembre
                      </span>
                    </div>
                    {renewEligible365 ? (
                      <div className="text-[11px] text-purple-800 mt-0.5">
                        Attivabile! Scadrà il{' '}
                        <strong className="font-mono">
                          {calculateCardExpiryDate(renewIssueDate, 'tessera_365')}
                        </strong>{' '}
                        (365 giorni).
                      </div>
                    ) : (
                      <div className="text-[11px] text-rose-700 mt-0.5">
                        La data selezionata ({renewIssueDate}) è antecedente al 1° Settembre.
                        L'opzione "Tessera 365" è selezionabile solo per emissioni dal 1° Settembre
                        al 31 Dicembre.
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Assicurazione Scelta
                  </label>
                  <select
                    value={renewInsurance}
                    onChange={(e) => setRenewInsurance(e.target.value as InsuranceType)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Gold">{getInsuranceDisplayLabel('Gold', profile)}</option>
                    <option value="Platinum">{getInsuranceDisplayLabel('Platinum', profile)}</option>
                    <option value="Summer">{getInsuranceDisplayLabel('Summer', profile)}</option>
                    <option value="Base">{getInsuranceDisplayLabel('Base', profile)}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Quota (€)</label>
                  <input
                    type="number"
                    step="1"
                    value={renewAmount}
                    onChange={(e) => setRenewAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Canale</label>
                  <select
                    value={renewMethod}
                    onChange={(e) => setRenewMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Bonifico">Bonifico</option>
                    <option value="Contanti">Contanti</option>
                    <option value="POS">POS</option>
                    <option value="Paypal">Paypal</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={renewIsPaid}
                    onChange={(e) => setRenewIsPaid(e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-600"
                  />
                  <span>Quota pagata</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={renewRecordCash}
                    onChange={(e) => setRenewRecordCash(e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-600"
                  />
                  <span>Registra incasso automaticamente nel Flusso di Cassa</span>
                </label>
              </div>

              {renewRecordCash && renewIsPaid && (
                <TransactionDateSelector
                  mode={renewCashDateMode}
                  customDate={renewCashCustomDate}
                  onChangeMode={setRenewCashDateMode}
                  onChangeCustomDate={setRenewCashCustomDate}
                  label="Data di registrazione nel Flusso di Cassa per la quota tessera:"
                  idPrefix="members-renew-cash"
                />
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenewalMember(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Conferma Nuova Tessera / Rinnovo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: ISCRIVI NUOVO SOCIO (CON OPZIONE TESSERA 365)
         ===================================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Iscrivi Nuovo Socio</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewMember} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-slate-700 font-medium mb-1">Nome Bimbo/a *</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome e Cognome"
                    value={formData.childName}
                    onChange={(e) => setFormData({ ...formData, childName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Data di Nascita</label>
                  <input
                    type="text"
                    placeholder="GG/MM/AAAA"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Luogo di Nascita</label>
                  <input
                    type="text"
                    placeholder="Comune"
                    value={formData.birthPlace}
                    onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Gruppo Età *</label>
                  <select
                    value={formData.group}
                    onChange={(e) =>
                      setFormData({ ...formData, group: e.target.value as AgeGroup })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="3-6">3-6 anni</option>
                    <option value="6-11">6-11 anni</option>
                    <option value="11-14">11-14 anni</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">
                    Codice Fiscale Bimbo/a
                  </label>
                  <input
                    type="text"
                    value={formData.childFiscalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, childFiscalCode: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">
                    Indirizzo di Residenza
                  </label>
                  <input
                    type="text"
                    value={formData.childAddress}
                    onChange={(e) => setFormData({ ...formData, childAddress: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nome Genitore</label>
                  <input
                    type="text"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Telefono Genitore</label>
                  <input
                    type="tel"
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">Email Genitore</label>
                  <input
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              {/* Tessera, Data Emissione e Opzione Tessera 365 */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Assicurazione UsAcli *
                    </label>
                    <select
                      value={formData.insuranceType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          insuranceType: e.target.value as InsuranceType,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="Gold">{getInsuranceDisplayLabel('Gold', profile)}</option>
                      <option value="Platinum">{getInsuranceDisplayLabel('Platinum', profile)}</option>
                      <option value="Summer">{getInsuranceDisplayLabel('Summer', profile)}</option>
                      <option value="Base">{getInsuranceDisplayLabel('Base', profile)}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Numero Tessera</label>
                    <input
                      type="text"
                      placeholder="Es. 27PC0001"
                      value={formData.membershipCardNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, membershipCardNumber: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Data Emissione Tessera
                    </label>
                    <input
                      type="date"
                      value={formData.cardIssueDate || defaultIssueDate}
                      onChange={(e) => {
                        const nextIssue = e.target.value;
                        const can365 = isTessera365Eligible(nextIssue);
                        const nextVal: CardValidityType =
                          formData.cardValidityType === 'tessera_365' && can365
                            ? 'tessera_365'
                            : 'solare';
                        setFormData({
                          ...formData,
                          cardIssueDate: nextIssue,
                          cardValidityType: nextVal,
                          expiryDate: calculateCardExpiryDate(nextIssue, nextVal),
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2">
                    <label className="block text-slate-700 font-medium mb-1">
                      Formula Validità Tessera
                    </label>
                    <select
                      value={formData.cardValidityType || 'solare'}
                      onChange={(e) => {
                        const val = e.target.value as CardValidityType;
                        const issue = formData.cardIssueDate || defaultIssueDate;
                        setFormData({
                          ...formData,
                          cardValidityType: val,
                          expiryDate: calculateCardExpiryDate(issue, val),
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="solare">Ordinaria Solare (Scade 31 Dicembre)</option>
                      <option value="tessera_365" disabled={!newMemberEligible365}>
                        Tessera 365 (Stesso giorno anno dopo — attivabile dal 1° Settembre)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Scadenza Calcolata
                    </label>
                    <input
                      type="text"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold bg-slate-50"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Allergie o Intolleranze
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Api, celiachia, arachidi..."
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Condizioni Particolari / Note Educative
                  </label>
                  <input
                    type="text"
                    value={formData.notesConditions}
                    onChange={(e) => setFormData({ ...formData, notesConditions: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPaid}
                      onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span>Quota Tessera Pagata</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newMemberRecordCash}
                      onChange={(e) => setNewMemberRecordCash(e.target.checked)}
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span>Registra incasso tessera nel Flusso di Cassa</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.photoConsent}
                      onChange={(e) => setFormData({ ...formData, photoConsent: e.target.checked })}
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span>Consenso Foto / Video concesso</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.confirmationEmailSent}
                      onChange={(e) =>
                        setFormData({ ...formData, confirmationEmailSent: e.target.checked })
                      }
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span>Email conferma/ricevuta già inviata</span>
                  </label>
                </div>

                {newMemberRecordCash && formData.isPaid && (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Importo Quota Tessera (€)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={newMemberCashAmount}
                          onChange={(e) => setNewMemberCashAmount(Number(e.target.value))}
                          className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Metodo Pagamento
                        </label>
                        <select
                          value={newMemberCashMethod}
                          onChange={(e) => setNewMemberCashMethod(e.target.value as PaymentMethod)}
                          className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200"
                        >
                          <option value="Bonifico">Bonifico</option>
                          <option value="Contanti">Contanti</option>
                          <option value="POS">POS</option>
                          <option value="Paypal">Paypal</option>
                        </select>
                      </div>
                    </div>
                    <TransactionDateSelector
                      mode={newMemberCashDateMode}
                      customDate={newMemberCashCustomDate}
                      onChangeMode={setNewMemberCashDateMode}
                      onChangeCustomDate={setNewMemberCashCustomDate}
                      label="Data di registrazione nel Flusso di Cassa:"
                      idPrefix="members-new-cash"
                    />
                  </div>
                )}
                {/* Buono Spesa iniziale opzionale */}
                <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-teal-900 font-semibold mb-1">
                      Buono Spesa Disponibile (€)
                    </label>
                    <input
                      type="number"
                      step="0.50"
                      min="0"
                      value={formData.voucherBalance ?? 0}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          voucherBalance: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 bg-white rounded-lg border border-teal-300 font-mono font-bold text-teal-900"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-teal-900 font-medium mb-1">
                      Note Buono Spesa (opzionale)
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Buono recupero attività / Bonus famiglia..."
                      value={formData.voucherNotes || ''}
                      onChange={(e) => setFormData({ ...formData, voucherNotes: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white rounded-lg border border-teal-200"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  Salva Tesserato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modulo Riepilogo Dati, Consenso Foto & Privacy da Firmare (Download PDF + Invio Gmail) */}
      <MemberDataConsentModal
        isOpen={!!consentModalMember}
        onClose={() => setConsentModalMember(null)}
        member={
          consentModalMember
            ? members.find((m) => m.id === consentModalMember.id) || consentModalMember
            : null
        }
        profile={profile}
        onUpdateMember={(updated) => {
          onUpdateMember(updated);
          setConsentModalMember(updated);
        }}
        onUpdateProfile={onUpdateProfile}
      />

      {/* Custom Google Form Field Builder Modal */}
      <GoogleFormBuilderModal
        isOpen={isFormBuilderOpen}
        onClose={() => setIsFormBuilderOpen(false)}
        initialFormType="tesseramento"
        initialTitle={`Modulo Iscrizione & Anagrafica Soci ${profile.activeYear} - ${profile.name}`}
        initialDescription="Compila i dati anagrafici del partecipante e del genitore, indica in modo approfondito eventuali allergie o bisogni speciali e scegli la copertura assicurativa."
        profile={profile}
        googleUserEmail={googleUserEmail}
        onSaveStandardFieldsToProfile={(updatedFields) =>
          onUpdateProfile({ ...profile, formStandardFields: updatedFields })
        }
        onConfirmGenerateForm={async (params) => {
          await handleCreateAndLinkGoogleFormSoci(params);
        }}
        isGenerating={isSyncingGoogle}
      />
    </div>
  );
};
