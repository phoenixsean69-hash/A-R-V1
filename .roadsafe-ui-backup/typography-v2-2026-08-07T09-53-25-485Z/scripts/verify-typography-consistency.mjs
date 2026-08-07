import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const mainPath = path.join(
  root,
  "src/main.tsx",
);

const cssPath = path.join(
  root,
  "src/styles/typographyConsistency.css",
);

if (!fs.existsSync(cssPath)) {
  failures.push(
    "typographyConsistency.css is missing.",
  );
}

if (fs.existsSync(mainPath)) {
  const source = fs.readFileSync(
    mainPath,
    "utf8",
  );

  const cssImports =
    source
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

if (fs.existsSync(cssPath)) {
  const source = fs.readFileSync(
    cssPath,
    "utf8",
  );

  for (const token of [
    "--roadsafe-type-micro: 11px",
    "--roadsafe-type-meta: 12px",
    "--roadsafe-type-control: 13px",
    "--roadsafe-type-body: 14px",
    "--roadsafe-type-panel: 15px",
    "--roadsafe-type-page: 20px",
  ]) {
    if (!source.includes(token)) {
      failures.push(
        "Missing canonical typography token: " +
          token,
      );
    }
  }
}

console.log(
  "Typography audit: canonical readable scale.",
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
  "PASS: Global typography consistency layer is installed last.",
);
