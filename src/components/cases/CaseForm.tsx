import { useState } from "react";

import type {
  AccidentCaseFormValues,
  AccidentCaseStatus,
} from "../../types/accidentCase";

import {
  ACCIDENT_CASE_STATUSES,
} from "../../types/accidentCase";

interface CaseFormProps {
  initialValues: AccidentCaseFormValues;
  submitLabel: string;
  onSubmit: (values: AccidentCaseFormValues) => void;
}

interface CaseFormErrors {
  caseNumber?: string;
  title?: string;
  accidentDate?: string;
  accidentTime?: string;
  location?: string;
}

export default function CaseForm({
  initialValues,
  submitLabel,
  onSubmit,
}: CaseFormProps) {
  const [values, setValues] = useState<AccidentCaseFormValues>(initialValues);
  const [errors, setErrors] = useState<CaseFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = <Key extends keyof AccidentCaseFormValues>(
    field: Key,
    value: AccidentCaseFormValues[Key],
  ) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const validate = (): boolean => {
    const nextErrors: CaseFormErrors = {};

    if (!values.caseNumber.trim()) {
      nextErrors.caseNumber = "Case number is required.";
    }

    if (!values.title.trim()) {
      nextErrors.title = "Case title is required.";
    }

    if (!values.accidentDate) {
      nextErrors.accidentDate = "Accident date is required.";
    }

    if (!values.accidentTime) {
      nextErrors.accidentTime = "Accident time is required.";
    }

    if (!values.location.trim()) {
      nextErrors.location = "Accident location is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();

        if (!validate()) {
          return;
        }

        setSubmitting(true);

        try {
          onSubmit({
            ...values,
            caseNumber: values.caseNumber.trim(),
            title: values.title.trim(),
            location: values.location.trim(),
            junctionId: values.junctionId.trim(),
            investigatingOfficer: values.investigatingOfficer.trim(),
            policeStation: values.policeStation.trim(),
            summary: values.summary.trim(),
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Case number" error={errors.caseNumber}>
          <input
            value={values.caseNumber}
            onChange={(event) => updateField("caseNumber", event.target.value)}
            className={inputClass(Boolean(errors.caseNumber))}
            placeholder="RSA-2026-0001"
          />
        </Field>

        <Field label="Case status">
          <select
            value={values.status}
            onChange={(event) =>
              updateField(
                "status",
                event.target.value as AccidentCaseStatus,
              )
            }
            className={inputClass(false)}
          >
            {ACCIDENT_CASE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Case title" error={errors.title}>
        <input
          value={values.title}
          onChange={(event) => updateField("title", event.target.value)}
          className={inputClass(Boolean(errors.title))}
          placeholder="Example: Two-vehicle collision at Bindura junction"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Accident date" error={errors.accidentDate}>
          <input
            type="date"
            value={values.accidentDate}
            onChange={(event) => updateField("accidentDate", event.target.value)}
            className={inputClass(Boolean(errors.accidentDate))}
          />
        </Field>

        <Field label="Accident time" error={errors.accidentTime}>
          <input
            type="time"
            value={values.accidentTime}
            onChange={(event) => updateField("accidentTime", event.target.value)}
            className={inputClass(Boolean(errors.accidentTime))}
          />
        </Field>
      </div>

      <Field label="Accident location" error={errors.location}>
        <input
          value={values.location}
          onChange={(event) => updateField("location", event.target.value)}
          className={inputClass(Boolean(errors.location))}
          placeholder="Example: Bindura Pick n Pay Turn-off"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Junction ID">
          <input
            value={values.junctionId}
            onChange={(event) => updateField("junctionId", event.target.value)}
            className={inputClass(false)}
            placeholder="Optional junction reference"
          />
        </Field>

        <Field label="Investigating officer">
          <input
            value={values.investigatingOfficer}
            onChange={(event) =>
              updateField("investigatingOfficer", event.target.value)
            }
            className={inputClass(false)}
            placeholder="Officer name"
          />
        </Field>
      </div>

      <Field label="Police station">
        <input
          value={values.policeStation}
          onChange={(event) => updateField("policeStation", event.target.value)}
          className={inputClass(false)}
          placeholder="Example: Bindura Central Police Station"
        />
      </Field>

      <Field label="Initial case summary">
        <textarea
          rows={6}
          value={values.summary}
          onChange={(event) => updateField("summary", event.target.value)}
          className={`${inputClass(false)} resize-y`}
          placeholder="Describe the reported accident, known participants and initial observations."
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <div className="mt-2">{children}</div>
      {error && (
        <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>
      )}
    </label>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-sm border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:ring-2 ${
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-slate-300 focus:border-blue-500 focus:ring-blue-100"
  }`;
}
