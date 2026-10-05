import {
  activeVillain,
  createGame,
  hasKeyword,
  iconsOn,
  maxHitPoints,
  remainingHitPoints,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  dealDamage,
  each,
  enemyAttack,
  forcedInterrupt,
  modifyAttack,
  on,
  query,
  theVillain,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { attachToHost } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_ABILITIES, WAVE7_DEPS, wave7Scenario } from "../index.js";
import { ON_THE_RUN } from "./on-the-run.js";

vi.setConfig({ testTimeout: 120_000 });

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const ONE = [SPIDER_MAN] as const;
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

/** Standard-set boost cards that print no boost icon and no Boost ability, so a villain phase adds exactly its stat. */
const BLANK_BOOSTS = ["01186", "01186", "01187", "01187", "01186", "01187"] as const;

interface Opts {
  readonly players?: Seats;
  readonly expert?: boolean;
  /** The printed number of the starting villain (40071 = Blockbuster ...): the first seed that draws it. */
  readonly villain?: string;
  readonly seed?: number;
  readonly modular?: readonly string[];
  /** Names of the minions each player takes at 1B's search, in player order (the first offered otherwise). */
  readonly minions?: readonly string[];
}

/** On the Run, past setup (every player's search at 1B answered by `opts.minions` when it can be). */
function game(opts: Opts = {}): GameState {
  const tries = opts.seed ? [opts.seed] : Array.from({ length: 399 }, (_, i) => i + 1);
  for (const seed of tries) {
    const config = wave7Scenario("on-the-run", {
      players: opts.players ?? ONE,
      seed,
      difficulty: opts.expert ? "expert" : "standard",
      modularSetIds: opts.modular ?? [],
    });
    const created = createGame(config, WAVE7_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const id = created.state.instances[activeVillain(created.state).instanceId]!.cardId as string;
    if (opts.villain && !id.startsWith(opts.villain)) continue;
    const wanted = [...(opts.minions ?? [])];
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice!;
      const name = wanted[0];
      const hit = name ? choice.options.find((o) => o.label === name) : undefined;
      if (hit) {
        wanted.shift();
        return [hit.optionId];
      }
      return firstLegal(s);
    };
    return settle(created.state, pick, (s) => s.step.phase === "player", WAVE7_DEPS);
  }
  throw new Error(`no seed starts On the Run with ${opts.villain}`);
}
/** Blockbuster (printed SCH 0) in play: the villain phase adds no threat of its own. */
const blockbuster = (opts: Opts = {}) => game({ ...opts, villain: "40071" });

const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const cardOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const mainOf = (s: GameState) => s.mainScheme.instanceId;
const villainId = (s: GameState) => activeVillain(s).instanceId;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const deckNames = (s: GameState) => piles(s).deck.map((id) => nameOf(s, id));
const discardNames = (s: GameState) => piles(s).discard.map((id) => nameOf(s, id));
const captorOf = (s: GameState) =>
  villainId(s) && inst(s, villainId(s)).attachments.find((id) => nameOf(s, id) === "Hope's Captor");
const minionsEngaged = (s: GameState, player: PlayerId) =>
  s.players
    .find((p) => p.playerId === player)!
    .playArea.filter((id) => s.cardPool[s.instances[id]!.cardId]!.type === "minion");
const allMinions = (s: GameState) => s.players.flatMap((p) => minionsEngaged(s, p.playerId));
const minionNames = (s: GameState, player: PlayerId) => minionsEngaged(s, player).map((id) => nameOf(s, id));
const keyword = (s: GameState, id: InstanceId, name: "steady" | "guard") => hasKeyword(s, id, name, WAVE7_DEPS);
const hpMax = (s: GameState, id: InstanceId) => maxHitPoints(s, id, WAVE7_DEPS);
const threat = (s: GameState, id: InstanceId) => inst(s, id).threat;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

interface Plan {
  /** The label (start) of the option to take at a `chooseOption` prompt; the first one otherwise. */
  readonly choose?: string;
  /** Labels to pick at a card or target prompt, in order; the first offered otherwise. */
  readonly pick?: readonly string[];
  /** Labels of the optional abilities to trigger at a `chooseTriggers` prompt; none are otherwise. */
  readonly accept?: readonly string[];
  /** The character that defends; nobody otherwise. */
  readonly defender?: InstanceId;
}
interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly prompts: readonly { readonly kind: string; readonly player: PlayerId; readonly labels: readonly string[] }[];
}
function drive(state: GameState, plan: Plan, ...commands: Parameters<typeof driveEventsPicking>[3][]): Run {
  return driveWith(WAVE7_DEPS, state, plan, ...commands);
}
function driveWith(
  deps: typeof WAVE7_DEPS,
  state: GameState,
  plan: Plan,
  ...commands: Parameters<typeof driveEventsPicking>[3][]
): Run {
  const prompts: { kind: string; player: PlayerId; labels: readonly string[] }[] = [];
  const picks = [...(plan.pick ?? [])];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    prompts.push({ kind: choice.prompt.kind, player: choice.playerId, labels: choice.options.map((o) => o.label) });
    switch (choice.prompt.kind) {
      case "chooseOption": {
        const hit = choice.options.find((o) => (plan.choose ? o.label.startsWith(plan.choose) : true));
        return [(hit ?? choice.options[0]!).optionId];
      }
      case "chooseTriggers":
        return choice.options.filter((o) => plan.accept?.includes(o.label)).map((o) => o.optionId);
      case "declareDefender":
        return [plan.defender && choice.options.some((o) => o.optionId === plan.defender) ? plan.defender : "decline"];
      default: {
        const name = picks[0];
        const hit = name ? choice.options.find((o) => o.label === name) : undefined;
        if (hit) {
          picks.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
  const { state: after, events: log } = driveEventsPicking(deps, state, pick, ...commands);
  return { state: after, events: log, prompts };
}
/**
 * Every player ends their turn in hero form (alter-ego with `alterEgo`), and the villain phase runs. The encounter deck
 * is stacked: blank boost cards for every activation, then `reveals` for the cards the players are dealt.
 */
function round(
  state: GameState,
  opts: {
    boosts?: number;
    reveals?: readonly string[];
    alterEgo?: boolean;
    plan?: Plan;
    deps?: typeof WAVE7_DEPS;
  } = {},
): Run {
  const stacked = stackEncounterDeck(
    state,
    ...BLANK_BOOSTS.slice(0, opts.boosts ?? state.players.length),
    ...(opts.reveals ?? []),
  );
  const order =
    state.step.phase === "player" && state.step.kind === "turn"
      ? [state.step.activePlayerId, ...state.step.remainingPlayerIds]
      : state.players.map((p) => p.playerId);
  const commands = order.flatMap((id) => [...(opts.alterEgo ? [] : [toHero(id)]), endTurn(id)]);
  return driveWith(opts.deps ?? WAVE7_DEPS, stacked, opts.plan ?? {}, ...commands);
}
/** The first player's hero defeats the villain with a basic attack (the villain dealt lethal damage first, surgery). */
function defeatVillain(start: GameState, opts: { clearMinions?: boolean } = {}): Run {
  const state = opts.clearMinions ? start.players.reduce((s, p) => withoutMinions(s, p.playerId), start) : start;
  const extraDamage = 999;
  const target = villainId(state);
  const attacker = state.players[0]!.playerId;
  const clear = { stunned: 0, confused: 0, tough: 0 };
  const armed = patchInstance(
    patchInstance(
      state.players.reduce((s, p) => withForm(s, { heroForm: 0 }, p.playerId), state),
      target,
      { damage: extraDamage, statuses: { ...inst(state, target).statuses, tough: 0 } },
    ),
    identityOf(state, attacker),
    { statuses: clear, exhausted: false, damage: 0 },
  );
  return drive(
    armed,
    {},
    {
      type: "basicAttack",
      playerId: attacker,
      attackerInstanceId: identityOf(armed, attacker),
      targetInstanceId: target,
    },
  );
}

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(ON_THE_RUN).sort()).toEqual(
      [
        "40103a.setup",
        "40103b.gotta-get-away-constant",
        "40103b.when-revealed",
        "40104a.when-revealed",
        "40104b.escaping-with-hope-constant",
        "40104b.escaping-with-hope-constant-2",
        "40105a.hopes-captor-forced-interrupt",
        "40105a.hopes-captor-forced-interrupt-2",
        "40105b.hopes-captor-constant",
        "40105b.when-revealed",
        "40105b.hopes-captor-forced-interrupt",
        "40106.hidden-in-the-clutter-forced-interrupt",
        "40107.favored-weapon-constant",
        "40107.favored-weapon-response",
        "40108.when-defeated",
        "40109.pure-force-constant",
        "40109.pure-force-constant-2",
        "40110.when-revealed",
        "40111.when-revealed",
      ].sort(),
    );
  });
});

describe("40103a.setup: one random Marauder, the rest removed, Hope's Captor attached", () => {
  it("1 player: one villain in play on its standard face, Hope's Captor attached faceup on its CONFIDENT side", () => {
    const s = game();
    expect(s.cardPool[s.instances[villainId(s)]!.cardId]!.type).toBe("villain");
    expect(cardOf(s, villainId(s))).toMatch(/^4007[0-6]a$/);
    const captor = captorOf(s)!;
    expect(captor).toBeDefined();
    expect(cardOf(s, captor)).toBe("40105a");
    expect(inst(s, captor).faceup).toBe(true);
    expect(inst(s, captor).flipped).toBe(false);
    expect(inst(s, villainId(s)).attachments).toEqual([captor]);
    expect(s.encounterSetAside.map((id) => cardOf(s, id))).not.toContain("40105a");
    expect(inst(s, villainId(s)).damage).toBe(0);
    expect(s.mainScheme.stageIndex).toBe(0);
    // Gotta Get Away starts with 1 threat per player.
    expect(threat(s, mainOf(s))).toBe(1);
  });

  it("removes each other villain and the minion that shares the villain's title from the game", () => {
    const s = game({ villain: "40072" });
    expect(nameOf(s, villainId(s))).toBe("Chimera");
    const removed = s.removedFromGame.map((id) => cardOf(s, id)).sort();
    expect(removed).toEqual(["40070a", "40071a", "40073a", "40074a", "40075a", "40076a", "40096"].sort());
    // Not set aside, not in the deck: gone.
    expect(s.encounterSetAside.filter((id) => s.cardPool[s.instances[id]!.cardId]!.type === "villain")).toEqual([]);
    const names = [...deckNames(s), ...discardNames(s), ...allMinions(s).map((id) => nameOf(s, id))];
    expect(names).not.toContain("Chimera");
    // The other Marauder minions stay in the game.
    expect(
      names.filter((n) => ["Arclight", "Blockbuster", "Greycrow", "Harpoon", "Riptide", "Vertigo"].includes(n)),
    ).toHaveLength(6);
  });

  it("every villain can start, and the villain's title never has a minion in the game (24 seeds)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 24; seed++) {
      const s = game({ seed });
      const title = nameOf(s, villainId(s));
      seen.add(title);
      const everyone = [...deckNames(s), ...discardNames(s), ...allMinions(s).map((id) => nameOf(s, id))];
      expect(everyone, `seed ${seed}`).not.toContain(title);
      expect(s.removedFromGame.filter((id) => s.cardPool[s.instances[id]!.cardId]!.type === "villain")).toHaveLength(6);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it("expert mode starts the B face of a Marauder", () => {
    const s = game({ expert: true });
    expect(cardOf(s, villainId(s))).toMatch(/^4007[0-6]b$/);
    expect(cardOf(s, captorOf(s)!)).toBe("40105a");
  });

  it("2 players: the villain's hit points scale with the players", () => {
    const one = blockbuster();
    const two = blockbuster({ players: TWO });
    expect(hpMax(two, villainId(two))! - hpMax(one, villainId(one))!).toBeGreaterThan(0);
  });
});

describe("Gotta Get Away 1B (40103b)", () => {
  it("40103b.when-revealed: 1 player searches the encounter deck for a Marauder minion engaged with them", () => {
    const s = blockbuster({ minions: ["Harpoon"] });
    expect(minionNames(s, P1)).toEqual(["Harpoon"]);
    expect(deckNames(s)).not.toContain("Harpoon");
    expect(s.mainScheme.stageIndex).toBe(0);
  });

  it("2 players: each player gets a Marauder minion of their own choice, engaged with them", () => {
    const s = blockbuster({ players: TWO, minions: ["Riptide", "Vertigo"] });
    expect(minionNames(s, P1)).toEqual(["Riptide"]);
    expect(minionNames(s, P2)).toEqual(["Vertigo"]);
    expect(allMinions(s).map((id) => inst(s, id).engagedWith)).toEqual([P1, P2]);
    expect(threat(s, mainOf(s))).toBe(2);
  });

  it("only the encounter deck is searched at 1B, so a Marauder in the discard pile is not found", () => {
    const s = blockbuster({ minions: ["Riptide"] });
    expect(minionNames(s, P1)).toEqual(["Riptide"]);
    expect(discardNames(s)).toEqual([]);
  });

  it("40103b.gotta-get-away-constant: each Marauder minion has steady, the villain does not", () => {
    const s = blockbuster({ minions: ["Greycrow"] });
    const [minion] = minionsEngaged(s, P1);
    expect(keyword(s, minion!, "steady")).toBe(true);
    expect(keyword(s, minion!, "guard")).toBe(false);
    expect(keyword(s, villainId(s), "steady")).toBe(false);
  });

  it("completing stage 1 loses the game: the players do not reach 2A", () => {
    const base = blockbuster();
    const run = round(patchInstance(base, mainOf(base), { threat: 99 }));
    expect(run.state.outcome).toMatchObject({ result: "loss" });
    expect(run.state.mainScheme.stageIndex).toBe(0);
  });
});

const ARCLIGHT = "40070"; // ATK 1, SCH 1, 10 hit points per player on the standard face
/** The enemy's results this log shows. */
const resolved = (log: readonly GameEvent[], kind: "attackResolved" | "schemeResolved", enemy: InstanceId) =>
  log.filter((e) => e.type === kind && (e as { enemyInstanceId?: InstanceId }).enemyInstanceId === enemy);
/** `player`'s engaged Marauder minions go to the encounter discard pile (surgery), so none is engaged with them. */
function withoutMinions(state: GameState, player: PlayerId): GameState {
  const gone = minionsEngaged(state, player);
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...gone] } },
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, playArea: p.playArea.filter((id) => !gone.includes(id)) } : p,
    ),
    instances: {
      ...state.instances,
      ...Object.fromEntries(gone.map((id) => [id, { ...state.instances[id]!, engagedWith: null }])),
    },
  };
}

describe("Hope's Captor (40105a): 40105a.hopes-captor-forced-interrupt", () => {
  it("1 player in hero form with a Marauder minion engaged: the villain schemes instead of attacking", () => {
    const base = game({ villain: ARCLIGHT, minions: ["Harpoon"] });
    const villain = villainId(base);
    const run = round(base, { reveals: ["40109"] });
    expect(resolved(run.events, "schemeResolved", villain)).toHaveLength(1);
    expect(resolved(run.events, "attackResolved", villain)).toEqual([]);
    // 1 threat at the start, +1 acceleration at step 1, +1 for Arclight's SCH and a blank boost card.
    expect(threat(run.state, mainOf(base))).toBe(3);
  });

  it("without a Marauder minion engaged the villain attacks as printed", () => {
    const base = withoutMinions(game({ villain: ARCLIGHT }), P1);
    const villain = villainId(base);
    const run = round(base, { reveals: ["40109"] });
    expect(resolved(run.events, "attackResolved", villain)).toHaveLength(1);
    expect(resolved(run.events, "schemeResolved", villain)).toEqual([]);
    expect(threat(run.state, mainOf(base))).toBe(2);
    // Arclight ATK 1 and a blank boost: 1 damage to the hero.
    expect(inst(run.state, identityOf(run.state, P1)).damage).toBe(1);
  });

  it("2 players: only the player with a Marauder minion engaged is schemed against, the other is attacked", () => {
    const base = withoutMinions(game({ villain: ARCLIGHT, players: TWO }), P2);
    const villain = villainId(base);
    expect(minionNames(base, P1)).toHaveLength(1);
    expect(minionNames(base, P2)).toEqual([]);
    const run = round(base, { reveals: ["40109", "40108"] });
    expect(resolved(run.events, "schemeResolved", villain)).toHaveLength(1);
    expect(resolved(run.events, "attackResolved", villain)).toHaveLength(1);
    // 2 at the start, +2 acceleration, +1 for the one scheme.
    expect(threat(run.state, mainOf(base))).toBe(5);
    expect(inst(run.state, identityOf(run.state, P2)).damage).toBe(1);
  });

  it("2 players, each with a minion: the villain schemes against both", () => {
    const base = game({ villain: ARCLIGHT, players: TWO });
    const villain = villainId(base);
    const run = round(base, { reveals: ["40109", "40108"] });
    expect(resolved(run.events, "schemeResolved", villain)).toHaveLength(2);
    expect(resolved(run.events, "attackResolved", villain)).toEqual([]);
    expect(threat(run.state, mainOf(base))).toBe(6);
  });

  it("a player in alter-ego form is schemed against anyway (nothing to replace)", () => {
    const base = game({ villain: ARCLIGHT });
    const run = round(base, { alterEgo: true, reveals: ["40109"] });
    expect(resolved(run.events, "schemeResolved", villainId(base))).toHaveLength(1);
    expect(threat(run.state, mainOf(base))).toBe(3);
  });

  it("an attack a card makes is replaced as well, before any boost card is dealt (Q9 = A)", () => {
    // Dizzying Deeds' When Revealed is replaced for this test by "the villain attacks you".
    const deps = {
      abilities: {
        ...WAVE7_ABILITIES,
        "40110.when-revealed": whenRevealed(enemyAttack(theVillain, { against: you })),
      },
    };
    const base = game({ villain: ARCLIGHT });
    const villain = villainId(base);
    const run = round(base, { reveals: ["40110"], deps });
    // The villain's own phase attack, then the card-caused attack on the hero: each a scheme instead.
    expect(resolved(run.events, "attackResolved", villain)).toEqual([]);
    expect(resolved(run.events, "schemeResolved", villain)).toHaveLength(2);
    // Control: with no minion engaged the same card makes the villain attack.
    const free = round(withoutMinions(base, P1), { reveals: ["40110"], deps });
    expect(resolved(free.events, "attackResolved", villain)).toHaveLength(2);
  });
});

/** Minions without guard, so the hero may attack the villain at stage 1 (Greycrow, Riptide). */
const DEF1 = ["Greycrow"] as const;
const DEF2 = ["Greycrow", "Riptide"] as const;
/** The villain's printed hit points per player on the face in play, read from the card. */
const printedHp = (s: GameState, id: InstanceId) => {
  const card = s.cardPool[s.instances[id]!.cardId]!;
  if (card.type !== "villain") throw new Error("not a villain");
  return card.sides[0]!.stages[0]!.hp.perPlayer;
};
const toughOn = (s: GameState, id: InstanceId) => inst(s, id).statuses.tough;

describe("Hope's Captor (40105a): 40105a.hopes-captor-forced-interrupt-2, then 40105b", () => {
  it("1 player: the first defeat resets the villain's hit points, flips the card, +6 hit points, and advances to 2A", () => {
    const base = game({ villain: ARCLIGHT, minions: DEF1 });
    const villain = villainId(base);
    const captor = captorOf(base)!;
    const run = defeatVillain(base);
    const s = run.state;
    // The villain is not defeated: same card, undamaged (the excess damage is lost), still the active villain.
    expect(villainId(s)).toBe(villain);
    expect(cardOf(s, villain)).toBe("40070a");
    expect(inst(s, villain).damage).toBe(0);
    expect(s.outcome).toBeNull();
    expect(events(run.events, "characterDefeated")).toEqual([]);
    // Hope's Captor is on the villain, flipped to its DESPERATE side.
    expect(inst(s, villain).attachments).toContain(captor);
    expect(inst(s, captor).flipped).toBe(true);
    // +6 per hero raises the maximum and the dial together: 10 + 6.
    expect(hpMax(s, villain)).toBe(printedHp(s, villain) * 1 + 6);
    expect(remainingHitPoints(s, villain, WAVE7_DEPS)).toBe(16);
    // 1B -> 2A by advance, not by completion: the game goes on.
    expect(s.mainScheme.stageIndex).toBe(1);
    expect(events(run.events, "mainSchemeAdvanced")).toHaveLength(1);
  });

  it("the villain keeps its status cards and other attachments; only its hit points are reset", () => {
    const base = game({ villain: ARCLIGHT, minions: DEF1 });
    const villain = villainId(base);
    const { state: weapon, id } = attachToHost(base, "40107", villain);
    const run = defeatVillain(patchInstance(weapon, villain, { statuses: { stunned: 0, confused: 1, tough: 0 } }));
    expect(inst(run.state, villain).statuses.confused).toBe(1);
    expect(inst(run.state, villain).attachments).toContain(id);
    expect(inst(run.state, id).attachedTo).toBe(villain);
  });

  it("2 players: the hit points are 2 x printed + 12 after the flip", () => {
    const base = game({ villain: ARCLIGHT, players: TWO, minions: DEF2 });
    const villain = villainId(base);
    expect(hpMax(base, villain)).toBe(20);
    const s = defeatVillain(base).state;
    expect(hpMax(s, villain)).toBe(32);
    expect(remainingHitPoints(s, villain, WAVE7_DEPS)).toBe(32);
  });

  it("expert mode: the reset reads the B face's printed hit points (13 per player for Arclight)", () => {
    const base = game({ villain: ARCLIGHT, expert: true, minions: DEF1 });
    const villain = villainId(base);
    expect(hpMax(base, villain)).toBe(13);
    const s = defeatVillain(base).state;
    expect(hpMax(s, villain)).toBe(19);
    expect(remainingHitPoints(s, villain, WAVE7_DEPS)).toBe(19);
  });

  it("the second defeat is a real one and the players win the game (40104b.escaping-with-hope-constant-2)", () => {
    const base = game({ villain: ARCLIGHT, minions: DEF1 });
    const first = defeatVillain(base).state;
    expect(first.outcome).toBeNull();
    const second = defeatVillain(first, { clearMinions: true });
    expect(second.state.outcome).toMatchObject({ result: "win" });
    expect(events(second.events, "characterDefeated").length).toBeGreaterThan(0);
  });

  it("40105b.hopes-captor-forced-interrupt: the DESPERATE side still has the villain scheme instead", () => {
    const stage2 = defeatVillain(game({ villain: ARCLIGHT, minions: DEF1 })).state;
    const villain = villainId(stage2);
    expect(minionNames(stage2, P1).length).toBeGreaterThan(0);
    const run = round(stage2, { boosts: 1, reveals: ["40109"] });
    expect(resolved(run.events, "schemeResolved", villain).length).toBeGreaterThanOrEqual(1);
    expect(resolved(run.events, "attackResolved", villain)).toEqual([]);
  });
});

describe("Escaping with Hope 2A (40104a): 40104a.when-revealed", () => {
  it("1 player: searches the encounter deck and discard pile for a Marauder minion, engaged with them", () => {
    const base = game({ villain: ARCLIGHT, minions: DEF1 });
    const before = minionsEngaged(base, P1);
    const run = defeatVillain(base);
    const s = run.state;
    expect(minionsEngaged(s, P1)).toHaveLength(before.length + 1);
    for (const id of minionsEngaged(s, P1)) expect(inst(s, id).engagedWith).toBe(P1);
  });

  it("finds a Marauder in the encounter discard pile too", () => {
    const base = game({ villain: ARCLIGHT, minions: DEF1 });
    const deckId = Object.keys(base.encounterDecks)[0]!;
    const pile = base.encounterDecks[deckId]!;
    const onlyOne = pile.deck.filter((id) => nameOf(base, id) === "Vertigo");
    const staged: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: {
          deck: pile.deck.filter((id) => s_isNotMarauder(base, id)),
          discard: [...pile.discard, ...onlyOne],
        },
      },
    };
    expect(onlyOne).toHaveLength(1);
    const s = defeatVillain(staged).state;
    expect(minionNames(s, P1)).toContain("Vertigo");
    expect(discardNames(s)).not.toContain("Vertigo");
  });

  it("2 players: each player gets one", () => {
    const base = game({ villain: ARCLIGHT, players: TWO, minions: DEF2 });
    const s = defeatVillain(base).state;
    expect(minionsEngaged(s, P1)).toHaveLength(2);
    expect(minionsEngaged(s, P2)).toHaveLength(2);
  });

  it("gives each Marauder enemy, the villain and every minion in play, a tough status card", () => {
    const base = game({ villain: ARCLIGHT, players: TWO, minions: DEF2 });
    const s = defeatVillain(base).state;
    expect(toughOn(s, villainId(s))).toBe(1);
    expect(allMinions(s)).toHaveLength(4);
    for (const id of allMinions(s)) expect(toughOn(s, id), nameOf(s, id)).toBe(1);
  });
});
function s_isNotMarauder(s: GameState, id: InstanceId): boolean {
  const card = s.cardPool[s.instances[id]!.cardId]!;
  return card.type !== "minion";
}

describe("Escaping with Hope 2B (40104b): 40104b.escaping-with-hope-constant", () => {
  it("each Marauder minion has guard and steady, the villain has neither (standard)", () => {
    const s = defeatVillain(game({ villain: ARCLIGHT, minions: DEF1 })).state;
    expect(s.mainScheme.stageIndex).toBe(1);
    expect(allMinions(s).length).toBeGreaterThan(0);
    for (const id of allMinions(s)) {
      expect(keyword(s, id, "guard"), nameOf(s, id)).toBe(true);
      expect(keyword(s, id, "steady"), nameOf(s, id)).toBe(true);
    }
    expect(keyword(s, villainId(s), "steady")).toBe(false);
    expect(keyword(s, villainId(s), "guard")).toBe(false);
  });

  it("expert mode: the villain gains steady too", () => {
    const s = defeatVillain(game({ villain: ARCLIGHT, expert: true, minions: DEF1 })).state;
    expect(keyword(s, villainId(s), "steady")).toBe(true);
    expect(keyword(s, villainId(s), "guard")).toBe(false);
  });

  it("completing stage 2 loses the game", () => {
    const stage2 = defeatVillain(game({ villain: ARCLIGHT, minions: DEF1 })).state;
    const run = round(patchInstance(stage2, mainOf(stage2), { threat: 99 }), { reveals: ["40109"] });
    expect(run.state.outcome).toMatchObject({ result: "loss" });
  });
});

/** The one instance of `code` in the encounter deck or discard pile, or a minion/enemy in play. */
const instanceOfCode = (s: GameState, code: string): InstanceId => {
  const id = Object.keys(s.instances).find(
    (i) => s.instances[i as InstanceId]!.cardId === code && s.instances[i as InstanceId]!.attachedTo !== null,
  );
  if (!id) throw new Error(`no ${code}`);
  return id as InstanceId;
};
const heroOf = (s: GameState, p: PlayerId = P1) => identityOf(s, p);
const heroed = (s: GameState): GameState =>
  s.players.reduce(
    (cur, p) =>
      patchInstance(withForm(cur, { heroForm: 0 }, p.playerId), identityOf(cur, p.playerId), { exhausted: false }),
    s,
  );
const basicAttack = (s: GameState, attacker: PlayerId, target: InstanceId) =>
  ({
    type: "basicAttack",
    playerId: attacker,
    attackerInstanceId: identityOf(s, attacker),
    targetInstanceId: target,
  }) as const;
const inEncounterDiscard = (s: GameState, id: InstanceId) => piles(s).discard.includes(id);

describe("Hidden in the Clutter (40106)", () => {
  it("is attached to the enemy with the fewest remaining hit points when revealed (data host)", () => {
    const base = game({ villain: ARCLIGHT, minions: DEF1 });
    const run = round(base, { reveals: ["40106"] });
    const card = instanceOfCode(run.state, "40106");
    expect(inst(run.state, card).attachedTo).toBe(minionsEngaged(base, P1)[0]);
    // A villain closer to defeat than every minion is the host instead.
    const hurt = patchInstance(base, villainId(base), { damage: 9 });
    const second = round(hurt, { reveals: ["40106"] });
    expect(inst(second.state, instanceOfCode(second.state, "40106")).attachedTo).toBe(villainId(base));
  });

  describe("40106.hidden-in-the-clutter-forced-interrupt", () => {
    const setup = (players: Seats = ONE) => {
      const base = heroed(game({ villain: ARCLIGHT, players, minions: ["Riptide", "Riptide"] }));
      const riptide = minionsEngaged(base, P1)[0]!;
      const attached = attachToHost(base, "40106", riptide);
      return { ...attached, riptide, base };
    };

    it("under 3 damage: the damage is placed on the card instead, and the card stays", () => {
      const { state, id, riptide } = setup();
      const run = drive(state, {}, basicAttack(state, P1, riptide));
      expect(inst(run.state, riptide).damage).toBe(0);
      expect(inst(run.state, id).damage).toBe(2);
      expect(inst(run.state, id).attachedTo).toBe(riptide);
      expect(events(run.events, "damagePlaced").map((e) => e.amount)).toEqual([2]);
      // No attack was made on the hero.
      expect(resolved(run.events, "attackResolved", riptide)).toEqual([]);
    });

    // RRG 1.8 "Damage", order of resolution (p. 17): "1. Abilities that trigger 'when [character] would deal/be dealt any
    // amount of damage'. 2. Tough status cards." So the card's interrupt (step 1) places the damage first, and the tough
    // status card, which only prevents the damage dealt to the enemy, is not spent (docs/phase7-wave7.md §3.17). The
    // engine resolves tough before any dealDamage interrupt (`toughResolvesFirst`, resolve/event.ts, wave 3 §3.12), so
    // the tough card absorbs the hit and the interrupt never gets a window: an engine gap, pinned until fixed.
    it.fails("a tough status card on the enemy is not spent: the damage is never dealt to it (engine gap)", () => {
      const { state, id, riptide } = setup();
      const toughened = patchInstance(state, riptide, { statuses: { stunned: 0, confused: 0, tough: 1 } });
      const run = drive(toughened, {}, basicAttack(toughened, P1, riptide));
      expect(toughOn(run.state, riptide)).toBe(1);
      expect(inst(run.state, id).damage).toBe(2);
      expect(events(run.events, "damagePrevented")).toEqual([]);
    });

    it("3 or more damage here: the enemy attacks the player who dealt it, then the card is discarded", () => {
      const { state, id, riptide } = setup();
      const loaded = patchInstance(state, id, { damage: 1 });
      const run = drive(loaded, {}, basicAttack(loaded, P1, riptide));
      expect(resolved(run.events, "attackResolved", riptide)).toHaveLength(1);
      // Riptide ATK 1 on the hero (steady, retaliate and the rest are not in play here).
      expect(inst(run.state, heroOf(run.state)).damage).toBe(1);
      expect(inst(run.state, riptide).damage).toBe(0);
      expect(inEncounterDiscard(run.state, id)).toBe(true);
      expect(inst(run.state, riptide).attachments).not.toContain(id);
    });

    it("2 players: the attack is made on the player who dealt the damage, not the minion's engaged player", () => {
      const { state, id, riptide } = setup(TWO);
      expect(inst(state, riptide).engagedWith).toBe(P1);
      const loaded = patchInstance(state, id, { damage: 1 });
      const run = drive(loaded, {}, endTurn(P1), basicAttack(loaded, P2, riptide));
      expect(resolved(run.events, "attackResolved", riptide)).toHaveLength(1);
      expect(inst(run.state, identityOf(run.state, P2)).damage).toBe(1);
      expect(inst(run.state, identityOf(run.state, P1)).damage).toBe(0);
      expect(inEncounterDiscard(run.state, id)).toBe(true);
    });

    it("damage no player dealt: no attack is made and the card is still discarded (Q11 = A)", () => {
      // Dizzying Deeds' When Revealed is replaced for this test by "deal 5 damage to each minion" from an encounter card.
      const deps = {
        abilities: {
          ...WAVE7_ABILITIES,
          "40110.when-revealed": whenRevealed(dealDamage(5, each(query("minion")))),
        },
      };
      const { state, id, riptide } = setup();
      const run = round(state, { reveals: ["40110"], deps, alterEgo: true });
      expect(events(run.events, "damagePlaced").map((e) => [e.targetInstanceId, e.amount])).toEqual([[id, 5]]);
      expect(inEncounterDiscard(run.state, id)).toBe(true);
      expect(inst(run.state, riptide).damage).toBe(0);
      // Only Riptide's own activation of the villain phase: the card made no second attack (nobody to attack).
      expect(resolved(run.events, "attackResolved", riptide)).toHaveLength(1);
    });
  });
});

describe("Favored Weapon (40107)", () => {
  /** Riptide's own Forced Interrupt (unscripted when this was written) is a test double: ATK -9 so the attack deals 0. */
  const NO_DAMAGE = {
    abilities: {
      ...WAVE7_ABILITIES,
      "40099.riptide-forced-interrupt": forcedInterrupt(on.enemyAttacks("self"), modifyAttack({ atkBonus: -9 })),
    },
  };

  /** The same double with +5 ATK instead: it gets through Spider-Man's DEF 3. */
  const HITS_HARD = {
    abilities: {
      ...WAVE7_ABILITIES,
      "40099.riptide-forced-interrupt": forcedInterrupt(on.enemyAttacks("self"), modifyAttack({ atkBonus: 5 })),
    },
  };

  it("is attached to Greycrow when Greycrow is in play (as a minion here), whatever his ATK", () => {
    const base = game({ villain: ARCLIGHT, minions: ["Greycrow"] });
    const run = round(base, { reveals: ["40107"] });
    const weapon = instanceOfCode(run.state, "40107");
    expect(inst(run.state, weapon).attachedTo).toBe(minionsEngaged(base, P1)[0]);
  });

  it("is attached to Harpoon, the villain, when Harpoon is in play", () => {
    const base = game({ villain: "40074", minions: ["Riptide"] });
    expect(nameOf(base, villainId(base))).toBe("Harpoon");
    const run = round(base, { reveals: ["40107"] });
    expect(inst(run.state, instanceOfCode(run.state, "40107")).attachedTo).toBe(villainId(base));
  });

  it("otherwise it is attached to the Marauder enemy with the lowest ATK (Riptide 1 against Blockbuster's 2)", () => {
    const base = game({ villain: "40071", minions: ["Riptide"] });
    const run = round(base, { reveals: ["40107"] });
    expect(inst(run.state, instanceOfCode(run.state, "40107")).attachedTo).toBe(minionsEngaged(base, P1)[0]);
  });

  describe("40107.favored-weapon-constant", () => {
    // A Marauder minion is engaged, so Hope's Captor has the villain scheme and Riptide is the only attacker.
    const duel = (weapon: boolean) => {
      const base = heroed(game({ villain: "40071", minions: ["Riptide"] }));
      const riptide = minionsEngaged(base, P1)[0]!;
      const hero = heroOf(base);
      const toughHero = patchInstance(base, hero, { statuses: { stunned: 0, confused: 0, tough: 1 } });
      const armed = weapon ? attachToHost(toughHero, "40107", riptide).state : toughHero;
      const run = round(armed, { alterEgo: true });
      return { run, hero, riptide };
    };

    it("attached enemy's attacks gain piercing: a tough status card on the hero is discarded and the damage dealt", () => {
      const { run, hero, riptide } = duel(true);
      expect(resolved(run.events, "attackResolved", riptide)).toHaveLength(1);
      expect(toughOn(run.state, hero)).toBe(0);
      // Riptide's ATK 1 and the weapon's +1 (data).
      expect(inst(run.state, hero).damage).toBe(2);
      expect(events(run.events, "damagePrevented")).toEqual([]);
    });

    it("without the weapon the same attack is absorbed by the tough status card", () => {
      const { run, hero } = duel(false);
      expect(toughOn(run.state, hero)).toBe(0);
      expect(inst(run.state, hero).damage).toBe(0);
      expect(events(run.events, "damagePrevented")).toHaveLength(1);
    });
  });

  describe("40107.favored-weapon-response", () => {
    const defend = (deps: typeof WAVE7_DEPS) => {
      const base = heroed(game({ villain: "40071", minions: ["Riptide"] }));
      const riptide = minionsEngaged(base, P1)[0]!;
      const { state, id } = attachToHost(base, "40107", riptide);
      const run = round(state, {
        alterEgo: true,
        deps,
        plan: { defender: heroOf(base), accept: ["Hope's Captor", "Favored Weapon"] },
      });
      return { run, id, hero: heroOf(base) };
    };

    it("after your hero defends against the attached enemy and takes no damage: may discard this card", () => {
      const { run, id, hero } = defend(NO_DAMAGE);
      expect(inst(run.state, hero).damage).toBe(0);
      expect(run.prompts.map((p) => p.kind)).toContain("declareDefender");
      expect(inEncounterDiscard(run.state, id)).toBe(true);
    });

    it("not when the hero took damage: the card stays attached", () => {
      const { run, id, hero } = defend(HITS_HARD);
      expect(inst(run.state, hero).damage).toBeGreaterThan(0);
      expect(inEncounterDiscard(run.state, id)).toBe(false);
      expect(inst(run.state, id).attachedTo).not.toBeNull();
    });
  });
});

describe("Bushwhack (40108): 40108.when-defeated", () => {
  const thwart = (s: GameState, player: PlayerId, scheme: InstanceId) =>
    ({
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(s, player),
      schemeInstanceId: scheme,
    }) as const;
  const staged = (players: Seats) => {
    const base = heroed(game({ villain: ARCLIGHT, players, minions: players === ONE ? DEF1 : DEF2 }));
    const { state, id } = encounterCardInVillainArea(base, "40108", 1);
    return { state, scheme: id };
  };

  it("1 player: the player who defeated it takes a Marauder minion from the encounter deck, engaged with them", () => {
    const { state, scheme } = staged(ONE);
    const before = minionsEngaged(state, P1).length;
    const run = drive(state, {}, thwart(state, P1, scheme));
    expect(minionsEngaged(run.state, P1)).toHaveLength(before + 1);
    expect(inst(run.state, minionsEngaged(run.state, P1).at(-1)!).engagedWith).toBe(P1);
    expect(events(run.events, "deckShuffled").length).toBeGreaterThan(0);
  });

  it("2 players: the minion goes to the player who removed the last threat, not the first player", () => {
    const { state, scheme } = staged(TWO);
    const run = drive(state, { pick: ["Vertigo"] }, endTurn(P1), thwart(state, P2, scheme));
    expect(minionsEngaged(run.state, P1)).toHaveLength(1);
    expect(minionNames(run.state, P2)).toEqual(["Riptide", "Vertigo"]);
  });

  it("searches the discard pile as well as the deck", () => {
    const { state, scheme } = staged(ONE);
    const deckId = Object.keys(state.encounterDecks)[0]!;
    const pile = state.encounterDecks[deckId]!;
    const vertigo = pile.deck.filter((id) => nameOf(state, id) === "Vertigo");
    const withOnlyVertigoInDiscard: GameState = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: {
          deck: pile.deck.filter((id) => state.cardPool[state.instances[id]!.cardId]!.type !== "minion"),
          discard: [...pile.discard, ...vertigo],
        },
      },
    };
    const run = drive(withOnlyVertigoInDiscard, {}, thwart(state, P1, scheme));
    expect(minionNames(run.state, P1)).toContain("Vertigo");
    expect(discardNames(run.state)).not.toContain("Vertigo");
  });
});

describe("Pure Force (40109): 40109.pure-force-constant, 40109.pure-force-constant-2", () => {
  /** The crisis and amplify icons Pure Force itself shows (the per-card view, `iconsOn`). */
  const icons = (s: GameState, card: InstanceId) =>
    [iconsOn(s, WAVE7_DEPS, card, "crisis"), iconsOn(s, WAVE7_DEPS, card, "amplify")] as const;
  const withPureForce = (s: GameState) => encounterCardInVillainArea(s, "40109", 4);

  it("while Blockbuster is in play (as the villain) it gains the crisis icon", () => {
    const base = game({ villain: "40071", minions: DEF1 });
    const staged = withPureForce(base);
    expect(icons(staged.state, staged.id)).toEqual([1, 0]);
  });

  it("while Blockbuster is in play as a minion it gains the crisis icon too", () => {
    const base = game({ villain: ARCLIGHT, minions: ["Blockbuster"] });
    const staged = withPureForce(base);
    expect(icons(staged.state, staged.id)).toEqual([1, 0]);
  });

  it("while Chimera is in play it gains the amplify icon", () => {
    const base = game({ villain: "40072", minions: DEF1 });
    const staged = withPureForce(base);
    expect(icons(staged.state, staged.id)).toEqual([0, 1]);
  });

  it("with both Blockbuster and Chimera in play it gains both", () => {
    const base = game({ villain: "40071", minions: ["Chimera"] });
    const staged = withPureForce(base);
    expect(icons(staged.state, staged.id)).toEqual([1, 1]);
  });

  it("with neither in play it gains neither", () => {
    const base = game({ villain: ARCLIGHT, minions: DEF1 });
    const staged = withPureForce(base);
    expect(icons(staged.state, staged.id)).toEqual([0, 0]);
  });
});

describe("Dizzying Deeds (40110): 40110.when-revealed", () => {
  /** What the reveal did to the first player, read from the events after it was revealed. */
  const afterReveal = (log: readonly GameEvent[]) => {
    const at = log.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === "40110");
    expect(at).toBeGreaterThan(-1);
    return log.slice(at);
  };
  const statusesGiven = (log: readonly GameEvent[], id: InstanceId, status: "stunned" | "confused") =>
    log.filter((e) => e.type === "statusGiven" && e.instanceId === id && e.status === status).length;
  const exhausted = (log: readonly GameEvent[], id: InstanceId) =>
    log.filter((e) => e.type === "cardExhausted" && e.instanceId === id).length;
  const damaged = (log: readonly GameEvent[], id: InstanceId) =>
    log
      .filter((e) => e.type === "damageDealt" && e.targetInstanceId === id)
      .map((e) => (e as { amount: number }).amount);

  it("with none of Arclight, Riptide or Vertigo in play it only exhausts a character you control", () => {
    const base = game({ villain: "40071", minions: DEF1 });
    const hero = heroOf(base);
    const run = round(base, { reveals: ["40110"] });
    const log = afterReveal(run.events);
    expect(exhausted(log, hero)).toBe(1);
    expect(statusesGiven(log, hero, "stunned")).toBe(0);
    expect(statusesGiven(log, hero, "confused")).toBe(0);
    expect(damaged(log, hero)).toEqual([]);
  });

  it("with an ally you control it asks which character to exhaust", () => {
    const base = game({ villain: "40071", minions: DEF1 });
    const ally = playersAllyIn(base);
    const run = round(ally.state, { reveals: ["40110"], plan: { pick: ["Black Cat"] } });
    const log = afterReveal(run.events);
    expect(exhausted(log, ally.id)).toBe(1);
    expect(exhausted(log, heroOf(base))).toBe(0);
  });

  it("Arclight in play (as the villain): stuns a character you control", () => {
    const base = game({ villain: ARCLIGHT, minions: DEF1 });
    const hero = heroOf(base);
    const run = round(base, { reveals: ["40110"] });
    const log = afterReveal(run.events);
    expect(statusesGiven(log, hero, "stunned")).toBe(1);
    expect(exhausted(log, hero)).toBe(1);
    expect(inst(run.state, hero).statuses.stunned).toBe(1);
  });

  it("Riptide in play (as a minion): take 3 indirect damage", () => {
    const base = game({ villain: "40071", minions: ["Riptide"] });
    const hero = heroOf(base);
    const run = round(base, { reveals: ["40110"] });
    const log = afterReveal(run.events);
    expect(damaged(log, hero)).toEqual([3]);
    expect(statusesGiven(log, hero, "stunned") + statusesGiven(log, hero, "confused")).toBe(0);
  });

  it("Vertigo in play (as a minion): confuses a character you control", () => {
    const base = game({ villain: "40071", minions: ["Vertigo"] });
    const hero = heroOf(base);
    const run = round(base, { reveals: ["40110"] });
    const log = afterReveal(run.events);
    expect(statusesGiven(log, hero, "confused")).toBe(1);
    expect(statusesGiven(log, hero, "stunned")).toBe(0);
  });

  it("a character that already holds the status card cannot be given another: nothing happens", () => {
    const base = game({ villain: ARCLIGHT, minions: ["Vertigo"] });
    const hero = heroOf(base);
    const marked = patchInstance(base, hero, { statuses: { stunned: 1, confused: 1, tough: 0 } });
    const run = round(marked, { reveals: ["40110"] });
    const log = afterReveal(run.events);
    expect(statusesGiven(log, hero, "stunned")).toBe(0);
    expect(statusesGiven(log, hero, "confused")).toBe(0);
  });

  it("2 players: only the player who revealed it is affected", () => {
    const base = game({ villain: "40071", players: TWO, minions: ["Riptide", "Vertigo"] });
    const [h1, h2] = [heroOf(base, P1), heroOf(base, P2)];
    const run = round(base, { reveals: ["40110", "40109"] });
    const log = afterReveal(run.events);
    expect(exhausted(log, h1)).toBe(1);
    expect(exhausted(log, h2)).toBe(0);
    expect(damaged(log, h1)).toEqual([3]);
    expect(damaged(log, h2)).toEqual([]);
    expect(statusesGiven(log, h1, "confused")).toBe(1);
    expect(statusesGiven(log, h2, "confused")).toBe(0);
  });
});
/** A Black Cat ally from the first player's deck, in their play area and ready (surgery). */
function playersAllyIn(state: GameState): { state: GameState; id: InstanceId } {
  const p = state.players[0]!;
  const id = [...p.hand, ...p.deck].find((i) => nameOf(state, i) === "Black Cat")!;
  return {
    id,
    state: {
      ...state,
      players: state.players.map((q) =>
        q.playerId === p.playerId
          ? {
              ...q,
              hand: q.hand.filter((i) => i !== id),
              deck: q.deck.filter((i) => i !== id),
              playArea: [...q.playArea, id],
            }
          : q,
      ),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, exhausted: false, controllerId: p.playerId },
      },
    },
  };
}

describe("Tag Team (40111): 40111.when-revealed", () => {
  const minionAttacks = (log: readonly GameEvent[], id: InstanceId) =>
    log.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === id).length;
  const OPTION_1 = "Each MARAUDER minion engaged with you activates against you";
  const OPTION_2 = "Discard 7 cards";

  it("option 1: each Marauder minion engaged with you activates against you (once more than its own activation)", () => {
    const base = game({ villain: "40071", minions: ["Riptide"] });
    const riptide = minionsEngaged(base, P1)[0]!;
    const run = round(base, { reveals: ["40111"], plan: { choose: OPTION_1 } });
    expect(minionAttacks(run.events, riptide)).toBe(2);
  });

  it("option 1 with 2 players: only the minions engaged with the player who revealed it activate", () => {
    const base = game({ villain: "40071", players: TWO, minions: ["Riptide", "Vertigo"] });
    const [r, v] = [minionsEngaged(base, P1)[0]!, minionsEngaged(base, P2)[0]!];
    const run = round(base, { reveals: ["40111", "40109"], plan: { choose: OPTION_1 } });
    expect(minionAttacks(run.events, r)).toBe(2);
    expect(minionAttacks(run.events, v)).toBe(1);
  });

  it("option 1 is not offered when no Marauder minion is engaged with you: option 2 is forced (Q8 = A)", () => {
    const base = withoutMinions(game({ villain: "40071", minions: ["Riptide"] }), P1);
    const run = round(base, { reveals: ["40111", "40100", "40099"], plan: { choose: OPTION_1 } });
    expect(run.prompts.some((p) => p.labels.some((l) => l.startsWith(OPTION_1)))).toBe(false);
    // Option 2 resolved: a Marauder minion from the discard pile is engaged with the player.
    expect(minionsEngaged(run.state, P1)).toHaveLength(1);
  });

  describe("option 2", () => {
    /** The deck: Tag Team revealed, then these 7 cards are discarded, the last of them the topmost in the discard pile. */
    const SEVEN = ["40109", "40108", "01188", "40100", "01189", "40099", "01190"] as const;
    const stagedDeck = (s: GameState) => stackEncounterDeck(s, "01186", "40111", ...SEVEN);

    it("discards 7 cards from the top of the encounter deck and puts the topmost Marauder minion of the discard pile into play engaged with you", () => {
      const base = game({ villain: "40071", minions: ["Greycrow"] });
      const deckBefore = piles(base).deck.length;
      const run = drive(stagedDeck(base), { choose: OPTION_2 }, toHero(P1), endTurn(P1));
      const s = run.state;
      // Riptide, the later of the two Marauders discarded, is the topmost; Vertigo stays in the discard pile.
      expect(minionNames(s, P1)).toEqual(["Greycrow", "Riptide"]);
      expect(discardNames(s)).toContain("Vertigo");
      expect(discardNames(s)).not.toContain("Riptide");
      // 1 boost + Tag Team + 7 discarded cards left the deck, nothing else did (Riptide came from the discard pile).
      expect(piles(s).deck.length).toBe(deckBefore - 9);
    });

    it("a Marauder already in the discard pile below the seven is not the topmost", () => {
      const base = game({ villain: "40071", minions: ["Greycrow"] });
      const staged = stackEncounterDeck(
        base,
        "01186",
        "40111",
        "01188",
        "01189",
        "01190",
        "40109",
        "40108",
        "40106",
        "40106",
      );
      const deckId = Object.keys(staged.encounterDecks)[0]!;
      const pile = staged.encounterDecks[deckId]!;
      const old = pile.deck.find((id) => nameOf(staged, id) === "Chimera")!;
      const withOld: GameState = {
        ...staged,
        encounterDecks: {
          ...staged.encounterDecks,
          [deckId]: { deck: pile.deck.filter((id) => id !== old), discard: [...pile.discard, old] },
        },
      };
      const run = drive(withOld, { choose: OPTION_2 }, toHero(P1), endTurn(P1));
      // No Marauder among the seven: the older Chimera in the discard pile is the topmost one there.
      expect(minionNames(run.state, P1)).toEqual(["Greycrow", "Chimera"]);
    });
  });
});
