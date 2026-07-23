import RoadSceneEnvironment from "../reconstruction/RoadSceneEnvironment";

import type {
  RoadLayoutDetection,
} from "../../types/roadLayoutDetection";

import type { RoadSceneSettings } from "../../types/reconstruction";

interface RoadDetectionPreviewProps {
  detection: RoadLayoutDetection;
  sceneSettings: RoadSceneSettings;
}

function getRoadWidth(highwayType: string): number {
  switch (highwayType) {
    case "motorway":
    case "trunk":
      return 3.2;
    case "primary":
    case "secondary":
      return 2.7;
    case "tertiary":
    case "residential":
      return 2.2;
    case "service":
      return 1.4;
    default:
      return 1.8;
  }
}

function getFeatureSymbol(type: string): string {
  switch (type) {
    case "Traffic Signal":
      return "●";
    case "Pedestrian Crossing":
      return "▤";
    case "Stop Sign":
      return "S";
    case "Give Way Sign":
      return "▽";
    case "Bus Stop":
    case "Bus Station":
      return "B";
    default:
      return "•";
  }
}

export default function RoadDetectionPreview({
  detection,
  sceneSettings,
}: RoadDetectionPreviewProps) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="font-black text-slate-900">Detected map geometry</h3>
          <p className="mt-1 text-xs text-slate-500">
            Nearby OpenStreetMap roads normalised around the officer’s confirmed position.
          </p>
        </div>

        <div className="relative aspect-square overflow-hidden bg-emerald-950/10">
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            aria-label="Detected road geometry preview"
          >
            <rect width="100" height="100" fill="#64745b" />

            {detection.roads.map((road) => (
              <polyline
                key={road.id}
                points={road.scenePoints
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
                fill="none"
                stroke="#30343b"
                strokeWidth={getRoadWidth(road.highwayType)}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {detection.roads.map((road) => (
              <polyline
                key={`${road.id}-centre`}
                points={road.scenePoints
                  .map((point) => `${point.x},${point.y}`)
                  .join(" ")}
                fill="none"
                stroke="rgba(255,255,255,.75)"
                strokeWidth={0.2}
                strokeDasharray="1.2 1.1"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <circle
              cx={detection.junctionCentre.x}
              cy={detection.junctionCentre.y}
              r={1.8}
              fill="#dc2626"
              stroke="#ffffff"
              strokeWidth={0.7}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {detection.features.map((feature) => (
            <span
              key={feature.id}
              className="absolute z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[9px] font-black text-slate-950 shadow"
              style={{
                left: `${feature.scenePosition.x}%`,
                top: `${feature.scenePosition.y}%`,
              }}
              title={feature.type}
            >
              {getFeatureSymbol(feature.type)}
            </span>
          ))}

          {detection.roads.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              <div className="rounded-2xl bg-white/90 p-5 shadow">
                <p className="font-black text-slate-900">No road geometry available</p>
                <p className="mt-2 text-sm text-slate-600">
                  Use the manual layout controls to create the scene.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="font-black text-slate-900">Generated 2D scene</h3>
          <p className="mt-1 text-xs text-slate-500">
            This is the editable reconstruction template that will be created.
          </p>
        </div>

        <div className="relative aspect-square overflow-hidden bg-slate-600">
          <RoadSceneEnvironment settings={sceneSettings} />

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-red-600 shadow-lg" />

          <div className="pointer-events-none absolute bottom-3 left-3 z-30 rounded-lg bg-slate-950/75 px-3 py-2 text-xs font-bold text-white backdrop-blur">
            {sceneSettings.roadLayout} · {sceneSettings.laneCount} lane(s)
          </div>
        </div>
      </section>
    </div>
  );
}
