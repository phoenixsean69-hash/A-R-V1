import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import { AccidentCaseService } from "../services/accidentCaseService";
import { AccidentReportService } from "../services/accidentReportService";

export default function AccidentReportPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const accidentCase = caseId ? AccidentCaseService.getById(caseId) : null;

  if (!accidentCase) {
    return (
      <div className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-black text-slate-900">Case not found</h1>
          <Link to="/cases" className="mt-5 inline-block font-bold text-blue-700">
            Return to cases
          </Link>
        </div>
      </div>
    );
  }

  const reconstruction = AccidentCaseService.getLinkedReconstruction(
    accidentCase,
  );
  const completion = AccidentCaseService.getCompletion(accidentCase);
  const report = AccidentReportService.build(accidentCase, reconstruction);

  return (
    <div className="min-h-screen bg-slate-200 p-4 print:bg-white print:p-0 lg:p-8">
      <style>{`@media print { .no-print { display: none !important; } .report-page { box-shadow: none !important; max-width: none !important; } }`}</style>

      <div className="no-print mx-auto mb-5 flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link
          to={`/cases/${accidentCase.id}`}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
        >
          ← Back to Case
        </Link>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Print / Save PDF
          </button>
          <button
            type="button"
            onClick={() => AccidentReportService.downloadWord(report)}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white"
          >
            Download Word
          </button>
          <button
            type="button"
            onClick={() => AccidentReportService.downloadJson(report)}
            className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white"
          >
            Export JSON
          </button>
        </div>
      </div>

      {!completion.complete && (
        <div className="no-print mx-auto mb-5 max-w-5xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-black">This report is based on an incomplete reconstruction.</p>
          <p className="mt-1 leading-6">
            {completion.completedCount} of {completion.totalCount} completion checks currently pass.
            Return to the case or reconstruction to complete the missing information.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to={`/cases/${accidentCase.id}`}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-black text-white"
            >
              Review Case Checklist
            </Link>
            <Link
              to={`/cases/${accidentCase.id}/reconstruction`}
              className="rounded-lg border border-amber-400 bg-white px-3 py-2 text-xs font-black text-amber-800"
            >
              Continue Reconstruction
            </Link>
          </div>
        </div>
      )}

      <article className="report-page mx-auto max-w-5xl bg-white p-7 shadow-xl print:p-0">
        <header className="border-b-4 border-blue-800 pb-5">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-700">
            RoadSafe AR
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            Accident Reconstruction Report
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Generated from the RoadSafe AR investigation workspace
          </p>
        </header>

        <section className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-5 text-sm sm:grid-cols-2">
          <p><strong>Case Number:</strong> {accidentCase.caseNumber}</p>
          <p><strong>Status:</strong> {accidentCase.status}</p>
          <p><strong>Date:</strong> {accidentCase.accidentDate}</p>
          <p><strong>Time:</strong> {accidentCase.accidentTime}</p>
          <p><strong>Location:</strong> {accidentCase.location}</p>
          <p><strong>Junction ID:</strong> {accidentCase.junctionId || "Not linked"}</p>
          <p><strong>Officer:</strong> {accidentCase.investigatingOfficer || "Not recorded"}</p>
          <p><strong>Police Station:</strong> {accidentCase.policeStation || "Not recorded"}</p>
        </section>

        <ReportSection title="Case Summary">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {accidentCase.summary || "No case summary recorded."}
          </p>
        </ReportSection>

        <ReportSection title="Road and Environmental Conditions">
          {reconstruction ? (
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <ReportValue label="Road layout" value={reconstruction.scene.roadLayout} />
              <ReportValue label="Lanes" value={String(reconstruction.scene.laneCount)} />
              <ReportValue label="Driving side" value={reconstruction.scene.drivingSide} />
              <ReportValue label="Speed limit" value={`${reconstruction.scene.speedLimitKmh} km/h`} />
              <ReportValue label="Weather" value={reconstruction.scene.weather} />
              <ReportValue label="Road surface" value={reconstruction.scene.roadSurface} />
              <ReportValue label="Visibility" value={reconstruction.scene.visibility} />
              <ReportValue label="Traffic volume" value={reconstruction.scene.trafficVolume} />
              <ReportValue label="Time of day" value={reconstruction.scene.timeOfDay} />
            </div>
          ) : (
            <p className="text-sm text-slate-600">No reconstruction is linked.</p>
          )}
        </ReportSection>

        <ReportSection title="Participants">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-slate-300 p-2">Name</th>
                  <th className="border border-slate-300 p-2">Type</th>
                  <th className="border border-slate-300 p-2">Came From</th>
                  <th className="border border-slate-300 p-2">Heading To</th>
                  <th className="border border-slate-300 p-2">Speed</th>
                </tr>
              </thead>
              <tbody>
                {reconstruction?.vehicles.map((participant) => (
                  <tr key={participant.id}>
                    <td className="border border-slate-300 p-2">{participant.name}</td>
                    <td className="border border-slate-300 p-2">{participant.type}</td>
                    <td className="border border-slate-300 p-2">{participant.originLocation || "Not recorded"}</td>
                    <td className="border border-slate-300 p-2">{participant.destinationLocation || "Not recorded"}</td>
                    <td className="border border-slate-300 p-2">{participant.estimatedSpeedKmh} km/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection title="Generated Accident Narrative">
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            {report.narrative.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
            ))}
          </div>
        </ReportSection>

        <ReportSection title="Accident Timeline">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-blue-50">
                  <th className="border border-slate-300 p-2">Time</th>
                  <th className="border border-slate-300 p-2">Event</th>
                  <th className="border border-slate-300 p-2">Description</th>
                  <th className="border border-slate-300 p-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {report.timeline.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border border-slate-300 p-2">{entry.timeSeconds.toFixed(2)}s</td>
                    <td className="border border-slate-300 p-2">{entry.title}</td>
                    <td className="border border-slate-300 p-2">{entry.description}</td>
                    <td className="border border-slate-300 p-2">{entry.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ReportSection>

        <ReportSection title="Scene Objects and Road Hazards">
          <RecordList
            empty="No scene objects recorded."
            items={reconstruction?.sceneObjects.map(
              (object) => `${object.label} — ${object.type}; severity: ${object.severity}`,
            ) ?? []}
          />
        </ReportSection>

        <ReportSection title="Evidence Records">
          <RecordList
            empty="No evidence records recorded."
            items={reconstruction?.evidenceRecords.map(
              (evidence) => `E-${String(evidence.evidenceNumber).padStart(2, "0")} ${evidence.title} — ${evidence.category}; ${evidence.status}. ${evidence.description}`,
            ) ?? []}
          />
        </ReportSection>

        <ReportSection title="Measurements">
          <RecordList
            empty="No measurements recorded."
            items={reconstruction?.measurements.map(
              (measurement) => `M-${String(measurement.measurementNumber).padStart(2, "0")} ${measurement.label}: ${measurement.distanceMetres.toFixed(2)} metres`,
            ) ?? []}
          />
        </ReportSection>

        <ReportSection title="Field GPS Placement Audit">
          {reconstruction?.fieldCalibration ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <p className="font-black">Physical scene calibration</p>
              <p className="mt-1">Road bearing: {reconstruction.fieldCalibration.rotationDegrees.toFixed(1)}° · Direction reference: {reconstruction.fieldCalibration.directionReferenceDistanceMetres.toFixed(1)}m · Y-axis side: {reconstruction.fieldCalibration.yAxisSide}</p>
              <p className="mt-1 text-xs">Captured by {reconstruction.fieldCalibration.createdBy || "Not recorded"} on {new Date(reconstruction.fieldCalibration.createdAt).toLocaleString()}.</p>
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-600">No physical scene calibration recorded.</p>
          )}

          <RecordList
            empty="No GPS field positions recorded."
            items={reconstruction?.fieldPlacements.map(
              (placement) => `${placement.targetLabel}: ${placement.coordinate.latitude.toFixed(7)}, ${placement.coordinate.longitude.toFixed(7)}; estimated uncertainty ±${(placement.estimatedUncertaintyMetres ?? placement.averageAccuracyMetres).toFixed(1)}m${placement.observedSpreadMetres === undefined ? "" : `; observed spread ${placement.observedSpreadMetres.toFixed(1)}m`}; ${placement.method}; ${placement.sampleCount} accepted sample(s)${placement.rejectedSamples?.length ? `; ${placement.rejectedSamples.length} rejected sample(s)` : ""}${placement.acceptedPoorAccuracy ? "; poor accuracy explicitly accepted" : ""}${placement.manuallyAdjusted ? "; manually adjusted afterward" : ""}.`,
            ) ?? []}
          />
        </ReportSection>

        <ReportSection title="Field Walking Traces and Boundaries">
          <RecordList
            empty="No walking traces recorded."
            items={reconstruction?.fieldWalkingTracks.map(
              (track) => `${track.targetLabel}: ${track.captureMode ?? "Line"}, ${track.coordinates.length} processed GPS points${track.rejectedCoordinates?.length ? `, ${track.rejectedCoordinates.length} rejected` : ""}, ${track.distanceMetres.toFixed(2)} metres${track.areaSquareMetres === undefined ? "" : `, area ${track.areaSquareMetres.toFixed(2)}m²`}, estimated uncertainty ±${(track.estimatedUncertaintyMetres ?? track.averageAccuracyMetres).toFixed(1)}m.`,
            ) ?? []}
          />
        </ReportSection>

        <ReportSection title="Scene Photograph Appendix">
          {reconstruction && reconstruction.photos.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {reconstruction.photos.map((photo, index) => (
                <figure key={photo.id} className="rounded-xl border border-slate-200 p-3">
                  <img
                    src={photo.dataUrl || photo.thumbnailDataUrl}
                    alt={photo.caption || photo.filename}
                    className="h-56 w-full rounded-lg object-cover"
                  />
                  <figcaption className="mt-2 text-xs text-slate-600">
                    Photo {index + 1}: {photo.caption || photo.filename}. Bearing: {photo.bearingDegrees}°.
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No scene photographs attached.</p>
          )}
        </ReportSection>

        <ReportSection title="Reconstruction Footage">
          {report.footage.length > 0 ? (
            <div className="space-y-3">
              {report.footage.map((footage) => (
                <div
                  key={footage.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div>
                    <p className="font-black text-slate-900">
                      {footage.title} {footage.isPrimary ? "— Primary" : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {footage.durationSeconds.toFixed(2)} seconds · {footage.fileName} · Recorded {new Date(footage.recordedAt).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    to={`/cases/${accidentCase.id}/footage/${footage.id}`}
                    className="no-print rounded-lg bg-indigo-600 px-3 py-2 text-xs font-black text-white"
                  >
                    Play Footage
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No reconstruction footage recorded.</p>
          )}
        </ReportSection>

        <ReportSection title="Reconstruction Findings">
          <RecordList items={report.findings} />
        </ReportSection>

        <ReportSection title="Safety Recommendations">
          <RecordList items={report.recommendations} />
        </ReportSection>

        <ReportSection title="Limitations and Disclaimer">
          <RecordList items={report.limitations} />
        </ReportSection>

        <footer className="mt-10 border-t border-slate-300 pt-4 text-xs text-slate-500">
          Generated on {new Date().toLocaleString()} · RoadSafe AR prototype
        </footer>
      </article>
    </div>
  );
}

function ReportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="border-b border-slate-300 pb-2 text-xl font-black text-blue-900">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ReportValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function RecordList({
  items,
  empty = "No records available.",
}: {
  items: string[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-600">{empty}</p>;
  }

  return (
    <ul className="list-disc space-y-2 pl-6 text-sm leading-6 text-slate-700">
      {items.map((item, index) => (
        <li key={`${index}-${item.slice(0, 20)}`}>{item}</li>
      ))}
    </ul>
  );
}
