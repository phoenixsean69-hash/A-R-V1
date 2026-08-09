RoadSafe AR — GIZMO ONLY V3
==============================

PURPOSE
-------
V2 added actual Three.js TransformControls, but only one helper was rendered
and it was hidden while the workspace tool was Select.

That does not match the requested Blender-style viewport behaviour.

V3 makes the 3D gizmo PERSISTENT and COMPOSITE.

SELECT A PARTICIPANT OR SCENE OBJECT
------------------------------------
The selected model immediately receives:

  Move arrows
  Rotation ring
  Scale handles

inside the 3D viewport.

The three helpers are attached to the same selected object at the same time.

Only one controller is enabled for pointer interaction at once so the controls
do not fight each other.

ACTIVE MODE
-----------
Select = Move
G      = Move
R      = Rotate
S      = Scale

So merely selecting an object is enough to make the gizmo appear.

CANONICAL ROADSAFE CONSTRAINTS
------------------------------
Move:
  X/Z ground plane.
  Vertical Y authoring is not persisted because current participant and scene
  object data models do not store a separate height coordinate.

Rotate:
  Y/yaw ring.
  This maps exactly to participant heading and scene-object rotation.

Scale:
  Three.js scale handles are shown.
  The result is normalized to RoadSafe's canonical uniform scalar.

Participants:
  Scale remains visual/model scale only.
  Physics mass/dimensions are not silently changed.

Point Z / physics-generated route points:
  Move/Rotate remain protected.
  Scale remains available.

SCOPE
-----
V3 touches ONLY:

  src/components/reconstruction/Reconstruction3DViewer.tsx

It does NOT touch:
- OSM
- Overpass
- extraction
- buildings
- vegetation
- terrain
- RoadSceneEnvironment
- RealSceneGeometryLayer
- forensic scene pipeline

PREREQUISITE
------------
Install Gizmo Only V2 successfully first.

INSTALL
-------
cd C:\Users\nooklyweb\Desktop\A-R-V1

node .\install-gizmo-only-v3.mjs

The installer runs the full project build and restores Reconstruction3DViewer
automatically if the build fails.

TEST
----
1. npm run dev
2. Open 3D reconstruction.
3. Click Sedan 1.
4. Without pressing G/R/S, a combined gizmo should now be visible on Sedan 1.
5. Drag Move arrows.
6. Press R and drag the rotation ring.
7. Press S and drag scale handles.
8. Select a scene object and repeat.
9. Switch to 2D and confirm committed transforms match.

ROLLBACK
--------
node .\revoke-gizmo-only-v3.mjs
