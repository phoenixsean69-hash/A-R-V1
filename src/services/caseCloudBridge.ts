import type { AccidentCase } from "../types/accidentCase";
import type {
  CaseCloudErrorEventDetail,
  CaseCloudEventType,
  CaseCloudPendingEventDetail,
  CaseCloudRecordEventDetail,
  CaseCloudSession,
} from "../types/caseCloud";
import { RoadSafeCaseFunctionService } from "./roadSafeCaseFunctionService";

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

let session: CaseCloudSession | null =
  null;

const pendingSaves =
  new Map<string, PendingSave>();

const pendingDeletes =
  new Set<string>();

let flushing = false;

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

  flushing = true;

  try {
    for (
      const caseId
      of Array.from(
        pendingDeletes,
      )
    ) {
      if (!session) break;

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
      if (!session) break;

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
    pendingSaves.delete(caseId);
    pendingDeletes.add(caseId);

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
