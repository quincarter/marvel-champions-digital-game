import { trait } from "@mc/content";
import type { AbilityCost, AbilityDefinition, AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  alterEgoAction,
  andThen,
  anEnemy,
  anAttackableEnemy,
  anyOf,
  attack,
  cancelIt,
  cancelRevealedCard,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  damageAnEnemy,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discard,
  discardFromHandCost,
  discardThis,
  draw,
  each,
  exhaustThis,
  eventPlayer,
  gets,
  heal,
  heroAction,
  host,
  ifThen,
  interrupt,
  modifyStat,
  moveCards,
  on,
  option,
  playOnlyIf,
  printedHpOf,
  product,
  query,
  ready,
  remainingHpOf,
  removeCounter,
  removeThreatFromAScheme,
  resource,
  response,
  revealEncounterCard,
  self,
  shuffleDeck,
  sum,
  takeDamageCost,
  topOfDeck,
  totalPrintedResources,
  valueAtLeast,
  valueAtMost,
  when,
  YOUR_IDENTITY,
  youHaveTrait,
  yourIdentity,
  zone,
  you,
} from "../../dsl/index.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";

const X_MEN = trait("X-MEN");
const X_FORCE = trait("X-FORCE");
const ATTACK_EVENT = query("event", { trait: trait("ATTACK") });
/** "Your sidekick": the ally carrying your Sidekick upgrade (docs/phase7-wave8.md section 3.53). */
const SIDEKICK = each(query("ally", { hasAttachment: query("upgrade", { name: "Sidekick" }), controller: "you" }));
const MILLED = { kind: "slot", slot: "milled" } as const;

/** The existing script of a card this one reprints, found by its ability id (docs/phase7-wave8.md section 3.81). */
function reprintOf(id: string): AbilityDefinition {
  const definition = WAVE7_ABILITIES[id];
  if (!definition) throw new Error(`reprint source ${id} is not scripted`);
  return definition;
}

/** "(...) a [type] printed resource: [action]" for Legion: one line per type the discarded card prints. */
const printsOnMilled = (type: "energy" | "mental" | "physical") =>
  valueAtLeast(totalPrintedResources(MILLED, [type]), 1);

/**
 * Age of Apocalypse pack aspect and basic player cards, docs/phase7-wave8.md section 7.1, 3.52 to 3.60.
 *
 * Cards (26):
 * - 45011 Cable (ally)
 * - 45012 X-23 (ally)
 * - 45013 Team Training (support)
 * - 45014 Advanced Suit (upgrade)
 * - 45015 Sidekick (upgrade)
 * - 45016 Side-by-Side (event)
 * - 45017 Suit Up (event)
 * - 45018 Lead from the Front (event)
 * - 45019 The Power of Leadership (resource)
 * - 45020 Legion (ally)
 * - 45021 Marrow (ally)
 * - 45022 Energy (resource)
 * - 45023 Genius (resource)
 * - 45024 Strength (resource)
 * - 45041 Goldballs (ally)
 * - 45042 Tempus (ally)
 * - 45043 Blood Rage (upgrade)
 * - 45044 Test the Defense (upgrade)
 * - 45045 Full-Body Charge (event)
 * - 45046 Clobber (event)
 * - 45047 The Power of Aggression (resource)
 * - 45048 Triage (ally)
 * - 45049 Stepford Cuckoos (support)
 * - 45050 Bloodgem (upgrade)
 * - 45051 Basic Spell (event)
 * - 45052 Spiritual Meditation (event)
 *
 * **Reprints, one script under two ids**: Team Training 45013 is `ncrawler`-era Core-cycle 04016's, Lead from the Front
 * 45018 is 01070's, The Power of Leadership 45019 is 01072's, Clobber 45046 is 18012's, The Power of Aggression 45047 is
 * 01055's and Spiritual Meditation 45052 is 15019's. Energy, Genius and Strength (45022 to 45024) print no ability.
 *
 * **Advanced Suit (45014)**, **Side-by-Side (45016)**, **Suit Up (45017)** and **Goldballs (45041)** are NOT registered; see
 * `AOA_ASPECT_BASIC_SKIPPED` and `AOA_ASPECT_BASIC_DRAFTS`.
 *
 * **Cable (45011)**, **X-23 (45012)**: the source is the ally herself or himself. Cable answers the side scheme his own
 * thwart defeats (an event that removes the last threat is not his); X-23 answers an attack of her own that defeats
 * the enemy.
 *
 * **Advanced Suit (45014)** is NOT registered (see `AOA_ASPECT_BASIC_SKIPPED`); its draft: "attached ally defeats" is the ally as the source of the defeat (an attack or a thwart),
 * and the heal counts the printed resource icons on the discarded card, a wild counted once (RRG 1.8 "Wild Resource",
 * p. 48 and "Printed", p. 35; docs/phase7-wave8.md section 3.52).
 *
 * **Sidekick (45015)**: the host qualification (an identity-specific ally you control) is card data, read by the
 * attach-host resolver of docs/phase7-wave8.md section 3.53; "your sidekick" is not state, it is the upgrade's
 * presence. The two abilities are the +2 hit points and the heal after the controller's basic recovery.
 *
 * **Legion (45020)**: one line per type the discarded card prints, in the printed order; a wild resolves none, two
 * icons of one type resolve that line once.
 *
 * **Marrow (45021)**: "Play only if you have the X-FORCE or X-MEN trait" is `playOnlyIf` over the identity.
 *
 * **Tempus (45042)**: a "would scheme" interrupt that cancels the activation, then deals her controller 1 facedown
 * encounter card. Her "X-MEN identity only" line is card data (`playRestrictions`).
 *
 * **Blood Rage (45043)**: "defeat with a basic attack" is the identity's basic attack that defeated its target.
 *
 * **Full-Body Charge (45045)** and **Clobber (45046)**, **Basic Spell (45051)**: Full-Body Charge is an "(attack)"
 * ability whose identity makes one `attack()` (Q47); the overkill is a branch on the hero's remaining hit points
 * (the printed hit points halved, so twice the remaining is at most one less than the printed value).
 *
 * **Stepford Cuckoos (45049)**: any player's treachery. The treachery is canceled and discarded, then the revealing
 * player reveals another encounter card. "Uses (3 psi counters)" is card data.
 *
 * **Bloodgem (45050)**: the 2 damage is a cost (unpaid if any of it is prevented, RRG 1.8 "Cost", p. 14).
 */
export const AOA_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "45011.cable-response": response({ ...on.schemeDefeated(query("sideScheme")), sourceIs: { self: true } }, draw(1)),

  "45012.x-23-response": response(on.attacks("self", { defeats: true }), ready(self)),

  "45013.team-training-constant": reprintOf("04016.team-training-constant"),

  "45015.sidekick-constant": constant(gets("hp", 2, { hostOfSelf: true })),
  "45015.sidekick-response": response(on.basicRecovery(YOUR_IDENTITY), heal(2, host)),

  "45018.lead-from-the-front-action": reprintOf("01070.lead-from-the-front-action"),
  "45019.the-power-of-leadership-constant": reprintOf("01072.the-power-of-leadership-constant"),

  "45020.legion-response": response(
    on.basicPowerUsed("self"),
    moveCards(topOfDeck(1), "discard", "milled"),
    ifThen(printsOnMilled("energy"), [anEnemy(), dealDamage(2, chosen("enemy"))]),
    ifThen(printsOnMilled("mental"), removeThreatFromAScheme(2)),
    ifThen(printsOnMilled("physical"), heal(2, self)),
  ),

  "45021.marrow-constant": constant(playOnlyIf(anyOf(youHaveTrait(X_FORCE), youHaveTrait(X_MEN)))),
  "45021.marrow-response": response(on.entersPlay("self"), damageAnEnemy(2)),

  "45042.tempus-interrupt": interrupt(
    when.enemySchemes(query("villain")),
    { would: true, cost: discardThis },
    cancelIt(),
    dealEncounterCard(you),
  ),

  "45043.blood-rage-response": response(
    on.attacks(YOUR_IDENTITY, { basic: true, defeats: true }),
    { cost: [exhaustThis, takeDamageCost(1)] },
    draw(1),
  ),

  "45044.test-the-defense-response": response(
    on.youPlayedCard(ATTACK_EVENT),
    addCounters("test", 1),
    ifThen(valueAtLeast(countersOn(self, "test"), 5), [
      anEnemy(),
      discard(self),
      andThen(dealDamage(5, chosen("enemy"))),
    ]),
  ),

  "45045.full-body-charge-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    ifThen(
      // "Less than half": twice the remaining hit points is at most the printed hit points less 1.
      valueAtMost(product(remainingHpOf(yourIdentity), 2), sum(printedHpOf(yourIdentity), -1)),
      attack(8, chosen("enemy"), { overkill: true }),
      attack(8, chosen("enemy")),
    ),
  ),

  "45046.clobber-action": reprintOf("18012.clobber-action"),
  "45047.the-power-of-aggression-constant": reprintOf("01055.the-power-of-aggression-constant"),

  "45048.triage-response": response(
    on.entersPlay("self"),
    chooseTarget("friend", query("character", { trait: X_MEN })),
    heal(2, chosen("friend")),
  ),

  "45049.stepford-cuckoos-interrupt": interrupt(
    when.encounterCardRevealed(query("treachery")),
    { cost: [exhaustThis, removeCounter("psi")] },
    cancelRevealedCard(),
    andThen(revealEncounterCard(eventPlayer)),
  ),

  "45050.bloodgem-resource": resource({ wild: 1 }, { cost: [exhaustThis, takeDamageCost(2)] }),

  "45051.basic-spell-action": heroAction(
    chooseOne(
      option(
        "Heal 3 damage from an identity",
        chooseTarget("identity", query("identity")),
        heal(3, chosen("identity")),
      ),
      option("Remove 3 threat from a scheme", removeThreatFromAScheme(3)),
      option("Deal 3 damage to an enemy", damageAnEnemy(3)),
    ),
  ),

  "45052.spiritual-meditation-action": reprintOf("15019.spiritual-meditation-action"),
});

/**
 * The skipped refs written out as close to printed as the DSL allows, NOT registered (the registry above must not
 * hold them). Each draft is wrong in the way its `AOA_ASPECT_BASIC_SKIPPED` reason says; register one unchanged once
 * the engine can run it.
 */
export const AOA_ASPECT_BASIC_DRAFTS: AbilityRegistry = {
  // Advanced Suit: written as printed; the hand-discard cost keeps a Response from ever being offered (see the reason).
  "45014.advanced-suit-response": response(
    { ...on.defeats(query("ally", { hostOfSelf: true })), targetIs: query(["minion", "sideScheme"]) },
    { cost: discardFromHandCost(1, 1) },
    heal(totalPrintedResources(chosen("discard")), host),
  ),

  // Goldballs: the cost has a chosen size, which `AbilityCost.discardFromDeck` cannot say (docs/phase7-wave8.md 3.55).
  "45041.goldballs-interrupt": interrupt(
    on.attacks("self"),
    { cost: { discardFromDeck: { choose: { min: 1, max: 3 } } } as unknown as AbilityCost },
    // "+X ATK for this attack": X would be the count the cost bound; not expressible without the built cost.
  ),

  // Side-by-Side: the ready is a cost (3.54), written here as the first effect, which lets a ready sidekick pay it.
  "45016.side-by-side-action": heroAction(
    ready(SIDEKICK),
    ready(yourIdentity),
    chooseOne(
      option("Heal 1 damage from both characters", heal(1, yourIdentity), heal(1, SIDEKICK)),
      option(
        "Both characters get +1 THW and +1 ATK until the end of the phase",
        modifyStat("thw", 1, yourIdentity, "endOfPhase"),
        modifyStat("atk", 1, yourIdentity, "endOfPhase"),
        modifyStat("thw", 1, SIDEKICK, "endOfPhase"),
        modifyStat("atk", 1, SIDEKICK, "endOfPhase"),
      ),
    ),
  ),

  // Suit Up: "an upgrade that can be attached to an ally" has no query (3.59); every upgrade is offered here.
  "45017.suit-up-action": alterEgoAction(
    chooseCards("ally", zone(["deck", "discard"], you, { filter: query("ally") }), { min: 0, max: 1 }),
    chooseCards("upgrade", zone(["deck", "discard"], you, { filter: query("upgrade") }), { min: 0, max: 1 }),
    moveCards(cards(chosen("ally")), "hand"),
    moveCards(cards(chosen("upgrade")), "hand"),
    shuffleDeck(),
  ),
};

/** Refs left unregistered, each with its reason. */
export const AOA_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "45014.advanced-suit-response":
    "a Response with a 'discard 1 card from your hand' cost is never offered: the trigger window's payability check (resolve/triggers.ts costPayable) plans the cost with only the default picks of cards in play and none for a hand discard, so planCost refuses it; the same response without the cost is offered. The pattern, the heal per printed icon and the host source are right",
  "45016.side-by-side-action":
    "section 3.54: 'Ready your sidekick' is the cost, and AbilityCost has no readyCards (exhausted cards only, Q29 = A); as an effect a ready sidekick would pay it, and the ready would be skipped by a cost the rules require paid in full",
  "45017.suit-up-action":
    "section 3.59: 'an upgrade that can be attached to an ally' (erratum) needs TargetQuery.canAttachToCategory, which is not built; offering every upgrade would let a hero-only or identity upgrade be found",
  "45041.goldballs-interrupt":
    "section 3.55: 'discard up to 3 cards from the top of your deck' is a cost of a size the player chooses (1 to 3) whose count is X for the ATK bonus; AbilityCost.discardFromDeck takes only a fixed number or a value, never a choice",
};
