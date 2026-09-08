import {
  useEffect,
  useMemo,
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

import type {
  RoadSafeRole,
} from "../../types/auth";

import "./AppShortcutManager.css";

type ShortcutCategory =
  | "Application"
  | "Navigation"
  | "Active case"
  | "Workspace"
  | "Tabs";

interface Accelerator {
  signature: string;
  label: string;
}

interface ShortcutCommand {
  id: string;
  label: string;
  description: string;
  category: ShortcutCategory;
  keywords: string[];
  accelerators: Accelerator[];
  run(): void;
}

interface AppShortcutManagerProps {
  role: RoadSafeRole;
  homePath: string;
  activeCaseId?: string | null;
  inspectorAvailable: boolean;
  onToggleNavigation(): void;
  onToggleInspector(): void;
}

const TAB_COMMAND_EVENT =
  "roadsafe:recent-tabs-command";

function isMacPlatform(): boolean {
  if (
    typeof navigator ===
    "undefined"
  ) {
    return false;
  }

  return /Mac|iPhone|iPad/i.test(
    navigator.platform,
  );
}

function modifierLabel(): string {
  return isMacPlatform()
    ? "Cmd"
    : "Ctrl";
}

function eventSignature(
  event: KeyboardEvent,
): string {
  const parts: string[] = [];

  if (
    event.ctrlKey ||
    event.metaKey
  ) {
    parts.push("mod");
  }

  if (event.altKey) {
    parts.push("alt");
  }

  if (event.shiftKey) {
    parts.push("shift");
  }

  parts.push(
    event.key.toLowerCase(),
  );

  return parts.join("+");
}

function isEditableTarget(
  target: EventTarget | null,
): boolean {
  if (
    !(target instanceof HTMLElement)
  ) {
    return false;
  }

  if (target.isContentEditable) {
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
  accelerators,
}: {
  accelerators: Accelerator[];
}) {
  if (accelerators.length === 0) {
    return null;
  }

  return (
    <span className="roadsafe-shortcut-keys">
      {accelerators.map(
        (accelerator, index) => (
          <span
            key={accelerator.signature}
            className="roadsafe-shortcut-key-group"
          >
            {index > 0 && (
              <span className="roadsafe-shortcut-or">
                or
              </span>
            )}

            {accelerator.label
              .split("+")
              .map((part) => (
                <kbd key={part}>
                  {part}
                </kbd>
              ))}
          </span>
        ),
      )}
    </span>
  );
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

  const mod =
    modifierLabel();

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

  const stationClient =
    role === "supervisor" ||
    role === "station_admin";

  const stationAdmin =
    role === "station_admin";

  const commands =
    useMemo<ShortcutCommand[]>(() => {
      const list: ShortcutCommand[] = [];

      const add = (
        command: ShortcutCommand,
      ) => {
        list.push(command);
      };

      add({
        id: "command-palette",
        label: "Open command palette",
        description:
          "Search every RoadSafe shortcut and destination.",
        category: "Application",
        keywords: [
          "command",
          "palette",
          "search",
          "shortcut",
        ],
        accelerators: [
          {
            signature:
              "mod+k",
            label:
              `${mod}+K`,
          },
          {
            signature:
              "mod+shift+p",
            label:
              `${mod}+Shift+P`,
          },
        ],
        run: () => {
          setHelpOpen(false);
          setPaletteOpen(true);
        },
      });

      add({
        id: "shortcut-reference",
        label: "Show keyboard shortcuts",
        description:
          "Open the complete RoadSafe shortcut reference.",
        category: "Application",
        keywords: [
          "help",
          "keyboard",
          "keys",
          "reference",
        ],
        accelerators: [
          {
            signature:
              "f1",
            label: "F1",
          },
          {
            signature:
              "shift+?",
            label: "Shift+?",
          },
        ],
        run: () => {
          setPaletteOpen(false);
          setHelpOpen(true);
        },
      });

      add({
        id: "home",
        label:
          stationClient
            ? "Station Overview"
            : "Field Home",
        description:
          "Open the assigned RoadSafe home workspace.",
        category: "Navigation",
        keywords: [
          "home",
          "station",
          "field",
          "overview",
        ],
        accelerators: [
          {
            signature:
              "alt+1",
            label: "Alt+1",
          },
        ],
        run: () =>
          navigate(homePath),
      });

      add({
        id: "cases",
        label: "Investigation Cases",
        description:
          "Open the full accident case register.",
        category: "Navigation",
        keywords: [
          "cases",
          "investigations",
          "register",
        ],
        accelerators: [
          {
            signature:
              "alt+2",
            label: "Alt+2",
          },
        ],
        run: () =>
          navigate("/cases"),
      });

      add({
        id: "new-case",
        label: "New Accident Case",
        description:
          "Start a new accident investigation record.",
        category: "Navigation",
        keywords: [
          "new",
          "case",
          "create",
          "accident",
        ],
        accelerators: [
          {
            signature:
              "alt+3",
            label: "Alt+3",
          },
          {
            signature:
              "mod+shift+n",
            label:
              `${mod}+Shift+N`,
          },
        ],
        run: () =>
          navigate("/cases/new"),
      });

      add({
        id: "scene-map",
        label: "Scene and Risk Map",
        description:
          "Open investigation locations and road-safety intelligence.",
        category: "Navigation",
        keywords: [
          "map",
          "scene",
          "risk",
          "heatmap",
        ],
        accelerators: [
          {
            signature:
              "alt+4",
            label: "Alt+4",
          },
          {
            signature:
              "mod+shift+m",
            label:
              `${mod}+Shift+M`,
          },
        ],
        run: () =>
          navigate("/scene-map"),
      });

      add({
        id: "evidence",
        label: "Evidence Register",
        description:
          "Open scene evidence and linked observations.",
        category: "Navigation",
        keywords: [
          "evidence",
          "records",
          "photos",
        ],
        accelerators: [
          {
            signature:
              "alt+5",
            label: "Alt+5",
          },
          {
            signature:
              "mod+shift+e",
            label:
              `${mod}+Shift+E`,
          },
        ],
        run: () =>
          navigate("/evidence"),
      });

      add({
        id: "reconstruction",
        label: "Reconstruction",
        description:
          "Open the reconstruction case launcher.",
        category: "Navigation",
        keywords: [
          "reconstruction",
          "simulate",
          "3d",
          "ar",
        ],
        accelerators: [
          {
            signature:
              "alt+6",
            label: "Alt+6",
          },
          {
            signature:
              "mod+shift+r",
            label:
              `${mod}+Shift+R`,
          },
        ],
        run: () =>
          navigate("/reconstruction"),
      });

      add({
        id: "footage",
        label: "Footage Library",
        description:
          "Open saved reconstruction recordings.",
        category: "Navigation",
        keywords: [
          "footage",
          "video",
          "recordings",
        ],
        accelerators: [
          {
            signature:
              "alt+7",
            label: "Alt+7",
          },
        ],
        run: () =>
          navigate("/footage"),
      });

      add({
        id: "reports",
        label: "Reports",
        description:
          "Open formal investigation outputs.",
        category: "Navigation",
        keywords: [
          "reports",
          "output",
          "documents",
        ],
        accelerators: [
          {
            signature:
              "alt+8",
            label: "Alt+8",
          },
        ],
        run: () =>
          navigate("/reports"),
      });

      if (stationClient) {
        add({
          id: "analytics",
          label: "Road-Safety Analytics",
          description:
            "Open station trends and recurring accident patterns.",
          category: "Navigation",
          keywords: [
            "analytics",
            "statistics",
            "trends",
          ],
          accelerators: [
            {
              signature:
                "alt+9",
              label: "Alt+9",
            },
          ],
          run: () =>
            navigate("/analytics"),
        });

        add({
          id: "settings",
          label: "System Settings",
          description:
            "Open RoadSafe station and workspace settings.",
          category: "Navigation",
          keywords: [
            "settings",
            "preferences",
            "system",
          ],
          accelerators: [
            {
              signature:
                "alt+0",
              label: "Alt+0",
            },
          ],
          run: () =>
            navigate("/settings"),
        });
      }

      if (stationAdmin) {
        add({
          id: "officers",
          label: "Officer Management",
          description:
            "Manage station access and investigator accounts.",
          category: "Navigation",
          keywords: [
            "officers",
            "users",
            "admin",
            "accounts",
          ],
          accelerators: [
            {
              signature:
                "alt+o",
              label: "Alt+O",
            },
          ],
          run: () =>
            navigate("/officers"),
        });
      }

      if (activeCaseId) {
        const base =
          `/cases/${activeCaseId}`;

        add({
          id: "active-case",
          label: "Open active case",
          description:
            "Jump directly to the current investigation.",
          category: "Active case",
          keywords: [
            "active",
            "case",
            "investigation",
          ],
          accelerators: [
            {
              signature:
                "alt+shift+1",
              label: "Alt+Shift+1",
            },
          ],
          run: () =>
            navigate(base),
        });

        add({
          id: "active-case-edit",
          label: "Edit active case",
          description:
            "Open the active case record for editing.",
          category: "Active case",
          keywords: [
            "active",
            "case",
            "edit",
          ],
          accelerators: [
            {
              signature:
                "alt+shift+2",
              label: "Alt+Shift+2",
            },
          ],
          run: () =>
            navigate(`${base}/edit`),
        });

        add({
          id: "active-reconstruction",
          label:
            "Active case reconstruction",
          description:
            "Open the current investigation reconstruction.",
          category: "Active case",
          keywords: [
            "active",
            "reconstruction",
            "simulation",
          ],
          accelerators: [
            {
              signature:
                "alt+shift+3",
              label: "Alt+Shift+3",
            },
          ],
          run: () =>
            navigate(
              `${base}/reconstruction`,
            ),
        });

        add({
          id: "active-ar",
          label:
            "Active case AR review",
          description:
            "Open augmented-reality reconstruction review.",
          category: "Active case",
          keywords: [
            "active",
            "ar",
            "augmented",
            "reconstruction",
          ],
          accelerators: [
            {
              signature:
                "alt+shift+4",
              label: "Alt+Shift+4",
            },
          ],
          run: () =>
            navigate(
              `${base}/reconstruction/ar`,
            ),
        });

        add({
          id: "active-report",
          label:
            "Active case report",
          description:
            "Open the formal report for the current investigation.",
          category: "Active case",
          keywords: [
            "active",
            "report",
            "findings",
          ],
          accelerators: [
            {
              signature:
                "alt+shift+5",
              label: "Alt+Shift+5",
            },
          ],
          run: () =>
            navigate(
              `${base}/report`,
            ),
        });

        add({
          id: "active-footage",
          label:
            "Active case footage",
          description:
            "Open recordings for the current investigation.",
          category: "Active case",
          keywords: [
            "active",
            "footage",
            "video",
          ],
          accelerators: [
            {
              signature:
                "alt+shift+6",
              label: "Alt+Shift+6",
            },
          ],
          run: () =>
            navigate(
              `${base}/footage`,
            ),
        });
      }

      add({
        id: "toggle-navigation",
        label: "Toggle navigation",
        description:
          "Collapse or expand the RoadSafe navigation rail.",
        category: "Workspace",
        keywords: [
          "sidebar",
          "navigation",
          "collapse",
        ],
        accelerators: [
          {
            signature:
              "mod+b",
            label:
              `${mod}+B`,
          },
        ],
        run:
          onToggleNavigation,
      });

      if (inspectorAvailable) {
        add({
          id: "toggle-inspector",
          label: "Toggle inspector",
          description:
            "Show or hide the active workspace inspector.",
          category: "Workspace",
          keywords: [
            "inspector",
            "panel",
            "details",
          ],
          accelerators: [
            {
              signature:
                "mod+i",
              label:
                `${mod}+I`,
            },
          ],
          run:
            onToggleInspector,
        });
      }

      add({
        id: "previous-roadSafe-tab",
        label:
          "Previous RoadSafe tab",
        description:
          "Move to the previous tab in the RoadSafe tab rail.",
        category: "Tabs",
        keywords: [
          "tab",
          "previous",
          "back",
        ],
        accelerators: [
          {
            signature:
              "alt+[",
            label: "Alt+[",
          },
        ],
        run: () =>
          dispatchTabCommand(
            "previous",
          ),
      });

      add({
        id: "next-roadSafe-tab",
        label:
          "Next RoadSafe tab",
        description:
          "Move to the next tab in the RoadSafe tab rail.",
        category: "Tabs",
        keywords: [
          "tab",
          "next",
          "forward",
        ],
        accelerators: [
          {
            signature:
              "alt+]",
            label: "Alt+]",
          },
        ],
        run: () =>
          dispatchTabCommand(
            "next",
          ),
      });

      add({
        id: "close-roadSafe-tab",
        label:
          "Close active RoadSafe tab",
        description:
          "Close only the active in-app workspace tab.",
        category: "Tabs",
        keywords: [
          "tab",
          "close",
          "workspace",
        ],
        accelerators: [
          {
            signature:
              "alt+shift+w",
            label: "Alt+Shift+W",
          },
        ],
        run: () =>
          dispatchTabCommand(
            "close",
          ),
      });

      return list;
    }, [
      activeCaseId,
      homePath,
      inspectorAvailable,
      mod,
      navigate,
      onToggleInspector,
      onToggleNavigation,
      stationAdmin,
      stationClient,
    ]);

  const filteredCommands =
    useMemo(() => {
      const normalized =
        query
          .trim()
          .toLowerCase();

      if (!normalized) {
        return commands;
      }

      return commands.filter(
        (command) => {
          const haystack = [
            command.label,
            command.description,
            command.category,
            ...command.keywords,
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(
            normalized,
          );
        },
      );
    }, [
      commands,
      query,
    ]);

  const groupedCommands =
    useMemo(() => {
      const categories:
        ShortcutCategory[] = [
          "Application",
          "Navigation",
          "Active case",
          "Workspace",
          "Tabs",
        ];

      return categories
        .map((category) => ({
          category,
          commands:
            commands.filter(
              (command) =>
                command.category ===
                category,
            ),
        }))
        .filter(
          (group) =>
            group.commands.length >
            0,
        );
    }, [commands]);

  useEffect(() => {
    if (!paletteOpen) {
      return;
    }

    setQuery("");
    setSelectedIndex(0);

    window.setTimeout(
      () => {
        inputRef.current?.focus();
      },
      0,
    );
  }, [paletteOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent,
    ): void {
      if (
        event.key === "Escape" &&
        (paletteOpen ||
          helpOpen)
      ) {
        event.preventDefault();
        setPaletteOpen(false);
        setHelpOpen(false);
        return;
      }

      const signature =
        eventSignature(event);

      const command =
        commands.find(
          (item) =>
            item.accelerators.some(
              (accelerator) =>
                accelerator.signature ===
                signature,
            ),
        );

      if (!command) {
        return;
      }

      const applicationCommand =
        command.category ===
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
        command.id !==
          "command-palette" &&
        command.id !==
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
    commands,
    helpOpen,
    paletteOpen,
  ]);

  function runCommand(
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
      runCommand(command);
    }
  }

  return (
    <>
      {paletteOpen && (
        <div
          className="roadsafe-command-layer"
          role="presentation"
          onMouseDown={(event) => {
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
                onChange={(event) =>
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
                        command.id
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
                        runCommand(
                          command,
                        )
                      }
                    >
                      <span className="roadsafe-command-result-copy">
                        <strong>
                          {
                            command.label
                          }
                        </strong>

                        <small>
                          {
                            command.description
                          }
                        </small>
                      </span>

                      <span className="roadsafe-command-result-meta">
                        <span>
                          {
                            command.category
                          }
                        </span>

                        <ShortcutKeys
                          accelerators={
                            command.accelerators
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
          onMouseDown={(event) => {
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
                              command.id
                            }
                            className="roadsafe-shortcut-row"
                          >
                            <span className="roadsafe-shortcut-row-copy">
                              <strong>
                                {
                                  command.label
                                }
                              </strong>

                              <small>
                                {
                                  command.description
                                }
                              </small>
                            </span>

                            <ShortcutKeys
                              accelerators={
                                command.accelerators
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
                Shortcuts are disabled while typing, except the command palette and help keys.
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