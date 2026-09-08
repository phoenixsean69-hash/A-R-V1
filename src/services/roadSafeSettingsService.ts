export type RoadSafeDensity =
  | "comfortable"
  | "compact";

export interface RoadSafeWorkspaceSettings {
  navigationCollapsed: boolean;
  inspectorOpen: boolean;
  inspectorDocked: boolean;
  density: RoadSafeDensity;
  reduceMotion: boolean;
}

export interface RoadSafeSafetySettings {
  confirmDestructiveActions: boolean;
}

export interface RoadSafeShortcutSettings {
  enabled: boolean;
  commandPaletteEnabled: boolean;
  showHints: boolean;
  overrides: Record<
    string,
    string
  >;
}

export interface RoadSafeAppSettings {
  workspace:
    RoadSafeWorkspaceSettings;

  safety:
    RoadSafeSafetySettings;

  shortcuts:
    RoadSafeShortcutSettings;
}

export interface RoadSafeStorageSummary {
  keyCount: number;
  approximateBytes: number;
  keys: string[];
}

const STORAGE_KEY =
  "roadsafe:app-settings-v1";

const SETTINGS_EVENT =
  "roadsafe:app-settings-changed";

const LEGACY_NAVIGATION_KEY =
  "roadsafe:navigation-collapsed";

const LEGACY_INSPECTOR_OPEN_KEY =
  "roadsafe:inspector-open";

const LEGACY_INSPECTOR_DOCKED_KEY =
  "roadsafe:inspector-docked";

export const DEFAULT_ROADSAFE_SETTINGS:
  RoadSafeAppSettings = {
    workspace: {
      navigationCollapsed: false,
      inspectorOpen: true,
      inspectorDocked: true,
      density: "comfortable",
      reduceMotion: false,
    },

    safety: {
      confirmDestructiveActions: true,
    },

    shortcuts: {
      enabled: true,
      commandPaletteEnabled: true,
      showHints: true,
      overrides: {},
    },
  };

function cloneDefaults():
  RoadSafeAppSettings {
  return {
    workspace: {
      ...DEFAULT_ROADSAFE_SETTINGS
        .workspace,
    },

    safety: {
      ...DEFAULT_ROADSAFE_SETTINGS
        .safety,
    },

    shortcuts: {
      ...DEFAULT_ROADSAFE_SETTINGS
        .shortcuts,

      overrides: {},
    },
  };
}

function readLegacyBoolean(
  key: string,
  fallback: boolean,
): boolean {
  if (
    typeof window ===
    "undefined"
  ) {
    return fallback;
  }

  try {
    const value =
      window.localStorage
        .getItem(key);

    if (value === null) {
      return fallback;
    }

    return value === "true";
  } catch {
    return fallback;
  }
}

function normalizeSettings(
  value:
    | Partial<RoadSafeAppSettings>
    | null
    | undefined,
): RoadSafeAppSettings {
  const defaults =
    cloneDefaults();

  const workspace =
    value?.workspace;

  const safety =
    value?.safety;

  const shortcuts =
    value?.shortcuts;

  return {
    workspace: {
      navigationCollapsed:
        typeof workspace
          ?.navigationCollapsed ===
        "boolean"
          ? workspace
              .navigationCollapsed
          : defaults.workspace
              .navigationCollapsed,

      inspectorOpen:
        typeof workspace
          ?.inspectorOpen ===
        "boolean"
          ? workspace
              .inspectorOpen
          : defaults.workspace
              .inspectorOpen,

      inspectorDocked:
        typeof workspace
          ?.inspectorDocked ===
        "boolean"
          ? workspace
              .inspectorDocked
          : defaults.workspace
              .inspectorDocked,

      density:
        workspace?.density ===
        "compact"
          ? "compact"
          : "comfortable",

      reduceMotion:
        typeof workspace
          ?.reduceMotion ===
        "boolean"
          ? workspace
              .reduceMotion
          : defaults.workspace
              .reduceMotion,
    },

    safety: {
      confirmDestructiveActions:
        typeof safety
          ?.confirmDestructiveActions ===
        "boolean"
          ? safety
              .confirmDestructiveActions
          : defaults.safety
              .confirmDestructiveActions,
    },

    shortcuts: {
      enabled:
        typeof shortcuts?.enabled ===
        "boolean"
          ? shortcuts.enabled
          : defaults.shortcuts
              .enabled,

      commandPaletteEnabled:
        typeof shortcuts
          ?.commandPaletteEnabled ===
        "boolean"
          ? shortcuts
              .commandPaletteEnabled
          : defaults.shortcuts
              .commandPaletteEnabled,

      showHints:
        typeof shortcuts
          ?.showHints ===
        "boolean"
          ? shortcuts.showHints
          : defaults.shortcuts
              .showHints,

      overrides:
        shortcuts?.overrides &&
        typeof shortcuts
          .overrides ===
          "object"
          ? {
              ...shortcuts
                .overrides,
            }
          : {},
    },
  };
}

function applyDocumentPreferences(
  settings:
    RoadSafeAppSettings,
): void {
  if (
    typeof document ===
    "undefined"
  ) {
    return;
  }

  document.documentElement
    .dataset
    .roadsafeDensity =
    settings.workspace.density;

  document.documentElement
    .dataset
    .roadsafeReduceMotion =
    settings.workspace.reduceMotion
      ? "true"
      : "false";
}

function syncLegacyWorkspaceKeys(
  settings:
    RoadSafeAppSettings,
): void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.setItem(
      LEGACY_NAVIGATION_KEY,
      String(
        settings.workspace
          .navigationCollapsed,
      ),
    );

    window.localStorage.setItem(
      LEGACY_INSPECTOR_OPEN_KEY,
      String(
        settings.workspace
          .inspectorOpen,
      ),
    );

    window.localStorage.setItem(
      LEGACY_INSPECTOR_DOCKED_KEY,
      String(
        settings.workspace
          .inspectorDocked,
      ),
    );
  } catch {
    // Browser preference persistence is non-critical.
  }
}

export function readRoadSafeSettings():
  RoadSafeAppSettings {
  let parsed:
    Partial<RoadSafeAppSettings>
    | null = null;

  if (
    typeof window !==
    "undefined"
  ) {
    try {
      const raw =
        window.localStorage
          .getItem(
            STORAGE_KEY,
          );

      if (raw) {
        parsed =
          JSON.parse(raw) as
            Partial<RoadSafeAppSettings>;
      }
    } catch {
      parsed = null;
    }
  }

  const settings =
    normalizeSettings(parsed);

  /*
   * Existing AppShell preferences pre-date this settings service.
   * Reading them here keeps older installs and current shell state in sync.
   */
  settings.workspace
    .navigationCollapsed =
    readLegacyBoolean(
      LEGACY_NAVIGATION_KEY,
      settings.workspace
        .navigationCollapsed,
    );

  settings.workspace
    .inspectorOpen =
    readLegacyBoolean(
      LEGACY_INSPECTOR_OPEN_KEY,
      settings.workspace
        .inspectorOpen,
    );

  settings.workspace
    .inspectorDocked =
    readLegacyBoolean(
      LEGACY_INSPECTOR_DOCKED_KEY,
      settings.workspace
        .inspectorDocked,
    );

  applyDocumentPreferences(
    settings,
  );

  return settings;
}

export function writeRoadSafeSettings(
  settings:
    RoadSafeAppSettings,
): RoadSafeAppSettings {
  const normalized =
    normalizeSettings(
      settings,
    );

  if (
    typeof window !==
    "undefined"
  ) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          normalized,
        ),
      );
    } catch {
      // Browser preference persistence is non-critical.
    }

    syncLegacyWorkspaceKeys(
      normalized,
    );
  }

  applyDocumentPreferences(
    normalized,
  );

  if (
    typeof window !==
    "undefined"
  ) {
    window.dispatchEvent(
      new CustomEvent(
        SETTINGS_EVENT,
        {
          detail:
            normalized,
        },
      ),
    );
  }

  return normalized;
}

export function updateRoadSafeSettings(
  updater:
    | RoadSafeAppSettings
    | ((
        current:
          RoadSafeAppSettings,
      ) =>
        RoadSafeAppSettings),
): RoadSafeAppSettings {
  const current =
    readRoadSafeSettings();

  const next =
    typeof updater ===
    "function"
      ? updater(current)
      : updater;

  return writeRoadSafeSettings(
    next,
  );
}

export function resetRoadSafeSettings():
  RoadSafeAppSettings {
  return writeRoadSafeSettings(
    cloneDefaults(),
  );
}

export function subscribeRoadSafeSettings(
  listener: (
    settings:
      RoadSafeAppSettings,
  ) => void,
): () => void {
  if (
    typeof window ===
    "undefined"
  ) {
    return () => {};
  }

  const handler = (
    event: Event,
  ) => {
    const detail =
      (
        event as
          CustomEvent<
            RoadSafeAppSettings
          >
      ).detail;

    listener(
      detail ??
        readRoadSafeSettings(),
    );
  };

  window.addEventListener(
    SETTINGS_EVENT,
    handler,
  );

  return () => {
    window.removeEventListener(
      SETTINGS_EVENT,
      handler,
    );
  };
}

function isRoadSafeStorageKey(
  key: string,
): boolean {
  const normalized =
    key.toLowerCase();

  return (
    normalized.startsWith(
      "roadsafe",
    ) ||
    normalized.startsWith(
      "road-safe",
    )
  );
}

export function getRoadSafeStorageSummary():
  RoadSafeStorageSummary {
  if (
    typeof window ===
    "undefined"
  ) {
    return {
      keyCount: 0,
      approximateBytes: 0,
      keys: [],
    };
  }

  const keys: string[] = [];
  let approximateBytes = 0;

  try {
    for (
      let index = 0;
      index <
      window.localStorage.length;
      index += 1
    ) {
      const key =
        window.localStorage.key(
          index,
        );

      if (
        !key ||
        !isRoadSafeStorageKey(
          key,
        )
      ) {
        continue;
      }

      const value =
        window.localStorage
          .getItem(key) ??
        "";

      keys.push(key);

      approximateBytes +=
        (
          key.length +
          value.length
        ) *
        2;
    }
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }

  return {
    keyCount:
      keys.length,

    approximateBytes,

    keys:
      keys.sort(),
  };
}

export function clearRoadSafeLocalData():
  void {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const keysToRemove:
    string[] = [];

  try {
    for (
      let index = 0;
      index <
      window.localStorage.length;
      index += 1
    ) {
      const key =
        window.localStorage.key(
          index,
        );

      if (
        key &&
        isRoadSafeStorageKey(
          key,
        )
      ) {
        keysToRemove.push(
          key,
        );
      }
    }

    keysToRemove.forEach(
      (key) => {
        window.localStorage
          .removeItem(key);
      },
    );
  } catch {
    // Best-effort local cleanup only.
  }
}

export function formatStorageBytes(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(2)} MB`;
}