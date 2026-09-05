RoadSafe AR — Selected Area Workbench V2.1 Repair

Use this after V2 reports:

[RoadSafe] Could not locate selected-area analysis state.

Why V2 failed
The state existed, but V2 expected one exact whitespace/formatting layout in
AccidentMap.tsx. Your current RoadSafe file uses a different formatting layout.

V2.1
- Uses a format-tolerant regular expression to detect analysisError state.
- Validates all major patch anchors before writing project files.
- Reinstalls the SelectedAreaWorkbench payload.
- Reinstalls the filter-aware AreaAnalysisService.
- Replaces the compact selected-area card using stable JSX section boundaries.
- Adds the full Selected Area Workbench.
- Applies active date / severity / weather / cause filters to area analysis.
- Refreshes an open area analysis if filters change.
- Uses RoadSafe orange for the selected-area polygon.

Install
1. Extract this ZIP.
2. Copy roadsafe-selected-area-workbench-v2-1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From A-R-V1 root:
   node .\roadsafe-selected-area-workbench-v2-1\install-selected-area-workbench-v2-1.mjs
   npm run build

You do NOT need to run the failed V2 installer again.
