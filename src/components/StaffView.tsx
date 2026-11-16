import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Printer,
  UserPlus,
} from 'lucide-react';
import { StaffMember, CashTransaction, PaymentMethod, AssociationProfile } from '../types';
import { formatEuro } from '../utils/finance';
import { TransactionDateSelector } from './TransactionDateSelector';

interface StaffViewProps {
  staff: StaffMember[];
  transactions: CashTransaction[];
  profile: AssociationProfile;
  onAddTransaction: (tx: Omit<CashTransaction, 'id'>) => void;
  onAddStaffMember: (member: StaffMember) => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  staff,
  transactions,
  profile,
  onAddTransaction,
  onAddStaffMember,
}) => {
  const [selectedStaffName, setSelectedStaffName] = useState<string>('ALL');
  const [isAddPaymentModalOpen, setIsAddPaymentModalOpen] = useState(false);
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [selectedReceiptPayment, setSelectedReceiptPayment] = useState<CashTransaction | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // New collaborator form state
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Istruttore Sportivo / Educatore Outdoor');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');

  // Filter staff transactions from cash ledger
  const staffTransactions = transactions.filter((t) => t.category === 'Staff');

  // Total paid to staff
  const totalStaffPaid = staffTransactions.reduce((sum, t) => sum + (t.expense || 0), 0);

  // Grouped payments per collaborator
  const staffSummaries = staff.map((s) => {
    const firstName = s.name.split(' ')[0].toLowerCase();
    const payments = staffTransactions.filter((t) => {
      const desc = t.description.toLowerCase();
      return desc.includes(firstName) || desc.includes(s.name.toLowerCase());
    });
    const total = payments.reduce((sum, p) => sum + (p.expense || 0), 0);
    return {
      member: s,
      totalPaid: total,
      paymentCount: payments.length,
      lastPayment: payments[payments.length - 1]?.date || '-',
    };
  });

  // Filtered transactions
  const displayedTransactions = selectedStaffName === 'ALL'
    ? staffTransactions
    : staffTransactions.filter((t) => t.description.toLowerCase().includes(selectedStaffName.toLowerCase()));

  // Form state for adding staff payment
  const [payStaffName, setPayStaffName] = useState(staff[0]?.name || '');
  const [payAmount, setPayAmount] = useState('');
  const [payDateMode, setPayDateMode] = useState<'today' | 'custom'>('today');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payType, setPayType] = useState('quota_lavoro_sportivo');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bonifico');
  const [payNotes, setPayNotes] = useState('');

  const handleCreateStaffPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amt = parseFloat(payAmount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) {
      setFormError('Inserisci un importo valido maggiore di zero.');
      return;
    }

    const typeLabels: Record<string, string> = {
      quota_lavoro_sportivo: 'Quota lavoro sportivo',
      servizi_guida: 'Servizi guida ed escursioni',
      progettazione: 'Progettazione e coordinamento',
      rimborso_spese: 'Rimborso spese vive (piè di lista)',
    };

    const desc = `${payStaffName} - ${typeLabels[payType] || 'Compenso'}${payNotes ? ` (${payNotes})` : ''}`;
    const effectiveDate =
      payDateMode === 'today' ? new Date().toISOString().slice(0, 10) : payDate;

    onAddTransaction({
      date: effectiveDate,
      category: 'Staff',
      income: null,
      expense: amt,
      method: payMethod,
      description: desc,
    });

    setIsAddPaymentModalOpen(false);
    setPayAmount('');
    setPayNotes('');
  };

  const handleCreateStaffMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    const newCollab: StaffMember = {
      id: `st-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole.trim() || 'Collaboratore Sportivo',
      phone: newStaffPhone.trim(),
      email: newStaffEmail.trim(),
    };
    onAddStaffMember(newCollab);
    setPayStaffName(newCollab.name);
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffEmail('');
    setIsAddStaffModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Normative Banner (Riforma dello Sport) */}
      <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Shield className="w-4 h-4" />
              Conformità Riforma dello Sport (D.Lgs. 36/2021)
            </div>
            <h3 className="text-lg font-bold tracking-tight">
              Registro Compensi e Retribuzioni Collaboratori Sportivi
            </h3>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Tracciamento trasparente dei compensi per lavoro sportivo dilettantistico, prestazioni di coordinamento, servizi guida outdoor e rimborsi spese documentati.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setIsAddStaffModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-all"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuovo Collaboratore</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setIsAddPaymentModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nuovo Compenso Staff</span>
            </button>
          </div>
        </div>
      </div>

      {/* Staff Collaborator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffSummaries.map(({ member, totalPaid, paymentCount, lastPayment }) => (
          <div
            key={member.id}
            className={`p-4 rounded-xl border transition-all cursor-pointer bg-white shadow-2xs ${
              selectedStaffName === member.name.split(' ')[0]
                ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => {
              const firstName = member.name.split(' ')[0];
              setSelectedStaffName(selectedStaffName === firstName ? 'ALL' : firstName);
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{member.name}</h4>
                <p className="text-xs text-slate-500 line-clamp-1">{member.role}</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold font-mono">
                {member.name.charAt(0)}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">
                  Totale Liquidato {profile.activeYear}:
                </span>
                <span className="font-mono font-bold text-slate-900 text-base tabular-nums">
                  {formatEuro(totalPaid)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">
                  Operazioni (Ult: {lastPayment}):
                </span>
                <span className="text-slate-600 font-mono font-medium">{paymentCount} pagamenti</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Staff Payments Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-slate-900 text-sm">
              Storico Compensi Erogati ({displayedTransactions.length} movimenti)
            </h4>
            <p className="text-xs text-slate-500">
              {selectedStaffName === 'ALL'
                ? 'Tutti i compensi e rimborsi registrati a bilancio'
                : `Filtrati per collaboratore: ${selectedStaffName}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selectedStaffName !== 'ALL' && (
              <button
                onClick={() => setSelectedStaffName('ALL')}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Mostra tutti
              </button>
            )}
            <div className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg">
              Totale Staff: {formatEuro(totalStaffPaid)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-28">Data</th>
                <th className="py-3 px-4">Causale di Pagamento</th>
                <th className="py-3 px-4 w-28">Canale</th>
                <th className="py-3 px-4 text-right w-32">Importo Erogato</th>
                <th className="py-3 px-4 text-center w-28">Ricevuta / Quietanza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Nessun pagamento registrato per questo collaboratore.
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 font-medium">
                      {tx.description}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                      {tx.method}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-800 tabular-nums whitespace-nowrap">
                      {formatEuro(tx.expense)}
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => setSelectedReceiptPayment(tx)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-md transition-colors text-[11px] font-medium"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Quietanza PDF</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Payment Modal */}
      {isAddPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Registra Compenso Collaboratore</h3>
              <button
                onClick={() => setIsAddPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaffPayment} className="space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-slate-700 font-medium mb-1">Collaboratore / Operatore *</label>
                <select
                  value={payStaffName}
                  onChange={(e) => setPayStaffName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden bg-white"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.name}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <TransactionDateSelector
                mode={payDateMode}
                customDate={payDate}
                onChangeMode={setPayDateMode}
                onChangeCustomDate={setPayDate}
                label="Con quale data registrare il compenso nel Flusso di Cassa?"
                idPrefix="staff-payment-cash"
              />

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Importo Netto (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="Es. 450.00"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tipologia Compenso *</label>
                  <select
                    value={payType}
                    onChange={(e) => setPayType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden bg-white"
                  >
                    <option value="quota_lavoro_sportivo">Lavoro Sportivo Dilettantistico</option>
                    <option value="servizi_guida">Servizi Guida Ambientale</option>
                    <option value="progettazione">Progettazione e Direzione</option>
                    <option value="rimborso_spese">Rimborso Spese Documentato</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Canale Pagamento *</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden bg-white"
                  >
                    <option value="Bonifico">Bonifico Bancario</option>
                    <option value="Contanti">Contanti</option>
                    <option value="POS">Bancomat / POS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Note o Riferimento Evento</label>
                <input
                  type="text"
                  placeholder="Es. Evento rifugio Forte dei Marmi, benzina..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors font-semibold shadow-xs"
                >
                  Registra Liquidazione
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Collaborator Modal */}
      {isAddStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Aggiungi Collaboratore Sportivo</h3>
              <button
                type="button"
                onClick={() => setIsAddStaffModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaffMember} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nome e Cognome *</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Marco Verdi"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Ruolo / Qualifica *</label>
                <input
                  type="text"
                  required
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Telefono</label>
                  <input
                    type="text"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  Salva Collaboratore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Staff Payment Receipt Modal */}
      {selectedReceiptPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Quietanza di Pagamento Compenso Sportivo</h3>
              <button
                onClick={() => setSelectedReceiptPayment(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            {/* Document Box */}
            <div className="p-6 border border-slate-200 rounded-xl bg-slate-50/50 space-y-4 text-xs font-sans">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase">{profile.name}</h4>
                  <p className="text-[11px] text-slate-500">C.F. {profile.fiscalCode} | {profile.address}</p>
                  <p className="text-[11px] text-slate-500">{profile.affiliation}</p>
                </div>
                <div className="text-right font-mono text-[11px] text-slate-500">
                  Data: {selectedReceiptPayment.date}
                </div>
              </div>

              <div>
                <p className="text-slate-700 leading-relaxed">
                  Si attesta l'avvenuta corresponsione della somma di <strong className="font-mono text-slate-900">{formatEuro(selectedReceiptPayment.expense)}</strong> a favore del collaboratore sportivo per le prestazioni e le attività svolte in attuazione degli scopi istituzionali dell'associazione.
                </p>
                <div className="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Causale registrata:</span>
                  <span className="font-medium text-slate-900">{selectedReceiptPayment.description}</span>
                  <span className="text-slate-500 block mt-1">Canale di accredito: {selectedReceiptPayment.method}</span>
                </div>
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-lg text-[10px] text-emerald-900 border border-emerald-100">
                <strong>Clausola di esenzione fiscale:</strong> Trattamento agevolato ai sensi dell'art. 25 del D.Lgs. 36/2021 (Riforma dello Sport). I compensi da lavoro sportivo nell'area del dilettantismo non costituiscono base imponibile ai fini fiscali fino all'importo annuo complessivo di 15.000,00 euro e sono esenti da contributi previdenziali fino a 5.000,00 euro.
              </div>

              <div className="pt-4 flex flex-wrap justify-between items-end gap-4 text-[11px] text-slate-600">
                <div>
                  Firma del Presidente:<br />
                  <span className="font-semibold text-slate-900 block">{profile.president}</span>
                  {profile.signatureImageDataUrl && (
                    <img
                      src={profile.signatureImageDataUrl}
                      alt="Firma Presidente ASD"
                      className="h-11 w-auto object-contain mt-1"
                    />
                  )}
                </div>
                {profile.stampImageDataUrl && (
                  <div className="flex flex-col items-center">
                    <img
                      src={profile.stampImageDataUrl}
                      alt="Timbro Ufficiale ASD"
                      className="h-16 w-auto object-contain opacity-90"
                    />
                    <span className="text-[9px] uppercase tracking-wider text-slate-400">
                      Timbro ASD
                    </span>
                  </div>
                )}
                <div className="text-right">
                  Firma per quietanza:<br />
                  <span className="italic text-slate-400">Firma del Collaboratore</span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedReceiptPayment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Chiudi
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Stampa Documento</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
