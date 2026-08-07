import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import CaseForm from "../components/cases/CaseForm";
import ForensicCaseAreaWizard from "../components/cases/ForensicCaseAreaWizard";

import {
  AccidentCaseService,
} from "../services/accidentCaseService";

import type {
  AccidentCaseFormValues,
} from "../types/accidentCase";

import "./accidentCaseFormPage.css";

function getDefaultValues():
  AccidentCaseFormValues {
  return {
    caseNumber:
      AccidentCaseService.generateNextCaseNumber(),
    title: "",
    accidentDate:
      new Date()
        .toISOString()
        .slice(
          0,
          10,
        ),
    accidentTime:
      new Date()
        .toTimeString()
        .slice(
          0,
          5,
        ),
    location: "",
    junctionId: "",
    investigatingOfficer:
      "",
    policeStation: "",
    status: "Open",
    summary: "",
  };
}

export default function AccidentCaseFormPage() {
  const navigate =
    useNavigate();

  const {
    caseId,
  } =
    useParams<{
      caseId: string;
    }>();

  const existing =
    caseId
      ? AccidentCaseService.getById(
          caseId,
        )
      : null;

  const initialValues:
    AccidentCaseFormValues =
    existing
      ? {
          caseNumber:
            existing.caseNumber,
          title:
            existing.title,
          accidentDate:
            existing.accidentDate,
          accidentTime:
            existing.accidentTime,
          location:
            existing.location,
          junctionId:
            existing.junctionId ??
            "",
          investigatingOfficer:
            existing.investigatingOfficer,
          policeStation:
            existing.policeStation,
          status:
            existing.status,
          summary:
            existing.summary,
        }
      : getDefaultValues();

  /*
   * New Case is now a workstation flow.
   *
   * Do not wrap ForensicCaseAreaWizard in the old page/card/max-width shell:
   * AppShell already owns the centre workspace. The forensic wizard therefore
   * mounts directly into that workspace.
   */
  if (!existing) {
    return (
      <main className="roadsafe-new-case-page">
        <header className="roadsafe-new-case-page__header">
          <div className="roadsafe-new-case-page__intro">
            <span className="roadsafe-new-case-page__eyebrow">
              RoadSafe AR
            </span>

            <h1>
              Create a Location-Based Accident Case
            </h1>

            <p>
              RoadSafe freezes the forensic core and context boundary,
              archives source payloads, builds metric geometry and terrain
              evidence, runs quality assurance, and creates the linked
              reconstruction only after investigator review.
            </p>
          </div>

          <Link
            to="/cases"
            className="roadsafe-new-case-page__back"
            aria-label="Back to accident cases"
          >
            <span aria-hidden="true">
              ←
            </span>

            <span>
              Back
            </span>
          </Link>
        </header>

        <ForensicCaseAreaWizard
          initialValues={
            initialValues
          }
        />
      </main>
    );
  }

  /*
   * Existing-case editing remains on the legacy form path for now. This keeps
   * the geospatial replacement focused on new-case creation.
   */
  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#c4c4c4]">
              RoadSafe AR
            </p>

            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Edit Accident Case
            </h1>
          </div>

          <Link
            to={`/cases/${existing.id}`}
            className="rounded-sm border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"
          >
            ← Back
          </Link>
        </div>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <CaseForm
            initialValues={
              initialValues
            }
            submitLabel="Save Changes"
            onSubmit={(
              values,
            ) => {
              const requestedStatus =
                values.status;

              let saved =
                AccidentCaseService.save({
                  ...existing,
                  ...values,
                  status:
                    existing.status,
                  junctionId:
                    values.junctionId.trim() ||
                    undefined,
                });

              if (
                requestedStatus !==
                existing.status
              ) {
                const statusResult =
                  AccidentCaseService.setStatus(
                    saved.id,
                    requestedStatus,
                  );

                if (
                  statusResult &&
                  !statusResult.blocked
                ) {
                  saved =
                    statusResult.record;
                }
              }

              navigate(
                `/cases/${saved.id}`,
              );
            }}
          />
        </section>
      </div>
    </div>
  );
}
