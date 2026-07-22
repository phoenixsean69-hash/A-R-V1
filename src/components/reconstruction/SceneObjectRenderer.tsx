import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import {
  getSceneObjectCatalogItem,
} from "../../data/sceneObjectCatalog";

import type {
  ReconstructionSceneObject,
} from "../../types/reconstruction";

import {
  buildSmoothSvgPath,
  createOffsetTracePoints,
  isTraceableSceneObjectType,
} from "../../utils/reconstructionGeometry";

interface SceneObjectRendererProps {
  object: ReconstructionSceneObject;
  selected: boolean;
  onSelect: () => void;
  onPointerDown: (
    event: ReactPointerEvent<SVGPathElement | HTMLButtonElement>,
  ) => void;
}

function ObjectShape({ object }: { object: ReconstructionSceneObject }) {
  const item = getSceneObjectCatalogItem(object.type);

  switch (object.type) {
    case "Pothole":
      return (
        <div className="h-9 w-14 rounded-[48%_52%_45%_55%] border-4 border-stone-500 bg-stone-950 shadow-[inset_0_0_10px_rgba(255,255,255,.2)]" />
      );

    case "Road Crack":
      return (
        <svg viewBox="0 0 70 30" className="h-8 w-16 overflow-visible">
          <polyline
            points="2,14 15,10 23,20 35,8 44,17 55,6 68,14"
            fill="none"
            stroke="#111827"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      );

    case "Puddle":
      return (
        <div className="h-8 w-16 rounded-[50%] border border-blue-100/70 bg-blue-400/55 shadow-inner" />
      );

    case "Oil Spill":
      return (
        <div className="h-9 w-16 rounded-[55%_45%_60%_40%] border border-purple-300 bg-gradient-to-r from-slate-950 via-purple-950 to-slate-900 opacity-90" />
      );

    case "Skid Mark":
      return (
        <div className="flex w-24 flex-col gap-2">
          <span className="h-1.5 rounded-full bg-black/80" />
          <span className="h-1.5 rounded-full bg-black/80" />
        </div>
      );

    case "Tyre Mark":
      return <div className="h-1.5 w-24 rounded-full bg-black/70" />;

    case "Traffic Cone":
      return (
        <div className="relative h-10 w-8">
          <span className="absolute bottom-0 left-0 h-2 w-8 rounded bg-orange-700" />
          <span className="absolute bottom-1 left-2 h-8 w-0 border-x-[8px] border-b-[28px] border-x-transparent border-b-orange-500" />
          <span className="absolute bottom-4 left-2.5 h-1.5 w-3 bg-white" />
        </div>
      );

    case "Road Barrier":
      return (
        <div className="h-7 w-24 rounded border-2 border-white bg-[repeating-linear-gradient(135deg,#dc2626_0_12px,#fff_12px_24px)] shadow" />
      );

    case "Stop Sign":
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-[28%] border-4 border-white bg-red-600 text-[9px] font-black text-white shadow">
          STOP
        </div>
      );

    case "Give Way Sign":
      return (
        <div className="flex h-0 w-0 items-center justify-center border-x-[26px] border-t-[44px] border-x-transparent border-t-red-600">
          <span className="absolute -translate-y-8 text-[8px] font-black text-white">
            YIELD
          </span>
        </div>
      );

    case "Speed Limit Sign":
      return (
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-red-600 bg-white text-sm font-black text-gray-900 shadow">
          {object.speedLimitKmh ?? 60}
        </div>
      );

    case "Traffic Light":
      return (
        <div className="flex h-16 w-7 flex-col items-center justify-around rounded-md bg-gray-950 p-1 shadow">
          <span className="h-4 w-4 rounded-full bg-red-500" />
          <span className="h-4 w-4 rounded-full bg-amber-400" />
          <span className="h-4 w-4 rounded-full bg-green-500" />
        </div>
      );

    case "Street Light":
      return (
        <div className="relative h-20 w-8">
          <span className="absolute bottom-0 left-3 h-16 w-1.5 bg-gray-700" />
          <span className="absolute left-3 top-1 h-1.5 w-5 bg-gray-700" />
          <span className="absolute right-0 top-0 h-4 w-4 rounded-full bg-yellow-200 shadow-[0_0_12px_rgba(253,224,71,.9)]" />
        </div>
      );

    case "Drain":
      return (
        <div className="h-8 w-14 rounded border-2 border-gray-800 bg-[repeating-linear-gradient(90deg,#374151_0_3px,#9ca3af_3px_7px)]" />
      );

    case "Guardrail":
      return (
        <div className="relative h-8 w-28">
          <span className="absolute left-0 top-2 h-2 w-full rounded bg-gray-300 shadow" />
          <span className="absolute bottom-0 left-4 h-7 w-2 bg-gray-500" />
          <span className="absolute bottom-0 right-4 h-7 w-2 bg-gray-500" />
        </div>
      );

    case "Parked Vehicle":
      return (
        <div className="flex h-7 w-14 items-center justify-center rounded-md border-2 border-white bg-gray-500 text-[8px] font-bold text-white shadow">
          PARKED
        </div>
      );

    case "Tree":
      return (
        <div className="relative h-16 w-14">
          <span className="absolute bottom-0 left-6 h-8 w-3 bg-amber-800" />
          <span className="absolute left-1 top-0 h-11 w-12 rounded-full bg-green-700 shadow" />
        </div>
      );

    case "Bush":
      return (
        <div className="h-10 w-16 rounded-[50%] border-2 border-green-800 bg-green-600 shadow" />
      );

    case "Wall":
      return (
        <div className="h-8 w-24 border-2 border-stone-700 bg-[repeating-linear-gradient(0deg,#a8a29e_0_8px,#78716c_8px_10px)]" />
      );

    case "Fence":
      return (
        <div className="h-10 w-24 border-y-2 border-gray-800 bg-[repeating-linear-gradient(90deg,transparent_0_8px,#374151_8px_10px)]" />
      );

    case "CCTV Camera":
      return (
        <div className="rounded-md border-2 border-white bg-gray-900 px-2 py-1 text-[9px] font-black text-white shadow">
          CCTV ▶
        </div>
      );

    case "Evidence Marker":
      return (
        <div className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-black bg-yellow-300 text-sm font-black text-black shadow">
          {object.evidenceNumber ?? 1}
        </div>
      );

    case "Measurement Point":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-300 text-2xl font-black text-cyan-200">
          ⊕
        </div>
      );

    case "Injury Location":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-red-600 text-2xl font-black text-white shadow">
          +
        </div>
      );

    case "Witness Viewpoint":
      return (
        <div className="rounded-full border-2 border-white bg-indigo-600 px-3 py-2 text-xs font-black text-white shadow">
          VIEW →
        </div>
      );

    default:
      return (
        <div className="flex min-h-9 min-w-10 items-center justify-center rounded-lg border-2 border-white bg-gray-700 px-2 py-1 text-xs font-black text-white shadow">
          {item.icon}
        </div>
      );
  }
}

function getTraceStroke(object: ReconstructionSceneObject): string {
  if (object.type === "Road Crack") {
    return "#111827";
  }

  return "rgba(5, 5, 5, 0.82)";
}

export default function SceneObjectRenderer({
  object,
  selected,
  onSelect,
  onPointerDown,
}: SceneObjectRendererProps) {
  if (!object.visible) {
    return null;
  }

  const tracePoints = object.tracePoints ?? [];

  if (isTraceableSceneObjectType(object.type) && tracePoints.length >= 2) {
    const primaryPath = buildSmoothSvgPath(
      tracePoints,
      object.traceSmoothing ?? 0.85,
    );
    const width = Math.max(0.2, object.traceWidth ?? 0.75) * object.scale;
    const doubleTrace = object.traceStyle === "Double";
    const offset = Math.max(0.45, width * 1.8);
    const secondPath = doubleTrace
      ? buildSmoothSvgPath(
          createOffsetTracePoints(tracePoints, offset),
          object.traceSmoothing ?? 0.85,
        )
      : "";

    return (
      <svg
        className="pointer-events-none absolute inset-0 z-[18] h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-label={object.label}
      >
        <path
          data-scene-interactive="true"
          d={primaryPath}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(3.5, width * 5)}
          pointerEvents="stroke"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          onPointerDown={onPointerDown}
          className={object.locked ? "cursor-not-allowed" : "cursor-move"}
        />

        <path
          d={primaryPath}
          fill="none"
          stroke={selected ? "#c084fc" : getTraceStroke(object)}
          strokeWidth={selected ? width + 0.35 : width}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          opacity={object.type === "Road Crack" ? 0.95 : 0.82}
        />

        {doubleTrace && (
          <path
            d={secondPath}
            fill="none"
            stroke={selected ? "#c084fc" : getTraceStroke(object)}
            strokeWidth={selected ? width + 0.35 : width}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            opacity="0.82"
          />
        )}
      </svg>
    );
  }

  return (
    <button
      type="button"
      data-scene-interactive="true"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerDown={onPointerDown}
      className={`absolute z-[18] -translate-x-1/2 -translate-y-1/2 touch-none ${
        selected ? "drop-shadow-[0_0_8px_rgba(192,132,252,1)]" : ""
      } ${object.locked ? "cursor-not-allowed" : "cursor-move"}`}
      style={{
        left: `${object.position.x}%`,
        top: `${object.position.y}%`,
        transform: `translate(-50%, -50%) rotate(${object.rotation}deg) scale(${object.scale})`,
      }}
      title={`${object.label}${object.locked ? " (locked)" : ""}`}
    >
      <ObjectShape object={object} />

      {selected && (
        <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-[10px] font-black text-white shadow">
          ✓
        </span>
      )}
    </button>
  );
}