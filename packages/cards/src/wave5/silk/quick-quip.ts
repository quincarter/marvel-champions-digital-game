import { trait } from "@mc/content";
import { damageCardsCost, defineAbilities, divide, heroAction, query } from "../../dsl/index.js";

const WEB_WARRIOR = trait("WEB-WARRIOR");

/**
 * Quick Quip (`silk` 52034, cycle 9): `justice` aspect, generic. "Requirement ([mental]).\nHero Action: Deal 1 damage
 * to a Web-Warrior character you control → place a total of 2 confused status cards on up to 2 enemies."
 *
 * The Silk pack is not in any wave's pool yet; this one card is scripted here, in wave 5, because it is the same shape
 * as SP//dr's Thwip Thwip! (`spdr` 31017, `../spdr/events.ts`) with confused for stunned, and shares its primitives:
 * the `damageCards` cost (payable only while a Web-Warrior character you control could take all of the damage, RRG
 * 1.8 "Cost", p. 14) and a status `divide` over at most 2 enemies. A non-steady enemy takes one confused card, and
 * choosing just one of two enemies is allowed (ruling, Mar 6, 2026 (2), on this card). The Requirement keyword is
 * read from the card data by the engine. When the Silk pack is wired, this module moves under its own pack folder.
 */
export const SILK_QUICK_QUIP = defineAbilities({
  "52034.quick-quip-action": heroAction(
    { cost: damageCardsCost(query(["identity", "ally"], { trait: WEB_WARRIOR, controller: "you" }), 1) },
    divide("confused", 2, query("enemy"), { maxTargets: 2 }),
  ),
});
