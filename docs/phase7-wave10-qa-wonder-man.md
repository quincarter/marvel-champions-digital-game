# Phase 7 wave 10 rules-QA pass, part 5: the Wonder Man hero pack

`rules-qa-engineer`, 2026-10-12, branch `feature/wave-10`. Scope: every ability scripted in
`packages/cards/src/wave10/wonder_man/` (`wonder-man/identity.ts`, `wonder-man/events.ts`,
`wonder-man/support-upgrades-allies.ts`, `wonder-man/obligation-nemesis.ts`, `justice.ts`, `other-aspects.ts`,
`basic.ts`): **40 ability refs**, 1 of them an alias of an earlier card's script (58017 Bombs Away = 42029). Not audited:
58009 Mr. Hollywood, 58031 Cameo and 58032 Coordinated Effort (still in SKIPPED maps), and the known, already queued gap
that the "tuck from your discard pile" options of Wonder Fans 58007 and Signature Sunglasses 58010 are offered with
nothing eligible in the discard pile. No script, existing test, engine, content or client file was changed.

Authorities, in order: the printed card (`packages/content/raw/marvelcdb/wonder_man.json` and
`packages/content/src/data/wonder_man/cards.ts`; Ionic Physiology 58002 as errata'd, RRG 1.8 p. 70), RRG 1.8
(`docs/rules/mc_rulesreference_v18_compressed.md`; printed page numbers below), the FFG rulings
(`docs/rulings/marvel-champions-rulings-post-rrg-1-7.md`: January 17 Ruling 4, March 6 Rulings 3 and 4, June 19 Ruling 1 name these
cards or their mechanics), the owner's answers (`docs/phase7-wave10.md` section 4.0: 20A and 21B concern the two skipped
cards; 30B the reveal order), then the spec (`docs/phase7-wave10-hero-packs.md`). The file under test:
`packages/cards/src/wave10/qa-wonder-man.qa.test.ts`: 48 tests, **48 pass, the three findings fixed (were `it.fails`), `oxlint`
and `oxfmt --check` clean, no type error in the file. It holds pins of behavior the module tests do not cover beyond
one-card isolation, a scripted full game and the three findings.

## Findings

Three findings, all in rules the module tests could not see because they are about the other players, the board around
the card, or the difference between damage dealt and damage taken. The other 37 scripts read correctly against the print
in target set, "may" or compulsory, timing word, form restriction, cost against effect, limit and "you" against any
player, except where noted.

| Id  | Card                            | Severity                                     | Test (in `qa-wonder-man.qa.test.ts`)                                             |
| --- | ------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| F1  | 58018 Everywhere All at Once    | wrong legality, low to medium, fixed         | `it` (was `it.fails`) "58018 with no scheme that has threat on it: not playable" |
| F2  | 58022 Swordsman (Hero Response) | missing option in multiplayer, medium, fixed | `it` (was `it.fails`) "Rhino's undefended attack on the OTHER player ..."        |
| F3  | 58033 Disarming Defense         | wrong result, medium, fixed                  | `it` (was `it.fails`) "Rhino's ATK 2 + 3 boost icons ... tough ..."              |

### F1. Everywhere All at Once can be played with no scheme to choose

**Status: fixed.** The `chooseTarget` has a variable count (`varOf("x")`), which the engine's initiation check does not
treat as a required choice (`isRequiredChoice` wants a fixed count), so the script is gated with
`while: canRemoveThreatFrom(each(query("scheme", { hasThreat: true })))` and is one thwart of `2 + min(1, overpaid)`.
Not playable at any X with no threat on any scheme; with a scheme holding threat X = 0 still plays and does nothing
(no ruling found against it). Module test added; the pin is a passing `it`.

- Printed: "Play only if your identity has the Aerial trait. **Hero Action** (thwart): Choose X schemes. Remove 2 threat
  from each chosen scheme (3 threat instead if you overpaid for this card)." Cost X.
- Rule: RRG 1.8 "Choose (Game Element)" (p. 12): "If a player card ability requires the choosing of one or more
  targets, and there are no valid targets for any part of the ability, the ability cannot be initiated." "Target"
  (p. 42): a target is valid only "if any part of that ability can affect that target"; the thwart rule (p. 43) and the
  rule that a scheme with no threat cannot be thwarted (p. 42) follow. Same page: "simultaneously choose as many as are
  available, to a maximum of the specified number", which the engine already does for X above the number of schemes
  (pinned, passing: X = 3 with two schemes chooses both, 2 threat from each).
- What the engine does: with the main scheme at 0 threat and no other scheme, the event is listed as playable and
  `playCard` is accepted for X = 0, 1 and 2. Played at X = 0 it costs nothing, resolves with no target, goes to the
  discard pile and, because it is a printed [energy] event, Ionic Physiology tucks it and heals 1 (probed: 3 damage on
  Wonder Man, afterwards 1 card tucked and 2 damage). Active Altruism 58003, the same shape with one scheme, is correctly
  not playable with no threat anywhere (pinned, passing). When a scheme with threat exists the script behaves: a scheme
  with no threat is not offered as a choice (pinned, passing: main scheme at 0, only the side scheme is offered).
- Expected: not playable (and `playCard` refused) while no scheme has threat on it.
- Severity: low to medium. It needs a board with no threat at all, which happens early and late, and the cost to the
  player is only a wasted card, but the free tuck and heal at X = 0 is an exploit of an event that should not resolve.
- Owner: `ability-scripting-engineer` (the `chooseTarget` with `count: varOf("x")` initiates with no candidate) or
  `game-rules-architect` (initiation of an ability whose only target is a chosen set).

### F2. Swordsman's Hero Response is heard only for attacks on his controller

**Status: fixed.** `playerIs: "controller"` is dropped from the pattern. The engine handles an ally declared defender
for another player's attack correctly (Swordsman takes it, the attacked hero none). Two-player module test added in
`basic.test.ts`; the pin is a passing `it`.

- Printed: "**Hero Response**: After a boost card is turned faceup during an undefended attack, declare Swordsman as the
  defender without exhausting him."
- Rule: the text says "an undefended attack", not "an attack against you". RRG 1.8 "Attack (Enemy Activation)" (pp. 8 to
  9): "If a player other than the target player defends, the defending player becomes the target player for the attack"
  and, under "Defend, Defense" (p. 15), an ally declared the defender "becomes the target character for that attack, and
  its controller becomes the target player". The Hercules pass (`docs/phase7-wave10-qa-hercules.md`, 59015 Herc's Helm,
  "When the villain attacks" without "you") treated the same shape as hearing every player's attack, and the engine does.
- What the engine does: the script's trigger is the raw pattern `boostCardTurnedFaceup` with `playerIs: "controller"`.
  In a two-player game (Wonder Man and Core's Spider-Man, Swordsman in play under Wonder Man, Rhino's two undefended
  attacks) the Response is offered once, for the attack on Wonder Man, and not for the attack on Spider-Man.
- Expected: offered for both attacks. Taken for the attack on the other player, Swordsman becomes the defender and his
  controller the target player (not verified: the response is never heard, so the engine's handling of an ally of another
  player taking over the attack through this trigger is untested; Herc's Helm shows the engine can).
- Severity: medium. Multiplayer only; the single-player behavior is right and fully covered by the module tests.
- Owner: `ability-scripting-engineer` (drop `playerIs` from the pattern and keep `while undefendedAttack`; the declared
  defender then needs a check that Swordsman's controller is not required to be the target player).

### F3. Disarming Defense reads "damage dealt", not "damage taken"

**Status: fixed.** The condition is now `not(eventDamageTaken(each(YOUR_IDENTITY)))`. The audit's staging was also
wrong: Focused Rage is a player upgrade, not an "attachment" (`query("attachment")` matches the attachment card type),
so the pin now attaches Enhanced Ivory Horn 01100 (a Rhino attachment printing a Hero Action, no piercing). Module test
added. **Not fixed, same bug in siblings:** Not Today! 38016 (and its Silk reprint 52015) and Desperate Defense 09015
(and Groot's reprint 16013) print "If you take no damage from that attack" and read `not(eventDealt("damage"))`.

- Printed: "**Hero Interrupt** (defense): When your hero defends against an attack, it gets +2 DEF for that attack. If you
  **take** no damage from that attack, discard an attachment on the attacking enemy with the text "Hero Action" or "Hero
  Response"."
- Rule: RRG 1.8 "Tough" (p. 44): "As a tough status card prevents damage fully, the character who had the tough status
  card is not considered to have taken damage." Same entry: a hero with tough that defends reduces the damage by DEF
  first and loses the card only if damage remains. "Damage" (dealt against taken) is the difference
  `docs/dealt-vs-taken-audit.md` is about.
- What the engine does: the script's condition is `not(eventDealt("damage"))`, the attack's `results.damage`, which counts
  damage the attack dealt. Rhino with a Focused Rage 01027 (a Hero Action) attached, three boost icons (ATK 5), against
  Wonder Man with a tough status card defending (DEF 2 + 2): 1 damage is dealt, the tough card prevents it and is
  discarded, the hero takes none, and the attachment is **not** discarded. Without the tough card the same attack deals
  and takes 1 and the attachment correctly stays (pinned, passing), and the module tests pass for DEF reducing the
  damage to 0.
- Expected: the attachment is discarded (no damage taken). The same reading applies to any other prevention of the
  attack's damage.
- Severity: medium. A tough status card on a hero is common (Toughness allies, Son of Zeus-style cards, event effects).
- Owner: `ability-scripting-engineer`; the per-character "damage taken" result key already exists
  (`damageTakenKey`, `packages/engine/src/attack-damage-per-character.test.ts`).
- Note on a trap while testing: Azazel's Sword (the module test's attachment) gives the attached enemy's attacks
  piercing, which removes tough without preventing, so it cannot show this; use an attachment without piercing.

## Owner question

**Q1. 58016 Battlefield Benevolence against an enemy with exactly 1 damage.** "Hero Action: Heal 2 damage from an enemy
→ confuse that enemy." RRG "Cost" (p. 13) says a damage cost "taken" must be taken in full and a cost of "up to" needs
at least one, but says nothing about a heal cost. RRG "Heal" (p. 22) lets a heal take off less than stated.
**A (built):** the heal is a cost that must be paid in full, so an enemy with fewer than 2 damage is no choice and the
event cannot be played against it (module test "1 damage only: the event cannot be played").
**B:** the cost heals whatever damage there is (1) and the enemy is confused.
No ruling speaks to it. Recommended default: A (the words "heal 2 damage" are a stated amount, and "up to" is how the game
asks for less), but it is a reading.

## The three questions the Justice scripter left open

- **Sentry: must a side scheme in the deck be revealed?** Yes. The card says "search ... and reveal it", with no "may";
  RRG "Search" (p. 39): a found card satisfying the criteria is added, and the Hercules finding on Air Cover is the same
  compulsory half. Built that way and pinned (two side schemes in the deck: exactly one revealed, no threat on the main
  scheme, the encounter deck shuffled once; none in the deck: 6 threat on the main scheme and the searched deck still
  shuffled). The player picks which one. **OK.**
- **Everywhere All at Once with X above the number of schemes:** pinned. "Choose as many as are available" (RRG p. 12):
  both schemes are chosen and thwarted, nothing breaks. The only fault is **F1**.
- **Heroic Conditioning in alter-ego form:** "You get +3 hit points" is the player's, "your hero gets +1 THW" is the hero's
  and so ignored in alter-ego form (RRG "Form, Change Form", p. 21: "card abilities that interact with their hero do not
  interact with their identity"). The module test is right; pinned beyond it by playing the card for real under **another
  player's** control (`controllerId`, the card's "any player's control"): the controller's identity gets +3 hit points and
  its hero +1 THW, Wonder Man's player nothing, and a second copy under the same identity is refused ("Max 1 per player").
  **OK.**

## Per-ability verdicts

OK = read against the print, the RRG and the rulings, with the module's tests plus this pass's pins. Refs marked "pin"
have a test in `qa-wonder-man.qa.test.ts` beyond the module tests.

### wonder-man/identity (6)

- 58001a.wonder-man-constant: OK. Pin: June 19, 2026 - Ruling 1 (Teamwork): the Interrupt is tucked before the damage and
  the ATK counts it (1 + Firebird's 2 + 1 = 4), then the Forced Response discards it. The scripted game checks ATK = 1 +
  tucked after every command.
- 58001a.wonder-man-forced-response: OK. Pin: a stunned Wonder Man "is not considered to have attacked" (RRG "Stun",
  p. 41), so the tucked cards stay.
- 58001b.simon-williams-constant: OK (deck-building data, `wonder-man-deck.test.ts`).
- 58001b.setup: OK (scripted game: Ionic Physiology in play on Simon Williams at the start).
- 58002.ionic-physiology-constant: OK (never more than 3 tucked in the scripted game).
- 58002.ionic-physiology-response: OK. The errata text is in the data (pin: current text has "Then, heal", printed keeps the
  arrow). Not exercised: Ionic Physiology itself leaving play (RRG "Tuck", p. 45: tucked cards are discarded); no printed
  flow removes a Permanent card, so it is unproven rather than failing.

### wonder-man/events (4)

- 58003.active-altruism-action: OK. Pin: not playable with no threat anywhere (RRG "Target", p. 42); used with Energy
  overpaying by 2 in the scripted game (1 + 4 threat).
- 58004.ionic-blast-action: OK. Scripted game: Energy paying cost 1 overpays by 1 for 5 damage; it is tucked and heals 1.
- 58005.starstruck-action: OK. Pin: overpaid against an enemy the damage defeats, no stun is given and nothing breaks.
- 58006.energy-siphon-interrupt: OK. RRG "Cost" (p. 14): a damage cost "taken" is not paid unless all of it was taken,
  so the interrupt is not offered with a tough status card (module test), the opposite of the "dealing damage" cost
  (Hercules 59018); the two scripts follow the two sentences.

### wonder-man/support-upgrades-allies (5; 58009 skipped)

- 58007.wonder-fans-action: OK (known queued gap excluded). Used in the scripted game to draw.
- 58008.jet-belt-resource, 58008.jet-belt-hero-resource: OK.
- 58010.signature-sunglasses-response: OK. Pin: heard after the forced change of form by 58011 (RRG "Form, Change Form",
  p. 21: a card-caused change still triggers card effects) and, as RRG "Choose (Option)" (p. 12) requires, not offered
  when neither option can be resolved (nothing in the discard pile, nothing tucked).
- 58011.what-are-you-forced-interrupt: OK. Pin: "set his hit point dial to 4" is remaining hit points (RRG "Hit Points",
  p. 22; 15 with Heroic Conditioning, 11 damage); Signature Sunglasses and Jarvis both hear the change of form.

### wonder-man/obligation-nemesis (7)

- 58025.pacifism-constant, 58025.pacifism-action: OK. Pin: in a two-player game with Wonder Man seated second, Pacifism
  revealed by the first player goes to the Wonder Man player's play area (RRG "Obligation", p. 30). Scripted game: the
  basic attack is refused, the action discards it by exhausting Simon Williams.
- 58026.grim-reaper-forced-response: OK (module tests; the ally's controller is read from the ally).
- 58027.brother-vs-brother-constant: OK. Pins: Ionic Blast with only its payer beside it in hand cannot target Grim Reaper
  (the additional cost needs a card the payment does not use, RRG "Cost", p. 13: all costs are paid simultaneously); with
  a spare card he can and the spare is discarded; Hawkeye's 2 damage is not an attack and costs no card. Scripted game
  round 3.
- 58028.when-revealed: OK. Pin: with Grim Reaper not in play the player assigns the 2 indirect damage among their
  characters (an ally is offered).
- 58029.when-revealed, 58029.boost: OK. Pins: owner answer 30B, RRG "Quickstrike" (p. 36): with Grim Reaper not in play
  and the player in hero form he is found, revealed, engaged and attacks **once**; with him in play engaged with another
  player he attacks the player who revealed the card (the "you"), once, besides his own activation; Scarlet Witch
  discarding the card resolves the same When Revealed.

### justice (9)

- 58012.firebird-constant, 58012.firebird-interrupt: OK (module tests; overpaid and consequential-damage cases).
- 58013.hawkeye-constant, 58013.hawkeye-response: OK. Pin: "After an ally makes a basic thwart" hears **another
  player's** ally; Hawkeye's controller is the one offered it.
- 58014.scarlet-witch-forced-response: OK. Pin: finding Death Cannot Die.
- 58015.sentry-forced-response: OK (see the open questions above).
- 58016.battlefield-benevolence-action: OK; **Q1**.
- 58018.everywhere-all-at-once-action: **F1**.
- 58021.heroic-conditioning-constant: OK (see the open questions above).

### other-aspects (5; 58031, 58032 skipped)

- 58017.bombs-away-action: OK (alias of 42029; pin: the printed texts are equal).
- 58019.stronger-together-interrupt: OK. Pin: Spider-Man, an Avenger hero of the other player, takes Rhino's ATK 2 reduced
  by Wonder Man's DEF 2 to 0; the Interrupt is heard for his damage only (once), never Wonder Man's own.
- 58020.unified-strike-interrupt: OK. Pin: another player's ally (Hawkeye) attacks, Wonder Man's ATK is added as it stands
  with 2 cards tucked (+3), the ally takes no consequential damage and the hero exhausts.
- 58030.caught-in-the-crossfire-interrupt: OK. Pins: another player's ally attack offers the Interrupt to the upgrade's
  controller and the minion takes 1; a stunned Wonder Man's attempted attack offers nothing (RRG "Stun", p. 41).
- 58033.disarming-defense-interrupt: **F3**.

### basic (4)

- 58022.swordsman-constant: OK (module tests).
- 58022.swordsman-response: **F2**.
- 58024.jarvis-response: OK. Pin: another player's Avenger hero (Spider-Man) changes to alter ego: Jarvis's controller is
  offered the Response and Peter Parker's REC is 3 + 2.
- 58034.avengers-compound-action: OK. Simon Williams prints only Civilian (scan and MarvelCDB), so "Play only if your
  identity has the Avenger trait" refuses the card in alter-ego form (RRG "Form, Change Form", p. 21), as for Hercules's
  Evaluate Threat. Pinned. A player-facing consequence, not a defect: it is a hero-form card.

In sum: 40 refs checked, 37 correct, 3 refs with a finding (58018, 58022.response, 58033), 1 owner question (58016).

## The scripted game

`describe("Wonder Man (hand-built Justice deck, nemesis set dealt in) against Core's Rhino ...")`, one player, `wonderManGame()`
(the hand-built `WONDER_MAN_DECK`; Grim Reaper's set is set aside and Pacifism is in the encounter deck by setup), seed 1,
four rounds of real commands through `sessionApply`, one decision at a time. Only the hand of a round and the encounter
cards of a villain phase are placed by surgery (the rest of the hand goes to the bottom of the deck); each surgery closes
a logged segment. After every command and every answered prompt the invariants hold: no prompt that cannot be answered,
no soft lock, no card in two zones (tucked cards count as a zone), every card Wonder Man owns in some zone or attached,
exactly one Ionic Physiology, Pacifism, Grim Reaper, Brother vs. Brother and Scythe Strike and two Death Cannot Die, at
most 3 cards tucked, each owned by the player, Wonder Man's ATK exactly 1 + the tucked count in hero form, no negative
damage, one voluntary form change per round; each segment replays deep-equal from its own log.

- R1: alter ego, Wonder Fans is played and used to draw, he flips; Active Altruism with Energy overpaying by 2 removes
  1 + 4 threat and is tucked (full hit points: no heal); the basic attack deals 2 and empties Ionic Physiology; the
  villain phase deals Death Cannot Die, which finds Grim Reaper, who engages him and attacks once by Quickstrike.
- R2: Ionic Blast paid with Energy overpays by 1 for 5 damage, tucked, heals 1; the basic attack deals 2; the villain
  phase reveals Brother vs. Brother.
- R3: Ionic Blast with a spare card defeats Grim Reaper (the spare is discarded as the additional cost); the villain phase
  deals Pacifism, which stays in his play area.
- R4: the basic attack is refused under Pacifism; he flips to alter ego and exhausts Simon Williams to discard it.

Not won (four rounds against a 14-hit-point villain). Not exercised in the game (covered by pins and module tests):
Starstruck, Energy Siphon, Jet Belt, Signature Sunglasses, "What Are You?", the Justice allies, the other aspects' cards,
Swordsman, Jarvis, Avengers Compound, Scythe Strike.

## Checked beyond the module tests (the pins)

Teamwork with Ionic Physiology (June 19 ruling); a stunned Wonder Man's attack against the Forced Response and against
Caught in the Crossfire; no threat, no target for Active Altruism and Everywhere All at Once (RRG p. 42), and X above the
number of schemes; Pacifism given to the Simon Williams player in a two-player game; Death Cannot Die in hero form (one
Quickstrike attack, owner answer 30B) and against Grim Reaper engaged with another player; Scythe Strike's indirect
damage assigned among characters; Brother vs. Brother with and without a spare card, and Hawkeye's non-attack damage;
Hawkeye, Unified Strike, Stronger Together, Caught in the Crossfire and Jarvis for the other player's characters;
Heroic Conditioning under another player's control and Max 1 per player; Sentry's compulsory find and shuffle;
Scarlet Witch finding Death Cannot Die; "What Are You?" with +3 hit points, and its form change heard by Sunglasses and
Jarvis; Starstruck against a defeated target; the Avenger trait by form (Compound); the data (traits, hit points,
errata text, the Bombs Away reprint).

## Unproven

- **Ionic Physiology or Avengers Compound leaving play with cards tucked** (RRG "Tuck", p. 45: they are discarded): no
  printed flow removes either, and the test layer has no command that does, so it was not staged.
- **Siphon taking damage that defeats Wonder Man**: the module test offers all three amounts at 1 hit point left; the
  interaction with "What Are You?" (the replacement while paying a cost) was not staged and is not judged.
- **Swordsman taking over an attack on another player** (F2): untested until the Response is heard.
- **The three skipped refs** and the queued Wonder Fans / Signature Sunglasses gap.
- **Two players with both Wonder Man and Hercules** (separate decks keyed by owner): not staged.
- **Engine work in progress.** The tree had uncommitted engine and DSL changes (`packages/engine/src`,
  `packages/cards/src/dsl`) while this pass ran; the file passes against that tree. A later failure of a pin about
  overpaying or zone counting would come from that work, not from these cards.
