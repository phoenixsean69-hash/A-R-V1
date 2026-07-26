import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "./AuthContext";
import { AccidentCaseService } from "../services/accidentCaseService";
import {
  CASE_CLOUD_ERROR_EVENT,
  CASE_CLOUD_PENDING_EVENT,
  CASE_CLOUD_RECORD_EVENT,
  CaseCloudBridge,
} from "../services/caseCloudBridge";
import { RoadSafeCaseFunctionService } from "../services/roadSafeCaseFunctionService";
import type {
  CaseCloudErrorEventDetail,
  CaseCloudRecordEventDetail,
} from "../types/caseCloud";

export type CaseSyncStatus =
  | "idle"
  | "loading"
  | "syncing"
  | "synced"
  | "error";

interface CaseSyncContextValue {
  status: CaseSyncStatus;
  error: string;
  revision: number;
  localOnlyCount: number;
  lastSyncedAt: string;
  canImportLocalCases: boolean;
  refresh(): Promise<void>;
  importLocalCases(): Promise<void>;
  retryPending(): void;
}

const CaseSyncContext =
  createContext<CaseSyncContextValue | null>(
    null,
  );

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "RoadSafe could not synchronize the shared case register.";
}

export function CaseSyncProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { status: authStatus, identity } =
    useAuth();

  const [status, setStatus] =
    useState<CaseSyncStatus>("idle");
  const [error, setError] =
    useState("");
  const [revision, setRevision] =
    useState(0);
  const [localOnlyCount, setLocalOnlyCount] =
    useState(0);
  const [lastSyncedAt, setLastSyncedAt] =
    useState("");

  const cloudIdsRef =
    useRef<Set<string>>(
      new Set(),
    );

  const stationTeamId =
    identity?.stationTeam?.$id ??
    "";

  const assignedRole =
    identity?.role &&
    identity.role !==
      "unassigned"
      ? identity.role
      : null;

  const recomputeLocalOnly =
    useCallback(() => {
      const localOnly =
        AccidentCaseService.getLocalOnlyCases(
          cloudIdsRef.current,
        );

      setLocalOnlyCount(
        localOnly.length,
      );
    }, []);

  const refresh =
    useCallback(async () => {
      if (
        authStatus !==
          "authenticated" ||
        !identity ||
        !stationTeamId ||
        !assignedRole
      ) {
        setStatus("idle");
        return;
      }

      setStatus(
        "loading",
      );
      setError("");

      try {
        const cloudCases =
          await RoadSafeCaseFunctionService.list(
            stationTeamId,
          );

        cloudIdsRef.current =
          new Set(
            cloudCases.map(
              (record) =>
                record.id,
            ),
          );

        AccidentCaseService.applyCloudSnapshot(
          cloudCases,
        );

        recomputeLocalOnly();
        setRevision(
          (current) =>
            current + 1,
        );
        setLastSyncedAt(
          new Date().toISOString(),
        );
        setStatus(
          CaseCloudBridge.pendingCount() >
            0
            ? "syncing"
            : "synced",
        );
      } catch (requestError) {
        setStatus("error");
        setError(
          errorMessage(
            requestError,
          ),
        );
      }
    }, [
      assignedRole,
      authStatus,
      identity,
      recomputeLocalOnly,
      stationTeamId,
    ]);

  useEffect(() => {
    const onCloudRecord = (
      event: Event,
    ) => {
      const detail =
        (
          event as CustomEvent<CaseCloudRecordEventDetail>
        ).detail;

      if (!detail?.record) {
        return;
      }

      AccidentCaseService.mergeCloudRecord(
        detail.record,
      );

      cloudIdsRef.current.add(
        detail.record.id,
      );

      recomputeLocalOnly();
      setRevision(
        (current) =>
          current + 1,
      );
      setError("");
      setLastSyncedAt(
        new Date().toISOString(),
      );
      setStatus(
        CaseCloudBridge.pendingCount() >
          0
          ? "syncing"
          : "synced",
      );
    };

    const onCloudError = (
      event: Event,
    ) => {
      const detail =
        (
          event as CustomEvent<CaseCloudErrorEventDetail>
        ).detail;

      setStatus("error");
      setError(
        detail?.message ||
          "RoadSafe could not synchronize a case.",
      );
      setRevision(
        (current) =>
          current + 1,
      );
    };

    const onCloudPending = () => {
      setStatus(
        "syncing",
      );
      setError("");
      setRevision(
        (current) =>
          current + 1,
      );
    };

    window.addEventListener(
      CASE_CLOUD_RECORD_EVENT,
      onCloudRecord,
    );
    window.addEventListener(
      CASE_CLOUD_ERROR_EVENT,
      onCloudError,
    );
    window.addEventListener(
      CASE_CLOUD_PENDING_EVENT,
      onCloudPending,
    );

    return () => {
      window.removeEventListener(
        CASE_CLOUD_RECORD_EVENT,
        onCloudRecord,
      );
      window.removeEventListener(
        CASE_CLOUD_ERROR_EVENT,
        onCloudError,
      );
      window.removeEventListener(
        CASE_CLOUD_PENDING_EVENT,
        onCloudPending,
      );
    };
  }, [recomputeLocalOnly]);

  useEffect(() => {
    if (
      authStatus ===
        "authenticated" &&
      identity &&
      stationTeamId &&
      assignedRole
    ) {
      CaseCloudBridge.configure({
        teamId:
          stationTeamId,
        userId:
          identity.user.$id,
        role:
          assignedRole,
      });

      void refresh();

      const interval =
        window.setInterval(
          () => {
            if (
              document.visibilityState ===
              "visible"
            ) {
              void refresh();
            }
          },
          20_000,
        );

      return () => {
        window.clearInterval(
          interval,
        );
        CaseCloudBridge.clear();
      };
    }

    CaseCloudBridge.clear();
    cloudIdsRef.current =
      new Set();
    setStatus("idle");
    setError("");
    setLocalOnlyCount(0);
    setLastSyncedAt("");

    return undefined;
  }, [
    assignedRole,
    authStatus,
    identity,
    refresh,
    stationTeamId,
  ]);

  const importLocalCases =
    useCallback(async () => {
      if (
        !stationTeamId ||
        identity?.role !==
          "station_admin"
      ) {
        throw new Error(
          "Only a Station Administrator can import legacy local cases.",
        );
      }

      const records =
        AccidentCaseService.getLocalOnlyCases(
          cloudIdsRef.current,
        );

      if (
        records.length === 0
      ) {
        setLocalOnlyCount(0);
        return;
      }

      setStatus(
        "syncing",
      );
      setError("");

      try {
        const response =
          await RoadSafeCaseFunctionService.importLocalCases(
            stationTeamId,
            records,
          );

        for (
          const record
          of response.importedCases ??
          []
        ) {
          AccidentCaseService.mergeCloudRecord(
            record,
          );
          cloudIdsRef.current.add(
            record.id,
          );
        }

        await refresh();
      } catch (requestError) {
        setStatus("error");
        setError(
          errorMessage(
            requestError,
          ),
        );
        throw requestError;
      }
    }, [
      identity?.role,
      refresh,
      stationTeamId,
    ]);

  const retryPending =
    useCallback(() => {
      setStatus("syncing");
      setError("");
      CaseCloudBridge.retry();
      void refresh();
    }, [refresh]);

  const value =
    useMemo<CaseSyncContextValue>(
      () => ({
        status,
        error,
        revision,
        localOnlyCount,
        lastSyncedAt,
        canImportLocalCases:
          identity?.role ===
          "station_admin",
        refresh,
        importLocalCases,
        retryPending,
      }),
      [
        error,
        identity?.role,
        importLocalCases,
        lastSyncedAt,
        localOnlyCount,
        refresh,
        retryPending,
        revision,
        status,
      ],
    );

  return (
    <CaseSyncContext.Provider
      value={value}
    >
      {children}
    </CaseSyncContext.Provider>
  );
}

export function useCaseSync(): CaseSyncContextValue {
  const context =
    useContext(
      CaseSyncContext,
    );

  if (!context) {
    throw new Error(
      "useCaseSync must be used inside CaseSyncProvider.",
    );
  }

  return context;
}
