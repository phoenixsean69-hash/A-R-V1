import { useEffect, useMemo, useState } from "react";

import { SceneSnapshotService } from "../../services/sceneSnapshotService";
import type {
  RealSceneGeometry,
  RealSceneLandCoverType,
  RealSceneLocalPoint,
  RealSceneRoadGeometry,
  RealSceneVegetationGeometry,
} from "../../types/realSceneGeometry";
import type { RoadSceneSettings } from "../../types/reconstruction";

interface RealSceneGeometryLayerProps {
  geometry: RealSceneGeometry;
  settings: RoadSceneSettings;
}

interface Point2 {
  x: number;
  y: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(left: Point2, right: Point2): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function localPoint(point: RealSceneLocalPoint): Point2 {
  return { x: point.xMetres, y: point.yMetres };
}

function catmullRomPoint(
  first: Point2,
  second: Point2,
  third: Point2,
  fourth: Point2,
  progress: number,
): Point2 {
  const progressSquared = progress * progress;
  const progressCubed = progressSquared * progress;
  return {
    x:
      0.5 *
      (2 * second.x +
        (-first.x + third.x) * progress +
        (2 * first.x - 5 * second.x + 4 * third.x - fourth.x) *
          progressSquared +
        (-first.x + 3 * second.x - 3 * third.x + fourth.x) *
          progressCubed),
    y:
      0.5 *
      (2 * second.y +
        (-first.y + third.y) * progress +
        (2 * first.y - 5 * second.y + 4 * third.y - fourth.y) *
          progressSquared +
        (-first.y + 3 * second.y - 3 * third.y + fourth.y) *
          progressCubed),
  };
}

function sampleSmoothPath(points: Point2[], closed: boolean): Point2[] {
  if (points.length <= 2) return [...points];
  const source =
    closed && distance(points[0], points[points.length - 1]) < 0.1
      ? points.slice(0, -1)
      : points;
  if (source.length <= 2) return [...source];

  const result: Point2[] = [];
  const segmentCount = closed ? source.length : source.length - 1;

  for (let index = 0; index < segmentCount; index += 1) {
    const get = (offset: number): Point2 => {
      if (closed) {
        const wrapped = (index + offset + source.length) % source.length;
        return source[wrapped];
      }
      return source[clamp(index + offset, 0, source.length - 1)];
    };
    const first = get(-1);
    const second = get(0);
    const third = get(1);
    const fourth = get(2);
    const segmentLength = distance(second, third);
    const subdivisions = clamp(Math.ceil(segmentLength / 1.4), 6, 28);

    for (let step = 0; step < subdivisions; step += 1) {
      result.push(
        catmullRomPoint(first, second, third, fourth, step / subdivisions),
      );
    }
  }

  result.push(closed ? { ...result[0] } : { ...source[source.length - 1] });
  return result;
}

function toPercent(point: Point2, geometry: RealSceneGeometry): Point2 {
  return {
    x: clamp((point.x / geometry.sceneWidthMetres) * 100, 0, 100),
    y: clamp(100 - (point.y / geometry.sceneHeightMetres) * 100, 0, 100),
  };
}

function pathData(points: Point2[], close = false): string {
  if (points.length === 0) return "";
  const commands = points.map(
    (point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
  );
  if (close) commands.push("Z");
  return commands.join(" ");
}

function createRoadRibbon(
  road: RealSceneRoadGeometry,
  geometry: RealSceneGeometry,
  extraWidthMetres = 0,
): Point2[] {
  const samples = sampleSmoothPath(
    road.localPoints.map(localPoint),
    road.isRoundabout,
  );
  if (samples.length < 2) return [];
  const halfWidth = road.widthMetres / 2 + extraWidthMetres;
  const left: Point2[] = [];
  const right: Point2[] = [];

  samples.forEach((point, index) => {
    const previous = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    const deltaX = next.x - previous.x;
    const deltaY = next.y - previous.y;
    const length = Math.hypot(deltaX, deltaY) || 1;
    const normal = { x: -deltaY / length, y: deltaX / length };
    left.push({
      x: point.x + normal.x * halfWidth,
      y: point.y + normal.y * halfWidth,
    });
    right.push({
      x: point.x - normal.x * halfWidth,
      y: point.y - normal.y * halfWidth,
    });
  });

  return [...left, ...right.reverse()].map((point) => toPercent(point, geometry));
}

function roadCentrePath(
  road: RealSceneRoadGeometry,
  geometry: RealSceneGeometry,
): string {
  return pathData(
    sampleSmoothPath(road.localPoints.map(localPoint), road.isRoundabout).map(
      (point) => toPercent(point, geometry),
    ),
  );
}

function polygonFromLocalPoints(
  points: RealSceneLocalPoint[],
  geometry: RealSceneGeometry,
): string {
  return pathData(
    points.map((point) => toPercent(localPoint(point), geometry)),
    true,
  );
}

function landCoverColour(type: RealSceneLandCoverType): string {
  switch (type) {
    case "Forest":
      return "#254631";
    case "Woodland":
      return "#31533a";
    case "Scrub":
      return "#526245";
    case "Grass":
      return "#4f6847";
    case "Meadow":
      return "#61734c";
    case "Farmland":
      return "#746b49";
    case "Orchard":
      return "#405d3f";
    case "Park":
      return "#456448";
    case "Garden":
      return "#567151";
    case "Wetland":
      return "#3f5c59";
    case "Bare Ground":
      return "#786a56";
    case "Water":
      return "#315a70";
    case "Other":
    default:
      return "#4c5848";
  }
}

function vegetationSymbol(
  plant: RealSceneVegetationGeometry,
  geometry: RealSceneGeometry,
) {
  const position = toPercent(localPoint(plant.localPosition), geometry);
  const averageDimension =
    (geometry.sceneWidthMetres + geometry.sceneHeightMetres) / 2;
  const radius = clamp(
    (plant.canopyDiameterMetres / Math.max(1, averageDimension)) * 50,
    0.22,
    1.15,
  );
  const fill =
    plant.vegetationType === "Shrub"
      ? "#55734d"
      : plant.vegetationType === "Palm"
        ? "#47764b"
        : "#2f603c";

  return (
    <g key={plant.id} opacity={plant.generatedFromLandCover ? 0.84 : 0.98}>
      <circle
        cx={position.x}
        cy={position.y}
        r={radius * 1.25}
        fill="rgba(8,18,11,.22)"
      />
      <circle
        cx={position.x}
        cy={position.y}
        r={radius}
        fill={fill}
        stroke="#173424"
        strokeWidth="0.12"
        vectorEffect="non-scaling-stroke"
      />
      {plant.vegetationType === "Palm" && (
        <path
          d={`M ${position.x - radius} ${position.y} L ${position.x + radius} ${position.y} M ${position.x} ${position.y - radius} L ${position.x} ${position.y + radius}`}
          stroke="#b8c875"
          strokeWidth="0.1"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

export default function RealSceneGeometryLayer({
  geometry,
  settings,
}: RealSceneGeometryLayerProps) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;

    if (!geometry.snapshot?.id) {
      setSnapshotUrl(null);
      return undefined;
    }

    void SceneSnapshotService.createObjectUrl(geometry.snapshot.id)
      .then((url) => {
        if (disposed) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSnapshotUrl(url);
      })
      .catch((error) => {
        console.warn("Real-scene snapshot could not be displayed:", error);
        setSnapshotUrl(null);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [geometry.snapshot?.id]);

  const landCover = geometry.landCover ?? [];
  const vegetation = geometry.vegetation ?? [];
  const roads = useMemo(
    () =>
      geometry.roads.map((road) => ({
        road,
        pavement: createRoadRibbon(road, geometry, 1.3),
        surface: createRoadRibbon(road, geometry),
        centrePath: roadCentrePath(road, geometry),
      })),
    [geometry],
  );

  const roadColour = settings.roadSurface === "Wet" ? "#27343d" : "#30343a";
  const groundColour = settings.timeOfDay === "Night" ? "#101716" : "#455345";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{ background: groundColour }}
    >
      {snapshotUrl && (
        <img
          src={snapshotUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-fill opacity-35 saturate-[0.76] contrast-[0.92]"
        />
      )}

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g opacity="0.82">
          {landCover.map((cover) => (
            <path
              key={cover.id}
              d={polygonFromLocalPoints(cover.localPoints, geometry)}
              fill={landCoverColour(cover.landCoverType)}
              stroke="rgba(210,225,205,.18)"
              strokeWidth="0.18"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <g>{vegetation.map((plant) => vegetationSymbol(plant, geometry))}</g>

        <g opacity="0.96">
          {geometry.buildings.map((building) => (
            <path
              key={building.id}
              d={polygonFromLocalPoints(building.localPoints, geometry)}
              fill="#48535f"
              stroke="#8c99a6"
              strokeWidth="0.32"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {settings.showPavements && (
          <g>
            {roads.map(({ road, pavement }) => (
              <path
                key={`${road.id}-pavement`}
                d={pathData(pavement, true)}
                fill="#747a7f"
                stroke="#979da2"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}

        <g>
          {roads.map(({ road, surface }) => (
            <path
              key={road.id}
              d={pathData(surface, true)}
              fill={roadColour}
              stroke="#171a1d"
              strokeWidth="0.45"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {settings.showLaneMarkings && (
          <g fill="none" opacity="0.82">
            {roads
              .filter(({ road }) => road.laneCount > 1)
              .map(({ road, centrePath }) => (
                <path
                  key={`${road.id}-marking`}
                  d={centrePath}
                  stroke={road.laneCount % 2 === 0 ? "#d7b34c" : "#e8e9e6"}
                  strokeWidth="0.16"
                  strokeDasharray={road.isRoundabout ? "0.8 0.65" : "1.4 1.05"}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </g>
        )}

        <g fill="none">
          {geometry.paths.map((path) => (
            <path
              key={path.id}
              d={pathData(
                sampleSmoothPath(path.localPoints.map(localPoint), false).map(
                  (point) => toPercent(point, geometry),
                ),
              )}
              stroke="#c6b38a"
              strokeWidth={clamp(
                (path.widthMetres /
                  ((geometry.sceneWidthMetres + geometry.sceneHeightMetres) / 2)) *
                  100,
                0.35,
                2.2,
              )}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="0.6 0.45"
            />
          ))}
        </g>

        <g fill="none">
          {geometry.barriers.map((barrier) => (
            <path
              key={barrier.id}
              d={pathData(
                barrier.localPoints.map((point) =>
                  toPercent(localPoint(point), geometry),
                ),
              )}
              stroke="#9ba3aa"
              strokeWidth="0.28"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        <rect
          x="0.18"
          y="0.18"
          width="99.64"
          height="99.64"
          fill="none"
          stroke="rgba(93,160,255,.72)"
          strokeWidth="0.28"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="absolute bottom-3 left-3 rounded-md border border-sky-300/25 bg-[#050914]/82 px-3 py-2 text-[8px] font-black uppercase tracking-[0.15em] text-sky-100 backdrop-blur-sm">
        Exact selected area · {geometry.sceneWidthMetres.toFixed(1)} × {geometry.sceneHeightMetres.toFixed(1)} m
      </div>
      <div className="absolute bottom-3 right-3 rounded-md border border-white/10 bg-[#050914]/75 px-3 py-2 text-[8px] font-semibold text-slate-200 backdrop-blur-sm">
        {geometry.buildings.length} buildings · {vegetation.length} vegetation · {geometry.attribution}
      </div>
    </div>
  );
}
