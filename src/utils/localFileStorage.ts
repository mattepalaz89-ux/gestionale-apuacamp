/**
 * Local PC File Storage Engine (compatible with local folders, OneDrive, Dropbox, iCloud Drive)
 * Replaces volatile browser localStorage persistence with direct PC file read/write.
 */

export interface FileSystemWritableFileStreamLike {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemFileHandleLike {
  name?: string;
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface WindowWithFilePicker extends Window {
  showOpenFilePicker?: (options?: {
    types?: FilePickerAcceptType[];
    multiple?: boolean;
  }) => Promise<FileSystemFileHandleLike[]>;
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
  }) => Promise<FileSystemFileHandleLike>;
}

export interface LocalFileConnection {
  fileName: string;
  handle: FileSystemFileHandleLike | null;
  lastSavedAt: string | null;
}

export function isFileSystemAccessSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as WindowWithFilePicker;
  return (
    typeof win.showOpenFilePicker === 'function' &&
    typeof win.showSaveFilePicker === 'function'
  );
}

/**
 * Opens an existing .json database file from the user's PC (or OneDrive/Dropbox folder).
 * Uses File System Access API when available outside cross-origin iframe restrictions.
 */
export async function openLocalDatabaseFileWithPicker(): Promise<{
  handle: FileSystemFileHandleLike;
  fileName: string;
  content: string;
} | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }
  const win = window as WindowWithFilePicker;
  if (!win.showOpenFilePicker) return null;
  const [fileHandle] = await win.showOpenFilePicker({
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
  handle: FileSystemFileHandleLike;
  fileName: string;
} | null> {
  if (!isFileSystemAccessSupported()) {
    downloadLocalDatabaseFile(suggestedName, jsonContent);
    return null;
  }
  try {
    const win = window as WindowWithFilePicker;
    if (!win.showSaveFilePicker) {
      downloadLocalDatabaseFile(suggestedName, jsonContent);
      return null;
    }
    const fileHandle = await win.showSaveFilePicker({
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
  } catch (err: unknown) {
    // If user aborted picker, return null; if security error (e.g. iframe), fall back to direct download
    if (
      (err instanceof DOMException && err.name === 'AbortError') ||
      (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AbortError')
    ) {
      return null;
    }
    downloadLocalDatabaseFile(suggestedName, jsonContent);
    return null;
  }
}

/**
 * Writes updated JSON content directly into an already connected FileSystemFileHandle on the user's PC.
 */
export async function writeToLocalFileHandle(
  fileHandle: FileSystemFileHandleLike | null | undefined,
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
