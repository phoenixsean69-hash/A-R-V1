import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Bike,
  BusFront,
  Camera,
  Car,
  FileText,
  FolderKanban,
  MapPinned,
  PersonStanding,
  Play,
  Plus,
  ShieldAlert,
  Truck,
  Users,
  Video,
} from "lucide-react";

import AccidentMap, {
  type VisualizationMode,
} from "../components/map/AccidentMap";
import ForensicScenePreview from "../components/reconstruction/ForensicScenePreview";
import { WorkspaceDataService } from "../services/workspaceDataService";
import { createDefaultHeatmapFilters } from "../types/heatmap";
import {
  sceneEnvironmentLabel,
  usesGeneratedRoad,
  type AccidentReconstruction,
  type ReconstructionVehicle,
} from "../types/reconstruction";

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function hasSavedSceneData(
  reconstruction: AccidentReconstruction,
): boolean {
  return (
    reconstruction.vehicles.length > 0 ||
    reconstruction.evidenceRecords.length > 0 ||
    reconstruction.sceneObjects.length > 0 ||
    reconstruction.measurements.length > 0 ||
    reconstruction.photos.length > 0 ||
    reconstruction.timelineEvents.length > 0 ||
    reconstruction.fieldPlacements.length > 0
  );
}

function ParticipantIcon({
  type,
}: {
  type: ReconstructionVehicle["type"];
}) {
  const iconProps = {
    size: 18,
    strokeWidth: 1.7,
  };

  switch (type) {
    case "Bus":
      return <BusFront {...iconProps} />;

    case "Truck":
      return <Truck {...iconProps} />;

    case "Motorcycle":
    case "Bicycle":
      return <Bike {...iconProps} />;

    case "Pedestrian":
    case "Officer":
    case "Witness":
      return <PersonStanding {...iconProps} />;

    case "Car":
    default:
      return <Car {...iconProps} />;
  }
}

function buildTrendPoints(values: number[]) {
  const left = 6;
  const right = 4;
  const top = 6;
  const bottom = 36;
  const width = 100 - left - right;
  const maxValue = Math.max(1, ...values);

  return values.map((value, index) => {
    const x =
      values.length === 1
        ? 50
        : left + (index * width) / (values.length - 1);

    const y =
      bottom - (value / maxValue) * (bottom - top);

    return {
      x: Number(x.toFixed(2)),
      y: Number(y.toFixed(2)),
    };
  });
}

function buildLinePath(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
    )
    .join(" ");
}

function buildAreaPath(
  points: Array<{ x: number; y: number }>,
  baseline = 36,
): string {
  if (points.length === 0) {
    return "";
  }

  const first = points[0];
  const last = points[points.length - 1];

  return [
    `M ${first.x} ${baseline}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${last.x} ${baseline}`,
    "Z",
  ].join(" ");
}

export default function Dashboard() {
  const summary = WorkspaceDataService.getSummary();
  const monthlyActivity = WorkspaceDataService
    .getMonthlyActivity()
    .slice(-7);

  const [mapMode, setMapMode] =
    useState<VisualizationMode>("heatmap");

  const previewReconstruction =
    summary.reconstructions.find(
      (reconstruction) => reconstruction.vehicles.length > 0,
    ) ??
    summary.reconstructions.find(hasSavedSceneData) ??
    summary.latestReconstruction;

  const activeCase =
    summary.cases.find((record) =>
      ["Open", "Under Investigation"].includes(record.status),
    ) ??
    summary.latestCase;

  const previewCase =
    previewReconstruction
      ? summary.cases.find(
          (record) =>
            record.reconstructionId === previewReconstruction.id,
        )
      : null;

  const participantCount =
    previewReconstruction?.vehicles.length ?? 0;

  const evidenceCount =
    previewReconstruction?.evidenceRecords.length ?? 0;

  const monthlyTotals = monthlyActivity.map((record) => ({
    ...record,
    total: record.accidents + record.cases,
  }));

  const maxMonthly = Math.max(
    1,
    ...monthlyTotals.map((record) => record.total),
  );

  const analyticsPoints = useMemo(
    () => buildTrendPoints(monthlyTotals.map((item) => item.total)),
    [monthlyTotals],
  );

  const analyticsLinePath = useMemo(
    () => buildLinePath(analyticsPoints),
    [analyticsPoints],
  );

  const analyticsAreaPath = useMemo(
    () => buildAreaPath(analyticsPoints),
    [analyticsPoints],
  );

  const analyticsPeak = monthlyTotals.reduce<
    { label: string; total: number } | null
  >((best, current) => {
    if (!best || current.total > best.total) {
      return { label: current.label, total: current.total };
    }

    return best;
  }, null);

  const analyticsAverage = monthlyTotals.length
    ? (
        monthlyTotals.reduce(
          (sum, item) => sum + item.total,
          0,
        ) / monthlyTotals.length
      ).toFixed(1)
    : "0";

  const analyticsLatest =
    monthlyTotals[monthlyTotals.length - 1]?.total ?? 0;

  const previewTimeSeconds = useMemo(() => {
    if (!previewReconstruction) {
      return 0;
    }

    const simulatedImpactTime =
      previewReconstruction.lastPhysicsSimulation
        ?.primaryImpactTimeSeconds;

    if (simulatedImpactTime !== undefined) {
      return simulatedImpactTime;
    }

    const recordedImpactTimes =
      previewReconstruction.vehicles
        .flatMap((participant) =>
          participant.pathPoints
            .filter((point) => point.action === "Impact")
            .map((point) => point.timeSeconds),
        )
        .sort((left, right) => left - right);

    return (
      recordedImpactTimes[0] ??
      previewReconstruction.durationSeconds / 2
    );
  }, [previewReconstruction]);

  const sceneConditions = useMemo(() => {
    if (!previewReconstruction) {
      return [];
    }

    const scene = previewReconstruction.scene;

    return [
      ["Environment", sceneEnvironmentLabel(scene)],
      ["Weather", scene.weather],
      [
        "Surface",
        usesGeneratedRoad(scene)
          ? scene.roadSurface
          : scene.groundSurface,
      ],
      ["Visibility", scene.visibility],
      [
        "Traffic",
        usesGeneratedRoad(scene)
          ? scene.trafficVolume
          : "Not applicable",
      ],
      [
        "Speed limit",
        usesGeneratedRoad(scene)
          ? `${scene.speedLimitKmh} km/h`
          : "Not applicable",
      ],
    ];
  }, [previewReconstruction]);

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

  const reconstructionLink = previewCase
    ? `/cases/${previewCase.id}/reconstruction`
    : "/reconstruction";

  return (
    <div className="space-y-3">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(
          ({
            label,
            value,
            note,
            icon: Icon,
            to,
          }) => (
            <Link
              key={label}
              to={to}
              className="ui-panel group flex min-h-24 items-center gap-3 p-3"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#24395f] bg-[#0c1730] text-[#8bb8ff] transition-colors group-hover:border-[#36598f]">
                <Icon size={20} strokeWidth={1.55} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {label}
                </p>

                <p className="mt-1 text-xl font-bold text-slate-100">
                  {value}
                </p>

                <p className="mt-1 truncate text-[9px] text-[#6e9fe8]">
                  {note}
                </p>
              </div>
            </Link>
          ),
        )}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <article className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">
                Accident intelligence map
              </h2>

              <p className="mt-1 text-[9px] text-slate-600">
                Live from the bundled junction and accident register
              </p>
            </div>

            <span className="ui-badge">{mapMode}</span>
          </div>

          <div className="h-[340px] min-h-0">
            <AccidentMap
              visualizationMode={mapMode}
              onVisualizationModeChange={setMapMode}
              heatmapFilters={createDefaultHeatmapFilters()}
            />
          </div>
        </article>

        <article className="ui-panel overflow-hidden">
          <div className="ui-panel-header">
            <h2 className="ui-panel-title">
              Recent investigation cases
            </h2>

            <Link
              to="/cases"
              className="text-[10px] font-semibold text-[#79adfa]"
            >
              View all
            </Link>
          </div>

          {summary.cases.length === 0 ? (
            <div className="grid min-h-[340px] place-items-center p-6 text-center">
              <div>
                <p className="text-xs font-semibold text-slate-300">
                  No case records yet
                </p>

                <p className="mt-2 text-[10px] leading-5 text-slate-500">
                  Create a case to populate this operational list.
                </p>

                <Link
                  to="/cases/new"
                  className="ui-button-primary mt-4"
                >
                  <Plus size={13} />
                  Create case
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#15233d]">
              {summary.cases.slice(0, 6).map((record) => (
                <Link
                  key={record.id}
                  to={`/cases/${record.id}`}
                  className="grid grid-cols-[1.05fr_1fr_auto] items-center gap-2 px-4 py-3.5 text-[10px] hover:bg-[#0c1426]"
                >
                  <span className="font-semibold text-slate-300">
                    {record.caseNumber}
                  </span>

                  <span className="truncate text-slate-500">
                    {record.location}
                  </span>

                  <span className="text-[#70a8ff]">
                    {record.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid items-stretch gap-3 lg:grid-cols-3">
        <div className="grid min-h-[350px] gap-3 lg:grid-rows-[0.9fr_1.1fr]">
          <article className="ui-panel flex min-h-[145px] flex-col p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="ui-panel-title">
                  Recorded activity timeline
                </h2>

                <p className="mt-1 text-[9px] text-slate-600">
                  Cases and accident records
                </p>
              </div>

              <span className="ui-badge">
                {monthlyActivity.length} months
              </span>
            </div>

            {monthlyActivity.length === 0 ? (
              <div className="grid flex-1 place-items-center text-[10px] text-slate-600">
                No dated records available.
              </div>
            ) : (
              <div className="mt-4 flex min-h-0 flex-1 items-end">
                <div className="flex h-28 w-full items-end justify-around gap-2 border-b border-l border-[#233453] px-2 pb-2">
                  {monthlyTotals.map((record) => {
                    const height = Math.max(
                      10,
                      (record.total / maxMonthly) * 70,
                    );

                    return (
                      <div
                        key={record.label}
                        className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                        title={`${record.total} recorded item(s)`}
                      >
                        <span className="text-[8px] font-semibold text-slate-400">
                          {record.total}
                        </span>

                        <div
                          className="w-2 rounded-t-sm bg-[#4d8cf5]"
                          style={{
                            height: `${height}px`,
                          }}
                        />

                        <span className="max-w-full truncate text-[7px] text-slate-600">
                          {record.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </article>

          <article className="ui-panel flex min-h-[190px] flex-col p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="ui-panel-title">
                  Analytics
                </h2>

                <p className="mt-1 text-[9px] text-slate-600">
                  Monthly activity trend
                </p>
              </div>

              <span className="ui-badge">Trend</span>
            </div>

            {monthlyTotals.length === 0 ? (
              <div className="grid flex-1 place-items-center text-[10px] text-slate-600">
                No analytics data available.
              </div>
            ) : (
              <>
                <div className="mt-3 rounded-md border border-[#182743] bg-[#0a1223] px-2 py-2">
                  <svg
                    viewBox="0 0 100 40"
                    className="h-28 w-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Monthly activity trend line graph"
                  >
                    <line
                      x1="6"
                      y1="36"
                      x2="96"
                      y2="36"
                      stroke="#24395f"
                      strokeWidth="0.8"
                    />
                    <line
                      x1="6"
                      y1="26"
                      x2="96"
                      y2="26"
                      stroke="#1a2c49"
                      strokeWidth="0.5"
                      strokeDasharray="1.5 1.5"
                    />
                    <line
                      x1="6"
                      y1="16"
                      x2="96"
                      y2="16"
                      stroke="#1a2c49"
                      strokeWidth="0.5"
                      strokeDasharray="1.5 1.5"
                    />
                    <path
                      d={analyticsAreaPath}
                      fill="#4d8cf5"
                      opacity="0.16"
                    />
                    <path
                      d={analyticsLinePath}
                      fill="none"
                      stroke="#7fb0ff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {analyticsPoints.map((point, index) => (
                      <g key={`${point.x}-${point.y}-${index}`}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="1.4"
                          fill="#7fb0ff"
                        />
                      </g>
                    ))}
                  </svg>

                  <div className="mt-1 flex justify-between gap-2 px-1 text-[7px] text-slate-600">
                    {monthlyTotals.map((record) => (
                      <span
                        key={record.label}
                        className="truncate"
                      >
                        {record.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]">
                  <div className="rounded-md border border-[#182743] bg-[#0a1223] p-2.5">
                    <p className="text-slate-600">Peak month</p>
                    <p className="mt-1 font-semibold text-slate-200">
                      {analyticsPeak?.label ?? "N/A"}
                    </p>
                    <p className="mt-1 text-[#79adfa]">
                      {analyticsPeak?.total ?? 0} records
                    </p>
                  </div>

                  <div className="rounded-md border border-[#182743] bg-[#0a1223] p-2.5">
                    <p className="text-slate-600">Average</p>
                    <p className="mt-1 font-semibold text-slate-200">
                      {analyticsAverage}
                    </p>
                    <p className="mt-1 text-[#79adfa]">
                      per month
                    </p>
                  </div>

                  <div className="rounded-md border border-[#182743] bg-[#0a1223] p-2.5">
                    <p className="text-slate-600">Latest</p>
                    <p className="mt-1 font-semibold text-slate-200">
                      {analyticsLatest}
                    </p>
                    <p className="mt-1 text-[#79adfa]">
                      current month
                    </p>
                  </div>
                </div>
              </>
            )}
          </article>
        </div>

        <article className="ui-panel flex min-h-[350px] flex-col overflow-hidden">
          <div className="ui-panel-header">
            <div>
              <h2 className="ui-panel-title">
                Active case
              </h2>

              <p className="mt-1 text-[9px] text-slate-600">
                Current investigation requiring attention
              </p>
            </div>

            {activeCase && (
              <span className="ui-badge">
                {activeCase.status}
              </span>
            )}
          </div>

          {activeCase ? (
            <div className="flex flex-1 flex-col p-4">
              <div>
                <p className="text-[10px] font-bold text-[#79adfa]">
                  {activeCase.caseNumber}
                </p>

                <h3 className="mt-2 text-base font-semibold leading-6 text-slate-200">
                  {activeCase.title}
                </h3>

                <p className="mt-3 text-[10px] leading-5 text-slate-500">
                  {activeCase.location ||
                    "Location not recorded"}
                </p>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-[10px]">
                <div className="rounded-md border border-[#182743] bg-[#0a1223] p-3">
                  <dt className="text-slate-600">
                    Accident date
                  </dt>

                  <dd className="mt-1 font-medium text-slate-300">
                    {formatDate(activeCase.accidentDate)}
                  </dd>
                </div>

                <div className="rounded-md border border-[#182743] bg-[#0a1223] p-3">
                  <dt className="text-slate-600">
                    Officer
                  </dt>

                  <dd className="mt-1 truncate font-medium text-slate-300">
                    {activeCase.investigatingOfficer ||
                      "Not recorded"}
                  </dd>
                </div>

                <div className="rounded-md border border-[#182743] bg-[#0a1223] p-3">
                  <dt className="text-slate-600">
                    Police station
                  </dt>

                  <dd className="mt-1 truncate font-medium text-slate-300">
                    {activeCase.policeStation ||
                      "Not recorded"}
                  </dd>
                </div>

                <div className="rounded-md border border-[#182743] bg-[#0a1223] p-3">
                  <dt className="text-slate-600">
                    Reconstruction
                  </dt>

                  <dd className="mt-1 font-medium text-slate-300">
                    {activeCase.reconstructionId
                      ? "Linked"
                      : "Not linked"}
                  </dd>
                </div>
              </dl>

              <Link
                to={`/cases/${activeCase.id}`}
                className="ui-button mt-auto w-full"
              >
                Open active case
              </Link>
            </div>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <p className="text-xs font-semibold text-slate-300">
                  No active case
                </p>

                <p className="mt-2 text-[10px] leading-5 text-slate-500">
                  Create or reopen a case to show it here.
                </p>

                <Link
                  to="/cases/new"
                  className="ui-button-primary mt-4"
                >
                  <Plus size={13} />
                  New case
                </Link>
              </div>
            </div>
          )}
        </article>

        <article className="ui-panel flex min-h-[350px] flex-col overflow-hidden">
          <div className="ui-panel-header">
            <div className="min-w-0">
              <h2 className="ui-panel-title">
                Latest reconstruction
              </h2>

              <p className="mt-1 truncate text-[9px] text-slate-600">
                {previewReconstruction
                  ? `${previewReconstruction.title} · ${formatDate(
                      previewReconstruction.updatedAt,
                    )}`
                  : "No saved reconstruction"}
              </p>
            </div>

            <span className="ui-badge">2D only</span>
          </div>

          <div className="min-h-0 flex-1 bg-[#070b13]">
            {!previewReconstruction ? (
              <div className="grid h-full place-items-center p-8 text-center">
                <div>
                  <p className="text-xs font-semibold text-slate-300">
                    No reconstruction available
                  </p>

                  <p className="mt-2 max-w-xs text-[10px] leading-5 text-slate-500">
                    Create a case and add participant routes to
                    activate this preview.
                  </p>

                  <Link
                    to="/cases/new"
                    className="ui-button-primary mt-4"
                  >
                    <Plus size={13} />
                    New case
                  </Link>
                </div>
              </div>
            ) : (
              <ForensicScenePreview
                reconstruction={previewReconstruction}
                timeSeconds={previewTimeSeconds}
                showPaths
                className="h-full min-h-[285px]"
              />
            )}
          </div>

          {previewReconstruction && (
            <div className="flex items-center justify-between gap-3 border-t border-[#182743] bg-[#080e1c] px-4 py-2.5 text-[9px]">
              <span className="text-slate-500">
                {participantCount} participant
                {participantCount === 1 ? "" : "s"} ·{" "}
                {evidenceCount} evidence marker
                {evidenceCount === 1 ? "" : "s"}
              </span>

              <Link
                to={reconstructionLink}
                className="font-semibold text-[#79adfa]"
              >
                Open reconstruction
              </Link>
            </div>
          )}
        </article>
      </section>

      <section className="grid items-stretch gap-3 lg:grid-cols-3">
        <article className="ui-panel min-h-[280px] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="ui-panel-title">
              Participants ({participantCount})
            </h2>

            {previewReconstruction && (
              <Link
                to={reconstructionLink}
                className="text-[9px] font-semibold text-[#79adfa]"
              >
                Edit
              </Link>
            )}
          </div>

          <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {previewReconstruction?.vehicles
              .slice(0, 6)
              .map((participant, index) => {
                const actions = Array.from(
                  new Set(
                    participant.pathPoints.map(
                      (point) => point.action,
                    ),
                  ),
                )
                  .slice(0, 3)
                  .join(" → ");

                return (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 rounded-md border border-[#182743] bg-[#0a1223] p-3"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[#2b456f] bg-[#0c1730] text-[#8db8fb]">
                      <ParticipantIcon
                        type={participant.type}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] font-semibold text-slate-200">
                          {participant.name}
                        </p>

                        <span className="shrink-0 text-[8px] text-slate-600">
                          P{index + 1}
                        </span>
                      </div>

                      <p className="mt-0.5 text-[9px] text-slate-500">
                        {participant.type} ·{" "}
                        {participant.estimatedSpeedKmh} km/h ·{" "}
                        {participant.pathPoints.length} route
                        points
                      </p>

                      <p className="mt-1 truncate text-[8px] text-[#6e9fe8]">
                        {actions || "No movement actions"}
                      </p>
                    </div>
                  </div>
                );
              })}

            {previewReconstruction &&
              previewReconstruction.vehicles.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-[10px] font-semibold text-slate-400">
                    No participants in this reconstruction.
                  </p>

                  <p className="mt-2 text-[9px] leading-5 text-slate-600">
                    Open the reconstruction editor and confirm the
                    participants were saved.
                  </p>
                </div>
              )}

            {!previewReconstruction && (
              <p className="py-8 text-center text-[10px] text-slate-600">
                No participant data.
              </p>
            )}
          </div>
        </article>

        <article className="ui-panel min-h-[280px] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="ui-panel-title">
              Evidence markers ({evidenceCount})
            </h2>

            <Link
              to="/evidence"
              className="text-[9px] font-semibold text-[#79adfa]"
            >
              View all
            </Link>
          </div>

          <div className="mt-3 max-h-[300px] divide-y divide-[#17243d] overflow-y-auto pr-1">
            {previewReconstruction?.evidenceRecords
              .slice(0, 6)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#2a3e64] bg-[#0a1223] text-[9px] font-semibold text-[#8db8fb]">
                    E{item.evidenceNumber}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-medium text-slate-300">
                      {item.title}
                    </p>

                    <p className="mt-1 text-[8px] text-slate-600">
                      {item.category} · {item.status}
                    </p>
                  </div>
                </div>
              ))}

            {previewReconstruction &&
              previewReconstruction.evidenceRecords.length ===
                0 && (
                <p className="py-8 text-center text-[10px] text-slate-600">
                  No evidence markers recorded.
                </p>
              )}

            {!previewReconstruction && (
              <p className="py-8 text-center text-[10px] text-slate-600">
                No reconstruction selected.
              </p>
            )}
          </div>
        </article>

        <article className="ui-panel min-h-[280px] p-4">
          <h2 className="ui-panel-title">
            Scene conditions
          </h2>

          <div className="mt-4 divide-y divide-[#17243d] text-[10px]">
            {sceneConditions.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 py-3"
              >
                <span className="text-slate-500">
                  {label}
                </span>

                <span className="text-right font-medium text-slate-300">
                  {value}
                </span>
              </div>
            ))}

            {sceneConditions.length === 0 && (
              <p className="py-8 text-center text-slate-600">
                No scene configuration.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="flex flex-wrap gap-2">
        <Link to="/cases/new" className="ui-button">
          <Plus size={14} />
          New case
        </Link>

        <Link to="/scene-map" className="ui-button">
          <MapPinned size={14} />
          Open map
        </Link>

        <Link to="/reports" className="ui-button">
          <FileText size={14} />
          Reports
        </Link>

        {previewReconstruction ? (
          <Link
            to={reconstructionLink}
            className="ui-button-primary ml-auto px-6"
          >
            <Play size={14} />
            Continue reconstruction
          </Link>
        ) : (
          <Link
            to="/cases/new"
            className="ui-button-primary ml-auto px-6"
          >
            <Plus size={14} />
            Start first reconstruction
          </Link>
        )}
      </section>
    </div>
  );
}