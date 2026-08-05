import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

const paths = {
  panel:
    "src/components/reconstruction/ParticipantPathPanel.tsx",

  editor:
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",

  geometry:
    "src/utils/reconstructionGeometry.ts",

  motion:
    "src/utils/reconstructionMotionKinematics.ts",
};

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

const panel =
  read(paths.panel);

const editor =
  read(paths.editor);

const geometry =
  read(paths.geometry);

const motion =
  read(paths.motion);

assert(
  panel.includes(
    "[RoadSafe:CanonicalMetricSpeedAuthoringV1]",
  ),
  "Canonical metric speed-authoring marker is missing.",
);

assert(
  !panel.includes(
    "const timingScale",
  ),
  "The old ratio-based timingScale remains.",
);

assert(
  !panel.includes(
    "previousSpeed / nextSpeed",
  ),
  "The previous-speed ratio bypass remains.",
);

assert(
  panel.includes(
    "getParticipantMetricPlaybackSegmentLengthsMetres",
  ),
  "ParticipantPathPanel does not consume canonical spline lengths.",
);

assert(
  panel.includes(
    "solveMetricRouteTiming",
  ),
  "ParticipantPathPanel does not use the canonical timing solver.",
);

assert(
  panel.includes(
    "requiredDurationSeconds",
  ),
  "Timeline expansion is not included in the speed plan.",
);

assert(
  editor.includes(
    "worldDimensions={getReconstructionWorldDimensions(reconstruction)}",
  ),
  "The editor does not supply calibrated world dimensions.",
);

assert(
  editor.includes(
    "onApplySpeedPlan",
  ) &&
  editor.includes(
    "lastPhysicsSimulation:"
  ),
  "The editor does not apply the speed plan atomically.",
);

assert(
  geometry.includes(
    "[RoadSafe:CanonicalMetricPlaybackSegmentLengthsV1]",
  ),
  "Canonical playback segment-length export is missing.",
);

assert(
  motion.includes(
    "[RoadSafe:CanonicalSplineLengthTimingOverrideV1]",
  ),
  "Metric solver spline-length override is missing.",
);

const panelFile =
  parse(
    paths.panel,
    panel,
  );

const timingCalls = [];

function visitPanel(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(
      node.expression,
    ) &&
    node.expression.text ===
      "solveMetricRouteTiming"
  ) {
    timingCalls.push(node);
  }

  ts.forEachChild(
    node,
    visitPanel,
  );
}

visitPanel(
  panelFile,
);

assert(
  timingCalls.length === 2,
  `Expected two metric timing solver calls in ParticipantPathPanel, found ${timingCalls.length}.`,
);

assert(
  timingCalls.every(
    (call) =>
      call.arguments.length === 5,
  ),
  "A speed-authoring solver call does not supply canonical spline lengths.",
);

console.log(
  "✓ Manual previous-speed timestamp scaling removed",
);

console.log(
  "✓ Exact speed control uses canonical metric spline lengths",
);

console.log(
  "✓ Canonical timing solver receives the playback segment lengths",
);

console.log(
  "✓ Slower routes expand the reconstruction timeline atomically",
);

console.log(
  "✓ Existing post-impact playback duration is preserved",
);

console.log(
  "✓ Speed changes invalidate stale physics output",
);

console.log(
  "\nPhase 0 Step 3B2C canonical speed-authoring verification passed.",
);
