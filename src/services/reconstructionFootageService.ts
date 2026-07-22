import type {
  ReconstructionFootage,
  SaveReconstructionFootageInput,
} from "../types/reconstructionFootage";

const METADATA_STORAGE_KEY = "roadsafe-ar-reconstruction-footage-metadata";
const DATABASE_NAME = "roadsafe-ar-reconstruction-footage";
const DATABASE_VERSION = 1;
const VIDEO_STORE_NAME = "video-blobs";

interface StoredVideoBlob {
  id: string;
  blob: Blob;
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitiseFilePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogv";
  return "webm";
}

function readMetadata(): ReconstructionFootage[] {
  try {
    const stored = localStorage.getItem(METADATA_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as ReconstructionFootage[];
    if (!Array.isArray(parsed)) return [];

    return parsed.map((record) => ({
      ...record,
      title: record.title || "Untitled Reconstruction Footage",
      description: record.description || "",
      recordedBy: record.recordedBy || "",
      playbackSpeed: record.playbackSpeed || 1,
      quality: record.quality || "Standard",
      width: record.width || 1280,
      height: record.height || 720,
      frameRate: record.frameRate || 30,
      isPrimary: Boolean(record.isPrimary),
    }));
  } catch (error) {
    console.error("Failed to read reconstruction footage metadata:", error);
    return [];
  }
}

function writeMetadata(records: ReconstructionFootage[]): void {
  localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(records));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VIDEO_STORE_NAME)) {
        database.createObjectStore(VIDEO_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open the footage database."));
  });
}

async function putBlob(id: string, blob: Blob): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VIDEO_STORE_NAME, "readwrite");
    transaction.objectStore(VIDEO_STORE_NAME).put({ id, blob } satisfies StoredVideoBlob);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to save the video file."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Saving the video was aborted."));
  });

  database.close();
}

async function readBlob(id: string): Promise<Blob | null> {
  const database = await openDatabase();

  const result = await new Promise<StoredVideoBlob | undefined>((resolve, reject) => {
    const transaction = database.transaction(VIDEO_STORE_NAME, "readonly");
    const request = transaction.objectStore(VIDEO_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredVideoBlob | undefined);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to read the video file."));
  });

  database.close();
  return result?.blob ?? null;
}

async function deleteBlob(id: string): Promise<void> {
  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VIDEO_STORE_NAME, "readwrite");
    transaction.objectStore(VIDEO_STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to delete the video file."));
  });

  database.close();
}

export const ReconstructionFootageService = {
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "indexedDB" in window &&
      "MediaRecorder" in window &&
      typeof HTMLCanvasElement !== "undefined" &&
      "captureStream" in HTMLCanvasElement.prototype
    );
  },

  getAllMetadata(): ReconstructionFootage[] {
    return readMetadata().sort(
      (left, right) =>
        new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
    );
  },

  getById(footageId: string): ReconstructionFootage | null {
    return this.getAllMetadata().find((record) => record.id === footageId) ?? null;
  },

  getByCaseId(caseId: string): ReconstructionFootage[] {
    return this.getAllMetadata().filter((record) => record.caseId === caseId);
  },

  async save(
    input: SaveReconstructionFootageInput,
    videoBlob: Blob,
  ): Promise<ReconstructionFootage> {
    const id = createId("footage");
    const recordedAt = new Date().toISOString();
    const extension = getExtension(input.mimeType || videoBlob.type);
    const safeTitle = sanitiseFilePart(input.title) || "reconstruction-footage";

    const record: ReconstructionFootage = {
      id,
      caseId: input.caseId,
      reconstructionId: input.reconstructionId,
      title: input.title.trim() || "Reconstruction Footage",
      description: input.description?.trim() || "",
      fileName: `${safeTitle}-${id.slice(-8)}.${extension}`,
      mimeType: input.mimeType || videoBlob.type || "video/webm",
      durationSeconds: Math.max(0, input.durationSeconds),
      sizeBytes: videoBlob.size,
      recordedAt,
      recordedBy: input.recordedBy?.trim() || "",
      playbackSpeed: input.playbackSpeed,
      quality: input.quality,
      width: input.width,
      height: input.height,
      frameRate: input.frameRate,
      thumbnailDataUrl: input.thumbnailDataUrl,
      isPrimary: Boolean(input.makePrimary),
    };

    await putBlob(id, videoBlob);

    let records = readMetadata();
    if (record.isPrimary || records.every((item) => item.caseId !== record.caseId)) {
      records = records.map((item) =>
        item.caseId === record.caseId ? { ...item, isPrimary: false } : item,
      );
      record.isPrimary = true;
    }

    records.push(record);
    writeMetadata(records);
    return record;
  },

  async getBlob(footageId: string): Promise<Blob | null> {
    return readBlob(footageId);
  },

  async createObjectUrl(footageId: string): Promise<string | null> {
    const blob = await readBlob(footageId);
    return blob ? URL.createObjectURL(blob) : null;
  },

  updateMetadata(
    footageId: string,
    updates: Partial<Pick<ReconstructionFootage, "title" | "description">>,
  ): ReconstructionFootage | null {
    const records = readMetadata();
    const index = records.findIndex((record) => record.id === footageId);
    if (index < 0) return null;

    records[index] = {
      ...records[index],
      ...updates,
      title: updates.title?.trim() || records[index].title,
      description:
        updates.description === undefined
          ? records[index].description
          : updates.description.trim(),
    };

    writeMetadata(records);
    return records[index];
  },

  setPrimary(caseId: string, footageId: string): ReconstructionFootage | null {
    const records = readMetadata().map((record) =>
      record.caseId === caseId
        ? { ...record, isPrimary: record.id === footageId }
        : record,
    );

    writeMetadata(records);
    return records.find((record) => record.id === footageId) ?? null;
  },

  async delete(footageId: string): Promise<void> {
    const target = this.getById(footageId);
    await deleteBlob(footageId);

    let records = readMetadata().filter((record) => record.id !== footageId);

    if (target?.isPrimary) {
      const next = records
        .filter((record) => record.caseId === target.caseId)
        .sort(
          (left, right) =>
            new Date(right.recordedAt).getTime() -
            new Date(left.recordedAt).getTime(),
        )[0];

      if (next) {
        records = records.map((record) =>
          record.caseId === target.caseId
            ? { ...record, isPrimary: record.id === next.id }
            : record,
        );
      }
    }

    writeMetadata(records);
  },

  async deleteByCaseId(caseId: string): Promise<void> {
    const records = this.getByCaseId(caseId);
    await Promise.all(records.map((record) => deleteBlob(record.id)));
    writeMetadata(readMetadata().filter((record) => record.caseId !== caseId));
  },

  async download(footageId: string): Promise<void> {
    const metadata = this.getById(footageId);
    const blob = await readBlob(footageId);

    if (!metadata || !blob) {
      throw new Error("The saved footage file could not be found.");
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = metadata.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
