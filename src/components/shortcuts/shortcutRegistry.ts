export type ShortcutCategory =
  | "Application"
  | "Navigation"
  | "Active case"
  | "Workspace"
  | "Tabs";

export type ShortcutScope =
  | "all"
  | "station"
  | "admin"
  | "active-case";

export interface ShortcutDefinition {
  id: string;
  label: string;
  description: string;
  category:
    ShortcutCategory;
  scope:
    ShortcutScope;
  keywords: string[];
  defaultSignatures:
    string[];
}

export const SHORTCUT_DEFINITIONS:
  ShortcutDefinition[] = [
    {
      id:
        "command-palette",
      label:
        "Open command palette",
      description:
        "Search RoadSafe commands and destinations.",
      category:
        "Application",
      scope:
        "all",
      keywords: [
        "command",
        "palette",
        "search",
      ],
      defaultSignatures: [
        "mod+k",
        "mod+shift+p",
      ],
    },
    {
      id:
        "shortcut-reference",
      label:
        "Show keyboard shortcuts",
      description:
        "Open the complete RoadSafe shortcut reference.",
      category:
        "Application",
      scope:
        "all",
      keywords: [
        "help",
        "keyboard",
        "reference",
      ],
      defaultSignatures: [
        "f1",
        "shift+?",
      ],
    },
    {
      id: "home",
      label: "Home workspace",
      description:
        "Open Station Overview or Field Home.",
      category:
        "Navigation",
      scope: "all",
      keywords: [
        "home",
        "station",
        "field",
      ],
      defaultSignatures: [
        "alt+1",
      ],
    },
    {
      id: "cases",
      label:
        "Investigation Cases",
      description:
        "Open the accident case register.",
      category:
        "Navigation",
      scope: "all",
      keywords: [
        "cases",
        "investigations",
      ],
      defaultSignatures: [
        "alt+2",
      ],
    },
    {
      id: "new-case",
      label:
        "New Accident Case",
      description:
        "Start a new investigation record.",
      category:
        "Navigation",
      scope: "all",
      keywords: [
        "new",
        "case",
        "create",
      ],
      defaultSignatures: [
        "alt+3",
        "mod+shift+n",
      ],
    },
    {
      id: "scene-map",
      label:
        "Scene and Risk Map",
      description:
        "Open scene locations and road-safety intelligence.",
      category:
        "Navigation",
      scope: "all",
      keywords: [
        "map",
        "scene",
        "risk",
      ],
      defaultSignatures: [
        "alt+4",
        "mod+shift+m",
      ],
    },
    {
      id: "evidence",
      label:
        "Evidence Register",
      description:
        "Open evidence and linked observations.",
      category:
        "Navigation",
      scope: "all",
      keywords: [
        "evidence",
        "records",
      ],
      defaultSignatures: [
        "alt+5",
        "mod+shift+e",
      ],
    },
    {
      id: "reconstruction",
      label:
        "Reconstruction",
      description:
        "Open the reconstruction case launcher.",
      category:
        "Navigation",
      scope: "all",
      keywords: [
        "reconstruction",
        "simulation",
      ],
      defaultSignatures: [
        "alt+6",
        "mod+shift+r",
      ],
    },
    {
      id: "footage",
      label:
        "Footage Library",
      description:
        "Open saved reconstruction recordings.",
      category:
        "Navigation",
      scope: "all",
      keywords: [
        "footage",
        "video",
      ],
      defaultSignatures: [
        "alt+7",
      ],
    },
    {
      id: "reports",
      label:
        "Reports",
      description:
        "Open formal investigation outputs.",
      category:
        "Navigation",
      scope: "all",
      keywords: [
        "reports",
        "documents",
      ],
      defaultSignatures: [
        "alt+8",
      ],
    },
    {
      id: "analytics",
      label:
        "Road-Safety Analytics",
      description:
        "Open station analytics and recurring patterns.",
      category:
        "Navigation",
      scope:
        "station",
      keywords: [
        "analytics",
        "statistics",
      ],
      defaultSignatures: [
        "alt+9",
      ],
    },
    {
      id: "settings",
      label:
        "System Settings",
      description:
        "Open RoadSafe settings.",
      category:
        "Navigation",
      scope:
        "station",
      keywords: [
        "settings",
        "preferences",
      ],
      defaultSignatures: [
        "alt+0",
      ],
    },
    {
      id: "officers",
      label:
        "Officer Management",
      description:
        "Manage station access and investigator accounts.",
      category:
        "Navigation",
      scope:
        "admin",
      keywords: [
        "officers",
        "admin",
        "accounts",
      ],
      defaultSignatures: [
        "alt+o",
      ],
    },
    {
      id:
        "active-case",
      label:
        "Open active case",
      description:
        "Jump to the current investigation.",
      category:
        "Active case",
      scope:
        "active-case",
      keywords: [
        "active",
        "case",
      ],
      defaultSignatures: [
        "alt+shift+1",
      ],
    },
    {
      id:
        "active-case-edit",
      label:
        "Edit active case",
      description:
        "Open the current case record for editing.",
      category:
        "Active case",
      scope:
        "active-case",
      keywords: [
        "active",
        "edit",
      ],
      defaultSignatures: [
        "alt+shift+2",
      ],
    },
    {
      id:
        "active-reconstruction",
      label:
        "Active case reconstruction",
      description:
        "Open reconstruction for the current investigation.",
      category:
        "Active case",
      scope:
        "active-case",
      keywords: [
        "active",
        "reconstruction",
      ],
      defaultSignatures: [
        "alt+shift+3",
      ],
    },
    {
      id: "active-ar",
      label:
        "Active case AR review",
      description:
        "Open AR reconstruction review for the active case.",
      category:
        "Active case",
      scope:
        "active-case",
      keywords: [
        "active",
        "ar",
      ],
      defaultSignatures: [
        "alt+shift+4",
      ],
    },
    {
      id:
        "active-report",
      label:
        "Active case report",
      description:
        "Open the report for the current investigation.",
      category:
        "Active case",
      scope:
        "active-case",
      keywords: [
        "active",
        "report",
      ],
      defaultSignatures: [
        "alt+shift+5",
      ],
    },
    {
      id:
        "active-footage",
      label:
        "Active case footage",
      description:
        "Open footage for the current investigation.",
      category:
        "Active case",
      scope:
        "active-case",
      keywords: [
        "active",
        "footage",
      ],
      defaultSignatures: [
        "alt+shift+6",
      ],
    },
    {
      id:
        "toggle-navigation",
      label:
        "Toggle navigation",
      description:
        "Collapse or expand the RoadSafe navigation rail.",
      category:
        "Workspace",
      scope: "all",
      keywords: [
        "navigation",
        "sidebar",
      ],
      defaultSignatures: [
        "mod+b",
      ],
    },
    {
      id:
        "toggle-inspector",
      label:
        "Toggle inspector",
      description:
        "Show or hide the workspace inspector.",
      category:
        "Workspace",
      scope: "all",
      keywords: [
        "inspector",
        "panel",
      ],
      defaultSignatures: [
        "mod+i",
      ],
    },
    {
      id:
        "previous-roadSafe-tab",
      label:
        "Previous RoadSafe tab",
      description:
        "Move to the previous in-app workspace tab.",
      category:
        "Tabs",
      scope: "all",
      keywords: [
        "tab",
        "previous",
      ],
      defaultSignatures: [
        "alt+[",
      ],
    },
    {
      id:
        "next-roadSafe-tab",
      label:
        "Next RoadSafe tab",
      description:
        "Move to the next in-app workspace tab.",
      category:
        "Tabs",
      scope: "all",
      keywords: [
        "tab",
        "next",
      ],
      defaultSignatures: [
        "alt+]",
      ],
    },
    {
      id:
        "close-roadSafe-tab",
      label:
        "Close active RoadSafe tab",
      description:
        "Close the active in-app workspace tab.",
      category:
        "Tabs",
      scope: "all",
      keywords: [
        "tab",
        "close",
      ],
      defaultSignatures: [
        "alt+shift+w",
      ],
    },
  ];

export function isMacPlatform():
  boolean {
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

export function formatShortcutSignature(
  signature: string,
): string {
  const isMac =
    isMacPlatform();

  return signature
    .split("+")
    .map((part) => {
      switch (part) {
        case "mod":
          return isMac
            ? "Cmd"
            : "Ctrl";

        case "alt":
          return isMac
            ? "Option"
            : "Alt";

        case "shift":
          return "Shift";

        case "control":
          return "Ctrl";

        case "meta":
          return isMac
            ? "Cmd"
            : "Meta";

        default:
          if (
            part.length === 1
          ) {
            return part
              .toUpperCase();
          }

          return (
            part.charAt(0)
              .toUpperCase() +
            part.slice(1)
          );
      }
    })
    .join("+");
}

export function shortcutSignatureFromEvent(
  event: KeyboardEvent,
): string | null {
  const rawKey =
    event.key.toLowerCase();

  if (
    rawKey === "control" ||
    rawKey === "shift" ||
    rawKey === "alt" ||
    rawKey === "meta"
  ) {
    return null;
  }

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

  parts.push(rawKey);

  return parts.join("+");
}

export function getEffectiveShortcutSignatures(
  definition:
    ShortcutDefinition,
  overrides:
    Record<string, string>,
): string[] {
  const override =
    overrides[
      definition.id
    ];

  if (override) {
    return [
      override,
    ];
  }

  return [
    ...definition
      .defaultSignatures,
  ];
}