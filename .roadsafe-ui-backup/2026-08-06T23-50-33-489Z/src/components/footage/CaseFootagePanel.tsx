import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Download,
  Film,
  Play,
  Radio,
  Star,
  Trash2,
  Video,
} from "lucide-react";

import { AccidentCaseService } from "../../services/accidentCaseService";
import { ReconstructionFootageService } from "../../services/reconstructionFootageService";
import type { AccidentCase } from "../../types/accidentCase";

interface CaseFootagePanelProps {
  accidentCase: AccidentCase;
  onChanged?: () => void;
  showAllLink?: boolean;
  compact?: boolean;
}

interface PanelNotice {
  message: string;
  tone: "success" | "error";
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRecordedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown recording date";

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const compactActionClass =
  "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-[8px] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#315d9d]/50";

export default function CaseFootagePanel({
  accidentCase,
  onChanged,
  showAllLink = true,
  compact = false,
}: CaseFootagePanelProps) {
  const [, setVersion] = useState(0);
  const [notice, setNotice] = useState<PanelNotice | null>(null);
  const footage = ReconstructionFootageService.getByCaseId(accidentCase.id);

  const refresh = (message?: string) => {
    setVersion((current) => current + 1);
    setNotice(
      message
        ? {
            message,
            tone: "success",
          }
        : null,
    );
    onChanged?.();
  };

  const panelActions = (
    <>
      <Link
        to={`/cases/${accidentCase.id}/reconstruction`}
        className={
          compact
            ? "ui-button-primary min-w-0 px-2 py-2 text-[9px]"
            : "ui-button-primary"
        }
      >
        <Radio size={compact ? 12 : 14} strokeWidth={1.9} />
        <span className="truncate">
          {footage.length > 0 ? "Record another" : "Record footage"}
        </span>
      </Link>

      {showAllLink && (
        <Link
          to={`/cases/${accidentCase.id}/footage`}
          className={
            compact
              ? "ui-button min-w-0 px-2 py-2 text-[9px]"
              : "ui-button"
          }
        >
          <Film size={compact ? 12 : 14} strokeWidth={1.8} />
          <span className="truncate">View all</span>
        </Link>
      )}
    </>
  );

  return (
    <section className="ui-panel min-w-0 overflow-hidden">
      <div className="ui-panel-header min-w-0 gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#315b91] bg-[#0b1b38] text-[#81b2fa]">
            <Video size={17} strokeWidth={1.8} />
          </div>

          <div className="min-w-0">
            <h2 className="ui-panel-title truncate">
              Reconstruction footage
            </h2>
            <p className="mt-1 truncate text-[9px] text-slate-500">
              Saved video evidence linked to this case
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded border border-[#284a7b] bg-[#112241] px-2 py-1 font-mono text-[9px] font-bold text-[#8ebcff]">
            {footage.length}
          </span>

          {!compact && (
            <div className="flex flex-wrap justify-end gap-2">
              {panelActions}
            </div>
          )}
        </div>
      </div>

      {compact && (
        <div
          className={`grid gap-2 border-b border-[#18243f] p-3 ${
            showAllLink ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {panelActions}
        </div>
      )}

      {notice && (
        <div
          className={`mx-3 mt-3 rounded-md border px-3 py-2 text-[9px] font-semibold leading-4 ${
            notice.tone === "success"
              ? "border-[#28645e] bg-[#0d2928] text-[#8ed6ca]"
              : "border-[#713646] bg-[#321722] text-[#e28b9d]"
          }`}
        >
          {notice.message}
        </div>
      )}

      {footage.length === 0 ? (
        <div className={compact ? "p-3" : "p-4"}>
          <div
            className={`rounded-md border border-dashed border-[#29446f] bg-[#070d1a] text-center ${
              compact ? "px-4 py-6" : "px-6 py-10"
            }`}
          >
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-md border border-[#1d3155] bg-[#08142c] text-[#6f9ddd]">
              <Film size={18} strokeWidth={1.7} />
            </div>
            <p className="mt-3 text-[10px] font-bold text-slate-300">
              No reconstruction footage yet
            </p>
            <p className="mx-auto mt-1.5 max-w-md text-[9px] leading-4 text-slate-600">
              Open the linked reconstruction and record a playable version for
              this investigation.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={
            compact
              ? "max-h-[510px] space-y-2 overflow-y-auto overscroll-contain p-3 [scrollbar-color:#223656_#070d1a] [scrollbar-width:thin]"
              : "grid min-w-0 gap-3 p-4 md:grid-cols-2"
          }
        >
          {footage.map((record) =>
            compact ? (
              <article
                key={record.id}
                className="min-w-0 overflow-hidden rounded-md border border-[#1a2946] bg-[#070d1a]"
              >
                <div className="flex min-w-0">
                  <div className="relative h-[88px] w-[108px] shrink-0 overflow-hidden border-r border-[#1a2946] bg-[#030714]">
                    {record.thumbnailDataUrl ? (
                      <img
                        src={record.thumbnailDataUrl}
                        alt={`${record.title} thumbnail`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-[#6f9ddd]">
                        <Film size={22} strokeWidth={1.5} />
                      </div>
                    )}

                    <Link
                      to={`/cases/${accidentCase.id}/footage/${record.id}`}
                      className="absolute inset-0 grid place-items-center bg-[#020611]/20 transition-colors hover:bg-[#020611]/50"
                      aria-label={`Play ${record.title}`}
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-[#071124]/90 text-white shadow-xl">
                        <Play
                          size={13}
                          strokeWidth={2}
                          fill="currentColor"
                          className="ml-0.5"
                        />
                      </span>
                    </Link>

                    {record.isPrimary && (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded border border-[#315b91] bg-[#0b1b38]/95 px-1.5 py-0.5 text-[6px] font-bold uppercase tracking-[0.08em] text-[#8ebcff]">
                        <Star size={7} fill="currentColor" />
                        Primary
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 p-2.5">
                    <h3
                      className="truncate text-[10px] font-bold text-slate-200"
                      title={record.title}
                    >
                      {record.title}
                    </h3>

                    <p className="mt-1 truncate font-mono text-[8px] text-slate-500">
                      {record.durationSeconds.toFixed(1)}s ·{" "}
                      {formatBytes(record.sizeBytes)}
                    </p>

                    <p className="mt-1 truncate text-[8px] text-slate-600">
                      {record.quality} · {record.width}×{record.height}
                    </p>

                    <div className="mt-2 flex items-center gap-1.5 text-[7px] text-slate-600">
                      <CalendarClock size={9} className="shrink-0" />
                      <span className="truncate">
                        {formatRecordedAt(record.recordedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-2 gap-1.5 border-t border-[#1a2946] p-2">
                  <Link
                    to={`/cases/${accidentCase.id}/footage/${record.id}`}
                    className={`${compactActionClass} border-[#162f52] bg-[#163a73] text-white hover:bg-[#1b4789]`}
                  >
                    <Play size={10} fill="currentColor" />
                    Play
                  </Link>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await ReconstructionFootageService.download(record.id);
                      } catch (error) {
                        setNotice({
                          message:
                            error instanceof Error
                              ? error.message
                              : "Download failed.",
                          tone: "error",
                        });
                      }
                    }}
                    className={`${compactActionClass} border-[#29446f] bg-[#111b35] text-slate-300 hover:bg-[#152445]`}
                  >
                    <Download size={10} />
                    Download
                  </button>

                  {!record.isPrimary ? (
                    <button
                      type="button"
                      onClick={() => {
                        ReconstructionFootageService.setPrimary(
                          accidentCase.id,
                          record.id,
                        );
                        AccidentCaseService.setPrimaryFootage(
                          accidentCase.id,
                          record.id,
                        );
                        refresh("Primary reconstruction footage updated.");
                      }}
                      className={`${compactActionClass} border-[#315b91] bg-[#0b1b38] text-[#8ebcff] hover:bg-[#10264b]`}
                    >
                      <Star size={10} />
                      Primary
                    </button>
                  ) : (
                    <span className={`${compactActionClass} border-[#28645e] bg-[#0d2928] text-[#8ed6ca]`}>
                      <Star size={10} fill="currentColor" />
                      Selected
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Delete “${record.title}”?`)) return;

                      await ReconstructionFootageService.delete(record.id);
                      AccidentCaseService.removeFootage(
                        accidentCase.id,
                        record.id,
                      );
                      refresh("Footage deleted.");
                    }}
                    className={`${compactActionClass} border-[#713646] bg-[#321722] text-[#e28b9d] hover:bg-[#3b1b28]`}
                  >
                    <Trash2 size={10} />
                    Delete
                  </button>
                </div>
              </article>
            ) : (
              <article
                key={record.id}
                className="min-w-0 overflow-hidden rounded-md border border-[#1a2946] bg-[#070d1a]"
              >
                <div className="relative aspect-video overflow-hidden bg-[#030714]">
                  {record.thumbnailDataUrl ? (
                    <img
                      src={record.thumbnailDataUrl}
                      alt={`${record.title} thumbnail`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="grid h-full place-items-center text-[#6f9ddd]">
                      <div className="text-center">
                        <Film
                          size={28}
                          strokeWidth={1.5}
                          className="mx-auto"
                        />
                        <p className="mt-2 text-[9px] font-bold">
                          RoadSafe AR footage
                        </p>
                      </div>
                    </div>
                  )}

                  {record.isPrimary && (
                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded border border-[#315b91] bg-[#0b1b38]/95 px-2 py-1 text-[7px] font-bold uppercase tracking-[0.08em] text-[#8ebcff]">
                      <Star size={9} fill="currentColor" />
                      Primary evidence
                    </span>
                  )}

                  <Link
                    to={`/cases/${accidentCase.id}/footage/${record.id}`}
                    className="absolute inset-0 grid place-items-center bg-[#020611]/20 transition-colors hover:bg-[#020611]/55"
                    aria-label={`Play ${record.title}`}
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-full border border-white/20 bg-[#071124]/90 text-white shadow-2xl">
                      <Play
                        size={18}
                        strokeWidth={2}
                        fill="currentColor"
                        className="ml-1"
                      />
                    </span>
                  </Link>
                </div>

                <div className="min-w-0 p-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3
                        className="truncate text-[11px] font-bold text-slate-200"
                        title={record.title}
                      >
                        {record.title}
                      </h3>
                      <p className="mt-1 truncate font-mono text-[8px] text-slate-500">
                        {record.durationSeconds.toFixed(1)}s ·{" "}
                        {formatBytes(record.sizeBytes)} · {record.quality}
                      </p>
                    </div>

                    <span className="shrink-0 rounded border border-[#1d3155] bg-[#08142c] px-2 py-1 text-[7px] font-bold text-[#7fa8df]">
                      {record.width}×{record.height}
                    </span>
                  </div>

                  <p className="mt-2 flex min-w-0 items-center gap-1.5 text-[8px] text-slate-600">
                    <CalendarClock size={10} className="shrink-0" />
                    <span className="truncate">
                      Recorded {formatRecordedAt(record.recordedAt)}
                    </span>
                  </p>

                  <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                    <Link
                      to={`/cases/${accidentCase.id}/footage/${record.id}`}
                      className="ui-button-primary px-2.5 py-1.5 text-[9px]"
                    >
                      <Play size={11} fill="currentColor" />
                      Play
                    </Link>

                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await ReconstructionFootageService.download(record.id);
                        } catch (error) {
                          setNotice({
                            message:
                              error instanceof Error
                                ? error.message
                                : "Download failed.",
                            tone: "error",
                          });
                        }
                      }}
                      className="ui-button px-2.5 py-1.5 text-[9px]"
                    >
                      <Download size={11} />
                      Download
                    </button>

                    {!record.isPrimary && (
                      <button
                        type="button"
                        onClick={() => {
                          ReconstructionFootageService.setPrimary(
                            accidentCase.id,
                            record.id,
                          );
                          AccidentCaseService.setPrimaryFootage(
                            accidentCase.id,
                            record.id,
                          );
                          refresh("Primary reconstruction footage updated.");
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#315b91] bg-[#0b1b38] px-2.5 py-1.5 text-[9px] font-bold text-[#8ebcff] transition-colors hover:bg-[#10264b]"
                      >
                        <Star size={11} />
                        Make primary
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm(`Delete “${record.title}”?`)) {
                          return;
                        }

                        await ReconstructionFootageService.delete(record.id);
                        AccidentCaseService.removeFootage(
                          accidentCase.id,
                          record.id,
                        );
                        refresh("Footage deleted.");
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-[#713646] bg-[#321722] px-2.5 py-1.5 text-[9px] font-bold text-[#e28b9d] transition-colors hover:bg-[#3b1b28]"
                    >
                      <Trash2 size={11} />
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </section>
  );
}
