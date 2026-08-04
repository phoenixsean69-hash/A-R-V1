import * as THREE from "three";

import type {
  ReconstructionPosition,
} from "../types/reconstruction";

/**
 * Converts RoadSafe's shared 2D reconstruction coordinates into the Three.js
 * ground plane.
 *
 * RoadSafe scene coordinates use:
 * - X: 0 at the left edge, 100 at the right edge.
 * - Y: 0 at the top edge, 100 at the bottom edge.
 *
 * Extracted OSM geometry is rendered in Three.js with:
 * - X increasing to the right.
 * - Z increasing towards the bottom of the 2D reconstruction.
 *
 * Keeping this conversion in one module prevents the 3D viewer and AR viewer
 * from accidentally mirroring participants relative to the extracted road.
 */
export function reconstructionPositionToThreeVector(
  position: ReconstructionPosition,
  sceneWidthMetres: number,
  sceneHeightMetres: number,
  elevationMetres = 0,
): THREE.Vector3 {
  return new THREE.Vector3(
    (
      position.x / 100 -
      0.5
    ) *
      sceneWidthMetres,
    elevationMetres,
    (
      position.y / 100 -
      0.5
    ) *
      sceneHeightMetres,
  );
}

/**
 * RoadSafe headings increase clockwise in the 2D editor because screen-space
 * Y increases downwards. Three.js positive Y rotation is counter-clockwise
 * when viewed from above, so the heading sign must be inverted.
 */
export function reconstructionHeadingToThreeYawRadians(
  headingDegrees: number,
): number {
  if (!Number.isFinite(headingDegrees)) {
    return 0;
  }

  return -THREE.MathUtils.degToRad(
    headingDegrees,
  );
}
