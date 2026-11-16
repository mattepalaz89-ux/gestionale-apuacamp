import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Plus,
  Trash2,
  Stamp,
  PenTool,
  Save,
  CheckCircle2,
  Download,
  Printer,
  RotateCcw,
  Sliders,
  Layers,
  Tag,
  Eye,
  Wand2,
} from 'lucide-react';
import {
  AssociationProfile,
  ImageOverlayConfig,
  Member,
  ReceiptDynamicField,
  ReceiptDynamicFieldPosition,
  ReceiptDynamicFieldType,
  ReceiptLayoutTemplateId,
  ReceiptTemplateConfig,
} from '../types';
import { formatEuro } from '../utils/finance';
import {
  DEFAULT_DYNAMIC_FIELDS,
  DEFAULT_RECEIPT_CONFIG,
  DEFAULT_SIGNATURE_OVERLAY,
  DEFAULT_STAMP_OVERLAY,
  DYNAMIC_PLACEHOLDER_TOKENS,
  RECEIPT_CUSTOM_LINE_SUGGESTIONS,
  RECEIPT_INTRO_DECLARATION_PRESETS,
  RECEIPT_LAYOUT_TEMPLATES,
  RECEIPT_SUBTEXT_PRESETS,
  RECEIPT_TAX_CLAUSE_PRESETS,
  SUGGESTED_DYNAMIC_FIELDS,
  compressImageFileToDataUrl,
  exportReceiptToPdfWithOverlays,
  generateDigitalAsdStampDataUrl,
  generateDigitalSignatureDataUrl,
  getReceiptLayoutTemplateMeta,
  resolveDynamicTextPlaceholders,
  resolveReceiptConfig,
  ReceiptPlaceholderContext,
} from '../utils/formAndReceiptTemplates';

interface ReceiptConfigViewProps {
  profile: AssociationProfile;
  members: Member[];
  onUpdateProfile: (profile: AssociationProfile) => void;
  onOpenSampleReceiptModal?: () => void;
}

export const ReceiptConfigView: React.FC<ReceiptConfigViewProps> = ({
  profile,
  members,
  onUpdateProfile,
  onOpenSampleReceiptModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'texts' | 'dynamic_fields' | 'overlays'>(
    'texts'
  );
  const [previewDocType, setPreviewDocType] = useState<'ricevuta' | 'preventivo' | 'sollecito'>(
    'ricevuta'
  );

  const [config, setConfig] = useState<ReceiptTemplateConfig>(() =>
    resolveReceiptConfig(profile)
  );
  const [stampDataUrl, setStampDataUrl] = useState<string | undefined>(
    profile.stampImageDataUrl
  );
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | undefined>(
    profile.signatureImageDataUrl
  );

  useEffect(() => {
    setStampDataUrl(profile.stampImageDataUrl);
    setSignatureDataUrl(profile.signatureImageDataUrl);
  }, [profile.stampImageDataUrl, profile.signatureImageDataUrl]);

  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Track which text field was last focused so 1-click placeholder tokens insert right into it
  const [activeTextFieldKey, setActiveTextFieldKey] = useState<
    'introDeclarationText' | 'activityDescriptionSubtext' | 'legalTaxClause' | 'footerNotes'
  >('introDeclarationText');

  // New Dynamic Field builder state
  const [newDynLabel, setNewDynLabel] = useState('');
  const [newDynTemplate, setNewDynTemplate] = useState('{{cf_socio}}');
  const [newDynType, setNewDynType] = useState<ReceiptDynamicFieldType>('auto_variable');
  const [newDynPosition, setNewDynPosition] =
    useState<ReceiptDynamicFieldPosition>('table_row');
  const [newDynOptionsText, setNewDynOptionsText] = useState('');

  // New static custom line state
  const [newLineLabel, setNewLineLabel] = useState('');
  const [newLineValue, setNewLineValue] = useState('');

  // Signature drawing pad modal state
  const [isDrawingSignature, setIsDrawingSignature] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  const dynamicFields = config.dynamicFields || DEFAULT_DYNAMIC_FIELDS;
  const stampOverlay: ImageOverlayConfig = {
    ...DEFAULT_STAMP_OVERLAY,
    ...(config.stampOverlay || {}),
  };
  const signatureOverlay: ImageOverlayConfig = {
    ...DEFAULT_SIGNATURE_OVERLAY,
    ...(config.signatureOverlay || {}),
  };

  // Sample context for live preview (uses first real member if available, otherwise realistic sample)
  const sampleMember = members[0];
  const sampleCtx: ReceiptPlaceholderContext = {
    socio: sampleMember?.childName || 'Marco Rossi',
    genitore: sampleMember?.parentName || 'Laura Bianchi',
    cf_genitore: sampleMember?.parentFiscalCode || 'BNCLRA82M45F205Z',
    cf_socio: sampleMember?.childFiscalCode || 'RSSMRC16D12F205K',
    indirizzo_socio: sampleMember?.childAddress || 'Via Roma 24, 54100 Massa (MS)',
    tessera: sampleMember?.membershipCardNumber || `AC-${profile.activeYear}-042`,
    assicurazione: sampleMember?.insuranceType || 'Gold',
    attivita: `Campus Outdoor & Tesseramento ${profile.activeYear}`,
    importo: 120,
    metodo_pagamento: 'Bonifico Bancario',
    data: new Date().toISOString().slice(0, 10),
    numero_ricevuta: `${profile.activeYear}/R-104`,
    anno: profile.activeYear,
    asd_nome: profile.name,
    asd_cf: profile.fiscalCode,
    asd_iban: profile.iban,
    asd_affiliazione: profile.affiliation,
    presidente: profile.president,
  };

  const showToast = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 4000);
  };

  // Immediately persist Base64 images and current config into AssociationProfile state
  const syncProfileState = (
    nextStamp: string | undefined,
    nextSignature: string | undefined,
    nextConfig: ReceiptTemplateConfig
  ) => {
    onUpdateProfile({
      ...profile,
      stampImageDataUrl: nextStamp,
      signatureImageDataUrl: nextSignature,
      receiptConfig: {
        ...nextConfig,
        dynamicFields: nextConfig.dynamicFields || dynamicFields,
        stampOverlay: nextConfig.stampOverlay || stampOverlay,
        signatureOverlay: nextConfig.signatureOverlay || signatureOverlay,
      },
    });
  };

  const activeLayoutTemplate: ReceiptLayoutTemplateId = config.layoutTemplate || 'standard';
  const activeLayoutMeta = getReceiptLayoutTemplateMeta(activeLayoutTemplate);

  const handleSelectLayoutTemplate = (templateId: ReceiptLayoutTemplateId) => {
    const meta = getReceiptLayoutTemplateMeta(templateId);
    const nextCfg: ReceiptTemplateConfig = {
      ...config,
      layoutTemplate: templateId,
    };
    setConfig(nextCfg);
    syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
    showToast(
      `Modello di layout PDF impostato su "${meta.name}" (${meta.subtitle}) e salvato nel profilo ASD.`
    );
  };

  const handleSaveConfiguration = () => {
    syncProfileState(stampDataUrl, signatureDataUrl, config);
    showToast(
      'Configurazione Ricevute, Layout PDF, Campi Dinamici e Immagini Base64 (Timbro e Firma) salvati nel profilo ASD!'
    );
  };

  const handleResetDefaults = () => {
    const resetCfg: ReceiptTemplateConfig = {
      ...DEFAULT_RECEIPT_CONFIG,
      customLines: [],
      dynamicFields: DEFAULT_DYNAMIC_FIELDS.map((f) => ({ ...f })),
      stampOverlay: { ...DEFAULT_STAMP_OVERLAY },
      signatureOverlay: { ...DEFAULT_SIGNATURE_OVERLAY },
    };
    setConfig(resetCfg);
    syncProfileState(stampDataUrl, signatureDataUrl, resetCfg);
    showToast('Valori predefiniti ripristinati e salvati nel profilo ASD.');
  };

  const handleInsertTokenIntoActiveText = (token: string) => {
    setConfig((prev) => {
      const currentVal = String(prev[activeTextFieldKey] || '');
      const nextVal = currentVal ? `${currentVal} ${token}` : token;
      return {
        ...prev,
        [activeTextFieldKey]: nextVal,
      };
    });
  };

  const handleAddDynamicField = () => {
    if (!newDynLabel.trim()) return;
    const options =
      newDynType === 'editable_select'
        ? newDynOptionsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const newField: ReceiptDynamicField = {
      id: `dyn-${Date.now()}`,
      label: newDynLabel.trim(),
      valueTemplate:
        newDynTemplate.trim() ||
        (options && options.length > 0 ? options[0] : '{{anno}}'),
      fieldType: newDynType,
      options,
      position: newDynPosition,
      enabled: true,
    };

    const nextCfg: ReceiptTemplateConfig = {
      ...config,
      dynamicFields: [...dynamicFields, newField],
    };
    setConfig(nextCfg);
    syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
    setNewDynLabel('');
    setNewDynTemplate('');
    setNewDynOptionsText('');
  };

  const handleAddSuggestedDynamicField = (sug: Omit<ReceiptDynamicField, 'id'>) => {
    const newField: ReceiptDynamicField = {
      ...sug,
      id: `dyn-sug-${Date.now()}-${Math.floor(Math.random() * 100)}`,
    };
    const nextCfg: ReceiptTemplateConfig = {
      ...config,
      dynamicFields: [...dynamicFields, newField],
    };
    setConfig(nextCfg);
    syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
  };

  const handleUpdateDynamicField = (id: string, patch: Partial<ReceiptDynamicField>) => {
    setConfig((prev) => ({
      ...prev,
      dynamicFields: (prev.dynamicFields || DEFAULT_DYNAMIC_FIELDS).map((f) =>
        f.id === id ? { ...f, ...patch } : f
      ),
    }));
  };

  const handleDeleteDynamicField = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      dynamicFields: (prev.dynamicFields || DEFAULT_DYNAMIC_FIELDS).filter((f) => f.id !== id),
    }));
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

  // File upload handler for Timbro dell'ASD -> Base64 string in profile state
  const handleUploadStamp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64DataUrl = await compressImageFileToDataUrl(file, 400, 240);
      const nextCfg = { ...config, showStamp: true };
      setStampDataUrl(base64DataUrl);
      setConfig(nextCfg);
      syncProfileState(base64DataUrl, signatureDataUrl, nextCfg);
      showToast("Timbro dell'ASD convertito in Base64 e salvato nello stato del profilo!");
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerateDigitalStamp = () => {
    const base64DataUrl = generateDigitalAsdStampDataUrl(
      profile.name,
      profile.fiscalCode,
      profile.affiliation
    );
    if (base64DataUrl) {
      const nextCfg = { ...config, showStamp: true };
      setStampDataUrl(base64DataUrl);
      setConfig(nextCfg);
      syncProfileState(base64DataUrl, signatureDataUrl, nextCfg);
      showToast("Timbro digitale dell'ASD salvato in Base64 nel profilo e applicato in overlay!");
    }
  };

  const handleRemoveStamp = () => {
    setStampDataUrl(undefined);
    syncProfileState(undefined, signatureDataUrl, config);
    showToast("Timbro dell'ASD rimosso dal profilo.");
  };

  // File upload handler for Firma del Presidente -> Base64 string in profile state
  const handleUploadSignature = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64DataUrl = await compressImageFileToDataUrl(file, 400, 200);
      const nextCfg = { ...config, showSignature: true };
      setSignatureDataUrl(base64DataUrl);
      setConfig(nextCfg);
      syncProfileState(stampDataUrl, base64DataUrl, nextCfg);
      showToast('Firma del Presidente convertita in Base64 e salvata nello stato del profilo!');
    } catch (err) {
      console.error(err);
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerateCalligraphicSignature = () => {
    const base64DataUrl = generateDigitalSignatureDataUrl(profile.president);
    if (base64DataUrl) {
      const nextCfg = { ...config, showSignature: true };
      setSignatureDataUrl(base64DataUrl);
      setConfig(nextCfg);
      syncProfileState(stampDataUrl, base64DataUrl, nextCfg);
      showToast('Firma calligrafica del Presidente salvata in Base64 nel profilo!');
    }
  };

  const handleRemoveSignature = () => {
    setSignatureDataUrl(undefined);
    syncProfileState(stampDataUrl, undefined, config);
    showToast('Firma del Presidente rimossa dal profilo.');
  };

  // Signature Drawing Pad handlers
  const startDrawingSig = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawingRef.current = true;
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const moveDrawingSig = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawingSig = () => {
    isDrawingRef.current = false;
  };

  const clearDrawingSig = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveDrawnSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const base64DataUrl = canvas.toDataURL('image/png');
    const nextCfg = { ...config, showSignature: true };
    setSignatureDataUrl(base64DataUrl);
    setConfig(nextCfg);
    setIsDrawingSignature(false);
    syncProfileState(stampDataUrl, base64DataUrl, nextCfg);
    showToast('Firma disegnata salvata in Base64 nel profilo come overlay PDF!');
  };

  // Resolve dynamic fields for live preview
  const enabledDynFields = dynamicFields.filter((f) => f.enabled);
  const resolvedHeaderDynamic = enabledDynFields
    .filter((f) => f.position === 'header_box')
    .map((f) => ({
      label: f.label,
      value: resolveDynamicTextPlaceholders(f.valueTemplate, sampleCtx),
    }))
    .filter((f) => f.value.trim() !== '');

  const resolvedTableDynamic = enabledDynFields
    .filter((f) => f.position === 'table_row')
    .map((f) => ({
      label: f.label,
      value: resolveDynamicTextPlaceholders(f.valueTemplate, sampleCtx),
    }))
    .filter((f) => f.value.trim() !== '');

  const resolvedFooterDynamic = enabledDynFields
    .filter((f) => f.position === 'footer_box')
    .map((f) => ({
      label: f.label,
      value: resolveDynamicTextPlaceholders(f.valueTemplate, sampleCtx),
    }))
    .filter((f) => f.value.trim() !== '');

  const badgeTitle =
    previewDocType === 'ricevuta'
      ? config.documentTitleReceipt || 'Ricevuta Non Fiscale'
      : previewDocType === 'preventivo'
      ? config.documentTitleQuote || 'Preventivo Quota'
      : config.documentTitleReminder || 'Promemoria Saldo';

  const handleDownloadSamplePdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportReceiptToPdfWithOverlays({
        fileName: `Modello_Ricevuta_${profile.name.replace(/\s+/g, '_')}_${profile.activeYear}.pdf`,
        badgeTitle,
        receiptNumber: String(sampleCtx.numero_ricevuta),
        docDate: String(sampleCtx.data),
        docType: previewDocType,
        profile,
        config: {
          ...config,
          dynamicFields,
          stampOverlay,
          signatureOverlay,
        },
        placeholderCtx: sampleCtx,
        activityTitle: String(sampleCtx.attivita),
        amount: Number(sampleCtx.importo || 120),
        paymentMethod: String(sampleCtx.metodo_pagamento),
        resolvedHeaderDynamic,
        resolvedTableDynamic,
        resolvedFooterDynamic,
        stampDataUrl,
        signatureDataUrl,
      });
      showToast('File PDF A4 con Timbro e Firma in overlay scaricato con successo!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Sliders className="w-4 h-4" />
              <span>Template Engine & PDF Image Overlay ASD</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">
              Pannello di Configurazione Ricevute, Campi Dinamici & Overlay PDF
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Personalizza i testi predefiniti con variabili dinamiche automatiche (es.{' '}
              <code className="text-emerald-300 font-mono">{'{{socio}}'}</code>,{' '}
              <code className="text-emerald-300 font-mono">{'{{cf_genitore}}'}</code>), aggiungi
              campi dinamici e carica il <strong>Timbro dell&apos;ASD</strong> e la{' '}
              <strong>Firma del Presidente</strong> (memorizzati in Base64 nel profilo) come
              overlay sopra i documenti PDF generati.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ripristina Default</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadSamplePdf}
              disabled={isExportingPdf}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Generazione PDF...' : 'Scarica PDF di Prova'}</span>
            </button>
            <button
              type="button"
              onClick={handleSaveConfiguration}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salva Configurazione ASD</span>
            </button>
          </div>
        </div>
      </div>

      {savedBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-2xs">
          <span className="font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {savedBanner}
          </span>
          <button onClick={() => setSavedBanner(null)} className="font-bold px-2">
            ✕
          </button>
        </div>
      )}

      {/* ALWAYS-VISIBLE FILE INPUTS FOR TIMBRO DELL'ASD & FIRMA DEL PRESIDENTE (BASE64 PROFILE STORAGE) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Timbro dell'ASD */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Stamp className="w-4 h-4 text-emerald-700 shrink-0" />
                <label
                  htmlFor="input-file-timbro-asd"
                  className="font-bold text-slate-900 text-sm cursor-pointer"
                >
                  Timbro dell&apos;ASD (Overlay PDF Base64)
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Carica il file immagine (PNG/JPG) del Timbro dell&apos;ASD. Viene convertito e
                memorizzato come stringa Base64 nello stato del profilo.
              </p>
            </div>
            {stampDataUrl ? (
              <div className="p-1.5 bg-slate-50 rounded-lg border border-emerald-200 shrink-0 flex flex-col items-center">
                <img
                  src={stampDataUrl}
                  alt="Anteprima Timbro dell'ASD"
                  className="h-12 w-auto object-contain"
                />
                <span className="text-[9px] font-mono text-emerald-700 font-semibold mt-0.5">
                  Base64 Attivo
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                Non caricato
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <input
              id="input-file-timbro-asd"
              type="file"
              accept="image/*"
              aria-label="Timbro dell'ASD"
              onChange={handleUploadStamp}
              className="block w-full sm:w-auto text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-700 file:text-white hover:file:bg-emerald-800 cursor-pointer"
            />
            <button
              type="button"
              onClick={handleGenerateDigitalStamp}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>Genera Timbro Digitale</span>
            </button>
            {stampDataUrl && (
              <button
                type="button"
                onClick={handleRemoveStamp}
                className="px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Firma del Presidente */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <PenTool className="w-4 h-4 text-blue-700 shrink-0" />
                <label
                  htmlFor="input-file-firma-presidente"
                  className="font-bold text-slate-900 text-sm cursor-pointer"
                >
                  Firma del Presidente (Overlay PDF Base64)
                </label>
              </div>
              <p className="text-xs text-slate-500">
                Carica il file immagine (PNG/JPG) della Firma del Presidente. Viene memorizzata
                come stringa Base64 nello stato del profilo.
              </p>
            </div>
            {signatureDataUrl ? (
              <div className="p-1.5 bg-slate-50 rounded-lg border border-blue-200 shrink-0 flex flex-col items-center">
                <img
                  src={signatureDataUrl}
                  alt="Anteprima Firma del Presidente"
                  className="h-12 w-auto object-contain"
                />
                <span className="text-[9px] font-mono text-blue-700 font-semibold mt-0.5">
                  Base64 Attivo
                </span>
              </div>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                Non caricata
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <input
              id="input-file-firma-presidente"
              type="file"
              accept="image/*"
              aria-label="Firma del Presidente"
              onChange={handleUploadSignature}
              className="block w-full sm:w-auto text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-700 file:text-white hover:file:bg-blue-800 cursor-pointer"
            />
            <button
              type="button"
              onClick={handleGenerateCalligraphicSignature}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5 text-blue-700" />
              <span>Genera Firma Calligrafica</span>
            </button>
            {signatureDataUrl && (
              <button
                type="button"
                onClick={handleRemoveSignature}
                className="px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              >
                Rimuovi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PDF RECEIPT LAYOUT TEMPLATE SELECTOR (Standard, Minimalist, Official) */}
      <div
        id="receipt-layout-template-selector"
        className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">
                Scelta Modello di Layout Grafico PDF (Template Ricevuta)
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                Attivo: {activeLayoutMeta.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Seleziona lo stile tipografico e strutturale della ricevuta PDF generata (Standard, Minimalista eco-stampa o Ufficiale Solenne con doppia cornice istituzionale).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {RECEIPT_LAYOUT_TEMPLATES.map((tpl) => {
            const isSelected = activeLayoutTemplate === tpl.id;
            return (
              <button
                key={tpl.id}
                id={`btn-layout-template-${tpl.id}`}
                type="button"
                onClick={() => handleSelectLayoutTemplate(tpl.id)}
                aria-pressed={isSelected}
                className={`text-left p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="space-y-2.5 w-full">
                  {/* Mini Visual Wireframe of the PDF Layout */}
                  <div
                    className={`w-full h-20 rounded-lg p-2.5 flex flex-col justify-between overflow-hidden ${
                      tpl.id === 'official'
                        ? 'bg-slate-50 border-2 border-double border-blue-900'
                        : tpl.id === 'minimalist'
                        ? 'bg-white border border-slate-200'
                        : 'bg-slate-50 border border-slate-300'
                    }`}
                  >
                    {tpl.id === 'standard' && (
                      <>
                        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-1">
                          <div className="space-y-0.5">
                            <div className="w-16 h-2 bg-slate-800 rounded-xs" />
                            <div className="w-10 h-1.5 bg-emerald-600 rounded-xs" />
                          </div>
                          <div className="px-1.5 py-0.5 bg-slate-900 text-white text-[7px] font-bold rounded-xs uppercase">
                            RICEVUTA
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-xs border border-slate-200">
                          <div className="h-2 bg-slate-200 rounded-xs" />
                          <div className="h-2 bg-slate-200 rounded-xs" />
                        </div>
                        <div className="flex items-center justify-between bg-slate-200/80 px-1.5 py-0.5 rounded-xs">
                          <span className="text-[7px] font-bold text-slate-600">TABELLA</span>
                          <span className="text-[7px] font-mono font-bold text-emerald-800">€ 120,00</span>
                        </div>
                      </>
                    )}

                    {tpl.id === 'minimalist' && (
                      <>
                        <div className="flex items-baseline justify-between border-b border-slate-200 pb-1">
                          <div className="w-16 h-1.5 bg-slate-700 rounded-xs" />
                          <span className="text-[7px] font-mono text-slate-500 uppercase tracking-wider">
                            Eco-Print Minimal
                          </span>
                        </div>
                        <div className="space-y-1 py-0.5">
                          <div className="w-3/4 h-1.5 bg-slate-200 rounded-xs" />
                          <div className="w-1/2 h-1.5 bg-slate-100 rounded-xs" />
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-300 pt-1">
                          <span className="text-[7px] text-slate-400">Zero sfondi pieni</span>
                          <span className="text-[7px] font-mono font-bold text-slate-800">€ 120,00</span>
                        </div>
                      </>
                    )}

                    {tpl.id === 'official' && (
                      <>
                        <div className="text-center border-b border-blue-900/40 pb-1">
                          <div className="text-[7px] font-serif font-bold text-blue-950 uppercase tracking-widest">
                            ATTESTAZIONE UFFICIALE ASD
                          </div>
                          <div className="w-20 h-1 bg-blue-900/30 mx-auto mt-0.5 rounded-xs" />
                        </div>
                        <div className="bg-blue-900 text-white text-[6.5px] font-serif font-bold text-center py-0.5 rounded-xs uppercase tracking-wider">
                          QUIETANZA FISCALE ART. 148 TUIR
                        </div>
                        <div className="flex items-center justify-between px-1">
                          <span className="text-[6.5px] font-serif text-blue-950">Bollo & Cornice</span>
                          <span className="text-[7px] font-mono font-bold text-blue-900">€ 120,00</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-bold text-slate-900 text-xs">{tpl.name}</span>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-700 text-white text-[9px] font-bold">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Selezionato
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">
                          Clicca per attivare
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-semibold text-emerald-800 mt-0.5">
                      {tpl.subtitle}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 w-full">
                  <span className="font-medium text-slate-400">Ideale per:</span>
                  <span className="font-semibold text-slate-700">{tpl.recommendedFor}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split-Screen Grid: Left Configurator / Right Live PDF Overlay Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 3-TAB CONFIGURATION PANEL (7 cols on XL) */}
        <div className="xl:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Sub-Navigation Tabs */}
          <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 p-1.5 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveSubTab('texts')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-bold transition-all ${
                activeSubTab === 'texts'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>1. Testi Predefiniti & Clausole</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('dynamic_fields')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-bold transition-all ${
                activeSubTab === 'dynamic_fields'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Tag className="w-4 h-4" />
              <span>2. Campi Dinamici ({dynamicFields.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('overlays')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-bold transition-all ${
                activeSubTab === 'overlays'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>3. Posizione & Stile Overlay PDF</span>
            </button>
          </div>

          <div className="p-5 space-y-5 text-xs">
            {/* ============================================================== */}
            {/* TAB 1: TESTI PREDEFINITI, TITOLI, VARIABILI & VISIBILITÀ CAMPI */}
            {/* ============================================================== */}
            {activeSubTab === 'texts' && (
              <div className="space-y-5">
                {/* Document Titles */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Titoli Predefiniti per Tipologia di Documento
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Titolo Ricevuta Pagamento
                      </label>
                      <input
                        type="text"
                        value={config.documentTitleReceipt}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            documentTitleReceipt: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Titolo Preventivo / Prospetto
                      </label>
                      <input
                        type="text"
                        value={config.documentTitleQuote}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            documentTitleQuote: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Titolo Sollecito Saldo
                      </label>
                      <input
                        type="text"
                        value={config.documentTitleReminder}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            documentTitleReminder: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Interactive Variable Tokens Bar */}
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <span className="font-bold text-emerald-950 text-[11px] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Inserisci Variabile Dinamica nel campo di testo attivo (clicca per inserire):
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded">
                      Campo attivo: {activeTextFieldKey}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DYNAMIC_PLACEHOLDER_TOKENS.map((t) => (
                      <button
                        key={t.token}
                        type="button"
                        onClick={() => handleInsertTokenIntoActiveText(t.token)}
                        title={`Esempio: ${t.example}`}
                        className="px-2 py-1 rounded-md bg-white hover:bg-emerald-600 hover:text-white text-emerald-900 border border-emerald-200 font-mono text-[11px] transition-colors shadow-2xs"
                      >
                        {t.token}{' '}
                        <span className="font-sans text-[10px] opacity-75">({t.label})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 1. Dichiarazione Introduttiva di Quietanza */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="font-bold text-slate-900 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showIntroDeclaration !== false}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            showIntroDeclaration: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-emerald-600"
                      />
                      <span>Formula Introduttiva di Attestazione / Quietanza</span>
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Supporta segnaposto dinamici {'{{...}}'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {RECEIPT_INTRO_DECLARATION_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            introDeclarationText: p.text,
                            showIntroDeclaration: true,
                          }))
                        }
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-[11px] font-medium transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    onFocus={() => setActiveTextFieldKey('introDeclarationText')}
                    value={config.introDeclarationText || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        introDeclarationText: e.target.value,
                      }))
                    }
                    placeholder="Es. Si attesta di aver ricevuto da {{genitore}} per {{socio}} la somma di {{importo}}..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                {/* 2. Sottotitolo / Descrizione Prestazione Istituzionale */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5">
                  <label className="font-bold text-slate-900 block">
                    Descrizione Predefinita Prestazione Istituzionale (Sotto la Causale)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {RECEIPT_SUBTEXT_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            activityDescriptionSubtext: p.text,
                          }))
                        }
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-[11px] font-medium transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    onFocus={() => setActiveTextFieldKey('activityDescriptionSubtext')}
                    value={config.activityDescriptionSubtext}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        activityDescriptionSubtext: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                {/* 3. Clausola Fiscale & Legale ASD */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="font-bold text-slate-900 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showLegalNotice}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            showLegalNotice: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-emerald-600"
                      />
                      <span>
                        Dicitura Fiscale e Legale Predefinita (Art. 148 TUIR / Bollo / Detrazione
                        19%)
                      </span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {RECEIPT_TAX_CLAUSE_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            legalTaxClause: p.text,
                            showLegalNotice: true,
                          }))
                        }
                        className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-[11px] font-medium transition-colors"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    onFocus={() => setActiveTextFieldKey('legalTaxClause')}
                    value={config.legalTaxClause}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        legalTaxClause: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                  />
                </div>

                {/* 4. Note a Piè di Pagina & Visibilità Sezioni Standard */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label className="font-bold text-slate-900 block mb-1">
                      Note a Piè di Pagina / Ringraziamenti Predefiniti
                    </label>
                    <input
                      type="text"
                      onFocus={() => setActiveTextFieldKey('footerNotes')}
                      value={config.footerNotes}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, footerNotes: e.target.value }))
                      }
                      placeholder="Es. Grazie per sostenere le attività outdoor di {{asd_nome}}!"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-2">
                      Visibilità Dati Anagrafici e Bancari sul Documento:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'showFiscalCodeAsd', label: 'Codice Fiscale e Sede ASD' },
                        { key: 'showAffiliation', label: 'Affiliazione Ente / RASD' },
                        { key: 'showMemberAddress', label: 'Indirizzo Residenza Socio' },
                        { key: 'showCardNumberAndInsurance', label: 'N° Tessera e Polizza' },
                        { key: 'showParentFiscalCode', label: 'Codice Fiscale Genitore' },
                        { key: 'showParentContact', label: 'Email / Telefono Genitore' },
                        { key: 'showPaymentMethod', label: 'Metodo di Pagamento' },
                        { key: 'showIbanOnReceipt', label: "IBAN dell'Associazione" },
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
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: CAMPI DINAMICI & RIGHE PERSONALIZZATE                   */}
            {/* ============================================================== */}
            {activeSubTab === 'dynamic_fields' && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                  <h4 className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Aggiungi Campi Dinamici con 1 Click (Suggeriti per ASD)</span>
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    I campi dinamici possono estrarre automaticamente i dati del socio/evento (es.{' '}
                    <code>{'{{cf_socio}}'}</code>, <code>{'{{metodo_pagamento}}'}</code>) oppure
                    mostrare un menu a tendina o una casella compilabile durante l&apos;emissione
                    della ricevuta.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SUGGESTED_DYNAMIC_FIELDS.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleAddSuggestedDynamicField(sug)}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-600 hover:text-white text-emerald-900 border border-emerald-300 text-[11px] font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{sug.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Dynamic Fields List */}
                <div className="space-y-2.5">
                  <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Campi Dinamici Configurati ({dynamicFields.length})
                  </div>

                  {dynamicFields.map((field) => (
                    <div
                      key={field.id}
                      className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                        field.enabled
                          ? 'bg-white border-slate-200 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 font-bold text-slate-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.enabled}
                            onChange={(e) =>
                              handleUpdateDynamicField(field.id, { enabled: e.target.checked })
                            }
                            className="rounded border-slate-300 text-emerald-600"
                          />
                          <span>{field.label}</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <select
                            value={field.position}
                            onChange={(e) =>
                              handleUpdateDynamicField(field.id, {
                                position: e.target.value as ReceiptDynamicFieldPosition,
                              })
                            }
                            className="px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700"
                          >
                            <option value="header_box">Posizione: Riquadro Socio</option>
                            <option value="table_row">Posizione: Riga Tabella</option>
                            <option value="footer_box">Posizione: Nota Fiscale</option>
                          </select>

                          <select
                            value={field.fieldType}
                            onChange={(e) =>
                              handleUpdateDynamicField(field.id, {
                                fieldType: e.target.value as ReceiptDynamicFieldType,
                              })
                            }
                            className="px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] font-semibold text-emerald-800"
                          >
                            <option value="auto_variable">Automatico (Segnaposto)</option>
                            <option value="editable_text">Testo Modificabile</option>
                            <option value="editable_select">Scelta Multipla</option>
                            <option value="editable_date">Data Modificabile</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => handleDeleteDynamicField(field.id)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                            title="Elimina campo dinamico"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-4">
                          <label className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">
                            Etichetta Campo
                          </label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) =>
                              handleUpdateDynamicField(field.id, { label: e.target.value })
                            }
                            className="w-full px-2.5 py-1 rounded border border-slate-200 font-semibold"
                          />
                        </div>
                        <div className="sm:col-span-8">
                          <label className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">
                            Valore Predefinito / Formula Segnaposto (es. {'{{cf_socio}}'},{' '}
                            {'{{anno}}'})
                          </label>
                          <input
                            type="text"
                            value={field.valueTemplate}
                            onChange={(e) =>
                              handleUpdateDynamicField(field.id, {
                                valueTemplate: e.target.value,
                              })
                            }
                            className="w-full px-2.5 py-1 rounded border border-slate-200 font-mono text-[11px]"
                          />
                        </div>
                      </div>

                      {field.fieldType === 'editable_select' && (
                        <div>
                          <label className="block text-[10px] text-slate-400 uppercase font-bold mb-0.5">
                            Opzioni selezionabili (separate da virgola)
                          </label>
                          <input
                            type="text"
                            value={(field.options || []).join(', ')}
                            onChange={(e) =>
                              handleUpdateDynamicField(field.id, {
                                options: e.target.value
                                  .split(',')
                                  .map((o) => o.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="w-full px-2.5 py-1 rounded border border-slate-200 text-[11px]"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Form to create a new Dynamic Field */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-700" />
                    <span>Crea Nuovo Campo Dinamico Personalizzato</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Nome / Etichetta Campo *
                      </label>
                      <input
                        type="text"
                        placeholder="Es. Codice Fiscale Minore / Turno Campo"
                        value={newDynLabel}
                        onChange={(e) => setNewDynLabel(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Formula o Valore Predefinito
                      </label>
                      <input
                        type="text"
                        placeholder="Es. {{cf_socio}} oppure Turno Estivo {{anno}}"
                        value={newDynTemplate}
                        onChange={(e) => setNewDynTemplate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Tipo di Campo Dinamico
                      </label>
                      <select
                        value={newDynType}
                        onChange={(e) =>
                          setNewDynType(e.target.value as ReceiptDynamicFieldType)
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="auto_variable">
                          Variabile Automatica da Anagrafica/Evento
                        </option>
                        <option value="editable_text">
                          Testo Compilabile all&apos;Emissione Ricevuta
                        </option>
                        <option value="editable_select">
                          Menu a Tendina Scelta Rapida all&apos;Emissione
                        </option>
                        <option value="editable_date">Data Selezionabile all&apos;Emissione</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Posizione nel Documento PDF
                      </label>
                      <select
                        value={newDynPosition}
                        onChange={(e) =>
                          setNewDynPosition(e.target.value as ReceiptDynamicFieldPosition)
                        }
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="header_box">Riquadro Intestatario / Socio</option>
                        <option value="table_row">Riga nella Tabella Prestazioni</option>
                        <option value="footer_box">Riquadro Inferiore / Note Fiscali</option>
                      </select>
                    </div>
                  </div>

                  {newDynType === 'editable_select' && (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Elenco Opzioni del Menu a Tendina (separate da virgola)
                      </label>
                      <input
                        type="text"
                        placeholder="Es. Acconto 30%, Saldo Finale, Quota Intera"
                        value={newDynOptionsText}
                        onChange={(e) => setNewDynOptionsText(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddDynamicField}
                      className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Aggiungi Campo Dinamico</span>
                    </button>
                  </div>
                </div>

                {/* Additional Static Custom Lines */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5">
                  <div className="font-bold text-slate-800">
                    Righe Aggiuntive Fisse in Tabella (Opzionali):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {RECEIPT_CUSTOM_LINE_SUGGESTIONS.map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            customLines: [
                              ...prev.customLines,
                              {
                                id: `cl-${Date.now()}-${idx}`,
                                label: sug.label,
                                value: sug.value,
                              },
                            ],
                          }))
                        }
                        className="px-2 py-1 rounded-md bg-slate-100 hover:bg-emerald-50 text-slate-700 border border-slate-200 text-[11px] font-medium flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{sug.label}</span>
                      </button>
                    ))}
                  </div>

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
                        className="w-1/3 px-2.5 py-1 rounded border border-slate-200 font-semibold"
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
                        className="flex-1 px-2.5 py-1 rounded border border-slate-200"
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

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Etichetta riga..."
                      value={newLineLabel}
                      onChange={(e) => setNewLineLabel(e.target.value)}
                      className="w-1/3 px-2.5 py-1 rounded-lg border border-slate-200"
                    />
                    <input
                      type="text"
                      placeholder="Testo o variabile {{...}}"
                      value={newLineValue}
                      onChange={(e) => setNewLineValue(e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomLine}
                      className="px-3 py-1 bg-slate-800 text-white rounded-lg font-semibold"
                    >
                      + Riga
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: TIMBRO ASD & FIRMA PRESIDENTE (OVERLAY PDF CONFIG)      */}
            {/* ============================================================== */}
            {activeSubTab === 'overlays' && (
              <div className="space-y-5">
                {/* 1. TIMBRO UFFICIALE ASD OVERLAY CARD */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-900 text-sm flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.showStamp}
                          onChange={(e) => {
                            const nextCfg = { ...config, showStamp: e.target.checked };
                            setConfig(nextCfg);
                            syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                          }}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        <Stamp className="w-4 h-4 text-emerald-700" />
                        <span>Overlay Timbro dell&apos;ASD sul PDF</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Regola dimensione, rotazione, opacità e coordinate X/Y dell&apos;overlay
                        del Timbro dell&apos;ASD.
                      </p>
                    </div>
                  </div>

                  {/* Overlay Sliders for Stamp */}
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Dimensione / Scala Timbro</span>
                        <span className="font-mono text-emerald-700">
                          {stampOverlay.scalePercent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={170}
                        value={stampOverlay.scalePercent}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            stampOverlay: {
                              ...stampOverlay,
                              scalePercent: Number(e.target.value),
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full accent-emerald-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Rotazione / Inclinazione Timbro</span>
                        <span className="font-mono text-emerald-700">
                          {stampOverlay.rotationDeg}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-25}
                        max={25}
                        value={stampOverlay.rotationDeg}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            stampOverlay: {
                              ...stampOverlay,
                              rotationDeg: Number(e.target.value),
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full accent-emerald-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Opacità Inchiostro Overlay</span>
                        <span className="font-mono text-emerald-700">
                          {Math.round(stampOverlay.opacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={30}
                        max={100}
                        value={Math.round(stampOverlay.opacity * 100)}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            stampOverlay: {
                              ...stampOverlay,
                              opacity: Number(e.target.value) / 100,
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full accent-emerald-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Modalità Posizionamento sul PDF
                      </label>
                      <select
                        value={stampOverlay.overlapMode}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            stampOverlay: {
                              ...stampOverlay,
                              overlapMode: e.target.value as
                                | 'dedicated_box'
                                | 'overlap_signature',
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                      >
                        <option value="overlap_signature">
                          Sovrapposto a Firma / Riquadro Quietanza (Overlay)
                        </option>
                        <option value="dedicated_box">Centrato tra Firma e Quietanza</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Spostamento Orizzontale (Offset X)</span>
                        <span className="font-mono">{stampOverlay.offsetX} px</span>
                      </div>
                      <input
                        type="range"
                        min={-120}
                        max={120}
                        value={stampOverlay.offsetX}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            stampOverlay: {
                              ...stampOverlay,
                              offsetX: Number(e.target.value),
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full accent-emerald-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Spostamento Verticale (Offset Y)</span>
                        <span className="font-mono">{stampOverlay.offsetY} px</span>
                      </div>
                      <input
                        type="range"
                        min={-70}
                        max={70}
                        value={stampOverlay.offsetY}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            stampOverlay: {
                              ...stampOverlay,
                              offsetY: Number(e.target.value),
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. FIRMA DEL PRESIDENTE OVERLAY CARD */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-900 text-sm flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.showSignature}
                          onChange={(e) => {
                            const nextCfg = { ...config, showSignature: e.target.checked };
                            setConfig(nextCfg);
                            syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                          }}
                          className="rounded border-slate-300 text-emerald-600"
                        />
                        <PenTool className="w-4 h-4 text-blue-700" />
                        <span>Overlay Firma del Presidente sul PDF</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Puoi anche disegnare la firma a mano libera sul pad digitale e salvarla in
                        Base64.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDrawingSignature(!isDrawingSignature)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-900 border border-blue-300 rounded-lg font-semibold transition-colors"
                    >
                      <PenTool className="w-3.5 h-3.5 text-blue-700" />
                      <span>Disegna Firma sul Pad</span>
                    </button>
                  </div>

                  {isDrawingSignature && (
                    <div className="p-3 bg-white rounded-xl border border-blue-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-[11px]">
                          Traccia la firma con il mouse o touch:
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={clearDrawingSig}
                            className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded border border-slate-200"
                          >
                            Pulisci
                          </button>
                          <button
                            type="button"
                            onClick={saveDrawnSignature}
                            className="px-3 py-1 bg-blue-700 text-white font-semibold rounded"
                          >
                            Applica Firma Disegnata
                          </button>
                        </div>
                      </div>
                      <canvas
                        ref={sigCanvasRef}
                        width={420}
                        height={130}
                        onMouseDown={startDrawingSig}
                        onMouseMove={moveDrawingSig}
                        onMouseUp={stopDrawingSig}
                        onMouseLeave={stopDrawingSig}
                        className="w-full h-32 border border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-crosshair"
                      />
                    </div>
                  )}

                  {/* Overlay Sliders for Signature */}
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Dimensione / Scala Firma</span>
                        <span className="font-mono text-blue-700">
                          {signatureOverlay.scalePercent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={170}
                        value={signatureOverlay.scalePercent}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            signatureOverlay: {
                              ...signatureOverlay,
                              scalePercent: Number(e.target.value),
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Inclinazione Firma</span>
                        <span className="font-mono text-blue-700">
                          {signatureOverlay.rotationDeg}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min={-20}
                        max={20}
                        value={signatureOverlay.rotationDeg}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            signatureOverlay: {
                              ...signatureOverlay,
                              rotationDeg: Number(e.target.value),
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Spostamento Orizzontale (Offset X)</span>
                        <span className="font-mono">{signatureOverlay.offsetX} px</span>
                      </div>
                      <input
                        type="range"
                        min={-120}
                        max={120}
                        value={signatureOverlay.offsetX}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            signatureOverlay: {
                              ...signatureOverlay,
                              offsetX: Number(e.target.value),
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full accent-blue-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-700 mb-1">
                        <span>Spostamento Verticale (Offset Y)</span>
                        <span className="font-mono">{signatureOverlay.offsetY} px</span>
                      </div>
                      <input
                        type="range"
                        min={-60}
                        max={60}
                        value={signatureOverlay.offsetY}
                        onChange={(e) => {
                          const nextCfg = {
                            ...config,
                            signatureOverlay: {
                              ...signatureOverlay,
                              offsetY: Number(e.target.value),
                            },
                          };
                          setConfig(nextCfg);
                          syncProfileState(stampDataUrl, signatureDataUrl, nextCfg);
                        }}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE INTERACTIVE PDF DOCUMENT PREVIEW WITH OVERLAYS (5 cols on XL) */}
        <div className="xl:col-span-5 space-y-3 sticky top-6">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>Anteprima Live Documento PDF & Overlay</span>
              <span
                id="preview-active-layout-badge"
                className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-semibold text-slate-700"
              >
                Layout: {activeLayoutMeta.name}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
              {(['ricevuta', 'preventivo', 'sollecito'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPreviewDocType(t)}
                  className={`px-2.5 py-1 rounded-md capitalize font-semibold transition-colors ${
                    previewDocType === t
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Simulated A4 Paper Sheet */}
          <div
            id="receipt-live-pdf-sheet"
            data-layout-template={activeLayoutTemplate}
            className={`bg-white rounded-xl shadow-lg p-6 text-slate-900 text-[11px] space-y-4 relative overflow-hidden transition-all ${
              activeLayoutTemplate === 'official'
                ? 'border-4 border-double border-blue-900 font-serif'
                : activeLayoutTemplate === 'minimalist'
                ? 'border border-slate-200 font-sans'
                : 'border-2 border-slate-300 font-sans'
            }`}
          >
            {/* Header ASD - Adapted to activeLayoutTemplate */}
            {activeLayoutTemplate === 'official' ? (
              <div className="text-center border-b-2 border-blue-900 pb-3 space-y-1">
                <div className="text-[9px] font-bold uppercase tracking-widest text-blue-900">
                  {profile.legalType}
                </div>
                <h3 className="text-base font-extrabold uppercase tracking-wide text-slate-900">
                  {profile.name}
                </h3>
                {config.showFiscalCodeAsd && (
                  <p className="text-[10px] text-slate-600">
                    Sede Legale: {profile.address} • Codice Fiscale ASD: <strong>{profile.fiscalCode}</strong>
                  </p>
                )}
                {config.showAffiliation && (
                  <p className="text-[10px] text-blue-950 font-semibold">{profile.affiliation}</p>
                )}
                <div className="pt-2">
                  <div className="bg-blue-900 text-white py-1 px-3 rounded-xs text-[10px] font-bold uppercase tracking-widest flex items-center justify-between">
                    <span>{badgeTitle}</span>
                    <span className="font-mono">
                      Prot. N° {sampleCtx.numero_ricevuta} del {sampleCtx.data}
                    </span>
                  </div>
                </div>
              </div>
            ) : activeLayoutTemplate === 'minimalist' ? (
              <div className="flex justify-between items-baseline border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-slate-900">
                    {profile.name}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {profile.legalType}
                    {config.showFiscalCodeAsd ? ` · C.F. ${profile.fiscalCode}` : ''}
                  </p>
                  {config.showAffiliation && (
                    <p className="text-[9.5px] text-slate-400">{profile.affiliation}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-800 border-b border-slate-900 pb-0.5 inline-block">
                    {badgeTitle}
                  </div>
                  <div className="font-mono text-[10px] text-slate-500 mt-1">
                    #{sampleCtx.numero_ricevuta} · {sampleCtx.data}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold uppercase tracking-tight text-slate-900">
                    {profile.name}
                  </h3>
                  <p className="text-[10px] font-semibold text-emerald-800">{profile.legalType}</p>
                  {config.showFiscalCodeAsd && (
                    <p className="text-[10px] text-slate-600">
                      C.F. {profile.fiscalCode} | {profile.address}
                    </p>
                  )}
                  {config.showAffiliation && (
                    <p className="text-[10px] text-slate-500">{profile.affiliation}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-900 text-white">
                    {badgeTitle}
                  </span>
                  <div className="font-mono text-[10px] text-slate-600 mt-1">
                    N°: <strong>{sampleCtx.numero_ricevuta}</strong>
                  </div>
                  <div className="font-mono text-[10px] text-slate-600">
                    Data: {sampleCtx.data}
                  </div>
                </div>
              </div>
            )}

            {/* Recipient Box + Dynamic Header Fields */}
            <div
              className={`grid grid-cols-2 gap-3 p-3 rounded-lg ${
                activeLayoutTemplate === 'minimalist'
                  ? 'bg-white border-b border-slate-200 rounded-none px-0 py-2'
                  : activeLayoutTemplate === 'official'
                  ? 'bg-blue-50/30 border border-blue-900/30'
                  : 'bg-slate-50 border border-slate-200'
              }`}
            >
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block">
                  Dati Partecipante / Socio:
                </span>
                <div className="font-bold text-slate-900 text-xs">{sampleCtx.socio}</div>
                {config.showMemberAddress && (
                  <div className="text-[10px] text-slate-600">
                    Indirizzo: {sampleCtx.indirizzo_socio}
                  </div>
                )}
                {config.showCardNumberAndInsurance && (
                  <div className="text-[10px] text-slate-600">
                    Tessera: <strong className="font-mono">{sampleCtx.tessera}</strong> (
                    {sampleCtx.assicurazione})
                  </div>
                )}
              </div>
              <div>
                <span className="text-[9px] text-slate-400 uppercase font-bold block">
                  Genitore / Intestatario Quietanza:
                </span>
                <div className="font-bold text-slate-800 text-xs">{sampleCtx.genitore}</div>
                {config.showParentFiscalCode && (
                  <div className="font-mono text-[10px] text-slate-600">
                    C.F.: {sampleCtx.cf_genitore}
                  </div>
                )}
              </div>

              {resolvedHeaderDynamic.length > 0 && (
                <div className="col-span-2 pt-1.5 border-t border-slate-200/80 grid grid-cols-1 gap-1">
                  {resolvedHeaderDynamic.map((df, i) => (
                    <div key={i} className="text-[10px] text-slate-700">
                      <strong className="text-slate-900">{df.label}:</strong> {df.value}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Intro Declaration */}
            {config.showIntroDeclaration !== false && config.introDeclarationText && (
              <div
                className={`text-[10.5px] text-slate-700 leading-relaxed p-2.5 rounded-lg ${
                  activeLayoutTemplate === 'minimalist'
                    ? 'bg-transparent border-l-2 border-slate-300 rounded-none pl-3 py-1 italic'
                    : activeLayoutTemplate === 'official'
                    ? 'bg-slate-50 border border-blue-900/20 font-serif'
                    : 'bg-emerald-50/40 border border-emerald-100'
                }`}
              >
                {resolveDynamicTextPlaceholders(config.introDeclarationText, sampleCtx)}
              </div>
            )}

            {/* Table + Dynamic Table Rows */}
            <table
              className={`w-full border-collapse text-[11px] ${
                activeLayoutTemplate === 'minimalist'
                  ? 'border-y border-slate-300'
                  : activeLayoutTemplate === 'official'
                  ? 'border border-blue-900/40'
                  : 'border border-slate-200'
              }`}
            >
              <thead>
                <tr
                  className={`font-bold uppercase text-[9px] border-b ${
                    activeLayoutTemplate === 'official'
                      ? 'bg-blue-900 text-white border-blue-900'
                      : activeLayoutTemplate === 'minimalist'
                      ? 'bg-white text-slate-500 border-slate-300'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <th className="py-1.5 px-2.5 text-left">Descrizione Prestazione Istituzionale</th>
                  <th className="py-1.5 px-2.5 text-right w-24">Importo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-2 px-2.5">
                    <div className="font-bold text-slate-900">{sampleCtx.attivita}</div>
                    {config.activityDescriptionSubtext && (
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                        {resolveDynamicTextPlaceholders(
                          config.activityDescriptionSubtext,
                          sampleCtx
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900">
                    {formatEuro(Number(sampleCtx.importo))}
                  </td>
                </tr>

                {resolvedTableDynamic.map((row, idx) => (
                  <tr
                    key={`dyn-row-${idx}`}
                    className={activeLayoutTemplate === 'minimalist' ? 'bg-white' : 'bg-slate-50/60'}
                  >
                    <td colSpan={2} className="py-1.5 px-2.5 text-[10px] text-slate-700">
                      <strong className="text-slate-900">{row.label}:</strong> {row.value}
                    </td>
                  </tr>
                ))}

                {config.customLines.map((line) => (
                  <tr
                    key={line.id}
                    className={activeLayoutTemplate === 'minimalist' ? 'bg-white' : 'bg-slate-50/40'}
                  >
                    <td colSpan={2} className="py-1.5 px-2.5 text-[10px] text-slate-700">
                      <strong className="text-slate-900">{line.label}:</strong>{' '}
                      {resolveDynamicTextPlaceholders(line.value, sampleCtx)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  className={`font-bold border-t-2 ${
                    activeLayoutTemplate === 'official'
                      ? 'bg-blue-50/50 border-blue-900'
                      : activeLayoutTemplate === 'minimalist'
                      ? 'bg-white border-slate-900'
                      : 'bg-slate-50 border-slate-900'
                  }`}
                >
                  <td className="py-2 px-2.5 text-right uppercase text-[10px]">
                    Totale {previewDocType === 'ricevuta' ? 'Versato' : 'Previsto'}:
                  </td>
                  <td
                    className={`py-2 px-2.5 text-right font-mono text-sm ${
                      activeLayoutTemplate === 'official'
                        ? 'text-blue-900'
                        : activeLayoutTemplate === 'minimalist'
                        ? 'text-slate-900'
                        : 'text-emerald-800'
                    }`}
                  >
                    {formatEuro(Number(sampleCtx.importo))}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Payment Method & IBAN */}
            {(config.showPaymentMethod || config.showIbanOnReceipt) && (
              <div
                className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded text-[10px] ${
                  activeLayoutTemplate === 'minimalist'
                    ? 'bg-white border-b border-slate-200 rounded-none px-0'
                    : 'bg-slate-50 border border-slate-200'
                }`}
              >
                {config.showPaymentMethod && (
                  <span>
                    <strong>Pagamento:</strong> {sampleCtx.metodo_pagamento}
                  </span>
                )}
                {config.showIbanOnReceipt && profile.iban && (
                  <span className="font-mono">
                    <strong>IBAN:</strong> {profile.iban}
                  </span>
                )}
              </div>
            )}

            {/* Dynamic Footer Fields */}
            {resolvedFooterDynamic.length > 0 && (
              <div className="space-y-1">
                {resolvedFooterDynamic.map((fd, idx) => (
                  <div key={idx} className="text-[10px] text-slate-700">
                    <strong className="text-slate-900">{fd.label}:</strong> {fd.value}
                  </div>
                ))}
              </div>
            )}

            {/* Legal Notice + Official Stamp Duty Box when official */}
            {config.showLegalNotice && config.legalTaxClause && (
              <div className="flex items-start gap-2.5">
                <div
                  className={`flex-1 p-2.5 rounded text-[9.5px] text-slate-500 leading-relaxed ${
                    activeLayoutTemplate === 'minimalist'
                      ? 'bg-white border border-slate-200'
                      : 'bg-slate-50 border border-slate-200'
                  }`}
                >
                  <strong>Nota fiscale ASD:</strong>{' '}
                  {resolveDynamicTextPlaceholders(config.legalTaxClause, sampleCtx)}
                </div>
                {activeLayoutTemplate === 'official' && (
                  <div className="w-28 shrink-0 p-2 border border-dashed border-blue-900/50 bg-blue-50/20 rounded text-center text-[8px] leading-tight text-blue-950 font-sans">
                    <strong className="block uppercase">Spazio Bollo</strong>
                    Esente o € 2,00 se sup. € 77,47
                  </div>
                )}
              </div>
            )}

            {config.footerNotes && (
              <div className="text-[10px] text-slate-500 italic">
                {resolveDynamicTextPlaceholders(config.footerNotes, sampleCtx)}
              </div>
            )}

            {/* Signatures & Official Stamp Overlay Zone */}
            <div className="pt-5 pb-3 border-t border-slate-200 relative min-h-[115px] flex justify-between items-end">
              <div className="space-y-1 z-10">
                <div className="text-[10px] text-slate-500">
                  Il Presidente / Legale Rappresentante:
                </div>
                <strong className="text-slate-900 text-xs block">{profile.president}</strong>
                <div className="h-10" />
              </div>

              {config.showQuietanzaLine && (
                <div className="text-right z-10">
                  <div className="text-[10px] text-slate-500">
                    {previewDocType === 'ricevuta'
                      ? "Per quietanza dell'importo:"
                      : 'Firma per presa visione:'}
                  </div>
                  <div className="h-9 border-b border-dashed border-slate-400 w-36 mt-2" />
                </div>
              )}

              {/* TRUE IMAGE OVERLAY LAYER (SVG Transform & Opacity matching PDF generator) */}
              {(config.showStamp && stampDataUrl) || (config.showSignature && signatureDataUrl) ? (
                <svg
                  viewBox="0 0 520 120"
                  aria-label="Anteprima Overlay Timbro e Firma PDF"
                  className="pointer-events-none select-none absolute inset-0 w-full h-full overflow-visible z-20"
                >
                  {config.showStamp && stampDataUrl && (
                    <g
                      transform={`translate(${
                        (stampOverlay.overlapMode === 'overlap_signature' ? 175 : 260) +
                        stampOverlay.offsetX
                      }, ${68 + stampOverlay.offsetY}) rotate(${stampOverlay.rotationDeg}) scale(${
                        stampOverlay.scalePercent / 100
                      })`}
                      opacity={stampOverlay.opacity}
                    >
                      <foreignObject x={-75} y={-38} width={150} height={76}>
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
                      transform={`translate(${88 + signatureOverlay.offsetX}, ${
                        76 + signatureOverlay.offsetY
                      }) rotate(${signatureOverlay.rotationDeg}) scale(${
                        signatureOverlay.scalePercent / 100
                      })`}
                      opacity={signatureOverlay.opacity}
                    >
                      <foreignObject x={-68} y={-26} width={136} height={52}>
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

          <div className="flex items-center justify-between gap-2 pt-1">
            {onOpenSampleReceiptModal && (
              <button
                type="button"
                onClick={onOpenSampleReceiptModal}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Apri Modale Emissione Ricevuta</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownloadSamplePdf}
              disabled={isExportingPdf}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Scarica Ricevuta PDF con Overlay</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
