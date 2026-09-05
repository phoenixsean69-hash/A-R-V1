RoadSafe AR — Custom Junction Quick Card V1

This rebuilds the junction-click interaction from scratch.

OLD FLOW
Marker
→ MapLibre Popup
→ hard-coded HTML
→ white popup shell
→ MapLibre tiny close button

NEW FLOW
Marker
→ emits junction ID
→ RoadSafe React quick card
→ View Full Analysis
→ existing full junction analysis modal

FILES
REPLACE
src/components/map/junctionMapLayer.ts

ADD
src/components/map/JunctionQuickCard.tsx

PATCH
src/components/map/AccidentMap.tsx

CUSTOM QUICK CARD
- Junction name
- City / road type
- Risk level
- Weighted score
- Accidents
- Fatalities
- Injuries
- Common cause
- Latest record
- Location note
- Proper 32px close button
- View Full Analysis

IMPORTANT
There is no MapLibre Popup for junction markers anymore.
No popup triangle.
No MapLibre close X.
No white popup shell.
No hard-coded popup content styles.

INSTALL
1. Extract this ZIP.
2. Copy roadsafe-custom-junction-quick-card-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run from repo root:
   node .\roadsafe-custom-junction-quick-card-v1\install-custom-junction-quick-card-v1.mjs
   npm run build
