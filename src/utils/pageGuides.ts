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
        title: '4. Salvataggio Sicuro: Solo Google Drive o File Locale su PC (OneDrive/Dropbox)',
        description:
          'Nessun salvataggio sulla memoria volatile del browser: lavora collegando Google Drive Live oppure un File Locale .json sul tuo PC.',
      },
    ],
    proTips: [
      'Nelle pagine Soci, Eventi e Cassa, gli strumenti di importazione (Modulo Google / Excel) sono raccolti nel cassetto a scomparsa "Importa / Google Form & Excel ▾" per mantenere la schermata pulita.',
      'Tutti gli indicatori si aggiornano istantaneamente ogni volta che registri un pagamento in Eventi, Tessere, Gadget o Staff.',
    ],
    driveIntegrationNote:
      'I dati sono custoditi esclusivamente su Google Drive ("Gestionale ASD / 07_Backup_Sistema") oppure nel tuo File Locale .json su PC / OneDrive / Dropbox.',
  },

  cashflow: {
    tabId: 'cashflow',
    title: 'Guida alla Pagina: Flusso di Cassa, Spese Ricorrenti & Contabilità',
    shortSubtitle:
      'Libro cassa con scelta "Data di Oggi vs Data Diversa", spese ricorrenti, controllo duplicati ed export Excel.',
    overview:
      "Questa pagina gestisce l'intero rendiconto economico-finanziario dell'ASD. Permette di registrare entrate e uscite scegliendo sempre se usare la Data di Oggi o una Data Diversa (reale), pianificare Spese Ricorrenti (mensili, annue o a tempo determinato), allegare fatture su Google Drive ed esportare il bilancio.",
    features: [
      {
        title: '1. Scelta Data Movimento: "Data di Oggi (Attuale)" o "Data Diversa (Reale)"',
        description:
          'Ogni volta che registri un movimento (in Cassa, Tessere, Eventi, Gadget o Staff), il gestionale ti chiede espressamente se registrarlo con la data odierna o con la data effettiva in cui è avvenuto il pagamento, così il libro cassa rispecchia sempre le date reali.',
        actionHint: 'Clicca su "Aggiungi Movimento" e scegli tra "Data di Oggi" e "Data Diversa".',
      },
      {
        title: '2. Spese Ricorrenti (Mensili, Annue o a Durata Determinata)',
        description:
          'Configura piani di spesa ricorrente (es. affitto sede, utenze, compensi mensili, canoni annuali o rate con data di fine / numero massimo di rate) e contabilizza in un clic le rate maturate nel Libro Cassa.',
        actionHint: 'Usa il pannello "Spese Ricorrenti" sopra la tabella dei movimenti.',
      },
      {
        title: '3. Impostazione Fondo Iniziale (Banca e Contanti) & Bilancio Excel (.xlsx)',
        description:
          'Imposta la liquidità iniziale di apertura esercizio divisa tra Banca e Contanti ed esporta il bilancio multi-scheda in Excel (.xlsx) o sincronizzalo su Google Sheets.',
      },
      {
        title: '4. Alert Movimenti Duplicati (Entro 7 Giorni) & Giustificativi su Drive',
        description:
          'Il gestionale rileva automaticamente eventuali movimenti doppi riferiti alla stessa persona e dello stesso importo entro 7 giorni, permettendoti di eliminarli da un popup dedicato.',
        actionHint: 'Passa il mouse sulle icone compatte della barra strumenti per leggere la funzione di ogni pulsante.',
      },
    ],
    proTips: [
      'I pulsanti secondari (come Modello Excel Vuoto, Esporta CSV e Azzera Cassa) sono ridotti a icone compatte con anteprima del nome al passaggio del mouse per mantenere la pagina ordinata.',
      'I pagamenti in "Contanti" aggiornano la Cassa Contanti; "Bonifico", "POS", "Bancomat", "Paypal" e "Pagam Online" aggiornano il Conto Bancario.',
    ],
    driveIntegrationNote:
      'Salva i fogli contabili e le fatture in "Gestionale ASD / 02_Contabilita_e_Cassa" su Google Drive o nel File Locale .json su PC.',
  },

  members: {
    tabId: 'members',
    title: 'Guida alla Pagina: Anagrafica Soci, Riordino Rapido, Buoni Spesa & Modulo Firma',
    shortSubtitle:
      'Intestazioni cliccabili (A→Z / Z→A), gestione Buoni Spesa attività, PDF Riepilogo Dati da Firmare e invio via Gmail.',
    overview:
      "Qui gestisci il Libro Soci completo dell'ASD: dati anagrafici del minore e del genitore, codici fiscali, allergie, bisogni speciali (BES), consensi foto/video, credito Buoni Spesa e archivio del Modulo Riepilogo Dati firmato dai genitori. L'anagrafica è coordinata in tempo reale sia con la sezione 'Tessere & Coperture' sia con la pagina 'Eventi & Iscrizioni'.",
    features: [
      {
        title: '1. Riordino Rapido Cliccando sulle Intestazioni della Tabella (A→Z / Z→A)',
        description:
          'Clicca direttamente sui titoli delle colonne della tabella ("Bimbo / Socio", "Gruppo", "Genitore & Contatti", "N° Tessera / Tipo / Scadenza", "Quota & Buono"): il primo clic ordina dalla A alla Z (crescente), il secondo clic inverte l\'ordine dalla Z alla A (decrescente).',
        actionHint: 'Clicca su qualsiasi intestazione di colonna nella tabella dei soci.',
      },
      {
        title: '2. Gestione Buoni Spesa per Compensare i Costi delle Attività',
        description:
          'Nella scheda di ogni socio puoi inserire e aggiornare un credito "Buono Spesa Disponibile (€)" (con relative note) da spendere in tutto o in parte per compensare il costo di eventi, campi estivi, doposcuola o altre attività. Gli sconti specifici (ISEE o coperture enti) si applicano invece direttamente nei singoli Eventi e nelle Ricevute.',
        actionHint: 'Apri la scheda di un socio (matita) o clicca "+ Nuovo Socio" per impostare il Buono Spesa.',
      },
      {
        title: '3. Modulo Riepilogo Dati & Consensi da Firmare (PDF A4 + Invio Gmail)',
        description:
          'Su ogni riga trovi il pulsante "Modulo Firma": apre il documento ufficiale con tutti i dati inviati dal socio (anagrafica, contatti, allergie/farmaci/BES, consenso foto/video, privacy GDPR e riquadri per la firma autografa dei genitori). Puoi scaricarlo in PDF A4, inviarlo via Gmail con allegato al genitore affinché lo controfirmi e spuntare "Firmato OK" quando rientra in archivio.',
        actionHint: 'Clicca sul pulsante "Modulo Firma" (o "Firmato OK") nella riga del socio.',
      },
      {
        title: '4. Coordinamento Automatico con Eventi, Tessere & Google Form',
        description:
          'Qualsiasi modifica fatta in Anagrafica aggiorna automaticamente la sezione "Tessere & Coperture" e le iscrizioni agli Eventi. Dal cassetto "Importa / Google Form & Excel ▾" puoi sincronizzare le risposte del modulo d\'iscrizione online.',
      },
    ],
    proTips: [
      'Il badge verde "Firmato OK" accanto al pulsante del modulo ti permette di vedere a colpo d\'occhio quali famiglie hanno già riconsegnato il modulo cartaceo o digitale firmato.',
      'Gli sconti non sono fissi in anagrafica: si inseriscono direttamente nei singoli Eventi o al momento di generare la Ricevuta.',
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
    title: 'Guida alla Pagina: Staff, Collaboratori Sportivi & Compensi',
    shortSubtitle:
      'Registro compensi (D.Lgs. 36/2021) con scelta "Data di Oggi vs Data Diversa" e quietanze PDF.',
    overview:
      'Consente di monitorare i compensi erogati a guide, educatori, istruttori e collaboratori sportivi in conformità alla Riforma dello Sport (D.Lgs. 36/2021), scegliendo la data effettiva di registrazione nel Flusso di Cassa e stampando le quietanze ufficiali.',
    features: [
      {
        title: '1. Riepilogo Compensi per Collaboratore e Verifica Soglie',
        description:
          'Visualizza per ogni membro dello staff il totale liquidato nell\'anno e il numero di operazioni registrate (utile per monitorare la soglia esente di € 5.000 / € 15.000 prevista dal D.Lgs. 36/2021).',
      },
      {
        title: '2. Registrazione Compenso con Scelta "Data di Oggi" o "Data Diversa"',
        description:
          'Cliccando su "Nuovo Compenso Staff" scegli se registrare l\'uscita nel Flusso di Cassa con la data di oggi oppure con la data effettiva del bonifico/erogazione.',
      },
      {
        title: '3. Stampa Quietanza Compenso con Timbro ASD e Firma Presidente',
        description:
          'Per ogni pagamento puoi generare la Quietanza PDF precompilata con la clausola di esenzione fiscale ex art. 25 D.Lgs. 36/2021 e l\'applicazione automatica del Timbro ASD e della Firma del Presidente.',
        actionHint: 'Clicca su "Quietanza PDF" accanto al movimento nella tabella.',
      },
    ],
    proTips: [
      'Clicca sulla scheda di un singolo collaboratore in alto per filtrare istantaneamente solo i suoi pagamenti.',
    ],
    driveIntegrationNote:
      'L\'elenco collaboratori e lo storico compensi sono salvati su Google Drive o nel tuo File Locale .json su PC.',
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
    title: 'Guida alla Pagina: Modello Ricevute Intelligente, Modelli Email Gmail & Diciture Sconto',
    shortSubtitle:
      'Compositore ricevute multi-voce (Eventi, Doposcuola, Tessere, Gadget), 5 modelli email Gmail e archivio diciture sconto.',
    overview:
      'Questo pannello ti permette di personalizzare il Modello Unico Intelligente per le Ricevute PDF (valido per Eventi, Mensile Doposcuola/Selva, Tessere e Gadget), configurare Timbro ASD e Firma del Presidente, modificare i 5 Modelli Email predefiniti per l\'invio tramite Gmail e gestire l\'archivio delle Diciture Sconto selezionabili.',
    features: [
      {
        title: '1. Compositore Ricevute Intelligente (Eventi, Mensile Doposcuola, Tessere, Gadget)',
        description:
          'Quando apri una ricevuta da un Evento, da una Tessera o da un Gadget, il sistema propone già automaticamente la voce corrispondente. Puoi sempre aggiungere, rimuovere o modificare al volo più voci nella stessa ricevuta (es. Evento + Tessera o Mensile Doposcuola), inserire uno sconto in Quota Fissa (€) o Percentuale (%) con dicitura personalizzata e scalare un Buono Spesa.',
      },
      {
        title: '2. Scheda "4. Modelli Email & Sconti": 5 Modelli Email per Gmail con Allegato PDF',
        description:
          'Nella scheda "4. Modelli Email & Sconti" puoi personalizzare i 5 modelli email precompilati (Conferma & Ricevuta Evento, Ricevuta Tessera, Ricevuta Mensile Doposcuola, Ricevuta Gadget e Riepilogo Dati Iscrizione da Firmare). Quando premi "Invia via Gmail", il sistema aggiorna automaticamente il testo con i dati del socio in questione e allega il PDF.',
        actionHint: 'Clicca sulla scheda blu "4. Modelli Email & Sconti" in questa pagina.',
      },
      {
        title: '3. Archivio Diciture Sconto / Copertura Quota Selezionabili',
        description:
          'Tutte le diciture inserite per motivare gli sconti nelle ricevute (es. "Riduzione fascia ISEE", "Quota coperta da Comune / Associazione Partner") restano salvate e possono essere gestite o aggiunte nella scheda "4. Modelli Email & Sconti".',
      },
      {
        title: '4. Scelta tra 3 Layout Grafici PDF e Overlay Timbro ASD / Firma Presidente',
        description:
          'Scegli tra "Standard Classico", "Minimalista Moderno" e "Ufficiale Istituzionale" e regola posizione, scala e rotazione del Timbro ASD e della Firma del Presidente.',
        actionHint: 'Clicca su "Scarica PDF di Prova" per verificare il risultato finale.',
      },
    ],
    proTips: [
      'Anche prima di inviare una singola email tramite Gmail puoi ritoccare liberamente l\'oggetto o il testo per quella famiglia specifica prima di premere "Conferma e Invia".',
    ],
    driveIntegrationNote:
      'Il modello ricevuta, i 5 modelli email, le diciture sconto e le immagini di Timbro e Firma sono salvati su Google Drive o nel File Locale .json su PC.',
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
    title: 'Guida alla Pagina: File Locale PC (OneDrive/Dropbox), Google Drive & Multi-Anno',
    shortSubtitle:
      'Salvataggio su File Locale PC o Google Drive (zero memoria browser), scelta anno 2026/2027 e Multi-ASD.',
    overview:
      "Da qui scegli come custodire in sicurezza i dati dell'associazione — usando un File Locale .json sul tuo PC (compatibile con cartelle OneDrive e Dropbox) oppure Google Drive in diretta — gestisci l'Anno Sportivo (2026, 2027 e futuri) con archiviazione dei flussi di cassa e personalizzi il nome e i dati dell'ASD.",
    features: [
      {
        title: '1. File Locale su PC (Compatibile con OneDrive / Dropbox) — Zero Memoria Browser',
        description:
          'I dati non vengono mai lasciati nella memoria volatile del browser. Puoi aprire/collegare un file .json sul tuo PC (anche dentro una cartella sincronizzata OneDrive o Dropbox): ogni modifica viene salvata direttamente sul file.',
        actionHint: 'Usa "Apri / Collega File .JSON da PC" o "Salva Subito su File .JSON PC" nel primo riquadro in alto.',
      },
      {
        title: '2. Connessione Google Drive Live & Alberatura "Gestionale ASD"',
        description:
          'In alternativa o in aggiunta al file su PC, puoi connettere Google Drive per salvare in diretta su "database_gestionale_asd.json" e nelle 7 sottocartelle ordinate.',
      },
      {
        title: '3. Selettore Anno (2026, 2027...) & Archiviazione Flussi con Residuo a Bilancio',
        description:
          'Scegli con un clic l\'anno attivo (es. 2026 ora e 2027 in futuro) oppure usa "Archivia Flussi e Passa al Nuovo Anno" per archiviare i movimenti mantenendo solo il residuo a bilancio come Fondo Iniziale e lasciando tutti i soci in Anagrafica.',
      },
      {
        title: '4. Nome Associazione Modificabile (ASD Apuacamp & Altre Realtà Multi-ASD)',
        description:
          'L\'app mostra il credito "Creato da ASD Apuacamp" ma permette di modificare liberamente la Denominazione ASD, Codice Fiscale, Presidente, IBAN, Timbro, Firma e Tessera Digitale per concedere il gestionale anche ad altre associazioni.',
      },
    ],
    proTips: [
      'Anche nella barra in alto (Header) trovi sempre i pulsanti rapidi "Collega File PC", "Salva PC" e "Drive Live" per salvare o cambiare file in qualsiasi momento.',
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
