RoadSafe AR — Analytics Workbench Fix V1.1

Fixes:
TS6133: 'neutral' is declared but its value is never read.

This repair only removes the unused constant from:
src/pages/AnalyticsPage.tsx

No analytics calculations or UI behaviour are changed.

Install:
1. Extract this ZIP.
2. Copy roadsafe-analytics-fix-v1-1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From the A-R-V1 root run:
   node .\roadsafe-analytics-fix-v1-1\fix-analytics-v1-1.mjs
   npm run build
