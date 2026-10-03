import { trait } from "@mc/content";
import {
  action,
  attack,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  coveredByEngineRule,
  defineAbilities,
  hasAttachment,
  moveCards,
  query,
  shuffleDeck,
  spend,
  you,
  zone,
} from "../../../dsl/index.js";

const TACTIC = trait("TACTIC");

/**
 * Cyclops / Scott Summers (33001a/b, Cyclops Hero Pack p. 1): docs/phase7-wave6.md §6.1, §3.44. His kit
 * (33002-33026), obligation (Lost Visor, 33027) and nemesis set (33028-33032) are separate modules, not started.
 *
 * - **Cyclops (hero, 33001a)** "Optic Blast - Action (attack): Spend one resource of any type -> deal 3 damage to an
 *   enemy with an upgrade attached. (Limit once per round)": an "(attack)" action, so it resolves as an attack by his
 *   identity (guard, retaliate, Full Blast's and Ruby Quartz Visor's modifiers all key on it). `spend(1)` is one
 *   resource of any type; the target is any enemy (minion or villain) with an upgrade attached, which is a targeting
 *   restriction, not an "if" (no legal target, no use). FAQ "Ricochet Beam (#9)" (RRG 1.8 p. 63) is Ricochet Beam's.
 * - **Scott Summers (alter-ego, 33001b)** "You may include X-MEN allies from any aspect in your deck" is deckbuilding
 *   data (`offAspectAllowance` on the card), so its ref is `coveredByEngineRule()`. "Constant Training - Action:
 *   Search your deck for a TACTIC upgrade and add it to your hand. (Limit once per round)": the player may find
 *   nothing (`min: 0`); the searched deck is shuffled after the ability resolves (RRG 1.8 "Search", p. 40), though
 *   the card does not print it.
 */
export const CYCLOPS_IDENTITY = defineAbilities({
  "33001a.cyclops-constant": action(
    { label: "attack", cost: spend(1), limit: { count: 1, period: "round" } },
    chooseTarget("enemy", query("enemy", hasAttachment(query("upgrade")))),
    attack(3, chosen("enemy")),
  ),

  "33001b.scott-summers-constant": coveredByEngineRule(),
  "33001b.scott-summers-constant-2": action(
    { limit: { count: 1, period: "round" } },
    chooseCards("found", zone("deck", you, { filter: query("upgrade", { trait: TACTIC }) }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),
});
