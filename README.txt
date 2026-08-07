RoadSafe AR — WORKSPACE HORIZONTAL TABS + COMPACT TYPE V1
================================================================

Two fixes for the Workspace, Evidence & Investigation right panel.

1. TYPOGRAPHY
-------------
The migrated investigation cards retained their old large page/card typography,
which looks oversized inside the narrow Blender Properties column.

This fix reduces ONLY Workspace/Investigation typography:

Large card title:
  12px

Descriptions:
  10px

Form labels:
  9.5px

Inputs / selects / buttons:
  10px

Read-only values:
  10.5px

Muted/helper text:
  9px

Normal Participant/Camera/Scene Properties typography is NOT changed.

2. HORIZONTAL SUB-TABS
----------------------
When Workspace & Investigation is active, a horizontal sticky navigator appears
at the top:

  Case
  Scene
  Objects
  Impact
  Physics
  Audit
  Hypotheses
  Evidence
  Notes

This horizontal bar exists ONLY inside Workspace & Investigation.

Clicking a tab scrolls directly to the matching EXISTING migrated card; it does
not duplicate any investigation component or data.

INSTALL
-------
cd C:\Users\nooklyweb\Desktop\A-R-V1

node .\install-workspace-horizontal-tabs-compact-type-v1.mjs

Then:

npm run dev

ROLLBACK
--------
node .\revoke-workspace-horizontal-tabs-compact-type-v1.mjs
