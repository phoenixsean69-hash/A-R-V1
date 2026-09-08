import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  KeyRound,
  RotateCcw,
  Search,
} from "../icons/materialIcons";

import type {
  RoadSafeAppSettings,
} from "../../services/roadSafeSettingsService";

import type {
  RoadSafeRole,
} from "../../types/auth";

import {
  SHORTCUT_DEFINITIONS,
  formatShortcutSignature,
  getEffectiveShortcutSignatures,
  shortcutSignatureFromEvent,
} from "../shortcuts/shortcutRegistry";

import SettingsToggle from "./SettingsToggle";

interface ShortcutSettingsPanelProps {
  role:
    RoadSafeRole;

  settings:
    RoadSafeAppSettings;

  onChange(
    settings:
      RoadSafeAppSettings,
  ): void;
}

function scopeAvailable(
  scope:
    (typeof SHORTCUT_DEFINITIONS)[number][
      "scope"
    ],
  role:
    RoadSafeRole,
): boolean {
  if (
    scope === "all" ||
    scope ===
      "active-case"
  ) {
    return true;
  }

  if (
    scope ===
    "station"
  ) {
    return (
      role === "supervisor" ||
      role ===
        "station_admin"
    );
  }

  return (
    role ===
    "station_admin"
  );
}

export default function ShortcutSettingsPanel({
  role,
  settings,
  onChange,
}: ShortcutSettingsPanelProps) {
  const [
    search,
    setSearch,
  ] = useState("");

  const [
    recordingId,
    setRecordingId,
  ] = useState<
    string | null
  >(null);

  const [
    message,
    setMessage,
  ] = useState("");

  const definitions =
    useMemo(
      () =>
        SHORTCUT_DEFINITIONS
          .filter(
            (definition) =>
              scopeAvailable(
                definition.scope,
                role,
              ),
          )
          .filter(
            (definition) => {
              const normalized =
                search
                  .trim()
                  .toLowerCase();

              if (!normalized) {
                return true;
              }

              return [
                definition.label,
                definition.description,
                definition.category,
                ...definition.keywords,
              ]
                .join(" ")
                .toLowerCase()
                .includes(
                  normalized,
                );
            },
          ),
      [
        role,
        search,
      ],
    );

  function updateShortcuts(
    patch:
      Partial<
        RoadSafeAppSettings[
          "shortcuts"
        ]
      >,
  ): void {
    onChange({
      ...settings,

      shortcuts: {
        ...settings.shortcuts,
        ...patch,
      },
    });
  }

  useEffect(() => {
    if (recordingId === null) {
      return;
    }

    const activeRecordingId: string =
      recordingId;

    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      event.preventDefault();
      event.stopPropagation();

      if (
        event.key ===
        "Escape"
      ) {
        setRecordingId(
          null,
        );

        setMessage(
          "Shortcut recording cancelled.",
        );

        return;
      }

      const signature =
        shortcutSignatureFromEvent(
          event,
        );

      if (!signature) {
        return;
      }

      const conflict =
        SHORTCUT_DEFINITIONS
          .find(
            (definition) => {
              if (
                definition.id ===
                activeRecordingId
              ) {
                return false;
              }

              return getEffectiveShortcutSignatures(
                definition,
                settings.shortcuts
                  .overrides,
              ).includes(
                signature,
              );
            },
          );

      if (conflict) {
        setMessage(
          `${formatShortcutSignature(
            signature,
          )} is already assigned to ${conflict.label}.`,
        );

        return;
      }

      const nextOverrides:
        Record<string, string> = {
          ...settings.shortcuts
            .overrides,
        };

      nextOverrides[
        activeRecordingId
      ] = signature;

      updateShortcuts({
        overrides:
          nextOverrides,
      });

      const definition =
        SHORTCUT_DEFINITIONS
          .find(
            (item) =>
              item.id ===
              activeRecordingId,
          );

      setMessage(
        definition
          ? `${definition.label} is now ${formatShortcutSignature(
              signature,
            )}.`
          : "Shortcut updated.",
      );

      setRecordingId(
        null,
      );
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
      true,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
        true,
      );
    };
  }, [
    recordingId,
    settings,
  ]);

  function resetOne(
    id: string,
  ): void {
    const next = {
      ...settings.shortcuts
        .overrides,
    };

    delete next[id];

    updateShortcuts({
      overrides:
        next,
    });

    setMessage(
      "Shortcut reset to its RoadSafe default.",
    );
  }

  function resetAll():
    void {
    updateShortcuts({
      overrides: {},
    });

    setMessage(
      "All shortcut customisations were reset.",
    );
  }

  function openShortcutUi(
    view:
      | "palette"
      | "help",
  ): void {
    window.dispatchEvent(
      new CustomEvent(
        "roadsafe:shortcut-ui",
        {
          detail: {
            view,
          },
        },
      ),
    );
  }

  return (
    <div className="roadsafe-settings-panel-stack">
      <section className="roadsafe-settings-card">
        <header className="roadsafe-settings-card__header">
          <span className="roadsafe-settings-card__icon">
            <KeyRound
              size={18}
            />
          </span>

          <div>
            <span>
              Keyboard
            </span>

            <strong>
              App-wide shortcuts
            </strong>

            <small>
              Shortcuts update immediately without reloading RoadSafe.
            </small>
          </div>
        </header>

        <div className="roadsafe-settings-toggle-list">
          <SettingsToggle
            checked={
              settings.shortcuts
                .enabled
            }
            label="Enable keyboard shortcuts"
            description="Allow RoadSafe navigation, workspace and tab commands from the keyboard."
            onChange={(
              checked,
            ) =>
              updateShortcuts({
                enabled:
                  checked,
              })
            }
          />

          <SettingsToggle
            checked={
              settings.shortcuts
                .commandPaletteEnabled
            }
            disabled={
              !settings.shortcuts
                .enabled
            }
            label="Enable command palette"
            description="Allow Ctrl/Cmd + K and the configured palette shortcut."
            onChange={(
              checked,
            ) =>
              updateShortcuts({
                commandPaletteEnabled:
                  checked,
              })
            }
          />

          <SettingsToggle
            checked={
              settings.shortcuts
                .showHints
            }
            label="Show shortcut key hints"
            description="Display keycaps in the command palette and shortcut reference."
            onChange={(
              checked,
            ) =>
              updateShortcuts({
                showHints:
                  checked,
              })
            }
          />
        </div>

        <div className="roadsafe-settings-inline-actions">
          <button
            type="button"
            className="ui-button"
            disabled={
              !settings.shortcuts
                .enabled ||
              !settings.shortcuts
                .commandPaletteEnabled
            }
            onClick={() =>
              openShortcutUi(
                "palette",
              )
            }
          >
            Open command palette
          </button>

          <button
            type="button"
            className="ui-button"
            onClick={() =>
              openShortcutUi(
                "help",
              )
            }
          >
            Shortcut reference
          </button>

          <button
            type="button"
            className="ui-button"
            onClick={
              resetAll
            }
          >
            <RotateCcw
              size={14}
            />
            Reset shortcuts
          </button>
        </div>
      </section>

      <section className="roadsafe-settings-card">
        <header className="roadsafe-settings-card__header roadsafe-settings-card__header--with-search">
          <span className="roadsafe-settings-card__icon">
            <KeyRound
              size={18}
            />
          </span>

          <div>
            <span>
              Key map
            </span>

            <strong>
              Customise shortcuts
            </strong>

            <small>
              Click Record, then press the new key combination. Escape cancels.
            </small>
          </div>

          <label className="roadsafe-settings-search">
            <Search
              size={14}
            />

            <input
              type="search"
              value={search}
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search shortcuts"
            />
          </label>
        </header>

        {message && (
          <div className="roadsafe-settings-message">
            {message}
          </div>
        )}

        <div className="roadsafe-shortcut-settings-list">
          {definitions.map(
            (definition) => {
              const effective =
                getEffectiveShortcutSignatures(
                  definition,
                  settings.shortcuts
                    .overrides,
                );

              const custom =
                Boolean(
                  settings.shortcuts
                    .overrides[
                      definition.id
                    ],
                );

              const recording =
                recordingId ===
                definition.id;

              return (
                <div
                  key={
                    definition.id
                  }
                  className={`roadsafe-shortcut-setting-row ${
                    recording
                      ? "is-recording"
                      : ""
                  }`}
                >
                  <div className="roadsafe-shortcut-setting-copy">
                    <span>
                      {
                        definition.category
                      }
                    </span>

                    <strong>
                      {
                        definition.label
                      }
                    </strong>

                    <small>
                      {
                        definition.description
                      }
                    </small>
                  </div>

                  <div className="roadsafe-shortcut-setting-binding">
                    {recording ? (
                      <span className="roadsafe-shortcut-recording">
                        Press keys...
                      </span>
                    ) : (
                      effective.map(
                        (signature) => (
                          <kbd
                            key={
                              signature
                            }
                          >
                            {formatShortcutSignature(
                              signature,
                            )}
                          </kbd>
                        ),
                      )
                    )}

                    {custom && (
                      <span className="roadsafe-shortcut-custom-badge">
                        Custom
                      </span>
                    )}
                  </div>

                  <div className="roadsafe-shortcut-setting-actions">
                    <button
                      type="button"
                      className="ui-button"
                      onClick={() => {
                        setMessage(
                          "",
                        );

                        setRecordingId(
                          recording
                            ? null
                            : definition.id,
                        );
                      }}
                    >
                      {recording
                        ? "Cancel"
                        : "Record"}
                    </button>

                    <button
                      type="button"
                      className="ui-icon-button"
                      disabled={
                        !custom
                      }
                      onClick={() =>
                        resetOne(
                          definition.id,
                        )
                      }
                      aria-label={`Reset ${definition.label}`}
                    >
                      <RotateCcw
                        size={14}
                      />
                    </button>
                  </div>
                </div>
              );
            },
          )}
        </div>
      </section>
    </div>
  );
}