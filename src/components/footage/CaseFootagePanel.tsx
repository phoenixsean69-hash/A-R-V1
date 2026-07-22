import { useState } from "react";
import { Link } from "react-router-dom";

import { AccidentCaseService } from "../../services/accidentCaseService";
import { ReconstructionFootageService } from "../../services/reconstructionFootageService";
import type { AccidentCase } from "../../types/accidentCase";

interface CaseFootagePanelProps {
  accidentCase: AccidentCase;
  onChanged?: () => void;
  showAllLink?: boolean;
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CaseFootagePanel({
  accidentCase,
  onChanged,
  showAllLink = true,
}: CaseFootagePanelProps) {
  const [, setVersion] = useState(0);
  const [message, setMessage] = useState("");
  const footage = ReconstructionFootageService.getByCaseId(accidentCase.id);

  const refresh = (nextMessage?: string) => {
    setVersion((current) => current + 1);
    setMessage(nextMessage ?? "");
    onChanged?.();
  };

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">
            Saved Video Evidence
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Reconstruction Footage
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {footage.length} saved recording{footage.length === 1 ? "" : "s"} linked to this case.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/cases/${accidentCase.id}/reconstruction`}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white"
          >
            ● Record Footage
          </Link>
          {showAllLink && (
            <Link
              to={`/cases/${accidentCase.id}/footage`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700"
            >
              View All
            </Link>
          )}
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          {message}
        </div>
      )}

      {footage.length === 0 ? (
        <div className="mt-5 rounded-xl border-2 border-dashed border-slate-300 p-8 text-center">
          <p className="font-black text-slate-800">No reconstruction footage yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Open the linked reconstruction and use Record Footage to create a playable case video.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {footage.map((record) => (
            <article
              key={record.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
            >
              <div className="relative aspect-video bg-slate-950">
                {record.thumbnailDataUrl ? (
                  <img
                    src={record.thumbnailDataUrl}
                    alt={`${record.title} thumbnail`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-bold text-white">
                    RoadSafe AR Footage
                  </div>
                )}

                {record.isPrimary && (
                  <span className="absolute left-3 top-3 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow">
                    Primary
                  </span>
                )}

                <Link
                  to={`/cases/${accidentCase.id}/footage/${record.id}`}
                  className="absolute inset-0 flex items-center justify-center bg-slate-950/20 transition hover:bg-slate-950/40"
                  aria-label={`Play ${record.title}`}
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-2xl text-slate-950 shadow-xl">
                    ▶
                  </span>
                </Link>
              </div>

              <div className="p-4">
                <h3 className="font-black text-slate-950">{record.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {record.durationSeconds.toFixed(1)}s · {formatBytes(record.sizeBytes)} · {record.quality}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Recorded {new Date(record.recordedAt).toLocaleString()}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/cases/${accidentCase.id}/footage/${record.id}`}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"
                  >
                    Play
                  </Link>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await ReconstructionFootageService.download(record.id);
                      } catch (error) {
                        setMessage(
                          error instanceof Error ? error.message : "Download failed.",
                        );
                      }
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700"
                  >
                    Download
                  </button>

                  {!record.isPrimary && (
                    <button
                      type="button"
                      onClick={() => {
                        ReconstructionFootageService.setPrimary(accidentCase.id, record.id);
                        AccidentCaseService.setPrimaryFootage(accidentCase.id, record.id);
                        refresh("Primary reconstruction footage updated.");
                      }}
                      className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700"
                    >
                      Make Primary
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Delete “${record.title}”?`)) return;
                      await ReconstructionFootageService.delete(record.id);
                      AccidentCaseService.removeFootage(accidentCase.id, record.id);
                      refresh("Footage deleted.");
                    }}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
