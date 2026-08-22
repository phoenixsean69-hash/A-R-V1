RoadSafe AR — Forensic 2D / 3D / AR Reconstruction Screen V1

Purpose
This is the next screen after Simulation.

It activates:
  2D / 3D / AR

Core rule
One canonical reconstruction feeds all three views.

Flow
Evidence
→ Analysis
→ Hypotheses
→ Simulation
→ Canonical Reconstruction
→ 2D / 3D / AR

What is added
- Select a saved forensic simulation run
- Promote that run into the case-linked canonical AccidentReconstruction
- Preserve a canonical manifest containing:
  hypothesis ID/code
  simulation run ID/code
  reconstruction ID
  provenance
- Inline 2D trajectory preview with time scrubber
- Inline existing Three.js 3D viewer using the canonical reconstruction
- AR launch using the existing case AR route
- Dedicated full 2D / 3D canonical editor route:
  /cases/:caseId/reconstruction/canonical
- Source-integrity panel showing forensic inputs remain protected
- Canonical collision marker remains Derived and unconfirmed
- Existing reconstruction physics auto-run is disabled for the imported canonical path;
  physics changes belong back in Simulation

Important
The screen does not copy the forensic evidence database into simulation state.
Scene Intake, Evidence, Measurements, Vehicles, Persons, Witnesses, Analysis
and Hypotheses remain separate source records.

Install
1. Extract this ZIP.
2. Copy roadsafe-reconstruction-screen-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. From the A-R-V1 root run:
   node .\roadsafe-reconstruction-screen-v1\install-forensic-reconstruction-screen-v1.mjs
   npm run build

Prerequisite
Forensic Simulation V1 must already be installed.
