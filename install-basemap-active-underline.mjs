import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const relativePath =
  "src/components/reconstruction/AccidentReconstructionEditor.tsx";
const targetPath = path.join(root, relativePath);

if (!fs.existsSync(packagePath) || !fs.existsSync(targetPath)) {
  console.error(
    "Run this script from C:\\Users\\nooklyweb\\Desktop\\A-R-V1.",
  );
  process.exit(1);
}

const packageJson = JSON.parse(
  fs.readFileSync(packagePath, "utf8"),
);

if (packageJson.name !== "roadsafe-ar") {
  console.error(
    `Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`,
  );
  process.exit(1);
}

let source = fs.readFileSync(targetPath, "utf8");

const oldClass =
  'className={`rounded px-2.5 py-1.5 text-[9px] font-bold ${basemapMode === mode ? "bg-[#303030] text-white" : "text-slate-500 hover:bg-[#303030] hover:text-slate-200"}`}';

const newClass =
  'className={`relative rounded-sm border-b-2 px-3 py-1.5 text-[9px] font-bold transition-colors ${basemapMode === mode ? "border-[#E8872D] bg-[#383838] text-white" : "border-transparent bg-[#292929] text-[#B8B8B8] hover:bg-[#383838] hover:text-white"}`}';

if (!source.includes(oldClass)) {
  if (source.includes('border-[#E8872D]') && source.includes('basemapMode === mode')) {
    console.log(
      "Basemap active underline is already installed.",
    );
    process.exit(0);
  }

  console.error(
    "Could not locate the current Diagram / Street / Satellite tab styling.",
  );
  process.exit(1);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupRoot = path.join(
  root,
  ".roadsafe-ui-backup",
  timestamp,
);

const backupPath = path.join(
  backupRoot,
  relativePath,
);

fs.mkdirSync(
  path.dirname(backupPath),
  { recursive: true },
);

fs.copyFileSync(
  targetPath,
  backupPath,
);

source = source.replace(
  oldClass,
  newClass,
);

/*
 * Add aria-pressed to expose active state semantically as well.
 */
const clickLine =
  'onClick={() => setBasemapMode(mode)}';

if (
  source.includes(clickLine) &&
  !source.includes(
    'aria-pressed={basemapMode === mode}',
  )
) {
  source = source.replace(
    clickLine,
    `${clickLine}
                      aria-pressed={basemapMode === mode}`,
  );
}

fs.writeFileSync(
  targetPath,
  source,
  "utf8",
);

console.log(
  "CHANGED src/components/reconstruction/AccidentReconstructionEditor.tsx",
);
console.log(
  "Active basemap underline: #E8872D",
);

try {
  execSync(
    "npm run build",
    {
      cwd: root,
      stdio: "inherit",
      shell: true,
    },
  );
} catch {
  fs.copyFileSync(
    backupPath,
    targetPath,
  );

  console.error(
    "Build failed. The original editor file was restored automatically.",
  );

  process.exit(1);
}

const statePath = path.join(
  root,
  ".roadsafe-ui-backup",
  "last-basemap-active-underline.json",
);

fs.writeFileSync(
  statePath,
  JSON.stringify(
    {
      backupPath,
      relativePath,
      installedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`
Installed successfully.

Active tab:
- gray Blender surface
- white text
- 2px #E8872D bottom line

Inactive tabs:
- #292929 surface
- neutral gray text
- transparent bottom border

Start:
  npm run dev

Rollback:
  node revoke-basemap-active-underline.mjs
`);
