import {
  sceneObjectCatalog,
  sceneObjectCategories,
} from "../../data/sceneObjectCatalog";

import type {
  ReconstructionSceneObject,
  SceneObjectType,
} from "../../types/reconstruction";
import { isTraceableSceneObjectType } from "../../utils/reconstructionGeometry";

interface SceneObjectPaletteProps {
  activeType: SceneObjectType | null;
  objects: ReconstructionSceneObject[];
  selectedObjectId: string | null;
  onToolSelect: (type: SceneObjectType) => void;
  onPlaceActiveWithGps: () => void;
  onCancelPlacement: () => void;
  onSelectObject: (objectId: string) => void;
  onClearObjects: () => void;
}

const BOUNDARY_TYPES = new Set<SceneObjectType>([
  "Pothole",
  "Puddle",
  "Oil Spill",
  "Loose Gravel",
  "Debris",
  "Broken Glass",
  "Bush",
]);

function gpsActionLabel(type: SceneObjectType): string {
  if (isTraceableSceneObjectType(type)) {
    return "Walk and Track with Live GPS";
  }

  if (BOUNDARY_TYPES.has(type)) {
    return "Walk Boundary with Live GPS";
  }

  return "Place at Live GPS Position";
}

export default function SceneObjectPalette({
  activeType,
  objects,
  selectedObjectId,
  onToolSelect,
  onPlaceActiveWithGps,
  onCancelPlacement,
  onSelectObject,
  onClearObjects,
}: SceneObjectPaletteProps) {
  return (
    <div className="mt-6 border-t border-[#1b3153] pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-100">
            Objects, Hazards & Evidence
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Add potholes, natural objects, road infrastructure, physical
            evidence and investigation markers. Place a point manually or
            capture its real location with GPS.
          </p>
        </div>

        {activeType && (
          <button
            type="button"
            onClick={onCancelPlacement}
            className="rounded-lg border border-[#2a3d5f] bg-[#0a1428] px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-[#11203a]"
          >
            Done
          </button>
        )}
      </div>

      {activeType && (
        <div className="mt-3 rounded-sm border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          <p>
            Placement tool active: <strong>{activeType}</strong>. Click the
            scene for manual placement or use the appropriate live-GPS capture
            below.
          </p>

          <button
            type="button"
            onClick={onPlaceActiveWithGps}
            className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
          >
            {gpsActionLabel(activeType)}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {sceneObjectCategories.map((category) => {
          const items = sceneObjectCatalog.filter(
            (item) => item.category === category,
          );
          const initiallyOpen =
            category === "Road Hazards" ||
            category === "Physical Evidence" ||
            category === "Environment";

          return (
            <details key={category} open={initiallyOpen}>
              <summary className="cursor-pointer select-none text-sm font-semibold text-slate-200">
                {category}
              </summary>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => onToolSelect(item.type)}
                    title={item.description}
                    className={`rounded-sm border p-2 text-left transition ${
                      activeType === item.type
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                        : "border-[#1b3153] bg-[#081225] hover:border-blue-500 hover:bg-[#0d1c35]"
                    }`}
                  >
                    <span className="block text-base font-black text-slate-100">
                      {item.icon}
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold leading-4 text-slate-200">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <div className="mt-5 border-t border-[#1b3153] pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-100">
            Placed Objects ({objects.length})
          </p>

          {objects.length > 0 && (
            <button
              type="button"
              onClick={onClearObjects}
              className="text-xs font-semibold text-red-600 hover:text-red-700"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
          {objects.map((object) => {
            const item = sceneObjectCatalog.find(
              (entry) => entry.type === object.type,
            );

            return (
              <button
                key={object.id}
                type="button"
                onClick={() => onSelectObject(object.id)}
                className={`flex w-full items-center gap-3 rounded-sm border p-2.5 text-left ${
                  selectedObjectId === object.id
                    ? "border-purple-500 bg-purple-50"
                    : "border-[#1b3153] bg-[#081225] hover:bg-[#0d1c35]"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#12213b] text-sm font-black text-slate-200">
                  {item?.icon ?? "•"}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-slate-100">
                    {object.label}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {object.type} • {object.severity}
                  </span>
                </span>

                {object.locked && (
                  <span className="text-xs" title="Locked">
                    🔒
                  </span>
                )}
              </button>
            );
          })}

          {objects.length === 0 && (
            <p className="rounded-sm border border-dashed border-[#2a3d5f] p-4 text-center text-xs text-slate-400">
              No hazards, evidence, natural objects or infrastructure have
              been placed yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
