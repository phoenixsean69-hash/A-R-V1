import { useMemo, useState } from "react";
import {
  Activity,
  Crosshair,
  Info,
  Map,
  MousePointer2,
  ShieldAlert,
} from "lucide-react";

import AccidentMap, {
  type VisualizationMode,
} from "../components/map/AccidentMap";
import { createDefaultHeatmapFilters } from "../types/heatmap";

const riskLevels = [
  {
    label: "Very high risk",
    detail: "Critical intervention priority",
    colour: "#ef4444",
    border: "#713646",
    background: "#321722",
  },
  {
    label: "High risk",
    detail: "Frequent or severe incidents",
    colour: "#f97316",
    border: "#704126",
    background: "#2d1b12",
  },
  {
    label: "Medium risk",
    detail: "Requires continued monitoring",
    colour: "#fbbf24",
    border: "#6d5523",
    background: "#241d10",
  },
  {
    label: "Low risk",
    detail: "Lower recorded incident exposure",
    colour: "#34d399",
    border: "#28645e",
    background: "#0d2928",
  },
] as const;

const workflowSteps = [
  {
    number: "01",
    title: "Choose a view",
    detail: "Use Markers for junction records or Heatmap for concentration.",
  },
  {
    number: "02",
    title: "Draw an area",
    detail: "Select Area, then drag across the road network to define a zone.",
  },
  {
    number: "03",
    title: "Analyse",
    detail: "Review crashes, casualties, junction count and overall risk.",
  },
] as const;

export default function SceneMapPage() {
  const [mode, setMode] = useState<VisualizationMode>("markers");
  const heatmapFilters = useMemo(() => createDefaultHeatmapFilters(), []);

  return (
    <div className="scene-map-page grid min-w-0 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="ui-panel min-w-0 overflow-hidden">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-[#18243f] px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#315b91] bg-[#0b1b38] text-[#81b2fa]">
              <Map size={17} strokeWidth={1.8} />
            </div>

            <div className="min-w-0">
              <h2 className="ui-panel-title truncate">
                Road-safety intelligence map
              </h2>
              <p className="mt-1 truncate text-[9px] text-slate-500">
                Junction risk, accident concentration and selected-area analysis
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded border border-[#284a7b] bg-[#112241] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#8ebcff]">
              <Activity size={10} strokeWidth={2} />
              {mode === "markers" ? "Junction markers" : "Accident heatmap"}
            </span>

            <span className="inline-flex items-center gap-1.5 rounded border border-[#28645e] bg-[#0d2928] px-2 py-1 text-[8px] font-bold uppercase tracking-[0.08em] text-[#8ed6ca]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#55b9aa]" />
              Map ready
            </span>
          </div>
        </div>

        <div className="relative h-[clamp(520px,calc(100vh-198px),860px)] min-w-0 overflow-hidden bg-[#030714]">
          <AccidentMap
            visualizationMode={mode}
            onVisualizationModeChange={setMode}
            heatmapFilters={heatmapFilters}
            compactSelectionPanel
          />
        </div>
      </section>

      <aside className="min-w-0 space-y-3 xl:max-h-[calc(100vh-92px)] xl:overflow-y-auto xl:overscroll-contain xl:pr-1 [scrollbar-color:#223656_#070d1a] [scrollbar-width:thin]">
        <section className="ui-panel min-w-0 overflow-hidden">
          <div className="ui-panel-header gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Crosshair
                size={15}
                strokeWidth={1.8}
                className="shrink-0 text-[#7facf0]"
              />
              <div className="min-w-0">
                <h2 className="ui-panel-title truncate">Map operation</h2>
                <p className="mt-1 truncate text-[8px] text-slate-600">
                  Controls are positioned inside the map
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3">
            <div className="rounded-md border border-[#1a2946] bg-[#070d1a] px-3 py-3">
              <div className="flex items-start gap-2.5">
                <MousePointer2
                  size={14}
                  strokeWidth={1.8}
                  className="mt-0.5 shrink-0 text-[#7facf0]"
                />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-300">
                    Current visualization
                  </p>
                  <p className="mt-1 text-[8px] leading-4 text-slate-600">
                    {mode === "markers"
                      ? "Individual junction markers are visible. Select a marker to open its complete risk analysis."
                      : "Recorded accident density is displayed by geographic concentration."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-[#1a2946] bg-[#070d1a] px-3 py-3">
              <div className="flex items-start gap-2.5">
                <Info
                  size={14}
                  strokeWidth={1.8}
                  className="mt-0.5 shrink-0 text-[#7facf0]"
                />
                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-300">
                    Available controls
                  </p>
                  <p className="mt-1 text-[8px] leading-4 text-slate-600">
                    Switch Street or Hybrid imagery, change the visualization,
                    zoom, and draw an analysis area without leaving the map.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ui-panel min-w-0 overflow-hidden">
          <div className="ui-panel-header gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <ShieldAlert
                size={15}
                strokeWidth={1.8}
                className="shrink-0 text-[#d9bd78]"
              />
              <div className="min-w-0">
                <h2 className="ui-panel-title truncate">
                  Risk classification
                </h2>
                <p className="mt-1 truncate text-[8px] text-slate-600">
                  Operational blackspot severity
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3">
            {riskLevels.map((risk) => (
              <div
                key={risk.label}
                className="flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5"
                style={{
                  borderColor: risk.border,
                  backgroundColor: risk.background,
                }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: risk.colour,
                    boxShadow: `0 0 8px ${risk.colour}55`,
                  }}
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <p className="truncate text-[9px] font-bold text-slate-300">
                    {risk.label}
                  </p>
                  <p className="mt-0.5 truncate text-[7px] text-slate-600">
                    {risk.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ui-panel min-w-0 overflow-hidden">
          <div className="ui-panel-header">
            <h2 className="ui-panel-title">Area-analysis workflow</h2>
          </div>

          <div className="space-y-2 p-3">
            {workflowSteps.map((step) => (
              <div
                key={step.number}
                className="flex min-w-0 items-start gap-3 rounded-md border border-[#1a2946] bg-[#070d1a] px-3 py-3"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[#315b91] bg-[#0b1b38] font-mono text-[8px] font-bold text-[#8ebcff]">
                  {step.number}
                </span>

                <div className="min-w-0">
                  <p className="text-[9px] font-bold text-slate-300">
                    {step.title}
                  </p>
                  <p className="mt-1 text-[8px] leading-4 text-slate-600">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-[#3e3420] bg-[#17140c] px-3 py-3">
          <div className="flex items-start gap-2.5">
            <Info
              size={13}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0 text-[#d9bd78]"
            />
            <p className="text-[8px] leading-4 text-[#bba56f]">
              Risk results reflect the accident and junction records currently
              stored in this prototype. Validate recommendations against field
              observations and official records.
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
