import type {
  ForensicVehicleDamagePhotoRef,
} from "./forensicInvestigationTypes";

const DATABASE_NAME =
  "roadsafe-forensic-damage-photos-v1";

const STORE_NAME =
  "photos";

const DATABASE_VERSION =
  1;

export const MAX_DAMAGE_PHOTO_SIZE_BYTES =
  15 * 1024 * 1024;

interface StoredDamagePhoto {
  id: string;
  blob: Blob;
  metadata: ForensicVehicleDamagePhotoRef;
}

function createId(): string {
  return `damage-photo-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise(
    (resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(
          new Error(
            "This browser cannot store damage photographs locally.",
          ),
        );
        return;
      }

      const request =
        window.indexedDB.open(
          DATABASE_NAME,
          DATABASE_VERSION,
        );

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(
            STORE_NAME,
            {
              keyPath: "id",
            },
          );
        }
      };

      request.onsuccess = () =>
        resolve(request.result);

      request.onerror = () =>
        reject(
          request.error ??
            new Error(
              "Could not open local damage-photo storage.",
            ),
        );
    },
  );
}

function transactionComplete(
  transaction: IDBTransaction,
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      transaction.oncomplete = () =>
        resolve();

      transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error(
              "Damage-photo storage transaction failed.",
            ),
        );

      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error(
              "Damage-photo storage transaction was cancelled.",
            ),
        );
    },
  );
}

async function sha256(
  file: File,
): Promise<string | undefined> {
  if (!crypto?.subtle) {
    return undefined;
  }

  const buffer =
    await file.arrayBuffer();

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      buffer,
    );

  return Array.from(
    new Uint8Array(digest),
  )
    .map((byte) =>
      byte
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
}

export const ForensicDamagePhotoService = {
  async storeFiles(
    files: File[],
  ): Promise<ForensicVehicleDamagePhotoRef[]> {
    if (files.length === 0) {
      return [];
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        throw new Error(
          `${file.name} is not an image file.`,
        );
      }

      if (file.size > MAX_DAMAGE_PHOTO_SIZE_BYTES) {
        throw new Error(
          `${file.name} is larger than 15 MB.`,
        );
      }
    }

    const database =
      await openDatabase();

    const storedRefs:
      ForensicVehicleDamagePhotoRef[] = [];

    try {
      for (const file of files) {
        const id =
          createId();

        const metadata:
          ForensicVehicleDamagePhotoRef = {
            id,
            fileName:
              file.name ||
              "damage-photo",
            mimeType:
              file.type ||
              "image/*",
            sizeBytes:
              file.size,
            capturedAt:
              new Date().toISOString(),
            sha256:
              await sha256(file),
          };

        const transaction =
          database.transaction(
            STORE_NAME,
            "readwrite",
          );

        const store =
          transaction.objectStore(
            STORE_NAME,
          );

        const storedPhoto:
          StoredDamagePhoto = {
            id,
            blob: file,
            metadata,
          };

        store.put(
          storedPhoto,
        );

        await transactionComplete(
          transaction,
        );

        storedRefs.push(
          metadata,
        );
      }

      return storedRefs;
    } finally {
      database.close();
    }
  },

  async getObjectUrl(
    photoId: string,
  ): Promise<string | null> {
    const database =
      await openDatabase();

    try {
      return await new Promise(
        (resolve, reject) => {
          const transaction =
            database.transaction(
              STORE_NAME,
              "readonly",
            );

          const request =
            transaction
              .objectStore(STORE_NAME)
              .get(photoId);

          request.onsuccess = () => {
            const stored =
              request.result as
                | StoredDamagePhoto
                | undefined;

            if (!stored?.blob) {
              resolve(null);
              return;
            }

            resolve(
              URL.createObjectURL(
                stored.blob,
              ),
            );
          };

          request.onerror = () =>
            reject(
              request.error ??
                new Error(
                  "Could not load the damage photograph.",
                ),
            );
        },
      );
    } finally {
      database.close();
    }
  },

  async deletePhoto(
    photoId: string,
  ): Promise<void> {
    const database =
      await openDatabase();

    try {
      const transaction =
        database.transaction(
          STORE_NAME,
          "readwrite",
        );

      transaction
        .objectStore(STORE_NAME)
        .delete(photoId);

      await transactionComplete(
        transaction,
      );
    } finally {
      database.close();
    }
  },
};
