import fs from "node:fs";
import path from "node:path";

const root =
  process.cwd();

const files = {
  motion:
    "src/utils/reconstructionMotionKinematics.ts",

  geometry:
    "src/utils/reconstructionGeometry.ts",

  physics:
    "src/services/reconstructionPhysicsService.ts",

  verifier:
    "scripts/verify-motion-kinematics.mjs",

  package:
    "package.json",
};

function absolute(
  relativePath,
) {
  return path.join(
    root,
    relativePath,
  );
}

function read(
  relativePath,
) {
  return fs
    .readFileSync(
      absolute(relativePath),
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

function write(
  relativePath,
  content,
) {
  fs.mkdirSync(
    path.dirname(
      absolute(relativePath),
    ),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    absolute(relativePath),
    content.replace(/\r\n/g, "\n"),
    "utf8",
  );
}

function functionRange(
  content,
  signature,
) {
  const start =
    content.indexOf(
      signature,
    );

  if (start < 0) {
    throw new Error(
      `Function not found: ${signature}`,
    );
  }

  const parameterStart =
    content.indexOf(
      "(",
      start,
    );

  if (parameterStart < 0) {
    throw new Error(
      `Parameter list not found: ${signature}`,
    );
  }

  let parameterDepth = 0;
  let parameterEnd = -1;
  let quote = null;
  let escaped = false;

  for (
    let index = parameterStart;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (
      character === '"' ||
      character === "'" ||
      character === "`"
    ) {
      quote = character;
      continue;
    }

    if (character === "(") {
      parameterDepth += 1;
      continue;
    }

    if (character === ")") {
      parameterDepth -= 1;

      if (parameterDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }

  if (parameterEnd < 0) {
    throw new Error(
      `Parameter list did not close: ${signature}`,
    );
  }

  const bodyStart =
    content.indexOf(
      "{",
      parameterEnd,
    );

  if (bodyStart < 0) {
    throw new Error(
      `Function body not found: ${signature}`,
    );
  }

  let depth = 0;
  quote = null;
  escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (
    let index = bodyStart;
    index < content.length;
    index += 1
  ) {
    const character =
      content[index];

    const next =
      content[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }

      continue;
    }

    if (blockComment) {
      if (
        character === "*" &&
        next === "/"
      ) {
        blockComment = false;
        index += 1;
      }

      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (
      character === "/" &&
      next === "/"
    ) {
      lineComment = true;
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      next === "*"
    ) {
      blockComment = true;
      index += 1;
      continue;
    }

    if (
      character === '"' ||
      character === "'" ||
      character === "`"
    ) {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          start,
          end:
            index + 1,
        };
      }
    }
  }

  throw new Error(
    `Function did not close: ${signature}`,
  );
}

function replaceFunction(
  content,
  signature,
  replacement,
) {
  const range =
    functionRange(
      content,
      signature,
    );

  return (
    content.slice(
      0,
      range.start,
    ) +
    replacement.trimEnd() +
    content.slice(
      range.end,
    )
  );
}

const timestamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupRoot =
  path.join(
    root,
    ".roadsafe-patch-backups",
    `phase0-motion-kinematics-${timestamp}`,
  );

fs.mkdirSync(
  backupRoot,
  {
    recursive: true,
  },
);

for (
  const relativePath
  of [
    files.geometry,
    files.physics,
    files.package,
  ]
) {
  fs.copyFileSync(
    absolute(relativePath),
    path.join(
      backupRoot,
      path.basename(relativePath),
    ),
  );
}

const motionSource = `/*
 * [RoadSafe:CanonicalMotionKinematicsV1]
 *
 * Shared deterministic speed integration and finite-difference sampling.
 * Route playback and the physics engine must not implement separate motion
 * equations.
 */

export interface VelocitySampleWindow {
  beforeTimeSeconds: number;
  afterTimeSeconds: number;
  mode:
    | "Forward"
    | "Central"
    | "Backward"
    | "Stationary";
}

const TIME_EPSILON_SECONDS =
  0.0001;

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

function finiteNonNegative(
  value: number,
): number {
  return Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

export function smoothKinematicProgress(
  progress: number,
): number {
  const safe =
    clamp(
      progress,
      0,
      1,
    );

  return (
    safe *
    safe *
    (
      3 -
      2 * safe
    )
  );
}

export function smootherKinematicProgress(
  progress: number,
): number {
  const safe =
    clamp(
      progress,
      0,
      1,
    );

  return (
    safe *
    safe *
    safe *
    (
      safe *
        (
          safe * 6 -
          15
        ) +
      10
    )
  );
}

export function getSmoothKinematicSpeedKmh(
  startSpeedKmh: number,
  endSpeedKmh: number,
  timeProgress: number,
): number {
  const start =
    finiteNonNegative(
      startSpeedKmh,
    );

  const end =
    finiteNonNegative(
      endSpeedKmh,
    );

  const progress =
    smoothKinematicProgress(
      timeProgress,
    );

  return Math.max(
    0,
    start +
      (
        end -
        start
      ) *
        progress,
  );
}

/*
 * Integral of:
 *
 *   smoothstep(t) = 3t² - 2t³
 *
 * from zero to t:
 *
 *   t³ - 0.5t⁴
 */
export function getIntegratedKinematicDistanceProgress(
  startSpeedKmh: number,
  endSpeedKmh: number,
  timeProgress: number,
): number {
  const progress =
    clamp(
      timeProgress,
      0,
      1,
    );

  const start =
    finiteNonNegative(
      startSpeedKmh,
    );

  const end =
    finiteNonNegative(
      endSpeedKmh,
    );

  const averageSpeed =
    (
      start +
      end
    ) / 2;

  if (
    averageSpeed <
    0.01
  ) {
    return smootherKinematicProgress(
      progress,
    );
  }

  const speedDifference =
    end -
    start;

  const integratedSmoothStep =
    progress *
      progress *
      progress -
    0.5 *
      progress *
      progress *
      progress *
      progress;

  const travelledSpeedArea =
    start *
      progress +
    speedDifference *
      integratedSmoothStep;

  return clamp(
    travelledSpeedArea /
      averageSpeed,
    0,
    1,
  );
}

export function resolveVelocitySampleWindow(
  currentTimeSeconds: number,
  requestedSampleSeconds: number,
  firstPathTimeSeconds: number,
  lastPathTimeSeconds: number,
): VelocitySampleWindow {
  const first =
    Number.isFinite(
      firstPathTimeSeconds,
    )
      ? firstPathTimeSeconds
      : 0;

  const last =
    Number.isFinite(
      lastPathTimeSeconds,
    )
      ? Math.max(
          first,
          lastPathTimeSeconds,
        )
      : first;

  const availableDuration =
    last -
    first;

  if (
    availableDuration <=
    TIME_EPSILON_SECONDS
  ) {
    return {
      beforeTimeSeconds:
        first,

      afterTimeSeconds:
        last,

      mode:
        "Stationary",
    };
  }

  const sample =
    clamp(
      Number.isFinite(
        requestedSampleSeconds,
      )
        ? Math.abs(
            requestedSampleSeconds,
          )
        : 0.05,
      0.001,
      Math.max(
        0.001,
        availableDuration,
      ),
    );

  const current =
    clamp(
      Number.isFinite(
        currentTimeSeconds,
      )
        ? currentTimeSeconds
        : first,
      first,
      last,
    );

  /*
   * At the final authored point, use a backward difference. Sampling beyond
   * the endpoint would return the stationary final pose and understate the
   * incoming impact velocity.
   */
  if (
    current >=
    last -
      TIME_EPSILON_SECONDS
  ) {
    return {
      beforeTimeSeconds:
        Math.max(
          first,
          last -
            sample,
        ),

      afterTimeSeconds:
        last,

      mode:
        "Backward",
    };
  }

  if (
    current <=
    first +
      TIME_EPSILON_SECONDS
  ) {
    return {
      beforeTimeSeconds:
        first,

      afterTimeSeconds:
        Math.min(
          last,
          first +
            sample,
        ),

      mode:
        "Forward",
    };
  }

  const before =
    Math.max(
      first,
      current -
        sample,
    );

  const after =
    Math.min(
      last,
      current +
        sample,
    );

  if (
    after -
      before <=
    TIME_EPSILON_SECONDS
  ) {
    if (
      current -
        first >
      last -
        current
    ) {
      return {
        beforeTimeSeconds:
          Math.max(
            first,
            current -
              sample,
          ),

        afterTimeSeconds:
          current,

        mode:
          "Backward",
      };
    }

    return {
      beforeTimeSeconds:
        current,

      afterTimeSeconds:
        Math.min(
          last,
          current +
            sample,
        ),

      mode:
        "Forward",
    };
  }

  return {
    beforeTimeSeconds:
      before,

    afterTimeSeconds:
      after,

    mode:
      "Central",
  };
}
`;

write(
  files.motion,
  motionSource,
);

let geometry =
  read(
    files.geometry,
  );

const geometryImport =
`import {
  getIntegratedKinematicDistanceProgress,
  getSmoothKinematicSpeedKmh,
} from "./reconstructionMotionKinematics";
`;

if (
  !geometry.includes(
    'from "./reconstructionMotionKinematics"',
  )
) {
  const importInsertion =
    geometry.lastIndexOf(
      "\n\n",
      geometry.indexOf(
        "export interface ReconstructionImpactEffectState",
      ),
    );

  if (
    importInsertion < 0
  ) {
    throw new Error(
      "Could not locate reconstructionGeometry import boundary.",
    );
  }

  geometry =
    geometry.slice(
      0,
      importInsertion,
    ) +
    "\n" +
    geometryImport +
    geometry.slice(
      importInsertion,
    );
}

geometry =
  replaceFunction(
    geometry,
    "function getKinematicPositionProgress(",
`function getKinematicPositionProgress(
  start: MovementPathPoint,
  end: MovementPathPoint,
  timeProgress: number,
): number {
  const startSpeed =
    start.action === "Stop"
      ? 0
      : start.speedKmh;

  const endSpeed =
    end.action === "Stop"
      ? 0
      : end.speedKmh;

  return getIntegratedKinematicDistanceProgress(
    startSpeed,
    endSpeed,
    timeProgress,
  );
}`,
  );

const oldSpeedBlock =
`  const interpolatedSpeed = Math.max(
    0,
    interpolate(
      start.speedKmh,
      endSpeed,
      smoothStep(timeProgress),
    ),
  );`;

const newSpeedBlock =
`  const interpolatedSpeed =
    getSmoothKinematicSpeedKmh(
      start.speedKmh,
      endSpeed,
      timeProgress,
    );`;

if (
  !geometry.includes(
    oldSpeedBlock,
  )
) {
  throw new Error(
    "Could not locate playback speed interpolation.",
  );
}

geometry =
  geometry.replace(
    oldSpeedBlock,
    newSpeedBlock,
  );

write(
  files.geometry,
  geometry,
);

let physics =
  read(
    files.physics,
  );

const physicsImport =
`import {
  resolveVelocitySampleWindow,
} from "../utils/reconstructionMotionKinematics";
`;

if (
  !physics.includes(
    'from "../utils/reconstructionMotionKinematics"',
  )
) {
  const firstInterface =
    physics.indexOf(
      "\ninterface Vector2",
    );

  if (
    firstInterface < 0
  ) {
    throw new Error(
      "Could not locate reconstructionPhysicsService import boundary.",
    );
  }

  physics =
    physics.slice(
      0,
      firstInterface,
    ) +
    "\n" +
    physicsImport +
    physics.slice(
      firstInterface,
    );
}

physics =
  replaceFunction(
    physics,
    "function participantVelocityAtTime(",
`/*
 * [RoadSafe:BoundarySafeImpactVelocityV1]
 *
 * The final authored impact pose uses a backward finite difference. Interior
 * samples use a centred window and the route start uses a forward window.
 */
function participantVelocityAtTime(
  participant: ReconstructionVehicle,
  timeSeconds: number,
  width: number,
  height: number,
  sampleSeconds: number,
): Vector2 {
  const authoredPoints =
    sortMovementPathPoints(
      participant.pathPoints,
    ).filter(
      (point) =>
        !isPhysicsGeneratedPathPoint(
          point,
        ),
    );

  const firstPathTime =
    authoredPoints[0]
      ?.timeSeconds ??
    0;

  const lastPathTime =
    authoredPoints.at(-1)
      ?.timeSeconds ??
    firstPathTime;

  const sampleWindow =
    resolveVelocitySampleWindow(
      timeSeconds,
      sampleSeconds,
      firstPathTime,
      lastPathTime,
    );

  const before =
    participantWorldPositionAtTime(
      participant,
      sampleWindow.beforeTimeSeconds,
      width,
      height,
    );

  const after =
    participantWorldPositionAtTime(
      participant,
      sampleWindow.afterTimeSeconds,
      width,
      height,
    );

  const elapsed =
    sampleWindow.afterTimeSeconds -
    sampleWindow.beforeTimeSeconds;

  if (
    elapsed >
    0.0001
  ) {
    const sampled = {
      x:
        (
          after.x -
          before.x
        ) /
        elapsed,

      y:
        (
          after.y -
          before.y
        ) /
        elapsed,
    };

    if (
      magnitude(
        sampled,
      ) >
      0.05
    ) {
      return sampled;
    }
  }

  const state =
    getParticipantStateAtTime(
      participant,
      timeSeconds,
    );

  const speed =
    kmhToMps(
      state.speedKmh ||
      participant.estimatedSpeedKmh,
    );

  return {
    x:
      Math.cos(
        (
          state.rotation *
          Math.PI
        ) /
          180,
      ) *
      speed,

    y:
      Math.sin(
        (
          state.rotation *
          Math.PI
        ) /
          180,
      ) *
      speed,
  };
}`,
  );

write(
  files.physics,
  physics,
);

const verifierSource = `import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath =
  "src/utils/reconstructionMotionKinematics.ts";

const source =
  fs.readFileSync(
    sourcePath,
    "utf8",
  );

const transpiled =
  ts.transpileModule(
    source,
    {
      compilerOptions: {
        target:
          ts.ScriptTarget.ES2022,

        module:
          ts.ModuleKind.ES2022,

        moduleResolution:
          ts.ModuleResolutionKind.Bundler,
      },

      fileName:
        sourcePath,

      reportDiagnostics:
        true,
    },
  );

const errors =
  (
    transpiled.diagnostics ??
    []
  ).filter(
    (diagnostic) =>
      diagnostic.category ===
      ts.DiagnosticCategory.Error,
  );

if (
  errors.length > 0
) {
  throw new Error(
    errors
      .map(
        (error) =>
          ts.flattenDiagnosticMessageText(
            error.messageText,
            "\\n",
          ),
      )
      .join("\\n"),
  );
}

const temporaryPath =
  path.join(
    os.tmpdir(),
    \`roadsafe-motion-kinematics-\${process.pid}-\${Date.now()}.mjs\`,
  );

fs.writeFileSync(
  temporaryPath,
  transpiled.outputText,
  "utf8",
);

const motion =
  await import(
    pathToFileURL(
      temporaryPath,
    ).href +
      \`?v=\${Date.now()}\`
  );

try {
  const constantSpeedQuarter =
    motion.getIntegratedKinematicDistanceProgress(
      40,
      40,
      0.25,
    );

  assert.ok(
    Math.abs(
      constantSpeedQuarter -
      0.25,
    ) <
      0.000001,
    "Constant-speed travel must remain linear.",
  );

  assert.equal(
    motion.getIntegratedKinematicDistanceProgress(
      10,
      60,
      0,
    ),
    0,
    "Integrated travel must start at zero.",
  );

  assert.equal(
    motion.getIntegratedKinematicDistanceProgress(
      10,
      60,
      1,
    ),
    1,
    "Integrated travel must end at one.",
  );

  assert.equal(
    motion.getSmoothKinematicSpeedKmh(
      20,
      60,
      0,
    ),
    20,
    "Speed interpolation did not preserve the start speed.",
  );

  assert.equal(
    motion.getSmoothKinematicSpeedKmh(
      20,
      60,
      1,
    ),
    60,
    "Speed interpolation did not preserve the end speed.",
  );

  const finalWindow =
    motion.resolveVelocitySampleWindow(
      6.91,
      0.1,
      0,
      6.91,
    );

  assert.equal(
    finalWindow.mode,
    "Backward",
    "The final authored point must use backward differencing.",
  );

  assert.equal(
    finalWindow.afterTimeSeconds,
    6.91,
    "The final sample extended beyond Point Z.",
  );

  assert.ok(
    finalWindow.beforeTimeSeconds <
      finalWindow.afterTimeSeconds,
    "The final velocity window has no duration.",
  );

  const startWindow =
    motion.resolveVelocitySampleWindow(
      0,
      0.1,
      0,
      6.91,
    );

  assert.equal(
    startWindow.mode,
    "Forward",
    "Point 1 must use forward differencing.",
  );

  assert.equal(
    startWindow.beforeTimeSeconds,
    0,
    "The start sample moved before Point 1.",
  );

  const middleWindow =
    motion.resolveVelocitySampleWindow(
      3,
      0.1,
      0,
      6.91,
    );

  assert.equal(
    middleWindow.mode,
    "Central",
    "Interior motion must use centred differencing.",
  );

  assert.ok(
    middleWindow.beforeTimeSeconds <
      3 &&
    middleWindow.afterTimeSeconds >
      3,
    "The interior sample is not centred around the requested time.",
  );

  const geometrySource =
    fs.readFileSync(
      "src/utils/reconstructionGeometry.ts",
      "utf8",
    );

  const physicsSource =
    fs.readFileSync(
      "src/services/reconstructionPhysicsService.ts",
      "utf8",
    );

  assert.equal(
    geometrySource.includes(
      "getIntegratedKinematicDistanceProgress(",
    ),
    true,
    "Playback is not using the canonical integrated speed function.",
  );

  assert.equal(
    geometrySource.includes(
      "getSmoothKinematicSpeedKmh(",
    ),
    true,
    "Displayed playback speed is not using the canonical speed function.",
  );

  assert.equal(
    physicsSource.includes(
      "BoundarySafeImpactVelocityV1",
    ),
    true,
    "Physics is not using boundary-safe impact velocity.",
  );

  assert.equal(
    physicsSource.includes(
      "resolveVelocitySampleWindow(",
    ),
    true,
    "Physics is not using the shared velocity sampling window.",
  );

  console.log(
    "✓ Constant-speed integration remains linear",
  );

  console.log(
    "✓ Accelerating motion preserves start/end distance",
  );

  console.log(
    "✓ Displayed speed and position progress share one curve",
  );

  console.log(
    "✓ Point 1 uses forward velocity sampling",
  );

  console.log(
    "✓ Interior motion uses central velocity sampling",
  );

  console.log(
    "✓ Point Z uses backward velocity sampling",
  );

  console.log(
    "\\nPhase 0 canonical motion-kinematics verification passed.",
  );
}
finally {
  fs.rmSync(
    temporaryPath,
    {
      force: true,
    },
  );
}
`;

write(
  files.verifier,
  verifierSource,
);

const packageJson =
  JSON.parse(
    read(
      files.package,
    ),
  );

packageJson.scripts ??= {};

packageJson.scripts[
  "motion:verify"
] =
  "node scripts/verify-motion-kinematics.mjs && tsc -p tsconfig.phase0.json";

write(
  files.package,
  JSON.stringify(
    packageJson,
    null,
    2,
  ) + "\n",
);

console.log(
  "\nPhase 0 Step 3A motion patch applied.",
);

console.log(
  "Backup:",
  backupRoot,
);

console.log(
  "\nChanged files:",
);

console.log(
  [
    files.motion,
    files.geometry,
    files.physics,
    files.verifier,
    files.package,
  ].join("\n"),
);
