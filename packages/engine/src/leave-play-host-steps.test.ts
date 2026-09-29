/**
 * docs/phase7-wave5.md §4.1 Q50: the waiting paths the leave-play rework (`waitsForHostStep`, `runHostStep`; §4.1
 * Q32–Q35, built 75b8f418 and 76fc189e) left untested — a change that is not itself leaving play but takes its
 * attachments out of play with it (`HostStep`): a main scheme stage flipped to its other face (`flipMainSchemeStage`),
 * a card flipped to a different type (`flipToOtherFace`), a main scheme stage removed (`removeMainSchemeStage`) and a
 * villain removed from the game (`removeVillains`). `leaves-play-interrupt-timing.test.ts` already covers
 * `setVillainsAside` and a villain's last stage defeated with another villain remaining (§4.1 Q32's own tests); this
 * file covers the other four `HostStep` kinds plus a cancelled attachment leaving that still lets the host's own
 * change run (`runCarriedHostStep`).
 *
 * Sources: RRG 1.8 "Leaves Play" (p. 27: attachments are discarded "simultaneously" with a host that leaves play),
 * "Interrupt" (p. 25), "Flip" (p. 20), "Double-Sided Card" (p. 17); ruling Jan 17, 2026 (1) #2 (the "Leaves Play"
 * bullets happen as the card leaves, so an interrupt still sees the attachments); docs/phase7-wave5.md §4.1 Q32–Q34
 * (attachments share their host's interrupt/response window, a replacement's move is announced after the "cancelled"
 * line) and §4.1 Q50 (this file).
 */

import { flat, type CardId, type MainSchemeCard, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { gameAreaId, type InstanceId, type PlayerId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import { NO_STATUSES, type CardInstance, type GameAreaState, type GameState, type MainSchemeState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubAttachment,
  stubEnvironment,
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";
import { TREACHERY } from "./testing/scenario.js";

// ---- Shared helpers, matching leaves-play-interrupt-timing.test.ts's idiom -----------------------------------------

const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const mark = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: tracker,
  counterType,
  amount,
});
const one: ValueSpec = { kind: "const", value: 1 };

function trackerWith(...abilities: readonly StubAbility[]) {
  return stubSupport({ id: "tracker", cost: 0, abilities: abilities.map((a) => a.ref) });
}

const index = (events: readonly GameEvent[], found: (e: GameEvent) => boolean) => events.findIndex(found);
const expectReplays = (session: GameSession, deps: EngineDeps) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};

/** Test surgery: `gadget` reparented from P1's play area to be attached to `host`. */
function attachToHost(state: GameState, gadgetId: InstanceId, host: InstanceId): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== gadgetId) } : p,
    ),
    instances: {
      ...state.instances,
      [gadgetId]: { ...mustInstance(state, gadgetId), attachedTo: host },
      [host]: { ...mustInstance(state, host), attachments: [gadgetId] },
    },
  };
}

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};

// ---- Group A: a main scheme stage flipped to its other face (Venom Goblin's shape, §1.1/§3.3) -----------------------

const FLIP_ENV = stubEnvironment({ id: "flip-target-env" });
const RAW_STAGE_CARD: MainSchemeCard = stubMainScheme({
  id: "extra-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const STAGE_CARD: MainSchemeCard = {
  ...RAW_STAGE_CARD,
  stages: [{ ...RAW_STAGE_CARD.stages[0], otherFaceId: FLIP_ENV.id }],
};
const stageStillUnflipped: ValueSpec = { kind: "count", query: { categories: ["mainScheme"], name: "extra-scheme" } };
/** "Interrupt: When this leaves play, …" on the gadget attached to the extra main scheme stage. */
const STAGE_GADGET_INTERRUPT = stubAbility("stage-gadget.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("interrupt", one), mark("hostStillUnflipped", stageStillUnflipped)],
});
const STAGE_GADGET = stubUpgrade({ id: "stage-gadget", cost: 0, abilities: [STAGE_GADGET_INTERRUPT.ref] });
const PLAIN_STAGE_GADGET = stubUpgrade({ id: "stage-gadget", cost: 0 });
const FLIP_STAGE = event("flip-stage", [
  { kind: "flipCard", target: { kind: "each", query: { categories: ["mainScheme"], name: "extra-scheme" } } },
]);

/** A game with the central main scheme as usual, plus `STAGE_CARD` in play beside it (`extraMainSchemes`), its
 * `gadget` attached. */
function stageTable(gadgetCard: UpgradeCard, abilities: readonly StubAbility[]) {
  const TRACKER = trackerWith();
  const deps = depsOf(...abilities, FLIP_STAGE.ability);
  const start = gameAtFirstTurn({
    cards: [FLIP_ENV, STAGE_CARD, gadgetCard, TRACKER, FLIP_STAGE.card],
    deps,
    deck: [gadgetCard.id, TRACKER.id, FLIP_STAGE.card.id],
  });
  const schemeId: InstanceId = "extra-scheme-1" as InstanceId;
  const schemeInstance: CardInstance = {
    instanceId: schemeId,
    cardId: STAGE_CARD.id,
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
  const schemeState: MainSchemeState = {
    instanceId: schemeId,
    cardId: STAGE_CARD.id,
    stageIndex: 0,
    completed: false,
    accelerationTokens: 0,
  };
  const withScheme: GameState = {
    ...start,
    instances: { ...start.instances, [schemeId]: schemeInstance },
    extraMainSchemes: [schemeState],
  };
  const tracker = playerCardIntoPlay(withScheme, TRACKER.id);
  const gadget = playerCardIntoPlay(tracker.state, gadgetCard.id);
  const state = attachToHost(gadget.state, gadget.id, schemeId);
  return { state, deps, schemeId, gadget: gadget.id, tracker: tracker.id };
}

describe("§4.1 Q50 flipMainSchemeStage waits for its attachment's leave interrupt", () => {
  it("the interrupt resolves before the flip, with the stage still unflipped; the flip then proceeds and the attachment discards", () => {
    const t = stageTable(STAGE_GADGET, [STAGE_GADGET_INTERRUPT]);
    const { state, events, session } = playFree(t.state, t.deps, FLIP_STAGE.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({ interrupt: 1, hostStillUnflipped: 1 });
    expect(mustInstance(state, t.schemeId).cardId).toBe(FLIP_ENV.id);
    expect(mustInstance(state, t.schemeId).attachments).toEqual([]);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    const resolvedAt = index(
      events,
      (e) => e.type === "abilityResolved" && e.abilityId === STAGE_GADGET_INTERRUPT.ref.id,
    );
    const flippedAt = index(events, (e) => e.type === "mainSchemeFlippedToOtherFace");
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(flippedAt);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("with nothing listening, the flip logs no cardLeavesPlay and adds no prompt", () => {
    const t = stageTable(PLAIN_STAGE_GADGET, []);
    const { state, events } = playFree(t.state, t.deps, FLIP_STAGE.card.id);
    expect(mustInstance(state, t.schemeId).cardId).toBe(FLIP_ENV.id);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    expect(JSON.stringify(events)).not.toContain("cardLeavesPlay");
    expect(events.some((e) => e.type === "choiceRequested")).toBe(false);
    expect(state.pendingLeftPlay).toBeUndefined();
  });
});

// ---- Group B: a card flipped to a different card type (`flipToOtherFace`, §3.10) -------------------------------------

const FLIP_ALLY = stubAlly({ id: "flip-ally", cost: 0, atk: 1, thw: 1, hp: 2 });
const faces = <A extends { readonly id: CardId }, B extends { readonly id: CardId }>(
  a: A,
  b: B,
): readonly [A & { otherFaceId: CardId }, B & { otherFaceId: CardId }] => [
  { ...a, otherFaceId: b.id },
  { ...b, otherFaceId: a.id },
];
const [FLIP_SCHEME, FLIP_SCHEME_ALLY] = faces(stubSideScheme({ id: "flip-scheme", startingThreat: 2 }), FLIP_ALLY);
const schemeStillASideScheme: ValueSpec = {
  kind: "count",
  query: { categories: ["sideScheme"], name: "flip-scheme" },
};
const FACE_GADGET_INTERRUPT = stubAbility("face-gadget.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("interrupt", one), mark("hostStillSideScheme", schemeStillASideScheme)],
});
const FACE_GADGET = stubUpgrade({ id: "face-gadget", cost: 0, abilities: [FACE_GADGET_INTERRUPT.ref] });
const PLAIN_FACE_GADGET = stubUpgrade({ id: "face-gadget", cost: 0 });
const eachSideScheme: TargetRef = { kind: "each", query: { categories: ["sideScheme"], name: "flip-scheme" } };
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const FLIP_FACE = event("flip-face", [{ kind: "flipCard", target: eachSideScheme }]);

function faceTable(gadgetCard: UpgradeCard, abilities: readonly StubAbility[]) {
  const TRACKER = trackerWith();
  const deps = depsOf(...abilities, REVEAL.ability, FLIP_FACE.ability);
  const base = gameAtFirstTurn({
    cards: [FLIP_SCHEME, FLIP_SCHEME_ALLY, gadgetCard, TRACKER, REVEAL.card, FLIP_FACE.card],
    deps,
    encounter: [FLIP_SCHEME.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [gadgetCard.id, TRACKER.id, REVEAL.card.id, FLIP_FACE.card.id],
  });
  const revealed = playFree(onTopOfEncounterDeck(base, FLIP_SCHEME.id), deps, REVEAL.card.id).state;
  const schemeId = Object.values(revealed.instances).find((i) => i.cardId === FLIP_SCHEME.id)!.instanceId;
  const tracker = playerCardIntoPlay(revealed, TRACKER.id);
  const gadget = playerCardIntoPlay(tracker.state, gadgetCard.id);
  const state = attachToHost(gadget.state, gadget.id, schemeId);
  return { state, deps, schemeId, gadget: gadget.id, tracker: tracker.id };
}

describe("§4.1 Q50 flipToOtherFace waits for its attachment's leave interrupt", () => {
  it("the interrupt resolves before the type change, with the host still a side scheme; the flip then proceeds and the attachment discards", () => {
    const t = faceTable(FACE_GADGET, [FACE_GADGET_INTERRUPT]);
    const { state, events, session } = playFree(t.state, t.deps, FLIP_FACE.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({ interrupt: 1, hostStillSideScheme: 1 });
    expect(mustInstance(state, t.schemeId).cardId).toBe(FLIP_SCHEME_ALLY.id);
    expect(mustInstance(state, t.schemeId).attachments).toEqual([]);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    const resolvedAt = index(
      events,
      (e) => e.type === "abilityResolved" && e.abilityId === FACE_GADGET_INTERRUPT.ref.id,
    );
    const flippedAt = index(events, (e) => e.type === "cardFlippedToOtherFace");
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(flippedAt);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("with nothing listening, the flip logs no cardLeavesPlay and adds no prompt", () => {
    const t = faceTable(PLAIN_FACE_GADGET, []);
    const { state, events } = playFree(t.state, t.deps, FLIP_FACE.card.id);
    expect(mustInstance(state, t.schemeId).cardId).toBe(FLIP_SCHEME_ALLY.id);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    expect(JSON.stringify(events)).not.toContain("cardLeavesPlay");
    expect(events.some((e) => e.type === "choiceRequested")).toBe(false);
    expect(state.pendingLeftPlay).toBeUndefined();
  });
});

// ---- Group C: a main scheme stage removed from the game (a separate game area's own stage, §3.1) --------------------

const AREA_STAGE_CARD: MainSchemeCard = stubMainScheme({
  id: "area-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});
const areaStageStillThere: ValueSpec = { kind: "count", query: { categories: ["mainScheme"], name: "area-scheme" } };
const AREA_GADGET_INTERRUPT = stubAbility("area-gadget.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("interrupt", one), mark("hostStillThere", areaStageStillThere)],
});
const AREA_GADGET = stubUpgrade({ id: "area-gadget", cost: 0, abilities: [AREA_GADGET_INTERRUPT.ref] });
const PLAIN_AREA_GADGET = stubUpgrade({ id: "area-gadget", cost: 0 });
const REMOVE_STAGE = event("remove-stage", [
  { kind: "removeMainSchemeStage", scheme: { kind: "named", name: "area-scheme" } },
]);

/** "Join another game area" (docs/phase7-wave2.md §3.1): with no other area, the split ends. */
const JOIN_AREA = event("join-area", [{ kind: "joinGameArea" }]);

/** `playerIds`: the players in the stage's area (none by default). */
function areaTable(gadgetCard: UpgradeCard, abilities: readonly StubAbility[], playerIds: readonly PlayerId[] = []) {
  const TRACKER = trackerWith();
  const deps = depsOf(...abilities, REMOVE_STAGE.ability, JOIN_AREA.ability);
  const start = gameAtFirstTurn({
    cards: [AREA_STAGE_CARD, gadgetCard, TRACKER, REMOVE_STAGE.card, JOIN_AREA.card],
    deps,
    deck: [gadgetCard.id, TRACKER.id, REMOVE_STAGE.card.id, JOIN_AREA.card.id],
  });
  const schemeId: InstanceId = "area-scheme-1" as InstanceId;
  const schemeInstance: CardInstance = {
    instanceId: schemeId,
    cardId: AREA_STAGE_CARD.id,
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
  const schemeState: MainSchemeState = {
    instanceId: schemeId,
    cardId: AREA_STAGE_CARD.id,
    stageIndex: 0,
    completed: false,
    accelerationTokens: 0,
  };
  const area: GameAreaState = {
    areaId: gameAreaId("a1"),
    playerIds,
    mainScheme: schemeState,
    villainIds: [],
    activeVillainId: null,
    sideSchemeIds: [],
    formerSchemeIds: [],
  };
  const withArea: GameState = {
    ...start,
    instances: { ...start.instances, [schemeId]: schemeInstance },
    gameAreas: [area],
  };
  const tracker = playerCardIntoPlay(withArea, TRACKER.id);
  const gadget = playerCardIntoPlay(tracker.state, gadgetCard.id);
  const state = attachToHost(gadget.state, gadget.id, schemeId);
  return { state, deps, schemeId, gadget: gadget.id, tracker: tracker.id };
}

describe("§4.1 Q50 removeMainSchemeStage waits for its attachment's leave interrupt", () => {
  it("the interrupt resolves first, with the stage still in its area; the stage is then removed from the game and the attachment discards", () => {
    const t = areaTable(AREA_GADGET, [AREA_GADGET_INTERRUPT]);
    const { state, events, session } = playFree(t.state, t.deps, REMOVE_STAGE.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({ interrupt: 1, hostStillThere: 1 });
    expect(state.gameAreas[0]?.mainScheme).toBeNull();
    expect(state.removedFromGame).toContain(t.schemeId);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    const resolvedAt = index(
      events,
      (e) => e.type === "abilityResolved" && e.abilityId === AREA_GADGET_INTERRUPT.ref.id,
    );
    const removedAt = index(events, (e) => e.type === "mainSchemeStageRemoved");
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(removedAt);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("with nothing listening, the removal logs no cardLeavesPlay and adds no prompt", () => {
    const t = areaTable(PLAIN_AREA_GADGET, []);
    const { state, events } = playFree(t.state, t.deps, REMOVE_STAGE.card.id);
    expect(state.removedFromGame).toContain(t.schemeId);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    expect(JSON.stringify(events)).not.toContain("cardLeavesPlay");
    expect(events.some((e) => e.type === "choiceRequested")).toBe(false);
    expect(state.pendingLeftPlay).toBeUndefined();
  });
});

// ---- Group D: a villain removed from the game (not a defeat; §4.1 Q32's own villain-defeat case is already covered
// in leaves-play-interrupt-timing.test.ts) ---------------------------------------------------------------------------

const REMOVABLE_VILLAIN = stubVillain({ id: "removable-villain", stages: [{ hp: flat(5), atk: 0, sch: 0 }] });
const villainStillThere: ValueSpec = { kind: "count", query: { categories: ["villain"] } };
const VILLAIN_GADGET_INTERRUPT = stubAbility("villain-gadget.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("interrupt", one), mark("hostStillThere", villainStillThere)],
});
const VILLAIN_GADGET = stubUpgrade({ id: "villain-gadget", cost: 0, abilities: [VILLAIN_GADGET_INTERRUPT.ref] });
const PLAIN_VILLAIN_GADGET = stubUpgrade({ id: "villain-gadget", cost: 0 });
/** "Forced Interrupt: When [this upgrade] would leave play, cancel that." */
const KEEP_VILLAIN_GADGET = stubAbility("villain-gadget.keep", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("kept", one), { kind: "cancelTriggeringEvent" }],
});
const KEEPING_VILLAIN_GADGET = stubUpgrade({ id: "villain-gadget", cost: 0, abilities: [KEEP_VILLAIN_GADGET.ref] });
const REMOVE_VILLAIN = event("remove-villain", [{ kind: "removeVillain", villain: { kind: "villain" } }]);

function villainTable(gadgetCard: UpgradeCard, abilities: readonly StubAbility[], extra: readonly UpgradeCard[] = []) {
  const TRACKER = trackerWith();
  const deps = depsOf(...abilities, REMOVE_VILLAIN.ability);
  const start = gameAtFirstTurn({
    villain: REMOVABLE_VILLAIN,
    cards: [gadgetCard, TRACKER, REMOVE_VILLAIN.card, ...extra],
    deps,
    deck: [gadgetCard.id, TRACKER.id, REMOVE_VILLAIN.card.id, ...extra.map((card) => card.id)],
  });
  const villainId = start.activeVillainId!;
  const tracker = playerCardIntoPlay(start, TRACKER.id);
  const gadget = playerCardIntoPlay(tracker.state, gadgetCard.id);
  const state = attachToHost(gadget.state, gadget.id, villainId);
  return { state, deps, villainId, gadget: gadget.id, tracker: tracker.id };
}

describe("§4.1 Q50 removeVillain waits for its attachment's leave interrupt", () => {
  it("the interrupt resolves first, with the villain still in play; the villain is then removed and the attachment discards", () => {
    const t = villainTable(VILLAIN_GADGET, [VILLAIN_GADGET_INTERRUPT]);
    const { state, events, session } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({ interrupt: 1, hostStillThere: 1 });
    expect(state.villains.find((v) => v.instanceId === t.villainId)?.defeated).toBe(true);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    const resolvedAt = index(
      events,
      (e) => e.type === "abilityResolved" && e.abilityId === VILLAIN_GADGET_INTERRUPT.ref.id,
    );
    const removedAt = index(events, (e) => e.type === "villainRemoved");
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(removedAt);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("with nothing listening, the removal logs no cardLeavesPlay and adds no prompt", () => {
    const t = villainTable(PLAIN_VILLAIN_GADGET, []);
    const { state, events } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(state.villains.find((v) => v.instanceId === t.villainId)?.defeated).toBe(true);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    expect(JSON.stringify(events)).not.toContain("cardLeavesPlay");
    expect(events.some((e) => e.type === "choiceRequested")).toBe(false);
    expect(state.pendingLeftPlay).toBeUndefined();
  });

  it("a cancelled attachment leaving still lets the host step run: the villain is removed, and the attachment (its own leaving cancelled) stays attached and in play", () => {
    const t = villainTable(KEEPING_VILLAIN_GADGET, [KEEP_VILLAIN_GADGET]);
    const { state, events, session } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({ kept: 1 });
    // The change the host step carries (the villain's removal) still happens: only the attachment's own leaving,
    // which the interrupt cancelled, should not (`runCarriedHostStep`'s own doc comment: "only this card's leaving
    // was cancelled" — implying the card does not leave; RRG 1.8 "Cancel", p. 11: "the canceled effect is not
    // considered to have occurred").
    expect(state.villains.find((v) => v.instanceId === t.villainId)?.defeated).toBe(true);
    expect(events.some((e) => e.type === "villainRemoved")).toBe(true);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  // docs/phase7-wave5.md §4.1 Q53 (RRG 1.8 "Cancel", p. 11: "the canceled effect is not considered to have occurred"):
  // cancelling the carrier attachment's own leaving keeps it in play when its host step then runs. The villain still
  // leaves play, and RRG 1.8 "Attach To" (p. 8) keeps an attached card only while its host is in play, so the gadget
  // is unattached in play, as `leaveNow` does for an attachment that stays (`unattachInPlay`, §3.30): its
  // controller's play area.
  it("the cancelled attachment stays in play, unattached into its controller's play area as its host leaves", () => {
    const t = villainTable(KEEPING_VILLAIN_GADGET, [KEEP_VILLAIN_GADGET]);
    const { state, session } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(mustInstance(state, t.gadget).attachedTo).toBeNull();
    expect(mustInstance(state, t.villainId).attachments).not.toContain(t.gadget);
    expect(mustPlayer(state, P1).playArea).toContain(t.gadget);
    expect(mustPlayer(state, P1).discard).not.toContain(t.gadget);
    expectReplays(session, t.deps);
  });
});

/** "Forced Interrupt: When [this upgrade] would leave play, cancel that." on the stage's gadget. */
const KEEP_STAGE_GADGET = stubAbility("stage-gadget.keep", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("kept", one), { kind: "cancelTriggeringEvent" }],
});
const KEEPING_STAGE_GADGET = stubUpgrade({ id: "stage-gadget", cost: 0, abilities: [KEEP_STAGE_GADGET.ref] });

describe("§4.1 Q53 a cancelled attachment on a host that flips but stays in play", () => {
  // RRG 1.8 "Flip" (p. 20) discards the attachments of a card turned to another type; that discard was cancelled for
  // the gadget, and its host is still in play, so it stays attached ("Attach To", p. 8).
  it("the stage flips to its environment face and the gadget stays attached to it", () => {
    const t = stageTable(KEEPING_STAGE_GADGET, [KEEP_STAGE_GADGET]);
    const { state, events, session } = playFree(t.state, t.deps, FLIP_STAGE.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({ kept: 1 });
    expect(mustInstance(state, t.schemeId).cardId).toBe(FLIP_ENV.id);
    expect(mustInstance(state, t.schemeId).attachments).toEqual([t.gadget]);
    expect(mustInstance(state, t.gadget).attachedTo).toBe(t.schemeId);
    expect(mustPlayer(state, P1).discard).not.toContain(t.gadget);
    expect(events.some((e) => e.type === "mainSchemeFlippedToOtherFace")).toBe(true);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });
});

// ---- §4.1 Q50: permanent attachments on a host step's host ----------------------------------------------------------
//
// A host that leaves play through a host step treats a permanent attachment as `leaveNow` does
// (`discardWithLeavingHost`): a player card is unattached into its controller's play area (§3.30; RRG 1.8 "Permanent",
// p. 32, and "Attach To", p. 8), and an unowned permanent encounter attachment is discarded (§4.2 Q26). A host that
// flips and stays in play keeps it attached: only the Flip rule's discard (RRG 1.8 "Flip", p. 20) is stopped.

const PERMANENT_GADGET = stubUpgrade({ id: "villain-gadget", cost: 0, keywords: [{ name: "permanent" }] });
const PERMANENT_STAGE_GADGET = stubUpgrade({ id: "stage-gadget", cost: 0, keywords: [{ name: "permanent" }] });
const PERMANENT_FACE_GADGET = stubUpgrade({ id: "face-gadget", cost: 0, keywords: [{ name: "permanent" }] });
const PERMANENT_AREA_GADGET = stubUpgrade({ id: "area-gadget", cost: 0, keywords: [{ name: "permanent" }] });
/** A permanent encounter attachment, which no printed card is (§4.2 Q26's shape). */
const CURSE = stubAttachment({ id: "curse", attachesTo: { kind: "villain" }, keywords: [{ name: "permanent" }] });
/** "Forced Interrupt: When this leaves play, …" on the curse: its discard waits in the removal's window. */
const CURSE_INTERRUPT = stubAbility("curse.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("interrupt", one), mark("hostStillThere", villainStillThere)],
});
const LISTENING_CURSE = { ...CURSE, abilities: [CURSE_INTERRUPT.ref] };

/** The villain with the unowned permanent curse attached, and the tracker in P1's play area. */
function curseTable(curse: typeof CURSE, abilities: readonly StubAbility[]) {
  const TRACKER = trackerWith();
  const deps = depsOf(...abilities, REMOVE_VILLAIN.ability);
  const start = gameAtFirstTurn({
    villain: REMOVABLE_VILLAIN,
    cards: [curse, TRACKER, REMOVE_VILLAIN.card],
    deps,
    encounter: [curse.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [TRACKER.id, REMOVE_VILLAIN.card.id],
  });
  const villainId = start.activeVillainId!;
  const tracker = playerCardIntoPlay(start, TRACKER.id);
  const taken = encounterCardInVillainArea(tracker.state, curse.id);
  const state: GameState = {
    ...taken.state,
    villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
    instances: {
      ...taken.state.instances,
      [taken.id]: { ...mustInstance(taken.state, taken.id), attachedTo: villainId, controllerId: null },
      [villainId]: { ...mustInstance(taken.state, villainId), attachments: [taken.id] },
    },
  };
  return { state, deps, villainId, curse: taken.id, tracker: tracker.id };
}

describe("§4.1 Q50 a permanent attachment on a host that leaves play through a host step", () => {
  it("a villain removed from the game: a permanent player upgrade is unattached into its controller's play area, keeping its controller; replay deep-equal", () => {
    const t = villainTable(PERMANENT_GADGET, []);
    const { state, session } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(state.villains.find((v) => v.instanceId === t.villainId)?.defeated).toBe(true);
    expect(mustInstance(state, t.gadget)).toMatchObject({ attachedTo: null, controllerId: P1 });
    expect(mustInstance(state, t.villainId).attachments).toEqual([]);
    expect(mustPlayer(state, P1).playArea).toContain(t.gadget);
    expect(mustPlayer(state, P1).discard).not.toContain(t.gadget);
    expectReplays(session, t.deps);
  });

  it("a main scheme stage removed from the game: a permanent player upgrade is unattached into its controller's play area; replay deep-equal", () => {
    const t = areaTable(PERMANENT_AREA_GADGET, []);
    const { state, session } = playFree(t.state, t.deps, REMOVE_STAGE.card.id);
    expect(state.removedFromGame).toContain(t.schemeId);
    expect(mustInstance(state, t.gadget).attachedTo).toBeNull();
    expect(mustInstance(state, t.schemeId).attachments).toEqual([]);
    expect(mustPlayer(state, P1).playArea).toContain(t.gadget);
    expectReplays(session, t.deps);
  });

  it("a villain removed from the game: an unowned permanent encounter attachment is discarded to its encounter discard pile (§4.2 Q26); replay deep-equal", () => {
    const t = curseTable(CURSE, []);
    const { state, session } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(mustInstance(state, t.curse).attachedTo).toBeNull();
    expect(mustInstance(state, t.villainId).attachments).toEqual([]);
    expect(state.encounterDecks[activeEncounterDeckId(state)]!.discard).toContain(t.curse);
    expectReplays(session, t.deps);
  });

  it("that discard waits for the curse's own leave interrupt, resolved in the removal's window with the villain still in play", () => {
    const t = curseTable(LISTENING_CURSE, [CURSE_INTERRUPT]);
    const { state, events, session } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({ interrupt: 1, hostStillThere: 1 });
    expect(state.encounterDecks[activeEncounterDeckId(state)]!.discard).toContain(t.curse);
    const resolvedAt = index(events, (e) => e.type === "abilityResolved" && e.abilityId === CURSE_INTERRUPT.ref.id);
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(index(events, (e) => e.type === "villainRemoved"));
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });
});

describe("§4.1 Q50 a permanent attachment on a host that flips to another card type and stays in play", () => {
  it("a main scheme stage flipped to its environment face keeps the permanent upgrade attached; replay deep-equal", () => {
    const t = stageTable(PERMANENT_STAGE_GADGET, []);
    const { state, session } = playFree(t.state, t.deps, FLIP_STAGE.card.id);
    expect(mustInstance(state, t.schemeId).cardId).toBe(FLIP_ENV.id);
    expect(mustInstance(state, t.schemeId).attachments).toEqual([t.gadget]);
    expect(mustInstance(state, t.gadget).attachedTo).toBe(t.schemeId);
    expect(mustPlayer(state, P1).discard).not.toContain(t.gadget);
    expectReplays(session, t.deps);
  });

  it("a side scheme flipped to an ally keeps the permanent upgrade attached; replay deep-equal", () => {
    const t = faceTable(PERMANENT_FACE_GADGET, []);
    const { state, session } = playFree(t.state, t.deps, FLIP_FACE.card.id);
    expect(mustInstance(state, t.schemeId).cardId).toBe(FLIP_SCHEME_ALLY.id);
    expect(mustInstance(state, t.schemeId).attachments).toEqual([t.gadget]);
    expect(mustInstance(state, t.gadget).attachedTo).toBe(t.schemeId);
    expect(mustPlayer(state, P1).discard).not.toContain(t.gadget);
    expectReplays(session, t.deps);
  });
});

// ---- §4.1 Q50: attachments on attachments leave in their host's window ----------------------------------------------
//
// A card attached to an attachment leaves play with it (RRG 1.8 "Attach To", p. 8; "Leaves Play", p. 27), so its "when
// this leaves play" interrupt resolves in the same shared window as the host's, still in play (§4.1 Q32–Q33), listed
// right after the attachment it is on.

const tagStillAttached: ValueSpec = { kind: "count", query: { categories: ["upgrade"], name: "tag" } };
/** "Forced Interrupt: When this leaves play, …" on the tag attached to the gadget. */
const TAG_INTERRUPT = stubAbility("tag.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [
    mark("tagInterrupt", one),
    mark("tagHostStillThere", villainStillThere),
    mark("tagInPlay", tagStillAttached),
  ],
});
const TAG = stubUpgrade({ id: "tag", cost: 0, abilities: [TAG_INTERRUPT.ref] });
const HOST_SUPPORT = stubSupport({ id: "host-support", cost: 0 });
const DISCARD_HOST_SUPPORT = event("discard-host-support", [
  {
    kind: "moveCards",
    cards: { kind: "ref", ref: { kind: "each", query: { categories: ["support"], name: "host-support" } } },
    to: "discard",
  },
]);

/** Test surgery: `tag` reparented from P1's play area onto `host` (another attachment), beside what it already has. */
function nestOn(state: GameState, tag: InstanceId, host: InstanceId): GameState {
  const hostInstance = mustInstance(state, host);
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== tag) } : p,
    ),
    instances: {
      ...state.instances,
      [tag]: { ...mustInstance(state, tag), attachedTo: host },
      [host]: { ...hostInstance, attachments: [...hostInstance.attachments, tag] },
    },
  };
}

/** `villainTable` with the tag attached to the gadget. */
function nestedVillainTable(gadgetCard: UpgradeCard, abilities: readonly StubAbility[]) {
  const t = villainTable(gadgetCard, [...abilities, TAG_INTERRUPT], [TAG]);
  const tag = playerCardIntoPlay(t.state, TAG.id);
  return { ...t, state: nestOn(tag.state, tag.id, t.gadget), tag: tag.id };
}

describe("§4.1 Q50 an attachment's attachment leaves in its host's window", () => {
  it("a villain removed: the tag on the gadget gets its interrupt first, with the villain and the tag still in play; both then discard; replay deep-equal", () => {
    const t = nestedVillainTable(PLAIN_VILLAIN_GADGET, []);
    const { state, events, session } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({
      tagInterrupt: 1,
      tagHostStillThere: 1,
      tagInPlay: 1,
    });
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([t.gadget, t.tag]));
    expect(mustInstance(state, t.tag).attachedTo).toBeNull();
    const resolvedAt = index(events, (e) => e.type === "abilityResolved" && e.abilityId === TAG_INTERRUPT.ref.id);
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(index(events, (e) => e.type === "villainRemoved"));
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("with the gadget heard too, both interrupts share one window, the gadget's event first and the tag's after it", () => {
    const t = nestedVillainTable(VILLAIN_GADGET, [VILLAIN_GADGET_INTERRUPT]);
    const { state, events, session } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({ interrupt: 1, tagInterrupt: 1 });
    const windows = events.flatMap((e) =>
      e.type === "windowOpened" && e.timing === "interrupt" && e.event.kind === "cardLeavesPlay" ? [e] : [],
    );
    expect(windows).toHaveLength(1);
    expect(windows[0]?.event).toMatchObject({ instanceId: t.gadget });
    expect(windows[0]?.candidates.map((c) => `${c.abilityId}`).sort()).toEqual(
      [`${VILLAIN_GADGET_INTERRUPT.ref.id}`, `${TAG_INTERRUPT.ref.id}`].sort(),
    );
    const initiated = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "cardLeavesPlay"
        ? [e.event.instanceId]
        : [],
    );
    expect(initiated).toEqual([t.gadget, t.tag]);
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([t.gadget, t.tag]));
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("a support leaving play: the tag on its upgrade gets its interrupt with the support still in play; replay deep-equal", () => {
    const TRACKER = trackerWith();
    const deps = depsOf(TAG_INTERRUPT, DISCARD_HOST_SUPPORT.ability);
    const start = gameAtFirstTurn({
      cards: [TRACKER, HOST_SUPPORT, PLAIN_VILLAIN_GADGET, TAG, DISCARD_HOST_SUPPORT.card],
      deps,
      deck: [TRACKER.id, HOST_SUPPORT.id, PLAIN_VILLAIN_GADGET.id, TAG.id, DISCARD_HOST_SUPPORT.card.id],
    });
    const tracker = playerCardIntoPlay(start, TRACKER.id);
    const host = playerCardIntoPlay(tracker.state, HOST_SUPPORT.id);
    const gadget = playerCardIntoPlay(host.state, PLAIN_VILLAIN_GADGET.id);
    const tag = playerCardIntoPlay(gadget.state, TAG.id);
    const nested = nestOn(nestOn(tag.state, gadget.id, host.id), tag.id, gadget.id);
    const { state, events, session } = playFree(nested, deps, DISCARD_HOST_SUPPORT.card.id);
    expect(mustInstance(state, tracker.id).counters).toMatchObject({ tagInterrupt: 1, tagInPlay: 1 });
    expect(mustPlayer(state, P1).discard).toEqual(expect.arrayContaining([host.id, gadget.id, tag.id]));
    const resolvedAt = index(events, (e) => e.type === "abilityResolved" && e.abilityId === TAG_INTERRUPT.ref.id);
    const hostMovedAt = index(events, (e) => e.type === "cardMoved" && e.instanceId === host.id);
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(hostMovedAt);
    expect(state.stack).toEqual([]);
    expectReplays(session, deps);
  });
});

// ---- §4.1 Q50: joining another game area waits for its stage's attachments ------------------------------------------
//
// `joinGameArea` removes the joining area's own stage first, which takes its attachments out of play. The whole join
// waits for their "when this leaves play" interrupts, which see both areas as they were, then runs from the stack.

describe("§4.1 Q50 joinGameArea waits for its stage's attachment's leave interrupt", () => {
  it("the interrupt resolves first, with the stage and P1 still in the area; the stage is then removed, the split ends and the attachment discards; replay deep-equal", () => {
    const t = areaTable(AREA_GADGET, [AREA_GADGET_INTERRUPT], [P1]);
    const { state, events, session } = playFree(t.state, t.deps, JOIN_AREA.card.id);
    expect(mustInstance(state, t.tracker).counters).toMatchObject({ interrupt: 1, hostStillThere: 1 });
    expect(state.gameAreas).toEqual([]);
    expect(state.removedFromGame).toContain(t.schemeId);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    const resolvedAt = index(
      events,
      (e) => e.type === "abilityResolved" && e.abilityId === AREA_GADGET_INTERRUPT.ref.id,
    );
    const removedAt = index(events, (e) => e.type === "mainSchemeStageRemoved");
    const joinedAt = index(events, (e) => e.type === "gameAreaJoined");
    expect(resolvedAt).toBeGreaterThanOrEqual(0);
    expect(resolvedAt).toBeLessThan(removedAt);
    expect(removedAt).toBeLessThan(joinedAt);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("with nothing listening, the join removes the stage at once and logs no cardLeavesPlay", () => {
    const t = areaTable(PLAIN_AREA_GADGET, [], [P1]);
    const { state, events } = playFree(t.state, t.deps, JOIN_AREA.card.id);
    expect(state.gameAreas).toEqual([]);
    expect(state.removedFromGame).toContain(t.schemeId);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    expect(JSON.stringify(events)).not.toContain("cardLeavesPlay");
    expect(events.some((e) => e.type === "choiceRequested")).toBe(false);
  });
});
