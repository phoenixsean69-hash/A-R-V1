import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const required = [
  "src/engine/assets/participantAssetCatalog.ts",
  "src/engine/assets/participant3DModelFactory.ts",
  "src/components/reconstruction/Participant2DModel.tsx",
  "src/types/reconstruction.ts",
  "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  "src/components/reconstruction/ForensicScenePreview.tsx",
  "src/components/reconstruction/Reconstruction3DViewer.tsx",
];

const failures = [];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push("Missing " + relativePath);
  }
}

const catalog = fs.readFileSync(
  path.join(
    root,
    "src/engine/assets/participantAssetCatalog.ts",
  ),
  "utf8",
);

for (const assetId of [
  "car-sedan-generic",
  "car-hatchback-generic",
  "car-suv-generic",
  "car-pickup-generic",
  "bus-minibus-generic",
  "bus-city-generic",
  "truck-rigid-generic",
  "truck-articulated-generic",
  "truck-lorry-generic",
  "truck-tractor-generic",
  "two-wheel-motorcycle-generic",
  "two-wheel-bicycle-generic",
  "human-adult-generic",
  "human-adult-male-generic",
  "human-adult-female-generic",
  "human-child-generic",
]) {
  if (!catalog.includes(assetId)) {
    failures.push(
      "Asset catalog missing " +
        assetId,
    );
  }
}

const types = fs.readFileSync(
  path.join(
    root,
    "src/types/reconstruction.ts",
  ),
  "utf8",
);

if (
  !types.includes(
    "assetId?: ReconstructionParticipantAssetId",
  )
) {
  failures.push(
    "Reconstruction participants do not expose assetId.",
  );
}

const editor = fs.readFileSync(
  path.join(
    root,
    "src/components/reconstruction/AccidentReconstructionEditor.tsx",
  ),
  "utf8",
);

if (
  !editor.includes(
    "Participant2DModel",
  )
) {
  failures.push(
    "2D editor is not using Participant2DModel.",
  );
}

if (
  !editor.includes(
    "<span>Model</span>",
  )
) {
  failures.push(
    "Participant inspector has no Model selector.",
  );
}

const preview = fs.readFileSync(
  path.join(
    root,
    "src/components/reconstruction/ForensicScenePreview.tsx",
  ),
  "utf8",
);

if (
  !preview.includes(
    "Participant2DSceneGlyph",
  )
) {
  failures.push(
    "Forensic preview is not using the shared 2D model.",
  );
}

const viewer = fs.readFileSync(
  path.join(
    root,
    "src/components/reconstruction/Reconstruction3DViewer.tsx",
  ),
  "utf8",
);

if (
  !viewer.includes(
    "createGenericParticipant3DModel",
  )
) {
  failures.push(
    "3D viewer is not using the RoadSafe generic model factory.",
  );
}

if (
  viewer.includes(
    "loadRealisticParticipantModel",
  )
) {
  failures.push(
    "3D viewer still references manufacturer-specific participant models.",
  );
}

if (
  viewer.includes(
    "applyExactParticipantColour",
  ) ||
  viewer.includes(
    "NON_BODY_MATERIAL_TOKENS",
  ) ||
  viewer.includes(
    "PARTICIPANT_COLOURS",
  )
) {
  failures.push(
    "3D viewer still contains obsolete local participant-colour code.",
  );
}

if (
  !viewer.includes(
    "getParticipantColourNumber",
  )
) {
  failures.push(
    "3D viewer is not using the shared participant colour resolver.",
  );
}

for (
  const malformed of [
    "const function ",
    "let function ",
    "var function ",
  ]
) {
  if (
    viewer.includes(
      malformed,
    )
  ) {
    failures.push(
      "3D viewer contains malformed declaration: " +
        malformed.trim(),
    );
  }
}

console.log(
  "Participant model foundation audit.",
);

if (
  failures.length > 0
) {
  for (
    const failure of failures
  ) {
    console.error(
      "FAIL: " + failure,
    );
  }

  process.exit(1);
}

console.log(
  "PASS: one generic participant asset foundation is shared by 2D and 3D.",
);
