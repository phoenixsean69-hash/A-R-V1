import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  MovementAction,
  MovementPathPoint,
  ReconstructionSceneObject,
  ReconstructionVehicle,
} from "../../types/reconstruction";

import {
  getInvestigatorPathPoints,
  getPhysicsPathPoints,
  isObservedRestPoint,
  isPhysicsCalculatedRestPoint,
  isPhysicsGeneratedPathPoint,
  sanitiseParticipantPathPoints,
  sortMovementPathPoints,
} from "../../utils/reconstructionGeometry";

interface ParticipantPathPanelProps {
  participant: ReconstructionVehicle;
  durationSeconds: number;
  sceneObjects: ReconstructionSceneObject[];
  selectedPointId: string | null;

  onSelectPoint: (
    pointId: string,
  ) => void;

  onParticipantChange: (
    updates: Partial<ReconstructionVehicle>,
  ) => void;

  onPointChange: (
    pointId: string,
    updates: Partial<MovementPathPoint>,
  ) => void;

  onAddPoint: () => void;

  onDeletePoint: (
    pointId: string,
  ) => void;

  onPlacePointWithGps: (
    pointId: string,
  ) => void;

  onJumpToTime: (
    timeSeconds: number,
  ) => void;

  onHeadingChange: (
    heading: string,
    degrees: number,
  ) => void;
}

const INVESTIGATOR_ACTIONS: MovementAction[] = [
  "Start",
  "Enter Scene",
  "Accelerate",
  "Cruise",
  "Brake",
  "Turn Left",
  "Turn Right",
  "Swerve",
  "Impact",
  "Stop",
  "Exit Scene",
];

const IMPORTANT_PHYSICS_ACTIONS =
  new Set<MovementAction>([
    "Impact",
    "Ricochet",
    "Deflect",
    "Fall",
    "Stop",
  ]);

const HEADING_OPTIONS = [
  { label: "North", degrees: 270 },
  { label: "North-east", degrees: 315 },
  { label: "East", degrees: 0 },
  { label: "South-east", degrees: 45 },
  { label: "South", degrees: 90 },
  { label: "South-west", degrees: 135 },
  { label: "West", degrees: 180 },
  { label: "North-west", degrees: 225 },
] as const;

const ROUTE_DIAMOND_ATTRIBUTE =
  "data-roadsafe-route-diamond";

const ROUTE_NUMBER_ATTRIBUTE =
  "data-roadsafe-route-number";

function getActionClasses(
  action: MovementAction,
): string {
  switch (action) {
    case "Start":
    case "Enter Scene":
      return "bg-green-100 text-green-700";

    case "Brake":
      return "bg-amber-100 text-amber-700";

    case "Impact":
      return "bg-red-100 text-red-700";

    case "Swerve":
    case "Turn Left":
    case "Turn Right":
    case "Deflect":
      return "bg-cyan-100 text-cyan-700";

    case "Ricochet":
      return "bg-orange-100 text-orange-700";

    case "Slide":
    case "Fall":
      return "bg-purple-100 text-purple-700";

    case "Stop":
    case "Exit Scene":
      return "bg-gray-200 text-gray-700";

    default:
      return "bg-blue-100 text-blue-700";
  }
}

function clampNumber(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(minimum, value),
  );
}

function getEditableActions(
  point: MovementPathPoint,
): MovementAction[] {
  return Array.from(
    new Set([
      point.action,
      ...INVESTIGATOR_ACTIONS,
    ]),
  );
}

function normaliseDomText(
  value: string | null | undefined,
): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isButtonInsideRouteBuilder(
  button: HTMLButtonElement,
): boolean {
  return Boolean(
    button.closest(
      '[data-roadsafe-route-builder="true"]',
    ),
  );
}

function clickFirstMatchingButton(
  matcher: RegExp,
): boolean {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      "button",
    ),
  );

  const target = buttons.find((button) => {
    if (
      button.disabled ||
      isButtonInsideRouteBuilder(button)
    ) {
      return false;
    }

    const searchable = normaliseDomText(
      [
        button.textContent,
        button.title,
        button.getAttribute("aria-label"),
      ].join(" "),
    );

    return matcher.test(searchable);
  });

  if (!target) {
    return false;
  }

  target.click();
  return true;
}

function selectOptionContaining(
  requiredParts: string[],
): boolean {
  const loweredParts = requiredParts
    .map(normaliseDomText)
    .filter(Boolean);

  const selects = Array.from(
    document.querySelectorAll<HTMLSelectElement>(
      "select",
    ),
  );

  for (const select of selects) {
    const option = Array.from(
      select.options,
    ).find((candidate) => {
      const candidateText = normaliseDomText(
        candidate.textContent,
      );

      return loweredParts.every((part) =>
        candidateText.includes(part),
      );
    });

    if (!option) {
      continue;
    }

    select.value = option.value;
    select.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );

    return true;
  }

  return false;
}

export default function ParticipantPathPanel(
  props: ParticipantPathPanelProps,
) {
  const {
    participant,
    durationSeconds,
    sceneObjects,
    selectedPointId,
    onSelectPoint,
    onParticipantChange,
    onPointChange,
    onAddPoint,
    onDeletePoint,
    onPlacePointWithGps,
    onJumpToTime,
    onHeadingChange,
  } = props;

  const [
    showPhysicsSamples,
    setShowPhysicsSamples,
  ] = useState(false);

  const [
    routeMessage,
    setRouteMessage,
  ] = useState(
    "Add numbered diamonds, drag them on the 2D scene, or record the route by walking it with GPS.",
  );

  const gpsSetupTimerRef =
    useRef<number | null>(null);

  const diamondRefreshTimerRef =
    useRef<number | null>(null);

  const allPoints = useMemo(
    () =>
      sanitiseParticipantPathPoints(
        participant.pathPoints,
      ),
    [participant.pathPoints],
  );

  const investigatorPoints =
    useMemo(
      () =>
        getInvestigatorPathPoints(
          participant,
        ),
      [participant],
    );

  const physicsPoints = useMemo(
    () =>
      getPhysicsPathPoints(
        participant,
      ),
    [participant],
  );

  const importantPhysicsPoints =
    useMemo(
      () =>
        physicsPoints.filter(
          (point) =>
            IMPORTANT_PHYSICS_ACTIONS.has(
              point.action,
            ) ||
            point.linkedSceneObjectId,
        ),
      [physicsPoints],
    );

  const visiblePhysicsPoints =
    showPhysicsSamples
      ? physicsPoints
      : importantPhysicsPoints;

  const displayedPoints = useMemo(
    () =>
      sortMovementPathPoints([
        ...investigatorPoints,
        ...visiblePhysicsPoints,
      ]),
    [
      investigatorPoints,
      visiblePhysicsPoints,
    ],
  );

  const hiddenPhysicsSamples =
    Math.max(
      0,
      physicsPoints.length -
        visiblePhysicsPoints.length,
    );

  const observedRestPoint =
    useMemo(
      () =>
        [...allPoints]
          .reverse()
          .find(
            isObservedRestPoint,
          ) ?? null,
      [allPoints],
    );

  const calculatedRestPoint =
    useMemo(
      () =>
        [...allPoints]
          .reverse()
          .find(
            isPhysicsCalculatedRestPoint,
          ) ?? null,
      [allPoints],
    );

  const restStatus =
    observedRestPoint
      ? "Observed rest"
      : calculatedRestPoint
        ? "Calculated rest"
        : "Awaiting physics";

  const restStatusClasses =
    observedRestPoint
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : calculatedRestPoint
        ? "border-violet-200 bg-violet-50 text-violet-800"
        : "border-amber-200 bg-amber-50 text-amber-800";

  const markSceneRoutePoints =
    useCallback(() => {
      const buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          'button[data-scene-interactive="true"]',
        ),
      );

      buttons.forEach((button) => {
        const numberText =
          normaliseDomText(
            button.textContent,
          );

        const hasScenePosition =
          Boolean(button.style.left) &&
          Boolean(button.style.top);

        if (
          !/^\d+$/.test(numberText) ||
          !hasScenePosition
        ) {
          return;
        }

        button.setAttribute(
          ROUTE_DIAMOND_ATTRIBUTE,
          "true",
        );

        button.setAttribute(
          ROUTE_NUMBER_ATTRIBUTE,
          numberText,
        );

        button.setAttribute(
          "aria-label",
          `Route control point ${numberText}. Drag to adjust the participant route.`,
        );
      });
    }, []);

  const scheduleDiamondRefresh =
    useCallback(() => {
      if (
        diamondRefreshTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          diamondRefreshTimerRef.current,
        );
      }

      diamondRefreshTimerRef.current =
        window.setTimeout(() => {
          markSceneRoutePoints();
          diamondRefreshTimerRef.current =
            null;
        }, 80);
    }, [markSceneRoutePoints]);

  useEffect(() => {
    markSceneRoutePoints();

    const observer =
      new MutationObserver(() => {
        scheduleDiamondRefresh();
      });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "style",
        "class",
      ],
    });

    return () => {
      observer.disconnect();

      if (
        diamondRefreshTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          diamondRefreshTimerRef.current,
        );
      }
    };
  }, [
    markSceneRoutePoints,
    scheduleDiamondRefresh,
  ]);

  useEffect(() => {
    return () => {
      if (
        gpsSetupTimerRef.current !==
        null
      ) {
        window.clearInterval(
          gpsSetupTimerRef.current,
        );
      }
    };
  }, []);

  const activateMoveTool =
    useCallback((): boolean => {
      const activated =
        clickFirstMatchingButton(
          /^(move|move tool|adjust points)$/i,
        );

      if (activated) {
        setRouteMessage(
          "Route adjustment is active. Drag any numbered diamond freely on the 2D scene.",
        );
      } else {
        setRouteMessage(
          "Select the Move tool in the scene toolbar, then drag the numbered diamonds.",
        );
      }

      scheduleDiamondRefresh();
      return activated;
    }, [scheduleDiamondRefresh]);

  const handleAddRoutePoint =
    useCallback(() => {
      activateMoveTool();
      onAddPoint();
      scheduleDiamondRefresh();

      setRouteMessage(
        "A new route diamond was added. Drag it into position, then adjust its time, speed and action below.",
      );
    }, [
      activateMoveTool,
      onAddPoint,
      scheduleDiamondRefresh,
    ]);

  const handleDrawCompleteRoute =
    useCallback(() => {
      const activated =
        clickFirstMatchingButton(
          /(draw.*route|trace.*route|route.*draw|retrace.*path)/i,
        );

      if (activated) {
        setRouteMessage(
          "Route drawing is active. Hold and draw the route on the 2D scene, then release to create editable diamonds.",
        );
      } else {
        activateMoveTool();
        setRouteMessage(
          "The freehand route tool was not visible. Use Add route point, then drag each numbered diamond into place.",
        );
      }
    }, [activateMoveTool]);

  const handleClearIntermediatePoints =
    useCallback(() => {
      const preservedStart =
        investigatorPoints[0]?.id;

      const preservedImpact =
        investigatorPoints.find(
          (point) =>
            point.action === "Impact",
        )?.id;

      const removable =
        investigatorPoints.filter(
          (point) =>
            point.id !== preservedStart &&
            point.id !== preservedImpact,
        );

      if (removable.length === 0) {
        setRouteMessage(
          "There are no intermediate route diamonds to clear.",
        );
        return;
      }

      [...removable]
        .reverse()
        .forEach((point) => {
          onDeletePoint(point.id);
        });

      setRouteMessage(
        "Intermediate route diamonds were cleared. The start and impact controls were preserved.",
      );

      scheduleDiamondRefresh();
    }, [
      investigatorPoints,
      onDeletePoint,
      scheduleDiamondRefresh,
    ]);

  const handleWalkRouteWithGps =
    useCallback(() => {
      const anchorPoint =
        investigatorPoints[0];

      if (!anchorPoint) {
        setRouteMessage(
          "Add the participant start point before opening GPS route tracking.",
        );
        return;
      }

      onPlacePointWithGps(
        anchorPoint.id,
      );

      setRouteMessage(
        `Opening field capture for ${participant.name}. The system will switch to Walk Line and select this participant automatically.`,
      );

      if (
        gpsSetupTimerRef.current !==
        null
      ) {
        window.clearInterval(
          gpsSetupTimerRef.current,
        );
      }

      const startedAt = Date.now();

      gpsSetupTimerRef.current =
        window.setInterval(() => {
          clickFirstMatchingButton(
            /^capture$/i,
          );

          const lineModeSelected =
            clickFirstMatchingButton(
              /^(walk line|line)$/i,
            );

          const targetSelected =
            selectOptionContaining([
              participant.name,
            ]) ||
            selectOptionContaining([
              participant.type,
              "complete walked route",
            ]);

          if (
            lineModeSelected &&
            targetSelected
          ) {
            if (
              gpsSetupTimerRef.current !==
              null
            ) {
              window.clearInterval(
                gpsSetupTimerRef.current,
              );
              gpsSetupTimerRef.current =
                null;
            }

            setRouteMessage(
              `GPS walking mode is ready for ${participant.name}. Press Start tracking and physically walk the route.`,
            );
            return;
          }

          if (
            Date.now() - startedAt >
            5000
          ) {
            if (
              gpsSetupTimerRef.current !==
              null
            ) {
              window.clearInterval(
                gpsSetupTimerRef.current,
              );
              gpsSetupTimerRef.current =
                null;
            }

            setRouteMessage(
              "Field capture opened. Choose Walk Line and select the participant's complete walked route from the target list.",
            );
          }
        }, 180);
    }, [
      investigatorPoints,
      onPlacePointWithGps,
      participant.name,
      participant.type,
    ]);

  const invalidatePhysicsBeforeStructureChange =
    useCallback(() => {
      if (
        physicsPoints.length === 0 ||
        investigatorPoints.length === 0
      ) {
        return;
      }

      const anchor =
        investigatorPoints[0];

      onPointChange(anchor.id, {
        position: {
          ...anchor.position,
        },
      });
    }, [
      investigatorPoints,
      onPointChange,
      physicsPoints.length,
    ]);

  const handleDeleteInvestigatorPoint =
    useCallback(
      (point: MovementPathPoint) => {
        invalidatePhysicsBeforeStructureChange();
        onDeletePoint(point.id);
        scheduleDiamondRefresh();
      },
      [
        invalidatePhysicsBeforeStructureChange,
        onDeletePoint,
        scheduleDiamondRefresh,
      ],
    );

  const handleInvestigatorPointChange =
    useCallback(
      (
        point: MovementPathPoint,
        updates: Partial<MovementPathPoint>,
      ) => {
        onPointChange(point.id, {
          ...updates,
          position:
            updates.position ?? {
              ...point.position,
            },
        });
      },
      [onPointChange],
    );

  return (
    <div
      className="mt-5 border-t border-gray-200 pt-5"
      data-roadsafe-route-builder="true"
    >
      <style>{`
        button[${ROUTE_DIAMOND_ATTRIBUTE}="true"] {
          width: 18px !important;
          height: 18px !important;
          min-width: 18px !important;
          min-height: 18px !important;
          padding: 0 !important;
          border-radius: 3px !important;
          color: transparent !important;
          font-size: 0 !important;
          transform: translate(-50%, -50%) rotate(45deg) !important;
          transition: transform 120ms ease, filter 120ms ease !important;
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.4) !important;
        }

        button[${ROUTE_DIAMOND_ATTRIBUTE}="true"]::after {
          content: attr(${ROUTE_NUMBER_ATTRIBUTE});
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
          color: white;
          font-size: 9px;
          font-weight: 900;
          line-height: 1;
          transform: rotate(-45deg);
          text-shadow: 0 1px 2px rgba(15, 23, 42, 0.9);
        }

        button[${ROUTE_DIAMOND_ATTRIBUTE}="true"]:hover,
        button[${ROUTE_DIAMOND_ATTRIBUTE}="true"]:focus-visible {
          transform: translate(-50%, -50%) rotate(45deg) scale(1.18) !important;
          filter: brightness(1.12);
          z-index: 70 !important;
        }
      `}</style>

      <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700">
              Participant route builder
            </p>

            <h3 className="mt-1 text-base font-black text-slate-950">
              Numbered smooth-route controls
            </h3>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
              Diamonds are editable control points. The participant follows a continuously smoothed curve through them rather than travelling through sharp corners.
            </p>
          </div>

          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700">
            Smooth curve active
          </span>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <button
            type="button"
            onClick={handleAddRoutePoint}
            className="rounded-lg bg-sky-600 px-3 py-2.5 text-xs font-black text-white shadow-sm hover:bg-sky-700"
          >
            + Add route point
          </button>

          <button
            type="button"
            onClick={activateMoveTool}
            className="rounded-lg border border-sky-300 bg-white px-3 py-2.5 text-xs font-black text-sky-800 hover:bg-sky-50"
          >
            Adjust diamonds
          </button>

          <button
            type="button"
            onClick={handleDrawCompleteRoute}
            className="rounded-lg border border-cyan-300 bg-white px-3 py-2.5 text-xs font-black text-cyan-800 hover:bg-cyan-50"
          >
            Draw complete route
          </button>

          <button
            type="button"
            onClick={handleWalkRouteWithGps}
            className="rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-black text-white shadow-sm hover:bg-emerald-700"
          >
            Walk route with GPS
          </button>

          <button
            type="button"
            onClick={handleClearIntermediatePoints}
            className="rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-50"
          >
            Clear intermediate points
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-sky-100 bg-white/80 px-3 py-2.5 text-[11px] leading-5 text-slate-600">
          {routeMessage}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-600">
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
            {investigatorPoints.length} editable diamond{investigatorPoints.length === 1 ? "" : "s"}
          </span>

          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
            GPS route supported
          </span>

          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">
            Physics begins at contact
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-sm border border-blue-200 bg-blue-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">
            Investigator input
          </p>

          <p className="mt-1 text-lg font-black text-blue-950">
            {investigatorPoints.length}
          </p>

          <p className="mt-1 text-[10px] leading-4 text-blue-800">
            Editable route diamonds and evidence points
          </p>
        </div>

        <div className="rounded-sm border border-violet-200 bg-violet-50 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-700">
            Physics result
          </p>

          <p className="mt-1 text-lg font-black text-violet-950">
            {physicsPoints.length}
          </p>

          <p className="mt-1 text-[10px] leading-4 text-violet-800">
            Solver-owned impact and post-impact samples
          </p>
        </div>

        <div
          className={`rounded-sm border p-3 ${restStatusClasses}`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.12em]">
            Resting position
          </p>

          <p className="mt-1 text-sm font-black">
            {restStatus}
          </p>

          <p className="mt-1 text-[10px] leading-4">
            {observedRestPoint
              ? "Confirmed from investigator-entered evidence."
              : calculatedRestPoint
                ? "Generated after velocity falls below the stop threshold."
                : "No resting location is assigned before simulation."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Came from
          </span>

          <input
            value={participant.originLocation}
            onChange={(event) =>
              onParticipantChange({
                originLocation:
                  event.target.value,
              })
            }
            placeholder="e.g. Chipadze residential area"
            className="mt-1.5 w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Heading to
          </span>

          <input
            value={participant.destinationLocation}
            onChange={(event) =>
              onParticipantChange({
                destinationLocation:
                  event.target.value,
              })
            }
            placeholder="e.g. Bindura CBD"
            className="mt-1.5 w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
          />
        </label>

        <div className="rounded-sm border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-black text-slate-900">
            Quick direction
          </p>

          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            This rotates the authored approach direction. The route diamonds remain freely adjustable afterward.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {HEADING_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() =>
                  onHeadingChange(
                    option.label,
                    option.degrees,
                  )
                }
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[10px] font-black text-slate-700 hover:border-sky-300 hover:bg-sky-50"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {hiddenPhysicsSamples > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-sm border border-violet-200 bg-violet-50 p-3">
            <p className="text-xs leading-5 text-violet-900">
              <strong>
                {hiddenPhysicsSamples} detailed physics samples hidden.
              </strong>{" "}
              Important contact, deflection and rest results remain visible.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowPhysicsSamples(true)
              }
              className="shrink-0 rounded-lg bg-violet-700 px-3 py-2 text-[10px] font-black text-white"
            >
              Show all
            </button>
          </div>
        )}

        {showPhysicsSamples &&
          physicsPoints.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setShowPhysicsSamples(false)
              }
              className="w-full rounded-lg border border-violet-200 px-3 py-2 text-xs font-black text-violet-800"
            >
              Hide detailed physics samples
            </button>
          )}

        {displayedPoints.map(
          (point, index) => {
            const selected =
              selectedPointId === point.id;

            const physicsGenerated =
              isPhysicsGeneratedPathPoint(
                point,
              );

            const observedRest =
              isObservedRestPoint(point);

            const actionOptions =
              getEditableActions(point);

            const investigatorOrder =
              investigatorPoints.findIndex(
                (item) =>
                  item.id === point.id,
              );

            return (
              <div
                key={point.id}
                className={`rounded-sm border p-3 transition ${
                  physicsGenerated
                    ? selected
                      ? "border-violet-500 bg-violet-50"
                      : "border-violet-200 bg-violet-50/60"
                    : selected
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectPoint(point.id)
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`grid h-6 w-6 shrink-0 rotate-45 place-items-center rounded-[4px] text-[10px] font-black text-white shadow-sm ${
                          physicsGenerated
                            ? "bg-violet-700"
                            : "bg-sky-700"
                        }`}
                      >
                        <span className="-rotate-45">
                          {physicsGenerated
                            ? "P"
                            : investigatorOrder + 1}
                        </span>
                      </span>

                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-900">
                          {point.label}
                        </span>

                        {!physicsGenerated && (
                          <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.1em] text-sky-700">
                            Route diamond {investigatorOrder + 1}
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${getActionClasses(
                          point.action,
                        )}`}
                      >
                        {point.action}
                      </span>

                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] ${
                          physicsGenerated
                            ? "bg-violet-200 text-violet-800"
                            : observedRest
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {physicsGenerated
                          ? "Physics · read only"
                          : observedRest
                            ? "Observed evidence"
                            : "Editable route point"}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onJumpToTime(
                          point.timeSeconds,
                        )
                      }
                      className="rounded-lg border border-gray-300 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-100"
                    >
                      Jump
                    </button>

                    {!physicsGenerated && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteInvestigatorPoint(
                            point,
                          )
                        }
                        disabled={
                          investigatorPoints.length <= 2
                        }
                        className="rounded-lg border border-red-200 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {selected &&
                  physicsGenerated && (
                    <div className="mt-4 space-y-3 border-t border-violet-200 pt-3">
                      <div className="rounded-lg border border-violet-200 bg-white p-3">
                        <p className="text-xs font-black text-violet-950">
                          Physics-generated result
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-violet-800">
                          This solver result is read-only. Change route, speed, mass, surface or impact geometry and rerun the simulation instead of dragging this result.
                        </p>
                      </div>

                      <dl className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                          <dt className="text-gray-500">
                            Time
                          </dt>
                          <dd className="mt-1 font-black text-gray-900">
                            {point.timeSeconds.toFixed(2)} s
                          </dd>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                          <dt className="text-gray-500">
                            Speed
                          </dt>
                          <dd className="mt-1 font-black text-gray-900">
                            {point.speedKmh.toFixed(1)} km/h
                          </dd>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                          <dt className="text-gray-500">
                            Rotation
                          </dt>
                          <dd className="mt-1 font-black text-gray-900">
                            {point.rotation.toFixed(1)}°
                          </dd>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                          <dt className="text-gray-500">
                            Scene position
                          </dt>
                          <dd className="mt-1 font-black text-gray-900">
                            {point.position.x.toFixed(1)}, {point.position.y.toFixed(1)}
                          </dd>
                        </div>
                      </dl>

                      {point.notes && (
                        <p className="rounded-lg border border-gray-200 bg-white p-3 text-[11px] leading-5 text-gray-600">
                          {point.notes}
                        </p>
                      )}
                    </div>
                  )}

                {selected &&
                  !physicsGenerated && (
                    <div className="mt-4 space-y-3 border-t border-blue-200 pt-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={activateMoveTool}
                          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-800 hover:bg-sky-100"
                        >
                          Drag diamond on scene
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onPlacePointWithGps(
                              point.id,
                            )
                          }
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
                        >
                          Place this point with GPS
                        </button>
                      </div>

                      <label className="block">
                        <span className="text-xs font-medium text-gray-600">
                          Point label
                        </span>

                        <input
                          value={point.label}
                          onChange={(event) =>
                            handleInvestigatorPointChange(
                              point,
                              {
                                label:
                                  event.target.value,
                              },
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-gray-600">
                          Action
                        </span>

                        <select
                          value={point.action}
                          onChange={(event) =>
                            handleInvestigatorPointChange(
                              point,
                              {
                                action:
                                  event.target.value as MovementAction,
                              },
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                        >
                          {actionOptions.map(
                            (action) => (
                              <option
                                key={action}
                                value={action}
                              >
                                {action}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <div className="grid grid-cols-3 gap-2">
                        <label>
                          <span className="text-[11px] font-medium text-gray-600">
                            Time (s)
                          </span>

                          <input
                            type="number"
                            min={0}
                            max={durationSeconds}
                            step={0.1}
                            value={Number(
                              point.timeSeconds.toFixed(1),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  timeSeconds:
                                    clampNumber(
                                      Number(
                                        event.target.value,
                                      ),
                                      0,
                                      durationSeconds,
                                    ),
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                          />
                        </label>

                        <label>
                          <span className="text-[11px] font-medium text-gray-600">
                            Speed
                          </span>

                          <input
                            type="number"
                            min={0}
                            max={220}
                            step={1}
                            value={Number(
                              point.speedKmh.toFixed(1),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  speedKmh:
                                    clampNumber(
                                      Number(
                                        event.target.value,
                                      ),
                                      0,
                                      220,
                                    ),
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                          />
                        </label>

                        <label>
                          <span className="text-[11px] font-medium text-gray-600">
                            Rotation°
                          </span>

                          <input
                            type="number"
                            value={Number(
                              point.rotation.toFixed(1),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  rotation:
                                    Number(
                                      event.target.value,
                                    ),
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label>
                          <span className="text-[11px] font-medium text-gray-600">
                            X position
                          </span>

                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={Number(
                              point.position.x.toFixed(1),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  position: {
                                    ...point.position,
                                    x: clampNumber(
                                      Number(
                                        event.target.value,
                                      ),
                                      0,
                                      100,
                                    ),
                                  },
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                          />
                        </label>

                        <label>
                          <span className="text-[11px] font-medium text-gray-600">
                            Y position
                          </span>

                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            value={Number(
                              point.position.y.toFixed(1),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  position: {
                                    ...point.position,
                                    y: clampNumber(
                                      Number(
                                        event.target.value,
                                      ),
                                      0,
                                      100,
                                    ),
                                  },
                                },
                              )
                            }
                            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="text-xs font-medium text-gray-600">
                          Related scene object
                        </span>

                        <select
                          value={
                            point.linkedSceneObjectId ??
                            ""
                          }
                          onChange={(event) =>
                            handleInvestigatorPointChange(
                              point,
                              {
                                linkedSceneObjectId:
                                  event.target.value ||
                                  undefined,
                              },
                            )
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                        >
                          <option value="">
                            None
                          </option>

                          {sceneObjects.map(
                            (object) => (
                              <option
                                key={object.id}
                                value={object.id}
                              >
                                {object.label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-gray-600">
                          Point notes
                        </span>

                        <textarea
                          value={point.notes ?? ""}
                          onChange={(event) =>
                            handleInvestigatorPointChange(
                              point,
                              {
                                notes:
                                  event.target.value,
                              },
                            )
                          }
                          rows={2}
                          className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-2.5 py-2 text-sm"
                        />
                      </label>
                    </div>
                  )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
