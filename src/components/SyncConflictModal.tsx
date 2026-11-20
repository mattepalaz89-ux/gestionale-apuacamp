import React from 'react';
import {
  AlertTriangle,
  Cloud,
  Download,
  ExternalLink,
  FileJson,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { AppState, DriveDbCandidate } from '../types';
import { downloadJsonBackup } from '../utils/storage';
import { todayIso } from '../utils/dates';

interface SyncConflictModalProps {
  isOpen: boolean;
  localState: AppState;
  remoteState: AppState | null;
  candidates?: DriveDbCandidate[];
  selectedCandidateId?: string;
  isResolving?: boolean;
  onUseRemote: () => void;
  onPushLocal: () => void;
  onSelectCandidate?: (fileId: string) => void;
}

function formatDateTimeIt(iso?: string): string {
  if (!iso) return 'Data non registrata (versione precedente)';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  isOpen,
  localState,
  remoteState,
  candidates,
  selectedCandidateId,
  isResolving = false,
  onUseRemote,
  onPushLocal,
  onSelectCandidate,
}) => {
  if (!isOpen) return null;

  const hasMultipleCandidates = Boolean(candidates && candidates.length > 1);

  const handleDownloadBoth = () => {
    const ts = todayIso();
    downloadJsonBackup(localState, `conflitto_versione_LOCALE_v${localState.version || 1}_${ts}.json`);
    if (remoteState) {
      setTimeout(() => {
        downloadJsonBackup(
          remoteState,
          `conflitto_versione_DRIVE_v${remoteState.version || 1}_${ts}.json`
        );
      }, 250);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-3xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {remoteState
                ? 'Rilevate modifiche divergenti tra questo dispositivo e Google Drive'
                : 'Seleziona il file Database da utilizzare su Google Drive'}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Per proteggere i tuoi dati da sovrascritture involontarie, il gestionale ha messo in
              pausa la sincronizzazione automatica. Qualunque opzione sceglierai, verrà prima
              salvato un backup automatico della versione scartata.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Multiple candidates selector if > 1 database_gestionale_asd.json exists on Drive */}
          {hasMultipleCandidates && candidates && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-indigo-900 font-semibold text-xs">
                <FileJson className="w-4 h-4 text-indigo-600" />
                <span>
                  Trovati {candidates.length} file &ldquo;database_gestionale_asd.json&rdquo; sul tuo
                  Google Drive:
                </span>
              </div>
              <p className="text-xs text-indigo-700">
                Seleziona quale file vuoi caricare e impostare come database principale:
              </p>
              <div className="space-y-1.5">
                {candidates.map((cand) => {
                  const isSelected = cand.id === selectedCandidateId;
                  return (
                    <div
                      key={cand.id}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-xs transition ${
                        isSelected
                          ? 'bg-white border-indigo-500 shadow-sm font-medium text-slate-900'
                          : 'bg-white/70 border-indigo-200 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">
                          {cand.name}{' '}
                          <span className="text-[11px] font-normal text-slate-500">
                            (ID: {cand.id.slice(0, 10)}…)
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Ultima modifica Drive: {formatDateTimeIt(cand.modifiedTime)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cand.webViewLink && (
                          <a
                            href={cand.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 rounded"
                            title="Apri su Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {onSelectCandidate && (
                          <button
                            type="button"
                            disabled={isResolving || isSelected}
                            onClick={() => onSelectCandidate(cand.id)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold ${
                              isSelected
                                ? 'bg-indigo-100 text-indigo-800 cursor-default'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                            }`}
                          >
                            {isSelected ? 'Selezionato' : 'Ispeziona questo file'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Side-by-side comparison */}
          {remoteState && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Local Card */}
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                    <HardDrive className="w-4 h-4 text-slate-600" />
                    <span>Versione Locale (Questo PC)</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-mono text-xs font-bold">
                    v{localState.version || 1}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">Ultimo salvataggio:</span>{' '}
                    {formatDateTimeIt(localState.updatedAt)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Autore modifica:</span>{' '}
                    {localState.updatedBy || 'locale'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-slate-500 text-[11px]">Movimenti Cassa</div>
                    <div className="text-sm font-bold text-slate-900">
                      {localState.transactions.length}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-slate-500 text-[11px]">Soci Registrati</div>
                    <div className="text-sm font-bold text-slate-900">
                      {localState.members.length}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-slate-500 text-[11px]">Eventi / Iscrizioni</div>
                    <div className="text-sm font-bold text-slate-900">
                      {localState.events.length} / {localState.bookings.length}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <div className="text-slate-500 text-[11px]">Staff / Cariche</div>
                    <div className="text-sm font-bold text-slate-900">
                      {localState.staff.length} / {localState.roles?.length || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Remote Drive Card */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
                    <Cloud className="w-4 h-4 text-emerald-600" />
                    <span>Versione su Google Drive</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono text-xs font-bold">
                    v{remoteState.version || 1}
                  </span>
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">Ultimo salvataggio:</span>{' '}
                    {formatDateTimeIt(remoteState.updatedAt)}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Autore modifica:</span>{' '}
                    {remoteState.updatedBy || 'Google Drive'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-200/70 text-xs">
                  <div className="bg-white p-2 rounded-lg border border-emerald-200/80">
                    <div className="text-slate-500 text-[11px]">Movimenti Cassa</div>
                    <div className="text-sm font-bold text-emerald-950">
                      {remoteState.transactions.length}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-200/80">
                    <div className="text-slate-500 text-[11px]">Soci Registrati</div>
                    <div className="text-sm font-bold text-emerald-950">
                      {remoteState.members.length}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-200/80">
                    <div className="text-slate-500 text-[11px]">Eventi / Iscrizioni</div>
                    <div className="text-sm font-bold text-emerald-950">
                      {remoteState.events.length} / {remoteState.bookings.length}
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-200/80">
                    <div className="text-slate-500 text-[11px]">Staff / Cariche</div>
                    <div className="text-sm font-bold text-emerald-950">
                      {remoteState.staff.length} / {remoteState.roles?.length || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Safety Guarantee Notice */}
          <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Zero perdita di dati:</strong> prima di applicare la tua scelta, il sistema
              crea in automatico una copia di sicurezza nella cartella{' '}
              <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                07_Backup_Sistema / Backup_Automatici
              </code>{' '}
              su Google Drive.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDownloadBoth}
            disabled={isResolving}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
          >
            <Download className="w-4 h-4" />
            <span>Scarica entrambe come JSON</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onPushLocal}
              disabled={isResolving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition disabled:opacity-50"
            >
              <HardDrive className="w-4 h-4" />
              <span>Mantieni Versione Locale e Sovrascrivi Drive</span>
            </button>
            <button
              type="button"
              onClick={onUseRemote}
              disabled={isResolving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              <Cloud className="w-4 h-4" />
              <span>Usa Versione Google Drive</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
