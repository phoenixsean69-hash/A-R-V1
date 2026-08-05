import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const patcherPath = path.join(
  repoRoot,
  "scripts/apply-phase0-step3b2a-canonical-metric-core.mjs",
);

if (!fs.existsSync(patcherPath)) {
  throw new Error(
    `Step 3B2A patcher was not found: ${patcherPath}`,
  );
}

let source = fs.readFileSync(
  patcherPath,
  "utf8",
);

const marker =
  "[RoadSafe:Step3B2AWindowsLineEndingNormalisationV1]";

if (!source.includes(marker)) {
  const readReturnPattern =
    /return fs\.readFileSync\(\s*target,\s*"utf8",\s*\);/;

  if (!readReturnPattern.test(source)) {
    throw new Error(
      "Could not locate the patcher's read() return statement.",
    );
  }

  source = source.replace(
    readReturnPattern,
`/*
   * [RoadSafe:Step3B2AWindowsLineEndingNormalisationV1]
   *
   * Git may check files out using CRLF on Windows. Normalise source text
   * before exact structural replacements so the patch remains independent
   * of the workstation's line-ending configuration.
   */
  return fs
    .readFileSync(
      target,
      "utf8",
    )
    .replace(/\\r\\n/g, "\\n");`,
  );

  fs.writeFileSync(
    patcherPath,
    source,
    "utf8",
  );

  console.log(
    "Step 3B2A patcher now normalises Windows CRLF source.",
  );
} else {
  console.log(
    "Step 3B2A line-ending repair was already installed.",
  );
}
