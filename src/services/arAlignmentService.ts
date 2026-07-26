import type {
  ARExperienceMode,
  ARSceneAlignment,
} from "../types/arReconstruction";

const STORAGE_PREFIX =
  "roadsafe-ar-scene-alignment-v1";

function storageKey(
  caseId: string,
  reconstructionId: string,
): string {
  return `${STORAGE_PREFIX}:${caseId}:${reconstructionId}`;
}

function finiteNumber(
  value: unknown,
  fallback: number,
): number {
  return Number.isFinite(Number(value))
    ? Number(value)
    : fallback;
}

function normalise(
  value: Partial<ARSceneAlignment>,
  caseId: string,
  reconstructionId: string,
): ARSceneAlignment {
  const mode: ARExperienceMode =
    value.mode === "camera-overlay" ||
    value.mode === "desktop-preview"
      ? value.mode
      : "immersive-ar";

  return {
    version: 1,
    caseId,
    reconstructionId,
    mode,
    headingDegrees:
      finiteNumber(
        value.headingDegrees,
        0,
      ),
    scale: Math.min(
      2,
      Math.max(
        0.05,
        finiteNumber(
          value.scale,
          1,
        ),
      ),
    ),
    groundOffsetMetres:
      Math.min(
        2,
        Math.max(
          -2,
          finiteNumber(
            value.groundOffsetMetres,
            0,
          ),
        ),
      ),
    siteCoordinate:
      value.siteCoordinate,
    deviceHeadingDegrees:
      value.deviceHeadingDegrees,
    locationAccuracyMetres:
      value.locationAccuracyMetres,
    calibratedBy:
      value.calibratedBy?.trim() ||
      "Unknown officer",
    calibratedAt:
      value.calibratedAt ||
      new Date().toISOString(),
  };
}

export const ARAlignmentService = {
  get(
    caseId: string,
    reconstructionId: string,
  ): ARSceneAlignment | null {
    try {
      const raw =
        localStorage.getItem(
          storageKey(
            caseId,
            reconstructionId,
          ),
        );

      if (!raw) {
        return null;
      }

      const parsed =
        JSON.parse(
          raw,
        ) as Partial<ARSceneAlignment>;

      return normalise(
        parsed,
        caseId,
        reconstructionId,
      );
    } catch (error) {
      console.warn(
        "RoadSafe could not read the saved AR alignment.",
        error,
      );
      return null;
    }
  },

  save(
    alignment: ARSceneAlignment,
  ): ARSceneAlignment {
    const normalised =
      normalise(
        alignment,
        alignment.caseId,
        alignment.reconstructionId,
      );

    localStorage.setItem(
      storageKey(
        alignment.caseId,
        alignment.reconstructionId,
      ),
      JSON.stringify(
        normalised,
      ),
    );

    return normalised;
  },

  clear(
    caseId: string,
    reconstructionId: string,
  ): void {
    try {
      localStorage.removeItem(
        storageKey(
          caseId,
          reconstructionId,
        ),
      );
    } catch (error) {
      console.warn(
        "RoadSafe could not clear the saved AR alignment.",
        error,
      );
    }
  },
};
