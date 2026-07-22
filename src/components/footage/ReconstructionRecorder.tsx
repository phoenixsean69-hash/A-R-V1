import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ReconstructionFootageService } from "../../services/reconstructionFootageService";
import type { AccidentReconstruction } from "../../types/reconstruction";
import type {
  ReconstructionFootage,
  ReconstructionFootageQuality,
  ReconstructionRecordingPreferences,
} from "../../types/reconstructionFootage";
import { DEFAULT_RECONSTRUCTION_RECORDING_PREFERENCES } from "../../types/reconstructionFootage";
import { renderReconstructionFrame } from "../../utils/reconstructionCanvasRenderer";

interface ReconstructionRecorderProps {
  reconstruction: AccidentReconstruction;
  caseId: string;
  caseNumber: string;
  recordedBy?: string;
  onBeforeRecord?: () => AccidentReconstruction | Promise<AccidentReconstruction>;
  onSaved?: (footage: ReconstructionFootage) => void;
}

type RecorderStage =
  | "idle"
  | "countdown"
  | "recording"
  | "preview"
  | "saving"
  | "error";

const MIME_TYPE_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function getRecordingDimensions(quality: ReconstructionFootageQuality): {
  width: number;
  height: number;
  bitsPerSecond: number;
} {
  return quality === "High"
    ? { width: 1920, height: 1080, bitsPerSecond: 8_000_000 }
    : { width: 1280, height: 720, bitsPerSecond: 4_000_000 };
}

function chooseMimeType(): string {
  if (!("MediaRecorder" in window)) return "";
  return (
    MIME_TYPE_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ??
    ""
  );
}

export default function ReconstructionRecorder({
  reconstruction,
  caseId,
  caseNumber,
  recordedBy = "",
  onBeforeRecord,
  onSaved,
}: ReconstructionRecorderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number | null>(null);
  const recordingSourceRef = useRef<AccidentReconstruction>(reconstruction);
  const recordedDurationRef = useRef(0);

  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<RecorderStage>("idle");
  const [countdown, setCountdown] = useState(3);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState(
    reconstruction.durationSeconds,
  );
  const [preferences, setPreferences] =
    useState<ReconstructionRecordingPreferences>(
      DEFAULT_RECONSTRUCTION_RECORDING_PREFERENCES,
    );
  const [title, setTitle] = useState(`${caseNumber} Reconstruction Footage`);
  const [description, setDescription] = useState("");
  const [makePrimary, setMakePrimary] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("video/webm");
  const [errorMessage, setErrorMessage] = useState("");

  const dimensions = useMemo(
    () => getRecordingDimensions(preferences.quality),
    [preferences.quality],
  );

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const stopMediaTracks = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const revokePreviewUrl = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, []);

  const drawFrame = useCallback(
    (source: AccidentReconstruction, timeSeconds: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      renderReconstructionFrame(canvas, source, timeSeconds, {
        caseNumber,
        showMovementPaths: preferences.showMovementPaths,
        showMeasurements: preferences.showMeasurements,
        showEvidenceMarkers: preferences.showEvidenceMarkers,
        showEventCaption: preferences.showEventCaption,
      });
    },
    [caseNumber, preferences],
  );

  const resetRecording = useCallback(() => {
    stopAnimation();
    stopMediaTracks();
    revokePreviewUrl();
    chunksRef.current = [];
    recordingStartRef.current = null;
    recordedDurationRef.current = 0;
    setRecordedBlob(null);
    setRecordingTime(0);
    setErrorMessage("");
    setStage("idle");
  }, [revokePreviewUrl, stopAnimation, stopMediaTracks]);

  useEffect(() => {
    if (!open || stage !== "idle") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    drawFrame(reconstruction, 0);
  }, [dimensions, drawFrame, open, reconstruction, stage]);

  useEffect(() => {
    return () => {
      stopAnimation();
      stopMediaTracks();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, stopAnimation, stopMediaTracks]);

  const finishRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const runRecordingLoop = useCallback(
    (source: AccidentReconstruction) => {
      const animate = (timestamp: number) => {
        if (recordingStartRef.current === null) {
          recordingStartRef.current = timestamp;
        }

        const mediaElapsedSeconds =
          (timestamp - recordingStartRef.current) / 1000;
        const timelineElapsedSeconds =
          mediaElapsedSeconds * preferences.playbackSpeed;
        const timeSeconds = Math.min(
          timelineElapsedSeconds,
          source.durationSeconds,
        );
        recordedDurationRef.current = mediaElapsedSeconds;
        setRecordingTime(timeSeconds);
        drawFrame(source, timeSeconds);

        if (timeSeconds >= source.durationSeconds) {
          window.setTimeout(finishRecorder, 180);
          return;
        }

        animationFrameRef.current = window.requestAnimationFrame(animate);
      };

      animationFrameRef.current = window.requestAnimationFrame(animate);
    },
    [drawFrame, finishRecorder, preferences.playbackSpeed],
  );

  const beginMediaRecording = useCallback(
    async (source: AccidentReconstruction) => {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error("The recording canvas is not ready.");

      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      drawFrame(source, 0);

      const stream = canvas.captureStream(30);
      mediaStreamRef.current = stream;
      const mimeType = chooseMimeType();
      const options: MediaRecorderOptions = {
        videoBitsPerSecond: dimensions.bitsPerSecond,
      };
      if (mimeType) options.mimeType = mimeType;

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartRef.current = null;
      recordedDurationRef.current = 0;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = (event) => {
        const message =
          "error" in event && event.error instanceof Error
            ? event.error.message
            : "The browser failed while recording the reconstruction.";
        setErrorMessage(message);
        setStage("error");
        stopAnimation();
        stopMediaTracks();
      };

      recorder.onstop = () => {
        stopAnimation();
        stopMediaTracks();
        const finalMimeType = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type: finalMimeType });

        if (blob.size === 0) {
          setErrorMessage("The browser produced an empty recording. Try Standard quality or another Chromium browser.");
          setStage("error");
          return;
        }

        revokePreviewUrl();
        const url = URL.createObjectURL(blob);
        setRecordedMimeType(finalMimeType);
        setRecordedBlob(blob);
        setPreviewUrl(url);
        setStage("preview");
      };

      recorder.start(250);
      setStage("recording");
      runRecordingLoop(source);
    },
    [dimensions, drawFrame, revokePreviewUrl, runRecordingLoop, stopAnimation, stopMediaTracks],
  );

  const handleStartRecording = useCallback(async () => {
    try {
      if (!ReconstructionFootageService.isSupported()) {
        throw new Error(
          "This browser does not support canvas video recording and IndexedDB storage. Use a recent Chrome, Edge or Firefox build.",
        );
      }

      resetRecording();
      setOpen(true);
      setStage("countdown");

      const source = onBeforeRecord ? await onBeforeRecord() : reconstruction;
      recordingSourceRef.current = source;
      setRecordingDurationSeconds(source.durationSeconds);

      for (let value = 3; value >= 1; value -= 1) {
        setCountdown(value);
        drawFrame(source, 0);
        await wait(700);
      }

      await beginMediaRecording(source);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start recording.",
      );
      setStage("error");
    }
  }, [beginMediaRecording, drawFrame, onBeforeRecord, reconstruction, resetRecording]);

  const handleStopRecording = useCallback(() => {
    finishRecorder();
  }, [finishRecorder]);

  const handleSave = useCallback(async () => {
    if (!recordedBlob || !canvasRef.current) return;

    try {
      setStage("saving");
      const thumbnailDataUrl = canvasRef.current.toDataURL("image/jpeg", 0.78);
      const footage = await ReconstructionFootageService.save(
        {
          caseId,
          reconstructionId: recordingSourceRef.current.id,
          title,
          description,
          mimeType: recordedMimeType,
          durationSeconds:
            recordedDurationRef.current || recordingSourceRef.current.durationSeconds,
          recordedBy,
          playbackSpeed: preferences.playbackSpeed,
          quality: preferences.quality,
          width: dimensions.width,
          height: dimensions.height,
          frameRate: 30,
          thumbnailDataUrl,
          makePrimary,
        },
        recordedBlob,
      );

      onSaved?.(footage);
      resetRecording();
      setOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The footage could not be saved.",
      );
      setStage("error");
    }
  }, [
    caseId,
    description,
    dimensions,
    makePrimary,
    onSaved,
    preferences,
    recordedBlob,
    recordedBy,
    recordedMimeType,
    resetRecording,
    title,
  ]);

  const closeModal = () => {
    if (stage === "recording" || stage === "countdown" || stage === "saving") return;
    resetRecording();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setStage("idle");
        }}
        className="inline-flex items-center justify-center gap-2 rounded-sm bg-rose-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
      >
        <span aria-hidden="true">●</span>
        Record Footage
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm lg:p-6">
          <div className="max-h-[96vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-600">
                  Case {caseNumber}
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  Reconstruction Footage Recorder
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Record a clean canvas replay and save the video directly to this accident case.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={stage === "recording" || stage === "countdown" || stage === "saving"}
                className="rounded-sm border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Close
              </button>
            </header>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section>
                <div className="relative overflow-hidden rounded-sm bg-black shadow-lg">
                  <canvas
                    ref={canvasRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    className="aspect-video w-full"
                  />

                  {stage === "countdown" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55">
                      <div className="text-center text-white">
                        <p className="text-sm font-black uppercase tracking-[0.3em]">Recording starts in</p>
                        <p className="mt-2 text-8xl font-black">{countdown}</p>
                      </div>
                    </div>
                  )}

                  {stage === "recording" && (
                    <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-black text-white shadow-lg">
                      <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
                      REC {recordingTime.toFixed(1)}s / {recordingDurationSeconds.toFixed(1)}s
                    </div>
                  )}
                </div>

                {stage === "preview" && previewUrl && (
                  <div className="mt-4 rounded-sm border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-black text-emerald-900">Recording preview</p>
                    <video
                      src={previewUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="mt-3 aspect-video w-full rounded-lg bg-black"
                    />
                  </div>
                )}

                {stage === "error" && (
                  <div className="mt-4 rounded-sm border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800">
                    {errorMessage}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Footage title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    disabled={stage === "recording" || stage === "countdown" || stage === "saving"}
                    className="mt-1.5 w-full rounded-sm border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Description</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    disabled={stage === "recording" || stage === "countdown" || stage === "saving"}
                    className="mt-1.5 w-full resize-none rounded-sm border border-slate-300 px-3 py-2.5 text-sm"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label>
                    <span className="text-xs font-bold text-slate-700">Quality</span>
                    <select
                      value={preferences.quality}
                      onChange={(event) =>
                        setPreferences((current) => ({
                          ...current,
                          quality: event.target.value as ReconstructionFootageQuality,
                        }))
                      }
                      disabled={stage !== "idle" && stage !== "error"}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                    >
                      <option value="Standard">Standard 720p</option>
                      <option value="High">High 1080p</option>
                    </select>
                  </label>

                  <label>
                    <span className="text-xs font-bold text-slate-700">Playback</span>
                    <select
                      value={preferences.playbackSpeed}
                      onChange={(event) =>
                        setPreferences((current) => ({
                          ...current,
                          playbackSpeed: Number(event.target.value),
                        }))
                      }
                      disabled={stage !== "idle" && stage !== "error"}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                    >
                      <option value={0.5}>0.5×</option>
                      <option value={1}>1×</option>
                      <option value={1.5}>1.5×</option>
                      <option value={2}>2×</option>
                    </select>
                  </label>
                </div>

                <div className="space-y-2 rounded-sm bg-slate-50 p-3">
                  {[
                    ["showMovementPaths", "Show movement paths"],
                    ["showMeasurements", "Show measurements"],
                    ["showEvidenceMarkers", "Show evidence markers"],
                    ["showEventCaption", "Show active event caption"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
                      {label}
                      <input
                        type="checkbox"
                        checked={Boolean(preferences[key as keyof ReconstructionRecordingPreferences])}
                        disabled={stage !== "idle" && stage !== "error"}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }))
                        }
                        className="h-5 w-5"
                      />
                    </label>
                  ))}
                </div>

                <label className="flex items-center justify-between rounded-sm border border-indigo-200 bg-indigo-50 p-3 text-sm font-bold text-indigo-800">
                  Mark as primary footage
                  <input
                    type="checkbox"
                    checked={makePrimary}
                    onChange={(event) => setMakePrimary(event.target.checked)}
                    className="h-5 w-5"
                  />
                </label>

                {stage === "idle" || stage === "error" ? (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="w-full rounded-sm bg-rose-600 px-5 py-3 font-black text-white hover:bg-rose-700"
                  >
                    ● Start Recording
                  </button>
                ) : stage === "recording" ? (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="w-full rounded-sm bg-slate-950 px-5 py-3 font-black text-white"
                  >
                    Stop Recording
                  </button>
                ) : stage === "preview" ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="w-full rounded-sm bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-700"
                    >
                      Save Footage to Case
                    </button>
                    <button
                      type="button"
                      onClick={resetRecording}
                      className="w-full rounded-sm border border-slate-300 px-5 py-3 font-black text-slate-700"
                    >
                      Record Again
                    </button>
                  </div>
                ) : (
                  <div className="rounded-sm bg-slate-100 p-4 text-center text-sm font-bold text-slate-600">
                    {stage === "saving" ? "Saving footage…" : "Preparing recorder…"}
                  </div>
                )}

                <p className="text-xs leading-5 text-slate-500">
                  Video blobs are stored in IndexedDB. Metadata remains linked to the accident case. For production evidence custody, move files to authenticated cloud storage.
                </p>
              </aside>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
