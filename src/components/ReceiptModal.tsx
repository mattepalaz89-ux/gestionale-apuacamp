import React, { useState, useEffect } from 'react';
import {
  Printer,
  Send,
  Sliders,
  Upload,
  Trash2,
  Plus,
  CheckCircle2,
  Save,
  Sparkles,
  Stamp,
  PenTool,
  Download,
  Wand2,
  ExternalLink,
  Mail,
  Tag,
  Ticket,
  Layers,
  AlertCircle,
} from 'lucide-react';
import {
  Member,
  EventItem,
  EventBooking,
  GadgetItem,
  GadgetOrder,
  CashTransaction,
  AssociationProfile,
  ReceiptLayoutTemplateId,
  ReceiptTemplateConfig,
  ReceiptLineItem,
  EmailTemplateId,
} from '../types';
import {
  formatEuro,
  mergeSavedDiscountLabels,
  calculateMultiItemReceiptTotals,
} from '../utils/finance';
import { generateReceiptEmailLink } from '../utils/export';
import {
  DEFAULT_DYNAMIC_FIELDS,
  DEFAULT_SIGNATURE_OVERLAY,
  DEFAULT_STAMP_OVERLAY,
  RECEIPT_LAYOUT_TEMPLATES,
  resolveReceiptConfig,
  resolveEmailTemplates,
  resolveDynamicTextPlaceholders,
  RECEIPT_SUBTEXT_PRESETS,
  RECEIPT_TAX_CLAUSE_PRESETS,
  RECEIPT_CUSTOM_LINE_SUGGESTIONS,
  compressImageFileToDataUrl,
  generateDigitalAsdStampDataUrl,
  generateDigitalSignatureDataUrl,
  exportReceiptToPdfWithOverlays,
  generateReceiptPdfBlobWithOverlays,
  ReceiptPlaceholderContext,
} from '../utils/formAndReceiptTemplates';
import { sendGmailMessageWithAttachment, googleSignIn } from '../services/googleWorkspace';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  member?: Member;
  booking?: EventBooking;
  transaction?: CashTransaction;
  gadgetOrder?: GadgetOrder;
  events?: EventItem[];
  gadgets?: GadgetItem[];
  googleUserEmail?: string | null;
  profile: AssociationProfile;
  onUpdateProfile?: (profile: AssociationProfile) => void;
  onUpdateMember?: (member: Member) => void;
  onUpdateBooking?: (booking: EventBooking) => void;
  onUpdateGadgetOrder?: (order: GadgetOrder) => void;
  onOpenFullConfigPanel?: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  member,
  booking,
  transaction,
  gadgetOrder,
  events = [],
  gadgets = [],
  googleUserEmail,
  profile,
  onUpdateProfile,
  onUpdateMember,
  onUpdateBooking,
  onUpdateGadgetOrder,
  onOpenFullConfigPanel,
}) => {
  const initialType: 'ricevuta' | 'preventivo' | 'sollecito' =
    booking && !booking.isBalancePaid && booking.balanceAmount > 0 ? 'sollecito' : 'ricevuta';

  const [docType, setDocType] = useState<'ricevuta' | 'preventivo' | 'sollecito'>(initialType);
  const [receiptNumber, setReceiptNumber] = useState<string>(
    `${profile.activeYear}/R-${Math.floor(100 + Math.random() * 900)}`
  );
  const [docDate, setDocDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const [config, setConfig] = useState<ReceiptTemplateConfig>(() =>
    resolveReceiptConfig(profile)
  );
  const [stampDataUrl, setStampDataUrl] = useState<string | undefined>(
    profile.stampImageDataUrl
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(
    profile.signatureImageDataUrl
  );

  // Per-receipt overrides for editable dynamic fields
  const [dynamicOverrides, setDynamicOverrides] = useState<Record<string, string>>({});

  // Multi-item receipt composer state
  const [lineItems, setLineItems] = useState<ReceiptLineItem[]>([]);
  const [customPaymentMethod, setCustomPaymentMethod] = useState<string>('Bonifico');

  // Event / Receipt Discount (Quota Fissa € or Percentuale % + Saveable Dicitura) & Voucher state
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percent'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountLabel, setDiscountLabel] = useState<string>('');
  const [voucherApplied, setVoucherApplied] = useState<number>(0);

  // Gmail Send Panel state
  const [isGmailPanelOpen, setIsGmailPanelOpen] = useState<boolean>(false);
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] =
    useState<EmailTemplateId>('ricevuta_evento');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [isSendingGmail, setIsSendingGmail] = useState<boolean>(false);
  const [gmailError, setGmailError] = useState<string | null>(null);

  // New custom line inputs
  const [newLineLabel, setNewLineLabel] = useState('');
  const [newLineValue, setNewLineValue] = useState('');

  const savedDiscountLabels = mergeSavedDiscountLabels(profile.savedDiscountLabels);

  const persistDiscountLabelToProfile = (lbl: string) => {
    const clean = lbl.trim();
    if (!clean || !onUpdateProfile) return;
    const nextLabels = mergeSavedDiscountLabels(profile.savedDiscountLabels, clean);
    if (nextLabels.length !== (profile.savedDiscountLabels || []).length) {
      onUpdateProfile({
        ...profile,
        savedDiscountLabels: nextLabels,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      const nextType: 'ricevuta' | 'preventivo' | 'sollecito' =
        booking && !booking.isBalancePaid && booking.balanceAmount > 0 ? 'sollecito' : 'ricevuta';
      setDocType(nextType);
      setConfig(resolveReceiptConfig(profile));
      setStampDataUrl(profile.stampImageDataUrl);
      setSignatureDataUrl(profile.signatureImageDataUrl);
      setDynamicOverrides({});
      setIsGmailPanelOpen(false);
      setGmailError(null);

      const ins = member?.insuranceType || 'Gold';
      const cardAmount = ins === 'Platinum' ? 35 : ins === 'Gold' ? 20 : 10;

      if (booking) {
        const baseAmt =
          nextType === 'sollecito'
            ? booking.balanceAmount
            : booking.basePrice ?? booking.totalPrice;
        setLineItems([
          {
            id: `li-ev-${booking.id}`,
            category: 'evento',
            title: `Iscrizione Attività / Evento: ${booking.eventName}`,
            subtitle:
              nextType === 'sollecito'
                ? 'Saldo quota di partecipazione attività istituzionale'
                : 'Quota di partecipazione attività istituzionale',
            amount: baseAmt,
            enabled: true,
          },
        ]);
        setCustomPaymentMethod(booking.paymentMethod || 'Bonifico');
        setDiscountType(nextType === 'sollecito' ? 'none' : booking.discountType || 'none');
        setDiscountValue(nextType === 'sollecito' ? 0 : booking.discountValue || 0);
        setDiscountLabel(nextType === 'sollecito' ? '' : booking.discountLabel || '');
        setVoucherApplied(nextType === 'sollecito' ? 0 : booking.voucherApplied || 0);
        setSelectedEmailTemplateId('ricevuta_evento');
      } else if (gadgetOrder) {
        setLineItems([
          {
            id: `li-gd-${gadgetOrder.id}`,
            category: 'gadget',
            title: `Contributo Gadget Associativo: ${gadgetOrder.gadgetName} (${gadgetOrder.variant} x${gadgetOrder.quantity})`,
            subtitle: 'Erogazione liberale / contributo per materiale associativo Apuacamp',
            amount: gadgetOrder.totalPrice,
            enabled: true,
          },
        ]);
        setCustomPaymentMethod(gadgetOrder.paymentMethod || 'Bonifico');
        setDiscountType('none');
        setDiscountValue(0);
        setDiscountLabel('');
        setVoucherApplied(0);
        setSelectedEmailTemplateId('ricevuta_gadget');
      } else if (transaction) {
        setLineItems([
          {
            id: `li-tx-${transaction.id}`,
            category:
              transaction.category === 'Tessere'
                ? 'tessera'
                : transaction.category === 'Gadget'
                ? 'gadget'
                : 'evento',
            title: transaction.description,
            subtitle: `Movimento registrato in data ${transaction.date}`,
            amount: transaction.income ?? transaction.expense ?? 0,
            enabled: true,
          },
        ]);
        setCustomPaymentMethod(transaction.method || 'Bonifico');
        setDiscountType('none');
        setDiscountValue(0);
        setDiscountLabel('');
        setVoucherApplied(0);
        setSelectedEmailTemplateId(
          transaction.category === 'Tessere'
            ? 'ricevuta_tessera'
            : transaction.category === 'Gadget'
            ? 'ricevuta_gadget'
            : 'ricevuta_evento'
        );
      } else {
        setLineItems([
          {
            id: `li-card-${Date.now()}`,
            category: 'tessera',
            title: `Quota Associativa e Tesseramento ${profile.activeYear} (Copertura ${ins})`,
            subtitle: `Iscrizione libro soci e copertura assicurativa US ACLI`,
            amount: cardAmount,
            enabled: true,
          },
        ]);
        setCustomPaymentMethod('Bonifico');
        setDiscountType('none');
        setDiscountValue(0);
        setDiscountLabel('');
        setVoucherApplied(0);
        setSelectedEmailTemplateId('ricevuta_tessera');
      }
    }
  }, [isOpen, member, booking, transaction, gadgetOrder, profile]);

  if (!isOpen) return null;

  const childName =
    member?.childName ||
    booking?.childName ||
    gadgetOrder?.childName ||
    transaction?.relatedMemberName ||
    'Socio Tesserato';
  const parentName =
    member?.parentName ||
    booking?.parentName ||
    gadgetOrder?.parentName ||
    'Genitore / Esercente la responsabilità';
  const parentEmail =
    member?.parentEmail || booking?.parentEmail || gadgetOrder?.parentEmail || '';
  const parentPhone =
    member?.parentPhone || booking?.parentPhone || gadgetOrder?.parentPhone || '';
  const parentFiscalCode = member?.parentFiscalCode || member?.childFiscalCode || '';
  const childFiscalCode = member?.childFiscalCode || '';
  const address = member?.childAddress || profile.address;
  const insuranceType = member?.insuranceType || 'Gold';

  // Calculate multi-item totals + discount + voucher
  const receiptTotals = calculateMultiItemReceiptTotals({
    items: lineItems,
    discountType,
    discountValue,
    voucherUsed: voucherApplied,
  });

  const selectedItems = lineItems.filter((i) => i.enabled);
  const combinedActivityTitle =
    selectedItems.length > 0
      ? selectedItems.map((i) => i.title).join(' + ')
      : `Quota Associativa ${profile.activeYear}`;
  const finalNetAmount = receiptTotals.netTotal;

  const placeholderCtx: ReceiptPlaceholderContext = {
    socio: childName,
    genitore: parentName,
    cf_genitore: parentFiscalCode || 'Registrato agli atti',
    cf_socio: childFiscalCode || 'Registrato agli atti',
    indirizzo_socio: address,
    tessera: member?.membershipCardNumber || 'In corso di rilascio',
    scadenza_tessera: member?.expiryDate || `31/12/${profile.activeYear}`,
    assicurazione: insuranceType,
    attivita: combinedActivityTitle,
    importo: finalNetAmount,
    totale_lordo: formatEuro(receiptTotals.grossTotal),
    sconto_dicitura: discountLabel || 'Agevolazione / Sconto',
    sconto_importo: formatEuro(receiptTotals.discountAmount),
    buono_importo: formatEuro(receiptTotals.voucherApplied),
    metodo_pagamento: customPaymentMethod,
    data: docDate,
    numero_ricevuta: receiptNumber,
    anno: profile.activeYear,
    asd_nome: profile.name,
    asd_cf: profile.fiscalCode,
    asd_iban: profile.iban,
    asd_affiliazione: profile.affiliation,
    presidente: profile.president,
  };

  // Helpers to add preset items to the unified receipt composer
  const handleAddQuickLineItem = (
    category: ReceiptLineItem['category'],
    customTitle?: string,
    customAmt?: number
  ) => {
    const ins = member?.insuranceType || 'Gold';
    let title = customTitle || '';
    let subtitle = '';
    let amount = customAmt ?? 0;

    if (category === 'tessera') {
      title =
        customTitle ||
        `Quota Associativa e Tesseramento ${profile.activeYear} (${ins})`;
      subtitle = 'Iscrizione annuale libro soci e copertura assicurativa US ACLI';
      amount = customAmt ?? (ins === 'Platinum' ? 35 : ins === 'Gold' ? 20 : 10);
    } else if (category === 'doposcuola') {
      const currentMonthName = new Date().toLocaleDateString('it-IT', {
        month: 'long',
        year: 'numeric',
      });
      title =
        customTitle ||
        `Quota Mensile Doposcuola / Selva (${currentMonthName})`;
      subtitle = 'Contributo mensile attività educativa e ricreativa in natura';
      amount = customAmt ?? 80;
    } else if (category === 'evento') {
      const firstEv = events[0];
      title =
        customTitle ||
        (firstEv
          ? `Iscrizione Evento: ${firstEv.name}`
          : `Quota Partecipazione Evento / Uscita`);
      subtitle = 'Attività istituzionale outdoor / campo avventura';
      amount = customAmt ?? (firstEv ? firstEv.memberPrice : 45);
    } else if (category === 'gadget') {
      const firstGd = gadgets[0];
      title =
        customTitle ||
        (firstGd
          ? `Gadget Associativo: ${firstGd.name}`
          : 'Contributo Gadget Associativo Apuacamp');
      subtitle = 'Materiale associativo / abbigliamento';
      amount = customAmt ?? (firstGd ? firstGd.unitPrice : 15);
    } else {
      title = customTitle || 'Contributo Attività Istituzionale';
      subtitle = '';
      amount = customAmt ?? 25;
    }

    setLineItems((prev) => [
      ...prev,
      {
        id: `li-${category}-${Date.now()}-${Math.floor(Math.random() * 100)}`,
        category,
        title,
        subtitle,
        amount,
        enabled: true,
      },
    ]);
  };

  const handleOpenGmailPreview = (preferredTplId?: EmailTemplateId) => {
    const templates = resolveEmailTemplates(profile);
    const targetId: EmailTemplateId =
      preferredTplId ||
      (selectedItems.some((i) => i.category === 'doposcuola')
        ? 'ricevuta_doposcuola'
        : selectedItems.some((i) => i.category === 'evento')
        ? 'ricevuta_evento'
        : selectedItems.some((i) => i.category === 'gadget')
        ? 'ricevuta_gadget'
        : 'ricevuta_tessera');

    setSelectedEmailTemplateId(targetId);
    const tpl = templates[targetId] || templates.ricevuta_evento;
    setRecipientEmail(parentEmail);
    setEmailSubject(resolveDynamicTextPlaceholders(tpl.subjectTemplate, placeholderCtx));
    setEmailBody(resolveDynamicTextPlaceholders(tpl.bodyTemplate, placeholderCtx));
    setGmailError(null);
    setIsGmailPanelOpen(true);
  };

  const handleSwitchEmailTemplate = (tplId: EmailTemplateId) => {
    setSelectedEmailTemplateId(tplId);
    const templates = resolveEmailTemplates(profile);
    const tpl = templates[tplId];
    if (tpl) {
      setEmailSubject(resolveDynamicTextPlaceholders(tpl.subjectTemplate, placeholderCtx));
      setEmailBody(resolveDynamicTextPlaceholders(tpl.bodyTemplate, placeholderCtx));
    }
  };

  const handleSaveCurrentEmailTemplate = () => {
    if (!onUpdateProfile) return;
    const templates = resolveEmailTemplates(profile);
    const current = templates[selectedEmailTemplateId];
    if (!current) return;
    onUpdateProfile({
      ...profile,
      emailTemplates: {
        ...templates,
        [selectedEmailTemplateId]: {
          ...current,
          subjectTemplate: emailSubject,
          bodyTemplate: emailBody,
        },
      },
    });
    setSavedBanner('Modello email salvato per i prossimi invii!');
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const dynamicFields = config.dynamicFields || DEFAULT_DYNAMIC_FIELDS;
  const enabledDynFields = dynamicFields.filter((f) => f.enabled);
  const editableDynFields = enabledDynFields.filter((f) => f.fieldType !== 'auto_variable');

  const resolveDynFieldValue = (fieldId: string, template: string) => {
    const raw =
      dynamicOverrides[fieldId] !== undefined ? dynamicOverrides[fieldId] : template;
    return resolveDynamicTextPlaceholders(raw, placeholderCtx);
  };

  const resolvedHeaderDynamic = enabledDynFields
    .filter((f) => f.position === 'header_box')
    .map((f) => ({
      label: f.label,
      value: resolveDynFieldValue(f.id, f.valueTemplate),
    }))
    .filter((f) => f.value.trim() !== '');

  const resolvedTableDynamic = enabledDynFields
    .filter((f) => f.position === 'table_row')
    .map((f) => ({
      label: f.label,
      value: resolveDynFieldValue(f.id, f.valueTemplate),
    }))
    .filter((f) => f.value.trim() !== '');

  const resolvedFooterDynamic = enabledDynFields
    .filter((f) => f.position === 'footer_box')
    .map((f) => ({
      label: f.label,
      value: resolveDynFieldValue(f.id, f.valueTemplate),
    }))
    .filter((f) => f.value.trim() !== '');

  const stampOverlay = {
    ...DEFAULT_STAMP_OVERLAY,
    ...(config.stampOverlay || {}),
  };
  const signatureOverlay = {
    ...DEFAULT_SIGNATURE_OVERLAY,
    ...(config.signatureOverlay || {}),
  };

  const handleUploadStamp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 360, 220);
      setStampDataUrl(compressed);
      setConfig((prev) => ({ ...prev, showStamp: true }));
      if (onUpdateProfile) {
        onUpdateProfile({
          ...profile,
          stampImageDataUrl: compressed,
          receiptConfig: { ...config, showStamp: true },
        });
      }
      setSavedBanner("Timbro dell'ASD caricato e applicato in overlay alla ricevuta!");
      setTimeout(() => setSavedBanner(null), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleUploadSignature = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFileToDataUrl(file, 360, 180);
      setSignatureDataUrl(compressed);
      setConfig((prev) => ({ ...prev, showSignature: true }));
      if (onUpdateProfile) {
        onUpdateProfile({
          ...profile,
          signatureImageDataUrl: compressed,
          receiptConfig: { ...config, showSignature: true },
        });
      }
      setSavedBanner('Firma del Presidente caricata e applicata in overlay alla ricevuta!');
      setTimeout(() => setSavedBanner(null), 3500);
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleAddCustomLine = () => {
    if (!newLineLabel.trim() || !newLineValue.trim()) return;
    setConfig((prev) => ({
      ...prev,
      customLines: [
        ...prev.customLines,
        {
          id: `rl-${Date.now()}`,
          label: newLineLabel.trim(),
          value: newLineValue.trim(),
        },
      ],
    }));
    setNewLineLabel('');
    setNewLineValue('');
  };

  const handleAddSuggestedLine = (sug: { label: string; value: string }) => {
    setConfig((prev) => ({
      ...prev,
      customLines: [
        ...prev.customLines,
        {
          id: `rl-sug-${Date.now()}-${Math.floor(Math.random() * 100)}`,
          label: sug.label,
          value: sug.value,
        },
      ],
    }));
  };

  const handleSaveAsDefaultTemplate = () => {
    if (!onUpdateProfile) return;
    onUpdateProfile({
      ...profile,
      stampImageDataUrl: stampDataUrl,
      signatureImageDataUrl: signatureDataUrl,
      receiptConfig: config,
    });
    setSavedBanner(
      "Modello ricevuta (campi dinamici, testi, timbro e firma overlay) salvato come predefinito per l'ASD!"
    );
    setTimeout(() => setSavedBanner(null), 3500);
  };

  const badgeTitle =
    docType === 'ricevuta'
      ? config.documentTitleReceipt || 'Ricevuta Non Fiscale'
      : docType === 'preventivo'
      ? config.documentTitleQuote || 'Preventivo Quota'
      : config.documentTitleReminder || 'Promemoria Saldo';

  const handleDownloadPdf = async () => {
    if (discountType !== 'none' && discountLabel.trim()) {
      persistDiscountLabelToProfile(discountLabel);
    }
    setIsExportingPdf(true);
    try {
      const safeChild = childName.replace(/[^a-zA-Z0-9_-]/g, '_');
      await exportReceiptToPdfWithOverlays({
        fileName: `${badgeTitle.replace(/\s+/g, '_')}_${safeChild}_${docDate}.pdf`,
        badgeTitle,
        receiptNumber,
        docDate,
        docType,
        profile,
        config,
        placeholderCtx,
        activityTitle: combinedActivityTitle,
        amount: finalNetAmount,
        lineItems: selectedItems,
        discountLabel: discountLabel.trim() || undefined,
        discountAmount: receiptTotals.discountAmount,
        voucherApplied: receiptTotals.voucherApplied,
        paymentMethod: customPaymentMethod,
        resolvedHeaderDynamic,
        resolvedTableDynamic,
        resolvedFooterDynamic,
        stampDataUrl,
        signatureDataUrl,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleConfirmSendGmailWithPdf = async () => {
    if (!recipientEmail.trim()) {
      setGmailError("Inserisci l'indirizzo email del destinatario.");
      return;
    }
    if (discountType !== 'none' && discountLabel.trim()) {
      persistDiscountLabelToProfile(discountLabel);
    }
    setIsSendingGmail(true);
    setGmailError(null);
    try {
      const safeChild = childName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const pdfFileName = `${badgeTitle.replace(/\s+/g, '_')}_${safeChild}_${docDate}.pdf`;

      const pdfBlob = await generateReceiptPdfBlobWithOverlays({
        fileName: pdfFileName,
        badgeTitle,
        receiptNumber,
        docDate,
        docType,
        profile,
        config,
        placeholderCtx,
        activityTitle: combinedActivityTitle,
        amount: finalNetAmount,
        lineItems: selectedItems,
        discountLabel: discountLabel.trim() || undefined,
        discountAmount: receiptTotals.discountAmount,
        voucherApplied: receiptTotals.voucherApplied,
        paymentMethod: customPaymentMethod,
        resolvedHeaderDynamic,
        resolvedTableDynamic,
        resolvedFooterDynamic,
        stampDataUrl,
        signatureDataUrl,
      });

      await sendGmailMessageWithAttachment({
        to: recipientEmail.trim(),
        subject: emailSubject.trim(),
        bodyText: emailBody,
        attachmentFileName: pdfFileName,
        attachmentPdfBlob: pdfBlob,
      });

      if (booking && onUpdateBooking) {
        onUpdateBooking({
          ...booking,
          confirmationEmailSent: true,
        });
      }
      if (gadgetOrder && onUpdateGadgetOrder) {
        onUpdateGadgetOrder({
          ...gadgetOrder,
          confirmationEmailSent: true,
          confirmationEmailSentAt: new Date().toISOString(),
        });
      }

      setIsGmailPanelOpen(false);
      setSavedBanner(
        `Email inviata con successo tramite Gmail a ${recipientEmail.trim()} con il PDF "${pdfFileName}" allegato!`
      );
      setTimeout(() => setSavedBanner(null), 5000);
    } catch (err: any) {
      console.error(err);
      setGmailError(
        err?.message ||
          "Errore durante l'invio tramite Gmail. Assicurati di aver connesso l'account Google dell'associazione."
      );
    } finally {
      setIsSendingGmail(false);
    }
  };

  const emailHref = generateReceiptEmailLink({
    toEmail: parentEmail,
    parentName,
    childName,
    activityName: combinedActivityTitle,
    amount: finalNetAmount,
    type: docType,
    receiptNumber,
    insuranceType,
    association: profile,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 my-6 max-h-[94vh] overflow-y-auto">
        {/* Top Control Bar (No-Print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-900 text-xs sm:text-sm">Tipo Documento:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setDocType('ricevuta')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  docType === 'ricevuta'
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-slate-600'
                }`}
              >
                Ricevuta Pagamento
              </button>
              <button
                type="button"
                onClick={() => setDocType('preventivo')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  docType === 'preventivo'
                    ? 'bg-white text-blue-800 shadow-2xs font-bold'
                    : 'text-slate-600'
                }`}
              >
                Preventivo / Prospetto
              </button>
              <button
                type="button"
                onClick={() => setDocType('sollecito')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  docType === 'sollecito'
                    ? 'bg-white text-amber-800 shadow-2xs font-bold'
                    : 'text-slate-600'
                }`}
              >
                Sollecito Saldo
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenGmailPreview()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-2xs"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Invia via Gmail (con PDF allegato)</span>
            </button>

            {onOpenFullConfigPanel && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFullConfigPanel();
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                title="Apri il pannello completo di configurazione ricevute, modelli email e diciture sconto"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Modelli & Config</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCustomizing(!isCustomizing)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isCustomizing
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Layout, Timbro & Firma</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi finestra ricevuta"
              className="text-slate-400 hover:text-slate-600 p-1 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* COMPOSITORE VOCI RICEVUTA INTELLIGENTE + SCONTI EVENTO / DICITURE SALVABILI & BUONI SPESA (No-Print) */}
        <div className="no-print mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>Compositore Voci Ricevuta (Seleziona, combina o modifica le voci da includere)</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleAddQuickLineItem('evento')}
                className="px-2 py-1 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3 text-emerald-600" />
                <span>Evento</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuickLineItem('doposcuola')}
                className="px-2 py-1 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3 text-emerald-600" />
                <span>Mensile Doposcuola / Selva</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuickLineItem('tessera')}
                className="px-2 py-1 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3 text-emerald-600" />
                <span>Tessera Associativa</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddQuickLineItem('gadget')}
                className="px-2 py-1 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3 text-emerald-600" />
                <span>Gadget</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleAddQuickLineItem('evento', 'Contributo Attività Istituzionale', 25)
                }
                className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-semibold text-[11px] flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3 text-slate-500" />
                <span>Voce Libera</span>
              </button>
            </div>
          </div>

          {/* Lista Voci Selezionabili e Modificabili */}
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                  item.enabled
                    ? 'bg-white border-emerald-200 shadow-2xs'
                    : 'bg-slate-100/70 border-slate-200 opacity-60'
                }`}
              >
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) =>
                      setLineItems((prev) =>
                        prev.map((li) =>
                          li.id === item.id ? { ...li, enabled: e.target.checked } : li
                        )
                      )
                    }
                    className="rounded-sm border-slate-300 text-emerald-600"
                  />
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase text-[9px]">
                    {item.category}
                  </span>
                </label>

                <input
                  type="text"
                  value={item.title}
                  onChange={(e) =>
                    setLineItems((prev) =>
                      prev.map((li) =>
                        li.id === item.id ? { ...li, title: e.target.value } : li
                      )
                    )
                  }
                  placeholder="Descrizione voce (es. Quota Iscrizione Evento / Doposcuola / Tessera)"
                  className="flex-1 px-2.5 py-1 rounded border border-slate-200 font-semibold text-slate-900 bg-white"
                />

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-slate-500 font-mono">€</span>
                  <input
                    type="number"
                    step="0.5"
                    value={item.amount}
                    onChange={(e) =>
                      setLineItems((prev) =>
                        prev.map((li) =>
                          li.id === item.id ? { ...li, amount: Number(e.target.value) } : li
                        )
                      )
                    }
                    className="w-24 px-2 py-1 rounded border border-slate-200 font-mono font-bold text-right bg-white"
                  />
                  {lineItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLineItems((prev) => prev.filter((li) => li.id !== item.id))
                      }
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Rimuovi voce dalla ricevuta"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Barra Sconto (Quota Fissa € o Percentuale % + Dicitura Salvabile) & Buono Spesa */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 border-t border-slate-200/80">
            <div className="md:col-span-3">
              <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-600" />
                <span>Sconto / Copertura Quota</span>
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={discountType}
                  onChange={(e) => {
                    const nextType = e.target.value as 'none' | 'fixed' | 'percent';
                    setDiscountType(nextType);
                    if (nextType === 'none') setDiscountValue(0);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-indigo-200 bg-white font-semibold text-[11px] flex-1"
                >
                  <option value="none">Nessuno sconto</option>
                  <option value="fixed">Quota Fissa (€)</option>
                  <option value="percent">Percentuale (%)</option>
                </select>
                {discountType !== 'none' && (
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                    className="w-20 px-2 py-1.5 rounded-lg border border-indigo-200 bg-white font-mono font-bold text-right"
                    placeholder={discountType === 'percent' ? '%' : '€'}
                  />
                )}
              </div>
            </div>

            <div className="md:col-span-5">
              <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-1">
                Dicitura Sconto in Ricevuta (Seleziona o scrivi nuova per salvarla)
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  disabled={discountType === 'none'}
                  value={savedDiscountLabels.includes(discountLabel) ? discountLabel : ''}
                  onChange={(e) => {
                    if (e.target.value) setDiscountLabel(e.target.value);
                  }}
                  className="w-1/2 px-2 py-1.5 rounded-lg border border-indigo-200 bg-white text-[11px] disabled:bg-slate-100"
                >
                  <option value="">-- Diciture salvate --</option>
                  {savedDiscountLabels.map((lbl) => (
                    <option key={lbl} value={lbl}>
                      {lbl}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  disabled={discountType === 'none'}
                  placeholder="O scrivi dicitura (es. Riduzione ISEE / Ente...)"
                  value={discountLabel}
                  onChange={(e) => setDiscountLabel(e.target.value)}
                  onBlur={() => {
                    if (discountLabel.trim()) persistDiscountLabelToProfile(discountLabel);
                  }}
                  className="w-1/2 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white text-[11px] disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold uppercase text-violet-900 flex items-center gap-1">
                  <Ticket className="w-3 h-3 text-violet-600" />
                  <span>Buono Spesa Applicato (€)</span>
                </label>
                {member && (member.voucherBalance || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setVoucherApplied(
                        Math.min(
                          member.voucherBalance || 0,
                          Math.max(0, receiptTotals.grossTotal - receiptTotals.discountAmount)
                        )
                      )
                    }
                    className="text-[10px] font-bold text-violet-700 hover:underline"
                    title="Applica automaticamente il credito buono disponibile del socio"
                  >
                    Usa credito ({formatEuro(member.voucherBalance || 0)})
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={voucherApplied}
                  onChange={(e) => setVoucherApplied(Math.max(0, Number(e.target.value)))}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-violet-200 bg-white font-mono font-bold text-violet-900"
                />
                {member &&
                  onUpdateMember &&
                  voucherApplied > 0 &&
                  (member.voucherBalance || 0) >= voucherApplied && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextBal = Math.max(
                          0,
                          Number(((member.voucherBalance || 0) - voucherApplied).toFixed(2))
                        );
                        onUpdateMember({
                          ...member,
                          voucherBalance: nextBal,
                        });
                        setSavedBanner(
                          `Buono di ${formatEuro(
                            voucherApplied
                          )} scalato dal credito di ${member.childName} (Residuo: ${formatEuro(
                            nextBal
                          )})`
                        );
                        setTimeout(() => setSavedBanner(null), 4000);
                      }}
                      className="px-2 py-1.5 rounded-lg bg-violet-700 hover:bg-violet-800 text-white text-[10px] font-bold shrink-0"
                      title="Scala questo importo dal saldo buono del socio in Anagrafica"
                    >
                      Scala da Credito
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* PANNELLO CONFERMA & INVIO GMAIL CON ALLEGATO PDF (No-Print) */}
        {isGmailPanelOpen && (
          <div className="no-print mb-5 p-4 rounded-xl bg-blue-50/90 border-2 border-blue-300 space-y-3 text-xs animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-blue-200">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-700" />
                <div>
                  <h4 className="font-bold text-blue-950 text-sm">
                    Conferma Invio Email tramite Gmail (con PDF Ricevuta Allegato)
                  </h4>
                  <p className="text-[11px] text-blue-800">
                    Scegli il modello email, controlla o personalizza il testo e premi "Conferma e Invia" per spedire la mail con il PDF allegato dall'account Gmail dell'associazione.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGmailPanelOpen(false)}
                className="text-blue-700 hover:text-blue-950 font-bold px-2 py-1"
              >
                Chiudi ✕
              </button>
            </div>

            {!googleUserEmail && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 text-amber-950">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Per inviare direttamente tramite Gmail, connetti l'account Google dell'associazione.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => googleSignIn()}
                  className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg shrink-0"
                >
                  Connetti Google / Gmail
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-blue-950 mb-1">
                  Modello Email Precompilato:
                </label>
                <select
                  value={selectedEmailTemplateId}
                  onChange={(e) => handleSwitchEmailTemplate(e.target.value as EmailTemplateId)}
                  className="w-full px-3 py-1.5 rounded-lg border border-blue-300 bg-white font-semibold"
                >
                  <option value="ricevuta_evento">Modello Conferma Iscrizione & Ricevuta Evento</option>
                  <option value="ricevuta_tessera">Modello Ricevuta Tessera Associativa</option>
                  <option value="ricevuta_doposcuola">Modello Ricevuta Mensile Doposcuola / Selva</option>
                  <option value="ricevuta_gadget">Modello Conferma & Ricevuta Gadget</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-blue-950 mb-1">
                  Destinatario Email Genitore / Socio *
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="es. genitore@email.it"
                  className="w-full px-3 py-1.5 rounded-lg border border-blue-300 bg-white font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-blue-950 mb-1">
                Oggetto dell'Email *
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-blue-300 bg-white font-semibold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-blue-950">
                  Corpo del Messaggio (modificabile prima dell'invio):
                </label>
                {onUpdateProfile && (
                  <button
                    type="button"
                    onClick={handleSaveCurrentEmailTemplate}
                    className="text-[11px] font-bold text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    <span>Salva modifiche nel Modello Email</span>
                  </button>
                )}
              </div>
              <textarea
                rows={6}
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-blue-300 bg-white leading-relaxed"
              />
            </div>

            {gmailError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                {gmailError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-blue-200">
              <div className="text-[11px] text-blue-900 font-medium">
                Allegato automatico:{' '}
                <strong className="font-mono">
                  {badgeTitle.replace(/\s+/g, '_')}_{childName.replace(/[^a-zA-Z0-9_-]/g, '_')}_
                  {docDate}.pdf
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGmailPanelOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-300"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={isSendingGmail}
                  onClick={handleConfirmSendGmailWithPdf}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSendingGmail
                      ? 'Invio in corso tramite Gmail...'
                      : 'Conferma e Invia Email con PDF via Gmail'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick PDF Layout Template Switcher Bar (No-Print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700">Modello Layout PDF:</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg">
              {RECEIPT_LAYOUT_TEMPLATES.map((tpl) => {
                const isSelected = (config.layoutTemplate || 'standard') === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => {
                      const nextCfg: ReceiptTemplateConfig = {
                        ...config,
                        layoutTemplate: tpl.id as ReceiptLayoutTemplateId,
                      };
                      setConfig(nextCfg);
                      if (onUpdateProfile) {
                        onUpdateProfile({
                          ...profile,
                          stampImageDataUrl: stampDataUrl,
                          signatureImageDataUrl: signatureDataUrl,
                          receiptConfig: nextCfg,
                        });
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tpl.name}
                  </button>
                );
              })}
            </div>
          </div>
          <span className="text-[11px] text-slate-500">
            Stile attivo:{' '}
            <strong className="text-slate-800">
              {
                RECEIPT_LAYOUT_TEMPLATES.find(
                  (t) => t.id === (config.layoutTemplate || 'standard')
                )?.subtitle
              }
            </strong>
          </span>
        </div>

        {savedBanner && (
          <div className="no-print mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {savedBanner}
            </span>
            <button onClick={() => setSavedBanner(null)} className="font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Quick Editable Dynamic Fields Bar (when dynamic fields are editable per receipt) */}
        {editableDynFields.length > 0 && !isCustomizing && (
          <div className="no-print mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {editableDynFields.map((df) => {
              const currentVal =
                dynamicOverrides[df.id] !== undefined
                  ? dynamicOverrides[df.id]
                  : resolveDynamicTextPlaceholders(df.valueTemplate, placeholderCtx);
              return (
                <div key={df.id}>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {df.label}:
                  </label>
                  {df.fieldType === 'editable_select' && df.options && df.options.length > 0 ? (
                    <select
                      value={currentVal}
                      onChange={(e) =>
                        setDynamicOverrides((prev) => ({ ...prev, [df.id]: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      {df.options.map((opt, idx) => (
                        <option key={idx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={df.fieldType === 'editable_date' ? 'date' : 'text'}
                      value={currentVal}
                      onChange={(e) =>
                        setDynamicOverrides((prev) => ({ ...prev, [df.id]: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* COLLAPSIBLE CUSTOMIZATION DRAWER (No-Print) */}
        {isCustomizing && (
          <div className="no-print mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Personalizzazione Ricevuta, Campi Dinamici, Testi, Timbro & Firma Overlay
                </h4>
                <p className="text-[11px] text-slate-500">
                  Scegli quali campi mostrare, usa o modifica i testi predefiniti e carica il
                  timbro o la firma dell'associazione come overlay PDF.
                </p>
              </div>
              {onUpdateProfile && (
                <button
                  type="button"
                  onClick={handleSaveAsDefaultTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition-colors shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Salva come Modello Predefinito ASD</span>
                </button>
              )}
            </div>

            {/* 1. Dati Principali Documento */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Numero Ricevuta</label>
                <input
                  type="text"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Data Emissione</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Modalità Pagamento
                </label>
                <input
                  type="text"
                  value={customPaymentMethod}
                  onChange={(e) => setCustomPaymentMethod(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                />
              </div>
            </div>

            {/* 2. Scelta Campi da Mostrare sulla Ricevuta */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                Campi da Includere nel Documento:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'showFiscalCodeAsd', label: 'Codice Fiscale e Sede ASD' },
                  { key: 'showAffiliation', label: 'Ente di Affiliazione (US ACLI / EPS)' },
                  { key: 'showMemberAddress', label: 'Indirizzo Residenza Socio' },
                  { key: 'showCardNumberAndInsurance', label: 'N° Tessera e Assicurazione' },
                  { key: 'showParentFiscalCode', label: 'Codice Fiscale Genitore' },
                  { key: 'showParentContact', label: 'Email / Telefono Genitore' },
                  { key: 'showPaymentMethod', label: 'Metodo di Pagamento' },
                  { key: 'showIbanOnReceipt', label: "Coordinate IBAN dell'ASD" },
                  { key: 'showLegalNotice', label: 'Nota Fiscale Esenzione Art. 148 TUIR' },
                  { key: 'showStamp', label: "Applica Timbro dell'ASD (Overlay)" },
                  { key: 'showSignature', label: 'Applica Firma del Presidente (Overlay)' },
                  { key: 'showQuietanzaLine', label: 'Riquadro Firma Quietanza' },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center gap-1.5 text-slate-700 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(config[item.key as keyof ReceiptTemplateConfig])}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 3. Testi Suggeriti e Personalizzabili */}
            <div className="space-y-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="font-bold text-slate-800 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Testo Descrittivo Prestazione (Scegli un suggerimento o modifica):</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {RECEIPT_SUBTEXT_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({ ...prev, activityDescriptionSubtext: p.text }))
                      }
                      className="px-2 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-[11px] font-medium transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={config.activityDescriptionSubtext}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      activityDescriptionSubtext: e.target.value,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-700"
                />
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Dicitura Fiscale e Legale ASD (Art. 148 TUIR / Esenzione Bollo / Detrazione
                    19%):
                  </span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {RECEIPT_TAX_CLAUSE_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({ ...prev, legalTaxClause: p.text }))
                      }
                      className="px-2 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-[11px] font-medium transition-colors"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={config.legalTaxClause}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, legalTaxClause: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-700"
                />
              </div>
            </div>

            {/* 4. Voci / Campi Dinamici Extra sulla Ricevuta */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800">
                Voci / Campi Dinamici Aggiuntivi sulla Ricevuta (Supporta segnaposto {'{{...}}'}):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {RECEIPT_CUSTOM_LINE_SUGGESTIONS.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddSuggestedLine(sug)}
                    className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-[11px] font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{sug.label}</span>
                  </button>
                ))}
              </div>

              {config.customLines.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {config.customLines.map((line) => (
                    <div key={line.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={line.label}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            customLines: prev.customLines.map((l) =>
                              l.id === line.id ? { ...l, label: e.target.value } : l
                            ),
                          }))
                        }
                        className="w-1/3 px-2 py-1 rounded border border-slate-200 font-semibold"
                      />
                      <input
                        type="text"
                        value={line.value}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            customLines: prev.customLines.map((l) =>
                              l.id === line.id ? { ...l, value: e.target.value } : l
                            ),
                          }))
                        }
                        className="flex-1 px-2 py-1 rounded border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            customLines: prev.customLines.filter((l) => l.id !== line.id),
                          }))
                        }
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Etichetta campo (es. Periodo / Note)"
                  value={newLineLabel}
                  onChange={(e) => setNewLineLabel(e.target.value)}
                  className="w-1/3 px-2.5 py-1 rounded-lg border border-slate-200"
                />
                <input
                  type="text"
                  placeholder="Valore o variabile {{cf_socio}}, {{anno}}..."
                  value={newLineValue}
                  onChange={(e) => setNewLineValue(e.target.value)}
                  className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200"
                />
                <button
                  type="button"
                  onClick={handleAddCustomLine}
                  className="px-3 py-1 bg-slate-900 text-white rounded-lg font-semibold flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Aggiungi</span>
                </button>
              </div>
            </div>

            {/* 5. Caricamento Timbro dell'ASD e Firma Presidente (Overlay PDF) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Stamp className="w-4 h-4 text-emerald-700" />
                    <span>Overlay Timbro Ufficiale ASD</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Carica il timbro (PNG/JPG) o genera il timbro digitale trasparente.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{stampDataUrl ? 'Cambia Timbro' : 'Carica Timbro'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadStamp}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const gen = generateDigitalAsdStampDataUrl(
                          profile.name,
                          profile.fiscalCode,
                          profile.affiliation
                        );
                        if (gen) {
                          setStampDataUrl(gen);
                          setConfig((prev) => ({ ...prev, showStamp: true }));
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-[11px]"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Genera</span>
                    </button>
                    {stampDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setStampDataUrl(undefined);
                          if (onUpdateProfile) {
                            onUpdateProfile({ ...profile, stampImageDataUrl: undefined });
                          }
                        }}
                        className="text-rose-600 hover:underline text-[11px] font-medium"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>
                {stampDataUrl && (
                  <img
                    src={stampDataUrl}
                    alt="Anteprima Timbro ASD"
                    className="h-14 w-auto object-contain border border-slate-200 rounded-lg p-1 bg-slate-50"
                  />
                )}
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-blue-700" />
                    <span>Overlay Firma del Presidente</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Carica l'immagine della firma (PNG/JPG) o genera la firma calligrafica.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <label className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{signatureDataUrl ? 'Cambia Firma' : 'Carica Firma'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadSignature}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const gen = generateDigitalSignatureDataUrl(profile.president);
                        if (gen) {
                          setSignatureDataUrl(gen);
                          setConfig((prev) => ({ ...prev, showSignature: true }));
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-[11px]"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Genera</span>
                    </button>
                    {signatureDataUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setSignatureDataUrl(undefined);
                          if (onUpdateProfile) {
                            onUpdateProfile({ ...profile, signatureImageDataUrl: undefined });
                          }
                        }}
                        className="text-rose-600 hover:underline text-[11px] font-medium"
                      >
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>
                {signatureDataUrl && (
                  <img
                    src={signatureDataUrl}
                    alt="Anteprima Firma Presidente"
                    className="h-12 w-auto object-contain border border-slate-200 rounded-lg p-1 bg-slate-50"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PRINTABLE RECEIPT LAYOUT (Conform to ASD Art. 148 TUIR & D.Lgs 36/21) */}
        {/* ==================================================================== */}
        <div
          id="printable-receipt"
          data-layout-template={config.layoutTemplate || 'standard'}
          className={`rounded-xl p-8 bg-white text-slate-900 text-xs space-y-5 shadow-xs relative overflow-hidden ${
            (config.layoutTemplate || 'standard') === 'official'
              ? 'border-4 border-double border-blue-900 font-serif'
              : (config.layoutTemplate || 'standard') === 'minimalist'
              ? 'border border-slate-200 font-sans'
              : 'border border-slate-300 font-sans'
          }`}
        >
          {/* Header Association */}
          {(config.layoutTemplate || 'standard') === 'official' ? (
            <div className="text-center border-b-2 border-blue-900 pb-4 space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-900">
                {profile.legalType}
              </div>
              <h2 className="text-lg font-extrabold tracking-wide uppercase text-slate-900">
                {profile.name}
              </h2>
              {config.showFiscalCodeAsd && (
                <p className="text-[11px] text-slate-600">
                  Sede Legale: {profile.address} • C.F. ASD: <strong>{profile.fiscalCode}</strong>
                </p>
              )}
              {config.showAffiliation && (
                <p className="text-[11px] text-blue-950 font-semibold">{profile.affiliation}</p>
              )}
              <div className="pt-2">
                <div className="bg-blue-900 text-white py-1.5 px-4 rounded-xs text-[11px] font-bold uppercase tracking-widest flex items-center justify-between">
                  <span>{badgeTitle}</span>
                  <span className="font-mono">
                    Prot. N° {receiptNumber} del {docDate}
                  </span>
                </div>
              </div>
            </div>
          ) : (config.layoutTemplate || 'standard') === 'minimalist' ? (
            <div className="flex justify-between items-baseline border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold tracking-tight text-slate-900">
                  {profile.name}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {profile.legalType}
                  {config.showFiscalCodeAsd ? ` · C.F. ${profile.fiscalCode}` : ''}
                </p>
                {config.showAffiliation && (
                  <p className="text-[10px] text-slate-400">{profile.affiliation}</p>
                )}
              </div>
              <div className="text-right">
                <span className="inline-block pb-0.5 text-xs font-bold uppercase tracking-widest text-slate-800 border-b border-slate-900">
                  {badgeTitle}
                </span>
                <div className="font-mono text-slate-500 text-[11px] mt-1.5">
                  #{receiptNumber} · {docDate}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <h2 className="text-base font-extrabold tracking-tight uppercase text-slate-900">
                  {profile.name}
                </h2>
                <p className="text-[11px] font-semibold text-emerald-800">{profile.legalType}</p>
                {config.showFiscalCodeAsd && (
                  <p className="text-[11px] text-slate-600">
                    C.F. {profile.fiscalCode} | {profile.address}
                  </p>
                )}
                {config.showAffiliation && (
                  <p className="text-[11px] text-slate-500">{profile.affiliation}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {profile.email} {profile.phone ? `• Tel. ${profile.phone}` : ''}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md bg-slate-900 text-white">
                  {badgeTitle}
                </span>
                <div className="font-mono text-slate-600 text-[11px] mt-2">
                  N°: <span className="font-bold text-slate-900">{receiptNumber}</span>
                </div>
                <div className="font-mono text-slate-600 text-[11px]">Data: {docDate}</div>
              </div>
            </div>
          )}

          {/* Intestatario / Socio + Dynamic Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Dati Partecipante / Tesserato:
              </span>
              <div className="font-bold text-slate-900 text-sm">{childName}</div>
              {config.showMemberAddress && (
                <div className="text-[11px] text-slate-600 mt-0.5">Indirizzo: {address}</div>
              )}
              {config.showCardNumberAndInsurance && (
                <div className="text-[11px] text-slate-600">
                  Tessera Associativa:{' '}
                  <span className="font-mono font-bold">
                    {member?.membershipCardNumber || 'In corso di rilascio'}
                  </span>{' '}
                  ({insuranceType})
                </div>
              )}
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                Genitore o Tutore / Intestatario Quietanza:
              </span>
              <div className="font-bold text-slate-800 text-sm">{parentName}</div>
              {config.showParentFiscalCode && (
                <div className="font-mono text-[11px] text-slate-600 mt-0.5">
                  C.F.: {parentFiscalCode || 'Registrato agli atti'}
                </div>
              )}
              {config.showParentContact && (parentEmail || parentPhone) && (
                <div className="text-[11px] text-slate-600">
                  {[parentEmail, parentPhone].filter(Boolean).join(' • ')}
                </div>
              )}
            </div>

            {resolvedHeaderDynamic.length > 0 && (
              <div className="sm:col-span-2 pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {resolvedHeaderDynamic.map((df, idx) => (
                  <div key={idx} className="text-[11px] text-slate-700">
                    <strong className="text-slate-900">{df.label}:</strong> {df.value}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Intro Declaration */}
          {config.showIntroDeclaration !== false && config.introDeclarationText && (
            <div className="text-xs text-slate-700 leading-relaxed bg-emerald-50/40 p-3 rounded-lg border border-emerald-100">
              {resolveDynamicTextPlaceholders(config.introDeclarationText, placeholderCtx)}
            </div>
          )}

          {/* Description & Multi-Item Table with Discount & Voucher Deductions */}
          <div className="space-y-2">
            <table className="w-full border-collapse border border-slate-200 text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <th className="py-2.5 px-3 text-left">
                    Descrizione della prestazione istituzionale
                  </th>
                  <th className="py-2.5 px-3 text-right w-32">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedItems.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</div>
                      )}
                      {idx === 0 && config.activityDescriptionSubtext && (
                        <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {resolveDynamicTextPlaceholders(
                            config.activityDescriptionSubtext,
                            placeholderCtx
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm tabular-nums">
                      {formatEuro(item.amount)}
                    </td>
                  </tr>
                ))}

                {receiptTotals.discountAmount > 0 && (
                  <tr className="bg-indigo-50/60">
                    <td className="py-2 px-3 text-[11px] font-bold text-indigo-900">
                      Sconto / Copertura Quota:{' '}
                      {discountLabel || 'Agevolazione / Riduzione applicata'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-indigo-800 tabular-nums">
                      - {formatEuro(receiptTotals.discountAmount)}
                    </td>
                  </tr>
                )}

                {receiptTotals.voucherApplied > 0 && (
                  <tr className="bg-violet-50/60">
                    <td className="py-2 px-3 text-[11px] font-bold text-violet-900">
                      Compensazione mediante Buono Spesa Attività Socio
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-violet-800 tabular-nums">
                      - {formatEuro(receiptTotals.voucherApplied)}
                    </td>
                  </tr>
                )}

                {resolvedTableDynamic.map((row, idx) => (
                  <tr key={`dyn-tr-${idx}`} className="bg-slate-50/60">
                    <td className="py-2 px-3 text-[11px] text-slate-700" colSpan={2}>
                      <span className="font-bold text-slate-800">{row.label}:</span>{' '}
                      <span>{row.value}</span>
                    </td>
                  </tr>
                ))}

                {config.customLines.map((line) => (
                  <tr key={line.id} className="bg-slate-50/40">
                    <td className="py-2 px-3 text-[11px] text-slate-700" colSpan={2}>
                      <span className="font-bold text-slate-800">{line.label}:</span>{' '}
                      <span>
                        {resolveDynamicTextPlaceholders(line.value, placeholderCtx)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-900">
                  <td className="py-2.5 px-3 text-right uppercase text-[11px]">
                    Totale Netto {docType === 'ricevuta' ? 'Versato' : 'Previsto'}:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-base text-emerald-800 tabular-nums">
                    {formatEuro(finalNetAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Payment Method & IBAN info */}
            {(config.showPaymentMethod || config.showIbanOnReceipt) && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-700">
                {config.showPaymentMethod && (
                  <div>
                    <span className="font-bold text-slate-800">Modalità di pagamento:</span>{' '}
                    <span className="font-mono">{customPaymentMethod}</span>
                  </div>
                )}
                {config.showIbanOnReceipt && profile.iban && (
                  <div>
                    <span className="font-bold text-slate-800">Coordinate IBAN ASD:</span>{' '}
                    <span className="font-mono">{profile.iban}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dynamic Footer Fields */}
          {resolvedFooterDynamic.length > 0 && (
            <div className="space-y-1">
              {resolvedFooterDynamic.map((fd, idx) => (
                <div key={idx} className="text-[11px] text-slate-700">
                  <strong className="text-slate-900">{fd.label}:</strong> {fd.value}
                </div>
              ))}
            </div>
          )}

          {/* Legal Fiscal Exemption Text (Art. 148 TUIR) */}
          {config.showLegalNotice && config.legalTaxClause && (
            <div className="p-3 bg-slate-50 rounded-lg text-[10px] text-slate-500 leading-relaxed border border-slate-200">
              <strong>Nota fiscale e legale per ASD:</strong>{' '}
              {resolveDynamicTextPlaceholders(config.legalTaxClause, placeholderCtx)}
            </div>
          )}

          {config.footerNotes && (
            <div className="text-[11px] text-slate-600 italic">
              {resolveDynamicTextPlaceholders(config.footerNotes, placeholderCtx)}
            </div>
          )}

          {/* Signatures & Official Stamp Overlay Area */}
          <div className="pt-5 pb-3 flex flex-wrap justify-between items-end gap-6 text-xs text-slate-700 border-t border-slate-200 relative min-h-[120px]">
            <div className="space-y-1 z-10">
              <div className="text-[11px] text-slate-500">
                Il Presidente / Legale Rappresentante:
              </div>
              <strong className="text-slate-900 text-sm block">{profile.president}</strong>
              <div className="h-10" />
            </div>

            {config.showQuietanzaLine && (
              <div className="text-right z-10">
                <div className="text-[11px] text-slate-500">
                  {docType === 'ricevuta'
                    ? "Per quietanza dell'importo:"
                    : 'Firma per presa visione:'}
                </div>
                <div className="h-9 border-b border-dashed border-slate-400 w-44 mt-2"></div>
              </div>
            )}

            {/* OVERLAY SOPRA IL DOCUMENTO PDF GENERATO (Timbro dell'ASD & Firma del Presidente in Base64) */}
            {(config.showStamp && stampDataUrl) || (config.showSignature && signatureDataUrl) ? (
              <svg
                viewBox="0 0 640 120"
                aria-label="Overlay Timbro e Firma PDF"
                className="pointer-events-none select-none absolute inset-0 w-full h-full overflow-visible z-20"
              >
                {config.showStamp && stampDataUrl && (
                  <g
                    transform={`translate(${
                      (stampOverlay.overlapMode === 'overlap_signature' ? 210 : 320) +
                      stampOverlay.offsetX
                    }, ${68 + stampOverlay.offsetY}) rotate(${stampOverlay.rotationDeg}) scale(${
                      stampOverlay.scalePercent / 100
                    })`}
                    opacity={stampOverlay.opacity}
                  >
                    <foreignObject x={-85} y={-42} width={170} height={84}>
                      <img
                        src={stampDataUrl}
                        alt="Overlay Timbro dell'ASD"
                        className="w-full h-full object-contain"
                      />
                    </foreignObject>
                  </g>
                )}

                {config.showSignature && signatureDataUrl && (
                  <g
                    transform={`translate(${105 + signatureOverlay.offsetX}, ${
                      76 + signatureOverlay.offsetY
                    }) rotate(${signatureOverlay.rotationDeg}) scale(${
                      signatureOverlay.scalePercent / 100
                    })`}
                    opacity={signatureOverlay.opacity}
                  >
                    <foreignObject x={-75} y={-28} width={150} height={56}>
                      <img
                        src={signatureDataUrl}
                        alt="Overlay Firma del Presidente"
                        className="w-full h-full object-contain"
                      />
                    </foreignObject>
                  </g>
                )}
              </svg>
            ) : null}
          </div>
        </div>

        {/* Action Controls (No-Print) */}
        <div className="no-print pt-5 mt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenGmailPreview()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Invia via Gmail con PDF Allegato</span>
            </button>

            {parentEmail && (
              <a
                href={emailHref}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Apri Client Posta (senza allegato)</span>
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Chiudi
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Generazione PDF...' : 'Scarica PDF con Overlay'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Stampa Ricevuta</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
