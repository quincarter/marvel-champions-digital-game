# Wave 8 handoff (cycle 8, Age of Apocalypse)

For any session picking up the Wave 8 PR, local or cloud. The PR body has the checklist; this page carries how to
resume, the scope, and anything decided along the way. Rules for running agents are the same as earlier waves
([phase7-wave5-handoff.md](phase7-wave5-handoff.md) "Rules for agents" and "Lessons from review",
[phase7-wave6-handoff.md](phase7-wave6-handoff.md), [phase7-wave7-handoff.md](phase7-wave7-handoff.md)) and CLAUDE.md
"How to split work across agents". Started 2026-10-07.

## Resuming

- **Branch:** `feature/wave-8`, off `main` at fc43e790 (v0.17.0, #102; Wave 7 is #98). Everything finished and
  verified is pushed there; each verified commit goes up as it lands.
- **Read first:** the PR checklist, this page, then `docs/phase7-wave8-sources.md`, `docs/phase7-wave8-data-survey.md`
  and `docs/phase7-wave8.md` once they exist.
- **Definition of done:** [wave-definition-of-done.md](wave-definition-of-done.md), including §4b (custom decks) and
  Guided mode coverage in §5. The wave ships the MC45 Age of Apocalypse campaign in the same PR.
- **Order of work** (as waves 5 to 7): sources doc and data survey → spec (`game-rules-architect`, in passes: the box
  and campaign first, then the hero packs) → schema changes and `aoa` emitted → engine primitives one at a time (one
  engine agent at a time) → scripting per hero / per scenario (≤ 3 agents, one small task each) → rules QA → custom
  decks → client wiring and Guided mode → campaign → progression → shipping.

## The push hook is removed on this branch (owner, 2026-10-07)

The owner asked for the e2e pre-push hook to be removed while the wave is being built, with the commit hooks kept.
`.githooks/pre-push` is deleted on this branch (its last version is on `main` at fc43e790); `.githooks/e2e-gate.sh`,
`pre-commit` and `commit-msg` are untouched, so `pnpm e2e:verify` still runs the whole suite on demand. `pnpm check`
runs before every push.

**The hook must be re-added before the wave ships.** Restore it (`git checkout origin/main -- .githooks/pre-push`)
before the final few client pushes of step 5, so those pushes, the merge and the release to prod each go up with the
whole Playwright suite passed. This PR must not merge with the file missing, or `main` loses its gate. The PR's
step 8 carries a box for this.

## Rules policy (owner, 2026-10-07)

Where an official FFG ruling says a card's printed wording gives a result the designers did not intend, the intended
behavior is built, and the spec's §4.1 row cites the ruling by its date heading with the RRG page it clarifies.
Where a ruling and the RRG disagree with no statement of intent, the conflict goes to the owner as a short
multiple-choice question with a recommended default.

## Scope

RRG 1.8 Appendix VI, "Limited Environment" (p. 71): "**8.** The _Age of Apocalypse_ campaign expansion, the _Iceman
Hero Pack_, the _Jubilee Hero Pack_, the _Nightcrawler Hero Pack_, and the _Magneto Hero Pack_." Our id is
`cycleId("cycle8")`; the four emitted packs' `Cycle` records should be renamed "Age of Apocalypse" when the wave is
emitted (as waves 6 and 7 did).

| Pack       | Type         | Raw cards | Card data today              |
| ---------- | ------------ | --------- | ---------------------------- |
| `aoa`      | Campaign box | 195       | not emitted (raw cache only) |
| `iceman`   | Hero pack    | 32        | data only (`DATA_ONLY_*`)    |
| `jubilee`  | Hero pack    | 40        | data only                    |
| `ncrawler` | Hero pack    | 38        | data only                    |
| `magneto`  | Hero pack    | 42        | data only                    |

The box (MC45): heroes Bishop and Magik; five scenarios (villains in the raw data: Unus, the Four Horsemen (War,
Famine, Pestilence, Death), Apocalypse, Dark Beast, and En Sabah Nur as a set); 6 campaign cards per PLAN.md C3, to be
checked by the data survey. Encounter sets named in the raw data: Age of Apocalypse, Apocalypse, Blue Moon, Celestial
Tech, Clan Akkaba, Dark Beast, Dark Riders, Dystopian Nightmare, En Sabah Nur, Four Horsemen, Genosha, Hounds,
Infinites, Mission, Overseer, Savage Land, Standard III, Unus, plus Campaign and the two nemesis sets. Rulebook:
`docs/campaign-modes/mc45_age_of_apocalypse_rulebook.pdf`, markdown `docs/campaign-modes/markdown/mc45_age_of_apocalypse.md`.
The RRG has Age of Apocalypse FAQ sections (`mc_rulesreference_v18_compressed.md` lines ~4682 and ~5058).

Already in the repo:

- Raw MarvelCDB caches: `packages/content/raw/marvelcdb/{aoa,iceman,jubilee,ncrawler,magneto}.json`.
- Hero art: `art/heroes/{46001a-iceman,47001a-jubilee,48001a-nightcrawler,49001a-magneto}/`; Bishop and Magik wait in
  `art/heroes/_pending/{45001a-bishop,45030a-magik}/`, both empty (asked for on the PR).
- Campaign art: `art/campaigns/aoa/rulebook/` (8 pages); `artboards/` is empty.
- Carried over from earlier waves: a box's scenario obligations are emitted with `encounterSetIds: []` unless the
  normalizer fix made for `mut_gen` / `mojo` is applied to them too; a full re-emit drifts in unrelated fields (image
  extensions, core's sets and `maxPerHost`), so emit pack by pack.

## Release

`main` is at v0.17.0 with no unreleased fragments (2026-10-07). Wave 8 is a minor release (v0.18.0 unless something
else ships first); check `changie next auto` before merging.

## State (2026-10-07, end of the first day)

The PR's checklist is the live record; this is the short version.

- **Step 1, spec: complete.** `docs/phase7-wave8.md` (7,366 lines): §3.1 to §3.81, §4.1 with the owner's answers to
  questions 1 to 40 (seven differ from the proposed default: Q9, Q14, Q19, Q22, Q26, Q31, Q33), §8 the build order.
  Open: questions 41 to 46 and two follow-ups (Q25 at the deck minimum; who picks the paid resources when a payment
  is overpaid), all at the top of the PR. Never read the spec whole: `grep -n '^## \|^### '` and `awk` between
  headings.
- **Step 2, card data: complete.** All five packs are emitted and exported as `WAVE8_*`, in `PLAYABLE_CARDS` but listed
  in `UNSCRIPTED_WAVE8_PACKS` (`packages/cards/src/playable-precon-legality.test.ts`). Six starter decks, each from a
  printed list. `AOA_CAMPAIGN` exists but is not in `CAMPAIGNS`. `POOL_VERSION` is not bumped. Leftovers are listed in
  the spec's §8.1.
- **Step 3, scripting: started.** The scaffold is in (`packages/cards/src/wave8/`, 54 empty modules, `CARD_GROUPS`
  maps each of the 346 cards to one module, `coverage.test.ts` has every pack "not started"). The engine queue is the
  spec's §8.2, 43 tasks in dependency order, one engine agent at a time. §8.4 says which scripting modules wait on
  which engine tasks; modules that wait on nothing can run beside the engine agent (at most three agents in all,
  never two in one file; `coverage.test.ts` is shared, so each scripting agent edits only its own pack's entries).
- **Each engine task's brief:** the §8.2 row, the §3 section cut out by `awk`, the owner decisions the row names,
  "search and reuse", exact-number tests in a colocated file, no git, suites run alone. The main session reruns the
  suites before committing.
- **Also shipped in this PR, not wave 8 content:** the basic Colossus ally (`mut_gen` 32048, `wolv` 35021) carries its
  printed subtitle "Piotr Rasputin", so FFG's unique rule refuses it beside the Colossus hero; the same-name tests and
  the e2e spec were rewritten on that.
- **Still to correct:** `docs/campaign-mode-design.md` §1.2 and `docs/campaign-client-per-box.md` §3 read the MC45
  campaign log backward (on the sheet Defeated is the reward and Not Defeated the cost).

## State (2026-10-08, second day)

`origin/feature/wave-8` is the source of truth; the PR's "Resume here" paragraph names the last verified commit and what
is in flight. In short:

- **Card scripting: all 54 modules are done** (`packages/cards/src/wave8/`). A ref the engine cannot support yet is left
  unregistered in its module's `…_SKIPPED` map with the queue task it waits on, an exported draft where one can be
  typed, an `it.fails` proof and a companion test of today's behavior. When an engine piece lands, move the draft into
  the registry, delete the skip, and turn the `it.fails` into a plain `it`.
- **Engine:** queue tasks 1 to 17 are built (spec §8.2), plus the attack rules the owner ruled on as Q47 to Q50
  (`packages/engine/src/resolve/attack-ability.ts`). Tasks 18 to 43 remain: 18 to 30 are scenario pieces, 31 to 38 are
  the mission area (34 campaign refs wait on it), 39 to 43 the rest. One engine agent at a time; batches of three to
  five small tasks per agent have worked.
- **Scenario builder:** `wave8Scenario(id, options)` and `wave8StarterDeckSetup(id)` in
  `packages/cards/src/wave8/setup.ts`. The scripted scenario tests still build on `coreScenario("rhino")` with fields
  swapped in; moving them to the builder is optional cleanup.
- **Precon games:** all six heroes have a `precon-e2e.test.ts` (seeded full games, per-command invariants, log
  replay). Iceman's found one defect (Frostbite never returned to the set-aside area), fixed in 777c25ca.
- **Not started:** rules QA pass, custom decks (4b), client wiring and Guided mode, the MC45 campaign client,
  progression, shipping. The wave is **not** in the playable pool (`UNSCRIPTED_WAVE8_PACKS`, `PACK_STATUS`).

Working notes that cost time to learn:

- Scripting agents share `packages/cards/src/wave8/coverage.test.ts`. Commit finished modules together once no agent
  is mid-edit in it, or the commit carries another agent's half-written entry.
- A usage limit can stop every agent at once. Their edits stay in the working tree; resume each by message and it picks
  up where it stopped. Ask agents to stop at a boundary where typecheck and coverage pass.
- `pnpm --filter @mc/cards exec vitest run <path>` takes paths relative to `packages/cards`; `oxlint` and `oxfmt` take
  paths from the repo root. A wrong path exits non-zero without running anything: read the "Tests" line.
- The cards package has no node types: no `process` in test files (`console.info` prints a tally).
- A plain regen of a wave 8 pack flips many `imageRef` lines from `.jpg` to `.png`; restore them before committing.
- Hazard deals one extra card per icon in player order (RRG p. 21), and heroes ready and draw at the end of the player
  phase. Earlier briefs said otherwise; the engine was right.

## State (2026-10-08, evening)

- **The pre-push hook is back** (`.githooks/pre-push`, commit 08d2c243). Every push since runs the whole Playwright
  suite; `pnpm e2e:verify` ahead of a push stamps the pass.
- **Pushed at 9df31358:** the third set of owner rulings (spec §4.1 rows 73 to 85) is built, the 17 music tracks are
  in, the Doctor Strange 'Pool deck (MarvelCDB 34506) is tested and does not loop, and the offline regen reproduces
  the committed data for all six emitted packs.
- **Browser playthroughs done:** the four remaining scenarios, the five remaining precons, two deck imports and the
  campaign (reward picker, mission defeated, loss and retry, easier start, finale, expert heal sheet). They found 19
  screen defects and one rules defect (Overseer minions print 5 hit points per hero and were built flat). The fixes
  are the commits after 9df31358; the PR's "Resume here" names what is still in flight.
- **Open with the owner** (top of the PR): The Wrecking Crew insert against the January 17, 2026 ruling, Machine Man
  and a three-resource card, Toe to Toe when stunned mid-card, the older "if you paid with" riders, and the No Longer
  Worthy warning. Each is built on its option A.
- **Known and left:** at 1280x720 the Set the Table modular list shows about one row; it needs a layout decision.

## Lessons carried in

- Match every card title in the packs' raw data against the rulings file by script instead of trusting a hand search.
- The RRG markdown conversion can put a page's entries under the wrong product heading; check the PDF page.
- Agents do not commit unless told to: an uncommitted change in the working tree is unverified agent output. One
  engine agent at a time; at most three agents in all, on files that do not overlap.

## Printed decklist cards from the owner

Read by the main session from the owner's photo of each pack's decklist card; the data step that writes the starter
deck checks its list against these.

### Iceman Hero Pack (received 2026-10-07)

Every title and quantity matches `packages/content/raw/marvelcdb/iceman.json` positions 2 to 28 (checked by script
against the photo's transcription). The card spells 46005 "Cyrokinetic Perception"; MarvelCDB has "Cryokinetic
Perception" (the photo is soft, so the printed spelling is unconfirmed).

- **Hero cards:** 2 Frostbite ×6, 3 Snow Clone ×2, 4 Power Belt, 5 Cryokinetic Perception, 6 Ice Slide, 7 Frozen
  Solid ×2, 8 Ice Wall, 9 Arctic Attack ×2, 10 Ice Blast ×2, 11 Chill Out! ×3 (21 cards; 15 without the six
  Frostbite, which the spec has to place: in the deck or set aside)
- **Aggression:** 12 Shark-Girl, 13 Glob, 14 Suppressing Fire ×3, 15 Surprise Move ×3, 16 Take That! ×3, 17 Looking
  for Trouble ×3, 18 Keep Up the Pressure (15)
- **Basic:** 19 Shadowcat, 20 Beak, 21 Team-Building Exercise ×3, 22 Recuperation ×3, 23 The Power in All of Us ×2
  (10)
- **Obligation:** 24 Hot-Headed
- **Nemesis set:** 25 Pyro, 26 Playing with Fire, 27 Pyro's Flamethrower, 28 Burn! ×2
- Not on the decklist card: 29 to 32 (Sauron, Sauron Lives!, Life Drain, The Eye of Sauron ×3), the pack's modular
  set.

### Jubilee Hero Pack (received 2026-10-07)

Titles match `packages/content/raw/marvelcdb/jubilee.json` positions 2 to 27, with two differences for the data step:

- **22 Unlikely Duo is printed with no multiplier (one copy); MarvelCDB has quantity 2.** With one copy the deck is 40
  cards (15 hero, 14 Justice, 11 basic); with two it is 41. The printed card is taken as right unless a scan of the
  pack shows otherwise.
- The card reads "9 Grand Finale"; MarvelCDB has "Grande Finale" (the photo is soft; check the card's own scan).

- **Hero cards:** 2 Wolverine, 3 Shopping Spree, 4 Jubilee's Coat, 5 Jubilee's Sunglasses, 6 Blinding Flash, 7
  Firecracker ×3, 8 Flash of Light ×3, 9 Grand Finale, 10 Plasmoid Energy ×3 (15; MarvelCDB stores 7, 8 and 10 as
  three one-copy records each, a/b/c)
- **Justice:** 11 Chamber, 12 Husk, 13 Disguise ×3, 14 Waylay ×3, 15 Three Steps Ahead ×3, 16 Generation X, 17 The
  Power of Justice ×2 (14)
- **Basic:** 18 Synch, 19 Cell Phone ×3, 20 X-Gene ×3, 21 Multitalented ×3, 22 Unlikely Duo (11)
- **Obligation:** 23 Grounded
- **Nemesis set:** 24 Nanny, 25 Naughty Children, 26 Battle Suit, 27 "Lost" Child ×2
- Not on the decklist card: 28 Mutant Mayhem ×3, 29 Serve and Protect ×3, and 30 to 34 (Arcade, Welcome to
  Murderworld, Arcade's Funhouse, Hall of Mirrors, Elaborate Trap), the pack's modular set.

### Nightcrawler Hero Pack (received 2026-10-07)

Every title and quantity matches `packages/content/raw/marvelcdb/ncrawler.json` positions 2 to 30. The deck is 40
cards: 15 hero, 20 Protection, 5 basic.

- **Hero cards:** 2 Daytripper, 3 Kurt's Chapel, 4 Kurt's Cutlasses, 5 Prehensile Tail, 6 Bamf! ×3, 7 'Port and Punch
  ×2, 8 Teleport Drop, 9 Scout Ahead ×2, 10 'Port Away, 11 Tally Ho! ×2 (15)
- **Protection:** 12 Rogue, 13 Northstar, 14 Change of Fortune ×3, 15 Under Control ×3, 16 "Come Get Me, Bub!" ×3, 17
  Powerful Punch ×3, 18 Riposte ×3, 19 The Power of Protection ×2, 20 Astonishing X-Men (20; number 20 heads the
  card's second column, above the Basic heading)
- **Basic:** 21 Gambit, 22 Moira MacTaggert, 23 Energy, 24 Genius, 25 Strength (5)
- **Obligation:** 26 Crisis of Faith
- **Nemesis set:** 27 Azazel, 28 Brimstone Dimension, 29 Azazel's Sword, 30 Brimstone Strike ×2 (glare covers part of
  28 to 30 in the photo; the titles are read with the raw data's help)
- Not on the decklist card: 31 Combine Forces ×3, 32 Gunboat Diplomacy ×3, and 33 to 38 (The Crazy Gang, Queen of
  Hearts, Jester, Executioner, Tweedledope, "Off with His Head!"), the pack's modular set.

### Magneto Hero Pack (received 2026-10-07)

Every title and quantity matches `packages/content/raw/marvelcdb/magneto.json` positions 2 to 32. The deck is 40
cards: 15 hero, 17 Leadership, 8 basic. The card's copyright line reads 2023 (the other three read 2024).

- **Hero cards:** 2 Asteroid M, 3 Magneto's Helmet, 4 Magneto's Armor, 5 Magneto's Cape, 6 Magnetic Bubble, 7 Wrapped
  in Metal ×2, 8 Electromagnetic Blast ×2, 9 Metal Shards ×2, 10 Magnetic Missile ×2, 11 Master of Magnetism ×2 (15)
- **Leadership:** 12 M, 13 Kid Omega, 14 Phoenix, 15 Cyclops, 16 Won't Stay Down ×3, 17 Squared Off ×3, 18 Noble
  Sacrifice ×3, 19 "You Got This!" ×3, 20 New Recruits (17; number 20 heads the card's second column, above the
  Basic heading)
- **Basic:** 21 White Queen, 22 Face the Past, 23 Deft Focus ×3, 24 Energy, 25 Genius, 26 Strength (8)
- **Obligation:** 27 Old Grievances
- **Nemesis set:** 28 Exodus, 29 Martyr for Mutants, 30 Fabian Cortez, 31 Frenzy, 32 Angry Acolyte (MarvelCDB has one
  copy of each; the card prints no multiplier)
- Not on the decklist card: 33 to 37 (Surge, Anole, Bling!, Indra, Children of the Atom ×3) and 38 to 42 (Sebastian
  Shaw, Selene, Hellfire Pawn, The Inner Circle, Power and Decadence), the pack's modular set.

## Rules answers from the owner (2026-10-07), to copy into the spec's §4.1

Answered in the project thread on 2026-10-07 for the ten questions of spec pass 1a (`docs/phase7-wave8.md` §4.2). They
are held here because a spec agent had the spec file open; the main session copies them into §4.1 once pass 1b is
committed. Nine follow the proposed default; **Q9 does not**.

- **Q1 = A.** A setup control, off unless the players turn it on. The rulebook's amounts are recommendations; never
  apply the mode's amount silently.
- **Q2 = A.** Pursued by the Past's Forced Response resolves when the counter is placed and removes every counter
  before the treachery reaches "Then, if it has any counters".
- **Q3 = A.** "The number of players" is the players in the game now; nothing snapshots the starting count.
- **Q4 = A.** A stun or confuse replaces the activation, so the villain did not activate and the active counter stays.
- **Q5 = A, firm.** The owner cites an FFG ruling (Hall of Heroes "Latest FFG Rulings post RRG 1.5", a page that is
  not in this repo and was not read by the main session): the counter moves after any Horseman activates, and always
  one place from the villain holding it, never from the villain that activated. **Test case from the owner:** Death
  holds the active counter and a treachery makes War activate; after War's activation the counter moves from Death to
  the villain immediately right of Death, not from War to War's neighbor.
- **Q6 = A.** "Considered to have at least 1 hit point" is a game-state modifier every reader sees, including the
  other Horsemen's "cannot be defeated while another villain has at least 1 hit point".
- **Q7 = A.** The normal valid-target and initiation rule: Golden Horse and Metal Wings are not offered when the
  simulated Forced Response can do nothing (War with no upgrade or support the player controls).
- **Q8 = A.** Infinite Prelate: the extra boost card is set up for the activation; the tough status card and the heal
  resolve after it. Do not front-load all three.
- **Q9 = B (not the proposed default).** Build the per-villain A/B picker. The four selectors default from the
  difficulty (A/A/A/A for skirmish and standard, B/B/B/B for expert and heroic) and each can be overridden (MC45
  p. 11). No "extreme" mode.
- **Q10 = A.** Standard III may replace the Standard set on any scenario that uses it, not only Age of Apocalypse
  scenarios (MC45 p. 3).

## Heart of the Empire's two sides (owner's scans, 2026-10-07)

This answers the data survey's open question 1 and schema gap 8. The owner sent both sides of box card 104; both read
"APOCALYPSE (4/15)", so it is one physical card of the `apocalypse` set. Read by the main session from the scans.

- **104A, Heart of the Empire** (side scheme, starting threat 2, no per player icon, one acceleration icon). Flavor:
  "Before you can challenge Apocalypse, you must fight your way through his tower." Text: "Threat cannot be removed
  from this scheme while a **Prelate** minion is in play. **When Defeated**: The first player reveals a random
  set-aside **Prelate** minion. Deal each other player an encounter card. Flip this card over." This matches the raw
  record 45104a.
- **104B, The Towering Citadel** (side scheme, starting threat 3, no per player icon, two acceleration icons). Text:
  "Threat cannot be removed from this scheme while a **Prelate** minion is in play. **When Defeated**: The first
  player reveals a random set-aside **Prelate** minion. Deal each other player an encounter card. Reveal The Tyrant's
  Throne side scheme and remove this card from the game." **MarvelCDB has no record of this face**: raw 45104a's
  `linked_card` is 45105b No Longer Worthy, which is wrong (No Longer Worthy is the back of The Tyrant's Throne
  45105a). The `aoa` curation has to add 45104b by hand, citing these scans.
- The 104B scan is saved as `assets/card-art/bundles/cards/45104b.png` (WebP inside, 1030×710; the other scans are
  about 419 wide, so the art step may want to scale it). 45104a's scan was already there. No manifest row was added
  to `assets/card-art/hall-of-heroes-manifest.tsv` for 45104b.
- For the spec (pass 1b, Apocalypse scenario): the chain is Heart of the Empire → flips to The Towering Citadel →
  reveals The Tyrant's Throne (45105a) → flips and reveals No Longer Worthy (45105b).

## Rules answers from the owner (2026-10-07, second set): questions 11 to 17

Answered in the project thread on 2026-10-07 for spec pass 1b (`docs/phase7-wave8.md` §4.2). Held here while a spec
agent has the spec file open; the main session copies them into §4.1 when pass 2c is committed. Six follow the
proposed default; **Q14 does not**.

- **Q11 = A.** Scenario 3 reveals Apocalypse's next stage; it is not a change of form. The new stage enters at its
  full printed hit points, and attachments and status cards stay. (Scenario 5's form changes are the contrast: they
  are neither a defeat nor a reveal and do not reset hit points.)
- **Q12 = A.** "For an easier game, begin with Apocalypse (I)" is an optional setup change, off by default on
  standard. It is not what skirmish mode means.
- **Q13 = A, with a note.** A player card may legally discard No Longer Worthy, which can make the scenario
  unwinnable. No rule requires a confirmation; the confirm prompt is our UX protection, not an FFG rule, and the
  client must word it that way.
- **Q14 = B (not the proposed default).** The player who defeated the attached minion resolves the Setting
  environment's Special; the text does not hand it to the engaged player. The spec's option B adds "nobody, if no
  player did", which is what gets built unless the owner says otherwise. Note for the spec: the owner's reasoning
  calls it a When Defeated ability; the card (45145) prints "Forced Interrupt: When attached minion is defeated".
  The answer is the same either way.
- **Q15 = A.** No rule limits a game to one environment or one Setting. Several can be in play, and where a card says
  "the Setting environment" and more than one qualifies, the resolving player chooses. No setup restriction.
- **Q16 = A.** The three-sided Apocalypse keeps his current form when stage II replaces stage I: defeated as
  Cyberpath, stage II is revealed as Cyberpath; as Giant, Giant. Biomorph is named for setup only.
- **Q17 = A.** Police State finds Escaped Mutant where it is. If it is already attached to a player it stays there;
  nothing detaches or moves it (Magistrate, by contrast, says to attach it to the defeating player's identity).

## Rules answers from the owner (2026-10-07, third set): questions 18 to 40

Answered in the project thread on 2026-10-07 for spec passes 1c, 2a and 2b (`docs/phase7-wave8.md` §4.2). Held here
while a spec agent has the spec file open; the main session copies them into §4.1 when pass 2c is committed.
**Five differ from the proposed default: Q19, Q22, Q26, Q31 and Q33, all B.**

The campaign (pass 1c):

- **Q18 = A.** Cards in the mission area are in play; counting or watching them does not affect them, so "side schemes
  in play" and "after a side scheme is defeated" see them.
- **Q19 = B (not the default).** MC45 p. 5: cards in the mission area "cannot be affected by card abilities unless the
  ability refers to the mission area". Upgrades may be attached there, but that does not waive the restriction: an
  ordinary upgrade's constant ability does not modify the ally. Only a card whose ability works with the mission
  (Desperate Measures) has an effect there.
- **Q20 = A.** A finished mission is cleaned up with the rest of the mission area; the Finished face does not stay in
  play as a side scheme.
- **Q21 = A.** There are five physical Overseer / Prelate cards. The one serving as the mission's Overseer is not
  available as a Prelate in scenario 3: four Prelates are set aside.
- **Q22 = B (not the default).** Mission and Overseer are chosen at random during scenario setup, and the log changes
  only through the Victory instructions. A lost scenario that is retried runs setup again: **redraw the mission and
  the Overseer** from what is still available. (The campaign runner restores the campaign's RNG on a retry today, so
  this needs a fresh draw per attempt; see spec §2.11.)
- **Q23 = A.** Cards 164 to 183 are campaign cards (MC45 p. 4), including Agent of Apocalypse and Worldwide Crisis
  (45164, 45165): campaign only, never a standalone modular set.
- **Q24 = A.** "An upgrade / support from any aspect" is an aspect card; basic is not an aspect.
- **Q25 = A.** As Age of Apocalypse prints it: the reward does not count against the minimum deck size only. A deck of
  39 ordinary cards plus the reward is legal; a deck already at 50 must drop a card to take it.

Bishop and Magik (pass 2a):

- **Q26 = B (not the default).** With Magik's text box blank her top card is facedown, and the game does not read a
  hidden card to answer an icon question: a facedown top card satisfies no condition.
- **Q27 = A.** Magik may play her top card through another "play a card from your hand" effect (the RRG p. 64 FAQ
  names Team-Building Exercise), and both cost reductions apply.
- **Q28 = A.** Overpaid resources were not paid (RRG "Cost"). Bishop's "paid with a resource card" is true only when
  a resource card's resource went toward a cost of at least 1; never at cost 0.
- **Q29 = A.** "Ready your sidekick" is a cost, and a cost that changes nothing cannot be paid: Side-by-Side is not
  playable while the sidekick is already ready.
- **Q30 = A.** Suit Up (errata, RRG p. 69): eligibility comes from the upgrade's own attach text; no ally host needs
  to be in play, and the board state is not evaluated.
- **Q31 = B (not the default; "RAW pending FFG clarification").** Witchfire 45057 is built as printed: an attack of
  hers that does not defeat an ally sends the effect to the "Otherwise" clause, threat on the main scheme. No erratum
  or ruling says otherwise; if FFG rules it was meant to read like S'ym and Trevor Fitzroy, change it then. Mark the
  script and its test with this note.
- **Q32 = A.** Colossus 45031's Interrupt plays him and makes him the defender, which the mission area cannot
  satisfy: that play goes to the player's own area only. Ordinary ally plays keep the mission choice.

Iceman and Jubilee (pass 2b):

- **Q33 = B (not the default).** The player declares a wild resource's type; the engine does not pick "the best" for
  them. The owner allows one shortcut: the prompt may be skipped when every declaration is provably equivalent.
- **Q34 = A.** Overpaid resources are not "used to pay": a cost of 3 reads at most three types.
- **Q35 = A.** Frostbite attached during an activation is still set aside after that activation; no grace activation.
- **Q36 = A.** Shopping Spree bars removal by heroes and allies; an alter-ego's Disguise removes threat from it (the
  owner cites FFG's Jubilee preview article, not in this repo).
- **Q37 = A.** Grounded's extra cost applies to a change to hero form "during your turn"; a forced change outside
  her turn does not pay it.
- **Q38 = A.** Snow Clone and Chamber keep their consequential-damage reduction when the attack defeats the enemy
  (FFG's intent, ruling February 8, 2026 - Ruling 1).
- **Q39 = A.** With a Jubilee hero in the game the ally Jubilee from Mutants at the Mall never enters play (the unique
  rule; RRG 1.8 errata for Mutants at the Mall #88A, markdown line ~5010, checked by the main session to exist).
- **Q40 = A.** Serve and Protect needs two characters, one X-Force and one X-Men; one character with both traits
  cannot be exhausted twice.
