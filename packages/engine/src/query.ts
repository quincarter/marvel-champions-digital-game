import type {
  AnyCard,
  CardId,
  MainSchemeStage,
  ScalingValue,
  SchemeIcon,
  VillainStage,
} from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import { EngineInvariantError } from "./errors.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { statBonus } from "./modifiers.js";
import type { CardInstance, GameState, PlayerState, ZoneId } from "./state.js";

export const scale = (value: ScalingValue, playerCount: number): number =>
  value.base + value.perPlayer * playerCount;

export const getInstance = (state: GameState, id: InstanceId): CardInstance | undefined =>
  state.instances[id];

export function mustInstance(state: GameState, id: InstanceId): CardInstance {
  const instance = state.instances[id];
  if (!instance) throw new EngineInvariantError(`unknown card instance ${id}`);
  return instance;
}

export const getCard = (state: GameState, cardId: CardId): AnyCard | undefined =>
  state.cardPool[cardId];

export function mustCard(state: GameState, cardId: CardId): AnyCard {
  const card = state.cardPool[cardId];
  if (!card) throw new EngineInvariantError(`unknown card ${cardId}`);
  return card;
}

export const cardOf = (state: GameState, id: InstanceId): AnyCard | undefined => {
  const instance = state.instances[id];
  return instance ? state.cardPool[instance.cardId] : undefined;
};

export function mustCardOf(state: GameState, id: InstanceId): AnyCard {
  return mustCard(state, mustInstance(state, id).cardId);
}

export const getPlayer = (state: GameState, id: PlayerId): PlayerState | undefined =>
  state.players.find((p) => p.playerId === id);

export function mustPlayer(state: GameState, id: PlayerId): PlayerState {
  const player = getPlayer(state, id);
  if (!player) throw new EngineInvariantError(`unknown player ${id}`);
  return player;
}

/** RRG "In Player Order": first player first, then clockwise. Eliminated players are skipped. */
export function playerOrder(state: GameState): readonly PlayerState[] {
  const seated = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const startIndex = seated.findIndex((p) => p.playerId === state.firstPlayerId);
  const from = startIndex < 0 ? 0 : startIndex;
  const ordered: PlayerState[] = [];
  for (let i = 0; i < seated.length; i++) {
    const player = seated[(from + i) % seated.length] as PlayerState;
    if (!player.eliminated) ordered.push(player);
  }
  return ordered;
}

export function nextClockwisePlayer(state: GameState, from: PlayerId): PlayerState | undefined {
  const seated = [...state.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const index = seated.findIndex((p) => p.playerId === from);
  if (index < 0) return undefined;
  for (let i = 1; i <= seated.length; i++) {
    const candidate = seated[(index + i) % seated.length] as PlayerState;
    if (!candidate.eliminated) return candidate;
  }
  return undefined;
}

export function villainStage(state: GameState): VillainStage {
  const card = mustCard(state, state.villain.cardId);
  if (card.type !== "villain") throw new EngineInvariantError("villain card is not a villain");
  const side = card.sides.find((s) => s.side === state.villain.side);
  if (!side) throw new EngineInvariantError(`villain has no side ${state.villain.side}`);
  const stage = side.stages[state.villain.stageIndex];
  if (!stage) throw new EngineInvariantError(`villain has no stage ${state.villain.stageIndex}`);
  return stage;
}

export function villainStageCount(state: GameState): number {
  const card = mustCard(state, state.villain.cardId);
  if (card.type !== "villain") throw new EngineInvariantError("villain card is not a villain");
  const side = card.sides.find((s) => s.side === state.villain.side);
  return side ? side.stages.length : 0;
}

export function mainSchemeStage(state: GameState): MainSchemeStage {
  const card = mustCard(state, state.mainScheme.cardId);
  if (card.type !== "main_scheme") throw new EngineInvariantError("main scheme card is not a main scheme");
  const stage = card.stages[state.mainScheme.stageIndex];
  if (!stage) throw new EngineInvariantError(`main scheme has no stage ${state.mainScheme.stageIndex}`);
  return stage;
}

export function mainSchemeStageCount(state: GameState): number {
  const card = mustCard(state, state.mainScheme.cardId);
  return card.type === "main_scheme" ? card.stages.length : 0;
}

export type CharacterKind = "identity" | "ally" | "minion" | "villain";

export interface CharacterProfile {
  readonly kind: CharacterKind;
  readonly atk: number;
  readonly thw: number;
  readonly def: number;
  readonly rec: number;
  readonly sch: number;
  readonly maxHp: number;
}

/**
 * Printed stats plus every active constant-ability modifier. Never mutates the
 * printed values — modifiers are recomputed on each read (RRG "Modifiers").
 */
export function characterProfile(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): CharacterProfile | undefined {
  const printed = printedProfile(state, id);
  if (!printed) return undefined;
  const bump = (stat: "atk" | "thw" | "def" | "rec" | "sch", value: number): number =>
    Math.max(0, value + statBonus(state, deps, id, stat));
  return {
    kind: printed.kind,
    atk: bump("atk", printed.atk),
    thw: bump("thw", printed.thw),
    def: bump("def", printed.def),
    rec: bump("rec", printed.rec),
    sch: bump("sch", printed.sch),
    maxHp: Math.max(0, printed.maxHp + statBonus(state, deps, id, "hp")),
  };
}

export function printedProfile(state: GameState, id: InstanceId): CharacterProfile | undefined {
  const instance = getInstance(state, id);
  if (!instance) return undefined;
  const card = getCard(state, instance.cardId);
  if (!card) return undefined;

  if (card.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return undefined;
    const hero = card.hero;
    const alterEgo = card.alterEgo;
    return player.identity.form === "hero"
      ? { kind: "identity", atk: hero.atk, thw: hero.thw, def: hero.def, rec: 0, sch: 0, maxHp: card.hp }
      : { kind: "identity", atk: 0, thw: 0, def: 0, rec: alterEgo.rec, sch: 0, maxHp: card.hp };
  }
  if (card.type === "ally") {
    return { kind: "ally", atk: card.atk, thw: card.thw, def: 0, rec: 0, sch: 0, maxHp: card.hp };
  }
  if (card.type === "minion") {
    return { kind: "minion", atk: card.atk, thw: 0, def: 0, rec: 0, sch: card.sch, maxHp: card.hp };
  }
  if (card.type === "villain" && id === state.villain.instanceId) {
    const stage = villainStage(state);
    return {
      kind: "villain",
      atk: stage.atk,
      thw: 0,
      def: 0,
      rec: 0,
      sch: stage.sch,
      maxHp: scale(stage.hp, state.startingPlayerCount),
    };
  }
  return undefined;
}

export function remainingHitPoints(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): number | undefined {
  const profile = characterProfile(state, id, deps);
  const instance = getInstance(state, id);
  if (!profile || !instance) return undefined;
  return profile.maxHp - instance.damage;
}

export function handSize(
  state: GameState,
  playerId: PlayerId,
  deps: EngineDeps = DEFAULT_DEPS,
): number {
  const player = mustPlayer(state, playerId);
  const card = mustCard(state, player.identity.cardId);
  if (card.type !== "hero_identity") throw new EngineInvariantError("identity card is not an identity");
  const printed = player.identity.form === "hero" ? card.hero.handSize : card.alterEgo.handSize;
  return Math.max(0, printed + statBonus(state, deps, player.identity.instanceId, "handSize"));
}

/** Schemes in play, in a stable order: main scheme first, then side schemes in the villain area. */
export function schemesInPlay(state: GameState): readonly InstanceId[] {
  const sideSchemes = state.villainArea.filter((id) => {
    const card = cardOf(state, id);
    return card?.type === "side_scheme" || card?.type === "player_side_scheme";
  });
  return [state.mainScheme.instanceId, ...sideSchemes];
}

/** Icons contributed by the active main scheme stage plus every side scheme in play. */
export function countSchemeIcons(state: GameState, icon: SchemeIcon): number {
  let total = mainSchemeStage(state).icons.filter((i) => i === icon).length;
  for (const id of state.villainArea) {
    const card = cardOf(state, id);
    if (card?.type === "side_scheme") total += card.icons.filter((i) => i === icon).length;
  }
  return total;
}

export function minionsEngagedWith(state: GameState, playerId: PlayerId): readonly InstanceId[] {
  const player = getPlayer(state, playerId);
  if (!player) return [];
  return player.playArea.filter((id) => cardOf(state, id)?.type === "minion");
}

export function zoneContents(state: GameState, zone: ZoneId): readonly InstanceId[] {
  switch (zone.kind) {
    case "hand":
      return mustPlayer(state, zone.playerId).hand;
    case "deck":
      return mustPlayer(state, zone.playerId).deck;
    case "discard":
      return mustPlayer(state, zone.playerId).discard;
    case "playArea":
      return mustPlayer(state, zone.playerId).playArea;
    case "dealtEncounter":
      return mustPlayer(state, zone.playerId).dealtEncounter;
    case "identity":
      return [mustPlayer(state, zone.playerId).identity.instanceId];
    case "encounterDeck":
      return state.encounterDeck;
    case "encounterDiscard":
      return state.encounterDiscard;
    case "villainArea":
      return state.villainArea;
    case "victoryDisplay":
      return state.victoryDisplay;
    case "removedFromGame":
      return state.removedFromGame;
    case "attachment":
      return mustInstance(state, zone.hostInstanceId).attachments;
    case "boost":
      return mustInstance(state, zone.hostInstanceId).boostCards;
  }
}

/** Where a card currently is. Linear scan; the number of cards in a game is small. */
export function locateCard(state: GameState, id: InstanceId): ZoneId | null {
  for (const player of state.players) {
    if (player.identity.instanceId === id) return { kind: "identity", playerId: player.playerId };
    if (player.hand.includes(id)) return { kind: "hand", playerId: player.playerId };
    if (player.deck.includes(id)) return { kind: "deck", playerId: player.playerId };
    if (player.discard.includes(id)) return { kind: "discard", playerId: player.playerId };
    if (player.playArea.includes(id)) return { kind: "playArea", playerId: player.playerId };
    if (player.dealtEncounter.includes(id)) return { kind: "dealtEncounter", playerId: player.playerId };
  }
  if (state.encounterDeck.includes(id)) return { kind: "encounterDeck" };
  if (state.encounterDiscard.includes(id)) return { kind: "encounterDiscard" };
  if (state.villainArea.includes(id)) return { kind: "villainArea" };
  if (state.victoryDisplay.includes(id)) return { kind: "victoryDisplay" };
  if (state.removedFromGame.includes(id)) return { kind: "removedFromGame" };
  const instance = getInstance(state, id);
  if (instance?.attachedTo) return { kind: "attachment", hostInstanceId: instance.attachedTo };
  for (const host of Object.values(state.instances)) {
    if (host.boostCards.includes(id)) return { kind: "boost", hostInstanceId: host.instanceId };
  }
  return null;
}

export const isTerminal = (state: GameState): boolean => state.outcome !== null;
