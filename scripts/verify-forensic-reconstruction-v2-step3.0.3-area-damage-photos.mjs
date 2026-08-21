import fs from "node:fs";

const paths = {
  types: "src/features/forensicReconstruction/forensicInvestigationTypes.ts",
  service: "src/features/forensicReconstruction/forensicInvestigationService.ts",
  photos: "src/features/forensicReconstruction/forensicDamagePhotoService.ts",
  workspace: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx",
  css: "src/features/forensicReconstruction/ForensicInvestigationWorkspace.css",
};

for (const file of Object.values(paths)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing Step 3.0.3 file: ${file}`);
  }
}

const types = fs.readFileSync(paths.types, "utf8");
const service = fs.readFileSync(paths.service, "utf8");
const photos = fs.readFileSync(paths.photos, "utf8");
const workspace = fs.readFileSync(paths.workspace, "utf8");
const css = fs.readFileSync(paths.css, "utf8");

const checks = [
  ["Vehicle photo metadata type exists", types.includes("ForensicVehicleDamagePhotoRef")],
  ["Vehicle photo refs can carry a damageArea", types.includes("damageArea?: VehicleDamageArea")],
  ["Vehicle record stores damagePhotos", types.includes("damagePhotos: ForensicVehicleDamagePhotoRef[]")],
  ["Old vehicle records migrate to empty damagePhotos", service.includes("damagePhotos: Array.isArray(vehicle.damagePhotos)")],
  ["Images use IndexedDB rather than localStorage payloads", photos.includes("indexedDB") && !photos.includes("localStorage.setItem")],
  ["Workspace validates damage-area photo coverage", workspace.includes("Attach at least one photograph for:")],
  ["Workspace provides per-area photo section", workspace.includes("Damage-area photographs")],
  ["Workspace stores photos against a specific damage area", workspace.includes("damageArea,") && workspace.includes("Add more ${area} photos")],
  ["Workspace includes optional general overview photo section", workspace.includes("General / overview damage photographs (optional)")],
  ["Workspace reclassifies removed damage-area photos", workspace.includes("damageArea === area") && workspace.includes("damageArea: undefined")],
  ["Damage-area cards show photo counts", workspace.includes("photoCount") && workspace.includes("fv2-damage-area-text")],
  ["Register shows per-area photo status", workspace.includes("(no photo)") && workspace.includes("photo.damageArea === area")],
  ["Button styling uses action-button theme", css.includes(".fv2-action-button") && css.includes("linear-gradient(180deg,#4b4b4b 0%,#2f2f2f 100%)")],
  ["Damage-area panel CSS exists", css.includes(".fv2-damage-area-panel") && css.includes(".fv2-damage-area-grid")],
  ["CSS contains no literal escaped-newline corruption", !css.includes("\\n.fv2-")],
];


let failed = 0;
for (const [label, passed] of checks) {
  if (passed) console.log(`[OK] ${label}`);
  else {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  }
}

if (failed) {
  throw new Error(`Step 3.0.3 damage-area photo verification failed: ${failed} check(s) failed.`);
}

console.log("");
console.log(`[RoadSafe] Step 3.0.3 damage-area photo verification passed (${checks.length}/${checks.length}).`);
