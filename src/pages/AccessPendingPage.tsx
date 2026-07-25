import {
  Clock3,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import {
  Navigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function AccessPendingPage() {
  const auth = useAuth();

  if (
    auth.identity &&
    auth.identity.role !== "unassigned"
  ) {
    return <Navigate to="/" replace />;
  }

  const checking =
    auth.status === "loading";

  return (
    <div className="grid min-h-screen place-items-center bg-[#030714] p-5 text-slate-200">
      <section className="ui-panel w-full max-w-xl overflow-hidden text-center">
        <div className="border-b border-[#18243f] p-6">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-[#6d5523] bg-[#241d10] text-[#d9bd78]">
            <Clock3 size={22} />
          </div>

          <h1 className="mt-4 text-xl font-bold text-slate-100">
            Station access pending
          </h1>

          <p className="mt-3 text-[10px] leading-5 text-slate-500">
            Your account is signed in. RoadSafe is checking
            its Appwrite police-station membership.
          </p>
        </div>

        <div className="space-y-3 p-5 text-left">
          <div className="rounded-md border border-[#1a2946] bg-[#070d1a] p-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600">
              Account
            </p>

            <p className="mt-2 text-[10px] font-bold text-slate-300">
              {auth.identity?.user.name ||
                auth.identity?.user.email}
            </p>

            <p className="mt-1 text-[9px] text-slate-600">
              {auth.identity?.user.email}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-[#6d5523] bg-[#241d10] px-3 py-3 text-[#d9bd78]">
            <ShieldAlert
              size={14}
              className="mt-0.5 shrink-0"
            />

            <p className="text-[9px] leading-5">
              Appwrite must return one active membership with
              <strong> field_officer</strong>,
              <strong> supervisor</strong> or
              <strong> station_admin</strong>.
            </p>
          </div>

          {auth.error && (
            <div
              role="alert"
              className="rounded-md border border-[#713646] bg-[#321722] px-3 py-3 text-[9px] leading-5 text-[#e28b9d]"
            >
              {auth.error}
            </div>
          )}

          <button
            type="button"
            disabled={checking}
            className="ui-button-primary w-full"
            onClick={() =>
              void auth.refresh()
            }
          >
            <RefreshCw
              size={14}
              className={
                checking
                  ? "animate-spin"
                  : ""
              }
            />
            {checking
              ? "Checking station access…"
              : "Recheck station access"}
          </button>

          <button
            type="button"
            className="ui-button w-full"
            onClick={() =>
              void auth.signOut()
            }
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}
