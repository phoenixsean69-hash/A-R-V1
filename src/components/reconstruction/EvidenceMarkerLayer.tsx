import type {
  PointerEvent as ReactPointerEvent,
} from "react";

import type { EvidenceRecord } from "../../types/reconstruction";

interface EvidenceMarkerLayerProps {
  records: EvidenceRecord[];
  selectedEvidenceId: string | null;
  onSelect: (evidenceId: string) => void;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    evidenceId: string,
  ) => void;
}

export default function EvidenceMarkerLayer({
  records,
  selectedEvidenceId,
  onSelect,
  onPointerDown,
}: EvidenceMarkerLayerProps) {
  return (
    <>
      {records.map((record) => (
        <button
          key={record.id}
          type="button"
          data-scene-interactive="true"
          onClick={(event) => {
            event.stopPropagation();
            onSelect(record.id);
          }}
          onPointerDown={(event) => onPointerDown(event, record.id)}
          className={`absolute z-[41] flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[11px] font-black text-gray-950 shadow-lg ${
            selectedEvidenceId === record.id
              ? "ring-4 ring-cyan-300/50"
              : ""
          }`}
          style={{
            left: `${record.position.x}%`,
            top: `${record.position.y}%`,
          }}
          title={`E-${String(record.evidenceNumber).padStart(2, "0")}: ${record.title}`}
        >
          E{record.evidenceNumber}
        </button>
      ))}
    </>
  );
}