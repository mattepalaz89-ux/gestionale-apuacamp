import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard,
  Download,
  Upload,
  CheckCircle2,
  Move,
  Send,
  MessageCircle,
  RotateCcw,
  Eye,
  Shield,
  FileText,
  X,
  Wand2,
} from 'lucide-react';
import {
  AssociationProfile,
  DigitalCardFieldId,
  DigitalCardFieldPlacement,
  DigitalCardTemplateConfig,
  DigitalCardThemePreset,
  InsuranceType,
  InsuranceTypeLabels,
  Member,
} from '../types';
import {
  DEFAULT_INSURANCE_TYPE_LABELS,
  DIGITAL_CARD_LAYOUT_PRESETS,
  exportDigitalCardToPdf,
  exportDigitalCardToPng,
  generateAsdEmblemDataUrl,
  getInsuranceDisplayLabel,
  processDigitalCardBackgroundFile,
  resolveCardFieldTextValue,
  resolveDigitalCardConfig,
  resolveInsuranceTypeLabels,
} from '../utils/digitalCard';
import { compressImageFileToDataUrl } from '../utils/formAndReceiptTemplates';

interface DigitalMemberCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  member?: Member | null;
  members: Member[];
  profile: AssociationProfile;
  onUpdateProfile: (profile: AssociationProfile) => void;
  onUpdateMember?: (member: Member) => void;
}

export const DigitalMemberCardModal: React.FC<DigitalMemberCardModalProps> = ({
  isOpen,
  onClose,
  member,
  members,
  profile,
  onUpdateProfile,
  onUpdateMember,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    member?.id || members[0]?.id || ''
  );

  useEffect(() => {
    if (member?.id) {
      setSelectedMemberId(member.id);
    } else if (members.length > 0 && !selectedMemberId) {
      setSelectedMemberId(members[0].id);
    }
  }, [member, members, selectedMemberId]);

  const activeMember: Member =
    members.find((m) => m.id === selectedMemberId) ||
    member || {
      id: 'sample-member',
      childName: 'Marco Rossi',
      birthDate: '2016-05-14',
      birthPlace: 'Massa',
      group: '6-11',
      childFiscalCode: 'RSSMRC16E14F023K',
      childAddress: 'Via Apuana 18, Massa (MS)',
      parentName: 'Laura Bianchi',
      parentFiscalCode: 'BNCLRA84M45F023W',
      parentPhone: '3331234567',
      parentEmail: 'laura.bianchi@example.it',
      membershipCardNumber: `USACLI-${profile.activeYear}-042`,
      isPaid: true,
      cardIssueDate: `${profile.activeYear}-01-10`,
      expiryDate: `31/12/${profile.activeYear}`,
      cardValidityType: 'solare',
      insuranceType: 'Gold',
      photoConsent: true,
      allergies: '',
      notesConditions: '',
      formSignedAndArchived: true,
    };

  const [cardConfig, setCardConfig] = useState<DigitalCardTemplateConfig>(() =>
    resolveDigitalCardConfig(profile)
  );
  const [insuranceLabels, setInsuranceLabels] = useState<InsuranceTypeLabels>(() =>
    resolveInsuranceTypeLabels(profile)
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(
    profile.logoImageDataUrl
  );

  // Sync config when modal opens or profile updates externally, and close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    setCardConfig(resolveDigitalCardConfig(profile));
    setInsuranceLabels(resolveInsuranceTypeLabels(profile));
    setLogoDataUrl(profile.logoImageDataUrl);

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, profile, onClose]);

  // Per-card quick editable fields
  const [overrideCardNumber, setOverrideCardNumber] = useState<string>(
    activeMember.membershipCardNumber || `USACLI-${profile.activeYear}-001`
  );
  const [overrideInsuranceLabel, setOverrideInsuranceLabel] = useState<string>('');
  const [overrideExpiryDate, setOverrideExpiryDate] = useState<string>(
    activeMember.expiryDate || `31/12/${profile.activeYear}`
  );

  useEffect(() => {
    setOverrideCardNumber(
      activeMember.membershipCardNumber || `USACLI-${profile.activeYear}-001`
    );
    setOverrideInsuranceLabel('');
    setOverrideExpiryDate(activeMember.expiryDate || `31/12/${profile.activeYear}`);
  }, [activeMember.id, activeMember.membershipCardNumber, activeMember.expiryDate, profile.activeYear]);

  const [activeConfigTab, setActiveConfigTab] = useState<
    'positions' | 'background_logo' | 'insurance_names'
  >('positions');
  const [selectedFieldId, setSelectedFieldId] =
    useState<DigitalCardFieldId>('memberName');
  const [clickToPositionMode, setClickToPositionMode] = useState<
    'field' | 'logo' | 'qr'
  >('field');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const cardPreviewRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const persistCardSettings = (
    nextConfig: DigitalCardTemplateConfig,
    nextInsuranceLabels: InsuranceTypeLabels = insuranceLabels,
    nextLogo: string | undefined = logoDataUrl
  ) => {
    onUpdateProfile({
      ...profile,
      logoImageDataUrl: nextLogo,
      insuranceTypeLabels: nextInsuranceLabels,
      digitalCardConfig: nextConfig,
    });
  };

  const selectedField: DigitalCardFieldPlacement =
    cardConfig.fields.find((f) => f.id === selectedFieldId) || cardConfig.fields[0];

  const handleUpdateField = (
    fieldId: DigitalCardFieldId,
    patch: Partial<DigitalCardFieldPlacement>
  ) => {
    const nextFields = cardConfig.fields.map((f) =>
      f.id === fieldId ? { ...f, ...patch } : f
    );
    const nextCfg = { ...cardConfig, fields: nextFields };
    setCardConfig(nextCfg);
    persistCardSettings(nextCfg);
  };

  // Interactive click on the card preview to place the selected text field, logo, or QR badge
  const handleCardPreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardPreviewRef.current) return;
    const rect = cardPreviewRef.current.getBoundingClientRect();
    const xPct = Math.max(
      2,
      Math.min(96, Math.round(((e.clientX - rect.left) / rect.width) * 100))
    );
    const yPct = Math.max(
      4,
      Math.min(94, Math.round(((e.clientY - rect.top) / rect.height) * 100))
    );

    if (clickToPositionMode === 'logo') {
      const nextCfg = { ...cardConfig, logoXPercent: xPct, logoYPercent: yPct };
      setCardConfig(nextCfg);
      persistCardSettings(nextCfg);
      showToast(`Stemma Associazione posizionato a X: ${xPct}%, Y: ${yPct}%`);
    } else if (clickToPositionMode === 'qr') {
      const nextCfg = { ...cardConfig, qrXPercent: xPct, qrYPercent: yPct };
      setCardConfig(nextCfg);
      persistCardSettings(nextCfg);
      showToast(`Bollino QR posizionato a X: ${xPct}%, Y: ${yPct}%`);
    } else {
      handleUpdateField(selectedFieldId, { xPercent: xPct, yPercent: yPct });
      showToast(
        `Campo "${selectedField.label}" spostato alle coordinate X: ${xPct}%, Y: ${yPct}%`
      );
    }
  };

  const handleUploadBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const processed = await processDigitalCardBackgroundFile(file);
      const nextCfg: DigitalCardTemplateConfig = {
        ...cardConfig,
        backgroundDataUrl: processed.previewDataUrl,
        backgroundRawPdfDataUrl: processed.rawPdfDataUrl,
        backgroundFileName: processed.fileName,
      };
      setCardConfig(nextCfg);
      persistCardSettings(nextCfg);
      showToast(
        `Sfondo "${processed.fileName}" (${
          file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'Immagine'
        }) caricato e salvato nel modello tessera!`
      );
    } catch (err) {
      console.error(err);
    }
    e.target.value = '';
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 360, 360);
      setLogoDataUrl(dataUrl);
      const nextCfg = { ...cardConfig, showLogo: true };
      setCardConfig(nextCfg);
      persistCardSettings(nextCfg, insuranceLabels, dataUrl);
      showToast('Stemma / Logo dell\'Associazione caricato e applicato alla tessera!');
    } catch (err) {
      console.error(err);
    }
    e.target.value = '';
  };

  const handleGenerateEmblem = () => {
    const gen = generateAsdEmblemDataUrl(profile.name, profile.affiliation);
    setLogoDataUrl(gen);
    const nextCfg = { ...cardConfig, showLogo: true };
    setCardConfig(nextCfg);
    persistCardSettings(nextCfg, insuranceLabels, gen);
    showToast(`Stemma digitale generato per ${profile.name}!`);
  };

  const handleSaveCardNumberToMember = () => {
    if (!onUpdateMember || activeMember.id === 'sample-member') return;
    onUpdateMember({
      ...activeMember,
      membershipCardNumber: overrideCardNumber,
      expiryDate: overrideExpiryDate,
    });
    showToast(`Numero tessera (${overrideCardNumber}) aggiornato nella scheda di ${activeMember.childName}!`);
  };

  const effectiveLogoSrc =
    logoDataUrl ||
    profile.stampImageDataUrl ||
    generateAsdEmblemDataUrl(profile.name, profile.affiliation);

  const effectiveProfileForRender: AssociationProfile = {
    ...profile,
    logoImageDataUrl: logoDataUrl,
    insuranceTypeLabels: insuranceLabels,
    digitalCardConfig: cardConfig,
  };

  const effectiveInsuranceDisplay = getInsuranceDisplayLabel(
    activeMember.insuranceType,
    effectiveProfileForRender,
    overrideInsuranceLabel
  );

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      await exportDigitalCardToPdf({
        member: activeMember,
        profile: effectiveProfileForRender,
        config: cardConfig,
        customOverrides: {
          cardNumber: overrideCardNumber,
          insuranceLabel: overrideInsuranceLabel || undefined,
          expiryDate: overrideExpiryDate,
        },
      });
      showToast('Tessera Digitale PDF generata e scaricata con successo!');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPng = async () => {
    setIsExporting(true);
    try {
      await exportDigitalCardToPng({
        member: activeMember,
        profile: effectiveProfileForRender,
        config: cardConfig,
        customOverrides: {
          cardNumber: overrideCardNumber,
          insuranceLabel: overrideInsuranceLabel || undefined,
          expiryDate: overrideExpiryDate,
        },
      });
      showToast('Immagine PNG ad alta risoluzione della Tessera Digitale scaricata!');
    } finally {
      setIsExporting(false);
    }
  };

  // Build mailto & WhatsApp share links
  const shareSubject = encodeURIComponent(
    `Tessera Associativa Digitale ${profile.activeYear} - ${activeMember.childName} (${profile.name})`
  );
  const shareBodyText =
    `Gentile ${activeMember.parentName || activeMember.childName},\n\n` +
    `ti inviamo i dati ufficiali della Tessera Associativa Digitale ${profile.activeYear} presso ${profile.name} (${profile.affiliation}):\n\n` +
    `• Socio Tesserato: ${activeMember.childName}\n` +
    `• Numero Tessera: ${overrideCardNumber}\n` +
    `• Copertura Assicurativa: ${effectiveInsuranceDisplay}\n` +
    `• Validità / Scadenza: ${overrideExpiryDate}\n\n` +
    `In allegato trovi il documento della Tessera Digitale.\n` +
    `Un cordiale saluto,\n${profile.name}`;
  const mailtoHref = `mailto:${encodeURIComponent(
    activeMember.parentEmail || ''
  )}?subject=${shareSubject}&body=${encodeURIComponent(shareBodyText)}`;

  const cleanPhone = (activeMember.parentPhone || '').replace(/[^0-9]/g, '');
  const waPhone = cleanPhone
    ? cleanPhone.startsWith('39')
      ? cleanPhone
      : `39${cleanPhone}`
    : '';
  const whatsappHref = `https://wa.me/${waPhone}?text=${encodeURIComponent(shareBodyText)}`;

  const themeBgStyle = (preset: DigitalCardThemePreset): string => {
    if (preset === 'usacli_sport_blue') {
      return 'bg-linear-to-br from-slate-900 via-blue-900 to-blue-700 text-white';
    }
    if (preset === 'gold_prestige') {
      return 'bg-linear-to-br from-stone-900 via-stone-800 to-amber-900 text-white';
    }
    if (preset === 'minimal_light') {
      return 'bg-linear-to-br from-slate-50 to-slate-200 text-slate-900';
    }
    return 'bg-linear-to-br from-emerald-950 via-emerald-800 to-slate-900 text-white';
  };

  return (
    <div
      id="digital-member-card-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full p-6 my-6 max-h-[94vh] overflow-y-auto space-y-5">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Generatore Tessera Associativa Digitale & Personalizzazione Modello
                </h2>
                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                  {profile.name} · Anno {profile.activeYear}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Personalizza stemma, sfondo (immagine o PDF), nomi delle assicurazioni e seleziona dove posizionare automaticamente i testi sulla tessera.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi generatore tessera digitale"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusBanner && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {statusBanner}
            </span>
            <button onClick={() => setStatusBanner(null)} className="font-bold px-2">
              ✕
            </button>
          </div>
        )}

        {/* Main 2-Column Layout: Left = Live Interactive Card Preview & Member Data / Right = Template Designer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: LIVE INTERACTIVE CARD PREVIEW & MEMBER SELECTOR (6 cols) */}
          <div className="lg:col-span-6 space-y-4">
            {/* Member & Quick Card Data Bar */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="font-bold text-slate-800">
                  Socio Destinatario della Tessera:
                </label>
                {members.length > 0 && (
                  <select
                    id="select-digital-card-member"
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.childName} ({m.membershipCardNumber || 'Senza N°'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    N° Tessera US ACLI / Ente
                  </label>
                  <div className="flex gap-1">
                    <input
                      id="input-digital-card-number"
                      type="text"
                      value={overrideCardNumber}
                      onChange={(e) => setOverrideCardNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono font-bold text-slate-900"
                    />
                    {onUpdateMember && activeMember.id !== 'sample-member' && (
                      <button
                        type="button"
                        onClick={handleSaveCardNumberToMember}
                        title="Salva N° tessera nella scheda del socio"
                        className="px-2 py-1 bg-emerald-700 text-white rounded-lg text-[10px] font-bold"
                      >
                        Salva
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Assicurazione ({activeMember.insuranceType})
                  </label>
                  <input
                    id="input-digital-card-insurance-override"
                    type="text"
                    placeholder={insuranceLabels[activeMember.insuranceType]}
                    value={overrideInsuranceLabel}
                    onChange={(e) => setOverrideInsuranceLabel(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Data Scadenza Tesserino
                  </label>
                  <input
                    id="input-digital-card-expiry"
                    type="text"
                    value={overrideExpiryDate}
                    onChange={(e) => setOverrideExpiryDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                  />
                </div>
              </div>
            </div>

            {/* LIVE CLICK-TO-POSITION DIGITAL CARD PREVIEW */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>Anteprima Interattiva Tessera Digitale (Clicca sulla tessera per spostare)</span>
                </span>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setClickToPositionMode('field')}
                    className={`px-2 py-1 rounded font-semibold ${
                      clickToPositionMode === 'field'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    Sposta Testo: {selectedField.label.split(' ')[0]}
                  </button>
                  <button
                    type="button"
                    onClick={() => setClickToPositionMode('logo')}
                    className={`px-2 py-1 rounded font-semibold ${
                      clickToPositionMode === 'logo'
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    Sposta Stemma
                  </button>
                  <button
                    type="button"
                    onClick={() => setClickToPositionMode('qr')}
                    className={`px-2 py-1 rounded font-semibold ${
                      clickToPositionMode === 'qr'
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-600'
                    }`}
                  >
                    Sposta QR
                  </button>
                </div>
              </div>

              {/* CR80 Aspect Ratio Card (1020 : 640 ~ 1.593) */}
              <div
                id="digital-card-live-preview"
                ref={cardPreviewRef}
                onClick={handleCardPreviewClick}
                title="Clicca in qualsiasi punto della tessera per posizionare l'elemento selezionato"
                className={`relative w-full aspect-[1.59/1] rounded-2xl shadow-xl overflow-hidden cursor-crosshair select-none border-2 border-slate-300 ${themeBgStyle(
                  cardConfig.themePreset
                )}`}
              >
                {/* Custom Background Image or Rendered PDF Layer */}
                {cardConfig.backgroundDataUrl && (
                  <img
                    src={cardConfig.backgroundDataUrl}
                    alt="Sfondo Personalizzato Tessera"
                    style={{ opacity: cardConfig.backgroundOpacity ?? 0.9 }}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />
                )}

                {/* Subtle Inner Frame */}
                <div className="absolute inset-2.5 rounded-xl border border-white/25 pointer-events-none" />

                {/* Association Emblem / Logo ("Stemma dell'Associazione") */}
                {cardConfig.showLogo && effectiveLogoSrc && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setClickToPositionMode('logo');
                    }}
                    style={{
                      left: `${cardConfig.logoXPercent}%`,
                      top: `${cardConfig.logoYPercent}%`,
                      transform: `translate(-50%, -50%) scale(${
                        (cardConfig.logoScalePercent || 100) / 100
                      })`,
                    }}
                    className={`absolute w-14 h-14 flex items-center justify-center rounded-full transition-shadow ${
                      clickToPositionMode === 'logo'
                        ? 'ring-2 ring-amber-400 shadow-lg'
                        : ''
                    }`}
                  >
                    <img
                      src={effectiveLogoSrc}
                      alt="Stemma Associazione"
                      className="w-full h-full object-contain drop-shadow-md"
                    />
                  </div>
                )}

                {/* QR Verification Badge */}
                {cardConfig.showQrVerificationBadge && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setClickToPositionMode('qr');
                    }}
                    style={{
                      left: `${cardConfig.qrXPercent}%`,
                      top: `${cardConfig.qrYPercent}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute w-14 h-14 bg-white p-1.5 rounded-lg shadow-md border border-slate-900 flex flex-col items-center justify-center ${
                      clickToPositionMode === 'qr' ? 'ring-2 ring-amber-400' : ''
                    }`}
                  >
                    <div className="grid grid-cols-5 gap-0.5 w-full h-full">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          className={
                            i % 2 === 0 || i < 5 || i % 5 === 0
                              ? 'bg-slate-900'
                              : 'bg-slate-100'
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Dynamic Text Fields Positioned at User X/Y Coordinates */}
                {cardConfig.fields.map((field) => {
                  if (!field.visible) return null;
                  const { prefix, value } = resolveCardFieldTextValue(
                    field,
                    activeMember,
                    effectiveProfileForRender,
                    {
                      cardNumber: overrideCardNumber,
                      insuranceLabel: overrideInsuranceLabel || undefined,
                      expiryDate: overrideExpiryDate,
                    }
                  );
                  const isSelected =
                    clickToPositionMode === 'field' && selectedFieldId === field.id;

                  const translateX =
                    field.align === 'center'
                      ? '-50%'
                      : field.align === 'right'
                      ? '-100%'
                      : '0%';

                  return (
                    <div
                      key={field.id}
                      data-field-id={field.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClickToPositionMode('field');
                        setSelectedFieldId(field.id);
                      }}
                      style={{
                        left: `${field.xPercent}%`,
                        top: `${field.yPercent}%`,
                        transform: `translate(${translateX}, 0)`,
                        textAlign: field.align,
                        color: field.color,
                      }}
                      className={`absolute px-1.5 py-0.5 rounded transition-all cursor-pointer whitespace-nowrap ${
                        isSelected
                          ? 'ring-2 ring-amber-400 bg-black/30'
                          : 'hover:bg-black/20'
                      }`}
                    >
                      {prefix && (
                        <div
                          style={{
                            fontSize: `${Math.max(8, Math.round(field.fontSize * 0.56))}px`,
                          }}
                          className="font-bold uppercase tracking-wider opacity-80 leading-none mb-0.5"
                        >
                          {prefix}
                        </div>
                      )}
                      <div
                        style={{ fontSize: `${field.fontSize}px` }}
                        className={`leading-tight ${
                          field.id === 'memberName' || field.id === 'cardNumber'
                            ? 'font-extrabold'
                            : 'font-bold'
                        } ${
                          field.id === 'cardNumber' || field.id === 'fiscalCode'
                            ? 'font-mono'
                            : 'font-sans'
                        }`}
                      >
                        {value}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Export & Send to Member Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                id="btn-download-digital-card-pdf"
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Scarica PDF</span>
              </button>

              <button
                id="btn-download-digital-card-png"
                type="button"
                onClick={handleDownloadPng}
                disabled={isExporting}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 transition-colors shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Scarica PNG</span>
              </button>

              <a
                href={mailtoHref}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>Invia per Email</span>
              </a>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-emerald-700" />
                <span>Invia WhatsApp</span>
              </a>
            </div>
          </div>

          {/* RIGHT COLUMN: TEMPLATE CONFIGURATOR (6 cols) */}
          <div className="lg:col-span-6 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
            {/* 3 Designer Sub-Tabs */}
            <div className="grid grid-cols-3 bg-slate-100 p-1.5 gap-1 border-b border-slate-200 text-xs">
              <button
                id="tab-card-positions"
                type="button"
                onClick={() => setActiveConfigTab('positions')}
                className={`py-2 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeConfigTab === 'positions'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>1. Posizione Testi</span>
              </button>

              <button
                id="tab-card-bg-logo"
                type="button"
                onClick={() => setActiveConfigTab('background_logo')}
                className={`py-2 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeConfigTab === 'background_logo'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>2. Stemma & Sfondo PDF</span>
              </button>

              <button
                id="tab-card-insurance-names"
                type="button"
                onClick={() => setActiveConfigTab('insurance_names')}
                className={`py-2 px-2.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeConfigTab === 'insurance_names'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>3. Nomi Assicurazioni</span>
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* TAB 1: TEXT FIELD POSITIONING & LAYOUT PRESETS */}
              {activeConfigTab === 'positions' && (
                <div className="space-y-4">
                  {/* Quick Layout Presets */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-800">
                      Disposizioni Automatiche Preimpostate:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {DIGITAL_CARD_LAYOUT_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          id={`btn-card-preset-${preset.id}`}
                          type="button"
                          onClick={() => {
                            const updatedFields = preset.applyToFields(cardConfig.fields);
                            const nextCfg = { ...cardConfig, fields: updatedFields };
                            setCardConfig(nextCfg);
                            persistCardSettings(nextCfg);
                            showToast(`Disposizione "${preset.name}" applicata!`);
                          }}
                          className="p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-left transition-colors"
                        >
                          <div className="font-bold text-slate-900 text-[11px]">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                            {preset.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Field Selector Pills */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-800">
                      Seleziona il Campo di Testo da Posizionare o Personalizzare:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {cardConfig.fields.map((f) => (
                        <button
                          key={f.id}
                          id={`btn-select-card-field-${f.id}`}
                          type="button"
                          onClick={() => {
                            setClickToPositionMode('field');
                            setSelectedFieldId(f.id);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 ${
                            selectedFieldId === f.id
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                              : f.visible
                              ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                          }`}
                        >
                          <span>{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Coordinate Controls for Selected Field */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-emerald-700 font-bold">
                          Campo Selezionato
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm">
                          {selectedField.label}
                        </h4>
                      </div>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedField.visible}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              visible: e.target.checked,
                            })
                          }
                          className="rounded text-emerald-600"
                        />
                        <span>Mostra sulla Tessera</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                          <span>Posizione Orizzontale (X):</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {selectedField.xPercent}%
                          </span>
                        </div>
                        <input
                          id="slider-card-field-x"
                          type="range"
                          min={2}
                          max={96}
                          value={selectedField.xPercent}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              xPercent: Number(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                          <span>Posizione Verticale (Y):</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {selectedField.yPercent}%
                          </span>
                        </div>
                        <input
                          id="slider-card-field-y"
                          type="range"
                          min={4}
                          max={94}
                          value={selectedField.yPercent}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              yPercent: Number(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                          <span>Dimensione Carattere:</span>
                          <span className="font-mono font-bold">
                            {selectedField.fontSize} px
                          </span>
                        </div>
                        <input
                          type="range"
                          min={8}
                          max={28}
                          value={selectedField.fontSize}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              fontSize: Number(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Colore Testo
                          </label>
                          <input
                            type="color"
                            value={selectedField.color}
                            onChange={(e) =>
                              handleUpdateField(selectedField.id, {
                                color: e.target.value,
                              })
                            }
                            className="w-full h-8 rounded cursor-pointer border border-slate-200"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Allineamento
                          </label>
                          <select
                            value={selectedField.align}
                            onChange={(e) =>
                              handleUpdateField(selectedField.id, {
                                align: e.target.value as 'left' | 'center' | 'right',
                              })
                            }
                            className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white"
                          >
                            <option value="left">Sinistra</option>
                            <option value="center">Centrato</option>
                            <option value="right">Destra</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 items-center">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedField.showLabelPrefix}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              showLabelPrefix: e.target.checked,
                            })
                          }
                          className="rounded text-emerald-600"
                        />
                        <span>Mostra Intestazione sopra il valore</span>
                      </label>

                      <input
                        type="text"
                        placeholder="Etichetta sopra il campo..."
                        value={selectedField.customPrefix || ''}
                        onChange={(e) =>
                          handleUpdateField(selectedField.id, {
                            customPrefix: e.target.value,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: STEMMA ASSOCIAZIONE & SFONDO PERSONALIZZATO (IMMAGINE O PDF) */}
              {activeConfigTab === 'background_logo' && (
                <div className="space-y-4">
                  {/* Stemma / Logo Card */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">
                          Stemma / Logo dell&apos;Associazione Sportiva
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Carica il logo della tua ASD (PNG/JPG/SVG) oppure genera uno stemma digitale automatico.
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700 shrink-0">
                        <input
                          type="checkbox"
                          checked={cardConfig.showLogo}
                          onChange={(e) => {
                            const nextCfg = { ...cardConfig, showLogo: e.target.checked };
                            setCardConfig(nextCfg);
                            persistCardSettings(nextCfg);
                          }}
                        />
                        <span>Mostra Stemma</span>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Carica Stemma / Logo ASD</span>
                        <input
                          id="input-card-logo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleUploadLogo}
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={handleGenerateEmblem}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg font-semibold"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Genera Stemma Automatico</span>
                      </button>
                    </div>

                    {cardConfig.showLogo && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            Posizione X ({cardConfig.logoXPercent}%)
                          </span>
                          <input
                            type="range"
                            min={5}
                            max={95}
                            value={cardConfig.logoXPercent}
                            onChange={(e) => {
                              const nextCfg = {
                                ...cardConfig,
                                logoXPercent: Number(e.target.value),
                              };
                              setCardConfig(nextCfg);
                              persistCardSettings(nextCfg);
                            }}
                            className="w-full accent-emerald-600"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            Posizione Y ({cardConfig.logoYPercent}%)
                          </span>
                          <input
                            type="range"
                            min={8}
                            max={92}
                            value={cardConfig.logoYPercent}
                            onChange={(e) => {
                              const nextCfg = {
                                ...cardConfig,
                                logoYPercent: Number(e.target.value),
                              };
                              setCardConfig(nextCfg);
                              persistCardSettings(nextCfg);
                            }}
                            className="w-full accent-emerald-600"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">
                            Dimensione ({cardConfig.logoScalePercent}%)
                          </span>
                          <input
                            type="range"
                            min={50}
                            max={170}
                            value={cardConfig.logoScalePercent}
                            onChange={(e) => {
                              const nextCfg = {
                                ...cardConfig,
                                logoScalePercent: Number(e.target.value),
                              };
                              setCardConfig(nextCfg);
                              persistCardSettings(nextCfg);
                            }}
                            className="w-full accent-emerald-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Background Upload (PDF or Image) */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>Sfondo Grafico Personalizzato (File .PDF oppure Immagine PNG/JPG)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Carica un file PDF o un&apos;immagine da usare come sfondo della tessera: il gestionale sovrapporrà i testi automatici nelle coordinate da te scelte.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Carica Sfondo in PDF o Immagine (.pdf, .png, .jpg)</span>
                        <input
                          id="input-card-bg-upload"
                          type="file"
                          accept=".pdf,application/pdf,image/*"
                          onChange={handleUploadBackground}
                          className="hidden"
                        />
                      </label>

                      {cardConfig.backgroundDataUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            const nextCfg: DigitalCardTemplateConfig = {
                              ...cardConfig,
                              backgroundDataUrl: undefined,
                              backgroundRawPdfDataUrl: undefined,
                              backgroundFileName: undefined,
                            };
                            setCardConfig(nextCfg);
                            persistCardSettings(nextCfg);
                            showToast('Sfondo personalizzato rimosso.');
                          }}
                          className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold"
                        >
                          Rimuovi Sfondo ({cardConfig.backgroundFileName || 'Attivo'})
                        </button>
                      )}
                    </div>

                    {/* Theme Presets */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                        Tema Colore di Base:
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(
                          [
                            { id: 'apuacamp_emerald', label: 'Verde Apuacamp' },
                            { id: 'usacli_sport_blue', label: 'Blu US ACLI' },
                            { id: 'gold_prestige', label: 'Oro Prestige' },
                            { id: 'minimal_light', label: 'Chiaro Minimal' },
                          ] as const
                        ).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              const nextCfg: DigitalCardTemplateConfig = {
                                ...cardConfig,
                                themePreset: t.id,
                              };
                              setCardConfig(nextCfg);
                              persistCardSettings(nextCfg);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border font-semibold text-[11px] ${
                              cardConfig.themePreset === t.id
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                : 'border-slate-200 bg-slate-50 text-slate-700'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: CUSTOMIZABLE INSURANCE TYPE NAMES */}
              {activeConfigTab === 'insurance_names' && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Personalizza i Nomi dei Tipi di Assicurazione / Copertura
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Modifica il nome associato a ciascuna fascia assicurativa nel caso in cui cambiasse la nomenclatura dell&apos;Ente di Promozione Sportiva o per adattare il software ad altre realtà associative.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {(['Base', 'Summer', 'Gold', 'Platinum'] as InsuranceType[]).map(
                      (tierKey) => (
                        <div
                          key={tierKey}
                          className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center p-2.5 rounded-lg bg-slate-50 border border-slate-200"
                        >
                          <div>
                            <span className="font-mono font-bold text-slate-800 text-xs">
                               Fascia "{tierKey}"
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              Predefinito: {DEFAULT_INSURANCE_TYPE_LABELS[tierKey]}
                            </span>
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              id={`input-insurance-label-${tierKey}`}
                              type="text"
                              value={insuranceLabels[tierKey]}
                              onChange={(e) => {
                                const nextLabels: InsuranceTypeLabels = {
                                  ...insuranceLabels,
                                  [tierKey]: e.target.value,
                                };
                                setInsuranceLabels(nextLabels);
                                persistCardSettings(cardConfig, nextLabels);
                              }}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900"
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  <div className="pt-2 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setInsuranceLabels({ ...DEFAULT_INSURANCE_TYPE_LABELS });
                        persistCardSettings(cardConfig, {
                          ...DEFAULT_INSURANCE_TYPE_LABELS,
                        });
                        showToast('Nomi assicurazioni riportati ai valori predefiniti.');
                      }}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ripristina nomi predefiniti</span>
                    </button>

                    <span className="text-[11px] text-emerald-700 font-semibold">
                      Salvataggio automatico attivo ✓
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
