import { cardId, abilityId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { groupId, instanceId, playerId } from "./ids.js";
import type { PodOutboundEvent, SharedPodState } from "./pod.js";
import {
  createPodCoordinator,
  inboundSince,
  markGroupDropped,
  podmatesOf,
  receiveOutbound,
  replayCoordinator,
  type CoordinatorResult,
  type PodCoordinatorSetup,
  type PodCoordinatorState,
  type PodDelivery,
} from "./pod-coordinator.js";

/**
 * The pod coordinator alone, with fake groups (docs/epic-multiplayer-plan.md §4 item 1). MC55 p. 11 and 55028b: one
 * Loki, God of Lies and one Worlds Collide per game; pods only scope "your pod" abilities (MC55 pp. 4, 13).
 *
 * A game of 4 groups in 2 pods (A: g1, g2; B: g3, g4), 2 + 3 + 1 + 2 = 8 players: Loki has 20 per player = 160 hit
 * points and flips at 10 per player = 80 remaining; Worlds Collide's target is 2 per group in the game = 8 (Q3).
 */
const [G1, G2, G3, G4] = ["g1", "g2", "g3", "g4"].map(groupId) as [
  ReturnType<typeof groupId>,
  ReturnType<typeof groupId>,
  ReturnType<typeof groupId>,
  ReturnType<typeof groupId>,
];
const SHARED: SharedPodState = {
  villainHp: 160,
  villainDamage: 0,
  villainFlipAtRemaining: 80,
  villainFlipped: false,
  schemeThreat: 0,
  schemeTarget: 8,
  status: "playing",
};
const SETUP: PodCoordinatorSetup = {
  groups: [
    { groupId: G1, podId: "A", players: 2 },
    { groupId: G2, podId: "A", players: 3 },
    { groupId: G3, podId: "B", players: 1 },
    { groupId: G4, podId: "B", players: 2 },
  ],
  shared: SHARED,
};

/** A fake group: its own outbound counter, as an engine numbers them. */
class FakeGroup {
  seq = 0;
  constructor(readonly id: ReturnType<typeof groupId>) {}
  next(event: PodOutboundEvent) {
    this.seq++;
    return { seq: this.seq, event };
  }
}

const ok = (result: CoordinatorResult) => {
  if (!result.ok) throw new Error(result.error.message);
  return result;
};
const kinds = (delivered: readonly PodDelivery[]) => delivered.map((d) => `${d.groupId}:${d.event.kind}`);

const damage = (g: FakeGroup, amount: number): PodOutboundEvent => ({
  type: "sharedVillainDamaged",
  groupId: g.id,
  amount,
});
const threat = (g: FakeGroup, cause: "schemeCompleted" | "identityDefeated" = "schemeCompleted"): PodOutboundEvent => ({
  type: "sharedSchemeThreatPlaced",
  groupId: g.id,
  amount: 1,
  cause,
});
const status = (g: FakeGroup, phase: "setup" | "player" | "villain", halted = false): PodOutboundEvent => ({
  type: "groupStatus",
  groupId: g.id,
  status: { phase, round: 1, halted },
});

function send(state: PodCoordinatorState, g: FakeGroup, event: PodOutboundEvent) {
  return ok(receiveOutbound(state, g.id, g.next(event)));
}

describe("PodCoordinator: the shared villain across every pod", () => {
  it("adds damage from several groups of both pods into one record, flips once at 80 and tells every group", () => {
    const [g1, g2, g3] = [new FakeGroup(G1), new FakeGroup(G2), new FakeGroup(G3)];
    let state = createPodCoordinator(SETUP);
    let r = send(state, g1, damage(g1, 30));
    expect(kinds(r.delivered)).toEqual([
      ...["g1", "g2", "g3", "g4"].map((g) => `${g}:sharedStateChanged`),
      // Last, to the sender only: it may play on (`PodState.awaiting`).
      "g1:sharedAck",
    ]);
    state = r.state;
    r = send(state, g3, damage(g3, 40));
    state = r.state;
    expect(state.shared.villainDamage).toBe(70);
    expect(r.delivered.some((d) => d.event.kind === "sharedVillainFlipped")).toBe(false);
    r = send(state, g2, damage(g2, 15)); // 85 dealt, 75 left: the flip (MC55 p. 20)
    state = r.state;
    expect(kinds(r.delivered)).toEqual([
      "g1:sharedStateChanged",
      "g2:sharedStateChanged",
      "g3:sharedStateChanged",
      "g4:sharedStateChanged",
      "g1:sharedVillainFlipped",
      "g2:sharedVillainFlipped",
      "g3:sharedVillainFlipped",
      "g4:sharedVillainFlipped",
      "g2:sharedAck",
    ]);
    r = send(state, g1, damage(g1, 5));
    expect(r.delivered.filter((d) => d.event.kind === "sharedVillainFlipped")).toEqual([]);
  });

  it("wins for all groups when the shared villain is defeated, and after that only acknowledges", () => {
    const g4 = new FakeGroup(G4);
    let state = createPodCoordinator(SETUP);
    const r = send(state, g4, damage(g4, 500));
    state = r.state;
    expect(state.outcome).toBe("won");
    expect(state.shared).toMatchObject({ villainDamage: 160, status: "won" });
    expect(kinds(r.delivered).filter((k) => k.endsWith("gameWon"))).toEqual(
      ["g1", "g2", "g3", "g4"].map((g) => `${g}:gameWon`),
    );
    expect(kinds(send(state, g4, threat(g4)).delivered)).toEqual(["g4:sharedAck"]);
  });
});

describe("PodCoordinator: Worlds Collide and the stop rule (MC55 p. 21; M4)", () => {
  it("counts threat from every group of every pod toward 8, then stops everyone and loses once all have halted", () => {
    const groups = [G1, G2, G3, G4].map((id) => new FakeGroup(id));
    let state = createPodCoordinator(SETUP);
    let last: PodDelivery[] = [];
    for (let i = 0; i < 8; i++) {
      const g = groups[i % 4]!;
      const r = send(state, g, threat(g, i % 2 === 0 ? "schemeCompleted" : "identityDefeated"));
      state = r.state;
      last = [...r.delivered];
    }
    expect(state.shared).toMatchObject({ schemeThreat: 8, status: "schemeCompleted" });
    expect(kinds(last).filter((k) => k.endsWith("stopAfterPhase"))).toHaveLength(4);
    expect(state.outcome).toBe("playing");
    // g1 and g3 were in a villain phase and halt at once; g2 is in a player phase; g4 is still in setup (option A).
    for (const g of [groups[0]!, groups[2]!, groups[3]!]) {
      const r = send(state, g, status(g, "villain", true));
      state = r.state;
      expect(r.delivered).toEqual([]);
    }
    // The last player phase ends: every group halted, all lose.
    const g2 = groups[1]!;
    const r = send(state, g2, status(g2, "villain", true));
    state = r.state;
    expect(state.outcome).toBe("lost");
    expect(state.shared.status).toBe("lost");
    expect(kinds(r.delivered).filter((k) => k.endsWith("gameLost"))).toHaveLength(4);
  });

  it("wins if the shared villain falls in a player phase still running after the completion", () => {
    const [g1, g2] = [new FakeGroup(G1), new FakeGroup(G2)];
    let state = createPodCoordinator({ ...SETUP, shared: { ...SHARED, schemeThreat: 7, villainDamage: 150 } });
    state = send(state, g1, threat(g1)).state;
    expect(state.shared.status).toBe("schemeCompleted");
    const r = send(state, g2, damage(g2, 10));
    expect(r.state.outcome).toBe("won");
  });

  it("does not let a dropped group hold up the loss (plan Q-C default (b), pending)", () => {
    const groups = [G1, G2, G3].map((id) => new FakeGroup(id));
    let state = createPodCoordinator({ ...SETUP, shared: { ...SHARED, schemeThreat: 7 } });
    state = send(state, groups[0]!, threat(groups[0]!)).state;
    for (const g of groups) state = send(state, g, status(g, "villain", true)).state;
    expect(state.outcome).toBe("playing");
    const r = ok(markGroupDropped(state, G4));
    expect(r.state.outcome).toBe("lost");
  });
});

describe("PodCoordinator: sequence numbers, duplicates and replay", () => {
  it("applies each number once, refuses a gap, and keeps every inbound event for a re-send", () => {
    const g1 = new FakeGroup(G1);
    let state = createPodCoordinator(SETUP);
    const first = g1.next(damage(g1, 3));
    state = ok(receiveOutbound(state, G1, first)).state;
    const again = ok(receiveOutbound(state, G1, first));
    expect(again.duplicate).toBe(true);
    expect(again.state).toBe(state);
    const gap = receiveOutbound(state, G1, { seq: 3, event: damage(g1, 1) });
    expect(gap.ok).toBe(false);
    if (!gap.ok) expect(gap.error.code).toBe("out_of_order");
    expect(inboundSince(state, G3, 0)).toEqual([
      { sequence: 1, event: { kind: "sharedStateChanged", shared: state.shared } },
    ]);
    expect(inboundSince(state, G3, 1)).toEqual([]);
  });

  it("refuses an event a group sends in another group's name", () => {
    const r = receiveOutbound(createPodCoordinator(SETUP), G1, { seq: 1, event: damage(new FakeGroup(G2), 1) });
    expect(r.ok).toBe(false);
  });

  it("replays its log to the same state", () => {
    const [g1, g3] = [new FakeGroup(G1), new FakeGroup(G3)];
    let state = createPodCoordinator(SETUP);
    state = send(state, g1, damage(g1, 90)).state;
    state = send(state, g3, threat(g3)).state;
    state = send(state, g1, status(g1, "player")).state;
    expect(replayCoordinator(SETUP, state.log)).toEqual(state);
  });
});

describe("PodCoordinator: 'your pod' routing (M2, M6)", () => {
  const block = {
    sourceCardId: cardId("55044"),
    abilityId: abilityId("55044.when-defeated"),
    block: 1,
  };

  it("pods are fixed at setup: g1's pod is g1 and g2", () => {
    expect(podmatesOf(createPodCoordinator(SETUP), G1)).toEqual([G1, G2]);
  });

  it("sends a synergy grant to a group of the sender's pod, and nowhere else", () => {
    const g1 = new FakeGroup(G1);
    let state = createPodCoordinator(SETUP);
    let r = send(state, g1, { type: "podEffectRequested", groupId: G1, toGroupId: G2, ...block });
    expect(r.delivered).toEqual([
      { groupId: G2, sequence: 1, event: { kind: "podEffect", fromGroupId: G1, ...block } },
    ]);
    state = r.state;
    r = send(state, g1, { type: "podEffectRequested", groupId: G1, toGroupId: G3, ...block });
    expect(r.delivered).toEqual([]);
  });

  it("relays a group's reachable cards to the rest of its pod, and routes a remote attack only to a reported card", () => {
    const [g1, g2] = [new FakeGroup(G1), new FakeGroup(G2)];
    const target = instanceId("i-mangog");
    const ref = instanceId("i-standin");
    const mangog = { instanceId: target, cardId: cardId("55041"), by: "attack" as const, remainingHitPoints: 20 };
    const used = {
      type: "remotePowerUsed" as const,
      groupId: G1,
      playerId: playerId("p1"),
      targetInstanceId: target,
      ref,
      power: "attack" as const,
      amount: 5,
      overkill: true,
      piercing: false,
    };
    let state = createPodCoordinator(SETUP);
    // Not reported yet: refused back to g1, before g2 hears of it.
    let r = send(state, g1, { ...used, toGroupId: G2 });
    expect(r.delivered).toEqual([
      {
        groupId: G1,
        sequence: 1,
        event: {
          kind: "remotePowerResolved",
          fromGroupId: G2,
          ref,
          targetInstanceId: target,
          power: "attack",
          retaliate: 0,
          refused: "that card is no longer reachable from your pod",
        },
      },
    ]);
    state = r.state;
    // g2 reports it: g1 (same pod) gets a copy, g3 and g4 (pod B) do not.
    r = send(state, g2, { type: "reachableCards", groupId: G2, cards: [mangog] });
    expect(r.delivered).toEqual([
      { groupId: G1, sequence: 2, event: { kind: "podReachable", groupId: G2, cards: [mangog] } },
    ]);
    state = r.state;
    r = send(state, g1, { ...used, toGroupId: G2 });
    expect(r.delivered).toEqual([
      {
        groupId: G2,
        sequence: 1,
        event: {
          kind: "remotePower",
          fromGroupId: G1,
          playerId: playerId("p1"),
          targetInstanceId: target,
          ref,
          power: "attack",
          amount: 5,
          overkill: true,
          piercing: false,
        },
      },
    ]);
    state = r.state;
    r = send(state, g2, {
      type: "remotePowerResolved",
      groupId: G2,
      toGroupId: G1,
      ref,
      targetInstanceId: target,
      power: "attack",
      retaliate: 1,
    });
    expect(kinds(r.delivered)).toEqual(["g1:remotePowerResolved"]);
    state = r.state;
    r = send(state, g2, { type: "overkillExcess", groupId: G2, toGroupId: G1, ref, amount: 3 });
    expect(r.delivered).toEqual([
      { groupId: G1, sequence: 4, event: { kind: "overkillExcess", fromGroupId: G2, ref, amount: 3 } },
    ]);
    state = r.state;
    // Another pod's card is refused.
    r = send(state, g1, { ...used, toGroupId: G3 });
    expect(r.delivered[0]?.event).toMatchObject({
      kind: "remotePowerResolved",
      refused: "that group is not in your pod",
    });
  });

  it("refuses back a forwarded remote power when the owning group drops, so the attacker's group refunds it", () => {
    const [g1, g2] = [new FakeGroup(G1), new FakeGroup(G2)];
    const target = instanceId("i-mangog");
    const ref = instanceId("i-standin");
    let state = createPodCoordinator(SETUP);
    state = send(state, g2, {
      type: "reachableCards",
      groupId: G2,
      cards: [{ instanceId: target, cardId: cardId("55041"), by: "attack", remainingHitPoints: 20 }],
    }).state;
    state = send(state, g1, {
      type: "remotePowerUsed",
      groupId: G1,
      playerId: playerId("p1"),
      toGroupId: G2,
      targetInstanceId: target,
      ref,
      power: "attack",
      amount: 2,
      overkill: false,
      piercing: false,
    }).state;
    expect(state.pending).toEqual([{ fromGroupId: G1, toGroupId: G2, ref, targetInstanceId: target, power: "attack" }]);
    const dropped = ok(markGroupDropped(state, G2));
    expect(dropped.delivered.map((d) => [d.groupId, d.event])).toEqual([
      [
        G1,
        {
          kind: "remotePowerResolved",
          fromGroupId: G2,
          ref,
          targetInstanceId: target,
          power: "attack",
          retaliate: 0,
          refused: "that group has dropped",
        },
      ],
    ]);
    expect(dropped.state.pending).toBeUndefined();
    expect(replayCoordinator(SETUP, dropped.state.log)).toEqual(dropped.state);
  });

  it("keeps two groups' remote powers to one group apart when their local refs are equal", () => {
    // Refs are instance ids local to each table, so g1 and g2 may both send "i-standin" to g3 at once.
    const setup: PodCoordinatorSetup = {
      groups: [
        { groupId: G1, podId: "A", players: 1 },
        { groupId: G2, podId: "A", players: 1 },
        { groupId: G3, podId: "A", players: 1 },
      ],
      shared: SHARED,
    };
    const [g1, g2, g3] = [new FakeGroup(G1), new FakeGroup(G2), new FakeGroup(G3)];
    const target = instanceId("i-mangog");
    const ref = instanceId("i-standin");
    const used = (g: FakeGroup) =>
      ({
        type: "remotePowerUsed",
        groupId: g.id,
        playerId: playerId("p1"),
        toGroupId: G3,
        targetInstanceId: target,
        ref,
        power: "attack",
        amount: 2,
        overkill: false,
        piercing: false,
      }) as const;
    const resolved = (toGroupId: typeof G1) =>
      ({
        type: "remotePowerResolved",
        groupId: G3,
        toGroupId,
        ref,
        targetInstanceId: target,
        power: "attack",
        retaliate: 0,
      }) as const;
    let state = createPodCoordinator(setup);
    state = send(state, g3, {
      type: "reachableCards",
      groupId: G3,
      cards: [{ instanceId: target, cardId: cardId("55041"), by: "attack", remainingHitPoints: 20 }],
    }).state;
    state = send(state, g1, used(g1)).state;
    state = send(state, g2, used(g2)).state;
    expect(state.pending).toHaveLength(2);
    // g3 answers g1's attack: only g1's entry is settled, and only g1 hears of it.
    let r = send(state, g3, resolved(G1));
    expect(kinds(r.delivered)).toEqual(["g1:remotePowerResolved"]);
    expect(r.state.pending).toEqual([
      { fromGroupId: G2, toGroupId: G3, ref, targetInstanceId: target, power: "attack" },
    ]);
    state = r.state;
    // A second answer to g1, or one naming another power, matches nothing and is not forwarded.
    r = send(state, g3, resolved(G1));
    expect(r.delivered).toEqual([]);
    r = send(r.state, g3, { ...resolved(G2), power: "thwart" });
    expect(r.delivered).toEqual([]);
    expect(r.state.pending).toHaveLength(1);
    state = r.state;
    // g3 drops before answering g2: g2's power is still tracked, so it is refused back to g2 alone.
    const dropped = ok(markGroupDropped(state, G3));
    expect(dropped.delivered.map((d) => [d.groupId, d.event])).toEqual([
      [
        G2,
        {
          kind: "remotePowerResolved",
          fromGroupId: G3,
          ref,
          targetInstanceId: target,
          power: "attack",
          retaliate: 0,
          refused: "that group has dropped",
        },
      ],
    ]);
    expect(dropped.state.pending).toBeUndefined();
    expect(replayCoordinator(setup, dropped.state.log)).toEqual(dropped.state);
  });

  it("refuses back a forwarded remote power when the owning table's game ends, with no drop, and only once", () => {
    // g2 concedes locally while g1's attack is in flight: g2 now refuses every inbound event (game_over), so the
    // coordinator answers for it. A power g2 answered before ending is not refunded again.
    const [g1, g2] = [new FakeGroup(G1), new FakeGroup(G2)];
    const target = instanceId("i-mangog");
    const [answered, inFlight] = [instanceId("i-standin-1"), instanceId("i-standin-2")];
    const used = (ref: typeof answered) =>
      ({
        type: "remotePowerUsed",
        groupId: G1,
        playerId: playerId("p1"),
        toGroupId: G2,
        targetInstanceId: target,
        ref,
        power: "attack",
        amount: 2,
        overkill: false,
        piercing: false,
      }) as const;
    let state = createPodCoordinator(SETUP);
    state = send(state, g2, {
      type: "reachableCards",
      groupId: G2,
      cards: [{ instanceId: target, cardId: cardId("55041"), by: "attack", remainingHitPoints: 20 }],
    }).state;
    state = send(state, g1, used(answered)).state;
    state = send(state, g1, used(inFlight)).state;
    state = send(state, g2, {
      type: "remotePowerResolved",
      groupId: G2,
      toGroupId: G1,
      ref: answered,
      targetInstanceId: target,
      power: "attack",
      retaliate: 0,
    }).state;
    const over = send(state, g2, {
      type: "groupStatus",
      groupId: G2,
      status: { phase: "over", round: 1, halted: false },
    });
    expect(over.delivered.map((d) => [d.groupId, d.event])).toEqual([
      [
        G1,
        {
          kind: "remotePowerResolved",
          fromGroupId: G2,
          ref: inFlight,
          targetInstanceId: target,
          power: "attack",
          retaliate: 0,
          refused: "that group is no longer playing",
        },
      ],
    ]);
    expect(over.state.pending).toBeUndefined();
    expect(over.state.groups.find((g) => g.groupId === G2)?.dropped).toBe(false);
    // A later organizer drop finds nothing left to refuse.
    const dropped = ok(markGroupDropped(over.state, G2));
    expect(dropped.delivered).toEqual([]);
    expect(replayCoordinator(SETUP, dropped.state.log)).toEqual(dropped.state);
  });

  it("re-sends what a reconnecting group missed (inboundSince)", () => {
    const [g1, g2] = [new FakeGroup(G1), new FakeGroup(G2)];
    let state = createPodCoordinator(SETUP);
    state = send(state, g1, damage(g1, 4)).state;
    state = send(state, g2, damage(g2, 4)).state;
    // g3 applied its first event only: the other two come again, in order.
    const missed = inboundSince(state, G3, 1);
    expect(missed.map((m) => m.sequence)).toEqual([2]);
    expect(missed[0]?.event).toMatchObject({ kind: "sharedStateChanged", shared: { villainDamage: 8 } });
    expect(inboundSince(state, G1, 0).map((m) => m.event.kind)).toEqual([
      "sharedStateChanged",
      "sharedAck",
      "sharedStateChanged",
    ]);
  });

  it("starts a group from the status its setup reported", () => {
    const state = createPodCoordinator({
      ...SETUP,
      groups: SETUP.groups.map((g) => ({ ...g, status: { phase: "setup", round: 1, halted: false } })),
    });
    expect(state.groups[0]?.status).toEqual({ phase: "setup", round: 1, halted: false });
  });

  it("records reachable cards and status per group", () => {
    const g2 = new FakeGroup(G2);
    let state = createPodCoordinator(SETUP);
    const card = { instanceId: instanceId("i-door"), cardId: cardId("55046"), by: "thwart" as const, threat: 14 };
    state = send(state, g2, { type: "reachableCards", groupId: G2, cards: [card] }).state;
    state = send(state, g2, status(g2, "player")).state;
    expect(state.groups[1]).toMatchObject({ reachable: [card], status: { phase: "player", round: 1, halted: false } });
  });
});
