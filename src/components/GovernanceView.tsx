import React, { useState, useEffect } from 'react';
import {
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Upload,
  FolderOpen,
  ExternalLink,
  Trash2,
  Edit3,
  Clock,
  UserCheck,
  HardDrive,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import {
  AssociationRole,
  AssemblyMeeting,
  GovernanceRoleCategory,
  AssociationProfile,
} from '../types';
import {
  DriveFileItem,
  DRIVE_ROOT_FOLDER_NAME,
  DRIVE_CATEGORY_FOLDERS,
  getOrCreateDriveCategoryFolder,
  listDriveFiles,
  uploadFileToDrive,
  deleteDriveFile,
} from '../services/googleWorkspace';
import { GoogleSignInButton } from './GoogleSignInButton';
import { parseAnyDate, diffDays } from '../utils/notifications';

interface GovernanceViewProps {
  roles: AssociationRole[];
  assemblies: AssemblyMeeting[];
  profile: AssociationProfile;
  googleUserEmail: string | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  onAddRole: (role: Omit<AssociationRole, 'id'>) => void;
  onUpdateRole: (role: AssociationRole) => void;
  onDeleteRole: (id: string) => void;
  onAddAssembly: (asm: Omit<AssemblyMeeting, 'id'>) => void;
  onUpdateAssembly: (asm: AssemblyMeeting) => void;
}

const DRIVE_MINUTES_FOLDER_NAME = `${DRIVE_ROOT_FOLDER_NAME} / ${DRIVE_CATEGORY_FOLDERS.verbali_governance.folderName}`;

export const GovernanceView: React.FC<GovernanceViewProps> = ({
  roles,
  assemblies,
  profile,
  googleUserEmail,
  onGoogleSignIn,
  onGoogleLogout,
  onAddRole,
  onUpdateRole,
  onDeleteRole,
  onAddAssembly,
  onUpdateAssembly,
}) => {
  // Drive state
  const [driveFolder, setDriveFolder] = useState<DriveFileItem | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [driveMessage, setDriveMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  // Role modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AssociationRole | null>(null);
  const [roleTitle, setRoleTitle] = useState('');
  const [roleCategory, setRoleCategory] = useState<GovernanceRoleCategory>('consiglio_direttivo');
  const [personName, setPersonName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('2027-01-10');
  const [expiryDate, setExpiryDate] = useState('2028-01-10');
  const [notes, setNotes] = useState('');

  // Assembly modal state
  const [isAsmModalOpen, setIsAsmModalOpen] = useState(false);
  const [asmYear, setAsmYear] = useState(2027);
  const [asmTitle, setAsmTitle] = useState(
    'Assemblea Ordinaria Soci - Approvazione Rendiconto Economico-Finanziario 2027'
  );
  const [asmType, setAsmType] = useState<AssemblyMeeting['type']>('ordinaria_rendiconto');
  const [asmScheduled, setAsmScheduled] = useState('2028-04-15');
  const [asmDeadline, setAsmDeadline] = useState('2028-04-30');
  const [asmSummary, setAsmSummary] = useState('');

  // Load Drive folder and files when connected
  const syncDriveFolder = async () => {
    if (!googleUserEmail) return;
    setIsLoadingDrive(true);
    setDriveMessage(null);
    try {
      const { categoryFolder: folder } = await getOrCreateDriveCategoryFolder('verbali_governance');
      setDriveFolder(folder);
      const files = await listDriveFiles(`'${folder.id}' in parents and trashed = false`);
      setDriveFiles(files);
    } catch (err: any) {
      setDriveMessage({
        type: 'err',
        text: err?.message || 'Errore nella connessione a Google Drive.',
      });
    } finally {
      setIsLoadingDrive(false);
    }
  };

  useEffect(() => {
    if (googleUserEmail) {
      syncDriveFolder();
    } else {
      setDriveFolder(null);
      setDriveFiles([]);
    }
  }, [googleUserEmail]);

  const handleOpenRoleModal = (role?: AssociationRole) => {
    if (role) {
      setEditingRole(role);
      setRoleTitle(role.roleTitle);
      setRoleCategory(role.category);
      setPersonName(role.personName);
      setPhone(role.phone || '');
      setEmail(role.email || '');
      setAppointmentDate(role.appointmentDate);
      setExpiryDate(role.expiryDate);
      setNotes(role.notes || '');
    } else {
      setEditingRole(null);
      setRoleTitle('');
      setRoleCategory('consiglio_direttivo');
      setPersonName('');
      setPhone('');
      setEmail('');
      setAppointmentDate('2027-01-10');
      setExpiryDate('2028-01-10');
      setNotes('');
    }
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTitle.trim() || !personName.trim()) return;

    if (editingRole) {
      onUpdateRole({
        ...editingRole,
        roleTitle: roleTitle.trim(),
        category: roleCategory,
        personName: personName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        appointmentDate,
        expiryDate,
        notes: notes.trim(),
      });
    } else {
      onAddRole({
        roleTitle: roleTitle.trim(),
        category: roleCategory,
        personName: personName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        appointmentDate,
        expiryDate,
        notes: notes.trim(),
      });
    }
    setIsRoleModalOpen(false);
  };

  const handleSaveAssembly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asmTitle.trim()) return;
    onAddAssembly({
      fiscalYear: asmYear,
      title: asmTitle.trim(),
      type: asmType,
      scheduledDate: asmScheduled,
      approvalDeadline: asmDeadline,
      status: 'da_convocare',
      minutesSummary: asmSummary.trim(),
    });
    setIsAsmModalOpen(false);
  };

  // Upload a generated or local file to Google Drive for an Assembly
  const handleSaveAssemblyMinutesToDrive = async (asm: AssemblyMeeting) => {
    if (!googleUserEmail) {
      setDriveMessage({
        type: 'err',
        text: 'Connetti prima il tuo account Google Workspace per salvare i verbali su Google Drive.',
      });
      return;
    }

    const confirmed = confirm(
      `Vuoi generare e salvare il documento del verbale "${asm.title}" nella cartella Google Drive "${DRIVE_MINUTES_FOLDER_NAME}"?`
    );
    if (!confirmed) return;

    setIsLoadingDrive(true);
    setDriveMessage(null);
    try {
      const folder =
        driveFolder || (await getOrCreateDriveCategoryFolder('verbali_governance')).categoryFolder;
      setDriveFolder(folder);

      const content = [
        `VERBALE DI ASSEMBLEA / RIUNIONE - ${profile.name.toUpperCase()}`,
        `Codice Fiscale: ${profile.fiscalCode} — Sede: ${profile.address}`,
        `====================================================================`,
        ` Oggetto: ${asm.title}`,
        ` Anno Sociale di riferimento: ${asm.fiscalYear}`,
        ` Data convocazione / svolgimento: ${asm.scheduledDate}`,
        ` Termine statutario approvazione: ${asm.approvalDeadline}`,
        ` Stato: ${asm.status === 'svolta_approvata' ? 'APPROVATA' : 'IN REDAZIONE'}`,
        `--------------------------------------------------------------------`,
        `SINTESI DELIBERAZIONI E ORDINE DEL GIORNO:`,
        asm.minutesSummary || 'Approvazione rendiconto economico-finanziario e relazione attività.',
        ``,
        `Il Presidente: ${profile.president}`,
        `Documento archiviato dal Gestionale ${profile.name} in data ${new Date().toLocaleDateString('it-IT')}.`,
      ].join('\n');

      const fileName = `Verbale_${asm.fiscalYear}_${asm.title
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 40)}.txt`;

      const uploaded = await uploadFileToDrive({
        name: fileName,
        content,
        mimeType: 'text/plain',
        folderId: folder.id,
      });

      onUpdateAssembly({
        ...asm,
        status: 'svolta_approvata',
        driveFileId: uploaded.id,
        driveFileName: uploaded.name,
        driveFileUrl: uploaded.webViewLink,
      });

      await syncDriveFolder();
      setDriveMessage({
        type: 'ok',
        text: `Verbale "${uploaded.name}" salvato con successo su Google Drive in "${DRIVE_MINUTES_FOLDER_NAME}"!`,
      });
    } catch (err: any) {
      setDriveMessage({
        type: 'err',
        text: err?.message || 'Errore durante il salvataggio del verbale su Google Drive.',
      });
    } finally {
      setIsLoadingDrive(false);
    }
  };

  // Upload any local PDF/Word/Text file to the Drive folder
  const handleUploadCustomFileToDrive = async (
    e: React.ChangeEvent<HTMLInputElement>,
    linkedAsm?: AssemblyMeeting
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!googleUserEmail) {
      setDriveMessage({
        type: 'err',
        text: 'Connetti prima il tuo account Google Workspace.',
      });
      return;
    }

    const confirmed = confirm(
      `Confermi il caricamento del file "${file.name}" nella cartella Google Drive "${DRIVE_MINUTES_FOLDER_NAME}"?`
    );
    if (!confirmed) {
      e.target.value = '';
      return;
    }

    setIsLoadingDrive(true);
    setDriveMessage(null);
    try {
      const folder =
        driveFolder || (await getOrCreateDriveCategoryFolder('verbali_governance')).categoryFolder;
      setDriveFolder(folder);

      const uploaded = await uploadFileToDrive({
        name: file.name,
        content: file,
        mimeType: file.type || 'application/octet-stream',
        folderId: folder.id,
      });

      if (linkedAsm) {
        onUpdateAssembly({
          ...linkedAsm,
          status: 'svolta_approvata',
          driveFileId: uploaded.id,
          driveFileName: uploaded.name,
          driveFileUrl: uploaded.webViewLink,
        });
      }

      await syncDriveFolder();
      setDriveMessage({
        type: 'ok',
        text: `File "${uploaded.name}" caricato nella cartella Google Drive dell'associazione!`,
      });
    } catch (err: any) {
      setDriveMessage({
        type: 'err',
        text: err?.message || 'Errore nel caricamento del file su Google Drive.',
      });
    } finally {
      setIsLoadingDrive(false);
      e.target.value = '';
    }
  };

  const handleDeleteDriveDocument = async (file: DriveFileItem) => {
    const confirmed = confirm(
      `Attenzione: vuoi eliminare definitivamente il file "${file.name}" dal tuo Google Drive?`
    );
    if (!confirmed) return;

    setIsLoadingDrive(true);
    try {
      await deleteDriveFile(file.id);
      await syncDriveFolder();
      setDriveMessage({
        type: 'ok',
        text: `File "${file.name}" rimosso da Google Drive.`,
      });
    } catch (err: any) {
      setDriveMessage({
        type: 'err',
        text: err?.message || 'Errore nella rimozione del file.',
      });
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const getCategoryBadge = (cat: GovernanceRoleCategory) => {
    switch (cat) {
      case 'tutela_minori_safeguarding':
        return {
          label: 'Tutela Minori (Safeguarding)',
          cls: 'bg-purple-50 text-purple-800 border-purple-200',
        };
      case 'sicurezza_rspp':
        return {
          label: 'Sicurezza & Primo Soccorso (RSPP)',
          cls: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'consiglio_direttivo':
        return {
          label: 'Consiglio Direttivo',
          cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        };
      default:
        return {
          label: 'Altro Organo / Incarico',
          cls: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Google Drive Connection Banner for Verbali & Documenti */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-sm">
                Archivio Cloud Google Drive — Verbali Assemblee & Nomine ASD
              </h3>
              {googleUserEmail ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" /> Connesso ({googleUserEmail})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  Non connesso a Google Drive
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Salva e sincronizza i verbali di approvazione del rendiconto annuale, le nomine
              Safeguarding e i documenti sulla sicurezza direttamente nella cartella{' '}
              <span className="font-mono font-semibold text-slate-700">
                "{DRIVE_MINUTES_FOLDER_NAME}"
              </span>{' '}
              del tuo spazio Google Drive.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {!googleUserEmail ? (
            <GoogleSignInButton onClick={onGoogleSignIn} label="Connetti Google Drive" />
          ) : (
            <>
              {driveFolder?.webViewLink && (
                <a
                  href={driveFolder.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Apri Cartella su Drive</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button
                onClick={syncDriveFolder}
                disabled={isLoadingDrive}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                <span>Aggiorna Drive</span>
              </button>
              <button
                onClick={onGoogleLogout}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                title="Disconnetti Google Workspace"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {driveMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            driveMessage.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span className="font-medium">{driveMessage.text}</span>
          <button
            onClick={() => setDriveMessage(null)}
            className="text-slate-400 hover:text-slate-700 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* SECTION 1: CARICHE ASSOCIATIVE & RESPONSABILI OBBLIGATORI (Safeguarding, Sicurezza, Direttivo) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Organigramma Cariche Associative, Tutela Minori (Safeguarding) & Sicurezza
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoraggio scadenze mandati Consiglio Direttivo, Responsabile contro abusi/minori
              (D.Lgs. 39/2021) e Responsabile Sicurezza (RSPP)
            </p>
          </div>
          <button
            onClick={() => handleOpenRoleModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Aggiungi Carica / Nomina</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Ruolo / Carica Associativa</th>
                <th className="py-3 px-4">Ambito</th>
                <th className="py-3 px-4">Nominativo & Contatti</th>
                <th className="py-3 px-4 text-center">Nomina</th>
                <th className="py-3 px-4 text-center">Scadenza Mandato</th>
                <th className="py-3 px-4">Note & Adempimenti</th>
                <th className="py-3 px-4 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((role) => {
                const badge = getCategoryBadge(role.category);
                const expDate = parseAnyDate(role.expiryDate);
                const daysLeft = expDate ? diffDays(expDate) : 999;
                const isExpiredOrMissing =
                  daysLeft < 0 || role.personName.toLowerCase().includes('da verificare');
                const isExpiringSoon = daysLeft >= 0 && daysLeft <= 60;

                return (
                  <tr key={role.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{role.roleTitle}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-semibold border ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div
                        className={`font-semibold ${
                          role.personName.toLowerCase().includes('da verificare')
                            ? 'text-rose-700'
                            : 'text-slate-800'
                        }`}
                      >
                        {role.personName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {[role.phone, role.email].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600 tabular-nums">
                      {role.appointmentDate}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold ${
                          isExpiredOrMissing
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isExpiringSoon
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {isExpiredOrMissing && <AlertTriangle className="w-3 h-3" />}
                        {role.expiryDate}
                        {daysLeft < 0
                          ? ' (Scaduto)'
                          : isExpiringSoon
                          ? ` (${daysLeft} gg)`
                          : ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs">
                      <div className="line-clamp-2 text-[11px]">{role.notes || '-'}</div>
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenRoleModal(role)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors"
                          title="Modifica carica / rinnova mandato"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Vuoi rimuovere la carica "${role.roleTitle}"?`)) {
                              onDeleteRole(role.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-md transition-colors"
                          title="Elimina carica"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: ASSEMBLEE ANNUALI DEI SOCI (APPROVAZIONE RENDICONTO) & VERBALI SU DRIVE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              Assemblea Annuale dei Soci (Approvazione Rendiconto di Cassa) & Verbali
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Promemoria convocazione assemblea ordinaria entro 120 giorni dalla chiusura
              dell'esercizio (30 Aprile) e archiviazione verbali su Google Drive
            </p>
          </div>
          <button
            onClick={() => setIsAsmModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Pianifica Assemblea / Verbale</span>
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {assemblies.map((asm) => {
            const isApproved = asm.status === 'svolta_approvata';
            return (
              <div
                key={asm.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-800">
                      Esercizio {asm.fiscalYear}
                    </span>
                    <h4 className="font-bold text-slate-900 text-sm">{asm.title}</h4>
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        isApproved
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : asm.status === 'convocata'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {isApproved
                        ? 'Svolta & Approvata ✓'
                        : asm.status === 'convocata'
                        ? 'Convocata'
                        : 'Da Convocare'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{asm.minutesSummary}</p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Data Assemblea: <strong className="text-slate-800">{asm.scheduledDate}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      Termine Max Approvazione:{' '}
                      <strong className="text-amber-800">{asm.approvalDeadline}</strong>
                    </span>
                  </div>

                  {asm.driveFileUrl && (
                    <div className="pt-1">
                      <a
                        href={asm.driveFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline"
                      >
                        <HardDrive className="w-3.5 h-3.5" />
                        <span>Verbale su Google Drive: {asm.driveFileName || 'Apri documento'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Assembly Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    value={asm.status}
                    onChange={(e) =>
                      onUpdateAssembly({
                        ...asm,
                        status: e.target.value as AssemblyMeeting['status'],
                      })
                    }
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
                  >
                    <option value="da_convocare">Stato: Da Convocare</option>
                    <option value="convocata">Stato: Convocata</option>
                    <option value="svolta_approvata">Stato: Svolta & Approvata</option>
                  </select>

                  <button
                    onClick={() => handleSaveAssemblyMinutesToDrive(asm)}
                    disabled={isLoadingDrive}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    title="Genera e salva il verbale direttamente nella cartella Google Drive dell'associazione"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Salva Verbale su Drive</span>
                  </button>

                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>Carica PDF Verbale</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => handleUploadCustomFileToDrive(e, asm)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: ELENCO FILE NELLA CARTELLA GOOGLE DRIVE "Apuacamp ASD - Verbali e Documenti" */}
      {googleUserEmail && (
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                Documenti salvati su Google Drive ({driveFiles.length})
              </h4>
              <p className="text-xs text-slate-500">
                Cartella Drive: <span className="font-mono">{DRIVE_MINUTES_FOLDER_NAME}</span> · Qui compaiono i documenti caricati o generati tramite il gestionale (permesso <code className="font-mono">drive.file</code>).
              </p>
            </div>
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Carica Documento su Drive</span>
              <input
                type="file"
                onChange={(e) => handleUploadCustomFileToDrive(e)}
                className="hidden"
              />
            </label>
          </div>

          {driveFiles.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-400">
              Nessun file ancora presente nella cartella "{DRIVE_MINUTES_FOLDER_NAME}" tra quelli caricati o generati dal gestionale. Usa i
              pulsanti "Salva Verbale su Drive" o "Carica Documento su Drive".
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
              {driveFiles.map((f) => (
                <div
                  key={f.id}
                  className="p-3 flex items-center justify-between text-xs hover:bg-slate-50"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-slate-800">{f.name}</span>
                      {f.modifiedTime && (
                        <span className="ml-2 text-[10px] text-slate-400 font-mono">
                          {new Date(f.modifiedTime).toLocaleDateString('it-IT')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.webViewLink && (
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-emerald-700 hover:bg-emerald-50 rounded-md font-medium flex items-center gap-1"
                      >
                        <span>Apri</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteDriveDocument(f)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                      title="Elimina da Google Drive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Add / Edit Role */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                {editingRole ? 'Modifica Carica Associativa' : 'Nuova Carica Associativa / Nomina'}
              </h3>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Titolo Carica / Ruolo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Responsabile Tutela Minori (Safeguarding), Presidente..."
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Ambito *</label>
                  <select
                    value={roleCategory}
                    onChange={(e) => setRoleCategory(e.target.value as GovernanceRoleCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="consiglio_direttivo">Consiglio Direttivo</option>
                    <option value="tutela_minori_safeguarding">
                      Tutela Minori (Safeguarding)
                    </option>
                    <option value="sicurezza_rspp">Sicurezza & Primo Soccorso (RSPP)</option>
                    <option value="revisore_altro">Altro Organo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Persona Incaricata *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome e Cognome"
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Telefono</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Data Nomina *</label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Data Scadenza Mandato *
                  </label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Note & Riferimenti Normativi
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  Salva Carica
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Assembly */}
      {isAsmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Pianifica Assemblea Soci / Riunione Direttivo
              </h3>
              <button
                onClick={() => setIsAsmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssembly} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Esercizio *</label>
                  <input
                    type="number"
                    required
                    value={asmYear}
                    onChange={(e) => setAsmYear(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">Tipo Riunione *</label>
                  <select
                    value={asmType}
                    onChange={(e) => setAsmType(e.target.value as AssemblyMeeting['type'])}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    <option value="ordinaria_rendiconto">
                      Assemblea Ordinaria Approvazione Rendiconto
                    </option>
                    <option value="consiglio_direttivo">Verbale Consiglio Direttivo</option>
                    <option value="straordinaria">Assemblea Straordinaria</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Titolo / Oggetto *</label>
                <input
                  type="text"
                  required
                  value={asmTitle}
                  onChange={(e) => setAsmTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Data Prevista Assemblea *
                  </label>
                  <input
                    type="date"
                    required
                    value={asmScheduled}
                    onChange={(e) => setAsmScheduled(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Termine Statutario (120gg) *
                  </label>
                  <input
                    type="date"
                    required
                    value={asmDeadline}
                    onChange={(e) => setAsmDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Ordine del Giorno / Sintesi Verbale
                </label>
                <textarea
                  rows={3}
                  placeholder="Es. Approvazione rendiconto economico-finanziario al 31/12, relazione attività sportive..."
                  value={asmSummary}
                  onChange={(e) => setAsmSummary(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAsmModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  Salva Assemblea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
