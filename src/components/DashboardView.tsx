import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertCircle,
  Wallet,
  CreditCard,
  Users,
  Download,
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
import { formatEuro, calculateCashTotals } from '../utils/finance';
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
  onUpdateAssembly?: (assembly: AssemblyMeeting) => void;
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
  setActiveTab,
  onUpdateProfile,
  onUpdateAssembly,
  onAddGrant,
}) => {
  const totals = calculateCashTotals(
    transactions,
    initialFund,
    initialFundBank,
    initialFundCash,
    {
      initialPaypal: profile.initialFundPaypal || 0,
      paymentAccounts: profile.paymentAccounts,
      paypalExpenseSourceAccount: profile.paypalExpenseSourceAccount,
      customPaymentAccounts: profile.customPaymentAccounts,
    }
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
  const isEmptyYear = members.length === 0 && transactions.length === 0;

  return (
    <div className="space-y-5">
      {/* Row 1: 4 Essential KPI Cards — Clean Tabular Numbers, No Clutter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Saldo Cassa Attuale */}
        <div
          onClick={() => setActiveTab('cashflow')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setActiveTab('cashflow');
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Saldo Disponibile</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
            {formatEuro(totals.currentTotal)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-500 font-mono tabular-nums">
            <span>C/C: {formatEuro(totals.currentBank)}</span>
            <span>·</span>
            <span>PayPal: {formatEuro(totals.currentPaypal)}</span>
            <span>·</span>
            <span>Cont.: {formatEuro(totals.currentCash)}</span>
          </div>
        </div>

        {/* 2. Totale Entrate */}
        <div
          onClick={() => setActiveTab('cashflow')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setActiveTab('cashflow');
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Entrate {profile.activeYear}</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-emerald-700 font-mono tabular-nums tracking-tight">
            {formatEuro(totals.totalIncome)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Versamenti registrati</span>
            <span className="font-mono font-semibold text-slate-700 tabular-nums">
              {transactions.filter((t) => (t.income || 0) > 0).length}
            </span>
          </div>
        </div>

        {/* 3. Totale Uscite */}
        <div
          onClick={() => setActiveTab('cashflow')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setActiveTab('cashflow');
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Uscite {profile.activeYear}</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-rose-700 font-mono tabular-nums tracking-tight">
            {formatEuro(totals.totalExpense)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Saldo netto periodo</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                totals.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {totals.netBalance >= 0 ? '+' : ''}
              {formatEuro(totals.netBalance)}
            </span>
          </div>
        </div>

        {/* 4. Da Incassare & Tessere in Sospeso */}
        <div
          onClick={() => setActiveTab('notifications')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setActiveTab('notifications');
          }}
          className={`p-4 rounded-xl border transition-colors cursor-pointer ${
            totalPendingAmount > 0 || pendingMembersCount > 0
              ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Da Incassare (Eventi)</span>
            <AlertCircle
              className={`w-4 h-4 ${
                totalPendingAmount > 0 ? 'text-amber-600' : 'text-slate-400'
              }`}
            />
          </div>
          <div className="mt-1.5 text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
            {formatEuro(totalPendingAmount)}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-600">
            <span>{pendingBookings.length} saldi evento</span>
            <span>·</span>
            <span className="font-semibold text-amber-800">
              {pendingMembersCount} tessere da saldare
            </span>
          </div>
        </div>
      </div>

      {/* Empty State Quick Setup Bar if starting a brand new year */}
      {isEmptyYear && (
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-600 font-medium">
            Anno <strong>{profile.activeYear}</strong> pronto: importa l&apos;elenco soci o registra i primi movimenti.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadEmptyExcelTemplate('soci')}
              className="flex items-center gap-1 px-3 py-1.5 font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Modello Excel Soci</span>
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className="flex items-center gap-1 px-3 py-1.5 font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Vai a Soci</span>
            </button>
          </div>
        </div>
      )}

      {/* Row 2: 2-Column Main Operational Workspace (Left: Compact Deadlines Accordion | Right: Recent Movements + Cards Summary) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (7 cols): Compact Expandable Deadlines */}
        <div className="lg:col-span-7">
          <CriticalDeadlinesWidget
            profile={profile}
            assemblies={assemblies}
            grants={grants}
            roles={roles}
            onUpdateProfile={onUpdateProfile}
            onUpdateAssembly={onUpdateAssembly}
            onAddGrant={onAddGrant}
            setActiveTab={setActiveTab}
          />
        </div>

        {/* Right Column (5 cols): Recent Cash Movements + Compact Membership Summary */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Ultimi Movimenti di Cassa */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                  Ultimi Movimenti
                </h3>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  · {transactions.length} tot.
                </span>
              </div>
              <button
                onClick={() => setActiveTab('cashflow')}
                className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1"
              >
                <span>Libro Cassa</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-slate-400">
                Nessun movimento registrato.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setActiveTab('cashflow')}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">
                        {tx.description}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono tabular-nums">{tx.date}</span>
                        <span>·</span>
                        <span className="text-slate-600">{tx.category}</span>
                        <span>·</span>
                        <span>{tx.method}</span>
                      </div>
                    </div>
                    <div className="shrink-0 font-mono font-bold tabular-nums text-xs">
                      {tx.income ? (
                        <span className="text-emerald-700">+{formatEuro(tx.income)}</span>
                      ) : (
                        <span className="text-rose-700">-{formatEuro(tx.expense)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Compact Membership & Insurance Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-slate-900 text-sm tracking-tight">
                  Soci &amp; Tessere ({members.length})
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('cards')}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Tessere
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                >
                  <span>Anagrafica</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {(['Base', 'Summer', 'Gold', 'Platinum'] as const).map((type) => (
                <div
                  key={type}
                  onClick={() => setActiveTab('cards')}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/70 text-center cursor-pointer transition-colors"
                >
                  <div className="text-[10px] text-slate-500 font-semibold truncate">
                    {getInsuranceDisplayLabel(type, profile)}
                  </div>
                  <div className="text-base font-extrabold text-slate-900 font-mono tabular-nums mt-0.5">
                    {members.filter((m) => m.insuranceType === type).length}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
