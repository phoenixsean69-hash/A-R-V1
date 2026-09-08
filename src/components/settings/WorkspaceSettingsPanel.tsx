import {
  AppWindow,
  Eye,
  Gauge,
  SlidersHorizontal,
} from "../icons/materialIcons";

import type {
  RoadSafeAppSettings,
} from "../../services/roadSafeSettingsService";

import SettingsToggle from "./SettingsToggle";

interface WorkspaceSettingsPanelProps {
  settings:
    RoadSafeAppSettings;

  onChange(
    settings:
      RoadSafeAppSettings,
  ): void;
}

export default function WorkspaceSettingsPanel({
  settings,
  onChange,
}: WorkspaceSettingsPanelProps) {
  function updateWorkspace(
    patch:
      Partial<
        RoadSafeAppSettings[
          "workspace"
        ]
      >,
  ): void {
    onChange({
      ...settings,

      workspace: {
        ...settings.workspace,
        ...patch,
      },
    });
  }

  function updateSafety(
    patch:
      Partial<
        RoadSafeAppSettings[
          "safety"
        ]
      >,
  ): void {
    onChange({
      ...settings,

      safety: {
        ...settings.safety,
        ...patch,
      },
    });
  }

  return (
    <div className="roadsafe-settings-panel-stack">
      <section className="roadsafe-settings-card">
        <header className="roadsafe-settings-card__header">
          <span className="roadsafe-settings-card__icon">
            <AppWindow
              size={18}
            />
          </span>

          <div>
            <span>
              Workspace
            </span>

            <strong>
              Shell and panels
            </strong>

            <small>
              These changes apply immediately to this RoadSafe browser.
            </small>
          </div>
        </header>

        <div className="roadsafe-settings-toggle-list">
          <SettingsToggle
            checked={
              settings.workspace
                .navigationCollapsed
            }
            label="Start with navigation collapsed"
            description="Use the narrow navigation rail until you expand it."
            onChange={(
              checked,
            ) =>
              updateWorkspace({
                navigationCollapsed:
                  checked,
              })
            }
          />

          <SettingsToggle
            checked={
              settings.workspace
                .inspectorOpen
            }
            label="Keep Inspector open"
            description="Show the right-side Inspector when the current workspace supports it."
            onChange={(
              checked,
            ) =>
              updateWorkspace({
                inspectorOpen:
                  checked,
              })
            }
          />

          <SettingsToggle
            checked={
              settings.workspace
                .inspectorDocked
            }
            disabled={
              !settings.workspace
                .inspectorOpen
            }
            label="Dock Inspector"
            description="Reserve a permanent right-side column instead of floating the Inspector."
            onChange={(
              checked,
            ) =>
              updateWorkspace({
                inspectorDocked:
                  checked,
              })
            }
          />
        </div>
      </section>

      <section className="roadsafe-settings-card">
        <header className="roadsafe-settings-card__header">
          <span className="roadsafe-settings-card__icon">
            <Gauge
              size={18}
            />
          </span>

          <div>
            <span>
              Interface
            </span>

            <strong>
              Density and motion
            </strong>

            <small>
              Tune RoadSafe for dense workstation use or easier visual scanning.
            </small>
          </div>
        </header>

        <div className="roadsafe-settings-choice-grid">
          <button
            type="button"
            className={`roadsafe-settings-choice ${
              settings.workspace
                .density ===
              "comfortable"
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              updateWorkspace({
                density:
                  "comfortable",
              })
            }
          >
            <Eye
              size={18}
            />

            <strong>
              Comfortable
            </strong>

            <small>
              Standard spacing and control height.
            </small>
          </button>

          <button
            type="button"
            className={`roadsafe-settings-choice ${
              settings.workspace
                .density ===
              "compact"
                ? "is-active"
                : ""
            }`}
            onClick={() =>
              updateWorkspace({
                density:
                  "compact",
              })
            }
          >
            <SlidersHorizontal
              size={18}
            />

            <strong>
              Compact
            </strong>

            <small>
              Tighter workstation spacing for large desktop layouts.
            </small>
          </button>
        </div>

        <div className="roadsafe-settings-toggle-list">
          <SettingsToggle
            checked={
              settings.workspace
                .reduceMotion
            }
            label="Reduce motion"
            description="Minimise UI animation and transition durations throughout the app."
            onChange={(
              checked,
            ) =>
              updateWorkspace({
                reduceMotion:
                  checked,
              })
            }
          />

          <SettingsToggle
            checked={
              settings.safety
                .confirmDestructiveActions
            }
            label="Confirm destructive actions"
            description="Require confirmation before RoadSafe clears local data or resets critical browser state."
            onChange={(
              checked,
            ) =>
              updateSafety({
                confirmDestructiveActions:
                  checked,
              })
            }
          />
        </div>
      </section>
    </div>
  );
}