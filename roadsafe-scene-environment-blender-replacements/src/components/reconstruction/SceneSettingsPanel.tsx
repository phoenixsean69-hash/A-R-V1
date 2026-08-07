import type {
  CSSProperties,
  ReactNode,
} from "react";

import {
  Check,
  Compass,
  Layers3,
  Map,
  SlidersHorizontal,
} from "../icons/materialIcons";

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

import "./SceneSettingsPanel.css";

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

const TIMES_OF_DAY: SceneTimeOfDay[] = [
  "Day",
  "Dawn",
  "Dusk",
  "Night",
];

const WEATHER_OPTIONS: SceneWeather[] = [
  "Clear",
  "Rain",
  "Fog",
  "Dust",
];

const ROAD_SURFACES: RoadSurfaceCondition[] = [
  "Dry",
  "Wet",
  "Damaged",
];

const VISIBILITY_OPTIONS: SceneVisibility[] = [
  "Good",
  "Reduced",
  "Poor",
];

const TRAFFIC_VOLUMES: SceneTrafficVolume[] = [
  "Light",
  "Moderate",
  "Heavy",
];

function PropertySelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="scene-settings__property">
      <span className="scene-settings__label">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="scene-settings__select"
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

function NumberProperty({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="scene-settings__property">
      <span className="scene-settings__label">{label}</span>
      <span className="scene-settings__number-wrap">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="scene-settings__number"
        />
        {suffix && (
          <span className="scene-settings__suffix">{suffix}</span>
        )}
      </span>
    </label>
  );
}

function RangeProperty({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (value: number) => void;
}) {
  const percentage =
    ((value - min) / Math.max(0.0001, max - min)) * 100;

  return (
    <label className="scene-settings__range-property">
      <span className="scene-settings__range-heading">
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="scene-settings__range"
        style={
          {
            "--scene-range-value": `${Math.max(
              0,
              Math.min(100, percentage),
            )}%`,
          } as CSSProperties
        }
      />
    </label>
  );
}

function CheckboxProperty({
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
    <label className="scene-settings__checkbox-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className="scene-settings__checkbox"
        aria-hidden="true"
      >
        {checked && <Check size={12} strokeWidth={2.6} />}
      </span>
      <span className="scene-settings__checkbox-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

function PanelSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Layers3;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="scene-settings__section">
      <header className="scene-settings__section-header">
        <Icon size={15} strokeWidth={1.8} />
        <span className="scene-settings__section-title">
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
      </header>
      <div className="scene-settings__section-body">{children}</div>
    </section>
  );
}

export default function SceneSettingsPanel({
  settings,
  onChange,
}: SceneSettingsPanelProps) {
  const generatedRoad = usesGeneratedRoad(settings);
  const groundOnly = !generatedRoad;

  const handleEnvironmentChange = (
    sceneEnvironment: SceneEnvironmentType,
  ) => {
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
      showLaneMarkings: roadEnabled
        ? settings.showLaneMarkings
        : false,
      showPedestrianCrossing: roadEnabled
        ? settings.showPedestrianCrossing
        : false,
    });
  };

  return (
    <div className="scene-settings workstation-panel">
      <PanelSection
        icon={Map}
        title="Site configuration"
        description="Define the physical scene type and surrounding ground."
      >
        <div className="scene-settings__properties">
          <PropertySelect
            label="Environment type"
            value={settings.sceneEnvironment}
            options={ENVIRONMENTS}
            onChange={handleEnvironmentChange}
          />

          <PropertySelect
            label={
              groundOnly
                ? "Ground classification"
                : "Surrounding ground"
            }
            value={settings.groundSurface}
            options={GROUND_SURFACES}
            onChange={(groundSurface) =>
              onChange({ groundSurface })
            }
          />
        </div>

        {groundOnly && (
          <div className="scene-settings__notice">
            <span className="scene-settings__notice-icon">
              <Compass size={15} strokeWidth={1.8} />
            </span>
            <span>
              <strong>Neutral ground mode</strong>
              <small>
                No generated road geometry. GPS position, orientation,
                scale, terrain and field placements remain available.
              </small>
            </span>
          </div>
        )}
      </PanelSection>

      {generatedRoad && (
        <PanelSection
          icon={Layers3}
          title="Generated road geometry"
          description="Road layout, controls and visible road features."
        >
          <div className="scene-settings__properties">
            <PropertySelect
              label="Road layout"
              value={settings.roadLayout}
              options={ROAD_LAYOUTS}
              onChange={(roadLayout) => onChange({ roadLayout })}
            />

            <PropertySelect<DrivingSide>
              label="Driving side"
              value={settings.drivingSide}
              options={["Left", "Right"]}
              onChange={(drivingSide) =>
                onChange({ drivingSide })
              }
            />

            <PropertySelect
              label="Traffic control"
              value={settings.trafficControl}
              options={TRAFFIC_CONTROLS}
              onChange={(trafficControl) =>
                onChange({ trafficControl })
              }
            />

            <PropertySelect
              label="Road surface"
              value={settings.roadSurface}
              options={ROAD_SURFACES}
              onChange={(roadSurface) =>
                onChange({ roadSurface })
              }
            />

            <NumberProperty
              label="Speed limit"
              value={Math.max(
                10,
                settings.speedLimitKmh || 60,
              )}
              min={10}
              max={160}
              step={10}
              suffix="km/h"
              onChange={(speedLimitKmh) =>
                onChange({
                  speedLimitKmh: Math.min(
                    160,
                    Math.max(10, speedLimitKmh),
                  ),
                })
              }
            />
          </div>

          <div className="scene-settings__divider" />

          <div className="scene-settings__sliders">
            <RangeProperty
              label="Lane count"
              value={settings.laneCount}
              min={1}
              max={6}
              step={1}
              displayValue={String(settings.laneCount)}
              onChange={(laneCount) =>
                onChange({ laneCount })
              }
            />

            <RangeProperty
              label="Road rotation"
              value={settings.roadRotation}
              min={-180}
              max={180}
              step={5}
              displayValue={`${settings.roadRotation}°`}
              onChange={(roadRotation) =>
                onChange({ roadRotation })
              }
            />
          </div>

          <div className="scene-settings__divider" />

          <div className="scene-settings__checkbox-list">
            <CheckboxProperty
              label="Pavements"
              description="Show pedestrian pavement areas around the road."
              checked={settings.showPavements}
              onChange={(showPavements) =>
                onChange({ showPavements })
              }
            />

            <CheckboxProperty
              label="Lane markings"
              description="Display centre and lane-separation markings."
              checked={settings.showLaneMarkings}
              onChange={(showLaneMarkings) =>
                onChange({ showLaneMarkings })
              }
            />

            <CheckboxProperty
              label="Pedestrian crossing"
              description="Add a marked crossing near the collision zone."
              checked={settings.showPedestrianCrossing}
              onChange={(showPedestrianCrossing) =>
                onChange({ showPedestrianCrossing })
              }
            />
          </div>
        </PanelSection>
      )}

      <PanelSection
        icon={SlidersHorizontal}
        title="Scene conditions"
        description="Environmental conditions used for scene review."
      >
        <div className="scene-settings__properties">
          <PropertySelect
            label="Time of day"
            value={settings.timeOfDay}
            options={TIMES_OF_DAY}
            onChange={(timeOfDay) => onChange({ timeOfDay })}
          />

          <PropertySelect
            label="Weather"
            value={settings.weather}
            options={WEATHER_OPTIONS}
            onChange={(weather) => onChange({ weather })}
          />

          <PropertySelect
            label="Visibility"
            value={settings.visibility}
            options={VISIBILITY_OPTIONS}
            onChange={(visibility) =>
              onChange({ visibility })
            }
          />

          {generatedRoad && (
            <PropertySelect
              label="Traffic volume"
              value={settings.trafficVolume}
              options={TRAFFIC_VOLUMES}
              onChange={(trafficVolume) =>
                onChange({ trafficVolume })
              }
            />
          )}
        </div>
      </PanelSection>

      <PanelSection
        icon={Map}
        title="Real-world terrain"
        description="Elevation and terrain conformance around the accident site."
      >
        <div className="scene-settings__checkbox-list">
          <CheckboxProperty
            label="Use real elevation"
            description="Load terrain around the saved accident location."
            checked={settings.useRealTerrain}
            onChange={(useRealTerrain) =>
              onChange({ useRealTerrain })
            }
          />
        </div>

        {settings.useRealTerrain && (
          <>
            <div className="scene-settings__divider" />

            <div className="scene-settings__properties">
              <label className="scene-settings__property">
                <span className="scene-settings__label">
                  Terrain area
                </span>
                <select
                  value={settings.terrainAreaMetres}
                  onChange={(event) =>
                    onChange({
                      terrainAreaMetres: Number(
                        event.target.value,
                      ),
                    })
                  }
                  className="scene-settings__select"
                >
                  <option value={500}>500 m × 500 m</option>
                  <option value={1000}>1 km × 1 km</option>
                  <option value={3000}>3 km × 3 km</option>
                </select>
              </label>
            </div>

            <div className="scene-settings__sliders">
              <RangeProperty
                label="Elevation scale"
                value={settings.terrainExaggeration}
                min={0.5}
                max={2}
                step={0.05}
                displayValue={`${settings.terrainExaggeration.toFixed(
                  2,
                )}×`}
                onChange={(terrainExaggeration) =>
                  onChange({ terrainExaggeration })
                }
              />
            </div>

            <p className="scene-settings__helper">
              Use 1.00× for investigation and reporting. Higher values
              are visual aids only.
            </p>

            <div className="scene-settings__divider" />

            <div className="scene-settings__checkbox-list">
              <CheckboxProperty
                label={
                  generatedRoad
                    ? "Conform scene to terrain"
                    : "Conform ground scene to terrain"
                }
                description="Place participants, evidence and generated surfaces along the elevation profile."
                checked={settings.conformRoadToTerrain}
                onChange={(conformRoadToTerrain) =>
                  onChange({ conformRoadToTerrain })
                }
              />
            </div>
          </>
        )}
      </PanelSection>
    </div>
  );
}
