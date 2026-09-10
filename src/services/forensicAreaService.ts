import type {
  RealSceneAreaSelection,
  RealSceneBounds,
  RealSceneGeoPoint,
} from "../types/realSceneGeometry";

import type {
  RoadDetectionCoordinate,
} from "../types/roadLayoutDetection";

import type {
  ForensicAreaSnapshot,
  ForensicLocalMetricFrame,
} from "../types/forensicScenePipeline";

const METRES_PER_LATITUDE_DEGREE =
  110_540;

function createId(
  prefix: string,
): string {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

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

export function metresPerLongitudeDegree(
  latitudeDegrees: number,
): number {
  return (
    111_320 *
    Math.max(
      0.000001,
      Math.cos(
        (latitudeDegrees *
          Math.PI) /
          180,
      ),
    )
  );
}

export function dimensionsForBounds(
  bounds: RealSceneBounds,
) {
  const centreLatitude =
    (bounds.north +
      bounds.south) /
    2;

  const width =
    Math.max(
      0,
      (bounds.east -
        bounds.west) *
        metresPerLongitudeDegree(
          centreLatitude,
        ),
    );

  const height =
    Math.max(
      0,
      (bounds.north -
        bounds.south) *
        METRES_PER_LATITUDE_DEGREE,
    );

  return {
    width,
    height,
    areaSquareMetres:
      width * height,
  };
}

export function coordinateInsideBounds(
  coordinate: {
    latitude: number;
    longitude: number;
  },
  bounds: RealSceneBounds,
): boolean {
  return (
    coordinate.latitude >=
      bounds.south &&
    coordinate.latitude <=
      bounds.north &&
    coordinate.longitude >=
      bounds.west &&
    coordinate.longitude <=
      bounds.east
  );
}

function polygonForBounds(
  bounds: RealSceneBounds,
): RealSceneGeoPoint[] {
  return [
    {
      latitude:
        bounds.south,
      longitude:
        bounds.west,
    },
    {
      latitude:
        bounds.south,
      longitude:
        bounds.east,
    },
    {
      latitude:
        bounds.north,
      longitude:
        bounds.east,
    },
    {
      latitude:
        bounds.north,
      longitude:
        bounds.west,
    },
    {
      latitude:
        bounds.south,
      longitude:
        bounds.west,
    },
  ];
}

function normalisedPolygon(
  polygon:
    RealSceneGeoPoint[],
): RealSceneGeoPoint[] {
  if (
    polygon.length < 3
  ) {
    return [];
  }

  const result =
    polygon.map(
      (point) => ({
        latitude:
          point.latitude,
        longitude:
          point.longitude,
      }),
    );

  const first =
    result[0];

  const last =
    result[
      result.length - 1
    ];

  if (
    first.latitude !==
      last.latitude ||
    first.longitude !==
      last.longitude
  ) {
    result.push({
      ...first,
    });
  }

  return result;
}

export function pointInsidePolygon(
  coordinate: {
    latitude: number;
    longitude: number;
  },
  polygon:
    RealSceneGeoPoint[],
): boolean {
  const ring =
    normalisedPolygon(
      polygon,
    );

  if (
    ring.length < 4
  ) {
    return false;
  }

  let inside = false;

  for (
    let index = 0,
      previousIndex =
        ring.length - 1;
    index < ring.length;
    previousIndex = index,
      index += 1
  ) {
    const current =
      ring[index];

    const previous =
      ring[
        previousIndex
      ];

    const crosses =
      (current.latitude >
        coordinate.latitude) !==
        (previous.latitude >
          coordinate.latitude) &&
      coordinate.longitude <
        ((previous.longitude -
          current.longitude) *
          (coordinate.latitude -
            current.latitude)) /
          Math.max(
            1e-12,
            previous.latitude -
              current.latitude,
          ) +
          current.longitude;

    if (crosses) {
      inside =
        !inside;
    }
  }

  return inside;
}

function polygonAreaSquareMetres(
  polygon:
    RealSceneGeoPoint[],
): number {
  const ring =
    normalisedPolygon(
      polygon,
    );

  if (
    ring.length < 4
  ) {
    return 0;
  }

  const meanLatitude =
    ring.reduce(
      (
        total,
        point,
      ) =>
        total +
        point.latitude,
      0,
    ) /
    ring.length;

  const lonScale =
    metresPerLongitudeDegree(
      meanLatitude,
    );

  const origin =
    ring[0];

  let sum = 0;

  for (
    let index = 0;
    index <
    ring.length - 1;
    index += 1
  ) {
    const first =
      ring[index];

    const second =
      ring[
        index + 1
      ];

    const firstX =
      (first.longitude -
        origin.longitude) *
      lonScale;

    const firstY =
      (first.latitude -
        origin.latitude) *
      METRES_PER_LATITUDE_DEGREE;

    const secondX =
      (second.longitude -
        origin.longitude) *
      lonScale;

    const secondY =
      (second.latitude -
        origin.latitude) *
      METRES_PER_LATITUDE_DEGREE;

    sum +=
      firstX * secondY -
      secondX * firstY;
  }

  return (
    Math.abs(sum) /
    2
  );
}

function isBoundsRectangle(
  area:
    RealSceneAreaSelection,
): boolean {
  const ring =
    normalisedPolygon(
      area.polygon,
    );

  if (
    ring.length !== 5
  ) {
    return false;
  }

  const expected =
    polygonForBounds(
      area.bounds,
    );

  return ring.every(
    (
      point,
      index,
    ) =>
      Math.abs(
        point.latitude -
          expected[index]
            .latitude,
      ) <
        1e-10 &&
      Math.abs(
        point.longitude -
          expected[index]
            .longitude,
      ) <
        1e-10,
  );
}

export function areaSelectionFromBounds(
  bounds: RealSceneBounds,
  template?: Pick<
    RealSceneAreaSelection,
    | "mapMode"
    | "zoom"
    | "bearing"
    | "pitch"
  >,
): RealSceneAreaSelection {
  return {
    id: createId(
      "forensic-area",
    ),

    bounds,

    polygon:
      polygonForBounds(
        bounds,
      ),

    centre: {
      latitude:
        (bounds.north +
          bounds.south) /
        2,

      longitude:
        (bounds.east +
          bounds.west) /
        2,

      accuracyMetres:
        0,

      capturedAt:
        new Date()
          .toISOString(),
    },

    mapMode:
      template?.mapMode ??
      "hybrid",

    zoom:
      template?.zoom ??
      17,

    bearing:
      template?.bearing ??
      0,

    pitch:
      template?.pitch ??
      0,

    selectedAt:
      new Date()
        .toISOString(),
  };
}

export function areaSelectionFromPolygon(
  polygon: RealSceneGeoPoint[],
  template?: Pick<
    RealSceneAreaSelection,
    | "mapMode"
    | "zoom"
    | "bearing"
    | "pitch"
  >,
): RealSceneAreaSelection {
  const ring = normalisedPolygon(polygon);

  if (ring.length < 4) {
    throw new Error(
      "A forensic polygon requires at least 3 vertices.",
    );
  }

  const vertices = ring.slice(0, -1);
  const latitudes = vertices.map((point) => point.latitude);
  const longitudes = vertices.map((point) => point.longitude);

  const bounds: RealSceneBounds = {
    north: Math.max(...latitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    west: Math.min(...longitudes),
  };

  if (polygonAreaSquareMetres(ring) < 64) {
    throw new Error(
      "The forensic polygon is too small; cover at least 64 square metres.",
    );
  }

  return {
    id: createId("forensic-area"),
    bounds,
    polygon: ring,
    centre: {
      latitude:
        vertices.reduce(
          (total, point) => total + point.latitude,
          0,
        ) / vertices.length,
      longitude:
        vertices.reduce(
          (total, point) => total + point.longitude,
          0,
        ) / vertices.length,
      accuracyMetres: 0,
      capturedAt: new Date().toISOString(),
    },
    mapMode: template?.mapMode ?? "hybrid",
    zoom: template?.zoom ?? 17,
    bearing: template?.bearing ?? 0,
    pitch: template?.pitch ?? 0,
    selectedAt: new Date().toISOString(),
  };
}

export function coordinateInsideArea(
  coordinate: {
    latitude: number;
    longitude: number;
  },
  area: RealSceneAreaSelection,
): boolean {
  return (
    coordinateInsideBounds(coordinate, area.bounds) &&
    pointInsidePolygon(coordinate, area.polygon)
  );
}
export function createContextArea(
  coreArea:
    RealSceneAreaSelection,
  bufferMetres: number,
): RealSceneAreaSelection {
  const safeBuffer =
    clamp(
      bufferMetres,
      10,
      350,
    );

  const centreLatitude =
    (coreArea.bounds.north +
      coreArea.bounds.south) /
    2;

  const latPad =
    safeBuffer /
    METRES_PER_LATITUDE_DEGREE;

  const lonPad =
    safeBuffer /
    metresPerLongitudeDegree(
      centreLatitude,
    );

  return areaSelectionFromBounds(
    {
      north:
        coreArea.bounds
          .north +
        latPad,

      south:
        coreArea.bounds
          .south -
        latPad,

      east:
        coreArea.bounds
          .east +
        lonPad,

      west:
        coreArea.bounds
          .west -
        lonPad,
    },

    coreArea,
  );
}

export function createLocalMetricFrame(
  coreArea:
    RealSceneAreaSelection,
  anchor:
    RoadDetectionCoordinate,
): ForensicLocalMetricFrame {
  const lonScale =
    metresPerLongitudeDegree(
      anchor.latitude,
    );

  return {
    schemaVersion:
      "RoadSafe Local Frame V1",

    origin: {
      ...anchor,
    },

    axes: {
      x: "East",
      y: "Up",
      z: "North",
    },

    units:
      "metres",

    metresPerLatitudeDegree:
      METRES_PER_LATITUDE_DEGREE,

    metresPerLongitudeDegree:
      lonScale,

    coreBounds: {
      ...coreArea.bounds,
    },

    anchorOffsetFromSouthWestMetres:
      {
        east:
          (anchor.longitude -
            coreArea.bounds
              .west) *
          lonScale,

        north:
          (anchor.latitude -
            coreArea.bounds
              .south) *
          METRES_PER_LATITUDE_DEGREE,
      },
  };
}

export function buildForensicAreaSnapshot(
  coreArea:
    RealSceneAreaSelection,
  anchor:
    RoadDetectionCoordinate,
  contextBufferMetres: number,
): ForensicAreaSnapshot {
  const polygon =
    normalisedPolygon(
      coreArea.polygon,
    );

  const anchorInside =
    polygon.length >= 4
      ? pointInsidePolygon(
          anchor,
          polygon,
        ) ||
        coordinateInsideBounds(
          anchor,
          coreArea.bounds,
        ) &&
          isBoundsRectangle(
            coreArea,
          )
      : coordinateInsideBounds(
          anchor,
          coreArea.bounds,
        );

  if (!anchorInside) {
    throw new Error(
      "The forensic core must contain the accident anchor.",
    );
  }

  const core =
    dimensionsForBounds(
      coreArea.bounds,
    );

  const polygonArea =
    polygonAreaSquareMetres(
      polygon,
    );

  if (
    core.width < 8 ||
    core.height < 8
  ) {
    throw new Error(
      "The forensic core must be at least 8 metres wide and high.",
    );
  }

  if (
    core.width > 1_200 ||
    core.height > 1_200
  ) {
    throw new Error(
      "Keep each forensic-core side below 1.2 km.",
    );
  }

  if (
    polygonArea > 0 &&
    polygonArea < 64
  ) {
    throw new Error(
      "The forensic polygon is too small for reliable scene extraction.",
    );
  }

  const requestedBuffer =
    clamp(
      contextBufferMetres,
      10,
      350,
    );

  const diagonal =
    Math.hypot(
      core.width,
      core.height,
    );

  const approachMinimum =
    Math.round(
      clamp(
        diagonal * 0.45,
        60,
        180,
      ),
    );

  const effectiveBuffer =
    Math.max(
      requestedBuffer,
      approachMinimum,
    );

  const contextArea =
    createContextArea(
      coreArea,
      effectiveBuffer,
    );

  const context =
    dimensionsForBounds(
      contextArea.bounds,
    );

  return {
    schemaVersion:
      "RoadSafe Case Area V2",

    id: createId(
      "case-area",
    ),

    frozenAt:
      new Date()
        .toISOString(),

    boundaryMode:
      isBoundsRectangle(
        coreArea,
      )
        ? "Rectangle"
        : "Polygon",

    coreArea: {
      ...coreArea,

      bounds: {
        ...coreArea.bounds,
      },

      polygon:
        polygon.map(
          (point) => ({
            ...point,
          }),
        ),
    },

    contextArea,

    contextBufferMetres:
      effectiveBuffer,

    requestedContextBufferMetres:
      requestedBuffer,

    approachMinimumBufferMetres:
      approachMinimum,

    accidentAnchor: {
      ...anchor,
    },

    localFrame:
      createLocalMetricFrame(
        coreArea,
        anchor,
      ),

    coreDimensionsMetres:
      {
        width:
          Number(
            core.width.toFixed(
              3,
            ),
          ),

        height:
          Number(
            core.height.toFixed(
              3,
            ),
          ),

        areaSquareMetres:
          Number(
            (
              polygonArea ||
              core.areaSquareMetres
            ).toFixed(
              2,
            ),
          ),
      },

    contextDimensionsMetres:
      {
        width:
          Number(
            context.width.toFixed(
              3,
            ),
          ),

        height:
          Number(
            context.height.toFixed(
              3,
            ),
          ),

        areaSquareMetres:
          Number(
            context.areaSquareMetres.toFixed(
              2,
            ),
          ),
      },
  };
}