import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const rawRoot = path.join(repoRoot, "model-intake", "raw");
const extractedRoot = path.join(repoRoot, "model-intake", "extracted");

const archives = [
  ["blender-human-base-meshes", "human-base-meshes-bundle-v1.0.0.zip"],
  ["kenney-car-kit", "kenney_car-kit_3.1.zip"],
  ["rgsdev-vehicle-pack", "free_low_poly_vehicles_pack_by_rgsdev.zip"],
  ["byzmod-vehicle-pack", "pack_car_2023_14.zip"],
  ["byzmod-original-car-pack", "carro_3d_low_poly_high_poly.zip"],
  ["quaternius-public-transport", "Public_Transport_Quaternius.zip"],
  ["quaternius-animated-human", "Animated_Human_Quaternius.zip"],
];

function psLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function extract(zipPath, destination) {
  fs.mkdirSync(destination, { recursive: true });

  try {
    execFileSync(
      "tar.exe",
      ["-xf", zipPath, "-C", destination],
      { cwd: repoRoot, stdio: "inherit", windowsHide: true },
    );
    return;
  } catch {
    const command =
      `Expand-Archive -LiteralPath ${psLiteral(zipPath)} ` +
      `-DestinationPath ${psLiteral(destination)} -Force`;

    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
      { cwd: repoRoot, stdio: "inherit", windowsHide: true },
    );
  }
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

let failures = 0;

console.log("");
console.log("RoadSafe AR — repair existing model archives");
console.log("");

for (const [sourceId, fileName] of archives) {
  const zipPath = path.join(rawRoot, fileName);

  if (!fs.existsSync(zipPath)) {
    console.warn(`MISSING ${fileName}`);
    failures += 1;
    continue;
  }

  const destination = path.join(extractedRoot, sourceId);

  try {
    console.log(`EXTRACT ${fileName}`);
    extract(zipPath, destination);

    const count = walk(destination).length;
    if (count === 0) {
      throw new Error("No files were extracted.");
    }

    console.log(`OK ${fileName}: ${count} file(s)`);
  } catch (error) {
    failures += 1;
    console.error(
      `FAIL ${fileName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  console.log("");
}

if (failures > 0) {
  console.error(`${failures} archive(s) could not be repaired.`);
  process.exit(1);
}

console.log("PASS: all existing downloaded model archives extracted.");
console.log("");
console.log("Now run:");
console.log("  node .\\get-road-safe-models.mjs");
console.log("to regenerate the full manifest/report without re-downloading the ZIPs.");
