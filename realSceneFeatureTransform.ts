import type {
  RealSceneGeometry,
  RealSceneLocalPoint,
} from "../types/realSceneGeometry";

import type {
  RealSceneFeatureSelection,
  RealSceneFeatureTransform,
} from "../types/reconstructionTransform";

import type {
  ReconstructionPosition,
} from "../types/reconstruction";

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

function centroid(
  points:
    RealSceneLocalPoint[],
): {
  xMetres: number;
  yMetres: number;
} {
  if (
    points.length ===
    0
  ) {
    return {
      xMetres: 0,
      yMetres: 0,
    };
  }

  const total =
    points.reduce(
      (
        current,
        point,
      ) => ({
        xMetres:
          current.xMetres +
          point.xMetres,
        yMetres:
          current.yMetres +
          point.yMetres,
      }),
      {
        xMetres: 0,
        yMetres: 0,
      },
    );

  return {
    xMetres:
      total.xMetres /
      points.length,
    yMetres:
      total.yMetres /
      points.length,
  };
}

function toPercent(
  point: {
    xMetres: number;
    yMetres: number;
  },
  geometry:
    RealSceneGeometry,
): ReconstructionPosition {
  return {
    x:
      clamp(
        (
          point.xMetres /
          Math.max(
            0.001,
            geometry.sceneWidthMetres,
          )
        ) *
          100,
        0,
        100,
      ),

    y:
      clamp(
        100 -
          (
            point.yMetres /
            Math.max(
              0.001,
              geometry.sceneHeightMetres,
            )
          ) *
            100,
        0,
        100,
      ),
  };
}

function transformLocalPoint(
  point:
    RealSceneLocalPoint,
  centre: {
    xMetres: number;
    yMetres: number;
  },
  transform:
    RealSceneFeatureTransform,
  geometry:
    RealSceneGeometry,
): RealSceneLocalPoint {
  const radians =
    (
      transform.rotationDegrees *
      Math.PI
    ) /
    180;

  const cosine =
    Math.cos(
      radians,
    );

  const sine =
    Math.sin(
      radians,
    );

  const scale =
    clamp(
      transform.scale,
      0.15,
      8,
    );

  const offsetX =
    (
      point.xMetres -
      centre.xMetres
    ) *
    scale;

  const offsetY =
    (
      point.yMetres -
      centre.yMetres
    ) *
    scale;

  const rotatedX =
    offsetX *
      cosine -
    offsetY *
      sine;

  const rotatedY =
    offsetX *
      sine +
    offsetY *
      cosine;

  const xMetres =
    centre.xMetres +
    rotatedX +
    transform.translationEastMetres;

  const yMetres =
    centre.yMetres +
    rotatedY +
    transform.translationNorthMetres;

  return {
    ...point,

    xMetres,
    yMetres,

    xPercent:
      clamp(
        (
          xMetres /
          Math.max(
            0.001,
            geometry.sceneWidthMetres,
          )
        ) *
          100,
        0,
        100,
      ),

    yPercent:
      clamp(
        100 -
          (
            yMetres /
            Math.max(
              0.001,
              geometry.sceneHeightMetres,
            )
          ) *
            100,
        0,
        100,
      ),
  };
}

function transformPoints(
  points:
    RealSceneLocalPoint[],
  transform:
    RealSceneFeatureTransform,
  geometry:
    RealSceneGeometry,
): RealSceneLocalPoint[] {
  const centre =
    centroid(
      points,
    );

  return points.map(
    (
      point,
    ) =>
      transformLocalPoint(
        point,
        centre,
        transform,
        geometry,
      ),
  );
}

function transformFor(
  transforms:
    RealSceneFeatureTransform[],
  selection:
    RealSceneFeatureSelection,
): RealSceneFeatureTransform | null {
  return (
    transforms.find(
      (
        transform,
      ) =>
        transform.featureId ===
          selection.featureId &&
        transform.featureKind ===
          selection.kind,
    ) ??
    null
  );
}

export function getRealSceneFeatureTransform(
  transforms:
    RealSceneFeatureTransform[] |
    undefined,
  selection:
    RealSceneFeatureSelection |
    null,
): RealSceneFeatureTransform | null {
  if (
    !selection
  ) {
    return null;
  }

  return transformFor(
    transforms ??
      [],
    selection,
  );
}

export function upsertRealSceneFeatureTransform(
  transforms:
    RealSceneFeatureTransform[] |
    undefined,
  next:
    RealSceneFeatureTransform,
): RealSceneFeatureTransform[] {
  const source =
    transforms ??
    [];

  const found =
    source.some(
      (
        transform,
      ) =>
        transform.featureId ===
          next.featureId &&
        transform.featureKind ===
          next.featureKind,
    );

  if (
    !found
  ) {
    return [
      ...source,
      next,
    ];
  }

  return source.map(
    (
      transform,
    ) =>
      transform.featureId ===
        next.featureId &&
      transform.featureKind ===
        next.featureKind
        ? next
        : transform,
  );
}

export function removeRealSceneFeatureTransform(
  transforms:
    RealSceneFeatureTransform[] |
    undefined,
  selection:
    RealSceneFeatureSelection,
): RealSceneFeatureTransform[] {
  return (
    transforms ??
    []
  ).filter(
    (
      transform,
    ) =>
      !(
        transform.featureId ===
          selection.featureId &&
        transform.featureKind ===
          selection.kind
      ),
  );
}

export function applyRealSceneFeatureTransforms(
  geometry:
    RealSceneGeometry,
  transforms:
    RealSceneFeatureTransform[] |
    undefined,
): RealSceneGeometry {
  const corrections =
    transforms ??
    [];

  if (
    corrections.length ===
    0
  ) {
    return geometry;
  }

  const correction =
    (
      kind:
        RealSceneFeatureSelection["kind"],
      featureId:
        string,
    ) =>
      transformFor(
        corrections,
        {
          kind,
          featureId,
        },
      );

  return {
    ...geometry,

    roads:
      geometry.roads.map(
        (
          road,
        ) => {
          const transform =
            correction(
              "road",
              road.id,
            );

          if (
            !transform
          ) {
            return road;
          }

          return {
            ...road,

            localPoints:
              transformPoints(
                road.localPoints,
                transform,
                geometry,
              ),

            widthMetres:
              road.widthMetres *
              transform.scale,
          };
        },
      ),

    paths:
      geometry.paths.map(
        (
          path,
        ) => {
          const transform =
            correction(
              "path",
              path.id,
            );

          if (
            !transform
          ) {
            return path;
          }

          return {
            ...path,

            localPoints:
              transformPoints(
                path.localPoints,
                transform,
                geometry,
              ),

            widthMetres:
              path.widthMetres *
              transform.scale,
          };
        },
      ),

    buildings:
      geometry.buildings.map(
        (
          building,
        ) => {
          const transform =
            correction(
              "building",
              building.id,
            );

          if (
            !transform
          ) {
            return building;
          }

          return {
            ...building,

            localPoints:
              transformPoints(
                building.localPoints,
                transform,
                geometry,
              ),

            heightMetres:
              building.heightMetres *
              transform.scale,
          };
        },
      ),

    barriers:
      geometry.barriers.map(
        (
          barrier,
        ) => {
          const transform =
            correction(
              "barrier",
              barrier.id,
            );

          if (
            !transform
          ) {
            return barrier;
          }

          return {
            ...barrier,

            localPoints:
              transformPoints(
                barrier.localPoints,
                transform,
                geometry,
              ),

            heightMetres:
              barrier.heightMetres *
              transform.scale,
          };
        },
      ),

    landCover:
      (
        geometry.landCover ??
        []
      ).map(
        (
          cover,
        ) => {
          const transform =
            correction(
              "land-cover",
              cover.id,
            );

          if (
            !transform
          ) {
            return cover;
          }

          return {
            ...cover,

            localPoints:
              transformPoints(
                cover.localPoints,
                transform,
                geometry,
              ),
          };
        },
      ),

    vegetation:
      (
        geometry.vegetation ??
        []
      ).map(
        (
          plant,
        ) => {
          const transform =
            correction(
              "vegetation",
              plant.id,
            );

          if (
            !transform
          ) {
            return plant;
          }

          const localPosition =
            transformLocalPoint(
              plant.localPosition,
              {
                xMetres:
                  plant.localPosition.xMetres,
                yMetres:
                  plant.localPosition.yMetres,
              },
              transform,
              geometry,
            );

          return {
            ...plant,

            localPosition,

            heightMetres:
              plant.heightMetres *
              transform.scale,

            canopyDiameterMetres:
              plant.canopyDiameterMetres *
              transform.scale,
          };
        },
      ),
  };
}

export function getRealSceneFeatureAnchor(
  geometry:
    RealSceneGeometry,
  selection:
    RealSceneFeatureSelection,
): ReconstructionPosition | null {
  switch (
    selection.kind
  ) {
    case "road": {
      const feature =
        geometry.roads.find(
          (
            item,
          ) =>
            item.id ===
            selection.featureId,
        );

      return feature
        ? toPercent(
            centroid(
              feature.localPoints,
            ),
            geometry,
          )
        : null;
    }

    case "path": {
      const feature =
        geometry.paths.find(
          (
            item,
          ) =>
            item.id ===
            selection.featureId,
        );

      return feature
        ? toPercent(
            centroid(
              feature.localPoints,
            ),
            geometry,
          )
        : null;
    }

    case "building": {
      const feature =
        geometry.buildings.find(
          (
            item,
          ) =>
            item.id ===
            selection.featureId,
        );

      return feature
        ? toPercent(
            centroid(
              feature.localPoints,
            ),
            geometry,
          )
        : null;
    }

    case "barrier": {
      const feature =
        geometry.barriers.find(
          (
            item,
          ) =>
            item.id ===
            selection.featureId,
        );

      return feature
        ? toPercent(
            centroid(
              feature.localPoints,
            ),
            geometry,
          )
        : null;
    }

    case "land-cover": {
      const feature =
        (
          geometry.landCover ??
          []
        ).find(
          (
            item,
          ) =>
            item.id ===
            selection.featureId,
        );

      return feature
        ? toPercent(
            centroid(
              feature.localPoints,
            ),
            geometry,
          )
        : null;
    }

    case "vegetation": {
      const feature =
        (
          geometry.vegetation ??
          []
        ).find(
          (
            item,
          ) =>
            item.id ===
            selection.featureId,
        );

      return feature
        ? toPercent(
            feature.localPosition,
            geometry,
          )
        : null;
    }

    default:
      return null;
  }
}

export function getCorrectedRealSceneFeatureAnchor(
  geometry:
    RealSceneGeometry,
  transforms:
    RealSceneFeatureTransform[] |
    undefined,
  selection:
    RealSceneFeatureSelection,
): ReconstructionPosition | null {
  return getRealSceneFeatureAnchor(
    applyRealSceneFeatureTransforms(
      geometry,
      transforms,
    ),
    selection,
  );
}
