import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "../../context/AuthContext";
import type { RoadSafeRole } from "../../types/auth";

function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#030714] p-5 text-slate-200">
      <section className="ui-panel w-full max-w-md overflow-hidden text-center">
        <div className="border-b border-[#18243f] p-6">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#284a7b] border-t-[#8ebcff]" />
          <h1 className="mt-4 text-base font-bold text-slate-100">
            Opening RoadSafe AR
          </h1>
          <p className="mt-2 text-[10px] leading-5 text-slate-500">
            Validating the Appwrite session and police-station access.
          </p>
        </div>
      </section>
    </div>
  );
}

function ConfigurationScreen({
  message,
}: {
  message: string;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#030714] p-5 text-slate-200">
      <section className="ui-panel w-full max-w-xl overflow-hidden">
        <div className="border-b border-[#18243f] p-6 text-center">
          <h1 className="text-lg font-bold text-slate-100">
            Appwrite setup required
          </h1>
          <p className="mt-3 text-[10px] leading-5 text-slate-500">
            {message}
          </p>
        </div>

        <div className="space-y-2 p-5">
          <code className="block rounded-md border border-[#1d3155] bg-[#050b17] px-3 py-2 text-[10px] text-[#8ebcff]">
            VITE_APPWRITE_ENDPOINT
          </code>
          <code className="block rounded-md border border-[#1d3155] bg-[#050b17] px-3 py-2 text-[10px] text-[#8ebcff]">
            VITE_APPWRITE_PROJECT_ID
          </code>
        </div>
      </section>
    </div>
  );
}

export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") {
    return <LoadingScreen />;
  }

  if (auth.status === "configuration-error") {
    return <ConfigurationScreen message={auth.error} />;
  }

  if (
    auth.status !== "authenticated" ||
    !auth.identity
  ) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}`,
        }}
      />
    );
  }

  return <Outlet />;
}

export function PublicOnlyRoute({
  children,
}: {
  children: ReactNode;
}) {
  const auth = useAuth();

  if (auth.status === "loading") {
    return <LoadingScreen />;
  }

  if (auth.status === "configuration-error") {
    return <ConfigurationScreen message={auth.error} />;
  }

  if (
    auth.status === "authenticated" &&
    auth.identity
  ) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export function RequireRole({
  roles,
}: {
  roles: RoadSafeRole[];
}) {
  const auth = useAuth();

  if (!auth.identity) {
    return <Navigate to="/login" replace />;
  }

  if (auth.identity.role === "unassigned") {
    return <Navigate to="/access-pending" replace />;
  }

  if (!roles.includes(auth.identity.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export function ClientHomeRedirect() {
  const auth = useAuth();

  if (!auth.identity) {
    return <Navigate to="/login" replace />;
  }

  switch (auth.identity.role) {
    case "field_officer":
      return <Navigate to="/field" replace />;
    case "supervisor":
    case "station_admin":
      return <Navigate to="/station" replace />;
    case "unassigned":
      return <Navigate to="/access-pending" replace />;
  }
}
