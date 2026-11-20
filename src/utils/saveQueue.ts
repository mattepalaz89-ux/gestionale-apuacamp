export type SaveQueueStatus = 'idle' | 'pending' | 'saving' | 'error';

export interface SaveQueueOptions {
  onStatusChange?: (status: SaveQueueStatus, error?: unknown) => void;
  lockName?: string;
}

export interface SaveQueue<T> {
  enqueue(state: T): void;
  flush(): Promise<void>;
  cancelPending(): void;
  getStatus(): SaveQueueStatus;
}

/**
 * Serialized, debounced save queue with Web Locks API cross-tab coordination.
 * Guarantees at most one `saveFn` is in flight at any time, coalesces rapid updates,
 * and ensures an update arriving during an in-flight save is persisted right after.
 */
export function createSaveQueue<T>(
  saveFn: (state: T) => Promise<void>,
  debounceMs = 2000,
  options?: SaveQueueOptions
): SaveQueue<T> {
  let status: SaveQueueStatus = 'idle';
  let pendingState: T | null = null;
  let hasPendingState = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeLoopPromise: Promise<void> | null = null;
  const lockName = options?.lockName || 'gestionale_asd_drive_save';

  const setStatus = (next: SaveQueueStatus, err?: unknown) => {
    status = next;
    options?.onStatusChange?.(next, err);
  };

  const clearTimer = () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  };

  const executeWithOptionalWebLock = async (fn: () => Promise<void>): Promise<void> => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.locks &&
      typeof navigator.locks.request === 'function'
    ) {
      await navigator.locks.request(lockName, { mode: 'exclusive' }, async () => {
        await fn();
      });
    } else {
      await fn();
    }
  };

  const drainQueue = (): Promise<void> => {
    if (activeLoopPromise) {
      return activeLoopPromise;
    }

    activeLoopPromise = (async () => {
      let lastError: unknown = null;
      while (hasPendingState) {
        const snapshotToSave = pendingState as T;
        pendingState = null;
        hasPendingState = false;
        setStatus('saving');

        try {
          await executeWithOptionalWebLock(async () => {
            await saveFn(snapshotToSave);
          });
          lastError = null;
        } catch (err) {
          lastError = err;
          // If no newer state arrived while this save failed, transition to error and stop loop
          if (!hasPendingState) {
            setStatus('error', err);
            activeLoopPromise = null;
            return;
          }
        }
      }

      if (lastError === null) {
        setStatus('idle');
      }
      activeLoopPromise = null;
    })();

    return activeLoopPromise;
  };

  const scheduleDrain = () => {
    clearTimer();
    if (debounceMs <= 0) {
      void drainQueue();
      return;
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void drainQueue();
    }, debounceMs);
  };

  return {
    enqueue(state: T): void {
      pendingState = state;
      hasPendingState = true;
      if (status !== 'saving') {
        setStatus('pending');
      }
      scheduleDrain();
    },

    async flush(): Promise<void> {
      clearTimer();
      if (hasPendingState) {
        await drainQueue();
      } else if (activeLoopPromise) {
        await activeLoopPromise;
      }
    },

    cancelPending(): void {
      clearTimer();
      pendingState = null;
      hasPendingState = false;
      if (status === 'pending') {
        setStatus('idle');
      }
    },

    getStatus(): SaveQueueStatus {
      return status;
    },
  };
}
