import {
  usesGeneratedRoad,
  type DrivingSide,
  type GroundSurfaceType,
  type RoadLayoutType,
  type RoadSceneSettings,
  type RoadSurfaceCondition,
  type SceneEnvironmentType,
  type SceneTimeOfDay,
  type SceneTrafficVolume,
  type SceneVisibility,
  type SceneWeather,
  type TrafficControlType,
} from "../../types/reconstruction";

interface SceneSettingsPanelProps {
  settings: RoadSceneSettings;
  onChange: (updates: Partial<RoadSceneSettings>) => void;
}

const ENVIRONMENTS: SceneEnvironmentType[] = [
  "Road / Junction",
  "Open Ground",
  "Mixed Site",
  "Custom Site",
];

const GROUND_SURFACES: GroundSurfaceType[] = [
  "Unclassified Ground",
  "Firm Soil",
  "Loose Soil",
  "Grass",
  "Gravel",
  "Sand",
  "Mud",
  "Concrete",
  "Paved Yard",
  "Mixed Surface",
];

const ROAD_LAYOUTS: RoadLayoutType[] = [
  "Four-way Intersection",
  "T-Junction",
  "Straight Road",
  "Roundabout",
  "Pedestrian Crossing",
  "Transport Terminus",
];

const TRAFFIC_CONTROLS: TrafficControlType[] = [
  "None",
  "Traffic Lights",
  "Stop Signs",
  "Give Way Signs",
];

const TIMES_OF_DAY: SceneTimeOfDay[] = ["Day", "Dawn", "Dusk", "Night"];
const WEATHER_OPTIONS: SceneWeather[] = ["Clear", "Rain", "Fog", "Dust"];
const ROAD_SURFACES: RoadSurfaceCondition[] = ["Dry", "Wet", "Damaged"];
const VISIBILITY_OPTIONS: SceneVisibility[] = ["Good", "Reduced", "Poor"];
const TRAFFIC_VOLUMES: SceneTrafficVolume[] = ["Light", "Moderate", "Heavy"];

function SettingSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-3">
      <span>
        <span className="block text-sm font-medium text-gray-700">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-gray-500">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0"
      />
    </label>
  );
}

export default function SceneSettingsPanel({
  settings,
  onChange,
}: SceneSettingsPanelProps) {
  const generatedRoad = usesGeneratedRoad(settings);
  const groundOnly = !generatedRoad;

  return (
    <div className="mt-6 border-t border-gray-200 pt-5">
      <div>
        <h3 className="font-bold text-gray-900">Scene Environment</h3>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          Keep the real GPS location while choosing whether RoadSafe generates a
          road, preserves neutral ground, or combines both.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <SettingSelect
          label="Environment type"
          value={settings.sceneEnvironment}
          options={ENVIRONMENTS}
          onChange={(sceneEnvironment) => {
            const roadEnabled =
              sceneEnvironment === "Road / Junction" ||
              sceneEnvironment === "Mixed Site";
            onChange({
              sceneEnvironment,
              trafficControl: roadEnabled ? settings.trafficControl : "None",
              speedLimitKmh: roadEnabled
                ? Math.max(10, settings.speedLimitKmh || 60)
                : 0,
              showPavements: roadEnabled ? settings.showPavements : false,
              showLaneMarkings: roadEnabled ? settings.showLaneMarkings : false,
              showPedestrianCrossing: roadEnabled
                ? settings.showPedestrianCrossing
                : false,
            });
          }}
        />

        <SettingSelect
          label={groundOnly ? "Ground classification" : "Surrounding ground"}
          value={settings.groundSurface}
          options={GROUND_SURFACES}
          onChange={(groundSurface) => onChange({ groundSurface })}
        />

        {groundOnly && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-5 text-blue-800">
            <strong className="block text-sm text-blue-950">
              No road will be generated
            </strong>
            The real coordinate, north orientation, scale, terrain and GPS field
            placements remain active. Add paths, boundaries, structures and
            evidence manually or through Field Capture.
          </div>
        )}

        {generatedRoad && (
          <div className="space-y-4 rounded-xl border border-gray-200 p-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-800">
                Generated road geometry
              </h4>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                These controls apply only to Road / Junction and Mixed Site.
              </p>
            </div>

            <SettingSelect
              label="Road layout"
              value={settings.roadLayout}
              options={ROAD_LAYOUTS}
              onChange={(roadLayout) => onChange({ roadLayout })}
            />

            <div className="grid grid-cols-2 gap-3">
              <SettingSelect<DrivingSide>
                label="Driving side"
                value={settings.drivingSide}
                options={["Left", "Right"]}
                onChange={(drivingSide) => onChange({ drivingSide })}
              />
              <SettingSelect
                label="Traffic control"
                value={settings.trafficControl}
                options={TRAFFIC_CONTROLS}
                onChange={(trafficControl) => onChange({ trafficControl })}
              />
            </div>

            <label className="block">
              <span className="flex items-center justify-between text-xs font-medium text-gray-600">
                <span>Lane count</span>
                <strong className="text-gray-900">{settings.laneCount}</strong>
              </span>
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={settings.laneCount}
                onChange={(event) =>
                  onChange({ laneCount: Number(event.target.value) })
                }
                className="mt-2 w-full"
              />
            </label>

            <label className="block">
              <span className="flex items-center justify-between text-xs font-medium text-gray-600">
                <span>Road rotation</span>
                <strong className="text-gray-900">{settings.roadRotation}°</strong>
              </span>
              <input
                type="range"
                min={-180}
                max={180}
                step={5}
                value={settings.roadRotation}
                onChange={(event) =>
                  onChange({ roadRotation: Number(event.target.value) })
                }
                className="mt-2 w-full"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600">
                Speed limit
              </span>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={160}
                  step={10}
                  value={Math.max(10, settings.speedLimitKmh || 60)}
                  onChange={(event) =>
                    onChange({
                      speedLimitKmh: Math.min(
                        160,
                        Math.max(10, Number(event.target.value)),
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <span className="text-xs font-semibold text-gray-500">km/h</span>
              </div>
            </label>

            <SettingSelect
              label="Road surface"
              value={settings.roadSurface}
              options={ROAD_SURFACES}
              onChange={(roadSurface) => onChange({ roadSurface })}
            />

            <ToggleSetting
              label="Pavements"
              description="Show pedestrian pavement areas around the road."
              checked={settings.showPavements}
              onChange={(showPavements) => onChange({ showPavements })}
            />
            <ToggleSetting
              label="Lane markings"
              description="Display centre and lane-separation markings."
              checked={settings.showLaneMarkings}
              onChange={(showLaneMarkings) => onChange({ showLaneMarkings })}
            />
            <ToggleSetting
              label="Pedestrian crossing"
              description="Add a marked zebra crossing near the collision zone."
              checked={settings.showPedestrianCrossing}
              onChange={(showPedestrianCrossing) =>
                onChange({ showPedestrianCrossing })
              }
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <SettingSelect
            label="Time of day"
            value={settings.timeOfDay}
            options={TIMES_OF_DAY}
            onChange={(timeOfDay) => onChange({ timeOfDay })}
          />
          <SettingSelect
            label="Weather"
            value={settings.weather}
            options={WEATHER_OPTIONS}
            onChange={(weather) => onChange({ weather })}
          />
          <SettingSelect
            label="Visibility"
            value={settings.visibility}
            options={VISIBILITY_OPTIONS}
            onChange={(visibility) => onChange({ visibility })}
          />
          {generatedRoad && (
            <SettingSelect
              label="Traffic volume"
              value={settings.trafficVolume}
              options={TRAFFIC_VOLUMES}
              onChange={(trafficVolume) => onChange({ trafficVolume })}
            />
          )}
        </div>

        <div className="rounded-xl border border-gray-200 p-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-800">
              Real-world terrain
            </h4>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Builds the surrounding land from the saved real coordinate or a
              confirmed GPS calibration.
            </p>
          </div>

          <div className="mt-3 space-y-3">
            <ToggleSetting
              label="Use real elevation"
              description="Load terrain around the accident location."
              checked={settings.useRealTerrain}
              onChange={(useRealTerrain) => onChange({ useRealTerrain })}
            />

            {settings.useRealTerrain && (
              <>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600">
                    Terrain area
                  </span>
                  <select
                    value={settings.terrainAreaMetres}
                    onChange={(event) =>
                      onChange({ terrainAreaMetres: Number(event.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                  >
                    <option value={500}>500 m × 500 m</option>
                    <option value={1000}>1 km × 1 km</option>
                    <option value={3000}>3 km × 3 km</option>
                  </select>
                </label>

                <label className="block">
                  <span className="flex items-center justify-between text-xs font-medium text-gray-600">
                    <span>Elevation scale</span>
                    <strong className="text-gray-900">
                      {settings.terrainExaggeration.toFixed(2)}×
                    </strong>
                  </span>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={settings.terrainExaggeration}
                    onChange={(event) =>
                      onChange({
                        terrainExaggeration: Number(event.target.value),
                      })
                    }
                    className="mt-2 w-full"
                  />
                  <span className="mt-1 block text-[11px] leading-4 text-gray-500">
                    Keep 1.00× for investigation and reporting. Higher values are
                    visual aids only.
                  </span>
                </label>

                <ToggleSetting
                  label={generatedRoad ? "Conform scene to terrain" : "Conform ground scene to terrain"}
                  description="Place participants, evidence and generated surfaces along the elevation profile."
                  checked={settings.conformRoadToTerrain}
                  onChange={(conformRoadToTerrain) =>
                    onChange({ conformRoadToTerrain })
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
