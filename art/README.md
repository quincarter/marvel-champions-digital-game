# art/

Full-bleed pictures the client shows outside of card scans. Every folder here
is globbed at build time, so **adding a file is all it takes** — there is no
list to edit. Formats: `png`, `jpg`, `jpeg`, `webp`, `avif`.

| Put it in                     | Named                   | Shown                                                                                                                                                                                              |
| ----------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title/`                      | anything                | Title screen — one at random per visit, never the same twice running                                                                                                                               |
| `scenarios/<scenarioId>/`     | `villain.<ext>`         | The villain's artwork for that scenario                                                                                                                                                            |
| `scenarios/<scenarioId>/`     | `villain-wins.<ext>`    | Game Over, when the players lose to it                                                                                                                                                             |
| `scenarios/<scenarioId>/`     | `villain-loses.<ext>`   | Game Over, when the players beat it                                                                                                                                                                |
| `scenarios/<scenarioId>/`     | `intro.<ext>`           | OPTIONAL: a one-off game's intro artboard, read beat by beat before the deal (`scenario-intros.ts`)                                                                                                |
| `outcomes/`                   | `defeat.<ext>`          | Game Over for any loss with no scene of its own, and for a concession                                                                                                                              |
| `outcomes/`                   | `victory.<ext>`         | Game Over for any win with no scene of its own                                                                                                                                                     |
| `heroes/<identityId>-<slug>/` | `hero.<ext>`            | The hero's artwork on hero select (Take your seats), the way a villain's shows on Scenario select                                                                                                  |
| `packs/<packCode>/`           | `cover.<ext>`           | OPTIONAL: a pack's shelf-header thumbnail on Scenario select and Take your seats (W2b's pack shelves)                                                                                              |
| `teamups/<pair-slug>/`        | `splash.<ext>`          | OPTIONAL: the full picture, shown once over the Board the first time that Team-Up becomes active (`<pair-slug>` is the two names, lowercased and sorted: `gambit-rogue`)                           |
| `teamups/<pair-slug>/`        | `badge.<ext>`           | OPTIONAL: the closeup, shown in a circle on the Board's top bar while that Team-Up is active; a pair with neither gets neither                                                                     |
| `campaigns/<campaignId>/`     | `cover.<ext>`           | The campaign's key art: the Saga tile and the Cover screen (`campaignCoverFor`); no file, the villain picture                                                                                      |
| `campaigns/<campaignId>/`     | `artboards/<name>.*`    | A story panel's picture, where the story file names it (`{ kind: "artboard", name }`); else its note                                                                                               |
| `campaigns/<campaignId>/`     | `pages/NN-<slug>.*`     | Full comic pages, read panel by panel in the comic reader; `NN` is the page order. Built in step 5a                                                                                                |
| `campaigns/<campaignId>/`     | `rulebook/page_NNN.jpg` | The box's official, lettered rulebook comic pages (see its `SOURCE.md`); a one-off scenario's own intro reuses one (`scenario-intros.ts`), for `trors`/`gmw`/`mts`/`sm`/`mut_gen` only — see below |

`<scenarioId>` is the content package's `Scenario.id`, so the folder name is the
lookup: `rhino`, `klaw`, `ultron`, `risky-business`, `mutagen-formula`,
`breakout` (the Wrecking Crew's scenario), `crossbones`, `absorbing-man`, `taskmaster`, `zola`, `red-skull`, `kang`,
`brotherhood-of-badoon`, `infiltrate-the-museum`, `escape-the-museum`, `nebula` and `ronan-the-accuser`. A folder
with just a `.gitkeep` is a scenario still waiting for its pictures. `<packCode>` is `Pack.code`
(`POOL_PACKS` in `packages/client/src/content/pool.ts`, e.g. `core`, `twc`) the
same way — no pack ships a cover yet, and a shelf header draws fine without
one (just the pack's name and a rule, no thumbnail).

`<campaignId>` is the content package's `Campaign.id`, which is the campaign box's pack code, the same key
`music/campaigns/` uses: `trors` (The Rise of Red Skull), `gmw` (The Galaxy's Most Wanted), `mts` (The Mad
Titan's Shadow), `sm` (Sinister Motives), `mut_gen` (Mutant Genesis), `next_evol` (NeXt Evolution), `aoa` (Age of
Apocalypse), `aos` (Agents of S.H.I.E.L.D.) and `fne` (Fear No Evil). Civil War has no campaign mode, so no folder.
All nine folders exist; one with just a `.gitkeep` is still waiting for its cover or panels. A cover shows on the
Saga tile and the Cover screen. An artboard shows wherever a panel in `packages/client/src/campaign/stories/<campaignId>.ts` names it
(`mountain-facility` → `artboards/mountain-facility.webp`); until the file exists the panel keeps its "Panel art: …"
note. `packages/client/src/art/campaign-art.test.ts` fails if an artboard file matches no name a story uses.

**Two kinds of campaign story art.** `artboards/` holds single pictures, one per story panel (The Rise of Red Skull
works this way). `pages/` holds whole comic pages with several panels each, and a box that has a `pages/` folder is
told through the comic reader instead (`artifacts/design-screenshots/individual/gmw-comic-reader.dc/`). Name pages
`NN-<slug>.<ext>` (`01-badoon.jpg`, `02-museum.jpg`, …): the two-digit number is the page order, the slug is for
people. Where each panel sits on a page, and which story beats it carries, is recorded once in the box's story file,
because a file name can't hold it. Credit the artist in a `CREDITS.md` beside the pages when the art is fan-made
(see `campaigns/gmw/pages/`).

**Official rulebook pages vs. the pages the reader uses.** `rulebook/` holds each box's official comic pages as they
are printed in its rulebook, captions and speech balloons included, rendered by the `extract-artboards` skill and
named by rulebook page number (`page_006.jpg`). `pages/` and `artboards/` hold what the campaign reader shows:
unlettered pages the comic reader letters itself, and single pictures. Keep them apart: a lettered page in `pages/`
would show its printed balloons under the reader's own. For The Galaxy's Most Wanted, the Joey Vazquez pages in
`pages/` turned out to be the unlettered art of the same six pages its rulebook prints. The Rise of Red Skull's own
`pages/` are the one exception: its rulebook comic _is_ the campaign's story, so its 8 pages are copied
byte-for-byte from `rulebook/` into `pages/` and marked `lettered: true` (`campaign/stories/trors.ts`) rather than
teach the campaign reader a second "official pages load a different way" branch. MojoMania's insert has no comic, so its `pages/` hold two lettered pages the owner supplied (the broadcast spread that
opens issue #1 and the X-Babies page that closes the campaign), also marked `lettered: true`; its panel rectangles
are measured from the gutters in each file (`campaign/stories/mojo.ts`). Issues #2 and #3 open on clean single
pictures in `artboards/` (`empty-set`, `spiral`, `screens`, `mojo-looms`, `longshot`; `hallway` is still to come, 1672x941).
A story page marked `artboard: true` reads its picture from there, unlettered, so the reader letters it: each beat
is the reading area's own shape (2.04:1 wide, 0.574:1 phone) and each line's `placement` is measured on the file.

A one-off (non-campaign) game's own scenario intro is different again: it shows the box's `rulebook/` page directly,
un-copied — the page right before that scenario's own Setup instructions begin, already lettered around that
scenario's own villain reveal (`campaign/scenario-intros.ts`, docs/phase7-wave5-handoff.md "Scenario intros from the
rulebook art"). Only the boxes with scenario content in this build's pool read `rulebook/` at all
(`packages/client/src/art/campaign-art.ts`'s `RULEBOOK_CAMPAIGN_IDS`: `trors`, `gmw`, `mts`, `sm`, `mut_gen` today) — globbing
every box's `rulebook/` would ship ~43 MB of pages no screen shows yet. A box outside that list, or a scenario whose
own page wasn't captured (GMW's Ronan the Accuser: page 17 fell outside what got rendered), simply has no
rulebook-page intro and falls back to whatever it already had (its own `art/scenarios/<id>/intro.*`, or none).

`<identityId>` is the hero identity card's id (`01001a` Spider-Man, `51001a` Shuri's Black Panther). Only the part
of the folder name before the first `-` is read; the rest is there so a person can tell the folders apart. Card ids
are used because nothing shorter is unique — two heroes are called Black Panther, two Spider-Man, and one pack can
hold five heroes. An empty folder (just a `.gitkeep`) is a hero still waiting for a picture: drop `hero.<ext>` in.
`heroes/_pending/` holds pictures for heroes whose pack isn't imported yet; it is never read. Each such hero has
its future folder waiting there (`_pending/40037a-domino/`, holding a `.gitkeep` until it gets a `hero.<ext>`), because
a folder directly under `heroes/` for a hero with no card data fails the test below. When a pack is imported as card
data, the same branch moves its heroes' folders up one level into `heroes/`, pictures and all.
`packages/client/src/art/hero-art.test.ts` fails if a folder isn't a real identity id or a file isn't `hero*`.

**Extras** (the Title menu's reward shelf) shows these same pictures once play has opened them: a hero's
`hero.*` files, a scenario's `villain*` files, `title/`, `outcomes/` and each campaign's `cover.*`. Nothing extra
needs adding for it; a new file shows up there too.

**Several pictures for one slot:** add a suffix — `villain.jpg`,
`villain-2.jpg`, `villain-3.png` — and one is picked at random.

A concession shows `outcomes/defeat`, never a `villain-wins` scene: the team
stopped, the villain didn't beat them.

Game Over shows the scene on every layout: edge to edge in the art window at
the top on phone and tablet-portrait, and as a full-bleed backdrop under a wash
of the result's color (red for a loss, green for a win) on desktop.

`scenarios/_pending/` holds villain art for scenarios that aren't in the pool yet; like `heroes/_pending/`, it
is never read.

`packages/client/src/art/scenario-art.test.ts` fails if a file here fits no slot
(a typo like `villian.jpg`) or a scenario folder isn't a real scenario id.

Keep pictures at or under about **4096 px** on the long side. A texture larger
than the GPU's limit fails to upload — commonly 4096 on phones — and a picture
decodes to `width × height × 4` bytes whatever its size on disk.
