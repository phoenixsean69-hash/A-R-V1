RoadSafe AR — BLENDER RIGHT PROPERTIES PANEL V3
=================================================

This version intentionally abandons the V1/V2 TSX approach.

V3 changes ONE ALREADY-LOADED CSS FILE ONLY:

  src/styles/blenderColorGuard.css

It does not:
- edit AccidentReconstructionEditor.tsx
- add imports
- add React state
- add JSX
- touch models
- touch physics
- touch timeline/playback
- run npm build

Why this is safer:
main.tsx already globally imports blenderColorGuard.css. The existing 3D panel
already contains all the controls needed. V3 simply changes their layout.

Install:
  cd C:\Users\nooklyweb\Desktop\A-R-V1
  node .\install-blender-right-panel-v3.mjs

Then:
  npm run dev

Visual changes:
- fixed Blender-like right panel width
- dark property-editor background
- narrow vertical icon rail
- orange active rail marker
- compact participant property table
- compact input fields
- compact 4-mode camera row
- compact layers rows
- compact physics telemetry
- Blender-like disclosure headers
- tight separators rather than big cards

Rollback:
  node .\revoke-blender-right-panel-v3.mjs
