/**
 * docs/phase7-wave5.md §4.1 Q49: characters defeated by one effect share one leave-play window, like the other
 * simultaneous leavings (§4.1 Q33). Two minions left at 0 hit points by one damage sweep:
 *
 * - their defeats share one interrupt window, then every When Defeated ability resolves (the first player orders them
 *   across cards, RRG 1.8 "Simultaneous Resolution", p. 40) with both cards still in play (RRG 1.8 "When Defeated
 *   Abilities", p. 48);
 * - then both leave from one step: one interrupt window for their "when this leaves play" interrupts and those of the
 *   attachments leaving with them (§4.1 Q32), ordered by the first player, and one response window;
 * - then one response window for both defeats (RRG 1.8 "Damage", p. 14, steps 6–9, taken for both at once: ruling,
 *   June 2, 2026 (2) answer 1).
 *
 * A permanent minion at 0 hit points is not defeated (§4.1 Q54), and with nothing listening nothing is asked or opened.
 * Synthetic cards; `resolve/defeated-together.ts` is the engine side.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { driveSession } from "./testing/drive.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const mark = (counterType: string, amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: tracker,
  counterType,
  amount,
});
const one: ValueSpec = { kind: "const", value: 1 };
/** How many grunts are in play right now. */
const gruntsInPlay: ValueSpec = { kind: "count", query: { categories: ["minion"], name: "grunt" } };
/** 1 while the gadget is still attached to a grunt in play. */
const gadgetOnGrunt: ValueSpec = { kind: "count", query: { name: "grunt", hasAttachment: { name: "gadget" } } };

/** "Forced Interrupt: When this minion leaves play, …": counts the grunts it sees in play. */
const GRUNT_LEAVES = stubAbility("grunt.leaves", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("leaveInterrupt", one), mark("leaveSees", gruntsInPlay)],
});
/** "When Defeated: …": counts the grunts it sees in play. */
const GRUNT_WHEN_DEFEATED = stubAbility("grunt.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [mark("whenDefeated", one), mark("whenDefeatedSees", gruntsInPlay)],
});
/** "Forced Interrupt: When a minion is defeated, …" */
const DEFEAT_INTERRUPT = stubAbility("tracker.defeat-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["minion"] } } },
  effects: [mark("defeatInterrupt", one), mark("defeatInterruptSees", gruntsInPlay)],
});
/** "Forced Response: After a minion is defeated, …" */
const DEFEAT_RESPONSE = stubAbility("tracker.defeat-response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: { categories: ["minion"] } } },
  effects: [mark("defeatResponse", one), mark("defeatResponseSees", gruntsInPlay)],
});
/** "Forced Response: After a card leaves play, …" */
const LEAVE_RESPONSE = stubAbility("tracker.leave-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay" } },
  effects: [mark("leaveResponse", one)],
});
/** "Interrupt: When [this upgrade] leaves play, …": whether its grunt is still in play with it attached. */
const GADGET_LEAVES = stubAbility("gadget.leaves", {
  trigger: { kind: "interrupt", forced: true, on: { on: "cardLeavesPlay", selfIs: "target" } },
  effects: [mark("gadgetInterrupt", one), mark("gadgetOnGrunt", gadgetOnGrunt), mark("gadgetSees", gruntsInPlay)],
});

const PERMANENT = [{ name: "permanent" }] as const;

/** "Deal 3 damage to each minion": one effect, both grunts dealt their damage at once. */
const SWEEP_ACTION = stubAbility("sweep.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["minion"] } },
      amount: { kind: "const", value: 3 },
    },
  ],
});
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });
/** "Defeat each minion." */
const WIPE_ACTION = stubAbility("wipe.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "defeat", target: { kind: "each", query: { categories: ["minion"] } } }],
});
const WIPE = stubEvent({ id: "wipe", cost: 0, abilities: [WIPE_ACTION.ref] });

interface Table {
  readonly state: GameState;
  readonly deps: EngineDeps;
  readonly first: InstanceId;
  readonly second: InstanceId;
  readonly tracker: InstanceId;
  readonly extra?: InstanceId;
  readonly gadget?: InstanceId;
}

/**
 * Two grunts (1 hit point each) engaged with P1, carrying `gruntAbilities`, and the tracker with `trackerAbilities`.
 * `permanentToo`: a permanent 1-hit-point minion as well. `gadget`: the listening gadget attached to the first grunt.
 */
function table(
  gruntAbilities: readonly StubAbility[],
  trackerAbilities: readonly StubAbility[],
  options: { readonly permanentToo?: boolean; readonly gadget?: boolean } = {},
): Table {
  const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 1, abilities: gruntAbilities.map((a) => a.ref) });
  const STALWART = stubMinion({ id: "stalwart", atk: 1, sch: 1, hp: 1, keywords: PERMANENT });
  const TRACKER = stubSupport({ id: "tracker", cost: 0, abilities: trackerAbilities.map((a) => a.ref) });
  const GADGET = stubUpgrade({ id: "gadget", cost: 0, abilities: [GADGET_LEAVES.ref] });
  const deps = depsOf(...gruntAbilities, ...trackerAbilities, GADGET_LEAVES, SWEEP_ACTION, WIPE_ACTION);
  const start = gameAtFirstTurn({
    cards: [GRUNT, STALWART, TRACKER, GADGET, SWEEP, WIPE],
    deps,
    deck: [TRACKER.id, GADGET.id, SWEEP.id, WIPE.id],
    encounter: [...copiesOf(TREACHERY.id, 27), GRUNT.id, GRUNT.id, STALWART.id],
  });
  const withTracker = playerCardIntoPlay(start, TRACKER.id);
  const first = minionEngagedWith(withTracker.state, GRUNT.id);
  const second = minionEngagedWith(first.state, GRUNT.id);
  let state = second.state;
  let extra: InstanceId | undefined;
  if (options.permanentToo) {
    const stalwart = minionEngagedWith(state, STALWART.id);
    state = stalwart.state;
    extra = stalwart.id;
  }
  let gadget: InstanceId | undefined;
  if (options.gadget) {
    const placed = playerCardIntoPlay(state, GADGET.id);
    gadget = placed.id;
    const s = placed.state;
    // Surgery: the gadget attached to the first grunt.
    state = {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== placed.id) } : p,
      ),
      instances: {
        ...s.instances,
        [placed.id]: { ...mustInstance(s, placed.id), attachedTo: first.id },
        [first.id]: { ...mustInstance(s, first.id), attachments: [placed.id] },
      },
    };
  }
  return {
    state,
    deps,
    first: first.id,
    second: second.id,
    tracker: withTracker.id,
    ...(extra ? { extra } : {}),
    ...(gadget ? { gadget } : {}),
  };
}

/** Plays `card` for 0, answering an order prompt with `leading`'s abilities first. */
function play(t: Table, card: string, leading: InstanceId = t.first) {
  const given = giveCard(t.state, P1, card);
  const pick = (state: GameState) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind !== "orderTriggers") return defaultPick(state);
    const ids = choice.options.map((o) => o.optionId);
    return [...ids.filter((id) => id.startsWith(`${leading}:`)), ...ids.filter((id) => !id.startsWith(`${leading}:`))];
  };
  const { session, events } = driveSession(
    startSession(given.state),
    t.deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  return { session, events, state: session.state };
}

const marks = (state: GameState, t: Table) => mustInstance(state, t.tracker).counters;
const encounterDiscard = (state: GameState) => Object.values(state.encounterDecks).flatMap((piles) => piles.discard);
const expectReplays = (session: GameSession, deps: EngineDeps) => {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
};
/** The windows opened for `kind` at `timing`, each as its candidates' ability ids. */
const windows = (events: readonly GameEvent[], kind: string, timing: "interrupt" | "response") =>
  events.flatMap((e) =>
    e.type === "windowOpened" && e.timing === timing && e.event.kind === kind
      ? [e.candidates.map((c) => `${c.abilityId}`)]
      : [],
  );
const orderPrompts = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "choiceRequested" && e.choice.prompt.kind === "orderTriggers" ? [e.choice] : []));
const resolvedBy = (events: readonly GameEvent[], abilityId: string) =>
  events.flatMap((e) => (e.type === "abilityResolved" && e.abilityId === abilityId ? [e.instanceId] : []));
const at = (events: readonly GameEvent[], found: (e: GameEvent) => boolean) => events.findIndex(found);

describe("§4.1 Q49 characters defeated by one effect share one leave-play window", () => {
  for (const which of ["first", "second"] as const) {
    it(`one interrupt window for both defeats, one for both leavings (the ${which} grunt's first, as the first player chose), one response window each`, () => {
      const t = table([GRUNT_LEAVES], [DEFEAT_INTERRUPT, DEFEAT_RESPONSE, LEAVE_RESPONSE]);
      const leading = which === "first" ? t.first : t.second;
      const { session, events, state } = play(t, SWEEP.id, leading);

      // One interrupt window for both defeats, each interrupt seeing both grunts still in play.
      expect(windows(events, "characterDefeated", "interrupt")).toEqual([
        [DEFEAT_INTERRUPT.ref.id, DEFEAT_INTERRUPT.ref.id],
      ]);
      // One interrupt window for both leavings, ordered by the first player; each saw both grunts in play.
      expect(windows(events, "cardLeavesPlay", "interrupt")).toEqual([[GRUNT_LEAVES.ref.id, GRUNT_LEAVES.ref.id]]);
      const leaveOrder = orderPrompts(events).find((c) =>
        c.options.every((o) => o.optionId.includes(`:${GRUNT_LEAVES.ref.id}`)),
      );
      expect(leaveOrder).toMatchObject({ playerId: state.firstPlayerId, authority: "firstPlayerOrders" });
      expect(resolvedBy(events, GRUNT_LEAVES.ref.id)).toEqual(
        which === "first" ? [t.first, t.second] : [t.second, t.first],
      );
      expect(marks(state, t)).toMatchObject({
        defeatInterrupt: 2,
        defeatInterruptSees: 4,
        leaveInterrupt: 2,
        leaveSees: 4,
        leaveResponse: 2,
        defeatResponse: 2,
        // Both gone by the defeat responses.
      });
      expect(marks(state, t).defeatResponseSees ?? 0).toBe(0);
      // One response window for both leavings, then one for both defeats.
      expect(windows(events, "cardLeavesPlay", "response")).toEqual([[LEAVE_RESPONSE.ref.id, LEAVE_RESPONSE.ref.id]]);
      expect(windows(events, "characterDefeated", "response")).toEqual([
        [DEFEAT_RESPONSE.ref.id, DEFEAT_RESPONSE.ref.id],
      ]);
      const leaveResponses = at(
        events,
        (e) => e.type === "windowOpened" && e.timing === "response" && e.event.kind === "cardLeavesPlay",
      );
      const defeatResponses = at(
        events,
        (e) => e.type === "windowOpened" && e.timing === "response" && e.event.kind === "characterDefeated",
      );
      expect(leaveResponses).toBeLessThan(defeatResponses);
      expect(encounterDiscard(state)).toEqual(expect.arrayContaining([t.first, t.second]));
      expect(state.stack).toEqual([]);
      expectReplays(session, t.deps);
    });
  }

  for (const which of ["first", "second"] as const) {
    it(`every When Defeated resolves before either card leaves, both in play; the first player orders them (the ${which} first)`, () => {
      const t = table([GRUNT_WHEN_DEFEATED], [LEAVE_RESPONSE]);
      const leading = which === "first" ? t.first : t.second;
      const { session, events, state } = play(t, SWEEP.id, leading);

      const [order] = orderPrompts(events);
      expect(order).toMatchObject({ playerId: state.firstPlayerId, authority: "firstPlayerOrders" });
      expect(order?.options.map((o) => o.optionId).sort()).toEqual(
        [`${t.first}:${GRUNT_WHEN_DEFEATED.ref.id}`, `${t.second}:${GRUNT_WHEN_DEFEATED.ref.id}`].sort(),
      );
      expect(resolvedBy(events, GRUNT_WHEN_DEFEATED.ref.id)).toEqual(
        which === "first" ? [t.first, t.second] : [t.second, t.first],
      );
      // Each When Defeated saw both grunts in play: 2 + 2.
      expect(marks(state, t)).toMatchObject({ whenDefeated: 2, whenDefeatedSees: 4, leaveResponse: 2 });
      const lastWhenDefeated = events.reduce(
        (last, e, i) => (e.type === "abilityResolved" && e.abilityId === GRUNT_WHEN_DEFEATED.ref.id ? i : last),
        -1,
      );
      const firstDiscard = at(events, (e) => e.type === "cardDiscardedFromPlay");
      expect(lastWhenDefeated).toBeLessThan(firstDiscard);
      expect(windows(events, "cardLeavesPlay", "response")).toEqual([[LEAVE_RESPONSE.ref.id, LEAVE_RESPONSE.ref.id]]);
      expect(state.stack).toEqual([]);
      expectReplays(session, t.deps);
    });
  }

  it("an attachment on a defeated grunt joins the shared leave window, still attached (§4.1 Q32)", () => {
    const t = table([GRUNT_LEAVES], [LEAVE_RESPONSE], { gadget: true });
    const { session, events, state } = play(t, SWEEP.id);
    const [window] = windows(events, "cardLeavesPlay", "interrupt");
    expect(windows(events, "cardLeavesPlay", "interrupt")).toHaveLength(1);
    expect([...(window ?? [])].sort()).toEqual(
      [GRUNT_LEAVES.ref.id, GRUNT_LEAVES.ref.id, GADGET_LEAVES.ref.id].map(String).sort(),
    );
    // The gadget's interrupt saw its grunt in play with it attached, and the other grunt too.
    expect(marks(state, t)).toMatchObject({ gadgetInterrupt: 1, gadgetOnGrunt: 1, gadgetSees: 2, leaveSees: 4 });
    // One response window for all three leavings.
    expect(windows(events, "cardLeavesPlay", "response")).toEqual([
      [LEAVE_RESPONSE.ref.id, LEAVE_RESPONSE.ref.id, LEAVE_RESPONSE.ref.id],
    ]);
    expect(mustPlayer(state, P1).discard).toContain(t.gadget);
    expect(encounterDiscard(state)).toEqual(expect.arrayContaining([t.first, t.second]));
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("a permanent minion at 0 hit points stays in play; the others are defeated together (§4.1 Q54)", () => {
    const t = table([GRUNT_LEAVES], [DEFEAT_INTERRUPT], { permanentToo: true });
    const { session, events, state } = play(t, SWEEP.id);
    const stalwart = t.extra!;
    expect(mustPlayer(state, P1).playArea).toContain(stalwart);
    expect(mustInstance(state, stalwart).damage).toBeGreaterThanOrEqual(1);
    const defeated = events.flatMap((e) => (e.type === "characterDefeated" ? [e.instanceId] : []));
    expect(defeated).toEqual([t.first, t.second]);
    expect(windows(events, "characterDefeated", "interrupt")).toEqual([
      [DEFEAT_INTERRUPT.ref.id, DEFEAT_INTERRUPT.ref.id],
    ]);
    expect(windows(events, "cardLeavesPlay", "interrupt")).toEqual([[GRUNT_LEAVES.ref.id, GRUNT_LEAVES.ref.id]]);
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it('"defeat each minion" is one effect: one leave window, one response window', () => {
    const t = table([GRUNT_LEAVES], [DEFEAT_RESPONSE]);
    const { session, events, state } = play(t, WIPE.id);
    expect(windows(events, "cardLeavesPlay", "interrupt")).toEqual([[GRUNT_LEAVES.ref.id, GRUNT_LEAVES.ref.id]]);
    expect(windows(events, "characterDefeated", "response")).toEqual([
      [DEFEAT_RESPONSE.ref.id, DEFEAT_RESPONSE.ref.id],
    ]);
    expect(marks(state, t)).toMatchObject({ leaveSees: 4, defeatResponse: 2 });
    expect(encounterDiscard(state)).toEqual(expect.arrayContaining([t.first, t.second]));
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });

  it("with nothing listening, nothing is opened, asked or announced", () => {
    const t = table([], []);
    const { session, events, state } = play(t, SWEEP.id);
    expect(events.filter((e) => e.type === "windowOpened")).toEqual([]);
    expect(events.filter((e) => e.type === "choiceRequested")).toEqual([]);
    expect(events.filter((e) => e.type === "framePushed" && e.frame === "window")).toEqual([]);
    expect(events.filter((e) => e.type === "triggerEvent" && e.event.kind === "cardLeavesPlay")).toEqual([]);
    const defeated = events.flatMap((e) => (e.type === "characterDefeated" ? [e.instanceId] : []));
    expect(defeated).toEqual([t.first, t.second]);
    const discarded = events.flatMap((e) => (e.type === "cardDiscardedFromPlay" ? [e.instanceId] : []));
    expect(discarded.filter((id) => id === t.first || id === t.second)).toEqual([t.first, t.second]);
    expect(encounterDiscard(state)).toEqual(expect.arrayContaining([t.first, t.second]));
    expect(state.stack).toEqual([]);
    expectReplays(session, t.deps);
  });
});
