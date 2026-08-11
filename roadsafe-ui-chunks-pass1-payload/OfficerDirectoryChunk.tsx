import {
  Ban,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Users,
} from "../icons/materialIcons";

import {
  MANAGED_OFFICER_ROLES,
  managedOfficerRoleLabel,
  type ManagedOfficer,
  type ManagedOfficerRole,
} from "../../types/officerManagement";

function formatDate(value: string): string {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "PO"
  );
}

function roleBadgeClass(role: ManagedOfficerRole): string {
  if (role === "station_admin") {
    return "border-[#6d5523] bg-[#241d10] text-[#d9bd78]";
  }

  return "border-[#494949] bg-[#303030] text-[#c4c4c4]";
}

interface Props {
  officers: ManagedOfficer[];
  loading: boolean;
  currentUserId: string;
  workingId: string;
  search: string;
  roleFilter: ManagedOfficerRole | "all";
  onSearchChange(value: string): void;
  onRoleFilterChange(value: ManagedOfficerRole | "all"): void;
  onRefresh(): void;
  onRoleChange(
    officer: ManagedOfficer,
    role: ManagedOfficerRole,
  ): void;
  onToggleStatus(officer: ManagedOfficer): void;
  onResetPassword(officer: ManagedOfficer): void;
  onRemove(officer: ManagedOfficer): void;
}

export default function OfficerDirectoryChunk({
  officers,
  loading,
  currentUserId,
  workingId,
  search,
  roleFilter,
  onSearchChange,
  onRoleFilterChange,
  onRefresh,
  onRoleChange,
  onToggleStatus,
  onResetPassword,
  onRemove,
}: Props) {
  return (
    <section className="ui-panel overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-[#494949] p-3">
        <label className="relative min-w-[230px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
          />

          <input
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            className="ui-input w-full pl-9"
            placeholder="Search name, service number, rank or email"
          />
        </label>

        <select
          value={roleFilter}
          onChange={(event) =>
            onRoleFilterChange(
              event.target.value as
                | ManagedOfficerRole
                | "all",
            )
          }
          className="ui-input min-w-[190px]"
        >
          <option value="all">
            All roles
          </option>

          {MANAGED_OFFICER_ROLES.map((role) => (
            <option
              key={role.value}
              value={role.value}
            >
              {role.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="ui-button"
          disabled={loading}
          onClick={onRefresh}
        >
          <RefreshCw
            size={13}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid min-h-64 place-items-center">
          <div className="text-center">
            <Loader2
              size={24}
              className="mx-auto animate-spin text-[#c4c4c4]"
            />
            <p className="mt-3 text-[10px] text-slate-500">
              Loading station officers…
            </p>
          </div>
        </div>
      ) : officers.length === 0 ? (
        <div className="grid min-h-64 place-items-center p-6 text-center">
          <div>
            <Users
              size={24}
              className="mx-auto text-slate-700"
            />
            <p className="mt-3 text-xs font-bold text-slate-300">
              No matching officers
            </p>
            <p className="mt-2 text-[9px] text-slate-600">
              Change the filters or create the first station officer.
            </p>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#303030]">
          {officers.map((officer) => {
            const isSelf =
              officer.userId === currentUserId;
            const busy =
              workingId.endsWith(officer.userId);

            return (
              <article
                key={officer.membershipId}
                className="grid min-w-0 gap-3 p-4 xl:grid-cols-[minmax(250px,1.2fr)_minmax(180px,0.8fr)_minmax(220px,0.8fr)_auto]"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#494949] bg-[#303030] text-[10px] font-black text-[#9bc1ff]">
                    {initials(officer.name)}
                  </span>

                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="truncate text-xs font-bold text-slate-100">
                        {officer.name}
                      </h3>

                      {isSelf && (
                        <span className="rounded border border-[#494949] bg-[#303030] px-1.5 py-0.5 text-[7px] font-black uppercase text-[#c4c4c4]">
                          You
                        </span>
                      )}

                      <span
                        className={`rounded border px-1.5 py-0.5 text-[7px] font-black uppercase ${roleBadgeClass(
                          officer.role,
                        )}`}
                      >
                        {managedOfficerRoleLabel(officer.role)}
                      </span>
                    </div>

                    <p className="mt-2 truncate text-[9px] text-slate-500">
                      {officer.rank} ·{" "}
                      {officer.serviceNumber ||
                        "No service number"}
                    </p>

                    <p className="mt-1 break-all text-[8px] text-slate-600">
                      {officer.email}
                      {officer.phone
                        ? ` · ${officer.phone}`
                        : ""}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-700">
                      Account
                    </p>
                    <p
                      className={`mt-1 text-[9px] font-bold ${
                        officer.status === "active"
                          ? "text-[#c4c4c4]"
                          : "text-[#e28b9d]"
                      }`}
                    >
                      {officer.status === "active"
                        ? "Active"
                        : "Blocked"}
                    </p>
                  </div>

                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-700">
                      Password
                    </p>
                    <p className="mt-1 text-[9px] font-bold text-slate-400">
                      {officer.mustChangePassword
                        ? "Temporary"
                        : "Private"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-700">
                      Joined
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                      {formatDate(officer.joinedAt)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-700">
                      Last activity
                    </p>
                    <p className="mt-1 text-[9px] text-slate-400">
                      {formatDate(officer.lastActivityAt)}
                    </p>
                  </div>

                  <label className="col-span-2">
                    <span className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-700">
                      Station role
                    </span>
                    <select
                      value={officer.role}
                      disabled={isSelf || busy}
                      onChange={(event) =>
                        onRoleChange(
                          officer,
                          event.target
                            .value as ManagedOfficerRole,
                        )
                      }
                      className="ui-input mt-1 w-full"
                    >
                      {MANAGED_OFFICER_ROLES.map((role) => (
                        <option
                          key={role.value}
                          value={role.value}
                        >
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <button
                    type="button"
                    className="ui-icon-button"
                    disabled={isSelf || busy}
                    title={
                      officer.status === "active"
                        ? "Block officer"
                        : "Reactivate officer"
                    }
                    onClick={() =>
                      onToggleStatus(officer)
                    }
                  >
                    {busy &&
                    workingId.startsWith("status:") ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    ) : officer.status === "active" ? (
                      <Ban size={14} />
                    ) : (
                      <UserCheck size={14} />
                    )}
                  </button>

                  <button
                    type="button"
                    className="ui-icon-button"
                    disabled={isSelf || busy}
                    title="Reset temporary password"
                    onClick={() =>
                      onResetPassword(officer)
                    }
                  >
                    {busy &&
                    workingId.startsWith("password:") ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <KeyRound size={14} />
                    )}
                  </button>

                  <button
                    type="button"
                    className="ui-icon-button text-[#e28b9d]"
                    disabled={isSelf || busy}
                    title="Remove from station"
                    onClick={() => onRemove(officer)}
                  >
                    {busy &&
                    workingId.startsWith("remove:") ? (
                      <Loader2
                        size={14}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
