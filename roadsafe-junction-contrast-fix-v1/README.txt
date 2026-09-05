RoadSafe AR — Junction Contrast Fix V1

Fixes the specific problem where junction analysis tiles have white/light
backgrounds while their text is also white/light and difficult to read.

The repair scans:
- src/components/map/JunctionAnalysisModal.tsx
- src/components/map/AccidentMap.tsx

but only modifies files that contain junction-analysis UI signals.

Changes include:
- bg-white / bg-gray-50 / bg-slate-50 -> #292929
- light gray surfaces -> #303030
- light borders -> RoadSafe #414141 / #494949
- old dark text utilities -> readable slate dark-theme equivalents
- light hover states -> dark hover states

No analytics calculations, risk scoring, map logic, or data are changed.

Install:
1. Extract this ZIP.
2. Copy roadsafe-junction-contrast-fix-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From the repo root run:
   node .\roadsafe-junction-contrast-fix-v1\fix-junction-contrast-v1.mjs
   npm run build
