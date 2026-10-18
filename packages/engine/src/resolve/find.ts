/**
 * "Find" a card (`EffectSpec findCard`, docs/phase7-wave6.md §3.48): "Find your Touched upgrade and set it aside"
 * (Anna Marie's Setup, erratum RRG 1.8 p. 69), "find Touched and attach it to another character" (Skin Contact).
 *
 * RRG 1.8 "Find" (p. 19): the player searches each game area where the card could be (`findCards`, `select.ts`, names
 * the areas and the order). RRG 1.8 "Search" (p. 39): "If any portion of a deck is searched, upon completion of that
 * game step, game function, or card ability, shuffle that entire deck."; "Shuffle" (p. 40): "Any time a deck is searched
 * by a game step or card ability, that deck is shuffled after the game step or card ability completes its resolution."
 * So each deck the find looked through is shuffled, whether or not the card was in it (the owner's decision,
 * 2026-10-03, docs/phase7-wave6.md §4.1 Q77); a card found in play or in an open area was found without searching any
 * deck, so no deck is shuffled (`decksSearchedByFind`, `select.ts`). Which decks a find looks through at all is decided
 * there too: an identity's separate deck or a scenario deck only when the find can name one of that deck's own cards
 * (the owner's answer 54B, 2026-10-13, docs/phase7-wave10.md §4.0).
 */

import { type Ctx, emit, updateFrame, updatePlayer } from "../ctx.js";
import { announceDeckTops, holdDeckTops } from "../deck-top.js";
import { shuffleZone } from "../effects.js";
import type { InstanceId } from "../ids.js";
import { discardZoneFor, getInstance, isFixedOrderDeck, locateCard, mustInstance, mustPlayer } from "../query.js";
import {
  cardsInPlay,
  decksSearchedByFind,
  type EffectContext,
  findCards,
  type FoundCard,
  resolvePlayers,
  resolveRef,
} from "../select.js";
import type { EffectSpec, TargetRef } from "../spec.js";
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
  // "Find X and reveal it" / "and put it into play": already in play, faceup, as itself.
  if (to === "reveal" || to === "play") return cardsInPlay(ctx.state).includes(id) && instance.faceup;
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

/** Shuffles each deck a find searched, in search order; also after a "find" paid as a cost (`attach-cost.ts`). */
export function shuffleSearchedDecks(ctx: Ctx, decks: readonly ZoneId[]): void {
  for (const deck of decks) shuffleSearchedDeck(ctx, deck);
}

/** Shuffles one deck a find searched (RRG 1.8 "Search", p. 39). */
function shuffleSearchedDeck(ctx: Ctx, deck: ZoneId): void {
  switch (deck.kind) {
    case "deck": {
      const order = shuffleZone(ctx, deck, mustPlayer(ctx.state, deck.playerId).deck);
      updatePlayer(ctx, deck.playerId, (p) => ({ ...p, deck: order }));
      announceDeckTops(ctx);
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
 * and whether a deck was searched for it (`deck`: the deck it was in) and so will be shuffled. Shared by `findCard` and
 * a "find" paid as a cost (`attach-cost.ts`).
 */
export function announceFound(ctx: Ctx, id: InstanceId, deck: ZoneId | null, alreadyThere: boolean): void {
  const from = locateCard(ctx.state, id);
  emit(ctx, {
    type: "cardFound",
    instanceId: id,
    cardId: mustInstance(ctx.state, id).cardId,
    ...(from ? { from } : {}),
    alreadyThere,
    // A fixed-order separate deck is searched without a shuffle (docs/phase7-wave11.md §3.1).
    deckShuffled: deck !== null && !isFixedOrderDeck(ctx.state, deck),
  });
}

/**
 * The find of "find X and reveal it" (`revealCard` of a `TargetRef find`; docs/phase7-wave8.md §3.1): the first card the
 * find names, logged `cardFound` where it is, and the decks looked through for it, which the caller shuffles once the
 * card is out of them. `alreadyThere` on the log line reads "already in play": that card is revealed where it is and
 * does not enter play (RRG 1.8 "Find", p. 19). Nothing found: no log line, and the decks were still searched.
 */
export function findToReveal(
  ctx: Ctx,
  ref: Extract<TargetRef, { kind: "find" }>,
  context: EffectContext,
): { readonly found: readonly InstanceId[]; readonly searched: readonly ZoneId[] } {
  return findFirst(
    ctx,
    ref,
    context,
    (id) => cardsInPlay(ctx.state).includes(id) && mustInstance(ctx.state, id).faceup,
  );
}

/**
 * The find of "finds X and deals him to themself as a facedown encounter card" (`dealAsEncounterCard` of a `TargetRef
 * find`; docs/phase7-wave8.md §3.75): as `findToReveal`, but the card always moves, from play included, so
 * `alreadyThere` is false (a find never reaches a facedown dealt card, RRG 1.8 "Find", p. 19).
 */
export function findToDeal(
  ctx: Ctx,
  ref: Extract<TargetRef, { kind: "find" }>,
  context: EffectContext,
): { readonly found: readonly InstanceId[]; readonly searched: readonly ZoneId[] } {
  return findFirst(ctx, ref, context, () => false);
}

/** The first card a find names, logged `cardFound` where it is, and the decks searched for it. */
function findFirst(
  ctx: Ctx,
  ref: Extract<TargetRef, { kind: "find" }>,
  context: EffectContext,
  alreadyThere: (id: InstanceId) => boolean,
): { readonly found: readonly InstanceId[]; readonly searched: readonly ZoneId[] } {
  const owners = ref.owner ? new Set(resolvePlayers(ctx.state, ref.owner, context)) : null;
  const [found] = findCards(ctx.state, ref.query, context, owners);
  const searched = decksSearchedByFind(ctx.state, ref.query, context, owners, found);
  if (!found) return { found: [], searched };
  announceFound(ctx, found.id, found.deck, alreadyThere(found.id));
  return { found: [found.id], searched };
}

/**
 * The cards a `findCard` may find, in search order: every match the find reaches (`findCards`), less the cards in play
 * for a find of a card "that is not in play" (`outOfPlay`). A find with no `choose` takes the first; one with `choose`
 * offers them all (docs/phase7-wave10-hero-packs.md H3.4).
 */
export function findCandidates(ctx: Ctx, effect: FindCard, context: EffectContext): readonly FoundCard[] {
  const owners = effect.owner ? new Set(resolvePlayers(ctx.state, effect.owner, context)) : null;
  const all = findCards(ctx.state, effect.query, context, owners);
  if (!effect.outOfPlay) return all;
  const inPlay = new Set(cardsInPlay(ctx.state));
  return all.filter((found) => !inPlay.has(found.id));
}

/**
 * Resolves a `findCard`: the card found (`picked` for a find with `choose`, else the first of `findCandidates`) goes to
 * `to` through the effect that already moves cards there (`moveCards`, `attach` for `{ attachTo }`, `revealCard` for
 * `"reveal"`, `putIntoPlay` for `"play"`, handed in as `apply` so this module does not import its caller), then each
 * deck the find searched is shuffled. A find that found nothing still searched, and shuffles, every deck the card
 * could have been in.
 */
export function applyFindCard(
  ctx: Ctx,
  effect: FindCard,
  context: EffectContext,
  frame: Frame<"effects">,
  apply: (ctx: Ctx, effect: EffectSpec, context: EffectContext, frame: Frame<"effects">) => void,
  picked?: InstanceId,
): void {
  // One change to a deck kept faceup (docs/phase7-wave8.md §3.48): the searched deck's top card shows after its
  // shuffle, not between the card leaving and the shuffle.
  holdDeckTops(ctx, () => findCardNow(ctx, effect, context, frame, apply, picked));
}

function findCardNow(
  ctx: Ctx,
  effect: FindCard,
  context: EffectContext,
  frame: Frame<"effects">,
  apply: (ctx: Ctx, effect: EffectSpec, context: EffectContext, frame: Frame<"effects">) => void,
  picked: InstanceId | undefined,
): void {
  const owners = effect.owner ? new Set(resolvePlayers(ctx.state, effect.owner, context)) : null;
  const candidates = findCandidates(ctx, effect, context);
  const found = picked === undefined ? candidates[0] : candidates.find((candidate) => candidate.id === picked);
  // Read before the card moves: the decks looked through for it. A find that chooses among every match looked
  // through each deck one could be in, whichever card it took (docs/phase7-wave10-hero-packs.md H3.4).
  const searched = decksSearchedByFind(ctx.state, effect.query, context, owners, effect.choose ? undefined : found);
  if (!found) {
    // "Then" (RRG 1.8 p. 44): nothing found, so the text before a "then" did not fully resolve.
    markPreThenUnresolved(ctx, frame.frameId, "findFoundNothing");
    if (effect.bind) bindFound(ctx, frame, effect.bind, []);
    shuffleSearchedDecks(ctx, searched);
    return;
  }
  const { id } = found;
  const there = alreadyAt(ctx, id, locateCard(ctx.state, id), effect.to, context);
  // The log line's `deckShuffled`: whether any deck was looked through for this find.
  announceFound(ctx, id, effect.choose ? (searched[0] ?? null) : found.deck, there);
  if (effect.bind) bindFound(ctx, frame, effect.bind, [id]);
  // A card found in play is still revealed, where it is (RRG 1.8 "Find", p. 19).
  if ((!there || effect.to === "reveal") && getInstance(ctx.state, id)) {
    const card = { kind: "slot", slot: FOUND_SLOT } as const;
    const finder = { kind: "controller" } as const;
    const move: EffectSpec =
      effect.to === "reveal"
        ? {
            kind: "revealCard",
            cards: card,
            player: finder,
            ...(effect.perPlayerAs !== undefined ? { perPlayerAs: effect.perPlayerAs } : {}),
          }
        : effect.to === "play"
          ? { kind: "putIntoPlay", card, controller: finder }
          : typeof effect.to === "object" && "attachTo" in effect.to
            ? { kind: "attach", card, to: effect.to.attachTo }
            : { kind: "moveCards", cards: { kind: "ref", ref: card }, to: effect.to };
    apply(ctx, move, { ...context, bindings: { ...context.bindings, [FOUND_SLOT]: [id] } }, frame);
  }
  shuffleSearchedDecks(ctx, searched);
}

/** Binds what the find found (one card, or none) to its slot. */
function bindFound(ctx: Ctx, frame: Frame<"effects">, bind: string, ids: readonly InstanceId[]): void {
  updateFrame(ctx, frame.frameId, (f) =>
    f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [bind]: ids } } : f,
  );
}
