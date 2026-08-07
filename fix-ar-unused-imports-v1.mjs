import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const targetPath = path.join(
  root,
  "src/components/reconstruction/ar/ARReconstructionViewer.tsx",
);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(packagePath)) {
  fail("Run this script from C:\\Users\\nooklyweb\\Desktop\\A-R-V1");
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

if (pkg.name !== "roadsafe-ar") {
  fail(`Expected package "roadsafe-ar", found "${pkg.name ?? "unknown"}".`);
}

if (!fs.existsSync(targetPath)) {
  fail("Could not find ARReconstructionViewer.tsx.");
}

const original = fs.readFileSync(targetPath, "utf8");
let source = original;

/*
 * These icons belonged to the old floating AR playback/layer overlay.
 * The Blender-style AR Properties panel no longer uses them.
 */
for (const name of ["Gauge", "Square", "Video"]) {
  const linePattern = new RegExp(
    `^[\\t ]*${name},[\\t ]*\\r?\\n`,
    "m",
  );

  if (linePattern.test(source)) {
    source = source.replace(linePattern, "");
    console.log(`REMOVED unused AR icon import: ${name}`);
  } else {
    console.log(`SKIP ${name}: import already absent.`);
  }
}

/*
 * Safety: make sure the named imports are not still present in the
 * materialIcons import block.
 */
const iconImportMatch = source.match(
  /import\s*\{[\s\S]*?\}\s*from\s*["']\.\.\/\.\.\/icons\/materialIcons["'];/,
);

if (!iconImportMatch) {
  fail("Could not verify the materialIcons import block. No file written.");
}

for (const name of ["Gauge", "Square", "Video"]) {
  const identifierPattern = new RegExp(`\\b${name}\\b`);

  if (identifierPattern.test(iconImportMatch[0])) {
    fail(`Unused icon import still present: ${name}. No file written.`);
  }
}

/*
 * Do not touch any AR Properties/UI code.
 */
for (const required of [
  "roadsafe-ar-blender-properties",
  "arPropertiesTab",
  "setARPropertiesTab",
]) {
  if (!source.includes(required)) {
    fail(
      `Expected installed AR Properties marker missing: ${required}. No file written.`,
    );
  }
}

fs.writeFileSync(targetPath, source, "utf8");

console.log("");
console.log("AR unused-import cleanup installed.");
console.log("");
console.log("Changed only:");
console.log("  src/components/reconstruction/ar/ARReconstructionViewer.tsx");
console.log("");
console.log("Removed:");
console.log("  Gauge");
console.log("  Square");
console.log("  Video");
console.log("");
console.log("Now run:");
console.log("  npm run build");
