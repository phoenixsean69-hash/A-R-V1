RoadSafe AR — Analytics Analytical Workbench V1

Goal
Turn /analytics from a chart dashboard into an actual analytical workstation.

Current-repo findings that drove this refinement
- AnalyticsPage.tsx was mainly graphs, summary cards and raw junction ranking.
- WorkspaceDataService mostly grouped, counted, summed and sorted records.
- RiskAnalysisService already had a deterministic weighted risk score but AnalyticsPage did not use it.
- Accident records contain date, time, severity, fatalities, injuries,
  vehicles involved, cause, weather and junction ID.
- The accident register is explicitly prototype/demo data.
- The repo does not currently contain traffic volume / pedestrian exposure
  denominators, so a true exposure-adjusted crash rate cannot be calculated.

V1 adds
- Global analytical filters:
  junction, severity, cause, weather, from date, to date
- Analytical sample/data-sufficiency indicator
- Severe-outcome share
- Casualty intensity
- Severity index (Minor=1, Serious=3, Fatal=5)
- Average vehicles and 3+-vehicle involvement calculations
- Deterministic analytical findings (not AI)
- Comparable-period latest-year vs same prior-year period analysis
- Monthly all-crash vs serious/fatal trend
- Time-of-day concentration table
- Day-of-week diagnostic
- Cause frequency + severe-outcome rate + severe-rate uplift
- Cause × severity matrix
- Weather × severity matrix
- Junction weighted risk score
- Risk points per crash (risk intensity)
- Junction casualty intensity
- Repeated cause concentration per junction
- Peak time band per junction
- Priority classification
- Explicit data-quality / interpretation limits
- AI kept secondary to deterministic analytics

Visual direction
- Retains RoadSafe compact dark engineering UI
- Orange analytical focus instead of the previous blue-heavy dashboard look
- Charts remain supporting visuals, not the main output

Install
1. Extract the ZIP.
2. Copy roadsafe-analytics-workbench-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From the A-R-V1 root:
   node .\roadsafe-analytics-workbench-v1\install-analytics-workbench-v1.mjs
   npm run build

Files changed/added
- REPLACE: src/pages/AnalyticsPage.tsx
- ADD: src/services/analyticsAnalysisService.ts
