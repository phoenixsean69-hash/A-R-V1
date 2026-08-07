import {
  Camera,
  ClipboardList,
  MapPinned,
  Orbit,
  Plus,
  RadioTower,
  ShieldCheck,
} from "../components/icons/materialIcons";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { WorkspaceDataService } from "../services/workspaceDataService";

export default function FieldDashboardPage() {
  const auth = useAuth();
  const summary = WorkspaceDataService.getSummary();
  const activeCase = summary.latestCase;

  const actions = [
    {
      to: "/cases/new",
      label: "Start scene",
      detail: "Create a case and mark the exact accident location.",
      icon: Plus,
      primary: true,
    },
    {
      to: "/cases",
      label: "My cases",
      detail: "Continue active investigations and evidence capture.",
      icon: ClipboardList,
    },
    {
      to: "/reconstruction",
      label: "Reconstruct",
      detail: "Open the last selected accident reconstruction.",
      icon: Orbit,
    },
    {
      to: "/scene-map",
      label: "Scene map",
      detail: "Review accident positions and road geometry.",
      icon: MapPinned,
    },
  ];

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-3">
      <section className="ui-panel overflow-hidden">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-[#494949] p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#494949] bg-[#303030] text-[#c4c4c4]">
              <RadioTower size={21} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#c4c4c4]">
                Field Client
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-100">
                Scene operations
              </h1>
              <p className="mt-2 max-w-2xl text-[10px] leading-5 text-slate-500">
                Welcome, {auth.identity?.user.name || "Officer"}.
                Capture the scene accurately while your station
                receives the investigation record.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded border border-[#494949] bg-[#303030] px-3 py-2 text-[9px] font-bold text-[#c4c4c4]">
            <ShieldCheck size={13} />
            {auth.identity?.stationTeam?.name ??
              "Station assignment pending"}
          </span>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map(
            ({
              to,
              label,
              detail,
              icon: Icon,
              primary,
            }) => (
              <Link
                key={to}
                to={to}
                className={`min-w-0 rounded-md border p-4 transition-colors ${
                  primary
                    ? "border-[#494949] bg-[#303030] hover:bg-[#303030]"
                    : "border-[#494949] bg-[#303030] hover:border-[#494949] hover:bg-[#303030]"
                }`}
              >
                <Icon
                  size={18}
                  className={
                    primary
                      ? "text-white"
                      : "text-[#c4c4c4]"
                  }
                />
                <h2 className="mt-3 text-sm font-bold text-slate-100">
                  {label}
                </h2>
                <p className="mt-2 text-[9px] leading-5 text-slate-500">
                  {detail}
                </p>
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_320px]">
        <article className="ui-panel min-w-0 p-4">
          <div className="flex items-center gap-2">
            <Camera
              size={15}
              className="text-[#c4c4c4]"
            />
            <h2 className="ui-panel-title">
              Current field assignment
            </h2>
          </div>

          {activeCase ? (
            <div className="mt-4">
              <p className="text-[10px] font-bold text-[#c4c4c4]">
                {activeCase.caseNumber}
              </p>
              <h3 className="mt-1 text-base font-bold text-slate-100">
                {activeCase.title}
              </h3>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">
                {activeCase.location}
              </p>
              <Link
                to={`/cases/${activeCase.id}`}
                className="ui-button-primary mt-4"
              >
                Continue case
              </Link>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-[#494949] bg-[#303030] p-6 text-center">
              <p className="text-[10px] font-bold text-slate-300">
                No active local case
              </p>
              <p className="mt-2 text-[9px] leading-5 text-slate-600">
                Start a new scene when dispatched to an accident.
              </p>
            </div>
          )}
        </article>

        <article className="ui-panel min-w-0 p-4">
          <h2 className="ui-panel-title">
            Connected workflow
          </h2>
          <div className="mt-4 space-y-3">
            {[
              "Capture the exact scene",
              "Add evidence and reconstruction",
              "Sync changes to the station",
              "Receive supervisor review",
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-start gap-3"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#494949] bg-[#303030] font-mono text-[8px] font-bold text-[#c4c4c4]">
                  {String(index + 1).padStart(
                    2,
                    "0",
                  )}
                </span>
                <p className="pt-1 text-[10px] leading-5 text-slate-400">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
