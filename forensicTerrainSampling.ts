import * as THREE from "three";

import type {
  ForensicTerrainGrid,
} from "../types/forensicScenePipeline";

export type ForensicTerrainHeightSampler =
  (
    xMetres: number,
    zMetres: number,
  ) => number;

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function terrainIsUsable(
  terrain:
    ForensicTerrainGrid |
    undefined,
): terrain is ForensicTerrainGrid {
  return Boolean(
    terrain &&
      terrain.status ===
        "ready" &&
      terrain.rows >=
        2 &&
      terrain.columns >=
        2 &&
      terrain.elevationsMetres.length ===
        terrain.rows *
          terrain.columns,
  );
}

function sampleGrid(
  terrain:
    ForensicTerrainGrid,
  column:
    number,
  row:
    number,
): number {
  const safeColumn =
    clamp(
      column,
      0,
      terrain.columns -
        1,
    );

  const safeRow =
    clamp(
      row,
      0,
      terrain.rows -
        1,
    );

  return (
    terrain.elevationsMetres[
      safeRow *
        terrain.columns +
        safeColumn
    ] ??
    terrain.originElevationMetres
  );
}

/**
 * Converts the forensic DEM into a reconstruction-world height function.
 *
 * RoadSafe world:
 *   X = East
 *   Y = Up
 *   Z = North
 *
 * Terrain rows are stored south -> north and columns west -> east.
 * Returned heights are relative to the accident-anchor elevation so the
 * reconstruction remains numerically stable around Y=0.
 */
export function createForensicTerrainHeightSampler({
  terrain,
  sceneWidthMetres,
  sceneHeightMetres,
  exaggeration = 1,
}: {
  terrain:
    ForensicTerrainGrid |
    undefined;
  sceneWidthMetres:
    number;
  sceneHeightMetres:
    number;
  exaggeration?:
    number;
}): ForensicTerrainHeightSampler {
  if (
    !terrainIsUsable(
      terrain,
    )
  ) {
    return () =>
      0;
  }

  const width =
    Math.max(
      0.001,
      sceneWidthMetres,
    );

  const height =
    Math.max(
      0.001,
      sceneHeightMetres,
    );

  const verticalScale =
    Number.isFinite(
      exaggeration,
    )
      ? Math.max(
          0,
          exaggeration,
        )
      : 1;

  const base =
    terrain.originElevationMetres;

  return (
    xMetres,
    zMetres,
  ) => {
    const eastProgress =
      clamp(
        (
          xMetres +
          width /
            2
        ) /
          width,
        0,
        1,
      );

    /*
     * World +Z is south in the existing Three.js conversion:
     * local north metres increase while world Z decreases.
     */
    const northProgress =
      clamp(
        (
          height /
            2 -
          zMetres
        ) /
          height,
        0,
        1,
      );

    const gridX =
      eastProgress *
      (
        terrain.columns -
        1
      );

    const gridY =
      northProgress *
      (
        terrain.rows -
        1
      );

    const x0 =
      Math.floor(
        gridX,
      );

    const y0 =
      Math.floor(
        gridY,
      );

    const x1 =
      Math.min(
        terrain.columns -
          1,
        x0 +
          1,
      );

    const y1 =
      Math.min(
        terrain.rows -
          1,
        y0 +
          1,
      );

    const fx =
      gridX -
      x0;

    const fy =
      gridY -
      y0;

    const southWest =
      sampleGrid(
        terrain,
        x0,
        y0,
      );

    const southEast =
      sampleGrid(
        terrain,
        x1,
        y0,
      );

    const northWest =
      sampleGrid(
        terrain,
        x0,
        y1,
      );

    const northEast =
      sampleGrid(
        terrain,
        x1,
        y1,
      );

    const south =
      southWest +
      (
        southEast -
        southWest
      ) *
        fx;

    const north =
      northWest +
      (
        northEast -
        northWest
      ) *
        fx;

    const elevation =
      south +
      (
        north -
        south
      ) *
        fy;

    return (
      elevation -
      base
    ) *
      verticalScale;
  };
}

/**
 * Creates the visible terrain surface from the same DEM used by heightAt().
 * No extra terrain source is introduced.
 */
export function createForensicTerrainMesh({
  terrain,
  sceneWidthMetres,
  sceneHeightMetres,
  exaggeration = 1,
}: {
  terrain:
    ForensicTerrainGrid |
    undefined;
  sceneWidthMetres:
    number;
  sceneHeightMetres:
    number;
  exaggeration?:
    number;
}): THREE.Mesh | null {
  if (
    !terrainIsUsable(
      terrain,
    )
  ) {
    return null;
  }

  const width =
    Math.max(
      0.001,
      sceneWidthMetres,
    );

  const height =
    Math.max(
      0.001,
      sceneHeightMetres,
    );

  const heightAt =
    createForensicTerrainHeightSampler({
      terrain,
      sceneWidthMetres:
        width,
      sceneHeightMetres:
        height,
      exaggeration,
    });

  const positions:
    number[] =
    [];

  const uvs:
    number[] =
    [];

  for (
    let row =
      0;
    row <
      terrain.rows;
    row +=
      1
  ) {
    const northProgress =
      row /
      (
        terrain.rows -
        1
      );

    const z =
      height /
        2 -
      northProgress *
        height;

    for (
      let column =
        0;
      column <
        terrain.columns;
      column +=
        1
    ) {
      const eastProgress =
        column /
        (
          terrain.columns -
          1
        );

      const x =
        -width /
          2 +
        eastProgress *
          width;

      positions.push(
        x,
        heightAt(
          x,
          z,
        ),
        z,
      );

      uvs.push(
        eastProgress,
        northProgress,
      );
    }
  }

  const indices:
    number[] =
    [];

  for (
    let row =
      0;
    row <
      terrain.rows -
        1;
    row +=
      1
  ) {
    for (
      let column =
        0;
      column <
        terrain.columns -
          1;
      column +=
        1
    ) {
      const a =
        row *
          terrain.columns +
        column;

      const b =
        a +
        1;

      const c =
        a +
        terrain.columns;

      const d =
        c +
        1;

      indices.push(
        a,
        c,
        b,
        b,
        c,
        d,
      );
    }
  }

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3,
    ),
  );

  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      uvs,
      2,
    ),
  );

  geometry.setIndex(
    indices,
  );

  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material =
    new THREE.MeshStandardMaterial({
      color:
        0x4b584a,
      roughness:
        1,
      metalness:
        0,
      side:
        THREE.DoubleSide,
    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material,
    );

  mesh.receiveShadow =
    true;

  mesh.userData.roadsafeForensicTerrain =
    true;

  mesh.userData.terrainProvider =
    terrain.provider;

  mesh.userData.terrainReliefMetres =
    terrain.reliefMetres;

  return mesh;
}
