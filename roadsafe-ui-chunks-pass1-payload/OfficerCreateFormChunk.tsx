import type {
  FormEvent,
} from "react";

import {
  Loader2,
  ShieldCheck,
} from "../icons/materialIcons";

import {
  MANAGED_OFFICER_ROLES,
  ZIMBABWE_POLICE_RANKS,
  type CreateOfficerInput,
  type ManagedOfficerRole,
} from "../../types/officerManagement";

type OfficerForm =
  Omit<CreateOfficerInput, "teamId">;

interface Props {
  form: OfficerForm;
  creating: boolean;
  onChange(
    updates: Partial<OfficerForm>,
  ): void;
  onSubmit(
    event: FormEvent<HTMLFormElement>,
  ): void;
}

export default function OfficerCreateFormChunk({
  form,
  creating,
  onChange,
  onSubmit,
}: Props) {
  return (
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
        onSubmit={onSubmit}
        className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <label className="block">
          <span className="text-[9px] font-bold text-slate-400">
            Full name
          </span>
          <input
            value={form.name}
            onChange={(event) =>
              onChange({
                name: event.target.value,
              })
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
            value={form.serviceNumber}
            onChange={(event) =>
              onChange({
                serviceNumber: event.target.value,
              })
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
              onChange({
                rank: event.target.value,
              })
            }
            className="ui-input mt-2 w-full"
          >
            {ZIMBABWE_POLICE_RANKS.map((rank) => (
              <option
                key={rank}
                value={rank}
              >
                {rank}
              </option>
            ))}
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
              onChange({
                email: event.target.value,
              })
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
              onChange({
                phone: event.target.value,
              })
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
              onChange({
                role:
                  event.target
                    .value as ManagedOfficerRole,
              })
            }
            className="ui-input mt-2 w-full"
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

        <div className="md:col-span-2 xl:col-span-3">
          <button
            type="submit"
            disabled={creating}
            className="ui-button-primary"
          >
            {creating ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <ShieldCheck size={14} />
            )}
            {creating
              ? "Creating secure account…"
              : "Create and assign officer"}
          </button>
        </div>
      </form>
    </section>
  );
}
