import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const maxAllowedZoom = 17;

const files = [
  "src/components/map/AccidentMap.tsx",
  "src/components/cases/RoadLocationMap.tsx",
  "src/components/fieldPlacement/FieldPlacementMap.tsx",
  "src/components/cases/GoogleRoadLocationMap.tsx",
  "src/components/fieldPlacement/GoogleFieldPlacementMap.tsx",
  "src/components/reconstruction/ReconstructionBasemap.tsx",
  "src/components/reconstruction/GoogleReconstructionBasemap.tsx"
];

const failures = [];
const inspected = [];

function numericCalls(source, callName) {
  const values = [];
  let cursor = 0;
  const needle = callName + "(";

  while (cursor < source.length) {
    const start = source.indexOf(
      needle,
      cursor,
    );

    if (start < 0) {
      break;
    }

    const open =
      start + needle.length;

    const close =
      source.indexOf(")", open);

    if (close < 0) {
      break;
    }

    const argument =
      source
        .slice(open, close)
        .trim();

    if (
      argument.length > 0 &&
      /^[0-9.]+$/.test(argument)
    ) {
      const value = Number(argument);

      if (Number.isFinite(value)) {
        values.push(value);
      }
    }

    cursor = close + 1;
  }

  return values;
}

function numericPropertyValues(
  source,
  propertyName,
) {
  const values = [];

  for (const line of source.split(
    String.fromCharCode(10),
  )) {
    const trimmed = line.trim();

    if (
      !trimmed.startsWith(
        propertyName + ":",
      )
    ) {
      continue;
    }

    const valueText =
      trimmed
        .slice(
          propertyName.length + 1,
        )
        .split(",")[0]
        .trim();

    if (
      /^[0-9.]+$/.test(valueText)
    ) {
      const value = Number(valueText);

      if (Number.isFinite(value)) {
        values.push(value);
      }
    }
  }

  return values;
}

for (const relativePath of files) {
  const absolutePath = path.join(
    root,
    relativePath,
  );

  if (!fs.existsSync(absolutePath)) {
    continue;
  }

  const source = fs.readFileSync(
    absolutePath,
    "utf8",
  );

  inspected.push(relativePath);

  for (
    const propertyName of [
      "maxZoom",
      "maxzoom",
    ]
  ) {
    for (
      const value of numericPropertyValues(
        source,
        propertyName,
      )
    ) {
      if (value > maxAllowedZoom) {
        failures.push(
          relativePath +
            ": " +
            propertyName +
            " " +
            value +
            " exceeds " +
            maxAllowedZoom,
        );
      }
    }
  }

  for (
    const value of numericCalls(
      source,
      "setMaxZoom",
    )
  ) {
    if (value > maxAllowedZoom) {
      failures.push(
        relativePath +
          ": setMaxZoom(" +
          value +
          ") exceeds " +
          maxAllowedZoom,
      );
    }
  }

  for (
    const value of numericCalls(
      source,
      "setZoom",
    )
  ) {
    if (value > maxAllowedZoom) {
      failures.push(
        relativePath +
          ": setZoom(" +
          value +
          ") exceeds safe map policy",
      );
    }
  }
}

const cssPath = path.join(
  root,
  "src/styles/mapWorkstation.css",
);

if (!fs.existsSync(cssPath)) {
  failures.push(
    "src/styles/mapWorkstation.css is missing.",
  );
}

const mainPath = path.join(
  root,
  "src/main.tsx",
);

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
    'import "./styles/mapWorkstation.css";';

  const occurrences =
    cssImports.filter(
      (line) => line === expected,
    ).length;

  if (occurrences !== 1) {
    failures.push(
      "mapWorkstation.css must be imported exactly once.",
    );
  }

  if (
    cssImports.length === 0 ||
    cssImports[cssImports.length - 1] !==
      expected
  ) {
    failures.push(
      "mapWorkstation.css must be the final CSS import.",
    );
  }
}

console.log(
  "Map display audit: " +
    inspected.length +
    " map component(s), max zoom " +
    maxAllowedZoom +
    ".",
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
  "PASS: Map zoom ceilings and dark-map stylesheet are installed.",
);
