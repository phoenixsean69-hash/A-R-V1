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
    "roadsafe-ui-chunks-pass1-payload",
  );

const PAGE_REL =
  "src/pages/OfficerManagementPage.tsx";

const EXPECTED_GIT_BLOB_SHA =
  "c48719a10fdd9b2091fd7fcc1d29353df0ab07a3";

const CHUNKS = {
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

function gitBlobSha(
  content,
) {
  const bytes =
    Buffer.from(
      content,
      "utf8",
    );

  const header =
    Buffer.from(
      `blob ${bytes.length}\0`,
      "utf8",
    );

  return crypto
    .createHash("sha1")
    .update(header)
    .update(bytes)
    .digest("hex");
}

if (
  !fs.existsSync(
    abs(PAGE_REL),
  )
) {
  fail(
    `Could not find ${PAGE_REL}. Run this from the A-R-V1 repo root.`,
  );
}

const pagePayload =
  path.join(
    PAYLOAD,
    "OfficerManagementPage.tsx",
  );

if (
  !fs.existsSync(
    pagePayload,
  )
) {
  fail(
    "Installer payload is incomplete. Extract the entire ZIP before running it.",
  );
}

for (
  const payloadName
  of Object.values(CHUNKS)
) {
  if (
    !fs.existsSync(
      path.join(
        PAYLOAD,
        payloadName,
      ),
    )
  ) {
    fail(
      `Installer payload is missing ${payloadName}. Extract the entire ZIP first.`,
    );
  }
}

const originalPage =
  fs.readFileSync(
    abs(PAGE_REL),
    "utf8",
  );

if (
  originalPage.includes(
    "[RoadSafe:UIChunks:OfficerManagementV1]",
  )
) {
  console.log("");
  console.log(
    "[RoadSafe] Officer Management chunks are already installed.",
  );
  process.exit(0);
}

const actualSha =
  gitBlobSha(
    originalPage,
  );

if (
  actualSha !==
  EXPECTED_GIT_BLOB_SHA
) {
  fail(
    [
      "OfficerManagementPage.tsx differs from the repo version audited for this pass.",
      "No files were changed.",
      "",
      `Expected Git blob: ${EXPECTED_GIT_BLOB_SHA}`,
      `Current Git blob:  ${actualSha}`,
      "",
      "This safety guard prevents the component extraction from overwriting newer local UI work.",
    ].join("\n"),
  );
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
    `ui-chunks-pass1-officers-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

fs.writeFileSync(
  path.join(
    backupDir,
    "OfficerManagementPage.tsx",
  ),
  originalPage,
  "utf8",
);

const previousChunks =
  new Map();

for (
  const rel
  of Object.keys(CHUNKS)
) {
  if (
    fs.existsSync(
      abs(rel),
    )
  ) {
    previousChunks.set(
      rel,
      fs.readFileSync(
        abs(rel),
        "utf8",
      ),
    );
  }
}

fs.copyFileSync(
  pagePayload,
  abs(PAGE_REL),
);

for (
  const [
    rel,
    payloadName,
  ]
  of Object.entries(CHUNKS)
) {
  fs.mkdirSync(
    path.dirname(
      abs(rel),
    ),
    {
      recursive: true,
    },
  );

  fs.copyFileSync(
    path.join(
      PAYLOAD,
      payloadName,
    ),
    abs(rel),
  );
}

console.log("");
console.log(
  "RoadSafe UI Chunks — Pass 1: Officer Management",
);
console.log(
  "================================================",
);
console.log(
  "[OK] State/data/service logic remains in OfficerManagementPage.",
);
console.log(
  "[OK] Header + station metrics moved to a component chunk.",
);
console.log(
  "[OK] Create-officer form moved to a component chunk.",
);
console.log(
  "[OK] Temporary-credential panel moved to a component chunk.",
);
console.log(
  "[OK] Error/status banner moved to a component chunk.",
);
console.log(
  "[OK] Search/filter/officer directory moved to a component chunk.",
);
console.log(
  "[OK] Original Tailwind/UI class strings were preserved.",
);
console.log(
  "[OK] No routes, services, auth, offline cache or data models changed.",
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
    "[RoadSafe] Build failed. Rolling the UI refactor back...",
  );

  if (output) {
    console.error("");
    console.error(output);
  }

  fs.writeFileSync(
    abs(PAGE_REL),
    originalPage,
    "utf8",
  );

  for (
    const rel
    of Object.keys(CHUNKS)
  ) {
    const previous =
      previousChunks.get(rel);

    if (
      typeof previous ===
      "string"
    ) {
      fs.writeFileSync(
        abs(rel),
        previous,
        "utf8",
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

  console.error("");
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
