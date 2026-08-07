import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  ExternalLink,
  Filter,
  Image as ImageIcon,
  MapPin,
  Search,
} from "lucide-react";
import ForensicScenePreview from "../components/reconstruction/ForensicScenePreview";
import { WorkspaceDataService } from "../services/workspaceDataService";

export default function EvidencePage() {
  const evidenceItems = WorkspaceDataService.getEvidence();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(new Set(evidenceItems.map((item) => item.evidence.category))),
    ],
    [evidenceItems],
  );

  const filteredItems = useMemo(() => {
    const normalised = query.trim().toLowerCase();
    return evidenceItems.filter((item) => {
      const matchesCategory = category === "All" || item.evidence.category === category;
      const matchesQuery =
        !normalised ||
        item.evidence.title.toLowerCase().includes(normalised) ||
        item.evidence.description.toLowerCase().includes(normalised) ||
        item.accidentCase?.caseNumber.toLowerCase().includes(normalised) ||
        item.accidentCase?.location.toLowerCase().includes(normalised);
      return matchesCategory && matchesQuery;
    });
  }, [category, evidenceItems, query]);

  const selected = evidenceItems.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-3">
      <section className="ui-panel overflow-hidden">
        <div className="ui-panel-header flex-wrap gap-3">
          <div>
            <h2 className="ui-panel-title">Evidence registry</h2>
            <p className="mt-1 text-[9px] text-slate-600">Photos and markers are read directly from saved reconstructions.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Camera size={14} />
            {evidenceItems.length} record{evidenceItems.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#18243f] p-4 md:grid-cols-[1fr_240px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={15} />
            <input
              className="ui-input w-full pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search evidence, case number or location"
            />
          </label>
          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
            <select className="ui-input w-full appearance-none pl-9" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </section>

      {filteredItems.length === 0 ? (
        <section className="ui-panel p-12 text-center">
          <ImageIcon className="mx-auto text-slate-700" size={34} strokeWidth={1.3} />
          <h2 className="mt-4 text-sm font-semibold text-slate-300">No evidence records found</h2>
          <p className="mx-auto mt-2 max-w-md text-[10px] leading-5 text-slate-600">
            Evidence appears here after it is added inside a case reconstruction. Empty cards are no longer generated.
          </p>
          <Link to="/cases" className="ui-button-primary mt-5">Open cases</Link>
        </section>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {filteredItems.map((item) => {
            const photo = item.photos[0];
            const casePath = item.accidentCase
              ? `/cases/${item.accidentCase.id}/reconstruction`
              : "/reconstruction";
            return (
              <article key={item.id} className="ui-panel overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="relative block h-48 w-full overflow-hidden bg-[#070c16] text-left"
                >
                  {photo?.thumbnailDataUrl || photo?.dataUrl ? (
                    <img
                      src={photo.thumbnailDataUrl || photo.dataUrl}
                      alt={photo.caption || item.evidence.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ForensicScenePreview
                      reconstruction={item.reconstruction}
                      evidence={item.evidence}
                      timeSeconds={item.reconstruction.durationSeconds / 2}
                      className="h-full"
                      showPaths={false}
                    />
                  )}
                  <span className="absolute left-3 top-3 ui-badge">E{String(item.evidence.evidenceNumber).padStart(2, "0")}</span>
                  <span className="absolute bottom-3 right-3 rounded border border-[#2d456d] bg-[#060a13]/90 px-2 py-1 text-[8px] font-semibold text-slate-300">
                    {photo ? `${item.photos.length} photo${item.photos.length === 1 ? "" : "s"}` : "Scene marker"}
                  </span>
                </button>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xs font-semibold text-slate-200">{item.evidence.title}</h2>
                      <p className="mt-1 text-[9px] text-slate-500">{item.evidence.category} · {item.evidence.status}</p>
                    </div>
                    <Link to={casePath} className="ui-icon-button h-8 w-8 shrink-0" title="Open in reconstruction"><ExternalLink size={13} /></Link>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-8 text-[9px] leading-4 text-slate-600">
                    {item.evidence.description || item.evidence.notes || "No description recorded."}
                  </p>
                  <div className="mt-3 flex items-center gap-2 border-t border-[#17243d] pt-3 text-[9px] text-slate-500">
                    <MapPin size={12} />
                    <span className="truncate">{item.accidentCase?.location || item.reconstruction.title}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {selected && (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/75 p-4" role="dialog" aria-modal="true">
          <div className="ui-panel max-h-[90vh] w-full max-w-5xl overflow-auto">
            <div className="ui-panel-header">
              <div><h2 className="ui-panel-title">E{selected.evidence.evidenceNumber} · {selected.evidence.title}</h2><p className="mt-1 text-[9px] text-slate-600">{selected.accidentCase?.caseNumber || selected.reconstruction.accidentId}</p></div>
              <button className="ui-button" onClick={() => setSelectedId(null)}>Close</button>
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-[1.4fr_.8fr]">
              <div className="overflow-hidden rounded-md border border-[#1d2c4b] bg-[#050914]">
                {selected.photos[0]?.dataUrl || selected.photos[0]?.thumbnailDataUrl ? (
                  <img src={selected.photos[0].dataUrl || selected.photos[0].thumbnailDataUrl} alt={selected.evidence.title} className="max-h-[62vh] w-full object-contain" />
                ) : (
                  <div className="h-[520px]"><ForensicScenePreview reconstruction={selected.reconstruction} evidence={selected.evidence} className="h-full" /></div>
                )}
              </div>
              <aside className="space-y-4">
                <div className="rounded-md border border-[#1a2946] bg-[#0a1121] p-4">
                  <h3 className="ui-panel-title">Evidence details</h3>
                  <dl className="mt-4 space-y-3 text-[10px]">
                    {[
                      ["Category", selected.evidence.category],
                      ["Status", selected.evidence.status],
                      ["Recorded", new Date(selected.evidence.recordedAt).toLocaleString()],
                      ["Recorded by", selected.evidence.recordedBy || "Not recorded"],
                      ["Photos", String(selected.photos.length)],
                      ["Measurements", String(selected.evidence.measurementIds.length)],
                    ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-slate-600">{label}</dt><dd className="text-right text-slate-300">{value}</dd></div>)}
                  </dl>
                </div>
                <div className="rounded-md border border-[#1a2946] bg-[#0a1121] p-4">
                  <h3 className="ui-panel-title">Investigator notes</h3>
                  <p className="mt-3 whitespace-pre-wrap text-[10px] leading-5 text-slate-400">{selected.evidence.description || selected.evidence.notes || "No notes recorded."}</p>
                </div>
                <Link to={selected.accidentCase ? `/cases/${selected.accidentCase.id}/reconstruction` : "/reconstruction"} className="ui-button-primary w-full">Open reconstruction</Link>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
