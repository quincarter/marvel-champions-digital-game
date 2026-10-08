import { trait } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  anyOf,
  confuse,
  dealDamage,
  defineAbilities,
  discard,
  discardFromHand,
  each,
  exists,
  find,
  forcedInterrupt,
  giveTough,
  heal,
  ifThen,
  moveCards,
  not,
  on,
  query,
  resolveSpecialsOf,
  revealCard,
  self,
  stun,
  theVillain,
  topOfDeck,
  varAtLeast,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";

const CELESTIAL = trait("CELESTIAL");
const CELESTIAL_ON_VILLAIN = query("attachment", { trait: CELESTIAL, host: theVillain });
const CELESTIAL_ATTACHMENT = query("attachment", { trait: CELESTIAL });

/**
 * The milled card's printed resource has `type`: its own icon, or [wild] ("[wild] - Do all of the above"). A card with
 * no resource icon matches none, so nothing resolves.
 */
const milled = (type: "physical" | "energy" | "mental") => anyOf(varAtLeast(`tech.${type}`), varAtLeast("tech.wild"));

/**
 * "Discard the top card of your deck": the card the encounter attachment's "you" (the player the event is about) loses
 * from the top of their own deck; its printed resource icons are read from the slot (`tech.energy` etc.).
 */
const discardTop = moveCards(topOfDeck(1), "discard", "tech");

/**
 * Celestial Tech's When Revealed (45158): "For each [Celestial] attachment in play, resolve its effect as if the
 * attached villain just schemed against you and attacked you. If there are no [Celestial] attachments on the villain,
 * search the encounter deck and discard pile for a [Celestial] attachment and reveal it. (Shuffle.)"
 *
 * NOT REGISTERED: resolving another card's Forced Interrupt "as if" its trigger just happened needs
 * `resolveSpecials.trigger: "forcedInterrupt"` (docs/phase7-wave8.md §3.28, engine queue task 30, after task 22), which
 * `EffectSpec` does not have yet. The draft below is the whole ability with the resolve step as the nearest typeable
 * form (`resolveSpecialsOf` naming the two refs, which resolves Specials, so today it does nothing to the attachments).
 * The search half is complete. Once task 30 lands, the resolve step becomes the new trigger and the draft is registered.
 */
export const CELESTIAL_TECH_WHEN_REVEALED_DRAFT: AbilityDefinition = whenRevealed(
  resolveSpecialsOf(each(CELESTIAL_ON_VILLAIN), undefined, {
    abilities: ["45156.celestial-armor-forced-interrupt", "45157.celestial-weapon-forced-interrupt"],
  }),
  ifThen(not(exists(CELESTIAL_ON_VILLAIN)), revealCard(find(CELESTIAL_ATTACHMENT))),
);

/**
 * Modular encounter set `celestial_tech` (Age of Apocalypse, docs/phase7-wave8.md §1.16, §3.28). Attachments "attach to
 * the villain" (data); the "you" of each Forced Interrupt is the player the villain's scheme or attack is against (an
 * encounter card has no controller, so the event's player stands in).
 *
 * Armor and Weapon discard the top card of the player's deck, then each line resolves once if the card prints that
 * resource, and all three for a [wild]. A card with no icon does nothing. "Discard this card" belongs to Armor's
 * [mental] line and Weapon's [physical] line, after the other effect of that line, so a [wild] discards the card and
 * still resolves the rest.
 *
 * Celestial Tech 45158 is skipped (see `CELESTIAL_TECH_WHEN_REVEALED_DRAFT`), waiting on queue task 30 (spec §8.2).
 *
 * Cards (3):
 * - 45156 Celestial Armor (attachment)
 * - 45157 Celestial Weapon (attachment)
 * - 45158 Celestial Tech (treachery)
 */
export const CELESTIAL_TECH: AbilityRegistry = defineAbilities({
  // Forced Interrupt: When the villain schemes against you, discard the top card of your deck. If that card's resource
  // has: [energy] Heal 2 damage from the villain. [mental] You are confused. Discard this card. [physical] Give the
  // villain a tough status card. [wild] Do all of the above.
  "45156.celestial-armor-forced-interrupt": forcedInterrupt(on.enemySchemes("host"), discardTop, ...armorLines()),
  // Forced Interrupt: When the villain attacks you, discard the top card of your deck. If that card's resource has:
  // [energy] Deal 2 damage to your identity. [mental] Discard a card from your hand. [physical] You are stunned.
  // Discard this card. [wild] Do all of the above.
  "45157.celestial-weapon-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("host", { againstYou: true }),
    discardTop,
    ...weaponLines(),
  ),
});

function armorLines(): EffectSpec[] {
  return [
    ifThen(milled("energy"), heal(2, theVillain)),
    ifThen(milled("mental"), confuse(yourIdentity)),
    ifThen(milled("physical"), giveTough(theVillain)),
    // "Discard this card" belongs to the [mental] line only.
    ifThen(milled("mental"), discard(self)),
  ];
}

function weaponLines(): EffectSpec[] {
  return [
    ifThen(milled("energy"), dealDamage(2, yourIdentity)),
    ifThen(milled("mental"), discardFromHand(1)),
    ifThen(milled("physical"), [stun(yourIdentity), discard(self)]),
  ];
}

export const CELESTIAL_TECH_SKIPPED: Readonly<Record<string, string>> = {
  "45158.when-revealed":
    "Resolving each Celestial attachment's Forced Interrupt 'as if' it just triggered needs resolveSpecials.trigger: 'forcedInterrupt' (spec §3.28, queue task 30, after task 22). CELESTIAL_TECH_WHEN_REVEALED_DRAFT is the nearest typeable form, unregistered.",
};
