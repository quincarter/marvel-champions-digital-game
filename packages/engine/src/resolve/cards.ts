/** Card selectors and bulk card moves used by effects. */

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
  defeatFromPlay,
  drawCards,
  isWaitingLeave,
  leavePlay,
  leavingWithHost,
  moveDestinationKind,
  permanentStopsLeaving,
  shuffleZone,
  waitsForLeaveInterrupts,
} from "../effects.js";
import type { EncounterDeckId, FrameId, InstanceId, PlayerId } from "../ids.js";
import {
  activeEncounterDeckId,
  cardOf,
  discardZoneFor,
  encounterDeckOf,
  getInstance,
  getPlayer,
  locateCard,
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
import type { HostStep, LeaveRequest, TriggerEvent } from "../trigger-events.js";
import { describeFrame } from "../stack.js";
import { announce, eventFrame, type Frame, pushEvent } from "./frames.js";
import { villainDefeatRemoves } from "./defeat.js";
import { runHostStep } from "./host-step.js";
import { hasCandidates } from "./triggers.js";
import { pushWindow } from "./window.js";
import { heard } from "./triggers.js";

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
 * docs/phase7-wave5.md §4.1 Q46).
 */
export function moveCardsTo(
  ctx: Ctx,
  ids: readonly InstanceId[],
  destination: CardDestination,
  into?: PlayerId,
  sourceCardId?: CardId,
): void {
  const inPlay = new Set(cardsInPlay(ctx.state));
  const shuffleOwners = new Set<PlayerId>();
  let shuffleEncounter = false;
  const scenarioDecksToShuffle = new Set<string>();
  const separateDecks = new Map<string, { readonly playerId: PlayerId; readonly name: string }>();
  for (const id of ids) {
    const instance = getInstance(ctx.state, id);
    if (!instance) continue;
    if (inPlay.has(id) && permanentStopsLeaving(ctx.state, ctx.deps, id, sourceCardId)) {
      emit(ctx, { type: "leavePlayBlocked", instanceId: id, reason: "permanent" });
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
      };
      if (waitsForLeaveInterrupts(ctx, id, request, moveDestinationKind(ctx.state, ctx.deps, id, destination)))
        continue;
    }
    // "Put it faceup into The Collection" (docs/phase7-wave3.md §3.14): out of play, faceup, in the order they entered.
    if (typeof destination === "object") {
      const area: ZoneId = { kind: "scenarioArea", name: destination.scenarioArea };
      if (inPlay.has(id)) leavePlay(ctx, id, area, "bottom", false, undefined, sourceCardId);
      else moveCard(ctx, id, area, "bottom");
      updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
      continue;
    }
    // `into` (docs/phase7-wave5.md §3.5): that player's zones, whoever owns the card.
    const owner = into ?? instance.ownerId;
    let to: ZoneId;
    let position: "top" | "bottom" = "top";
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
    if (discarding) updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
    if (inPlay.has(id)) leavePlay(ctx, id, to, position, discarding, undefined, sourceCardId);
    else moveCard(ctx, id, to, position);
    const keepsFace = ["discard", "separateDiscard", "removedFromGame", "setAside"].includes(destination);
    if (!keepsFace) {
      updateInstance(ctx, id, (i) => ({ ...i, faceup: destination === "hand" ? i.faceup : false }));
    }
  }
  for (const owner of shuffleOwners) {
    const order = shuffleZone(ctx, { kind: "deck", playerId: owner }, mustPlayer(ctx.state, owner).deck);
    updatePlayer(ctx, owner, (p) => ({ ...p, deck: order }));
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
  const { encounterSetIds, cardType, trait } = piles.contents;
  for (const deckId of ctx.state.encounterDeckOrder) {
    for (const id of [...encounterDeckOf(ctx.state, deckId).deck]) {
      const card = cardOf(ctx.state, id);
      if (!card) continue;
      if (cardType !== undefined && card.type !== cardType) continue;
      if (trait !== undefined && !("traits" in card && (card.traits as readonly string[]).includes(trait))) continue;
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
        : { kind: "deckRanOut", deck: "scenario", name: run.name },
    )
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  // Pushed last-first so the oldest resolves first.
  for (const event of [...events].reverse()) announce(ctx, event);
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
 * `dealAsEncounterCard`: each card out of play and of a dealable type goes facedown in front of `playerId`, to be
 * revealed with that player's dealt encounter cards. Returns the cards dealt.
 */
export function dealAsEncounterCards(ctx: Ctx, ids: readonly InstanceId[], playerId: PlayerId): readonly InstanceId[] {
  const inPlay = new Set(cardsInPlay(ctx.state));
  const dealt: InstanceId[] = [];
  for (const id of ids) {
    if (inPlay.has(id)) continue;
    const type = cardOf(ctx.state, id)?.type;
    if (!type || !DEALABLE_TYPES.has(type)) continue;
    updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
    moveCard(ctx, id, { kind: "dealtEncounter", playerId });
    dealt.push(id);
  }
  return dealt;
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
  if (dealAsEncounterCards(ctx, [event.instanceId], event.playerId).length === 0) return;
  drawCards(ctx, event.playerId, 1);
}

/**
 * Announces each card that left play since the last look (`TriggerEvent cardLeavesPlay`, docs/phase7-wave5.md §3.13),
 * when an ability listens, and empties the list; pushed last-first so the oldest resolves first. Returns true when it
 * pushed a frame.
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
  for (const event of [...events].reverse()) pushEvent(ctx, event);
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
    switch (request.kind) {
      case "zone":
        leavePlay(ctx, id, request.zone, request.position, request.discarded, request.patch, request.sourceCardId);
        break;
      case "moveCards":
        moveCardsTo(ctx, [id], request.destination, request.into, request.sourceCardId);
        break;
      case "defeat":
        defeatFromPlay(ctx, id, request.insteadTo, request.sourceCardId);
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
  const companions = leavingWithHost(ctx, event.instanceId, "atOnce");
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
