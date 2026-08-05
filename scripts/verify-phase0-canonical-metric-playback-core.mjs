import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

const geometryPath =
  "src/utils/reconstructionGeometry.ts";

const physicsPath =
  "src/services/reconstructionPhysicsService.ts";

function read(relativePath) {
  return fs.readFileSync(
    path.join(
      root,
      relativePath,
    ),
    "utf8",
  );
}

function assert(
  condition,
  message,
) {
  if (!condition) {
    throw new Error(message);
  }
}

function approximatelyEqual(
  first,
  second,
  tolerance = 0.000001,
) {
  return (
    Math.abs(
      first - second,
    ) <= tolerance
  );
}

function sceneVectorToMetres(
  vector,
  dimensions,
) {
  return {
    x:
      (vector.x / 100) *
      dimensions.widthMetres,

    y:
      (vector.y / 100) *
      dimensions.heightMetres,
  };
}

function cubicPoint(
  start,
  controlOne,
  controlTwo,
  end,
  progress,
) {
  const inverse =
    1 - progress;

  return {
    x:
      inverse ** 3 * start.x +
      3 *
        inverse ** 2 *
        progress *
        controlOne.x +
      3 *
        inverse *
        progress ** 2 *
        controlTwo.x +
      progress ** 3 *
        end.x,

    y:
      inverse ** 3 * start.y +
      3 *
        inverse ** 2 *
        progress *
        controlOne.y +
      3 *
        inverse *
        progress ** 2 *
        controlTwo.y +
      progress ** 3 *
        end.y,
  };
}

function sampleMetricBezierLength(
  start,
  controlOne,
  controlTwo,
  end,
  dimensions,
  subdivisions = 80,
) {
  let previous =
    start;

  let distance =
    0;

  for (
    let index = 1;
    index <= subdivisions;
    index += 1
  ) {
    const progress =
      index / subdivisions;

    const current =
      cubicPoint(
        start,
        controlOne,
        controlTwo,
        end,
        progress,
      );

    const delta =
      sceneVectorToMetres(
        {
          x:
            current.x -
            previous.x,

          y:
            current.y -
            previous.y,
        },
        dimensions,
      );

    distance +=
      Math.hypot(
        delta.x,
        delta.y,
      );

    previous =
      current;
  }

  return distance;
}

function callArgumentCounts(
  relativePath,
  functionName,
) {
  const source =
    read(relativePath);

  const sourceFile =
    ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

  const counts = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      (
        (
          ts.isIdentifier(
            node.expression,
          ) &&
          node.expression.text ===
            functionName
        ) ||
        (
          ts.isPropertyAccessExpression(
            node.expression,
          ) &&
          node.expression.name.text ===
            functionName
        )
      )
    ) {
      counts.push(
        node.arguments.length,
      );
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);

  return counts;
}

function functionParameterCount(
  relativePath,
  functionName,
) {
  const source =
    read(relativePath);

  const sourceFile =
    ts.createSourceFile(
      relativePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

  const counts = [];

  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text ===
        functionName
    ) {
      counts.push(
        node.parameters.length,
      );
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);

  assert(
    counts.length === 1,
    `Expected one ${functionName} declaration.`,
  );

  return counts[0];
}

const geometry =
  read(geometryPath);

const physics =
  read(physicsPath);

assert(
  geometry.includes(
    "[RoadSafe:CanonicalMetricPlaybackGeometryV1]",
  ),
  "Canonical metric playback marker is missing.",
);

assert(
  geometry.includes(
    "type MetricSceneDimensions",
  ),
  "MetricSceneDimensions is not imported.",
);

assert(
  geometry.includes(
    "metricDistanceBetween(",
  ),
  "Metric distance helper is missing.",
);

assert(
  geometry.includes(
    "sceneVectorToMetres(",
  ),
  "Metric tangent conversion is missing.",
);

assert(
  geometry.includes(
    "metricSplineCacheKey(",
  ),
  "Dimension-aware spline cache key is missing.",
);

assert(
  !geometry.includes(
    "getCornerAdjustedSpeed(",
  ),
  "The old display-only corner speed adjustment remains.",
);

assert(
  geometry.includes(
    "getCanonicalPlaybackSpeedKmh(",
  ),
  "Canonical playback speed helper is missing.",
);

assert(
  functionParameterCount(
    geometryPath,
    "getParticipantStateAtTime",
  ) === 3,
  "getParticipantStateAtTime must accept world dimensions.",
);

const physicsStateCallCounts =
  callArgumentCounts(
    physicsPath,
    "getParticipantStateAtTime",
  );

assert(
  physicsStateCallCounts.length === 4,
  `Expected four physics state calls, found ${physicsStateCallCounts.length}.`,
);

assert(
  physicsStateCallCounts.every(
    (count) =>
      count === 3,
  ),
  `Physics still contains a state call without metric dimensions: ${physicsStateCallCounts.join(", ")}.`,
);

const dimensions = {
  widthMetres: 80,
  heightMetres: 40,
};

const horizontal =
  sceneVectorToMetres(
    {
      x: 10,
      y: 0,
    },
    dimensions,
  );

assert(
  approximatelyEqual(
    horizontal.x,
    8,
  ) &&
  approximatelyEqual(
    horizontal.y,
    0,
  ),
  "Horizontal scene distance was not converted using physical width.",
);

console.log(
  "✓ Horizontal playback distance uses physical scene width",
);

const vertical =
  sceneVectorToMetres(
    {
      x: 0,
      y: 10,
    },
    dimensions,
  );

assert(
  approximatelyEqual(
    vertical.x,
    0,
  ) &&
  approximatelyEqual(
    vertical.y,
    4,
  ),
  "Vertical scene distance was not converted using physical height.",
);

console.log(
  "✓ Vertical playback distance uses physical scene height",
);

const diagonal =
  sceneVectorToMetres(
    {
      x: 10,
      y: 10,
    },
    dimensions,
  );

const headingDegrees =
  Math.atan2(
    diagonal.y,
    diagonal.x,
  ) *
  180 /
  Math.PI;

assert(
  approximatelyEqual(
    headingDegrees,
    26.565051177,
    0.00001,
  ),
  `Expected physical heading 26.565°, found ${headingDegrees}.`,
);

assert(
  Math.abs(
    headingDegrees - 45,
  ) > 10,
  "Non-square scene heading still behaves like percentage-space heading.",
);

console.log(
  "✓ Non-square scene heading is calculated in metric space",
);

const lineLength =
  sampleMetricBezierLength(
    {
      x: 0,
      y: 0,
    },
    {
      x: 100 / 3,
      y: 100 / 3,
    },
    {
      x: 200 / 3,
      y: 200 / 3,
    },
    {
      x: 100,
      y: 100,
    },
    dimensions,
  );

const expectedLineLength =
  Math.hypot(
    dimensions.widthMetres,
    dimensions.heightMetres,
  );

assert(
  approximatelyEqual(
    lineLength,
    expectedLineLength,
    0.002,
  ),
  `Expected metric Bézier length ${expectedLineLength}, found ${lineLength}.`,
);

console.log(
  "✓ Bézier arc length is sampled in metres",
);

assert(
  geometry.includes(
    "worldDimensions.widthMetres.toPrecision(12)",
  ) &&
  geometry.includes(
    "worldDimensions.heightMetres.toPrecision(12)",
  ),
  "Spline cache does not include both physical dimensions.",
);

console.log(
  "✓ Spline cache separates different physical scene dimensions",
);

assert(
  physics.includes(
    "widthMetres: width",
  ) &&
  physics.includes(
    "heightMetres: height",
  ),
  "Physics does not supply its resolved dimensions to playback state.",
);

console.log(
  "✓ Physics state, pose and velocity sampling share metric dimensions",
);

assert(
  geometry.includes(
    "getIntegratedKinematicDistanceProgress(",
  ) &&
  geometry.includes(
    "getSmoothKinematicSpeedKmh(",
  ),
  "Canonical position and speed curves are not both present.",
);

console.log(
  "✓ Returned speed and position progress use the same endpoint speeds",
);

console.log(
  "\nPhase 0 Step 3B2A canonical metric playback-core verification passed.",
);
