import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const HERE = path.dirname(
  fileURLToPath(import.meta.url),
);

const TARGET = path.join(
  ROOT,
  "src",
  "features",
  "forensicReconstruction",
  "ForensicDatumPicker.tsx",
);

const PAYLOAD = path.join(
  HERE,
  "payload",
  "ForensicDatumPicker.tsx",
);

function fail(message) {
  console.error(
    `\n[RoadSafe] ${message}`,
  );
  process.exit(1);
}

if (
  !fs.existsSync(
    path.join(ROOT, "package.json"),
  )
) {
  fail(
    "Run this installer from the A-R-V1 project root.",
  );
}

if (!fs.existsSync(TARGET)) {
  fail(
    "ForensicDatumPicker.tsx was not found. Install Datum Picker V1 first.",
  );
}

if (!fs.existsSync(PAYLOAD)) {
  fail(
    "V1.2 replacement payload is missing.",
  );
}

const stamp =
  new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const backupDir = path.join(
  ROOT,
  ".roadsafe-ui-backup",
  `forensic-datum-picker-v1-2-${stamp}`,
);

fs.mkdirSync(
  backupDir,
  { recursive: true },
);

fs.copyFileSync(
  TARGET,
  path.join(
    backupDir,
    "ForensicDatumPicker.tsx",
  ),
);

fs.copyFileSync(
  PAYLOAD,
  TARGET,
);

console.log(
  "\n[RoadSafe] Forensic Datum Picker V1.2 installed.",
);
console.log(
  "[RoadSafe] Picker -> document.body portal / true fullscreen.",
);
console.log(
  "[RoadSafe] Hybrid map -> same Esri source stack as working RoadSafe map.",
);
console.log(
  "[RoadSafe] Imagery max zoom -> 17, matching RoadSafe map limits.",
);
console.log(
  "[RoadSafe] Map resize -> ResizeObserver + post-load resize.",
);
console.log(
  "[RoadSafe] Frozen forensic core -> fitted after map load.",
);
console.log(
  "[RoadSafe] Map source errors -> visible warning instead of silent black panel.",
);
console.log(
  `[RoadSafe] Backup: ${path.relative(
    ROOT,
    backupDir,
  )}`,
);
console.log("\nRun:");
console.log("  npm run build");
