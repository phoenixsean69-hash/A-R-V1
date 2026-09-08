import type {
  RealSceneGeoPoint,
  RealSceneGeometry,
  RealSceneLocalPoint,
  RealSceneMetricPoint,
  RealSceneRoadControlGeometry,
  RealSceneRoadControlType,
  RealSceneRoadGeometry,
  RealSceneRoadwayGeometry,
  RealSceneTopologySummary,
} from "../types/realSceneGeometry";

import type {
  ForensicAreaSnapshot,
  ForensicQaCheck,
  ForensicQaReport,
} from "../types/forensicScenePipeline";

export interface ForensicRawMapElement {
  type:
    | "node"
    | "way"
    | "relation";

  id:
    number;

  tags?:
    Record<
      string,
      string | undefined
    >;

  geometry?: Array<{
    lat: number;
    lon: number;
  }>;

  lat?: number;
  lon?: number;
}

interface EnrichedRoad {
  road:
    RealSceneRoadGeometry;

  centreline:
    RealSceneMetricPoint[];

  clipped:
    boolean;
}

const TOPOLOGY_ROAD_LIMIT =
  100;

const TOPOLOGY_SEGMENT_PAIR_LIMIT =
  60_000;

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

function round3(
  value: number,
): number {
  return Number(
    value.toFixed(
      3,
    ),
  );
}

function geoToAnchor(
  point:
    RealSceneGeoPoint,
  area:
    ForensicAreaSnapshot,
): RealSceneMetricPoint {
  return {
    eastMetres:
      round3(
        (point.longitude -
          area.accidentAnchor
            .longitude) *
          area.localFrame
            .metresPerLongitudeDegree,
      ),

    northMetres:
      round3(
        (point.latitude -
          area.accidentAnchor
            .latitude) *
          area.localFrame
            .metresPerLatitudeDegree,
      ),
  };
}

function geoToStoredLocal(
  point:
    RealSceneGeoPoint,
  area:
    ForensicAreaSnapshot,
): RealSceneLocalPoint {
  const east =
    (point.longitude -
      area.coreArea.bounds
        .west) *
    area.localFrame
      .metresPerLongitudeDegree;

  const north =
    (point.latitude -
      area.coreArea.bounds
        .south) *
    area.localFrame
      .metresPerLatitudeDegree;

  const width =
    Math.max(
      1,
      area.coreDimensionsMetres
        .width,
    );

  const height =
    Math.max(
      1,
      area.coreDimensionsMetres
        .height,
    );

  return {
    xMetres:
      round3(
        east,
      ),

    yMetres:
      round3(
        north,
      ),

    xPercent:
      Number(
        clamp(
          (east / width) *
            100,
          0,
          100,
        ).toFixed(
          6,
        ),
      ),

    yPercent:
      Number(
        clamp(
          100 -
            (north /
              height) *
              100,
          0,
          100,
        ).toFixed(
          6,
        ),
      ),
  };
}

function distance(
  first:
    RealSceneMetricPoint,
  second:
    RealSceneMetricPoint,
): number {
  return Math.hypot(
    first.eastMetres -
      second.eastMetres,
    first.northMetres -
      second.northMetres,
  );
}

function distancePointToSegment(
  point:
    RealSceneMetricPoint,
  start:
    RealSceneMetricPoint,
  end:
    RealSceneMetricPoint,
): number {
  const dx =
    end.eastMetres -
    start.eastMetres;

  const dy =
    end.northMetres -
    start.northMetres;

  const lengthSquared =
    dx * dx +
    dy * dy;

  if (
    lengthSquared <
    1e-9
  ) {
    return distance(
      point,
      start,
    );
  }

  const parameter =
    clamp(
      (
        (point.eastMetres -
          start.eastMetres) *
          dx +
        (point.northMetres -
          start.northMetres) *
          dy
      ) /
        lengthSquared,
      0,
      1,
    );

  return Math.hypot(
    point.eastMetres -
      (
        start.eastMetres +
        parameter * dx
      ),

    point.northMetres -
      (
        start.northMetres +
        parameter * dy
      ),
  );
}

function distanceToPolyline(
  point:
    RealSceneMetricPoint,
  line:
    RealSceneMetricPoint[],
): number {
  if (
    line.length === 0
  ) {
    return Number.POSITIVE_INFINITY;
  }

  if (
    line.length === 1
  ) {
    return distance(
      point,
      line[0],
    );
  }

  let minimum =
    Number.POSITIVE_INFINITY;

  for (
    let index = 1;
    index < line.length;
    index += 1
  ) {
    minimum =
      Math.min(
        minimum,
        distancePointToSegment(
          point,
          line[
            index - 1
          ],
          line[index],
        ),
      );
  }

  return minimum;
}

function unitNormalAt(
  points:
    RealSceneMetricPoint[],
  index: number,
): {
  east: number;
  north: number;
} {
  const previous =
    points[
      Math.max(
        0,
        index - 1,
      )
    ];

  const next =
    points[
      Math.min(
        points.length - 1,
        index + 1,
      )
    ];

  const dx =
    next.eastMetres -
    previous.eastMetres;

  const dy =
    next.northMetres -
    previous.northMetres;

  const length =
    Math.hypot(
      dx,
      dy,
    );

  if (
    length <
    1e-8
  ) {
    return {
      east: 0,
      north: 0,
    };
  }

  return {
    east:
      -dy /
      length,

    north:
      dx /
      length,
  };
}

function offsetPolyline(
  points:
    RealSceneMetricPoint[],
  offsetMetres: number,
): RealSceneMetricPoint[] {
  return points.map(
    (
      point,
      index,
    ) => {
      const normal =
        unitNormalAt(
          points,
          index,
        );

      return {
        eastMetres:
          round3(
            point.eastMetres +
              normal.east *
                offsetMetres,
          ),

        northMetres:
          round3(
            point.northMetres +
              normal.north *
                offsetMetres,
          ),
      };
    },
  );
}

function closeSurface(
  left:
    RealSceneMetricPoint[],
  right:
    RealSceneMetricPoint[],
): RealSceneMetricPoint[] {
  if (
    left.length === 0 ||
    right.length === 0
  ) {
    return [];
  }

  const polygon = [
    ...left,
    ...[...right]
      .reverse(),
  ];

  polygon.push({
    ...polygon[0],
  });

  return polygon;
}

function roadNearCoreBoundary(
  road:
    RealSceneRoadGeometry,
  area:
    ForensicAreaSnapshot,
): boolean {
  const points =
    road.localPoints;

  if (
    points.length === 0
  ) {
    return false;
  }

  const tolerance =
    1.75;

  const width =
    area.coreDimensionsMetres
      .width;

  const height =
    area.coreDimensionsMetres
      .height;

  const near =
    (
      point:
        RealSceneLocalPoint,
    ) =>
      point.xMetres <=
        tolerance ||
      point.yMetres <=
        tolerance ||
      width -
        point.xMetres <=
        tolerance ||
      height -
        point.yMetres <=
        tolerance;

  return (
    near(
      points[0],
    ) ||
    near(
      points[
        points.length - 1
      ],
    )
  );
}

function sourceTagsForRoad(
  source:
    ForensicRawMapElement | undefined,
): Record<
  string,
  string
> {
  const tags =
    source?.tags ??
    {};

  const keys = [
    "width",
    "lanes",
    "lanes:forward",
    "lanes:backward",
    "turn:lanes",
    "turn:lanes:forward",
    "turn:lanes:backward",
    "sidewalk",
    "shoulder",
    "cycleway",
    "surface",
    "maxspeed",
    "oneway",
    "junction",
    "lit",
  ];

  const result:
    Record<
      string,
      string
    > =
    {};

  for (
    const key of keys
  ) {
    const value =
      tags[key];

    if (value) {
      result[key] =
        value;
    }
  }

  return result;
}

function buildRoadway(
  road:
    RealSceneRoadGeometry,
  area:
    ForensicAreaSnapshot,
  source:
    ForensicRawMapElement | undefined,
): {
  forensic:
    RealSceneRoadwayGeometry;

  centreline:
    RealSceneMetricPoint[];
} {
  const centreline =
    road.points.map(
      (point) =>
        geoToAnchor(
          point,
          area,
        ),
    );

  const tags =
    source?.tags ??
    {};

  const laneCount =
    Math.max(
      1,
      Math.round(
        road.laneCount,
      ),
    );

  const width =
    clamp(
      road.widthMetres,
      2.4,
      45,
    );

  const laneWidth =
    width /
    laneCount;

  const widthSource:
    RealSceneRoadwayGeometry["widthSource"] =
    tags.width
      ? "source-reported"
      : tags.lanes
        ? "lane-model"
        : "default-model";

  const laneCountSource:
    RealSceneRoadwayGeometry["laneCountSource"] =
    tags.lanes
      ? "source-reported"
      : "default-model";

  const leftEdge =
    offsetPolyline(
      centreline,
      width / 2,
    );

  const rightEdge =
    offsetPolyline(
      centreline,
      -width / 2,
    );

  const lanes =
    Array.from(
      {
        length:
          laneCount,
      },
      (
        _,
        index,
      ) => {
        const offset =
          width / 2 -
          laneWidth *
            (
              index +
              0.5
            );

        return {
          laneIndex:
            index,

          offsetFromCentreMetres:
            round3(
              offset,
            ),

          widthMetres:
            round3(
              laneWidth,
            ),

          centreline:
            offsetPolyline(
              centreline,
              offset,
            ),
        };
      },
    );

  const first =
    centreline[0];

  const last =
    centreline[
      centreline.length - 1
    ];

  const approachBearingDegrees =
    first &&
    last &&
    distance(
      first,
      last,
    ) >
      0.5
      ? Number(
          (
            (
              Math.atan2(
                last.eastMetres -
                  first.eastMetres,
                last.northMetres -
                  first.northMetres,
              ) *
              180
            ) /
            Math.PI
          ).toFixed(
            2,
          ),
        )
      : undefined;

  return {
    centreline,

    forensic: {
      schemaVersion:
        "RoadSafe Roadway Geometry V1",

      coordinateFrame:
        "accident-anchor-ENU",

      centreline,

      leftEdge,

      rightEdge,

      surfacePolygon:
        closeSurface(
          leftEdge,
          rightEdge,
        ),

      lanes,

      widthSource,

      laneCountSource,

      widthConfidence:
        widthSource ===
        "source-reported"
          ? 0.94
          : widthSource ===
              "lane-model"
            ? 0.74
            : 0.52,

      laneConfidence:
        laneCountSource ===
        "source-reported"
          ? 0.92
          : 0.56,

      clippedAtCoreBoundary:
        roadNearCoreBoundary(
          road,
          area,
        ),

      approachBearingDegrees,

      sourceTags:
        sourceTagsForRoad(
          source,
        ),
    },
  };
}

function classifyRoadControl(
  tags:
    Record<
      string,
      string | undefined
    >,
): RealSceneRoadControlType | null {
  const highway =
    tags.highway;

  if (
    highway ===
    "traffic_signals"
  ) {
    return "Traffic Signal";
  }

  if (
    highway ===
    "stop"
  ) {
    return "Stop";
  }

  if (
    highway ===
    "give_way"
  ) {
    return "Give Way";
  }

  if (
    highway ===
      "crossing" ||
    tags.crossing
  ) {
    return "Crossing";
  }

  if (
    tags.traffic_calming
  ) {
    return "Traffic Calming";
  }

  if (
    highway ===
    "mini_roundabout"
  ) {
    return "Mini Roundabout";
  }

  if (
    highway ===
    "speed_camera"
  ) {
    return "Speed Camera";
  }

  if (
    tags.barrier ===
      "bollard" ||
    tags.barrier ===
      "gate"
  ) {
    return "Other";
  }

  return null;
}

function insideCore(
  point: {
    latitude: number;
    longitude: number;
  },
  area:
    ForensicAreaSnapshot,
): boolean {
  return (
    point.latitude >=
      area.coreArea.bounds
        .south &&
    point.latitude <=
      area.coreArea.bounds
        .north &&
    point.longitude >=
      area.coreArea.bounds
        .west &&
    point.longitude <=
      area.coreArea.bounds
        .east
  );
}

function buildRoadControls(
  raw:
    readonly ForensicRawMapElement[],
  area:
    ForensicAreaSnapshot,
): RealSceneRoadControlGeometry[] {
  const result:
    RealSceneRoadControlGeometry[] =
    [];

  for (
    const element of raw
  ) {
    if (
      element.type !==
        "node" ||
      !Number.isFinite(
        element.lat,
      ) ||
      !Number.isFinite(
        element.lon,
      )
    ) {
      continue;
    }

    const tags =
      element.tags ??
      {};

    const controlType =
      classifyRoadControl(
        tags,
      );

    if (!controlType) {
      continue;
    }

    const position = {
      latitude:
        element.lat as number,

      longitude:
        element.lon as number,
    };

    if (
      !insideCore(
        position,
        area,
      )
    ) {
      continue;
    }

    const sourceTags:
      Record<
        string,
        string
      > =
      {};

    for (
      const [
        key,
        value,
      ] of Object.entries(
        tags,
      )
    ) {
      if (value) {
        sourceTags[key] =
          value;
      }
    }

    result.push({
      id:
        `osm-control-${element.id}`,

      osmId:
        element.id,

      controlType,

      position,

      localPosition:
        geoToStoredLocal(
          position,
          area,
        ),

      anchorPosition:
        geoToAnchor(
          position,
          area,
        ),

      sourceTags,

      confidence:
        0.94,
    });
  }

  return result;
}

function segmentIntersection(
  a:
    RealSceneMetricPoint,
  b:
    RealSceneMetricPoint,
  c:
    RealSceneMetricPoint,
  d:
    RealSceneMetricPoint,
): RealSceneMetricPoint | null {
  const rX =
    b.eastMetres -
    a.eastMetres;

  const rY =
    b.northMetres -
    a.northMetres;

  const sX =
    d.eastMetres -
    c.eastMetres;

  const sY =
    d.northMetres -
    c.northMetres;

  const denominator =
    rX * sY -
    rY * sX;

  if (
    Math.abs(
      denominator,
    ) <
    1e-8
  ) {
    return null;
  }

  const cax =
    c.eastMetres -
    a.eastMetres;

  const cay =
    c.northMetres -
    a.northMetres;

  const t =
    (
      cax * sY -
      cay * sX
    ) /
    denominator;

  const u =
    (
      cax * rY -
      cay * rX
    ) /
    denominator;

  if (
    t < -0.001 ||
    t > 1.001 ||
    u < -0.001 ||
    u > 1.001
  ) {
    return null;
  }

  return {
    eastMetres:
      round3(
        a.eastMetres +
          t * rX,
      ),

    northMetres:
      round3(
        a.northMetres +
          t * rY,
      ),
  };
}

function intersectionKey(
  point:
    RealSceneMetricPoint,
): string {
  return `${Math.round(
    point.eastMetres /
      1.5,
  )}:${Math.round(
    point.northMetres /
      1.5,
  )}`;
}

function analyseTopology(
  roads:
    EnrichedRoad[],
  raw:
    readonly ForensicRawMapElement[],
): RealSceneTopologySummary {
  const analysed =
    roads.slice(
      0,
      TOPOLOGY_ROAD_LIMIT,
    );

  const parent =
    analysed.map(
      (
        _,
        index,
      ) =>
        index,
    );

  const find =
    (
      index: number,
    ): number => {
      let current =
        index;

      while (
        parent[current] !==
        current
      ) {
        parent[current] =
          parent[
            parent[current]
          ];

        current =
          parent[current];
      }

      return current;
    };

  const union =
    (
      first: number,
      second: number,
    ) => {
      const left =
        find(first);

      const right =
        find(second);

      if (
        left !== right
      ) {
        parent[right] =
          left;
      }
    };

  const intersections =
    new Set<string>();

  let segmentPairs = 0;

  let truncated =
    roads.length >
    TOPOLOGY_ROAD_LIMIT;

  outer:
  for (
    let left = 0;
    left <
    analysed.length;
    left += 1
  ) {
    for (
      let right =
        left + 1;
      right <
      analysed.length;
      right += 1
    ) {
      const first =
        analysed[left]
          .centreline;

      const second =
        analysed[right]
          .centreline;

      let connected =
        false;

      for (
        let firstIndex = 1;
        firstIndex <
        first.length;
        firstIndex += 1
      ) {
        for (
          let secondIndex = 1;
          secondIndex <
          second.length;
          secondIndex += 1
        ) {
          segmentPairs += 1;

          if (
            segmentPairs >
            TOPOLOGY_SEGMENT_PAIR_LIMIT
          ) {
            truncated =
              true;

            break outer;
          }

          const point =
            segmentIntersection(
              first[
                firstIndex - 1
              ],
              first[
                firstIndex
              ],
              second[
                secondIndex - 1
              ],
              second[
                secondIndex
              ],
            );

          if (point) {
            connected =
              true;

            intersections.add(
              intersectionKey(
                point,
              ),
            );
          }
        }
      }

      if (
        !connected &&
        first.length > 0 &&
        second.length > 0
      ) {
        const endpointsA = [
          first[0],
          first[
            first.length - 1
          ],
        ];

        const endpointsB = [
          second[0],
          second[
            second.length - 1
          ],
        ];

        connected =
          endpointsA.some(
            (firstPoint) =>
              endpointsB.some(
                (secondPoint) =>
                  distance(
                    firstPoint,
                    secondPoint,
                  ) <=
                  2.5,
              ),
          );
      }

      if (connected) {
        union(
          left,
          right,
        );
      }
    }
  }

  const components =
    new Set<number>();

  for (
    let index = 0;
    index <
    analysed.length;
    index += 1
  ) {
    components.add(
      find(index),
    );
  }

  let anchorRoad:
    EnrichedRoad | undefined;

  let anchorDistance =
    Number.POSITIVE_INFINITY;

  const anchor = {
    eastMetres: 0,
    northMetres: 0,
  };

  for (
    const road of roads
  ) {
    const current =
      distanceToPolyline(
        anchor,
        road.centreline,
      );

    if (
      current <
      anchorDistance
    ) {
      anchorDistance =
        current;

      anchorRoad =
        road;
    }
  }

  const inferredRoadWidthCount =
    roads.filter(
      ({ road }) =>
        road.forensic
          ?.widthSource !==
        "source-reported",
    ).length;

  const inferredLaneCountCount =
    roads.filter(
      ({ road }) =>
        road.forensic
          ?.laneCountSource !==
        "source-reported",
    ).length;

  const invalidRoadModelCount =
    roads.filter(
      ({ road }) => {
        const forensic =
          road.forensic;

        if (!forensic) {
          return true;
        }

        const laneWidth =
          road.widthMetres /
          Math.max(
            1,
            road.laneCount,
          );

        return (
          road.widthMetres <
            2.4 ||
          road.widthMetres >
            45 ||
          laneWidth <
            2.2 ||
          laneWidth >
            4.7
        );
      },
    ).length;

  const unresolvedRelationCount =
    raw.filter(
      (element) =>
        element.type ===
        "relation",
    ).length;

  return {
    schemaVersion:
      "RoadSafe Road Topology V1",

    analysedRoadCount:
      analysed.length,

    intersectionCount:
      intersections.size,

    connectedComponentCount:
      analysed.length === 0
        ? 0
        : components.size,

    boundaryCutRoadCount:
      roads.filter(
        (road) =>
          road.clipped,
      ).length,

    anchorRoadId:
      anchorRoad?.road.id,

    anchorRoadDistanceMetres:
      Number.isFinite(
        anchorDistance,
      )
        ? Number(
            anchorDistance.toFixed(
              2,
            ),
          )
        : 9999,

    inferredRoadWidthCount,

    inferredLaneCountCount,

    invalidRoadModelCount,

    roadControlCount:
      0,

    unresolvedRelationCount,

    topologyAnalysisTruncated:
      truncated,
  };
}

function warningForGeometry(
  topology:
    RealSceneTopologySummary,
): string[] {
  const warnings:
    string[] =
    [];

  if (
    topology.anchorRoadDistanceMetres >
    12
  ) {
    warnings.push(
      `Accident anchor is ${topology.anchorRoadDistanceMetres.toFixed(
        1,
      )} m from the nearest mapped road centreline.`,
    );
  }

  if (
    topology.inferredRoadWidthCount >
    0
  ) {
    warnings.push(
      `${topology.inferredRoadWidthCount} road width(s) are inferred rather than source-reported.`,
    );
  }

  if (
    topology.unresolvedRelationCount >
    0
  ) {
    warnings.push(
      `${topology.unresolvedRelationCount} OSM relation(s) were archived but are not expanded into independent V3 geometry yet.`,
    );
  }

  if (
    topology.topologyAnalysisTruncated
  ) {
    warnings.push(
      "Road topology analysis hit its safety limit; manual review is required for this unusually dense scene.",
    );
  }

  return warnings;
}

function scoreAnchor(
  distanceMetres: number,
): number {
  if (
    distanceMetres <= 3
  ) {
    return 100;
  }

  if (
    distanceMetres <= 7
  ) {
    return 88;
  }

  if (
    distanceMetres <= 12
  ) {
    return 72;
  }

  if (
    distanceMetres <= 20
  ) {
    return 50;
  }

  if (
    distanceMetres <= 35
  ) {
    return 25;
  }

  return 0;
}

function scoreRoadModel(
  geometry:
    RealSceneGeometry,
): number {
  if (
    geometry.roads.length ===
    0
  ) {
    return 0;
  }

  let total = 0;

  for (
    const road of
    geometry.roads
  ) {
    const forensic =
      road.forensic;

    if (!forensic) {
      continue;
    }

    total +=
      (
        forensic.widthConfidence *
          0.58 +
        forensic.laneConfidence *
          0.42
      ) *
      100;
  }

  const average =
    total /
    Math.max(
      1,
      geometry.roads.length,
    );

  const invalid =
    geometry.topology
      ?.invalidRoadModelCount ??
    0;

  return Math.round(
    clamp(
      average -
        invalid * 6,
      0,
      100,
    ),
  );
}

function scoreTopology(
  geometry:
    RealSceneGeometry,
): number {
  const topology =
    geometry.topology;

  if (
    !topology ||
    geometry.roads.length ===
      0
  ) {
    return 0;
  }

  let score = 100;

  if (
    topology.connectedComponentCount >
    1
  ) {
    score -=
      Math.min(
        40,
        (
          topology.connectedComponentCount -
          1
        ) *
          12,
      );
  }

  score -=
    topology.invalidRoadModelCount *
    5;

  if (
    topology.topologyAnalysisTruncated
  ) {
    score -= 12;
  }

  return Math.round(
    clamp(
      score,
      0,
      100,
    ),
  );
}

function scoreBoundaryCoverage(
  geometry:
    RealSceneGeometry,
): number {
  if (
    geometry.roads.length ===
    0
  ) {
    return 0;
  }

  const cuts =
    geometry.topology
      ?.boundaryCutRoadCount ??
    0;

  const ratio =
    cuts /
    Math.max(
      1,
      geometry.roads.length,
    );

  return Math.round(
    clamp(
      100 -
        ratio * 30,
      55,
      100,
    ),
  );
}

function check(
  id: string,
  label: string,
  severity:
    ForensicQaCheck["severity"],
  value: string,
  detail: string,
): ForensicQaCheck {
  return {
    id,
    label,
    severity,
    value,
    detail,
  };
}

export const ForensicGeometryEngine = {
  enrich(
    base:
      RealSceneGeometry,
    area:
      ForensicAreaSnapshot,
    raw:
      readonly ForensicRawMapElement[],
  ): RealSceneGeometry {
    const rawWays =
      new Map<
        number,
        ForensicRawMapElement
      >();

    for (
      const element of raw
    ) {
      if (
        element.type ===
        "way"
      ) {
        rawWays.set(
          element.id,
          element,
        );
      }
    }

    const enriched:
      EnrichedRoad[] =
      base.roads.map(
        (road) => {
          const built =
            buildRoadway(
              road,
              area,
              rawWays.get(
                road.osmId,
              ),
            );

          const nextRoad:
            RealSceneRoadGeometry =
            {
              ...road,
              forensic:
                built.forensic,
            };

          return {
            road:
              nextRoad,

            centreline:
              built.centreline,

            clipped:
              built.forensic
                .clippedAtCoreBoundary,
          };
        },
      );

    const roadControls =
      buildRoadControls(
        raw,
        area,
      );

    const topology =
      analyseTopology(
        enriched,
        raw,
      );

    topology.roadControlCount =
      roadControls.length;

    const warnings = [
      ...base.warnings,
      ...warningForGeometry(
        topology,
      ),
    ];

    return {
      ...base,

      version:
        "RoadSafe Real Scene V3",

      origin: {
        latitude:
          area.accidentAnchor
            .latitude,

        longitude:
          area.accidentAnchor
            .longitude,
      },

      roads:
        enriched.map(
          (entry) =>
            entry.road,
        ),

      roadControls,

      topology,

      warnings:
        Array.from(
          new Set(
            warnings,
          ),
        ),

      confidence:
        Number(
          clamp(
            (
              base.confidence *
                0.4 +
              scoreRoadModel({
                ...base,
                roads:
                  enriched.map(
                    (entry) =>
                      entry.road,
                  ),
                topology,
              }) /
                100 *
                0.6
            ),
            0,
            1,
          ).toFixed(
            3,
          ),
        ),
    };
  },

  createQaReport(
    geometry:
      RealSceneGeometry,
    _area:
      ForensicAreaSnapshot,
    terrainReady:
      boolean,
    archiveCount:
      number,
  ): ForensicQaReport {
    const topology =
      geometry.topology;

    const anchorDistance =
      topology
        ?.anchorRoadDistanceMetres ??
      9999;

    const anchorScore =
      scoreAnchor(
        anchorDistance,
      );

    const roadModelScore =
      scoreRoadModel(
        geometry,
      );

    const topologyScore =
      scoreTopology(
        geometry,
      );

    const boundaryCoverageScore =
      scoreBoundaryCoverage(
        geometry,
      );

    const geometryCompleteness =
      Math.round(
        anchorScore *
          0.25 +
        roadModelScore *
          0.35 +
        topologyScore *
          0.25 +
        boundaryCoverageScore *
          0.15,
      );

    const elevationCoverage =
      terrainReady
        ? 100
        : 0;

    const sourceArchivePercent =
      Math.min(
        100,
        archiveCount *
          34,
      );

    const overall =
      Math.round(
        geometryCompleteness *
          0.7 +
        elevationCoverage *
          0.1 +
        sourceArchivePercent *
          0.2,
      );

    const checks:
      ForensicQaCheck[] =
      [];

    checks.push(
      check(
        "roads",
        "Mapped road coverage",
        geometry.roads.length >
          0
          ? "pass"
          : "error",
        `${geometry.roads.length} road(s)`,
        geometry.roads.length >
          0
          ? "Mapped vehicle-road geometry intersects the frozen forensic core."
          : "No mapped vehicle-road geometry intersects the core.",
      ),
    );

    checks.push(
      check(
        "anchor-road-alignment",
        "Accident anchor alignment",
        anchorDistance <=
          12
          ? "pass"
          : anchorDistance <=
              25
            ? "warning"
            : "error",
        Number.isFinite(
          anchorDistance,
        )
          ? `${anchorDistance.toFixed(
              1,
            )} m`
          : "Unavailable",
        "Distance from the accident anchor to the nearest extracted road centreline.",
      ),
    );

    const modelled =
      geometry.roads.filter(
        (road) =>
          Boolean(
            road.forensic,
          ),
      ).length;

    checks.push(
      check(
        "roadway-surfaces",
        "Roadway surface reconstruction",
        modelled ===
          geometry.roads.length &&
          modelled > 0
          ? "pass"
          : "warning",
        `${modelled}/${geometry.roads.length}`,
        "V3 derives left/right road edges, a carriageway surface and lane centrelines from each normalized road.",
      ),
    );

    const inferredWidths =
      topology
        ?.inferredRoadWidthCount ??
      0;

    checks.push(
      check(
        "road-width-provenance",
        "Road width provenance",
        inferredWidths ===
          0
          ? "pass"
          : inferredWidths <=
              Math.max(
                1,
                Math.ceil(
                  geometry.roads.length *
                    0.5,
                ),
              )
            ? "warning"
            : "error",
        `${inferredWidths} inferred`,
        "RoadSafe preserves whether width came from an OSM width tag, a lane-based model or a default road model.",
      ),
    );

    checks.push(
      check(
        "topology",
        "Road topology",
        topologyScore >=
          75
          ? "pass"
          : topologyScore >=
              50
            ? "warning"
            : "error",
        `${topologyScore}%`,
        `${topology?.intersectionCount ?? 0} intersection(s), ${topology?.connectedComponentCount ?? 0} connected component(s).`,
      ),
    );

    checks.push(
      check(
        "boundary-cuts",
        "Boundary truncation",
        boundaryCoverageScore >=
          75
          ? "pass"
          : "warning",
        `${topology?.boundaryCutRoadCount ?? 0} road(s)`,
        "Roads clipped by the forensic-core boundary are tracked so the investigator can identify incomplete approaches.",
      ),
    );

    checks.push(
      check(
        "road-controls",
        "Mapped traffic controls",
        (geometry.roadControls
          ?.length ??
          0) >
          0
          ? "pass"
          : "warning",
        `${geometry.roadControls?.length ?? 0} control(s)`,
        "Signals, stop/give-way points, crossings, calming features and mini-roundabouts are extracted when mapped.",
      ),
    );

    const relations =
      topology
        ?.unresolvedRelationCount ??
      0;

    checks.push(
      check(
        "relations",
        "OSM relation coverage",
        relations === 0
          ? "pass"
          : "warning",
        `${relations} archived`,
        relations === 0
          ? "No unexpanded OSM relations were present in this source payload."
          : "OSM relations are preserved in the raw archive but V3 does not yet rebuild all relation geometries.",
      ),
    );

    checks.push(
      check(
        "terrain",
        "Macro terrain",
        terrainReady
          ? "pass"
          : "warning",
        terrainReady
          ? "Available"
          : "Fallback",
        "Macro DEM is context only. Kerbs, camber, crown, potholes, humps and drainage still require field verification.",
      ),
    );

    checks.push(
      check(
        "source-archive",
        "Source archive integrity",
        sourceArchivePercent >=
          100
          ? "pass"
          : sourceArchivePercent >=
              66
            ? "warning"
            : "error",
        `${sourceArchivePercent}%`,
        "Raw map data, normalized geometry and terrain payloads are hashed when available.",
      ),
    );

    const decision:
      ForensicQaReport["decision"] =
      overall >= 75 &&
      geometryCompleteness >=
        70 &&
      geometry.roads.length >
        0 &&
      anchorDistance <=
        12 &&
      roadModelScore >=
        60
        ? "GOOD \u2014 REVIEW REQUIRED"
        : overall >=
            45
          ? "LIMITED \u2014 CORRECTION REQUIRED"
          : "INSUFFICIENT \u2014 DO NOT USE";

    return {
      schemaVersion:
        "RoadSafe Geometry QA V2",

      generatedAt:
        new Date()
          .toISOString(),

      geometryCompletenessPercent:
        geometryCompleteness,

      anchorAlignmentScorePercent:
        anchorScore,

      roadModelScorePercent:
        roadModelScore,

      topologyScorePercent:
        topologyScore,

      boundaryCoverageScorePercent:
        boundaryCoverageScore,

      elevationCoveragePercent:
        elevationCoverage,

      sourceArchivePercent,

      overallScorePercent:
        overall,

      decision,

      checks,

      warnings:
        checks
          .filter(
            (item) =>
              item.severity !==
              "pass",
          )
          .map(
            (item) =>
              item.detail,
          ),
    };
  },
};