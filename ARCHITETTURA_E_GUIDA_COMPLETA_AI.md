# Documentazione Tecnica, Architetturale e Funzionale Completa — Gestionale Associazioni Apuacamp
**Documento di Specifica Tecnica e Handoff per Sviluppatori Senior e Modelli AI**  
*Creato da Matteo Palazzi — Gestionale Associazioni Apuacamp (ASD Apuacamp) — Licenza Open-Source AGPL-3.0 / EUPL-1.2*

---

## 1. Contesto di Dominio e Obiettivo del Prodotto

**Gestionale Associazioni Apuacamp** è una web-app gestionale multi-associazione nata per **ASD Apuacamp** e generalizzata per qualsiasi **Associazione Sportiva Dilettantistica (ASD)**, **Associazione di Promozione Sociale (APS)** o **Ente del Terzo Settore (ETS)** (affiliata **US ACLI**, **CSEN**, **UISP**, **AICS**, **ASI**, **OPES**, **CSI**, Federazione Sportiva o autonoma, sia con soci minori sia con soci adulti).

### Principi Architetturali Fondamentali
1. **Zero costi di infrastruttura server / database terzi e piena sovranità dei dati (Privacy by Design)**:
   - L'app è una Single Page Application client-side (**React 19 + TypeScript strict + Vite 8 + Tailwind CSS v4**) che utilizza **Google Drive API v3** (con scope ristretto `drive.file`) come database cloud dell'associazione (`database_gestionale_asd.json`), **Google Sheets API v4** per l'esportazione/importazione di fogli di calcolo, **Google Forms API v1** per i moduli d'iscrizione, **Gmail API v1** (`gmail.send`) per l'invio diretto di ricevute/tessere PDF, **IndexedDB per account** come snapshot locale anti-perdita dati e **File System Access API** per lavorare su file `.json` locali (PC / OneDrive / Dropbox).
   - Nessun server esterno riceve o conserva i dati dei soci o della contabilità: tutto resta esclusivamente nel Google Drive dell'account collegato e/o nel file `.json` locale.
2. **Design UX "Progressive Disclosure" (Rivelazione Progressiva)**:
   - Ogni vista mostra a colpo d'occhio i KPI numerici e righe compatte; i moduli di importazione (Excel / Google Form), lo storico ricevute, i pianificatori di spese ricorrenti e le impostazioni avanzate sono racchiusi in cassetti espandibili o modali dedicati caricati in lazy-loading (`React.lazy` + `Suspense`).
3. **Collegamenti Strutturati per ID Univoco**:
   - Tutte le entità sono generate con ID crittografici univoci (`newId(prefix)` basato su `crypto.randomUUID()`) e collegate tramite chiavi esplicite (`memberId`, `bookingId`, `staffId`, `gadgetOrderId`, `receiptId`, `staffPaymentKind`), mantenendo un fallback controllato sul nome solo per i record storici.

---

## 2. Mappa Completa e Reale del Codebase (`src/`)

```text
src/
├── main.tsx                                # Entry point React con <StrictMode>
├── App.tsx                                 # Orchestratore stato, sincronizzazione Drive, conflitti, Undo/Redo, routing /privacy e /termini
├── firebase.ts                             # Inizializzazione Firebase Auth (GoogleAuthProvider) per il flusso OAuth client-side
├── types/
│   └── index.ts                            # Contratto tipi TypeScript (Member, CashTransaction, IssuedReceipt, AssociationProfile, ecc.)
├── data/
│   └── initialData.ts                      # Profilo iniziale neutro (senza dati personali hardcoded) e factory stato vuoto
├── services/
│   └── googleWorkspace.ts                  # Client Google API (googleFetch con timeout/retry, Drive v3, Sheets v4, Forms v1, Gmail v1)
├── utils/
│   ├── storage.ts                          # Definizione AppState, idratazione, archiviazione annuale, serializzazione compatta/indentata
│   ├── migrations.ts                       # Versionamento schema (CURRENT_SCHEMA_VERSION = 2), migrateState idempotente e tassonomie default
│   ├── localDb.ts                          # Persistenza locale su IndexedDB isolata per account (snapshot:<email>) + pulizia al logout
│   ├── localFileStorage.ts                 # Lettura/scrittura diretta su File Locale PC (.json) tramite File System Access API
│   ├── syncOrder.ts                        # Algoritmo puro di controllo concorrenza ottimistico (decideSyncAction)
│   ├── saveQueue.ts                        # Coda serializzata e debounced (createSaveQueue) con flush su visibilitychange/beforeunload
│   ├── ids.ts                              # Generatore ID univoci crittografici newId(prefix) (crypto.randomUUID)
│   ├── dates.ts                            # Gestione date in fuso orario locale (todayIso, parseFlexibleDateToIso, compareIsoDates)
│   ├── sanitize.ts                         # Protezione Formula Injection CSV/Excel, sanitizzazione header email MIME, anonimizzazione dati medici
│   ├── receipts.ts                         # Motore Registro Ricevute (issueProgressiveReceipt, cancelIssuedReceipt, evaluateReceipt730Compliance)
│   ├── staffThresholds.ts                  # Calcolo compensi collaboratori sportivi per staffId e soglie D.Lgs. 36/2021 (5.000 € INPS / 15.000 € IRPEF)
│   ├── memberMatching.ts                   # Matching deterministico soci (1° Codice Fiscale, 2° Nome + Data di nascita, 3° segnalazione omonimi)
│   ├── finance.ts                          # Saldi C/C Bancario, PayPal e Contanti, metodi di pagamento personalizzabili, riparto eventi, sconti
│   ├── duplicates.ts                       # Rilevamento duplicati mirato sui nuovi movimenti (stessa persona + stesso importo entro 7 gg)
│   ├── notifications.ts                    # Scadenzario annuale (Comunicazione INPS & RASD fine mese, Rendiconto, CU, Affiliazione, Bandi, Briefing)
│   ├── recurringExpenses.ts                # Motore Spese Ricorrenti (mensili, bimestrali, trimestrali, semestrali, annue)
│   ├── csvExcelImporter.ts                 # Import/Export XLSX (dynamic import) e CSV, calcolo Tessera 365, parsing risposte Google Form
│   ├── formAndReceiptTemplates.ts          # Rendering Canvas/PDF ricevute (3 layout), quietanze staff, modulo consenso GDPR, compressione immagini
│   ├── digitalCard.ts                      # Generatore Tessera Associativa Digitale PDF/PNG e risoluzione etichette tipologie tessera
│   ├── export.ts                           # Esportazione Excel multi-scheda (.xlsx), archivi annuali, registro ricevute e CSV
│   ├── pageGuides.ts                       # Contenuti della guida contestuale (? Guida) per ciascuna delle 12 sezioni
│   ├── finance.test.ts                     # Test unitari contabilità, sconti, buoni, Tessera 365, duplicati e scadenze
│   ├── sync.test.ts                        # Test unitari decideSyncAction e createSaveQueue
│   ├── migrations.test.ts                  # Test unitari migrazione v1 -> v2, idempotenza, tassonomie default e Member.isMinor
│   ├── receipts.test.ts                    # Test unitari numerazione progressiva ricevute, annullamento e conformità 730
│   ├── staff.test.ts                       # Test unitari compensi staff (esclusione rimborsi, omonimi, soglie 4k/5k/15k, PayPal separato)
│   ├── sanitize.test.ts                    # Test unitari anti-formula injection CSV/Excel, header email, extractGoogleSpreadsheetId, anonimizzazione
│   └── dates.test.ts                       # Test unitari fuso orario locale (todayIso a cavallo della mezzanotte) e normalizzazione date
└── components/
    ├── Sidebar.tsx                         # Barra laterale: Identità ASD, Selettore Anno, Box Google Drive/Gmail, link /privacy, /termini e Wizard
    ├── Header.tsx                          # Barra superiore: Ricerca, Azioni Rapide, Undo/Redo, Stato Sync Drive/File PC, tasto ? Guida
    ├── PageGuideBanner.tsx                 # Banner guida contestuale espandibile e manuale operativo completo
    ├── DashboardView.tsx                   # Cruscotto sintetico: KPI liquidità (C/C, PayPal, Contanti), Scadenze Focus, Ultimi Movimenti
    ├── CashFlowView.tsx                    # Libro Cassa / Prima Nota, Undo/Redo, Spese Ricorrenti, Export Excel, Allegati Drive
    ├── DuplicateTransactionsModal.tsx      # Finestra verifica ed eliminazione movimenti sospetti duplicati
    ├── SyncConflictModal.tsx               # Risoluzione conflitti di sincronizzazione Local vs Remote e selezione candidato DB Drive
    ├── TransactionDateSelector.tsx         # Selettore data operazione ("Data di Oggi" vs "Data Diversa / Reale")
    ├── MembersView.tsx                     # Anagrafica Soci (Minori e Adulti), Rinnovi Tessera 365, Buoni Spesa, Import Excel e Google Form
    ├── MemberDataConsentModal.tsx          # Modulo Riepilogo Dati & Consensi GDPR da firmare (PDF A4 + invio Gmail)
    ├── CardsView.tsx                       # Gestione dedicata Tessere & Coperture assicurative
    ├── DigitalMemberCardModal.tsx          # Editor visuale e generatore Tessera Associativa Digitale (PDF/PNG/Gmail)
    ├── EventsView.tsx                      # Gestione Eventi, Iscritti, Sconti (€/%), Buoni Spesa, Briefing Pre-Evento e Sync Socio/Tessera
    ├── StaffView.tsx                       # Collaboratori Sportivi, soglie D.Lgs. 36/2021 (5k INPS / 15k IRPEF + compensi altre ASD), Quietanze PDF
    ├── GadgetsView.tsx                     # Catalogo Gadget e vestiario, prenotazioni taglie e ricevute
    ├── GovernanceView.tsx                  # Cariche Direttivo, Safeguarding, RSPP, Assemblee e Verbali su Google Drive
    ├── GrantsView.tsx                      # Bandi e Contributi Pubblici con doppia scadenza e allegati su Drive
    ├── NotificationsView.tsx               # Centro Scadenze & Notifiche con inserimento scadenze manuali e stato Risolto/Rimandato
    ├── ReceiptConfigView.tsx               # Personalizzazione Modelli Ricevute/Email + Registro Ufficiale Ricevute Emesse/Annullate
    ├── ReceiptModal.tsx                    # Compositore Ricevute/Preventivi multi-voce, controllo 730, emissione progressiva e invio Gmail
    ├── GoogleFormBuilderModal.tsx          # Costruttore Moduli Google personalizzati (Tesseramento, Eventi, Gadget)
    ├── GoogleSignInButton.tsx              # Pulsante connessione/disconnessione account Google
    ├── OnboardingWizardModal.tsx           # Procedura guidata in 4 passi per configurare qualsiasi ASD/APS (Dati, Ente, Tessere, Categorie)
    └── LegalPagesModal.tsx                 # Pagine informative pubbliche /privacy e /termini (accessibili senza login e come modale)
```

---

## 3. Architettura dello Stato (`AppState` in `src/utils/storage.ts`) e Migrazioni (`src/utils/migrations.ts`)

### 3.1 Struttura di `AppState`
Lo stato applicativo è definito in `src/utils/storage.ts`:

```ts
export interface AppState {
  schemaVersion: number;                    // Versione dello schema dati (CURRENT_SCHEMA_VERSION = 2)
  version: number;                          // Contatore monotono incrementato a ogni modifica dei dati di business
  updatedAt?: string;                       // Timestamp ISO dell'ultima modifica
  updatedBy?: string;                       // Email dell'account che ha effettuato l'ultima modifica
  initialFund: number;                      // Fondo iniziale totale dell'anno attivo (Banca + Contanti)
  initialFundBank: number;                  // Fondo iniziale Conto Corrente Bancario
  initialFundCash: number;                  // Fondo iniziale Cassa Contanti
  transactions: CashTransaction[];          // Movimenti Libro Cassa (collegati tramite memberId, bookingId, staffId, gadgetOrderId, receiptId)
  members: Member[];                        // Anagrafica Soci (isMinor: boolean, tessera, salute/allergie, buoni spesa)
  events: EventItem[];                      // Eventi e attività dell'anno attivo
  bookings: EventBooking[];                 // Iscrizioni agli eventi (collegate a memberId)
  staff: StaffMember[];                     // Collaboratori sportivi (con otherAssociationsIncome e payments collegati)
  gadgets: GadgetItem[];                    // Catalogo gadget associativi
  gadgetOrders: GadgetOrder[];              // Prenotazioni gadget
  roles: AssociationRole[];                 // Cariche sociali, Safeguarding, Sicurezza (RSPP)
  assemblies: AssemblyMeeting[];            // Assemblee ordinarie e straordinarie
  grants: GrantItem[];                      // Bandi e progetti di finanziamento
  recurringExpenses: RecurringExpensePlan[];// Piani di spesa ricorrente
  receipts: IssuedReceipt[];                // Registro immutabile delle ricevute emesse/annullate
  archivedYears: ArchivedFiscalYear[];      // Riepiloghi delle annualità archiviate (con driveFileId per i dettagli completi su Drive)
  profile: AssociationProfile;              // Dati istituzionali, associationId, nextReceiptProgressive, tassonomie, metodi pagamento, ignoredDuplicateSignatures
}
```

### 3.2 Versionamento dello Schema e Tabella delle Migrazioni (`migrateState`)
Ogni file JSON salvato su Google Drive, su File Locale PC o in IndexedDB passa attraverso `migrateState(raw, fallbackYear)` in `src/utils/migrations.ts`:

| `schemaVersion` | Descrizione e Trasformazioni Applicate (`migrateState`) |
|---|---|
| **v1 (Legacy / senza `schemaVersion`)** | Stato originario privo di `schemaVersion`, con date in formato misto (`DD/MM/YYYY` o `YYYY-MM-DD`), privo di registro `receipts` e privo di tassonomie esplicite nel profilo. |
| **v2 (`CURRENT_SCHEMA_VERSION = 2`)** | 1. Normalizza tutte le date leggibili in formato ISO `YYYY-MM-DD` (conservando intatte le stringhe non interpretabili per non perdere mai dati storici).<br>2. Inizializza `version` (>= 1), `receipts: []` e `profile.nextReceiptProgressive: {}`.<br>3. Calcola `profile.associationId` tramite `deriveAssociationId(profile)`.<br>4. Popola nel profilo le tassonomie predefinite se assenti (`cardTypes`, `ageGroups`, `cashCategories`, `eventCategories`, `deadlineTemplates`, `deadlinePreset`) e imposta `isMinor: m.isMinor ?? true` su ogni socio.<br>5. Rimuove eventuale `backgroundRawPdfDataUrl` ridondante dalla configurazione della tessera digitale per mantenere leggero il JSON. |

La funzione `migrateState` è **idempotente**: `migrateState(migrateState(raw)) === migrateState(raw)`.

---

## 4. Sincronizzazione Sicura con Google Drive, Conflitti e Backup Automatici

### 4.1 Autenticazione Firebase Auth + Permessi OAuth Ristretti (`drive.file`)
L'autenticazione avviene client-side tramite **Firebase Authentication** (`signInWithPopup` con `GoogleAuthProvider` in `src/firebase.ts` e `src/services/googleWorkspace.ts`) richiedendo esclusivamente i seguenti scope:
- `https://www.googleapis.com/auth/drive.file` (accesso **ai soli file e cartelle creati dall'app**, senza accesso agli altri file personali del Drive dell'utente)
- `https://www.googleapis.com/auth/spreadsheets`
- `https://www.googleapis.com/auth/forms.body`
- `https://www.googleapis.com/auth/forms.responses.readonly`
- `https://www.googleapis.com/auth/gmail.send`

Tutte le chiamate HTTP verso le API Google passano per l'helper centralizzato **`googleFetch`** (`src/services/googleWorkspace.ts`), dotato di:
- Timeout automatico (`AbortController` a 20 secondi).
- Retry con backoff esponenziale (`500 ms`, `1500 ms`, `3500 ms`) sugli errori transitori (`429`, `500`, `502`, `503`, `504`) e sugli errori di rete.
- Intercettazione immediata di `HTTP 401` con pulizia del token scaduto ed emissione dell'evento `AUTH_REQUIRED` che mostra il banner **"Riconnetti Google Drive Ora"**.

### 4.2 Struttura Reale delle Cartelle su Google Drive e Creazione Senza Duplicati
La creazione dell'alberatura `Gestionale ASD` su Google Drive è protetta da un mutex in-process (`ensureStructureInFlightPromise`) e dal salvataggio degli ID cartella in `profile.driveRootFolderId` / `profile.driveSubfolderIds`. Le **7 sottocartelle ufficiali** sono:
1. `01_Anagrafica_Soci_e_Tessere`
2. `02_Contabilita_e_Cassa`
3. `03_Eventi_e_Iscritti`
4. `04_Verbali_Assemblee_e_Governance`
5. `05_Bandi_e_Progetti`
6. `06_Archivio_Annualita_Storiche` (contiene anche i file separati `archivio_<anno>.json`)
7. `07_Backup_Sistema` (contiene il database attivo `database_gestionale_asd.json` e i backup automatici)

### 4.3 Identificazione Univoca del Database (`appProperties`) e Controllo di Concorrenza (`decideSyncAction`)
- Il file `database_gestionale_asd.json` viene scritto con metadati Google Drive `appProperties: { app: 'gestionale-asd', role: 'main-db', associationId }`.
- La ricerca su Drive filtra per `appProperties`, così file JSON omonimi in altre cartelle non vengono mai confusi con il database dell'associazione. Se esistono più candidati validi, viene mostrato il selettore esplicito in `SyncConflictModal`.
- Al login o alla sincronizzazione, la funzione pura **`decideSyncAction(localState, remoteState, lastSyncedVersion)`** (`src/utils/syncOrder.ts`) confronta `local.version`, `remote.version` e `lastSyncedVersion` (memorizzato in IndexedDB per quello specifico account):
  - `'use-remote'`: il file su Drive è più recente e in locale non ci sono modifiche non sincronizzate.
  - `'push-local'`: lo stato locale ha una versione superiore rispetto a Drive (e `remote.version === lastSyncedVersion`).
  - `'noop'`: versione e `updatedAt` coincidono.
  - `'conflict'`: sia il locale sia il remoto sono avanzati indipendentemente rispetto a `lastSyncedVersion`. L'autosave viene messo in pausa e si apre **`SyncConflictModal.tsx`**, mostrando data/ora, autore e conteggio record di entrambe le versioni. Prima di applicare la scelta dell'utente, la versione scartata viene salvata automaticamente su Drive come backup `pre-overwrite`.

### 4.4 Coda di Salvataggio Serializzata (`SaveQueue`) e Isolamento Multi-Account in IndexedDB
- **`createSaveQueue`** (`src/utils/saveQueue.ts`): debounce di `2000 ms`, una sola richiesta di upload in volo alla volta (se arrivano nuove modifiche durante un upload, viene accodata un'unica scrittura finale con l'ultimo stato) e `flush()` immediato su `visibilitychange` (`hidden`) e `beforeunload`.
- **Isolamento per account in IndexedDB (`src/utils/localDb.ts`)**: gli snapshot locali sono salvati nella tabella IndexedDB con chiave `snapshot:<email>` (o `snapshot:local` prima del login). La vecchia chiave condivisa `localStorage` (`apuacamp_working_snapshot_v4_latest`) viene migrata e rimossa automaticamente all'avvio per impedire qualsiasi fuga di dati tra account diversi sullo stesso browser.
- **Coordinamento Multi-Tab**: `navigator.locks.request('gestionale-asd-drive-sync', ...)` evita scritture concorrenti tra più schede aperte sullo stesso browser.

### 4.5 Backup Automatici su Google Drive e Archivi Annuali Ibridi
- **Rotazione Backup Automatici (`createDriveBackupSnapshot`)**:
  - Salva snapshot JSON nella cartella `07_Backup_Sistema` con nome `backup_<YYYY-MM-DDTHH-mm-ss>_<motivo>.json` (`daily` una volta al giorno al primo salvataggio, `pre-overwrite`, `pre-import`, `pre-archive`, `pre-reset`, `manual`).
  - Mantiene automaticamente gli ultimi **30 backup** più **1 backup per ciascun mese** degli ultimi 12 mesi, eliminando i più vecchi solo dopo che il nuovo upload è andato a buon fine.
  - Dalla sezione *Backup & Drive* l'utente può consultare l'elenco dei punti di ripristino su Drive e ripristinarne uno con 1 clic.
- **Archivi Annuali Ibridi (`saveArchivedYearFileToDrive` / `loadArchivedYearFileFromDrive`)**:
  - Alla chiusura dell'anno fiscale, l'archivio completo (`transactions`, `members`, `events`, `bookings`, `grants`) viene salvato sia in locale sia in un file dedicato `archivio_<anno>.json` nella cartella Drive `06_Archivio_Annualita_Storiche`, memorizzando `driveFileId` nel riepilogo `ArchivedFiscalYear` per mantenere leggero e veloce il database principale anche dopo 10+ anni di attività.

---

## 5. Regole Contabili, Fiscali e Funzionali Implementate

### 5.1 Registro Ufficiale delle Ricevute (`src/utils/receipts.ts`, `ReceiptModal.tsx`, `ReceiptConfigView.tsx`)
- Ogni ricevuta emessa viene registrata in `appState.receipts` (`IssuedReceipt`) con numero progressivo annuale nel formato **`<ANNO>/R-<NNN>`** (es. `2027/R-001`) gestito da `profile.nextReceiptProgressive[year]`.
- **Separazione Anteprima vs Emissione**: l'apertura di `ReceiptModal` o la generazione di un preventivo non consuma alcun numero progressivo (`Verrà assegnato all'emissione: 2027/R-XXX`). Il contatore avanza **solo** quando l'operatore clicca su **"Emetti Ricevuta (PDF)"** o **"Emetti e Invia via Gmail"**.
- **Ristampa ed Annullamento**: se per un movimento/iscrizione esiste già una ricevuta attiva, il modale la riapre con lo stesso numero senza crearne un duplicato. Nella scheda **Registro Ricevute Emesse** (`ReceiptConfigView.tsx`) è possibile ristampare il PDF, reinviarlo via Gmail, esportare il registro in Excel o **annullare** una ricevuta con motivazione obbligatoria (la ricevuta resta in archivio come `annullata` senza lasciare buchi nella numerazione).
- **Controlli Non Bloccanti Detrazione Fiscale 730 (Art. 15 c. 1 lett. i-quinquies TUIR)**: `evaluateReceipt730Compliance` mostra avvisi gialli informativi (mai bloccanti) se il metodo di pagamento è in `Contanti` (non tracciabile ai fini della detrazione 19%), se manca il Codice Fiscale del pagatore o i dati del ragazzo (5–18 anni), o se l'importo supera € 77,47 ricordando l'imposta di bollo da € 2,00 (con esenzione CONI/RASD per ASD/SSD ex art. 27-bis Tabella Allegato B DPR 642/72).
- **Firma Grafica Etichettata**: quando sulle ricevute o quietanze viene applicata l'immagine della firma del Presidente, viene stampata la dicitura *"Firma grafica del legale rappresentante su documento informatico"* per piena trasparenza giuridica.

### 5.2 Collaboratori Sportivi e Soglie D.Lgs. 36/2021 (`src/utils/staffThresholds.ts`, `StaffView.tsx`)
- Ogni pagamento staff nel Libro Cassa registra `staffId` e `staffPaymentKind: 'compenso' | 'rimborso'`.
- **Esclusione Rimborsi Spese**: i rimborsi spese documentati (`staffPaymentKind === 'rimborso'`) sono esclusi dal calcolo del massimale fiscale/contributivo.
- **Compensi Presso Altre ASD/SSD (`otherAssociationsIncome`)**: poiché le soglie del D.Lgs. 36/2021 sono calcolate sul singolo lavoratore sportivo (cumulando tutti i committenti nell'anno solare), nella scheda di ogni collaboratore è possibile inserire l'importo percepito presso altre associazioni.
- **3 Livelli di Soglia e Avvisi Automatici**:
  1. **Superamento € 4.000,00 (80% della soglia INPS)**: pre-avviso giallo di attenzione.
  2. **Superamento € 5.000,00 (Soglia Contributiva INPS)**: avviso ambra per gli adempimenti contributivi INPS Gestione Separata (24% o 25%, con base imponibile ridotta del 50% fino al 31/12/2027) e comunicazione RASD/Uniemens.
  3. **Superamento € 15.000,00 (Soglia Fiscale IRPEF)**: avviso rosso critico per l'applicazione delle ritenute fiscali IRPEF sulla parte eccedente i 15.000 €.

### 5.3 Saldi Separati: Conto Corrente Bancario, PayPal, Contanti e Conti Personalizzati (`src/utils/finance.ts`)
- **`calculateCashTotals`** mantiene **PayPal separato dal Conto Corrente Bancario**:
  - **Conto Corrente Bancario (`currentBank`)**: `initialFundBank` + entrate/uscite con `Bonifico`, `POS`, `Bancomat`, `Pagam Online` + **uscite pagate tramite PayPal ma addebitate su Carta/Conto Bancario** (`method === 'Paypal'` con `paypalFundingSource: 'bank'` o default).
  - **Saldo Conto PayPal (`currentPaypal`)**: entrate ricevute su PayPal meno uscite pagate attingendo direttamente dal **Saldo PayPal** (`paypalFundingSource: 'paypal_balance'`).
  - **Cassa Contanti (`currentCash`)**: `initialFundCash` + entrate/uscite in `Contanti`.
- Quando si registra un'uscita con metodo `Paypal`, l'interfaccia permette di scegliere lo strumento utilizzato dentro PayPal (**Addebito su Conto/Carta Bancaria [Predefinito]** vs **Saldo PayPal** vs eventuale secondo conto personalizzato configurato dall'associazione in `profile.customPaymentMethods`).

### 5.4 Generalizzazione Multi-Associazione, Soci Adulti e Pagine `/privacy` e `/termini` (Fase 7)
- **Procedura Guidata di Primo Avvio (`OnboardingWizardModal.tsx`)**: permette a qualsiasi associazione di configurare in 4 passi Dati Istituzionali, Ente di Affiliazione (`US ACLI`, `CSEN`, `UISP`, `AICS`, `ASI`, `OPES`, `CSI`, `FSN`, ecc.), Preset Scadenze, Tipologie di Tessera (`profile.cardTypes`), Fasce d'Età (`profile.ageGroups`) e Categorie Cassa/Eventi (`profile.cashCategories`, `profile.eventCategories`).
- **Soci Adulti (`Member.isMinor`)**: per i soci con `isMinor: false` (maggiorenni), i campi del genitore/tutore sono facoltativi e vengono precompilati con nome e CF del socio stesso ai fini delle ricevute; se `profile.hasAdultMembers` è attivo, le etichette *"Bimbo/a"* diventano *"Socio / Partecipante"*.
- **Pagine Pubbliche `/privacy` e `/termini` (`LegalPagesModal.tsx`)**: raggiungibili anche senza login agli URL `/privacy` e `/termini` (o `?page=privacy` / `?page=termini`) per la verifica Google OAuth, oltre che dal footer della barra laterale.

---

## 6. Suite di Test Unitari e Verifica Build (`npm run check`)

Tutta la logica pura è verificata da **63 test unitari** distribuiti in 7 file di test ed eseguibili con:

```bash
npm test          # Esegue tsx --test src/utils/*.test.ts (63 test in 7 suite)
npm run typecheck # Esegue tsc --noEmit (TypeScript strict mode, noUnusedLocals, noUnusedParameters)
npm run build     # Esegue vite build con code-splitting multi-chunk
npm run check     # Esegue in sequenza typecheck + test + build (usato anche dalla CI GitHub Actions)
```
