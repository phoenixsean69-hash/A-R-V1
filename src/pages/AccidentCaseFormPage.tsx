import { Link, useNavigate, useParams } from "react-router-dom";

import CaseForm from "../components/cases/CaseForm";
import NewCaseRoadWizard from "../components/cases/NewCaseRoadWizard";

import { AccidentCaseService } from "../services/accidentCaseService";
import type { AccidentCaseFormValues } from "../types/accidentCase";

function getDefaultValues(): AccidentCaseFormValues {
  return {
    caseNumber: AccidentCaseService.generateNextCaseNumber(),
    title: "",
    accidentDate: new Date().toISOString().slice(0, 10),
    accidentTime: new Date().toTimeString().slice(0, 5),
    location: "",
    junctionId: "",
    investigatingOfficer: "",
    policeStation: "",
    status: "Open",
    summary: "",
  };
}

export default function AccidentCaseFormPage() {
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId: string }>();
  const existing = caseId ? AccidentCaseService.getById(caseId) : null;

  const initialValues: AccidentCaseFormValues = existing
    ? {
        caseNumber: existing.caseNumber,
        title: existing.title,
        accidentDate: existing.accidentDate,
        accidentTime: existing.accidentTime,
        location: existing.location,
        junctionId: existing.junctionId ?? "",
        investigatingOfficer: existing.investigatingOfficer,
        policeStation: existing.policeStation,
        status: existing.status,
        summary: existing.summary,
      }
    : getDefaultValues();

  return (
    <div className="min-h-screen bg-slate-100 p-4 lg:p-8">
      <div className={existing ? "mx-auto max-w-4xl" : "mx-auto max-w-7xl"}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-600">
              RoadSafe AR
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              {existing ? "Edit Accident Case" : "Create a Location-Based Accident Case"}
            </h1>
            {!existing && (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                RoadSafe AR will confirm the officer’s position, fetch nearby road data, suggest the junction layout and create the linked 2D reconstruction only after officer approval.
              </p>
            )}
          </div>

          <Link
            to={existing ? `/cases/${existing.id}` : "/cases"}
            className="rounded-sm border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
          >
            ← Back
          </Link>
        </div>

        {!existing ? (
          <NewCaseRoadWizard initialValues={initialValues} />
        ) : (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <CaseForm
              initialValues={initialValues}
              submitLabel="Save Changes"
              onSubmit={(values) => {
                const requestedStatus = values.status;
                let saved = AccidentCaseService.save({
                  ...existing,
                  ...values,
                  status: existing.status,
                  junctionId: values.junctionId.trim() || undefined,
                });

                if (requestedStatus !== existing.status) {
                  const statusResult = AccidentCaseService.setStatus(
                    saved.id,
                    requestedStatus,
                  );

                  if (statusResult && !statusResult.blocked) {
                    saved = statusResult.record;
                  }
                }

                navigate(`/cases/${saved.id}`);
              }}
            />
          </section>
        )}
      </div>
    </div>
  );
}
