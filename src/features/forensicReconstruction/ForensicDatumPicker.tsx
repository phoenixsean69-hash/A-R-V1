
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import type {
  AccidentCase,
} from "../../types/accidentCase";

import type {
  ForensicSceneDatum,
} from "./forensicInvestigationTypes";

interface Props {
  accidentCase: AccidentCase;
  currentDatum?: ForensicSceneDatum;
  onCancel(): void;
  onConfirm(
    datum: ForensicSceneDatum,
  ): void;
}

interface LiveFix {
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  altitudeMetres?: number;
  altitudeAccuracyMetres?: number;
  timestamp: number;
}

interface CapturedFix {
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  bestAccuracyMetres: number;
  worstAccuracyMetres: number;
  altitudeMetres?: number;
  altitudeAccuracyMetres?: number;
  sampleCount: number;
  captureDurationSeconds: number;
  positionTimestamp: number;
}

type LocationStatus =
  | "idle"
  | "locating"
  | "ready"
  | "capturing"
  | "captured"
  | "error";

const TARGET_SAMPLES = 8;
const CAPTURE_WINDOW_MS = 12_000;
const MIN_SAMPLES = 3;

function positionToFix(
  position: GeolocationPosition,
): LiveFix {
  const altitude =
    position.coords.altitude;

  const altitudeAccuracy =
    position.coords.altitudeAccuracy;

  return {
    latitude:
      position.coords.latitude,
    longitude:
      position.coords.longitude,
    accuracyMetres:
      position.coords.accuracy,
    altitudeMetres:
      altitude === null
        ? undefined
        : altitude,
    altitudeAccuracyMetres:
      altitudeAccuracy === null
        ? undefined
        : altitudeAccuracy,
    timestamp:
      position.timestamp,
  };
}

function weightedAverage(
  samples: LiveFix[],
): {
  latitude: number;
  longitude: number;
} {
  let weightedLatitude = 0;
  let weightedLongitude = 0;
  let totalWeight = 0;

  samples.forEach(
    (sample) => {
      const accuracy =
        Math.max(
          1,
          sample.accuracyMetres,
        );

      const weight =
        1 / (accuracy * accuracy);

      weightedLatitude +=
        sample.latitude * weight;
      weightedLongitude +=
        sample.longitude * weight;
      totalWeight += weight;
    },
  );

  return {
    latitude:
      weightedLatitude /
      Math.max(
        totalWeight,
        Number.EPSILON,
      ),
    longitude:
      weightedLongitude /
      Math.max(
        totalWeight,
        Number.EPSILON,
      ),
  };
}

function median(
  values: number[],
): number {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort(
    (left, right) =>
      left - right,
  );

  const middle = Math.floor(
    sorted.length / 2,
  );

  if (
    sorted.length % 2 === 0
  ) {
    return (
      sorted[middle - 1] +
      sorted[middle]
    ) / 2;
  }

  return sorted[middle];
}

function buildCapturedFix(
  samples: LiveFix[],
  startedAt: number,
): CapturedFix {
  const averaged =
    weightedAverage(samples);

  const accuracies =
    samples.map(
      (sample) =>
        sample.accuracyMetres,
    );

  const altitudeSamples =
    samples.filter(
      (
        sample,
      ): sample is LiveFix & {
        altitudeMetres: number;
      } =>
        typeof sample.altitudeMetres ===
        "number",
    );

  const altitudeAccuracySamples =
    samples.filter(
      (
        sample,
      ): sample is LiveFix & {
        altitudeAccuracyMetres: number;
      } =>
        typeof sample.altitudeAccuracyMetres ===
        "number",
    );

  return {
    latitude:
      averaged.latitude,
    longitude:
      averaged.longitude,
    accuracyMetres:
      median(accuracies),
    bestAccuracyMetres:
      Math.min(...accuracies),
    worstAccuracyMetres:
      Math.max(...accuracies),
    altitudeMetres:
      altitudeSamples.length
        ? altitudeSamples.reduce(
            (
              total,
              sample,
            ) =>
              total +
              sample.altitudeMetres,
            0,
          ) /
          altitudeSamples.length
        : undefined,
    altitudeAccuracyMetres:
      altitudeAccuracySamples.length
        ? median(
            altitudeAccuracySamples.map(
              (sample) =>
                sample.altitudeAccuracyMetres,
            ),
          )
        : undefined,
    sampleCount:
      samples.length,
    captureDurationSeconds:
      Number(
        (
          (
            Date.now() -
            startedAt
          ) /
          1000
        ).toFixed(1),
      ),
    positionTimestamp:
      samples[
        samples.length - 1
      ]?.timestamp ??
      Date.now(),
  };
}

function accuracyLabel(
  accuracyMetres: number,
): {
  label: string;
  tone: "good" | "warning" | "bad";
  guidance: string;
} {
  if (
    accuracyMetres <= 3
  ) {
    return {
      label:
        "Very good",
      tone: "good",
      guidance:
        "Strong field position for device GNSS.",
    };
  }

  if (
    accuracyMetres <= 5
  ) {
    return {
      label: "Good",
      tone: "good",
      guidance:
        "Usable field position. Preserve the uncertainty.",
    };
  }

  if (
    accuracyMetres <= 10
  ) {
    return {
      label:
        "Caution",
      tone: "warning",
      guidance:
        "Usable with caution. Wait for a cleaner fix if possible.",
    };
  }

  return {
    label: "Poor",
    tone: "bad",
    guidance:
      "Recapture recommended. Accuracy is coarse for scene work.",
    };
}

function accuracyToneClasses(
  tone: "good" | "warning" | "bad",
): string {
  switch (tone) {
    case "good":
      return "border-[#415244] bg-[#132019] text-[#9ed4ae]";
    case "warning":
      return "border-[#6d5523] bg-[#241d10] text-[#dfc27f]";
    case "bad":
      return "border-[#713646] bg-[#321722] text-[#f09aae]";
  }
}

function geolocationErrorMessage(
  error: GeolocationPositionError,
): string {
  switch (
    error.code
  ) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied. Enable location access for RoadSafe and try again.";
    case error.POSITION_UNAVAILABLE:
      return "The device could not determine its current position.";
    case error.TIMEOUT:
      return "The location request timed out before a position was obtained.";
    default:
      return "RoadSafe could not read the device location.";
  }
}

function statusLabel(
  status: LocationStatus,
): string {
  switch (status) {
    case "idle":
      return "Waiting";
    case "locating":
      return "Locating";
    case "ready":
      return "Live";
    case "capturing":
      return "Sampling";
    case "captured":
      return "Captured";
    case "error":
      return "Error";
  }
}

function statusTone(
  status: LocationStatus,
): "neutral" | "good" | "warning" | "bad" {
  switch (status) {
    case "ready":
    case "captured":
      return "good";
    case "locating":
    case "capturing":
      return "warning";
    case "error":
      return "bad";
    default:
      return "neutral";
  }
}

function statusToneClasses(
  tone: "neutral" | "good" | "warning" | "bad",
): string {
  switch (tone) {
    case "neutral":
      return "border-[#4b4b4b] bg-[#2a2a2a] text-slate-300";
    case "good":
      return "border-[#415244] bg-[#132019] text-[#9ed4ae]";
    case "warning":
      return "border-[#6d5523] bg-[#241d10] text-[#dfc27f]";
    case "bad":
      return "border-[#713646] bg-[#321722] text-[#f09aae]";
  }
}

export default function ForensicDatumPicker({
  accidentCase,
  currentDatum,
  onCancel,
  onConfirm,
}: Props) {
  const watchIdRef =
    useRef<number | null>(
      null,
    );

  const captureActiveRef =
    useRef(false);

  const captureStartedAtRef =
    useRef<number | null>(
      null,
    );

  const samplesRef =
    useRef<LiveFix[]>([]);

  const captureTimerRef =
    useRef<number | null>(
      null,
    );

  const [
    label,
    setLabel,
  ] = useState(
    currentDatum?.label ??
      "",
  );

  const [
    status,
    setStatus,
  ] = useState<LocationStatus>(
    "idle",
  );

  const [
    liveFix,
    setLiveFix,
  ] = useState<LiveFix | null>(
    null,
  );

  const [
    capturedFix,
    setCapturedFix,
  ] = useState<CapturedFix | null>(
    currentDatum &&
      typeof
        currentDatum.accuracyMetres ===
        "number"
      ? {
          latitude:
            currentDatum.latitude,
          longitude:
            currentDatum.longitude,
          accuracyMetres:
            currentDatum.accuracyMetres,
          bestAccuracyMetres:
            currentDatum.bestAccuracyMetres ??
            currentDatum.accuracyMetres,
          worstAccuracyMetres:
            currentDatum.worstAccuracyMetres ??
            currentDatum.accuracyMetres,
          altitudeMetres:
            currentDatum.altitudeMetres,
          altitudeAccuracyMetres:
            currentDatum.altitudeAccuracyMetres,
          sampleCount:
            currentDatum.sampleCount ??
            1,
          captureDurationSeconds:
            currentDatum.captureDurationSeconds ??
            0,
          positionTimestamp:
            currentDatum.positionTimestamp
              ? new Date(
                  currentDatum.positionTimestamp,
                ).getTime()
              : Date.now(),
        }
      : null,
  );

  const [
    sampleCount,
    setSampleCount,
  ] = useState(0);

  const [
    message,
    setMessage,
  ] = useState(
    currentDatum
      ? "A previously captured datum is loaded. Recapture only if the officer is standing at the same permanent feature again."
      : "Describe the permanent feature, then enable live location when the officer is at the scene.",
  );

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    permissionChecked,
    setPermissionChecked,
  ] = useState(false);

  const currentAccuracy =
    liveFix?.accuracyMetres ??
    capturedFix?.accuracyMetres ??
    null;

  const currentAccuracyState =
    currentAccuracy ===
    null
      ? null
      : accuracyLabel(
          currentAccuracy,
        );

  const clearCaptureTimer =
    () => {
      if (
        captureTimerRef
          .current !== null
      ) {
        window.clearTimeout(
          captureTimerRef.current,
        );
        captureTimerRef.current =
          null;
      }
    };

  const stopWatch =
    () => {
      if (
        watchIdRef.current !==
          null &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current,
        );
        watchIdRef.current =
          null;
      }
    };

  const finishCapture =
    (
      samples: LiveFix[],
    ) => {
      clearCaptureTimer();
      captureActiveRef.current =
        false;

      if (
        samples.length <
        MIN_SAMPLES
      ) {
        setStatus(
          "ready",
        );
        setMessage(
          "Not enough fresh GNSS samples were received. Stay at the reference point and capture again.",
        );
        return;
      }

      const startedAt =
        captureStartedAtRef.current ??
        Date.now();

      const captured =
        buildCapturedFix(
          samples,
          startedAt,
        );

      setCapturedFix(
        captured,
      );
      setStatus(
        "captured",
      );

      const quality =
        accuracyLabel(
          captured.accuracyMetres,
        );

      setMessage(
        `Capture complete: ${captured.sampleCount} samples, median reported accuracy ±${captured.accuracyMetres.toFixed(
          1,
        )} m (${quality.label}).`,
      );
    };

  const ingestFix =
    (
      fix: LiveFix,
    ) => {
      setLiveFix(fix);

      if (
        !captureActiveRef.current
      ) {
        setStatus(
          "ready",
        );
        return;
      }

      const lastSample =
        samplesRef.current[
          samplesRef.current.length - 1
        ];

      if (
        lastSample &&
        lastSample.timestamp ===
          fix.timestamp
      ) {
        return;
      }

      samplesRef.current = [
        ...samplesRef.current,
        fix,
      ];

      setSampleCount(
        samplesRef.current.length,
      );

      if (
        samplesRef.current.length >=
        TARGET_SAMPLES
      ) {
        finishCapture(
          samplesRef.current,
        );
      }
    };

  const startLocation =
    () => {
      setErrorMessage("");

      if (
        !window.isSecureContext
      ) {
        setStatus(
          "error",
        );
        setErrorMessage(
          "Live GNSS requires a secure context. Open RoadSafe over HTTPS or localhost on the field device.",
        );
        return;
      }

      if (
        !navigator.geolocation
      ) {
        setStatus(
          "error",
        );
        setErrorMessage(
          "This browser/device does not expose the Geolocation API.",
        );
        return;
      }

      stopWatch();
      setStatus(
        "locating",
      );
      setMessage(
        "Requesting live high-accuracy location. Keep device location/GPS enabled.",
      );

      watchIdRef.current =
        navigator.geolocation.watchPosition(
          (
            position,
          ) => {
            setPermissionChecked(
              true,
            );
            ingestFix(
              positionToFix(
                position,
              ),
            );
          },
          (
            error,
          ) => {
            setPermissionChecked(
              true,
            );
            captureActiveRef.current =
              false;
            clearCaptureTimer();
            setStatus(
              "error",
            );
            setErrorMessage(
              geolocationErrorMessage(
                error,
              ),
            );
          },
          {
            enableHighAccuracy:
              true,
            maximumAge: 0,
            timeout: 15_000,
          },
        );
    };

  const beginCapture =
    () => {
      if (!liveFix) {
        setMessage(
          "RoadSafe does not yet have a live device position.",
        );
        return;
      }

      samplesRef.current = [
        liveFix,
      ];
      setSampleCount(1);
      captureStartedAtRef.current =
        Date.now();
      captureActiveRef.current =
        true;
      setCapturedFix(null);
      setStatus(
        "capturing",
      );
      setMessage(
        `Stay still at the permanent feature. Collecting up to ${TARGET_SAMPLES} fresh GNSS samples.`,
      );

      clearCaptureTimer();

      captureTimerRef.current =
        window.setTimeout(
          () => {
            finishCapture(
              samplesRef.current,
            );
          },
          CAPTURE_WINDOW_MS,
        );
    };

  const cancelCapture =
    () => {
      clearCaptureTimer();
      captureActiveRef.current =
        false;
      samplesRef.current = [];
      setSampleCount(0);
      setStatus(
        liveFix
          ? "ready"
          : "idle",
      );
      setMessage(
        "Capture cancelled. Remain at the datum and start again when ready.",
      );
    };

  const confirm =
    () => {
      if (!label.trim()) {
        setMessage(
          "Describe the permanent feature before confirming the datum.",
        );
        return;
      }

      if (!capturedFix) {
        setMessage(
          "Capture the device GNSS position while standing at the reference point first.",
        );
        return;
      }

      onConfirm({
        label:
          label.trim(),
        latitude:
          capturedFix.latitude,
        longitude:
          capturedFix.longitude,
        accuracyMetres:
          Number(
            capturedFix.accuracyMetres.toFixed(
              2,
            ),
          ),
        bestAccuracyMetres:
          Number(
            capturedFix.bestAccuracyMetres.toFixed(
              2,
            ),
          ),
        worstAccuracyMetres:
          Number(
            capturedFix.worstAccuracyMetres.toFixed(
              2,
            ),
          ),
        altitudeMetres:
          typeof capturedFix.altitudeMetres ===
          "number"
            ? Number(
                capturedFix.altitudeMetres.toFixed(
                  2,
                ),
              )
            : undefined,
        altitudeAccuracyMetres:
          typeof capturedFix.altitudeAccuracyMetres ===
          "number"
            ? Number(
                capturedFix.altitudeAccuracyMetres.toFixed(
                  2,
                ),
              )
            : undefined,
        sampleCount:
          capturedFix.sampleCount,
        captureDurationSeconds:
          capturedFix.captureDurationSeconds,
        positionTimestamp:
          new Date(
            capturedFix.positionTimestamp,
          ).toISOString(),
        selectedAt:
          new Date().toISOString(),
        capturedBy:
          accidentCase.investigatingOfficer ||
          "Not recorded",
        source:
          "Browser Geolocation API",
        method:
          "Device GNSS - field captured",
      });
    };

  useEffect(
    () => {
      return () => {
        clearCaptureTimer();
        captureActiveRef.current =
          false;
        stopWatch();
      };
    },
    [],
  );

  const capturedAccuracy =
    capturedFix
      ? accuracyLabel(
          capturedFix.accuracyMetres,
        )
      : null;

  return createPortal(
    <>
      <style>{`
        @keyframes roadsafeDatumSlideIn {
          from { transform: translate(24px, -50%); opacity: 0; }
          to { transform: translate(0, -50%); opacity: 1; }
        }
      `}</style>
<aside style={{ animation: "roadsafeDatumSlideIn 180ms ease-out" }}
        className="fixed right-4 top-1/2 z-[9999] flex w-[360px] max-w-[calc(100vw-24px)] -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-[#4a4a4a] bg-[#202020] shadow-[0_24px_80px_rgba(0,0,0,.72)]">
        <header className="flex items-start justify-between gap-3 border-b border-[#414141] bg-[#2a2a2a] px-3 py-3">
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
              Field datum
            </p>

            <div className="mt-1 flex items-center gap-2">
              <h2 className="truncate text-[13px] font-bold text-slate-100">
                Set reference point
              </h2>

              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase ${statusToneClasses(
                  statusTone(status),
                )}`}
              >
                {statusLabel(status)}
              </span>
            </div>

            <p className="mt-1 text-[8px] leading-4 text-slate-500">
              Walk to the permanent feature, stand still, then capture the device GNSS position.
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="grid h-7 w-7 shrink-0 place-items-center rounded border border-[#4a4a4a] bg-[#303030] text-sm text-slate-300 hover:bg-[#393939]"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <div className="max-h-[72vh] overflow-y-auto p-3">
          <div className="space-y-3">
            <label className="grid gap-1.5">
              <span className="text-[8px] font-bold text-slate-400">
                Permanent feature
              </span>

              <input
                value={label}
                onChange={(event) =>
                  setLabel(event.target.value)
                }
                placeholder="e.g. Base of utility pole"
                className="min-h-9 rounded border border-[#4a4a4a] bg-[#1c1c1c] px-2.5 text-[9px] text-slate-100 outline-none focus:border-[#e8872d]"
              />
            </label>

            <section className="rounded-md border border-[#414141] bg-[#292929] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-slate-600">
                    Live GNSS
                  </p>
                  <p className="mt-1 text-[8px] text-slate-400">
                    {liveFix
                      ? `${liveFix.latitude.toFixed(6)}, ${liveFix.longitude.toFixed(6)}`
                      : "No live position yet"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={startLocation}
                  disabled={status === "capturing"}
                  className="shrink-0 rounded border border-[#515151] bg-[#303030] px-2.5 py-1.5 text-[8px] font-semibold text-slate-200 disabled:opacity-40"
                >
                  {liveFix ? "Refresh" : "Enable"}
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <MiniMetric
                  label="Accuracy"
                  value={
                    liveFix
                      ? `±${liveFix.accuracyMetres.toFixed(1)} m`
                      : "—"
                  }
                />

                <MiniMetric
                  label="Fix time"
                  value={
                    liveFix
                      ? new Date(liveFix.timestamp).toLocaleTimeString()
                      : "—"
                  }
                />
              </div>

              {currentAccuracyState && (
                <div className="mt-2 flex items-start gap-2">
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase ${accuracyToneClasses(
                      currentAccuracyState.tone,
                    )}`}
                  >
                    {currentAccuracyState.label}
                  </span>

                  <p className="text-[7px] leading-4 text-slate-500">
                    {currentAccuracyState.guidance}
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-md border border-[#5f4822] bg-[#241d10] p-2.5">
              <p className="text-[8px] leading-4 text-[#c6ad73]">
                Stand at the exact permanent feature and keep the device still before capture.
              </p>

              <button
                type="button"
                onClick={beginCapture}
                disabled={!liveFix || status === "capturing"}
                className="mt-2 w-full rounded border border-[#8c6039] bg-[#3a2c21] px-3 py-2 text-[8px] font-bold text-[#f0c49a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                I am at the reference point
              </button>

              {status === "capturing" && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[7px] text-[#c6ad73]">
                    Sampling {sampleCount}/{TARGET_SAMPLES}
                  </span>

                  <button
                    type="button"
                    onClick={cancelCapture}
                    className="text-[7px] font-semibold text-slate-400 hover:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </section>

            {capturedFix && (
              <section className="rounded-md border border-[#415244] bg-[#132019] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[7px] font-bold uppercase tracking-[0.08em] text-[#9ed4ae]">
                    Captured
                  </p>

                  {capturedAccuracy && (
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[7px] font-bold uppercase ${accuracyToneClasses(
                        capturedAccuracy.tone,
                      )}`}
                    >
                      {capturedAccuracy.label}
                    </span>
                  )}
                </div>

                <p className="mt-2 font-mono text-[8px] text-slate-200">
                  {capturedFix.latitude.toFixed(7)},{" "}
                  {capturedFix.longitude.toFixed(7)}
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <MiniMetric
                    label="Median accuracy"
                    value={`±${capturedFix.accuracyMetres.toFixed(1)} m`}
                  />

                  <MiniMetric
                    label="Samples"
                    value={String(capturedFix.sampleCount)}
                  />
                </div>
              </section>
            )}

            {errorMessage && (
              <div className="rounded-md border border-[#713646] bg-[#321722] p-2.5">
                <p className="text-[8px] font-bold text-[#f09aae]">
                  Location error
                </p>
                <p className="mt-1 text-[7px] leading-4 text-[#dca2ae]">
                  {errorMessage}
                </p>
                {!permissionChecked && (
                  <p className="mt-1 text-[7px] text-[#bd8794]">
                    Waiting for a location-permission decision.
                  </p>
                )}
              </div>
            )}

            <p className="rounded-md border border-[#414141] bg-[#292929] p-2.5 text-[7px] leading-4 text-slate-400">
              {message}
            </p>
          </div>
        </div>

        <footer className="grid grid-cols-2 gap-2 border-t border-[#414141] bg-[#242424] p-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[#4f4f4f] bg-[#303030] px-3 py-2 text-[8px] font-semibold text-slate-300"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={confirm}
            disabled={!capturedFix || !label.trim()}
            className="rounded border border-[#8c6039] bg-[#3a2c21] px-3 py-2 text-[8px] font-bold text-[#f0c49a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirm datum
          </button>
        </footer>
      </aside>
    </>,
    document.body,
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-[#414141] bg-[#202020] px-2 py-2">
      <p className="text-[6px] font-bold uppercase tracking-[0.06em] text-slate-600">
        {label}
      </p>

      <p className="mt-1 truncate text-[8px] font-bold text-slate-200">
        {value}
      </p>
    </div>
  );
}
