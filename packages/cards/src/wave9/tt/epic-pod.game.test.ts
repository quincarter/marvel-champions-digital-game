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
import {
  FRIENDLY_CHARACTER,
  constant,
  dealDamage,
  discard,
  eventTarget,
  forcedInterrupt,
  gainsKeywordX,
  interrupt,
  mergeRegistries,
  on,
  reachableFromPod,
  self,
} from "../../dsl/index.js";
import { P1, firstLegal, identityOf, inst, patchInstance, type Picker } from "../../testing/harness.js";
import { PodSim } from "../../testing/pod-sim.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { epicGroupScenario, wave9Scenario } from "../setup.js";
import { BLACK_CAT, IRON_MAN, SHE_HULK, SPIDER_MAN, codeOf, heroForm, onlyDeck } from "../testing.js";
import { playFromHand } from "../../testing/staging.js";
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

function pods(stage?: (shared: SharedPodState) => SharedPodState, seed = 1, deps: EngineDeps = DEPS): PodSim {
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
    deps,
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

// ---------------------------------------------------------------------------------------------------------------
// The Mangog and Door Between Worlds from another group of the pod. 55041/55046 "as if it were in their game area": a
// real attack/thwart by the remote character (MC55 insert p.12 exception; RRG Attack (Player Ability Type) p.10, Thwart
// p.44), made in the attacker's group against a stand-in and dealt in the owning group.
// ---------------------------------------------------------------------------------------------------------------

/** The Mangog revealed in g2's villain phase; g1 and g3 ready. Returns its id in g2. */
function mangogInG2(sim: PodSim): InstanceId {
  ready(sim, G1, G3);
  readyWith(sim, G2, ["55041"]);
  sim.act(G2, { type: "endTurn", playerId: P1 }, firstLegal);
  sim.answer(G2, firstLegal);
  return onTable(sim.state(G2), "55041")!;
}

/** Door Between Worlds revealed in g1's villain phase; g2 ready. Returns its id in g1. */
function doorInG1(sim: PodSim): InstanceId {
  ready(sim, G2);
  readyWith(sim, G1, ["55046"]);
  sim.act(G1, { type: "endTurn", playerId: P1 }, firstLegal);
  sim.answer(G1, firstLegal);
  return onTable(sim.state(G1), "55046")!;
}

const standIns = (s: GameState): InstanceId[] => s.villainArea.filter((id) => s.instances[id]?.remoteOf);
const sent = (sim: PodSim, g: GroupId, type: string) =>
  typesOf(sim.group(g).events, "podEventEmitted").filter((e) => (e as { event: { type: string } }).event.type === type);
/** Takes the optional ability on the card `code` whenever it is offered; the first legal answer otherwise. */
const taking =
  (code: string): Picker =>
  (s) => {
    const option = s.pendingChoice?.options.find(
      (o) => (o.ref.kind === "card" || o.ref.kind === "ability") && codeOf(s, o.ref.instanceId) === code,
    );
    return option ? [option.optionId] : firstLegal(s);
  };

describe("a remote attack on The Mangog (55041; MC55 p. 16; M6)", () => {
  it("is a real basic attack in g1, dealt in g2; pod B and a thwart are refused before anything is paid", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    expect(maxHp(sim.state(G2), mangog)).toBe(20);
    expect(sim.coordinator.groups[1]!.reachable).toEqual([
      { instanceId: mangog, cardId: "55041", by: "attack", remainingHitPoints: 20 },
    ]);
    // g1 holds a copy of g2's report (the coordinator relays it to the pod); g3 in pod B does not.
    expect(podOf(sim.state(G1)).reachable?.[G2]).toHaveLength(1);
    expect(podOf(sim.state(G3)).reachable).toBeUndefined();

    const atk = characterProfile(sim.state(G1), hero(sim, G1), DEPS)!.atk;
    sim.clearEvents();
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    expect(inst(sim.state(G2), mangog).damage).toBe(atk);
    expect(inst(sim.state(G1), hero(sim, G1)).exhausted).toBe(true);
    // The attack was made in g1 (its attack event, against the stand-in), and the stand-in is gone again.
    expect(typesOf(sim.group(G1).events, "remoteStandIn").map((e) => (e as { placed: boolean }).placed)).toEqual([
      true,
      false,
    ]);
    expect(standIns(sim.state(G1))).toEqual([]);
    expect(sent(sim, G1, "remotePowerUsed")).toHaveLength(1);
    expect(sim.coordinator.groups[1]!.reachable[0]).toMatchObject({ remainingHitPoints: 20 - atk });

    // Pod B is not "your pod", and The Mangog is attacked, not thwarted: refused before anything is paid.
    expect(sim.tryApply(G3, remote(sim, G3, "attack", G2, mangog))).toMatch(/^no_valid_target/);
    expect(inst(sim.state(G3), hero(sim, G3)).exhausted).toBe(false);
    sim.edit(G1, (s) => patchInstance(s, identityOf(s, P1), { exhausted: false }));
    expect(sim.tryApply(G1, remote(sim, G1, "thwart", G2, mangog))).toMatch(/^no_valid_target/);
    expect(inst(sim.state(G1), hero(sim, G1)).exhausted).toBe(false);
    expect(sim.replayFault()).toBeNull();
  });

  it("g1's Domineering Force applies to its remote attack (+4), and the Mangog's defeat runs in both groups of pod A", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    // One synergy counter on g1's Domineering Force (55052): "When a friendly character attacks ... +4 damage".
    sim.edit(G1, (s) => patchInstance(s, onTable(s, "55052")!, { counters: { synergy: 1 } }));
    const atk = characterProfile(sim.state(G1), hero(sim, G1), DEPS)!.atk;
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), taking("55052"));
    expect(synergyOn(sim.state(G1), "55052")).toBe(0);
    expect(inst(sim.state(G2), mangog).damage).toBe(atk + 4);

    // One point from falling; g1 finishes it. Its When Defeated runs in g2 and, for g1, in g1 (M2); not in pod B.
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
    expect(podOf(sim.state(G1)).reachable?.[G2]).toEqual([]);
    expect(sim.replayFault()).toBeNull();
  });

  it("a stunned attacker only discards its stun and stays exhausted; nothing reaches g2 (RRG 1.8 p. 41)", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    sim.edit(G1, (s) =>
      patchInstance(s, identityOf(s, P1), { statuses: { ...inst(s, identityOf(s, P1)).statuses, stunned: 1 } }),
    );
    sim.clearEvents();
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    const s1 = sim.state(G1);
    expect(inst(s1, hero(sim, G1))).toMatchObject({ exhausted: true, statuses: { stunned: 0 } });
    expect(inst(sim.state(G2), mangog).damage).toBe(0);
    expect(sent(sim, G1, "remotePowerUsed")).toEqual([]);
    expect(standIns(s1)).toEqual([]);
    expect(podOf(s1).inFlight).toBeUndefined();
    expect(sim.replayFault()).toBeNull();
  });
});

describe("an ally's remote power, and a target gone before the owning group accepts it", () => {
  it("Black Cat thwarts g2's Door with her consequential damage; if the Door left play first, everything is refunded", () => {
    const sim = pods();
    ready(sim, G1, G3);
    readyWith(sim, G2, ["55046"]);
    sim.act(G2, { type: "endTurn", playerId: P1 }, firstLegal);
    sim.answer(G2, firstLegal);
    const door = onTable(sim.state(G2), "55046")!;
    let ally: InstanceId | undefined;
    sim.edit(G1, (s) => {
      const played = playFromHand(DEPS, s, BLACK_CAT, 2);
      ally = played.id;
      return played.state;
    });
    const thw = characterProfile(sim.state(G1), ally!, DEPS)!.thw;
    const allyRemote = (): Command => ({ ...remote(sim, G1, "thwart", G2, door), characterInstanceId: ally! });
    const threat = inst(sim.state(G2), door).threat;
    sim.act(G1, allyRemote(), firstLegal);
    expect(inst(sim.state(G2), door).threat).toBe(threat - thw);
    // Black Cat: thwart consequential damage 1 (RRG 1.8 "Consequential Damage", p. 13), taken in her own area.
    expect(inst(sim.state(G1), ally!)).toMatchObject({ exhausted: true, damage: 1 });

    // Surgery in g2: the Door left play, and g2 has not told anyone yet. g1 thwarts from its stale copy.
    sim.edit(G1, (s) => patchInstance(s, ally!, { exhausted: false, damage: 0 }));
    sim.edit(G2, (s) => ({
      ...s,
      villainArea: s.villainArea.filter((id) => id !== door),
      victoryDisplay: [...s.victoryDisplay, door],
    }));
    sim.clearEvents();
    sim.act(G1, allyRemote(), firstLegal);
    // Not initiated (RRG 1.8 "Initiating Abilities", p. 24 step 2): the exhaust and the consequential damage are refunded.
    expect(inst(sim.state(G1), ally!)).toMatchObject({ exhausted: false, damage: 0 });
    expect(podOf(sim.state(G1)).inFlight).toBeUndefined();
    expect(
      sent(sim, G2, "remotePowerResolved").map((e) => (e as { event: { refused?: string } }).event.refused),
    ).toEqual([expect.stringContaining("not in play")]);
    expect(sim.replayFault()).toBeNull();
  });
});

describe("a remote thwart of Door Between Worlds (55046; MC55 p. 16; M6)", () => {
  it("g2 thwarts it in g1's area (14 threat in a pod of two groups); a confused thwarter only discards its status", () => {
    const sim = pods();
    const door = doorInG1(sim);
    expect(inst(sim.state(G1), door).threat).toBe(14);
    const thw = characterProfile(sim.state(G2), hero(sim, G2), DEPS)!.thw;
    sim.act(G2, remote(sim, G2, "thwart", G1, door), firstLegal);
    expect(inst(sim.state(G1), door).threat).toBe(14 - thw);
    expect(sim.coordinator.groups[0]!.reachable).toEqual([
      { instanceId: door, cardId: "55046", by: "thwart", threat: 14 - thw },
    ]);
    // Confused: the status is discarded, the exhaust stands, the Door keeps its threat.
    sim.edit(G2, (s) =>
      patchInstance(s, identityOf(s, P1), {
        exhausted: false,
        statuses: { ...inst(s, identityOf(s, P1)).statuses, confused: 1 },
      }),
    );
    sim.act(G2, remote(sim, G2, "thwart", G1, door), firstLegal);
    expect(inst(sim.state(G2), hero(sim, G2))).toMatchObject({ exhausted: true, statuses: { confused: 0 } });
    expect(inst(sim.state(G1), door).threat).toBe(14 - thw);
    expect(sim.replayFault()).toBeNull();
  });
});

describe("Overkill on another group's Mangog (owner question 2, option A)", () => {
  it("the excess, measured after the damage resolves in g2, goes to the attacker's own Avatar in g1", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    const avatarDamage = inst(sim.state(G1), sim.state(G1).activeVillainId).damage;
    // As the coordinator delivers an attack of 23 with Overkill from g1 (none of the three heroes has it): g2's 20 hit
    // points take it, and 3 is owed back to g1 at the defeat.
    const g2 = sim.state(G2);
    expect(
      sim.tryApply(
        G2,
        inboundCommand(g2, podOf(g2).inboundSeq + 1, {
          kind: "remotePower",
          fromGroupId: G1,
          playerId: P1,
          targetInstanceId: mangog,
          ref: mangog,
          power: "attack",
          amount: 23,
          overkill: true,
          piercing: false,
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

  it("a tough Mangog prevents a remote attack without piercing, and its excess is none", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    sim.edit(G2, (s) => patchInstance(s, mangog, { statuses: { ...inst(s, mangog).statuses, tough: 1 } }));
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    expect(inst(sim.state(G2), mangog)).toMatchObject({ damage: 0, statuses: { tough: 0 } });
    expect(sim.replayFault()).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Fixtures: The Mangog's two ability refs remapped in a test registry (the registry decides timing), for cases no
// card in the pool shows: a reachable card with retaliate, one that leaves play as it would take damage, and an
// interrupt in the attacker's area that deals damage to the attack's target.
// ---------------------------------------------------------------------------------------------------------------

const withAbilities = (overrides: EngineDeps["abilities"]): EngineDeps => ({
  abilities: { ...DEPS.abilities, ...overrides },
});
/** The Mangog with "Retaliate 2." */
const RETALIATE_2 = withAbilities({
  "55041.the-mangog-constant": constant(reachableFromPod("attack"), gainsKeywordX("retaliate", 2, { self: true })),
});
/** The Mangog with "Forced Interrupt: When this would take damage, discard it." */
const LEAVES_AT_DAMAGE = withAbilities({
  "55041.when-defeated": forcedInterrupt(on.damage("self"), discard(self)),
});
/** Domineering Force as "Interrupt: When a friendly character attacks, deal 1 damage to the attacked enemy." */
const PINGS_THE_TARGET = withAbilities({
  "55052.domineering-force-interrupt": interrupt(on.attacks(FRIENDLY_CHARACTER), dealDamage(1, eventTarget)),
});

describe("remote powers: what comes back, and what does not cross", () => {
  it("the attacked card's retaliate comes back to the attacker (RRG 1.8 'Retaliate X', p. 37)", () => {
    const sim = pods(undefined, 1, RETALIATE_2);
    const mangog = mangogInG2(sim);
    const before = inst(sim.state(G1), hero(sim, G1)).damage;
    const atk = characterProfile(sim.state(G1), hero(sim, G1), RETALIATE_2)!.atk;
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    expect(inst(sim.state(G2), mangog).damage).toBe(atk);
    expect(inst(sim.state(G1), hero(sim, G1)).damage).toBe(before + 2);
    expect(sim.replayFault()).toBeNull();
  });

  it("a card lost after acceptance: the exhaust stands, no retaliate, and the answer says lost", () => {
    const sim = pods(undefined, 1, { abilities: { ...RETALIATE_2.abilities, ...LEAVES_AT_DAMAGE.abilities } });
    const mangog = mangogInG2(sim);
    const before = inst(sim.state(G1), hero(sim, G1)).damage;
    sim.clearEvents();
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), firstLegal);
    expect(onTable(sim.state(G2), "55041")).toBeUndefined();
    expect(sent(sim, G2, "remotePowerResolved").map((e) => (e as { event: unknown }).event)).toEqual([
      expect.objectContaining({ lost: true, retaliate: 0 }),
    ]);
    expect(inst(sim.state(G1), hero(sim, G1))).toMatchObject({ exhausted: true, damage: before });
    expect(sim.replayFault()).toBeNull();
  });

  it("lost after acceptance: an ally's consequential damage, held back until then, is never dealt", () => {
    const sim = pods();
    ready(sim, G1, G3);
    readyWith(sim, G2, ["55046"]);
    sim.act(G2, { type: "endTurn", playerId: P1 }, firstLegal);
    sim.answer(G2, firstLegal);
    const door = onTable(sim.state(G2), "55046")!;
    let ally: InstanceId | undefined;
    sim.edit(G1, (s) => {
      const played = playFromHand(DEPS, s, BLACK_CAT, 2);
      ally = played.id;
      return played.state;
    });
    // g1 alone, as its host would see it, with the answer written by hand: the power, then "lost".
    const made = applyCommand(
      sim.state(G1),
      { ...remote(sim, G1, "thwart", G2, door), characterInstanceId: ally! },
      DEPS,
    );
    if (!made.ok) throw new Error(made.error.message);
    const flight = podOf(made.state).inFlight?.[0];
    expect(flight).toMatchObject({ sent: true, consequential: 1 });
    expect(inst(made.state, ally!)).toMatchObject({ exhausted: true, damage: 0 });
    const answered = applyCommand(
      made.state,
      inboundCommand(made.state, podOf(made.state).inboundSeq + 1, {
        kind: "remotePowerResolved",
        fromGroupId: G2,
        ref: flight!.ref,
        targetInstanceId: door,
        power: "thwart",
        retaliate: 0,
        lost: true,
      }),
      DEPS,
    );
    if (!answered.ok) throw new Error(answered.error.message);
    expect(inst(answered.state, ally!)).toMatchObject({ exhausted: true, damage: 0 });
    expect(podOf(answered.state).inFlight).toBeUndefined();
  });

  it("a piercing remote attack discards the Mangog's tough card and deals its damage (RRG 1.8 'Piercing', p. 32)", () => {
    const sim = pods();
    const mangog = mangogInG2(sim);
    sim.edit(G2, (s) => patchInstance(s, mangog, { statuses: { ...inst(s, mangog).statuses, tough: 1 } }));
    const g2 = sim.state(G2);
    expect(
      sim.tryApply(
        G2,
        inboundCommand(g2, podOf(g2).inboundSeq + 1, {
          kind: "remotePower",
          fromGroupId: G1,
          playerId: P1,
          targetInstanceId: mangog,
          ref: mangog,
          power: "attack",
          amount: 3,
          overkill: false,
          piercing: true,
        }),
      ),
    ).toBeNull();
    sim.pump();
    expect(inst(sim.state(G2), mangog)).toMatchObject({ damage: 3, statuses: { tough: 0 } });
  });

  it("damage aimed at the stand-in that is not the power's own is dealt nowhere, and only the attack crosses", () => {
    const sim = pods(undefined, 1, PINGS_THE_TARGET);
    const mangog = mangogInG2(sim);
    const atk = characterProfile(sim.state(G1), hero(sim, G1), PINGS_THE_TARGET)!.atk;
    sim.clearEvents();
    sim.act(G1, remote(sim, G1, "attack", G2, mangog), taking("55052"));
    expect(inst(sim.state(G2), mangog).damage).toBe(atk);
    expect(sent(sim, G1, "remotePowerUsed")).toHaveLength(1);
    expect(typesOf(sim.group(G1).events, "remoteStandIn")).toContainEqual(
      expect.objectContaining({ ignored: "attack" }),
    );
    expect(sim.replayFault()).toBeNull();
  });
});

describe("Command externalEvent, remotePower and podRelease: who may send them (docs/phase7-wave9.md §3.68)", () => {
  it("a one-group game refuses them; a remote group tells a re-send from a gap; no seat is offered them", () => {
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
    expect(!again.ok && again.error.code).toBe("external_event_already_applied");
    const offered = legalActions(s, P1, DEPS);
    const commands = "legal" in offered ? offered.legal.map((a) => (a as { command?: Command }).command?.type) : [];
    for (const type of ["externalEvent", "remotePower", "podRelease"]) expect(commands).not.toContain(type);
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
