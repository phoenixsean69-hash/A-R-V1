
RoadSafe AR — GNSS Reconstruction Background Fix V1

Problem
The small right-side GNSS panel is correct, but opening it adds a gray/dim
fullscreen layer over the /reconstruction page.

Fix
Remove the fullscreen backdrop entirely.

Result
- /reconstruction stays visible exactly as normal
- no gray overlay
- no dark wash
- no page tint
- only the 360px right-side GNSS panel appears
- close using X or Cancel

File patched
src/features/forensicReconstruction/ForensicDatumPicker.tsx

Install
1. Extract this ZIP.
2. Copy roadsafe-forensic-gnss-transparent-bg-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run:
   node .\roadsafe-forensic-gnss-transparent-bg-v1\fix-forensic-gnss-transparent-bg-v1.mjs
   npm run build
