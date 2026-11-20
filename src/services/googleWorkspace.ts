import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  AppState,
  DriveBackupEntry,
  DriveBackupReason,
  DriveDbCandidate,
  GoogleFormFieldConfig,
} from '../types';
import {
  buildGoogleFormBatchRequests,
  getEffectiveFormFieldsForArea,
} from '../utils/formAndReceiptTemplates';
import { deriveAssociationId, hydrateAppState } from '../utils/storage';
import {
  sanitizeEmailHeader,
  isValidEmailAddress,
  encodeMimeAttachmentFilename,
  sanitizeSpreadsheetRows,
} from '../utils/sanitize';

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

const SESSION_TOKEN_KEY = 'apuacamp_google_oauth_token';
const SESSION_EXPIRY_KEY = 'apuacamp_google_oauth_expiry';

function loadSessionAccessToken(): string | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const token = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
    const expiry = Number(window.sessionStorage.getItem(SESSION_EXPIRY_KEY) || '0');
    if (token && expiry > Date.now()) {
      return token;
    }
    window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
    window.sessionStorage.removeItem(SESSION_EXPIRY_KEY);
  } catch {
    // Ignore storage errors
  }
  return null;
}

function saveSessionAccessToken(token: string | null) {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (token) {
      // Google OAuth access tokens are valid for 3600s; keep for 52 minutes
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      window.sessionStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + 52 * 60 * 1000));
    } else {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      window.sessionStorage.removeItem(SESSION_EXPIRY_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

let isSigningIn = false;
let cachedAccessToken: string | null = loadSessionAccessToken();

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      const activeToken = cachedAccessToken || loadSessionAccessToken();
      if (activeToken) {
        cachedAccessToken = activeToken;
        if (onAuthSuccess) onAuthSuccess(user, activeToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      saveSessionAccessToken(null);
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (
  forceConsentPrompt: boolean = false
): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    provider.setCustomParameters(
      forceConsentPrompt
        ? { prompt: 'consent select_account' }
        : { prompt: 'select_account' }
    );
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Impossibile ottenere il token di accesso da Google Workspace.');
    }

    cachedAccessToken = credential.accessToken;
    saveSessionAccessToken(cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) return cachedAccessToken;
  const restored = loadSessionAccessToken();
  if (restored) {
    cachedAccessToken = restored;
    return restored;
  }
  return null;
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  saveSessionAccessToken(null);
};

// ============================================================================
// GOOGLE DRIVE API HELPERS & "GESTIONALE ASD" CATEGORIZED FOLDER ARCHITECTURE
// ============================================================================

export const DRIVE_ROOT_FOLDER_NAME = 'Gestionale ASD';

export type DriveCategoryKey =
  | 'anagrafica_soci'
  | 'contabilita_cassa'
  | 'eventi_iscritti'
  | 'verbali_governance'
  | 'bandi_progetti'
  | 'archivio_annualita'
  | 'backup_sistema';

export const DRIVE_CATEGORY_FOLDERS: Record<
  DriveCategoryKey,
  { folderName: string; label: string; description: string }
> = {
  anagrafica_soci: {
    folderName: '01_Anagrafica_Soci_e_Tessere',
    label: 'Anagrafica Soci & Tessere',
    description: 'Foglio Google Anagrafica Soci, Modulo Google Tesseramento ed elenchi US ACLI',
  },
  contabilita_cassa: {
    folderName: '02_Contabilita_e_Cassa',
    label: 'Contabilità, Libro Cassa & Fatture',
    description: 'Foglio Google Contabilità, ricevute, preventivi e giustificativi di spesa',
  },
  eventi_iscritti: {
    folderName: '03_Eventi_e_Iscritti',
    label: 'Eventi, Campi & Moduli Iscrizione',
    description: 'Moduli Google eventi, liste partecipanti e schede briefing sicurezza',
  },
  verbali_governance: {
    folderName: '04_Verbali_Assemblee_e_Governance',
    label: 'Verbali Assemblee, Nomine & Safeguarding',
    description: 'Verbali approvazione rendiconto, direttivo, nomine Safeguarding e RSPP',
  },
  bandi_progetti: {
    folderName: '05_Bandi_e_Progetti',
    label: 'Bandi, Progetti & Rendicontazioni',
    description: 'Avvisi pubblici, formulari progetti, allegati e documenti di rendicontazione bandi',
  },
  archivio_annualita: {
    folderName: '06_Archivio_Annualita_Storiche',
    label: 'Archivio Annualità Chiuse',
    description: 'Bilanci, libri cassa e archivi storici salvati al passaggio al nuovo anno sportivo',
  },
  backup_sistema: {
    folderName: '07_Backup_Sistema',
    label: 'Backup Database Gestionale',
    description: 'File JSON di backup completo del gestionale associato al profilo',
  },
};

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  version?: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
}

export async function listDriveFiles(query?: string): Promise<DriveFileItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const q = query || 'trashed = false';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,mimeType,version,webViewLink,createdTime,modifiedTime,size,parents,appProperties)&orderBy=modifiedTime desc&pageSize=100`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    cachedAccessToken = null;
    saveSessionAccessToken(null);
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Errore Google Drive (${res.status})`);
  }
  const data = await res.json();
  return data.files || [];
}

// Module-level locks to prevent concurrent calls from creating duplicate folders on Google Drive
const folderCreationLocks = new Map<string, Promise<DriveFileItem>>();
let structureCreationPromise: Promise<{
  rootFolder: DriveFileItem;
  subfolders: Record<DriveCategoryKey, DriveFileItem>;
}> | null = null;

export async function findOrCreateDriveFolder(
  folderName: string,
  parentFolderId?: string
): Promise<DriveFileItem> {
  const lockKey = `${parentFolderId || 'root'}::${folderName}`;
  const inFlight = folderCreationLocks.get(lockKey);
  if (inFlight) {
    return inFlight;
  }

  const creationTask = (async (): Promise<DriveFileItem> => {
    const token = await getAccessToken();
    if (!token) throw new Error('AUTH_REQUIRED');

    const safeName = folderName.replace(/'/g, "\\'");
    const parentClause = parentFolderId ? ` and '${parentFolderId}' in parents` : '';
    const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}'${parentClause} and trashed = false`;
    const existing = await listDriveFiles(q);
    if (existing.length > 0) {
      return existing[0];
    }

    const bodyPayload: Record<string, any> = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) {
      bodyPayload.parents = [parentFolderId];
    }

    const res = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,parents',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      }
    );

    if (res.status === 401) {
      cachedAccessToken = null;
      saveSessionAccessToken(null);
      throw new Error('AUTH_REQUIRED');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Impossibile creare la cartella su Google Drive');
    }
    return await res.json();
  })();

  folderCreationLocks.set(lockKey, creationTask);
  try {
    return await creationTask;
  } finally {
    folderCreationLocks.delete(lockKey);
  }
}

/**
 * Ensures the root folder "Gestionale ASD" and the requested category subfolder exist on Google Drive
 */
export async function getOrCreateDriveCategoryFolder(
  category: DriveCategoryKey
): Promise<{ rootFolder: DriveFileItem; categoryFolder: DriveFileItem }> {
  const rootFolder = await findOrCreateDriveFolder(DRIVE_ROOT_FOLDER_NAME);
  const subName = DRIVE_CATEGORY_FOLDERS[category].folderName;
  const categoryFolder = await findOrCreateDriveFolder(subName, rootFolder.id);
  return { rootFolder, categoryFolder };
}

/**
 * Ensures the entire "Gestionale ASD" folder tree (all 7 category folders) is created on Google Drive.
 * Uses a module-level promise lock so concurrent calls never duplicate folders.
 */
export async function ensureGestionaleDriveStructure(): Promise<{
  rootFolder: DriveFileItem;
  subfolders: Record<DriveCategoryKey, DriveFileItem>;
}> {
  if (structureCreationPromise) {
    return structureCreationPromise;
  }

  structureCreationPromise = (async () => {
    const rootFolder = await findOrCreateDriveFolder(DRIVE_ROOT_FOLDER_NAME);
    const keys = Object.keys(DRIVE_CATEGORY_FOLDERS) as DriveCategoryKey[];
    const results: Array<readonly [DriveCategoryKey, DriveFileItem]> = [];
    // Execute sequentially under lock to avoid race conditions on Drive API
    for (const k of keys) {
      const folder = await findOrCreateDriveFolder(
        DRIVE_CATEGORY_FOLDERS[k].folderName,
        rootFolder.id
      );
      results.push([k, folder] as const);
    }
    const subfolders = Object.fromEntries(results) as Record<DriveCategoryKey, DriveFileItem>;
    return { rootFolder, subfolders };
  })();

  try {
    return await structureCreationPromise;
  } finally {
    structureCreationPromise = null;
  }
}

/**
 * Patches custom appProperties on a Drive file without modifying its media content,
 * returning the updated file metadata (including the incremented `version`).
 */
export async function patchDriveFileAppProperties(
  fileId: string,
  appProperties: Record<string, string>,
  options?: { fetchImpl?: typeof fetch; accessTokenOverride?: string }
): Promise<{ id: string; version?: string; modifiedTime?: string; appProperties?: Record<string, string> } | null> {
  const token = options?.accessTokenOverride || (await getAccessToken());
  if (!token) return null;
  const fetchFn = options?.fetchImpl || fetch;
  try {
    const safeId = encodeURIComponent(fileId.trim());
    const res = await fetchFn(
      `https://www.googleapis.com/drive/v3/files/${safeId}?fields=id,version,modifiedTime,appProperties`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ appProperties }),
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Impossibile aggiornare appProperties sul file Drive:', err);
    return null;
  }
}

/**
 * Lightweight Drive metadata check (`fields=id,version,modifiedTime,trashed,appProperties`)
 * used before writing and during periodic multi-device polling.
 */
export async function checkDriveFileVersion(
  fileId: string,
  options?: { fetchImpl?: typeof fetch; accessTokenOverride?: string }
): Promise<{
  id: string;
  version?: string;
  modifiedTime?: string;
  trashed?: boolean;
  appProperties?: Record<string, string>;
} | null> {
  const token = options?.accessTokenOverride || (await getAccessToken());
  if (!token) return null;
  const fetchFn = options?.fetchImpl || fetch;
  const safeId = encodeURIComponent(fileId.trim());
  const res = await fetchFn(
    `https://www.googleapis.com/drive/v3/files/${safeId}?fields=id,version,modifiedTime,trashed,appProperties`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (res.status === 401) {
    if (!options?.accessTokenOverride) {
      cachedAccessToken = null;
      saveSessionAccessToken(null);
    }
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) return null;
  return await res.json();
}

/**
 * Moves a newly created Google Sheet or Google Form into a specific Drive folder
 */
export async function moveFileToDriveFolder(fileId: string, targetFolderId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) return;
  try {
    const safeId = encodeURIComponent(fileId.trim());
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${safeId}?addParents=${encodeURIComponent(
        targetFolderId
      )}&fields=id,parents`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch (err) {
    console.warn('Impossibile spostare il file nella sottocartella Drive:', err);
  }
}

export async function uploadFileToDrive(params: {
  name: string;
  content: string | Blob;
  mimeType: string;
  folderId?: string;
  category?: DriveCategoryKey;
  existingFileId?: string;
  appProperties?: Record<string, string>;
  fetchImpl?: typeof fetch;
  accessTokenOverride?: string;
}): Promise<DriveFileItem> {
  const token = params.accessTokenOverride || (await getAccessToken());
  if (!token) throw new Error('AUTH_REQUIRED');
  const fetchFn = params.fetchImpl || fetch;

  const contentType = params.mimeType || 'application/octet-stream';
  const fileBlob =
    typeof params.content === 'string'
      ? new Blob([params.content], { type: contentType })
      : params.content;

  // 1. If an existingFileId is provided, update its media content directly via uploadType=media
  if (params.existingFileId) {
    const safeExistingId = encodeURIComponent(params.existingFileId.trim());
    const patchRes = await fetchFn(
      `https://www.googleapis.com/upload/drive/v3/files/${safeExistingId}?uploadType=media&fields=id,name,mimeType,version,webViewLink,createdTime,modifiedTime,appProperties`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': contentType,
        },
        body: fileBlob,
      }
    );

    if (patchRes.status === 401) {
      if (!params.accessTokenOverride) {
        cachedAccessToken = null;
        saveSessionAccessToken(null);
      }
      throw new Error('AUTH_REQUIRED');
    }
    if (patchRes.ok) {
      const updatedFile: DriveFileItem = await patchRes.json();
      if (params.appProperties) {
        const needsPropertyUpdate = Object.entries(params.appProperties).some(
          ([k, v]) => updatedFile.appProperties?.[k] !== v
        );
        if (needsPropertyUpdate) {
          const patched = await patchDriveFileAppProperties(
            updatedFile.id,
            params.appProperties,
            { fetchImpl: fetchFn, accessTokenOverride: token }
          );
          if (patched) {
            updatedFile.version = patched.version || updatedFile.version;
            updatedFile.modifiedTime = patched.modifiedTime || updatedFile.modifiedTime;
            updatedFile.appProperties = patched.appProperties || updatedFile.appProperties;
          }
        }
      }
      return updatedFile;
    }

    // CRITICAL (Blocco 1.2): Only fall through to file creation if the file was deleted on Drive (404).
    // On any other error (403, 429, 500, 503, etc.), throw so SaveQueue retries on the same fileId.
    if (patchRes.status !== 404) {
      const err = await patchRes.json().catch(() => ({}));
      throw new Error(
        err?.error?.message || `Errore aggiornamento file Drive (${patchRes.status})`
      );
    }
  }

  // 2. Resolve target folder inside "Gestionale ASD"
  let targetFolderId = params.folderId;
  if (!targetFolderId && params.category && !params.fetchImpl) {
    const { categoryFolder } = await getOrCreateDriveCategoryFolder(params.category);
    targetFolderId = categoryFolder.id;
  }

  // 3. Create the file metadata inside the target folder using pure JSON POST
  const metadata: Record<string, any> = {
    name: params.name,
    mimeType: contentType,
  };
  if (targetFolderId) {
    metadata.parents = [targetFolderId];
  }
  if (params.appProperties) {
    metadata.appProperties = params.appProperties;
  }

  const createRes = await fetchFn(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,version,webViewLink,createdTime,modifiedTime,parents,appProperties',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    }
  );

  if (createRes.status === 401) {
    if (!params.accessTokenOverride) {
      cachedAccessToken = null;
      saveSessionAccessToken(null);
    }
    throw new Error('AUTH_REQUIRED');
  }
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Errore nella creazione del file su Google Drive');
  }

  const createdMeta: DriveFileItem = await createRes.json();

  // 4. Upload the file content via PATCH ?uploadType=media
  const mediaRes = await fetchFn(
    `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
      createdMeta.id
    )}?uploadType=media&fields=id,name,mimeType,version,webViewLink,createdTime,modifiedTime,appProperties`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: fileBlob,
    }
  );

  if (mediaRes.status === 401) {
    if (!params.accessTokenOverride) {
      cachedAccessToken = null;
      saveSessionAccessToken(null);
    }
    throw new Error('AUTH_REQUIRED');
  }
  if (!mediaRes.ok) {
    const err = await mediaRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Errore durante il caricamento dei dati su Google Drive');
  }
  return await mediaRes.json();
}

export async function downloadDriveFileText(fileId: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const safeId = encodeURIComponent(fileId.trim());
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${safeId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    cachedAccessToken = null;
    saveSessionAccessToken(null);
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    throw new Error('Impossibile scaricare il file privato da Google Drive');
  }
  return await res.text();
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const safeId = encodeURIComponent(fileId.trim());
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${safeId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    cachedAccessToken = null;
    saveSessionAccessToken(null);
    throw new Error('AUTH_REQUIRED');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Impossibile eliminare il file da Google Drive');
  }
}

export const LIVE_DB_FILENAME = 'database_gestionale_asd.json';

export interface LiveDatabaseLoadResult {
  fileId: string;
  content: string;
  driveVersion?: string;
  modifiedTime?: string;
  webViewLink?: string;
  candidates?: DriveDbCandidate[];
}

/**
 * Loads a specific database file by its explicit Google Drive fileId and tags it with appProperties
 * if not yet tagged (awaited so `driveVersion` reflects any metadata update).
 */
export async function loadLiveDatabaseFileById(
  fileId: string,
  associationId = 'asd-apuacamp'
): Promise<LiveDatabaseLoadResult | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const content = await downloadDriveFileText(fileId);
  if (!content || !content.trim().startsWith('{')) {
    throw new Error('Il file selezionato su Google Drive non è un database JSON valido.');
  }

  let meta = await checkDriveFileVersion(fileId);
  let effectiveVersion = meta?.version;
  let effectiveModifiedTime = meta?.modifiedTime;

  if (meta?.appProperties?.gestionaleAsdDb !== '1') {
    const patched = await patchDriveFileAppProperties(fileId, {
      gestionaleAsdDb: '1',
      associationId,
    });
    if (patched) {
      effectiveVersion = patched.version || effectiveVersion;
      effectiveModifiedTime = patched.modifiedTime || effectiveModifiedTime;
    }
  }

  return {
    fileId,
    content,
    driveVersion: effectiveVersion,
    modifiedTime: effectiveModifiedTime,
  };
}

/**
 * Loads the live JSON database from the connected account's Google Drive
 * using narrowed search:
 * 1. Inside known backup/root folder if provided.
 * 2. Via appProperties { gestionaleAsdDb: '1' }.
 * 3. Legacy fallback inside "Gestionale ASD" folders (and auto-tags found legacy file with appProperties).
 * If multiple distinct candidate files exist on Drive, returns `candidates` so the user can choose.
 */
export async function loadLiveDatabaseFromDrive(options?: {
  knownFolderId?: string;
  knownRootFolderId?: string;
  associationId?: string;
}): Promise<LiveDatabaseLoadResult | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const assocId = options?.associationId || 'asd-apuacamp';
  let matchedFiles: DriveFileItem[] = [];

  // 1. Narrow search inside known folder if available
  if (options?.knownFolderId) {
    matchedFiles = await listDriveFiles(
      `'${options.knownFolderId}' in parents and name = '${LIVE_DB_FILENAME}' and trashed = false`
    );
  }

  // 2. Search via dedicated appProperties tag
  if (matchedFiles.length === 0) {
    matchedFiles = await listDriveFiles(
      `appProperties has { key='gestionaleAsdDb' and value='1' } and trashed = false`
    );
  }

  // 3. Legacy fallback: search inside "Gestionale ASD" folders first, then by exact filename
  if (matchedFiles.length === 0) {
    const rootFolders = await listDriveFiles(
      `mimeType = 'application/vnd.google-apps.folder' and name = '${DRIVE_ROOT_FOLDER_NAME}' and trashed = false`
    );
    const folderIdsToSearch: string[] = [];
    for (const rf of rootFolders) {
      folderIdsToSearch.push(rf.id);
      const subBackupFolders = await listDriveFiles(
        `mimeType = 'application/vnd.google-apps.folder' and '${rf.id}' in parents and name = '${DRIVE_CATEGORY_FOLDERS.backup_sistema.folderName}' and trashed = false`
      );
      for (const sf of subBackupFolders) {
        folderIdsToSearch.push(sf.id);
      }
    }

    if (folderIdsToSearch.length > 0) {
      const parentClauses = folderIdsToSearch.map((id) => `'${id}' in parents`).join(' or ');
      matchedFiles = await listDriveFiles(
        `(${parentClauses}) and name = '${LIVE_DB_FILENAME}' and trashed = false`
      );
    }

    // Broad legacy fallback if the file was saved outside the standard folder tree
    if (matchedFiles.length === 0) {
      matchedFiles = await listDriveFiles(
        `name = '${LIVE_DB_FILENAME}' and trashed = false`
      );
    }
  }

  // Deduplicate by file id
  const uniqueFilesMap = new Map<string, DriveFileItem>();
  for (const f of matchedFiles) {
    if (!uniqueFilesMap.has(f.id)) {
      uniqueFilesMap.set(f.id, f);
    }
  }
  const uniqueFiles = Array.from(uniqueFilesMap.values());

  const candidates: DriveDbCandidate[] = uniqueFiles.map((f) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
    parents: f.parents,
  }));

  for (const file of uniqueFiles) {
    try {
      const content = await downloadDriveFileText(file.id);
      if (content && content.trim().startsWith('{')) {
        let effectiveDriveVersion = file.version;
        let effectiveModifiedTime = file.modifiedTime;
        // Auto-tag legacy file with appProperties if missing (awaited so driveVersion is accurate)
        if (file.appProperties?.gestionaleAsdDb !== '1') {
          const patched = await patchDriveFileAppProperties(file.id, {
            gestionaleAsdDb: '1',
            associationId: assocId,
          });
          if (patched) {
            effectiveDriveVersion = patched.version || effectiveDriveVersion;
            effectiveModifiedTime = patched.modifiedTime || effectiveModifiedTime;
          }
        }
        return {
          fileId: file.id,
          content,
          driveVersion: effectiveDriveVersion,
          modifiedTime: effectiveModifiedTime,
          webViewLink: file.webViewLink,
          candidates: candidates.length > 1 ? candidates : undefined,
        };
      }
    } catch {
      // Try next file if any
    }
  }

  // 4. Legacy fallback to any previous Backup_Apuacamp*.json or Database_ASD*.json inside Gestionale ASD
  const fallbackFiles = await listDriveFiles(
    "(name contains 'Backup_Apuacamp' or name contains 'Database_ASD') and trashed = false"
  );
  for (const file of fallbackFiles) {
    try {
      const content = await downloadDriveFileText(file.id);
      if (content && content.trim().startsWith('{')) {
        return {
          fileId: '', // Will create the canonical LIVE_DB_FILENAME on next save
          content,
          modifiedTime: file.modifiedTime,
          webViewLink: file.webViewLink,
        };
      }
    } catch {
      // Try next fallback file
    }
  }

  return null;
}

/**
 * Saves/updates the live JSON database in real time inside
 * "Gestionale ASD / 07_Backup_Sistema / database_gestionale_asd.json" on the user's Google Drive,
 * tagging it with `appProperties: { gestionaleAsdDb: '1', associationId }`.
 * Performs an optimistic concurrency check on Drive's native `version` metadata before writing.
 */
export async function saveLiveDatabaseToDrive(
  jsonContent: string,
  knownFileId?: string,
  options?: {
    associationId?: string;
    expectedDriveVersion?: string | null;
    fetchImpl?: typeof fetch;
    accessTokenOverride?: string;
  }
): Promise<DriveFileItem> {
  const token = options?.accessTokenOverride || (await getAccessToken());
  if (!token) throw new Error('AUTH_REQUIRED');

  const assocId = options?.associationId || 'asd-apuacamp';
  let targetFileId = knownFileId;

  if (!targetFileId && !options?.fetchImpl) {
    const byProp = await listDriveFiles(
      `appProperties has { key='gestionaleAsdDb' and value='1' } and trashed = false`
    );
    if (byProp.length > 0) {
      targetFileId = byProp[0].id;
    } else {
      const byName = await listDriveFiles(
        `name = '${LIVE_DB_FILENAME}' and trashed = false`
      );
      if (byName.length > 0) {
        targetFileId = byName[0].id;
      }
    }
  }

  // Blocco 1.1: Pre-write optimistic concurrency check against remote Drive file version
  if (
    targetFileId &&
    options?.expectedDriveVersion !== null &&
    options?.expectedDriveVersion !== undefined &&
    String(options.expectedDriveVersion).trim() !== ''
  ) {
    const remoteMeta = await checkDriveFileVersion(targetFileId, {
      fetchImpl: options?.fetchImpl,
      accessTokenOverride: token,
    });
    if (
      remoteMeta &&
      !remoteMeta.trashed &&
      remoteMeta.version &&
      String(remoteMeta.version).trim() !== String(options.expectedDriveVersion).trim()
    ) {
      throw new Error('REMOTE_CHANGED');
    }
  }

  return await uploadFileToDrive({
    name: LIVE_DB_FILENAME,
    content: jsonContent,
    mimeType: 'application/json',
    category: 'backup_sistema',
    existingFileId: targetFileId || undefined,
    appProperties: {
      gestionaleAsdDb: '1',
      associationId: assocId,
    },
    fetchImpl: options?.fetchImpl,
    accessTokenOverride: token,
  });
}

// ============================================================================
// VERSIONED AUTOMATIC BACKUPS ON GOOGLE DRIVE (Phase 1.6)
// ============================================================================

export const DRIVE_AUTO_BACKUPS_SUBFOLDER_NAME = 'Backup_Automatici';

async function getOrCreateAutoBackupsFolder(): Promise<DriveFileItem> {
  const { categoryFolder } = await getOrCreateDriveCategoryFolder('backup_sistema');
  return await findOrCreateDriveFolder(DRIVE_AUTO_BACKUPS_SUBFOLDER_NAME, categoryFolder.id);
}

/**
 * Creates a timestamped, immutable backup file `backup_<reason>_<timestamp>.json` on Google Drive
 * inside "Gestionale ASD / 07_Backup_Sistema / Backup_Automatici".
 * If reason === 'daily', automatically prunes older daily backups keeping the latest 30.
 */
export async function createDriveBackupSnapshot(
  state: AppState,
  reason: DriveBackupReason
): Promise<DriveBackupEntry> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const backupsFolder = await getOrCreateAutoBackupsFolder();
  const safeTimestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('Z', 'Z');
  const fileName = `backup_${reason}_${safeTimestamp}.json`;
  const assocId = deriveAssociationId(state.profile);
  const versionStr = String(state.version || 1);

  const created = await uploadFileToDrive({
    name: fileName,
    content: JSON.stringify(state, null, 2),
    mimeType: 'application/json',
    folderId: backupsFolder.id,
    appProperties: {
      gestionaleAsdBackup: '1',
      backupReason: reason,
      associationId: assocId,
      version: versionStr,
    },
  });

  if (reason === 'daily') {
    void pruneOldDailyBackups(backupsFolder.id, 30);
  }

  return {
    id: created.id,
    name: created.name,
    createdTime: created.createdTime || created.modifiedTime,
    modifiedTime: created.modifiedTime,
    size: created.size,
    webViewLink: created.webViewLink,
    reason,
    version: state.version || 1,
  };
}

/**
 * Retains the most recent `keepCount` (default 30) daily backups and deletes older daily ones.
 */
export async function pruneOldDailyBackups(
  backupsFolderId?: string,
  keepCount = 30
): Promise<void> {
  try {
    const folderId = backupsFolderId || (await getOrCreateAutoBackupsFolder()).id;
    const dailyFiles = await listDriveFiles(
      `'${folderId}' in parents and appProperties has { key='backupReason' and value='daily' } and trashed = false`
    );
    if (dailyFiles.length <= keepCount) return;

    const toDelete = dailyFiles.slice(keepCount);
    for (const oldFile of toDelete) {
      await deleteDriveFile(oldFile.id).catch(() => {});
    }
  } catch (err) {
    console.warn('Impossibile ripulire i vecchi backup giornalieri su Drive:', err);
  }
}

/**
 * Lists all versioned automatic backups stored on Google Drive, sorted newest first.
 */
export async function listDriveBackups(): Promise<DriveBackupEntry[]> {
  const token = await getAccessToken();
  if (!token) return [];

  const files = await listDriveFiles(
    `appProperties has { key='gestionaleAsdBackup' and value='1' } and trashed = false`
  );

  return files.map((f) => {
    const rawReason = f.appProperties?.backupReason as DriveBackupReason | undefined;
    const rawVersion = Number(f.appProperties?.version || '1');
    return {
      id: f.id,
      name: f.name,
      createdTime: f.createdTime || f.modifiedTime,
      modifiedTime: f.modifiedTime,
      size: f.size,
      webViewLink: f.webViewLink,
      reason: rawReason,
      version: Number.isFinite(rawVersion) ? rawVersion : 1,
    };
  });
}

/**
 * Downloads and hydrates a specific backup file from Google Drive by fileId.
 */
export async function loadDriveBackupById(fileId: string): Promise<AppState> {
  const text = await downloadDriveFileText(fileId);
  const parsed = JSON.parse(text);
  return hydrateAppState(parsed);
}

// ============================================================================
// HYBRID ARCHIVED FISCAL YEARS ON GOOGLE DRIVE (Phase 6.2)
// ============================================================================

/**
 * Saves an ArchivedFiscalYear as a dedicated file `archivio_<year>.json` inside
 * "Gestionale ASD / 06_Archivio_Annualita_Storiche" and returns `{ fileId, webViewLink }`.
 */
export async function saveArchivedYearFileToDrive(
  archivedYear: any,
  associationName?: string
): Promise<{ fileId: string; webViewLink?: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const safeAssoc = (associationName || 'ASD')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const fileName = `archivio_${archivedYear.year}_${safeAssoc || 'ASD'}.json`;

  let existingFileId: string | undefined = archivedYear.driveFileId;
  if (!existingFileId) {
    const existingList = await listDriveFiles(
      `appProperties has { key='gestionaleAsdArchiveYear' and value='${archivedYear.year}' } and trashed = false`
    );
    if (existingList.length > 0) {
      existingFileId = existingList[0].id;
    }
  }

  const uploaded = await uploadFileToDrive({
    name: fileName,
    content: JSON.stringify(archivedYear, null, 2),
    mimeType: 'application/json',
    category: 'archivio_annualita',
    existingFileId,
    appProperties: {
      gestionaleAsdArchiveYear: String(archivedYear.year),
    },
  });

  return {
    fileId: uploaded.id,
    webViewLink: uploaded.webViewLink,
  };
}

/**
 * Loads the full ArchivedFiscalYear snapshot from its separate Google Drive file (`driveFileId`).
 */
export async function loadArchivedYearFileFromDrive(fileId: string): Promise<any> {
  const text = await downloadDriveFileText(fileId);
  return JSON.parse(text);
}

// ============================================================================
// GOOGLE SHEETS API HELPERS
// ============================================================================

export interface SpreadsheetMeta {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: string[];
}

class SpreadsheetApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SpreadsheetApiError';
    this.status = status;
  }
}

function escapeSheetTitleForRange(sheetTitle: string): string {
  return `'${String(sheetTitle || 'Sheet1').replace(/'/g, "''")}'`;
}

async function getDriveFileMetadata(
  fileId: string
): Promise<{ id: string; trashed?: boolean } | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const safeId = encodeURIComponent(fileId.trim());
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${safeId}?fields=id,trashed`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) return null;
  return await res.json();
}

export async function getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMeta> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const safeId = encodeURIComponent(spreadsheetId.trim());
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${safeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new SpreadsheetApiError(
      err?.error?.message || 'Impossibile leggere il foglio Google Sheets',
      res.status
    );
  }
  const data = await res.json();
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Foglio Google',
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
    sheets: (data.sheets || []).map((s: any) => s.properties?.title || 'Sheet1'),
  };
}

export async function readSpreadsheetSheet(
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const safeId = encodeURIComponent(spreadsheetId.trim());
  const safeRange = encodeURIComponent(escapeSheetTitleForRange(sheetName));
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${safeRange}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Errore nella lettura dei dati dal foglio Google');
  }
  const data = await res.json();
  return data.values || [];
}

export async function createAndPopulateSpreadsheet(
  title: string,
  tabs: { sheetTitle: string; rows: (string | number | boolean)[][] }[],
  category: DriveCategoryKey = 'contabilita_cassa'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: tabs.map((t) => ({
        properties: { title: t.sheetTitle },
      })),
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Impossibile creare il foglio Google Sheets');
  }

  const created = await createRes.json();
  const spreadsheetId = created.spreadsheetId;

  // Place inside "Gestionale ASD / <category>"
  try {
    const { categoryFolder } = await getOrCreateDriveCategoryFolder(category);
    await moveFileToDriveFolder(spreadsheetId, categoryFolder.id);
  } catch (e) {
    console.warn('Could not move spreadsheet to category folder:', e);
  }

  const dataPayload = tabs.map((t) => ({
    range: `${escapeSheetTitleForRange(t.sheetTitle)}!A1`,
    majorDimension: 'ROWS',
    values: sanitizeSpreadsheetRows(t.rows),
  }));

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: dataPayload,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Errore nel popolamento del foglio Google Sheets');
  }

  return {
    spreadsheetId,
    spreadsheetUrl:
      created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

/**
 * Overwrites/updates the first tab of an existing Google Sheet with the latest Anagrafica Soci rows
 */
export async function updateMembersGoogleSheet(
  spreadsheetId: string,
  rows: (string | number | boolean)[][]
): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const meta = await getSpreadsheetMetadata(spreadsheetId);
  const firstSheet = meta.sheets[0] || 'Anagrafica_Soci';
  const safeId = encodeURIComponent(spreadsheetId.trim());
  const wholeSheetRange = encodeURIComponent(escapeSheetTitleForRange(firstSheet));

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${wholeSheetRange}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${encodeURIComponent(
      `${escapeSheetTitleForRange(firstSheet)}!A1`
    )}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: sanitizeSpreadsheetRows(rows),
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || "Errore nell'aggiornamento del Foglio Google Soci");
  }

  return meta.spreadsheetUrl;
}

/**
 * Creates or updates the official Accounting Google Sheet inside "Gestionale ASD / 02_Contabilita_e_Cassa".
 * Only creates a new spreadsheet if `existingSpreadsheetId` is missing, returns 404, or is in the Drive trash.
 * Automatically adds any missing tabs via `addSheet`.
 */
export async function syncAccountingGoogleSheet(params: {
  existingSpreadsheetId?: string;
  title: string;
  tabs: { sheetTitle: string; rows: (string | number | boolean)[][] }[];
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  if (params.existingSpreadsheetId) {
    let shouldCreateNew = false;
    let meta: SpreadsheetMeta | null = null;

    // 1. Check if file exists on Drive and whether it is in trash
    const driveMeta = await getDriveFileMetadata(params.existingSpreadsheetId).catch(() => null);
    if (driveMeta && driveMeta.trashed) {
      shouldCreateNew = true;
    }

    if (!shouldCreateNew) {
      try {
        meta = await getSpreadsheetMetadata(params.existingSpreadsheetId);
      } catch (err: any) {
        if (err instanceof SpreadsheetApiError && err.status === 404) {
          shouldCreateNew = true;
        } else {
          // Do NOT create duplicate spreadsheets on transient network/401/403/5xx errors
          throw err;
        }
      }
    }

    if (!shouldCreateNew && meta) {
      const safeId = encodeURIComponent(params.existingSpreadsheetId.trim());

      // 2. If any requested sheet tabs are missing, create them via addSheet batchUpdate
      const missingTabs = params.tabs.filter((t) => !meta!.sheets.includes(t.sheetTitle));
      if (missingTabs.length > 0) {
        const addSheetsRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${safeId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: missingTabs.map((t) => ({
                addSheet: {
                  properties: {
                    title: t.sheetTitle,
                  },
                },
              })),
            }),
          }
        );
        if (!addSheetsRes.ok) {
          const err = await addSheetsRes.json().catch(() => ({}));
          throw new Error(
            err?.error?.message ||
              'Errore nella creazione delle schede mancanti nel Foglio Google Contabilità'
          );
        }
      }

      // 3. Clear each sheet tab completely using whole-sheet range
      for (const tab of params.tabs) {
        const wholeSheetRange = encodeURIComponent(escapeSheetTitleForRange(tab.sheetTitle));
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${wholeSheetRange}:clear`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      }

      // 4. Write all tabs with valueInputOption: 'RAW'
      const dataPayload = params.tabs.map((t) => ({
        range: `${escapeSheetTitleForRange(t.sheetTitle)}!A1`,
        majorDimension: 'ROWS',
        values: sanitizeSpreadsheetRows(t.rows),
      }));

      const updateRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'RAW',
            data: dataPayload,
          }),
        }
      );

      if (!updateRes.ok) {
        const err = await updateRes.json().catch(() => ({}));
        throw new Error(
          err?.error?.message || "Errore nell'aggiornamento del Foglio Google Contabilità"
        );
      }

      return {
        spreadsheetId: meta.spreadsheetId,
        spreadsheetUrl: meta.spreadsheetUrl,
      };
    }
  }

  return await createAndPopulateSpreadsheet(params.title, params.tabs, 'contabilita_cassa');
}

// ============================================================================
// GOOGLE FORMS API HELPERS
// ============================================================================

export interface CreatedGoogleForm {
  formId: string;
  responderUri: string;
  editUri: string;
  title: string;
}

export async function createGoogleFormForActivity(params: {
  title: string;
  description: string;
  formType: 'evento' | 'tesseramento' | 'gadget';
  customFields?: GoogleFormFieldConfig[];
}): Promise<CreatedGoogleForm> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: params.title,
        documentTitle: params.title,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Errore nella creazione del Google Form');
  }

  const form = await createRes.json();
  const formId = form.formId;

  // Move created form into the appropriate category folder inside "Gestionale ASD"
  try {
    const targetCategory: DriveCategoryKey =
      params.formType === 'tesseramento' ? 'anagrafica_soci' : 'eventi_iscritti';
    const { categoryFolder } = await getOrCreateDriveCategoryFolder(targetCategory);
    await moveFileToDriveFolder(formId, categoryFolder.id);
  } catch (e) {
    console.warn('Could not move form to category folder:', e);
  }

  const fieldsToBuild =
    params.customFields && params.customFields.length > 0
      ? params.customFields
      : getEffectiveFormFieldsForArea(undefined, params.formType);

  const requests = buildGoogleFormBatchRequests({
    title: params.title,
    description: params.description,
    fields: fieldsToBuild,
  });

  const safeFormId = encodeURIComponent(formId.trim());
  const batchRes = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!batchRes.ok) {
    const err = await batchRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Errore nella configurazione dei campi del Google Form');
  }

  return {
    formId,
    responderUri: form.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
    editUri: `https://docs.google.com/forms/d/${formId}/edit`,
    title: params.title,
  };
}

export async function fetchGoogleFormResponses(formId: string): Promise<{
  formTitle: string;
  questionsMap: Record<string, string>;
  responses: Record<string, string>[];
}> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const safeFormId = encodeURIComponent(formId.trim());

  const formRes = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!formRes.ok) {
    const err = await formRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Impossibile leggere la struttura del Google Form');
  }

  const formData = await formRes.json();

  // Paginate through all pages of responses using nextPageToken
  const allRawResponses: any[] = [];
  let pageToken: string | undefined = undefined;
  for (let page = 0; page < 50; page++) {
    const url = new URL(`https://forms.googleapis.com/v1/forms/${safeFormId}/responses`);
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }
    const respRes = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respRes.ok) {
      const err = await respRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Impossibile leggere le risposte del Google Form');
    }
    const respData = await respRes.json();
    if (Array.isArray(respData.responses)) {
      allRawResponses.push(...respData.responses);
    }
    if (!respData.nextPageToken) {
      break;
    }
    pageToken = respData.nextPageToken;
  }

  const qMap: Record<string, string> = {};
  for (const item of formData.items || []) {
    const qId = item.questionItem?.question?.questionId;
    if (qId && item.title) {
      qMap[qId] = item.title;
    }
  }

  const parsedResponses: Record<string, string>[] = [];
  for (const r of allRawResponses) {
    const row: Record<string, string> = {
      _responseId: r.responseId,
      _submittedAt: r.lastSubmittedTime || r.createTime || '',
    };
    const answers = r.answers || {};
    for (const [qId, ansObj] of Object.entries<any>(answers)) {
      const qTitle = qMap[qId] || qId;
      const val = (ansObj.textAnswers?.answers || [])
        .map((a: any) => a.value)
        .join(', ');
      row[qTitle] = val;
    }
    parsedResponses.push(row);
  }

  return {
    formTitle: formData.info?.title || 'Modulo Google',
    questionsMap: qMap,
    responses: parsedResponses,
  };
}

// ============================================================================
// GMAIL API: INVIO EMAIL CON ALLEGATO PDF (RFC 2822 MULTIPART/MIXED -> BASE64URL)
// ============================================================================

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

function encodeUtf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

function encodeMimeSubjectUtf8(subject: string): string {
  return `=?UTF-8?B?${encodeUtf8ToBase64(subject)}?=`;
}

function wrapBase64Lines(base64Str: string, lineLength: number = 76): string {
  const lines: string[] = [];
  for (let i = 0; i < base64Str.length; i += lineLength) {
    lines.push(base64Str.slice(i, i + lineLength));
  }
  return lines.join('\r\n');
}

export async function sendGmailMessageWithAttachment(params: {
  to: string;
  subject: string;
  bodyText: string;
  replyTo?: string;
  attachmentFileName?: string;
  attachmentPdfBlob?: Blob;
}): Promise<{ id: string; threadId: string }> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  const recipient = sanitizeEmailHeader(params.to);
  if (!isValidEmailAddress(recipient)) {
    throw new Error('Indirizzo email destinatario non valido.');
  }

  const cleanSubject =
    sanitizeEmailHeader(params.subject) || 'Comunicazione Segreteria ASD';

  const boundary = `===_Apuacamp_ASD_Mime_${Date.now().toString(36)}_===`;
  const headers: string[] = [
    `To: ${recipient}`,
    `Subject: ${encodeMimeSubjectUtf8(cleanSubject)}`,
    'MIME-Version: 1.0',
  ];

  if (params.replyTo) {
    const cleanReplyTo = sanitizeEmailHeader(params.replyTo);
    if (isValidEmailAddress(cleanReplyTo)) {
      headers.push(`Reply-To: ${cleanReplyTo}`);
    }
  }

  let rawMimeMessage = '';

  if (params.attachmentPdfBlob && params.attachmentFileName) {
    const encodedAttachment = encodeMimeAttachmentFilename(params.attachmentFileName);
    const pdfBase64 = wrapBase64Lines(await blobToBase64(params.attachmentPdfBlob));
    const bodyBase64 = wrapBase64Lines(encodeUtf8ToBase64(params.bodyText));

    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const parts = [
      headers.join('\r\n'),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      bodyBase64,
      '',
      `--${boundary}`,
      `Content-Type: application/pdf; ${encodedAttachment.mimeNameParam}`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; ${encodedAttachment.dispositionFilenameParam}`,
      '',
      pdfBase64,
      '',
      `--${boundary}--`,
      '',
    ];
    rawMimeMessage = parts.join('\r\n');
  } else {
    const bodyBase64 = wrapBase64Lines(encodeUtf8ToBase64(params.bodyText));
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: base64');
    rawMimeMessage = `${headers.join('\r\n')}\r\n\r\n${bodyBase64}`;
  }

  const base64UrlEncoded = encodeUtf8ToBase64(rawMimeMessage)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64UrlEncoded }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ||
        'Errore durante l\'invio dell\'email tramite Gmail API. Verifica di aver concesso il permesso Gmail.'
    );
  }

  return res.json();
}

