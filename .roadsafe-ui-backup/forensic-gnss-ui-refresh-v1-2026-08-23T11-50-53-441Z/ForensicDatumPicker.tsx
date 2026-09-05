import {
  useEffect,
  useMemo,
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

  const sorted =
    [...values].sort(
      (left, right) =>
        left - right,
    );

  const middle =
    Math.floor(
      sorted.length / 2,
    );

  if (
    sorted.length % 2 ===
    0
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
      Math.min(
        ...accuracies,
      ),

    worstAccuracyMetres:
      Math.max(
        ...accuracies,
      ),

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
  className: string;
  guidance: string;
} {
  if (
    accuracyMetres <= 3
  ) {
    return {
      label:
        "Very good",
      className:
        "border-[#415244] bg-[#132019] text-[#9ed4ae]",
      guidance:
        "Strong field position for a phone/device GNSS reading.",
    };
  }

  if (
    accuracyMetres <= 5
  ) {
    return {
      label:
        "Good",
      className:
        "border-[#415244] bg-[#132019] text-[#9ed4ae]",
      guidance:
        "Usable field position; preserve the reported uncertainty.",
    };
  }

  if (
    accuracyMetres <= 10
  ) {
    return {
      label:
        "Caution",
      className:
        "border-[#6d5523] bg-[#241d10] text-[#dfc27f]",
      guidance:
        "Position is usable only with caution. Consider waiting for better GNSS accuracy.",
    };
  }

  return {
    label:
      "Poor",
    className:
      "border-[#713646] bg-[#321722] text-[#f09aae]",
    guidance:
      "Recapture recommended. This accuracy is too coarse for fine forensic scene work.",
  };
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
  ] =
    useState<LiveFix | null>(
      null,
    );

  const [
    capturedFix,
    setCapturedFix,
  ] =
    useState<CapturedFix | null>(
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
      ? "A previously captured reference point is loaded. Recapture only if the officer is physically standing at the datum again."
      : "Choose a permanent feature, walk to it, then enable live location.",
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
    useMemo(
      () =>
        currentAccuracy ===
        null
          ? null
          : accuracyLabel(
              currentAccuracy,
            ),
      [currentAccuracy],
    );

  const clearCaptureTimer =
    () => {
      if (
        captureTimerRef
          .current !== null
      ) {
        window.clearTimeout(
          captureTimerRef
            .current,
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
        navigator.geolocation
          .clearWatch(
            watchIdRef.current,
          );

        watchIdRef.current =
          null;
      }
    };

  const finishCapture =
    (
      samples:
        LiveFix[],
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
        captureStartedAtRef
          .current ??
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
        `GNSS capture complete: ${captured.sampleCount} samples, median reported accuracy ±${captured.accuracyMetres.toFixed(
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
        !captureActiveRef
          .current
      ) {
        setStatus(
          "ready",
        );

        return;
      }

      const lastSample =
        samplesRef.current[
          samplesRef.current
            .length - 1
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
        samplesRef.current
          .length,
      );

      if (
        samplesRef.current
          .length >=
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
        navigator.geolocation
          .watchPosition(
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

              timeout:
                15_000,
            },
          );
    };

  const beginCapture =
    () => {
      if (
        !liveFix
      ) {
        setMessage(
          "RoadSafe does not yet have a live device position.",
        );

        return;
      }

      samplesRef.current =
        [liveFix];

      setSampleCount(1);

      captureStartedAtRef.current =
        Date.now();

      captureActiveRef.current =
        true;

      setCapturedFix(
        null,
      );

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

      samplesRef.current =
        [];

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
      if (
        !label.trim()
      ) {
        setMessage(
          "Describe the permanent feature before confirming the datum.",
        );

        return;
      }

      if (
        !capturedFix
      ) {
        setMessage(
          "Capture the device GNSS position while standing at the reference point first.",
        );

        return;
      }

      const selectedAt =
        new Date()
          .toISOString();

      onConfirm({
        label:
          label.trim(),

        latitude:
          capturedFix.latitude,

        longitude:
          capturedFix.longitude,

        accuracyMetres:
          Number(
            capturedFix
              .accuracyMetres
              .toFixed(2),
          ),

        bestAccuracyMetres:
          Number(
            capturedFix
              .bestAccuracyMetres
              .toFixed(2),
          ),

        worstAccuracyMetres:
          Number(
            capturedFix
              .worstAccuracyMetres
              .toFixed(2),
          ),

        altitudeMetres:
          typeof
            capturedFix
              .altitudeMetres ===
          "number"
            ? Number(
                capturedFix
                  .altitudeMetres
                  .toFixed(2),
              )
            : undefined,

        altitudeAccuracyMetres:
          typeof
            capturedFix
              .altitudeAccuracyMetres ===
          "number"
            ? Number(
                capturedFix
                  .altitudeAccuracyMetres
                  .toFixed(2),
              )
            : undefined,

        sampleCount:
          capturedFix.sampleCount,

        captureDurationSeconds:
          capturedFix
            .captureDurationSeconds,

        positionTimestamp:
          new Date(
            capturedFix
              .positionTimestamp,
          ).toISOString(),

        selectedAt,

        capturedBy:
          accidentCase
            .investigatingOfficer ||
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

  const modal = (
    <div className="fixed inset-0 z-[9999] flex bg-black/90 p-2 sm:p-4">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-[#494949] bg-[#202020] shadow-[0_30px_100px_rgba(0,0,0,.78)]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#494949] bg-[#303030] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-[#e8872d]">
              Field datum capture
            </p>

            <h2 className="mt-1 text-base font-bold text-slate-100">
              Walk to the fixed reference point
            </h2>

            <p className="mt-1 max-w-3xl text-[9px] leading-4 text-slate-500">
              The officer must physically stand at a permanent, identifiable
              scene feature. RoadSafe records the device GNSS position and its
              reported uncertainty. No map clicking is used.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onCancel
            }
            className="grid h-9 w-9 shrink-0 place-items-center rounded border border-[#494949] bg-[#292929] text-lg text-slate-300 hover:bg-[#383838]"
            aria-label="Close datum capture"
          >
            ×
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 space-y-3">
            <section className="rounded-md border border-[#494949] bg-[#292929]">
              <div className="border-b border-[#414141] px-4 py-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#e8872d]">
                  Field procedure
                </p>
              </div>

              <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-4">
                <Step
                  number="1"
                  title="Choose feature"
                  text="Select a permanent point such as a utility-pole base, culvert corner, drain corner or signpost base."
                />

                <Step
                  number="2"
                  title="Walk to it"
                  text="Take the field device to the exact physical point and stand directly beside/over the datum."
                />

                <Step
                  number="3"
                  title="Enable GNSS"
                  text="Allow RoadSafe to read the device's live high-accuracy position."
                />

                <Step
                  number="4"
                  title="Capture"
                  text="Stand still and press I AM AT THE REFERENCE POINT so RoadSafe can collect several fixes."
                />
              </div>
            </section>

            <section className="rounded-md border border-[#494949] bg-[#292929]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#414141] px-4 py-3">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#e8872d]">
                    Live device position
                  </p>

                  <p className="mt-1 text-[8px] text-slate-600">
                    Browser/device GNSS feed · high-accuracy request enabled
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
                  className="rounded border border-[#494949] bg-[#303030] px-3 py-2 text-[9px] font-semibold text-slate-200 disabled:opacity-40"
                >
                  {liveFix
                    ? "Restart live location"
                    : "Enable live location"}
                </button>
              </div>

              <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="Latitude"
                  value={
                    liveFix
                      ? liveFix.latitude.toFixed(
                          7,
                        )
                      : "—"
                  }
                />

                <Metric
                  label="Longitude"
                  value={
                    liveFix
                      ? liveFix.longitude.toFixed(
                          7,
                        )
                      : "—"
                  }
                />

                <Metric
                  label="Reported accuracy"
                  value={
                    liveFix
                      ? `±${liveFix.accuracyMetres.toFixed(
                          1,
                        )} m`
                      : "—"
                  }
                />

                <Metric
                  label="Live fix time"
                  value={
                    liveFix
                      ? new Date(
                          liveFix.timestamp,
                        ).toLocaleTimeString()
                      : "—"
                  }
                />
              </div>

              <div className="px-4 pb-4">
                {currentAccuracyState && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded border px-2 py-1 text-[8px] font-bold uppercase ${currentAccuracyState.className}`}
                    >
                      {currentAccuracyState.label}
                    </span>

                    <span className="text-[8px] leading-4 text-slate-500">
                      {currentAccuracyState.guidance}
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-md border border-[#494949] bg-[#292929]">
              <div className="border-b border-[#414141] px-4 py-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#e8872d]">
                  Capture reference position
                </p>
              </div>

              <div className="space-y-3 p-4">
                <div className="rounded border border-[#6d5523] bg-[#241d10] p-3 text-[8px] leading-4 text-[#c6ad73]">
                  Do not press capture while walking. Stand at the exact
                  permanent feature, hold the device steady, then start the
                  sampling window.
                </div>

                <div className="flex flex-wrap items-center gap-3">
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
                    className="rounded border border-[#8c6039] bg-[#3a2c21] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.04em] text-[#f0c49a] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    I AM AT THE REFERENCE POINT
                  </button>

                  {status ===
                    "capturing" && (
                    <button
                      type="button"
                      onClick={
                        cancelCapture
                      }
                      className="rounded border border-[#494949] bg-[#303030] px-3 py-2 text-[9px] font-semibold text-slate-300"
                    >
                      Cancel sampling
                    </button>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <Metric
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

                  <Metric
                    label="Capture window"
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

                  <Metric
                    label="Status"
                    value={
                      status ===
                      "idle"
                        ? "Waiting"
                        : status ===
                            "locating"
                          ? "Locating"
                          : status ===
                              "ready"
                            ? "Live"
                            : status ===
                                "capturing"
                              ? "Sampling"
                              : status ===
                                  "captured"
                                ? "Captured"
                                : "Error"
                    }
                  />
                </div>
              </div>
            </section>

            {capturedFix && (
              <section className="rounded-md border border-[#494949] bg-[#292929]">
                <div className="border-b border-[#414141] px-4 py-3">
                  <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#e8872d]">
                    Captured GNSS datum
                  </p>
                </div>

                <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Latitude"
                    value={capturedFix.latitude.toFixed(
                      7,
                    )}
                  />

                  <Metric
                    label="Longitude"
                    value={capturedFix.longitude.toFixed(
                      7,
                    )}
                  />

                  <Metric
                    label="Median accuracy"
                    value={`±${capturedFix.accuracyMetres.toFixed(
                      1,
                    )} m`}
                  />

                  <Metric
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
              <section className="rounded-md border border-[#713646] bg-[#321722] p-4">
                <p className="text-[9px] font-bold text-[#f09aae]">
                  Location error
                </p>

                <p className="mt-2 text-[8px] leading-4 text-[#dca2ae]">
                  {errorMessage}
                </p>

                {!permissionChecked && (
                  <p className="mt-2 text-[7px] leading-4 text-[#bd8794]">
                    The browser may still be waiting for a location-permission
                    decision.
                  </p>
                )}
              </section>
            )}
          </main>

          <aside className="min-w-0 space-y-3">
            <section className="overflow-hidden rounded-md border border-[#494949] bg-[#292929]">
              <div className="border-b border-[#414141] px-3 py-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#e8872d]">
                  Reference feature
                </p>
              </div>

              <div className="space-y-3 p-3">
                <label className="grid gap-1.5">
                  <span className="text-[8px] font-bold text-slate-400">
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
                        event.target
                          .value,
                      )
                    }
                    placeholder="e.g. Base of utility pole on northern verge"
                    className="min-h-10 rounded border border-[#494949] bg-[#202020] px-3 text-[10px] text-slate-200 outline-none focus:border-[#e8872d]"
                  />
                </label>

                <div className="rounded border border-[#414141] bg-[#202020] p-3 text-[8px] leading-4 text-slate-500">
                  Good datum examples: utility-pole base, signpost base, drain
                  corner, culvert corner, surveyed mark or another permanent
                  stable feature.
                </div>

                <div className="rounded border border-[#713646] bg-[#321722] p-3 text-[8px] leading-4 text-[#dca2ae]">
                  Do not use a vehicle, debris item, tyre mark, temporary cone
                  or another movable/transient feature.
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-md border border-[#494949] bg-[#292929]">
              <div className="border-b border-[#414141] px-3 py-3">
                <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#e8872d]">
                  Capture record
                </p>
              </div>

              <dl className="p-3 text-[8px]">
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

                <DataRow
                  label="Sampling"
                  value={`Up to ${TARGET_SAMPLES} fixes / ${CAPTURE_WINDOW_MS / 1000}s`}
                />
              </dl>
            </section>

            <section className="rounded-md border border-[#494949] bg-[#292929] p-3">
              <p className="text-[8px] font-bold text-slate-300">
                Forensic uncertainty
              </p>

              <p className="mt-2 text-[7px] leading-4 text-slate-500">
                RoadSafe stores the accuracy reported by the device/browser.
                This datum georeferences the scene; fine scene measurements
                should still be made with appropriate measuring equipment and
                referenced back to this point.
              </p>
            </section>

            <section className="rounded-md border border-[#414141] bg-[#303030] p-3">
              <p className="text-[8px] leading-4 text-slate-400">
                {message}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={
                  onCancel
                }
                className="rounded border border-[#494949] bg-[#303030] px-3 py-2 text-[9px] font-semibold text-slate-300"
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
                className="rounded border border-[#8c6039] bg-[#3a2c21] px-3 py-2 text-[9px] font-bold text-[#f0c49a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Confirm fixed reference
              </button>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );

  return createPortal(
    modal,
    document.body,
  );
}

function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded border border-[#414141] bg-[#303030] p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-[#8c6039] bg-[#3a2c21] text-[8px] font-bold text-[#f0c49a]">
          {number}
        </span>

        <p className="text-[8px] font-bold text-slate-300">
          {title}
        </p>
      </div>

      <p className="mt-2 text-[7px] leading-4 text-slate-500">
        {text}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-[#414141] bg-[#202020] p-3">
      <p className="text-[7px] font-bold uppercase tracking-[0.06em] text-slate-600">
        {label}
      </p>

      <p className="mt-2 break-all text-[10px] font-bold text-slate-200">
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
    <div className="grid grid-cols-[86px_1fr] gap-3 border-t border-[#383838] py-2 first:border-t-0">
      <dt className="text-slate-600">
        {label}
      </dt>

      <dd className="m-0 text-right text-slate-400">
        {value}
      </dd>
    </div>
  );
}
