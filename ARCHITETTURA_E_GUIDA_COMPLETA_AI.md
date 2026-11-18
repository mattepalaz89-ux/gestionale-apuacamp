# Documentazione Tecnica, Architetturale e Funzionale Completa — Gestionale ASD Apuacamp
**Documento di Specifica e Handoff per Modelli AI / Sviluppatori Senior**

---

## 1. Contesto di Dominio e Obiettivo del Prodotto

**Apuacamp A.S.D.** è un'Associazione Sportiva Dilettantistica (affiliata **US ACLI**, iscritta al **RUNTS / RASD**) che organizza attività di educazione in natura per bambini e ragazzi (3–14 anni): progetti annuali nel bosco (*La Selva*), campi estivi (*Summer Camp*), trekking con pernottamento in rifugio sulle Alpi Apuane, laboratori ed eventi giornalieri.

### Perché è stata progettata questa architettura
1. **Zero costi di infrastruttura server / database a pagamento**: l'associazione usa **Google Workspace / Google Drive** come proprio cloud ufficiale e **File JSON locali** come backup fisico. L'app è una Single Page Application (React 19 + TypeScript + Vite + Tailwind CSS v4) che usa **Google Drive API v3** come database primario (`database_gestionale_asd.json`), **Google Sheets API v4** per i fogli di calcolo, **Google Forms API v1** per i moduli d'iscrizione e **Gmail API v1** per l'invio diretto di ricevute, preventivi e tessere.
2. **Design UX "Progressive Disclosure" (Rivelazione Progressiva)**: per evitare l'affaticamento visivo da "muro di testo", tutte le viste mostrano a colpo d'occhio **solo i KPI numerici e righe compatte a linea singola** (Titolo, Data, Stato/Importo). I dettagli legali/operativi, i pulsanti d'azione, gli strumenti di importazione Excel/Google Form e i pianificatori di spesa ricorrente sono racchiusi in **cassetti a fisarmonica (Accordion)** apribili con un clic.
3. **Coordinamento automatico tra moduli**: in un'ASD reale, quando un bambino si iscrive a un evento o rinnova una tessera, l'operatore non deve reinserire i dati 3 volte. L'app collega in tempo reale **Eventi ↔ Anagrafica Soci ↔ Tessere US ACLI ↔ Prima Nota Cassa ↔ Scadenziario/Notifiche**.

---

## 2. Mappa Completa del Codebase (`src/`)

```text
src/
├── types.ts                              # Contratto dati globale (AppState e tutte le interfacce TypeScript)
├── App.tsx                               # Orchestratore stato, sincronizzazione Google Drive, OAuth e modali globali
├── data/
│   └── initialData.ts                    # Profilo ASD di default, fabbrica stato vuoto per nuovo anno e template
├── services/
│   └── googleWorkspace.ts                # Integrazione 1P OAuth2 (GIS) + Drive API v3 + Sheets v4 + Forms v1 + Gmail v1
├── utils/
│   ├── storage.ts                        # Persistenza multi-livello: Google Drive + File System Access API + Snapshot Locale
│   ├── finance.ts                        # Motore contabile: saldi Banca/Contanti, riparto eventi, sconti (€/%), buoni spesa
│   ├── duplicates.ts                     # Rilevamento duplicati su movimenti (stessa persona + stesso importo) mirato
│   ├── criticalDeadlines.ts              # Motore Scadenze Annuali ASD (INPS mensile, Fisco, US ACLI, Bilancio, Bandi)
│   ├── notifications.ts                  # Generatore Alert operativi, Briefing Pre-Evento e filtri Risolto/Rimandato
│   ├── recurringExpenses.ts              # Motore Spese Ricorrenti (mensili, bimestrali, trimestrali, annue, a rate o data fine)
│   ├── csvExcelImporter.ts               # Parser universale XLSX/CSV + calcolo Tessera 365 + sincronizzazione Google Forms
│   ├── accountingSpreadsheet.ts          # Generatore file Excel (.xlsx) multi-scheda (5 fogli contabili e bilancio)
│   ├── pdfReceiptTemplates.ts            # Configurazione 3 layout PDF ricevute (Standard, Minimalista, Ufficiale Fiscale)
│   ├── digitalCard.ts                    # Logica Tessera Associativa Digitale personalizzabile ed etichette assicurative
│   ├── export.ts                         # Esportazione CSV e generatori link mailto di fallback
│   └── finance.test.ts                   # Suite di 30 test unitari (node:test) che valida tutta la logica pura
└── components/
    ├── Sidebar.tsx                       # Barra laterale: Identità ASD, Selettore Anno, Box Login Google e Navigazione
    ├── DashboardView.tsx                 # Cruscotto sintetico: 4 KPI + Scadenze Compatte + Ultimi Movimenti & Tessere
    ├── CriticalDeadlinesWidget.tsx       # Scadenziario interattivo con righe espandibili, modifica date proposte e timeline
    ├── CashFlowView.tsx                  # Prima Nota / Libro Cassa, filtri, export .xlsx, allegati fatture su Drive
    ├── RecurringExpensesPanel.tsx        # Pianificatore Spese Ricorrenti (chiuso a fisarmonica di default)
    ├── DuplicateTransactionsModal.tsx    # Popup risoluzione/eliminazione movimenti duplicati
    ├── MembersView.tsx                   # Anagrafica Soci ordinabile, Rinnovi Tessera 365, Import Excel e Google Form
    ├── MembershipCardsView.tsx           # Gestione Tessere US ACLI (Base, Summer, Gold, Platinum) e invio Tessera
    ├── DigitalCardDesignerModal.tsx      # Editor visuale della Tessera Associativa Digitale (colori, campi, stampa/Gmail)
    ├── EventsView.tsx                    # Gestione Eventi, Iscritti espandibili, Sconti/Buoni, Briefing e Sync Anagrafica
    ├── StaffView.tsx                     # Collaboratori Sportivi, massimale esente € 5.000 e compensi
    ├── GadgetsView.tsx                   # Inventario Gadget e vestiario con ordini e margini
    ├── GovernanceView.tsx                # Cariche Direttivo, Assemblee, Documenti Statutari e cartelle Google Drive
    ├── GrantsView.tsx                    # Bandi e Contributi Pubblici con scadenze e allegati su Drive
    ├── NotificationsView.tsx             # Centro Scadenze & Notifiche con archivio Risolte/Rimandate e note
    ├── AnnualArchiveModal.tsx            # Archiviazione fine anno (Excel + JSON su Drive) e passaggio nuovo esercizio
    ├── ReceiptModal.tsx                  # Generatore Ricevute/Preventivi multi-voce, 3 layout PDF e invio Gmail diretto
    ├── GoogleWorkspaceModal.tsx          # Pannello avanzato sincronizzazione cartelle Drive, Fogli e Moduli Google
    ├── GoogleFormBuilderModal.tsx        # Costruttore visuale Moduli Google (campi standard + personalizzati)
    ├── TransactionDateSelector.tsx       # Selettore data operazione (Oggi vs Data effettiva bonifico/contanti)
    └── QuickGuideModal.tsx               # Manuale operativo integrato (? Guida)
```

---

## 3. Architettura dello Stato (`AppState` in `src/types.ts`)

Tutto lo stato applicativo è racchiuso in un singolo oggetto serializzabile JSON (`AppState`):

```ts
export interface AppState {
  profile: AssociationProfile;              // Dati fiscali ASD, anno attivo, configurazioni, override scadenze e risoluzioni
  transactions: CashTransaction[];          // Libro Cassa / Prima Nota (entrate e uscite)
  members: Member[];                        // Anagrafica Soci (bambini, genitori, tessera US ACLI, salute/allergie, buoni spesa)
  events: EventItem[];                      // Eventi in programma (Rifugio, Summer Camp, Selva, Giornata)
  bookings: EventBooking[];                 // Iscrizioni agli eventi (caparra, saldo, sconti € / %, buoni applicati)
  staff: StaffCollaborator[];               // Istruttori e collaboratori sportivi
  gadgets: GadgetItem[];                    // Magazzino gadget
  gadgetOrders: GadgetOrder[];              // Ordini/consegne gadget ai soci
  roles: AssociationRole[];                 // Consiglio Direttivo e scadenze certificazioni (BLSD, Casellario, Tesserini)
  assemblies: AssemblyMeeting[];            // Assemblee ordinarie e straordinarie
  documents: StatutoryDocument[];           // Statuto, Atto Costitutivo, Affiliazioni, Runts
  grants: GrantItem[];                      // Bandi pubblici e progetti di finanziamento
  recurringExpenses?: RecurringExpensePlan[]; // Piani di spesa ricorrente (mensili, annui, a tempo determinato)
  annualArchives: AnnualArchiveSnapshot[];  // Fotografie storiche degli esercizi chiusi
  initialFund: number;                      // Fondo iniziale totale dell'anno attivo
  initialFundBank: number;                  // Fondo iniziale Conto Corrente Bancario
  initialFundCash: number;                  // Fondo iniziale Cassa Contanti
  ignoredDuplicateSignatures?: string[];    // Firme dei gruppi di movimenti verificati come NON duplicati
}
```

### Perché un singolo oggetto `AppState`?
- Consente **salvataggi atomici istantanei** su Google Drive (`database_gestionale_asd.json`) e su file JSON locale sul PC.
- Garantisce che il passaggio da un anno all'altro (`AnnualArchiveSnapshot`) congeli l'intera fotografia fiscale dell'associazione in un unico file immutabile.
- Rende deterministica la comparazione tra stato locale e stato remoto tramite il conteggio dei record operativi (`countAppStateRecords(state)`).

---

## 4. Persistenza Multi-Livello e Sincronizzazione Google Drive (`storage.ts`, `googleWorkspace.ts`, `App.tsx`)

### 4.1 Struttura automatica delle Cartelle su Google Drive
Quando l'utente effettua l'accesso con Google OAuth, l'app verifica o crea automaticamente la cartella radice **`Gestionale ASD`** sul suo Google Drive, articolata in **7 sottocartelle ordinate**:
1. `01_Anagrafica_Soci_e_Tessere` (Fogli Google Soci, Moduli Google Tesseramento, Tessere PDF)
2. `02_Contabilita_e_Cassa` (Foglio Google Contabilità 5 schede, Fatture/Giustificativi allegati ai movimenti, Chiusure Annue)
3. `03_Eventi_e_Iscritti` (Fogli Iscritti e Briefing per singolo evento, Moduli Google iscrizione eventi)
4. `04_Verbali_e_Governance` (Statuto, Verbali Assemblee e Direttivo, Certificati)
5. `05_Bandi_e_Progetti` (Schede tecniche bandi, formulari e fatture di rendicontazione)
6. `06_Ricevute_e_Preventivi` (Copie delle ricevute e preventivi inviati ai genitori)
7. `07_Backup_Sistema` (**Contiene `database_gestionale_asd.json`**, il database live del gestionale)

### 4.2 Perché l'upload usa un protocollo a due passaggi (Fix critico su `uploadFileToDrive`)
L'API Google Drive v3 (`POST /upload/drive/v3/files?uploadType=multipart`) richiede rigorosamente il formato `multipart/related` (RFC 2387). L'oggetto browser `new FormData()` genera invece `multipart/form-data`, che Google Drive v3 può rifiutare o di cui può ignorare i metadati (`name` e `parents`).
Per garantire il **100% di affidabilità con qualsiasi file (JSON, PDF, XLSX, TXT)**:
1. **Se il file non esiste ancora**: viene eseguita una `POST https://www.googleapis.com/drive/v3/files` con header `Content-Type: application/json` per creare il file vuoto con `name`, `mimeType` e `parents: [folderId]` esatti.
2. **Scrittura del contenuto**: viene eseguita una `PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media` inviando direttamente il corpo raw (`Blob` o stringa UTF-8).

### 4.3 Tripla Sincronizzazione Automatica e Protezione Anti-Sovrascrittura
Per evitare qualsiasi perdita di dati tra sessioni:
1. **Snapshot locale istantaneo nel browser (`saveAppState` in `storage.ts`)**: ogni modifica aggiorna immediatamente `localStorage` (`apuacamp_working_snapshot_v4_latest`). Se l'utente ricarica la pagina prima ancora di cliccare su "Accedi con Google", o se il token OAuth scade, i dati caricati restano intatti.
2. **Sincronizzazione Real-Time Debounced (800 ms)**: ogni modifica a soci, movimenti, eventi o scadenze avvia dopo 0,8 secondi il salvataggio silenzioso su Google Drive (`saveLiveDatabaseToDrive`).
3. **Sincronizzazione Periodica Automatica ogni 90 secondi (`setInterval` in `App.tsx`)**: un timer in background verifica ogni 90 secondi se ci sono modifiche non ancora sincronizzate (`hasUnsavedChangesRef.current`) o se il file su Drive deve essere riallineato, eseguendo il backup automatico.
4. **Protezione Anti-Sovrascrittura al Login (`pullStateFromGoogleDrive`)**:
   - Quando l'utente clicca su "Accedi con Google", l'app confronta il numero di record presenti su Google Drive (`remoteCount`) con quelli presenti in memoria/locale (`localCount` tramite `countAppStateRecords(appStateRef.current)`).
   - Se su Google Drive il file non esiste ancora o è vuoto (`remoteCount === 0`) mentre in locale l'utente ha già importato soci o movimenti (`localCount > 0`), **l'app NON sovrascrive mai i dati locali con il file vuoto**, ma carica subito i dati locali su Google Drive creando `database_gestionale_asd.json`.
5. **Rilevamento Scadenza Token OAuth (HTTP 401)**: i token client-side di Google durano 60 minuti. Tutte le chiamate API intercettano lo status `401`, puliscono il token scaduto e mostrano un banner giallo in alto con il pulsante **"Riconnetti Ora"** in 1 clic, mantenendo i dati al sicuro nello snapshot locale.

---

## 5. Spiegazione Dettagliata di Tutte le Funzioni per Modulo

### 5.1 Barra Laterale (`Sidebar.tsx`) e Header (`App.tsx`)
- **Selettore Anno Attivo (`2026`, `2027`, `2028`)**: permette di impostare l'anno fiscale di lavoro o di azzerare il gestionale per partire da zero su una nuova annualità.
- **Box Login Google Integrato sotto il nome ASD**: mostra lo stato di **Google Drive** e **Gmail API**. Con un solo clic su *"Accedi con Google (Drive + Mail)"* richiede i permessi OAuth (`drive.file`, `spreadsheets`, `forms.body`, `forms.responses.readonly`, `gmail.send`) per l'account Google scelto (es. `info.apuacamp@gmail.com`).
- **Doppio Backup Fisico in Header**: pulsanti rapidi per collegare/salvare anche un file `.json` sul proprio PC tramite File System Access API.

### 5.2 Dashboard Sintetica (`DashboardView.tsx` & `CriticalDeadlinesWidget.tsx`)
Progettata per stare in **una sola schermata senza scroll infinito**:
- **4 KPI Finanziari in alto**:
  1. *Saldo Disponibile* (con spaccato Conto Corrente vs Contanti).
  2. *Entrate Anno* (con numero versamenti registrati).
  3. *Uscite Anno* (con saldo netto periodo `+`/`-`).
  4. *Da Incassare (Eventi)* + contatore *Tessere da saldare*.
- **Colonna Sinistra — Scadenziario Compatto Espandibile (`CriticalDeadlinesWidget.tsx`)**:
  - Calcola automaticamente tramite `buildCriticalYearDeadlines` (`src/utils/criticalDeadlines.ts`) tutte le scadenze critiche dell'anno solare:
    - **Mensile**: *16 del mese corrente* — Versamento F24 Ritenute e Contributi INPS Gestione Separata.
    - **31 Gennaio**: Rinnovo Affiliazione Annuale US ACLI e coperture assicurative.
    - **16 Marzo**: Certificazione Unica (CU) collaboratori sportivi.
    - **30 Aprile**: Assemblea Ordinaria dei Soci per Approvazione Bilancio / Rendiconto Economico-Finanziario (e deposito RUNTS/RASD entro 30 gg).
    - **30 Settembre**: Adempimenti Fiscali Agenzia delle Entrate post-pausa estiva.
    - **31 Dicembre**: Verifica Rinnovo Tesserini Tecnici Istruttori e Certificati BLSD.
    - **Dinamiche**: tutte le scadenze di Presentazione e Rendicontazione dei **Bandi** attivi + **Scadenze Manuali** create dall'utente.
  - **Perché le scadenze proposte sono modificabili (`deadlineOverrides`)**: se l'ASD decide che l'Assemblea Annuale dei Soci o un'altra scadenza statutaria si terrà in una data diversa da quella standard, cliccando sulla riga si apre il cassetto con il pulsante **"Modifica / Cambia Data"** (o il cestino per nasconderla), salvando la nuova data nel profilo dell'associazione e aggiornando anche la scheda Assemblea in Governance.
  - Include anche **"Segna Completata ✓"**, **"Nota / Risolto"** e **"Rimanda"**, oltre al cassetto opzionale *Timeline Anno* con simulatore temporale.
- **Colonna Destra — Ultimi Movimenti & Riepilogo Tessere**:
  - Mostra le ultime 6 transazioni di cassa e il contatore delle 4 tipologie di tessera (*Base, Summer, Gold, Platinum*).

### 5.3 Contabilità & Libro Cassa (`CashFlowView.tsx`, `finance.ts`, `duplicates.ts`, `recurringExpenses.ts`)
- **Calcolo Saldi (`calculateCashTotals` in `finance.ts`)**:
  - Distingue automaticamente i movimenti per canale:
    - **Banca (`currentBank`)**: `initialFundBank` + entrate/uscite con metodo `Bonifico`, `POS`, `Bancomat`, `Paypal`, `Pagam Online`.
    - **Contanti (`currentCash`)**: `initialFundCash` + entrate/uscite con metodo `Contanti`.
- **Scelta Data Operazione (`TransactionDateSelector.tsx`)**:
  - Ogni volta che si registra un movimento (manualmente, da nuova tessera o da iscrizione evento), l'utente può scegliere tra **Data Odierna** o **Data Specifica** (es. la data reale del bonifico bancario).
- **Motore Spese Ricorrenti (`RecurringExpensesPanel.tsx` & `recurringExpenses.ts`)**:
  - Chiuso a fisarmonica di default per non occupare spazio.
  - Supporta frequenze `mensile`, `bimestrale`, `trimestrale`, `semestrale`, `annuale` e 3 modalità di durata:
    1. `numero_rate` (es. *Compenso Commercialista per 6 mesi*: genera esattamente 6 rate).
    2. `fino_a_data` (es. *Utenze o Affitto sede fino al 31/08/2027*).
    3. `indeterminata` (spesa fissa continua per tutto l'anno solare).
  - Riconosce automaticamente quali rate sono già state registrate nel Libro Cassa (tramite `recurringPlanId` o corrispondenza di titolo/importo/mese) e permette di contabilizzare le rate mancanti con 1 clic.
- **Motore di Rilevamento Duplicati Intelligente (`src/utils/duplicates.ts`)**:
  - **Regola di business**: due movimenti sono sospetti duplicati **solo** se hanno lo **stesso tipo** (entrata/uscita), lo **stesso importo al centesimo**, avvengono entro **7 giorni** (o stesso giorno in modalità `same_day`), e **sono entrambi ricondotti con certezza a una persona reale** (Socio in anagrafica, Collaboratore, o pattern esplicito `"Quota ... - Nome Cognome"`). I movimenti generici (es. 60 versamenti da € 15 con causale generica `"Quota associativa"`) **non vengono mai segnalati come duplicati** per evitare falsi positivi.
  - **Quando viene eseguito (`detectDuplicatesForNewTransactions`)**:
    - **NON parte mai all'apertura dell'app o al login**.
    - Parte **una sola volta** quando l'utente importa un file Excel/CSV di movimenti (`handleImportTransactions`).
    - Parte **ogni volta che l'utente aggiunge un movimento nuovo** (`handleAddTransaction`), testando **esclusivamente il singolo movimento appena inserito** contro lo storico.
    - Quando l'utente chiude il popup o clicca *"Ignora"*, la firma (`signature`) viene salvata in `ignoredDuplicateSignatures` così da non essere mai più riproposta.
- **Esportazione Excel Contabile Multi-Scheda (`accountingSpreadsheet.ts`)**:
  - Genera un file `.xlsx` professionale o un foglio Google Sheets in `02_Contabilita_e_Cassa` con **5 fogli**:
    1. *Riepilogo & Saldi* (Fondo iniziale, Banca vs Contanti, Saldo finale).
    2. *Libro Cassa Cronologico* (con saldo progressivo riga per riga).
    3. *Rendiconto per Categoria* (Entrate, Uscite, Saldo Netto e % di incidenza per categoria).
    4. *Analisi Mensile (Gen-Dic)* (Flusso di cassa mese per mese).
    5. *Dettaglio per Metodo Pagamento* (Riconciliazione bancaria e cassa contanti).

### 5.4 Anagrafica Soci & Tessere US ACLI (`MembersView.tsx`, `MembershipCardsView.tsx`, `DigitalCardDesignerModal.tsx`)
- **Ordinamento Multi-Criterio (`sortMembersList` in `finance.ts`)**:
  - Permette di riordinare l'elenco soci (crescente `A→Z` o decrescente `Z→A`) per: *Nome Bimbo/a*, *Nome Genitore*, *Numero Tessera*, *Tipo Assicurazione*, *Data Scadenza Tessera* o *Credito Buono Spesa*.
- **Regola "Tessera 365" vs Tessera Ordinaria Solare (`isTessera365Eligible` e `calculateCardExpiryDate` in `csvExcelImporter.ts`)**:
  - **Fino al 31 Agosto**: la tessera ha validità **Anno Solare** e scade il `31/12` dell'anno di emissione.
  - **Dal 1° Settembre in poi**: il gestionale abilita automaticamente l'opzione **"Tessera 365"** (valida 12 mesi esatti dalla data di emissione, coprendo anche l'anno successivo), archiviando le vecchie tessere nello storico `cardHistory` del socio.
- **Nomi Tipologie Assicurative Personalizzabili (`digitalCard.ts`)**:
  - L'associazione può rinominare liberamente le 4 fasce (*Base, Summer, Gold, Platinum*) in `profile.customInsuranceLabels` e personalizzare colori, sottotitoli e disposizione dei campi sulla **Tessera Associativa Digitale** (`DigitalCardDesignerModal.tsx`), che può essere stampata in PDF o inviata direttamente via Gmail al genitore.
- **Notifiche Rinnovo Tessere Intelligenti (`notifications.ts`)**:
  - Come richiesto dall'operatività ASD, un socio degli anni passati con tessera scaduta **NON genera avvisi di rinnovo** finché è "dormiente". L'alert di tessera mancante o scaduta scatta **solo quando quel socio viene iscritto a un Evento/Attività dell'anno corrente**.

### 5.5 Eventi, Sconti, Buoni Spesa e Briefing Pre-Evento (`EventsView.tsx`)
- **Formula Economica e Riparto Compensi Staff (`calculateEventFinancials` in `finance.ts`)**:
  - Per gli eventi residenziali (es. *Notte in Rifugio*), calcola in tempo reale:
    - `Incasso Totale Confermati`
    - `Spese Vive (Benchmark)` (es. costo mezza pensione rifugio per partecipanti + staff)
    - `Fondo Cassa ASD` (accantonamento fisso per l'associazione, es. € 150)
    - `Utile Netto da Dividere` e `Quota a Testa per Operatore Staff`.
- **Motore Sconti Evento (€ o %) e Buoni Spesa (`calculateDiscountedEventPrice` in `finance.ts`)**:
  - Ogni evento o singola iscrizione supporta:
    - **Sconto in Quota Fissa (`fixed_euro`)** (es. `-€ 15,00 Sconto Fratelli`) oppure **Sconto Percentuale (`percentage`)** (es. `-10% Promo Early Bird`).
    - **Dicitura Sconto Salvata (`savedDiscountLabels`)**: le causali di sconto scritte dall'utente vengono memorizzate automaticamente nel profilo ASD e riproposte nei menu a tendina futuri e nelle ricevute.
    - **Buono Spesa (`voucherBalance` / `voucherApplied`)**: ogni socio può avere un credito buono in anagrafica; applicandolo a un'iscrizione evento, il buono riduce il netto da pagare e scala automaticamente il saldo buono residuo del socio.
- **Coordinamento Evento ↔ Anagrafica Soci & Tessere (`openSyncMemberModalForBooking`)**:
  - Cliccando sul badge Tessera di qualsiasi iscritto a un evento, si apre un popup precompilato che permette di creare il socio in Anagrafica (se nuovo) o rinnovarne la tessera US ACLI e registrare l'incasso in Prima Nota senza cambiare pagina.
- **Briefing Sicurezza Pre-Evento (`generatePreEventBriefings` in `notifications.ts`)**:
  - Analizza tutti gli iscritti confermati di ogni evento incrociandoli con l'Anagrafica Soci per estrarre 4 liste critiche per gli istruttori:
    1. *Tessere Assenti, Non Pagate o Scadute prima della data dell'evento*.
    2. *Allergie, Intolleranze, Farmaci salvavita e Bisogni Speciali*.
    3. *Bambini SENZA Consenso Foto/Video* (da non fotografare).
    4. *Email di conferma / Ricevute non ancora inviate*.

### 5.6 Ricevute, Preventivi & Invio Gmail Diretto (`ReceiptModal.tsx` & `pdfReceiptTemplates.ts`)
- **Costruttore Multi-Voce**: permette di combinare nella stessa ricevuta o preventivo più voci (es. *Quota Evento + Quota Tessera Assicurativa + Sconto Fratelli + Buono Spesa*).
- **3 Layout Grafici PDF (`pdfReceiptTemplates.ts`)**:
  1. `standard`: Classico completo con box causale e riepilogo fiscale.
  2. `minimalist`: Compatto su singola pagina ad alta densità.
  3. `official`: Stile ricevuta istituzionale/fiscale con riquadro bollo e dicitura esenzione Art. 148 TUIR / D.Lgs. 36/2021.
- **Invio Email Diretto tramite Gmail API (`sendGmailReceipt` in `googleWorkspace.ts`)**:
  - Costruisce un messaggio MIME RFC 2822 completo (`multipart/mixed` quando è presente l'allegato PDF della ricevuta o della tessera), codificato in Base64URL, e lo invia tramite `POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send` dall'account Google connesso (es. `info.apuacamp@gmail.com`).
  - L'oggetto e il corpo dell'email supportano variabili dinamiche (`{{genitore}}`, `{{bimbo}}`, `{{attivita}}`, `{{importo}}`, `{{associazione}}`) personalizzabili e salvabili come modello predefinito.

### 5.7 Bandi Pubblici (`GrantsView.tsx`), Governance (`GovernanceView.tsx`), Staff (`StaffView.tsx`) e Gadget (`GadgetsView.tsx`)
- **Bandi & Contributi (`GrantsView.tsx`)**: censisce i bandi con scadenza presentazione, scadenza rendicontazione, importo richiesto/concesso, caratteristiche e contatti RUP (chiusi a fisarmonica e apribili al clic) e carica i documenti direttamente nella cartella Google Drive `05_Bandi_e_Progetti`.
- **Governance & Drive (`GovernanceView.tsx`)**: gestisce Consiglio Direttivo, scadenze certificazioni istruttori (BLSD, Casellario Giudiziale, Tesserino Tecnico), verbali assemblee e archiviazione diretta dei PDF in `04_Verbali_e_Governance`.
- **Collaboratori Sportivi (`StaffView.tsx`)**: monitora i compensi erogati a ciascun istruttore rispetto alla soglia di esenzione fiscale del Lavoro Sportivo Dilettantistico (**€ 5.000,00 annui** ex D.Lgs. 36/2021), avvisando quando un collaboratore si avvicina o supera il massimale.

---

## 6. Test Automatici e Verifica (`src/utils/finance.test.ts`)

Tutta la logica di business è disaccoppiata dai componenti React ed è coperta da **30 test unitari** eseguibili con:
```bash
npx tsx --test src/utils/finance.test.ts
```
I test verificano:
1. Calcolo saldi cassa/banca, riparto compensi eventi, sconti fissi (€) e percentuali (%) e deduzione buoni spesa.
2. Regola *Tessera 365* (1° settembre) vs *Tessera Solare* (31 dicembre).
3. Parser universale Excel/CSV e risposte Google Forms (inclusi bisogni speciali e autonomie).
4. Motore Scadenze Annuali, override di date proposte, note di risoluzione e rinvio notifiche.
5. Motore Spese Ricorrenti (a numero di rate, fino a data, indeterminata).
6. Rilevamento duplicati mirato sui soli nuovi movimenti (`detectDuplicatesForNewTransactions`) e protezione contro falsi positivi su causali generiche.
