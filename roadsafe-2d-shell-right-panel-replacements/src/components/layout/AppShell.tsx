import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  AppWindow,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderKanban,
  LogOut,
  Map,
  Menu,
  RadioTower,
  Settings,
  ShieldCheck,
  Video,
  X,
} from "../icons/materialIcons";

import { useAuth } from "../../context/AuthContext";
import { WorkspaceDataService } from "../../services/workspaceDataService";
import {
  isStationRole,
  roleLabel,
} from "../../types/auth";
import WorkspaceInspector from "./WorkspaceInspector";
import {
  WorkspaceRightPanelProvider,
} from "./WorkspaceRightPanelContext";

interface AppNavigationItem {
  to: string;
  label: string;
  section: "Workspace" | "Investigation" | "Outputs" | "Administration";
  icon: typeof Building2;
  end?: boolean;
}

const sharedNavItems: AppNavigationItem[] = [
  {
    to: "/cases",
    label: "Cases",
    section: "Workspace",
    icon: FolderKanban,
  },
  {
    to: "/scene-map",
    label: "Scene Map",
    section: "Workspace",
    icon: Map,
  },
  {
    to: "/evidence",
    label: "Evidence",
    section: "Investigation",
    icon: ClipboardList,
  },
  {
    to: "/reconstruction",
    label: "Reconstruction",
    section: "Investigation",
    icon: Boxes,
  },
  {
    to: "/footage",
    label: "Footage",
    section: "Investigation",
    icon: Video,
  },
  {
    to: "/reports",
    label: "Reports",
    section: "Outputs",
    icon: FileText,
  },
];

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

  if (pathname.endsWith("/reconstruction/ar")) {
    return [
      "AR Reconstruction Review",
      "Align and inspect the reconstruction against the real scene",
    ];
  }

  if (pathname.includes("/reconstruction")) {
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

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value || "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function readStoredBoolean(
  key: string,
  fallback: boolean,
): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    if (value === null) return fallback;
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
  const [profileOpen, setProfileOpen] =
    useState(false);
  const [desktopCollapsed, setDesktopCollapsed] =
    useState(() =>
      readStoredBoolean(
        "roadsafe:navigation-collapsed",
        false,
      ),
    );
  const [inspectorOpen, setInspectorOpen] =
    useState(() =>
      readStoredBoolean(
        "roadsafe:inspector-open",
        true,
      ),
    );
  const [inspectorDocked, setInspectorDocked] =
    useState(() =>
      readStoredBoolean(
        "roadsafe:inspector-docked",
        true,
      ),
    );
  const [
    workspaceRightPanelHost,
    setWorkspaceRightPanelHost,
  ] = useState<HTMLElement | null>(null);
  const [now, setNow] = useState(
    () => new Date(),
  );

  const [title, description] = useMemo(
    () => pageMeta(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(new Date()),
      1_000,
    );

    return () =>
      window.clearInterval(timer);
  }, []);

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
    setProfileOpen(false);
  }, [location.pathname]);

  const identity = auth.identity;
  const role = identity?.role ?? "unassigned";
  const stationClient = isStationRole(role);
  const stationAdmin = role === "station_admin";
  const homePath = stationClient
    ? "/station"
    : "/field";

  const navItems = useMemo<AppNavigationItem[]>(
    () => {
      const items: AppNavigationItem[] = [
        {
          to: homePath,
          label: stationClient
            ? "Station Overview"
            : "Field Home",
          section: "Workspace",
          icon: stationClient
            ? Building2
            : RadioTower,
          end: true,
        },
        ...sharedNavItems,
      ];

      if (stationClient) {
        items.push({
          to: "/analytics",
          label: "Analytics",
          section: "Outputs",
          icon: BarChart3,
        });
      }

      if (stationAdmin) {
        items.push({
          to: "/officers",
          label: "Officers",
          section: "Administration",
          icon: Building2,
        });
      }

      if (stationClient) {
        items.push({
          to: "/settings",
          label: "Settings",
          section: "Administration",
          icon: Settings,
        });
      }

      return items;
    }, [homePath, stationAdmin, stationClient]);

  const navGroups = useMemo(
    () =>
      [
        "Workspace",
        "Investigation",
        "Outputs",
        "Administration",
      ]
        .map((section) => ({
          section,
          items: navItems.filter(
            (item) => item.section === section,
          ),
        }))
        .filter((group) => group.items.length > 0),
    [navItems],
  );

  const summary = WorkspaceDataService.getSummary();
  const activeCase = summary.latestCase;
  const activeReconstruction = activeCase
    ? WorkspaceDataService.getReconstructions().find(
        (item) =>
          item.id === activeCase.reconstructionId,
      ) ?? summary.latestReconstruction
    : summary.latestReconstruction;

  const displayName =
    identity?.user.name ||
    identity?.user.email ||
    "RoadSafe User";

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "RS";

  const isDashboard =
    location.pathname === "/field" ||
    location.pathname === "/station";

  const isReconstructionWorkspace =
    location.pathname === "/reconstruction" ||
    location.pathname.includes("/reconstruction");

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
    inspectorOpen && inspectorAvailable
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
    setInspectorOpen((value) => !value);
  }

  function closeInspector(): void {
    setInspectorOpen(false);
  }

  function toggleInspectorDock(): void {
    setInspectorOpen(true);
    setInspectorDocked((value) => !value);
  }

  return (
    <div className={shellClassName}>
      <aside
        className="roadsafe-navigation"
        aria-label="Primary navigation"
      >
        <div className="roadsafe-navigation-brand">
          <Link
            to={homePath}
            className="roadsafe-brand-link"
          >
            <span className="roadsafe-brand-mark">
              <ShieldCheck
                size={22}
                strokeWidth={1.6}
              />
            </span>
            <span className="roadsafe-brand-copy">
              <strong>RoadSafe AR</strong>
              <small>
                {stationClient
                  ? "Station Client"
                  : "Field Client"}
              </small>
            </span>
          </Link>

          <button
            type="button"
            className="ui-icon-button roadsafe-navigation-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={17} />
          </button>

          <button
            type="button"
            className="ui-icon-button roadsafe-navigation-collapse"
            onClick={() =>
              setDesktopCollapsed(
                (value) => !value,
              )
            }
            aria-label={
              desktopCollapsed
                ? "Expand navigation"
                : "Collapse navigation"
            }
          >
            {desktopCollapsed ? (
              <>
                <ShieldCheck
                  className="roadsafe-navigation-collapse-mark"
                  size={16}
                  strokeWidth={1.6}
                />
                <ChevronRight
                  size={12}
                  strokeWidth={1.8}
                />
              </>
            ) : (
              <ChevronLeft size={16} />
            )}
          </button>
        </div>

        <div className="roadsafe-navigation-station">
          <span className="roadsafe-station-symbol">
            <Building2 size={15} />
          </span>
          <span className="roadsafe-station-copy">
            <strong>
              {identity?.stationTeam?.name ??
                "No station assigned"}
            </strong>
            <small>{roleLabel(role)}</small>
          </span>
        </div>

        <nav className="roadsafe-navigation-groups">
          {navGroups.map((group) => (
            <section
              key={group.section}
              className="roadsafe-navigation-group"
            >
              <p className="roadsafe-navigation-group-label">
                {group.section}
              </p>

              <div className="roadsafe-navigation-links">
                {group.items.map(
                  ({
                    to,
                    label,
                    icon: Icon,
                    end,
                  }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      title={
                        desktopCollapsed
                          ? label
                          : undefined
                      }
                      className={({ isActive }) =>
                        `roadsafe-navigation-link ${
                          isActive
                            ? "is-active"
                            : ""
                        }`
                      }
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.65}
                      />
                      <span className="roadsafe-navigation-link-label">
                        {label}
                      </span>
                    </NavLink>
                  ),
                )}
              </div>
            </section>
          ))}
        </nav>

        {activeCase && (
          <Link
            to={`/cases/${activeCase.id}`}
            className="roadsafe-navigation-case"
          >
            <span className="roadsafe-eyebrow">
              Active case
            </span>
            <strong>{activeCase.caseNumber}</strong>
            <small>
              {activeCase.location ||
                "Location not recorded"}
            </small>
            <span className="roadsafe-navigation-case-status">
              {activeCase.status}
            </span>
          </Link>
        )}

        <div className="roadsafe-navigation-footer">
          <span className="roadsafe-system-indicator" />
          <span className="roadsafe-navigation-footer-copy">
            <strong>Session active</strong>
            <small>Workspace operational</small>
          </span>
        </div>
      </aside>

      <div className="roadsafe-center">
        {!isReconstructionWorkspace && (
          <header className="roadsafe-workspace-header">
            <div className="roadsafe-workspace-header-left">
              <button
                type="button"
                className="ui-icon-button roadsafe-mobile-menu-button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu size={18} />
              </button>

              <div className="roadsafe-workspace-title">
                <p className="roadsafe-eyebrow">
                  {stationClient
                    ? "Station workspace"
                    : "Field workspace"}
                </p>
                <h1>{title}</h1>
                <p>{description}</p>
              </div>
            </div>

            <div className="roadsafe-workspace-header-right">
              {activeCase && (
                <Link
                  to={`/cases/${activeCase.id}`}
                  className="roadsafe-active-case-chip"
                >
                  <span>Active case</span>
                  <strong>{activeCase.caseNumber}</strong>
                  <small>
                    {formatDate(
                      activeCase.accidentDate,
                    )}
                  </small>
                </Link>
              )}

              <div className="roadsafe-header-clock">
                <strong>
                  {now.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
                <span>
                  {now.toLocaleDateString([], {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              <Link
                to={homePath}
                className="ui-icon-button roadsafe-header-icon"
                aria-label="Open dashboard"
              >
                <AppWindow size={16} />
              </Link>

              <Link
                to="/cases"
                className="ui-icon-button roadsafe-header-icon roadsafe-notification-button"
                aria-label={`${summary.activeCases} active cases`}
              >
                <Bell size={16} />
                {summary.activeCases > 0 && (
                  <span>{summary.activeCases}</span>
                )}
              </Link>

              {inspectorAvailable && (
                <button
                  type="button"
                  className="ui-button roadsafe-inspector-toggle"
                  onClick={toggleInspector}
                  aria-label="Toggle case inspector"
                  aria-pressed={inspectorOpen}
                >
                  <ClipboardList size={15} />
                  <span>Inspector</span>
                  {inspectorOpen ? (
                    <ChevronRight size={14} />
                  ) : (
                    <ChevronLeft size={14} />
                  )}
                </button>
              )}

              <div className="roadsafe-profile-menu">
                <button
                  type="button"
                  className="roadsafe-profile-trigger"
                  onClick={() =>
                    setProfileOpen(
                      (value) => !value,
                    )
                  }
                  aria-expanded={profileOpen}
                >
                  <span className="roadsafe-profile-avatar">
                    {initials}
                  </span>
                  <span className="roadsafe-profile-copy">
                    <small>{roleLabel(role)}</small>
                    <strong>{displayName}</strong>
                  </span>
                  <ChevronDown size={14} />
                </button>

                {profileOpen && (
                  <div className="roadsafe-profile-popover">
                    <div className="roadsafe-profile-popover-head">
                      <strong>{displayName}</strong>
                      <span>{identity?.user.email}</span>
                    </div>

                    <Link
                      to="/cases"
                      onClick={() =>
                        setProfileOpen(false)
                      }
                    >
                      Investigation cases
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        void auth.signOut();
                      }}
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}

        <main
          className={`roadsafe-workspace-main ${
            isReconstructionWorkspace
              ? "is-editor"
              : ""
          }`}
        >
          <div
            className={`roadsafe-page-stage ${
              isDashboard
                ? "is-dashboard"
                : ""
            } ${
              isReconstructionWorkspace
                ? "is-editor"
                : ""
            }`}
          >
            <WorkspaceRightPanelProvider
              host={workspaceRightPanelHost}
            >
              <Outlet />
            </WorkspaceRightPanelProvider>
          </div>
        </main>
      </div>

      {isReconstructionWorkspace &&
        inspectorAvailable &&
        !inspectorOpen && (
          <button
            type="button"
            className="ui-button roadsafe-editor-inspector-toggle"
            onClick={toggleInspector}
            aria-label="Open active investigation inspector"
          >
            <ClipboardList size={15} />
            <span>Inspector</span>
          </button>
        )}

      {usesReconstructionContextPanel ? (
        <aside
          ref={setWorkspaceRightPanelHost}
          className="roadsafe-workspace-context-slot"
          aria-label="Reconstruction context inspector"
        />
      ) : (
        inspectorAvailable &&
        inspectorOpen && (
          <WorkspaceInspector
            activeCase={activeCase}
            activeReconstruction={
              activeReconstruction
            }
            activeCases={summary.activeCases}
            stationName={
              identity?.stationTeam?.name ?? ""
            }
            docked={inspectorDocked}
            onToggleDock={toggleInspectorDock}
            onClose={closeInspector}
          />
        )
      )}

      <button
        type="button"
        className="roadsafe-mobile-overlay roadsafe-navigation-overlay"
        onClick={() => setMobileOpen(false)}
        aria-label="Close navigation"
      />

    </div>
  );
}
