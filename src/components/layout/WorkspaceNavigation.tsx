import {
  Link,
  NavLink,
} from "react-router-dom";
import {
  BarChart3,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderKanban,
  Map,
  RadioTower,
  Settings,
  ShieldCheck,
  Video,
  X,
} from "../icons/materialIcons";

import { useAuth } from "../../context/AuthContext";
import { roleLabel } from "../../types/auth";

interface ActiveCaseSummary {
  id: string;
  caseNumber: string;
  location?: string;
  status: string;
}

interface WorkspaceNavigationProps {
  homePath: string;
  stationClient: boolean;
  stationAdmin: boolean;
  desktopCollapsed: boolean;
  activeCase?: ActiveCaseSummary | null;
  onToggleDesktopCollapsed(): void;
  onCloseMobile(): void;
}

interface NavigationItem {
  to: string;
  label: string;
  section:
    | "Workspace"
    | "Investigation"
    | "Outputs"
    | "Administration";
  icon: typeof Building2;
  end?: boolean;
}

const SHARED_NAV_ITEMS: NavigationItem[] = [
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

const NAVIGATION_SECTIONS = [
  "Workspace",
  "Investigation",
  "Outputs",
  "Administration",
] as const;

export default function WorkspaceNavigation({
  homePath,
  stationClient,
  stationAdmin,
  desktopCollapsed,
  activeCase,
  onToggleDesktopCollapsed,
  onCloseMobile,
}: WorkspaceNavigationProps) {
  const auth = useAuth();
  const identity = auth.identity;
  const role = identity?.role ?? "unassigned";

  const navItems: NavigationItem[] = [
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
    ...SHARED_NAV_ITEMS,
  ];

  if (stationClient) {
    navItems.push({
      to: "/analytics",
      label: "Analytics",
      section: "Outputs",
      icon: BarChart3,
    });
  }

  if (stationAdmin) {
    navItems.push({
      to: "/officers",
      label: "Officers",
      section: "Administration",
      icon: Building2,
    });
  }

  if (stationClient) {
    navItems.push({
      to: "/settings",
      label: "Settings",
      section: "Administration",
      icon: Settings,
    });
  }

  const groups = NAVIGATION_SECTIONS
    .map((section) => ({
      section,
      items: navItems.filter(
        (item) => item.section === section,
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
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
          onClick={onCloseMobile}
          aria-label="Close navigation"
        >
          <X size={17} />
        </button>

        <button
          type="button"
          className="ui-icon-button roadsafe-navigation-collapse"
          onClick={onToggleDesktopCollapsed}
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
        {groups.map((group) => (
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
  );
}