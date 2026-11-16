import React, { useState } from 'react';
import { Calendar, Clock } from 'lucide-react';

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatIsoToItalian(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export interface TransactionDateSelectorProps {
  value?: string;
  onChange?: (newIsoDate: string) => void;
  mode?: 'today' | 'custom';
  onChangeMode?: (mode: 'today' | 'custom') => void;
  dateMode?: 'today' | 'custom';
  onDateModeChange?: (mode: 'today' | 'custom') => void;
  customDate?: string;
  onChangeCustomDate?: (newIsoDate: string) => void;
  onCustomDateChange?: (newIsoDate: string) => void;
  label?: string;
  compact?: boolean;
  idPrefix?: string;
}

export const TransactionDateSelector: React.FC<TransactionDateSelectorProps> = ({
  value,
  onChange,
  mode,
  onChangeMode,
  dateMode,
  onDateModeChange,
  customDate,
  onChangeCustomDate,
  onCustomDateChange,
  label = 'Con quale data vuoi registrare il movimento nel Flusso di Cassa?',
  compact = false,
  idPrefix = 'tx-date',
}) => {
  const todayIso = getTodayIsoDate();
  const effectiveValue = customDate ?? value ?? todayIso;
  const controlledMode = mode ?? dateMode;

  const [internalMode, setInternalMode] = useState<'today' | 'custom'>(() =>
    !effectiveValue || effectiveValue === todayIso ? 'today' : 'custom'
  );

  const activeMode = controlledMode ?? internalMode;

  const updateMode = (nextMode: 'today' | 'custom') => {
    setInternalMode(nextMode);
    onChangeMode?.(nextMode);
    onDateModeChange?.(nextMode);
  };

  const updateDate = (nextDate: string) => {
    onChange?.(nextDate);
    onChangeCustomDate?.(nextDate);
    onCustomDateChange?.(nextDate);
  };

  const handleSelectToday = () => {
    updateMode('today');
    updateDate(todayIso);
  };

  const handleSelectCustom = () => {
    updateMode('custom');
  };

  const displayDate = activeMode === 'today' ? todayIso : effectiveValue || todayIso;

  return (
    <div
      className={`rounded-xl border border-emerald-200 bg-emerald-50/50 ${
        compact ? 'p-2.5 space-y-2' : 'p-3.5 space-y-2.5'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>{label}</span>
        </label>
        <span className="text-[10px] font-mono font-semibold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
          Data Cassa: {formatIsoToItalian(displayDate)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          id={`${idPrefix}-mode-today`}
          type="button"
          onClick={handleSelectToday}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all ${
            activeMode === 'today'
              ? 'bg-emerald-700 text-white border-emerald-700 font-semibold shadow-2xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <div className="min-w-0">
            <div className="truncate">Data di Oggi (Attuale)</div>
            <div
              className={`text-[10px] font-mono ${
                activeMode === 'today' ? 'text-emerald-100' : 'text-slate-400'
              }`}
            >
              {formatIsoToItalian(todayIso)}
            </div>
          </div>
        </button>

        <button
          id={`${idPrefix}-mode-custom`}
          type="button"
          onClick={handleSelectCustom}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-xs transition-all ${
            activeMode === 'custom'
              ? 'bg-slate-900 text-white border-slate-900 font-semibold shadow-2xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <div className="min-w-0">
            <div className="truncate">Data Diversa (Reale)</div>
            <div
              className={`text-[10px] ${
                activeMode === 'custom' ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              Scegli data effettiva
            </div>
          </div>
        </button>
      </div>

      {activeMode === 'custom' && (
        <div className="pt-1 flex items-center gap-2 animate-in fade-in duration-150">
          <span className="text-[11px] font-semibold text-slate-700 shrink-0">
            Data effettiva movimento:
          </span>
          <input
            id={`${idPrefix}-input-date`}
            type="date"
            required
            value={effectiveValue}
            onChange={(e) => updateDate(e.target.value)}
            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-900 focus:border-emerald-600 focus:outline-hidden"
          />
        </div>
      )}
    </div>
  );
};
