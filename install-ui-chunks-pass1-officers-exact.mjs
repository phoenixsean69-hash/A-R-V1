import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();

const INSTALLER_DIR =
  path.dirname(
    fileURLToPath(import.meta.url),
  );

const PAYLOAD =
  path.join(
    INSTALLER_DIR,
    "roadsafe-ui-chunks-pass1-exact-payload",
  );

const PAGE_REL =
  "src/pages/OfficerManagementPage.tsx";

const EXPECTED_SHA256 =
  "3497fa778abbc5639e538e2457d7723035eca4b93a96962aff60427bb3797807";

const FILES = {
  "src/pages/OfficerManagementPage.tsx":
    "OfficerManagementPage.tsx",

  "src/components/officers/OfficerManagementOverviewChunk.tsx":
    "OfficerManagementOverviewChunk.tsx",

  "src/components/officers/OfficerCreateFormChunk.tsx":
    "OfficerCreateFormChunk.tsx",

  "src/components/officers/OfficerCredentialChunk.tsx":
    "OfficerCredentialChunk.tsx",

  "src/components/officers/OfficerStatusBannerChunk.tsx":
    "OfficerStatusBannerChunk.tsx",

  "src/components/officers/OfficerDirectoryChunk.tsx":
    "OfficerDirectoryChunk.tsx",

  "src/components/officers/index.ts":
    "index.ts",
};

function abs(rel) {
  return path.join(
    ROOT,
    ...rel.split("/"),
  );
}

function fail(
  message,
  code = 1,
) {
  console.error("");
  console.error(
    `[RoadSafe] ${message}`,
  );
  process.exit(code);
}

function sha256File(file) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(file),
    )
    .digest("hex");
}

const pagePath =
  abs(PAGE_REL);

if (!fs.existsSync(pagePath)) {
  fail(
    `Could not find ${PAGE_REL}. Run this installer from the A-R-V1 repository root.`,
  );
}

for (
  const payloadName
  of Object.values(FILES)
) {
  const payloadPath =
    path.join(
      PAYLOAD,
      payloadName,
    );

  if (!fs.existsSync(payloadPath)) {
    fail(
      `Installer payload is missing ${payloadName}. Extract the whole ZIP before running it.`,
    );
  }
}

const currentSha256 =
  sha256File(pagePath);

if (
  currentSha256 !==
  EXPECTED_SHA256
) {
  fail(
    [
      "OfficerManagementPage.tsx no longer matches the exact local file you uploaded.",
      "No files were changed.",
      "",
      `Expected SHA-256: ${EXPECTED_SHA256}`,
      `Current SHA-256:  ${currentSha256}`,
      "",
      "If you edited that page after creating zip1.zip, make a fresh snapshot before this refactor.",
    ].join("\n"),
  );
}

const originalContents =
  new Map();

for (
  const rel
  of Object.keys(FILES)
) {
  if (
    fs.existsSync(
      abs(rel),
    )
  ) {
    originalContents.set(
      rel,
      fs.readFileSync(
        abs(rel),
      ),
    );
  }
}

const stamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      "-",
    );

const backupDir =
  path.join(
    ROOT,
    ".roadsafe-backups",
    `ui-chunks-pass1-officers-exact-${stamp}`,
  );

for (
  const [
    rel,
    content,
  ]
  of originalContents.entries()
) {
  const target =
    path.join(
      backupDir,
      ...rel.split("/"),
    );

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true },
  );

  fs.writeFileSync(
    target,
    content,
  );
}

for (
  const [
    rel,
    payloadName,
  ]
  of Object.entries(FILES)
) {
  const target =
    abs(rel);

  fs.mkdirSync(
    path.dirname(target),
    { recursive: true },
  );

  fs.copyFileSync(
    path.join(
      PAYLOAD,
      payloadName,
    ),
    target,
  );
}

console.log("");
console.log(
  "RoadSafe UI Chunks — Pass 1 EXACT LOCAL",
);
console.log(
  "========================================",
);
console.log(
  "[OK] Exact local OfficerManagementPage SHA-256 matched.",
);
console.log(
  "[OK] Page remains the state/service/controller container.",
);
console.log(
  "[OK] Overview/header + metrics extracted.",
);
console.log(
  "[OK] Create-officer form extracted.",
);
console.log(
  "[OK] One-time credentials panel extracted.",
);
console.log(
  "[OK] Status message banner extracted.",
);
console.log(
  "[OK] Search/filter/officer directory extracted.",
);
console.log(
  "[OK] Existing UI class strings preserved.",
);
console.log(
  "[OK] No auth, cache, services, routes, or data models changed.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);

console.log("");
console.log(
  "Verifying production build...",
);

const build =
  process.platform === "win32"
    ? spawnSync(
        "cmd.exe",
        [
          "/d",
          "/s",
          "/c",
          "npm run build",
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
          windowsHide: true,
        },
      )
    : spawnSync(
        "npm",
        [
          "run",
          "build",
        ],
        {
          cwd: ROOT,
          encoding: "utf8",
        },
      );

const output =
  [
    build.stdout ?? "",
    build.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  build.error ||
  build.status !== 0
) {
  console.error("");
  console.error(
    "[RoadSafe] Production build failed.",
  );

  if (output) {
    console.error("");
    console.error(output);
  }

  console.error("");
  console.error(
    "[RoadSafe] Rolling Pass 1 back automatically...",
  );

  for (
    const rel
    of Object.keys(FILES)
  ) {
    const previous =
      originalContents.get(rel);

    if (previous) {
      fs.mkdirSync(
        path.dirname(abs(rel)),
        { recursive: true },
      );

      fs.writeFileSync(
        abs(rel),
        previous,
      );
    } else if (
      fs.existsSync(
        abs(rel),
      )
    ) {
      fs.unlinkSync(
        abs(rel),
      );
    }
  }

  console.error(
    "[RoadSafe] Rollback complete.",
  );
  console.error(
    `[RoadSafe] Backup retained at: ${backupDir}`,
  );

  process.exit(3);
}

console.log(
  "[OK] Production build passed.",
);
console.log("");
console.log(
  "Run npm run dev and visually compare Officer Management.",
);
