export type AttendanceQueueKind = "student" | "teacher";

export type AttendanceQueueItem = {
  id: string;
  kind: AttendanceQueueKind;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
};

const DB_NAME = "school-hub";
const STORE_NAME = "attendance_queue";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | void> {
  return openDb().then(
    (db) =>
      new Promise<T | void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store) as IDBRequest<T> | void;

        tx.oncomplete = () => resolve(request ? request.result : undefined);
        tx.onerror = () => reject(tx.error);
        if (request) {
          request.onerror = () => reject(request.error);
        }
      })
  );
}

export async function addAttendanceQueueItem(item: AttendanceQueueItem): Promise<void> {
  await runTransaction("readwrite", (store) => store.put(item));
}

export async function getAttendanceQueueItems(): Promise<AttendanceQueueItem[]> {
  const result = await runTransaction<AttendanceQueueItem[]>("readonly", (store) =>
    store.getAll()
  );
  return Array.isArray(result) ? result : [];
}

export async function removeAttendanceQueueItem(id: string): Promise<void> {
  await runTransaction("readwrite", (store) => store.delete(id));
}

export async function updateAttendanceQueueItem(item: AttendanceQueueItem): Promise<void> {
  await runTransaction("readwrite", (store) => store.put(item));
}
