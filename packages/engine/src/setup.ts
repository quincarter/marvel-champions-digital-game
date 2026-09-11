import type { AnyCard, CardId } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import { createCtx, emit, moveCard, pushFrames, updateInstance, type Ctx } from "./ctx.js";
import { giveStatus, shuffleZone } from "./effects.js";
import { engineError, type EngineError } from "./errors.js";
import { runFlow } from "./flow.js";
import { instanceId, playerId, type InstanceId, type PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { createRng } from "./rng.js";
import { mainSchemeStage, mustCardOf, scale } from "./query.js";
import {
  announce,
  applyEnterPlayKeywords,
  enterPlayOnReveal,
  gameAbilityFrames,
} from "./resolve.js";
import { NO_STATUSES, type CardInstance, type GameState, type PlayerState } from "./state.js";
import type { GameEvent } from "./events.js";

export interface PlayerSetup {
  readonly identityCardId: CardId;
  readonly deck: readonly CardId[];
}

export interface GameSetupConfig {
  readonly seed: number;
  /** Every card the game can reference; stored in state so a save replays standalone. */
  readonly cards: readonly AnyCard[];
  readonly villainCardId: CardId;
  readonly villainSide?: "A" | "B";
  /** Standard play starts at stage I, expert at stage II (RRG "Modes of Play"). */
  readonly villainStartStageIndex?: number;
  /** The last villain stage used (standard: stage II, expert: stage III). Defaults to the side's last stage. */
  readonly villainLastStageIndex?: number;
  /**
   * RRG Appendix II: each identity's obligation (`HeroIdentityCard.obligationCardId`) is shuffled into the
   * encounter deck and its nemesis set (`nemesisEncounterSetId`, `quantityInSet` copies of each card) is set
   * aside. Cards missing from `cards` are skipped unless `requireIdentitySets` is set. Default true.
   */
  readonly includeIdentitySets?: boolean;
  readonly requireIdentitySets?: boolean;
  readonly mainSchemeCardId: CardId;
  readonly encounterDeck: readonly CardId[];
  readonly players: readonly PlayerSetup[];
  readonly firstPlayerIndex?: number;
}

export type SetupResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: EngineError };

const blankInstance = (id: InstanceId, cardId: CardId, ownerId: PlayerId | null): CardInstance => ({
  instanceId: id,
  cardId,
  ownerId,
  controllerId: ownerId,
  faceup: false,
  exhausted: false,
  damage: 0,
  threat: 0,
  statuses: NO_STATUSES,
  counters: {},
  attachedTo: null,
  attachments: [],
  boostCards: [],
  tucked: [],
  facedownAs: null,
  engagedWith: null,
});

/** RRG Appendix II: Setup, minus obligations/nemesis sets/setup abilities (they need slice 2). */
export function createGame(config: GameSetupConfig, deps: EngineDeps = DEFAULT_DEPS): SetupResult {
  if (config.players.length < 1 || config.players.length > 4) {
    return { ok: false, error: engineError("invalid_setup", "a game has 1–4 players") };
  }
  const pool: Record<string, AnyCard> = {};
  for (const card of config.cards) pool[card.id] = card;

  const villainCard = pool[config.villainCardId];
  if (!villainCard || villainCard.type !== "villain") {
    return { ok: false, error: engineError("invalid_setup", `${config.villainCardId} is not a villain card`) };
  }
  const mainSchemeCard = pool[config.mainSchemeCardId];
  if (!mainSchemeCard || mainSchemeCard.type !== "main_scheme") {
    return { ok: false, error: engineError("invalid_setup", `${config.mainSchemeCardId} is not a main scheme card`) };
  }
  const side = config.villainSide ?? "A";
  const villainSide = villainCard.sides.find((s) => s.side === side);
  if (!villainSide) {
    return { ok: false, error: engineError("invalid_setup", `villain has no side ${side}`) };
  }
  const villainStageIndex = config.villainStartStageIndex ?? 0;
  if (!villainSide.stages[villainStageIndex]) {
    return { ok: false, error: engineError("invalid_setup", `villain has no stage index ${villainStageIndex}`) };
  }
  const lastStageIndex = config.villainLastStageIndex ?? villainSide.stages.length - 1;
  if (!villainSide.stages[lastStageIndex] || lastStageIndex < villainStageIndex) {
    return { ok: false, error: engineError("invalid_setup", `villain has no last stage index ${lastStageIndex}`) };
  }

  let seq = 1;
  const nextId = (): InstanceId => instanceId(`i${seq++}`);
  const instances: Record<string, CardInstance> = {};

  const villainInstanceId = nextId();
  instances[villainInstanceId] = { ...blankInstance(villainInstanceId, villainCard.id, null), faceup: true };
  const mainSchemeInstanceId = nextId();
  instances[mainSchemeInstanceId] = { ...blankInstance(mainSchemeInstanceId, mainSchemeCard.id, null), faceup: true };

  const players: PlayerState[] = [];
  const obligationIds: InstanceId[] = [];
  for (const [seatIndex, setup] of config.players.entries()) {
    const id = playerId(`p${seatIndex + 1}`);
    const identityCard = pool[setup.identityCardId];
    if (!identityCard || identityCard.type !== "hero_identity") {
      return { ok: false, error: engineError("invalid_setup", `${setup.identityCardId} is not an identity card`) };
    }
    const identityInstanceId = nextId();
    instances[identityInstanceId] = { ...blankInstance(identityInstanceId, identityCard.id, id), faceup: true };

    const deck: InstanceId[] = [];
    for (const cardId of setup.deck) {
      const card = pool[cardId];
      if (!card) return { ok: false, error: engineError("invalid_setup", `unknown card ${cardId} in ${id}'s deck`) };
      const cardInstanceId = nextId();
      instances[cardInstanceId] = blankInstance(cardInstanceId, card.id, id);
      deck.push(cardInstanceId);
    }
    const setAside: InstanceId[] = [];
    if (config.includeIdentitySets !== false) {
      const obligation = pool[identityCard.obligationCardId];
      if (obligation) {
        const obligationInstanceId = nextId();
        instances[obligationInstanceId] = blankInstance(obligationInstanceId, obligation.id, null);
        obligationIds.push(obligationInstanceId);
      } else if (config.requireIdentitySets) {
        return { ok: false, error: engineError("invalid_setup", `obligation ${identityCard.obligationCardId} is not in the card pool`) };
      }
      const nemesis = config.cards.filter(
        (card) => "encounterSetIds" in card && card.encounterSetIds.includes(identityCard.nemesisEncounterSetId),
      );
      if (nemesis.length === 0 && config.requireIdentitySets) {
        return { ok: false, error: engineError("invalid_setup", `nemesis set ${identityCard.nemesisEncounterSetId} has no cards in the pool`) };
      }
      for (const card of nemesis) {
        for (let copy = 0; copy < card.quantityInSet; copy++) {
          const nemesisInstanceId = nextId();
          instances[nemesisInstanceId] = blankInstance(nemesisInstanceId, card.id, null);
          setAside.push(nemesisInstanceId);
        }
      }
    }
    players.push({
      playerId: id,
      seatIndex,
      // RRG Appendix II step 1: each player begins in alter-ego form.
      identity: {
        instanceId: identityInstanceId,
        cardId: identityCard.id,
        form: "alterEgo",
        changedFormThisRound: false,
      },
      hand: [],
      deck,
      discard: [],
      playArea: [],
      dealtEncounter: [],
      resolving: [],
      setAside,
      eliminated: false,
    });
  }

  const encounterDeck: InstanceId[] = [];
  for (const cardId of config.encounterDeck) {
    const card = pool[cardId];
    if (!card) return { ok: false, error: engineError("invalid_setup", `unknown encounter card ${cardId}`) };
    const cardInstanceId = nextId();
    instances[cardInstanceId] = blankInstance(cardInstanceId, card.id, null);
    encounterDeck.push(cardInstanceId);
  }
  encounterDeck.push(...obligationIds);

  const firstIndex = config.firstPlayerIndex ?? 0;
  const firstPlayer = players[firstIndex];
  if (!firstPlayer) {
    return { ok: false, error: engineError("invalid_setup", `no player at seat ${firstIndex}`) };
  }

  const state: GameState = {
    round: 1,
    step: { phase: "setup", kind: "drawStartingHands" },
    firstPlayerId: firstPlayer.playerId,
    startingPlayerCount: players.length,
    players,
    villain: {
      instanceId: villainInstanceId,
      cardId: villainCard.id,
      side,
      stageIndex: villainStageIndex,
      lastStageIndex,
      defeated: false,
    },
    mainScheme: {
      instanceId: mainSchemeInstanceId,
      cardId: mainSchemeCard.id,
      stageIndex: 0,
      completed: false,
      accelerationTokens: 0,
    },
    encounterDeck,
    encounterDiscard: [],
    villainArea: [],
    victoryDisplay: [],
    removedFromGame: [],
    instances,
    cardPool: pool,
    stack: [],
    abilityUses: {},
    lastingEffects: [],
    pendingChoice: null,
    outcome: null,
    rng: createRng(config.seed),
    nextInstanceSeq: seq,
    nextChoiceSeq: 1,
    nextFrameSeq: 1,
    nextLastingSeq: 1,
  };

  const ctx: Ctx = createCtx(state, deps);
  emit(ctx, {
    type: "gameCreated",
    playerIds: players.map((p) => p.playerId),
    firstPlayerId: firstPlayer.playerId,
    seed: config.seed,
  });

  for (const player of players) {
    const shuffled = shuffleZone(ctx, { kind: "deck", playerId: player.playerId }, player.deck);
    ctx.state = {
      ...ctx.state,
      players: ctx.state.players.map((p) => (p.playerId === player.playerId ? { ...p, deck: shuffled } : p)),
    };
  }
  const shuffledEncounter = shuffleZone(ctx, { kind: "encounterDeck" }, ctx.state.encounterDeck);
  ctx.state = { ...ctx.state, encounterDeck: shuffledEncounter };

  const startingThreat = scale(mainSchemeStage(ctx.state).startingThreat, ctx.state.startingPlayerCount);
  if (startingThreat > 0) {
    updateInstance(ctx, mainSchemeInstanceId, (i) => ({ ...i, threat: i.threat + startingThreat }));
    emit(ctx, {
      type: "threatPlaced",
      schemeInstanceId: mainSchemeInstanceId,
      amount: startingThreat,
      sourceInstanceId: null,
    });
  }

  // RRG "Toughness": the villain's starting stage enters play with its tough status.
  if (hasKeyword(ctx.state, villainInstanceId, "toughness", deps)) giveStatus(ctx, villainInstanceId, "tough");
  putSetupCardsIntoPlay(ctx, firstPlayer.playerId);
  // RRG Appendix II step 12: main scheme 1A setup text, then the villain's.
  // "Advance to stage 1B" is implicit (the engine already sits on 1B), so 1B's
  // own "When Revealed" resolves right after the 1A setup text.
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, mainSchemeInstanceId, ["setup"], null, mainSchemeStage(ctx.state).aSide.abilities, firstPlayer.playerId),
    ...gameAbilityFrames(ctx, mainSchemeInstanceId, ["setup"], null, undefined, firstPlayer.playerId),
    ...gameAbilityFrames(ctx, mainSchemeInstanceId, ["whenRevealed"], null, undefined, firstPlayer.playerId),
    ...gameAbilityFrames(ctx, villainInstanceId, ["setup"], null, undefined, firstPlayer.playerId),
    // RRG Appendix II "Resolve Scenario Setup and When Revealed Abilities": the starting villain
    // stage is revealed too (expert Rhino II reveals Breakin' & Takin' during setup).
    ...gameAbilityFrames(ctx, villainInstanceId, ["whenRevealed"], null, undefined, firstPlayer.playerId),
    // Identity "Setup:" abilities (T'Challa's Foresight) — player cards resolve during setup only via this trigger.
    ...ctx.state.players.flatMap((player) => gameAbilityFrames(ctx, player.identity.instanceId, ["setup"], null)),
  ]);
  // Steps 14 (draw) and 15 (mulligan) run as flow steps, so they happen after
  // the setup cards and setup abilities above have fully resolved.
  runFlow(ctx);

  return { ok: true, state: ctx.state, events: ctx.events };
}

/** RRG Appendix II step 11: every card with the setup keyword begins the game in play. */
function putSetupCardsIntoPlay(ctx: Ctx, revealingPlayerId: PlayerId): void {
  for (const id of [...ctx.state.encounterDeck]) {
    if (!hasKeyword(ctx.state, id, "setup")) continue;
    updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
    enterPlayOnReveal(ctx, id, revealingPlayerId);
  }
  for (const player of ctx.state.players) {
    for (const id of [...player.deck]) {
      if (!hasKeyword(ctx.state, id, "setup")) continue;
      const card = mustCardOf(ctx.state, id);
      updateInstance(ctx, id, (i) => ({ ...i, faceup: true, controllerId: player.playerId }));
      if (card.type === "upgrade") {
        moveCard(ctx, id, { kind: "attachment", hostInstanceId: player.identity.instanceId });
      } else {
        moveCard(ctx, id, { kind: "playArea", playerId: player.playerId });
      }
      applyEnterPlayKeywords(ctx, id);
      announce(ctx, { kind: "cardEntersPlay", instanceId: id, playerId: player.playerId });
    }
  }
}
