import type {
  AnyCard,
  CardId,
  EncounterCardFlipSide,
  MainSchemeStage,
  PrintedStat,
  ScalingValue,
  SchemeIcon,
  VillainStage,
} from "@mc/content";
import { DEFAULT_DEPS, type CardZoneQuery, type EngineDeps } from "./abilities.js";
import { EngineInvariantError } from "./errors.js";
import type { EncounterDeckId, InstanceId, PlayerId } from "./ids.js";
import { baseOverride, statBonus } from "./modifiers.js";
import type { SchemeValueName } from "./spec.js";
import type { CardInstance, EncounterDeckState, GameState, PlayerState, SeparateDeckState, VillainState, ZoneId } from "./state.js";

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

/** The villain state for a villain instance, or undefined for any other card. */
export const villainOf = (state: GameState, id: InstanceId): VillainState | undefined =>
  state.villains.find((villain) => villain.instanceId === id);

export function mustVillain(state: GameState, id: InstanceId): VillainState {
  const villain = villainOf(state, id);
  if (!villain) throw new EngineInvariantError(`${id} is not a villain`);
  return villain;
}

/** Whether this instance is one of the scenario's villains (defeated or not). */
export const isVillain = (state: GameState, id: InstanceId): boolean => villainOf(state, id) !== undefined;

/**
 * "The villain": the villain with the active counter (The Wrecking Crew insert, "The Active Villain": "Any card
 * effect that refers to 'the villain' only refers to the active villain."). With one villain, that villain.
 */
export const activeVillain = (state: GameState): VillainState => mustVillain(state, state.activeVillainId);

/** "A villain": every villain still in play, in printed order. */
export const undefeatedVillains = (state: GameState): readonly VillainState[] => state.villains.filter((villain) => !villain.defeated);

function villainSideOf(state: GameState, villain: VillainState) {
  const card = mustCard(state, villain.cardId);
  if (card.type !== "villain") throw new EngineInvariantError("villain card is not a villain");
  const side = card.sides.find((s) => s.side === villain.side);
  if (!side) throw new EngineInvariantError(`villain has no side ${villain.side}`);
  return side;
}

/** The stage currently up for this villain instance. */
export function villainStageOf(state: GameState, id: InstanceId): VillainStage {
  const villain = mustVillain(state, id);
  const stage = villainSideOf(state, villain).stages[villain.stageIndex];
  if (!stage) throw new EngineInvariantError(`villain has no stage ${villain.stageIndex}`);
  return stage;
}

/** The active villain's current stage. */
export const villainStage = (state: GameState): VillainStage => villainStageOf(state, state.activeVillainId);

/** How many stages this villain's current side has (the active villain's when `id` is absent). */
export function villainStageCount(state: GameState, id: InstanceId = state.activeVillainId): number {
  return villainSideOf(state, mustVillain(state, id)).stages.length;
}

/**
 * "The encounter deck": the active villain's. The Wrecking Crew insert, "The Active Villain": "Any card that
 * refers to 'the encounter deck' only refers to the active villain's deck"; ruling, Jan 17, 2026 (5): "only the
 * active villain's encounter deck can be interacted with." Every read of "the encounter deck" resolves here.
 */
export const activeEncounterDeckId = (state: GameState): EncounterDeckId => activeVillain(state).encounterDeckId;

export function encounterDeckOf(state: GameState, deckId: EncounterDeckId): EncounterDeckState {
  const deck = state.encounterDecks[deckId];
  if (!deck) throw new EngineInvariantError(`unknown encounter deck ${deckId}`);
  return deck;
}

export const activeEncounterDeck = (state: GameState): EncounterDeckState => encounterDeckOf(state, activeEncounterDeckId(state));

/** A player's separate deck by name (the Invocation deck; docs/phase7-wave1.md §3.5). */
export function separateDeckOf(state: GameState, playerId: PlayerId, name: string): SeparateDeckState {
  const piles = mustPlayer(state, playerId).separateDecks[name];
  if (!piles) throw new EngineInvariantError(`${playerId} has no separate deck ${name}`);
  return piles;
}

/** The identity's printed definition of that separate deck (`HeroIdentityCard.separateDecks`), if it has one. */
export function separateDeckDefinition(state: GameState, playerId: PlayerId, name: string) {
  const player = getPlayer(state, playerId);
  const card = player ? state.cardPool[player.identity.cardId] : undefined;
  return card?.type === "hero_identity" ? card.separateDecks?.find((deck) => deck.name === name) : undefined;
}

/** The cards of one player's zone a cost may pick from (`CardZoneQuery`), before its query filter: "the top card of the Invocation deck". */
export function cardZoneCandidates(state: GameState, from: CardZoneQuery, playerId: PlayerId): readonly InstanceId[] {
  const player = getPlayer(state, playerId);
  if (!player) return [];
  const ids =
    from.zone === "separateDeck"
      ? ((from.separateDeck !== undefined ? player.separateDecks[from.separateDeck]?.deck : undefined) ?? [])
      : zoneContents(state, { kind: from.zone, playerId });
  return from.top === undefined ? ids : ids.slice(0, Math.max(0, from.top));
}

/** The encounter deck a card goes back to when discarded (its home deck, or the active villain's). */
export function homeEncounterDeckId(state: GameState, id: InstanceId): EncounterDeckId {
  const home = getInstance(state, id)?.home;
  if (home?.kind === "encounterDeck" && state.encounterDecks[home.deckId]) return home.deckId;
  return activeEncounterDeckId(state);
}

/**
 * Where "discard" sends a card, from its `home` (docs/phase7-wave1.md §3.2): a player card to its owner's discard
 * pile, an encounter card to its own deck's discard pile, and a card with no encounter deck of its own to the
 * active villain's (ruling, Jan 17, 2026 (5)).
 *
 * Treachery and boost cards never enter play, and the insert only routes "an encounter card [that] leaves play".
 * They are routed to their home deck too: docs/phase7-wave1.md §4.3's proposed reading, still open for FFG.
 */
export function discardZoneFor(state: GameState, id: InstanceId): ZoneId {
  const instance = getInstance(state, id);
  if (instance?.home.kind === "player" && instance.ownerId) return { kind: "discard", playerId: instance.ownerId };
  // An Invocation card goes to its own deck's discard pile, never its owner's (RRG 1.8 "Tuck" discards included).
  if (instance?.home.kind === "separateDeck" && instance.ownerId && getPlayer(state, instance.ownerId)?.separateDecks[instance.home.name]) {
    return { kind: "separateDiscard", playerId: instance.ownerId, name: instance.home.name };
  }
  if (instance && instance.home.kind !== "player") return { kind: "encounterDiscard", deckId: homeEncounterDeckId(state, id) };
  // A player card whose owner is unknown cannot exist; keep encounter routing as the safe default.
  return instance?.ownerId ? { kind: "discard", playerId: instance.ownerId } : { kind: "encounterDiscard", deckId: activeEncounterDeckId(state) };
}

/**
 * The other face of a double-sided encounter card, when that face is up (RRG 1.8 "Flip", p. 20; §3.4). Its name,
 * traits, keywords and abilities replace the printed front's while it is flipped.
 */
export function encounterFace(state: GameState, id: InstanceId): EncounterCardFlipSide | undefined {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance?.flipped || !card || !("flipSide" in card)) return undefined;
  return card.flipSide;
}

/**
 * The title showing right now: a villain's current face ("Norman Osborn" / "Green Goblin"), a flipped card's other
 * face, or the printed name. A facedown card has none. `named` targets and `name` queries read this.
 */
export function currentName(state: GameState, id: InstanceId): string | undefined {
  const instance = getInstance(state, id);
  const card = cardOf(state, id);
  if (!instance || !card || instance.facedownAs) return undefined;
  const villain = villainOf(state, id);
  if (villain && card.type === "villain") return card.sides.find((side) => side.side === villain.side)?.name ?? card.name;
  return encounterFace(state, id)?.name ?? card.name;
}

/**
 * "Treat this card's printed text box as if it were blank" (Edison's Giant Robot): its abilities and keywords are
 * gone while the lasting effect lasts. An attachment's printed stat modifier is outside the text box and still applies
 * (ruling, Apr 30, 2026 (3) answer 4).
 */
export const textBoxBlank = (state: GameState, id: InstanceId): boolean =>
  state.lastingEffects.some((effect) => effect.kind === "blankTextBox" && effect.targets.includes(id));

/** Whether this card sits in any encounter discard pile. */
export const inAnyEncounterDiscard = (state: GameState, id: InstanceId): boolean =>
  state.encounterDeckOrder.some((deckId) => state.encounterDecks[deckId]?.discard.includes(id));

export function mainSchemeStage(state: GameState): MainSchemeStage {
  const card = mustCard(state, state.mainScheme.cardId);
  if (card.type !== "main_scheme") throw new EngineInvariantError("main scheme card is not a main scheme");
  const stage = card.stages[state.mainScheme.stageIndex];
  if (!stage) throw new EngineInvariantError(`main scheme has no stage ${state.mainScheme.stageIndex}`);
  return stage;
}

/**
 * The current main scheme stage's threat value as the rules read it now: printed (0 when printed "X", `printedX`; RRG
 * 1.8 "Non-Numerical Variable", p. 30), replaced by a "has a base … of" override (`setBase`), plus modifiers ("Increase
 * the target threat value of attached scheme by 4"). Every reader of acceleration, target threat and starting threat
 * goes through here (docs/phase7-wave1.md §3.8).
 */
export function mainSchemeValue(state: GameState, field: SchemeValueName, deps: EngineDeps = DEFAULT_DEPS): number {
  const stage = mainSchemeStage(state);
  const id = state.mainScheme.instanceId;
  const printed = stage.printedX?.includes(field) ? 0 : scale(stage[field], state.startingPlayerCount);
  return Math.max(0, (baseOverride(state, deps, id, field) ?? printed) + statBonus(state, deps, id, field));
}

/** A side scheme's starting threat (printed, per player), with modifiers; the main scheme's goes to `mainSchemeValue`. */
export function startingThreatOf(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): number {
  if (id === state.mainScheme.instanceId) return mainSchemeValue(state, "startingThreat", deps);
  const card = cardOf(state, id);
  const printed = card && "startingThreat" in card ? scale(card.startingThreat, state.startingPlayerCount) : 0;
  return Math.max(0, (baseOverride(state, deps, id, "startingThreat") ?? printed) + statBonus(state, deps, id, "startingThreat"));
}

export function mainSchemeStageCount(state: GameState): number {
  const card = mustCard(state, state.mainScheme.cardId);
  return card.type === "main_scheme" ? card.stages.length : 0;
}

/** A minion in play: a minion card, or a card facedown as a minion (a facedown Drone). */
export function isMinion(state: GameState, id: InstanceId): boolean {
  const instance = state.instances[id];
  if (!instance) return false;
  if (instance.facedownAs?.kind === "minion") return true;
  return state.cardPool[instance.cardId]?.type === "minion";
}

export type CharacterKind = "identity" | "ally" | "minion" | "villain";

export interface CharacterProfile {
  readonly kind: CharacterKind;
  /**
   * Stats printed as "—": the character cannot use that power at all (RRG — a
   * dash is not a 0). A missing ATK can't attack, THW can't thwart, SCH can't scheme.
   */
  readonly missing: readonly ("atk" | "thw" | "sch")[];
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
  // A base override ("has a base ATK of 1") replaces the printed value before modifiers apply. A dash is "treated as
  // an unmodifiable 0" (RRG 1.8 "Dash (Value)", p. 15), so no modifier or override touches it.
  const bump = (stat: "atk" | "thw" | "def" | "rec" | "sch", value: number): number =>
    (printed.missing as readonly string[]).includes(stat)
      ? 0
      : Math.max(0, (baseOverride(state, deps, id, stat) ?? value) + statBonus(state, deps, id, stat));
  return {
    kind: printed.kind,
    missing: printed.missing,
    atk: bump("atk", printed.atk),
    thw: bump("thw", printed.thw),
    def: bump("def", printed.def),
    rec: bump("rec", printed.rec),
    sch: bump("sch", printed.sch),
    maxHp: Math.max(0, (baseOverride(state, deps, id, "hp") ?? printed.maxHp) + statBonus(state, deps, id, "hp")),
  };
}

/** "X" is defined by the card's own ability (base 0 here); "—" is 0 plus a `missing` entry. */
const statValue = (value: PrintedStat): number => (typeof value === "number" ? value : 0);
const dashes = (stats: Readonly<Record<"atk" | "thw" | "sch", PrintedStat | undefined>>): ("atk" | "thw" | "sch")[] =>
  (["atk", "thw", "sch"] as const).filter((stat) => stats[stat] === null);

export function printedProfile(state: GameState, id: InstanceId): CharacterProfile | undefined {
  const instance = getInstance(state, id);
  if (!instance) return undefined;
  const card = getCard(state, instance.cardId);
  if (!card) return undefined;
  // A facedown minion has no printed stats of its own (card abilities set its base values).
  if (instance.facedownAs?.kind === "minion") {
    return { kind: "minion", missing: [], atk: 0, thw: 0, def: 0, rec: 0, sch: 0, maxHp: 0 };
  }

  if (card.type === "hero_identity") {
    const player = state.players.find((p) => p.identity.instanceId === id);
    if (!player) return undefined;
    const hero = card.hero;
    const alterEgo = card.alterEgo;
    return player.identity.form === "hero"
      ? { kind: "identity", missing: [], atk: hero.atk, thw: hero.thw, def: hero.def, rec: 0, sch: 0, maxHp: card.hp }
      : { kind: "identity", missing: [], atk: 0, thw: 0, def: 0, rec: alterEgo.rec, sch: 0, maxHp: card.hp };
  }
  if (card.type === "ally") {
    return {
      kind: "ally",
      missing: dashes({ atk: card.atk, thw: card.thw, sch: 0 }),
      atk: statValue(card.atk),
      thw: statValue(card.thw),
      def: 0,
      rec: 0,
      sch: 0,
      maxHp: card.hp,
    };
  }
  if (card.type === "minion") {
    return {
      kind: "minion",
      missing: dashes({ atk: card.atk, thw: 0, sch: card.sch }),
      atk: statValue(card.atk),
      thw: 0,
      def: 0,
      rec: 0,
      sch: statValue(card.sch),
      maxHp: card.hp,
    };
  }
  if (card.type === "villain" && isVillain(state, id)) {
    const stage = villainStageOf(state, id);
    return {
      kind: "villain",
      // `VillainStage.dashedStats`: Norman Osborn's ATK, Risky Business Green Goblin's SCH (RRG 1.8 "Dash (Value)").
      missing: [...(stage.dashedStats ?? [])],
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

/** Max hit points only (printed + HP modifiers) — reading it never evaluates ATK/THW/SCH modifiers. */
export function maxHitPoints(state: GameState, id: InstanceId, deps: EngineDeps = DEFAULT_DEPS): number | undefined {
  const printed = printedProfile(state, id);
  if (!printed) return undefined;
  return Math.max(0, (baseOverride(state, deps, id, "hp") ?? printed.maxHp) + statBonus(state, deps, id, "hp"));
}

export function remainingHitPoints(
  state: GameState,
  id: InstanceId,
  deps: EngineDeps = DEFAULT_DEPS,
): number | undefined {
  const max = maxHitPoints(state, id, deps);
  const instance = getInstance(state, id);
  if (max === undefined || !instance) return undefined;
  return max - instance.damage;
}

/** The hand size printed on the player's current face, without modifiers. */
export function printedHandSize(state: GameState, playerId: PlayerId): number {
  const player = mustPlayer(state, playerId);
  const card = mustCard(state, player.identity.cardId);
  if (card.type !== "hero_identity") throw new EngineInvariantError("identity card is not an identity");
  return player.identity.form === "hero" ? card.hero.handSize : card.alterEgo.handSize;
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
  return player.playArea.filter((id) => isMinion(state, id));
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
    case "resolving":
      return mustPlayer(state, zone.playerId).resolving;
    case "setAside":
      return mustPlayer(state, zone.playerId).setAside;
    case "tucked":
      return mustInstance(state, zone.hostInstanceId).tucked;
    case "identity":
      return [mustPlayer(state, zone.playerId).identity.instanceId];
    case "encounterDeck":
      return encounterDeckOf(state, zone.deckId).deck;
    case "encounterDiscard":
      return encounterDeckOf(state, zone.deckId).discard;
    case "separateDeck":
      return separateDeckOf(state, zone.playerId, zone.name).deck;
    case "separateDiscard":
      return separateDeckOf(state, zone.playerId, zone.name).discard;
    case "encounterSetAside":
      return state.encounterSetAside;
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
    if (player.resolving.includes(id)) return { kind: "resolving", playerId: player.playerId };
    if (player.setAside.includes(id)) return { kind: "setAside", playerId: player.playerId };
    for (const [name, piles] of Object.entries(player.separateDecks)) {
      if (piles.deck.includes(id)) return { kind: "separateDeck", playerId: player.playerId, name };
      if (piles.discard.includes(id)) return { kind: "separateDiscard", playerId: player.playerId, name };
    }
  }
  for (const deckId of state.encounterDeckOrder) {
    const piles = state.encounterDecks[deckId];
    if (piles?.deck.includes(id)) return { kind: "encounterDeck", deckId };
    if (piles?.discard.includes(id)) return { kind: "encounterDiscard", deckId };
  }
  if (state.encounterSetAside.includes(id)) return { kind: "encounterSetAside" };
  if (state.villainArea.includes(id)) return { kind: "villainArea" };
  if (state.victoryDisplay.includes(id)) return { kind: "victoryDisplay" };
  if (state.removedFromGame.includes(id)) return { kind: "removedFromGame" };
  const instance = getInstance(state, id);
  if (instance?.attachedTo) return { kind: "attachment", hostInstanceId: instance.attachedTo };
  for (const host of Object.values(state.instances)) {
    if (host.boostCards.includes(id)) return { kind: "boost", hostInstanceId: host.instanceId };
    if (host.tucked.includes(id)) return { kind: "tucked", hostInstanceId: host.instanceId };
  }
  return null;
}

export const isTerminal = (state: GameState): boolean => state.outcome !== null;
