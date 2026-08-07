RoadSafe AR — BLENDER PROPERTIES PANEL V2
===========================================

V1's structural audit passed but the full project build failed.
V2 deliberately removes the risky React restructuring.

V2 DOES:
- add one class to the existing 3D inspector;
- add one passive Blender-style icon rail;
- apply a high-specificity stylesheet to the EXISTING controls.

V2 DOES NOT:
- add React state;
- wrap conditionals;
- add scroll handlers;
- alter participant state;
- alter physics;
- alter timeline/playback;
- alter model assetId/model integration.

INSTALL
-------
Extract into:
C:\Users\nooklyweb\Desktop\A-R-V1

Run:
cd C:\Users\nooklyweb\Desktop\A-R-V1
node .\install-blender-properties-panel-v2.mjs

The installer runs npm run build.

If the build fails:
1. it restores the previous files;
2. it keeps the full compiler output at:
   .roadsafe-ui-backup\blender-properties-v2-build.log

START
-----
npm run dev

ROLLBACK
--------
node .\revoke-blender-properties-panel-v2.mjs
