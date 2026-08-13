import { useMemo, useState } from "react";

import type {
  AccidentTimelineEvent,
  EvidenceCategory,
  EvidenceRecord,
  EvidenceStatus,
  ReconstructionSceneObject,
  ReconstructionVehicle,
  SceneMeasurement,
  SceneMeasurementKind,
  ScenePhotoAttachment,
  ScenePhotoConstraint,
} from "../../types/reconstruction";

import PhotoConstraintWorkspace from "./PhotoConstraintWorkspace";

export interface EvidenceWorkspaceProps {
  initialTab?: "evidence" | "measurements" | "photos";
  standalonePhotos?: boolean;
  measurements: SceneMeasurement[];
  selectedMeasurementId: string | null;
  measurementToolActive: boolean;
  measurementDraftStarted: boolean;
  evidenceRecords: EvidenceRecord[];
  selectedEvidenceId: string | null;
  activeEvidencePlacementId: string | null;
  photos: ScenePhotoAttachment[];
  photoConstraints: ScenePhotoConstraint[];
  participants: ReconstructionVehicle[];
  sceneObjects: ReconstructionSceneObject[];
  timelineEvents: AccidentTimelineEvent[];
  sceneWidthMetres: number;
  sceneHeightMetres: number;
  selectedParticipantId?: string | null;
  selectedPathPointId?: string | null;
  selectedSceneObjectId?: string | null;
  activeReconstructionView?: "2D" | "3D";
  physicsBakeState?: "DIRTY" | "BAKED";
  onSelectParticipant?: (participantId: string, pointId?: string) => void;
  onSelectSceneObject?: (sceneObjectId: string) => void;
  onSelectMeasurement: (measurementId: string | null) => void;
  onBeginMeasurement: () => void;
  onCancelMeasurement: () => void;
  onMeasurementChange: (
    measurementId: string,
    updates: Partial<SceneMeasurement>,
  ) => void;
  onDeleteMeasurement: (measurementId: string) => void;
  onSelectEvidence: (evidenceId: string | null) => void;
  onAddEvidence: () => void;
  onEvidenceChange: (
    evidenceId: string,
    updates: Partial<EvidenceRecord>,
  ) => void;
  onDeleteEvidence: (evidenceId: string) => void;
  onBeginEvidencePlacement: (evidenceId: string) => void;
  onCancelEvidencePlacement: () => void;
  onAddPhoto: (photo: ScenePhotoAttachment) => void;
  onPhotoChange: (
    photoId: string,
    updates: Partial<ScenePhotoAttachment>,
  ) => void;
  onDeletePhoto: (photoId: string) => void;
  onAddPhotoConstraint: (constraint: ScenePhotoConstraint) => void;
  onPhotoConstraintChange: (
    constraintId: string,
    updates: Partial<ScenePhotoConstraint>,
  ) => void;
  onApplyPhotoConstraint: (constraintId: string) => void;
  onDeletePhotoConstraint: (constraintId: string) => void;
}

const MEASUREMENT_KINDS: SceneMeasurementKind[] = [
  "Distance",
  "Braking Distance",
  "Skid Length",
  "Lane Width",
  "Road Width",
  "Impact to Rest",
  "Participant Separation",
  "Custom",
];

const EVIDENCE_CATEGORIES: EvidenceCategory[] = [
  "Road Condition",
  "Vehicle Evidence",
  "Human Evidence",
  "Trace Evidence",
  "Environmental",
  "Digital",
  "Other",
];

const EVIDENCE_STATUSES: EvidenceStatus[] = [
  "Observed",
  "Photographed",
  "Collected",
  "Analysed",
];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode image."));
    image.src = dataUrl;
  });
}

async function compressScenePhoto(file: File): Promise<{
  dataUrl: string;
  thumbnailDataUrl: string;
}> {
  const original = await readFileAsDataUrl(file);
  const image = await loadImage(original);

  const render = (maximumDimension: number, quality: number) => {
    const scale = Math.min(1, maximumDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  };

  return {
    dataUrl: render(1280, 0.78),
    thumbnailDataUrl: render(320, 0.68),
  };
}

export function EvidenceWorkspacePanel({
  initialTab = "evidence",
  standalonePhotos = false,
  measurements,
  selectedMeasurementId,
  measurementToolActive,
  measurementDraftStarted,
  evidenceRecords,
  selectedEvidenceId,
  activeEvidencePlacementId,
  photos,
  photoConstraints,
  participants,
  sceneObjects,
  timelineEvents,
  sceneWidthMetres,
  sceneHeightMetres,
  selectedParticipantId = null,
  selectedPathPointId = null,
  selectedSceneObjectId = null,
  activeReconstructionView = "2D",
  physicsBakeState = "DIRTY",
  onSelectParticipant,
  onSelectSceneObject,
  onSelectMeasurement,
  onBeginMeasurement,
  onCancelMeasurement,
  onMeasurementChange,
  onDeleteMeasurement,
  onSelectEvidence,
  onAddEvidence,
  onEvidenceChange,
  onDeleteEvidence,
  onBeginEvidencePlacement,
  onCancelEvidencePlacement,
  onAddPhoto,
  onPhotoChange,
  onDeletePhoto,
  onAddPhotoConstraint,
  onPhotoConstraintChange,
  onApplyPhotoConstraint,
  onDeletePhotoConstraint,
}: EvidenceWorkspaceProps) {
  const [tab, setTab] = useState<"evidence" | "measurements" | "photos">(
    standalonePhotos ? "photos" : initialTab,
  );
  const [photoError, setPhotoError] = useState("");
  const [selectedPhotoAnalysisId, setSelectedPhotoAnalysisId] =
    useState<string | null>(null);

  const selectedPhotoForAnalysis = useMemo(
    () =>
      photos.find((photo) => photo.id === selectedPhotoAnalysisId) ?? null,
    [photos, selectedPhotoAnalysisId],
  );

  const selectedMeasurement = useMemo(
    () => measurements.find((item) => item.id === selectedMeasurementId) ?? null,
    [measurements, selectedMeasurementId],
  );

  const selectedEvidence = useMemo(
    () => evidenceRecords.find((item) => item.id === selectedEvidenceId) ?? null,
    [evidenceRecords, selectedEvidenceId],
  );

  return (
    <section
      className={
        standalonePhotos
          ? "roadsafe-photo-integrated-panel min-h-full overflow-hidden border border-[#494949] bg-[#242424] text-slate-200"
          : "mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      }
    >
      <div
        className={
          standalonePhotos
            ? "border-b border-[#494949] bg-[#303030] p-3"
            : "border-b border-gray-200 bg-gray-50 p-5"
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p
              className={
                standalonePhotos
                  ? "text-[8px] font-black uppercase tracking-[0.12em] text-[#d48744]"
                  : "text-xs font-bold uppercase tracking-[0.18em] text-amber-700"
              }
            >
              {standalonePhotos
                ? "Photo-Assisted Reconstruction"
                : "Investigation Documentation"}
            </p>
            <h2
              className={
                standalonePhotos
                  ? "mt-1 text-xs font-bold text-slate-100"
                  : "mt-1 text-xl font-bold text-gray-900"
              }
            >
              {standalonePhotos
                ? "Scene Photos & Reconstruction Constraints"
                : "Evidence, Measurements & Scene Photos"}
            </h2>
            <p
              className={
                standalonePhotos
                  ? "mt-1 max-w-3xl text-[8px] leading-4 text-slate-400"
                  : "mt-1 text-sm text-gray-600"
              }
            >
              {standalonePhotos
                ? "Upload scene photographs, analyse visible features and apply confirmed observations to the canonical reconstruction."
                : "Record numbered evidence, measure the road scene and attach photographs to the reconstruction."}
            </p>
          </div>

          {!standalonePhotos && (
            <div className="flex rounded-xl border border-gray-200 bg-white p-1">
              {(["evidence", "measurements", "photos"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize ${
                    tab === item
                      ? "bg-gray-900 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {standalonePhotos && (
        <div className="roadsafe-photo-integrated-panel__sync-strip">
          <span>Main Reconstruction</span>
          <strong>{activeReconstructionView}</strong>
          <span>·</span>
          <span>Canonical state shared</span>
          <span>·</span>
          <strong
            className={
              physicsBakeState === "BAKED"
                ? "is-baked"
                : "is-dirty"
            }
          >
            Physics {physicsBakeState}
          </strong>
        </div>
      )}

      {tab === "evidence" && (
        <div className="grid gap-5 p-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-gray-900">Evidence register</h3>
              <button
                type="button"
                onClick={onAddEvidence}
                className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-gray-950 hover:bg-amber-400"
              >
                Add Evidence
              </button>
            </div>

            <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {evidenceRecords.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => onSelectEvidence(record.id)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    selectedEvidenceId === record.id
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        E-{String(record.evidenceNumber).padStart(2, "0")} · {record.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {record.category} · {record.status}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">
                      {record.photoIds.length} photos
                    </span>
                  </div>
                </button>
              ))}

              {evidenceRecords.length === 0 && (
                <p className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                  No evidence records have been added.
                </p>
              )}
            </div>
          </div>

          {!selectedEvidence ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              Select an evidence record to edit its details and position.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold text-gray-600">Title</span>
                <input
                  value={selectedEvidence.title}
                  onChange={(event) =>
                    onEvidenceChange(selectedEvidence.id, { title: event.target.value })
                  }
                  className={standalonePhotos ? "ui-input mt-1 w-full text-[9px]" : "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"}
                />
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">Category</span>
                <select
                  value={selectedEvidence.category}
                  onChange={(event) =>
                    onEvidenceChange(selectedEvidence.id, {
                      category: event.target.value as EvidenceCategory,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {EVIDENCE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">Status</span>
                <select
                  value={selectedEvidence.status}
                  onChange={(event) =>
                    onEvidenceChange(selectedEvidence.id, {
                      status: event.target.value as EvidenceStatus,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {EVIDENCE_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">Recorded by</span>
                <input
                  value={selectedEvidence.recordedBy}
                  onChange={(event) =>
                    onEvidenceChange(selectedEvidence.id, { recordedBy: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">Recorded at</span>
                <input
                  type="datetime-local"
                  value={selectedEvidence.recordedAt.slice(0, 16)}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    onEvidenceChange(selectedEvidence.id, {
                      recordedAt: new Date(event.target.value).toISOString(),
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">Participant</span>
                <select
                  value={selectedEvidence.linkedParticipantId ?? ""}
                  onChange={(event) =>
                    onEvidenceChange(selectedEvidence.id, {
                      linkedParticipantId: event.target.value || undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>{participant.name}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">Scene object</span>
                <select
                  value={selectedEvidence.linkedSceneObjectId ?? ""}
                  onChange={(event) =>
                    onEvidenceChange(selectedEvidence.id, {
                      linkedSceneObjectId: event.target.value || undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {sceneObjects.map((object) => (
                    <option key={object.id} value={object.id}>{object.label}</option>
                  ))}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="text-xs font-semibold text-gray-600">Timeline event</span>
                <select
                  value={selectedEvidence.linkedTimelineEventId ?? ""}
                  onChange={(event) =>
                    onEvidenceChange(selectedEvidence.id, {
                      linkedTimelineEventId: event.target.value || undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {timelineEvents.map((event) => (
                    <option key={event.id} value={event.id}>{event.timeSeconds.toFixed(1)}s · {event.title}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <label>
                  <span className="text-xs font-semibold text-gray-600">Position X</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedEvidence.position.x}
                    onChange={(event) =>
                      onEvidenceChange(selectedEvidence.id, {
                        position: {
                          ...selectedEvidence.position,
                          x: Math.max(0, Math.min(100, Number(event.target.value))),
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <label>
                  <span className="text-xs font-semibold text-gray-600">Position Y</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedEvidence.position.y}
                    onChange={(event) =>
                      onEvidenceChange(selectedEvidence.id, {
                        position: {
                          ...selectedEvidence.position,
                          y: Math.max(0, Math.min(100, Number(event.target.value))),
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="sm:col-span-2 rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-600">
                  Linked measurements
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {measurements.map((measurement) => {
                    const checked = selectedEvidence.measurementIds.includes(measurement.id);
                    return (
                      <label key={measurement.id} className="flex items-center gap-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            onEvidenceChange(selectedEvidence.id, {
                              measurementIds: event.target.checked
                                ? Array.from(new Set([...selectedEvidence.measurementIds, measurement.id]))
                                : selectedEvidence.measurementIds.filter((id) => id !== measurement.id),
                            })
                          }
                        />
                        <span>
                          M-{String(measurement.measurementNumber).padStart(2, "0")} · {measurement.label}
                        </span>
                      </label>
                    );
                  })}
                  {measurements.length === 0 && (
                    <p className="text-xs text-gray-500">No measurements available.</p>
                  )}
                </div>
              </div>

              <label className="sm:col-span-2">
                <span className="text-xs font-semibold text-gray-600">Description</span>
                <textarea
                  rows={3}
                  value={selectedEvidence.description}
                  onChange={(event) =>
                    onEvidenceChange(selectedEvidence.id, { description: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="text-xs font-semibold text-gray-600">Officer notes</span>
                <textarea
                  rows={2}
                  value={selectedEvidence.notes}
                  onChange={(event) =>
                    onEvidenceChange(selectedEvidence.id, { notes: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onBeginEvidencePlacement(selectedEvidence.id)}
                  className="rounded-lg bg-[#303030] px-4 py-2 text-sm font-semibold text-white hover:bg-[#303030]"
                >
                  {activeEvidencePlacementId === selectedEvidence.id
                    ? "Click the scene…"
                    : "Place / Reposition on Scene"}
                </button>

                {activeEvidencePlacementId && (
                  <button
                    type="button"
                    onClick={onCancelEvidencePlacement}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700"
                  >
                    Cancel placement
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onDeleteEvidence(selectedEvidence.id)}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                >
                  Delete Evidence
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "measurements" && (
        <div className="grid gap-5 p-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-gray-900">Scene measurements</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBeginMeasurement}
                  className="rounded-lg bg-[#303030] px-3 py-2 text-xs font-bold text-white hover:bg-[#303030]"
                >
                  {measurementToolActive
                    ? measurementDraftStarted
                      ? "Pick end point"
                      : "Pick start point"
                    : "New Measurement"}
                </button>
                {measurementToolActive && (
                  <button
                    type="button"
                    onClick={onCancelMeasurement}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
              {measurements.map((measurement) => (
                <button
                  key={measurement.id}
                  type="button"
                  onClick={() => onSelectMeasurement(measurement.id)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    selectedMeasurementId === measurement.id
                      ? "border-[#494949] bg-[#303030]"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <p className="text-sm font-bold text-gray-900">
                    M-{String(measurement.measurementNumber).padStart(2, "0")} · {measurement.label}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {measurement.kind} · {measurement.distanceMetres.toFixed(2)} metres
                  </p>
                </button>
              ))}

              {measurements.length === 0 && (
                <p className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                  Use New Measurement, then click two points on the scene.
                </p>
              )}
            </div>
          </div>

          {!selectedMeasurement ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
              Select a measurement to edit its type, links and notes.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold text-gray-600">Label</span>
                <input
                  value={selectedMeasurement.label}
                  onChange={(event) =>
                    onMeasurementChange(selectedMeasurement.id, { label: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">Measurement type</span>
                <select
                  value={selectedMeasurement.kind}
                  onChange={(event) =>
                    onMeasurementChange(selectedMeasurement.id, {
                      kind: event.target.value as SceneMeasurementKind,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {MEASUREMENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                </select>
              </label>

              <div className="rounded-xl bg-[#303030] p-3">
                <p className="text-xs font-semibold text-[#c4c4c4]">Calculated length</p>
                <p className="mt-1 text-2xl font-black text-[#c4c4c4]">
                  {selectedMeasurement.distanceMetres.toFixed(2)} m
                </p>
              </div>

              <label>
                <span className="text-xs font-semibold text-gray-600">Participant</span>
                <select
                  value={selectedMeasurement.linkedParticipantId ?? ""}
                  onChange={(event) =>
                    onMeasurementChange(selectedMeasurement.id, {
                      linkedParticipantId: event.target.value || undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {participants.map((participant) => (
                    <option key={participant.id} value={participant.id}>{participant.name}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-xs font-semibold text-gray-600">Scene object</span>
                <select
                  value={selectedMeasurement.linkedSceneObjectId ?? ""}
                  onChange={(event) =>
                    onMeasurementChange(selectedMeasurement.id, {
                      linkedSceneObjectId: event.target.value || undefined,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">None</option>
                  {sceneObjects.map((object) => (
                    <option key={object.id} value={object.id}>{object.label}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <label>
                  <span className="text-xs font-semibold text-gray-600">Start X</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedMeasurement.start.x}
                    onChange={(event) =>
                      onMeasurementChange(selectedMeasurement.id, {
                        start: {
                          ...selectedMeasurement.start,
                          x: Math.max(0, Math.min(100, Number(event.target.value))),
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <label>
                  <span className="text-xs font-semibold text-gray-600">Start Y</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedMeasurement.start.y}
                    onChange={(event) =>
                      onMeasurementChange(selectedMeasurement.id, {
                        start: {
                          ...selectedMeasurement.start,
                          y: Math.max(0, Math.min(100, Number(event.target.value))),
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <label>
                  <span className="text-xs font-semibold text-gray-600">End X</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedMeasurement.end.x}
                    onChange={(event) =>
                      onMeasurementChange(selectedMeasurement.id, {
                        end: {
                          ...selectedMeasurement.end,
                          x: Math.max(0, Math.min(100, Number(event.target.value))),
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <label>
                  <span className="text-xs font-semibold text-gray-600">End Y</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedMeasurement.end.y}
                    onChange={(event) =>
                      onMeasurementChange(selectedMeasurement.id, {
                        end: {
                          ...selectedMeasurement.end,
                          y: Math.max(0, Math.min(100, Number(event.target.value))),
                        },
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="sm:col-span-2">
                <span className="text-xs font-semibold text-gray-600">Notes</span>
                <textarea
                  rows={3}
                  value={selectedMeasurement.notes}
                  onChange={(event) =>
                    onMeasurementChange(selectedMeasurement.id, { notes: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
                <span className="text-sm font-semibold text-gray-700">Visible</span>
                <input
                  type="checkbox"
                  checked={selectedMeasurement.visible}
                  onChange={(event) =>
                    onMeasurementChange(selectedMeasurement.id, { visible: event.target.checked })
                  }
                  className="h-5 w-5"
                />
              </label>

              <label className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
                <span className="text-sm font-semibold text-gray-700">Lock endpoints</span>
                <input
                  type="checkbox"
                  checked={selectedMeasurement.locked}
                  onChange={(event) =>
                    onMeasurementChange(selectedMeasurement.id, { locked: event.target.checked })
                  }
                  className="h-5 w-5"
                />
              </label>

              <button
                type="button"
                onClick={() => onDeleteMeasurement(selectedMeasurement.id)}
                className="sm:col-span-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
              >
                Delete Measurement
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "photos" && (
        <div className={standalonePhotos ? "p-3" : "p-5"}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3
                className={
                  standalonePhotos
                    ? "text-[10px] font-bold text-slate-100"
                    : "font-bold text-gray-900"
                }
              >
                Scene photographs
              </h3>
              <p
                className={
                  standalonePhotos
                    ? "mt-1 text-[8px] text-slate-500"
                    : "mt-1 text-xs text-gray-500"
                }
              >
                Images are resized before being stored in localStorage. Use cloud storage for production evidence.
              </p>
            </div>

            <label
              className={
                standalonePhotos
                  ? "ui-button cursor-pointer"
                  : "cursor-pointer rounded-lg bg-[#303030] px-4 py-2 text-sm font-semibold text-white hover:bg-[#303030]"
              }
            >
              Upload Photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={async (event) => {
                  setPhotoError("");
                  const files = Array.from(event.target.files ?? []) as File[];

                  for (const file of files) {
                    try {
                      if (file.size > 12 * 1024 * 1024) {
                        throw new Error(`${file.name} is larger than 12 MB.`);
                      }

                      const compressed = await compressScenePhoto(file);
                      const photo: ScenePhotoAttachment = {
                        id: createId("photo"),
                        filename: file.name,
                        mimeType: "image/jpeg",
                        sizeBytes: file.size,
                        dataUrl: compressed.dataUrl,
                        thumbnailDataUrl: compressed.thumbnailDataUrl,
                        caption: "",
                        takenAt: new Date().toISOString(),
                        position: { x: 50, y: 50 },
                        bearingDegrees: 0,
                      };
                      onAddPhoto(photo);
                    } catch (error) {
                      setPhotoError(error instanceof Error ? error.message : "Photo upload failed.");
                    }
                  }

                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {photoError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {photoError}
            </p>
          )}

          <div
            className={
              standalonePhotos
                ? "mt-3 grid gap-2"
                : "mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            }
          >
            {photos.map((photo) => (
              <article
                key={photo.id}
                className={
                  standalonePhotos
                    ? "roadsafe-photo-integrated-card overflow-hidden border border-[#494949] bg-[#292929]"
                    : "overflow-hidden rounded-xl border border-gray-200 bg-white"
                }
              >
                <img
                  src={photo.thumbnailDataUrl}
                  alt={photo.caption || photo.filename}
                  className={
                    standalonePhotos
                      ? "h-28 w-full bg-black object-cover"
                      : "h-44 w-full object-cover"
                  }
                />

                <div className={standalonePhotos ? "space-y-2 p-3" : "space-y-3 p-4"}>
                  <p
                    className={
                      standalonePhotos
                        ? "truncate text-[9px] font-bold text-slate-100"
                        : "truncate text-sm font-bold text-gray-900"
                    }
                  >
                    {photo.filename}
                  </p>

                  <label className="block">
                    <span className={standalonePhotos ? "text-[8px] font-semibold text-slate-400" : "text-xs font-semibold text-gray-600"}>Caption</span>
                    <textarea
                      rows={2}
                      value={photo.caption}
                      onChange={(event) =>
                        onPhotoChange(photo.id, { caption: event.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <label>
                      <span className={standalonePhotos ? "text-[8px] font-semibold text-slate-400" : "text-xs font-semibold text-gray-600"}>Photo X</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={photo.position.x}
                        onChange={(event) =>
                          onPhotoChange(photo.id, {
                            position: {
                              ...photo.position,
                              x: Math.max(0, Math.min(100, Number(event.target.value))),
                            },
                          })
                        }
                        className={standalonePhotos ? "ui-input mt-1 w-full text-[9px]" : "mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"}
                      />
                    </label>

                    <label>
                      <span className={standalonePhotos ? "text-[8px] font-semibold text-slate-400" : "text-xs font-semibold text-gray-600"}>Photo Y</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={photo.position.y}
                        onChange={(event) =>
                          onPhotoChange(photo.id, {
                            position: {
                              ...photo.position,
                              y: Math.max(0, Math.min(100, Number(event.target.value))),
                            },
                          })
                        }
                        className={standalonePhotos ? "ui-input mt-1 w-full text-[9px]" : "mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"}
                      />
                    </label>

                    <label>
                      <span className={standalonePhotos ? "text-[8px] font-semibold text-slate-400" : "text-xs font-semibold text-gray-600"}>Bearing°</span>
                      <input
                        type="number"
                        min={0}
                        max={359}
                        value={photo.bearingDegrees}
                        onChange={(event) =>
                          onPhotoChange(photo.id, {
                            bearingDegrees: Math.max(0, Math.min(359, Number(event.target.value))),
                          })
                        }
                        className={standalonePhotos ? "ui-input mt-1 w-full text-[9px]" : "mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"}
                      />
                    </label>

                    <label className="col-span-3">
                      <span className={standalonePhotos ? "text-[8px] font-semibold text-slate-400" : "text-xs font-semibold text-gray-600"}>Evidence</span>
                      <select
                        value={photo.linkedEvidenceId ?? ""}
                        onChange={(event) =>
                          onPhotoChange(photo.id, {
                            linkedEvidenceId: event.target.value || undefined,
                          })
                        }
                        className={standalonePhotos ? "ui-input mt-1 w-full text-[9px]" : "mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"}
                      >
                        <option value="">None</option>
                        {evidenceRecords.map((record) => (
                          <option key={record.id} value={record.id}>
                            E-{record.evidenceNumber}: {record.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedPhotoAnalysisId((current) =>
                        current === photo.id ? null : photo.id,
                      )
                    }
                    className={
                      standalonePhotos
                        ? "ui-button w-full justify-center text-[8px]"
                        : "w-full rounded-lg border border-[#494949] bg-[#303030] px-3 py-2 text-sm font-semibold text-white"
                    }
                  >
                    {selectedPhotoAnalysisId === photo.id
                      ? "Close Photo Analysis"
                      : `Analyse / Influence Reconstruction (${
                          photoConstraints.filter(
                            (constraint) => constraint.photoId === photo.id,
                          ).length
                        })`}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPhotoAnalysisId === photo.id) {
                        setSelectedPhotoAnalysisId(null);
                      }
                      onDeletePhoto(photo.id);
                    }}
                    className={
                      standalonePhotos
                        ? "w-full border border-[#713646] bg-[#321722] px-3 py-1.5 text-[8px] font-semibold text-[#e28b9d]"
                        : "w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
                    }
                  >
                    Remove Photo
                  </button>
                </div>
              </article>
            ))}

            {photos.length === 0 && (
              <p
                className={
                  standalonePhotos
                    ? "border border-dashed border-[#494949] p-6 text-center text-[9px] text-slate-500"
                    : "rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 md:col-span-2 xl:col-span-3"
                }
              >
                No scene photographs have been uploaded.
              </p>
            )}
          </div>

          {selectedPhotoForAnalysis && (
            <PhotoConstraintWorkspace
              key={selectedPhotoForAnalysis.id}
              photo={selectedPhotoForAnalysis}
              constraints={photoConstraints.filter(
                (constraint) =>
                  constraint.photoId === selectedPhotoForAnalysis.id,
              )}
              participants={participants}
              sceneObjects={sceneObjects}
              evidenceRecords={evidenceRecords}
              sceneWidthMetres={sceneWidthMetres}
              sceneHeightMetres={sceneHeightMetres}
              selectedParticipantId={selectedParticipantId}
              selectedPathPointId={selectedPathPointId}
              selectedSceneObjectId={selectedSceneObjectId}
              onSelectParticipant={onSelectParticipant}
              onSelectSceneObject={onSelectSceneObject}
              onAddConstraint={onAddPhotoConstraint}
              onConstraintChange={onPhotoConstraintChange}
              onApplyConstraint={onApplyPhotoConstraint}
              onDeleteConstraint={onDeletePhotoConstraint}
            />
          )}
        </div>
      )}
    </section>
  );
}


export default EvidenceWorkspacePanel;
