import {
  useMemo,
  useState,
  type MouseEvent,
} from "react";

import type {
  EvidenceRecord,
  ReconstructionSceneObject,
  ReconstructionVehicle,
  ScenePhotoAttachment,
  ScenePhotoConstraint,
  ScenePhotoConstraintConfidence,
  ScenePhotoConstraintKind,
} from "../../types/reconstruction";

import {
  createScenePhotoConstraint,
} from "../../services/photoConstraintService";

const CONSTRAINT_KINDS: ScenePhotoConstraintKind[] = [
  "Primary Impact Point",
  "Participant Path Point",
  "Participant Heading",
  "Scene Object Position",
  "Evidence Position",
];

const CONFIDENCE_LEVELS: ScenePhotoConstraintConfidence[] = [
  "High",
  "Medium",
  "Low",
];

interface PhotoConstraintWorkspaceProps {
  photo: ScenePhotoAttachment;
  constraints: ScenePhotoConstraint[];
  participants: ReconstructionVehicle[];
  sceneObjects: ReconstructionSceneObject[];
  evidenceRecords: EvidenceRecord[];
  sceneWidthMetres: number;
  sceneHeightMetres: number;
  onAddConstraint(constraint: ScenePhotoConstraint): void;
  onConstraintChange(
    constraintId: string,
    updates: Partial<ScenePhotoConstraint>,
  ): void;
  onApplyConstraint(constraintId: string): void;
  onDeleteConstraint(constraintId: string): void;
}

function targetSummary(
  constraint: ScenePhotoConstraint,
  participants: ReconstructionVehicle[],
  sceneObjects: ReconstructionSceneObject[],
  evidenceRecords: EvidenceRecord[],
): string {
  if (
    constraint.kind === "Participant Path Point" ||
    constraint.kind === "Participant Heading"
  ) {
    const participant = participants.find(
      (item) => item.id === constraint.participantId,
    );
    const point = participant?.pathPoints.find(
      (item) => item.id === constraint.pathPointId,
    );

    return participant
      ? `${participant.name}${point ? ` · ${point.label}` : ""}`
      : "Participant target not selected";
  }

  if (constraint.kind === "Scene Object Position") {
    return (
      sceneObjects.find(
        (item) => item.id === constraint.sceneObjectId,
      )?.label ?? "Scene object not selected"
    );
  }

  if (constraint.kind === "Evidence Position") {
    const evidence = evidenceRecords.find(
      (item) => item.id === constraint.evidenceId,
    );

    return evidence
      ? `E-${evidence.evidenceNumber}: ${evidence.title}`
      : "Evidence target not selected";
  }

  return "Canonical primary collision marker";
}

function constraintComplete(
  constraint: ScenePhotoConstraint,
): boolean {
  if (
    constraint.kind === "Participant Path Point" ||
    constraint.kind === "Participant Heading"
  ) {
    return Boolean(
      constraint.participantId &&
        constraint.pathPointId,
    );
  }

  if (constraint.kind === "Scene Object Position") {
    return Boolean(constraint.sceneObjectId);
  }

  if (constraint.kind === "Evidence Position") {
    return Boolean(constraint.evidenceId);
  }

  return true;
}

function createDraft(
  photo: ScenePhotoAttachment,
  index: number,
): ScenePhotoConstraint {
  return createScenePhotoConstraint({
    photo,
    index,
  });
}

export default function PhotoConstraintWorkspace({
  photo,
  constraints,
  participants,
  sceneObjects,
  evidenceRecords,
  sceneWidthMetres,
  sceneHeightMetres,
  onAddConstraint,
  onConstraintChange,
  onApplyConstraint,
  onDeleteConstraint,
}: PhotoConstraintWorkspaceProps) {
  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [draft, setDraft] =
    useState<ScenePhotoConstraint>(() =>
      createDraft(photo, constraints.length),
    );

  const selectedParticipant = useMemo(
    () =>
      participants.find(
        (item) => item.id === draft.participantId,
      ) ?? null,
    [participants, draft.participantId],
  );

  const imageSource =
    photo.dataUrl || photo.thumbnailDataUrl;

  const sceneXMetres =
    (draft.scenePosition.x / 100) *
    Math.max(0.1, sceneWidthMetres);

  const sceneYMetres =
    (draft.scenePosition.y / 100) *
    Math.max(0.1, sceneHeightMetres);

  const resetDraft = () => {
    setEditingId(null);
    setDraft(
      createDraft(
        photo,
        constraints.length + 1,
      ),
    );
  };

  const setKind = (
    kind: ScenePhotoConstraintKind,
  ) => {
    setDraft((current) => ({
      ...current,
      kind,
      participantId:
        kind === "Participant Path Point" ||
        kind === "Participant Heading"
          ? current.participantId
          : undefined,
      pathPointId:
        kind === "Participant Path Point" ||
        kind === "Participant Heading"
          ? current.pathPointId
          : undefined,
      sceneObjectId:
        kind === "Scene Object Position"
          ? current.sceneObjectId
          : undefined,
      evidenceId:
        kind === "Evidence Position"
          ? current.evidenceId
          : undefined,
      headingDegrees:
        kind === "Participant Heading"
          ? current.headingDegrees ?? 0
          : undefined,
    }));
  };

  const handleImageClick = (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    const bounds =
      event.currentTarget.getBoundingClientRect();

    if (!bounds.width || !bounds.height) {
      return;
    }

    const x = Math.max(
      0,
      Math.min(
        100,
        ((event.clientX - bounds.left) /
          bounds.width) *
          100,
      ),
    );

    const y = Math.max(
      0,
      Math.min(
        100,
        ((event.clientY - bounds.top) /
          bounds.height) *
          100,
      ),
    );

    setDraft((current) => ({
      ...current,
      imagePoint: {
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
      },
    }));
  };

  const saveDraft = () => {
    const next: ScenePhotoConstraint = {
      ...draft,
      status: "Draft",
      confirmedAt: undefined,
      appliedAt: undefined,
      applicationSummary: undefined,
    };

    if (editingId) {
      onConstraintChange(
        editingId,
        next,
      );
    } else {
      onAddConstraint(next);
    }

    resetDraft();
  };

  const editConstraint = (
    constraint: ScenePhotoConstraint,
  ) => {
    setEditingId(constraint.id);
    setDraft({
      ...constraint,
      status: "Draft",
      confirmedAt: undefined,
      appliedAt: undefined,
      applicationSummary: undefined,
    });
  };

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-[#494949] bg-[#242424] text-slate-200 shadow-sm">
      <div className="border-b border-[#494949] bg-[#303030] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#d48744]">
              Photo-Assisted Reconstruction V1
            </p>
            <h4 className="mt-1 text-sm font-bold text-slate-100">
              {photo.filename}
            </h4>
            <p className="mt-1 max-w-3xl text-[9px] leading-4 text-slate-400">
              Mark what is visible in the source image, map it to a canonical scene target,
              then confirm it before RoadSafe is allowed to change reconstruction geometry.
            </p>
          </div>

          <span className="rounded border border-[#494949] bg-[#202020] px-2 py-1 text-[8px] font-bold uppercase text-slate-400">
            {constraints.filter((item) => item.status === "Applied").length} applied
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="min-w-0">
          <p className="mb-2 text-[8px] font-bold uppercase tracking-[0.08em] text-slate-500">
            1 · Mark the visible point in the photograph
          </p>

          <button
            type="button"
            onClick={handleImageClick}
            className="relative block w-full overflow-hidden rounded border border-[#494949] bg-black text-left"
            title="Click the visible feature you are using as the observation source"
          >
            <img
              src={imageSource}
              alt={photo.caption || photo.filename}
              className="max-h-[520px] w-full object-contain"
            />

            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#e8872d] shadow-[0_0_0_2px_rgba(0,0,0,0.7)]"
              style={{
                left: `${draft.imagePoint.x}%`,
                top: `${draft.imagePoint.y}%`,
              }}
            />
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[8px] text-slate-500">
            <span>
              Image X {draft.imagePoint.x.toFixed(2)}%
            </span>
            <span>·</span>
            <span>
              Image Y {draft.imagePoint.y.toFixed(2)}%
            </span>
            <span>·</span>
            <span>
              This image click records provenance only; it does not guess depth or world position.
            </span>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <p className="text-[8px] font-bold uppercase tracking-[0.08em] text-slate-500">
            2 · Define the reconstruction constraint
          </p>

          <label className="block">
            <span className="text-[8px] font-bold text-slate-400">
              Observation label
            </span>
            <input
              value={draft.label}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              className="ui-input mt-1 w-full"
            />
          </label>

          <label className="block">
            <span className="text-[8px] font-bold text-slate-400">
              Influence target
            </span>
            <select
              value={draft.kind}
              onChange={(event) =>
                setKind(
                  event.target.value as ScenePhotoConstraintKind,
                )
              }
              className="ui-input mt-1 w-full"
            >
              {CONSTRAINT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </label>

          {(draft.kind === "Participant Path Point" ||
            draft.kind === "Participant Heading") && (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="text-[8px] font-bold text-slate-400">
                  Participant
                </span>
                <select
                  value={draft.participantId ?? ""}
                  onChange={(event) => {
                    const participant = participants.find(
                      (item) => item.id === event.target.value,
                    );

                    setDraft((current) => ({
                      ...current,
                      participantId: event.target.value || undefined,
                      pathPointId: participant?.pathPoints[0]?.id,
                    }));
                  }}
                  className="ui-input mt-1 w-full"
                >
                  <option value="">Choose participant</option>
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[8px] font-bold text-slate-400">
                  Path point
                </span>
                <select
                  value={draft.pathPointId ?? ""}
                  disabled={!selectedParticipant}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      pathPointId: event.target.value || undefined,
                    }))
                  }
                  className="ui-input mt-1 w-full"
                >
                  <option value="">Choose path point</option>
                  {selectedParticipant?.pathPoints.map((point) => (
                    <option key={point.id} value={point.id}>
                      {point.label} · {point.action}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {draft.kind === "Participant Heading" && (
            <label className="block">
              <span className="text-[8px] font-bold text-slate-400">
                Confirmed heading (degrees)
              </span>
              <input
                type="number"
                min={0}
                max={359.9}
                step={0.1}
                value={draft.headingDegrees ?? 0}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    headingDegrees: Math.max(
                      0,
                      Math.min(359.9, Number(event.target.value)),
                    ),
                  }))
                }
                className="ui-input mt-1 w-full"
              />
            </label>
          )}

          {draft.kind === "Scene Object Position" && (
            <label className="block">
              <span className="text-[8px] font-bold text-slate-400">
                Scene object
              </span>
              <select
                value={draft.sceneObjectId ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sceneObjectId: event.target.value || undefined,
                  }))
                }
                className="ui-input mt-1 w-full"
              >
                <option value="">Choose scene object</option>
                {sceneObjects.map((object) => (
                  <option key={object.id} value={object.id}>
                    {object.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {draft.kind === "Evidence Position" && (
            <label className="block">
              <span className="text-[8px] font-bold text-slate-400">
                Evidence record
              </span>
              <select
                value={draft.evidenceId ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    evidenceId: event.target.value || undefined,
                  }))
                }
                className="ui-input mt-1 w-full"
              >
                <option value="">Choose evidence</option>
                {evidenceRecords.map((record) => (
                  <option key={record.id} value={record.id}>
                    E-{record.evidenceNumber}: {record.title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {draft.kind !== "Participant Heading" && (
            <div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[8px] font-bold text-slate-400">
                    Scene X (0–100)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={draft.scenePosition.x}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        scenePosition: {
                          ...current.scenePosition,
                          x: Math.max(
                            0,
                            Math.min(100, Number(event.target.value)),
                          ),
                        },
                      }))
                    }
                    className="ui-input mt-1 w-full"
                  />
                </label>

                <label className="block">
                  <span className="text-[8px] font-bold text-slate-400">
                    Scene Y (0–100)
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={draft.scenePosition.y}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        scenePosition: {
                          ...current.scenePosition,
                          y: Math.max(
                            0,
                            Math.min(100, Number(event.target.value)),
                          ),
                        },
                      }))
                    }
                    className="ui-input mt-1 w-full"
                  />
                </label>
              </div>

              <p className="mt-1 text-[8px] text-slate-500">
                Approx. {sceneXMetres.toFixed(2)} m × {sceneYMetres.toFixed(2)} m in the current metric scene.
              </p>
            </div>
          )}

          <label className="block">
            <span className="text-[8px] font-bold text-slate-400">
              Confidence
            </span>
            <select
              value={draft.confidence}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  confidence:
                    event.target.value as ScenePhotoConstraintConfidence,
                }))
              }
              className="ui-input mt-1 w-full"
            >
              {CONFIDENCE_LEVELS.map((confidence) => (
                <option key={confidence} value={confidence}>
                  {confidence}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[8px] font-bold text-slate-400">
              Investigator notes
            </span>
            <textarea
              rows={3}
              value={draft.notes}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className="ui-input mt-1 w-full resize-y"
              placeholder="Describe exactly what in the photo supports this observation."
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveDraft}
              className="ui-button-primary"
            >
              {editingId ? "Save observation changes" : "Add photo observation"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetDraft}
                className="ui-button"
              >
                Cancel edit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-[#494949] bg-[#202020] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h5 className="text-[10px] font-bold text-slate-200">
              Photo-derived observations
            </h5>
            <p className="mt-1 text-[8px] text-slate-500">
              Draft → Confirmed → Applied. Only Applied records alter canonical reconstruction state.
            </p>
          </div>
          <span className="text-[8px] font-bold uppercase text-slate-500">
            {constraints.length} total
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {constraints.map((constraint) => {
            const complete = constraintComplete(constraint);

            return (
              <article
                key={constraint.id}
                className="rounded border border-[#404040] bg-[#292929] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[9px] font-bold text-slate-200">
                        {constraint.label}
                      </p>
                      <span className="rounded border border-[#4a4a4a] bg-[#202020] px-1.5 py-0.5 text-[7px] font-black uppercase text-slate-400">
                        {constraint.kind}
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[7px] font-black uppercase ${
                          constraint.status === "Applied"
                            ? "border-[#496242] bg-[#1f2b1e] text-[#9bc58f]"
                            : constraint.status === "Confirmed"
                              ? "border-[#6d5523] bg-[#2a2316] text-[#d9bd78]"
                              : "border-[#4a4a4a] bg-[#202020] text-slate-500"
                        }`}
                      >
                        {constraint.status}
                      </span>
                    </div>

                    <p className="mt-1 text-[8px] text-slate-500">
                      {targetSummary(
                        constraint,
                        participants,
                        sceneObjects,
                        evidenceRecords,
                      )}
                    </p>

                    {constraint.applicationSummary && (
                      <p className="mt-2 text-[8px] leading-4 text-[#9bc58f]">
                        {constraint.applicationSummary}
                      </p>
                    )}
                  </div>

                  <span className="text-[7px] font-bold uppercase text-slate-500">
                    {constraint.confidence} confidence
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {constraint.status !== "Applied" && (
                    <button
                      type="button"
                      onClick={() => editConstraint(constraint)}
                      className="ui-button"
                    >
                      Edit
                    </button>
                  )}

                  {constraint.status === "Draft" && (
                    <button
                      type="button"
                      disabled={!complete}
                      onClick={() =>
                        onConstraintChange(
                          constraint.id,
                          {
                            status: "Confirmed",
                            confirmedAt: new Date().toISOString(),
                          },
                        )
                      }
                      className="ui-button"
                    >
                      Confirm observation
                    </button>
                  )}

                  {constraint.status === "Confirmed" && (
                    <button
                      type="button"
                      disabled={!complete}
                      onClick={() => onApplyConstraint(constraint.id)}
                      className="ui-button-primary"
                    >
                      Apply to reconstruction
                    </button>
                  )}

                  {constraint.status !== "Applied" && (
                    <button
                      type="button"
                      onClick={() => onDeleteConstraint(constraint.id)}
                      className="ui-button text-[#e28b9d]"
                    >
                      Delete observation
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {constraints.length === 0 && (
            <div className="rounded border border-dashed border-[#404040] p-5 text-center text-[9px] text-slate-500">
              No photo-derived observations yet. Mark a visible feature above and add the first constraint.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
