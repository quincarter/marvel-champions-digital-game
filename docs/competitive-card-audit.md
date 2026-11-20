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
| 57075 | Synthezoid Strike                             | Leader-vs-leader attack; mass form Dense: +1 ATK and piercing; Intangible: flip to Dense first                        | **unscripted**: primitives exist (`enemyAttacksEnemy` `atkBonus`, `keywords`); the Intangible bullet reads two ways (section 4, finding 3)       |
| 57076 | Phased Out                                    | Discard a Hero Response/Interrupt attachment on the enemy leader                                                      | scripted with `printsAbility` (Hero Action or Hero Response, current text); the query is asserted, the fixture leaders carry no real attachments |
| 57077 | Android Assistance                            | Hero Interrupt: when you spend it, flip your leader's mass form attachment                                            | passed (two-team test, `synthezoid-leaders.test.ts`); the Dense face on the leader in the other area flips                                       |

## 3. Standard PvP cards

Two printings per product (Q15: identical in play). Existing coverage is `standard-pvp.test.ts` (mostly STAGED, plus
the two-team values) and `choosing-sides-reward.test.ts`; none of it is a card-by-card two-team audit yet.

| Ids                                     | Name                               | Behaviour to check in competitive play                                                                                                           | Status                                                                                           |
| --------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 56125, 56203 (MC57: 57036, 57078)       | Righteous Cause                    | When Revealed: the enemy leader schemes; extra boost card with 2+ on your team                                                                   | todo (group 3)                                                                                   |
| 56126, 56204 (57037, 57079)             | Whatever It Takes                  | Alter-ego: the enemy leader attacks your leader; hero: it attacks you (boost per N9/N10)                                                         | todo (group 3)                                                                                   |
| 56127, 56205 (57038, 57080)             | Targeted Strike                    | When Revealed: enemy team searches top 5, deals a card to you facedown; Boost: +1 icon per player on your team                                   | todo (group 3)                                                                                   |
| 56128a/b, 56206a/b (57039a/b, 57081a/b) | Choosing Sides / Now It's Personal | Permanent; enemy leader takes at most 2 per attack; Forced Response when cleared searches top 5 for 1 per hero and deals them; flip (Q12 reward) | todo (group 3); the cap vs Energy Channel's attack is covered by `energy-channel-leader.test.ts` |

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
3. **Synthezoid Smackdown leader cards:** seven of eight scripted and audited. 57074 Calculated Risk uses two new
   primitives (`shuffleEncounterDeck` `deckOf`, and the `firstPlayer` ref with `of: "enemy"`, the enemy team's token
   holder). 57075 Synthezoid Strike has its primitive (`enemyAttacksEnemy` `atkBonus` and `keywords`, this attack only)
   but waits on a rules question: "If Vision's mass form attachment is: Dense, +1 ATK and piercing; Intangible, flip it
   to Dense before resolving this attack." Read once, as the card resolves (an Intangible Vision flips and gets no
   bonus), or after the flip (an Intangible Vision flips and then gets +1 ATK and piercing as Dense)?
   An outer query's `anyGameArea` now carries into its `anyOf` alternatives and its `not` (engine `explainQuery`), so
   it need not be repeated inside them.

## 5. Pool cards whose responses or interrupts can fire on the other team's turn

Examples by category, to be audited after the leader and Standard PvP groups (not every card):

- **Triggers on an enemy attacking or being attacked across areas:** Energy Channel 56098 (counter when any hero, ally
  or leader attacks Captain Marvel), Superhuman Strength 57007 ("when it attacks" on the attacker), Cuts Both Ways 56050
  (defense interrupt: must stay unavailable when a leader attacks a leader with no defender).
- **Forced responses on schemes and phases heard by the other team's cards:** Public Outrage 56122b, Protect Secret
  Identities 57044b, Superhero Jailbreak 56202b, Cut Off Support 56063b, Open Rebellion 56172b, Vision's flip 57040; N8
  says phase begin/end events are heard only by the active team's area.
- **"When revealed" cards that move something between areas:** Drafted 56080, Switching Sides 56158, Venom 56087,
  Bullseye 56088, Tangled Up 56181, Luke Cage 56184 (boost and When Revealed hit your leader), Spectacular! 56182,
  Neighborhood Hero 56183, Cloak 56194.
- **Hero interrupts and responses that react to damage, threat or defeat on any area:** damage prevention interrupts,
  "after an ally is defeated" responses, "after you thwart" responses when the thwart lands on the other area's main
  scheme; each must fire (or not) according to Q11 and N1/N2 ordering.
- **Obligation and nemesis forced effects:** an obligation shuffled into the encounter deck in the player's own area (Q16)
  firing during the other team's phase.
