/**
 * Attaching a card to a host, the one way an ability does it: the `attach` effect (and `findCard`'s `{ attachTo }`,
 * which hands its move to that effect) and an attach cost (`AbilityCost.attach`, `attach-cost.ts`; docs/phase7-wave6.md
 * §3.49: "Find Touched and attach it to a character other than Rogue and deal 2 damage to that character →", Energy
 * Transfer, `rogue` 38007, erratum RRG 1.8 p. 69).
 *
 * RRG 1.8 "Attach To" (p. 8): the card is placed on a game element in play; "the 'attach to' phrase on a card is not
 * resolved if another ability causes that card to attach to a specific game element", so the card's own printed
 * restriction (`attachesTo`) is not read here. The host may be any card in play: an enemy, another player's identity in
 * either form, another player's ally. The card's controller is not changed by the move (RRG 1.8 "Ownership and
 * Control", p. 31: "Control of a card remains constant unless an ability explicitly causes the card to change
 * control"), except that a player card coming into play from out of play enters under its owner's control (same page:
 * "Cards enter play under their owner's control"), as docs/phase7-wave6.md §3.49 plans. Not applied here, and flagged
 * as an open rules question in §3.49's handoff: p. 31's "Upgrades attached to a card controlled by a player other than
 * the upgrade's owner are controlled by that other player" (the play path, `play-card.ts`, does not apply it either).
 */

import { type Ctx, moveCard, updateInstance } from "../ctx.js";
import type { EngineDeps } from "../abilities.js";
import type { InstanceId } from "../ids.js";
import { getInstance, mustInstance } from "../query.js";
import { canHaveAttached, cannotBeUnattached } from "../rules.js";
import { cardsInPlay } from "../select.js";
import type { GameState } from "../state.js";

/**
 * Whether `id` can be attached to `host` now: the host is in play and is not the card itself, the card is not one that
 * "cannot be unattached" from another host (docs/phase7-wave3.md §3.19), and the host can have it attached
 * (`cannotHaveAttachments`, docs/phase7-wave4.md §3.8). A card already on that host passes: it stays where it is.
 */
export function canAttachTo(state: GameState, deps: EngineDeps, id: InstanceId, host: InstanceId): boolean {
  if (id === host || !cardsInPlay(state).includes(host)) return false;
  const instance = getInstance(state, id);
  if (!instance) return false;
  const current = instance.attachedTo;
  if (current === host) return true;
  if (current !== null && cannotBeUnattached(state, deps, id)) return false;
  return canHaveAttached(state, deps, host, id);
}

/**
 * Attaches `id` to `host` if it can (`canAttachTo`); returns whether it is on that host afterwards. A card already on
 * that host stays as it is, with no move. `facedown`: "attach 1 card from your hand facedown here" (Bruno Carrelli),
 * with no title, traits, keywords or abilities until it leaves play; otherwise it is faceup in play whatever zone it
 * came from ("search the top 5 cards of your deck for an [Arrow] event and attach it faceup to this card", Hawkeye's
 * Quiver; docs/phase7-wave2.md §3.10).
 */
export function attachCard(ctx: Ctx, id: InstanceId, host: InstanceId, facedown = false): boolean {
  if (!canAttachTo(ctx.state, ctx.deps, id, host)) return false;
  if (mustInstance(ctx.state, id).attachedTo === host) return true;
  const wasInPlay = cardsInPlay(ctx.state).includes(id);
  moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
  // A player card entering play from out of play enters under its owner's control (RRG 1.8 p. 31); one moving between
  // hosts keeps its controller. A no-op for every card whose controller is already its owner.
  const { ownerId, controllerId } = mustInstance(ctx.state, id);
  if (!wasInPlay && ownerId !== null && controllerId !== ownerId)
    updateInstance(ctx, id, (i) => ({ ...i, controllerId: ownerId }));
  if (facedown) updateInstance(ctx, id, (i) => ({ ...i, faceup: false, facedownAs: { kind: "blank", traits: [] } }));
  else if (!mustInstance(ctx.state, id).faceup) updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
  return true;
}
