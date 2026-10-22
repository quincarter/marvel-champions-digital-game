import { trait } from "@mc/content";
import type { AbilityRegistry, TargetQuery } from "@mc/engine";
import {
  canTakeStatus,
  boost,
  cannotChooseOption,
  cards,
  chooseCards,
  chooseEncounterCardType,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  constant,
  countOf,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardAtRandom,
  discardEncounterCards,
  discardEncounterUntil,
  discardFromHand,
  draw,
  each,
  engagedPlayerOf,
  exhaust,
  exists,
  firstPlayer,
  forcedInterrupt,
  giveTough,
  ifThen,
  handCountOf,
  made,
  moveCards,
  notOfChosenCardType,
  on,
  option,
  placeThreat,
  query,
  refMatches,
  removeThreat,
  revealCard,
  self,
  setVar,
  shuffleDeck,
  spendResources,
  stun,
  theMainScheme,
  theVillain,
  topOfDeck,
  valueAtLeast,
  varOf,
  whenRevealed,
  yourIdentity,
  you,
  zone,
} from "../../dsl/index.js";

// RRG 1.8 "Choose (Option)" (p. 12) and the February 28, 2026 Spell Blast ruling (owner decision 2026-10-20, reversing
// Q8): an encounter card's option is barred only when it needs a target and has no valid one, and a target is valid only
// if the ability can affect it (RRG 1.8 "Target", p. 42). So Avoid and Disarm need a card in hand to discard (Disarm
// with fewer than 2 discards what it can and skips its "then"), Disarm needs a character that can take a tough card or
// an enemy, and Trip is offered to an identity that already holds the status (the damage can still be dealt). None of
// the card's targets says "choose", so the first player selects (RRG 1.8 "First Player", p. 19).

/** "A character you control" a tough status card can be given to. */
const TOUGH_TARGET: TargetQuery = query("character", { controller: "you", ...canTakeStatus("tough") });
/** A TRAP! card (MC65 p. 12), any card type. */
const TRAP: TargetQuery = { trait: trait("TRAP!") };
/** The tags of a TRAP! card's three options: other cards name them ("the 'Avoid' effect on a Trap! card"). */
const AVOID = "avoid";
const DISARM = "disarm";
const TRIP = "trip";
const YOUR_CHARACTER: TargetQuery = query("character", { controller: "you" });
const handHas = (filter: TargetQuery, n = 1) => valueAtLeast(handCountOf(you, filter), n);
const THWART_EVENT = query("event", { trait: trait("THWART") });
const DEFENSE_EVENT = query("event", { trait: trait("DEFENSE") });
const ALLY = query("ally");
const UPGRADE = query("upgrade");
// A Permanent card cannot be discarded by a card from another set (insert p. 3), so it is no target for a Disarm's
// "discard ... you control" (e.g. Black Flower's Creeping Corruption); with none other, the option is not offered and its
// "then" never resolves (RRG 1.8 "Choose (Option)" p. 12, "Then" p. 44).
const OWN_ALLY = query("ally", { controller: "you", withoutKeyword: "permanent" });
const OWN_UPGRADE = query("upgrade", { controller: "you", withoutKeyword: "permanent" });
const OWN_SUPPORT = query("support", { controller: "you", withoutKeyword: "permanent" });
const ATTACK_EVENT = query("event", { trait: trait("ATTACK") });
const IDENTITY_SPECIFIC: TargetQuery = { classification: "identitySpecific" };

/**
 * Deadly Contraptions (Shadowland, MC65 pp. 12-13; docs/phase7-shadowland.md section 6 M3). The TRAP! cards are
 * revealed from the trap deck (see the Shadow Labyrinth module); a TRAP! card's discard routing is the engine's.
 *
 * Every TRAP! card's When Revealed is a choice of Avoid, Disarm or Trip, each option tagged `avoid` / `disarm` /
 * `trip` (engine `EffectSpec chooseOne` option `tag`), which is how the cards that name "the 'Avoid' effect on a Trap!
 * card" find it, without reading the display label:
 * **Nervous Jitters (65046)**, **Hall of Punishment (65048)**, **Path of a Thousand Cuts (65049)**: "Forced
 *   Interrupt: When you choose the ... effect on a Trap! card" is `on.optionChosen(tags, { source: TRAP })`, which
 *   resolves after the choice and before the chosen option (RRG 1.8 "Interrupt", p. 25).
 * **Iron Monk (65047)**: "you cannot choose the 'Avoid' effect" is a `cannotChooseOption` rule for the player it is
 *   engaged with. The other options are then chosen among as RRG 1.8 "Choose (Option)" (p. 12) has it: one left
 *   resolves without asking.
 *
 * Disarm's second part is a "then" (RRG 1.8 "'Then'", p. 44). A spend option on an encounter card is offered even when
 * unpayable (owner decision 2026-10-20, see `executeChooseOne`); its "then" part runs only if the spend was made. A
 * "discard a card you control" Disarm is offered only while you control such a card: its explicit `when: exists(...)`
 * gate bars it, since the engine treats the "then" part as independent and would not. "Discard cards until a minion /
 * side scheme is discarded, then reveal it" reveals the match for the revealing player.
 *
 * Cards (11):
 * - 65046 Nervous Jitters (attachment)
 * - 65047 Iron Monk (minion)
 * - 65048 Hall of Punishment (side scheme)
 * - 65049 Path of a Thousand Cuts (side scheme)
 * - 65050 Blinding Powder (TRAP! treachery)
 * - 65051 Caltrops (TRAP! treachery)
 * - 65052 Flame Spout (TRAP! treachery)
 * - 65053 Oil Slick (TRAP! treachery)
 * - 65054 Poison Darts (TRAP! treachery)
 * - 65055 Pressure Plate (TRAP! treachery)
 * - 65056 Tripwire (TRAP! treachery)
 */
export const SHADOWLAND_DEADLY_CONTRAPTIONS: AbilityRegistry = defineAbilities({
  // Nervous Jitters (65046), attached to your identity. "Name an encounter card type" offers the eight encounter card
  // types of RRG 1.8 "Card Types" (p. 12). "If the card discarded this way was not of the named type": with no card
  // discarded (an empty encounter deck and discard pile), nothing was discarded "this way" and nothing follows.
  "65046.nervous-jitters-forced-interrupt": forcedInterrupt(
    on.optionChosen([AVOID, DISARM], { source: TRAP }),
    chooseEncounterCardType("named"),
    discardEncounterCards(1, { bind: "jitters" }),
    ifThen(refMatches(chosen("jitters"), notOfChosenCardType("named"), { anywhere: true }), [
      dealIndirectDamage(you, 4),
      discard(self),
    ]),
  ),
  // Iron Monk (65047): no player is named while it is engaged with nobody, so nobody is barred.
  "65047.iron-monk-constant": constant(cannotChooseOption(engagedPlayerOf(self), [AVOID], { sources: TRAP })),
  "65048.hall-of-punishment-forced-interrupt": forcedInterrupt(
    on.optionChosen([TRIP], { source: TRAP }),
    moveCards(topOfDeck(3), "discard"),
  ),
  "65049.path-of-a-thousand-cuts-forced-interrupt": forcedInterrupt(
    on.optionChosen([AVOID, TRIP], { source: TRAP }),
    dealIndirectDamage(you, 2),
  ),
  "65048.boost": boost(placeThreat(countOf(YOUR_CHARACTER), theMainScheme)),
  "65049.boost": boost(dealDamage(1, each(YOUR_CHARACTER))),

  "65050.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Avoid: discard a Thwart event from your hand",
        { tag: AVOID, when: handHas(THWART_EVENT) },
        discardFromHand(1, you, { filter: THWART_EVENT }),
      ),
      option(
        "Disarm: discard 2 cards at random from your hand, then give a character you control a tough status card",
        // Offered while its discard can resolve; the "then" part with no target does not bar it (RRG 1.8 "Choose
        // (Option)", p. 12: an independent part keeps the option).
        { tag: DISARM, when: handHas({}) },
        setVar("handBefore", handCountOf(you)),
        discardAtRandom(2),
        // "Then" (RRG 1.8 p. 44): only if both cards were discarded. Read from the hand as it was, because the engine's
        // pre-"then" check does not see a discard that found fewer cards than it asked for.
        ifThen(valueAtLeast(varOf("handBefore"), 2), [
          chooseTarget("armed", TOUGH_TARGET, { chooser: firstPlayer }),
          giveTough(chosen("armed")),
        ]),
      ),
      option(
        "Trip: deal 2 damage to your identity and confuse it",
        { tag: TRIP },
        dealDamage(2, yourIdentity),
        confuse(yourIdentity),
      ),
    ),
  ),

  "65051.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Avoid: discard a Defense event from your hand",
        { tag: AVOID, when: handHas(DEFENSE_EVENT) },
        discardFromHand(1, you, { filter: DEFENSE_EVENT }),
      ),
      option(
        "Disarm: discard 1 identity-specific card from your hand, then deal 2 damage to an enemy",
        // The gate guarantees a matching card, so the discard always happens and the "then" part follows it; with no
        // enemy to target it does nothing and does not bar the option (RRG 1.8 "Choose (Option)", p. 12).
        { tag: DISARM, when: handHas(IDENTITY_SPECIFIC) },
        discardFromHand(1, you, { filter: IDENTITY_SPECIFIC }),
        chooseTarget("foe", query("enemy"), { chooser: firstPlayer }),
        dealDamage(2, chosen("foe")),
      ),
      option(
        "Trip: deal 2 damage to your identity and stun it",
        { tag: TRIP },
        dealDamage(2, yourIdentity),
        stun(yourIdentity),
      ),
    ),
  ),

  "65052.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Avoid: discard an ally from your hand",
        { tag: AVOID, when: handHas(ALLY) },
        discardFromHand(1, you, { filter: ALLY }),
      ),
      option(
        "Disarm: discard an ally you control, then draw 2 cards",
        { tag: DISARM, when: exists(OWN_ALLY) },
        chooseTarget("ally", OWN_ALLY, { chooser: firstPlayer }),
        discard(chosen("ally")),
        draw(2),
      ),
      option(
        "Trip: deal 3 damage to your identity, discard the top 3 cards of your deck",
        { tag: TRIP },
        dealDamage(3, yourIdentity),
        moveCards(topOfDeck(3), "discard"),
      ),
    ),
  ),

  "65053.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Avoid: discard an upgrade from your hand",
        { tag: AVOID, when: handHas(UPGRADE) },
        discardFromHand(1, you, { filter: UPGRADE }),
      ),
      option(
        "Disarm: discard an upgrade you control, then remove 4 threat from the main scheme",
        { tag: DISARM, when: exists(OWN_UPGRADE) },
        chooseTarget("upgrade", OWN_UPGRADE, { chooser: firstPlayer }),
        discard(chosen("upgrade")),
        removeThreat(4, theMainScheme),
      ),
      option(
        "Trip: discard 1 card from your hand, discard the top 8 cards of your deck",
        { tag: TRIP },
        discardFromHand(1),
        moveCards(topOfDeck(8), "discard"),
      ),
    ),
  ),

  "65054.when-revealed": whenRevealed(
    chooseOne(
      option("Avoid: spend [energy][energy] resources", { tag: AVOID }, spendResources({ energy: 2 }, "avoid")),
      option(
        "Disarm: spend [mental][mental][physical] resources, then deal 3 damage to the villain",
        { tag: DISARM },
        spendResources({ mental: 2, physical: 1 }, "disarm"),
        ifThen(made("disarm"), [dealDamage(3, theVillain)]),
      ),
      option(
        "Trip: deal 3 damage to your identity and exhaust it",
        { tag: TRIP },
        dealDamage(3, yourIdentity),
        exhaust(yourIdentity),
      ),
    ),
  ),

  "65055.when-revealed": whenRevealed(
    chooseOne(
      option("Avoid: spend [mental][mental] resources", { tag: AVOID }, spendResources({ mental: 2 }, "avoid")),
      option(
        "Disarm: spend [energy][physical][physical] resources, then search the top 4 cards of your deck for a card and add it to your hand",
        { tag: DISARM },
        spendResources({ energy: 1, physical: 2 }, "disarm"),
        ifThen(made("disarm"), [
          chooseCards("found", zone("deck", you, { top: 4 }), { min: 1, max: 1 }),
          moveCards(cards(chosen("found")), "hand"),
          shuffleDeck(),
        ]),
      ),
      option(
        "Trip: discard cards from the top of the encounter deck until a minion is discarded, then reveal it",
        { tag: TRIP },
        discardEncounterUntil(query("minion"), "minion"),
        revealCard(chosen("minion")),
      ),
    ),
  ),

  "65056.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Avoid: discard an Attack event from your hand",
        { tag: AVOID, when: handHas(ATTACK_EVENT) },
        discardFromHand(1, you, { filter: ATTACK_EVENT }),
      ),
      option(
        "Disarm: discard a support you control, then remove 3 threat from a scheme",
        { tag: DISARM, when: exists(OWN_SUPPORT) },
        chooseTarget("support", OWN_SUPPORT, { chooser: firstPlayer }),
        discard(chosen("support")),
        chooseTarget("scheme", query("scheme"), { chooser: firstPlayer }),
        removeThreat(3, chosen("scheme")),
      ),
      option(
        "Trip: discard cards from the top of the encounter deck until a side scheme is discarded, then reveal it",
        { tag: TRIP },
        discardEncounterUntil(query("sideScheme"), "scheme"),
        revealCard(chosen("scheme")),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_DEADLY_CONTRAPTIONS_SKIPPED: Readonly<Record<string, string>> = {};
