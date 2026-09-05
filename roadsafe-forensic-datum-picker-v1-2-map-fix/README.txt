RoadSafe AR — Forensic Datum Picker V1.2 Map Render Fix

Problem
The datum picker opens, but the scene map panel is black.

V1.2 fixes the map rendering path rather than changing datum logic.

Changes:
- Uses the same proven Esri hybrid source stack as RoadSafe's working map:
  World Imagery
  World Transportation
  World Boundaries and Places
- Caps imagery/map zoom at 17, matching RoadSafe's working map.
- Uses compact MapLibre attribution options.
- Calls map.resize() after load.
- Adds ResizeObserver so the map resizes when the fullscreen picker settles.
- Adds delayed resize passes for modal/layout timing.
- Fits to the exact frozen forensic-core bounds after map load.
- Renders the picker through createPortal(..., document.body), so the station
  sidebar/layout cannot constrain the fullscreen map.
- Adds visible map-source warnings if imagery fails instead of showing a
  silent black panel.

No changes to:
- saved datum data model
- Scene Intake workflow
- forensic core bounds
- accident anchor
- X/Y conversion
- evidence measurements

FILE REPLACED
src/features/forensicReconstruction/ForensicDatumPicker.tsx

INSTALL
1. Extract the ZIP.
2. Copy roadsafe-forensic-datum-picker-v1-2-map-fix into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From repo root:
   node .\roadsafe-forensic-datum-picker-v1-2-map-fix\install-forensic-datum-picker-v1-2.mjs
   npm run build
