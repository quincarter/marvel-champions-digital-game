import type { GameEvent } from "./events.js";
import { EngineInvariantError } from "./errors.js";
import {
  choiceId,
  frameId as makeFrameId,
  instanceId,
  type ChoiceId,
  type FrameId,
  type InstanceId,
  type PlayerId,
} from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { locateCard, mustInstance, mustPlayer, separateDeckDefinition, zoneContents as zoneOf } from "./query.js";
import type { ChoiceOption, ChoicePrompt, DecisionAuthority, PendingChoice } from "./choices.js";
import type { CardInstance, GameState, GameStep, PlayerState, ZoneId } from "./state.js";
import { describeFrame, type StackFrame } from "./stack.js";
import type { EngineDeps } from "./abilities.js";
import { resetPlayerDeckIfEmpty } from "./effects.js";

/**
 * Working context for one command. `state` is replaced (never mutated) by each
 * helper; `events` accumulates the ordered log of what happened.
 */
export interface Ctx {
  state: GameState;
  readonly events: GameEvent[];
  readonly deps: EngineDeps;
}

export const createCtx = (state: GameState, deps: EngineDeps): Ctx => ({ state, events: [], deps });

export function emit(ctx: Ctx, event: GameEvent): void {
  ctx.events.push(event);
}

export function updateInstance(ctx: Ctx, id: InstanceId, update: (instance: CardInstance) => CardInstance): void {
  const current = mustInstance(ctx.state, id);
  ctx.state = {
    ...ctx.state,
    instances: { ...ctx.state.instances, [id]: update(current) },
  };
}

export function updatePlayer(ctx: Ctx, id: PlayerId, update: (player: PlayerState) => PlayerState): void {
  const players = ctx.state.players.map((p) => (p.playerId === id ? update(p) : p));
  ctx.state = { ...ctx.state, players };
}

function setZone(state: GameState, zone: ZoneId, ids: readonly InstanceId[]): GameState {
  switch (zone.kind) {
    case "hand":
      return withPlayer(state, zone.playerId, (p) => ({ ...p, hand: ids }));
    case "deck":
      return withPlayer(state, zone.playerId, (p) => ({ ...p, deck: ids }));
    case "discard":
      return withPlayer(state, zone.playerId, (p) => ({ ...p, discard: ids }));
    case "playArea":
      return withPlayer(state, zone.playerId, (p) => ({ ...p, playArea: ids }));
    case "dealtEncounter":
      return withPlayer(state, zone.playerId, (p) => ({ ...p, dealtEncounter: ids }));
    case "resolving":
      return withPlayer(state, zone.playerId, (p) => ({ ...p, resolving: ids }));
    case "setAside":
      return withPlayer(state, zone.playerId, (p) => ({ ...p, setAside: ids }));
    case "tucked": {
      const host = mustInstance(state, zone.hostInstanceId);
      return { ...state, instances: { ...state.instances, [host.instanceId]: { ...host, tucked: ids } } };
    }
    case "encounterDeck":
    case "encounterDiscard": {
      const piles = state.encounterDecks[zone.deckId];
      if (!piles) throw new EngineInvariantError(`unknown encounter deck ${zone.deckId}`);
      const next = zone.kind === "encounterDeck" ? { ...piles, deck: ids } : { ...piles, discard: ids };
      return { ...state, encounterDecks: { ...state.encounterDecks, [zone.deckId]: next } };
    }
    case "separateDeck":
    case "separateDiscard":
      return withPlayer(state, zone.playerId, (p) => {
        const piles = p.separateDecks[zone.name];
        if (!piles) throw new EngineInvariantError(`${zone.playerId} has no separate deck ${zone.name}`);
        const next = zone.kind === "separateDeck" ? { ...piles, deck: ids } : { ...piles, discard: ids };
        return { ...p, separateDecks: { ...p.separateDecks, [zone.name]: next } };
      });
    case "encounterSetAside":
      return { ...state, encounterSetAside: ids };
    case "scenarioDeck":
    case "scenarioDiscard": {
      const piles = state.scenarioDecks[zone.name];
      if (!piles) throw new EngineInvariantError(`unknown scenario deck ${zone.name}`);
      const next = zone.kind === "scenarioDeck" ? { ...piles, deck: ids } : { ...piles, discard: ids };
      return { ...state, scenarioDecks: { ...state.scenarioDecks, [zone.name]: next } };
    }
    case "scenarioArea":
      return { ...state, scenarioAreas: { ...state.scenarioAreas, [zone.name]: ids } };
    case "villainArea":
      return { ...state, villainArea: ids };
    case "victoryDisplay":
      return { ...state, victoryDisplay: ids };
    case "removedFromGame":
      return { ...state, removedFromGame: ids };
    case "attachment": {
      const host = mustInstance(state, zone.hostInstanceId);
      return {
        ...state,
        instances: { ...state.instances, [host.instanceId]: { ...host, attachments: ids } },
      };
    }
    case "boost": {
      const host = mustInstance(state, zone.hostInstanceId);
      return {
        ...state,
        instances: { ...state.instances, [host.instanceId]: { ...host, boostCards: ids } },
      };
    }
    case "identity":
      throw new EngineInvariantError("identity cards cannot leave their slot");
  }
}

function withPlayer(state: GameState, id: PlayerId, update: (player: PlayerState) => PlayerState): GameState {
  mustPlayer(state, id);
  return { ...state, players: state.players.map((p) => (p.playerId === id ? update(p) : p)) };
}

export type ZonePosition = "top" | "bottom";

/**
 * The single way a card changes zones. Emits `cardMoved` so the log always
 * explains how a card got where it is, then resets a player deck the move
 * emptied (`settlePlayerDecks`).
 */
export function moveCard(ctx: Ctx, id: InstanceId, to: ZoneId, position: ZonePosition = "bottom"): void {
  const from = relocateCard(ctx, id, to, position);
  settlePlayerDecks(ctx, from, to);
}

/**
 * RRG 1.8 "Player Deck" (p. 33): "If a player deck empties, the player shuffles their discard pile to make a new deck.
 * That player immediately deals themself one facedown encounter card", and a deck that empties with no discard pile
 * resets as soon as "there is at least one card in the player's discard pile". Ruling, Apr 30, 2026 (3) answer 7: "The
 * deck is reshuffled **before** the currently resolving card enters the discard pile" — so the reset happens the moment
 * the deck empties, not on its next read (docs/phase7-wave3.md §4 Q15). Every draw, discard, search and mill moves its
 * cards through `moveCard`, so this one check after a move out of a player's deck or into a player's discard pile is
 * the rule for all of them.
 */
export function settlePlayerDecks(ctx: Ctx, from: ZoneId | null, to: ZoneId): void {
  if (from?.kind === "deck") resetPlayerDeckIfEmpty(ctx, from.playerId);
  if (to.kind === "discard") resetPlayerDeckIfEmpty(ctx, to.playerId);
}

/**
 * `moveCard` without `settlePlayerDecks`, for a caller that logs its own step between the move and the reset (a draw's
 * `cardDrawn` comes before the reshuffle it caused). The caller must call `settlePlayerDecks` itself.
 */
export function relocateCard(ctx: Ctx, id: InstanceId, to: ZoneId, position: ZonePosition = "bottom"): ZoneId | null {
  const from = locateCard(ctx.state, id);
  if (from) {
    const remaining = zoneOf(ctx.state, from).filter((x) => x !== id);
    ctx.state = setZone(ctx.state, from, remaining);
  }
  const target = zoneOf(ctx.state, to);
  ctx.state = setZone(ctx.state, to, position === "top" ? [id, ...target] : [...target, id]);

  const instance = mustInstance(ctx.state, id);
  const attachedTo = to.kind === "attachment" ? to.hostInstanceId : null;
  if (instance.attachedTo !== attachedTo) {
    ctx.state = {
      ...ctx.state,
      instances: { ...ctx.state.instances, [id]: { ...instance, attachedTo } },
    };
  }
  emit(ctx, {
    type: "cardMoved",
    instanceId: id,
    cardId: instance.cardId,
    from: from ?? { kind: "removedFromGame" },
    to,
  });
  for (const zone of [from, to]) {
    if (zone?.kind === "separateDeck") syncSeparateDeckTop(ctx, zone.playerId, zone.name);
  }
  return from ?? null;
}

/**
 * Keeps an identity's separate deck showing what its rules say: the Doctor Strange insert, "play with the top card of
 * the INVOCATION deck faceup at all times" (`IdentitySeparateDeck.topCardFaceup`), every other card in it facedown.
 * Called after every change to that deck, so a client reads `faceup` instead of re-deriving the rule.
 */
export function syncSeparateDeckTop(ctx: Ctx, playerId: PlayerId, name: string): void {
  const piles = mustPlayer(ctx.state, playerId).separateDecks[name];
  if (!piles) return;
  const topFaceup = separateDeckDefinition(ctx.state, playerId, name)?.topCardFaceup ?? false;
  piles.deck.forEach((id, index) => {
    const faceup = index === 0 && topFaceup;
    if (mustInstance(ctx.state, id).faceup !== faceup) updateInstance(ctx, id, (i) => ({ ...i, faceup }));
  });
}

export function setStep(ctx: Ctx, to: GameStep): void {
  const from = ctx.state.step;
  if (from.phase === to.phase && from.kind === to.kind && JSON.stringify(from) === JSON.stringify(to)) {
    return;
  }
  ctx.state = { ...ctx.state, step: to };
  emit(ctx, { type: "stepChanged", from, to });
}

export function nextInstanceId(ctx: Ctx): InstanceId {
  const id = instanceId(`i${ctx.state.nextInstanceSeq}`);
  ctx.state = { ...ctx.state, nextInstanceSeq: ctx.state.nextInstanceSeq + 1 };
  return id;
}

export function nextChoiceId(ctx: Ctx): ChoiceId {
  const id = choiceId(`c${ctx.state.nextChoiceSeq}`);
  ctx.state = { ...ctx.state, nextChoiceSeq: ctx.state.nextChoiceSeq + 1 };
  return id;
}

export function nextFrameId(ctx: Ctx): FrameId {
  const id = makeFrameId(`f${ctx.state.nextFrameSeq}`);
  ctx.state = { ...ctx.state, nextFrameSeq: ctx.state.nextFrameSeq + 1 };
  return id;
}

/**
 * The card a frame is *resolving*, if it has one — used to spot a peril card on the stack, and read by `stack-view.ts`.
 *
 * Deliberately narrow: an `enemyAttack`/`enemyScheme` procedure frame has an enemy, but that enemy is not a card
 * being resolved by a player, and widening this would silently change `perilOnStack` (RRG 1.8 "Peril", p. 32: the
 * restriction belongs to the player resolving the *card*). `stack-view.ts` adds the enemy on top of this for display.
 */
export function frameCardId(frame: StackFrame): InstanceId | null {
  switch (frame.kind) {
    case "reveal":
    case "playCard":
    case "ability":
      return frame.instanceId;
    case "effects":
      return frame.selfInstanceId;
    default:
      return null;
  }
}

const perilOnStack = (state: GameState): boolean =>
  state.stack.some((frame) => {
    const id = frameCardId(frame);
    return id !== null && hasKeyword(state, id, "peril");
  });

export function requestChoice(
  ctx: Ctx,
  spec: {
    readonly playerId: PlayerId;
    readonly prompt: ChoicePrompt;
    readonly options: readonly ChoiceOption[];
    readonly minSelections: number;
    readonly maxSelections: number;
    readonly frameId?: FrameId | null;
    readonly ordered?: boolean;
    readonly authority?: DecisionAuthority;
  },
): void {
  const choice: PendingChoice = {
    choiceId: nextChoiceId(ctx),
    playerId: spec.playerId,
    prompt: spec.prompt,
    options: spec.options,
    minSelections: spec.minSelections,
    maxSelections: spec.maxSelections,
    frameId: spec.frameId ?? null,
    ordered: spec.ordered ?? false,
    soleDecider: perilOnStack(ctx.state),
    authority: spec.authority ?? "player",
  };
  ctx.state = { ...ctx.state, pendingChoice: choice };
  emit(ctx, { type: "choiceRequested", choice });
}

export function clearChoice(ctx: Ctx): void {
  ctx.state = { ...ctx.state, pendingChoice: null };
}

/** Puts frames on top of the stack, in order: `frames[0]` resolves first. */
export function pushFrames(ctx: Ctx, frames: readonly StackFrame[]): void {
  if (frames.length === 0) return;
  ctx.state = { ...ctx.state, stack: [...frames, ...ctx.state.stack] };
  for (const frame of frames) {
    emit(ctx, {
      type: "framePushed",
      frameId: frame.frameId,
      frame: frame.kind,
      description: describeFrame(frame),
    });
  }
}

export function popFrame(ctx: Ctx): void {
  const [top, ...rest] = ctx.state.stack;
  if (!top) throw new EngineInvariantError("popFrame with an empty stack");
  ctx.state = { ...ctx.state, stack: rest };
  emit(ctx, { type: "framePopped", frameId: top.frameId, frame: top.kind });
}

/**
 * Rewrites a frame in place (cursor advance, stage change, answer clear).
 * Addressed by id rather than by position, so a handler that pushes child
 * frames first cannot accidentally overwrite one of them.
 */
export function setFrame(ctx: Ctx, frame: StackFrame): void {
  ctx.state = {
    ...ctx.state,
    stack: ctx.state.stack.map((existing) => (existing.frameId === frame.frameId ? frame : existing)),
  };
}

export function updateFrame(ctx: Ctx, id: FrameId, update: (frame: StackFrame) => StackFrame): void {
  ctx.state = {
    ...ctx.state,
    stack: ctx.state.stack.map((frame) => (frame.frameId === id ? update(frame) : frame)),
  };
}

export const findFrame = (state: GameState, id: FrameId): StackFrame | undefined =>
  state.stack.find((frame) => frame.frameId === id);
