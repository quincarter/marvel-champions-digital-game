import type { AnyCard, CardId, CoreAspect, DeckCardEntry, DeckContents, HeroIdentityCard } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "./abilities.js";
import { validateDeck } from "./deck.js";
import { createCtx, emit, moveCard, pushFrames, updateInstance, type Ctx } from "./ctx.js";
import { giveStatus, shuffleZone } from "./effects.js";
import { engineError, type EngineError } from "./errors.js";
import { runFlow } from "./flow.js";
import { encounterDeckId, instanceId, playerId, type EncounterDeckId, type InstanceId, type PlayerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { createRng } from "./rng.js";
import { cardsMatch } from "./unique.js";
import { encounterDeckOf, mainSchemeStage, mainSchemeValue, mustCardOf } from "./query.js";
import {
  announce,
  applyEnterPlayKeywords,
  enterPlayOnReveal,
  gameAbilityFrames,
  shuffleSeparateDeck,
} from "./resolve/index.js";
import {
  NO_STATUSES,
  type CardHome,
  type CardInstance,
  type EncounterDeckState,
  type GameState,
  type PlayerState,
  type SeparateDeckState,
  type VillainState,
} from "./state.js";
import type { GameEvent } from "./events.js";

export interface PlayerSetup {
  readonly identityCardId: CardId;
  readonly deck: readonly CardId[];
  /** The deck's chosen aspect(s). Only read when `GameSetupConfig.requireLegalDecks` is set, where an absent choice is an illegal deck. */
  readonly aspects?: readonly CoreAspect[];
}

/** A seat's expanded deck list collapsed into decklist lines, in first-appearance order. */
const deckContentsOf = (setup: PlayerSetup): DeckContents => {
  const quantities = new Map<CardId, number>();
  for (const id of setup.deck) quantities.set(id, (quantities.get(id) ?? 0) + 1);
  const cards: DeckCardEntry[] = [...quantities].map(([cardId, quantity]) => ({ cardId, quantity }));
  return { identityCardId: setup.identityCardId, aspects: setup.aspects ?? [], cards };
};

/**
 * One villain of a scenario with several villains in play at once (`Scenario.multipleVillains`; The Wrecking Crew
 * insert, "Prepare Villains and Dials" and "Prepare Encounter Decks").
 */
export interface VillainSetup {
  readonly villainCardId: CardId;
  /** Absent: the card's `startingSide`, else "A". */
  readonly side?: "A" | "B";
  /** Its first stage (version A: 0, version B: 1). Default 0. */
  readonly startStageIndex?: number;
  /** Its last stage (the extreme challenge starts on A with B last). Defaults to the side's last stage. */
  readonly lastStageIndex?: number;
  /**
   * The printed version this villain plays at, as shorthand for the two stage indexes (The Wrecking Crew insert,
   * "Adjustable Difficulty"): `"A"` is the version-A stage alone (standard), `"B"` the version-B stage alone
   * (expert), and `"extreme"` starts on A with B under it — "When the version A of a villain is defeated, its
   * version B enters play, and the game is won only after all version-B villains are defeated", which is an ordinary
   * stage advance (docs/phase7-wave1.md §4.6). Each villain chooses its own, so a mixed table is legal. Setting it
   * alongside `startStageIndex` / `lastStageIndex` is refused rather than silently resolved.
   */
  readonly version?: "A" | "B" | "extreme";
  /** This villain's own encounter deck: "Each villain … has its own encounter deck of 15 cards". */
  readonly encounterDeck: readonly CardId[];
  /** Its signature side scheme, created set aside (`encounterSetAside`) and linked to this villain. */
  readonly signatureSideSchemeCardId?: CardId;
}

export interface GameSetupConfig {
  readonly seed: number;
  /** Every card the game can reference; stored in state so a save replays standalone. */
  readonly cards: readonly AnyCard[];
  /** The villain; with `villains`, the first of them. */
  readonly villainCardId: CardId;
  /** Absent: the card's `startingSide`, else "A". */
  readonly villainSide?: "A" | "B";
  /** Standard play starts at stage I, expert at stage II (RRG "Modes of Play"). */
  readonly villainStartStageIndex?: number;
  /** The last villain stage used (standard: stage II, expert: stage III). Defaults to the side's last stage. */
  readonly villainLastStageIndex?: number;
  /**
   * Several villains in play at once, in printed order, each with its own encounter deck and optional signature
   * side scheme. When set, `villainCardId` must name the first of them, `encounterDeck` must be empty and the
   * single-villain side/stage fields must be absent: each villain carries its own. The first villain starts with
   * the active counter; a setup ability moves it (`setActiveVillain`).
   */
  readonly villains?: readonly VillainSetup[];
  /**
   * RRG Appendix II: each identity's obligation (`HeroIdentityCard.obligationCardId`) is shuffled into the
   * encounter deck and its nemesis set (`nemesisEncounterSetId`, `quantityInSet` copies of each card) is set
   * aside. Cards missing from `cards` are skipped unless `requireIdentitySets` is set. Default true.
   */
  readonly includeIdentitySets?: boolean;
  readonly requireIdentitySets?: boolean;
  /**
   * Refuse any seat whose deck is not legal under the RRG deckbuilding rules (`validateDeck`),
   * with `illegal_deck`. Off by default so engine tests can seat small synthetic decks. Real
   * content (`coreScenario`) turns it on. There is no "play it anyway" opt-out for real games.
   */
  readonly requireLegalDecks?: boolean;
  readonly mainSchemeCardId: CardId;
  /** The encounter deck of a single-villain scenario. Empty when `villains` gives each villain its own. */
  readonly encounterDeck: readonly CardId[];
  readonly players: readonly PlayerSetup[];
  readonly firstPlayerIndex?: number;
}

export type SetupResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: EngineError };

const PLAYER_HOME: CardHome = { kind: "player" };
const ACTIVE_DECK_HOME: CardHome = { kind: "activeEncounterDeck" };

const blankInstance = (id: InstanceId, cardId: CardId, ownerId: PlayerId | null, home: CardHome): CardInstance => ({
  instanceId: id,
  cardId,
  ownerId,
  controllerId: ownerId,
  home,
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
  flipped: false,
});

/**
 * How the engine names a colliding hero to a client: "Captain Marvel (Carol Danvers)".
 *
 * `uniqueLabel` from `./unique.js` would print the same string for an identity; this wrapper
 * only pins the type so the setup message always names the person behind the mask.
 */
const identityLabel = (card: HeroIdentityCard): string => `${card.name} (${card.alterEgo.faceName})`;

const invalid = (message: string): SetupResult => ({ ok: false, error: engineError("invalid_setup", message) });

/**
 * The stage range each printed version plays at (The Wrecking Crew insert, "Adjustable Difficulty"; §1.2's standard
 * `[1, 1]` and expert `[2, 2]` as indexes, and the extreme challenge's A-then-B).
 */
const VERSION_STAGES: Record<"A" | "B" | "extreme", readonly [number, number]> = {
  A: [0, 0],
  B: [1, 1],
  extreme: [0, 1],
};

/** A villain as setup will create it, checked against the pool. */
interface PlannedVillain {
  readonly card: AnyCard & { readonly type: "villain" };
  readonly side: "A" | "B";
  readonly startStageIndex: number;
  readonly lastStageIndex: number;
  readonly encounterDeck: readonly CardId[];
  readonly signatureSideSchemeCardId: CardId | null;
}

/** The villains to create, one-villain configs included, or the reason the config is malformed. */
function planVillains(config: GameSetupConfig, pool: Readonly<Record<string, AnyCard>>): readonly PlannedVillain[] | string {
  let setups: readonly VillainSetup[];
  if (config.villains) {
    const [first] = config.villains;
    if (!first) return "villains must list at least one villain";
    if (first.villainCardId !== config.villainCardId) return "villainCardId must name the first of villains";
    if (config.encounterDeck.length > 0) return "with villains, each villain has its own encounterDeck; encounterDeck must be empty";
    if (config.villainSide !== undefined || config.villainStartStageIndex !== undefined || config.villainLastStageIndex !== undefined) {
      return "with villains, side and stages are set per villain";
    }
    const ids = config.villains.map((v) => v.villainCardId);
    if (new Set(ids).size !== ids.length) return "villains lists the same villain twice";
    setups = config.villains;
  } else {
    setups = [
      {
        villainCardId: config.villainCardId,
        encounterDeck: config.encounterDeck,
        ...(config.villainSide !== undefined ? { side: config.villainSide } : {}),
        ...(config.villainStartStageIndex !== undefined ? { startStageIndex: config.villainStartStageIndex } : {}),
        ...(config.villainLastStageIndex !== undefined ? { lastStageIndex: config.villainLastStageIndex } : {}),
      },
    ];
  }
  const planned: PlannedVillain[] = [];
  for (const setup of setups) {
    const card = pool[setup.villainCardId];
    if (!card || card.type !== "villain") return `${setup.villainCardId} is not a villain card`;
    const side = setup.side ?? card.startingSide ?? "A";
    const villainSide = card.sides.find((s) => s.side === side);
    if (!villainSide) return `villain has no side ${side}`;
    if (setup.version !== undefined && (setup.startStageIndex !== undefined || setup.lastStageIndex !== undefined)) {
      return `${setup.villainCardId} sets both a version and explicit stage indexes`;
    }
    const range = setup.version ? VERSION_STAGES[setup.version] : null;
    const startStageIndex = range ? range[0] : (setup.startStageIndex ?? 0);
    if (!villainSide.stages[startStageIndex]) return `villain has no stage index ${startStageIndex}`;
    const lastStageIndex = range ? range[1] : (setup.lastStageIndex ?? villainSide.stages.length - 1);
    if (!villainSide.stages[lastStageIndex] || lastStageIndex < startStageIndex) return `villain has no last stage index ${lastStageIndex}`;
    const scheme = setup.signatureSideSchemeCardId;
    if (scheme !== undefined && pool[scheme]?.type !== "side_scheme") return `${scheme} is not a side scheme card`;
    planned.push({ card, side, startStageIndex, lastStageIndex, encounterDeck: setup.encounterDeck, signatureSideSchemeCardId: scheme ?? null });
  }
  return planned;
}

/** RRG Appendix II: Setup, minus obligations/nemesis sets/setup abilities (they need slice 2). */
export function createGame(config: GameSetupConfig, deps: EngineDeps = DEFAULT_DEPS): SetupResult {
  if (config.players.length < 1 || config.players.length > 4) {
    return invalid("a game has 1–4 players");
  }
  const pool: Record<string, AnyCard> = {};
  for (const card of config.cards) pool[card.id] = card;

  const plannedVillains = planVillains(config, pool);
  if (typeof plannedVillains === "string") return invalid(plannedVillains);
  const mainSchemeCard = pool[config.mainSchemeCardId];
  if (!mainSchemeCard || mainSchemeCard.type !== "main_scheme") {
    return invalid(`${config.mainSchemeCardId} is not a main scheme card`);
  }

  // Deck legality is judged per seat, before any seat is built, and every illegal seat is
  // reported at once. Table-level conflicts (matching identities) come after, as
  // `duplicate_unique_card`.
  if (config.requireLegalDecks) {
    const illegalDecks = config.players.flatMap((setup, seatIndex) => {
      const verdict = validateDeck(deckContentsOf(setup), pool);
      return verdict.ok ? [] : [{ seatIndex, playerId: playerId(`p${seatIndex + 1}`), problems: verdict.problems }];
    });
    if (illegalDecks.length > 0) {
      const message = illegalDecks
        .map((seat) => `${seat.playerId}'s deck is not legal: ${seat.problems.map((p) => p.message).join(" ")}`)
        .join(" ");
      return { ok: false, error: { ...engineError("illegal_deck", message), illegalDecks } };
    }
  }

  let seq = 1;
  const nextId = (): InstanceId => instanceId(`i${seq++}`);
  const instances: Record<string, CardInstance> = {};

  // One encounter deck per villain, "e1", "e2", … in villain order; a single villain has one deck (RRG 1.8
  // "Encounter Deck", p. 17), as before.
  const deckIds: EncounterDeckId[] = plannedVillains.map((_, index) => encounterDeckId(`e${index + 1}`));
  const villainInstanceIds: InstanceId[] = [];
  for (const [index, planned] of plannedVillains.entries()) {
    const id = nextId();
    instances[id] = { ...blankInstance(id, planned.card.id, null, { kind: "encounterDeck", deckId: deckIds[index] as EncounterDeckId }), faceup: true };
    villainInstanceIds.push(id);
  }
  const mainSchemeInstanceId = nextId();
  instances[mainSchemeInstanceId] = { ...blankInstance(mainSchemeInstanceId, mainSchemeCard.id, null, ACTIVE_DECK_HOME), faceup: true };

  const players: PlayerState[] = [];
  const obligationIds: InstanceId[] = [];
  /**
   * Every identity already seated, in seat order. RRG 1.8 "Unique Icon": "When choosing
   * identities during setup, players cannot choose identities that match." Matching is a
   * pairwise relation and not transitive (see `cardsMatch`), so this is a list scanned
   * pairwise rather than a keyed map.
   */
  const seatedIdentities: { readonly playerId: PlayerId; readonly card: HeroIdentityCard }[] = [];
  for (const [seatIndex, setup] of config.players.entries()) {
    const id = playerId(`p${seatIndex + 1}`);
    const identityCard = pool[setup.identityCardId];
    if (!identityCard || identityCard.type !== "hero_identity") {
      return invalid(`${setup.identityCardId} is not an identity card`);
    }
    // RRG 1.8 "Unique Icon" — identities chosen at setup cannot match (see `cardsMatch`).
    const taken = seatedIdentities.find((seated) => cardsMatch(seated.card, identityCard));
    if (taken) {
      return {
        ok: false,
        error: engineError(
          "duplicate_unique_card",
          `${identityLabel(identityCard)} is already in play as ${taken.playerId}: the players as a group may have only one copy of each unique card in play, so ${id} cannot play the same hero`,
        ),
      };
    }
    seatedIdentities.push({ playerId: id, card: identityCard });
    const identityInstanceId = nextId();
    instances[identityInstanceId] = { ...blankInstance(identityInstanceId, identityCard.id, id, PLAYER_HOME), faceup: true };

    const deck: InstanceId[] = [];
    for (const cardId of setup.deck) {
      const card = pool[cardId];
      if (!card) return invalid(`unknown card ${cardId} in ${id}'s deck`);
      const cardInstanceId = nextId();
      instances[cardInstanceId] = blankInstance(cardInstanceId, card.id, id, PLAYER_HOME);
      deck.push(cardInstanceId);
    }
    // Decks the identity brings besides its player deck (docs/phase7-wave1.md §3.5; RRG 1.8 "Deck", p. 15: "Certain
    // identities or scenarios may add other decks to the game"). Owned by this player; shuffled with the player deck.
    const separateDecks: Record<string, SeparateDeckState> = {};
    for (const definition of identityCard.separateDecks ?? []) {
      const ids: InstanceId[] = [];
      for (const entry of definition.cards) {
        const card = pool[entry.cardId];
        if (!card) return invalid(`unknown card ${entry.cardId} in ${identityCard.id}'s ${definition.name} deck`);
        for (let copy = 0; copy < entry.quantity; copy++) {
          const separateInstanceId = nextId();
          instances[separateInstanceId] = blankInstance(separateInstanceId, card.id, id, { kind: "separateDeck", name: definition.name });
          ids.push(separateInstanceId);
        }
      }
      separateDecks[definition.name] = { deck: ids, discard: [] };
    }
    const setAside: InstanceId[] = [];
    if (config.includeIdentitySets !== false) {
      // Obligations and nemesis cards have no encounter deck of their own: a discard sends them to the active
      // villain's (ruling, Jan 17, 2026 (5)).
      const obligation = pool[identityCard.obligationCardId];
      if (obligation) {
        // RRG 1.8 "Obligation" (p. 30): "Each identity is associated with one or more obligation cards. If an identity
        // is being played, all of that identity's associated obligation cards are shuffled into the encounter deck
        // during setup." Scarlet Witch's set holds two copies of Slipping Sanity (FAQ "Slipping Sanity (#23)", p. 61).
        for (let copy = 0; copy < Math.max(1, obligation.quantityInSet); copy++) {
          const obligationInstanceId = nextId();
          instances[obligationInstanceId] = blankInstance(obligationInstanceId, obligation.id, null, ACTIVE_DECK_HOME);
          obligationIds.push(obligationInstanceId);
        }
      } else if (config.requireIdentitySets) {
        return invalid(`obligation ${identityCard.obligationCardId} is not in the card pool`);
      }
      const nemesis = config.cards.filter(
        (card) => "encounterSetIds" in card && card.encounterSetIds.includes(identityCard.nemesisEncounterSetId),
      );
      if (nemesis.length === 0 && config.requireIdentitySets) {
        return invalid(`nemesis set ${identityCard.nemesisEncounterSetId} has no cards in the pool`);
      }
      for (const card of nemesis) {
        for (let copy = 0; copy < card.quantityInSet; copy++) {
          const nemesisInstanceId = nextId();
          instances[nemesisInstanceId] = blankInstance(nemesisInstanceId, card.id, null, ACTIVE_DECK_HOME);
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
      separateDecks,
      eliminated: false,
    });
  }

  const encounterDecks: Record<string, EncounterDeckState> = {};
  for (const [index, planned] of plannedVillains.entries()) {
    const deckId = deckIds[index] as EncounterDeckId;
    const deck: InstanceId[] = [];
    for (const cardId of planned.encounterDeck) {
      const card = pool[cardId];
      if (!card) return invalid(`unknown encounter card ${cardId}`);
      const cardInstanceId = nextId();
      instances[cardInstanceId] = blankInstance(cardInstanceId, card.id, null, { kind: "encounterDeck", deckId });
      deck.push(cardInstanceId);
    }
    // RRG Appendix II step 10: obligations are shuffled into the encounter deck — the first (active) villain's.
    if (index === 0) deck.push(...obligationIds);
    encounterDecks[deckId] = { deck, discard: [] };
  }

  // Signature side schemes are set aside, linked to their villain, until an ability puts them into play.
  const encounterSetAside: InstanceId[] = [];
  const villains: VillainState[] = plannedVillains.map((planned, index) => {
    let signatureSideSchemeId: InstanceId | null = null;
    if (planned.signatureSideSchemeCardId) {
      signatureSideSchemeId = nextId();
      instances[signatureSideSchemeId] = blankInstance(signatureSideSchemeId, planned.signatureSideSchemeCardId, null, {
        kind: "encounterDeck",
        deckId: deckIds[index] as EncounterDeckId,
      });
      encounterSetAside.push(signatureSideSchemeId);
    }
    return {
      instanceId: villainInstanceIds[index] as InstanceId,
      cardId: planned.card.id,
      side: planned.side,
      stageIndex: planned.startStageIndex,
      lastStageIndex: planned.lastStageIndex,
      defeated: false,
      encounterDeckId: deckIds[index] as EncounterDeckId,
      signatureSideSchemeId,
    };
  });

  const firstIndex = config.firstPlayerIndex ?? 0;
  const firstPlayer = players[firstIndex];
  if (!firstPlayer) {
    return invalid(`no player at seat ${firstIndex}`);
  }
  const [firstVillain] = villains;
  if (!firstVillain) return invalid("a game has at least one villain");

  const state: GameState = {
    round: 1,
    step: { phase: "setup", kind: "drawStartingHands" },
    firstPlayerId: firstPlayer.playerId,
    startingPlayerCount: players.length,
    players,
    villains,
    activeVillainId: firstVillain.instanceId,
    mainScheme: {
      instanceId: mainSchemeInstanceId,
      cardId: mainSchemeCard.id,
      stageIndex: 0,
      completed: false,
      accelerationTokens: 0,
    },
    encounterDecks,
    encounterDeckOrder: deckIds,
    encounterSetAside,
    villainArea: [],
    victoryDisplay: [],
    removedFromGame: [],
    instances,
    cardPool: pool,
    stack: [],
    abilityUses: {},
    lastingEffects: [],
    stateChecks: {},
    playedThisRound: {},
    playedByPlayerThisRound: {},
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
    // RRG 1.8 Appendix II step 6 (p. 51), for separate decks too; the top card turns faceup as the identity says.
    for (const name of Object.keys(player.separateDecks)) shuffleSeparateDeck(ctx, player.playerId, name);
  }
  for (const deckId of deckIds) {
    const shuffled = shuffleZone(ctx, { kind: "encounterDeck", deckId }, encounterDeckOf(ctx.state, deckId).deck);
    ctx.state = { ...ctx.state, encounterDecks: { ...ctx.state.encounterDecks, [deckId]: { deck: shuffled, discard: [] } } };
  }

  const startingThreat = mainSchemeValue(ctx.state, "startingThreat", deps);
  if (startingThreat > 0) {
    updateInstance(ctx, mainSchemeInstanceId, (i) => ({ ...i, threat: i.threat + startingThreat }));
    emit(ctx, {
      type: "threatPlaced",
      schemeInstanceId: mainSchemeInstanceId,
      amount: startingThreat,
      sourceInstanceId: null,
    });
  }

  // RRG "Toughness": each villain's starting stage enters play with its tough status.
  for (const villainId of villainInstanceIds) {
    if (hasKeyword(ctx.state, villainId, "toughness", deps)) giveStatus(ctx, villainId, "tough");
  }
  putSetupCardsIntoPlay(ctx, firstPlayer.playerId);
  // RRG Appendix II step 12: main scheme 1A setup text, then each villain's, in printed order.
  // "Advance to stage 1B" is implicit (the engine already sits on 1B), so 1B's
  // own "When Revealed" resolves right after the 1A setup text.
  pushFrames(ctx, [
    ...gameAbilityFrames(ctx, mainSchemeInstanceId, ["setup"], null, mainSchemeStage(ctx.state).aSide.abilities, firstPlayer.playerId),
    ...gameAbilityFrames(ctx, mainSchemeInstanceId, ["setup"], null, undefined, firstPlayer.playerId),
    ...gameAbilityFrames(ctx, mainSchemeInstanceId, ["whenRevealed"], null, undefined, firstPlayer.playerId),
    ...villainInstanceIds.flatMap((villainId) => [
      ...gameAbilityFrames(ctx, villainId, ["setup"], null, undefined, firstPlayer.playerId),
      // RRG Appendix II "Resolve Scenario Setup and When Revealed Abilities": the starting villain
      // stage is revealed too (expert Rhino II reveals Breakin' & Takin' during setup).
      ...gameAbilityFrames(ctx, villainId, ["whenRevealed"], null, undefined, firstPlayer.playerId),
    ]),
  ]);
  // Identity "Setup:" abilities are RRG 1.8 Appendix II step 16 (p. 51), after the draw and the mulligan: they run
  // from the `playerSetupAbilities` flow step (`flow.ts`), not here.
  // Steps 14 (draw) and 15 (mulligan) run as flow steps, so they happen after
  // the setup cards and setup abilities above have fully resolved.
  runFlow(ctx);

  return { ok: true, state: ctx.state, events: ctx.events };
}

/** RRG Appendix II step 11: every card with the setup keyword begins the game in play. */
function putSetupCardsIntoPlay(ctx: Ctx, revealingPlayerId: PlayerId): void {
  for (const deckId of ctx.state.encounterDeckOrder) {
    for (const id of [...encounterDeckOf(ctx.state, deckId).deck]) {
      if (!hasKeyword(ctx.state, id, "setup")) continue;
      updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
      enterPlayOnReveal(ctx, id, revealingPlayerId);
    }
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
