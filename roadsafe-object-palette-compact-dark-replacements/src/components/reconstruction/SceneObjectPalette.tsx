import {
  Check,
  Crosshair,
  LocateFixed,
  Lock,
  Trash2,
  X,
} from "../icons/materialIcons";

import {
  sceneObjectCatalog,
  sceneObjectCategories,
} from "../../data/sceneObjectCatalog";

import type {
  ReconstructionSceneObject,
  SceneObjectType,
} from "../../types/reconstruction";

import {
  isTraceableSceneObjectType,
} from "../../utils/reconstructionGeometry";

import "./SceneObjectPalette.css";

interface SceneObjectPaletteProps {
  activeType: SceneObjectType | null;
  objects: ReconstructionSceneObject[];
  selectedObjectId: string | null;
  onToolSelect(type: SceneObjectType): void;
  onPlaceActiveWithGps(): void;
  onCancelPlacement(): void;
  onSelectObject(objectId: string): void;
  onClearObjects(): void;
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

const MATERIAL_SYMBOL_BY_TYPE: Record<SceneObjectType, string> = {
  Pothole: "radio_button_unchecked",
  "Road Crack": "gesture",
  Puddle: "water_drop",
  "Oil Spill": "oil_barrel",
  "Loose Gravel": "grain",
  Debris: "deployed_code",
  "Fallen Branch": "forest",
  "Broken Glass": "broken_image",
  "Skid Mark": "drag_handle",
  "Tyre Mark": "tire_repair",
  "Vehicle Part": "build",
  "Injury Location": "emergency",
  "Traffic Cone": "traffic",
  "Road Barrier": "car_crash",
  "Stop Sign": "stop_circle",
  "Give Way Sign": "change_history",
  "Speed Limit Sign": "speed",
  "Traffic Light": "traffic",
  "Street Light": "lightbulb",
  Drain: "water_damage",
  Guardrail: "horizontal_rule",
  "Bus Stop": "directions_bus",
  "Parked Vehicle": "local_parking",
  Tree: "park",
  Bush: "grass",
  Wall: "view_week",
  Fence: "fence",
  "CCTV Camera": "videocam",
  "Evidence Marker": "pin_drop",
  "Measurement Point": "straighten",
  "Witness Viewpoint": "visibility",
};

function gpsActionLabel(type: SceneObjectType): string {
  if (isTraceableSceneObjectType(type)) {
    return "Walk and track with GPS";
  }

  if (BOUNDARY_TYPES.has(type)) {
    return "Walk boundary with GPS";
  }

  return "Place at live GPS position";
}

function SceneObjectIcon({
  type,
  size = 17,
}: {
  type: SceneObjectType;
  size?: number;
}) {
  return (
    <span
      className="material-symbols-outlined roadsafe-material-icon blender-object-icon"
      style={{
        fontSize: size,
        fontVariationSettings:
          '"FILL" 0, "wght" 450, "GRAD" 0, "opsz" 24',
      }}
      aria-hidden="true"
    >
      {MATERIAL_SYMBOL_BY_TYPE[type]}
    </span>
  );
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
  const activeCatalogItem =
    activeType
      ? sceneObjectCatalog.find((item) => item.type === activeType) ?? null
      : null;

  const placedCountByType = objects.reduce<
    Partial<Record<SceneObjectType, number>>
  >((counts, object) => {
    counts[object.type] = (counts[object.type] ?? 0) + 1;
    return counts;
  }, {});

  return (
    <div className="blender-object-palette">
      <div className="blender-object-palette__intro">
        <p>
          Tick a tool to activate scene placement. Tick it again to stop.
          Icons and counts remain compact like Blender&apos;s Outliner.
        </p>
      </div>

      {activeCatalogItem && (
        <section className="blender-object-palette__active">
          <div className="blender-object-palette__active-copy">
            <span className="blender-object-palette__active-icon">
              <SceneObjectIcon type={activeCatalogItem.type} size={18} />
            </span>
            <span>
              <strong>{activeCatalogItem.label}</strong>
              <small>Placement tool active</small>
            </span>
          </div>

          <div className="blender-object-palette__active-actions">
            <button type="button" onClick={onPlaceActiveWithGps}>
              <LocateFixed size={14} />
              {gpsActionLabel(activeCatalogItem.type)}
            </button>
            <button
              type="button"
              onClick={onCancelPlacement}
              aria-label="Stop object placement"
              title="Stop object placement"
            >
              <X size={14} />
            </button>
          </div>
        </section>
      )}

      <div className="blender-object-palette__categories">
        {sceneObjectCategories.map((category) => {
          const items = sceneObjectCatalog.filter(
            (item) => item.category === category,
          );

          const categoryCount = items.reduce(
            (count, item) =>
              count + (placedCountByType[item.type] ?? 0),
            0,
          );

          return (
            <details key={category} className="blender-object-category">
              <summary>
                <span>{category}</span>
                <small>{categoryCount}</small>
              </summary>

              <div className="blender-object-category__items">
                {items.map((item) => {
                  const active = activeType === item.type;
                  const count = placedCountByType[item.type] ?? 0;

                  return (
                    <label
                      key={item.type}
                      className={`blender-object-option ${
                        active ? "is-active" : ""
                      }`}
                      title={item.description}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {
                          if (active) {
                            onCancelPlacement();
                          } else {
                            onToolSelect(item.type);
                          }
                        }}
                      />

                      <span className="blender-object-option__check">
                        {active && <Check size={11} />}
                      </span>

                      <span className="blender-object-option__icon">
                        <SceneObjectIcon type={item.type} />
                      </span>

                      <span className="blender-object-option__copy">
                        <strong>{item.label}</strong>
                        <small>{item.defaultSeverity}</small>
                      </span>

                      {count > 0 && (
                        <span className="blender-object-option__count">
                          {count}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>

      <section className="blender-placed-objects">
        <header className="blender-placed-objects__header">
          <span>
            <Crosshair size={14} />
            Placed objects
          </span>
          <small>{objects.length}</small>
        </header>

        <div className="blender-placed-objects__list">
          {objects.map((object) => {
            const selected = selectedObjectId === object.id;

            return (
              <label
                key={object.id}
                className={`blender-placed-object ${
                  selected ? "is-selected" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onSelectObject(object.id)}
                />

                <span className="blender-object-option__check">
                  {selected && <Check size={11} />}
                </span>

                <span className="blender-object-option__icon">
                  <SceneObjectIcon type={object.type} />
                </span>

                <span className="blender-object-option__copy">
                  <strong>{object.label}</strong>
                  <small>
                    {object.type} · {object.severity}
                  </small>
                </span>

                {object.locked && (
                  <Lock size={12} aria-label="Locked" />
                )}
              </label>
            );
          })}

          {objects.length === 0 && (
            <div className="blender-placed-objects__empty">
              No objects, hazards or evidence have been placed.
            </div>
          )}
        </div>

        {objects.length > 0 && (
          <footer className="blender-placed-objects__footer">
            <button
              type="button"
              className="is-danger"
              onClick={onClearObjects}
            >
              <Trash2 size={13} />
              Clear all placed objects
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
