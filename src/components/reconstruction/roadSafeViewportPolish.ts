import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface RoadSafeViewportPolish {
  update: () => void;
  resize: () => void;
  dispose: () => void;
}

interface CreateRoadSafeViewportPolishOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  mount: HTMLDivElement;
  widthMetres: number;
  heightMetres: number;
}

type AxisKey =
  | "PX"
  | "NX"
  | "PY"
  | "NY"
  | "PZ"
  | "NZ";

const AXIS_COLOURS = {
  X: 0xd95f5f,
  Y: 0x6cc97d,
  Z: 0x5f8ee6,
} as const;

function eachMaterial(
  material: THREE.Material | THREE.Material[],
  callback: (entry: THREE.Material) => void,
): void {
  const entries =
    Array.isArray(material)
      ? material
      : [material];

  entries.forEach(
    callback,
  );
}

function configureGridMaterial(
  material: THREE.Material | THREE.Material[],
  opacity: number,
): void {
  eachMaterial(
    material,
    (entry) => {
      entry.transparent = true;
      entry.opacity = opacity;
      entry.depthWrite = false;
      entry.polygonOffset = true;
      entry.polygonOffsetFactor = -1;
      entry.polygonOffsetUnits = -1;
      entry.needsUpdate = true;
    },
  );
}

function disposeMaterial(
  material: THREE.Material | THREE.Material[],
): void {
  eachMaterial(
    material,
    (entry) => {
      entry.dispose();
    },
  );
}

function createAxisLine(
  start: THREE.Vector3,
  end: THREE.Vector3,
  colour: number,
  opacity = 0.78,
): THREE.Line {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      start,
      end,
    ]),
    new THREE.LineBasicMaterial({
      color: colour,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
}

function makeLabelSprite(
  text: string,
  colour: string,
): THREE.Sprite {
  const canvas =
    document.createElement("canvas");

  canvas.width = 96;
  canvas.height = 96;

  const context =
    canvas.getContext("2d");

  if (context) {
    context.clearRect(
      0,
      0,
      96,
      96,
    );

    context.beginPath();
    context.arc(
      48,
      48,
      31,
      0,
      Math.PI * 2,
    );

    context.fillStyle =
      "rgba(36, 38, 40, 0.96)";

    context.fill();

    context.lineWidth =
      4;

    context.strokeStyle =
      colour;

    context.stroke();

    context.font =
      "700 32px Arial";

    context.textAlign =
      "center";

    context.textBaseline =
      "middle";

    context.fillStyle =
      colour;

    context.fillText(
      text,
      48,
      50,
    );
  }

  const texture =
    new THREE.CanvasTexture(
      canvas,
    );

  texture.colorSpace =
    THREE.SRGBColorSpace;

  const material =
    new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

  const sprite =
    new THREE.Sprite(
      material,
    );

  sprite.scale.set(
    0.56,
    0.56,
    0.56,
  );

  sprite.userData.labelTexture =
    texture;

  return sprite;
}

function addGizmoAxis(
  root: THREE.Group,
  direction: THREE.Vector3,
  colour: number,
  labelText: string,
  labelColour: string,
  positiveKey: AxisKey,
  negativeKey: AxisKey,
): void {
  const positiveLength =
    1.28;

  const negativeLength =
    0.80;

  const shaft =
    createAxisLine(
      direction
        .clone()
        .multiplyScalar(
          -negativeLength,
        ),
      direction
        .clone()
        .multiplyScalar(
          positiveLength,
        ),
      colour,
      0.95,
    );

  shaft.userData.viewportGizmo =
    true;

  shaft.userData.axisToggle =
    labelText;

  root.add(
    shaft,
  );

  const cone =
    new THREE.Mesh(
      new THREE.ConeGeometry(
        0.12,
        0.28,
        16,
      ),
      new THREE.MeshBasicMaterial({
        color: colour,
        depthTest: false,
        depthWrite: false,
      }),
    );

  cone.position.copy(
    direction
      .clone()
      .multiplyScalar(
        positiveLength +
          0.07,
      ),
  );

  cone.userData.axisToggle =
    labelText;

  const up =
    new THREE.Vector3(
      0,
      1,
      0,
    );

  cone.quaternion.setFromUnitVectors(
    up,
    direction
      .clone()
      .normalize(),
  );

  root.add(
    cone,
  );

  const positiveHit =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.18,
        12,
        10,
      ),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.001,
        depthWrite: false,
      }),
    );

  positiveHit.position.copy(
    direction
      .clone()
      .multiplyScalar(
        1.47,
      ),
  );

  positiveHit.userData.axisKey =
    positiveKey;

  positiveHit.userData.axisToggle =
    labelText;

  root.add(
    positiveHit,
  );

  const negativeHit =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.16,
        12,
        10,
      ),
      new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.001,
        depthWrite: false,
      }),
    );

  negativeHit.position.copy(
    direction
      .clone()
      .multiplyScalar(
        -0.87,
      ),
  );

  negativeHit.userData.axisKey =
    negativeKey;

  negativeHit.userData.axisToggle =
    labelText;

  root.add(
    negativeHit,
  );

  const label =
    makeLabelSprite(
      labelText,
      labelColour,
    );

  label.position.copy(
    direction
      .clone()
      .multiplyScalar(
        1.72,
      ),
  );

  label.userData.axisToggle =
    labelText;

  root.add(
    label,
  );
}

function directionForAxis(
  axisKey: AxisKey,
): THREE.Vector3 {
  switch (axisKey) {
    case "PX":
      return new THREE.Vector3(
        1,
        0,
        0,
      );

    case "NX":
      return new THREE.Vector3(
        -1,
        0,
        0,
      );

    case "PY":
      return new THREE.Vector3(
        0,
        1,
        0,
      );

    case "NY":
      return new THREE.Vector3(
        0,
        -1,
        0,
      );

    case "PZ":
      return new THREE.Vector3(
        0,
        0,
        1,
      );

    case "NZ":
      return new THREE.Vector3(
        0,
        0,
        -1,
      );
  }
}

export function createRoadSafeViewportPolish({
  scene,
  camera,
  controls,
  mount,
  widthMetres,
  heightMetres,
}: CreateRoadSafeViewportPolishOptions): RoadSafeViewportPolish {
  /*
   * [RoadSafe:Main3DViewportPolishV4AxisToggle]
   *
   * Viewport helpers only.
   * No reconstruction state, participant physics or collision geometry
   * is modified here.
   */

  const maxDimension =
    Math.max(
      20,
      widthMetres,
      heightMetres,
    );

  const gridSize =
    Math.ceil(
      (
        maxDimension *
        1.65
      ) /
        10,
    ) *
    10;

  const fineDivisions =
    Math.max(
      20,
      Math.min(
        220,
        Math.round(
          gridSize,
        ),
      ),
    );

  const majorDivisions =
    Math.max(
      4,
      Math.round(
        fineDivisions /
          5,
      ),
    );

  const floor =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        gridSize,
        gridSize,
      ),
      new THREE.MeshStandardMaterial({
        color: 0x26292c,
        roughness: 1,
        metalness: 0,
      }),
    );

  floor.rotation.x =
    -Math.PI / 2;

  floor.position.y =
    -0.08;

  floor.receiveShadow =
    true;

  floor.userData.roadSafeViewportAid =
    true;

  floor.renderOrder =
    -20;

  scene.add(
    floor,
  );

  const fineGrid =
    new THREE.GridHelper(
      gridSize,
      fineDivisions,
      0x555b61,
      0x454b50,
    );

  fineGrid.position.y =
    0.010;

  fineGrid.userData.roadSafeViewportAid =
    true;

  fineGrid.renderOrder =
    1;

  configureGridMaterial(
    fineGrid.material,
    0.28,
  );

  scene.add(
    fineGrid,
  );

  const majorGrid =
    new THREE.GridHelper(
      gridSize,
      majorDivisions,
      0x767d84,
      0x626970,
    );

  majorGrid.position.y =
    0.014;

  majorGrid.userData.roadSafeViewportAid =
    true;

  majorGrid.renderOrder =
    2;

  configureGridMaterial(
    majorGrid.material,
    0.38,
  );

  scene.add(
    majorGrid,
  );

  /*
   * Subtle scene axes.
   * X and Z lie on the ground plane.
   * Y is a short vertical origin reference only.
   */
  const axisLength =
    Math.max(
      5,
      Math.min(
        11,
        maxDimension *
          0.11,
      ),
    );

  const yLength =
    Math.min(
      2.8,
      axisLength *
        0.32,
    );

  const xAxis =
    createAxisLine(
      new THREE.Vector3(
        -axisLength,
        0.022,
        0,
      ),
      new THREE.Vector3(
        axisLength,
        0.022,
        0,
      ),
      AXIS_COLOURS.X,
      0.66,
    );

  const zAxis =
    createAxisLine(
      new THREE.Vector3(
        0,
        0.024,
        -axisLength,
      ),
      new THREE.Vector3(
        0,
        0.024,
        axisLength,
      ),
      AXIS_COLOURS.Z,
      0.66,
    );

  const yAxis =
    createAxisLine(
      new THREE.Vector3(
        0,
        0.024,
        0,
      ),
      new THREE.Vector3(
        0,
        yLength,
        0,
      ),
      AXIS_COLOURS.Y,
      0.72,
    );

  [xAxis, yAxis, zAxis]
    .forEach(
      (axis) => {
        axis.userData.roadSafeViewportAid =
          true;

        axis.renderOrder =
          3;

        scene.add(
          axis,
        );
      },
    );

  /*
   * Dedicated wrapper protects the orientation gizmo from any repo-wide
   * canvas sizing rules.
   */
  const gizmoWrapper =
    document.createElement(
      "div",
    );

  gizmoWrapper.setAttribute(
    "aria-label",
    "3D view orientation gizmo",
  );

  gizmoWrapper.title =
    "View gizmo · click an axis to snap camera";

  const setImportant =
    (
      property: string,
      value: string,
    ) => {
      gizmoWrapper.style.setProperty(
        property,
        value,
        "important",
      );
    };

  setImportant(
    "position",
    "absolute",
  );

  setImportant(
    "right",
    "12px",
  );

  setImportant(
    "bottom",
    "12px",
  );

  setImportant(
    "left",
    "auto",
  );

  setImportant(
    "top",
    "auto",
  );

  setImportant(
    "width",
    "92px",
  );

  setImportant(
    "height",
    "92px",
  );

  setImportant(
    "min-width",
    "92px",
  );

  setImportant(
    "min-height",
    "92px",
  );

  setImportant(
    "max-width",
    "92px",
  );

  setImportant(
    "max-height",
    "92px",
  );

  setImportant(
    "z-index",
    "60",
  );

  setImportant(
    "overflow",
    "hidden",
  );

  setImportant(
    "border",
    "1px solid rgba(80, 84, 88, .95)",
  );

  setImportant(
    "border-radius",
    "4px",
  );

  setImportant(
    "background",
    "rgba(38, 40, 42, .90)",
  );

  setImportant(
    "box-shadow",
    "0 5px 14px rgba(0,0,0,.30)",
  );

  setImportant(
    "pointer-events",
    "auto",
  );

  setImportant(
    "touch-action",
    "none",
  );

  setImportant(
    "user-select",
    "none",
  );

  mount.appendChild(
    gizmoWrapper,
  );

  const gizmoRenderer =
    new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference:
        "low-power",
    });

  gizmoRenderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      1.5,
    ),
  );

  gizmoRenderer.setSize(
    92,
    92,
    false,
  );

  gizmoRenderer.outputColorSpace =
    THREE.SRGBColorSpace;

  gizmoRenderer.setClearColor(
    0x000000,
    0,
  );

  const gizmoCanvas =
    gizmoRenderer.domElement;

  const setCanvasImportant =
    (
      property: string,
      value: string,
    ) => {
      gizmoCanvas.style.setProperty(
        property,
        value,
        "important",
      );
    };

  setCanvasImportant(
    "position",
    "relative",
  );

  setCanvasImportant(
    "display",
    "block",
  );

  setCanvasImportant(
    "inset",
    "auto",
  );

  setCanvasImportant(
    "left",
    "auto",
  );

  setCanvasImportant(
    "right",
    "auto",
  );

  setCanvasImportant(
    "top",
    "auto",
  );

  setCanvasImportant(
    "bottom",
    "auto",
  );

  setCanvasImportant(
    "width",
    "100%",
  );

  setCanvasImportant(
    "height",
    "100%",
  );

  setCanvasImportant(
    "min-width",
    "0",
  );

  setCanvasImportant(
    "min-height",
    "0",
  );

  setCanvasImportant(
    "max-width",
    "100%",
  );

  setCanvasImportant(
    "max-height",
    "100%",
  );

  setCanvasImportant(
    "cursor",
    "pointer",
  );

  setCanvasImportant(
    "touch-action",
    "none",
  );

  gizmoWrapper.appendChild(
    gizmoCanvas,
  );

  const gizmoScene =
    new THREE.Scene();

  const gizmoCamera =
    new THREE.OrthographicCamera(
      -2.35,
      2.35,
      2.35,
      -2.35,
      0.1,
      20,
    );

  const gizmoRoot =
    new THREE.Group();

  gizmoScene.add(
    gizmoRoot,
  );

  const center =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.11,
        16,
        12,
      ),
      new THREE.MeshBasicMaterial({
        color: 0xc4c8cb,
        depthTest: false,
        depthWrite: false,
      }),
    );

  gizmoRoot.add(
    center,
  );

  addGizmoAxis(
    gizmoRoot,
    new THREE.Vector3(
      1,
      0,
      0,
    ),
    AXIS_COLOURS.X,
    "X",
    "#ea7070",
    "PX",
    "NX",
  );

  addGizmoAxis(
    gizmoRoot,
    new THREE.Vector3(
      0,
      1,
      0,
    ),
    AXIS_COLOURS.Y,
    "Y",
    "#83dc90",
    "PY",
    "NY",
  );

  addGizmoAxis(
    gizmoRoot,
    new THREE.Vector3(
      0,
      0,
      1,
    ),
    AXIS_COLOURS.Z,
    "Z",
    "#7ba5ff",
    "PZ",
    "NZ",
  );

  const hitTargets =
    gizmoRoot.children.filter(
      (object) =>
        Boolean(
          object.userData.axisToggle ||
          object.userData.axisKey,
        ),
    );

  const gizmoRaycaster =
    new THREE.Raycaster();

  const gizmoPointer =
    new THREE.Vector2();

  const axisToggleSide: Record<
    "X" | "Y" | "Z",
    1 | -1
  > = {
    X: -1,
    Y: -1,
    Z: -1,
  };

  const toggledAxisKey =
    (
      axis: "X" | "Y" | "Z",
    ): AxisKey => {
      axisToggleSide[axis] =
        axisToggleSide[axis] === 1
          ? -1
          : 1;

      if (axis === "X") {
        return axisToggleSide.X === 1
          ? "PX"
          : "NX";
      }

      if (axis === "Y") {
        return axisToggleSide.Y === 1
          ? "PY"
          : "NY";
      }

      return axisToggleSide.Z === 1
        ? "PZ"
        : "NZ";
    };

  const snapToAxis =
    (
      axisKey: AxisKey,
    ) => {
      if (
        !controls.enabled
      ) {
        return;
      }

      const direction =
        directionForAxis(
          axisKey,
        );

      const target =
        controls.target.clone();

      const distance =
        Math.max(
          4,
          camera.position.distanceTo(
            target,
          ),
        );

      camera.position.copy(
        target
          .clone()
          .addScaledVector(
            direction,
            distance,
          ),
      );

      if (
        axisKey === "PY" ||
        axisKey === "NY"
      ) {
        camera.up.set(
          0,
          0,
          axisKey === "PY"
            ? -1
            : 1,
        );
      } else {
        camera.up.set(
          0,
          1,
          0,
        );
      }

      camera.lookAt(
        target,
      );

      camera.updateMatrixWorld(
        true,
      );

      controls.update();
    };

  const handleGizmoPointerDown =
    (
      event: PointerEvent,
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const rect =
        gizmoCanvas.getBoundingClientRect();

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        return;
      }

      gizmoPointer.x =
        (
          (
            event.clientX -
            rect.left
          ) /
          rect.width
        ) *
          2 -
        1;

      gizmoPointer.y =
        -(
          (
            event.clientY -
            rect.top
          ) /
          rect.height
        ) *
          2 +
        1;

      gizmoRaycaster.setFromCamera(
        gizmoPointer,
        gizmoCamera,
      );

      const hit =
        gizmoRaycaster
          .intersectObjects(
            hitTargets,
            false,
          )[0];

      const axisToggle =
        hit?.object.userData
          .axisToggle as
          | "X"
          | "Y"
          | "Z"
          | undefined;

      if (
        axisToggle
      ) {
        snapToAxis(
          toggledAxisKey(
            axisToggle,
          ),
        );

        return;
      }

      const axisKey =
        hit?.object.userData
          .axisKey as
          | AxisKey
          | undefined;

      if (
        axisKey
      ) {
        snapToAxis(
          axisKey,
        );
      }
    };

  gizmoCanvas.addEventListener(
    "pointerdown",
    handleGizmoPointerDown,
  );

  const forward =
    new THREE.Vector3();

  const cameraUp =
    new THREE.Vector3();

  const update =
    () => {
      camera.getWorldDirection(
        forward,
      );

      cameraUp
        .set(
          0,
          1,
          0,
        )
        .applyQuaternion(
          camera.quaternion,
        )
        .normalize();

      gizmoCamera.position.copy(
        forward
          .clone()
          .multiplyScalar(
            -6,
          ),
      );

      gizmoCamera.up.copy(
        cameraUp,
      );

      gizmoCamera.lookAt(
        0,
        0,
        0,
      );

      gizmoCamera.updateMatrixWorld(
        true,
      );

      gizmoRenderer.render(
        gizmoScene,
        gizmoCamera,
      );
    };

  const resize =
    () => {
      /*
       * Re-assert sizing after parent viewport resizes.
       * This protects against CSS/layout code that mutates canvas size.
       */
      setImportant(
        "width",
        "92px",
      );

      setImportant(
        "height",
        "92px",
      );

      setCanvasImportant(
        "width",
        "100%",
      );

      setCanvasImportant(
        "height",
        "100%",
      );

      gizmoRenderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio,
          1.5,
        ),
      );

      gizmoRenderer.setSize(
        92,
        92,
        false,
      );
    };

  update();

  const dispose =
    () => {
      gizmoCanvas.removeEventListener(
        "pointerdown",
        handleGizmoPointerDown,
      );

      scene.remove(
        floor,
        fineGrid,
        majorGrid,
        xAxis,
        yAxis,
        zAxis,
      );

      floor.geometry.dispose();
      disposeMaterial(
        floor.material,
      );

      fineGrid.geometry.dispose();
      disposeMaterial(
        fineGrid.material,
      );

      majorGrid.geometry.dispose();
      disposeMaterial(
        majorGrid.material,
      );

      [xAxis, yAxis, zAxis]
        .forEach(
          (axis) => {
            axis.geometry.dispose();
            disposeMaterial(
              axis.material,
            );
          },
        );

      gizmoScene.traverse(
        (object) => {
          if (
            object instanceof THREE.Mesh ||
            object instanceof THREE.Line ||
            object instanceof THREE.Sprite
          ) {
            object.geometry?.dispose();

            if (
              object instanceof THREE.Sprite
            ) {
              const texture =
                object.userData
                  .labelTexture as
                  | THREE.Texture
                  | undefined;

              texture?.dispose();
            }

            disposeMaterial(
              object.material,
            );
          }
        },
      );

      gizmoRenderer.dispose();

      if (
        gizmoWrapper.parentElement
      ) {
        gizmoWrapper.remove();
      }
    };

  return {
    update,
    resize,
    dispose,
  };
}
