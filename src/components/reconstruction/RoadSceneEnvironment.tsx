import type {
  RoadSceneSettings,
} from "../../types/reconstruction";

interface RoadSceneEnvironmentProps {
  settings: RoadSceneSettings;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function getGroundColour(
  settings: RoadSceneSettings,
): string {
  switch (settings.timeOfDay) {
    case "Night":
      return "#172033";

    case "Dusk":
      return "#77635f";

    case "Dawn":
      return "#8b8276";

    case "Day":
    default:
      return "#64745b";
  }
}

function getRoadColour(
  settings: RoadSceneSettings,
): string {
  if (settings.roadSurface === "Wet") {
    return "#202630";
  }

  if (settings.roadSurface === "Damaged") {
    return "#3f4143";
  }

  return settings.timeOfDay === "Night"
    ? "#222936"
    : "#30343b";
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
  if (!visible || laneCount <= 1) {
    return null;
  }

  return (
    <>
      {Array.from({
        length: laneCount - 1,
      }).map((_, index) => {
        const position =
          ((index + 1) / laneCount) *
          100;

        const isCentre =
          laneCount % 2 === 0 &&
          index + 1 === laneCount / 2;

        return (
          <span
            key={`${direction}-${position}`}
            className="absolute opacity-90"
            style={
              direction === "horizontal"
                ? {
                    left: 0,
                    right: 0,
                    top: `${position}%`,
                    height: isCentre
                      ? 3
                      : 2,
                    transform:
                      "translateY(-50%)",
                    background: isCentre
                      ? "#facc15"
                      : "repeating-linear-gradient(to right, rgba(255,255,255,.9) 0 16px, transparent 16px 30px)",
                  }
                : {
                    top: 0,
                    bottom: 0,
                    left: `${position}%`,
                    width: isCentre
                      ? 3
                      : 2,
                    transform:
                      "translateX(-50%)",
                    background: isCentre
                      ? "#facc15"
                      : "repeating-linear-gradient(to bottom, rgba(255,255,255,.9) 0 16px, transparent 16px 30px)",
                  }
            }
          />
        );
      })}
    </>
  );
}

function HorizontalRoad({
  width,
  settings,
  top = 50,
  left = 0,
  length = 100,
}: {
  width: number;
  settings: RoadSceneSettings;
  top?: number;
  left?: number;
  length?: number;
}) {
  const roadColour =
    getRoadColour(settings);

  return (
    <div
      className="absolute"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${length}%`,
        height: `${
          settings.showPavements
            ? width + 5
            : width
        }%`,
        transform: "translateY(-50%)",
        backgroundColor:
          settings.showPavements
            ? "#9ca3af"
            : roadColour,
      }}
    >
      <div
        className="absolute left-0 right-0 top-1/2 overflow-hidden"
        style={{
          height: `${
            (width /
              (settings.showPavements
                ? width + 5
                : width)) *
            100
          }%`,
          transform: "translateY(-50%)",
          backgroundColor: roadColour,
        }}
      >
        <LaneLines
          direction="horizontal"
          laneCount={settings.laneCount}
          visible={
            settings.showLaneMarkings
          }
        />
      </div>
    </div>
  );
}

function VerticalRoad({
  width,
  settings,
  left = 50,
  top = 0,
  length = 100,
}: {
  width: number;
  settings: RoadSceneSettings;
  left?: number;
  top?: number;
  length?: number;
}) {
  const roadColour =
    getRoadColour(settings);

  return (
    <div
      className="absolute"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${
          settings.showPavements
            ? width + 5
            : width
        }%`,
        height: `${length}%`,
        transform: "translateX(-50%)",
        backgroundColor:
          settings.showPavements
            ? "#9ca3af"
            : roadColour,
      }}
    >
      <div
        className="absolute bottom-0 left-1/2 top-0 overflow-hidden"
        style={{
          width: `${
            (width /
              (settings.showPavements
                ? width + 5
                : width)) *
            100
          }%`,
          transform: "translateX(-50%)",
          backgroundColor: roadColour,
        }}
      >
        <LaneLines
          direction="vertical"
          laneCount={settings.laneCount}
          visible={
            settings.showLaneMarkings
          }
        />
      </div>
    </div>
  );
}

function ZebraCrossing({
  orientation = "vertical",
}: {
  orientation?:
    | "vertical"
    | "horizontal";
}) {
  return (
    <div
      className="absolute left-1/2 top-1/2 z-[2] flex -translate-x-1/2 -translate-y-1/2 gap-1"
      style={
        orientation === "vertical"
          ? {
              width: "12%",
              height: "24%",
              flexDirection: "column",
            }
          : {
              width: "24%",
              height: "12%",
              flexDirection: "row",
            }
      }
    >
      {Array.from({ length: 8 }).map(
        (_, index) => (
          <span
            key={index}
            className="block flex-1 bg-white/90 shadow-sm"
          />
        ),
      )}
    </div>
  );
}

function TrafficControls({
  settings,
}: {
  settings: RoadSceneSettings;
}) {
  if (
    settings.trafficControl === "None"
  ) {
    return null;
  }

  const positions = [
    "left-[35%] top-[35%]",
    "right-[35%] top-[35%]",
    "bottom-[35%] left-[35%]",
    "bottom-[35%] right-[35%]",
  ];

  if (
    settings.trafficControl ===
    "Traffic Lights"
  ) {
    return (
      <>
        {positions.map((position) => (
          <div
            key={position}
            className={`absolute ${position} z-[3] flex h-8 w-3 flex-col items-center justify-around rounded bg-gray-950 p-0.5 shadow-lg`}
          >
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="h-2 w-2 rounded-full bg-green-500" />
          </div>
        ))}
      </>
    );
  }

  const label =
    settings.trafficControl ===
    "Stop Signs"
      ? "STOP"
      : "YIELD";

  const classes =
    settings.trafficControl ===
    "Stop Signs"
      ? "rounded-full bg-red-600"
      : "rounded-md bg-amber-500";

  return (
    <>
      {positions.map((position) => (
        <div
          key={position}
          className={`absolute ${position} z-[3] flex h-8 w-8 items-center justify-center border-2 border-white text-[7px] font-black text-white shadow-lg ${classes}`}
        >
          {label}
        </div>
      ))}
    </>
  );
}

function Roundabout({
  width,
  settings,
}: {
  width: number;
  settings: RoadSceneSettings;
}) {
  const roadColour =
    getRoadColour(settings);

  const ringWidth = clamp(
    18 + settings.laneCount * 4,
    22,
    42,
  );

  return (
    <>
      <HorizontalRoad
        width={width}
        settings={settings}
      />

      <VerticalRoad
        width={width}
        settings={settings}
      />

      <div
        className="absolute left-1/2 top-1/2 z-[1] aspect-square w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-xl"
        style={{
          border: `${ringWidth}px solid ${roadColour}`,
          backgroundColor:
            getGroundColour(settings),
          boxShadow:
            settings.showPavements
              ? "0 0 0 8px #9ca3af"
              : undefined,
        }}
      >
        <div className="absolute inset-[20%] rounded-full border-4 border-white/25 bg-green-700/70" />
      </div>
    </>
  );
}

function TransportTerminus({
  width,
  settings,
}: {
  width: number;
  settings: RoadSceneSettings;
}) {
  return (
    <>
      <HorizontalRoad
        width={width}
        settings={settings}
        top={75}
      />

      <div className="absolute left-[12%] top-[12%] h-[52%] w-[76%] rounded-2xl border-8 border-gray-400 bg-[#30343b] shadow-xl">
        <div className="grid h-full grid-cols-4 gap-3 p-5">
          {Array.from({ length: 8 }).map(
            (_, index) => (
              <div
                key={index}
                className="relative rounded-lg border-2 border-dashed border-white/70"
              >
                <span className="absolute bottom-1 left-1 text-[8px] font-bold text-white/80">
                  BAY {index + 1}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      <VerticalRoad
        width={Math.max(12, width - 8)}
        settings={settings}
        left={50}
        top={58}
        length={42}
      />
    </>
  );
}

function RoadDamageOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] opacity-55">
      <span className="absolute left-[18%] top-[46%] h-1 w-16 rotate-12 bg-black" />
      <span className="absolute left-[25%] top-[48%] h-1 w-10 -rotate-12 bg-black" />
      <span className="absolute right-[20%] top-[53%] h-1 w-16 -rotate-6 bg-black" />
      <span className="absolute left-[48%] top-[20%] h-16 w-1 rotate-12 bg-black" />
      <span className="absolute left-[52%] bottom-[16%] h-14 w-1 -rotate-12 bg-black" />
    </div>
  );
}

function WeatherOverlay({
  settings,
}: {
  settings: RoadSceneSettings;
}) {
  const visibilityOpacity =
    settings.visibility === "Poor"
      ? 0.42
      : settings.visibility === "Reduced"
        ? 0.2
        : 0;

  return (
    <>
      {settings.weather === "Rain" && (
        <div
          className="pointer-events-none absolute inset-0 z-40 opacity-35"
          style={{
            background:
              "repeating-linear-gradient(110deg, transparent 0 12px, rgba(219,234,254,.9) 12px 14px, transparent 14px 27px)",
          }}
        />
      )}

      {settings.weather === "Fog" && (
        <div className="pointer-events-none absolute inset-0 z-40 bg-white/35 backdrop-blur-[1px]" />
      )}

      {settings.weather === "Dust" && (
        <div className="pointer-events-none absolute inset-0 z-40 bg-amber-300/25" />
      )}

      {visibilityOpacity > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-40 bg-slate-200"
          style={{
            opacity: visibilityOpacity,
          }}
        />
      )}
    </>
  );
}

export default function RoadSceneEnvironment({
  settings,
}: RoadSceneEnvironmentProps) {
  const roadWidth = clamp(
    16 + settings.laneCount * 3.5,
    20,
    38,
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden transition-colors duration-300"
      style={{
        backgroundColor:
          getGroundColour(settings),
      }}
    >
      <div
        className="absolute inset-0 origin-center transition-transform duration-300"
        style={{
          transform: `rotate(${settings.roadRotation}deg) scale(1.08)`,
        }}
      >
        {settings.roadLayout ===
          "Four-way Intersection" && (
          <>
            <HorizontalRoad
              width={roadWidth}
              settings={settings}
            />
            <VerticalRoad
              width={roadWidth}
              settings={settings}
            />
          </>
        )}

        {settings.roadLayout ===
          "T-Junction" && (
          <>
            <HorizontalRoad
              width={roadWidth}
              settings={settings}
            />
            <VerticalRoad
              width={roadWidth}
              settings={settings}
              top={50}
              length={50}
            />
          </>
        )}

        {settings.roadLayout ===
          "Straight Road" && (
          <HorizontalRoad
            width={roadWidth}
            settings={settings}
          />
        )}

        {settings.roadLayout ===
          "Pedestrian Crossing" && (
          <>
            <HorizontalRoad
              width={roadWidth}
              settings={settings}
            />
            <ZebraCrossing orientation="vertical" />
          </>
        )}

        {settings.roadLayout ===
          "Roundabout" && (
          <Roundabout
            width={roadWidth}
            settings={settings}
          />
        )}

        {settings.roadLayout ===
          "Transport Terminus" && (
          <TransportTerminus
            width={roadWidth}
            settings={settings}
          />
        )}

        {settings.showPedestrianCrossing &&
          settings.roadLayout !==
            "Pedestrian Crossing" && (
            <ZebraCrossing orientation="vertical" />
          )}

        <TrafficControls
          settings={settings}
        />

        {settings.roadSurface ===
          "Damaged" && (
          <RoadDamageOverlay />
        )}
      </div>

      {settings.roadSurface === "Wet" && (
        <div className="pointer-events-none absolute inset-0 z-[2] bg-blue-200/10 mix-blend-screen" />
      )}

      <div className="absolute right-4 top-4 z-10 flex h-14 w-14 flex-col items-center justify-center rounded-full border-4 border-red-600 bg-white text-center shadow-lg">
        <span className="text-lg font-black leading-none text-gray-900">
          {settings.speedLimitKmh}
        </span>
        <span className="text-[7px] font-bold uppercase text-gray-500">
          km/h
        </span>
      </div>

      <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-black/55 px-3 py-2 text-[10px] font-semibold text-white backdrop-blur-sm">
        {settings.roadLayout} • {settings.laneCount} lane{settings.laneCount === 1 ? "" : "s"} • {settings.drivingSide}-hand traffic
      </div>

      <WeatherOverlay
        settings={settings}
      />
    </div>
  );
}
