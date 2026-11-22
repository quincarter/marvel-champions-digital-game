/**
 * docs/phase7-wave9.md §3.66: the pod's shared villain. Damage to it is a shared event through one pure reducer
 * (`applySharedEvent`), and what the damage brings about is applied once the resolution in progress has finished.
 * Synthetic cards shaped like Loki, God of Lies (`tt` 55027a/b) and the Shatter the Illusion card's step 1.
 *
 * Sources: MC55 p. 20: "There is only one way for players to deal damage to Loki, God of Lies"; at 10 per player
 * remaining "the ability on Loki, God of Lies causes it to flip … Each group should pause gameplay activity in their
 * game area, first finishing any actions or abilities that are currently resolving. Then, the 'When Revealed' ability
 * on Loki, God of Lies triggers". Card 55027b: "If Loki, God of Lies is defeated, all players in all groups win the
 * game." The two-group and remote cases are on hand-built records: no game of this project has more than one group.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand, replay } from "./engine.js";
import { inboundCommand } from "./pod-commands.js";
import type { GameEvent } from "./events.js";
import { groupId } from "./ids.js";
import { applySharedEvent, podOf, type SharedEvent, type SharedPodState } from "./pod.js";
import { mustInstance, sharedVillain } from "./query.js";
import type { GameState } from "./state.js";
import {
  LEDGER,
  ledgerMarks,
  podEvent,
  scriptedDeps,
  SHARED_SCHEME,
  SHARED_VILLAIN,
  sharedEvent,
  singleGroup,
  unscriptedDeps,
  type PodScript,
} from "./testing/pod.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const G1 = groupId("g1");
const G2 = groupId("g2");
const damage = (amount: number, from = G1): SharedEvent => ({ type: "sharedVillainDamaged", groupId: from, amount });
const threat = (from = G1): SharedEvent => ({
  type: "sharedSchemeThreatPlaced",
  groupId: from,
  amount: 1,
  cause: "schemeCompleted",
});
const record = (hp: number, flipAt: number | null, target: number): SharedPodState => ({
  villainHp: hp,
  villainDamage: 0,
  villainFlipAtRemaining: flipAt,
  villainFlipped: false,
  schemeThreat: 0,
  schemeTarget: target,
  status: "playing",
});
/** Applies events in order; returns the record and each event's results. */
const run = (start: SharedPodState, ...events: readonly SharedEvent[]) =>
  events.reduce(
    (acc, event) => {
      const { shared, results } = applySharedEvent(acc.shared, event);
      return { shared, results: [...acc.results, results] };
    },
    { shared: start, results: [] as (readonly string[])[] },
  );

describe("applySharedEvent: the shared villain (docs/phase7-wave9.md §3.66)", () => {
  it("one player (20, flip at 10): damage, the flip once, the defeat, and nothing after it", () => {
    const start = record(20, 10, 2);
    const a = applySharedEvent(start, damage(7));
    expect(a).toEqual({ shared: { ...start, villainDamage: 7 }, results: [] });
    const b = applySharedEvent(a.shared, damage(5));
    expect(b.shared).toMatchObject({ villainDamage: 12, villainFlipped: true });
    expect(b.results).toEqual(["sharedVillainFlipped"]);
    const c = applySharedEvent(b.shared, damage(1));
    expect(c.shared.villainDamage).toBe(13);
    expect(c.results).toEqual([]);
    // 7 left, 9 dealt: capped at the hit points left.
    const d = applySharedEvent(c.shared, damage(9));
    expect(d.shared).toMatchObject({ villainDamage: 20, status: "won" });
    expect(d.results).toEqual(["sharedVillainDefeated"]);
    expect(applySharedEvent(d.shared, damage(3))).toEqual({ shared: d.shared, results: [] });
    expect(applySharedEvent(d.shared, threat())).toEqual({ shared: d.shared, results: [] });
  });

  it("damage that crosses the flip line and reaches 0 in one event reports the defeat only", () => {
    const at12 = { ...record(20, 10, 2), villainDamage: 8 };
    const { shared, results } = applySharedEvent(at12, damage(12));
    expect(results).toEqual(["sharedVillainDefeated"]);
    expect(shared).toMatchObject({ villainDamage: 20, villainFlipped: false, status: "won" });
  });

  it("is total: 0, a negative or a broken amount changes nothing; a part of a point is dropped", () => {
    const start = record(20, 10, 2);
    for (const amount of [0, -3, Number.NaN, Number.POSITIVE_INFINITY])
      expect(applySharedEvent(start, damage(amount))).toEqual({ shared: start, results: [] });
    expect(applySharedEvent(start, damage(2.9)).shared.villainDamage).toBe(2);
    expect(applySharedEvent(record(20, null, 2), damage(15)).results).toEqual([]);
  });

  it("is pure: the record passed in is never changed", () => {
    const start = Object.freeze(record(20, 10, 2));
    applySharedEvent(start, damage(12));
    expect(start).toEqual(record(20, 10, 2));
  });

  it("hand-built, two groups and five players (100, flip at 50, target 4)", () => {
    const start = record(100, 50, 4);
    const hits = run(start, damage(49, G1), damage(1, G2));
    expect(hits.results).toEqual([[], ["sharedVillainFlipped"]]);
    const threats = run(hits.shared, threat(G1), threat(G2), threat(G1), threat(G2));
    expect(threats.results).toEqual([[], [], [], ["sharedSchemeCompleted"]]);
    expect(threats.shared).toMatchObject({ schemeThreat: 4, status: "schemeCompleted", villainDamage: 50 });
    // The race of MC55 p. 21: damage still applies, and reaching 0 wins.
    const race = run(threats.shared, damage(30, G2), damage(20, G1));
    expect(race.results).toEqual([[], ["sharedVillainDefeated"]]);
    expect(race.shared.status).toBe("won");
  });
});

const SHATTER_7 = podEvent("shatter-7", [sharedEvent("villainDamaged", 7)]);
const SHATTER_6 = podEvent("shatter-6", [sharedEvent("villainDamaged", 6)]);
const SHATTER_13 = podEvent("shatter-13", [sharedEvent("villainDamaged", 13)]);
const SHATTER_0 = podEvent("shatter-0", [sharedEvent("villainDamaged", 0)]);
const SCRIPTS = [SHATTER_7, SHATTER_6, SHATTER_13, SHATTER_0];
const scripted = scriptedDeps(...SCRIPTS);
const unscripted = unscriptedDeps(...SCRIPTS);

function table(players: 1 | 2 | 3 = 1, deps: EngineDeps = scripted): GameState {
  const start = gameAtFirstTurn({
    players,
    cards: [SHARED_VILLAIN, SHARED_SCHEME, LEDGER, ...SCRIPTS.map((s) => s.card)],
    deps,
    deck: SCRIPTS.flatMap((s) => copiesOf(s.card.id, 3)),
    encounter: [LEDGER.id, ...copiesOf(TREACHERY.id, 20)],
    pod: singleGroup(players),
  });
  return encounterCardInVillainArea(start, LEDGER.id).state;
}
const play = (state: GameState, script: PodScript, deps: EngineDeps = scripted) => {
  const played = playFree(state, deps, script.card.id);
  const replayed = replay(played.session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(played.session.state);
  return played;
};
/**
 * The pod coordinator's acknowledgement of this group's last shared event (`PodState.awaiting`, `sharedAck`): what a
 * remote coordinator sends once it has applied the event, after which the group plays on.
 */
const acked = (state: GameState, deps: EngineDeps = scripted): GameState => {
  const pod = podOf(state);
  const result = applyCommand(
    state,
    inboundCommand(state, pod.inboundSeq + 1, { kind: "sharedAck", seq: pod.awaiting ?? pod.outboundSeq }),
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
};
const emitted = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "sharedEventEmitted" ? [{ seq: e.seq, event: e.event }] : []));
const typesOf = (events: readonly GameEvent[], ...types: readonly GameEvent["type"][]) =>
  events.filter((e) => types.includes(e.type)).map((e) => e.type);
const neutralVillain = (state: GameState) => mustInstance(state, podOf(state).neutral!.villainInstanceId);

describe("EffectSpec sharedEvent on the shared villain, one group", () => {
  it("emits exactly one numbered event and changes the record in the same command", () => {
    const { state, events } = play(table(), SHATTER_7);
    expect(emitted(events)).toEqual([{ seq: 1, event: { type: "sharedVillainDamaged", groupId: "g1", amount: 7 } }]);
    expect(sharedVillain(state)).toMatchObject({ hp: 20, remaining: 13, damage: 7, flipped: false, defeated: false });
    expect(podOf(state).outboundSeq).toBe(1);
    expect(events).toContainEqual({ type: "sharedStateChanged", shared: podOf(state).shared });
    // Nothing is on the neutral card itself: the record is the one place the hit points live.
    expect(neutralVillain(state)).toMatchObject({ damage: 0, flipped: false });
    expect(ledgerMarks(state)).toEqual({ after: 1 });
    expect(state.outcome).toBeNull();
  });

  it("an amount of 0 emits nothing", () => {
    const { state, events } = play(table(), SHATTER_0);
    expect(emitted(events)).toEqual([]);
    expect(podOf(state).outboundSeq).toBe(0);
  });

  it("crossing the flip line: the villain's new face is revealed after the whole ability has resolved", () => {
    const first = play(table(), SHATTER_7);
    const { state, events } = play(first.state, SHATTER_6);
    expect(emitted(events)).toEqual([{ seq: 2, event: { type: "sharedVillainDamaged", groupId: "g1", amount: 6 } }]);
    expect(sharedVillain(state)).toMatchObject({ remaining: 7, flipped: true });
    expect(neutralVillain(state).flipped).toBe(true);
    expect(ledgerMarks(state)).toEqual({ after: 2, revealed: 1, flipHeardAfterRevealed: 1 });
    // The ability's own last effect (the second "after" mark) came before the flip.
    const order = events.flatMap((e) =>
      e.type === "cardFlipped" ? ["flipped"] : e.type === "counterAdded" ? [e.counterType] : [],
    );
    expect(order).toEqual(["after", "flipped", "revealed", "flipHeardAfterRevealed"]);
    expect(typesOf(events, "sharedResultApplied")).toEqual(["sharedResultApplied"]);
    // Latched: more damage that leaves it alive reveals nothing again.
    const again = play(state, SHATTER_6);
    expect(sharedVillain(again.state)?.remaining).toBe(1);
    expect(ledgerMarks(again.state).revealed).toBe(1);
  });

  it("per player: three players have 60 hit points and flip at 30", () => {
    const state = table(3);
    expect(sharedVillain(state)).toMatchObject({ hp: 60, remaining: 60, flipAtRemaining: 30 });
    const a = play(state, SHATTER_13);
    const b = play(a.state, SHATTER_13);
    expect(sharedVillain(b.state)).toMatchObject({ remaining: 34, flipped: false });
    const c = play(b.state, SHATTER_6);
    expect(sharedVillain(c.state)).toMatchObject({ remaining: 28, flipped: true });
  });

  it("damage to 0 after the flip: the players win once the ability has finished, by the villain's own line", () => {
    const a = play(table(), SHATTER_7);
    const b = play(a.state, SHATTER_6);
    const { state } = play(b.state, SHATTER_7);
    expect(sharedVillain(state)).toMatchObject({ remaining: 0, defeated: true, flipped: true });
    expect(podOf(state).shared?.status).toBe("won");
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    // The whole ability resolved first (its third "after" mark), then the line on the villain's revealed face.
    expect(ledgerMarks(state)).toMatchObject({ after: 3, defeated: 1 });
  });

  it("damage that crosses the flip line and reaches 0 at once: a win, with no flip and no When Revealed", () => {
    const first = play(table(), SHATTER_7);
    const { state, events } = play(first.state, SHATTER_13);
    expect(sharedVillain(state)).toMatchObject({ remaining: 0, defeated: true, flipped: false });
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    // The face that prints the winning line never came up, so no ability answered: the engine records the win itself.
    expect(ledgerMarks(state)).toEqual({ after: 2 });
    expect(neutralVillain(state).flipped).toBe(false);
    expect(typesOf(events, "cardFlipped")).toEqual([]);
  });

  it("with no neutral card scripted the engine records the same win itself", () => {
    const first = play(table(1, unscripted), SHATTER_7, unscripted);
    const { state } = play(first.state, SHATTER_13, unscripted);
    expect(state.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    expect(ledgerMarks(state)).toEqual({ after: 2 });
  });
});

describe("hand-built: a remote coordinator", () => {
  it("the same event leaves the record untouched, emits the same one event, flips nothing and ends nothing", () => {
    const local = table();
    const remote: GameState = {
      ...local,
      pod: { ...podOf(local), coordinator: "remote", groupsInPodAtStart: 2, groupsInGameAtStart: 2 },
    };
    const a = play(remote, SHATTER_13);
    const { state, events } = play(acked(a.state), SHATTER_13);
    expect(emitted([...a.events, ...events])).toEqual([
      { seq: 1, event: { type: "sharedVillainDamaged", groupId: "g1", amount: 13 } },
      { seq: 2, event: { type: "sharedVillainDamaged", groupId: "g1", amount: 13 } },
    ]);
    expect(podOf(state).shared).toEqual(podOf(local).shared);
    expect(podOf(state).pendingResults).toBeUndefined();
    expect(typesOf(events, "sharedStateChanged", "sharedResultApplied", "cardFlipped", "gameEnded")).toEqual([]);
    expect(neutralVillain(state).flipped).toBe(false);
    expect(state.outcome).toBeNull();
    expect(ledgerMarks(state)).toEqual({ after: 2 });
  });
});

describe("a game with no shared record", () => {
  it("the effect does nothing and logs nothing", () => {
    const start = gameAtFirstTurn({
      cards: [LEDGER, ...SCRIPTS.map((s) => s.card)],
      deps: scripted,
      deck: SCRIPTS.flatMap((s) => copiesOf(s.card.id, 3)),
      encounter: [LEDGER.id, ...copiesOf(TREACHERY.id, 20)],
    });
    const { state, events } = play(encounterCardInVillainArea(start, LEDGER.id).state, SHATTER_7);
    expect("pod" in state).toBe(false);
    expect(emitted(events)).toEqual([]);
    expect(ledgerMarks(state)).toEqual({ after: 1 });
  });
});
