import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const VIEWER_REL =
  "src/components/reconstruction/Reconstruction3DViewer.tsx";

const HELPER_REL =
  "src/components/reconstruction/roadSafeViewportPolish.ts";

const VIEWER =
  path.join(ROOT, ...VIEWER_REL.split("/"));

const HELPER =
  path.join(ROOT, ...HELPER_REL.split("/"));

const IMPORT_LINE =
  'import { createRoadSafeViewportPolish } from "./roadSafeViewportPolish";';

const INSTALL_MARKER =
  "[RoadSafe:Main3DViewportPolishV2]";

function fail(message, code = 1) {
  console.error("");
  console.error(`[RoadSafe] ${message}`);
  process.exit(code);
}

if (!fs.existsSync(VIEWER)) {
  fail(
    `Could not find ${VIEWER_REL}. Run this installer from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.`,
  );
}

const helperSource = `import * as THREE from "three";
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
  X: 0xe25b5b,
  Y: 0x69c978,
  Z: 0x5d88e5,
} as const;

function eachMaterial(
  material: THREE.Material | THREE.Material[],
  callback: (entry: THREE.Material) => void,
): void {
  const entries =
    Array.isArray(material)
      ? material
      : [material];

  entries.forEach(callback);
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
      canvas.width,
      canvas.height,
    );

    context.beginPath();
    context.arc(
      48,
      48,
      33,
      0,
      Math.PI * 2,
    );
    context.fillStyle =
      "rgba(28, 30, 32, 0.96)";
    context.fill();

    context.lineWidth = 5;
    context.strokeStyle =
      colour;
    context.stroke();

    context.font =
      "700 34px Arial";
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
    0.78,
    0.78,
    0.78,
  );

  sprite.userData.labelTexture =
    texture;

  return sprite;
}

function addAxis(
  root: THREE.Group,
  direction: THREE.Vector3,
  colour: number,
  labelText: string,
  labelColour: string,
  positiveKey: AxisKey,
  negativeKey: AxisKey,
): void {
  const length = 1.72;

  const arrow =
    new THREE.ArrowHelper(
      direction,
      new THREE.Vector3(),
      length,
      colour,
      0.28,
      0.16,
    );

  root.add(
    arrow,
  );

  const negativeMaterial =
    new THREE.LineBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.45,
      depthTest: false,
    });

  const negativeLine =
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        direction
          .clone()
          .multiplyScalar(
            -1.15,
          ),
      ]),
      negativeMaterial,
    );

  root.add(
    negativeLine,
  );

  const positiveHit =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.24,
        16,
        12,
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
        1.78,
      ),
  );

  positiveHit.userData.axisKey =
    positiveKey;

  root.add(
    positiveHit,
  );

  const negativeHit =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.20,
        16,
        12,
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
        -1.18,
      ),
  );

  negativeHit.userData.axisKey =
    negativeKey;

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
        2.08,
      ),
  );

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
   * [RoadSafe:Main3DViewportPolishV2]
   *
   * Viewport helpers only.
   * They are deliberately excluded from reconstruction physics/state.
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
        1.8
      ) /
        10,
    ) *
    10;

  const fineDivisions =
    Math.max(
      20,
      Math.min(
        240,
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

  /*
   * Dark neutral support floor. It extends beyond the forensic polygon,
   * so the 3D viewport no longer ends visually at a floating green slab.
   */
  const floor =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        gridSize,
        gridSize,
      ),
      new THREE.MeshStandardMaterial({
        color: 0x24272a,
        roughness: 1,
        metalness: 0,
      }),
    );

  floor.rotation.x =
    -Math.PI / 2;

  floor.position.y =
    -0.075;

  floor.receiveShadow =
    true;

  floor.userData.roadSafeViewportAid =
    true;

  floor.renderOrder =
    -20;

  scene.add(
    floor,
  );

  /*
   * Fine grid is lifted above the source ground by only a few millimetres.
   * This keeps it visible over opaque extracted terrain without changing
   * any participant/object coordinates.
   */
  const fineGrid =
    new THREE.GridHelper(
      gridSize,
      fineDivisions,
      0x626970,
      0x51575d,
    );

  fineGrid.position.y =
    0.012;

  fineGrid.userData.roadSafeViewportAid =
    true;

  fineGrid.renderOrder =
    1;

  configureGridMaterial(
    fineGrid.material,
    0.34,
  );

  scene.add(
    fineGrid,
  );

  const majorGrid =
    new THREE.GridHelper(
      gridSize,
      majorDivisions,
      0x8b939a,
      0x737b82,
    );

  majorGrid.position.y =
    0.016;

  majorGrid.userData.roadSafeViewportAid =
    true;

  majorGrid.renderOrder =
    2;

  configureGridMaterial(
    majorGrid.material,
    0.50,
  );

  scene.add(
    majorGrid,
  );

  /*
   * World axes:
   * X = East, Y = Up, Z = North.
   */
  const axisLength =
    Math.max(
      7,
      Math.min(
        18,
        maxDimension *
          0.16,
      ),
    );

  const axisOrigin =
    new THREE.Vector3(
      0,
      0.025,
      0,
    );

  const xAxis =
    new THREE.ArrowHelper(
      new THREE.Vector3(
        1,
        0,
        0,
      ),
      axisOrigin,
      axisLength,
      AXIS_COLOURS.X,
      Math.min(
        1.2,
        axisLength * 0.12,
      ),
      Math.min(
        0.65,
        axisLength * 0.07,
      ),
    );

  const yAxis =
    new THREE.ArrowHelper(
      new THREE.Vector3(
        0,
        1,
        0,
      ),
      axisOrigin,
      Math.min(
        7,
        axisLength * 0.55,
      ),
      AXIS_COLOURS.Y,
      0.8,
      0.45,
    );

  const zAxis =
    new THREE.ArrowHelper(
      new THREE.Vector3(
        0,
        0,
        1,
      ),
      axisOrigin,
      axisLength,
      AXIS_COLOURS.Z,
      Math.min(
        1.2,
        axisLength * 0.12,
      ),
      Math.min(
        0.65,
        axisLength * 0.07,
      ),
    );

  [xAxis, yAxis, zAxis]
    .forEach(
      (axis) => {
        axis.userData.roadSafeViewportAid =
          true;

        scene.add(
          axis,
        );
      },
    );

  /*
   * Dedicated orientation overlay renderer.
   * It is its own canvas, so forensic geometry can never occlude it.
   */
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
    116,
    116,
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

  gizmoCanvas.setAttribute(
    "aria-label",
    "3D view orientation gizmo",
  );

  gizmoCanvas.title =
    "View gizmo · click an axis to snap the camera";

  Object.assign(
    gizmoCanvas.style,
    {
      position: "absolute",
      width: "116px",
      height: "116px",
      right: "14px",
      bottom: "14px",
      zIndex: "35",
      border: "1px solid rgba(94, 99, 104, 0.95)",
      borderRadius: "4px",
      background:
        "radial-gradient(circle at center, rgba(55,58,61,.88), rgba(31,33,35,.92))",
      boxShadow:
        "0 6px 18px rgba(0,0,0,.34)",
      cursor: "pointer",
      touchAction: "none",
      userSelect: "none",
    },
  );

  mount.appendChild(
    gizmoCanvas,
  );

  const gizmoScene =
    new THREE.Scene();

  const gizmoCamera =
    new THREE.PerspectiveCamera(
      28,
      1,
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
        0.16,
        20,
        14,
      ),
      new THREE.MeshBasicMaterial({
        color: 0xd2d5d7,
      }),
    );

  gizmoRoot.add(
    center,
  );

  addAxis(
    gizmoRoot,
    new THREE.Vector3(
      1,
      0,
      0,
    ),
    AXIS_COLOURS.X,
    "X",
    "#ef6d6d",
    "PX",
    "NX",
  );

  addAxis(
    gizmoRoot,
    new THREE.Vector3(
      0,
      1,
      0,
    ),
    AXIS_COLOURS.Y,
    "Y",
    "#79df89",
    "PY",
    "NY",
  );

  addAxis(
    gizmoRoot,
    new THREE.Vector3(
      0,
      0,
      1,
    ),
    AXIS_COLOURS.Z,
    "Z",
    "#75a0ff",
    "PZ",
    "NZ",
  );

  const gizmoRaycaster =
    new THREE.Raycaster();

  const gizmoPointer =
    new THREE.Vector2();

  const hitTargets =
    gizmoRoot.children.filter(
      (object) =>
        Boolean(
          object.userData.axisKey,
        ),
    );

  const snapToAxis =
    (axisKey: AxisKey) => {
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

      const axisKey =
        hit?.object.userData
          .axisKey as
          | AxisKey
          | undefined;

      if (axisKey) {
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
            -6.2,
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
      gizmoRenderer.setPixelRatio(
        Math.min(
          window.devicePixelRatio,
          1.5,
        ),
      );

      gizmoRenderer.setSize(
        116,
        116,
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

      if (
        gizmoCanvas.parentElement
      ) {
        gizmoCanvas.remove();
      }

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
            axis.traverse(
              (object) => {
                if (
                  object instanceof THREE.Line
                ) {
                  object.geometry.dispose();
                  disposeMaterial(
                    object.material,
                  );
                } else if (
                  object instanceof THREE.Mesh
                ) {
                  object.geometry.dispose();
                  disposeMaterial(
                    object.material,
                  );
                }
              },
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

            const material =
              object.material;

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
              material,
            );
          }
        },
      );

      gizmoRenderer.dispose();
    };

  return {
    update,
    resize,
    dispose,
  };
}
`;

let viewer =
  fs.readFileSync(
    VIEWER,
    "utf8",
  );

const originalViewer =
  viewer;

const helperExisted =
  fs.existsSync(
    HELPER,
  );

const originalHelper =
  helperExisted
    ? fs.readFileSync(
        HELPER,
        "utf8",
      )
    : null;

if (
  viewer.includes(
    INSTALL_MARKER,
  ) &&
  viewer.includes(
    IMPORT_LINE,
  )
) {
  console.log("");
  console.log(
    "[RoadSafe] Main 3D Viewport Polish V2 is already installed.",
  );
  console.log(
    "[RoadSafe] Rewriting the helper file to the current V2 implementation.",
  );

  fs.writeFileSync(
    HELPER,
    helperSource,
    "utf8",
  );
} else {
  if (
    !viewer.includes(
      IMPORT_LINE,
    )
  ) {
    const importAnchor =
      'import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";';

    if (
      !viewer.includes(
        importAnchor,
      )
    ) {
      fail(
        "Could not locate the TransformControls import. No files were changed.",
      );
    }

    viewer =
      viewer.replace(
        importAnchor,
        `${importAnchor}\n${IMPORT_LINE}`,
      );
  }

  const controlsAnchor =
`    controls.maxPolarAngle = Math.PI / 2.02;`;

  if (
    !viewer.includes(
      controlsAnchor,
    )
  ) {
    fail(
      "Could not locate the OrbitControls setup anchor. No files were changed.",
    );
  }

  viewer =
    viewer.replace(
      controlsAnchor,
`${controlsAnchor}

    /*
     * ${INSTALL_MARKER}
     * Pure viewport helpers: floor grid, world axes and orientation gizmo.
     */
    const viewportPolish =
      createRoadSafeViewportPolish({
        scene,
        camera,
        controls,
        mount,
        widthMetres: width,
        heightMetres: height,
      });`,
    );

  const resizeAnchor =
`      camera.updateProjectionMatrix();`;

  if (
    !viewer.includes(
      resizeAnchor,
    )
  ) {
    fail(
      "Could not locate the viewport resize anchor. No files were changed.",
    );
  }

  viewer =
    viewer.replace(
      resizeAnchor,
`${resizeAnchor}
      viewportPolish.resize();`,
    );

  const renderAnchor =
`      renderer.render(scene, camera);`;

  if (
    !viewer.includes(
      renderAnchor,
    )
  ) {
    fail(
      "Could not locate the main render-loop anchor. No files were changed.",
    );
  }

  viewer =
    viewer.replace(
      renderAnchor,
`      viewportPolish.update();
${renderAnchor}`,
    );

  const cleanupAnchor =
`      controls.dispose();`;

  if (
    !viewer.includes(
      cleanupAnchor,
    )
  ) {
    fail(
      "Could not locate the OrbitControls cleanup anchor. No files were changed.",
    );
  }

  viewer =
    viewer.replace(
      cleanupAnchor,
`      viewportPolish.dispose();
${cleanupAnchor}`,
    );

  /*
   * The current timer occupies the same bottom-right corner.
   * Move only this exact overlay left so the view gizmo has a dedicated home.
   */
  const timerClass =
    'className="pointer-events-none absolute bottom-3 right-3 rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[9px] text-slate-300 backdrop-blur"';

  if (
    viewer.includes(
      timerClass,
    )
  ) {
    viewer =
      viewer.replace(
        timerClass,
        'className="pointer-events-none absolute bottom-3 right-[142px] z-20 rounded border border-[#494949] bg-[#303030] px-2.5 py-1.5 text-[9px] text-slate-300 backdrop-blur"',
      );
  }

  fs.writeFileSync(
    HELPER,
    helperSource,
    "utf8",
  );

  fs.writeFileSync(
    VIEWER,
    viewer,
    "utf8",
  );
}

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `main-3d-viewport-polish-v2-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

fs.writeFileSync(
  path.join(
    backupDir,
    "Reconstruction3DViewer.tsx",
  ),
  originalViewer,
  "utf8",
);

if (
  originalHelper !== null
) {
  fs.writeFileSync(
    path.join(
      backupDir,
      "roadSafeViewportPolish.ts",
    ),
    originalHelper,
    "utf8",
  );
}

function resolveTypeScriptCli() {
  const candidates = [
    path.join(
      ROOT,
      "node_modules",
      "typescript",
      "bin",
      "tsc",
    ),
    path.join(
      ROOT,
      "node_modules",
      "typescript",
      "bin",
      "tsc.js",
    ),
  ];

  return candidates.find(
    (candidate) =>
      fs.existsSync(
        candidate,
      ),
  );
}

const tscCli =
  resolveTypeScriptCli();

if (!tscCli) {
  console.log("");
  console.log(
    "[WARN] TypeScript CLI not found under node_modules.",
  );
  console.log(
    "[OK] Files were installed, but automatic verification was skipped.",
  );
  console.log("");
  console.log(
    "Run:",
  );
  console.log(
    "  npm install",
  );
  console.log(
    "  npm run build",
  );
  process.exit(0);
}

console.log("");
console.log(
  "RoadSafe Main 3D Viewport Polish V2",
);
console.log(
  "===================================",
);
console.log(
  "[OK] Installed visible Blender-style viewport helpers.",
);
console.log(
  "[OK] Added dark support floor.",
);
console.log(
  "[OK] Added fine + major metric grid.",
);
console.log(
  "[OK] Added X / Y / Z world axes.",
);
console.log(
  "[OK] Added dedicated bottom-right orientation gizmo canvas.",
);
console.log(
  "[OK] Added camera-orientation synchronization.",
);
console.log(
  "[OK] Added axis-click camera snapping.",
);
console.log(
  "[OK] Kept physics and reconstruction state untouched.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);
console.log("");
console.log(
  "Verifying TypeScript...",
);

const result =
  spawnSync(
    process.execPath,
    [
      tscCli,
      "-b",
      "--pretty",
      "false",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
    },
  );

const output =
  [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  result.error
) {
  console.error("");
  console.error(
    `[RoadSafe] Could not launch TypeScript: ${result.error.message}`,
  );
  console.error(
    `[RoadSafe] Backup: ${backupDir}`,
  );
  process.exit(2);
}

if (
  result.status !== 0
) {
  console.error("");
  console.error(
    "[RoadSafe] TypeScript verification failed:",
  );
  console.error("");
  console.error(
    output ||
      `(TypeScript exited with status ${String(result.status)}.)`,
  );
  console.error("");
  console.error(
    `[RoadSafe] Backup: ${backupDir}`,
  );
  process.exit(3);
}

console.log(
  "[OK] TypeScript verification passed.",
);
console.log("");
console.log(
  "Now run:",
);
console.log(
  "  npm run build",
);
console.log(
  "  npm run dev",
);
