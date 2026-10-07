import type { AbilityRegistry } from "@mc/engine";
import {
  anEnemy,
  aScheme,
  anAttackableEnemy,
  attack,
  cancelWhenRevealed,
  cards,
  chooseCards,
  chosen,
  confuse,
  countOf,
  dealDamage,
  defineAbilities,
  draw,
  each,
  eventSource,
  eventTarget,
  hasStatus,
  heroAction,
  heroInterrupt,
  heroResponse,
  ifThen,
  maxOnePerTriggeringInstance,
  modifyAttack,
  moveCards,
  on,
  preventDamage,
  query,
  ready,
  removeThreat,
  scaled,
  stun,
  thwart,
  titled,
  valueAtLeast,
  you,
  zone,
  YOUR_IDENTITY,
} from "../../dsl/index.js";
import { MSM_PACK_CARDS } from "../../wave1/msm/pack-cards.js";

/** "Psi-Knife you control" / "Psi-Katana you control": the blade's showing face (a flipped one is the other name). */
const KNIVES = countOf(query("upgrade", { name: "Psi-Knife", controller: "you" }));
const KATANAS = countOf(query("upgrade", { name: "Psi-Katana", controller: "you" }));

/**
 * Each "for each Psi-Knife / Psi-Katana you control, choose an enemy and ..." clause: the player has two blades at most,
 * so iteration `n` (1 or 2) runs when the count is at least `n`. The count is read as the clause resolves, and each
 * iteration is a separate choose (the same target may be chosen twice; RRG "For Each", p. 20).
 */
const perBlade = (count: typeof KNIVES, slot: string, effectsFor: (slot: string) => Parameters<typeof ifThen>[1]) =>
  [1, 2].map((n) => ifThen(valueAtLeast(count, n), effectsFor(`${slot}${n}`)));

/**
 * Psylocke's hero events and her pack's aspect and basic events (41004-41007, 41014, 41015, 41019, 41020),
 * docs/phase7-wave7.md §7.2, §3.69.
 *
 * - **Flurry of Blades (41004), Hero Action (attack)**: the attack is the printed 2 damage; each Knife then confuses a
 *   chosen enemy and each Katana deals a chosen enemy 2 damage (not an attack: only the first sentence is).
 * - **Mental Detection (41005), Hero Action (thwart)**: one thwart of 1 plus 2 per Knife ("additional" is part of the
 *   same thwart, RRG "Additional", p. 2); each Katana draws 1 card.
 * - **Psionic Redirect (41006), Hero Interrupt (defense)**: prevent 2, plus 2 per Katana; with a Knife, confuse the
 *   attacking enemy (a second Knife confuses an already confused enemy: no change).
 * - **Telepathic Suggestion (41007), Hero Interrupt**: cancel the revealed card's When Revealed, then per Katana 2
 *   damage to a chosen enemy and per Knife 1 threat off a chosen scheme.
 * - **Concussive Blow (41014)**: verbatim reprint of 05031, aliased.
 * - **Upside the Head (41015), Hero Response**: after her basic attack damages an enemy, stun it if it was confused,
 *   else confuse it (the status is read before it is given).
 * - **Directed Force (41019), Hero Interrupt**: 2 additional damage on her attack with overkill, piercing or ranged;
 *   one per attack across all copies (spec §3.69). Her Psi-Katana's piercing on a basic attack counts.
 * - **Soaring Hearts (41020), Hero Action**: Team-Up (Angel and Psylocke) is card data, so the engine refuses a play
 *   without both in play (Archangel is not "Angel", Q37). Identity-specific event from the discard pile to hand
 *   (optional pick, as Mutant Education), then ready Angel and Psylocke wherever they are.
 */
export const PSYLOCKE_EVENTS: AbilityRegistry = defineAbilities({
  "41004.flurry-of-blades-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    attack(2, chosen("enemy")),
    ...perBlade(KNIVES, "knife", (slot) => [anEnemy(slot), confuse(chosen(slot))]),
    ...perBlade(KATANAS, "katana", (slot) => [anEnemy(slot), dealDamage(2, chosen(slot))]),
  ),

  "41005.mental-detection-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(scaled(KNIVES, { times: 2, plus: 1 }), chosen("scheme")),
    draw(KATANAS),
  ),

  "41006.psionic-redirect-interrupt": heroInterrupt(
    on.damage(YOUR_IDENTITY, { fromAttack: true }),
    { label: "defense" },
    preventDamage(scaled(KATANAS, { times: 2, plus: 2 })),
    ifThen(valueAtLeast(KNIVES, 1), confuse(eventSource)),
  ),

  "41007.telepathic-suggestion-interrupt": heroInterrupt(
    // "When you reveal": the interrupt twin of `youRevealEncounterCard`, for the cards dealt to her (not another player's).
    { ...on.encounterCardRevealed(), playerIs: "controller" },
    cancelWhenRevealed(),
    ...perBlade(KATANAS, "katana", (slot) => [anEnemy(slot), dealDamage(2, chosen(slot))]),
    ...perBlade(KNIVES, "knife", (slot) => [aScheme(slot), removeThreat(1, chosen(slot))]),
  ),

  "41014.concussive-blow-action": MSM_PACK_CARDS["05031.concussive-blow-action"]!,

  "41015.upside-the-head-response": heroResponse(
    on.attacks(YOUR_IDENTITY, { basic: true, damages: true }),
    ifThen(hasStatus(eventTarget, "confused"), stun(eventTarget), confuse(eventTarget)),
  ),

  "41019.directed-force-interrupt": {
    ...heroInterrupt(
      on.attacks(YOUR_IDENTITY, { has: ["overkill", "piercing", "ranged"] }),
      modifyAttack({ extraDamage: 2 }),
    ),
    limit: maxOnePerTriggeringInstance,
  },

  "41020.soaring-hearts-action": heroAction(
    chooseCards("found", zone("discard", you, { filter: query("event", { identitySetOf: you }) }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    ready(each(titled("Angel", "Psylocke"))),
  ),
});
