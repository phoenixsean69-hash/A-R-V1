RoadSafe AR — Junction Popup Exact Fix V1

This fixes the exact UI shown in the screenshot.

The white "4 / Accidents" card is created directly inside:
src/components/map/junctionMapLayer.ts

The file hard-coded:
card background = #f9fafb
card border = #e5e7eb

This repair changes the actual popup generator, not the full-analysis modal.

FIXES
- White stat cards -> #292929
- Stat values -> explicit #f1f5f9
- Stat labels -> #94a3b8
- Risk box -> #292929
- Popup shell -> #202020
- Heading -> readable light text
- Common cause/latest record values -> readable light text
- View Full Analysis button -> RoadSafe orange/dark
- Tiny MapLibre default close X -> 30x30 dark control
- Adds inset spacing so X does not overlap content
- Removes default white MapLibre popup triangle

FILE CHANGED
src/components/map/junctionMapLayer.ts

No risk calculations, junction data, analytics, or map marker behaviour are changed.

INSTALL
1. Extract this ZIP.
2. Copy roadsafe-junction-popup-exact-fix-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run:
   node .\roadsafe-junction-popup-exact-fix-v1\fix-junction-popup-exact-v1.mjs
   npm run build
