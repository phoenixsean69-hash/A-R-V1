import type {
  DrivingSide,
  RoadLayoutType,
  RoadSceneSettings,
  RoadSurfaceCondition,
  SceneTimeOfDay,
  SceneTrafficVolume,
  SceneVisibility,
  SceneWeather,
  TrafficControlType,
} from "../../types/reconstruction";

interface SceneSettingsPanelProps {
  settings: RoadSceneSettings;
  onChange: (
    updates: Partial<RoadSceneSettings>,
  ) => void;
}

const ROAD_LAYOUTS: RoadLayoutType[] = [
  "Four-way Intersection",
  "T-Junction",
  "Straight Road",
  "Roundabout",
  "Pedestrian Crossing",
  "Transport Terminus",
];

const TRAFFIC_CONTROLS:
  TrafficControlType[] = [
  "None",
  "Traffic Lights",
  "Stop Signs",
  "Give Way Signs",
];

const TIMES_OF_DAY:
  SceneTimeOfDay[] = [
  "Day",
  "Dawn",
  "Dusk",
  "Night",
];

const WEATHER_OPTIONS:
  SceneWeather[] = [
  "Clear",
  "Rain",
  "Fog",
  "Dust",
];

const ROAD_SURFACES:
  RoadSurfaceCondition[] = [
  "Dry",
  "Wet",
  "Damaged",
];

const VISIBILITY_OPTIONS:
  SceneVisibility[] = [
  "Good",
  "Reduced",
  "Poor",
];

const TRAFFIC_VOLUMES:
  SceneTrafficVolume[] = [
  "Light",
  "Moderate",
  "Heavy",
];

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
      <span className="text-xs font-medium text-gray-600">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value as T,
          )
        }
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
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
    <label className="flex items-center justify-between gap-4 rounded-sm border border-gray-200 p-3">
      <span>
        <span className="block text-sm font-medium text-gray-700">
          {label}
        </span>

        <span className="mt-0.5 block text-xs leading-5 text-gray-500">
          {description}
        </span>
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
        className="h-5 w-5 shrink-0"
      />
    </label>
  );
}

export default function SceneSettingsPanel({
  settings,
  onChange,
}: SceneSettingsPanelProps) {
  return (
    <div className="mt-6 border-t border-gray-200 pt-5">
      <div>
        <h3 className="font-bold text-gray-900">
          Scene &amp; Road Layout
        </h3>

        <p className="mt-1 text-xs leading-5 text-gray-500">
          Configure the road geometry and environmental conditions used by the reconstruction.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <SettingSelect
          label="Road layout"
          value={settings.roadLayout}
          options={ROAD_LAYOUTS}
          onChange={(roadLayout) =>
            onChange({ roadLayout })
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <SettingSelect<DrivingSide>
            label="Driving side"
            value={settings.drivingSide}
            options={["Left", "Right"]}
            onChange={(drivingSide) =>
              onChange({ drivingSide })
            }
          />

          <SettingSelect
            label="Traffic control"
            value={settings.trafficControl}
            options={TRAFFIC_CONTROLS}
            onChange={(trafficControl) =>
              onChange({ trafficControl })
            }
          />
        </div>

        <label className="block">
          <span className="flex items-center justify-between text-xs font-medium text-gray-600">
            <span>Lane count</span>
            <strong className="text-gray-900">
              {settings.laneCount}
            </strong>
          </span>

          <input
            type="range"
            min={1}
            max={6}
            step={1}
            value={settings.laneCount}
            onChange={(event) =>
              onChange({
                laneCount: Number(
                  event.target.value,
                ),
              })
            }
            className="mt-2 w-full"
          />
        </label>

        <label className="block">
          <span className="flex items-center justify-between text-xs font-medium text-gray-600">
            <span>Road rotation</span>
            <strong className="text-gray-900">
              {settings.roadRotation}°
            </strong>
          </span>

          <input
            type="range"
            min={-180}
            max={180}
            step={5}
            value={settings.roadRotation}
            onChange={(event) =>
              onChange({
                roadRotation: Number(
                  event.target.value,
                ),
              })
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
              value={settings.speedLimitKmh}
              onChange={(event) =>
                onChange({
                  speedLimitKmh: Math.min(
                    160,
                    Math.max(
                      10,
                      Number(
                        event.target.value,
                      ),
                    ),
                  ),
                })
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />

            <span className="text-xs font-semibold text-gray-500">
              km/h
            </span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <SettingSelect
            label="Time of day"
            value={settings.timeOfDay}
            options={TIMES_OF_DAY}
            onChange={(timeOfDay) =>
              onChange({ timeOfDay })
            }
          />

          <SettingSelect
            label="Weather"
            value={settings.weather}
            options={WEATHER_OPTIONS}
            onChange={(weather) =>
              onChange({ weather })
            }
          />

          <SettingSelect
            label="Road surface"
            value={settings.roadSurface}
            options={ROAD_SURFACES}
            onChange={(roadSurface) =>
              onChange({ roadSurface })
            }
          />

          <SettingSelect
            label="Visibility"
            value={settings.visibility}
            options={VISIBILITY_OPTIONS}
            onChange={(visibility) =>
              onChange({ visibility })
            }
          />
        </div>

        <SettingSelect
          label="Traffic volume"
          value={settings.trafficVolume}
          options={TRAFFIC_VOLUMES}
          onChange={(trafficVolume) =>
            onChange({ trafficVolume })
          }
        />

        <ToggleSetting
          label="Pavements"
          description="Show pedestrian pavement areas around the road."
          checked={settings.showPavements}
          onChange={(showPavements) =>
            onChange({ showPavements })
          }
        />

        <ToggleSetting
          label="Lane markings"
          description="Display centre and lane-separation markings."
          checked={settings.showLaneMarkings}
          onChange={(showLaneMarkings) =>
            onChange({
              showLaneMarkings,
            })
          }
        />

        <ToggleSetting
          label="Pedestrian crossing"
          description="Add a marked zebra crossing near the collision zone."
          checked={
            settings.showPedestrianCrossing
          }
          onChange={(
            showPedestrianCrossing,
          ) =>
            onChange({
              showPedestrianCrossing,
            })
          }
        />
      </div>
    </div>
  );
}
