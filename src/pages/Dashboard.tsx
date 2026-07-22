import { lazy, Suspense, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bike,
  BusFront,
  Camera,
  CarFront,
  CircleDot,
  CloudSun,
  Download,
  Eye,
  FolderKanban,
  Gauge,
  Import,
  MapPin,
  Play,
  Plus,
  Route,
  Skull,
  TrafficCone,
  Truck,
  UserRound,
  Users,
} from "lucide-react";
import AccidentMap, { type VisualizationMode } from "../components/map/AccidentMap";
import ForensicScenePreview from "../components/reconstruction/ForensicScenePreview";
import { AccidentCaseService } from "../services/accidentCaseService";
import { preparePhysicsForPlayback } from "../services/reconstructionPhysicsService";
import { ReconstructionService } from "../services/reconstructionService";
import { WorkspaceDataService } from "../services/workspaceDataService";
import { createDefaultHeatmapFilters } from "../types/heatmap";
import type {
  AccidentReconstruction,
  ReconstructionVehicle,
} from "../types/reconstruction";

const Reconstruction3DViewer = lazy(
  () => import("../components/reconstruction/Reconstruction3DViewer"),
);

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function participantIcon(participant: ReconstructionVehicle) {
  const props = { size: 21, strokeWidth: 1.45 };
  switch (participant.type) {
    case "Bus":
      return <BusFront {...props} />;
    case "Truck":
      return <Truck {...props} />;
    case "Motorcycle":
    case "Bicycle":
      return <Bike {...props} />;
    case "Pedestrian":
    case "Officer":
    case "Witness":
      return <UserRound {...props} />;
    case "Car":
    default:
      return <CarFront {...props} />;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function Dashboard() {
  const summary = WorkspaceDataService.getSummary();
  const monthlyActivity = WorkspaceDataService.getMonthlyActivity().slice(-7);
  const [mapMode, setMapMode] = useState<VisualizationMode>("heatmap");
  const [previewMode, setPreviewMode] = useState<"2D" | "3D">("3D");
  const [previewReconstruction, setPreviewReconstruction] =
    useState<AccidentReconstruction | null>(summary.latestReconstruction);
  const [importMessage, setImportMessage] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);

  const latestCase = summary.latestCase;
  const reconstructionPath = latestCase
    ? `/cases/${latestCase.id}/reconstruction`
    : "/reconstruction";

  const cards = [
    {
      label: "Total cases",
      value: summary.totalCases,
      note: `${summary.activeCases} active investigations`,
      icon: FolderKanban,
      to: "/cases",
    },
    {
      label: "Reconstructions",
      value: summary.reconstructionCount,
      note: `${summary.completedCases} completed cases`,
      icon: Route,
      to: "/reconstruction",
    },
    {
      label: "Fatalities",
      value: summary.totalFatalities,
      note: "Recorded accident dataset",
      icon: Skull,
      to: "/analytics",
    },
    {
      label: "Injuries",
      value: summary.totalInjuries,
      note: "Recorded accident dataset",
      icon: Users,
      to: "/analytics",
    },
    {
      label: "Blackspots",
      value: summary.highRiskJunctions,
      note: "High-risk junctions",
      icon: CircleDot,
      to: "/scene-map",
    },
    {
      label: "Evidence items",
      value: summary.evidenceCount,
      note: `${summary.photoCount} attached photos`,
      icon: Camera,
      to: "/evidence",
    },
  ] as const;

  const maxMonthly = Math.max(
    1,
    ...monthlyActivity.map((record) => record.accidents + record.cases),
  );

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
      { label: "Weather", value: scene.weather, icon: CloudSun },
      { label: "Road surface", value: scene.roadSurface, icon: Route },
      { label: "Light conditions", value: scene.timeOfDay, icon: Eye },
      { label: "Visibility", value: scene.visibility, icon: Eye },
      { label: "Traffic", value: scene.trafficVolume, icon: TrafficCone },
      { label: "Driving side", value: scene.drivingSide, icon: MapPin },
      { label: "Speed limit", value: `${scene.speedLimitKmh} km/h`, icon: Gauge },
    ];
  }, [previewReconstruction]);

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const candidates: unknown[] = [];

      if (isObject(parsed) && Array.isArray(parsed.reconstructions)) {
        candidates.push(...parsed.reconstructions);
      } else if (isObject(parsed) && isObject(parsed.reconstruction)) {
        candidates.push(parsed.reconstruction);
      } else {
        candidates.push(parsed);
      }

      let imported = 0;
      candidates.forEach((candidate) => {
        if (
          isObject(candidate) &&
          typeof candidate.id === "string" &&
          typeof candidate.title === "string" &&
          Array.isArray(candidate.vehicles) &&
          isObject(candidate.scene)
        ) {
          ReconstructionService.save(candidate as unknown as AccidentReconstruction);
          imported += 1;
        }
      });

      if (isObject(parsed) && Array.isArray(parsed.cases)) {
        parsed.cases.forEach((candidate) => {
          if (
            isObject(candidate) &&
            typeof candidate.id === "string" &&
            typeof candidate.caseNumber === "string" &&
            typeof candidate.title === "string"
          ) {
            AccidentCaseService.save(
              candidate as unknown as Parameters<typeof AccidentCaseService.save>[0],
            );
            imported += 1;
          }
        });
      }

      if (imported === 0) {
        throw new Error("The selected JSON file does not contain RoadSafe case or reconstruction records.");
      }

      setImportMessage(`${imported} record${imported === 1 ? "" : "s"} imported. Refreshing…`);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Unable to import the selected file.");
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  return (
    <div className="dashboard-command-grid space-y-2.5">
      <section className="dashboard-stat-grid">
        {cards.map(({ label, value, note, icon: Icon, to }) => (
          <Link
            key={label}
            to={to}
            className="dashboard-stat-card group"
          >
            <div className="dashboard-stat-icon">
              <Icon size={22} strokeWidth={1.45} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {label}
              </p>
              <p className="mt-0.5 text-[22px] font-bold leading-none text-slate-100">
                {value}
              </p>
              <p className="mt-1.5 truncate text-[8px] text-[#6fa8ff]">{note}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="dashboard-primary-row">
        <article className="ui-panel min-h-[350px] overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Accident heatmap</h2>
              <p className="mt-1 text-[8px] text-slate-600">
                Bundled accident and junction records
              </p>
            </div>
            <Link to="/scene-map" className="text-[9px] font-semibold text-[#78adfa]">
              Open map
            </Link>
          </div>
          <div className="h-[304px]">
            <AccidentMap
              visualizationMode={mapMode}
              onVisualizationModeChange={setMapMode}
              heatmapFilters={createDefaultHeatmapFilters()}
              compactSelectionPanel
            />
          </div>
          <div className="flex items-center gap-2 border-t border-[#182849] px-3 py-2 text-[8px] uppercase tracking-[0.1em] text-slate-500">
            <span>Low risk</span>
            <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-[#193c74] via-[#3277c8] to-[#b42d43]" />
            <span>High risk</span>
          </div>
        </article>

        <article className="ui-panel min-h-[350px] overflow-hidden">
          <div className="ui-panel-header">
            <h2 className="ui-panel-title">Recent cases</h2>
            <Link to="/cases" className="text-[9px] font-semibold text-[#78adfa]">
              View all
            </Link>
          </div>
          {summary.cases.length === 0 ? (
            <div className="grid h-[176px] place-items-center p-6 text-center">
              <div>
                <p className="text-[10px] font-semibold text-slate-300">No stored cases</p>
                <Link to="/cases/new" className="ui-button-primary mt-3 py-1.5">
                  <Plus size={12} /> New case
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#14233e]">
              {summary.cases.slice(0, 5).map((record) => (
                <Link
                  key={record.id}
                  to={`/cases/${record.id}`}
                  className="grid grid-cols-[1.05fr_1fr_.72fr_auto] items-center gap-2 px-3 py-2.5 text-[8px] transition-colors duration-100 hover:bg-[#0a1427]"
                >
                  <span className="truncate font-semibold text-slate-300">{record.caseNumber}</span>
                  <span className="truncate text-slate-500">{record.location}</span>
                  <span className="truncate text-slate-600">{formatDate(record.accidentDate)}</span>
                  <span className="text-[#71a9ff]">{record.status}</span>
                </Link>
              ))}
            </div>
          )}

          <div className="border-t border-[#182849] px-3 py-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                Case timeline overview
              </h3>
              <span className="text-[7px] text-slate-600">Cases + accident records</span>
            </div>
            {monthlyActivity.length === 0 ? (
              <div className="grid h-24 place-items-center text-[8px] text-slate-600">
                No dated records
              </div>
            ) : (
              <div className="mt-3 flex h-[92px] items-end gap-2 border-b border-l border-[#233453] px-2 pb-1.5">
                {monthlyActivity.map((record) => {
                  const total = record.accidents + record.cases;
                  return (
                    <div
                      key={record.label}
                      className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
                      title={`${total} record(s)`}
                    >
                      <div
                        className="w-full max-w-2 bg-gradient-to-t from-[#244e91] to-[#8ab7ff]"
                        style={{ height: `${Math.max(5, (total / maxMonthly) * 70)}px` }}
                      />
                      <span className="max-w-full truncate text-[6px] text-slate-600">
                        {record.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>

        <article className="ui-panel min-h-[350px] overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Reconstruction preview</h2>
              <p className="mt-1 text-[8px] text-slate-600">
                Latest stored scene and participant routes
              </p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPreviewMode("2D")}
                className={previewMode === "2D" ? "ui-button-primary py-1.5" : "ui-button py-1.5"}
              >
                2D view
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode("3D")}
                className={previewMode === "3D" ? "ui-button-primary py-1.5" : "ui-button py-1.5"}
              >
                3D view
              </button>
            </div>
          </div>
          <div className="h-[304px] bg-[#030711]">
            {!previewReconstruction ? (
              <div className="grid h-full place-items-center p-8 text-center">
                <div>
                  <p className="text-[10px] font-semibold text-slate-300">No reconstruction available</p>
                  <p className="mt-2 text-[8px] leading-4 text-slate-500">
                    Create a case and add participant routes to activate this panel.
                  </p>
                  <Link to="/cases/new" className="ui-button-primary mt-3 py-1.5">
                    <Plus size={12} /> New case
                  </Link>
                </div>
              </div>
            ) : previewMode === "2D" ? (
              <ForensicScenePreview reconstruction={previewReconstruction} className="h-full" />
            ) : (
              <Suspense
                fallback={
                  <div className="grid h-full place-items-center text-[9px] text-slate-500">
                    Loading 3D reconstruction…
                  </div>
                }
              >
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

      <section className="dashboard-secondary-row">
        <article className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">Active reconstruction</h2>
              <p className="mt-1 text-[8px] text-slate-600">
                {latestCase ? `${latestCase.caseNumber} · ${latestCase.location}` : "No active case"}
              </p>
            </div>
            {previewReconstruction && (
              <Link to={reconstructionPath} className="text-[9px] font-semibold text-[#78adfa]">
                Open editor
              </Link>
            )}
          </div>
          <div className="h-[268px] bg-[#030711]">
            {previewReconstruction ? (
              <ForensicScenePreview reconstruction={previewReconstruction} className="h-full" />
            ) : (
              <div className="grid h-full place-items-center text-[9px] text-slate-600">
                No reconstruction selected
              </div>
            )}
          </div>
          {previewReconstruction && (
            <div className="flex items-center justify-between border-t border-[#182849] px-3 py-2 text-[8px] text-slate-600">
              <span>Zoom 100%</span>
              <span>
                Collision X: {previewReconstruction.collisionPoint.x.toFixed(1)} · Y:{" "}
                {previewReconstruction.collisionPoint.y.toFixed(1)}
              </span>
            </div>
          )}
        </article>

        <article className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <h2 className="ui-panel-title">
              Participants ({previewReconstruction?.vehicles.length ?? 0})
            </h2>
            {previewReconstruction && (
              <Link to={reconstructionPath} className="text-[9px] font-semibold text-[#78adfa]">
                Edit
              </Link>
            )}
          </div>
          <div className="divide-y divide-[#14233e]">
            {previewReconstruction?.vehicles.slice(0, 4).map((participant, index) => (
              <div key={participant.id} className="flex items-center gap-3 px-3 py-3">
                <span className="rounded border border-[#2d4d79] bg-[#0a1730] px-2 py-1 text-[8px] text-[#8bb8ff]">
                  P{index + 1}
                </span>
                <div className="grid h-9 w-11 place-items-center rounded border border-[#1b3154] bg-[#0a1222] text-slate-400">
                  {participantIcon(participant)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[9px] font-semibold text-slate-200">{participant.name}</p>
                  <p className="mt-1 truncate text-[7px] text-slate-600">
                    {participant.type} · {participant.estimatedSpeedKmh} km/h
                  </p>
                </div>
                <div className="text-right text-[7px] text-slate-600">
                  <p>{participant.physics?.massKg ?? "—"} kg</p>
                  <p className="mt-1">{participant.role ?? "Participant"}</p>
                </div>
              </div>
            ))}
            {!previewReconstruction && (
              <p className="px-3 py-8 text-center text-[8px] text-slate-600">No participant data</p>
            )}
          </div>
          <div className="border-t border-[#182849] p-2.5">
            <Link to={reconstructionPath} className="ui-button w-full py-1.5">
              <Plus size={12} /> Add participant
            </Link>
          </div>
        </article>
      </section>

      <section className="dashboard-tertiary-row">
        <article className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <h2 className="ui-panel-title">Evidence markers</h2>
            <Link to="/evidence" className="text-[9px] font-semibold text-[#78adfa]">
              View all
            </Link>
          </div>
          <div className="divide-y divide-[#14233e]">
            {previewReconstruction?.evidenceRecords.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="rounded border border-[#2d4d79] bg-[#0a1730] px-2 py-1 text-[8px] text-[#8bb8ff]">
                  E{item.evidenceNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[9px] font-semibold text-slate-300">{item.title}</p>
                  <p className="mt-1 truncate text-[7px] text-slate-600">
                    {item.category} · {item.status}
                  </p>
                </div>
                <span className="text-[7px] text-slate-600">{formatDate(item.recordedAt)}</span>
              </div>
            ))}
            {previewReconstruction && previewReconstruction.evidenceRecords.length === 0 && (
              <p className="px-3 py-8 text-center text-[8px] text-slate-600">
                No evidence markers recorded
              </p>
            )}
            {!previewReconstruction && (
              <p className="px-3 py-8 text-center text-[8px] text-slate-600">
                No reconstruction selected
              </p>
            )}
          </div>
          <div className="border-t border-[#182849] p-2.5">
            <Link to="/evidence" className="ui-button w-full py-1.5">
              View all evidence
            </Link>
          </div>
        </article>

        <article className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <h2 className="ui-panel-title">Scene conditions</h2>
          </div>
          <div className="divide-y divide-[#14233e] px-3">
            {sceneConditions.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2 py-2.5 text-[8px]">
                <Icon size={13} strokeWidth={1.5} className="shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1 uppercase tracking-[0.08em] text-slate-600">{label}</span>
                <span className="max-w-[46%] truncate text-right text-slate-300">{value}</span>
              </div>
            ))}
            {sceneConditions.length === 0 && (
              <p className="py-8 text-center text-[8px] text-slate-600">No scene configuration</p>
            )}
          </div>
        </article>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-md border border-[#182849] bg-[#06101f] p-2.5">
        <Link to="/cases/new" className="ui-button min-w-32">
          <Plus size={13} /> New case
        </Link>
        <button
          type="button"
          onClick={() => importInputRef.current?.click()}
          className="ui-button min-w-32"
        >
          <Import size={13} /> Import data
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void handleImport(event.target.files?.[0])}
        />
        <Link to="/reports" className="ui-button min-w-32">
          <Download size={13} /> Export report
        </Link>
        {importMessage && <p className="text-[8px] text-slate-500">{importMessage}</p>}
        <Link to={reconstructionPath} className="ui-button-primary ml-auto min-w-56 px-6 py-2.5">
          <Play size={14} /> Start reconstruction
        </Link>
      </section>
    </div>
  );
}
