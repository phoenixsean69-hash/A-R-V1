RoadSafe AR — Junction Modal Refresh V1

Purpose
Refresh the old UI for:
1. the compact junction brief
2. the “View Full Analysis” junction workspace

What changes
- Modern dark RoadSafe panel styling
- Cleaner compact junction brief
- Better header / chips / metrics
- Stronger visual hierarchy
- New quick situation section
- New deterministic findings section
- Cleaner full-analysis workspace
- Overview metrics
- Severity composition
- Time-pattern bars
- Monthly pattern bars
- Cause distribution
- Weather distribution
- Operational-context cards
- Recent accident records table

Notes
- Keeps the same component contract used by AccidentMap:
  junctionId
  onClose
- Recomputes score/risk deterministically from the accident records
- Does not depend on chart libraries

Files
REPLACE
src/components/map/JunctionAnalysisModal.tsx

Install
1. Extract this ZIP.
2. Copy roadsafe-junction-modal-refresh-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From A-R-V1 root:
   node .\roadsafe-junction-modal-refresh-v1\install-junction-modal-refresh-v1.mjs
   npm run build
