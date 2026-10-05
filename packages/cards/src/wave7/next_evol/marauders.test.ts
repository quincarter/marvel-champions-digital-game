import {
  activeVillain,
  characterProfile,
  createGame,
  type AbilityRegistry,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { forcedInterrupt, on, query, chooseTarget, chosen, retargetAttack } from "../../dsl/index.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { WAVE7_ABILITIES, WAVE7_DEPS, wave7Scenario } from "../index.js";
import { MARAUDERS } from "./marauders.js";

vi.setConfig({ testTimeout: 60_000 });

/**
 * Morlock (40079) is another module's card. Its Forced Interrupt is restated here as the test double that makes a
 * Marauder attack an ally ("When an enemy attacks you, it attacks a Morlock you control instead"), the only way a
 * villain attacks an ally in this scenario. The Marauder's own interrupt is the real one.
 */
const MORLOCK_REDIRECT: AbilityRegistry = {
  "40079.morlock-forced-interrupt": forcedInterrupt(
    on.enemyAttacks({ categories: ["enemy"] }, { againstYou: true }),
    chooseTarget("morlock", query("ally", { controller: "you", name: "Morlock" })),
    retargetAttack(chosen("morlock")),
  ),
};
const DEPS = { abilities: { ...WAVE7_ABILITIES, ...MORLOCK_REDIRECT } };

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
const PRINTED_ATK = {
  "40070a": 1,
  "40070b": 2,
  "40076a": 0,
  "40076b": 1,
  "40071a": 2,
  "40071b": 3,
  "40072a": 1,
  "40072b": 2,
  "40073a": 1,
  "40073b": 2,
  "40074a": 2,
  "40074b": 3,
  "40075a": 1,
  "40075b": 2,
} as const;

/** Morlock Siege with this Marauder (`code` is the printed number, 40072, ...) in play, in its standard or expert face, past setup. */
function siege(code: string, opts: { expert?: boolean; players?: typeof TWO | readonly [typeof SPIDER_MAN] } = {}) {
  for (let seed = 1; seed < 400; seed++) {
    const config = wave7Scenario("morlock-siege", {
      players: opts.players ?? [SPIDER_MAN],
      seed,
      difficulty: opts.expert ? "expert" : "standard",
      modularSetIds: [],
    });
    const created = createGame(config, WAVE7_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const id = created.state.instances[activeVillain(created.state).instanceId]!.cardId as string;
    if (!id.startsWith(code)) continue;
    expect(id).toBe(`${code}${opts.expert ? "b" : "a"}`);
    return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  }
  throw new Error(`no seed starts Morlock Siege with ${code}`);
}

const nameOf = (state: GameState, id: InstanceId) => state.cardPool[state.instances[id]!.cardId]!.name;
const zoneIds = (state: GameState, player: PlayerId) => {
  const p = playerOf(state, player);
  return [...p.hand, ...p.deck, ...p.discard, ...p.playArea];
};
const findByName = (state: GameState, player: PlayerId, name: string, taken: readonly InstanceId[] = []) => {
  const id = zoneIds(state, player).find((i) => nameOf(state, i) === name && !taken.includes(i));
  if (!id) throw new Error(`${player} has no (other) ${name}`);
  return id;
};
const withPlayer = (state: GameState, player: PlayerId, change: (p: GameState["players"][number]) => object) => ({
  ...state,
  players: state.players.map((p) => (p.playerId === player ? { ...p, ...change(p) } : p)),
});
/** `player`'s hand is exactly these cards (by name; the old hand goes to the top of the deck). A hero form's hand size is 5. */
function withHand(state: GameState, player: PlayerId, names: readonly string[]): GameState {
  const chosenIds: InstanceId[] = [];
  for (const name of names) chosenIds.push(findByName(state, player, name, chosenIds));
  return withPlayer(state, player, (p) => {
    const rest = [...p.hand, ...p.deck].filter((i) => !chosenIds.includes(i));
    return { hand: chosenIds, deck: rest };
  });
}
/** These cards are in `player`'s play area, ready, as though played (state surgery). */
function withInPlay(state: GameState, player: PlayerId, names: readonly string[]): GameState {
  const ids: InstanceId[] = [];
  for (const name of names) ids.push(findByName(state, player, name, ids));
  const moved = withPlayer(state, player, (p) => ({
    hand: p.hand.filter((i) => !ids.includes(i)),
    deck: p.deck.filter((i) => !ids.includes(i)),
    playArea: [...p.playArea, ...ids],
  }));
  return {
    ...moved,
    instances: {
      ...moved.instances,
      ...Object.fromEntries(
        ids.map((i) => [i, { ...moved.instances[i]!, faceup: true, exhausted: false, controllerId: player }]),
      ),
    },
  };
}
/** A set-aside Morlock ally (40079) under `player`'s control (state surgery). */
function withMorlock(state: GameState, player: PlayerId): { state: GameState; id: InstanceId } {
  const id = state.encounterSetAside.find((i) => state.instances[i]!.cardId === "40079");
  if (!id) throw new Error("no set-aside Morlock");
  const moved = withPlayer(state, player, (p) => ({ playArea: [...p.playArea, id] }));
  return {
    id,
    state: {
      ...moved,
      encounterSetAside: moved.encounterSetAside.filter((i) => i !== id),
      instances: {
        ...moved.instances,
        [id]: { ...moved.instances[id]!, faceup: true, exhausted: false, controllerId: player },
      },
    },
  };
}

const NO_MENTAL = ["Backflip", "Backflip", "For Justice!", "For Justice!", "Haymaker"] as const;
const MENTAL_2 = ["Enhanced Spider-Sense", "Enhanced Spider-Sense", "Backflip", "For Justice!", "Haymaker"] as const;
const CM_MENTAL_2 = ["Make the Call", "Make the Call", "Get Ready", "Get Ready", "Crisis Interdiction"] as const;
const MENTAL_1 = ["Enhanced Spider-Sense", "Backflip", "Backflip", "For Justice!", "Haymaker"] as const;

interface Plan {
  /** The label (start) of the option to take at each `chooseOption` prompt; the first one offered otherwise. */
  readonly choose?: string;
  /** Hand cards (by name) to spend at a `spendResources` prompt. */
  readonly pay?: readonly string[];
  /** The ally (by name) that defends; nobody defends otherwise. */
  readonly defender?: string;
  /** Which card (by name, in order) to pick at a tie. */
  readonly pick?: string;
}
interface Outcome {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly villain: InstanceId;
  /** Each `chooseOption` prompt: who was asked and which options were offered. */
  readonly offered: readonly { readonly player: PlayerId; readonly labels: readonly string[] }[];
  /** The options that resolved, in order (also the ones forced because the other could not be carried out). */
  readonly resolved: readonly string[];
}
/**
 * Hero form, end of turn for every player: the villain phase runs, the villain attacks each player in turn. `plan` is
 * one plan for everybody or one per player in player order.
 */
function villainPhase(state: GameState, plan: Plan | readonly Plan[], boosts = state.players.length): Outcome {
  const plans: readonly Plan[] = Array.isArray(plan) ? (plan as readonly Plan[]) : [plan as Plan];
  const offered: { player: PlayerId; labels: string[] }[] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    const seat = s.players.findIndex((p) => p.playerId === choice.playerId);
    const current: Plan = plans[Math.min(seat, plans.length - 1)] ?? {};
    switch (choice.prompt.kind) {
      case "chooseOption": {
        if (choice.options.some((o) => /ATK for this attack|boost card;?/.test(o.label)))
          offered.push({ player: choice.playerId, labels: choice.options.map((o) => o.label) });
        const hit = choice.options.find((o) => (current.choose ? o.label.startsWith(current.choose) : true));
        return [(hit ?? choice.options[0]!).optionId];
      }
      case "spendResources": {
        const ids: string[] = [];
        for (const name of current.pay ?? []) {
          const hit = choice.options.find((o) => o.label === name && !ids.includes(o.optionId));
          if (hit) ids.push(hit.optionId);
        }
        return ids.length > 0 ? ids : firstLegal(s);
      }
      case "declareDefender": {
        const hit = current.defender ? choice.options.find((o) => o.label === current.defender) : undefined;
        return [hit ? hit.optionId : "decline"];
      }
      default: {
        const hit = current.pick ? choice.options.find((o) => o.label === current.pick) : undefined;
        return hit && choice.prompt.kind !== "chooseTriggers" ? [hit.optionId] : firstLegal(s);
      }
    }
  };
  const commands = state.players.flatMap((p) => [toHero(p.playerId), endTurn(p.playerId)]);
  // The encounter deck is stacked so nothing but the attacks under test happens: Shadow of the Past, Caught Off Guard
  // and Gang-Up (2, 1 and 1 boost icons, no boost ability) are the boost cards, then Advance (0 icons: the villain
  // schemes, after every attack) is each player's reveal.
  const stacked = stackEncounterDeck(
    state,
    ...["01190", "01188", "01189"].slice(0, boosts),
    ...state.players.map(() => "01186"),
    // The second copy (the deck has two) for a hazard icon in play (By Any Means) in a one-player game, so the extra
    // card dealt is not a random one.
    ...(state.players.length === 1 ? ["01186"] : []),
  );
  const { state: after, events } = driveEventsPicking(DEPS, stacked, pick, ...commands);
  return {
    state: after,
    events,
    villain: activeVillain(state).instanceId,
    offered,
    resolved: events
      .filter((e): e is Extract<GameEvent, { type: "optionChosen" }> => e.type === "optionChosen")
      .map((e) => e.label),
  };
}
const attacks = (o: Outcome) =>
  o.events.filter(
    (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
      e.type === "attackResolved" && e.enemyInstanceId === o.villain,
  );
/** The villain's boost cards flipped for its `n`th attack (those since the previous attack resolved). */
const flips = (o: Outcome, n = 0) => {
  const resolvedAt = o.events.flatMap((e, i) =>
    e.type === "attackResolved" && e.enemyInstanceId === o.villain ? [i] : [],
  );
  const from = n === 0 ? 0 : resolvedAt[n - 1]! + 1;
  return o.events
    .slice(from, resolvedAt[n]! + 1)
    .filter(
      (e): e is Extract<GameEvent, { type: "boostCardFlipped" }> =>
        e.type === "boostCardFlipped" && e.enemyInstanceId === o.villain,
    );
};
/** Threat the villain's own ability placed: before its last attack resolved (its scheme, from the reveal, comes after). */
const threatByVillain = (o: Outcome) => {
  // Up to the last of the attacks under test, one per player. Later in the phase the scripted scenario goes on (an
  // encounter card can make the villain scheme, complete Knock, Knock and bring further attacks), and that threat is
  // not this villain's choice.
  const resolved = o.events.flatMap((e, i) =>
    e.type === "attackResolved" && e.enemyInstanceId === o.villain ? [i] : [],
  );
  const last = resolved[Math.min(o.state.players.length, resolved.length) - 1] ?? -1;
  return o.events
    .slice(0, last + 1)
    .filter(
      (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
        e.type === "threatPlaced" && e.sourceInstanceId === o.villain,
    );
};
const damage = (state: GameState, id: InstanceId) => inst(state, id).damage;

/** The one attack of a one-player game, checked against its printed ATK, `bonus` and its boost cards. */
function expectAttack(o: Outcome, code: keyof typeof PRINTED_ATK, bonus: number, boostCards = 1) {
  const [attack, ...more] = attacks(o);
  expect(more).toEqual([]);
  expect(attack).toBeDefined();
  expect(attack!.baseAtk).toBe(PRINTED_ATK[code] + bonus);
  expect(flips(o)).toHaveLength(boostCards);
  expect(attack!.boostIcons).toBe(flips(o).reduce((sum, f) => sum + f.boostIcons, 0));
  return attack!;
}

describe("registry", () => {
  it("registers the forced interrupt of all seven Marauders, both faces", () => {
    expect(Object.keys(MARAUDERS).sort()).toEqual(
      [
        "40070a.arclight-forced-interrupt",
        "40070b.arclight-forced-interrupt",
        "40076a.vertigo-forced-interrupt",
        "40076b.vertigo-forced-interrupt",
        "40071a.blockbuster-forced-interrupt",
        "40071b.blockbuster-forced-interrupt",
        "40072a.chimera-forced-interrupt",
        "40072b.chimera-forced-interrupt",
        "40073a.greycrow-forced-interrupt",
        "40073b.greycrow-forced-interrupt",
        "40074a.harpoon-forced-interrupt",
        "40074b.harpoon-forced-interrupt",
        "40075a.riptide-forced-interrupt",
        "40075b.riptide-forced-interrupt",
      ].sort(),
    );
  });
});

describe("Blockbuster (40071a/b)", () => {
  const start = (expert = false) => siege("40071", { expert });

  it("40071a.blockbuster-forced-interrupt: both options are offered; a tough status card goes on Blockbuster and his ATK stays 2", () => {
    const base = start();
    expect(inst(base, activeVillain(base).instanceId).statuses.tough).toBe(0);
    const o = villainPhase(base, { choose: "Give Blockbuster a tough" });
    expect(o.offered.map((p) => p.labels)).toEqual([
      ["Give Blockbuster a tough status card", "Blockbuster gets +2 ATK for this attack"],
    ]);
    expect(o.resolved).toEqual(["Give Blockbuster a tough status card"]);
    expect(inst(o.state, o.villain).statuses.tough).toBe(1);
    const attack = expectAttack(o, "40071a", 0);
    expect(damage(o.state, identityOf(o.state))).toBe(attack.baseAtk + attack.boostIcons);
  });

  it("40071a: the other option gives +2 ATK for this attack and no status card", () => {
    const o = villainPhase(start(), { choose: "Blockbuster gets +2" });
    expect(o.resolved).toEqual(["Blockbuster gets +2 ATK for this attack"]);
    expect(inst(o.state, o.villain).statuses.tough).toBe(0);
    const attack = expectAttack(o, "40071a", 2);
    expect(attack.baseAtk).toBe(4);
    expect(damage(o.state, identityOf(o.state))).toBe(4 + attack.boostIcons);
  });

  it("40071a: already tough, the tough option is not offered (nothing is placed on a holder): +2 ATK is forced and he still has one tough card", () => {
    const base = start();
    const toughened = patchInstance(base, activeVillain(base).instanceId, {
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });
    const o = villainPhase(toughened, { choose: "Give Blockbuster" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Blockbuster gets +2 ATK for this attack"]);
    expect(inst(o.state, o.villain).statuses.tough).toBe(1);
    expectAttack(o, "40071a", 2);
  });

  it("40071b: a tough status card, with no extra ATK (3) and no overkill", () => {
    const o = villainPhase(start(true), { choose: "Give Blockbuster a tough" });
    expect(o.offered[0]!.labels).toEqual([
      "Give Blockbuster a tough status card",
      "Blockbuster gets +2 ATK for this attack and this attack gains overkill",
    ]);
    expect(inst(o.state, o.villain).statuses.tough).toBe(1);
    expectAttack(o, "40071b", 0);
  });

  it("40071b: the other option is +2 ATK (5) and overkill: a defending ally is defeated and the excess damage reaches the hero", () => {
    const base = withInPlay(withHand(start(true), P1, NO_MENTAL), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const hp = characterProfile(base, cat, WAVE7_DEPS)!.maxHp;
    const o = villainPhase(base, { choose: "Blockbuster gets +2", defender: "Black Cat" });
    const attack = expectAttack(o, "40071b", 2);
    expect(attack.targetInstanceId).toBe(cat);
    const total = attack.baseAtk + attack.boostIcons;
    expect(total).toBeGreaterThan(hp);
    expect(playerOf(o.state, P1).discard).toContain(cat);
    expect(damage(o.state, identityOf(o.state))).toBe(total - hp);
  });

  it("40071a: without overkill the same defended attack stops at the ally (+2 ATK only)", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const o = villainPhase(base, { choose: "Blockbuster gets +2", defender: "Black Cat" });
    const attack = expectAttack(o, "40071a", 2);
    expect(attack.targetInstanceId).toBe(cat);
    expect(damage(o.state, identityOf(o.state))).toBe(0);
  });

  it("40071b: already tough, +2 ATK and overkill is forced", () => {
    const base = start(true);
    const toughened = patchInstance(base, activeVillain(base).instanceId, {
      statuses: { stunned: 0, confused: 0, tough: 1 },
    });
    const o = villainPhase(toughened, {});
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Blockbuster gets +2 ATK for this attack and this attack gains overkill"]);
    expectAttack(o, "40071b", 2);
  });
});

describe("Chimera (40072a/b)", () => {
  const start = (expert = false, players?: typeof TWO) => siege("40072", { expert, ...(players ? { players } : {}) });

  it("40072a.chimera-forced-interrupt: spending a [mental] resource discards that card and leaves ATK at 1", () => {
    const base = withHand(start(), P1, MENTAL_2);
    const spent = findByName(base, P1, "Enhanced Spider-Sense");
    const o = villainPhase(base, { choose: "Spend", pay: ["Enhanced Spider-Sense"] });
    expect(o.offered.map((p) => p.labels)).toEqual([
      ["Spend a [mental] resource", "Chimera gets +2 ATK for this attack"],
    ]);
    expect(o.resolved).toEqual(["Spend a [mental] resource"]);
    expect(playerOf(o.state, P1).discard).toContain(spent);
    expect(playerOf(o.state, P1).discard).toHaveLength(1);
    expect(playerOf(o.state, P1).hand).toHaveLength(4);
    expectAttack(o, "40072a", 0);
  });

  it("40072a: the other option is +2 ATK (3) and costs nothing", () => {
    const o = villainPhase(withHand(start(), P1, MENTAL_2), { choose: "Chimera gets +2" });
    expect(playerOf(o.state, P1).discard).toEqual([]);
    expect(playerOf(o.state, P1).hand).toHaveLength(5);
    const attack = expectAttack(o, "40072a", 2);
    expect(damage(o.state, identityOf(o.state))).toBe(3 + attack.boostIcons);
  });

  it("40072a: with no [mental] resource to spend the option is not offered and +2 ATK is forced", () => {
    const o = villainPhase(withHand(start(), P1, NO_MENTAL), { choose: "Spend" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Chimera gets +2 ATK for this attack"]);
    expect(playerOf(o.state, P1).hand).toHaveLength(5);
    expectAttack(o, "40072a", 2);
  });

  it("40072b: spending [mental][mental] discards both cards and leaves ATK at 2", () => {
    const base = withHand(start(true), P1, MENTAL_2);
    const both = [findByName(base, P1, "Enhanced Spider-Sense")];
    both.push(findByName(base, P1, "Enhanced Spider-Sense", both));
    const o = villainPhase(base, { choose: "Spend", pay: ["Enhanced Spider-Sense", "Enhanced Spider-Sense"] });
    expect(o.offered[0]!.labels).toEqual(["Spend [mental][mental] resources", "Chimera gets +2 ATK for this attack"]);
    expect([...playerOf(o.state, P1).discard].sort()).toEqual([...both].sort());
    expect(playerOf(o.state, P1).hand).toHaveLength(3);
    expectAttack(o, "40072b", 0);
  });

  it("40072b: one [mental] resource is not enough, so +2 ATK (4) is forced and nothing is spent", () => {
    const o = villainPhase(withHand(start(true), P1, MENTAL_1), {});
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Chimera gets +2 ATK for this attack"]);
    expect(playerOf(o.state, P1).discard).toEqual([]);
    expectAttack(o, "40072b", 2);
  });

  it("an attack on a Morlock ally is chosen by the ally's controller (RRG p. 10, Q5) and the interrupt resolves once", () => {
    const { state: withAlly, id: morlock } = withMorlock(withHand(start(), P1, MENTAL_2), P1);
    const o = villainPhase(withAlly, { choose: "Spend", pay: ["Enhanced Spider-Sense"] });
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P1);
    expect(o.resolved).toEqual(["Spend a [mental] resource"]);
    const attack = expectAttack(o, "40072a", 0);
    expect(attack.targetInstanceId).toBe(morlock);
    expect(playerOf(o.state, P1).discard).toHaveLength(1);
  });

  it("two players: each attacked player chooses and pays from their own hand; one without a [mental] resource is forced to +2 ATK", () => {
    let base = withHand(start(false, TWO), P1, NO_MENTAL);
    base = withHand(base, P2, CM_MENTAL_2);
    const paid = findByName(base, P2, "Make the Call");
    const o = villainPhase(base, [{}, { choose: "Spend", pay: ["Make the Call"] }]);
    expect(o.offered.map((p) => p.player)).toEqual([P2]);
    expect(o.resolved).toEqual(["Chimera gets +2 ATK for this attack", "Spend a [mental] resource"]);
    const [first, second] = attacks(o);
    expect(first!.targetInstanceId).toBe(identityOf(o.state, P1));
    expect(first!.baseAtk).toBe(3);
    expect(second!.targetInstanceId).toBe(identityOf(o.state, P2));
    expect(second!.baseAtk).toBe(1);
    expect(playerOf(o.state, P2).discard).toEqual([paid]);
    expect(playerOf(o.state, P1).discard).toEqual([]);
  });

  it("two players, an attack on P2's Morlock: P2 is the one asked", () => {
    const { state: withAlly, id: morlock } = withMorlock(
      withHand(withHand(start(false, TWO), P1, NO_MENTAL), P2, CM_MENTAL_2),
      P2,
    );
    const o = villainPhase(withAlly, [{}, { choose: "Chimera gets +2" }]);
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P2);
    expect(attacks(o).map((a) => a.targetInstanceId)).toEqual([identityOf(o.state, P1), morlock]);
    expect(attacks(o).map((a) => a.baseAtk)).toEqual([3, 3]);
  });
});

describe("Greycrow (40073a/b)", () => {
  const start = (expert = false) => siege("40073", { expert });
  // Spider-Man's deck: Nick Fury and Daredevil cost 4, Helicarrier 3, Black Cat 2 (printed).
  const CARDS = ["Nick Fury", "Daredevil", "Helicarrier", "Black Cat"] as const;

  it("40073a.greycrow-forced-interrupt: discards the highest-cost card (a tie is the player's pick) and ATK stays 1", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, CARDS);
    const fury = findByName(base, P1, "Nick Fury");
    const o = villainPhase(base, { choose: "Discard the highest", pick: "Daredevil" });
    expect(o.offered[0]!.labels).toEqual([
      "Discard the highest-cost card you control",
      "Greycrow gets +X ATK for this attack",
    ]);
    const discard = playerOf(o.state, P1).discard;
    expect(discard).toEqual([findByName(base, P1, "Daredevil")]);
    expect(playerOf(o.state, P1).playArea).toContain(fury);
    expect(playerOf(o.state, P1).playArea).toHaveLength(3);
    expectAttack(o, "40073a", 0);
  });

  it("40073a: the highest cost alone is discarded, not a lower one", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, ["Helicarrier", "Black Cat"]);
    const o = villainPhase(base, { choose: "Discard the highest" });
    expect(playerOf(o.state, P1).discard).toEqual([findByName(base, P1, "Helicarrier")]);
    expect(playerOf(o.state, P1).playArea).toEqual([findByName(base, P1, "Black Cat")]);
  });

  it("40073a: +X ATK is the printed cost of the highest-cost card you control (4), and nothing is discarded", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, CARDS);
    const o = villainPhase(base, { choose: "Greycrow gets" });
    expect(playerOf(o.state, P1).discard).toEqual([]);
    expect(playerOf(o.state, P1).playArea).toHaveLength(4);
    const attack = expectAttack(o, "40073a", 4);
    expect(attack.baseAtk).toBe(5);
  });

  it("40073a: X is the highest cost, not the sum or a lower card (Helicarrier 3 beside Black Cat 2: ATK 4)", () => {
    const o = villainPhase(withInPlay(withHand(start(), P1, NO_MENTAL), P1, ["Helicarrier", "Black Cat"]), {
      choose: "Greycrow gets",
    });
    expectAttack(o, "40073a", 3);
  });

  it("40073a: controlling no costed card, the discard is not offered and +X (X = 0) is forced", () => {
    const o = villainPhase(start(), { choose: "Discard" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Greycrow gets +X ATK for this attack"]);
    expectAttack(o, "40073a", 0);
  });

  it("40073b.greycrow-forced-interrupt: discards every card tied for the highest cost, and only those", () => {
    const base = withInPlay(withHand(start(true), P1, NO_MENTAL), P1, CARDS);
    const o = villainPhase(base, { choose: "Discard each" });
    expect(o.offered[0]!.labels).toEqual([
      "Discard each card you control with the highest cost",
      "Greycrow gets +X ATK for this attack",
    ]);
    expect([...playerOf(o.state, P1).discard].sort()).toEqual(
      [findByName(base, P1, "Nick Fury"), findByName(base, P1, "Daredevil")].sort(),
    );
    expect(playerOf(o.state, P1).playArea).toHaveLength(2);
    expectAttack(o, "40073b", 0);
  });

  it("40073b: +X ATK (2 + 4 = 6) discards nothing", () => {
    const o = villainPhase(withInPlay(withHand(start(true), P1, NO_MENTAL), P1, CARDS), { choose: "Greycrow gets" });
    expect(playerOf(o.state, P1).discard).toEqual([]);
    expect(expectAttack(o, "40073b", 4).baseAtk).toBe(6);
  });

  it("40073b: controlling no costed card, +X (X = 0) is forced", () => {
    const o = villainPhase(start(true), {});
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Greycrow gets +X ATK for this attack"]);
    expectAttack(o, "40073b", 0);
  });

  it("an attack on a Morlock ally: its controller chooses, and a Morlock (cost 0) is no cost above 0", () => {
    const { state: withAlly, id: morlock } = withMorlock(
      withInPlay(withHand(start(), P1, NO_MENTAL), P1, ["Helicarrier"]),
      P1,
    );
    const o = villainPhase(withAlly, { choose: "Greycrow gets" });
    expect(o.offered[0]!.player).toBe(P1);
    expect(attacks(o)[0]!.targetInstanceId).toBe(morlock);
    expect(attacks(o)[0]!.baseAtk).toBe(1 + 3);
  });
});

describe("Harpoon (40074a/b)", () => {
  const start = (expert = false) => siege("40074", { expert });
  const hero = (o: Outcome) => damage(o.state, identityOf(o.state));

  it("40074a.harpoon-forced-interrupt: 2 indirect damage on the hero, one boost card, ATK 2", () => {
    const o = villainPhase(start(), { choose: "Take 2 indirect" });
    expect(o.offered[0]!.labels).toEqual(["Take 2 indirect damage", "Give Harpoon 1 additional facedown boost card"]);
    const attack = expectAttack(o, "40074a", 0, 1);
    expect(hero(o)).toBe(2 + attack.baseAtk + attack.boostIcons);
  });

  it("40074a: the other option is one additional facedown boost card: two flipped and all their icons counted, no indirect damage", () => {
    const o = villainPhase(start(), { choose: "Give Harpoon" }, 2);
    const attack = expectAttack(o, "40074a", 0, 2);
    expect(hero(o)).toBe(attack.baseAtk + attack.boostIcons);
  });

  it("40074b: 3 indirect damage, one boost card, ATK 3", () => {
    const o = villainPhase(start(true), { choose: "Take 3 indirect" });
    expect(o.offered[0]!.labels).toEqual([
      "Take 3 indirect damage",
      "Give Harpoon 1 additional facedown boost card; this attack gains overkill",
    ]);
    const attack = expectAttack(o, "40074b", 0, 1);
    expect(hero(o)).toBe(3 + attack.baseAtk + attack.boostIcons);
  });

  it("40074b: the other option is two boost cards and overkill: a defending ally is defeated and the excess reaches the hero", () => {
    const base = withInPlay(withHand(start(true), P1, NO_MENTAL), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const hp = characterProfile(base, cat, WAVE7_DEPS)!.maxHp;
    const o = villainPhase(base, { choose: "Give Harpoon", defender: "Black Cat" }, 2);
    const attack = expectAttack(o, "40074b", 0, 2);
    const total = attack.baseAtk + attack.boostIcons;
    expect(total).toBeGreaterThan(hp);
    expect(hero(o)).toBe(total - hp);
  });

  it("40074a: the same defended attack with the boost option has no overkill", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, ["Black Cat"]);
    const o = villainPhase(base, { choose: "Give Harpoon", defender: "Black Cat" }, 2);
    expectAttack(o, "40074a", 0, 2);
    expect(hero(o)).toBe(0);
  });

  it("an attack on a Morlock ally: the ally's controller takes the indirect damage and chooses", () => {
    const { state: withAlly, id: morlock } = withMorlock(start(), P1);
    const o = villainPhase(withAlly, { choose: "Take 2 indirect" });
    expect(o.offered[0]!.player).toBe(P1);
    expect(attacks(o)[0]!.targetInstanceId).toBe(morlock);
    // The two indirect damage is divided among P1's characters: the hero and the Morlock.
    expect(
      hero(o) + damage(o.state, morlock) + (playerOf(o.state, P1).playArea.includes(morlock) ? 0 : 5),
    ).toBeGreaterThanOrEqual(2);
  });
});

describe("Riptide (40075a/b)", () => {
  /**
   * The main scheme starts each of these tests empty (no threat, no knock counter), so the threat Riptide places
   * cannot complete Knock, Knock in the phase under test: its stage 2 would put Morlocks into play and draw more
   * attacks, and these tests count one activation's threat.
   */
  const quietMainScheme = (state: GameState): GameState => {
    const main = state.mainScheme.instanceId;
    return {
      ...state,
      instances: { ...state.instances, [main]: { ...state.instances[main]!, threat: 0, counters: {} } },
    };
  };
  const start = (expert = false, players?: typeof TWO) =>
    quietMainScheme(siege("40075", { expert, ...(players ? { players } : {}) }));
  /** The scenario's side schemes By Any Means (40084) and In the Midst of Chaos (40085), each with 3 threat. */
  const withSideSchemes = (state: GameState) => {
    const a = encounterCardInVillainArea(state, "40084", 3);
    const b = encounterCardInVillainArea(a.state, "40085", 3);
    return { state: b.state, ids: [a.id, b.id] as const };
  };
  const placed = (o: Outcome, id: InstanceId) =>
    threatByVillain(o)
      .filter((e) => e.schemeInstanceId === id)
      .map((e) => e.amount);

  it("40075a.riptide-forced-interrupt: 2 threat on the main scheme and 1 on each side scheme (one player), ATK stays 1", () => {
    const { state, ids } = withSideSchemes(start());
    const o = villainPhase(state, { choose: "Place 2 threat" });
    expect(o.offered[0]!.labels).toEqual([
      "Place 2 threat on the main scheme and 1 threat on each side scheme",
      "Riptide gets +2 ATK for this attack",
    ]);
    expect(placed(o, o.state.mainScheme.instanceId)).toEqual([2]);
    expect(ids.map((id) => placed(o, id))).toEqual([[1], [1]]);
    expect(threatByVillain(o)).toHaveLength(3);
    expectAttack(o, "40075a", 0);
  });

  it("40075a: two players, the same threat for each attacked player's choice (2 on the main scheme and 1 per side scheme, twice)", () => {
    const { state, ids } = withSideSchemes(start(false, TWO));
    const o = villainPhase(state, [{ choose: "Place 2 threat" }, { choose: "Place 2 threat" }]);
    expect(o.offered.map((p) => p.player)).toEqual([P1, P2]);
    expect(placed(o, o.state.mainScheme.instanceId)).toEqual([2, 2]);
    expect(ids.map((id) => placed(o, id))).toEqual([
      [1, 1],
      [1, 1],
    ]);
    expect(attacks(o).map((a) => a.baseAtk)).toEqual([1, 1]);
  });

  it("40075a: with no side scheme in play only the main scheme takes the 2 threat", () => {
    const o = villainPhase(start(), { choose: "Place 2 threat" });
    expect(threatByVillain(o).map((e) => [e.schemeInstanceId, e.amount])).toEqual([[o.state.mainScheme.instanceId, 2]]);
  });

  it("40075a: the other option is +2 ATK (3) and places no threat", () => {
    const { state } = withSideSchemes(start());
    const o = villainPhase(state, { choose: "Riptide gets +2" });
    expect(threatByVillain(o)).toEqual([]);
    const attack = expectAttack(o, "40075a", 2);
    expect(damage(o.state, identityOf(o.state))).toBe(3 + attack.boostIcons);
  });

  it("40075b: 3 threat on the main scheme and 1 on each side scheme, ATK stays 2", () => {
    const { state, ids } = withSideSchemes(start(true));
    const o = villainPhase(state, { choose: "Place 3 threat" });
    expect(placed(o, o.state.mainScheme.instanceId)).toEqual([3]);
    expect(ids.map((id) => placed(o, id))).toEqual([[1], [1]]);
    expectAttack(o, "40075b", 0);
  });

  it("40075b: two players, 3 and 1 for each attacked player's choice", () => {
    const { state, ids } = withSideSchemes(start(true, TWO));
    const o = villainPhase(state, [{ choose: "Place 3 threat" }, { choose: "Place 3 threat" }]);
    expect(placed(o, o.state.mainScheme.instanceId)).toEqual([3, 3]);
    expect(ids.map((id) => placed(o, id))).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });

  it("40075b: the other option is +2 ATK (4) and piercing: a tough status card does not stop the damage, where standard Riptide's +2 is stopped", () => {
    const expert = start(true);
    const toughHero = (s: GameState) =>
      patchInstance(s, identityOf(s), { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const o = villainPhase(toughHero(expert), { choose: "Riptide gets +2" });
    expect(threatByVillain(o)).toEqual([]);
    const attack = expectAttack(o, "40075b", 2);
    expect(damage(o.state, identityOf(o.state))).toBe(4 + attack.boostIcons);
    const standard = villainPhase(toughHero(start()), { choose: "Riptide gets +2" });
    expectAttack(standard, "40075a", 2);
    expect(damage(standard.state, identityOf(standard.state))).toBe(0);
    expect(inst(standard.state, identityOf(standard.state)).statuses.tough).toBe(0);
  });

  it("an attack on a Morlock ally: its controller chooses, and the threat goes on the main scheme", () => {
    const { state: withAlly, id: morlock } = withMorlock(start(), P1);
    const o = villainPhase(withAlly, { choose: "Place 2 threat" });
    expect(o.offered[0]!.player).toBe(P1);
    expect(attacks(o)[0]!.targetInstanceId).toBe(morlock);
    expect(placed(o, o.state.mainScheme.instanceId)).toEqual([2]);
  });
});

const statusOf = (state: GameState, id: InstanceId, status: "confused" | "stunned") => inst(state, id).statuses[status];
const withStatus = (state: GameState, id: InstanceId, status: "confused" | "stunned") =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, [status]: 1 } });
const stat = (state: GameState, id: InstanceId, which: "atk" | "thw") =>
  characterProfile(state, id, WAVE7_DEPS)![which];

describe("Arclight (40070a/b)", () => {
  const start = (expert = false, players: typeof TWO | readonly [typeof SPIDER_MAN] = [SPIDER_MAN]) =>
    siege("40070", { expert, players });
  const CONFUSE = "Confuse a character you control";
  const PLUS = "Arclight gets +2 ATK for this attack";

  it("40070a.arclight-forced-interrupt: both options are offered; the chosen character is confused and ATK stays 1", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, ["Daredevil"]);
    const dd = findByName(base, P1, "Daredevil");
    const o = villainPhase(base, { choose: "Confuse", pick: "Daredevil" });
    expect(o.offered.map((p) => p.labels)).toEqual([[CONFUSE, PLUS]]);
    expect(o.resolved).toEqual([CONFUSE]);
    expect(statusOf(o.state, dd, "confused")).toBe(1);
    expect(statusOf(o.state, identityOf(o.state), "confused")).toBe(0);
    expectAttack(o, "40070a", 0);
  });

  it("40070a: the other option is +2 ATK (3) and confuses nobody", () => {
    const base = withInPlay(start(), P1, ["Daredevil"]);
    const o = villainPhase(base, { choose: "Arclight gets +2" });
    expect(o.resolved).toEqual([PLUS]);
    expect(statusOf(o.state, findByName(base, P1, "Daredevil"), "confused")).toBe(0);
    expect(statusOf(o.state, identityOf(o.state), "confused")).toBe(0);
    expectAttack(o, "40070a", 2);
  });

  it("40070a: the only character already confused, the option is not offered and +2 ATK (3) is forced; it keeps one confused card", () => {
    const base = start();
    const o = villainPhase(withStatus(base, identityOf(base), "confused"), { choose: "Confuse" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual([PLUS]);
    expect(statusOf(o.state, identityOf(o.state), "confused")).toBe(1);
    expectAttack(o, "40070a", 2);
  });

  it("40070a: with one character confused the option is still offered, and only the other can be chosen", () => {
    const base = withInPlay(start(), P1, ["Daredevil"]);
    const dd = findByName(base, P1, "Daredevil");
    const o = villainPhase(withStatus(base, dd, "confused"), { choose: "Confuse" });
    expect(o.resolved).toEqual([CONFUSE]);
    expect(statusOf(o.state, dd, "confused")).toBe(1);
    expect(statusOf(o.state, identityOf(o.state), "confused")).toBe(1);
    expectAttack(o, "40070a", 0);
  });

  it("40070b.arclight-forced-interrupt: the highest THW is confused (a tie is the player's pick) and ATK stays 2", () => {
    const base = withInPlay(start(true), P1, ["Daredevil", "Nick Fury", "Black Cat"]);
    const [dd, fury, cat] = ["Daredevil", "Nick Fury", "Black Cat"].map((n) => findByName(base, P1, n));
    expect(stat(base, dd!, "thw")).toBe(2);
    expect(stat(base, fury!, "thw")).toBe(2);
    const o = villainPhase(base, { choose: "Confuse", pick: "Nick Fury" });
    expect(o.offered[0]!.labels).toEqual(["Confuse the character you control with the highest THW", PLUS]);
    expect(statusOf(o.state, fury!, "confused")).toBe(1);
    for (const other of [dd!, cat!, identityOf(o.state)]) expect(statusOf(o.state, other, "confused")).toBe(0);
    expectAttack(o, "40070b", 0);
  });

  it("40070b: the other option is +2 ATK (4) and confuses nobody", () => {
    const base = withInPlay(start(true), P1, ["Daredevil"]);
    const o = villainPhase(base, { choose: "Arclight gets +2" });
    expect(o.resolved).toEqual([PLUS]);
    expect(statusOf(o.state, findByName(base, P1, "Daredevil"), "confused")).toBe(0);
    expectAttack(o, "40070b", 2);
  });

  it("40070b: the highest-THW character already confused, the option is not offered (the next highest is not confused instead): +2 ATK (4) is forced", () => {
    const base = withInPlay(start(true), P1, ["Daredevil", "Black Cat"]);
    const dd = findByName(base, P1, "Daredevil");
    const o = villainPhase(withStatus(base, dd, "confused"), { choose: "Confuse" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual([PLUS]);
    expect(statusOf(o.state, findByName(base, P1, "Black Cat"), "confused")).toBe(0);
    expect(statusOf(o.state, dd, "confused")).toBe(1);
    expectAttack(o, "40070b", 2);
  });

  it("40070b: of two characters tied for the highest THW, one already confused, only the other can be confused", () => {
    const base = withInPlay(start(true), P1, ["Daredevil", "Nick Fury"]);
    const [dd, fury] = ["Daredevil", "Nick Fury"].map((n) => findByName(base, P1, n));
    const o = villainPhase(withStatus(base, dd!, "confused"), { choose: "Confuse" });
    expect(o.resolved).toEqual(["Confuse the character you control with the highest THW"]);
    expect(statusOf(o.state, fury!, "confused")).toBe(1);
    expectAttack(o, "40070b", 0);
  });

  it("two players: each attacked player chooses; the one with every character confused is forced to +2 ATK", () => {
    const base = start(false, TWO);
    const o = villainPhase(withStatus(base, identityOf(base, P1), "confused"), [{}, { choose: "Confuse" }]);
    expect(o.offered.map((p) => p.player)).toEqual([P2]);
    expect(o.resolved).toEqual([PLUS, CONFUSE]);
    expect(attacks(o).map((a) => a.baseAtk)).toEqual([3, 1]);
    expect(statusOf(o.state, identityOf(o.state, P1), "confused")).toBe(1);
    expect(statusOf(o.state, identityOf(o.state, P2), "confused")).toBe(1);
  });

  it("two players, expert: each player's highest is among their own characters only", () => {
    const base = start(true, TWO);
    const o = villainPhase(withStatus(base, identityOf(base, P1), "confused"), [{}, { choose: "Confuse" }]);
    expect(o.resolved).toEqual([PLUS, "Confuse the character you control with the highest THW"]);
    expect(attacks(o).map((a) => a.baseAtk)).toEqual([4, 2]);
    expect(statusOf(o.state, identityOf(o.state, P2), "confused")).toBe(1);
  });

  it("an attack on a Morlock ally is chosen by the ally's controller (Q5) ", () => {
    const { state: withAlly, id: morlock } = withMorlock(start(), P1);
    const o = villainPhase(withAlly, { choose: "Confuse" });
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P1);
    expect(attacks(o)[0]!.targetInstanceId).toBe(morlock);
    expect(o.resolved).toEqual([CONFUSE]);
    const confusedOnes = [morlock, identityOf(o.state)].filter((id) => statusOf(o.state, id, "confused") === 1);
    expect(confusedOnes).toHaveLength(1);
  });
});

describe("Vertigo (40076a/b)", () => {
  const start = (expert = false, players: typeof TWO | readonly [typeof SPIDER_MAN] = [SPIDER_MAN]) =>
    siege("40076", { expert, players });
  const STUN = "Stun a character you control";
  const PLUS = "Vertigo gets +2 ATK for this attack";

  it("40076a.vertigo-forced-interrupt: both options are offered; the chosen character is stunned and ATK stays 0", () => {
    const base = withInPlay(start(), P1, ["Daredevil"]);
    const dd = findByName(base, P1, "Daredevil");
    const o = villainPhase(base, { choose: "Stun", pick: "Daredevil" });
    expect(o.offered.map((p) => p.labels)).toEqual([[STUN, PLUS]]);
    expect(o.resolved).toEqual([STUN]);
    expect(statusOf(o.state, dd, "stunned")).toBe(1);
    expect(statusOf(o.state, identityOf(o.state), "stunned")).toBe(0);
    expectAttack(o, "40076a", 0);
  });

  it("40076a: the other option is +2 ATK (2) and stuns nobody", () => {
    const base = withInPlay(start(), P1, ["Daredevil"]);
    const o = villainPhase(base, { choose: "Vertigo gets +2" });
    expect(o.resolved).toEqual([PLUS]);
    expect(statusOf(o.state, findByName(base, P1, "Daredevil"), "stunned")).toBe(0);
    expect(statusOf(o.state, identityOf(o.state), "stunned")).toBe(0);
    expectAttack(o, "40076a", 2);
  });

  it("40076a: the only character already stunned, the option is not offered and +2 ATK (2) is forced; it keeps one stunned card", () => {
    const base = start();
    const o = villainPhase(withStatus(base, identityOf(base), "stunned"), { choose: "Stun" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual([PLUS]);
    expect(statusOf(o.state, identityOf(o.state), "stunned")).toBe(1);
    expectAttack(o, "40076a", 2);
  });

  it("40076a: with one character stunned the option is still offered, and only the other can be chosen", () => {
    const base = withInPlay(start(), P1, ["Daredevil"]);
    const dd = findByName(base, P1, "Daredevil");
    const o = villainPhase(withStatus(base, dd, "stunned"), { choose: "Stun" });
    expect(o.resolved).toEqual([STUN]);
    expect(statusOf(o.state, dd, "stunned")).toBe(1);
    expect(statusOf(o.state, identityOf(o.state), "stunned")).toBe(1);
    expectAttack(o, "40076a", 0);
  });

  it("40076b.vertigo-forced-interrupt: the highest ATK is stunned (a tie is the player's pick) and ATK stays 1", () => {
    const base = withInPlay(start(true), P1, ["Daredevil", "Nick Fury", "Black Cat"]);
    const [dd, fury, cat] = ["Daredevil", "Nick Fury", "Black Cat"].map((n) => findByName(base, P1, n));
    expect(stat(base, dd!, "atk")).toBe(2);
    expect(stat(base, fury!, "atk")).toBe(2);
    expect(stat(base, identityOf(base), "atk")).toBeLessThanOrEqual(2);
    const o = villainPhase(base, { choose: "Stun", pick: "Daredevil" });
    expect(o.offered[0]!.labels).toEqual(["Stun the character you control with the highest ATK", PLUS]);
    expect(statusOf(o.state, dd!, "stunned")).toBe(1);
    for (const other of [fury!, cat!]) expect(statusOf(o.state, other, "stunned")).toBe(0);
    expectAttack(o, "40076b", 0);
  });

  it("40076b: the other option is +2 ATK (3) and stuns nobody", () => {
    const base = withInPlay(start(true), P1, ["Daredevil"]);
    const o = villainPhase(base, { choose: "Vertigo gets +2" });
    expect(o.resolved).toEqual([PLUS]);
    expect(statusOf(o.state, findByName(base, P1, "Daredevil"), "stunned")).toBe(0);
    expectAttack(o, "40076b", 2);
  });

  it("40076b: the highest-ATK character already stunned, the option is not offered (the next highest is not stunned instead): +2 ATK (3) is forced", () => {
    const base = withInPlay(start(true), P1, ["Daredevil", "Black Cat"]);
    const dd = findByName(base, P1, "Daredevil");
    // Spider-Man's hero form (ATK 2) ties Daredevil (ATK 2): both are the highest, both already stunned.
    const stunned = withStatus(withStatus(base, dd, "stunned"), identityOf(base), "stunned");
    const o = villainPhase(stunned, { choose: "Stun" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual([PLUS]);
    expect(statusOf(o.state, findByName(base, P1, "Black Cat"), "stunned")).toBe(0);
    expectAttack(o, "40076b", 2);
  });

  it("two players: each attacked player chooses; the one with every character stunned is forced to +2 ATK", () => {
    const base = start(false, TWO);
    const o = villainPhase(withStatus(base, identityOf(base, P1), "stunned"), [{}, { choose: "Stun" }]);
    expect(o.offered.map((p) => p.player)).toEqual([P2]);
    expect(o.resolved).toEqual([PLUS, STUN]);
    expect(attacks(o).map((a) => a.baseAtk)).toEqual([2, 0]);
    expect(statusOf(o.state, identityOf(o.state, P2), "stunned")).toBe(1);
  });

  it("two players, expert: each player's highest is among their own characters only", () => {
    const base = start(true, TWO);
    const o = villainPhase(withStatus(base, identityOf(base, P1), "stunned"), [{}, { choose: "Stun" }]);
    expect(o.resolved).toEqual([PLUS, "Stun the character you control with the highest ATK"]);
    expect(attacks(o).map((a) => a.baseAtk)).toEqual([3, 1]);
    expect(statusOf(o.state, identityOf(o.state, P2), "stunned")).toBe(1);
  });

  it("an attack on a Morlock ally is chosen by the ally's controller (Q5)", () => {
    const { state: withAlly, id: morlock } = withMorlock(start(), P1);
    const o = villainPhase(withAlly, { choose: "Stun" });
    expect(o.offered[0]!.player).toBe(P1);
    expect(attacks(o)[0]!.targetInstanceId).toBe(morlock);
    const stunnedOnes = [morlock, identityOf(o.state)].filter((id) => statusOf(o.state, id, "stunned") === 1);
    expect(stunnedOnes).toHaveLength(1);
  });
});
