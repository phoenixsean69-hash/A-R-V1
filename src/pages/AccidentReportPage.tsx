import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  FileJson,
  FileSearch,
  FileText,
  Gauge,
  Lightbulb,
  ListChecks,
  MapPinned,
  Navigation,
  Printer,
  Ruler,
  ShieldCheck,
  Users,
  Video,
} from "lucide-react";

import { AccidentCaseService } from "../services/accidentCaseService";
import { AccidentReportService } from "../services/accidentReportService";
import { usesGeneratedRoad } from "../types/reconstruction";
import "./AccidentReportPage.css";

export default function AccidentReportPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const accidentCase = caseId ? AccidentCaseService.getById(caseId) : null;

  if (!accidentCase) {
    return (
      <main className="accident-report-screen accident-report-screen--empty">
        <section className="accident-report-empty-state">
          <FileSearch size={30} />
          <p>RoadSafe case report</p>
          <h1>Case not found</h1>
          <span>The requested case is unavailable or may have been removed.</span>
          <Link to="/cases" className="report-toolbar-button report-toolbar-button--primary">
            <ArrowLeft size={15} />
            Return to cases
          </Link>
        </section>
      </main>
    );
  }

  const reconstruction = AccidentCaseService.getLinkedReconstruction(accidentCase);
  const completion = AccidentCaseService.getCompletion(accidentCase);
  const report = AccidentReportService.build(accidentCase, reconstruction);
  const completionPercent = Math.round(
    (completion.completedCount / Math.max(1, completion.totalCount)) * 100,
  );

  const participantCount = reconstruction?.vehicles.length ?? 0;
  const evidenceCount = reconstruction?.evidenceRecords.length ?? 0;
  const measurementCount = reconstruction?.measurements.length ?? 0;
  const footageCount = report.footage.length;

  return (
    <main className="accident-report-screen">
      <div className="report-toolbar no-print">
        <div className="report-toolbar__identity">
          <Link
            to={`/cases/${accidentCase.id}`}
            className="report-toolbar-button report-toolbar-button--quiet"
          >
            <ArrowLeft size={15} />
            Back to case
          </Link>
          <div>
            <p>RoadSafe investigation report</p>
            <h1>{accidentCase.caseNumber}</h1>
          </div>
        </div>

        <div className="report-toolbar__actions">
          <button
            type="button"
            onClick={() => window.print()}
            className="report-toolbar-button report-toolbar-button--primary"
          >
            <Printer size={15} />
            Print / PDF
          </button>
          <button
            type="button"
            onClick={() => AccidentReportService.downloadWord(report)}
            className="report-toolbar-button"
          >
            <FileText size={15} />
            Word
          </button>
          <button
            type="button"
            onClick={() => AccidentReportService.downloadJson(report)}
            className="report-toolbar-button"
          >
            <FileJson size={15} />
            JSON
          </button>
        </div>
      </div>

      {!completion.complete && (
        <section className="report-incomplete no-print">
          <span className="report-incomplete__icon">
            <AlertTriangle size={18} />
          </span>
          <div className="report-incomplete__copy">
            <strong>Incomplete reconstruction data</strong>
            <p>
              {completion.completedCount} of {completion.totalCount} checks pass. Review the
              remaining case information before treating this report as final.
            </p>
          </div>
          <div className="report-incomplete__actions">
            <Link to={`/cases/${accidentCase.id}`}>Review checklist</Link>
            <Link to={`/cases/${accidentCase.id}/reconstruction`}>
              Continue reconstruction
            </Link>
          </div>
        </section>
      )}

      <article className="report-document">
        <header className="report-document__header">
          <div className="report-document__brand">
            <span className="report-document__mark">RS</span>
            <div>
              <p>RoadSafe AR</p>
              <small>Accident investigation workspace</small>
            </div>
          </div>

          <div className="report-document__status">
            <span className={completion.complete ? "is-complete" : "is-incomplete"}>
              {completion.complete ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {completion.complete ? "Complete" : `${completionPercent}% complete`}
            </span>
            <small>Generated {new Date().toLocaleString()}</small>
          </div>

          <div className="report-document__title-block">
            <p>Official reconstruction report</p>
            <h1>Accident Reconstruction Report</h1>
            <span>{accidentCase.title || accidentCase.caseNumber}</span>
          </div>
        </header>

        <section className="report-summary-grid">
          <ReportValue label="Case number" value={accidentCase.caseNumber} />
          <ReportValue label="Case status" value={accidentCase.status} />
          <ReportValue label="Accident date" value={accidentCase.accidentDate} />
          <ReportValue label="Accident time" value={accidentCase.accidentTime} />
          <ReportValue label="Location" value={accidentCase.location || "Not recorded"} />
          <ReportValue label="Junction ID" value={accidentCase.junctionId || "Not linked"} />
          <ReportValue
            label="Investigating officer"
            value={accidentCase.investigatingOfficer || "Not recorded"}
          />
          <ReportValue
            label="Police station"
            value={accidentCase.policeStation || "Not recorded"}
          />
        </section>

        <section className="report-metrics" aria-label="Report record totals">
          <ReportMetric icon={<Users size={16} />} label="Participants" value={participantCount} />
          <ReportMetric icon={<FileSearch size={16} />} label="Evidence" value={evidenceCount} />
          <ReportMetric icon={<Ruler size={16} />} label="Measurements" value={measurementCount} />
          <ReportMetric icon={<Video size={16} />} label="Footage" value={footageCount} />
        </section>

        <ReportSection icon={<FileText size={16} />} title="Case Summary">
          <p className="report-body-copy">
            {accidentCase.summary || "No case summary recorded."}
          </p>
        </ReportSection>

        <ReportSection icon={<MapPinned size={16} />} title="Scene and Environmental Conditions">
          {reconstruction ? (
            <div className="report-value-grid">
              <ReportValue
                label="Scene environment"
                value={reconstruction.scene.sceneEnvironment}
              />
              <ReportValue
                label="Ground classification"
                value={reconstruction.scene.groundSurface}
              />
              {usesGeneratedRoad(reconstruction.scene) && (
                <>
                  <ReportValue label="Road layout" value={reconstruction.scene.roadLayout} />
                  <ReportValue label="Lanes" value={String(reconstruction.scene.laneCount)} />
                  <ReportValue label="Driving side" value={reconstruction.scene.drivingSide} />
                  <ReportValue
                    label="Speed limit"
                    value={`${reconstruction.scene.speedLimitKmh} km/h`}
                  />
                  <ReportValue
                    label="Road surface"
                    value={reconstruction.scene.roadSurface}
                  />
                  <ReportValue
                    label="Traffic volume"
                    value={reconstruction.scene.trafficVolume}
                  />
                </>
              )}
              <ReportValue label="Weather" value={reconstruction.scene.weather} />
              <ReportValue label="Visibility" value={reconstruction.scene.visibility} />
              <ReportValue label="Time of day" value={reconstruction.scene.timeOfDay} />
              {reconstruction.siteCoordinate && (
                <ReportValue
                  label="Real scene coordinate"
                  value={`${reconstruction.siteCoordinate.latitude.toFixed(6)}, ${reconstruction.siteCoordinate.longitude.toFixed(6)}`}
                />
              )}
            </div>
          ) : (
            <ReportEmpty>No reconstruction is linked.</ReportEmpty>
          )}
        </ReportSection>

        <ReportSection icon={<Users size={16} />} title="Participants">
          <ReportTable
            headings={["Name", "Type", "Came from", "Heading to", "Speed"]}
            rows={
              reconstruction?.vehicles.map((participant) => [
                participant.name,
                participant.type,
                participant.originLocation || "Not recorded",
                participant.destinationLocation || "Not recorded",
                `${participant.estimatedSpeedKmh} km/h`,
              ]) ?? []
            }
            empty="No participants recorded."
          />
        </ReportSection>

        <ReportSection icon={<FileText size={16} />} title="Generated Accident Narrative">
          <div className="report-paragraphs">
            {report.narrative.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
            ))}
          </div>
        </ReportSection>

        <ReportSection icon={<Clock3 size={16} />} title="Accident Timeline">
          <ReportTable
            headings={["Time", "Event", "Description", "Source"]}
            rows={report.timeline.map((entry) => [
              `${entry.timeSeconds.toFixed(2)}s`,
              entry.title,
              entry.description,
              entry.source,
            ])}
            empty="No timeline events recorded."
          />
        </ReportSection>

        <ReportSection icon={<Navigation size={16} />} title="Scene Objects and Road Hazards">
          <RecordList
            empty="No scene objects recorded."
            items={
              reconstruction?.sceneObjects.map(
                (object) => `${object.label} — ${object.type}; severity: ${object.severity}`,
              ) ?? []
            }
          />
        </ReportSection>

        <ReportSection icon={<FileSearch size={16} />} title="Evidence Records">
          <RecordList
            empty="No evidence records recorded."
            items={
              reconstruction?.evidenceRecords.map(
                (evidence) =>
                  `E-${String(evidence.evidenceNumber).padStart(2, "0")} ${evidence.title} — ${evidence.category}; ${evidence.status}. ${evidence.description}`,
              ) ?? []
            }
          />
        </ReportSection>

        <ReportSection icon={<Ruler size={16} />} title="Measurements">
          <RecordList
            empty="No measurements recorded."
            items={
              reconstruction?.measurements.map(
                (measurement) =>
                  `M-${String(measurement.measurementNumber).padStart(2, "0")} ${measurement.label}: ${measurement.distanceMetres.toFixed(2)} metres`,
              ) ?? []
            }
          />
        </ReportSection>

        <ReportSection icon={<Gauge size={16} />} title="Field GPS Placement Audit">
          {reconstruction?.fieldCalibration ? (
            <div className="report-audit-card">
              <div className="report-audit-card__icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <strong>Physical scene calibration</strong>
                <p>
                  Road bearing: {reconstruction.fieldCalibration.rotationDegrees.toFixed(1)}° ·
                  Direction reference: {reconstruction.fieldCalibration.directionReferenceDistanceMetres.toFixed(1)}m ·
                  Y-axis side: {reconstruction.fieldCalibration.yAxisSide}
                </p>
                <small>
                  Captured by {reconstruction.fieldCalibration.createdBy || "Not recorded"} on{" "}
                  {new Date(reconstruction.fieldCalibration.createdAt).toLocaleString()}.
                </small>
              </div>
            </div>
          ) : (
            <ReportEmpty>No physical scene calibration recorded.</ReportEmpty>
          )}

          <RecordList
            empty="No GPS field positions recorded."
            items={
              reconstruction?.fieldPlacements.map(
                (placement) =>
                  `${placement.targetLabel}: ${placement.coordinate.latitude.toFixed(7)}, ${placement.coordinate.longitude.toFixed(7)}; estimated uncertainty ±${(placement.estimatedUncertaintyMetres ?? placement.averageAccuracyMetres).toFixed(1)}m${placement.observedSpreadMetres === undefined ? "" : `; observed spread ${placement.observedSpreadMetres.toFixed(1)}m`}; ${placement.method}; ${placement.sampleCount} accepted sample(s)${placement.rejectedSamples?.length ? `; ${placement.rejectedSamples.length} rejected sample(s)` : ""}${placement.acceptedPoorAccuracy ? "; poor accuracy explicitly accepted" : ""}${placement.manuallyAdjusted ? "; manually adjusted afterward" : ""}.`,
              ) ?? []
            }
          />
        </ReportSection>

        <ReportSection icon={<Activity size={16} />} title="Field Walking Traces and Boundaries">
          <RecordList
            empty="No walking traces recorded."
            items={
              reconstruction?.fieldWalkingTracks.map(
                (track) =>
                  `${track.targetLabel}: ${track.captureMode ?? "Line"}, ${track.coordinates.length} processed GPS points${track.rejectedCoordinates?.length ? `, ${track.rejectedCoordinates.length} rejected` : ""}, ${track.distanceMetres.toFixed(2)} metres${track.areaSquareMetres === undefined ? "" : `, area ${track.areaSquareMetres.toFixed(2)}m²`}, estimated uncertainty ±${(track.estimatedUncertaintyMetres ?? track.averageAccuracyMetres).toFixed(1)}m.`,
              ) ?? []
            }
          />
        </ReportSection>

        <ReportSection icon={<Camera size={16} />} title="Scene Photograph Appendix">
          {reconstruction && reconstruction.photos.length > 0 ? (
            <div className="report-photo-grid">
              {reconstruction.photos.map((photo, index) => (
                <figure key={photo.id} className="report-photo-card">
                  <img
                    src={photo.dataUrl || photo.thumbnailDataUrl}
                    alt={photo.caption || photo.filename}
                  />
                  <figcaption>
                    <strong>Photo {index + 1}</strong>
                    <span>{photo.caption || photo.filename}</span>
                    <small>Bearing: {photo.bearingDegrees}°</small>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <ReportEmpty>No scene photographs attached.</ReportEmpty>
          )}
        </ReportSection>

        <ReportSection icon={<Video size={16} />} title="Reconstruction Footage">
          {report.footage.length > 0 ? (
            <div className="report-footage-list">
              {report.footage.map((footage) => (
                <article key={footage.id} className="report-footage-item">
                  <span className="report-footage-item__icon">
                    <Video size={16} />
                  </span>
                  <div>
                    <strong>
                      {footage.title} {footage.isPrimary ? "· Primary" : ""}
                    </strong>
                    <small>
                      {footage.durationSeconds.toFixed(2)} seconds · {footage.fileName} · Recorded{" "}
                      {new Date(footage.recordedAt).toLocaleString()}
                    </small>
                  </div>
                  <Link
                    to={`/cases/${accidentCase.id}/footage/${footage.id}`}
                    className="no-print"
                  >
                    Play footage
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <ReportEmpty>No reconstruction footage recorded.</ReportEmpty>
          )}
        </ReportSection>

        <ReportSection icon={<ListChecks size={16} />} title="Reconstruction Findings">
          <RecordList items={report.findings} />
        </ReportSection>

        <ReportSection icon={<Lightbulb size={16} />} title="Safety Recommendations">
          <RecordList items={report.recommendations} />
        </ReportSection>

        <ReportSection icon={<AlertTriangle size={16} />} title="Limitations and Disclaimer">
          <RecordList items={report.limitations} />
        </ReportSection>

        <footer className="report-document__footer">
          <div>
            <span className="report-document__mark report-document__mark--small">RS</span>
            <div>
              <strong>RoadSafe AR</strong>
              <small>Physics-assisted accident reconstruction report</small>
            </div>
          </div>
          <p>
            Generated on {new Date().toLocaleString()} · This prototype output requires
            professional verification.
          </p>
        </footer>
      </article>
    </main>
  );
}

function ReportSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="report-section">
      <header className="report-section__header">
        <span>{icon}</span>
        <h2>{title}</h2>
      </header>
      <div className="report-section__body">{children}</div>
    </section>
  );
}

function ReportValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-value">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function ReportMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <article className="report-metric">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

function ReportTable({
  headings,
  rows,
  empty,
}: {
  headings: string[];
  rows: string[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <ReportEmpty>{empty}</ReportEmpty>;
  }

  return (
    <div className="report-table-wrap">
      <table className="report-table">
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row[0]}`}>
              {row.map((value, columnIndex) => (
                <td key={`${columnIndex}-${value.slice(0, 24)}`}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportEmpty({ children }: { children: ReactNode }) {
  return <p className="report-empty">{children}</p>;
}

function RecordList({
  items,
  empty = "No records available.",
}: {
  items: string[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <ReportEmpty>{empty}</ReportEmpty>;
  }

  return (
    <ul className="report-record-list">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 20)}`}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <p>{item}</p>
        </li>
      ))}
    </ul>
  );
}
