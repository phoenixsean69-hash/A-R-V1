import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  OfficerCreateFormChunk,
  OfficerCredentialChunk,
  OfficerDirectoryChunk,
  OfficerManagementOverviewChunk,
  OfficerStatusBannerChunk,
} from "../components/officers";

import { useAuth } from "../context/AuthContext";
import { OfficerManagementService } from "../services/officerManagementService";

import {
  managedOfficerRoleLabel,
  type CreateOfficerInput,
  type ManagedOfficer,
  type ManagedOfficerRole,
  type TemporaryOfficerCredential,
} from "../types/officerManagement";

const EMPTY_FORM: Omit<CreateOfficerInput, "teamId"> = {
  name: "",
  email: "",
  phone: "",
  serviceNumber: "",
  rank: "Constable",
  role: "field_officer",
};

/*
 * [RoadSafe:UIChunks:OfficerManagementV1]
 *
 * The page remains the state/data container.
 * Visual sections live under src/components/officers.
 */
export default function OfficerManagementPage() {
  const auth = useAuth();
  const teamId = auth.identity?.stationTeam?.$id ?? "";
  const currentUserId = auth.identity?.user.$id ?? "";

  const [officers, setOfficers] = useState<ManagedOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] =
    useState<ManagedOfficerRole | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [credential, setCredential] =
    useState<TemporaryOfficerCredential | null>(null);
  const [copied, setCopied] = useState(false);

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
      const records = await OfficerManagementService.list(teamId);
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

  const filteredOfficers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return officers.filter((officer) => {
      const matchesRole =
        roleFilter === "all" || officer.role === roleFilter;

      const matchesSearch =
        !query ||
        [
          officer.name,
          officer.email,
          officer.phone,
          officer.rank,
          officer.serviceNumber,
        ].some((value) => value.toLowerCase().includes(query));

      return matchesRole && matchesSearch;
    });
  }, [officers, roleFilter, search]);

  const metrics = useMemo(
    () => ({
      total: officers.length,
      field: officers.filter(
        (officer) => officer.role === "field_officer",
      ).length,
      supervisors: officers.filter(
        (officer) =>
          officer.role === "supervisor" ||
          officer.role === "station_admin",
      ).length,
      blocked: officers.filter(
        (officer) => officer.status === "blocked",
      ).length,
      temporary: officers.filter(
        (officer) => officer.mustChangePassword,
      ).length,
    }),
    [officers],
  );

  const replaceOfficer = (officer: ManagedOfficer) => {
    setOfficers((current) =>
      current.map((item) =>
        item.userId === officer.userId ? officer : item,
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
      const result = await OfficerManagementService.create({
        ...form,
        teamId,
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone?.trim() || undefined,
        serviceNumber: form.serviceNumber.trim().toUpperCase(),
        rank: form.rank.trim(),
      });

      setOfficers((current) => [result.officer, ...current]);
      setCredential(result);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setMessage(
        `${result.officer.name} was added to ${
          auth.identity?.stationTeam?.name ?? "the station"
        }.`,
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
      officer.userId === currentUserId
    ) {
      return;
    }

    setWorkingId(`role:${officer.userId}`);
    setError("");
    setMessage("");

    try {
      const updated = await OfficerManagementService.updateRole(
        teamId,
        officer,
        role,
      );
      replaceOfficer(updated);
      setMessage(
        `${officer.name} is now ${managedOfficerRoleLabel(role)}.`,
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

  const toggleStatus = async (officer: ManagedOfficer) => {
    if (officer.userId === currentUserId) return;

    const activate = officer.status === "blocked";

    if (
      !activate &&
      !window.confirm(`Block ${officer.name} from RoadSafe?`)
    ) {
      return;
    }

    setWorkingId(`status:${officer.userId}`);
    setError("");
    setMessage("");

    try {
      const updated = await OfficerManagementService.setStatus(
        teamId,
        officer,
        activate,
      );
      replaceOfficer(updated);
      setMessage(
        `${officer.name} was ${
          activate ? "reactivated" : "blocked"
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

  const resetPassword = async (officer: ManagedOfficer) => {
    if (officer.userId === currentUserId) return;

    if (
      !window.confirm(
        `Issue a new one-time temporary password for ${officer.name}?`,
      )
    ) {
      return;
    }

    setWorkingId(`password:${officer.userId}`);
    setError("");
    setMessage("");
    setCredential(null);

    try {
      const result = await OfficerManagementService.resetPassword(
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

  const removeOfficer = async (officer: ManagedOfficer) => {
    if (officer.userId === currentUserId) return;

    if (
      !window.confirm(
        `Remove ${officer.name} from this police station and block the account?`,
      )
    ) {
      return;
    }

    setWorkingId(`remove:${officer.userId}`);
    setError("");
    setMessage("");

    try {
      await OfficerManagementService.remove(teamId, officer);
      setOfficers((current) =>
        current.filter((item) => item.userId !== officer.userId),
      );
      setMessage(`${officer.name} was removed from the station.`);
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
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setError(
        "Clipboard access was blocked. Copy the temporary password manually.",
      );
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-[1500px] space-y-3">
      <OfficerManagementOverviewChunk
        stationName={
          auth.identity?.stationTeam?.name ?? "this police station"
        }
        metrics={metrics}
        showCreate={showCreate}
        onToggleCreate={() =>
          setShowCreate((current) => !current)
        }
      />

      {showCreate && (
        <OfficerCreateFormChunk
          form={form}
          creating={workingId === "create"}
          onChange={(updates) =>
            setForm((current) => ({
              ...current,
              ...updates,
            }))
          }
          onSubmit={submitOfficer}
        />
      )}

      {credential && (
        <OfficerCredentialChunk
          credential={credential}
          copied={copied}
          onClose={() => setCredential(null)}
          onCopy={() => void copyCredential()}
        />
      )}

      {(error || message) && (
        <OfficerStatusBannerChunk
          error={error}
          message={message}
        />
      )}

      <OfficerDirectoryChunk
        officers={filteredOfficers}
        loading={loading}
        currentUserId={currentUserId}
        workingId={workingId}
        search={search}
        roleFilter={roleFilter}
        onSearchChange={setSearch}
        onRoleFilterChange={setRoleFilter}
        onRefresh={() => void loadOfficers()}
        onRoleChange={(officer, role) =>
          void updateRole(officer, role)
        }
        onToggleStatus={(officer) =>
          void toggleStatus(officer)
        }
        onResetPassword={(officer) =>
          void resetPassword(officer)
        }
        onRemove={(officer) =>
          void removeOfficer(officer)
        }
      />
    </div>
  );
}
