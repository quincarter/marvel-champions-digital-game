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

## Winter Soldier (winter)

Scope: 54001a/b to 54033 (scripts in `packages/cards/src/wave9/winter/`: the hero's identity, events, support-upgrades-allies and
obligation-nemesis modules and `aspect-basic.ts`; data in `packages/content/src/data/winter/cards.ts`). Whiteout, Blizzard 54034, Encased in Ice
54035 and Slippery Conditions 54036 are not scripted yet and were not audited. Every script was read against the printed text in the data.
Regression tests: `packages/cards/src/wave9/winter/rulings.qa.test.ts` (25 tests, none of them `it.fails`). The module tests are thorough
(about 350 cases, including the owner's Q21 Firepower cases and the Arm Block cases for ruling January 17, 2026 - Ruling 2); this file holds
only interactions they do not assert.

### Findings

None. Every case written against an RRG entry, a ruling or an owner decision passed once the test staging was right (the early failures were
mistakes in the staging, not in the game: a main scheme at 0 threat when Lethal Protector removes 2, a second player thwarting out of turn and
in alter-ego form, and a stunned Rhino that is dealt no boost card, so the stacked "Assault" was dealt to the player and attacked).
One case is an open rules point rather than a finding (see below).

### Checked, no findings

- **A stunned hero and Winter Soldier's attack events (RRG "Labeled Ability" p. 26, "Stun, Stunned" p. 41; ruling August 13, 2026 - Ruling 1
  (1)).** Metal Punch 54005 paid with Cybernetic Arm, Electrical Discharge 54006, Super-Soldiers 54022 and Firepower 54014 (Sidearm exhausted
  as its cost) are all played, their costs paid (the Arm and the Weapon end exhausted), and the whole ability is canceled: no damage, no stun
  on the enemy, no tough cards for Captain America and Winter Soldier, and the stun card is removed.
- **Arm Block 54004 (attack/defense) with status cards.** A stunned hero: the whole ability is canceled, so there is no 3 damage and no
  defense, and the hero takes Rhino's 2 damage ("the entire ability ... is canceled", "each status card ... that cancels any of the labeled
  ability's types is removed"). A confused hero: confuse cancels only a thwart, so Arm Block deals 3, defends, and the confused card stays.
  A stunned Rhino makes no attack ("not considered to have attacked"), so "When an enemy attacks" never happens and Arm Block is not offered.
- **Winter Armor 54009 and Steady (RRG "Steady" p. 41).** One stunned status card on the armored hero does not resolve: the basic attack is made
  and the card stays. Two do resolve: the attack is replaced and both are removed.
- **One basic attack with Winter Rifle 54011, Bambino 54018 and the defeat responses (RRG "Piercing" p. 32, "Overkill" p. 31, "Tough" p. 44,
  "Restricted" p. 38; ruling January 17, 2026 - Ruling 3 (2); ruling March 6, 2026 - Ruling 1 (2)).** On a tough Shocker the Rifle's piercing
  discards the tough card first, so ATK 4 + 3 = 7 defeats it and 4 spill to Rhino through Bambino's overkill; Lethal Protector then removes
  2 threat; two restricted cards stay within the limit. Bambino alone against the tough card: all damage is prevented, nothing spills, and the
  ammo counter is still spent. Lethal Protector, Winter Mask and Silent Infiltration all answer one defeat: threat 2 removed, 1 card drawn,
  the hero readied, an enemy confused.
- **Cybernetic Arm 54002 with the events it pays for (RRG "Event" p. 19; owner answer Q53; "Wild Resource").** One by One 54015 paid with
  the Arm: both instances of damage are +1 (3 to the Shocker, then 3 to the villain). Electrical Discharge paid with the Arm's wild resource
  and a [mental] card stuns (the wild counts as [energy]) and deals 4 + 1. Metal Punch with the Arm against a tough Shocker: prevented in
  full, no overkill excess reaches Rhino.
- **Team-Up with another player's character (RRG "Team-Up" p. 43).** In a two-player game Super-Soldiers is playable with the other
  player's Captain America in play ("a friendly character in play"), and he receives the tough status card.
- **Safe House #30 54007 finding Crossbones (RRG "Quickstrike" p. 36, "Engage" p. 18).** In alter-ego form the Quickstrike minion engages
  Bucky Barnes and does not attack (Quickstrike needs a player in hero form); the "then" card is drawn.
- **Crossbones 54028 and Hydra Hit Squad 54029 (RRG "Hit Points" p. 22, "Tough" p. 44).** The side scheme's +1 ATK makes his attack (3) defeat
  a full-health Black Widow and the Forced Response places 2 threat (without it she survives with 2 damage). A tough Captain America hit for
  3 is not defeated and the response does not trigger (control: without tough, it does). When the side scheme is defeated the +2 hit points
  end and a Hydra minion with 4 damage is defeated at once (Hit Points: a "+X hit points" that ceases to be in effect). In a two-player game
  the player who thwarts it gets the found Hydra minion engaged with them.
- **High-Tech Armament 54030's Hero Action cost.** With the identity exhausted and no other character the action is refused; with a ready
  ally, the ally is exhausted to pay it and the card is discarded.
- **Man on the Wall 54019.** A reduction not used in the hero phase is gone the next round: Winter Rifle (cost 3) paid with 2 cards is
  refused, and accepted with 3.
- **Spoiling for a Fight 54016 with no minion (RRG "Encounter Deck" p. 17).** The discard runs out the deck and is "considered to be
  fulfilled": no minion enters play and the hero is still readied. The module comment's "everything before the arrow is a cost" does not make
  the event unplayable here, and the RRG sentence says it should not.

### Open point (pinned, not an `it.fails`)

- **54023 Winter, Widow, Soldier, Spy putting a second Aggressive Stance 54017 ("Max 1 per player") into play while one is attached.**
  RRG "Play, Put into Play" (p. 32): a card put into play bypasses "any restrictions or prohibitions regarding playing that card". RRG "Max":
  "A player cannot take control of another copy of a 'Max 1 per player' card they already control." The RRG does not say which wins, and no
  ruling in `marvel-champions-rulings-post-rrg-1-7.md` names it. Today both copies end up attached to the identity (put into play wins).
  Needs an owner answer; if the Max entry should win, the fix is in the engine's put-into-play path (one check), not in the script.

### Read against the card text, not covered by a new test

Script reads correct against the printed text, and the module tests assert them: Lethal Protector (an own attack that defeats; 2 threat removed,
not thwarted), Cybernetically Enhanced (cost, compulsory search of deck and discard, shuffle), Black Widow's response (played from the hand,
Attack events only), Silent Infiltration, Winter Mask's Spy trait and draw, Winter Rifle (basic attacks by the hero only, +2 ATK, piercing and
ranged), Metal Punch and Arm Block (the Arm's note), Electrical Discharge's energy stun, Red Room Programming (highest printed cost, ties, an
empty hand), Crossbones' Quickstrike and Forced Response, Hydra Hit Squad's stats and When Defeated, High-Tech Armament's attachment target and
activation, Captain America's and Deathlok's responses, Firepower (owner answer Q21 = B: one attack, up to three assignments, guard re-read per
assignment), One by One (a reprint of 28014), Aggressive Stance, Bambino, Man on the Wall's reduction, Sidearm, Nick Fury, Sr. (a reprint of
50054), Super-Soldiers and Winter, Widow, Soldier, Spy, White Widow's `abilityResolved` heal and S.H.I.E.L.D. Deputy (erratum, RRG p. 70).

### Thin coverage and open points

- **Winter Armor 54009 leaving play with damage.** RRG "Hit Points": when "+X hit points" ceases to be in effect the dial is reduced by X, so a
  hero with 11 or more damage whose Armor is discarded is defeated. Not tested: nothing in the pack discards an upgrade, and surgery would skip
  the engine path under test. The module tests cover only the back-to-11 case with no damage over it.
- **Sidearm 54020 defeating the attack's target before the attack.** A Shocker with 1 hit point left, a basic attack declared against it, and
  the Sidearm interrupt's 1 damage defeats it first. Whether the attack is canceled and whether "attack and defeat" responses (Lethal Protector)
  are offered is not stated by the RRG or any ruling found; not tested.
- **High-Tech Armament 54030 revealed to an enemy that is stunned or confused.** "That enemy activates against you" should spend the status
  card (RRG "Stun, Stunned"), but Armament is dealt after the villain and the minions have activated, so the status cards are spent first and
  the harness cannot stop between steps. Needs a stepwise driver (`driveStepwise`) with surgery at the moment the card is revealed. The
  interaction with Fixer 53038 is `it.todo` in the module test (engine task 35).
- **Red Room Programming 54027 in a two-player game** (given to the Bucky Barnes player) and the choice of where to put indirect damage with an
  ally in play are not tested.
- **Cybernetic Arm and Super-Soldiers/Firepower together with Team-Up in a game with Captain America under the other player's control**: only
  Super-Soldiers with the Arm absent is tested.
- No FFG ruling in the file names a `winter` card except Ruling January 17, 2026 - Ruling 2 and Ruling March 6, 2026 - Ruling 1 (1) (Arm
  Block, both already asserted by the module tests). No conflict between the RRG and a ruling was found for this pack. The RRG's "Encounter Deck"
  sentence on emptied discards and the module comment on Spoiling for a Fight ("a cost") read differently; the game follows the RRG sentence.

## Falcon (falcon)

Scope: 53001a/b to 53037 (scripts in `packages/cards/src/wave9/falcon/`: the hero's identity, events, support-upgrades-allies and
obligation-nemesis modules and `aspect-basic.ts`; data in `packages/content/src/data/falcon/cards.ts`). The `techno` module is not scripted and
was not audited. Every script was read against the printed text in the data. Regression tests: `packages/cards/src/wave9/falcon/rulings.qa.test.ts`
(19 tests, 1 of them `it.fails` pinning the finding below, with a companion test that pins today's behavior). The module tests are thorough
(about 400 cases, including the owner's Q6, Q34 and Q35 cases and the Redwing FAQ cases of rulings January 26 and March 19, 2026); this file holds
only interactions they do not assert. Already-recorded gaps (Aerial Recon's action, Talon Line in a real game, Redwing's exhaust cost, Captain
America's Shield set-aside, Strength in Diversity, and the swapped-in boost card of Up, Up, and Away) were not re-reported.

### Findings

| Card id                                      | Expected (source)                                                                                                                                                                                                                                                                                                                                                                                                                                            | Actual                                                                                                                                                                                                                                                                                                                               | Severity |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 53009 Aerial Recon / 53031 Serpent Solutions | "Interrupt: When a player would be dealt an encounter card, remove 1 recon counter from here instead." `docs/phase7-wave9.md` section 3.45 says the interrupt hears every deal to any player, "a card's 'deal ... as a facedown encounter card' (Serpent Solutions, The Raft)", and lists "Serpent Solutions' deal of a discarded minion replaced: the minion stays in the encounter discard pile" as a test (RRG 1.8 "Deal, Deal an Encounter Card" p. 15). | Aerial Recon is never offered for Serpent Solutions' deal: the engine does not announce a named-card deal (`trigger-events.ts`, `TriggerEvent encounterCardBeingDealt`, "Not announced: ... a named card dealt to a player"), so the Soldier is dealt facedown to the first player and the recon counter stays. The script is right. | Medium   |

The fix needs the engine (a "would be dealt" window in `dealAsEncounterCards`, whose replacement leaves the named card where it is, in the
discard pile), not a script change; if the owner prefers the engine comment's reading (a named card is not "taken from the deck", so it is not a
deal the interrupt hears), the spec's section 3.45 line and test list are what change. The same text names The Raft 51018 (Black Panther), which
would be answered by the same fix. It is pinned: `it.fails` for the expected behavior and a passing test for today's. When it is fixed, flip the
`it.fails` to `it` and delete its companion.

### Checked, no findings

- **A stunned or confused Falcon and Bird of Prey 53003 / Bird's-Eye View 53004 (RRG "Labeled Ability" p. 26, "Stun, Stunned" p. 41, "Confuse,
  Confused" p. 13; ruling August 13, 2026 - Ruling 1 (1)).** Stunned plus Bird of Prey (attack): the event is played and spent and Eagle-Eyed is
  still offered, but no damage is dealt, the stun card is removed and the optional discard does not happen (the top card stays on the deck: the
  discard is part of the canceled effect, not a cost). Confused plus Bird of Prey: 4 + 3 damage, the confused card stays. Confused plus
  Bird's-Eye View (thwart): nothing removed, the confused card goes, the top card stays. Stunned plus Bird's-Eye View: 3 + 3 threat removed, the
  stunned card stays.
- **Redwing 53002's action with status cards on Falcon (RRG FAQ "Redwing (#2)" p. 65).** The damage is neither an attack nor a thwart, so a
  Falcon who is both stunned and confused uses it in full and both cards stay.
- **Tough (RRG p. 44).** Bird of Prey at a tough minion: the top card is discarded and the +X read, but all the damage is prevented and the tough
  card is spent. Redwing's "deal X damage" at a tough minion likewise (damage from an ability is damage).
- **Aerial Evacuation 53008 and Overkill (ruling March 6, 2026 - Ruling 1 (2); RRG "Overkill" p. 31).** Control: Rhino with Charge (ATK 5,
  overkill) against a defending Redwing defeats him and 3 excess lands on Falcon. With Evacuation the damage to Redwing is prevented, he is not
  defeated, no excess reaches Falcon, and Falcon changes to alter-ego form.
- **Vibranium Microweave 53013 with exactly 1 damage.** "Prevent 1 of that damage and deal 1 damage to an enemy": a 1-damage attack is prevented
  in full (Falcon takes 0) and the 1 damage to the chosen minion is still dealt; the upgrade is exhausted.
- **Draw Their Fire 53011 in a two-player game.** The rule covers Falcon only: the other player's hero attacked in the same villain phase still
  exhausts to defend.
- **Eagle-Eyed 53001a in a two-player game.** The other player playing an Aerial card does not offer it to Falcon's player and discards nothing
  ("After _you_ play").
- **Harlem's Protector 53029 with Falcon as the second seat.** Dealt to the first player (Spider-Man) and revealed, it is given to the Sam Wilson
  player: it lands in P2's play area with 3 emergency counters and not in P1's. (The villain activates once against each player, so a two-player
  villain phase turns two boost cards before the first deal.)
- **Serpent Solutions 53031 and the first player.** With P2 as the first player, the Serpent Soldier Eagle-Eyed discards is dealt facedown to P2,
  not to Falcon's player.
- **Up, Up, and Away 53005 on an attack against another player (RRG "Labeled Ability" p. 26: a (defense) ability initiated during an attack makes
  the identity the defender).** Offered for Rhino's attack on P2 as well as on Falcon (the card names no target); taking it makes Falcon the
  defender, so that hit lands on Falcon. Declined both times, the two hits land on Falcon and on P2.
- **Viper 53030 with a deck of three (RRG "Encounter Deck" p. 17).** Of the five cards, three are discarded, the deck is reset (one acceleration
  token) and the discard stops: the other two are not taken from the new deck. The module header's "one at a time with the deck reset if it
  empties" reads as if it continued; the game follows the RRG sentence.

### Read against the card text, not covered by a new test

Script reads correct against the printed text, and the module tests assert them: Falcon's constant (hero face, player phase only, hidden again
in the villain phase), Eagle-Eyed (any Aerial card played, no limit), Birds of a Feather (cost, compulsory search of deck and discard, shuffle,
limit across flips per ruling January 26, 2026 - Ruling 6 (2)), the Q6 = A switch shared by Bird of Prey, Bird's-Eye View, Redwing and
Battlefield Awareness (a facedown top card per ruling March 19, 2026 - Ruling 5), Falcon's Flock (once per card paid, owner question 36 built on
A), Soup Kitchen (heal equal to REC, the next ally or support), Draw Their Fire, Talon Line (stars count; Q35 = A), Aerial Recon's interrupt, Serpent
Society cards, Adder-tisement, and the whole of `aspect-basic.ts` (reprints aliased to their sources; Spectrum, Resource Reserve, Flight Squadron,
Hugin & Munin, Misty Knight, Ops Room, Wingman, Winter Soldier, Captain America's action).

### Thin coverage and open points

- **Piercing against Aerial Evacuation (ruling January 17, 2026 - Ruling 3 (2)).** Piercing removes a tough card before Evacuation prevents
  the damage taken. Not tested: it needs an ally with a tough card defending a piercing attack, and no piercing enemy attack was staged; the engine's
  Piercing and Tough are tested in the Winter Soldier file against Winter Rifle.
- **Battlefield Awareness 53010 on a basic attack replaced by a stun or a confuse.** Whether "uses a basic power" is true when the stunned
  Falcon's attack is canceled (RRG "Stun" says costs are still paid and he "is not considered to have attacked") is not stated for this wording and
  no ruling names it; not tested.
- **Misty Knight 53036 discarding the second of the top 2 cards when it is a Serpent Society minion with Serpent Solutions in play.** RRG
  "Discard" (p. 16): cards looked at from the top and discarded "are considered to have been discarded from the top of that deck", so Solutions
  should hear it; no test combines the two cards.
- **Hugin & Munin 53017 searching the top 10 while the top card is faceup (Falcon's player phase).** The module tests cover the search; none
  checks that the new top card is shown (and logged) afterward.
- **Up, Up, and Away 53005 on a minion's boost card against another player.** The test staging used Rhino's attacks (the minion engaged with P2
  was not dealt a boost card in the harness); the offer for a minion's attack is covered only for the single-player case by the module tests.
- No FFG ruling in the file names a `falcon` card outside Rulings December 17, 2025 - Ruling 1 (2), January 17, 2026 - Ruling 3 (2), January 26,
  2026 - Ruling 6, March 6, 2026 - Ruling 1 (2), March 19, 2026 - Ruling 5, June 25, 2026 - Ruling 1 and July 9, 2026 - Ruling 2, all of them
  asserted by the module tests or this file's. No conflict between the RRG and a ruling was found for this pack.
