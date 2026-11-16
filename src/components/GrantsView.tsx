import React, { useState } from 'react';
import {
  Award,
  Plus,
  Calendar,
  Clock,
  FileText,
  Phone,
  Info,
  Upload,
  ExternalLink,
  Trash2,
  Edit3,
  HardDrive,
  FolderOpen,
} from 'lucide-react';
import { GrantItem, GrantStatus, GrantDocument } from '../types';
import { formatEuro } from '../utils/finance';
import { parseAnyDate, diffDays } from '../utils/notifications';
import {
  uploadFileToDrive,
  getOrCreateDriveCategoryFolder,
  DRIVE_ROOT_FOLDER_NAME,
  DRIVE_CATEGORY_FOLDERS,
} from '../services/googleWorkspace';

interface GrantsViewProps {
  grants: GrantItem[];
  googleUserEmail: string | null;
  onAddGrant: (grant: Omit<GrantItem, 'id'>) => void;
  onUpdateGrant: (grant: GrantItem) => void;
  onDeleteGrant: (id: string) => void;
}

export const GrantsView: React.FC<GrantsViewProps> = ({
  grants,
  googleUserEmail,
  onAddGrant,
  onUpdateGrant,
  onDeleteGrant,
}) => {
  const [selectedGrantId, setSelectedGrantId] = useState<string>(grants[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [bannerMsg, setBannerMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
    linkUrl?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Add / Edit Bando Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGrant, setEditingGrant] = useState<GrantItem | null>(null);
  const [title, setTitle] = useState('');
  const [promoter, setPromoter] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('2027-05-31');
  const [reportingDeadline, setReportingDeadline] = useState('2027-12-15');
  const [status, setStatus] = useState<GrantStatus>('in_preparazione');
  const [requestedAmount, setRequestedAmount] = useState('5000');
  const [approvedAmount, setApprovedAmount] = useState('0');
  const [keyCharacteristics, setKeyCharacteristics] = useState('');
  const [usefulContacts, setUsefulContacts] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Manual document reference form inside detail card
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] =
    useState<GrantDocument['category']>('bando_avviso');
  const [newDocNotes, setNewDocNotes] = useState('');

  const filteredGrants = grants.filter((g) =>
    statusFilter === 'ALL' ? true : g.status === statusFilter
  );

  const activeGrant =
    grants.find((g) => g.id === selectedGrantId) || filteredGrants[0] || grants[0] || null;

  const totalRequested = grants.reduce((sum, g) => sum + (g.requestedAmount || 0), 0);
  const totalApproved = grants.reduce((sum, g) => sum + (g.approvedAmount || 0), 0);

  const openCreateModal = () => {
    setEditingGrant(null);
    setTitle('');
    setPromoter('');
    setSubmissionDeadline('2027-05-31');
    setReportingDeadline('2027-12-15');
    setStatus('in_preparazione');
    setRequestedAmount('5000');
    setApprovedAmount('0');
    setKeyCharacteristics('');
    setUsefulContacts('');
    setPortalUrl('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (grant: GrantItem) => {
    setEditingGrant(grant);
    setTitle(grant.title);
    setPromoter(grant.promoter);
    setSubmissionDeadline(grant.submissionDeadline);
    setReportingDeadline(grant.reportingDeadline);
    setStatus(grant.status);
    setRequestedAmount(String(grant.requestedAmount || 0));
    setApprovedAmount(String(grant.approvedAmount || 0));
    setKeyCharacteristics(grant.keyCharacteristics);
    setUsefulContacts(grant.usefulContacts);
    setPortalUrl(grant.portalUrl || '');
    setNotes(grant.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const reqVal = parseFloat(requestedAmount.replace(',', '.')) || 0;
    const appVal = parseFloat(approvedAmount.replace(',', '.')) || 0;

    if (editingGrant) {
      onUpdateGrant({
        ...editingGrant,
        title: title.trim(),
        promoter: promoter.trim(),
        submissionDeadline,
        reportingDeadline,
        status,
        requestedAmount: reqVal,
        approvedAmount: appVal,
        keyCharacteristics: keyCharacteristics.trim(),
        usefulContacts: usefulContacts.trim(),
        portalUrl: portalUrl.trim(),
        notes: notes.trim(),
      });
      setBannerMsg({
        type: 'ok',
        text: `Bando "${title.trim()}" aggiornato con successo.`,
      });
    } else {
      onAddGrant({
        title: title.trim(),
        promoter: promoter.trim(),
        submissionDeadline,
        reportingDeadline,
        status,
        requestedAmount: reqVal,
        approvedAmount: appVal,
        keyCharacteristics: keyCharacteristics.trim(),
        usefulContacts: usefulContacts.trim(),
        portalUrl: portalUrl.trim(),
        documents: [],
        notes: notes.trim(),
      });
      setBannerMsg({
        type: 'ok',
        text: `Nuovo bando "${title.trim()}" aggiunto in archivio.`,
      });
    }
    setIsModalOpen(false);
  };

  const handleAddDocumentReference = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGrant || !newDocName.trim()) return;

    const newDoc: GrantDocument = {
      id: `gdoc-${Date.now()}`,
      name: newDocName.trim(),
      category: newDocCategory,
      uploadedAt: new Date().toISOString().slice(0, 10),
      notes: newDocNotes.trim(),
    };

    onUpdateGrant({
      ...activeGrant,
      documents: [...(activeGrant.documents || []), newDoc],
    });
    setNewDocName('');
    setNewDocNotes('');
  };

  const handleUploadGrantDocumentToDrive = async (
    e: React.ChangeEvent<HTMLInputElement>,
    grant: GrantItem
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!googleUserEmail) {
      // If not connected to Google Drive yet, still register the document in the Bando card
      const newDoc: GrantDocument = {
        id: `gdoc-${Date.now()}`,
        name: file.name,
        category: newDocCategory,
        uploadedAt: new Date().toISOString().slice(0, 10),
        notes: newDocNotes.trim() || 'Registrato localmente (connetti Google Drive per cloud)',
      };
      onUpdateGrant({
        ...grant,
        documents: [...(grant.documents || []), newDoc],
      });
      setBannerMsg({
        type: 'ok',
        text: `Documento "${file.name}" allegato alla scheda del bando. Connetti Google Drive per salvarlo anche nella cartella "${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.bandi_progetti.folderName}".`,
      });
      e.target.value = '';
      return;
    }

    const ok = confirm(
      `Vuoi caricare il documento "${file.name}" su Google Drive nella cartella "${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.bandi_progetti.folderName}" e collegarlo al bando "${grant.title}"?`
    );
    if (!ok) {
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setBannerMsg(null);
    try {
      const uploaded = await uploadFileToDrive({
        name: `${grant.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 25)}_${file.name}`,
        content: file,
        mimeType: file.type || 'application/octet-stream',
        category: 'bandi_progetti',
      });

      const newDoc: GrantDocument = {
        id: `gdoc-${Date.now()}`,
        name: file.name,
        category: newDocCategory,
        uploadedAt: new Date().toISOString().slice(0, 10),
        driveFileId: uploaded.id,
        driveFileUrl: uploaded.webViewLink,
        notes: newDocNotes.trim() || 'Archiviato su Google Drive (05_Bandi_e_Progetti)',
      };

      onUpdateGrant({
        ...grant,
        documents: [...(grant.documents || []), newDoc],
      });

      setBannerMsg({
        type: 'ok',
        text: `Documento "${file.name}" salvato in Google Drive ("${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.bandi_progetti.folderName}")!`,
        linkUrl: uploaded.webViewLink,
      });
    } catch (err: any) {
      setBannerMsg({
        type: 'err',
        text: err?.message || 'Errore durante il caricamento del documento su Google Drive.',
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveBandoSummaryToDrive = async (grant: GrantItem) => {
    if (!googleUserEmail) {
      setBannerMsg({
        type: 'err',
        text: 'Connetti il tuo account Google per salvare la scheda riepilogativa del bando nella cartella Google Drive "Gestionale ASD / 05_Bandi_e_Progetti".',
      });
      return;
    }

    const ok = confirm(
      `Confermi il salvataggio della Scheda Riepilogativa di "${grant.title}" nella cartella Google Drive "${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.bandi_progetti.folderName}"?`
    );
    if (!ok) return;

    setIsUploading(true);
    try {
      const { categoryFolder } = await getOrCreateDriveCategoryFolder('bandi_progetti');
      const content = [
        `SCHEDA TECNICA BANDO E FINANZIAMENTO — APUACAMP A.S.D.`,
        `====================================================================`,
        `Titolo Bando: ${grant.title}`,
        `Ente Erogatore / Promotore: ${grant.promoter}`,
        `Stato Pratica: ${grant.status.toUpperCase()}`,
        `Scadenza Presentazione Domanda: ${grant.submissionDeadline}`,
        `Scadenza Rendicontazione Finale: ${grant.reportingDeadline}`,
        `Importo Richiesto: € ${grant.requestedAmount.toFixed(2)}`,
        `Importo Approvato / Concesso: € ${grant.approvedAmount.toFixed(2)}`,
        `Link Portale: ${grant.portalUrl || 'N/D'}`,
        `--------------------------------------------------------------------`,
        `CARATTERISTICHE FONDAMENTALI DEL BANDO:`,
        grant.keyCharacteristics || '-',
        `--------------------------------------------------------------------`,
        `CONTATTI UTILI (RUP, UFFICIO BANDI, REFERENTI):`,
        grant.usefulContacts || '-',
        `--------------------------------------------------------------------`,
        `DOCUMENTAZIONE ALLEGATA (${grant.documents.length} file):`,
        ...grant.documents.map(
          (d, idx) =>
            `${idx + 1}. [${d.category}] ${d.name} (${d.uploadedAt}) ${
              d.driveFileUrl ? `-> ${d.driveFileUrl}` : ''
            }`
        ),
        `--------------------------------------------------------------------`,
        `NOTE OPERATIVE:`,
        grant.notes || '-',
      ].join('\n');

      const uploaded = await uploadFileToDrive({
        name: `Scheda_Bando_${grant.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 35)}.txt`,
        content,
        mimeType: 'text/plain',
        folderId: categoryFolder.id,
      });

      setBannerMsg({
        type: 'ok',
        text: `Scheda del bando salvata in Google Drive ("${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.bandi_progetti.folderName}")!`,
        linkUrl: uploaded.webViewLink || categoryFolder.webViewLink,
      });
    } catch (err: any) {
      setBannerMsg({
        type: 'err',
        text: err?.message || 'Errore nel salvataggio su Google Drive.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (s: GrantStatus) => {
    switch (s) {
      case 'approvato_finanziato':
        return {
          label: 'Approvato & Finanziato',
          cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      case 'in_rendicontazione':
        return {
          label: 'In Rendicontazione',
          cls: 'bg-purple-50 text-purple-800 border-purple-200',
        };
      case 'presentato':
        return {
          label: 'Domanda Presentata',
          cls: 'bg-blue-50 text-blue-800 border-blue-200',
        };
      case 'in_preparazione':
        return {
          label: 'In Preparazione',
          cls: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'chiuso_rendicontato':
        return {
          label: 'Chiuso & Rendicontato ✓',
          cls: 'bg-slate-100 text-slate-700 border-slate-200',
        };
      case 'non_ammesso':
        return {
          label: 'Non Ammesso',
          cls: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      default:
        return {
          label: 'In Valutazione',
          cls: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const getDocCategoryLabel = (cat: GrantDocument['category']) => {
    switch (cat) {
      case 'bando_avviso':
        return 'Avviso / Testo Bando';
      case 'domanda_progetto':
        return 'Formulario / Progetto';
      case 'allegato_tecnico':
        return 'Allegato / Statuto / Verbale';
      case 'rendicontazione_fatture':
        return 'Rendicontazione / Fatture';
      default:
        return 'Altro Documento';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & KPI Strip */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              Gestione Bandi, Contributi Pubblici & Rendicontazioni ASD
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Cartella Drive: {DRIVE_ROOT_FOLDER_NAME} / {DRIVE_CATEGORY_FOLDERS.bandi_progetti.folderName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Traccia scadenze di presentazione, scadenze di rendicontazione, caratteristiche
            fondamentali, contatti RUP e documentazione archiviata su Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
          >
            <option value="ALL">Tutti i Bandi ({grants.length})</option>
            <option value="in_valutazione">In Valutazione</option>
            <option value="in_preparazione">In Preparazione</option>
            <option value="presentato">Domanda Presentata</option>
            <option value="approvato_finanziato">Approvato & Finanziato</option>
            <option value="in_rendicontazione">In Rendicontazione</option>
            <option value="chiuso_rendicontato">Chiuso & Rendicontato</option>
          </select>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nuovo Bando</span>
          </button>
        </div>
      </div>

      {bannerMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            bannerMsg.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-950'
          }`}
        >
          <span className="font-medium">{bannerMsg.text}</span>
          <div className="flex items-center gap-3 shrink-0">
            {bannerMsg.linkUrl && (
              <a
                href={bannerMsg.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-bold underline"
              >
                <span>Apri in Google Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={() => setBannerMsg(null)} className="font-bold px-1">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">Bandi Censiti</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1">
            {grants.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Attivi: {grants.filter((g) => g.status !== 'chiuso_rendicontato' && g.status !== 'non_ammesso').length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">Totale Contributi Richiesti</div>
          <div className="text-2xl font-bold text-blue-800 font-mono mt-1 tabular-nums">
            {formatEuro(totalRequested)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Valore complessivo domande</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">Contributi Approvati / Vinti</div>
          <div className="text-2xl font-bold text-emerald-700 font-mono mt-1 tabular-nums">
            {formatEuro(totalApproved)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Fondi assegnati all'ASD</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-500 font-medium">Documenti Bando Archiviati</div>
          <div className="text-2xl font-bold text-purple-800 font-mono mt-1">
            {grants.reduce((sum, g) => sum + (g.documents?.length || 0), 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <FolderOpen className="w-3 h-3 text-emerald-600" />
            <span>05_Bandi_e_Progetti</span>
          </div>
        </div>
      </div>

      {/* Main Layout: Left List of Bandi + Right Full Detail & Documentation Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Bandi List */}
        <div className="lg:col-span-5 space-y-3">
          {filteredGrants.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
              <div className="text-sm font-bold text-slate-800">Nessun bando presente</div>
              <p className="text-xs text-slate-500">
                Clicca su "Nuovo Bando" in alto a destra per inserire un bando pubblico, le
                scadenze di presentazione e rendicontazione, i contatti e la documentazione.
              </p>
            </div>
          ) : (
            filteredGrants.map((g) => {
              const isSelected = activeGrant?.id === g.id;
              const badge = getStatusBadge(g.status);
              const subDate = parseAnyDate(g.submissionDeadline);
              const repDate = parseAnyDate(g.reportingDeadline);
              const daysSub = subDate ? diffDays(subDate) : 999;
              const daysRep = repDate ? diffDays(repDate) : 999;

              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGrantId(g.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/40 border-emerald-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-semibold border ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1.5 leading-snug">
                        {g.title}
                      </h4>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">{g.promoter}</div>
                    </div>
                    <div className="text-right font-mono shrink-0">
                      <div className="text-xs font-bold text-slate-900">
                        {formatEuro(g.requestedAmount)}
                      </div>
                      {g.approvedAmount > 0 && (
                        <div className="text-[10px] font-semibold text-emerald-700">
                          Appr: {formatEuro(g.approvedAmount)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <div>
                        <div className="text-[9px] uppercase text-slate-400 font-sans font-semibold">
                          Scad. Presentazione
                        </div>
                        <span className={daysSub <= 14 && daysSub >= 0 ? 'text-rose-700 font-bold' : ''}>
                          {g.submissionDeadline || '-'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <div>
                        <div className="text-[9px] uppercase text-slate-400 font-sans font-semibold">
                          Scad. Rendicontazione
                        </div>
                        <span className={daysRep <= 20 && daysRep >= 0 ? 'text-rose-700 font-bold' : ''}>
                          {g.reportingDeadline || '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Detailed Bando View */}
        <div className="lg:col-span-7">
          {!activeGrant ? (
            <div className="bg-white p-10 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
              Seleziona un bando a sinistra o creane uno nuovo per visualizzare i dettagli.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-5 p-6">
              {/* Header & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        getStatusBadge(activeGrant.status).cls
                      }`}
                    >
                      {getStatusBadge(activeGrant.status).label}
                    </span>
                    <span className="text-xs text-slate-500 font-semibold">
                      {activeGrant.promoter}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1.5">{activeGrant.title}</h3>
                  {activeGrant.portalUrl && (
                    <a
                      href={activeGrant.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold hover:underline mt-1"
                    >
                      <span>Apri Portale Ufficiale del Bando</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleSaveBandoSummaryToDrive(activeGrant)}
                    disabled={isUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    title="Salva la scheda tecnica del bando in Google Drive -> Gestionale ASD / 05_Bandi_e_Progetti"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Salva Scheda su Drive</span>
                  </button>
                  <button
                    onClick={() => openEditModal(activeGrant)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modifica</span>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Vuoi eliminare definitivamente il bando "${activeGrant.title}"?`)) {
                        onDeleteGrant(activeGrant.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Elimina Bando"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Deadlines & Amounts Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200">
                  <div className="text-[10px] uppercase font-bold text-amber-800">
                    Scadenza Presentazione
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    {activeGrant.submissionDeadline || 'N/D'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-purple-50/60 border border-purple-200">
                  <div className="text-[10px] uppercase font-bold text-purple-800">
                    Scadenza Rendicontazione
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    {activeGrant.reportingDeadline || 'N/D'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">
                    Importo Richiesto
                  </div>
                  <div className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    {formatEuro(activeGrant.requestedAmount)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
                  <div className="text-[10px] uppercase font-bold text-emerald-800">
                    Contributo Concesso
                  </div>
                  <div className="font-mono font-bold text-emerald-800 text-sm mt-0.5">
                    {formatEuro(activeGrant.approvedAmount)}
                  </div>
                </div>
              </div>

              {/* Caratteristiche Fondamentali del Bando */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-emerald-600" />
                  <span>Caratteristiche Fondamentali del Bando & Spese Ammissibili</span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {activeGrant.keyCharacteristics ||
                    'Nessuna caratteristica inserita. Clicca su "Modifica" per dettagliare requisiti, percentuale a fondo perduto e spese ammissibili.'}
                </p>
              </div>

              {/* Contatti Utili */}
              <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200 space-y-1.5">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <span>Contatti Utili (RUP, Ufficio Bandi, Email, Telefono)</span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {activeGrant.usefulContacts || 'Nessun contatto registrato.'}
                </p>
              </div>

              {activeGrant.notes && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong className="text-slate-800">Note operative:</strong> {activeGrant.notes}
                </div>
              )}

              {/* Documentazione del Bando (Connessa a Google Drive -> Gestionale ASD / 05_Bandi_e_Progetti) */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      Documentazione del Bando ({activeGrant.documents?.length || 0} documenti)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      I file caricati vengono salvati in Google Drive nella sottocartella{' '}
                      <span className="font-mono font-semibold">
                        {DRIVE_ROOT_FOLDER_NAME} / {DRIVE_CATEGORY_FOLDERS.bandi_progetti.folderName}
                      </span>
                    </p>
                  </div>

                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer self-start sm:self-auto">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Carica File Bando su Drive</span>
                    <input
                      type="file"
                      onChange={(e) => handleUploadGrantDocumentToDrive(e, activeGrant)}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Quick Add Document Reference Form */}
                <form
                  onSubmit={handleAddDocumentReference}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs"
                >
                  <input
                    type="text"
                    placeholder="Nome documento (es. Formulario_Progetto.pdf)..."
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    className="sm:col-span-5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  />
                  <select
                    value={newDocCategory}
                    onChange={(e) =>
                      setNewDocCategory(e.target.value as GrantDocument['category'])
                    }
                    className="sm:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="bando_avviso">Avviso / Testo Bando</option>
                    <option value="domanda_progetto">Formulario / Domanda</option>
                    <option value="allegato_tecnico">Allegato Tecnico / Statuto</option>
                    <option value="rendicontazione_fatture">Fatture / Rendicontazione</option>
                    <option value="altro">Altro Documento</option>
                  </select>
                  <button
                    type="submit"
                    className="sm:col-span-3 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition-colors"
                  >
                    + Registra Voce
                  </button>
                </form>

                {/* List of attached documents */}
                {!activeGrant.documents || activeGrant.documents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-100">
                    Nessun documento allegato a questo bando.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                    {activeGrant.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate">{doc.name}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2">
                              <span className="font-medium text-emerald-700">
                                {getDocCategoryLabel(doc.category)}
                              </span>
                              <span>·</span>
                              <span className="font-mono">{doc.uploadedAt}</span>
                              {doc.notes && (
                                <>
                                  <span>·</span>
                                  <span>{doc.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {doc.driveFileUrl && (
                            <a
                              href={doc.driveFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-md font-semibold flex items-center gap-1"
                            >
                              <span>Drive</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              onUpdateGrant({
                                ...activeGrant,
                                documents: activeGrant.documents.filter((d) => d.id !== doc.id),
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                            title="Rimuovi documento dalla scheda"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crea / Modifica Bando */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingGrant ? `Modifica Bando: ${editingGrant.title}` : 'Aggiungi Nuovo Bando'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGrant} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">
                    Titolo del Bando *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Es. Bando Sport e Natura 2027 - Regione Toscana"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Ente Erogatore / Promotore *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Es. Regione Toscana, Fondazione..."
                    value={promoter}
                    onChange={(e) => setPromoter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Scadenza Presentazione *
                  </label>
                  <input
                    type="date"
                    required
                    value={submissionDeadline}
                    onChange={(e) => setSubmissionDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Scadenza Rendicontazione *
                  </label>
                  <input
                    type="date"
                    required
                    value={reportingDeadline}
                    onChange={(e) => setReportingDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Stato Pratica *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as GrantStatus)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="in_valutazione">In Valutazione</option>
                    <option value="in_preparazione">In Preparazione</option>
                    <option value="presentato">Domanda Presentata</option>
                    <option value="approvato_finanziato">Approvato & Finanziato</option>
                    <option value="in_rendicontazione">In Rendicontazione</option>
                    <option value="chiuso_rendicontato">Chiuso & Rendicontato</option>
                    <option value="non_ammesso">Non Ammesso</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Importo Richiesto (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Importo Concesso / Finanziato (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={approvedAmount}
                    onChange={(e) => setApprovedAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Link Portale / Sito Bando
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={portalUrl}
                    onChange={(e) => setPortalUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Caratteristiche Fondamentali del Bando (Requisiti, Spese Ammissibili, % Fondo
                  Perduto, Cofinanziamento) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Descrivi sinteticamente destinatari, spese ammissibili, vincoli e percentuale di copertura..."
                  value={keyCharacteristics}
                  onChange={(e) => setKeyCharacteristics(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Contatti Utili (RUP, Referente Ufficio Bandi, Email, PEC, Telefono)
                </label>
                <textarea
                  rows={2}
                  placeholder="Es. Dott. Mario Rossi - Ufficio Sport - email@ente.it - Tel. 055..."
                  value={usefulContacts}
                  onChange={(e) => setUsefulContacts(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Note Operative & Promemoria Allegati
                </label>
                <input
                  type="text"
                  placeholder="Es. Ricordarsi di allegare statuto ASD, iscrizione RASD e preventivo firmato"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  {editingGrant ? 'Salva Modifiche Bando' : 'Aggiungi Bando'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
