# Campaign client: what each new box needs

The campaign screens (`packages/client/src/scenes/campaign/`, designed in `Marvel Champions game screens/Campaign -
*.dc.html`) were designed around one box, **The Rise of Red Skull (MC10)**. This note says what a later box gets for
free, what it needs written, and which boxes need a real **design pass** before their campaign is wired into the
client. Read it at PLAN.md C2's "Client wiring for anything the box needs that the foundation does not already cover".

Mechanism numbers ("row 25") refer to the inventory in [campaign-mode-design.md §1](campaign-mode-design.md#1-mechanism-inventory),
which is where each one is cited to its rulebook page.

## 1. What every box gets without any design or writing work

The screens are generic over the box. Everything mechanical comes from the box's `CampaignDefinition`
(`packages/cards/src/campaigns/<box>.ts`), its campaign log and the card data:

| Screen                   | Driven by                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| The Saga (C00b)          | `SAGA_VOLUMES` in `campaign/story.ts` (all nine boxes are already listed) + stored runs         |
| Cover (C01)              | `@mc/content` `Campaign` record; cover art is the box's last scenario's villain picture         |
| Sign the roster (C02)    | any legal deck; identity locked for the campaign                                                |
| Briefing (C08)           | the composed attempt's steps and in-game instructions, log values, seat grants                  |
| Aftermath (C05/C06)      | the runner's pending victory choices, one column per seat                                       |
| Rewind (C09)             | the box's `LossPolicy` and the history's removals                                               |
| The Run / Issue detail   | the definition's nodes + `CampaignLog.history`                                                  |
| Dossier                  | `view/campaign-log-model.ts` (the printed log sheet, mode-gated and hidden fields handled)      |
| Deck edit                | `validateDeck` with a campaign `DeckContext` (grants pinned, removals and prohibitions refused) |
| In-game stage beat (C04) | only shown when the story has a line for that stage                                             |

**Art** comes from `art/scenarios/<scenarioId>/villain.*`, which a scenario gets anyway when it is imported. The
opener's non-villain panels stay the design's "Panel art: …" placeholders until someone draws them.

## 2. The writing pass (every box)

The campaign's voice is one file: `packages/client/src/campaign/stories/<box>.ts`, shaped like `stories/trors.ts`
(types in `campaign/story.ts`), plus one entry in `STORIES` in `campaign/story.ts`. A box with no story still plays;
the screens fall back to plain text (the Finale's headline, for example, becomes "The campaign is won.").

Checklist for the story file:

- [ ] `tagline` ("A story in five issues"), cover `blurb`, roster `rosterBanner`.
- [ ] `castIdentityIds`: the box's own heroes, whose lines are written for them. Every other hero's line shows as its
      narrator `fallback` instead; give every hero line a `fallback` or accept that it disappears for other rosters.
- [ ] One `IssueStory` per campaign node, keyed by `nodeId` (add the box to `campaign/story.test.ts`, which checks MC10's ids match its definition):
      `title`, `villain`, `blurb` (The Run, up next), `teaser` (The Run's bubble), `recap` (Issue detail, once won),
      three `opener` panels (caption, art, lines, optional `sfx`), `stageLines` per villain stage (C04),
      `stageNotes` (a short rule reminder under the splash), `briefing` line, `aftermath` narrator + art, and
      `rewindTaunt`.
- [ ] `finale`: caption, headline, SFX, villain line, one line per seat.
- [ ] Original copy only: flavor written for this app, never the rulebook's own narrative text.

### MC10 wording that still lives in the screens

Move these into the story type before the second box lands, so a box really is one file:

- **Rewind's campaign-lost variant** (`scenes/campaign/rewind.ts`): "Hydra Wins." / "Red Skull conquered the world."
  Only reached through MC10's Expert-only Red Skull loss today, but any box with row 15 or row 16 will show it.
- **The Dossier's World box** (`view/campaign-dossier-model.ts`, `WORLD_FIELD_PRESENTATION`): short labels and
  "when it matters" lines keyed to MC10's shared log field ids ("Stolen weapons", "Issue #5: added to Red Skull's
  starting threat", "Lost allies"), and the bookkeeping fields it hides. Another box's fields fall back to the
  printed log label and citation, which works but reads like a spreadsheet.
- **The Aftermath's reward effect lines** (`view/campaign-aftermath-model.ts`, `AFTERMATH_EFFECT_OVERRIDES`):
  hand-written one-liners for MC10's eight upgrades, because their printed text starts with "Setup." Other boxes'
  rewards get the card's first sentence, which may need the same treatment.

## 3. Boxes that need a design pass

The MC10 tiles show a linear run of five issues, free card rewards picked one per hero, and a no-penalty retry. A box
that does something the tiles never show needs its screens designed before its client wiring. By box:

| Box  | Needs designing                                                                                                                                                                                                                                                                                                                       | Screens affected                         | Rows                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------ |
| MC16 | **Buying rewards** with a per-player currency, with one copy per campaign for the group; an escalating encounter-card ladder shown in the log; the Expert Campaign deck freeze after scenario 1.                                                                                                                                      | Aftermath, Dossier, Deck edit            | 25, 26, 31, 55           |
| MC21 | A **campaign pool** of carried-forward cards put into play or shuffled in at setup: how the pool reads in the Dossier and the Briefing.                                                                                                                                                                                               | Dossier, Briefing                        | 39, 41                   |
| MC27 | **Choose 1 of 3 randomly dealt upgrades**; **add max copies of any aspect card from your whole collection** (a searchable picker, not a short column); a **reputation track** whose nodes add setup to every later scenario; prohibited cards and an optional deck freeze; flipping a reward to its other face.                       | Aftermath, Dossier, Briefing, Deck edit  | 27, 28, 42, 54, 55, 57   |
| MC32 | A **per-seat role chosen once** that opens off-aspect deckbuilding for the campaign; **per-game "role-building" additions** that leave the deck after the game; collection-wide picks; "use it or lose it" removals.                                                                                                                  | Roster or Aftermath, Briefing, Deck edit | 28, 29, 33, 43           |
| MC40 | A **campaign environment** with Completed/Failed sides; choosing which of several outcomes to pay; a strike list; a retry that must re-make the same choice.                                                                                                                                                                          | Briefing, Rewind, Dossier                | 40, 58, 59, 60           |
| MC45 | **Missions whose "not defeated" result is a reward** (three parallel instruction lists per option); a strike list chosen at random; **winning the last scenario but losing the campaign**.                                                                                                                                            | Aftermath, Dossier, Finale               | 16, 40                   |
| MC50 | **Hidden evidence** chosen at random and never shown, with a **deduction grid** in the log; Board Members whose counters and face persist across scenarios; **defeat blocks with real penalties in Standard mode** (the design's "no penalty" rewind framing is wrong here); setup windows before starting hands and after mulligans. | Dossier, Rewind, Briefing                | 7, 8, 12, 13, 44, 45, 46 |
| MC60 | **Players choose the next scenario**; unplayed scenarios progress at random and fail at three marks; each scenario is a main scheme paired with a chosen villain; defeat blocks; damage recorded after every game; a campaign environment. The Run as a row of five issues does not fit a choice graph at all.                        | The Run, Cover, Briefing, Rewind         | 2, 3, 4, 12, 14, 19, 60  |

Notes:

- **MC60's choice board has a view model but no screen.** `view/campaign-scenario-choice-model.ts` renders the
  runner's "which scenario next?" pending choice and each node's progress marks; the screen it feeds was never
  designed.
- **The Rewind screen's framing is MC10's.** "Same villain, same log as when you opened it" and the "KEPT / GONE" box
  are true for boxes with a no-penalty retry (row 11). MC50 and MC60 print real defeat instructions (row 12), so their
  loss screen has to say what the loss cost.
- **Civil War (MC56) has no campaign** (MC56 p. 3) and needs nothing here. It is already excluded from The Saga.
- **Aftermath choices that are not cards** (a role, a node, an outcome to pay) arrive as option strings, and the
  columns currently render every option as a card. Any box above whose victory choice is not a card needs that
  row design.

## 4. Boxes told as comic pages

A box with fan-made comic pages is told through the **comic reader** instead of single-picture panels: a full page
read panel by panel, with The Run, the issue opener, the in-game stage beat, Rewind, the Aftermath and the Finale all
drawn from its pages. The rule is in `art/README.md`: a box gets the reader when it has
`art/campaigns/<id>/pages/NN-<slug>.<ext>` (the number is the page order), and `CREDITS.md` beside fan-made pages
names the artist. Where each panel sits on a page, and which story beats it carries, is recorded once in the box's
story file. GMW builds the reader (PR #35, step 5a); the boxes below reuse it.

| Box  | Reader tiles (`artifacts/design-screenshots/individual/`) | Pages in the repo now                                                  | Page order (from the design canvas's slices)                                                        |
| ---- | --------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| MC16 | `gmw-comic-reader.dc/` (f478c355)                         | `art/campaigns/gmw/pages/01-badoon` … `06-finale`, credited            | done (5513196f)                                                                                     |
| MC21 | `mts-comic-reader.dc/` (1027efda)                         | 6 Joey Vazquez pages in `art/campaigns/mts/artboards/`, original names | `p1-titan`, `p2-order`, `p3-battle`, `p4-hel`, `p5-asgard`, `p6-feast`                              |
| MC27 | `sm-comic-reader.dc/` (1027efda)                          | 8 Joey Vazquez pages in `art/campaigns/sm/artboards/`, original names  | `p1-swing`, `p2-sandman`, `p3-oscorp`, `p4-mysterio`, `p5-six`, `p6-goblin`, `p7-shield`, `p8-home` |

The slices are in `Marvel Champions game screens/art/campaigns/<id>/` (the design canvas's own copies). When MC21's
or MC27's campaign client work starts:

- [ ] Move the box's pages out of `artboards/` into `pages/NN-<slug>.<ext>`, numbered and named after the canvas
      slices above (match each original file to its slice by eye; MC21's originals are two-page spreads, so check
      whether a slice is a whole file or half of one before renaming). Add `pages/CREDITS.md` naming Joey Vazquez and
      mapping each original file name to its new one, as `art/campaigns/gmw/pages/CREDITS.md` does.
- [ ] Record each page's panel outlines and beats in the box's story file, following GMW's.
- [ ] Build and click-check the box's comic screens against its reader tiles at phone, tablet and desktop, together
      with its own design-pass screens from §3.

## 5. Running a design pass

1. Add the box's tiles to the campaign canvases (`Marvel Champions game screens/Campaign - *.dc.html`) or a new
   canvas per box, and regenerate the PNGs with `pnpm capture:screens` into
   `artifacts/design-screenshots/individual/`.
2. Brief UI work from those PNGs, desktop and phone both (their compositions differ), and verify every screen by
   clicking it against its tile before ticking it (the process PR #35 used).
3. `__mcCampaign.seed(stop)` (`campaign/dev-fixtures.ts`) plays MC10 to a known point for screen work; a new box
   needs its own seed stops added there before its screens can be checked without playing every scenario.
