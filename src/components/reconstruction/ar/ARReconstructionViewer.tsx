import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Compass,
  Crosshair,
  Eye,
  Layers3,
  LocateFixed,
  Lock,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Smartphone,
  Unlock,
  X,
} from "../../icons/materialIcons";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { ARAlignmentService } from "../../../services/arAlignmentService";
import type {
  ARCalibrationStage,
  ARExperienceMode,
  ARSceneAlignment,
  ARSupportState,
} from "../../../types/arReconstruction";
import type { GeoCoordinate } from "../../../types/fieldPlacement";
import type { AccidentReconstruction } from "../../../types/reconstruction";
import {
  createARReconstructionScene,
  type ARAssetProgress,
  type ARLayerVisibility,
  type ARSceneRuntime,
} from "./ARSceneFactory";

interface ARReconstructionViewerProps {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  recordedBy: string;
  reconstruction: AccidentReconstruction;
  onExit(): void;
}

interface WebXRReferenceSpaceLike {
  readonly type?: string;
}

interface WebXRHitTestSourceLike {
  cancel?(): void;
}

interface WebXRTransformLike {
  matrix: ArrayLike<number>;
}

interface WebXRPoseLike {
  transform: WebXRTransformLike;
}

interface WebXRHitResultLike {
  getPose(
    referenceSpace: WebXRReferenceSpaceLike,
  ): WebXRPoseLike | null;
}

interface WebXRFrameLike {
  getHitTestResults(
    source: WebXRHitTestSourceLike,
  ): WebXRHitResultLike[];
}

interface WebXRSessionLike extends EventTarget {
  end(): Promise<void>;
  requestReferenceSpace(
    type:
      | "viewer"
      | "local"
      | "local-floor",
  ): Promise<WebXRReferenceSpaceLike>;
  requestHitTestSource?(
    options: {
      space: WebXRReferenceSpaceLike;
    },
  ): Promise<WebXRHitTestSourceLike>;
}

interface WebXRSystemLike {
  isSessionSupported(
    mode: "immersive-ar",
  ): Promise<boolean>;
  requestSession(
    mode: "immersive-ar",
    options: {
      requiredFeatures: string[];
      optionalFeatures: string[];
      domOverlay?: {
        root: Element;
      };
    },
  ): Promise<WebXRSessionLike>;
}

interface OrientationEventWithPermission {
  requestPermission?: () => Promise<
    "granted" | "denied"
  >;
}

interface CompassOrientationEvent
  extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

interface PlacementPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

type ARPropertiesTab =
  | "alignment"
  | "layers"
  | "playback"
  | "session";

const DEFAULT_LAYERS: ARLayerVisibility = {
  paths: true,
  objects: true,
  evidence: true,
  collisionPoint: true,
  roadGuide: false,
  physicsEffects: true,
};

function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value,
    ),
  );
}

function normaliseHeading(
  value: number,
): number {
  const result =
    value % 360;

  return result < 0
    ? result + 360
    : result;
}

function formatTime(
  value: number,
): string {
  const minutes =
    Math.floor(value / 60);

  const seconds =
    Math.max(
      0,
      value -
        minutes * 60,
    );

  return `${minutes}:${seconds
    .toFixed(1)
    .padStart(4, "0")}`;
}

function getXRSystem():
  | WebXRSystemLike
  | undefined {
  return (
    navigator as Navigator & {
      xr?: WebXRSystemLike;
    }
  ).xr;
}

function requestLocation():
  Promise<GeoCoordinate | undefined> {
  if (
    !navigator.geolocation
  ) {
    return Promise.resolve(
      undefined,
    );
  }

  return new Promise(
    (resolve) => {
      navigator.geolocation
        .getCurrentPosition(
          (position) => {
            resolve({
              latitude:
                position.coords
                  .latitude,
              longitude:
                position.coords
                  .longitude,
              accuracyMetres:
                position.coords
                  .accuracy,
              capturedAt:
                new Date(
                  position.timestamp,
                ).toISOString(),
            });
          },
          () => {
            resolve(undefined);
          },
          {
            enableHighAccuracy: true,
            timeout: 12_000,
            maximumAge: 5_000,
          },
        );
    },
  );
}

function makeReticle():
  THREE.Group {
  const group =
    new THREE.Group();

  const ring =
    new THREE.Mesh(
      new THREE.RingGeometry(
        0.08,
        0.11,
        32,
      ).rotateX(
        -Math.PI / 2,
      ),
      new THREE.MeshBasicMaterial({
        color: 0x5eead4,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
      }),
    );

  const crossMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

  const horizontal =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.26,
        0.006,
        0.012,
      ),
      crossMaterial,
    );

  const vertical =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.012,
        0.006,
        0.26,
      ),
      crossMaterial.clone(),
    );

  horizontal.position.y =
    0.003;

  vertical.position.y =
    0.003;

  group.add(
    ring,
    horizontal,
    vertical,
  );

  group.matrixAutoUpdate = false;
  group.visible = false;

  return group;
}

export default function ARReconstructionViewer({
  caseId,
  caseNumber,
  caseTitle,
  recordedBy,
  reconstruction,
  onExit,
}: ARReconstructionViewerProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const mountRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const rendererRef =
    useRef<THREE.WebGLRenderer | null>(
      null,
    );

  const sceneRef =
    useRef<THREE.Scene | null>(
      null,
    );

  const cameraRef =
    useRef<THREE.PerspectiveCamera | null>(
      null,
    );

  const controlsRef =
    useRef<OrbitControls | null>(
      null,
    );

  const runtimeRef =
    useRef<ARSceneRuntime | null>(
      null,
    );

  const placementRootRef =
    useRef<THREE.Group | null>(
      null,
    );

  const basePlacementRef =
    useRef<PlacementPose | null>(
      null,
    );

  const reticleRef =
    useRef<THREE.Group | null>(
      null,
    );

  const sessionRef =
    useRef<WebXRSessionLike | null>(
      null,
    );

  const hitSourceRef =
    useRef<WebXRHitTestSourceLike | null>(
      null,
    );

  const localReferenceRef =
    useRef<WebXRReferenceSpaceLike | null>(
      null,
    );

  const latestHitMatrixRef =
    useRef<THREE.Matrix4 | null>(
      null,
    );

  const mediaStreamRef =
    useRef<MediaStream | null>(
      null,
    );

  const playingRef =
    useRef(false);

  const speedRef =
    useRef(1);

  const timeRef =
    useRef(0);

  const layersRef =
    useRef(DEFAULT_LAYERS);

  const calibrationStageRef =
    useRef<ARCalibrationStage>(
      "permissions",
    );

  const lastFrameRef =
    useRef(performance.now());

  const lastUiUpdateRef =
    useRef(0);

  const savedAlignment =
    useMemo(
      () =>
        ARAlignmentService.get(
          caseId,
          reconstruction.id,
        ),
      [
        caseId,
        reconstruction.id,
      ],
    );

  const [support, setSupport] =
    useState<ARSupportState>(
      "checking",
    );

  const [mode, setMode] =
    useState<ARExperienceMode | null>(
      null,
    );

  const [
    calibrationStage,
    setCalibrationStage,
  ] =
    useState<ARCalibrationStage>(
      "permissions",
    );

  const [statusMessage, setStatusMessage] =
    useState(
      "Checking this device for immersive AR support.",
    );

  const [error, setError] =
    useState("");

  const [location, setLocation] =
    useState<GeoCoordinate | undefined>(
      savedAlignment
        ?.siteCoordinate,
    );

  const [
    deviceHeading,
    setDeviceHeading,
  ] =
    useState<number | undefined>(
      savedAlignment
        ?.deviceHeadingDegrees,
    );

  const [heading, setHeading] =
    useState(
      savedAlignment
        ?.headingDegrees ??
      0,
    );

  const [sceneScale, setSceneScale] =
    useState(
      savedAlignment
        ?.scale ??
      1,
    );

  const [
    groundOffset,
    setGroundOffset,
  ] =
    useState(
      savedAlignment
        ?.groundOffsetMetres ??
      0,
    );

  const [layers, setLayers] =
    useState<ARLayerVisibility>(
      DEFAULT_LAYERS,
    );

  const [isPlaying, setIsPlaying] =
    useState(false);

  const [displayTime, setDisplayTime] =
    useState(0);

  const [playbackSpeed, setPlaybackSpeed] =
    useState(1);

  const [assets, setAssets] =
    useState<ARAssetProgress>({
      loaded: 0,
      total: 0,
      failed: 0,
    });

  const [
    permissionsRequested,
    setPermissionsRequested,
  ] =
    useState(false);

  const [
    sessionActive,
    setSessionActive,
  ] =
    useState(false);

  const [arPropertiesOpen, setARPropertiesOpen] =
    useState(true);

  const [arPropertiesTab, setARPropertiesTab] =
    useState<ARPropertiesTab>("alignment");

  useEffect(() => {
    calibrationStageRef.current =
      calibrationStage;
  }, [calibrationStage]);

  useEffect(() => {
    playingRef.current =
      isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    speedRef.current =
      playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    layersRef.current =
      layers;

    runtimeRef.current?.setLayers(
      layers,
    );
  }, [layers]);

  const applyAlignment =
    useCallback(() => {
      const placementRoot =
        placementRootRef.current;

      const basePlacement =
        basePlacementRef.current;

      if (
        !placementRoot ||
        !basePlacement
      ) {
        return;
      }

      placementRoot.position.copy(
        basePlacement.position,
      );

      placementRoot.position.y +=
        groundOffset;

      placementRoot.quaternion.copy(
        basePlacement.quaternion,
      );

      placementRoot.rotateY(
        -THREE.MathUtils.degToRad(
          heading,
        ),
      );

      const modeScale =
        mode ===
        "camera-overlay"
          ? 0.12
          : 1;

      const effectiveScale =
        sceneScale *
        modeScale;

      placementRoot.scale.setScalar(
        effectiveScale,
      );
    }, [
      groundOffset,
      heading,
      mode,
      sceneScale,
    ]);

  useEffect(() => {
    applyAlignment();
  }, [applyAlignment]);

  useEffect(() => {
    const xr =
      getXRSystem();

    if (
      !window.isSecureContext
    ) {
      setSupport(
        "camera-overlay",
      );

      setStatusMessage(
        "Immersive WebXR AR requires HTTPS. Camera overlay remains available.",
      );

      return;
    }

    if (!xr) {
      setSupport(
        "camera-overlay",
      );

      setStatusMessage(
        "This browser has no immersive WebXR AR interface. Camera overlay remains available.",
      );

      return;
    }

    let cancelled = false;

    void xr
      .isSessionSupported(
        "immersive-ar",
      )
      .then(
        (supported) => {
          if (cancelled) {
            return;
          }

          setSupport(
            supported
              ? "immersive-ar"
              : "camera-overlay",
          );

          setStatusMessage(
            supported
              ? "Immersive AR is available. Start the session and scan the collision surface."
              : "Immersive AR is unavailable on this device. Use the camera-overlay fallback.",
          );
        },
      )
      .catch(
        (requestError) => {
          if (cancelled) {
            return;
          }

          console.warn(
            "WebXR support detection failed.",
            requestError,
          );

          setSupport(
            "camera-overlay",
          );

          setStatusMessage(
            "RoadSafe could not verify immersive AR. Camera overlay remains available.",
          );
        },
      );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const mount =
      mountRef.current;

    if (!mount) {
      return;
    }

    const scene =
      new THREE.Scene();

    sceneRef.current =
      scene;

    const camera =
      new THREE.PerspectiveCamera(
        58,
        1,
        0.01,
        2_000,
      );

    camera.position.set(
      0,
      1.65,
      7,
    );

    camera.lookAt(
      0,
      0,
      0,
    );

    cameraRef.current =
      camera;

    const renderer =
      new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference:
          "high-performance",
        preserveDrawingBuffer:
          false,
      });

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        1.5,
      ),
    );

    renderer.outputColorSpace =
      THREE.SRGBColorSpace;

    renderer.toneMapping =
      THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure =
      1.05;

    renderer.shadowMap.enabled =
      true;

    renderer.shadowMap.type =
      THREE.PCFSoftShadowMap;

    renderer.xr.enabled = true;

    renderer.xr.setReferenceSpaceType(
      "local",
    );

    renderer.domElement.style.position =
      "absolute";

    renderer.domElement.style.inset =
      "0";

    renderer.domElement.style.width =
      "100%";

    renderer.domElement.style.height =
      "100%";

    mount.replaceChildren(
      renderer.domElement,
    );

    rendererRef.current =
      renderer;

    const ambient =
      new THREE.HemisphereLight(
        0xffffff,
        0x263238,
        1.45,
      );

    scene.add(ambient);

    const keyLight =
      new THREE.DirectionalLight(
        0xffffff,
        1.8,
      );

    keyLight.position.set(
      -10,
      18,
      12,
    );

    keyLight.castShadow = true;
    scene.add(keyLight);

    const placementRoot =
      new THREE.Group();

    placementRoot.visible = false;

    scene.add(
      placementRoot,
    );

    placementRootRef.current =
      placementRoot;

    const runtime =
      createARReconstructionScene({
        reconstruction,
        onAssetProgress:
          setAssets,
      });

    runtime.setLayers(
      layersRef.current,
    );

    placementRoot.add(
      runtime.root,
    );

    runtimeRef.current =
      runtime;

    const reticle =
      makeReticle();

    scene.add(reticle);

    reticleRef.current =
      reticle;

    const controls =
      new OrbitControls(
        camera,
        renderer.domElement,
      );

    controls.enableDamping = true;
    controls.enabled = false;
    controls.target.set(
      0,
      0,
      0,
    );

    controlsRef.current =
      controls;

    const resize = () => {
      const rect =
        mount.getBoundingClientRect();

      const width =
        Math.max(
          1,
          rect.width,
        );

      const height =
        Math.max(
          1,
          rect.height,
        );

      renderer.setSize(
        width,
        height,
        false,
      );

      camera.aspect =
        width /
        height;

      camera.updateProjectionMatrix();
    };

    const resizeObserver =
      new ResizeObserver(
        resize,
      );

    resizeObserver.observe(
      mount,
    );

    resize();

    lastFrameRef.current =
      performance.now();

    renderer.setAnimationLoop(
      (
        now,
        frame,
      ) => {
        const previous =
          lastFrameRef.current;

        const delta =
          Math.min(
            0.05,
            Math.max(
              0,
              (
                now -
                previous
              ) /
                1_000,
            ),
          );

        lastFrameRef.current =
          now;

        if (
          playingRef.current
        ) {
          timeRef.current =
            Math.min(
              reconstruction.durationSeconds,
              timeRef.current +
                delta *
                  speedRef.current,
            );

          if (
            timeRef.current >=
            reconstruction.durationSeconds
          ) {
            playingRef.current =
              false;

            setIsPlaying(
              false,
            );
          }
        }

        runtime.update(
          timeRef.current,
          layersRef.current
            .physicsEffects,
        );

        if (
          frame &&
          hitSourceRef.current &&
          localReferenceRef.current &&
          calibrationStageRef.current ===
            "scan"
        ) {
          const xrFrame =
            frame as unknown as WebXRFrameLike;

          const results =
            xrFrame.getHitTestResults(
              hitSourceRef.current,
            );

          const pose =
            results[0]?.getPose(
              localReferenceRef.current,
            );

          if (pose) {
            const matrix =
              new THREE.Matrix4();

            matrix.fromArray(
              pose.transform.matrix,
            );

            latestHitMatrixRef.current =
              matrix;

            reticle.matrix.copy(
              matrix,
            );

            reticle.visible =
              true;
          } else {
            reticle.visible =
              false;
          }
        } else if (
          calibrationStageRef.current !==
          "scan"
        ) {
          reticle.visible =
            false;
        }

        controls.update();

        if (
          now -
            lastUiUpdateRef.current >
          100
        ) {
          lastUiUpdateRef.current =
            now;

          setDisplayTime(
            timeRef.current,
          );
        }

        renderer.render(
          scene,
          camera,
        );
      },
    );

    return () => {
      resizeObserver.disconnect();
      renderer.setAnimationLoop(
        null,
      );

      controls.dispose();
      runtime.dispose();

      hitSourceRef.current
        ?.cancel?.();

      hitSourceRef.current =
        null;

      latestHitMatrixRef.current =
        null;

      renderer.dispose();

      mount.replaceChildren();

      runtimeRef.current =
        null;

      rendererRef.current =
        null;

      sceneRef.current =
        null;

      cameraRef.current =
        null;

      controlsRef.current =
        null;

      placementRootRef.current =
        null;

      reticleRef.current =
        null;
    };
  }, [reconstruction]);

  useEffect(() => {
    const orientationHandler = (
      event: DeviceOrientationEvent,
    ) => {
      const compass =
        event as CompassOrientationEvent;

      const headingValue =
        Number.isFinite(
          compass
            .webkitCompassHeading,
        )
          ? compass.webkitCompassHeading
          : Number.isFinite(
                event.alpha,
              )
            ? 360 -
              Number(
                event.alpha,
              )
            : undefined;

      if (
        headingValue === undefined
      ) {
        return;
      }

      setDeviceHeading(
        normaliseHeading(
          headingValue,
        ),
      );
    };

    window.addEventListener(
      "deviceorientationabsolute",
      orientationHandler,
      true,
    );

    window.addEventListener(
      "deviceorientation",
      orientationHandler,
      true,
    );

    return () => {
      window.removeEventListener(
        "deviceorientationabsolute",
        orientationHandler,
        true,
      );

      window.removeEventListener(
        "deviceorientation",
        orientationHandler,
        true,
      );
    };
  }, []);

  const requestFieldPermissions =
    useCallback(async () => {
      setError("");
      setPermissionsRequested(
        true,
      );

      const orientationConstructor =
        DeviceOrientationEvent as unknown as OrientationEventWithPermission;

      if (
        typeof orientationConstructor
          .requestPermission ===
        "function"
      ) {
        try {
          const permission =
            await orientationConstructor
              .requestPermission();

          if (
            permission !==
            "granted"
          ) {
            setStatusMessage(
              "Device orientation was not granted. Manual heading adjustment remains available.",
            );
          }
        } catch (requestError) {
          console.warn(
            "Device orientation permission failed.",
            requestError,
          );
        }
      }

      const coordinate =
        await requestLocation();

      if (coordinate) {
        setLocation(
          coordinate,
        );

        setStatusMessage(
          "Field permissions are ready. Start AR and scan the real collision surface.",
        );
      } else {
        setStatusMessage(
          "Location was unavailable. AR placement can continue using visual surface tracking.",
        );
      }

      setCalibrationStage(
        "scan",
      );
    }, []);

  const stopMediaStream =
    useCallback(() => {
      const stream =
        mediaStreamRef.current;

      if (stream) {
        for (
          const track
          of stream.getTracks()
        ) {
          track.stop();
        }
      }

      mediaStreamRef.current =
        null;

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          null;
      }
    }, []);

  const endActiveSession =
    useCallback(async () => {
      const session =
        sessionRef.current;

      sessionRef.current =
        null;

      hitSourceRef.current
        ?.cancel?.();

      hitSourceRef.current =
        null;

      localReferenceRef.current =
        null;

      latestHitMatrixRef.current =
        null;

      if (session) {
        try {
          await session.end();
        } catch (requestError) {
          console.warn(
            "RoadSafe could not close the AR session cleanly.",
            requestError,
          );
        }
      }

      stopMediaStream();

      setSessionActive(
        false,
      );

      setMode(null);

      const placementRoot =
        placementRootRef.current;

      if (placementRoot) {
        placementRoot.visible =
          false;
      }

      basePlacementRef.current =
        null;

      setCalibrationStage(
        "permissions",
      );

      setIsPlaying(false);
      playingRef.current =
        false;

      setStatusMessage(
        "AR session ended. Start another session to place the reconstruction again.",
      );
    }, [stopMediaStream]);

  useEffect(() => {
    return () => {
      void endActiveSession();
    };
  }, [endActiveSession]);

  const placeAtLatestHit =
    useCallback(() => {
      const matrix =
        latestHitMatrixRef.current;

      const placementRoot =
        placementRootRef.current;

      if (
        !matrix ||
        !placementRoot
      ) {
        setStatusMessage(
          "No real surface is detected yet. Move the phone slowly until the turquoise collision reticle appears.",
        );
        return;
      }

      const position =
        new THREE.Vector3();

      const quaternion =
        new THREE.Quaternion();

      const scale =
        new THREE.Vector3();

      matrix.decompose(
        position,
        quaternion,
        scale,
      );

      basePlacementRef.current =
        {
          position,
          quaternion,
        };

      placementRoot.visible =
        true;

      setCalibrationStage(
        "heading",
      );

      if (
        deviceHeading !==
          undefined &&
        !savedAlignment
      ) {
        setHeading(
          normaliseHeading(
            deviceHeading,
          ),
        );
      }

      setStatusMessage(
        "Collision origin placed. Rotate the reconstruction until participant paths follow the real road.",
      );

      window.setTimeout(
        applyAlignment,
        0,
      );
    }, [
      applyAlignment,
      deviceHeading,
      savedAlignment,
    ]);

  const startImmersiveAR =
    useCallback(async () => {
      setError("");

      if (
        !window.isSecureContext
      ) {
        setError(
          "Immersive AR requires HTTPS. Open RoadSafe from a secure deployed URL or use the camera-overlay fallback.",
        );
        return;
      }

      const xr =
        getXRSystem();

      const renderer =
        rendererRef.current;

      const container =
        containerRef.current;

      if (
        !xr ||
        !renderer ||
        !container
      ) {
        setError(
          "This browser cannot start an immersive AR session.",
        );
        return;
      }

      try {
        if (
          !permissionsRequested
        ) {
          await requestFieldPermissions();
        }

        const session =
          await xr.requestSession(
            "immersive-ar",
            {
              requiredFeatures: [
                "hit-test",
              ],
              optionalFeatures: [
                "dom-overlay",
                "local-floor",
              ],
              domOverlay: {
                root:
                  container,
              },
            },
          );

        sessionRef.current =
          session;

        const setSession =
          renderer.xr
            .setSession as unknown as (
              value: unknown,
            ) => Promise<void>;

        await setSession.call(
          renderer.xr,
          session,
        );

        const viewerSpace =
          await session.requestReferenceSpace(
            "viewer",
          );

        const localSpace =
          await session.requestReferenceSpace(
            "local",
          );

        localReferenceRef.current =
          localSpace;

        if (
          !session.requestHitTestSource
        ) {
          throw new Error(
            "This AR session does not expose surface hit testing.",
          );
        }

        hitSourceRef.current =
          await session.requestHitTestSource({
            space:
              viewerSpace,
          });

        const endHandler = () => {
          sessionRef.current =
            null;

          hitSourceRef.current =
            null;

          localReferenceRef.current =
            null;

          latestHitMatrixRef.current =
            null;

          setSessionActive(
            false,
          );

          setMode(null);

          setCalibrationStage(
            "permissions",
          );

          setStatusMessage(
            "Immersive AR session ended.",
          );
        };

        session.addEventListener(
          "end",
          endHandler,
          {
            once: true,
          },
        );

        session.addEventListener(
          "select",
          () => {
            if (
              calibrationStageRef.current ===
              "scan"
            ) {
              placeAtLatestHit();
            }
          },
        );

        setMode(
          "immersive-ar",
        );

        setSessionActive(
          true,
        );

        setCalibrationStage(
          "scan",
        );

        setStatusMessage(
          "Move the phone slowly. When the turquoise reticle rests on the real collision point, tap Place collision origin.",
        );
      } catch (requestError) {
        console.error(
          "Immersive AR startup failed.",
          requestError,
        );

        setError(
          requestError instanceof Error
            ? requestError.message
            : "RoadSafe could not start immersive AR.",
        );

        sessionRef.current =
          null;

        hitSourceRef.current =
          null;

        localReferenceRef.current =
          null;

        setSessionActive(
          false,
        );
      }
    }, [
      permissionsRequested,
      placeAtLatestHit,
      requestFieldPermissions,
    ]);

  const startCameraOverlay =
    useCallback(async () => {
      setError("");

      try {
        if (
          !permissionsRequested
        ) {
          await requestFieldPermissions();
        }

        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              video: {
                facingMode: {
                  ideal:
                    "environment",
                },
                width: {
                  ideal:
                    1_920,
                },
                height: {
                  ideal:
                    1_080,
                },
              },
              audio: false,
            });

        mediaStreamRef.current =
          stream;

        if (
          videoRef.current
        ) {
          videoRef.current.srcObject =
            stream;

          await videoRef.current.play();
        }

        const placementRoot =
          placementRootRef.current;

        const camera =
          cameraRef.current;

        if (
          !placementRoot ||
          !camera
        ) {
          throw new Error(
            "The RoadSafe AR renderer is not ready.",
          );
        }

        basePlacementRef.current =
          {
            position:
              new THREE.Vector3(
                0,
                -1.35,
                -7,
              ),
            quaternion:
              new THREE.Quaternion(),
          };

        camera.position.set(
          0,
          1.65,
          0,
        );

        camera.lookAt(
          0,
          0,
          -7,
        );

        placementRoot.visible =
          true;

        setMode(
          "camera-overlay",
        );

        setSessionActive(
          true,
        );

        setCalibrationStage(
          "heading",
        );

        setStatusMessage(
          "Camera overlay started. Use heading, height and scale controls to align the collision point with the real road.",
        );

        window.setTimeout(
          applyAlignment,
          0,
        );
      } catch (requestError) {
        console.error(
          "Camera overlay startup failed.",
          requestError,
        );

        setError(
          requestError instanceof Error
            ? requestError.message
            : "RoadSafe could not start the camera overlay.",
        );

        stopMediaStream();
      }
    }, [
      applyAlignment,
      permissionsRequested,
      requestFieldPermissions,
      stopMediaStream,
    ]);

  const startDesktopPreview =
    useCallback(() => {
      stopMediaStream();

      const renderer =
        rendererRef.current;

      const placementRoot =
        placementRootRef.current;

      const camera =
        cameraRef.current;

      const scene =
        sceneRef.current;

      const controls =
        controlsRef.current;

      if (
        !renderer ||
        !placementRoot ||
        !camera ||
        !scene ||
        !controls
      ) {
        return;
      }

      scene.background =
        new THREE.Color(
          0x202020,
        );

      basePlacementRef.current =
        {
          position:
            new THREE.Vector3(
              0,
              0,
              0,
            ),
          quaternion:
            new THREE.Quaternion(),
        };

      camera.position.set(
        18,
        16,
        18,
      );

      controls.enabled = true;
      controls.target.set(
        0,
        0,
        0,
      );

      placementRoot.visible =
        true;

      setMode(
        "desktop-preview",
      );

      setSessionActive(
        true,
      );

      setCalibrationStage(
        "locked",
      );

      setStatusMessage(
        "Desktop preview is active. Immersive placement must be tested on a supported phone over HTTPS.",
      );

      window.setTimeout(
        applyAlignment,
        0,
      );
    }, [
      applyAlignment,
      stopMediaStream,
    ]);

  const lockAlignment =
    useCallback(() => {
      const alignment:
        ARSceneAlignment = {
        version: 1,
        caseId,
        reconstructionId:
          reconstruction.id,
        mode:
          mode ??
          "immersive-ar",
        headingDegrees:
          normaliseHeading(
            heading,
          ),
        scale:
          sceneScale,
        groundOffsetMetres:
          groundOffset,
        siteCoordinate:
          location,
        deviceHeadingDegrees:
          deviceHeading,
        locationAccuracyMetres:
          location
            ?.accuracyMetres,
        calibratedBy:
          recordedBy ||
          "Unknown officer",
        calibratedAt:
          new Date().toISOString(),
      };

      ARAlignmentService.save(
        alignment,
      );

      setCalibrationStage(
        "locked",
      );

      setStatusMessage(
        "AR alignment locked for this case. Playback controls are now active.",
      );

      setIsPlaying(false);
      playingRef.current =
        false;

      timeRef.current = 0;
      setDisplayTime(0);
    }, [
      caseId,
      deviceHeading,
      groundOffset,
      heading,
      location,
      mode,
      reconstruction.id,
      recordedBy,
      sceneScale,
    ]);

  const resetPlacement =
    useCallback(() => {
      setIsPlaying(false);
      playingRef.current =
        false;

      timeRef.current = 0;
      setDisplayTime(0);

      basePlacementRef.current =
        null;

      latestHitMatrixRef.current =
        null;

      if (
        placementRootRef.current
      ) {
        placementRootRef.current
          .visible =
          false;
      }

      if (
        mode ===
        "immersive-ar"
      ) {
        setCalibrationStage(
          "scan",
        );

        setStatusMessage(
          "Move the phone and place the turquoise reticle on the real collision point again.",
        );
      } else {
        setCalibrationStage(
          "heading",
        );

        basePlacementRef.current =
          {
            position:
              new THREE.Vector3(
                0,
                -1.35,
                -7,
              ),
            quaternion:
              new THREE.Quaternion(),
          };

        if (
          placementRootRef.current
        ) {
          placementRootRef.current
            .visible =
            true;
        }

        window.setTimeout(
          applyAlignment,
          0,
        );
      }
    }, [
      applyAlignment,
      mode,
    ]);

  const restartPlayback =
    useCallback(() => {
      timeRef.current = 0;
      setDisplayTime(0);
      setIsPlaying(false);
      playingRef.current =
        false;

      runtimeRef.current?.update(
        0,
        layersRef.current
          .physicsEffects,
      );
    }, []);

  const toggleLayer =
    useCallback(
      (
        key:
          keyof ARLayerVisibility,
      ) => {
        setLayers(
          (current) => ({
            ...current,
            [key]:
              !current[key],
          }),
        );
      },
      [],
    );

  const playbackReady =
    calibrationStage ===
      "locked";

  const supportLabel =
    support ===
      "immersive-ar"
      ? "Immersive AR ready"
      : support ===
          "camera-overlay"
        ? "Camera overlay available"
        : support ===
            "checking"
          ? "Checking AR support"
          : "AR unavailable";

  return (
    <div
      ref={containerRef}
      className="roadsafe-ar-workstation relative h-[100dvh] min-h-[620px] w-full overflow-hidden"
    >
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover ${
          mode ===
          "camera-overlay"
            ? "block"
            : "hidden"
        }`}
        muted
        playsInline
      />

      <div
        ref={mountRef}
        className="absolute inset-0"
      />

      {!sessionActive && (
        <div className="absolute inset-0 z-20 overflow-y-auto bg-[#303030] p-4">
          <div className="mx-auto flex min-h-full max-w-3xl items-center justify-center">
            <section className="ui-panel w-full overflow-hidden">
              <div className="border-b border-[#494949] p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[#494949] bg-[#303030] text-[#c4c4c4]">
                    <ScanLine size={21} />
                  </span>

                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#c4c4c4]">
                      RoadSafe field AR
                    </p>

                    <h1 className="mt-1 text-xl font-bold text-slate-100">
                      Align {caseNumber} with the real accident scene
                    </h1>

                    <p className="mt-2 text-[10px] leading-5 text-slate-500">
                      Place the virtual collision point on the real road, align
                      the participant routes, then replay the physics-driven
                      reconstruction through the phone camera.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 p-4 md:grid-cols-3">
                <article className="rounded-md border border-[#494949] bg-[#303030] p-4">
                  <Smartphone
                    className="text-[#c4c4c4]"
                    size={18}
                  />
                  <p className="mt-3 text-[10px] font-bold text-slate-200">
                    {supportLabel}
                  </p>
                  <p className="mt-2 text-[9px] leading-4 text-slate-600">
                    {statusMessage}
                  </p>
                </article>

                <article className="rounded-md border border-[#494949] bg-[#303030] p-4">
                  <MapPin
                    className="text-[#c4c4c4]"
                    size={18}
                  />
                  <p className="mt-3 text-[10px] font-bold text-slate-200">
                    Case location
                  </p>
                  <p className="mt-2 text-[9px] leading-4 text-slate-600">
                    {reconstruction.siteCoordinate
                      ? `${reconstruction.siteCoordinate.latitude.toFixed(
                          6,
                        )}, ${reconstruction.siteCoordinate.longitude.toFixed(
                          6,
                        )}`
                      : "No saved site coordinate. Visual surface placement remains available."}
                  </p>
                </article>

                <article className="rounded-md border border-[#494949] bg-[#303030] p-4">
                  <Layers3
                    className="text-[#f4c56a]"
                    size={18}
                  />
                  <p className="mt-3 text-[10px] font-bold text-slate-200">
                    Scene content
                  </p>
                  <p className="mt-2 text-[9px] leading-4 text-slate-600">
                    {reconstruction.vehicles.length} participant(s),{" "}
                    {reconstruction.sceneObjects.length} object(s),{" "}
                    {reconstruction.evidenceRecords.length} evidence marker(s).
                  </p>
                </article>
              </div>

              {savedAlignment && (
                <div className="mx-4 rounded-md border border-[#494949] bg-[#303030] p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 shrink-0 text-[#c4c4c4]"
                      size={14}
                    />
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#c4c4c4]">
                        Saved calibration found
                      </p>
                      <p className="mt-1 text-[9px] leading-4 text-[#6f9f96]">
                        Heading, scale and height will be restored. The collision
                        point must still be placed again because browser AR
                        surface anchors do not persist across sessions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mx-4 mt-3 rounded-md border border-[#713646] bg-[#321722] p-3 text-[9px] leading-4 text-[#e28b9d]">
                  {error}
                </div>
              )}

              <div className="flex flex-wrap gap-2 p-4">
                {support ===
                  "immersive-ar" && (
                  <button
                    type="button"
                    className="ui-button-primary"
                    onClick={() =>
                      void startImmersiveAR()
                    }
                  >
                    <ScanLine size={14} />
                    Start immersive AR
                  </button>
                )}

                <button
                  type="button"
                  className="ui-button"
                  onClick={() =>
                    void startCameraOverlay()
                  }
                >
                  <Camera size={14} />
                  Camera overlay
                </button>

                <button
                  type="button"
                  className="ui-button"
                  onClick={startDesktopPreview}
                >
                  <Eye size={14} />
                  Desktop preview
                </button>

                <button
                  type="button"
                  className="ui-button ml-auto"
                  onClick={onExit}
                >
                  <X size={14} />
                  Exit AR
                </button>
              </div>
            </section>
          </div>
        </div>
      )}

      {sessionActive && (
        <>
{arPropertiesOpen ? (
            <aside
              className="roadsafe-ar-blender-properties reconstruction-workspace__blender-properties"
              aria-label="AR reconstruction properties"
            >
              <nav
                className="reconstruction-workspace__blender-properties-tabs"
                aria-label="AR property categories"
              >
                {(
                  [
                    ["alignment", "Alignment", Compass],
                    ["layers", "Layers", Layers3],
                    ["playback", "Playback", Play],
                    ["session", "Session", Smartphone],
                  ] as const
                ).map(([tab, label, Icon]) => (
                  <button
                    key={tab}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={arPropertiesTab === tab}
                    className={
                      arPropertiesTab === tab
                        ? "is-active"
                        : ""
                    }
                    onClick={() => setARPropertiesTab(tab)}
                  >
                    <Icon size={15} />
                  </button>
                ))}
              </nav>

              <div className="reconstruction-workspace__blender-properties-editor">
                <header className="reconstruction-workspace__blender-properties-header">
                  <div>
                    <span>AR Properties</span>
                    <strong>
                      {arPropertiesTab === "alignment"
                        ? "Real-road alignment"
                        : arPropertiesTab === "layers"
                          ? "Scene visibility"
                          : arPropertiesTab === "playback"
                            ? "Reconstruction playback"
                            : "AR session"}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() => setARPropertiesOpen(false)}
                    aria-label="Hide AR properties"
                    title="Hide properties"
                  >
                    ×
                  </button>
                </header>

                <div className="reconstruction-workspace__blender-properties-content">
                  {arPropertiesTab === "alignment" && (
                    <>
                      <details
                        open
                        className="reconstruction-workspace__blender-properties-section"
                      >
                        <summary>Placement</summary>

                        <div className="reconstruction-workspace__blender-properties-rows">
                          <div>
                            <span>Mode</span>
                            <strong>
                              {mode === "immersive-ar"
                                ? "Immersive AR"
                                : mode === "camera-overlay"
                                  ? "Camera overlay"
                                  : mode === "desktop-preview"
                                    ? "Desktop preview"
                                    : "Not started"}
                            </strong>
                          </div>

                          <div>
                            <span>Stage</span>
                            <strong>{calibrationStage}</strong>
                          </div>

                          <label className="reconstruction-workspace__blender-properties-range-row">
                            <span>Heading</span>
                            <div>
                              <input
                                type="range"
                                min="-180"
                                max="180"
                                step="1"
                                value={heading}
                                onChange={(event) =>
                                  setHeading(
                                    Number(
                                      event.target.value,
                                    ),
                                  )
                                }
                              />
                              <strong>
                                {Math.round(
                                  normaliseHeading(
                                    heading,
                                  ),
                                )}
                                °
                              </strong>
                            </div>
                          </label>

                          <label className="reconstruction-workspace__blender-properties-range-row">
                            <span>Scale</span>
                            <div>
                              <input
                                type="range"
                                min={
                                  mode === "camera-overlay"
                                    ? "0.2"
                                    : "0.5"
                                }
                                max="2"
                                step="0.02"
                                value={sceneScale}
                                onChange={(event) =>
                                  setSceneScale(
                                    Number(
                                      event.target.value,
                                    ),
                                  )
                                }
                              />
                              <strong>
                                {sceneScale.toFixed(2)}
                              </strong>
                            </div>
                          </label>

                          <label className="reconstruction-workspace__blender-properties-range-row">
                            <span>Ground</span>
                            <div>
                              <input
                                type="range"
                                min="-1.5"
                                max="1.5"
                                step="0.02"
                                value={groundOffset}
                                onChange={(event) =>
                                  setGroundOffset(
                                    Number(
                                      event.target.value,
                                    ),
                                  )
                                }
                              />
                              <strong>
                                {groundOffset.toFixed(2)} m
                              </strong>
                            </div>
                          </label>

                          <div>
                            <span>Compass</span>
                            <strong>
                              {deviceHeading !== undefined
                                ? `${Math.round(
                                    deviceHeading,
                                  )}°`
                                : "Unavailable"}
                            </strong>
                          </div>

                          <div>
                            <span>GPS</span>
                            <strong>
                              {location
                                ? `±${Math.round(
                                    location.accuracyMetres,
                                  )} m`
                                : "Unavailable"}
                            </strong>
                          </div>
                        </div>
                      </details>

                      <details
                        open
                        className="reconstruction-workspace__blender-properties-section"
                      >
                        <summary>Calibration Actions</summary>

                        <div className="reconstruction-workspace__blender-properties-actions">
                          {calibrationStage === "scan" && (
                            <button
                              type="button"
                              className="ui-button-primary"
                              onClick={placeAtLatestHit}
                            >
                              <LocateFixed size={13} />
                              Place collision origin
                            </button>
                          )}

                          {deviceHeading !== undefined && (
                            <button
                              type="button"
                              onClick={() =>
                                setHeading(
                                  normaliseHeading(
                                    deviceHeading,
                                  ),
                                )
                              }
                            >
                              <Compass size={13} />
                              Use compass
                            </button>
                          )}

                          {calibrationStage === "heading" && (
                            <>
                              <button
                                type="button"
                                onClick={resetPlacement}
                              >
                                <RefreshCw size={13} />
                                Replace origin
                              </button>

                              <button
                                type="button"
                                className="ui-button-primary"
                                onClick={lockAlignment}
                              >
                                <Lock size={13} />
                                Lock AR scene
                              </button>
                            </>
                          )}

                          {calibrationStage === "locked" && (
                            <button
                              type="button"
                              onClick={() => {
                                setCalibrationStage(
                                  "heading",
                                );
                                setIsPlaying(false);
                                playingRef.current =
                                  false;
                              }}
                            >
                              <Unlock size={13} />
                              Recalibrate
                            </button>
                          )}
                        </div>
                      </details>
                    </>
                  )}

                  {arPropertiesTab === "layers" && (
                    <details
                      open
                      className="reconstruction-workspace__blender-properties-section"
                    >
                      <summary>Viewport Overlays</summary>

                      <div className="reconstruction-workspace__blender-properties-checks">
                        {(
                          [
                            ["paths", "Participant paths"],
                            ["objects", "Scene objects"],
                            ["evidence", "Evidence"],
                            ["collisionPoint", "Collision point"],
                            ["roadGuide", "Road guide"],
                            ["physicsEffects", "Physics effects"],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key}>
                            <input
                              type="checkbox"
                              checked={layers[key]}
                              onChange={() =>
                                toggleLayer(key)
                              }
                            />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                    </details>
                  )}

                  {arPropertiesTab === "playback" && (
                    <>
                      <details
                        open
                        className="reconstruction-workspace__blender-properties-section"
                      >
                        <summary>Transport</summary>

                        <div className="reconstruction-workspace__blender-properties-actions reconstruction-workspace__blender-properties-actions--transport">
                          <button
                            type="button"
                            disabled={!playbackReady}
                            onClick={() =>
                              setIsPlaying(
                                (current) =>
                                  !current,
                              )
                            }
                          >
                            {isPlaying ? (
                              <Pause size={13} />
                            ) : (
                              <Play size={13} />
                            )}
                            {isPlaying
                              ? "Pause"
                              : "Play"}
                          </button>

                          <button
                            type="button"
                            disabled={!playbackReady}
                            onClick={restartPlayback}
                          >
                            <RotateCcw size={13} />
                            Restart
                          </button>
                        </div>

                        <div className="reconstruction-workspace__blender-properties-rows">
                          <label className="reconstruction-workspace__blender-properties-range-row">
                            <span>Time</span>
                            <div>
                              <input
                                type="range"
                                min="0"
                                max={Math.max(
                                  0.1,
                                  reconstruction.durationSeconds,
                                )}
                                step="0.02"
                                value={displayTime}
                                disabled={!playbackReady}
                                onChange={(event) => {
                                  const value =
                                    clamp(
                                      Number(
                                        event.target.value,
                                      ),
                                      0,
                                      reconstruction.durationSeconds,
                                    );

                                  timeRef.current =
                                    value;

                                  setDisplayTime(
                                    value,
                                  );

                                  setIsPlaying(
                                    false,
                                  );

                                  playingRef.current =
                                    false;
                                }}
                              />

                              <strong>
                                {formatTime(
                                  displayTime,
                                )}
                              </strong>
                            </div>
                          </label>

                          <label>
                            <span>Speed</span>
                            <select
                              value={playbackSpeed}
                              disabled={!playbackReady}
                              onChange={(event) =>
                                setPlaybackSpeed(
                                  Number(
                                    event.target.value,
                                  ),
                                )
                              }
                            >
                              <option value="0.25">
                                0.25×
                              </option>
                              <option value="0.5">
                                0.5×
                              </option>
                              <option value="1">
                                1×
                              </option>
                              <option value="2">
                                2×
                              </option>
                            </select>
                          </label>

                          <div>
                            <span>Duration</span>
                            <strong>
                              {formatTime(
                                reconstruction.durationSeconds,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Status</span>
                            <strong>
                              {playbackReady
                                ? isPlaying
                                  ? "Playing"
                                  : "Ready"
                                : "Lock alignment first"}
                            </strong>
                          </div>
                        </div>
                      </details>
                    </>
                  )}

                  {arPropertiesTab === "session" && (
                    <>
                      <details
                        open
                        className="reconstruction-workspace__blender-properties-section"
                      >
                        <summary>Session</summary>

                        <div className="reconstruction-workspace__blender-properties-rows">
                          <div>
                            <span>Case</span>
                            <strong>{caseNumber}</strong>
                          </div>

                          <div>
                            <span>Support</span>
                            <strong>{supportLabel}</strong>
                          </div>

                          <div>
                            <span>Mode</span>
                            <strong>
                              {mode ?? "Not started"}
                            </strong>
                          </div>

                          <div>
                            <span>Calibration</span>
                            <strong>
                              {calibrationStage}
                            </strong>
                          </div>

                          <div>
                            <span>Models</span>
                            <strong>
                              {assets.total > 0
                                ? `${assets.loaded}/${assets.total}`
                                : "—"}
                            </strong>
                          </div>

                          <div>
                            <span>Fallbacks</span>
                            <strong>
                              {assets.failed}
                            </strong>
                          </div>
                        </div>
                      </details>

                      <details
                        open
                        className="reconstruction-workspace__blender-properties-section"
                      >
                        <summary>Status</summary>

                        <p className="roadsafe-ar-blender-properties__status">
                          {statusMessage}
                        </p>

                        {error && (
                          <p className="roadsafe-ar-blender-properties__error">
                            {error}
                          </p>
                        )}

                        <div className="reconstruction-workspace__blender-properties-actions">
                          <button
                            type="button"
                            onClick={() =>
                              void endActiveSession()
                            }
                          >
                            <X size={13} />
                            End AR session
                          </button>
                        </div>
                      </details>
                    </>
                  )}
                </div>
              </div>
            </aside>
          ) : (
            <button
              type="button"
              className="roadsafe-ar-properties-reopen"
              title="Show AR properties"
              aria-label="Show AR properties"
              onClick={() => setARPropertiesOpen(true)}
            >
              <Layers3 size={16} />
            </button>
          )}

          <header className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3">
            <div className="pointer-events-auto mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-md border border-white/15 bg-[#303030] px-3 py-2 backdrop-blur-md">
              <div className="min-w-0">
                <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-[#c4c4c4]">
                  {caseNumber} · {caseTitle}
                </p>
                <p className="mt-1 max-w-2xl truncate text-[8px] text-slate-400">
                  {statusMessage}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {assets.total > 0 && (
                  <span className="rounded border border-white/10 bg-black/20 px-2 py-1 text-[8px] text-slate-300">
                    Models {assets.loaded}/{assets.total}
                    {assets.failed > 0
                      ? ` · ${assets.failed} fallback`
                      : ""}
                  </span>
                )}

                <button
                  type="button"
                  className="ui-icon-button h-8 w-8 bg-[#303030]"
                  title="End AR session"
                  onClick={() =>
                    void endActiveSession()
                  }
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </header>

          {calibrationStage ===
            "scan" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 px-4">
              <section className="pointer-events-auto mx-auto max-w-md rounded-md border border-[#494949] bg-[#303030] p-4 text-center backdrop-blur-md">
                <Crosshair
                  className="mx-auto text-[#5eead4]"
                  size={24}
                />

                <h2 className="mt-3 text-sm font-bold text-slate-100">
                  Place the collision origin
                </h2>

                <p className="mt-2 text-[9px] leading-4 text-slate-400">
                  Aim at the real collision point and move slowly until the
                  turquoise reticle rests on the road surface.
                </p>

                <button
                  type="button"
                  className="ui-button-primary mt-4 w-full"
                  onClick={placeAtLatestHit}
                >
                  <LocateFixed size={14} />
                  Place collision origin
                </button>
              </section>
            </div>
          )}

          {location && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden rounded border border-white/10 bg-black/35 px-2 py-1 text-[8px] text-white/65 sm:block">
              GPS ±
              {Math.round(
                location.accuracyMetres,
              )}{" "}
              m
            </div>
          )}
        </>
      )}

      {support ===
        "unsupported" && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-[#303030] p-4">
          <div className="ui-panel max-w-lg p-6 text-center">
            <AlertTriangle
              className="mx-auto text-[#e28b9d]"
              size={24}
            />
            <h1 className="mt-4 text-lg font-bold text-slate-100">
              AR unavailable
            </h1>
            <p className="mt-2 text-[10px] leading-5 text-slate-500">
              This device has no usable immersive AR or camera interface.
            </p>
            <button
              type="button"
              className="ui-button mt-4"
              onClick={onExit}
            >
              Exit AR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
