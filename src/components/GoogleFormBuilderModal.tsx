import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  Star,
  Sparkles,
  Save,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import {
  AssociationProfile,
  GoogleFormFieldConfig,
  GoogleFormQuestionType,
  GoogleFormTargetArea,
} from '../types';
import {
  DEFAULT_GOOGLE_FORM_FIELDS,
  SUGGESTED_EXTRA_FORM_FIELDS,
  resolveProfileFormFields,
} from '../utils/formAndReceiptTemplates';
import { newId } from '../utils/ids';

interface GoogleFormBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormType: GoogleFormTargetArea;
  initialTitle: string;
  initialDescription: string;
  profile: AssociationProfile;
  googleUserEmail: string | null;
  onSaveStandardFieldsToProfile: (updatedFields: GoogleFormFieldConfig[]) => void;
  onConfirmGenerateForm?: (params: {
    title: string;
    description: string;
    formType: GoogleFormTargetArea;
    fields: GoogleFormFieldConfig[];
  }) => Promise<void>;
  isGenerating?: boolean;
}

export const GoogleFormBuilderModal: React.FC<GoogleFormBuilderModalProps> = ({
  isOpen,
  onClose,
  initialFormType,
  initialTitle,
  initialDescription,
  profile,
  googleUserEmail,
  onSaveStandardFieldsToProfile,
  onConfirmGenerateForm,
  isGenerating = false,
}) => {
  const [formType, setFormType] = useState<GoogleFormTargetArea>(initialFormType);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [allFields, setAllFields] = useState<GoogleFormFieldConfig[]>(() =>
    resolveProfileFormFields(profile)
  );
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // New custom field state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<GoogleFormQuestionType>('paragraph');
  const [newOptions, setNewOptions] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [newIsStandard, setNewIsStandard] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setFormType(initialFormType);
      setTitle(initialTitle);
      setDescription(initialDescription);
      setAllFields(resolveProfileFormFields(profile));
      setSavedNotice(null);
    }
  }, [isOpen, initialFormType, initialTitle, initialDescription, profile]);

  if (!isOpen) return null;

  // Fields applicable to the selected form type (or marked as Standard for all forms)
  const visibleFields = allFields.filter(
    (f) => f.isStandardForAllForms || f.applicableAreas.includes(formType)
  );

  const activeCount = visibleFields.filter((f) => f.enabledByDefault !== false).length;
  const standardCount = allFields.filter((f) => f.isStandardForAllForms).length;

  const updateField = (id: string, patch: Partial<GoogleFormFieldConfig>) => {
    setAllFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const handleMoveField = (id: string, direction: 'up' | 'down') => {
    setAllFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  };

  const handleDeleteField = (id: string) => {
    setAllFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleAddCustomField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const opts =
      newType === 'radio' || newType === 'checkbox'
        ? newOptions
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined;

    const created: GoogleFormFieldConfig = {
      id: newId('custom-f'),
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      questionType: newType,
      options: opts && opts.length > 0 ? opts : undefined,
      required: newRequired,
      isStandardForAllForms: newIsStandard,
      applicableAreas: newIsStandard
        ? ['tesseramento', 'evento', 'gadget']
        : [formType],
      enabledByDefault: true,
      mapsTo: 'notesConditions',
    };

    const next = [...allFields, created];
    setAllFields(next);
    onSaveStandardFieldsToProfile(next);

    setNewTitle('');
    setNewDesc('');
    setNewOptions('');
    setSavedNotice(
      `Campo "${created.title}" aggiunto${
        newIsStandard ? ' come Campo Standard per ogni modulo' : ''
      }!`
    );
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleAddSuggestedField = (tpl: Omit<GoogleFormFieldConfig, 'id'>) => {
    const exists = allFields.some(
      (f) => f.title.trim().toLowerCase() === tpl.title.trim().toLowerCase()
    );
    if (exists) {
      setSavedNotice('Questo campo suggerito è già presente nell\'elenco.');
      setTimeout(() => setSavedNotice(null), 2500);
      return;
    }

    const created: GoogleFormFieldConfig = {
      ...tpl,
      id: newId('sug-f'),
    };
    const next = [...allFields, created];
    setAllFields(next);
    onSaveStandardFieldsToProfile(next);
    setSavedNotice(`Aggiunto campo suggerito: "${tpl.title}"`);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleSaveStandardConfig = () => {
    onSaveStandardFieldsToProfile(allFields);
    setSavedNotice(
      'Configurazione dei Campi Standard e Personalizzati salvata nel profilo ASD!'
    );
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const handleResetDefaultFields = () => {
    if (
      !confirm(
        'Vuoi ripristinare l\'elenco predefinito dei campi del Modulo Google (inclusi i campi standard per allergie, bisogni speciali e autonomie)?'
      )
    ) {
      return;
    }
    setAllFields(DEFAULT_GOOGLE_FORM_FIELDS);
    onSaveStandardFieldsToProfile(DEFAULT_GOOGLE_FORM_FIELDS);
    setSavedNotice('Campi predefiniti ripristinati.');
  };

  const handleGenerateNow = async () => {
    onSaveStandardFieldsToProfile(allFields);
    if (!onConfirmGenerateForm) return;
    const selectedFields = visibleFields.filter((f) => f.enabledByDefault !== false);
    await onConfirmGenerateForm({
      title: title.trim() || 'Modulo Iscrizione ASD',
      description: description.trim(),
      formType,
      fields: selectedFields,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full p-6 my-6 max-h-[92vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-200 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Configuratore Moduli Google Personalizzati & Campi Standard ASD
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Scegli, modifica o aggiungi i campi del Modulo Google direttamente dal gestionale. I
                campi contrassegnati con{' '}
                <span className="font-semibold text-amber-700">★ Standard in ogni modulo</span>{' '}
                (come bisogni speciali approfonditi, allergie e autonomie) vengono inclusi in
                automatico in tutti i moduli generati.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi configuratore modulo Google"
            className="text-slate-400 hover:text-slate-700 text-lg leading-none p-1"
          >
            ✕
          </button>
        </div>

        {savedNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {savedNotice}
            </span>
            <button onClick={() => setSavedNotice(null)} className="font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Form Type Selector & Title / Description */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
          <div>
            <label className="block text-slate-700 font-bold mb-1">
              Tipologia Modulo da Configurare
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as GoogleFormTargetArea)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900"
            >
              <option value="tesseramento">Modulo Anagrafica Soci & Tesseramento</option>
              <option value="evento">Modulo Iscrizione Evento / Campo / Uscita</option>
              <option value="gadget">Modulo Prenotazione Gadget</option>
            </select>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                ★ {standardCount} Campi Standard
              </span>
              <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                {activeCount} Campi Attivi
              </span>
            </div>
          </div>

          <div className="md:col-span-2 space-y-2.5">
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Titolo del Modulo Google
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-semibold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Descrizione / Testo Introduttivo del Modulo
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Suggested Extra Deep-Dive Fields Bar */}
        <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-bold text-purple-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Suggerimenti Rapidi (Clicca per aggiungere domande approfondite su bisogni speciali,
              deleghe o farmaci):
            </span>
            <button
              type="button"
              onClick={handleResetDefaultFields}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Ripristina Default</span>
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_EXTRA_FORM_FIELDS.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleAddSuggestedField(sug)}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100 text-purple-900 border border-purple-200 text-[11px] font-medium transition-colors flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3 h-3 text-purple-600" />
                <span>{sug.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Editable List of Fields */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Elenco Campi del Modulo ({visibleFields.length} domande — spunta quelli da includere e
              personalizza i testi)
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setAllFields((prev) =>
                    prev.map((f) => ({ ...f, enabledByDefault: true }))
                  )
                }
                className="text-[11px] font-semibold text-emerald-700 hover:underline"
              >
                Seleziona tutti
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {visibleFields.map((field, idx) => {
              const isEnabled = field.enabledByDefault !== false;
              return (
                <div
                  key={field.id}
                  className={`p-3 rounded-xl border transition-all text-xs space-y-2 ${
                    isEnabled
                      ? 'bg-white border-slate-200 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={(e) =>
                          updateField(field.id, { enabledByDefault: e.target.checked })
                        }
                        className="rounded border-slate-300 text-emerald-600 w-4 h-4"
                        title="Includi questo campo nel modulo Google"
                      />
                      <span className="font-mono text-[11px] text-slate-400 font-bold">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={field.title}
                        onChange={(e) => updateField(field.id, { title: e.target.value })}
                        className="flex-1 px-2.5 py-1 rounded-md border border-slate-200 font-bold text-slate-900 bg-slate-50/50 focus:bg-white"
                        placeholder="Titolo della domanda nel Modulo Google..."
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Toggle Standard in every form */}
                      <button
                        type="button"
                        onClick={() =>
                          updateField(field.id, {
                            isStandardForAllForms: !field.isStandardForAllForms,
                          })
                        }
                        className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 transition-colors ${
                          field.isStandardForAllForms
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:text-slate-800'
                        }`}
                        title="Se attivo, questo campo viene implementato automaticamente in OGNI modulo Google generato"
                      >
                        <Star
                          className={`w-3 h-3 ${
                            field.isStandardForAllForms ? 'fill-amber-500 text-amber-600' : ''
                          }`}
                        />
                        <span>
                          {field.isStandardForAllForms ? 'Standard (Ogni Modulo)' : 'Solo Specifico'}
                        </span>
                      </button>

                      {/* Question Type Selector */}
                      <select
                        value={field.questionType}
                        onChange={(e) =>
                          updateField(field.id, {
                            questionType: e.target.value as GoogleFormQuestionType,
                          })
                        }
                        className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-700"
                      >
                        <option value="short_text">Risposta Breve</option>
                        <option value="paragraph">Paragrafo Approfondito</option>
                        <option value="radio">Scelta Multipla (Radio)</option>
                        <option value="checkbox">Caselle di Controllo</option>
                      </select>

                      {/* Required checkbox */}
                      <label className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateField(field.id, { required: e.target.checked })
                          }
                          className="rounded border-slate-300"
                        />
                        <span>Obblig.</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleMoveField(field.id, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-700"
                        title="Sposta in alto"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveField(field.id, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-700"
                        title="Sposta in basso"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteField(field.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Rimuovi campo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description / Help text & Options if Choice question */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                    <input
                      type="text"
                      value={field.description || ''}
                      onChange={(e) =>
                        updateField(field.id, { description: e.target.value })
                      }
                      placeholder="Sottotitolo / istruzione per il genitore (es. dettagli bisogni speciali, protocolli...)"
                      className="w-full px-2.5 py-1 rounded-md border border-slate-200 text-[11px] text-slate-600"
                    />
                    {(field.questionType === 'radio' || field.questionType === 'checkbox') && (
                      <input
                        type="text"
                        value={(field.options || []).join(', ')}
                        onChange={(e) =>
                          updateField(field.id, {
                            options: e.target.value.split(',').map((s) => s.trim()),
                          })
                        }
                        placeholder="Opzioni separate da virgola (es. Sì, No, Altro)"
                        className="w-full px-2.5 py-1 rounded-md border border-purple-200 bg-purple-50/30 text-[11px] text-purple-950 font-medium"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Custom Field Form */}
        <form
          onSubmit={handleAddCustomField}
          className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
        >
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-emerald-600" />
            <span>Aggiungi Nuovo Campo / Domanda Approfondita al Modulo</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titolo domanda (es. Indicazioni approfondite per bisogni speciali / abitudini / paure)"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium"
              />
            </div>
            <div>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as GoogleFormQuestionType)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-medium"
              >
                <option value="paragraph">Paragrafo Lungo (Approfondimento)</option>
                <option value="short_text">Testo Breve</option>
                <option value="radio">Scelta Multipla (Radio)</option>
                <option value="checkbox">Caselle di Controllo (Checkbox)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Sottotitolo / suggerimento per chi compila il modulo (opzionale)"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
              />
            </div>
            {(newType === 'radio' || newType === 'checkbox') && (
              <div>
                <input
                  type="text"
                  value={newOptions}
                  onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="Opzioni separate da virgola (es. Opzione 1, Opzione 2)"
                  className="w-full px-3 py-1.5 rounded-lg border border-purple-200 bg-white text-[11px]"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-1.5 font-semibold text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsStandard}
                  onChange={(e) => setNewIsStandard(e.target.checked)}
                  className="rounded border-amber-300 text-amber-600"
                />
                <span>★ Imposta come Campo Standard (includi sempre in ogni modulo generato)</span>
              </label>

              <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newRequired}
                  onChange={(e) => setNewRequired(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>Domanda obbligatoria</span>
              </label>
            </div>

            <button
              type="submit"
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Aggiungi Campo all'Elenco</span>
            </button>
          </div>
        </form>

        {/* Bottom Actions */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSaveStandardConfig}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salva Campi Standard sul Gestionale</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Chiudi
            </button>
            {onConfirmGenerateForm && (
              <button
                type="button"
                onClick={handleGenerateNow}
                disabled={isGenerating || !googleUserEmail}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 rounded-lg transition-colors shadow-xs"
              >
                {isGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>
                  {googleUserEmail
                    ? `Genera Modulo Google (${activeCount} Campi)`
                    : 'Connetti Google per Generare su Drive'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
