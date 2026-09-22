/** Card selectors and bulk card moves used by effects. */

import { type Ctx, emit, moveCard, syncSeparateDeckTop, updateInstance, updatePlayer } from "../ctx.js";
import { leavePlay, shuffleZone } from "../effects.js";
import type { EncounterDeckId, InstanceId, PlayerId } from "../ids.js";
import {
  activeEncounterDeckId,
  cardOf,
  discardZoneFor,
  encounterDeckOf,
  getInstance,
  getPlayer,
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
import type { CardDestination, CardSelector, TargetQuery } from "../spec.js";
import type { ZoneId } from "../state.js";

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
    case "ref":
      return filtered(
        resolveRef(state, selector.ref, context).filter((id) => getInstance(state, id) !== undefined),
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
      const claimed = new Set<InstanceId>();
      const found: InstanceId[] = [];
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
        ids.push(
          ...(selector.zones.includes("deck") ? deck : []),
          ...(selector.zones.includes("discard") ? piles.discard : []),
        );
      }
      return filtered(ids, selector.filter);
    }
    case "encounterSetAside": {
      const matching = [...filtered(state.encounterSetAside, selector.filter)];
      if (!selector.random) return matching;
      const count = Math.max(0, resolveValue(ctx.state, selector.random, context));
      const picked: InstanceId[] = [];
      for (let i = 0; i < count && matching.length > 0; i++) {
        const [index, rng] = nextInt(ctx.state.rng, matching.length);
        ctx.state = { ...ctx.state, rng };
        picked.push(matching[index] as InstanceId);
        matching.splice(index, 1);
      }
      return picked;
    }
    case "scenarioArea":
      return filtered(state.scenarioAreas?.[selector.name] ?? [], selector.filter);
    case "scenarioDeck": {
      const piles = state.scenarioDecks[selector.name];
      if (!piles) return [];
      const zones = selector.zones ?? ["deck"];
      const deck = selector.top
        ? piles.deck.slice(0, Math.max(0, resolveValue(state, selector.top, context)))
        : piles.deck;
      return filtered(
        [...(zones.includes("deck") ? deck : []), ...(zones.includes("discard") ? piles.discard : [])],
        selector.filter,
      );
    }
    case "setAside":
      return resolvePlayers(state, selector.player, context).flatMap((playerId) =>
        filtered(mustPlayer(state, playerId).setAside, selector.filter),
      );
    case "tucked":
      return resolveRef(state, selector.under, context).flatMap((id) => getInstance(state, id)?.tucked ?? []);
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
          // Random picks draw on the game's seeded RNG, so a replay picks the same cards.
          const count = Math.max(0, resolveValue(ctx.state, selector.random, context));
          const picked: InstanceId[] = [];
          for (let i = 0; i < count && matching.length > 0; i++) {
            const [index, rng] = nextInt(ctx.state.rng, matching.length);
            ctx.state = { ...ctx.state, rng };
            picked.push(matching[index] as InstanceId);
            matching.splice(index, 1);
          }
          matching = picked;
        }
        found.push(...(selector.topmostOnly ? matching.slice(0, 1) : matching));
      }
      return found;
    }
  }
}

/**
 * `moveCards`: out-of-play cards move directly; cards in play leave play (attachments discarded, state cleared). The
 * `separate…` destinations follow each card's `home` separate deck and skip any other card.
 */
export function moveCardsTo(ctx: Ctx, ids: readonly InstanceId[], destination: CardDestination): void {
  const inPlay = new Set(cardsInPlay(ctx.state));
  const shuffleOwners = new Set<PlayerId>();
  let shuffleEncounter = false;
  const separateDecks = new Map<string, { readonly playerId: PlayerId; readonly name: string }>();
  for (const id of ids) {
    const instance = getInstance(ctx.state, id);
    if (!instance) continue;
    // "Put it faceup into The Collection" (docs/phase7-wave3.md §3.14): out of play, faceup, in the order they entered.
    if (typeof destination === "object") {
      const area: ZoneId = { kind: "scenarioArea", name: destination.scenarioArea };
      if (inPlay.has(id)) leavePlay(ctx, id, area, "bottom");
      else moveCard(ctx, id, area, "bottom");
      updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
      continue;
    }
    const owner = instance.ownerId;
    let to: ZoneId;
    let position: "top" | "bottom" = "top";
    switch (destination) {
      case "hand":
        if (!owner) continue;
        to = { kind: "hand", playerId: owner };
        position = "bottom";
        break;
      case "discard":
        to = discardZoneFor(ctx.state, id);
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
      case "encounterDeckShuffle":
        if (owner) continue;
        to = { kind: "encounterDeck", deckId: activeEncounterDeckId(ctx.state) };
        shuffleEncounter = true;
        break;
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
    if (inPlay.has(id)) leavePlay(ctx, id, to, position, discarding);
    else moveCard(ctx, id, to, position);
    // Discard piles are faceup; a separate deck's faces are set below (`syncSeparateDeckTop`).
    if (destination === "separateDiscard") updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
    else if (destination !== "discard" && destination !== "removedFromGame") {
      updateInstance(ctx, id, (i) => ({ ...i, faceup: destination === "hand" ? i.faceup : false }));
    }
  }
  for (const owner of shuffleOwners) {
    const order = shuffleZone(ctx, { kind: "deck", playerId: owner }, mustPlayer(ctx.state, owner).deck);
    updatePlayer(ctx, owner, (p) => ({ ...p, deck: order }));
  }
  if (shuffleEncounter) shuffleEncounterDeck(ctx);
  for (const { playerId, name } of separateDecks.values()) {
    if (destination === "separateDeckShuffle") shuffleSeparateDeck(ctx, playerId, name);
    else syncSeparateDeckTop(ctx, playerId, name);
  }
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

/** `EffectSpec buildScenarioDeck`: the matching encounter-deck cards move into the scenario deck, which is shuffled. */
export function buildScenarioDeck(ctx: Ctx, name: string): void {
  const piles = ctx.state.scenarioDecks[name];
  if (!piles) return;
  const { encounterSetIds, cardType } = piles.contents;
  for (const deckId of ctx.state.encounterDeckOrder) {
    for (const id of [...encounterDeckOf(ctx.state, deckId).deck]) {
      const card = cardOf(ctx.state, id);
      if (!card) continue;
      if (cardType !== undefined && card.type !== cardType) continue;
      if (
        encounterSetIds !== undefined &&
        !("encounterSetIds" in card && card.encounterSetIds.some((set: string) => encounterSetIds.includes(set)))
      )
        continue;
      moveCard(ctx, id, { kind: "scenarioDeck", name });
      if (piles.discardPile === "own") updateInstance(ctx, id, (i) => ({ ...i, home: { kind: "scenarioDeck", name } }));
    }
  }
  shuffleScenarioDeck(ctx, name);
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
    for (const id of [...piles.discard]) {
      moveCard(ctx, id, { kind: "scenarioDeck", name });
      updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
    }
    shuffleScenarioDeck(ctx, name);
    emit(ctx, { type: "scenarioDeckReset", name });
  }
}

/** Shuffles an encounter deck: "the encounter deck" is the active villain's. */
export function shuffleEncounterDeck(ctx: Ctx, deckId: EncounterDeckId = activeEncounterDeckId(ctx.state)): void {
  const order = shuffleZone(ctx, { kind: "encounterDeck", deckId }, encounterDeckOf(ctx.state, deckId).deck);
  ctx.state = {
    ...ctx.state,
    encounterDecks: { ...ctx.state.encounterDecks, [deckId]: { ...encounterDeckOf(ctx.state, deckId), deck: order } },
  };
}
