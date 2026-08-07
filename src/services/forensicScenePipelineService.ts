import { buildForensicAreaSnapshot } from "./forensicAreaService";
import { ForensicElevationService } from "./forensicElevationService";
import { ForensicSourceArchiveService, sha256Json } from "./forensicSourceArchiveService";
import { RealSceneExtractionService } from "./realSceneExtractionService";
import type { RealSceneAreaSelection, RealSceneGeometry } from "../types/realSceneGeometry";
import type { RoadDetectionCoordinate } from "../types/roadLayoutDetection";
import type {
  ForensicLayerAssessment,
  ForensicPipelineBuildResult,
  ForensicPipelineStage,
  ForensicQaCheck,
  ForensicQaReport,
  ForensicScenePackage,
  ForensicSourceRecord,
} from "../types/forensicScenePipeline";

type ProgressCallback = (stages: ForensicPipelineStage[]) => void;

interface BuildOptions {
  coreArea: RealSceneAreaSelection;
  accidentAnchor: RoadDetectionCoordinate;
  contextBufferMetres: number;
  onProgress?: ProgressCallback;
}

interface OverpassRaw {
  version?: number;
  generator?: string;
  elements?: unknown[];
}

const OVERPASS_ENDPOINTS = Array.from(
  new Set(
    [
      import.meta.env.VITE_OVERPASS_URL,
      "https://overpass.kumi.systems/api/interpreter",
      "https://overpass-api.de/api/interpreter",
    ].filter((value): value is string => Boolean(value)),
  ),
);

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function initialStages(): ForensicPipelineStage[] {
  const items: Array<[ForensicPipelineStage["id"], string]> = [
    ["freeze-area", "Freeze case boundary"],
    ["archive-osm", "Acquire + archive raw map data"],
    ["normalize-geometry", "Normalize simulation geometry"],
    ["acquire-elevation", "Acquire terrain elevation"],
    ["archive-elevation", "Archive terrain source"],
    ["quality-assurance", "Geometry quality assurance"],
    ["freeze-package", "Freeze forensic scene package"],
  ];
  return items.map(([id, label]) => ({ id, label, status: "waiting", progressPercent: 0, message: "Waiting" }));
}

function updateStage(
  stages: ForensicPipelineStage[],
  id: ForensicPipelineStage["id"],
  patch: Partial<ForensicPipelineStage>,
  onProgress?: ProgressCallback,
): ForensicPipelineStage[] {
  const next = stages.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage));
  onProgress?.(next.map((stage) => ({ ...stage })));
  return next;
}

function overpassQuery(area: RealSceneAreaSelection): string {
  const b = area.bounds;
  return `[out:json][timeout:18];
(
  way["highway"]["area"!="yes"](${b.south},${b.west},${b.north},${b.east});
  way["building"](${b.south},${b.west},${b.north},${b.east});
  way["barrier"](${b.south},${b.west},${b.north},${b.east});
  way["landuse"](${b.south},${b.west},${b.north},${b.east});
  way["natural"](${b.south},${b.west},${b.north},${b.east});
  way["leisure"](${b.south},${b.west},${b.north},${b.east});
  way["waterway"](${b.south},${b.west},${b.north},${b.east});
  node["highway"](${b.south},${b.west},${b.north},${b.east});
  node["traffic_sign"](${b.south},${b.west},${b.north},${b.east});
  node["natural"~"tree|shrub"](${b.south},${b.west},${b.north},${b.east});
);
out tags geom qt;`;
}

async function fetchRawOsm(area: RealSceneAreaSelection): Promise<{ payload: OverpassRaw; endpoint: string }> {
  const body = new URLSearchParams({ data: overpassQuery(area) }).toString();
  const failures: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 18_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { payload: (await response.json()) as OverpassRaw, endpoint };
    } catch (error) {
      failures.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw new Error(`All configured OpenStreetMap/Overpass sources failed. ${failures.join(" | ")}`);
}

function sourceRecords(
  geometry: RealSceneGeometry,
  rawArchive: ForensicSourceRecord["archive"],
  capturedAt: string,
  endpoint: string,
): ForensicSourceRecord[] {
  const make = (
    layer: ForensicSourceRecord["layer"],
    confidence: number,
    featureCount: number,
    classification: ForensicSourceRecord["classification"] = "Source-reported",
  ): ForensicSourceRecord => ({
    id: createId(`source-${layer}`),
    layer,
    provider: classification === "Derived" ? "OpenStreetMap / RoadSafe derivation" : "OpenStreetMap / Overpass",
    classification,
    status: featureCount > 0 ? "ready" : "partial",
    confidence,
    capturedAt,
    coverage: "core+context",
    archive: rawArchive,
    attribution: "© OpenStreetMap contributors",
    notes: [`Raw source acquired through ${endpoint}.`, "Normalized geometry is clipped to the frozen forensic core."],
  });

  return [
    make("roads", geometry.roads.length > 0 ? 0.88 : 0.3, geometry.roads.length),
    make("buildings", geometry.buildings.length > 0 ? 0.78 : 0.35, geometry.buildings.length),
    make("paths", geometry.paths.length > 0 ? 0.74 : 0.5, geometry.paths.length),
    make("barriers", geometry.barriers.length > 0 ? 0.7 : 0.42, geometry.barriers.length),
    make("land-cover", (geometry.landCover?.length ?? 0) > 0 ? 0.66 : 0.38, geometry.landCover?.length ?? 0),
    make("vegetation", (geometry.vegetation?.length ?? 0) > 0 ? 0.58 : 0.32, geometry.vegetation?.length ?? 0, "Derived"),
  ];
}

function qaReport(
  geometry: RealSceneGeometry,
  terrainReady: boolean,
  archiveCount: number,
): ForensicQaReport {
  const checks: ForensicQaCheck[] = [
    {
      id: "boundary-valid",
      label: "Frozen case boundary",
      severity: "pass",
      value: "Valid",
      detail: "The forensic core and context boundary are frozen into the case package.",
    },
    {
      id: "roads",
      label: "Mapped road coverage",
      severity: geometry.roads.length > 0 ? "pass" : "warning",
      value: `${geometry.roads.length} road(s)`,
      detail: geometry.roads.length > 0 ? "Mapped road geometry intersects the core." : "No mapped vehicle-road centreline intersects the core; manual correction is required.",
    },
    {
      id: "terrain",
      label: "Macro terrain",
      severity: terrainReady ? "pass" : "warning",
      value: terrainReady ? "DEM acquired" : "Flat fallback",
      detail: terrainReady ? "Macro elevation coverage is available." : "Flat terrain is an explicit low-confidence fallback.",
    },
    {
      id: "archive",
      label: "Immutable source archive",
      severity: archiveCount >= 2 ? "pass" : "warning",
      value: `${archiveCount} frozen archive(s)`,
      detail: "Frozen JSON payloads are stored in IndexedDB and identified by SHA-256.",
    },
    {
      id: "micro",
      label: "Micro road geometry",
      severity: "warning",
      value: "Field verification required",
      detail: "Kerbs, potholes, humps, road crown/camber, drains and small defects are not inferred from the macro DEM.",
    },
  ];

  const geometryCompleteness = Math.round(
    Math.min(
      100,
      35 +
        Math.min(35, geometry.roads.length * 12) +
        Math.min(15, geometry.buildings.length * 2) +
        Math.min(15, (geometry.paths.length + geometry.barriers.length + (geometry.landCover?.length ?? 0)) * 2),
    ),
  );
  const elevationCoverage = terrainReady ? 100 : 0;
  const sourceArchivePercent = Math.min(100, archiveCount * 34);
  const overall = Math.round(geometryCompleteness * 0.48 + elevationCoverage * 0.28 + sourceArchivePercent * 0.24);
  const decision =
    overall >= 75 && geometry.roads.length > 0
      ? "GOOD — REVIEW REQUIRED"
      : overall >= 45
        ? "LIMITED — CORRECTION REQUIRED"
        : "INSUFFICIENT — DO NOT USE";

  return {
    schemaVersion: "RoadSafe Geometry QA V1",
    generatedAt: new Date().toISOString(),
    geometryCompletenessPercent: geometryCompleteness,
    elevationCoveragePercent: elevationCoverage,
    sourceArchivePercent,
    overallScorePercent: overall,
    decision,
    checks,
    warnings: checks.filter((check) => check.severity !== "pass").map((check) => check.detail),
  };
}

export const ForensicScenePipelineService = {
  async build({ coreArea, accidentAnchor, contextBufferMetres, onProgress }: BuildOptions): Promise<ForensicPipelineBuildResult> {
    let stages = initialStages();
    onProgress?.(stages);

    stages = updateStage(stages, "freeze-area", { status: "running", progressPercent: 30, message: "Validating forensic core and generating context buffer…" }, onProgress);
    const area = buildForensicAreaSnapshot(coreArea, accidentAnchor, contextBufferMetres);
    stages = updateStage(stages, "freeze-area", { status: "complete", progressPercent: 100, message: `Core ${area.coreDimensionsMetres.width.toFixed(1)} × ${area.coreDimensionsMetres.height.toFixed(1)} m frozen.` }, onProgress);

    stages = updateStage(stages, "archive-osm", { status: "running", progressPercent: 20, message: "Acquiring raw OpenStreetMap context data…" }, onProgress);
    const raw = await fetchRawOsm(area.contextArea);
    const rawArchive = await ForensicSourceArchiveService.saveJson("osm-raw", { endpoint: raw.endpoint, capturedAt: new Date().toISOString(), area: area.contextArea, payload: raw.payload });
    stages = updateStage(stages, "archive-osm", { status: "complete", progressPercent: 100, message: `Raw map source archived · ${rawArchive.sha256.slice(0, 12)}` }, onProgress);

    stages = updateStage(stages, "normalize-geometry", { status: "running", progressPercent: 35, message: "Normalizing roads, buildings, paths and environment…" }, onProgress);
    const extracted = await RealSceneExtractionService.extract(area.coreArea);
    const geometry: RealSceneGeometry = {
      ...extracted.geometry,
      warnings: extracted.geometry.warnings.filter((warning) => !warning.toLowerCase().includes("map snapshot")),
    };
    const normalizedArchive = await ForensicSourceArchiveService.saveJson("osm-normalized", geometry);
    stages = updateStage(stages, "normalize-geometry", { status: "complete", progressPercent: 100, message: `${geometry.roads.length} road(s), ${geometry.buildings.length} building(s), ${geometry.paths.length} path(s).` }, onProgress);

    stages = updateStage(stages, "acquire-elevation", { status: "running", progressPercent: 25, message: "Sampling macro elevation across the forensic core…" }, onProgress);
    let terrain = ForensicElevationService.flatFallback(area, "Elevation has not been requested yet.");
    let elevationRaw: unknown = null;
    try {
      const elevation = await ForensicElevationService.acquire(area);
      terrain = elevation.terrain;
      elevationRaw = elevation.rawResponses;
      stages = updateStage(stages, "acquire-elevation", { status: "complete", progressPercent: 100, message: `DEM ready · relief ${terrain.reliefMetres.toFixed(2)} m.` }, onProgress);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      terrain = ForensicElevationService.flatFallback(area, message);
      stages = updateStage(stages, "acquire-elevation", { status: "warning", progressPercent: 100, message: "Elevation unavailable. Explicit flat fallback created." }, onProgress);
    }

    stages = updateStage(stages, "archive-elevation", { status: "running", progressPercent: 40, message: "Freezing elevation response…" }, onProgress);
    const elevationArchive = elevationRaw ? await ForensicSourceArchiveService.saveJson("elevation-raw", { area: area.coreArea, raw: elevationRaw }) : undefined;
    if (elevationArchive) terrain = { ...terrain, archive: elevationArchive };
    stages = updateStage(stages, "archive-elevation", { status: elevationArchive ? "complete" : "warning", progressPercent: 100, message: elevationArchive ? `Terrain source archived · ${elevationArchive.sha256.slice(0, 12)}` : "No external elevation payload was available to archive." }, onProgress);

    const sources = sourceRecords(geometry, rawArchive, rawArchive.capturedAt, raw.endpoint);
    sources.push({
      id: createId("source-terrain"),
      layer: "terrain",
      provider: terrain.provider,
      classification: terrain.classification,
      status: terrain.status === "ready" ? "ready" : "unavailable",
      confidence: terrain.confidence,
      capturedAt: terrain.capturedAt,
      coverage: "core",
      nominalResolutionMetres: terrain.nominalResolutionMetres || undefined,
      archive: elevationArchive,
      attribution: terrain.attribution,
      notes: terrain.notes,
    });

    stages = updateStage(stages, "quality-assurance", { status: "running", progressPercent: 50, message: "Checking coverage, source integrity and uncertainty…" }, onProgress);
    const archiveCount = [rawArchive, normalizedArchive, elevationArchive].filter(Boolean).length;
    const qa = qaReport(geometry, terrain.status === "ready", archiveCount);

    const layers: ForensicLayerAssessment[] = [
      ["roads", geometry.roads.length],
      ["buildings", geometry.buildings.length],
      ["paths", geometry.paths.length],
      ["barriers", geometry.barriers.length],
      ["land-cover", geometry.landCover?.length ?? 0],
      ["vegetation", geometry.vegetation?.length ?? 0],
      ["terrain", undefined],
    ].map(([layer, featureCount]) => {
      const source = sources.find((item) => item.layer === layer);
      return {
        layer: layer as ForensicLayerAssessment["layer"],
        classification: source?.classification ?? "Unknown",
        confidence: source?.confidence ?? 0,
        sourceIds: source ? [source.id] : [],
        featureCount: typeof featureCount === "number" ? featureCount : undefined,
        notes: layer === "terrain" ? ["Macro elevation does not resolve forensic microgeometry."] : [],
      };
    });
    stages = updateStage(stages, "quality-assurance", { status: qa.decision === "INSUFFICIENT — DO NOT USE" ? "warning" : "complete", progressPercent: 100, message: `${qa.overallScorePercent}% · ${qa.decision}` }, onProgress);

    stages = updateStage(stages, "freeze-package", { status: "running", progressPercent: 50, message: "Computing deterministic package hashes…" }, onProgress);
    const geometrySha256 = await sha256Json(geometry);
    const packageBase = {
      schemaVersion: "RoadSafe Forensic Scene V1" as const,
      id: createId("forensic-scene"),
      version: 1 as const,
      createdAt: new Date().toISOString(),
      area,
      terrain,
      sources,
      layers,
      qa,
      geometrySha256,
      legacyGeometryVersion: geometry.version,
      reviewStatus: "pending-investigator-review" as const,
    };
    const snapshotSha256 = await sha256Json(packageBase);
    let scenePackage: ForensicScenePackage = { ...packageBase, snapshotSha256 };
    const manifestArchive = await ForensicSourceArchiveService.saveJson("pipeline-manifest", scenePackage);
    scenePackage = {
      ...scenePackage,
      sources: [
        ...scenePackage.sources,
        {
          id: createId("source-area"),
          layer: "area",
          provider: "RoadSafe forensic area authoring",
          classification: "Measured",
          status: "ready",
          confidence: 1,
          capturedAt: area.frozenAt,
          coverage: "core+context",
          archive: manifestArchive,
          attribution: "RoadSafe case record",
          notes: ["Boundary, local frame, source references and QA are frozen into this manifest."],
        },
      ],
    };
    stages = updateStage(stages, "freeze-package", { status: "complete", progressPercent: 100, message: `Forensic scene frozen · ${snapshotSha256.slice(0, 16)}` }, onProgress);

    return { geometry, scenePackage, stages };
  },
};
