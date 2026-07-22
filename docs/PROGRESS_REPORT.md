# RoadSafe AR Project Progress Report

**Project:** RoadSafe AR — Accident Reconstruction and Road Safety Analysis System  
**Repository:** `phoenixsean69-hash/A-R-V1`  
**Report date:** 22 July 2026  
**Current phase:** Advanced functional prototype

## 1. Executive Summary

RoadSafe AR has progressed from a basic road-safety visualisation concept into a broad accident investigation and reconstruction prototype.

The system currently supports:

- Accident case creation and management.
- Junction and road-risk visualisation.
- 2D accident scene reconstruction.
- Interactive 3D accident replay.
- Multiple road-user types, including vehicles, pedestrians and cyclists.
- Physics-assisted collision simulation.
- Evidence, measurements and scene-object placement.
- GPS-assisted field placement.
- Reconstruction validation and scenario comparison.
- Report and footage generation.

The project is now under version control and hosted on GitHub. It is best described as an **advanced prototype**, rather than a production-ready forensic system. The reconstruction workspace and visual simulation are well developed, but backend integration, real camera-based AR, comprehensive testing and final code-quality corrections remain outstanding.

## 2. Project Purpose

RoadSafe AR is intended to help traffic investigators, law-enforcement officers and road-safety planners:

1. Record and manage road accident cases.
2. Identify dangerous road sections and accident blackspots.
3. Reconstruct accident scenes using measurable participant paths.
4. Simulate collisions in both 2D and 3D.
5. Visualise vehicle, pedestrian and cyclist behaviour before and after impact.
6. Record evidence, scene measurements and environmental conditions.
7. Produce reconstruction reports and replay footage.
8. Eventually place reconstruction information over a real accident location using augmented reality.

## 3. Technical Foundation

The application is built with:

- React 19.
- TypeScript 6.
- Vite 8.
- React Router.
- Tailwind CSS.
- Three.js.
- MapLibre GL.
- Chart.js.
- AR.js.
- Supabase client libraries.

Three.js provides the 3D reconstruction environment, while MapLibre supports map-based accident and road-risk visualisation. AR.js and Supabase are installed as dependencies, although their full application features are not yet implemented.

## 4. Application Navigation and Case Workflow

The main application currently includes routes for:

- Dashboard.
- Accident cases.
- New accident case creation.
- Individual case details.
- Case editing.
- Case reconstruction.
- Case reports.
- Saved reconstruction footage.
- Footage playback.
- Standalone reconstruction workspace.

### Current case-management capabilities

The system can:

- Generate structured case numbers.
- Store accident dates and times.
- Record accident locations.
- Assign investigating officers and police stations.
- Track case status.
- Link a case to a reconstruction.
- Link recorded footage to a case.
- Attach road-layout detection data.
- Create a default reconstruction automatically for a new case.

Case information is presently stored in browser `localStorage`.

New cases automatically receive an empty reconstruction containing scene settings, a collision point, participants, scene objects, measurements, evidence, photos and field-placement data.

## 5. Accident Reconstruction Workspace

The reconstruction editor is currently the largest and most developed part of the system.

It integrates:

- Participant path editing.
- Scene settings.
- Collision setup.
- Physics controls.
- Scene-object placement.
- Evidence markers.
- Evidence records.
- Measurements.
- Field GPS placement.
- Recording.
- Validation.
- Reconstruction guidance.
- Scenario comparison.
- 2D and 3D viewing.

### Supported scene participants

The reconstruction supports:

- Cars.
- Buses.
- Trucks.
- Motorcycles.
- Bicycles.
- Pedestrians.
- Police officers.
- Witnesses.

Each participant can have:

- A movement path.
- Timed path points.
- Estimated speed.
- Rotation and direction.
- Collision behaviour.
- Physics properties.
- Pre-impact and post-impact states.

The editor validates that a reconstruction has a title, case identifier, participants, confirmed collision point and sufficient movement-path points before it is saved.

## 6. 2D and 3D View Improvements

### 6.1 Simple view toggle

A plain 2D/3D selector has been added.

When the user changes views:

- Existing 2D playback is stopped.
- Only the selected view is shown.
- The 2D editing workspace is hidden while 3D is active.
- The 3D viewer is loaded only when required.

### 6.2 More detailed lightweight models

The original dummy participants were replaced with more recognisable procedural models.

The system constructs participants from lightweight Three.js geometry rather than importing large external 3D files. It includes separate proportions and structures for buses, trucks, motorcycles, bicycles, humans and ordinary cars.

The 3D viewer includes:

- Human body parts and officer details.
- Bicycle and motorcycle frames.
- Wheels.
- Vehicle lights.
- Windows.
- Bus body structures.
- Truck cabins and loading sections.
- Participant labels.

This approach provides greater visual detail without substantially increasing memory or download requirements.

### 6.3 Post-collision participant reactions

Post-impact behaviour has been added to the 3D scene.

Humans can:

- Be launched upward.
- Rotate while airborne.
- Fall to the ground.
- Bounce slightly after landing.
- Settle into a final position.

Bicycles and motorcycles can:

- Fall sideways.
- Rebound after impact.
- Rotate.
- Visually deform.
- Display wheel displacement.

Cars and heavier vehicles can:

- Recoil.
- Rotate.
- Deflect.
- Compress slightly after impact.
- Settle after the collision.

These reactions are calculated from impact timing and estimated impact speed.

## 7. Physics Simulation Progress

### 7.1 Earliest-contact detection

The simulation no longer depends entirely on the manually marked collision point.

It checks participant movement over small time intervals and determines the point of closest approach between moving bodies. If their combined collision areas overlap, the system records that time as the earliest physical contact.

The calculation interpolates the contact time and the positions of both participants, producing a calculated physical collision point.

This means participants can collide:

- Before reaching the investigator's marked impact point.
- While crossing each other's routes.
- At high speed between ordinary playback positions.

The manually placed collision point is therefore becoming an investigator reference rather than an artificial trigger that forces participants to ignore earlier contact.

### 7.2 Participant physics profiles

Different physics properties are assigned to different road users.

The profiles include:

- Mass.
- Collision radius.
- Restitution.
- Rolling friction.
- Lateral grip.
- Braking deceleration.

For example, buses and trucks have substantially greater mass and lower restitution, while pedestrians, bicycles and motorcycles have lighter profiles and different friction behaviour.

### 7.3 Collision response

The physics engine currently calculates:

- Relative velocity.
- Collision normal.
- Reduced mass.
- Estimated impact energy.
- Collision impulse.
- Resulting participant velocities.
- Deflection.
- Ricochet.
- Angular velocity and yaw.
- Friction-based deceleration.
- Natural stopping positions.

The system also calculates different yaw responses according to approach angle, speed and participant mass.

### 7.4 Environmental interactions

The engine recognises interactions with:

- Road barriers.
- Guardrails.
- Walls.
- Fences.
- Trees.
- Street lights.
- Traffic lights.
- Parked vehicles.
- Potholes.
- Oil spills.
- Gravel.
- Puddles.

Potholes can produce speed loss and deflection. Low-grip surfaces can reduce friction, while solid objects can cause impact and ricochet behaviour.

## 8. Reports, Evidence and Footage

The project has modules for:

- Evidence marker placement.
- Evidence-record management.
- Scene photographs.
- Distance measurements.
- Timeline events.
- Reconstruction validation.
- Alternative reconstruction scenarios.
- Reconstruction recording.
- Saved footage playback.
- Accident report viewing.

Before recording footage, the editor can apply the selected physics configuration, save the prepared reconstruction and associate the result with the relevant case.

## 9. Repository and Version-Control Progress

The project has successfully been moved into GitHub.

### Completed

- Git was configured.
- The project files were staged.
- An initial commit was created.
- The `main` branch was established.
- The files were pushed to `phoenixsean69-hash/A-R-V1`.
- The repository is accessible through the connected GitHub integration.

### Recommended commit structure going forward

Future changes should be separated into focused commits such as:

- `Fix reconstruction lint errors`
- `Add swept secondary collision detection`
- `Connect 3D Play to automatic physics`
- `Implement Supabase persistence`
- `Add camera AR scene placement`

This will make errors easier to trace and future development easier to manage.

## 10. Current Limitations

### 10.1 Backend integration is not implemented

Although the Supabase package is installed, the current `supabase.ts` service file is empty.

Cases and much of the reconstruction information are therefore stored locally in the browser. This means:

- Records are tied to one browser and device.
- Clearing browser data may remove records.
- Multiple investigators cannot yet share case information.
- Authentication and user roles are not available.
- Central backup and synchronisation are not available.

### 10.2 Actual augmented reality is not implemented

The current system contains strong 2D and 3D reconstruction functionality, but the camera-based AR viewer remains an empty placeholder.

At present, RoadSafe AR is therefore primarily a reconstruction and road-analysis prototype rather than a complete augmented-reality application.

### 10.3 Secondary collision detection still needs strengthening

The earliest primary participant collision uses continuous swept contact detection.

However, later post-impact participant collisions are still mainly checked at simulation-step positions. This may allow a very fast participant to pass another participant between two post-impact simulation steps.

The next physics upgrade should apply swept collision detection to:

- Secondary participant collisions.
- Participant-to-object collisions.
- Moving participant paths after the primary impact.

### 10.4 3D Play and physics are not fully unified

The 3D viewer still presents separate **Run physics** and **Play** controls.

The desired final behaviour is:

1. The user presses Play.
2. The editor checks whether the scene has changed.
3. Physics is regenerated automatically when necessary.
4. Playback starts from the updated shared timeline.

### 10.5 Testing and code-quality work remains

Outstanding work includes:

- React effect corrections.
- Hook dependency corrections.
- Safe ref usage.
- Function declaration ordering.
- Render-purity corrections.
- A clean production build.
- A clean lint run.
- Automated physics tests.

## 11. Overall Progress Assessment

### Research and concept definition

**Status: Strong**

The problem, users, proposed solution and accident-reconstruction workflow are well defined.

### User interface and workflow

**Status: Advanced prototype**

The application has a dashboard, case workflow, reconstruction editor, 2D/3D views, reporting and footage screens.

### 2D reconstruction

**Status: Advanced prototype**

Participants, paths, evidence, measurements, collision points, scene settings and physics controls are implemented.

### 3D reconstruction

**Status: Functional prototype**

Detailed lightweight participants, multiple camera views, paths, evidence and post-impact animation are present.

### Physics simulation

**Status: Functional but still being refined**

Primary continuous contact, impulse response, friction, yaw and object interactions are implemented. Secondary continuous contact needs further work.

### Backend and collaboration

**Status: Not implemented**

The application currently relies heavily on browser storage.

### True augmented reality

**Status: Not implemented**

The camera-based AR module remains a placeholder.

### Production readiness

**Status: Early**

Testing, backend integration, documentation, security, deployment and forensic validation are still required.

## 12. Recommended Next Milestone

# Reconstruction Engine Stabilisation

This milestone should include:

1. Connecting the 3D Play button directly to automatic physics preparation.
2. Adding swept detection to all secondary participant collisions.
3. Adding swept participant-to-object collision detection.
4. Ensuring 2D and 3D consume one identical simulation timeline.
5. Fixing TypeScript and ESLint issues.
6. Running a clean production build.
7. Testing:
   - Head-on collision.
   - Rear-end collision.
   - Side-impact collision.
   - Pedestrian collision.
   - Bicycle collision.
   - Motorcycle collision.
   - Vehicle-to-barrier collision.
   - Multiple-participant collision.

After this milestone, development should move to backend persistence and then real camera-based AR.

## 13. Conclusion

RoadSafe AR has made substantial progress.

The project now goes beyond a visual demonstration and provides a broad accident case-management and reconstruction environment. Its strongest areas are the reconstruction editor, participant-path system, procedural 3D scene, post-impact animation and developing physics engine.

The immediate objective is no longer to add many unrelated features. The priority should be to stabilise the existing reconstruction engine, ensure that both views reproduce the same physical event, eliminate code-quality problems and establish reliable test cases.

Once this foundation is stable, the project will be ready for central data storage, multi-user access and real augmented-reality scene placement.
