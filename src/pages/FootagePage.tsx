import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Film,
  Play,
  Star,
  Trash2,
  Video,
} from "lucide-react";
import FootagePlayer from "../components/footage/FootagePlayer";
import { AccidentCaseService } from "../services/accidentCaseService";
import { ReconstructionFootageService } from "../services/reconstructionFootageService";

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FootagePage() {
  const [version, setVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  void version;

  const footage = ReconstructionFootageService.getAllMetadata();
  const selected = footage.find((record) => record.id === selectedId) ?? footage[0] ?? null;
  const selectedCase = selected ? AccidentCaseService.getById(selected.caseId) : null;

  const refresh = (nextMessage = "") => {
    setVersion((current) => current + 1);
    setMessage(nextMessage);
  };

  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <div className="ui-panel-header flex-wrap gap-3">
          <div>
            <h2 className="ui-panel-title">Reconstruction footage library</h2>
            <p className="mt-1 text-[9px] text-slate-600">Only videos actually saved in IndexedDB appear here.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Video size={14} />
            {footage.length} saved recording{footage.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      {message && (
        <div className="rounded-md border border-[#2a4b75] bg-[#0d1a31] px-4 py-3 text-[10px] text-[#9fc4ff]">
          {message}
        </div>
      )}

      {footage.length === 0 ? (
        <section className="ui-panel p-12 text-center">
          <Film className="mx-auto text-slate-700" size={38} strokeWidth={1.25} />
          <h2 className="mt-4 text-sm font-semibold text-slate-300">No real footage has been recorded</h2>
          <p className="mx-auto mt-2 max-w-lg text-[10px] leading-5 text-slate-600">
            Open a case reconstruction and use Record Footage. The resulting MediaRecorder video will be stored in the browser and will become playable here.
          </p>
          <Link to="/cases" className="ui-button-primary mt-5">Open cases</Link>
        </section>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_420px]">
          <section className="ui-panel overflow-hidden">
            <div className="ui-panel-header">
              <div>
                <h2 className="ui-panel-title">{selected?.title}</h2>
                <p className="mt-1 text-[9px] text-slate-600">
                  {selectedCase?.caseNumber || "Unlinked case"} · {selected?.fileName}
                </p>
              </div>
              {selected?.isPrimary && <span className="ui-badge"><Star size={11} />Primary</span>}
            </div>
            {selected && (
              <div className="p-3">
                <FootagePlayer footage={selected} className="rounded-md" />
              </div>
            )}
            {selected && (
              <div className="grid gap-3 border-t border-[#18243f] p-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Duration", `${selected.durationSeconds.toFixed(1)} s`],
                  ["Resolution", `${selected.width} × ${selected.height}`],
                  ["Frame rate", `${selected.frameRate} FPS`],
                  ["File size", formatBytes(selected.sizeBytes)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[8px] font-bold uppercase tracking-wide text-slate-600">{label}</p>
                    <p className="mt-1 text-[10px] text-slate-300">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="ui-panel overflow-hidden">
            <div className="ui-panel-header"><h2 className="ui-panel-title">Saved recordings</h2></div>
            <div className="max-h-[700px] divide-y divide-[#17243d] overflow-y-auto">
              {footage.map((record) => {
                const accidentCase = AccidentCaseService.getById(record.caseId);
                const active = record.id === selected?.id;
                return (
                  <article key={record.id} className={active ? "bg-[#101a31]" : "bg-transparent"}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(record.id)}
                      className="flex w-full gap-3 p-3 text-left hover:bg-[#0c1426]"
                    >
                      <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-md border border-[#1d2c4b] bg-[#060a13]">
                        {record.thumbnailDataUrl ? (
                          <img src={record.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center"><Play size={19} className="text-[#78aafb]" /></div>
                        )}
                        <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[7px] text-white">{record.durationSeconds.toFixed(1)}s</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[11px] font-semibold text-slate-200">{record.title}</h3>
                        <p className="mt-1 truncate text-[9px] text-slate-500">{accidentCase?.caseNumber || "Unknown case"}</p>
                        <p className="mt-1 text-[8px] text-slate-600">{new Date(record.recordedAt).toLocaleString()}</p>
                      </div>
                    </button>
                    <div className="flex gap-1 px-3 pb-3">
                      <button
                        className="ui-button flex-1 py-1.5"
                        onClick={async () => {
                          try {
                            await ReconstructionFootageService.download(record.id);
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "Download failed.");
                          }
                        }}
                      ><Download size={12} />Download</button>
                      {!record.isPrimary && (
                        <button
                          className="ui-icon-button h-8 w-8"
                          title="Make primary"
                          onClick={() => {
                            ReconstructionFootageService.setPrimary(record.caseId, record.id);
                            AccidentCaseService.setPrimaryFootage(record.caseId, record.id);
                            refresh("Primary footage updated.");
                          }}
                        ><Star size={13} /></button>
                      )}
                      <button
                        className="ui-icon-button h-8 w-8 text-red-400"
                        title="Delete footage"
                        onClick={async () => {
                          if (!window.confirm(`Delete “${record.title}”?`)) return;
                          await ReconstructionFootageService.delete(record.id);
                          AccidentCaseService.removeFootage(record.caseId, record.id);
                          if (record.id === selected?.id) setSelectedId(null);
                          refresh("Footage deleted.");
                        }}
                      ><Trash2 size={13} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
