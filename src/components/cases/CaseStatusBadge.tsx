import type { AccidentCaseStatus } from "../../types/accidentCase";

interface CaseStatusBadgeProps {
  status: AccidentCaseStatus;
}

const STATUS_CLASSES: Record<AccidentCaseStatus, string> = {
  Open: "border-blue-200 bg-blue-50 text-blue-700",
  "Under Investigation": "border-amber-200 bg-amber-50 text-amber-700",
  "Reconstruction Complete": "border-emerald-200 bg-emerald-50 text-emerald-700",
  Closed: "border-slate-300 bg-slate-100 text-slate-700",
  Archived: "border-purple-200 bg-purple-50 text-purple-700",
};

export default function CaseStatusBadge({
  status,
}: CaseStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${STATUS_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}
