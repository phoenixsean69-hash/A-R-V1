import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line, PolarArea, Radar } from "react-chartjs-2";
import { Activity, AlertTriangle, Gauge, MapPinned, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { WorkspaceDataService } from "../services/workspaceDataService";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
);

const chartText = "#8290a5";
const chartGrid = "rgba(84,105,140,0.18)";
const blue = "#4f8ce6";
const blueSoft = "rgba(79,140,230,0.22)";
const slate = "#62718a";
const steel = "#94a3b8";
const danger = "#a8424a";
const amber = "#a57a32";

const commonPlugins = {
  legend: {
    labels: {
      color: chartText,
      boxWidth: 10,
      boxHeight: 10,
      font: { size: 9 },
    },
  },
  tooltip: {
    backgroundColor: "#070c17",
    borderColor: "#263958",
    borderWidth: 1,
    titleColor: "#e5edf8",
    bodyColor: "#9ba8ba",
  },
};

export default function AnalyticsPage() {
  const summary = WorkspaceDataService.getSummary();
  const monthly = WorkspaceDataService.getMonthlyActivity();
  const severities = WorkspaceDataService.getSeverityDistribution();
  const causes = WorkspaceDataService.getCauseDistribution();
  const participants = WorkspaceDataService.getParticipantDistribution();
  const roadConditions = WorkspaceDataService.getRoadConditionDistribution();
  const junctions = WorkspaceDataService.getJunctionRiskRows().sort(
    (left, right) => right.accidents - left.accidents,
  );

  const reconstructionReadiness = summary.reconstructions.length
    ? {
        participants: Math.min(
          100,
          (summary.reconstructions.reduce((total, item) => total + item.vehicles.length, 0) /
            summary.reconstructions.length / 3) * 100,
        ),
        evidence: Math.min(
          100,
          (summary.reconstructions.reduce((total, item) => total + item.evidenceRecords.length, 0) /
            summary.reconstructions.length / 5) * 100,
        ),
        measurements: Math.min(
          100,
          (summary.reconstructions.reduce((total, item) => total + item.measurements.length, 0) /
            summary.reconstructions.length / 4) * 100,
        ),
        photos: Math.min(
          100,
          (summary.reconstructions.reduce((total, item) => total + item.photos.length, 0) /
            summary.reconstructions.length / 4) * 100,
        ),
        timelines: Math.min(
          100,
          (summary.reconstructions.reduce((total, item) => total + item.timelineEvents.length, 0) /
            summary.reconstructions.length / 5) * 100,
        ),
      }
    : { participants: 0, evidence: 0, measurements: 0, photos: 0, timelines: 0 };

  const maxJunctionAccidents = Math.max(1, ...junctions.map((item) => item.accidents));

  const metricCards: Array<[string, number, LucideIcon, string]> = [
          ["Accident records", WorkspaceDataService.getMonthlyActivity().reduce((total, item) => total + item.accidents, 0), Activity, "Research accident register"],
          ["Recorded casualties", summary.totalFatalities + summary.totalInjuries, AlertTriangle, `${summary.totalFatalities} fatal · ${summary.totalInjuries} injured`],
          ["High-risk junctions", summary.highRiskJunctions, MapPinned, "Current junction register"],
          ["Reconstruction coverage", summary.reconstructionCount, Gauge, `${summary.evidenceCount} evidence records`],
  ];

  return (
    <div className="space-y-3">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(([label, value, Icon, note]) => (
          <article key={label} className="ui-panel flex items-center gap-3 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-md border border-[#29446f] bg-[#0d1930] text-[#85b2f6]"><Icon size={18} strokeWidth={1.5} /></div>
            <div><p className="text-[8px] font-bold uppercase tracking-[0.12em] text-slate-600">{label}</p><p className="mt-1 text-xl font-bold text-slate-200">{value}</p><p className="mt-1 text-[8px] text-slate-600">{note}</p></div>
          </article>
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.35fr_.85fr]">
        <ChartPanel title="Accident and case activity" subtitle="Monthly comparison across real stored cases and accident records">
          <Line
            data={{
              labels: monthly.map((item) => item.label),
              datasets: [
                { label: "Accident records", data: monthly.map((item) => item.accidents), borderColor: blue, backgroundColor: blueSoft, fill: true, tension: 0.32, pointRadius: 2 },
                { label: "Investigation cases", data: monthly.map((item) => item.cases), borderColor: steel, backgroundColor: "rgba(148,163,184,0.08)", tension: 0.32, pointRadius: 2 },
              ],
            }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: commonPlugins, scales: { x: { ticks: { color: chartText, font: { size: 8 } }, grid: { color: chartGrid } }, y: { beginAtZero: true, ticks: { color: chartText, precision: 0, font: { size: 8 } }, grid: { color: chartGrid } } } }}
          />
        </ChartPanel>

        <ChartPanel title="Collision severity" subtitle="Distribution within the accident register">
          <Doughnut
            data={{ labels: severities.map((item) => item.label), datasets: [{ data: severities.map((item) => item.value), backgroundColor: [danger, amber, blue, slate], borderColor: "#090f20", borderWidth: 3 }] }}
            options={{ responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: commonPlugins }}
          />
        </ChartPanel>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <ChartPanel title="Leading collision causes" subtitle="Ranked from the recorded accident dataset">
          <Bar
            data={{ labels: causes.slice(0, 8).map((item) => item.label), datasets: [{ label: "Accidents", data: causes.slice(0, 8).map((item) => item.value), backgroundColor: causes.slice(0, 8).map((_, index) => index < 2 ? danger : index < 5 ? blue : slate), borderRadius: 3 }] }}
            options={{ indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { ...commonPlugins, legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { color: chartText, precision: 0, font: { size: 8 } }, grid: { color: chartGrid } }, y: { ticks: { color: chartText, font: { size: 8 } }, grid: { display: false } } } }}
          />
        </ChartPanel>

        <ChartPanel title="Reconstruction evidence readiness" subtitle="Average scene documentation depth">
          <Radar
            data={{ labels: ["Participants", "Evidence", "Measurements", "Photos", "Timeline"], datasets: [{ label: "Coverage", data: Object.values(reconstructionReadiness), borderColor: blue, backgroundColor: blueSoft, pointBackgroundColor: "#a9caff", pointRadius: 2 }] }}
            options={{ responsive: true, maintainAspectRatio: false, plugins: commonPlugins, scales: { r: { min: 0, max: 100, ticks: { display: false }, pointLabels: { color: chartText, font: { size: 9 } }, angleLines: { color: chartGrid }, grid: { color: chartGrid } } } }}
          />
        </ChartPanel>
      </section>

      <section className="grid gap-3 xl:grid-cols-[.85fr_1.15fr]">
        <ChartPanel title="Road and weather combinations" subtitle="Conditions captured in reconstruction scenes">
          {roadConditions.length ? (
            <PolarArea
              data={{ labels: roadConditions.map((item) => item.label), datasets: [{ data: roadConditions.map((item) => item.value), backgroundColor: roadConditions.map((_, index) => ["rgba(79,140,230,.55)", "rgba(98,113,138,.58)", "rgba(165,122,50,.58)", "rgba(168,66,74,.55)"][index % 4]), borderColor: "#090f20", borderWidth: 2 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: commonPlugins, scales: { r: { ticks: { display: false }, grid: { color: chartGrid } } } }}
            />
          ) : <EmptyChart text="No reconstruction scene conditions have been saved." />}
        </ChartPanel>

        <ChartPanel title="Participant types" subtitle="Road users represented across saved reconstructions">
          {participants.length ? (
            <Bar
              data={{ labels: participants.map((item) => item.label), datasets: [{ label: "Participants", data: participants.map((item) => item.value), backgroundColor: participants.map((_, index) => index === 0 ? blue : index === 1 ? steel : slate), borderRadius: 3 }] }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { ...commonPlugins, legend: { display: false } }, scales: { x: { ticks: { color: chartText, font: { size: 8 } }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: chartText, precision: 0, font: { size: 8 } }, grid: { color: chartGrid } } } }}
            />
          ) : <EmptyChart text="No participants have been added to saved reconstructions." />}
        </ChartPanel>
      </section>

      <section className="ui-panel overflow-hidden">
        <div className="ui-panel-header"><div><h2 className="ui-panel-title">Junction risk ranking</h2><p className="mt-1 text-[9px] text-slate-600">Accident volume, casualties and registered risk level</p></div></div>
        <div className="divide-y divide-[#17243d]">
          {junctions.map((junction, index) => (
            <div key={junction.id} className="grid gap-3 px-4 py-3 text-[10px] md:grid-cols-[32px_1fr_160px_100px_100px_90px] md:items-center">
              <span className="text-slate-600">#{index + 1}</span>
              <div><p className="font-semibold text-slate-300">{junction.name}</p><p className="mt-1 text-[8px] text-slate-600">{junction.roadType} · {junction.city}</p></div>
              <div className="h-1.5 overflow-hidden rounded bg-[#17243d]"><div className="h-full bg-[#4f8ce6]" style={{ width: `${(junction.accidents / maxJunctionAccidents) * 100}%` }} /></div>
              <span className="text-slate-400">{junction.accidents} accidents</span>
              <span className="text-slate-400">{junction.injuries} injuries</span>
              <span className={junction.riskLevel === "High" ? "text-red-400" : junction.riskLevel === "Medium" ? "text-amber-400" : "text-slate-400"}>{junction.riskLevel}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="ui-panel p-4">
      <h2 className="ui-panel-title">{title}</h2>
      <p className="mt-1 text-[9px] text-slate-600">{subtitle}</p>
      <div className="mt-4 h-72">{children}</div>
    </section>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <div className="grid h-full place-items-center rounded-md border border-dashed border-[#243451] text-center text-[10px] text-slate-600">{text}</div>;
}
