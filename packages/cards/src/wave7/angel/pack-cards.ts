import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  andThen,
  cancelRevealedCard,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  dealDamage,
  defineAbilities,
  discardThis,
  each,
  exhaustCardsCost,
  gainsTrait,
  gets,
  heroAction,
  heroInterrupt,
  on,
  query,
  ready,
  revealEncounterCard,
  theVillain,
  you,
} from "../../dsl/index.js";

const AERIAL = trait("AERIAL");
const ELITE = trait("ELITE");
const X_FORCE = trait("X-FORCE");

/** "an AERIAL character you control" as a cost pick (an exhausted one cannot pay). */
const AERIAL_YOURS = query("character", { trait: AERIAL, controller: "you" });

/**
 * The angel pack's aspect and basic cards no hero folder owns (42029-42032), docs/phase7-wave7.md §7.2, §3.62.
 *
 * - **Bombs Away (42029)**: Hero Action. The exhaust is the cost; the player is chosen on resolution (Hawkeye's Explosive
 *   Arrow, 04006, is the same shape). Plain damage, not an attack: no guard, retaliate or stun applies. Playing an AERIAL
 *   event is what Angel of Life and Angel of Death answer.
 * - **Eyes in the Sky (42030)**: Hero Interrupt to the reveal of a non-ELITE minion by you (Spycraft, 08018, is the
 *   same shape): both the exhaust and the discard of this upgrade are costs. With no `attachesTo` it is played onto the
 *   player's own identity. Nothing left to cancel skips "Then, reveal another card" (RRG "'Then'", p. 44).
 * - **Flying Formation (42031)**: Alliance is data. Hero Action: up to 3 AERIAL characters of any player are readied.
 * - **X-Force Recruit (42032)**: "Play only if your identity has the X-FORCE trait" and "Max 1 per character" are card
 *   data (`playRestrictions`); the constant is +1 hit point and the X-FORCE trait on the host (Honorary Avenger, 03025).
 */
export const ANGEL_PACK_CARDS: AbilityRegistry = defineAbilities({
  "42029.bombs-away-action": heroAction(
    { cost: exhaustCardsCost(AERIAL_YOURS) },
    choosePlayer("player"),
    dealDamage(3, theVillain),
    dealDamage(3, each(query("minion", { engagedWithPlayer: chosenPlayer("player") }))),
  ),

  "42030.eyes-in-the-sky-interrupt": heroInterrupt(
    { ...on.encounterCardRevealed(query("minion", { withoutTrait: ELITE })), playerIs: "controller" },
    { cost: [exhaustCardsCost(AERIAL_YOURS), discardThis] },
    cancelRevealedCard(),
    andThen(revealEncounterCard(you)),
  ),

  "42031.flying-formation-action": heroAction(
    chooseTarget("characters", query("character", { trait: AERIAL }), { upTo: true, count: 3 }),
    ready(chosen("characters")),
  ),

  "42032.x-force-recruit-constant": constant(
    gets("hp", 1, { hostOfSelf: true }),
    gainsTrait(X_FORCE, { hostOfSelf: true }),
  ),
});
