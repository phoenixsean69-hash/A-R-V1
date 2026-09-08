import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  X,
} from "../icons/materialIcons";

import {
  readRoadSafeSettings,
  subscribeRoadSafeSettings,
  type RoadSafeAppSettings,
} from "../../services/roadSafeSettingsService";

import type {
  RoadSafeRole,
} from "../../types/auth";

import {
  SHORTCUT_DEFINITIONS,
  formatShortcutSignature,
  getEffectiveShortcutSignatures,
  shortcutSignatureFromEvent,
  type ShortcutCategory,
  type ShortcutDefinition,
} from "./shortcutRegistry";

import "./AppShortcutManager.css";

interface ShortcutCommand {
  definition:
    ShortcutDefinition;

  signatures:
    string[];

  run(): void;
}

interface AppShortcutManagerProps {
  role:
    RoadSafeRole;

  homePath:
    string;

  activeCaseId?:
    string | null;

  inspectorAvailable:
    boolean;

  onToggleNavigation():
    void;

  onToggleInspector():
    void;
}

const TAB_COMMAND_EVENT =
  "roadsafe:recent-tabs-command";

function isEditableTarget(
  target:
    EventTarget | null,
): boolean {
  if (
    !(target instanceof
      HTMLElement)
  ) {
    return false;
  }

  if (
    target.isContentEditable
  ) {
    return true;
  }

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true']",
    ),
  );
}

function dispatchTabCommand(
  action:
    | "previous"
    | "next"
    | "close",
): void {
  window.dispatchEvent(
    new CustomEvent(
      TAB_COMMAND_EVENT,
      {
        detail: {
          action,
        },
      },
    ),
  );
}

function ShortcutKeys({
  signatures,
  visible,
}: {
  signatures:
    string[];

  visible:
    boolean;
}) {
  if (
    !visible ||
    signatures.length === 0
  ) {
    return null;
  }

  return (
    <span className="roadsafe-shortcut-keys">
      {signatures.map(
        (
          signature,
          index,
        ) => (
          <span
            key={signature}
            className="roadsafe-shortcut-key-group"
          >
            {index > 0 && (
              <span className="roadsafe-shortcut-or">
                or
              </span>
            )}

            <kbd>
              {formatShortcutSignature(
                signature,
              )}
            </kbd>
          </span>
        ),
      )}
    </span>
  );
}

function definitionAvailable(
  definition:
    ShortcutDefinition,
  role:
    RoadSafeRole,
  activeCaseId:
    string | null | undefined,
  inspectorAvailable:
    boolean,
  commandPaletteEnabled:
    boolean,
): boolean {
  if (
    definition.id ===
      "command-palette" &&
    !commandPaletteEnabled
  ) {
    return false;
  }

  if (
    definition.id ===
      "toggle-inspector" &&
    !inspectorAvailable
  ) {
    return false;
  }

  switch (
    definition.scope
  ) {
    case "all":
      return true;

    case "station":
      return (
        role ===
          "supervisor" ||
        role ===
          "station_admin"
      );

    case "admin":
      return (
        role ===
        "station_admin"
      );

    case "active-case":
      return Boolean(
        activeCaseId,
      );
  }
}

export default function AppShortcutManager({
  role,
  homePath,
  activeCaseId,
  inspectorAvailable,
  onToggleNavigation,
  onToggleInspector,
}: AppShortcutManagerProps) {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [
    settings,
    setSettings,
  ] = useState<RoadSafeAppSettings>(
    () =>
      readRoadSafeSettings(),
  );

  const [
    paletteOpen,
    setPaletteOpen,
  ] = useState(false);

  const [
    helpOpen,
    setHelpOpen,
  ] = useState(false);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    selectedIndex,
    setSelectedIndex,
  ] = useState(0);

  const inputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  useEffect(
    () =>
      subscribeRoadSafeSettings(
        setSettings,
      ),
    [],
  );

  function runById(
    id: string,
  ): void {
    switch (id) {
      case "command-palette":
        setHelpOpen(false);
        setPaletteOpen(true);
        return;

      case "shortcut-reference":
        setPaletteOpen(false);
        setHelpOpen(true);
        return;

      case "home":
        navigate(homePath);
        return;

      case "cases":
        navigate("/cases");
        return;

      case "new-case":
        navigate(
          "/cases/new",
        );
        return;

      case "scene-map":
        navigate(
          "/scene-map",
        );
        return;

      case "evidence":
        navigate(
          "/evidence",
        );
        return;

      case "reconstruction":
        navigate(
          "/reconstruction",
        );
        return;

      case "footage":
        navigate(
          "/footage",
        );
        return;

      case "reports":
        navigate(
          "/reports",
        );
        return;

      case "analytics":
        navigate(
          "/analytics",
        );
        return;

      case "settings":
        navigate(
          "/settings",
        );
        return;

      case "officers":
        navigate(
          "/officers",
        );
        return;

      case "toggle-navigation":
        onToggleNavigation();
        return;

      case "toggle-inspector":
        onToggleInspector();
        return;

      case "previous-roadSafe-tab":
        dispatchTabCommand(
          "previous",
        );
        return;

      case "next-roadSafe-tab":
        dispatchTabCommand(
          "next",
        );
        return;

      case "close-roadSafe-tab":
        dispatchTabCommand(
          "close",
        );
        return;
    }

    if (!activeCaseId) {
      return;
    }

    const base =
      `/cases/${activeCaseId}`;

    switch (id) {
      case "active-case":
        navigate(base);
        return;

      case "active-case-edit":
        navigate(
          `${base}/edit`,
        );
        return;

      case "active-reconstruction":
        navigate(
          `${base}/reconstruction`,
        );
        return;

      case "active-ar":
        navigate(
          `${base}/reconstruction/ar`,
        );
        return;

      case "active-report":
        navigate(
          `${base}/report`,
        );
        return;

      case "active-footage":
        navigate(
          `${base}/footage`,
        );
        return;
    }
  }

  const commands:
    ShortcutCommand[] =
    SHORTCUT_DEFINITIONS
      .filter(
        (definition) =>
          definitionAvailable(
            definition,
            role,
            activeCaseId,
            inspectorAvailable,
            settings.shortcuts
              .commandPaletteEnabled,
          ),
      )
      .map(
        (definition) => ({
          definition,

          signatures:
            getEffectiveShortcutSignatures(
              definition,
              settings.shortcuts
                .overrides,
            ),

          run: () =>
            runById(
              definition.id,
            ),
        }),
      );

  const filteredCommands =
    commands.filter(
      (command) => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        if (!normalized) {
          return true;
        }

        return [
          command.definition
            .label,
          command.definition
            .description,
          command.definition
            .category,
          ...command.definition
            .keywords,
        ]
          .join(" ")
          .toLowerCase()
          .includes(
            normalized,
          );
      },
    );

  const groupedCommands =
    (
      [
        "Application",
        "Navigation",
        "Active case",
        "Workspace",
        "Tabs",
      ] as ShortcutCategory[]
    )
      .map((category) => ({
        category,

        commands:
          commands.filter(
            (command) =>
              command.definition
                .category ===
              category,
          ),
      }))
      .filter(
        (group) =>
          group.commands.length >
          0,
      );

  useEffect(() => {
    if (!paletteOpen) {
      return;
    }

    setQuery("");
    setSelectedIndex(0);

    window.setTimeout(
      () => {
        inputRef.current
          ?.focus();
      },
      0,
    );
  }, [paletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleShortcutUi(
      event: Event,
    ): void {
      const detail =
        (
          event as
            CustomEvent<{
              view?:
                | "palette"
                | "help";
            }>
        ).detail;

      if (
        detail?.view ===
        "palette"
      ) {
        if (
          settings.shortcuts
            .commandPaletteEnabled
        ) {
          setHelpOpen(false);
          setPaletteOpen(true);
        }

        return;
      }

      if (
        detail?.view ===
        "help"
      ) {
        setPaletteOpen(false);
        setHelpOpen(true);
      }
    }

    window.addEventListener(
      "roadsafe:shortcut-ui",
      handleShortcutUi,
    );

    return () => {
      window.removeEventListener(
        "roadsafe:shortcut-ui",
        handleShortcutUi,
      );
    };
  }, [
    settings.shortcuts
      .commandPaletteEnabled,
  ]);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      if (
        event.key ===
          "Escape" &&
        (
          paletteOpen ||
          helpOpen
        )
      ) {
        event.preventDefault();

        setPaletteOpen(false);
        setHelpOpen(false);

        return;
      }

      if (
        !settings.shortcuts
          .enabled
      ) {
        return;
      }

      const signature =
        shortcutSignatureFromEvent(
          event,
        );

      if (!signature) {
        return;
      }

      const command =
        commands.find(
          (item) =>
            item.signatures
              .includes(
                signature,
              ),
        );

      if (!command) {
        return;
      }

      const applicationCommand =
        command.definition
          .category ===
        "Application";

      if (
        isEditableTarget(
          event.target,
        ) &&
        !applicationCommand
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      command.run();

      if (
        command.definition.id !==
          "command-palette" &&
        command.definition.id !==
          "shortcut-reference"
      ) {
        setPaletteOpen(false);
      }
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
    activeCaseId,
    commands,
    helpOpen,
    paletteOpen,
    settings.shortcuts
      .enabled,
  ]);

  function executeCommand(
    command:
      ShortcutCommand,
  ): void {
    setPaletteOpen(false);
    setHelpOpen(false);

    command.run();
  }

  function handlePaletteKeyDown(
    event:
      ReactKeyboardEvent<HTMLInputElement>,
  ): void {
    if (
      event.key ===
      "ArrowDown"
    ) {
      event.preventDefault();

      setSelectedIndex(
        (index) =>
          Math.min(
            filteredCommands.length -
              1,
            index + 1,
          ),
      );

      return;
    }

    if (
      event.key ===
      "ArrowUp"
    ) {
      event.preventDefault();

      setSelectedIndex(
        (index) =>
          Math.max(
            0,
            index - 1,
          ),
      );

      return;
    }

    if (
      event.key ===
      "Enter"
    ) {
      const command =
        filteredCommands[
          selectedIndex
        ];

      if (!command) {
        return;
      }

      event.preventDefault();

      executeCommand(
        command,
      );
    }
  }

  return (
    <>
      {paletteOpen && (
        <div
          className="roadsafe-command-layer"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setPaletteOpen(false);
            }
          }}
        >
          <section
            className="roadsafe-command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="RoadSafe command palette"
          >
            <header className="roadsafe-command-header">
              <div>
                <span>
                  RoadSafe AR
                </span>

                <strong>
                  Command Palette
                </strong>
              </div>

              <button
                type="button"
                className="ui-icon-button"
                onClick={() =>
                  setPaletteOpen(false)
                }
                aria-label="Close command palette"
              >
                <X
                  size={15}
                />
              </button>
            </header>

            <div className="roadsafe-command-search">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(
                  event,
                ) =>
                  setQuery(
                    event.target.value,
                  )
                }
                onKeyDown={
                  handlePaletteKeyDown
                }
                placeholder="Search commands, pages, cases..."
                aria-label="Search RoadSafe commands"
              />

              <kbd>
                Esc
              </kbd>
            </div>

            <div className="roadsafe-command-results">
              {filteredCommands.length ===
              0 ? (
                <div className="roadsafe-command-empty">
                  No matching RoadSafe command.
                </div>
              ) : (
                filteredCommands.map(
                  (
                    command,
                    index,
                  ) => (
                    <button
                      key={
                        command.definition
                          .id
                      }
                      type="button"
                      className={`roadsafe-command-result ${
                        selectedIndex ===
                        index
                          ? "is-selected"
                          : ""
                      }`}
                      onMouseEnter={() =>
                        setSelectedIndex(
                          index,
                        )
                      }
                      onClick={() =>
                        executeCommand(
                          command,
                        )
                      }
                    >
                      <span className="roadsafe-command-result-copy">
                        <strong>
                          {
                            command.definition
                              .label
                          }
                        </strong>

                        <small>
                          {
                            command.definition
                              .description
                          }
                        </small>
                      </span>

                      <span className="roadsafe-command-result-meta">
                        <span>
                          {
                            command.definition
                              .category
                          }
                        </span>

                        <ShortcutKeys
                          signatures={
                            command.signatures
                          }
                          visible={
                            settings.shortcuts
                              .showHints
                          }
                        />
                      </span>
                    </button>
                  ),
                )
              )}
            </div>

            <footer className="roadsafe-command-footer">
              <span>
                Current workspace
              </span>

              <strong>
                {
                  location.pathname
                }
              </strong>
            </footer>
          </section>
        </div>
      )}

      {helpOpen && (
        <div
          className="roadsafe-shortcuts-layer"
          role="presentation"
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setHelpOpen(false);
            }
          }}
        >
          <section
            className="roadsafe-shortcuts-window"
            role="dialog"
            aria-modal="true"
            aria-label="RoadSafe keyboard shortcuts"
          >
            <header className="roadsafe-shortcuts-header">
              <div>
                <span>
                  Keyboard
                </span>

                <strong>
                  RoadSafe Shortcuts
                </strong>

                <small>
                  App-wide navigation and workspace control
                </small>
              </div>

              <button
                type="button"
                className="ui-icon-button"
                onClick={() =>
                  setHelpOpen(false)
                }
                aria-label="Close shortcut reference"
              >
                <X
                  size={15}
                />
              </button>
            </header>

            <div className="roadsafe-shortcuts-body">
              {groupedCommands.map(
                (group) => (
                  <section
                    key={
                      group.category
                    }
                    className="roadsafe-shortcuts-group"
                  >
                    <h3>
                      {
                        group.category
                      }
                    </h3>

                    <div className="roadsafe-shortcuts-list">
                      {group.commands.map(
                        (command) => (
                          <div
                            key={
                              command.definition
                                .id
                            }
                            className="roadsafe-shortcut-row"
                          >
                            <span className="roadsafe-shortcut-row-copy">
                              <strong>
                                {
                                  command.definition
                                    .label
                                }
                              </strong>

                              <small>
                                {
                                  command.definition
                                    .description
                                }
                              </small>
                            </span>

                            <ShortcutKeys
                              signatures={
                                command.signatures
                              }
                              visible={
                                settings.shortcuts
                                  .showHints
                              }
                            />
                          </div>
                        ),
                      )}
                    </div>
                  </section>
                ),
              )}
            </div>

            <footer className="roadsafe-shortcuts-footer">
              <span>
                Shortcuts are disabled while typing, except application-level help and palette commands.
              </span>

              <kbd>
                Esc
              </kbd>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}