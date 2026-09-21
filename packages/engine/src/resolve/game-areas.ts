/**
 * Separate game areas, set-aside villains and alternative main scheme stages (docs/phase7-wave2.md §3.1, §3.4): the
 * state changes behind `createGameArea`, `joinGameArea`, `revealMainSchemeStage`, `removeMainSchemeStage`,
 * `addVillain` and `removeVillain`. Rules text is The Once and Future Kang insert, "Playing With Separate Game Areas"
 * and "Rules Clarifications", quoted in docs/phase7-wave2.md §3.1. Engine code never names a card.
 */

import { type Ctx, emit, moveCard, nextInstanceId, updateInstance } from "../ctx.js";
import { discardFromPlay, giveStatus, setActiveVillain } from "../effects.js";
import { gameAreaId, type GameAreaId, type InstanceId, type PlayerId } from "../ids.js";
import { hasKeyword } from "../keywords.js";
import {
  areaOfCard,
  discardZoneFor,
  getInstance,
  mainSchemeStageOf,
  mainSchemeValue,
  mustCard,
  mustInstance,
  playerOrder,
  villainOf,
} from "../query.js";
import { nextInt } from "../rng.js";
import { cardsInPlay } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { StackFrame } from "../stack.js";
import {
  NO_STATUSES,
  type CardInstance,
  type GameAreaState,
  type GameState,
  type MainSchemeState,
  type VillainState,
} from "../state.js";
import { cardsMatch } from "../unique.js";
import { base, eventFrame, gameAbilityFrames } from "./frames.js";

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
 * "Remove the Chronopolis from the game": a separate game area's own stage leaves play, and it can never be revealed
 * again. The central stage is not removable this way (nothing prints that), so it is left alone.
 */
export function removeMainSchemeStage(ctx: Ctx, schemeId: InstanceId): void {
  const area = ctx.state.gameAreas.find((candidate) => candidate.mainScheme?.instanceId === schemeId);
  const pending = ctx.state.revealedMainSchemes.find((scheme) => scheme.instanceId === schemeId);
  const scheme = area?.mainScheme ?? pending;
  if (!scheme) return;
  for (const attachment of [...mustInstance(ctx.state, schemeId).attachments]) discardFromPlay(ctx, attachment);
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
 */
export function joinGameArea(ctx: Ctx, fromId: GameAreaId, intoId: GameAreaId | null): readonly StackFrame[] {
  const from = ctx.state.gameAreas.find((area) => area.areaId === fromId);
  if (!from || fromId === intoId) return [];
  if (from.mainScheme) removeMainSchemeStage(ctx, from.mainScheme.instanceId);
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
      (other) => !handled.has(other) && cardsMatch(card, mustCard(ctx.state, mustInstance(ctx.state, other).cardId)),
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
 * Revealed frames when `reveal`.
 */
export function addVillains(
  ctx: Ctx,
  ids: readonly InstanceId[],
  area: GameAreaState | null,
  reveal: boolean,
  actingPlayerId: PlayerId,
): readonly StackFrame[] {
  const frames: StackFrame[] = [];
  for (const id of ids) {
    if (!ctx.state.encounterSetAside.includes(id) || villainOf(ctx.state, id)) continue;
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
        home.kind === "encounterDeck"
          ? home.deckId
          : (ctx.state.encounterDeckOrder[0] as VillainState["encounterDeckId"]),
      signatureSideSchemeId: null,
    };
    ctx.state = {
      ...ctx.state,
      villains: [...ctx.state.villains, villain],
      encounterSetAside: ctx.state.encounterSetAside.filter((other) => other !== id),
    };
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
    if (hasKeyword(ctx.state, id, "toughness", ctx.deps)) giveStatus(ctx, id, "tough");
    if (reveal) frames.push(...gameAbilityFrames(ctx, id, ["whenRevealed"], null, undefined, actingPlayerId));
  }
  return frames;
}

/**
 * "Remove Kang (Immortus) … from the game": the villain leaves play without being defeated — no When Defeated and no
 * win. Its attachments and boost cards are discarded as it leaves (RRG 1.8 "Leaves Play", p. 27, as for a defeated
 * villain), and its area (or the game) passes the active counter on.
 */
export function removeVillains(ctx: Ctx, ids: readonly InstanceId[]): void {
  for (const id of ids) {
    const villain = villainOf(ctx.state, id);
    if (!villain || villain.defeated) continue;
    const instance = mustInstance(ctx.state, id);
    for (const attachment of [...instance.attachments]) discardFromPlay(ctx, attachment);
    for (const boost of [...instance.boostCards]) moveCard(ctx, boost, discardZoneFor(ctx.state, boost), "top");
    ctx.state = {
      ...ctx.state,
      villains: ctx.state.villains.map((v) => (v.instanceId === id ? { ...v, defeated: true } : v)),
    };
    for (const area of ctx.state.gameAreas.filter((a) => a.villainIds.includes(id))) {
      // It stays listed in its area (out of play, like a defeated villain), so text resolving for it still knows where.
      updateArea(ctx, area.areaId, (a) => ({
        ...a,
        activeVillainId: a.activeVillainId === id ? nextAreaVillain(ctx.state, a, id) : a.activeVillainId,
      }));
    }
    emit(ctx, { type: "villainRemoved", instanceId: id });
    if (ctx.state.activeVillainId === id) {
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
