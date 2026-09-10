import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Outlet,
  useLocation,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { WorkspaceDataService } from "../../services/workspaceDataService";
import {
  readRoadSafeSettings,
  subscribeRoadSafeSettings,
  updateRoadSafeSettings,
} from "../../services/roadSafeSettingsService";
import {
  isStationRole,
} from "../../types/auth";

import AppShortcutManager from "../shortcuts/AppShortcutManager";
import RoadSafeGlobalDock from "./RoadSafeGlobalDock";
import "../settings/SettingsRuntime.css";
import "../../styles/iconFirstUI.css";

function pageMeta(
  pathname: string,
): [string, string] {
  if (pathname === "/field") {
    return [
      "Field Operations",
      "Capture, verify and prepare accident-scene information",
    ];
  }

  if (pathname === "/station") {
    return [
      "Station Overview",
      "Monitor investigations, workload and road-safety activity",
    ];
  }

  if (pathname.startsWith("/cases/new")) {
    return [
      "New Accident Case",
      "Create the investigation record and define its scene context",
    ];
  }

  if (
    pathname.endsWith(
      "/reconstruction/ar",
    )
  ) {
    return [
      "AR Reconstruction Review",
      "Align and inspect the reconstruction against the real scene",
    ];
  }

  if (
    pathname.includes(
      "/reconstruction",
    )
  ) {
    return [
      "Accident Reconstruction",
      "Build, simulate and validate the collision sequence",
    ];
  }

  if (pathname.includes("/report")) {
    return [
      "Investigation Report",
      "Review findings, assumptions and supporting evidence",
    ];
  }

  if (pathname.includes("/footage")) {
    return [
      "Reconstruction Footage",
      "Review captured reconstruction playback and exports",
    ];
  }

  if (pathname.startsWith("/cases/")) {
    return [
      "Case Workspace",
      "Investigation details, evidence, reconstruction and review status",
    ];
  }

  if (pathname === "/cases") {
    return [
      "Investigation Cases",
      "Manage active, reviewed and archived accident investigations",
    ];
  }

  if (pathname === "/scene-map") {
    return [
      "Scene and Risk Map",
      "Review investigation locations and road-safety intelligence",
    ];
  }

  if (pathname === "/evidence") {
    return [
      "Evidence Register",
      "Inspect scene records, media and linked observations",
    ];
  }

  if (pathname === "/reports") {
    return [
      "Reports",
      "Open generated investigation packages and formal outputs",
    ];
  }

  if (pathname === "/footage") {
    return [
      "Footage Library",
      "Access saved reconstruction recordings",
    ];
  }

  if (pathname === "/analytics") {
    return [
      "Road-Safety Analytics",
      "Review operational trends and recurring accident patterns",
    ];
  }

  if (pathname === "/officers") {
    return [
      "Officer Management",
      "Manage station access, roles and investigator accounts",
    ];
  }

  if (pathname === "/settings") {
    return [
      "System Settings",
      "Configure station and reconstruction workspace preferences",
    ];
  }

  return [
    "RoadSafe AR",
    "Professional accident investigation and reconstruction workspace",
  ];
}

function readStoredBoolean(
  key: string,
  fallback: boolean,
): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value =
      window.localStorage.getItem(key);

    if (value === null) {
      return fallback;
    }

    return value === "true";
  } catch {
    return fallback;
  }
}

export default function AppShell() {
  const auth = useAuth();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] =
    useState(false);

  const [
    desktopCollapsed,
    setDesktopCollapsed,
  ] = useState(() =>
    readStoredBoolean(
      "roadsafe:navigation-collapsed",
      false,
    ),
  );

  const [
    inspectorOpen,
    setInspectorOpen,
  ] = useState(() =>
    readStoredBoolean(
      "roadsafe:inspector-open",
      true,
    ),
  );

  const [
    inspectorDocked,
    setInspectorDocked,
  ] = useState(() =>
    readStoredBoolean(
      "roadsafe:inspector-docked",
      true,
    ),
  );
const [title, description] =
    useMemo(
      () =>
        pageMeta(
          location.pathname,
        ),
      [location.pathname],
    );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "roadsafe:navigation-collapsed",
        String(desktopCollapsed),
      );
    } catch {
      // UI preference persistence is non-critical.
    }
  }, [desktopCollapsed]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "roadsafe:inspector-open",
        String(inspectorOpen),
      );
    } catch {
      // UI preference persistence is non-critical.
    }
  }, [inspectorOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "roadsafe:inspector-docked",
        String(inspectorDocked),
      );
    } catch {
      // UI preference persistence is non-critical.
    }
  }, [inspectorDocked]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    /*
     * Initialise document-level density/motion preferences
     * and keep this shell live-synchronised with Settings.
     */
    readRoadSafeSettings();

    return subscribeRoadSafeSettings(
      (next) => {
        setDesktopCollapsed(
          next.workspace
            .navigationCollapsed,
        );

        setInspectorOpen(
          next.workspace
            .inspectorOpen,
        );

        setInspectorDocked(
          next.workspace
            .inspectorDocked,
        );
      },
    );
  }, []);

  useEffect(() => {
    /*
     * Shell controls can also change these values directly
     * through buttons and keyboard shortcuts. Keep Settings
     * synchronised in the same browser tab.
     */
    updateRoadSafeSettings(
      (current) => ({
        ...current,

        workspace: {
          ...current.workspace,

          navigationCollapsed:
            desktopCollapsed,

          inspectorOpen,

          inspectorDocked,
        },
      }),
    );
  }, [
    desktopCollapsed,
    inspectorOpen,
    inspectorDocked,
  ]);

  const identity = auth.identity;
  const role =
    identity?.role ??
    "unassigned";

  const stationClient =
    isStationRole(role);

  const stationAdmin =
    role === "station_admin";

  const homePath =
    stationClient
      ? "/station"
      : "/field";

  const summary =
    WorkspaceDataService.getSummary();

  const activeCase =
    summary.latestCase;

  const activeReconstruction =
    activeCase
      ? WorkspaceDataService
          .getReconstructions()
          .find(
            (item) =>
              item.id ===
              activeCase.reconstructionId,
          ) ??
        summary.latestReconstruction
      : summary.latestReconstruction;

  const isDashboard =
    location.pathname === "/field" ||
    location.pathname === "/station";

  const isReconstructionWorkspace =
    location.pathname ===
      "/reconstruction" ||
    location.pathname.includes(
      "/reconstruction",
    );

  const usesReconstructionContextPanel =
    isReconstructionWorkspace &&
    !location.pathname.endsWith(
      "/reconstruction/ar",
    );

  const inspectorAvailable =
    !usesReconstructionContextPanel;

  const shellClassName = [
    "roadsafe-workstation",
    desktopCollapsed
      ? "is-navigation-collapsed"
      : "",
    inspectorOpen &&
    inspectorAvailable
      ? "is-inspector-open"
      : "",
    inspectorOpen &&
    inspectorAvailable &&
    inspectorDocked
      ? "is-inspector-docked"
      : "",
    inspectorOpen &&
    inspectorAvailable &&
    !inspectorDocked
      ? "is-inspector-floating"
      : "",
    mobileOpen
      ? "is-mobile-navigation-open"
      : "",
    isReconstructionWorkspace
      ? "is-editor-route"
      : "",
    usesReconstructionContextPanel
      ? "is-workspace-context-route"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  function toggleInspector(): void {
    setInspectorOpen(
      (value) => !value,
    );
  }

  function closeInspector(): void {
    setInspectorOpen(false);
  }

  function toggleInspectorDock(): void {
    setInspectorOpen(true);
    setInspectorDocked(
      (value) => !value,
    );
  }


return (
    <div
      className={`${shellClassName} is-global-dock`}
    >
      <RoadSafeGlobalDock
        title={title}
        description={description}
        stationClient={stationClient}
        stationAdmin={stationAdmin}
        homePath={homePath}
        desktopCollapsed={desktopCollapsed}
        activeCase={activeCase}
        activeReconstruction={activeReconstruction}
        activeCases={summary.activeCases}
        stationName={
          identity?.stationTeam?.name ??
          ""
        }
        inspectorAvailable={
          inspectorAvailable
        }
        inspectorOpen={
          inspectorOpen
        }
        inspectorDocked={
          inspectorDocked
        }
        isDashboard={isDashboard}
        isReconstructionWorkspace={
          isReconstructionWorkspace
        }
        usesReconstructionContextPanel={
          usesReconstructionContextPanel
        }
        onToggleDesktopCollapsed={() =>
          setDesktopCollapsed(
            (value) => !value,
          )
        }
        onCloseMobile={() =>
          setMobileOpen(false)
        }
        onOpenMobile={() =>
          setMobileOpen(true)
        }
        onToggleInspector={
          toggleInspector
        }
        onToggleInspectorDock={
          toggleInspectorDock
        }
        onCloseInspector={
          closeInspector
        }
      >
        <Outlet />
      </RoadSafeGlobalDock>

      <AppShortcutManager
        role={role}
        homePath={homePath}
        activeCaseId={
          activeCase?.id ??
          null
        }
        inspectorAvailable={
          inspectorAvailable
        }
        onToggleNavigation={() =>
          setDesktopCollapsed(
            (value) => !value,
          )
        }
        onToggleInspector={
          toggleInspector
        }
      />
    </div>
  );
}