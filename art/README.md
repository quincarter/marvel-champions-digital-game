# art/

Full-bleed pictures the client shows outside of card scans. Every folder here
is globbed at build time, so **adding a file is all it takes** — there is no
list to edit. Formats: `png`, `jpg`, `jpeg`, `webp`, `avif`.

| Put it in | Named | Shown |
|---|---|---|
| `title/` | anything | Title screen — one at random per visit, never the same twice running |
| `scenarios/<scenarioId>/` | `villain.<ext>` | The villain's artwork for that scenario |
| `scenarios/<scenarioId>/` | `villain-wins.<ext>` | Game Over, when the players lose to it |
| `scenarios/<scenarioId>/` | `villain-loses.<ext>` | Game Over, when the players beat it |
| `outcomes/` | `defeat.<ext>` | Game Over for any loss with no scene of its own, and for a concession |
| `outcomes/` | `victory.<ext>` | Game Over for any win with no scene of its own |

`<scenarioId>` is the content package's `Scenario.id`, so the folder name is the
lookup: `rhino`, `klaw`, `ultron`, `risky-business`, `mutagen-formula`,
`breakout` (the Wrecking Crew's scenario).

**Several pictures for one slot:** add a suffix — `villain.jpg`,
`villain-2.jpg`, `villain-3.png` — and one is picked at random.

A concession shows `outcomes/defeat`, never a `villain-wins` scene: the team
stopped, the villain didn't beat them.

`packages/client/src/art/scenario-art.test.ts` fails if a file here fits no slot
(a typo like `villian.jpg`) or a scenario folder isn't a real scenario id.

Keep pictures at or under about **4096 px** on the long side. A texture larger
than the GPU's limit fails to upload — commonly 4096 on phones — and a picture
decodes to `width × height × 4` bytes whatever its size on disk.
