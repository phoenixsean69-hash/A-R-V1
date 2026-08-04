# Crooked vehicle movement fix

This patch targets the current `phoenixsean69-hash/A-R-V1` repository.

It fixes:

- Small pointer-drawing errors turning into visible vehicle weaving.
- Bézier smoothing being applied to tiny direction changes.
- Existing saved vehicle routes retaining too many noisy intermediate points during playback.
- 2D, 3D and AR route lines using different/noisier path data than playback.
- Newly drawn routes being sampled by raw pointer index instead of cleaned distance.

## Apply

Copy `scripts/fix-crooked-vehicle-movement.mjs` into your project, then run from the project root:

```powershell
node scripts/fix-crooked-vehicle-movement.mjs
npm run build
npm run dev
```

The script edits these files:

- `src/utils/reconstructionGeometry.ts`
- `src/utils/reconstructionPointZIntegration.ts`
- `src/components/reconstruction/AccidentReconstructionEditor.tsx`
- `src/components/reconstruction/Reconstruction3DViewer.tsx`
- `src/components/reconstruction/ar/ARSceneFactory.ts`

The script stops with an error if the expected current repository code cannot be found.
