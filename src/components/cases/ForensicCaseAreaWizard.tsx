import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import type {
  AccidentCaseFormValues,
} from "../../types/accidentCase";

import type {
  ForensicPipelineBuildResult,
  ForensicPipelineStage,
} from "../../types/forensicScenePipeline";

import type {
  RealSceneAreaSelection,
} from "../../types/realSceneGeometry";

import type {
  RoadDetectionCoordinate,
} from "../../types/roadLayoutDetection";

import {
  AccidentCaseService,
} from "../../services/accidentCaseService";

import {
  createContextArea,
  coordinateInsideBounds,
  dimensionsForBounds,
} from "../../services/forensicAreaService";

import {
  ForensicScenePipelineService,
} from "../../services/forensicScenePipelineService";

import {
  ForensicWizardCheckpointService,
} from "../../services/forensicWizardCheckpointService";

import type {
  ForensicWizardCheckpoint,
  ForensicWizardCompletedStep,
  ForensicWizardStep,
} from "../../services/forensicWizardCheckpointService";

import {
  createDefaultRoadSceneSettings,
} from "../../types/reconstruction";

import {
  ZIMBABWE_POLICE_STATIONS,
} from "../../data/stations";

import ForensicAreaMap from "./ForensicAreaMap";

import "./forensicCaseAreaWizard.css";

interface Props {
  initialValues:
    AccidentCaseFormValues;
}

const STEP_LABELS = [
  "Case",
  "Area",
  "Build",
  "Review",
] as const;

function initialStages():
  ForensicPipelineStage[] {
  const items:
    Array<
      [
        ForensicPipelineStage["id"],
        string,
      ]
    > =
    [
      [
        "freeze-area",
        "Freeze case boundary",
      ],
      [
        "archive-osm",
        "Acquire + archive raw map data",
      ],
      [
        "normalize-geometry",
        "Normalize simulation geometry",
      ],
      [
        "acquire-elevation",
        "Acquire terrain elevation",
      ],
      [
        "archive-elevation",
        "Archive terrain source",
      ],
      [
        "quality-assurance",
        "Geometry quality assurance",
      ],
      [
        "freeze-package",
        "Freeze forensic scene package",
      ],
    ];

  return items.map(
    (
      [
        id,
        label,
      ],
    ) => ({
      id,
      label,
      status:
        "waiting",
      progressPercent:
        0,
      message:
        "Waiting",
    }),
  );
}

function checkpointResumeStep(
  completedThrough:
    ForensicWizardCompletedStep,
  buildResult:
    ForensicPipelineBuildResult | null,
  requested:
    ForensicWizardStep,
): ForensicWizardStep {
  const maximum:
    ForensicWizardStep =
    completedThrough >= 3 &&
    buildResult
      ? 4
      : completedThrough >= 2
        ? 3
        : completedThrough >= 1
          ? 2
          : 1;

  return Math.min(
    requested,
    maximum,
  ) as ForensicWizardStep;
}

export default function ForensicCaseAreaWizard({
  initialValues,
}: Props) {
  const navigate =
    useNavigate();

  const checkpointKey =
    useMemo(
      () =>
        ForensicWizardCheckpointService.keyForCaseNumber(
          initialValues.caseNumber,
        ),
      [
        initialValues.caseNumber,
      ],
    );

  const [
    step,
    setStep,
  ] =
    useState<ForensicWizardStep>(
      1,
    );

  const [
    completedThrough,
    setCompletedThrough,
  ] =
    useState<ForensicWizardCompletedStep>(
      0,
    );

  const [
    values,
    setValues,
  ] =
    useState(
      initialValues,
    );

  const [
    anchor,
    setAnchor,
  ] =
    useState<RoadDetectionCoordinate | null>(
      null,
    );

  const [
    coreArea,
    setCoreArea,
  ] =
    useState<RealSceneAreaSelection | null>(
      null,
    );

  const [
    contextBufferMetres,
    setContextBufferMetres,
  ] =
    useState(
      80,
    );

  const [
    stages,
    setStages,
  ] =
    useState<
      ForensicPipelineStage[]
    >(
      initialStages(),
    );

  const stagesRef =
    useRef<
      ForensicPipelineStage[]
    >(
      stages,
    );

  const [
    buildResult,
    setBuildResult,
  ] =
    useState<ForensicPipelineBuildResult | null>(
      null,
    );

  const [
    building,
    setBuilding,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const [
    confirmed,
    setConfirmed,
  ] =
    useState(
      false,
    );

  const [
    checkpointReady,
    setCheckpointReady,
  ] =
    useState(
      false,
    );

  const [
    checkpointSavedAt,
    setCheckpointSavedAt,
  ] =
    useState(
      "",
    );

  const [
    checkpointMessage,
    setCheckpointMessage,
  ] =
    useState(
      "Restoring checkpoint…",
    );

  const contextArea =
    useMemo(
      () =>
        coreArea
          ? createContextArea(
              coreArea,
              contextBufferMetres,
            )
          : null,
      [
        coreArea,
        contextBufferMetres,
      ],
    );

  const coreDimensions =
    useMemo(
      () =>
        coreArea
          ? dimensionsForBounds(
              coreArea.bounds,
            )
          : null,
      [
        coreArea,
      ],
    );

  const anchorInside =
    Boolean(
      anchor &&
      coreArea &&
      coordinateInsideBounds(
        anchor,
        coreArea.bounds,
      ),
    );

  const selectedStation =
    ZIMBABWE_POLICE_STATIONS.find(
      (
        station,
      ) =>
        station.name ===
        values.policeStation,
    );

  useEffect(
    () => {
      stagesRef.current =
        stages;
    },
    [
      stages,
    ],
  );

  useEffect(
    () => {
      let cancelled =
        false;

      const restoreCheckpoint =
        async () => {
          try {
            const checkpoint =
              await ForensicWizardCheckpointService.load(
                checkpointKey,
              );

            if (
              cancelled
            ) {
              return;
            }

            if (
              !checkpoint
            ) {
              setCheckpointMessage(
                "Checkpoint ready",
              );

              setCheckpointReady(
                true,
              );

              return;
            }

            setValues(
              checkpoint.values,
            );

            setAnchor(
              checkpoint.anchor,
            );

            setCoreArea(
              checkpoint.coreArea,
            );

            setContextBufferMetres(
              checkpoint.contextBufferMetres,
            );

            setStages(
              checkpoint.stages.length >
                0
                ? checkpoint.stages
                : initialStages(),
            );

            stagesRef.current =
              checkpoint.stages.length >
              0
                ? checkpoint.stages
                : initialStages();

            setBuildResult(
              checkpoint.buildResult,
            );

            setConfirmed(
              checkpoint.confirmed,
            );

            setCompletedThrough(
              checkpoint.completedThrough,
            );

            setStep(
              checkpointResumeStep(
                checkpoint.completedThrough,
                checkpoint.buildResult,
                checkpoint.resumeStep,
              ),
            );

            setCheckpointSavedAt(
              checkpoint.savedAt,
            );

            setCheckpointMessage(
              checkpoint.completedThrough >
                0
                ? `${STEP_LABELS[
                    checkpoint.completedThrough -
                      1
                  ]} checkpoint restored`
                : "Draft restored",
            );

            if (
              checkpoint.lastError
            ) {
              setError(
                checkpoint.lastError,
              );
            }

            setCheckpointReady(
              true,
            );
          } catch (
            restoreError
          ) {
            if (
              cancelled
            ) {
              return;
            }

            setCheckpointReady(
              true,
            );

            setCheckpointMessage(
              "Checkpoint storage unavailable",
            );

            setError(
              restoreError instanceof
              Error
                ? restoreError.message
                : String(
                    restoreError,
                  ),
            );
          }
        };

      void restoreCheckpoint();

      return () => {
        cancelled =
          true;
      };
    },
    [
      checkpointKey,
    ],
  );

  const buildCheckpoint =
    (
      nextCompletedThrough:
        ForensicWizardCompletedStep,
      nextResumeStep:
        ForensicWizardStep,
      options?: {
        nextBuildResult?:
          ForensicPipelineBuildResult | null;
        nextStages?:
          ForensicPipelineStage[];
        nextConfirmed?:
          boolean;
        lastError?:
          string;
      },
    ): ForensicWizardCheckpoint => {
      const nextBuildResult =
        options?.nextBuildResult !==
        undefined
          ? options.nextBuildResult
          : buildResult;

      return {
        schemaVersion:
          "RoadSafe Forensic Wizard Checkpoint V1",
        key:
          checkpointKey,
        savedAt:
          new Date().toISOString(),
        completedThrough:
          nextCompletedThrough,
        resumeStep:
          nextResumeStep,
        values,
        anchor,
        coreArea,
        contextBufferMetres,
        stages:
          options?.nextStages ??
          stagesRef.current,
        buildResult:
          nextBuildResult,
        confirmed:
          options?.nextConfirmed ??
          confirmed,
        lastError:
          options?.lastError,
      };
    };

  const commitCheckpoint =
    async (
      nextCompletedThrough:
        ForensicWizardCompletedStep,
      nextResumeStep:
        ForensicWizardStep,
      options?: {
        nextBuildResult?:
          ForensicPipelineBuildResult | null;
        nextStages?:
          ForensicPipelineStage[];
        nextConfirmed?:
          boolean;
        lastError?:
          string;
      },
    ) => {
      const checkpoint =
        buildCheckpoint(
          nextCompletedThrough,
          nextResumeStep,
          options,
        );

      await ForensicWizardCheckpointService.save(
        checkpoint,
      );

      setCompletedThrough(
        nextCompletedThrough,
      );

      setCheckpointSavedAt(
        checkpoint.savedAt,
      );

      setCheckpointMessage(
        nextCompletedThrough >
          0
          ? `${STEP_LABELS[
              nextCompletedThrough -
                1
            ]} saved`
          : "Draft saved",
      );
    };

  /*
   * Debounced draft persistence.
   *
   * Step commits below are still explicit and awaited. This background save
   * simply prevents backward edits from restoring stale downstream data after
   * a browser crash/refresh.
   */
  useEffect(
    () => {
      if (
        !checkpointReady ||
        building
      ) {
        return;
      }

      const timeout =
        window.setTimeout(
          () => {
            const checkpoint =
              buildCheckpoint(
                completedThrough,
                step,
              );

            void ForensicWizardCheckpointService.save(
              checkpoint,
            )
              .then(
                () => {
                  setCheckpointSavedAt(
                    checkpoint.savedAt,
                  );

                  if (
                    completedThrough ===
                    0
                  ) {
                    setCheckpointMessage(
                      "Draft saved",
                    );
                  }
                },
              )
              .catch(
                () => {
                  setCheckpointMessage(
                    "Checkpoint save failed",
                  );
                },
              );
          },
          350,
        );

      return () =>
        window.clearTimeout(
          timeout,
        );
    },
    [
      anchor,
      buildResult,
      checkpointReady,
      completedThrough,
      confirmed,
      contextBufferMetres,
      coreArea,
      step,
      values,
    ],
  );

  const invalidateFromCase =
    () => {
      if (
        completedThrough >
        0
      ) {
        setCompletedThrough(
          0,
        );

        setBuildResult(
          null,
        );

        setConfirmed(
          false,
        );
      }
    };

  const invalidateFromArea =
    () => {
      if (
        completedThrough >
        1
      ) {
        setCompletedThrough(
          1,
        );
      }

      setBuildResult(
        null,
      );

      setConfirmed(
        false,
      );

      setStages(
        initialStages(),
      );

      stagesRef.current =
        initialStages();
    };

  const updateValue =
    <
      Key extends keyof
        AccidentCaseFormValues,
    >(
      key:
        Key,
      value:
        AccidentCaseFormValues[Key],
    ) => {
      invalidateFromCase();

      setValues(
        (
          current,
        ) => ({
          ...current,
          [key]:
            value,
        }),
      );
    };

  const completeCaseStep =
    async () => {
      setError(
        "",
      );

      try {
        await commitCheckpoint(
          Math.max(
            completedThrough,
            1,
          ) as
            ForensicWizardCompletedStep,
          2,
          {
            nextBuildResult:
              completedThrough >=
              3
                ? buildResult
                : null,
            lastError:
              undefined,
          },
        );

        setStep(
          2,
        );
      } catch (
        checkpointError
      ) {
        setError(
          `Case step could not be checkpointed: ${
            checkpointError instanceof
            Error
              ? checkpointError.message
              : String(
                  checkpointError,
                )
          }`,
        );
      }
    };

  const completeAreaStep =
    async () => {
      if (
        !anchor ||
        !coreArea ||
        !anchorInside
      ) {
        return;
      }

      setError(
        "",
      );

      try {
        await commitCheckpoint(
          Math.max(
            Math.min(
              completedThrough,
              2,
            ),
            2,
          ) as
            ForensicWizardCompletedStep,
          3,
          {
            nextBuildResult:
              null,
            nextConfirmed:
              false,
            nextStages:
              initialStages(),
            lastError:
              undefined,
          },
        );

        setBuildResult(
          null,
        );

        setConfirmed(
          false,
        );

        setStages(
          initialStages(),
        );

        stagesRef.current =
          initialStages();

        setStep(
          3,
        );
      } catch (
        checkpointError
      ) {
        setError(
          `Area step could not be checkpointed: ${
            checkpointError instanceof
            Error
              ? checkpointError.message
              : String(
                  checkpointError,
                )
          }`,
        );
      }
    };

  const buildPipeline =
    async () => {
      if (
        !anchor ||
        !coreArea
      ) {
        return;
      }

      setBuilding(
        true,
      );

      setError(
        "",
      );

      setBuildResult(
        null,
      );

      setConfirmed(
        false,
      );

      const resetStages =
        initialStages();

      setStages(
        resetStages,
      );

      stagesRef.current =
        resetStages;

      try {
        const result =
          await ForensicScenePipelineService.build(
            {
              coreArea,
              accidentAnchor:
                anchor,
              contextBufferMetres,
              onProgress:
                (
                  nextStages,
                ) => {
                  stagesRef.current =
                    nextStages;

                  setStages(
                    nextStages,
                  );
                },
            },
          );

        setBuildResult(
          result,
        );

        await commitCheckpoint(
          3,
          4,
          {
            nextBuildResult:
              result,
            nextStages:
              result.stages,
            nextConfirmed:
              false,
            lastError:
              undefined,
          },
        );

        setStep(
          4,
        );
      } catch (
        pipelineError
      ) {
        const message =
          pipelineError instanceof
          Error
            ? pipelineError.message
            : String(
                pipelineError,
              );

        setError(
          message,
        );

        setBuildResult(
          null,
        );

        setConfirmed(
          false,
        );

        setCompletedThrough(
          2,
        );

        setStep(
          3,
        );

        /*
         * Rebound to Build from the last durable Area checkpoint. Preserve
         * current stage diagnostics and the failure message for refresh/retry.
         */
        try {
          await commitCheckpoint(
            2,
            3,
            {
              nextBuildResult:
                null,
              nextStages:
                stagesRef.current,
              nextConfirmed:
                false,
              lastError:
                message,
            },
          );

          setCheckpointMessage(
            "Area saved · Build ready to retry",
          );
        } catch {
          setCheckpointMessage(
            "Build failed · checkpoint update failed",
          );
        }
      } finally {
        setBuilding(
          false,
        );
      }
    };

  const createCase =
    async () => {
      if (
        !anchor ||
        !buildResult ||
        !confirmed
      ) {
        return;
      }

      const forensicScene = {
        ...buildResult.scenePackage,
        reviewStatus:
          "investigator-confirmed" as const,
        investigatorConfirmedAt:
          new Date().toISOString(),
      };

      const settings =
        createDefaultRoadSceneSettings();

      settings.realSceneGeometry =
        buildResult.geometry;

      settings.forensicScene =
        forensicScene;

      settings.sceneWidthMetres =
        buildResult.geometry.sceneWidthMetres;

      settings.sceneHeightMetres =
        buildResult.geometry.sceneHeightMetres;

      settings.useRealTerrain =
        forensicScene.terrain.status ===
        "ready";

      settings.terrainAreaMetres =
        Math.max(
          settings.sceneWidthMetres,
          settings.sceneHeightMetres,
        );

      settings.terrainExaggeration =
        1;

      settings.conformRoadToTerrain =
        true;

      const primaryRoad =
        buildResult.geometry.roads[
          0
        ];

      if (
        primaryRoad
      ) {
        settings.laneCount =
          Math.max(
            1,
            primaryRoad.laneCount,
          );

        if (
          primaryRoad.maximumSpeedKmh
        ) {
          settings.speedLimitKmh =
            primaryRoad.maximumSpeedKmh;
        }

        if (
          primaryRoad.isRoundabout
        ) {
          settings.roadLayout =
            "Roundabout";
        } else if (
          buildResult.geometry.roads.length <=
          1
        ) {
          settings.roadLayout =
            "Straight Road";
        }
      }

      const saved =
        AccidentCaseService.createWithSceneEnvironment(
          {
            ...values,
            caseNumber:
              values.caseNumber.trim(),
            title:
              values.title.trim(),
            location:
              values.location.trim(),
            junctionId:
              values.junctionId.trim(),
            investigatingOfficer:
              values.investigatingOfficer.trim(),
            policeStation:
              values.policeStation.trim(),
            summary:
              values.summary.trim(),
          },
          anchor,
          settings,
        );

      try {
        await ForensicWizardCheckpointService.clear(
          checkpointKey,
        );
      } catch {
        /*
         * The case is already safely created. A stale draft key uses the old
         * case number and therefore cannot overwrite the next generated case.
         */
      }

      navigate(
        `/cases/${saved.id}`,
      );
    };

  const maxReachableStep:
    ForensicWizardStep =
    completedThrough >=
      3 &&
    buildResult
      ? 4
      : completedThrough >=
        2
        ? 3
        : completedThrough >=
          1
          ? 2
          : 1;

  return (
    <div className="roadsafe-forensic-wizard">
      <header className="roadsafe-forensic-wizard__header">
        <div>
          <span>
            RoadSafe Forensic Geospatial Pipeline
          </span>

          <h2>
            Create investigation scene
          </h2>

          <p>
            Freeze the forensic core and context, archive sources, normalize
            metric geometry, acquire macro terrain and run QA before
            reconstruction.
          </p>
        </div>

        <div className="roadsafe-forensic-wizard__checkpoint-meta">
          <div
            className={`roadsafe-forensic-wizard__checkpoint-status ${
              checkpointReady
                ? completedThrough >
                  0
                  ? "is-saved"
                  : ""
                : "is-loading"
            }`}
          >
            <span>
              {checkpointMessage}
            </span>

            {checkpointSavedAt && (
              <small>
                {new Date(
                  checkpointSavedAt,
                ).toLocaleTimeString(
                  [],
                  {
                    hour:
                      "2-digit",
                    minute:
                      "2-digit",
                  },
                )}
              </small>
            )}
          </div>

          <div className="roadsafe-forensic-wizard__step-counter">
            {step} / 4
          </div>
        </div>
      </header>

      <nav className="roadsafe-forensic-wizard__steps">
        {STEP_LABELS.map(
          (
            label,
            index,
          ) => {
            const number =
              (
                index +
                1
              ) as
                ForensicWizardStep;

            return (
              <button
                key={
                  label
                }
                type="button"
                className={
                  step ===
                  number
                    ? "is-active"
                    : number <=
                        completedThrough
                      ? "is-complete"
                      : ""
                }
                disabled={
                  !checkpointReady ||
                  number >
                    maxReachableStep
                }
                onClick={() =>
                  setStep(
                    number,
                  )
                }
              >
                <span>
                  {number}
                </span>

                {label}
              </button>
            );
          },
        )}
      </nav>

      {error && (
        <div className="roadsafe-forensic-alert">
          {error}
        </div>
      )}

      {step ===
        1 && (
        <section className="roadsafe-forensic-panel">
          <Heading
            eyebrow="Case identity"
            title="Establish the investigation record"
            text="Case metadata identifies the investigation. Geospatial evidence is frozen separately in the next stages."
          />

          <div className="roadsafe-forensic-form-grid">
            <Field label="Case number">
              <input
                value={
                  values.caseNumber
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "caseNumber",
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Case title">
              <input
                value={
                  values.title
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "title",
                    event.target.value,
                  )
                }
                placeholder="Two-vehicle collision at..."
              />
            </Field>

            <Field label="Accident date">
              <input
                type="date"
                value={
                  values.accidentDate
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "accidentDate",
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field label="Accident time">
              <input
                type="time"
                value={
                  values.accidentTime
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "accidentTime",
                    event.target.value,
                  )
                }
              />
            </Field>

            <Field
              label="Location description"
              wide
            >
              <input
                value={
                  values.location
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "location",
                    event.target.value,
                  )
                }
                placeholder="Road / junction / landmark"
              />
            </Field>

            <Field label="Police station">
              <select
                value={
                  values.policeStation
                }
                onChange={(
                  event,
                ) => {
                  updateValue(
                    "policeStation",
                    event.target.value,
                  );

                  updateValue(
                    "investigatingOfficer",
                    "",
                  );
                }}
              >
                <option value="">
                  Select station
                </option>

                {ZIMBABWE_POLICE_STATIONS.map(
                  (
                    station,
                  ) => (
                    <option
                      key={
                        station.id
                      }
                      value={
                        station.name
                      }
                    >
                      {
                        station.name
                      }
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Investigating officer">
              <select
                value={
                  values.investigatingOfficer
                }
                disabled={
                  !selectedStation
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "investigatingOfficer",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select officer
                </option>

                {selectedStation
                  ?.officers
                  .map(
                    (
                      officer,
                    ) => (
                      <option
                        key={
                          officer.id
                        }
                        value={`${officer.rank} ${officer.name}`}
                      >
                        {
                          officer.rank
                        }{" "}
                        {
                          officer.name
                        }
                      </option>
                    ),
                  )}
              </select>
            </Field>

            <Field
              label="Initial summary"
              wide
            >
              <textarea
                rows={
                  4
                }
                value={
                  values.summary
                }
                onChange={(
                  event,
                ) =>
                  updateValue(
                    "summary",
                    event.target.value,
                  )
                }
              />
            </Field>
          </div>

          <Actions>
            <button
              type="button"
              className="is-primary"
              disabled={
                !checkpointReady ||
                !values.caseNumber.trim() ||
                !values.title.trim() ||
                !values.accidentDate ||
                !values.accidentTime
              }
              onClick={() =>
                void completeCaseStep()
              }
            >
              Define forensic area
            </button>
          </Actions>
        </section>
      )}

      {step ===
        2 && (
        <section className="roadsafe-forensic-panel">
          <Heading
            eyebrow="Area selection"
            title="Freeze the forensic core"
            text="Place the exact accident anchor, then draw the high-detail forensic core. RoadSafe generates a surrounding context buffer automatically."
          />

          <div className="roadsafe-forensic-area-layout">
            <aside className="roadsafe-forensic-area-sidebar">
              <div className="roadsafe-forensic-card">
                <strong>
                  Accident anchor
                </strong>

                <label>
                  Latitude

                  <input
                    type="number"
                    step="0.000001"
                    value={
                      anchor
                        ?.latitude ??
                      ""
                    }
                    onChange={(
                      event,
                    ) => {
                      const latitude =
                        Number(
                          event.target.value,
                        );

                      if (
                        Number.isFinite(
                          latitude,
                        )
                      ) {
                        invalidateFromArea();

                        setAnchor({
                          latitude,
                          longitude:
                            anchor
                              ?.longitude ??
                            31.053,
                          accuracyMetres:
                            0,
                          capturedAt:
                            new Date().toISOString(),
                        });
                      }
                    }}
                  />
                </label>

                <label>
                  Longitude

                  <input
                    type="number"
                    step="0.000001"
                    value={
                      anchor
                        ?.longitude ??
                      ""
                    }
                    onChange={(
                      event,
                    ) => {
                      const longitude =
                        Number(
                          event.target.value,
                        );

                      if (
                        Number.isFinite(
                          longitude,
                        )
                      ) {
                        invalidateFromArea();

                        setAnchor({
                          latitude:
                            anchor
                              ?.latitude ??
                            -17.825,
                          longitude,
                          accuracyMetres:
                            0,
                          capturedAt:
                            new Date().toISOString(),
                        });
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    navigator.geolocation.getCurrentPosition(
                      (
                        position,
                      ) => {
                        invalidateFromArea();

                        setAnchor({
                          latitude:
                            position.coords.latitude,
                          longitude:
                            position.coords.longitude,
                          accuracyMetres:
                            position.coords.accuracy,
                          capturedAt:
                            new Date().toISOString(),
                        });
                      },
                      (
                        geoError,
                      ) =>
                        setError(
                          geoError.message,
                        ),
                      {
                        enableHighAccuracy:
                          true,
                        timeout:
                          12_000,
                      },
                    )
                  }
                >
                  Use current location
                </button>
              </div>

              <div className="roadsafe-forensic-card">
                <strong>
                  Context buffer
                </strong>

                <label>
                  Metres beyond core

                  <input
                    type="number"
                    min={
                      10
                    }
                    max={
                      350
                    }
                    value={
                      contextBufferMetres
                    }
                    onChange={(
                      event,
                    ) => {
                      invalidateFromArea();

                      setContextBufferMetres(
                        Math.max(
                          10,
                          Math.min(
                            350,
                            Number(
                              event.target.value,
                            ) ||
                              80,
                          ),
                        ),
                      );
                    }}
                  />
                </label>

                <p>
                  Core receives analysis detail. Context supplies surrounding
                  approaches and terrain/source context.
                </p>
              </div>

              <div className="roadsafe-forensic-card">
                <strong>
                  Selection status
                </strong>

                <dl>
                  <div>
                    <dt>
                      Core
                    </dt>

                    <dd>
                      {coreDimensions
                        ? `${coreDimensions.width.toFixed(
                            1,
                          )} × ${coreDimensions.height.toFixed(
                            1,
                          )} m`
                        : "Not selected"}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Anchor inside
                    </dt>

                    <dd
                      className={
                        anchorInside
                          ? "is-good"
                          : "is-warning"
                      }
                    >
                      {coreArea
                        ? anchorInside
                          ? "Yes"
                          : "No"
                        : "Waiting"}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Boundary mode
                    </dt>

                    <dd>
                      Rectangle · V1
                    </dd>
                  </div>
                </dl>
              </div>
            </aside>

            <ForensicAreaMap
              anchor={
                anchor
              }
              coreArea={
                coreArea
              }
              contextArea={
                contextArea
              }
              onAnchorChange={(
                coordinate,
              ) => {
                invalidateFromArea();

                setAnchor(
                  coordinate,
                );
              }}
              onCoreAreaChange={(
                area,
              ) => {
                invalidateFromArea();

                setCoreArea(
                  area,
                );
              }}
            />
          </div>

          <Actions>
            <button
              type="button"
              onClick={() =>
                setStep(
                  1,
                )
              }
            >
              Back
            </button>

            <button
              type="button"
              className="is-primary"
              disabled={
                !checkpointReady ||
                !anchor ||
                !coreArea ||
                !anchorInside
              }
              onClick={() =>
                void completeAreaStep()
              }
            >
              Freeze and build
            </button>
          </Actions>
        </section>
      )}

      {step ===
        3 && (
        <section className="roadsafe-forensic-panel">
          <Heading
            eyebrow="Source acquisition"
            title="Build the forensic scene package"
            text="This is not a screenshot export. RoadSafe archives source payloads, builds normalized metric geometry, acquires macro terrain and runs QA."
          />

          <div className="roadsafe-forensic-pipeline">
            {stages.map(
              (
                stage,
              ) => (
                <article
                  key={
                    stage.id
                  }
                  className={`is-${stage.status}`}
                >
                  <span className="roadsafe-forensic-pipeline__indicator" />

                  <div>
                    <strong>
                      {
                        stage.label
                      }
                    </strong>

                    <small>
                      {
                        stage.message
                      }
                    </small>

                    <div className="roadsafe-forensic-pipeline__bar">
                      <i
                        style={{
                          width:
                            `${stage.progressPercent}%`,
                        }}
                      />
                    </div>
                  </div>

                  <b>
                    {
                      stage.progressPercent
                    }
                    %
                  </b>
                </article>
              ),
            )}
          </div>

          <Actions>
            <button
              type="button"
              disabled={
                building
              }
              onClick={() =>
                setStep(
                  2,
                )
              }
            >
              Back to area
            </button>

            <button
              type="button"
              className="is-primary"
              disabled={
                building ||
                !checkpointReady ||
                !anchor ||
                !coreArea ||
                !anchorInside
              }
              onClick={() =>
                void buildPipeline()
              }
            >
              {building
                ? "Building forensic scene…"
                : "Run forensic pipeline"}
            </button>
          </Actions>
        </section>
      )}

      {step ===
        4 &&
        buildResult && (
        <section className="roadsafe-forensic-panel">
          <Heading
            eyebrow="Investigator review"
            title="Review the frozen scene package"
            text="Automatic extraction carries uncertainty. Review source provenance, terrain state and QA before handing the scene to reconstruction."
          />

          <div className="roadsafe-forensic-review-metrics">
            <Metric
              label="QA score"
              value={`${buildResult.scenePackage.qa.overallScorePercent}%`}
              note={
                buildResult.scenePackage.qa.decision
              }
            />

            <Metric
              label="Roads"
              value={String(
                buildResult.geometry.roads.length,
              )}
              note="normalized"
            />

            <Metric
              label="Buildings"
              value={String(
                buildResult.geometry.buildings.length,
              )}
              note="footprints"
            />

            <Metric
              label="Terrain relief"
              value={`${buildResult.scenePackage.terrain.reliefMetres} m`}
              note={
                buildResult.scenePackage.terrain.status
              }
            />
          </div>

          <div className="roadsafe-forensic-review-grid">
            <section>
              <header>
                <strong>
                  Source manifest
                </strong>

                <span>
                  {
                    buildResult.scenePackage.sources.length
                  }{" "}
                  records
                </span>
              </header>

              <div className="roadsafe-forensic-source-list">
                {buildResult.scenePackage.sources.map(
                  (
                    source,
                  ) => (
                    <article
                      key={
                        source.id
                      }
                    >
                      <div>
                        <strong>
                          {
                            source.layer
                          }
                        </strong>

                        <small>
                          {
                            source.provider
                          }
                        </small>
                      </div>

                      <span>
                        {
                          source.classification
                        }
                      </span>

                      <b>
                        {
                          Math.round(
                            source.confidence *
                              100,
                          )
                        }
                        %
                      </b>
                    </article>
                  ),
                )}
              </div>
            </section>

            <section>
              <header>
                <strong>
                  Geometry QA
                </strong>

                <span>
                  review required
                </span>
              </header>

              <div className="roadsafe-forensic-qa-list">
                {buildResult.scenePackage.qa.checks.map(
                  (
                    check,
                  ) => (
                    <article
                      key={
                        check.id
                      }
                      className={`is-${check.severity}`}
                    >
                      <i />

                      <div>
                        <strong>
                          {
                            check.label
                          }
                        </strong>

                        <small>
                          {
                            check.detail
                          }
                        </small>
                      </div>

                      <span>
                        {
                          check.value
                        }
                      </span>
                    </article>
                  ),
                )}
              </div>
            </section>
          </div>

          <section className="roadsafe-forensic-package-id">
            <span>
              Package
            </span>

            <code>
              {
                buildResult.scenePackage.id
              }
            </code>

            <span>
              SHA-256
            </span>

            <code>
              {
                buildResult.scenePackage.snapshotSha256
              }
            </code>
          </section>

          <label className="roadsafe-forensic-confirm">
            <input
              type="checkbox"
              checked={
                confirmed
              }
              onChange={(
                event,
              ) =>
                setConfirmed(
                  event.target.checked,
                )
              }
            />

            <span>
              I reviewed the extracted geometry, source confidence and QA
              warnings. I understand that forensic microgeometry still
              requires field verification/correction.
            </span>
          </label>

          <Actions>
            <button
              type="button"
              onClick={() =>
                setStep(
                  2,
                )
              }
            >
              Change area
            </button>

            <button
              type="button"
              onClick={() =>
                setStep(
                  3,
                )
              }
            >
              Rebuild
            </button>

            <button
              type="button"
              className="is-primary"
              disabled={
                !confirmed ||
                buildResult.scenePackage.qa.decision ===
                  "INSUFFICIENT — DO NOT USE"
              }
              onClick={() =>
                void createCase()
              }
            >
              Create case from frozen scene
            </button>
          </Actions>
        </section>
      )}
    </div>
  );
}

function Heading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="roadsafe-forensic-panel__heading">
      <span>
        {eyebrow}
      </span>

      <h3>
        {title}
      </h3>

      <p>
        {text}
      </p>
    </div>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children:
    ReactNode;
}) {
  return (
    <label
      className={
        wide
          ? "is-wide"
          : ""
      }
    >
      <span>
        {label}
      </span>

      {children}
    </label>
  );
}

function Actions({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <div className="roadsafe-forensic-actions">
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {note}
      </small>
    </article>
  );
}
