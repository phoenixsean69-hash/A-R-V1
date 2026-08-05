import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

const migrations = [
  {
    file:
      "src/components/fieldPlacement/FieldSceneLivePreview.tsx",

    expectedCalls:
      1,

    thirdArgument:
      "getReconstructionWorldDimensions(reconstruction)",

    requiredImport: {
      module:
        "../../utils/reconstructionGeometry",

      text:
        'import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";',
    },
  },
  {
    file:
      "src/components/reconstruction/AccidentReconstructionEditor.tsx",

    expectedCalls:
      3,

    thirdArgument:
      "getReconstructionWorldDimensions(reconstruction)",
  },
  {
    file:
      "src/components/reconstruction/ar/ARSceneFactory.ts",

    expectedCalls:
      1,

    thirdArgument:
      "{ widthMetres: width, heightMetres: height }",
  },
  {
    file:
      "src/components/reconstruction/ForensicScenePreview.tsx",

    expectedCalls:
      1,

    thirdArgument:
      "getReconstructionWorldDimensions(reconstruction)",

    requiredImport: {
      module:
        "../../utils/reconstructionGeometry",

      text:
        'import { getReconstructionWorldDimensions } from "../../utils/reconstructionWorldScale";',
    },
  },
  {
    file:
      "src/components/reconstruction/Reconstruction3DViewer.tsx",

    expectedCalls:
      1,

    thirdArgument:
      "{ widthMetres: width, heightMetres: height }",
  },
  {
    file:
      "src/utils/reconstructionCanvasRenderer.ts",

    expectedCalls:
      1,

    thirdArgument:
      "{ widthMetres: Math.max(0.001, width / Math.max(0.001, scale.pxPerMetreX)), heightMetres: Math.max(0.001, height / Math.max(0.001, scale.pxPerMetreY)) }",
  },
  {
    file:
      "src/utils/reconstructionPlaybackDom.ts",

    expectedCalls:
      1,

    thirdArgument:
      "getReconstructionWorldDimensions(reconstruction)",

    requiredImport: {
      module:
        "./reconstructionGeometry",

      text:
        'import { getReconstructionWorldDimensions } from "./reconstructionWorldScale";',
    },
  },
];

const packagePath =
  "package.json";

function absolute(relativePath) {
  return path.join(
    root,
    relativePath,
  );
}

function read(relativePath) {
  const target =
    absolute(relativePath);

  if (!fs.existsSync(target)) {
    throw new Error(
      `Required file is missing: ${relativePath}`,
    );
  }

  return fs.readFileSync(
    target,
    "utf8",
  );
}

function write(
  relativePath,
  content,
) {
  fs.writeFileSync(
    absolute(relativePath),
    content,
    "utf8",
  );
}

function scriptKind(relativePath) {
  return relativePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
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
    scriptKind(relativePath),
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

function detectEol(source) {
  return source.includes("\r\n")
    ? "\r\n"
    : "\n";
}

function indentMultiline(
  text,
  indentation,
  eol,
) {
  return text
    .trim()
    .split(/\r?\n/)
    .map(
      (line, index) =>
        index === 0
          ? line
          : `${indentation}${line.trim()}`,
    )
    .join(eol);
}

function insertRequiredImport(
  relativePath,
  source,
  requiredImport,
) {
  if (
    !requiredImport ||
    source.includes(
      requiredImport.text,
    )
  ) {
    return source;
  }

  const sourceFile =
    parse(
      relativePath,
      source,
    );

  const imports =
    sourceFile.statements.filter(
      ts.isImportDeclaration,
    );

  const anchor =
    imports.find(
      (declaration) =>
        ts.isStringLiteral(
          declaration.moduleSpecifier,
        ) &&
        declaration.moduleSpecifier.text ===
          requiredImport.module,
    );

  if (!anchor) {
    throw new Error(
      `Could not locate import anchor ${requiredImport.module} in ${relativePath}.`,
    );
  }

  const eol =
    detectEol(source);

  return (
    source.slice(
      0,
      anchor.getEnd(),
    ) +
    eol +
    requiredImport.text +
    source.slice(
      anchor.getEnd(),
    )
  );
}

function migrateCalls(
  relativePath,
  source,
  expectedCalls,
  thirdArgument,
) {
  const sourceFile =
    parse(
      relativePath,
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

  if (
    calls.length !==
    expectedCalls
  ) {
    throw new Error(
      `Expected ${expectedCalls} playback calls in ${relativePath}, found ${calls.length}.`,
    );
  }

  for (const call of calls) {
    if (call.arguments.length !== 2) {
      throw new Error(
        `Expected an unmigrated two-argument call in ${relativePath}, found ${call.arguments.length} arguments.`,
      );
    }
  }

  const eol =
    detectEol(source);

  const replacements =
    calls.map(
      (call) => {
        const start =
          call.getStart(sourceFile);

        const end =
          call.getEnd();

        const lineInfo =
          sourceFile
            .getLineAndCharacterOfPosition(
              start,
            );

        const callIndent =
          " ".repeat(
            lineInfo.character,
          );

        const argumentIndent =
          `${callIndent}  `;

        const firstArgument =
          indentMultiline(
            call.arguments[0].getText(
              sourceFile,
            ),
            argumentIndent,
            eol,
          );

        const secondArgument =
          indentMultiline(
            call.arguments[1].getText(
              sourceFile,
            ),
            argumentIndent,
            eol,
          );

        const replacement = [
          "getParticipantStateAtTime(",
          `${argumentIndent}${firstArgument},`,
          `${argumentIndent}${secondArgument},`,
          `${argumentIndent}${thirdArgument},`,
          `${callIndent})`,
        ].join(eol);

        return {
          start,
          end,
          replacement,
        };
      },
    )
    .sort(
      (left, right) =>
        right.start -
        left.start,
    );

  let migrated =
    source;

  for (
    const replacement
    of replacements
  ) {
    migrated =
      migrated.slice(
        0,
        replacement.start,
      ) +
      replacement.replacement +
      migrated.slice(
        replacement.end,
      );
  }

  return migrated;
}

for (
  const migration
  of migrations
) {
  let source =
    read(migration.file);

  source =
    insertRequiredImport(
      migration.file,
      source,
      migration.requiredImport,
    );

  source =
    migrateCalls(
      migration.file,
      source,
      migration.expectedCalls,
      migration.thirdArgument,
    );

  write(
    migration.file,
    source,
  );

  console.log(
    `migrated ${migration.file} (${migration.expectedCalls} call${migration.expectedCalls === 1 ? "" : "s"})`,
  );
}

const packageJson =
  JSON.parse(
    read(packagePath),
  );

packageJson.scripts ??= {};

packageJson.scripts[
  "playback-views:verify"
] =
  "node scripts/verify-phase0-step3b2b-visual-playback.mjs && tsc -p tsconfig.phase0.json";

write(
  packagePath,
  `${JSON.stringify(
    packageJson,
    null,
    2,
  )}\n`,
);

console.log(
  "Phase 0 Step 3B2B visual playback migration applied.",
);
