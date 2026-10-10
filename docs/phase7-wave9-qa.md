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

## Silk (silk)

Scope: 52001a/b to 52038 (scripts in `packages/cards/src/wave9/silk/`, data in `packages/content/src/data/silk/cards.ts`). Every script was read
against the printed text in the data. Regression tests: `packages/cards/src/wave9/silk/rulings.qa.test.ts` (15 tests, none of them `it.fails`).
The module tests are thorough (about 400 cases, including the Q7 cases for Cindy Moon, Swinging Silk Kick, Wallcrawl and the four-card cap);
this file holds only interactions they do not assert.

### Findings

None. Every case written against an RRG entry, a ruling or an owner decision passed on the first run after the test setup was right (three
early failures were mistakes in the test staging, not in the game: a filler card that was in Rhino's set, a defeat staged out of turn, and a
picker that named the same card for two different prompts).

### Checked, no findings

- **Stun and Confuse against labeled events and basic-power upgrades (RRG "Labeled Ability", "Stun, Stunned", "Confuse, Confused"; ruling
  Aug 13, 2026 (1)).** A stunned hero playing Swinging Silk Kick 52003 loses the whole ability: no damage, and the optional discard of a tucked
  card is not made (it is part of the effect, not a cost), while the event is still played. A confused hero playing Wallcrawl 52004 removes
  neither the 2 nor the 3 threat and keeps the tucked card. A stunned hero's basic attack and a confused hero's basic thwart are replaced by
  discarding the status card, so Spider Claws 52011 and Outwit 52010 are not offered and stay ready ("not considered to have attacked").
- **Silk Sense 52001a through events and Overkill.** Swinging Silk Kick with a matching tucked card defeats Sandman (4 hit points) with 9
  damage: the 5 excess damage goes to Rhino (RRG "Overkill") and Silk Sense is offered for the defeat and tucks Sandman. Wallcrawl removing the
  last threat from a side scheme is Silk's defeat, and the response is offered.
- **Response timing inside an event (RRG "Initiating Abilities" step 7; FAQ "Tigra (#51)").** Silk Sense is offered immediately after the
  side scheme is defeated by Wallcrawl's first sentence, before its second sentence resolves, so the side scheme just tucked is a legal card
  to discard for the 3 additional threat when it shares an encounter set with the chosen scheme. This follows the FAQ's "immediately after"
  reading; recorded here because it is a surprising consequence for a player.
- **Silk Sense and another player.** In a two-player game, the other player's basic attack that defeats a minion does not offer Silk Sense
  to the Silk player, and nothing is tucked.
- **Silk Sense on a treachery that tucks itself.** Hunting the Spider-Bride 52031 revealed with Silk Sense accepted: the card is tucked once
  (by its own When Revealed), is not in the encounter discard pile, and is not tucked a second time.
- **Eidetic Memory 52008 (erratum, RRG p. 70).** A boost card of the tucked card's encounter set is flipped, not revealed, so the interrupt
  is not offered (control: the same card dealt to Silk is offered). In a two-player game a card the other player reveals does not open
  Silk's interrupt ("when you reveal"). Ruling April 30, 2026, Ruling 3 (3) (flipping an environment is not a reveal) is a scenario case
  (Wheel of Genres, Alert Level) outside this pack's fixtures; `docs/phase7-wave9.md` section 3.16 already carries it.
- **Spider Reflexes 52012 under Silk Sense Overload 52028.** The after-the-attack tuck is a player card's (an upgrade), so the encounter
  card goes under the obligation, and nothing goes under Silk. The module tests cover Albert Moon, Smooth as Silk, Get the Scoop and an
  encounter card's own tuck.
- **Organic Webbing 52009 discarding a Hunting the Spider-Bride (owner decision Q7 = A).** The discard is a cost of a player card's
  ability, so the 2 damage is dealt to Silk, the Bride goes to the encounter discard pile and Webbing is exhausted. The module tests cover the
  same for Cindy Moon's action.
- **"Stop Hitting Yourself" 52016 with a tough status card (RRG "Tough").** Silk defending an attack that would deal 1 damage after her DEF
  and absorbing it with a tough status card "is not considered to have taken damage", so the response is offered (control: with 1 damage
  taken it is not).
- **Wallcrawl 52004 and the crisis icon (RRG "Crisis Icon").** With Crowd Control (crisis) in play, the 2 threat comes off Crowd Control but
  the 3 aimed at the main scheme is not removed.

### Read against the card text, not covered by a new test

Script reads correct against the printed text, and the module tests assert them: both faces of the four-card cap (a state check, the
controller picks the four that stay), Cindy Moon's discard cost and once-per-round limit, Smooth as Silk (until-discard, empty deck fulfills
the effect, RRG "Encounter Deck"), Get the Scoop (any player, `triggerableBy`, the Cindy Moon player tucks), Albert Moon, J. Jonah Jameson,
the Outwit/Spider Claws counts by encounter set with piercing, Spider Reflexes' DEF, Morlun's constant and When Defeated, The Great Hunt,
Silk Sense Overload's redirect and "then", Hunting the Spider-Bride (Q7), the Growing Strong set (Atlas, Grow Invulnerable, Growing Strong,
Titanic Proportions) and the basic cards (reprints of Rogue's Not Today!, Spider-Man 27049 and Across the Spider-Verse 27018 are aliases of
those scripts; Quick Quip is the wave 5 script).

### Thin coverage and open points

- **Stunned or confused Atlas against Growing Strong 52037.** The text gains surge "if no enemy activated this way", and RRG "Stun, Stunned"
  says a stunned enemy "is not considered to have attacked" (RRG "Activation": attacking or scheming is activating), so a stunned Atlas
  should leave surge in place. Not tested: an Atlas already in play activates in the villain phase's step 2 and spends the stun before the
  encounter card is revealed, and the harness has no way to stop between steps. Needs a stepwise driver or a reveal outside the villain phase.
- **Wallcrawl when the removal is prevented.** With the 3 threat prevented by a crisis icon, the tucked card is still discarded (the
  discard is "may ... to remove"). No ruling found; not pinned.
- **Albert Moon's heal option with nothing tucked** (heals 0): no ruling on offering an option that does nothing; not tested.
- **Eliminated player.** RRG "Elimination" moves an eliminated player's minions with their tucked cards; what happens to cards tucked under
  an eliminated identity (an identity that leaves play discards them, RRG "Tuck") is not tested, nor is the Spider-Bride's "that identity
  takes 2 damage" for it.
- No FFG ruling in the file names a silk card except Ruling April 30, 2026, Ruling 3 (3) (Eidetic Memory) and Ruling December 17, 2025,
  Ruling 2 ("Stop Hitting Yourself"'s DEF), both already asserted by the module tests; no conflict between the RRG and a ruling was found
  for this pack. The RRG's own wording on responses ("may be resolved after the specified triggering condition occurs") and on step 7 of
  "Initiating Abilities" agree with the FAQ's Tigra answer.
