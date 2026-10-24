# Missing card art

Card faces in the pool with no scan, which draw their generated frame instead. Listed on 2026-10-24 from the pool the app
runs (`packages/client/src/content/pool-cards.ts`) against `assets/card-art/`. Every other face in the pool has a scan;
the build's own check is the art test in `packages/client/src/art/bundled-art.test.ts`, and the Vite card-art plugin
(`packages/client/vite-card-art.ts`) warns at build time about any scan a card names that the folder lacks.

**Adding a scan:** drop it in `assets/card-art/bundles/cards/<code>.png` (WebP data at a 900 px long edge, whatever the
extension, as the other files are), and point the card's `image` / `images` at `/bundles/cards/<code>.png` in its
`packages/content/src/data/<set>/cards.ts` (and the set's curation source in `packages/content/scripts/`, if it has one).
A main scheme's stages each need their A and B sides. Send the scans in the PR thread and they will be converted and wired.

**35 cards** are missing art.


## Civil War main schemes (data set `synthezoid`, 57xxx)

| Code | Card | Type | Faces |
| --- | --- | --- | --- |
| 57005a | Superhero Registration Act | Main scheme | stage 2A, stage 2B (1A and 1B added 2026-10-24) |
| 57044a | Superhero Resistance | Main scheme | stage 1A, stage 1B, stage 2A, stage 2B |

## Shadowland (65xxx)

| Code | Card | Type | Faces |
| --- | --- | --- | --- |
| 65001a | A Barricade of Blades | Main scheme | stage 1A, stage 1B, stage 2A, stage 2B |
| 65006 | Ghost Maker | Minion | front |
| 65007 | Sealed Entrances | Side scheme | front |
| 65009 | Surround the Fortress | Side scheme | front |
| 65020 | Archpriestess | Minion | front |
| 65021 | Gorgon | Minion | front |
| 65022 | Lady Bullseye | Minion | front |
| 65023 | White Tiger | Minion | front |
| 65024 | Rite of Offering | Side scheme | front |
| 65025 | Shadowy Plot | Side scheme | front |
| 65029 | Kirigi | Minion | front |
| 65031 | Fukiya Ninja | Minion | front |
| 65033 | Kusarigama Ninja | Minion | front |
| 65034 | Shuriken Ninja | Minion | front |
| 65038a | Into the Labyrinth | Main scheme | stage 1A, stage 1B, stage 2A, stage 2B |
| 65040 | Whisper in the Dark | Attachment | front |
| 65043 | Hall of Hidden Doors | Side scheme | front |
| 65052 | Flame Spout | Treachery | front |
| 65053 | Oil Slick | Treachery | front |
| 65054 | Poison Darts | Treachery | front |
| 65055 | Pressure Plate | Treachery | front |
| 65056 | Tripwire | Treachery | front |
| 65060a | Dark Invitation | Main scheme | stage 1A, stage 1B, stage 2A, stage 2B |
| 65062 | Dark Shroud | Attachment | front |
| 65063 | Fear Projection | Attachment | front |
| 65066 | Fist | Minion | front |
| 65068 | Retainer | Minion | front |
| 65073 | Aka | Minion | front |
| 65074 | Tongue of the Beast | Minion | front |
| 65075 | Binding Ritual | Side scheme | front |
| 65076 | Roots of a Black Flower | Side scheme | front |
| 65077 | Malediction | Treachery | front |
| 65078 | Invasive Thoughts | Treachery | front |
