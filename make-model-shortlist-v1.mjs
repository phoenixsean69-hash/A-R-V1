import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

const packagePath = path.join(root, "package.json");
if (!fs.existsSync(packagePath)) {
  console.error("Run from C:\\Users\\nooklyweb\\Desktop\\A-R-V1");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
if (packageJson.name !== "roadsafe-ar") {
  console.error(`Expected roadsafe-ar, found "${packageJson.name ?? "unknown"}".`);
  process.exit(1);
}

const shortlistRoot = path.join(root, "model-intake", "shortlist-v1");
const zipPath = path.join(root, "model-intake", "roadsafe-model-shortlist-v1.zip");

const candidates = [
  {
    category: "sedan",
    priority: "primary",
    source: "Byzmod",
    license: "CC0",
    file: "model-intake/extracted/byzmod-original-car-pack/CARRO 3D LOW POLY, HIGH POLY/CAR_2022/CARRO 3D HIGH POLY.fbx",
    note: "Highest-detail sedan/car candidate in the current intake; needs inspection and GLB export."
  },
  {
    category: "sedan",
    priority: "alternate",
    source: "Public domain",
    license: "Public domain",
    file: "model-intake/extracted/public-domain-car-glb/public-domain-car.glb",
    note: "Integration-ready GLB fallback/alternate."
  },

  {
    category: "hatchback",
    priority: "primary",
    source: "RGSDev",
    license: "CC0",
    file: "model-intake/extracted/rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Hatchback/Hatchback.fbx",
    note: "Best hatchback-specific candidate currently present."
  },

  {
    category: "suv",
    priority: "primary",
    source: "RGSDev",
    license: "CC0",
    file: "model-intake/extracted/rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/SUV/SUV.fbx",
    note: "Best SUV-specific candidate currently present."
  },
  {
    category: "suv",
    priority: "alternate",
    source: "Kenney",
    license: "CC0",
    file: "model-intake/extracted/kenney-car-kit/Models/GLB format/suv-luxury.glb",
    note: "GLB alternate for direct comparison."
  },

  {
    category: "pickup",
    priority: "primary",
    source: "Public domain",
    license: "Public domain",
    file: "model-intake/extracted/public-domain-pickup-glb/public-domain-pickup.glb",
    note: "Best ready-to-load pickup candidate."
  },
  {
    category: "pickup",
    priority: "alternate",
    source: "RGSDev",
    license: "CC0",
    file: "model-intake/extracted/rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Pickup/Pickup.fbx",
    note: "Pickup-specific CC0 alternate."
  },

  {
    category: "minibus",
    priority: "temporary-candidate",
    source: "RGSDev",
    license: "CC0",
    file: "model-intake/extracted/rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Van/Van.fbx",
    note: "Not a true minibus. Review only; do not approve as final without visual confirmation."
  },
  {
    category: "minibus",
    priority: "temporary-alternate",
    source: "Kenney",
    license: "CC0",
    file: "model-intake/extracted/kenney-car-kit/Models/GLB format/van.glb",
    note: "Not a true minibus. GLB comparison candidate."
  },

  {
    category: "bus",
    priority: "primary",
    source: "RGSDev",
    license: "CC0",
    file: "model-intake/extracted/rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Bus/Bus.fbx",
    note: "Bus-specific candidate."
  },
  {
    category: "bus",
    priority: "alternate",
    source: "Quaternius",
    license: "CC0",
    file: "model-intake/extracted/quaternius-public-transport/Public Transport/FBX/Bus.fbx",
    note: "Second bus candidate for visual comparison."
  },

  {
    category: "rigid-truck",
    priority: "primary",
    source: "Public domain",
    license: "Public domain",
    file: "model-intake/extracted/public-domain-truck-glb/public-domain-truck.glb",
    note: "Best ready-to-load rigid truck candidate."
  },
  {
    category: "rigid-truck",
    priority: "alternate",
    source: "RGSDev",
    license: "CC0",
    file: "model-intake/extracted/rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Truck/Truck.fbx",
    note: "CC0 truck alternate."
  },

  {
    category: "articulated-truck",
    priority: "primary",
    source: "RGSDev",
    license: "CC0",
    file: "model-intake/extracted/rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Truck with trailer/Truck with trailer.fbx",
    note: "Only explicit truck+trailer candidate in current intake."
  },

  {
    category: "lorry",
    priority: "temporary-candidate",
    source: "RGSDev",
    license: "CC0",
    file: "model-intake/extracted/rgsdev-vehicle-pack/Free Low Poly Vehicles Pack by Rgsdev/Truck/Truck.fbx",
    note: "No distinct lorry model in current intake. Review as temporary only."
  },

  {
    category: "tractor",
    priority: "primary",
    source: "Kenney",
    license: "CC0",
    file: "model-intake/extracted/kenney-car-kit/Models/GLB format/tractor.glb",
    note: "Only clean GLB tractor candidate in current intake."
  },

  {
    category: "motorcycle",
    priority: "primary",
    source: "Public domain",
    license: "Public domain",
    file: "model-intake/extracted/public-domain-motorcycle-glb/public-domain-motorcycle.glb",
    note: "Best ready-to-load motorcycle candidate."
  },

  {
    category: "bicycle",
    priority: "primary",
    source: "Quaternius",
    license: "CC0",
    file: "model-intake/extracted/quaternius-public-transport/Public Transport/FBX/Bicycle.fbx",
    note: "Bicycle-specific candidate."
  },
  {
    category: "bicycle",
    priority: "alternate",
    source: "Quaternius",
    license: "CC0",
    file: "model-intake/extracted/quaternius-public-transport/Public Transport/FBX/SquareFrameBicycle.fbx",
    note: "Second frame style for comparison."
  },

  {
    category: "adult-human",
    priority: "high-detail-source",
    source: "Blender Studio",
    license: "CC0",
    file: "model-intake/extracted/blender-human-base-meshes/human_base_meshes_bundle.blend",
    note: "High-detail human source bundle. Internal meshes must be inspected before male/female assignment."
  },

  {
    category: "adult-human-animation-reference",
    priority: "reference",
    source: "Quaternius",
    license: "CC0",
    file: "model-intake/extracted/quaternius-animated-human/Animated Human by @Quaternius/FBX/Animated Human.fbx",
    note: "Animation/rigging reference only, not proposed as final visual model."
  }
];

const missing = [
  {
    category: "child",
    status: "missing-final-candidate",
    note: "The report does not expose a child-specific production model. Do not fake this from an adult mesh yet."
  },
  {
    category: "officer",
    status: "missing-final-candidate",
    note: "No dedicated high-quality officer model appears in the current intake."
  }
];

fs.rmSync(shortlistRoot, { recursive: true, force: true });
fs.mkdirSync(shortlistRoot, { recursive: true });

const manifest = {
  createdAt: new Date().toISOString(),
  purpose: "RoadSafe AR model visual/geometry shortlist review",
  candidates: [],
  missing,
};

let failures = 0;

for (const candidate of candidates) {
  const sourcePath = path.join(root, candidate.file);

  if (!fs.existsSync(sourcePath)) {
    failures += 1;
    console.error(`MISSING ${candidate.file}`);
    continue;
  }

  const extension = path.extname(sourcePath);
  const safeBase =
    `${candidate.category}__${candidate.priority}__${candidate.source}`
      .replaceAll(/[^a-zA-Z0-9._-]+/g, "_");

  const categoryDir = path.join(shortlistRoot, candidate.category);
  fs.mkdirSync(categoryDir, { recursive: true });

  const destination = path.join(categoryDir, `${safeBase}${extension}`);
  fs.copyFileSync(sourcePath, destination);

  const relativeDestination = path
    .relative(root, destination)
    .replaceAll("\\", "/");

  manifest.candidates.push({
    ...candidate,
    stagedFile: relativeDestination,
    bytes: fs.statSync(destination).size,
  });

  console.log(`STAGED ${candidate.category}: ${path.basename(destination)}`);
}

const manifestPath = path.join(shortlistRoot, "SHORTLIST_MANIFEST.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const notes = [
  "RoadSafe AR — MODEL SHORTLIST V1",
  "================================",
  "",
  "This is NOT the final runtime asset folder.",
  "It is the selected review set from MODEL_INTAKE_REPORT.txt.",
  "",
  "Important gaps:",
  "- Child: no final child-specific model selected.",
  "- Officer: no final officer-specific model selected.",
  "- Minibus: only van-shaped temporary candidates.",
  "- Lorry: current candidate overlaps the generic truck source.",
  "",
  "High-priority visual review:",
  "1. Byzmod high-poly car vs public-domain car GLB",
  "2. RGS SUV / Hatchback",
  "3. Public-domain pickup / truck / motorcycle GLBs",
  "4. RGS articulated truck",
  "5. RGS vs Quaternius bus",
  "6. Quaternius bicycle variants",
  "7. Blender Studio human base bundle",
  "",
  "Do not integrate until geometry/material inspection is complete.",
  "",
];

fs.writeFileSync(
  path.join(shortlistRoot, "README-SHORTLIST.txt"),
  notes.join("\n"),
  "utf8",
);

fs.rmSync(zipPath, { force: true });

try {
  execFileSync(
    "tar.exe",
    [
      "-a",
      "-c",
      "-f",
      zipPath,
      "-C",
      shortlistRoot,
      ".",
    ],
    {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    },
  );
} catch {
  const psLiteral = (value) =>
    `'${String(value).replaceAll("'", "''")}'`;

  const command =
    `Compress-Archive -Path ${psLiteral(path.join(shortlistRoot, "*"))} ` +
    `-DestinationPath ${psLiteral(zipPath)} -Force`;

  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      command,
    ],
    {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    },
  );
}

console.log("");
console.log(`Shortlist candidates staged: ${manifest.candidates.length}`);
console.log(`Missing source files: ${failures}`);
console.log(`ZIP: ${zipPath}`);

if (failures > 0) {
  process.exit(1);
}

console.log("");
console.log("PASS: RoadSafe model shortlist created.");
console.log("Upload model-intake\\roadsafe-model-shortlist-v1.zip to ChatGPT for actual model inspection.");
