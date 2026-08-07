import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");

if (!fs.existsSync(packagePath)) {
  console.error(
    "package.json was not found. Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

let packageJson;

try {
  packageJson = JSON.parse(
    fs.readFileSync(packagePath, "utf8"),
  );
} catch (error) {
  console.error("Could not read package.json:", error);
  process.exit(1);
}

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected the RoadSafe project, but found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

const files = {"src/components/layout/AppShell.tsx": "import {\n  useEffect,\n  useMemo,\n  useState,\n} from \"react\";\nimport {\n  Link,\n  NavLink,\n  Outlet,\n  useLocation,\n} from \"react-router-dom\";\nimport {\n  AppWindow,\n  BarChart3,\n  Bell,\n  Boxes,\n  Building2,\n  ChevronDown,\n  ChevronLeft,\n  ChevronRight,\n  ClipboardList,\n  FileText,\n  FolderKanban,\n  LogOut,\n  Map,\n  Menu,\n  RadioTower,\n  Settings,\n  ShieldCheck,\n  Video,\n  X,\n} from \"lucide-react\";\n\nimport { useAuth } from \"../../context/AuthContext\";\nimport { WorkspaceDataService } from \"../../services/workspaceDataService\";\nimport {\n  isStationRole,\n  roleLabel,\n} from \"../../types/auth\";\nimport WorkspaceInspector from \"./WorkspaceInspector\";\n\ninterface AppNavigationItem {\n  to: string;\n  label: string;\n  section: \"Workspace\" | \"Investigation\" | \"Outputs\" | \"Administration\";\n  icon: typeof Building2;\n  end?: boolean;\n}\n\nconst sharedNavItems: AppNavigationItem[] = [\n  {\n    to: \"/cases\",\n    label: \"Cases\",\n    section: \"Workspace\",\n    icon: FolderKanban,\n  },\n  {\n    to: \"/scene-map\",\n    label: \"Scene Map\",\n    section: \"Workspace\",\n    icon: Map,\n  },\n  {\n    to: \"/evidence\",\n    label: \"Evidence\",\n    section: \"Investigation\",\n    icon: ClipboardList,\n  },\n  {\n    to: \"/reconstruction\",\n    label: \"Reconstruction\",\n    section: \"Investigation\",\n    icon: Boxes,\n  },\n  {\n    to: \"/footage\",\n    label: \"Footage\",\n    section: \"Investigation\",\n    icon: Video,\n  },\n  {\n    to: \"/reports\",\n    label: \"Reports\",\n    section: \"Outputs\",\n    icon: FileText,\n  },\n];\n\nfunction pageMeta(\n  pathname: string,\n): [string, string] {\n  if (pathname === \"/field\") {\n    return [\n      \"Field Operations\",\n      \"Capture, verify and prepare accident-scene information\",\n    ];\n  }\n\n  if (pathname === \"/station\") {\n    return [\n      \"Station Overview\",\n      \"Monitor investigations, workload and road-safety activity\",\n    ];\n  }\n\n  if (pathname.startsWith(\"/cases/new\")) {\n    return [\n      \"New Accident Case\",\n      \"Create the investigation record and define its scene context\",\n    ];\n  }\n\n  if (pathname.endsWith(\"/reconstruction/ar\")) {\n    return [\n      \"AR Reconstruction Review\",\n      \"Align and inspect the reconstruction against the real scene\",\n    ];\n  }\n\n  if (pathname.includes(\"/reconstruction\")) {\n    return [\n      \"Accident Reconstruction\",\n      \"Build, simulate and validate the collision sequence\",\n    ];\n  }\n\n  if (pathname.includes(\"/report\")) {\n    return [\n      \"Investigation Report\",\n      \"Review findings, assumptions and supporting evidence\",\n    ];\n  }\n\n  if (pathname.includes(\"/footage\")) {\n    return [\n      \"Reconstruction Footage\",\n      \"Review captured reconstruction playback and exports\",\n    ];\n  }\n\n  if (pathname.startsWith(\"/cases/\")) {\n    return [\n      \"Case Workspace\",\n      \"Investigation details, evidence, reconstruction and review status\",\n    ];\n  }\n\n  if (pathname === \"/cases\") {\n    return [\n      \"Investigation Cases\",\n      \"Manage active, reviewed and archived accident investigations\",\n    ];\n  }\n\n  if (pathname === \"/scene-map\") {\n    return [\n      \"Scene and Risk Map\",\n      \"Review investigation locations and road-safety intelligence\",\n    ];\n  }\n\n  if (pathname === \"/evidence\") {\n    return [\n      \"Evidence Register\",\n      \"Inspect scene records, media and linked observations\",\n    ];\n  }\n\n  if (pathname === \"/reports\") {\n    return [\n      \"Reports\",\n      \"Open generated investigation packages and formal outputs\",\n    ];\n  }\n\n  if (pathname === \"/footage\") {\n    return [\n      \"Footage Library\",\n      \"Access saved reconstruction recordings\",\n    ];\n  }\n\n  if (pathname === \"/analytics\") {\n    return [\n      \"Road-Safety Analytics\",\n      \"Review operational trends and recurring accident patterns\",\n    ];\n  }\n\n  if (pathname === \"/officers\") {\n    return [\n      \"Officer Management\",\n      \"Manage station access, roles and investigator accounts\",\n    ];\n  }\n\n  if (pathname === \"/settings\") {\n    return [\n      \"System Settings\",\n      \"Configure station and reconstruction workspace preferences\",\n    ];\n  }\n\n  return [\n    \"RoadSafe AR\",\n    \"Professional accident investigation and reconstruction workspace\",\n  ];\n}\n\nfunction formatDate(value: string): string {\n  const date = new Date(value);\n\n  if (Number.isNaN(date.getTime())) {\n    return value || \"Not recorded\";\n  }\n\n  return new Intl.DateTimeFormat(undefined, {\n    day: \"2-digit\",\n    month: \"short\",\n    year: \"numeric\",\n  }).format(date);\n}\n\nfunction readStoredBoolean(\n  key: string,\n  fallback: boolean,\n): boolean {\n  if (typeof window === \"undefined\") {\n    return fallback;\n  }\n\n  try {\n    const value = window.localStorage.getItem(key);\n    if (value === null) return fallback;\n    return value === \"true\";\n  } catch {\n    return fallback;\n  }\n}\n\nexport default function AppShell() {\n  const auth = useAuth();\n  const location = useLocation();\n\n  const [mobileOpen, setMobileOpen] =\n    useState(false);\n  const [profileOpen, setProfileOpen] =\n    useState(false);\n  const [desktopCollapsed, setDesktopCollapsed] =\n    useState(() =>\n      readStoredBoolean(\n        \"roadsafe:navigation-collapsed\",\n        false,\n      ),\n    );\n  const [inspectorOpen, setInspectorOpen] =\n    useState(() =>\n      readStoredBoolean(\n        \"roadsafe:inspector-open\",\n        true,\n      ),\n    );\n  const [inspectorDocked, setInspectorDocked] =\n    useState(() =>\n      readStoredBoolean(\n        \"roadsafe:inspector-docked\",\n        true,\n      ),\n    );\n  const [now, setNow] = useState(\n    () => new Date(),\n  );\n\n  const [title, description] = useMemo(\n    () => pageMeta(location.pathname),\n    [location.pathname],\n  );\n\n  useEffect(() => {\n    const timer = window.setInterval(\n      () => setNow(new Date()),\n      1_000,\n    );\n\n    return () =>\n      window.clearInterval(timer);\n  }, []);\n\n  useEffect(() => {\n    try {\n      window.localStorage.setItem(\n        \"roadsafe:navigation-collapsed\",\n        String(desktopCollapsed),\n      );\n    } catch {\n      // UI preference persistence is non-critical.\n    }\n  }, [desktopCollapsed]);\n\n  useEffect(() => {\n    try {\n      window.localStorage.setItem(\n        \"roadsafe:inspector-open\",\n        String(inspectorOpen),\n      );\n    } catch {\n      // UI preference persistence is non-critical.\n    }\n  }, [inspectorOpen]);\n\n  useEffect(() => {\n    try {\n      window.localStorage.setItem(\n        \"roadsafe:inspector-docked\",\n        String(inspectorDocked),\n      );\n    } catch {\n      // UI preference persistence is non-critical.\n    }\n  }, [inspectorDocked]);\n\n  useEffect(() => {\n    setMobileOpen(false);\n    setProfileOpen(false);\n  }, [location.pathname]);\n\n  const identity = auth.identity;\n  const role = identity?.role ?? \"unassigned\";\n  const stationClient = isStationRole(role);\n  const stationAdmin = role === \"station_admin\";\n  const homePath = stationClient\n    ? \"/station\"\n    : \"/field\";\n\n  const navItems = useMemo<AppNavigationItem[]>(\n    () => {\n      const items: AppNavigationItem[] = [\n        {\n          to: homePath,\n          label: stationClient\n            ? \"Station Overview\"\n            : \"Field Home\",\n          section: \"Workspace\",\n          icon: stationClient\n            ? Building2\n            : RadioTower,\n          end: true,\n        },\n        ...sharedNavItems,\n      ];\n\n      if (stationClient) {\n        items.push({\n          to: \"/analytics\",\n          label: \"Analytics\",\n          section: \"Outputs\",\n          icon: BarChart3,\n        });\n      }\n\n      if (stationAdmin) {\n        items.push({\n          to: \"/officers\",\n          label: \"Officers\",\n          section: \"Administration\",\n          icon: Building2,\n        });\n      }\n\n      if (stationClient) {\n        items.push({\n          to: \"/settings\",\n          label: \"Settings\",\n          section: \"Administration\",\n          icon: Settings,\n        });\n      }\n\n      return items;\n    }, [homePath, stationAdmin, stationClient]);\n\n  const navGroups = useMemo(\n    () =>\n      [\n        \"Workspace\",\n        \"Investigation\",\n        \"Outputs\",\n        \"Administration\",\n      ]\n        .map((section) => ({\n          section,\n          items: navItems.filter(\n            (item) => item.section === section,\n          ),\n        }))\n        .filter((group) => group.items.length > 0),\n    [navItems],\n  );\n\n  const summary = WorkspaceDataService.getSummary();\n  const activeCase = summary.latestCase;\n  const activeReconstruction = activeCase\n    ? WorkspaceDataService.getReconstructions().find(\n        (item) =>\n          item.id === activeCase.reconstructionId,\n      ) ?? summary.latestReconstruction\n    : summary.latestReconstruction;\n\n  const displayName =\n    identity?.user.name ||\n    identity?.user.email ||\n    \"RoadSafe User\";\n\n  const initials =\n    displayName\n      .split(/\\s+/)\n      .filter(Boolean)\n      .slice(0, 2)\n      .map((part) => part[0]?.toUpperCase())\n      .join(\"\") || \"RS\";\n\n  const isDashboard =\n    location.pathname === \"/field\" ||\n    location.pathname === \"/station\";\n\n  const isReconstructionWorkspace =\n    location.pathname === \"/reconstruction\" ||\n    location.pathname.includes(\"/reconstruction\");\n\n  const inspectorAvailable = true;\n\n  const shellClassName = [\n    \"roadsafe-workstation\",\n    desktopCollapsed\n      ? \"is-navigation-collapsed\"\n      : \"\",\n    inspectorOpen && inspectorAvailable\n      ? \"is-inspector-open\"\n      : \"\",\n    inspectorOpen && inspectorDocked\n      ? \"is-inspector-docked\"\n      : \"\",\n    inspectorOpen && !inspectorDocked\n      ? \"is-inspector-floating\"\n      : \"\",\n    mobileOpen\n      ? \"is-mobile-navigation-open\"\n      : \"\",\n    isReconstructionWorkspace\n      ? \"is-editor-route\"\n      : \"\",\n  ]\n    .filter(Boolean)\n    .join(\" \");\n\n  function toggleInspector(): void {\n    setInspectorOpen((value) => !value);\n  }\n\n  function closeInspector(): void {\n    setInspectorOpen(false);\n  }\n\n  function toggleInspectorDock(): void {\n    setInspectorOpen(true);\n    setInspectorDocked((value) => !value);\n  }\n\n  return (\n    <div className={shellClassName}>\n      <aside\n        className=\"roadsafe-navigation\"\n        aria-label=\"Primary navigation\"\n      >\n        <div className=\"roadsafe-navigation-brand\">\n          <Link\n            to={homePath}\n            className=\"roadsafe-brand-link\"\n          >\n            <span className=\"roadsafe-brand-mark\">\n              <ShieldCheck\n                size={22}\n                strokeWidth={1.6}\n              />\n            </span>\n            <span className=\"roadsafe-brand-copy\">\n              <strong>RoadSafe AR</strong>\n              <small>\n                {stationClient\n                  ? \"Station Client\"\n                  : \"Field Client\"}\n              </small>\n            </span>\n          </Link>\n\n          <button\n            type=\"button\"\n            className=\"ui-icon-button roadsafe-navigation-mobile-close\"\n            onClick={() => setMobileOpen(false)}\n            aria-label=\"Close navigation\"\n          >\n            <X size={17} />\n          </button>\n\n          <button\n            type=\"button\"\n            className=\"ui-icon-button roadsafe-navigation-collapse\"\n            onClick={() =>\n              setDesktopCollapsed(\n                (value) => !value,\n              )\n            }\n            aria-label={\n              desktopCollapsed\n                ? \"Expand navigation\"\n                : \"Collapse navigation\"\n            }\n          >\n            {desktopCollapsed ? (\n              <ChevronRight size={16} />\n            ) : (\n              <ChevronLeft size={16} />\n            )}\n          </button>\n        </div>\n\n        <div className=\"roadsafe-navigation-station\">\n          <span className=\"roadsafe-station-symbol\">\n            <Building2 size={15} />\n          </span>\n          <span className=\"roadsafe-station-copy\">\n            <strong>\n              {identity?.stationTeam?.name ??\n                \"No station assigned\"}\n            </strong>\n            <small>{roleLabel(role)}</small>\n          </span>\n        </div>\n\n        <nav className=\"roadsafe-navigation-groups\">\n          {navGroups.map((group) => (\n            <section\n              key={group.section}\n              className=\"roadsafe-navigation-group\"\n            >\n              <p className=\"roadsafe-navigation-group-label\">\n                {group.section}\n              </p>\n\n              <div className=\"roadsafe-navigation-links\">\n                {group.items.map(\n                  ({\n                    to,\n                    label,\n                    icon: Icon,\n                    end,\n                  }) => (\n                    <NavLink\n                      key={to}\n                      to={to}\n                      end={end}\n                      title={\n                        desktopCollapsed\n                          ? label\n                          : undefined\n                      }\n                      className={({ isActive }) =>\n                        `roadsafe-navigation-link ${\n                          isActive\n                            ? \"is-active\"\n                            : \"\"\n                        }`\n                      }\n                    >\n                      <Icon\n                        size={16}\n                        strokeWidth={1.65}\n                      />\n                      <span className=\"roadsafe-navigation-link-label\">\n                        {label}\n                      </span>\n                    </NavLink>\n                  ),\n                )}\n              </div>\n            </section>\n          ))}\n        </nav>\n\n        {activeCase && (\n          <Link\n            to={`/cases/${activeCase.id}`}\n            className=\"roadsafe-navigation-case\"\n          >\n            <span className=\"roadsafe-eyebrow\">\n              Active case\n            </span>\n            <strong>{activeCase.caseNumber}</strong>\n            <small>\n              {activeCase.location ||\n                \"Location not recorded\"}\n            </small>\n            <span className=\"roadsafe-navigation-case-status\">\n              {activeCase.status}\n            </span>\n          </Link>\n        )}\n\n        <div className=\"roadsafe-navigation-footer\">\n          <span className=\"roadsafe-system-indicator\" />\n          <span className=\"roadsafe-navigation-footer-copy\">\n            <strong>Session active</strong>\n            <small>Workspace operational</small>\n          </span>\n        </div>\n      </aside>\n\n      <div className=\"roadsafe-center\">\n        {!isReconstructionWorkspace && (\n          <header className=\"roadsafe-workspace-header\">\n            <div className=\"roadsafe-workspace-header-left\">\n              <button\n                type=\"button\"\n                className=\"ui-icon-button roadsafe-mobile-menu-button\"\n                onClick={() => setMobileOpen(true)}\n                aria-label=\"Open navigation\"\n              >\n                <Menu size={18} />\n              </button>\n\n              <div className=\"roadsafe-workspace-title\">\n                <p className=\"roadsafe-eyebrow\">\n                  {stationClient\n                    ? \"Station workspace\"\n                    : \"Field workspace\"}\n                </p>\n                <h1>{title}</h1>\n                <p>{description}</p>\n              </div>\n            </div>\n\n            <div className=\"roadsafe-workspace-header-right\">\n              {activeCase && (\n                <Link\n                  to={`/cases/${activeCase.id}`}\n                  className=\"roadsafe-active-case-chip\"\n                >\n                  <span>Active case</span>\n                  <strong>{activeCase.caseNumber}</strong>\n                  <small>\n                    {formatDate(\n                      activeCase.accidentDate,\n                    )}\n                  </small>\n                </Link>\n              )}\n\n              <div className=\"roadsafe-header-clock\">\n                <strong>\n                  {now.toLocaleTimeString([], {\n                    hour: \"2-digit\",\n                    minute: \"2-digit\",\n                  })}\n                </strong>\n                <span>\n                  {now.toLocaleDateString([], {\n                    day: \"2-digit\",\n                    month: \"short\",\n                    year: \"numeric\",\n                  })}\n                </span>\n              </div>\n\n              <Link\n                to={homePath}\n                className=\"ui-icon-button roadsafe-header-icon\"\n                aria-label=\"Open dashboard\"\n              >\n                <AppWindow size={16} />\n              </Link>\n\n              <Link\n                to=\"/cases\"\n                className=\"ui-icon-button roadsafe-header-icon roadsafe-notification-button\"\n                aria-label={`${summary.activeCases} active cases`}\n              >\n                <Bell size={16} />\n                {summary.activeCases > 0 && (\n                  <span>{summary.activeCases}</span>\n                )}\n              </Link>\n\n              {inspectorAvailable && (\n                <button\n                  type=\"button\"\n                  className=\"ui-button roadsafe-inspector-toggle\"\n                  onClick={toggleInspector}\n                  aria-label=\"Toggle case inspector\"\n                  aria-pressed={inspectorOpen}\n                >\n                  <ClipboardList size={15} />\n                  <span>Inspector</span>\n                  {inspectorOpen ? (\n                    <ChevronRight size={14} />\n                  ) : (\n                    <ChevronLeft size={14} />\n                  )}\n                </button>\n              )}\n\n              <div className=\"roadsafe-profile-menu\">\n                <button\n                  type=\"button\"\n                  className=\"roadsafe-profile-trigger\"\n                  onClick={() =>\n                    setProfileOpen(\n                      (value) => !value,\n                    )\n                  }\n                  aria-expanded={profileOpen}\n                >\n                  <span className=\"roadsafe-profile-avatar\">\n                    {initials}\n                  </span>\n                  <span className=\"roadsafe-profile-copy\">\n                    <small>{roleLabel(role)}</small>\n                    <strong>{displayName}</strong>\n                  </span>\n                  <ChevronDown size={14} />\n                </button>\n\n                {profileOpen && (\n                  <div className=\"roadsafe-profile-popover\">\n                    <div className=\"roadsafe-profile-popover-head\">\n                      <strong>{displayName}</strong>\n                      <span>{identity?.user.email}</span>\n                    </div>\n\n                    <Link\n                      to=\"/cases\"\n                      onClick={() =>\n                        setProfileOpen(false)\n                      }\n                    >\n                      Investigation cases\n                    </Link>\n\n                    <button\n                      type=\"button\"\n                      onClick={() => {\n                        setProfileOpen(false);\n                        void auth.signOut();\n                      }}\n                    >\n                      <LogOut size={14} />\n                      Sign out\n                    </button>\n                  </div>\n                )}\n              </div>\n            </div>\n          </header>\n        )}\n\n        <main\n          className={`roadsafe-workspace-main ${\n            isReconstructionWorkspace\n              ? \"is-editor\"\n              : \"\"\n          }`}\n        >\n          <div\n            className={`roadsafe-page-stage ${\n              isDashboard\n                ? \"is-dashboard\"\n                : \"\"\n            } ${\n              isReconstructionWorkspace\n                ? \"is-editor\"\n                : \"\"\n            }`}\n          >\n            <Outlet />\n          </div>\n        </main>\n      </div>\n\n      {isReconstructionWorkspace &&\n        !inspectorOpen && (\n          <button\n            type=\"button\"\n            className=\"ui-button roadsafe-editor-inspector-toggle\"\n            onClick={toggleInspector}\n            aria-label=\"Open active investigation inspector\"\n          >\n            <ClipboardList size={15} />\n            <span>Inspector</span>\n          </button>\n        )}\n\n      {inspectorAvailable && inspectorOpen && (\n        <WorkspaceInspector\n          activeCase={activeCase}\n          activeReconstruction={\n            activeReconstruction\n          }\n          activeCases={summary.activeCases}\n          stationName={\n            identity?.stationTeam?.name ?? \"\"\n          }\n          docked={inspectorDocked}\n          onToggleDock={toggleInspectorDock}\n          onClose={closeInspector}\n        />\n      )}\n\n      <button\n        type=\"button\"\n        className=\"roadsafe-mobile-overlay roadsafe-navigation-overlay\"\n        onClick={() => setMobileOpen(false)}\n        aria-label=\"Close navigation\"\n      />\n\n    </div>\n  );\n}\n", "src/components/layout/WorkspaceInspector.tsx": "import { Link } from \"react-router-dom\";\nimport {\n  Boxes,\n  ClipboardList,\n  FileText,\n  Map,\n  Pin,\n  PinOff,\n  ShieldCheck,\n  Video,\n  X,\n} from \"lucide-react\";\n\nimport type { AccidentCase } from \"../../types/accidentCase\";\nimport type { AccidentReconstruction } from \"../../types/reconstruction\";\nimport { usesGeneratedRoad } from \"../../types/reconstruction\";\n\ninterface WorkspaceInspectorProps {\n  activeCase?: AccidentCase;\n  activeReconstruction?: AccidentReconstruction;\n  activeCases: number;\n  stationName: string;\n  docked: boolean;\n  onToggleDock: () => void;\n  onClose: () => void;\n}\n\nfunction formatDateTime(value?: string): string {\n  if (!value) return \"Not recorded\";\n\n  const date = new Date(value);\n  if (Number.isNaN(date.getTime())) {\n    return value;\n  }\n\n  return new Intl.DateTimeFormat(undefined, {\n    day: \"2-digit\",\n    month: \"short\",\n    year: \"numeric\",\n    hour: \"2-digit\",\n    minute: \"2-digit\",\n  }).format(date);\n}\n\nfunction labelFromToken(value?: string): string {\n  if (!value) return \"Not recorded\";\n\n  return value\n    .replaceAll(\"_\", \" \")\n    .replace(/\\b\\w/g, (letter) => letter.toUpperCase());\n}\n\nfunction syncTone(\n  state: AccidentCase[\"cloudSyncState\"],\n): string {\n  if (state === \"synced\") return \"is-success\";\n  if (state === \"pending\") return \"is-warning\";\n  if (state === \"error\") return \"is-danger\";\n  return \"is-neutral\";\n}\n\nfunction InspectorRow({\n  label,\n  value,\n}: {\n  label: string;\n  value: string | number;\n}) {\n  return (\n    <div className=\"roadsafe-inspector-row\">\n      <dt>{label}</dt>\n      <dd>{value}</dd>\n    </div>\n  );\n}\n\nexport default function WorkspaceInspector({\n  activeCase,\n  activeReconstruction,\n  activeCases,\n  stationName,\n  docked,\n  onToggleDock,\n  onClose,\n}: WorkspaceInspectorProps) {\n  const scene = activeReconstruction?.scene;\n  const generatedRoad = scene\n    ? usesGeneratedRoad(scene)\n    : false;\n\n  const participantCount =\n    activeReconstruction?.vehicles.length ?? 0;\n  const evidenceCount =\n    (activeReconstruction?.evidenceRecords.length ?? 0) +\n    (activeReconstruction?.photos.length ?? 0);\n  const measurementCount =\n    activeReconstruction?.measurements.length ?? 0;\n  const sceneObjectCount =\n    activeReconstruction?.sceneObjects.length ?? 0;\n\n  return (\n    <aside\n      className={`roadsafe-inspector ${\n        docked ? \"is-docked\" : \"is-floating\"\n      }`}\n      data-docked={docked}\n      aria-label=\"Case context inspector\"\n    >\n      <div className=\"roadsafe-inspector-header\">\n        <div>\n          <p className=\"roadsafe-eyebrow\">Context inspector</p>\n          <h2>Active investigation</h2>\n        </div>\n\n        <div className=\"roadsafe-inspector-window-actions\">\n          <button\n            type=\"button\"\n            className=\"ui-icon-button roadsafe-inspector-dock\"\n            onClick={onToggleDock}\n            aria-label={\n              docked\n                ? \"Undock case inspector\"\n                : \"Dock case inspector to the right\"\n            }\n            title={\n              docked\n                ? \"Undock inspector\"\n                : \"Dock inspector\"\n            }\n          >\n            {docked ? (\n              <PinOff size={15} />\n            ) : (\n              <Pin size={15} />\n            )}\n          </button>\n\n          <button\n            type=\"button\"\n            className=\"ui-icon-button roadsafe-inspector-close\"\n            onClick={onClose}\n            aria-label=\"Close case inspector\"\n            title=\"Close inspector\"\n          >\n            <X size={16} />\n          </button>\n        </div>\n      </div>\n\n      <div className=\"roadsafe-inspector-scroll\">\n        {!activeCase ? (\n          <section className=\"roadsafe-inspector-empty\">\n            <ShieldCheck size={28} strokeWidth={1.5} />\n            <h3>No active case</h3>\n            <p>\n              Open or create an investigation to populate the\n              workspace inspector.\n            </p>\n            <Link to=\"/cases/new\" className=\"ui-button ui-button-primary\">\n              Create case\n            </Link>\n          </section>\n        ) : (\n          <>\n            <section className=\"roadsafe-inspector-section\">\n              <div className=\"roadsafe-inspector-section-heading\">\n                <div>\n                  <p className=\"roadsafe-eyebrow\">Case identity</p>\n                  <h3>{activeCase.caseNumber}</h3>\n                </div>\n                <span className=\"ui-badge is-info\">\n                  {activeCase.status}\n                </span>\n              </div>\n\n              <p className=\"roadsafe-inspector-case-title\">\n                {activeCase.title || \"Untitled accident case\"}\n              </p>\n\n              <dl className=\"roadsafe-inspector-definition-list\">\n                <InspectorRow\n                  label=\"Location\"\n                  value={activeCase.location || \"Not recorded\"}\n                />\n                <InspectorRow\n                  label=\"Date / time\"\n                  value={`${activeCase.accidentDate || \"—\"} · ${\n                    activeCase.accidentTime || \"—\"\n                  }`}\n                />\n                <InspectorRow\n                  label=\"Investigator\"\n                  value={\n                    activeCase.investigatingOfficer ||\n                    \"Not assigned\"\n                  }\n                />\n                <InspectorRow\n                  label=\"Station\"\n                  value={\n                    activeCase.policeStation ||\n                    stationName ||\n                    \"Not assigned\"\n                  }\n                />\n              </dl>\n            </section>\n\n            <section className=\"roadsafe-inspector-section\">\n              <div className=\"roadsafe-inspector-section-heading\">\n                <div>\n                  <p className=\"roadsafe-eyebrow\">Record state</p>\n                  <h3>Integrity and review</h3>\n                </div>\n              </div>\n\n              <div className=\"roadsafe-status-stack\">\n                <div className=\"roadsafe-status-line\">\n                  <span>Cloud state</span>\n                  <span\n                    className={`ui-badge ${syncTone(\n                      activeCase.cloudSyncState,\n                    )}`}\n                  >\n                    {labelFromToken(\n                      activeCase.cloudSyncState ?? \"local\",\n                    )}\n                  </span>\n                </div>\n                <div className=\"roadsafe-status-line\">\n                  <span>Review status</span>\n                  <span className=\"ui-badge is-neutral\">\n                    {labelFromToken(\n                      activeCase.reviewStatus ?? \"draft\",\n                    )}\n                  </span>\n                </div>\n                <div className=\"roadsafe-status-line\">\n                  <span>Last updated</span>\n                  <strong>{formatDateTime(activeCase.updatedAt)}</strong>\n                </div>\n              </div>\n\n              {activeCase.cloudSyncError && (\n                <p className=\"roadsafe-inline-alert is-danger\">\n                  {activeCase.cloudSyncError}\n                </p>\n              )}\n            </section>\n\n            <section className=\"roadsafe-inspector-section\">\n              <div className=\"roadsafe-inspector-section-heading\">\n                <div>\n                  <p className=\"roadsafe-eyebrow\">Scene summary</p>\n                  <h3>Reconstruction state</h3>\n                </div>\n                <span\n                  className={`ui-badge ${\n                    activeReconstruction?.status === \"Completed\"\n                      ? \"is-success\"\n                      : \"is-warning\"\n                  }`}\n                >\n                  {activeReconstruction?.status ?? \"Not created\"}\n                </span>\n              </div>\n\n              <div className=\"roadsafe-inspector-metrics\">\n                <div>\n                  <strong>{participantCount}</strong>\n                  <span>Participants</span>\n                </div>\n                <div>\n                  <strong>{evidenceCount}</strong>\n                  <span>Evidence</span>\n                </div>\n                <div>\n                  <strong>{measurementCount}</strong>\n                  <span>Measurements</span>\n                </div>\n                <div>\n                  <strong>{sceneObjectCount}</strong>\n                  <span>Scene objects</span>\n                </div>\n              </div>\n\n              <dl className=\"roadsafe-inspector-definition-list\">\n                <InspectorRow\n                  label=\"Environment\"\n                  value={\n                    scene\n                      ? generatedRoad\n                        ? scene.roadLayout\n                        : scene.groundSurface\n                      : \"Not configured\"\n                  }\n                />\n                <InspectorRow\n                  label=\"Surface\"\n                  value={scene?.roadSurface ?? \"Not configured\"}\n                />\n                <InspectorRow\n                  label=\"Weather\"\n                  value={scene?.weather ?? \"Not configured\"}\n                />\n                <InspectorRow\n                  label=\"Terrain\"\n                  value={\n                    scene?.realSceneGeometry\n                      ? \"Extracted geometry available\"\n                      : scene?.useRealTerrain\n                        ? \"Real terrain requested\"\n                        : \"Fallback scene\"\n                  }\n                />\n                <InspectorRow\n                  label=\"Collision confidence\"\n                  value={\n                    activeReconstruction?.collisionSetup?.confidence ??\n                    \"Not recorded\"\n                  }\n                />\n              </dl>\n            </section>\n\n            <section className=\"roadsafe-inspector-section\">\n              <div className=\"roadsafe-inspector-section-heading\">\n                <div>\n                  <p className=\"roadsafe-eyebrow\">Case tools</p>\n                  <h3>Open workspace</h3>\n                </div>\n              </div>\n\n              <div className=\"roadsafe-inspector-actions\">\n                <Link to={`/cases/${activeCase.id}`}>\n                  <ClipboardList size={15} />\n                  Case overview\n                </Link>\n                <Link to={`/cases/${activeCase.id}/reconstruction`}>\n                  <Boxes size={15} />\n                  Reconstruction\n                </Link>\n                <Link to={`/cases/${activeCase.id}/reconstruction/ar`}>\n                  <Map size={15} />\n                  AR review\n                </Link>\n                <Link to={`/cases/${activeCase.id}/footage`}>\n                  <Video size={15} />\n                  Footage\n                </Link>\n                <Link to={`/cases/${activeCase.id}/report`}>\n                  <FileText size={15} />\n                  Investigation report\n                </Link>\n              </div>\n            </section>\n          </>\n        )}\n      </div>\n\n      <div className=\"roadsafe-inspector-footer\">\n        <div>\n          <span>Open investigations</span>\n          <strong>{activeCases}</strong>\n        </div>\n        <div>\n          <span>Workspace</span>\n          <strong>Operational</strong>\n        </div>\n      </div>\n    </aside>\n  );\n}\n", "src/styles/dockableContextInspector.css": "/*\n * [RoadSafe:DockableContextInspectorV2]\n *\n * The inspector is a normal workstation panel, never a modal. It can be\n * closed, floated over the right edge, or docked as the third application\n * column. No backdrop is created, so the rest of RoadSafe remains usable.\n */\n\n.roadsafe-inspector-overlay {\n  display: none !important;\n  pointer-events: none !important;\n  background: transparent !important;\n  backdrop-filter: none !important;\n}\n\n.roadsafe-center,\n.roadsafe-workspace-main,\n.roadsafe-navigation {\n  filter: none !important;\n  opacity: 1 !important;\n  pointer-events: auto !important;\n}\n\n.roadsafe-inspector {\n  pointer-events: auto;\n  transition:\n    width 160ms ease,\n    transform 160ms ease,\n    box-shadow 160ms ease;\n}\n\n.roadsafe-inspector-window-actions {\n  display: flex;\n  align-items: center;\n  gap: 5px;\n}\n\n.roadsafe-inspector-close,\n.roadsafe-inspector-dock {\n  display: inline-grid !important;\n  flex: 0 0 auto;\n}\n\n.roadsafe-inspector-toggle {\n  display: inline-flex !important;\n}\n\n.roadsafe-inspector.is-docked .roadsafe-inspector-dock {\n  border-color: var(--blender-orange, #e8872d) !important;\n  color: var(--blender-orange, #e8872d) !important;\n}\n\n.roadsafe-inspector.is-floating {\n  position: fixed !important;\n  top: 8px !important;\n  right: 8px !important;\n  bottom: auto !important;\n  left: auto !important;\n  z-index: 95 !important;\n  grid-column: auto !important;\n  width: min(360px, calc(100vw - 16px)) !important;\n  min-width: min(280px, calc(100vw - 16px));\n  max-width: min(520px, calc(100vw - 16px));\n  height: calc(100vh - 16px) !important;\n  transform: none !important;\n  border: 1px solid var(--js-border-strong) !important;\n  border-radius: var(--js-radius-sm);\n  box-shadow:\n    0 18px 44px rgba(0, 0, 0, 0.42),\n    0 1px 0 rgba(255, 255, 255, 0.04) inset;\n}\n\n.roadsafe-editor-inspector-toggle {\n  position: fixed;\n  top: 8px;\n  right: 8px;\n  z-index: 96;\n  display: inline-flex !important;\n  min-height: 32px;\n  align-items: center;\n  gap: 7px;\n  padding: 0 10px !important;\n  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.34);\n}\n\n/*\n * Docking is enabled from 1024 CSS pixels. This deliberately works below the\n * previous 1280px breakpoint, including Windows display scaling and browser\n * zoom levels where the old implementation incorrectly behaved like mobile.\n */\n@media (min-width: 1024px) {\n  .roadsafe-workstation,\n  .roadsafe-workstation.is-inspector-open,\n  .roadsafe-workstation.is-inspector-floating,\n  .roadsafe-workstation.is-editor-route,\n  .roadsafe-workstation.is-editor-route.is-inspector-open,\n  .roadsafe-workstation.is-editor-route.is-inspector-floating {\n    grid-template-columns:\n      var(--js-navigation-width)\n      minmax(0, 1fr)\n      0 !important;\n  }\n\n  .roadsafe-workstation.is-navigation-collapsed,\n  .roadsafe-workstation.is-navigation-collapsed.is-inspector-open,\n  .roadsafe-workstation.is-navigation-collapsed.is-inspector-floating,\n  .roadsafe-workstation.is-navigation-collapsed.is-editor-route,\n  .roadsafe-workstation.is-navigation-collapsed.is-editor-route.is-inspector-open,\n  .roadsafe-workstation.is-navigation-collapsed.is-editor-route.is-inspector-floating {\n    grid-template-columns:\n      var(--js-navigation-collapsed-width)\n      minmax(0, 1fr)\n      0 !important;\n  }\n\n  .roadsafe-workstation.is-inspector-open.is-inspector-docked,\n  .roadsafe-workstation.is-editor-route.is-inspector-open.is-inspector-docked {\n    grid-template-columns:\n      var(--js-navigation-width)\n      minmax(0, 1fr)\n      var(--js-inspector-width) !important;\n  }\n\n  .roadsafe-workstation.is-navigation-collapsed.is-inspector-open.is-inspector-docked,\n  .roadsafe-workstation.is-navigation-collapsed.is-editor-route.is-inspector-open.is-inspector-docked {\n    grid-template-columns:\n      var(--js-navigation-collapsed-width)\n      minmax(0, 1fr)\n      var(--js-inspector-width) !important;\n  }\n\n  .roadsafe-inspector.is-docked {\n    position: sticky !important;\n    top: 0 !important;\n    right: auto !important;\n    bottom: auto !important;\n    left: auto !important;\n    z-index: 35 !important;\n    grid-column: 3 !important;\n    width: var(--js-inspector-width) !important;\n    min-width: 0;\n    max-width: none;\n    height: 100vh !important;\n    transform: none !important;\n    border-top: 0 !important;\n    border-right: 0 !important;\n    border-bottom: 0 !important;\n    border-left: 1px solid var(--js-border-default) !important;\n    border-radius: 0;\n    box-shadow: none;\n  }\n}\n\n@media (max-width: 1023px) {\n  .roadsafe-inspector.is-docked,\n  .roadsafe-inspector.is-floating {\n    position: fixed !important;\n    top: 8px !important;\n    right: 8px !important;\n    bottom: auto !important;\n    left: auto !important;\n    z-index: 95 !important;\n    width: min(360px, calc(100vw - 16px)) !important;\n    height: calc(100vh - 16px) !important;\n    transform: none !important;\n    border: 1px solid var(--js-border-strong) !important;\n    border-radius: var(--js-radius-sm);\n    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.42);\n  }\n\n  .roadsafe-inspector-dock {\n    display: none !important;\n  }\n}\n\n@media (max-width: 620px) {\n  .roadsafe-inspector.is-docked,\n  .roadsafe-inspector.is-floating {\n    top: 4px !important;\n    right: 4px !important;\n    width: calc(100vw - 8px) !important;\n    height: calc(100vh - 8px) !important;\n  }\n}\n"};

const mainPath = path.join(root, "src", "main.tsx");
const themePath = path.join(
  root,
  "src",
  "styles",
  "darkerTheme.css",
);

if (!fs.existsSync(mainPath)) {
  console.error("src/main.tsx was not found.");
  process.exit(1);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  timestamp,
);

function backup(relativePath) {
  const source = path.join(root, relativePath);

  if (!fs.existsSync(source)) {
    return;
  }

  const destination = path.join(
    backupRoot,
    relativePath,
  );

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.copyFileSync(source, destination);
}

function writeFile(relativePath, content) {
  const destination = path.join(
    root,
    relativePath,
  );

  backup(relativePath);

  fs.mkdirSync(
    path.dirname(destination),
    { recursive: true },
  );

  fs.writeFileSync(
    destination,
    content,
    "utf8",
  );

  console.log(`WROTE ${relativePath}`);
}

for (const [relativePath, content] of Object.entries(files)) {
  writeFile(relativePath, content);
}

backup("src/main.tsx");

let mainSource = fs.readFileSync(
  mainPath,
  "utf8",
);

const dockStyleImport =
  'import "./styles/dockableContextInspector.css";';

if (!mainSource.includes(dockStyleImport)) {
  const themeImport =
    'import "./styles/darkerTheme.css";';

  if (mainSource.includes(themeImport)) {
    mainSource = mainSource.replace(
      themeImport,
      `${themeImport}\n${dockStyleImport}`,
    );
  } else {
    const indexImport =
      'import "./index.css";';

    if (!mainSource.includes(indexImport)) {
      console.error(
        "Could not locate the stylesheet imports in src/main.tsx.",
      );
      process.exit(1);
    }

    mainSource = mainSource.replace(
      indexImport,
      `${indexImport}\n${dockStyleImport}`,
    );
  }

  fs.writeFileSync(
    mainPath,
    mainSource,
    "utf8",
  );

  console.log("CHANGED src/main.tsx");
}

/*
 * Remove the previous permanent-inspector override. V2 supplies a true
 * close/floating/docked model from its own final stylesheet.
 */
if (fs.existsSync(themePath)) {
  let themeSource = fs.readFileSync(
    themePath,
    "utf8",
  );

  const oldPersistentBlock =
    /\/\* \[RoadSafe:PersistentContextInspectorV1\] \*\/[\s\S]*?\/\* \[\/RoadSafe:PersistentContextInspectorV1\] \*\//g;

  const cleanedTheme = themeSource
    .replace(oldPersistentBlock, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";

  if (cleanedTheme !== themeSource) {
    backup("src/styles/darkerTheme.css");

    fs.writeFileSync(
      themePath,
      cleanedTheme,
      "utf8",
    );

    console.log(
      "CLEANED old persistent inspector override from src/styles/darkerTheme.css",
    );
  }
}

console.log(
  `Backups saved under ${path.relative(root, backupRoot)}`,
);

try {
  execSync("npm run build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
} catch {
  console.error(`
The dockable inspector files were installed, but the build failed.

Restore the previous files from:
  ${path.relative(root, backupRoot)}
`);
  process.exit(1);
}

console.log(`
RoadSafe dockable Context Inspector installed successfully.

Behavior:
  Closed
    Use the Inspector button to open it.

  Floating
    The inspector overlays only its own area.
    There is no backdrop and the rest of the app remains clickable.

  Docked
    Use the pin button in the inspector header.
    The inspector becomes a real right-side workstation column.

The open and docked preferences persist in localStorage.

Start RoadSafe:
  npm run dev
`);
