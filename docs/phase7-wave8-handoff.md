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

## State

The PR's checklist is the live record.

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
