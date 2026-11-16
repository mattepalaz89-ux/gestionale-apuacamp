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
    title: 'Guida alla Pagina: Anagrafica Soci, Coordinamento Dati & Storico Pluriennale',
    shortSubtitle:
      'Libro soci pluriennale coordinato con Eventi e Tessere, importazione Google Form/Excel e Tessera Digitale.',
    overview:
      "Qui gestisci il Libro Soci completo dell'ASD: dati anagrafici del minore e del genitore, codici fiscali, allergie, bisogni speciali (BES), consensi foto/video e storico tessere. L'anagrafica è coordinata in tempo reale sia con la sezione separata 'Tessere & Coperture' sia con la pagina 'Eventi & Iscrizioni'.",
    features: [
      {
        title: '1. Soci Salvati Anno per Anno Senza Notifiche Inutili',
        description:
          "I soci restano salvati in Anagrafica di anno in anno: quando cambi anno scade solo il tesserino, e il sistema invia la notifica di rinnovo tessera SOLO se il socio si iscrive effettivamente a un evento o attività dell'anno.",
      },
      {
        title: '2. Coordinamento Automatico con Eventi e Sezione Tessere',
        description:
          "Qualsiasi modifica fatta in Anagrafica aggiorna automaticamente la sezione 'Tessere & Coperture' e le iscrizioni agli Eventi, e viceversa non devi mai reinserire due volte gli stessi dati.",
      },
      {
        title: '3. Collegamento Modulo Google (Google Form) → Anagrafica Soci',
        description:
          'Genera il Google Form personalizzato e importa con un clic le risposte compilate dai genitori direttamente in Anagrafica e nel Foglio Google Sheets.',
      },
      {
        title: '4. Tessera Digitale Personalizzabile & Registrazione Cassa con Data Scelta',
        description:
          'Genera la Tessera Digitale del socio (con sfondo/logo personalizzabili) e, quando registri l\'incasso di una tessera in Cassa, scegli se usare la Data di Oggi o una Data Diversa.',
      },
    ],
    proTips: [
      'Se vuoi lavorare esclusivamente sulle tessere, sulle scadenze US ACLI e sui rinnovi senza aprire le schede anagrafiche complete, usa la nuova voce di menu "Tessere & Coperture".',
    ],
    driveIntegrationNote:
      'Il Modulo Google e il Foglio Google "Anagrafica Soci" vengono salvati in "Gestionale ASD / 01_Anagrafica_Soci_e_Tessere".',
  },

  cards: {
    tabId: 'cards',
    title: 'Guida alla Pagina: Tessere US ACLI & Coperture Assicurative (Sezione Dedicata)',
    shortSubtitle:
      'Gestione dedicata alle sole tessere, livelli assicurativi, Formula Tessera 365 e Tessera Digitale, sincronizzata con Anagrafica ed Eventi.',
    overview:
      "Questa sezione permette di gestire, emettere e rinnovare esclusivamente le Tessere US ACLI e le coperture assicurative in modo rapido e separato dall'Anagrafica completa, mantenendo però il 100% di sincronizzazione automatica con l'Anagrafica Soci, gli Eventi e il Flusso di Cassa.",
    features: [
      {
        title: '1. Modifica o Rinnovo Rapido della Sola Tessera',
        description:
          'Cliccando su "Modifica / Rinnova Tessera" apri un popup dedicato ai soli dati di tesseramento (Numero Tessera US ACLI, Livello Assicurativo, Data Emissione, Formula Solare 31/12 o Tessera 365 e Quota pagata) che aggiorna istantaneamente anche l\'Anagrafica Soci.',
        actionHint: 'Clicca su "Modifica / Rinnova Tessera" su qualsiasi riga della tabella.',
      },
      {
        title: '2. Emissione Nuova Tessera con Creazione/Aggiornamento Automatico Socio',
        description:
          'Puoi emettere una tessera sia per un socio già presente in Anagrafica sia per un nuovo iscritto: se la persona non è ancora in Anagrafica, viene inserita automaticamente senza doppi inserimenti.',
        actionHint: 'Clicca su "Nuova Tessera / Nuovo Socio" in alto a destra.',
      },
      {
        title: '3. Scelta Data Movimento ("Data di Oggi" vs "Data Diversa") per il Flusso di Cassa',
        description:
          'Quando registri l\'incasso della quota tessera nel Flusso di Cassa, il popup ti chiede se registrare il movimento con la Data di Oggi o con una Data Diversa (reale).',
      },
      {
        title: '4. Generatore Tessera Digitale PDF/PNG & Nomi Assicurazioni Personalizzabili',
        description:
          'Genera la Tessera Digitale da inviare al socio via email/WhatsApp e personalizza liberamente i nomi dei livelli assicurativi (Base, Summer, Gold, Platinum), lo stemma ASD, lo sfondo (immagine o PDF) e la posizione dei testi.',
        actionHint: 'Clicca su "Modello Tessera Digitale & Nomi Assicurazioni" o sull\'icona Tessera Digitale.',
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
    title: 'Guida alla Pagina: Eventi, Coordinamento Anagrafica/Tessera & Briefing',
    shortSubtitle:
      'Iscrizioni evento coordinate in automatico con Anagrafica e Tessere, scelta data movimenti cassa e briefing pre-evento.',
    overview:
      "Permette di gestire gli eventi dell'ASD (Campi Estivi, Rifugi, Wild Camp, La Selva, Giornate) con coordinamento automatico totale verso Anagrafica Soci, Tessere e Flusso di Cassa.",
    features: [
      {
        title: '1. Popup "Inserisci / Modifica Anagrafica & Tessera" Direttamente dall\'Evento',
        description:
          'Se un iscritto a un evento non ha la tessera (o non è ancora in Anagrafica), cliccando sul bottone della sua tessera nella tabella iscritti o su "Inserisci Tessera / Anagrafica" nel Briefing Pre-Evento si apre un popup che mostra i dati attuali e permette di inserirli o modificarli direttamente in Anagrafica e Tessere.',
        actionHint: 'Clicca sul pulsante tessera nella colonna "Tessera & Coordinamento Anagrafica" o nel Briefing Pre-Evento.',
      },
      {
        title: '2. Inserimento Automatico in Anagrafica dalla Nuova Iscrizione Evento',
        description:
          'Quando iscrivi un nuovo partecipante a un evento (o importi da Excel/Google Form), se non è ancora presente in Anagrafica Soci viene inserito e collegato automaticamente.',
      },
      {
        title: '3. Scelta "Data di Oggi" o "Data Diversa" per Caparre e Saldi in Cassa',
        description:
          'Quando registri il pagamento di una caparra o di un saldo (sia in fase di iscrizione sia cliccando sui badge Caparra/Saldo in tabella), scegli sempre se registrare l\'entrata nel Flusso di Cassa con la Data di Oggi o con una Data Diversa (reale).',
      },
      {
        title: '4. Briefing Operativo Pre-Evento & Pulsanti Compatti con Tooltip',
        description:
          'Controlla subito tessere mancanti/scadute, allergie, bisogni speciali e consensi foto. I pulsanti secondari della barra strumenti sono ridotti a icone intuitive con descrizione al passaggio del mouse.',
      },
    ],
    proTips: [
      'Non appena un socio di un anno precedente viene iscritto a un evento, se la sua tessera è scaduta il gestionale attiva automaticamente l\'avviso di rinnovo tessera.',
    ],
    driveIntegrationNote:
      'I Moduli Google e gli elenchi iscritti vengono archiviati in "Gestionale ASD / 03_Eventi_e_Iscritti".',
  },

  gadgets: {
    tabId: 'gadgets',
    title: 'Guida alla Pagina: Gadget, Merchandising & Prenotazioni',
    shortSubtitle:
      'Catalogo materiale associativo, prenotazioni taglie, scelta data movimento in cassa e alert email.',
    overview:
      "Gestisce il catalogo dei gadget associativi e le prenotazioni dei soci, permettendo di registrare l'incasso nel Flusso di Cassa scegliendo tra Data di Oggi e Data Diversa.",
    features: [
      {
        title: '1. Catalogo Articoli, Taglie e Giacenze Magazzino',
        description:
          'Aggiungi nuovi articoli specificando categoria, prezzo unitario, varianti/taglie disponibili e quantità a magazzino.',
        actionHint: 'Clicca su "Aggiungi Articolo a Catalogo".',
      },
      {
        title: '2. Prenotazioni con Scelta Data Movimento ("Data di Oggi" o "Data Diversa")',
        description:
          'Quando registri una prenotazione già pagata, il sistema ti permette di scegliere se contabilizzare l\'entrata nel Flusso di Cassa con la data odierna o con la data effettiva del pagamento.',
        actionHint: 'Clicca su "Nuova Prenotazione Gadget" e seleziona "Già Pagato".',
      },
      {
        title: '3. Controllo Consegne ed Email di Conferma Prenotazione',
        description:
          'Con un clic segni se il gadget è stato pagato, se è stato consegnato e se è stata inviata l\'email di conferma al genitore.',
      },
    ],
    proTips: [
      'Le prenotazioni gadget per cui non è ancora stata inviata l\'email di conferma vengono segnalate automaticamente tra gli Alert Email.',
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
    title: 'Guida alla Pagina: Configurazione Ricevute, 3 Layout PDF & Overlay Timbro/Firma',
    shortSubtitle:
      'Scelta tra 3 template grafici PDF (Standard, Minimalista, Ufficiale), testi dinamici e Timbro/Firma.',
    overview:
      'Questo pannello ti permette di scegliere il layout grafico delle Ricevute PDF (Standard Classico, Minimalista Moderno o Ufficiale Istituzionale con Bordo), personalizzare i testi con variabili automatiche e posizionare Timbro ASD e Firma del Presidente.',
    features: [
      {
        title: '1. Scelta tra 3 Template Grafici PDF (Standard, Minimalista, Ufficiale)',
        description:
          'Scegli lo stile grafico del documento PDF finale tra "Standard Classico", "Minimalista Moderno" e "Ufficiale Istituzionale" con anteprima A4 immediata.',
      },
      {
        title: '2. Caricamento File Timbro dell\'ASD e Firma del Presidente (Base64)',
        description:
          'Carica dal computer i file immagine (PNG/JPG) del Timbro dell\'ASD e della Firma del Presidente (oppure disegnali/generali digitalmente).',
      },
      {
        title: '3. Modifica Testi Predefiniti con Variabili Dinamiche {{...}} & Campi Extra',
        description:
          'Personalizza titoli, formula di quietanza e clausole fiscali (Art. 148 TUIR, Esenzione Bollo ASD, Detrazione 19%) con variabili automatiche come {{socio}}, {{genitore}}, {{cf_socio}}, {{importo}}.',
      },
      {
        title: '4. Regolazione Millimetrica Overlay PDF e Anteprima A4 in Tempo Reale',
        description:
          'Regola con gli slider Dimensione (%), Rotazione (°), Opacità e spostamento X/Y del Timbro e della Firma vedendo l\'effetto in diretta sul foglio A4.',
        actionHint: 'Clicca su "Scarica PDF di Prova" per testare subito il documento generato.',
      },
    ],
    proTips: [
      'Una volta configurato il modello, tutte le ricevute emesse da Anagrafica Soci, Tessere, Eventi e Flusso di Cassa useranno automaticamente questo layout.',
    ],
    driveIntegrationNote:
      'Il modello ricevuta e le immagini di Timbro e Firma sono salvati dentro il database su Google Drive o nel File Locale .json su PC.',
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
