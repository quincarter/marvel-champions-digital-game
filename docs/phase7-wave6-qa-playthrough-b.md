# Wave 6 QA playthrough B: Cyclops, Phoenix, Storm

Branch `feature/wave-6` (PR 94). 2026-10-04. Headless Chromium (`--use-angle=metal`), real mouse and touch input, the
Vite dev server on a clean clone, URL `?unlock=all`. State was read through the dev hooks and the store only. Every
game went through the real screens (New game, Scenario select, Take your seats, Set the table, Deal it out), except
the seed searches, which only read a fresh deal. Screenshots: the scratchpad folder
`qa-b-16041/shots/` (371 files, named `<hero>-<scenario>-<NN>-<what>.png`; the scratchpad is session-local, so the
file names below are the pointer).

## What was played

| Hero            | Scenario                                | Viewport | Rounds                                                                  |
| --------------- | --------------------------------------- | -------- | ----------------------------------------------------------------------- |
| Cyclops         | Sabretooth, standard                    | 1440x900 | 4 (lost in round 4 to Robert Kelly leaving play)                        |
| Cyclops         | Project Wideawake, expert               | 1440x900 | 4 (lost in round 4, hero down)                                          |
| Cyclops         | Sabretooth, standard                    | 390x844  | 3 (lost in round 3, hero down)                                          |
| Phoenix         | Master Mold, standard                   | 1440x900 | 2 (lost, main scheme completed) plus 2 shorter reruns for Psychic Manipulation |
| Phoenix         | Magneto, standard                       | 1440x900 | 2 (lost, hero down)                                                     |
| Phoenix         | Master Mold, standard                   | 390x844  | 1 (opening turn only: flip, hero panel, play area)                      |
| Storm           | Mansion Attack, standard                | 1440x900 | 1 (lost in round 1)                                                     |
| Storm           | Sabretooth, standard                    | 1440x900 | 3 (lost in round 3)                                                     |
| Storm           | Mansion Attack, standard                | 390x844  | Setup and opening turn only (Weather pick, hero panel, Weather deck)    |
| Cyclops+Phoenix | Sabretooth, standard                    | 1440x900 | 3 plus the villain phase of round 3 (still going; no loss)              |
| Phoenix+Storm   | Master Mold, standard                   | 1440x900 | 2 (lost in round 2)                                                     |
| How to play     | hub, both box pages, Storm and Phoenix Try-it | 1440x900 | Storm to completion; Phoenix to its fifth step (see HTP-4)         |
| How to play     | Storm Try-it                            | 390x844  | to completion                                                           |

The games were lost on purpose or by a simple heuristic player; the point was to reach cards, not to win. Rounds are
fewer than four for Phoenix and Storm because the heuristic player was killed early by Master Mold, Magneto and
Mansion Attack at standard; the Phoenix and Storm cards below were still all driven. I did not play four full rounds
of Phoenix or Storm on either scenario, so treat the Phoenix/Storm "rounds 3 and 4" behavior as not covered.

## Defects

Severity key: blocker, wrong rule, UI defect, polish. Owner is my guess.

| ID    | Where (hero / scenario / screen / viewport)                         | What I did                                                                                       | Expected (cite)                                                                                                                                                                             | Actual                                                                                                                                                                                                                                                    | Severity  | Screenshot                                                                                          | Owner                       |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- | --------------------------- |
| QB-1  | Cyclops / Sabretooth / Game over / 1440                             | Let an undefended attack kill Robert Kelly (R4)                                                  | "If Robert Kelly leaves play, the players lose the game" (The Injured Senator, 32064; Stalked by Sabretooth, 32063): the screen should say a card ended the game                            | "THE SCHEME WINS", final blow "THE INJURED SENATOR HIT 9 THREAT: the last 1 threat went on in round 4". Outcome reason was `cardAbility`; `game-over-model.ts` sent it to the scheme-win default branch. Log line "Robert Kelly took 5 damage from Robert Kelly" (source should be Sabretooth) | UI defect | `cyclops-sabretooth-r4-end-gameover.png`                                                            | client (fixed in `fa70f24b`; the log wording is separate: engine/client log) |
| QB-2  | Storm / Mansion Attack / Setup: Weather pick / 390x844              | Dealt a game on the phone; the Weather pick sheet opens                                          | Four Weather cards readable, one per tile (owner UI rule: nothing overlaps, no cut labels)                                                                                                 | The four cards are drawn 112 px wide at 79 px spacing, so each covers the next one's title ("Clear Ski", "Thunderstor"); Special text is unreadable; the source panel text above is cut ("Choose a support from")                                    | UI defect | `storm-mansion-phone-05-weather-pick.png`                                                           | client                      |
| QB-3  | Storm / How to play Try-it / completion toast / 390x844             | Finished the Storm lesson on the phone                                                           | The toast reads in full (two lines at most)                                                                                                                                                | "Try it complete — Nice work. Find the rest under New in this" is cut at the edge of the toast; the end of the sentence ("box, in How to play") is lost                                                                                                    | UI defect | `htp-storm-phone-99-complete.png`                                                                   | client                      |
| QB-4  | Cyclops / Take your seats > Deck Check / 1440                       | Opened Deck Check for the precon                                                                 | Short labels wrap rather than end in "…"; card text readable                                                                                                                               | Card names end in "…" ("EXPLOIT WEAK…", "FIELD COMMA…", "PRACTICED DE…", "PRIORITY TAR…", "RUBY QUARTZ…", "TACTICAL BRIL…"); filter buttons "UPGRA…" and "RESOU…"; every tile's rules text is cut mid-line by the tile's bottom edge                       | UI defect | `cyclops-sabretooth-03-deckcheck.png`                                                               | client                      |
| QB-5  | All three heroes / Board hero panel / 1440                          | Looked at the hero panel on every board                                                          | Stat badge reads THW                                                                                                                                                                      | The THW badge label is cut to "TH…" on Phoenix, Storm and the Phoenix lesson (ATK and DEF are fine). The attached-upgrade chips are cut too ("PHOENIX FOR…", "STORM'S CAP…")                                                                                | UI defect | `phoenix-mastermold-08-payment-with-bond.png`, `storm-sabretooth-12-hurricane.png`                  | client                      |
| QB-6  | How to play / guide rail header / 1440                              | Played the Storm lesson to its completion panel                                                  | Rail title wraps or fits                                                                                                                                                                   | Collapsed-state title "STORM: THE WEA…" ends in an ellipsis                                                                                                                                                                                              | UI defect | `htp-storm-99-complete.png`                                                                         | client                      |
| QB-7  | How to play > New in Mutant Genesis > Phoenix Force / Rules reference | Opened the Phoenix Force entry                                                                   | Card chips under the Permanent glossary entry carry readable names                                                                                                                         | Chips read "Basic At…", "Basic De…", "Basic Re…", "Basic Th…" (four basic power cards listed as Permanent), "+31 MORE"; the names are cut                                                                                                                  | polish    | `htp-04-phoenixForce.png`                                                                           | client                      |
| QB-8  | Cyclops / any game with two Temporary tactics / villain phase end   | Ended the turn with two Temporary upgrades attached                                              | RRG p. 44 "Temporary": each is discarded at the end of the round; their order is irrelevant, so no prompt is needed (RRG p. 20 ordering applies where order matters)                        | A full-screen "order these effects" sheet ("SELECT 2 · ORDER MATTERS") opens for two Temporary discards. The caption bar on each card is cut mid-sentence ("Temporary — discard at the end of the"); after the first pick the sheet re-lays out into two stacked groups ("SELECTED 1" / "TAP TO ADD") with smaller cards, so the second card moves from beside the first to below it  | polish    | `cyclops-sabretooth-r1-end-choice3.png`, `cyclops-sabretooth-26-order-second-click.png`             | engine (needless prompt) + client |
| QB-9  | Phoenix / Master Mold / Psychic Manipulation window / 1440          | Opened the interrupt window; and a lone Phoenix response on Cyclops's side                       | A lone trigger reads as "use it or not"                                                                                                                                                   | "SELECT 0–1 · ORDER MATTERS" on a single-option trigger sheet                                                                                                                                                                                            | polish    | `cyclops-wideawake-expert-17-phoenix-response.png`                                                  | client                      |
| QB-10 | Phoenix / Sabretooth (crisis in play) / villain phase               | Held Psychic Manipulation with 5 resources; Find the Senator (crisis) was in play; Sabretooth schemed | Per the owner's 2026-10-03 decision, PM is not offered under crisis; the why-not text should say why                                                                                  | Correct that it is not offered. But nothing on screen says so: the villain-phase overlay shows no note, and Inspect says only "This event can only be played when its interrupt or response triggers." (also true when it is merely not your window)        | polish    | `phoenix-sabretooth-crisis-after.png`                                                               | client (why-not text)       |
| QB-11 | How to play / Phoenix Try-it                                        | Paid Firebird 1 with Firebird 2 (a legal spend)                                                  | The lesson survives a legal off-script spend                                                                                                                                              | Step `firebird-flip` ("Play Firebird with Psionic Bond") then needs a Firebird that is gone; the only way on is SKIP THIS STEP                                                                                                                             | polish    | `htp-phoenix-07-firebird-flip-no-firebird.png`                                                      | client (guide)              |
| QB-12 | Storm / Table setup                                                 | Looked for The Shadow King modular set on Table setup (Mansion Attack, Sabretooth)               | The brief says "if selectable": it is a Storm hero-pack modular set (36036-36039)                                                                                                           | Not offered. `CORE_MODULAR_SET_IDS` lists the five Core sets; scenario-recommended sets are added, but a hero-pack modular set is not. The set is only reachable in tests (`shadow-king/index.test.ts`)                                                  | polish (gap) | `storm-mansion-03-tablesetup.png`                                                                 | client / content (owner decision) |
| QB-13 | Phoenix+Storm / Take your seats / 1440                              | Seated Phoenix and Storm                                                                         | Soul Sisters (Team-Up Phoenix and Storm) is part of the pair                                                                                                                              | Seat panel says "Soul Sisters: in neither deck." Correct for the precons, but the pair cannot be played with the precons at all; Soul Sisters needs a built deck                                                                                         | note      | `phx-storm-04-both-seated.png`                                                                      | none (informational)        |
| QB-14 | Cyclops / Wideawake and Sabretooth / log                            | Used Ricochet Beam and Priority Target; read the log                                             | A prevented hit logs once                                                                                                                                                                 | Tough prevention logs two lines ("X took 0 damage." and "X took 0 damage —" with the status icon), and a 0 consequential-damage hit logs "Phoenix took 0 damage."                                                                                           | polish    | `cyclops-sabretooth-37-ricochet-vs-tough.png`                                                       | client (log)                |
| QB-15 | Cyclops / Sabretooth / phone log (unverified)                       | Round 2 of the phone game: Practiced Defense attached to Sabretooth, then the villain attacked   | Practiced Defense: attached enemy gets -1 ATK (33006). Sabretooth stage I ATK 2 becomes 1                                                                                                 | Log R2.13: "Sabretooth hit Cyclops for 0 (ATK 2 + 0 boost − 2 defense)", and Mystique (ATK equals the villain's) also ATK 2. On desktop (seed 6, no Mystique) Inspect shows "ATK 1 (−1)" and the log "ATK 1 + 2 boost" correct. Could not reproduce; maybe an extra +1 from the deal. Needs a look | open question | none (log lines only)                                                                   | engine / scripting          |

No blocker and no wrong-rule defect was confirmed. QB-15 is the only item that could be a rules defect, and I could not
reproduce it.

## Fixed in this run

- `fa70f24b`, QB-1: the game-over screen reads "A card ended the game" for a `cardAbility` loss, with a test in
  `game-over-model.test.ts`. **Warning:** another agent was editing the same hunk of `game-over-model.ts` in the shared
  worktree at the same moment, and `git commit -- <path>` took the whole file. The commit therefore also carries their
  `cardAbility` additions (`losingSentenceOf`, the `outcome.sourceInstanceId` read). Those depend on their engine edits
  (`packages/engine/src/state.ts`, `spec.ts`, `resolve/apply-effect.ts`, `packages/cards/src/dsl/effects.ts`), which were
  still uncommitted when I committed. Until that agent commits them, `fa70f24b` alone does not typecheck.

## Verified OK

Cyclops
- Deck Check accepts the precon (40 cards, LEGAL) with Dust (Aggression) and Blindfold (Justice) X-Men allies, through
  the alter-ego's "any aspect X-MEN ally" text.
- Constant Training (alter-ego, once per round): searches for a TACTIC upgrade, adds it to hand; the second use in a
  round is refused ("Limit 1 per round").
- Optic Blast: 3 damage to an enemy with an upgrade attached, +1 with Exploit Weakness (4 damage); costs one
  resource of any type; does not exhaust Cyclops; targets were only the enemies with an upgrade (Sabretooth, and Pyro
  with Priority Target); a Tough status absorbs the hit (the log shows the spent tough card).
- Full Blast stays in hand as "not an action" (Inspect: only when its interrupt triggers). I never had Optic Blast
  and Full Blast both available in one game, so Full Blast was not played: not covered.
- Ricochet Beam: 3 + 3, second target only among enemies with an upgrade attached. With Exploit Weakness on the one
  enemy, Optic Blast did 4 and Ricochet Beam then did 4 + 4 on it (12 total; the FAQ "Ricochet Beam (#9)" case).
  An attachment (Animal Ferocity) is correctly not an upgrade for the second target (the second prompt found nothing).
- Temporary upgrades are discarded at the end of the round (villain phase step 6), logged as "Temporary: discarded at
  the end of the round", leaving play together.
- Priority Target: "when defeated, the player who defeated it draws 2" (Pyro defeated, Priority Target offered as an
  interrupt, hand grew by 2).
- Coordinated Attack (-1 consequential damage for allies); Tactical Brilliance (removes 3 threat, offers the TACTIC
  cards in the discard pile, and Find the Senator was cleared and flipped to Protect the Senator, Robert Kelly then
  follows the first player).
- Phoenix (ally): Response puts the player's pick of Cyclops cards from the discard pile into hand.
- Field Commander attaches to the hero; the upgrade shows on the identity.
- Mystique blocks attacks on the villain; her ATK/SCH track the villain's.

Phoenix
- Setup: Phoenix Force RESTRAINED with 4 power counters on the alter-ego, flip to hero keeps them (4).
- Psionic Bond: tap the identity in the payment bar, counter 4 -> 3, once per phase (the second use is not offered).
- Phoenix Firebird: both options offered; "Remove 1 power counter → ready Phoenix" took 4 -> 2 with the Bond.
- Psychic Manipulation: not playable on your turn (Inspect: "This event can only be played when its interrupt or
  response triggers"); offered in the villain-phase interrupt window when a villain schemes; paying 3 with two cards
  removed the 1 threat instead of placing it (log: "Master Mold schemed, but removed 1 threat ... instead of placing
  it"). Not offered while Find the Senator (crisis) was in play (QB-10).
- Mutant Peacekeepers: shown "No target" while no scheme can be thwarted by X-MEN, "Exhausted" after the hero acts.
- Magneto (Phoenix): magnet counters 1 after the first Magneto attack, 2 after the second (Asteroid M); Boarding Party
  cleared by a thwart flips to Sabotage Master Mold (3 threat); Dark Phoenix arrived by "Shadow of the Past", Consume
  the World came in with 6 threat, Dark Phoenix attacked in round 2.
- Master Mold (Phoenix): Master Mold schemes put a Sentinel into play ("discard until a Sentinel ... engaged"), no boost
  for that scheme; main scheme advance on completion.

Storm
- Weather deck: setup pick offers the four Weather supports; one goes into play, the other three sit facedown in the
  Weather panel on the board, count 3; a store audit after every swap and every Special showed no Weather card in hand,
  deck, discard or the encounter deck, and the facedown deck always held the other three.
- Weather Control via Inspect: swaps and resolves the new Special (Hurricane removed threat from a scheme; Thunderstorm
  dealt 2 damage; Clear Skies; Blizzard with no minion in play); the swap left the old Weather in the facedown deck.
- Weather Goddess (hero action): swap plus Special. Storm's Cape: ready Storm after a Special, offered as a response
  (the Cape exhausted); Lightning Bolt with Thunderstorm in play: 8 damage, then the Special's 2 (log 8 then 2).
  Against Mansion Attack the hero panel and Blob show "+2" ATK: Thunderstorm +1 and The Courtyard "each character
  gains +1 ATK" (Blob 2 -> 4, Storm 2 -> 4 in Inspect).
- "To Me, My X-Men!": played from hand; the deck order changed afterward (shuffled), as the search rule requires.
  No X-MEN ally was in the top 5 in that deal, so the ally-into-play half is not covered.
- Hurricane gives retaliate 1 to every character (Sabretooth's Inspect: RETALIATE 1).
- How to play: the Storm Try-it ran to its completion panel at 1440 and 390 with no console errors.

Two-hero games
- Take your seats for Cyclops: the recommendation shelf's first tile is Phoenix, tagged "TEAM-UP WITH CYCLOPS" and
  "TEAM-UP · ADDS JUSTICE"; for Phoenix, Cyclops and Storm are tagged "TEAM-UP WITH PHOENIX".
- With Cyclops and Phoenix seated: the pair marker "TEAM-UP: CYCLOPS AND PHOENIX" and the side panel text ("Psychic
  Rapport: Cyclops's deck has 1; Phoenix's deck has 1"); the same-name sheet lists exactly the two conflicts (Cyclops's
  deck: Phoenix ally; Phoenix's deck: Cyclops ally), each "KEEP AS A RESOURCE" or replace, PLAY enabled only after
  both are answered. Phoenix+Storm: one conflict (Phoenix's deck: Storm ally); Storm's deck has no Phoenix card.
- In game: the splash opens the first time both are in hero form (art and title "TEAM-UP: CYCLOPS AND PHOENIX"),
  two rings appear (one per hero panel, 64 px), the hover label shows, clicking opens "Team-Up: Cyclops and Phoenix"
  with the card and its deck counts, the hand card carries a TEAM-UP tag, Inspect shows "Team-Up active: Cyclops and
  Phoenix are both in play, so this card can be played", and Psychic Rapport played ("Ready Cyclops and Phoenix",
  choose: return a Cyclops card or place 2 power counters on Phoenix Force: 4 -> 6).
- Per-seat turns, hot-seat hand-off after End turn, and the villain attacking each player in turn all behaved.

How to play
- The hub lists "Core rules added later" (5 entries) and "New in Mutant Genesis" (22 rows: 4 keywords, 7 hero mechanics
  including Cyclops: Tactic upgrades, Phoenix Force, Storm's Weather deck; 6 scenario mechanics; 6 Try-its). The three
  entries I opened (Tactic upgrades, Phoenix Force, Weather deck) read correctly against the cards and cite RRG pages.
- Storm Try-it: intro, flip, Weather Control, special-resolved, completion; Phoenix Try-it: intro, flip, psionic-bond,
  firebird-remove, end-turn, firebird-flip. There is no Cyclops Try-it (the box page has the Tactic upgrades entry only).

## Could not reach, or only partly

- Lost Visor (Cyclops obligation), Burning Hunger (Phoenix), Claustrophobia and its form lock (Storm): no obligation
  came up in the games I played. A seed search found deals with the obligation on top of the encounter deck, but the
  deck order after Table setup differed from a bare `store.start`, so the game I played did not show it.
- Phoenix Force flipping to UNLEASHED (and back) in a real game: the lesson reached 2 counters; no run got to 0.
- Dark Phoenix scheming onto Consume the World; Magneto's side-scheme caps; Field Commander's extra turn (needs two
  heroes with Cyclops not first player); Full Blast playing; Soul Sisters (not in either precon); Storm vs Mansion
  Attack beyond round 1; Cyclops vs Project Wideawake on the phone; a full phone game for Phoenix and Storm.
- Four full rounds for Phoenix and Storm (see "What was played").

## Notes for the harness

- The Seed field on the phone Table setup sits below the fold; a tap at its stop rect needs a scroll first (the stop
  rect is reported outside the viewport). Not a defect, but the e2e helpers that tap `seed` on the phone need it.
