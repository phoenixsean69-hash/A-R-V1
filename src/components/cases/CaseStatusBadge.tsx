import type { AccidentCaseStatus } from "../../types/accidentCase";

interface CaseStatusBadgeProps {
  status: AccidentCaseStatus;
}

const STATUS_CLASSES: Record<AccidentCaseStatus, string> = {
  Open: "border-[#494949] bg-[#303030] text-[#c4c4c4]",
  "Under Investigation": "border-[#66552f] bg-[#282111] text-[#d8bd78]",
  "Reconstruction Complete": "border-[#494949] bg-[#303030] text-[#c4c4c4]",
  Closed: "border-[#494949] bg-[#303030] text-slate-400",
  Archived: "border-[#4a415e] bg-[#303030] text-[#b8a7d3]",
};

export default function CaseStatusBadge({ status }: CaseStatusBadgeProps) {
  return (
    <span
      className={`inline-flex rounded border px-2 py-1 text-[8px] font-bold uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {status}
    </span>
  );
}
