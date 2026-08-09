import type {
  ReconstructionPosition,
} from "./reconstruction";

export type UniversalTransformMode =
  | "Move"
  | "Rotate"
  | "Scale";

export interface UniversalTransformValue {
  position:
    ReconstructionPosition;

  rotationDegrees:
    number;

  scale:
    number;
}

export type RealSceneEditableFeatureKind =
  | "road"
  | "path"
  | "building"
  | "barrier"
  | "land-cover"
  | "vegetation";

export interface RealSceneFeatureSelection {
  kind:
    RealSceneEditableFeatureKind;

  featureId:
    string;
}

/**
 * Non-destructive correction layered on top of immutable source geometry.
 *
 * The original OSM geometry stays in RoadSceneSettings.realSceneGeometry.
 * This record says how an investigator corrected that source feature.
 */
export interface RealSceneFeatureTransform {
  schemaVersion:
    "RoadSafe Real Scene Transform V1";

  featureId:
    string;

  featureKind:
    RealSceneEditableFeatureKind;

  translationEastMetres:
    number;

  translationNorthMetres:
    number;

  rotationDegrees:
    number;

  scale:
    number;

  correctedAt:
    string;

  correctedBy?:
    string;

  reason?:
    string;
}
