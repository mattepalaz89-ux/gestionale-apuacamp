import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Send,
  FileSpreadsheet,
  Upload,
  Trash2,
} from 'lucide-react';
import {
  GadgetItem,
  GadgetOrder,
  Member,
  PaymentMethod,
  AssociationProfile,
} from '../types';
import { formatEuro } from '../utils/finance';
import {
  downloadEmptyExcelTemplate,
  readUploadedSpreadsheetRows,
  normalizePaymentMethod,
} from '../utils/csvExcelImporter';
import { generateReceiptEmailLink } from '../utils/export';
import { TransactionDateSelector } from './TransactionDateSelector';

interface GadgetsViewProps {
  gadgets: GadgetItem[];
  gadgetOrders: GadgetOrder[];
  members: Member[];
  profile: AssociationProfile;
  onAddGadgetItem: (item: Omit<GadgetItem, 'id'>) => void;
  onAddGadgetOrder: (order: Omit<GadgetOrder, 'id'>, registerInCashFlow: boolean) => void;
  onUpdateGadgetOrder: (order: GadgetOrder) => void;
  onDeleteGadgetOrder: (id: string) => void;
  onImportGadgetOrders: (orders: GadgetOrder[]) => void;
}

export const GadgetsView: React.FC<GadgetsViewProps> = ({
  gadgets,
  gadgetOrders,
  members,
  profile,
  onAddGadgetItem,
  onAddGadgetOrder,
  onUpdateGadgetOrder,
  onDeleteGadgetOrder,
  onImportGadgetOrders,
}) => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'UNPAID' | 'UNDELIVERED' | 'EMAIL_PENDING'>('ALL');
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [isAddCatalogOpen, setIsAddCatalogOpen] = useState(false);

  // Order form state
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [childName, setChildName] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [selectedGadgetId, setSelectedGadgetId] = useState(gadgets[0]?.id || '');
  const [variant, setVariant] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(gadgets[0]?.unitPrice || 15);
  const [isPaid, setIsPaid] = useState(false);
  const [isDelivered, setIsDelivered] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Bonifico');
  const [registerInCashFlow, setRegisterInCashFlow] = useState(true);
  const [orderDateMode, setOrderDateMode] = useState<'today' | 'custom'>('today');
  const [orderCustomDate, setOrderCustomDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');

  // Catalog item form state
  const [newGadgetName, setNewGadgetName] = useState('');
  const [newGadgetCategory, setNewGadgetCategory] = useState<'abbigliamento' | 'accessori' | 'attrezzatura'>('abbigliamento');
  const [newGadgetPrice, setNewGadgetPrice] = useState(15);
  const [newGadgetVariants, setNewGadgetVariants] = useState('Taglie: 6-8, 9-11, 12-14, S, M, L');
  const [newGadgetStock, setNewGadgetStock] = useState(25);

  const handleSelectMember = (mId: string) => {
    setSelectedMemberId(mId);
    if (!mId) return;
    const m = members.find((mem) => mem.id === mId);
    if (m) {
      setChildName(m.childName);
      setParentName(m.parentName);
      setParentEmail(m.parentEmail || '');
      setParentPhone(m.parentPhone || '');
    }
  };

  const handleSelectGadget = (gId: string) => {
    setSelectedGadgetId(gId);
    const g = gadgets.find((item) => item.id === gId);
    if (g) {
      setUnitPrice(g.unitPrice);
    }
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!childName.trim()) {
      alert('Inserisci il nome del socio / bimbo');
      return;
    }
    const g = gadgets.find((item) => item.id === selectedGadgetId);
    const gadgetName = g ? g.name : 'Gadget Apuacamp';
    const totalPrice = (Number(quantity) || 1) * (Number(unitPrice) || 0);
    const effectiveOrderDate =
      orderDateMode === 'today' ? new Date().toISOString().slice(0, 10) : orderCustomDate;

    onAddGadgetOrder(
      {
        date: effectiveOrderDate,
        childName: childName.trim(),
        parentName: parentName.trim(),
        parentEmail: parentEmail.trim(),
        parentPhone: parentPhone.trim(),
        gadgetId: selectedGadgetId,
        gadgetName,
        variant: variant.trim() || 'Standard',
        quantity: Number(quantity) || 1,
        unitPrice: Number(unitPrice) || 0,
        totalPrice,
        isPaid,
        isDelivered,
        paymentMethod,
        confirmationEmailSent: false,
        notes: notes.trim(),
      },
      isPaid && registerInCashFlow
    );

    setIsAddOrderOpen(false);
    setSelectedMemberId('');
    setChildName('');
    setParentName('');
    setParentEmail('');
    setParentPhone('');
    setVariant('');
    setQuantity(1);
    setNotes('');
  };

  const handleCreateCatalogItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGadgetName.trim()) return;
    onAddGadgetItem({
      name: newGadgetName.trim(),
      category: newGadgetCategory,
      unitPrice: Number(newGadgetPrice) || 10,
      variants: newGadgetVariants.trim(),
      stockCount: Number(newGadgetStock) || 0,
    });
    setIsAddCatalogOpen(false);
    setNewGadgetName('');
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readUploadedSpreadsheetRows(file);
      if (rows.length <= 1) {
        alert('Il file selezionato è vuoto.');
        return;
      }
      const imported: GadgetOrder[] = [];
      rows.slice(1).forEach((r, idx) => {
        const cName = (r[1] || r[0] || '').trim();
        if (!cName || cName.toLowerCase().includes('esempio')) return;
        const qty = parseInt(r[7] || '1', 10) || 1;
        const uPrice = parseFloat((r[8] || '15').replace(',', '.')) || 15;
        const paidFlag = (r[9] || '').toUpperCase().trim();
        const delivFlag = (r[10] || '').toUpperCase().trim();
        imported.push({
          id: `go-imp-${Date.now()}-${idx}`,
          date: r[0] && r[0].includes('-') ? r[0] : new Date().toISOString().slice(0, 10),
          childName: cName,
          parentName: (r[2] || '').trim(),
          parentEmail: (r[3] || '').trim(),
          parentPhone: (r[4] || '').trim(),
          gadgetId: gadgets[0]?.id || 'gd-01',
          gadgetName: (r[5] || 'Maglietta Apuacamp').trim(),
          variant: (r[6] || 'Standard').trim(),
          quantity: qty,
          unitPrice: uPrice,
          totalPrice: qty * uPrice,
          isPaid: paidFlag === 'SI' || paidFlag === 'TRUE',
          isDelivered: delivFlag === 'SI' || delivFlag === 'TRUE',
          paymentMethod: normalizePaymentMethod(r[11] || 'Bonifico'),
          confirmationEmailSent: false,
          notes: (r[12] || '').trim(),
        });
      });

      if (imported.length > 0) {
        onImportGadgetOrders(imported);
        alert(`Importate ${imported.length} prenotazioni gadget! Controlla gli alert per le email di conferma da inviare.`);
      } else {
        alert('Nessuna riga valida trovata nel file.');
      }
    } catch (err) {
      console.error(err);
      alert('Errore nella lettura del file Excel/CSV.');
    }
    e.target.value = '';
  };

  const filteredOrders = useMemo(() => {
    return gadgetOrders.filter((o) => {
      if (filterStatus === 'UNPAID' && o.isPaid) return false;
      if (filterStatus === 'UNDELIVERED' && o.isDelivered) return false;
      if (filterStatus === 'EMAIL_PENDING' && o.confirmationEmailSent) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          o.childName.toLowerCase().includes(q) ||
          o.parentName.toLowerCase().includes(q) ||
          o.gadgetName.toLowerCase().includes(q) ||
          o.variant.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [gadgetOrders, filterStatus, search]);

  const totalCollected = gadgetOrders
    .filter((o) => o.isPaid)
    .reduce((acc, o) => acc + o.totalPrice, 0);
  const totalPending = gadgetOrders
    .filter((o) => !o.isPaid)
    .reduce((acc, o) => acc + o.totalPrice, 0);
  const pendingEmailsCount = gadgetOrders.filter((o) => !o.confirmationEmailSent).length;

  return (
    <div className="space-y-6">
      {/* Top KPI Cards & Catalog Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Prenotazioni Gadget</div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono mt-1 tabular-nums">
            {gadgetOrders.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {gadgetOrders.filter((o) => !o.isDelivered).length} ancora da consegnare
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Incassato da Gadget</div>
          <div className="text-2xl font-extrabold text-emerald-700 font-mono mt-1 tabular-nums">
            {formatEuro(totalCollected)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Da incassare: {formatEuro(totalPending)}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Email Conferma da Inviare</div>
          <div className="text-2xl font-extrabold text-amber-700 font-mono mt-1 tabular-nums">
            {pendingEmailsCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Notifiche attive per ordini senza mail
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div className="text-xs text-slate-500 font-medium">Catalogo Merchandising</div>
          <div className="text-sm font-bold text-slate-800 mt-1">
            {gadgets.length} articoli a listino
          </div>
          <button
            onClick={() => setIsAddCatalogOpen(true)}
            className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Aggiungi Articolo a Catalogo</span>
          </button>
        </div>
      </div>

      {/* Catalog Strip */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
          Listino Gadget & Disponibilità Magazzino
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {gadgets.map((g) => (
            <div
              key={g.id}
              className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col justify-between"
            >
              <div>
                <div className="font-bold text-slate-900 text-xs">{g.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{g.variants}</div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-emerald-800">
                  {formatEuro(g.unitPrice)}
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Stock: {g.stockCount} pz
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter & Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca socio, genitore o articolo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-xs">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600'
              }`}
            >
              Tutti ({gadgetOrders.length})
            </button>
            <button
              onClick={() => setFilterStatus('EMAIL_PENDING')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'EMAIL_PENDING'
                  ? 'bg-white text-amber-800 shadow-2xs font-semibold'
                  : 'text-slate-600'
              }`}
            >
              Email da Inviare ({pendingEmailsCount})
            </button>
            <button
              onClick={() => setFilterStatus('UNPAID')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'UNPAID'
                  ? 'bg-white text-rose-800 shadow-2xs font-semibold'
                  : 'text-slate-600'
              }`}
            >
              Da Pagare
            </button>
            <button
              onClick={() => setFilterStatus('UNDELIVERED')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                filterStatus === 'UNDELIVERED'
                  ? 'bg-white text-blue-800 shadow-2xs font-semibold'
                  : 'text-slate-600'
              }`}
            >
              Da Consegnare
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => downloadEmptyExcelTemplate('gadget')}
            className="flex items-center justify-center p-2 text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            title="Scarica modello Excel vuoto (.xlsx) per ordini gadget"
            aria-label="Scarica modello Excel vuoto (.xlsx) per ordini gadget"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Importa Excel/CSV</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUploadExcel}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setIsAddOrderOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova Prenotazione Gadget</span>
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Data</th>
                <th className="py-3 px-4">Socio / Genitore</th>
                <th className="py-3 px-4">Articolo & Taglia</th>
                <th className="py-3 px-4 text-right">Totale</th>
                <th className="py-3 px-4 text-center">Pagamento</th>
                <th className="py-3 px-4 text-center">Consegna</th>
                <th className="py-3 px-4 text-center">Stato Email</th>
                <th className="py-3 px-4 text-center">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Nessuna prenotazione gadget presente. Clicca su "Nuova Prenotazione Gadget" o importa da Excel.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const mailLink = generateReceiptEmailLink({
                    toEmail: order.parentEmail,
                    parentName: order.parentName || order.childName,
                    childName: order.childName,
                    activityName: `Prenotazione Gadget: ${order.gadgetName} (${order.variant} x${order.quantity})`,
                    amount: order.totalPrice,
                    type: order.isPaid ? 'ricevuta' : 'preventivo',
                    association: profile,
                  });

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {order.date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{order.childName}</div>
                        <div className="text-[11px] text-slate-500">
                          {order.parentName} {order.parentEmail ? `· ${order.parentEmail}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{order.gadgetName}</div>
                        <div className="text-[11px] text-slate-500">
                          {order.variant} · Qtà: <strong className="font-mono">{order.quantity}</strong>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatEuro(order.totalPrice)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() =>
                            onUpdateGadgetOrder({ ...order, isPaid: !order.isPaid })
                          }
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                            order.isPaid
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {order.isPaid ? 'Pagato ✓' : 'Da pagare'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() =>
                            onUpdateGadgetOrder({
                              ...order,
                              isDelivered: !order.isDelivered,
                            })
                          }
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                            order.isDelivered
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {order.isDelivered ? 'Consegnato ✓' : 'Da consegnare'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() =>
                            onUpdateGadgetOrder({
                              ...order,
                              confirmationEmailSent: !order.confirmationEmailSent,
                              confirmationEmailSentAt: !order.confirmationEmailSent
                                ? new Date().toISOString()
                                : undefined,
                            })
                          }
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                            order.confirmationEmailSent
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {order.confirmationEmailSent ? 'Email Inviata ✓' : 'Da Inviare !'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <a
                            href={mailLink}
                            onClick={() =>
                              onUpdateGadgetOrder({
                                ...order,
                                confirmationEmailSent: true,
                                confirmationEmailSentAt: new Date().toISOString(),
                              })
                            }
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="Apri client email con conferma/ricevuta precompilata e segna come inviata"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => onDeleteGadgetOrder(order.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Elimina ordine"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Gadget Order Modal */}
      {isAddOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">
                Registra Prenotazione Gadget
              </h3>
              <button
                onClick={() => setIsAddOrderOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Seleziona Socio dall'Anagrafica (Opzionale)
                </label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => handleSelectMember(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">-- Compila manualmente oppure scegli un tesserato --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.childName} (Genitore: {m.parentName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nome Bimbo/a *</label>
                  <input
                    type="text"
                    required
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Nome Genitore</label>
                  <input
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-700 font-medium mb-1">
                    Email Genitore (per invio preventivo/ricevuta)
                  </label>
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Articolo Gadget *</label>
                  <select
                    value={selectedGadgetId}
                    onChange={(e) => handleSelectGadget(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                  >
                    {gadgets.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({formatEuro(g.unitPrice)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Taglia / Variante</label>
                  <input
                    type="text"
                    placeholder="Es. Taglia 9-11 anni / M"
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Quantità *</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Prezzo Unitario (€) *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-600"
                  />
                  <span className="font-medium">Già Pagato</span>
                </label>

                <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDelivered}
                    onChange={(e) => setIsDelivered(e.target.checked)}
                    className="rounded-sm border-slate-300 text-emerald-600"
                  />
                  <span className="font-medium">Già Consegnato</span>
                </label>
              </div>

              {isPaid && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-emerald-900">Canale Pagamento:</span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="px-2 py-1 rounded-md border border-emerald-300 bg-white text-xs"
                    >
                      <option value="Bonifico">Bonifico</option>
                      <option value="Contanti">Contanti</option>
                      <option value="POS">POS</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-emerald-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={registerInCashFlow}
                      onChange={(e) => setRegisterInCashFlow(e.target.checked)}
                    />
                    <span>Registra automaticamente l'entrata nel Flusso di Cassa</span>
                  </label>

                  {registerInCashFlow && (
                    <TransactionDateSelector
                      mode={orderDateMode}
                      customDate={orderCustomDate}
                      onChangeMode={setOrderDateMode}
                      onChangeCustomDate={setOrderCustomDate}
                      label="Data di registrazione nel Flusso di Cassa:"
                      idPrefix="gadget-order-cash"
                    />
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOrderOpen(false)}
                  className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  Salva Prenotazione
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Catalog Item Modal */}
      {isAddCatalogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <h3 className="font-bold text-slate-900 text-base mb-4">
              Nuovo Articolo a Catalogo Gadget
            </h3>
            <form onSubmit={handleCreateCatalogItem} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nome Articolo *</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Borraccia Termica Apuacamp"
                  value={newGadgetName}
                  onChange={(e) => setNewGadgetName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Categoria *</label>
                <select
                  value={newGadgetCategory}
                  onChange={(e) =>
                    setNewGadgetCategory(
                      e.target.value as 'abbigliamento' | 'accessori' | 'attrezzatura'
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="abbigliamento">Abbigliamento</option>
                  <option value="accessori">Accessori</option>
                  <option value="attrezzatura">Attrezzatura Outdoor / Speleo</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Prezzo (€) *</label>
                  <input
                    type="number"
                    step="0.5"
                    value={newGadgetPrice}
                    onChange={(e) => setNewGadgetPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Stock Magazzino</label>
                  <input
                    type="number"
                    value={newGadgetStock}
                    onChange={(e) => setNewGadgetStock(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Varianti / Taglie</label>
                <input
                  type="text"
                  value={newGadgetVariants}
                  onChange={(e) => setNewGadgetVariants(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCatalogOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-semibold"
                >
                  Aggiungi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
