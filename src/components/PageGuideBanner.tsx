import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Sparkles,
  HardDrive,
  CheckCircle2,
  Search,
  ArrowRight,
  Printer,
} from 'lucide-react';
import { NavTab } from './Sidebar';
import { getPageGuide, getAllPageGuides, PageGuideContent } from '../utils/pageGuides';

interface PageGuideBannerProps {
  activeTab: NavTab;
  onNavigateTab: (tab: NavTab) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  isFullManualOpen: boolean;
  onOpenFullManual: () => void;
  onCloseFullManual: () => void;
}

export const PageGuideBanner: React.FC<PageGuideBannerProps> = ({
  activeTab,
  onNavigateTab,
  isExpanded,
  onToggleExpanded,
  isFullManualOpen,
  onOpenFullManual,
  onCloseFullManual,
}) => {
  const currentGuide = getPageGuide(activeTab);
  const allGuides = getAllPageGuides();

  const [manualSearch, setManualSearch] = useState('');
  const [selectedManualTab, setSelectedManualTab] = useState<NavTab | 'ALL'>('ALL');

  const filteredManualGuides: PageGuideContent[] = allGuides.filter((g) => {
    if (selectedManualTab !== 'ALL' && g.tabId !== selectedManualTab) return false;
    if (!manualSearch.trim()) return true;
    const q = manualSearch.toLowerCase();
    return (
      g.title.toLowerCase().includes(q) ||
      g.overview.toLowerCase().includes(q) ||
      g.features.some(
        (f) => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
      ) ||
      g.proTips.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <>
      {/* Per-Page Contextual Guide Panel (On-Demand via Header "? Guida" button - Soluzione 2) */}
      {isExpanded && (
        <div
          id="contextual-page-guide-panel"
          className="no-print mb-6 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/60 shadow-sm overflow-hidden transition-all animate-in fade-in duration-150"
        >
          {/* Compact Header Bar */}
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                    Guida Contestuale
                  </span>
                  <h3 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                    {currentGuide.title}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-600 truncate mt-0.5">
                  {currentGuide.shortSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenFullManual}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-700" />
                <span>Manuale Completo (12 Pagine)</span>
              </button>

              <button
                id="btn-close-contextual-guide"
                type="button"
                onClick={onToggleExpanded}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-2xs"
              >
                <span>Chiudi Guida ✕</span>
              </button>
            </div>
          </div>

          {/* Expanded Contextual Guide Content for Current Page */}
          <div className="px-5 pb-5 pt-3 border-t border-emerald-200/70 bg-white/95 space-y-4 text-xs">
            {/* Overview Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 leading-relaxed">
              <strong className="text-slate-900 block mb-1 text-xs uppercase tracking-wider">
                A cosa serve questa sezione:
              </strong>
              {currentGuide.overview}
            </div>

            {/* Specific Page Features Grid */}
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Funzioni specifiche disponibili in questa pagina:</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentGuide.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between gap-2 hover:border-emerald-300 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-xs mb-1">{feat.title}</div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {feat.description}
                      </p>
                    </div>
                    {feat.actionHint && (
                      <div className="pt-2 border-t border-slate-100 text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Come fare: {feat.actionHint}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Tips & Google Drive Integration Note */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-1">
              <div className="lg:col-span-7 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                <div className="font-bold text-amber-950 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Consigli Operativi & Automazioni Collegate</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-900 leading-relaxed">
                  {currentGuide.proTips.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>

              <div className="lg:col-span-5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col justify-center space-y-1">
                <div className="font-bold text-blue-950 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                  <span>Memoria & Sincronizzazione Google Drive / File PC</span>
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  {currentGuide.driveIntegrationNote}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL INTERACTIVE HANDBOOK MODAL (ALL 11 PAGES) */}
      {isFullManualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full p-6 my-6 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                    Manuale Operativo Completo del Gestionale ASD (Guida Pagina per Pagina)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tutte le istruzioni d&apos;uso per la segreteria, gli educatori e il consiglio
                    direttivo (12 sezioni operative aggiornate).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Stampa Manuale</span>
                </button>
                <button
                  type="button"
                  onClick={onCloseFullManual}
                  aria-label="Chiudi manuale"
                  className="text-slate-400 hover:text-slate-600 p-1.5 text-lg leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Search & Section Filter Bar */}
            <div className="no-print py-3 border-b border-slate-100 space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cerca una funzione nel manuale (es. Tessera 365, Google Form, Timbro, Bandi, Briefing, Excel)..."
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedManualTab('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                    selectedManualTab === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tutte le 12 Pagine
                </button>
                {allGuides.map((g) => (
                  <button
                    key={g.tabId}
                    type="button"
                    onClick={() => setSelectedManualTab(g.tabId)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                      selectedManualTab === g.tabId
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {g.title.replace('Guida alla Pagina: ', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable All-Pages Guide Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
              {filteredManualGuides.map((guide) => (
                <div
                  key={guide.tabId}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                        Sezione Gestionale
                      </span>
                      <h3 className="font-bold text-slate-900 text-base mt-1">{guide.title}</h3>
                      <p className="text-xs text-slate-600 mt-0.5">{guide.overview}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTab(guide.tabId);
                        onCloseFullManual();
                      }}
                      className="no-print flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shrink-0 shadow-2xs"
                    >
                      <span>Vai a questa Pagina</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {guide.features.map((feat, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5"
                      >
                        <div className="font-bold text-slate-900 text-xs">{feat.title}</div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          {feat.description}
                        </p>
                        {feat.actionHint && (
                          <div className="text-[11px] font-semibold text-emerald-800 pt-1">
                            → {feat.actionHint}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 text-[11px]">
                    <div className="flex-1 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                      <strong className="block mb-1">Consigli Pratici:</strong>
                      <ul className="list-disc list-inside space-y-0.5">
                        {guide.proTips.map((t, idx) => (
                          <li key={idx}>{t}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="sm:w-1/3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                      <strong className="block mb-1">Google Drive:</strong>
                      {guide.driveIntegrationNote}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="no-print pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Suggerimento: su ogni pagina del gestionale trovi sempre in alto il banner{' '}
                <strong>&quot;Guida Pagina&quot;</strong> con le istruzioni specifiche di quella
                schermata.
              </span>
              <button
                type="button"
                onClick={onCloseFullManual}
                className="px-4 py-2 rounded-lg font-semibold bg-slate-900 text-white hover:bg-slate-800"
              >
                Chiudi Manuale
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
