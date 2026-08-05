import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root =
  process.cwd();

const reportPath =
  path.join(
    root,
    "phase0-step4a-impact-response-context.txt",
  );

const files = {
  types:
    "src/types/reconstruction.ts",

  physics:
    "src/services/reconstructionPhysicsService.ts",

  collisionGeometry:
    "src/services/physicsCollisionGeometry.ts",

  viewer3d:
    "src/components/reconstruction/Reconstruction3DViewer.tsx",

  arFactory:
    "src/components/reconstruction/ar/ARSceneFactory.ts",

  canvas:
    "src/utils/reconstructionCanvasRenderer.ts",

  playbackDom:
    "src/utils/reconstructionPlaybackDom.ts",

  geometry:
    "src/utils/reconstructionGeometry.ts",

  package:
    "package.json",

  phaseConfig:
    "tsconfig.phase0.json",
};

const output = [];

function add(
  value = "",
) {
  output.push(value);
}

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
  const target =
    absolute(relativePath);

  if (!fs.existsSync(target)) {
    throw new Error(
      `Required file is missing: ${relativePath}`,
    );
  }

  return fs
    .readFileSync(
      target,
      "utf8",
    )
    .replace(/\r\n/g, "\n");
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

function declarationName(
  node,
) {
  if (
    (
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isEnumDeclaration(node)
    ) &&
    node.name
  ) {
    return node.name.text;
  }

  if (
    ts.isVariableStatement(node)
  ) {
    const names =
      node.declarationList.declarations
        .map(
          (declaration) =>
            ts.isIdentifier(
              declaration.name,
            )
              ? declaration.name.text
              : "",
        )
        .filter(Boolean);

    return names.join(", ");
  }

  return "";
}

function isDeclarationNode(
  node,
) {
  return (
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isVariableStatement(node)
  );
}

function lineNumberAt(
  source,
  position,
) {
  let line = 1;

  for (
    let index = 0;
    index < position;
    index += 1
  ) {
    if (
      source.charCodeAt(index) === 10
    ) {
      line += 1;
    }
  }

  return line;
}

function addNumberedText(
  relativePath,
  source,
  start,
  end,
  title,
) {
  const before =
    source.slice(
      0,
      start,
    );

  const startLine =
    before.split("\n").length;

  const text =
    source.slice(
      start,
      end,
    );

  const lines =
    text.split("\n");

  add(
    "============================================================",
  );

  add(
    `FILE: ${relativePath}`,
  );

  add(
    `SECTION: ${title}`,
  );

  add(
    `START LINE: ${startLine}`,
  );

  add("```text");

  lines.forEach(
    (
      line,
      index,
    ) => {
      add(
        `${String(
          startLine + index,
        ).padStart(6)} | ${line}`,
      );
    },
  );

  add("```");
  add();
}

function extractNamedDeclarations(
  relativePath,
  names,
) {
  const source =
    read(relativePath);

  const sourceFile =
    parse(
      relativePath,
      source,
    );

  const matches = [];

  function visit(
    node,
  ) {
    if (
      isDeclarationNode(node)
    ) {
      const name =
        declarationName(node);

      const matchedNames =
        names.filter(
          (candidate) =>
            name
              .split(",")
              .map(
                (part) =>
                  part.trim(),
              )
              .includes(candidate),
        );

      if (
        matchedNames.length > 0
      ) {
        matches.push({
          node,
          names:
            matchedNames,
        });
      }
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(sourceFile);

  for (
    const name of names
  ) {
    const namedMatches =
      matches.filter(
        (match) =>
          match.names.includes(name),
      );

    if (
      namedMatches.length === 0
    ) {
      add(
        `MISSING DECLARATION: ${relativePath} :: ${name}`,
      );
      add();
      continue;
    }

    namedMatches.forEach(
      (
        match,
        index,
      ) => {
        addNumberedText(
          relativePath,
          source,
          match.node.getStart(
            sourceFile,
          ),
          match.node.getEnd(),
          `${name}${
            namedMatches.length > 1
              ? ` · match ${index + 1}`
              : ""
          }`,
        );
      },
    );
  }
}

function mergeWindows(
  windows,
) {
  if (
    windows.length === 0
  ) {
    return [];
  }

  const sorted =
    [...windows].sort(
      (
        left,
        right,
      ) =>
        left.startLine -
        right.startLine,
    );

  const merged = [
    {
      ...sorted[0],
      patterns:
        new Set(
          sorted[0].patterns,
        ),
    },
  ];

  for (
    let index = 1;
    index < sorted.length;
    index += 1
  ) {
    const current =
      sorted[index];

    const previous =
      merged[
        merged.length - 1
      ];

    if (
      current.startLine <=
      previous.endLine + 4
    ) {
      previous.endLine =
        Math.max(
          previous.endLine,
          current.endLine,
        );

      current.patterns.forEach(
        (pattern) =>
          previous.patterns.add(
            pattern,
          ),
      );
    } else {
      merged.push({
        ...current,
        patterns:
          new Set(
            current.patterns,
          ),
      });
    }
  }

  return merged;
}

function extractPatternContexts(
  relativePath,
  patterns,
  contextLines = 32,
) {
  const source =
    read(relativePath);

  const lines =
    source.split("\n");

  const windows = [];

  patterns.forEach(
    (pattern) => {
      lines.forEach(
        (
          line,
          index,
        ) => {
          if (
            line.includes(pattern)
          ) {
            windows.push({
              startLine:
                Math.max(
                  1,
                  index +
                    1 -
                    contextLines,
                ),

              endLine:
                Math.min(
                  lines.length,
                  index +
                    1 +
                    contextLines,
                ),

              patterns: [
                pattern,
              ],
            });
          }
        },
      );
    },
  );

  const merged =
    mergeWindows(windows);

  if (
    merged.length === 0
  ) {
    add(
      `NO PATTERN MATCHES: ${relativePath}`,
    );

    patterns.forEach(
      (pattern) =>
        add(
          `  - ${pattern}`,
        ),
    );

    add();
    return;
  }

  merged.forEach(
    (
      window,
      index,
    ) => {
      const sectionLines =
        lines.slice(
          window.startLine - 1,
          window.endLine,
        );

      add(
        "============================================================",
      );

      add(
        `FILE: ${relativePath}`,
      );

      add(
        `PATTERN CONTEXT ${index + 1}`,
      );

      add(
        `MATCHED: ${[
          ...window.patterns,
        ].join(" | ")}`,
      );

      add(
        `LINES: ${window.startLine}-${window.endLine}`,
      );

      add("```text");

      sectionLines.forEach(
        (
          line,
          lineIndex,
        ) => {
          add(
            `${String(
              window.startLine +
                lineIndex,
            ).padStart(6)} | ${line}`,
          );
        },
      );

      add("```");
      add();
    },
  );
}

function addWholeFile(
  relativePath,
) {
  const source =
    read(relativePath);

  addNumberedText(
    relativePath,
    source,
    0,
    source.length,
    "Complete file",
  );
}

add(
  "=== ROADSAFE PHASE 0 STEP 4A · IMPACT RESPONSE DATA AUDIT ===",
);

add();
add(
  `Generated: ${new Date().toISOString()}`,
);
add();

add(
  "=== TYPE CONTRACTS ===",
);

add();

extractNamedDeclarations(
  files.types,
  [
    "MovementPathPoint",
    "ReconstructionVehicle",
    "ReconstructionEntity",
    "ParticipantPhysicsProfile",
    "ReconstructionPhysicsSettings",
    "CollisionKinematicOutcome",
    "ParticipantCollisionKinematics",
    "CollisionKinematicsSummary",
    "PhysicsCollisionEvent",
    "PhysicsSimulationSummary",
    "AccidentReconstruction",
  ],
);

add(
  "=== COLLISION GEOMETRY CONTRACTS ===",
);

add();

extractNamedDeclarations(
  files.collisionGeometry,
  [
    "PhysicsPose2D",
    "PhysicsShapeDimensions",
    "PhysicsCollisionManifold",
    "createPhysicsCollisionShape",
    "getPhysicsCollisionManifold",
    "findSweptPhysicsCollision",
    "velocityAtContactPoint",
    "calculatePlanarMomentOfInertia",
  ],
);

add(
  "=== PHYSICS SOLVER CORE ===",
);

add();

extractNamedDeclarations(
  files.physics,
  [
    "SimulationBody",
    "CollisionParticipantChange",
    "CollisionImpulseResult",
    "applyImpulseToBody",
    "contactVelocity",
    "resolveParticipantCollision",
    "resolveStaticObjectCollision",
    "getDefaultParticipantPhysics",
    "runReconstructionPhysics",
  ],
);

extractPatternContexts(
  files.physics,
  [
    "collisionEvents.push",
    "primaryCollisionKinematics",
    "participantKinematics",
    "trajectorySamples",
    "generatedPathPoints",
    "angularVelocityChangesDegPerSecond",
    "primaryImpactTimeSeconds",
    "primaryResponseAction",
    "primaryResponseLabel",
    "impactEnergyKj",
    "outgoingVelocity",
    "outgoingAngularVelocityDegreesPerSecond",
  ],
  38,
);

add(
  "=== 3D COLLISION VISUALISATION ===",
);

add();

extractNamedDeclarations(
  files.viewer3d,
  [
    "ParticipantRenderEntry",
    "applyImpactPose",
    "Reconstruction3DViewer",
  ],
);

extractPatternContexts(
  files.viewer3d,
  [
    "applyImpactPose(",
    "lastPhysicsSimulation",
    "primaryCollisionKinematics",
    "participantKinematics",
    "impactTime",
    "showImpactEffects",
    "modelRoot",
    "holder.position",
    "holder.rotation",
    "angularVelocity",
  ],
  42,
);

add(
  "=== AR COLLISION VISUALISATION ===",
);

add();

extractPatternContexts(
  files.arFactory,
  [
    "getParticipantStateAtTime",
    "lastPhysicsSimulation",
    "primaryCollisionKinematics",
    "participantKinematics",
    "collisionEvents",
    "impact",
    "rotation",
    "position",
  ],
  40,
);

add(
  "=== 2D AND EXPORTED PLAYBACK VISUALISATION ===",
);

add();

extractPatternContexts(
  files.canvas,
  [
    "getParticipantStateAtTime",
    "lastPhysicsSimulation",
    "collisionEvents",
    "impact",
    "rotation",
    "physics",
  ],
  34,
);

extractPatternContexts(
  files.playbackDom,
  [
    "getParticipantStateAtTime",
    "lastPhysicsSimulation",
    "collisionEvents",
    "impact",
    "rotation",
    "physics",
  ],
  34,
);

add(
  "=== CANONICAL PLAYBACK PATH DATA ===",
);

add();

extractNamedDeclarations(
  files.geometry,
  [
    "getParticipantPlaybackPathPoints",
    "getParticipantStateAtTime",
    "isPhysicsGeneratedPathPoint",
    "getPhysicsPathPoints",
  ],
);

extractPatternContexts(
  files.geometry,
  [
    "physics-transition",
    "physics-point",
    "Natural rest position",
    "primaryResponseAction",
    "primaryResponseLabel",
  ],
  34,
);

add(
  "=== BUILD AND VERIFICATION CONFIGURATION ===",
);

add();

addWholeFile(
  files.package,
);

addWholeFile(
  files.phaseConfig,
);

fs.writeFileSync(
  reportPath,
  `${output.join("\n")}\n`,
  "utf8",
);

console.log(
  "Phase 0 Step 4A impact-response context extracted.",
);

console.log(
  `Report: ${path.basename(reportPath)}`,
);

console.log(
  `Lines: ${output.length}`,
);
