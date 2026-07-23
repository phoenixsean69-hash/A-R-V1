import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  AppWindow,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderKanban,
  Home,
  Map,
  Menu,
  Settings,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import { WorkspaceDataService } from "../../services/workspaceDataService";

const navItems = [
  { to: "/", label: "Dashboard", icon: Home, end: true },
  { to: "/cases", label: "Cases", icon: FolderKanban },
  { to: "/reconstruction", label: "Reconstructions", icon: Boxes },
  { to: "/scene-map", label: "Scene Map", icon: Map },
  { to: "/evidence", label: "Evidence", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/footage", label: "Footage", icon: Video },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function pageMeta(pathname: string): [string, string] {
  if (pathname.startsWith("/cases/new")) {
    return ["New accident case", "Create and prepare a new investigation record"];
  }
  if (pathname.includes("/reconstruction")) {
    return ["Accident reconstruction", "Build, simulate and review the collision sequence"];
  }
  if (pathname.includes("/report")) {
    return ["Investigation report", "Review and export documented findings"];
  }
  if (pathname.includes("/footage")) {
    return ["Reconstruction footage", "Review captured reconstruction playback"];
  }
  if (pathname.startsWith("/cases/")) {
    return ["Case workspace", "Investigation details, evidence and progress"];
  }
  if (pathname === "/cases") return ["Cases", "Manage active and completed investigations"];
  if (pathname === "/scene-map") return ["Scene map", "Review accident locations and blackspot intelligence"];
  if (pathname === "/evidence") return ["Evidence", "Review scene records and documented items"];
  if (pathname === "/reports") return ["Reports", "Access generated investigation reports"];
  if (pathname === "/footage") return ["Footage", "Access saved reconstruction recordings"];
  if (pathname === "/analytics") return ["Analytics", "Operational and road-safety trends"];
  if (pathname === "/settings") return ["Settings", "Configure the reconstruction workspace"];
  return ["Dashboard", "Operational overview and active investigations"];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function AppShell() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [title, description] = useMemo(
    () => pageMeta(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = WorkspaceDataService.getSummary();
  const activeCase = summary.latestCase;
  const activeReconstruction = activeCase
    ? WorkspaceDataService.getReconstructions().find(
        (item) => item.id === activeCase.reconstructionId,
      ) ?? summary.latestReconstruction
    : summary.latestReconstruction;
  const investigatorName = activeCase?.investigatingOfficer || "Local Investigator";
  const initials = investigatorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "LI";
  const isDashboard = location.pathname === "/";
  const isReconstructionWorkspace =
    location.pathname === "/reconstruction" ||
    location.pathname.endsWith("/reconstruction");

  const quickInfo = [
    ["Case ID", activeCase?.caseNumber ?? "No active case"],
    ["Date", activeCase ? formatDate(activeCase.accidentDate) : "—"],
    ["Time", activeCase?.accidentTime || "—"],
    ["Location", activeCase?.location || "No location recorded"],
    ["Investigator", activeCase?.investigatingOfficer || "Not assigned"],
    ["Station", activeCase?.policeStation || "Not recorded"],
    ["Weather", activeReconstruction?.scene.weather || "Not configured"],
    ["Road", activeReconstruction?.scene.roadSurface || "Not configured"],
  ];

  return (
    <div className="roadsafe-shell min-h-screen bg-[#030714] text-slate-200">
      <aside
        className={`roadsafe-sidebar fixed inset-y-0 left-0 z-50 flex h-screen w-[214px] flex-col overflow-y-auto overscroll-contain border-r border-[#182849] bg-[#040918] transition-transform duration-150 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-[#182849] px-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#3765a3] bg-[#08142c] text-[#7fb0ff]">
              <ShieldCheck size={23} strokeWidth={1.65} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-black tracking-[0.12em] text-slate-100">
                ROADSAFE AR
              </p>
              <p className="truncate text-[8px] uppercase tracking-[0.13em] text-slate-500">
                Accident reconstruction system
              </p>
            </div>
          </Link>
          <button
            className="ui-icon-button lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={17} />
          </button>
        </div>

        <nav className="shrink-0 space-y-1 p-2.5">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-[11px] font-semibold transition-colors duration-100 ${
                  isActive
                    ? "bg-[#0d2448] text-[#8ebcff]"
                    : "text-slate-400 hover:bg-[#081122] hover:text-slate-100"
                }`
              }
            >
              <Icon size={15} strokeWidth={1.65} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 px-2.5 pb-2">
          <section className="rounded-md border border-[#182849] bg-[#070d1d]">
            <div className="border-b border-[#182849] px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Case quick info
              </p>
            </div>
            <dl className="divide-y divide-[#111e36] px-3">
              {quickInfo.map(([label, value]) => (
                <div key={label} className="py-2">
                  <dt className="text-[7px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                    {label}
                  </dt>
                  <dd className="mt-1 break-words text-[9px] leading-4 text-slate-300">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <div className="mt-auto shrink-0 border-t border-[#182849] p-3">
          <p className="text-[8px] font-bold uppercase tracking-[0.13em] text-slate-600">
            System status
          </p>
          <div className="mt-2 flex items-center gap-2 text-[9px] font-semibold text-[#6fa8ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4d8cf5] shadow-[0_0_9px_rgba(77,140,245,0.7)]" />
            All local services operational
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/65 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="lg:pl-[214px]">
        {!isReconstructionWorkspace && (
        <header className="sticky top-0 z-30 border-b border-[#182849] bg-[#040918]/96 backdrop-blur">
          <div className="flex min-h-[68px] items-center gap-3 px-3 sm:px-4 lg:px-5">
            <button
              className="ui-icon-button lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>

            <div className="min-w-0 border-l border-[#244b7f] pl-4">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                Case: {activeCase?.caseNumber ?? "No active case"}
              </p>
              <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-[0.08em] text-[#6fa8ff]">
                Status: {activeCase?.status ?? "Workspace ready"}
              </p>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              <Link to="/" className="ui-icon-button hidden sm:grid" aria-label="Dashboard">
                <AppWindow size={16} />
              </Link>
              <Link
                to="/cases"
                className="ui-icon-button relative hidden sm:grid"
                aria-label={`${summary.activeCases} active cases`}
              >
                <Bell size={16} />
                {summary.activeCases > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full border border-[#315786] bg-[#153f79] px-1 text-center text-[7px] font-bold text-white">
                    {summary.activeCases}
                  </span>
                )}
              </Link>
              <Link to="/settings" className="ui-icon-button hidden sm:grid" aria-label="Settings">
                <Settings size={16} />
              </Link>

              <div className="hidden border-l border-[#182849] px-3 text-right sm:block">
                <p className="font-mono text-[10px] font-semibold text-slate-300">
                  {now.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
                <p className="mt-1 text-[7px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                  {now.toLocaleDateString([], {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="relative">
                <button
                  className="flex min-h-10 items-center gap-2 rounded-md border border-[#1d3155] bg-[#071124] px-2.5 py-1.5 text-left transition-colors duration-100 hover:bg-[#0a1730]"
                  onClick={() => setProfileOpen((value) => !value)}
                >
                  <span className="grid h-7 w-7 place-items-center rounded-md border border-[#284b7e] bg-[#102344] text-[10px] font-bold text-[#9bc1ff]">
                    {initials}
                  </span>
                  <span className="hidden md:block">
                    <span className="block text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Investigator
                    </span>
                    <span className="mt-0.5 block max-w-32 truncate text-[9px] font-semibold text-slate-200">
                      {investigatorName}
                    </span>
                  </span>
                  <ChevronDown size={13} className="text-slate-500" />
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-md border border-[#1d3155] bg-[#071124] p-1.5 shadow-2xl">
                    <Link
                      to="/cases"
                      onClick={() => setProfileOpen(false)}
                      className="block rounded px-3 py-2 text-[10px] text-slate-300 hover:bg-[#0d1c37]"
                    >
                      Investigator cases
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="block rounded px-3 py-2 text-[10px] text-slate-300 hover:bg-[#0d1c37]"
                    >
                      Workspace settings
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        )}

        <main className={isReconstructionWorkspace ? "reconstruction-shell-main" : undefined}>
          {!isDashboard && !isReconstructionWorkspace && (
            <div className="border-b border-[#14213a] bg-[#050b18] px-4 py-3.5 lg:px-5">
              <h1 className="text-base font-bold tracking-tight text-slate-100">{title}</h1>
              <p className="mt-1 text-[10px] text-slate-500">{description}</p>
            </div>
          )}
          <div className={isReconstructionWorkspace ? "p-0" : isDashboard ? "p-2.5 sm:p-3" : "p-3 sm:p-4 lg:p-5"}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
