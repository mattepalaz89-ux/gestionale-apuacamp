import { NavTab } from '../components/Sidebar';

export interface PageFeatureStep {
  title: string;
  description: string;
  actionHint?: string;
}

export interface PageGuideContent {
  tabId: NavTab;
  title: string;
  shortSubtitle: string;
  overview: string;
  features: PageFeatureStep[];
  proTips: string[];
  driveIntegrationNote: string;
}

export const PAGE_GUIDES: Record<NavTab, PageGuideContent> = {
  dashboard: {
    tabId: 'dashboard',
    title: 'Guida alla Pagina: Dashboard, Anno Attivo & Scadenze Critiche (Modalità Focus)',
    shortSubtitle:
      'Panoramica liquidità, scelta discreta anno attivo (Anno 2027 ▾), scadenze critiche in modalità Focus e salvataggio sicuro.',
    overview:
      "La Dashboard è il centro di controllo immediato dell'associazione. Mostra in alto una barra compatta con l'Anno Sportivo cliccabile (Anno 2026/2027 ▾) per cambiare annualità o consultare l'archivio, lo stato del salvataggio su Google Drive o File Locale su PC (.json), i 4 indicatori di liquidità e lo Scadenziario Critico in modalità Focus (le 4 scadenze più vicine + pulsante per espanderle tutte).",
    features: [
      {
        title: '1. Anno Sportivo Cliccabile Discreto (Anno 2026 / 2027 ▾)',
        description:
          "Poiché il cambio d'anno si effettua una sola volta l'anno (o per consultare l'archivio passato), l'anno attivo è un badge discreto ma sempre raggiungibile nella barra in alto e nel menu laterale.",
        actionHint: 'Clicca su "Anno 2027 ▾" nell\'Header, nella Sidebar o nella barra in Dashboard.',
      },
      {
        title: '2. Menu Laterale Organizzato in 4 Gruppi Logici & Guida On-Demand (? Guida)',
        description:
          "Il menu è diviso in 4 aree chiare: Operatività Quotidiana, Attività & Progetti, Vita Associativa & Alert (che include Staff & Compensi, Governance e Scadenze) e Configurazione & Archivio. La guida contestuale si apre a richiesta cliccando sul tasto '? Guida' in alto a destra.",
        actionHint: 'Clicca su "? Guida" o sull\'icona Manuale nella barra superiore.',
      },
      {
        title: "3. Scadenze Critiche in Modalità Focus & Inserimento Manuale (es. Bando Dicembre 2027)",
        description:
          "Di default vedi la barra temporale dell'anno, i 3 pilastri statutari (Affiliazione, Bilancio, Fisco) e le 4 scadenze più urgenti, con il pulsante 'Mostra tutte le scadenze dell'anno ▾' per espandere l'elenco completo e '+ Inserisci Scadenza Manuale' per aggiungere nuovi bandi o adempimenti.",
        actionHint: 'Clicca su "Mostra tutte le scadenze dell\'anno ▾" o "+ Inserisci Scadenza Manuale".',
      },
      {
        title: '4. Salvataggio Sicuro: Google Drive, File Locale su PC e Copia di Sicurezza Locale',
        description:
          'Lavora collegando Google Drive Live oppure un File Locale .json sul tuo PC (OneDrive/Dropbox). Una copia locale di sicurezza viene mantenuta sul computer (IndexedDB) contro chiusure accidentali e può essere cancellata in un clic al momento del logout.',
      },
    ],
    proTips: [
      'Nelle pagine Soci, Eventi e Cassa, gli strumenti di importazione (Modulo Google / Excel) sono raccolti nel cassetto a scomparsa "Importa / Google Form & Excel ▾" per mantenere la schermata pulita.',
      'Tutti gli indicatori si aggiornano istantaneamente ogni volta che registri un pagamento in Eventi, Tessere, Gadget o Staff.',
    ],
    driveIntegrationNote:
      'I dati sono custoditi su Google Drive ("Gestionale ASD / 07_Backup_Sistema") o nel tuo File Locale .json su PC / OneDrive / Dropbox, con copia di sicurezza locale cancellabile al logout.',
  },

  cashflow: {
    tabId: 'cashflow',
    title: 'Guida alla Pagina: Flusso di Cassa, Saldi Separati (Banca / PayPal / Contanti) & Contabilità',
    shortSubtitle:
      'Libro cassa con saldi separati C/C Bancario, PayPal e Contanti, Undo/Redo, spese ricorrenti, controllo duplicati ed export Excel.',
    overview:
      "Questa pagina gestisce l'intero rendiconto economico-finanziario dell'associazione. Mantiene separati il Conto Corrente Bancario, il Conto PayPal, la Cassa Contanti ed eventuali conti personalizzati, permette di scegliere per le uscite PayPal quale strumento è stato addebitato (Conto/Carta Bancaria di default oppure Saldo PayPal), supporta Annulla/Ripeti (Undo/Redo), Spese Ricorrenti ed esportazione Excel multi-scheda.",
    features: [
      {
        title: '1. Saldi Separati: Conto Corrente Bancario, Conto PayPal, Contanti e Conti Personalizzati',
        description:
          'Le entrate su PayPal restano nel Saldo PayPal separato dal Conto Corrente Bancario. Quando registri un\'uscita pagata tramite PayPal, puoi scegliere lo strumento utilizzato dentro PayPal: di default l\'uscita viene scalata dal Conto Corrente Bancario (carta/conto collegato a PayPal), oppure puoi selezionare "Saldo PayPal" o un secondo conto personalizzato.',
        actionHint: 'Clicca su "Aggiungi Movimento" o "Gestisci Conti / Metodi" per configurare altri conti.',
      },
      {
        title: '2. Scelta Data Movimento ("Data di Oggi" vs "Data Diversa / Reale") & Annulla/Ripeti (Undo/Redo)',
        description:
          'Ogni volta che registri un movimento puoi scegliere tra la data odierna o la data effettiva del pagamento. Con i pulsanti Annulla (Undo) e Ripeti (Redo) puoi annullare o ripristinare in sicurezza le ultime modifiche contabili.',
        actionHint: 'Usa i pulsanti Undo/Redo nella barra superiore o nella testata del Libro Cassa.',
      },
      {
        title: '3. Spese Ricorrenti (Mensili, Annue o a Durata Determinata) & Bilancio Excel (.xlsx)',
        description:
          'Configura piani di spesa ricorrente (affitto, utenze, compensi periodici) e contabilizza in un clic le rate maturate. Esporta il bilancio multi-scheda in Excel (.xlsx) o sincronizzalo su Google Sheets.',
      },
      {
        title: '4. Alert Movimenti Duplicati (Entro 7 Giorni) & Giustificativi su Drive',
        description:
          'Il gestionale rileva automaticamente eventuali movimenti doppi riferiti alla stessa persona e dello stesso importo entro 7 giorni, permettendoti di verificarli o eliminarli da un popup dedicato.',
      },
    ],
    proTips: [
      'Di default tutte le uscite (anche quelle passate da PayPal) vengono addebitate sul Conto Corrente Bancario, salvo che tu selezioni esplicitamente "Saldo PayPal" o un altro metodo.',
      'I collegamenti tra movimenti, soci, eventi, collaboratori e ricevute avvengono tramite ID univoco strutturato.',
    ],
    driveIntegrationNote:
      'Salva i fogli contabili e le fatture in "Gestionale ASD / 02_Contabilita_e_Cassa" su Google Drive o nel File Locale .json su PC.',
  },

  members: {
    tabId: 'members',
    title: 'Guida alla Pagina: Anagrafica Soci (Minori e Adulti), Buoni Spesa & Modulo Firma',
    shortSubtitle:
      'Supporto Soci Minori e Soci Adulti, intestazioni cliccabili (A→Z / Z→A), Buoni Spesa e PDF Riepilogo Dati da Firmare.',
    overview:
      "Qui gestisci il Libro Soci completo dell'associazione: supporta sia soci minorenni (con dati del genitore/tutore) sia Soci Adulti maggiorenni (spunta 'Socio Adulto' con campi genitore facoltativi), codici fiscali, allergie/BES, consensi foto/video, credito Buoni Spesa e archivio del Modulo Riepilogo Dati firmato.",
    features: [
      {
        title: '1. Soci Minorenni e Soci Adulti (Maggiorenni) & Fasce Personalizzabili',
        description:
          'Quando iscrivi o modifichi un socio puoi spuntare "Socio Adulto (Maggiorenne — campi genitore facoltativi)". Le fasce d\'età/gruppi e le tipologie di tessera si adattano automaticamente a quelle configurate per la tua associazione.',
        actionHint: 'Clicca su "+ Nuovo Socio" o sulla matita di modifica per scegliere tra minore e adulto.',
      },
      {
        title: '2. Riordino Rapido Cliccando sulle Intestazioni della Tabella (A→Z / Z→A)',
        description:
          'Clicca direttamente sui titoli delle colonne della tabella ("Bimbo / Socio", "Gruppo", "Genitore & Contatti", "N° Tessera / Tipo / Scadenza", "Quota & Buono"): il primo clic ordina dalla A alla Z, il secondo inverte dalla Z alla A.',
      },
      {
        title: '3. Gestione Buoni Spesa & Modulo Riepilogo Dati da Firmare (PDF A4 + Gmail)',
        description:
          'Imposta un credito "Buono Spesa Disponibile (€)" utilizzabile negli Eventi e genera con un clic il PDF "Modulo Firma" da stampare o inviare via Gmail per raccogliere la firma privacy/consensi.',
        actionHint: 'Clicca sul pulsante "Modulo Firma" nella riga del socio.',
      },
      {
        title: '4. Matching Deterministico per Codice Fiscale con Eventi, Tessere & Google Form',
        description:
          'L\'abbinamento tra iscrizioni eventi, risposte Google Form e soci in Anagrafica avviene prima per Codice Fiscale, poi per Nome + Data di nascita, segnalando eventuali omonimi.',
      },
    ],
    proTips: [
      'Se la tua associazione gestisce anche soci adulti, attiva "Gestione Soci Adulti" nella Configurazione Guidata: le etichette diventeranno automaticamente "Socio / Partecipante".',
      'Il badge verde "Modulo Firmato ✓" indica a colpo d\'occhio quali soci hanno già consegnato il modulo firmato.',
    ],
    driveIntegrationNote:
      'Il Modulo Google e il Foglio Google "Anagrafica Soci" vengono salvati in "Gestionale ASD / 01_Anagrafica_Soci_e_Tessere".',
  },

  cards: {
    tabId: 'cards',
    title: 'Guida alla Pagina: Tessere US ACLI, Riordino Colonne & Coperture Assicurative',
    shortSubtitle:
      'Intestazioni cliccabili (per N° Tessera, Tipo, Scadenza, Socio, Genitore), Formula Tessera 365 e Tessera Digitale.',
    overview:
      "Questa sezione permette di gestire, ordinare, emettere e rinnovare esclusivamente le Tessere US ACLI e le coperture assicurative in modo rapido e separato dall'Anagrafica completa, mantenendo il 100% di sincronizzazione automatica con l'Anagrafica Soci, gli Eventi e il Flusso di Cassa.",
    features: [
      {
        title: '1. Riordino Rapido per N° Tessera, Tipo di Tessera, Scadenza, Nome o Genitore',
        description:
          'Clicca sulle intestazioni della tabella ("Socio / Bimbo", "Genitore & Contatti", "N° Tessera US ACLI", "Livello Assicurativo", "Emissione & Scadenza", "Stato Quota") per ordinare istantaneamente l\'elenco (1° clic A→Z, 2° clic Z→A).',
        actionHint: 'Clicca sul titolo della colonna che desideri ordinare.',
      },
      {
        title: '2. Modifica o Rinnovo Rapido della Sola Tessera',
        description:
          'Cliccando su "Modifica / Rinnova Tessera" apri un popup dedicato ai soli dati di tesseramento (Numero Tessera US ACLI, Livello Assicurativo, Data Emissione, Formula Solare 31/12 o Tessera 365 e Quota pagata) che aggiorna istantaneamente anche l\'Anagrafica Soci.',
        actionHint: 'Clicca su "Modifica / Rinnova Tessera" su qualsiasi riga della tabella.',
      },
      {
        title: '3. Ricevuta Tessera PDF & Invio Diretto tramite Gmail',
        description:
          'Cliccando sull\'icona della stampante puoi generare la ricevuta della quota associativa e inviarla direttamente al genitore tramite Gmail con il PDF allegato.',
      },
      {
        title: '4. Generatore Tessera Digitale PDF/PNG & Nomi Assicurazioni Personalizzabili',
        description:
          'Genera la Tessera Digitale da inviare al socio e personalizza liberamente i nomi dei livelli assicurativi (Base, Summer, Gold, Platinum), lo stemma ASD, lo sfondo e la posizione dei testi.',
        actionHint: 'Clicca su "Modello Tessera Digitale & Nomi Assicurazioni".',
      },
    ],
    proTips: [
      'I soci degli anni passati che non partecipano ad attività restano visibili con il filtro "Inattivi (Senza Eventi)" e non generano notifiche di scadenza finché non si iscrivono a un evento.',
    ],
    driveIntegrationNote:
      'Ogni tessera emessa o rinnovata qui aggiorna in tempo reale il database su Google Drive o il tuo File Locale .json su PC.',
  },

  events: {
    tabId: 'events',
    title: 'Guida alla Pagina: Eventi, Sconti Personalizzabili (ISEE / Enti), Buoni & Ricevute Gmail',
    shortSubtitle:
      'Sconti evento in Quota Fissa (€) o Percentuale (%) con diciture salvabili, utilizzo Buoni Spesa e invio ricevute via Gmail.',
    overview:
      "Permette di gestire gli eventi dell'ASD (Campi Estivi, Rifugi, Wild Camp, La Selva, Giornate) con coordinamento automatico verso Anagrafica e Tessere, gestione di Sconti specifici per singolo evento (in quota fissa € o in percentuale %) con diciture personalizzabili per le ricevute, compensazione Buoni Spesa e invio email tramite Gmail.",
    features: [
      {
        title: '1. Sconti per Singolo Evento (Quota Fissa € o Percentuale %) e Diciture Salvabili',
        description:
          'Poiché gli sconti non sono fissi ma variano per singolo evento o attività (es. riduzioni fascia ISEE, quote coperte in tutto o in parte da Comuni o da altre Associazioni, sconto fratelli), puoi inserirli sia quando iscrivi un partecipante sia cliccando sull\'icona Cartellino Sconto nella riga dell\'iscritto. Scegli tra Quota Fissa (€) o Percentuale (%) e inserisci la dicitura per la ricevuta: la dicitura resta salvata automaticamente tra quelle selezionabili per ricevute future di altri soci o di altri eventi.',
        actionHint: 'Clicca sull\'icona Cartellino Sconto nelle azioni dell\'iscritto o nella finestra "Iscrivi Partecipante".',
      },
      {
        title: '2. Utilizzo Buoni Spesa per Compensare il Costo dell\'Evento',
        description:
          'Se il socio dispone di un Buono Spesa in Anagrafica, quando lo selezioni per l\'iscrizione all\'evento il sistema mostra subito il credito disponibile e permette di utilizzarlo in tutto o in parte per ridurre il saldo netto da pagare.',
      },
      {
        title: '3. Ricevuta Evento Precompilata & Invio tramite Gmail con PDF Allegato',
        description:
          'Cliccando sull\'icona Stampante accanto a un iscritto, il sistema apre il Modello Ricevuta proponendo già in automatico le voci dell\'evento, l\'eventuale sconto con la sua dicitura specifica e il buono applicato, pronto per essere scaricato in PDF o inviato con un clic tramite Gmail.',
        actionHint: 'Clicca sull\'icona Stampante nella riga dell\'iscritto e poi su "Invia via Gmail (con PDF allegato)".',
      },
      {
        title: '4. Popup Coordinamento Anagrafica/Tessera & Briefing Pre-Evento',
        description:
          'Controlla subito tessere mancanti/scadute, allergie, bisogni speciali e consensi foto, e regolarizza anagrafica e tessera direttamente dall\'evento senza cambiare pagina.',
      },
    ],
    proTips: [
      'Ogni nuova dicitura di sconto che scrivi (es. "Quota coperta da Associazione X") viene memorizzata automaticamente nel menu a tendina per risparmiarti di riscriverla per gli altri ragazzi.',
    ],
    driveIntegrationNote:
      'I Moduli Google e gli elenchi iscritti vengono archiviati in "Gestionale ASD / 03_Eventi_e_Iscritti".',
  },

  gadgets: {
    tabId: 'gadgets',
    title: 'Guida alla Pagina: Gadget, Merchandising, Ricevute PDF & Invio Gmail',
    shortSubtitle:
      'Catalogo materiale associativo, prenotazioni taglie, generazione ricevuta PDF e invio conferma via Gmail.',
    overview:
      "Gestisce il catalogo dei gadget associativi e le prenotazioni dei soci, permettendo di registrare l'incasso nel Flusso di Cassa e di inviare la ricevuta PDF in allegato tramite Gmail.",
    features: [
      {
        title: '1. Catalogo Articoli, Taglie e Giacenze Magazzino',
        description:
          'Aggiungi nuovi articoli specificando categoria, prezzo unitario, varianti/taglie disponibili e quantità a magazzino.',
        actionHint: 'Clicca su "Aggiungi Articolo a Catalogo".',
      },
      {
        title: '2. Ricevuta Gadget Automatica & Invio tramite Gmail con PDF Allegato',
        description:
          'Cliccando sull\'icona Stampante nella riga di una prenotazione gadget si apre il Modello Ricevuta Intelligente già impostato con i dati del gadget prenotato, pronto per essere inviato via Gmail con il PDF allegato.',
        actionHint: 'Clicca sull\'icona Stampante nella colonna Azioni della prenotazione gadget.',
      },
      {
        title: '3. Controllo Consegne, Scelta Data Cassa ed Email di Conferma',
        description:
          'Con un clic segni se il gadget è stato pagato (scegliendo tra Data di Oggi e Data Diversa per il libro cassa), se è stato consegnato e se è stata inviata l\'email al genitore.',
      },
    ],
    proTips: [
      'Puoi anche combinare nella stessa ricevuta il Gadget insieme alla Tessera o a un Evento usando i pulsanti "+ Evento" / "+ Tessera" dentro la finestra della ricevuta.',
    ],
    driveIntegrationNote:
      'Puoi importare prenotazioni da fogli CSV/Excel e salvare tutto su Google Drive o File Locale PC.',
  },

  grants: {
    tabId: 'grants',
    title: 'Guida alla Pagina: Bandi, Contributi & Progetti ASD',
    shortSubtitle: 'Scadenze presentazione/rendicontazione, caratteristiche, contatti e allegati Drive.',
    overview:
      'Sezione dedicata al monitoraggio dei Bandi pubblici e privati (Regione, Sport e Salute, Comuni, Fondazioni): tiene sotto controllo scadenze, importi richiesti/approvati, vincoli del bando, contatti RUP e tutta la documentazione progettuale.',
    features: [
      {
        title: '1. Scheda Completa del Bando e Doppia Scadenza',
        description:
          "Per ogni bando puoi registrare l'ente promotore, la Scadenza di Presentazione Domanda, la Scadenza di Rendicontazione Finale, lo stato della pratica e gli importi richiesto e finanziato.",
        actionHint: 'Clicca su "+ Nuovo Bando / Contributo".',
      },
      {
        title: '2. Caratteristiche Fondamentali e Contatti Utili',
        description:
          "Annota in modo strutturato i requisiti del bando (spese ammissibili, percentuale cofinanziamento, target) e i riferimenti diretti dell'ente (RUP, email PEC, sportello telefonico, link portale).",
      },
      {
        title: '3. Caricamento Documentazione Bando su Google Drive',
        description:
          'Allega direttamente dal gestionale i file del bando (Avviso PDF, Domanda compilata, Allegati tecnici, Fatture di rendicontazione): vengono caricati nella cartella Drive dedicata.',
        actionHint: 'Usa il pulsante "Carica Documento su Drive" dentro la scheda del bando.',
      },
    ],
    proTips: [
      'Le scadenze dei bandi compaiono anche nel widget "Scadenze Critiche dell\'Anno Solare" nella Dashboard principale.',
    ],
    driveIntegrationNote:
      'Tutti gli allegati vengono salvati in "Gestionale ASD / 05_Bandi_e_Progetti" sul Google Drive dell\'associazione.',
  },

  staff: {
    tabId: 'staff',
    title: 'Guida alla Pagina: Staff, Collaboratori Sportivi & Soglie D.Lgs. 36/2021 (5.000 € / 15.000 €)',
    shortSubtitle:
      'Monitoraggio soglia INPS (5.000 €) e IRPEF (15.000 €), compensi percepiti presso altre ASD, distinzione compenso vs rimborso e quietanze PDF.',
    overview:
      'Consente di monitorare i compensi erogati a guide, educatori, istruttori e collaboratori sportivi in conformità alla Riforma del Lavoro Sportivo (D.Lgs. 36/2021), cumulando anche i compensi percepiti dal lavoratore presso altre ASD/SSD nell\'anno solare ed escludendo dal massimale i rimborsi spese documentati.',
    features: [
      {
        title: '1. Soglie D.Lgs. 36/2021 sul Lavoratore (4.000 € Pre-Alert / 5.000 € INPS / 15.000 € IRPEF)',
        description:
          'Poiché la soglia di legge è calcolata sul singolo lavoratore sportivo e non sulla singola associazione, nella scheda di ogni collaboratore puoi inserire anche i "Compensi percepiti presso altre ASD/SSD nell\'anno". Il sistema mostra una barra di avanzamento e ti avvisa prima di pagare se il collaboratore supera 4.000 € (80% soglia), 5.000 € (obbligo contributivo INPS Gestione Separata e comunicazione RASD) o 15.000 € (soglia fiscale IRPEF).',
        actionHint: 'Clicca su "Modifica / Compensi Altre ASD" sulla scheda del collaboratore per inserire i compensi esterni.',
      },
      {
        title: '2. Distinzione tra "Compenso Sportivo" e "Rimborso Spese Documentato"',
        description:
          'Quando registri un pagamento staff puoi scegliere se si tratta di un Compenso Sportivo / Collaborazione (che concorre alle soglie dei 5.000 € e 15.000 €) oppure di un Rimborso Spese Documentato / Anticipo (che viene registrato in contabilità ma escluso dal calcolo del massimale fiscale/contributivo).',
      },
      {
        title: '3. Stampa Quietanza Compenso con Timbro ASD e Firma Grafica Etichettata',
        description:
          'Per ogni pagamento puoi generare la Quietanza PDF precompilata con l\'autodichiarazione dei compensi percepiti presso altri enti ex D.Lgs. 36/2021, il Timbro ASD e la Firma grafica etichettata del Presidente.',
        actionHint: 'Clicca su "Quietanza PDF" accanto al movimento nella tabella.',
      },
    ],
    proTips: [
      'Se hai movimenti storici nel Libro Cassa privi di collegamento strutturato staffId, un apposito pannello ti permette di collegarli con un clic al collaboratore corretto.',
    ],
    driveIntegrationNote:
      'L\'elenco collaboratori, i compensi esterni dichiarati e lo storico pagamenti sono salvati su Google Drive o nel tuo File Locale .json su PC.',
  },

  governance: {
    tabId: 'governance',
    title: 'Guida alla Pagina: Governance, Cariche Associative & Assemblee',
    shortSubtitle: 'Consiglio Direttivo, Safeguarding (Tutela Minori), Sicurezza e Verbali su Drive.',
    overview:
      "Raccoglie tutte le scadenze istituzionali obbligatorie dell'ASD: l'Assemblea Annuale dei Soci per l'approvazione del rendiconto economico-finanziario (entro il 30 Aprile) e le cariche sociali e tecniche con i relativi verbali su Google Drive.",
    features: [
      {
        title: '1. Assemblea Annuale Approvazione Rendiconto & Archivio Verbali Drive',
        description:
          "Pianifica le assemblee ordinarie e straordinarie, monitora lo stato (Da convocare, Convocata, Svolta e Approvata) e carica il PDF del verbale firmato direttamente nella cartella Google Drive dell'ASD.",
        actionHint: 'Usa "+ Nuova Assemblea" e il pulsante "Carica Verbale su Drive".',
      },
      {
        title: '2. Registro Cariche Associative, Safeguarding e Sicurezza (RSPP)',
        description:
          'Inserisci e aggiorna i componenti del Consiglio Direttivo, il Responsabile contro abusi, violenze e discriminazioni (Tutela Minori / Safeguarding) e il Responsabile Sicurezza con le rispettive date di scadenza mandato.',
        actionHint: 'Clicca su "+ Inserisci Carica / Nomina".',
      },
    ],
    proTips: [
      'Se manca il Responsabile Tutela Minori (Safeguarding) o il Responsabile Sicurezza, oppure se una carica è in scadenza entro 60 giorni, il gestionale mostra un avviso prioritario.',
    ],
    driveIntegrationNote:
      'I verbali delle assemblee e le nomine vengono salvati in "Gestionale ASD / 04_Verbali_Assemblee_e_Governance".',
  },

  receipts_config: {
    tabId: 'receipts_config',
    title: 'Guida alla Pagina: Registro Ricevute Progressivo, Modelli PDF, Controlli 730 & Gmail',
    shortSubtitle:
      'Registro ufficiale ricevute emesse/annullate (<ANNO>/R-<NNN>), controlli non bloccanti detrazione 730, 3 layout PDF e 5 modelli email.',
    overview:
      'Questo pannello racchiude il Registro Ufficiale delle Ricevute Emesse (con numerazione progressiva annuale <ANNO>/R-<NNN>, ristampa, reinvio Gmail, annullamento motivato ed export Excel) e la configurazione del Modello Ricevute PDF, di Timbro/Firma e dei 5 Modelli Email.',
    features: [
      {
        title: '1. Registro Ufficiale Ricevute con Numerazione Progressiva (<ANNO>/R-<NNN>)',
        description:
          'Il numero progressivo viene assegnato e consumato SOLO quando clicchi su "Emetti Ricevuta (PDF)" o "Emetti e Invia via Gmail" (aprire l\'anteprima o fare un preventivo non brucia mai numeri). Dal Registro Ricevute puoi filtrare per anno/stato, ristampare una ricevuta già emessa con lo stesso numero, annullarla con motivazione o esportare l\'intero registro in Excel.',
        actionHint: 'Apri la scheda "5. Registro Ricevute Emesse" per consultare o esportare tutte le ricevute.',
      },
      {
        title: '2. Controlli Automatici Non Bloccanti per Detrazione Fiscale 730 (Art. 15 TUIR)',
        description:
          'Durante la composizione della ricevuta, il sistema verifica se il pagamento è in Contanti (non detraibile nel 730), se mancano il Codice Fiscale del genitore o i dati del ragazzo (5–18 anni) e se l\'importo supera € 77,47 (nota imposta di bollo € 2,00 / esenzione ASD), mostrando avvisi gialli informativi che non bloccano mai l\'emissione.',
      },
      {
        title: '3. Scheda "4. Modelli Email & Sconti": 5 Modelli Email per Gmail con Allegato PDF',
        description:
          'Personalizza i 5 modelli email precompilati (Conferma & Ricevuta Evento, Ricevuta Tessera, Ricevuta Mensile Doposcuola, Ricevuta Gadget e Riepilogo Dati Iscrizione da Firmare) e l\'archivio delle diciture sconto.',
        actionHint: 'Clicca sulla scheda blu "4. Modelli Email & Sconti" in questa pagina.',
      },
      {
        title: '4. 3 Layout Grafici PDF, Timbro ASD e Firma Grafica Etichettata',
        description:
          'Scegli tra "Standard Classico", "Minimalista Moderno" e "Ufficiale Istituzionale". Quando è attiva l\'immagine della firma del Presidente, il PDF riporta la dicitura di trasparenza "Firma grafica del legale rappresentante su documento informatico".',
      },
    ],
    proTips: [
      'Se riapri la ricevuta di un movimento o di un\'iscrizione già collegata a una ricevuta emessa, il sistema ti mostra direttamente la ricevuta esistente evitando duplicati.',
    ],
    driveIntegrationNote:
      'Il Registro Ricevute, i modelli e le copie PDF inviate sono salvati su Google Drive e nel tuo File Locale .json su PC.',
  },

  notifications: {
    tabId: 'notifications',
    title: 'Guida alla Pagina: Scadenze Manuali, Risoluzione/Posticipo Alert & Rinnovo Intelligente',
    shortSubtitle:
      'Inserimento scadenze manuali (es. nuovi bandi dicembre 2027), rinnovo tessere solo per iscritti a eventi e gestione risolti/rimandati.',
    overview:
      "È il centro operativo delle scadenze e degli alert dell'ASD: permette di inserire scadenze manuali personalizzate (ad esempio un nuovo bando che scade a dicembre 2027 o altro), monitora le tessere da regolarizzare per i soli iscritti alle attività e consente di segnare qualsiasi notifica come 'Risolta' o 'Rimandata a un'altra data'.",
    features: [
      {
        title: '1. Inserimento e Modifica Scadenze Manuali (Bandi, Dicembre 2027, Fisco o Altro)',
        description:
          'Con il pulsante "+ Inserisci Scadenza Manuale (Bando o Altro)" puoi registrare qualsiasi scadenza futura (es. un bando che scade a dicembre 2027, una convenzione o un promemoria) e, se si tratta di un bando, creare contemporaneamente anche la scheda in "Bandi & Progetti".',
        actionHint: 'Clicca su "+ Inserisci Scadenza Manuale (Bando o Altro)" in alto nella pagina.',
      },
      {
        title: '2. Notifiche Rinnovo Tessere Solo per Soci Iscritti a Eventi o Attività',
        description:
          'I soci restano salvati in anagrafica anno dopo anno senza intasare le notifiche: il sistema genera l\'avviso di tessera scaduta/mancante SOLO se il socio si iscrive effettivamente a un evento o attività.',
      },
      {
        title: '3. Segna come "Risolta" (con Nota) o "Rimanda a un\'altra Data"',
        description:
          'Su ogni notifica o scadenza puoi cliccare "Digita Risolto" (inserendo una nota che sposta l\'alert nello storico risolti) oppure "Rimanda a Data" per posticipare l\'avviso a una data futura scelta da te.',
        actionHint: 'Usa i pulsanti "Digita Risolto" o "Rimanda a Data" presenti su ciascuna scheda.',
      },
      {
        title: '4. Alert Pre-Evento (Allergie, Bisogni Speciali e Consenso Foto) & Alert Email',
        description:
          'Mostra il riepilogo sicurezza per gli eventi imminenti e segnala i soci/iscritti a cui non è ancora stata inviata l\'email di conferma.',
      },
    ],
    proTips: [
      'Le scadenze inserite manualmente compaiono automaticamente sia in questa sezione (filtro "Scadenze Manuali" e "Scadenze Bandi") sia nella barra di avanzamento temporale della Dashboard.',
    ],
    driveIntegrationNote:
      'Tutte le scadenze manuali, le note di risoluzione e le date di posticipo vengono salvate su Google Drive o nel tuo File Locale .json su PC.',
  },

  backup: {
    tabId: 'backup',
    title: 'Guida alla Pagina: Google Drive Sicuro (drive.file), Backup Automatici, Archivi & Configurazione Multi-ASD',
    shortSubtitle:
      'Salvataggio su File Locale PC o Google Drive, punti di ripristino automatici, archivi annuali ibridi, privacy dati sanitari e Wizard Multi-ASD.',
    overview:
      "Da qui gestisci la persistenza sicura dei dati (File Locale .json su PC / OneDrive / Dropbox e Google Drive con permesso ristretto drive.file), i Punti di Ripristino automatici su Drive, l'Archiviazione Annuale ibrida su file separati (archivio_<anno>.json), l'anonimizzazione dei dati sanitari storici e la Configurazione Guidata Multi-Associazione.",
    features: [
      {
        title: '1. File Locale su PC (OneDrive / Dropbox), Google Drive (drive.file) & Pulizia al Logout',
        description:
          'Il gestionale utilizza il permesso ristretto "drive.file" (accede solo ai file creati dall\'app stessa). Per importare un Foglio Google creato manualmente fuori dall\'app, puoi incollare direttamente il link o l\'ID del foglio. Al logout ti viene proposto come scelta predefinita di cancellare tutti i dati locali dal computer (consigliato sui PC condivisi).',
        actionHint: 'Usa "Apri / Collega File .JSON da PC" oppure connetti Google Drive.',
      },
      {
        title: '2. Backup Automatici su Google Drive (Ultimi 30 + 1 al Mese) & Risoluzione Conflitti',
        description:
          'Il sistema crea automaticamente un backup giornaliero su Drive e un backup prima di ogni operazione delicata (importazione, archiviazione anno, reset o sovrascrittura conflitto). Puoi consultare la lista dei backup in "07_Backup_Sistema" e ripristinarne uno qualsiasi con un clic.',
      },
      {
        title: '3. Archivi Annuali Ibridi (archivio_<anno>.json) & Anonimizzazione Dati Sanitari Storici',
        description:
          'Quando chiudi l\'anno sportivo, l\'archivio completo viene salvato anche in un file separato "archivio_<anno>.json" nella cartella Drive "06_Archivio_Annualita_Storiche". Puoi inoltre configurare la politica di conservazione per anonimizzare allergie e note mediche negli archivi più vecchi di N anni, mantenendo intatti i dati contabili.',
      },
      {
        title: '4. Configurazione Guidata Multi-Associazione (Dati, Ente, Tessere, Categorie, Soci Adulti)',
        description:
          'Qualsiasi associazione può cliccare su "Configurazione Guidata (Tessere, Categorie, Ente, Soci Adulti)" per personalizzare in 4 passi denominazione, ente di affiliazione (US ACLI, CSEN, UISP, AICS, CSI, ecc.), tipologie di tessera, fasce d\'età, categorie di cassa ed eventi.',
        actionHint: 'Clicca su "Configurazione Guidata" nella sezione Dati Istituzionali ASD o su "Configura ASD" nella barra laterale.',
      },
    ],
    proTips: [
      'Nel piè di pagina della barra laterale trovi anche i link rapidi alle pagine informative pubbliche Privacy (/privacy) e Termini & Licenza (/termini).',
    ],
    driveIntegrationNote:
      'Supporta sia Google Drive ("Gestionale ASD") sia qualsiasi cartella locale PC sincronizzata con OneDrive, Dropbox o disco fisso.',
  },
};

export function getPageGuide(tab: NavTab): PageGuideContent {
  return PAGE_GUIDES[tab] || PAGE_GUIDES.dashboard;
}

export function getAllPageGuides(): PageGuideContent[] {
  return Object.values(PAGE_GUIDES);
}
