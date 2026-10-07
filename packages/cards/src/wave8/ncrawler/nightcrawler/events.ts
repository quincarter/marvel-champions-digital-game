import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  aScheme,
  anAttackableEnemy,
  anEnemy,
  attack,
  attackingEnemy,
  cards,
  changeForm,
  chooseCards,
  chosen,
  dealDamage,
  defineAbilities,
  discard,
  discardFromHandCost,
  each,
  eventSource,
  exists,
  heroAction,
  heroResponse,
  ifThen,
  moveCards,
  on,
  query,
  ready,
  stun,
  varAtLeast,
  thwart,
  you,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";
import { BAMF_MOMENT } from "./support-upgrades-allies.js";

/** "a copy of Bamf!": the upgrade by printed name (48006, three copies in his deck). */
const BAMF = query("upgrade", { name: "Bamf!" });

/**
 * Nightcrawler signature events (docs/phase7-wave8.md section 7.4, 3.72, 3.39).
 *
 * Cards (5):
 * - 48007 'Port and Punch (event)
 * - 48008 Teleport Drop (event)
 * - 48009 Scout Ahead (event)
 * - 48010 'Port Away (event)
 * - 48011 Tally Ho! (event)
 *
 * **'Port and Punch (48007)**, Hero Action (attack): an attack of 3 on an enemy he may attack, then 3 damage to each
 * enemy with a copy of Bamf! attached (Star-Lord's Ricochet Shot is the same shape: the attack, then damage to others).
 * An enemy with a copy that is also the target takes both. The second part is plain damage, not an attack.
 *
 * **Scout Ahead (48009)**, Hero Action (thwart): remove 3 threat from a scheme; then, if another scheme is in play, he
 * may discard a copy of Bamf! from his hand (a choice of at least 0 cards, so declining is allowed) and, only if one
 * was discarded, remove 3 threat from another scheme. With one scheme in play the copy is not asked for.
 *
 * **'Port Away (48010)**, Action (either form): discard a copy of Bamf! from hand (a cost) to change forms and ready
 * his identity. Changing form by an effect does not use the round's one voluntary change.
 *
 * **Tally Ho! (48011)**, Hero Response (defense) to the moment "bamf" (raised by Bamf!'s ability with the discarded
 * copy as its source and its controller as the player): that copy goes from the discard pile to hand, then 3 damage to
 * the attacking enemy. The damage is not an attack.
 *
 * **Teleport Drop (48008) is skipped.** "Discard a copy of Bamf! from an enemy -> deal 8 damage to that enemy" needs
 * the enemy the cost's copy was attached to, and no reference to the host of a cost pick exists (`discardCardsCost`
 * binds the card only, and it is unattached once paid). The only way to write it is to choose the enemy first and
 * discard its copy as an effect, which changes when the copy is lost (not a cost). See `NIGHTCRAWLER_EVENTS_SKIPPED`.
 */
export const NIGHTCRAWLER_EVENTS: AbilityRegistry = defineAbilities({
  "48007.port-and-punch-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(3, chosen("enemy")),
    dealDamage(3, each(query("enemy", { hasAttachment: BAMF }))),
  ),

  "48009.scout-ahead-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(3, chosen("scheme")),
    ifThen(exists(query("scheme", { excluding: chosen("scheme") })), [
      chooseCards("copy", zone("hand", you, { filter: BAMF }), { min: 0, max: 1 }),
      moveCards(cards(chosen("copy")), "discard", "discarded"),
      ifThen(varAtLeast("discarded.count", 1), [
        aScheme("other", { excluding: chosen("scheme") }),
        thwart(3, chosen("other")),
      ]),
    ]),
  ),

  "48010.port-away-action": action(
    { cost: discardFromHandCost(1, 1, undefined, BAMF) },
    changeForm(),
    ready(yourIdentity),
  ),

  "48011.tally-ho-response": heroResponse(
    on.moment(BAMF_MOMENT),
    { label: "defense" },
    moveCards(cards(eventSource), "hand"),
    dealDamage(3, attackingEnemy),
  ),
});

/**
 * Teleport Drop (48008) as nearly as the DSL can write it, NOT registered: the enemy is chosen first and the copy is
 * discarded by an effect. As printed the discard is the cost, so it is paid (and the copy lost) before the attack
 * resolves and cannot be undone by anything that stops the attack. This draft shows the rest of the card working.
 */
export const NIGHTCRAWLER_EVENTS_DRAFTS: AbilityRegistry = defineAbilities({
  "48008.teleport-drop-action": heroAction(
    { label: "attack" },
    chooseTargetWithBamf(),
    discard({ kind: "attachmentsOf", of: chosen("enemy"), filter: BAMF }),
    attack(8, chosen("enemy")),
    stun(chosen("enemy")),
  ),
});

function chooseTargetWithBamf() {
  return anEnemy("enemy", { attackableBy: yourIdentity, hasAttachment: BAMF });
}

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const NIGHTCRAWLER_EVENTS_SKIPPED: Readonly<Record<string, string>> = {
  "48008.teleport-drop-action":
    "section 3.72: the cost 'discard a copy of Bamf! from an enemy' leaves no way to name that enemy for the effects (no host-of-cost-pick reference; discardCardsCost binds the card only); an effect-side discard would change cost into effect",
};
