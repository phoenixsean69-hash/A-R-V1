RoadSafe AR — BLENDER SCENE COLLECTION + HQ DRAG/DROP V6
=========================================================

WHAT THIS DOES
--------------
The Participants tab becomes a Blender-style Scene Collection + Asset Library.

Scene Collection
  Collection
    Participants
      placed participants
    Scene Objects
      placed objects

Asset Library
  Participants | Objects

PARTICIPANT LIBRARY
-------------------
- Uses the canonical RoadSafe asset IDs already introduced in Model Phase 1.
- Shows a live rotating 3D preview of the selected intake model.
- Shows HQ status for model-intake assets.
- Rows are draggable.
- Drag directly onto the 2D map or 3D scene.
- The dropped model is created at the exact canonical scene position.
- A Place button preserves the existing click/GPS placement workflow.

SCENE OBJECT LIBRARY
--------------------
Uses the existing RoadSafe sceneObjectCatalog:
- Road Hazards
- Physical Evidence
- Traffic Control
- Road Infrastructure
- Environment
- Investigation

Object rows can also be dragged directly onto 2D or 3D.

HQ MODEL SOURCES
----------------
The installer uses the model-intake that was already downloaded successfully.
It prepares these browser-loadable sources:

Sedan
  Byzmod CARRO 3D HIGH POLY.fbx — CC0

Hatchback
  RGSDev Hatchback.fbx — CC0

SUV
  RGSDev SUV.fbx — CC0

Pickup
  public-domain-pickup.glb — Public Domain

Minibus
  Kenney van.glb — CC0

Bus
  Quaternius Bus.fbx — CC0

Rigid Truck
  public-domain-truck.glb — Public Domain

Articulated Truck
  RGSDev Truck with trailer.fbx — CC0

Lorry
  RGSDev Truck.fbx — CC0

Tractor
  Kenney tractor.glb — CC0

Motorcycle
  public-domain-motorcycle.glb — Public Domain

Bicycle
  Quaternius Bicycle.fbx — CC0

Humans
  Quaternius Animated Human.fbx — CC0
  RoadSafe's Adult / Male / Female / Child canonical dimensions scale the visual.

NOTE
----
The Blender Studio high-detail human bundle remains a .blend source. It is not
loaded directly by the browser in this patch. The browser-safe Quaternius FBX
is used for the current human runtime visual until a dedicated Blender -> GLB
human conversion/rigging phase is done.

RUNTIME MODEL PREPARATION
-------------------------
The installer runs:

  scripts/prepare-premium-participant-assets.mjs

It copies the selected files from:

  model-intake\extracted

into:

  public\assets\roadsafe-premium-participants

and creates:

  public\assets\roadsafe-premium-participants\manifest.json

FBX source directories are copied as bundles so relative texture/material files
remain available. GLBs are copied as single files.

3D RENDERING
------------
Reconstruction3DViewer keeps the existing RoadSafe procedural participant as an
instant fallback, then asynchronously replaces it with the matching HQ intake
model when loaded.

The premium runtime loader:
- supports GLB + FBX;
- clones geometry/materials;
- grounds the model;
- aligns the long horizontal axis with RoadSafe vehicle length when required;
- scales the model to the canonical physical dimensions;
- applies only a light participant-colour tint;
- keeps source + licence metadata on the Three.js model.

2D DROP
-------
Drag payload -> existing clientToScenePosition() -> exact RoadSafe 0..100 scene
position -> canonical participant/object creation.

3D DROP
-------
Drag payload -> Three.js raycaster -> reconstruction ground plane -> X/Z back
to the same RoadSafe 0..100 scene coordinates.

INSTALL
-------
Extract this package into:

  C:\Users\nooklyweb\Desktop\A-R-V2

Then:

  cd C:\Users\nooklyweb\Desktop\A-R-V2
  node .\install-scene-collection-hq-dragdrop-v6.mjs

The installer runs the full build and rolls back automatically if verification
or model preparation fails.

If build fails, inspect:

  .roadsafe-ui-backup\scene-collection-hq-dragdrop-v6-build.log

START
-----
  npm run dev

ROLLBACK
--------
  node .\revoke-scene-collection-hq-dragdrop-v6.mjs


V3 INSTALLER FIX
----------------
V2 failed with:

  Could not locate PendingParticipantPlacement interface.

The repo DOES contain the interface.

The V2 installer accidentally generated this JavaScript regex literal:

  /PendingParticipantPlacement\\s*\\{ ... /

Inside a regex literal, "\\s" looks for the literal characters "\s".
It therefore could never match normal whitespace.

V3 removes that brittle regex entirely.

It now:
- finds PendingParticipantPlacement by declaration name;
- locates the actual interface keyword;
- brace-scans the complete interface;
- verifies its type and index fields;
- inserts assetId before the structural closing brace.

V3 also fixes two nearby V2 helper bugs:
- literal "\\n" strings are replaced with real newlines;
- /\\s*$/ is corrected to /\s*$/.

The feature architecture itself is unchanged.


V4 INSTALLER FIX
----------------
V3 reached the real 2D viewport patch, then Node crashed with:

  ReferenceError: sceneCursorClass is not defined

Cause:
The installer used a JavaScript template literal to describe SOURCE CODE that
it wanted to match:

  `${sceneCursorClass}`

Node therefore tried to evaluate sceneCursorClass in the installer process.

V4:
- represents that TSX fragment as normal literal strings;
- does not evaluate sceneCursorClass;
- regression-tests the exact old/new viewport class fragment;
- adds uncaught-exception/unhandled-rejection rollback;
- detects the seven exact source files left by the interrupted V3 run and
  treats them as resumable installer payload, not as original user files;
- fixes the type-import helper so a multiline import ending in a comma cannot
  become a double comma.

Do NOT manually delete the seven files from the failed V3 attempt.
Run V4 directly.


V5 — DEEP STRUCTURAL FIX
------------------------
V4 failed at:

  Could not locate Reconstruction3DViewerProps closing.

The repo does contain Reconstruction3DViewerProps. The problem was the
installer still expected an exact text ending around workspaceTool.

V5 removes the whole brittle 3D patch strategy.

It now patches Reconstruction3DViewer using structure:

1. finds the Reconstruction3DViewerProps declaration;
2. brace-scans the full interface, including nested workspaceLayers braces;
3. inserts drop callback props before the real closing brace;
4. finds the Reconstruction3DViewer function and brace-scans its destructured
   parameter object;
5. inserts callback props into the real parameter object;
6. finds onSelectRef semantically and installs stable drop callback refs;
7. locates the actual reconstruction.vehicles.forEach participant loop;
8. finds participantEntries.set + the first settleAsset(false) inside it and
   replaces that settlement with premium-model loading;
9. locates pointerdown add/removeEventListener calls with whitespace-tolerant
   regex and installs/removes 3D HTML drag/drop handlers there.

No exact workspaceTool/interface/function formatting is required.

V5 also changes premium preparation so a missing category no longer aborts the
entire feature. Available HQ intake models are installed; missing categories
use the existing procedural RoadSafe fallback. The installer fails only if
ZERO premium models can be prepared.

The seven payload files left by V3/V4 are still detected as resumable installer
files. Do not delete them manually.


V6 — UNUSED IMPORT BUILD FIX
----------------------------
V5 reached the full TypeScript build. The only compiler failure was:

  AccidentReconstructionEditor.tsx:
  getParticipantAssetDefinition is declared but its value is never read.

That import was used by the OLD participant form. Replacing that form with
SceneCollectionAssetBrowser made the import obsolete.

V6 fixes it in two layers:

1. Proactive cleanup:
   after transforming AccidentReconstructionEditor, V6 removes
   getParticipantAssetDefinition only if the identifier occurs exactly once
   in the complete transformed source (the import itself).

2. Safe compiler cleanup:
   if the first full build reports TS6133 for an IMPORT-ONLY identifier,
   V6 removes that named import and retries the full build once.

The cleanup never deletes arbitrary variables/functions. It only edits a named
ES import when the identifier occurs exactly once in the whole source file.

This prevents another installer version just because the large UI refactor
made one more import obsolete.

Run V6 directly. It handles clean or interrupted payload state.
