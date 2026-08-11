import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const INSTALLER_DIR =
  path.dirname(fileURLToPath(import.meta.url));

const PAYLOAD =
  path.join(
    INSTALLER_DIR,
    "roadsafe-node-v2-payload",
  );

const TYPE_REL =
  "src/types/reconstruction.ts";

const FOUNDATION_REL =
  "src/utils/reconstructionPhysicsFoundation.ts";

const PHYSICS_REL =
  "src/services/reconstructionPhysicsService.ts";

const EDITOR_REL =
  "src/components/reconstruction/AccidentReconstructionEditor.tsx";

const DOCK_REL =
  "src/components/reconstruction/ReconstructionBottomDock.tsx";

const GENERATED = {
  "src/utils/reconstructionPhysicsDefaults.ts":
    "reconstructionPhysicsDefaults.ts",

  "src/components/reconstruction/ReconstructionPhysicsContextEditor.tsx":
    "ReconstructionPhysicsContextEditor.tsx",

  "src/components/reconstruction/reconstructionPhysicsContextEditor.css":
    "reconstructionPhysicsContextEditor.css",

  "src/components/reconstruction/ReconstructionNodeEditor.tsx":
    "ReconstructionNodeEditor.tsx",

  "src/components/reconstruction/reconstructionNodeEditorFunctional.css":
    "reconstructionNodeEditorFunctional.css",
};

function abs(rel) {
  return path.join(
    ROOT,
    ...rel.split("/"),
  );
}

function fail(message, code = 1) {
  console.error("");
  console.error(
    `[RoadSafe] ${message}`,
  );
  process.exit(code);
}

function replaceOrFail(
  source,
  anchor,
  replacement,
  message,
) {
  if (!source.includes(anchor)) {
    fail(message);
  }

  return source.replace(
    anchor,
    replacement,
  );
}

for (const rel of [
  TYPE_REL,
  FOUNDATION_REL,
  PHYSICS_REL,
  EDITOR_REL,
  DOCK_REL,
]) {
  if (!fs.existsSync(abs(rel))) {
    fail(
      `Could not find ${rel}. Run this installer from the A-R-V1 repository root.`,
    );
  }
}

for (const payloadName of Object.values(GENERATED)) {
  if (
    !fs.existsSync(
      path.join(
        PAYLOAD,
        payloadName,
      ),
    )
  ) {
    fail(
      `Installer payload is incomplete: ${payloadName} is missing. Extract the whole ZIP before running the installer.`,
    );
  }
}

const originals =
  new Map();

for (const rel of [
  TYPE_REL,
  FOUNDATION_REL,
  PHYSICS_REL,
  EDITOR_REL,
  DOCK_REL,
  ...Object.keys(GENERATED),
]) {
  if (
    fs.existsSync(
      abs(rel),
    )
  ) {
    originals.set(
      rel,
      fs.readFileSync(
        abs(rel),
        "utf8",
      ),
    );
  }
}

let types =
  fs.readFileSync(
    abs(TYPE_REL),
    "utf8",
  );

let foundation =
  fs.readFileSync(
    abs(FOUNDATION_REL),
    "utf8",
  );

let physics =
  fs.readFileSync(
    abs(PHYSICS_REL),
    "utf8",
  );

let editor =
  fs.readFileSync(
    abs(EDITOR_REL),
    "utf8",
  );

let dock =
  fs.readFileSync(
    abs(DOCK_REL),
    "utf8",
  );

/* ========================================================================== */
/* 1. Canonical types                                                         */
/* ========================================================================== */

if (
  !types.includes(
    "inputSpeedKmh?: number;",
  )
) {
  const anchor =
`export interface ParticipantPhysicsProfile {
  enabled: boolean;
  massKg: number;`;

  types =
    replaceOrFail(
      types,
      anchor,
`export interface ParticipantPhysicsProfile {
  enabled: boolean;

  /**
   * Optional explicit solver speed. When present, RoadSafe preserves the
   * authored path direction but uses this magnitude for the physics approach.
   */
  inputSpeedKmh?: number;

  massKg: number;`,
      "Could not locate ParticipantPhysicsProfile. No files were changed.",
    );
}

if (
  !types.includes(
    "Effective collision mass",
  )
) {
  const anchor =
`export interface SceneObjectPhysicsProfile {
  enabled: boolean;
  collidable: boolean;
  collisionRadiusMetres: number;`;

  types =
    replaceOrFail(
      types,
      anchor,
`export interface SceneObjectPhysicsProfile {
  enabled: boolean;
  collidable: boolean;

  /**
   * Effective collision mass. Scene geometry remains investigator-anchored,
   * but this value participates in the contact impulse calculation.
   */
  massKg?: number;

  collisionRadiusMetres: number;`,
      "Could not locate SceneObjectPhysicsProfile. No files were changed.",
    );
}

/* ========================================================================== */
/* 2. Normalisation                                                           */
/* ========================================================================== */

if (
  !foundation.includes(
    "inputSpeedKmh:",
  )
) {
  const anchor =
`  return {
    enabled:
      input.enabled !== false,

    massKg:`;

  foundation =
    replaceOrFail(
      foundation,
      anchor,
`  return {
    enabled:
      input.enabled !== false,

    inputSpeedKmh:
      typeof input.inputSpeedKmh === "number" &&
      Number.isFinite(input.inputSpeedKmh)
        ? boundedNumber(
            input.inputSpeedKmh,
            0,
            0,
            250,
          )
        : undefined,

    massKg:`,
      "Could not patch participant physics normalisation. No files were changed.",
    );
}

if (
  !foundation.includes(
    "1_000_000,\n        0.1,\n        100_000_000",
  )
) {
  const anchor =
`  return {
    enabled:
      input.enabled !== false,

    collidable:
      Boolean(input.collidable),

    collisionRadiusMetres:`;

  foundation =
    replaceOrFail(
      foundation,
      anchor,
`  return {
    enabled:
      input.enabled !== false,

    collidable:
      Boolean(input.collidable),

    massKg:
      boundedNumber(
        input.massKg,
        1_000_000,
        0.1,
        100_000_000,
      ),

    collisionRadiusMetres:`,
      "Could not patch scene-object physics normalisation. No files were changed.",
    );
}

/* ========================================================================== */
/* 3. Physics solver                                                          */
/* ========================================================================== */

if (
  !physics.includes(
    'from "../utils/reconstructionPhysicsDefaults"',
  )
) {
  const anchor =
`import { createParticipantImpactResponses } from "../utils/reconstructionImpactResponse";`;

  physics =
    replaceOrFail(
      physics,
      anchor,
`${anchor}
import { getDefaultSceneObjectMassKg } from "../utils/reconstructionPhysicsDefaults";`,
      "Could not locate physics-service import anchor. No files were changed.",
    );
}

if (
  !physics.includes(
    "interface ResolvedSceneObjectPhysicsProfile extends SceneObjectPhysicsProfile {\n  massKg: number;",
  )
) {
  const anchor =
`interface ResolvedSceneObjectPhysicsProfile extends SceneObjectPhysicsProfile {
  collisionShape: PhysicsCollisionShape;`;

  physics =
    replaceOrFail(
      physics,
      anchor,
`interface ResolvedSceneObjectPhysicsProfile extends SceneObjectPhysicsProfile {
  massKg: number;
  collisionShape: PhysicsCollisionShape;`,
      "Could not locate resolved scene-object physics type. No files were changed.",
    );
}

if (
  !physics.includes(
    "getDefaultSceneObjectMassKg(\n        object.type",
  )
) {
  const anchor =
`  return normaliseSceneObjectPhysicsProfile({
    ...getDefaultSceneObjectPhysics(
      object,
    ),
    ...(object.physics ?? {}),
  }) as ResolvedSceneObjectPhysicsProfile;`;

  physics =
    replaceOrFail(
      physics,
      anchor,
`  return normaliseSceneObjectPhysicsProfile({
    ...getDefaultSceneObjectPhysics(
      object,
    ),
    massKg:
      object.physics?.massKg ??
      getDefaultSceneObjectMassKg(
        object.type,
      ),
    ...(object.physics ?? {}),
  }) as ResolvedSceneObjectPhysicsProfile;`,
      "Could not locate resolveSceneObjectPhysicsProfile. No files were changed.",
    );
}

if (
  !physics.includes(
    "[RoadSafe:ParticipantPhysicsSpeedOverrideV1]",
  )
) {
  const anchor =
`    if (
      magnitude(
        sampled,
      ) >
      0.05
    ) {
      return sampled;
    }`;

  physics =
    replaceOrFail(
      physics,
      anchor,
`    if (
      magnitude(
        sampled,
      ) >
      0.05
    ) {
      /*
       * [RoadSafe:ParticipantPhysicsSpeedOverrideV1]
       * Keep the authored route heading, but permit an explicit solver-speed
       * magnitude controlled from Properties or the Node Editor.
       */
      const configuredSpeedKmh =
        participant.physics?.inputSpeedKmh;

      if (
        typeof configuredSpeedKmh === "number" &&
        Number.isFinite(configuredSpeedKmh)
      ) {
        const sampledMagnitude =
          magnitude(sampled);

        const configuredSpeedMps =
          kmhToMps(
            Math.max(
              0,
              configuredSpeedKmh,
            ),
          );

        return sampledMagnitude > 0.0001
          ? {
              x:
                (sampled.x /
                  sampledMagnitude) *
                configuredSpeedMps,
              y:
                (sampled.y /
                  sampledMagnitude) *
                configuredSpeedMps,
            }
          : sampled;
      }

      return sampled;
    }`,
      "Could not locate the sampled participant velocity branch. No files were changed.",
    );

  const fallbackAnchor =
`  const speed =
    kmhToMps(
      state.speedKmh ||
      participant.estimatedSpeedKmh,
    );`;

  physics =
    replaceOrFail(
      physics,
      fallbackAnchor,
`  const speed =
    kmhToMps(
      typeof participant.physics?.inputSpeedKmh === "number" &&
      Number.isFinite(participant.physics.inputSpeedKmh)
        ? Math.max(
            0,
            participant.physics.inputSpeedKmh,
          )
        : state.speedKmh ||
          participant.estimatedSpeedKmh,
    );`,
      "Could not locate the participant velocity fallback. No files were changed.",
    );
}

if (
  !physics.includes(
    "[RoadSafe:FiniteSceneObjectMassV1]",
  )
) {
  const anchor =
`  const inverseMass = 1 / body.profile.massKg;
  const inverseInertia = 1 / Math.max(0.001, bodyMomentOfInertia(body));
  const normalLever = cross(offset, normal);
  const normalDenominator =
    inverseMass + normalLever * normalLever * inverseInertia;`;

  physics =
    replaceOrFail(
      physics,
      anchor,
`  const inverseMass = 1 / body.profile.massKg;

  /*
   * [RoadSafe:FiniteSceneObjectMassV1]
   * Heavy objects converge toward the old static-world response; lighter
   * objects absorb more momentum through their effective collision mass.
   * Their authored scene transform is still not moved by the solver.
   */
  const inverseObjectMass =
    1 /
    Math.max(
      0.1,
      objectProfile.massKg,
    );

  const inverseInertia = 1 / Math.max(0.001, bodyMomentOfInertia(body));
  const normalLever = cross(offset, normal);
  const normalDenominator =
    inverseMass +
    inverseObjectMass +
    normalLever * normalLever * inverseInertia;`,
      "Could not locate the static-object impulse denominator. No files were changed.",
    );

  const tangentAnchor =
`    const tangentDenominator =
      inverseMass + tangentLever * tangentLever * inverseInertia;`;

  physics =
    replaceOrFail(
      physics,
      tangentAnchor,
`    const tangentDenominator =
      inverseMass +
      inverseObjectMass +
      tangentLever * tangentLever * inverseInertia;`,
      "Could not locate the static-object friction denominator. No files were changed.",
    );
}

/* ========================================================================== */
/* 4. Context panel                                                           */
/* ========================================================================== */

if (
  !editor.includes(
    'import ReconstructionPhysicsContextEditor from "./ReconstructionPhysicsContextEditor";',
  )
) {
  const anchor =
`import SceneSettingsPanel from "./SceneSettingsPanel";`;

  editor =
    replaceOrFail(
      editor,
      anchor,
`${anchor}
import ReconstructionPhysicsContextEditor from "./ReconstructionPhysicsContextEditor";`,
      "Could not locate SceneSettingsPanel import. No files were changed.",
    );
}

if (
  !editor.includes(
    "<ReconstructionPhysicsContextEditor",
  )
) {
  const anchor =
`              <button
                type="button"
                className="premium-investigation-card__action"
                onClick={handleRunPhysics}
                disabled={!compactPhysicsSettings.enabled || reconstruction.vehicles.length === 0}
              >`;

  editor =
    replaceOrFail(
      editor,
      anchor,
`              <ReconstructionPhysicsContextEditor
                reconstruction={reconstruction}
                onChange={handleReconstructionChange}
              />

${anchor}`,
      "Could not locate the premium Physics context card. No files were changed.",
    );
}

/* ========================================================================== */
/* 5. Bottom dock API                                                         */
/* ========================================================================== */

if (
  !dock.includes(
    "onReconstructionChange(",
  )
) {
  const anchor =
`  onSelectSceneObject(objectId: string): void;`;

  dock =
    replaceOrFail(
      dock,
      anchor,
`${anchor}
  onReconstructionChange(
    updates: Partial<AccidentReconstruction>,
  ): void;`,
      "Could not locate ReconstructionBottomDock props. No files were changed.",
    );
}

if (
  !dock.includes(
    "  onRunPhysics(): void;",
  )
) {
  const anchor =
`  onReconstructionChange(
    updates: Partial<AccidentReconstruction>,
  ): void;`;

  dock =
    replaceOrFail(
      dock,
      anchor,
`${anchor}
  onRunPhysics(): void;
  onSwitchView(view: "2D" | "3D"): void;
  onOpenNodeTarget(
    target:
      | "case"
      | "scene"
      | "objects"
      | "evidence"
      | "collision"
      | "physics",
  ): void;`,
      "Could not extend ReconstructionBottomDock props. No files were changed.",
    );
}

const destructureAnchor =
`  onSelectSceneObject,`;

for (const name of [
  "onReconstructionChange",
  "onRunPhysics",
  "onSwitchView",
  "onOpenNodeTarget",
]) {
  if (
    !dock.includes(
      `  ${name},`,
    )
  ) {
    dock =
      replaceOrFail(
        dock,
        destructureAnchor,
`${destructureAnchor}
  ${name},`,
        "Could not extend ReconstructionBottomDock destructuring. No files were changed.",
      );
  }
}

const nodeCallAnchor =
`                onSelectSceneObject={
                  onSelectSceneObject
                }`;

if (
  !dock.includes(
    "                onReconstructionChange={",
  )
) {
  dock =
    replaceOrFail(
      dock,
      nodeCallAnchor,
`${nodeCallAnchor}
                onReconstructionChange={
                  onReconstructionChange
                }`,
      "Could not extend ReconstructionNodeEditor call. No files were changed.",
    );
}

if (
  !dock.includes(
    "                onRunPhysics={",
  )
) {
  dock =
    replaceOrFail(
      dock,
      nodeCallAnchor,
`${nodeCallAnchor}
                onRunPhysics={
                  onRunPhysics
                }
                onPlayPause={
                  onPlayPause
                }
                onSeek={
                  onSeek
                }
                onSwitchView={
                  onSwitchView
                }
                onOpenNodeTarget={
                  onOpenNodeTarget
                }
                isPlaying={
                  isPlaying
                }`,
      "Could not connect Node Editor actions. No files were changed.",
    );
}

/* ========================================================================== */
/* 6. Parent editor -> bottom dock                                            */
/* ========================================================================== */

const bottomDockAnchor =
`        onSelectSceneObject={
          handleSelectSceneObject
        }`;

if (
  !editor.includes(
    "        onReconstructionChange={handleReconstructionChange}",
  )
) {
  editor =
    replaceOrFail(
      editor,
      bottomDockAnchor,
`${bottomDockAnchor}
        onReconstructionChange={handleReconstructionChange}`,
      "Could not connect reconstruction changes to the bottom dock. No files were changed.",
    );
}

if (
  !editor.includes(
    "        onRunPhysics={() =>",
  )
) {
  editor =
    replaceOrFail(
      editor,
      bottomDockAnchor,
`${bottomDockAnchor}
        onRunPhysics={() => {
          handleRunPhysics();
        }}`,
      "Could not connect Physics node action. No files were changed.",
    );
}

if (
  !editor.includes(
    "        onSwitchView={(view) =>",
  )
) {
  editor =
    replaceOrFail(
      editor,
      bottomDockAnchor,
`${bottomDockAnchor}
        onSwitchView={(view) => {
          setIsPlaying(false);
          setActiveReconstructionView(view);
        }}`,
      "Could not connect Output node view switching. No files were changed.",
    );
}

if (
  !editor.includes(
    "        onOpenNodeTarget={(target) =>",
  )
) {
  editor =
    replaceOrFail(
      editor,
      bottomDockAnchor,
`${bottomDockAnchor}
        onOpenNodeTarget={(target) => {
          setIsPlaying(false);
          setWorkspaceSettingsOpen(true);

          const targetMap = {
            case: ["case", "Case Setup"],
            scene: ["scene", "Scene Environment"],
            objects: ["objects", "Objects"],
            evidence: ["evidence", "Evidence"],
            collision: ["impact", "Primary Impact"],
            physics: ["physics", "Deterministic Simulation"],
          } as const;

          const [tab, heading] =
            targetMap[target];

          window.requestAnimationFrame(
            () =>
              handleWorkspaceInvestigationTab(
                tab,
                heading,
              ),
          );
        }}`,
      "Could not connect node target navigation. No files were changed.",
    );
}

/* ========================================================================== */
/* 7. Backup and write                                                        */
/* ========================================================================== */

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `computational-node-physics-v2-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

for (
  const [rel, content]
  of originals.entries()
) {
  const target =
    path.join(
      backupDir,
      ...rel.split("/"),
    );

  fs.mkdirSync(
    path.dirname(target),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    target,
    content,
    "utf8",
  );
}

fs.writeFileSync(
  abs(TYPE_REL),
  types,
  "utf8",
);

fs.writeFileSync(
  abs(FOUNDATION_REL),
  foundation,
  "utf8",
);

fs.writeFileSync(
  abs(PHYSICS_REL),
  physics,
  "utf8",
);

fs.writeFileSync(
  abs(EDITOR_REL),
  editor,
  "utf8",
);

fs.writeFileSync(
  abs(DOCK_REL),
  dock,
  "utf8",
);

for (
  const [rel, payloadName]
  of Object.entries(GENERATED)
) {
  fs.mkdirSync(
    path.dirname(abs(rel)),
    {
      recursive: true,
    },
  );

  fs.copyFileSync(
    path.join(
      PAYLOAD,
      payloadName,
    ),
    abs(rel),
  );
}

console.log("");
console.log(
  "RoadSafe Computational Node + Physics V2",
);
console.log(
  "========================================",
);
console.log(
  "[OK] Participant solver-speed input is canonical and editable.",
);
console.log(
  "[OK] Scene objects now have effective collision mass.",
);
console.log(
  "[OK] Object mass affects participant/object impulse response.",
);
console.log(
  "[OK] Right Physics context exposes participant/object/global inputs.",
);
console.log(
  "[OK] Node Editor exposes the same canonical physics inputs.",
);
console.log(
  "[OK] Physics input changes invalidate the previous bake.",
);
console.log(
  "[OK] Physics -> Output graph visibly becomes DIRTY until rerun.",
);
console.log(
  "[OK] Typed analyst links reject incompatible socket types.",
);
console.log(
  "[OK] Node layout/links remain UI metadata, separate from forensic source data.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

const npmCommand =
  process.platform === "win32"
    ? "npm.cmd"
    : "npm";

console.log("");
console.log(
  "Verifying production build...",
);

const result =
  spawnSync(
    npmCommand,
    [
      "run",
      "build",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
      shell:
        process.platform ===
        "win32",
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
    `[RoadSafe] Could not launch npm build: ${result.error.message}`,
  );
  console.error(
    `[RoadSafe] Files are installed. Backup: ${backupDir}`,
  );
  process.exit(2);
}

if (
  result.status !== 0
) {
  console.error("");
  console.error(
    "[RoadSafe] Production build failed:",
  );
  console.error("");
  console.error(
    output ||
      `(npm run build exited with status ${String(result.status)}.)`,
  );
  console.error("");
  console.error(
    `[RoadSafe] Backup: ${backupDir}`,
  );
  process.exit(3);
}

console.log(
  "[OK] Production build passed.",
);
console.log("");
console.log(
  "Now run:",
);
console.log(
  "  npm run dev",
);
