RoadSafe AR — MAIN 3D VIEW POLISH V1
=======================================

SCOPE
-----
This patch touches ONLY:

  src/components/reconstruction/Reconstruction3DViewer.tsx

It does not change:
- the reverted/approved theme;
- object extraction;
- OSM;
- terrain acquisition;
- physics;
- 2D reconstruction;
- AR logic.

1. BOTTOM-RIGHT VIEWPORT GIZMO
------------------------------
A small Blender-style gizmo is rendered directly in the SAME Three.js canvas.

It contains:
- red X arrow + ring;
- green Y arrow + ring;
- blue Z arrow + ring;
- small orange centre pivot.

The widget is rendered in the bottom-right using WebGL viewport/scissor.

There is NO second WebGL renderer/canvas.

Every frame:

  main scene renders
        ↓
  depth cleared
        ↓
  bottom-right scissor enabled
        ↓
  camera orientation copied inversely to gizmo root
        ↓
  gizmo renders
        ↓
  viewport restored

So rotating/orbiting the main camera rotates the orientation widget exactly as
a viewport gizmo should.

The existing time badge is moved upward so it does not cover the gizmo.

2. BLENDER-STYLE GRID FLOOR
---------------------------
A THREE.GridHelper is added over the scene floor.

Grid:
- adapts to reconstruction world dimensions;
- approximately 2 metre cells;
- capped at 90 divisions for performance;
- semi-transparent;
- depthWrite disabled;
- uses one lightweight GridHelper object.

World reference axes:
- red line = X
- green line = Z / ground-plane second axis

The grid is visual/reference only.
It does not alter reconstruction geometry or physics.

INSTALL
-------
Extract into:

C:\Users\nooklyweb\Desktop\A-R-V1

Then:

cd C:\Users\nooklyweb\Desktop\A-R-V1
node .\install-main-3d-view-polish-v1.mjs

The installer runs:

npm run build

After a successful build:

npm run dev

ROLLBACK
--------
node .\revoke-main-3d-view-polish-v1.mjs
