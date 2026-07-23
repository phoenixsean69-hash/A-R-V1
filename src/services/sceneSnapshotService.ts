import type {
  RealSceneBounds,
  RealSceneMapMode,
  RealSceneSnapshotReference,
} from "../types/realSceneGeometry";

const DATABASE_NAME = "roadsafe-ar-scene-assets";
const DATABASE_VERSION = 1;
const STORE_NAME = "scene-snapshots";

interface StoredSceneSnapshot {
  id: string;
  blob: Blob;
  reference: RealSceneSnapshotReference;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("This browser does not provide IndexedDB snapshot storage."),
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Scene snapshot storage could not be opened."));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = action(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("Scene snapshot operation failed."));
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
          database.close();
          reject(
            transaction.error ?? new Error("Scene snapshot transaction failed."),
          );
        };
      }),
  );
}

export const SceneSnapshotService = {
  async save(
    blob: Blob,
    details: {
      bounds: RealSceneBounds;
      mapMode: RealSceneMapMode;
      widthPixels: number;
      heightPixels: number;
    },
  ): Promise<RealSceneSnapshotReference> {
    const reference: RealSceneSnapshotReference = {
      id: createId("scene-snapshot"),
      mapMode: details.mapMode,
      capturedAt: new Date().toISOString(),
      bounds: details.bounds,
      widthPixels: Math.max(1, Math.round(details.widthPixels)),
      heightPixels: Math.max(1, Math.round(details.heightPixels)),
      mimeType: blob.type || "image/jpeg",
    };

    const record: StoredSceneSnapshot = {
      id: reference.id,
      blob,
      reference,
    };

    await runTransaction("readwrite", (store) => store.put(record));
    return reference;
  },

  async getBlob(snapshotId: string): Promise<Blob | null> {
    const record = await runTransaction<StoredSceneSnapshot | undefined>(
      "readonly",
      (store) => store.get(snapshotId),
    );
    return record?.blob ?? null;
  },

  async createObjectUrl(snapshotId: string): Promise<string | null> {
    const blob = await this.getBlob(snapshotId);
    return blob ? URL.createObjectURL(blob) : null;
  },

  async delete(snapshotId: string): Promise<void> {
    await runTransaction("readwrite", (store) => store.delete(snapshotId));
  },
};
