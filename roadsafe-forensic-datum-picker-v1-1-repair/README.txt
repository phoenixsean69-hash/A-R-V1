RoadSafe AR — Forensic Datum Picker V1.1 Repair

Fixes the two TypeScript errors from V1:

1)
Type 'true' is not assignable to:
false | AttributionControlOptions | undefined

Repair:
Remove:
attributionControl: true

MapLibre will use its default attribution behavior.

2)
Property 'id' does not exist on type 'RealSceneGeometry'

Repair:
Change:
[selection?.id, geometry?.id]

to:
[selection?.id]

FILE
src/features/forensicReconstruction/ForensicDatumPicker.tsx

INSTALL
1. Extract this ZIP.
2. Copy roadsafe-forensic-datum-picker-v1-1-repair into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From the repo root:
   node .\roadsafe-forensic-datum-picker-v1-1-repair\repair-forensic-datum-picker-v1-1.mjs
   npm run build
