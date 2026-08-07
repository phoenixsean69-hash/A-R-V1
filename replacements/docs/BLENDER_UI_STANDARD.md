# RoadSafe AR Blender Workstation UI Standard

## Canonical reference

The **Station Overview → Context inspector → Active investigation** panel is the source of truth for every RoadSafe interface surface.

This standard applies to:

- application navigation and toolbars;
- dashboard cards and tables;
- case forms and wizards;
- maps and map controls;
- 2D, 3D and AR reconstruction views;
- right-side inspectors;
- playback and timeline panels;
- bottom drawers and node editors;
- modals, dialogs and evidence workspaces;
- objects, hazards and evidence palettes.

## Surface hierarchy

| Role | Value |
| --- | --- |
| Shell | `#1B1B1B` |
| Sidebar | `#242424` |
| Panel | `#292929` |
| Section | `#303030` |
| Section header | `#282828` |
| Raised/selected surface | `#383838` |
| Input | `#202020` |
| Border | `#171717` |
| Strong border | `#555555` |
| Primary text | `#DEDEDE` |
| Secondary text | `#C4C4C4` |
| Muted text | `#969696` |
| Interaction accent | `#E8872D` |

## Mandatory rules

1. Large blue, navy, indigo, cyan, purple or violet UI surfaces are prohibited.
2. Orange is used only for focus, selected rows, active tools and active node outlines.
3. Red is reserved for destructive actions, collision warnings and critical status.
4. Semantic case-data colours may remain on small vehicle swatches, chart lines, evidence markers and physical-scene objects.
5. Controls are compact, square or lightly rounded, and lightly bevelled.
6. Inputs are recessed charcoal fields with orange focus outlines.
7. Sliders use a gray track and orange thumb.
8. Right panels and bottom panels use the shared `workstation-panel`, `roadsafe-inspector` and `roadsafe-bottom-panel` structures.
9. Glassmorphism, broad blur, large shadows and oversized web-card rounding are prohibited.
10. All icons use Google Material Symbols.
11. 2D, 3D and AR views use the same visual language and canonical timeline.
12. New UI must pass `npm run ui:verify` before commit.

## Objects, hazards and evidence

The reconstruction palette behaves like a Blender Outliner:

- each tool is a checkbox row;
- every row has a Material icon;
- the active placement tool has an orange edge;
- placed counts appear as compact badges;
- checking a tool activates placement;
- checking it again stops placement;
- true object and vehicle colours remain data, not interface decoration.

## Reconstruction nodes

The node editor visualizes the canonical investigation flow:

`Case → Scene → Participants / Objects / Evidence → Collision → Physics → Output`

Nodes are draggable, zoomable and connected with Bezier links. Node selection synchronizes with participant and scene-object selection where applicable.
