import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  canFlip,
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  each,
  exhaustCardsCost,
  flipCard,
  heroInterrupt,
  moveCards,
  on,
  putIntoPlayFromSetAside,
  query,
  setup,
  you,
  yourIdentity,
  zone,
  YOUR_IDENTITY,
} from "../../dsl/index.js";

const PSI_ENERGY = trait("PSI-ENERGY");
const PSIONIC = trait("PSIONIC");

/** "PSI-ENERGY upgrade": a Psi-Knife / Psi-Katana (either face; both print the trait) you control. */
const YOUR_PSI_ENERGY = query("upgrade", { trait: PSI_ENERGY, controller: "you" });
/** One of them to flip: not a blade a "cannot flip" names (Body Swapped's Psi-Katanas). */
const FLIPPABLE_PSI_ENERGY = query("upgrade", { trait: PSI_ENERGY, controller: "you", ...canFlip });

/**
 * Psylocke / Betsy Braddock (41001a/b), with her permanent Psi-Knife / Psi-Katana (41002a/b): docs/phase7-wave7.md
 * §7.2, §3.64, §4.2 Q38. The two blades' own abilities (41002) are the upgrades module's.
 *
 * - **[star] Psi-Energy Control (41001a)**, Hero Interrupt: when Psylocke uses one of her basic powers (THW, ATK or
 *   DEF), you may flip 1 PSI-ENERGY upgrade. It is the interrupt to `basicPowerUsing`, so the flip resolves before the
 *   power's value is read: Knife to Katana on a basic attack gives that attack +1 ATK and piercing. `YOUR_IDENTITY`
 *   (her basic powers, not an ally's). The star only prints on the hero face's THW, ATK and DEF; it is display.
 *   Body Swapped's "cannot flip" is read by the choice (`canFlip`): a Psi-Katana it names is no candidate, and with no
 *   blade left to flip the interrupt is not offered (RRG 1.8 "Target", p. 42).
 * - **Psionic Manifestation (41001b)**, Setup: both permanent PSI-ENERGY upgrades, set aside before setup step 1
 *   (RRG "Permanent", p. 32), go into play Psi-Knife side faceup, attached to her identity as an upgrade play would.
 * - **Betsy Braddock (41001b)**, Action: exhaust 1 PSI-ENERGY upgrade to shuffle 1 PSIONIC card from your discard
 *   pile into your deck. A card of any type with the PSIONIC trait.
 */
export const PSYLOCKE_IDENTITY: AbilityRegistry = defineAbilities({
  "41001a.star-psi-energy-control": heroInterrupt(
    on.basicPowerUsing(YOUR_IDENTITY),
    chooseCards("blade", cards(each(FLIPPABLE_PSI_ENERGY)), { min: 1, max: 1 }),
    flipCard(chosen("blade")),
  ),

  "41001b.psionic-manifestation": setup(
    putIntoPlayFromSetAside("blades", query("upgrade", { name: "Psi-Knife" }), { attachTo: yourIdentity }),
  ),

  "41001b.betsy-braddock-action": alterEgoAction(
    { cost: exhaustCardsCost(YOUR_PSI_ENERGY) },
    chooseCards("card", zone("discard", you, { filter: query([], { trait: PSIONIC }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("card")), "deckShuffle"),
  ),
});
