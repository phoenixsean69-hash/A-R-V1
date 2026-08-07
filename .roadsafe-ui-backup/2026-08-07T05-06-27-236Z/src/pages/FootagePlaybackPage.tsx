import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import FootagePlayer from "../components/footage/FootagePlayer";
import { AccidentCaseService } from "../services/accidentCaseService";
import { ReconstructionFootageService } from "../services/reconstructionFootageService";

function formatBytes(sizeBytes: number): string {
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FootagePlaybackPage() {
  const navigate = useNavigate();
  const { caseId, footageId } = useParams<{
    caseId: string;
    footageId: string;
  }>();
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  void version;

  const accidentCase = caseId ? AccidentCaseService.getById(caseId) : null;
  const footage = footageId ? ReconstructionFootageService.getById(footageId) : null;

  if (!accidentCase || !footage || footage.caseId !== accidentCase.id) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">Footage not found</h1>
          <Link to={caseId ? `/cases/${caseId}/footage` : "/cases"} className="mt-5 inline-block font-bold text-blue-700">
            Return to footage library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-white lg:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-black text-rose-400">{accidentCase.caseNumber}</p>
            <h1 className="mt-1 text-3xl font-black">{footage.title}</h1>
            <p className="mt-2 text-sm text-slate-400">{footage.description || accidentCase.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/cases/${accidentCase.id}/footage`}
              className="rounded-sm border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-black text-slate-200"
            >
              ← All Footage
            </Link>
            <Link
              to={`/cases/${accidentCase.id}`}
              className="rounded-sm border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-black text-slate-200"
            >
              Back to Case
            </Link>
          </div>
        </header>

        {message && (
          <div className="mt-5 rounded-sm border border-emerald-700 bg-emerald-950/60 p-4 text-sm font-semibold text-emerald-200">
            {message}
          </div>
        )}

        <main className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            <FootagePlayer footage={footage} className="shadow-2xl" />
          </section>

          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
            {footage.isPrimary && (
              <span className="inline-flex rounded-full bg-indigo-600 px-3 py-1 text-xs font-black uppercase tracking-wide">
                Primary Footage
              </span>
            )}

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="font-bold text-slate-500">Recorded</dt>
                <dd className="mt-1 text-slate-100">{new Date(footage.recordedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">Recorded by</dt>
                <dd className="mt-1 text-slate-100">{footage.recordedBy || "Not recorded"}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">Duration</dt>
                <dd className="mt-1 text-slate-100">{footage.durationSeconds.toFixed(2)} seconds</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">Quality</dt>
                <dd className="mt-1 text-slate-100">{footage.width} × {footage.height} · {footage.frameRate} FPS</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">File size</dt>
                <dd className="mt-1 text-slate-100">{formatBytes(footage.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">File</dt>
                <dd className="mt-1 break-all text-xs text-slate-300">{footage.fileName}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={async () => {
                try {
                  await ReconstructionFootageService.download(footage.id);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Download failed.");
                }
              }}
              className="w-full rounded-sm bg-blue-600 px-4 py-3 text-sm font-black text-white"
            >
              Download Footage
            </button>

            {!footage.isPrimary && (
              <button
                type="button"
                onClick={() => {
                  ReconstructionFootageService.setPrimary(accidentCase.id, footage.id);
                  AccidentCaseService.setPrimaryFootage(accidentCase.id, footage.id);
                  setVersion((current) => current + 1);
                  setMessage("This recording is now the primary case footage.");
                }}
                className="w-full rounded-sm border border-indigo-500 bg-indigo-950 px-4 py-3 text-sm font-black text-indigo-200"
              >
                Mark as Primary
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                if (!window.confirm(`Delete “${footage.title}”?`)) return;
                await ReconstructionFootageService.delete(footage.id);
                AccidentCaseService.removeFootage(accidentCase.id, footage.id);
                navigate(`/cases/${accidentCase.id}/footage`);
              }}
              className="w-full rounded-sm border border-red-800 bg-red-950/40 px-4 py-3 text-sm font-black text-red-300"
            >
              Delete Footage
            </button>
          </aside>
        </main>
      </div>
    </div>
  );
}
