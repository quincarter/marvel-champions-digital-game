# Missing card art

Card faces in the pool with no scan, which draw their generated frame instead. Listed on 2026-10-30 from the pool the app
runs (`packages/client/src/content/pool-cards.ts`) against `assets/card-art/`. Every other face in the pool has a scan;
the build's own check is the art test in `packages/client/src/art/bundled-art.test.ts`, and the Vite card-art plugin
(`packages/client/vite-card-art.ts`) warns at build time about any scan a card names that the folder lacks.

**Adding a scan:** drop it in `assets/card-art/bundles/cards/<code>.png` (WebP data at a 900 px long edge, whatever the
extension, as the other files are), and point the card's `image` / `images` at `/bundles/cards/<code>.png` in its
`packages/content/src/data/<set>/cards.ts` (and the set's curation source in `packages/content/scripts/`, if it has one).
A main scheme's stages each need their A and B sides. Send the scans in the PR thread and they will be converted and wired.

No card in the pool is missing art. (The two Civil War main schemes got their scans on 2026-10-24, and the 33 Shadowland cards on 2026-10-30.)
