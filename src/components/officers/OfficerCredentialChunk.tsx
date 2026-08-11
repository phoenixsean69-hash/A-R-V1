import {
  CheckCircle2,
  Clipboard,
  X,
} from "../icons/materialIcons";

import type {
  TemporaryOfficerCredential,
} from "../../types/officerManagement";

interface Props {
  credential: TemporaryOfficerCredential;
  copied: boolean;
  onClose(): void;
  onCopy(): void;
}

export default function OfficerCredentialChunk({
  credential,
  copied,
  onClose,
  onCopy,
}: Props) {
  return (
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
          onClick={onClose}
        >
          <X size={13} />
          Close
        </button>
      </header>

      <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.7fr)]">
        <div className="rounded-md border border-[#7b622a] bg-[#303030] p-4">
          <p className="text-[8px] font-bold uppercase tracking-[0.09em] text-[#c4c4c4]">
            Login email
          </p>

          <p className="mt-2 break-all font-mono text-[11px] font-bold text-slate-200">
            {credential.officer.email}
          </p>

          <p className="mt-4 text-[8px] font-bold uppercase tracking-[0.09em] text-[#c4c4c4]">
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
            onClick={onCopy}
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
  );
}
