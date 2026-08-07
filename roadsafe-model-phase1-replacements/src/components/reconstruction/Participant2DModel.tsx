import type {
  CSSProperties,
} from "react";

import type {
  ReconstructionPosition,
  ReconstructionVehicle,
} from "../../types/reconstruction";

import {
  getParticipant2DDisplaySize,
  getParticipantAssetDefinition,
  getParticipantColourHex,
  getParticipantPhysicalDimensions,
} from "../../engine/assets/participantAssetCatalog";

interface Participant2DArtworkProps {
  participant: ReconstructionVehicle;
}

interface Participant2DModelProps {
  participant: ReconstructionVehicle;
  selected?: boolean;
  showLabel?: boolean;
  className?: string;
}

interface Participant2DSceneGlyphProps {
  participant: ReconstructionVehicle;
  position: ReconstructionPosition;
  rotation: number;
  worldDimensions: {
    widthMetres: number;
    heightMetres: number;
  };
}

function VehicleArtwork({
  participant,
}: Participant2DArtworkProps) {
  const asset =
    getParticipantAssetDefinition(participant);

  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const length = dimensions.lengthMetres;
  const width = dimensions.widthMetres;
  const colour =
    getParticipantColourHex(participant.colour);

  const bodyStroke =
    participant.colour === "White"
      ? "#6f6f6f"
      : "#d0d0d0";

  const front = length * 0.93;
  const rear = length * 0.07;
  const top = width * 0.08;
  const bottom = width * 0.92;

  const wheelLength =
    Math.max(0.18, length * 0.07);

  const wheelWidth =
    Math.max(0.08, width * 0.11);

  const wheelXs = [
    length * 0.25,
    length * 0.75,
  ];

  const windows = (() => {
    if (
      asset.id === "bus-city-generic" ||
      asset.id === "bus-minibus-generic"
    ) {
      const count =
        asset.id === "bus-city-generic"
          ? 7
          : 4;

      return Array.from(
        { length: count },
        (_, index) => {
          const available =
            length * 0.64;

          const segment =
            available / count;

          return (
            <rect
              key={index}
              x={
                length * 0.18 +
                segment * index +
                segment * 0.12
              }
              y={width * 0.16}
              width={segment * 0.72}
              height={width * 0.68}
              rx={width * 0.05}
              fill="#697b84"
              opacity={0.92}
            />
          );
        },
      );
    }

    return null;
  })();

  if (asset.id === "truck-articulated-generic") {
    return (
      <>
        <rect
          x={rear}
          y={top}
          width={length * 0.67}
          height={bottom - top}
          rx={width * 0.08}
          fill="#626262"
          stroke="#c2c2c2"
          strokeWidth={Math.max(0.03, width * 0.018)}
        />

        <rect
          x={length * 0.72}
          y={width * 0.12}
          width={length * 0.21}
          height={width * 0.76}
          rx={width * 0.14}
          fill={colour}
          stroke={bodyStroke}
          strokeWidth={Math.max(0.03, width * 0.018)}
        />

        <rect
          x={length * 0.82}
          y={width * 0.17}
          width={length * 0.08}
          height={width * 0.66}
          rx={width * 0.05}
          fill="#748995"
        />

        {[0.18, 0.55, 0.78].map((factor) => (
          <g key={factor}>
            <rect
              x={length * factor - wheelLength / 2}
              y={-wheelWidth * 0.18}
              width={wheelLength}
              height={wheelWidth}
              rx={wheelWidth * 0.25}
              fill="#1f1f1f"
            />
            <rect
              x={length * factor - wheelLength / 2}
              y={width - wheelWidth * 0.82}
              width={wheelLength}
              height={wheelWidth}
              rx={wheelWidth * 0.25}
              fill="#1f1f1f"
            />
          </g>
        ))}

        <rect
          x={front - length * 0.015}
          y={width * 0.2}
          width={length * 0.012}
          height={width * 0.18}
          fill="#f4df9a"
        />
        <rect
          x={front - length * 0.015}
          y={width * 0.62}
          width={length * 0.012}
          height={width * 0.18}
          fill="#f4df9a"
        />
      </>
    );
  }

  if (
    asset.id === "truck-rigid-generic" ||
    asset.id === "truck-lorry-generic"
  ) {
    return (
      <>
        <rect
          x={rear}
          y={top}
          width={length * 0.6}
          height={bottom - top}
          rx={width * 0.06}
          fill="#666666"
          stroke="#c2c2c2"
          strokeWidth={Math.max(0.03, width * 0.018)}
        />

        <rect
          x={length * 0.67}
          y={width * 0.1}
          width={length * 0.26}
          height={width * 0.8}
          rx={width * 0.12}
          fill={colour}
          stroke={bodyStroke}
          strokeWidth={Math.max(0.03, width * 0.018)}
        />

        <rect
          x={length * 0.78}
          y={width * 0.17}
          width={length * 0.11}
          height={width * 0.66}
          rx={width * 0.04}
          fill="#718995"
        />

        {wheelXs.map((x) => (
          <g key={x}>
            <rect
              x={x - wheelLength / 2}
              y={-wheelWidth * 0.18}
              width={wheelLength}
              height={wheelWidth}
              rx={wheelWidth * 0.25}
              fill="#1f1f1f"
            />
            <rect
              x={x - wheelLength / 2}
              y={width - wheelWidth * 0.82}
              width={wheelLength}
              height={wheelWidth}
              rx={wheelWidth * 0.25}
              fill="#1f1f1f"
            />
          </g>
        ))}
      </>
    );
  }

  if (asset.id === "truck-tractor-generic") {
    return (
      <>
        <rect
          x={length * 0.24}
          y={width * 0.24}
          width={length * 0.58}
          height={width * 0.52}
          rx={width * 0.11}
          fill={colour}
          stroke={bodyStroke}
          strokeWidth={Math.max(0.03, width * 0.018)}
        />

        <rect
          x={length * 0.52}
          y={width * 0.14}
          width={length * 0.24}
          height={width * 0.72}
          rx={width * 0.08}
          fill="#62757f"
        />

        <ellipse
          cx={length * 0.25}
          cy={width * 0.14}
          rx={length * 0.12}
          ry={width * 0.14}
          fill="#202020"
        />
        <ellipse
          cx={length * 0.25}
          cy={width * 0.86}
          rx={length * 0.12}
          ry={width * 0.14}
          fill="#202020"
        />
        <ellipse
          cx={length * 0.78}
          cy={width * 0.17}
          rx={length * 0.08}
          ry={width * 0.1}
          fill="#202020"
        />
        <ellipse
          cx={length * 0.78}
          cy={width * 0.83}
          rx={length * 0.08}
          ry={width * 0.1}
          fill="#202020"
        />
      </>
    );
  }

  if (asset.id === "car-pickup-generic") {
    return (
      <>
        <rect
          x={rear}
          y={top}
          width={front - rear}
          height={bottom - top}
          rx={width * 0.14}
          fill={colour}
          stroke={bodyStroke}
          strokeWidth={Math.max(0.03, width * 0.018)}
        />

        <rect
          x={length * 0.12}
          y={width * 0.18}
          width={length * 0.31}
          height={width * 0.64}
          rx={width * 0.05}
          fill="#4b4b4b"
          stroke="#858585"
          strokeWidth={Math.max(0.02, width * 0.012)}
        />

        <rect
          x={length * 0.49}
          y={width * 0.16}
          width={length * 0.3}
          height={width * 0.68}
          rx={width * 0.08}
          fill="#708691"
        />

        {wheelXs.map((x) => (
          <g key={x}>
            <rect
              x={x - wheelLength / 2}
              y={-wheelWidth * 0.18}
              width={wheelLength}
              height={wheelWidth}
              rx={wheelWidth * 0.25}
              fill="#202020"
            />
            <rect
              x={x - wheelLength / 2}
              y={width - wheelWidth * 0.82}
              width={wheelLength}
              height={wheelWidth}
              rx={wheelWidth * 0.25}
              fill="#202020"
            />
          </g>
        ))}
      </>
    );
  }

  if (
    asset.id === "bus-city-generic" ||
    asset.id === "bus-minibus-generic"
  ) {
    return (
      <>
        <rect
          x={rear}
          y={top}
          width={front - rear}
          height={bottom - top}
          rx={width * 0.13}
          fill={colour}
          stroke={bodyStroke}
          strokeWidth={Math.max(0.03, width * 0.018)}
        />

        {windows}

        {wheelXs.map((x) => (
          <g key={x}>
            <rect
              x={x - wheelLength / 2}
              y={-wheelWidth * 0.15}
              width={wheelLength}
              height={wheelWidth}
              rx={wheelWidth * 0.2}
              fill="#202020"
            />
            <rect
              x={x - wheelLength / 2}
              y={width - wheelWidth * 0.85}
              width={wheelLength}
              height={wheelWidth}
              rx={wheelWidth * 0.2}
              fill="#202020"
            />
          </g>
        ))}
      </>
    );
  }

  const suv =
    asset.id === "car-suv-generic";

  const hatchback =
    asset.id === "car-hatchback-generic";

  const shoulder =
    hatchback
      ? length * 0.18
      : length * 0.22;

  const cabinRear =
    hatchback
      ? length * 0.16
      : length * 0.27;

  const cabinFront =
    suv
      ? length * 0.77
      : length * 0.73;

  return (
    <>
      <path
        d={[
          `M ${rear + shoulder} ${top}`,
          `L ${front - shoulder * 0.45} ${top}`,
          `Q ${front} ${top} ${front} ${width * 0.28}`,
          `L ${front} ${width * 0.72}`,
          `Q ${front} ${bottom} ${front - shoulder * 0.45} ${bottom}`,
          `L ${rear + shoulder} ${bottom}`,
          `Q ${rear} ${bottom} ${rear} ${width * 0.68}`,
          `L ${rear} ${width * 0.32}`,
          `Q ${rear} ${top} ${rear + shoulder} ${top}`,
          "Z",
        ].join(" ")}
        fill={colour}
        stroke={bodyStroke}
        strokeWidth={Math.max(0.03, width * 0.018)}
      />

      <path
        d={[
          `M ${cabinRear} ${width * 0.18}`,
          `L ${cabinFront} ${width * 0.18}`,
          `L ${length * 0.82} ${width * 0.37}`,
          `L ${length * 0.82} ${width * 0.63}`,
          `L ${cabinFront} ${width * 0.82}`,
          `L ${cabinRear} ${width * 0.82}`,
          `L ${length * 0.18} ${width * 0.64}`,
          `L ${length * 0.18} ${width * 0.36}`,
          "Z",
        ].join(" ")}
        fill="#6f8793"
        stroke="#c2c2c2"
        strokeWidth={Math.max(0.02, width * 0.012)}
        opacity={0.96}
      />

      <line
        x1={length * 0.5}
        y1={width * 0.18}
        x2={length * 0.5}
        y2={width * 0.82}
        stroke="#555"
        strokeWidth={Math.max(0.02, width * 0.012)}
      />

      {wheelXs.map((x) => (
        <g key={x}>
          <rect
            x={x - wheelLength / 2}
            y={-wheelWidth * 0.18}
            width={wheelLength}
            height={wheelWidth}
            rx={wheelWidth * 0.25}
            fill="#202020"
          />
          <rect
            x={x - wheelLength / 2}
            y={width - wheelWidth * 0.82}
            width={wheelLength}
            height={wheelWidth}
            rx={wheelWidth * 0.25}
            fill="#202020"
          />
        </g>
      ))}

      <rect
        x={length * 0.89}
        y={width * 0.18}
        width={length * 0.022}
        height={width * 0.18}
        rx={width * 0.025}
        fill="#f1dfa3"
      />
      <rect
        x={length * 0.89}
        y={width * 0.64}
        width={length * 0.022}
        height={width * 0.18}
        rx={width * 0.025}
        fill="#f1dfa3"
      />

      <rect
        x={length * 0.08}
        y={width * 0.18}
        width={length * 0.02}
        height={width * 0.18}
        rx={width * 0.02}
        fill="#a73943"
      />
      <rect
        x={length * 0.08}
        y={width * 0.64}
        width={length * 0.02}
        height={width * 0.18}
        rx={width * 0.02}
        fill="#a73943"
      />
    </>
  );
}

function TwoWheelerArtwork({
  participant,
}: Participant2DArtworkProps) {
  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const length = dimensions.lengthMetres;
  const width = dimensions.widthMetres;

  const colour =
    getParticipantColourHex(participant.colour);

  const motorcycle =
    participant.type === "Motorcycle";

  const rearX = length * 0.18;
  const frontX = length * 0.82;
  const midY = width / 2;

  const wheelThickness =
    Math.max(0.04, width * 0.12);

  return (
    <>
      <rect
        x={rearX - length * 0.11}
        y={midY - wheelThickness / 2}
        width={length * 0.22}
        height={wheelThickness}
        rx={wheelThickness / 2}
        fill="#202020"
      />

      <rect
        x={frontX - length * 0.11}
        y={midY - wheelThickness / 2}
        width={length * 0.22}
        height={wheelThickness}
        rx={wheelThickness / 2}
        fill="#202020"
      />

      {motorcycle ? (
        <>
          <path
            d={[
              `M ${rearX} ${midY}`,
              `L ${length * 0.4} ${width * 0.25}`,
              `L ${length * 0.66} ${width * 0.29}`,
              `L ${frontX} ${midY}`,
              `L ${length * 0.55} ${width * 0.68}`,
              "Z",
            ].join(" ")}
            fill={colour}
            stroke="#c9c9c9"
            strokeWidth={Math.max(0.025, width * 0.035)}
          />

          <ellipse
            cx={length * 0.52}
            cy={midY}
            rx={length * 0.17}
            ry={width * 0.25}
            fill={colour}
          />

          <line
            x1={length * 0.67}
            y1={width * 0.28}
            x2={length * 0.76}
            y2={width * 0.12}
            stroke="#b8b8b8"
            strokeWidth={Math.max(0.035, width * 0.05)}
            strokeLinecap="round"
          />

          <line
            x1={length * 0.67}
            y1={width * 0.72}
            x2={length * 0.76}
            y2={width * 0.88}
            stroke="#b8b8b8"
            strokeWidth={Math.max(0.035, width * 0.05)}
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d={[
              `M ${rearX} ${midY}`,
              `L ${length * 0.42} ${width * 0.22}`,
              `L ${length * 0.55} ${midY}`,
              `L ${rearX} ${midY}`,
              `M ${length * 0.42} ${width * 0.22}`,
              `L ${length * 0.65} ${width * 0.22}`,
              `L ${length * 0.55} ${midY}`,
              `M ${length * 0.65} ${width * 0.22}`,
              `L ${frontX} ${midY}`,
            ].join(" ")}
            fill="none"
            stroke={colour}
            strokeWidth={Math.max(0.035, width * 0.055)}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </>
      )}

      <circle
        cx={length * 0.54}
        cy={midY}
        r={Math.max(0.035, width * 0.07)}
        fill="#8f8f8f"
      />
    </>
  );
}

function HumanArtwork({
  participant,
}: Participant2DArtworkProps) {
  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const length = dimensions.lengthMetres;
  const width = dimensions.widthMetres;

  const colour =
    getParticipantColourHex(participant.colour);

  const asset =
    getParticipantAssetDefinition(participant);

  const headRadius =
    Math.min(length, width) * 0.16;

  const headX = length * 0.72;
  const centreY = width / 2;

  const shoulderX =
    length * 0.48;

  const hipX =
    length * 0.3;

  return (
    <>
      <ellipse
        cx={headX}
        cy={centreY}
        rx={headRadius}
        ry={headRadius}
        fill="#b97850"
        stroke="#d0d0d0"
        strokeWidth={0.02}
      />

      <ellipse
        cx={shoulderX}
        cy={centreY}
        rx={length * 0.18}
        ry={width * 0.31}
        fill={colour}
        stroke="#d0d0d0"
        strokeWidth={0.02}
      />

      <line
        x1={shoulderX}
        y1={width * 0.13}
        x2={length * 0.36}
        y2={width * 0.03}
        stroke="#b97850"
        strokeWidth={0.055}
        strokeLinecap="round"
      />

      <line
        x1={shoulderX}
        y1={width * 0.87}
        x2={length * 0.36}
        y2={width * 0.97}
        stroke="#b97850"
        strokeWidth={0.055}
        strokeLinecap="round"
      />

      <line
        x1={hipX}
        y1={width * 0.43}
        x2={length * 0.08}
        y2={width * 0.3}
        stroke="#3b3b3b"
        strokeWidth={0.07}
        strokeLinecap="round"
      />

      <line
        x1={hipX}
        y1={width * 0.57}
        x2={length * 0.08}
        y2={width * 0.7}
        stroke="#3b3b3b"
        strokeWidth={0.07}
        strokeLinecap="round"
      />

      {participant.type === "Officer" && (
        <rect
          x={length * 0.4}
          y={width * 0.18}
          width={length * 0.15}
          height={width * 0.64}
          rx={0.025}
          fill="#c6c0a2"
          opacity={0.92}
        />
      )}

      {participant.type === "Witness" && (
        <rect
          x={length * 0.38}
          y={width * 0.84}
          width={length * 0.1}
          height={width * 0.11}
          rx={0.02}
          fill="#d0d0d0"
        />
      )}

      {asset.id === "human-child-generic" && (
        <circle
          cx={length * 0.2}
          cy={width * 0.5}
          r={0.025}
          fill="#e8872d"
        />
      )}
    </>
  );
}

export function Participant2DSvgArtwork({
  participant,
}: Participant2DArtworkProps) {
  const asset =
    getParticipantAssetDefinition(participant);

  if (asset.family === "Human") {
    return (
      <HumanArtwork participant={participant} />
    );
  }

  if (asset.family === "Two Wheeler") {
    return (
      <TwoWheelerArtwork
        participant={participant}
      />
    );
  }

  return (
    <VehicleArtwork participant={participant} />
  );
}

export default function Participant2DModel({
  participant,
  selected = false,
  showLabel = true,
  className = "",
}: Participant2DModelProps) {
  const asset =
    getParticipantAssetDefinition(participant);

  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const display =
    getParticipant2DDisplaySize(participant);

  const filter = selected
    ? "drop-shadow(0 0 4px rgba(232, 135, 45, 0.95))"
    : "drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5))";

  const style: CSSProperties = {
    width: display.widthPixels,
    height: display.heightPixels,
    filter,
  };

  return (
    <div
      className={`relative ${className}`}
      style={style}
      data-participant-asset={asset.id}
      title={`${participant.name} · ${asset.label}`}
    >
      <svg
        viewBox={`0 0 ${dimensions.lengthMetres} ${dimensions.widthMetres}`}
        preserveAspectRatio="none"
        className="block h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <Participant2DSvgArtwork
          participant={participant}
        />
      </svg>

      {participant.injured && (
        <span className="pointer-events-none absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full border border-[#a25d68] bg-[#612530] text-[8px] font-black text-white">
          !
        </span>
      )}

      {showLabel && (
        <span className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-sm border border-[#494949] bg-[#303030] px-1.5 py-0.5 text-[9px] font-semibold text-[#d0d0d0] shadow-lg">
          {participant.name}
        </span>
      )}
    </div>
  );
}

export function Participant2DSceneGlyph({
  participant,
  position,
  rotation,
  worldDimensions,
}: Participant2DSceneGlyphProps) {
  const dimensions =
    getParticipantPhysicalDimensions(participant);

  const asset =
    getParticipantAssetDefinition(participant);

  const widthPercent = Math.max(
    asset.family === "Human" ? 1.1 : 0.6,
    (dimensions.lengthMetres /
      Math.max(
        1,
        worldDimensions.widthMetres,
      )) *
      100,
  );

  const heightPercent = Math.max(
    asset.family === "Human" ? 1.1 : 0.6,
    (dimensions.widthMetres /
      Math.max(
        1,
        worldDimensions.heightMetres,
      )) *
      100,
  );

  return (
    <g
      transform={`translate(${position.x} ${position.y}) rotate(${rotation})`}
      data-participant-asset={asset.id}
    >
      <svg
        x={-widthPercent / 2}
        y={-heightPercent / 2}
        width={widthPercent}
        height={heightPercent}
        viewBox={`0 0 ${dimensions.lengthMetres} ${dimensions.widthMetres}`}
        preserveAspectRatio="none"
        overflow="visible"
      >
        <Participant2DSvgArtwork
          participant={participant}
        />
      </svg>
    </g>
  );
}
