import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const cssPath = path.join(
  root,
  "src/styles/typographyConsistency.css",
);

const mainPath = path.join(
  root,
  "src/main.tsx",
);

if (!fs.existsSync(cssPath)) {
  failures.push(
    "typographyConsistency.css is missing.",
  );
} else {
  const css = fs.readFileSync(
    cssPath,
    "utf8",
  );

  for (const required of [
    ".roadsafe-workstation",
    "--rs-type-micro: 12px",
    "--rs-type-meta: 13px",
    "--rs-type-control: 14px",
    "--rs-type-body: 14px",
    "--rs-type-panel: 16px",
    ".text-slate-600",
  ]) {
    if (!css.includes(required)) {
      failures.push(
        "Missing typography V2 rule: " +
          required,
      );
    }
  }
}

if (fs.existsSync(mainPath)) {
  const source = fs.readFileSync(
    mainPath,
    "utf8",
  );

  const cssImports = source
    .split(String.fromCharCode(10))
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("import ") &&
        line.includes(".css"),
    );

  const expected =
    'import "./styles/typographyConsistency.css";';

  if (
    cssImports.filter(
      (line) => line === expected,
    ).length !== 1
  ) {
    failures.push(
      "typographyConsistency.css must be imported exactly once.",
    );
  }

  if (
    cssImports.at(-1) !== expected
  ) {
    failures.push(
      "typographyConsistency.css must be the final CSS import.",
    );
  }
}

console.log(
  "Typography V2 audit: actual RoadSafe workstation scope.",
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(
      "FAIL: " + failure,
    );
  }

  process.exit(1);
}

console.log(
  "PASS: readable typography is scoped to .roadsafe-workstation and imported last.",
);
