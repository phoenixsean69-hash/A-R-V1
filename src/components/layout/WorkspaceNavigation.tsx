import { Link, NavLink, useLocation } from "react-router-dom";
import {
  BarChart3, Boxes, Building2, ChevronLeft, ChevronRight,
  ClipboardList, FolderKanban, Map, RadioTower, Settings, X,
} from "../icons/materialIcons";
import { useAuth } from "../../context/AuthContext";
import { roleLabel } from "../../types/auth";

interface ActiveCaseSummary {
  id: string;
  caseNumber: string;
  location?: string;
  status: string;
}
interface Props {
  homePath: string;
  stationClient: boolean;
  stationAdmin: boolean;
  desktopCollapsed: boolean;
  activeCase?: ActiveCaseSummary | null;
  onToggleDesktopCollapsed(): void;
  onCloseMobile(): void;
}
interface WorkspaceItem {
  to: string;
  label: string;
  icon: typeof Building2;
  end?: boolean;
  matches(pathname: string): boolean;
}

export default function WorkspaceNavigation({
  homePath, stationClient, stationAdmin, desktopCollapsed,
  activeCase, onToggleDesktopCollapsed, onCloseMobile,
}: Props) {
  const auth = useAuth();
  const location = useLocation();
  const role = auth.identity?.role ?? "unassigned";

  const items: WorkspaceItem[] = [
    {
      to: homePath,
      label: "Command Center",
      icon: stationClient ? Building2 : RadioTower,
      end: true,
      matches: (p) => p === homePath,
    },
    {
      to: "/cases",
      label: "Case Manager",
      icon: FolderKanban,
      matches: (p) =>
        p.startsWith("/cases") &&
        !p.includes("/reconstruction") &&
        !p.includes("/report") &&
        !p.includes("/footage"),
    },
    {
      to: "/scene-map",
      label: "Scene Intelligence",
      icon: Map,
      matches: (p) => p === "/scene-map",
    },
    {
      to: "/evidence",
      label: "Evidence Lab",
      icon: ClipboardList,
      matches: (p) =>
        p === "/evidence" ||
        p === "/footage" ||
        p.includes("/footage"),
    },
    {
      to: "/reconstruction",
      label: "Reconstruction Studio",
      icon: Boxes,
      matches: (p) =>
        p === "/reconstruction" ||
        p.includes("/reconstruction"),
    },
    {
      to: stationClient ? "/analytics" : "/reports",
      label: "Intelligence & Reports",
      icon: BarChart3,
      matches: (p) =>
        p === "/analytics" ||
        p === "/reports" ||
        p.includes("/report"),
    },
  ];

  if (stationClient) {
    items.push({
      to: stationAdmin ? "/officers" : "/settings",
      label: "Administration",
      icon: Settings,
      matches: (p) =>
        p === "/officers" ||
        p === "/settings" ||
        p === "/change-password",
    });
  }

  return (
    <aside className="roadsafe-navigation roadsafe-global-workspace-rail" aria-label="RoadSafe workspaces">
      <div className="roadsafe-navigation-brand">
        <Link to={homePath} className="roadsafe-brand-link" aria-label="RoadSafe AR home">
          <img className="roadsafe-brand-logo" src="/assets/RoadSafe%20Icon.svg" alt="RoadSafe AR" />
        </Link>
        <button type="button" className="ui-icon-button roadsafe-navigation-mobile-close" onClick={onCloseMobile} aria-label="Close navigation">
          <X size={17} />
        </button>
        <button type="button" className="ui-icon-button roadsafe-navigation-collapse" onClick={onToggleDesktopCollapsed} aria-label={desktopCollapsed ? "Expand workspace rail" : "Collapse workspace rail"}>
          {desktopCollapsed ? (
            <>
              <img className="roadsafe-navigation-collapse-logo" src="/assets/RoadSafe%20Icon.svg" alt="" aria-hidden="true" />
              <ChevronRight size={12} strokeWidth={1.8} />
            </>
          ) : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="roadsafe-navigation-station">
        <span className="roadsafe-station-copy">
          <strong>{auth.identity?.stationTeam?.name ?? "No station assigned"}</strong>
          <small>{roleLabel(role)}</small>
        </span>
      </div>

      <nav className="roadsafe-navigation-groups">
        <section className="roadsafe-navigation-group">
          <p className="roadsafe-navigation-group-label">Workspaces</p>
          <div className="roadsafe-navigation-links">
            {items.map(({ to, label, icon: Icon, end, matches }) => (
              <NavLink
                key={label}
                to={to}
                end={end}
                title={desktopCollapsed ? label : undefined}
                className={() => `roadsafe-navigation-link ${matches(location.pathname) ? "is-active" : ""}`}
              >
                <Icon size={17} strokeWidth={1.65} />
                <span className="roadsafe-navigation-link-label">{label}</span>
              </NavLink>
            ))}
          </div>
        </section>
      </nav>

      {activeCase && (
        <Link to={`/cases/${activeCase.id}`} className="roadsafe-navigation-case">
          <span className="roadsafe-eyebrow">Active case</span>
          <strong>{activeCase.caseNumber}</strong>
          <small>{activeCase.location || "Location not recorded"}</small>
          <span className="roadsafe-navigation-case-status">{activeCase.status}</span>
        </Link>
      )}

      <div className="roadsafe-navigation-footer">
        <span className="roadsafe-system-indicator" />
        <span className="roadsafe-navigation-footer-copy">
          <strong>System online</strong>
          <small>Workstation operational</small>
        </span>
      </div>
    </aside>
  );
}