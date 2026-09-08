import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";

import {
  AppWindow,
  Database,
  KeyRound,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "../icons/materialIcons";

import {
  formatStorageBytes,
  getRoadSafeStorageSummary,
  readRoadSafeSettings,
  subscribeRoadSafeSettings,
  writeRoadSafeSettings,
  type RoadSafeAppSettings,
} from "../../services/roadSafeSettingsService";

import {
  useAuth,
} from "../../context/AuthContext";

import DataSettingsPanel from "../settings/DataSettingsPanel";
import ShortcutSettingsPanel from "../settings/ShortcutSettingsPanel";
import WorkspaceSettingsPanel from "../settings/WorkspaceSettingsPanel";

import "./SettingsPage.css";

type SettingsSection =
  | "workspace"
  | "keyboard"
  | "data"
  | "account";

const SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    description:
      "Layout, Inspector, density and motion",
    icon:
      SlidersHorizontal,
  },
  {
    id: "keyboard",
    label: "Keyboard",
    description:
      "Shortcuts, palette and remapping",
    icon:
      KeyRound,
  },
  {
    id: "data",
    label: "Data & storage",
    description:
      "Browser storage and reset controls",
    icon:
      Database,
  },
  {
    id: "account",
    label: "Account",
    description:
      "Security and station administration",
    icon:
      ShieldCheck,
  },
] as const;

export default function SettingsPage() {
  const auth =
    useAuth();

  const role =
    auth.identity?.role ??
    "unassigned";

  const isStationAdmin =
    role ===
    "station_admin";

  const [
    section,
    setSection,
  ] = useState<SettingsSection>(
    "workspace",
  );

  const [
    settings,
    setSettings,
  ] = useState<RoadSafeAppSettings>(
    () =>
      readRoadSafeSettings(),
  );

  useEffect(
    () =>
      subscribeRoadSafeSettings(
        setSettings,
      ),
    [],
  );

  const storage =
    useMemo(
      () =>
        getRoadSafeStorageSummary(),
      [settings],
    );

  const customShortcutCount =
    Object.keys(
      settings.shortcuts
        .overrides,
    ).length;

  function changeSettings(
    next:
      RoadSafeAppSettings,
  ): void {
    const saved =
      writeRoadSafeSettings(
        next,
      );

    setSettings(saved);
  }

  return (
    <div className="roadsafe-settings-page">
      <section className="roadsafe-settings-hero">
        <div className="roadsafe-settings-hero__copy">
          <span>
            RoadSafe configuration
          </span>

          <h2>
            System Settings
          </h2>

          <p>
            Configure workstation behaviour, keyboard control and browser-resident RoadSafe data.
          </p>
        </div>

        <div className="roadsafe-settings-summary">
          <div>
            <span>
              Density
            </span>

            <strong>
              {
                settings.workspace
                  .density ===
                "compact"
                  ? "Compact"
                  : "Comfortable"
              }
            </strong>
          </div>

          <div>
            <span>
              Shortcuts
            </span>

            <strong>
              {
                settings.shortcuts
                  .enabled
                  ? "Enabled"
                  : "Disabled"
              }
            </strong>

            <small>
              {customShortcutCount} custom
            </small>
          </div>

          <div>
            <span>
              Local data
            </span>

            <strong>
              {formatStorageBytes(
                storage.approximateBytes,
              )}
            </strong>

            <small>
              {storage.keyCount} keys
            </small>
          </div>
        </div>
      </section>

      <div className="roadsafe-settings-layout">
        <aside className="roadsafe-settings-sidebar">
          <div className="roadsafe-settings-sidebar__label">
            Settings
          </div>

          <nav>
            {SECTIONS.map(
              ({
                id,
                label,
                description,
                icon: Icon,
              }) => (
                <button
                  key={id}
                  type="button"
                  className={
                    section ===
                    id
                      ? "is-active"
                      : ""
                  }
                  onClick={() =>
                    setSection(
                      id,
                    )
                  }
                >
                  <Icon
                    size={17}
                  />

                  <span>
                    <strong>
                      {label}
                    </strong>

                    <small>
                      {
                        description
                      }
                    </small>
                  </span>
                </button>
              ),
            )}
          </nav>

          <div className="roadsafe-settings-sidebar__session">
            <AppWindow
              size={16}
            />

            <span>
              <strong>
                Browser profile
              </strong>

              <small>
                Settings save locally and apply immediately.
              </small>
            </span>
          </div>
        </aside>

        <main className="roadsafe-settings-content">
          {section ===
            "workspace" && (
            <WorkspaceSettingsPanel
              settings={
                settings
              }
              onChange={
                changeSettings
              }
            />
          )}

          {section ===
            "keyboard" && (
            <ShortcutSettingsPanel
              role={role}
              settings={
                settings
              }
              onChange={
                changeSettings
              }
            />
          )}

          {section ===
            "data" && (
            <DataSettingsPanel
              settings={
                settings
              }
            />
          )}

          {section ===
            "account" && (
            <div className="roadsafe-settings-panel-stack">
              <section className="roadsafe-settings-card">
                <header className="roadsafe-settings-card__header">
                  <span className="roadsafe-settings-card__icon">
                    <ShieldCheck
                      size={18}
                    />
                  </span>

                  <div>
                    <span>
                      Account
                    </span>

                    <strong>
                      Security
                    </strong>

                    <small>
                      Manage the current Station Client credential.
                    </small>
                  </div>
                </header>

                <div className="roadsafe-settings-account-grid">
                  <Link
                    to="/change-password"
                    className="roadsafe-settings-account-card"
                  >
                    <KeyRound
                      size={20}
                    />

                    <strong>
                      Change password
                    </strong>

                    <small>
                      Replace your current RoadSafe password securely.
                    </small>
                  </Link>

                  <div className="roadsafe-settings-account-card is-readonly">
                    <AppWindow
                      size={20}
                    />

                    <strong>
                      Current role
                    </strong>

                    <small>
                      {
                        role ===
                        "station_admin"
                          ? "Station Administrator"
                          : role ===
                            "supervisor"
                            ? "Station Supervisor"
                            : "RoadSafe user"
                      }
                    </small>
                  </div>
                </div>
              </section>

              {isStationAdmin && (
                <section className="roadsafe-settings-card">
                  <header className="roadsafe-settings-card__header">
                    <span className="roadsafe-settings-card__icon">
                      <Users
                        size={18}
                      />
                    </span>

                    <div>
                      <span>
                        Administration
                      </span>

                      <strong>
                        Station access
                      </strong>

                      <small>
                        Officer and role management is restricted to Station Administrators.
                      </small>
                    </div>
                  </header>

                  <div className="roadsafe-settings-account-grid">
                    <Link
                      to="/officers"
                      className="roadsafe-settings-account-card"
                    >
                      <Users
                        size={20}
                      />

                      <strong>
                        Officer management
                      </strong>

                      <small>
                        Create officers, assign roles, block access and manage credentials.
                      </small>
                    </Link>
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}