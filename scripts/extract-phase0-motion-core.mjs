import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root =
  process.cwd();

const sourceRoot =
  path.join(
    root,
    "src",
  );

const outputPath =
  path.join(
    root,
    "phase0-step3-motion-core.txt",
  );

const targetNames =
  new Set([
    "redistributeAuthoredTimes",
    "getParticipantStateAtTime",
    "participantVelocityAtTime",
    "getParticipantVelocityAtTime",
    "getParticipantSpeedAtTime",
    "interpolateSpeed",
    "interpolateSpeedKmh",
    "sortMovementPathPoints",
    "isPhysicsGeneratedPathPoint",
    "isPhysicsGeneratedRoutePoint",
    "createCleanPhysicsInput",
    "makePhysicsPoint",
    "applyPhysicsSimulation",
    "preparePhysicsForPlayback",
    "getReconstructionWorldDimensions",
    "scenePositionToWorldMetres",
    "worldMetresToScenePosition",
  ]);

function collectSourceFiles(
  directory,
) {
  const results = [];

  for (
    const entry
    of fs.readdirSync(
      directory,
      {
        withFileTypes: true,
      },
    )
  ) {
    const absolutePath =
      path.join(
        directory,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      results.push(
        ...collectSourceFiles(
          absolutePath,
        ),
      );

      continue;
    }

    if (
      entry.name.endsWith(".ts") ||
      entry.name.endsWith(".tsx")
    ) {
      results.push(
        absolutePath,
      );
    }
  }

  return results;
}

function declarationName(
  node,
) {
  if (
    node.name &&
    ts.isIdentifier(
      node.name,
    )
  ) {
    return node.name.text;
  }

  return null;
}

function containingVariableStatement(
  node,
) {
  let current =
    node;

  while (current) {
    if (
      ts.isVariableStatement(
        current,
      )
    ) {
      return current;
    }

    current =
      current.parent;
  }

  return node;
}

function lineNumber(
  sourceFile,
  node,
) {
  return (
    sourceFile
      .getLineAndCharacterOfPosition(
        node.getStart(
          sourceFile,
        ),
      )
      .line +
    1
  );
}

const matches = [];

for (
  const absolutePath
  of collectSourceFiles(
    sourceRoot,
  )
) {
  const content =
    fs
      .readFileSync(
        absolutePath,
        "utf8",
      )
      .replace(
        /\r\n/g,
        "\n",
      );

  const isTsx =
    absolutePath.endsWith(
      ".tsx",
    );

  const sourceFile =
    ts.createSourceFile(
      absolutePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      isTsx
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
    );

  function visit(
    node,
  ) {
    if (
      ts.isFunctionDeclaration(
        node,
      )
    ) {
      const name =
        declarationName(
          node,
        );

      if (
        name &&
        targetNames.has(
          name,
        )
      ) {
        matches.push({
          name,
          absolutePath,
          line:
            lineNumber(
              sourceFile,
              node,
            ),
          text:
            node.getFullText(
              sourceFile,
            ).trim(),
        });
      }
    }

    if (
      ts.isVariableDeclaration(
        node,
      ) &&
      ts.isIdentifier(
        node.name,
      ) &&
      targetNames.has(
        node.name.text,
      )
    ) {
      const declaration =
        containingVariableStatement(
          node,
        );

      matches.push({
        name:
          node.name.text,
        absolutePath,
        line:
          lineNumber(
            sourceFile,
            declaration,
          ),
        text:
          declaration
            .getFullText(
              sourceFile,
            )
            .trim(),
      });
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(
    sourceFile,
  );
}

matches.sort(
  (
    first,
    second,
  ) => {
    const fileComparison =
      first.absolutePath.localeCompare(
        second.absolutePath,
      );

    if (
      fileComparison !== 0
    ) {
      return fileComparison;
    }

    return (
      first.line -
      second.line
    );
  },
);

const output = [];

output.push(
  "RoadSafe AR · Phase 0 Step 3 Focused Motion Core Audit",
);

output.push(
  `Generated: ${new Date().toISOString()}`,
);

output.push(
  `Definitions found: ${matches.length}`,
);

output.push("");

for (
  const match
  of matches
) {
  const relativePath =
    path
      .relative(
        root,
        match.absolutePath,
      )
      .replace(
        /\\/g,
        "/",
      );

  output.push(
    "=".repeat(
      100,
    ),
  );

  output.push(
    `SYMBOL: ${match.name}`,
  );

  output.push(
    `FILE: ${relativePath}`,
  );

  output.push(
    `START LINE: ${match.line}`,
  );

  output.push(
    "=".repeat(
      100,
    ),
  );

  output.push(
    match.text,
    "",
  );
}

const missing =
  [...targetNames]
    .filter(
      (targetName) =>
        !matches.some(
          (match) =>
            match.name ===
            targetName,
        ),
    )
    .sort();

output.push(
  "=".repeat(
    100,
  ),
);

output.push(
  "TARGET SYMBOLS NOT FOUND",
);

output.push(
  "=".repeat(
    100,
  ),
);

if (
  missing.length === 0
) {
  output.push(
    "None",
  );
}
else {
  output.push(
    ...missing,
  );
}

fs.writeFileSync(
  outputPath,
  output.join(
    "\n",
  ),
  "utf8",
);

console.log(
  `Focused audit written to ${outputPath}`,
);

console.log(
  `Definitions found: ${matches.length}`,
);

console.log(
  `Missing optional symbols: ${missing.length}`,
);
