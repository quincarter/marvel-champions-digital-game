# Phase 7 wave 10 rules-QA pass, part 3: Civil War, the player side

`rules-qa-engineer`, 2026-10-12, branch `feature/wave-10`. Scope: Tigra (56001a to 56009 and her nemesis set and
obligation 56023 to 56028), Hulkling (56029a to 56040 and 56054 to 56058), and the box's Aggression, Protection and
basic cards (56010 to 56022, 56041 to 56053): 70 ability refs, 10 of them aliases of an earlier card's script. Two
starter-deck games were played as part of the pass (B8.4 lines 5 and 10). No script, existing test, engine, content or
client file was changed.

Authorities, in order: the printed card (`packages/content/src/data/cw/cards.ts`, scan-checked in
`docs/phase7-wave10-scan-check-cw-players.md`), MC56 (`docs/campaign-modes/mc56_rulebook-web_1.pdf`, p. 18 for the two
starter decks), RRG 1.8 (`docs/rules/mc_rulesreference_v18_compressed.md`; page numbers below are the printed ones), the FFG
rulings (`docs/rulings/marvel-champions-rulings-post-rrg-1-7.md`), then the owner's answers (`docs/phase7-wave10-box-heroes.md` B4:
14A, 15B, 16A, 17A, 18A). Tests, all passing (`oxlint`, `oxfmt --check` clean):

- `packages/cards/src/wave10/qa-players.qa.test.ts`: 35 tests, 6 `it.fails` for the findings below, 29 plain `it` for
  controls, pins and the brief's known items.
- `packages/cards/src/wave10/cw/tigra/precon-e2e.test.ts` (16 tests) and
  `packages/cards/src/wave10/cw/hulkling/precon-e2e.test.ts` (17 tests): the two starter-deck games.

`pnpm --filter @mc/cards typecheck` reports two errors, both in `src/dsl/abilities.ts` (`Cannot find name 'ZoneId'`,
lines 3224): another agent's work in progress in a file this pass does not touch; the three test files typecheck clean.

## Findings

Three findings. The 70 scripts read correctly against the print in target set, "may" or compulsory, timing, limits and
costs except where noted; one finding is engine-wide and reaches these cards (F1), one is a wrong choice in one script
(F2), one is a missing shuffle in a near-unreachable state (F3). Part 1's findings F3 and F4 need a second look (see
"Spec corrections owed").

| Id  | Card                                                                                | Severity     | Test (in `qa-players.qa.test.ts`)                     |
| --- | ----------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------- |
| F1  | 56009 Feline Senses, 56039 Impersonation, 56003 Precinct HQ (and Core 01060, 56032) | wrong result | four `it.fails` in "targets that need threat"         |
| F2  | 56012 Air Cover                                                                     | wrong choice | `56012 Air Cover: ... a search that finds a card ...` |
| F3  | 56057 Fantastic Powers (Super Skrull nowhere searchable)                            | wrong result | `Super Skrull removed from the game: ...`             |

### F1. A "remove threat from a scheme" ability is initiable while no scheme has any threat

- Printed: Feline Senses "Hero Action (thwart): Remove 3 threat from a scheme. If this removes the last threat ... stun
  a minion."; Impersonation "Remove 4 threat from a scheme ..."; Precinct HQ "Alter-Ego Action: Exhaust Precinct HQ ->
  remove 1 threat from a scheme ..."; Winged Shape's Response "remove 2 threat from a scheme" has the same shape (not
  staged).
- The game: with every scheme at 0 threat `legalActions` lists the event as playable and the action as usable (Feline
  Senses, Impersonation, Precinct HQ). The same holds for Core's For Justice! 01060 (a control in the same describe), so
  the cause is the engine's target rule for threat removal, not these three scripts.
- Expected: RRG "Target" (p. 42): "If an ability or game function requires one or more targets, that ability or game
  function can only be initiated if it has at least one valid target" and "A target is valid for an ability or game
  function if any part of that ability or game function can affect that target"; the exception bullet on the same page
  gives the matching example for a basic thwart ("against a scheme with threat on it"). A scheme at 0 threat cannot be
  affected by removing threat, so with none on the table the event cannot be played and the action cannot be used (and
  the card is not wasted).
- Proof: four `it.fails` (Feline Senses, Impersonation, Precinct HQ, For Justice!). Each also asserts the control
  (playable with 1 threat on the main scheme), which passes.
- Owner: `game-rules-architect` (the valid-target set of a threat-removal effect; the scripts' own `ifThen(threat >= 1,
  ...)` guard then becomes unreachable and is harmless). Severity "wrong result": a card can be played for no effect.

### F2. 56012 Air Cover: the player may take nothing from a search that found a Tactic upgrade

- Printed: "Response: After a minion enters play, exhaust this card and remove 1 fuel counter from it -> search your
  deck and discard pile for a Tactic upgrade that can be attached to that minion and add it to your hand."
- The game: the card choice of the search has a minimum of 0 (`chooseCards(..., { min: 0, max: 1 })`,
  `aspect-basic/aggression.ts`), so with a Suppressing Fire in the deck the player can pick none and the search ends
  empty. Every other search of the box is compulsory when a card is found (`min: 1`: Undercover Work, Shape-Changer,
  Moon Knight, Wiccan, Yellowjacket, Shapeshifter, Altman Residence).
- Expected: RRG "Search" (p. 39): "If the player finds a card that satisfies the criteria of the search, the player adds
  that card to the game area indicated". No "may" is printed. With no candidate the search still resolves and shuffles
  (the module test of "finding nothing" stays right).
- Proof: `it.fails`: Air Cover in play, a Shocker dealt, the response taken; the prompt's minimum is 0, not 1.
- Owner: `ability-scripting-engineer` (`min: 1`; with one candidate the engine's pending change removes the prompt; the
  module's comment "finding nothing is allowed" is about the no-candidate case). Severity "wrong choice": the outcome
  differs only if the player declines a legal card (a deck-thinning choice the print does not give).

### F3. 56057 Fantastic Powers: no shuffle when the find looks through the deck and Super Skrull is not there

- Printed: "When Revealed: Find Super Skrull. Put him into play engaged with you and attach Fantastic Powers to him.
  ..."
- The game: the script shuffles only when a copy was found in the deck (`fromDeck.count >= 1`). With Super Skrull set
  aside, in the discard pile or already in play, nothing is shuffled; with him removed from the game (or a facedown
  boost card in play, both outside any area a find searches) nothing is shuffled either.
- Expected: RRG "Find" (p. 19): a find searches "each game area where that card could be found", but "players should not
  unnecessarily search game areas if they know where the card they are looking for can be found". RRG "Search" (p. 39):
  "If any portion of a deck is searched ... shuffle that entire deck". So no shuffle is owed when his place is known
  (set aside, discard pile, in play: the three cases the script gets right, all pinned by passing tests), and one is
  owed when the find has to look through the deck to learn he is not there. That last case is the finding.
- Proof: `it.fails`: Super Skrull removed from the game; the encounter deck is not shuffled. The three known-place cases
  and the in-deck case (one shuffle) are plain `it`.
- Owner: `ability-scripting-engineer` (shuffle after the find in the not-found case). Severity "wrong result", low: the
  state needs a nemesis minion to be removed from the game or buried facedown, which no printed card does to him except
  as a boost card. This is a reading of "Find"; if the owner reads "search" as requiring the deck to be the area looked
  in, flip the test to `it` and drop the finding.

## The brief's known items

1. **Cuts Both Ways 56050, exact damage.** Core Black Panther's hero side prints Retaliate 1. Rhino attacks, Black
   Panther defends: Rhino takes exactly 1 without the event and exactly 2 with it. RRG "Keywords" (p. 25): "the numbers
   for each instance are added together". Correct (two passing tests, no control run needed).
2. **Cat-Like Reflexes 56006 in alter-ego form.** An enemy attack on an alter ego cannot be staged: RRG "Attack (Enemy
   Activation)" (p. 8) says abilities "can instead cause an enemy to attack a player's alter-ego", but no printed card
   of the pool does (a text search of every card file for "attacks your alter-ego" and the like finds none; the Core
   cards that attack are "When Revealed (Hero)"). The test uses the other way to damage an alter ego, a When Revealed
   that hits the identity (U.S. Agent 56075, "Deal 1 damage to your identity"): Greer Nelson takes the 1, the interrupt
   is not offered and stays attached; the same reveal in hero form offers it (control). The interrupt is "Hero
   Interrupt: When you would take any amount of damage", so the damage source is not what is being tested. Correct.
3. **The exhaust option when the alter ego is already exhausted.** Complicated Lineage 56054 and In Too Deep 56023, hero
   form, the hero defends the villain's attack (so is exhausted when the obligation is revealed) and then flips: the
   exhaust option cannot be paid, the choice of options is never asked, the second option resolves (the Shapeshift
   upgrades are discarded) and the card is discarded, not removed from the game. RRG "Cost" (p. 13), "Form, Change Form"
   (p. 21: the exhausted state survives the flip). Control with a ready identity: both options are asked. Correct.
4. **A hostless Hunted.** The module and the spec discard it; RRG "Attach To" (p. 8) says that when the check "does not
   pass, the card is not able to be attached, so it remains in its prior state or game area. If such a card cannot
   remain in its prior state or game area, discard it." Read side by side: the third bullet speaks of "the 'attach to'
   phrase" on a card, and the fourth says that phrase "is not resolved if another ability causes that card to attach to
   a specific game element", which is Hunted's case (its own text says "Attach Hunted to that minion" as an effect,
   after an additional cost). RRG "Play, Put into Play" (p. 32) puts a played card in the play area once its cost is
   paid. Hunted's cost (the search, the shuffle, the minion in play) has been paid and has no prior area to return to,
   so the discard is the right reading, and "back to hand" would refund a paid play. The entry does not speak to a card
   in mid-play, so this is a reading, not a ruling; the spec's choice stands. Staged with a Vulture (4 hit points, 3
   damage on him) found by Hunted: his quickstrike attack comes first, Tigra defends and plays Cuts Both Ways (swapped
   in), Retaliate 1 defeats him, and Hunted ends in the discard pile, never attached. Pinned (passing test). The
   script's header cites "RRG 1.8 'Attach To', p. 8" for this; the cite is the nearest entry, not an exact one.
5. **Fantastic Powers and the shuffle.** Answered under F3: a shuffle is owed when the find looks through the deck, not
   when his place is known. The engine's behavior is right in the three known-place cases and the in-deck case, and
   misses the not-found case.

## Play tests

Two real games with the printed starter decks (checked against MC56 p. 18: every count matches the page, 40 cards each)
in `registration-iron-man`, one player, standard, seed 1, main scheme pair Homeland Security (56121b, "Each minion gains
guard") and No Going Back, Stark Tower put back in the deck for a quiet start. Real commands one decision at a time
through `sessionApply`; only the cards a round needs, the encounter cards of a villain phase and (Hulkling) the top card
of the deck are placed by surgery, each surgery closing a logged segment, and every segment replays deep-equal from its
own log (5 segments for Tigra, 12 for Hulkling).

- **Tigra, three rounds, ends in round 4 with Tigra alive at 8 of 10 hit points.** Undercover Work fetched a second
  Hunted (once per round enforced); Hunted at cost 0 put quickstrike Hellcat into play engaged (he attacks first, 2
  damage, then wears Hunted and is stunned: ruling Feb 28, 2026 Rulings 1 and 4, owner 18A; his When Revealed does not
  resolve, being put into play) and a second on Doc Samson, whose printed guard Tigra's constant removes while Homeland
  Security gives guard to the rest (a basic attack by Moon Knight on the villain is refused behind Bullseye, and a
  Hellcat with Hunted does not block); Moon Knight found Bullseye, stunned and confused; the stunned minions spent their
  stun instead of attacking; On the Hunt drew exactly 3 with four minions engaged (cap, ruling Mar 30, 2026); Tooth and
  Claw cost 0 with four engaged (4 + 4 damage, Samson and Venom defeated) and Hunted's Interrupt readied Tigra; the
  second Tooth and Claw cost 2 (two engaged), its second 4 damage reached Iron Man once no guard minion was left; Shadow
  of the Past brought The Hood (engaged) and Criminal Underworld (4 threat) and shuffled the rest of the set into the
  deck; Bring It! drew 2; the Hood cannot be attacked (RRG "Target" p. 42, ruling Mar 19, 2026 Ruling 2); Cat-Like
  Reflexes stopped Hellcat's attack; the Hood's attack placed 1 threat on Criminal Underworld and his Mantle attached to
  him. Not exercised: Precinct HQ, Cat's Head Amulet, Sharp Claws, Feline Senses, Two-Gun Kid, Coup de Grace, Savage
  Strike (the kit tests cover them).
- **Hulkling, three rounds, ends in round 4 with Hulkling alive.** Shape-Changer found Armored Shape (four candidates);
  played in alter-ego form, then Teddy Altman's constant refused a second shape ("cannot enter play", nothing discarded:
  ruling Jan 11, 2026 Ruling 1); round 1 villain phase: Armored Shape (DEF 1 + 2, retaliate 1) held Iron Man to 0 and
  hit him for 1, and Armored Defense (cost 1) dealt 3 to quickstrike Hellcat (3 hit points), defeated him, and Hulkling
  still got the tough card (ruling Jan 11, 2026 Ruling 1, third question); his stun (Hellcat's When Revealed) replaced
  his next basic attack (RRG "Stun" p. 41); Alien Physiology generated 2 and paid for Hulk Shape (a Hulkling card)
  alone, Chosen Shape discarded Armored Shape and readied Hulkling; Shapeshifter Strike dealt 5, readied Hulk Shape,
  which answered the event twice in the turn (2 + 2); Imitation Shape replaced Hulk Shape and turned Iron Man's attack
  into a scheme (no attack, scheme resolved, threat 2); Shadow of the Past brought Super Skrull and Skrull Business;
  Alien Physiology generated 1 for Defensive Conditioning (a Protection card, so a card paid the rest); Winged Shape
  replaced Imitation Shape; Super Skrull's attack milled the Shapeshifter Strike under Skrull Business and still gave +2
  ATK (owner 14A), Fantastic Powers dressed the Super Skrull already in play without a new reveal, his damage kept
  (owner 15B), +3 hit points and retaliate 1, and he attacked again (ATK 2) with a second milled card. Not exercised:
  Altman Residence, Wiccan, Impersonation, Armored Shape's and Winged Shape's Responses, Excelsior, Patriot, Hidden Base
  (probed separately).

Neither game won (no scenario win in three rounds against a 12-hit-point leader; each stops at a fixed point with no
prompt or outcome open). A win path through the box is covered by the module tests only. The 12 greedy games of part 1
already ran both decks to losses without a stall.

Dependence on the engine agent's work in progress: the Hulkling game's round 1 reveals Hellcat, a quickstrike minion
with a When Revealed, so the order of his attack and his When Revealed (RRG "Quickstrike" p. 36 against ruling Feb 28,
2026 Ruling 4, see below) changes the event log but nothing the test asserts (it asserts the defeat, the tough card, no
damage, and his stun on Hulkling, none order-dependent). The tough-first order of "Status Cards" (p. 41) is used by the
Cat-Like Reflexes probe and by Hulkling's tough card absorbing Iron Man's attack in round 3, so a change to the damage
interrupt order would show there. Searches in both games have more than one candidate each; none depends on the
one-candidate change.

## Checked and correct

Every ref read side by side with the print (the data text with the scan-check's corrections), the script header and,
where the module's tests were thin, the engine's behavior. A ref on this list has the right targets, "may" or
compulsory, "each" or "a", timing, limit, cost-before-arrow and "then" order. Refs with a finding are marked.

- **Tigra, 21 refs.**
  - 56001a constant (guard lost, hero face only, copies by title; shown in the game and the kit tests) and On the Hunt
    (cap 3 per trigger, ruling Mar 30, 2026; shown at 4 and at 2 engaged); 56001b Undercover Work (once per round,
    shuffle).
  - 56002 Moon Knight (forced, shuffles, stun and confuse after the quickstrike attack); 56003 Precinct HQ (**F1**);
    56004 Cat's Head Amulet; 56005 Sharp Claws (+1 ATK, overkill or piercing, this attack only); 56006 Cat-Like Reflexes
    (hero interrupt, tough first by RRG p. 41, confuse optional); 56007 Hunted both refs (additional cost searched and
    paid, Q17 and Q18, hostless Hunted: known item 4; the interrupt readies Tigra before the defeat finishes).
  - 56008 Tooth and Claw (cost reduced by engaged minions, floor 0; two independent 4s, the second choosing after the
    first; shown at costs 0 and 2); 56009 Feline Senses (**F1**).
  - 56023 In Too Deep (known item 3, and the kit tests' surge and form paths); 56024 The Hood, 56028 Jigsaw (threat on
    Criminal Underworld only when it is in play; Jigsaw only when he damaged; shown for the Hood); 56025 Criminal
    Underworld (a Criminal minion cannot be targeted by damage-only attacks: the script header's "an attack on one is
    still an attack" is stale, the module tests and the engine are right); 56026 Mantle (attach to the Hood, else the
    villain, as a card and as a boost; discard cost one energy and one physical); 56027 Madame Masque (the "Otherwise"
    is "not in play", RRG p. 31; the boost adds two icons only without the scheme).
- **Hulkling, 26 refs.**
  - 56029a Chosen Shape (forced, the entering shape is kept, ready even with no other shape); 56029b constant (per
    player, refuses the second shape, nothing discarded) and Shape-Changer.
  - 56030 Wiccan; 56031 Altman Residence (heal does not wait on a card); 56032 to 56035 constants (hero face only;
    retaliate, Aerial) and Responses (once per exhaust; **F1** shape for Winged Shape's threat removal); 56035 Forced
    Interrupt (status cards first; replaces a villain's and a minion's attack; does not let Super Skrull's attack
    Interrupt trigger: probed, passes); 56036 Alien Physiology (2 for a Hulkling card, 1 otherwise, cannot pay for
    itself, shown at 2 and 1).
  - 56037 Shapeshifter Strike (ready as part of the event, so the shape answers twice); 56038 Armored Defense (damage
    equal to DEF at resolution, tough after the attack even on a defeat, no DEF reduction of its own); 56039
    Impersonation (**F1**; the card-caused form change leaves the voluntary change available, and Hidden Base hears it:
    both probed); 56040 Shapeshifter.
  - 56054 Complicated Lineage (known item 3); 56055 Super Skrull (four lines read at once, wild its own line, 14A
    shown); 56056 Skrull Business (once per discard from a top, still counted); 56057 Fantastic Powers (**F3**; 15B
    shown, +3 hit points, retaliate 1, attack in hero form only); 56058 You're Coming With Me! (distinct icons, wild its
    own; one instance of damage per "For Each" RRG p. 20).
- **Aggression and basic, 12 refs.**
  - 56010 Two-Gun Kid; 56011, 56014, 56015, 56018 reprints (text equal to 04040, 46014, 19030, 21046: ten reprint pairs
    pinned by one test each); 56012 Air Cover (**F2**); 56013 Aggressive Conditioning; 56016 Coup de Grace (the upgrade
    is a player upgrade, guard bars only attacks on the villain, RRG "Guard" p. 21, so a guard minion does not hide the
    other minions); 56017 Savage Strike (9 damage with Aggressive Conditioning, MC56 p. 18); 56019 Yellowjacket (Avenger
    only: refused in alter-ego form); 56020 to 56022 resources; 56052 Iron Lad (another ally, the matching power).
- **Protection, 11 refs.**
  - 56041 Patriot; 56042, 56044, 56048, 56049, 56051, 56053 reprints (text pinned); 56043 Hidden Base (answers a change
    to alter-ego form only; also after a card-caused change); 56045 Excelsior (after a defense-labeled event as well:
    probed with Cuts Both Ways, "I Can Do This All Day" and Armored Defense, the rulebook's combo); 56046 Defensive
    Conditioning; 56047 "I Can Do This All Day" (usable on an exhausted hero, DEF still applies, RRG p. 15: probed);
    56050 Cuts Both Ways (known item 1).

In sum: 65 refs checked and correct and 5 with a finding (56003, 56009 and 56039 for F1, 56012 for F2, 56057 for F3),
with the Response of 56032 sharing F1's shape.

## Unproven

- **Winged Shape's Response with no threat** (F1 shape), not staged; Precinct HQ, Feline Senses and Impersonation are.
- **Quickstrike with a When Revealed** (Hellcat in both games): order is in flux; see below.
- **Skrull Business when it leaves play**: the print says nothing about the cards under it; not tested.
- **Mantle on the Hood with Criminal Underworld in play**: the Mantle can only be discarded by a basic attack against
  its host, and the Hood cannot be attacked while the side scheme is in play, so the Mantle cannot be removed that way.
  A card consequence, not a script one (the module tests strip it with the scheme out of play); not judged.
- **Multi-player behavior** of Patriot, Hidden Base, Taunt, "I Can Do This All Day" across players and the obligations:
  covered by the kit tests, not re-run here; the games are one-player.
- **Hidden Base after Complicated Lineage's own flip**: probed after Impersonation's flip only.
- **Winning paths**: neither game won.
- **Engine work in progress**: the tough-first and damage-interrupt orders (see "Dependence" above).

## Spec corrections owed

`docs/phase7-wave10-box-heroes.md` and the registration audit (`docs/phase7-wave10-qa-registration.md`); the main
session owns the status and open questions, these are reports:

1. **Registration audit F3 (Mark V Armor and a tough status card, "no order is offered")** reads RRG "Tough" (p. 44) as
   a forced interrupt the first player orders against Mark V Armor's. RRG "Status Cards" (p. 41) settles it the other
   way: "Status card abilities have timing priority over all conflicting triggered abilities". The engine's tough-first
   order is the rule, not a defect; the finding and its `it.fails` should be reconsidered. This audit pins the same
   order for Cat-Like Reflexes (passing test).
2. **Registration audit F4 (Quickstrike resolves before When Revealed)** cites RRG "Quickstrike" (p. 36) and "Teamwork"
   (p. 43), which say Quickstrike resolves after the minion's When Revealed. FFG's Feb 28, 2026 Ruling 4 (two questions;
   the second is Hellcat by name) says the opposite: "A minion engages the player first, then resolves When Revealed.
   Because Quickstrike triggers upon engagement, Quickstrike resolves first, followed by When Revealed." RRG 1.8, the
   July edition of that year, is the later text, so it is probably the current rule, but the two disagree and neither
   audit nor the spec records it. Per the repository's rule, flag the conflict and let the owner decide before the
   engine change lands.
3. **B3.1 / the Hunted script header: "RRG 1.8 'Attach To', p. 8"** is the nearest entry, not an exact one (known item
   4); the discard follows from the paid play (p. 32) and the fourth bullet of the entry. State the reading in the spec.
4. **The 56025 Criminal Underworld script header** ("an attack on one is still an attack") is wrong: the engine and the
   module tests refuse the attack (RRG "Target" p. 42, ruling Mar 19, 2026 Ruling 2, the registered behavior). Correct
   the comment.
5. **B8.4 lines 5 and 10** (the two starter-deck games) are now met by the two precon e2e files; the games ran in
   `registration-iron-man`, not against a Core villain, as the spec's last paragraph allows once the leader landed.
6. **Target validity of threat removal** (F1): the spec's card designs (B3.1, B3.2) assume an event with no valid target
   cannot be played (Q17 for Hunted); the engine applies that rule to Hunted (Q17) and to basic powers but not to the
   threat-removal abilities tested here. The spec should say which is meant before the engine changes.
