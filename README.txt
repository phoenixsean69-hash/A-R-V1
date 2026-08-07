RoadSafe AR — Blender-inspired UI style pass

This package changes only:
  src/styles/darkerTheme.css

Visual changes:
- neutral charcoal editor chrome;
- compact toolbars and navigation;
- lightly bevelled controls;
- squared panel and button corners;
- Blender-blue selection rows;
- orange focus and active-state markers;
- recessed inputs;
- dense inspector panels;
- Blender-like scrollbars;
- reduced card shadows and oversized web-app rounding.

Install from the A-R-V1 repository root:

  node install-roadsafe-blender-ui-style.mjs

The installer creates a timestamped backup and runs:

  npm run build

Then start RoadSafe:

  npm run dev
