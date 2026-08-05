import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

const expectations = [
  {
    file:
      "src/components/fieldPlacement/FieldSceneLivePreview.tsx",

    calls:
      1,

    thirdArgumentIncludes: [
      "getReconstructionWorldDimensions",
      "reconstruction",
    ],

    requiredImport:
      "reconstructionWorldScale",
  },
  {
    file:
      "src/components/reconstruction/AccidentReconstructionEditor.tsx",

    calls:
      3,

    thirdArgumentIncludes: [
      "getReconstructionWorldDimensions",
      "reconstruction",
    ],
  },
  {
    file:
      "src/components/reconstruction/ar/ARSceneFactory.ts",

    calls:
      1,

    thirdArgumentIncludes: [
      "widthMetres",
      "heightMetres",
      "width",
      "height",
    ],
  },
  {
    file:
      "src/components/reconstruction/ForensicScenePreview.tsx",

    calls:
      1,

    thirdArgumentIncludes: [
      "getReconstructionWorldDimensions",
      "reconstruction",
    ],

    requiredImport:
      "reconstructionWorldScale",
  },
  {
    file:
      "src/components/reconstruction/Reconstruction3DViewer.tsx",

    calls:
      1,

    thirdArgumentIncludes: [
      "widthMetres",
      "heightMetres",
      "width",
      "height",
    ],
  },
  {
    file:
      "src/utils/reconstructionCanvasRenderer.ts",

    calls:
      1,

    thirdArgumentIncludes: [
      "widthMetres",
      "heightMetres",
      "scale.pxPerMetreX",
      "scale.pxPerMetreY",
    ],
  },
  {
    file:
      "src/utils/reconstructionPlaybackDom.ts",

    calls:
      1,

    thirdArgumentIncludes: [
      "getReconstructionWorldDimensions",
      "reconstruction",
    ],

    requiredImport:
      "reconstructionWorldScale",
  },
];

function absolute(relativePath) {
  return path.join(
    root,
    relativePath,
  );
}

function read(relativePath) {
  return fs.readFileSync(
    absolute(relativePath),
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

function parse(
  relativePath,
  source,
) {
  return ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
}

function getCallName(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (
    ts.isPropertyAccessExpression(
      expression,
    )
  ) {
    return expression.name.text;
  }

  return null;
}

let totalCalls =
  0;

for (
  const expectation
  of expectations
) {
  const source =
    read(expectation.file);

  const sourceFile =
    parse(
      expectation.file,
      source,
    );

  const calls = [];

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      getCallName(node.expression) ===
        "getParticipantStateAtTime"
    ) {
      calls.push(node);
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);

  assert(
    calls.length ===
      expectation.calls,
    `Expected ${expectation.calls} calls in ${expectation.file}, found ${calls.length}.`,
  );

  totalCalls +=
    calls.length;

  for (const call of calls) {
    assert(
      call.arguments.length === 3,
      `${expectation.file} still contains a ${call.arguments.length}-argument playback call.`,
    );

    const thirdArgument =
      call.arguments[2].getText(
        sourceFile,
      );

    for (
      const requiredText
      of expectation.thirdArgumentIncludes
    ) {
      assert(
        thirdArgument.includes(
          requiredText,
        ),
        `${expectation.file} third argument is missing "${requiredText}".`,
      );
    }
  }

  if (
    expectation.requiredImport
  ) {
    assert(
      source.includes(
        expectation.requiredImport,
      ) &&
      source.includes(
        "getReconstructionWorldDimensions",
      ),
      `${expectation.file} is missing its world-dimension import.`,
    );
  }

  console.log(
    `✓ ${expectation.file} supplies metric dimensions to ${calls.length} playback call${calls.length === 1 ? "" : "s"}`,
  );
}

assert(
  totalCalls === 9,
  `Expected nine migrated visual calls, found ${totalCalls}.`,
);

console.log(
  "✓ All nine visual playback calls use the canonical metric state API",
);

const geometry =
  read(
    "src/utils/reconstructionGeometry.ts",
  );

assert(
  geometry.includes(
    "[RoadSafe:CanonicalMetricPlaybackGeometryV1]",
  ),
  "Step 3B2A metric playback core marker is missing.",
);

console.log(
  "✓ Step 3B2A canonical metric core remains installed",
);

const physics =
  read(
    "src/services/reconstructionPhysicsService.ts",
  );

const physicsFile =
  parse(
    "src/services/reconstructionPhysicsService.ts",
    physics,
  );

const physicsCalls = [];

function visitPhysics(node) {
  if (
    ts.isCallExpression(node) &&
    getCallName(node.expression) ===
      "getParticipantStateAtTime"
  ) {
    physicsCalls.push(node);
  }

  ts.forEachChild(
    node,
    visitPhysics,
  );
}

visitPhysics(
  physicsFile,
);

assert(
  physicsCalls.length === 4,
  `Expected four physics playback calls, found ${physicsCalls.length}.`,
);

assert(
  physicsCalls.every(
    (call) =>
      call.arguments.length === 3,
  ),
  "A physics playback call has lost its metric dimensions.",
);

console.log(
  "✓ Four physics calls and nine visual calls share the same metric state API",
);

console.log(
  "\nPhase 0 Step 3B2B visual playback migration verification passed.",
);
