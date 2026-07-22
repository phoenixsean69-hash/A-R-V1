import type {
  AccidentReconstruction,
  ReconstructionPosition,
} from "../../types/reconstruction";

import { derivePrimaryCollisionPoint } from "../../services/reconstructionPhysicsService";

interface CollisionSetupPanelProps {
  reconstruction: AccidentReconstruction;
  placementActive: boolean;
  onChange: (updates: Partial<AccidentReconstruction>) => void;
  onBeginPlacement: () => void;
  onCancelPlacement: () => void;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export default function CollisionSetupPanel({
  reconstruction,
  placementActive,
  onChange,
  onBeginPlacement,
  onCancelPlacement,
}: CollisionSetupPanelProps) {
  const setup = {
    source: "Manual" as const,
    confirmed: false,
    locked: false,
    toleranceMetres: 2,
    notes: "",
    ...(reconstruction.collisionSetup ?? {}),
  };

  const setCollisionPoint = (point: ReconstructionPosition, source: "Manual" | "Derived") => {
    onChange({
      collisionPoint: {
        x: clamp(point.x),
        y: clamp(point.y),
      },
      collisionSetup: {
        ...setup,
        source,
        lastCalculatedAt: new Date().toISOString(),
      },
    });
  };

  const derive = () => {
    const point = derivePrimaryCollisionPoint(reconstruction);
    if (!point) return;
    setCollisionPoint(point, "Derived");
  };

  const snapImpactPoints = () => {
    const vehicles = reconstruction.vehicles.map((participant) => ({
      ...participant,
      collisionPosition: { ...reconstruction.collisionPoint },
      pathPoints: participant.pathPoints.map((point) =>
        point.action === "Impact"
          ? { ...point, position: { ...reconstruction.collisionPoint } }
          : point,
      ),
    }));
    onChange({ vehicles });
  };

  const impactCount = reconstruction.vehicles.reduce(
    (count, participant) =>
      count + participant.pathPoints.filter((point) => point.action === "Impact").length,
    0,
  );

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
      <div className="border-b border-red-100 bg-gradient-to-r from-red-50 to-orange-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
              Primary impact setup
            </p>
            <h2 className="mt-1 text-xl font-black text-gray-950">
              Collision Point
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              The investigating officer approves this point. RoadSafe can derive a suggestion from participant Impact points, but the officer must confirm or manually place the primary collision marker.
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1.5 text-xs font-black ${
              setup.confirmed
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {setup.confirmed ? "Officer confirmed" : "Confirmation required"}
          </span>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="block">
              <span className="text-xs font-bold text-gray-600">Scene X (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                disabled={setup.locked}
                value={reconstruction.collisionPoint.x}
                onChange={(event) =>
                  setCollisionPoint(
                    { ...reconstruction.collisionPoint, x: Number(event.target.value) },
                    "Manual",
                  )
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-gray-600">Scene Y (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                disabled={setup.locked}
                value={reconstruction.collisionPoint.y}
                onChange={(event) =>
                  setCollisionPoint(
                    { ...reconstruction.collisionPoint, y: Number(event.target.value) },
                    "Manual",
                  )
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-gray-600">Tolerance (m)</span>
              <input
                type="number"
                min={0.2}
                max={10}
                step={0.1}
                value={setup.toleranceMetres}
                onChange={(event) =>
                  onChange({
                    collisionSetup: {
                      ...setup,
                      toleranceMetres: Math.max(0.2, Number(event.target.value)),
                    },
                  })
                }
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <div>
              <span className="text-xs font-bold text-gray-600">Impact points</span>
              <div className="mt-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-black text-gray-900">
                {impactCount}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={placementActive ? onCancelPlacement : onBeginPlacement}
              disabled={setup.locked}
              className={`rounded-xl px-4 py-2.5 text-sm font-black text-white transition disabled:bg-gray-400 ${
                placementActive ? "bg-red-700" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {placementActive ? "Cancel Scene Placement" : "Place Collision Point on Scene"}
            </button>

            <button
              type="button"
              onClick={derive}
              disabled={impactCount === 0 || setup.locked}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-black text-indigo-800 hover:bg-indigo-100 disabled:bg-gray-100 disabled:text-gray-400"
            >
              Derive from Impact Points
            </button>

            <button
              type="button"
              onClick={snapImpactPoints}
              disabled={reconstruction.vehicles.length === 0 || setup.locked}
              className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-black text-orange-800 hover:bg-orange-100 disabled:bg-gray-100 disabled:text-gray-400"
            >
              Snap All Impact Points Here
            </button>
          </div>

          <label className="block">
            <span className="text-xs font-bold text-gray-600">Officer notes</span>
            <textarea
              rows={3}
              value={setup.notes}
              onChange={(event) =>
                onChange({ collisionSetup: { ...setup, notes: event.target.value } })
              }
              placeholder="How the collision point was established: debris centre, vehicle damage, witness statement, CCTV, GPS, measurements…"
              className="mt-1 w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        <div className="space-y-3 rounded-xl bg-gray-50 p-4">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <div>
              <p className="text-sm font-black text-gray-900">Officer confirmed</p>
              <p className="mt-1 text-xs text-gray-500">Required before premium physics produces a trusted preview.</p>
            </div>
            <input
              type="checkbox"
              checked={setup.confirmed}
              onChange={(event) =>
                onChange({
                  collisionSetup: {
                    ...setup,
                    confirmed: event.target.checked,
                    lastCalculatedAt: new Date().toISOString(),
                  },
                })
              }
              className="h-5 w-5"
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
            <div>
              <p className="text-sm font-black text-gray-900">Lock collision marker</p>
              <p className="mt-1 text-xs text-gray-500">Prevents accidental dragging or scene clicks from moving it.</p>
            </div>
            <input
              type="checkbox"
              checked={setup.locked}
              onChange={(event) =>
                onChange({ collisionSetup: { ...setup, locked: event.target.checked } })
              }
              className="h-5 w-5"
            />
          </label>

          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs leading-5 text-red-900">
            <strong>Source:</strong> {setup.source}<br />
            <strong>Position:</strong> X {reconstruction.collisionPoint.x.toFixed(1)}% · Y {reconstruction.collisionPoint.y.toFixed(1)}%<br />
            <strong>Physical location:</strong> approximately {((reconstruction.collisionPoint.x / 100) * reconstruction.scene.sceneWidthMetres).toFixed(1)}m × {((reconstruction.collisionPoint.y / 100) * reconstruction.scene.sceneHeightMetres).toFixed(1)}m in the calibrated scene.
          </div>
        </div>
      </div>
    </section>
  );
}
