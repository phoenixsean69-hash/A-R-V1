import { useState } from "react";
import AccidentMap, { type VisualizationMode } from "../components/map/AccidentMap";
import { createDefaultHeatmapFilters } from "../types/heatmap";

export default function SceneMapPage() {
  const [mode, setMode] = useState<VisualizationMode>("markers");
  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_280px]">
      <section className="ui-panel overflow-hidden"><div className="h-[calc(100vh-185px)] min-h-[560px]"><AccidentMap visualizationMode={mode} onVisualizationModeChange={setMode} heatmapFilters={createDefaultHeatmapFilters()} /></div></section>
      <aside className="space-y-3">
        <section className="ui-panel p-4"><h2 className="ui-panel-title">Map layers</h2><div className="mt-4 space-y-3">{["Accidents","Blackspots","Roads","Junctions","Traffic cameras"].map((item,index)=><label key={item} className="flex items-center gap-3 text-xs text-slate-400"><input type="checkbox" defaultChecked={index < 3} className="accent-[#4d8cf5]" />{item}</label>)}</div></section>
        <section className="ui-panel p-4"><h2 className="ui-panel-title">Blackspot legend</h2><div className="mt-4 space-y-3 text-[10px]">{[["Very high risk","bg-red-500"],["High risk","bg-orange-500"],["Medium risk","bg-amber-400"],["Low risk","bg-emerald-500"]].map(([label,colour])=><div key={label} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${colour}`} /><span className="text-slate-400">{label}</span></div>)}</div></section>
      </aside>
    </div>
  );
}
