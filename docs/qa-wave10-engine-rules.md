# Wave 10 QA: the engine-wide rule changes and their effect on older content (waves 1 to 9)

Rules-QA pass of 2026-10-13 on `feature/wave-10` (HEAD 009c0f18). It takes the engine rule changes of
`git log bb454d27..009c0f18 -- packages/engine` and tests them against OLDER cards, which the five wave 10 card audits did
not look at. Finds and proofs only: no engine, script, data or existing-test edits.

New files (all under `packages/cards/src/`):

- `qa-wave10-engine-threat.qa.test.ts`: change 1, 44 tests (12 pin bugs with `it.fails`)
- `qa-wave10-engine-reveal.qa.test.ts`: changes 2 and 3's neighbours, 5 tests (1 `it.fails`)
- `qa-wave10-engine-costs.qa.test.ts`: changes 4, 6, 7, 21 tests
- `qa-wave10-engine-find.qa.test.ts`: change 5, 8 tests
- `qa-wave10-engine-soak.qa.test.ts`: soak, 26 games in the default sample (about 45 s), 51 with `QA_WAVE10_FULL=1`
- `testing/wave10-engine-qa-bench.ts`: bench helpers (a plain minion on the Rhino table, `encounterTop`, `driveWith`)

Typecheck (`@mc/cards`), oxlint and oxfmt are clean on them. `it.fails` was checked one by one: each fails for the reason
named below (by running a copy with `it.fails` turned into `it`), not for a staging error.

## Result in one paragraph

No blocker. Four should-fix findings (one is rule 1's own listed example), three minor ones, and five rulings the owner's
answers and the RRG leave open (A as built / B). The new rules hold up on the older content that I could reach: the pure
thwart events are refused with no threat and played with some (20 cards), cards with a part of their own stay playable, a
confused hero still attempts a thwart, Crushing Blow's restriction still binds, Into the Fray reads damage taken with and
without Follow Through, Rogue's Find shuffles only her deck beside Hercules' Labor/Gift decks and every older scenario
deck, the older identity Setups resolve once, and a granted Quickstrike (The Mojo Files) now follows the When Revealed.

## Counts: what was checked per change

| Change                   | Cards / games checked                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 threat-removal targets | A sweep of all 130 player events whose script removes or moves threat, each played at 0 and at 8 threat (a scratch sweep, not kept); 20 pure removal events pinned (refused at 0, played at 8); 5 events with a part of their own; 3 confused plays; 2 upgrades (Mark V Helmet, Hyper Thrusters); Quasar; 4 "choose one" cards; 4+3 branch/cost-arrow bugs |
| 2 reveal order           | Vulture 01167, Iceman 38010, Looking for Trouble 16043, The Mojo Files 39047, Werewolf Pack 39052, Wade Cole 38032, Murray Reese 38033, Cybernetic Enhancements 38035 (7 scenarios); soak                                                                                                                                                                  |
| 3 entered-since (43B)    | Soak invariants only. No older real-card scenario was built (see "Not covered")                                                                                                                                                                                                                                                                            |
| 4 excess damage          | Into the Fray 13013 and Follow Through 16045, 8 variants (with and without Follow Through, tough, prior damage)                                                                                                                                                                                                                                            |
| 5 finds                  | Rogue 38001a "Find Touched" with Hercules seated, in 8 scenarios with a scenario deck or none (Rhino, Crossbones, Red Skull, Thanos, Loki, Sabretooth, Spiral, M.O.D.O.K.)                                                                                                                                                                                 |
| 6 costs                  | Speed Cyclone 14006 and Lethal Intent 22010 (X = 0, 1, 2, 3; too few targets; no technique upgrade), Crushing Blow 10002 (every hand card), every cost-0 event/ally/upgrade/support in the pool played with an empty payment, the 13 Alliance cards read (none prints a helper-payable non-resource part, as the engine test file also found)              |
| 7 setup abilities        | 9 older identities with a Setup (Captain America, Star-Lord, Spectrum, Vision, Valkyrie, Colossus, Shadowcat, Phoenix, Rogue): each resolves exactly once. The census shows no older non-identity player card with a Setup, so nothing else could newly fire                                                                                               |
| 8 smaller                | Not Today! and Desperate Defense have their own CI tests (48917d3f); one probe of mine was mis-staged (the card was not paid) and proved nothing, so I report it as not covered                                                                                                                                                                            |
| Soak                     | 26 games by default (every second playable scenario, heroes rotating through 19 older starter decks, a quarter with two seats incl. Hercules, Wonder Man, Angel; expert in a fifth), 22 commands per seat, invariants below. All 26 pass; the full 51-game run also passes ("Soak")                                                                        |

## Bugs

### Should fix

**S1. A stunned minion's Quickstrike attack is not cancelled.** RRG 1.8 "Stun" (p. 41): "When this character would attack, remove
each stunned status card from it instead." `quickstrikeAttack` (`resolve/enter-play.ts`) pushes the `enemyAttack` event straight
away and never reads the minion's status, so the minion attacks in full and keeps its stunned card (ordinary activations,
`villain/phase.ts`, do cancel). Reachable with any stun that lands before the attack: the answer-38A order (a put-into-play
minion hears its enters-play Responses first, so Iceman's "stun that minion" lands before Quickstrike), or a minion already
stunned. Pinned: `qa-wave10-engine-reveal.qa.test.ts`, "a stunned minion put into play with Quickstrike does not attack"
(`it.fails`; Looking for Trouble 16043 puts a pre-stunned Vulture into play: 3 damage is dealt, stunned stays 1). Owner of the
fix: `game-rules-architect`.

**S2. A removal inside a branch, or modified by a rider, counts as a part of its own, so a pure thwart is played with no threat
anywhere (owner rule 1, "a card whose every part is such a removal cannot be played").** `abilityTargetFault` judges only the
opening choices and top-level removals (`spentRemovals`); an `if` branch around the removal is not judged, and an `if` that
only modifies the removal counts as an independent part (`hasIndependentPart`). Sneak By ("Remove 3 threat from a scheme") is
refused; these are accepted and spent for nothing: Natural Flight 42006, Giant Help 13003, Crisis Averted 15012, Impede 18016,
and the upgrade Mark V Helmet 01037 ("Exhaust → remove 1 threat from a scheme", the owner's own example; it exhausts). Pinned:
`qa-wave10-engine-threat.qa.test.ts`, "BUGS: an event that is only a removal of threat ..." (4) and "BUGS: a removal inside a
branch ..." (1), all `it.fails`. Owner of the fix: `game-rules-architect` (judge removals inside `if` branches; a rider that
only modifies the removal is part of it), then `ability-scripting-engineer` for Natural Flight and Giant Help if they stay
shaped as branches.

**S3. A cost-arrow card whose effect is only a removal is played with no threat on the scheme.** RRG 1.8 "Cost" (p. 13): "An
ability's cost cannot be paid if that ability's effect requires one or more targets and there is not at least one valid
target." Looking for Trouble 16043 and 46017, and Defender of the Nine Realms 06003 ("put that minion into play engaged with
you → remove 3 threat from a scheme") are played with 0 threat: the minion is put into play, nothing is removed. The 2026-10-03
decision already refuses the same cards when the main scheme cannot be thwarted (patrol, crisis); the no-threat case slipped
through. Pinned (3 `it.fails`) in the same BUGS block.

**S4. A "choose one" offers an option that removes threat when no scheme has any.** RRG 1.8 "Choose (Option)" (p. 12): "When a
player card requires a player to choose an option, they cannot choose an option that cannot be at least partially resolved.
This includes options that ... require one or more targets and there are no valid targets." With no threat on any scheme the
removal option is still offered: Double Time 14004 (twice, as it lets you choose one option twice), Multi-Gun 20008, E.V.A.
40021, The Iliad 50009. Not tested but the same shape: Basic Spell 45051, Hogwashed 30004, Metro P.D. 32171b, Mission Team
45171a. Pre-existing rule gap more than a regression of this change, but change 1 makes the case reachable far more often.
Pinned: "BUGS: a 'choose one' offers an option ..." (5 `it.fails`; the Double Time control with threat passes).

### Minor

**M1. Lethal Intent 22010 with no technique upgrade in play is playable and does nothing** (and at X = 0). RRG 1.8 "Choose
(Game Element)" (p. 12): "An effect that can choose 'any number' of targets does not successfully resolve if zero of those
targets are chosen." "Up to X" with none to choose is the same shape. Documented by a passing test (see Q-B); no `it.fails`
because the rule says "any number", not "up to".

**M2. Photon Speed 21008 ("Change to Photon energy form and remove 4 threat from a scheme") is refused with no threat anywhere**
although its form change is a part of its own; under the owner's rule for mixed cards ("remove 2 threat ... and deal 1 damage
to an enemy" stays playable) it should be played. Found by the sweep; no test pinned because the owner's rule on form changes
is not written down (it is a target-free part). Worth a look with S2: the same `hasIndependentPart` function.

**M3. In Harm's Way 16160 ("Take 2 damage. Remove 5 threat from a scheme") is playable with no threat**; the damage is a part of its own, so this follows the rule as built; reported because a player pays 2 damage and a card
for nothing. See Q-D.

## Where the owner's answers and the RRG leave a real question (A as built / B)

**Q-A. A minion put into play without a reveal: Responses to its entering play before or after Quickstrike (answer 38A).**
FAQ "Widow's Bite (#10)" (p. 60) says "Keywords have timing priority over 'Response' abilities, so Quickstrike resolves first",
a sentence that is not limited to revealed minions; 38A keeps the opposite order for put-into-play minions (Moon Knight,
Looking for Trouble, nemesis minions, S.H.I.E.L.D. Soldier). Proved as built (A): Iceman's response lands first. With S1
fixed, the A order lets a response stun a nemesis minion before its Quickstrike; the B order (Quickstrike first) is what the
FAQ sentence says on its face. Test: `qa-wave10-engine-reveal.qa.test.ts`, "Looking for Trouble 16043 puts Vulture into
play".

**Q-B. X = 0 for printed-X cards that act on X chosen things.** 52B gives Everywhere All at Once 58018 `minX: 1`. Speed Cyclone
14006 ("Stun X Enemies") has the same shape and has no `minX`: X = 0 is accepted and stuns nothing (the card is spent).
Lethal Intent 22010 ("Choose up to X technique upgrades") is accepted at X = 0 and with no technique upgrade in play. Both
verified correct at X = 1, 2, 3: the cost is X (naming X = 2 and paying 1 is refused), too few enemies stuns every enemy
("as many as are available", p. 12), Lethal Intent with two upgrades resolves both Specials with an order prompt. A: as built
(allow X = 0). B: `minX: 1` on Speed Cyclone, and Lethal Intent needs a technique upgrade.

**Q-C. "Remove threat from EACH scheme" with no threat anywhere.** Hyper Thrusters 16164 and Quasar 21047 (and Mark V Helmet's
Aerial branch). "Each" chooses nothing, so the RRG's target rule does not obviously apply; as built the upgrade is usable and
exhausts for nothing. A: as built. B: refuse like "a scheme". The owner's note named "from each scheme" as a risk.

**Q-D. A conditional or target-free part rescues a removal-only card.** Command Authority 45008 ("... If you paid with a
resource card, draw 1"), Rapid Deployment 31005, Behind Enemy Lines 20002, Flash of Light 47008 and In Harm's Way 16160 are
played with no threat because their rider or self-damage counts as an independent part even when the condition is not met.
A: as built (any part). B: the part must be able to resolve now.

**Q-E. A removal-only card in the Aerial or Giant branch** (Natural Flight, Giant Help) is S2's case; the owner may rather rule
that branches count as parts (A), which would turn S2's first two cards into "as designed".

## Interactions verified (passing tests, with their sources)

- **Change 1.** 20 pure thwart events refused at 0 threat with `no_valid_target`, played with threat (RRG p. 42; Sneak By,
  To the Rescue!, Sub-Orbital Leap, Gutsy Move, Set the Pace, Intimidation, For Justice! 21049, Lightspeed Flight, Airwalk,
  Mind Scan, "Yoo-Hoo!", Electromagnetic Blast, Feline Senses, Impersonation, Wisdom of Athena, Active Altruism, Inconspicuous,
  Running Interference, Clear the Area, Crisis Interdiction). Covert Ops 08003 (confuses the villain), Hit and Run 18020, Power
  Unleashed 16175 and Into the Fray 16042 stay playable. A confused hero plays Sneak By, For Justice! and Airwalk with no threat
  and the confused card is discarded (p. 13). Quasar's enters-play removal does not hold the game.
- **Change 2.** A revealed Quickstrike minion attacks before the Responses to its entering play (Vulture then Iceman: 3 damage,
  then the stun; RRG p. 38, FAQ #10). The Mojo Files grants Quickstrike to Werewolf Pack, whose When Revealed now defeats the
  ally first, so the ally is not among the defenders of the Quickstrike attack (p. 36). Wade Cole's Teamwork attack is made
  after Cybernetic Enhancements is attached (3 damage; the old order made it for 2), and the attachment is discarded after it
  (p. 43, 30B).
- **Change 4.** Into the Fray reads damage taken: 6 against 4 hit points removes 2 threat, 4 against 2 hit points left removes
  4; Follow Through adds 1 to each; a tough minion takes nothing, so Into the Fray removes 0 with or without Follow Through
  (40A, 50A; RRG "Overkill" p. 31).
- **Change 5.** Rogue finds Touched in her deck, attaches it, and shuffles only `{kind: "deck", playerId: p1}` in all eight
  scenarios; none of Hercules' Labor or Gift decks, the encounter deck, or a scenario deck (54B; RRG pp. 19, 39, 40).
- **Change 6.** Crushing Blow ("You can only spend [physical] resources") accepts exactly the hand cards that print physical or
  wild. Every cost-0 card in the pool is playable with an empty payment except those whose cost needs a choice (Make the Call,
  'Port Away, Hunted): the new pay step for cost-0 plays does not ask for payment where none is due.
- **Change 7.** Nine older identity Setups resolve exactly once at setup.

## Soak

`qa-wave10-engine-soak.qa.test.ts`. The greedy driver (no card names) plays to 22 commands per seat; then: every offered command
was accepted (the driver throws otherwise, and on "no choice pending and not a player turn"); a resting game is at a player
turn with a legal action; a pending choice offers at least its minimum; no trigger window offers a card in a deck; the stack is
empty at rest; no card is in two zones; no negative damage, threat or counters; no more than two stunned or confused cards; the
log replays to a deep-equal state (one game in three). Default sample: 26 games, all pass, 45 s on a loaded machine. Full run
(`QA_WAVE10_FULL=1`, every scenario that takes a modular set, checkpoints at 12 and 36 commands per seat, a replay each): 51
games, all pass, 287 s on a loaded machine.

## Not covered

- **43B (entered-since) on real cards.** The soak asserts that no window opens for a card in a deck, but I built no older
  real-card scenario for an ally played in response, a controller change, a flip, or an upgrade attached during an attack
  answering "after this attack" (the engine file `entered-since.test.ts` covers them with stubs). The most likely older
  interaction is a Response whose card enters play during the very event it answers (Hawkeye, Iceman); Iceman's response
  to Looking for Trouble's put-into-play minion works.
- **Held Responses for non-minion reveals (35B)** on real older cards (a side scheme or attachment with an enters-play
  response), surge after a held response, and a response that removes the revealed card before its held responses: engine stubs
  only.
- **First player orders Quickstrike and Teamwork (34B/37A)**: no older minion has both.
- **Alliance cost parts (48B)** on real cards: none of the 13 Alliance cards prints a helper-payable non-resource cost; Problem
  Solvers, As One!, Gunboat Diplomacy and Combine Forces name cards to exhaust, not parts a helper can take over whole.
- **`additionalAttackCost` by enemy, `healCost`, conditional additional play cost, reductions bound to found cards, reduce next
  cost to 0**: no older card uses them (wave 10 cards only; the wave 10 audits cover them).
- **Smaller changes (8)**: Ionic Physiology is wave 10; the deck checker's article was not exercised; Not Today! and Desperate
  Defense have CI tests of their own and my one probe was mis-staged.
- **Encounter-side removal of threat** (a villain or treachery removing threat) cannot be refused by `abilityTargetFault`
  (it judges player-initiated abilities); the soak ran 26 games with no soft-lock, no direct test.
- Confused ally thwarts, patrol/crisis cards with no threat, basic thwart riders ("after this ally thwarts ...": with no threat a
  basic thwart cannot be initiated at all by RRG p. 44, so the rider is unreachable by design).
