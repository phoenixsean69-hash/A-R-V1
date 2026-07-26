import type { GeoCoordinate } from "./fieldPlacement";

export type ARExperienceMode =
  | "immersive-ar"
  | "camera-overlay"
  | "desktop-preview";

export type ARSupportState =
  | "checking"
  | "immersive-ar"
  | "camera-overlay"
  | "unsupported";

export type ARCalibrationStage =
  | "permissions"
  | "scan"
  | "heading"
  | "locked";

export interface ARSceneAlignment {
  version: 1;
  caseId: string;
  reconstructionId: string;
  mode: ARExperienceMode;

  /**
   * Clockwise rotation applied to the complete reconstruction after the
   * collision point has been anchored to the real surface.
   */
  headingDegrees: number;

  /**
   * Uniform scale. Immersive AR normally remains at 1 because the
   * reconstruction canvas already represents physical metres.
   */
  scale: number;

  /**
   * Vertical correction relative to the detected real-world surface.
   */
  groundOffsetMetres: number;

  siteCoordinate?: GeoCoordinate;
  deviceHeadingDegrees?: number;
  locationAccuracyMetres?: number;

  calibratedBy: string;
  calibratedAt: string;
}
