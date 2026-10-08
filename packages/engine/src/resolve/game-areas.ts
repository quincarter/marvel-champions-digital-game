/**
 * Separate game areas, set-aside villains and alternative main scheme stages (docs/phase7-wave2.md §3.1, §3.4): the
 * state changes behind `createGameArea`, `joinGameArea`, `revealMainSchemeStage`, `removeMainSchemeStage`,
 * `addVillain` and `removeVillain`. Rules text is The Once and Future Kang insert, "Playing With Separate Game Areas"
 * and "Rules Clarifications", quoted in docs/phase7-wave2.md §3.1. Engine code never names a card.
 */

import { type Ctx, emit, moveCard, nextInstanceId, updateInstance } from "../ctx.js";
import {
  discardAtOnce,
  discardWithLeavingHost,
  applyToughness,
  setActiveVillain,
  waitsForHostStep,
} from "../effects.js";
import { gameAreaId, type GameAreaId, type InstanceId, type PlayerId } from "../ids.js";
import {
  areaOfCard,
  discardZoneFor,
  getInstance,
  mainSchemeStageOf,
  mainSchemeValue,
  mainSchemeStates,
  mustCard,
  mustInstance,
  nextVillainInActivationOrder,
  playerOrder,
  villainOf,
} from "../query.js";
import { nextInt, shuffle } from "../rng.js";
import { cardsInPlay } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { StackFrame } from "../stack.js";
import type { HostStep } from "../trigger-events.js";
import {
  NO_STATUSES,
  type CardInstance,
  type GameAreaState,
  type GameState,
  type MainSchemeState,
  type VillainState,
} from "../state.js";
import { cardsMatch } from "../unique.js";
import { schemeEntryThreat } from "./enter-play.js";
import { base, eventFrame, gameAbilityFrames, pushEvent } from "./frames.js";
import { waitingSetupCardsEnterPlay } from "./setup-cards.js";

const setAreas = (ctx: Ctx, gameAreas: readonly GameAreaState[]): void => {
  ctx.state = { ...ctx.state, gameAreas };
};

const updateArea = (ctx: Ctx, areaId: GameAreaId, update: (area: GameAreaState) => GameAreaState): void =>
  setAreas(
    ctx,
    ctx.state.gameAreas.map((area) => (area.areaId === areaId ? update(area) : area)),
  );

/** The first undefeated villain of an area's list, the one that takes its active counter when the current one leaves. */
const nextAreaVillain = (state: GameState, area: GameAreaState, leaving: InstanceId): InstanceId | null =>
  area.villainIds.find((id) => id !== leaving && villainOf(state, id)?.defeated === false) ?? null;

// ---- Alternative main scheme stages --------------------------------------------------------------------------

/**
 * "Each player reveals a random stage 3A in turn order. Remove any unused stage 3 schemes from the game." (The Master
 * of Time 2A). Returns the frames to push: per player, the stage's A-side When Revealed (with that player as "you"),
 * its B-side When Revealed, then its starting threat, one player's reveal entirely before the next (RRG 1.8 "In Player
 * Order", p. 23). The pick is random among the stages of that number not yet spent, from the game's seeded RNG.
 */
export function revealMainSchemeStages(
  ctx: Ctx,
  players: readonly PlayerId[],
  stageNumber: number,
  removeUnused: boolean,
): readonly StackFrame[] {
  const card = mustCard(ctx.state, ctx.state.mainScheme.cardId);
  if (card.type !== "main_scheme") return [];
  const available = (): number[] =>
    card.stages.flatMap((stage, index) =>
      stage.stageNumber === stageNumber && !ctx.state.spentMainSchemeStages.includes(index) ? [index] : [],
    );
  const frames: StackFrame[] = [];
  for (const playerId of players) {
    const pool = available();
    if (pool.length === 0) break;
    const [pick, rng] = nextInt(ctx.state.rng, pool.length);
    const stageIndex = pool[pick] as number;
    const id = nextInstanceId(ctx);
    const instance: CardInstance = {
      instanceId: id,
      cardId: card.id,
      ownerId: null,
      controllerId: null,
      home: { kind: "activeEncounterDeck" },
      faceup: true,
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
    };
    const scheme: MainSchemeState = {
      instanceId: id,
      cardId: card.id,
      stageIndex,
      completed: false,
      accelerationTokens: 0,
    };
    ctx.state = {
      ...ctx.state,
      rng,
      instances: { ...ctx.state.instances, [id]: instance },
      spentMainSchemeStages: [...ctx.state.spentMainSchemeStages, stageIndex],
      revealedMainSchemes: [...ctx.state.revealedMainSchemes, scheme],
    };
    emit(ctx, { type: "mainSchemeStageRevealed", schemeInstanceId: id, stageIndex, playerId });
    const stage = mainSchemeStageOf(ctx.state, scheme);
    frames.push(
      ...gameAbilityFrames(ctx, id, ["whenRevealed"], null, stage.aSide.abilities, playerId),
      ...gameAbilityFrames(ctx, id, ["whenRevealed"], null, stage.abilities, playerId),
      eventFrame(ctx, {
        kind: "placeThreat",
        schemeInstanceId: id,
        amount: mainSchemeValue(ctx.state, "startingThreat", ctx.deps, scheme),
        sourceInstanceId: null,
      }),
    );
  }
  if (removeUnused) {
    for (const stageIndex of available()) {
      ctx.state = { ...ctx.state, spentMainSchemeStages: [...ctx.state.spentMainSchemeStages, stageIndex] };
      emit(ctx, { type: "mainSchemeStageRemoved", schemeInstanceId: null, stageIndex });
    }
  }
  return frames;
}

/**
 * "Reveal stage 2A and put it into play next to this stage so there are two main schemes and two villains in play"
 * (Under Siege 1A, Tower Defense, `mts` 21098a; docs/phase7-wave4.md §3.2). The main scheme card's first unspent stage
 * with `stageNumber` (and `name`, when given) becomes a second main scheme in the shared game area
 * (`GameState.extraMainSchemes`), in play at once, so its A side's When Revealed ("Put the Focused Defense attachment
 * into play attached to this stage") finds it. Returns the frames: its A-side When Revealed, its B-side When Revealed,
 * then its starting threat, as an advance resolves them (RRG 1.8 "Main Scheme", p. 27). The stage is spent, so no reveal
 * or named advance can reach it again.
 */
export function putMainSchemeStageIntoPlay(
  ctx: Ctx,
  stageNumber: number,
  name: string | undefined,
  playerId: PlayerId,
): readonly StackFrame[] {
  const card = mustCard(ctx.state, ctx.state.mainScheme.cardId);
  if (card.type !== "main_scheme") return [];
  const inPlay = new Set(mainSchemeStates(ctx.state).map((scheme) => `${scheme.cardId}:${scheme.stageIndex}`));
  const stageIndex = card.stages.findIndex(
    (stage, index) =>
      stage.stageNumber === stageNumber &&
      (name === undefined || stage.name === name) &&
      !ctx.state.spentMainSchemeStages.includes(index) &&
      !inPlay.has(`${card.id}:${index}`),
  );
  if (stageIndex < 0) return [];
  const id = nextInstanceId(ctx);
  const instance: CardInstance = {
    instanceId: id,
    cardId: card.id,
    ownerId: null,
    controllerId: null,
    home: { kind: "activeEncounterDeck" },
    faceup: true,
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
  };
  const scheme: MainSchemeState = {
    instanceId: id,
    cardId: card.id,
    stageIndex,
    completed: false,
    accelerationTokens: 0,
  };
  ctx.state = {
    ...ctx.state,
    instances: { ...ctx.state.instances, [id]: instance },
    spentMainSchemeStages: [...ctx.state.spentMainSchemeStages, stageIndex],
    extraMainSchemes: [...(ctx.state.extraMainSchemes ?? []), scheme],
  };
  emit(ctx, { type: "mainSchemeStageRevealed", schemeInstanceId: id, stageIndex, playerId });
  const stage = mainSchemeStageOf(ctx.state, scheme);
  return [
    ...gameAbilityFrames(ctx, id, ["whenRevealed"], null, stage.aSide.abilities, playerId),
    ...gameAbilityFrames(ctx, id, ["whenRevealed"], null, stage.abilities, playerId),
    eventFrame(ctx, {
      kind: "placeThreat",
      schemeInstanceId: id,
      amount: mainSchemeValue(ctx.state, "startingThreat", ctx.deps, scheme),
      sourceInstanceId: null,
    }),
  ];
}

/**
 * "Remove the Chronopolis from the game": a separate game area's own stage leaves play, and it can never be revealed
 * again. The central stage is not removable this way (nothing prints that), so it is left alone.
 *
 * `mayWait`: the removal waits for its attachments' "when this leaves play" interrupts, if one hears them
 * (`waitsForHostStep`, docs/phase7-wave5.md §4.1 Q32). `joinGameArea` waits for them itself, before any of its own
 * changes (§4.1 Q50), so its removal does not wait again.
 */
export function removeMainSchemeStage(ctx: Ctx, schemeId: InstanceId, mayWait = true): void {
  const area = ctx.state.gameAreas.find((candidate) => candidate.mainScheme?.instanceId === schemeId);
  const pending = ctx.state.revealedMainSchemes.find((scheme) => scheme.instanceId === schemeId);
  const scheme = area?.mainScheme ?? pending;
  if (!scheme) return;
  if (mayWait && waitsForHostStep(ctx, [schemeId], { kind: "removeMainSchemeStage", schemeId })) return;
  for (const attachment of [...mustInstance(ctx.state, schemeId).attachments]) discardWithLeavingHost(ctx, attachment);
  if (area)
    updateArea(ctx, area.areaId, (a) => ({
      ...a,
      mainScheme: null,
      formerSchemeIds: [...a.formerSchemeIds, schemeId],
    }));
  ctx.state = {
    ...ctx.state,
    revealedMainSchemes: ctx.state.revealedMainSchemes.filter((s) => s.instanceId !== schemeId),
    spentMainSchemeStages: ctx.state.spentMainSchemeStages.includes(scheme.stageIndex)
      ? ctx.state.spentMainSchemeStages
      : [...ctx.state.spentMainSchemeStages, scheme.stageIndex],
  };
  moveCard(ctx, schemeId, { kind: "removedFromGame" });
  emit(ctx, { type: "mainSchemeStageRemoved", schemeInstanceId: schemeId, stageIndex: scheme.stageIndex });
}

// ---- In-play scenario areas no player controls (docs/phase7-wave8.md §3.33) -------------------------------------

/** `EffectSpec createScenarioPlayArea`: an empty in-play scenario area. Nothing happens if it exists. */
export function createScenarioPlayArea(ctx: Ctx, name: string, closed: boolean): void {
  if (ctx.state.scenarioPlayAreas?.[name]) return;
  ctx.state = { ...ctx.state, scenarioPlayAreas: { ...ctx.state.scenarioPlayAreas, [name]: { cards: [], closed } } };
  emit(ctx, { type: "scenarioPlayAreaCreated", name, closed });
}

/** The card types that sit loose in an in-play scenario area. An upgrade or attachment is there only on a host. */
const LOOSE_IN_SCENARIO_PLAY_AREA: ReadonlySet<string> = new Set([
  "side_scheme",
  "minion",
  "ally",
  "support",
  "environment",
]);

/**
 * Places a card in an in-play scenario area (`putIntoPlay.into`; a play to the area): faceup, with no controller and
 * no engaged player, its owner unchanged (MC45 p. 5: "in play but under no player's control"; RRG 1.8 "Ownership and
 * Control", p. 31). Every card attached to it is in the area with it and under no player's control either.
 *
 * Returns `"entered"` for a card that was out of play (the caller raises its entering play), `"moved"` for one that
 * was in play already, and a refusal otherwise. A side scheme that enters play gets the threat it enters play with.
 */
export function placeInScenarioPlayArea(
  ctx: Ctx,
  id: InstanceId,
  name: string,
): "entered" | "moved" | "noSuchArea" | "cardType" {
  if (!ctx.state.scenarioPlayAreas?.[name]) return "noSuchArea";
  const card = mustCard(ctx.state, mustInstance(ctx.state, id).cardId);
  if (!LOOSE_IN_SCENARIO_PLAY_AREA.has(card.type)) return "cardType";
  const wasInPlay = cardsInPlay(ctx.state).includes(id);
  const before = mustInstance(ctx.state, id);
  moveCard(ctx, id, { kind: "scenarioPlayArea", name });
  const release = (cardId: InstanceId): void => {
    updateInstance(ctx, cardId, (i) => ({ ...i, controllerId: null, engagedWith: null }));
    for (const attached of getInstance(ctx.state, cardId)?.attachments ?? []) release(attached);
  };
  release(id);
  updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
  emit(ctx, {
    type: "scenarioPlayAreaEntered",
    name,
    instanceId: id,
    cardId: card.id,
    from: wasInPlay ? "inPlay" : "outOfPlay",
    controllerBefore: wasInPlay ? before.controllerId : null,
    engagedBefore: wasInPlay ? before.engagedWith : null,
  });
  if (wasInPlay) return "moved";
  // RRG 1.8 "Hinder X" (p. 22): one placement, starting threat and hinder together, as for any entry (`reveal.ts`).
  if (card.type === "side_scheme") {
    const amount = schemeEntryThreat(ctx, id);
    pushEvent(ctx, { kind: "placeThreat", schemeInstanceId: id, amount, sourceInstanceId: null });
  }
  return "entered";
}

// ---- Creating and joining areas --------------------------------------------------------------------------------

/**
 * "Create your own game area and place this scheme in it": a new area for `playerId`, whose main scheme is the stage
 * `schemeId` names (a stage `revealMainSchemeStages` revealed). Refused outside a scenario with separate game areas, or
 * for a scheme that isn't a revealed stage; a player already in an area leaves it (their old area keeps the rest).
 */
export function createGameArea(ctx: Ctx, schemeId: InstanceId, playerId: PlayerId): void {
  if (!ctx.state.scenarioRules.separateGameAreas) return;
  const scheme = ctx.state.revealedMainSchemes.find((candidate) => candidate.instanceId === schemeId);
  if (!scheme) return;
  const areaId = gameAreaId(`a${ctx.state.nextGameAreaSeq}`);
  const area: GameAreaState = {
    areaId,
    playerIds: [playerId],
    mainScheme: scheme,
    villainIds: [],
    activeVillainId: null,
    sideSchemeIds: [],
    formerSchemeIds: [],
  };
  ctx.state = {
    ...ctx.state,
    nextGameAreaSeq: ctx.state.nextGameAreaSeq + 1,
    revealedMainSchemes: ctx.state.revealedMainSchemes.filter((candidate) => candidate.instanceId !== schemeId),
    gameAreas: [
      ...ctx.state.gameAreas.map((a) => ({ ...a, playerIds: a.playerIds.filter((id) => id !== playerId) })),
      area,
    ],
  };
  emit(ctx, { type: "gameAreaCreated", areaId, playerIds: [playerId], schemeInstanceId: schemeId });
}

/**
 * Moves every player of `from` into `into` (null: the central area, which ends the split). The area's side schemes and
 * villains go with them; engaged minions follow their players by being in their play areas; the area's own stage, if a
 * card hasn't removed it yet, is removed from the game (it cannot be in two areas). Returns the frames that discard
 * duplicate unique cards in the area the players joined.
 *
 * The stage's removal takes its attachments out of play, so the whole join waits for their "when this leaves play"
 * interrupts first, as the other host steps do (`waitsForHostStep`, docs/phase7-wave5.md §4.1 Q32, Q50), and then runs
 * from the stack (`runHostStep`, which pushes the returned frames). Waiting before anything moves is sound: the removal
 * is the join's first change, so the interrupts see both areas exactly as they were. The areas are read again when it
 * runs; a join whose areas an interrupt dissolved in the meantime does nothing.
 */
export function joinGameArea(ctx: Ctx, fromId: GameAreaId, intoId: GameAreaId | null): readonly StackFrame[] {
  const from = ctx.state.gameAreas.find((area) => area.areaId === fromId);
  if (!from || fromId === intoId) return [];
  if (intoId !== null && !ctx.state.gameAreas.some((area) => area.areaId === intoId)) return [];
  const schemeId = from.mainScheme?.instanceId;
  if (schemeId !== undefined && waitsForHostStep(ctx, [schemeId], { kind: "joinGameArea", fromId, intoId })) return [];
  // It already waited, just above, so the removal itself does not wait again.
  if (schemeId !== undefined) removeMainSchemeStage(ctx, schemeId, false);
  const leaving = ctx.state.gameAreas.find((area) => area.areaId === fromId) ?? from;
  const movingVillains = leaving.villainIds.filter((id) => villainOf(ctx.state, id)?.defeated === false);
  if (intoId === null) {
    // "Players cannot join this game area unless there are no other game areas remaining" (The Master of Time 2B): the
    // last area dissolves and everyone shares the central area again.
    setAreas(ctx, []);
    const [survivor] = movingVillains;
    if (survivor && villainOf(ctx.state, ctx.state.activeVillainId)?.defeated !== false)
      setActiveVillain(ctx, survivor, "effect");
  } else {
    setAreas(
      ctx,
      ctx.state.gameAreas
        .filter((area) => area.areaId !== fromId)
        .map((area) =>
          area.areaId === intoId
            ? {
                ...area,
                playerIds: [...area.playerIds, ...leaving.playerIds],
                sideSchemeIds: [...area.sideSchemeIds, ...leaving.sideSchemeIds],
                villainIds: [...area.villainIds, ...movingVillains],
                activeVillainId: area.activeVillainId ?? movingVillains[0] ?? null,
              }
            : area,
        ),
    );
  }
  emit(ctx, { type: "gameAreaJoined", fromAreaId: fromId, intoAreaId: intoId, playerIds: leaving.playerIds });
  return duplicateUniqueFrames(ctx, intoId);
}

/**
 * "When players combine game areas, they must discard copies of unique cards until only one of each remains in that
 * game area. If the players cannot agree which one to discard, the first player decides." One choice per set of
 * matching cards, by the first player; an identity is never discarded, so a set holding one loses every other copy.
 */
function duplicateUniqueFrames(ctx: Ctx, areaId: GameAreaId | null): readonly StackFrame[] {
  const inArea = cardsInPlay(ctx.state).filter((id) => {
    const area = areaOfCard(ctx.state, id);
    return getInstance(ctx.state, id)?.faceup === true && (areaId === null || area?.areaId === areaId);
  });
  const handled = new Set<InstanceId>();
  const frames: StackFrame[] = [];
  for (const id of inArea) {
    if (handled.has(id)) continue;
    const card = mustCard(ctx.state, mustInstance(ctx.state, id).cardId);
    if (!card.unique || card.type === "villain") continue;
    const group = inArea.filter(
      (other) =>
        !handled.has(other) &&
        cardsMatch(card, mustCard(ctx.state, mustInstance(ctx.state, other).cardId), ctx.state.tableRules),
    );
    for (const member of group) handled.add(member);
    if (group.length < 2) continue;
    const identities = group.filter(
      (member) => mustCard(ctx.state, mustInstance(ctx.state, member).cardId).type === "hero_identity",
    );
    const discardable = group.filter((member) => !identities.includes(member));
    const count = identities.length > 0 ? discardable.length : discardable.length - 1;
    if (count <= 0) continue;
    const slot = `_duplicates${frames.length}`;
    const effects: readonly EffectSpec[] = [
      {
        kind: "chooseTarget",
        slot: `${slot}.discard`,
        query: { inSlot: slot },
        chooser: { kind: "firstPlayer" },
        count,
      },
      { kind: "discardFromPlay", target: { kind: "slot", slot: `${slot}.discard` } },
    ];
    frames.push({
      ...base(ctx),
      kind: "effects",
      effects,
      cursor: 0,
      bindings: { [slot]: discardable },
      vars: {},
      scopedPlayerId: null,
      selfInstanceId: null,
      controllerId: ctx.state.firstPlayerId,
      event: null,
      eventFrameId: null,
    });
  }
  return frames;
}

// ---- Villains beyond one sequence ----------------------------------------------------------------------------

/**
 * "Add Kang (Immortus) to the game area" / "Reveal Kang (III) and add him to the game area": set-aside villains enter
 * play as additional villains (docs/phase7-wave2.md §3.4). In `area`, each joins it and takes its active counter if it
 * has none; outside any area, one takes the game's active counter when the active villain is defeated. Returns the When
 * Revealed frames when `reveal`, and the villains that entered.
 *
 * A villain set aside after being in play (`setVillainAside`, The Sinister Six; docs/phase7-wave5.md §3.1) re-enters
 * as a new copy: its entry in `GameState.villains` is replaced in place, so its printed order is kept.
 *
 * During setup, in a game whose villains all started set aside (`GameState.villainsEnteringAtSetup`), a villain put
 * into play without `reveal` is noted there: RRG 1.8 Appendix II step 12c (p. 51) resolves its Setup and When Revealed
 * abilities after main scheme 1B's (`resolveVillainSetupAbilities`; docs/phase7-wave7.md §3.42). One that card text
 * reveals resolves its When Revealed here, once, and is not noted.
 *
 * Once the villains of one effect are all in play, a setup-keyword attachment that waited for one enters play
 * (`GameState.setupCardsAwaitingHost`, `setup-cards.ts`).
 */
export function addVillains(
  ctx: Ctx,
  ids: readonly InstanceId[],
  area: GameAreaState | null,
  reveal: boolean,
  actingPlayerId: PlayerId,
  /** `addVillain.row`: the villains enter in a shuffled order and form `GameState.villainRow` (wave 8 §3.7). */
  row?: "shuffled",
): { readonly frames: readonly StackFrame[]; readonly entered: readonly InstanceId[] } {
  const frames: StackFrame[] = [];
  const entered: InstanceId[] = [];
  const entering = ids.filter((id) => {
    const existing = villainOf(ctx.state, id);
    return ctx.state.encounterSetAside.includes(id) && !(existing && !existing.defeated);
  });
  // "Shuffle the … villains, then reveal them in a row from left to right": the seeded RNG decides the order.
  let order: readonly InstanceId[] = entering;
  if (row === "shuffled" && entering.length > 0) {
    const [shuffled, rng] = shuffle(entering, ctx.state.rng);
    ctx.state = { ...ctx.state, rng, villainRow: ctx.state.villainRow ?? [] };
    order = shuffled;
  }
  for (const id of order) {
    const existing = villainOf(ctx.state, id);
    if (!ctx.state.encounterSetAside.includes(id) || (existing && !existing.defeated)) continue;
    const card = mustCard(ctx.state, mustInstance(ctx.state, id).cardId);
    if (card.type !== "villain") continue;
    const side = card.startingSide ?? "A";
    const stages = card.sides.find((s) => s.side === side)?.stages ?? card.sides[0].stages;
    const home = mustInstance(ctx.state, id).home;
    const villain: VillainState = {
      instanceId: id,
      cardId: card.id,
      side,
      stageIndex: 0,
      lastStageIndex: stages.length - 1,
      defeated: false,
      encounterDeckId:
        existing?.encounterDeckId ??
        (home.kind === "encounterDeck"
          ? home.deckId
          : (ctx.state.encounterDeckOrder[0] as VillainState["encounterDeckId"])),
      signatureSideSchemeId: existing?.signatureSideSchemeId ?? null,
    };
    ctx.state = {
      ...ctx.state,
      villains: existing
        ? ctx.state.villains.map((v) => (v.instanceId === id ? villain : v))
        : [...ctx.state.villains, villain],
      encounterSetAside: ctx.state.encounterSetAside.filter((other) => other !== id),
      // Where villains sit in a row, one entering play joins at the right end (docs/phase7-wave8.md §3.7).
      ...(ctx.state.villainRow && !ctx.state.villainRow.includes(id)
        ? { villainRow: [...ctx.state.villainRow, id] }
        : {}),
    };
    entered.push(id);
    updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
    const current = area ? ctx.state.gameAreas.find((a) => a.areaId === area.areaId) : undefined;
    if (current) {
      updateArea(ctx, current.areaId, (a) => ({
        ...a,
        villainIds: [...a.villainIds, id],
        activeVillainId:
          a.activeVillainId && villainOf(ctx.state, a.activeVillainId)?.defeated === false ? a.activeVillainId : id,
      }));
    } else if (villainOf(ctx.state, ctx.state.activeVillainId)?.defeated !== false) {
      setActiveVillain(ctx, id, "effect");
    }
    emit(ctx, { type: "villainAdded", instanceId: id, cardId: card.id, areaId: current?.areaId ?? null });
    // RRG 1.8 "Toughness": the stage enters play with its tough status.
    applyToughness(ctx, id);
    if (reveal) frames.push(...gameAbilityFrames(ctx, id, ["whenRevealed"], null, undefined, actingPlayerId));
    else if (ctx.state.villainsEnteringAtSetup)
      ctx.state = { ...ctx.state, villainsEnteringAtSetup: [...ctx.state.villainsEnteringAtSetup, id] };
  }
  if (row === "shuffled" && ctx.state.villainRow && entered.length > 0) {
    emit(ctx, { type: "villainRowSet", order: ctx.state.villainRow });
    // "Place the active counter on the leftmost villain" (MC45 p. 11).
    const [leftmost] = ctx.state.villainRow;
    if (leftmost && !area) setActiveVillain(ctx, leftmost, "effect");
  }
  // RRG 1.8 Appendix II step 11 (p. 51): a setup-keyword attachment that found no villain in play now has one.
  if (entered.length > 0) waitingSetupCardsEnterPlay(ctx);
  return { frames, entered };
}

/** A villain that leaves play leaves the row (`GameState.villainRow`; docs/phase7-wave8.md §3.7). */
export function leaveVillainRow(ctx: Ctx, id: InstanceId): void {
  if (ctx.state.villainRow?.includes(id))
    ctx.state = { ...ctx.state, villainRow: ctx.state.villainRow.filter((other) => other !== id) };
}

/**
 * "Set this villain aside" (docs/phase7-wave5.md §3.1): the villain leaves play if it is in play (attachments and boost
 * cards discarded, RRG 1.8 "Leaves Play", p. 27), returns to the set-aside area as a new copy (damage, status cards,
 * counters and exhaustion cleared, facedown) and stays listed as `defeated`, i.e. out of play. A villain in play that
 * held the active counter passes it on as a defeat would (`passActiveCounter`); one already defeated has done so.
 */
export function setVillainsAside(ctx: Ctx, ids: readonly InstanceId[]): void {
  // Their attachments' "when this leaves play" interrupts first, all in one window (§4.1 Q32–Q33 of wave 5).
  const leaving = ids.filter((id) => villainOf(ctx.state, id) && !ctx.state.encounterSetAside.includes(id));
  if (waitsForHostStep(ctx, leaving, { kind: "setVillainsAside", ids })) return;
  for (const id of ids) {
    const villain = villainOf(ctx.state, id);
    if (!villain || ctx.state.encounterSetAside.includes(id)) continue;
    const instance = mustInstance(ctx.state, id);
    for (const attachment of [...instance.attachments]) discardWithLeavingHost(ctx, attachment);
    for (const boost of [...instance.boostCards]) moveCard(ctx, boost, discardZoneFor(ctx.state, boost), "top");
    const wasInPlay = !villain.defeated;
    ctx.state = {
      ...ctx.state,
      villains: ctx.state.villains.map((v) => (v.instanceId === id ? { ...v, defeated: true } : v)),
      victoryDisplay: ctx.state.victoryDisplay.filter((other) => other !== id),
      encounterSetAside: [...ctx.state.encounterSetAside, id],
    };
    leaveVillainRow(ctx, id);
    updateInstance(ctx, id, (i) => ({
      ...i,
      damage: 0,
      statuses: NO_STATUSES,
      counters: {},
      exhausted: false,
      faceup: false,
      flipped: false,
    }));
    emit(ctx, { type: "villainSetAside", instanceId: id });
    if (wasInPlay && ctx.state.activeVillainId === id) passActiveCounter(ctx, id);
  }
}

/**
 * The active counter leaves `fromId` (defeated or set aside) under `ScenarioRules.activeCounter`: the next villain in
 * the activation order, or nobody (the counter "set aside", MC27 p. 15) when no other villain is in play. Returns false
 * when the scenario uses another rule, so the caller applies its own.
 */
export function passActiveCounter(ctx: Ctx, fromId: InstanceId): boolean {
  if (ctx.state.scenarioRules.activeCounter !== "nextInActivationOrder") return false;
  const next = nextVillainInActivationOrder(ctx.state, fromId);
  if (next) setActiveVillain(ctx, next, "activationOrder");
  return true;
}

/**
 * "Remove Kang (Immortus) … from the game": the villain leaves play without being defeated — no When Defeated and no
 * win. Its attachments and boost cards are discarded as it leaves (RRG 1.8 "Leaves Play", p. 27, as for a defeated
 * villain), and its area (or the game) passes the active counter on.
 */
export function removeVillains(ctx: Ctx, ids: readonly InstanceId[]): void {
  // Their attachments' "when this leaves play" interrupts first, all in one window (§4.1 Q32–Q33 of wave 5).
  const leaving = ids.filter((id) => villainOf(ctx.state, id)?.defeated === false);
  if (waitsForHostStep(ctx, leaving, { kind: "removeVillains", ids })) return;
  for (const id of ids) {
    const villain = villainOf(ctx.state, id);
    if (!villain || villain.defeated) continue;
    const instance = mustInstance(ctx.state, id);
    for (const attachment of [...instance.attachments]) discardWithLeavingHost(ctx, attachment);
    for (const boost of [...instance.boostCards]) moveCard(ctx, boost, discardZoneFor(ctx.state, boost), "top");
    ctx.state = {
      ...ctx.state,
      villains: ctx.state.villains.map((v) => (v.instanceId === id ? { ...v, defeated: true } : v)),
    };
    leaveVillainRow(ctx, id);
    for (const area of ctx.state.gameAreas.filter((a) => a.villainIds.includes(id))) {
      // It stays listed in its area (out of play, like a defeated villain), so text resolving for it still knows where.
      updateArea(ctx, area.areaId, (a) => ({
        ...a,
        activeVillainId: a.activeVillainId === id ? nextAreaVillain(ctx.state, a, id) : a.activeVillainId,
      }));
    }
    emit(ctx, { type: "villainRemoved", instanceId: id });
    if (ctx.state.activeVillainId === id && !passActiveCounter(ctx, id)) {
      const next = ctx.state.villains.find(
        (v) => !v.defeated && !ctx.state.gameAreas.some((a) => a.villainIds.includes(v.instanceId)),
      );
      if (next) setActiveVillain(ctx, next.instanceId, "effect");
    }
  }
}

/**
 * Defeat bookkeeping for a villain in a separate game area: the area's active counter moves to its next undefeated
 * villain, if any. The villain stays listed in the area, out of play, so its When Defeated ("At the end of the phase,
 * join another game area") still resolves in that area.
 */
export function leaveAreaOnDefeat(ctx: Ctx, villainId: InstanceId): boolean {
  const area = ctx.state.gameAreas.find((a) => a.villainIds.includes(villainId));
  if (!area) return false;
  updateArea(ctx, area.areaId, (a) => ({
    ...a,
    activeVillainId: a.activeVillainId === villainId ? nextAreaVillain(ctx.state, a, villainId) : a.activeVillainId,
  }));
  return true;
}

export const controllerOfArea = (state: GameState, area: GameAreaState): PlayerId | null =>
  playerOrder(state).find((player) => area.playerIds.includes(player.playerId))?.playerId ?? null;

// ---- A main scheme stage turned to its other face (docs/phase7-wave5.md §3.3) --------------------------------------

/**
 * A main scheme stage whose card's other face is emitted as its own card (`MainSchemeStage.otherFaceId`, §1.1) turns to
 * that face: Venom Goblin's Skies Over New York A ("Flip this card and set it aside"), and Lower / Midtown / Upper
 * Manhattan on completion (the p. 67 erratum to MC27 p. 17, "When a main scheme is completed, flip it to its environment
 * side"; FAQ, RRG 1.8 p. 62: "flip that main scheme to its environment side and reveal that environment").
 *
 * The stage stops being a main scheme; if it was the central one, the first main scheme beside it takes the central
 * slot (an engine representation only: no rule reads "central" in a scenario with several). Its threat is discarded and
 * its attachments too (RRG 1.8 "Flip", p. 20, a different card type). Its counters and acceleration tokens stay on the
 * card, the tokens as `acceleration` counters, because the environment's own text moves them ("Move the glider counter
 * and each acceleration token from here to the main scheme with the least threat"; card text beats the Flip rule, RRG
 * 1.8 "The Golden Rules", p. 4; §4 Q15). The card then sits in the villain's area as its new face; with `reveal` it
 * enters play and its When Revealed resolves (returned frames). Refused (false) for the only main scheme in play.
 * `"waiting"`: an interrupt hears one of its attachments leaving play, and the flip waits for that window
 * (`waitsForHostStep`, docs/phase7-wave5.md §4.1 Q32), then runs from the stack (`runHostStep`).
 */
export function flipMainSchemeStage(
  ctx: Ctx,
  schemeId: InstanceId,
  reveal: boolean,
  playerId: PlayerId,
  /** The player whose effect flipped it (`cardFlipped.playerId`), carried on the waiting step. */
  flippedBy: PlayerId | null = null,
): readonly StackFrame[] | false | "waiting" {
  const scheme = mainSchemeStates(ctx.state).find((s) => s.instanceId === schemeId);
  if (!scheme || ctx.state.gameAreas.some((a) => a.mainScheme?.instanceId === schemeId)) return false;
  const stage = mainSchemeStageOf(ctx.state, scheme);
  const otherId = stage.otherFaceId;
  const other = otherId !== undefined ? ctx.state.cardPool[otherId] : undefined;
  if (!other) return false;
  const extras = ctx.state.extraMainSchemes ?? [];
  const central = schemeId === ctx.state.mainScheme.instanceId;
  const [promoted, ...rest] = extras;
  if (central && !promoted) return false;
  const hostStep: HostStep = {
    kind: "flipMainSchemeStage",
    schemeId,
    reveal,
    playerId,
    ...(flippedBy ? { flippedBy } : {}),
  };
  if (waitsForHostStep(ctx, [schemeId], hostStep)) return "waiting";
  ctx.state = central
    ? { ...ctx.state, mainScheme: promoted!, extraMainSchemes: rest }
    : { ...ctx.state, extraMainSchemes: extras.filter((s) => s.instanceId !== schemeId) };
  for (const attachment of [...mustInstance(ctx.state, schemeId).attachments]) discardAtOnce(ctx, attachment);
  // What the discard left stays attached, since the stage flips but stays in play: an attachment whose own leaving was
  // cancelled (RRG 1.8 "Cancel", p. 11; §4.1 Q53), and a permanent or "cannot leave play" one, which the Flip rule's
  // discard cannot move (RRG 1.8 "Permanent", p. 32; "Attach To", p. 8; docs/phase7-wave5.md §4.1 Q50).
  const kept = mustInstance(ctx.state, schemeId).attachments;
  const tokens = scheme.accelerationTokens;
  const from = mustInstance(ctx.state, schemeId).cardId;
  updateInstance(ctx, schemeId, (i) => ({
    ...i,
    cardId: other.id,
    threat: 0,
    attachments: kept,
    faceup: true,
    flipped: false,
    counters: tokens > 0 ? { ...i.counters, acceleration: (i.counters["acceleration"] ?? 0) + tokens } : i.counters,
  }));
  moveCard(ctx, schemeId, { kind: "villainArea" });
  emit(ctx, {
    type: "mainSchemeFlippedToOtherFace",
    instanceId: schemeId,
    from,
    to: other.id,
    stageIndex: scheme.stageIndex,
  });
  if (!reveal) return [];
  return [
    ...gameAbilityFrames(ctx, schemeId, ["whenRevealed"], null, undefined, playerId),
    eventFrame(ctx, { kind: "cardEntersPlay", instanceId: schemeId, playerId }),
  ];
}
