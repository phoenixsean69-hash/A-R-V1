RoadSafe AR — Scene Map Spatial Intelligence V1

Purpose
Upgrade /scene-map from a map + summary page into a spatial-analysis workstation.

Current-repo issues addressed
1. Selected-area analysis ignored the active map filters.
   The heatmap could show a filtered sample while Analyse Area silently used
   the full accident register.

2. Selected-area results were mainly:
   junction count, crash count, fatalities, injuries and basic risk distribution.

3. The current map page had useful risk lists and incident filters, but little
   analysis of geographic concentration or junction contribution.

4. The accident schema stores junction ID, not exact crash GPS coordinates.
   The new UI states this limitation explicitly.

V1 adds
- Selected-area analysis uses current date/severity/weather/cause filters
- Selected-area analysis refreshes when filters change
- Filtered severe-outcome share
- Casualty intensity
- Descriptive crashes/km² for selected rectangle
- Dominant cause in selection
- Peak time band in selection
- Highest filtered-risk junction in selection
- Selection share of the current map sample
- Dark RoadSafe selected-area analytical UI
- Spatial concentration index
- Top-junction crash concentration
- Top-two-junction crash concentration
- Weighted-risk concentration
- Approximate affected-junction network span
- Junction-weighted crash centroid
- Deterministic spatial findings
- Filtered junction contribution table
- Per-junction:
  crash share
  severe rate
  casualties/crash
  filtered risk score
  filtered risk contribution
  recurring cause
  peak time band
  operational review priority

Interpretation guardrails
- Current accident records are junction-linked, not exact crash GPS points.
- Selected area membership is therefore based on the junction coordinate.
- Crashes/km² is descriptive spatial density only.
- No traffic-volume/pedestrian-exposure denominator exists, so no true
  exposure-adjusted crash rate is claimed.
- Marker mode remains the complete historical junction-risk register.
- Heatmap, page diagnostics and selected-area analytics follow active filters.

Files
ADD
src/services/sceneMapSpatialAnalysisService.ts

REPLACE
src/services/areaAnalysisService.ts
src/components/map/AreaAnalysisResults.tsx

PATCH
src/pages/SceneMapPage.tsx
src/components/map/AccidentMap.tsx

Install
1. Extract this ZIP.
2. Copy roadsafe-scene-map-spatial-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From A-R-V1 root:
   node .\roadsafe-scene-map-spatial-v1\install-scene-map-spatial-v1.mjs
   npm run build
