import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
} from "../icons/materialIcons";

import type { AccidentCaseCompletion } from "../../types/accidentCase";

interface CaseCompletionChecklistProps {
  completion: AccidentCaseCompletion;
  compact?: boolean;
}

function clampPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export default function CaseCompletionChecklist({
  completion,
  compact = false,
}: CaseCompletionChecklistProps) {
  const percentage = clampPercentage(completion.percentage);
  const remainingCount = Math.max(
    0,
    completion.totalCount - completion.completedCount,
  );

  return (
    <section className="ui-panel overflow-hidden">
      <div className="ui-panel-header gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border ${
              completion.complete
                ? "border-[#494949] bg-[#303030] text-[#c4c4c4]"
                : "border-[#494949] bg-[#303030] text-[#c4c4c4]"
            }`}
          >
            <ClipboardCheck size={17} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <h2 className="ui-panel-title">Completion checklist</h2>
            <p className="mt-1 truncate text-[9px] text-slate-500">
              Investigation readiness and reconstruction requirements
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`hidden items-center gap-1.5 rounded border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] sm:inline-flex ${
              completion.complete
                ? "border-[#494949] bg-[#303030] text-[#c4c4c4]"
                : "border-[#67513c] bg-[#362f28] text-[#d6a06c]"
            }`}
          >
            {completion.complete ? (
              <ShieldCheck size={11} strokeWidth={2} />
            ) : (
              <AlertCircle size={11} strokeWidth={2} />
            )}
            {completion.complete ? "Ready to close" : "Review required"}
          </span>

          <span
            className={`min-w-[50px] rounded-md border px-2.5 py-1.5 text-center font-mono text-[11px] font-bold ${
              completion.complete
                ? "border-[#494949] bg-[#303030] text-[#b7c3cc]"
                : "border-[#494949] bg-[#303030] text-[#c4c4c4]"
            }`}
          >
            {percentage}%
          </span>
        </div>
      </div>

      <div className={compact ? "p-3" : "p-4"}>
        {!compact && (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-[#494949] bg-[#303030] px-3 py-2.5">
              <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600">
                Completed
              </p>
              <div className="mt-1.5 flex items-end gap-1.5">
                <span className="font-mono text-lg font-bold leading-none text-slate-100">
                  {completion.completedCount}
                </span>
                <span className="pb-0.5 text-[8px] font-semibold text-slate-600">
                  of {completion.totalCount}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-[#494949] bg-[#303030] px-3 py-2.5">
              <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600">
                Remaining
              </p>
              <div className="mt-1.5 flex items-end gap-1.5">
                <span
                  className={`font-mono text-lg font-bold leading-none ${
                    remainingCount === 0 ? "text-[#c4c4c4]" : "text-[#d6a06c]"
                  }`}
                >
                  {remainingCount}
                </span>
                <span className="pb-0.5 text-[8px] font-semibold text-slate-600">
                  requirement{remainingCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-[#494949] bg-[#303030] px-3 py-2.5">
              <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600">
                Case readiness
              </p>
              <p
                className={`mt-1.5 text-[10px] font-bold ${
                  completion.complete ? "text-[#c4c4c4]" : "text-[#c4c4c4]"
                }`}
              >
                {completion.complete
                  ? "All requirements verified"
                  : "Investigation in progress"}
              </p>
            </div>
          </div>
        )}

        <div className={compact ? "" : "mt-4"}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600">
              Overall progress
            </p>
            <p className="font-mono text-[9px] font-semibold text-slate-500">
              {completion.completedCount}/{completion.totalCount}
            </p>
          </div>

          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full border border-[#494949] bg-[#303030]"
            role="progressbar"
            aria-label="Case completion progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                completion.complete
                  ? "bg-[#879baa] shadow-[0_0_10px_rgba(135,155,170,0.22)]"
                  : "bg-[#e8872d] shadow-[0_0_10px_rgba(232,135,45,0.24)]"
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div
          className={`mt-4 grid gap-2 ${
            compact ? "grid-cols-1" : "md:grid-cols-2"
          }`}
        >
          {completion.checks.map((check, index) => (
            <article
              key={check.key}
              className={`group relative overflow-hidden rounded-md border px-3 py-3 transition-colors duration-150 ${
                check.complete
                  ? "border-[#494949] bg-[linear-gradient(135deg,#303030_0%,#292929_100%)] hover:border-[#494949]"
                  : "border-[#50473f] bg-[linear-gradient(135deg,#302d29_0%,#292929_100%)] hover:border-[#6b5541]"
              }`}
            >
              <span
                className={`absolute inset-y-0 left-0 w-0.5 ${
                  check.complete ? "bg-[#879baa]" : "bg-[#e8872d]"
                }`}
                aria-hidden="true"
              />

              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border ${
                    check.complete
                      ? "border-[#494949] bg-[#303030] text-[#c4c4c4]"
                      : "border-[#67513c] bg-[#362f28] text-[#d6a06c]"
                  }`}
                  aria-hidden="true"
                >
                  {check.complete ? (
                    <CheckCircle2 size={14} strokeWidth={2} />
                  ) : (
                    <AlertCircle size={14} strokeWidth={2} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-slate-600">
                        Requirement {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3 className="mt-1 text-[10px] font-bold leading-4 text-slate-200">
                        {check.label}
                      </h3>
                    </div>

                    <span
                      className={`rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.08em] ${
                        check.complete
                          ? "border-[#494949] bg-[#303030] text-[#c4c4c4]"
                          : "border-[#67513c] bg-[#362f28] text-[#d6a06c]"
                      }`}
                    >
                      {check.complete ? "Verified" : "Pending"}
                    </span>
                  </div>

                  {!compact && (
                    <p className="mt-2 text-[9px] leading-4 text-slate-500">
                      {check.detail}
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {!completion.complete && !compact && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-[#494949] bg-[#303030] px-3 py-2.5">
            <AlertCircle
              size={13}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0 text-[#d6a06c]"
              aria-hidden="true"
            />
            <p className="text-[8px] leading-4 text-[#c3a486]">
              Complete every pending requirement before changing the case to
              Reconstruction Complete.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
