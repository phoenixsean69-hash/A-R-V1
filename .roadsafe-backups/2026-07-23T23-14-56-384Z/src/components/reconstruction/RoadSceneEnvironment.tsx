import {
  sceneEnvironmentLabel,
  usesGeneratedRoad,
  type RoadSceneSettings,
} from "../../types/reconstruction";

interface RoadSceneEnvironmentProps {
  settings: RoadSceneSettings;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roadTexture(settings: RoadSceneSettings): string {
  const base = settings.roadSurface === "Wet" ? "#242c32" : "#30343a";
  const highlight = settings.roadSurface === "Wet" ? "rgba(165,190,205,.12)" : "rgba(255,255,255,.025)";
  return [
    `linear-gradient(115deg, transparent 0 49%, ${highlight} 50%, transparent 51%)`,
    "radial-gradient(circle at 20% 35%, rgba(255,255,255,.045) 0 1px, transparent 1.5px)",
    "radial-gradient(circle at 70% 65%, rgba(0,0,0,.22) 0 1px, transparent 1.6px)",
    `linear-gradient(${base}, ${base})`,
  ].join(",");
}

function groundTexture(settings: RoadSceneSettings): string {
  const daylightColours: Record<RoadSceneSettings["groundSurface"], string> = {
    "Unclassified Ground": "#475046",
    "Firm Soil": "#655949",
    "Loose Soil": "#74634f",
    Grass: "#3f5940",
    Gravel: "#62635f",
    Sand: "#8a7657",
    Mud: "#4b4036",
    Concrete: "#6b7072",
    "Paved Yard": "#555a5c",
    "Mixed Surface": "#54584f",
  };
  const base = settings.timeOfDay === "Night"
    ? "#151b1b"
    : daylightColours[settings.groundSurface];
  return [
    "radial-gradient(circle at 15% 30%, rgba(255,255,255,.055) 0 1px, transparent 1.5px)",
    "radial-gradient(circle at 72% 68%, rgba(0,0,0,.22) 0 1px, transparent 1.5px)",
    `linear-gradient(${base}, ${base})`,
  ].join(",");
}

function LaneLines({
  direction,
  laneCount,
  visible,
}: {
  direction: "horizontal" | "vertical";
  laneCount: number;
  visible: boolean;
}) {
  if (!visible || laneCount <= 1) return null;
  return (
    <>
      {Array.from({ length: laneCount - 1 }).map((_, index) => {
        const position = ((index + 1) / laneCount) * 100;
        const centre = laneCount % 2 === 0 && index + 1 === laneCount / 2;
        const common = centre
          ? "linear-gradient(90deg,#d7b34c,#d7b34c)"
          : direction === "horizontal"
            ? "repeating-linear-gradient(90deg,rgba(236,238,235,.82) 0 18px,transparent 18px 35px)"
            : "repeating-linear-gradient(180deg,rgba(236,238,235,.82) 0 18px,transparent 18px 35px)";
        return (
          <span
            key={`${direction}-${position}`}
            className="absolute opacity-80 shadow-[0_0_1px_rgba(255,255,255,.35)]"
            style={
              direction === "horizontal"
                ? { left: 0, right: 0, top: `${position}%`, height: centre ? 2.5 : 1.5, transform: "translateY(-50%)", background: common }
                : { top: 0, bottom: 0, left: `${position}%`, width: centre ? 2.5 : 1.5, transform: "translateX(-50%)", background: common }
            }
          />
        );
      })}
    </>
  );
}

function RoadStrip({
  orientation,
  width,
  settings,
  top = 50,
  left = 50,
  start = 0,
  length = 100,
}: {
  orientation: "horizontal" | "vertical";
  width: number;
  settings: RoadSceneSettings;
  top?: number;
  left?: number;
  start?: number;
  length?: number;
}) {
  const pavement = settings.showPavements ? 4.5 : 0;
  const outerWidth = width + pavement * 2;
  const horizontal = orientation === "horizontal";
  return (
    <div
      className="absolute overflow-visible"
      style={
        horizontal
          ? { left: `${start}%`, top: `${top}%`, width: `${length}%`, height: `${outerWidth}%`, transform: "translateY(-50%)" }
          : { top: `${start}%`, left: `${left}%`, height: `${length}%`, width: `${outerWidth}%`, transform: "translateX(-50%)" }
      }
    >
      {settings.showPavements && (
        <div
          className="absolute inset-0 border border-black/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]"
          style={{
            background:
              horizontal
                ? "repeating-linear-gradient(90deg,#767b80 0 22px,#6b7075 22px 44px)"
                : "repeating-linear-gradient(180deg,#767b80 0 22px,#6b7075 22px 44px)",
          }}
        />
      )}
      <div
        className="absolute overflow-hidden shadow-[inset_0_0_18px_rgba(0,0,0,.55)]"
        style={
          horizontal
            ? { left: 0, right: 0, top: "50%", height: `${(width / outerWidth) * 100}%`, transform: "translateY(-50%)", background: roadTexture(settings), backgroundSize: "18px 18px,7px 7px,9px 9px,auto" }
            : { top: 0, bottom: 0, left: "50%", width: `${(width / outerWidth) * 100}%`, transform: "translateX(-50%)", background: roadTexture(settings), backgroundSize: "18px 18px,7px 7px,9px 9px,auto" }
        }
      >
        <LaneLines direction={orientation} laneCount={settings.laneCount} visible={settings.showLaneMarkings} />
        <span
          className="absolute bg-white/55"
          style={horizontal ? { left: 0, right: 0, top: 1, height: 1 } : { top: 0, bottom: 0, left: 1, width: 1 }}
        />
        <span
          className="absolute bg-white/55"
          style={horizontal ? { left: 0, right: 0, bottom: 1, height: 1 } : { top: 0, bottom: 0, right: 1, width: 1 }}
        />
      </div>
    </div>
  );
}

function ZebraCrossing({ orientation }: { orientation: "horizontal" | "vertical" }) {
  const horizontal = orientation === "horizontal";
  return (
    <div
      className="absolute left-1/2 top-1/2 z-[3] flex -translate-x-1/2 -translate-y-1/2 gap-[3px] opacity-80"
      style={horizontal ? { width: "28%", height: "10%", flexDirection: "row" } : { width: "10%", height: "28%", flexDirection: "column" }}
    >
      {Array.from({ length: 10 }).map((_, index) => (
        <span key={index} className="block flex-1 bg-[#e6e7e4] shadow-[0_0_1px_rgba(255,255,255,.45)]" />
      ))}
    </div>
  );
}

function TrafficControls({ settings }: { settings: RoadSceneSettings }) {
  if (settings.trafficControl === "None") return null;
  const positions = [
    { left: "35%", top: "34%" },
    { right: "35%", top: "34%" },
    { left: "35%", bottom: "34%" },
    { right: "35%", bottom: "34%" },
  ];

  if (settings.trafficControl === "Traffic Lights") {
    return (
      <>
        {positions.map((style, index) => (
          <div key={index} className="absolute z-[4]" style={style}>
            <span className="absolute left-1/2 top-4 h-8 w-[2px] -translate-x-1/2 bg-[#3a3f43]" />
            <div className="relative flex h-8 w-3 flex-col items-center justify-around rounded-sm border border-black bg-[#171a1d] p-[2px] shadow-lg">
              <span className="h-2 w-2 rounded-full bg-red-600/80" />
              <span className="h-2 w-2 rounded-full bg-amber-500/50" />
              <span className="h-2 w-2 rounded-full bg-emerald-600/45" />
            </div>
          </div>
        ))}
      </>
    );
  }

  const stop = settings.trafficControl === "Stop Signs";
  return (
    <>
      {positions.map((style, index) => (
        <div key={index} className="absolute z-[4]" style={style}>
          <span className="absolute left-1/2 top-6 h-8 w-[2px] -translate-x-1/2 bg-[#4b4f52]" />
          <div className={`relative grid h-7 w-7 place-items-center border-2 border-white text-[6px] font-black text-white shadow-lg ${stop ? "rounded-full bg-[#8f2830]" : "rotate-45 rounded-sm bg-[#8b6f28]"}`}>
            <span className={stop ? "" : "-rotate-45"}>{stop ? "STOP" : "GIVE"}</span>
          </div>
        </div>
      ))}
    </>
  );
}

function Roundabout({ width, settings }: { width: number; settings: RoadSceneSettings }) {
  return (
    <>
      <RoadStrip orientation="horizontal" width={width} settings={settings} />
      <RoadStrip orientation="vertical" width={width} settings={settings} />
      <div className="absolute left-1/2 top-1/2 z-[2] h-[39%] w-[39%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[13px] border-[#30343a] shadow-[0_0_0_5px_#71767b,inset_0_0_20px_rgba(0,0,0,.45)]" style={{ background: groundTexture(settings), backgroundSize: "10px 10px,12px 12px,auto" }}>
        <div className="absolute inset-[20%] rounded-full border border-[#536158] bg-[#253229] shadow-inner" />
      </div>
    </>
  );
}

function TransportTerminus({ width, settings }: { width: number; settings: RoadSceneSettings }) {
  return (
    <>
      <RoadStrip orientation="horizontal" width={width} settings={settings} top={77} />
      <div className="absolute left-[10%] top-[10%] h-[54%] w-[80%] border-[5px] border-[#747a7f] bg-[#30343a] shadow-2xl" style={{ background: roadTexture(settings), backgroundSize: "18px 18px,7px 7px,9px 9px,auto" }}>
        <div className="grid h-full grid-cols-4 gap-3 p-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="relative border border-dashed border-white/55">
              <span className="absolute bottom-1 left-1 text-[7px] font-semibold text-white/55">BAY {index + 1}</span>
            </div>
          ))}
        </div>
      </div>
      <RoadStrip orientation="vertical" width={Math.max(12, width - 8)} settings={settings} start={57} length={43} />
    </>
  );
}

function WeatherOverlay({ settings }: { settings: RoadSceneSettings }) {
  const night = settings.timeOfDay === "Night";
  return (
    <>
      {settings.weather === "Rain" && <div className="pointer-events-none absolute inset-0 z-40 opacity-25" style={{ background: "repeating-linear-gradient(112deg,transparent 0 15px,rgba(190,214,228,.75) 15px 16px,transparent 16px 31px)" }} />}
      {settings.weather === "Fog" && <div className="pointer-events-none absolute inset-0 z-40 bg-slate-200/28 backdrop-blur-[1px]" />}
      {settings.weather === "Dust" && <div className="pointer-events-none absolute inset-0 z-40 bg-[#9b8058]/18" />}
      {night && <div className="pointer-events-none absolute inset-0 z-30 bg-[#030816]/45 mix-blend-multiply" />}
      {settings.visibility === "Reduced" && <div className="pointer-events-none absolute inset-0 z-40 bg-slate-200/12" />}
      {settings.visibility === "Poor" && <div className="pointer-events-none absolute inset-0 z-40 bg-slate-200/28" />}
    </>
  );
}

export default function RoadSceneEnvironment({ settings }: RoadSceneEnvironmentProps) {
  const roadWidth = clamp(16 + settings.laneCount * 3.5, 20, 38);
  const generatedRoad = usesGeneratedRoad(settings);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        background: groundTexture(settings),
        backgroundSize: "9px 9px,12px 12px,auto",
      }}
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {generatedRoad && (
        <div
          className="absolute inset-0 origin-center"
          style={{ transform: `rotate(${settings.roadRotation}deg) scale(1.08)` }}
        >
          {settings.roadLayout === "Four-way Intersection" && (
            <>
              <RoadStrip orientation="horizontal" width={roadWidth} settings={settings} />
              <RoadStrip orientation="vertical" width={roadWidth} settings={settings} />
            </>
          )}
          {settings.roadLayout === "T-Junction" && (
            <>
              <RoadStrip orientation="horizontal" width={roadWidth} settings={settings} />
              <RoadStrip orientation="vertical" width={roadWidth} settings={settings} start={50} length={50} />
            </>
          )}
          {settings.roadLayout === "Straight Road" && (
            <RoadStrip orientation="horizontal" width={roadWidth} settings={settings} />
          )}
          {settings.roadLayout === "Pedestrian Crossing" && (
            <>
              <RoadStrip orientation="horizontal" width={roadWidth} settings={settings} />
              <ZebraCrossing orientation="vertical" />
            </>
          )}
          {settings.roadLayout === "Roundabout" && (
            <Roundabout width={roadWidth} settings={settings} />
          )}
          {settings.roadLayout === "Transport Terminus" && (
            <TransportTerminus width={roadWidth} settings={settings} />
          )}
          {settings.showPedestrianCrossing &&
            settings.roadLayout !== "Pedestrian Crossing" && (
              <ZebraCrossing orientation="vertical" />
            )}
          <TrafficControls settings={settings} />
          {settings.roadSurface === "Damaged" && (
            <div className="absolute inset-0 z-[3] opacity-55">
              {[
                ["18%", "46%", "60px", "10deg"],
                ["28%", "51%", "42px", "-12deg"],
                ["70%", "54%", "70px", "-7deg"],
                ["49%", "21%", "54px", "86deg"],
              ].map(([left, top, width, rotate], index) => (
                <span
                  key={index}
                  className="absolute h-[2px] bg-black/80"
                  style={{ left, top, width, transform: `rotate(${rotate})` }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {generatedRoad && settings.roadSurface === "Wet" && (
        <div className="absolute inset-0 z-[2] bg-sky-100/5 mix-blend-screen" />
      )}

      <div className="absolute bottom-3 left-3 z-20 rounded-md border border-white/10 bg-[#05080e]/75 px-3 py-2 text-[9px] font-semibold text-slate-200 backdrop-blur-sm">
        {sceneEnvironmentLabel(settings)}
      </div>

      {!generatedRoad && (
        <div className="absolute left-3 top-3 z-20 rounded-md border border-sky-300/20 bg-[#07111d]/82 px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] text-sky-100 backdrop-blur-sm">
          Real-location ground scene · no generated road
        </div>
      )}

      {generatedRoad && settings.speedLimitKmh > 0 && (
        <div className="absolute right-3 top-3 z-20 grid h-12 w-12 place-items-center rounded-full border-[3px] border-[#8f2830] bg-[#e8e9e6] text-center shadow-lg">
          <span className="text-sm font-black leading-none text-[#17191b]">
            {settings.speedLimitKmh}
            <span className="block text-[5px] uppercase tracking-wide">km/h</span>
          </span>
        </div>
      )}
      <WeatherOverlay settings={settings} />
    </div>
  );
}
