import {
  useMemo,
  useState,
} from "react";

import {
  Copy,
  Database,
  RotateCcw,
} from "../icons/materialIcons";

import {
  clearRoadSafeLocalData,
  formatStorageBytes,
  getRoadSafeStorageSummary,
  resetRoadSafeSettings,
  type RoadSafeAppSettings,
} from "../../services/roadSafeSettingsService";

interface DataSettingsPanelProps {
  settings:
    RoadSafeAppSettings;
}

export default function DataSettingsPanel({
  settings,
}: DataSettingsPanelProps) {
  const [
    refreshToken,
    setRefreshToken,
  ] = useState(0);

  const [
    message,
    setMessage,
  ] = useState("");

  const storage =
    useMemo(
      () =>
        getRoadSafeStorageSummary(),
      [refreshToken],
    );

  function confirmAction(
    messageText: string,
  ): boolean {
    if (
      !settings.safety
        .confirmDestructiveActions
    ) {
      return true;
    }

    return window.confirm(
      messageText,
    );
  }

  async function copySettings():
    Promise<void> {
    try {
      await navigator.clipboard
        .writeText(
          JSON.stringify(
            settings,
            null,
            2,
          ),
        );

      setMessage(
        "Settings JSON copied to the clipboard.",
      );
    } catch {
      setMessage(
        "The browser could not copy settings to the clipboard.",
      );
    }
  }

  function resetPreferences():
    void {
    if (
      !confirmAction(
        "Reset RoadSafe browser preferences and shortcut mappings to defaults?",
      )
    ) {
      return;
    }

    resetRoadSafeSettings();

    setRefreshToken(
      (value) => value + 1,
    );

    setMessage(
      "RoadSafe preferences reset to defaults.",
    );
  }

  function clearAll():
    void {
    if (
      !confirmAction(
        "Clear RoadSafe local browser data? This can remove locally stored cases, recent tabs, caches and preferences. Appwrite sign-in data is not targeted.",
      )
    ) {
      return;
    }

    clearRoadSafeLocalData();

    window.location.reload();
  }

  return (
    <div className="roadsafe-settings-panel-stack">
      <section className="roadsafe-settings-card">
        <header className="roadsafe-settings-card__header">
          <span className="roadsafe-settings-card__icon">
            <Database
              size={18}
            />
          </span>

          <div>
            <span>
              Browser storage
            </span>

            <strong>
              RoadSafe local data
            </strong>

            <small>
              Only RoadSafe-owned localStorage keys are counted here.
            </small>
          </div>
        </header>

        <div className="roadsafe-storage-summary-grid">
          <div>
            <span>
              Keys
            </span>

            <strong>
              {
                storage.keyCount
              }
            </strong>
          </div>

          <div>
            <span>
              Approx. size
            </span>

            <strong>
              {formatStorageBytes(
                storage.approximateBytes,
              )}
            </strong>
          </div>

          <div>
            <span>
              Storage
            </span>

            <strong>
              Browser
            </strong>
          </div>
        </div>

        <details className="roadsafe-storage-key-list">
          <summary>
            View stored RoadSafe keys
          </summary>

          <div>
            {storage.keys.length ===
            0 ? (
              <span>
                No RoadSafe local keys found.
              </span>
            ) : (
              storage.keys.map(
                (key) => (
                  <code
                    key={key}
                  >
                    {key}
                  </code>
                ),
              )
            )}
          </div>
        </details>
      </section>

      <section className="roadsafe-settings-card">
        <header className="roadsafe-settings-card__header">
          <span className="roadsafe-settings-card__icon">
            <RotateCcw
              size={18}
            />
          </span>

          <div>
            <span>
              Maintenance
            </span>

            <strong>
              Preferences and local data
            </strong>

            <small>
              These actions are real browser operations, not placeholders.
            </small>
          </div>
        </header>

        {message && (
          <div className="roadsafe-settings-message">
            {message}
          </div>
        )}

        <div className="roadsafe-settings-action-list">
          <div>
            <span>
              <strong>
                Copy settings JSON
              </strong>

              <small>
                Copy the current RoadSafe preference object for troubleshooting.
              </small>
            </span>

            <button
              type="button"
              className="ui-button"
              onClick={
                copySettings
              }
            >
              <Copy
                size={14}
              />
              Copy
            </button>
          </div>

          <div>
            <span>
              <strong>
                Reset preferences
              </strong>

              <small>
                Restore workspace, motion and keyboard preferences to RoadSafe defaults.
              </small>
            </span>

            <button
              type="button"
              className="ui-button"
              onClick={
                resetPreferences
              }
            >
              <RotateCcw
                size={14}
              />
              Reset
            </button>
          </div>

          <div className="is-danger">
            <span>
              <strong>
                Clear RoadSafe local data
              </strong>

              <small>
                Remove RoadSafe-owned local browser records, caches, recent tabs and preferences.
              </small>
            </span>

            <button
              type="button"
              className="ui-button"
              onClick={
                clearAll
              }
            >
              Clear data
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}