import { NavLink, useLocation } from "react-router-dom";
import {
  Activity, BarChart3, Boxes, Building2, Camera, ClipboardCheck,
  ClipboardList, Database, FileText, Film, FolderKanban, KeyRound,
  Map, MapPin, Orbit, Plus, Settings, ShieldCheck, Users, Video,
} from "../icons/materialIcons";
import type { MaterialIconComponent } from "../icons/materialIcons";
import type { AccidentCase } from "../../types/accidentCase";
import "./WorkspaceModuleNavigation.css";

interface Props {
  stationClient: boolean;
  stationAdmin: boolean;
  homePath: string;
  activeCase?: AccidentCase | null;
}
interface Item {
  label: string;
  to: string;
  icon: MaterialIconComponent;
  end?: boolean;
}
interface Group {
  label: string;
  items: Item[];
}

export default function WorkspaceModuleNavigation({
  stationClient, stationAdmin, homePath, activeCase,
}: Props) {
  const { pathname } = useLocation();
  const id = activeCase?.id;
  let title = "Command Center";
  let icon: MaterialIconComponent = Building2;
  let groups: Group[] = [];

  if (pathname === homePath) {
    groups = [{
      label: "Operations",
      items: [{
        label: stationClient ? "Station Overview" : "Field Operations",
        to: homePath,
        icon: Activity,
        end: true,
      }],
    }];
  } else if (
    pathname.startsWith("/cases") &&
    !pathname.includes("/reconstruction") &&
    !pathname.includes("/report") &&
    !pathname.includes("/footage")
  ) {
    title = "Case Manager";
    icon = FolderKanban;
    const items: Item[] = [
      { label: "Case Register", to: "/cases", icon: FolderKanban, end: true },
      { label: "New Investigation", to: "/cases/new", icon: Plus },
    ];
    if (id) {
      items.push(
        { label: "Case Overview", to: `/cases/${id}`, icon: ClipboardList, end: true },
        { label: "Edit Case", to: `/cases/${id}/edit`, icon: ClipboardCheck },
      );
    }
    groups = [{ label: "Cases", items }];
  } else if (pathname === "/scene-map") {
    title = "Scene Intelligence";
    icon = Map;
    groups = [
      { label: "Map", items: [{ label: "Intelligent Map", to: "/scene-map", icon: Map, end: true }] },
      { label: "Analysis", items: [
        { label: "Risk Junctions", to: "/scene-map", icon: MapPin },
        { label: "Area Analysis", to: "/scene-map", icon: Activity },
      ]},
    ];
  } else if (pathname === "/evidence" || pathname === "/footage" || pathname.includes("/footage")) {
    title = "Evidence Lab";
    icon = Camera;
    const media: Item[] = [{ label: "Footage Library", to: "/footage", icon: Film }];
    if (id) media.push({ label: "Case Footage", to: `/cases/${id}/footage`, icon: Video });
    groups = [
      { label: "Evidence", items: [{ label: "Evidence Registry", to: "/evidence", icon: ClipboardList }] },
      { label: "Media", items: media },
    ];
  } else if (pathname === "/reconstruction" || pathname.includes("/reconstruction")) {
    title = "Reconstruction Studio";
    icon = Boxes;
    const items: Item[] = [{
      label: "Reconstruction Studio",
      to: id ? `/cases/${id}/reconstruction` : "/reconstruction",
      icon: Boxes,
    }];
    if (id) items.push({ label: "AR Reconstruction", to: `/cases/${id}/reconstruction/ar`, icon: Orbit });
    groups = [{ label: "Investigation", items }];
  } else if (pathname === "/analytics" || pathname === "/reports" || pathname.includes("/report")) {
    title = "Intelligence & Reports";
    icon = BarChart3;
    groups = [];
    if (stationClient) {
      groups.push({ label: "Intelligence", items: [{ label: "Analytics Overview", to: "/analytics", icon: BarChart3 }] });
    }
    const reports: Item[] = [{ label: "Report Register", to: "/reports", icon: FileText }];
    if (id) reports.push({ label: "Case Report", to: `/cases/${id}/report`, icon: ClipboardCheck });
    groups.push({ label: "Reports", items: reports });
  } else if (pathname === "/settings" || pathname === "/officers" || pathname === "/change-password") {
    title = "Administration";
    icon = Settings;
    groups = [];
    if (stationAdmin) {
      groups.push({ label: "Personnel", items: [{ label: "Officer Directory", to: "/officers", icon: Users }] });
    }
    groups.push({ label: "System", items: [
      { label: "Workspace Settings", to: "/settings", icon: Settings },
      { label: "Account & Security", to: "/settings", icon: ShieldCheck },
      { label: "Change Password", to: "/change-password", icon: KeyRound },
      { label: "Data & Storage", to: "/settings", icon: Database },
    ]});
  }

  const TitleIcon = icon;
  return (
    <aside className="roadsafe-module-navigation" aria-label={`${title} navigation`}>
      <header className="roadsafe-module-navigation__header">
        <TitleIcon size={18} strokeWidth={1.7} />
        <strong>{title}</strong>
      </header>
      <div className="roadsafe-module-navigation__body">
        {groups.map((group) => (
          <section key={group.label} className="roadsafe-module-navigation__group">
            <h2>{group.label}</h2>
            <nav>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={`${group.label}-${item.label}-${item.to}`}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `roadsafe-module-navigation__item ${isActive ? "is-active" : ""}`}
                  >
                    <Icon size={16} strokeWidth={1.65} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </section>
        ))}
      </div>
      {activeCase && (
        <footer className="roadsafe-module-navigation__case">
          <span>Active Case</span>
          <strong>{activeCase.caseNumber}</strong>
        </footer>
      )}
    </aside>
  );
}