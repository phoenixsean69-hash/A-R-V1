RoadSafe AR — Forensic Datum Picker V1

Requirement
Fixed reference point must be selected manually from the already-frozen scene map.

NEW FLOW
Scene Intake
→ Fixed reference point
→ Pick on map
→ frozen forensic core opens
→ red accident anchor displayed
→ investigator clicks permanent point inside orange core
→ investigator names the permanent feature
→ Confirm reference
→ label + coordinates + scene X/Y stored

The picker rejects clicks outside the frozen forensic core.

Stored data:
- human-readable label
- latitude
- longitude
- X percentage
- Y percentage
- X metres
- Y metres
- selected timestamp
- method = Manual map pick

Examples of suitable datum points:
- utility pole base
- signpost base
- drain corner
- culvert corner
- surveyed permanent mark
- stable wall/fence corner

Do NOT use:
- vehicle
- debris
- tyre/skid mark
- temporary cone
- movable object

FILES
ADD
src/features/forensicReconstruction/ForensicDatumPicker.tsx

PATCH
src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx
src/features/forensicReconstruction/forensicInvestigationTypes.ts

INSTALL
1. Extract this ZIP.
2. Copy roadsafe-forensic-datum-picker-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run:
   node .\roadsafe-forensic-datum-picker-v1\install-forensic-datum-picker-v1.mjs
   npm run build
