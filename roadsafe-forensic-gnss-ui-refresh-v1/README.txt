
RoadSafe AR — Forensic GNSS UI Refresh V1

Purpose
Refresh the "Walk to the fixed reference point" UI only.

Why
The GNSS workflow logic is good, but the screen is too stretched, low-contrast,
and box-heavy.

What changes
- Cleaner modal hierarchy
- Better title/header
- Compact 4-step checklist
- Stronger live-location card
- Better metric/stat cards
- Clear capture call-to-action
- Cleaner right sidebar
- Improved readability and spacing
- Better contrast

What does NOT change
- GNSS workflow
- multi-sample capture
- accuracy storage
- case officer/source/method capture
- Scene Intake integration
- confirm/cancel behavior

File replaced
src/features/forensicReconstruction/ForensicDatumPicker.tsx

Install
1. Extract the ZIP.
2. Copy roadsafe-forensic-gnss-ui-refresh-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run:
   node .\roadsafe-forensic-gnss-ui-refresh-v1\install-forensic-gnss-ui-refresh-v1.mjs
   npm run build
