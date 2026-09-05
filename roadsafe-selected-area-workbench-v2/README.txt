RoadSafe AR — Selected Area Workbench V2

This upgrades the selected-area tool in /scene-map.

The compact on-map card becomes a useful summary plus launcher:
- crashes
- severe share
- casualties
- area km²
- crashes/km²
- average risk
- top risk junction
- dominant cause
- peak time
- filtered-network crash share
- Workbench
- Export CSV
- Copy analytical brief
- Select again
- Clear area

The full Selected Area Workbench adds:
- filtered crashes
- severe-outcome share
- casualty intensity
- descriptive density
- highest risk contributor
- dominant cause
- peak time
- severity distribution
- cause diagnostic
- weather diagnostic
- time-of-day diagnostic
- junction risk contribution table
- area-vs-filtered-network comparison
- area width / height / centre
- north / south / east / west bounds
- export selected-area CSV
- copy centre
- copy bounds
- copy analytical brief
- draw another area

Correctness:
Selected-area analysis uses the same active date, severity, weather and cause
filters as the heatmap.

Important:
Current accident records are linked to junction IDs rather than exact crash
GPS coordinates. A crash is treated as inside the selected rectangle when
its monitored junction coordinate lies inside it.

Crashes/km² is descriptive spatial density only, not an exposure-adjusted
crash rate.

FILES
ADD
src/components/map/SelectedAreaWorkbench.tsx

REPLACE
src/services/areaAnalysisService.ts

PATCH
src/components/map/AccidentMap.tsx

INSTALL
1. Extract the ZIP.
2. Copy roadsafe-selected-area-workbench-v2 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From repo root:
   node .\roadsafe-selected-area-workbench-v2\install-selected-area-workbench-v2.mjs
   npm run build
