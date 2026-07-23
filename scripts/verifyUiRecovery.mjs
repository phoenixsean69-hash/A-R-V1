import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const main = read("src/main.tsx");
const packageJson = JSON.parse(read("package.json"));
const lock = read("package-lock.json");
const loader = read("src/services/googleMapsLoader.ts");
const accidentMap = read("src/components/map/AccidentMap.tsx");
const caseMap = read("src/components/cases/GoogleRoadLocationMap.tsx");
const fieldMap = read("src/components/fieldPlacement/GoogleFieldPlacementMap.tsx");

const failures = [];
if (main.includes("@tabler/core") || main.includes("bootstrap")) {
  failures.push("Global Tabler/Bootstrap stylesheet is still imported.");
}
if (packageJson.dependencies?.["@tabler/core"]) {
  failures.push("@tabler/core is still a runtime dependency.");
}
if ([
  "node_modules/@tabler/core",
  "node_modules/bootstrap",
  "node_modules/@popperjs/core",
].some((entry) => lock.includes(entry))) {
  failures.push("Tabler/Bootstrap packages remain in package-lock.json.");
}
const eagerOptionalImports = ["marker", "places", "streetView", "geocoding"].filter(
  (library) => loader.includes(`maps.importLibrary("${library}")`),
);
if (eagerOptionalImports.length > 0) {
  failures.push(`The shared loader still eagerly imports optional libraries: ${eagerOptionalImports.join(", ")}.`);
}
for (const [label, source] of [
  ["AccidentMap", accidentMap],
  ["GoogleRoadLocationMap", caseMap],
  ["GoogleFieldPlacementMap", fieldMap],
]) {
  if (!source.includes("Place search unavailable for this key")) {
    failures.push(`${label} does not isolate an unavailable Places library.`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({
  globalCssCollisionRemoved: true,
  optionalGoogleLibrariesIsolated: true,
  coreMapsRemainAvailable: true,
}, null, 2));
