import {
  activeEncounterDeck,
  applyCommand,
  cardsInPlay,
  createGame,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
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
  runWith,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, driveStepwise, withForm } from "../../../testing/staging.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { wave11Scenario } from "../../setup.js";
import {
  FNE_SCENARIOS_STOP_THE_PRESSES as REGISTRY,
  FNE_SCENARIOS_STOP_THE_PRESSES_SKIPPED as SKIPPED,
} from "./stop-the-presses.js";

vi.setConfig({ testTimeout: 180_000 });

/**
 * The Stop the Presses! scenario (docs/phase7-wave11-scenarios.md section S7, task S11), played through
 * `wave11Scenario("stop-the-presses", { villainSetId: "hammerhead" })`.
 */
const MAIN = "60151a";
const ENVIRONMENT = "60152";
const BEN = "60153";
const BETTY = "60154";
const JJJ = "60155";
const ROBBIE = "60156";
const INTERVIEW = "60157";
const NEWS = "60158";
const SUPPORTS = [BEN, BETTY, JJJ, ROBBIE];
/** Core encounter cards with no boost icon and no boost ability (treacheries): blank boost cards. */
const BLANKS = ["01187", "01187", "01186", "01186"];
/** A Maggia minion: dealt as filler, it engages the player it is dealt to and does nothing else this phase. */
const ENFORCERS = "60092";
const REFS = [
  "60151a.setup",
  "60151b.stop-the-presses-forced-response",
  "60151b.stop-the-presses-constant",
  "60152.daily-bugle-action",
  "60153.ben-urich-action",
  "60154.betty-brant-interrupt",
  "60155.j-jonah-jameson-action",
  "60156.robbie-robertson-response",
  "60157.exclusive-interview-constant",
  "60157.when-revealed",
  "60158.when-revealed",
  "60158.boost",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const copy = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const mainId = (s: GameState): InstanceId => s.mainScheme.instanceId;
const mainThreat = (s: GameState): number => inst(s, mainId(s)).threat;
const withThreat = (s: GameState, n: number): GameState => patchInstance(s, mainId(s), { threat: n });
const stamina = (s: GameState, id: InstanceId): number => inst(s, id).counters.stamina ?? 0;
const inPlay = (s: GameState, code: string): boolean => cardsInPlay(s).some((i) => codeOf(s, i) === code);
const controllerOf = (s: GameState, id: InstanceId): PlayerId | null => inst(s, id).controllerId as PlayerId | null;
/** The Daily Bugle supports in play, by card code. */
const inPlaySupports = (s: GameState): string[] =>
  cardsInPlay(s)
    .map((i) => codeOf(s, i))
    .filter((c) => SUPPORTS.includes(c))
    .sort();
const removedCodes = (s: GameState): string[] => s.removedFromGame.map((i) => codeOf(s, i)).sort();
/** The support `player` controls. */
const supportOf = (s: GameState, player: PlayerId = P1): InstanceId =>
  cardsInPlay(s).find((i) => SUPPORTS.includes(codeOf(s, i)) && controllerOf(s, i) === player)!;
const clear = { stunned: 0, confused: 0, tough: 0 };

function config(opts: { players?: number; seed?: number; difficulty?: "standard" | "expert"; villainSetId?: string }) {
  const { players = 1, seed = 1, difficulty = "standard", villainSetId = "hammerhead" } = opts;
  const seats = [
    { starterDeckId: "core-spider-man-justice" },
    { starterDeckId: "core-captain-marvel-leadership" },
    { starterDeckId: "core-black-panther-protection" },
    { starterDeckId: "core-iron-man-aggression" },
  ];
  return wave11Scenario("stop-the-presses", {
    villainSetId,
    players: seats.slice(0, players),
    seed,
    difficulty,
  } as never);
}

function rawGame(opts: Parameters<typeof config>[0] = {}): GameState {
  const created = createGame(config(opts), WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return created.state;
}

function newGame(opts: Parameters<typeof config>[0] = {}): GameState {
  const players = opts.players ?? 1;
  let s = settle(rawGame(opts), firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
  for (let n = 0; n < players; n++)
    s = withForm(s, { heroForm: 0 }, (["p1", "p2", "p3", "p4"] as const)[n] as PlayerId);
  return s;
}

/** Takes the first option whose label contains one of `texts` when one is offered, else the first legal answer. */
const labelled =
  (...texts: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const hit = choice.options.find((o) => texts.some((t) => o.label.includes(t)));
    return hit ? [hit.optionId] : s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s);
  };
const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));

/**
 * `boosts` blank boost cards, then these cards dealt, then the villain phase after every player ends their turn. The
 * villain is bare and free of status cards, so it attacks the hero in hero form.
 */
function villainPhase(state: GameState, boosts: number, dealt: readonly string[], pick: Picker = declines) {
  const stacked = stackEncounterDeck(state, ...BLANKS.slice(0, boosts), ...dealt);
  const turns = state.players.map((p) => endTurn(p.playerId));
  return driveEventsPicking(WAVE11_DEPS, stacked, pick, ...turns);
}
const drive = (state: GameState, command: Command, pick: Picker = firstLegal): GameState =>
  driveEventsPicking(WAVE11_DEPS, state, pick, command).state;
const optionLabels = (s: GameState): string[] => s.pendingChoice?.options.map((o) => o.label) ?? [];

describe("registry", () => {
  it("registers every printed ref of the eight cards; nothing is skipped", () => {
    const printed = [MAIN, ENVIRONMENT, BEN, BETTY, JJJ, ROBBIE, INTERVIEW, NEWS].flatMap((c) =>
      abilityRefIds(data(c)),
    );
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("Stop the Presses! 60151a setup", () => {
  it("60151a.setup: the Daily Bugle is in play, out of the encounter deck", () => {
    const s = newGame();
    expect(inPlay(s, ENVIRONMENT)).toBe(true);
    expect(activeEncounterDeck(s).deck.map((i) => codeOf(s, i))).not.toContain(ENVIRONMENT);
  });

  it("60151a.setup: one player gets one support with 3 stamina counters; the other three are removed from the game", () => {
    const s = newGame();
    const mine = inPlaySupports(s);
    expect(mine).toHaveLength(1);
    expect(controllerOf(s, supportOf(s))).toBe(P1);
    expect(stamina(s, supportOf(s))).toBe(3);
    expect(removedCodes(s)).toEqual(SUPPORTS.filter((c) => c !== mine[0]).sort());
    // Nothing is left set aside: the supports are all in play or recorded as removed.
    expect(s.encounterSetAside.map((i) => codeOf(s, i)).filter((c) => SUPPORTS.includes(c))).toEqual([]);
  });

  it("60151a.setup: each of two players gets a different support under their control", () => {
    const s = newGame({ players: 2 });
    expect(inPlaySupports(s)).toHaveLength(2);
    const [a, b] = [supportOf(s, P1), supportOf(s, P2)];
    expect(codeOf(s, a)).not.toBe(codeOf(s, b));
    expect(stamina(s, a)).toBe(3);
    expect(stamina(s, b)).toBe(3);
    expect(removedCodes(s)).toHaveLength(2);
    expect([...inPlaySupports(s), ...removedCodes(s)].sort()).toEqual([...SUPPORTS].sort());
  });

  it("60151a.setup: four players use all four supports and remove none", () => {
    const s = newGame({ players: 4 });
    expect(inPlaySupports(s)).toEqual([...SUPPORTS].sort());
    expect(removedCodes(s)).toEqual([]);
    for (const p of ["p1", "p2", "p3", "p4"] as const) expect(controllerOf(s, supportOf(s, p as PlayerId))).toBe(p);
  });

  it("60151a.setup: the support dealt is random (the seeded RNG): other seeds deal others, the same seed the same", () => {
    const dealt = (seed: number): string => {
      const s = newGame({ seed });
      return codeOf(s, supportOf(s));
    };
    const codes = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(dealt));
    expect(codes.size).toBeGreaterThan(1);
    expect(dealt(3)).toBe(dealt(3));
  });

  it("the main scheme starts with 1 threat per hero, its target is 9 per hero", () => {
    expect(mainThreat(newGame({ players: 1 }))).toBe(1);
    expect(mainThreat(newGame({ players: 2 }))).toBe(2);
    expect(data(MAIN).stages[0].targetThreat).toEqual({ base: 0, perPlayer: 9 });
  });
});

describe("Stop the Presses! 60151b Forced Response (an undefended attack)", () => {
  const THREAT = "Place 2 threat";
  const STAMINA = "Remove 1 stamina counter";
  /** One villain phase (hero in hero form, bare villain, a blank boost card) answering the choice with `pick`. */
  const phase = (s: GameState, pick: Picker, players = 1) =>
    villainPhase(s, players, Array(players).fill(ENFORCERS), pick);

  it("60151b.stop-the-presses-forced-response: choosing threat places 2 here; choosing stamina removes 1 from your support", () => {
    const s = newGame();
    const support = supportOf(s);
    const byThreat = phase(s, labelled(THREAT)).state;
    const byStamina = phase(s, labelled(STAMINA)).state;
    expect(stamina(byThreat, support)).toBe(3);
    expect(stamina(byStamina, support)).toBe(2);
    expect(mainThreat(byThreat) - mainThreat(byStamina)).toBe(2);
  });

  it("60151b.stop-the-presses-forced-response: the prompt offers both options", () => {
    const s = newGame();
    const stacked = stackEncounterDeck(s, BLANKS[0]!, ENFORCERS);
    const seen: string[][] = [];
    driveEventsPicking(
      WAVE11_DEPS,
      stacked,
      (st) => {
        if (st.pendingChoice!.options.some((o) => o.label.includes(THREAT))) seen.push(optionLabels(st));
        return declines(st);
      },
      endTurn(P1),
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]!.some((l) => l.includes(THREAT))).toBe(true);
    expect(seen[0]!.some((l) => l.includes(STAMINA))).toBe(true);
  });

  it("60151b.stop-the-presses-forced-response: expert mode places 3 threat instead of 2", () => {
    const s = newGame({ difficulty: "expert" });
    const delta = mainThreat(phase(s, labelled(THREAT)).state) - mainThreat(phase(s, labelled(STAMINA)).state);
    expect(delta).toBe(3);
  });

  it("60151b.stop-the-presses-forced-response: an attack the hero defends does not trigger it", () => {
    const s = newGame();
    const defended: Picker = (st) =>
      st.pendingChoice!.prompt.kind === "declareDefender"
        ? [st.pendingChoice!.options.find((o) => o.optionId !== "decline")!.optionId]
        : labelled(THREAT)(st);
    const asked: string[] = [];
    const run = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(s, BLANKS[0]!, ENFORCERS),
      (st) => {
        if (st.pendingChoice!.options.some((o) => o.label.includes(THREAT))) asked.push("asked");
        return defended(st);
      },
      endTurn(P1),
    );
    // The hero defended (a defender was declared), so no undefended attack happened.
    expect(run.events.some((e) => e.type === "defenderDeclared")).toBe(true);
    expect(asked).toEqual([]);
  });

  it("60151b.stop-the-presses-forced-response: with two players the attacked player removes the stamina from the support they control", () => {
    const s = newGame({ players: 2 });
    const done = phase(s, labelled(STAMINA), 2).state;
    // Each hero is attacked undefended in turn and each removes one from their own support.
    expect(stamina(done, supportOf(s, P1))).toBe(2);
    expect(stamina(done, supportOf(s, P2))).toBe(2);
  });

  it("60151b.stop-the-presses-forced-response: a player who controls no Daily Bugle support can only place the threat", () => {
    const s = newGame();
    const orphan = patchInstance(s, supportOf(s), { controllerId: null });
    const asked: string[][] = [];
    const done = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(orphan, BLANKS[0]!, ENFORCERS),
      (st) => {
        const text = optionLabels(st);
        if (text.some((l) => l.includes(STAMINA))) asked.push(text);
        return labelled(STAMINA, THREAT)(st);
      },
      endTurn(P1),
    ).state;
    // The stamina option never appears, and the threat is placed whatever the picker prefers.
    expect(asked).toEqual([]);
    expect(mainThreat(done) - mainThreat(phase(s, labelled(STAMINA)).state)).toBe(2);
    expect(stamina(done, supportOf(s))).toBe(3);
  });

  it("60151b.stop-the-presses-constant: removing a support's last stamina counter discards it and the players lose", () => {
    const s = newGame();
    const low = patchInstance(s, supportOf(s), { counters: { stamina: 1 } });
    const done = phase(low, labelled(STAMINA)).state;
    expect(done.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });

  it("60151b.stop-the-presses-constant: the same attack choosing threat with 1 stamina left does not lose", () => {
    const s = newGame();
    const low = patchInstance(s, supportOf(s), { counters: { stamina: 1 } });
    const done = phase(low, labelled(THREAT)).state;
    expect(done.outcome).toBeFalsy();
    expect(stamina(done, supportOf(done))).toBe(1);
  });
});

/** Seeds whose setup deals these supports (the dealt support is random from the game seed, so tests search for one). */
const searched = new Map<string, number>();
function gameWith(codes: readonly string[], opts: { difficulty?: "standard" | "expert" } = {}): GameState {
  const key = `${codes.join("+")}:${opts.difficulty ?? "standard"}`;
  const players = codes.length;
  const known = searched.get(key);
  const matches = (s: GameState): boolean =>
    codes.every((code, n) => codeOf(s, supportOf(s, (["p1", "p2", "p3", "p4"] as const)[n] as PlayerId)) === code);
  if (known !== undefined) return newGame({ ...opts, players, seed: known });
  for (let seed = 1; seed <= 80; seed++) {
    const s = newGame({ ...opts, players, seed });
    if (matches(s)) {
      searched.set(key, seed);
      return s;
    }
  }
  throw new Error(`no seed in 1-80 deals ${codes.join(", ")}`);
}
const deckCodes = (s: GameState): string[] => activeEncounterDeck(s).deck.map((i) => codeOf(s, i));
const discardCodes = (s: GameState): string[] => activeEncounterDeck(s).discard.map((i) => codeOf(s, i));

describe("Daily Bugle 60152", () => {
  const ref = "60152.daily-bugle-action";
  const env = (s: GameState): InstanceId => copy(s, ENVIRONMENT);
  const asAlterEgo = (s: GameState, n = 1): GameState => {
    let t = s;
    for (let k = 0; k < n; k++) t = withForm(t, "alterEgo", (["p1", "p2"] as const)[k] as PlayerId);
    return t;
  };

  it("60152.daily-bugle-action: exhausts a ready support you control and places 1 stamina counter on it", () => {
    const s = asAlterEgo(newGame());
    const support = supportOf(s);
    const done = drive(s, use(P1, env(s), ref, [], { exhausted: [support] } as never));
    expect(inst(done, support).exhausted).toBe(true);
    expect(stamina(done, support)).toBe(4);
  });

  it("60152.daily-bugle-action: an exhausted support cannot pay the cost", () => {
    const s = asAlterEgo(newGame());
    const tired = patchInstance(s, supportOf(s), { exhausted: true });
    const result = applyCommand(tired, use(P1, env(s), ref, [], { exhausted: [supportOf(s)] } as never), WAVE11_DEPS);
    expect(result.ok).toBe(false);
  });

  it("60152.daily-bugle-action: it is an Alter-Ego Action, refused in hero form", () => {
    const s = newGame();
    const result = applyCommand(s, use(P1, env(s), ref, [], { exhausted: [supportOf(s)] } as never), WAVE11_DEPS);
    expect(result.ok).toBe(false);
  });

  it("60152.daily-bugle-action: any player can do this, each only with their own support", () => {
    const s = asAlterEgo(newGame({ players: 2 }), 2);
    const [mine, theirs] = [supportOf(s, P2), supportOf(s, P1)];
    // P2 does not control the environment and may still use it, on their own support.
    const done = drive(s, use(P2, env(s), ref, [], { exhausted: [mine] } as never));
    expect(stamina(done, mine)).toBe(4);
    expect(stamina(done, theirs)).toBe(3);
    // But not on a support another player controls.
    const stolen = applyCommand(s, use(P2, env(s), ref, [], { exhausted: [theirs] } as never), WAVE11_DEPS);
    expect(stolen.ok).toBe(false);
  });
});

describe("Ben Urich 60153", () => {
  const ref = "60153.ben-urich-action";
  const A = "01186";
  const B = "01187";
  const C = "01188";
  const base = (): GameState => stackEncounterDeck(gameWith([BEN]), A, B, C);
  const ben = (s: GameState): InstanceId => supportOf(s);
  const pickCard =
    (name: string | null): Picker =>
    (st) => {
      const hit = name === null ? undefined : st.pendingChoice!.options.find((o) => o.label.includes(name));
      return hit ? [hit.optionId] : firstLegal(st);
    };

  it("60153.ben-urich-action: shows the top 2 cards; discarding 1 leaves the other on top, the third untouched", () => {
    const s = base();
    expect(deckCodes(s).slice(0, 3)).toEqual([A, B, C]);
    const done = driveEventsPicking(WAVE11_DEPS, s, pickCard("Assault"), use(P1, ben(s), ref)).state;
    expect(deckCodes(done).slice(0, 2)).toEqual([A, C]);
    expect(discardCodes(done)).toContain(B);
    expect(discardCodes(done).filter((c) => c === B)).toHaveLength(discardCodes(s).filter((c) => c === B).length + 1);
    expect(inst(done, ben(done)).exhausted).toBe(true);
    expect(stamina(done, ben(done))).toBe(2);
  });

  it("60153.ben-urich-action: discarding the first leaves the second on top, in the same order", () => {
    const s = base();
    const done = driveEventsPicking(WAVE11_DEPS, s, pickCard("Advance"), use(P1, ben(s), ref)).state;
    expect(deckCodes(done).slice(0, 2)).toEqual([B, C]);
    expect(discardCodes(done)).toContain(A);
  });

  it("60153.ben-urich-action: the discard is optional: the deck is left exactly as it was", () => {
    const s = base();
    const done = driveEventsPicking(WAVE11_DEPS, s, pickCard(null), use(P1, ben(s), ref)).state;
    expect(deckCodes(done)).toEqual(deckCodes(s));
    expect(discardCodes(done)).toEqual(discardCodes(s));
    expect(stamina(done, ben(done))).toBe(2);
  });

  it("60153.ben-urich-action: it costs a ready Ben Urich: refused while he is exhausted", () => {
    const s = base();
    const tired = patchInstance(s, ben(s), { exhausted: true });
    expect(applyCommand(tired, use(P1, ben(s), ref), WAVE11_DEPS).ok).toBe(false);
  });

  it("60153.ben-urich-action: spending his last stamina counter discards him and the players lose the game", () => {
    const s = base();
    const last = patchInstance(s, ben(s), { counters: { stamina: 1 } });
    const done = driveEventsPicking(WAVE11_DEPS, last, pickCard(null), use(P1, ben(s), ref)).state;
    expect(done.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });
});

describe("Betty Brant 60154", () => {
  const ref = "60154.betty-brant-interrupt";
  const ONE_ICON = "01188"; // Caught Off Guard, 1 boost icon
  const OTHER_ONE_ICON = "01189"; // Gang-Up, 1 boost icon
  const BLANK = "01187"; // Assault, no icon, no Boost ability
  const betty = (s: GameState): InstanceId => supportOf(s);
  const isTriggerPrompt = (st: GameState): boolean => st.pendingChoice!.prompt.kind === "chooseTriggers";
  /** Uses Betty when she is offered, otherwise declines like `declines`. */
  const withBetty: Picker = (st) => {
    const hit = st.pendingChoice!.options.find((o) => o.label.includes("Betty"));
    return hit ? [hit.optionId] : declines(st);
  };
  const heroDamage = (s: GameState): number => inst(s, hero(s)).damage;
  /**
   * One villain phase against the lone hero, undefended, with these boost cards on top and the answers of `pick`;
   * `before` may change the state at each prompt. The ready step runs as the player phase ends, so a card is ready
   * when the villain phase begins.
   */
  const attacked = (
    s: GameState,
    boosts: readonly string[],
    pick: Picker,
    before: (st: GameState) => GameState = (st) => st,
  ) => {
    const started = runWith(
      WAVE11_DEPS,
      stackEncounterDeck(patchInstance(s, hero(s), { statuses: clear }), ...boosts, ENFORCERS),
      endTurn(P1),
    );
    let atResponse: GameState | null = null;
    const run = driveStepwise(
      WAVE11_DEPS,
      started,
      (st) => {
        if (!st.pendingChoice!.options.some((o) => o.label.includes("Place 2 threat"))) return pick(st);
        atResponse ??= st;
        return labelled("Place 2 threat")(st);
      },
      before,
    );
    // `atResponse`: the state just after the attack, before the encounter cards are dealt (which differ with the boost cards used).
    return { ...run, atResponse: atResponse as GameState | null };
  };

  it("60154.betty-brant-interrupt: cancels the boost icons of the card turned faceup, and the enemy gets another boost card", () => {
    const s = gameWith([BETTY]);
    const plain = attacked(s, [ONE_ICON, BLANK], declines);
    const blankSecond = attacked(s, [ONE_ICON, BLANK], withBetty);
    const iconSecond = attacked(s, [ONE_ICON, OTHER_ONE_ICON], withBetty);
    // Without Betty the 1-icon card counts. With her it counts for nothing and the next card is the one that counts:
    // a blank one takes the icon away, another 1-icon card puts it back.
    const at = (r: ReturnType<typeof attacked>): GameState => r.atResponse!;
    expect(heroDamage(at(plain)) - heroDamage(at(blankSecond))).toBe(1);
    expect(heroDamage(at(iconSecond))).toBe(heroDamage(at(plain)));
    expect(heroDamage(at(plain))).toBeGreaterThan(0);
    expect(stamina(blankSecond.state, betty(blankSecond.state))).toBe(2);
    expect(inst(blankSecond.state, betty(blankSecond.state)).exhausted).toBe(true);
  });

  it("60154.betty-brant-interrupt: both boost cards are turned over and discarded", () => {
    const s = gameWith([BETTY]);
    const done = attacked(s, [ONE_ICON, OTHER_ONE_ICON], withBetty).atResponse!;
    expect(discardCodes(done)).toEqual(expect.arrayContaining([ONE_ICON, OTHER_ONE_ICON]));
    const declined = attacked(s, [ONE_ICON, OTHER_ONE_ICON], declines).atResponse!;
    // Declined: only the first card is used; the second stays in the deck.
    expect(discardCodes(declined)).toContain(ONE_ICON);
    expect(discardCodes(declined)).not.toContain(OTHER_ONE_ICON);
  });

  it("60154.betty-brant-interrupt: declining her spends nothing", () => {
    const s = gameWith([BETTY]);
    const kept = attacked(s, [ONE_ICON, BLANK], declines).state;
    expect(stamina(kept, betty(kept))).toBe(3);
    expect(inst(kept, betty(kept)).exhausted).toBe(false);
  });

  it("60154.betty-brant-interrupt: cancels the card's Boost ability (Breaking News exhausts a support as a boost)", () => {
    const s = gameWith([BETTY, BEN]);
    const ben = supportOf(s, P2);
    const run = (pick: Picker): GameState => {
      const started = runWith(
        WAVE11_DEPS,
        stackEncounterDeck(patchInstance(s, hero(s, P1), { statuses: clear }), NEWS, BLANK, ENFORCERS, ENFORCERS),
        endTurn(P1),
        endTurn(P2),
      );
      return driveStepwise(WAVE11_DEPS, started, (st) => {
        if (isTriggerPrompt(st)) return pick(st);
        const labels = optionLabels(st);
        // The first player picks which support the Boost exhausts: Ben Urich, never Betty.
        const target = st.pendingChoice!.options.find((o) => o.label.includes("Ben Urich"));
        if (target && labels.some((l) => l.includes("Betty"))) return [target.optionId];
        return labelled("Place 2 threat")(st);
      }).state;
    };
    const uncancelled = run(declines);
    const cancelled = run(withBetty);
    // Ben was exhausted by the Boost when Betty did not cancel it, and was not when she did.
    expect(inst(uncancelled, ben).exhausted).toBe(true);
    expect(inst(cancelled, ben).exhausted).toBe(false);
  });

  it("60154.betty-brant-interrupt: needs a ready Betty: exhausted at the prompt she is not offered", () => {
    const s = gameWith([BETTY]);
    let offered = false;
    attacked(
      s,
      [ONE_ICON],
      (st) => {
        if (st.pendingChoice!.options.some((o) => o.label.includes("Betty"))) offered = true;
        return declines(st);
      },
      (st) =>
        st.pendingChoice!.prompt.kind === "declareDefender" ? patchInstance(st, betty(st), { exhausted: true }) : st,
    );
    expect(offered).toBe(false);
    // Control: the same run with her ready does offer her.
    let offeredReady = false;
    attacked(s, [ONE_ICON], (st) => {
      if (st.pendingChoice!.options.some((o) => o.label.includes("Betty"))) offeredReady = true;
      return declines(st);
    });
    expect(offeredReady).toBe(true);
  });

  it("60154.betty-brant-interrupt: a Betty on her last stamina counter can still be used, and is then discarded (the players lose)", () => {
    const s = gameWith([BETTY]);
    const last = patchInstance(s, betty(s), { counters: { stamina: 1 } });
    const done = attacked(last, [ONE_ICON, BLANK], withBetty).state;
    expect(done.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });

  it("60154.betty-brant-interrupt: works on a scheme activation too (the activating enemy, not only an attacker)", () => {
    const s = withForm(gameWith([BETTY]), "alterEgo", P1);
    const run = (pick: Picker): GameState =>
      driveStepwise(
        WAVE11_DEPS,
        runWith(WAVE11_DEPS, stackEncounterDeck(s, ONE_ICON, BLANK, ENFORCERS, ENFORCERS), endTurn(P1)),
        pick,
      ).state;
    const plain = run(declines);
    const cancelled = run(withBetty);
    expect(stamina(cancelled, betty(cancelled))).toBe(2);
    expect(mainThreat(plain) - mainThreat(cancelled)).toBe(1);
  });

  it("the ability is on the card's own text: an Interrupt costing exhaust and 1 stamina", () => {
    expect(REGISTRY[ref]!.trigger).toMatchObject({ kind: "interrupt", forced: false });
    expect(REGISTRY[ref]!.cost).toMatchObject({ exhaustSelf: true, spendCounters: { counterType: "stamina" } });
  });
});

describe("J. Jonah Jameson 60155", () => {
  const ref = "60155.j-jonah-jameson-action";
  const jjj = (s: GameState): InstanceId => supportOf(s);
  const hand = (s: GameState, p: PlayerId = P1): number => playerOf(s, p).hand.length;
  const dealt = (s: GameState, p: PlayerId = P1): InstanceId[] => [...playerOf(s, p).dealtEncounter];

  it("60155.j-jonah-jameson-action: draws 2 cards, is dealt 1 facedown encounter card, exhausts and loses a stamina counter", () => {
    const s = gameWith([JJJ]);
    const done = drive(s, use(P1, jjj(s), ref));
    expect(hand(done) - hand(s)).toBe(2);
    expect(dealt(done)).toHaveLength(dealt(s).length + 1);
    expect(inst(done, jjj(done)).exhausted).toBe(true);
    expect(stamina(done, jjj(done))).toBe(2);
  });

  it("60155.j-jonah-jameson-action: the dealt card is the top of the encounter deck, facedown and not yet revealed", () => {
    const s = stackEncounterDeck(gameWith([JJJ]), "01186");
    const top = activeEncounterDeck(s).deck[0]!;
    const done = drive(s, use(P1, jjj(s), ref));
    expect(dealt(done)).toContain(top);
    expect(inst(done, top).faceup).toBeFalsy();
    expect(deckCodes(done)).toHaveLength(deckCodes(s).length - 1);
    expect(activeEncounterDeck(done).deck).not.toContain(top);
  });

  it("60155.j-jonah-jameson-action: the card dealt is the user's, in a two-player game", () => {
    const s = gameWith([BEN, JJJ]);
    const done = drive(s, use(P2, supportOf(s, P2), ref));
    expect(dealt(done, P2)).toHaveLength(dealt(s, P2).length + 1);
    expect(dealt(done, P1)).toHaveLength(dealt(s, P1).length);
    expect(hand(done, P2) - hand(s, P2)).toBe(2);
  });

  it("60155.j-jonah-jameson-action: an exhausted Jameson cannot be used", () => {
    const s = gameWith([JJJ]);
    const tired = patchInstance(s, jjj(s), { exhausted: true });
    expect(applyCommand(tired, use(P1, jjj(s), ref), WAVE11_DEPS).ok).toBe(false);
  });
});

describe("Robbie Robertson 60156", () => {
  const robbie = (s: GameState): InstanceId => supportOf(s);
  const DISCARD = "Discard it and deal that player another facedown encounter card";
  const KEEP = "Keep it";
  /** A villain phase (a blank boost card), the player being dealt a Maggia Enforcers and, behind it, another. */
  const phase = (s: GameState, pick: Picker) => {
    const started = runWith(
      WAVE11_DEPS,
      stackEncounterDeck(patchInstance(s, hero(s), { statuses: clear }), BLANKS[0]!, ENFORCERS, ENFORCERS),
      endTurn(P1),
    );
    const asked: string[][] = [];
    const run = driveStepwise(WAVE11_DEPS, started, (st) => {
      const labels = optionLabels(st);
      if (labels.some((l) => l.includes(KEEP))) asked.push(labels);
      if (labels.some((l) => l.includes("Place 2 threat"))) return labelled("Place 2 threat")(st);
      return pick(st);
    });
    return { ...run, asked };
  };
  const withRobbie: Picker = (st) => {
    const hit = st.pendingChoice!.options.find((o) => o.label.includes("Robbie"));
    return hit ? [hit.optionId] : declines(st);
  };
  const discardIt: Picker = (st) => {
    const hit = st.pendingChoice!.options.find((o) => o.label.includes(DISCARD));
    return hit ? [hit.optionId] : withRobbie(st);
  };
  const enforcersInPlay = (s: GameState): number => cardsInPlay(s).filter((i) => codeOf(s, i) === ENFORCERS).length;

  it("60156.robbie-robertson-response: discarding the dealt card deals another; the first goes to the discard pile", () => {
    const s = gameWith([ROBBIE]);
    const kept = phase(s, declines);
    expect(enforcersInPlay(kept.state)).toBe(1);
    const swapped = phase(s, discardIt);
    expect(swapped.asked).toHaveLength(1);
    // One Enforcers was discarded and the other dealt and revealed in its place: still exactly one in play.
    expect(discardCodes(swapped.state).filter((c) => c === ENFORCERS)).toHaveLength(1);
    expect(enforcersInPlay(swapped.state)).toBe(1);
    expect(stamina(swapped.state, robbie(swapped.state))).toBe(2);
    expect(inst(swapped.state, robbie(swapped.state)).exhausted).toBe(true);
  });

  it("60156.robbie-robertson-response: keeping the card leaves the deal as it was, the cost still paid", () => {
    const s = gameWith([ROBBIE]);
    const keep: Picker = (st) => {
      const hit = st.pendingChoice!.options.find((o) => o.label.includes(KEEP));
      return hit ? [hit.optionId] : withRobbie(st);
    };
    const kept = phase(s, keep);
    expect(kept.asked).toHaveLength(1);
    expect(discardCodes(kept.state).filter((c) => c === ENFORCERS)).toHaveLength(0);
    expect(enforcersInPlay(kept.state)).toBe(1);
    expect(stamina(kept.state, robbie(kept.state))).toBe(2);
  });

  it("60156.robbie-robertson-response: declining Robbie spends nothing", () => {
    const s = gameWith([ROBBIE]);
    const done = phase(s, declines);
    expect(stamina(done.state, robbie(done.state))).toBe(3);
    expect(done.asked).toEqual([]);
  });

  it("60156.robbie-robertson-response: is also heard for a card dealt as a cost (Jameson's), and deals that player another", () => {
    const s = gameWith([ROBBIE, JJJ]);
    const jameson = supportOf(s, P2);
    const top = stackEncounterDeck(s, "01186", "01187");
    const before = playerOf(top, P2).dealtEncounter.length;
    const done = driveEventsPicking(
      WAVE11_DEPS,
      top,
      (st) => {
        const hit =
          st.pendingChoice!.options.find((o) => o.label.includes(DISCARD)) ??
          st.pendingChoice!.options.find((o) => o.label.includes("Robbie"));
        return hit ? [hit.optionId] : firstLegal(st);
      },
      use(P2, jameson, "60155.j-jonah-jameson-action"),
    ).state;
    // The first card dealt (Advance) was discarded, the second (Assault) dealt to P2 in its place: P2 still holds one.
    expect(playerOf(done, P2).dealtEncounter).toHaveLength(before + 1);
    expect(discardCodes(done)).toContain("01186");
    expect(playerOf(done, P2).dealtEncounter.map((i) => codeOf(done, i))).toContain("01187");
  });
});

describe("Exclusive Interview 60157", () => {
  const exhaustedAll = (s: GameState): boolean[] =>
    cardsInPlay(s)
      .filter((i) => SUPPORTS.includes(codeOf(s, i)))
      .map((i) => inst(s, i).exhausted);

  it("60157.when-revealed: exhausts each Daily Bugle support, every player's", () => {
    const s = newGame({ players: 2 });
    expect(exhaustedAll(s)).toEqual([false, false]);
    const done = villainPhase(s, 2, [INTERVIEW, ENFORCERS], declines);
    expect(exhaustedAll(done.state)).toEqual([true, true]);
    expect(inPlay(done.state, INTERVIEW)).toBe(true);
  });

  it("60157.exclusive-interview-constant: Daily Bugle supports cannot ready: still exhausted after the ready step", () => {
    const s = newGame();
    const done = villainPhase(s, 1, [INTERVIEW], declines).state;
    expect(done.step.phase).toBe("player");
    expect(inst(done, supportOf(done)).exhausted).toBe(true);
    // Control: without the scheme the same support is ready again after the same round.
    const control = villainPhase(s, 1, [ENFORCERS], declines).state;
    expect(inst(control, supportOf(control)).exhausted).toBe(false);
  });

  it("60157.exclusive-interview-constant: they stay exhausted through the next ready step too", () => {
    const s = newGame();
    const stuck = villainPhase(s, 1, [INTERVIEW], declines).state;
    const again = driveEventsPicking(WAVE11_DEPS, stuck, declines, endTurn(P1)).state;
    expect(inPlay(again, INTERVIEW)).toBe(true);
    expect(inst(again, supportOf(again)).exhausted).toBe(true);
  });

  it("60157.exclusive-interview-constant: does not stop other cards readying (the hero is ready after the same round)", () => {
    const s = newGame();
    const done = villainPhase(s, 1, [INTERVIEW], declines).state;
    expect(inst(done, hero(done)).exhausted).toBe(false);
  });
});

describe("Breaking News 60158", () => {
  const EXHAUST = "Exhaust a Daily Bugle support";
  const THREAT_OPT = "Place 2 threat on the main scheme";
  const alterEgo = (s: GameState, n = 1): GameState =>
    ([P1, P2] as const).slice(0, n).reduce((acc, p) => withForm(acc, "alterEgo", p), s);
  /** A villain phase with all players in alter-ego form (the villain schemes: no attack, no Stop the Presses Response). */
  const dealtNews = (s: GameState, pick: Picker, players = 1, toLast = false) =>
    villainPhase(
      alterEgo(s, players),
      players,
      toLast ? [...Array(players - 1).fill(ENFORCERS), NEWS] : [NEWS, ...Array(players).fill(ENFORCERS)],
      pick,
    );
  const takes =
    (...texts: readonly string[]): Picker =>
    (st) => {
      const hit = st.pendingChoice!.options.find((o) => texts.some((t) => o.label.includes(t)));
      return hit ? [hit.optionId] : declines(st);
    };

  it("60158.when-revealed: the first option exhausts a Daily Bugle support and removes 1 stamina counter from it", () => {
    const s = newGame();
    const done = dealtNews(s, takes(EXHAUST)).state;
    expect(inst(done, supportOf(done)).exhausted).toBe(true);
    expect(stamina(done, supportOf(done))).toBe(2);
  });

  it("60158.when-revealed: the second option places 2 threat on the main scheme and touches no support", () => {
    const s = newGame();
    const threat = dealtNews(s, takes(THREAT_OPT)).state;
    const support = dealtNews(s, takes(EXHAUST)).state;
    expect(inst(threat, supportOf(threat)).exhausted).toBe(false);
    expect(stamina(threat, supportOf(threat))).toBe(3);
    expect(mainThreat(threat) - mainThreat(support)).toBe(2);
  });

  it("60158.when-revealed: the support may be any player's, and the first player picks it", () => {
    const s = gameWith([BEN, BETTY]);
    const theirs = supportOf(s, P2);
    const mine = supportOf(s, P1);
    const picksTheirs: Picker = (st) => {
      const labels = optionLabels(st);
      const hit = st.pendingChoice!.options.find((o) => o.label.includes("Betty Brant"));
      if (hit && labels.some((l) => l.includes("Ben Urich"))) return [hit.optionId];
      return takes(EXHAUST)(st);
    };
    // Dealt to P2: P2 reveals it and picks the option, P1 (first player) picks the support.
    const done = dealtNews(s, picksTheirs, 2, true).state;
    expect(inst(done, theirs).exhausted).toBe(true);
    expect(stamina(done, theirs)).toBe(2);
    expect(inst(done, mine).exhausted).toBe(false);
    expect(stamina(done, mine)).toBe(3);
  });

  it("60158.when-revealed: an already exhausted support still loses its stamina counter", () => {
    const s = newGame();
    const started = runWith(WAVE11_DEPS, stackEncounterDeck(alterEgo(s), BLANKS[0]!, NEWS, ENFORCERS), endTurn(P1));
    let sawExhausted = false;
    const done = driveStepwise(
      WAVE11_DEPS,
      started,
      takes(EXHAUST),
      // At the reveal choice the support is exhausted (as Exclusive Interview would leave it).
      (st) => {
        if (!st.pendingChoice!.options.some((o) => o.label.includes(EXHAUST))) return st;
        sawExhausted = true;
        return patchInstance(st, supportOf(st), { exhausted: true });
      },
    ).state;
    expect(sawExhausted).toBe(true);
    expect(inst(done, supportOf(done)).exhausted).toBe(true);
    expect(stamina(done, supportOf(done))).toBe(2);
  });

  it("player elimination discards the eliminated player's Daily Bugle support and the players lose", () => {
    const s = newGame({ players: 2 });
    const theirs = supportOf(s, P2);
    const doomed = patchInstance(s, hero(s, P2), { damage: 99 });
    const done = settle(
      driveEventsPicking(WAVE11_DEPS, doomed, declines, endTurn(P1), endTurn(P2)).state,
      declines,
      undefined,
      WAVE11_DEPS,
    );
    expect(done.outcome).toMatchObject({
      result: "loss",
      reason: "cardAbility",
      sourceInstanceId: done.mainScheme.instanceId,
    });
    // The support left play to its owner's discard pile.
    expect(playerOf(done, P2).discard).toContain(theirs);
    expect(cardsInPlay(done)).not.toContain(theirs);
  });

  it("60158.when-revealed: removing the last stamina counter discards the support and the players lose", () => {
    const s = newGame();
    const low = patchInstance(s, supportOf(s), { counters: { stamina: 1 } });
    expect(dealtNews(low, takes(EXHAUST)).state.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
    // The same support with a second counter left survives the card.
    const two = patchInstance(s, supportOf(s), { counters: { stamina: 2 } });
    expect(dealtNews(two, takes(EXHAUST)).state.outcome).toBeFalsy();
  });

  it("60158.boost: exhausts a Daily Bugle support (any player's) when turned up as a boost card, without removing a counter", () => {
    const s = alterEgo(newGame());
    const boosted = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(s, NEWS, ENFORCERS),
      declines,
      endTurn(P1),
    ).state;
    expect(inst(boosted, supportOf(boosted)).exhausted).toBe(true);
    expect(stamina(boosted, supportOf(boosted))).toBe(3);
    // Control: a blank boost card leaves the support ready.
    const blank = villainPhase(s, 1, [ENFORCERS], declines).state;
    expect(inst(blank, supportOf(blank)).exhausted).toBe(false);
  });
});

describe("Stop the Presses! 60151b: the stage completes", () => {
  it("60151b: when the main scheme reaches its target threat the players lose the game", () => {
    const s = newGame();
    const target = 9;
    const near = withThreat(s, target - 1);
    expect(near.outcome).toBeFalsy();
    // Thwart nothing and let the villain phase's acceleration push it over: the loss is the stage's.
    const done = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(withForm(near, "alterEgo", P1), "01186", ENFORCERS),
      declines,
      endTurn(P1),
    ).state;
    expect(done.outcome).toMatchObject({ result: "loss" });
  });

  it("60151b: one threat short of the target after the same phase is not a loss", () => {
    const s = newGame();
    const far = withThreat(s, 2);
    const done = driveEventsPicking(
      WAVE11_DEPS,
      stackEncounterDeck(withForm(far, "alterEgo", P1), "01186", ENFORCERS),
      declines,
      endTurn(P1),
    ).state;
    expect(done.outcome).toBeFalsy();
  });
});
