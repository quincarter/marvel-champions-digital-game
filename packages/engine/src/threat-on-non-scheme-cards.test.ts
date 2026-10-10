/**
 * docs/phase7-wave9.md §3.7 (a): `placeThreat`, `removeThreat` and `moveThreat` on a card that is not a scheme (a
 * player's upgrade here). The threat is only tokens, kept in `CardInstance.threat` as a scheme's is; what makes a
 * scheme's threat matter (thwarting, a crisis icon, "threat cannot be removed", defeat at none, the main scheme's
 * target) asks `isScheme` first. The same reading docs/phase7-wave6.md §3.59 made for characters.
 *
 * Sources: RRG 1.8 "Crisis Icon" (p. 14) and "Patrol" (p. 32) speak of the main scheme; "Move" (p. 30): "If threat is
 * moved off a scheme, the moved threat is considered to be removed from that scheme"; "Flip" (p. 20): a flipped card
 * keeps its tokens; "Thwart" (p. 44) names schemes.
 */

import { flat, type AnyCard, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { isScheme, mustInstance } from "./query.js";
import { cardsInPlay, resolveRef, resolveValue } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { giveCard } from "./testing/scenario.js";
import { stubEvent, stubMainScheme, stubSideScheme, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const controller = { kind: "controller" } as const;
/** "Your suit form upgrade": the one upgrade in play. */
const theUpgrade: TargetRef = { kind: "each", query: { categories: ["upgrade"] } };
const mainScheme: TargetRef = { kind: "mainScheme" };
const chosen: TargetRef = { kind: "slot", slot: "scheme" };

/** A double-sided upgrade, as Assault / Stealth is. */
const HOLDER: UpgradeCard = {
  ...stubUpgrade({ id: "holder", cost: 0 }),
  flipSide: {
    name: "holder-back",
    traits: [],
    keywords: [],
    text: { printed: "", current: "" },
    abilities: [],
  },
} as UpgradeCard;
const PLAIN_SCHEME = stubSideScheme({ id: "plain-scheme", startingThreat: 3 });
const CRISIS_SCHEME = stubSideScheme({ id: "crisis-scheme", startingThreat: 3, icons: ["crisis"] });
/** Target 6: one more threat on it at 5 completes it. */
const TIGHT_SCHEME = stubMainScheme({
  id: "tight-scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(6), acceleration: flat(0) }],
});

const action = (id: string, effects: readonly EffectSpec[], label?: "thwart") => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    ...(label ? { label: [label] as const } : {}),
    effects,
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const PLACE_3 = action("place-3", [{ kind: "placeThreat", target: theUpgrade, amount: n(3) }]);
const REMOVE_2 = action("remove-2", [{ kind: "removeThreat", target: theUpgrade, amount: n(2) }]);
const REMOVE_9 = action("remove-9", [{ kind: "removeThreat", target: theUpgrade, amount: n(9) }]);
/** A "(thwart)" ability that takes tokens off the upgrade: not a thwart. */
const LABELED_REMOVE_2 = action(
  "labeled-remove-2",
  [{ kind: "removeThreat", target: theUpgrade, amount: n(2) }],
  "thwart",
);
const LABELED_REMOVE_MAIN = action(
  "labeled-remove-main",
  [{ kind: "removeThreat", target: mainScheme, amount: n(2) }],
  "thwart",
);
/** "Remove 2 threat from a scheme." */
const REMOVE_FROM_A_SCHEME = action("remove-from-a-scheme", [
  { kind: "chooseTarget", slot: "scheme", query: { categories: ["scheme"] }, chooser: controller },
  { kind: "removeThreat", target: chosen, amount: n(2) },
]);
const REMOVE_FROM_SIDE = action("remove-from-side", [
  { kind: "removeThreat", target: { kind: "each", query: { categories: ["sideScheme"] } }, amount: n(3) },
]);
/** "Move 2 threat from the main scheme to your upgrade." */
const MOVE_TO_UPGRADE = action("move-to-upgrade", [
  { kind: "moveThreat", from: mainScheme, to: theUpgrade, amount: n(2), bind: "moved" },
]);
const MOVE_TO_SCHEME = action("move-to-scheme", [{ kind: "moveThreat", from: theUpgrade, to: mainScheme }]);
const FLIP = action("flip", [{ kind: "flipCard", target: theUpgrade }]);
const DISCARD = action("discard", [{ kind: "discardFromPlay", target: theUpgrade }]);
const ACTIONS = [
  PLACE_3,
  REMOVE_2,
  REMOVE_9,
  LABELED_REMOVE_2,
  LABELED_REMOVE_MAIN,
  REMOVE_FROM_A_SCHEME,
  REMOVE_FROM_SIDE,
  MOVE_TO_UPGRADE,
  MOVE_TO_SCHEME,
  FLIP,
  DISCARD,
];

/** "Threat cannot be removed", whatever card it is on. */
const NO_REMOVAL_RULE = stubAbility("no-removal.constant", {
  trigger: { kind: "constant", rules: [{ kind: "threatCannotBeRemoved", target: {} }] },
  effects: [],
});
const NO_REMOVAL = stubSupport({ id: "no-removal", cost: 0, abilities: [NO_REMOVAL_RULE.ref] });

const deps: EngineDeps = depsOf(NO_REMOVAL_RULE, ...ACTIONS.map((a) => a.ability));
const ENCOUNTER_CARDS: readonly AnyCard[] = [PLAIN_SCHEME, CRISIS_SCHEME];

interface Table {
  readonly state: GameState;
  readonly upgrade: InstanceId;
  readonly main: InstanceId;
}

/** The upgrade in play holding `onUpgrade` threat, the main scheme (target 6) holding `onMain`. */
function table(onUpgrade: number, onMain: number): Table {
  const base = gameAtFirstTurn({
    deps,
    cards: [...ENCOUNTER_CARDS, HOLDER, NO_REMOVAL, ...ACTIONS.map((a) => a.card)],
    deck: [HOLDER.id, NO_REMOVAL.id, ...ACTIONS.flatMap((a) => copiesOf(a.card.id, 2))],
    encounter: [PLAIN_SCHEME.id, CRISIS_SCHEME.id, ...copiesOf("treachery" as never, 20)],
    mainScheme: TIGHT_SCHEME,
  });
  const inPlay = playerCardIntoPlay(base, HOLDER.id);
  const main = inPlay.state.mainScheme.instanceId;
  return { state: withThreat(withThreat(inPlay.state, inPlay.id, onUpgrade), main, onMain), upgrade: inPlay.id, main };
}

const threatOf = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
function withThreat(state: GameState, id: InstanceId, threat: number): GameState {
  return { ...state, instances: { ...state.instances, [id]: { ...mustInstance(state, id), threat } } };
}
const placed = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatPlaced" ? [{ on: e.schemeInstanceId, amount: e.amount }] : []));
const removed = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "threatRemoved" ? [{ from: e.schemeInstanceId, amount: e.amount }] : []));
const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };

describe("§3.7 (a) threat placed on an upgrade is only tokens", () => {
  it("an upgrade is not a scheme; the main scheme and a side scheme are", () => {
    const { state, upgrade, main } = table(0, 0);
    const side = encounterCardInVillainArea(state, PLAIN_SCHEME.id, 3);
    expect(isScheme(side.state, upgrade)).toBe(false);
    expect(isScheme(side.state, main)).toBe(true);
    expect(isScheme(side.state, side.id)).toBe(true);
  });

  it("placing 3 puts 3 on the upgrade, logged against its id, and none on the main scheme", () => {
    const { state, upgrade, main } = table(0, 2);
    const after = playFree(state, deps, PLACE_3.card.id);
    expect(threatOf(after.state, upgrade)).toBe(3);
    expect(threatOf(after.state, main)).toBe(2);
    expect(placed(after.events)).toEqual([{ on: upgrade, amount: 3 }]);
    const replayed = replay(after.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(after.state);
  });

  it("is not counted toward the main scheme's target: 5 of 6 there and 3 more on the upgrade loses nothing", () => {
    const { state, upgrade, main } = table(4, 5);
    const after = playFree(state, deps, PLACE_3.card.id);
    expect(threatOf(after.state, upgrade)).toBe(7);
    expect(threatOf(after.state, main)).toBe(5);
    expect(after.state.outcome).toBeNull();
    expect(after.events.some((e) => e.type === "mainSchemeCompleted" || e.type === "gameEnded")).toBe(false);
  });

  it("'threat on schemes' ignores it: a scheme query never finds the upgrade, a threat value reads it by name", () => {
    const { state, upgrade, main } = table(4, 1);
    const withThreatQuery = (categories: readonly ("scheme" | "upgrade")[]): TargetRef => ({
      kind: "each",
      query: { categories, hasThreat: true },
    });
    expect(resolveRef(state, withThreatQuery(["scheme"]), context)).toEqual([main]);
    expect(resolveRef(state, withThreatQuery(["upgrade"]), context)).toEqual([upgrade]);
    expect(resolveValue(state, { kind: "threat", of: theUpgrade }, context, deps)).toBe(4);
    expect(resolveValue(state, { kind: "threat", of: mainScheme }, context, deps)).toBe(1);
  });

  it("villain phase step one places threat on the main scheme only", () => {
    const endTurn = (state: GameState) =>
      driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }]).session.state;
    const plain = table(0, 1);
    const held = table(4, 1);
    const after = endTurn(held.state);
    expect(threatOf(after, held.main)).toBe(threatOf(endTurn(plain.state), plain.main));
    expect(threatOf(after, held.upgrade)).toBe(4);
  });
});

describe("§3.7 (a) threat on an upgrade cannot be thwarted or chosen as a scheme's", () => {
  it("a basic thwart is never offered it and is refused against it", () => {
    const start = table(3, 2);
    const state = driveSession(startSession(start.state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
    const hero = state.players[0]!.identity.instanceId;
    const legal = legalActions(state, P1, deps);
    if (legal.kind !== "turn") throw new Error(legal.kind);
    const thwarts = legal.legal.filter((a) => a.action.kind === "basicThwart");
    expect(thwarts.length).toBeGreaterThan(0);
    for (const thwart of thwarts) expect(thwart.targets).toEqual([start.main]);
    expect(() =>
      driveSession(startSession(state), deps, [
        { type: "basicThwart", playerId: P1, thwarterInstanceId: hero, schemeInstanceId: start.upgrade },
      ]),
    ).toThrow(/not a scheme/);
  });

  it("'remove 2 threat from a scheme' is offered the main scheme and the side scheme, never the upgrade", () => {
    const start = table(4, 3);
    const side = encounterCardInVillainArea(start.state, PLAIN_SCHEME.id, 3);
    const given = giveCard(side.state, P1, REMOVE_FROM_A_SCHEME.card.id);
    const opened = sessionApply(
      startSession(given.state),
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
      deps,
    );
    if (!opened.ok) throw new Error(opened.error.message);
    const choice = opened.session.state.pendingChoice;
    expect(choice?.prompt.kind).toBe("chooseTarget");
    const offered = (choice?.options ?? []).map((o) => (o.ref.kind === "card" ? o.ref.instanceId : null));
    expect(offered).toEqual([start.main, side.id]);
    expect(legalActions(opened.session.state, P1, deps)).toEqual({ kind: "choice", choice });
  });
});

describe("§3.7 (a) removing threat from an upgrade", () => {
  it("removes 2 of 3, logged against its id; a removal of 9 from 1 removes 1", () => {
    const { state, upgrade, main } = table(3, 2);
    const after = playFree(state, deps, REMOVE_2.card.id);
    expect(threatOf(after.state, upgrade)).toBe(1);
    expect(threatOf(after.state, main)).toBe(2);
    expect(removed(after.events)).toEqual([{ from: upgrade, amount: 2 }]);
    const emptied = playFree(after.state, deps, REMOVE_9.card.id);
    expect(threatOf(emptied.state, upgrade)).toBe(0);
    expect(removed(emptied.events)).toEqual([{ from: upgrade, amount: 1 }]);
  });

  it("at 0 threat the upgrade is not defeated and stays in play", () => {
    const { state, upgrade } = table(2, 0);
    const after = playFree(state, deps, REMOVE_9.card.id);
    expect(threatOf(after.state, upgrade)).toBe(0);
    expect(cardsInPlay(after.state)).toContain(upgrade);
    expect(after.events.some((e) => e.type === "schemeDefeated")).toBe(false);
  });

  it("a crisis icon stops nothing: 2 come off the upgrade while the main scheme keeps its 5", () => {
    const start = table(3, 5);
    const crisis = encounterCardInVillainArea(start.state, CRISIS_SCHEME.id, 3);
    const after = playFree(crisis.state, deps, REMOVE_2.card.id);
    expect(threatOf(after.state, start.upgrade)).toBe(1);
    expect(threatOf(after.state, start.main)).toBe(5);
    expect(after.events.some((e) => e.type === "threatRemovalBlocked")).toBe(false);
  });

  it("an unscoped 'threat cannot be removed' rule protects the scheme, not the upgrade's tokens", () => {
    const start = table(3, 5);
    const ruled = playerCardIntoPlay(start.state, NO_REMOVAL.id).state;
    expect(threatOf(playFree(ruled, deps, REMOVE_2.card.id).state, start.upgrade)).toBe(1);
    expect(() => playFree(ruled, deps, REMOVE_FROM_A_SCHEME.card.id)).toThrow(/no valid target/);
  });

  it("a '(thwart)' ability taking 2 off the upgrade is a removal, not a thwart", () => {
    const start = table(3, 5);
    const hero = driveSession(startSession(start.state), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
    const after = playFree(hero, deps, LABELED_REMOVE_2.card.id);
    expect(threatOf(after.state, start.upgrade)).toBe(1);
    expect(removed(after.events)).toEqual([{ from: start.upgrade, amount: 2 }]);
    expect(after.events.some((e) => e.type === "triggerEvent" && e.event.kind === "thwart")).toBe(false);
    // The same label on a scheme's threat is a thwart, as before.
    const scheme = playFree(hero, deps, LABELED_REMOVE_MAIN.card.id);
    expect(threatOf(scheme.state, start.main)).toBe(3);
    expect(scheme.events.some((e) => e.type === "triggerEvent" && e.event.kind === "thwart")).toBe(true);
  });
});

describe("§3.7 (a) moving threat between a scheme and an upgrade", () => {
  it("2 from a main scheme at 5: the scheme has 3 and the upgrade gains 2, removed then placed", () => {
    const { state, upgrade, main } = table(1, 5);
    const after = playFree(state, deps, MOVE_TO_UPGRADE.card.id);
    expect(threatOf(after.state, main)).toBe(3);
    expect(threatOf(after.state, upgrade)).toBe(3);
    expect(removed(after.events)).toEqual([{ from: main, amount: 2 }]);
    expect(placed(after.events)).toEqual([{ on: upgrade, amount: 2 }]);
  });

  it("a scheme with 1 threat gives 1: 1 removed, 1 placed", () => {
    const { state, upgrade, main } = table(0, 1);
    const after = playFree(state, deps, MOVE_TO_UPGRADE.card.id);
    expect(threatOf(after.state, main)).toBe(0);
    expect(threatOf(after.state, upgrade)).toBe(1);
  });

  it("the scheme's half keeps the scheme's rules: under a crisis icon the move has no source", () => {
    const start = table(1, 5);
    const crisis = encounterCardInVillainArea(start.state, CRISIS_SCHEME.id, 3);
    expect(() => playFree(crisis.state, deps, MOVE_TO_UPGRADE.card.id)).toThrow(/no valid|cannot/i);
    expect(threatOf(crisis.state, start.main)).toBe(5);
  });

  it("the upgrade's half has none: its 4 threat move to the main scheme under a crisis icon, 1 becoming 5", () => {
    const start = table(4, 1);
    const crisis = encounterCardInVillainArea(start.state, CRISIS_SCHEME.id, 3);
    const after = playFree(crisis.state, deps, MOVE_TO_SCHEME.card.id);
    expect(threatOf(after.state, start.upgrade)).toBe(0);
    expect(threatOf(after.state, start.main)).toBe(5);
    expect(after.state.outcome).toBeNull();
  });

  it("threat moved onto the main scheme is placed there: 4 onto a scheme at 2 of 6 completes it", () => {
    const { state } = table(4, 2);
    const after = playFree(state, deps, MOVE_TO_SCHEME.card.id);
    expect(after.state.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
  });
});

describe("§3.7 (a) the upgrade's threat follows the card", () => {
  it("a flip to its other face keeps all 4", () => {
    const { state, upgrade } = table(4, 0);
    const after = playFree(state, deps, FLIP.card.id);
    expect(cardsInPlay(after.state)).toContain(upgrade);
    expect(threatOf(after.state, upgrade)).toBe(4);
    expect(after.events.some((e) => e.type === "threatPlaced" || e.type === "threatRemoved")).toBe(false);
  });

  it("leaving play discards it: 4 threat gone, none moved to any scheme", () => {
    const { state, upgrade, main } = table(4, 2);
    const after = playFree(state, deps, DISCARD.card.id);
    expect(cardsInPlay(after.state)).not.toContain(upgrade);
    expect(threatOf(after.state, upgrade)).toBe(0);
    expect(threatOf(after.state, main)).toBe(2);
  });
});

describe("§3.7 (a) a scheme's threat behaves as before", () => {
  it("removing the last 3 threat from a side scheme defeats it", () => {
    const start = table(2, 0);
    const side = encounterCardInVillainArea(start.state, PLAIN_SCHEME.id, 3);
    const after = playFree(side.state, deps, REMOVE_FROM_SIDE.card.id);
    expect(removed(after.events)).toEqual([{ from: side.id, amount: 3 }]);
    expect(after.events.some((e) => e.type === "schemeDefeated" && e.instanceId === side.id)).toBe(true);
    expect(cardsInPlay(after.state)).not.toContain(side.id);
    expect(threatOf(after.state, start.upgrade)).toBe(2);
  });

  it("a crisis icon still stops a player card removing threat from the main scheme", () => {
    const start = table(2, 5);
    const crisis = encounterCardInVillainArea(start.state, CRISIS_SCHEME.id, 3);
    const given = giveCard(crisis.state, P1, REMOVE_FROM_A_SCHEME.card.id);
    const session: GameSession = driveSession(startSession(given.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]).session;
    // The crisis side scheme is the only scheme the card can affect.
    const side = crisis.id;
    expect(threatOf(session.state, side)).toBe(1);
    expect(threatOf(session.state, start.main)).toBe(5);
  });
});
