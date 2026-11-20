import {
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  groupId,
  inboundCommand,
  legalActions,
  maxHitPoints,
  podOf,
  sharedVillain,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type GroupId,
  type InstanceId,
  type SharedPodState,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../dsl/index.js";
import { P1, firstLegal, identityOf, inst, patchInstance, type Picker } from "../../testing/harness.js";
import { PodSim } from "../../testing/pod-sim.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { epicGroupScenario, wave9Scenario } from "../setup.js";
import { IRON_MAN, SHE_HULK, SPIDER_MAN, codeOf, heroForm, onlyDeck } from "../testing.js";
import { TT_ASPECT_BASIC } from "./aspect-basic.js";
import { GOD_OF_LIES } from "./god-of-lies.js";
import { TRICKSTER_MAGIC } from "./trickster-magic.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * Simulated pods of Trickster Takeover's Epic Multiplayer Mode (docs/epic-multiplayer-plan.md §4 items 2 and 3; issue
 * #882): three headless engines, one per group, joined by the pod coordinator in memory (`testing/pod-sim.ts`).
 *
 * MC55 p. 11 and 55028b: one Loki, God of Lies and one Worlds Collide per game; pods only scope "your pod" abilities
 * (MC55 pp. 4, 13). The game: g1 (Spider-Man, standard) and g2 (Iron Man, standard) in pod A, g3 (She-Hulk, expert)
 * alone in pod B; 3 players, so Loki has 60 hit points and flips at 30 remaining, and Worlds Collide's target is 2 per
 * group = 6 (Q3). Epic Multiplayer Reminder card: groups that began the scenario in that pod (cf. RRG Per Player Icon
 * p. 32): in pod A The Mangog has 20 hit points and Door Between Worlds enters with 14 threat.
 *
 * Every test ends with the option B property: each group's log replays alone, its inbound events included, and the
 * coordinator's log replays to the coordinator.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, GOD_OF_LIES, TRICKSTER_MAGIC, TT_ASPECT_BASIC) };
const [G1, G2, G3] = ["g1", "g2", "g3"].map(groupId) as [GroupId, GroupId, GroupId];
const POD_OF: Readonly<Record<string, readonly GroupId[]>> = { A: [G1, G2], B: [G3] };

/** Standard-set fillers, top first: nothing from God of Lies or Trickster Magic is revealed or dealt. */
const FILLERS = ["01186", "01186", "01188", "01187", "01187", "01189", "01190"] as const;
/** The environment each Avatar's Fading Figment places synergy on (its Shatter the Illusion line). */
const ENVIRONMENT_OF: Readonly<Record<string, string>> = {
  "55029a": "55055",
  "55030a": "55054",
  "55031a": "55052",
  "55032a": "55053",
};
const INTENSE_FOCUS = "55034a";

function pods(stage?: (shared: SharedPodState) => SharedPodState, seed = 1): PodSim {
  const seats = [SPIDER_MAN, IRON_MAN, SHE_HULK];
  return new PodSim(
    [G1, G2, G3].map((g, i) => {
      const podId = g === G3 ? "B" : "A";
      return {
        podId,
        config: epicGroupScenario(
          "god-of-lies",
          { players: [seats[i]!], seed: seed + i, difficulty: g === G3 ? "expert" : "standard" },
          { groupId: g, groupIdsInPod: POD_OF[podId]!, groupsInGame: 3, playersInGame: 3 },
        ),
      };
    }),
    DEPS,
    stage,
  );
}

/**
 * The group's setup prompts answered, its hero in hero form, its encounter deck fillers only, with `next` under the
 * first (the one boost card a one-player villain activation takes), so the first card dealt is `next`'s first.
 */
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
const maxHp = (s: GameState, id: InstanceId): number => maxHitPoints(s, id, DEPS)!;
const synergyOn = (s: GameState, code: string): number => inst(s, onTable(s, code)!).counters["synergy"] ?? 0;
const shatterOn = (s: GameState): number => inst(s, s.activeVillainId).counters["shatter"] ?? 0;
const avatarCode = (s: GameState): string => codeOf(s, s.activeVillainId);
const neutralVillainFlipped = (s: GameState): boolean => inst(s, podOf(s).neutral!.villainInstanceId).flipped;
const focusOf = (s: GameState): InstanceId | undefined => cardsInPlay(s).find((id) => codeOf(s, id) === INTENSE_FOCUS);
const typesOf = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type);
const hero = (sim: PodSim, g: GroupId): InstanceId => identityOf(sim.state(g), P1);

/** Picks group `g` at "choose a group in your pod", and the first legal answer anywhere else. */
const choosingGroup =
  (g: GroupId): Picker =>
  (s) => {
    const choice = s.pendingChoice;
    const option = choice?.prompt.kind === "chooseOption" ? choice.options.find((o) => o.label === g) : undefined;
    return option ? [option.optionId] : firstLegal(s);
  };

/** The Avatar one point from falling, its tough card gone, `extraShatter` more shatter counters; the hero ready. */
function avatarOneFromFalling(sim: PodSim, g: GroupId, extraShatter = 0): void {
  sim.edit(g, (s) => {
    const id = s.activeVillainId;
    const avatar = inst(s, id);
    const staged = patchInstance(s, id, {
      damage: maxHp(s, id) - 1,
      statuses: { ...avatar.statuses, tough: 0 },
      counters: { ...avatar.counters, shatter: (avatar.counters["shatter"] ?? 0) + extraShatter },
    });
    return patchInstance(staged, identityOf(staged, P1), { exhausted: false });
  });
}

function attackAvatar(sim: PodSim, g: GroupId, pick: Picker = firstLegal): void {
  const s = sim.state(g);
  sim.act(
    g,
    { type: "basicAttack", playerId: P1, attackerInstanceId: identityOf(s, P1), targetInstanceId: s.activeVillainId },
    pick,
  );
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
  characterInstanceId: hero(sim, from),
  power,
  toGroupId: to,
  targetInstanceId: target,
});

describe("Loki, God of Lies is damaged from several groups and flips for all of them (MC55 p. 20; Q5, M3)", () => {
  it("two groups' Shatters add up to the flip; a group mid-mulligan finishes it first; Ruling 3 holds per group", () => {
    const sim = pods();
    expect(sharedVillain(sim.state(G1))).toMatchObject({ hp: 60, flipAtRemaining: 30 });
    ready(sim, G1, G2);
    // g3 is still at its mulligan: a choice is open there throughout the first part.
    expect(sim.state(G3).pendingChoice?.prompt.kind).toBe("mulligan");

    // g1's Avatar falls with 20 extra shatter counters: 25 damage to Loki. Its Figment chooses g2 in the pod (M2).
    const g1Environment = ENVIRONMENT_OF[avatarCode(sim.state(G1))]!;
    avatarOneFromFalling(sim, G1, 20);
    sim.clearEvents();
    attackAvatar(sim, G1, choosingGroup(G2));
    expect(sim.coordinator.shared).toMatchObject({ villainDamage: 25, villainFlipped: false });
    for (const g of [G1, G2, G3]) expect(sharedVillain(sim.state(g))).toMatchObject({ damage: 25, flipped: false });
    // The synergy grant: placed in g2's area, equal to g2's one player, and not in g1's.
    expect(synergyOn(sim.state(G2), g1Environment)).toBe(1);
    expect(synergyOn(sim.state(G1), g1Environment)).toBe(0);
    expect(typesOf(sim.group(G2).events, "podInboundApplied")).toContainEqual({
      type: "podInboundApplied",
      kind: "podEffect",
    });

    // g2's Avatar falls with no extra counters: 5 more, 30 left, the flip (55027a, "10 [per player] or fewer").
    avatarOneFromFalling(sim, G2);
    sim.clearEvents();
    attackAvatar(sim, G2, choosingGroup(G1));
    expect(sim.coordinator.shared).toMatchObject({ villainDamage: 30, villainFlipped: true });
    // g1 and g2 resolved Loki's When Revealed at once (standard: Intense Focus attached to their Avatar).
    for (const g of [G1, G2]) {
      const s = sim.state(g);
      expect(neutralVillainFlipped(s)).toBe(true);
      expect(inst(s, s.activeVillainId).attachments.map((id) => codeOf(s, id))).toContain(INTENSE_FOCUS);
    }
    // g3 heard it mid-mulligan: the flip waits for what is resolving there (MC55 p. 20; M3).
    const waiting = sim.state(G3);
    expect(waiting.pendingChoice?.prompt.kind).toBe("mulligan");
    expect(podOf(waiting).pendingInbound).toEqual([{ kind: "sharedVillainFlipped" }]);
    expect(neutralVillainFlipped(waiting)).toBe(false);
    expect(inst(waiting, focusOf(waiting)!).flipped).toBe(false);
    // Its mulligan done, g3 resolves the flip: expert, so its Intense Focus turns to Total Focus.
    ready(sim, G3);
    const g3 = sim.state(G3);
    expect(neutralVillainFlipped(g3)).toBe(true);
    expect(inst(g3, focusOf(g3)!)).toMatchObject({ flipped: true, attachedTo: g3.activeVillainId });

    // Feb 28, 2026 Ruling 3, per group: Intense Focus / Total Focus stay in play and attach to the swapped-in Avatar.
    for (const g of [G1, G3]) {
      const before = sim.state(g);
      const [avatar, focus] = [avatarCode(before), focusOf(before)!];
      avatarOneFromFalling(sim, g);
      attackAvatar(sim, g, choosingGroup(g));
      const after = sim.state(g);
      expect(avatarCode(after), `${g} swapped its Avatar`).not.toBe(avatar);
      expect(inst(after, focus).attachedTo, `${g}'s focus is on the new Avatar`).toBe(after.activeVillainId);
      expect(inst(after, focus).flipped).toBe(g === G3);
    }
    expect(sim.coordinator.shared.villainDamage).toBe(40);
    expect(sim.coordinator.outcome).toBe("playing");
    expect(sim.replayFault()).toBeNull();
  });
});

describe("Worlds Collide reaches its target (MC55 p. 21; M4, owner question 1 option A pending)", () => {
  it("the villain-phase group stops at once, the player-phase group finishes its phase, setup stops; then all lose", () => {
    const sim = pods((shared) => ({ ...shared, schemeThreat: 5 }));
    ready(sim, G1, G2);
    // g1 ends its turn with Mischief and Mayhem one threat from completion: step one completes it (55033b).
    sim.edit(G1, (s) => patchInstance(s, s.mainScheme.instanceId, { threat: 7 }));
    sim.clearEvents();
    sim.act(G1, { type: "endTurn", playerId: P1 }, firstLegal);
    expect(sim.coordinator.shared).toMatchObject({ schemeThreat: 6, status: "schemeCompleted" });

    // g1 was in its villain phase: it finished what was resolving and stopped before step two.
    const g1 = sim.state(G1);
    expect(podOf(g1)).toMatchObject({ halted: true });
    expect(podOf(g1).awaiting).toBeUndefined();
    expect(g1.step).toMatchObject({ phase: "villain", kind: "placeThreat" });
    expect(typesOf(sim.group(G1).events, "enemyActivated")).toEqual([]);
    expect(sim.tryApply(G1, { type: "endTurn", playerId: P1 })).toMatch(/^pod_halted/);
    // g3 was still in setup: it stops at once (option A), its mulligan left as it was.
    expect(podOf(sim.state(G3)).halted).toBe(true);
    expect(sim.state(G3).step.phase).toBe("setup");
    // g2 is in its player phase: it plays it to the end.
    const g2 = sim.state(G2);
    expect(podOf(g2)).toMatchObject({ finalPlayerPhase: true });
    expect(podOf(g2).halted).toBeUndefined();
    expect(sim.coordinator.outcome).toBe("playing");
    sim.act(
      G2,
      { type: "basicAttack", playerId: P1, attackerInstanceId: hero(sim, G2), targetInstanceId: g2.activeVillainId },
      firstLegal,
    );
    expect(sim.coordinator.outcome).toBe("playing");
    sim.act(G2, { type: "endTurn", playerId: P1 }, firstLegal);

    // The last player phase has ended: all players in all groups lose.
    expect(sim.coordinator.outcome).toBe("lost");
    for (const g of [G1, G2, G3]) {
      const s = sim.state(g);
      expect(s.outcome, g).toMatchObject({ result: "loss", sourceInstanceId: podOf(s).neutral!.mainSchemeInstanceId });
      expect(sharedVillain(s)).toMatchObject({ defeated: false });
    }
    expect(sim.replayFault()).toBeNull();
  });
});

describe("Loki, God of Lies is defeated: all players in all groups win (55027b; MC55 p. 21; Q6)", () => {
  it("one Shatter takes the last 35; every group wins at once, the one mid-mulligan too", () => {
    const sim = pods((shared) => ({ ...shared, villainDamage: 25 }));
    ready(sim, G1, G2);
    avatarOneFromFalling(sim, G1, 30);
    attackAvatar(sim, G1, choosingGroup(G1));
    expect(sim.coordinator).toMatchObject({ outcome: "won", shared: { villainDamage: 60, status: "won" } });
    for (const g of [G1, G2, G3]) {
      expect(sim.state(g).outcome, g).toEqual({ result: "win", reason: "villainDefeated" });
      expect(sharedVillain(sim.state(g))).toMatchObject({ defeated: true });
    }
    expect(sim.replayFault()).toBeNull();
  });
});

describe("The Mangog and Door Between Worlds from another group of the pod (55041, 55046; MC55 p. 16; M6)", () => {
  it("g1 attacks g2's Mangog; pod B cannot; the Mangog falls to a remote attack and both groups of pod A get its line", () => {
    const sim = pods();
    ready(sim, G1, G3);
    // The Mangog is revealed in g2's villain phase (under the one boost card its activation takes).
    readyWith(sim, G2, ["55041"]);
    sim.act(G2, { type: "endTurn", playerId: P1 }, firstLegal);
    sim.answer(G2, firstLegal);
    const mangog = onTable(sim.state(G2), "55041")!;
    expect(maxHp(sim.state(G2), mangog)).toBe(20);
    expect(sim.coordinator.groups[1]!.reachable).toEqual([
      { instanceId: mangog, cardId: "55041", by: "attack", remainingHitPoints: 20 },
    ]);

    // g1's hero attacks it "as if it were in their game area": paid and measured in g1, dealt in g2.
    const atk = characterProfile(sim.state(G1), hero(sim, G1), DEPS)!.atk;
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    expect(inst(sim.state(G2), mangog).damage).toBe(atk);
    expect(inst(sim.state(G1), hero(sim, G1)).exhausted).toBe(true);
    expect(sim.coordinator.groups[1]!.reachable[0]).toMatchObject({ remainingHitPoints: 20 - atk });
    // Pod B is not "your pod": g3's engine refuses it before anything is paid.
    expect(sim.tryApply(G3, remote(sim, G3, "attack", G2, mangog))).toMatch(/^no_valid_target/);
    expect(inst(sim.state(G3), hero(sim, G3)).exhausted).toBe(false);
    // Only attack and thwart reach another area: a thwart of The Mangog is refused where it is.
    sim.edit(G1, (s) => patchInstance(s, identityOf(s, P1), { exhausted: false }));
    sim.clearEvents();
    sim.act(G1, remote(sim, G1, "thwart", G2, mangog), firstLegal);
    expect(typesOf(sim.group(G2).events, "podEventEmitted").map((e) => (e as { event: unknown }).event)).toContainEqual(
      expect.objectContaining({ type: "remotePowerResolved", refused: expect.stringContaining("cannot be thwarted") }),
    );

    // The Mangog one point from falling; g1 finishes it. Its When Defeated runs in g2 and, for g1, in g1 (M2).
    sim.edit(G2, (s) => patchInstance(s, mangog, { damage: maxHp(s, mangog) - 1 }));
    sim.edit(G1, (s) => patchInstance(s, identityOf(s, P1), { exhausted: false }));
    const shatter = [G1, G2, G3].map((g) => shatterOn(sim.state(g)));
    const synergy = (g: GroupId) =>
      ["55052", "55053", "55054", "55055"].reduce((n, c) => n + synergyOn(sim.state(g), c), 0);
    const before = [G1, G2, G3].map(synergy);
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    sim.answer(G2, firstLegal);
    sim.answer(G1, firstLegal);
    expect(onTable(sim.state(G2), "55041")).toBeUndefined();
    expect(sim.state(G2).victoryDisplay).toContain(mangog);
    expect([G1, G2, G3].map((g) => shatterOn(sim.state(g)))).toEqual([shatter[0]! + 3, shatter[1]! + 3, shatter[2]]);
    expect([G1, G2, G3].map(synergy)).toEqual([before[0]! + 1, before[1]! + 1, before[2]]);
    expect(sim.coordinator.groups[1]!.reachable).toEqual([]);
    expect(sim.replayFault()).toBeNull();
  });

  it("g2 thwarts Door Between Worlds in g1's area (14 threat in a pod of two groups)", () => {
    const sim = pods();
    ready(sim, G2);
    readyWith(sim, G1, ["55046"]);
    sim.act(G1, { type: "endTurn", playerId: P1 }, firstLegal);
    sim.answer(G1, firstLegal);
    const door = onTable(sim.state(G1), "55046")!;
    expect(inst(sim.state(G1), door).threat).toBe(14);
    const thw = characterProfile(sim.state(G2), hero(sim, G2), DEPS)!.thw;
    sim.act(G2, remote(sim, G2, "thwart", G1, door), firstLegal);
    expect(inst(sim.state(G1), door).threat).toBe(14 - thw);
    expect(sim.coordinator.groups[0]!.reachable).toEqual([
      { instanceId: door, cardId: "55046", by: "thwart", threat: 14 - thw },
    ]);
    expect(sim.replayFault()).toBeNull();
  });

  it("Overkill on another group's Mangog: the excess goes to the attacker's own Avatar (owner question 2, option A)", () => {
    const sim = pods();
    ready(sim, G1);
    readyWith(sim, G2, ["55041"]);
    sim.act(G2, { type: "endTurn", playerId: P1 }, firstLegal);
    sim.answer(G2, firstLegal);
    const mangog = onTable(sim.state(G2), "55041")!;
    const avatarDamage = inst(sim.state(G1), sim.state(G1).activeVillainId).damage;
    // As g1's coordinator would deliver an attack of 23 with Overkill (none of the three heroes has it): g2's 20
    // hit points take it and 3 is owed back to g1.
    const g2 = sim.state(G2);
    expect(
      sim.tryApply(
        G2,
        inboundCommand(g2, podOf(g2).inboundSeq + 1, {
          kind: "remotePower",
          fromGroupId: G1,
          playerId: P1,
          targetInstanceId: mangog,
          power: "attack",
          amount: 23,
          overkill: true,
        }),
      ),
    ).toBeNull();
    sim.pump();
    sim.answer(G2, firstLegal);
    sim.answer(G1, firstLegal);
    expect(onTable(sim.state(G2), "55041")).toBeUndefined();
    const s1 = sim.state(G1);
    expect(inst(s1, s1.activeVillainId).damage).toBe(avatarDamage + 3);
  });
});

describe("Command externalEvent and remotePower: who may send them (docs/phase7-wave9.md §3.68)", () => {
  it("a one-group game refuses both; a remote group refuses an inbound out of order; no seat is offered either", () => {
    const created = createGame(wave9Scenario("god-of-lies", { players: [SPIDER_MAN], seed: 1 }), DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const single = created.state;
    const refused = applyCommand(single, inboundCommand(single, 1, { kind: "gameWon" }), DEPS);
    expect(!refused.ok && refused.error.code).toBe("no_remote_coordinator");

    const sim = pods();
    ready(sim, G1);
    const s = sim.state(G1);
    const ahead = applyCommand(s, inboundCommand(s, podOf(s).inboundSeq + 2, { kind: "gameWon" }), DEPS);
    expect(!ahead.ok && ahead.error.code).toBe("external_event_out_of_order");
    const again = applyCommand(s, inboundCommand(s, podOf(s).inboundSeq, { kind: "gameWon" }), DEPS);
    expect(!again.ok && again.error.code).toBe("external_event_out_of_order");
    const offered = legalActions(s, P1, DEPS);
    const commands = "legal" in offered ? offered.legal.map((a) => (a as { command?: Command }).command?.type) : [];
    expect(commands).not.toContain("externalEvent");
    expect(commands).not.toContain("remotePower");
    expect(sim.replayFault()).toBeNull();
  });
});

describe("a long run: three groups played by the greedy driver to the end", () => {
  it("ends the same for every group, and every log replays alone", () => {
    const sim = pods(undefined, 7);
    sim.run({ maxCommands: 8000 });
    expect(sim.coordinator.outcome).not.toBe("playing");
    const result = sim.coordinator.outcome === "won" ? "win" : "loss";
    for (const g of [G1, G2, G3]) expect(sim.state(g).outcome?.result, g).toBe(result);
    expect(sim.replayFault()).toBeNull();
  });
});
