import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Map,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import { WorkspaceDataService } from "../../services/workspaceDataService";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/cases", label: "Cases", icon: FolderKanban },
  { to: "/reconstruction", label: "Reconstructions", icon: Boxes },
  { to: "/scene-map", label: "Scene Map", icon: Map },
  { to: "/evidence", label: "Evidence", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/footage", label: "Footage", icon: Video },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function pageMeta(pathname: string) {
  if (pathname.startsWith("/cases/new")) return ["New accident case", "Create and prepare a new investigation record"];
  if (pathname.includes("/reconstruction")) return ["Accident reconstruction", "Build, simulate and review the collision sequence"];
  if (pathname.includes("/report")) return ["Investigation report", "Review and export documented findings"];
  if (pathname.includes("/footage")) return ["Reconstruction footage", "Review captured reconstruction playback"];
  if (pathname.startsWith("/cases/")) return ["Case workspace", "Investigation details, evidence and progress"];
  if (pathname === "/cases") return ["Cases", "Manage active and completed investigations"];
  if (pathname === "/scene-map") return ["Scene map", "Review accident locations and blackspot intelligence"];
  if (pathname === "/evidence") return ["Evidence", "Review scene records and documented items"];
  if (pathname === "/reports") return ["Reports", "Access generated investigation reports"];
  if (pathname === "/footage") return ["Footage", "Access saved reconstruction recordings"];
  if (pathname === "/analytics") return ["Analytics", "Operational and road-safety trends"];
  if (pathname === "/settings") return ["Settings", "Configure the reconstruction workspace"];
  return ["Dashboard", "Operational overview and active investigations"];
}

export default function AppShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [title, description] = useMemo(() => pageMeta(location.pathname), [location.pathname]);
  const summary = WorkspaceDataService.getSummary();
  const investigatorName = summary.latestCase?.investigatingOfficer || "Local Investigator";
  const initials = investigatorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "LI";
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    const caseResults = WorkspaceDataService.getCases()
      .filter((record) =>
        [record.caseNumber, record.title, record.location, record.investigatingOfficer]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 5)
      .map((record) => ({
        id: `case-${record.id}`,
        title: record.caseNumber,
        detail: `${record.title} · ${record.location}`,
        to: `/cases/${record.id}`,
      }));
    const evidenceResults = WorkspaceDataService.getEvidence()
      .filter((item) =>
        [item.evidence.title, item.evidence.description, item.accidentCase?.caseNumber ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 3)
      .map((item) => ({
        id: `evidence-${item.id}`,
        title: item.evidence.title,
        detail: item.accidentCase?.caseNumber ?? item.reconstruction.accidentId,
        to: item.accidentCase ? `/cases/${item.accidentCase.id}/reconstruction` : "/evidence",
      }));
    return [...caseResults, ...evidenceResults].slice(0, 7);
  }, [searchQuery]);

  return (
    <div className="roadsafe-shell min-h-screen bg-[#050817] text-slate-200">
      <aside className={`roadsafe-sidebar fixed inset-y-0 left-0 z-50 w-[228px] border-r border-[#18243f] bg-[#070b19] transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-[#18243f] px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md border border-[#35558a] bg-[#0b1530] text-[#7fb1ff]">
              <ShieldCheck size={21} strokeWidth={1.7} />
            </div>
            <div>
              <p className="text-sm font-black tracking-[0.16em] text-slate-100">ROADSAFE AR</p>
              <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Accident reconstruction</p>
            </div>
          </div>
          <button className="ui-icon-button lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <nav className="space-y-1 p-3">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] font-semibold transition-colors duration-150 ${isActive ? "bg-[#111b35] text-[#8cbaff] ring-1 ring-inset ring-[#244778]" : "text-slate-400 hover:bg-[#0c1225] hover:text-slate-100"}`}
            >
              <Icon size={16} strokeWidth={1.7} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="absolute inset-x-3 bottom-3 rounded-md border border-[#18243f] bg-[#090f20] p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">System status</p>
          <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-[#6fa8ff]">
            <span className="h-2 w-2 rounded-full bg-[#4d8cf5] shadow-[0_0_10px_rgba(77,140,245,0.65)]" />
            Local workspace ready
          </div>
          <p className="mt-1 text-[8px] text-slate-600">{summary.totalCases} cases · {summary.reconstructionCount} reconstructions</p>
        </div>
      </aside>

      {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="lg:pl-[228px]">
        <header className="sticky top-0 z-30 border-b border-[#18243f] bg-[#070b19]/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <button className="ui-icon-button lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
            <div className="relative hidden max-w-md flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
              <input
                className="ui-input h-9 w-full pl-9"
                placeholder="Search cases, evidence, locations..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
              {searchQuery.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-md border border-[#1d2c4b] bg-[#080e1c] shadow-2xl">
                  {searchResults.length ? searchResults.map((result) => (
                    <Link
                      key={result.id}
                      to={result.to}
                      onClick={() => setSearchQuery("")}
                      className="block border-b border-[#17243d] px-3 py-2.5 last:border-b-0 hover:bg-[#10182d]"
                    >
                      <span className="block text-[10px] font-semibold text-slate-200">{result.title}</span>
                      <span className="mt-1 block truncate text-[8px] text-slate-600">{result.detail}</span>
                    </Link>
                  )) : (
                    <p className="px-3 py-4 text-center text-[9px] text-slate-600">No matching stored records.</p>
                  )}
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/cases" className="ui-icon-button relative" aria-label={`${summary.activeCases} active cases`} title={`${summary.activeCases} active cases`}>
                <Bell size={17} />
                {summary.activeCases > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full border border-[#29446f] bg-[#173c78] px-1 text-center text-[8px] font-bold text-white">{summary.activeCases}</span>}
              </Link>
              <div className="relative">
                <button className="flex items-center gap-2 rounded-md border border-[#1d2c4b] bg-[#0b1122] px-2.5 py-1.5 text-left transition-colors hover:bg-[#10182d]" onClick={() => setProfileOpen((value) => !value)}>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#182642] text-xs font-bold text-[#9bc1ff]">{initials}</span>
                  <span className="hidden sm:block">
                    <span className="block text-[11px] font-bold text-slate-200">{investigatorName}</span>
                    <span className="block text-[9px] text-slate-500">Investigator</span>
                  </span>
                  <ChevronDown size={14} className="text-slate-500" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-md border border-[#1d2c4b] bg-[#0a1020] p-1.5 shadow-2xl">
                    <Link to="/cases" onClick={() => setProfileOpen(false)} className="block w-full rounded px-3 py-2 text-left text-xs text-slate-300 hover:bg-[#111b35]">Investigator cases</Link>
                    <Link to="/settings" onClick={() => setProfileOpen(false)} className="block w-full rounded px-3 py-2 text-left text-xs text-slate-300 hover:bg-[#111b35]">Workspace settings</Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main>
          <div className="border-b border-[#14213a] bg-[#070c1a] px-4 py-4 lg:px-6">
            <h1 className="text-lg font-bold tracking-tight text-slate-100">{title}</h1>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <div className="p-3 sm:p-4 lg:p-5"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
