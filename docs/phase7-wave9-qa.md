# Phase 7 wave 9 rules-QA pass

`rules-qa-engineer`, 2026-10-10, branch `feature/wave-9`. Definition of done step 4 ("Rules QA", `docs/wave-definition-of-done.md`):
each pack audited against its card text, RRG 1.8 (`mc_rulesreference_v18_compressed.pdf`) and the FFG rulings
(`marvel-champions-rulings-post-rrg-1-7.md`). Owner answers are `docs/phase7-wave9.md` section 4.1 and are not reopened here. No script,
engine or data file was changed; findings are reported for the owning specialist.

## Black Panther (bp)

Scope: 51001a/b to 51042 (scripts in `packages/cards/src/wave9/bp/`, data in `packages/content/src/data/bp/cards.ts`). Every script was read
against the printed text in the data. Regression tests: `packages/cards/src/wave9/bp/rulings.qa.test.ts` (16 tests, 1 of them `it.fails`
pinning the findings below, each with a companion test that pins today's behavior). The module tests are thorough (about 320 cases); this file
holds only interactions they do not assert.

### Findings

| Card id                    | Expected (source)                                                                                                                                                                                                                                                                                                                                      | Actual                                                                                                                                                                                                                                                          | Severity   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 51025 Heart of the Panther | "Resolve the Special on up to 4 Black Panther upgrades": at least 1 must be chosen when one can resolve (owner decision wave 3 Q16, `docs/phase7-wave3.md` section 4; restated in `docs/phase7-wave9.md` 3.36). No printed "may".                                                                                                                      | Was `chooseCards(min 0, max 4)`. **Fixed**: the script now takes 1 to 4, and `aspect-basic.test.ts` asserts it.                                                                                                                                                 | Low, fixed |
| 51018 The Raft             | Printed "tuck it under here from the encounter discard pile" is before the cost arrow, so it is a cost; a cost that cannot be paid cannot be initiated (RRG 1.8 "Cost"). A minion with Victory (Joystick 51039) that leaves play goes to the victory display (RRG "Victory X"), not the encounter discard pile, so the response should not be offered. | The response is offered for any minion that leaves play and then does nothing (nothing tucked, no threat removed, no deal). Already documented in the script's header as a known deviation (no tuck cost exists in the engine); recorded here so it is tracked. | Low        |

The Raft is pinned: `it.fails` for the expected behavior and a passing test for today's. When it is fixed, flip the `it.fails` to `it` and
delete its companion.

### Checked, no findings

- **Stun and Confuse against labeled abilities (RRG "Labeled Ability", "Stun, Stunned", "Confuse, Confused"; ruling Aug 13, 2026 (1)).** A stunned
  hero playing Clawed Strike 51003 loses the whole ability (no 4 damage, no Special), the stun card is discarded and the event is still played;
  a confused hero playing On the Prowl 51004 likewise. Wakanda Forever! 51005 with a stunned hero: Panther Claws' (attack) Special is canceled
  and uses up the stun while Kimoyo Beads' (thwart) Special still resolves. A stunned White Wolf 51037 attack is "not considered to have
  attacked", so his Forced Response places no threat.
- **T'Challa's Shadow 51031.** At the last doubt counter the card is discarded to the victory display (RRG "Uses", "Victory X"), not the discard
  pile, and its +1 cost ends. A (thwart) event counts as "you thwart" and removes a counter (RRG "Labeled Ability"); a stunned hero's replaced
  basic attack does not. (Existing tests cover basic thwart, attack, defense, and that an ally's attack is not "you".)
- **Spider Bites 51012** choosing the other player in a two-player game: the villain and only that player's minion take 1 and are stunned; the
  first player's own minion is untouched.
- **Vibranium Suit 51013** on a hero that already has a tough status card: the hero keeps one, per RRG "Status Cards" ("cannot have more than one
  status card of each type"). Note the RRG's own "Tough" entry has a bullet about "multiple tough status cards"; it grants nothing, so the
  engine's single-card cap is right, but the two entries read oddly together (not a conflict with any ruling).
- **Queen Ramonda 51008**: another player's T'Challa in hero form is not an alter-ego and is not healed.
- **Target Spotter 51038 with Quickstrike (RRG "Activation", "Quickstrike"; FAQ "Target Spotter (#38)", RRG p. 65).** A Quickstrike minion (Vulture)
  dealt to another player and Spotted onto the Spotter's player engages them and does not attack (a Quickstrike attack is an activation, and
  "cannot activate" holds until the end of the phase).
- **The Scream 51035 as a boost card** when an ally defends: "you are stunned" is the player's identity; the defending ally is not stunned.
- **Extreme Risk 51042 as a boost card on a scheme activation** (Shuri in alter-ego form): the extra boost card is dealt and flipped and its
  icons count (SCH 1 + 2 + 1).

### Read against the card text, not covered by a new test

Script reads correct against the printed text, and the module tests assert them: the Inventor search and reduction (51001b, owner Q15: the
search is compulsory), Black Panther and T'Challa responses (a Special resolved this way is not a basic power, so no chain), Panther Claws'
single instance of 5 with piercing, Kimoyo Beads, the Elephant's Trunk (FAQ p. 65), Aja-Adanna, Manifold, Infiltration, Going Undercover,
Show of Empathy and Redemption, Invisibility Gear, Sting Operation, the Dora Milaje allies and support, White Wolf, Build Support and Sonic
Rifle (aliases of earlier scripts), Klaw, the two M.U.S.I.C. cards, Joystick, Energy Truncheon and Playing for Keeps.

### Thin coverage and open points

- **Cost-modifier order, unverified.** Shuri's Inventor "reduce its resource cost by 2" together with T'Challa's Shadow's "+1 to each card you
  play" on a card whose printed cost is 1 (Invisibility Gear) gives 0 or 1 depending on whether the reduction is applied before the increase.
  RRG 1.8 "Cost" and "Ignore" and the rulings file give no order, so no test was written; ask the owner or FFG before pinning it.
- **Klaw and Playing for Keeps together** (Klaw gets one boost card from his own Forced Interrupt and one from Playing for Keeps; text says "in
  addition to any other boost cards"): each is tested alone, the pair is not.
- **Energy Truncheon's Hero Action under Invisibility Gear** (the attack becomes a scheme: is "after this attack, discard this card" met?): no
  ruling found, not tested.
- **Quickstrike on a minion Infiltration 51015 puts into play** is owner question 25 (it attacks); not re-tested here.
- No FFG ruling in the file names a bp card or Special-based mechanic, and no conflict between the RRG and a ruling was found for this pack.
