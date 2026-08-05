import assert from "node:assert/strict";
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
            "\n",
          ),
      )
      .join("\n"),
  );
}

const temporaryPath =
  path.join(
    os.tmpdir(),
    `roadsafe-motion-kinematics-${process.pid}-${Date.now()}.mjs`,
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
      `?v=${Date.now()}`
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
    "\nPhase 0 canonical motion-kinematics verification passed.",
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
