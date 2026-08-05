import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const sourcePath =
  "src/utils/reconstructionRouteTopology.ts";

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
    transpiled
      .diagnostics ??
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
      .join(
        "\n",
      ),
  );
}

const temporaryPath =
  path.join(
    os.tmpdir(),
    `roadsafe-route-topology-${process.pid}-${Date.now()}.mjs`,
  );

fs.writeFileSync(
  temporaryPath,
  transpiled.outputText,
  "utf8",
);

const module =
  await import(
    pathToFileURL(
      temporaryPath,
    ).href +
      `?v=${Date.now()}`
  );

try {
  const normalise =
    module
      .normaliseMetricRouteTopology;

  assert.equal(
    typeof normalise,
    "function",
    "Topology normaliser was not exported.",
  );

  const validCurve =
    normalise(
      [
        {
          x: 0,
          y: 0,
        },
        {
          x: 8,
          y: 1,
        },
        {
          x: 16,
          y: 4,
        },
        {
          x: 24,
          y: 8,
        },
        {
          x: 30,
          y: 10,
        },
      ],
      {
        x: 30,
        y: 10,
      },
      "Car",
    );

  assert.equal(
    validCurve.valid,
    true,
    "A normal curved approach was rejected.",
  );

  assert.deepEqual(
    validCurve
      .points
      .at(-1),
    {
      x: 30,
      y: 10,
    },
    "Point Z was not retained as the endpoint.",
  );

  const liveMalformedRoute =
    normalise(
      [
        {
          x: 10.9494,
          y: 17.1037,
        },
        {
          x: 19.6588,
          y: 22.6891,
        },
        {
          x: 28.026,
          y: 29.4567,
        },
        {
          x: 36.9214,
          y: 34.3993,
        },
        {
          x: 55.1531,
          y: 42.7617,
        },
        {
          x: 0.9162,
          y: 17.8848,
        },
        {
          x: 44.6631,
          y: 37.9502,
        },
      ],
      {
        x: 52.617468,
        y: 42.97575,
      },
      "Car",
    );

  assert.equal(
    liveMalformedRoute
      .points
      .some(
        (point) =>
          Math.abs(
            point.x -
              0.9162,
          ) <
            0.001,
      ),
    false,
    "The catastrophic Point 6 jump survived.",
  );

  assert.equal(
    liveMalformedRoute
      .points
      .some(
        (point) =>
          Math.abs(
            point.x -
              44.6631,
          ) <
            0.001 &&
          Math.abs(
            point.y -
              37.9502,
          ) <
            0.001,
      ),
    false,
    "The post-approach return point survived.",
  );

  /*
   * Point 5 already enters the collision-capture area. The strongest and
   * earliest diagnosis is therefore PostCaptureContinuation: Point 6 and
   * Point 7 are invalid because the route has already reached Point Z.
   *
   * CatastrophicJump, ReverseAfterApproach and SevereDetour remain acceptable
   * diagnoses for malformed routes that have not entered collision capture.
   */
  assert.equal(
    liveMalformedRoute
      .issues
      .some(
        (issue) =>
          issue.code ===
            "PostCaptureContinuation" ||
          issue.code ===
            "CatastrophicJump" ||
          issue.code ===
            "ReverseAfterApproach" ||
          issue.code ===
            "SevereDetour",
      ),
    true,
    "The malformed live route was not diagnosed.",
  );

  assert.equal(
    liveMalformedRoute
      .issues
      .some(
        (issue) =>
          issue.code ===
          "PostCaptureContinuation",
      ),
    true,
    "The live route did not report continuation after collision capture.",
  );

  const overshoot =
    normalise(
      [
        {
          x: 0,
          y: 0,
        },
        {
          x: 8,
          y: 0,
        },
        {
          x: 10.4,
          y: 0,
        },
        {
          x: 18,
          y: 0,
        },
      ],
      {
        x: 10,
        y: 0,
      },
      "Car",
    );

  assert.equal(
    overshoot
      .issues
      .some(
        (issue) =>
          issue.code ===
          "PostCaptureContinuation",
      ),
    true,
    "A route continuing beyond collision capture was not diagnosed.",
  );

  assert.deepEqual(
    overshoot
      .points
      .at(-1),
    {
      x: 10,
      y: 0,
    },
    "The overshoot route did not terminate at Point Z.",
  );

  const selfCrossing =
    normalise(
      [
        {
          x: 0,
          y: 0,
        },
        {
          x: 10,
          y: 10,
        },
        {
          x: 0,
          y: 10,
        },
        {
          x: 10,
          y: 0,
        },
      ],
      {
        x: 12,
        y: 0,
      },
      "Car",
    );

  assert.equal(
    selfCrossing
      .issues
      .some(
        (issue) =>
          issue.code ===
          "SelfIntersection",
      ),
    true,
    "A self-intersecting route was not diagnosed.",
  );

  console.log(
    "✓ Valid curved route accepted",
  );

  console.log(
    "✓ Live Point 6 catastrophic jump removed",
  );

  console.log(
    "✓ Post-approach return removed",
  );

  console.log(
    "✓ Collision overshoot terminated",
  );

  console.log(
    "✓ Self-intersection detected",
  );

  const routing =
    fs.readFileSync(
      "src/utils/reconstructionRoadRouting.ts",
      "utf8",
    );

  const authoring =
    fs.readFileSync(
      "src/utils/participantRouteAuthoring.ts",
      "utf8",
    );

  assert.equal(
    routing.includes(
      "SpawnRouteDirectionGuardV1",
    ),
    false,
    "Legacy spawn guard remains.",
  );

  assert.equal(
    routing.includes(
      "TrimRouteAtCollision",
    ),
    false,
    "Legacy collision trim remains.",
  );

  assert.equal(
    authoring.includes(
      "collisionRouteTolerance",
    ),
    false,
    "Percentage collision tolerance remains.",
  );

  assert.equal(
    authoring.includes(
      "routeTravelDotToCollision",
    ),
    false,
    "Percentage travel-dot helper remains.",
  );

  assert.equal(
    routing.includes(
      "MetricRouteTopologyAppliedV1",
    ),
    true,
    "Metric topology was not connected to route generation.",
  );

  assert.equal(
    authoring.includes(
      "MetricCollisionTerminatedRouteV2",
    ),
    true,
    "Metric topology was not connected to route authoring.",
  );

  console.log(
    "\nPhase 0 metric route-topology verification passed.",
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
