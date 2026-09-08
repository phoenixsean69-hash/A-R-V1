SOVEREIGN ACCIDENT RECONSTRUCTOR
Approved 3-Screen UI package
================================

WHAT THIS IS
------------
A drop-in replacement for:

    src\main.cpp

It implements the approved first-pass redesigns for:

    - Case View
    - Evidence
    - Analysis

The visual direction stays desktop-editor/workstation oriented:
Unreal / Unity / Microsoft professional tooling, not a web-dashboard look.

INSTALL TO YOUR REQUESTED FOLDER
--------------------------------
1. Extract the ZIP.
2. Open PowerShell at:

    PS C:\Users\nooklyweb\Desktop\A-R-V1>

3. Run the installer from the extracted package, for example:

    powershell -ExecutionPolicy Bypass -File "C:\path\to\sovereign_approved_ui\apply_approved_ui.ps1"

The script backs up your existing src\main.cpp first.

MANUAL OPTION
-------------
Copy the included:

    sovereign_approved_ui\src\main.cpp

to:

    C:\Users\nooklyweb\Desktop\A-R-V1\src\main.cpp

and replace the existing file.

ASSUMPTIONS
-----------
This file expects the same project structure as the current fixes branch,
including Dear ImGui docking, NanoSVG, GLFW, GLAD, and the existing assets.

The three redesigned screens use procedural ImGui-drawn icons, so they do not
need new image assets. The Viewport still uses the existing Blender SVG icons.

AFTER BUILDING
--------------
Send screenshots of Case View, Evidence and Analysis. The next pass should tune
spacing, density, field sizes and panel proportions against the real ImGui
render, not just the concept images.
