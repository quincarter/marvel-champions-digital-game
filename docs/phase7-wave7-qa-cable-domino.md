# Phase 7 wave 7 rules-QA pass: Cable and Domino (`next_evol`, cards 40001-40049 and 40065-40069)

`rules-qa-engineer`, 2026-10-05. Scope: the box's two heroes with their precon cards, obligations and nemesis sets
(Cable 40001-40036, Domino 40037-40069) against RRG 1.8 and the post-1.7 rulings. Test file:
`packages/cards/src/wave7/next_evol/qa-cable-domino.qa.test.ts` (45 tests, about 28 s). No non-test code was touched.

## 1. Sources found

Searches: `mc_rulesreference_v18_compressed.md` (RRG page numbers are the table-of-contents numbers) and
`marvel-champions-rulings-post-rrg-1-7.md` for Cable, Domino, Stryfe, Topaz, Technovirus, Back to the Future, every card
title of both kits, "victory display", "resource icon", "swap", "stunned". **No ruling names a card of either hero.**
The rulings used are general:

| Source                                                                                                                                                     | Used for                                                                                                        | Where pinned                                                                            | Result       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------ |
| RRG "Labeled Ability" (p. 26), "Stun, Stunned" (p. 41)                                                                                                     | A stunned or confused hero using a labeled ability: canceled in full, costs paid, status removed                | Six tests in "Stunned and confused heroes ..."                                          | Pass         |
| Ruling August 13, 2026 - Ruling 1 (a stunned Attack event was still "played")                                                                              | Telekinetic Blast stunned: the event is in the discard pile, its cost paid                                      | same                                                                                    | Pass         |
| RRG "Move" (p. 30): threat moved off a scheme "is considered to be removed"                                                                                | Temporal Leap under Back to the Future                                                                          | "Temporal Leap cannot move threat off the main scheme ..."                              | Pass         |
| RRG "Target" (p. 42): a target that "cannot take damage" is not valid for an ability whose only effect on it is damage; owner ruling 2026-10-05 (spec 4.1) | Back to the Future's damage bans against every damaging card of the box                                         | Four `it.fails` (finding F1) and the passing damage-is-barred test                      | **Bug** (F1) |
| RRG "Hinder X" (p. 22); spec 4.1, 2026-10-05 amendment of Q30                                                                                              | Temporal Leap returning Making Green (40134): 2 + 2 hinder + 4 moved = 8, not revealed                          | "Temporal Leap returns Making Green ..."                                                | Pass         |
| RRG "Acceleration Icon" (p. 5)                                                                                                                             | Technovirus Resurgence's printed acceleration icon while attached to Purge                                      | "Technovirus Resurgence's printed acceleration icon"                                    | Pass         |
| Q29, Q31, Q32 = B, Q33, Q36 (spec 4.1)                                                                                                                     | Purge vs another hero's event; Painted Lady / Jackpot! competing for one discard; Back to the Future vs villain | "Technovirus Purge and Back to the Future with two heroes", "Domino: two responses ..." | Pass         |

Owner rulings were applied as written and not re-opened.

## 2. Card-by-card audit against the printed text

Compared the 54 card records (printed text, cost, resource icons, traits, keywords, limits, attach hosts) with each
script. **No mismatch found** between the data's printed text and any script: timing words (Hero Action / Alter-Ego
Action / Interrupt / Response / Forced), labels ((attack), (thwart), (defense)), costs, "max 3" on The Painted Lady, "limit
once per phase / round", Uses (none in the box), Restricted on Plasma Rifle and Domino's Pistol, Toughness on Outlaw,
Victory 0 on Technovirus Purge, hinder and amplify data all agree. Two judgments recorded rather than raised:

- Domino's Pistol prints "choose an enemy" inside its cost list; the script chooses the enemy as the first effect. Equivalent
  (RRG "Target": the cost is not considered when finding a valid target), no finding.
- Jackpot! has no printed icon in the corner; the engine counts its three produced icons (MC40 p. 21, spec 3.56). The January
  11, 2026 - Ruling 3 says a "printed resource" generated by an ability counts only when paying a cost. That ruling is about
  Nova's Bring the War!, and Domino's "resource icon discarded" reads icons on a discarded card, so it was not applied.
  Flagging it as the one place a later FFG answer could change the owner's call.

The card images were not compared to the data (no scans in the repo); the audit is against the ingested printed text.

## 3. What was exercised beyond the precon games

Tests, by group (all in the one file):

- **Stunned and confused.** Telekinetic Blast, Mind Scan, Plasma Rifle, A Good Workout, Right Place, Right Time and
  Domino's Pistol with the hero stunned or confused: the whole ability is canceled except its costs (so Pistol's discard
  and Rifle's exhaust and energy happen, A Good Workout's discard does not), the status card is removed.
- **Technovirus Purge, Back to the Future, Temporal Leap.** Domino cannot thwart Purge (basic or by Right Place);
  Cable's Mind Scan is offered only Back to the Future under it; Diamondback skips a minion engaged with the Cable player
  and hits the villain and her own; Temporal Leap under Back to the Future (cost paid, move barred, stage completes);
  Temporal Leap with a hinder scheme; the F1 targeting cases below.
- **Three responses to one defeat.** Cable's response, Graymalkin and Forced Amnesia each resolve once; the scheme is in the
  display once, Forced Amnesia beside it and not counted; each can be declined alone.
- **Stryfe at lethal damage.** His own cancel defeats him and the event still does nothing.
- **Domino's deck discards.** Jackpot! and The Painted Lady both answering one discard (control, each alone, both:
  the card ends in exactly one place, one response resolves, Pistol counts nothing when a response took the card, Q32 = B);
  The Painted Lady's maximum of 3 and her reuse after her action.
- **Lucky Break.** Cancels a revealed minion (Topaz: no Superpower Feedback fetched) and a revealed side scheme (Not My
  Lucky Day: no When Revealed), and declined leaves both intact.
- **Cross-hero.** Bodyslide after the other hero's own form change of the round is spent; Luck Be a Lady heals the other
  hero; Technovirus Resurgence's acceleration icon adds exactly 1 threat per villain phase.
- **Nemesis and obligations.** Each of the eight encounter cards (Stryfe, Back to the Future, Force Field, Mind Scan,
  Blast; Topaz, Not My Lucky Day, Prototype) revealed to its own hero in a Cable + Domino game, resolved through the end of the
  round with the first and then the last option at every prompt, the whole-state invariants checked at every prompt; both
  obligations dealt in a two-hero game (Resurgence attaches to Purge, Memories stays in the Domino player's play area).
- **Expert games (3, 14 games).** Cable vs Juggernaut (6 seeds), Domino vs Mister Sinister (6), Cable + Domino vs Morlock
  Siege (4), all `difficulty: "expert"`, played by the greedy driver one command at a time. Every state is checked (no
  prompt without an answer, no card in two zones or in none, rounds advance one at a time, no stall between steps) and every
  log replays to a deep-equal final state. The driver loses most expert games within two rounds, so each group requires that the best seed
  reaches round 3. Hope Summers is never declared a defender (a policy, as in the precon e2e files).

## 4. Findings

| ID  | Card(s)                                                                                  | What is wrong                                                                                                                                                                                                                                                                                                                                                                                                                            | Rule                                                                                                                                                       | Severity                                                                       | Who fixes                                                                                                                                                                                         | Pinned test                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | A Good Workout 40040, Domino's Pistol 40046, Plasma Rifle 40011, Telekinetic Blast 40005 | The enemy prompt (`anAttackableEnemy`, which `attackAnEnemy` also uses) still offers an enemy that cannot take the damage (Back to the Future: Cable's minion for another hero, the villain for the Cable player). The damage is correctly barred at resolution (0 dealt), but the player pays the cost (exhaust, energy, deck discard) and may select an invalid target; with the villain the only enemy the ability is offered at all. | RRG "Target" (p. 42), owner ruling 2026-10-05 (4.1, "A basic attack against a character that cannot take its damage"); the basic attack is already refused | Medium: wasted cards and wrong prompts; no rule is broken once damage resolves | `game-rules-architect` (the `attackableBy` target query and `chooseTarget` validity for damaging abilities; DSL `anAttackableEnemy` is `ability-scripting-engineer`'s if the fix is a query flag) | `it.fails` x4: "A Good Workout does not offer a minion engaged with the Cable player ...", "Domino's Pistol does not offer ...", "Cable's Plasma Rifle does not offer the villain ... (F1)", "Cable's Telekinetic Blast does not offer the villain ... (F1)" |

Note on F1: the existing module test `cable/obligation-nemesis.test.ts` "an event of the Cable player is bound too:
Telekinetic Blast cannot target the villain" proves only that the damage is 0 (it picks the villain at the prompt), not
that the villain is refused as a target. Thwarts are already correct: Mind Scan under Back to the Future is never offered the main
scheme or Purge. When F1 is fixed, delete the four `.fails`; they turn red on their own.

Observation, not a bug: with Back to the Future in play Temporal Leap is still offered and its cost is paid (removed from the game, a side scheme
returned), after which the move is barred and the stage completes anyway. That is what RRG "Move" and "Cost" give. See question 1.

## 5. Question for the owner

1. **Temporal Leap while Back to the Future (or a crisis icon) bars removing threat from the main scheme.** The upgrade is
   offered and its cost is spent for no effect.
   - A (recommended): leave as built. The cost is paid first (RRG "Cost", "Move"), a player who accepts a useless interrupt loses the card.
   - B: do not offer it when the move cannot be made.

## 6. Not covered, said plainly

- Nothing compares the data to card scans; the audit is data text against scripts.
- Superpower Feedback with Memories of Armageddon both on one identity (blank text box vs "ability on your identity"), and
  Superpower Feedback counting Jackpot! / The Painted Lady responses as "abilities on an identity-specific card", rest on Q35
  and were not probed.
- Askani'son was not exercised while Cable is confused (the defense context was too heavy to stage), nor Lucky and Good with
  a stunned or confused hero.
- Two-player games with a third and fourth seat, and Cable's and Domino's obligations given to the wrong seat, were not run.
- The expert runs stop at the first outcome or 300 commands; the greedy driver does not win, so no victory path with Temporal
  Leap, Purge in the display or Forced Amnesia was reached by a full game, only by staged tests.
- Cards of other heroes were used only as fixtures (Whiplash 01172, Juggernaut, Making Green).

## 7. Test record

- `pnpm --filter @mc/cards exec vitest run src/wave7/next_evol/qa-cable-domino.qa.test.ts`: 41 passed, 4 expected failures, about 28 s.
- `pnpm exec oxlint` and `pnpm exec oxfmt --check` clean on the test file. `pnpm --filter @mc/cards typecheck` reports errors
  only in the other agents' `qa-scenarios-1/2.qa.test.ts` (node types), none in this file.
