import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import type {
  ReconstructionPosition,
  SceneMeasurement,
} from "../../types/reconstruction";

import { getMeasurementMidpoint } from "../../utils/evidenceGeometry";

interface MeasurementLayerProps {
  measurements: SceneMeasurement[];
  selectedMeasurementId: string | null;
  draftStart: ReconstructionPosition | null;
  onSelect: (measurementId: string) => void;
  onEndpointPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    measurementId: string,
    endpoint: "start" | "end",
  ) => void;
}

export default function MeasurementLayer({
  measurements,
  selectedMeasurementId,
  draftStart,
  onSelect,
  onEndpointPointerDown,
}: MeasurementLayerProps) {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 z-[34] h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {measurements
          .filter((measurement) => measurement.visible)
          .map((measurement) => (
            <line
              key={measurement.id}
              x1={measurement.start.x}
              y1={measurement.start.y}
              x2={measurement.end.x}
              y2={measurement.end.y}
              stroke={measurement.colour}
              strokeWidth={selectedMeasurementId === measurement.id ? 0.65 : 0.45}
              strokeDasharray="1.4 0.9"
              vectorEffect="non-scaling-stroke"
            />
          ))}

        {draftStart && (
          <circle
            cx={draftStart.x}
            cy={draftStart.y}
            r={1.1}
            fill="#0284c7"
            stroke="white"
            strokeWidth={0.35}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {measurements
        .filter((measurement) => measurement.visible)
        .map((measurement) => {
          const selected = selectedMeasurementId === measurement.id;
          const midpoint = getMeasurementMidpoint(measurement);

          return (
            <div key={`${measurement.id}-controls`}>
              <button
                type="button"
                data-scene-interactive="true"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(measurement.id);
                }}
                className={`absolute z-[37] -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[10px] font-black text-white shadow-lg ${
                  selected ? "ring-4 ring-cyan-300/40" : ""
                }`}
                style={{
                  left: `${midpoint.x}%`,
                  top: `${midpoint.y}%`,
                  backgroundColor: measurement.colour,
                }}
                title={measurement.label}
              >
                M-{String(measurement.measurementNumber).padStart(2, "0")} · {measurement.distanceMetres.toFixed(2)}m
              </button>

              {!measurement.locked && (
                <>
                  <button
                    type="button"
                    data-scene-interactive="true"
                    onPointerDown={(event) =>
                      onEndpointPointerDown(event, measurement.id, "start")
                    }
                    className="absolute z-[38] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-800 shadow"
                    style={{
                      left: `${measurement.start.x}%`,
                      top: `${measurement.start.y}%`,
                    }}
                    title="Drag measurement start"
                  />

                  <button
                    type="button"
                    data-scene-interactive="true"
                    onPointerDown={(event) =>
                      onEndpointPointerDown(event, measurement.id, "end")
                    }
                    className="absolute z-[38] h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-fuchsia-600 shadow"
                    style={{
                      left: `${measurement.end.x}%`,
                      top: `${measurement.end.y}%`,
                    }}
                    title="Drag measurement end"
                  />
                </>
              )}
            </div>
          );
        })}
    </>
  );
}
