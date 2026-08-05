import {
  useState,
  type FormEvent,
} from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import {
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { account } from "../lib/appwrite";

function passwordIssue(
  password: string,
): string {
  if (password.length < 12) {
    return "Use at least 12 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Add at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Add at least one lowercase letter.";
  }

  if (!/\d/.test(password)) {
    return "Add at least one number.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Add at least one symbol.";
  }

  return "";
}

export default function ChangePasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] =
    useState("");
  const [newPassword, setNewPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [showPasswords, setShowPasswords] =
    useState(false);
  const [submitting, setSubmitting] =
    useState(false);
  const [error, setError] =
    useState("");

  if (!auth.identity) {
    return <Navigate to="/login" replace />;
  }

  /*
   * [RoadSafe:StablePasswordChangeIdentityV1]
   *
   * Capture the narrowed authenticated identity before creating the async
   * submit closure. This prevents the mutable auth context property from
   * becoming nullable again inside that closure.
   */
  const identity =
    auth.identity;

  const userPreferences =
    identity.user.prefs as
      typeof identity.user.prefs & {
        mustChangePassword?: boolean;
        passwordChangedAt?: string;
      };

  const mustChangePassword =
    userPreferences
      .mustChangePassword === true;

  const submit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const issue =
      passwordIssue(newPassword);

    if (!currentPassword) {
      setError(
        "Enter the temporary or current password.",
      );
      return;
    }

    if (issue) {
      setError(issue);
      return;
    }

    if (
      newPassword !== confirmPassword
    ) {
      setError(
        "The new passwords do not match.",
      );
      return;
    }

    if (
      newPassword === currentPassword
    ) {
      setError(
        "The new password must be different from the temporary password.",
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await account.updatePassword({
        password: newPassword,
        oldPassword: currentPassword,
      });

      await account.updatePrefs({
        prefs: {
          ...userPreferences,
          mustChangePassword: false,
          passwordChangedAt:
            new Date().toISOString(),
        },
      });

      await auth.refresh();
      navigate("/", {
        replace: true,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The password could not be changed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#030714] p-5 text-slate-200">
      <section className="ui-panel w-full max-w-xl overflow-hidden">
        <header className="border-b border-[#18243f] p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-[#315b91] bg-[#0b1b38] text-[#8ebcff]">
            <KeyRound size={22} />
          </div>

          <h1 className="mt-4 text-xl font-bold text-slate-100">
            {mustChangePassword
              ? "Secure your RoadSafe account"
              : "Change account password"}
          </h1>

          <p className="mt-3 text-[10px] leading-5 text-slate-500">
            {mustChangePassword
              ? "The station administrator issued a one-time temporary password. Replace it before accessing police data."
              : "Enter the current password and choose a stronger private password."}
          </p>
        </header>

        <form
          onSubmit={submit}
          className="space-y-4 p-5 sm:p-6"
        >
          <label className="block">
            <span className="text-[10px] font-bold text-slate-400">
              Temporary or current password
            </span>
            <input
              type={
                showPasswords
                  ? "text"
                  : "password"
              }
              value={currentPassword}
              onChange={(event) =>
                setCurrentPassword(
                  event.target.value,
                )
              }
              autoComplete="current-password"
              className="ui-input mt-2 w-full"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-bold text-slate-400">
              New password
            </span>
            <input
              type={
                showPasswords
                  ? "text"
                  : "password"
              }
              value={newPassword}
              onChange={(event) =>
                setNewPassword(
                  event.target.value,
                )
              }
              autoComplete="new-password"
              className="ui-input mt-2 w-full"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-bold text-slate-400">
              Confirm new password
            </span>
            <input
              type={
                showPasswords
                  ? "text"
                  : "password"
              }
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              autoComplete="new-password"
              className="ui-input mt-2 w-full"
            />
          </label>

          <button
            type="button"
            className="inline-flex items-center gap-2 text-[9px] font-bold text-slate-500 hover:text-slate-200"
            onClick={() =>
              setShowPasswords(
                (current) => !current,
              )
            }
          >
            {showPasswords ? (
              <EyeOff size={13} />
            ) : (
              <Eye size={13} />
            )}
            {showPasswords
              ? "Hide passwords"
              : "Show passwords"}
          </button>

          <div className="rounded-md border border-[#1d3155] bg-[#071124] p-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600">
              Password requirements
            </p>
            <p className="mt-2 text-[9px] leading-5 text-slate-400">
              At least 12 characters with uppercase,
              lowercase, a number and a symbol.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-[#713646] bg-[#321722] px-3 py-2.5 text-[10px] leading-5 text-[#e28b9d]"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="ui-button-primary w-full py-3"
          >
            <ShieldCheck size={14} />
            {submitting
              ? "Securing account…"
              : "Save private password"}
          </button>
        </form>
      </section>
    </div>
  );
}
