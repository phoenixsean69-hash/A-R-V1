import type {
  ReconstructionSceneObject,
  SceneObjectSeverity,
  SceneTraceStyle,
} from "../../types/reconstruction";

import {
  isTraceableSceneObjectType,
} from "../../utils/reconstructionGeometry";
import { getDefaultSceneObjectPhysics } from "../../services/reconstructionPhysicsService";
import { getSceneObjectEffectiveMassKg } from "../../utils/reconstructionPhysicsDefaults";

import BufferedCommitInput from "./BufferedCommitInput";

interface SceneObjectSettingsPanelProps {
  object: ReconstructionSceneObject;
  tracing: boolean;
  onChange: (
    updates: Partial<ReconstructionSceneObject>,
  ) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPlaceWithGps: () => void;
  onBeginTrace: () => void;
  onCancelTrace: () => void;
  onClearTrace: () => void;
}

const SEVERITY_OPTIONS: SceneObjectSeverity[] = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const GPS_BOUNDARY_TYPES = new Set<ReconstructionSceneObject["type"]>([
  "Pothole",
  "Puddle",
  "Oil Spill",
  "Loose Gravel",
  "Debris",
  "Broken Glass",
  "Bush",
]);

export default function SceneObjectSettingsPanel({
  object,
  tracing,
  onChange,
  onDelete,
  onDuplicate,
  onPlaceWithGps,
  onBeginTrace,
  onCancelTrace,
  onClearTrace,
}: SceneObjectSettingsPanelProps) {
  const traceable = isTraceableSceneObjectType(object.type);
  const boundaryTrack = GPS_BOUNDARY_TYPES.has(object.type);
  const resolvedPhysics = {
    ...getDefaultSceneObjectPhysics(object),
    massKg:
      getSceneObjectEffectiveMassKg(
        object,
      ),
    ...(object.physics ?? {}),
  };
  const gpsButtonLabel = traceable
    ? "Walk and Track with Live GPS"
    : boundaryTrack
      ? "Walk Boundary with Live GPS"
      : "Place Using Device GPS";
  const interactionDescription = object.type === "Pothole"
    ? "Vehicles crossing the measured pothole lose speed and may deflect."
    : ["Oil Spill", "Loose Gravel", "Puddle"].includes(object.type)
      ? "The region reduces grip while a participant is physically inside it."
      : resolvedPhysics.collidable
        ? "This object uses a physical collision shape and can be struck by participants."
        : "This item is evidence or context only and does not alter movement.";

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#c4c4c4]">
            Scene object
          </p>
          <h2 className="mt-1 text-lg font-bold text-gray-900">
            {object.type}
          </h2>
        </div>

        <span className="rounded-full bg-[#303030] px-2.5 py-1 text-[11px] font-bold text-[#c4c4c4]">
          {object.category}
        </span>
      </div>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Label</span>
          <input
            value={object.label}
            onChange={(event) => onChange({ label: event.target.value })}
            className="mt-1.5 w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#494949]"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Severity</span>
          <select
            value={object.severity}
            onChange={(event) =>
              onChange({
                severity: event.target.value as SceneObjectSeverity,
              })
            }
            className="mt-1.5 w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#494949]"
          >
            {SEVERITY_OPTIONS.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-xs font-medium text-gray-600">Rotation°</span>
            <BufferedCommitInput
              type="number"
              value={object.rotation}
              onChange={(event) =>
                onChange({ rotation: Number(event.target.value) })
              }
              disabled={traceable && (object.tracePoints?.length ?? 0) >= 2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
            />
          </label>

          <label>
            <span className="text-xs font-medium text-gray-600">Scale</span>
            <BufferedCommitInput
              type="number"
              min={0.2}
              max={5}
              step={0.1}
              value={object.scale}
              onChange={(event) =>
                onChange({
                  scale: Math.max(0.2, Number(event.target.value)),
                })
              }
              className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
            />
          </label>
        </div>

        {object.type === "Pothole" && (
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs font-medium text-gray-600">
                Width (m)
              </span>
              <BufferedCommitInput
                type="number"
                min={0.1}
                step={0.1}
                value={object.widthMetres ?? 1}
                onChange={(event) =>
                  onChange({ widthMetres: Number(event.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-medium text-gray-600">
                Depth (cm)
              </span>
              <BufferedCommitInput
                type="number"
                min={0}
                step={1}
                value={object.depthCentimetres ?? 0}
                onChange={(event) =>
                  onChange({ depthCentimetres: Number(event.target.value) })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              />
            </label>
          </div>
        )}

        {object.type === "Speed Limit Sign" && (
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Speed limit
            </span>
            <BufferedCommitInput
              type="number"
              min={10}
              max={180}
              step={10}
              value={object.speedLimitKmh ?? 60}
              onChange={(event) =>
                onChange({ speedLimitKmh: Number(event.target.value) })
              }
              className="mt-1.5 w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm"
            />
          </label>
        )}

        {object.type === "Evidence Marker" && (
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Evidence number
            </span>
            <BufferedCommitInput
              type="number"
              min={1}
              value={object.evidenceNumber ?? 1}
              onChange={(event) =>
                onChange({ evidenceNumber: Number(event.target.value) })
              }
              className="mt-1.5 w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm"
            />
          </label>
        )}

        {traceable && (
          <div className="rounded-sm border border-[#494949] bg-[#303030] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-[#c4c4c4]">Curved trace</p>
                <p className="mt-1 text-xs leading-5 text-[#c4c4c4]">
                  Draw a freehand curved route directly on the road. The saved
                  points can be moved afterwards.
                </p>
              </div>

              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-[#c4c4c4]">
                {object.tracePoints?.length ?? 0} pts
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={tracing ? onCancelTrace : onBeginTrace}
                className={`rounded-lg px-3 py-2 text-xs font-bold text-white ${
                  tracing
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-[#303030] hover:bg-[#303030]"
                }`}
              >
                {tracing ? "Cancel tracing" : "Draw / Redraw"}
              </button>

              <button
                type="button"
                onClick={onClearTrace}
                disabled={(object.tracePoints?.length ?? 0) === 0}
                className="rounded-lg border border-[#494949] bg-white px-3 py-2 text-xs font-bold text-[#c4c4c4] hover:bg-[#303030] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear trace
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label>
                <span className="text-xs font-medium text-[#c4c4c4]">
                  Trace style
                </span>
                <select
                  value={object.traceStyle ?? "Single"}
                  onChange={(event) =>
                    onChange({
                      traceStyle: event.target.value as SceneTraceStyle,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-[#494949] bg-white px-2 py-2 text-sm"
                >
                  <option value="Single">Single</option>
                  <option value="Double">Double</option>
                </select>
              </label>

              <label>
                <span className="text-xs font-medium text-[#c4c4c4]">
                  Width
                </span>
                <BufferedCommitInput
                  type="number"
                  min={0.15}
                  max={4}
                  step={0.1}
                  value={object.traceWidth ?? 0.75}
                  onChange={(event) =>
                    onChange({ traceWidth: Number(event.target.value) })
                  }
                  className="mt-1 w-full rounded-lg border border-[#494949] bg-white px-2 py-2 text-sm"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="text-xs font-medium text-[#c4c4c4]">
                Curve smoothing: {Math.round((object.traceSmoothing ?? 0.85) * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={object.traceSmoothing ?? 0.85}
                onChange={(event) =>
                  onChange({ traceSmoothing: Number(event.target.value) })
                }
                className="mt-1 w-full"
              />
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center justify-between rounded-sm border border-gray-200 p-3">
            <span className="text-sm font-medium text-gray-700">Visible</span>
            <input
              type="checkbox"
              checked={object.visible}
              onChange={(event) => onChange({ visible: event.target.checked })}
              className="h-5 w-5"
            />
          </label>

          <label className="flex items-center justify-between rounded-sm border border-gray-200 p-3">
            <span className="text-sm font-medium text-gray-700">Locked</span>
            <input
              type="checkbox"
              checked={object.locked}
              onChange={(event) => onChange({ locked: event.target.checked })}
              className="h-5 w-5"
            />
          </label>
        </div>

        <div className="rounded-sm border border-[#494949] bg-[#303030] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#c4c4c4]">
                Participant interaction
              </p>
              <p className="mt-1 text-xs leading-5 text-[#c4c4c4]">
                {interactionDescription}
              </p>
            </div>
            <input
              type="checkbox"
              checked={resolvedPhysics.enabled}
              onChange={(event) =>
                onChange({
                  physics: {
                    ...resolvedPhysics,
                    enabled: event.target.checked,
                  },
                })
              }
              className="mt-1 h-5 w-5"
              aria-label="Enable participant interaction"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#c4c4c4]">
            <span>
              Mode: <strong>{resolvedPhysics.collidable ? "Solid contact" : resolvedPhysics.enabled ? "Surface / hazard" : "Reference only"}</strong>
            </span>
            <span>
              Radius: <strong>{resolvedPhysics.collisionRadiusMetres.toFixed(2)} m</strong>
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label>
              <span className="text-[10px] font-bold text-[#c4c4c4]">
                Effective mass (kg)
              </span>
              <BufferedCommitInput
                type="number"
                min={0.1}
                max={100000000}
                step={1}
                value={resolvedPhysics.massKg}
                onChange={(event) =>
                  onChange({
                    physics: {
                      ...resolvedPhysics,
                      massKg: Math.max(
                        0.1,
                        Number(event.target.value),
                      ),
                    },
                  })
                }
                className="mt-1 w-full rounded-sm border border-[#494949] bg-[#252525] px-2 py-1.5 text-xs text-[#d4d4d4]"
              />
            </label>

            <label>
              <span className="text-[10px] font-bold text-[#c4c4c4]">
                Restitution
              </span>
              <BufferedCommitInput
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={resolvedPhysics.restitution}
                onChange={(event) =>
                  onChange({
                    physics: {
                      ...resolvedPhysics,
                      restitution: Math.min(
                        1,
                        Math.max(
                          0,
                          Number(event.target.value),
                        ),
                      ),
                    },
                  })
                }
                className="mt-1 w-full rounded-sm border border-[#494949] bg-[#252525] px-2 py-1.5 text-xs text-[#d4d4d4]"
              />
            </label>

            <label>
              <span className="text-[10px] font-bold text-[#c4c4c4]">
                Collision friction
              </span>
              <BufferedCommitInput
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={resolvedPhysics.collisionFriction ?? 0.65}
                onChange={(event) =>
                  onChange({
                    physics: {
                      ...resolvedPhysics,
                      collisionFriction: Math.min(
                        2,
                        Math.max(
                          0,
                          Number(event.target.value),
                        ),
                      ),
                    },
                  })
                }
                className="mt-1 w-full rounded-sm border border-[#494949] bg-[#252525] px-2 py-1.5 text-xs text-[#d4d4d4]"
              />
            </label>

            <label>
              <span className="text-[10px] font-bold text-[#c4c4c4]">
                Surface friction
              </span>
              <BufferedCommitInput
                type="number"
                min={0.05}
                max={3}
                step={0.05}
                value={resolvedPhysics.surfaceFrictionMultiplier}
                onChange={(event) =>
                  onChange({
                    physics: {
                      ...resolvedPhysics,
                      surfaceFrictionMultiplier: Math.min(
                        3,
                        Math.max(
                          0.05,
                          Number(event.target.value),
                        ),
                      ),
                    },
                  })
                }
                className="mt-1 w-full rounded-sm border border-[#494949] bg-[#252525] px-2 py-1.5 text-xs text-[#d4d4d4]"
              />
            </label>

            <label>
              <span className="text-[10px] font-bold text-[#c4c4c4]">
                Speed retained
              </span>
              <BufferedCommitInput
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={resolvedPhysics.speedLossFactor}
                onChange={(event) =>
                  onChange({
                    physics: {
                      ...resolvedPhysics,
                      speedLossFactor: Math.min(
                        1,
                        Math.max(
                          0,
                          Number(event.target.value),
                        ),
                      ),
                    },
                  })
                }
                className="mt-1 w-full rounded-sm border border-[#494949] bg-[#252525] px-2 py-1.5 text-xs text-[#d4d4d4]"
              />
            </label>

            <label>
              <span className="text-[10px] font-bold text-[#c4c4c4]">
                Deflection (°)
              </span>
              <BufferedCommitInput
                type="number"
                min={-45}
                max={45}
                step={0.5}
                value={resolvedPhysics.deflectionDegrees}
                onChange={(event) =>
                  onChange({
                    physics: {
                      ...resolvedPhysics,
                      deflectionDegrees: Math.min(
                        45,
                        Math.max(
                          -45,
                          Number(event.target.value),
                        ),
                      ),
                    },
                  })
                }
                className="mt-1 w-full rounded-sm border border-[#494949] bg-[#252525] px-2 py-1.5 text-xs text-[#d4d4d4]"
              />
            </label>

            <label className="col-span-2 flex items-center justify-between rounded-sm border border-[#494949] bg-[#252525] px-2 py-1.5">
              <span className="text-[10px] font-bold text-[#c4c4c4]">
                Solid collision
              </span>
              <input
                type="checkbox"
                checked={resolvedPhysics.collidable}
                onChange={(event) =>
                  onChange({
                    physics: {
                      ...resolvedPhysics,
                      collidable: event.target.checked,
                    },
                  })
                }
                className="h-4 w-4"
              />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Notes</span>
          <textarea
            value={object.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            rows={4}
            placeholder="Measurements, condition, source of evidence, or officer observations..."
            className="mt-1.5 w-full resize-none rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-[#494949]"
          />
        </label>

        <div className="rounded-sm border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Position
          </p>

          <div className="mt-2 grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs font-medium text-gray-600">
                X position
              </span>
              <BufferedCommitInput
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={Number(object.position.x.toFixed(1))}
                onChange={(event) =>
                  onChange({
                    position: {
                      ...object.position,
                      x: Math.min(100, Math.max(0, Number(event.target.value))),
                    },
                  })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              />
            </label>

            <label>
              <span className="text-xs font-medium text-gray-600">
                Y position
              </span>
              <BufferedCommitInput
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={Number(object.position.y.toFixed(1))}
                onChange={(event) =>
                  onChange({
                    position: {
                      ...object.position,
                      y: Math.min(100, Math.max(0, Number(event.target.value))),
                    },
                  })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Drag the item or trace on the scene. Position fields update
            automatically.
          </p>
        </div>

        <div className="rounded-sm border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-black text-emerald-950">
            Place from real location
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            Take this device to the object's physical position, stabilise the
            GPS reading, then confirm it in the reconstruction.
          </p>
          <button
            type="button"
            onClick={onPlaceWithGps}
            className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
          >
            {gpsButtonLabel}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onDuplicate}
            className="rounded-sm border border-[#494949] bg-[#303030] px-4 py-3 text-sm font-semibold text-[#c4c4c4] hover:bg-[#303030]"
          >
            Duplicate
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="rounded-sm border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
