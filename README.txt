RoadSafe AR — FORENSIC MAP HYBRID + SEARCH V2
================================================

CHANGES
-------

1. HYBRID MAP

Previous Phase 1 Hybrid:
  Esri satellite imagery only.

New Hybrid:
  Esri World Imagery
      +
  Esri World Transportation reference
      +
  Esri World Boundaries and Places reference

This keeps the satellite background while restoring visible road/transport
reference information and city/place labels.

2. LOCATION SEARCH

The map now reuses:

  src/services/locationSearchService.ts

That service already uses OpenStreetMap Nominatim and scopes queries to
Zimbabwe.

Search accepts:
- road names;
- street names;
- cities;
- towns;
- junction/place names;
- landmarks supported by Nominatim.

Up to 7 search results are shown.

Selecting a result:
- moves the accident anchor to the returned coordinate;
- flies/fits the map to the returned place;
- clears the previous forensic core;
- tells the investigator to draw a new core around the actual crash scene.

The core is cleared deliberately. A search may jump hundreds of kilometres,
and RoadSafe must never retain a stale boundary from the old anchor.

INSTALL
-------

cd C:\Users\nooklyweb\Desktop\A-R-V1

node .\install-forensic-map-hybrid-search-v2.mjs

The installer runs:

npm run build

and restores the original map/CSS automatically if the build fails.

START / REFRESH
---------------

npm run dev

TEST
----

1. New Case -> Area.
2. Choose Hybrid.
3. Confirm satellite imagery is visible.
4. Zoom toward a city/road and confirm transport/place labels overlay it.
5. Search for a Zimbabwe city/road/place.
6. Select a result.
7. Confirm the map flies there.
8. Confirm the red accident anchor moves there.
9. Confirm any old forensic core is cleared.
10. Draw a new forensic core.

ROLLBACK
--------

node .\revoke-forensic-map-hybrid-search-v2.mjs


V2 BUILD FIX
------------
V1 reached the project TypeScript build but failed with TS1484 because
FormEvent was imported as a runtime value while verbatimModuleSyntax is
enabled.

V2 changes:

  import { FormEvent, ... } from "react";

to:

  import { ... } from "react";
  import type { FormEvent } from "react";

No hybrid/search behavior changed.
