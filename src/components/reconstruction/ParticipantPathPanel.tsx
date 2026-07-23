import {
  useMemo,
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
  } = props;

  const [
    showPhysicsSamples,
    setShowPhysicsSamples,
  ] = useState(false);

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

  const invalidatePhysicsBeforeStructureChange =
    () => {
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
    };

  const handleAddInvestigatorPoint =
    () => {
      invalidatePhysicsBeforeStructureChange();
      onAddPoint();
    };

  const handleDeleteInvestigatorPoint =
    (point: MovementPathPoint) => {
      invalidatePhysicsBeforeStructureChange();
      onDeletePoint(point.id);
    };

  const handleInvestigatorPointChange =
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
    };

  return (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">
            Route & movement path
          </h3>

          <p className="mt-1 text-xs leading-5 text-gray-500">
            Enter only the approach,
            actions and impact evidence.
            Post-impact movement and the
            natural resting position are
            calculated by the physics
            solver.
          </p>
        </div>

        <button
          type="button"
          onClick={
            handleAddInvestigatorPoint
          }
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          Add approach point
        </button>
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
            Editable approach and
            evidence points
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
            Solver-owned impact and
            post-impact samples
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
            value={
              participant.originLocation
            }
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
            value={
              participant
                .destinationLocation
            }
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
            Route ownership rule
          </p>

          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            Destination text is report
            context only. The visible
            approach is controlled by the
            investigator&apos;s timed dots.
            After physical contact,
            generated dots are treated as
            solver output and shown as
            read-only in this inspector.
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {hiddenPhysicsSamples > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-sm border border-violet-200 bg-violet-50 p-3">
            <p className="text-xs leading-5 text-violet-900">
              <strong>
                {hiddenPhysicsSamples}{" "}
                detailed physics samples
                hidden.
              </strong>{" "}
              The important contact,
              deflection and rest results
              remain visible.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowPhysicsSamples(
                  true,
                )
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
                setShowPhysicsSamples(
                  false,
                )
              }
              className="w-full rounded-lg border border-violet-200 px-3 py-2 text-xs font-black text-violet-800"
            >
              Hide detailed physics
              samples
            </button>
          )}

        {displayedPoints.map(
          (point, index) => {
            const selected =
              selectedPointId ===
              point.id;

            const physicsGenerated =
              isPhysicsGeneratedPathPoint(
                point,
              );

            const observedRest =
              isObservedRestPoint(point);

            const actionOptions =
              getEditableActions(point);

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
                      onSelectPoint(
                        point.id,
                      )
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                          physicsGenerated
                            ? "bg-violet-700"
                            : "bg-gray-900"
                        }`}
                      >
                        {index + 1}
                      </span>

                      <span className="truncate text-sm font-bold text-gray-900">
                        {point.label}
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
                            : "Investigator input"}
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
                          investigatorPoints.length <=
                          2
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
                          Physics-generated
                          result
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-violet-800">
                          This solver result
                          is read-only in this
                          inspector and cannot
                          be GPS-placed or
                          manually edited here.
                          Change an input such
                          as speed, route, mass,
                          surface or impact
                          geometry, then rerun
                          the simulation.
                        </p>
                      </div>

                      <dl className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                          <dt className="text-gray-500">
                            Time
                          </dt>

                          <dd className="mt-1 font-black text-gray-900">
                            {point.timeSeconds.toFixed(
                              2,
                            )}{" "}
                            s
                          </dd>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                          <dt className="text-gray-500">
                            Speed
                          </dt>

                          <dd className="mt-1 font-black text-gray-900">
                            {point.speedKmh.toFixed(
                              1,
                            )}{" "}
                            km/h
                          </dd>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                          <dt className="text-gray-500">
                            Rotation
                          </dt>

                          <dd className="mt-1 font-black text-gray-900">
                            {point.rotation.toFixed(
                              1,
                            )}
                            °
                          </dd>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-2.5">
                          <dt className="text-gray-500">
                            Scene position
                          </dt>

                          <dd className="mt-1 font-black text-gray-900">
                            {point.position.x.toFixed(
                              1,
                            )}
                            ,{" "}
                            {point.position.y.toFixed(
                              1,
                            )}
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
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs font-black text-emerald-950">
                          Real-world position
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-emerald-800">
                          Use GPS only for a
                          position supported by
                          scene evidence. A
                          resting point entered
                          here is treated as an
                          observed location, not
                          a calculated result.
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            onPlacePointWithGps(
                              point.id,
                            )
                          }
                          className="mt-2 w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
                        >
                          Place This Point Using
                          GPS
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
                                  event.target
                                    .value,
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
                                  event.target
                                    .value as MovementAction,
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
                            max={
                              durationSeconds
                            }
                            step={0.1}
                            value={Number(
                              point.timeSeconds.toFixed(
                                1,
                              ),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  timeSeconds:
                                    clampNumber(
                                      Number(
                                        event
                                          .target
                                          .value,
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
                              point.speedKmh.toFixed(
                                1,
                              ),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  speedKmh:
                                    clampNumber(
                                      Number(
                                        event
                                          .target
                                          .value,
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
                              point.rotation.toFixed(
                                1,
                              ),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  rotation:
                                    Number(
                                      event
                                        .target
                                        .value,
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
                              point.position.x.toFixed(
                                1,
                              ),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  position: {
                                    ...point.position,
                                    x: clampNumber(
                                      Number(
                                        event
                                          .target
                                          .value,
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
                              point.position.y.toFixed(
                                1,
                              ),
                            )}
                            onChange={(event) =>
                              handleInvestigatorPointChange(
                                point,
                                {
                                  position: {
                                    ...point.position,
                                    y: clampNumber(
                                      Number(
                                        event
                                          .target
                                          .value,
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
                                  event.target
                                    .value ||
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
                                value={
                                  object.id
                                }
                              >
                                {
                                  object.label
                                }
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
                          value={
                            point.notes ?? ""
                          }
                          onChange={(event) =>
                            handleInvestigatorPointChange(
                              point,
                              {
                                notes:
                                  event.target
                                    .value,
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