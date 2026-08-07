RoadSafe AR — SCREEN TIMELINE CENTRE-WIDTH FIX V1
====================================================

PROBLEM
-------
The standalone Screen Timeline component finally docked correctly to the
bottom, but it used:

  right: 0

so it continued underneath the right Properties panel.

The Timeline therefore occupied territory belonging to Properties.

CORRECT LAYOUT
--------------

  NAV |          CENTRE WORKSPACE          | PROPERTIES
      |                                    |
      |          2D / 3D / Nodes           |
      |                                    |
      |------------------------------------|
      |          TIMELINE                  |
      |------------------------------------|

The Timeline belongs ONLY to the centre workspace width.

FIX
---
ReconstructionTimelineDock now measures the actual:

  .roadsafe-workspace-context-slot

using getBoundingClientRect + ResizeObserver.

It writes:

  --rs-screen-properties-width

to the RoadSafe shell.

Timeline CSS becomes:

  left: navigation width
  right: var(--rs-screen-properties-width)
  bottom: 0

So its right edge always stops exactly at the left edge of Properties.

If the Properties panel width changes, Timeline automatically follows.

VERTICAL FIX
------------
Previously V5 shortened BOTH:
- roadsafe-center
- roadsafe-workspace-context-slot

above the Timeline.

That was necessary only while Timeline extended beneath Properties.

Now:
- centre workspace stops above Timeline;
- Properties keeps its full 100dvh height.

INSTALL
-------
cd C:\Users\nooklyweb\Desktop\A-R-V1

node .\install-screen-timeline-center-width-fix-v1.mjs

Then:

npm run dev

Optional:
npm run build

ROLLBACK
--------
node .\revoke-screen-timeline-center-width-fix-v1.mjs
