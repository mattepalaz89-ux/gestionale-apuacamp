import React, { useState, useMemo } from 'react';
import {
  Calendar,
  MapPin,
  Plus,
  Send,
  Printer,
  AlertTriangle,
  ShieldAlert,
  CameraOff,
  HeartPulse,
  Download,
  Upload,
  FileText,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Edit3,
  Trash2,
  Users,
  Info,
  HardDrive,
  CreditCard,
  UserCheck,
  UserPlus,
  Tag,
  Ticket,
} from 'lucide-react';
import {
  EventItem,
  EventBooking,
  EventDiscountType,
  Member,
  PaymentMethod,
  AssociationProfile,
  GoogleFormFieldConfig,
  CashTransaction,
  InsuranceType,
  AgeGroup,
  CardValidityType,
} from '../types';
import {
  formatEuro,
  calculateEventFinancials,
  parseAmount,
  calculateDiscountedEventPrice,
  mergeSavedDiscountLabels,
} from '../utils/finance';
import { generateReceiptEmailLink } from '../utils/export';
import { INITIAL_ASSOCIATION_PROFILE } from '../data/initialData';
import { generatePreEventBriefings } from '../utils/notifications';
import {
  downloadEmptyExcelTemplate,
  readUploadedSpreadsheetRows,
  normalizePaymentMethod,
  isTessera365Eligible,
  calculateCardExpiryDate,
} from '../utils/csvExcelImporter';
import {
  createGoogleFormForActivity,
  fetchGoogleFormResponses,
  createAndPopulateSpreadsheet,
  DRIVE_ROOT_FOLDER_NAME,
  DRIVE_CATEGORY_FOLDERS,
} from '../services/googleWorkspace';
import { GoogleFormBuilderModal } from './GoogleFormBuilderModal';
import { TransactionDateSelector } from './TransactionDateSelector';
import { getInsuranceDisplayLabel } from '../utils/digitalCard';

interface EventsViewProps {
  events: EventItem[];
  bookings: EventBooking[];
  members: Member[];
  profile?: AssociationProfile;
  googleUserEmail: string | null;
  onAddEvent: (ev: Omit<EventItem, 'id'>) => void;
  onUpdateEvent: (ev: EventItem) => void;
  onDeleteEvent: (id: string) => void;
  onAddBooking: (booking: Omit<EventBooking, 'id'>) => void;
  onUpdateBooking: (booking: EventBooking) => void;
  onDeleteBooking: (id: string) => void;
  onAddMember: (member: Omit<Member, 'id'>) => Member;
  onUpdateMember: (member: Member) => void;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onUpdateProfile?: (profile: AssociationProfile) => void;
  onOpenReceiptModalForBooking: (booking: EventBooking, member?: Member) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  events,
  bookings,
  members,
  profile = INITIAL_ASSOCIATION_PROFILE,
  googleUserEmail,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onAddBooking,
  onUpdateBooking,
  onDeleteBooking,
  onAddMember,
  onUpdateMember,
  onAddTransaction,
  onUpdateProfile,
  onOpenReceiptModalForBooking,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id || '');
  const [isAddBookingOpen, setIsAddBookingOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    text: string;
    linkUrl?: string;
    linkLabel?: string;
  } | null>(null);
  const [isSyncingForm, setIsSyncingForm] = useState(false);

  // Create / Edit Event Form State
  const [evName, setEvName] = useState('');
  const [evCat, setEvCat] = useState<EventItem['category']>('rifugio');
  const [evDate, setEvDate] = useState(`${profile.activeYear}-05-15`);
  const [evLoc, setEvLoc] = useState('Alpi Apuane');
  const [evAgeGroups, setEvAgeGroups] = useState('6-11 anni, 11-14 anni');
  const [evConditions, setEvConditions] = useState(
    'Tessera US ACLI in corso di validità, caparra alla prenotazione.'
  );
  const [evDepositDefault, setEvDepositDefault] = useState(70);
  const [evMemberPrice, setEvMemberPrice] = useState(130);
  const [evNonMemberPrice, setEvNonMemberPrice] = useState(140);
  const [evStaffCount, setEvStaffCount] = useState(3);
  const [evStatus, setEvStatus] = useState<EventItem['status']>('aperto');
  const [evNotes, setEvNotes] = useState('');
  const [evDefaultDiscountType, setEvDefaultDiscountType] = useState<EventDiscountType>('none');
  const [evDefaultDiscountValue, setEvDefaultDiscountValue] = useState<number>(0);
  const [evDefaultDiscountLabel, setEvDefaultDiscountLabel] = useState<string>('');

  // New booking form + automatic Anagrafica & CashFlow coordination + Event Discount & Voucher
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [childName, setChildName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [bookingBasePrice, setBookingBasePrice] = useState<number>(130);
  const [bookingDiscountType, setBookingDiscountType] = useState<EventDiscountType>('none');
  const [bookingDiscountValue, setBookingDiscountValue] = useState<number>(0);
  const [bookingDiscountLabel, setBookingDiscountLabel] = useState<string>('');
  const [bookingVoucherUsed, setBookingVoucherUsed] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<number>(70);
  const [balanceAmount, setBalanceAmount] = useState<number>(60);
  const [isDepositPaid, setIsDepositPaid] = useState<boolean>(true);
  const [isBalancePaid, setIsBalancePaid] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bonifico');
  const [extraInsurance, setExtraInsurance] = useState<boolean>(false);
  const [bookingNotes, setBookingNotes] = useState('');
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [autoSyncToAnagrafica, setAutoSyncToAnagrafica] = useState<boolean>(true);
  const [autoRecordBookingCash, setAutoRecordBookingCash] = useState<boolean>(true);
  const [bookingCashDateMode, setBookingCashDateMode] = useState<'today' | 'custom'>('today');
  const [bookingCashDate, setBookingCashDate] = useState<string>(todayIso);

  // Modal Rapido "Sconto Evento & Buono Spesa" per un iscritto esistente
  const [discountModalBooking, setDiscountModalBooking] = useState<EventBooking | null>(null);
  const [editBkBasePrice, setEditBkBasePrice] = useState<number>(130);
  const [editBkDiscountType, setEditBkDiscountType] = useState<EventDiscountType>('none');
  const [editBkDiscountValue, setEditBkDiscountValue] = useState<number>(0);
  const [editBkDiscountLabel, setEditBkDiscountLabel] = useState<string>('');
  const [editBkVoucherUsed, setEditBkVoucherUsed] = useState<number>(0);
  const [editBkDeposit, setEditBkDeposit] = useState<number>(70);

  const savedDiscountLabels = useMemo(
    () => mergeSavedDiscountLabels(profile.savedDiscountLabels),
    [profile.savedDiscountLabels]
  );

  const persistDiscountLabelIfNew = (label?: string) => {
    const trimmed = (label || '').trim();
    if (!trimmed || !onUpdateProfile) return;
    const merged = mergeSavedDiscountLabels(profile.savedDiscountLabels, trimmed);
    if (merged.length !== (profile.savedDiscountLabels || []).length) {
      onUpdateProfile({
        ...profile,
        savedDiscountLabels: merged,
      });
    }
  };

  // Popup di Coordinamento Automatico Evento <-> Anagrafica Soci & Tessere
  const [syncBookingTarget, setSyncBookingTarget] = useState<EventBooking | null>(null);
  const [syncExistingMember, setSyncExistingMember] = useState<Member | null>(null);
  const [syncChildName, setSyncChildName] = useState('');
  const [syncBirthDate, setSyncBirthDate] = useState('');
  const [syncBirthPlace, setSyncBirthPlace] = useState('');
  const [syncGroup, setSyncGroup] = useState<AgeGroup>('6-11');
  const [syncChildFiscalCode, setSyncChildFiscalCode] = useState('');
  const [syncChildAddress, setSyncChildAddress] = useState('');
  const [syncParentName, setSyncParentName] = useState('');
  const [syncParentPhone, setSyncParentPhone] = useState('');
  const [syncParentEmail, setSyncParentEmail] = useState('');
  const [syncCardNumber, setSyncCardNumber] = useState('');
  const [syncInsurance, setSyncInsurance] = useState<InsuranceType>('Gold');
  const [syncIssueDate, setSyncIssueDate] = useState<string>(todayIso);
  const [syncValidityType, setSyncValidityType] = useState<CardValidityType>('solare');
  const [syncExpiryDate, setSyncExpiryDate] = useState<string>(`31/12/${profile.activeYear}`);
  const [syncIsCardPaid, setSyncIsCardPaid] = useState<boolean>(true);
  const [syncAllergies, setSyncAllergies] = useState('');
  const [syncNotesConditions, setSyncNotesConditions] = useState('');
  const [syncPhotoConsent, setSyncPhotoConsent] = useState<boolean>(true);
  const [syncRecordCardCash, setSyncRecordCardCash] = useState<boolean>(false);
  const [syncCardAmount, setSyncCardAmount] = useState<number>(20);
  const [syncCardMethod, setSyncCardMethod] = useState<PaymentMethod>('Bonifico');
  const [syncCardCashDateMode, setSyncCardCashDateMode] = useState<'today' | 'custom'>('today');
  const [syncCardCashDate, setSyncCardCashDate] = useState<string>(todayIso);

  const currentEvent = events.find((e) => e.id === selectedEventId) || events[0] || null;
  const eventBookings = currentEvent
    ? bookings.filter((b) => b.eventId === currentEvent.id)
    : [];

  const economics = currentEvent
    ? calculateEventFinancials(currentEvent, bookings)
    : {
        confirmedCount: 0,
        totalExpected: 0,
        totalCollected: 0,
        totalPending: 0,
        benchmarkCost: 0,
        reserveFund: 0,
        netToDivide: 0,
        targetStaff: 1,
        perStaffShare: 0,
      };

  const currentBriefing = useMemo(() => {
    if (!currentEvent) return null;
    const all = generatePreEventBriefings([currentEvent], bookings, members);
    return all[0];
  }, [currentEvent, bookings, members]);

  // Open the Popup that coordinates Event Participant <-> Anagrafica Soci & Tessere
  const openSyncMemberModalForBooking = (bk: EventBooking) => {
    const matched = members.find(
      (m) =>
        (bk.memberId && m.id === bk.memberId) ||
        m.childName.trim().toLowerCase() === bk.childName.trim().toLowerCase()
    );
    const nowIso = new Date().toISOString().slice(0, 10);
    setSyncBookingTarget(bk);
    setSyncExistingMember(matched || null);

    if (matched) {
      setSyncChildName(matched.childName);
      setSyncBirthDate(matched.birthDate || '');
      setSyncBirthPlace(matched.birthPlace || '');
      setSyncGroup(matched.group || '6-11');
      setSyncChildFiscalCode(matched.childFiscalCode || '');
      setSyncChildAddress(matched.childAddress || '');
      setSyncParentName(matched.parentName || bk.parentName || '');
      setSyncParentPhone(matched.parentPhone || bk.parentPhone || '');
      setSyncParentEmail(matched.parentEmail || bk.parentEmail || '');
      setSyncCardNumber(matched.membershipCardNumber || '');
      setSyncInsurance(matched.insuranceType || 'Gold');
      const issue = matched.cardIssueDate || nowIso;
      setSyncIssueDate(issue);
      setSyncValidityType(matched.cardValidityType || 'solare');
      setSyncExpiryDate(
        matched.expiryDate || calculateCardExpiryDate(issue, matched.cardValidityType || 'solare')
      );
      setSyncIsCardPaid(matched.isPaid);
      setSyncAllergies(matched.allergies || '');
      setSyncNotesConditions(matched.notesConditions || bk.notes || '');
      setSyncPhotoConsent(matched.photoConsent);
      setSyncRecordCardCash(false);
    } else {
      // Not yet in Anagrafica Soci: pre-fill with booking data so user doesn't retype anything
      const can365 = isTessera365Eligible(nowIso);
      const valType: CardValidityType = can365 ? 'tessera_365' : 'solare';
      setSyncChildName(bk.childName);
      setSyncBirthDate('');
      setSyncBirthPlace('');
      setSyncGroup('6-11');
      setSyncChildFiscalCode('');
      setSyncChildAddress('');
      setSyncParentName(bk.parentName || '');
      setSyncParentPhone(bk.parentPhone || '');
      setSyncParentEmail(bk.parentEmail || '');
      setSyncCardNumber('');
      setSyncInsurance('Gold');
      setSyncIssueDate(nowIso);
      setSyncValidityType(valType);
      setSyncExpiryDate(calculateCardExpiryDate(nowIso, valType));
      setSyncIsCardPaid(true);
      setSyncAllergies('');
      setSyncNotesConditions(bk.notes || '');
      setSyncPhotoConsent(true);
      setSyncRecordCardCash(true);
    }
    setSyncCardAmount(20);
    setSyncCardMethod(bk.paymentMethod || 'Bonifico');
    setSyncCardCashDateMode('today');
    setSyncCardCashDate(nowIso);
  };

  const handleConfirmSyncMemberAndCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncBookingTarget || !syncChildName.trim()) return;

    const can365 = isTessera365Eligible(syncIssueDate);
    const effectiveValidity: CardValidityType =
      syncValidityType === 'tessera_365' && can365 ? 'tessera_365' : 'solare';
    const finalExpiry =
      syncExpiryDate.trim() || calculateCardExpiryDate(syncIssueDate, effectiveValidity);

    let linkedMemberId = syncExistingMember?.id;

    if (syncExistingMember) {
      const updatedMember: Member = {
        ...syncExistingMember,
        childName: syncChildName.trim(),
        birthDate: syncBirthDate.trim(),
        birthPlace: syncBirthPlace.trim(),
        group: syncGroup,
        childFiscalCode: syncChildFiscalCode.trim().toUpperCase(),
        childAddress: syncChildAddress.trim(),
        parentName: syncParentName.trim(),
        parentPhone: syncParentPhone.trim(),
        parentEmail: syncParentEmail.trim(),
        membershipCardNumber: syncCardNumber.trim() || 'In emissione US ACLI',
        cardIssueDate: syncIssueDate,
        expiryDate: finalExpiry,
        cardValidityType: effectiveValidity,
        insuranceType: syncInsurance,
        isPaid: syncIsCardPaid,
        allergies: syncAllergies.trim(),
        notesConditions: syncNotesConditions.trim(),
        photoConsent: syncPhotoConsent,
      };
      onUpdateMember(updatedMember);
      linkedMemberId = updatedMember.id;
    } else {
      const created = onAddMember({
        childName: syncChildName.trim(),
        birthDate: syncBirthDate.trim(),
        birthPlace: syncBirthPlace.trim(),
        group: syncGroup,
        childFiscalCode: syncChildFiscalCode.trim().toUpperCase(),
        childAddress: syncChildAddress.trim(),
        parentName: syncParentName.trim(),
        parentFiscalCode: '',
        parentPhone: syncParentPhone.trim(),
        parentEmail: syncParentEmail.trim(),
        membershipCardNumber: syncCardNumber.trim() || 'In emissione US ACLI',
        isPaid: syncIsCardPaid,
        cardIssueDate: syncIssueDate,
        expiryDate: finalExpiry,
        cardValidityType: effectiveValidity,
        insuranceType: syncInsurance,
        photoConsent: syncPhotoConsent,
        allergies: syncAllergies.trim(),
        notesConditions: syncNotesConditions.trim(),
        formSignedAndArchived: false,
        confirmationEmailSent: false,
      });
      linkedMemberId = created.id;
    }

    // Update the EventBooking so all sections stay 100% coordinated
    onUpdateBooking({
      ...syncBookingTarget,
      memberId: linkedMemberId,
      childName: syncChildName.trim(),
      parentName: syncParentName.trim(),
      parentPhone: syncParentPhone.trim(),
      parentEmail: syncParentEmail.trim(),
      annualCardValid: syncIsCardPaid,
    });

    if (syncRecordCardCash && syncIsCardPaid && syncCardAmount > 0) {
      const txDate =
        syncCardCashDateMode === 'today'
          ? new Date().toISOString().slice(0, 10)
          : syncCardCashDate;
      onAddTransaction({
        date: txDate,
        category: 'Tessere',
        income: syncCardAmount,
        expense: null,
        method: syncCardMethod,
        description: `Tessera ${
          effectiveValidity === 'tessera_365' ? '365' : 'Annuale'
        } (${syncInsurance}) - ${syncChildName.trim()} (da Evento ${syncBookingTarget.eventName})`,
      });
    }

    setStatusMsg({
      text: syncExistingMember
        ? `Dati di "${syncChildName.trim()}" aggiornati in automatico in Evento, Anagrafica Soci e Sezione Tessere!`
        : `"${syncChildName.trim()}" inserito automaticamente in Anagrafica Soci e Sezione Tessere (Scad. ${finalExpiry})!`,
    });
    setSyncBookingTarget(null);
    setSyncExistingMember(null);
  };

  const openCreateEventModal = () => {
    setEditingEvent(null);
    setEvName('');
    setEvCat('rifugio');
    setEvDate(`${profile.activeYear}-05-15`);
    setEvLoc('Alpi Apuane');
    setEvAgeGroups('6-11 anni, 11-14 anni');
    setEvConditions('Tessera US ACLI attiva, caparra alla conferma.');
    setEvDepositDefault(70);
    setEvMemberPrice(130);
    setEvNonMemberPrice(140);
    setEvStaffCount(3);
    setEvStatus('aperto');
    setEvNotes('');
    setEvDefaultDiscountType('none');
    setEvDefaultDiscountValue(0);
    setEvDefaultDiscountLabel('');
    setIsEventModalOpen(true);
  };

  const openEditEventModal = (ev: EventItem) => {
    setEditingEvent(ev);
    setEvName(ev.name);
    setEvCat(ev.category);
    setEvDate(ev.date);
    setEvLoc(ev.location);
    setEvAgeGroups(ev.ageGroups || '3-6, 6-11, 11-14 anni');
    setEvConditions(ev.conditions || '');
    setEvDepositDefault(ev.depositDefault ?? Math.round(ev.memberPrice / 2));
    setEvMemberPrice(ev.memberPrice);
    setEvNonMemberPrice(ev.nonMemberPrice);
    setEvStaffCount(ev.targetStaffCount || 3);
    setEvStatus(ev.status);
    setEvNotes(ev.notes || '');
    setEvDefaultDiscountType(ev.defaultDiscountType || 'none');
    setEvDefaultDiscountValue(ev.defaultDiscountValue || 0);
    setEvDefaultDiscountLabel(ev.defaultDiscountLabel || '');
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evName.trim()) return;

    if (evDefaultDiscountType !== 'none' && evDefaultDiscountLabel.trim()) {
      persistDiscountLabelIfNew(evDefaultDiscountLabel);
    }

    if (editingEvent) {
      onUpdateEvent({
        ...editingEvent,
        name: evName.trim(),
        category: evCat,
        date: evDate,
        location: evLoc.trim(),
        ageGroups: evAgeGroups.trim(),
        conditions: evConditions.trim(),
        depositDefault: Number(evDepositDefault) || 0,
        memberPrice: Number(evMemberPrice) || 0,
        nonMemberPrice: Number(evNonMemberPrice) || 0,
        status: evStatus,
        targetStaffCount: Number(evStaffCount) || 2,
        notes: evNotes.trim(),
        defaultDiscountType: evDefaultDiscountType,
        defaultDiscountValue: Number(evDefaultDiscountValue) || 0,
        defaultDiscountLabel: evDefaultDiscountLabel.trim(),
      });
      setStatusMsg({
        text: `Evento "${evName.trim()}" aggiornato con le nuove condizioni, fasce d'età e quote!`,
      });
    } else {
      onAddEvent({
        name: evName.trim(),
        category: evCat,
        date: evDate,
        location: evLoc.trim(),
        ageGroups: evAgeGroups.trim(),
        conditions: evConditions.trim(),
        depositDefault: Number(evDepositDefault) || 0,
        memberPrice: Number(evMemberPrice) || 0,
        nonMemberPrice: Number(evNonMemberPrice) || 0,
        status: evStatus,
        targetStaffCount: Number(evStaffCount) || 2,
        notes: evNotes.trim(),
        defaultDiscountType: evDefaultDiscountType,
        defaultDiscountValue: Number(evDefaultDiscountValue) || 0,
        defaultDiscountLabel: evDefaultDiscountLabel.trim(),
      });
      setStatusMsg({
        text: `Nuovo evento "${evName.trim()}" creato!`,
      });
    }
    setIsEventModalOpen(false);
  };

  const handleDeleteCurrentEvent = (ev: EventItem) => {
    const count = bookings.filter((b) => b.eventId === ev.id).length;
    const confirmed = confirm(
      `Confermi l'eliminazione dell'evento "${ev.name}"${
        count > 0 ? ` e delle relative ${count} prenotazioni` : ''
      }?`
    );
    if (!confirmed) return;

    onDeleteEvent(ev.id);
    const remaining = events.filter((item) => item.id !== ev.id);
    setSelectedEventId(remaining[0]?.id || '');
    setStatusMsg({
      text: `Evento "${ev.name}" eliminato dall'elenco.`,
    });
  };

  const applyRecalculatedBookingAmounts = (
    base: number,
    dType: EventDiscountType,
    dVal: number,
    vUsed: number,
    currentDeposit: number
  ) => {
    const calc = calculateDiscountedEventPrice({
      basePrice: base,
      discountType: dType,
      discountValue: dVal,
      voucherUsed: vUsed,
    });
    const adjDeposit = Math.min(currentDeposit, calc.finalNetPrice);
    const adjBalance = Math.max(0, calc.finalNetPrice - adjDeposit);
    setDepositAmount(adjDeposit);
    setBalanceAmount(adjBalance);
  };

  const handleSelectMember = (mId: string) => {
    setSelectedMemberId(mId);
    if (!mId) {
      setBookingVoucherUsed(0);
      return;
    }
    const member = members.find((m) => m.id === mId);
    if (member) {
      setChildName(member.childName);
      setParentName(member.parentName);
      setParentEmail(member.parentEmail || '');
      setParentPhone(member.parentPhone || '');
      setBookingVoucherUsed(0);
    }
  };

  const handleOpenAddBooking = () => {
    if (!currentEvent) return;
    const base = currentEvent.memberPrice;
    const defDep = currentEvent.depositDefault ?? Math.round(base / 2);
    const dType = currentEvent.defaultDiscountType || 'none';
    const dVal = currentEvent.defaultDiscountValue || 0;
    const dLabel = currentEvent.defaultDiscountLabel || '';

    setBookingBasePrice(base);
    setBookingDiscountType(dType);
    setBookingDiscountValue(dVal);
    setBookingDiscountLabel(dLabel);
    setBookingVoucherUsed(0);

    const calc = calculateDiscountedEventPrice({
      basePrice: base,
      discountType: dType,
      discountValue: dVal,
      voucherUsed: 0,
    });
    const adjDep = Math.min(defDep, calc.finalNetPrice);
    setDepositAmount(adjDep);
    setBalanceAmount(Math.max(0, calc.finalNetPrice - adjDep));
    setBookingCashDateMode('today');
    setBookingCashDate(new Date().toISOString().slice(0, 10));
    setIsAddBookingOpen(true);
  };

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent || !childName.trim()) return;

    const calc = calculateDiscountedEventPrice({
      basePrice: bookingBasePrice,
      discountType: bookingDiscountType,
      discountValue: bookingDiscountValue,
      voucherUsed: bookingVoucherUsed,
    });

    if (bookingDiscountType !== 'none' && bookingDiscountLabel.trim()) {
      persistDiscountLabelIfNew(bookingDiscountLabel);
    }

    const totalPrice = (depositAmount || 0) + (balanceAmount || 0);
    let finalMemberId = selectedMemberId || undefined;

    // Check if member already exists by name if not selected
    if (!finalMemberId) {
      const existingByName = members.find(
        (m) => m.childName.trim().toLowerCase() === childName.trim().toLowerCase()
      );
      if (existingByName) {
        finalMemberId = existingByName.id;
      } else if (autoSyncToAnagrafica) {
        const nowIso = new Date().toISOString().slice(0, 10);
        const createdMember = onAddMember({
          childName: childName.trim(),
          birthDate: '',
          birthPlace: '',
          group: '6-11',
          childFiscalCode: '',
          childAddress: '',
          parentName: parentName.trim(),
          parentFiscalCode: '',
          parentPhone: parentPhone.trim(),
          parentEmail: parentEmail.trim(),
          membershipCardNumber: '',
          isPaid: false,
          cardIssueDate: nowIso,
          expiryDate: `31/12/${profile.activeYear}`,
          cardValidityType: 'solare',
          insuranceType: 'Gold',
          photoConsent: true,
          allergies: '',
          notesConditions: bookingNotes.trim(),
          formSignedAndArchived: false,
          confirmationEmailSent: false,
        });
        finalMemberId = createdMember.id;
      }
    }

    // Deduct voucher from member if used
    if (finalMemberId && calc.voucherApplied > 0) {
      const targetMember = members.find((m) => m.id === finalMemberId);
      if (targetMember && (targetMember.voucherBalance || 0) > 0) {
        onUpdateMember({
          ...targetMember,
          voucherBalance: Math.max(0, (targetMember.voucherBalance || 0) - calc.voucherApplied),
        });
      }
    }

    onAddBooking({
      eventId: currentEvent.id,
      eventName: currentEvent.name,
      memberId: finalMemberId,
      childName: childName.trim(),
      parentName: parentName.trim(),
      parentEmail: parentEmail.trim(),
      parentPhone: parentPhone.trim(),
      confirmed: true,
      depositAmount: Number(depositAmount) || 0,
      balanceAmount: Number(balanceAmount) || 0,
      isDepositPaid,
      isBalancePaid,
      totalPrice,
      basePrice: calc.basePrice,
      discountType: bookingDiscountType,
      discountValue: bookingDiscountType !== 'none' ? bookingDiscountValue : 0,
      discountAmount: calc.discountAmount,
      discountLabel: bookingDiscountType !== 'none' ? bookingDiscountLabel.trim() : undefined,
      voucherApplied: calc.voucherApplied > 0 ? calc.voucherApplied : undefined,
      annualCardValid: !extraInsurance,
      extraInsurancePaid: extraInsurance,
      paymentMethod,
      notes: bookingNotes.trim(),
      confirmationEmailSent: emailSent,
    });

    if (autoRecordBookingCash) {
      const paidNow =
        (isDepositPaid ? Number(depositAmount) || 0 : 0) +
        (isBalancePaid ? Number(balanceAmount) || 0 : 0);
      if (paidNow > 0) {
        const txDate =
          bookingCashDateMode === 'today'
            ? new Date().toISOString().slice(0, 10)
            : bookingCashDate;
        const cashCat =
          currentEvent.category === 'summer_camp'
            ? 'SummerCamp'
            : currentEvent.category === 'selva'
            ? 'Selva'
            : 'Evento';
        onAddTransaction({
          date: txDate,
          category: cashCat,
          income: paidNow,
          expense: null,
          method: paymentMethod,
          description: `${
            isDepositPaid && isBalancePaid
              ? 'Quota completa'
              : isDepositPaid
              ? 'Caparra'
              : 'Saldo'
          } ${currentEvent.name} - ${childName.trim()}`,
        });
      }
    }

    setIsAddBookingOpen(false);
    setSelectedMemberId('');
    setChildName('');
    setParentName('');
    setParentEmail('');
    setParentPhone('');
    setBookingNotes('');
    setEmailSent(false);
    setBookingDiscountType('none');
    setBookingDiscountValue(0);
    setBookingDiscountLabel('');
    setBookingVoucherUsed(0);
  };

  const openDiscountBookingModal = (bk: EventBooking) => {
    const base =
      bk.basePrice !== undefined && bk.basePrice > 0
        ? bk.basePrice
        : currentEvent?.memberPrice || bk.totalPrice;
    setDiscountModalBooking(bk);
    setEditBkBasePrice(base);
    setEditBkDiscountType(bk.discountType || 'none');
    setEditBkDiscountValue(bk.discountValue || 0);
    setEditBkDiscountLabel(bk.discountLabel || '');
    setEditBkVoucherUsed(bk.voucherApplied || 0);
    setEditBkDeposit(bk.depositAmount);
  };

  const handleSaveBookingDiscountAndVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discountModalBooking) return;

    const calc = calculateDiscountedEventPrice({
      basePrice: editBkBasePrice,
      discountType: editBkDiscountType,
      discountValue: editBkDiscountValue,
      voucherUsed: editBkVoucherUsed,
    });

    if (editBkDiscountType !== 'none' && editBkDiscountLabel.trim()) {
      persistDiscountLabelIfNew(editBkDiscountLabel);
    }

    // Adjust member voucher balance if voucher delta changed
    const prevVoucher = discountModalBooking.voucherApplied || 0;
    const deltaVoucher = calc.voucherApplied - prevVoucher;
    if (deltaVoucher !== 0) {
      const matchedMember = members.find(
        (m) =>
          (discountModalBooking.memberId && m.id === discountModalBooking.memberId) ||
          m.childName.trim().toLowerCase() === discountModalBooking.childName.trim().toLowerCase()
      );
      if (matchedMember) {
        onUpdateMember({
          ...matchedMember,
          voucherBalance: Math.max(0, (matchedMember.voucherBalance || 0) - deltaVoucher),
        });
      }
    }

    const adjDeposit = Math.min(editBkDeposit, calc.finalNetPrice);
    const adjBalance = Math.max(0, calc.finalNetPrice - adjDeposit);

    onUpdateBooking({
      ...discountModalBooking,
      basePrice: calc.basePrice,
      discountType: editBkDiscountType,
      discountValue: editBkDiscountType !== 'none' ? editBkDiscountValue : 0,
      discountAmount: calc.discountAmount,
      discountLabel: editBkDiscountType !== 'none' ? editBkDiscountLabel.trim() : undefined,
      voucherApplied: calc.voucherApplied > 0 ? calc.voucherApplied : undefined,
      depositAmount: adjDeposit,
      balanceAmount: adjBalance,
      totalPrice: calc.finalNetPrice,
    });

    setStatusMsg({
      text: `Quota aggiornata per "${discountModalBooking.childName}": Totale Netto ${formatEuro(
        calc.finalNetPrice
      )}${
        calc.discountAmount > 0
          ? ` (Sconto -${formatEuro(calc.discountAmount)}: ${
              editBkDiscountLabel.trim() || 'Agevolazione'
            })`
          : ''
      }${calc.voucherApplied > 0 ? ` (Buono Spesa -${formatEuro(calc.voucherApplied)})` : ''}.`,
    });
    setDiscountModalBooking(null);
  };

  const handleImportBookingsExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentEvent) return;
    try {
      const rows = await readUploadedSpreadsheetRows(file);
      const dataRows = rows.slice(1);
      let count = 0;
      for (const r of dataRows) {
        const cName = (r[0] || '').trim();
        if (!cName || cName.toLowerCase().includes('esempio')) continue;
        const pName = (r[1] || '').trim();
        const pEmail = (r[2] || '').trim();
        const pPhone = (r[3] || '').trim();
        const confirmed = (r[4] || 'SI').toUpperCase() !== 'NO';
        const dep = parseAmount(r[5] || '0');
        const depPaid = (r[6] || 'SI').toUpperCase() !== 'NO';
        const bal = parseAmount(r[7] || '0');
        const balPaid = (r[8] || 'NO').toUpperCase() === 'SI';
        const meth = normalizePaymentMethod(r[9] || 'Bonifico');
        const notes = (r[10] || '').trim();

        const matchedMember = members.find(
          (m) => m.childName.trim().toLowerCase() === cName.toLowerCase()
        );

        onAddBooking({
          eventId: currentEvent.id,
          eventName: currentEvent.name,
          memberId: matchedMember?.id,
          childName: cName,
          parentName: pName || matchedMember?.parentName || '',
          parentEmail: pEmail || matchedMember?.parentEmail || '',
          parentPhone: pPhone || matchedMember?.parentPhone || '',
          confirmed,
          depositAmount: dep,
          balanceAmount: bal,
          isDepositPaid: depPaid,
          isBalancePaid: balPaid,
          totalPrice: dep + bal,
          annualCardValid: !!matchedMember?.isPaid,
          extraInsurancePaid: false,
          paymentMethod: meth,
          notes,
          confirmationEmailSent: false,
        });
        count++;
      }
      setStatusMsg({ text: `Importati ${count} iscritti per "${currentEvent.name}"!` });
    } catch (err: any) {
      setStatusMsg({ text: err?.message || "Errore nell'importazione del file iscritti." });
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerateGoogleForm = async (customParams?: {
    title: string;
    description: string;
    fields: GoogleFormFieldConfig[];
  }) => {
    if (!currentEvent) return;
    if (!googleUserEmail) {
      setStatusMsg({
        text: 'Connetti prima il tuo account Google per creare automaticamente il Modulo Google nella cartella "Gestionale ASD / 03_Eventi_e_Iscritti".',
      });
      return;
    }
    const ok = confirm(
      `Vuoi creare automaticamente il Modulo Google personalizzato sul tuo account (in "${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.eventi_iscritti.folderName}") per "${currentEvent.name}"?`
    );
    if (!ok) return;

    setIsSyncingForm(true);
    try {
      const created = await createGoogleFormForActivity({
        title:
          customParams?.title ||
          `Iscrizione ${currentEvent.name} - ${profile.name}`,
        description:
          customParams?.description ||
          `Modulo di prenotazione per ${currentEvent.name} (${currentEvent.date}, ${
            currentEvent.location
          }). Fasce d'età: ${currentEvent.ageGroups || 'Tutte'}. Condizioni: ${
            currentEvent.conditions || '-'
          }. Quota soci: € ${currentEvent.memberPrice} / Non soci: € ${currentEvent.nonMemberPrice}.`,
        formType: 'evento',
        customFields: customParams?.fields,
      });
      onUpdateEvent({
        ...currentEvent,
        googleFormId: created.formId,
        googleFormUrl: created.responderUri,
      });
      setIsFormBuilderOpen(false);
      setStatusMsg({
        text: `Modulo Google personalizzato creato in "${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.eventi_iscritti.folderName}"!`,
        linkUrl: created.responderUri,
        linkLabel: 'Apri Modulo Google',
      });
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Errore nella creazione del Google Form.' });
    } finally {
      setIsSyncingForm(false);
    }
  };

  const handleSaveEventSheetToDrive = async () => {
    if (!currentEvent) return;
    if (!googleUserEmail) {
      setStatusMsg({
        text: 'Connetti il tuo account Google per salvare il foglio iscritti e briefing nella cartella "Gestionale ASD / 03_Eventi_e_Iscritti".',
      });
      return;
    }
    const ok = confirm(
      `Vuoi salvare l'elenco iscritti e la scheda briefing di "${currentEvent.name}" in un foglio Google Sheets dentro "${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.eventi_iscritti.folderName}"?`
    );
    if (!ok) return;

    setIsSyncingForm(true);
    try {
      const rows: (string | number | boolean)[][] = [
        [
          'Evento',
          'Data',
          'Fasce Età',
          'Condizioni',
          'Quota Soci (€)',
          'Quota Non Soci (€)',
        ],
        [
          currentEvent.name,
          currentEvent.date,
          currentEvent.ageGroups || '-',
          currentEvent.conditions || '-',
          currentEvent.memberPrice,
          currentEvent.nonMemberPrice,
        ],
        ['', '', '', '', '', ''],
        [
          'Bimbo/a',
          'Genitore',
          'Email',
          'Telefono',
          'Confermato',
          'Caparra (€)',
          'Caparra Pagata',
          'Saldo (€)',
          'Saldo Pagato',
          'Note / Briefing',
        ],
        ...eventBookings.map((b) => [
          b.childName,
          b.parentName,
          b.parentEmail || '',
          b.parentPhone || '',
          b.confirmed ? 'SI' : 'NO',
          b.depositAmount,
          b.isDepositPaid ? 'SI' : 'NO',
          b.balanceAmount,
          b.isBalancePaid ? 'SI' : 'NO',
          b.notes || '',
        ]),
      ];

      const res = await createAndPopulateSpreadsheet(
        `Evento_${currentEvent.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_${currentEvent.date}`,
        [{ sheetTitle: 'Iscritti_e_Briefing', rows }],
        'eventi_iscritti'
      );

      onUpdateEvent({
        ...currentEvent,
        driveSheetId: res.spreadsheetId,
        driveSheetUrl: res.spreadsheetUrl,
      });

      setStatusMsg({
        text: `Foglio Google dell'evento salvato in "${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.eventi_iscritti.folderName}"!`,
        linkUrl: res.spreadsheetUrl,
        linkLabel: 'Apri Foglio Evento su Drive',
      });
    } catch (err: any) {
      setStatusMsg({ text: err?.message || 'Errore nel salvataggio del foglio evento su Drive.' });
    } finally {
      setIsSyncingForm(false);
    }
  };

  const handleSyncGoogleFormResponses = async () => {
    if (!currentEvent) return;
    const formId =
      currentEvent.googleFormId ||
      prompt("Inserisci l'ID del tuo Google Form da cui importare le risposte:") ||
      '';
    if (!formId.trim()) return;

    setIsSyncingForm(true);
    try {
      const data = await fetchGoogleFormResponses(formId.trim());
      let added = 0;
      const defDep = currentEvent.depositDefault ?? Math.round(currentEvent.memberPrice / 2);
      for (const resp of data.responses) {
        const consumed = new Set<string>(['_responseId', '_submittedAt']);
        const pick = (keywords: string[]): string => {
          for (const [k, v] of Object.entries(resp)) {
            if (consumed.has(k)) continue;
            if (keywords.some((kw) => k.toLowerCase().includes(kw))) {
              consumed.add(k);
              return (v || '').trim();
            }
          }
          return '';
        };

        const cName =
          pick(['nome e cognome bimbo', 'nome bimbo', 'partecipante']) ||
          'Partecipante Modulo';
        const pName = pick(['genitore', 'tutore']);
        const pEmail = pick(['email', 'mail']);
        const pPhone = pick(['telefono', 'cellulare']);

        const extraNotes: string[] = [];
        for (const [k, v] of Object.entries(resp)) {
          if (consumed.has(k)) continue;
          const cleanV = (v || '').trim();
          if (cleanV && cleanV.toLowerCase() !== 'no' && cleanV.toLowerCase() !== 'nessuna') {
            extraNotes.push(`${k}: ${cleanV}`);
          }
        }
        const notes = extraNotes.join(' | ');

        const alreadyExists = eventBookings.some(
          (b) => b.childName.trim().toLowerCase() === cName.trim().toLowerCase()
        );
        if (!alreadyExists) {
          const matchedMember = members.find(
            (m) => m.childName.trim().toLowerCase() === cName.trim().toLowerCase()
          );
          onAddBooking({
            eventId: currentEvent.id,
            eventName: currentEvent.name,
            memberId: matchedMember?.id,
            childName: cName,
            parentName: pName,
            parentEmail: pEmail,
            parentPhone: pPhone,
            confirmed: true,
            depositAmount: defDep,
            balanceAmount: Math.max(0, currentEvent.memberPrice - defDep),
            isDepositPaid: false,
            isBalancePaid: false,
            totalPrice: currentEvent.memberPrice,
            annualCardValid: !!matchedMember?.isPaid,
            extraInsurancePaid: false,
            paymentMethod: 'Bonifico',
            notes,
            confirmationEmailSent: false,
          });
          added++;
        }
      }
      setStatusMsg({
        text: `Sincronizzazione Google Form completata: ${added} nuove iscrizioni importate (segnate con "Email da Inviare !").`,
      });
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || 'Errore nella lettura delle risposte da Google Forms.',
      });
    } finally {
      setIsSyncingForm(false);
    }
  };

  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(false);
  const [isBriefingExpanded, setIsBriefingExpanded] = useState(false);

  const syncEligible365 = isTessera365Eligible(syncIssueDate);

  return (
    <div className="space-y-6">
      {/* Event Selection Tabs + New Event Button */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {events.length === 0 ? (
            <span className="text-xs text-slate-400 px-3 py-1.5">
              Nessun evento in archivio — clicca su &quot;Nuovo Evento&quot; per crearne uno.
            </span>
          ) : (
            events.map((ev) => {
              const isSelected = currentEvent?.id === ev.id;
              const count = bookings.filter((b) => b.eventId === ev.id).length;
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>{ev.name}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <button
          onClick={openCreateEventModal}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shrink-0 shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuovo Evento</span>
        </button>
      </div>

      {statusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-xs flex items-center justify-between gap-3">
          <span className="font-medium">{statusMsg.text}</span>
          <div className="flex items-center gap-3 shrink-0">
            {statusMsg.linkUrl && (
              <a
                href={statusMsg.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold underline"
              >
                <span>{statusMsg.linkLabel || 'Apri in Google'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={() => setStatusMsg(null)} className="text-emerald-700 font-bold px-2">
              ✕
            </button>
          </div>
        </div>
      )}

      {!currentEvent ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <div className="text-base font-bold text-slate-800">Nessun evento selezionato</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Puoi creare nuovi eventi personalizzando condizioni di partecipazione, fasce d&apos;età,
            quote soci/non-soci e caparre.
          </p>
          <button
            onClick={openCreateEventModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Crea Primo Evento</span>
          </button>
        </div>
      ) : (
        <>
          {/* Event Hero Card & Streamlined Action Toolbar (Soluzione 5) */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-col gap-4 pb-5 border-b border-slate-100">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 flex-wrap">
                    <span className="uppercase tracking-wider font-semibold text-[10px] px-2 py-0.5 rounded-sm bg-emerald-50 border border-emerald-200">
                      {currentEvent.category.replace('_', ' ')}
                    </span>
                    <span className="flex items-center gap-1 text-slate-600 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      {currentEvent.date}
                    </span>
                    {currentEvent.ageGroups && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                        <Users className="w-3 h-3" />
                        Fasce d&apos;Età: {currentEvent.ageGroups}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                      {currentEvent.name}
                    </h3>
                    <button
                      onClick={() => openEditEventModal(currentEvent)}
                      className="p-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Modifica Evento (nome, date, fasce d'età, condizioni e prezzi)"
                      aria-label="Modifica Evento"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                    </button>
                    <button
                      onClick={() => handleDeleteCurrentEvent(currentEvent)}
                      className="p-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                      title="Elimina questo evento"
                      aria-label="Elimina Evento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Primary Action + Collapsible Import / Google Form Drawer Toggle */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    id="btn-events-toggle-import-drawer"
                    type="button"
                    onClick={() => setIsImportDrawerOpen((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                      isImportDrawerOpen
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                    }`}
                    title="Apri o chiudi gli strumenti di importazione Excel, Modulo Google e salvataggio su Drive"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Importa / Google Form & Excel {isImportDrawerOpen ? '▴' : '▾'}</span>
                  </button>

                  <button
                    id="btn-events-add-participant"
                    onClick={handleOpenAddBooking}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi Iscritto</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Import & Google Form Drawer for Current Event */}
              {isImportDrawerOpen && (
                <div
                  id="events-import-drawer-panel"
                  className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150"
                >
                  <div className="text-slate-600 font-medium">
                    Strumenti Modulo Google, importazione Excel e salvataggio foglio evento su Drive:
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => downloadEmptyExcelTemplate('eventi')}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                      title="Scarica Modello Excel Vuoto Iscritti Evento (.xlsx)"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Modello Excel Vuoto</span>
                    </button>

                    <label
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Importa Iscritti Evento da File Excel / CSV"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Carica Excel/CSV</span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleImportBookingsExcel}
                        className="hidden"
                      />
                    </label>

                    <button
                      onClick={handleSaveEventSheetToDrive}
                      disabled={isSyncingForm}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                      title="Salva Foglio Iscritti e Briefing su Google Drive ('Gestionale ASD / 03_Eventi_e_Iscritti')"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      <span>Salva Foglio su Drive</span>
                    </button>

                    <button
                      onClick={() => setIsFormBuilderOpen(true)}
                      disabled={isSyncingForm}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Crea / Personalizza Modulo Google</span>
                    </button>

                    <button
                      onClick={handleSyncGoogleFormResponses}
                      disabled={isSyncingForm}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                      title="Importa Risposte dal Modulo Google"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingForm ? 'animate-spin' : ''}`} />
                      <span>Sincronizza Risposte Modulo</span>
                    </button>

                    {currentEvent.googleFormUrl && (
                      <a
                        href={currentEvent.googleFormUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-purple-800 bg-white hover:bg-purple-50 border border-purple-200 rounded-lg transition-colors"
                      >
                        <span>Apri Modulo</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {currentEvent.location}
                </span>
                <span>·</span>
                <span className="font-mono text-slate-800 font-semibold">
                  Quota Soci: {formatEuro(currentEvent.memberPrice)} / Non soci:{' '}
                  {formatEuro(currentEvent.nonMemberPrice)}
                </span>
                {currentEvent.depositDefault !== undefined && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-emerald-800 font-medium">
                      Caparra standard: {formatEuro(currentEvent.depositDefault)}
                    </span>
                  </>
                )}
              </div>

              {(currentEvent.conditions || currentEvent.notes) && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {currentEvent.conditions && (
                      <div>
                        <strong className="text-slate-900">Condizioni & Requisiti:</strong>{' '}
                        {currentEvent.conditions}
                      </div>
                    )}
                    {currentEvent.notes && (
                      <div className="text-slate-500">{currentEvent.notes}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Financial Breakdown Grid for the Event */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">
                  Incasso Totale
                </div>
                <div className="text-base font-bold text-emerald-800 font-mono mt-0.5 tabular-nums">
                  {formatEuro(economics.totalCollected)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {economics.confirmedCount} confermati
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">
                  Spese Vive Totali
                </div>
                <div className="text-base font-bold text-rose-700 font-mono mt-0.5 tabular-nums">
                  {formatEuro(economics.benchmarkCost)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Rifugio, pasti e materiali</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">
                  Fondo Cassa ASD
                </div>
                <div className="text-base font-bold text-slate-800 font-mono mt-0.5 tabular-nums">
                  {formatEuro(economics.reserveFund)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Accantonamento associazione</div>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100">
                <div className="text-[10px] text-emerald-700 uppercase font-semibold">
                  Utile da Dividere
                </div>
                <div className="text-base font-bold text-emerald-900 font-mono mt-0.5 tabular-nums">
                  {formatEuro(economics.netToDivide)}
                </div>
                <div className="text-[10px] text-emerald-700/80 mt-0.5">Compenso totale staff</div>
              </div>

              <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100">
                <div className="text-[10px] text-amber-700 uppercase font-semibold">
                  Quota a Testa Staff
                </div>
                <div className="text-base font-bold text-amber-900 font-mono mt-0.5 tabular-nums">
                  {formatEuro(economics.perStaffShare)}
                </div>
                <div className="text-[10px] text-amber-700/80 mt-0.5">
                  Diviso per {economics.targetStaff} operatori
                </div>
              </div>
            </div>
          </div>

          {/* COMPACT COLLAPSIBLE PRE-EVENT BRIEFING ACCORDION */}
          {currentBriefing && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => setIsBriefingExpanded((prev) => !prev)}
                className="w-full px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5 flex-wrap">
                  <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                    Briefing Sicurezza & Tessere ({currentBriefing.totalConfirmed} iscritti)
                  </h4>
                  {currentBriefing.missingOrExpiredCardList.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                      Tessere da sistemare: {currentBriefing.missingOrExpiredCardList.length}
                    </span>
                  )}
                  {currentBriefing.allergiesList.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                      Allergie: {currentBriefing.allergiesList.length}
                    </span>
                  )}
                  {currentBriefing.noPhotoConsentList.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                      Senza Foto: {currentBriefing.noPhotoConsentList.length}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {isBriefingExpanded ? 'Nascondi dettagli ▴' : 'Mostra dettagli ▾'}
                </span>
              </button>

              {isBriefingExpanded && (
                <div className="p-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-slate-50/40">
                  <div
                    className={`p-3.5 rounded-xl border ${
                      currentBriefing.missingOrExpiredCardList.length > 0
                        ? 'bg-rose-50/60 border-rose-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 mb-2">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle
                          className={`w-3.5 h-3.5 ${
                            currentBriefing.missingOrExpiredCardList.length > 0
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        />
                        Tessere Scadute / Assenti
                      </span>
                      <span className="font-mono px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-[11px]">
                        {currentBriefing.missingOrExpiredCardList.length}
                      </span>
                    </div>
                    {currentBriefing.missingOrExpiredCardList.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Tutti i partecipanti confermati hanno tessera valida.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-[11px] text-rose-900">
                        {currentBriefing.missingOrExpiredCardList.map((p) => {
                          const targetBk = eventBookings.find((b) => b.id === p.bookingId);
                          return (
                            <li
                              key={p.bookingId}
                              className="leading-snug flex items-center justify-between gap-2 bg-white/80 p-1.5 rounded-lg border border-rose-200/80"
                            >
                              <div>
                                <strong>{p.childName}</strong>: {p.cardDetails}
                              </div>
                              {targetBk && (
                                <button
                                  type="button"
                                  onClick={() => openSyncMemberModalForBooking(targetBk)}
                                  className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white font-semibold text-[10px] shrink-0"
                                >
                                  Inserisci Tessera
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border ${
                      currentBriefing.allergiesList.length > 0
                        ? 'bg-amber-50/70 border-amber-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 mb-2">
                      <span className="flex items-center gap-1.5">
                        <HeartPulse className="w-3.5 h-3.5 text-rose-600" />
                        Allergie & Farmaci
                      </span>
                      <span className="font-mono px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-[11px]">
                        {currentBriefing.allergiesList.length}
                      </span>
                    </div>
                    {currentBriefing.allergiesList.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Nessuna allergia segnalata.</p>
                    ) : (
                      <ul className="space-y-1.5 text-[11px] text-amber-950">
                        {currentBriefing.allergiesList.map((p) => (
                          <li key={p.bookingId} className="leading-snug">
                            <strong>{p.childName}</strong>: {p.allergies}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl border bg-white border-slate-200">
                    <div className="flex items-center justify-between font-bold text-slate-900 mb-2">
                      <span>Esigenze Speciali & Note</span>
                      <span className="font-mono px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-[11px]">
                        {currentBriefing.specialNeedsList.length}
                      </span>
                    </div>
                    {currentBriefing.specialNeedsList.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Nessuna nota particolare.</p>
                    ) : (
                      <ul className="space-y-1.5 text-[11px] text-slate-700">
                        {currentBriefing.specialNeedsList.map((p) => (
                          <li key={p.bookingId} className="leading-snug">
                            <strong>{p.childName}</strong>: {p.specialConditions}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div
                    className={`p-3.5 rounded-xl border ${
                      currentBriefing.noPhotoConsentList.length > 0
                        ? 'bg-rose-50/60 border-rose-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 mb-2">
                      <span className="flex items-center gap-1.5">
                        <CameraOff className="w-3.5 h-3.5 text-rose-600" />
                        Senza Consenso Foto
                      </span>
                      <span className="font-mono px-1.5 py-0.5 rounded-full bg-white border border-slate-200 text-[11px]">
                        {currentBriefing.noPhotoConsentList.length}
                      </span>
                    </div>
                    {currentBriefing.noPhotoConsentList.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        Tutti hanno consenso foto attivo.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-[11px] text-rose-900">
                        {currentBriefing.noPhotoConsentList.map((p) => (
                          <li key={p.bookingId} className="leading-snug">
                            <strong>{p.childName}</strong> — NON fotografare
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bookings / Registrations Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-bold text-slate-900 text-sm">
                Elenco Iscritti ({eventBookings.length} partecipanti)
              </h4>
              <div className="text-xs text-slate-500 flex items-center gap-3">
                <span className="text-emerald-700 font-semibold font-mono">
                  Incassati: {formatEuro(economics.totalCollected)}
                </span>
                <span>·</span>
                <span className="text-rose-700 font-semibold font-mono">
                  In Sospeso: {formatEuro(economics.totalPending)}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Bimbo/a</th>
                    <th className="py-3 px-4">Genitore / Contatto</th>
                    <th className="py-3 px-4 text-center">Stato</th>
                    <th className="py-3 px-4 text-right">Caparra (€)</th>
                    <th className="py-3 px-4 text-right">Saldo (€)</th>
                    <th className="py-3 px-4 text-center">Tessera & Anagrafica (Clicca)</th>
                    <th className="py-3 px-4 text-center">Stato Email</th>
                    <th className="py-3 px-4 text-center">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eventBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Nessuna prenotazione inserita per "{currentEvent.name}". Clicca su "Aggiungi
                        Iscritto", carica un file Excel o sincronizza le risposte dal Google Form.
                      </td>
                    </tr>
                  ) : (
                    eventBookings.map((bk) => {
                      const member = members.find(
                        (m) =>
                          (bk.memberId && m.id === bk.memberId) ||
                          m.childName.trim().toLowerCase() === bk.childName.trim().toLowerCase()
                      );
                      const participantAlert = currentBriefing?.allParticipants.find(
                        (a) => a.bookingId === bk.id
                      );
                      const isEmailSent = !!bk.confirmationEmailSent;

                      return (
                        <tr key={bk.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{bk.childName}</span>
                              {member ? (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-semibold"
                                  title="Socio collegato all'Anagrafica Soci"
                                >
                                  In Anagrafica
                                </span>
                              ) : (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-semibold"
                                  title="Non ancora presente in Anagrafica Soci: clicca sul pulsante Tessera per inserirlo automaticamente"
                                >
                                  Non in Anagrafica
                                </span>
                              )}
                            </div>
                            {((bk.discountAmount && bk.discountAmount > 0) ||
                              (bk.voucherApplied && bk.voucherApplied > 0)) && (
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {bk.discountAmount && bk.discountAmount > 0 ? (
                                  <span
                                    onClick={() => openDiscountBookingModal(bk)}
                                    className="cursor-pointer inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[9px] font-bold hover:bg-indigo-100"
                                    title="Clicca per modificare lo sconto o la dicitura per questo evento"
                                  >
                                    <Tag className="w-2.5 h-2.5 text-indigo-600" />
                                    Sconto -{formatEuro(bk.discountAmount)}
                                    {bk.discountLabel ? ` (${bk.discountLabel})` : ''}
                                  </span>
                                ) : null}
                                {bk.voucherApplied && bk.voucherApplied > 0 ? (
                                  <span
                                    onClick={() => openDiscountBookingModal(bk)}
                                    className="cursor-pointer inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200 text-[9px] font-bold hover:bg-violet-100"
                                    title="Clicca per modificare il buono applicato"
                                  >
                                    <Ticket className="w-2.5 h-2.5 text-violet-600" />
                                    Buono -{formatEuro(bk.voucherApplied)}
                                  </span>
                                ) : null}
                              </div>
                            )}
                            {bk.notes && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{bk.notes}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-700">
                            <div>{bk.parentName || '-'}</div>
                            {bk.parentEmail && (
                              <div className="text-[10px] text-slate-400">{bk.parentEmail}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => onUpdateBooking({ ...bk, confirmed: !bk.confirmed })}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                                bk.confirmed
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {bk.confirmed ? 'Confermato' : 'In attesa'}
                            </button>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            <button
                              onClick={() =>
                                onUpdateBooking({ ...bk, isDepositPaid: !bk.isDepositPaid })
                              }
                              className={`font-semibold hover:underline ${
                                bk.isDepositPaid ? 'text-emerald-700' : 'text-slate-400'
                              }`}
                            >
                              {bk.depositAmount > 0 ? formatEuro(bk.depositAmount) : '-'}
                              {bk.isDepositPaid && bk.depositAmount > 0 ? ' ✓' : ''}
                            </button>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            <button
                              onClick={() =>
                                onUpdateBooking({ ...bk, isBalancePaid: !bk.isBalancePaid })
                              }
                              className={`font-semibold hover:underline ${
                                bk.isBalancePaid ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {bk.balanceAmount > 0 ? formatEuro(bk.balanceAmount) : '-'}
                              {bk.isBalancePaid && bk.balanceAmount > 0 ? ' ✓' : ''}
                            </button>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {participantAlert && participantAlert.cardStatus !== 'ok' ? (
                              <button
                                id={`btn-event-sync-card-${bk.id}`}
                                type="button"
                                onClick={() => openSyncMemberModalForBooking(bk)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold transition-colors shadow-2xs"
                                title={`${participantAlert.cardDetails} — Clicca per aprire il popup con i dati attuali e inserire/rinnovare direttamente in Anagrafica e Tessere`}
                              >
                                <CreditCard className="w-3 h-3 text-rose-600" />
                                <span>Inserisci / Rinnova Tessera</span>
                              </button>
                            ) : (
                              <button
                                id={`btn-event-sync-card-${bk.id}`}
                                type="button"
                                onClick={() => openSyncMemberModalForBooking(bk)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-[10px] transition-colors"
                                title="Clicca per vedere e modificare i dati attuali del socio in Anagrafica e la sua Tessera"
                              >
                                <UserCheck className="w-3 h-3 text-emerald-600" />
                                <span>Tessera OK · Vedi Scheda</span>
                              </button>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() =>
                                onUpdateBooking({
                                  ...bk,
                                  confirmationEmailSent: !isEmailSent,
                                })
                              }
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                isEmailSent
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-300'
                              }`}
                            >
                              {isEmailSent ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" /> Inviata
                                </>
                              ) : (
                                <>
                                  <Send className="w-2.5 h-2.5" /> Da Inviare !
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openDiscountBookingModal(bk)}
                                className={`p-1.5 rounded-md transition-colors ${
                                  (bk.discountAmount && bk.discountAmount > 0) ||
                                  (bk.voucherApplied && bk.voucherApplied > 0)
                                    ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                                    : 'text-slate-500 hover:text-indigo-700 hover:bg-slate-100'
                                }`}
                                title="Applica o modifica Sconto per questo Evento (Quota Fissa € / %) o Buono Spesa"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => openSyncMemberModalForBooking(bk)}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors"
                                title="Vedi / Modifica dati in Anagrafica Soci e Tessera"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => {
                                  onUpdateBooking({ ...bk, confirmationEmailSent: true });
                                  onOpenReceiptModalForBooking(bk, member);
                                }}
                                className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors"
                                title="Genera preventivo / ricevuta PDF e Invia via Gmail"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {bk.parentEmail && (
                                <a
                                  href={generateReceiptEmailLink({
                                    toEmail: bk.parentEmail,
                                    parentName: bk.parentName,
                                    childName: bk.childName,
                                    activityName: currentEvent.name,
                                    amount: bk.isBalancePaid ? bk.totalPrice : bk.depositAmount,
                                    type: bk.isBalancePaid ? 'ricevuta' : 'preventivo',
                                    association: profile,
                                  })}
                                  onClick={() =>
                                    onUpdateBooking({ ...bk, confirmationEmailSent: true })
                                  }
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-md transition-colors"
                                  title="Invia email precompilata e segna come inviata"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </a>
                              )}

                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Confermi la rimozione dell'iscritto "${bk.childName}" da questo evento?`
                                    )
                                  ) {
                                    onDeleteBooking(bk.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                                title="Rimuovi iscritto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        </>
      )}

      {/* =====================================================================
          POPUP COORDINAMENTO AUTOMATICO: EVENTO <-> ANAGRAFICA SOCI & TESSERE
         ===================================================================== */}
      {syncBookingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      syncExistingMember
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {syncExistingMember
                      ? 'Socio Già Presente in Anagrafica (Modifica Diretta)'
                      : 'Nuovo Socio da Inserire in Anagrafica'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Evento: {syncBookingTarget.eventName}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base mt-1 flex items-center gap-2">
                  {syncExistingMember ? (
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <UserPlus className="w-4 h-4 text-amber-600" />
                  )}
                  <span>
                    Scheda Coordinata Anagrafica & Tessera: {syncBookingTarget.childName}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {syncExistingMember
                    ? "Ecco i dati attuali presenti in Anagrafica Soci. Qualsiasi modifica salvata qui aggiorna in automatico sia l'Evento, sia l'Anagrafica Soci, sia la Sezione Tessere."
                    : "Questo iscritto non era ancora in Anagrafica Soci: i dati dell'evento sono già precompilati qui sotto. Salvando verrà inserito automaticamente anche in Anagrafica Soci e nella Sezione Tessere."}
                </p>
              </div>
              <button
                onClick={() => {
                  setSyncBookingTarget(null);
                  setSyncExistingMember(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSyncMemberAndCard} className="space-y-4 text-xs">
              {/* 1. Dati Anagrafici & Contatti */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                  1. Dati Attuali Socio & Genitore (Sincronizzati con Anagrafica Soci)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-medium mb-1">
                      Nome e Cognome Bimbo/a *
                    </label>
                    <input
                      type="text"
                      required
                      value={syncChildName}
                      onChange={(e) => setSyncChildName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Fascia d'Età</label>
                    <select
                      value={syncGroup}
                      onChange={(e) => setSyncGroup(e.target.value as AgeGroup)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="3-6">3-6 anni</option>
                      <option value="6-11">6-11 anni</option>
                      <option value="11-14">11-14 anni</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Data Nascita</label>
                    <input
                      type="text"
                      placeholder="GG/MM/AAAA"
                      value={syncBirthDate}
                      onChange={(e) => setSyncBirthDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Luogo Nascita</label>
                    <input
                      type="text"
                      value={syncBirthPlace}
                      onChange={(e) => setSyncBirthPlace(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Codice Fiscale Bimbo/a
                    </label>
                    <input
                      type="text"
                      value={syncChildFiscalCode}
                      onChange={(e) => setSyncChildFiscalCode(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Genitore / Tutore</label>
                    <input
                      type="text"
                      value={syncParentName}
                      onChange={(e) => setSyncParentName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Telefono</label>
                    <input
                      type="text"
                      value={syncParentPhone}
                      onChange={(e) => setSyncParentPhone(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Email Genitore</label>
                    <input
                      type="email"
                      value={syncParentEmail}
                      onChange={(e) => setSyncParentEmail(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Dati Tessera US ACLI & Copertura Assicurativa */}
              <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-3">
                <div className="font-bold text-emerald-950 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                  <span>2. Tessera Associativa & Copertura Assicurativa (Sincronizzata con Sezione Tessere)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Numero Tessera US ACLI
                    </label>
                    <input
                      id="input-event-sync-card-number"
                      type="text"
                      placeholder="Es. 26ACLI00123"
                      value={syncCardNumber}
                      onChange={(e) => setSyncCardNumber(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Copertura Assicurativa
                    </label>
                    <select
                      value={syncInsurance}
                      onChange={(e) => setSyncInsurance(e.target.value as InsuranceType)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold"
                    >
                      <option value="Gold">{getInsuranceDisplayLabel('Gold', profile)}</option>
                      <option value="Platinum">{getInsuranceDisplayLabel('Platinum', profile)}</option>
                      <option value="Summer">{getInsuranceDisplayLabel('Summer', profile)}</option>
                      <option value="Base">{getInsuranceDisplayLabel('Base', profile)}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Data Emissione Tessera
                    </label>
                    <input
                      type="date"
                      value={syncIssueDate}
                      onChange={(e) => {
                        const nextDate = e.target.value;
                        setSyncIssueDate(nextDate);
                        const can365 = isTessera365Eligible(nextDate);
                        const nextVal: CardValidityType =
                          syncValidityType === 'tessera_365' && can365 ? 'tessera_365' : 'solare';
                        setSyncValidityType(nextVal);
                        setSyncExpiryDate(calculateCardExpiryDate(nextDate, nextVal));
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-medium mb-1">
                      Formula Validità Tessera
                    </label>
                    <select
                      value={syncValidityType}
                      onChange={(e) => {
                        const val = e.target.value as CardValidityType;
                        setSyncValidityType(val);
                        setSyncExpiryDate(calculateCardExpiryDate(syncIssueDate, val));
                      }}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    >
                      <option value="solare">Ordinaria Solare (Scade 31 Dicembre)</option>
                      <option value="tessera_365" disabled={!syncEligible365}>
                        Tessera 365 (12 mesi — attivabile dal 1° Settembre)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Scadenza Tessera
                    </label>
                    <input
                      type="text"
                      value={syncExpiryDate}
                      onChange={(e) => setSyncExpiryDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-emerald-950">
                    <input
                      type="checkbox"
                      checked={syncIsCardPaid}
                      onChange={(e) => setSyncIsCardPaid(e.target.checked)}
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span>Quota Tessera Regolarizzata / Pagata</span>
                  </label>

                  {syncIsCardPaid && (
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-emerald-900">
                      <input
                        type="checkbox"
                        checked={syncRecordCardCash}
                        onChange={(e) => setSyncRecordCardCash(e.target.checked)}
                        className="rounded-sm border-slate-300 text-emerald-600"
                      />
                      <span>Registra incasso tessera anche nel Flusso di Cassa</span>
                    </label>
                  )}
                </div>

                {syncIsCardPaid && syncRecordCardCash && (
                  <div className="pt-2 space-y-2.5 border-t border-emerald-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Importo Quota Tessera (€)
                        </label>
                        <input
                          type="number"
                          step="1"
                          value={syncCardAmount}
                          onChange={(e) => setSyncCardAmount(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Canale Pagamento Tessera
                        </label>
                        <select
                          value={syncCardMethod}
                          onChange={(e) => setSyncCardMethod(e.target.value as PaymentMethod)}
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
                      dateMode={syncCardCashDateMode}
                      onDateModeChange={setSyncCardCashDateMode}
                      customDate={syncCardCashDate}
                      onCustomDateChange={setSyncCardCashDate}
                      label="Con quale data vuoi registrare l'incasso della tessera nel Flusso di Cassa?"
                    />
                  </div>
                )}
              </div>

              {/* 3. Allergie, Esigenze Speciali e Consenso Foto */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                  3. Salute, Allergie, Bisogni Speciali & Liberatoria Foto
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Allergie / Intolleranze / Farmaci Salvavita
                    </label>
                    <input
                      type="text"
                      placeholder="Es. Nessuna, oppure polline, lattosio..."
                      value={syncAllergies}
                      onChange={(e) => setSyncAllergies(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Note / Bisogni Speciali / Autonomie
                    </label>
                    <input
                      type="text"
                      value={syncNotesConditions}
                      onChange={(e) => setSyncNotesConditions(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={syncPhotoConsent}
                    onChange={(e) => setSyncPhotoConsent(e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-600"
                  />
                  <span>Consenso Foto / Video Autorizzato</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSyncBookingTarget(null);
                    setSyncExistingMember(null);
                  }}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  id="btn-confirm-event-member-sync"
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold shadow-xs"
                >
                  {syncExistingMember
                    ? 'Salva Modifiche in Evento, Anagrafica e Tessere'
                    : 'Inserisci in Anagrafica Soci e Regolarizza Tessera'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crea / Modifica Evento (con Fasce d'Età, Condizioni, Caparra, Sconto Predefinito e Prezzi) */}
      {isEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingEvent
                  ? `Modifica Evento: ${editingEvent.name}`
                  : 'Crea Nuovo Evento / Campo / Attività'}
              </h3>
              <button
                onClick={() => setIsEventModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nome Evento *</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Uscita Rifugio Rossi - Maggio"
                  value={evName}
                  onChange={(e) => setEvName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tipologia *</label>
                  <select
                    value={evCat}
                    onChange={(e) => setEvCat(e.target.value as EventItem['category'])}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="rifugio">Uscita in Rifugio / Viaggio</option>
                    <option value="summer_camp">Summer Camp Estivo</option>
                    <option value="wild_camp">Wild Camp</option>
                    <option value="selva">Selva (Attività Mensile)</option>
                    <option value="giornata">Escursione Giornaliera</option>
                    <option value="altro">Altra Attività</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Data Inizio *</label>
                  <input
                    type="date"
                    required
                    value={evDate}
                    onChange={(e) => setEvDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Stato Evento</label>
                  <select
                    value={evStatus}
                    onChange={(e) => setEvStatus(e.target.value as EventItem['status'])}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="aperto">Iscrizioni Aperte</option>
                    <option value="in_corso">In Corso</option>
                    <option value="concluso">Concluso</option>
                    <option value="annullato">Annullato</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Località</label>
                  <input
                    type="text"
                    value={evLoc}
                    onChange={(e) => setEvLoc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Fasce d'Età Ammesse *
                  </label>
                  <input
                    type="text"
                    placeholder="Es. 6-11 anni, 11-14 anni (o 3-6 anni)"
                    value={evAgeGroups}
                    onChange={(e) => setEvAgeGroups(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Quota Soci (€)</label>
                  <input
                    type="number"
                    value={evMemberPrice}
                    onChange={(e) => setEvMemberPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Quota Non Soci (€)
                  </label>
                  <input
                    type="number"
                    value={evNonMemberPrice}
                    onChange={(e) => setEvNonMemberPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Caparra Richiesta (€)
                  </label>
                  <input
                    type="number"
                    value={evDepositDefault}
                    onChange={(e) => setEvDepositDefault(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">N° Operatori Staff</label>
                  <input
                    type="number"
                    min={1}
                    value={evStaffCount}
                    onChange={(e) => setEvStaffCount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              {/* Opzione Sconto / Agevolazione per questo Evento */}
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-2.5">
                <div className="flex items-center gap-1.5 font-bold text-indigo-950 uppercase tracking-wider text-[10px]">
                  <Tag className="w-3.5 h-3.5 text-indigo-700" />
                  <span>
                    Opzione Sconto / Copertura Quota per questo Evento (Opzionale, modificabile per ogni iscritto)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-indigo-900 font-semibold mb-1 text-[11px]">
                      Tipo Sconto Evento
                    </label>
                    <select
                      value={evDefaultDiscountType}
                      onChange={(e) =>
                        setEvDefaultDiscountType(e.target.value as 'none' | 'fixed' | 'percent')
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white"
                    >
                      <option value="none">Nessuno sconto predefinito</option>
                      <option value="fixed">Quota Fissa (€)</option>
                      <option value="percent">Percentuale (%)</option>
                    </select>
                  </div>
                  {evDefaultDiscountType !== 'none' && (
                    <>
                      <div>
                        <label className="block text-indigo-900 font-semibold mb-1 text-[11px]">
                          Valore Sconto ({evDefaultDiscountType === 'percent' ? '%' : '€'})
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={evDefaultDiscountValue}
                          onChange={(e) => setEvDefaultDiscountValue(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-indigo-900 font-semibold mb-1 text-[11px]">
                          Dicitura in Ricevuta (Salvabile)
                        </label>
                        <input
                          type="text"
                          list="saved-discount-labels-list"
                          placeholder="Es. Quota coperta da Comune / ISEE..."
                          value={evDefaultDiscountLabel}
                          onChange={(e) => setEvDefaultDiscountLabel(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Condizioni di Partecipazione, Sconti Fratelli & Equipaggiamento
                </label>
                <textarea
                  rows={2}
                  placeholder="Es. Richiesta tessera Gold/Platinum, sconto 10% secondo fratello, sacco a pelo..."
                  value={evConditions}
                  onChange={(e) => setEvConditions(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Note Aggiuntive</label>
                <input
                  type="text"
                  value={evNotes}
                  onChange={(e) => setEvNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEventModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  {editingEvent ? 'Salva Modifiche Evento' : 'Crea Evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Datalist diciture sconto salvate per riutilizzo immediato */}
      <datalist id="saved-discount-labels-list">
        {savedDiscountLabels.map((lbl) => (
          <option key={lbl} value={lbl} />
        ))}
      </datalist>

      {/* Add Booking Modal */}
      {isAddBookingOpen && currentEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Iscrivi Partecipante a {currentEvent.name}
              </h3>
              <button
                onClick={() => setIsAddBookingOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Seleziona dall'Anagrafica Soci (Incrocia automaticamente tessera, allergie e buono spesa)
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => handleSelectMember(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50"
                >
                  <option value="">-- Nuovo partecipante non presente o seleziona socio --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.childName} (Genitore: {m.parentName} - Tessera:{' '}
                      {m.membershipCardNumber || 'N/D'}
                      {m.voucherBalance && m.voucherBalance > 0
                        ? ` · Buono disp. € ${m.voucherBalance.toFixed(2)}`
                        : ''}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nome Bimbo/a *</label>
                  <input
                    type="text"
                    required
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nome Genitore *</label>
                  <input
                    type="text"
                    required
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Email Genitore</label>
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Telefono</label>
                  <input
                    type="text"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              {!selectedMemberId && (
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncToAnagrafica}
                    onChange={(e) => setAutoSyncToAnagrafica(e.target.checked)}
                    className="rounded-sm border-emerald-300 text-emerald-700"
                  />
                  <span>
                    Coordinamento Automatico: inserisci questo partecipante anche in Anagrafica Soci
                  </span>
                </label>
              )}

              {/* SCONTO EVENTO (QUOTA FISSA € O PERCENTUALE %) & BUONO SPESA SOCIO */}
              <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-indigo-950 uppercase tracking-wider text-[10px]">
                    <Tag className="w-3.5 h-3.5 text-indigo-700" />
                    <span>
                      Sconto Evento (ISEE / Enti / Fratelli) & Compensazione Buono Spesa
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-indigo-900">
                    Quota Base: {formatEuro(bookingBasePrice)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-indigo-900 font-semibold mb-1 text-[11px]">
                      Tipo Sconto per questo Evento
                    </label>
                    <select
                      value={bookingDiscountType}
                      onChange={(e) => {
                        const nextType = e.target.value as 'none' | 'fixed' | 'percent';
                        setBookingDiscountType(nextType);
                        const nextVal = nextType === 'none' ? 0 : bookingDiscountValue;
                        if (nextType === 'none') setBookingDiscountValue(0);
                        applyRecalculatedBookingAmounts(
                          bookingBasePrice,
                          nextType,
                          nextVal,
                          bookingVoucherUsed,
                          depositAmount
                        );
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white"
                    >
                      <option value="none">Nessuno sconto</option>
                      <option value="fixed">Quota Fissa (€)</option>
                      <option value="percent">Percentuale (%)</option>
                    </select>
                  </div>

                  {bookingDiscountType !== 'none' && (
                    <>
                      <div>
                        <label className="block text-indigo-900 font-semibold mb-1 text-[11px]">
                          Valore Sconto ({bookingDiscountType === 'percent' ? '%' : '€'})
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={bookingDiscountValue}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setBookingDiscountValue(val);
                            applyRecalculatedBookingAmounts(
                              bookingBasePrice,
                              bookingDiscountType,
                              val,
                              bookingVoucherUsed,
                              depositAmount
                            );
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-indigo-900 font-semibold mb-1 text-[11px]">
                          Buono Spesa da Usare (€)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={bookingVoucherUsed}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setBookingVoucherUsed(val);
                            applyRecalculatedBookingAmounts(
                              bookingBasePrice,
                              bookingDiscountType,
                              bookingDiscountValue,
                              val,
                              depositAmount
                            );
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 bg-white font-mono font-bold text-violet-900"
                        />
                      </div>
                    </>
                  )}

                  {bookingDiscountType === 'none' && (
                    <div className="sm:col-span-2">
                      <label className="block text-violet-900 font-semibold mb-1 text-[11px]">
                        Usa Buono Spesa Socio (€)
                        {selectedMemberId ? (() => {
                          const m = members.find((mem) => mem.id === selectedMemberId);
                          return m?.voucherBalance ? ` — Disponibili: € ${m.voucherBalance.toFixed(2)}` : '';
                        })() : ''}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={bookingVoucherUsed}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value));
                          setBookingVoucherUsed(val);
                          applyRecalculatedBookingAmounts(
                            bookingBasePrice,
                            bookingDiscountType,
                            bookingDiscountValue,
                            val,
                            depositAmount
                          );
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-violet-200 bg-white font-mono font-bold text-violet-900"
                      />
                    </div>
                  )}
                </div>

                {bookingDiscountType !== 'none' && (
                  <div className="space-y-1.5">
                    <label className="block text-indigo-900 font-semibold text-[11px]">
                      Dicitura Sconto / Copertura Quota per la Ricevuta (resta salvata tra le selezionabili)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={
                          savedDiscountLabels.includes(bookingDiscountLabel)
                            ? bookingDiscountLabel
                            : ''
                        }
                        onChange={(e) => {
                          if (e.target.value) setBookingDiscountLabel(e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white text-[11px]"
                      >
                        <option value="">-- Scegli dicitura salvata o scrivi a fianco --</option>
                        {savedDiscountLabels.map((lbl) => (
                          <option key={lbl} value={lbl}>
                            {lbl}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        list="saved-discount-labels-list"
                        placeholder="Oppure scrivi nuova dicitura (es. Contributo Associazione X)"
                        value={bookingDiscountLabel}
                        onChange={(e) => setBookingDiscountLabel(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white text-[11px]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Importo Caparra (€)
                  </label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => {
                      const nextDep = Number(e.target.value);
                      setDepositAmount(nextDep);
                      applyRecalculatedBookingAmounts(
                        bookingBasePrice,
                        bookingDiscountType,
                        bookingDiscountValue,
                        bookingVoucherUsed,
                        nextDep
                      );
                    }}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono bg-white"
                  />
                  <label className="flex items-center gap-2 mt-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={isDepositPaid}
                      onChange={(e) => setIsDepositPaid(e.target.checked)}
                    />
                    <span>Caparra già incassata</span>
                  </label>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Importo Saldo Netto (€)
                  </label>
                  <input
                    type="number"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 font-mono bg-white"
                  />
                  <label className="flex items-center gap-2 mt-2 text-slate-700">
                    <input
                      type="checkbox"
                      checked={isBalancePaid}
                      onChange={(e) => setIsBalancePaid(e.target.checked)}
                    />
                    <span>Saldo già incassato</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Canale Pagamento</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="Bonifico">Bonifico</option>
                    <option value="Contanti">Contanti</option>
                    <option value="POS">POS / Carta</option>
                    <option value="Paypal">Paypal</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end gap-1.5 pb-1">
                  <label className="flex items-center gap-2 text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={extraInsurance}
                      onChange={(e) => setExtraInsurance(e.target.checked)}
                    />
                    <span>Con assicurazione extra (+10€)</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-700 font-medium">
                    <input
                      type="checkbox"
                      checked={emailSent}
                      onChange={(e) => setEmailSent(e.target.checked)}
                    />
                    <span>Email conferma già inviata</span>
                  </label>
                </div>
              </div>

              {(isDepositPaid || isBalancePaid) && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-emerald-900 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoRecordBookingCash}
                      onChange={(e) => setAutoRecordBookingCash(e.target.checked)}
                      className="rounded-sm border-slate-300 text-emerald-600"
                    />
                    <span>Registra automaticamente l'incasso nel Flusso di Cassa</span>
                  </label>

                  {autoRecordBookingCash && (
                    <TransactionDateSelector
                      dateMode={bookingCashDateMode}
                      onDateModeChange={setBookingCashDateMode}
                      customDate={bookingCashDate}
                      onCustomDateChange={setBookingCashDate}
                      label="Con quale data vuoi registrare l'incasso dell'evento nel Flusso di Cassa?"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Note / Richieste specifiche per l'evento
                </label>
                <input
                  type="text"
                  placeholder="Es. Dieta senza glutine, partenza da Carrara..."
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddBookingOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  Conferma Iscrizione
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Rapido Sconto Evento (ISEE / Enti / Quota Fissa o %) & Buono Spesa */}
      {discountModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 my-8">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[10px] font-bold uppercase">
                  Sconto Evento & Buono Spesa
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-1">
                  {discountModalBooking.childName} · {discountModalBooking.eventName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Imposta uno sconto in Quota Fissa (€) o Percentuale (%) valido per questo evento e scegli o inserisci la dicitura che comparirà anche nella ricevuta.
                </p>
              </div>
              <button
                onClick={() => setDiscountModalBooking(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBookingDiscountAndVoucher} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Quota Base Evento (€)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={editBkBasePrice}
                    onChange={(e) => setEditBkBasePrice(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipo Sconto</label>
                  <select
                    value={editBkDiscountType}
                    onChange={(e) => {
                      const t = e.target.value as 'none' | 'fixed' | 'percent';
                      setEditBkDiscountType(t);
                      if (t === 'none') setEditBkDiscountValue(0);
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold"
                  >
                    <option value="none">Nessuno sconto</option>
                    <option value="fixed">Quota Fissa (€)</option>
                    <option value="percent">Percentuale (%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Valore Sconto ({editBkDiscountType === 'percent' ? '%' : '€'})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    disabled={editBkDiscountType === 'none'}
                    value={editBkDiscountValue}
                    onChange={(e) => setEditBkDiscountValue(Math.max(0, Number(e.target.value)))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold disabled:bg-slate-100"
                  />
                </div>
              </div>

              {editBkDiscountType !== 'none' && (
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 space-y-2">
                  <label className="block text-indigo-950 font-bold text-[11px]">
                    Dicitura Sconto / Copertura Quota per la Ricevuta (resta salvata tra le selezionabili per altri soci ed eventi)
                  </label>
                  <select
                    value={savedDiscountLabels.includes(editBkDiscountLabel) ? editBkDiscountLabel : ''}
                    onChange={(e) => {
                      if (e.target.value) setEditBkDiscountLabel(e.target.value);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg border border-indigo-200 bg-white"
                  >
                    <option value="">-- Seleziona una dicitura salvata --</option>
                    {savedDiscountLabels.map((lbl) => (
                      <option key={lbl} value={lbl}>
                        {lbl}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    list="saved-discount-labels-list"
                    placeholder="Oppure scrivi una nuova dicitura (es. Contributo Associazione X / Riduzione ISEE)"
                    value={editBkDiscountLabel}
                    onChange={(e) => setEditBkDiscountLabel(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-indigo-200 bg-white"
                  />
                </div>
              )}

              <div className="p-3 bg-violet-50 rounded-xl border border-violet-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-violet-950 font-bold text-[11px] flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5 text-violet-700" />
                    <span>Buono Spesa applicato a questo evento (€)</span>
                  </label>
                  {(() => {
                    const m = members.find(
                      (mem) =>
                        (discountModalBooking.memberId && mem.id === discountModalBooking.memberId) ||
                        mem.childName.trim().toLowerCase() ===
                          discountModalBooking.childName.trim().toLowerCase()
                    );
                    return m && (m.voucherBalance || 0) > 0 ? (
                      <span className="text-[10px] font-mono font-bold text-violet-800">
                        Credito Socio in Anagrafica: {formatEuro(m.voucherBalance || 0)}
                      </span>
                    ) : null;
                  })()}
                </div>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={editBkVoucherUsed}
                  onChange={(e) => setEditBkVoucherUsed(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-1.5 rounded-lg border border-violet-200 bg-white font-mono font-bold text-violet-900"
                />
              </div>

              {(() => {
                const preview = calculateDiscountedEventPrice({
                  basePrice: editBkBasePrice,
                  discountType: editBkDiscountType,
                  discountValue: editBkDiscountValue,
                  voucherUsed: editBkVoucherUsed,
                });
                return (
                  <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="text-slate-400 text-[10px]">
                        Lordo: {formatEuro(preview.basePrice)}
                        {preview.discountAmount > 0
                          ? ` · Sconto: -${formatEuro(preview.discountAmount)}`
                          : ''}
                        {preview.voucherApplied > 0
                          ? ` · Buono: -${formatEuro(preview.voucherApplied)}`
                          : ''}
                      </div>
                      <div className="font-bold">Totale Netto Evento per il Socio</div>
                    </div>
                    <div className="text-lg font-mono font-bold text-emerald-400">
                      {formatEuro(preview.finalNetPrice)}
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountModalBooking(null)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-semibold"
                >
                  Salva Sconto / Buono
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Google Form Field Builder Modal for Event */}
      {currentEvent && (
        <GoogleFormBuilderModal
          isOpen={isFormBuilderOpen}
          onClose={() => setIsFormBuilderOpen(false)}
          initialFormType="evento"
          initialTitle={`Iscrizione ${currentEvent.name} - ${profile.name}`}
          initialDescription={`Modulo di prenotazione per ${currentEvent.name} (${currentEvent.date}, ${
            currentEvent.location
          }). Fasce d'età: ${currentEvent.ageGroups || 'Tutte'}. Condizioni: ${
            currentEvent.conditions || '-'
          }. Quota soci: € ${currentEvent.memberPrice} / Non soci: € ${currentEvent.nonMemberPrice}.`}
          profile={profile}
          googleUserEmail={googleUserEmail}
          onSaveStandardFieldsToProfile={(updatedFields) => {
            if (onUpdateProfile) {
              onUpdateProfile({ ...profile, formStandardFields: updatedFields });
            }
          }}
          onConfirmGenerateForm={async (params) => {
            await handleGenerateGoogleForm(params);
          }}
          isGenerating={isSyncingForm}
        />
      )}
    </div>
  );
};
