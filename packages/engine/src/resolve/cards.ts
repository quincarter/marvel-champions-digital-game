/** Card selectors and bulk card moves used by effects. */

import { type Ctx, moveCard, updateInstance, updatePlayer } from "../ctx.js";
import { leavePlay, shuffleZone } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { getInstance, mustPlayer } from "../query.js";
import { nextInt } from "../rng.js";
import { cardsInPlay, type EffectContext, matchesQuery, resolvePlayers, resolveRef, resolveValue } from "../select.js";
import type { CardDestination, CardSelector, TargetQuery } from "../spec.js";
import type { ZoneId } from "../state.js";

/** The cards a selector names right now (out of play included), in zone order. */
export function selectCards(ctx: Ctx, selector: CardSelector, context: EffectContext): readonly InstanceId[] {
  const state = ctx.state;
  const filtered = (ids: readonly InstanceId[], filter: TargetQuery | undefined): readonly InstanceId[] =>
    filter ? ids.filter((id) => matchesQuery(state, id, filter, context)) : ids;
  switch (selector.kind) {
    case "ref":
      return filtered(resolveRef(state, selector.ref, context).filter((id) => getInstance(state, id) !== undefined), selector.filter);
    case "encounter": {
      let deck = state.encounterDeck;
      if (selector.top) deck = deck.slice(0, Math.max(0, resolveValue(state, selector.top, context)));
      const ids = [...(selector.zones.includes("deck") ? deck : []), ...(selector.zones.includes("discard") ? state.encounterDiscard : [])];
      return filtered(ids, selector.filter);
    }
    case "setAside":
      return resolvePlayers(state, selector.player, context).flatMap((playerId) => filtered(mustPlayer(state, playerId).setAside, selector.filter));
    case "tucked":
      return resolveRef(state, selector.under, context).flatMap((id) => getInstance(state, id)?.tucked ?? []);
    case "zone": {
      const found: InstanceId[] = [];
      for (const playerId of resolvePlayers(state, selector.player, context)) {
        const player = mustPlayer(state, playerId);
        let zone = selector.zone === "hand" ? player.hand : selector.zone === "deck" ? player.deck : player.discard;
        if (selector.top) zone = zone.slice(0, Math.max(0, resolveValue(state, selector.top, context)));
        let matching = [...filtered(zone, selector.filter)];
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

/** `moveCards`: out-of-play cards move directly; cards in play leave play (attachments discarded, state cleared). */
export function moveCardsTo(ctx: Ctx, ids: readonly InstanceId[], destination: CardDestination): void {
  const inPlay = new Set(cardsInPlay(ctx.state));
  const shuffleOwners = new Set<PlayerId>();
  let shuffleEncounter = false;
  for (const id of ids) {
    const instance = getInstance(ctx.state, id);
    if (!instance) continue;
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
        to = owner ? { kind: "discard", playerId: owner } : { kind: "encounterDiscard" };
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
        to = { kind: "encounterDeck" };
        shuffleEncounter = true;
        break;
    }
    if (inPlay.has(id)) leavePlay(ctx, id, to, position, destination === "discard");
    else moveCard(ctx, id, to, position);
    if (destination !== "discard" && destination !== "removedFromGame") {
      updateInstance(ctx, id, (i) => ({ ...i, faceup: destination === "hand" ? i.faceup : false }));
    }
  }
  for (const owner of shuffleOwners) {
    const order = shuffleZone(ctx, { kind: "deck", playerId: owner }, mustPlayer(ctx.state, owner).deck);
    updatePlayer(ctx, owner, (p) => ({ ...p, deck: order }));
  }
  if (shuffleEncounter) shuffleEncounterDeck(ctx);
}

export function shuffleEncounterDeck(ctx: Ctx): void {
  const order = shuffleZone(ctx, { kind: "encounterDeck" }, ctx.state.encounterDeck);
  ctx.state = { ...ctx.state, encounterDeck: order };
}
