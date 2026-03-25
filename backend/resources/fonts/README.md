Font assets synced for backend text rendering live here.

Recommended workflow:

1. Keep the upstream catalog JSON at `resources/fonts/catalog/fonts.json`
2. Run `npm run sync:fonts -- --source "<path-to-fonts.json>" --family "Aboreto"`
3. The script downloads font files into `resources/fonts/families/...`
4. It writes the normalized backend catalog to `resources/fonts/index.json`

`mockup.service.js` resolves text layers through this local catalog first, then falls back to system fonts such as Liberation/DejaVu when available.
