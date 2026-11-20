# ISTRUZIONI PER L'ASSISTENTE AI DEL PROGETTO "GESTIONALE ASD APUACAMP"

> **Messaggio del proprietario del progetto.** Questo documento è stato preparato dopo una revisione completa del codice del repository. Contiene problemi verificati nel codice e le istruzioni per correggerli. Leggilo tutto prima di iniziare.

## COSA DEVI FARE ADESSO

1. **Leggi tutto il documento**, dall'inizio alla fine, prima di modificare qualsiasi file.
2. **Rispondimi prima di toccare il codice**, con:
   - un riassunto in 10 righe di cosa hai capito;
   - per ogni fase (1–8): se sei d'accordo, oppure se nel codice attuale qualcosa è già diverso da come è descritto (il documento si riferisce al commit `5ca3e9f`; se nel frattempo hai modificato il codice, segnalami le differenze);
   - eventuali dubbi o punti in cui ti serve una mia decisione.
3. **Aspetta la mia conferma.** Poi esegui **solo la Fase 1**.
4. A fine fase scrivimi: file modificati, esito di typecheck/test/build, e la lista dei controlli manuali che devo fare io.
5. Passa alla fase successiva **solo quando ti scrivo "procedi con la Fase N"**.
6. Se un'istruzione è in conflitto con il codice reale, o ti sembra sbagliata, **fermati e chiedimi** invece di improvvisare.
7. Il database reale dell'associazione è già su Google Drive: **nessuna modifica deve renderlo illeggibile o perdere dati**.

---

# Piano di Correzione del Codice — Gestionale ASD Apuacamp

**Destinatario:** l'assistente AI che sviluppa e mantiene questo progetto.
**Riferimento codice:** commit `5ca3e9f` (branch `main`). I numeri di riga citati si riferiscono a quel commit e possono slittare: ritrova sempre il punto con la ricerca testuale indicata.
**Lingua dell'interfaccia:** italiano (mantienila).

---

## 0. Come usare questo documento (leggi prima di toccare il codice)

### 0.1 Regole di lavoro obbligatorie

1. **Lavora per fasi, nell'ordine indicato.** Una fase per sessione. Non iniziare la fase successiva finché quella corrente non soddisfa tutti i suoi "Criteri di accettazione".
2. **Non riscrivere file interi.** Fai modifiche mirate. Non cambiare grafica, testi o layout che non sono oggetto del compito.
3. **Compatibilità con i dati reali.** Su Google Drive esiste già il database reale dell'associazione (`database_gestionale_asd.json`). Ogni modifica al formato dei dati deve passare dal sistema di migrazione (Fase 2) e deve caricare correttamente i file vecchi. Mai perdere un campo esistente.
4. **Dopo ogni fase esegui e riporta l'esito di:**
   ```bash
   npx tsc --noEmit
   npx tsx --test src/utils/*.test.ts
   npx vite build
   ```
   Se qualcosa fallisce, correggi prima di dichiarare la fase conclusa.
5. **Ogni logica nuova va in funzioni pure in `src/utils/`** (testabili senza browser) e deve avere test `node:test` nello stile di `src/utils/finance.test.ts`. I componenti React devono solo chiamarle.
6. **Alla fine di ogni fase** scrivi al proprietario un riepilogo breve: cosa hai cambiato (file), cosa deve verificare a mano (usa la checklist della fase), eventuali dubbi.
7. **Non inventare comportamenti fiscali.** Dove il piano indica soglie o regole fiscali, rendile configurabili e aggiungi nell'interfaccia la nota "verificare con il proprio consulente".
8. **Non rimuovere** `metadata.json` né le impostazioni `DISABLE_HMR` in `vite.config.ts`: servono all'ambiente di sviluppo AI Studio.

### 0.2 Decisioni già prese dal proprietario (non rimetterle in discussione)

- **Nessun server, nessun multiutente.** Ogni associazione usa **un solo account Google** (credenziali condivise tra i membri del direttivo). I dati restano nel Google Drive di quell'account e/o in un file JSON sul PC.
- **Conseguenza importante:** lo stesso account può essere aperto **contemporaneamente da più PC o più schede** (es. presidente e tesoriere). Il sistema deve quindi proteggersi dalle sovrascritture incrociate (Fase 1), pur restando "mono-utente".
- **Diffusione prevista:** Apuacamp + circa 10 altre associazioni, **di enti di affiliazione diversi** (non solo US ACLI).
- **Tipi di account:** deve funzionare con qualunque account Google (Gmail personale e Google Workspace), **senza costi**.
- **Volumi:** fino a 1.000 soci/anno (tipicamente 500), migliaia di movimenti/anno.
- **Ricevute:** i genitori le usano per la **detrazione nel 730**. Il numero e i dati devono restare modificabili a mano, ma il sistema deve proporli correttamente e avvisare degli errori.

### 0.3 Mappa delle fasi

| Fase | Tema | Priorità |
|---|---|---|
| 1 | Sincronizzazione sicura con Drive (niente sovrascritture, niente duplicati, backup automatici) | 🔴 Critica |
| 2 | Formato dati: versione schema, migrazioni, ID univoci, date uniformi | 🔴 Critica |
| 3 | Registro ricevute con numerazione progressiva + controlli 730 | 🔴 Critica |
| 4 | Collegamenti strutturati tra movimenti e soci/iscrizioni/staff; soglie collaboratori | 🟠 Alta |
| 5 | Sicurezza e privacy (permessi Google, dati nel browser, iniezioni, librerie) | 🟠 Alta |
| 6 | Pulizia build, prestazioni, qualità del codice, test | 🟡 Media |
| 7 | Generalizzazione per altre associazioni (configurazione guidata, categorie configurabili) | 🟡 Media |
| 8 | Aggiornamento della documentazione | 🟡 Media (obbligatoria alla fine) |

---

## FASE 1 — Sincronizzazione sicura con Google Drive

### Problemi da risolvere

| # | Problema | Dove |
|---|---|---|
| 1.a | Nessun controllo di concorrenza: l'app legge il file Drive solo al login, poi scrive. Due PC/schede si sovrascrivono a vicenda senza avviso. | `src/App.tsx` effetto di autosave (cerca `const timer = setTimeout(async () =>`) e timer 90 s (cerca `90_000`) |
| 1.b | La scelta tra dati locali e remoti si basa sul **conteggio dei record** (`countAppStateRecords`): modifiche e cancellazioni vengono ignorate. | `App.tsx` funzione `pullStateFromGoogleDrive` (cerca `remoteCount === 0`) e `stateToUpload` |
| 1.c | Fuga di dati tra account: la chiave `apuacamp_working_snapshot_v4_latest` è unica per tutto il browser. Prima del login si vedono i dati dell'ultimo utente; se un altro account senza database fa login, quei dati vengono **caricati nel suo Drive**. | `src/utils/storage.ts` (`SNAPSHOT_KEY_LATEST`, `loadAppState`) + `App.tsx` (`stateToUpload`) |
| 1.d | Il database viene cercato **in tutto il Drive** (anche file condivisi da altri) per nome; in mancanza si promuove a database qualunque `Backup_Apuacamp*` / `Database_ASD*`. | `src/services/googleWorkspace.ts` `loadLiveDatabaseFromDrive` e `saveLiveDatabaseToDrive` |
| 1.e | Salvataggi concorrenti → due file `database_gestionale_asd.json`; `ensureGestionaleDriveStructure()` lanciata in parallelo al primo salvataggio → cartelle `Gestionale ASD` duplicate. | `App.tsx` `pullStateFromGoogleDrive` (prima riga del try), `googleWorkspace.ts` `findOrCreateDriveFolder` |
| 1.f | Operazioni distruttive (apri file locale, ripristino, reset, archiviazione anno, import in modalità "sostituisci") finiscono su Drive in 800 ms **senza backup**. "Apri file locale" non chiede nemmeno conferma. | `App.tsx` `handleConnectLocalFile`, `handleFallbackLocalFileInput`, `handleResetToDefaults`, `handleArchiveFiscalYear`, `handleRestoreState`, import con `mode === 'replace'` |
| 1.g | La copia di sicurezza nel browser fallisce in silenzio quando `localStorage` (≈5 MB) è pieno; se la copia è illeggibile `loadAppState` chiama `resetToEmpty2027()` che **la cancella**. | `storage.ts` (`// Ignore quota`, ultima riga di `loadAppState`) |
| 1.h | Il token Google scade ogni ora: i salvataggi falliscono finché l'utente non se ne accorge. | `googleWorkspace.ts` (`saveSessionAccessToken`, 52 minuti) |
| 1.i | Gestione errori duplicata in ogni funzione; Sheets/Forms/Gmail non gestiscono il 401. | `googleWorkspace.ts` |

### 1.1 Helper unico per le chiamate Google

In `src/services/googleWorkspace.ts` crea un helper e usalo in **tutte** le funzioni (Drive, Sheets, Forms, Gmail), eliminando i blocchi `if (res.status === 401) {...}` ripetuti:

```ts
export class GoogleApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function clearCachedToken() {
  cachedAccessToken = null;
  saveSessionAccessToken(null);
}

export async function googleFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearCachedToken();
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new GoogleApiError(res.status, err?.error?.message || `Errore Google API (${res.status})`);
  }
  return res;
}
```

Aggiungi in `listDriveFiles` la **paginazione** (`pageToken` / `nextPageToken`, `pageSize=100`) e un parametro opzionale `fields`.

### 1.2 Identificare il database in modo univoco

1. Aggiungi al profilo `associationId: string` (UUID generato con `crypto.randomUUID()` alla prima creazione; la migrazione della Fase 2 lo crea per i dati esistenti). È l'identità dell'associazione dentro il file.
2. Quando crei o aggiorni il database su Drive, imposta sul file le `appProperties`:
   ```json
   { "gestionaleAsdDb": "1", "associationId": "<uuid>" }
   ```
   (sono metadati invisibili all'utente, supportati da Drive v3 in `files.create` / `files.update`).
3. Riscrivi `loadLiveDatabaseFromDrive`:
   - Se in memoria locale (vedi 1.6) esiste un `fileId` salvato **per quell'email**, prova prima quello (`GET files/{id}?fields=id,name,version,modifiedTime,trashed,appProperties`).
   - Altrimenti cerca: `appProperties has { key='gestionaleAsdDb' and value='1' } and trashed = false`.
   - Se non trova nulla, cerca per nome **solo dentro la cartella** `Gestionale ASD/07_Backup_Sistema` (`'<folderId>' in parents and name = 'database_gestionale_asd.json' and trashed = false`) — serve per i file creati prima di questa modifica; al primo salvataggio aggiungi loro le `appProperties`.
   - **Elimina** il ripiego su `Backup_Apuacamp*` / `Database_ASD*`. I backup si ripristinano solo manualmente dalla pagina Backup.
   - Se trovi **più di un** database: non sceglierne uno in automatico. Mostra un dialogo con elenco (data modifica, numero soci/movimenti, nome associazione letto dal file) e lascia scegliere.
4. Memorizza il `fileId` scelto nella memoria locale per email (chiave `driveDbFileId:<email>`).

### 1.3 Controllo di versione prima di ogni scrittura (blocco ottimistico)

Ogni file Drive ha il campo `version` (intero che aumenta a ogni modifica). Usalo così:

1. Mantieni in un `useRef` i metadati remoti noti: `{ fileId, version, modifiedTime }`, aggiornati dopo ogni lettura o scrittura riuscita.
2. Funzione `saveLiveDatabaseToDrive(json, known)`:
   1. `GET files/{fileId}?fields=version,modifiedTime,trashed`.
   2. Se `version !== known.version` → **non scrivere**, lancia `new Error('REMOTE_CHANGED')`.
   3. Altrimenti `PATCH upload/drive/v3/files/{fileId}?uploadType=media&fields=id,version,modifiedTime`.
   4. Restituisci i nuovi metadati.
3. Su `REMOTE_CHANGED` l'app:
   - sospende l'autosave;
   - mostra un dialogo bloccante **"I dati su Google Drive sono stati modificati da un altro computer o un'altra scheda"** con tre scelte:
     - **"Carica la versione di Drive"** → prima salva lo stato locale come file di backup (vedi 1.5, motivo `conflitto-locale`), poi carica quello remoto;
     - **"Mantieni la mia versione"** → prima copia il file remoto come backup (motivo `conflitto-drive`), poi sovrascrive;
     - **"Decido dopo"** → l'autosave resta sospeso e l'header mostra in rosso "Sincronizzazione sospesa".
4. Scrivi la decisione come funzione pura testabile in `src/utils/syncDecision.ts`:
   ```ts
   export type SyncAction = 'upload' | 'download' | 'conflict' | 'noop';
   export function decideSyncAction(p: {
     localDirty: boolean;           // ci sono modifiche locali non salvate
     knownVersion?: string;         // versione remota vista l'ultima volta
     remoteVersion?: string;        // versione remota attuale
   }): SyncAction
   ```
   Tabella attesa: remoto invariato + locale modificato → `upload`; remoto cambiato + locale pulito → `download`; remoto cambiato + locale modificato → `conflict`; nessuno dei due → `noop`.
5. Il timer periodico (oggi 90 s, solo invio) diventa un **controllo bidirezionale ogni 60 s**: legge `version`; applica `decideSyncAction`. In caso di `download` ricarica silenziosamente e mostra un avviso breve "Dati aggiornati da Drive".
6. Controlla la versione anche quando la finestra torna in primo piano (`document.visibilitychange` → `visible`).

### 1.4 Una sola scrittura alla volta

Crea `src/utils/saveQueue.ts`:

```ts
// Esegue al massimo un salvataggio alla volta. Se arrivano richieste durante un salvataggio,
// al termine ne esegue UNA sola con lo stato più recente (coalescenza).
export function createSaveQueue(run: (payload: string) => Promise<void>) {
  let inFlight: Promise<void> | null = null;
  let pending: string | null = null;
  async function drain() {
    while (pending !== null) {
      const next = pending;
      pending = null;
      await run(next);
    }
  }
  function start(): Promise<void> {
    inFlight = drain().finally(() => {
      inFlight = null;
      // una richiesta arrivata proprio mentre il ciclo terminava non deve andare persa
      if (pending !== null) start();
    });
    return inFlight;
  }
  return {
    request(payload: string) {
      pending = payload;
      return inFlight ?? start();
    },
  };
}
// Nota: se run() lancia un errore (es. REMOTE_CHANGED o AUTH_REQUIRED), il payload va
// rimesso in `pending` dal chiamante solo dopo la risoluzione (riconnessione o scelta nel dialogo conflitti).
```

- Usala sia per l'autosave sia per il timer sia per `pushStateToGoogleDriveNow`, così non partono mai due upload insieme e non nascono file duplicati.
- Porta il debounce dell'autosave da 800 ms a **2000 ms** (il file con 1.000 soci e migliaia di movimenti pesa qualche MB).
- **Cartelle:** in `ensureGestionaleDriveStructure` e `getOrCreateDriveCategoryFolder` memorizza in una variabile di modulo la *Promise* della creazione della cartella radice e dell'albero, così le chiamate concorrenti attendono la stessa operazione invece di crearne un'altra. Crea le 7 sottocartelle **in sequenza**, non con `Promise.all`. Rimuovi la chiamata "fire-and-forget" `ensureGestionaleDriveStructure().catch(() => {})` e attendila (`await`) prima del primo salvataggio.
- In `findOrCreateDriveFolder` esegui l'escape anche del backslash: `folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")`.

### 1.5 Backup automatici con data e ora

Crea `createVersionedBackupOnDrive(state: AppState, reason: string)` in `googleWorkspace.ts`:
- salva `backup_<reason>_<AAAA-MM-GG_HH-mm-ss>.json` in `07_Backup_Sistema` (con `appProperties: { gestionaleAsdBackup: "1" }`);
- se non c'è login Google, scarica il file sul PC con `downloadLocalDatabaseFile`.

Chiamala, **attendendo l'esito prima di procedere**, in tutti questi casi:
- apertura di un file locale (`handleConnectLocalFile`, `handleFallbackLocalFileInput`) — aggiungi anche un `confirm()` che riepiloghi: nome associazione nel file, n° soci, n° movimenti, anno, e avvisi che sostituirà i dati attuali;
- ripristino backup (`handleRestoreState`);
- reset (`handleResetToDefaults`);
- archiviazione anno (`handleArchiveFiscalYear`);
- import con modalità `replace` (soci e movimenti);
- risoluzione di un conflitto (1.3);
- **automaticamente al primo salvataggio di ogni giorno** (motivo `giornaliero`).

Conservazione: dopo ogni backup elimina i backup automatici `giornaliero` più vecchi oltre i 30 più recenti. Non eliminare mai gli altri tipi.

### 1.6 Copia locale nel browser: per account, robusta, senza limite di 5 MB

1. Sposta la copia di sicurezza da `localStorage` a **IndexedDB** (nessuna dipendenza nuova: scrivi un piccolo wrapper in `src/utils/localDb.ts` con `get/set/delete/keys` su un object store `snapshots`).
2. Chiavi: `snapshot:<email>` per chi ha fatto login, `snapshot:local` per chi lavora solo con file locale. **Elimina `SNAPSHOT_KEY_LATEST`** e ogni lettura "di ripiego" tra account diversi.
3. Al primo avvio dopo l'aggiornamento: migra una sola volta le vecchie chiavi `apuacamp_working_snapshot_v4_*` da `localStorage` a IndexedDB, poi rimuovile.
4. **Regola anti-fuga** (sostituisce la logica `stateToUpload` e `remoteCount === 0 && localCount > 0`): dopo il login con l'email X, lo stato locale può essere caricato sul Drive di X **solo se**:
   - proviene da `snapshot:<X>` (stesso account), **oppure**
   - l'utente conferma esplicitamente un dialogo: *"Vuoi caricare nel Drive di X i dati dell'associazione «<nome>» (N soci, M movimenti) presenti su questo computer?"*.
   Se il database remoto esiste e ha un `associationId` diverso da quello locale, **non unire e non sovrascrivere mai**: carica il remoto e conserva il locale solo come backup scaricabile.
5. Se la scrittura in IndexedDB fallisce: mostra un banner rosso persistente "La copia di sicurezza su questo computer non è stata salvata" (non ignorare l'errore).
6. Se la copia locale non si riesce a leggere/interpretare: **non cancellarla**. Rinominala in `snapshot-corrotto:<email>:<timestamp>` e avvisa l'utente.
7. Rinomina `resetToEmpty2027` in `createEmptyState(startYear?)` e fa' in modo che **non tocchi lo storage** (deve essere una funzione pura). La cancellazione degli snapshot diventa una funzione separata e esplicita.
8. Prima del login non caricare automaticamente snapshot di account Google: mostra lo stato vuoto oppure `snapshot:local`.

### 1.7 Scadenza del token (senza server non esiste rinnovo automatico invisibile)

- Salva l'ora di scadenza del token. **5 minuti prima** mostra un banner non bloccante "La connessione a Google sta per scadere — Rinnova (1 clic)".
- Alla scadenza o al primo `AUTH_REQUIRED`: metti in attesa i salvataggi (la coda 1.4 conserva l'ultimo stato), mostra il banner "Riconnetti", e dopo il nuovo login esegui subito il controllo versione (1.3) e poi il salvataggio in attesa.
- Il rinnovo deve usare `prompt: ''` / `select_account` senza forzare di nuovo il consenso.

### 1.8 Più schede nello stesso browser

Usa la **Web Locks API** (`navigator.locks.request('gestionale-asd-writer', { ifAvailable: true }, cb)`): solo la scheda che ottiene il lock scrive (Drive e file locale). Le altre mostrano un banner "Il gestionale è già aperto in un'altra scheda: questa è in sola lettura" con il pulsante "Usa questa scheda" (che chiede il lock con `steal: true`). Se l'API non è disponibile, prosegui senza lock (il controllo di versione 1.3 resta comunque attivo).

### 1.9 File locale sul PC

- Le scritture sul file locale vanno anch'esse in una coda (1.4) e con debounce, non a ogni render.
- Se il file è stato aperto con l'input di ripiego (`handleFallbackLocalFileInput`, senza `FileSystemFileHandle`), l'interfaccia **non** deve mostrare "collegato/salvataggio automatico": deve dire "File importato — per salvare usa 'Salva su PC'".
- Opzionale: conserva il `FileSystemFileHandle` in IndexedDB per riproporre il collegamento dopo un riavvio (richiede `handle.requestPermission({ mode: 'readwrite' })`).

### Test da aggiungere (Fase 1)
- `decideSyncAction`: tutti e 4 i casi.
- `createSaveQueue`: 5 richieste ravvicinate → al massimo 2 esecuzioni, l'ultima col payload più recente; mai due esecuzioni sovrapposte.
- Regola anti-fuga (estraila in funzione pura `canUploadLocalToRemote(...)`): snapshot di un'altra email → `false`; `associationId` diverso → `false`.

### Criteri di accettazione (Fase 1)
- Nessuna chiamata a `fetch` verso API Google al di fuori di `googleFetch`.
- `countAppStateRecords` non è più usato per decidere cosa sovrascrivere (può restare per mostrare statistiche).
- Nessun riferimento a `SNAPSHOT_KEY_LATEST`, a `Backup_Apuacamp` nella ricerca del database, né a `localStorage` per lo snapshot.

### Verifica manuale per il proprietario (Fase 1)
1. Apri l'app in due schede: la seconda deve dire "sola lettura".
2. Apri l'app su due PC con lo stesso account; modifica un socio sul PC A, aspetta 1 minuto, modifica un altro socio sul PC B: sul PC B deve comparire il dialogo di conflitto **oppure** (se B non aveva modifiche) i dati devono aggiornarsi da soli.
3. Esegui "Apri file locale": deve chiedere conferma e in `Gestionale ASD/07_Backup_Sistema` deve comparire un file `backup_...json`.
4. Su Drive deve esistere **una sola** cartella `Gestionale ASD` e **un solo** `database_gestionale_asd.json`.

---

## FASE 2 — Formato dati: versione, migrazioni, ID, date

### Problemi
- Il JSON non ha numero di versione; `parseBackupJSON` (`storage.ts`) non valida nulla e sostituisce il profilo intero (`data.profile || INITIAL_ASSOCIATION_PROFILE`) invece di unirlo ai valori predefiniti: i campi nuovi restano `undefined`.
- ID generati con `Date.now()` (es. `` `bk-${Date.now()}` `` in `App.tsx`, cerca `` id = `bk- ``): l'import Excel delle iscrizioni (`EventsView.tsx`, ciclo `for (const r of dataRows)` che chiama `onAddBooking`) crea **ID identici** nello stesso millisecondo; modificare o cancellare una di quelle iscrizioni le colpisce tutte.
- Date in formati misti nel modello (`CashTransaction.date: "ISO o DD/MM/YYYY"`, `Member.expiryDate` in `DD/MM/YYYY`, `MemberCardRecord` misto).
- `new Date().toISOString().slice(0, 10)` (40 occorrenze) restituisce la data **UTC**: tra mezzanotte e l'1:00 (2:00 in estate) registra il giorno prima. Esiste già `getTodayIsoDate()` corretta in `TransactionDateSelector.tsx` ma non è usata ovunque.
- `normalizeTransactionDate` (`csvExcelImporter.ts`) mette in silenzio al **1° gennaio** le date non riconosciute; i parser non validano mese/giorno (es. 31/02).

### 2.1 ID univoci
Crea `src/utils/ids.ts`:
```ts
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
```
Sostituisci **tutte** le generazioni di ID basate su `Date.now()` o `Math.random()` (cerca con `` grep -rn "\${Date.now()}" src ``). Mantieni i prefissi esistenti (`tx`, `m`, `bk`, `ev`, ...).

### 2.2 Date: un solo formato memorizzato
Crea `src/utils/dates.ts` con:
- `todayIso(): string` — data locale `YYYY-MM-DD` (sposta qui `getTodayIsoDate`, lascia un re-export per compatibilità);
- `isValidIsoDate(s)` — verifica formato **e** validità reale (giorni del mese, bisestili);
- `toIsoDate(raw): string | null` — accetta ISO, `DD/MM/YYYY`, `DD-MM-YY`, numeri seriali Excel, ecc. (riusa la logica di `tryParseTransactionDate`) e restituisce `null` se non valida;
- `formatIt(iso)` — `DD/MM/YYYY` solo per la visualizzazione.

Regole:
1. **Ogni data memorizzata nello stato è `YYYY-MM-DD`.** Il formato italiano si usa solo in visualizzazione e nei documenti.
2. Sostituisci tutte le occorrenze di `toISOString().slice(0, 10)` e `toISOString().split('T')[0]` usate come "data di oggi" con `todayIso()`. (Le marcature temporali complete, es. `confirmationEmailSentAt`, possono restare `toISOString()`.)
3. Negli import (Excel/CSV/Google Form): una data non valida **non** diventa 1° gennaio. La riga va mostrata nell'anteprima come "Data non riconosciuta" e l'utente decide se correggerla o scartarla. Elimina il ripiego in `normalizeTransactionDate` oppure fallo restituire `null`.
4. `normalizeBirthOrExpiryDate` deve restituire ISO.

### 2.3 Versione dello schema e migrazioni
Crea `src/utils/migrations.ts`:
```ts
export const CURRENT_SCHEMA_VERSION = 2;

type Migration = (s: any) => any;
const MIGRATIONS: Record<number, Migration> = {
  // da 1 (file senza schemaVersion) a 2
  1: (s) => {
    // a) profile.associationId se assente
    // b) date -> ISO su: transactions[].date, members[].birthDate/expiryDate/cardIssueDate,
    //    members[].cardHistory[].issueDate/expiryDate, events[].date/endDate, gadgetOrders[].date,
    //    assemblies, roles, grants (tutti i campi data)
    //    (se una data non è convertibile, lasciala invariata e aggiungi una voce a s._migrationWarnings)
    // c) ID duplicati: in ogni collezione, alla seconda occorrenza dello stesso id assegna newId(prefisso)
    // d) receipts: [] se assente (Fase 3)
    return { ...s, schemaVersion: 2 };
  },
};

export function migrateState(raw: any): { state: any; warnings: string[] } { /* applica in ordine, idempotente */ }
```
- `parseBackupJSON` deve: fare `JSON.parse`, chiamare `migrateState`, **unire** ogni sezione ai valori predefiniti (`profile: { ...INITIAL_ASSOCIATION_PROFILE_NEUTRO, ...data.profile }`), validare minimamente i tipi (array, numeri) e restituire anche gli avvisi.
- Mostra gli avvisi di migrazione all'utente una sola volta.
- `exportBackupJSON` scrive sempre `schemaVersion`.
- Le migrazioni devono essere **idempotenti** (applicarle due volte non cambia nulla) e **non devono mai rimuovere campi sconosciuti**.
- Quando un file ha `schemaVersion` maggiore di `CURRENT_SCHEMA_VERSION` (app vecchia aperta su un PC non aggiornato): apri in **sola lettura** e avvisa di ricaricare la pagina; non salvare.

### 2.4 Pulizia degli aggiornamenti di stato
- In `App.tsx` le funzioni passate a `setAppState(prev => ...)` devono essere **pure**. Oggi `handleAddTransaction` e `handleImportTransactions` chiamano `setIsDuplicatesModalOpen(true)` dentro l'updater, e `handleUndo`/`handleRedo` chiamano `setRedoStack`/`setAppState` dentro l'updater di `setUndoStack`. Sposta questi effetti fuori (calcola su `appStateRef.current` o in un `useEffect` che osserva `targetDuplicateTxIds`).
- Introduci un'unica funzione `applyAction(label: string, updater: (s: AppState) => AppState)` che registra **un solo** snapshot di annullamento e applica l'updater. Le operazioni composte (es. sincronizzazione socio da evento in `EventsView.tsx` che chiama `onAddMember` + `onUpdateBooking` + `onAddTransaction`) e gli import in ciclo devono diventare **una singola azione** (aggiungi handler batch, es. `onImportBookings(bookings[])`).
- Dopo questi cambi, attiva `<React.StrictMode>` in `src/main.tsx` e verifica che annulla/ripeti funzionino ancora.

### Test (Fase 2)
- `toIsoDate`: `31/02/2026` → `null`; `29/02/2028` → `2028-02-29`; seriale Excel; `05/03/26` → `2026-03-05`.
- `todayIso()` con orologio simulato alle 00:30 ora italiana → data del giorno corrente.
- `migrateState`: file v1 reale di esempio (crea un fixture anonimo in `src/utils/__fixtures__/db_v1.json` con date miste e due ID duplicati) → tutte le date ISO, ID unici, `schemaVersion: 2`; applicata due volte dà lo stesso risultato.
- Correggi il test esistente "never persists data in browser localStorage" (`finance.test.ts`), che non verifica nulla e afferma il contrario del comportamento reale: sostituiscilo con test reali sullo storage (con un IndexedDB/localStorage finto).

### Verifica manuale (Fase 2)
1. **Prima di pubblicare questa fase**: il proprietario scarica un backup JSON completo dalla pagina Backup.
2. Dopo l'aggiornamento: aprire l'app, controllare che soci, movimenti, saldi ed eventi coincidano con prima.
3. Importare un Excel di iscrizioni con 10 righe, poi cancellarne una: deve sparire **solo** quella.

---

## FASE 3 — Ricevute: numerazione progressiva e controlli per il 730

### Problema
`ReceiptModal.tsx` (cerca `` `${profile.activeYear}/R-${Math.floor(100 + Math.random() * 900)}` ``) assegna un numero **casuale** tra 100 e 999: dopo ~35 ricevute la probabilità di un doppione supera il 50%. Non esiste un registro delle ricevute emesse. Le ricevute servono ai genitori per il 730.

### 3.1 Modello dati (aggiungi a `src/types/index.ts` e ad `AppState`)
```ts
export interface IssuedReceipt {
  id: string;
  year: number;               // anno di emissione
  progressive: number;        // 1, 2, 3, ...
  number: string;             // es. "12/2027" (formato configurabile)
  manualNumber?: boolean;     // true se l'utente ha scritto il numero a mano
  issueDate: string;          // YYYY-MM-DD
  status: 'emessa' | 'annullata';
  cancelReason?: string;
  payerName: string;
  payerFiscalCode?: string;
  participantName?: string;   // praticante (es. il bambino)
  participantFiscalCode?: string;
  participantBirthDate?: string;
  description: string;
  lineItems?: ReceiptLineItem[];
  amount: number;
  paymentMethod: PaymentMethod;
  memberId?: string;
  bookingId?: string;
  transactionId?: string;
  gadgetOrderId?: string;
  driveFileId?: string;
  driveUrl?: string;
  sentTo?: string;
  sentAt?: string;
}
// AppState: receipts: IssuedReceipt[]
// AssociationProfile: receiptNumberFormat?: string  // default "{n}/{anno}"
```

### 3.2 Regole
1. Il numero proposto è calcolato, non salvato in un contatore: `max(progressive delle ricevute dell'anno, incluse le annullate) + 1`. Funzione pura `nextReceiptProgressive(receipts, year)` in `src/utils/receipts.ts`.
2. **Il numero viene "consumato" solo all'emissione**: quando l'utente scarica il PDF o lo invia via Gmail di una **ricevuta**. Aprire il modale non consuma numeri.
3. **Preventivi e solleciti non usano la serie delle ricevute** (nessun numero, oppure serie separata `P-…`).
4. Il numero resta **modificabile a mano** (decisione del proprietario). Se il numero scritto esiste già nello stesso anno → avviso bloccante con conferma esplicita "Emetti comunque con numero duplicato". Segna `manualNumber: true`.
5. Riaprire una ricevuta già emessa (da registro, da movimento o da iscrizione) mostra **lo stesso numero**; non ne genera uno nuovo.
6. Annullamento: `status: 'annullata'` con motivo; il numero non viene mai riutilizzato; la ricevuta non si cancella.
7. Collega la ricevuta a `transactionId` / `bookingId` / `memberId` quando nota.
8. Se Drive è collegato, salva il PDF emesso nella cartella ricevute e memorizza `driveFileId`/`driveUrl`.

### 3.3 Registro ricevute
Aggiungi una sezione "Registro Ricevute" (nella vista configurazione ricevute o nella Cassa) con: elenco filtrabile per anno, stato, ricerca per nome; azioni "Riapri PDF", "Reinvia", "Annulla"; esportazione `.xlsx`. Un'evidenza dei "buchi" di numerazione (numeri mancanti nella sequenza) è utile per il controllo.

### 3.4 Controlli per la detrazione 730 (avvisi, non blocchi)
Quando la ricevuta contiene la dicitura di detraibilità (o un flag `forTaxDeduction` attivo):
- avvisa se mancano: codice fiscale dell'associazione, nome **e codice fiscale** di chi paga, nome **e codice fiscale** del praticante, descrizione dell'attività sportiva, importo, data;
- avvisa se il metodo di pagamento è **Contanti** ("per la detrazione il pagamento deve essere tracciabile");
- avvisa se l'età del praticante alla data del pagamento è fuori dall'intervallo **5–18 anni**;
- avvisa (informativo) che la spesa detraibile ha un **tetto di 210 € per figlio** all'anno.
Rendi queste regole configurabili nel profilo (età minima/massima, tetto) e aggiungi la nota "Verificare i requisiti aggiornati con il proprio consulente".

### 3.5 Firma
`generateDigitalSignatureDataUrl` crea un'immagine "a mano" dal nome del presidente. **Non è una firma.** Rinomina l'opzione in interfaccia "Firma grafica generata (solo estetica, non ha valore di firma)", disattivala di default e suggerisci di caricare la scansione della firma reale.

### Test (Fase 3)
`nextReceiptProgressive` (anno vuoto → 1; con annullate; anni diversi indipendenti); rilevamento duplicato; controlli 730 (contanti → avviso; età 4 → avviso; CF mancante → avviso).

### Verifica manuale (Fase 3)
Emettere 3 ricevute → numeri 1/AAAA, 2/AAAA, 3/AAAA. Aprire e chiudere il modale senza emettere → il numero successivo resta 4. Fare un preventivo → nessun numero consumato.

---

## FASE 4 — Collegamenti strutturati e collaboratori sportivi

### Problemi
- `CashTransaction` non ha ID verso socio, iscrizione, collaboratore o ordine gadget (il campo `relatedEventId` esiste ma non viene mai valorizzato). I legami si ricostruiscono **cercando nomi nella descrizione**.
- `StaffView.tsx` (cerca `const firstName = s.name.split(' ')[0]`) attribuisce i compensi cercando il **nome di battesimo** nella descrizione: "Emma" prende i pagamenti di "Gemma", due "Nicola" si sommano.
- Nella somma dei compensi entrano anche i **rimborsi spese a piè di lista**.
- La documentazione promette un avviso al superamento della soglia: **il codice non esiste**.
- Cancellare un'iscrizione lascia orfani i movimenti collegati; segnare "saldo pagato" non propone il movimento di cassa.
- Il collegamento iscrizione↔socio si basa sul nome del bambino (`m.childName.trim().toLowerCase() === cName.toLowerCase()`), fragile in caso di omonimi.

### 4.1 Modello
Aggiungi a `CashTransaction` (tutti opzionali, per compatibilità):
```ts
memberId?: string;
bookingId?: string;
staffId?: string;
gadgetOrderId?: string;
receiptId?: string;
staffPaymentKind?: 'compenso_sportivo' | 'servizi_guida' | 'progettazione' | 'rimborso_spese';
```
Valorizzali in **tutti** i punti che creano movimenti. Trovali con `grep -rn "onAddTransaction(" src/components` (CardsView, CashFlowView, StaffView, EventsView, MembersView) più `handleAddGadgetOrder` e le spese ricorrenti in `App.tsx`.

### 4.2 Comportamenti
- **Iscrizioni:** quando `isDepositPaid` o `isBalancePaid` passa da `false` a `true` in modifica, proponi di registrare il movimento (con `bookingId`). Alla cancellazione di un'iscrizione con movimenti collegati chiedi: "Eliminare anche i N movimenti collegati?" (Sì/No).
- **Soci:** alla cancellazione di un socio con iscrizioni/movimenti collegati, avvisa e chiedi conferma (non cancellare a cascata i movimenti contabili: restano, perdendo solo il collegamento).
- **Import iscrizioni / Google Form:** associa al socio per codice fiscale se presente, poi per nome+data di nascita; in caso di più corrispondenze chiedi all'utente.
- **Duplicati (`src/utils/duplicates.ts`):** usa `memberId`/`staffId` come chiave "persona" quando presenti; le euristiche sul testo restano solo per i movimenti vecchi senza ID.

### 4.3 Collaboratori sportivi
- Totale per collaboratore = somma dei movimenti con `staffId` corrispondente nell'**anno solare** e `staffPaymentKind !== 'rimborso_spese'`. Per i movimenti vecchi senza `staffId`: corrispondenza sul **nome completo a parola intera** (regex con `\b`, case-insensitive), mai sul solo nome di battesimo; offri un'azione "Collega i vecchi pagamenti" che chiede conferma per ciascun abbinamento e salva lo `staffId`.
- Soglie configurabili nel profilo (`staffThresholds: { inpsExemption: 5000, irpefExemption: 15000, warningPercent: 80 }`) con questi valori predefiniti (D.Lgs. 36/2021 come modificato dal D.Lgs. 120/2023: contributi INPS dovuti sulla parte eccedente 5.000 €, compensi non imponibili IRPEF fino a 15.000 €).
- Avvisi (in StaffView e nelle notifiche): arancione all'80% di 5.000 €, rosso oltre 5.000 € (INPS) e oltre 15.000 € (IRPEF).
- Nota fissa in interfaccia: *"Le soglie si calcolano sul totale dei compensi sportivi percepiti dal collaboratore da tutti gli enti, non solo dalla nostra associazione: chiedere al collaboratore un'autocertificazione. Verificare con il consulente."*
- Correggi la documentazione: la soglia di 5.000 € è **contributiva (INPS)**, non "fiscale".

### 4.4 Saldi
- `initialFund` è ridondante: deve essere sempre `initialFundBank + initialFundCash`. Calcolalo, non memorizzarlo separatamente (la migrazione lo riallinea; se il valore salvato differisce, mostra un avviso una volta).
- Rendi configurabile a quale "conto" appartiene ogni metodo di pagamento (`profile.paymentAccounts`, es. `{ Bonifico: 'banca', POS: 'banca', Paypal: 'paypal', Contanti: 'cassa' }`), così PayPal non viene sommato alla banca e la riconciliazione con l'estratto conto torna. Valori predefiniti = comportamento attuale, tranne PayPal su un conto a parte.
- Confronta il metodo in modo robusto (`method.trim().toLowerCase()`).

### Test (Fase 4)
Totali staff: "Emma" e "Gemma" separati; rimborsi esclusi; soglie 4.000 / 5.001 / 15.001. Saldi con PayPal separato.

---

## FASE 5 — Sicurezza e privacy

### 5.1 Permessi Google (OAuth)
In `googleWorkspace.ts` (`SCOPES`) sostituisci `https://www.googleapis.com/auth/drive` con **`https://www.googleapis.com/auth/drive.file`**. Mantieni `spreadsheets`, `forms.body`, `forms.responses.readonly`, `gmail.send`.

Motivo: `drive` (accesso a tutto il Drive) è un permesso "restricted" che, per distribuire l'app ad altre associazioni, richiederebbe una verifica di sicurezza a pagamento. Con `drive.file` l'app vede solo i file che ha creato lei (database, backup, cartelle, fogli, moduli creati dall'app), che è ciò che serve.

Adattamenti necessari:
- `BackupView.tsx` (`loadUserSpreadsheets`, query `mimeType = 'application/vnd.google-apps.spreadsheet'`): con `drive.file` elencherà solo i fogli creati dall'app. Aggiungi un campo **"Incolla il link del Foglio Google"** che estrae l'ID dall'URL e lo legge con Sheets API (il permesso `spreadsheets` lo consente).
- `GovernanceView.tsx` (elenco file della cartella): mostrerà solo i file caricati tramite l'app. Scrivilo chiaramente nell'interfaccia ("Qui compaiono i documenti caricati dal gestionale"). Opzionale: integrare Google Picker per aggiungere file già presenti su Drive.
- Import da Google Form: con `forms.responses.readonly` si possono leggere anche moduli creati a mano; nessun cambio.
- Dopo il cambio, gli utenti dovranno rifare il login una volta (nuovo consenso).

### 5.2 Dati personali e sanitari di minori sul computer
- Al **logout** chiedi: "Vuoi cancellare i dati dell'associazione da questo computer? (consigliato sui PC condivisi)" — default **Sì**. Cancella `snapshot:<email>`, `driveDbFileId:<email>`, token in `sessionStorage`.
- In `pageGuides.ts` correggi il testo "Nessun salvataggio sulla memoria volatile del browser" (falso): spiega che una copia di sicurezza resta sul computer finché non si esce con "cancella dati".
- Gli archivi degli anni chiusi (`archivedYears[].membersSnapshot`) contengono dati sanitari per sempre: aggiungi nel profilo una politica di conservazione (es. "anonimizza allergie/note salute negli archivi più vecchi di N anni", default disattivato) e un'azione manuale "Anonimizza dati sanitari negli archivi".

### 5.3 Iniezione di formule
- `googleWorkspace.ts`: in `createAndPopulateSpreadsheet`, `updateMembersGoogleSheet`, `syncAccountingGoogleSheet` usa `valueInputOption: 'RAW'` per i dati provenienti da soci/moduli. Se servono formule calcolate, scrivile in una chiamata separata con `USER_ENTERED` solo per quelle celle.
- `src/utils/export.ts` (CSV): applica a ogni cella testuale una funzione `sanitizeSpreadsheetCell(v)` che antepone `'` alle stringhe che iniziano con `=`, `+`, `-`, `@`, tabulazione o ritorno a capo (eccetto numeri veri). Mettila in `src/utils/sanitize.ts` con test.

### 5.4 Email
In `sendGmailMessageWithAttachment`: rimuovi `\r` e `\n` da `to`, `replyTo`, `subject` e dal nome del file allegato; valida l'indirizzo con una regex semplice; codifica anche il `filename` con RFC 2047 se contiene caratteri non ASCII.

### 5.5 Librerie
- `xlsx@0.18.5` da npm ha vulnerabilità note (CVE-2023-30533, CVE-2024-22363) e l'app apre file caricati da terzi. Sostituisci in `package.json` con la distribuzione ufficiale:
  `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`
  ed esegui di nuovo i test di import.
- Rimuovi dalle dipendenze ciò che non è usato: `@google/genai`, `express`, `@types/express`, `dotenv`, `motion`, `esbuild`, `autoprefixer` (verifica prima con `grep -rn "<nome>" src`). `esbuild@^0.25` è anche la causa del fallimento di `npm install` (conflitto con Vite 8).

### 5.6 Dati personali nel codice sorgente
Il repository è **pubblico**. `src/data/initialData.ts` contiene nomi, ruoli, telefoni ed email dello staff, l'email personale del proprietario, codice fiscale e indirizzo dell'associazione. Sostituisci con valori **neutri e vuoti** (profilo vuoto, nessuno staff, nessun evento precaricato). I dati reali di Apuacamp sono già nel database su Drive e non vengono toccati. Fai lo stesso nei test (`finance.test.ts`: usa nomi di fantasia).

### Criteri di accettazione (Fase 5)
`grep -rn "auth/drive'" src` non trova nulla; `npm install` funziona; i test di import Excel passano con la nuova `xlsx`.

---

## FASE 6 — Build, prestazioni, qualità del codice, test

### 6.1 Progetto
- `package.json`: `name` → `gestionale-asd`; aggiungi script:
  ```json
  "typecheck": "tsc --noEmit",
  "test": "tsx --test src/utils/*.test.ts",
  "check": "npm run typecheck && npm run test && npm run build"
  ```
  (lascia `lint` come alias di `typecheck` per compatibilità).
- `tsconfig.json`: aggiungi `"strict": true` (il codice lo supera già), `"noUnusedLocals": true`, `"noUnusedParameters": true`; correggi i 4 import inutilizzati (`GrantsView.tsx`: `Calendar`, `Clock`; `PageGuideBanner.tsx`: `ChevronDown`, `ChevronUp`).
- `vite.config.ts`: usa `import.meta.dirname` invece di `__dirname`.
- Aggiungi una GitHub Action `.github/workflows/check.yml` che su ogni push esegue `bun install --frozen-lockfile` e `npm run check`.
- Aggiungi un file `LICENSE` (scelta del proprietario; proposta: EUPL-1.2 o AGPL-3.0, che obbligano chi modifica e ridistribuisce a condividere le modifiche).

### 6.2 Prestazioni (1.000 soci, migliaia di movimenti)
- L'autosave (`App.tsx`, effetto su `[appState, googleUserEmail]`) trasforma lo stato in JSON a ogni render e lo scrive 3 volte. Calcola il JSON **una volta**, solo dentro il debounce, e senza indentazione (`JSON.stringify(state)`); usa l'indentazione solo per i file scaricati dall'utente.
- `generateSystemNotifications(...)` in `App.tsx` è calcolata a ogni render: avvolgila in `useMemo` (con data di riferimento aggiornata una volta al minuto).
- **Immagini nel database:** `stampImageDataUrl`, `signatureImageDataUrl`, `logoImageDataUrl` e soprattutto `backgroundRawPdfDataUrl` (PDF originale dello sfondo tessera, `DigitalMemberCardModal.tsx`) gonfiano il JSON. Non memorizzare `backgroundRawPdfDataUrl` (basta l'anteprima JPEG già generata); comprimi le immagini a max 800 px / 200 KB (`compressImageFileToDataUrl` esiste già).
- **Archivi annuali:** salva ogni anno chiuso come file separato su Drive (`archivio_<anno>.json` in `06_Archivio_Annualita_Storiche`) e tieni nello stato solo il riepilogo + `driveFileId`. Con una migrazione: sposta gli archivi esistenti (solo dopo upload riuscito).
- **Suddivisione del bundle** (oggi un unico file da 1,6 MB): carica le viste con `React.lazy` + `Suspense` e importa `xlsx` dinamicamente (`await import('xlsx')`) solo quando serve.
- `googleWorkspace.ts`: gli intervalli fissi `A1:Z1000` / `A1:Z2000` vanno sostituiti con il nome del foglio intero (`'NomeFoglio'`) sia in lettura sia in cancellazione; le risposte dei Google Form vanno paginate (`pageToken`).
- `syncAccountingGoogleSheet`: oggi qualsiasi errore (anche di rete) crea **un nuovo foglio**. Crea un nuovo foglio solo se l'errore è 404 (file inesistente) o il file è nel cestino; negli altri casi mostra l'errore. Se mancano delle schede, creale (`addSheet` via `spreadsheets:batchUpdate`) invece di ignorarle.

### 6.3 Struttura dei componenti
Componenti troppo grandi: `EventsView.tsx` (3.103 righe), `MembersView.tsx` (2.599), `ReceiptConfigView.tsx` (2.585), `ReceiptModal.tsx` (2.110), `formAndReceiptTemplates.ts` (2.134), `App.tsx` (1.525).
**Non fare una riscrittura totale.** Ogni volta che lavori su uno di questi file per le fasi precedenti, estrai:
- i modali in file separati (`components/events/BookingModal.tsx`, ...);
- la logica di form in hook (`useBookingForm`), con `useReducer` invece di decine di `useState`;
- da `App.tsx`: la sincronizzazione in `hooks/useDriveSync.ts`, undo/redo in `hooks/useUndoRedo.ts`, gli handler di dominio in `state/actions.ts` (funzioni pure `(state, payload) => state`, testabili).

### 6.4 Test
Oltre ai test indicati nelle fasi, dividi `finance.test.ts` in file per area (`sync.test.ts`, `dates.test.ts`, `receipts.test.ts`, `staff.test.ts`, `migrations.test.ts`, ...). Obiettivo: ogni funzione in `src/utils/` usata per soldi, date, ricevute o sincronizzazione ha almeno un test.

---

## FASE 7 — Generalizzazione per altre associazioni

Obiettivo: un'altra associazione (anche non US ACLI, anche con soci adulti) deve poter usare la stessa app pubblicata, con il proprio account Google, senza vedere nulla di Apuacamp.

### 7.1 Configurazione guidata al primo avvio
Se dopo il login non esiste un database (né su Drive né in locale per quell'account) mostra una procedura in 3–4 passi: dati dell'associazione (nome, forma giuridica, CF, sede, presidente, email, IBAN), ente di affiliazione (testo libero con suggerimenti: US ACLI, CSEN, UISP, AICS, ASI, OPES, CSI, Federazione...), tipologie di tessera, categorie di cassa ed eventi (pre-compilate con valori generici modificabili). Genera `associationId`.

### 7.2 Valori oggi fissati nel codice → configurazione nel profilo
Con valori predefiniti **uguali a quelli attuali** per non cambiare nulla ad Apuacamp (la migrazione li scrive nel profilo esistente):

| Oggi (tipo fisso) | Diventa |
|---|---|
| `InsuranceType = 'Base' \| 'Summer' \| 'Gold' \| 'Platinum'` | `profile.cardTypes: { id, label, defaultPrice?, color? }[]`; `Member.insuranceType: string` (id) |
| `AgeGroup = '3-6' \| '6-11' \| '11-14'` | `profile.ageGroups: { id, label, minAge?, maxAge? }[]` |
| `CashCategory` (include `SummerCamp`, `Selva`) | `profile.cashCategories: { id, label, kind: 'entrata' \| 'uscita' \| 'entrambe' }[]` |
| `EventItem.category` (`rifugio`, `selva`, ...) | `profile.eventCategories: { id, label, cashCategoryId }[]` |
| Scadenze fisse in `criticalDeadlines.ts` | `profile.deadlineTemplates: { id, title, month, day, recurrence, enabled }[]` con un preset "ASD generica" e uno "US ACLI" |
| 66 occorrenze del testo "US ACLI" nell'interfaccia | `profile.affiliation` (es. "Tessera {ente}") |

Mantieni i valori attuali come **id** (`'Base'`, `'SummerCamp'`, ...) così i dati esistenti restano validi senza conversione. Le funzioni `normalizeInsuranceType`, `normalizeAgeGroup`, `normalizeCashCategory` (`csvExcelImporter.ts`) devono cercare tra le voci configurate (per id e per etichetta) prima di usare le parole chiave attuali.

### 7.3 Soci adulti
Aggiungi `Member.isMinor?: boolean` (default `true` per i dati esistenti). Se `false`: i campi genitore non sono obbligatori e documenti/email usano il nome del socio. Etichette "Bimbo/a" → "Socio/Partecipante" quando l'associazione dichiara di avere soci adulti.

### 7.4 Rimuovere il marchio Apuacamp dai dati delle altre associazioni
- Nomi file: `Backup_Apuacamp_*`, `Flusso_Cassa_Apuacamp_*`, `Anagrafica_Soci_Apuacamp_*`, `Archivio_Annualita_*_Apuacamp.xlsx`, `Gestionale_Apuacamp_*` → usa il nome dell'associazione (ripulito) da `profile.name`.
- Valori di ripiego `'Apuacamp A.S.D.'` / `'APUACAMP A.S.D.'` in `digitalCard.ts`, `formAndReceiptTemplates.ts`, `export.ts`, `Header.tsx`, `Sidebar.tsx` → stringa vuota o "Associazione".
- Testi esempio (`'Maglietta Apuacamp'`, `'Contributo Gadget Associativo Apuacamp'`, scheda bandi "APUACAMP A.S.D." in `GrantsView.tsx`) → generici o basati su `profile.name`.
- Attribuzione "Ideato da ASD Apuacamp": **decisione del proprietario**. Proposta predefinita: resta visibile nell'app (barra laterale), ma **non** compare nei documenti generati per conto di altre associazioni (ricevute, tessere, PDF) salvo che l'associazione la attivi.

### 7.5 Pagine informative richieste da Google
Aggiungi due pagine statiche raggiungibili senza login: `/privacy` (cosa fa l'app con i dati: tutto resta nel Google Drive e nel computer dell'associazione, nessun server terzo li riceve; quali permessi Google usa e perché) e `/termini`. Servono per configurare la schermata di consenso OAuth.

---

## FASE 8 — Aggiornare la documentazione

Riscrivi `ARCHITETTURA_E_GUIDA_COMPLETA_AI.md` affinché descriva il codice **reale** dopo le modifiche. Errori presenti oggi da correggere:
- File citati ma inesistenti: `src/types.ts` (è `src/types/index.ts`), `utils/accountingSpreadsheet.ts`, `utils/pdfReceiptTemplates.ts`, `MembershipCardsView.tsx`, `DigitalCardDesignerModal.tsx`, `AnnualArchiveModal.tsx`, `GoogleWorkspaceModal.tsx`, `QuickGuideModal.tsx`. Mancano invece `CardsView`, `BackupView`, `ReceiptConfigView`, `DigitalMemberCardModal`, `MemberDataConsentModal`, `PageGuideBanner`, `formAndReceiptTemplates.ts`, `pageGuides.ts`, `localFileStorage.ts`.
- `AppState` è definito in `src/utils/storage.ts`; il campo è `archivedYears` (non `annualArchives`); `ignoredDuplicateSignatures` sta in `profile`.
- Nomi cartelle Drive reali: `04_Verbali_Assemblee_e_Governance`, `06_Archivio_Annualita_Storiche`.
- Login: Firebase Auth (non Google Identity Services); permessi reali (dopo la Fase 5: `drive.file`).
- Scadenza mensile: nel codice è "Comunicazione INPS & RASD Lavoro Sportivo (fine mese)", non "F24 il 16".
- Soglia staff: 5.000 € è contributiva INPS, 15.000 € IRPEF.
- Numero test e comando (`npm test`).
- Nuove sezioni: sincronizzazione con controllo di versione e risoluzione conflitti, backup automatici, migrazioni (`schemaVersion` e tabella delle versioni), registro ricevute, configurazione per altre associazioni.

Aggiorna anche le guide in `src/utils/pageGuides.ts` dove il comportamento è cambiato.

---

## Appendice A — Checklist rapida per l'AI (spuntare a fine lavoro)

- [ ] F1: helper `googleFetch`, `appProperties` + `associationId`, controllo `version`, dialogo conflitti, coda salvataggi, cartelle senza duplicati, backup automatici, IndexedDB per account, regola anti-fuga, Web Locks, banner token.
- [ ] F2: `newId`, `todayIso` ovunque, date ISO, `schemaVersion` + migrazioni idempotenti con fixture, updater puri, un solo snapshot di annullamento per azione, StrictMode.
- [ ] F3: registro `receipts`, numerazione progressiva, numero consumato solo all'emissione, avvisi 730, firma grafica etichettata.
- [ ] F4: ID di collegamento sui movimenti, staff per `staffId`, rimborsi esclusi, soglie e avvisi, conti di pagamento configurabili.
- [ ] F5: `drive.file`, link Foglio Google incollabile, cancellazione dati al logout, `RAW` + sanificazione CSV, header email puliti, `xlsx` 0.20.3, dipendenze inutili rimosse, dati personali rimossi dal sorgente.
- [ ] F6: script `check`, `strict`, CI, LICENSE, JSON calcolato una volta, `useMemo` notifiche, immagini leggere, archivi su file separati, lazy loading, gestione errori fogli.
- [ ] F7: procedura guidata, tassonomie configurabili, soci adulti, niente "Apuacamp" nei dati delle altre associazioni, pagine privacy/termini.
- [ ] F8: documentazione allineata al codice.
