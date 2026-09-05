
RoadSafe AR — Forensic GNSS Right Panel V1

This changes only the presentation of the Set reference point workflow.

NEW UI
- Very small floating panel
- 360px width
- Docked to the right side of the screen
- Vertically centered
- Slides in from the right
- Scene Intake remains visible behind it
- Compact internal scroll if needed

The panel contains only:
- permanent feature name
- live coordinate
- accuracy
- live-location enable/refresh
- I am at the reference point
- sampling count
- captured coordinate
- Confirm datum

GNSS logic and saved forensic data are unchanged.

FILE
src/features/forensicReconstruction/ForensicDatumPicker.tsx

INSTALL
1. Extract this ZIP.
2. Copy roadsafe-forensic-gnss-right-panel-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run:
   node .\roadsafe-forensic-gnss-right-panel-v1\install-forensic-gnss-right-panel-v1.mjs
   npm run build
