import React, { useState, useEffect } from 'react';
import {
  Building2,
  Award,
  CreditCard,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
} from 'lucide-react';
import {
  AssociationProfile,
  CardTypeConfig,
  AgeGroupConfig,
  CashCategoryConfig,
  EventCategoryConfig,
} from '../types';
import {
  deriveAssociationId,
  DEFAULT_CARD_TYPES,
  DEFAULT_AGE_GROUPS,
  DEFAULT_CASH_CATEGORIES,
  DEFAULT_EVENT_CATEGORIES,
  DEFAULT_DEADLINE_TEMPLATES_US_ACLI,
  DEFAULT_DEADLINE_TEMPLATES_GENERIC_ASD,
} from '../utils/migrations';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  profile: AssociationProfile;
  onClose: () => void;
  onSaveProfile: (updated: AssociationProfile) => void;
}

const AFFILIATION_SUGGESTIONS = [
  'Affiliata US ACLI',
  'Affiliata CSEN',
  'Affiliata UISP',
  'Affiliata AICS',
  'Affiliata ASI',
  'Affiliata OPES',
  'Affiliata CSI',
  'Federazione Sportiva (FSN)',
  'Associazione Autonoma / Non Affiliata',
];

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  profile,
  onClose,
  onSaveProfile,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [draft, setDraft] = useState<AssociationProfile>(profile);

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...profile,
        cardTypes:
          profile.cardTypes && profile.cardTypes.length > 0
            ? profile.cardTypes
            : DEFAULT_CARD_TYPES.map((c) => ({ ...c })),
        ageGroups:
          profile.ageGroups && profile.ageGroups.length > 0
            ? profile.ageGroups
            : DEFAULT_AGE_GROUPS.map((g) => ({ ...g })),
        cashCategories:
          profile.cashCategories && profile.cashCategories.length > 0
            ? profile.cashCategories
            : DEFAULT_CASH_CATEGORIES.map((c) => ({ ...c })),
        eventCategories:
          profile.eventCategories && profile.eventCategories.length > 0
            ? profile.eventCategories
            : DEFAULT_EVENT_CATEGORIES.map((c) => ({ ...c })),
      });
      setStep(1);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleToggleAdultMembers = (checked: boolean) => {
    let nextGroups = [...(draft.ageGroups || DEFAULT_AGE_GROUPS)];
    if (checked && !nextGroups.some((g) => g.id.toLowerCase() === 'adulti')) {
      nextGroups.push({ id: 'Adulti', label: 'Adulti (18+ anni)', minAge: 18, maxAge: 99 });
    }
    setDraft({
      ...draft,
      hasAdultMembers: checked,
      ageGroups: nextGroups,
    });
  };

  const handleSelectDeadlinePreset = (preset: 'us_acli' | 'asd_generica') => {
    setDraft({
      ...draft,
      deadlinePreset: preset,
      deadlineTemplates: (
        preset === 'us_acli'
          ? DEFAULT_DEADLINE_TEMPLATES_US_ACLI
          : DEFAULT_DEADLINE_TEMPLATES_GENERIC_ASD
      ).map((d) => ({ ...d })),
    });
  };

  const handleAddCardType = () => {
    const next: CardTypeConfig[] = [
      ...(draft.cardTypes || []),
      { id: `Tessera_${(draft.cardTypes?.length || 0) + 1}`, label: 'Nuova Tessera', defaultPrice: 15 },
    ];
    setDraft({ ...draft, cardTypes: next });
  };

  const handleAddAgeGroup = () => {
    const next: AgeGroupConfig[] = [
      ...(draft.ageGroups || []),
      { id: `Gruppo_${(draft.ageGroups?.length || 0) + 1}`, label: 'Nuova Fascia' },
    ];
    setDraft({ ...draft, ageGroups: next });
  };

  const handleAddCashCategory = () => {
    const next: CashCategoryConfig[] = [
      ...(draft.cashCategories || []),
      {
        id: `Cat_${(draft.cashCategories?.length || 0) + 1}`,
        label: 'Nuova Categoria Cassa',
        kind: 'entrambe',
      },
    ];
    setDraft({ ...draft, cashCategories: next });
  };

  const handleAddEventCategory = () => {
    const next: EventCategoryConfig[] = [
      ...(draft.eventCategories || []),
      {
        id: `ev_cat_${(draft.eventCategories?.length || 0) + 1}`,
        label: 'Nuova Tipologia Evento',
        cashCategoryId: 'Evento',
      },
    ];
    setDraft({ ...draft, eventCategories: next });
  };

  const handleFinish = () => {
    const cleanName = draft.name.trim() || 'Associazione Sportiva Dilettantistica';
    const updated: AssociationProfile = {
      ...draft,
      name: cleanName,
      associationId: deriveAssociationId({ ...draft, name: cleanName }),
      onboardingCompleted: true,
    };
    onSaveProfile(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
              Configurazione Guidata Multi-Associazione — Passo {step} di 4
            </span>
            <h2 className="text-base font-extrabold mt-0.5">
              Personalizza il Gestionale per la tua Associazione
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Chiudi configurazione guidata"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 text-xs font-semibold">
          {[
            { n: 1 as const, label: '1. Dati Associazione', icon: Building2 },
            { n: 2 as const, label: '2. Ente & Scadenze', icon: Award },
            { n: 3 as const, label: '3. Tessere & Fasce Età', icon: CreditCard },
            { n: 4 as const, label: '4. Categorie Cassa/Eventi', icon: Layers },
          ].map((s) => {
            const Icon = s.icon;
            const active = step === s.n;
            const done = step > s.n;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n)}
                className={`py-3 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                  active
                    ? 'border-emerald-600 text-emerald-800 bg-white font-bold'
                    : done
                      ? 'border-emerald-300 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="p-6 max-h-[68vh] overflow-y-auto space-y-5 text-xs">
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                Inserisci i dati anagrafici della tua associazione. Verranno usati automaticamente
                nelle ricevute PDF, nelle tessere digitali, nei verbali e nei file esportati sul tuo
                Google Drive.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Denominazione Associazione *
                  </label>
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Es. ASD Polisportiva Verde / APS Natura"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Forma Giuridica
                  </label>
                  <input
                    type="text"
                    value={draft.legalType}
                    onChange={(e) => setDraft({ ...draft, legalType: e.target.value })}
                    placeholder="Associazione Sportiva Dilettantistica"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Codice Fiscale Associazione
                  </label>
                  <input
                    type="text"
                    value={draft.fiscalCode}
                    onChange={(e) =>
                      setDraft({ ...draft, fiscalCode: e.target.value.toUpperCase() })
                    }
                    placeholder="Es. 94012340456"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Presidente / Legale Rappresentante
                  </label>
                  <input
                    type="text"
                    value={draft.president}
                    onChange={(e) => setDraft({ ...draft, president: e.target.value })}
                    placeholder="Nome e Cognome del Presidente"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sede Legale / Indirizzo
                  </label>
                  <input
                    type="text"
                    value={draft.address}
                    onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                    placeholder="Via, CAP, Città (Provincia)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Email Segreteria
                  </label>
                  <input
                    type="email"
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    placeholder="segreteria@associazione.it"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Telefono Segreteria
                  </label>
                  <input
                    type="text"
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                    placeholder="+39 333 ..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    IBAN Conto Corrente Associazione
                  </label>
                  <input
                    type="text"
                    value={draft.iban}
                    onChange={(e) => setDraft({ ...draft, iban: e.target.value.toUpperCase() })}
                    placeholder="IT00 X000 0000 0000 0000 0000 000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Anno Sportivo Attivo
                  </label>
                  <input
                    type="number"
                    value={draft.activeYear}
                    onChange={(e) =>
                      setDraft({ ...draft, activeYear: Number(e.target.value) || 2027 })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.hasAdultMembers)}
                    onChange={(e) => handleToggleAdultMembers(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600"
                  />
                  <div>
                    <div className="font-bold text-slate-900">
                      La nostra associazione tesserà anche Soci Adulti (non solo minori)
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Se attivo, le etichette &ldquo;Bimbo/a&rdquo; diventano{' '}
                      <strong>&ldquo;Socio / Partecipante&rdquo;</strong> e per i soci maggiorenni i
                      campi del genitore/tutore non sono obbligatori.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.showApuacampAttributionInDocs)}
                    onChange={(e) =>
                      setDraft({ ...draft, showApuacampAttributionInDocs: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-300 text-emerald-600"
                  />
                  <div>
                    <div className="font-bold text-slate-900">
                      Includi dicitura &ldquo;Piattaforma Gestionale ideata da ASD Apuacamp&rdquo;
                      anche nei PDF / Tessere generati
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Se disattivato (predefinito per le altre associazioni), le ricevute e le
                      tessere PDF riportano esclusivamente il nome della tua associazione.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Ente di Promozione Sportiva (EPS) / Federazione (FSN) / Affiliazione
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Scrivi liberamente il tuo ente di affiliazione oppure clicca su uno dei
                  suggerimenti rapidi qui sotto:
                </p>
                <input
                  type="text"
                  value={draft.affiliation}
                  onChange={(e) => setDraft({ ...draft, affiliation: e.target.value })}
                  placeholder="Es. Affiliata US ACLI / CSEN / UISP / CSI / AICS..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                />
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {AFFILIATION_SUGGESTIONS.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setDraft({ ...draft, affiliation: sug })}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                        draft.affiliation === sug
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-3">
                <div className="font-bold text-slate-800">
                  Preset Scadenze Statutarie & Fiscali
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectDeadlinePreset('asd_generica')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      draft.deadlinePreset !== 'us_acli'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900">Preset ASD / APS Generica</div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Scadenze universali per qualsiasi associazione sportiva (Rendiconto annuale,
                      Rinnovo affiliazione EPS/RASD, Comunicazioni mensili lavoro sportivo, CU).
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectDeadlinePreset('us_acli')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      draft.deadlinePreset === 'us_acli'
                        ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold text-slate-900">Preset Affiliata US ACLI</div>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Include il calendario tesseramento US ACLI (1° settembre / Tessera 365) oltre
                      alle scadenze RASD e rendiconto annuale.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              {/* Card Types */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      Tipologie di Tessera / Copertura Assicurativa
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Configura i codici e le etichette delle tessere della tua associazione.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCardType}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi Tessera</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(draft.cardTypes || []).map((ct, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200"
                    >
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={ct.id}
                          onChange={(e) => {
                            const next = [...(draft.cardTypes || [])];
                            next[idx] = { ...ct, id: e.target.value };
                            setDraft({ ...draft, cardTypes: next });
                          }}
                          placeholder="Codice (es. Base)"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-6">
                        <input
                          type="text"
                          value={ct.label}
                          onChange={(e) => {
                            const next = [...(draft.cardTypes || [])];
                            next[idx] = { ...ct, label: e.target.value };
                            setDraft({ ...draft, cardTypes: next });
                          }}
                          placeholder="Nome visualizzato (es. Tessera Base)"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={ct.defaultPrice ?? ''}
                          onChange={(e) => {
                            const next = [...(draft.cardTypes || [])];
                            next[idx] = {
                              ...ct,
                              defaultPrice: e.target.value ? Number(e.target.value) : undefined,
                            };
                            setDraft({ ...draft, cardTypes: next });
                          }}
                          placeholder="Quota €"
                          className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {(draft.cardTypes || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = (draft.cardTypes || []).filter((_, i) => i !== idx);
                              setDraft({ ...draft, cardTypes: next });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Age Groups */}
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      Fasce d&apos;Età / Gruppi Soci
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Personalizza le fasce d&apos;età o le categorie dei soci (es. 3-6, 6-11,
                      11-14, Adulti, Corsisti...).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAgeGroup}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi Gruppo</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(draft.ageGroups || []).map((ag, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200"
                    >
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={ag.id}
                          onChange={(e) => {
                            const next = [...(draft.ageGroups || [])];
                            next[idx] = { ...ag, id: e.target.value };
                            setDraft({ ...draft, ageGroups: next });
                          }}
                          placeholder="ID (es. 6-11 o Adulti)"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-7">
                        <input
                          type="text"
                          value={ag.label}
                          onChange={(e) => {
                            const next = [...(draft.ageGroups || [])];
                            next[idx] = { ...ag, label: e.target.value };
                            setDraft({ ...draft, ageGroups: next });
                          }}
                          placeholder="Etichetta (es. 6-11 anni o Soci Adulti)"
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {(draft.ageGroups || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = (draft.ageGroups || []).filter((_, i) => i !== idx);
                              setDraft({ ...draft, ageGroups: next });
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              {/* Cash Categories */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Categorie Libro Cassa</h4>
                    <p className="text-[11px] text-slate-500">
                      Voci contabili per classificare entrate e uscite.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCashCategory}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi Categoria Cassa</span>
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {(draft.cashCategories || []).map((cc, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200"
                    >
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={cc.id}
                          onChange={(e) => {
                            const next = [...(draft.cashCategories || [])];
                            next[idx] = { ...cc, id: e.target.value };
                            setDraft({ ...draft, cashCategories: next });
                          }}
                          className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={cc.label}
                          onChange={(e) => {
                            const next = [...(draft.cashCategories || [])];
                            next[idx] = { ...cc, label: e.target.value };
                            setDraft({ ...draft, cashCategories: next });
                          }}
                          className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={cc.kind}
                          onChange={(e) => {
                            const next = [...(draft.cashCategories || [])];
                            next[idx] = {
                              ...cc,
                              kind: e.target.value as 'entrata' | 'uscita' | 'entrambe',
                            };
                            setDraft({ ...draft, cashCategories: next });
                          }}
                          className="w-full px-1.5 py-1 rounded border border-slate-300 bg-white text-[11px]"
                        >
                          <option value="entrambe">Entrata/Uscita</option>
                          <option value="entrata">Solo Entrata</option>
                          <option value="uscita">Solo Uscita</option>
                        </select>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {(draft.cashCategories || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = (draft.cashCategories || []).filter(
                                (_, i) => i !== idx
                              );
                              setDraft({ ...draft, cashCategories: next });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Event Categories */}
              <div className="pt-4 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">Tipologie di Evento / Attività</h4>
                    <p className="text-[11px] text-slate-500">
                      Collegate alla rispettiva categoria del Libro Cassa per la registrazione
                      automatica di caparre e saldi.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEventCategory}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Aggiungi Tipologia Evento</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {(draft.eventCategories || []).map((ec, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200"
                    >
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={ec.id}
                          onChange={(e) => {
                            const next = [...(draft.eventCategories || [])];
                            next[idx] = { ...ec, id: e.target.value };
                            setDraft({ ...draft, eventCategories: next });
                          }}
                          className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-5">
                        <input
                          type="text"
                          value={ec.label}
                          onChange={(e) => {
                            const next = [...(draft.eventCategories || [])];
                            next[idx] = { ...ec, label: e.target.value };
                            setDraft({ ...draft, eventCategories: next });
                          }}
                          className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="text"
                          value={ec.cashCategoryId}
                          onChange={(e) => {
                            const next = [...(draft.eventCategories || [])];
                            next[idx] = { ...ec, cashCategoryId: e.target.value };
                            setDraft({ ...draft, eventCategories: next });
                          }}
                          placeholder="Categoria Cassa"
                          className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {(draft.eventCategories || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = (draft.eventCategories || []).filter(
                                (_, i) => i !== idx
                              );
                              setDraft({ ...draft, eventCategories: next });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Indietro</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Configura più tardi
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
              >
                <span>Avanti</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Salva e Completa Configurazione</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
