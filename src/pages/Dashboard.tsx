import { lazy, Suspense, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Camera,
  FileText,
  FolderKanban,
  MapPinned,
  Play,
  Plus,
  ShieldAlert,
  Users,
  Video,
} from "lucide-react";
import AccidentMap, { type VisualizationMode } from "../components/map/AccidentMap";
import ForensicScenePreview from "../components/reconstruction/ForensicScenePreview";
import { WorkspaceDataService } from "../services/workspaceDataService";
import { preparePhysicsForPlayback } from "../services/reconstructionPhysicsService";
import { ReconstructionService } from "../services/reconstructionService";
import { createDefaultHeatmapFilters } from "../types/heatmap";
import {
  sceneEnvironmentLabel,
  usesGeneratedRoad,
  type AccidentReconstruction,
} from "../types/reconstruction";

const Reconstruction3DViewer = lazy(
  () => import("../components/reconstruction/Reconstruction3DViewer"),
);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function Dashboard() {
  const summary = WorkspaceDataService.getSummary();
  const monthlyActivity = WorkspaceDataService.getMonthlyActivity().slice(-7);
  const [mapMode, setMapMode] = useState<VisualizationMode>("heatmap");
  const [previewMode, setPreviewMode] = useState<"2D" | "3D">("2D");
  const [previewReconstruction, setPreviewReconstruction] =
    useState<AccidentReconstruction | null>(summary.latestReconstruction);

  const latestCase = summary.latestCase;
  const cards = [
    {
      label: "Investigation cases",
      value: summary.totalCases,
      note: `${summary.activeCases} active`,
      icon: FolderKanban,
      to: "/cases",
    },
    {
      label: "Reconstructions",
      value: summary.reconstructionCount,
      note: `${summary.completedCases} completed cases`,
      icon: Activity,
      to: "/reconstruction",
    },
    {
      label: "Recorded injuries",
      value: summary.totalInjuries,
      note: "Verified accident dataset",
      icon: Users,
      to: "/analytics",
    },
    {
      label: "High-risk junctions",
      value: summary.highRiskJunctions,
      note: "Current blackspot register",
      icon: ShieldAlert,
      to: "/scene-map",
    },
    {
      label: "Evidence records",
      value: summary.evidenceCount,
      note: `${summary.photoCount} attached photos`,
      icon: Camera,
      to: "/evidence",
    },
    {
      label: "Saved footage",
      value: summary.footageCount,
      note: "Playable browser recordings",
      icon: Video,
      to: "/footage",
    },
  ] as const;

  const maxMonthly = Math.max(
    1,
    ...monthlyActivity.map((record) => record.accidents + record.cases),
  );

  const participantCount =
    previewReconstruction?.vehicles.length ?? 0;
  const evidenceCount =
    previewReconstruction?.evidenceRecords.length ?? 0;

  const runPreviewPhysics = (): AccidentReconstruction => {
    if (!previewReconstruction) {
      throw new Error("No reconstruction is available for playback.");
    }
    const prepared = preparePhysicsForPlayback(previewReconstruction);
    const saved = ReconstructionService.save(prepared);
    setPreviewReconstruction(saved);
    return saved;
  };

  const sceneConditions = useMemo(() => {
    if (!previewReconstruction) return [];
    const scene = previewReconstruction.scene;
    return [
      ["Environment", sceneEnvironmentLabel(scene)],
      ["Weather", scene.weather],
      ["Surface", usesGeneratedRoad(scene) ? scene.roadSurface : scene.groundSurface],
      ["Visibility", scene.visibility],
      ["Traffic", usesGeneratedRoad(scene) ? scene.trafficVolume : "Not applicable"],
      ["Speed limit", usesGeneratedRoad(scene) ? `${scene.speedLimitKmh} km/h` : "Not applicable"],
    ];
  }, [previewReconstruction]);

  return (
    <div className="space-y-3">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(({ label, value, note, icon: Icon, to }) => (
          <Link key={label} to={to} className="ui-panel group flex min-h-24 items-center gap-3 p-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#24395f] bg-[#0c1730] text-[#8bb8ff] transition-colors group-hover:border-[#36598f]">
              <Icon size={20} strokeWidth={1.55} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-100">{value}</p>
              <p className="mt-1 truncate text-[9px] text-[#6e9fe8]">{note}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.08fr_.95fr_1.35fr]">
        <article className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Accident intelligence map</h2>
              <p className="mt-1 text-[9px] text-slate-600">Live from the bundled junction and accident register</p>
            </div>
            <span className="ui-badge">{mapMode}</span>
          </div>
          <div className="h-[360px] min-h-0">
            <AccidentMap
              visualizationMode={mapMode}
              onVisualizationModeChange={setMapMode}
              heatmapFilters={createDefaultHeatmapFilters()}
            />
          </div>
        </article>

        <div className="space-y-3">
          <article className="ui-panel">
            <div className="ui-panel-header">
              <h2 className="ui-panel-title">Recent investigation cases</h2>
              <Link to="/cases" className="text-[10px] font-semibold text-[#79adfa]">View all</Link>
            </div>
            {summary.cases.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs font-semibold text-slate-300">No case records yet</p>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">Create a case to populate this operational list.</p>
                <Link to="/cases/new" className="ui-button-primary mt-4"><Plus size={13} />Create case</Link>
              </div>
            ) : (
              <div className="divide-y divide-[#15233d]">
                {summary.cases.slice(0, 5).map((record) => (
                  <Link
                    key={record.id}
                    to={`/cases/${record.id}`}
                    className="grid grid-cols-[1.15fr_1fr_auto] items-center gap-2 px-4 py-3 text-[10px] hover:bg-[#0c1426]"
                  >
                    <span className="font-semibold text-slate-300">{record.caseNumber}</span>
                    <span className="truncate text-slate-500">{record.location}</span>
                    <span className="text-[#70a8ff]">{record.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <article className="ui-panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="ui-panel-title">Recorded activity timeline</h2>
              <span className="text-[9px] text-slate-600">Cases + accident records</span>
            </div>
            {monthlyActivity.length === 0 ? (
              <div className="grid h-32 place-items-center text-[10px] text-slate-600">No dated records available.</div>
            ) : (
              <div className="mt-5 flex h-28 items-end gap-3 border-b border-l border-[#233453] px-3 pb-2">
                {monthlyActivity.map((record) => {
                  const total = record.accidents + record.cases;
                  return (
                    <div key={record.label} className="flex flex-1 flex-col items-center gap-2" title={`${total} record(s)`}>
                      <div
                        className="w-full max-w-5 rounded-t-sm bg-gradient-to-t from-[#1d4f95] to-[#76aaff]"
                        style={{ height: `${Math.max(7, (total / maxMonthly) * 86)}px` }}
                      />
                      <span className="whitespace-nowrap text-[7px] text-slate-600">{record.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </div>

        <article className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Latest reconstruction</h2>
              <p className="mt-1 text-[9px] text-slate-600">Actual saved participant paths and scene state</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setPreviewMode("2D")} className={previewMode === "2D" ? "ui-button-primary py-1.5" : "ui-button py-1.5"}>2D</button>
              <button onClick={() => setPreviewMode("3D")} className={previewMode === "3D" ? "ui-button-primary py-1.5" : "ui-button py-1.5"}>3D</button>
            </div>
          </div>
          <div className="h-[360px] bg-[#070b13]">
            {!previewReconstruction ? (
              <div className="grid h-full place-items-center p-8 text-center">
                <div>
                  <p className="text-xs font-semibold text-slate-300">No reconstruction available</p>
                  <p className="mt-2 max-w-xs text-[10px] leading-5 text-slate-500">Create a case and add participant routes to activate this preview.</p>
                  <Link to="/cases/new" className="ui-button-primary mt-4"><Plus size={13} />New case</Link>
                </div>
              </div>
            ) : previewMode === "2D" ? (
              <ForensicScenePreview reconstruction={previewReconstruction} className="h-full" />
            ) : (
              <Suspense fallback={<div className="grid h-full place-items-center text-xs text-slate-500">Loading 3D reconstruction…</div>}>
                <div className="dashboard-3d-preview h-full">
                  <Reconstruction3DViewer
                    reconstruction={previewReconstruction}
                    onSwitchTo2D={() => setPreviewMode("2D")}
                    onRunPhysics={runPreviewPhysics}
                    onPreparePlayback={runPreviewPhysics}
                    compact
                  />
                </div>
              </Suspense>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.15fr_1fr_1fr_.85fr]">
        <article className="ui-panel overflow-hidden">
          <div className="ui-panel-header"><h2 className="ui-panel-title">Active case</h2></div>
          {latestCase ? (
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold text-[#79adfa]">{latestCase.caseNumber}</p>
                  <h3 className="mt-1 text-sm font-semibold text-slate-200">{latestCase.title}</h3>
                  <p className="mt-2 text-[10px] leading-5 text-slate-500">{latestCase.location}</p>
                </div>
                <span className="ui-badge">{latestCase.status}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                <div><dt className="text-slate-600">Accident date</dt><dd className="mt-1 text-slate-300">{formatDate(latestCase.accidentDate)}</dd></div>
                <div><dt className="text-slate-600">Officer</dt><dd className="mt-1 text-slate-300">{latestCase.investigatingOfficer || "Not recorded"}</dd></div>
              </dl>
              <Link to={`/cases/${latestCase.id}`} className="ui-button mt-4 w-full">Open case</Link>
            </div>
          ) : (
            <div className="p-6 text-center text-[10px] text-slate-500">No active case has been created.</div>
          )}
        </article>

        <article className="ui-panel p-4">
          <div className="flex items-center justify-between"><h2 className="ui-panel-title">Participants ({participantCount})</h2>{previewReconstruction && <Link to="/reconstruction" className="text-[9px] text-[#79adfa]">Edit</Link>}</div>
          <div className="mt-3 space-y-2">
            {previewReconstruction?.vehicles.slice(0, 4).map((participant, index) => (
              <div key={participant.id} className="flex items-center gap-3 rounded-md border border-[#182743] bg-[#0a1223] p-3">
                <span className="rounded border border-[#2b456f] px-2 py-1 text-[9px] text-[#8db8fb]">P{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-200">{participant.name}</p><p className="mt-0.5 text-[9px] text-slate-500">{participant.type} · {participant.estimatedSpeedKmh} km/h</p></div>
              </div>
            ))}
            {!previewReconstruction && <p className="py-6 text-center text-[10px] text-slate-600">No participant data.</p>}
          </div>
        </article>

        <article className="ui-panel p-4">
          <div className="flex items-center justify-between"><h2 className="ui-panel-title">Evidence markers ({evidenceCount})</h2><Link to="/evidence" className="text-[9px] text-[#79adfa]">View all</Link></div>
          <div className="mt-3 divide-y divide-[#17243d]">
            {previewReconstruction?.evidenceRecords.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center gap-3 py-2.5"><span className="rounded border border-[#2a3e64] px-2 py-1 text-[9px] text-slate-400">E{item.evidenceNumber}</span><div className="min-w-0"><p className="truncate text-[10px] text-slate-300">{item.title}</p><p className="mt-0.5 text-[8px] text-slate-600">{item.category} · {item.status}</p></div></div>
            ))}
            {previewReconstruction && previewReconstruction.evidenceRecords.length === 0 && <p className="py-6 text-center text-[10px] text-slate-600">No evidence markers recorded.</p>}
            {!previewReconstruction && <p className="py-6 text-center text-[10px] text-slate-600">No reconstruction selected.</p>}
          </div>
        </article>

        <article className="ui-panel p-4">
          <h2 className="ui-panel-title">Scene conditions</h2>
          <div className="mt-4 space-y-3 text-[10px]">
            {sceneConditions.map(([label, value]) => <div key={label} className="flex justify-between gap-4"><span className="text-slate-500">{label}</span><span className="text-right text-slate-300">{value}</span></div>)}
            {sceneConditions.length === 0 && <p className="py-6 text-center text-slate-600">No scene configuration.</p>}
          </div>
        </article>
      </section>

      <section className="flex flex-wrap gap-2">
        <Link to="/cases/new" className="ui-button"><Plus size={14} />New case</Link>
        <Link to="/scene-map" className="ui-button"><MapPinned size={14} />Open map</Link>
        <Link to="/reports" className="ui-button"><FileText size={14} />Reports</Link>
        {previewReconstruction ? (
          <Link to={latestCase ? `/cases/${latestCase.id}/reconstruction` : "/reconstruction"} className="ui-button-primary ml-auto px-6"><Play size={14} />Continue reconstruction</Link>
        ) : (
          <Link to="/cases/new" className="ui-button-primary ml-auto px-6"><Plus size={14} />Start first reconstruction</Link>
        )}
      </section>
    </div>
  );
}
