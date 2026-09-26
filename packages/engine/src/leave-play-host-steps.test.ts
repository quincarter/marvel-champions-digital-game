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

import { flat, type CardId, type MainSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { gameAreaId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import { NO_STATUSES, type CardInstance, type GameAreaState, type GameState, type MainSchemeState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEnvironment,
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";
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
function stageTable(gadgetCard: typeof STAGE_GADGET | typeof PLAIN_STAGE_GADGET, abilities: readonly StubAbility[]) {
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

function faceTable(gadgetCard: typeof FACE_GADGET | typeof PLAIN_FACE_GADGET, abilities: readonly StubAbility[]) {
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

function areaTable(gadgetCard: typeof AREA_GADGET | typeof PLAIN_AREA_GADGET, abilities: readonly StubAbility[]) {
  const TRACKER = trackerWith();
  const deps = depsOf(...abilities, REMOVE_STAGE.ability);
  const start = gameAtFirstTurn({
    cards: [AREA_STAGE_CARD, gadgetCard, TRACKER, REMOVE_STAGE.card],
    deps,
    deck: [gadgetCard.id, TRACKER.id, REMOVE_STAGE.card.id],
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
    playerIds: [],
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

function villainTable(
  gadgetCard: typeof VILLAIN_GADGET | typeof PLAIN_VILLAIN_GADGET | typeof KEEPING_VILLAIN_GADGET,
  abilities: readonly StubAbility[],
) {
  const TRACKER = trackerWith();
  const deps = depsOf(...abilities, REMOVE_VILLAIN.ability);
  const start = gameAtFirstTurn({
    villain: REMOVABLE_VILLAIN,
    cards: [gadgetCard, TRACKER, REMOVE_VILLAIN.card],
    deps,
    deck: [gadgetCard.id, TRACKER.id, REMOVE_VILLAIN.card.id],
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
    // was cancelled" — implying the card does not leave; RRG 1.8 "Cancel", p. 13: "the canceled effect is not
    // considered to have occurred").
    expect(state.villains.find((v) => v.instanceId === t.villainId)?.defeated).toBe(true);
    expect(events.some((e) => e.type === "villainRemoved")).toBe(true);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  // BUG (docs/phase7-wave5.md §4.1 Q32, §4.1 Q50; RRG 1.8 "Cancel", p. 13, "Leaves Play", p. 27): cancelling the
  // *carrier* attachment's own "when this leaves play" interrupt does not keep it in play. `removeVillains` (and
  // `flipMainSchemeStage`/`flipToOtherFace`/`removeMainSchemeStage`) re-run their whole body from `runCarriedHostStep`
  // once the carrier's leaving is cancelled, and that body's `for (const attachment of instance.attachments)
  // discardAtOnce(ctx, attachment)` loop still finds the (still-attached) gadget and discards it unconditionally,
  // through `leavePlayAtOnce`, which never checks whether that instance already has a cancelled leaving on the stack.
  // Expected (per "Cancel"): the gadget's own leaving was cancelled, so it should stay attached to the villain's
  // instance and out of the discard pile, exactly as "the host's leaving cancelled first" keeps an ally's attachment
  // in `leaves-play-interrupt-timing.test.ts`. Actual: it is discarded anyway (`attachedTo` becomes `null`, and it
  // ends up in the discard pile) — the cancellation is silently overridden by the host step's second pass.
  it.fails("BUG: the cancelled attachment's own leaving should keep it attached and out of the discard pile", () => {
    const t = villainTable(KEEPING_VILLAIN_GADGET, [KEEP_VILLAIN_GADGET]);
    const { state } = playFree(t.state, t.deps, REMOVE_VILLAIN.card.id);
    expect(mustInstance(state, t.gadget).attachedTo).toBe(t.villainId);
    expect(mustPlayer(state, P1).discard).not.toContain(t.gadget);
  });
});
