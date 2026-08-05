import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

const reportPath = path.join(
  root,
  "phase0-step3b2b-visual-callsite-context.txt",
);

const files = [
  "src/components/fieldPlacement/FieldSceneLivePreview.tsx",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/ar/ARSceneFactory.ts",
  "src/components/reconstruction/ForensicScenePreview.tsx",
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
  "src/utils/reconstructionCanvasRenderer.ts",
  "src/utils/reconstructionPlaybackDom.ts",
];

function read(relativePath) {
  const absolutePath = path.join(
    root,
    relativePath,
  );

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      `Required source file is missing: ${relativePath}`,
    );
  }

  return fs
    .readFileSync(
      absolutePath,
      "utf8",
    )
    .replace(/\r\n/g, "\n");
}

function scriptKind(relativePath) {
  return relativePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
}

function lineNumber(
  sourceFile,
  position,
) {
  return (
    sourceFile
      .getLineAndCharacterOfPosition(
        position,
      ).line + 1
  );
}

function nodeText(
  sourceFile,
  node,
) {
  return sourceFile.text.slice(
    node.getStart(sourceFile),
    node.getEnd(),
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

function getFunctionName(node) {
  if (
    (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) &&
    node.name &&
    ts.isIdentifier(node.name)
  ) {
    return node.name.text;
  }

  if (
    (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) &&
    node.parent &&
    ts.isVariableDeclaration(
      node.parent,
    ) &&
    ts.isIdentifier(
      node.parent.name,
    )
  ) {
    return node.parent.name.text;
  }

  if (
    (
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) &&
    node.parent &&
    ts.isCallExpression(
      node.parent,
    )
  ) {
    return "<callback>";
  }

  return "<anonymous>";
}

function nearestFunctionLike(node) {
  let current = node.parent;

  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current;
    }

    current = current.parent;
  }

  return null;
}

function ancestorFunctions(node) {
  const result = [];
  let current = node.parent;

  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      result.push({
        name: getFunctionName(current),
        node: current,
      });
    }

    current = current.parent;
  }

  return result;
}

function contextBlock(
  relativePath,
  sourceText,
  startLine,
  endLine,
) {
  const lines = sourceText.split("\n");

  const start = Math.max(
    1,
    startLine,
  );

  const end = Math.min(
    lines.length,
    endLine,
  );

  const output = [];

  for (
    let index = start;
    index <= end;
    index += 1
  ) {
    output.push(
      `${String(index).padStart(5, " ")} | ${lines[index - 1]}`,
    );
  }

  return [
    `FILE: ${relativePath}`,
    `LINES: ${start}-${end}`,
    "```text",
    output.join("\n"),
    "```",
    "",
  ].join("\n");
}

function collectRelevantDeclarations(
  sourceFile,
  functionNode,
  callPosition,
) {
  const matches = [];

  const relevantPattern =
    /reconstruction|dimension|width|height|world|scene|scale|metres/i;

  function visit(node) {
    if (
      node.getStart(sourceFile) >=
      callPosition
    ) {
      return;
    }

    if (
      ts.isVariableStatement(node)
    ) {
      const text = nodeText(
        sourceFile,
        node,
      );

      if (
        relevantPattern.test(text)
      ) {
        matches.push({
          line: lineNumber(
            sourceFile,
            node.getStart(sourceFile),
          ),
          text,
        });
      }
    }

    ts.forEachChild(
      node,
      visit,
    );
  }

  visit(functionNode);

  return matches.slice(-15);
}

const report = [
  "=== PHASE 0 STEP 3B2B · VISUAL CALL-SITE CONTEXT ===",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Files scanned: ${files.length}`,
  "",
];

let totalCalls = 0;

for (const relativePath of files) {
  const sourceText = read(
    relativePath,
  );

  const sourceFile =
    ts.createSourceFile(
      relativePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(relativePath),
    );

  const imports = [];
  const calls = [];

  function visit(node) {
    if (
      ts.isImportDeclaration(node)
    ) {
      const text = nodeText(
        sourceFile,
        node,
      );

      if (
        text.includes(
          "reconstructionGeometry",
        ) ||
        text.includes(
          "reconstructionWorldScale",
        )
      ) {
        imports.push({
          line: lineNumber(
            sourceFile,
            node.getStart(sourceFile),
          ),
          text,
        });
      }
    }

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

  totalCalls += calls.length;

  report.push(
    "============================================================",
    `FILE: ${relativePath}`,
    `CALL COUNT: ${calls.length}`,
    "",
    "=== RELEVANT IMPORTS ===",
    "",
  );

  for (const item of imports) {
    report.push(
      `LINE: ${item.line}`,
      "```ts",
      item.text,
      "```",
      "",
    );
  }

  for (
    let index = 0;
    index < calls.length;
    index += 1
  ) {
    const call = calls[index];

    const callStartLine =
      lineNumber(
        sourceFile,
        call.getStart(sourceFile),
      );

    const callEndLine =
      lineNumber(
        sourceFile,
        call.getEnd(),
      );

    const enclosingFunction =
      nearestFunctionLike(call);

    const ancestors =
      ancestorFunctions(call);

    report.push(
      `=== CALL ${index + 1} ===`,
      "",
      `CALL LINES: ${callStartLine}-${callEndLine}`,
      `ARGUMENT COUNT: ${call.arguments.length}`,
      "```ts",
      nodeText(
        sourceFile,
        call,
      ),
      "```",
      "",
      "ANCESTOR FUNCTIONS:",
      ...ancestors.map(
        (ancestor) => {
          const start =
            lineNumber(
              sourceFile,
              ancestor.node.getStart(sourceFile),
            );

          const end =
            lineNumber(
              sourceFile,
              ancestor.node.getEnd(),
            );

          return `- ${ancestor.name} · lines ${start}-${end}`;
        },
      ),
      "",
    );

    report.push(
      contextBlock(
        relativePath,
        sourceText,
        callStartLine - 35,
        callEndLine + 35,
      ),
    );

    if (enclosingFunction) {
      const functionStartLine =
        lineNumber(
          sourceFile,
          enclosingFunction.getStart(
            sourceFile,
          ),
        );

      const functionEndLine =
        lineNumber(
          sourceFile,
          enclosingFunction.getEnd(),
        );

      report.push(
        "=== ENCLOSING FUNCTION OPENING ===",
        "",
        contextBlock(
          relativePath,
          sourceText,
          functionStartLine,
          Math.min(
            functionStartLine + 55,
            functionEndLine,
          ),
        ),
      );

      const relevantDeclarations =
        collectRelevantDeclarations(
          sourceFile,
          enclosingFunction,
          call.getStart(sourceFile),
        );

      report.push(
        "=== RELEVANT EARLIER DECLARATIONS IN ENCLOSING FUNCTION ===",
        "",
      );

      if (
        relevantDeclarations.length === 0
      ) {
        report.push(
          "(none detected)",
          "",
        );
      } else {
        for (
          const declaration
          of relevantDeclarations
        ) {
          report.push(
            `LINE: ${declaration.line}`,
            "```ts",
            declaration.text,
            "```",
            "",
          );
        }
      }
    }
  }
}

report.push(
  "=== EXTRACTION SUMMARY ===",
  "",
  `Files scanned: ${files.length}`,
  `Actual visual getParticipantStateAtTime calls: ${totalCalls}`,
  "",
);

fs.writeFileSync(
  reportPath,
  report.join("\n"),
  "utf8",
);

console.log(
  `Files scanned: ${files.length}`,
);

console.log(
  `Visual state calls found: ${totalCalls}`,
);

console.log(
  `Report written: ${path.relative(root, reportPath)}`,
);

if (totalCalls !== 9) {
  throw new Error(
    `Expected exactly 9 remaining visual calls, found ${totalCalls}.`,
  );
}
