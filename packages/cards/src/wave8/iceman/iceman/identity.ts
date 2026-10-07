import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec, TargetRef } from "@mc/engine";
import {
  attachCard,
  basicPowerIs,
  chooseCards,
  chosen,
  countOf,
  coveredByEngineRule,
  defineAbilities,
  eventTarget,
  attackingEnemy,
  ifThen,
  interrupt,
  moveCards,
  cards,
  on,
  oneCopyOf,
  query,
  raiseMoment,
  response,
  selectCards,
  setAside,
  valueAtLeast,
  varOf,
  you,
  zone,
  YOUR_IDENTITY,
} from "../../../dsl/index.js";

const FROSTBITE = query("upgrade", { name: "Frostbite" });
const ICE = trait("ICE");
/** The name Iceman's "Freeze!" raises once a copy is attached (docs/phase7-wave8.md section 3.39, 3.61). */
export const FREEZE_MOMENT = "freeze";

/** "Attach a set-aside copy of Frostbite to [enemy]", then the moment other cards answer. Nothing set aside: nothing. */
const freeze = (enemy: TargetRef): readonly EffectSpec[] => [
  selectCards("frostbite", oneCopyOf(setAside(you, FROSTBITE))),
  ifThen(valueAtLeast(varOf("frostbite.count"), 1), [
    attachCard(chosen("frostbite"), enemy),
    raiseMoment(FREEZE_MOMENT),
  ]),
];

/** One "shuffle 1 ICE card from your discard pile into your deck" per Frostbite in play, up to the six that exist. */
const coolOffStep = (n: number): EffectSpec =>
  ifThen(valueAtLeast(countOf(FROSTBITE), n), [
    chooseCards(`ice${n}`, zone("discard", you, { filter: { trait: ICE } }), { min: 1, max: 1 }),
    moveCards(cards(chosen(`ice${n}`)), "deckShuffle"),
  ]);

/**
 * Iceman / Bobby Drake (46001a/b): docs/phase7-wave8.md section 7.2, 3.61, 3.39, 4.1 Q35.
 *
 * Cards (1):
 * - 46001a Iceman (hero_identity)
 *
 * **"Freeze!" (46001a)** is an Interrupt. A raised moment opens a response window only (never an interrupt window),
 * so the Interrupt itself hangs off the two events it names: his basic attack (the `attack` event, basic, against an
 * enemy; the enemy is the event's target) and his basic defense (his basic DEF use, inside the enemy attack; the
 * enemy is the attacker). It attaches one set-aside copy of Frostbite to that enemy, before the attack's ATK or the
 * attack's damage is read, and then raises the moment "freeze" for Cryokinetic Perception (46005) to answer as a
 * response. Nothing set aside: nothing is attached, no moment is raised and the attack or defense resolves. An attack
 * by an event or an ally, or a "(defense)" ability, is not a basic power of his and does not trigger it. Whether the
 * copy is set aside again when the activation ends (Q35 = A) is Frostbite's own Forced Response (46002).
 *
 * **Bobby Drake begins the game with 6 Frostbite set aside (46001b)** is the permanent keyword's setup rule (wave 6
 * section 3.74): the six copies are listed in the deck, set aside before step 1 and never drawn. No effect of its own.
 *
 * **Cool Off (46001b)**, Response: after he changes to this form, shuffle 1 ICE card from the discard pile into the
 * deck per copy of Frostbite in play (attached to an enemy). The cards are chosen one per copy; with fewer ICE cards
 * than copies the rest is skipped. Each card is shuffled into the deck.
 */
export const ICEMAN_IDENTITY: AbilityRegistry = defineAbilities({
  "46001a.freeze": interrupt(
    on.either(
      on.attacks(YOUR_IDENTITY, { basic: true, target: query("enemy") }),
      on.basicPowerUsing(YOUR_IDENTITY, { power: "defense" }),
    ),
    ifThen(basicPowerIs("defense"), freeze(attackingEnemy), freeze(eventTarget)),
  ),

  "46001b.bobby-drake-constant": coveredByEngineRule(),

  "46001b.cool-off": response(on.youChangeForm(), [1, 2, 3, 4, 5, 6].map(coolOffStep)),
});
