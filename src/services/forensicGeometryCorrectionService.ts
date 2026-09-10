import {
  ForensicGeometryEngine,
} from "./forensicGeometryEngine";

import {
  ForensicSourceArchiveService,
  sha256Json,
} from "./forensicSourceArchiveService";

import type {
  ForensicGeometryCorrection,
  ForensicPipelineBuildResult,
  ForensicScenePackage,
} from "../types/forensicScenePipeline";

import type {
  RealSceneMetricPoint,
  RealSceneRoadGeometry,
  RealSceneRoadwayGeometry,
} from "../types/realSceneGeometry";

export interface RoadGeometryCorrectionInput {
  roadId: string;
  widthMetres: number;
  laneCount: number;
  method: "inspector" | "edge-handle";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalAt(
  points: RealSceneMetricPoint[],
  index: number,
): { east: number; north: number } {
  const a = points[Math.max(0, index - 1)];
  const b = points[Math.min(points.length - 1, index + 1)];
  const dx = b.eastMetres - a.eastMetres;
  const dy = b.northMetres - a.northMetres;
  const length = Math.hypot(dx, dy);

  return length < 1e-9
    ? { east: 0, north: 0 }
    : { east: -dy / length, north: dx / length };
}

function offset(
  points: RealSceneMetricPoint[],
  metres: number,
): RealSceneMetricPoint[] {
  return points.map((point, index) => {
    const normal = normalAt(points, index);

    return {
      eastMetres: Number(
        (point.eastMetres + normal.east * metres).toFixed(3),
      ),
      northMetres: Number(
        (point.northMetres + normal.north * metres).toFixed(3),
      ),
    };
  });
}

function rebuild(
  road: RealSceneRoadGeometry,
  widthMetres: number,
  laneCount: number,
): RealSceneRoadwayGeometry {
  const current = road.forensic;

  if (!current || current.centreline.length < 2) {
    throw new Error(
      "Selected road has no V3 roadway model to correct.",
    );
  }

  const width = clamp(widthMetres, 2.4, 45);
  const lanes = clamp(Math.round(laneCount), 1, 12);
  const laneWidth = width / lanes;
  const leftEdge = offset(current.centreline, width / 2);
  const rightEdge = offset(current.centreline, -width / 2);
  const surfacePolygon = [
    ...leftEdge,
    ...[...rightEdge].reverse(),
    { ...leftEdge[0] },
  ];

  return {
    ...current,
    leftEdge,
    rightEdge,
    surfacePolygon,
    lanes: Array.from({ length: lanes }, (_, index) => {
      const laneOffset =
        width / 2 - laneWidth * (index + 0.5);

      return {
        laneIndex: index,
        offsetFromCentreMetres: Number(laneOffset.toFixed(3)),
        widthMetres: Number(laneWidth.toFixed(3)),
        centreline: offset(current.centreline, laneOffset),
      };
    }),
    widthSource: "manual-correction",
    laneCountSource: "manual-correction",
    widthConfidence: 0.98,
    laneConfidence: 0.98,
  };
}

function refreshTopology(
  roads: RealSceneRoadGeometry[],
  previous: ForensicPipelineBuildResult["geometry"]["topology"],
) {
  if (!previous) return previous;

  return {
    ...previous,
    inferredRoadWidthCount: roads.filter(
      (road) =>
        road.forensic &&
        !["source-reported", "manual-correction"].includes(
          road.forensic.widthSource,
        ),
    ).length,
    inferredLaneCountCount: roads.filter(
      (road) =>
        road.forensic &&
        !["source-reported", "manual-correction"].includes(
          road.forensic.laneCountSource,
        ),
    ).length,
    invalidRoadModelCount: roads.filter((road) => {
      if (!road.forensic) return true;
      const laneWidth =
        road.widthMetres / Math.max(1, road.laneCount);

      return (
        road.widthMetres < 2.4 ||
        road.widthMetres > 45 ||
        laneWidth < 2.2 ||
        laneWidth > 4.7
      );
    }).length,
  };
}

function uniqueArchiveCount(scenePackage: ForensicScenePackage): number {
  return new Set(
    scenePackage.sources
      .map((source) => source.archive?.id)
      .filter((id): id is string => Boolean(id)),
  ).size;
}

function withoutSnapshot(
  scenePackage: ForensicScenePackage,
): Omit<ForensicScenePackage, "snapshotSha256"> {
  const copy = { ...scenePackage } as Partial<ForensicScenePackage>;
  delete copy.snapshotSha256;

  return copy as Omit<
    ForensicScenePackage,
    "snapshotSha256"
  >;
}

export const ForensicGeometryCorrectionService = {
  async apply(
    buildResult: ForensicPipelineBuildResult,
    input: RoadGeometryCorrectionInput,
  ): Promise<ForensicPipelineBuildResult> {
    const road = buildResult.geometry.roads.find(
      (candidate) => candidate.id === input.roadId,
    );

    if (!road) {
      throw new Error("Selected road is no longer available.");
    }

    const widthMetres = Number(
      clamp(input.widthMetres, 2.4, 45).toFixed(2),
    );
    const laneCount = clamp(Math.round(input.laneCount), 1, 12);

    const correctedRoad: RealSceneRoadGeometry = {
      ...road,
      widthMetres,
      laneCount,
      forensic: rebuild(road, widthMetres, laneCount),
    };

    const roads = buildResult.geometry.roads.map((candidate) =>
      candidate.id === correctedRoad.id ? correctedRoad : candidate,
    );

    const geometry = {
      ...buildResult.geometry,
      roads,
      topology: refreshTopology(
        roads,
        buildResult.geometry.topology,
      ),
      warnings: Array.from(
        new Set([
          ...buildResult.geometry.warnings,
          `Investigator corrected ${correctedRoad.name}: ${widthMetres.toFixed(
            2,
          )} m, ${laneCount} lane(s).`,
        ]),
      ),
    };

    const correction: ForensicGeometryCorrection = {
      id: `geometry-correction-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      appliedAt: new Date().toISOString(),
      roadId: correctedRoad.id,
      osmId: correctedRoad.osmId,
      roadName: correctedRoad.name,
      method: input.method,
      previous: {
        widthMetres: road.widthMetres,
        laneCount: road.laneCount,
      },
      next: {
        widthMetres,
        laneCount,
      },
    };

    const qa = ForensicGeometryEngine.createQaReport(
      geometry,
      buildResult.scenePackage.area,
      buildResult.scenePackage.terrain.status === "ready",
      uniqueArchiveCount(buildResult.scenePackage),
    );

    const geometrySha256 = await sha256Json(geometry);

    const correctedPackage: ForensicScenePackage = {
      ...buildResult.scenePackage,
      schemaVersion: "RoadSafe Forensic Scene V2",
      geometrySha256,
      legacyGeometryVersion: geometry.version,
      qa,
      corrections: [
        ...(buildResult.scenePackage.corrections ?? []),
        correction,
      ],
      reviewStatus: "pending-investigator-review",
      investigatorConfirmedAt: undefined,
      layers: buildResult.scenePackage.layers.map((layer) =>
        layer.layer === "roads"
          ? {
              ...layer,
              classification: "Manually corrected" as const,
              confidence: Math.max(layer.confidence, 0.96),
              notes: Array.from(
                new Set([
                  ...layer.notes,
                  "Roadway dimensions were investigator-corrected during Review.",
                ]),
              ),
            }
          : layer,
      ),
    };

    const snapshotSha256 = await sha256Json(
      withoutSnapshot(correctedPackage),
    );

    let scenePackage: ForensicScenePackage = {
      ...correctedPackage,
      snapshotSha256,
    };

    const archive =
      await ForensicSourceArchiveService.saveJson(
        "pipeline-manifest",
        scenePackage,
      );

    scenePackage = {
      ...scenePackage,
      sources: [
        ...scenePackage.sources,
        {
          id: `source-investigator-correction-${Date.now()}`,
          layer: "area",
          provider: "RoadSafe investigator geometry review",
          classification: "Manually corrected",
          status: "ready",
          confidence: 0.98,
          capturedAt: correction.appliedAt,
          coverage: "core",
          archive,
          attribution: "RoadSafe investigator review",
          notes: [
            `${correction.roadName}: width/lane geometry corrected.`,
            `Method: ${correction.method}.`,
          ],
        },
      ],
    };

    return {
      ...buildResult,
      geometry,
      scenePackage,
    };
  },
};
