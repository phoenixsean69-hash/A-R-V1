import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const INSTALLER_DIR =
  path.dirname(fileURLToPath(import.meta.url));

const PAYLOAD =
  path.join(
    INSTALLER_DIR,
    "roadsafe-dev-offline-exact-payload",
  );

const EXPECTED_SHA256 = {
  "src/context/AuthContext.tsx": "3099d9f75da9f96980af356ba8dd44002730d58e17ff7f04292c9da287530672",
  "src/services/officerManagementService.ts": "4900e15f3b53b543e0ecd96590621e4d5887a7889173ece072592d560635e6e0",
  "src/services/roadSafeCaseFunctionService.ts": "8e476ca0c475b67b79abd1d971e69e5120ee6196de30d045c291fa1733fe3fd7",
  "src/services/caseCloudBridge.ts": "164152a4df25bd095849339b1faee0d9a214fce34cd39345b34e489080cdc42f"
};

const REPLACEMENTS = {
  "src/context/AuthContext.tsx":
    "AuthContext.tsx",
  "src/services/officerManagementService.ts":
    "officerManagementService.ts",
  "src/services/roadSafeCaseFunctionService.ts":
    "roadSafeCaseFunctionService.ts",
  "src/services/caseCloudBridge.ts":
    "caseCloudBridge.ts",
  "src/services/devOfflineCache.ts":
    "devOfflineCache.ts",
};

const MARKER =
  "[RoadSafe:DevOfflineCacheV1Exact]";

function abs(rel) {
  return path.join(
    ROOT,
    ...rel.split("/"),
  );
}

function fail(message, code = 1) {
  console.error("");
  console.error(
    `[RoadSafe] ${message}`,
  );
  process.exit(code);
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(file),
    )
    .digest("hex");
}

console.log("");
console.log(
  "# RoadSafe DEV Offline Cache V1 — EXACT LOCAL",
);
console.log("");

for (
  const [
    rel,
    expected,
  ]
  of Object.entries(
    EXPECTED_SHA256,
  )
) {
  const file =
    abs(rel);

  if (!fs.existsSync(file)) {
    fail(
      `Could not find ${rel}. Run this installer from the A-R-V1 repo root.`,
    );
  }

  const actual =
    sha256(file);

  if (
    actual !== expected
  ) {
    const existing =
      fs.readFileSync(
        file,
        "utf8",
      );

    if (
      existing.includes(
        MARKER,
      )
    ) {
      console.log(
        `[INFO] ${rel} already contains the exact-offline marker.`,
      );

      continue;
    }

    fail(
      `Exact-local SHA-256 check failed for ${rel}. The file changed after you created roadsafe-current-offline-files.zip, so nothing was overwritten.`,
    );
  }
}

for (
  const payloadName
  of Object.values(
    REPLACEMENTS,
  )
) {
  const payloadFile =
    path.join(
      PAYLOAD,
      payloadName,
    );

  if (
    !fs.existsSync(
      payloadFile,
    )
  ) {
    fail(
      `Installer payload is incomplete: ${payloadName} is missing. Extract the entire ZIP before running the installer.`,
    );
  }
}

const existingCache =
  abs(
    "src/services/devOfflineCache.ts",
  );

if (
  fs.existsSync(existingCache)
) {
  const current =
    fs.readFileSync(
      existingCache,
      "utf8",
    );

  if (
    !current.includes(
      MARKER,
    )
  ) {
    fail(
      "src/services/devOfflineCache.ts already exists and is not this RoadSafe DEV cache. Nothing was overwritten.",
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
    `dev-offline-cache-v1-exact-${stamp}`,
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  },
);

const originalState =
  new Map();

for (
  const rel
  of Object.keys(
    REPLACEMENTS,
  )
) {
  const file =
    abs(rel);

  if (
    fs.existsSync(file)
  ) {
    const content =
      fs.readFileSync(
        file,
      );

    originalState.set(
      rel,
      content,
    );

    const backup =
      path.join(
        backupDir,
        ...rel.split("/"),
      );

    fs.mkdirSync(
      path.dirname(
        backup,
      ),
      {
        recursive: true,
      },
    );

    fs.writeFileSync(
      backup,
      content,
    );
  } else {
    originalState.set(
      rel,
      null,
    );
  }
}

for (
  const [
    rel,
    payloadName,
  ]
  of Object.entries(
    REPLACEMENTS,
  )
) {
  const destination =
    abs(rel);

  fs.mkdirSync(
    path.dirname(
      destination,
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
    destination,
  );
}

console.log(
  "[OK] Exact-local SHA-256 checks passed.",
);
console.log(
  "[OK] Installed exact full-file replacements.",
);
console.log(
  `[OK] Backup: ${backupDir}`,
);
console.log("");
console.log(
  "Installed DEV offline behavior:",
);
console.log(
  "• cached resolved auth identity survives refresh/restart while offline",
);
console.log(
  "• no password, Appwrite token or session secret is cached",
);
console.log(
  "• real online 401 clears the cached identity",
);
console.log(
  "• managed officer lists are cached per station/team",
);
console.log(
  "• officer create/role/status/reset/remove can be simulated locally in DEV while offline",
);
console.log(
  "• last successful shared cloud-case snapshot is cached per station/team",
);
console.log(
  "• pending case saves/deletes persist across refresh/restart",
);
console.log(
  "• pending case sync retries automatically when the browser comes online",
);
console.log(
  "• existing local-first cases/reconstructions/footage remain unchanged",
);

const npmCommand =
  process.platform ===
  "win32"
    ? "npm.cmd"
    : "npm";

console.log("");
console.log(
  "Verifying production build...",
);

const result =
  spawnSync(
    npmCommand,
    [
      "run",
      "build",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      windowsHide: true,
      shell:
        process.platform ===
        "win32",
    },
  );

const output =
  [
    result.stdout ?? "",
    result.stderr ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

if (
  result.error ||
  result.status !== 0
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
    "[RoadSafe] Rolling exact DEV offline-cache replacement back automatically...",
  );

  for (
    const [
      rel,
      original,
    ]
    of originalState.entries()
  ) {
    const file =
      abs(rel);

    if (
      original === null
    ) {
      if (
        fs.existsSync(file)
      ) {
        fs.unlinkSync(file);
      }

      continue;
    }

    fs.mkdirSync(
      path.dirname(file),
      {
        recursive: true,
      },
    );

    fs.writeFileSync(
      file,
      original,
    );
  }

  console.error(
    "[RoadSafe] Rollback complete. Your pre-install local files were restored.",
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
  "Now run:",
);
console.log(
  "  npm run dev",
);
console.log("");
console.log(
  "DEV offline cache is enabled automatically by Vite development mode.",
);
