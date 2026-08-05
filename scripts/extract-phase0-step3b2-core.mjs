import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const repoRoot = process.cwd();

const reportPath = path.join(
  repoRoot,
  "phase0-step3b2-core-source.txt",
);

const expectedBranch = "main";

const expectedTree =
  "4984ac674907f7720703048b84884d1718525d3c";

const sourceFiles = [
  "src/utils/reconstructionGeometry.ts",
  "src/services/reconstructionPhysicsService.ts",
  "src/components/fieldPlacement/FieldSceneLivePreview.tsx",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/ar/ARSceneFactory.ts",
  "src/components/reconstruction/ForensicScenePreview.tsx",
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
  "src/utils/reconstructionCanvasRenderer.ts",
  "src/utils/reconstructionPlaybackDom.ts",
  "src/components/reconstruction/ParticipantPathPanel.tsx",
];

const exactFunctionNames = new Set([
  "getParticipantStateAtTime",
  "getKinematicPositionProgress",
  "getCornerAdjustedSpeed",
  "createBezierArcLengthSamples",
  "getBezierProgressAtDistanceFraction",
  "getSmoothedBezierTangent",
  "getParticipantMotionSplines",
  "getParticipantPlaybackPathPoints",
  "participantWorldPositionAtTime",
  "participantVelocityAtTime",
  "participantPoseAtTime",
]);

const relatedFunctionPattern =
  /Bezier|Spline|MotionGeometry|ParticipantState|Kinematic|CornerAdjusted|VelocityAtTime|WorldPositionAtTime|PoseAtTime/i;

const interestingCallNames = new Set([
  "getParticipantStateAtTime",
  "participantWorldPositionAtTime",
  "participantVelocityAtTime",
  "participantPoseAtTime",
  "getReconstructionWorldDimensions",
  "getScenePhysicalDimensions",
  "createBezierArcLengthSamples",
  "getBezierProgressAtDistanceFraction",
  "getSmoothedBezierTangent",
  "getParticipantMotionSplines",
]);

function runGit(args) {
  return execFileSync(
    "git",
    args,
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: [
        "ignore",
        "pipe",
        "pipe",
      ],
    },
  ).trim();
}

function assertRepositoryCheckpoint() {
  const branch =
    runGit([
      "branch",
      "--show-current",
    ]);

  const head =
    runGit([
      "rev-parse",
      "--short",
      "HEAD",
    ]);

  const tree =
    runGit([
      "rev-parse",
      "HEAD^{tree}",
    ]);

  const status = runGit([
    "status",
    "--porcelain",
  ]);

  const allowedGeneratedPaths = new Set([
    "scripts/extract-phase0-step3b2-core.mjs",
    "phase0-step3b2-core-source.txt",
  ]);

  const unexpectedStatus = status
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => {
      const pathText = line
        .slice(3)
        .trim()
        .replaceAll("\\", "/");

      return !allowedGeneratedPaths.has(pathText);
    });

  if (unexpectedStatus.length > 0) {
    throw new Error(
      [
        "Working tree contains unrelated changes.",
        ...unexpectedStatus,
      ].join("\n"),
    );
  }
  return {
    branch,
    head,
    tree,
  };
}

function scriptKindFor(filePath) {
  return filePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
}

function getLineNumber(sourceFile, position) {
  return (
    sourceFile
      .getLineAndCharacterOfPosition(position)
      .line + 1
  );
}

function getNodeText(sourceFile, node) {
  return sourceFile.text.slice(
    node.getStart(sourceFile),
    node.getEnd(),
  );
}

function getDeclarationName(node) {
  if (
    (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isFunctionExpression(node)
    ) &&
    node.name &&
    ts.isIdentifier(node.name)
  ) {
    return node.name.text;
  }

  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (
      ts.isArrowFunction(node.initializer) ||
      ts.isFunctionExpression(node.initializer)
    )
  ) {
    return node.name.text;
  }

  return null;
}

function declarationContainer(node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.parent &&
    node.parent.parent &&
    ts.isVariableStatement(node.parent.parent)
  ) {
    return node.parent.parent;
  }

  return node;
}

function getCallName(expression) {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }

  return null;
}

function formatSourceBlock({
  file,
  label,
  sourceFile,
  node,
}) {
  const container =
    declarationContainer(node);

  const startLine =
    getLineNumber(
      sourceFile,
      container.getStart(sourceFile),
    );

  const endLine =
    getLineNumber(
      sourceFile,
      container.getEnd(),
    );

  return [
    `FILE: ${file}`,
    `LINES: ${startLine}-${endLine}`,
    `SYMBOL: ${label}`,
    "```ts",
    getNodeText(
      sourceFile,
      container,
    ),
    "```",
    "",
  ].join("\n");
}

function collectLineContexts(
  file,
  sourceText,
  terms,
  radius = 10,
) {
  const lines =
    sourceText.split(/\r?\n/);

  const capturedRanges = [];
  const blocks = [];

  for (
    let lineIndex = 0;
    lineIndex < lines.length;
    lineIndex += 1
  ) {
    const line =
      lines[lineIndex];

    const matchingTerm =
      terms.find(
        (term) =>
          line
            .toLowerCase()
            .includes(
              term.toLowerCase(),
            ),
      );

    if (!matchingTerm) {
      continue;
    }

    const start =
      Math.max(
        0,
        lineIndex - radius,
      );

    const end =
      Math.min(
        lines.length - 1,
        lineIndex + radius,
      );

    const overlapsExistingRange =
      capturedRanges.some(
        (range) =>
          start <= range.end &&
          end >= range.start,
      );

    if (overlapsExistingRange) {
      continue;
    }

    capturedRanges.push({
      start,
      end,
    });

    const numberedLines = [];

    for (
      let contextLine = start;
      contextLine <= end;
      contextLine += 1
    ) {
      numberedLines.push(
        `${String(contextLine + 1).padStart(5, " ")} | ${lines[contextLine]}`,
      );
    }

    blocks.push(
      [
        `FILE: ${file}`,
        `MATCH: ${matchingTerm}`,
        `LINES: ${start + 1}-${end + 1}`,
        "```text",
        numberedLines.join("\n"),
        "```",
        "",
      ].join("\n"),
    );
  }

  return blocks;
}

function parseSourceFile(relativePath) {
  const absolutePath =
    path.join(
      repoRoot,
      relativePath,
    );

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `Required source file is missing: ${relativePath}`,
    );
  }

  const sourceText =
    fs.readFileSync(
      absolutePath,
      "utf8",
    );

  const sourceFile =
    ts.createSourceFile(
      relativePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKindFor(relativePath),
    );

  return {
    sourceText,
    sourceFile,
  };
}

const checkpoint =
  assertRepositoryCheckpoint();

const declarations = [];
const calls = [];
const imports = [];
const manualTimingContexts = [];
const arcLengthContexts = [];
const dimensionContexts = [];

for (const file of sourceFiles) {
  const {
    sourceText,
    sourceFile,
  } =
    parseSourceFile(file);

  function visit(node) {
    const declarationName =
      getDeclarationName(node);

    if (
      declarationName &&
      (
        exactFunctionNames.has(
          declarationName,
        ) ||
        relatedFunctionPattern.test(
          declarationName,
        )
      )
    ) {
      declarations.push({
        file,
        name: declarationName,
        sourceFile,
        node,
      });
    }

    if (
      ts.isImportDeclaration(node)
    ) {
      const importText =
        getNodeText(
          sourceFile,
          node,
        );

      const isRelevantImport =
        [
          ...exactFunctionNames,
          "getReconstructionWorldDimensions",
          "getScenePhysicalDimensions",
        ].some(
          (name) =>
            importText.includes(name),
        );

      if (isRelevantImport) {
        imports.push({
          file,
          line:
            getLineNumber(
              sourceFile,
              node.getStart(sourceFile),
            ),
          text: importText,
        });
      }
    }

    if (ts.isCallExpression(node)) {
      const callName =
        getCallName(
          node.expression,
        );

      if (
        callName &&
        interestingCallNames.has(callName)
      ) {
        calls.push({
          file,
          name: callName,
          line:
            getLineNumber(
              sourceFile,
              node.getStart(sourceFile),
            ),
          argumentCount:
            node.arguments.length,
          text:
            getNodeText(
              sourceFile,
              node,
            ),
        });
      }
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);

  if (
    file.endsWith(
      "ParticipantPathPanel.tsx",
    )
  ) {
    manualTimingContexts.push(
      ...collectLineContexts(
        file,
        sourceText,
        [
          "timingScale",
          "previousSpeed / nextSpeed",
          "toFixed(2)",
          "authored movement point timing",
          "speedKmh: nextSpeed",
        ],
        14,
      ),
    );
  }

  if (
    file.endsWith(
      "reconstructionGeometry.ts",
    )
  ) {
    arcLengthContexts.push(
      ...collectLineContexts(
        file,
        sourceText,
        [
          "createBezierArcLengthSamples",
          "Math.hypot",
          "cumulativeLength",
          "distanceFraction",
          "getSmoothedBezierTangent",
        ],
        12,
      ),
    );
  }

  dimensionContexts.push(
    ...collectLineContexts(
      file,
      sourceText,
      [
        "getReconstructionWorldDimensions",
        "getScenePhysicalDimensions",
        "widthMetres",
        "heightMetres",
      ],
      7,
    ),
  );
}

declarations.sort(
  (left, right) =>
    left.file.localeCompare(
      right.file,
    ) ||
    left.name.localeCompare(
      right.name,
    ) ||
    left.node.pos - right.node.pos,
);

calls.sort(
  (left, right) =>
    left.file.localeCompare(
      right.file,
    ) ||
    left.line - right.line,
);

imports.sort(
  (left, right) =>
    left.file.localeCompare(
      right.file,
    ) ||
    left.line - right.line,
);

const participantStateCalls =
  calls.filter(
    (call) =>
      call.name ===
      "getParticipantStateAtTime",
  );

const report = [];

report.push(
  "=== PHASE 0 STEP 3B2 · EXACT PLAYBACK CORE SOURCE ===",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Branch: ${checkpoint.branch}`,
  `HEAD: ${checkpoint.head}`,
  `Tree: ${checkpoint.tree}`,
  `Files scanned: ${sourceFiles.length}`,
  `Matching declarations: ${declarations.length}`,
  `All selected calls: ${calls.length}`,
  `Actual getParticipantStateAtTime calls: ${participantStateCalls.length}`,
  "",
);

report.push(
  "=== FILES SCANNED ===",
  "",
  ...sourceFiles,
  "",
);

report.push(
  "=== RELEVANT IMPORTS ===",
  "",
);

for (const item of imports) {
  report.push(
    `FILE: ${item.file}`,
    `LINE: ${item.line}`,
    "```ts",
    item.text,
    "```",
    "",
  );
}

report.push(
  "=== EXACT FUNCTION DECLARATIONS ===",
  "",
);

for (const declaration of declarations) {
  report.push(
    formatSourceBlock({
      file:
        declaration.file,
      label:
        declaration.name,
      sourceFile:
        declaration.sourceFile,
      node:
        declaration.node,
    }),
  );
}

report.push(
  "=== ACTUAL getParticipantStateAtTime CALLS ===",
  "",
);

for (const call of participantStateCalls) {
  report.push(
    `FILE: ${call.file}`,
    `LINE: ${call.line}`,
    `ARGUMENT COUNT: ${call.argumentCount}`,
    "```ts",
    call.text,
    "```",
    "",
  );
}

report.push(
  "=== OTHER PLAYBACK / PHYSICS / DIMENSION CALLS ===",
  "",
);

for (const call of calls) {
  if (
    call.name ===
    "getParticipantStateAtTime"
  ) {
    continue;
  }

  report.push(
    `FILE: ${call.file}`,
    `LINE: ${call.line}`,
    `CALL: ${call.name}`,
    `ARGUMENT COUNT: ${call.argumentCount}`,
    "```ts",
    call.text,
    "```",
    "",
  );
}

report.push(
  "=== PARTICIPANT PATH PANEL MANUAL TIMING CONTEXT ===",
  "",
  ...manualTimingContexts,
);

report.push(
  "=== BEZIER ARC-LENGTH AND TANGENT CONTEXT ===",
  "",
  ...arcLengthContexts,
);

report.push(
  "=== WORLD-DIMENSION CONTEXT ===",
  "",
  ...dimensionContexts,
);

report.push(
  "=== EXTRACTION SUMMARY ===",
  "",
  `Matching declarations: ${declarations.length}`,
  `Actual getParticipantStateAtTime calls: ${participantStateCalls.length}`,
  `Relevant imports: ${imports.length}`,
  `Manual timing contexts: ${manualTimingContexts.length}`,
  `Arc-length contexts: ${arcLengthContexts.length}`,
  `Dimension contexts: ${dimensionContexts.length}`,
  "",
);

fs.writeFileSync(
  reportPath,
  report.join("\n"),
  "utf8",
);

console.log(
  `Branch: ${checkpoint.branch}`,
);

console.log(
  `HEAD: ${checkpoint.head}`,
);

console.log(
  `Tree: ${checkpoint.tree}`,
);

console.log(
  `Matching declarations: ${declarations.length}`,
);

console.log(
  `Actual getParticipantStateAtTime calls: ${participantStateCalls.length}`,
);

console.log(
  `All selected calls: ${calls.length}`,
);

console.log(
  `Report written: ${path.relative(repoRoot, reportPath)}`,
);

