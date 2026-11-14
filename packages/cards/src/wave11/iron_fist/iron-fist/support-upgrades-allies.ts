import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  aScheme,
  action,
  chosen,
  constant,
  countersOn,
  defineAbilities,
  draw,
  exhaustThis,
  gainsKeywordX,
  heroAction,
  heroResource,
  isHero,
  modifyAttack,
  moveCounters,
  putIntoPlay,
  query,
  ready,
  removeCounter,
  selectCards,
  self,
  thwart,
  attackInProgress,
  ifElse,
  on,
  heroInterrupt,
  yourIdentity,
  zone,
  you,
} from "../../../dsl/index.js";
import { CHI } from "./chi.js";

const TECHNIQUE = trait("TECHNIQUE");
/** "From your identity": works in either form (RRG 1.8 p. 23). */
const chiFromIdentity = (n: number) => removeCounter(CHI, n, { fromIdentity: true });

/**
 * Wave 11 scripting module `iron_fist/iron-fist/support-upgrades-allies` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (7):
 * - 64006 Lei Kung (support)
 * - 64007 Book of the Iron Fist (upgrade)
 * - 64008 Channel the Iron Fist (upgrade, Technique, temporary)
 * - 64009 Embody the Dragon (upgrade, Technique, temporary)
 * - 64010 Feel the Flow (upgrade, Technique, temporary)
 * - 64011 Keep 'Em Coming (upgrade, Technique, temporary)
 * - 64012 Redirect Chi (upgrade, Technique, temporary)
 *
 * Costs that name "Iron Fist" are hero-face abilities (heroAction / heroInterrupt / heroResource), so the face-up
 * hero form is implied (RRG 1.8 p. 23); Lei Kung's "your identity" works in either form. Temporary (RRG 1.8 p. 44) is
 * the printed keyword in the card data. Counters spent or moved are never "placed", so none of this gives chi to
 * Lack of Chi's redirect, and Book of the Iron Fist puts a Technique into play, which is not playing it (RRG 1.8
 * "Play, Put into Play", p. 32), so it gives no chi either.
 *
 * **64007**: only the top card of the discard pile counts ("if the top card ... is a Technique").
 * **64008**: +1 damage, +2 instead if the attack is a basic attack.
 * **64009**: retaliate X, X = chi counters on this card, while Iron Fist is in hero form.
 */
export const IRON_FIST_IRON_FIST_SUPPORT_UPGRADES_ALLIES: AbilityRegistry = defineAbilities({
  "64006.lei-kung-action": action({ cost: [exhaustThis, chiFromIdentity(1)] }, draw(1)),

  "64007.book-of-the-iron-fist-action": heroAction(
    { cost: exhaustThis },
    selectCards("top", zone("discard", you, { top: 1, filter: query([], { trait: TECHNIQUE }) })),
    putIntoPlay(chosen("top")),
  ),

  "64008.channel-the-iron-fist-interrupt": heroInterrupt(
    on.attacks(query("identity", { controller: "you" })),
    { cost: chiFromIdentity(1) },
    modifyAttack({
      extraDamage: ifElse(attackInProgress({ attacker: query("identity", { controller: "you" }), basic: true }), 2, 1),
    }),
  ),

  "64009.embody-the-dragon-constant": constant(
    gainsKeywordX("retaliate", countersOn(self, CHI), query("identity", { controller: "you" }), { while: isHero() }),
  ),
  "64009.embody-the-dragon-action": heroAction(moveCounters(yourIdentity, self, CHI, 1)),

  "64010.feel-the-flow-action": heroAction(
    { label: "thwart", cost: chiFromIdentity(1) },
    aScheme("scheme"),
    thwart(1, chosen("scheme")),
  ),

  "64011.keep-em-coming-action": heroAction({ cost: chiFromIdentity(2) }, ready(yourIdentity)),

  "64012.redirect-chi-resource": heroResource({ wild: 2 }, { cost: chiFromIdentity(2) }),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const IRON_FIST_IRON_FIST_SUPPORT_UPGRADES_ALLIES_SKIPPED: Readonly<Record<string, string>> = {};
