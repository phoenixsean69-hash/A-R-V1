import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Square,
  Video,
  X,
} from "../icons/materialIcons";

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
  onBeforeRecord?: () =>
    | AccidentReconstruction
    | Promise<AccidentReconstruction>;
  onSaved?: (footage: ReconstructionFootage) => void;
}

type RecorderStage =
  | "idle"
  | "preparing"
  | "armed"
  | "recording"
  | "saving"
  | "saved"
  | "error";

type ReconstructionView = "2D" | "3D";

const STANDARD_RECORDING_WIDTH = 1280;
const STANDARD_RECORDING_HEIGHT = 720;
const RECORDING_FRAME_RATE = 30;
const RECORDING_BITS_PER_SECOND = 4_000_000;

const MIME_TYPE_CANDIDATES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];

function createDefaultPreferences(): ReconstructionRecordingPreferences {
  return {
    ...DEFAULT_RECONSTRUCTION_RECORDING_PREFERENCES,
    quality: "Standard",
    playbackSpeed: 1,
    showMovementPaths: true,
    showMeasurements: true,
    showEvidenceMarkers: true,
    showEventCaption: true,
  };
}

function chooseMimeType(): string {
  if (!("MediaRecorder" in window)) {
    return "";
  }

  return (
    MIME_TYPE_CANDIDATES.find((type) =>
      MediaRecorder.isTypeSupported(type),
    ) ?? ""
  );
}

function getPlaybackButton(): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    ".reconstruction-playback__play",
  );
}

function playbackIsRunning(): boolean {
  const button = getPlaybackButton();

  if (!button) {
    return false;
  }

  const title = button.getAttribute("title") ?? "";
  const label = button.textContent ?? "";

  return (
    title.toLowerCase().includes("pause") ||
    label.toLowerCase().includes("pause")
  );
}

function readPlaybackTime(): number {
  const clock = document.querySelector<HTMLElement>(
    "[data-playback-clock]",
  );

  if (!clock) {
    return 0;
  }

  const value = Number.parseFloat(clock.textContent ?? "0");
  return Number.isFinite(value) ? value : 0;
}

function readPlaybackSpeed(): number {
  const select = document.querySelector<HTMLSelectElement>(
    ".reconstruction-playback__speed select",
  );

  const value = Number(select?.value ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function readActiveView(): ReconstructionView {
  const activeButton = document.querySelector<HTMLButtonElement>(
    ".reconstruction-workspace__view-switch .is-active",
  );

  return activeButton?.textContent
    ?.trim()
    .toUpperCase()
    .startsWith("3D")
    ? "3D"
    : "2D";
}

function findActiveThreeCanvas(): HTMLCanvasElement | null {
  const stageCanvas =
    document.querySelector<HTMLCanvasElement>(
      ".reconstruction-workspace__stage-main canvas",
    );

  if (
    stageCanvas &&
    stageCanvas.width > 0 &&
    stageCanvas.height > 0
  ) {
    return stageCanvas;
  }

  const visibleCanvases = Array.from(
    document.querySelectorAll<HTMLCanvasElement>("canvas"),
  )
    .filter((canvas) => {
      const rectangle = canvas.getBoundingClientRect();
      const style = window.getComputedStyle(canvas);

      return (
        rectangle.width > 180 &&
        rectangle.height > 120 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    })
    .sort((first, second) => {
      const firstRectangle = first.getBoundingClientRect();
      const secondRectangle = second.getBoundingClientRect();

      return (
        secondRectangle.width * secondRectangle.height -
        firstRectangle.width * firstRectangle.height
      );
    });

  return visibleCanvases[0] ?? null;
}

function safeCanvasThumbnail(
  canvas: HTMLCanvasElement,
): string {
  try {
    return canvas.toDataURL("image/jpeg", 0.78);
  } catch (error) {
    console.warn(
      "Unable to create the reconstruction footage thumbnail.",
      error,
    );
    return "";
  }
}

function getQualityForCanvas(
  canvas: HTMLCanvasElement,
): ReconstructionFootageQuality {
  return canvas.height >= 900 ? "High" : "Standard";
}

function getButtonClasses(stage: RecorderStage): string {
  switch (stage) {
    case "armed":
      return "border-[#6d5523] bg-[#241d10] text-[#d9bd78] hover:bg-[#302612]";
    case "recording":
      return "border-[#713646] bg-[#9f2942] text-white hover:bg-[#b12f4b]";
    case "saving":
    case "preparing":
      return "border-[#494949] bg-[#303030] text-[#c4c4c4]";
    case "saved":
      return "border-[#494949] bg-[#303030] text-[#c4c4c4]";
    case "error":
      return "border-[#713646] bg-[#321722] text-[#e28b9d] hover:bg-[#3b1b28]";
    case "idle":
      return "border-[#494949] bg-[#303030] text-white hover:bg-[#303030]";
  }
}

function getButtonContent(stage: RecorderStage) {
  switch (stage) {
    case "preparing":
      return (
        <>
          <Loader2 size={13} className="animate-spin" />
          Preparing…
        </>
      );
    case "armed":
      return (
        <>
          <X size={13} />
          Cancel recording
        </>
      );
    case "recording":
      return (
        <>
          <Square size={11} fill="currentColor" />
          Stop recording
        </>
      );
    case "saving":
      return (
        <>
          <Loader2 size={13} className="animate-spin" />
          Saving…
        </>
      );
    case "saved":
      return (
        <>
          <CheckCircle2 size={13} />
          Footage saved
        </>
      );
    case "error":
      return (
        <>
          <AlertCircle size={13} />
          Try recording again
        </>
      );
    case "idle":
      return (
        <>
          <Video size={14} strokeWidth={1.8} />
          Record footage
        </>
      );
  }
}

export default function ReconstructionRecorder({
  reconstruction,
  caseId,
  caseNumber,
  recordedBy = "",
  onBeforeRecord,
  onSaved,
}: ReconstructionRecorderProps) {
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(
    null,
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(
    null,
  );
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingSourceRef =
    useRef<AccidentReconstruction>(reconstruction);
  const recordingCanvasRef =
    useRef<HTMLCanvasElement | null>(null);
  const recordingViewRef =
    useRef<ReconstructionView>("2D");
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(
    null,
  );
  const monitorFrameRef = useRef<number | null>(null);
  const armedPollRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const stoppingRef = useRef(false);
  const stageRef = useRef<RecorderStage>("idle");

  const [stage, setStage] =
    useState<RecorderStage>("idle");
  const [statusMessage, setStatusMessage] = useState(
    "Capture the active 2D or 3D reconstruction playback.",
  );

  const preferencesRef =
    useRef<ReconstructionRecordingPreferences>(
      createDefaultPreferences(),
    );

  const updateStage = useCallback(
    (
      nextStage: RecorderStage,
      message: string,
    ) => {
      stageRef.current = nextStage;
      setStage(nextStage);
      setStatusMessage(message);
    },
    [],
  );

  const stopMediaTracks = useCallback(() => {
    mediaStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const clearMonitor = useCallback(() => {
    if (monitorFrameRef.current !== null) {
      window.cancelAnimationFrame(
        monitorFrameRef.current,
      );
      monitorFrameRef.current = null;
    }
  }, []);

  const clearArmedPoll = useCallback(() => {
    if (armedPollRef.current !== null) {
      window.clearInterval(armedPollRef.current);
      armedPollRef.current = null;
    }
  }, []);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const cleanupRecordingResources = useCallback(() => {
    clearMonitor();
    clearArmedPoll();
    stopMediaTracks();
    mediaRecorderRef.current = null;
    recordingCanvasRef.current = null;
    recordingStartedAtRef.current = null;
    chunksRef.current = [];
    startingRef.current = false;
    stoppingRef.current = false;
  }, [
    clearArmedPoll,
    clearMonitor,
    stopMediaTracks,
  ]);

  const drawTwoDimensionalFrame =
    useCallback((timeSeconds: number) => {
      const canvas = hiddenCanvasRef.current;
      const source = recordingSourceRef.current;

      if (!canvas || !source) {
        return;
      }

      renderReconstructionFrame(
        canvas,
        source,
        timeSeconds,
        {
          caseNumber,
          showMovementPaths:
            preferencesRef.current
              .showMovementPaths,
          showMeasurements:
            preferencesRef.current
              .showMeasurements,
          showEvidenceMarkers:
            preferencesRef.current
              .showEvidenceMarkers,
          showEventCaption:
            preferencesRef.current
              .showEventCaption,
        },
      );
    }, [caseNumber]);

  const scheduleIdleReset = useCallback(() => {
    clearResetTimer();

    resetTimerRef.current = window.setTimeout(
      () => {
        updateStage(
          "idle",
          "Capture the active 2D or 3D reconstruction playback.",
        );
        resetTimerRef.current = null;
      },
      3200,
    );
  }, [clearResetTimer, updateStage]);

  const saveRecordedFootage = useCallback(
    async (
      blob: Blob,
      mimeType: string,
      durationSeconds: number,
    ) => {
      const source = recordingSourceRef.current;
      const canvas = recordingCanvasRef.current;
      const view = recordingViewRef.current;

      if (!source || !canvas) {
        throw new Error(
          "The recorded scene is no longer available.",
        );
      }

      updateStage(
        "saving",
        `Saving the ${view} reconstruction footage to ${caseNumber}…`,
      );

      const playbackSpeed = readPlaybackSpeed();
      const quality = getQualityForCanvas(canvas);
      const recordedAt = new Date();
      const title =
        `${caseNumber} ${view} Reconstruction Footage`;
      const description =
        `Recorded directly from the active ${view} reconstruction playback on ${recordedAt.toLocaleString()}.`;

      const footage =
        await ReconstructionFootageService.save(
          {
            caseId,
            reconstructionId: source.id,
            title,
            description,
            mimeType,
            durationSeconds: Math.max(
              0.1,
              durationSeconds,
            ),
            recordedBy,
            playbackSpeed,
            quality,
            width: canvas.width,
            height: canvas.height,
            frameRate: RECORDING_FRAME_RATE,
            thumbnailDataUrl:
              safeCanvasThumbnail(canvas),
            makePrimary: true,
          },
          blob,
        );

      onSaved?.(footage);

      updateStage(
        "saved",
        `${view} footage saved to case ${caseNumber}.`,
      );
      scheduleIdleReset();
    },
    [
      caseId,
      caseNumber,
      onSaved,
      recordedBy,
      scheduleIdleReset,
      updateStage,
    ],
  );

  const finishRecording = useCallback(
    (pausePlayback: boolean) => {
      if (stoppingRef.current) {
        return;
      }

      const recorder = mediaRecorderRef.current;

      if (
        !recorder ||
        recorder.state === "inactive"
      ) {
        return;
      }

      stoppingRef.current = true;
      clearMonitor();

      if (
        pausePlayback &&
        playbackIsRunning()
      ) {
        getPlaybackButton()?.click();
      }

      updateStage(
        "saving",
        "Finishing and saving the recorded reconstruction…",
      );

      recorder.stop();
    },
    [clearMonitor, updateStage],
  );

  const runPlaybackMonitor = useCallback(() => {
    const tick = () => {
      if (
        stageRef.current !== "recording"
      ) {
        return;
      }

      const source = recordingSourceRef.current;
      const currentTime = readPlaybackTime();

      if (
        recordingViewRef.current === "2D"
      ) {
        drawTwoDimensionalFrame(currentTime);
      }

      const elapsedMilliseconds =
        recordingStartedAtRef.current === null
          ? 0
          : performance.now() -
            recordingStartedAtRef.current;

      const reachedEnd =
        currentTime >=
        Math.max(
          0,
          source.durationSeconds - 0.025,
        );

      const playbackStopped =
        elapsedMilliseconds > 250 &&
        !playbackIsRunning();

      if (
        reachedEnd ||
        playbackStopped
      ) {
        finishRecording(false);
        return;
      }

      monitorFrameRef.current =
        window.requestAnimationFrame(tick);
    };

    monitorFrameRef.current =
      window.requestAnimationFrame(tick);
  }, [
    drawTwoDimensionalFrame,
    finishRecording,
  ]);

  const startMediaRecording = useCallback(async () => {
    if (
      startingRef.current ||
      stageRef.current !== "armed"
    ) {
      return;
    }

    startingRef.current = true;
    clearArmedPoll();

    try {
      const view = readActiveView();
      recordingViewRef.current = view;

      let canvas: HTMLCanvasElement | null = null;

      if (view === "3D") {
        canvas = findActiveThreeCanvas();

        if (!canvas) {
          throw new Error(
            "The 3D scene is still loading. Wait for it to appear, then arm recording again.",
          );
        }
      } else {
        canvas = hiddenCanvasRef.current;

        if (!canvas) {
          throw new Error(
            "The 2D recording canvas is unavailable.",
          );
        }

        canvas.width = STANDARD_RECORDING_WIDTH;
        canvas.height = STANDARD_RECORDING_HEIGHT;
        drawTwoDimensionalFrame(
          readPlaybackTime(),
        );
      }

      if (
        typeof canvas.captureStream !==
        "function"
      ) {
        throw new Error(
          "This browser cannot record the reconstruction canvas.",
        );
      }

      recordingCanvasRef.current = canvas;

      const stream = canvas.captureStream(
        RECORDING_FRAME_RATE,
      );
      mediaStreamRef.current = stream;

      const mimeType = chooseMimeType();
      const options: MediaRecorderOptions = {
        videoBitsPerSecond:
          RECORDING_BITS_PER_SECOND,
      };

      if (mimeType) {
        options.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(
        stream,
        options,
      );

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      stoppingRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        const message =
          "error" in event &&
          event.error instanceof Error
            ? event.error.message
            : "The browser failed while recording the reconstruction.";

        cleanupRecordingResources();
        updateStage("error", message);
      };

      recorder.onstop = () => {
        const stoppedAt = performance.now();
        const startedAt =
          recordingStartedAtRef.current ??
          stoppedAt;
        const durationSeconds =
          (stoppedAt - startedAt) / 1000;
        const finalMimeType =
          recorder.mimeType ||
          mimeType ||
          "video/webm";
        const blob = new Blob(
          chunksRef.current,
          {
            type: finalMimeType,
          },
        );

        clearMonitor();
        stopMediaTracks();
        mediaRecorderRef.current = null;
        startingRef.current = false;
        stoppingRef.current = false;

        if (blob.size === 0) {
          chunksRef.current = [];
          updateStage(
            "error",
            "The browser produced an empty recording. Play the scene for longer or use a recent Chrome or Edge browser.",
          );
          return;
        }

        void saveRecordedFootage(
          blob,
          finalMimeType,
          durationSeconds,
        ).catch((error) => {
          updateStage(
            "error",
            error instanceof Error
              ? error.message
              : "The footage could not be saved.",
          );
        });
      };

      recorder.start(250);
      recordingStartedAtRef.current =
        performance.now();

      updateStage(
        "recording",
        `Recording the active ${view} view. Playback will stop the recording automatically.`,
      );

      runPlaybackMonitor();
    } catch (error) {
      cleanupRecordingResources();
      updateStage(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to start reconstruction recording.",
      );
    }
  }, [
    cleanupRecordingResources,
    clearArmedPoll,
    clearMonitor,
    drawTwoDimensionalFrame,
    runPlaybackMonitor,
    saveRecordedFootage,
    stopMediaTracks,
    updateStage,
  ]);

  const startWaitingForPlayback =
    useCallback(() => {
      clearArmedPoll();

      armedPollRef.current = window.setInterval(
        () => {
          if (
            stageRef.current !== "armed"
          ) {
            clearArmedPoll();
            return;
          }

          if (playbackIsRunning()) {
            void startMediaRecording();
          }
        },
        90,
      );
    }, [
      clearArmedPoll,
      startMediaRecording,
    ]);

  const armRecorder = useCallback(async () => {
    if (
      stageRef.current === "preparing" ||
      stageRef.current === "saving"
    ) {
      return;
    }

    clearResetTimer();
    cleanupRecordingResources();

    if (
      reconstruction.vehicles.length === 0
    ) {
      updateStage(
        "error",
        "Add at least one scene participant before recording footage.",
      );
      return;
    }

    if (
      !ReconstructionFootageService.isSupported()
    ) {
      updateStage(
        "error",
        "This browser does not support reconstruction video recording and IndexedDB footage storage.",
      );
      return;
    }

    try {
      updateStage(
        "preparing",
        "Preparing physics and resetting playback to the beginning…",
      );

      const source = onBeforeRecord
        ? await onBeforeRecord()
        : reconstruction;

      recordingSourceRef.current = source;

      const hiddenCanvas =
        hiddenCanvasRef.current;

      if (hiddenCanvas) {
        hiddenCanvas.width =
          STANDARD_RECORDING_WIDTH;
        hiddenCanvas.height =
          STANDARD_RECORDING_HEIGHT;
        drawTwoDimensionalFrame(0);
      }

      updateStage(
        "armed",
        `Recorder armed for ${readActiveView()}. Press Play in the playback controls.`,
      );

      startWaitingForPlayback();
    } catch (error) {
      cleanupRecordingResources();
      updateStage(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to prepare the reconstruction for recording.",
      );
    }
  }, [
    cleanupRecordingResources,
    clearResetTimer,
    drawTwoDimensionalFrame,
    onBeforeRecord,
    reconstruction,
    startWaitingForPlayback,
    updateStage,
  ]);

  const cancelArmedRecording = useCallback(() => {
    cleanupRecordingResources();
    updateStage(
      "idle",
      "Recording cancelled. The reconstruction was not changed.",
    );
  }, [
    cleanupRecordingResources,
    updateStage,
  ]);

  const handleButtonClick = () => {
    switch (stageRef.current) {
      case "armed":
        cancelArmedRecording();
        break;
      case "recording":
        finishRecording(true);
        break;
      case "idle":
      case "error":
      case "saved":
        void armRecorder();
        break;
      case "preparing":
      case "saving":
        break;
    }
  };

  useEffect(() => {
    return () => {
      clearResetTimer();
      cleanupRecordingResources();
    };
  }, [
    cleanupRecordingResources,
    clearResetTimer,
  ]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <canvas
        ref={hiddenCanvasRef}
        width={STANDARD_RECORDING_WIDTH}
        height={STANDARD_RECORDING_HEIGHT}
        aria-hidden="true"
        className="pointer-events-none fixed -left-[10000px] -top-[10000px] h-[720px] w-[1280px] opacity-0"
      />

      <button
        type="button"
        onClick={handleButtonClick}
        disabled={
          stage === "preparing" ||
          stage === "saving"
        }
        className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-md border px-3 py-2 text-[9px] font-bold transition-colors disabled:cursor-wait disabled:opacity-70 ${getButtonClasses(
          stage,
        )}`}
        title={statusMessage}
      >
        {getButtonContent(stage)}
      </button>

      {stage !== "idle" && (
        <span
          role={
            stage === "error"
              ? "alert"
              : "status"
          }
          className={`hidden max-w-[260px] truncate rounded border px-2 py-1 text-[7px] font-semibold xl:inline ${
            stage === "recording"
              ? "border-[#713646] bg-[#321722] text-[#e28b9d]"
              : stage === "armed"
                ? "border-[#6d5523] bg-[#241d10] text-[#d9bd78]"
                : stage === "saved"
                  ? "border-[#494949] bg-[#303030] text-[#c4c4c4]"
                  : stage === "error"
                    ? "border-[#713646] bg-[#321722] text-[#e28b9d]"
                    : "border-[#494949] bg-[#303030] text-[#c4c4c4]"
          }`}
          title={statusMessage}
        >
          {stage === "recording" && (
            <Circle
              size={7}
              fill="currentColor"
              className="mr-1 inline animate-pulse"
            />
          )}
          {statusMessage}
        </span>
      )}
    </div>
  );
}
