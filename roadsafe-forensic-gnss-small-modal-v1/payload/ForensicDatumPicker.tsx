
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
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/65 p-4">
      <section className="flex w-full max-w-[1120px] flex-col overflow-hidden rounded-xl border border-[#4a4a4a] bg-[#1f1f1f] shadow-[0_25px_100px_rgba(0,0,0,.72)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#3d3d3d] bg-[linear-gradient(180deg,#2b2b2b_0%,#242424_100%)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e8872d]">
              Field datum capture
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-[22px] font-bold leading-none text-slate-100">
                Set fixed reference point
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${statusToneClasses(
                  statusTone(status),
                )}`}
              >
                {statusLabel(
                  status,
                )}
              </span>
            </div>

            <p className="mt-3 max-w-3xl text-[12px] leading-5 text-slate-400">
              Officer walks to the permanent feature, enables live location, then captures the GNSS position. This opens as a compact modal instead of a full-screen workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onCancel
            }
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#4a4a4a] bg-[#2b2b2b] text-lg text-slate-300 hover:bg-[#343434]"
            aria-label="Close field datum capture"
          >
            ×
          </button>
        </header>

        <div className="grid max-h-[80vh] min-h-0 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0 space-y-4">
            <section className="rounded-xl border border-[#3e3e3e] bg-[#242424] p-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StepCard
                  number="1"
                  title="Choose feature"
                  text="Pick a permanent point such as a pole base, drain corner, culvert corner or signpost base."
                />
                <StepCard
                  number="2"
                  title="Walk to it"
                  text="Move the field device to the exact physical point and stand still beside or over the datum."
                />
                <StepCard
                  number="3"
                  title="Enable location"
                  text="Let RoadSafe read the device GNSS feed with high-accuracy mode enabled."
                />
                <StepCard
                  number="4"
                  title="Capture"
                  text="Press capture and let RoadSafe sample multiple fixes before confirming."
                />
              </div>
            </section>

            <section className="rounded-xl border border-[#3e3e3e] bg-[#242424] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e8872d]">
                    Live location
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Browser/device GNSS feed with high-accuracy request.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    startLocation
                  }
                  disabled={
                    status ===
                    "capturing"
                  }
                  className="rounded-lg border border-[#585858] bg-[#323232] px-4 py-2.5 text-[12px] font-semibold text-slate-100 hover:bg-[#3b3b3b] disabled:opacity-40"
                >
                  {liveFix
                    ? "Restart location"
                    : "Enable live location"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Latitude"
                  value={
                    liveFix
                      ? liveFix.latitude.toFixed(
                          7,
                        )
                      : "—"
                  }
                />
                <StatCard
                  label="Longitude"
                  value={
                    liveFix
                      ? liveFix.longitude.toFixed(
                          7,
                        )
                      : "—"
                  }
                />
                <StatCard
                  label="Accuracy"
                  value={
                    liveFix
                      ? `±${liveFix.accuracyMetres.toFixed(
                          1,
                        )} m`
                      : "—"
                  }
                />
                <StatCard
                  label="Fix time"
                  value={
                    liveFix
                      ? new Date(
                          liveFix.timestamp,
                        ).toLocaleTimeString()
                      : "—"
                  }
                />
              </div>

              {currentAccuracyState && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${accuracyToneClasses(
                      currentAccuracyState.tone,
                    )}`}
                  >
                    {currentAccuracyState.label}
                  </span>

                  <p className="text-[12px] text-slate-400">
                    {currentAccuracyState.guidance}
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[#3e3e3e] bg-[#242424] p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-xl border border-[#5f4822] bg-[linear-gradient(180deg,#2b2212_0%,#221b10_100%)] p-4">
                  <p className="text-[12px] leading-6 text-[#dfc27f]">
                    When standing at the exact permanent feature, hold the device steady and start capture. RoadSafe will sample up to{" "}
                    <b>{TARGET_SAMPLES}</b> fresh GNSS fixes over about{" "}
                    <b>{CAPTURE_WINDOW_MS / 1000} seconds</b>.
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={
                        beginCapture
                      }
                      disabled={
                        !liveFix ||
                        status ===
                          "capturing"
                      }
                      className="rounded-lg border border-[#8c6039] bg-[#3a2c21] px-5 py-3 text-[13px] font-bold text-[#f0c49a] hover:bg-[#453225] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      I am at the reference point
                    </button>

                    {status ===
                      "capturing" && (
                      <button
                        type="button"
                        onClick={
                          cancelCapture
                        }
                        className="rounded-lg border border-[#565656] bg-[#303030] px-4 py-3 text-[12px] font-semibold text-slate-300 hover:bg-[#3a3a3a]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3">
                  <MiniMetric
                    label="Status"
                    value={statusLabel(
                      status,
                    )}
                  />
                  <MiniMetric
                    label="Samples"
                    value={
                      status ===
                      "capturing"
                        ? `${sampleCount}/${TARGET_SAMPLES}`
                        : capturedFix
                          ? String(
                              capturedFix.sampleCount,
                            )
                          : "0"
                    }
                  />
                  <MiniMetric
                    label="Window"
                    value={
                      status ===
                      "capturing"
                        ? "Up to 12 s"
                        : capturedFix
                          ? `${capturedFix.captureDurationSeconds.toFixed(
                              1,
                            )} s`
                          : "—"
                    }
                  />
                </div>
              </div>
            </section>

            {capturedFix && (
              <section className="rounded-xl border border-[#3e3e3e] bg-[#242424] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e8872d]">
                      Captured GNSS datum
                    </p>
                    <p className="mt-1 text-[12px] text-slate-500">
                      Review the coordinate and reported uncertainty.
                    </p>
                  </div>

                  {capturedAccuracy && (
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${accuracyToneClasses(
                        capturedAccuracy.tone,
                      )}`}
                    >
                      {capturedAccuracy.label}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Latitude"
                    value={capturedFix.latitude.toFixed(
                      7,
                    )}
                  />
                  <StatCard
                    label="Longitude"
                    value={capturedFix.longitude.toFixed(
                      7,
                    )}
                  />
                  <StatCard
                    label="Median accuracy"
                    value={`±${capturedFix.accuracyMetres.toFixed(
                      1,
                    )} m`}
                  />
                  <StatCard
                    label="Best / worst"
                    value={`${capturedFix.bestAccuracyMetres.toFixed(
                      1,
                    )} / ${capturedFix.worstAccuracyMetres.toFixed(
                      1,
                    )} m`}
                  />
                </div>
              </section>
            )}

            {errorMessage && (
              <section className="rounded-xl border border-[#713646] bg-[#321722] p-4">
                <p className="text-[12px] font-bold text-[#f09aae]">
                  Location error
                </p>
                <p className="mt-2 text-[12px] leading-6 text-[#dca2ae]">
                  {errorMessage}
                </p>
                {!permissionChecked && (
                  <p className="mt-2 text-[11px] text-[#bd8794]">
                    The browser may still be waiting for a location-permission decision.
                  </p>
                )}
              </section>
            )}
          </main>

          <aside className="min-w-0 space-y-4">
            <section className="rounded-xl border border-[#3e3e3e] bg-[#242424] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e8872d]">
                Reference feature
              </p>

              <label className="mt-4 grid gap-2">
                <span className="text-[12px] font-semibold text-slate-300">
                  Permanent feature description
                </span>

                <input
                  value={
                    label
                  }
                  onChange={(
                    event,
                  ) =>
                    setLabel(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. Base of utility pole on northern verge"
                  className="min-h-11 rounded-lg border border-[#515151] bg-[#1e1e1e] px-3 text-[13px] text-slate-100 outline-none focus:border-[#e8872d]"
                />
              </label>

              <div className="mt-4 space-y-3">
                <Notice
                  tone="good"
                  title="Good examples"
                  text="Utility-pole base, signpost base, drain corner, culvert corner, surveyed mark, or another permanent stable feature."
                />
                <Notice
                  tone="bad"
                  title="Do not use"
                  text="Vehicles, debris, tyre marks, temporary cones, or any movable or transient object."
                />
              </div>
            </section>

            <section className="rounded-xl border border-[#3e3e3e] bg-[#242424] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e8872d]">
                Capture record
              </p>

              <div className="mt-4 space-y-2">
                <DataRow
                  label="Case"
                  value={
                    accidentCase.caseNumber
                  }
                />
                <DataRow
                  label="Officer"
                  value={
                    accidentCase.investigatingOfficer ||
                    "Not recorded"
                  }
                />
                <DataRow
                  label="Method"
                  value="Device GNSS"
                />
                <DataRow
                  label="Source"
                  value="Browser Geolocation API"
                />
              </div>
            </section>

            <section className="rounded-xl border border-[#444444] bg-[#2b2b2b] p-4">
              <p className="text-[11px] leading-6 text-slate-300">
                {message}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={
                  onCancel
                }
                className="rounded-lg border border-[#565656] bg-[#303030] px-4 py-3 text-[13px] font-semibold text-slate-200 hover:bg-[#3a3a3a]"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  confirm
                }
                disabled={
                  !capturedFix ||
                  !label.trim()
                }
                className="rounded-lg border border-[#8c6039] bg-[#3a2c21] px-4 py-3 text-[13px] font-bold text-[#f0c49a] hover:bg-[#453225] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm datum
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function StepCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-[#3f3f3f] bg-[#2b2b2b] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#8c6039] bg-[#3a2c21] text-[12px] font-bold text-[#f0c49a]">
          {number}
        </span>

        <h3 className="text-[13px] font-bold text-slate-100">
          {title}
        </h3>
      </div>

      <p className="mt-3 text-[12px] leading-5 text-slate-400">
        {text}
      </p>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[#3f3f3f] bg-[#1d1d1d] px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 break-all text-[17px] font-bold leading-none text-slate-100">
        {value}
      </p>
    </div>
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
    <div className="rounded-xl border border-[#3f3f3f] bg-[#1d1d1d] px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-[16px] font-bold text-slate-100">
        {value}
      </p>
    </div>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[70px_1fr] items-start gap-3 rounded-lg border border-[#3f3f3f] bg-[#1d1d1d] px-3 py-2.5">
      <span className="text-[11px] text-slate-500">
        {label}
      </span>
      <span className="break-words text-right text-[11px] font-semibold text-slate-200">
        {value}
      </span>
    </div>
  );
}

function Notice({
  tone,
  title,
  text,
}: {
  tone: "good" | "bad";
  title: string;
  text: string;
}) {
  const classes =
    tone === "good"
      ? "border-[#415244] bg-[#132019] text-[#9ed4ae]"
      : "border-[#713646] bg-[#321722] text-[#f09aae]";

  return (
    <div className={`rounded-xl border p-3 ${classes}`}>
      <p className="text-[11px] font-bold">
        {title}
      </p>
      <p className="mt-2 text-[11px] leading-5 opacity-90">
        {text}
      </p>
    </div>
  );
}
