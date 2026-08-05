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
    `roadsafe-metric-route-timing-${process.pid}-${Date.now()}.mjs`,
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
  const horizontal =
    motion.solveMetricRouteTiming(
      [
        {
          position: {
            x: 0,
            y: 50,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 50,
            y: 50,
          },
          speedKmh: 36,
        },
      ],
      5,
      36,
      {
        widthMetres: 100,
        heightMetres: 40,
      },
    );

  assert.equal(
    horizontal.segmentLengthsMetres[0],
    50,
    "Horizontal editor distance was not converted to metres.",
  );

  assert.equal(
    horizontal.speedScale,
    1,
    "A physically consistent 50 m / 5 s / 36 km/h route was rescaled.",
  );

  assert.deepEqual(
    horizontal.timesSeconds,
    [
      0,
      5,
    ],
    "Simple metric route timestamps are incorrect.",
  );

  const vertical =
    motion.solveMetricRouteTiming(
      [
        {
          position: {
            x: 50,
            y: 0,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 50,
            y: 50,
          },
          speedKmh: 36,
        },
      ],
      10,
      36,
      {
        widthMetres: 40,
        heightMetres: 200,
      },
    );

  assert.equal(
    vertical.segmentLengthsMetres[0],
    100,
    "Vertical distance did not use scene height.",
  );

  assert.equal(
    vertical.speedScale,
    1,
    "A physically consistent vertical route was rescaled.",
  );

  const shorterVertical =
    motion.solveMetricRouteTiming(
      [
        {
          position: {
            x: 50,
            y: 0,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 50,
            y: 50,
          },
          speedKmh: 36,
        },
      ],
      10,
      36,
      {
        widthMetres: 40,
        heightMetres: 100,
      },
    );

  assert.equal(
    shorterVertical.segmentLengthsMetres[0],
    50,
    "The second scene height was ignored.",
  );

  assert.equal(
    shorterVertical.speedScale,
    0.5,
    "Speeds were not reconciled with the authoritative impact time.",
  );

  assert.deepEqual(
    shorterVertical.speedsKmh,
    [
      18,
      18,
    ],
    "The complete speed profile was not scaled consistently.",
  );

  const multiSegment =
    motion.solveMetricRouteTiming(
      [
        {
          position: {
            x: 0,
            y: 50,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 50,
            y: 50,
          },
          speedKmh: 36,
        },
        {
          position: {
            x: 100,
            y: 50,
          },
          speedKmh: 36,
        },
      ],
      10,
      36,
      {
        widthMetres: 100,
        heightMetres: 100,
      },
    );

  assert.deepEqual(
    multiSegment.timesSeconds,
    [
      0,
      5,
      10,
    ],
    "Cumulative metric timestamps are incorrect.",
  );

  assert.equal(
    multiSegment.usedMetricDimensions,
    true,
    "Explicit real-world dimensions were not recorded.",
  );

  const authoring =
    fs.readFileSync(
      "src/utils/participantRouteAuthoring.ts",
      "utf8",
    );

  assert.equal(
    authoring.includes(
      "MetricAuthoredRouteTimingV1",
    ),
    true,
    "Metric timing is not connected to route authoring.",
  );

  assert.equal(
    authoring.includes(
      "solveMetricRouteTiming(",
    ),
    true,
    "Route authoring does not invoke the canonical timing solver.",
  );

  assert.equal(
    authoring.includes(
      "worldDimensions?: MetricSceneDimensions",
    ),
    true,
    "Route-authoring options do not accept metric dimensions.",
  );

  const integrationFiles = [
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
    "src/services/fieldPlacementService.ts",
    "src/utils/reconstructionPointZIntegration.ts",
  ];

  for (
    const filePath
    of integrationFiles
  ) {
    const content =
      fs.readFileSync(
        filePath,
        "utf8",
      );

    assert.equal(
      content.includes(
        "getReconstructionWorldDimensions(",
      ),
      true,
      `${filePath} does not supply real scene dimensions.`,
    );
  }

  console.log(
    "✓ Horizontal scene distance converted to metres",
  );

  console.log(
    "✓ Vertical scene distance uses physical scene height",
  );

  console.log(
    "✓ Point Z timestamp remains authoritative",
  );

  console.log(
    "✓ Complete speed profile scales consistently",
  );

  console.log(
    "✓ Multi-segment timestamps accumulate in metres",
  );

  console.log(
    "✓ Editor, field placement and Point Z integration supply dimensions",
  );

  console.log(
    "\nPhase 0 metric route-timing verification passed.",
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
