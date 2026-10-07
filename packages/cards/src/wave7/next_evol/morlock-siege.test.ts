import {
  activeVillain,
  applyCommand,
  createGame,
  hasKeyword,
  keywordTotal,
  replay,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
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
  use,
} from "../../testing/harness.js";
import { playToOutcome } from "../../testing/driver.js";
import { driveEventsPicking, withDamage, withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { MORLOCK_SIEGE } from "./morlock-siege.js";

vi.setConfig({ testTimeout: 120_000 });

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const ONE = [SPIDER_MAN] as const;
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

/** Boost cards with 1-2 icons and no boost ability (Core Standard), one for each activation of the villain phase. */
const FILLER_BOOSTS = ["01190", "01188", "01189"] as const;
/**
 * The cards the players are dealt by default: Back in Action (two copies) gives the villain a tough status card and
 * places threat equal to the villains under Routed, so with none it changes nothing a test reads. Unlike a side scheme
 * it goes to the discard pile, so a later round can stack it again.
 */
const QUIET_REVEAL = "40088";

/** Morlock Siege, standard or expert, past setup. `villain` (the printed number, 40071, ...) searches the seeds for it. */
function siege(
  opts: { players?: Seats; expert?: boolean; villain?: string; modular?: readonly string[] } = {},
): GameState {
  for (let seed = 1; seed < 400; seed++) {
    const config = wave7Scenario("morlock-siege", {
      players: opts.players ?? ONE,
      seed,
      difficulty: opts.expert ? "expert" : "standard",
      modularSetIds: opts.modular ?? [],
    });
    const created = createGame(config, WAVE7_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    const id = created.state.instances[activeVillain(created.state).instanceId]!.cardId as string;
    if (opts.villain && !id.startsWith(opts.villain)) continue;
    return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
  }
  throw new Error(`no seed starts Morlock Siege with ${opts.villain}`);
}
/** Blockbuster (printed SCH 0) keeps the main scheme from completing on its own in a test about something else. */
const quiet = (opts: { players?: Seats; expert?: boolean; modular?: readonly string[] } = {}) =>
  siege({ ...opts, villain: "40071" });

const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const cardOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const mainOf = (s: GameState) => s.mainScheme.instanceId;
const villainId = (s: GameState) => activeVillain(s).instanceId;
const routedOf = (s: GameState) => s.villainArea.find((id) => cardOf(s, id) === "40081a")!;
const morlocksOf = (s: GameState, player: PlayerId) =>
  playerOf(s, player).playArea.filter((id) => cardOf(s, id) === "40079");
const allMorlocks = (s: GameState) => s.players.flatMap((p) => morlocksOf(s, p.playerId));
const toughOn = (s: GameState, id: InstanceId) => inst(s, id).statuses.tough;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const deckNames = (s: GameState) => piles(s).deck.map((id) => nameOf(s, id));
const discardNames = (s: GameState) => piles(s).discard.map((id) => nameOf(s, id));
const underRouted = (s: GameState) => inst(s, routedOf(s)).tucked.map((id) => nameOf(s, id));
const retaliateOf = (s: GameState, id: InstanceId) => keywordTotal(s, id, "retaliate", WAVE7_DEPS);
const setAsideNames = (s: GameState) => s.encounterSetAside.map((id) => nameOf(s, id));

interface Plan {
  /** The label (start) of the option to take at a `chooseOption` prompt; the first one otherwise. */
  readonly choose?: string;
  /** Instances to pick at `chooseTarget` prompts, in order; the first offered otherwise. */
  readonly targets?: readonly InstanceId[];
  /** The character that defends; nobody otherwise. */
  readonly defender?: InstanceId;
  /** Hand cards (by name) to spend at a `spendResources` prompt. */
  readonly pay?: readonly string[];
}
interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** Each `chooseOption` and `chooseTarget` prompt: who was asked and what was offered. */
  readonly prompts: readonly { readonly kind: string; readonly player: PlayerId; readonly labels: readonly string[] }[];
}
const pickFor = (plan: Plan, prompts: Run["prompts"] extends readonly (infer P)[] ? P[] : never) => {
  const targets = [...(plan.targets ?? [])];
  return (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    const kind = choice.prompt.kind;
    if (kind === "chooseOption" || kind === "chooseTarget")
      prompts.push({ kind, player: choice.playerId, labels: choice.options.map((o) => o.label) });
    switch (kind) {
      case "chooseOption": {
        const hit = choice.options.find((o) => (plan.choose ? o.label.startsWith(plan.choose) : true));
        return [(hit ?? choice.options[0]!).optionId];
      }
      case "chooseTarget": {
        const next = targets.shift();
        const hit = next ? choice.options.find((o) => o.optionId === next) : undefined;
        return [(hit ?? choice.options[0]!).optionId];
      }
      case "declareDefender":
        return [plan.defender && choice.options.some((o) => o.optionId === plan.defender) ? plan.defender : "decline"];
      case "spendResources": {
        const ids: string[] = [];
        for (const name of plan.pay ?? []) {
          const hit = choice.options.find((o) => o.label === name && !ids.includes(o.optionId));
          if (hit) ids.push(hit.optionId);
        }
        return ids.length > 0 ? ids : firstLegal(s);
      }
      default:
        return firstLegal(s);
    }
  };
};
/** The commands in order, every prompt answered by `plan`. */
function drive(state: GameState, plan: Plan, ...commands: Parameters<typeof driveEventsPicking>[3][]): Run {
  const prompts: { kind: string; player: PlayerId; labels: readonly string[] }[] = [];
  const { state: after, events } = driveEventsPicking(WAVE7_DEPS, state, pickFor(plan, prompts), ...commands);
  return { state: after, events, prompts };
}
/**
 * Every player ends their turn (alter-ego form unless `hero`), and the villain phase runs. The encounter deck is
 * stacked: `boosts` are the villain's boost cards (it draws one per activation), `reveals` the cards the players are
 * dealt, in player order. Anything else on the deck is whatever the scenario shuffled.
 */
function round(
  state: GameState,
  opts: { boosts?: readonly string[]; reveals?: readonly string[]; hero?: boolean; plan?: Plan } = {},
): Run {
  const players = state.players.length;
  const given = opts.boosts ?? [];
  const spareBoosts = opts.boosts ? [] : FILLER_BOOSTS.slice(0, players);
  const boosts = [...given, ...spareBoosts];
  const spare = 2 - boosts.filter((c) => c === QUIET_REVEAL).length;
  const reveals = opts.reveals ?? Array.from({ length: Math.min(players, spare) }, () => QUIET_REVEAL);
  const stacked = stackEncounterDeck(state, ...boosts, ...reveals);
  const order =
    state.step.phase === "player" && state.step.kind === "turn"
      ? [state.step.activePlayerId, ...state.step.remainingPlayerIds]
      : state.players.map((p) => p.playerId);
  const commands = order.flatMap((id) => [...(opts.hero ? [toHero(id)] : []), endTurn(id)]);
  return drive(stacked, opts.plan ?? {}, ...commands);
}
/** The main scheme holds `knock` counters and no threat (so a round cannot complete stage 1 by threat). */
const withKnock = (s: GameState, knock: number, threat = 0) =>
  patchInstance(s, mainOf(s), { counters: { knock }, threat });
/** Stage 2 by knock counters (2A's tough status cards) or, with `byThreat`, by the stage's completion. */
function toStage2(state: GameState, how: "knock" | "threat" = "knock"): Run {
  if (how === "knock") return round(withKnock(state, 2));
  return round(patchInstance(state, mainOf(state), { counters: {}, threat: 99 }));
}
/** A state in stage 2, the villain phase having just resolved. */
const stage2 = (opts: { players?: Seats; how?: "knock" | "threat"; expert?: boolean; villain?: string } = {}) =>
  toStage2(siege({ ...opts, villain: opts.villain ?? "40071" }), opts.how ?? "knock").state;

/** The card in the encounter deck (or discard pile) moved to the discard pile (surgery). */
function toEncounterDiscard(state: GameState, code: string): GameState {
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => cardOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: [...pile.discard, id] },
    },
  };
}
/** `n` villains already under Routed, taken from the set-aside villains (surgery; the active villain stays). */
function withUnderRouted(state: GameState, n: number): GameState {
  const routed = routedOf(state);
  const taken = state.encounterSetAside
    .filter((id) => state.cardPool[state.instances[id]!.cardId]!.type === "villain")
    .slice(0, n);
  return {
    ...state,
    encounterSetAside: state.encounterSetAside.filter((id) => !taken.includes(id)),
    instances: {
      ...state.instances,
      [routed]: { ...state.instances[routed]!, tucked: [...state.instances[routed]!.tucked, ...taken] },
    },
  };
}
/** The attack or scheme results the villain's activation resolved. */
const attackResolved = (events: readonly GameEvent[], enemy?: InstanceId) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "attackResolved" }> =>
      e.type === "attackResolved" && (!enemy || e.enemyInstanceId === enemy),
  );

describe("registry", () => {
  it("registers every ref of the set but Bolstered by Wrath's Hero Action (skipped: coverage.test.ts)", () => {
    expect(Object.keys(MORLOCK_SIEGE).sort()).toEqual(
      [
        "40077a.setup",
        "40077b.knock-knock-forced-response",
        "40077b.knock-knock-constant",
        "40078a.when-revealed",
        "40078b.mutant-massacre-action",
        "40078b.mutant-massacre-constant",
        "40078b.mutant-massacre-constant-2",
        "40079.morlock-constant",
        "40079.morlock-forced-interrupt",
        "40080.when-revealed",
        "40080.boost",
        "40081a.routed-constant",
        "40081a.routed-forced-response",
        "40081b.routed-constant",
        "40081b.routed-forced-response",
        "40082.bolstered-by-wrath-action",
        "40082.boost",
        "40083.pushed-to-the-limit-constant",
        "40083.pushed-to-the-limit-constant-2",
        "40083.pushed-to-the-limit-action",
        "40084.when-revealed",
        "40085.when-revealed",
        "40086.when-revealed",
        "40087.when-revealed",
        "40088.when-revealed",
        "40088.boost",
        "40089.when-revealed-alter-ego",
        "40089.when-revealed-hero",
        "40089.boost",
      ].sort(),
    );
  });
});

describe("40077a.setup: Routed into play, Hide! and the Morlocks set aside, the villain deck", () => {
  it("puts Routed into play (standard face) and leaves it out of the encounter deck", () => {
    const s = siege();
    expect(s.villainArea.map((id) => cardOf(s, id))).toEqual(["40081a"]);
    expect(inst(s, routedOf(s)).flipped).toBe(false);
    expect(deckNames(s)).not.toContain("Routed");
    expect(s.mainScheme.stageIndex).toBe(0);
  });

  it("Routed enters on its Expert Mode Only face in expert mode", () => {
    const s = siege({ expert: true });
    expect(inst(s, routedOf(s)).flipped).toBe(true);
  });

  it("Hide! and four Morlocks are set aside, with the six Marauders that are not in play", () => {
    const s = siege();
    expect(setAsideNames(s).filter((n) => n === "Morlock")).toHaveLength(4);
    expect(setAsideNames(s).filter((n) => n === "Hide!")).toHaveLength(1);
    expect(deckNames(s)).not.toContain("Hide!");
    expect(deckNames(s)).not.toContain("Morlock");
    const villains = s.encounterSetAside.filter((id) => s.cardPool[s.instances[id]!.cardId]!.type === "villain");
    expect(villains).toHaveLength(6);
    expect(new Set([...villains, villainId(s)].map((id) => nameOf(s, id))).size).toBe(7);
    expect(allMorlocks(s)).toEqual([]);
  });
});

describe("Knock, Knock (40077a stage 1)", () => {
  it("40077b.knock-knock-forced-response: one knock counter after step one of each villain phase, the stage stays", () => {
    const base = quiet();
    expect(inst(base, mainOf(base)).counters.knock ?? 0).toBe(0);
    const one = round(base).state;
    expect(inst(one, mainOf(one)).counters.knock).toBe(1);
    expect(one.mainScheme.stageIndex).toBe(0);
    expect(one.outcome).toBeNull();
    const two = round(withKnock(one, 1)).state;
    expect(inst(two, mainOf(two)).counters.knock).toBe(2);
    expect(two.mainScheme.stageIndex).toBe(0);
  });

  it("the counter is placed after the threat of step one (the response window of that step)", () => {
    const run = round(quiet());
    const types = run.events.map((e) => e.type);
    const counter = types.indexOf("counterAdded");
    expect(counter).toBeGreaterThan(-1);
    const stepOneThreat = run.events.findIndex((e) => e.type === "threatPlaced" && e.sourceInstanceId === null);
    expect(stepOneThreat).toBeGreaterThan(-1);
    expect(counter).toBeGreaterThan(stepOneThreat);
    // ... and before the villain activates.
    expect(counter).toBeLessThan(types.indexOf("enemyActivated"));
  });

  it("the third counter advances to stage 2A: 2 counters do not, 3 do", () => {
    const two = round(withKnock(quiet(), 1)).state;
    expect(two.mainScheme.stageIndex).toBe(0);
    const three = round(withKnock(quiet(), 2));
    expect(inst(three.state, mainOf(three.state)).counters.knock).toBe(3);
    expect(three.state.mainScheme.stageIndex).toBe(1);
    const advanced = three.events.find((e) => e.type === "mainSchemeAdvanced");
    expect(advanced).toMatchObject({
      stageIndex: 1,
      advancedBy: { cause: "cardEffect", sourceInstanceId: mainOf(three.state) },
    });
  });
});

describe("Mutant Massacre 2A (40078a): 40078a.when-revealed", () => {
  it("1 player: puts 2 set-aside Morlocks into play under their control, and Hide! into the encounter deck", () => {
    const before = quiet();
    expect(before.encounterSetAside.filter((id) => cardOf(before, id) === "40079")).toHaveLength(4);
    const s = toStage2(before).state;
    expect(s.mainScheme.stageIndex).toBe(1);
    const mine = morlocksOf(s, P1);
    expect(mine).toHaveLength(2);
    for (const id of mine) expect(inst(s, id).controllerId).toBe(P1);
    expect(setAsideNames(s).filter((n) => n === "Morlock")).toHaveLength(2);
    expect(setAsideNames(s)).not.toContain("Hide!");
    expect(deckNames(s).filter((n) => n === "Hide!").length + discardNames(s).filter((n) => n === "Hide!").length).toBe(
      1,
    );
  });

  it("1 player, advanced by knock counters: each Morlock gets a tough status card", () => {
    const s = toStage2(quiet(), "knock").state;
    const mine = morlocksOf(s, P1);
    expect(mine.map((id) => toughOn(s, id))).toEqual([1, 1]);
  });

  it("1 player, advanced by the stage's completion (not by knock counters): no tough status card", () => {
    const run = toStage2(quiet(), "threat");
    expect(run.events.find((e) => e.type === "mainSchemeAdvanced")).toMatchObject({
      advancedBy: { cause: "completed" },
    });
    const s = run.state;
    expect(s.mainScheme.stageIndex).toBe(1);
    const mine = morlocksOf(s, P1);
    expect(mine).toHaveLength(2);
    expect(mine.map((id) => toughOn(s, id))).toEqual([0, 0]);
  });

  it("2 players: 1 Morlock each under their own control, 2 left set aside", () => {
    const s = toStage2(quiet({ players: TWO }), "knock").state;
    expect(morlocksOf(s, P1)).toHaveLength(1);
    expect(morlocksOf(s, P2)).toHaveLength(1);
    for (const p of [P1, P2]) expect(inst(s, morlocksOf(s, p)[0]!).controllerId).toBe(p);
    expect(setAsideNames(s).filter((n) => n === "Morlock")).toHaveLength(2);
    expect(allMorlocks(s).map((id) => toughOn(s, id))).toEqual([1, 1]);
  });

  it("2 players, advanced by completion: no tough status card", () => {
    const s = toStage2(quiet({ players: TWO }), "threat").state;
    expect(allMorlocks(s)).toHaveLength(2);
    expect(allMorlocks(s).map((id) => toughOn(s, id))).toEqual([0, 0]);
  });

  it("a Morlock does not count against the ally limit: three allies and two Morlocks are all in play", () => {
    const base = withKnock(quiet(), 2);
    const hand = playerOf(base, P1).hand;
    expect(hand.length).toBeGreaterThan(3);
    const three = hand.slice(0, 3);
    const crowded = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand: p.hand.filter((i) => !three.includes(i)), playArea: [...p.playArea, ...three] }
          : p,
      ),
      instances: {
        ...base.instances,
        ...Object.fromEntries(three.map((i) => [i, { ...base.instances[i]!, faceup: true, controllerId: P1 }])),
      },
    };
    const run = round(crowded);
    expect(run.state.mainScheme.stageIndex).toBe(1);
    expect(morlocksOf(run.state, P1)).toHaveLength(2);
    expect(run.prompts).toEqual([]);
  });
});

describe("Mutant Massacre 2B (40078b)", () => {
  const activePlayer = (s: GameState): PlayerId =>
    s.step.phase === "player" && s.step.kind === "turn" ? s.step.activePlayerId : P1;
  const massacre = (s: GameState, player: PlayerId, exhaust?: InstanceId) =>
    use(player, mainOf(s), "40078b.mutant-massacre-action", [], exhaust ? { exhausted: [exhaust] } : undefined);

  it("40078b.mutant-massacre-action: exhausts a Morlock and shuffles Hide! from the encounter discard pile into the deck", () => {
    const base = toEncounterDiscard(stage2(), "40080");
    expect(discardNames(base)).toContain("Hide!");
    const [first, second] = morlocksOf(base, P1);
    const run = drive(base, {}, massacre(base, P1, second));
    const s = run.state;
    expect(inst(s, second!).exhausted).toBe(true);
    expect(inst(s, first!).exhausted).toBe(false);
    expect(discardNames(s)).not.toContain("Hide!");
    expect(deckNames(s).filter((n) => n === "Hide!")).toHaveLength(1);
    expect(run.events.some((e) => e.type === "deckShuffled")).toBe(true);
    expect(deckNames(s)).toHaveLength(deckNames(base).length + 1);
  });

  it("the other Morlock can pay as well (the player's choice)", () => {
    const base = toEncounterDiscard(stage2(), "40080");
    const [first, second] = morlocksOf(base, P1);
    const s = drive(base, {}, massacre(base, P1, first)).state;
    expect(inst(s, first!).exhausted).toBe(true);
    expect(inst(s, second!).exhausted).toBe(false);
  });

  it("with no ready Morlock the action cannot be used (the cost cannot be paid)", () => {
    const base = toEncounterDiscard(stage2(), "40080");
    const exhausted = morlocksOf(base, P1).reduce((s, id) => patchInstance(s, id, { exhausted: true }), base);
    const result = applyCommand(exhausted, massacre(exhausted, P1), WAVE7_DEPS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no_valid_target");
  });

  it("2 players: the acting player pays with a Morlock they control, not the other player's", () => {
    const base = toEncounterDiscard(stage2({ players: TWO }), "40080");
    const actor = activePlayer(base);
    const other = actor === P1 ? P2 : P1;
    const mine = morlocksOf(base, actor)[0]!;
    const theirs = morlocksOf(base, other)[0]!;
    const refused = applyCommand(base, massacre(base, actor, theirs), WAVE7_DEPS);
    expect(refused.ok).toBe(false);
    const run = drive(base, {}, massacre(base, actor));
    expect(inst(run.state, mine).exhausted).toBe(true);
    expect(inst(run.state, theirs).exhausted).toBe(false);
    expect(deckNames(run.state)).toContain("Hide!");
  });

  it("with no Hide! in the encounter discard pile the action still resolves and shuffles nothing in", () => {
    const base = stage2();
    expect(discardNames(base)).not.toContain("Hide!");
    const before = deckNames(base).length;
    const s = drive(base, {}, massacre(base, P1, morlocksOf(base, P1)[0])).state;
    expect(deckNames(s)).toHaveLength(before);
    expect(morlocksOf(s, P1).filter((id) => inst(s, id).exhausted)).toHaveLength(1);
  });
});

/**
 * A Morlock one point from death takes 1 damage from a card ability (Back in Action's Boost, option 1): any damage
 * defeats it (docs/phase7-wave7.md §4.1 Q7 = A), whatever dealt it.
 */
const damageAndDefeat = (state: GameState, id: InstanceId): GameState =>
  round(patchInstance(withDamage(state, id, 4), mainOf(state), { threat: 0 }), {
    boosts: ["40088"],
    plan: { choose: "Deal 1 damage", targets: [id] },
  }).state;

describe("the loss and the win", () => {
  it("40078b.mutant-massacre-constant-2: the players lose when stage 2 has no Morlock ally in play", () => {
    const base = stage2({ how: "threat" });
    expect(base.outcome).toBeNull();
    const [first, second] = morlocksOf(base, P1);
    // One Morlock left: still going. Damage from any source defeats a Morlock (Q7 = A).
    const one = damageAndDefeat(base, first!);
    expect(morlocksOf(one, P1)).toEqual([second]);
    expect(one.outcome).toBeNull();
    const none = damageAndDefeat(one, second!);
    expect(morlocksOf(none, P1)).toEqual([]);
    expect(none.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: mainOf(none) });
  });

  it("no Morlock in play does not lose during stage 1 (the check is on stage 2 only)", () => {
    const base = quiet();
    expect(allMorlocks(base)).toEqual([]);
    expect(round(base).state.outcome).toBeNull();
  });

  it("no Morlock in play right after 2A resolves is not a loss: they enter during the reveal", () => {
    const s = stage2();
    expect(s.outcome).toBeNull();
    expect(allMorlocks(s)).toHaveLength(2);
  });

  it("completing stage 2 loses the game (MainSchemeStage.completionLoses)", () => {
    const base = stage2();
    const loaded = patchInstance(base, mainOf(base), { threat: 99 });
    const s = drive(loaded, {}, endTurn(P1)).state;
    expect(s.outcome?.result).toBe("loss");
    expect(s.outcome).toMatchObject({ reason: "mainSchemeCompleted" });
  });

  it("3 villains under Routed win the game during stage 1", () => {
    const base = withUnderRouted(quiet(), 3);
    const s = settle(round(base).state, firstLegal, undefined, WAVE7_DEPS);
    expect(s.outcome?.result).toBe("win");
  });

  it("3 villains under Routed win the game during stage 2, and 2 do not", () => {
    const two = round(withUnderRouted(stage2(), 2)).state;
    expect(two.outcome).toBeNull();
    const three = round(withUnderRouted(stage2(), 3)).state;
    expect(three.outcome?.result).toBe("win");
  });
});

/** Keeps only these set-aside villains (the rest leave the game), so the next villain of the deck is known. */
function onlySetAside(state: GameState, ...codes: readonly string[]): GameState {
  return {
    ...state,
    encounterSetAside: state.encounterSetAside.filter(
      (id) => state.cardPool[state.instances[id]!.cardId]!.type !== "villain" || codes.includes(cardOf(state, id)),
    ),
  };
}
/** Hero form for everybody (surgery: only the active player may change form), ready and undamaged. */
const heroes = (state: GameState): GameState =>
  ready(state.players.reduce((current, p) => withForm(current, { heroForm: 0 }, p.playerId), state));
const run1 = (state: GameState, command: Parameters<typeof driveEventsPicking>[3]) =>
  driveEventsPicking(WAVE7_DEPS, state, firstLegal, command).state;
const ready = (state: GameState): GameState =>
  state.players.reduce((s, p) => patchInstance(s, identityOf(s, p.playerId), { exhausted: false, damage: 0 }), state);
/** The first player's hero defeats the villain with a basic attack (the villain dealt lethal damage first, surgery). */
function defeatVillain(state: GameState, plan: Plan = {}): Run {
  const target = villainId(state);
  const attacker = state.players[0]!.playerId;
  const clear = { stunned: 0, confused: 0, tough: 0 };
  // The attacker's status cards go too: a villain that entered earlier may have stunned the hero (Vertigo).
  const armed = patchInstance(
    patchInstance(ready(state), target, { damage: 999, statuses: clear }),
    identityOf(state, attacker),
    { statuses: clear },
  );
  return drive(armed, plan, {
    type: "basicAttack",
    playerId: attacker,
    attackerInstanceId: identityOf(armed, attacker),
    targetInstanceId: target,
  });
}

describe("Routed (40081a / 40081b): the Forced Response after the villain is defeated", () => {
  it("40081a.routed-forced-response: the defeated villain goes under Routed, the next villain enters with full hit points", () => {
    const base = heroes(onlySetAside(quiet(), "40072a"));
    const defeated = villainId(base);
    expect(nameOf(base, defeated)).toBe("Blockbuster");
    const run = defeatVillain(base);
    const s = run.state;
    expect(inst(s, routedOf(s)).tucked).toEqual([defeated]);
    expect(underRouted(s)).toEqual(["Blockbuster"]);
    expect(s.victoryDisplay).not.toContain(defeated);
    expect(nameOf(s, villainId(s))).toBe("Chimera");
    expect(villainId(s)).not.toBe(defeated);
    expect(inst(s, villainId(s)).damage).toBe(0);
    expect(setAsideNames(s).filter((n) => n === "Chimera")).toEqual([]);
    expect(s.outcome).toBeNull();
    expect(cardOf(s, villainId(s))).toBe("40072a");
  });

  it("the new villain activates against each player in player order: an attack on the hero, a scheme on the alter-ego", () => {
    const base = onlySetAside(quiet({ players: TWO }), "40072a");
    const hero = settle(run1(base, toHero(P1)), firstLegal, undefined, WAVE7_DEPS);
    // P2 stays in alter-ego form.
    const run = defeatVillain(hero);
    const next = villainId(run.state);
    const kinds = run.events.filter(
      (e) => (e.type === "attackResolved" || e.type === "schemeResolved") && e.enemyInstanceId === next,
    );
    expect(kinds.map((e) => e.type)).toEqual(["attackResolved", "schemeResolved"]);
    expect(attackResolved(run.events, next)[0]!.targetInstanceId).toBe(identityOf(run.state, P1));
  });

  it("each minion that shares a title with the new villain is discarded; other minions stay", () => {
    const base = onlySetAside(quiet({ modular: ["mutant_slayers"] }), "40072a");
    const withChimera = engageMinion(base, "40096", P1);
    const withBoth = engageMinion(withChimera.state, "40094", P1);
    const run = defeatVillain(heroes(withBoth.state));
    const s = run.state;
    expect(nameOf(s, villainId(s))).toBe("Chimera");
    expect(piles(s).discard).toContain(withChimera.id);
    expect(s.players[0]!.playArea).not.toContain(withChimera.id);
    expect(s.players[0]!.playArea).toContain(withBoth.id);
  });

  it("a minion that shares the DEFEATED villain's title is not discarded (only the new villain's title counts)", () => {
    const base = onlySetAside(siege({ villain: "40073", modular: ["mutant_slayers"] }), "40072a");
    const greycrowMinion = engageMinion(base, "40097", P1);
    const run = defeatVillain(heroes(greycrowMinion.state));
    expect(nameOf(run.state, villainId(run.state))).toBe("Chimera");
    expect(run.state.players[0]!.playArea).toContain(greycrowMinion.id);
  });

  it("everything on the defeated villain is gone: its attachments and status cards do not carry over (MC40 p. 9)", () => {
    const base = heroes(onlySetAside(quiet(), "40072a"));
    const stacked = patchInstance(base, villainId(base), {
      statuses: { stunned: 0, confused: 0, tough: 0 },
      counters: { grudge: 2 },
    });
    const run = defeatVillain(stacked);
    expect(inst(run.state, villainId(run.state)).counters).toEqual({});
    expect(inst(run.state, villainId(run.state)).statuses).toEqual({ stunned: 0, confused: 0, tough: 0 });
  });

  it("standard mode: the new villain has no retaliate from Routed", () => {
    const run = defeatVillain(heroes(onlySetAside(quiet(), "40072a")));
    expect(retaliateOf(run.state, villainId(run.state))).toBe(0);
  });

  it("40081b.routed-forced-response and 40081b.routed-constant (expert): retaliate 1 for each card under Routed", () => {
    const base = heroes(onlySetAside(quiet({ expert: true }), "40072b", "40073b"));
    expect(cardOf(base, villainId(base))).toBe("40071b");
    expect(retaliateOf(base, villainId(base))).toBe(0);
    const first = defeatVillain(base);
    expect(underRouted(first.state)).toEqual(["Blockbuster"]);
    expect(retaliateOf(first.state, villainId(first.state))).toBe(1);
    const second = defeatVillain(first.state);
    expect(underRouted(second.state)).toHaveLength(2);
    expect(retaliateOf(second.state, villainId(second.state))).toBe(2);
    expect(second.state.outcome).toBeNull();
  });

  it("40081a.routed-constant: cards under Routed are not in play, so they are not a villain in play", () => {
    const run = defeatVillain(heroes(onlySetAside(quiet(), "40072a")));
    const under = inst(run.state, routedOf(run.state)).tucked[0]!;
    expect(run.state.villains.filter((v) => !v.defeated).map((v) => v.instanceId)).toEqual([villainId(run.state)]);
    expect(run.state.encounterSetAside).not.toContain(under);
  });

  it("the third villain under Routed wins the game in stage 1; the fourth never enters play", () => {
    let s = heroes(quiet());
    for (let defeated = 1; defeated <= 3; defeated++) {
      expect(s.outcome).toBeNull();
      s = defeatVillain(s).state;
      expect(underRouted(s)).toHaveLength(defeated);
    }
    expect(s.outcome?.result).toBe("win");
    expect(
      setAsideNames(s).filter((n) =>
        ["Arclight", "Blockbuster", "Chimera", "Greycrow", "Harpoon", "Riptide", "Vertigo"].includes(n),
      ),
    ).toHaveLength(4);
    expect(s.villains).toHaveLength(3);
    expect(new Set(underRouted(s)).size).toBe(3);
  });

  it("in stage 2 the third defeat wins, with the Morlocks still in play", () => {
    const base = heroes(withUnderRouted(stage2({ how: "threat" }), 2));
    const run = defeatVillain(base);
    expect(run.state.outcome?.result).toBe("win");
    expect(morlocksOf(run.state, P1).length).toBeGreaterThan(0);
  });
});

/** A set-aside card put on top of the encounter deck (surgery), for a reveal in stage 1, when Hide! is still set aside. */
function setAsideToDeck(state: GameState, code: string): GameState {
  const id = state.encounterSetAside.find((i) => cardOf(state, i) === code);
  if (!id) throw new Error(`no set-aside ${code}`);
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterSetAside: state.encounterSetAside.filter((i) => i !== id),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck] } },
  };
}
/** The villain's next activation (the villain phase's own) is spent on a stun card: no attack, no scheme. */
const stunned = (state: GameState): GameState =>
  patchInstance(state, villainId(state), { statuses: { stunned: 1, confused: 0, tough: 0 } });
const damageOn = (s: GameState, id: InstanceId) => inst(s, id).damage;
/** Stage 2 by threat (no tough status cards on the Morlocks), every hero in hero form, undamaged. */
const table = (
  opts: { players?: Seats; villain?: string; underRouted?: number; modular?: readonly string[] } = {},
): GameState => heroes(withUnderRouted(stage2({ how: "threat", ...opts }), opts.underRouted ?? 0));

describe("Morlock (40079)", () => {
  it("a defeated Morlock goes to the victory display (Victory -1); damage from a card ability defeats it (Q7 = A)", () => {
    const base = table();
    const [first, second] = morlocksOf(base, P1);
    const s = damageAndDefeat(base, first!);
    expect(morlocksOf(s, P1)).toEqual([second]);
    expect(s.victoryDisplay).toContain(first);
  });

  it("a tough status card on a Morlock absorbs that damage", () => {
    const s = stage2({ how: "knock" });
    const [first] = morlocksOf(s, P1);
    const hit = damageAndDefeat(s, first!);
    expect(morlocksOf(hit, P1)).toHaveLength(2);
    expect(toughOn(hit, first!)).toBe(0);
    expect(damageOn(hit, first!)).toBe(4);
  });

  it("40079.morlock-constant: a card ability cannot remove it from play (Greycrow's discard of the highest-cost card does nothing)", () => {
    const base = table({ villain: "40073" });
    expect(base.players[0]!.playArea.filter((id) => cardOf(base, id) !== "40079")).toEqual([]);
    const o = round(base, { plan: { choose: "Discard the highest-cost card" } });
    expect(o.prompts.some((p) => p.labels.includes("Discard the highest-cost card you control"))).toBe(true);
    expect(morlocksOf(o.state, P1)).toHaveLength(2);
    expect(playerOf(o.state, P1).discard.some((id) => cardOf(o.state, id) === "40079")).toBe(false);
    expect(piles(o.state).discard.some((id) => cardOf(o.state, id) === "40079")).toBe(false);
  });

  it("40079.morlock-forced-interrupt: an enemy attacking you attacks a Morlock you control instead; the hero is untouched", () => {
    const base = table();
    const [first, second] = morlocksOf(base, P1);
    const run = round(base, { plan: { targets: [first!, second!] } });
    const attacks = attackResolved(run.events, villainId(base));
    expect(attacks).toHaveLength(1);
    // Each Morlock has the interrupt: the second one redirects the attack that now aims at another Morlock you control
    // (Q6 = A), so the last choice is where it lands.
    expect(attacks[0]!.targetInstanceId).toBe(second);
    expect(run.prompts.filter((p) => p.kind === "chooseTarget")).toHaveLength(2);
    for (const prompt of run.prompts.filter((p) => p.kind === "chooseTarget")) {
      expect(prompt.player).toBe(P1);
      expect(prompt.labels).toEqual(["Morlock", "Morlock"]);
    }
    expect(damageOn(run.state, second!)).toBeGreaterThan(0);
    expect(damageOn(run.state, second!)).toBe(attacks[0]!.damageDealt);
    expect(damageOn(run.state, first!)).toBe(0);
    expect(damageOn(run.state, identityOf(run.state, P1))).toBe(0);
  });

  it("with one Morlock left it is the only candidate: the attack is redirected to it (forced, never declined)", () => {
    const base = table();
    const [first, second] = morlocksOf(base, P1);
    const one = damageAndDefeat(base, first!);
    const run = round(ready(one));
    expect(run.prompts.filter((p) => p.kind === "chooseTarget").map((p) => p.labels)).toEqual([["Morlock"]]);
    expect(attackResolved(run.events, villainId(base))[0]!.targetInstanceId).toBe(second);
    expect(damageOn(run.state, identityOf(run.state, P1))).toBe(0);
  });

  it("the hero can still defend an attack that was redirected to a Morlock (RRG 1.8 p. 10)", () => {
    const base = table();
    const [first, second] = morlocksOf(base, P1);
    const hero = identityOf(base, P1);
    const run = round(base, { plan: { targets: [first!, second!], defender: hero } });
    const attack = attackResolved(run.events, villainId(base))[0]!;
    expect(run.events.some((e) => e.type === "defenderDeclared" && e.defenderInstanceId === hero)).toBe(true);
    expect(damageOn(run.state, second!)).toBe(0);
    expect(damageOn(run.state, hero)).toBeGreaterThan(0);
    expect(damageOn(run.state, hero)).toBe(attack.damageDealt);
  });

  it("2 players: an attack on a player attacks the Morlock that player controls", () => {
    const base = table({ players: TWO });
    const run = round(base);
    const attacks = attackResolved(run.events, villainId(base));
    expect(attacks).toHaveLength(2);
    expect(attacks.map((a) => a.targetInstanceId).sort()).toEqual(allMorlocks(base).sort());
    for (const player of base.players) {
      expect(damageOn(run.state, identityOf(run.state, player.playerId))).toBe(0);
    }
    // 5 and 6 damage on a 5 hit point Morlock each: the attacks landed on them and defeated them (no overkill: the heroes took none).
    for (const attack of attacks) {
      expect(attack.damageDealt).toBeGreaterThanOrEqual(5);
      expect(run.state.victoryDisplay).toContain(attack.targetInstanceId);
    }
  });
});

const inVillainArea = (s: GameState, code: string) => s.villainArea.filter((id) => cardOf(s, id) === code);
const boostFlips = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.filter((e) => e.type === "boostCardFlipped" && e.enemyInstanceId === enemy);
const schemes = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "schemeResolved" }> =>
      e.type === "schemeResolved" && e.enemyInstanceId === enemy,
  );

describe("Hide! (40080)", () => {
  it("40080.when-revealed: the player who revealed it gives a tough status card to the Morlock they choose, no other", () => {
    const base = stage2({ how: "threat" });
    const [first, second] = morlocksOf(base, P1);
    const run = round(base, { reveals: ["40080", "40084"], plan: { targets: [second!] } });
    expect(toughOn(run.state, second!)).toBe(1);
    expect(toughOn(run.state, first!)).toBe(0);
    const asked = run.prompts.filter((p) => p.kind === "chooseTarget");
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ player: P1, labels: ["Morlock", "Morlock"] });
  });

  it("only a Morlock that can take the status card is a valid target: with one already tough, the other is the only choice", () => {
    const base = stage2({ how: "threat" });
    const [first, second] = morlocksOf(base, P1);
    const marked = patchInstance(base, first!, { statuses: { stunned: 0, confused: 0, tough: 1 } });
    const run = round(marked, { reveals: ["40080", "40084"] });
    expect(run.prompts.filter((p) => p.kind === "chooseTarget").map((p) => p.labels)).toEqual([["Morlock"]]);
    expect(toughOn(run.state, first!)).toBe(1);
    expect(toughOn(run.state, second!)).toBe(1);
  });

  it("with every Morlock already tough nothing is asked and nothing changes (not a second tough card)", () => {
    const base = stage2({ how: "knock" });
    expect(allMorlocks(base).map((id) => toughOn(base, id))).toEqual([1, 1]);
    const run = round(base, { reveals: ["40080", "40084"] });
    expect(run.prompts.filter((p) => p.kind === "chooseTarget")).toEqual([]);
    expect(allMorlocks(run.state).map((id) => toughOn(run.state, id))).toEqual([1, 1]);
  });

  it("with no Morlock in play it does nothing, and Surge (data) still reveals the next encounter card", () => {
    const base = setAsideToDeck(quiet(), "40080");
    const run = round(base, { reveals: ["40080", "40084"] });
    expect(piles(run.state).discard.map((id) => cardOf(run.state, id))).toContain("40080");
    expect(inVillainArea(run.state, "40084")).toHaveLength(1);
    expect(run.prompts).toEqual([]);
    expect(run.state.outcome).toBeNull();
  });

  it("40080.boost: tough status card on a Morlock, and the villain gets 1 additional boost card for this activation", () => {
    const base = stage2({ how: "threat" });
    const [first, second] = morlocksOf(base, P1);
    const run = round(base, { boosts: ["40080", "01190"], plan: { targets: [second!] } });
    const villain = villainId(base);
    expect(boostFlips(run.events, villain)).toHaveLength(2);
    expect(schemes(run.events, villain)[0]!.boostIcons).toBe(2);
    expect(toughOn(run.state, second!)).toBe(1);
    expect(toughOn(run.state, first!)).toBe(0);
    // Near miss: a boost card with no such ability gives one card.
    const plain = round(base, { boosts: ["01190"] });
    expect(boostFlips(plain.events, villain)).toHaveLength(1);
  });
});

describe("Bolstered by Wrath (40082)", () => {
  it.each([0, 1, 2])(
    "40082.boost: +X boost icons for X = %i villains under Routed (the villain's scheme counts 1 + X)",
    (x) => {
      const base = withUnderRouted(quiet(), x);
      const run = round(withKnock(base, 0), { boosts: ["40082"], reveals: ["40084"] });
      const resolved = schemes(run.events, villainId(base));
      expect(resolved).toHaveLength(1);
      expect(resolved[0]!.boostIcons).toBe(1 + x);
      expect(resolved[0]!.threatPlaced).toBe(0 + 1 + x);
    },
  );

  const ACTION = "40082.bolstered-by-wrath-action";
  /** Revealed in stage 1 (attached to the villain), everybody in hero form, `underRouted` villains under Routed. */
  const bolstered = (underRouted: number) => {
    const base = quiet();
    const run = round(base, { reveals: ["40082"] });
    const card = inst(run.state, villainId(base)).attachments.find((id) => cardOf(run.state, id) === "40082")!;
    expect(card).toBeDefined();
    const staged = withUnderRouted(heroes(run.state), underRouted);
    // The hand is two Enhanced Spider-Sense (01004), 1 [mental] resource each (surgery; the old hand joins the deck).
    const owner = playerOf(staged, P1);
    const hand = [...owner.hand, ...owner.deck].filter((id) => cardOf(staged, id) === "01004").slice(0, 2);
    expect(hand).toHaveLength(2);
    const state: GameState = {
      ...staged,
      players: staged.players.map((p) =>
        p.playerId === P1 ? { ...p, hand, deck: [...p.hand, ...p.deck].filter((id) => !hand.includes(id)) } : p,
      ),
    };
    return { state, card, villain: villainId(base), hero: identityOf(state, P1), hand };
  };
  const spend = (ids: readonly InstanceId[]) => ids.map((fromHand) => ({ fromHand }));

  it("40082.bolstered-by-wrath-action: with no villain under Routed X is 0: exhaust a character, spend nothing, discard it", () => {
    const { state, card, villain, hero, hand } = bolstered(0);
    const run = drive(state, {}, use(P1, card, ACTION, [], { exhausted: [hero] }));
    expect(inst(run.state, villain).attachments).not.toContain(card);
    expect(piles(run.state).discard).toContain(card);
    expect(inst(run.state, hero).exhausted).toBe(true);
    expect(playerOf(run.state, P1).hand).toEqual(hand);
  });

  it("with 2 villains under Routed it costs 2 resources of any type: a 1-resource payment is refused, 2 pay it", () => {
    const { state, card, villain, hero, hand } = bolstered(2);
    const paid = hand;
    const short = applyCommand(
      state,
      use(P1, card, ACTION, spend(paid.slice(0, 1)), { exhausted: [hero] }),
      WAVE7_DEPS,
    );
    expect(short.ok).toBe(false);
    const run = drive(state, {}, use(P1, card, ACTION, spend(paid), { exhausted: [hero] }));
    expect(inst(run.state, villain).attachments).not.toContain(card);
    expect(piles(run.state).discard).toContain(card);
    expect(inst(run.state, hero).exhausted).toBe(true);
    expect(playerOf(run.state, P1).discard).toEqual(expect.arrayContaining(paid));
    expect(playerOf(run.state, P1).hand).toEqual([]);
  });

  it("with 2 villains under Routed, no payment is refused and the card stays attached", () => {
    const { state, card, hero } = bolstered(2);
    const result = applyCommand(state, use(P1, card, ACTION, [], { exhausted: [hero] }), WAVE7_DEPS);
    expect(result.ok).toBe(false);
  });

  it("with every character you control exhausted the cost cannot be paid", () => {
    const { state, card, hero } = bolstered(0);
    const spent = [hero, ...morlocksOf(state, P1)].reduce((s, id) => patchInstance(s, id, { exhausted: true }), state);
    expect(applyCommand(spent, use(P1, card, ACTION), WAVE7_DEPS).ok).toBe(false);
    expect(applyCommand(spent, use(P1, card, ACTION, [], { exhausted: [hero] }), WAVE7_DEPS).ok).toBe(false);
  });

  it("it is a Hero Action: not usable in alter-ego form", () => {
    const { state, card, hero } = bolstered(0);
    const alterEgo = withForm(state, "alterEgo", P1);
    expect(applyCommand(alterEgo, use(P1, card, ACTION, [], { exhausted: [hero] }), WAVE7_DEPS).ok).toBe(false);
  });
});

describe("Pushed to the Limit (40083)", () => {
  /** Revealed in stage 1: attached to the villain. */
  const attached = (opts: { underRouted?: number } = {}) => {
    const base = quiet();
    const run = round(base, { reveals: ["40083"] });
    const pushed = inst(run.state, villainId(base)).attachments.find((id) => cardOf(run.state, id) === "40083")!;
    expect(pushed).toBeDefined();
    return { state: withUnderRouted(run.state, opts.underRouted ?? 0), pushed, villain: villainId(base) };
  };
  const keywords = (s: GameState, id: InstanceId) =>
    (["steady", "stalwart"] as const).filter((k) => hasKeyword(s, id, k, WAVE7_DEPS));

  it("40083.pushed-to-the-limit-constant / -constant-2: steady with exactly 1 villain under Routed, stalwart with exactly 2, neither with none", () => {
    expect(keywords(attached().state, attached().villain)).toEqual([]);
    const one = attached({ underRouted: 1 });
    expect(keywords(one.state, one.villain)).toEqual(["steady"]);
    const two = attached({ underRouted: 2 });
    expect(keywords(two.state, two.villain)).toEqual(["stalwart"]);
  });

  it("only the attached villain gains the keyword, and only while the card is attached", () => {
    const one = attached({ underRouted: 1 });
    const gone = {
      ...one.state,
      instances: {
        ...one.state.instances,
        [one.villain]: {
          ...one.state.instances[one.villain]!,
          attachments: inst(one.state, one.villain).attachments.filter((id) => id !== one.pushed),
        },
      },
    };
    expect(hasKeyword(gone, one.villain, "steady", WAVE7_DEPS)).toBe(false);
  });

  it("40083.pushed-to-the-limit-action: the attached villain attacks you in full, then this card is discarded", () => {
    const { state, pushed, villain } = attached();
    const hero = heroes(state);
    const run = drive(hero, {}, use(P1, pushed, "40083.pushed-to-the-limit-action"));
    const attacks = attackResolved(run.events, villain);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]!.targetInstanceId).toBe(identityOf(run.state, P1));
    expect(boostFlips(run.events, villain)).toHaveLength(1);
    expect(inst(run.state, villain).attachments).not.toContain(pushed);
    expect(piles(run.state).discard).toContain(pushed);
  });

  it("not offered while the villain could not attack: stunned (Q13 = B)", () => {
    const { state, pushed, villain } = attached();
    const stunnedVillain = patchInstance(heroes(state), villain, { statuses: { stunned: 1, confused: 0, tough: 0 } });
    const result = applyCommand(stunnedVillain, use(P1, pushed, "40083.pushed-to-the-limit-action"), WAVE7_DEPS);
    expect(result.ok).toBe(false);
  });

  it("it is a Hero Action: not usable in alter-ego form", () => {
    const { state, pushed } = attached();
    const result = applyCommand(state, use(P1, pushed, "40083.pushed-to-the-limit-action"), WAVE7_DEPS);
    expect(result.ok).toBe(false);
  });
});

describe("the four side schemes (40084-40087): When Revealed", () => {
  const SIDE = [
    ["40084", "By Any Means", 3],
    ["40085", "In the Midst of Chaos", 3],
    ["40086", "Maraudin' Ain't Easy", 3],
    ["40087", "Territorial Control", 4],
  ] as const;
  const reveal = (code: string, players: Seats, under: number) => {
    const base = withUnderRouted(quiet({ players }), under);
    const run = round(withKnock(base, 0), { reveals: [code, QUIET_REVEAL] });
    return inVillainArea(run.state, code).map((id) => inst(run.state, id).threat);
  };

  it.each(SIDE)(
    "%s %s: 1 per hero additional threat for each villain under Routed, on top of %i",
    (code, _name, start) => {
      expect(reveal(code, ONE, 0)).toEqual([start]);
      expect(reveal(code, ONE, 1)).toEqual([start + 1]);
      expect(reveal(code, ONE, 2)).toEqual([start + 2]);
    },
  );

  it.each(SIDE)("%s %s: per hero means 2 per villain in a 2-player game", (code, _name, start) => {
    expect(reveal(code, TWO, 0)).toEqual([start]);
    expect(reveal(code, TWO, 2)).toEqual([start + 4]);
  });

  it("Territorial Control has assault (data)", () => {
    const base = quiet();
    const run = round(base, { reveals: ["40087"] });
    const id = inVillainArea(run.state, "40087")[0]!;
    expect(hasKeyword(run.state, id, "assault", WAVE7_DEPS)).toBe(true);
  });
});

describe("Back in Action (40088)", () => {
  it.each([0, 1, 2])(
    "40088.when-revealed: the villain gets a tough status card, and %i threat goes on the main scheme (villains under Routed)",
    (x) => {
      const base = withKnock(withUnderRouted(quiet(), x), 0);
      expect(toughOn(base, villainId(base))).toBe(0);
      const run = round(base, { reveals: ["40088"] });
      expect(toughOn(run.state, villainId(base))).toBe(1);
      const card = run.state.instances;
      const placed = run.events.filter(
        (e) =>
          e.type === "threatPlaced" &&
          e.schemeInstanceId === mainOf(base) &&
          e.sourceInstanceId !== null &&
          card[e.sourceInstanceId]?.cardId === "40088",
      );
      expect(placed.reduce((sum, e) => sum + (e.type === "threatPlaced" ? e.amount : 0), 0)).toBe(x);
    },
  );

  it("40088.boost: with a Morlock, either 1 damage to it or spend 1 resource: both offered", () => {
    const base = stage2({ how: "threat" });
    const [first, second] = morlocksOf(base, P1);
    const dmg = round(base, {
      boosts: ["40088"],
      reveals: ["40088"],
      plan: { choose: "Deal 1 damage", targets: [second!] },
    });
    expect(dmg.prompts.find((p) => p.kind === "chooseOption")!.labels).toEqual([
      "Deal 1 damage to a Morlock ally you control",
      "Spend 1 resource of any type",
    ]);
    expect(damageOn(dmg.state, second!)).toBe(1);
    expect(damageOn(dmg.state, first!)).toBe(0);
    expect(playerOf(dmg.state, P1).discard).toEqual([]);
  });

  it("40088.boost: the other option spends 1 resource of any type (a hand card) and damages nothing", () => {
    const base = stage2({ how: "threat" });
    const card = playerOf(base, P1).hand[0]!;
    const spend = round(base, {
      boosts: ["40088"],
      reveals: ["40088"],
      plan: { choose: "Spend", pay: [nameOf(base, card)] },
    });
    expect(playerOf(spend.state, P1).discard).toContain(card);
    expect(allMorlocks(spend.state).map((id) => damageOn(spend.state, id))).toEqual([0, 0]);
  });

  it("40088.boost: with no resource to spend only the damage is offered (Q8 = A) and is forced (hero form: Peter Parker's alter-ego generates a resource)", () => {
    const base = table();
    const empty = {
      ...base,
      players: base.players.map((p) => ({ ...p, hand: [], deck: [], discard: [] })),
    };
    const run = round(empty, { boosts: ["40088"], reveals: ["40088"] });
    expect(run.prompts.flatMap((p) => p.labels).filter((l) => l.startsWith("Spend 1 resource"))).toEqual([]);
    const boostCard = Object.keys(run.state.instances).find(
      (id) => cardOf(run.state, id as InstanceId) === "40088",
    ) as InstanceId;
    const ping = run.events.filter(
      (e) =>
        e.type === "damageDealt" &&
        e.amount === 1 &&
        allMorlocks(base).includes(e.targetInstanceId) &&
        e.sourceInstanceId !== null &&
        cardOf(run.state, e.sourceInstanceId) === "40088",
    );
    expect(ping).toHaveLength(1);
    expect(boostCard).toBeDefined();
  });

  it("40088.boost: with no Morlock you control nothing happens: no choice, no resource spent", () => {
    const base = quiet();
    const hand = playerOf(base, P1).hand.length;
    const run = round(base, { boosts: ["40088"], reveals: ["40088"] });
    expect(run.prompts).toEqual([]);
    expect(playerOf(run.state, P1).discard).toEqual([]);
    expect(playerOf(run.state, P1).hand.length).toBeGreaterThanOrEqual(hand);
  });
});

describe("Seek the Weak (40089)", () => {
  it("40089.when-revealed-alter-ego: this card gains surge: the next encounter card is revealed, and the villain does not attack", () => {
    const base = quiet();
    const run = round(base, { reveals: ["40089", "40084"] });
    expect(inVillainArea(run.state, "40084")).toHaveLength(1);
    expect(attackResolved(run.events)).toEqual([]);
    expect(piles(run.state).discard.map((id) => cardOf(run.state, id))).toContain("40089");
  });

  /** Both Morlocks at 4 damage of 5 (stage 2, hero form); the villain's own activation is spent on a stun card. */
  const weakened = (under: number) => {
    const base = stunned(table({ underRouted: under }));
    const [first, second] = morlocksOf(base, P1);
    return {
      state: patchInstance(withDamage(base, first!, 4), second!, { damage: 4 }),
      first: first!,
      second: second!,
    };
  };

  it.each([
    [0, false],
    [1, true],
    [2, true],
  ])(
    "40089.when-revealed-hero: with %i villains under Routed the villain's attack on you has overkill: %s",
    (under, overkill) => {
      const { state, first, second } = weakened(under);
      // The other Morlock defends: a defending ally's excess goes to its controller's identity (RRG 1.8 p. 10).
      const run = round(state, { boosts: [], reveals: ["40089"], plan: { targets: [first, first], defender: second } });
      const attacks = attackResolved(run.events, villainId(state));
      expect(attacks).toHaveLength(1);
      expect(attacks[0]!.targetInstanceId).toBe(second);
      const total = attacks[0]!.baseAtk + attacks[0]!.boostIcons;
      expect(total).toBeGreaterThan(1);
      expect(run.state.victoryDisplay).toContain(second);
      // 1 hit point left on the Morlock: with overkill the rest of the damage reaches the hero.
      expect(damageOn(run.state, identityOf(run.state, P1))).toBe(overkill ? total - 1 : 0);
    },
  );

  it("40089.boost: an attack gains overkill: the excess damage from a defeated Morlock reaches the hero", () => {
    const base = table();
    const [first, second] = morlocksOf(base, P1);
    const weak = patchInstance(withDamage(base, first!, 4), second!, { damage: 4 });
    const plan = { targets: [first!, first!], defender: second! };
    const overkill = round(weak, { boosts: ["40089"], plan });
    const [attack] = attackResolved(overkill.events, villainId(base));
    expect(attack!.targetInstanceId).toBe(second);
    expect(overkill.state.victoryDisplay).toContain(second);
    expect(damageOn(overkill.state, identityOf(overkill.state, P1))).toBe(attack!.baseAtk + attack!.boostIcons - 1);
    // Near miss: a boost card without it stops at the Morlock.
    const plain = round(weak, { boosts: ["01189"], plan });
    expect(plain.state.victoryDisplay).toContain(second);
    expect(damageOn(plain.state, identityOf(plain.state, P1))).toBe(0);
  });

  // RRG 1.8 "Attacks Against Allies" (p. 10): "whether that ally was the attacked ally or a defending ally". A Morlock
  // the redirect aims the attack at is the attacked ally.
  it("40089.boost: the excess damage of an overkill attack on the ATTACKED Morlock (nobody defends) reaches the hero (RRG 1.8 p. 10)", () => {
    const base = table();
    const [first, second] = morlocksOf(base, P1);
    const weak = patchInstance(withDamage(base, first!, 4), second!, { damage: 4 });
    const run = round(weak, { boosts: ["40089"], plan: { targets: [first!, first!] } });
    const [attack] = attackResolved(run.events, villainId(base));
    expect(attack!.targetInstanceId).toBe(first);
    expect(damageOn(run.state, identityOf(run.state, P1))).toBe(attack!.baseAtk + attack!.boostIcons - 1);
  });

  it("40089.boost: during a scheme activation (alter-ego) it does nothing", () => {
    const base = quiet();
    const run = round(base, { boosts: ["40089"] });
    expect(schemes(run.events, villainId(base))).toHaveLength(1);
    expect(attackResolved(run.events)).toEqual([]);
    expect(run.state.outcome).toBeNull();
  });
});

describe("Marauders: a minion that shares the villain's title (owner decision Q4 = A, RRG 1.8 p. 46, MC40 p. 21)", () => {
  it("it is discarded and the player is dealt a facedown encounter card, which is revealed", () => {
    const base = quiet({ modular: ["mutant_slayers"] });
    const run = round(base, { reveals: ["40095", "40084"] });
    const minion = run.state.instances;
    const blockbusterMinions = Object.keys(minion).filter(
      (id) => minion[id as InstanceId]!.cardId === "40095",
    ) as InstanceId[];
    expect(blockbusterMinions).toHaveLength(1);
    expect(piles(run.state).discard).toContain(blockbusterMinions[0]);
    expect(playerOf(run.state, P1).playArea).not.toContain(blockbusterMinions[0]);
    expect(inVillainArea(run.state, "40084")).toHaveLength(1);
    expect(villainId(run.state)).toBe(villainId(base));
  });

  it("a minion of another title enters play and no extra card is dealt", () => {
    const base = quiet({ modular: ["mutant_slayers"] });
    const run = round(base, { reveals: ["40094", "40084"] });
    const arclight = Object.keys(run.state.instances).find(
      (id) => run.state.instances[id as InstanceId]!.cardId === "40094",
    ) as InstanceId;
    expect(playerOf(run.state, P1).playArea).toContain(arclight);
    expect(inVillainArea(run.state, "40084")).toHaveLength(0);
  });
});

/**
 * Whole games of the scenario, played by the card-name-agnostic greedy driver (`../../testing/driver.ts`) with a Core
 * hero (Spider-Man, Justice) to a real outcome; the session log must replay to the identical final state. Military
 * Grade and Mutant Slayers (the scenario's two modular sets) are not scripted yet, so these games run with none: the
 * set's own cards, the Marauders and the Standard (or Expert) set.
 */
describe.each(["standard", "expert"] as const)("Morlock Siege (%s) with a Core hero", (difficulty) => {
  it("plays to an outcome and replays deep-equal", () => {
    const config = wave7Scenario("morlock-siege", {
      players: ONE,
      seed: 2026,
      difficulty,
      modularSetIds: [],
    });
    const created = createGame(config, WAVE7_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE7_DEPS);
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE7_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 180_000);
});
