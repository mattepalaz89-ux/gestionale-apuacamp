import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Trash2,
  CheckSquare,
  Square,
  CheckCircle2,
  X,
  Calendar,
  User,
  EyeOff,
  RotateCcw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { DuplicateTransactionGroup } from '../types';
import { formatEuro } from '../utils/finance';

interface DuplicateTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateGroups: DuplicateTransactionGroup[];
  onDeleteTransactions: (transactionIds: string[]) => void;
  onIgnoreGroupSignature: (signature: string) => void;
  ignoredCount: number;
  onResetIgnoredGroups: () => void;
  onLoadSampleDuplicates?: () => void;
}

export const DuplicateTransactionsModal: React.FC<DuplicateTransactionsModalProps> = ({
  isOpen,
  onClose,
  duplicateGroups,
  onDeleteTransactions,
  onIgnoreGroupSignature,
  ignoredCount,
  onResetIgnoredGroups,
  onLoadSampleDuplicates,
}) => {
  // Set of transaction IDs currently flagged (checked) for deletion
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // All suggested duplicate IDs (all items except the first originalTransaction in each group)
  const suggestedDuplicateIds = useMemo(() => {
    const ids: string[] = [];
    for (const grp of duplicateGroups) {
      for (const dup of grp.duplicateTransactions) {
        ids.push(dup.id);
      }
    }
    return ids;
  }, [duplicateGroups]);

  // All transaction IDs across all groups
  const allGroupTransactionIds = useMemo(() => {
    const ids: string[] = [];
    for (const grp of duplicateGroups) {
      for (const tx of grp.allTransactions) {
        ids.push(tx.id);
      }
    }
    return ids;
  }, [duplicateGroups]);

  // Whenever the modal opens or groups change, pre-select the suggested duplicate transactions
  useEffect(() => {
    if (isOpen) {
      setSelectedTxIds(new Set(suggestedDuplicateIds));
    }
  }, [isOpen, suggestedDuplicateIds]);

  if (!isOpen) return null;

  const toggleSingleTransaction = (txId: string) => {
    setFeedbackBanner(null);
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId);
      } else {
        next.add(txId);
      }
      return next;
    });
  };

  const handleSelectSuggestedDuplicates = () => {
    setFeedbackBanner(null);
    setSelectedTxIds(new Set(suggestedDuplicateIds));
  };

  const handleSelectAllInGroups = () => {
    setFeedbackBanner(null);
    setSelectedTxIds(new Set(allGroupTransactionIds));
  };

  const handleClearSelection = () => {
    setFeedbackBanner(null);
    setSelectedTxIds(new Set());
  };

  const handleDeleteSelected = () => {
    const idsToDelete = Array.from(selectedTxIds);
    if (idsToDelete.length === 0) return;

    onDeleteTransactions(idsToDelete);
    setSelectedTxIds(new Set());
    setFeedbackBanner(
      `Eliminati con successo ${idsToDelete.length} movimenti duplicati! Il saldo di cassa è stato ricalcolato.`
    );
  };

  const handleDeleteSingleImmediate = (txId: string, description: string) => {
    onDeleteTransactions([txId]);
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      next.delete(txId);
      return next;
    });
    setFeedbackBanner(`Movimento "${description}" eliminato dal libro cassa.`);
  };

  // Calculate total euro amount of currently selected movements
  const selectedAmountTotal = duplicateGroups.reduce((acc, grp) => {
    let sub = 0;
    for (const tx of grp.allTransactions) {
      if (selectedTxIds.has(tx.id)) {
        sub += (tx.income || 0) + (tx.expense || 0);
      }
    }
    return acc + sub;
  }, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="bg-amber-50/90 border-b border-amber-200 px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-sm bg-amber-200/80 text-amber-950 font-mono text-[10px] font-bold uppercase tracking-wider">
                  Controllo Anti-Duplicati · Regola 7 Giorni
                </span>
                {duplicateGroups.length > 0 && (
                  <span className="px-2 py-0.5 rounded-sm bg-rose-600 text-white font-mono text-[10px] font-bold">
                    {duplicateGroups.length}{' '}
                    {duplicateGroups.length === 1 ? 'gruppo rilevato' : 'gruppi rilevati'} (
                    {suggestedDuplicateIds.length} duplicati)
                  </span>
                )}
              </div>
              <h2
                id="duplicate-modal-title"
                className="text-base sm:text-lg font-extrabold text-slate-900 mt-1"
              >
                Verifica ed Eliminazione Rapida Movimenti Duplicati
              </h2>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Vengono segnalati i movimenti simili riferiti alla <strong>stessa persona</strong> e
                dello <strong>stesso importo</strong> registrati entro{' '}
                <strong>massimo 7 giorni (una settimana)</strong>. Selezionali tutti insieme o con i
                flag uno per uno per cancellarli subito.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-amber-100/70 transition-colors"
            title="Chiudi popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Banner after deletion */}
        {feedbackBanner && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between gap-2 text-xs text-emerald-900 font-semibold">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 font-bold px-1.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Sticky Bulk Selection & Action Toolbar */}
        {duplicateGroups.length > 0 && (
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                id="btn-select-suggested-duplicates"
                type="button"
                onClick={handleSelectSuggestedDuplicates}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors"
                title="Seleziona automaticamente solo i movimenti doppi mantenendo intatto il primo movimento originale di ogni gruppo"
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-800" />
                <span>
                  Seleziona Tutti i Duplicati Suggeriti ({suggestedDuplicateIds.length})
                </span>
              </button>

              <button
                id="btn-select-all-group-rows"
                type="button"
                onClick={
                  selectedTxIds.size === allGroupTransactionIds.length
                    ? handleClearSelection
                    : handleSelectAllInGroups
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              >
                {selectedTxIds.size === allGroupTransactionIds.length ? (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-500" />
                    <span>Deseleziona Tutti</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Seleziona Tutte le Righe ({allGroupTransactionIds.length})</span>
                  </>
                )}
              </button>

              {selectedTxIds.size > 0 &&
                selectedTxIds.size !== allGroupTransactionIds.length && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="text-xs text-slate-500 hover:text-slate-800 underline px-1.5"
                  >
                    Azzera selezione
                  </button>
                )}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right hidden md:block">
                <div className="text-[10px] text-slate-500 uppercase font-semibold">
                  Selezionati per eliminazione
                </div>
                <div className="text-xs font-mono font-bold text-rose-700">
                  {selectedTxIds.size} mov. ({formatEuro(selectedAmountTotal)})
                </div>
              </div>

              <button
                id="btn-delete-selected-duplicates"
                type="button"
                disabled={selectedTxIds.size === 0}
                onClick={handleDeleteSelected}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  selectedTxIds.size > 0
                    ? 'bg-rose-600 hover:bg-rose-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>
                  Elimina Selezionati ({selectedTxIds.size})
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Main Scrollable Content: List of Duplicate Groups */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-100/60">
          {duplicateGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-xl mx-auto my-4 space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Nessun movimento duplicato rilevato!
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Non ci sono movimenti con la stessa persona e lo stesso importo registrati entro 7
                giorni di distanza. Il libro cassa è pulito e allineato.
              </p>

              <div className="pt-3 flex flex-wrap items-center justify-center gap-2">
                {onLoadSampleDuplicates && (
                  <button
                    id="btn-load-sample-duplicates"
                    type="button"
                    onClick={() => {
                      setFeedbackBanner(null);
                      onLoadSampleDuplicates();
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Simula 2 Coppie di Duplicati di Prova</span>
                  </button>
                )}

                {ignoredCount > 0 && (
                  <button
                    type="button"
                    onClick={onResetIgnoredGroups}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Ripristina {ignoredCount} gruppi ignorati</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            duplicateGroups.map((group, groupIndex) => (
              <div
                key={group.groupId}
                className="bg-white rounded-xl border border-amber-200/90 shadow-2xs overflow-hidden"
              >
                {/* Group Header */}
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[10px] font-bold">
                      Gruppo #{groupIndex + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-slate-900">
                      <User className="w-3.5 h-3.5 text-emerald-700" />
                      {group.personName}
                    </span>
                    <span
                      className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded-md border ${
                        group.direction === 'income'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {group.direction === 'income' ? '+' : '-'}
                      {formatEuro(group.amount)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      <Calendar className="w-3 h-3 text-amber-700" />
                      {group.daysSpan === 0
                        ? 'Stesso giorno (0 gg)'
                        : `Entro ${group.daysSpan} ${
                            group.daysSpan === 1 ? 'giorno' : 'giorni'
                          } (max 7 gg)`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onIgnoreGroupSignature(group.signature)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors self-start sm:self-auto"
                    title="Se questi due movimenti sono entrambi validi (es. due fratelli o due rate diverse), clicca qui per ignorare l'alert su questa coppia"
                  >
                    <EyeOff className="w-3 h-3 text-slate-400" />
                    <span>Non è un duplicato (Ignora)</span>
                  </button>
                </div>

                {/* Group Transactions List with Individual Checkboxes */}
                <div className="divide-y divide-slate-100">
                  {group.allTransactions.map((tx, idx) => {
                    const isOriginal = idx === 0;
                    const isChecked = selectedTxIds.has(tx.id);

                    return (
                      <label
                        key={tx.id}
                        className={`flex items-center justify-between gap-3 px-4 py-3 text-xs transition-colors cursor-pointer select-none ${
                          isChecked
                            ? 'bg-rose-50/70 hover:bg-rose-50'
                            : 'bg-white hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSingleTransaction(tx.id)}
                            className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 mt-0.5 sm:mt-0 cursor-pointer shrink-0"
                          />

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isOriginal ? (
                                <span
                                  className={`px-2 py-0.5 rounded-sm font-mono text-[10px] font-bold uppercase ${
                                    isChecked
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  }`}
                                >
                                  {isChecked
                                    ? 'Selezionato per eliminazione'
                                    : '1° Movimento (Consigliato Mantenere)'}
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-sm font-mono text-[10px] font-bold uppercase ${
                                    isChecked
                                      ? 'bg-rose-600 text-white'
                                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                                  }`}
                                >
                                  {isChecked
                                    ? 'Duplicato Selezionato (Da Eliminare)'
                                    : 'Possibile Duplicato (Non selezionato)'}
                                </span>
                              )}

                              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-sm">
                                Data: {tx.date}
                              </span>

                              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-sm">
                                {tx.category} · {tx.method}
                              </span>
                            </div>

                            <div
                              className={`font-semibold text-sm truncate ${
                                isChecked ? 'line-through text-rose-900/80' : 'text-slate-900'
                              }`}
                            >
                              {tx.description}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`font-mono font-extrabold text-sm tabular-nums ${
                              isChecked
                                ? 'text-rose-700 line-through'
                                : tx.income
                                ? 'text-emerald-700'
                                : 'text-slate-800'
                            }`}
                          >
                            {tx.income ? `+${formatEuro(tx.income)}` : `-${formatEuro(tx.expense)}`}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteSingleImmediate(tx.id, tx.description);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-100/60 rounded-lg transition-colors"
                            title="Elimina subito solo questo movimento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-slate-200 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 flex items-center gap-2 flex-wrap">
            <span>
              Suggerimento: di default il sistema lascia <strong>deselezionato</strong> il 1°
              movimento e <strong>seleziona</strong> le copie successive.
            </span>
            {ignoredCount > 0 && duplicateGroups.length > 0 && (
              <button
                type="button"
                onClick={onResetIgnoredGroups}
                className="text-emerald-700 hover:underline font-semibold inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Mostra {ignoredCount} ignorati</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold transition-colors"
            >
              Chiudi Finestra
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
