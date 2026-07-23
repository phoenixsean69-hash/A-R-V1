ROADSAFE: 2D DEFAULT + FULL 3D INSPECTOR SCROLL + SMOOTH PLAYBACK

Why this is an updater instead of full 4,700-line replacements
---------------------------------------------------------------
Your local project already contains UI, GPS, route-builder and participant updates
that may not yet be in GitHub. This updater changes only the required sections and
preserves the rest of your current local files.

Apply
-----
1. Extract this ZIP into the A-R-V1 project root.
2. In PowerShell, from the A-R-V1 project root, run:

   .\APPLY_UPDATE.ps1

   Or:

   node .\apply-update.mjs

3. Keep this running as usual:

   npm run dev

4. Refresh /reconstruction.

What changes
------------
- /reconstruction opens in 2D.
- Loading another reconstruction resets the workspace to 2D.
- The 3D Context Inspector gets its own full-height vertical scroll area.
- 2D playback paints on every animation frame instead of about 33 FPS.
- 3D reads the same live playback clock directly on every Three.js frame.
- Long/dropped frames are clamped, preventing sudden jumps.
- Live physics is not re-baked while playback is running.
- Existing collision, impact, deflection, sliding, rotation and natural-rest paths remain.

Safety
------
Before editing, the updater copies both modified TSX files into:

.roadsafe-backups/<timestamp>/
