import type { ForensicArchiveReference } from "../types/forensicScenePipeline";

const DB_NAME = "roadsafe-forensic-source-archive";
const DB_VERSION = 1;
const STORE = "frozen-json-sources";

interface StoredSource {
  id: string;
  json: string;
  reference: ForensicArchiveReference;
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

export async function sha256Text(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Json(value: unknown): Promise<string> {
  return sha256Text(stableStringify(value));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Forensic source archive could not be opened."));
  });
}

async function put(record: StoredSource): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Forensic source archive write failed."));
    });
  } finally {
    database.close();
  }
}

export const ForensicSourceArchiveService = {
  async saveJson(kind: ForensicArchiveReference["kind"], value: unknown): Promise<ForensicArchiveReference> {
    const json = stableStringify(value);
    const reference: ForensicArchiveReference = {
      id: createId(kind),
      kind,
      capturedAt: new Date().toISOString(),
      sha256: await sha256Text(json),
      byteLength: new TextEncoder().encode(json).byteLength,
      storage: "IndexedDB",
      mimeType: "application/json",
    };
    await put({ id: reference.id, json, reference });
    return reference;
  },
};
