import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Ban,
  CheckCircle2,
  Clipboard,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { OfficerManagementService } from "../services/officerManagementService";
import {
  MANAGED_OFFICER_ROLES,
  ZIMBABWE_POLICE_RANKS,
  managedOfficerRoleLabel,
  type CreateOfficerInput,
  type ManagedOfficer,
  type ManagedOfficerRole,
  type TemporaryOfficerCredential,
} from "../types/officerManagement";

const EMPTY_FORM: Omit<
  CreateOfficerInput,
  "teamId"
> = {
  name: "",
  email: "",
  phone: "",
  serviceNumber: "",
  rank: "Constable",
  role: "field_officer",
};

function formatDate(
  value: string,
): string {
  if (!value) return "Never";

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase(),
      )
      .join("") || "PO"
  );
}

function roleBadgeClass(
  role: ManagedOfficerRole,
): string {
  if (role === "station_admin") {
    return "border-[#6d5523] bg-[#241d10] text-[#d9bd78]";
  }

  if (role === "supervisor") {
    return "border-[#28645e] bg-[#0d2928] text-[#8ed6ca]";
  }

  return "border-[#315b91] bg-[#0b1b38] text-[#8ebcff]";
}

export default function OfficerManagementPage() {
  const auth = useAuth();
  const teamId =
    auth.identity?.stationTeam?.$id ??
    "";
  const currentUserId =
    auth.identity?.user.$id ?? "";

  const [officers, setOfficers] =
    useState<ManagedOfficer[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [workingId, setWorkingId] =
    useState("");
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");
  const [search, setSearch] =
    useState("");
  const [roleFilter, setRoleFilter] =
    useState<
      ManagedOfficerRole | "all"
    >("all");
  const [showCreate, setShowCreate] =
    useState(false);
  const [form, setForm] =
    useState(EMPTY_FORM);
  const [credential, setCredential] =
    useState<TemporaryOfficerCredential | null>(
      null,
    );
  const [copied, setCopied] =
    useState(false);

  const loadOfficers = async () => {
    if (!teamId) {
      setError(
        "No police-station Team is assigned to this administrator.",
      );
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const records =
        await OfficerManagementService.list(
          teamId,
        );
      setOfficers(records);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Officer records could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOfficers();
  }, [teamId]);

  const filteredOfficers = useMemo(
    () => {
      const query =
        search.trim().toLowerCase();

      return officers.filter(
        (officer) => {
          const matchesRole =
            roleFilter === "all" ||
            officer.role ===
              roleFilter;

          const matchesSearch =
            !query ||
            [
              officer.name,
              officer.email,
              officer.phone,
              officer.rank,
              officer.serviceNumber,
            ].some((value) =>
              value
                .toLowerCase()
                .includes(query),
            );

          return (
            matchesRole &&
            matchesSearch
          );
        },
      );
    },
    [
      officers,
      roleFilter,
      search,
    ],
  );

  const metrics = useMemo(
    () => ({
      total: officers.length,
      field: officers.filter(
        (officer) =>
          officer.role ===
          "field_officer",
      ).length,
      supervisors: officers.filter(
        (officer) =>
          officer.role ===
            "supervisor" ||
          officer.role ===
            "station_admin",
      ).length,
      blocked: officers.filter(
        (officer) =>
          officer.status ===
          "blocked",
      ).length,
      temporary: officers.filter(
        (officer) =>
          officer.mustChangePassword,
      ).length,
    }),
    [officers],
  );

  const replaceOfficer = (
    officer: ManagedOfficer,
  ) => {
    setOfficers((current) =>
      current.map((item) =>
        item.userId ===
        officer.userId
          ? officer
          : item,
      ),
    );
  };

  const submitOfficer = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!teamId) return;

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.serviceNumber.trim() ||
      !form.rank.trim()
    ) {
      setError(
        "Name, email, service number and rank are required.",
      );
      return;
    }

    setWorkingId("create");
    setError("");
    setMessage("");
    setCredential(null);

    try {
      const result =
        await OfficerManagementService.create(
          {
            ...form,
            teamId,
            name: form.name.trim(),
            email: form.email
              .trim()
              .toLowerCase(),
            phone:
              form.phone?.trim() ||
              undefined,
            serviceNumber:
              form.serviceNumber
                .trim()
                .toUpperCase(),
            rank: form.rank.trim(),
          },
        );

      setOfficers((current) => [
        result.officer,
        ...current,
      ]);
      setCredential(result);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setMessage(
        `${result.officer.name} was added to ${auth.identity?.stationTeam?.name ?? "the station"}.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The officer account could not be created.",
      );
    } finally {
      setWorkingId("");
    }
  };

  const updateRole = async (
    officer: ManagedOfficer,
    role: ManagedOfficerRole,
  ) => {
    if (
      role === officer.role ||
      officer.userId ===
        currentUserId
    ) {
      return;
    }

    setWorkingId(
      `role:${officer.userId}`,
    );
    setError("");
    setMessage("");

    try {
      const updated =
        await OfficerManagementService.updateRole(
          teamId,
          officer,
          role,
        );
      replaceOfficer(updated);
      setMessage(
        `${officer.name} is now ${managedOfficerRoleLabel(
          role,
        )}.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The officer role could not be changed.",
      );
    } finally {
      setWorkingId("");
    }
  };

  const toggleStatus = async (
    officer: ManagedOfficer,
  ) => {
    if (
      officer.userId ===
      currentUserId
    ) {
      return;
    }

    const activate =
      officer.status === "blocked";

    if (
      !activate &&
      !window.confirm(
        `Block ${officer.name} from RoadSafe?`,
      )
    ) {
      return;
    }

    setWorkingId(
      `status:${officer.userId}`,
    );
    setError("");
    setMessage("");

    try {
      const updated =
        await OfficerManagementService.setStatus(
          teamId,
          officer,
          activate,
        );
      replaceOfficer(updated);
      setMessage(
        `${officer.name} was ${
          activate
            ? "reactivated"
            : "blocked"
        }.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The officer status could not be changed.",
      );
    } finally {
      setWorkingId("");
    }
  };

  const resetPassword = async (
    officer: ManagedOfficer,
  ) => {
    if (
      officer.userId ===
      currentUserId
    ) {
      return;
    }

    if (
      !window.confirm(
        `Issue a new one-time temporary password for ${officer.name}?`,
      )
    ) {
      return;
    }

    setWorkingId(
      `password:${officer.userId}`,
    );
    setError("");
    setMessage("");
    setCredential(null);

    try {
      const result =
        await OfficerManagementService.resetPassword(
          teamId,
          officer,
        );
      replaceOfficer(result.officer);
      setCredential(result);
      setMessage(
        `A new one-time password was issued for ${officer.name}.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The temporary password could not be reset.",
      );
    } finally {
      setWorkingId("");
    }
  };

  const removeOfficer = async (
    officer: ManagedOfficer,
  ) => {
    if (
      officer.userId ===
      currentUserId
    ) {
      return;
    }

    if (
      !window.confirm(
        `Remove ${officer.name} from this police station and block the account?`,
      )
    ) {
      return;
    }

    setWorkingId(
      `remove:${officer.userId}`,
    );
    setError("");
    setMessage("");

    try {
      await OfficerManagementService.remove(
        teamId,
        officer,
      );
      setOfficers((current) =>
        current.filter(
          (item) =>
            item.userId !==
            officer.userId,
        ),
      );
      setMessage(
        `${officer.name} was removed from the station.`,
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The officer could not be removed.",
      );
    } finally {
      setWorkingId("");
    }
  };

  const copyCredential = async () => {
    if (!credential) return;

    const text = [
      "RoadSafe AR account",
      `Officer: ${credential.officer.name}`,
      `Station: ${auth.identity?.stationTeam?.name ?? ""}`,
      `Email: ${credential.officer.email}`,
      `Temporary password: ${credential.temporaryPassword}`,
      "The officer must change this password immediately after signing in.",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(
        text,
      );
      setCopied(true);
      window.setTimeout(
        () => setCopied(false),
        2_000,
      );
    } catch {
      setError(
        "Clipboard access was blocked. Copy the temporary password manually.",
      );
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-[1500px] space-y-3">
      <section className="ui-panel overflow-hidden">
        <header className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b border-[#18243f] p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#315b91] bg-[#0b1b38] text-[#8ebcff]">
              <UserCog size={21} />
            </div>

            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#79adfa]">
                Station administration
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-100">
                Officer management
              </h1>
              <p className="mt-2 max-w-3xl text-[10px] leading-5 text-slate-500">
                Create and control RoadSafe accounts for{" "}
                {auth.identity?.stationTeam?.name ??
                  "this police station"}.
                Officers never need Appwrite Console access.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ui-button-primary"
            onClick={() =>
              setShowCreate(
                (current) => !current,
              )
            }
          >
            {showCreate ? (
              <X size={14} />
            ) : (
              <Plus size={14} />
            )}
            {showCreate
              ? "Close form"
              : "Add officer"}
          </button>
        </header>

        <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            [
              "Station members",
              metrics.total,
              Users,
            ],
            [
              "Field officers",
              metrics.field,
              UserCheck,
            ],
            [
              "Supervisors / admins",
              metrics.supervisors,
              ShieldCheck,
            ],
            [
              "Temporary passwords",
              metrics.temporary,
              KeyRound,
            ],
            [
              "Blocked",
              metrics.blocked,
              Ban,
            ],
          ].map(
            ([label, value, Icon]) => {
              const MetricIcon =
                Icon as typeof Users;

              return (
                <div
                  key={String(label)}
                  className="rounded-md border border-[#18243f] bg-[#070d1a] p-3"
                >
                  <MetricIcon
                    size={15}
                    className="text-[#8ebcff]"
                  />
                  <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.09em] text-slate-600">
                    {String(label)}
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-100">
                    {String(value)}
                  </p>
                </div>
              );
            },
          )}
        </div>
      </section>

      {showCreate && (
        <section className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">
                Create officer account
              </h2>
              <p className="mt-1 text-[9px] text-slate-600">
                RoadSafe will create the Appwrite user and active station membership.
              </p>
            </div>
          </div>

          <form
            onSubmit={submitOfficer}
            className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <label className="block">
              <span className="text-[9px] font-bold text-slate-400">
                Full name
              </span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="ui-input mt-2 w-full"
                placeholder="Officer full name"
              />
            </label>

            <label className="block">
              <span className="text-[9px] font-bold text-slate-400">
                Police service number
              </span>
              <input
                value={
                  form.serviceNumber
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    serviceNumber:
                      event.target.value,
                  }))
                }
                className="ui-input mt-2 w-full uppercase"
                placeholder="ZRP service number"
              />
            </label>

            <label className="block">
              <span className="text-[9px] font-bold text-slate-400">
                Rank
              </span>
              <select
                value={form.rank}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    rank:
                      event.target.value,
                  }))
                }
                className="ui-input mt-2 w-full"
              >
                {ZIMBABWE_POLICE_RANKS.map(
                  (rank) => (
                    <option
                      key={rank}
                      value={rank}
                    >
                      {rank}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="block">
              <span className="text-[9px] font-bold text-slate-400">
                Official email
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    email:
                      event.target.value,
                  }))
                }
                className="ui-input mt-2 w-full"
                placeholder="officer@station.gov.zw"
              />
            </label>

            <label className="block">
              <span className="text-[9px] font-bold text-slate-400">
                Phone number
              </span>
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone:
                      event.target.value,
                  }))
                }
                className="ui-input mt-2 w-full"
                placeholder="+263771234567"
              />
            </label>

            <label className="block">
              <span className="text-[9px] font-bold text-slate-400">
                RoadSafe role
              </span>
              <select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role:
                      event.target
                        .value as ManagedOfficerRole,
                  }))
                }
                className="ui-input mt-2 w-full"
              >
                {MANAGED_OFFICER_ROLES.map(
                  (role) => (
                    <option
                      key={role.value}
                      value={role.value}
                    >
                      {role.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <div className="md:col-span-2 xl:col-span-3">
              <button
                type="submit"
                disabled={
                  workingId === "create"
                }
                className="ui-button-primary"
              >
                {workingId === "create" ? (
                  <Loader2
                    size={14}
                    className="animate-spin"
                  />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {workingId === "create"
                  ? "Creating secure account…"
                  : "Create and assign officer"}
              </button>
            </div>
          </form>
        </section>
      )}

      {credential && (
        <section className="overflow-hidden rounded-md border border-[#6d5523] bg-[#241d10]">
          <header className="flex min-w-0 flex-wrap items-start justify-between gap-3 border-b border-[#6d5523] p-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#d9bd78]">
                One-time credentials
              </p>
              <h2 className="mt-1 text-sm font-bold text-slate-100">
                Give these credentials directly to{" "}
                {credential.officer.name}
              </h2>
              <p className="mt-2 text-[9px] leading-5 text-[#aa8f56]">
                RoadSafe does not store or show this temporary password again.
              </p>
            </div>

            <button
              type="button"
              className="ui-button"
              onClick={() =>
                setCredential(null)
              }
            >
              <X size={13} />
              Close
            </button>
          </header>

          <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
            <div className="rounded-md border border-[#7b622a] bg-[#130f08] p-4">
              <p className="text-[8px] font-bold uppercase tracking-[0.09em] text-[#8d7545]">
                Login email
              </p>
              <p className="mt-2 break-all font-mono text-[11px] font-bold text-slate-200">
                {credential.officer.email}
              </p>

              <p className="mt-4 text-[8px] font-bold uppercase tracking-[0.09em] text-[#8d7545]">
                Temporary password
              </p>
              <p className="mt-2 break-all font-mono text-sm font-black tracking-[0.06em] text-[#f0d48d]">
                {credential.temporaryPassword}
              </p>
            </div>

            <div className="flex flex-col justify-between gap-3">
              <p className="text-[9px] leading-5 text-[#c4a967]">
                The officer signs in normally. RoadSafe then
                blocks all case access until they create a new
                private password.
              </p>

              <button
                type="button"
                className="ui-button-primary"
                onClick={() =>
                  void copyCredential()
                }
              >
                {copied ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Clipboard size={14} />
                )}
                {copied
                  ? "Credentials copied"
                  : "Copy officer instructions"}
              </button>
            </div>
          </div>
        </section>
      )}

      {(error || message) && (
        <div
          role={error ? "alert" : "status"}
          className={`rounded-md border px-3 py-2.5 text-[10px] leading-5 ${
            error
              ? "border-[#713646] bg-[#321722] text-[#e28b9d]"
              : "border-[#28645e] bg-[#0d2928] text-[#8ed6ca]"
          }`}
        >
          {error || message}
        </div>
      )}

      <section className="ui-panel overflow-hidden">
        <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-[#18243f] p-3">
          <label className="relative min-w-[230px] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              className="ui-input w-full pl-9"
              placeholder="Search name, service number, rank or email"
            />
          </label>

          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(
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
            {MANAGED_OFFICER_ROLES.map(
              (role) => (
                <option
                  key={role.value}
                  value={role.value}
                >
                  {role.label}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            className="ui-button"
            disabled={loading}
            onClick={() =>
              void loadOfficers()
            }
          >
            <RefreshCw
              size={13}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <div className="text-center">
              <Loader2
                size={24}
                className="mx-auto animate-spin text-[#8ebcff]"
              />
              <p className="mt-3 text-[10px] text-slate-500">
                Loading station officers…
              </p>
            </div>
          </div>
        ) : filteredOfficers.length === 0 ? (
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
          <div className="divide-y divide-[#111e36]">
            {filteredOfficers.map(
              (officer) => {
                const isSelf =
                  officer.userId ===
                  currentUserId;
                const busy =
                  workingId.endsWith(
                    officer.userId,
                  );

                return (
                  <article
                    key={officer.membershipId}
                    className="grid min-w-0 gap-3 p-4 xl:grid-cols-[minmax(250px,1.2fr)_minmax(180px,0.8fr)_minmax(220px,0.8fr)_auto]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#284b7e] bg-[#102344] text-[10px] font-black text-[#9bc1ff]">
                        {initials(
                          officer.name,
                        )}
                      </span>

                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h3 className="truncate text-xs font-bold text-slate-100">
                            {officer.name}
                          </h3>
                          {isSelf && (
                            <span className="rounded border border-[#315b91] bg-[#0b1b38] px-1.5 py-0.5 text-[7px] font-black uppercase text-[#8ebcff]">
                              You
                            </span>
                          )}
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[7px] font-black uppercase ${roleBadgeClass(
                              officer.role,
                            )}`}
                          >
                            {managedOfficerRoleLabel(
                              officer.role,
                            )}
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
                            officer.status ===
                            "active"
                              ? "text-[#8ed6ca]"
                              : "text-[#e28b9d]"
                          }`}
                        >
                          {officer.status ===
                          "active"
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
                          {formatDate(
                            officer.joinedAt,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-700">
                          Last activity
                        </p>
                        <p className="mt-1 text-[9px] text-slate-400">
                          {formatDate(
                            officer.lastActivityAt,
                          )}
                        </p>
                      </div>

                      <label className="col-span-2">
                        <span className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-700">
                          Station role
                        </span>
                        <select
                          value={officer.role}
                          disabled={
                            isSelf || busy
                          }
                          onChange={(event) =>
                            void updateRole(
                              officer,
                              event.target
                                .value as ManagedOfficerRole,
                            )
                          }
                          className="ui-input mt-1 w-full"
                        >
                          {MANAGED_OFFICER_ROLES.map(
                            (role) => (
                              <option
                                key={
                                  role.value
                                }
                                value={
                                  role.value
                                }
                              >
                                {
                                  role.label
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      <button
                        type="button"
                        className="ui-icon-button"
                        disabled={
                          isSelf || busy
                        }
                        title={
                          officer.status ===
                          "active"
                            ? "Block officer"
                            : "Reactivate officer"
                        }
                        onClick={() =>
                          void toggleStatus(
                            officer,
                          )
                        }
                      >
                        {busy &&
                        workingId.startsWith(
                          "status:",
                        ) ? (
                          <Loader2
                            size={14}
                            className="animate-spin"
                          />
                        ) : officer.status ===
                          "active" ? (
                          <Ban size={14} />
                        ) : (
                          <UserCheck size={14} />
                        )}
                      </button>

                      <button
                        type="button"
                        className="ui-icon-button"
                        disabled={
                          isSelf || busy
                        }
                        title="Reset temporary password"
                        onClick={() =>
                          void resetPassword(
                            officer,
                          )
                        }
                      >
                        {busy &&
                        workingId.startsWith(
                          "password:",
                        ) ? (
                          <Loader2
                            size={14}
                            className="animate-spin"
                          />
                        ) : (
                          <KeyRound
                            size={14}
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        className="ui-icon-button text-[#e28b9d]"
                        disabled={
                          isSelf || busy
                        }
                        title="Remove from station"
                        onClick={() =>
                          void removeOfficer(
                            officer,
                          )
                        }
                      >
                        {busy &&
                        workingId.startsWith(
                          "remove:",
                        ) ? (
                          <Loader2
                            size={14}
                            className="animate-spin"
                          />
                        ) : (
                          <Trash2
                            size={14}
                          />
                        )}
                      </button>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </div>
  );
}
