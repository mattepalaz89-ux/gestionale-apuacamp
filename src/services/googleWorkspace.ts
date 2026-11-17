import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleFormFieldConfig } from '../types';
import {
  buildGoogleFormBatchRequests,
  getEffectiveFormFieldsForArea,
} from '../utils/formAndReceiptTemplates';


export const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.responses.readonly',
  'https://www.googleapis.com/auth/gmail.send',
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'consent',
});

let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Impossibile ottenere il token di accesso da Google Workspace.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
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
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

export async function listDriveFiles(query?: string): Promise<DriveFileItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const q = query || 'trashed = false';
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size,parents)&orderBy=modifiedTime desc&pageSize=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Errore Google Drive (${res.status})`);
  }
  const data = await res.json();
  return data.files || [];
}

export async function findOrCreateDriveFolder(
  folderName: string,
  parentFolderId?: string
): Promise<DriveFileItem> {
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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Impossibile creare la cartella su Google Drive');
  }
  return await res.json();
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
 * Ensures the entire "Gestionale ASD" folder tree (all 7 category folders) is created on Google Drive
 */
export async function ensureGestionaleDriveStructure(): Promise<{
  rootFolder: DriveFileItem;
  subfolders: Record<DriveCategoryKey, DriveFileItem>;
}> {
  const rootFolder = await findOrCreateDriveFolder(DRIVE_ROOT_FOLDER_NAME);
  const keys = Object.keys(DRIVE_CATEGORY_FOLDERS) as DriveCategoryKey[];
  const results = await Promise.all(
    keys.map(async (k) => {
      const folder = await findOrCreateDriveFolder(
        DRIVE_CATEGORY_FOLDERS[k].folderName,
        rootFolder.id
      );
      return [k, folder] as const;
    })
  );
  const subfolders = Object.fromEntries(results) as Record<DriveCategoryKey, DriveFileItem>;
  return { rootFolder, subfolders };
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
}): Promise<DriveFileItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  let targetFolderId = params.folderId;
  if (!targetFolderId && params.category && !params.existingFileId) {
    const { categoryFolder } = await getOrCreateDriveCategoryFolder(params.category);
    targetFolderId = categoryFolder.id;
  }

  const metadata: Record<string, any> = {
    name: params.name,
    mimeType: params.mimeType,
  };
  if (targetFolderId && !params.existingFileId) {
    metadata.parents = [targetFolderId];
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  const fileBlob =
    typeof params.content === 'string'
      ? new Blob([params.content], { type: params.mimeType })
      : params.content;
  form.append('file', fileBlob);

  const endpoint = params.existingFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(
        params.existingFileId
      )}?uploadType=multipart&fields=id,name,mimeType,webViewLink,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,modifiedTime';

  const res = await fetch(endpoint, {
    method: params.existingFileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Errore durante il caricamento su Google Drive');
  }
  return await res.json();
}

export async function downloadDriveFileText(fileId: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const safeId = encodeURIComponent(fileId.trim());
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${safeId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Impossibile eliminare il file da Google Drive');
  }
}

export const LIVE_DB_FILENAME = 'database_gestionale_asd.json';

/**
 * Loads the live JSON database from the connected account's Google Drive
 * ("Gestionale ASD / 07_Backup_Sistema / database_gestionale_asd.json").
 */
export async function loadLiveDatabaseFromDrive(): Promise<{
  fileId: string;
  content: string;
  modifiedTime?: string;
  webViewLink?: string;
} | null> {
  const token = await getAccessToken();
  if (!token) return null;

  // 1. Check for the canonical live DB file first
  const liveFiles = await listDriveFiles(
    `name = '${LIVE_DB_FILENAME}' and mimeType = 'application/json' and trashed = false`
  );
  if (liveFiles.length > 0) {
    const latest = liveFiles[0];
    const content = await downloadDriveFileText(latest.id);
    return {
      fileId: latest.id,
      content,
      modifiedTime: latest.modifiedTime,
      webViewLink: latest.webViewLink,
    };
  }

  // 2. Fallback to any previous Backup_Apuacamp*.json if migrating
  const fallbackFiles = await listDriveFiles(
    "name contains 'Backup_Apuacamp' and mimeType = 'application/json' and trashed = false"
  );
  if (fallbackFiles.length > 0) {
    const latest = fallbackFiles[0];
    const content = await downloadDriveFileText(latest.id);
    return {
      fileId: '', // Will create the canonical LIVE_DB_FILENAME on next save
      content,
      modifiedTime: latest.modifiedTime,
      webViewLink: latest.webViewLink,
    };
  }

  return null;
}

/**
 * Saves/updates the live JSON database in real time inside
 * "Gestionale ASD / 07_Backup_Sistema / database_gestionale_asd.json" on the user's Google Drive.
 */
export async function saveLiveDatabaseToDrive(
  jsonContent: string,
  knownFileId?: string
): Promise<DriveFileItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  let targetFileId = knownFileId;

  if (!targetFileId) {
    const existing = await listDriveFiles(
      `name = '${LIVE_DB_FILENAME}' and mimeType = 'application/json' and trashed = false`
    );
    if (existing.length > 0) {
      targetFileId = existing[0].id;
    }
  }

  return await uploadFileToDrive({
    name: LIVE_DB_FILENAME,
    content: jsonContent,
    mimeType: 'application/json',
    category: 'backup_sistema',
    existingFileId: targetFileId || undefined,
  });
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

export async function getSpreadsheetMetadata(spreadsheetId: string): Promise<SpreadsheetMeta> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  const safeId = encodeURIComponent(spreadsheetId.trim());
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${safeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Impossibile leggere il foglio Google Sheets');
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
  const safeRange = encodeURIComponent(`${sheetName}!A1:Z1000`);
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
    range: `'${t.sheetTitle}'!A1`,
    majorDimension: 'ROWS',
    values: t.rows,
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
        valueInputOption: 'USER_ENTERED',
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
  const safeRange = encodeURIComponent(`'${firstSheet}'!A1:Z2000`);

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${safeRange}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${encodeURIComponent(
      `'${firstSheet}'!A1`
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values: rows,
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
 * Creates or updates the official Accounting Google Sheet inside "Gestionale ASD / 02_Contabilita_e_Cassa"
 */
export async function syncAccountingGoogleSheet(params: {
  existingSpreadsheetId?: string;
  title: string;
  tabs: { sheetTitle: string; rows: (string | number | boolean)[][] }[];
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');

  if (params.existingSpreadsheetId) {
    try {
      const meta = await getSpreadsheetMetadata(params.existingSpreadsheetId);
      const safeId = encodeURIComponent(params.existingSpreadsheetId.trim());

      // Ensure all requested sheet tabs exist; if they do, clear and batchUpdate
      for (const tab of params.tabs) {
        if (meta.sheets.includes(tab.sheetTitle)) {
          const safeRange = encodeURIComponent(`'${tab.sheetTitle}'!A1:Z2000`);
          await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values/${safeRange}:clear`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            }
          );
        }
      }

      const dataPayload = params.tabs
        .filter((t) => meta.sheets.includes(t.sheetTitle))
        .map((t) => ({
          range: `'${t.sheetTitle}'!A1`,
          majorDimension: 'ROWS',
          values: t.rows,
        }));

      if (dataPayload.length > 0) {
        const updateRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${safeId}/values:batchUpdate`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              valueInputOption: 'USER_ENTERED',
              data: dataPayload,
            }),
          }
        );
        if (updateRes.ok) {
          return {
            spreadsheetId: meta.spreadsheetId,
            spreadsheetUrl: meta.spreadsheetUrl,
          };
        }
      } else {
        // Fallback: write to first sheet
        await updateMembersGoogleSheet(params.existingSpreadsheetId, params.tabs[0].rows);
        return {
          spreadsheetId: meta.spreadsheetId,
          spreadsheetUrl: meta.spreadsheetUrl,
        };
      }
    } catch {
      // If existing sheet was deleted on Drive, create a fresh one below
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

  const [formRes, respRes] = await Promise.all([
    fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}/responses`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  if (!formRes.ok) {
    const err = await formRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Impossibile leggere la struttura del Google Form');
  }
  if (!respRes.ok) {
    const err = await respRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Impossibile leggere le risposte del Google Form');
  }

  const formData = await formRes.json();
  const respData = await respRes.json();

  const qMap: Record<string, string> = {};
  for (const item of formData.items || []) {
    const qId = item.questionItem?.question?.questionId;
    if (qId && item.title) {
      qMap[qId] = item.title;
    }
  }

  const parsedResponses: Record<string, string>[] = [];
  for (const r of respData.responses || []) {
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

  const recipient = params.to.trim();
  if (!recipient || !recipient.includes('@')) {
    throw new Error('Indirizzo email destinatario non valido.');
  }

  const boundary = `===_Apuacamp_ASD_Mime_${Date.now().toString(36)}_===`;
  const headers: string[] = [
    `To: ${recipient}`,
    `Subject: ${encodeMimeSubjectUtf8(params.subject.trim() || 'Comunicazione Segreteria ASD')}`,
    'MIME-Version: 1.0',
  ];

  if (params.replyTo && params.replyTo.includes('@')) {
    headers.push(`Reply-To: ${params.replyTo.trim()}`);
  }

  let rawMimeMessage = '';

  if (params.attachmentPdfBlob && params.attachmentFileName) {
    const safeFileName = params.attachmentFileName.replace(/["\r\n]/g, '_');
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
      `Content-Type: application/pdf; name="${safeFileName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${safeFileName}"`,
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

