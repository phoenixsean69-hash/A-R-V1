RoadSafe AR — Investigation Details Theme Fix V1

Fixes the dark-blue / unreadable values shown under:

INVESTIGATION DETAILS
- Officer
- Police station
- Junction ID
- Reconstruction ID

Cause:
Those values used Tailwind text-slate-300, which is a dark light-theme colour.

New styling:
- Officer / Police station: text-slate-300
- Junction ID / Reconstruction ID: text-slate-400 + font-mono
- Labels remain muted slate

File changed:
src/pages/AccidentCasePage.tsx

Install:
1. Extract this ZIP.
2. Copy roadsafe-investigation-details-theme-fix-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run:
   node .\roadsafe-investigation-details-theme-fix-v1\fix-investigation-details-theme-v1.mjs
   npm run build
