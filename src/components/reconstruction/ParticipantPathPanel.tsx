import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  Activity,
  Compass,
  Copy,
  Crosshair,
  Gauge,
  MapPin,
  Move,
  Navigation,
  Route,
  Satellite,
  Trash2,
} from "lucide-react";

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

import {
  canDeleteRoutePoint,
  canEditRoutePointIdentity,
  canEditRoutePointPosition,
  canPlaceRoutePointWithGps,
  getEditablePointActions,
  getRouteDiamondText,
  getRoutePointStatus,
  getRoutePointSubtitle,
  isPointZLocked,
} from "../../utils/pointZRouteUi";

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

const PENDING_DUPLICATE_STORAGE_KEY =
  "roadsafe-pending-participant-duplicate";

interface PendingParticipantDuplicate {
  sourceParticipantId: string;
  createdAt: number;
  updates: Partial<ReconstructionVehicle>;
}

function getActionClasses(
  action: MovementAction,
): string {
  switch (action) {
    case "Start":
    case "Enter Scene":
      return "is-start";

    case "Brake":
      return "is-brake";

    case "Impact":
      return "is-impact";

    case "Swerve":
    case "Turn Left":
    case "Turn Right":
    case "Deflect":
      return "is-turn";

    case "Ricochet":
      return "is-ricochet";

    case "Slide":
    case "Fall":
      return "is-slide";

    case "Stop":
    case "Exit Scene":
      return "is-stop";

    default:
      return "is-cruise";
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

function getParticipantSpeedLimit(
  participant: ReconstructionVehicle,
): number {
  switch (participant.type) {
    case "Pedestrian":
    case "Officer":
    case "Witness":
      return 20;

    case "Bicycle":
      return 80;

    case "Motorcycle":
      return 220;

    default:
      return 260;
  }
}

function formatSpeedValue(
  value: number,
): string {
  return Number(value.toFixed(1)).toString();
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
    "Every participant begins at Point 1 and reaches the permanent Point Z collision anchor. Added diamonds subdivide only the route between those two anchors.",
  );

  const gpsSetupTimerRef =
    useRef<number | null>(null);

  const diamondRefreshTimerRef =
    useRef<number | null>(null);

  const panelRootRef =
    useRef<HTMLDivElement | null>(null);

  const originalDeleteButtonRef =
    useRef<HTMLButtonElement | null>(null);

  const [headerActionsHost, setHeaderActionsHost] =
    useState<HTMLDivElement | null>(null);

  const pointCardRefs = useRef(
    new Map<string, HTMLDivElement>(),
  );

  const [speedDraft, setSpeedDraft] =
    useState(() =>
      formatSpeedValue(
        participant.estimatedSpeedKmh,
      ),
    );

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

  const speedLimit =
    getParticipantSpeedLimit(
      participant,
    );

  const previousDisplayedPointCountRef =
    useRef(displayedPoints.length);

  const scrollPointIntoInspector =
    useCallback(
      (
        pointId: string,
        behavior: ScrollBehavior =
          "smooth",
      ) => {
        window.requestAnimationFrame(
          () => {
            const card =
              pointCardRefs.current.get(
                pointId,
              );

            const inspector =
              panelRootRef.current?.closest<HTMLElement>(
                ".reconstruction-workspace__properties--2d",
              );

            if (!card || !inspector) {
              return;
            }

            const cardRect =
              card.getBoundingClientRect();

            const inspectorRect =
              inspector.getBoundingClientRect();

            const safeTop =
              inspectorRect.top + 18;

            const safeBottom =
              inspectorRect.bottom - 72;

            if (cardRect.top < safeTop) {
              inspector.scrollTo({
                top:
                  inspector.scrollTop +
                  cardRect.top -
                  safeTop,
                behavior,
              });
            } else if (
              cardRect.bottom > safeBottom
            ) {
              inspector.scrollTo({
                top:
                  inspector.scrollTop +
                  cardRect.bottom -
                  safeBottom,
                behavior,
              });
            }
          },
        );
      },
      [],
    );

  useEffect(() => {
    setSpeedDraft(
      formatSpeedValue(
        participant.estimatedSpeedKmh,
      ),
    );
  }, [
    participant.estimatedSpeedKmh,
    participant.id,
  ]);

  useEffect(() => {
    const details =
      panelRootRef.current?.closest<HTMLDetailsElement>(
        "details.reconstruction-workspace__route-details",
      );

    if (!details) {
      return;
    }

    const keepExpanded = () => {
      if (!details.open) {
        details.open = true;
      }
    };

    keepExpanded();

    const observer =
      new MutationObserver(keepExpanded);

    observer.observe(details, {
      attributes: true,
      attributeFilter: ["open"],
    });

    return () => observer.disconnect();
  }, [participant.id]);

  useEffect(() => {
    const previousCount =
      previousDisplayedPointCountRef.current;

    previousDisplayedPointCountRef.current =
      displayedPoints.length;

    if (
      displayedPoints.length <=
      previousCount
    ) {
      return;
    }

    const lastEditablePoint =
      investigatorPoints[
        investigatorPoints.length - 1
      ];

    const target =
      lastEditablePoint ??
      displayedPoints[
        displayedPoints.length - 1
      ];

    if (target) {
      scrollPointIntoInspector(
        target.id,
      );
    }
  }, [
    displayedPoints,
    investigatorPoints,
    scrollPointIntoInspector,
  ]);

  useEffect(() => {
    if (!selectedPointId) {
      return;
    }

    scrollPointIntoInspector(
      selectedPointId,
      "auto",
    );
  }, [
    scrollPointIntoInspector,
    selectedPointId,
  ]);

  useEffect(() => {
    const inspector =
      panelRootRef.current?.closest<HTMLElement>(
        ".reconstruction-workspace__properties--2d",
      );

    const scrollContainer =
      inspector?.querySelector<HTMLElement>(
        ".reconstruction-workspace__context-scroll",
      );

    const originalDeleteButton =
      inspector?.querySelector<HTMLButtonElement>(
        ".reconstruction-workspace__delete-participant",
      ) ?? null;

    if (!scrollContainer || !originalDeleteButton) {
      return;
    }

    const previousDisplay =
      originalDeleteButton.style.display;

    originalDeleteButtonRef.current =
      originalDeleteButton;

    originalDeleteButton.style.display =
      "none";

    const host =
      document.createElement("div");

    host.className =
      "roadsafe-participant-header-actions";

    host.setAttribute(
      "data-roadsafe-participant-header-actions",
      "true",
    );

    scrollContainer.appendChild(host);
    setHeaderActionsHost(host);

    return () => {
      originalDeleteButton.style.display =
        previousDisplay;

      originalDeleteButtonRef.current =
        null;

      host.remove();
      setHeaderActionsHost(null);
    };
  }, [participant.id]);

  useEffect(() => {
    const raw = sessionStorage.getItem(
      PENDING_DUPLICATE_STORAGE_KEY,
    );

    if (!raw) {
      return;
    }

    try {
      const pending = JSON.parse(
        raw,
      ) as PendingParticipantDuplicate;

      const isFresh =
        Date.now() - pending.createdAt <
        10_000;

      const isNewParticipant =
        pending.sourceParticipantId !==
        participant.id;

      const matchesParticipantType =
        !pending.updates.type ||
        pending.updates.type ===
          participant.type;

      if (!isFresh) {
        sessionStorage.removeItem(
          PENDING_DUPLICATE_STORAGE_KEY,
        );
        return;
      }

      if (
        !isNewParticipant ||
        !matchesParticipantType
      ) {
        return;
      }

      sessionStorage.removeItem(
        PENDING_DUPLICATE_STORAGE_KEY,
      );

      onParticipantChange(
        pending.updates,
      );

      const firstPointId =
        pending.updates.pathPoints?.[0]
          ?.id;

      if (firstPointId) {
        onSelectPoint(firstPointId);
      }

      setRouteMessage(
        `${pending.updates.name ?? "Participant copy"} was duplicated with an offset editable route.`,
      );
    } catch {
      sessionStorage.removeItem(
        PENDING_DUPLICATE_STORAGE_KEY,
      );
    }
  }, [
    onParticipantChange,
    onSelectPoint,
    participant.id,
  ]);

  const handleDeleteParticipantFromHeader =
    useCallback(() => {
      originalDeleteButtonRef.current
        ?.click();
    }, []);

  const handleDuplicateParticipant =
    useCallback(() => {
      const inspector =
        panelRootRef.current?.closest<HTMLElement>(
          ".reconstruction-workspace__properties--2d",
        );

      const participantAdd =
        inspector?.querySelector<HTMLElement>(
          ".reconstruction-workspace__participant-add",
        );

      const typeSelect =
        participantAdd?.querySelector<HTMLSelectElement>(
          "select",
        );

      const addButton =
        participantAdd?.querySelector<HTMLButtonElement>(
          "button",
        );

      if (!typeSelect || !addButton) {
        setRouteMessage(
          "The participant could not be duplicated because the participant controls were not available.",
        );
        return;
      }

      const duplicateStamp =
        Date.now();

      const editablePoints =
        getInvestigatorPathPoints(
          participant,
        );

      const duplicatedPoints =
        editablePoints.map(
          (point, index) => ({
            ...point,
            id: `path-copy-${duplicateStamp}-${index}-${Math.random().toString(36).slice(2, 7)}`,
            position: {
              x: clampNumber(
                point.position.x + 2,
                0,
                100,
              ),
              y: clampNumber(
                point.position.y + 2,
                0,
                100,
              ),
            },
          }),
        );

      const participantCopy =
        JSON.parse(
          JSON.stringify(participant),
        ) as Partial<ReconstructionVehicle>;

      delete participantCopy.id;

      participantCopy.name =
        `${participant.name} Copy`;

      participantCopy.pathPoints =
        duplicatedPoints;

      participantCopy.startPosition =
        duplicatedPoints[0]
          ?.position ??
        participant.startPosition;

      participantCopy.collisionPosition =
        duplicatedPoints.find(
          (point) =>
            point.action === "Impact",
        )?.position ??
        duplicatedPoints[
          Math.min(
            1,
            Math.max(
              0,
              duplicatedPoints.length - 1,
            ),
          )
        ]?.position ??
        participant.collisionPosition;

      participantCopy.finalPosition =
        duplicatedPoints[
          duplicatedPoints.length - 1
        ]?.position ??
        participant.finalPosition;

      const pending: PendingParticipantDuplicate = {
        sourceParticipantId:
          participant.id,
        createdAt: duplicateStamp,
        updates: participantCopy,
      };

      sessionStorage.setItem(
        PENDING_DUPLICATE_STORAGE_KEY,
        JSON.stringify(pending),
      );

      typeSelect.value =
        participant.type;

      typeSelect.dispatchEvent(
        new Event("change", {
          bubbles: true,
        }),
      );

      window.requestAnimationFrame(
        () => addButton.click(),
      );
    }, [participant]);

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
      ? "is-observed"
      : calculatedRestPoint
        ? "is-calculated"
        : "is-pending";

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
      const removable =
        investigatorPoints.filter((point) =>
          canDeleteRoutePoint(
            point,
            investigatorPoints,
          ),
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
        "Intermediate route diamonds were cleared. Point 1 and the locked Point Z collision anchor were preserved.",
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

  const applyParticipantSpeed =
    useCallback(
      (requestedSpeed: number) => {
        if (
          !Number.isFinite(
            requestedSpeed,
          )
        ) {
          setSpeedDraft(
            formatSpeedValue(
              participant.estimatedSpeedKmh,
            ),
          );
          return;
        }

        const nextSpeed =
          clampNumber(
            requestedSpeed,
            0.1,
            speedLimit,
          );

        const previousSpeed =
          Math.max(
            0.1,
            participant.estimatedSpeedKmh ||
              investigatorPoints.find(
                (point) =>
                  point.speedKmh > 0,
              )?.speedKmh ||
              nextSpeed,
          );

        const timingScale =
          previousSpeed / nextSpeed;

        const firstTime =
          investigatorPoints[0]
            ?.timeSeconds ?? 0;

        const updatedPathPoints =
          investigatorPoints.map(
            (point, index) => {
              const elapsed = Math.max(
                0,
                point.timeSeconds -
                  firstTime,
              );

              return {
                ...point,
                timeSeconds:
                  index === 0
                    ? firstTime
                    : Number(
                        (
                          firstTime +
                          elapsed *
                            timingScale
                        ).toFixed(2),
                      ),
                speedKmh:
                  point.action ===
                  "Stop"
                    ? 0
                    : nextSpeed,
              };
            },
          );

        invalidatePhysicsBeforeStructureChange();

        onParticipantChange({
          estimatedSpeedKmh:
            nextSpeed,
          pathPoints:
            updatedPathPoints,
        });

        setSpeedDraft(
          formatSpeedValue(
            nextSpeed,
          ),
        );

        const finalTime =
          updatedPathPoints[
            updatedPathPoints.length - 1
          ]?.timeSeconds ?? 0;

        setRouteMessage(
          finalTime > durationSeconds
            ? `${participant.name} now travels at ${formatSpeedValue(nextSpeed)} km/h. The route timing was recalculated to ${finalTime.toFixed(1)}s, so the current ${durationSeconds.toFixed(1)}s timeline will show only the physically reachable part of the route.`
            : `${participant.name} now travels at ${formatSpeedValue(nextSpeed)} km/h. Every authored movement point and its timing were recalculated for playback.`,
        );
      },
      [
        durationSeconds,
        investigatorPoints,
        invalidatePhysicsBeforeStructureChange,
        onParticipantChange,
        participant.estimatedSpeedKmh,
        participant.name,
        speedLimit,
      ],
    );

  const commitSpeedDraft =
    useCallback(() => {
      applyParticipantSpeed(
        Number(speedDraft),
      );
    }, [
      applyParticipantSpeed,
      speedDraft,
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
        onPointChange(point.id, updates);
      },
      [onPointChange],
    );

  return (
    <div
      ref={panelRootRef}
      className="roadsafe-route-inspector mt-0 border-0 pb-24 pt-0"
      data-roadsafe-route-builder="true"
    >
      {headerActionsHost &&
        createPortal(
          <>
            <button
              type="button"
              onClick={
                handleDuplicateParticipant
              }
              className="roadsafe-participant-header-actions__button"
              title="Create an editable copy of the selected participant and route"
            >
              <span className="roadsafe-participant-header-actions__icon">
                <Copy size={13} />
              </span>
              <span className="roadsafe-participant-header-actions__copy">
                <strong>Duplicate</strong>
                <small>Participant</small>
              </span>
            </button>

            <button
              type="button"
              onClick={
                handleDeleteParticipantFromHeader
              }
              className="roadsafe-participant-header-actions__button is-danger"
              title="Delete the selected participant"
            >
              <span className="roadsafe-participant-header-actions__icon">
                <Trash2 size={13} />
              </span>
              <span className="roadsafe-participant-header-actions__copy">
                <strong>Delete</strong>
                <small>Participant</small>
              </span>
            </button>
          </>,
          headerActionsHost,
        )}

      <style>{`
        button[${ROUTE_DIAMOND_ATTRIBUTE}="true"] {
          width: 16px !important;
          height: 16px !important;
          min-width: 16px !important;
          min-height: 16px !important;
          padding: 0 !important;
          border: 1px solid #8bb9fa !important;
          border-radius: 2px !important;
          color: transparent !important;
          font-size: 0 !important;
          transform: translate(-50%, -50%) rotate(45deg) !important;
          box-shadow: 0 0 0 2px rgba(4, 10, 23, .72), 0 5px 14px rgba(0, 0, 0, .38) !important;
          transition: transform 120ms ease, border-color 120ms ease, filter 120ms ease !important;
        }

        button[${ROUTE_DIAMOND_ATTRIBUTE}="true"]::after {
          content: attr(${ROUTE_NUMBER_ATTRIBUTE});
          display: grid;
          width: 100%;
          height: 100%;
          place-items: center;
          color: #f8fbff;
          font-size: 8px;
          font-weight: 900;
          line-height: 1;
          transform: rotate(-45deg);
          text-shadow: 0 1px 2px rgba(0, 0, 0, .85);
        }

        button[${ROUTE_DIAMOND_ATTRIBUTE}="true"]:hover,
        button[${ROUTE_DIAMOND_ATTRIBUTE}="true"]:focus-visible {
          border-color: #d7e8ff !important;
          transform: translate(-50%, -50%) rotate(45deg) scale(1.14) !important;
          filter: brightness(1.08);
          z-index: 70 !important;
        }

        .reconstruction-workspace__properties--2d >
        .reconstruction-workspace__context-scroll {
          display: flex !important;
          min-height: 100% !important;
          flex-direction: column !important;
        }

        .roadsafe-participant-header-actions {
          position: sticky;
          z-index: 35;
          bottom: 0;
          display: grid;
          width: 100%;
          grid-template-columns: repeat(2, minmax(0, 132px));
          justify-content: center;
          gap: .55rem;
          margin-top: auto;
          border-top: 1px solid #172744;
          background: linear-gradient(180deg, rgba(5, 11, 24, .18), #071020 34%);
          padding: .75rem .7rem .85rem;
        }

        .roadsafe-participant-header-actions__button {
          display: grid;
          min-width: 0;
          min-height: 42px;
          grid-template-columns: 28px minmax(0, 1fr);
          align-items: center;
          gap: .48rem;
          border: 1px solid #203758;
          border-radius: .48rem;
          background: #0a1528;
          padding: .43rem .55rem;
          color: #b2c1d6;
          text-align: left;
          transition: border-color 120ms ease, background 120ms ease, color 120ms ease, transform 120ms ease;
        }

        .roadsafe-participant-header-actions__button:hover {
          border-color: #35639b;
          background: #10213b;
          color: #f1f7ff;
          transform: translateY(-1px);
        }

        .roadsafe-participant-header-actions__icon {
          display: grid;
          width: 28px;
          height: 28px;
          place-items: center;
          border: 1px solid #28456c;
          border-radius: .38rem;
          background: #0e203b;
          color: #7fb1f5;
        }

        .roadsafe-participant-header-actions__copy {
          display: flex;
          min-width: 0;
          flex-direction: column;
          line-height: 1.08;
        }

        .roadsafe-participant-header-actions__copy strong {
          color: inherit;
          font-size: .58rem;
          font-weight: 850;
          letter-spacing: .01em;
        }

        .roadsafe-participant-header-actions__copy small {
          margin-top: .16rem;
          color: #667b98;
          font-size: .46rem;
          font-weight: 700;
        }

        .roadsafe-participant-header-actions__button.is-danger {
          border-color: #4b2c38;
          background: #1a1018;
          color: #d5a1ad;
        }

        .roadsafe-participant-header-actions__button.is-danger
        .roadsafe-participant-header-actions__icon {
          border-color: #5d3341;
          background: #25131c;
          color: #e49aaa;
        }

        .roadsafe-participant-header-actions__button.is-danger:hover {
          border-color: #784252;
          background: #28151f;
          color: #ffd0d9;
        }

        .reconstruction-workspace__2d-grid {
          align-items: start !important;
          min-height: 0 !important;
        }

        .reconstruction-workspace__2d-grid >
        .reconstruction-workspace__properties--2d {
          position: sticky !important;
          inset: auto !important;
          top: .75rem !important;
          align-self: start !important;
          width: 100% !important;
          height: calc(100vh - 7.25rem) !important;
          min-height: 0 !important;
          max-height: calc(100vh - 7.25rem) !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          overscroll-behavior: contain;
          scrollbar-gutter: stable;
          padding: .72rem .72rem 7rem !important;
        }

        .reconstruction-workspace__properties--2d
        .reconstruction-workspace__speed-control {
          display: none !important;
        }

        details.reconstruction-workspace__route-details {
          display: block !important;
          overflow: visible !important;
        }

        details.reconstruction-workspace__route-details > summary {
          display: none !important;
        }

        details.reconstruction-workspace__route-details >
        .roadsafe-route-inspector {
          display: block !important;
          margin: 0 !important;
          border: 0 !important;
          padding-top: 0 !important;
        }

        .roadsafe-route-inspector {
          color: #9eacc0;
          font-size: .56rem;
        }

        .roadsafe-route-inspector__section {
          margin-top: .72rem;
          border-top: 1px solid #152744;
          padding-top: .68rem;
        }

        .roadsafe-route-inspector__section:first-of-type {
          margin-top: 0;
          border-top: 0;
          padding-top: 0;
        }

        .roadsafe-route-inspector__heading {
          display: flex;
          align-items: center;
          gap: .4rem;
          margin: 0;
          color: #9bb2d1;
          font-size: .54rem;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }

        .roadsafe-route-inspector__description {
          margin-top: .35rem;
          color: #66758d;
          font-size: .5rem;
          line-height: 1.55;
        }

        .roadsafe-route-inspector__header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: .65rem;
        }

        .roadsafe-route-inspector__badge {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: .25rem;
          border: 1px solid #284a7b;
          border-radius: .26rem;
          background: #112241;
          padding: .24rem .4rem;
          color: #7fb1ff;
          font-size: .45rem;
          font-weight: 900;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .roadsafe-route-inspector__toolbar {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: .34rem;
          margin-top: .58rem;
        }

        .roadsafe-route-inspector__toolbar .ui-button,
        .roadsafe-route-inspector__toolbar .ui-button-primary {
          min-height: 31px;
          justify-content: flex-start;
          padding: .38rem .48rem;
          font-size: .49rem;
          font-weight: 800;
        }

        .roadsafe-route-inspector__toolbar-danger {
          border-color: #50303a !important;
          background: #1d1119 !important;
          color: #c88d9a !important;
        }

        .roadsafe-route-inspector__toolbar-danger:hover {
          border-color: #71404d !important;
          background: #291720 !important;
          color: #efb5c1 !important;
        }

        .roadsafe-route-inspector__message {
          display: flex;
          align-items: flex-start;
          gap: .4rem;
          margin-top: .5rem;
          border: 1px solid #142743;
          border-radius: .3rem;
          background: #061020;
          padding: .45rem .5rem;
          color: #7f90a8;
          font-size: .49rem;
          line-height: 1.5;
        }

        .roadsafe-route-inspector__chips {
          display: flex;
          flex-wrap: wrap;
          gap: .28rem;
          margin-top: .45rem;
        }

        .roadsafe-route-inspector__chip {
          border: 1px solid #1a2e4d;
          border-radius: .25rem;
          background: #071124;
          padding: .22rem .34rem;
          color: #71839d;
          font-size: .43rem;
          font-weight: 800;
        }

        .roadsafe-route-inspector__speed-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 78px;
          gap: .45rem;
          align-items: center;
          margin-top: .55rem;
        }

        .roadsafe-route-inspector__speed-grid input[type="range"] {
          width: 100%;
          accent-color: #4d8cf5;
        }

        .roadsafe-route-inspector__number-wrap {
          position: relative;
        }

        .roadsafe-route-inspector__number-wrap input {
          width: 100%;
          padding-right: 1.8rem !important;
          text-align: right;
          font-variant-numeric: tabular-nums;
          font-weight: 800;
        }

        .roadsafe-route-inspector__number-unit {
          position: absolute;
          right: .38rem;
          top: 50%;
          pointer-events: none;
          transform: translateY(-50%);
          color: #5f7088;
          font-size: .42rem;
          font-weight: 800;
        }

        .roadsafe-route-inspector__presets {
          display: flex;
          flex-wrap: wrap;
          gap: .28rem;
          margin-top: .42rem;
        }

        .roadsafe-route-inspector__presets button {
          min-height: 26px;
          border: 1px solid #1a2e4e;
          border-radius: .28rem;
          background: #071124;
          padding: .28rem .42rem;
          color: #7588a4;
          font-size: .45rem;
          font-weight: 800;
        }

        .roadsafe-route-inspector__presets button:hover {
          border-color: #315d96;
          background: #102d5c;
          color: #d7e8ff;
        }

        .roadsafe-route-inspector__metrics {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: .34rem;
          margin-top: .58rem;
        }

        .roadsafe-route-inspector__metric {
          min-width: 0;
          border: 1px solid #142743;
          border-radius: .32rem;
          background: #061020;
          padding: .46rem;
        }

        .roadsafe-route-inspector__metric span {
          display: block;
          color: #61728b;
          font-size: .43rem;
          text-transform: uppercase;
        }

        .roadsafe-route-inspector__metric strong {
          display: block;
          margin-top: .2rem;
          overflow: hidden;
          color: #d8e6f8;
          font-size: .58rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .roadsafe-route-inspector__metric small {
          display: block;
          margin-top: .18rem;
          color: #55657b;
          font-size: .4rem;
          line-height: 1.35;
        }

        .roadsafe-route-inspector__metric.is-observed strong { color: #9ed8ca; }
        .roadsafe-route-inspector__metric.is-calculated strong { color: #aebef8; }
        .roadsafe-route-inspector__metric.is-pending strong { color: #c6b17a; }

        .roadsafe-route-inspector__field-list {
          display: grid;
          gap: .42rem;
          margin-top: .55rem;
        }

        .roadsafe-route-inspector__field-list label > span,
        .roadsafe-route-inspector__point-fields label > span {
          display: block;
          margin-bottom: .24rem;
          color: #718097;
          font-size: .46rem;
          font-weight: 700;
        }

        .roadsafe-route-inspector :is(input:not([type="range"]), select, textarea) {
          width: 100%;
          border: 1px solid #1c3152 !important;
          border-radius: .28rem !important;
          background: #061020 !important;
          padding: .36rem .44rem !important;
          color: #dce7f7 !important;
          font-size: .52rem !important;
          box-shadow: none !important;
        }

        .roadsafe-route-inspector :is(input, select, textarea):focus {
          border-color: #3d6da9 !important;
          outline: none !important;
          box-shadow: 0 0 0 2px rgba(61, 109, 169, .15) !important;
        }

        .roadsafe-route-inspector__direction-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: .34rem;
          margin-top: .52rem;
        }

        .roadsafe-route-inspector__direction-grid button {
          min-height: 30px;
          border: 1px solid #1a2e4e;
          border-radius: .3rem;
          background: #071124;
          color: #7588a4;
          font-size: .47rem;
          font-weight: 800;
        }

        .roadsafe-route-inspector__direction-grid button:hover {
          border-color: #315d96;
          background: #102d5c;
          color: #d7e8ff;
        }

        .roadsafe-route-inspector__notice {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: .5rem;
          margin-top: .65rem;
          border: 1px solid #192d4d;
          border-radius: .32rem;
          background: #071124;
          padding: .48rem;
          color: #7e90a9;
          font-size: .48rem;
          line-height: 1.45;
        }

        .roadsafe-route-inspector__notice button {
          min-height: 27px;
          flex: 0 0 auto;
        }

        .roadsafe-route-point-card {
          margin-top: .45rem;
          scroll-margin-block: 4.5rem;
          border: 1px solid #142743 !important;
          border-radius: .34rem !important;
          background: #061020 !important;
          padding: .52rem !important;
          box-shadow: none !important;
        }

        .roadsafe-route-point-card.is-selected {
          border-color: #315d96 !important;
          background: #0a1830 !important;
        }

        .roadsafe-route-point-card.is-physics {
          border-color: #263151 !important;
          background: #090f20 !important;
        }

        .roadsafe-route-point-card__select {
          border: 0 !important;
          background: transparent !important;
          padding: 0 !important;
          color: inherit !important;
          text-align: left;
        }

        .roadsafe-route-point-card__diamond {
          display: grid;
          width: 20px;
          height: 20px;
          flex: 0 0 20px;
          place-items: center;
          border: 1px solid #5f8fcd;
          border-radius: 2px;
          background: #102a53;
          transform: rotate(45deg);
          color: #f5f9ff;
          font-size: .46rem;
          font-weight: 900;
        }

        .roadsafe-route-point-card__diamond > span {
          transform: rotate(-45deg);
        }

        .roadsafe-route-point-card__title {
          display: block;
          overflow: hidden;
          color: #dce7f7;
          font-size: .56rem;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .roadsafe-route-point-card__subtitle {
          display: block;
          margin-top: .14rem;
          color: #61728b;
          font-size: .42rem;
          font-weight: 800;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .roadsafe-route-action {
          display: inline-flex;
          align-items: center;
          border: 1px solid #1a2e4d;
          border-radius: .24rem;
          background: #071124;
          padding: .2rem .32rem;
          color: #8597b0;
          font-size: .42rem;
          font-weight: 800;
        }

        .roadsafe-route-action.is-impact { border-color: #57313b; color: #d8909f; }
        .roadsafe-route-action.is-brake { border-color: #51452b; color: #c7ae72; }
        .roadsafe-route-action.is-turn { border-color: #24516b; color: #7eb9d2; }
        .roadsafe-route-action.is-start { border-color: #245246; color: #87c9b7; }
        .roadsafe-route-action.is-ricochet,
        .roadsafe-route-action.is-slide { border-color: #40375d; color: #a9a2d8; }
        .roadsafe-route-action.is-stop { color: #8793a5; }

        .roadsafe-route-point-card__status {
          display: inline-flex;
          align-items: center;
          border: 1px solid #1a2e4d;
          border-radius: .24rem;
          background: #071124;
          padding: .2rem .32rem;
          color: #687b96;
          font-size: .4rem;
          font-weight: 800;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .roadsafe-route-point-card__actions {
          display: flex;
          align-items: center;
          gap: .28rem;
        }

        .roadsafe-route-point-card__actions button {
          min-height: 26px;
          border: 1px solid #1a2e4e;
          border-radius: .28rem;
          background: #071124;
          padding: .26rem .4rem;
          color: #7588a4;
          font-size: .43rem;
          font-weight: 800;
        }

        .roadsafe-route-point-card__actions button:hover {
          border-color: #315d96;
          background: #102d5c;
          color: #d7e8ff;
        }

        .roadsafe-route-point-card__actions button.is-delete {
          border-color: #50303a;
          color: #c88d9a;
        }

        .roadsafe-route-point-card__details {
          margin-top: .52rem;
          border-top: 1px solid #142743;
          padding-top: .52rem;
        }

        .roadsafe-route-inspector__gps-box {
          border: 1px solid #192d4d;
          border-radius: .32rem;
          background: #071124;
          padding: .48rem;
        }

        .roadsafe-route-inspector__gps-box strong {
          display: block;
          color: #b8c7dc;
          font-size: .5rem;
        }

        .roadsafe-route-inspector__gps-box p {
          margin-top: .2rem;
          color: #61728b;
          font-size: .44rem;
          line-height: 1.45;
        }

        .roadsafe-route-inspector__gps-box button {
          width: 100%;
          margin-top: .4rem;
        }

        .roadsafe-route-inspector__read-only-box {
          border: 1px solid #263151;
          border-radius: .32rem;
          background: #090f20;
          padding: .48rem;
        }

        .roadsafe-route-inspector__read-only-box strong {
          display: block;
          color: #b7c4df;
          font-size: .5rem;
        }

        .roadsafe-route-inspector__read-only-box p {
          margin-top: .2rem;
          color: #65748b;
          font-size: .44rem;
          line-height: 1.45;
        }

        .roadsafe-route-inspector__physics-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: .34rem;
          margin-top: .45rem;
        }

        .roadsafe-route-inspector__physics-grid > div {
          border: 1px solid #142743;
          border-radius: .3rem;
          background: #061020;
          padding: .42rem;
        }

        .roadsafe-route-inspector__physics-grid dt {
          color: #61728b;
          font-size: .42rem;
          text-transform: uppercase;
        }

        .roadsafe-route-inspector__physics-grid dd {
          margin-top: .18rem;
          color: #d8e6f8;
          font-size: .52rem;
          font-weight: 800;
        }

        .roadsafe-route-inspector__physics-note {
          margin-top: .45rem;
          border: 1px solid #142743;
          border-radius: .3rem;
          background: #061020;
          padding: .44rem;
          color: #66758d;
          font-size: .44rem;
          line-height: 1.45;
        }

        .roadsafe-route-inspector__edit-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: .34rem;
        }

        .roadsafe-route-inspector__edit-actions .ui-button {
          min-height: 30px;
          justify-content: flex-start;
          padding: .36rem .46rem;
          font-size: .47rem;
        }

        .roadsafe-route-inspector__point-fields {
          display: grid;
          gap: .42rem;
          margin-top: .48rem;
        }

        .roadsafe-route-inspector__point-grid-2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: .36rem;
        }

        .roadsafe-route-inspector__point-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: .36rem;
        }

        @media (max-width: 980px) {
          .reconstruction-workspace__2d-grid >
          .reconstruction-workspace__properties--2d {
            position: relative !important;
            top: auto !important;
            height: min(64vh, 760px) !important;
            max-height: min(64vh, 760px) !important;
          }
        }
      `}</style>

      <section className="roadsafe-route-inspector__section">
        <div className="roadsafe-route-inspector__header-row">
          <div>
            <h3 className="roadsafe-route-inspector__heading">
              <Route size={13} />
              Participant route builder
            </h3>
            <p className="roadsafe-route-inspector__description">
              Add, draw or GPS-record editable route points. The participant follows a continuous smoothed curve through the numbered diamonds.
            </p>
          </div>

          <span className="roadsafe-route-inspector__badge">
            <Activity size={10} />
            Smooth curve
          </span>
        </div>

        <div className="roadsafe-route-inspector__toolbar">
          <button
            type="button"
            onClick={handleAddRoutePoint}
            className="ui-button-primary"
          >
            <Crosshair size={12} />
            Add route point
          </button>

          <button
            type="button"
            onClick={activateMoveTool}
            className="ui-button"
          >
            <Move size={12} />
            Adjust diamonds
          </button>

          <button
            type="button"
            onClick={handleDrawCompleteRoute}
            className="ui-button"
          >
            <Route size={12} />
            Draw complete route
          </button>

          <button
            type="button"
            onClick={handleWalkRouteWithGps}
            className="ui-button"
          >
            <Satellite size={12} />
            Walk route with GPS
          </button>

          <button
            type="button"
            onClick={handleClearIntermediatePoints}
            className="ui-button roadsafe-route-inspector__toolbar-danger"
          >
            <Trash2 size={12} />
            Clear intermediate points
          </button>
        </div>

        <div className="roadsafe-route-inspector__message">
          <Navigation size={12} />
          <span>{routeMessage}</span>
        </div>

        <div className="roadsafe-route-inspector__chips">
          <span className="roadsafe-route-inspector__chip">
            {investigatorPoints.length} editable point{investigatorPoints.length === 1 ? "" : "s"}
          </span>
          <span className="roadsafe-route-inspector__chip">GPS route supported</span>
          <span className="roadsafe-route-inspector__chip">Physics after contact</span>
        </div>
      </section>

      <section className="roadsafe-route-inspector__section">
        <div className="roadsafe-route-inspector__header-row">
          <div>
            <h3 className="roadsafe-route-inspector__heading">
              <Gauge size={13} />
              Exact participant speed
            </h3>
            <p className="roadsafe-route-inspector__description">
              This updates the participant&apos;s authored route speed and recalculates route timing. Entering 1 km/h makes this participant move at 1 km/h during playback.
            </p>
          </div>

          <span className="roadsafe-route-inspector__badge">
            {formatSpeedValue(participant.estimatedSpeedKmh)} km/h
          </span>
        </div>

        <div className="roadsafe-route-inspector__speed-grid">
          <input
            type="range"
            min={0.1}
            max={speedLimit}
            step={0.1}
            value={participant.estimatedSpeedKmh}
            onChange={(event) =>
              applyParticipantSpeed(Number(event.target.value))
            }
            aria-label="Participant route speed"
          />

          <div className="roadsafe-route-inspector__number-wrap">
            <input
              type="number"
              min={0.1}
              max={speedLimit}
              step={0.1}
              value={speedDraft}
              onChange={(event) => setSpeedDraft(event.target.value)}
              onBlur={commitSpeedDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitSpeedDraft();
                  event.currentTarget.blur();
                }
              }}
              aria-label="Exact speed in kilometres per hour"
            />
            <span className="roadsafe-route-inspector__number-unit">km/h</span>
          </div>
        </div>

        <div className="roadsafe-route-inspector__presets">
          {[1, 5, 10, 20, 40, 60]
            .filter((speed) => speed <= speedLimit)
            .map((speed) => (
              <button
                key={speed}
                type="button"
                onClick={() => applyParticipantSpeed(speed)}
              >
                {speed} km/h
              </button>
            ))}
        </div>
      </section>

      <section className="roadsafe-route-inspector__section">
        <h3 className="roadsafe-route-inspector__heading">
          <Activity size={13} />
          Route status
        </h3>

        <div className="roadsafe-route-inspector__metrics">
          <div className="roadsafe-route-inspector__metric">
            <span>Investigator input</span>
            <strong>{investigatorPoints.length} points</strong>
            <small>Editable route and evidence controls</small>
          </div>

          <div className="roadsafe-route-inspector__metric">
            <span>Physics output</span>
            <strong>{physicsPoints.length} samples</strong>
            <small>Solver-owned post-impact movement</small>
          </div>

          <div className={`roadsafe-route-inspector__metric ${restStatusClasses}`}>
            <span>Resting position</span>
            <strong>{restStatus}</strong>
            <small>
              {observedRestPoint
                ? "Confirmed from evidence"
                : calculatedRestPoint
                  ? "Calculated by physics"
                  : "Not assigned before simulation"}
            </small>
          </div>
        </div>
      </section>

      <section className="roadsafe-route-inspector__section">
        <h3 className="roadsafe-route-inspector__heading">
          <MapPin size={13} />
          Route context
        </h3>

        <div className="roadsafe-route-inspector__field-list">
          <label>
            <span>Came from</span>
            <input
              value={participant.originLocation}
              onChange={(event) =>
                onParticipantChange({ originLocation: event.target.value })
              }
              placeholder="e.g. Chipadze residential area"
            />
          </label>

          <label>
            <span>Heading to</span>
            <input
              value={participant.destinationLocation}
              onChange={(event) =>
                onParticipantChange({ destinationLocation: event.target.value })
              }
              placeholder="e.g. Bindura CBD"
            />
          </label>
        </div>
      </section>

      <section className="roadsafe-route-inspector__section">
        <h3 className="roadsafe-route-inspector__heading">
          <Compass size={13} />
          Quick direction
        </h3>
        <p className="roadsafe-route-inspector__description">
          Apply a starting approach direction, then fine-tune the numbered route points directly on the scene.
        </p>

        <div className="roadsafe-route-inspector__direction-grid">
          {HEADING_OPTIONS.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => onHeadingChange(option.label, option.degrees)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-4 space-y-3">
        {hiddenPhysicsSamples > 0 && (
          <div className="roadsafe-route-inspector__notice">
            <p>
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
              className="ui-button"
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
              className="ui-button w-full"
            >
              Hide detailed physics samples
            </button>
          )}

        {displayedPoints.map(
          (point) => {
            const selected =
              selectedPointId === point.id;

            const physicsGenerated =
              isPhysicsGeneratedPathPoint(
                point,
              );

            const observedRest =
              isObservedRestPoint(point);

            const actionOptions =
              getEditablePointActions(point);

            const investigatorOrder =
              investigatorPoints.findIndex(
                (item) =>
                  item.id === point.id,
              );

            const lockedPointZ =
              isPointZLocked(point);

            const deletable =
              canDeleteRoutePoint(
                point,
                investigatorPoints,
              );

            return (
              <div
                key={point.id}
                ref={(element) => {
                  if (element) {
                    pointCardRefs.current.set(
                      point.id,
                      element,
                    );
                  } else {
                    pointCardRefs.current.delete(
                      point.id,
                    );
                  }
                }}
                className={`roadsafe-route-point-card ${
                  selected ? "is-selected" : ""
                } ${physicsGenerated ? "is-physics" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectPoint(point.id)
                    }
                    className="roadsafe-route-point-card__select min-w-0 flex-1"
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="roadsafe-route-point-card__diamond"
                      >
                        <span className="-rotate-45">
                          {getRouteDiamondText({
                            point,
                            investigatorOrder,
                          })}
                        </span>
                      </span>

                      <span className="min-w-0">
                        <span className="roadsafe-route-point-card__title">
                          {point.label}
                        </span>

                        {!physicsGenerated && (
                          <span className="roadsafe-route-point-card__subtitle">
                            {getRoutePointSubtitle({
                              point,
                              investigatorOrder,
                            })}
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`roadsafe-route-action ${getActionClasses(point.action)}`}
                      >
                        {point.action}
                      </span>

                      <span
                        className="roadsafe-route-point-card__status"
                      >
                        {physicsGenerated
                          ? "Physics · read only"
                          : observedRest
                            ? "Observed evidence"
                            : getRoutePointStatus(point)}
                      </span>
                    </span>
                  </button>

                  <div className="roadsafe-route-point-card__actions">
                    <button
                      type="button"
                      onClick={() =>
                        onJumpToTime(
                          point.timeSeconds,
                        )
                      }
                      className=""
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
                        disabled={!deletable}
                        className="is-delete disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {selected &&
                  physicsGenerated && (
                    <div className="roadsafe-route-point-card__details">
                      <div className="roadsafe-route-inspector__read-only-box">
                        <strong>Physics-generated result</strong>

                        <p>
                          This solver result is read-only. Change route, speed, mass, surface or impact geometry and rerun the simulation instead of dragging this result.
                        </p>
                      </div>

                      <dl className="roadsafe-route-inspector__physics-grid">
                        <div>
                          <dt>
                            Time
                          </dt>
                          <dd>
                            {point.timeSeconds.toFixed(2)} s
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Speed
                          </dt>
                          <dd>
                            {point.speedKmh.toFixed(1)} km/h
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Rotation
                          </dt>
                          <dd>
                            {point.rotation.toFixed(1)}°
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Scene position
                          </dt>
                          <dd>
                            {point.position.x.toFixed(1)}, {point.position.y.toFixed(1)}
                          </dd>
                        </div>
                      </dl>

                      {point.notes && (
                        <p className="roadsafe-route-inspector__physics-note">
                          {point.notes}
                        </p>
                      )}
                    </div>
                  )}

                {selected &&
                  !physicsGenerated && (
                    <div className="roadsafe-route-point-card__details">
                      {lockedPointZ && (
                        <div className="roadsafe-route-inspector__read-only-box mb-2">
                          <strong>
                            Point Z is the permanent collision anchor
                          </strong>

                          <p>
                            Point Z is permanently linked to the primary collision marker. Move the scene collision marker to reposition it.
                          </p>
                        </div>
                      )}

                      <div className="roadsafe-route-inspector__edit-actions">
                        <button
                          type="button"
                          onClick={activateMoveTool}
                          disabled={lockedPointZ}
                          className="ui-button disabled:cursor-not-allowed disabled:opacity-40"
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
                          disabled={
                            !canPlaceRoutePointWithGps(
                              point,
                            )
                          }
                          className="ui-button disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Place this point with GPS
                        </button>
                      </div>

                      <div className="roadsafe-route-inspector__point-fields">
                      <label>
                        <span>
                          Point label
                        </span>

                        <input
                          value={point.label}
                          disabled={
                            !canEditRoutePointIdentity(
                              point,
                            )
                          }
                          onChange={(event) =>
                            handleInvestigatorPointChange(
                              point,
                              {
                                label:
                                  event.target.value,
                              },
                            )
                          }
                         
                        />
                      </label>

                      <label>
                        <span>
                          Action
                        </span>

                        <select
                          value={point.action}
                          disabled={lockedPointZ}
                          onChange={(event) =>
                            handleInvestigatorPointChange(
                              point,
                              {
                                action:
                                  event.target.value as MovementAction,
                              },
                            )
                          }
                         
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

                      <div className="roadsafe-route-inspector__point-grid-3">
                        <label>
                          <span>
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
                           
                          />
                        </label>

                        <label>
                          <span>
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
                           
                          />
                        </label>

                        <label>
                          <span>
                            Rotation°
                          </span>

                          <input
                            type="number"
                            disabled={
                              !canEditRoutePointPosition(
                                point,
                              )
                            }
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
                           
                          />
                        </label>
                      </div>

                      <div className="roadsafe-route-inspector__point-grid-2">
                        <label>
                          <span>
                            X position
                          </span>

                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            disabled={
                              !canEditRoutePointPosition(
                                point,
                              )
                            }
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
                           
                          />
                        </label>

                        <label>
                          <span>
                            Y position
                          </span>

                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            disabled={
                              !canEditRoutePointPosition(
                                point,
                              )
                            }
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
                           
                          />
                        </label>
                      </div>

                      <label>
                        <span>
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

                      <label>
                        <span>
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
                         
                        />
                      </label>
                      </div>
                    </div>
                  )}
              </div>
            );
          },
        )}
      </div>

      <div
        aria-hidden="true"
        className="h-16"
      />
    </div>
  );
}
