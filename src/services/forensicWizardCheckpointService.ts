import type {
  AccidentCaseFormValues,
} from "../types/accidentCase";

import type {
  ForensicPipelineBuildResult,
  ForensicPipelineStage,
} from "../types/forensicScenePipeline";

import type {
  RealSceneAreaSelection,
} from "../types/realSceneGeometry";

import type {
  RoadDetectionCoordinate,
} from "../types/roadLayoutDetection";

export type ForensicWizardStep =
  | 1
  | 2
  | 3
  | 4;

export type ForensicWizardCompletedStep =
  | 0
  | 1
  | 2
  | 3;

export interface ForensicWizardCheckpoint {
  schemaVersion:
    "RoadSafe Forensic Wizard Checkpoint V1";

  key: string;

  savedAt: string;

  completedThrough:
    ForensicWizardCompletedStep;

  resumeStep:
    ForensicWizardStep;

  values:
    AccidentCaseFormValues;

  anchor:
    RoadDetectionCoordinate | null;

  coreArea:
    RealSceneAreaSelection | null;

  contextBufferMetres:
    number;

  stages:
    ForensicPipelineStage[];

  buildResult:
    ForensicPipelineBuildResult | null;

  confirmed:
    boolean;

  lastError?: string;
}

const DATABASE_NAME =
  "roadsafe-forensic-wizard-checkpoints";

const DATABASE_VERSION =
  1;

const STORE_NAME =
  "checkpoints";

function openDatabase():
  Promise<IDBDatabase> {
  if (
    typeof indexedDB ===
    "undefined"
  ) {
    return Promise.reject(
      new Error(
        "IndexedDB is unavailable; wizard checkpoints cannot be persisted.",
      ),
    );
  }

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const request =
        indexedDB.open(
          DATABASE_NAME,
          DATABASE_VERSION,
        );

      request.onupgradeneeded =
        () => {
          const database =
            request.result;

          if (
            !database.objectStoreNames.contains(
              STORE_NAME,
            )
          ) {
            database.createObjectStore(
              STORE_NAME,
              {
                keyPath:
                  "key",
              },
            );
          }
        };

      request.onsuccess =
        () =>
          resolve(
            request.result,
          );

      request.onerror =
        () =>
          reject(
            request.error ??
              new Error(
                "Wizard checkpoint database could not be opened.",
              ),
          );
    },
  );
}

function runTransaction<T>(
  mode:
    IDBTransactionMode,
  operation:
    (
      store:
        IDBObjectStore,
    ) => IDBRequest<T>,
): Promise<T> {
  return openDatabase()
    .then(
      (
        database,
      ) =>
        new Promise<T>(
          (
            resolve,
            reject,
          ) => {
            const transaction =
              database.transaction(
                STORE_NAME,
                mode,
              );

            const request =
              operation(
                transaction.objectStore(
                  STORE_NAME,
                ),
              );

            request.onsuccess =
              () =>
                resolve(
                  request.result,
                );

            request.onerror =
              () =>
                reject(
                  request.error ??
                    new Error(
                      "Wizard checkpoint operation failed.",
                    ),
                );

            transaction.oncomplete =
              () =>
                database.close();

            transaction.onerror =
              () => {
                database.close();

                reject(
                  transaction.error ??
                    new Error(
                      "Wizard checkpoint transaction failed.",
                    ),
                );
              };

            transaction.onabort =
              () => {
                database.close();

                reject(
                  transaction.error ??
                    new Error(
                      "Wizard checkpoint transaction was aborted.",
                    ),
                );
              };
          },
        ),
    );
}

export const ForensicWizardCheckpointService = {
  keyForCaseNumber(
    caseNumber: string,
  ): string {
    return `new-case:${caseNumber.trim() || "untitled"}`;
  },

  async load(
    key: string,
  ): Promise<ForensicWizardCheckpoint | null> {
    const result =
      await runTransaction<
        ForensicWizardCheckpoint |
        undefined
      >(
        "readonly",
        (
          store,
        ) =>
          store.get(
            key,
          ),
      );

    if (
      !result ||
      result.schemaVersion !==
        "RoadSafe Forensic Wizard Checkpoint V1"
    ) {
      return null;
    }

    return result;
  },

  async save(
    checkpoint:
      ForensicWizardCheckpoint,
  ): Promise<void> {
    await runTransaction<IDBValidKey>(
      "readwrite",
      (
        store,
      ) =>
        store.put(
          checkpoint,
        ),
    );
  },

  async clear(
    key: string,
  ): Promise<void> {
    await runTransaction<undefined>(
      "readwrite",
      (
        store,
      ) =>
        store.delete(
          key,
        ) as IDBRequest<undefined>,
    );
  },
};
