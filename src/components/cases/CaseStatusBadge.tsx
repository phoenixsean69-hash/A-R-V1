import type { AccidentCaseStatus } from "../../types/accidentCase";

interface CaseStatusBadgeProps {
  status: AccidentCaseStatus;
}

const STATUS_CLASSES: Record<AccidentCaseStatus, string> = {
  Open: "border-[#315d92] bg-[#10264a] text-[#8db8fb]",
  "Under Investigation": "border-[#66552f] bg-[#282111] text-[#d8bd78]",
  "Reconstruction Complete": "border-[#365e59] bg-[#102725] text-[#8ccdc3]",
  Closed: "border-[#3b4658] bg-[#171e2a] text-slate-400",
  Archived: "border-[#4a415e] bg-[#201a2d] text-[#b8a7d3]",
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
