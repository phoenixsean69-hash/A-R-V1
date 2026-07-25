import {
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

interface LoginLocationState {
  from?: string;
}

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const requestedPath = useMemo(() => {
    const state = location.state as
      | LoginLocationState
      | null;

    return state?.from?.startsWith("/")
      ? state.from
      : "/";
  }, [location.state]);

  if (
    auth.status === "authenticated" &&
    auth.identity
  ) {
    return <Navigate to="/" replace />;
  }

  const submit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!email.trim() || !password) {
      setFormError(
        "Enter the officer email address and password.",
      );
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      await auth.signIn({
        email,
        password,
      });
      navigate(requestedPath, {
        replace: true,
      });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Sign-in failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030714] p-4 text-slate-200 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl items-center gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
        <section className="hidden min-w-0 p-8 lg:block">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-md border border-[#3765a3] bg-[#08142c] text-[#8ebcff]">
              <ShieldCheck
                size={30}
                strokeWidth={1.7}
              />
            </div>
            <div>
              <p className="text-xl font-black tracking-[0.12em] text-white">
                ROADSAFE AR
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Connected accident investigation
              </p>
            </div>
          </div>

          <h1 className="mt-10 max-w-3xl text-4xl font-black leading-tight text-slate-100">
            One verified scene.
            <br />
            Two connected police clients.
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-400">
            Field officers capture and reconstruct the
            accident scene while supervisors at the station
            review progress, evidence and decisions through
            the same controlled investigation record.
          </p>

          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
            <article className="rounded-md border border-[#1d3155] bg-[#070d1a] p-4">
              <RadioTower
                size={18}
                className="text-[#8ebcff]"
              />
              <h2 className="mt-3 text-sm font-bold text-slate-200">
                Field Client
              </h2>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">
                Scene capture, evidence, measurements,
                reconstruction and live case updates.
              </p>
            </article>

            <article className="rounded-md border border-[#1d3155] bg-[#070d1a] p-4">
              <ShieldCheck
                size={18}
                className="text-[#8ed6ca]"
              />
              <h2 className="mt-3 text-sm font-bold text-slate-200">
                Station Client
              </h2>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">
                Operational oversight, collaborative review,
                reports, audit history and intervention.
              </p>
            </article>
          </div>
        </section>

        <section className="ui-panel min-w-0 overflow-hidden">
          <header className="border-b border-[#18243f] p-5 sm:p-6">
            <div className="grid h-11 w-11 place-items-center rounded-md border border-[#315b91] bg-[#0b1b38] text-[#8ebcff]">
              <LockKeyhole size={20} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-100">
              Secure officer sign-in
            </h2>
            <p className="mt-2 text-[10px] leading-5 text-slate-500">
              Use the account issued by your police station.
              Public registration is disabled.
            </p>
          </header>

          <form
            className="space-y-4 p-5 sm:p-6"
            onSubmit={submit}
          >
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400">
                Officer email
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="officer@station.gov.zw"
                className="ui-input mt-2 w-full"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-bold text-slate-400">
                Password
              </span>
              <span className="relative mt-2 block">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  className="ui-input w-full pr-11"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current,
                    )
                  }
                  className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-slate-500 hover:bg-[#10182d] hover:text-slate-200"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={15} />
                  ) : (
                    <Eye size={15} />
                  )}
                </button>
              </span>
            </label>

            {(formError || auth.error) && (
              <div
                role="alert"
                className="rounded-md border border-[#713646] bg-[#321722] px-3 py-2.5 text-[10px] leading-5 text-[#e28b9d]"
              >
                {formError || auth.error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="ui-button-primary w-full py-3"
            >
              {submitting
                ? "Validating station access…"
                : "Sign in to RoadSafe"}
            </button>

            <p className="text-center text-[9px] leading-5 text-slate-600">
              Account access is controlled through your
              Appwrite police-station team membership.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
