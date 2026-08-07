RoadSafe AR — CLEAN EDITOR WORKSPACE V1
==========================================

TARGET
------
Convert Accident Reconstruction from a long page into a true editor layout.

FINAL TERRITORY
---------------

  NAV |                CENTRE                 | PROPERTIES
      |---------------------------------------|-----------
      |                                       |
      |         2D MAP / 3D SCENE ONLY        |
      |                                       |
      |---------------------------------------|
      | [ Timeline ] [ Nodes ]         [ ⛶ ]  |
      | active bottom editor                   |
      |---------------------------------------|

CENTRE
------
Removed from normal centre flow:
- Reconstruction Node Editor
- Workspace Panels
- Case Setup
- Scene Environment
- Objects / Hazards / Evidence cards
- Primary Impact Setup
- Deterministic Simulation
- Audit
- Alternative Hypotheses
- Evidence / measurement documentation
- Photos / officer notes

The 2D "RECONSTRUCTION SCENE" title/toolbar is hidden from the centre too.
Its useful controls are available in the migrated right inspector.

2D map now fills the available centre viewport.
3D scene now fills the available centre viewport.

3D PROPERTIES
-------------
The repo currently renders 3D Properties inline inside stage-grid--3d.
V1 portals it into the real AppShell right-panel host, matching the existing
2D right-panel architecture.

BOTTOM EDITOR
-------------
New component:

  src/components/reconstruction/ReconstructionBottomDock.tsx

Tabs:
- Timeline
- Nodes

Timeline:
- same canonical AccidentTimeline
- same playback state
- same event editing

Nodes:
- uses the EXISTING ReconstructionNodeEditor component
- not a duplicate node implementation
- lives inside the same bottom territory as Timeline

Node maximize:
- click the expand button while Nodes is active
- Nodes fills the complete centre editor area
- navigation remains visible
- right Properties remains visible
- reconstruction header remains visible
- restore returns Nodes to the bottom dock

RIGHT PROPERTIES
----------------
The existing Workspace Panels + investigation modules are NOT reimplemented.
V1 portals the existing JSX into the right AppShell context host.

The top "Panels" button opens/closes this migrated right inspector.

The top "Objects & Evidence" button opens the same right inspector and scrolls
to the existing SceneObjectPalette.

The migrated right inspector also contains:
- Diagram / Street / Satellite
- Undo
- Redo
- Draw Route
- Start / Brake / Turn-Swerve / Impact legend

INSTALL
-------
Extract into:

  C:\Users\nooklyweb\Desktop\A-R-V1

Then:

  cd C:\Users\nooklyweb\Desktop\A-R-V1

  node .\install-clean-editor-workspace-v1.mjs

The installer:
1. validates the current successful standalone Timeline architecture;
2. creates ReconstructionBottomDock.tsx;
3. creates reconstructionBottomDock.css;
4. removes inline Nodes from AccidentReconstructionEditor;
5. moves existing centre cards to the right host through React portal;
6. portals 3D Properties to the real right host;
7. removes the 2D scene title/toolbar from visible centre territory;
8. parses transformed TSX before writing;
9. runs the full project build;
10. restores automatically on failure.

Build log if anything fails:

  .roadsafe-ui-backup\clean-editor-workspace-v1-build.log

START
-----
  npm run dev

ROLLBACK
--------
  node .\revoke-clean-editor-workspace-v1.mjs
