import React, { useState, useEffect } from 'react';
import { AssociationProfile, Member } from '../types';
import {
  exportMemberSummaryConsentToPdf,
  generateMemberSummaryConsentPdfBlob,
  resolveDynamicTextPlaceholders,
  resolveEmailTemplates,
  ReceiptPlaceholderContext,
} from '../utils/formAndReceiptTemplates';
import { sendGmailMessageWithAttachment, googleSignIn } from '../services/googleWorkspace';
import {
  Printer,
  Download,
  Mail,
  X,
  CheckCircle2,
  AlertCircle,
  FileSignature,
  Send,
  Save,
  ShieldCheck,
  Camera,
  HeartPulse,
  Sparkles,
} from 'lucide-react';

interface MemberDataConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  profile: AssociationProfile;
  onUpdateMember: (updated: Member) => void;
  onUpdateProfile?: (updated: AssociationProfile) => void;
}

export const MemberDataConsentModal: React.FC<MemberDataConsentModalProps> = ({
  isOpen,
  onClose,
  member,
  profile,
  onUpdateMember,
  onUpdateProfile,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [rawSubjectTemplate, setRawSubjectTemplate] = useState('');
  const [rawBodyTemplate, setRawBodyTemplate] = useState('');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [templateSavedMsg, setTemplateSavedMsg] = useState(false);

  const docDate = new Date().toLocaleDateString('it-IT');

  const placeholderCtx: ReceiptPlaceholderContext = {
    socio: member?.childName || 'Socio Tesserato',
    genitore: member?.parentName || 'Genitore / Tutore',
    cf_genitore: member?.parentFiscalCode || 'Registrato agli atti',
    cf_socio: member?.childFiscalCode || 'Registrato agli atti',
    indirizzo_socio: member?.childAddress || '-',
    tessera: member?.membershipCardNumber || 'In assegnazione',
    scadenza_tessera: member?.expiryDate || `31/12/${profile.activeYear}`,
    assicurazione: member?.insuranceType || 'Gold',
    attivita: `Tesseramento Annuale ${profile.activeYear}`,
    importo: '€ 0,00',
    data: docDate,
    anno: profile.activeYear,
    asd_nome: profile.name,
    asd_cf: profile.fiscalCode,
    asd_iban: profile.iban,
    asd_affiliazione: profile.affiliation,
    presidente: profile.president,
  };

  useEffect(() => {
    if (!member || !isOpen) return;
    const templates = resolveEmailTemplates(profile);
    const tpl = templates.modulo_iscrizione_da_firmare;
    setRecipientEmail(member.parentEmail || '');
    setRawSubjectTemplate(tpl.subjectTemplate);
    setRawBodyTemplate(tpl.bodyTemplate);
    setEmailSubject(resolveDynamicTextPlaceholders(tpl.subjectTemplate, placeholderCtx));
    setEmailBody(resolveDynamicTextPlaceholders(tpl.bodyTemplate, placeholderCtx));
    setEmailFeedback(null);
    setShowEmailPanel(false);
    setIsEditingTemplate(false);
  }, [member?.id, isOpen]);

  if (!isOpen || !member) return null;

  const safeName = member.childName.replace(/\s+/g, '_');
  const attachmentFileName = `Riepilogo_Dati_e_Consensi_${safeName}_${profile.activeYear}.pdf`;

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      await exportMemberSummaryConsentToPdf({
        member,
        profile,
        docDate,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleToggleSignedStatus = () => {
    onUpdateMember({
      ...member,
      formSignedAndArchived: !member.formSignedAndArchived,
    });
  };

  const handleSaveTemplateDefault = () => {
    if (!onUpdateProfile) return;
    const currentTemplates = resolveEmailTemplates(profile);
    const updatedTemplates = {
      ...currentTemplates,
      modulo_iscrizione_da_firmare: {
        ...currentTemplates.modulo_iscrizione_da_firmare,
        subjectTemplate: rawSubjectTemplate,
        bodyTemplate: rawBodyTemplate,
      },
    };
    onUpdateProfile({
      ...profile,
      emailTemplates: updatedTemplates,
    });
    setEmailSubject(resolveDynamicTextPlaceholders(rawSubjectTemplate, placeholderCtx));
    setEmailBody(resolveDynamicTextPlaceholders(rawBodyTemplate, placeholderCtx));
    setIsEditingTemplate(false);
    setTemplateSavedMsg(true);
    setTimeout(() => setTemplateSavedMsg(false), 3000);
  };

  const handleConfirmSendGmail = async () => {
    if (!recipientEmail.trim() || !recipientEmail.includes('@')) {
      setEmailFeedback({
        type: 'error',
        message: 'Inserisci un indirizzo email valido per il genitore/socio.',
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailFeedback(null);
    try {
      const pdfBlob = await generateMemberSummaryConsentPdfBlob({
        member,
        profile,
        docDate,
      });

      try {
        await sendGmailMessageWithAttachment({
          to: recipientEmail.trim(),
          subject: emailSubject.trim(),
          bodyText: emailBody,
          attachmentFileName,
          attachmentPdfBlob: pdfBlob,
        });
      } catch (err: any) {
        if (err?.message === 'AUTH_REQUIRED') {
          await googleSignIn();
          await sendGmailMessageWithAttachment({
            to: recipientEmail.trim(),
            subject: emailSubject.trim(),
            bodyText: emailBody,
            attachmentFileName,
            attachmentPdfBlob: pdfBlob,
          });
        } else {
          throw err;
        }
      }

      const nowStr = new Date().toLocaleDateString('it-IT');
      onUpdateMember({
        ...member,
        parentEmail: recipientEmail.trim() || member.parentEmail,
        signedFormSentAt: nowStr,
      });

      setEmailFeedback({
        type: 'success',
        message: `Email inviata con successo tramite Gmail a ${recipientEmail.trim()} con allegato "${attachmentFileName}"!`,
      });
    } catch (error: any) {
      setEmailFeedback({
        type: 'error',
        message:
          error?.message ||
          'Impossibile inviare l\'email tramite Gmail. Verifica di aver effettuato l\'accesso a Google Workspace.',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-auto max-h-[94vh] flex flex-col print:shadow-none print:border-none print:max-w-none print:max-h-none">
        {/* Top Action Bar (Hidden on print) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 print:hidden shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                Riepilogo Dati Socio, Consenso Foto & Privacy da Firmare
              </h3>
              <p className="text-[11px] text-slate-400">
                Socio: <strong className="text-white">{member.childName}</strong> — Genitore:{' '}
                <strong className="text-slate-200">{member.parentName || '-'}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSignedStatus}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                member.formSignedAndArchived
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
                  : 'bg-amber-950/80 text-amber-300 border-amber-600 hover:bg-amber-900'
              }`}
              title="Segna se il modulo firmato dal genitore è stato ricevuto e archiviato"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {member.formSignedAndArchived
                  ? 'Modulo Firmato & Archiviato'
                  : 'Segna come Firmato'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Generazione PDF...' : 'Scarica PDF da Firmare'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Stampa</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEmailPanel(!showEmailPanel)}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm ${
                showEmailPanel
                  ? 'bg-blue-500 text-white ring-2 ring-blue-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Invia con Gmail da Firmare</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 divide-y divide-slate-200">
          {/* GMAIL CONFIRMATION & TEMPLATE COMPOSER PANEL (Hidden on print) */}
          {showEmailPanel && (
            <div className="p-5 bg-blue-50/80 border-b border-blue-200 print:hidden space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-blue-950 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-blue-600" />
                    <span>
                      Invio Riepilogo Dati da Controfirmare tramite Gmail (con PDF Allegato)
                    </span>
                  </h4>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Il sistema genererà e allegherà automaticamente il PDF{' '}
                    <strong className="font-mono">{attachmentFileName}</strong> pronto per la firma
                    del genitore.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                    className="text-xs font-semibold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1.5 rounded-lg border border-blue-200 shadow-xs"
                  >
                    {isEditingTemplate
                      ? "Torna all'Anteprima Compilata"
                      : 'Modifica Modello Predefinito {{...}}'}
                  </button>
                </div>
              </div>

              {templateSavedMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Modello email salvato! Verrà usato automaticamente per i prossimi soci.
                  </span>
                </div>
              )}

              {emailFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2.5 ${
                    emailFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  {emailFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">{emailFeedback.message}</div>
                </div>
              )}

              {isEditingTemplate ? (
                <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      Modello Riutilizzabile con Variabili Dinamiche
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Variabili: {'{{socio}}'}, {'{{genitore}}'}, {'{{tessera}}'}, {'{{anno}}'},{' '}
                      {'{{asd_nome}}'}, {'{{presidente}}'}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Oggetto Modello Predefinito
                    </label>
                    <input
                      type="text"
                      value={rawSubjectTemplate}
                      onChange={(e) => setRawSubjectTemplate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Testo Modello Predefinito
                    </label>
                    <textarea
                      rows={7}
                      value={rawBodyTemplate}
                      onChange={(e) => setRawBodyTemplate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingTemplate(false)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                    >
                      Annulla
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTemplateDefault}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Salva Modello per Tutti i Soci</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl border border-blue-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Email Destinatario (Genitore / Socio) *
                      </label>
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="es. genitore@email.it"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Allegato Automatico PDF A4
                      </label>
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 flex items-center justify-between">
                        <span className="truncate">{attachmentFileName}</span>
                        <span className="text-[10px] font-sans font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 ml-2 shrink-0">
                          PDF Allegato
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Oggetto Email (modificabile prima dell'invio)
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Messaggio Email (personalizzabile per questo socio)
                    </label>
                    <textarea
                      rows={6}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500">
                      {member.signedFormSentAt
                        ? `Ultimo invio modulo registrato il: ${member.signedFormSentAt}`
                        : "Conferma i dati qui sopra prima di inviare tramite l'account Gmail dell'associazione."}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowEmailPanel(false)}
                        className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                      >
                        Annulla
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmSendGmail}
                        disabled={isSendingEmail}
                        className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isSendingEmail
                            ? 'Invio in corso tramite Gmail...'
                            : 'Conferma e Invia Email con PDF'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PRINTABLE A4 DOCUMENT PREVIEW */}
          <div className="p-6 sm:p-10 bg-white text-slate-900 space-y-6">
            {/* Institutional Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase text-slate-900">
                  {profile.name}
                </h1>
                <p className="text-xs font-semibold text-emerald-800">
                  {profile.legalType} — {profile.affiliation}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  C.F. {profile.fiscalCode} — Sede: {profile.address}
                </p>
              </div>
              <div className="sm:text-right">
                <span className="inline-block bg-slate-900 text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded">
                  Anno Sportivo {profile.activeYear}
                </span>
                <p className="text-xs font-mono text-slate-600 mt-1.5">
                  Tessera N°:{' '}
                  <strong className="text-slate-900">
                    {member.membershipCardNumber || 'In assegnazione'}
                  </strong>
                </p>
                <p className="text-[11px] font-mono text-slate-500">Data scheda: {docDate}</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white text-center py-2 px-4 rounded-lg">
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                Modulo Riepilogo Dati Socio, Domanda di Ammissione e Consensi (Da Controfirmare)
              </h2>
            </div>

            {/* 1. Dati Socio Minore */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  1. Dati Anagrafici del Socio / Partecipante (Minore)
                </span>
                <span className="text-xs font-mono font-bold text-emerald-800">
                  Gruppo: {member.group} anni
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 text-xs">
                <div className="p-3 space-y-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Cognome e Nome Partecipante
                    </span>
                    <span className="font-bold text-sm text-slate-900">{member.childName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Codice Fiscale Partecipante
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {member.childFiscalCode || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Indirizzo di Residenza
                    </span>
                    <span className="text-slate-800">{member.childAddress || '-'}</span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Data e Luogo di Nascita
                    </span>
                    <span className="font-semibold text-slate-800">
                      {member.birthDate || '-'} ({member.birthPlace || '-'})
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Copertura Assicurativa & Formula Tessera
                    </span>
                    <span className="font-semibold text-slate-800">
                      Polizza {member.insuranceType} (
                      {member.cardValidityType === 'tessera_365'
                        ? 'Tessera 365 - 12 mesi'
                        : 'Ordinaria Solare 31/12'}
                      )
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Validità Tesseramento
                    </span>
                    <span className="font-mono text-slate-800">
                      Emissione: {member.cardIssueDate || '-'} — Scadenza: {member.expiryDate || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Dati Genitore / Tutore */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  2. Dati del Genitore / Tutore Esercente la Responsabilità Genitoriale
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 text-xs">
                <div className="p-3 space-y-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Cognome e Nome Genitore / Tutore
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      {member.parentName || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Recapito Telefonico / Emergenze
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {member.parentPhone || '-'}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Codice Fiscale Genitore (Intestatario Ricevute / Detrazione 19%)
                    </span>
                    <span className="font-mono font-semibold text-slate-800">
                      {member.parentFiscalCode || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Email per Comunicazioni Ufficiali e Ricevute
                    </span>
                    <span className="text-slate-800">{member.parentEmail || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Scheda Medica, Allergie e Bisogni Speciali */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-rose-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  3. Scheda Sanitaria, Allergie, Intolleranze e Note Organizzative / BES
                </span>
              </div>
              <div className="p-3.5 space-y-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Allergie Alimentari / Farmaci / Intolleranze Dichiarate
                  </span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {member.allergies && member.allergies.trim()
                      ? member.allergies
                      : 'Nessuna allergia o intolleranza segnalata'}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Note Mediche, Farmaci al Bisogno, BES o Deleghe Ritiro
                  </span>
                  <p className="font-semibold text-slate-900 mt-0.5">
                    {member.notesConditions && member.notesConditions.trim()
                      ? member.notesConditions
                      : 'Nessuna nota particolare segnalata'}
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Domanda di Ammissione, Statuto e Consenso Privacy GDPR */}
            <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50/60">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  4. Domanda di Ammissione a Socio, Statuto e Trattamento Dati Personali (GDPR)
                </span>
              </div>
              <div className="p-4 space-y-4 text-xs leading-relaxed text-slate-700">
                <p>
                  Il/La sottoscritto/a{' '}
                  <strong className="text-slate-900">
                    {member.parentName || '________________________'}
                  </strong>
                  , in qualità di genitore/tutore esercente la responsabilità genitoriale sul minore{' '}
                  <strong className="text-slate-900">{member.childName}</strong>,{' '}
                  <strong>CONFERMA l'esattezza di tutti i dati sopra riportati</strong> e chiede
                  l'iscrizione/rinnovo del minore quale Socio di{' '}
                  <strong className="text-slate-900">{profile.name}</strong> ({profile.affiliation})
                  per l'anno sportivo {profile.activeYear}, dichiarando di aver preso visione e di
                  accettare lo Statuto sociale, i regolamenti interni e le condizioni della polizza
                  assicurativa scelta ({member.insuranceType}). Ai sensi degli artt. 13 e 14 del
                  Regolamento UE 2016/679 (GDPR), presta il consenso al trattamento dei dati
                  personali e particolari/sanitari indicati al punto 3 per le finalità
                  istituzionali, sportive, assicurative e di sicurezza dell'Associazione.
                </p>
                <div className="pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-slate-200">
                  <div className="text-xs text-slate-600">
                    Luogo e Data: ________________________, <strong>{docDate}</strong>
                  </div>
                  <div className="sm:text-right">
                    <span className="block text-[10px] font-bold uppercase text-slate-500 mb-5">
                      Firma del Genitore / Tutore (Obbligatoria per Iscrizione e Privacy GDPR)
                    </span>
                    <div className="w-64 border-b-2 border-slate-800 ml-auto" />
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Consenso Foto e Video */}
            <div className="border border-slate-300 rounded-xl overflow-hidden bg-slate-50/60">
              <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  5. Liberatoria e Consenso Utilizzo Foto e Video Attività Istituzionali
                </span>
              </div>
              <div className="p-4 space-y-4 text-xs leading-relaxed text-slate-700">
                <p>
                  Ai sensi dell'art. 96 L. 633/1941 e del Regolamento UE 2016/679, in merito alla
                  realizzazione e utilizzo a titolo gratuito di fotografie e riprese video ritraenti
                  il/la minore durante le attività educative, escursionistiche e sportive di{' '}
                  <strong>{profile.name}</strong> per finalità documentative e promozionali
                  istituzionali:
                </p>

                <div className="flex flex-wrap items-center gap-6 py-1 font-bold text-slate-900">
                  <label className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 border-2 rounded font-mono text-xs ${
                        member.photoConsent
                          ? 'border-emerald-700 bg-emerald-100 text-emerald-900'
                          : 'border-slate-400 bg-white'
                      }`}
                    >
                      {member.photoConsent ? 'X' : ''}
                    </span>
                    <span className={member.photoConsent ? 'text-emerald-800' : 'text-slate-600'}>
                      PRESTA IL CONSENSO (Autorizza Foto/Video)
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 border-2 rounded font-mono text-xs ${
                        !member.photoConsent
                          ? 'border-rose-700 bg-rose-100 text-rose-900'
                          : 'border-slate-400 bg-white'
                      }`}
                    >
                      {!member.photoConsent ? 'X' : ''}
                    </span>
                    <span className={!member.photoConsent ? 'text-rose-800' : 'text-slate-600'}>
                      NEGA IL CONSENSO (Non Autorizza Foto/Video)
                    </span>
                  </label>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-t border-slate-200">
                  <div className="text-[11px] text-slate-500 italic">
                    Da restituire firmato in Segreteria o via email in risposta alla presente.
                  </div>
                  <div className="sm:text-right">
                    <span className="block text-[10px] font-bold uppercase text-slate-500 mb-5">
                      Firma del Genitore / Tutore per Liberatoria Foto/Video
                    </span>
                    <div className="w-64 border-b-2 border-slate-800 ml-auto" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
