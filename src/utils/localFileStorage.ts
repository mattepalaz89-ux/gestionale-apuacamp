/**
 * Local PC File Storage Engine (compatible with local folders, OneDrive, Dropbox, iCloud Drive)
 * Replaces volatile browser localStorage persistence with direct PC file read/write.
 */

export interface LocalFileConnection {
  fileName: string;
  handle: any | null;
  lastSavedAt: string | null;
}

export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).showOpenFilePicker === 'function' &&
    typeof (window as any).showSaveFilePicker === 'function'
  );
}

/**
 * Opens an existing .json database file from the user's PC (or OneDrive/Dropbox folder).
 * Uses File System Access API when available outside cross-origin iframe restrictions.
 */
export async function openLocalDatabaseFileWithPicker(): Promise<{
  handle: any;
  fileName: string;
  content: string;
} | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }
  const [fileHandle] = await (window as any).showOpenFilePicker({
    types: [
      {
        description: 'File Database Gestionale ASD (.json)',
        accept: { 'application/json': ['.json'] },
      },
    ],
    multiple: false,
  });
  if (!fileHandle) return null;
  const file = await fileHandle.getFile();
  const content = await file.text();
  return {
    handle: fileHandle,
    fileName: file.name,
    content,
  };
}

/**
 * Creates or selects a .json file on the user's PC (or OneDrive/Dropbox folder) for live auto-saving.
 */
export async function saveAsLocalDatabaseFileWithPicker(
  suggestedName: string,
  jsonContent: string
): Promise<{
  handle: any;
  fileName: string;
} | null> {
  if (!isFileSystemAccessSupported()) {
    downloadLocalDatabaseFile(suggestedName, jsonContent);
    return null;
  }
  try {
    const fileHandle = await (window as any).showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'File Database Gestionale ASD (.json)',
          accept: { 'application/json': ['.json'] },
        },
      ],
    });
    if (!fileHandle) return null;
    await writeToLocalFileHandle(fileHandle, jsonContent);
    return {
      handle: fileHandle,
      fileName: fileHandle.name || suggestedName,
    };
  } catch (err: any) {
    // If user aborted picker, return null; if security error (e.g. iframe), fall back to direct download
    if (err?.name === 'AbortError') return null;
    downloadLocalDatabaseFile(suggestedName, jsonContent);
    return null;
  }
}

/**
 * Writes updated JSON content directly into an already connected FileSystemFileHandle on the user's PC.
 */
export async function writeToLocalFileHandle(
  fileHandle: any,
  jsonContent: string
): Promise<boolean> {
  if (!fileHandle || typeof fileHandle.createWritable !== 'function') {
    return false;
  }
  const writable = await fileHandle.createWritable();
  await writable.write(jsonContent);
  await writable.close();
  return true;
}

/**
 * Triggers a standard file download to the user's PC (or local cloud folder).
 */
export function downloadLocalDatabaseFile(fileName: string, jsonContent: string): void {
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
