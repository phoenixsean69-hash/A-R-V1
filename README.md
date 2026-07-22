# RoadSafe AR

RoadSafe AR is a React and TypeScript prototype for accident case management, road-risk analysis, 2D/3D crash reconstruction, physics-assisted replay, evidence recording and future augmented-reality scene placement.

## Current Status

**Development stage:** Advanced functional prototype

The strongest implemented areas are:

- Accident case creation and management.
- Road-layout and junction visualisation.
- Interactive 2D reconstruction.
- Interactive Three.js 3D reconstruction.
- Lightweight procedural models for vehicles, cyclists and people.
- Earliest-contact collision detection.
- Post-impact movement, yaw, friction and stopping.
- Evidence markers and measurements.
- GPS-assisted field placement.
- Reconstruction validation and scenario comparison.
- Report and footage workflows.

The main unfinished areas are:

- Central backend persistence and authentication.
- Real camera-based augmented reality.
- Full continuous detection for every secondary collision.
- Complete 3D Play and automatic-physics integration.
- Automated tests and remaining lint corrections.

See the full [project progress report](docs/PROGRESS_REPORT.md).

## Technology Stack

- React 19
- TypeScript 6
- Vite 8
- React Router
- Tailwind CSS
- Three.js
- MapLibre GL
- Chart.js
- AR.js
- Supabase client

## Main Features

### Accident case management

- Structured case numbering.
- Accident date, time and location.
- Investigating officer and police-station records.
- Case status tracking.
- Linked reconstructions, reports and footage.

### 2D reconstruction

- Road-scene configuration.
- Participant path authoring.
- Collision-point setup.
- Scene objects and hazards.
- Evidence markers.
- Measurements.
- Timeline playback.
- Physics controls.

### 3D reconstruction

- Cars, buses and trucks.
- Motorcycles and bicycles.
- Pedestrians, witnesses and officers.
- Multiple camera views.
- Post-impact launch, fall, yaw and deformation effects.
- Shared participant paths and physics results.

### Physics preview

- Earliest physical-contact detection.
- Participant mass and restitution.
- Collision impulses and estimated energy.
- Friction and braking deceleration.
- Deflection and ricochet.
- Natural stopping positions.
- Interaction with barriers, trees, parked vehicles, potholes and low-grip surfaces.

> The physics module is an investigative visualisation aid. It is not yet a certified forensic crash-analysis engine.

## Getting Started

### Requirements

- Node.js
- npm

### Installation

```bash
npm install
```

### Development server

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Application Routes

- `/` — Dashboard
- `/cases` — Accident cases
- `/cases/new` — Create a case
- `/cases/:caseId` — Case details
- `/cases/:caseId/edit` — Edit a case
- `/cases/:caseId/reconstruction` — Case reconstruction
- `/cases/:caseId/report` — Case report
- `/cases/:caseId/footage` — Saved footage
- `/reconstruction` — Standalone reconstruction workspace

## Project Structure

```text
src/
├── components/
│   ├── cases/
│   ├── fieldPlacement/
│   ├── footage/
│   ├── map/
│   └── reconstruction/
├── data/
├── hooks/
├── pages/
├── routes/
├── services/
├── types/
└── utils/
```

Important files include:

- `src/components/reconstruction/AccidentReconstructionEditor.tsx`
- `src/components/reconstruction/Reconstruction3DViewer.tsx`
- `src/services/reconstructionPhysicsService.ts`
- `src/services/accidentCaseService.ts`
- `src/services/roadLayoutDetectionService.ts`
- `src/types/reconstruction.ts`

## Data Storage

The current prototype primarily uses browser storage:

- `localStorage` for cases, reconstructions and related metadata.
- IndexedDB for recorded footage blobs.

Supabase is installed but has not yet been connected to the application.

## Development Roadmap

### Milestone 1 — Reconstruction engine stabilisation

- Connect 3D Play to automatic physics preparation.
- Add swept detection for all secondary collisions.
- Add swept participant-to-object detection.
- Keep 2D and 3D on one simulation timeline.
- Fix remaining TypeScript and ESLint problems.
- Add collision scenario tests.

### Milestone 2 — Backend and users

- Supabase configuration.
- Authentication.
- Investigator and administrator roles.
- Cloud case storage.
- Evidence upload.
- Multi-device synchronisation.

### Milestone 3 — Augmented reality

- Camera-based AR viewer.
- Real-world scene anchoring.
- Field calibration.
- On-site overlays.
- Device testing and performance optimisation.

## Documentation

- [Progress Report](docs/PROGRESS_REPORT.md)

## Repository

`phoenixsean69-hash/A-R-V1`
