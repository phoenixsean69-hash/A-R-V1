import type { RealSceneRoadGeometry } from "../types/realSceneGeometry";
import type { AccidentReconstruction } from "../types/reconstruction";

export interface ReconstructionWorldDimensions {
  widthMetres: number;
  heightMetres: number;
  source: "Extracted scene" | "Editor scene";
}

export function getReconstructionWorldDimensions(
  reconstruction: Pick<
    AccidentReconstruction,
    "scene"
  >,
): ReconstructionWorldDimensions {
  const extracted =
    reconstruction.scene.realSceneGeometry?.status === "ready"
      ? reconstruction.scene.realSceneGeometry
      : null;

  if (extracted) {
    return {
      widthMetres: Math.max(1, extracted.sceneWidthMetres),
      heightMetres: Math.max(1, extracted.sceneHeightMetres),
      source: "Extracted scene",
    };
  }

  return {
    widthMetres: Math.max(1, reconstruction.scene.sceneWidthMetres),
    heightMetres: Math.max(1, reconstruction.scene.sceneHeightMetres),
    source: "Editor scene",
  };
}

function laneWidthMetres(highwayType: string): number {
  if (["motorway", "trunk", "primary"].includes(highwayType)) return 3.45;
  if (["secondary", "tertiary"].includes(highwayType)) return 3.25;
  if (["service", "living_street", "track"].includes(highwayType)) return 2.85;
  return 3.1;
}

/**
 * Keeps the extracted centreline and scene metre scale unchanged while making
 * the rendered ribbon wide enough for the mapped lane count. OSM frequently
 * supplies lane count without a reliable width tag; this only corrects that
 * visual/physical under-reporting and never scales the whole scene.
 */
export function getEffectiveRealRoadWidthMetres(
  road: Pick<RealSceneRoadGeometry, "highwayType" | "laneCount" | "widthMetres">,
): number {
  const lanes = Math.max(1, road.laneCount || 1);
  const reportedWidth = Math.max(2.4, Number(road.widthMetres) || 0);
  const laneBasedMinimum = lanes * laneWidthMetres(road.highwayType);
  const roadTypeMinimum = ["motorway", "trunk"].includes(road.highwayType)
    ? Math.max(lanes === 1 ? 3.65 : 7.2, lanes * 3.45)
    : ["service", "living_street", "track"].includes(road.highwayType)
      ? 3.2
      : lanes === 1
        ? 3.2
        : 5.5;

  return Number(
    Math.max(reportedWidth, laneBasedMinimum, roadTypeMinimum).toFixed(2),
  );
}

/**
 * Purely visual widening applied to the rendered road ribbon only. Routing,
 * physics and containment checks always use getEffectiveRealRoadWidthMetres;
 * this multiplier just makes the drawn road more generous for zooming and
 * manual participant placement.
 */
export const ROAD_DISPLAY_WIDTH_SCALE = 1.35;

export function getDisplayRealRoadWidthMetres(
  road: Pick<RealSceneRoadGeometry, "highwayType" | "laneCount" | "widthMetres">,
): number {
  return Number(
    (getEffectiveRealRoadWidthMetres(road) * ROAD_DISPLAY_WIDTH_SCALE).toFixed(
      2,
    ),
  );
}
