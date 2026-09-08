# RoadSafe AR UI Component Map

All top-level React UI implementations are centralised under src/components.

src/pages now contains route compatibility wrappers only. src/features/forensicReconstruction keeps forensic services/types plus UI compatibility wrappers.

## Shell

- WorkspaceHeader.tsx -- top workstation header
- layout/WorkspaceNavigation.tsx -- left navigation
- layout/WorkspaceRecentTabs.tsx -- recent/pinned workspace tabs
- layout/WorkspaceInspector.tsx -- right inspector
- layout/AppShell.tsx -- layout/state orchestration

## Component files

### (root)

- $(@{Group=(root); Relative=WorkspaceHeader.tsx; SizeKB=6.9}.Relative) -- 6.9 KB

### auth

- $(@{Group=auth; Relative=auth/AuthRoutes.tsx; SizeKB=4.9}.Relative) -- 4.9 KB

### cases

- $(@{Group=cases; Relative=cases/CaseCompletionChecklist.tsx; SizeKB=9.4}.Relative) -- 9.4 KB
- $(@{Group=cases; Relative=cases/CaseForm.tsx; SizeKB=7.4}.Relative) -- 7.4 KB
- $(@{Group=cases; Relative=cases/CaseStatusBadge.tsx; SizeKB=0.8}.Relative) -- 0.8 KB
- $(@{Group=cases; Relative=cases/DashboardCasesCard.tsx; SizeKB=1.8}.Relative) -- 1.8 KB
- $(@{Group=cases; Relative=cases/ForensicAreaMap.tsx; SizeKB=22.3}.Relative) -- 22.3 KB
- $(@{Group=cases; Relative=cases/ForensicCaseAreaWizard.tsx; SizeKB=47.2}.Relative) -- 47.2 KB
- $(@{Group=cases; Relative=cases/GoogleRoadLocationMap.tsx; SizeKB=19.6}.Relative) -- 19.6 KB
- $(@{Group=cases; Relative=cases/NewCaseRoadWizard.tsx; SizeKB=69.4}.Relative) -- 69.4 KB
- $(@{Group=cases; Relative=cases/RoadDetectionPreview.tsx; SizeKB=5.4}.Relative) -- 5.4 KB
- $(@{Group=cases; Relative=cases/RoadLocationMap.tsx; SizeKB=46.4}.Relative) -- 46.4 KB

### dashboard

- $(@{Group=dashboard; Relative=dashboard/DashboardHeader.tsx; SizeKB=0.3}.Relative) -- 0.3 KB
- $(@{Group=dashboard; Relative=dashboard/DashboardStats.tsx; SizeKB=0.8}.Relative) -- 0.8 KB
- $(@{Group=dashboard; Relative=dashboard/StatCard.tsx; SizeKB=0.3}.Relative) -- 0.3 KB

### fieldPlacement

- $(@{Group=fieldPlacement; Relative=fieldPlacement/FieldPlacementMap.tsx; SizeKB=16.9}.Relative) -- 16.9 KB
- $(@{Group=fieldPlacement; Relative=fieldPlacement/FieldPlacementPanel.tsx; SizeKB=53.2}.Relative) -- 53.2 KB
- $(@{Group=fieldPlacement; Relative=fieldPlacement/FieldSceneLivePreview.tsx; SizeKB=9.2}.Relative) -- 9.2 KB
- $(@{Group=fieldPlacement; Relative=fieldPlacement/GoogleFieldPlacementMap.tsx; SizeKB=23.8}.Relative) -- 23.8 KB
- $(@{Group=fieldPlacement; Relative=fieldPlacement/LocationAccuracyBadge.tsx; SizeKB=0.8}.Relative) -- 0.8 KB

### footage

- $(@{Group=footage; Relative=footage/CaseFootagePanel.tsx; SizeKB=18.8}.Relative) -- 18.8 KB
- $(@{Group=footage; Relative=footage/FootagePlayer.tsx; SizeKB=2.9}.Relative) -- 2.9 KB
- $(@{Group=footage; Relative=footage/ReconstructionRecorder.tsx; SizeKB=23.3}.Relative) -- 23.3 KB

### forensicReconstruction

- $(@{Group=forensicReconstruction; Relative=forensicReconstruction/FindingsWorkspace.tsx; SizeKB=20.1}.Relative) -- 20.1 KB
- $(@{Group=forensicReconstruction; Relative=forensicReconstruction/ForensicDatumPicker.tsx; SizeKB=26.2}.Relative) -- 26.2 KB
- $(@{Group=forensicReconstruction; Relative=forensicReconstruction/ForensicInvestigationWorkspace.tsx; SizeKB=194.5}.Relative) -- 194.5 KB
- $(@{Group=forensicReconstruction; Relative=forensicReconstruction/ForensicReconstructionWorkspace.tsx; SizeKB=36.4}.Relative) -- 36.4 KB
- $(@{Group=forensicReconstruction; Relative=forensicReconstruction/HypothesesWorkspace.tsx; SizeKB=23.9}.Relative) -- 23.9 KB
- $(@{Group=forensicReconstruction; Relative=forensicReconstruction/ReportWorkspace.tsx; SizeKB=13.2}.Relative) -- 13.2 KB
- $(@{Group=forensicReconstruction; Relative=forensicReconstruction/SimulationWorkspace.tsx; SizeKB=38.4}.Relative) -- 38.4 KB

### icons

- $(@{Group=icons; Relative=icons/materialIcons.tsx; SizeKB=10.6}.Relative) -- 10.6 KB

### layout

- $(@{Group=layout; Relative=layout/AppShell.tsx; SizeKB=11.4}.Relative) -- 11.4 KB
- $(@{Group=layout; Relative=layout/WorkspaceInspector.tsx; SizeKB=11.1}.Relative) -- 11.1 KB
- $(@{Group=layout; Relative=layout/WorkspaceNavigation.tsx; SizeKB=7.4}.Relative) -- 7.4 KB
- $(@{Group=layout; Relative=layout/WorkspaceRecentTabs.tsx; SizeKB=6.1}.Relative) -- 6.1 KB
- $(@{Group=layout; Relative=layout/WorkspaceRightPanelContext.tsx; SizeKB=0.6}.Relative) -- 0.6 KB

### map

- $(@{Group=map; Relative=map/AccidentMap.tsx; SizeKB=36.8}.Relative) -- 36.8 KB
- $(@{Group=map; Relative=map/AreaAnalysisResults.tsx; SizeKB=12.6}.Relative) -- 12.6 KB
- $(@{Group=map; Relative=map/HeatmapFilterPanel.tsx; SizeKB=8.4}.Relative) -- 8.4 KB
- $(@{Group=map; Relative=map/JunctionAnalysisModal.tsx; SizeKB=30.7}.Relative) -- 30.7 KB
- $(@{Group=map; Relative=map/JunctionQuickCard.tsx; SizeKB=6}.Relative) -- 6 KB
- $(@{Group=map; Relative=map/SelectedAreaWorkbench.tsx; SizeKB=25.3}.Relative) -- 25.3 KB

### officers

- $(@{Group=officers; Relative=officers/OfficerCreateFormChunk.tsx; SizeKB=4.7}.Relative) -- 4.7 KB
- $(@{Group=officers; Relative=officers/OfficerCredentialChunk.tsx; SizeKB=2.7}.Relative) -- 2.7 KB
- $(@{Group=officers; Relative=officers/OfficerDirectoryChunk.tsx; SizeKB=11.6}.Relative) -- 11.6 KB
- $(@{Group=officers; Relative=officers/OfficerManagementOverviewChunk.tsx; SizeKB=2.6}.Relative) -- 2.6 KB
- $(@{Group=officers; Relative=officers/OfficerStatusBannerChunk.tsx; SizeKB=0.5}.Relative) -- 0.5 KB

### pages

- $(@{Group=pages; Relative=pages/AccessPendingPage.tsx; SizeKB=3.4}.Relative) -- 3.4 KB
- $(@{Group=pages; Relative=pages/AccidentCaseFormPage.tsx; SizeKB=5.4}.Relative) -- 5.4 KB
- $(@{Group=pages; Relative=pages/AccidentCasePage.tsx; SizeKB=8.9}.Relative) -- 8.9 KB
- $(@{Group=pages; Relative=pages/AccidentCasesPage.tsx; SizeKB=22.5}.Relative) -- 22.5 KB
- $(@{Group=pages; Relative=pages/AccidentReconstructionPage.tsx; SizeKB=14}.Relative) -- 14 KB
- $(@{Group=pages; Relative=pages/AccidentReportPage.tsx; SizeKB=20.1}.Relative) -- 20.1 KB
- $(@{Group=pages; Relative=pages/AnalyticsPage.tsx; SizeKB=32.9}.Relative) -- 32.9 KB
- $(@{Group=pages; Relative=pages/CaseARReconstructionPage.tsx; SizeKB=3.6}.Relative) -- 3.6 KB
- $(@{Group=pages; Relative=pages/CaseCanonicalReconstructionPage.tsx; SizeKB=2.6}.Relative) -- 2.6 KB
- $(@{Group=pages; Relative=pages/CaseFootagePage.tsx; SizeKB=2}.Relative) -- 2 KB
- $(@{Group=pages; Relative=pages/CaseReconstructionPage.tsx; SizeKB=1.9}.Relative) -- 1.9 KB
- $(@{Group=pages; Relative=pages/ChangePasswordPage.tsx; SizeKB=7.8}.Relative) -- 7.8 KB
- $(@{Group=pages; Relative=pages/Dashboard.tsx; SizeKB=32.5}.Relative) -- 32.5 KB
- $(@{Group=pages; Relative=pages/EvidencePage.tsx; SizeKB=9.6}.Relative) -- 9.6 KB
- $(@{Group=pages; Relative=pages/FieldDashboardPage.tsx; SizeKB=6.3}.Relative) -- 6.3 KB
- $(@{Group=pages; Relative=pages/FootagePage.tsx; SizeKB=8.2}.Relative) -- 8.2 KB
- $(@{Group=pages; Relative=pages/FootagePlaybackPage.tsx; SizeKB=6.4}.Relative) -- 6.4 KB
- $(@{Group=pages; Relative=pages/LoginPage.tsx; SizeKB=8}.Relative) -- 8 KB
- $(@{Group=pages; Relative=pages/OfficerManagementPage.tsx; SizeKB=10.6}.Relative) -- 10.6 KB
- $(@{Group=pages; Relative=pages/ReportsPage.tsx; SizeKB=9.4}.Relative) -- 9.4 KB
- $(@{Group=pages; Relative=pages/SceneMapPage.tsx; SizeKB=24.1}.Relative) -- 24.1 KB
- $(@{Group=pages; Relative=pages/SettingsPage.tsx; SizeKB=5.1}.Relative) -- 5.1 KB
- $(@{Group=pages; Relative=pages/UnauthorizedPage.tsx; SizeKB=1.1}.Relative) -- 1.1 KB

### reconstruction

- $(@{Group=reconstruction; Relative=reconstruction/AccidentReconstructionEditor.tsx; SizeKB=272}.Relative) -- 272 KB
- $(@{Group=reconstruction; Relative=reconstruction/AccidentTimeline.tsx; SizeKB=32.5}.Relative) -- 32.5 KB
- $(@{Group=reconstruction; Relative=reconstruction/ar/ARReconstructionViewer.tsx; SizeKB=68.1}.Relative) -- 68.1 KB
- $(@{Group=reconstruction; Relative=reconstruction/BufferedCommitInput.tsx; SizeKB=4.4}.Relative) -- 4.4 KB
- $(@{Group=reconstruction; Relative=reconstruction/CollisionSetupPanel.tsx; SizeKB=10.1}.Relative) -- 10.1 KB
- $(@{Group=reconstruction; Relative=reconstruction/EvidenceMarkerLayer.tsx; SizeKB=1.5}.Relative) -- 1.5 KB
- $(@{Group=reconstruction; Relative=reconstruction/EvidenceWorkspace.tsx; SizeKB=45.9}.Relative) -- 45.9 KB
- $(@{Group=reconstruction; Relative=reconstruction/ForensicScenePreview.tsx; SizeKB=7.9}.Relative) -- 7.9 KB
- $(@{Group=reconstruction; Relative=reconstruction/GoogleReconstructionBasemap.tsx; SizeKB=4}.Relative) -- 4 KB
- $(@{Group=reconstruction; Relative=reconstruction/KinematicsSummaryPanel.tsx; SizeKB=8.5}.Relative) -- 8.5 KB
- $(@{Group=reconstruction; Relative=reconstruction/MeasurementLayer.tsx; SizeKB=4.4}.Relative) -- 4.4 KB
- $(@{Group=reconstruction; Relative=reconstruction/Participant2DModel.tsx; SizeKB=23.5}.Relative) -- 23.5 KB
- $(@{Group=reconstruction; Relative=reconstruction/ParticipantAssetPreview3D.tsx; SizeKB=4.6}.Relative) -- 4.6 KB
- $(@{Group=reconstruction; Relative=reconstruction/ParticipantPathPanel.tsx; SizeKB=60.8}.Relative) -- 60.8 KB
- $(@{Group=reconstruction; Relative=reconstruction/ParticipantPlacementOverlay.tsx; SizeKB=2}.Relative) -- 2 KB
- $(@{Group=reconstruction; Relative=reconstruction/PhotoConstraintWorkspace.tsx; SizeKB=26.8}.Relative) -- 26.8 KB
- $(@{Group=reconstruction; Relative=reconstruction/PhysicsControlsPanel.tsx; SizeKB=17.8}.Relative) -- 17.8 KB
- $(@{Group=reconstruction; Relative=reconstruction/RealSceneGeometryLayer.tsx; SizeKB=14.7}.Relative) -- 14.7 KB
- $(@{Group=reconstruction; Relative=reconstruction/Reconstruction3DViewer.tsx; SizeKB=86.2}.Relative) -- 86.2 KB
- $(@{Group=reconstruction; Relative=reconstruction/ReconstructionBasemap.tsx; SizeKB=2.4}.Relative) -- 2.4 KB
- $(@{Group=reconstruction; Relative=reconstruction/ReconstructionBottomDock.tsx; SizeKB=18.4}.Relative) -- 18.4 KB
- $(@{Group=reconstruction; Relative=reconstruction/ReconstructionGuide.tsx; SizeKB=5.5}.Relative) -- 5.5 KB
- $(@{Group=reconstruction; Relative=reconstruction/ReconstructionNodeEditor.tsx; SizeKB=52.3}.Relative) -- 52.3 KB
- $(@{Group=reconstruction; Relative=reconstruction/ReconstructionPhysicsContextEditor.tsx; SizeKB=20.9}.Relative) -- 20.9 KB
- $(@{Group=reconstruction; Relative=reconstruction/ReconstructionScenarioWorkspace.tsx; SizeKB=11.2}.Relative) -- 11.2 KB
- $(@{Group=reconstruction; Relative=reconstruction/ReconstructionTimelineDock.tsx; SizeKB=11.1}.Relative) -- 11.1 KB
- $(@{Group=reconstruction; Relative=reconstruction/ReconstructionValidationPanel.tsx; SizeKB=9.5}.Relative) -- 9.5 KB
- $(@{Group=reconstruction; Relative=reconstruction/RoadSceneEnvironment.tsx; SizeKB=14.9}.Relative) -- 14.9 KB
- $(@{Group=reconstruction; Relative=reconstruction/SceneCollectionAssetBrowser.tsx; SizeKB=35.2}.Relative) -- 35.2 KB
- $(@{Group=reconstruction; Relative=reconstruction/SceneObjectPalette.tsx; SizeKB=8.8}.Relative) -- 8.8 KB
- $(@{Group=reconstruction; Relative=reconstruction/SceneObjectRenderer.tsx; SizeKB=10.8}.Relative) -- 10.8 KB
- $(@{Group=reconstruction; Relative=reconstruction/SceneObjectSettingsPanel.tsx; SizeKB=23.1}.Relative) -- 23.1 KB
- $(@{Group=reconstruction; Relative=reconstruction/SceneSettingsPanel.tsx; SizeKB=15.2}.Relative) -- 15.2 KB
- $(@{Group=reconstruction; Relative=reconstruction/TransformGizmo2D.tsx; SizeKB=10.4}.Relative) -- 10.4 KB

## Largest composite UI files

These are already component files, but they remain the next candidates for deeper panel-by-panel extraction:

- $(@{Group=reconstruction; Relative=reconstruction/AccidentReconstructionEditor.tsx; SizeKB=272}.Relative) -- 272 KB
- $(@{Group=forensicReconstruction; Relative=forensicReconstruction/ForensicInvestigationWorkspace.tsx; SizeKB=194.5}.Relative) -- 194.5 KB
- $(@{Group=reconstruction; Relative=reconstruction/Reconstruction3DViewer.tsx; SizeKB=86.2}.Relative) -- 86.2 KB
- $(@{Group=cases; Relative=cases/NewCaseRoadWizard.tsx; SizeKB=69.4}.Relative) -- 69.4 KB
- $(@{Group=reconstruction; Relative=reconstruction/ar/ARReconstructionViewer.tsx; SizeKB=68.1}.Relative) -- 68.1 KB
- $(@{Group=reconstruction; Relative=reconstruction/ParticipantPathPanel.tsx; SizeKB=60.8}.Relative) -- 60.8 KB
- $(@{Group=fieldPlacement; Relative=fieldPlacement/FieldPlacementPanel.tsx; SizeKB=53.2}.Relative) -- 53.2 KB
- $(@{Group=reconstruction; Relative=reconstruction/ReconstructionNodeEditor.tsx; SizeKB=52.3}.Relative) -- 52.3 KB
- $(@{Group=cases; Relative=cases/ForensicCaseAreaWizard.tsx; SizeKB=47.2}.Relative) -- 47.2 KB
- $(@{Group=cases; Relative=cases/RoadLocationMap.tsx; SizeKB=46.4}.Relative) -- 46.4 KB
- $(@{Group=reconstruction; Relative=reconstruction/EvidenceWorkspace.tsx; SizeKB=45.9}.Relative) -- 45.9 KB
- $(@{Group=forensicReconstruction; Relative=forensicReconstruction/SimulationWorkspace.tsx; SizeKB=38.4}.Relative) -- 38.4 KB
