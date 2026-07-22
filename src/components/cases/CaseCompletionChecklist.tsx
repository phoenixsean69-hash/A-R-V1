import type { AccidentCaseCompletion } from "../../types/accidentCase";

interface CaseCompletionChecklistProps {
  completion: AccidentCaseCompletion;
  compact?: boolean;
}

export default function CaseCompletionChecklist({
  completion,
  compact = false,
}: CaseCompletionChecklistProps) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-slate-950">Completion Checklist</h2>
          <p className="mt-1 text-xs text-slate-500">
            {completion.completedCount} of {completion.totalCount} requirements complete
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${
            completion.complete
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {completion.percentage}%
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${
            completion.complete ? "bg-emerald-500" : "bg-blue-600"
          }`}
          style={{ width: `${completion.percentage}%` }}
        />
      </div>

      <div className={`mt-4 ${compact ? "space-y-2" : "space-y-3"}`}>
        {completion.checks.map((check) => (
          <div
            key={check.key}
            className={`rounded-xl border p-3 ${
              check.complete
                ? "border-emerald-200 bg-emerald-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                  check.complete
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-500 text-slate-950"
                }`}
                aria-hidden="true"
              >
                {check.complete ? "✓" : "!"}
              </span>

              <div>
                <p className="text-sm font-bold text-slate-900">{check.label}</p>
                {!compact && (
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {check.detail}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
