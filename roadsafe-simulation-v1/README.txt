RoadSafe AR — Forensic Simulation V1

What this adds
- Activates Simulation after Hypotheses
- Requires a hypothesis marked "Send to simulation"
- Separate simulation-run persistence so simulations cannot contaminate evidence
- Participant mass, start position, speed, heading and collision-radius inputs
- Optional braking with reaction time and friction coefficient
- 2D plan playback / time scrubber
- Simplified circular-envelope contact detection
- Simplified normal impulse response using coefficient of restitution
- Momentum and kinetic-energy calculations
- Reaction and theoretical braking-distance screening
- Proposed impact-region comparison
- Saved run register
- Formulas, warnings and limitations audit trail
- Every run explicitly marked with provenance = Simulated

Important
Simulation V1 is a transparent scenario-testing engine. It does NOT model:
- body deformation
- detailed tyre forces
- steering changes
- suspension
- roll / yaw inertia
- crush energy
- full rigid-body vehicle geometry

Those limitations are shown inside every run.

Install
1. Extract this ZIP.
2. Copy roadsafe-simulation-v1 into:
   C:\Users\nooklyweb\Desktop\A-R-V1

3. Run from the A-R-V1 root:
   node .\roadsafe-simulation-v1\install-forensic-simulation-v1.mjs
   npm run build

Prerequisite
RoadSafe Forensic Hypotheses V1 must already be installed and building successfully.
