import {
  AssociationProfile,
  EmailTemplateConfig,
  EmailTemplateId,
  GoogleFormFieldConfig,
  GoogleFormTargetArea,
  ImageOverlayConfig,
  Member,
  ReceiptDynamicField,
  ReceiptLayoutTemplateId,
  ReceiptLineItem,
  ReceiptTemplateConfig,
} from '../types';
import { formatEuro } from './finance';

/**
 * Libreria predefinita di campi per la generazione dei Moduli Google (Google Forms).
 * Include sia i campi "Standard" (implementati in ogni modulo, inclusi bisogni speciali approfonditi e allergie)
 * sia i campi specifici per Tesseramento, Eventi e Gadget.
 */
export const DEFAULT_GOOGLE_FORM_FIELDS: GoogleFormFieldConfig[] = [
  // ============================================================================
  // 1. CAMPI STANDARD (PRESENTI IN OGNI MODULO GENERATO)
  // ============================================================================
  {
    id: 'std-child-name',
    title: 'Nome e Cognome Bimbo/a (Partecipante)',
    description: 'Indicare nome e cognome completi del minore partecipante.',
    questionType: 'short_text',
    required: true,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento', 'gadget'],
    enabledByDefault: true,
    mapsTo: 'childName',
  },
  {
    id: 'std-parent-name',
    title: 'Nome e Cognome Genitore / Tutore Esercente la Responsabilità',
    description: 'Genitore o tutore legale di riferimento.',
    questionType: 'short_text',
    required: true,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento', 'gadget'],
    enabledByDefault: true,
    mapsTo: 'parentName',
  },
  {
    id: 'std-parent-email',
    title: 'Email Genitore (per invio preventivo / ricevuta)',
    description: 'Indirizzo email valido a cui inviare conferma, ricevuta PDF e comunicazioni.',
    questionType: 'short_text',
    required: true,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento', 'gadget'],
    enabledByDefault: true,
    mapsTo: 'parentEmail',
  },
  {
    id: 'std-parent-phone',
    title: 'Telefono / Cellulare Genitore (Reperibilità ed Emergenze)',
    description: 'Recapito telefonico attivo e reperibile durante le attività.',
    questionType: 'short_text',
    required: true,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento', 'gadget'],
    enabledByDefault: true,
    mapsTo: 'parentPhone',
  },
  {
    id: 'std-allergies-medical',
    title: 'Allergie Alimentari, Intolleranze, Patologie o Farmaci Salvavita',
    description:
      'Specificare in modo approfondito eventuali allergie (alimentari, da contatto, punture d\'insetto, pollini), intolleranze, terapie in corso o farmaci salvavita con relativo protocollo.',
    questionType: 'paragraph',
    required: false,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento'],
    enabledByDefault: true,
    mapsTo: 'allergies',
  },
  {
    id: 'std-special-needs-deep',
    title: 'Bisogni Speciali, Esigenze Educative e Dettagli Approfonditi per l\'Accoglienza',
    description:
      'Indicare eventuali Bisogni Educativi Speciali (BES), neurodivergenze, certificazioni, paure particolari, modalità di gestione delle emozioni/fatica, abitudini o qualsiasi informazione approfondita utile agli educatori e alle guide per garantire la migliore esperienza e sicurezza al partecipante.',
    questionType: 'paragraph',
    required: false,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento'],
    enabledByDefault: true,
    mapsTo: 'notesConditions',
  },
  {
    id: 'std-autonomies-sleep',
    title: 'Autonomie Personali, Alimentazione, Sonno e Adattamento Outdoor',
    description:
      'Fornire ulteriori dettagli su: autonomia personale (bagno, vestirsi, gestione zaino), rapporto col cibo, eventuali difficoltà nel sonno fuori casa (per uscite in rifugio/tenda) o livello di acquaticità.',
    questionType: 'paragraph',
    required: false,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento'],
    enabledByDefault: true,
    mapsTo: 'notesConditions',
  },

  // ============================================================================
  // 2. CAMPI SPECIFICI PER IL MODULO TESSERAMENTO / ANAGRAFICA SOCI
  // ============================================================================
  {
    id: 'tess-birth-date',
    title: 'Data di Nascita Bimbo/a (GG/MM/AAAA)',
    questionType: 'short_text',
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['tesseramento'],
    enabledByDefault: true,
    mapsTo: 'birthDate',
  },
  {
    id: 'tess-birth-place',
    title: 'Luogo / Comune di Nascita Bimbo/a',
    questionType: 'short_text',
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['tesseramento'],
    enabledByDefault: true,
    mapsTo: 'birthPlace',
  },
  {
    id: 'tess-age-group',
    title: "Fascia d'Età / Gruppo (3-6, 6-11, 11-14)",
    questionType: 'radio',
    options: ['3-6', '6-11', '11-14'],
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['tesseramento', 'evento'],
    enabledByDefault: true,
    mapsTo: 'group',
  },
  {
    id: 'tess-child-cf',
    title: 'Codice Fiscale Bimbo/a (16 caratteri)',
    questionType: 'short_text',
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['tesseramento'],
    enabledByDefault: true,
    mapsTo: 'childFiscalCode',
  },
  {
    id: 'tess-address',
    title: 'Indirizzo di Residenza Completo (Via, Civico, CAP, Città)',
    questionType: 'short_text',
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['tesseramento'],
    enabledByDefault: true,
    mapsTo: 'childAddress',
  },
  {
    id: 'tess-parent-cf',
    title: 'Codice Fiscale Genitore / Intestatario Ricevute (per detrazione fiscale)',
    questionType: 'short_text',
    required: false,
    isStandardForAllForms: false,
    applicableAreas: ['tesseramento'],
    enabledByDefault: true,
    mapsTo: 'parentFiscalCode',
  },
  {
    id: 'tess-insurance',
    title: 'Tipo di Assicurazione Scelta (Base, Summer, Gold, Platinum)',
    description: 'Copertura assicurativa infortuni collegata al tesseramento annuale.',
    questionType: 'radio',
    options: ['Gold', 'Platinum', 'Summer', 'Base'],
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['tesseramento'],
    enabledByDefault: true,
    mapsTo: 'insuranceType',
  },
  {
    id: 'tess-validity-365',
    title: 'Formula Validità Tessera (Ordinaria 31/12 oppure Tessera 365 dal 1° Settembre)',
    description:
      'La Tessera 365 dura 12 mesi esatti fino allo stesso giorno dell\'anno successivo ed è attivabile solo dal 1° Settembre in poi.',
    questionType: 'radio',
    options: [
      'Tessera Solare (scadenza 31 Dicembre)',
      'Tessera 365 (12 mesi - attivabile solo dal 1 Settembre)',
    ],
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['tesseramento'],
    enabledByDefault: true,
    mapsTo: 'cardValidityType',
  },
  {
    id: 'tess-photo-consent',
    title: 'Autorizzazione Foto e Video per Attività Istituzionali ASD',
    description:
      'Consenso alla realizzazione e utilizzo di foto/video durante le attività outdoor dell\'ASD secondo informativa GDPR.',
    questionType: 'radio',
    options: ['SI', 'NO'],
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['tesseramento', 'evento'],
    enabledByDefault: true,
    mapsTo: 'photoConsent',
  },

  // ============================================================================
  // 3. CAMPI SPECIFICI PER IL MODULO PRENOTAZIONE GADGET
  // ============================================================================
  {
    id: 'gad-item',
    title: 'Articolo Gadget Richiesto',
    questionType: 'radio',
    options: [
      'Maglietta Apuacamp (15€)',
      'Tazza Smaltata (10€)',
      'Cappellino Outdoor (12€)',
      'Sacco Speleo (25€)',
    ],
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['gadget'],
    enabledByDefault: true,
    mapsTo: 'custom_note',
  },
  {
    id: 'gad-size',
    title: 'Taglia / Variante e Quantità Richiesta',
    description: 'Es. Taglia 9-11 anni (n. 1 pezzo)',
    questionType: 'short_text',
    required: true,
    isStandardForAllForms: false,
    applicableAreas: ['gadget'],
    enabledByDefault: true,
    mapsTo: 'custom_note',
  },
];

/**
 * Suggerimenti rapidi di campi extra / domande approfondite che l'operatore può aggiungere con 1 click
 * nella configurazione dei Moduli Google (e impostare come Standard per tutti i moduli).
 */
export const SUGGESTED_EXTRA_FORM_FIELDS: Omit<GoogleFormFieldConfig, 'id'>[] = [
  {
    title: 'Secondo Contatto di Emergenza (Altro Genitore / Nonni / Delegati al Ritiro)',
    description:
      'Indicare nome, cognome, grado di parentela e numero di telefono delle persone autorizzate a venire a prendere il/la bambino/a.',
    questionType: 'paragraph',
    required: false,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento'],
    enabledByDefault: true,
    mapsTo: 'notesConditions',
  },
  {
    title: 'Protocollo Medico / Autorizzazione Somministrazione Farmaci al Bisogno',
    description:
      'Il partecipante necessita di farmaci ad orario o al bisogno (es. antistaminico, broncodilatatore, antipiretico)? Specificare posologia e accordi con la famiglia.',
    questionType: 'paragraph',
    required: false,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento'],
    enabledByDefault: true,
    mapsTo: 'allergies',
  },
  {
    title: 'Esperienza Escursionistica Precedente e Abitudine al Cammino in Montagna',
    description:
      'Indicare se il partecipante ha già partecipato a trekking, notti in rifugio o in tenda.',
    questionType: 'radio',
    options: [
      'Prima esperienza outdoor',
      'Buona abitudine al cammino (uscite giornaliere)',
      'Esperto/a (già svolti campi residenziali in rifugio/tenda)',
    ],
    required: false,
    isStandardForAllForms: false,
    applicableAreas: ['evento'],
    enabledByDefault: true,
    mapsTo: 'notesConditions',
  },
  {
    title: 'Regime Alimentare per Pasti in Rifugio / Campo Estivo',
    description: 'Selezionare eventuali esigenze alimentari da comunicare alla cucina/rifugio.',
    questionType: 'checkbox',
    options: [
      'Onnivoro (nessuna restrizione)',
      'Vegetariano',
      'Vegano',
      'Senza Glutine / Celiachia',
      'Senza Lattosio',
      'Altro (specificare nel campo allergie)',
    ],
    required: false,
    isStandardForAllForms: true,
    applicableAreas: ['tesseramento', 'evento'],
    enabledByDefault: true,
    mapsTo: 'allergies',
  },
  {
    title: 'Richiesta Compagni di Gruppo / Tenda o Note Organizzative Famiglia',
    description:
      'Eventuali preferenze di abbinamento con amici/fratelli o necessità di orario ingresso/uscita.',
    questionType: 'paragraph',
    required: false,
    isStandardForAllForms: false,
    applicableAreas: ['evento'],
    enabledByDefault: true,
    mapsTo: 'notesConditions',
  },
];

/**
 * Restituisce la lista completa dei campi configurati nel profilo ASD (o i default se non ancora personalizzati)
 */
export function resolveProfileFormFields(profile?: AssociationProfile): GoogleFormFieldConfig[] {
  if (profile?.formStandardFields && profile.formStandardFields.length > 0) {
    return profile.formStandardFields;
  }
  return DEFAULT_GOOGLE_FORM_FIELDS;
}

/**
 * Filtra i campi da proporre per una specifica area ('tesseramento' | 'evento' | 'gadget').
 * Qualsiasi campo marcato come `isStandardForAllForms: true` viene SEMPRE incluso in ogni modulo!
 */
export function getEffectiveFormFieldsForArea(
  allFields: GoogleFormFieldConfig[] | undefined,
  area: GoogleFormTargetArea
): GoogleFormFieldConfig[] {
  const source = allFields && allFields.length > 0 ? allFields : DEFAULT_GOOGLE_FORM_FIELDS;
  return source.filter(
    (f) => f.isStandardForAllForms || f.applicableAreas.includes(area)
  );
}

/**
 * Costruisce l'array `requests` per Google Forms API v1 (`forms:batchUpdate`)
 * a partire dai campi personalizzati scelti dall'operatore sul gestionale.
 */
export function buildGoogleFormBatchRequests(params: {
  title: string;
  description: string;
  fields: GoogleFormFieldConfig[];
}): any[] {
  const activeFields = params.fields.filter((f) => f.enabledByDefault !== false && f.title.trim());

  const requests: any[] = [
    {
      updateFormInfo: {
        info: {
          title: params.title,
          description: params.description,
        },
        updateMask: 'description',
      },
    },
  ];

  activeFields.forEach((field, index) => {
    let questionPayload: Record<string, any>;

    if (field.questionType === 'radio' || field.questionType === 'checkbox') {
      const cleanOpts = (field.options || [])
        .map((o) => o.trim())
        .filter(Boolean);
      const safeOptions = cleanOpts.length > 0 ? cleanOpts : ['Sì', 'No'];
      questionPayload = {
        required: !!field.required,
        choiceQuestion: {
          type: field.questionType === 'checkbox' ? 'CHECKBOX' : 'RADIO',
          options: safeOptions.map((val) => ({ value: val })),
        },
      };
    } else {
      questionPayload = {
        required: !!field.required,
        textQuestion: {
          paragraph: field.questionType === 'paragraph',
        },
      };
    }

    const itemObj: Record<string, any> = {
      title: field.title.trim(),
      questionItem: {
        question: questionPayload,
      },
    };

    if (field.description && field.description.trim()) {
      itemObj.description = field.description.trim();
    }

    requests.push({
      createItem: {
        item: itemObj,
        location: { index },
      },
    });
  });

  return requests;
}

export interface ReceiptPlaceholderContext {
  socio?: string;
  genitore?: string;
  cf_genitore?: string;
  cf_socio?: string;
  indirizzo_socio?: string;
  tessera?: string;
  scadenza_tessera?: string;
  assicurazione?: string;
  attivita?: string;
  importo?: number | string;
  totale_lordo?: string;
  sconto_dicitura?: string;
  sconto_importo?: string;
  buono_importo?: string;
  metodo_pagamento?: string;
  data?: string;
  numero_ricevuta?: string;
  anno?: number | string;
  asd_nome?: string;
  asd_cf?: string;
  asd_iban?: string;
  asd_affiliazione?: string;
  presidente?: string;
}

export const DYNAMIC_PLACEHOLDER_TOKENS: {
  token: string;
  label: string;
  example: string;
}[] = [
  { token: '{{socio}}', label: 'Nome Socio / Minore', example: 'Marco Rossi' },
  { token: '{{genitore}}', label: 'Nome Genitore / Intestatario', example: 'Laura Bianchi' },
  { token: '{{cf_genitore}}', label: 'C.F. Genitore', example: 'BNCLRA82M45F205Z' },
  { token: '{{cf_socio}}', label: 'C.F. Socio / Minore', example: 'RSSMRC16D12F205K' },
  { token: '{{tessera}}', label: 'N° Tessera Associativa', example: 'AC-2027-042' },
  { token: '{{scadenza_tessera}}', label: 'Scadenza Tessera', example: '31/12/2027' },
  { token: '{{assicurazione}}', label: 'Polizza Assicurativa', example: 'Gold' },
  { token: '{{attivita}}', label: 'Causale / Evento / Riepilogo Voci', example: 'Summer Camp Rifugio' },
  { token: '{{importo}}', label: 'Importo Netto Formattato', example: '€ 120,00' },
  { token: '{{totale_lordo}}', label: 'Subtotale Lordo Voci', example: '€ 150,00' },
  { token: '{{sconto_dicitura}}', label: 'Dicitura Sconto / Copertura', example: 'Riduzione fascia ISEE agevolata' },
  { token: '{{sconto_importo}}', label: 'Importo Sconto Applicato', example: '€ 30,00' },
  { token: '{{buono_importo}}', label: 'Buono Spesa Compensato', example: '€ 20,00' },
  { token: '{{metodo_pagamento}}', label: 'Metodo Pagamento', example: 'Bonifico' },
  { token: '{{data}}', label: 'Data Documento', example: '11/11/2026' },
  { token: '{{numero_ricevuta}}', label: 'N° Ricevuta', example: '2027/R-104' },
  { token: '{{anno}}', label: 'Anno Sportivo', example: '2027' },
  { token: '{{asd_nome}}', label: 'Nome ASD', example: 'Apuacamp A.S.D.' },
  { token: '{{asd_cf}}', label: 'Codice Fiscale ASD', example: '94012340456' },
  { token: '{{asd_iban}}', label: 'IBAN ASD', example: 'IT60X0503413601000000001234' },
  { token: '{{presidente}}', label: 'Presidente ASD', example: 'Matteo Palazzi' },
];

/**
 * Sostituisce i segnaposto dinamici {{...}} nel testo con i valori reali del socio, evento, movimento e profilo ASD.
 */
export function resolveDynamicTextPlaceholders(
  template: string | undefined,
  ctx: ReceiptPlaceholderContext
): string {
  if (!template) return '';
  const formattedAmount =
    typeof ctx.importo === 'number'
      ? formatEuro(ctx.importo)
      : String(ctx.importo ?? '€ 0,00');

  const map: Record<string, string> = {
    '{{socio}}': ctx.socio || 'Socio Tesserato',
    '{{genitore}}': ctx.genitore || 'Genitore / Tutore',
    '{{cf_genitore}}': ctx.cf_genitore || 'Registrato agli atti',
    '{{cf_socio}}': ctx.cf_socio || 'Registrato agli atti',
    '{{indirizzo_socio}}': ctx.indirizzo_socio || '-',
    '{{tessera}}': ctx.tessera || 'In corso di rilascio',
    '{{scadenza_tessera}}': ctx.scadenza_tessera || '31/12/' + String(ctx.anno || 2027),
    '{{assicurazione}}': ctx.assicurazione || 'Gold',
    '{{attivita}}': ctx.attivita || 'Quota Associativa Istituzionale',
    '{{importo}}': formattedAmount,
    '{{totale_lordo}}': ctx.totale_lordo || formattedAmount,
    '{{sconto_dicitura}}': ctx.sconto_dicitura || 'Nessuna riduzione applicata',
    '{{sconto_importo}}': ctx.sconto_importo || '€ 0,00',
    '{{buono_importo}}': ctx.buono_importo || '€ 0,00',
    '{{metodo_pagamento}}': ctx.metodo_pagamento || 'Bonifico',
    '{{data}}': ctx.data || new Date().toISOString().slice(0, 10),
    '{{numero_ricevuta}}': ctx.numero_ricevuta || '2027/R-001',
    '{{anno}}': String(ctx.anno || 2027),
    '{{asd_nome}}': ctx.asd_nome || 'Apuacamp A.S.D.',
    '{{asd_cf}}': ctx.asd_cf || '',
    '{{asd_iban}}': ctx.asd_iban || '',
    '{{asd_affiliazione}}': ctx.asd_affiliazione || '',
    '{{presidente}}': ctx.presidente || 'Il Presidente',
  };

  let result = template;
  for (const [token, val] of Object.entries(map)) {
    result = result.split(token).join(val);
  }
  return result;
}

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateId, EmailTemplateConfig> = {
  ricevuta_evento: {
    id: 'ricevuta_evento',
    name: 'Iscrizione & Ricevuta Evento / Campus',
    description: 'Inviata per confermare l\'iscrizione a un evento o campo e allegare la ricevuta (o preventivo) PDF.',
    subjectTemplate: '{{asd_nome}} - Conferma Iscrizione e Ricevuta: {{attivita}} ({{socio}})',
    bodyTemplate: `Gentile {{genitore}},

ti confermiamo l'iscrizione di {{socio}} all'attività "{{attivita}}" organizzata da {{asd_nome}}.

In allegato a questa email trovi il documento PDF ufficiale (Atto N° {{numero_ricevuta}} del {{data}}) relativo alla quota di {{importo}} ({{metodo_pagamento}}).

Riepilogo dati registrati:
- Partecipante: {{socio}} (Tessera {{tessera}} - Polizza {{assicurazione}})
- Genitore / Intestatario: {{genitore}} (C.F. {{cf_genitore}})
- Attività: {{attivita}}
- Importo: {{importo}}

Per qualsiasi necessità organizzativa o comunicazione puoi rispondere direttamente a questa email.

Un caro saluto,
La Segreteria di {{asd_nome}}
Il Presidente {{presidente}}`,
  },
  ricevuta_tessera: {
    id: 'ricevuta_tessera',
    name: 'Rilascio Tessera Associativa & Ricevuta Quota',
    description: 'Inviata al rilascio o rinnovo della tessera associativa annuale con ricevuta PDF allegata.',
    subjectTemplate: '{{asd_nome}} - Tessera Associativa {{anno}} N° {{tessera}} e Ricevuta ({{socio}})',
    bodyTemplate: `Gentile {{genitore}},

grazie per aver rinnovato o perfezionato il tesseramento a {{asd_nome}} per l'anno sportivo {{anno}}!

In allegato trovi la ricevuta ufficiale N° {{numero_ricevuta}} di {{importo}} relativa al tesseramento di {{socio}}.

Estremi Tessera Associativa:
- Socio / Tesserato: {{socio}}
- Numero Tessera: {{tessera}}
- Copertura Assicurativa: {{assicurazione}}
- Scadenza Tessera: {{scadenza_tessera}}

Conserva il PDF allegato (valido anche ai fini della detrazione fiscale IRPEF 19% per i minori 5-18 anni se versato con metodo tracciabile).

Un caro saluto,
La Segreteria di {{asd_nome}}`,
  },
  ricevuta_doposcuola: {
    id: 'ricevuta_doposcuola',
    name: 'Ricevuta Mensile Doposcuola / Progetto Selva',
    description: 'Inviata per le quote mensili del Doposcuola / Selva nel Bosco con ricevuta PDF allegata.',
    subjectTemplate: '{{asd_nome}} - Ricevuta Quota Mensile Doposcuola ({{socio}}) - N° {{numero_ricevuta}}',
    bodyTemplate: `Gentile {{genitore}},

in allegato trasmettiamo la ricevuta N° {{numero_ricevuta}} del {{data}} relativa a "{{attivita}}" per {{socio}}, per un importo complessivo di {{importo}} ({{metodo_pagamento}}).

Ti ringraziamo per la puntualità e la fiducia nelle attività educative outdoor di {{asd_nome}}.

Un caro saluto,
La Segreteria di {{asd_nome}}`,
  },
  ricevuta_gadget: {
    id: 'ricevuta_gadget',
    name: 'Consegna Gadget & Ricevuta Contributo',
    description: 'Inviata per il ritiro o contributo di abbigliamento e gadget associativi con ricevuta in allegato.',
    subjectTemplate: '{{asd_nome}} - Ricevuta Contributo Gadget Associativo ({{socio}})',
    bodyTemplate: `Gentile {{genitore}},

in allegato trovi la ricevuta N° {{numero_ricevuta}} relativa a "{{attivita}}" per {{socio}} (importo {{importo}}).

Grazie per sostenere le attività outdoor di {{asd_nome}}!

Un caro saluto,
La Segreteria di {{asd_nome}}`,
  },
  modulo_iscrizione_da_firmare: {
    id: 'modulo_iscrizione_da_firmare',
    name: 'Riepilogo Dati Iscrizione, Consenso Foto & Privacy da Controfirmare',
    description: 'Inviata quando il socio compila il modulo d\'iscrizione: allega il PDF riepilogativo da firmare e restituire.',
    subjectTemplate: '{{asd_nome}} - Modulo Riepilogo Dati e Consensi da Firmare per {{socio}}',
    bodyTemplate: `Gentile {{genitore}},

grazie per aver inviato i dati di iscrizione a {{asd_nome}} per {{socio}}!

Per completare la pratica ed essere in regola con l'archivio associativo, il consenso foto/video e la normativa sul trattamento dei dati personali (GDPR), trovi in allegato il **Modulo Riepilogo Dati e Consensi** precompilato con i dati che ci hai comunicato.

Ti chiediamo cortesemente di:
1. Verificare che tutti i dati anagrafici, i contatti di emergenza e le eventuali note mediche/allergie di {{socio}} siano corretti;
2. Apporre la tua firma negli appositi spazi in calce al documento (Richiesta Ammissione/Privacy e Consenso Foto/Video);
3. Inviarci nuovamente il modulo firmato (anche tramite foto nitida o scansione rispondendo a questa email) oppure consegnarlo firmato agli educatori alla prima attività.

Grazie per la collaborazione!

Un caro saluto,
La Segreteria di {{asd_nome}}
Il Presidente {{presidente}}`,
  },
};

export function resolveEmailTemplates(
  profile?: AssociationProfile
): Record<EmailTemplateId, EmailTemplateConfig> {
  const custom = profile?.emailTemplates;
  return {
    ricevuta_evento: {
      ...DEFAULT_EMAIL_TEMPLATES.ricevuta_evento,
      ...(custom?.ricevuta_evento || {}),
    },
    ricevuta_tessera: {
      ...DEFAULT_EMAIL_TEMPLATES.ricevuta_tessera,
      ...(custom?.ricevuta_tessera || {}),
    },
    ricevuta_doposcuola: {
      ...DEFAULT_EMAIL_TEMPLATES.ricevuta_doposcuola,
      ...(custom?.ricevuta_doposcuola || {}),
    },
    ricevuta_gadget: {
      ...DEFAULT_EMAIL_TEMPLATES.ricevuta_gadget,
      ...(custom?.ricevuta_gadget || {}),
    },
    modulo_iscrizione_da_firmare: {
      ...DEFAULT_EMAIL_TEMPLATES.modulo_iscrizione_da_firmare,
      ...(custom?.modulo_iscrizione_da_firmare || {}),
    },
  };
}

export const DEFAULT_STAMP_OVERLAY: ImageOverlayConfig = {
  scalePercent: 100,
  rotationDeg: -6,
  opacity: 0.9,
  offsetX: 0,
  offsetY: 0,
  overlapMode: 'overlap_signature',
};

export const DEFAULT_SIGNATURE_OVERLAY: ImageOverlayConfig = {
  scalePercent: 100,
  rotationDeg: 0,
  opacity: 0.95,
  offsetX: 0,
  offsetY: 0,
  overlapMode: 'overlap_signature',
};

export const DEFAULT_DYNAMIC_FIELDS: ReceiptDynamicField[] = [
  {
    id: 'dyn-cf-minore',
    label: 'Codice Fiscale Partecipante (Minore)',
    valueTemplate: '{{cf_socio}}',
    fieldType: 'auto_variable',
    position: 'header_box',
    enabled: true,
  },
  {
    id: 'dyn-stagione',
    label: 'Stagione Sportiva / Anno Sociale',
    valueTemplate: 'Anno Sportivo {{anno}} ({{asd_affiliazione}})',
    fieldType: 'auto_variable',
    position: 'table_row',
    enabled: true,
  },
  {
    id: 'dyn-bollo',
    label: 'Regime Imposta di Bollo',
    valueTemplate: 'Esente da bollo ex art. 27-bis Tab. B DPR 642/1972 (ASD iscritta RASD/CONI)',
    fieldType: 'editable_select',
    options: [
      'Esente da bollo ex art. 27-bis Tab. B DPR 642/1972 (ASD iscritta RASD/CONI)',
      "Imposta di bollo € 2,00 assolta sull'originale per importi superiori a € 77,47",
      'Non soggetto a bollo (importo non superiore a € 77,47)',
    ],
    position: 'footer_box',
    enabled: true,
  },
];

export const SUGGESTED_DYNAMIC_FIELDS: Omit<ReceiptDynamicField, 'id'>[] = [
  {
    label: 'Detrazione IRPEF 19% (Art. 15 TUIR)',
    valueTemplate:
      'Pagamento tracciabile ({{metodo_pagamento}}) valido per detrazione 19% spese sportive minori 5-18 anni',
    fieldType: 'auto_variable',
    position: 'table_row',
    enabled: true,
  },
  {
    label: 'Periodo / Turno Attività',
    valueTemplate: 'Turno / Uscita del {{data}}',
    fieldType: 'editable_text',
    position: 'table_row',
    enabled: true,
  },
  {
    label: 'Secondo Genitore / Co-intestatario',
    valueTemplate: '',
    fieldType: 'editable_text',
    position: 'header_box',
    enabled: true,
  },
  {
    label: 'Quota / Tipologia Versamento',
    valueTemplate: 'Saldo Totale Quota Partecipazione',
    fieldType: 'editable_select',
    options: [
      'Saldo Totale Quota Partecipazione',
      'Acconto / Caparra Confirmatoria Iscrizione',
      'Saldo Finale a Conguaglio',
      'Quota Tesseramento Annuale + Polizza Assicurativa',
    ],
    position: 'table_row',
    enabled: true,
  },
];

export const RECEIPT_INTRO_DECLARATION_PRESETS: { label: string; text: string }[] = [
  {
    label: 'Attestazione Standard Quietanza ASD',
    text: "Si attesta di aver ricevuto da {{genitore}} (C.F. {{cf_genitore}}) per il socio/partecipante {{socio}} (Tessera {{tessera}}) la somma di {{importo}} a titolo di contributo per attività istituzionale.",
  },
  {
    label: 'Attestazione per Detrazione Fiscale 19% (Minori 5-18 anni)',
    text: "Si certifica che {{genitore}} (C.F. {{cf_genitore}}) ha corrisposto tramite {{metodo_pagamento}} l'importo di {{importo}} per la pratica sportiva dilettantistica del minore {{socio}} (C.F. {{cf_socio}}) svolta presso {{asd_nome}} nell'anno {{anno}}.",
  },
  {
    label: 'Prospetto Preventivo / Invito al Saldo',
    text: "Prospetto riepilogativo della quota prevista per {{socio}} relativamente all'attività '{{attivita}}'. Il versamento di {{importo}} può essere effettuato tramite bonifico su IBAN {{asd_iban}}.",
  },
];

// ============================================================================
// CONFIGURAZIONE E PRESET RICEVUTE, PREVENTIVI, LAYOUT TEMPLATE, TIMBRO E FIRMA ASD
// ============================================================================

export interface ReceiptLayoutTemplateMeta {
  id: ReceiptLayoutTemplateId;
  name: string;
  shortName: string;
  subtitle: string;
  description: string;
  recommendedFor: string;
  headerAlignment: 'split' | 'minimal_left' | 'centered_official';
  fontFamily: 'sans' | 'mono_clean' | 'serif_official';
  frameStyle: 'single_card' | 'borderless_clean' | 'double_institutional';
  accentColorHex: string;
}

export const RECEIPT_LAYOUT_TEMPLATES: ReceiptLayoutTemplateMeta[] = [
  {
    id: 'standard',
    name: 'Standard Operativo ASD',
    shortName: 'Standard',
    subtitle: 'Tabellare strutturato con box bicolonna',
    description:
      'Intestazione divisa con badge scuro a destra, riquadro anagrafico grigio chiaro a due colonne e tabella prestazione con barra totale evidenziata.',
    recommendedFor: 'Campus estivi, uscite outdoor, quote tesseramento ed eventi.',
    headerAlignment: 'split',
    fontFamily: 'sans',
    frameStyle: 'single_card',
    accentColorHex: '#065f46',
  },
  {
    id: 'minimalist',
    name: 'Minimalista & Eco-Print',
    shortName: 'Minimalista',
    subtitle: 'Design pulito, essenziale e a risparmio inchiostro',
    description:
      'Layout arioso senza sfondi pieni o riquadri pesanti, filetti sottili monocromatici, tipografia moderna e massima leggibilità su schermo e stampa rapida.',
    recommendedFor: 'Invii digitali rapidi via email/WhatsApp, preventivi snelli e stampe eco.',
    headerAlignment: 'minimal_left',
    fontFamily: 'mono_clean',
    frameStyle: 'borderless_clean',
    accentColorHex: '#0f172a',
  },
  {
    id: 'official',
    name: 'Ufficiale & Istituzionale (Bollo / 730)',
    shortName: 'Ufficiale / Fiscale',
    subtitle: 'Doppia cornice solenne per detrazione 19% ed enti',
    description:
      'Intestazione istituzionale centrata con carattere classico, doppia cornice formale, attestazione solenne di quietanza e box dedicato per detrazione IRPEF 19% / RASD.',
    recommendedFor: 'Dichiarazione dei redditi (730), rendicontazione bandi ed enti pubblici.',
    headerAlignment: 'centered_official',
    fontFamily: 'serif_official',
    frameStyle: 'double_institutional',
    accentColorHex: '#1e3a8a',
  },
];

export function getReceiptLayoutTemplateMeta(
  templateId?: ReceiptLayoutTemplateId
): ReceiptLayoutTemplateMeta {
  const found = RECEIPT_LAYOUT_TEMPLATES.find((t) => t.id === templateId);
  return found || RECEIPT_LAYOUT_TEMPLATES[0];
}

export const DEFAULT_RECEIPT_CONFIG: ReceiptTemplateConfig = {
  layoutTemplate: 'standard',
  showFiscalCodeAsd: true,
  showAffiliation: true,
  showMemberAddress: true,
  showCardNumberAndInsurance: true,
  showParentFiscalCode: true,
  showParentContact: true,
  showPaymentMethod: true,
  showIbanOnReceipt: true,
  showLegalNotice: true,
  showStamp: true,
  showSignature: true,
  showQuietanzaLine: true,
  showIntroDeclaration: true,
  documentTitleReceipt: 'Ricevuta Non Fiscale',
  documentTitleQuote: 'Preventivo Quota',
  documentTitleReminder: 'Promemoria Saldo',
  introDeclarationText:
    "Si attesta di aver ricevuto da {{genitore}} (C.F. {{cf_genitore}}) per il socio/partecipante {{socio}} (Tessera {{tessera}}) la somma di {{importo}} a titolo di contributo per attività istituzionale.",
  activityDescriptionSubtext:
    "Attività sportivo-dilettantistica e didattica outdoor conforme agli scopi istituzionali dell'Associazione ({{asd_nome}}).",
  legalTaxClause:
    "Operazione fuori campo applicazione IVA ai sensi dell'art. 4 del D.P.R. 633/1972 e non soggetta ad imposta sui redditi ai sensi dell'art. 148, commi 1, 2 e 3 del T.U.I.R. (D.P.R. 917/1986) e D.Lgs. 36/2021. Quota associativa istituzionale/corrispettivo specifico decommercializzato versato da socio per attività svolte in diretta attuazione degli scopi statutari.",
  footerNotes: 'Documento emesso elettronicamente dal registro gestionale di {{asd_nome}}.',
  customLines: [],
  dynamicFields: DEFAULT_DYNAMIC_FIELDS,
  stampOverlay: DEFAULT_STAMP_OVERLAY,
  signatureOverlay: DEFAULT_SIGNATURE_OVERLAY,
};

export const RECEIPT_SUBTEXT_PRESETS: { label: string; text: string }[] = [
  {
    label: 'Attività Sportiva / Campo Outdoor (Default)',
    text: "Attività sportivo-dilettantistica e didattica outdoor conforme agli scopi istituzionali dell'Associazione ({{asd_nome}}).",
  },
  {
    label: 'Quota Associativa & Tesseramento Annuale',
    text: 'Quota associativa annuale indivisibile {{anno}} e rilascio tessera assicurativa ({{assicurazione}}) presso Ente di Promozione Sportiva riconosciuto dal CONI / RASD.',
  },
  {
    label: 'Campus Estivo / Attività Giovanile 5-18 anni',
    text: "Frequenza corso / campo sportivo dilettantistico per il minore {{socio}} (detraibile ai sensi dell'art. 15, c. 1, lett. i-quinquies del TUIR per ragazzi tra 5 e 18 anni se pagato con mezzo tracciabile).",
  },
  {
    label: 'Escursione / Rifugio / Speleologia',
    text: 'Contributo istituzionale per partecipazione a uscita didattico-escursionistica riservata ai soci in regola con il tesseramento {{anno}}.',
  },
];

export const RECEIPT_TAX_CLAUSE_PRESETS: { label: string; text: string }[] = [
  {
    label: 'Esenzione Standard ASD (Art. 148 TUIR & D.Lgs. 36/2021)',
    text: "Operazione fuori campo applicazione IVA ai sensi dell'art. 4 del D.P.R. 633/1972 e non soggetta ad imposta sui redditi ai sensi dell'art. 148, commi 1, 2 e 3 del T.U.I.R. (D.P.R. 917/1986) e D.Lgs. 36/2021. Quota associativa istituzionale/corrispettivo specifico decommercializzato versato da socio per attività svolte in diretta attuazione degli scopi statutari.",
  },
  {
    label: 'Esenzione ASD + Esenzione Imposta di Bollo (Art. 27-bis DPR 642/72)',
    text: "Operazione decommercializzata ex art. 148 TUIR e art. 4 DPR 633/72. Esente da imposta di bollo ai sensi dell'art. 27-bis della Tabella Allegato B al D.P.R. 642/1972 (come modificato dall'art. 1, c. 646, L. 145/2018 per le Associazioni Sportive Dilettantistiche iscritte al RASD/CONI).",
  },
  {
    label: 'Dicitura Detrazione 19% Spese Sportive Minori (5-18 anni)',
    text: 'Ricevuta valida ai fini della detrazione IRPEF del 19% per pratica sportiva dilettantistica dei ragazzi di età compresa tra 5 e 18 anni (art. 15, comma 1, lett. i-quinquies, D.P.R. 917/1986), qualora il versamento sia stato effettuato tramite bonifico bancario o altro sistema di pagamento tracciabile.',
  },
  {
    label: 'Preventivo / Prospetto Informativo Non Quietanzato',
    text: "Il presente documento costituisce prospetto riepilogativo delle quote associative previste per la partecipazione all'attività. La ricevuta quietanzata verrà emessa a seguito del versamento.",
  },
];

export const RECEIPT_CUSTOM_LINE_SUGGESTIONS: { label: string; value: string }[] = [
  {
    label: 'Periodo di svolgimento',
    value: 'Stagione Sportiva {{anno}}',
  },
  {
    label: 'Esenzione Bollo ASD',
    value: 'Esente da bollo ex art. 27-bis Tab. B DPR 642/1972 (ASD iscritta RASD)',
  },
  {
    label: 'Tracciabilità Pagamento (Detrazione 19%)',
    value: 'Pagamento tracciabile ({{metodo_pagamento}}) conforme art. 15 c. 1 lett. i-quinquies TUIR',
  },
  {
    label: 'Sconto Fratelli / Agevolazione',
    value: 'Applicata riduzione quota secondo fratello/sorella',
  },
];

export function resolveReceiptConfig(profile?: AssociationProfile): ReceiptTemplateConfig {
  if (!profile?.receiptConfig) {
    return {
      ...DEFAULT_RECEIPT_CONFIG,
      layoutTemplate: 'standard',
      customLines: [],
      dynamicFields: DEFAULT_DYNAMIC_FIELDS.map((f) => ({ ...f })),
      stampOverlay: { ...DEFAULT_STAMP_OVERLAY },
      signatureOverlay: { ...DEFAULT_SIGNATURE_OVERLAY },
    };
  }
  return {
    ...DEFAULT_RECEIPT_CONFIG,
    ...profile.receiptConfig,
    layoutTemplate: profile.receiptConfig.layoutTemplate || 'standard',
    customLines: profile.receiptConfig.customLines || [],
    dynamicFields:
      profile.receiptConfig.dynamicFields && profile.receiptConfig.dynamicFields.length > 0
        ? profile.receiptConfig.dynamicFields
        : DEFAULT_DYNAMIC_FIELDS.map((f) => ({ ...f })),
    stampOverlay: {
      ...DEFAULT_STAMP_OVERLAY,
      ...(profile.receiptConfig.stampOverlay || {}),
    },
    signatureOverlay: {
      ...DEFAULT_SIGNATURE_OVERLAY,
      ...(profile.receiptConfig.signatureOverlay || {}),
    },
  };
}

/**
 * Converte un file immagine caricato (Timbro o Firma) in un DataURL PNG ottimizzato
 * preservando la trasparenza (canale alpha) per l'applicazione come overlay sui documenti PDF/Stampa.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxWidth: number = 420,
  maxHeight: number = 220
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Errore nella lettura del file immagine.'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth || h > maxHeight) {
          const ratio = Math.min(maxWidth / w, maxHeight / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Genera un Timbro Digitale PNG con sfondo trasparente (effetto inchiostro blu/verde ufficiale ASD)
 * utile come timbro immediato o di prova se l'ASD non ha ancora scansionato il proprio timbro fisico.
 */
export function generateDigitalAsdStampDataUrl(
  asdName: string,
  fiscalCode: string,
  affiliation: string
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 340;
  canvas.height = 170;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Outer double border stamp in ink blue-teal
  ctx.strokeStyle = '#0f5132';
  ctx.fillStyle = '#0f5132';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 320, 150);

  ctx.lineWidth = 1.5;
  ctx.strokeRect(17, 17, 306, 136);

  ctx.textAlign = 'center';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText((asdName || 'APUACAMP A.S.D.').toUpperCase().slice(0, 28), 170, 52);

  ctx.font = '600 11px sans-serif';
  ctx.fillText('ASSOCIAZIONE SPORTIVA DILETTANTISTICA', 170, 74);

  ctx.font = 'bold 13px monospace';
  ctx.fillText(`C.F. ${fiscalCode || '94012340456'}`, 170, 100);

  ctx.font = '11px sans-serif';
  ctx.fillText((affiliation || 'Affiliata US ACLI / CONI - RASD').slice(0, 38), 170, 124);

  ctx.font = 'italic 9px sans-serif';
  ctx.fillText('★ TIMBRO UFFICIALE SEGRETERIA ★', 170, 142);

  return canvas.toDataURL('image/png');
}

/**
 * Genera una Firma Calligrafica PNG con sfondo trasparente a partire dal nome del Presidente.
 */
export function generateDigitalSignatureDataUrl(presidentName: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#1e3a8a';
  ctx.fillStyle = '#1e3a8a';

  ctx.save();
  ctx.translate(25, 72);
  ctx.rotate(-0.06);
  ctx.font = 'italic 32px Georgia, serif';
  ctx.fillText(presidentName || 'Il Presidente', 0, 0);

  // Decorative flourish underline
  ctx.beginPath();
  ctx.moveTo(5, 12);
  ctx.quadraticCurveTo(115, -4, 240, 10);
  ctx.quadraticCurveTo(180, 18, 95, 16);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/**
 * Costruisce un file PDF binario valido (A4 portrait) con un'immagine JPEG ad alta risoluzione
 * del documento ricevuta comprensivo di Timbro ASD e Firma applicati in overlay.
 */
function buildPdfBlobFromJpegDataUrl(
  jpegDataUrl: string,
  pixelWidth: number,
  pixelHeight: number
): Blob {
  const base64 = jpegDataUrl.split(',')[1] || '';
  const binaryImg = atob(base64);
  const imgBytes = new Uint8Array(binaryImg.length);
  for (let i = 0; i < binaryImg.length; i++) {
    imgBytes[i] = binaryImg.charCodeAt(i);
  }

  // A4 dimensions in PDF points: 595.28 x 841.89
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 28;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  const scale = Math.min(availW / pixelWidth, availH / pixelHeight);
  const drawW = +(pixelWidth * scale).toFixed(2);
  const drawH = +(pixelHeight * scale).toFixed(2);
  const posX = +((pageW - drawW) / 2).toFixed(2);
  const posY = +(pageH - margin - drawH).toFixed(2);

  const encoder = new TextEncoder();
  const chunks: BlobPart[] = [];
  const offsets: number[] = [];
  let currentOffset = 0;

  const pushStr = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes as unknown as BlobPart);
    currentOffset += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes as unknown as BlobPart);
    currentOffset += bytes.length;
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Obj 1: Catalog
  offsets[1] = currentOffset;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Obj 2: Pages
  offsets[2] = currentOffset;
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Obj 3: Page
  offsets[3] = currentOffset;
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // Obj 4: Image XObject (DCTDecode)
  offsets[4] = currentOffset;
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`
  );
  pushBytes(imgBytes);
  pushStr('\nendstream\nendobj\n');

  // Obj 5: Content stream
  const contentStream = `q\n${drawW} 0 0 ${drawH} ${posX} ${posY} cm\n/Im0 Do\nQ\n`;
  offsets[5] = currentOffset;
  pushStr(
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`
  );

  const xrefOffset = currentOffset;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    const padded = String(offsets[i]).padStart(10, '0');
    pushStr(`${padded} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  return new Blob(chunks, { type: 'application/pdf' });
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export interface ReceiptPdfGenerationParams {
  fileName: string;
  badgeTitle: string;
  receiptNumber: string;
  docDate: string;
  docType: 'ricevuta' | 'preventivo' | 'sollecito';
  profile: AssociationProfile;
  config: ReceiptTemplateConfig;
  placeholderCtx: ReceiptPlaceholderContext;
  activityTitle: string;
  amount: number;
  grossSubtotal?: number;
  lineItems?: ReceiptLineItem[];
  discountLabel?: string;
  discountAmount?: number;
  voucherApplied?: number;
  paymentMethod: string;
  resolvedHeaderDynamic: { label: string; value: string }[];
  resolvedTableDynamic: { label: string; value: string }[];
  resolvedFooterDynamic: { label: string; value: string }[];
  stampDataUrl?: string;
  signatureDataUrl?: string;
}

/**
 * Genera un Blob PDF A4 ad alta risoluzione della ricevuta/preventivo,
 * utilizzabile sia per il download locale sia come allegato diretto per Gmail API.
 */
export async function generateReceiptPdfBlobWithOverlays(
  params: ReceiptPdfGenerationParams
): Promise<Blob> {
  const W = 1240;
  const H = 1754; // A4 @ 150 DPI
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossibile inizializzare il canvas PDF');
  }

  const layoutId: ReceiptLayoutTemplateId = params.config.layoutTemplate || 'standard';
  const baseFont = layoutId === 'official' ? 'Georgia, serif' : 'sans-serif';

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Outer card frame depending on layoutTemplate
  const pad = 68;
  if (layoutId === 'official') {
    // Double institutional frame
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 4;
    ctx.strokeRect(pad - 6, pad - 6, W - (pad - 6) * 2, H - (pad - 6) * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pad + 4, pad + 4, W - (pad + 4) * 2, H - (pad + 4) * 2);
  } else if (layoutId === 'standard') {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);
  }
  // Minimalist has a clean borderless outer sheet with a subtle top accent bar

  let y = pad + 56;
  const leftX = pad + 48;
  const rightX = W - pad - 48;
  const contentW = rightX - leftX;
  const centerX = W / 2;

  if (layoutId === 'official') {
    // OFFICIAL CENTERED HEADER
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `bold 32px ${baseFont}`;
    ctx.fillText((params.profile.name || 'APUACAMP A.S.D.').toUpperCase(), centerX, y);

    y += 26;
    ctx.fillStyle = '#0f172a';
    ctx.font = `italic 18px ${baseFont}`;
    ctx.fillText(
      params.profile.legalType || 'Associazione Sportiva Dilettantistica',
      centerX,
      y
    );

    if (params.config.showFiscalCodeAsd) {
      y += 24;
      ctx.fillStyle = '#334155';
      ctx.font = '15px sans-serif';
      ctx.fillText(
        `Codice Fiscale: ${params.profile.fiscalCode} — Sede: ${params.profile.address}`,
        centerX,
        y
      );
    }

    if (params.config.showAffiliation && params.profile.affiliation) {
      y += 22;
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(params.profile.affiliation, centerX, y);
    }

    y += 24;
    // Official Banner Strip with Document Title, Receipt Number & Date
    ctx.fillStyle = '#eff6ff';
    ctx.fillRect(leftX, y, contentW, 48);
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2;
    ctx.strokeRect(leftX, y, contentW, 48);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e3a8a';
    ctx.font = `bold 18px ${baseFont}`;
    ctx.fillText(params.badgeTitle.toUpperCase(), leftX + 20, y + 30);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(
      `Atto N° ${params.receiptNumber}  |  Data: ${params.docDate}`,
      rightX - 20,
      y + 30
    );
    y += 54;
  } else if (layoutId === 'minimalist') {
    // MINIMALIST CLEAN HEADER
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(params.profile.name || 'Apuacamp A.S.D.', leftX, y);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${params.badgeTitle.toUpperCase()} #${params.receiptNumber}`, rightX, y);

    y += 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '15px sans-serif';
    ctx.fillText(
      [
        params.profile.legalType,
        params.config.showFiscalCodeAsd ? `C.F. ${params.profile.fiscalCode}` : '',
        params.profile.address,
      ]
        .filter(Boolean)
        .join(' · '),
      leftX,
      y
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = '15px monospace';
    ctx.fillText(`Emessa il ${params.docDate}`, rightX, y);

    y += 18;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
  } else {
    // STANDARD HEADER
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText((params.profile.name || 'APUACAMP A.S.D.').toUpperCase(), leftX, y);

    // Badge on right
    ctx.fillStyle = '#0f172a';
    const badgeW = 290;
    const badgeH = 44;
    ctx.fillRect(rightX - badgeW, y - 30, badgeW, badgeH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(params.badgeTitle.toUpperCase(), rightX - badgeW / 2, y - 2);

    y += 28;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(
      params.profile.legalType || 'Associazione Sportiva Dilettantistica',
      leftX,
      y
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`N°: ${params.receiptNumber}`, rightX, y + 6);

    if (params.config.showFiscalCodeAsd) {
      y += 24;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = '16px sans-serif';
      ctx.fillText(`C.F. ${params.profile.fiscalCode} | ${params.profile.address}`, leftX, y);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = '16px monospace';
    ctx.fillText(`Data: ${params.docDate}`, rightX, y);

    if (params.config.showAffiliation && params.profile.affiliation) {
      y += 22;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = '15px sans-serif';
      ctx.fillText(params.profile.affiliation, leftX, y);
    }

    y += 22;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();
  }

  // 2. Recipient / Member Box
  y += 28;
  const boxTop = y;
  const boxH = 175 + Math.max(0, params.resolvedHeaderDynamic.length * 24);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(leftX, boxTop, contentW, boxH);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(leftX, boxTop, contentW, boxH);

  const col1X = leftX + 24;
  const col2X = leftX + contentW / 2 + 16;
  let boxY = boxTop + 30;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('DATI PARTECIPANTE / TESSERATO:', col1X, boxY);
  ctx.fillText('GENITORE / INTESTATARIO QUIETANZA:', col2X, boxY);

  boxY += 28;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 21px sans-serif';
  ctx.fillText(params.placeholderCtx.socio || 'Socio Tesserato', col1X, boxY);
  ctx.fillText(params.placeholderCtx.genitore || 'Genitore / Tutore', col2X, boxY);

  boxY += 26;
  ctx.fillStyle = '#475569';
  ctx.font = '15px sans-serif';
  if (params.config.showMemberAddress) {
    ctx.fillText(`Indirizzo: ${params.placeholderCtx.indirizzo_socio || '-'}`, col1X, boxY);
  }
  if (params.config.showParentFiscalCode) {
    ctx.font = '15px monospace';
    ctx.fillText(`C.F.: ${params.placeholderCtx.cf_genitore || 'Registrato agli atti'}`, col2X, boxY);
  }

  boxY += 24;
  ctx.font = '15px sans-serif';
  if (params.config.showCardNumberAndInsurance) {
    ctx.fillText(
      `Tessera: ${params.placeholderCtx.tessera || '-'} (${params.placeholderCtx.assicurazione || 'Gold'})`,
      col1X,
      boxY
    );
  }

  for (const dyn of params.resolvedHeaderDynamic) {
    boxY += 24;
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${dyn.label}: ${dyn.value}`, col1X, boxY);
  }

  y = boxTop + boxH + 28;

  // 3. Optional Intro Declaration
  if (params.config.showIntroDeclaration !== false && params.config.introDeclarationText) {
    const resolvedIntro = resolveDynamicTextPlaceholders(
      params.config.introDeclarationText,
      params.placeholderCtx
    );
    ctx.fillStyle = '#1e293b';
    ctx.font = '16px sans-serif';
    const introLines = wrapCanvasText(ctx, resolvedIntro, contentW - 24);
    for (const line of introLines) {
      ctx.fillText(line, leftX, y);
      y += 23;
    }
    y += 12;
  }

  // 4. Table of Prestazione & Dynamic Rows
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(leftX, y, contentW, 44);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(leftX, y, contentW, 44);

  ctx.fillStyle = '#334155';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('DESCRIZIONE DELLA PRESTAZIONE ISTITUZIONALE', leftX + 18, y + 27);
  ctx.textAlign = 'right';
  ctx.fillText('IMPORTO', rightX - 18, y + 27);

  y += 44;
  const subtextResolved = resolveDynamicTextPlaceholders(
    params.config.activityDescriptionSubtext,
    params.placeholderCtx
  );
  ctx.font = '15px sans-serif';
  const subLines = subtextResolved ? wrapCanvasText(ctx, subtextResolved, contentW - 240) : [];

  const activeItems = (params.lineItems || []).filter((li) => li.enabled);

  if (activeItems.length > 0) {
    activeItems.forEach((item, idx) => {
      const isFirst = idx === 0;
      const itemSubLines = isFirst ? subLines : [];
      const rowH = 54 + (item.subtitle ? 20 : 0) + itemSubLines.length * 20;

      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(leftX, y, contentW, rowH);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(item.title, leftX + 18, y + 30);

      ctx.textAlign = 'right';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(formatEuro(item.amount), rightX - 18, y + 32);

      let lineY = y + 50;
      if (item.subtitle) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#475569';
        ctx.font = 'italic 14px sans-serif';
        ctx.fillText(item.subtitle, leftX + 18, lineY);
        lineY += 20;
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      for (const sl of itemSubLines) {
        ctx.fillText(sl, leftX + 18, lineY);
        lineY += 20;
      }

      y += rowH;
    });
  } else {
    const mainRowH = 62 + subLines.length * 22;

    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(leftX, y, contentW, mainRowH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 19px sans-serif';
    ctx.fillText(params.activityTitle, leftX + 18, y + 32);

    ctx.textAlign = 'right';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(
      formatEuro(params.grossSubtotal !== undefined ? params.grossSubtotal : params.amount),
      rightX - 18,
      y + 34
    );

    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '15px sans-serif';
    let subY = y + 56;
    for (const sl of subLines) {
      ctx.fillText(sl, leftX + 18, subY);
      subY += 21;
    }

    y += mainRowH;
  }

  // Event Discount / ISEE / Copertura Quota Row (if present)
  if (params.discountAmount && params.discountAmount > 0) {
    const discRowH = 42;
    ctx.fillStyle = '#fffbeb';
    ctx.fillRect(leftX, y, contentW, discRowH);
    ctx.strokeStyle = '#fde68a';
    ctx.strokeRect(leftX, y, contentW, discRowH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 15px sans-serif';
    const dLabel = params.discountLabel?.trim() || 'Sconto / Riduzione Quota Applicata';
    ctx.fillText(`Sconto / Riduzione: ${dLabel}`, leftX + 18, y + 26);

    ctx.textAlign = 'right';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`- ${formatEuro(params.discountAmount)}`, rightX - 18, y + 27);
    y += discRowH;
  }

  // Voucher / Buono Spesa Row (if present)
  if (params.voucherApplied && params.voucherApplied > 0) {
    const vRowH = 42;
    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(leftX, y, contentW, vRowH);
    ctx.strokeStyle = '#a7f3d0';
    ctx.strokeRect(leftX, y, contentW, vRowH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Compensazione tramite Buono Spesa / Credito Socio', leftX + 18, y + 26);

    ctx.textAlign = 'right';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`- ${formatEuro(params.voucherApplied)}`, rightX - 18, y + 27);
    y += vRowH;
  }

  // Dynamic Table Rows + Custom Lines
  const allTableRows = [
    ...params.resolvedTableDynamic,
    ...params.config.customLines.map((cl) => ({
      label: cl.label,
      value: resolveDynamicTextPlaceholders(cl.value, params.placeholderCtx),
    })),
  ];

  for (const row of allTableRows) {
    const rowH = 38;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(leftX, y, contentW, rowH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(leftX, y, contentW, rowH);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${row.label}: `, leftX + 18, y + 24);
    const lblW = ctx.measureText(`${row.label}: `).width;
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(row.value, leftX + 18 + lblW, y + 24);
    y += rowH;
  }

  // Total Footer Row
  const totH = 54;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(leftX, y, contentW, totH);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.strokeRect(leftX, y, contentW, totH);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(
    `TOTALE NETTO ${params.docType === 'ricevuta' ? 'VERSATO' : 'PREVISTO'}:`,
    rightX - 210,
    y + 33
  );
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(formatEuro(params.amount), rightX - 18, y + 35);

  y += totH + 22;

  // Payment method & IBAN bar
  if (params.config.showPaymentMethod || params.config.showIbanOnReceipt) {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(leftX, y, contentW, 44);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX, y, contentW, 44);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 15px sans-serif';
    if (params.config.showPaymentMethod) {
      ctx.fillText(`Modalità di pagamento: ${params.paymentMethod}`, leftX + 16, y + 27);
    }
    if (params.config.showIbanOnReceipt && params.profile.iban) {
      ctx.textAlign = 'right';
      ctx.fillText(`IBAN ASD: ${params.profile.iban}`, rightX - 16, y + 27);
    }
    y += 62;
  }

  // Footer dynamic fields
  for (const fd of params.resolvedFooterDynamic) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${fd.label}: ${fd.value}`, leftX, y);
    y += 24;
  }

  // Legal tax clause
  if (params.config.showLegalNotice && params.config.legalTaxClause) {
    y += 8;
    const resolvedClause = resolveDynamicTextPlaceholders(
      params.config.legalTaxClause,
      params.placeholderCtx
    );
    ctx.font = '13px sans-serif';
    const clauseLines = wrapCanvasText(
      ctx,
      `Nota fiscale e legale ASD: ${resolvedClause}`,
      contentW - 32
    );
    const clauseBoxH = clauseLines.length * 19 + 24;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(leftX, y, contentW, clauseBoxH);
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(leftX, y, contentW, clauseBoxH);

    ctx.fillStyle = '#475569';
    ctx.textAlign = 'left';
    let cy = y + 22;
    for (const cl of clauseLines) {
      ctx.fillText(cl, leftX + 16, cy);
      cy += 19;
    }
    y += clauseBoxH + 20;
  }

  // Footer notes
  if (params.config.footerNotes) {
    const resolvedNotes = resolveDynamicTextPlaceholders(
      params.config.footerNotes,
      params.placeholderCtx
    );
    ctx.fillStyle = '#64748b';
    ctx.font = 'italic 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(resolvedNotes, leftX, y + 10);
    y += 30;
  }

  // 5. Bottom Signature & Stamp Overlay Area
  const sigTopY = Math.max(y + 30, H - pad - 220);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftX, sigTopY);
  ctx.lineTo(rightX, sigTopY);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '15px sans-serif';
  ctx.fillText('Il Presidente / Legale Rappresentante:', leftX, sigTopY + 34);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(params.profile.president || 'Il Presidente', leftX, sigTopY + 62);

  if (params.config.showQuietanzaLine) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = '15px sans-serif';
    ctx.fillText(
      params.docType === 'ricevuta'
        ? "Per quietanza dell'importo:"
        : 'Firma per presa visione:',
      rightX,
      sigTopY + 34
    );

    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(rightX - 260, sigTopY + 125);
    ctx.lineTo(rightX, sigTopY + 125);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Load and draw Stamp & Signature Overlays with scale, rotation, opacity, and X/Y offsets
  const stampOverlay = params.config.stampOverlay || DEFAULT_STAMP_OVERLAY;
  const sigOverlay = params.config.signatureOverlay || DEFAULT_SIGNATURE_OVERLAY;

  if (params.config.showStamp && params.stampDataUrl) {
    const stampImg = await loadImageElement(params.stampDataUrl);
    if (stampImg) {
      const baseW = 220 * (stampOverlay.scalePercent / 100);
      const ratio = stampImg.height / (stampImg.width || 1);
      const drawW = baseW;
      const drawH = baseW * ratio;

      const baseCenterX =
        stampOverlay.overlapMode === 'overlap_signature'
          ? leftX + 210
          : leftX + contentW / 2;
      const baseCenterY = sigTopY + 95;

      ctx.save();
      ctx.globalAlpha = Math.max(0.1, Math.min(1, stampOverlay.opacity));
      ctx.translate(
        baseCenterX + (stampOverlay.offsetX || 0) * 1.6,
        baseCenterY + (stampOverlay.offsetY || 0) * 1.6
      );
      ctx.rotate(((stampOverlay.rotationDeg || 0) * Math.PI) / 180);
      ctx.drawImage(stampImg, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
  }

  if (params.config.showSignature && params.signatureDataUrl) {
    const sigImg = await loadImageElement(params.signatureDataUrl);
    if (sigImg) {
      const baseW = 200 * (sigOverlay.scalePercent / 100);
      const ratio = sigImg.height / (sigImg.width || 1);
      const drawW = baseW;
      const drawH = baseW * ratio;

      const baseCenterX = leftX + 135;
      const baseCenterY = sigTopY + 105;

      ctx.save();
      ctx.globalAlpha = Math.max(0.1, Math.min(1, sigOverlay.opacity));
      ctx.translate(
        baseCenterX + (sigOverlay.offsetX || 0) * 1.6,
        baseCenterY + (sigOverlay.offsetY || 0) * 1.6
      );
      ctx.rotate(((sigOverlay.rotationDeg || 0) * Math.PI) / 180);
      ctx.drawImage(sigImg, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    }
  }

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
  return buildPdfBlobFromJpegDataUrl(jpegDataUrl, W, H);
}

export async function exportReceiptToPdfWithOverlays(
  params: ReceiptPdfGenerationParams
): Promise<void> {
  const pdfBlob = await generateReceiptPdfBlobWithOverlays(params);
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = params.fileName.endsWith('.pdf')
    ? params.fileName
    : `${params.fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ============================================================================
// GENERAZIONE PDF A4: MODULO RIEPILOGO DATI SOCIO, CONSENSI FOTO & PRIVACY DA FIRMARE
// ============================================================================

export async function generateMemberSummaryConsentPdfBlob(params: {
  member: Member;
  profile: AssociationProfile;
  docDate?: string;
}): Promise<Blob> {
  const { member, profile } = params;
  const docDate = params.docDate || new Date().toLocaleDateString('it-IT');

  const W = 1240;
  const H = 1754; // A4 @ 150 DPI
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Impossibile inizializzare il canvas per il riepilogo socio.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const pad = 64;
  const leftX = pad + 40;
  const rightX = W - pad - 40;
  const contentW = rightX - leftX;

  // Institutional Outer Border
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(pad, pad, W - pad * 2, H - pad * 2);

  let y = pad + 54;

  // Header
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText((profile.name || 'APUACAMP A.S.D.').toUpperCase(), leftX, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`ANNO SPORTIVO ${profile.activeYear}`, rightX, y - 4);

  y += 24;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = '15px sans-serif';
  ctx.fillText(
    `${profile.legalType || 'Associazione Sportiva Dilettantistica'} — C.F. ${profile.fiscalCode} — ${profile.address}`,
    leftX,
    y
  );
  ctx.textAlign = 'right';
  ctx.font = '14px monospace';
  ctx.fillText(`Data scheda: ${docDate}`, rightX, y);

  y += 20;
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  ctx.fillText(profile.affiliation || 'Affiliata US ACLI / CONI - RASD', leftX, y);

  y += 20;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(leftX, y, contentW, 44);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'MODULO RIEPILOGO DATI SOCIO, DOMANDA DI AMMISSIONE E CONSENSI (DA FIRMARE)',
    W / 2,
    y + 28
  );

  y += 64;

  const drawSectionHeader = (title: string, badgeRight?: string) => {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(leftX, y, contentW, 36);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX, y, contentW, 36);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(title, leftX + 14, y + 23);
    if (badgeRight) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(badgeRight, rightX - 14, y + 23);
    }
    y += 36;
  };

  const drawKeyValueRow = (
    k1: string,
    v1: string,
    k2?: string,
    v2?: string,
    rowHeight: number = 42
  ) => {
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(leftX, y, contentW, rowHeight);

    const midX = leftX + contentW / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(k1.toUpperCase(), leftX + 14, y + 16);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(v1 || '-', leftX + 14, y + 34);

    if (k2 !== undefined) {
      ctx.beginPath();
      ctx.moveTo(midX, y);
      ctx.lineTo(midX, y + rowHeight);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(k2.toUpperCase(), midX + 14, y + 16);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(v2 || '-', midX + 14, y + 34);
    }

    y += rowHeight;
  };

  // Section 1: Dati Socio / Partecipante Minore
  drawSectionHeader(
    '1. DATI ANAGRAFICI DEL SOCIO / PARTECIPANTE (MINORE)',
    `Tessera N° ${member.membershipCardNumber || 'In assegnazione'}`
  );
  drawKeyValueRow(
    'Cognome e Nome Partecipante',
    member.childName,
    'Data e Luogo di Nascita',
    `${member.birthDate || '-'} (${member.birthPlace || '-'})`
  );
  drawKeyValueRow(
    'Codice Fiscale Partecipante',
    member.childFiscalCode || '-',
    'Indirizzo di Residenza',
    member.childAddress || '-'
  );
  drawKeyValueRow(
    'Gruppo / Fascia Educativa',
    `Gruppo ${member.group} anni`,
    'Formula Tesseramento & Copertura Assicurativa',
    `Polizza ${member.insuranceType} — Scadenza: ${member.expiryDate || '-'}`
  );

  y += 16;

  // Section 2: Dati Genitore / Esercente Responsabilità Genitoriale
  drawSectionHeader('2. DATI DEL GENITORE / TUTORE INTESTATARIO E CONTATTI DI EMERGENZA');
  drawKeyValueRow(
    'Cognome e Nome Genitore / Tutore',
    member.parentName || '-',
    'Codice Fiscale Genitore (per detrazione 19%)',
    member.parentFiscalCode || '-'
  );
  drawKeyValueRow(
    'Recapito Telefonico / WhatsApp Emergenze',
    member.parentPhone || '-',
    'Indirizzo Email per Comunicazioni e Ricevute',
    member.parentEmail || '-'
  );

  y += 16;

  // Section 3: Scheda Medica, Allergie, Intolleranze e Bisogni Educativi Speciali
  drawSectionHeader('3. SCHEDA SANITARIA, ALLERGIE ALIMENTARI/FARMACI E NOTE ORGANIZZATIVE');
  const allergyText =
    member.allergies && member.allergies.trim() && member.allergies.toLowerCase() !== 'nessuna'
      ? member.allergies
      : 'Nessuna allergia o intolleranza segnalata';
  const conditionsText =
    member.notesConditions && member.notesConditions.trim()
      ? member.notesConditions
      : 'Nessuna nota medica/educativa particolare segnalata';

  drawKeyValueRow('Allergie / Intolleranze / Regimi Alimentari', allergyText, undefined, undefined, 46);
  drawKeyValueRow('Note Mediche, Farmaci al Bisogno, BES o Deleghe Ritiro', conditionsText, undefined, undefined, 46);

  y += 18;

  // Section 4: Dichiarazione Ammissione Socio, Statuto e Consenso Privacy GDPR
  drawSectionHeader('4. DOMANDA DI AMMISSIONE A SOCIO, ACCETTAZIONE STATUTO E TRATTAMENTO DATI (GDPR)');
  const legalParagraph =
    `Il/La sottoscritto/a ${member.parentName || '________________'}, in qualità di genitore/tutore esercente la responsabilità genitoriale sul minore ${member.childName}, CONFERMA l'esattezza dei dati sopra riportati e CHIEDE l'iscrizione/rinnovo del minore quale Socio di ${profile.name} (${profile.affiliation || 'US ACLI'}) per l'anno sportivo ${profile.activeYear}, dichiarando di conoscere e accettare lo Statuto sociale, i regolamenti interni e le condizioni della polizza assicurativa (${member.insuranceType}). ` +
    `Ai sensi degli artt. 13 e 14 del Regolamento UE 2016/679 (GDPR), autorizza il trattamento dei dati personali e particolari (inclusi i dati sanitari/allergie indicati al punto 3) esclusivamente per le finalità istituzionali, assicurative, sportive e di sicurezza dell'Associazione.`;

  ctx.font = '14px sans-serif';
  const legalLines = wrapCanvasText(ctx, legalParagraph, contentW - 32);
  const legalBoxH = legalLines.length * 20 + 95;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(leftX, y, contentW, legalBoxH);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(leftX, y, contentW, legalBoxH);

  ctx.fillStyle = '#1e293b';
  ctx.textAlign = 'left';
  let ly = y + 24;
  for (const line of legalLines) {
    ctx.fillText(line, leftX + 16, ly);
    ly += 20;
  }

  // Signature box 1 (Ammissione Socio & GDPR)
  const sig1Y = y + legalBoxH - 22;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`Luogo e Data: ________________, ${docDate}`, leftX + 16, sig1Y);

  ctx.textAlign = 'right';
  ctx.fillText('FIRMA DEL GENITORE / TUTORE (Obbligatoria per Iscrizione e GDPR):', rightX - 280, sig1Y);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rightX - 265, sig1Y + 2);
  ctx.lineTo(rightX - 16, sig1Y + 2);
  ctx.stroke();

  y += legalBoxH + 18;

  // Section 5: Autorizzazione Foto e Video
  drawSectionHeader('5. CONSENSO UTILIZZO IMMAGINI, FOTO E RIPRESE VIDEO ATTIVITÀ OUTDOOR');
  const photoBoxH = 148;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(leftX, y, contentW, photoBoxH);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(leftX, y, contentW, photoBoxH);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#1e293b';
  ctx.font = '14px sans-serif';
  const photoDesc =
    `Ai sensi dell'art. 96 L. 633/1941 e del Regolamento UE 2016/679, con riferimento alla realizzazione e pubblicazione a titolo gratuito di foto e video ritraenti il/la minore durante le attività didattiche, escursionistiche e sportive di ${profile.name} (sito web, pagina social e documentazione associativa):`;
  const photoLines = wrapCanvasText(ctx, photoDesc, contentW - 32);
  let py = y + 24;
  for (const pl of photoLines) {
    ctx.fillText(pl, leftX + 16, py);
    py += 19;
  }

  py += 12;
  ctx.font = 'bold 15px sans-serif';
  const giveMark = member.photoConsent ? '[ X ]' : '[   ]';
  const denyMark = !member.photoConsent ? '[ X ]' : '[   ]';
  ctx.fillStyle = member.photoConsent ? '#065f46' : '#334155';
  ctx.fillText(`${giveMark} PRESTANO IL CONSENSO (AUTORIZZANO FOTO/VIDEO)`, leftX + 16, py);
  ctx.fillStyle = !member.photoConsent ? '#991b1b' : '#334155';
  ctx.fillText(`${denyMark} NEGANO IL CONSENSO (NON AUTORIZZANO)`, leftX + 510, py);

  const sig2Y = y + photoBoxH - 20;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('FIRMA DEL GENITORE / TUTORE PER CONSENSO FOTO/VIDEO:', rightX - 280, sig2Y);
  ctx.beginPath();
  ctx.moveTo(rightX - 265, sig2Y + 2);
  ctx.lineTo(rightX - 16, sig2Y + 2);
  ctx.stroke();

  y += photoBoxH + 24;

  // Footer note for archiving
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 13px sans-serif';
  ctx.fillText(
    `Documento generato dal Registro Soci di ${profile.name} — Da restituire firmato in Segreteria o via email per l'archiviazione ufficiale.`,
    W / 2,
    H - pad - 18
  );

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.94);
  return buildPdfBlobFromJpegDataUrl(jpegDataUrl, W, H);
}

export async function exportMemberSummaryConsentToPdf(params: {
  member: Member;
  profile: AssociationProfile;
  docDate?: string;
}): Promise<void> {
  const blob = await generateMemberSummaryConsentPdfBlob(params);
  const safeName = params.member.childName.replace(/\s+/g, '_');
  const fileName = `Riepilogo_Dati_e_Consensi_${safeName}_${params.profile.activeYear}.pdf`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

