/**
 * "Find Touched and attach it to a character other than Rogue and deal 2 damage to that character →" (Energy Transfer,
 * `rogue` 38007, erratum RRG 1.8 p. 69; docs/phase7-wave6.md §3.49): attaching a card as part of a cost
 * (`AbilityCost.attach`) and dealing damage as part of a cost (`AbilityCost.dealDamage`). Whether they can be paid,
 * which hosts the payer may pick, and paying them. `planCost` and `payCost` (`actions.ts`) call these; `legalActions`
 * offers one variant per host (`legal.ts`).
 */

import type { AttachCost, EngineDeps } from "./abilities.js";
import type { CostChoices } from "./commands.js";
import { type Ctx } from "./ctx.js";
import type { EngineErrorCode } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { locateCard } from "./query.js";
import { attachCardBy, canAttachTo } from "./resolve/attach.js";
import { announceFound, shuffleSearchedDecks } from "./resolve/find.js";
import { pushEvents } from "./resolve/frames.js";
import { heard } from "./resolve/triggers.js";
import {
  cardsInPlay,
  controllerOf,
  decksSearchedByFind,
  type EffectContext,
  findCards,
  matchesQuery,
  resolvePlayers,
  resolveRef,
} from "./select.js";
import type { Bindings } from "./stack.js";
import type { GameState, ZoneId } from "./state.js";
import type { TargetQuery, TargetRef } from "./spec.js";

interface CostFault {
  readonly code: EngineErrorCode;
  readonly message: string;
}

/** The slot the attached card is bound to when the cost names none, so `payCost` pays exactly the card planned. */
export const ATTACH_CARD_SLOT = "_attach.card";

/** Where an attach cost binds its card. */
export const attachCardSlot = (attach: AttachCost): string => attach.bind ?? ATTACH_CARD_SLOT;

/** The out-of-play areas that are a player's own (RRG 1.8 "Ownership and Control", p. 31). */
const OWN_OUT_OF_PLAY: ReadonlySet<ZoneId["kind"]> = new Set([
  "hand",
  "deck",
  "discard",
  "setAside",
  "separateDeck",
  "separateDiscard",
]);
const DECKS: ReadonlySet<ZoneId["kind"]> = new Set(["deck", "separateDeck", "encounterDeck", "scenarioDeck"]);

const costContext = (
  sourceId: InstanceId,
  playerId: PlayerId,
  deps: EngineDeps,
  bindings: Bindings = {},
): EffectContext => ({ selfInstanceId: sourceId, controllerId: playerId, event: null, bindings, deps });

/**
 * Whether the payer may pay a cost with this card (RRG 1.8 "Cost", p. 14): one in play they control, or one out of play
 * in their own hand, deck, discard pile or set-aside area ("the player paying the cost may only use game elements that
 * are in their own out-of-play areas").
 */
function payerMayUse(state: GameState, id: InstanceId, playerId: PlayerId): boolean {
  if (cardsInPlay(state).includes(id)) return controllerOf(state, id) === playerId;
  const zone = locateCard(state, id);
  return zone !== null && OWN_OUT_OF_PLAY.has(zone.kind) && "playerId" in zone && zone.playerId === playerId;
}

/**
 * The card an attach cost attaches: the first card `attach.card` names that the payer may pay with, in the ref's order
 * (a find's search order, `findCards`). Null when there is none.
 */
export function attachCostCard(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  attach: AttachCost,
): InstanceId | null {
  const context = costContext(sourceId, playerId, deps);
  const ref = attach.card;
  const named =
    ref.kind === "find"
      ? findCards(state, ref.query, context, ref.owner ? new Set(resolvePlayers(state, ref.owner, context)) : null).map(
          (found) => found.id,
        )
      : resolveRef(state, ref, context);
  return named.find((id) => id !== sourceId && payerMayUse(state, id, playerId)) ?? null;
}

/** The cards in play the payer may attach `card` to: matching `attach.to.query`, and able to take it (`canAttachTo`). */
export function attachCostHosts(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  attach: AttachCost,
  card: InstanceId,
): readonly InstanceId[] {
  const context = costContext(sourceId, playerId, deps, attach.bind ? { [attach.bind]: [card] } : {});
  return cardsInPlay(state).filter(
    (host) => matchesQuery(state, host, attach.to.query, context) && canAttachTo(state, deps, card, host),
  );
}

/**
 * Checks an attach cost against the command's host pick (`choices[to.slot]`; forced with one candidate) and returns the
 * bindings paying it will use: the card under `attachCardSlot`, the host under `to.slot`. Nothing is paid.
 */
export function planAttachCost(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  attach: AttachCost,
  choices: CostChoices,
  reserved: ReadonlySet<InstanceId>,
): Bindings | CostFault {
  const card = attachCostCard(state, deps, sourceId, playerId, attach);
  if (card === null) return { code: "card_not_in_zone", message: "there is no card to attach for this cost" };
  // RRG 1.8 "Cost" (p. 13): one card cannot pay two parts of a cost, so not a hand card the payment spends.
  if (reserved.has(card)) return { code: "invalid_choice", message: `${card} cannot both pay and be attached` };
  const hosts = attachCostHosts(state, deps, sourceId, playerId, attach, card);
  const slot = attach.to.slot;
  if (hosts.length === 0) return { code: "no_valid_target", message: `nothing in play to attach ${card} to` };
  const named = choices[slot] ?? (hosts.length === 1 ? hosts : undefined);
  if (!named) return { code: "invalid_choice", message: `choose what to attach ${card} to for ${slot}` };
  const [host, ...extra] = named;
  if (!host || extra.length > 0) return { code: "invalid_choice", message: `choose exactly one card for ${slot}` };
  if (!hosts.includes(host)) return { code: "no_valid_target", message: `${card} cannot be attached to ${host}` };
  return { [attachCardSlot(attach)]: [card], [slot]: [host] };
}

/** The cards in play a `dealDamage` cost's `choose` lets the payer pick: matching its query, any player's. */
export function dealDamageCostChoices(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  choose: { readonly slot: string; readonly query: TargetQuery },
  bindings: Bindings = {},
): readonly InstanceId[] {
  const context = costContext(sourceId, playerId, deps, bindings);
  return cardsInPlay(state).filter((id) => matchesQuery(state, id, choose.query, context));
}

/**
 * Checks a `dealDamage` cost's `choose` against the command's pick (`choices[slot]`; forced with one candidate) and
 * returns the binding for it. Nothing is paid.
 */
export function planDealDamageChoice(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  choose: { readonly slot: string; readonly query: TargetQuery },
  choices: CostChoices,
  bindings: Bindings,
): Bindings | CostFault {
  const candidates = dealDamageCostChoices(state, deps, sourceId, playerId, choose, bindings);
  const slot = choose.slot;
  if (candidates.length === 0)
    return { code: "no_valid_target", message: `nothing in play to deal damage to for ${slot}` };
  const named = choices[slot] ?? (candidates.length === 1 ? candidates : undefined);
  if (!named) return { code: "invalid_choice", message: `choose what to deal this cost's damage to for ${slot}` };
  const [pick, ...extra] = named;
  if (!pick || extra.length > 0) return { code: "invalid_choice", message: `choose exactly one card for ${slot}` };
  if (!candidates.includes(pick))
    return { code: "no_valid_target", message: `${pick} is not a legal choice for ${slot}` };
  return { [slot]: [pick] };
}

/** The cards in play a `dealDamage` cost names, read with the cost's picks bound. */
export function dealDamageCostTargets(
  state: GameState,
  deps: EngineDeps,
  sourceId: InstanceId,
  playerId: PlayerId,
  target: TargetRef,
  bindings: Bindings,
): readonly InstanceId[] {
  const inPlay = cardsInPlay(state);
  return resolveRef(state, target, costContext(sourceId, playerId, deps, bindings)).filter((id) => inPlay.includes(id));
}

/**
 * Pays an attach cost as planned: a find is logged `cardFound` (RRG 1.8 "Find", p. 19), the card is attached
 * (`attachCard`; a card already on that host stays), then each deck the find searched is shuffled (RRG 1.8 "Search",
 * p. 39; `decksSearchedByFind`).
 */
export function payAttachCost(
  ctx: Ctx,
  sourceId: InstanceId,
  playerId: PlayerId,
  attach: AttachCost,
  bindings: Bindings,
): void {
  const [card] = bindings[attachCardSlot(attach)] ?? [];
  const [host] = bindings[attach.to.slot] ?? [];
  if (card === undefined || host === undefined) return;
  const ref = attach.card;
  let searched: readonly ZoneId[] = [];
  if (ref.kind === "find") {
    const from = locateCard(ctx.state, card);
    const deck = from !== null && DECKS.has(from.kind) ? from : null;
    const context = costContext(sourceId, playerId, ctx.deps);
    const owners = ref.owner ? new Set(resolvePlayers(ctx.state, ref.owner, context)) : null;
    searched = decksSearchedByFind(ctx.state, ref.query, context, owners, { id: card, deck });
    announceFound(ctx, card, deck, ctx.state.instances[card]?.attachedTo === host);
  }
  const attached = attachCardBy(ctx, card, host, playerId).filter((event) => heard(ctx.state, ctx.deps, event));
  shuffleSearchedDecks(ctx, searched);
  if (attached.length > 0) pushEvents(ctx, attached);
}

/**
 * Pays a `dealDamage` cost: one `dealDamage` event per target, from the ability's card, pushed above the frame being
 * paid for so it resolves before the effects. Paid whatever is prevented (RRG 1.8 "Cost", p. 14), so nothing settles it.
 */
export function payDealDamageCost(
  ctx: Ctx,
  sourceId: InstanceId,
  playerId: PlayerId,
  cost: { readonly target: TargetRef; readonly amount: number },
  bindings: Bindings,
): void {
  const targets = dealDamageCostTargets(ctx.state, ctx.deps, sourceId, playerId, cost.target, bindings);
  if (targets.length === 0 || cost.amount <= 0) return;
  pushEvents(
    ctx,
    targets.map((targetInstanceId) => ({
      kind: "dealDamage" as const,
      targetInstanceId,
      amount: cost.amount,
      sourceInstanceId: sourceId,
      fromAttack: false,
    })),
  );
}
