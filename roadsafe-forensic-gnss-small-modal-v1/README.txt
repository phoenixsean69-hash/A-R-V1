
RoadSafe AR — Forensic GNSS Small Modal V1

Purpose
Open the "Set reference point" workflow as a small centered modal,
not a full-screen overlay.

What changes
- fullscreen modal removed
- compact centered modal added
- max width ~1120px
- max height ~80vh with internal scroll
- same GNSS capture logic preserved

What does not change
- live location workflow
- GNSS multi-sample capture
- saved datum fields
- Scene Intake integration

File replaced
src/features/forensicReconstruction/ForensicDatumPicker.tsx

Install
1. Extract the ZIP.
2. Copy roadsafe-forensic-gnss-small-modal-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run:
   node .\roadsafe-forensic-gnss-small-modal-v1\install-forensic-gnss-small-modal-v1.mjs
   npm run build
