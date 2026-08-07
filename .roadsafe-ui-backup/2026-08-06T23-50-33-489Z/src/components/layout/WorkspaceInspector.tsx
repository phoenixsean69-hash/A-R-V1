import { Link } from "react-router-dom";
import {
  Boxes,
  ClipboardList,
  FileText,
  Map,
  Pin,
  PinOff,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";

import type { AccidentCase } from "../../types/accidentCase";
import type { AccidentReconstruction } from "../../types/reconstruction";
import { usesGeneratedRoad } from "../../types/reconstruction";

interface WorkspaceInspectorProps {
  activeCase?: AccidentCase;
  activeReconstruction?: AccidentReconstruction;
  activeCases: number;
  stationName: string;
  docked: boolean;
  onToggleDock: () => void;
  onClose: () => void;
}

function formatDateTime(value?: string): string {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function labelFromToken(value?: string): string {
  if (!value) return "Not recorded";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function syncTone(
  state: AccidentCase["cloudSyncState"],
): string {
  if (state === "synced") return "is-success";
  if (state === "pending") return "is-warning";
  if (state === "error") return "is-danger";
  return "is-neutral";
}

function InspectorRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="roadsafe-inspector-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function WorkspaceInspector({
  activeCase,
  activeReconstruction,
  activeCases,
  stationName,
  docked,
  onToggleDock,
  onClose,
}: WorkspaceInspectorProps) {
  const scene = activeReconstruction?.scene;
  const generatedRoad = scene
    ? usesGeneratedRoad(scene)
    : false;

  const participantCount =
    activeReconstruction?.vehicles.length ?? 0;
  const evidenceCount =
    (activeReconstruction?.evidenceRecords.length ?? 0) +
    (activeReconstruction?.photos.length ?? 0);
  const measurementCount =
    activeReconstruction?.measurements.length ?? 0;
  const sceneObjectCount =
    activeReconstruction?.sceneObjects.length ?? 0;

  return (
    <aside
      className={`roadsafe-inspector ${
        docked ? "is-docked" : "is-floating"
      }`}
      data-docked={docked}
      aria-label="Case context inspector"
    >
      <div className="roadsafe-inspector-header">
        <div>
          <p className="roadsafe-eyebrow">Context inspector</p>
          <h2>Active investigation</h2>
        </div>

        <div className="roadsafe-inspector-window-actions">
          <button
            type="button"
            className="ui-icon-button roadsafe-inspector-dock"
            onClick={onToggleDock}
            aria-label={
              docked
                ? "Undock case inspector"
                : "Dock case inspector to the right"
            }
            title={
              docked
                ? "Undock inspector"
                : "Dock inspector"
            }
          >
            {docked ? (
              <PinOff size={15} />
            ) : (
              <Pin size={15} />
            )}
          </button>

          <button
            type="button"
            className="ui-icon-button roadsafe-inspector-close"
            onClick={onClose}
            aria-label="Close case inspector"
            title="Close inspector"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="roadsafe-inspector-scroll">
        {!activeCase ? (
          <section className="roadsafe-inspector-empty">
            <ShieldCheck size={28} strokeWidth={1.5} />
            <h3>No active case</h3>
            <p>
              Open or create an investigation to populate the
              workspace inspector.
            </p>
            <Link to="/cases/new" className="ui-button ui-button-primary">
              Create case
            </Link>
          </section>
        ) : (
          <>
            <section className="roadsafe-inspector-section">
              <div className="roadsafe-inspector-section-heading">
                <div>
                  <p className="roadsafe-eyebrow">Case identity</p>
                  <h3>{activeCase.caseNumber}</h3>
                </div>
                <span className="ui-badge is-info">
                  {activeCase.status}
                </span>
              </div>

              <p className="roadsafe-inspector-case-title">
                {activeCase.title || "Untitled accident case"}
              </p>

              <dl className="roadsafe-inspector-definition-list">
                <InspectorRow
                  label="Location"
                  value={activeCase.location || "Not recorded"}
                />
                <InspectorRow
                  label="Date / time"
                  value={`${activeCase.accidentDate || "—"} · ${
                    activeCase.accidentTime || "—"
                  }`}
                />
                <InspectorRow
                  label="Investigator"
                  value={
                    activeCase.investigatingOfficer ||
                    "Not assigned"
                  }
                />
                <InspectorRow
                  label="Station"
                  value={
                    activeCase.policeStation ||
                    stationName ||
                    "Not assigned"
                  }
                />
              </dl>
            </section>

            <section className="roadsafe-inspector-section">
              <div className="roadsafe-inspector-section-heading">
                <div>
                  <p className="roadsafe-eyebrow">Record state</p>
                  <h3>Integrity and review</h3>
                </div>
              </div>

              <div className="roadsafe-status-stack">
                <div className="roadsafe-status-line">
                  <span>Cloud state</span>
                  <span
                    className={`ui-badge ${syncTone(
                      activeCase.cloudSyncState,
                    )}`}
                  >
                    {labelFromToken(
                      activeCase.cloudSyncState ?? "local",
                    )}
                  </span>
                </div>
                <div className="roadsafe-status-line">
                  <span>Review status</span>
                  <span className="ui-badge is-neutral">
                    {labelFromToken(
                      activeCase.reviewStatus ?? "draft",
                    )}
                  </span>
                </div>
                <div className="roadsafe-status-line">
                  <span>Last updated</span>
                  <strong>{formatDateTime(activeCase.updatedAt)}</strong>
                </div>
              </div>

              {activeCase.cloudSyncError && (
                <p className="roadsafe-inline-alert is-danger">
                  {activeCase.cloudSyncError}
                </p>
              )}
            </section>

            <section className="roadsafe-inspector-section">
              <div className="roadsafe-inspector-section-heading">
                <div>
                  <p className="roadsafe-eyebrow">Scene summary</p>
                  <h3>Reconstruction state</h3>
                </div>
                <span
                  className={`ui-badge ${
                    activeReconstruction?.status === "Completed"
                      ? "is-success"
                      : "is-warning"
                  }`}
                >
                  {activeReconstruction?.status ?? "Not created"}
                </span>
              </div>

              <div className="roadsafe-inspector-metrics">
                <div>
                  <strong>{participantCount}</strong>
                  <span>Participants</span>
                </div>
                <div>
                  <strong>{evidenceCount}</strong>
                  <span>Evidence</span>
                </div>
                <div>
                  <strong>{measurementCount}</strong>
                  <span>Measurements</span>
                </div>
                <div>
                  <strong>{sceneObjectCount}</strong>
                  <span>Scene objects</span>
                </div>
              </div>

              <dl className="roadsafe-inspector-definition-list">
                <InspectorRow
                  label="Environment"
                  value={
                    scene
                      ? generatedRoad
                        ? scene.roadLayout
                        : scene.groundSurface
                      : "Not configured"
                  }
                />
                <InspectorRow
                  label="Surface"
                  value={scene?.roadSurface ?? "Not configured"}
                />
                <InspectorRow
                  label="Weather"
                  value={scene?.weather ?? "Not configured"}
                />
                <InspectorRow
                  label="Terrain"
                  value={
                    scene?.realSceneGeometry
                      ? "Extracted geometry available"
                      : scene?.useRealTerrain
                        ? "Real terrain requested"
                        : "Fallback scene"
                  }
                />
                <InspectorRow
                  label="Collision confidence"
                  value={
                    activeReconstruction?.collisionSetup?.confidence ??
                    "Not recorded"
                  }
                />
              </dl>
            </section>

            <section className="roadsafe-inspector-section">
              <div className="roadsafe-inspector-section-heading">
                <div>
                  <p className="roadsafe-eyebrow">Case tools</p>
                  <h3>Open workspace</h3>
                </div>
              </div>

              <div className="roadsafe-inspector-actions">
                <Link to={`/cases/${activeCase.id}`}>
                  <ClipboardList size={15} />
                  Case overview
                </Link>
                <Link to={`/cases/${activeCase.id}/reconstruction`}>
                  <Boxes size={15} />
                  Reconstruction
                </Link>
                <Link to={`/cases/${activeCase.id}/reconstruction/ar`}>
                  <Map size={15} />
                  AR review
                </Link>
                <Link to={`/cases/${activeCase.id}/footage`}>
                  <Video size={15} />
                  Footage
                </Link>
                <Link to={`/cases/${activeCase.id}/report`}>
                  <FileText size={15} />
                  Investigation report
                </Link>
              </div>
            </section>
          </>
        )}
      </div>

      <div className="roadsafe-inspector-footer">
        <div>
          <span>Open investigations</span>
          <strong>{activeCases}</strong>
        </div>
        <div>
          <span>Workspace</span>
          <strong>Operational</strong>
        </div>
      </div>
    </aside>
  );
}
