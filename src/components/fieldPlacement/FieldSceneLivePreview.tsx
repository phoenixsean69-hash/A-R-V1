import type {
  AccidentReconstruction,
  ReconstructionPosition,
} from "../../types/reconstruction";
import type { FieldPlacementTarget } from "../../types/fieldPlacement";

import RoadSceneEnvironment from "../reconstruction/RoadSceneEnvironment";
import { getParticipantStateAtTime } from "../../utils/reconstructionGeometry";

interface FieldSceneLivePreviewProps {
  reconstruction: AccidentReconstruction;
  currentTimeSeconds?: number;
  liveScenePosition: ReconstructionPosition | null;
  selectedTarget: FieldPlacementTarget | null;
  traceScenePoints?: ReconstructionPosition[];
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
  selectedTarget,
  traceScenePoints = [],
}: FieldSceneLivePreviewProps) {
  const currentTargetPosition = targetPosition(reconstruction, selectedTarget);

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100 bg-cyan-50 px-4 py-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.17em] text-cyan-700">
            Live scene alignment
          </p>
          <h3 className="font-black text-gray-950">Real-time 2D Reconstruction Preview</h3>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-cyan-800 shadow-sm">
          {liveScenePosition ? "GPS aligned" : "Waiting for calibrated GPS"}
        </span>
      </div>

      <div className="relative h-[340px] overflow-hidden bg-slate-600">
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
              opacity={0.65}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {traceScenePoints.length >= 2 && (
            <polyline
              points={traceScenePoints.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke="#06b6d4"
              strokeWidth={0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {reconstruction.sceneObjects
          .filter((object) => object.visible)
          .map((object) => (
            <div
              key={object.id}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-gray-900/75 px-2 py-1 text-[9px] font-black text-white shadow"
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

        <div
          className="absolute z-40 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${reconstruction.collisionPoint.x}%`,
            top: `${reconstruction.collisionPoint.y}%`,
          }}
          title="Primary collision point"
        >
          <div className="relative h-7 w-7 rounded-full border-2 border-white bg-red-600 shadow-lg">
            <span className="absolute inset-1 rounded-full border border-white/80" />
            <span className="absolute left-1/2 top-[-7px] h-[39px] w-[2px] -translate-x-1/2 bg-red-600/80" />
            <span className="absolute left-[-7px] top-1/2 h-[2px] w-[39px] -translate-y-1/2 bg-red-600/80" />
          </div>
        </div>

        {currentTargetPosition && (
          <div
            className="absolute z-40 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 bg-amber-500/40 shadow"
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
            <span className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-cyan-400/30" />
            <span className="relative flex h-7 w-7 items-center justify-center rounded-full border-4 border-white bg-cyan-500 text-[9px] font-black text-white shadow-xl">
              GPS
            </span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-50 max-w-[80%] rounded-sm bg-slate-950/80 px-3 py-2 text-[11px] font-semibold text-white backdrop-blur-sm">
          {selectedTarget
            ? `Selected target: ${selectedTarget.label}. The cyan GPS marker moves across the same calibrated scene in real time.`
            : "Select a placement target to compare its stored position with the live GPS position."}
        </div>
      </div>
    </section>
  );
}
