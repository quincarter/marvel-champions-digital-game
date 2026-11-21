# Competitive card audit (M11, issue #883)

The owner's Q11+ decision (docs/competitive-mode-plan.md section 1.10, 2026-11-20): the inactive team takes no actions,
but its forced and triggered abilities fire during the other team's phases (No, You Move! 56207 on the enemy leader's
attack, Lie in Wait when Recruited by Cap 56209 engages a minion with you). This document lists every card in scope,
what to check, and how far each has got. A card is "passed" only when a real two-team game test proves it (tests use the
engine's competitive fixture, `packages/engine/src/testing/team.ts`; shared scaffolding in
`packages/cards/src/wave10/cw/competitive/audit/two-team.ts`). "STAGED" means the older tests drive the card in a
cooperative game with the competitive side stubbed, which proves the cooperative reading only.

Status legend: **passed** (two-team test green), **bug** (a failing test or a reported defect), **unscripted**,
**todo** (not audited yet).

## 1. Group 1: registration leaders' player cards (Civil War box, MC56 p. 3)

Tests: `packages/cards/src/wave10/cw/competitive/audit/registration-leaders.test.ts`. In the fixture p1 is the
registration team: "your leader" is leader two (in the resistance team's area), "the enemy leader" is leader one.

| Id    | Name                 | Behaviour to check in competitive play                                                                                                                                                | Status                                                                                                                            |
| ----- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 56129 | The Futurist         | Your leader schemes in its own area (threat on that area's main scheme), no boost card                                                                                                | passed                                                                                                                            |
| 56130 | Target Lock          | Leader-vs-leader attack (boost from the attacker's area deck, no defender); with [mental] paid, discards a Hero Response/Interrupt attachment on the enemy leader, never a Forced one | passed                                                                                                                            |
| 56131 | High-Tech Suit       | Attaches to your leader, counts as Tech; Hero Action "any player may trigger" discards it                                                                                             | **bug**: the controller (p1) cannot trigger it (see section 4, finding 2); the enemy team's player (p2) can, and that test passes |
| 56132 | Suit Up              | After you spend it, your leader gets a tough status card (not the enemy leader)                                                                                                       | passed                                                                                                                            |
| 56133 | Provoked Response    | Forced Interrupt on the enemy leader's attack on you: redirected to your leader, at most 3 damage, one boost card, card discarded                                                     | passed                                                                                                                            |
| 56134 | You Started This     | Leader-vs-leader attack; with [energy] paid, confuse the enemy leader                                                                                                                 | passed                                                                                                                            |
| 56135 | Alpha Flight Recruit | After energy counters are placed on your leader's Energy Channel, heal 1 from the ally; including when the enemy team's attack places them in its own phase (Q11)                     | **bug**: never finds the Channel (section 4, finding 1); passes with the one-line fix applied in the test                         |
| 56136 | Raw Power            | After you spend it, 2 energy counters on your leader's Energy Channel (not the enemy leader's)                                                                                        | **bug**: same finding as 56135                                                                                                    |

## 2. Remaining leader player cards

Group 2 (56207 to 56214, the resistance leaders): tests in `packages/cards/src/wave10/cw/competitive/audit/resistance-leaders.test.ts`; p2 (resistance) plays after p1 ends its turn, so "your leader" is leader one and "the enemy leader" is leader two.

| Id    | Name                                          | Behaviour to check in competitive play                                                                                | Status                                                                                                                                           |
| ----- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 56207 | No, You Move!                                 | Forced Interrupt on the enemy leader's attack: Cap's Shield (other area) goes to your leader, who takes the attack    | passed (also cross-area.test.ts), cross-turn not applicable (fires in the leader's own team's villain phase)                                     |
| 56208 | Fighting Dirty                                | Leader-vs-leader attack; with [physical] paid, stun the enemy leader                                                  | passed (two-team test, `resistance-leaders.test.ts`)                                                                                             |
| 56209 | Recruited by Cap                              | A minion engaged with you engages a player on the enemy team; Lie in Wait (Hero Response) fires on the new engagement | passed, including the cross-turn Lie in Wait trigger in p2's hero phase (p1's 13017 deals 3 to the minion)                                       |
| 56210 | The People's Hero                             | After you spend it, your leader gets a facedown boost card                                                            | passed (two-team test, `resistance-leaders.test.ts`)                                                                                             |
| 56211 | Double Agent                                  | Remove 2 threat from the main scheme, place 2 on your leader's main scheme                                            | passed (two-team test, `resistance-leaders.test.ts`)                                                                                             |
| 56212 | Spider-Blast                                  | Leader-vs-leader attack; with [mental] paid, confuse the enemy leader                                                 | passed (two-team test, `resistance-leaders.test.ts`)                                                                                             |
| 56213 | Hard to Hit                                   | Attaches to your leader, tough status as it enters; after she attacks, 2 skill counters on her Finesse, then discard  | passed, including the cross-turn Finesse counters in team one's villain phase                                                                    |
| 56214 | Secret Contact                                | After you spend it, 2 skill counters on your leader's Finesse                                                         | passed (two-team test, `resistance-leaders.test.ts`)                                                                                             |
| 57032 | You're Out of Order! (She-Hulk, registration) | Interrupt: when threat would be placed on the main scheme, prevent 3                                                  | passed (two-team test, `synthezoid-leaders.test.ts`); threat placed in p1's own villain phase is prevented                                       |
| 57033 | She-Hulk Smash                                | Leader-vs-leader attack; with [physical] paid, stun the enemy leader                                                  | passed (two-team test, `synthezoid-leaders.test.ts`)                                                                                             |
| 57034 | Make Me Angry                                 | Attach to your leader; Forced Response: after a hero or leader attacks her, she attacks that character, then discard  | passed (two-team test, `synthezoid-leaders.test.ts`), both a hero and a leader attacking her                                                     |
| 57035 | Legal Counsel                                 | Hero Response: after you spend it, move 1 threat from the main scheme to your leader's main scheme                    | passed (two-team test, `synthezoid-leaders.test.ts`); moves across areas                                                                         |
| 57074 | Calculated Risk (Vision, resistance)          | Search top 5 of your leader's encounter deck, deal a card facedown to the enemy team's first player                   | passed (two-team test, `synthezoid-leaders.test.ts`); searches the other area's deck, deals to p2, shuffles that deck only                       |
| 57075 | Synthezoid Strike                             | Leader-vs-leader attack; mass form Dense: +1 ATK and piercing; Intangible: flip to Dense first                        | passed (two-team test, `synthezoid-leaders.test.ts`); reading A (plan section 1.10): Dense +1/piercing, Intangible flips only                    |
| 57076 | Phased Out                                    | Discard a Hero Response/Interrupt attachment on the enemy leader                                                      | scripted with `printsAbility` (Hero Action or Hero Response, current text); the query is asserted, the fixture leaders carry no real attachments |
| 57077 | Android Assistance                            | Hero Interrupt: when you spend it, flip your leader's mass form attachment                                            | passed (two-team test, `synthezoid-leaders.test.ts`); the Dense face on the leader in the other area flips                                       |

## 3. Standard PvP cards

Two printings per product (Q15: identical in play), each distinct card tested once per printing (MC56 registration and
resistance, MC57 registration and resistance) in `packages/cards/src/wave10/cw/competitive/audit/standard-pvp.test.ts`.
`standard-pvp.test.ts` one folder up keeps the registry checks and the STAGED cooperative readings;
`choosing-sides-reward.test.ts` covers Now It's Personal's reward by surgery.

| Ids                                     | Name                               | Behaviour checked in the two-team game                                                                                                                                                                         | Status                                                                                              |
| --------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 56125, 56203 (MC57: 57036, 57078)       | Righteous Cause                    | The enemy leader of the revealing team's area schemes on that area's main scheme, one boost card; a team of two gets the extra boost card; revealed in team two's area it is leader two                        | passed (all four printings; 2v2 extra boost)                                                        |
| 56126, 56204 (57037, 57079)             | Whatever It Takes                  | Hero form: the enemy leader attacks you (a second attack that round). Alter-ego: it attacks your leader, no defender, one boost card from the attacker's area deck (ATK 2 + 3 icons = 5)                       | passed (all four printings)                                                                         |
| 56127, 56205 (57038, 57080)             | Targeted Strike                    | The enemy team's first player searches exactly the top 5 of your area's deck, the pick is dealt to you facedown, that deck (only) shuffles; Boost: one icon per player on the activating team                  | passed (all four printings; Boost on 1v1 and 2v1 sizes)                                             |
| 56128a/b, 56206a/b (57039a/b, 57081a/b) | Choosing Sides / Now It's Personal | Joins the area; enemy leader takes at most 2 per leader attack, the other team's leader all of it; cleared: 1 pick per hero by the enemy team, dealt facedown, deck shuffles, flip; Now It's Personal's Action | passed, except the flip's hand-over (**bug**, section 4 finding 4); 2v2 picks (5 then 4 cards) pass |

## 4. Findings so far

1. **Energy Channel query lacks `anyGameArea` (56135 Alpha Flight Recruit, 56136 Raw Power).** In
   `packages/cards/src/wave10/cw/competitive/leader-cards.ts`, `YOUR_ENERGY_CHANNEL = query("attachment", { name: "Energy
   Channel", host: yourLeader })` finds nothing for the registration player: a query is limited to the player's own game
   area unless `anyGameArea: true`, and "your leader" sits in the other team's area (verified: the same query returns the
   Channel only with `anyGameArea: true`). Raw Power places no counters and Alpha Flight Recruit never heals. The earlier
   tests only covered the negative case (no counters on the enemy leader's Channel), which passes vacuously. The fix is
   one line (`anyGameArea: true`); the test file runs the shipped scripts under `it.fails` and the fixed scripts as
   ordinary tests, which pass, including the cross-turn case (p2's basic attack on your leader in p2's hero phase places
   a counter on the Channel and your Recruit heals). `YOUR_FINESSE` had the same shape and got the same fix (commit 5729d2b45); group 2 confirmed it (56214 Secret Contact and 56213 Hard to Hit pass).
2. **"Any player may trigger" resolves to the card's own game area (56131 High-Tech Suit).** `triggerableBy:
   eachPlayer` is "each player in the same game area as the card" (`resolvePlayers`, `packages/engine/src/select.ts`,
   from the Once and Future Kang insert). The suit sits on your leader, in the enemy team's area, so only the enemy
   team's players may trigger it and the card's own controller may not. Reading to settle: either the controller always
   may in addition, or "any player" means every player of either team in competitive play (the settled list says "any
   player"). Needs the engine owner and the rules expert.
3. **Synthezoid Smackdown leader cards:** all eight scripted and audited. 57074 Calculated Risk uses two new
   primitives (`shuffleEncounterDeck` `deckOf`, and the `firstPlayer` ref with `of: "enemy"`, the enemy team's token
   holder). 57075 Synthezoid Strike uses `enemyAttacksEnemy` `atkBonus` and `keywords` (this attack only), on reading A
   as the rules expert settled it (docs/competitive-mode-plan.md section 1.10; FFG ruling Feb 28, 2026 #5): a Dense
   Vision gets +1 ATK and piercing; an Intangible one flips to Dense first and gets only Dense's printed +1 ATK.
   An outer query's `anyGameArea` now carries into its `anyOf` alternatives and its `not` (engine `explainQuery`), so
   it need not be repeated inside them.

4. **Now It's Personal stays in the villain area after the real flip (56128b / 56206b / 57039b / 57081b).** The
   Forced Response flips Choosing Sides with `flipCard(self, { controller: firstPlayer })` ("Give to the first player",
   MC56 p. 16), but `relocate` in `packages/engine/src/resolve/other-face.ts` has no case for an obligation face: it falls
   to the default and leaves the card in the villain area with `controllerId: null`, not in p1's play area (verified; its
   Action still resolves for p1). The reward test puts it into p1's play area by surgery, so it never saw this. Four
   `it.fails` in `audit/standard-pvp.test.ts` (one per printing). Engine owner (`game-rules-architect`): not a card-script
   fix.
5. **Triggers with no query hear the other team's area (Black Widow 01075).** Her
   `when.encounterCardRevealedFromEncounterDeck()` names no query, so a card revealed in p2's area during p2's villain
   phase is offered to p1's Widow (MC56 pp. 16-17: abilities on your side ignore the other side). Enhanced Spider-Sense
   01004 is correctly ignored only because its `query("treachery")` is limited to the player's own area. So area
   isolation currently depends on each card's own selectors; any pool card whose trigger pattern names no query probably
   leaks the same way. `it.fails` in `audit/cross-turn.test.ts`. Needs an engine-level decision (scope the event's
   subject to the listening card's area unless the ability says `anyGameArea`).

## 5. Pool cards whose responses or interrupts fire on the other team's turn

Tests: `packages/cards/src/wave10/cw/competitive/audit/cross-turn.test.ts` (two-team game; p1 is inactive during p2's hero
phase and p2's villain phase). Settled by MC56 p. 16 "Card abilities on your side of the table completely ignore cards on
the other side ... unless they specifically refer to them", p. 17, and N8, N11, Q3 B, Q11. Each card has a test that it
fires while its team is inactive, or a control (fires for its own area in its own phase) beside a test that it does not
fire for the other area.

Tested (12 cards, one of them from group 2):

| Id    | Name                  | Category                                 | Result                                                                                                    |
| ----- | --------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 37004 | Gambit's Staff        | "When an enemy attacks" interrupt        | passed: fires in p2's hero phase when leader one (p1's enemy) attacks leader two; p2's staff does not     |
| 37011 | Bishop                | "After an enemy attacks you" response    | passed: not heard for leader one attacking leader two (N11), heard for the attack on p1                   |
| 01003 | Backflip              | defense-labelled interrupt on damage     | passed: only for the attack on p1; never for leader one's attack on leader two or leader two's on p2      |
| 09021 | Warning               | "a hero would take damage" interrupt     | passed: offered for p1's hero, not for p2's hero in p2's villain phase                                    |
| 01009 | Webbed Up             | forced interrupt, attached enemy attacks | passed: p2's Fighting Dirty makes the Webbed Up leader one discard it and be stunned instead of attacking |
| 01061 | Great Responsibility  | interrupt on threat placed on a scheme   | passed: p1 (inactive) takes p2's Double Agent threat on its own main scheme as damage                     |
| 08017 | Counterintelligence   | interrupt, threat on the main scheme     | passed: p1's upgrade prevents it; p2's upgrade ignores threat placed in area one                          |
| 01084 | Nick Fury             | end-of-the-round discard                 | passed: p1's Fury is discarded after phase 4, while p1 is inactive (Q3 B, N8)                             |
| 01004 | Enhanced Spider-Sense | treachery-reveal cancel                  | passed: cancels in p1's own phase, ignores a treachery revealed in p2's area                              |
| 01075 | Black Widow           | any-card-revealed cancel (ally, in play) | **bug** (finding 5): offered for a card revealed in p2's area (`it.fails`); control passes                |
| 01085 | Emergency             | "when the villain schemes" interrupt     | passed: leader one's scheme in p1's phase, not leader two's in p2's phase                                 |
| 13017 | Lie in Wait           | minion engages you response              | passed (group 2, `resistance-leaders.test.ts`, Recruited by Cap, in p2's hero phase)                      |

Not tested, by category (the same selector shapes as the tested ones, but not proven):

- **Interrupts on damage:** Cosmic Flight 01017, Shield Block 03005, Wiggle Room 05005, Energy Barrier 05017, Defensive
  Stance 08032, Side Step 14015, Magic Shield 15008, Booster Boots 16052, In Defiance 16153, Armor Plating 16162, Jet Boots
  17008, Crosscounter 18004, Parry 19006, Deflection 19015, Shield Spell 21061, Stand Together 23034, Protector 26014,
  Bio-Synthetic Wings 13009.
- **"(attack/defense)" or "(defense)" enemy-attacks interrupts:** Shadow and Steel 32021 / 32050, Brazen Defense 32178,
  Mutant Protectors 32017, Quick Shift 32040, Aerial Agility 42004, Energy Conversion 45009, Psychic Misdirection 34033,
  Flash Freeze 36012. Open question for the owner: N11 says defense-labelled abilities stay excluded from a leader attacking
  a leader; does "(attack/defense)" count as defense-labelled? A probe showed Shadow and Steel not offered to p1 on leader
  one's attack on leader two (so the exclusion holds in practice), but it is not asserted.
- **"After the villain/an enemy attacks you":** Payback 19007, "You'll Pay for That!" 10016, Morlock 40079, Bishop's
  sibling Counter-Punch (Core).
- **Reveal cancels:** Get Behind Me! 01078 (same shape as Enhanced Spider-Sense).
- **Threat prevention or redirect:** Serve and Protect 47029, Not my Responsibility 44022 (same shape as Great
  Responsibility and Counterintelligence), Justice Served 22014 and Surprise! 32187 / 32191 (thwart responses), Quake
  08012 (a minion schemes; needs a minion on a side).
- **Obligation and nemesis forced effects, Spider-Tracer 01007 (attached minion defeated), Regroup 19032 (round-end
  discard):** none.
- **The leader-cross cards listed in the first draft of this section** (Energy Channel 56098, Superhuman Strength 57007, Cuts
  Both Ways 56050, Public Outrage 56122b, Protect Secret Identities 57044b, Superhero Jailbreak 56202b, Cut Off Support
  56063b, Open Rebellion 56172b, Vision 57040, Drafted 56080, Switching Sides 56158, Venom 56087, Bullseye 56088, Tangled Up
  56181, Luke Cage 56184, Spectacular! 56182, Neighborhood Hero 56183, Cloak 56194): not yet audited.
