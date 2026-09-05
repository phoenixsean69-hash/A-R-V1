RoadSafe AR — Forensic GNSS Datum V2

This supersedes the manual map datum picker.

CORRECT WORKFLOW
1. Officer chooses a permanent reference feature.
2. Officer physically walks to that feature.
3. Officer enables live device location.
4. RoadSafe requests high-accuracy browser/device GNSS.
5. Officer stands still at the exact feature.
6. Officer presses:
   I AM AT THE REFERENCE POINT
7. RoadSafe collects multiple fresh GNSS fixes.
8. RoadSafe stores the averaged coordinate plus reported uncertainty.
9. Officer confirms the fixed reference point.

NO MAP CLICKING.

CAPTURE MODEL
- up to 8 fresh samples
- up to 12 second capture window
- inverse-accuracy weighted latitude/longitude
- median reported horizontal accuracy
- best accuracy
- worst accuracy
- optional altitude
- optional altitude accuracy
- sample count
- capture duration
- source timestamp
- confirmation timestamp
- investigating officer
- source = Browser Geolocation API
- method = Device GNSS - field captured

ACCURACY DISPLAY
<= 3 m   Very good
<= 5 m   Good
<= 10 m  Caution
> 10 m   Poor / recapture recommended

RoadSafe does not hide the GNSS uncertainty.

IMPORTANT FORENSIC RULE
The GNSS datum georeferences the scene.
Fine accident-scene measurements must still be captured with suitable measuring
equipment (tape, laser, total station, photogrammetry, etc.) and referenced to
this datum. A phone/browser GNSS reading is not treated as centimetre-precision
survey data.

BROWSER REQUIREMENTS
Live Geolocation requires:
- device/browser location services enabled
- permission granted to RoadSafe
- HTTPS or localhost secure context

On a desktop without actual GNSS hardware, the browser may return network-based
location with poor accuracy. The field workflow is intended for the officer's
GPS/GNSS-capable mobile/tablet device.

FILES
REPLACE
src/features/forensicReconstruction/ForensicDatumPicker.tsx

PATCH
src/features/forensicReconstruction/ForensicInvestigationWorkspace.tsx
src/features/forensicReconstruction/forensicInvestigationTypes.ts

INSTALL
1. Extract this ZIP.
2. Copy roadsafe-forensic-gnss-datum-v2 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run:
   node .\roadsafe-forensic-gnss-datum-v2\install-forensic-gnss-datum-v2.mjs
   npm run build
