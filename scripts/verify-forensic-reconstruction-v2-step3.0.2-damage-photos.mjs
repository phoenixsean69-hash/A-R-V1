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
    throw new Error(`Missing Step 3.0.2 file: ${file}`);
  }
}

const types = fs.readFileSync(paths.types, "utf8");
const service = fs.readFileSync(paths.service, "utf8");
const photos = fs.readFileSync(paths.photos, "utf8");
const workspace = fs.readFileSync(paths.workspace, "utf8");
const css = fs.readFileSync(paths.css, "utf8");

const checks = [
  ["Vehicle photo metadata type exists", types.includes("ForensicVehicleDamagePhotoRef")],
  ["Vehicle record stores damagePhotos", types.includes("damagePhotos: ForensicVehicleDamagePhotoRef[]")],
  ["Old vehicle records migrate to empty damagePhotos", service.includes("damagePhotos: Array.isArray(vehicle.damagePhotos)")],
  ["Images use IndexedDB rather than localStorage payloads", photos.includes("indexedDB") && !photos.includes("localStorage.setItem")],
  ["Photo bytes are stored as Blob", photos.includes("blob: Blob")],
  ["Photo SHA-256 metadata is supported", photos.includes('crypto.subtle.digest') && types.includes("sha256?: string")],
  ["Only image files are accepted", photos.includes('file.type.startsWith("image/")')],
  ["15 MB per-image limit exists", photos.includes("15 * 1024 * 1024")],
  ["Workspace has image file input", workspace.includes('type="file"') && workspace.includes('accept="image/*"')],
  ["Workspace allows multiple images", workspace.includes("multiple")],
  ["Damage section label exists", workspace.includes("Damage photographs")],
  ["Vehicle record receives uploaded photos", workspace.includes("damagePhotos: [...vehicleDamagePhotos]")],
  ["Draft photo removal exists", workspace.includes("removeDraftVehicleDamagePhoto")],
  ["Stored photo thumbnail component exists", workspace.includes("DamagePhotoThumbnail")],
  ["Vehicle register reports damage photo count", workspace.includes("damage photo${record.damagePhotos.length === 1 ? \"\" : \"s\"}")],
  ["Photo upload CSS exists", css.includes(".fv2-damage-photo-upload") && css.includes(".fv2-damage-photo-grid")],
  ["CSS contains no literal escaped-newline corruption", !css.includes("\\\\n.fv2-")],
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
  throw new Error(`Step 3.0.2 damage-photo verification failed: ${failed} check(s) failed.`);
}

console.log("");
console.log(`[RoadSafe] Step 3.0.2 damage-photo verification passed (${checks.length}/${checks.length}).`);
