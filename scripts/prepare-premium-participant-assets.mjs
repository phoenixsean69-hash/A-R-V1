import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const intakeRoot = path.join(root, "model-intake", "extracted");
const runtimeRoot = path.join(
  root,
  "public",
  "assets",
  "roadsafe-premium-participants",
);
const runtimeAssetRoot = path.join(runtimeRoot, "assets");

if (!fs.existsSync(intakeRoot)) {
  console.error(`Model intake not found: ${intakeRoot}`);
  process.exit(1);
}

fs.rmSync(runtimeRoot, { recursive: true, force: true });
fs.mkdirSync(runtimeAssetRoot, { recursive: true });

/*
 * These are selected from the successful 11/11 RoadSafe model intake.
 * We intentionally prefer browser-loadable GLB/FBX sources and keep generic
 * RoadSafe category identities even when a source file has its own internal
 * model naming.
 */
const selections = [
  {
    assetId: "car-sedan-generic",
    source: "byzmod-original-car-pack/CARRO 3D LOW POLY, HIGH POLY/CAR_2022/CARRO 3D HIGH POLY.fbx",
    sourceName: "Byzmod High-Poly Car",
    license: "CC0",
  },
  {
    assetId: "car-hatchback-generic",
    source: "rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Hatchback/Hatchback.fbx",
    sourceName: "RGSDev Hatchback",
    license: "CC0",
  },
  {
    assetId: "car-suv-generic",
    source: "rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/SUV/SUV.fbx",
    sourceName: "RGSDev SUV",
    license: "CC0",
  },
  {
    assetId: "car-pickup-generic",
    source: "public-domain-pickup-glb/public-domain-pickup.glb",
    sourceName: "Public-domain Pickup GLB",
    license: "Public Domain",
  },
  {
    assetId: "bus-minibus-generic",
    source: "kenney-car-kit/Models/GLB format/van.glb",
    sourceName: "Kenney Van / Minibus",
    license: "CC0",
  },
  {
    assetId: "bus-city-generic",
    source: "quaternius-public-transport/Public Transport/FBX/Bus.fbx",
    sourceName: "Quaternius Bus",
    license: "CC0",
  },
  {
    assetId: "truck-rigid-generic",
    source: "public-domain-truck-glb/public-domain-truck.glb",
    sourceName: "Public-domain Truck GLB",
    license: "Public Domain",
  },
  {
    assetId: "truck-articulated-generic",
    source: "rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Truck with trailer/Truck with trailer.fbx",
    sourceName: "RGSDev Truck with Trailer",
    license: "CC0",
  },
  {
    assetId: "truck-lorry-generic",
    source: "rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Truck/Truck.fbx",
    sourceName: "RGSDev Truck / Lorry",
    license: "CC0",
  },
  {
    assetId: "truck-tractor-generic",
    source: "kenney-car-kit/Models/GLB format/tractor.glb",
    sourceName: "Kenney Tractor",
    license: "CC0",
  },
  {
    assetId: "two-wheel-motorcycle-generic",
    source: "public-domain-motorcycle-glb/public-domain-motorcycle.glb",
    sourceName: "Public-domain Motorcycle GLB",
    license: "Public Domain",
  },
  {
    assetId: "two-wheel-bicycle-generic",
    source: "quaternius-public-transport/Public Transport/FBX/Bicycle.fbx",
    sourceName: "Quaternius Bicycle",
    license: "CC0",
  },
  {
    assetId: "human-adult-generic",
    source: "quaternius-animated-human/Animated Human by @Quaternius/FBX/Animated Human.fbx",
    sourceName: "Quaternius Animated Human",
    license: "CC0",
  },
  {
    assetId: "human-adult-male-generic",
    source: "quaternius-animated-human/Animated Human by @Quaternius/FBX/Animated Human.fbx",
    sourceName: "Quaternius Animated Human — Adult Male scale",
    license: "CC0",
  },
  {
    assetId: "human-adult-female-generic",
    source: "quaternius-animated-human/Animated Human by @Quaternius/FBX/Animated Human.fbx",
    sourceName: "Quaternius Animated Human — Adult Female scale",
    license: "CC0",
  },
  {
    assetId: "human-child-generic",
    source: "quaternius-animated-human/Animated Human by @Quaternius/FBX/Animated Human.fbx",
    sourceName: "Quaternius Animated Human — Child scale",
    license: "CC0",
  },
];

function copyFbxBundle(sourcePath, assetId) {
  const sourceDirectory = path.dirname(sourcePath);
  const destinationDirectory = path.join(runtimeAssetRoot, assetId);

  fs.cpSync(sourceDirectory, destinationDirectory, {
    recursive: true,
    force: true,
  });

  return {
    runtimePath: path.join(destinationDirectory, path.basename(sourcePath)),
    url: `/assets/roadsafe-premium-participants/assets/${assetId}/${encodeURIComponent(
      path.basename(sourcePath),
    )}`,
  };
}

function copyGlb(sourcePath, assetId) {
  const destination = path.join(runtimeAssetRoot, `${assetId}.glb`);
  fs.copyFileSync(sourcePath, destination);

  return {
    runtimePath: destination,
    url: `/assets/roadsafe-premium-participants/assets/${assetId}.glb`,
  };
}

const manifest = {
  generatedAt: new Date().toISOString(),
  intakeRoot: path.relative(root, intakeRoot),
  assets: {},
};

const missing = [];

for (const selection of selections) {
  const sourcePath = path.join(intakeRoot, selection.source);

  if (!fs.existsSync(sourcePath)) {
    missing.push(`${selection.assetId}: ${selection.source}`);
    continue;
  }

  const extension = path.extname(sourcePath).slice(1).toLowerCase();

  if (extension !== "glb" && extension !== "fbx") {
    missing.push(`${selection.assetId}: unsupported ${extension}`);
    continue;
  }

  const prepared =
    extension === "fbx"
      ? copyFbxBundle(sourcePath, selection.assetId)
      : copyGlb(sourcePath, selection.assetId);

  const stat = fs.statSync(prepared.runtimePath);

  manifest.assets[selection.assetId] = {
    assetId: selection.assetId,
    url: prepared.url,
    format: extension,
    sourceFile: path.relative(root, sourcePath),
    sourceName: selection.sourceName,
    license: selection.license,
    bytes: stat.size,
  };

  console.log(
    `HQ ${selection.assetId} <- ${path.relative(root, sourcePath)}`,
  );
}

if (missing.length > 0) {
  console.warn("");
  console.warn("Premium model selections not found in model-intake:");
  missing.forEach((item) => console.warn(`- ${item}`));
  console.warn("");
  console.warn(
    "Those categories will keep the RoadSafe procedural fallback; available HQ categories will still be installed.",
  );
}

if (
  Object.keys(
    manifest.assets,
  ).length === 0
) {
  console.error(
    "No premium GLB/FBX selections could be prepared from model-intake.",
  );
  process.exit(1);
}

fs.writeFileSync(
  path.join(runtimeRoot, "manifest.json"),
  JSON.stringify(manifest, null, 2),
  "utf8",
);

fs.writeFileSync(
  path.join(runtimeRoot, "README.txt"),
  [
    "RoadSafe premium participant runtime assets",
    "",
    `Generated: ${manifest.generatedAt}`,
    "",
    "Prepared from the successful RoadSafe model-intake sources.",
    "The manifest preserves source file and licence metadata.",
    "",
  ].join("\n"),
  "utf8",
);

console.log("");
console.log(
  `Premium runtime assets ready: ${Object.keys(manifest.assets).length}/${selections.length}`,
);
console.log(
  `Manifest: ${path.relative(root, path.join(runtimeRoot, "manifest.json"))}`,
);
