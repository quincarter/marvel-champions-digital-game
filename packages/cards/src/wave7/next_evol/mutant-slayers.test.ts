import {
  activeVillain,
  createGame,
  hasKeyword,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { chooseTarget, chosen, forcedInterrupt, on, query, retargetAttack } from "../../dsl/index.js";
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
import { MUTANT_SLAYERS } from "./mutant-slayers.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Nothing in On the Run attacks an ally by itself, so Black Cat's own ability (an unrelated Forced Response) is replaced
 * by a test double that redirects the attack ("When an enemy attacks you, it attacks Black Cat instead"). The minion's
 * own interrupt under test is the real one.
 */
const DEPS = {
  abilities: {
    ...WAVE7_ABILITIES,
    "01002.black-cat-forced-response": forcedInterrupt(
      on.enemyAttacks({ categories: ["enemy"] }, { againstYou: true }),
      chooseTarget("cat", query("ally", { controller: "you", name: "Black Cat" })),
      retargetAttack(chosen("cat")),
    ),
  },
};

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const CABLE = { starterDeckId: "cable-leadership" } as const;
const DOMINO = { starterDeckId: "domino-justice" } as const;
type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL | typeof CABLE | typeof DOMINO;

/** The printed number of the villain each game starts with (a minion never shares its title with it: it was removed). */
const BLOCKBUSTER = "40071";
const ARCLIGHT = "40070";
const ATK = {
  Arclight: 1,
  Blockbuster: 2,
  Chimera: 1,
  Greycrow: 1,
  Harpoon: 2,
  Riptide: 1,
  Vertigo: 0,
} as const;

/** On the Run, past setup: each player's search at 1B is answered with `minions` (in player order). */
function game(opts: { players?: readonly Seat[]; villain?: string; minions: readonly string[] }): GameState {
  const villain = opts.villain ?? (opts.minions.includes("Blockbuster") ? ARCLIGHT : BLOCKBUSTER);
  for (let seed = 1; seed < 400; seed++) {
    const config = wave7Scenario("on-the-run", {
      players: opts.players ?? [SPIDER_MAN],
      seed,
      difficulty: "standard",
      modularSetIds: [],
    });
    const created = createGame(config, WAVE7_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const id = created.state.instances[activeVillain(created.state).instanceId]!.cardId as string;
    if (!id.startsWith(villain)) continue;
    const wanted = [...opts.minions];
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice!;
      const hit = choice.options.find((o) => o.label === wanted[0]);
      if (hit) {
        wanted.shift();
        return [hit.optionId];
      }
      return firstLegal(s);
    };
    return settle(created.state, pick, (s) => s.step.phase === "player", WAVE7_DEPS);
  }
  throw new Error(`no seed starts On the Run with ${villain}`);
}

const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const engaged = (s: GameState, player: PlayerId) =>
  playerOf(s, player).playArea.filter((id) => s.cardPool[s.instances[id]!.cardId]!.type === "minion");
const minionOf = (s: GameState, name: string): InstanceId => {
  for (const p of s.players) {
    const hit = engaged(s, p.playerId).find((id) => nameOf(s, id) === name);
    if (hit) return hit;
  }
  throw new Error(`no ${name} engaged`);
};
const zoneIds = (s: GameState, player: PlayerId) => {
  const p = playerOf(s, player);
  return [...p.hand, ...p.deck, ...p.discard, ...p.playArea];
};
const findByName = (s: GameState, player: PlayerId, name: string, taken: readonly InstanceId[] = []) => {
  const id = zoneIds(s, player).find((i) => nameOf(s, i) === name && !taken.includes(i));
  if (!id) throw new Error(`${player} has no (other) ${name}`);
  return id;
};
const withPlayer = (s: GameState, player: PlayerId, change: (p: GameState["players"][number]) => object) => ({
  ...s,
  players: s.players.map((p) => (p.playerId === player ? { ...p, ...change(p) } : p)),
});
/** `player`'s hand is exactly these cards (by name; the old hand goes to the top of the deck). */
function withHand(s: GameState, player: PlayerId, names: readonly string[]): GameState {
  const ids: InstanceId[] = [];
  for (const name of names) ids.push(findByName(s, player, name, ids));
  return withPlayer(s, player, (p) => ({ hand: ids, deck: [...p.hand, ...p.deck].filter((i) => !ids.includes(i)) }));
}
/** These cards are in `player`'s play area, ready, as though played (state surgery). */
function withInPlay(s: GameState, player: PlayerId, names: readonly string[]): GameState {
  const ids: InstanceId[] = [];
  for (const name of names) ids.push(findByName(s, player, name, ids));
  const moved = withPlayer(s, player, (p) => ({
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
/** `player`'s hand is five cards with no [mental] (or wild) resource icon. */
function withNoMentalHand(s: GameState, player: PlayerId): GameState {
  const ids = zoneIds(s, player)
    .filter((i) => {
      const icons =
        (s.cardPool[s.instances[i]!.cardId] as { resourceIcons?: Record<string, number> }).resourceIcons ?? {};
      return (
        !icons.mental &&
        !icons.wild &&
        s.cardPool[s.instances[i]!.cardId]!.type !== "hero_identity" &&
        s.cardPool[s.instances[i]!.cardId]!.type !== "resource"
      );
    })
    .filter((i) => !playerOf(s, player).playArea.includes(i))
    .slice(0, 5);
  return withPlayer(s, player, (p) => ({
    hand: ids,
    deck: [...p.hand, ...p.deck].filter((i) => !ids.includes(i)),
  }));
}
const NO_MENTAL = ["Backflip", "Backflip", "For Justice!", "For Justice!", "Haymaker"] as const;
const MENTAL_2 = ["Enhanced Spider-Sense", "Enhanced Spider-Sense", "Backflip", "For Justice!", "Haymaker"] as const;
const CM_MENTAL_2 = ["Make the Call", "Make the Call", "Get Ready", "Get Ready", "Crisis Interdiction"] as const;

interface Plan {
  /** The label (start) of the option to take at each `chooseOption` prompt; the first one offered otherwise. */
  readonly choose?: string;
  /** Hand cards (by name) to spend at a `spendResources` prompt. */
  readonly pay?: readonly string[];
  /** Which card or character (by label) to pick at a target prompt. */
  readonly pick?: string;
}
interface Outcome {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** Each `chooseOption` prompt: who was asked and which options were offered. */
  readonly offered: readonly { readonly player: PlayerId; readonly labels: readonly string[] }[];
  /** The options that resolved, in order (also the ones forced because the other could not be carried out). */
  readonly resolved: readonly string[];
}
/**
 * Hero form, end of turn for every player: the villain phase runs (the villain schemes against each player, Hope's
 * Captor, then each engaged Marauder minion attacks). `plan` is one plan for everybody or one per player in order. The
 * encounter deck is stacked: boost cards for the villain's activations (a minion draws none), then Advance and Assault
 * (0 icons: the villain schemes, its boost card blank) as each player's reveal.
 */
function villainPhase(state: GameState, plan: Plan | readonly Plan[], reveals?: readonly string[]): Outcome {
  const plans: readonly Plan[] = Array.isArray(plan) ? (plan as readonly Plan[]) : [plan as Plan];
  const offered: { player: PlayerId; labels: string[] }[] = [];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    const seat = s.players.findIndex((p) => p.playerId === choice.playerId);
    const current: Plan = plans[Math.min(seat, plans.length - 1)] ?? {};
    switch (choice.prompt.kind) {
      case "chooseOption": {
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
      case "declareDefender":
        return ["decline"];
      case "orderTriggers": {
        // Hope's Captor is not among these: its "would attack" resolves before the attack's other interrupts are
        // gathered (RRG 1.8 "'Would'", p. 48), so the villain schemes and its own "attacks you" choice never comes up.
        // The Black Cat redirect (a test double) goes first, the rest as listed.
        const rank = (label: string) => (label === "Black Cat" ? 0 : 1);
        return [...choice.options].sort((x, y) => rank(x.label) - rank(y.label)).map((o) => o.optionId);
      }
      default: {
        const hit = current.pick ? choice.options.find((o) => o.label === current.pick) : undefined;
        return hit && choice.prompt.kind !== "chooseTriggers" ? [hit.optionId] : firstLegal(s);
      }
    }
  };
  const stacked = stackEncounterDeck(
    state,
    ...["01190", "01188", "01189"].slice(0, state.players.length),
    ...(reveals ?? state.players.flatMap(() => ["01186", "01187"])),
  );
  const commands = state.players.flatMap((p) => [toHero(p.playerId), endTurn(p.playerId)]);
  const { state: after, events } = driveEventsPicking(DEPS, stacked, pick, ...commands);
  return {
    state: after,
    events,
    offered,
    resolved: events
      .filter((e): e is Extract<GameEvent, { type: "optionChosen" }> => e.type === "optionChosen")
      .map((e) => e.label),
  };
}
const attacksBy = (o: Outcome, minion: InstanceId) =>
  o.events.filter(
    (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
      e.type === "attackResolved" && e.enemyInstanceId === minion,
  );
/** The one attack the minion made, checked against its printed ATK plus `bonus`; it draws no boost card. */
function expectAttack(o: Outcome, name: keyof typeof ATK, minion: InstanceId, bonus: number) {
  const [attack, ...more] = attacksBy(o, minion);
  expect(more).toEqual([]);
  expect(attack).toBeDefined();
  expect(attack!.baseAtk).toBe(ATK[name] + bonus);
  expect(attack!.boostIcons).toBe(0);
  expect(
    o.events.filter(
      (e) => e.type === "boostCardFlipped" && (e as { enemyInstanceId?: InstanceId }).enemyInstanceId === minion,
    ),
  ).toEqual([]);
  return attack!;
}
/** Threat the minion's own ability placed (a minion's scheme, if any, is not an activation of its own in hero form). */
const threatBy = (o: Outcome, minion: InstanceId) =>
  o.events.filter(
    (e): e is Extract<GameEvent, { type: "threatPlaced" }> =>
      e.type === "threatPlaced" && e.sourceInstanceId === minion,
  );
const damage = (s: GameState, id: InstanceId) => inst(s, id).damage;
const status = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough") => inst(s, id).statuses[name];
const withStatus = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough") =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [name]: 1 } });
const ONLY = (labels: readonly string[]) => [labels];

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(MUTANT_SLAYERS).sort()).toEqual(
      [
        "40094.arclight-forced-interrupt",
        "40095.blockbuster-forced-interrupt",
        "40096.chimera-forced-interrupt",
        "40097.greycrow-forced-interrupt",
        "40098.harpoon-forced-interrupt",
        "40099.riptide-forced-interrupt",
        "40100.vertigo-forced-interrupt",
        "40101.mutant-slayers-constant",
        "40101.when-revealed",
        "40102.when-revealed",
      ].sort(),
    );
  });
});

describe("Arclight (40094)", () => {
  const start = (players?: readonly Seat[], minions: readonly string[] = ["Arclight"]) =>
    game({ players: players ?? [SPIDER_MAN], minions });

  it("40094.arclight-forced-interrupt: confusing a character you control leaves ATK at 1 (both options offered)", () => {
    const base = start();
    const arclight = minionOf(base, "Arclight");
    const o = villainPhase(base, { choose: "Confuse" });
    expect(o.offered.map((p) => p.labels)).toEqual(
      ONLY(["Confuse a character you control", "Arclight gets +2 ATK for this attack"]),
    );
    expect(o.resolved).toEqual(["Confuse a character you control"]);
    expectAttack(o, "Arclight", arclight, 0);
    expect(status(o.state, identityOf(o.state, P1), "confused")).toBe(1);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(1);
  });

  it("the other option is +2 ATK (3) and confuses nobody", () => {
    const base = start();
    const arclight = minionOf(base, "Arclight");
    const o = villainPhase(base, { choose: "Arclight gets +2" });
    expectAttack(o, "Arclight", arclight, 2);
    expect(status(o.state, identityOf(o.state, P1), "confused")).toBe(0);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(3);
  });

  it("every character already confused: the confuse option is not offered and +2 ATK is forced (Q8)", () => {
    const base = withStatus(start(), identityOf(start(), P1), "confused");
    const arclight = minionOf(base, "Arclight");
    const o = villainPhase(base, { choose: "Confuse" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Arclight gets +2 ATK for this attack"]);
    expectAttack(o, "Arclight", arclight, 2);
  });

  it("an attack on an ally: the ally's controller chooses (Q5) and the interrupt resolves once", () => {
    const base = withInPlay(start(), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const o = villainPhase(base, { choose: "Arclight gets +2" });
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P1);
    const attack = expectAttack(o, "Arclight", minionOf(base, "Arclight"), 2);
    expect(attack.targetInstanceId).toBe(cat);
    expect(playerOf(o.state, P1).discard).toContain(cat);
    // Black Cat has 2 hit points, so a 3 ATK attack that she takes does not reach the hero.
    expect(damage(o.state, identityOf(o.state, P1))).toBe(0);
  });

  it("an attack on an ally: the confuse option can be given to the ally", () => {
    const base = withInPlay(start(), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const o = villainPhase(base, { choose: "Confuse", pick: "Black Cat" });
    expect(status(o.state, cat, "confused")).toBe(1);
    expect(status(o.state, identityOf(o.state, P1), "confused")).toBe(0);
  });

  it("two players: each attacked player chooses; the one with every character confused is forced to +2 ATK", () => {
    const first = start([SPIDER_MAN, CAPTAIN_MARVEL], ["Harpoon", "Arclight"]);
    const base = withStatus(first, identityOf(first, P2), "confused");
    const o = villainPhase(base, [{ choose: "Harpoon gets +2" }, { choose: "Confuse" }]);
    expect(o.offered.map((p) => p.player)).toEqual([P1]);
    expect(o.resolved).toEqual([
      "Harpoon gets +2 ATK for this attack and this attack gains piercing",
      "Arclight gets +2 ATK for this attack",
    ]);
    const attack = expectAttack(o, "Arclight", minionOf(base, "Arclight"), 2);
    expect(attack.targetInstanceId).toBe(identityOf(o.state, P2));
    expect(damage(o.state, identityOf(o.state, P2))).toBe(3);
  });
});

describe("Blockbuster (40095)", () => {
  const start = (players?: readonly Seat[], minions: readonly string[] = ["Blockbuster"]) =>
    game({ players: players ?? [SPIDER_MAN], minions });

  it("40095.blockbuster-forced-interrupt: a tough status card goes on Blockbuster and his ATK stays 2", () => {
    const base = start();
    const minion = minionOf(base, "Blockbuster");
    expect(status(base, minion, "tough")).toBe(0);
    const o = villainPhase(base, { choose: "Give Blockbuster a tough" });
    expect(o.offered.map((p) => p.labels)).toEqual(
      ONLY(["Give Blockbuster a tough status card", "Blockbuster gets +2 ATK for this attack"]),
    );
    expect(status(o.state, minion, "tough")).toBe(1);
    expectAttack(o, "Blockbuster", minion, 0);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(2);
  });

  it("the other option is +2 ATK (4) and no status card", () => {
    const base = start();
    const minion = minionOf(base, "Blockbuster");
    const o = villainPhase(base, { choose: "Blockbuster gets +2" });
    expect(status(o.state, minion, "tough")).toBe(0);
    expectAttack(o, "Blockbuster", minion, 2);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(4);
  });

  it("already tough: the tough option is not offered, +2 ATK is forced and he still has one tough card", () => {
    const first = start();
    const minion = minionOf(first, "Blockbuster");
    const base = withStatus(first, minion, "tough");
    const o = villainPhase(base, { choose: "Give Blockbuster" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Blockbuster gets +2 ATK for this attack"]);
    expect(status(o.state, minion, "tough")).toBe(1);
    expectAttack(o, "Blockbuster", minion, 2);
  });

  it("an attack on an ally: the ally's controller chooses (Q5), the interrupt resolves once", () => {
    const base = withInPlay(start(), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const minion = minionOf(base, "Blockbuster");
    const o = villainPhase(base, { choose: "Give Blockbuster" });
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P1);
    expect(status(o.state, minion, "tough")).toBe(1);
    expect(expectAttack(o, "Blockbuster", minion, 0).targetInstanceId).toBe(cat);
  });

  it("two players: each Blockbuster gives himself a tough card, or +2 ATK, by the choice of the player he attacks", () => {
    const base = start([SPIDER_MAN, CAPTAIN_MARVEL], ["Harpoon", "Blockbuster"]);
    const minion = minionOf(base, "Blockbuster");
    const o = villainPhase(base, [{ choose: "Harpoon gets +2" }, { choose: "Blockbuster gets +2" }]);
    expect(o.offered.map((p) => p.player)).toEqual([P1, P2]);
    expect(status(o.state, minion, "tough")).toBe(0);
    const attack = expectAttack(o, "Blockbuster", minion, 2);
    expect(attack.targetInstanceId).toBe(identityOf(o.state, P2));
    expect(damage(o.state, identityOf(o.state, P2))).toBe(4);
  });
});

describe("Chimera (40096)", () => {
  const start = (players?: readonly Seat[], minions: readonly string[] = ["Chimera"]) =>
    game({ players: players ?? [SPIDER_MAN], minions });

  it("40096.chimera-forced-interrupt: spending a [mental] resource discards that card and leaves ATK at 1", () => {
    const base = withHand(start(), P1, MENTAL_2);
    const spent = findByName(base, P1, "Enhanced Spider-Sense");
    const o = villainPhase(base, { choose: "Spend", pay: ["Enhanced Spider-Sense"] });
    expect(o.offered.map((p) => p.labels)).toEqual(
      ONLY(["Spend a [mental] resource", "Chimera gets +2 ATK for this attack"]),
    );
    expect(playerOf(o.state, P1).discard).toEqual([spent]);
    expect(playerOf(o.state, P1).hand).toHaveLength(4);
    expectAttack(o, "Chimera", minionOf(base, "Chimera"), 0);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(1);
  });

  it("the other option is +2 ATK (3) and costs nothing", () => {
    const base = withHand(start(), P1, MENTAL_2);
    const o = villainPhase(base, { choose: "Chimera gets +2" });
    expect(playerOf(o.state, P1).discard).toEqual([]);
    expect(playerOf(o.state, P1).hand).toHaveLength(5);
    expectAttack(o, "Chimera", minionOf(base, "Chimera"), 2);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(3);
  });

  it("no [mental] resource in hand: the spend option is not offered and +2 ATK is forced (Q8)", () => {
    const base = withHand(start(), P1, NO_MENTAL);
    const o = villainPhase(base, { choose: "Spend" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Chimera gets +2 ATK for this attack"]);
    expect(playerOf(o.state, P1).hand).toHaveLength(5);
    expectAttack(o, "Chimera", minionOf(base, "Chimera"), 2);
  });

  it("an attack on an ally: the ally's controller chooses and pays (Q5)", () => {
    const base = withInPlay(withHand(start(), P1, MENTAL_2), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const o = villainPhase(base, { choose: "Spend", pay: ["Enhanced Spider-Sense"] });
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P1);
    expect(playerOf(o.state, P1).discard).toHaveLength(1);
    expect(expectAttack(o, "Chimera", minionOf(base, "Chimera"), 0).targetInstanceId).toBe(cat);
  });

  it("two players: each attacked player pays from their own hand; one without a [mental] resource is forced to +2 ATK", () => {
    let base = start([SPIDER_MAN, CAPTAIN_MARVEL], ["Harpoon", "Chimera"]);
    base = withNoMentalHand(withHand(base, P1, MENTAL_2), P2);
    const o = villainPhase(base, [{ choose: "Harpoon gets +2" }, { choose: "Spend", pay: ["Make the Call"] }]);
    expect(o.offered.map((p) => p.player)).toEqual([P1]);
    const attack = expectAttack(o, "Chimera", minionOf(base, "Chimera"), 2);
    expect(attack.targetInstanceId).toBe(identityOf(o.state, P2));
    expect(playerOf(o.state, P2).discard).toEqual([]);
    expect(playerOf(o.state, P1).discard).toEqual([]);
  });

  it("two players: the attacked player with [mental] resources pays and Chimera stays at ATK 1", () => {
    let base = start([SPIDER_MAN, CAPTAIN_MARVEL], ["Harpoon", "Chimera"]);
    base = withHand(withHand(base, P1, NO_MENTAL), P2, CM_MENTAL_2);
    const paid = findByName(base, P2, "Make the Call");
    const o = villainPhase(base, [{ choose: "Harpoon gets +2" }, { choose: "Spend", pay: ["Make the Call"] }]);
    expect(playerOf(o.state, P2).discard).toEqual([paid]);
    expectAttack(o, "Chimera", minionOf(base, "Chimera"), 0);
  });
});

describe("Greycrow (40097)", () => {
  const start = (players?: readonly Seat[], minions: readonly string[] = ["Greycrow"]) =>
    game({ players: players ?? [SPIDER_MAN], minions });
  // Spider-Man's deck: Nick Fury and Daredevil cost 4, Helicarrier 3, Black Cat 2 (printed; not used here, the double redirects to her).
  const CARDS = ["Nick Fury", "Daredevil", "Helicarrier"] as const;

  it("40097.greycrow-forced-interrupt: discards the highest-cost card (a tie is the player's pick) and ATK stays 1", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, CARDS);
    const fury = findByName(base, P1, "Nick Fury");
    const o = villainPhase(base, { choose: "Discard the highest", pick: "Daredevil" });
    expect(o.offered.map((p) => p.labels)).toEqual(
      ONLY(["Discard the highest-cost card you control", "Greycrow gets +X ATK for this attack"]),
    );
    expect(playerOf(o.state, P1).discard).toEqual([findByName(base, P1, "Daredevil")]);
    expect(playerOf(o.state, P1).playArea).toContain(fury);
    expectAttack(o, "Greycrow", minionOf(base, "Greycrow"), 0);
  });

  it("the other option is +X ATK where X is the printed cost of the highest-cost card (4): ATK 5, nothing discarded", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, CARDS);
    const o = villainPhase(base, { choose: "Greycrow gets +X" });
    expect(playerOf(o.state, P1).discard).toEqual([]);
    expectAttack(o, "Greycrow", minionOf(base, "Greycrow"), 4);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(5);
  });

  it("a single highest-cost card is discarded without a pick (Helicarrier, cost 3)", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, ["Helicarrier", "Black Cat"]);
    const o = villainPhase(base, { choose: "Discard the highest" });
    expect(playerOf(o.state, P1).discard).toEqual([findByName(base, P1, "Helicarrier")]);
    expectAttack(o, "Greycrow", minionOf(base, "Greycrow"), 0);
  });

  it("no card with a cost in play: the discard is not offered and +X ATK is forced with X = 0 (Q8)", () => {
    const base = withHand(start(), P1, NO_MENTAL);
    const o = villainPhase(base, { choose: "Discard" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Greycrow gets +X ATK for this attack"]);
    expectAttack(o, "Greycrow", minionOf(base, "Greycrow"), 0);
  });

  it("an attack on an ally: the ally's controller chooses (Q5); X counts the ally's own printed cost (2)", () => {
    const base = withInPlay(withHand(start(), P1, NO_MENTAL), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const o = villainPhase(base, { choose: "Greycrow gets +X" });
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P1);
    const attack = expectAttack(o, "Greycrow", minionOf(base, "Greycrow"), 2);
    expect(attack.targetInstanceId).toBe(cat);
  });

  it("two players: each player reads only the cards they control", () => {
    let base = start([SPIDER_MAN, CAPTAIN_MARVEL], ["Harpoon", "Greycrow"]);
    base = withInPlay(withHand(base, P1, NO_MENTAL), P1, ["Nick Fury"]);
    base = withNoMentalHand(base, P2);
    const o = villainPhase(base, [{ choose: "Harpoon gets +2" }, { choose: "Discard" }]);
    // P2 controls nothing with a cost, so the discard is not offered to them and +X is 0.
    expect(o.offered.map((p) => p.player)).toEqual([P1]);
    const attack = expectAttack(o, "Greycrow", minionOf(base, "Greycrow"), 0);
    expect(attack.targetInstanceId).toBe(identityOf(o.state, P2));
    expect(playerOf(o.state, P1).playArea).toContain(findByName(base, P1, "Nick Fury"));
  });
});

describe("Harpoon (40098)", () => {
  const start = (players?: readonly Seat[], minions: readonly string[] = ["Harpoon"]) =>
    game({ players: players ?? [SPIDER_MAN], minions });

  it("40098.harpoon-forced-interrupt: 2 indirect damage, and ATK stays 2 (4 damage to a lone hero)", () => {
    const base = start();
    const o = villainPhase(base, { choose: "Take 2 indirect" });
    expect(o.offered.map((p) => p.labels)).toEqual(
      ONLY(["Take 2 indirect damage", "Harpoon gets +2 ATK for this attack and this attack gains piercing"]),
    );
    expectAttack(o, "Harpoon", minionOf(base, "Harpoon"), 0);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(4);
  });

  it("the other option is +2 ATK (4) and piercing: piercing discards a tough status card before the damage, so all of it is dealt, with no indirect damage", () => {
    const first = start();
    const base = withStatus(first, identityOf(first, P1), "tough");
    const o = villainPhase(base, { choose: "Harpoon gets +2" });
    expectAttack(o, "Harpoon", minionOf(base, "Harpoon"), 2);
    // Piercing discards the tough status card before the damage is dealt (RRG "Piercing"): all 4 reach the hero.
    expect(damage(o.state, identityOf(o.state, P1))).toBe(4);
    expect(status(o.state, identityOf(o.state, P1), "tough")).toBe(0);
  });

  it("an attack on an ally: its controller chooses (Q5) and takes the indirect damage", () => {
    const base = withInPlay(start(), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const o = villainPhase(base, { choose: "Harpoon gets +2" });
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P1);
    expect(expectAttack(o, "Harpoon", minionOf(base, "Harpoon"), 2).targetInstanceId).toBe(cat);
    expect(playerOf(o.state, P1).discard).toContain(cat);
  });

  it("two players: each attacked player chooses; the indirect damage is the attacked player's own", () => {
    const base = start([SPIDER_MAN, CAPTAIN_MARVEL], ["Arclight", "Harpoon"]);
    const o = villainPhase(base, [{ choose: "Arclight gets +2" }, { choose: "Take 2 indirect" }]);
    expect(o.offered.map((p) => p.player)).toEqual([P1, P2]);
    expectAttack(o, "Harpoon", minionOf(base, "Harpoon"), 0);
    expect(damage(o.state, identityOf(o.state, P2))).toBe(4);
    // P1 took Arclight's ATK 3 only.
    expect(damage(o.state, identityOf(o.state, P1))).toBe(3);
  });
});

describe("Riptide (40099)", () => {
  const start = (players?: readonly Seat[], minions: readonly string[] = ["Riptide"]) =>
    game({ players: players ?? [SPIDER_MAN], minions });
  /** Two side schemes in play (3 threat each): the scenario's own Bushwhack (40108) and Pure Force (40109). */
  const withSideSchemes = (state: GameState) => {
    const a = encounterCardInVillainArea(state, "40108", 3);
    const b = encounterCardInVillainArea(a.state, "40109", 3);
    return { state: b.state, ids: [a.id, b.id] as const };
  };
  const placed = (o: Outcome, minion: InstanceId, scheme: InstanceId) =>
    threatBy(o, minion)
      .filter((e) => e.schemeInstanceId === scheme)
      .map((e) => e.amount);

  it("40099.riptide-forced-interrupt: 2 threat on the main scheme and 1 on each side scheme, ATK stays 1", () => {
    const { state, ids } = withSideSchemes(start());
    const riptide = minionOf(state, "Riptide");
    const o = villainPhase(state, { choose: "Place 2 threat" });
    expect(o.offered.map((p) => p.labels)).toEqual(
      ONLY([
        "Place 2 threat on the main scheme and 1 threat on each side scheme",
        "Riptide gets +2 ATK for this attack",
      ]),
    );
    expect(placed(o, riptide, o.state.mainScheme.instanceId)).toEqual([2]);
    expect(ids.map((id) => placed(o, riptide, id))).toEqual([[1], [1]]);
    expect(threatBy(o, riptide)).toHaveLength(3);
    expectAttack(o, "Riptide", riptide, 0);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(1);
  });

  it("with no side scheme only the main scheme takes the 2 threat", () => {
    const base = start();
    const riptide = minionOf(base, "Riptide");
    const o = villainPhase(base, { choose: "Place 2 threat" });
    expect(threatBy(o, riptide).map((e) => [e.schemeInstanceId, e.amount])).toEqual([
      [o.state.mainScheme.instanceId, 2],
    ]);
  });

  it("the other option is +2 ATK (3) and places no threat", () => {
    const { state } = withSideSchemes(start());
    const riptide = minionOf(state, "Riptide");
    const o = villainPhase(state, { choose: "Riptide gets +2" });
    expect(threatBy(o, riptide)).toEqual([]);
    expectAttack(o, "Riptide", riptide, 2);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(3);
  });

  it("an attack on an ally: its controller chooses (Q5) and the threat goes on the main scheme", () => {
    const base = withInPlay(start(), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const riptide = minionOf(base, "Riptide");
    const o = villainPhase(base, { choose: "Place 2 threat" });
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P1);
    expect(placed(o, riptide, o.state.mainScheme.instanceId)).toEqual([2]);
    expect(expectAttack(o, "Riptide", riptide, 0).targetInstanceId).toBe(cat);
  });

  it("two players: the same threat for the attacked player's choice, once each", () => {
    const { state, ids } = withSideSchemes(start([SPIDER_MAN, CAPTAIN_MARVEL], ["Harpoon", "Riptide"]));
    const riptide = minionOf(state, "Riptide");
    const o = villainPhase(state, [{ choose: "Harpoon gets +2" }, { choose: "Place 2 threat" }]);
    expect(o.offered.map((p) => p.player)).toEqual([P1, P2]);
    expect(placed(o, riptide, o.state.mainScheme.instanceId)).toEqual([2]);
    expect(ids.map((id) => placed(o, riptide, id))).toEqual([[1], [1]]);
    expect(expectAttack(o, "Riptide", riptide, 0).targetInstanceId).toBe(identityOf(o.state, P2));
  });
});

describe("Vertigo (40100)", () => {
  const start = (players?: readonly Seat[], minions: readonly string[] = ["Vertigo"]) =>
    game({ players: players ?? [SPIDER_MAN], minions });

  it("40100.vertigo-forced-interrupt: stunning a character you control leaves ATK at 0", () => {
    const base = start();
    const vertigo = minionOf(base, "Vertigo");
    const o = villainPhase(base, { choose: "Stun" });
    expect(o.offered.map((p) => p.labels)).toEqual(
      ONLY(["Stun a character you control", "Vertigo gets +2 ATK for this attack"]),
    );
    expectAttack(o, "Vertigo", vertigo, 0);
    expect(status(o.state, identityOf(o.state, P1), "stunned")).toBe(1);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(0);
  });

  it("the other option is +2 ATK (2) and stuns nobody", () => {
    const base = start();
    const o = villainPhase(base, { choose: "Vertigo gets +2" });
    expectAttack(o, "Vertigo", minionOf(base, "Vertigo"), 2);
    expect(status(o.state, identityOf(o.state, P1), "stunned")).toBe(0);
    expect(damage(o.state, identityOf(o.state, P1))).toBe(2);
  });

  it("every character already stunned: the stun option is not offered and +2 ATK is forced (Q8)", () => {
    const first = start();
    const base = withStatus(first, identityOf(first, P1), "stunned");
    const o = villainPhase(base, { choose: "Stun" });
    expect(o.offered).toEqual([]);
    expect(o.resolved).toEqual(["Vertigo gets +2 ATK for this attack"]);
    expectAttack(o, "Vertigo", minionOf(base, "Vertigo"), 2);
  });

  it("an attack on an ally: the ally's controller chooses (Q5) and may stun the ally", () => {
    const base = withInPlay(start(), P1, ["Black Cat"]);
    const cat = findByName(base, P1, "Black Cat");
    const o = villainPhase(base, { choose: "Stun", pick: "Black Cat" });
    expect(o.offered).toHaveLength(1);
    expect(o.offered[0]!.player).toBe(P1);
    expect(status(o.state, cat, "stunned")).toBe(1);
    expect(expectAttack(o, "Vertigo", minionOf(base, "Vertigo"), 0).targetInstanceId).toBe(cat);
  });

  it("two players: each attacked player chooses; the one with every character stunned is forced to +2 ATK", () => {
    const first = start([SPIDER_MAN, CAPTAIN_MARVEL], ["Harpoon", "Vertigo"]);
    const base = withStatus(first, identityOf(first, P2), "stunned");
    const o = villainPhase(base, [{ choose: "Harpoon gets +2" }, { choose: "Stun" }]);
    expect(o.offered.map((p) => p.player)).toEqual([P1]);
    const attack = expectAttack(o, "Vertigo", minionOf(base, "Vertigo"), 2);
    expect(attack.targetInstanceId).toBe(identityOf(o.state, P2));
  });
});

describe("Mutant Slayers (40101)", () => {
  const quickstrike = (s: GameState, id: InstanceId) => hasKeyword(s, id, "quickstrike", WAVE7_DEPS);

  it("40101.mutant-slayers-constant: each Marauder minion has quickstrike while the side scheme is in play, the villain does not", () => {
    const base = game({ players: [SPIDER_MAN, CAPTAIN_MARVEL], minions: ["Harpoon", "Riptide"] });
    const [harpoon, riptide] = [minionOf(base, "Harpoon"), minionOf(base, "Riptide")];
    const villain = activeVillain(base).instanceId;
    for (const id of [harpoon, riptide, villain]) expect(quickstrike(base, id)).toBe(false);
    const { state } = encounterCardInVillainArea(base, "40101", 3);
    expect(quickstrike(state, harpoon)).toBe(true);
    expect(quickstrike(state, riptide)).toBe(true);
    expect(quickstrike(state, villain)).toBe(false);
  });

  /** The side scheme is dealt to the player in the villain phase; `players` are the heroes in play. */
  const reveal = (players: readonly Seat[]) => {
    const base = game({ players, minions: players.map((_, i) => ["Harpoon", "Riptide"][i]!) });
    const o = villainPhase(base, {}, ["40101", ...(players.length > 1 ? ["01186", "01187"] : [])]);
    const id = Object.keys(o.state.instances).find((i) => o.state.instances[i as InstanceId]!.cardId === "40101")!;
    return inst(o.state, id as InstanceId);
  };

  it("40101.when-revealed: 3 threat and 1 more for each character with a listed trait (none with Spider-Man)", () => {
    expect(reveal([SPIDER_MAN]).threat).toBe(3);
  });

  it("an X-Force hero adds 1 (Cable)", () => {
    expect(reveal([CABLE]).threat).toBe(4);
  });

  it("two players, two X-Force heroes: 2 more", () => {
    expect(reveal([CABLE, DOMINO]).threat).toBe(5);
  });

  it("two players, one X-Force hero among them: 1 more", () => {
    expect(reveal([SPIDER_MAN, DOMINO]).threat).toBe(4);
  });
});

describe("Bound by Business (40102)", () => {
  /** The encounter deck's top cards are these (in order, after the villain's boost card), then Advance and Assault. */
  const run = (state: GameState, top: readonly string[]) =>
    villainPhase(state, {}, ["40102", ...top, "01186", "01187"]);
  const pileOf = (s: GameState) => Object.values(s.encounterDecks)[0]!;

  it("40102.when-revealed: discards cards until a Marauder minion, which is put into play engaged with you", () => {
    const base = game({ minions: ["Harpoon"] });
    const o = run(base, ["01188", "40099"]);
    const names = engaged(o.state, P1).map((id) => nameOf(o.state, id));
    expect(names.sort()).toEqual(["Harpoon", "Riptide"]);
    const riptide = minionOf(o.state, "Riptide");
    expect(inst(o.state, riptide).engagedWith).toBe(P1);
    // Caught Off Guard was discarded on the way, Riptide is not in the discard pile.
    const discarded = pileOf(o.state).discard.map((id) => nameOf(o.state, id));
    expect(discarded).toContain("Caught Off Guard");
    expect(discarded).not.toContain("Riptide");
  });

  it("a Marauder minion sharing a title with a card in play is discarded and the search goes on", () => {
    // Blockbuster the minion was removed from the game at setup (the villain is Blockbuster). Put it back on the deck:
    // it shares a title with the villain in play, so it is discarded and Vertigo is the one put into play.
    const base = game({ minions: ["Harpoon"] });
    const removed = base.removedFromGame.find(
      (id) => nameOf(base, id) === "Blockbuster" && base.cardPool[base.instances[id]!.cardId]!.type === "minion",
    );
    expect(removed).toBeDefined();
    const deckId = Object.keys(base.encounterDecks)[0]!;
    const pile = base.encounterDecks[deckId]!;
    const returned: GameState = {
      ...base,
      removedFromGame: base.removedFromGame.filter((id) => id !== removed),
      encounterDecks: { ...base.encounterDecks, [deckId]: { ...pile, deck: [removed!, ...pile.deck] } },
    };
    const o = run(returned, ["40095", "40100"]);
    const names = engaged(o.state, P1).map((id) => nameOf(o.state, id));
    expect(names.sort()).toEqual(["Harpoon", "Vertigo"]);
    expect(pileOf(o.state).discard).toContain(removed);
  });

  it("two players: the minion is engaged with the player who revealed it, not with the other", () => {
    const base = game({ players: [SPIDER_MAN, CAPTAIN_MARVEL], minions: ["Harpoon", "Arclight"] });
    const o = // Both players are dealt a card before either is revealed: P1 gets Bound by Business, P2 gets Advance (whose boost
      // card is the Assault below the minion).
      villainPhase(base, {}, ["40102", "01186", "40099", "01187"]);
    const riptide = minionOf(o.state, "Riptide");
    expect(inst(o.state, riptide).engagedWith).toBe(P1);
    expect(engaged(o.state, P2).map((id) => nameOf(o.state, id))).toEqual(["Arclight"]);
  });
});
