import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  anyOf,
  blanksTextBox,
  cannotActivate,
  constant,
  damagedAtLeast,
  defineAbilities,
  discard,
  eventAmount,
  exhaustThis,
  forcedInterrupt,
  gainsKeyword,
  gainsTrait,
  heal,
  ifThen,
  instead,
  modifyStatOf,
  moveCards,
  on,
  placeDamage,
  query,
  ready,
  resource,
  response,
  self,
  titled,
  varAtLeast,
  when,
  you,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";
import { MAGNETIC_PULL_MOMENT } from "./identity.js";

const MAGNETIC = trait("MAGNETIC");
const AERIAL = trait("AERIAL");

/** "Magneto": the identity titled Magneto, so only his hero face (the alter-ego is Erik Lehnsherr). */
const MAGNETO = titled("Magneto");
const THE_HOST_MINION = query("minion", { hostOfSelf: true });

/**
 * Magneto's supports, upgrades and resource (docs/phase7-wave8.md section 7.5, 3.71, 3.76, 3.81; Q41, Q42).
 *
 * **Asteroid M (49002)**: Alter-Ego Action, exhaust: shuffle the topmost MAGNETIC card of the discard pile (the pile's
 * own order, newest first) into the deck and heal 1 from the identity; it heals with no card to shuffle and shuffles
 * with no damage to heal.
 *
 * **Magneto's Helmet (49003)**: steady on the hero face; a Resource ability (exhaust) generating a wild resource only
 * for a MAGNETIC card (`generatesFor`, as Power Belt).
 *
 * **Magneto's Armor (49004)**: a Response to the "resolved" Pull moment (raised only when a MAGNETIC card was found,
 * Q41 = A), offered only if the Pull discarded at least one mental, physical or energy icon (the found card included,
 * Q42 = A; a wild is none of the three, RRG p. 48). Each line is a stat bonus of +1 until the end of the round and
 * resolves at most once. The data lists three further `-constant` ids that print nothing: they are not registered
 * (`MAGNETO_SUPPORT_UPGRADES_ALLIES_SKIPPED`, card data fix 1 of section 7.5).
 *
 * **Magneto's Cape (49005)**: the AERIAL trait on the hero face; a Response to the same moment, exhausting the Cape to
 * ready Magneto (the Pull does not exhaust him, so this gives a second basic power in a round).
 *
 * **Magnetic Bubble (49006)**: retaliate 1; Crossbones' Armor shape (section 3.65 on an upgrade): damage the identity
 * would take, from any source, is placed here instead, then at 6 or more damage here it is discarded (all of the hit is
 * placed, past 6).
 *
 * **Wrapped in Metal (49007)**: "Hero form only" and "non-ELITE minion" are card data. The host cannot activate and its
 * printed text box is blank (keywords and icons of it included; traits, stats and boost icons stay).
 *
 * **Master of Magnetism (49011)** prints no text: nothing to register.
 *
 * Cards (7):
 * - 49002 Asteroid M (support)
 * - 49003 Magneto's Helmet (upgrade)
 * - 49004 Magneto's Armor (upgrade)
 * - 49005 Magneto's Cape (upgrade)
 * - 49006 Magnetic Bubble (upgrade)
 * - 49007 Wrapped in Metal (upgrade)
 * - 49011 Master of Magnetism (resource)
 */
export const MAGNETO_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "49002.asteroid-m-action": alterEgoAction(
    { cost: exhaustThis },
    moveCards(zone("discard", you, { filter: { trait: MAGNETIC }, topmostOnly: true }), "deckShuffle"),
    heal(1, yourIdentity),
  ),

  "49003.magnetos-helmet-constant": constant(gainsKeyword({ name: "steady" }, MAGNETO)),
  "49003.magnetos-helmet-resource": resource(
    { wild: 1 },
    {
      cost: exhaustThis,
      generatesFor: query(["ally", "event", "support", "upgrade", "resource"], { trait: MAGNETIC }),
    },
  ),

  "49004.magnetos-armor-response": response(
    on.moment(MAGNETIC_PULL_MOMENT),
    {
      while: anyOf(
        varAtLeast("moment.pulled.mental"),
        varAtLeast("moment.pulled.physical"),
        varAtLeast("moment.pulled.energy"),
      ),
    },
    ifThen(varAtLeast("moment.pulled.mental"), modifyStatOf("thw", 1, YOUR_IDENTITY, "endOfRound")),
    ifThen(varAtLeast("moment.pulled.physical"), modifyStatOf("atk", 1, YOUR_IDENTITY, "endOfRound")),
    ifThen(varAtLeast("moment.pulled.energy"), modifyStatOf("def", 1, YOUR_IDENTITY, "endOfRound")),
  ),

  "49005.magnetos-cape-constant": constant(gainsTrait(AERIAL, MAGNETO)),
  "49005.magnetos-cape-response": response(on.moment(MAGNETIC_PULL_MOMENT), { cost: exhaustThis }, ready(yourIdentity)),

  "49006.magnetic-bubble-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, MAGNETO)),
  "49006.magnetic-bubble-forced-interrupt": forcedInterrupt(
    when.damage(YOUR_IDENTITY),
    instead(placeDamage(eventAmount, self), ifThen(damagedAtLeast(self, 6), discard(self))),
  ),

  "49007.wrapped-in-metal-constant": constant(cannotActivate(THE_HOST_MINION), blanksTextBox(THE_HOST_MINION)),
});

/** Refs left unregistered, each with its reason. */
export const MAGNETO_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
