RoadSafe AR — Total Blender UI Migration

This is the repo-wide migration requested for every RoadSafe UI surface.

It applies:
- Blender charcoal shell, navigation, views, panels, cards and dialogs;
- compact bevelled buttons and toolbars;
- orange-only selection/focus UI accents;
- recessed inputs and orange-thumb sliders;
- square orange checkboxes;
- Station Overview panel styling for every right and bottom panel;
- 2D, 3D and AR workstation chrome;
- timeline, playback and animation controls;
- Material Symbols mappings and verification;
- checkbox + Material icon Objects, Hazards & Evidence palette;
- real draggable reconstruction nodes with Bezier links;
- repo-wide old blue/navy utility-class normalization;
- automatic backup, verification, build and rollback.

Install from:
C:\Users\nooklyweb\Desktop\A-R-V1

Run:
node install-roadsafe-blender-total-ui.mjs

Start:
npm run dev

Verify:
npm run ui:verify

Rollback:
node revoke-roadsafe-blender-total-ui.mjs
