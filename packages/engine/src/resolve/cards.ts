/** Card selectors and bulk card moves used by effects. */

import { announceDeckTops } from "../deck-top.js";
import type { CardId } from "@mc/content";
import {
  type Ctx,
  emit,
  findFrame,
  moveCard,
  syncSeparateDeckTop,
  updateFrame,
  updateInstance,
  updatePlayer,
} from "../ctx.js";
import {
  type DeckDiscarder,
  defeatFromPlay,
  drawCards,
  isDiscardDestination,
  isWaitingLeave,
  leavePlay,
  leavingWithHost,
  listensForDeckDiscard,
  moveDestinationKind,
  permanentStopsLeaving,
  recordDeckDiscard,
  shuffleZone,
  recordEncounterCardDealt,
  recordTuckedDiscard,
  tuckedHostToRecord,
  waitsForLeaveInterrupts,
} from "../effects.js";
import type { EncounterDeckId, FrameId, InstanceId, PlayerId } from "../ids.js";
import {
  activeEncounterDeckId,
  cardOf,
  closedToPlayerCard,
  discardZoneFor,
  encounterDeckOf,
  getInstance,
  getPlayer,
  locateCard,
  mustInstance,
  mustPlayer,
  separateDeckOf,
  villainOf,
} from "../query.js";
import { campaignLogCardIds } from "../campaign-state.js";
import { nextInt } from "../rng.js";
import {
  campaignFieldRead,
  campaignSeatRead,
  cardsInPlay,
  type EffectContext,
  matchesQuery,
  resolvePlayers,
  resolveRef,
  resolveValue,
} from "../select.js";
import type { CardDestination, CardSelector, ScenarioDeckSource, TargetQuery } from "../spec.js";
import type { ZoneId } from "../state.js";
import type { HostStep, LeaveRequest, TriggerEvent } from "../trigger-events.js";
import { describeFrame } from "../stack.js";
import { announce, eventFrame, type Frame, pushEvent, pushEventsSharingResponses } from "./frames.js";
import { villainDefeatRemoves } from "./defeat.js";
import { runHostStep } from "./host-step.js";
import {
  scenarioDeckCards,
  scenarioDeckIsMadeOf,
  settleScenarioDeckTops,
  showScenarioDeckFace,
} from "./scenario-deck-top.js";
import { swapCards } from "./swap-cards.js";
import { hasCandidates } from "./triggers.js";
import { tuckLeavingCard } from "./tuck.js";
import { pushWindow } from "./window.js";
import { heard } from "./triggers.js";
import { cannotLeavePlay, staysInHand } from "../rules.js";

/**
 * `count` cards of `pool` at random, without replacement, in the order drawn; every card of a smaller pool, none of an
 * empty one. Each pick is one draw on the game's seeded RNG (`GameState.rng`), which advances with it, so a replay of
 * the command log picks the same cards; an empty pool or a count of zero draws nothing and leaves the RNG as it was.
 * The one place a selector's `random` is resolved (`zone`, `encounter`, `encounterSetAside`, `tucked`).
 */
function pickAtRandom(ctx: Ctx, pool: readonly InstanceId[], count: number): InstanceId[] {
  const left = [...pool];
  const picked: InstanceId[] = [];
  for (let i = 0; i < count && left.length > 0; i++) {
    const [index, rng] = nextInt(ctx.state.rng, left.length);
    ctx.state = { ...ctx.state, rng };
    picked.push(left[index] as InstanceId);
    left.splice(index, 1);
  }
  return picked;
}

/** The cards a selector names right now (out of play included), in zone order. */
export function selectCards(ctx: Ctx, selector: CardSelector, context: EffectContext): readonly InstanceId[] {
  const state = ctx.state;
  const filtered = (ids: readonly InstanceId[], filter: TargetQuery | undefined): readonly InstanceId[] =>
    filter ? ids.filter((id) => matchesQuery(state, id, filter, context)) : ids;
  switch (selector.kind) {
    case "anyOf": {
      // One pool across several selectors, deduplicated, in the order listed.
      const seen = new Set<InstanceId>();
      for (const part of selector.of) for (const id of selectCards(ctx, part, context)) seen.add(id);
      return [...seen];
    }
    case "atMost":
      // "Search for one copy": the first `count` in the inner selector's order (docs/phase7-wave3.md §3.50).
      return selectCards(ctx, selector.of, context).slice(
        0,
        Math.max(0, resolveValue(ctx.state, selector.count, context)),
      );
    case "ref":
      // Ruling Dec 17, 2025 (4): a card removed from the game "cannot be returned to the game by any means", so a ref
      // never reaches it (Odin removed by his forced interrupt before Med Lab's response; docs/phase7-wave6.md §3.57).
      // Only card text naming that area does (`CardSelector removedFromGame`, Loose Ends).
      return filtered(
        resolveRef(state, selector.ref, context).filter(
          (id) => getInstance(state, id) !== undefined && !state.removedFromGame.includes(id),
        ),
        selector.filter,
      );
    case "campaignLog": {
      // "Each EXPERIMENTAL attachment recorded in the campaign log" (MC10 p. 7): the field lists *titles*, and one
      // title can be listed twice (ruling June 2, 2026 (3) answer 3), so each entry claims one not-yet-claimed
      // instance of that card, in the order the game created its instances. A title with no instance left names
      // nothing — the same arithmetic as answer 4's "remove a number of cards equal to the count recorded".
      const value = campaignFieldRead(state, selector, context);
      const cardIds = campaignLogCardIds(value);
      const pool = Object.keys(state.instances) as InstanceId[];
      const found: InstanceId[] = [];
      if (selector.byName) {
        // "Each minion with the same name as a villain's name recorded" (MC27 p. 17): the recorded cards contribute
        // only their printed names, and every instance printing one of them matches.
        const names = new Set(cardIds.flatMap((cardId) => state.cardPool[cardId]?.name ?? []));
        for (const id of pool) {
          const name = state.cardPool[state.instances[id]?.cardId ?? ""]?.name;
          if (name === undefined || !names.has(name)) continue;
          if (selector.filter && !matchesQuery(state, id, selector.filter, context)) continue;
          found.push(id);
        }
      } else {
        const claimed = new Set<InstanceId>();
        for (const cardId of cardIds) {
          const match = pool.find(
            (id) =>
              !claimed.has(id) &&
              state.instances[id]?.cardId === cardId &&
              (!selector.filter || matchesQuery(state, id, selector.filter, context)),
          );
          if (!match) continue;
          claimed.add(match);
          found.push(match);
        }
      }
      // The one campaign-log read a game makes that is not re-entrant, so the one that can be traced (`events.ts`).
      emit(ctx, {
        type: "campaignLogRead",
        field: selector.field,
        seatNumber: campaignSeatRead(state, selector, context),
        cardIds,
        instanceIds: found,
      });
      return found;
    }
    case "encounter": {
      const deckIds = selector.deckOf
        ? [
            ...new Set(
              resolveRef(state, selector.deckOf, context).flatMap((id) => villainOf(state, id)?.encounterDeckId ?? []),
            ),
          ]
        : [activeEncounterDeckId(state)];
      const ids: InstanceId[] = [];
      for (const deckId of deckIds) {
        const piles = encounterDeckOf(state, deckId);
        let deck = piles.deck;
        if (selector.top) deck = deck.slice(0, Math.max(0, resolveValue(state, selector.top, context)));
        const pool = filtered(
          [
            ...(selector.zones.includes("deck") ? deck : []),
            ...(selector.zones.includes("discard") ? piles.discard : []),
          ],
          selector.filter,
        );
        // The discard pile's array runs newest-first (`moveCard` puts a discarded card on top), so "topmost" is the
        // first match, as for the deck (docs/phase7-wave6-handoff.md §3.76).
        ids.push(...(selector.topmostOnly ? pool.slice(0, 1) : pool));
      }
      if (!selector.random) return ids;
      return pickAtRandom(ctx, ids, resolveValue(ctx.state, selector.random, context));
    }
    case "encounterSetAside": {
      const matching = [...filtered(state.encounterSetAside, selector.filter)];
      if (!selector.random) return matching;
      return pickAtRandom(ctx, matching, resolveValue(ctx.state, selector.random, context));
    }
    case "removedFromGame":
      return filtered(state.removedFromGame, selector.filter);
    case "victoryDisplay":
      return filtered(state.victoryDisplay, selector.filter);
    case "scenarioArea":
      return filtered(state.scenarioAreas?.[selector.name] ?? [], selector.filter);
    case "scenarioDeck": {
      const piles = state.scenarioDecks[selector.name];
      if (!piles) return [];
      // A deck closed to player card effects (the show deck, docs/phase7-wave6.md §3.66): a player card's ability
      // finds none of its cards, so it can neither look at them nor choose, reorder or move them.
      const sourceCardId = context.selfInstanceId ? getInstance(state, context.selfInstanceId)?.cardId : undefined;
      if (sourceCardId !== undefined && closedToPlayerCard(state, selector.name, sourceCardId)) {
        emit(ctx, { type: "scenarioDeckClosed", name: selector.name, sourceCardId, instanceIds: [] });
        return [];
      }
      const zones = selector.zones ?? ["deck"];
      // A deck whose top card is in play counts that card first (`scenarioDeckCards`, docs/phase7-wave9.md §3.17).
      const whole = scenarioDeckCards(state, selector.name);
      const deck = selector.top ? whole.slice(0, Math.max(0, resolveValue(state, selector.top, context))) : whole;
      return filtered(
        [...(zones.includes("deck") ? deck : []), ...(zones.includes("discard") ? piles.discard : [])],
        selector.filter,
      );
    }
    case "setAside":
      return resolvePlayers(state, selector.player, context).flatMap((playerId) =>
        filtered(mustPlayer(state, playerId).setAside, selector.filter),
      );
    case "tucked": {
      const under = filtered(
        resolveRef(state, selector.under, context).flatMap((id) => getInstance(state, id)?.tucked ?? []),
        selector.filter,
      );
      if (!selector.random) return under;
      return pickAtRandom(ctx, under, resolveValue(ctx.state, selector.random, context));
    }
    case "dealtEncounter":
      // Facedown and not being revealed, as `passEncounterCards` reads a card that is still a dealt one. A surge's
      // card whose reveal has not begun (`afterDeal`) is one.
      return resolvePlayers(state, selector.player, context).flatMap((playerId) =>
        filtered(
          mustPlayer(state, playerId).dealtEncounter.filter(
            (id) =>
              !mustInstance(state, id).faceup &&
              !state.stack.some((f) => f.kind === "reveal" && f.instanceId === id && !f.afterDeal),
          ),
          selector.filter,
        ),
      );
    case "separateDeck": {
      const zones = selector.zones ?? ["deck"];
      return resolvePlayers(state, selector.player, context).flatMap((playerId) => {
        const piles = getPlayer(state, playerId)?.separateDecks[selector.name];
        if (!piles) return [];
        const deck = selector.top
          ? piles.deck.slice(0, Math.max(0, resolveValue(state, selector.top, context)))
          : piles.deck;
        return filtered(
          [...(zones.includes("deck") ? deck : []), ...(zones.includes("discard") ? piles.discard : [])],
          selector.filter,
        );
      });
    }
    case "zone": {
      const found: InstanceId[] = [];
      // "Search your deck and discard pile for …": several zones are one pool, so the choice is over everything found.
      const zones = typeof selector.zone === "string" ? [selector.zone] : selector.zone;
      for (const playerId of resolvePlayers(state, selector.player, context)) {
        const player = mustPlayer(state, playerId);
        const pool: InstanceId[] = [];
        for (const name of zones) {
          const zone = name === "hand" ? player.hand : name === "deck" ? player.deck : player.discard;
          pool.push(...(selector.top ? zone.slice(0, Math.max(0, resolveValue(state, selector.top, context))) : zone));
        }
        let matching = [...filtered(pool, selector.filter)];
        if (selector.random) {
          matching = pickAtRandom(ctx, matching, resolveValue(ctx.state, selector.random, context));
        }
        found.push(
          ...(selector.bottommostOnly ? matching.slice(-1) : selector.topmostOnly ? matching.slice(0, 1) : matching),
        );
      }
      return found;
    }
  }
}

/**
 * `moveCards`: out-of-play cards move directly; cards in play leave play (attachments discarded, state cleared). The
 * `separate…` destinations follow each card's `home` separate deck and skip any other card. `sourceCardId`: the card
 * whose ability moves them, if any; a permanent card in play that it cannot move stays as it is (`permanentStopsLeaving`,
 * docs/phase7-wave5.md §4.1 Q46). `deckDiscardBy`: what a card this discards from a player's deck was discarded by
 * (`recordDeckDiscard`, docs/phase7-wave7.md §3.55). `asCost`: `sourceCardId`'s ability moves them as its cost, so a
 * card in play leaves by no card effect (`leaveCauseSide`). A tucked card this discards is recorded as that
 * (`recordTuckedDiscard`, docs/phase7-wave9.md §3.40 (b)), with `sourceCardId`, `asCost` and `deckDiscardBy`'s source
 * as its cause.
 */
export function moveCardsTo(
  ctx: Ctx,
  ids: readonly InstanceId[],
  destination: CardDestination,
  into?: PlayerId,
  sourceCardId?: CardId,
  deckDiscardBy: DeckDiscarder = { sourceInstanceId: null },
  asCost = false,
): void {
  const inPlay = new Set(cardsInPlay(ctx.state));
  const shuffleOwners = new Set<PlayerId>();
  let shuffleEncounter = false;
  const scenarioDecksToShuffle = new Set<string>();
  const separateDecks = new Map<string, { readonly playerId: PlayerId; readonly name: string }>();
  // A scenario deck closed to player card effects (the show deck, docs/phase7-wave6.md §3.66): a player card's ability
  // moves no card out of it, into it or within it. Each refused deck is logged once, with the cards left where they were.
  const refused = new Map<string, InstanceId[]>();
  const anyClosed =
    sourceCardId !== undefined && Object.values(ctx.state.scenarioDecks).some((deck) => deck.closedToPlayerCards);
  const closedDeckFor = (id: InstanceId): string | null => {
    if (!anyClosed) return null;
    const at = locateCard(ctx.state, id);
    if (at?.kind === "scenarioDeck" && closedToPlayerCard(ctx.state, at.name, sourceCardId)) return at.name;
    const home = getInstance(ctx.state, id)?.home;
    const into =
      typeof destination === "object" && "scenarioDeck" in destination
        ? destination.scenarioDeck
        : destination === "scenarioDeckShuffle" && home?.kind === "scenarioDeck"
          ? home.name
          : null;
    return into !== null && closedToPlayerCard(ctx.state, into, sourceCardId) ? into : null;
  };
  for (const id of ids) {
    const instance = getInstance(ctx.state, id);
    if (!instance) continue;
    const closed = closedDeckFor(id);
    if (closed !== null) {
      refused.set(closed, [...(refused.get(closed) ?? []), id]);
      continue;
    }
    if (inPlay.has(id) && permanentStopsLeaving(ctx.state, ctx.deps, id, sourceCardId)) {
      emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "permanent" });
      continue;
    }
    // Likewise a card that "cannot leave play" (one limited to card abilities: when a card's ability moves it,
    // docs/phase7-wave7.md §3.10): refused here, so the face and home a moved card is given below are not set on it.
    if (inPlay.has(id) && cannotLeavePlay(ctx.state, ctx.deps, id, sourceCardId, isDiscardDestination(destination))) {
      emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "cannotLeavePlay" });
      continue;
    }
    // "When X leaves play" interrupts resolve before it moves (docs/phase7-wave5.md §4.1 Q17): this card's move waits,
    // whole, for its `cardLeavesPlay` to apply (`applyLeavingPlay` runs it again for this one card).
    if (inPlay.has(id)) {
      const request: LeaveRequest = {
        kind: "moveCards",
        destination,
        ...(into !== undefined ? { into } : {}),
        ...(sourceCardId !== undefined ? { sourceCardId } : {}),
        ...(asCost ? { asCost: true as const } : {}),
      };
      if (waitsForLeaveInterrupts(ctx, id, request, moveDestinationKind(ctx.state, ctx.deps, id, destination)))
        continue;
    }
    // "Put it faceup into The Collection" (docs/phase7-wave3.md §3.14): out of play, faceup, in the order they entered.
    if (typeof destination === "object" && "scenarioArea" in destination) {
      const area: ZoneId = { kind: "scenarioArea", name: destination.scenarioArea };
      if (inPlay.has(id)) leavePlay(ctx, id, area, "bottom", false, undefined, sourceCardId, asCost);
      else moveCard(ctx, id, area, "bottom");
      updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
      continue;
    }
    // `into` (docs/phase7-wave5.md §3.5): that player's zones, whoever owns the card.
    const owner = into ?? instance.ownerId;
    let to: ZoneId;
    let position: "top" | "bottom" = "top";
    if (typeof destination === "object") {
      // A named scenario deck, from anywhere (docs/phase7-wave6.md §3.66). A deck the game does not have moves nothing.
      const name = destination.scenarioDeck;
      const piles = ctx.state.scenarioDecks[name];
      if (!piles) continue;
      to = { kind: "scenarioDeck", name };
      position = destination.at === "top" ? "top" : "bottom";
      if (destination.at === "shuffle") scenarioDecksToShuffle.add(name);
    } else
      switch (destination) {
        case "hand":
          if (!owner) continue;
          to = { kind: "hand", playerId: owner };
          position = "bottom";
          break;
        case "discard":
          to = into ? { kind: "discard", playerId: into } : discardZoneFor(ctx.state, id);
          break;
        case "deckTop":
        case "deckBottom":
        case "deckShuffle":
          if (!owner) continue;
          to = { kind: "deck", playerId: owner };
          position = destination === "deckTop" ? "top" : "bottom";
          if (destination === "deckShuffle") shuffleOwners.add(owner);
          break;
        case "removedFromGame":
          to = { kind: "removedFromGame" };
          break;
        case "victoryDisplay":
          // docs/phase7-wave7.md §3.49: the shared display, in arrival order. A card in play leaves play below without
          // being defeated (RRG 1.8 "Leaves Play", p. 27); one already there is left alone.
          if (ctx.state.victoryDisplay.includes(id)) continue;
          to = { kind: "victoryDisplay" };
          position = "bottom";
          break;
        case "encounterSetAside":
          to = { kind: "encounterSetAside" };
          break;
        case "setAside":
          // "Set this card aside, out of play" on a player card (Death-Glow, docs/phase7-wave4.md §3.22): its owner's
          // set-aside area, where "the set-aside Death-Glow" is found again (`CardSelector setAside`).
          if (!owner) continue;
          to = { kind: "setAside", playerId: owner };
          position = "bottom";
          break;
        case "scenarioDeckShuffle": {
          // docs/phase7-wave4.md §3.49: back into the shared scenario deck it belongs to.
          if (instance.home.kind !== "scenarioDeck" || !ctx.state.scenarioDecks[instance.home.name]) continue;
          to = { kind: "scenarioDeck", name: instance.home.name };
          scenarioDecksToShuffle.add(instance.home.name);
          break;
        }
        case "encounterDeckShuffle": {
          const deckId = activeEncounterDeckId(ctx.state);
          to = { kind: "encounterDeck", deckId };
          shuffleEncounter = true;
          // "Shuffle this card into the encounter deck" on a player card (the Cosmic Entities, docs/phase7-wave4.md
          // §3.14): it keeps its owner but joins the active villain's encounter deck (ruling, Jan 17, 2026 (5)), so it
          // discards to that encounter discard pile (FAQ, RRG 1.8 p. 62: a Cosmic Entity resolved as a boost card "is
          // placed in the encounter deck discard pile") and, controlled by nobody, its "you" is the revealing player.
          if (owner)
            updateInstance(ctx, id, (i) => ({ ...i, controllerId: null, home: { kind: "encounterDeck", deckId } }));
          break;
        }
        case "separateDiscard":
        case "separateDeckTop":
        case "separateDeckShuffle": {
          if (
            instance.home.kind !== "separateDeck" ||
            !owner ||
            !getPlayer(ctx.state, owner)?.separateDecks[instance.home.name]
          )
            continue;
          const name = instance.home.name;
          to =
            destination === "separateDiscard"
              ? { kind: "separateDiscard", playerId: owner, name }
              : { kind: "separateDeck", playerId: owner, name };
          if (destination !== "separateDiscard") separateDecks.set(`${owner}/${name}`, { playerId: owner, name });
          break;
        }
      }
    const discarding = destination === "discard" || destination === "separateDiscard";
    // Discard piles are faceup; a separate deck's faces are set below (`syncSeparateDeckTop`). Turned faceup before the
    // move, because a move that empties the deck resets it at once (`settlePlayerDecks`), and this card may be in the
    // new deck by the time the move returns.
    // An encounter card from the encounter deck into a player's discard pile is faceup there (MC27 p. 13; §3.5 of
    // docs/phase7-wave5.md).
    // The victory display is faceup too, like the other open out-of-play areas.
    if (discarding || destination === "victoryDisplay") updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
    if (inPlay.has(id)) leavePlay(ctx, id, to, position, discarding, undefined, sourceCardId, asCost);
    else {
      // From a player's deck to that player's discard pile: a discard from the top of the deck (docs/phase7-wave7.md
      // §3.55), whichever card's effect this is. Looked for when an ability hears one or keeps a set of these cards.
      const fromDeckOf =
        to.kind === "discard" &&
        (deckDiscardBy.boundOn !== undefined || listensForDeckDiscard(ctx.deps)) &&
        getPlayer(ctx.state, to.playerId)?.deck.includes(id) === true
          ? to.playerId
          : null;
      // A tucked card sent to a discard pile is a discard "from under" its host (docs/phase7-wave9.md §3.40 (b)),
      // an effect's and a cost's alike; the host is read before the move, and only when an ability hears one.
      const tuckedUnder = discarding ? tuckedHostToRecord(ctx, id) : null;
      moveCard(ctx, id, to, position);
      if (fromDeckOf !== null) recordDeckDiscard(ctx, fromDeckOf, id, deckDiscardBy);
      recordTuckedDiscard(ctx, id, tuckedUnder, {
        sourceInstanceId: deckDiscardBy.sourceInstanceId,
        ...(sourceCardId !== undefined ? { sourceCardId } : {}),
        asCost,
      });
    }
    // Once it is in a named scenario deck (a card that cannot leave play is not), that deck is its home when it has a
    // discard pile of its own or none, as `buildScenarioDeck` makes it; a card of an `encounter` deck keeps the home it
    // has. Nobody controls a card in a scenario deck.
    if (
      typeof destination === "object" &&
      ctx.state.scenarioDecks[destination.scenarioDeck]?.deck.includes(id) &&
      ctx.state.scenarioDecks[destination.scenarioDeck]?.discardPile !== "encounter"
    ) {
      const home = { kind: "scenarioDeck" as const, name: destination.scenarioDeck };
      updateInstance(ctx, id, (i) => ({ ...i, controllerId: null, home }));
    }
    // A deck whose top card is in play is made of one face of its cards: a card put into it shows that face ("flip it
    // and place it on the bottom of the Holding Cell deck"; docs/phase7-wave9.md §3.17).
    if (typeof destination === "object") showScenarioDeckFace(ctx, id, destination.scenarioDeck);
    const keepsFace =
      typeof destination === "string" &&
      ["discard", "separateDiscard", "removedFromGame", "setAside", "victoryDisplay"].includes(destination);
    if (!keepsFace) {
      updateInstance(ctx, id, (i) => ({ ...i, faceup: destination === "hand" ? i.faceup : false }));
    }
  }
  if (sourceCardId !== undefined)
    for (const [name, instanceIds] of refused)
      emit(ctx, { type: "scenarioDeckClosed", name, sourceCardId, instanceIds });
  for (const owner of shuffleOwners) {
    const order = shuffleZone(ctx, { kind: "deck", playerId: owner }, mustPlayer(ctx.state, owner).deck);
    updatePlayer(ctx, owner, (p) => ({ ...p, deck: order }));
    announceDeckTops(ctx);
  }
  if (shuffleEncounter) shuffleEncounterDeck(ctx);
  for (const name of scenarioDecksToShuffle) {
    const piles = ctx.state.scenarioDecks[name];
    if (!piles) continue;
    const order = shuffleZone(ctx, { kind: "scenarioDeck", name }, piles.deck);
    ctx.state = { ...ctx.state, scenarioDecks: { ...ctx.state.scenarioDecks, [name]: { ...piles, deck: order } } };
  }
  for (const { playerId, name } of separateDecks.values()) {
    if (destination === "separateDeckShuffle") shuffleSeparateDeck(ctx, playerId, name);
    else syncSeparateDeckTop(ctx, playerId, name);
  }
  // A card put under a deck whose top card is in play, with no card left in it, is its top card and enters play at
  // once (MC50 p. 22; docs/phase7-wave9.md §3.17); so does the next card when this move took the top card out of play.
  settleScenarioDeckTops(ctx);
}

/** Shuffles an identity's separate deck, then shows its top card as its rules say. */
export function shuffleSeparateDeck(ctx: Ctx, playerId: PlayerId, name: string): void {
  const piles = separateDeckOf(ctx.state, playerId, name);
  const order = shuffleZone(ctx, { kind: "separateDeck", playerId, name }, piles.deck);
  updatePlayer(ctx, playerId, (p) => ({
    ...p,
    separateDecks: { ...p.separateDecks, [name]: { ...piles, deck: order } },
  }));
  syncSeparateDeckTop(ctx, playerId, name);
}

/** Shuffles a scenario deck (docs/phase7-wave2.md §3.3). */
export function shuffleScenarioDeck(ctx: Ctx, name: string): void {
  const piles = ctx.state.scenarioDecks[name];
  if (!piles) return;
  const order = shuffleZone(ctx, { kind: "scenarioDeck", name }, piles.deck);
  ctx.state = { ...ctx.state, scenarioDecks: { ...ctx.state.scenarioDecks, [name]: { ...piles, deck: order } } };
}

/**
 * `EffectSpec buildScenarioDeck`: the matching cards of each `from` area (default the encounter deck) move into the
 * scenario deck, which is shuffled. `"setAside"` searches `GameState.encounterSetAside` (docs/phase7-wave6.md §3.24).
 */
export function buildScenarioDeck(
  ctx: Ctx,
  name: string,
  from: readonly ScenarioDeckSource[] = ["encounterDeck"],
): void {
  const piles = ctx.state.scenarioDecks[name];
  if (!piles) return;
  const matches = (id: InstanceId): boolean => {
    const card = cardOf(ctx.state, id);
    return card !== undefined && scenarioDeckIsMadeOf(ctx.state, name, card.id);
  };
  const candidates: InstanceId[] = [];
  for (const source of from) {
    if (source === "setAside") candidates.push(...ctx.state.encounterSetAside);
    else for (const deckId of ctx.state.encounterDeckOrder) candidates.push(...encounterDeckOf(ctx.state, deckId).deck);
  }
  for (const id of candidates) {
    if (!matches(id)) continue;
    moveCard(ctx, id, { kind: "scenarioDeck", name });
    // A deck with a discard pile of its own, or with none (the show deck), is its cards' home.
    if (piles.discardPile !== "encounter")
      updateInstance(ctx, id, (i) => ({ ...i, home: { kind: "scenarioDeck", name } }));
  }
  shuffleScenarioDeck(ctx, name);
  // "The top card of this deck is in play" (MC50 p. 13; docs/phase7-wave9.md §3.17): it enters play as the deck is made.
  settleScenarioDeckTops(ctx);
}

/**
 * `whenEmpty: "reshuffleDiscardWithoutPenalty"` (the Red Skull rulebook, p. 15: "If the side-scheme deck is ever empty,
 * shuffle the side-scheme discard pile into the side-scheme deck. There is no penalty for doing this."), checked
 * between frames as the Invocation deck's is. A `remainsEmpty` deck stays empty.
 */
export function resetEmptyScenarioDecks(ctx: Ctx): void {
  for (const [name, piles] of Object.entries(ctx.state.scenarioDecks)) {
    if (piles.whenEmpty !== "reshuffleDiscardWithoutPenalty" || piles.deck.length > 0 || piles.discard.length === 0)
      continue;
    // A deck whose top card is in play is not empty while that card is its top card (docs/phase7-wave9.md §3.17).
    if (piles.inPlayTopId !== undefined) continue;
    for (const id of [...piles.discard]) {
      moveCard(ctx, id, { kind: "scenarioDeck", name });
      updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
    }
    shuffleScenarioDeck(ctx, name);
    emit(ctx, { type: "scenarioDeckReset", name });
  }
}

/**
 * Announces each deck that ran out since the last look (`TriggerEvent deckRanOut`, docs/phase7-wave4.md §3.11), oldest
 * first, when an ability listens, and empties the list. Returns true when it pushed a frame.
 */
export function announceDeckRunOuts(ctx: Ctx): boolean {
  const pending = ctx.state.pendingDeckRunOuts;
  if (!pending || pending.length === 0) return false;
  const { pendingDeckRunOuts: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events: TriggerEvent[] = pending
    .map((run): TriggerEvent =>
      run.deck === "player"
        ? { kind: "deckRanOut", deck: "player", playerId: run.playerId }
        : run.deck === "encounter"
          ? { kind: "deckRanOut", deck: "encounter", deckId: run.deckId }
          : { kind: "deckRanOut", deck: "scenario", name: run.name },
    )
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  // Pushed last-first so the oldest resolves first.
  for (const event of [...events].reverse()) announce(ctx, event);
  return true;
}

/**
 * Whether an encounter deck's reset is waiting to be announced to an ability in play that hears it ("After the
 * encounter deck resets", Wheel of Genres). RRG 1.8 "Encounter Deck" (p. 17): "If the encounter deck empties during the
 * resolution of any other type of game effect (for example, the dealing of encounter cards), that effect finishes
 * resolving after the encounter deck has been reset." Owner decision, 2026-10-03 (docs/phase7-wave6.md §4.1 Q58): the
 * response to the reset resolves right after the reset, in the middle of that effect — dealing 4 cards with 2 left
 * deals 2, resets, resolves the Forced Response, and only then deals cards 3 and 4 from the new deck.
 *
 * An effect or step that takes several encounter cards asks this after each card and, with cards still to take, saves
 * how far it got and returns: the flow announces the reset (`announceDeckRunOuts`) and then runs it again from there.
 * False when nothing in play listens, so such a game resolves, and logs, exactly as before.
 */
export function encounterResetAwaitsResponse(ctx: Ctx): boolean {
  if (ctx.state.outcome) return false;
  return (ctx.state.pendingDeckRunOuts ?? []).some(
    (run) =>
      run.deck === "encounter" &&
      heard(ctx.state, ctx.deps, { kind: "deckRanOut", deck: "encounter", deckId: run.deckId }),
  );
}

/** How many of its encounter cards a paused effect has taken (`eachEncounterCard`); absent when it is not paused. */
const ENCOUNTER_CARDS_TAKEN_VAR = "$encounterCardsTaken";

/**
 * Runs `take(index)` for each of the `total` encounter cards effect `frame.cursor` of `frame` takes, pausing after a
 * card whose move reset the encounter deck when a response to the reset is waiting and cards remain
 * (`encounterResetAwaitsResponse`): the frame is put back on this effect with the cards taken so far recorded, and the
 * flow runs it again once the response has resolved. `frame` is the frame as it was before the effect's cursor moved
 * on. Returns false when it paused.
 */
export function eachEncounterCard(
  ctx: Ctx,
  frame: Frame<"effects">,
  total: number,
  take: (index: number) => void,
): boolean {
  const from = frame.vars[ENCOUNTER_CARDS_TAKEN_VAR] ?? 0;
  if (from > 0) {
    updateFrame(ctx, frame.frameId, (f) => {
      if (f.kind !== "effects") return f;
      const { [ENCOUNTER_CARDS_TAKEN_VAR]: _, ...vars } = f.vars;
      return { ...f, vars };
    });
  }
  for (let index = from; index < total; index++) {
    take(index);
    if (ctx.state.outcome) return true;
    if (index + 1 < total && encounterResetAwaitsResponse(ctx)) {
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects"
          ? {
              ...f,
              cursor: frame.cursor,
              answer: frame.answer,
              vars: { ...f.vars, [ENCOUNTER_CARDS_TAKEN_VAR]: index + 1 },
            }
          : f,
      );
      return false;
    }
  }
  return true;
}

type EncounterCardFromPlayerDeck = Extract<TriggerEvent, { kind: "encounterCardFromPlayerDeck" }>;

/**
 * Announces each encounter card that left a player's deck since the last look (`TriggerEvent
 * encounterCardFromPlayerDeck`, docs/phase7-wave5.md §3.5), and empties the list. Every card of one draw is announced
 * after the draw (MC27 p. 21 FAQ); pushed last-first so the oldest resolves first. Each is announced whether or not an
 * ability listens, because its apply step is the engine's fallback when nothing replaced it
 * (`dealUnhandledEncounterCard`, §4.1 Q4). A card no longer where it went is skipped. Returns true when it pushed a
 * frame.
 */
export function announceEncounterCardsFromDecks(ctx: Ctx): boolean {
  const pending = ctx.state.pendingEncounterFromDeck;
  if (!pending || pending.length === 0) return false;
  const { pendingEncounterFromDeck: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events = pending
    .map((left): EncounterCardFromPlayerDeck => ({ kind: "encounterCardFromPlayerDeck", ...left }))
    .filter((event) => stillWhereItWent(ctx, event));
  if (events.length === 0) return false;
  for (const event of [...events].reverse()) pushEvent(ctx, event);
  return true;
}

/**
 * Announces each card that entered a player's hand since the last look (`TriggerEvent cardEntersHand`,
 * docs/phase7-wave6.md §3.10), when an ability hears it, and empties the list; pushed last-first so the oldest resolves
 * first. The flow looks here before `announceEncounterCardsFromDecks`, so when one draw records both, this frame sits
 * under that one and resolves after the draw's fallback: a card it dealt away has left the hand and answers nothing. A
 * card no longer in that hand is skipped. Returns true when it pushed a frame.
 */
export function announceCardsEnteredHand(ctx: Ctx): boolean {
  const pending = ctx.state.pendingEnteredHand;
  if (!pending || pending.length === 0) return false;
  const { pendingEnteredHand: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events = pending
    .map((entered): TriggerEvent => ({ kind: "cardEntersHand", ...entered }))
    .filter((event) => {
      if (event.kind !== "cardEntersHand") return false;
      const zone = locateCard(ctx.state, event.instanceId);
      return zone?.kind === "hand" && zone.playerId === event.playerId && heard(ctx.state, ctx.deps, event);
    });
  if (events.length === 0) return false;
  for (const event of [...events].reverse()) pushEvent(ctx, event);
  return true;
}

/** An encounter card drawn is still in that player's hand; one discarded, still in a discard pile. */
function stillWhereItWent(ctx: Ctx, event: EncounterCardFromPlayerDeck): boolean {
  const zone = locateCard(ctx.state, event.instanceId);
  if (!zone) return false;
  if (event.how === "draw") return zone.kind === "hand" && zone.playerId === event.playerId;
  return (zone.kind === "discard" && zone.playerId === event.playerId) || zone.kind === "encounterDiscard";
}

/** The encounter card types a player can be dealt (not a villain or main scheme, which are never in the deck). */
const DEALABLE_TYPES: ReadonlySet<string> = new Set([
  "attachment",
  "environment",
  "minion",
  "obligation",
  "side_scheme",
  "treachery",
]);

/**
 * `dealAsEncounterCard`: each card of a dealable type goes facedown in front of `playerId`, at the back of the queue
 * that player reveals (RRG 1.8 "Deal, Deal an Encounter Card", p. 15), to be revealed with their dealt encounter cards.
 * Returns the cards dealt.
 *
 * A card in play is dealt from play (docs/phase7-wave8.md §3.75): being dealt is how it leaves play (`leavePlay`:
 * attachments, tucked cards and boost cards discarded, a permanent player attachment unattached, damage, counters,
 * status cards and engagement cleared, any "when this leaves play" window first; RRG 1.8 "Leaves Play", p. 27). It is
 * not defeated and not discarded: no When Defeated ability, no victory display, no discard logged or heard. A card that
 * cannot leave play (permanent, "cannot leave play"; `sourceCardId` is the dealing ability's card, for the Permanent
 * keyword's same-set exception) is not dealt and stays as it is. The same path deals a card already defeated and
 * waiting to leave play after its When Defeated abilities ("When Defeated: Deal this card to the player who defeated
 * it as a facedown encounter card"; RRG 1.8 "When Defeated Abilities", p. 48). Revealed later, the card enters play as
 * a new card (RRG 1.8 "In Play and Out of Play", p. 23: facedown dealt encounter cards are out of play).
 */
export function dealAsEncounterCards(
  ctx: Ctx,
  ids: readonly InstanceId[],
  playerId: PlayerId,
  sourceCardId?: CardId,
): readonly InstanceId[] {
  const inPlay = new Set(cardsInPlay(ctx.state));
  const dealt: InstanceId[] = [];
  for (const id of ids) {
    const type = cardOf(ctx.state, id)?.type;
    if (!type || !DEALABLE_TYPES.has(type)) continue;
    if (inPlay.has(id)) {
      const to: ZoneId = { kind: "dealtEncounter", playerId };
      if (leavePlay(ctx, id, to, "bottom", false, { faceup: false }, sourceCardId) !== "stayed") dealt.push(id);
      continue;
    }
    updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
    moveCard(ctx, id, { kind: "dealtEncounter", playerId });
    recordEncounterCardDealt(ctx, playerId, id, "ability");
    dealt.push(id);
  }
  return dealt;
}

/**
 * `passEncounterCard` (docs/phase7-wave8.md §3.75): each card facedown among `from`'s dealt encounter cards goes to the
 * back of `to`'s, still facedown (RRG 1.8 "Deal, Deal an Encounter Card", p. 15: the queue a player reveals in the
 * order the cards came to them). A card whose reveal has begun is no longer a facedown card to pass (it is parked in
 * that zone while it resolves, `revealFrame`; a surge's card passed before its reveal begins, `afterDeal`, is no longer
 * in front of the surging player, so the surge does not reveal it). Out of play before and after, so nothing leaves or enters play.
 * Returns the cards passed.
 */
export function passEncounterCards(
  ctx: Ctx,
  ids: readonly InstanceId[],
  from: PlayerId,
  to: PlayerId,
): readonly InstanceId[] {
  if (from === to) return [];
  const passed: InstanceId[] = [];
  for (const id of ids) {
    if (!mustPlayer(ctx.state, from).dealtEncounter.includes(id)) continue;
    if (mustInstance(ctx.state, id).faceup) continue;
    if (ctx.state.stack.some((f) => f.kind === "reveal" && f.instanceId === id && !f.afterDeal)) continue;
    moveCard(ctx, id, { kind: "dealtEncounter", playerId: to });
    emit(ctx, { type: "encounterCardPassed", instanceId: id, fromPlayerId: from, toPlayerId: to });
    passed.push(id);
  }
  return passed;
}

/**
 * The apply step of `encounterCardFromPlayerDeck`: the engine's fallback for an encounter card drawn or discarded from a
 * player's deck that nothing replaced (maintainer ruling, docs/phase7-wave5.md §4.1 Q4), the handling Mysterio's main
 * scheme prints (`sm` 27087b/27088b: "deal it to yourself as a facedown encounter card → draw 1 card"). An interrupt
 * that dealt or moved the card leaves it no longer where the draw or discard put it, so this does nothing and nothing
 * happens twice. The replacement draw can find another encounter card, which is recorded and announced in turn. Setup
 * draws (the opening hand, the mulligan) are alike: RRG 1.8 "Ability" (pp. 4-5) bars only player card abilities during
 * setup, so an encounter card's forced interrupt such as Mysterio's resolves there too.
 */
export function dealUnhandledEncounterCard(ctx: Ctx, event: EncounterCardFromPlayerDeck): void {
  if (!stillWhereItWent(ctx, event)) return;
  // Mystique's treacheries (`RuleSpec staysInHand`, docs/phase7-wave6.md §3.10, §4.1 Q7; MC32 p. 7): drawn, the card
  // stays in the hand and nothing replaces it; discarded from the deck, it goes to the encounter discard pile.
  if (staysInHand(ctx.state, ctx.deps, event.instanceId)) {
    if (event.how === "discard") {
      const home = discardZoneFor(ctx.state, event.instanceId);
      if (locateCard(ctx.state, event.instanceId)?.kind !== home.kind) moveCard(ctx, event.instanceId, home, "top");
    }
    return;
  }
  if (dealAsEncounterCards(ctx, [event.instanceId], event.playerId).length === 0) return;
  drawCards(ctx, event.playerId, 1);
}

/**
 * Announces each facedown encounter card dealt to a player since the last look (`TriggerEvent encounterCardDealt`,
 * docs/phase7-wave9.md §3.12), when an ability hears it, and empties the list. The cards dealt since the last look
 * were dealt by one step or one effect (step three of the villain phase deals every player's card and the hazard
 * cards without a frame in between), so their events share one response window (RRG 1.8 "Triggering Condition",
 * p. 45), as cards leaving play from one step do. A card no longer among that player's dealt cards (revealed, passed
 * or moved since) is skipped. Returns true when it pushed a frame.
 */
export function announceEncounterCardsDealt(ctx: Ctx): boolean {
  const pending = ctx.state.pendingEncounterDealt;
  if (!pending || pending.length === 0) return false;
  const { pendingEncounterDealt: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events = pending
    .map((dealt): TriggerEvent => ({ kind: "encounterCardDealt", ...dealt }))
    .filter((event) => {
      if (event.kind !== "encounterCardDealt") return false;
      const zone = locateCard(ctx.state, event.instanceId);
      return zone?.kind === "dealtEncounter" && zone.playerId === event.playerId && heard(ctx.state, ctx.deps, event);
    });
  if (events.length === 0) return false;
  pushEventsSharingResponses(ctx, events);
  return true;
}

/**
 * Announces each card that left play since the last look (`TriggerEvent cardLeavesPlay`, docs/phase7-wave5.md §3.13),
 * when an ability listens, and empties the list; the oldest resolves first. Cards that left since the last look left
 * from one step, so their leavings share one response window (docs/phase7-wave5.md §4.1 Q33, Q49; RRG 1.8 "Triggering
 * Condition", p. 45), as they do when they waited for an interrupt window. Returns true when it pushed a frame.
 */
export function announceCardsLeftPlay(ctx: Ctx): boolean {
  const pending = ctx.state.pendingLeftPlay;
  if (!pending || pending.length === 0) return false;
  const { pendingLeftPlay: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events: TriggerEvent[] = pending
    .map((left): TriggerEvent => ({ kind: "cardLeavesPlay", ...left }))
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  pushEventsSharingResponses(ctx, events);
  return true;
}

/**
 * The apply step of a `cardLeavesPlay` that waited for its interrupts (docs/phase7-wave5.md §4.1 Q17): the move its
 * `leaving` describes happens now, after the interrupts and before the responses, through the same entry point that
 * waited (`leavePlay`, `moveCardsTo`, `defeatFromPlay`), which sees this frame applying and moves the card at once.
 * The event's `to` becomes where the card went, and `leaving` is dropped. Returns false, so no responses, when the card
 * did not leave here: an interrupt already moved it (a replacement, whose move was announced as its own leaving), or it
 * can no longer leave (permanent, "cannot leave play").
 */
export function applyLeavingPlay(ctx: Ctx, frame: Frame<"event">): boolean {
  const event = frame.event;
  if (event.kind !== "cardLeavesPlay" || !event.leaving) return true;
  const id = event.instanceId;
  const request = event.leaving;
  if (request.kind === "withHost") return applyLeavingWithHost(ctx, frame.frameId, request.step);
  const inPlay = cardsInPlay(ctx.state).includes(id);
  if (inPlay) {
    // Sent under a card by an interrupt (docs/phase7-wave9.md §3.20); with that card gone, the move it replaced.
    const move = request.kind === "tuck" && !tuckLeavingCard(ctx, id, request) ? request.replaced : request;
    switch (move.kind) {
      case "zone":
        leavePlay(
          ctx,
          id,
          move.zone,
          move.position,
          move.discarded,
          move.patch,
          move.sourceCardId,
          move.asCost === true,
        );
        break;
      case "moveCards":
        moveCardsTo(ctx, [id], move.destination, move.into, move.sourceCardId, undefined, move.asCost);
        break;
      case "defeat":
        defeatFromPlay(ctx, id, move.insteadTo, move.sourceCardId);
        break;
      case "tuck":
        break;
      case "swap":
        // The swap completes now: this card takes the other's place as the other enters play (§3.47 of wave 6).
        swapCards(ctx, id, move.with, move.sourceCardId);
        break;
    }
  }
  const left = inPlay && !cardsInPlay(ctx.state).includes(id);
  const where = locateCard(ctx.state, id);
  updateFrame(ctx, frame.frameId, (f) => {
    if (f.kind !== "event" || f.event.kind !== "cardLeavesPlay") return f;
    const { leaving: _, ...rest } = f.event;
    return { ...f, event: left && where ? { ...rest, to: where.kind } : rest };
  });
  return left;
}

/**
 * The apply step of a `withHost` leaving (docs/phase7-wave5.md §4.1 Q32): the card's interrupts resolved in its host's
 * window, and its host's move took it, recording where (`moved`, by `leaveNow`). A leaving that carries its host's
 * change (`step`: a villain removed, a stage flipped) runs it first. Returns false, so no responses, when the card did not
 * go with its host (the host stayed, or the card had already left on its own, announced then).
 */
function applyLeavingWithHost(ctx: Ctx, frameId: FrameId, step: HostStep | undefined): boolean {
  if (step) runHostStep(ctx, step);
  const now = findFrame(ctx.state, frameId);
  const leaving = now?.kind === "event" && now.event.kind === "cardLeavesPlay" ? now.event.leaving : undefined;
  const moved = leaving?.kind === "withHost" ? leaving.moved : undefined;
  updateFrame(ctx, frameId, (f) => {
    if (f.kind !== "event" || f.event.kind !== "cardLeavesPlay") return f;
    const { leaving: _, ...rest } = f.event;
    return { ...f, event: moved !== undefined ? { ...rest, to: moved } : rest };
  });
  return moved !== undefined;
}

/**
 * A cancelled `withHost` leaving that carries its host's change (`step`, docs/phase7-wave5.md §4.1 Q32): the change is
 * not what was cancelled, so it runs now, while the cancelled frame is still on the stack so that the change leaves this
 * card in play (`leavingCancelled`, §4.1 Q53). Returns whether it did (the frame is still on the stack, under whatever
 * the change pushed).
 */
export function runCarriedHostStep(ctx: Ctx, frame: Frame<"event">): boolean {
  const event = frame.event;
  if (event.kind !== "cardLeavesPlay" || event.leaving?.kind !== "withHost" || !event.leaving.step) return false;
  runHostStep(ctx, event.leaving.step);
  return true;
}

/**
 * The interrupts stage of the first of the `cardLeavesPlay` events waiting on top of the stack
 * (`waitsForLeaveInterrupts`, `waitsForHostStep`): every card leaving from the same step — the cards themselves and the
 * attachments leaving with them — shares one interrupt window, opened here over all their events, and one response
 * window, opened by the last of them (`pushEventsSharingResponses`' `responsesWith`). RRG 1.8 "Triggering Condition"
 * (p. 45): one occurrence's triggering conditions are "handled with a single interrupt window and a single response
 * window", in which abilities referring to any of them "may be used in any order"; forced interrupts come first and the
 * first player orders simultaneous ones ("Simultaneous Timing Priority", p. 5; "Simultaneous Resolution", p. 40; "First
 * Player", p. 19) — docs/phase7-wave5.md §4.1 Q32–Q33. Each card then moves in its own apply step, in the order asked,
 * with no window between them. Returns false for any other frame.
 */
export function openLeavingInterrupts(ctx: Ctx, frame: Frame<"event">): boolean {
  if (!isWaitingLeave(frame)) return false;
  const stack = ctx.state.stack;
  const start = stack.findIndex((f) => f.frameId === frame.frameId);
  let end = start + 1;
  while (end < stack.length && isWaitingLeave(stack[end])) end++;
  const batch = stack.slice(start, end).filter((f): f is Frame<"event"> => f.kind === "event");
  const last = batch[batch.length - 1]?.frameId;
  for (const member of batch) {
    emit(ctx, { type: "triggerEvent", event: member.event, phase: "initiated" });
    updateFrame(ctx, member.frameId, (f) =>
      f.kind !== "event"
        ? f
        : { ...f, stage: "apply", ...(last !== undefined && f.frameId !== last ? { responsesWith: last } : {}) },
    );
  }
  const [leader, ...others] = batch;
  if (leader && batch.some((member) => hasCandidates(ctx.state, ctx.deps, member.event, "interrupt"))) {
    pushWindow(
      ctx,
      leader.event,
      "interrupt",
      leader.frameId,
      others.map((other) => other.event),
      others.map((other) => other.frameId),
    );
  }
  return true;
}

/**
 * The `withHost` leavings of the attachments an event's apply step takes out of play with its card, for events whose
 * card does not leave through `leavePlay`: a villain's last stage defeated while others remain, which removes it from
 * the game (`removeDefeatedVillain`; docs/phase7-wave5.md §4.1 Q32). Put on the stack just under the event, their
 * interrupts already in its window (so at their apply stage), sharing one response window among themselves; returned
 * for the window. None for any other event, or with nothing listening.
 */
export function leavingWithHostFrames(ctx: Ctx, frame: Frame<"event">): readonly Frame<"event">[] {
  const event = frame.event;
  if (event.kind !== "characterDefeated" || !villainDefeatRemoves(ctx.state, event.instanceId)) return [];
  const companions = leavingWithHost(ctx, event.instanceId, "leaveNow");
  if (companions.length === 0) return [];
  const built = companions.map((companion) => eventFrame(ctx, companion));
  const last = built[built.length - 1]?.frameId;
  const frames = built.flatMap((f): Frame<"event">[] =>
    f.kind === "event"
      ? [{ ...f, stage: "apply", ...(last !== undefined && f.frameId !== last ? { responsesWith: last } : {}) }]
      : [],
  );
  const stack = ctx.state.stack;
  const at = stack.findIndex((f) => f.frameId === frame.frameId) + 1;
  ctx.state = { ...ctx.state, stack: [...stack.slice(0, at), ...frames, ...stack.slice(at)] };
  for (const companion of frames) {
    emit(ctx, {
      type: "framePushed",
      frameId: companion.frameId,
      frame: companion.kind,
      description: describeFrame(companion),
    });
    emit(ctx, { type: "triggerEvent", event: companion.event, phase: "initiated" });
  }
  return frames;
}

/** Shuffles an encounter deck: "the encounter deck" is the active villain's. */
export function shuffleEncounterDeck(ctx: Ctx, deckId: EncounterDeckId = activeEncounterDeckId(ctx.state)): void {
  const order = shuffleZone(ctx, { kind: "encounterDeck", deckId }, encounterDeckOf(ctx.state, deckId).deck);
  ctx.state = {
    ...ctx.state,
    encounterDecks: { ...ctx.state.encounterDecks, [deckId]: { ...encounterDeckOf(ctx.state, deckId), deck: order } },
  };
}
