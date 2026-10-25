# Phase 7, Wave 10, pass 1b: Civil War's two heroes and the box's player cards

> **Status:** spec only. Nothing here is built. This is pass 1b of the wave 10 spec; the main file is
> [phase7-wave10.md](phase7-wave10.md) (pass 1a: leaders, scenarios, modular sets, cooperative rules), whose §6.1 is
> the placeholder this file fills. Sections carry a `B` prefix so that no number here collides with the main spec.
> There is no B5 or B6: the main spec's §5 and §6 cover those subjects for the whole wave.

**Scope.** The player side of the Civil War box (`cw`, MC56): Tigra 56001a/b and her kit 56002–56009, her obligation
56023 and nemesis set 56024–56028; Hulkling 56029a/b and his kit 56030–56040, his obligation 56054 and nemesis set
56055–56058; the Aggression cards 56010–56018, the Protection cards 56041–56051 and the basic cards 56019–56022,
56052 and 56053. Fifty-eight records, sixty faces.

**Out of scope.** Every other encounter card of the box (pass 1a). The sixteen leader-specific basic cards, which are
used only in competitive mode (MC56 p. 3; `docs/competitive-mode-plan.md` §2.1): The Futurist 56129, Target Lock
56130, High-Tech Suit 56131, Suit Up 56132, Provoked Response 56133, You Started This 56134, Alpha Flight Recruit
56135, Raw Power 56136, No, You Move! 56207, Fighting Dirty 56208, Recruited by Cap 56209, The People's Hero 56210,
Double Agent 56211, Spider-Blast 56212, Hard to Hit 56213 and Secret Contact 56214.

---

## B0. Sources read

- **Raw records.** `packages/content/raw/marvelcdb/cw.json` (an object: `source`, `fetchedAt` 2026-09-13, `pack`,
  `cards`; 214 records). Every record with a code from 56001 to 56058 was read by script, with the two nested
  `linked_card` faces (56001b Greer Nelson, 56029b Teddy Altman). All card text quoted below is the raw `real_text`
  unless a scan is named.
- **Scans read** (`assets/card-art/bundles/cards/`): 56007 Hunted, 56023 In Too Deep, 56027 Madame Masque, 56055 Super
  Skrull. They settle two raw typos and one missing reminder line (B1). No scan exists for the eight reprints 56011,
  56015, 56018, 56042, 56044, 56049, 56051 and 56053.
- **MC56 rulebook, as page images.** p. 18 (starter decks: both lists and both nemesis sets, read in full) and p. 20
  (FAQ: seven entries, none names a card of this pass).
- **RRG 1.8** (`docs/rules/mc_rulesreference_v18_compressed.md`; pages from the footer that follows a line): Activation p. 6,
  Attach To p. 8, Attack p. 10, Choose (Option) p. 12, Classifications p. 12, Copy p. 13, Cost p. 14, Defend, Defense
  p. 15, Engage p. 18, Find p. 19, Form and Guard p. 21, Identity-Specific Card p. 23, Labeled Ability p. 26, "Loses"
  p. 27, Max p. 28, Play, Put into Play p. 32, Quickstrike p. 36, Resource Ability p. 37, Retaliate X p. 38, Search
  p. 39, Status Cards, Steady and Stun p. 41, Triggering Condition and Tuck p. 45, Villainous p. 47, When Revealed
  p. 48; FAQ entries Tigra/Greer Grant Nelson (#51) p. 58, Wasp, Quicksilver and Hulk p. 61; errata Yellowjacket
  (#19) and Moon Knight (#65) p. 70.
- **FFG rulings** (`docs/rulings/marvel-champions-rulings-post-rrg-1-7.md`, by date heading, each read this session): January 11,
  2026 – Ruling 1 (Teddy Altman; Armored Defense); February 28, 2026 – Ruling 1 (abilities triggered by a cost
  resolve before the effect; quickstrike included) and Ruling 4 (quickstrike resolves on engagement); March 30, 2026 –
  Ruling 1 (On the Hunt's maximum); April 30, 2026 – Ruling 4 (Digging Deep, behind wave 7's Q32); July 9, 2026 –
  Ruling 1 ("I Can Do This All Day").
- **`docs/phase7-wave10-sources.md`**, used for the cites above; each was re-read at the line it gives.
- **Engine and DSL**, checked by name: `packages/engine/src/spec.ts`, `abilities.ts`, `trigger-events.ts`,
  `attach-cost.ts`, `enemy-attack-cost.ts`; `packages/cards/src/dsl/{abilities,effects,values}.ts`; and the scripts
  of the cards reprinted here.

**Three collisions of name, none a rule for this pass.** RRG FAQ "Tigra/Greer Grant Nelson (#51)" (p. 58) is Core's
Tigra ally 01051, not the hero 56001a. RRG erratum "Moon Knight (#65)" (p. 70) is a Synthezoid Smackdown encounter
card, not the ally 56002. The Jigsaw of January 11, 2026 – Ruling 2 is another product's card, not 56028.

---

## B1. Schema and data needs

Nothing here needs a new schema field. The points below are for `card-data-pipeline`; the corrections are listed
again in B8.1.

- **Shapeshift is a trait.** The four upgrades carry `traits: "Shapeshift."`, card text writes it as
  `[[Shapeshift]]` (the cache's trait markup) and the rulebook prints it in trait lettering (p. 18). It is emitted as
  `trait("SHAPESHIFT")`; it is not a keyword and has no RRG entry. The same holds for the other traits first seen
  here (Police, Kree, Skrull, Condition, Criminal).
- **Counter types.** Air Cover 56012 (fuel), Hidden Base 56043 (stronghold) and The Night Nurse 56044 (medical) are
  `uses` keywords with a `counterType`, as today.
- **Hunted 56007 has no data host.** Its text holds the words "Attach Hunted to that minion", but that minion is the
  one its additional cost put into play (B3.1). The record must not carry `attachesTo: minion`, which would offer
  every minion in play as a host, and must not default to the controller's identity. `cost_star` is the star icon
  (`starIcon`); the cost is 0.
- **Play restrictions already in the schema** (`PlayRestrictions`): "Play under any player's control. Max 1 per
  player." on 56013 and 56046 (`anyPlayerControl`, `maxPerPlayer`); "Max 1 per player" on 56012; "Max 1 per minion" on
  56014 (`maxPerHost`); "Max 1 per phase" on 56015 (`maxPerPhase`); "Play only if you have the Avenger trait" on 56019
  (`requiresIdentityTrait`); restricted on 56045.
- **Attachments with a stat box.** The Hood's Mantle 56026 and Fantastic Powers 56057 each print +1 ATK and +1 SCH
  (`statModifiers`). 56026's host is "The Hood. Otherwise, attach to the villain" (the two-step host Red Skull's set
  uses, `wave2/trors/red-skull.ts`). 56057 has no "attach to" line: its When Revealed attaches it (B3.13).
- **Nemesis minions.** The Hood 56024 prints "(Tigra's nemesis minion.)" and takes `nemesisMinion: true`. Super
  Skrull 56055 prints no such line (scan), and is the only minion of his set; he takes `nemesisMinion: true` as well,
  or Core's Shadow of the Past has nothing to reveal for Hulkling.
- **Fixed starting threat.** Criminal Underworld 56025 (4) and Skrull Business 56056 (5) have `base_threat_fixed`:
  the number is not multiplied by the player count. Both print one acceleration icon.
- **Reprints.** Thirteen records carry `duplicate_of_code`: 56011 → 04040, 56014 → 46014, 56015 → 19030, 56018 →
  21046, 56020/21/22 → 01088/89/90, 56042 → 09012, 56044 → 09019, 56048 → 42016, 56049 → 05015, 56051 → 21064 and
  56053 → 12033. Every source card is scripted; the modules alias the source script (the wave 9 convention,
  `wave9/bp/aspect-basic.ts`).
- **Unique titles shared with older cards.** Tigra (hero 56001a; Core ally 01051), Moon Knight, Spider-Girl,
  Yellowjacket (ally 56019 and the box's own minion 56073), Patriot, Brother Voodoo, Iron Lad, Wiccan. The existing
  unique rule handles the player side; the encounter side is the main spec's §3.8.
- **Starter decks** (MC56 p. 18; 40 cards each, identity cards aside). Tigra: her 15 (56002, 56003, 56004, 56005 ×2,
  56006 ×2, 56007 ×3, 56008 ×3, 56009 ×2), Aggression 21 (56010, 56011, 56012 ×3, 56013 ×3, 56014 ×3, 56015 ×3,
  56016 ×3, 56017 ×3, 56018), basic 4 (56019–56022). Hulkling: his 15 (56030–56036, 56037 ×3, 56038 ×2, 56039 ×2,
  56040), Protection 21 (56041–56045, 56046 ×3, 56047 ×3, 56048 ×3, 56049 ×3, 56050 ×3, 56051), basic 4 (56052,
  56053 ×3). The raw `quantity` fields agree with both lists.

---

## B2. Each hero's defining mechanic, in plain words

**Tigra wants minions around her, and brings them herself.** Hunted (three copies, cost 0) makes her take a minion of
her choice out of the encounter deck or its discard pile as part of its cost; the minion arrives engaged with her,
Hunted goes onto it and stuns it, and it has no guard while Tigra is in hero form. When that minion is defeated,
Tigra readies. Everything else counts the minions engaged with her: she draws a card for each as the player phase
begins (three at most), Tooth and Claw costs 1 less for each, Cat's Head Amulet makes a physical resource for each
(three at most), and Precinct HQ removes 1 more threat for each. Greer Nelson fetches a copy of Hunted once a round.
Her nemesis set is built against exactly this: Criminal Underworld makes every Criminal minion unable to take
damage, and all three of its minions are Criminals.

**Hulkling wears one shape at a time.** He has four Shapeshift upgrades (cost 2 each, one copy each). Each changes
his basic stats while it is in play, and each has a Hero Response, "after you play an event, exhaust this → …", with
its own payoff: remove 2 threat (Winged), deal 2 damage (Hulk), heal 2 (Armored), draw 1 (Imitation). When a
Shapeshift upgrade enters play under his control, every other one he controls is discarded and Hulkling readies, so
changing shape is also an extra action. Teddy Altman cannot have a second shape in play at all (he must flip first),
and fetches a shape once a round. Shapeshifter Strike readies the shape so its response can be used twice in a turn.
His nemesis set attacks the deck: it discards cards from the top, punishes what they show, and Skrull Business hides
them under itself.

---

## B3. Engine primitives (owner: `game-rules-architect`)

Statuses: **reusable as is** (the vocabulary exists and has run for another card), **reusable, verify** (the
vocabulary exists; the case named has not run, so a test comes first and an engine change is not expected), **needs
extension** (an existing primitive gains an option), **new**. Each name below was searched for in
`packages/engine/src` and `packages/cards/src/dsl` this session. One primitive is new, three need an extension, and
the rest of the fifty-eight cards are existing vocabulary.

### B3.1 An additional cost to play a card: a minion searched out of the encounter deck and put into play

> **Status: new.** No card so far has an additional cost on its own play: a search of `packages/cards/src` for
> "additional cost to play" finds nothing, and the engine's additional costs are all rules on other things
> (`additionalCostToReady`, `additionalPowerCost`, `additionalThwartCost`, `formChangeCost`). The steps it is made
> of exist: a search as part of a cost (`AbilityCost.attach`, `attach-cost.ts`), `encounterCards` over the deck
> and the discard pile, `putIntoPlay(card, you)`, `attachCard`, `stun`.

**Card.** Hunted 56007 (scan): "★ As an additional cost to play this upgrade, search the encounter deck and discard
pile for a minion and put it into play engaged with you. Attach Hunted to that minion and stun it. **Interrupt**:
When attached minion is defeated, ready Tigra."

**Rules.** RRG "Cost" (p. 14): "A player must pay all additional costs simultaneously with the cost that is being
added to … if they cannot pay for all of the costs at once, then they do not pay any of the costs and the effect
associated with the costs does not occur." RRG "Search" (p. 39): the player chooses among the cards that satisfy it;
"upon completion of that game step, game function, or card ability, shuffle that entire deck." RRG "Play, Put into
Play" (p. 32) and "When Revealed" (p. 48): a minion put into play is not revealed, so its When Revealed ability does
not trigger and surge does not resolve. RRG "Engage" (p. 18): a minion that enters a player's play area engages that
player. Ruling February 28, 2026 – Ruling 1: "Any abilities triggered by paying a cost resolve immediately before the
effect following the arrow resolves. The Quickstrike minion attacks before you heal 3 and gain Tough."

**What exists.** `planCost` and `payCost` (`actions.ts`) already pay a search-and-attach cost and resolve the
abilities a cost triggers before the paid-for effects (the comment at `actions.ts` on "Cost Arrow Icon" cites the
February 28 ruling). `on.attachedCardDefeated()` is "when attached minion is defeated".

**What is missing.** (a) A place on a card for a cost added to its own play. (b) A cost that searches the encounter
deck and discard pile and puts the pick into play. (c) The played upgrade entering play attached to the card the
cost bound, not to a data host.

**Proposed shape.** A constant part read while the card is in hand, `additionalCostToPlay(cost)`, merged into the
play's cost by `planCost`; and `AbilityCost.encounterSearchIntoPlay { query, zones: ["deck", "discard"],
engagedWith, slot }`, written beside `attach-cost.ts` and using its find, announce and shuffle steps. The play
command reads the slot as the upgrade's host (`playAttachesToSlot: "hunted"`), and the card's enter-play effect is
`stun(chosen("hunted"))`. The task agent reads `actions.ts` first and may fold (c) into `attachInstruction` if that
is the smaller change.

**Rules of the build.**

- The cost is payable only if the encounter deck or its discard pile holds a minion; otherwise Hunted is not offered
  (open question Q17). Set-aside cards (a nemesis set not yet in the deck) are not searched: the text says search,
  not find.
- The minion enters play engaged with the payer and is announced as a minion entering play and engaging, so Air
  Cover, Patriot and quickstrike hear it. Its When Revealed does not resolve.
- Order: resource cost and the search are paid together; abilities the cost triggered resolve (quickstrike's attack
  included, open question Q18); then Hunted enters play attached to that minion and the minion is stunned. The Hood
  (steady) needs two stunned cards to be stunned (RRG "Steady", p. 41).
- If the minion has left play before Hunted would attach (its quickstrike attack met retaliate, say), Hunted has no
  host and is discarded (RRG "Attach To", p. 8).
- Hunted is controlled by the player who played it. "Ready Tigra" readies the identity only while it shows the Tigra
  face (wave 9 §4.1 Q44: a seat in alter-ego form does not show its hero title).

**Tests (exact numbers).** Encounter deck with one minion (3 hit points) third from the top, none in the discard
pile: Hunted is offered at cost 0; after it resolves the minion is engaged with Tigra, holds Hunted and one stunned
card, and the deck has been shuffled (the log shows one shuffle). No minion in either pile: not offered. A guard
minion taken this way: Tigra's basic attack may target the villain; after she flips to Greer Nelson the minion has
guard again (B3.7). A quickstrike minion with ATK 2 taken in hero form, DEF not used: Tigra takes 2, then the minion
is stunned (Q18 default). Tigra exhausted, her ally defeats the hunted minion: Tigra readies. The same while in
alter-ego form: nothing readies. Air Cover in play with 2 fuel counters: its response is offered for the hunted
minion, and finds Suppressing Fire.

### B3.2 A defeat that ignores the defeated minion's "When Defeated" abilities

> **Status: needs extension.** `EffectSpec defeat { target }` (`spec.ts`; its doc cites Nova Prime) defeats outright
> and announces `characterDefeated` marked `byEffect`, so When Defeated abilities see it. `RuleSpec ignoreAbilities`
> names abilities by id and lasts while a card is in play; it cannot say "whatever When Defeated this minion has".

**Card.** Coup de Grâce 56016: "**Hero Action** _(attack)_: Defeat a non-Elite minion with an upgrade attached.
Ignore any '**When Defeated**' abilities on that minion."

**Proposed shape.** `defeat(target, { ignoreWhenDefeated: true })`: the `characterDefeated` event carries the flag,
and the trigger collector skips abilities of kind `whenDefeated` on the defeated card, printed or gained. Nothing
else is skipped: Victory X, "when attached minion is defeated" on an attachment (Hunted, Suppressing Fire), and
other cards' responses to the defeat all resolve.

**Rules of the build.** The target must be a minion without the Elite trait that has a player upgrade attached (an
encounter attachment is not an upgrade). No damage is dealt, so a tough status card and Criminal Underworld's "cannot
take damage" do not stop it, as with Nova Prime's defeat. Retaliate deals nothing: the minion is not in play after
the attack (RRG "Retaliate X", p. 38). The event is an attack by the hero (RRG "Labeled Ability", p. 26), so a
stunned hero discards the stunned card and defeats nothing; guard does not matter (the target is a minion).

**Tests.** A minion (4 hit points, "When Defeated: place 2 threat on the main scheme") with Suppressing Fire
attached: it is defeated, no threat is placed, and Suppressing Fire heals 2 from the hero (the pairing MC56 p. 18
describes). Madame Masque with Hunted attached while Criminal Underworld is in play: defeated; Tigra readies. A
minion with only The Hood's Mantle attached: not a legal target. An Elite minion with Hunted attached: not a legal
target.

### B3.3 Cards discarded from the top of any player's deck, placed facedown under a scheme

> **Status: needs extension** (small). The `cardDiscardedFromDeck` trigger exists, with `on.youDiscardFromYourDeck()`
> and `on.thisDiscardedFromYourDeck()` over it; both fix the player to the card's controller. `tuckCards { cards,
> under, facedown }` exists (Stolen Memories, Lost Visor). Missing: a pattern for any player's deck on an encounter
> card, and a decision on what the discarding ability still reads (open question Q14).

**Card.** Skrull Business 56056: "**Forced Response**: After any number of cards are discarded from the top of a
player's deck, place those cards facedown under this scheme."

**Rules.** RRG "Triggering Condition" (p. 45): one occurrence that discards several cards is one window. RRG "Tuck"
(p. 45): "Tucked cards are not in play … When a card leaves play, each card tucked under it is discarded", each to
its owner's discard pile. The printed text says "place … facedown under", not "tuck", and RRG "Tuck" speaks of
faceup cards; the engine already holds facedown cards under a host with the same leave-play rule.

**Proposed shape.** `on.aPlayerDiscardsFromTheirDeck()`: `pattern("cardDiscardedFromDeck")` with no `playerIs`, the
cards read with `eventTargetsTogether`. The script is `forcedResponse(…, tuckCards(eventTargetsTogether, self, {
facedown: true }))`.

**Rules of the build.** Every discard off the top of a player deck counts, by an encounter card (Super Skrull, You're
Coming With Me!), by a player card's effect or cost, by any player. A card discarded from hand or from play does not.
The card whose discard emptied the deck is taken from the new deck (wave 7 §4.1 Q33). When Skrull Business is
defeated the cards return to their owners' discard piles.

**Tests.** Skrull Business in play; You're Coming With Me! discards three cards from Hulkling's deck: one forced
response, three cards facedown under the scheme, none in the discard pile. A second player's Hulk ally attacks and
discards one card: it goes under the scheme. The scheme (5 threat) is thwarted to 0: all four cards are in their
owners' discard piles. A card discarded from hand: untouched. The count of damage or threat from You're Coming With
Me! in the first test follows Q14.

### B3.4 "You cannot have more than 1 [trait] upgrade in play"

> **Status: needs extension.** `RuleSpec cannotEnterPlay { cards, while }` exists as a scenario rule that matches by
> title for every player (its doc: wave 8 §3.43). Missing: the rule read from an identity face's constant and limited
> to the cards that would enter play under that identity's controller.

**Card.** Teddy Altman 56029b: "You cannot have more than 1 Shapeshift upgrade in play."

**Rules.** Ruling January 11, 2026 – Ruling 1: "Teddy Altman's constant ability prevents playing another Shapeshift
upgrade while already having one in play (cannot play a second and discard down)."

**Proposed shape.** `cannotEnterPlay(query("upgrade", { trait: SHAPESHIFT }), { while: exists(a Shapeshift upgrade
you control), player: you })` inside `constant(rule(…))` on the alter-ego face. With `player` set, the rule stops a
matching card from being played or put into play under that player's control only.

**Rules of the build.** The rule is on the alter-ego face, so it applies only while Teddy Altman is faceup. With no
shape in play he may play one. In hero form a second shape may be played, and Chosen Shape (B3.9) discards the first.
The text speaks of having, not of playing, so a put-into-play effect is stopped as well; no card in the box does
that. The rule never discards anything: Hulkling cannot hold two shapes when he flips, because Chosen Shape is
forced.

**Tests.** Teddy with Hulk Shape in play and Winged Shape in hand: Winged Shape is not offered, and the reason shown
names Teddy Altman's ability. Teddy with no shape: Winged Shape is offered and enters play; Hulkling's Chosen Shape
does not trigger (wrong face), so nothing readies. Another player's Shapeshift-less upgrades: unaffected.

### B3.5 A basic attack resolved against two enemies

> **Status: reusable, verify.** `EffectSpec resolveAttackAgainst { targets }` (`spec.ts`; Thor 25013): the attack in
> progress is also resolved against each other named card its attacker can attack, as separate attack events with
> the same attacker, damage, keywords and source, with no second consequential damage. Not run: an ally as the
> attacker; a target the player picks.

**Card.** Two-Gun Kid 56010 (ATK 2, consequential damage 1): "★ **Interrupt**: When Two-Gun Kid makes a basic attack,
choose 2 enemies instead of 1 and resolve this attack against each of them."

**Rules.** RRG FAQ "Wasp" (p. 61): she "cannot choose the villain as a target while she is engaged with a minion
with the guard keyword", and she "is considered to attack each target", so each retaliate applies.

**What to verify.** The second enemy is chosen among enemies the ally can attack (guard applies to both picks). Each
enemy takes 2. Two-Gun Kid takes 1 consequential damage in all. Retaliate on both enemies deals to him twice. With
one enemy in play the interrupt adds nothing. A stunned Two-Gun Kid makes no basic attack, so the interrupt is not
offered (RRG FAQ "Quicksilver", p. 61).

**Tests.** Villain and one minion without guard: 2 damage each, 1 damage on Two-Gun Kid. A guard minion and the
villain: the villain is not a legal second target. Two minions with 4 hit points and retaliate 1: each takes 2, and
Two-Gun Kid (3 hit points) takes 1 and 1 from retaliate and 1 consequential damage, and is defeated.

### B3.6 A minion searched into play by an effect, then stunned and confused

> **Status: reusable as is** (compose). `chooseCards` over `encounterCards(["deck", "discard"], query("minion"))`,
> `putIntoPlay(chosen, you)`, `shuffleEncounterDeck()`, `stun`, `confuse` (Core's Masters of Mayhem 01133 is the same
> search). The order against quickstrike is open question Q18.

**Card.** Moon Knight 56002: "**Forced Response**: After Moon Knight enters play, search the encounter deck and
discard pile for a minion and put it into play engaged with you. Stun and confuse that minion."

**Notes.** It is forced: with a minion to find, one must be taken. With none, the deck is still searched and
shuffled (RRG "Search", p. 39). "Enters play" is any way of entering, not only a play from hand. Steady minions (The
Hood) take one stunned and one confused card and are neither stunned nor confused.

**Tests.** A deck with two minions: the player picks; it is engaged, stunned and confused; one shuffle. No minion:
one shuffle, nothing else.

### B3.7 A keyword lost while a named card is attached

> **Status: reusable as is.** `losesKeyword({ name }, target, { while })` (Physical Strain, wave 6 §3.13) and the
> query fragment `hasAttachment(q)` (Target Practice).

**Card.** Tigra 56001a: "Each minion with a copy of Hunted attached loses guard."

**Rules.** RRG "'Loses'" (p. 27); RRG "Copy" (p. 13): a copy is defined by title, so another player's Hunted counts.
The constant is on the hero face: in alter-ego form the minion has guard again.

**Script.** `constant(losesKeyword({ name: "guard" }, query("minion", hasAttachment(query("upgrade", { name: "Hunted"
})))))`. Tests are in B3.1.

### B3.8 Counts of the minions engaged with you

> **Status: reusable as is.** `countOf(query("minion", { engagedWith: "you" }))` with `min(…, 3)`;
> `on.phaseBeginning("player")`; `costModifier` with `activeIn: "hand"` (Core's Hercules ally);
> `generatesAmount(resource, n, max)` (Titanium Muscles); `removeThreat` of a computed amount.

**Cards.** Tigra 56001a ("On the Hunt — **Response**: After the player phase begins, draw 1 card for each minion
engaged with you (to a maximum of 3)"); Precinct HQ 56003; Cat's Head Amulet 56004 ("generate a [physical] resource
for each minion engaged with you (to a maximum of [physical][physical][physical])"); Tooth and Claw 56008 ("Reduce
the cost to play this event by 1 for each minion engaged with you"); "Bring It!" 56015 (reprint, no maximum).

**Rules.** Ruling March 30, 2026 – Ruling 1: "Tigra (On the Hunt): Caps drawing at 3 cards per trigger"; the maximum
belongs to that one use. RRG "Resource Ability" (p. 37), as `generatesAmount` reads it: at a count of 0 the ability
may be used and generates nothing.

**Notes.** On the Hunt is a hero-face response, so it is not offered while Greer Nelson is faceup; in a multiplayer
game it answers the one start of the player phase, whoever the first player is. Precinct HQ removes 1 + N from one
scheme as a single removal and is not a thwart. Tooth and Claw cannot cost less than 0. Its two sentences are two
instances of 4 damage, each with its own target chosen as it resolves; whether both may name one enemy is open
question Q16.

**Tests.** Four minions engaged as the player phase begins: Tigra draws 3. None: the response is not offered. Two
minions: Tooth and Claw costs 2; five minions: 0. Cat's Head Amulet with four minions: three physical resources;
with none: exhausts for nothing. Precinct HQ with two minions on a scheme at 5: 2 left. Tooth and Claw with a guard
minion (4 hit points) and the villain: the first 4 defeats the minion, the second may then name the villain.

### B3.9 The shapes: one at a time, stats and a trait while in play, a response to an event

> **Status: reusable as is.** `on.entersPlay` (with a trait and "under your control"), `discard(each(…))`,
> `ready(yourIdentity)`, `gets`, `gainsTrait` (`TRAIT.AERIAL` exists), `gainsKeywordX` for retaliate 1,
> `on.youPlayedCard(query("event"))`, `exhaustThis`, `ready` of a queried card.

**Cards.** Hulkling 56029a ("Chosen Shape — **Forced Response**: After a Shapeshift upgrade enters play under your
control, discard each other Shapeshift upgrade you control and ready Hulkling"); Winged Shape 56032 (+1 THW, +1 ATK,
+1 DEF, Aerial; remove 2 threat); Hulk Shape 56033 (+2 ATK, +1 DEF; deal 2 damage); Armored Shape 56034 (+1 ATK, +2
DEF, retaliate 1; heal 2); Imitation Shape 56035 (+2 THW; draw 1; B3.10); Shapeshifter Strike 56037 ("Deal 5 damage
to an enemy. Ready your Shapeshift upgrade"); Shapeshifter 56040 and Teddy Altman's Shape-Changer (a search of deck
and discard pile).

**Notes.** Each shape's bonus names Hulkling, so it applies to the hero face only. Chosen Shape readies Hulkling
even when there was no other shape to discard. "After you play an event" is heard once the event has resolved
(`cardPlayed`), for an event of any classification, played at any time: Armored Defense played during an enemy
attack lets Hulk Shape deal its 2 damage inside that attack (MC56 p. 18 names this pairing). Shapeshifter Strike
readies the shape as part of its effect, and its own play is then a new trigger, so one shape can answer two events
in a turn.

**Tests.** Hulkling (THW 1, ATK 1, DEF 1) with Hulk Shape: ATK 3, DEF 2. He plays Winged Shape while exhausted: Hulk
Shape is discarded, he readies, and his stats are THW 2, ATK 2, DEF 2 with Aerial. A new game, Hulk Shape ready: he
plays Tackle, and after it resolves Hulk Shape exhausts for 2 damage; he then plays Shapeshifter Strike on an enemy:
5 damage, the shape readies, and its response deals 2 more. Armored Shape and an enemy that attacks Hulkling:
retaliate deals it 1.

### B3.10 "When an enemy would attack you, it schemes instead" as a standing Forced Interrupt

> **Status: reusable, verify.** The replacement is wave 9 §3.52's: `interrupt(on.enemyAttacks(query("enemy"), {
> againstYou: true }), { would: true }, instead(enemyScheme(eventSource)))` (Invisibility Gear 51019, an optional
> ability that discards itself). Not run: the forced form that stays in play and answers every attack.

**Card.** Imitation Shape 56035: "**Forced Interrupt**: When an enemy would attack you, it schemes instead."

**Rules.** RRG "Status Cards" (p. 41): "Status card abilities have timing priority over all conflicting triggered
abilities", so a stunned enemy discards its stunned card and does not scheme. RRG "Activation" (p. 6): the scheme is
an activation; the villain's one boost card for the activation serves it.

**What to verify.** Every attack against the Hulkling player is replaced while the shape is in play: the villain's
and each minion's in the villain phase, quickstrike, an attack a card starts ("the villain attacks you": Taunt
56048 still draws its 3 cards, and the villain schemes). An attack aimed at an ally by a card is not an attack on
"you". A confused enemy that is made to scheme discards its confused card and places nothing. The scheme happens
with the player in hero form. "After [enemy] attacks" abilities do not trigger; "after [enemy] schemes" abilities
do. Super Skrull's "when Super Skrull attacks you" does not trigger.

**Tests.** Villain SCH 2, boost card with 1 icon, Imitation Shape in play, hero form: 3 threat on the main scheme,
no damage, Hulkling not asked to defend. The same villain stunned: the stunned card is discarded and no threat is
placed. Taunt: 3 cards drawn, the villain schemes. Super Skrull engaged: he schemes for 1 and the deck is not
discarded from.

### B3.11 Armored Defense: damage back by DEF, and a tough card after the attack

> **Status: reusable, verify.** `heroInterrupt` with the `defense` label on `on.enemyAttacks`, `dealDamage(statOf(
> yourIdentity, "def"), attackingEnemy)`, `atEndOfAttack(giveTough(yourIdentity))`; the defense label's claim of the
> defender is `defense-claim.ts`. Not run: `atEndOfAttack` after the attacker has left play.

**Card.** Armored Defense 56038: "**Hero Interrupt** _(defense)_: When an enemy attacks, deal damage to it equal to
your DEF. After this attack, give Hulkling a tough status card."

**Rules.** RRG "Defend, Defense" (p. 15): with a defense-labeled ability "that player's identity becomes the defender
and is considered to have defended the attack if there is not already a defender". RRG "Activation" (p. 6): "If an
activating minion leaves play, that minion's activation ends immediately". Ruling January 11, 2026 – Ruling 1:
"Yes, if Armored Defense defeats the attacking minion, Hulkling still receives a Tough status card."

**What to verify.** Hulkling becomes the defender without exhausting (unless an ally already defends), so his DEF
also reduces the attack and Excelsior 56045 may answer. The damage dealt back is not an attack. The tough card is
given when the attack ends, including when the damage defeated the attacker and ended the activation early. It may
be played during an attack on another player.

**Tests.** Hulkling with Armored Shape (DEF 3), a minion with 3 hit points and ATK 4 attacks: the minion is
defeated, Hulkling takes no damage and has a tough status card. The same against the villain (ATK 2, boost 1):
villain takes 3, the attack deals 3 − 3 = 0, Hulkling gets the tough card after the attack, then Armored Shape's
response heals 2 and Excelsior may deal 2 for an energy resource.

### B3.12 A discarded top card read by its printed resources; different icons counted

> **Status: reusable as is.** `moveCards(topOfDeck(n), "discard", bind)` with the `<bind>.<type>` totals (Core's Hulk
> 01050, Doctor Strange's kit and nemesis), `resourceTypesOf(ref)` ("wild counts as its own type"),
> `whenRevealedHero` / `whenRevealedAlterEgo`, `discardFromHand`, `giveTough`, a chosen `discard` of an upgrade.

**Cards.** Super Skrull 56055 (scan): "★ **Forced Interrupt**: When Super Skrull attacks you, discard the top card
of your deck. If that card's printed resource has: [energy] – Super Skrull gets +2 ATK for this attack. [mental] –
Discard 1 card from your hand. [physical] – Give Super Skrull a tough status card. [wild] – Discard an upgrade you
control." You're Coming With Me! 56058: "Discard the top 3 cards of your deck", then 1 threat on the main scheme
(alter-ego) or 1 damage (hero) "for each different resource icon on the discarded cards ([energy], [mental],
[physical], or [wild])".

**Rules.** RRG FAQ "Hulk" (p. 61): the ability "checks all printed resources … simultaneously", and the player
chooses the order the results resolve in. So a card with two different icons (Winged Shape: energy and mental)
gives both results; a card with two of one icon (Energy) gives that result once. Wild is its own line here, not
"all of the above". The player picks the card to discard from hand and the upgrade.

**Tests.** Top card Genius (two mental): one card discarded from hand, ATK unchanged. Top card Winged Shape: +2 ATK
for this attack and one card discarded from hand, in the order the player picks. Top card Shapeshifter 56040 (wild):
the player discards an upgrade they control; with none, nothing. You're Coming With Me! in hero form over Energy,
Strength and "I Can Do This All Day" (mental): 3 damage; over three Energy cards: 1 damage; over two cards because
the deck held two: the count is over those two, and the deck then resets as usual. With Skrull Business in play
these counts follow Q14.

### B3.13 Fantastic Powers: find a minion, put it into play, attach to it, and it attacks

> **Status: reusable as is** (compose). `findCard`, `putIntoPlay(…, you)`, `attachCard(self, …)`, `enemyAttack`,
> `inForm`; `gets` for the hit points and `gainsKeywordX` for retaliate 1 on the host. The case of Super Skrull
> already in play is open question Q15.

**Card.** Fantastic Powers 56057: "Attached minion gets +3 hit points and gains retaliate 1. **When Revealed**: Find
Super Skrull. Put him into play engaged with you and attach Fantastic Powers to him. If you are in hero form, Super
Skrull attacks you."

**Rules.** RRG "Find" (p. 19): every game area is searched, the play area included. RRG "Attach To" (p. 8): an
attachment left unattached is discarded, which is what happens when the When Revealed is canceled or Super Skrull
cannot be found.

**Tests.** Super Skrull in the encounter discard pile, hero form: he is engaged with the player with 8 hit points,
+1 ATK and retaliate 1, and attacks (his Forced Interrupt discards the top card of the deck). Alter-ego form: no
attack. Super Skrull in the set-aside nemesis set: found there.

### B3.14 Tigra's nemesis set: Criminals that cannot take damage, and threat on a named side scheme

> **Status: reusable as is.** `rule({ kind: "cannotTakeDamage", target })` (Edison's Giant Robot 05028), `placeThreat`
> on a named scheme with an `ifThen(inPlay(…))`, find-and-reveal of a card (wave 9 §3.63), `adjustBoostCount`, a
> boost ability that attaches its own card (Red Skull's set, Ronan's Universal Weapon), `after.attacks` with
> `eventDamageTaken`, `spend` of typed resources, the steady, villainous and quickstrike keywords.

**Cards.** The Hood 56024 (steady, villainous; "After The Hood attacks, place 1 threat on the Criminal Underworld
side scheme"); Criminal Underworld 56025 ("Each Criminal minion cannot take damage"); The Hood's Mantle 56026 ("Hero
Response: After you make a basic attack against attached enemy, spend [energy][physical] resources → discard this
card"; "★ Boost: Attach to The Hood. Otherwise, attach to the villain"); Madame Masque 56027 (scan: "Place 2 threat
on the Criminal Underworld side scheme. Otherwise, find Criminal Underworld and reveal it"; "★ Boost: … Otherwise,
this card gains [boost][boost]"); Jigsaw 56028 (quickstrike; "After Jigsaw attacks and damages a character, place 2
threat on the Criminal Underworld side scheme").

**Notes.** "Otherwise" is read as "if Criminal Underworld is not in play". Every Criminal minion is covered, from
any set. An attack on a minion that cannot take damage is still an attack. What Sharp Claws' overkill carries past
such a minion is the note already open at `wave1/twc/thunderball.ts`; this pass does not reopen it, and the
scripting agent tests whatever the engine does today. Coup de Grâce defeats without damage (B3.2).
The Hood gets a boost card for each basic activation (RRG "Villainous", p. 47), and a boost ability naming "the
villain" still means the villain.

**Tests.** Criminal Underworld in play, Tooth and Claw on Jigsaw: 0 damage. Side scheme cleared, the same: 4, and
Jigsaw (3 hit points) is defeated. Madame Masque revealed with the scheme out of play: it is found and revealed with
4 threat in a three-player game. Madame Masque as a boost card with the scheme out of play: +2 boost icons. The
Hood's Mantle on the villain, Tigra's basic attack, an energy and a physical resource spent: the Mantle is
discarded.

### B3.15 The two obligations

> **Status: reusable, verify.** The obligation frame ("You may flip to alter-ego form. Choose: exhaust [alter-ego] →
> remove from the game / …") is Core's. `enemyActivates(each(…), { against: you, bind })` with `not(made(bind))` and
> `surge` (Luminous 15025; Core's Masters of Mayhem). Not run: "no minions activate this way" when every engaged
> minion is stunned or confused.

**Cards.** In Too Deep 56023 (scan: "Each minion engaged with you activates against you. If no minions activate this
way, In Too Deep gains surge. Discard this card."); Complicated Lineage 56054 ("Discard each Shapeshift upgrade you
control. Discard this card.").

**Rules.** RRG "Activation" (p. 6): "Whenever an enemy attacks or schemes, it is considered to have activated", and
the player orders several minions' activations. RRG "Stun" (p. 41): the stunned card is removed "instead" of the
attack. So a minion whose attack a stunned card replaced, or whose scheme a confused card replaced, did not
activate. Tigra's own kit stuns the minions she fetches, so this case is the common one.

**What to verify.** `<bind>.made` stays 0 when every activation was replaced by a status card, and is 1 when at
least one minion attacked or schemed. The surge is In Too Deep's, resolved after it is discarded. Complicated
Lineage's second option may be chosen with no shape in play (an encounter card's option is refused only for want of
a target, RRG "Choose (Option)", p. 12).

**Tests.** Tigra in hero form with one stunned minion and one ready minion (ATK 2): one attack for 2, one stunned
card discarded, no surge. With only a stunned minion: the card is discarded, no attack, surge. With no minion:
surge. Hulkling with Armored Shape picks the second option of Complicated Lineage: the shape is discarded and
Hulkling does not ready.

### B3.16 Another ally's matching power added to a basic power

> **Status: reusable as is.** Thor's Teamwork 06032 is the same sentence for a hero: an interrupt on a basic attack
> or thwart, `exhaustCardsCost(query("ally", …), { slot })`, `modifyStat` by `statOf(chosen(slot), …)` until the end
> of the power. "You Got This!" 49019 (wave 8 §3.81) is the discard form.

**Card.** Iron Lad 56052: "★ **Interrupt**: When Iron Lad uses a basic power, exhaust another Avenger ally you
control → add that ally's matching power to Iron Lad's power for this use."

**Notes.** The source is Iron Lad himself; the exhausted ally is another ally with the Avenger trait under the same
controller. A stunned or confused Iron Lad has not used a basic power (RRG FAQ "Quicksilver", p. 61), so nothing is
offered. Hercules' Teamwork event 59021 (pass 2) is the same shape again.

**Tests.** Iron Lad (ATK 1) attacks, Patriot (ATK 2) exhausted: 3 damage, 1 consequential damage on Iron Lad only.
Iron Lad (THW 1) thwarts, Wiccan (THW 2) exhausted: 3 threat removed. Only a non-Avenger ally ready: not offered.

### B3.17 Reusable as is (checked by name against the engine unions and the DSL)

The identifier and its doc comment were read; the scripting agent's tests prove each.

- **Searches of your deck and discard pile for a card to hand.** Greer Nelson 56001b ("a copy of Hunted"), Teddy
  Altman 56029b and Shapeshifter 56040 (a Shapeshift upgrade), Wiccan 56030 (`ofClassification("identitySpecific")`
  event), Air Cover 56012 (a Tactic upgrade with `canAttachTo(eventTarget)`), Yellowjacket 56019 (top 5, an upgrade).
- **Attack modifiers.** Sharp Claws 56005 (`modifyBasicPower` +1, `chooseOne` of `thatAttackGainsKeywords` overkill
  or piercing), Savage Strike 56017 (+6 and piercing): 2 + 1 + 6 = 9 with Aggressive Conditioning, the number MC56
  p. 18 gives.
- **Damage prevented by discarding the card.** Cat-Like Reflexes 56006 (`discardThis`, `preventDamage(3)`, an
  optional `confuse` of an engaged minion).
- **"If this removes the last threat".** Feline Senses 56009 and Impersonation 56039, as Clear the Area 04049 reads
  it; Impersonation's "you may change to alter-ego form" is `changeForm`, which does not count against the player's
  own change of form that round (RRG "Form, Change Form", p. 21).
- **A card of an identity's set.** Altman Residence 56031 (`ofIdentitySetTitled("Hulkling")`, discard pile into the
  deck) and Alien Physiology 56036 (`resource({ wild: 1 })` with `doublesResourcesWhilePayingFor` over the same
  query).
- **Defending.** "I Can Do This All Day" 56047 is `declareDefender(yourIdentity)` without `exhaust` (Shieldmaiden);
  ruling July 9, 2026 – Ruling 1 says a redirect does not make the attack "initiated against you", which
  `attackInitiatedAgainst` already keeps apart. Cuts Both Ways 56050 is named in `gainKeywordUntil`'s own doc.
  Excelsior 56045 is a response to `defended` with a typed `spend`.
- **Engagement and form.** Patriot 56041 ("After you engage a minion" is `minionEngaged` with the controller as the
  player, the reading Thor's "Have at Thee!" settled); Hidden Base 56043 (`on.youChangeForm`, an alter-ego response,
  so it answers a change to alter-ego form).
- **Any player's control.** Aggressive Conditioning 56013 and Defensive Conditioning 56046: +3 hit points for the
  controller's identity and +1 ATK or DEF for its hero face (Endurance, Magical Enhancements).
- **Reprints, aliased.** 56011, 56014, 56015, 56018, 56042, 56044, 56048, 56049, 56051, 56053; the three double
  resources have no ability.

---

## B4. Open questions for the owner

**Answered 2026-10-11 (owner): 14A, 15B, 16A, 17A, 18A**, all provisional. 15B is built: Super Skrull moves to engage the
revealing player, by analogy with RRG "Find" (p. 19: a minion already in play that is found and revealed is engaged
by that player); the card says "Find … Put him into play engaged with you", so this is the nearest rule, not a ruling
on the card. Details: `docs/phase7-wave10.md` §4.0. Where B3 or B7 below describes 15A, 15B replaces it.

Numbered across the wave's pages (1 to 13 are in `docs/phase7-wave10.md` §4.1); these are 14 to 18. Until a question is
answered, A is what gets built. Each test that rests on an answer names the question.

| Q   | Question                                                                           | A (default)                                    | B                                        |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Q14 | Skrull Business takes cards an ability has just discarded: are they still counted? | Yes: the ability reads them, wherever they are | No: wave 7's Q32 applies, nothing counts |
| Q15 | Fantastic Powers revealed while Super Skrull is in play with another player        | He stays; it attaches; he attacks you (hero)   | He also moves to engage you              |
| Q16 | Tooth and Claw: may both 4s hit the same enemy?                                    | Yes, as the card reads                         | No: two different enemies                |
| Q17 | Hunted with no minion in the encounter deck or its discard pile                    | Cannot be played; not offered                  | May be tried: search, shuffle, no play   |
| Q18 | A quickstrike minion fetched by Hunted or Moon Knight: attack or stun first?       | It attacks first, then is stunned              | It enters play already stunned           |

**Q14. Skrull Business 56056 against Super Skrull 56055 and You're Coming With Me! 56058.** The engine opens the
response window for a deck discard before the discarding ability's next effect, and wave 7's Q32 (decided B there,
from the ruling of April 30, 2026 – Ruling 4 on Digging Deep, "applied generally") says a card a response took away
is not counted by the ability that discarded it. Applied here, Skrull Business would blank the rest of its own set:
with it in play You're Coming With Me! would deal no damage and Super Skrull's discard would do nothing. A: the
discarding ability still reads the printed icons of the cards it discarded, and they end facedown under the scheme;
Q32 keeps applying to a card that its own response moved. B: Q32 as written, nothing is counted. A is recommended
because the cards say "the discarded cards" and "that card", which the move does not make untrue, and because the
ruling was about a card returning itself to hand. No ruling names these cards. Cites: RRG "Triggering Condition"
p. 45; `on.youDiscardFromYourDeck`'s doc; wave 7 §4.1 Q32.

**Q15. Fantastic Powers 56057, Super Skrull already in play.** In a two-player game Super Skrull may be engaged with
the other player when the Hulkling player reveals this. "Put him into play engaged with you" cannot be done to a
card in play. A: he stays where he is, Fantastic Powers is attached to him there, and he attacks the revealing
player if that player is in hero form. B: he also moves to engage the revealing player. If he is already engaged
with the revealing player both answers agree. Cites: RRG "Find" p. 19; "Engage" p. 18; wave 9 §3.63.

**Q16. Tooth and Claw 56008.** The card: "Deal 4 damage to an enemy. Deal 4 damage to an enemy." The rulebook's
starter deck note (MC56 p. 18): "use Tooth and Claw to deal 4 damage to two of them". A: the two sentences are
independent, so one enemy may take both (8 in two instances); the card has no word "different", as Thunderclap
does. B: two different enemies. The rulebook line is a play tip, not a rule, so A follows the card.

**Q17. Hunted 56007 with nothing to find.** The search is a cost, and a cost that cannot be paid stops the play (RRG
"Cost", p. 14). A: the engine, which knows the piles, does not offer Hunted (as `attachCost` does today); this tells
the player that no minion is left. B: the player may try: the deck is searched and shuffled, Hunted stays in hand,
and no resources are spent. A is simpler and never lets a failed play shuffle the encounter deck.

**Q18. Quickstrike against Hunted 56007 and Moon Knight 56002.** Ruling February 28, 2026 – Ruling 1 says an
ability triggered by paying a cost resolves before the effect, quickstrike included, and Ruling 4 of the same day
says quickstrike triggers on engagement. The rulebook's starter deck note (MC56 p. 18) says "Play Hunted to put a
minion into play stunned". A: the rulings, which is also what the engine does today: the minion engages, attacks if
the player is in hero form, and is then stunned (and, for Moon Knight, confused). B: the stun is in place before
quickstrike can resolve. For Moon Knight the search is an effect and not a cost; A treats it the same way, since
the engagement is the trigger in both. RRG "Quickstrike" (p. 36) speaks only of a minion being revealed, which
neither card does.

---

## B7. Card coverage

"DSL" means existing vocabulary named in B3.17 or found by name this session. "Blocker" names a B8.2 task; "none"
means the card can be scripted once the data is emitted.

### B7.1 Tigra (`tigra`), her obligation and nemesis set

| Id     | Title               | Type        | Needs                                                 | Blocker        |
| ------ | ------------------- | ----------- | ----------------------------------------------------- | -------------- |
| 56001a | Tigra               | hero        | B3.7 (`losesKeyword`), B3.8 (draw by count, max 3)    | none           |
| 56001b | Greer Nelson        | alter ego   | DSL (search for a copy of Hunted; once per round)     | none           |
| 56002  | Moon Knight         | ally        | B3.6                                                  | none (Q18)     |
| 56003  | Precinct HQ         | support     | B3.8 (`removeThreat` 1 + count)                       | none           |
| 56004  | Cat's Head Amulet   | upgrade     | B3.8 (`generatesAmount`, max 3)                       | none           |
| 56005  | Sharp Claws         | upgrade     | DSL (`modifyBasicPower`, `thatAttackGainsKeywords`)   | none           |
| 56006  | Cat-Like Reflexes   | upgrade     | DSL (`discardThis`, `preventDamage`, `confuse`)       | none           |
| 56007  | Hunted              | upgrade     | B3.1; `on.attachedCardDefeated`                       | task 1 (Q17/5) |
| 56008  | Tooth and Claw      | event       | B3.8 (`costModifier` in hand; two damage instances)   | none (Q16)     |
| 56009  | Feline Senses       | event       | DSL (last threat removed, `stun`)                     | none           |
| 56023  | In Too Deep         | obligation  | B3.15 (`enemyActivates`, `made`, `surge`)             | task 6         |
| 56024  | The Hood            | minion      | B3.14 (steady, villainous; threat on a named scheme)  | none           |
| 56025  | Criminal Underworld | side scheme | B3.14 (`cannotTakeDamage` by trait)                   | none           |
| 56026  | The Hood's Mantle   | attachment  | B3.14 (typed `spend`; a boost that attaches the card) | none           |
| 56027  | Madame Masque       | minion      | B3.14 (find and reveal; `adjustBoostCount`)           | none           |
| 56028  | Jigsaw              | minion      | B3.14 (quickstrike; attacks and damages)              | none           |

### B7.2 Hulkling (`hulkling`), his obligation and nemesis set

| Id     | Title                  | Type        | Needs                                                     | Blocker      |
| ------ | ---------------------- | ----------- | --------------------------------------------------------- | ------------ |
| 56029a | Hulkling               | hero        | B3.9 (Chosen Shape)                                       | none         |
| 56029b | Teddy Altman           | alter ego   | B3.4; DSL (search; once per round)                        | task 4       |
| 56030  | Wiccan                 | ally        | DSL (`ofClassification("identitySpecific")` event search) | none         |
| 56031  | Altman Residence       | support     | DSL (`heal`, `ofIdentitySetTitled`, discard pile to deck) | none         |
| 56032  | Winged Shape           | upgrade     | B3.9 (`gets`, `gainsTrait`)                               | none         |
| 56033  | Hulk Shape             | upgrade     | B3.9                                                      | none         |
| 56034  | Armored Shape          | upgrade     | B3.9 (`gainsKeywordX` retaliate 1)                        | none         |
| 56035  | Imitation Shape        | upgrade     | B3.9, B3.10                                               | task 6       |
| 56036  | Alien Physiology       | upgrade     | DSL (`resource`, `doublesResourcesWhilePayingFor`)        | none         |
| 56037  | Shapeshifter Strike    | event       | B3.9 (`ready` of the shape)                               | none         |
| 56038  | Armored Defense        | event       | B3.11                                                     | task 5       |
| 56039  | Impersonation          | event       | DSL (last threat removed, `changeForm`)                   | none         |
| 56040  | Shapeshifter           | event       | DSL (search)                                              | none         |
| 56054  | Complicated Lineage    | obligation  | B3.15                                                     | none         |
| 56055  | Super Skrull           | minion      | B3.12                                                     | none (Q14)   |
| 56056  | Skrull Business        | side scheme | B3.3                                                      | task 3 (Q14) |
| 56057  | Fantastic Powers       | attachment  | B3.13                                                     | none (Q15)   |
| 56058  | You're Coming With Me! | treachery   | B3.12 (`resourceTypesOf`)                                 | none (Q14)   |

### B7.3 Aggression

| Id    | Title                   | Type     | Needs                                                    | Blocker |
| ----- | ----------------------- | -------- | -------------------------------------------------------- | ------- |
| 56010 | Two-Gun Kid             | ally     | B3.5 (`resolveAttackAgainst`)                            | task 5  |
| 56011 | Spider-Girl             | ally     | reprint of 04040, aliased                                | none    |
| 56012 | Air Cover               | support  | DSL (uses; `on.entersPlay` minion; `canAttachTo` search) | none    |
| 56013 | Aggressive Conditioning | upgrade  | DSL (any player's control; +3 hit points, +1 ATK)        | none    |
| 56014 | Suppressing Fire        | upgrade  | reprint of 46014, aliased                                | none    |
| 56015 | "Bring It!"             | event    | reprint of 19030, aliased                                | none    |
| 56016 | Coup de Grâce           | event    | B3.2                                                     | task 2  |
| 56017 | Savage Strike           | event    | DSL (+6 ATK, piercing, on a basic attack)                | none    |
| 56018 | Audacity                | resource | reprint of 21046, aliased                                | none    |

### B7.4 Protection

| Id    | Title                   | Type     | Needs                                              | Blocker |
| ----- | ----------------------- | -------- | -------------------------------------------------- | ------- |
| 56041 | Patriot                 | ally     | DSL (`minionEngaged`, `giveTough`)                 | none    |
| 56042 | Brother Voodoo          | ally     | reprint of 09012, aliased                          | none    |
| 56043 | Hidden Base             | support  | DSL (uses; `on.youChangeForm`; `giveTough`)        | none    |
| 56044 | The Night Nurse         | support  | reprint of 09019, aliased                          | none    |
| 56045 | Excelsior               | upgrade  | DSL (restricted; `defended`; typed `spend`)        | none    |
| 56046 | Defensive Conditioning  | upgrade  | DSL (any player's control; +3 hit points, +1 DEF)  | none    |
| 56047 | "I Can Do This All Day" | event    | DSL (`declareDefender` without exhausting)         | none    |
| 56048 | Taunt                   | event    | reprint of 42016, aliased                          | none    |
| 56049 | Tackle                  | event    | reprint of 05015, aliased                          | none    |
| 56050 | Cuts Both Ways          | event    | DSL (`gainKeywordUntil` retaliate 1, end of phase) | none    |
| 56051 | Preservation            | resource | reprint of 21064, aliased                          | none    |

### B7.5 Basic

| Id    | Title                | Type     | Needs                                                         | Blocker |
| ----- | -------------------- | -------- | ------------------------------------------------------------- | ------- |
| 56019 | Yellowjacket         | ally     | DSL (`requiresIdentityTrait` data; top 5 search); errata B8.1 | none    |
| 56020 | Energy               | resource | none (reprint of 01088)                                       | none    |
| 56021 | Genius               | resource | none (reprint of 01089)                                       | none    |
| 56022 | Strength             | resource | none (reprint of 01090)                                       | none    |
| 56052 | Iron Lad             | ally     | B3.16                                                         | none    |
| 56053 | Assess the Situation | event    | reprint of 12033, aliased                                     | none    |

---

## B8. Build order

### B8.1 Data corrections owed (`card-data-pipeline`)

These are in addition to the main spec's §8.1; item 1 overlaps its "errata titles" line and should be done once.

1. **56019** (RRG erratum, p. 70): title "Yellowjacket", and the text's own name with it ("After Yellowjacket enters
   play, search the top 5 cards of your deck for an upgrade and add it to your hand."). The raw reads "Yellow Jacket".
2. **56023** In Too Deep: raw "Each minion engage3d with you" → "engaged" (scan).
3. **56027** Madame Masque: raw "Criminal Underwold" → "Criminal Underworld" in the When Revealed (scan).
4. **56007** Hunted: no `attachesTo` host and no identity default (B1); `starIcon` on the cost.
5. **56024** and **56055**: `nemesisMinion: true`; 56055 by set membership, since the card prints no reminder line.
6. **56026** and **56057**: `statModifiers` +1 ATK, +1 SCH; 56026's host "The Hood, otherwise the villain"; 56057 no
   host.
7. **56025** and **56056**: starting threat fixed (4 and 5), one acceleration icon each.
8. The two starter deck lists of B1, checked against MC56 p. 18, and the thirteen `duplicate_of_code` links.
9. A check, not a change: the eight reprints without a scan (B0) take their image from the source card or stay
   without one.

### B8.2 Engine tasks (`game-rules-architect`), one agent each

1. **An additional cost to play a card, paid by searching the encounter deck for a minion into play** (B3.1). The
   constant part, the cost kind, the played upgrade's host from the cost's slot, `why-not` text, tests of B3.1.
2. **`defeat` with `ignoreWhenDefeated`** (B3.2). The flag on the effect and the event, the skip in the trigger
   collector, the DSL option, tests of B3.2.
3. **A deck-top discard from any player's deck as an encounter card's trigger** (B3.3).
   `on.aPlayerDiscardsFromTheirDeck()`, the facedown placement under a scheme and its return on leaving play, and
   the read order Q14 decides (default A: the discarding ability keeps reading the cards it discarded). Tests of
   B3.3 and the Q14 rows of B3.12.
4. **`cannotEnterPlay` limited to one player, from an identity face** (B3.4). The `player` option, the legality and
   `why-not` paths, tests of B3.4.
5. **Verify, attack side** (tests first; an engine change only if one fails): `resolveAttackAgainst` with an ally
   attacker and a chosen second target (B3.5); `atEndOfAttack` after the attacker has left play, and the defense
   label's defender (B3.11).
6. **Verify, activation side** (the same terms): the forced "would attack you, schemes instead" against villain,
   minion, quickstrike, a card's attack and a stunned enemy (B3.10); `made` at 0 when every activation was replaced
   by a status card (B3.15).

Tasks run side by side only where their file sets do not overlap. Tasks 1 and 2 are both likely to edit
`actions.ts` and the trigger collection beside it, so they run in sequence; 3 and 4 can run beside either. Tasks 5
and 6 write test files of their own.

### B8.4 Scripting modules (`ability-scripting-engineer`), one agent and one module per line

Paths are relative to `packages/cards/src/wave10/cw/`. "Waits on" lists B8.2 task numbers; a line with none can
start once the data is emitted. The wave's scaffold (`wave10/card-groups.ts`, the registries, the coverage guard,
`setup.ts`) is the first line of the main spec's §8.4 and comes before every line here; the starter deck setup for
the two heroes is added to it by lines 1 and 6.

Tigra (`tigra/`):

1. `identity.ts` (56001a, 56001b): waits on nothing.
2. `events.ts` (56008, 56009): waits on nothing; Q16.
3. `support-upgrades-allies.ts` (56002, 56003, 56004, 56005, 56006, 56007): Hunted waits on 1; the other five on
   nothing, so the module can land without Hunted and gain it afterwards; Q17, Q18.
4. `obligation-nemesis.ts` (56023, 56024, 56025, 56026, 56027, 56028): waits on 6 for In Too Deep's surge test.
5. Tigra starter deck e2e game (`tigra/precon-e2e.test.ts`): after 1 to 4 and `aspect-basic/aggression.ts`.

Hulkling (`hulkling/`):

6. `identity.ts` (56029a, 56029b): waits on 4.
7. `events.ts` (56037, 56038, 56039, 56040): waits on 5 for Armored Defense.
8. `support-upgrades-allies.ts` (56030, 56031, 56032, 56033, 56034, 56035, 56036): waits on 6 for Imitation Shape.
9. `obligation-nemesis.ts` (56054, 56055, 56056, 56057, 56058): waits on 3; Q14, Q15.
10. Hulkling starter deck e2e game (`hulkling/precon-e2e.test.ts`): after 6 to 9 and `aspect-basic/protection.ts`.

The box's other player cards (`aspect-basic/`):

11. `aggression.ts` (56010, 56011, 56012, 56013, 56014, 56015, 56016, 56017, 56018): waits on 2 (Coup de Grâce) and 5
    (Two-Gun Kid).
12. `protection.ts` (56041, 56042, 56043, 56044, 56045, 56046, 56047, 56048, 56049, 56050, 56051): waits on nothing.
13. `basic.ts` (56019, 56020, 56021, 56022, 56052, 56053): waits on nothing.

The two e2e games need a scenario. Until pass 1a's leaders are scripted they run against a Core villain; each is
run again against one Civil War leader once that leader's module lands. Lines 1 to 4 share no file with lines 6 to 9
or 11 to 13, so up to three can run at once under the repository's shared-worktree rules.
