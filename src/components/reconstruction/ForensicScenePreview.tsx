import {
  sceneEnvironmentLabel,
  usesGeneratedRoad,
  type AccidentReconstruction,
  type EvidenceRecord,
  type ReconstructionPosition,
  type ReconstructionVehicle,
} from "../../types/reconstruction";
import { getParticipantStateAtTime } from "../../utils/reconstructionGeometry";
import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";
import { Participant2DSceneGlyph } from "./Participant2DModel";

interface ForensicScenePreviewProps {
  reconstruction: AccidentReconstruction;
  timeSeconds?: number;
  evidence?: EvidenceRecord;
  className?: string;
  showPaths?: boolean;
}

const COLOURS: Record<string, string> = {
  Blue: "#4b83d1",
  Red: "#9b3039",
  Green: "#39785b",
  Yellow: "#b18b3d",
  Black: "#292929",
  White: "#d8dde5",
  Orange: "#a35d33",
  Purple: "#695585",
};

function point(position: ReconstructionPosition): string {
  return `${position.x},${position.y}`;
}

function ParticipantGlyph({
  participant,
  position,
  rotation,
  worldDimensions,
}: {
  participant: ReconstructionVehicle;
  position: ReconstructionPosition;
  rotation: number;
  worldDimensions: {
    widthMetres: number;
    heightMetres: number;
  };
}) {
  return (
    <Participant2DSceneGlyph
      participant={participant}
      position={position}
      rotation={rotation}
      worldDimensions={worldDimensions}
    />
  );
}

function RoadGeometry({ reconstruction }: { reconstruction: AccidentReconstruction }) {
  const layout = reconstruction.scene.roadLayout;
  const laneCount = Math.max(1, reconstruction.scene.laneCount);
  const laneSpacing = 22 / laneCount;
  const laneLines = Array.from({ length: Math.max(0, laneCount - 1) }, (_, index) =>
    39 + laneSpacing * (index + 1),
  );

  const horizontal = (
    <>
      <rect x="0" y="36" width="100" height="28" fill="url(#asphalt)" />
      <rect x="0" y="34.5" width="100" height="1.5" fill="#7b8188" />
      <rect x="0" y="64" width="100" height="1.5" fill="#7b8188" />
      {laneLines.map((value) => (
        <line key={`h-${value}`} x1="0" x2="100" y1={value} y2={value} stroke="#d8d8d0" strokeWidth="0.45" strokeDasharray="4 3" opacity="0.78" />
      ))}
    </>
  );

  const vertical = (
    <>
      <rect x="36" y="0" width="28" height="100" fill="url(#asphalt)" />
      <rect x="34.5" y="0" width="1.5" height="100" fill="#7b8188" />
      <rect x="64" y="0" width="1.5" height="100" fill="#7b8188" />
      {laneLines.map((value) => (
        <line key={`v-${value}`} y1="0" y2="100" x1={value} x2={value} stroke="#d8d8d0" strokeWidth="0.45" strokeDasharray="4 3" opacity="0.78" />
      ))}
    </>
  );

  if (layout === "Straight Road") return horizontal;
  if (layout === "T-Junction") return <>{horizontal}<rect x="36" y="0" width="28" height="51" fill="url(#asphalt)" />{vertical}</>;
  if (layout === "Roundabout") {
    return (
      <>
        {horizontal}{vertical}
        <circle cx="50" cy="50" r="17" fill="url(#asphalt)" stroke="#858b91" strokeWidth="1.4" />
        <circle cx="50" cy="50" r="8.5" fill="#29372f" stroke="#66716a" strokeWidth="1.2" />
        <circle cx="50" cy="50" r="13.5" fill="none" stroke="#d8d8d0" strokeWidth="0.45" strokeDasharray="3.5 2.5" opacity="0.8" />
      </>
    );
  }
  return <>{horizontal}{vertical}</>;
}

export default function ForensicScenePreview({
  reconstruction,
  timeSeconds = reconstruction.durationSeconds / 2,
  evidence,
  className = "",
  showPaths = true,
}: ForensicScenePreviewProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className={`block h-full w-full bg-[#303030] ${className}`}
      role="img"
      aria-label={`${reconstruction.title} scene preview`}
    >
      <defs>
        <filter id={`noise-${reconstruction.id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="table" tableValues="0 0.13" /></feComponentTransfer>
        </filter>
        <pattern id="asphalt" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill={reconstruction.scene.roadSurface === "Wet" ? "#252d34" : "#30343a"} />
          <path d="M0 2 L10 0 M0 7 L10 5 M3 10 L10 8" stroke="#4b5054" strokeWidth="0.18" opacity="0.45" />
        </pattern>
        <radialGradient id="impactGlow">
          <stop offset="0" stopColor="#e1454c" stopOpacity="0.85" />
          <stop offset="0.35" stopColor="#e1454c" stopOpacity="0.28" />
          <stop offset="1" stopColor="#e1454c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="#1b241f" />
      <rect width="100" height="100" filter={`url(#noise-${reconstruction.id})`} opacity="0.4" />
      {usesGeneratedRoad(reconstruction.scene) && (
        <RoadGeometry reconstruction={reconstruction} />
      )}
      <g opacity="0.85">
        {showPaths && reconstruction.vehicles.map((participant) => (
          <polyline
            key={participant.id}
            points={participant.pathPoints.map((item) => point(item.position)).join(" ")}
            fill="none"
            stroke={COLOURS[participant.colour] ?? "#4b83d1"}
            strokeWidth="0.75"
            strokeDasharray="2.3 1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>
      <circle cx={reconstruction.collisionPoint.x} cy={reconstruction.collisionPoint.y} r="7.5" fill="url(#impactGlow)" />
      <circle cx={reconstruction.collisionPoint.x} cy={reconstruction.collisionPoint.y} r="1.25" fill="#e1454c" stroke="#ffe5e5" strokeWidth="0.4" />
      {reconstruction.vehicles.map((participant) => {
        const state = getParticipantStateAtTime(
                        participant,
                        timeSeconds,
                        getReconstructionWorldDimensions(reconstruction),
                      );
        return (
          <ParticipantGlyph
            key={participant.id}
            participant={participant}
            position={state.position}
            rotation={state.rotation}
                      worldDimensions={
              getReconstructionWorldDimensions(
                reconstruction,
              )
            }
/>
        );
      })}
      {evidence && (
        <g transform={`translate(${evidence.position.x} ${evidence.position.y})`}>
          <circle r="3.3" fill="#202020" stroke="#79a9f2" strokeWidth="0.65" />
          <text y="1.05" textAnchor="middle" fontSize="2.8" fontWeight="700" fill="#dceaff">
            E{evidence.evidenceNumber}
          </text>
        </g>
      )}
      <rect x="1.5" y="92.5" width="31" height="5.5" rx="1" fill="#202020" fillOpacity="0.82" stroke="#263650" strokeWidth="0.35" />
      <text x="3.2" y="96" fontSize="2.3" fill="#aeb9c8">
        {sceneEnvironmentLabel(reconstruction.scene)}
      </text>
    </svg>
  );
}
