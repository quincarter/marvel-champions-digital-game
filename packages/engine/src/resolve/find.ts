/**
 * "Find" a card (`EffectSpec findCard`, docs/phase7-wave6.md §3.48): "Find your Touched upgrade and set it aside"
 * (Anna Marie's Setup, erratum RRG 1.8 p. 69), "find Touched and attach it to another character" (Skin Contact).
 *
 * RRG 1.8 "Find" (p. 19): the player searches each game area where the card could be (`findCards`, `select.ts`, names
 * the areas and the order). RRG 1.8 "Search" (p. 39): "If any portion of a deck is searched, upon completion of that
 * game step, game function, or card ability, shuffle that entire deck." A deck is searched only when the card is in it:
 * a card found in play or in an open area was found without searching any deck, so no deck is shuffled.
 */

import { type Ctx, emit, updateFrame, updatePlayer } from "../ctx.js";
import { shuffleZone } from "../effects.js";
import type { InstanceId } from "../ids.js";
import { discardZoneFor, getInstance, locateCard, mustInstance, mustPlayer } from "../query.js";
import { type EffectContext, findCards, resolvePlayers, resolveRef } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { ZoneId } from "../state.js";
import { shuffleEncounterDeck, shuffleSeparateDeck } from "./cards.js";
import type { Frame } from "./frames.js";
import { markPreThenUnresolved } from "./then.js";

type FindCard = Extract<EffectSpec, { kind: "findCard" }>;

/** The slot the found card is bound to while its move resolves (the move reads it as `{ kind: "slot" }`). */
const FOUND_SLOT = "_find.card";

const sameZone = (a: ZoneId, b: ZoneId): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Whether the card is at the find's destination already, so nothing moves. */
function alreadyAt(ctx: Ctx, id: InstanceId, from: ZoneId | null, to: FindCard["to"], context: EffectContext): boolean {
  const instance = mustInstance(ctx.state, id);
  if (typeof to === "object" && "attachTo" in to) {
    const [host] = resolveRef(ctx.state, to.attachTo, context);
    return host !== undefined && instance.attachedTo === host;
  }
  if (from === null) return false;
  if (typeof to === "object")
    return "scenarioArea" in to && from.kind === "scenarioArea" && from.name === to.scenarioArea;
  switch (to) {
    case "hand":
      return from.kind === "hand" && from.playerId === instance.ownerId;
    case "setAside":
      return from.kind === "setAside" && from.playerId === instance.ownerId;
    case "discard":
      return sameZone(from, discardZoneFor(ctx.state, id));
    case "encounterSetAside":
      return from.kind === "encounterSetAside";
    default:
      return false;
  }
}

/** Shuffles the deck a find searched (RRG 1.8 "Search", p. 39); also after a "find" paid as a cost (`attach-cost.ts`). */
export function shuffleSearchedDeck(ctx: Ctx, deck: ZoneId): void {
  switch (deck.kind) {
    case "deck": {
      const order = shuffleZone(ctx, deck, mustPlayer(ctx.state, deck.playerId).deck);
      updatePlayer(ctx, deck.playerId, (p) => ({ ...p, deck: order }));
      return;
    }
    case "separateDeck":
      if (mustPlayer(ctx.state, deck.playerId).separateDecks[deck.name])
        shuffleSeparateDeck(ctx, deck.playerId, deck.name);
      return;
    case "encounterDeck":
      shuffleEncounterDeck(ctx, deck.deckId);
      return;
    case "scenarioDeck": {
      const piles = ctx.state.scenarioDecks[deck.name];
      if (!piles) return;
      const order = shuffleZone(ctx, deck, piles.deck);
      ctx.state = {
        ...ctx.state,
        scenarioDecks: { ...ctx.state.scenarioDecks, [deck.name]: { ...piles, deck: order } },
      };
      return;
    }
    default:
      return;
  }
}

/**
 * Logs `cardFound` for the card a find found, before it moves: where it was, whether it is already at its destination,
 * and whether the deck it was in will be shuffled. Shared by `findCard` and a "find" paid as a cost (`attach-cost.ts`).
 */
export function announceFound(ctx: Ctx, id: InstanceId, deck: ZoneId | null, alreadyThere: boolean): void {
  const from = locateCard(ctx.state, id);
  emit(ctx, {
    type: "cardFound",
    instanceId: id,
    cardId: mustInstance(ctx.state, id).cardId,
    ...(from ? { from } : {}),
    alreadyThere,
    deckShuffled: deck !== null,
  });
}

/**
 * Resolves a `findCard`: the first card `findCards` names goes to `to` through the effect that already moves cards
 * there (`moveCards`, or `attach` for `{ attachTo }`, handed in as `apply` so this module does not import its caller),
 * then the deck it was in, if any, is shuffled.
 */
export function applyFindCard(
  ctx: Ctx,
  effect: FindCard,
  context: EffectContext,
  frame: Frame<"effects">,
  apply: (ctx: Ctx, effect: EffectSpec, context: EffectContext, frame: Frame<"effects">) => void,
): void {
  const owners = effect.owner ? new Set(resolvePlayers(ctx.state, effect.owner, context)) : null;
  const [found] = findCards(ctx.state, effect.query, context, owners);
  if (!found) {
    // "Then" (RRG 1.8 p. 44): nothing found, so the text before a "then" did not fully resolve.
    markPreThenUnresolved(ctx, frame.frameId, "findFoundNothing");
    return;
  }
  const { id, deck } = found;
  const there = alreadyAt(ctx, id, locateCard(ctx.state, id), effect.to, context);
  announceFound(ctx, id, deck, there);
  if (effect.bind) {
    const bind = effect.bind;
    updateFrame(ctx, frame.frameId, (f) =>
      f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [bind]: [id] } } : f,
    );
  }
  if (!there && getInstance(ctx.state, id)) {
    const card = { kind: "slot", slot: FOUND_SLOT } as const;
    const move: EffectSpec =
      typeof effect.to === "object" && "attachTo" in effect.to
        ? { kind: "attach", card, to: effect.to.attachTo }
        : { kind: "moveCards", cards: { kind: "ref", ref: card }, to: effect.to };
    apply(ctx, move, { ...context, bindings: { ...context.bindings, [FOUND_SLOT]: [id] } }, frame);
  }
  if (deck) shuffleSearchedDeck(ctx, deck);
}
