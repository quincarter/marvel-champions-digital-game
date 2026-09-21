# art/

Full-bleed pictures the client shows outside of card scans. Every folder here
is globbed at build time, so **adding a file is all it takes** — there is no
list to edit. Formats: `png`, `jpg`, `jpeg`, `webp`, `avif`.

| Put it in                     | Named                 | Shown                                                                                                 |
| ----------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `title/`                      | anything              | Title screen — one at random per visit, never the same twice running                                  |
| `scenarios/<scenarioId>/`     | `villain.<ext>`       | The villain's artwork for that scenario                                                               |
| `scenarios/<scenarioId>/`     | `villain-wins.<ext>`  | Game Over, when the players lose to it                                                                |
| `scenarios/<scenarioId>/`     | `villain-loses.<ext>` | Game Over, when the players beat it                                                                   |
| `outcomes/`                   | `defeat.<ext>`        | Game Over for any loss with no scene of its own, and for a concession                                 |
| `outcomes/`                   | `victory.<ext>`       | Game Over for any win with no scene of its own                                                        |
| `heroes/<identityId>-<slug>/` | `hero.<ext>`          | The hero's artwork on hero select (Take your seats), the way a villain's shows on Scenario select     |
| `packs/<packCode>/`           | `cover.<ext>`         | OPTIONAL: a pack's shelf-header thumbnail on Scenario select and Take your seats (W2b's pack shelves) |

`<scenarioId>` is the content package's `Scenario.id`, so the folder name is the
lookup: `rhino`, `klaw`, `ultron`, `risky-business`, `mutagen-formula`,
`breakout` (the Wrecking Crew's scenario). `<packCode>` is `Pack.code`
(`POOL_PACKS` in `packages/client/src/content/pool.ts`, e.g. `core`, `twc`) the
same way — no pack ships a cover yet, and a shelf header draws fine without
one (just the pack's name and a rule, no thumbnail).

`<identityId>` is the hero identity card's id (`01001a` Spider-Man, `51001a` Shuri's Black Panther). Only the part
of the folder name before the first `-` is read; the rest is there so a person can tell the folders apart. Card ids
are used because nothing shorter is unique — two heroes are called Black Panther, two Spider-Man, and one pack can
hold five heroes. An empty folder (just a `.gitkeep`) is a hero still waiting for a picture: drop `hero.<ext>` in.
`heroes/_pending/` holds pictures for heroes whose pack isn't imported yet; it is never read.
`packages/client/src/art/hero-art.test.ts` fails if a folder isn't a real identity id or a file isn't `hero*`.

**Several pictures for one slot:** add a suffix — `villain.jpg`,
`villain-2.jpg`, `villain-3.png` — and one is picked at random.

A concession shows `outcomes/defeat`, never a `villain-wins` scene: the team
stopped, the villain didn't beat them.

Game Over shows the scene on every layout: edge to edge in the art window at
the top on phone and tablet-portrait, and as a full-bleed backdrop under a wash
of the result's colour (red for a loss, green for a win) on desktop.

`packages/client/src/art/scenario-art.test.ts` fails if a file here fits no slot
(a typo like `villian.jpg`) or a scenario folder isn't a real scenario id.

Keep pictures at or under about **4096 px** on the long side. A texture larger
than the GPU's limit fails to upload — commonly 4096 on phones — and a picture
decodes to `width × height × 4` bytes whatever its size on disk.
