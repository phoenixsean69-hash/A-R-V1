import {
  sceneObjectCatalog,
  sceneObjectCategories,
} from "../../data/sceneObjectCatalog";

import type {
  ReconstructionSceneObject,
  SceneObjectType,
} from "../../types/reconstruction";

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
    <div className="mt-6 border-t border-gray-200 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">Scene Objects</h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Pick an object, then place it manually on the road scene or use
            your device's real GPS location.
          </p>
        </div>

        {activeType && (
          <button
            type="button"
            onClick={onCancelPlacement}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Done
          </button>
        )}
      </div>

      {activeType && (
        <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          <p>
            Placement tool active: <strong>{activeType}</strong>. Click the scene
            for manual placement, or walk to its real position and use GPS.
          </p>

          <button
            type="button"
            onClick={onPlaceActiveWithGps}
            className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
          >
            Use Real Location (GPS)
          </button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {sceneObjectCategories.map((category) => {
          const items = sceneObjectCatalog.filter(
            (item) => item.category === category,
          );

          return (
            <details key={category} open={category === "Road Hazards"}>
              <summary className="cursor-pointer select-none text-sm font-semibold text-gray-800">
                {category}
              </summary>

              <div className="mt-2 grid grid-cols-2 gap-2">
                {items.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => onToolSelect(item.type)}
                    title={item.description}
                    className={`rounded-xl border p-2 text-left transition ${
                      activeType === item.type
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                        : "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"
                    }`}
                  >
                    <span className="block text-base font-black text-gray-800">
                      {item.icon}
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold leading-4 text-gray-700">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <div className="mt-5 border-t border-gray-200 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-gray-900">
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
                className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left ${
                  selectedObjectId === object.id
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-black text-gray-700">
                  {item?.icon ?? "•"}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-gray-900">
                    {object.label}
                  </span>
                  <span className="text-[10px] text-gray-500">
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
            <p className="rounded-xl border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">
              No hazards, evidence or infrastructure have been placed yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
