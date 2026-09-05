import { useMemo } from "react";

import {
  AccidentService,
} from "../../services/accidentService";

import {
  JunctionService,
} from "../../services/junctionService";

import {
  RiskAnalysisService,
} from "../../services/riskAnalysisService";

interface JunctionQuickCardProps {
  junctionId: string;
  onClose: () => void;
  onViewFullAnalysis: () => void;
}

function formatDate(
  dateValue: string,
): string {
  if (!dateValue) {
    return "No records";
  }

  const date = new Date(
    `${dateValue}T00:00:00`,
  );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function riskClasses(
  level: "Low" | "Medium" | "High",
): string {
  if (level === "High") {
    return "border-[#713646] bg-[#321722] text-[#f09aae]";
  }

  if (level === "Medium") {
    return "border-[#6d5523] bg-[#241d10] text-[#dfc27f]";
  }

  return "border-[#415244] bg-[#132019] text-[#9ed4ae]";
}

export default function JunctionQuickCard({
  junctionId,
  onClose,
  onViewFullAnalysis,
}: JunctionQuickCardProps) {
  const junction = useMemo(
    () =>
      JunctionService.getById(
        junctionId,
      ),
    [junctionId],
  );

  const summary = useMemo(
    () =>
      AccidentService.getSummary(
        junctionId,
      ),
    [junctionId],
  );

  const risk = useMemo(
    () =>
      RiskAnalysisService
        .analyseJunction(
          junctionId,
        ),
    [junctionId],
  );

  if (!junction) {
    return null;
  }

  return (
    <aside className="absolute bottom-3 right-3 z-[55] w-[min(360px,calc(100%-24px))] overflow-hidden rounded-md border border-[#494949] bg-[#202020]/[0.98] shadow-[0_24px_60px_rgba(0,0,0,.60)] backdrop-blur-sm">
      <header className="flex items-start justify-between gap-3 border-b border-[#494949] bg-[#303030] px-3 py-3">
        <div className="min-w-0">
          <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
            Junction
          </p>

          <h3 className="mt-1 truncate text-[13px] font-bold text-slate-100">
            {junction.name}
          </h3>

          <p className="mt-1 truncate text-[8px] text-slate-500">
            {junction.city} ·{" "}
            {junction.roadType}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close junction card"
          className="grid h-8 w-8 shrink-0 place-items-center rounded border border-[#494949] bg-[#292929] text-base font-medium leading-none text-slate-300 transition hover:border-[#626262] hover:bg-[#363636] hover:text-white"
        >
          ×
        </button>
      </header>

      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-3 rounded-md border border-[#414141] bg-[#292929] px-3 py-2.5">
          <span
            className={`rounded border px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] ${riskClasses(
              risk.riskLevel,
            )}`}
          >
            {risk.riskLevel} risk
          </span>

          <div className="text-right">
            <p className="text-[7px] uppercase tracking-[0.06em] text-slate-600">
              Weighted score
            </p>
            <p className="mt-0.5 text-[12px] font-bold text-slate-200">
              {risk.riskScore}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric
            label="Accidents"
            value={
              summary.totalAccidents
            }
          />

          <Metric
            label="Fatalities"
            value={
              summary.fatalities
            }
          />

          <Metric
            label="Injuries"
            value={
              summary.injuries
            }
          />
        </div>

        <div className="rounded-md border border-[#414141] bg-[#292929]">
          <DataRow
            label="Common cause"
            value={
              summary.commonCause ||
              "Not recorded"
            }
          />

          <DataRow
            label="Latest record"
            value={
              formatDate(
                summary.lastUpdated,
              )
            }
          />
        </div>

        {junction.description && (
          <div className="rounded-md border border-[#414141] bg-[#292929] px-3 py-2.5">
            <p className="text-[7px] font-bold uppercase tracking-[0.07em] text-slate-600">
              Location note
            </p>

            <p className="mt-1 text-[8px] leading-4 text-slate-400">
              {junction.description}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onViewFullAnalysis}
          className="w-full rounded-md border border-[#8c6039] bg-[#3a2c21] px-3 py-2.5 text-[9px] font-bold text-[#f0c49a] transition hover:border-[#ad7749] hover:bg-[#443326]"
        >
          View Full Analysis
        </button>
      </div>
    </aside>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-[#414141] bg-[#292929] px-2 py-3 text-center">
      <p className="text-[18px] font-bold leading-none text-slate-100">
        {value}
      </p>

      <p className="mt-2 text-[7px] font-semibold uppercase tracking-[0.05em] text-slate-500">
        {label}
      </p>
    </div>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-t border-[#3c3c3c] px-3 py-2.5 first:border-t-0">
      <span className="text-[7px] font-bold uppercase tracking-[0.05em] text-slate-600">
        {label}
      </span>

      <span
        className="truncate text-right text-[8px] font-semibold text-slate-300"
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
