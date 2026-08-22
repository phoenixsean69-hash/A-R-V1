RoadSafe AR — Saira Force V2

This patch does NOT contain or redistribute font files.

Prerequisite
The original Saira installer must already have copied your uploaded Saira files into:

  public/fonts/saira/
  src/styles/saira.css

Install
1. Copy install-saira-force-v2.mjs into:
   C:\Users\nooklyweb\Desktop\A-R-V1

2. Open PowerShell in that folder.

3. Run:
   node .\install-saira-force-v2.mjs

4. Stop any running Vite server with Ctrl+C.

5. Start it again:
   npm run dev

6. In the browser press:
   Ctrl+Shift+R

Verification
Open the browser DevTools Console and run:

  getComputedStyle(document.body).fontFamily

It should begin with:
  "Saira"

For a bold element:
  getComputedStyle(document.querySelector("strong")).fontWeight

Typical bold output should be:
  700

The CSS maps font-weight values to the Saira @font-face files already installed
from your uploaded font package.
