import type {
  AccidentReconstruction,
  ReconstructionPosition,
} from "../../types/reconstruction";
import type {
  FieldCaptureMode,
  FieldPlacementTarget,
} from "../../types/fieldPlacement";

import RoadSceneEnvironment from "../reconstruction/RoadSceneEnvironment";
import { getParticipantStateAtTime } from "../../utils/reconstructionGeometry";

interface FieldSceneLivePreviewProps {
  reconstruction: AccidentReconstruction;
  currentTimeSeconds?: number;
  liveScenePosition: ReconstructionPosition | null;
  pendingScenePosition?: ReconstructionPosition | null;
  selectedTarget: FieldPlacementTarget | null;
  rawTraceScenePoints?: ReconstructionPosition[];
  processedTraceScenePoints?: ReconstructionPosition[];
  captureMode?: FieldCaptureMode;
}

const COLOURS: Record<string, string> = {
  Blue: "#2563eb",
  Red: "#dc2626",
  Green: "#16a34a",
  Yellow: "#eab308",
  Black: "#111827",
  White: "#f8fafc",
  Orange: "#ea580c",
  Purple: "#9333ea",
};

function targetPosition(
  reconstruction: AccidentReconstruction,
  target: FieldPlacementTarget | null,
): ReconstructionPosition | null {
  if (!target) return null;

  switch (target.type) {
    case "ParticipantPathPoint": {
      const participant = reconstruction.vehicles.find(
        (item) => item.id === target.targetId,
      );
      return (
        participant?.pathPoints.find((point) => point.id === target.subTargetId)
          ?.position ?? null
      );
    }
    case "SceneObject":
      return (
        reconstruction.sceneObjects.find((object) => object.id === target.targetId)
          ?.position ?? null
      );
    case "EvidenceRecord":
      return (
        reconstruction.evidenceRecords.find((record) => record.id === target.targetId)
          ?.position ?? null
      );
    case "MeasurementStart":
      return (
        reconstruction.measurements.find((measurement) => measurement.id === target.targetId)
          ?.start ?? null
      );
    case "MeasurementEnd":
      return (
        reconstruction.measurements.find((measurement) => measurement.id === target.targetId)
          ?.end ?? null
      );
    case "CollisionPoint":
      return reconstruction.collisionPoint;
  }
}

export default function FieldSceneLivePreview({
  reconstruction,
  currentTimeSeconds = 0,
  liveScenePosition,
  pendingScenePosition = null,
  selectedTarget,
  rawTraceScenePoints = [],
  processedTraceScenePoints = [],
  captureMode = "Point",
}: FieldSceneLivePreviewProps) {
  const currentTargetPosition = targetPosition(reconstruction, selectedTarget);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-400">
            Calibrated reconstruction
          </p>
          <h3 className="text-sm font-black text-white">Live 2D placement preview</h3>
        </div>
        <span className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[10px] font-black text-slate-200">
          {liveScenePosition ? "GPS aligned" : "Waiting for calibrated GPS"}
        </span>
      </div>

      <div className="relative h-[390px] overflow-hidden bg-slate-600">
        <RoadSceneEnvironment settings={reconstruction.scene} />

        <svg
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {reconstruction.vehicles.map((participant) => (
            <polyline
              key={`${participant.id}-field-path`}
              points={participant.pathPoints
                .map((point) => `${point.position.x},${point.position.y}`)
                .join(" ")}
              fill="none"
              stroke={COLOURS[participant.colour] ?? "#2563eb"}
              strokeWidth={0.4}
              strokeDasharray="1.2 1"
              opacity={0.55}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {rawTraceScenePoints.length >= 2 && (
            <polyline
              points={rawTraceScenePoints.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={0.55}
              strokeDasharray="1.4 1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {processedTraceScenePoints.length >= 2 && (
            captureMode === "Boundary" ? (
              <polygon
                points={processedTraceScenePoints.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="#0ea5e9"
                fillOpacity={0.15}
                stroke="#0284c7"
                strokeWidth={0.75}
                vectorEffect="non-scaling-stroke"
              />
            ) : (
              <polyline
                points={processedTraceScenePoints.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="#0284c7"
                strokeWidth={0.85}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )
          )}
        </svg>

        {reconstruction.sceneObjects
          .filter((object) => object.visible)
          .map((object) => (
            <div
              key={object.id}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-slate-950/80 px-2 py-1 text-[9px] font-black text-white shadow"
              style={{ left: `${object.position.x}%`, top: `${object.position.y}%` }}
              title={object.label}
            >
              {object.type === "Pothole" ? "◉" : object.type === "Skid Mark" ? "〰" : "◆"}
            </div>
          ))}

        {reconstruction.vehicles.map((participant) => {
          const state = getParticipantStateAtTime(participant, currentTimeSeconds);
          return (
            <div
              key={`${participant.id}-field-position`}
              className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${state.position.x}%`,
                top: `${state.position.y}%`,
                transform: `translate(-50%, -50%) rotate(${state.rotation}deg)`,
              }}
              title={`${participant.name} at ${currentTimeSeconds.toFixed(1)}s`}
            >
              <div
                className="flex h-7 min-w-7 items-center justify-center rounded-md border-2 border-white px-1 text-[8px] font-black text-white shadow-lg"
                style={{ backgroundColor: COLOURS[participant.colour] ?? "#2563eb" }}
              >
                {participant.name.slice(0, 8)}
              </div>
            </div>
          );
        })}

        {currentTargetPosition && (
          <div
            className="absolute z-40 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 bg-amber-500/50 shadow"
            style={{
              left: `${currentTargetPosition.x}%`,
              top: `${currentTargetPosition.y}%`,
            }}
            title="Current stored target position"
          />
        )}

        {liveScenePosition && (
          <div
            className="absolute z-50 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${liveScenePosition.x}%`,
              top: `${liveScenePosition.y}%`,
            }}
          >
            <span className="relative flex h-7 w-7 items-center justify-center rounded-full border-4 border-white bg-blue-800 text-[8px] font-black text-white shadow-xl">
              GPS
            </span>
          </div>
        )}

        {pendingScenePosition && (
          <div
            className="absolute z-[55] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white bg-amber-500 px-2 py-1 text-[9px] font-black text-slate-950 shadow-xl"
            style={{
              left: `${pendingScenePosition.x}%`,
              top: `${pendingScenePosition.y}%`,
            }}
          >
            REVIEW
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-50 max-w-[84%] rounded-xl bg-slate-950/90 px-3 py-2 text-[10px] font-semibold text-white shadow-lg backdrop-blur-sm">
          {selectedTarget
            ? `Selected: ${selectedTarget.label}. Amber is the stored position; blue is the officer; REVIEW is the proposed averaged point.`
            : "Select a capture target. Raw walking data appears in amber and processed geometry in blue."}
        </div>
      </div>
    </section>
  );
}
