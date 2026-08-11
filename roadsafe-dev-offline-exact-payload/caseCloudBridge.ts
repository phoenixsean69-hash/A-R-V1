import type { AccidentCase } from "../types/accidentCase";
import type {
  CaseCloudErrorEventDetail,
  CaseCloudEventType,
  CaseCloudPendingEventDetail,
  CaseCloudRecordEventDetail,
  CaseCloudSession,
} from "../types/caseCloud";
import { RoadSafeCaseFunctionService } from "./roadSafeCaseFunctionService";
import {
  DEV_OFFLINE_CACHE_KEYS,
  DevOfflineCache,
} from "./devOfflineCache";

export const CASE_CLOUD_RECORD_EVENT =
  "roadsafe:case-cloud-record";
export const CASE_CLOUD_ERROR_EVENT =
  "roadsafe:case-cloud-error";
export const CASE_CLOUD_PENDING_EVENT =
  "roadsafe:case-cloud-pending";

interface PendingSave {
  record: AccidentCase;
  eventType: CaseCloudEventType;
}

interface PersistedCaseQueue {
  saves: Array<
    [
      string,
      PendingSave,
    ]
  >;
  deletes: string[];
}

let session: CaseCloudSession | null =
  null;

const pendingSaves =
  new Map<string, PendingSave>();

const pendingDeletes =
  new Set<string>();

let flushing = false;

/*
 * [RoadSafe:DevOfflineCacheV1Exact]
 *
 * Case records themselves are already local-first through AccidentCaseService.
 * This persists the missing part: the cloud write queue. A refresh/restart
 * while offline therefore no longer loses pending save/delete operations.
 */
function persistPendingQueue(): void {
  DevOfflineCache.write<PersistedCaseQueue>(
    DEV_OFFLINE_CACHE_KEYS.pendingCaseQueue,
    {
      saves:
        Array.from(
          pendingSaves.entries(),
        ),
      deletes:
        Array.from(
          pendingDeletes,
        ),
    },
  );
}

function hydratePendingQueue(): void {
  const stored =
    DevOfflineCache.read<PersistedCaseQueue>(
      DEV_OFFLINE_CACHE_KEYS.pendingCaseQueue,
    );

  if (!stored) {
    return;
  }

  for (
    const [
      caseId,
      pending,
    ]
    of stored.saves ?? []
  ) {
    if (
      caseId &&
      pending?.record
    ) {
      pendingSaves.set(
        caseId,
        pending,
      );
    }
  }

  for (
    const caseId
    of stored.deletes ?? []
  ) {
    if (!caseId) {
      continue;
    }

    pendingDeletes.add(
      caseId,
    );

    pendingSaves.delete(
      caseId,
    );
  }
}

hydratePendingQueue();

function emit<RecordDetail>(
  eventName: string,
  detail: RecordDetail,
): void {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail,
    }),
  );
}

async function flush(): Promise<void> {
  if (
    flushing ||
    !session
  ) {
    return;
  }

  if (
    DevOfflineCache.enabled &&
    typeof navigator !== "undefined" &&
    navigator.onLine === false
  ) {
    return;
  }

  flushing = true;

  try {
    for (
      const caseId
      of Array.from(
        pendingDeletes,
      )
    ) {
      if (!session) {
        break;
      }

      emit<CaseCloudPendingEventDetail>(
        CASE_CLOUD_PENDING_EVENT,
        { caseId },
      );

      try {
        await RoadSafeCaseFunctionService.delete(
          session.teamId,
          caseId,
        );

        pendingDeletes.delete(
          caseId,
        );

        persistPendingQueue();
      } catch (requestError) {
        emit<CaseCloudErrorEventDetail>(
          CASE_CLOUD_ERROR_EVENT,
          {
            caseId,
            message:
              requestError instanceof Error
                ? requestError.message
                : "RoadSafe could not delete the shared case.",
          },
        );
      }
    }

    for (
      const [
        caseId,
        pending,
      ]
      of Array.from(
        pendingSaves.entries(),
      )
    ) {
      if (!session) {
        break;
      }

      emit<CaseCloudPendingEventDetail>(
        CASE_CLOUD_PENDING_EVENT,
        { caseId },
      );

      try {
        const cloudRecord =
          await RoadSafeCaseFunctionService.save(
            session.teamId,
            pending.record,
            pending.eventType,
          );

        const latest =
          pendingSaves.get(
            caseId,
          );

        if (
          latest === pending
        ) {
          pendingSaves.delete(
            caseId,
          );
        }

        persistPendingQueue();

        emit<CaseCloudRecordEventDetail>(
          CASE_CLOUD_RECORD_EVENT,
          {
            record:
              cloudRecord,
          },
        );
      } catch (requestError) {
        emit<CaseCloudErrorEventDetail>(
          CASE_CLOUD_ERROR_EVENT,
          {
            caseId,
            message:
              requestError instanceof Error
                ? requestError.message
                : "RoadSafe could not synchronize the case.",
          },
        );
      }
    }
  } finally {
    flushing = false;
  }
}

if (
  typeof window !== "undefined" &&
  DevOfflineCache.enabled
) {
  window.addEventListener(
    "online",
    () => {
      void flush();
    },
  );
}

export const CaseCloudBridge = {
  configure(
    nextSession: CaseCloudSession,
  ): void {
    session = nextSession;
    void flush();
  },

  clear(): void {
    session = null;
  },

  configured(): boolean {
    return Boolean(session);
  },

  queueSave(
    record: AccidentCase,
    eventType: CaseCloudEventType = "case_updated",
  ): void {
    pendingDeletes.delete(
      record.id,
    );

    pendingSaves.set(
      record.id,
      {
        record,
        eventType,
      },
    );

    persistPendingQueue();

    emit<CaseCloudPendingEventDetail>(
      CASE_CLOUD_PENDING_EVENT,
      {
        caseId:
          record.id,
      },
    );

    void flush();
  },

  queueDelete(
    caseId: string,
  ): void {
    pendingSaves.delete(
      caseId,
    );

    pendingDeletes.add(
      caseId,
    );

    persistPendingQueue();

    emit<CaseCloudPendingEventDetail>(
      CASE_CLOUD_PENDING_EVENT,
      { caseId },
    );

    void flush();
  },

  retry(): void {
    void flush();
  },

  pendingCount(): number {
    return (
      pendingSaves.size +
      pendingDeletes.size
    );
  },
};
