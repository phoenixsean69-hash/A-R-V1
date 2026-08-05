import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root =
  process.cwd();

const outputPath =
  path.join(
    root,
    "phase0-step3b-integration-audit.txt",
  );

const sourceRoot =
  path.join(
    root,
    "src",
  );

const targetDeclarations =
  new Set([
    "NormalisePointZRouteOptions",
    "CreateLockedParticipantRouteOptions",
    "redistributeAuthoredTimes",
    "normalisePointZRoute",
    "createLockedParticipantRoute",
    "getReconstructionWorldDimensions",
    "getParticipantStateAtTime",
    "getKinematicPositionProgress",
    "getSegmentMotionGeometry",
  ]);

const targetCalls =
  new Set([
    "normalisePointZRoute",
    "createLockedParticipantRoute",
    "getParticipantStateAtTime",
    "redistributeAuthoredTimes",
  ]);

function collectSourceFiles(
  directory,
) {
  const files = [];

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

    if (entry.isDirectory()) {
      files.push(
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
      files.push(
        absolutePath,
      );
    }
  }

  return files;
}

function relative(
  absolutePath,
) {
  return path
    .relative(
      root,
      absolutePath,
    )
    .replace(
      /\\/g,
      "/",
    );
}

function lineNumber(
  sourceFile,
  position,
) {
  return (
    sourceFile
      .getLineAndCharacterOfPosition(
        position,
      )
      .line +
    1
  );
}

function nodeName(
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

function declarationContainer(
  node,
) {
  if (
    ts.isVariableDeclaration(
      node,
    )
  ) {
    let current =
      node;

    while (
      current &&
      !ts.isVariableStatement(
        current,
      )
    ) {
      current =
        current.parent;
    }

    return current ?? node;
  }

  return node;
}

function enclosingFunction(
  node,
) {
  let current =
    node.parent;

  while (current) {
    if (
      ts.isFunctionDeclaration(
        current,
      ) ||
      ts.isFunctionExpression(
        current,
      ) ||
      ts.isArrowFunction(
        current,
      ) ||
      ts.isMethodDeclaration(
        current,
      )
    ) {
      if (
        current.name &&
        ts.isIdentifier(
          current.name,
        )
      ) {
        return current.name.text;
      }

      if (
        ts.isVariableDeclaration(
          current.parent,
        ) &&
        ts.isIdentifier(
          current.parent.name,
        )
      ) {
        return current.parent.name.text;
      }

      return "<anonymous>";
    }

    current =
      current.parent;
  }

  return "<module>";
}

const declarations = [];
const calls = [];
const imports = [];

for (
  const absolutePath
  of collectSourceFiles(
    sourceRoot,
  )
) {
  const text =
    fs
      .readFileSync(
        absolutePath,
        "utf8",
      )
      .replace(
        /\r\n/g,
        "\n",
      );

  const sourceFile =
    ts.createSourceFile(
      absolutePath,
      text,
      ts.ScriptTarget.Latest,
      true,
      absolutePath.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS,
    );

  function visit(
    node,
  ) {
    if (
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isFunctionDeclaration(node)
    ) {
      const name =
        nodeName(node);

      if (
        name &&
        targetDeclarations.has(name)
      ) {
        const container =
          declarationContainer(node);

        declarations.push({
          name,
          file:
            relative(absolutePath),
          line:
            lineNumber(
              sourceFile,
              container.getStart(
                sourceFile,
              ),
            ),
          text:
            container
              .getFullText(
                sourceFile,
              )
              .trim(),
        });
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      targetDeclarations.has(
        node.name.text,
      )
    ) {
      const container =
        declarationContainer(node);

      declarations.push({
        name:
          node.name.text,
        file:
          relative(absolutePath),
        line:
          lineNumber(
            sourceFile,
            container.getStart(
              sourceFile,
            ),
          ),
        text:
          container
            .getFullText(
              sourceFile,
            )
            .trim(),
      });
    }

    if (
      ts.isCallExpression(node)
    ) {
      let calledName = null;

      if (
        ts.isIdentifier(
          node.expression,
        )
      ) {
        calledName =
          node.expression.text;
      }
      else if (
        ts.isPropertyAccessExpression(
          node.expression,
        )
      ) {
        calledName =
          node.expression.name.text;
      }

      if (
        calledName &&
        targetCalls.has(
          calledName,
        )
      ) {
        calls.push({
          name:
            calledName,
          file:
            relative(absolutePath),
          line:
            lineNumber(
              sourceFile,
              node.getStart(
                sourceFile,
              ),
            ),
          owner:
            enclosingFunction(
              node,
            ),
          text:
            node
              .getFullText(
                sourceFile,
              )
              .trim(),
        });
      }
    }

    if (
      ts.isImportDeclaration(
        node,
      ) &&
      ts.isStringLiteral(
        node.moduleSpecifier,
      )
    ) {
      const importText =
        node.getFullText(
          sourceFile,
        );

      if (
        importText.includes(
          "participantRouteAuthoring",
        ) ||
        importText.includes(
          "reconstructionWorldScale",
        ) ||
        importText.includes(
          "reconstructionMotionKinematics",
        )
      ) {
        imports.push({
          file:
            relative(absolutePath),
          line:
            lineNumber(
              sourceFile,
              node.getStart(
                sourceFile,
              ),
            ),
          text:
            importText.trim(),
        });
      }
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

declarations.sort(
  (left, right) =>
    left.file.localeCompare(
      right.file,
    ) ||
    left.line -
      right.line,
);

calls.sort(
  (left, right) =>
    left.name.localeCompare(
      right.name,
    ) ||
    left.file.localeCompare(
      right.file,
    ) ||
    left.line -
      right.line,
);

imports.sort(
  (left, right) =>
    left.file.localeCompare(
      right.file,
    ) ||
    left.line -
      right.line,
);

const output = [];

output.push(
  "RoadSafe AR · Phase 0 Step 3B Integration Audit",
);

output.push(
  `Generated: ${new Date().toISOString()}`,
);

output.push(
  `Declarations: ${declarations.length}`,
);

output.push(
  `Call sites: ${calls.length}`,
);

output.push("");

for (
  const declaration
  of declarations
) {
  output.push(
    "=".repeat(100),
  );

  output.push(
    `DECLARATION: ${declaration.name}`,
  );

  output.push(
    `FILE: ${declaration.file}`,
  );

  output.push(
    `START LINE: ${declaration.line}`,
  );

  output.push(
    "=".repeat(100),
  );

  output.push(
    declaration.text,
    "",
  );
}

output.push(
  "=".repeat(100),
);

output.push(
  "CALL SITES",
);

output.push(
  "=".repeat(100),
  "",
);

for (
  const call
  of calls
) {
  output.push(
    "-".repeat(100),
  );

  output.push(
    `CALL: ${call.name}`,
  );

  output.push(
    `FILE: ${call.file}`,
  );

  output.push(
    `OWNER: ${call.owner}`,
  );

  output.push(
    `START LINE: ${call.line}`,
  );

  output.push(
    "-".repeat(100),
  );

  output.push(
    call.text,
    "",
  );
}

output.push(
  "=".repeat(100),
);

output.push(
  "RELEVANT IMPORTS",
);

output.push(
  "=".repeat(100),
  "",
);

for (
  const entry
  of imports
) {
  output.push(
    `${entry.file}:${entry.line}`,
  );

  output.push(
    entry.text,
    "",
  );
}

fs.writeFileSync(
  outputPath,
  output.join("\n"),
  "utf8",
);

console.log(
  `Step 3B integration audit written to ${outputPath}`,
);

console.log(
  `Declarations found: ${declarations.length}`,
);

console.log(
  `Call sites found: ${calls.length}`,
);
