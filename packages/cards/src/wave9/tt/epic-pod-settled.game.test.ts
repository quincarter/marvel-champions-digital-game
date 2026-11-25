import {
  applyCommand,
  cardsInPlay,
  groupId,
  inboundCommand,
  maxHitPoints,
  podOf,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type GroupId,
  type InstanceId,
  type SharedPodState,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../dsl/index.js";
import { P1, firstLegal, identityOf, inst, patchInstance } from "../../testing/harness.js";
import { PodSim } from "../../testing/pod-sim.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { epicGroupScenario } from "../setup.js";
import { IRON_MAN, SHE_HULK, SPIDER_MAN, codeOf, heroForm, onlyDeck } from "../testing.js";
import { TT_ASPECT_BASIC } from "./aspect-basic.js";
import { GOD_OF_LIES } from "./god-of-lies.js";
import { TRICKSTER_MAGIC } from "./trickster-magic.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * What the game record of an Epic Multiplayer table learns for issue #909's achievements, all informational (no rule
 * reads it): which group's damage defeated the shared Loki, God of Lies (`SharedPodState.defeatedByGroup`), and how a
 * cross-table attack on The Mangog (55041) or thwart of Door Between Worlds (55046) ended where the card is
 * (`remotePowerSettled`). The pods are epic-pod.game.test.ts's: g1 and g2 in pod A, g3 alone in pod B.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, GOD_OF_LIES, TRICKSTER_MAGIC, TT_ASPECT_BASIC) };
const [G1, G2, G3] = ["g1", "g2", "g3"].map(groupId) as [GroupId, GroupId, GroupId];
const POD_OF: Readonly<Record<string, readonly GroupId[]>> = { A: [G1, G2], B: [G3] };
const FILLERS = ["01186", "01186", "01188", "01187", "01187", "01189", "01190"] as const;

function pods(stage?: (shared: SharedPodState) => SharedPodState): PodSim {
  const seats = [SPIDER_MAN, IRON_MAN, SHE_HULK];
  return new PodSim(
    [G1, G2, G3].map((g, i) => {
      const podId = g === G3 ? "B" : "A";
      return {
        podId,
        config: epicGroupScenario(
          "god-of-lies",
          { players: [seats[i]!], seed: 1 + i, difficulty: g === G3 ? "expert" : "standard" },
          { groupId: g, groupIdsInPod: POD_OF[podId]!, groupsInGame: 3, playersInGame: 3 },
        ),
      };
    }),
    DEPS,
    stage,
  );
}

function readyWith(sim: PodSim, g: GroupId, next: readonly string[]): void {
  sim.answer(g, firstLegal);
  sim.edit(g, (s) => onlyDeck(heroForm(s, P1), FILLERS[0], ...next, ...FILLERS.slice(1)));
}

function ready(sim: PodSim, ...groups: GroupId[]): void {
  for (const g of groups) {
    sim.answer(g, firstLegal);
    sim.edit(g, (s) => onlyDeck(heroForm(s, P1), ...FILLERS));
  }
}

const onTable = (s: GameState, code: string): InstanceId | undefined =>
  cardsInPlay(s).find((id) => codeOf(s, id) === code);

function mangogInG2(sim: PodSim): InstanceId {
  ready(sim, G1, G3);
  readyWith(sim, G2, ["55041"]);
  sim.act(G2, { type: "endTurn", playerId: P1 }, firstLegal);
  sim.answer(G2, firstLegal);
  return onTable(sim.state(G2), "55041")!;
}

function doorInG1(sim: PodSim): InstanceId {
  ready(sim, G2);
  readyWith(sim, G1, ["55046"]);
  sim.act(G1, { type: "endTurn", playerId: P1 }, firstLegal);
  sim.answer(G1, firstLegal);
  return onTable(sim.state(G1), "55046")!;
}

const remote = (
  sim: PodSim,
  from: GroupId,
  power: "attack" | "thwart",
  to: GroupId,
  target: InstanceId,
): Command & { type: "remotePower" } => ({
  type: "remotePower",
  playerId: P1,
  characterInstanceId: identityOf(sim.state(from), P1),
  power,
  toGroupId: to,
  targetInstanceId: target,
});

/** The outbound events of type `type` group `g` sent since the last `clearEvents`. */
const sent = (sim: PodSim, g: GroupId, type: string): unknown[] =>
  sim.group(g).events.flatMap((e) => (e.type === "podEventEmitted" && e.event.type === type ? [e.event] : []));
const settledIn = (events: readonly GameEvent[]) => events.filter((e) => e.type === "remotePowerSettled");

describe("remotePowerSettled: the owning group tells how a remote power ended (issue #909)", () => {
  it("an attack that defeats The Mangog is settled defeated, after its remotePowerResolved", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    sim.edit(G2, (s) =>
      patchInstance(s, mangog, {
        damage: maxHitPoints(s, mangog, DEPS)! - 1,
        statuses: { ...inst(s, mangog).statuses, tough: 0 },
      }),
    );
    const ref = (): InstanceId | undefined => podOf(sim.state(G1)).inFlight?.[0]?.ref;
    sim.clearEvents();
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    // Defeated, its When Defeated waits on a choice in g2: the outcome is told once that has resolved (a later command).
    expect(podOf(sim.state(G2)).remoteHitsSettling).toEqual([
      expect.objectContaining({ fromGroupId: G1, targetInstanceId: mangog, hit: true }),
    ]);
    expect(sent(sim, G2, "remotePowerSettled")).toEqual([]);
    sim.answer(G2, firstLegal);
    expect(onTable(sim.state(G2), "55041")).toBeUndefined();
    expect(ref()).toBeUndefined();
    const emitted = sim
      .group(G2)
      .events.flatMap((e) => (e.type === "podEventEmitted" ? [e.event.type] : []))
      .filter((t) => t === "remotePowerResolved" || t === "remotePowerSettled");
    expect(emitted).toEqual(["remotePowerResolved", "remotePowerSettled"]);
    expect(sent(sim, G2, "remotePowerSettled")).toEqual([
      expect.objectContaining({
        groupId: G2,
        toGroupId: G1,
        playerId: P1,
        targetInstanceId: mangog,
        cardId: "55041",
        power: "attack",
        defeated: true,
      }),
    ]);
    expect(podOf(sim.state(G2)).remoteHitsSettling).toBeUndefined();
    expect(sim.replayFault()).toBeNull();
  });

  it("an attack that leaves The Mangog standing is settled not defeated", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    sim.clearEvents();
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    expect(onTable(sim.state(G2), "55041")).toBe(mangog);
    expect(sent(sim, G2, "remotePowerSettled")).toEqual([
      expect.objectContaining({ cardId: "55041", power: "attack", defeated: false }),
    ]);
    expect(sim.replayFault()).toBeNull();
  });

  it("a thwart that clears Door Between Worlds is settled defeated", () => {
    const sim = pods();
    const door = doorInG1(sim);
    sim.edit(G1, (s) => patchInstance(s, door, { threat: 1 }));
    sim.clearEvents();
    sim.act(G2, remote(sim, G2, "thwart", G1, door), firstLegal);
    sim.answer(G1, firstLegal);
    expect(onTable(sim.state(G1), "55046")).toBeUndefined();
    expect(sent(sim, G1, "remotePowerSettled")).toEqual([
      expect.objectContaining({ toGroupId: G2, cardId: "55046", power: "thwart", defeated: true }),
    ]);
    expect(sim.replayFault()).toBeNull();
  });

  it("a refused power is never settled", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    const g2 = sim.state(G2);
    const made = applyCommand(
      g2,
      inboundCommand(g2, podOf(g2).inboundSeq + 1, {
        kind: "remotePower",
        fromGroupId: G1,
        playerId: P1,
        targetInstanceId: "nothing-here" as InstanceId,
        ref: mangog,
        power: "attack",
        amount: 3,
        overkill: false,
        piercing: false,
      }),
      DEPS,
    );
    if (!made.ok) throw new Error(made.error.message);
    const types = made.events.flatMap((e) => (e.type === "podEventEmitted" ? [e.event.type] : []));
    expect(types).toContain("remotePowerResolved");
    expect(types).not.toContain("remotePowerSettled");
    expect(podOf(made.state).remoteHitsSettling).toBeUndefined();
  });

  it("the attacker's group logs the settled outcome, and its state is otherwise unchanged", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    const g1 = sim.state(G1);
    const answered = applyCommand(
      g1,
      inboundCommand(g1, podOf(g1).inboundSeq + 1, {
        kind: "remotePowerSettled",
        fromGroupId: G2,
        ref: mangog,
        playerId: P1,
        cardId: cardId("55041"),
        power: "attack",
        defeated: true,
      }),
      DEPS,
    );
    if (!answered.ok) throw new Error(answered.error.message);
    expect(settledIn(answered.events)).toEqual([
      { type: "remotePowerSettled", fromGroupId: G2, playerId: P1, power: "attack", cardId: "55041", defeated: true },
    ]);
    // Only the inbound bookkeeping moved: the game itself is as it was.
    const strip = (s: GameState) => ({ ...s, pod: { ...podOf(s), inboundSeq: 0 } });
    expect(JSON.stringify(strip(answered.state))).toBe(JSON.stringify(strip(g1)));
  });
});

describe("SharedPodState.defeatedByGroup: the table whose damage defeated Loki, God of Lies (issue #909)", () => {
  it("names the group of the final damage in the coordinator's record and every group's copy", () => {
    const sim = pods((shared) => ({ ...shared, villainDamage: shared.villainHp - 1 }));
    ready(sim, G1, G2, G3);
    expect(sim.coordinator.shared.defeatedByGroup).toBeUndefined();
    // g2's Avatar falls: its Shatter the Illusion deals 5 to Loki, who has 1 left.
    sim.edit(G2, (s) => {
      const id = s.activeVillainId;
      const staged = patchInstance(s, id, {
        damage: maxHitPoints(s, id, DEPS)! - 1,
        statuses: { ...inst(s, id).statuses, tough: 0 },
      });
      return patchInstance(staged, identityOf(staged, P1), { exhausted: false });
    });
    const s = sim.state(G2);
    sim.act(
      G2,
      { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s, P1), targetInstanceId: s.activeVillainId },
      firstLegal,
    );
    expect(sim.coordinator.shared).toMatchObject({ status: "won", defeatedByGroup: G2 });
    expect(podOf(sim.state(G1)).shared?.defeatedByGroup).toBe(G2);
    expect(sim.replayFault()).toBeNull();
  });
});
