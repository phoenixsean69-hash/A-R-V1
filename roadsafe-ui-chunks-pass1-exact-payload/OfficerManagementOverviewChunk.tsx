import {
  Ban,
  KeyRound,
  Plus,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
  X,
} from "../icons/materialIcons";

interface OfficerMetrics {
  total: number;
  field: number;
  supervisors: number;
  blocked: number;
  temporary: number;
}

interface Props {
  stationName: string;
  metrics: OfficerMetrics;
  showCreate: boolean;
  onToggleCreate(): void;
}

export default function OfficerManagementOverviewChunk({
  stationName,
  metrics,
  showCreate,
  onToggleCreate,
}: Props) {
  const cards = [
    ["Station members", metrics.total, Users],
    ["Field officers", metrics.field, UserCheck],
    ["Supervisors / admins", metrics.supervisors, ShieldCheck],
    ["Temporary passwords", metrics.temporary, KeyRound],
    ["Blocked", metrics.blocked, Ban],
  ] as const;

  return (
    <section className="ui-panel overflow-hidden">
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-[#494949] p-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#494949] bg-[#303030] text-[#c4c4c4]">
            <UserCog size={21} />
          </div>

          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#c4c4c4]">
              Station administration
            </p>

            <h1 className="mt-1 text-xl font-bold text-slate-100">
              Officer management
            </h1>

            <p className="mt-2 max-w-3xl text-[10px] leading-5 text-slate-500">
              Create and control RoadSafe accounts for{" "}
              {stationName}.
              Officers never need Admin access.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="ui-button-primary"
          onClick={onToggleCreate}
        >
          {showCreate ? <X size={14} /> : <Plus size={14} />}
          {showCreate ? "Close form" : "Add officer"}
        </button>
      </header>

      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value, Icon]) => (
          <div
            key={label}
            className="rounded-md border border-[#494949] bg-[#303030] p-3"
          >
            <Icon
              size={15}
              className="text-[#c4c4c4]"
            />
            <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.09em] text-slate-600">
              {label}
            </p>
            <p className="mt-1 text-xl font-bold text-slate-100">
              {value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
