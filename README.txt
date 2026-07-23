RoadSafe AR — Total smooth playback + preserved 3D camera

This package updates the CURRENT local project files in place. It does not
replace them with an older GitHub copy.

Apply from the A-R-V1 project root:

  .\APPLY_UPDATE.ps1

or:

  node .\apply-update.mjs

The updater creates timestamped backups in:

  .roadsafe-backups\<timestamp>\

Changed/created project files:

  src/components/reconstruction/AccidentReconstructionEditor.tsx
  src/components/reconstruction/Reconstruction3DViewer.tsx
  src/utils/reconstructionPlaybackDom.ts

Keep using:

  npm run dev
