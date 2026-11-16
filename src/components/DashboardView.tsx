import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Coins,
  ArrowRight,
  AlertCircle,
  Download,
  HardDrive,
  ShieldCheck,
  Users,
  Calendar,
  FolderOpen,
  Save,
  CreditCard,
} from 'lucide-react';
import {
  CashTransaction,
  Member,
  EventBooking,
  EventItem,
  AssociationProfile,
  AssemblyMeeting,
  GrantItem,
  AssociationRole,
} from '../types';
import {
  formatEuro,
  calculateCashTotals,
  calculateMonthlyCashFlow,
  calculateCategoryBreakdown,
} from '../utils/finance';
import { NavTab } from './Sidebar';
import { downloadEmptyExcelTemplate } from '../utils/csvExcelImporter';
import { CriticalDeadlinesWidget } from './CriticalDeadlinesWidget';
import { getInsuranceDisplayLabel } from '../utils/digitalCard';

interface DashboardViewProps {
  transactions: CashTransaction[];
  members: Member[];
  bookings: EventBooking[];
  events: EventItem[];
  profile: AssociationProfile;
  assemblies: AssemblyMeeting[];
  grants: GrantItem[];
  roles: AssociationRole[];
  initialFund: number;
  initialFundBank: number;
  initialFundCash: number;
  googleUserEmail: string | null;
  localFileName?: string | null;
  onConnectLocalFile?: () => void;
  onSaveLocalFile?: () => void;
  setActiveTab: (tab: NavTab) => void;
  onUpdateProfile: (profile: AssociationProfile) => void;
  onAddGrant?: (grant: Omit<GrantItem, 'id'>) => void;
  onSelectMemberForReceipt: (member: Member) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  members,
  bookings,
  profile,
  assemblies,
  grants,
  roles,
  initialFund,
  initialFundBank,
  initialFundCash,
  googleUserEmail,
  localFileName,
  onConnectLocalFile,
  onSaveLocalFile,
  setActiveTab,
  onUpdateProfile,
  onAddGrant,
}) => {
  const totals = calculateCashTotals(
    transactions,
    initialFund,
    initialFundBank,
    initialFundCash
  );
  const monthlyFlow = calculateMonthlyCashFlow(transactions);
  const { incomeCategories } = calculateCategoryBreakdown(transactions);

  const maxMonthlyVal = Math.max(
    ...monthlyFlow.map((m) => Math.max(m.income, m.expense)),
    1000
  );

  const pendingMembersCount = members.filter((m) => !m.isPaid).length;
  const pendingBookings = bookings.filter(
    (b) => b.confirmed && !b.isBalancePaid && b.balanceAmount > 0
  );
  const totalPendingAmount = pendingBookings.reduce(
    (sum, b) => sum + b.balanceAmount,
    0
  );

  const recentTransactions = transactions.slice(0, 6);
  const membersWithAllergies = members.filter((m) => m.allergies && m.allergies.trim().length > 0);
  const membersNoPhoto = members.filter((m) => !m.photoConsent);

  const isEmpty2027 = members.length === 0 && transactions.length === 0;

  const [isYearPickerOpen, setIsYearPickerOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      {/* Slim Status Strip & Discreet Clickable Year Selector (Soluzione 3) */}
      <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-bold text-slate-900">{profile.name}</span>
          <span>·</span>

          {/* Discreet Clickable Active Year */}
          <div className="relative inline-flex items-center">
            <button
              id="btn-dashboard-year-picker"
              type="button"
              onClick={() => setIsYearPickerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 font-mono font-bold text-[11px] transition-colors"
              title="Clicca sull'anno per cambiare annualità attiva o consultare l'archivio degli anni passati"
            >
              <Calendar className="w-3 h-3 text-emerald-700" />
              <span>Anno {profile.activeYear} ▾</span>
            </button>

            {isYearPickerOpen && (
              <div className="ml-2 inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 animate-in fade-in duration-150">
                {[2026, 2027, 2028, 2029].map((yr) => (
                  <button
                    key={yr}
                    id={`btn-dashboard-year-${yr}`}
                    type="button"
                    onClick={() => {
                      onUpdateProfile({ ...profile, activeYear: yr });
                      setIsYearPickerOpen(false);
                    }}
                    className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] transition-colors ${
                      profile.activeYear === yr
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 hover:bg-emerald-100 hover:text-emerald-900'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setIsYearPickerOpen(false);
                    setActiveTab('backup');
                  }}
                  className="ml-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                >
                  Archivio →
                </button>
              </div>
            )}
          </div>

          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline text-[11px] text-slate-500">
            Salvataggio sicuro:{' '}
            {googleUserEmail ? (
              <strong className="text-emerald-800">Google Drive ({googleUserEmail})</strong>
            ) : localFileName ? (
              <strong className="text-blue-800">File PC ({localFileName})</strong>
            ) : (
              <span>Google Drive o File Locale su PC (`.json`)</span>
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onConnectLocalFile && (
            <button
              id="btn-dashboard-open-local-file"
              type="button"
              onClick={onConnectLocalFile}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              title="Apri o collega un file .json sul tuo PC (anche in cartella OneDrive o Dropbox)"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-700" />
              <span>{localFileName ? `File: ${localFileName}` : 'Collega File PC'}</span>
            </button>
          )}
          {onSaveLocalFile && (
            <button
              id="btn-dashboard-save-local-file"
              type="button"
              onClick={onSaveLocalFile}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
              title="Salva subito il database in un file .json sul tuo PC"
            >
              <Save className="w-3.5 h-3.5 text-emerald-700" />
              <span>Salva PC</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('backup')}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
          >
            <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            <span>Drive & Archivio Anni</span>
          </button>

          {isEmpty2027 && (
            <>
              <button
                onClick={() => downloadEmptyExcelTemplate('soci')}
                title="Scarica Modello Soci Vuoto (.xlsx)"
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Modello Soci</span>
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Importa Soci</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Financial Strips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Saldo Cassa Attuale</span>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm">
              Fondo + Flusso
            </span>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
            {formatEuro(totals.currentTotal)}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Saldo Netto Periodo:</span>
            <span
              className={`font-mono font-semibold ${
                totals.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {totals.netBalance >= 0 ? '+' : ''}
              {formatEuro(totals.netBalance)}
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Totale Entrate</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-800 font-mono tabular-nums tracking-tight">
            {formatEuro(totals.totalIncome)}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Operazioni di entrata:</span>
            <span className="font-mono text-slate-700 font-medium">
              {transactions.filter((t) => (t.income || 0) > 0).length} versamenti
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Totale Uscite & Spese</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-800 font-mono tabular-nums tracking-tight">
            {formatEuro(totals.totalExpense)}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Staff, tasse, forniture:</span>
            <span className="font-mono text-slate-700 font-medium">
              {transactions.filter((t) => (t.expense || 0) > 0).length} uscite
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Disponibilità per Canale</div>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Conto Corrente:
              </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatEuro(totals.currentBank)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                Cassa Contanti:
              </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatEuro(totals.currentCash)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
            Fondo iniziale impostato: {formatEuro(totals.initialFund)}
          </div>
        </div>
      </div>

      {/* Critical Solar Year Deadlines & Temporal Progress Bar Widget */}
      <CriticalDeadlinesWidget
        profile={profile}
        assemblies={assemblies}
        grants={grants}
        roles={roles}
        onUpdateProfile={onUpdateProfile}
        onAddGrant={onAddGrant}
        setActiveTab={setActiveTab}
      />

      {/* Alert Bar for Uncollected Balances & Insurance Level-Up */}
      {(pendingBookings.length > 0 || pendingMembersCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <span className="font-bold">Attenzione ai pagamenti in sospeso:</span> Ci sono{' '}
              <span className="font-semibold underline">
                {pendingBookings.length} saldi evento
              </span>{' '}
              da incassare (totale {formatEuro(totalPendingAmount)}) e{' '}
              <span className="font-semibold">{pendingMembersCount} tessere</span> non ancora
              regolarizzate.
            </div>
          </div>
          <button
            onClick={() => setActiveTab('notifications')}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg font-medium transition-colors whitespace-nowrap self-end sm:self-auto"
          >
            Vedi Scadenze
          </button>
        </div>
      )}

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                Andamento Economico Mensile
              </h3>
              <p className="text-xs text-slate-500">
                Confronto tra entrate lorde e uscite per ciascun mese
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600"></span>
                Entrate
              </span>
              <span className="flex items-center gap-1.5 text-rose-800">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500"></span>
                Uscite
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-10 gap-2 h-48 items-end">
              {monthlyFlow.map((month) => {
                const incomePercent = Math.min(
                  100,
                  Math.round((month.income / maxMonthlyVal) * 100)
                );
                const expensePercent = Math.min(
                  100,
                  Math.round((month.expense / maxMonthlyVal) * 100)
                );
                const shortLabel = month.monthLabel.slice(0, 3);

                return (
                  <div
                    key={month.monthKey}
                    className="flex flex-col items-center h-full justify-end group"
                  >
                    <div className="w-full flex items-end justify-center gap-1 h-36">
                      <div
                        style={{ height: `${Math.max(4, incomePercent)}%` }}
                        className="w-1/2 bg-emerald-600 rounded-t-xs hover:bg-emerald-500 transition-all"
                        title={`${month.monthLabel} Entrate: ${formatEuro(month.income)}`}
                      />
                      <div
                        style={{ height: `${Math.max(4, expensePercent)}%` }}
                        className="w-1/2 bg-rose-500 rounded-t-xs hover:bg-rose-400 transition-all"
                        title={`${month.monthLabel} Uscite: ${formatEuro(month.expense)}`}
                      />
                    </div>
                    <span className="mt-2 text-[10px] text-slate-500 font-medium text-center uppercase">
                      {shortLabel}
                    </span>
                    <span className="text-[9px] font-mono text-slate-400 tabular-nums">
                      {month.income > 0 ? `${Math.round(month.income / 1000)}k` : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm tracking-tight mb-1">
              Top Voci di Entrata
            </h3>
            <p className="text-xs text-slate-500 mb-4">Ripartizione delle entrate associative</p>

            {incomeCategories.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                Nessuna entrata ancora registrata nel periodo selezionato.
              </div>
            ) : (
              <div className="space-y-3">
                {incomeCategories.slice(0, 5).map((cat) => {
                  const sharePercent =
                    Math.round((cat.totalIncome / (totals.totalIncome || 1)) * 100) || 0;
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-800">{cat.category}</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatEuro(cat.totalIncome)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          style={{ width: `${sharePercent}%` }}
                          className="bg-emerald-600 h-full rounded-full"
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 flex justify-between">
                        <span>{cat.count} movimenti</span>
                        <span>{sharePercent}% del totale</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={() => setActiveTab('cashflow')}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <span>Apri Libro Cassa Completo</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Row: Recent Movements & Member Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                Ultimi Movimenti di Cassa
              </h3>
              <p className="text-xs text-slate-500">
                Transazioni recenti registrate nel libro contabile
              </p>
            </div>
            <button
              onClick={() => setActiveTab('cashflow')}
              className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1"
            >
              Tutti ({transactions.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Nessun movimento registrato. Vai in "Flusso di Cassa" per registrare o importare
              movimenti.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((tx) => (
                <div
                  key={tx.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">{tx.description}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span className="font-mono">{tx.date}</span>
                      <span>·</span>
                      <span className="text-slate-600">{tx.category}</span>
                      <span>·</span>
                      <span className="text-slate-500">{tx.method}</span>
                    </div>
                  </div>
                  <div className="shrink-0 font-mono font-bold tabular-nums">
                    {tx.income ? (
                      <span className="text-emerald-700">+{formatEuro(tx.income)}</span>
                    ) : (
                      <span className="text-slate-700">-{formatEuro(tx.expense)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members Status & Insurance Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                Tesseramento & Assicurazioni UsAcli
              </h3>
              <p className="text-xs text-slate-500">
                Totale iscritti in anagrafica: {members.length}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('cards')}
                className="text-xs text-purple-700 hover:text-purple-800 font-semibold flex items-center gap-1"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Sezione Tessere</span>
              </button>
              <button
                onClick={() => setActiveTab('members')}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1"
              >
                Apri Anagrafica
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">
                {getInsuranceDisplayLabel('Base', profile)}
              </div>
              <div className="text-lg font-bold text-slate-800 font-mono mt-1">
                {members.filter((m) => m.insuranceType === 'Base').length}
              </div>
            </div>
            <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-100 text-center">
              <div className="text-[10px] text-emerald-700 uppercase font-semibold">
                {getInsuranceDisplayLabel('Summer', profile)}
              </div>
              <div className="text-lg font-bold text-emerald-800 font-mono mt-1">
                {members.filter((m) => m.insuranceType === 'Summer').length}
              </div>
            </div>
            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100 text-center">
              <div className="text-[10px] text-amber-700 uppercase font-semibold">
                {getInsuranceDisplayLabel('Gold', profile)}
              </div>
              <div className="text-lg font-bold text-amber-800 font-mono mt-1">
                {members.filter((m) => m.insuranceType === 'Gold').length}
              </div>
            </div>
            <div className="p-3 bg-purple-50/60 rounded-lg border border-purple-100 text-center">
              <div className="text-[10px] text-purple-700 uppercase font-semibold">
                {getInsuranceDisplayLabel('Platinum', profile)}
              </div>
              <div className="text-lg font-bold text-purple-800 font-mono mt-1">
                {members.filter((m) => m.insuranceType === 'Platinum').length}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>
              Soci con allergie segnalate: <strong>{membersWithAllergies.length}</strong> · Senza
              consenso foto: <strong>{membersNoPhoto.length}</strong>
            </span>
            <button
              onClick={() => setActiveTab('governance')}
              className="text-emerald-700 font-semibold hover:underline flex items-center gap-1"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Governance & Drive</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
