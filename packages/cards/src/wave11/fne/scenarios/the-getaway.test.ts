import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  characterProfile,
  createGame,
  hasKeyword,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { cardId } from "@mc/content";
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
  stackEncounterDeck,
  runWith,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, driveStepwise, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE11_CARDS } from "../../cards.js";
import { WAVE11_DEPS } from "../../index.js";
import { wave11Scenario } from "../../setup.js";
import { FNE_SCENARIOS_THE_GETAWAY as REGISTRY, FNE_SCENARIOS_THE_GETAWAY_SKIPPED as SKIPPED } from "./the-getaway.js";

vi.setConfig({ testTimeout: 180_000 });

const MAIN = "60128a";
const OUT_FRONT = "60129a";
const ESCORT = "60130";
const TRUCK = "60131";
const RUBBER = "60132";
const PEDESTRIANS = "60133";
const TRAFFIC_JAM = "60189";
/** A Maggia minion: dealt as filler, it engages the player it is dealt to and does nothing else this phase. */
const ENFORCERS = "60092";
/** Core encounter cards with no boost icon and no boost ability: blank boost cards. */
const BLANKS = ["01187", "01187", "01186", "01186"];
const REFS = [
  "60128a.setup",
  "60128b.the-getaway-forced-interrupt",
  "60128b.the-getaway-constant",
  "60128b.the-getaway-constant-2",
  "60129a.out-front-constant",
  "60129a.out-front-constant-2",
  "60129a.out-front-forced-interrupt",
  "60129b.when-revealed",
  "60130.escort-vehicle-constant",
  "60130.escort-vehicle-constant-2",
  "60130.escort-vehicle-constant-3",
  "60131.jackknifed-tanker-truck-constant",
  "60132.when-revealed",
  "60133.when-revealed",
];

const data = (code: string) => (WAVE11_CARDS as readonly any[]).find((c) => (c.id as string) === code)!;
const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const copy = (s: GameState, code: string): InstanceId =>
  (Object.keys(s.instances) as InstanceId[]).find((i) => codeOf(s, i) === code)!;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState, p: PlayerId = P1): InstanceId => identityOf(s, p);
const mainId = (s: GameState): InstanceId => s.mainScheme.instanceId;
const mainThreat = (s: GameState): number => inst(s, mainId(s)).threat;
const speed = (s: GameState): number => inst(s, mainId(s)).counters.speed ?? 0;
const withSpeed = (s: GameState, n: number): GameState =>
  patchInstance(s, mainId(s), { counters: { ...inst(s, mainId(s)).counters, speed: n } });
const withThreat = (s: GameState, n: number): GameState => patchInstance(s, mainId(s), { threat: n });
const outFront = (s: GameState): InstanceId => copy(s, OUT_FRONT);
/** The name of the face of Out Front showing. */
const faceName = (s: GameState): string => {
  const id = outFront(s);
  const card = data(OUT_FRONT);
  return (inst(s, id) as any).flipped ? card.flipSide.name : card.name;
};
const damageOf = (s: GameState, id: InstanceId): number => inst(s, id).damage;
const statuses = (s: GameState, id: InstanceId) => inst(s, id).statuses;
const profile = (s: GameState, id: InstanceId) => characterProfile(s, id, WAVE11_DEPS)!;
/** Whether a copy of `code` is in play (revealed). */
const revealed = (s: GameState, code: string): boolean => cardsInPlay(s).some((i) => codeOf(s, i) === code);
const rangedFlags = (events: readonly GameEvent[]): boolean[] =>
  events.flatMap((e: any) =>
    e.type === "triggerEvent" && e.phase === "initiated" && e.event.kind === "characterAttacked"
      ? [e.event.ranged === true]
      : [],
  );

function newGame(
  opts: {
    players?: number;
    seed?: number;
    difficulty?: "standard" | "expert";
    villainSetId?: string;
    /** Card codes added to the encounter deck (a card of a set the game does not use). */
    extra?: readonly string[];
  } = {},
): GameState {
  const { players = 1, seed = 1, difficulty = "standard", villainSetId = "hammerhead", extra = [] } = opts;
  const seats = [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }];
  const base = wave11Scenario("the-getaway", {
    villainSetId,
    players: seats.slice(0, players),
    seed,
    difficulty,
  } as never);
  const config = extra.length
    ? { ...base, encounterDeck: [...(base.encounterDeck ?? []), ...extra.map((c) => cardId(c))] }
    : base;
  const created = createGame(config, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let s = settle(created.state, firstLegal, (st) => st.step.phase === "player", WAVE11_DEPS);
  for (let n = 0; n < players; n++) s = withForm(s, { heroForm: 0 }, n === 0 ? P1 : P2);
  return s;
}

/** The villain without a status card, so a hit is not absorbed by tough. */
const bare = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { stunned: 0, confused: 0, tough: 0 } });

const declines: Picker = (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s));
/** Takes the first option whose label contains one of `texts` when one is offered, else declines every defense. */
const labelled =
  (...texts: readonly string[]): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const hit = choice.options.find((o) => texts.some((t) => o.label.includes(t)));
    return hit ? [hit.optionId] : declines(s);
  };

/** `boosts` blank boost cards, then these cards dealt, then the villain phase after every player ends their turn. */
function villainPhase(state: GameState, boosts: number, dealt: readonly string[], pick: Picker = declines) {
  const stacked = stackEncounterDeck(state, ...BLANKS.slice(0, boosts), ...dealt);
  const turns = state.players.map((p) => endTurn(p.playerId));
  return driveEventsPicking(WAVE11_DEPS, stacked, pick, ...turns);
}
const drive = (state: GameState, command: Command, pick: Picker = firstLegal): GameState =>
  driveEventsPicking(WAVE11_DEPS, state, pick, command).state;
const attack = (s: GameState, player: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: player,
  attackerInstanceId: hero(s, player),
  targetInstanceId: villainOf(s),
});
const thwart = (s: GameState, player: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: hero(s, player),
  schemeInstanceId: mainId(s),
});
/** Surgery: a copy of `code` from the encounter deck, faceup and attached to `host` (the villain by default). */
function attachFromDeck(state: GameState, code: string, host: InstanceId = villainOf(state)): GameState {
  const pile = activeEncounterDeck(state);
  const id = pile.deck.find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  const deckId = activeEncounterDeckId(state);
  const removed: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
    },
  };
  const placed = patchInstance(removed, id, { faceup: true, attachedTo: host, controllerId: null });
  return patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] });
}
/** The hero ready and free of status cards, so a basic attack is made. */
const readyHero = (s: GameState, p: PlayerId = P1): GameState =>
  patchInstance(s, hero(s, p), { statuses: { stunned: 0, confused: 0, tough: 0 }, exhausted: false });

/** Thwarts the main scheme (one threat on it) to nothing: Out Front flips to Alongside. */
const alongside = (s: GameState): GameState => drive(withThreat(s, 1), thwart(s));

describe("registry", () => {
  it("registers every printed ref of the six cards; nothing is skipped", () => {
    const printed = [MAIN, OUT_FRONT, ESCORT, TRUCK, RUBBER, PEDESTRIANS].flatMap((c) => abilityRefIds(data(c)));
    expect([...printed].sort()).toEqual([...REFS].sort());
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(Object.keys(SKIPPED)).toEqual([]);
  });
  it.each([...REFS])("%s validates", (ref) => {
    expect(validateDefinition(REGISTRY[ref]!), ref).toEqual([]);
  });
});

describe("The Getaway 60128a setup", () => {
  it("60128a.setup: 1 speed counter on the main scheme and Out Front attached to the villain, out of the deck", () => {
    const s = newGame();
    expect(speed(s)).toBe(1);
    expect(inst(s, villainOf(s)).attachments.map((i) => codeOf(s, i))).toEqual([OUT_FRONT]);
    expect(inst(s, outFront(s)).attachedTo).toBe(villainOf(s));
    expect(activeEncounterDeck(s).deck.map((i) => codeOf(s, i))).not.toContain(OUT_FRONT);
    expect(faceName(s)).toBe("Out Front");
  });

  it("60128a.setup: expert mode places 2 speed counters", () => {
    expect(speed(newGame({ difficulty: "expert" }))).toBe(2);
  });

  it("the main scheme starts with 2 threat per hero", () => {
    expect(mainThreat(newGame({ players: 1 }))).toBe(2);
    expect(mainThreat(newGame({ players: 2 }))).toBe(4);
  });
});

describe("Out Front 60129a", () => {
  it("60129a.out-front-forced-interrupt: damage the villain would be dealt removes that much threat instead", () => {
    const s = withThreat(bare(newGame()), 8);
    const atk = profile(s, hero(s)).atk;
    expect(atk).toBeGreaterThan(0);
    const done = drive(s, attack(s));
    expect(damageOf(done, villainOf(done)), "no damage on the villain").toBe(0);
    expect(mainThreat(done)).toBe(8 - atk);
  });

  it("60129a.out-front-forced-interrupt: it removes no more threat than is on the scheme; the rest of the damage is lost, not dealt", () => {
    const s = withThreat(bare(newGame()), 1);
    const done = drive(s, attack(s));
    expect(mainThreat(done)).toBe(0);
    // Spider-Man hits for 2, 1 threat was there: the villain has only the 2 from Alongside (flipped at no threat), not 2 more.
    expect(faceName(done)).toBe("Alongside");
    expect(damageOf(done, villainOf(done))).toBe(2);
  });

  it("60129a.out-front-forced-interrupt: a tough status card is kept, as the damage is not dealt (MC60 p. 19)", () => {
    const base = newGame();
    const s = withThreat(patchInstance(base, villainOf(base), { statuses: { stunned: 0, confused: 0, tough: 1 } }), 8);
    const done = drive(s, attack(s));
    expect(statuses(done, villainOf(done)).tough).toBe(1);
    expect(mainThreat(done)).toBeLessThan(8);
  });

  it("60129a.out-front-forced-interrupt: threat is removed through a crisis icon on a side scheme", () => {
    // Traffic Jam (Drive) has the crisis icon; revealed, it keeps a thwarting hero off the main scheme.
    const after = bare(villainPhase(withThreat(bare(newGame()), 4), 1, [TRAFFIC_JAM]).state);
    // Hammerhead stunned the hero in the villain phase: clear it so the attack is made.
    const s = patchInstance(after, hero(after), { statuses: { stunned: 0, confused: 0, tough: 0 }, exhausted: false });
    expect(revealed(s, TRAFFIC_JAM)).toBe(true);
    const before = mainThreat(s);
    const done = drive(s, attack(s));
    expect(mainThreat(done)).toBeLessThan(before);
    expect(damageOf(done, villainOf(done))).toBe(0);
  });

  it("60129a.out-front-constant: with no threat on the main scheme, Out Front flips to Alongside", () => {
    const s = alongside(bare(newGame()));
    expect(mainThreat(s)).toBe(0);
    expect(faceName(s)).toBe("Alongside");
  });

  it("60129a.out-front-constant: with threat left on the main scheme it stays Out Front", () => {
    const start = withThreat(newGame(), 5);
    const s = drive(start, thwart(start));
    expect(mainThreat(s)).toBeGreaterThan(0);
    expect(faceName(s)).toBe("Out Front");
  });

  it("60129a.out-front-constant-2: the villain's attacks gain ranged while Out Front is on him, not once it is Alongside", () => {
    const outRun = villainPhase(newGame(), 1, []);
    expect(rangedFlags(outRun.events)).toEqual([true]);
    const flipped = alongside(newGame());
    expect(faceName(flipped)).toBe("Alongside");
    const alongRun = villainPhase(flipped, 1, []);
    expect(rangedFlags(alongRun.events)).toEqual([false]);
  });

  it("60129b.when-revealed: flipping to Alongside gives each player 1 indirect damage and the villain 2 damage per hero", () => {
    const base = bare(newGame({ players: 2 }));
    const s = alongside(withThreat(base, 1));
    expect(faceName(s)).toBe("Alongside");
    // The villain took 2 per hero = 4 (Alongside is not Out Front, so nothing turns it into threat).
    expect(damageOf(s, villainOf(s))).toBe(4);
    // One indirect damage each (a hero is the only character each controls).
    expect(damageOf(s, hero(s, P1))).toBe(1);
    expect(damageOf(s, hero(s, P2))).toBe(1);
  });

  it("60129b.when-revealed: the villain's 2 damage is a single hero's 2, not the table's", () => {
    const s = alongside(bare(newGame({ players: 1 })));
    expect(damageOf(s, villainOf(s))).toBe(2);
    expect(damageOf(s, hero(s))).toBe(1);
  });

  it("60129a.out-front-forced-interrupt: once Alongside, damage lands on the villain as normal", () => {
    const flipped = bare(alongside(bare(newGame())));
    const s = patchInstance(flipped, hero(flipped), { exhausted: false });
    const before = damageOf(s, villainOf(s));
    const done = drive(s, attack(s));
    // Still Alongside (no threat to flip back until round's end), so the hit is dealt.
    expect(damageOf(done, villainOf(done))).toBeGreaterThan(before);
  });
});

describe("Out Front 60129a with other cards in play", () => {
  it("60129a.out-front-forced-interrupt: patrol does not stop the removal (MC60 p. 26 FAQ)", () => {
    // Security Guard (Purple Man) has patrol; the hero is engaged with it and so cannot thwart the main scheme.
    const base = readyHero(withThreat(bare(newGame({ extra: ["60103"] })), 8));
    const { state: s } = engageMinion(base, "60103", P1);
    const blocked = applyCommand(s, thwart(s), WAVE11_DEPS);
    expect(blocked.ok, "patrol bars the thwart, so only Out Front's replacement can remove the threat").toBe(false);
    const done = drive(s, attack(s));
    expect(mainThreat(done)).toBe(8 - profile(s, hero(s)).atk);
    expect(damageOf(done, villainOf(done))).toBe(0);
  });

  it("60129a.out-front-forced-interrupt: it wins over a Drive Vehicle on the villain, which gets no damage (RRG 1.8 Damage p. 14)", () => {
    const base = withThreat(bare(newGame()), 8);
    const withCar = readyHero(attachFromDeck(base, "60186"));
    const car = copy(withCar, "60186");
    expect(inst(withCar, car).attachedTo).toBe(villainOf(withCar));
    const done = drive(withCar, attack(withCar));
    expect(mainThreat(done)).toBe(8 - profile(withCar, hero(withCar)).atk);
    expect(damageOf(done, car), "no damage on the Vehicle").toBe(0);
    expect(damageOf(done, villainOf(done))).toBe(0);
  });

  it("60129a.out-front-constant-2: Deadly Sai takes ranged away from Bullseye's attack, which Out Front grants (RRG 1.8 Lose p. 27)", () => {
    const bullseye = newGame({ villainSetId: "bullseye" });
    expect(faceName(bullseye)).toBe("Out Front");
    expect(rangedFlags(villainPhase(bullseye, 1, []).events)).toEqual([true]);
    const sai = attachFromDeck(bullseye, "60070");
    expect(rangedFlags(villainPhase(sai, 1, []).events)).toEqual([false]);
  });
});

describe("The Getaway 60128b Forced Interrupt (the round ends)", () => {
  it("60128b.the-getaway-forced-interrupt: with Out Front on the villain, 2 speed counters are placed", () => {
    const s = newGame();
    const done = villainPhase(s, 1, []).state;
    expect(mainThreat(done)).toBeGreaterThan(0);
    expect(speed(done)).toBe(speed(s) + 2);
    expect(faceName(done)).toBe("Out Front");
  });

  it("60128b.the-getaway-forced-interrupt: with Alongside, 1 speed counter is placed and Alongside flips to Out Front", () => {
    const s = alongside(newGame());
    expect(faceName(s)).toBe("Alongside");
    const done = villainPhase(s, 1, []).state;
    expect(speed(done)).toBe(speed(s) + 1);
    expect(faceName(done)).toBe("Out Front");
    // A flip back is not a reveal: Alongside's indirect damage and villain damage are not repeated.
    expect(damageOf(done, villainOf(done))).toBe(damageOf(s, villainOf(s)));
  });

  it("60128b.the-getaway-forced-interrupt: with no threat on the main scheme at the round's end, no speed counter is placed and Alongside stays", () => {
    // The hero is ready, so it is asked to defend: that prompt comes after the threat is placed, just before the round ends.
    const s = readyHero(alongside(newGame()));
    // Run the villain phase, emptying the main scheme at every prompt so none is left when the round ends.
    const stacked = stackEncounterDeck(s, BLANKS[0]!, ENFORCERS);
    const started = runWith(WAVE11_DEPS, stacked, endTurn(P1));
    const done = driveStepwise(WAVE11_DEPS, started, declines, (st) => withThreat(st, 0)).state;
    expect(done.step.phase).toBe("player");
    expect(mainThreat(done)).toBe(0);
    expect(speed(done)).toBe(speed(s));
    expect(faceName(done)).toBe("Alongside");
  });

  it("60128b.the-getaway-forced-interrupt: the flip back also happens with two players", () => {
    const s = alongside(newGame({ players: 2 }));
    const done = villainPhase(s, 2, []).state;
    expect(faceName(done)).toBe("Out Front");
    expect(speed(done)).toBe(speed(s) + 1);
  });
});

describe("Jackknifed Tanker Truck 60131", () => {
  /** The truck revealed; the hero ready and without the stun Hammerhead's response gave it. */
  const withTruck = (): GameState => {
    const s = bare(villainPhase(bare(newGame()), 1, [TRUCK]).state);
    return patchInstance(s, hero(s), { statuses: { stunned: 0, confused: 0, tough: 0 }, exhausted: false });
  };
  const refused = (s: GameState): boolean => !applyCommand(s, attack(s), WAVE11_DEPS).ok;

  it("60131.jackknifed-tanker-truck-constant: the villain cannot be attacked (no valid target), Out Front off him", () => {
    const base = withTruck();
    expect(revealed(base, TRUCK)).toBe(true);
    const ready = patchInstance(patchInstance(base, outFront(base), { attachedTo: null }), villainOf(base), {
      attachments: inst(base, villainOf(base)).attachments.filter((i) => i !== outFront(base)),
    });
    expect(refused(ready)).toBe(true);
  });

  it("60131.jackknifed-tanker-truck-constant: with it in play the attack is refused and Out Front removes no threat", () => {
    const s = withThreat(withTruck(), 6);
    expect(refused(s)).toBe(true);
    expect(mainThreat(s)).toBe(6);
    expect(damageOf(s, villainOf(s))).toBe(0);
  });

  it("60131.jackknifed-tanker-truck-constant: without the truck the same ready hero's attack is accepted and removes threat", () => {
    const fresh = bare(newGame());
    const noTruck = withThreat(patchInstance(fresh, hero(fresh), { exhausted: false }), 6);
    expect(refused(noTruck)).toBe(false);
    const done = drive(noTruck, attack(noTruck));
    expect(mainThreat(done)).toBeLessThan(6);
  });
});

describe("Escort Vehicle 60130", () => {
  const minion = (speeds: number): { state: GameState; id: InstanceId } => {
    const s = withSpeed(newGame(), speeds);
    return engageMinion(s, ESCORT, P1);
  };
  const kw = (speeds: number, name: "toughness" | "quickstrike" | "surge"): boolean => {
    const { state, id } = minion(speeds);
    return hasKeyword(state, id, name, WAVE11_DEPS);
  };

  it.each([
    [0, false, false, false],
    [2, false, false, false],
    [3, true, false, false],
    [5, true, false, false],
    [6, true, true, false],
    [8, true, true, false],
    [9, true, true, true],
    [12, true, true, true],
  ] as const)(
    "60130.escort-vehicle-constant(s): at %i speed counters toughness=%s quickstrike=%s surge=%s",
    (speeds, toughness, quickstrike, surge) => {
      expect(kw(speeds, "toughness")).toBe(toughness);
      expect(kw(speeds, "quickstrike")).toBe(quickstrike);
      expect(kw(speeds, "surge")).toBe(surge);
    },
  );

  it("60130.escort-vehicle-constant: revealed at 3 or more speed counters it enters with a tough status card (RRG 1.8 Toughness p. 45); one already in play when the third arrives gets none", () => {
    const revealedAt = (speeds: number) => {
      const run = villainPhase(withSpeed(newGame(), speeds), 1, [ESCORT]);
      return statuses(run.state, copy(run.state, ESCORT)).tough;
    };
    expect(revealedAt(2)).toBe(0);
    expect(revealedAt(3)).toBe(1);
    const { state, id } = minion(3);
    expect(statuses(state, id).tough).toBe(0);
  });

  it("60130: Guard and Patrol are printed whatever the speed", () => {
    const { state, id } = minion(0);
    expect(hasKeyword(state, id, "guard", WAVE11_DEPS)).toBe(true);
    expect(hasKeyword(state, id, "patrol", WAVE11_DEPS)).toBe(true);
  });

  it("60130.escort-vehicle-constant-3: revealed at 9 speed counters it gains surge, so the next card is revealed too", () => {
    const engagedEnforcers = (speeds: number): boolean => {
      const run = villainPhase(withSpeed(newGame(), speeds), 1, [ESCORT, ENFORCERS]);
      return (Object.keys(run.state.instances) as InstanceId[]).some(
        (i) => codeOf(run.state, i) === ENFORCERS && inst(run.state, i).engagedWith === P1,
      );
    };
    expect(engagedEnforcers(8)).toBe(false);
    expect(engagedEnforcers(9)).toBe(true);
  });
});

describe("Burning Rubber 60132", () => {
  const spendOption = "Spend 1 resource";
  const threatOption = "Place 1 threat";
  const run = (speeds: number, pick: Picker) => villainPhase(withSpeed(newGame(), speeds), 1, [RUBBER], pick);

  it("60132.when-revealed: once per speed counter, placing threat each time", () => {
    // The villain phase itself adds threat; compare with the same phase and an unrevealed filler instead.
    const without = villainPhase(withSpeed(newGame(), 3), 1, [ENFORCERS], labelled(threatOption));
    const withIt = run(3, labelled(threatOption));
    expect(mainThreat(withIt.state) - mainThreat(without.state)).toBe(3);
  });

  it("60132.when-revealed: spending a resource each time places no threat and costs a card per speed counter", () => {
    const without = villainPhase(withSpeed(newGame(), 2), 1, [ENFORCERS], labelled(spendOption));
    const withIt = run(2, labelled(spendOption));
    expect(mainThreat(withIt.state)).toBe(mainThreat(without.state));
    expect(playerOf(withIt.state, P1).hand.length).toBe(playerOf(without.state, P1).hand.length - 2);
  });

  it("60132.when-revealed: each pass is its own choice (one spent, one threat)", () => {
    let spent = 0;
    const alternate: Picker = (s) => {
      const choice = s.pendingChoice!;
      const spend = choice.options.find((o) => o.label.includes(spendOption));
      const place = choice.options.find((o) => o.label.includes(threatOption));
      if (spend && place) return [spent++ === 0 ? spend.optionId : place.optionId];
      return labelled(spendOption)(s);
    };
    const without = villainPhase(withSpeed(newGame(), 2), 1, [ENFORCERS], alternate);
    spent = 0;
    const withIt = run(2, alternate);
    expect(mainThreat(withIt.state) - mainThreat(without.state)).toBe(1);
    expect(playerOf(withIt.state, P1).hand.length).toBe(playerOf(without.state, P1).hand.length - 1);
  });

  // Owner decision 2026-10-20 (A), reversing Q8: RRG 1.8 p. 12 bars an encounter card's option only for want of a target.
  it("60132.when-revealed: a player with no resource to spend is still offered the spend (and the threat)", () => {
    const base = withSpeed(newGame(), 1);
    const empty = {
      ...base,
      players: base.players.map((p) => (p.playerId === P1 ? { ...p, hand: [], deck: [], discard: [] } : p)),
    } as GameState;
    const seen: string[][] = [];
    const watch: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.options.some((o) => o.label.includes(threatOption))) {
        seen.push(choice.options.map((o) => o.label));
        return [choice.options.find((o) => o.label.includes(threatOption))!.optionId];
      }
      return declines(s);
    };
    const before = mainThreat(villainPhase(empty, 1, [ENFORCERS], watch).state);
    seen.length = 0;
    const done = villainPhase(empty, 1, [RUBBER], watch);
    expect(mainThreat(done.state) - before).toBe(1);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((labels) => labels.some((l) => l.includes(spendOption)))).toBe(true);
  });

  it("60132.when-revealed: with no speed counters it does nothing", () => {
    const without = villainPhase(withSpeed(newGame(), 0), 1, [ENFORCERS], labelled(threatOption));
    const withIt = run(0, labelled(threatOption));
    expect(mainThreat(withIt.state)).toBe(mainThreat(without.state));
  });

  it("60132.when-revealed: the revealing player pays, not the other player (two players)", () => {
    const s = withSpeed(newGame({ players: 2 }), 1);
    const before = playerOf(s, P2).hand.length;
    const withIt = villainPhase(s, 2, [RUBBER, ENFORCERS], labelled(spendOption));
    const without = villainPhase(s, 2, [ENFORCERS, ENFORCERS], labelled(spendOption));
    expect(before).toBeGreaterThan(0);
    // P1 is dealt Rubber and pays 1 card; P2's hand is the same as in the game without it.
    expect(playerOf(withIt.state, P1).hand.length).toBe(playerOf(without.state, P1).hand.length - 1);
    expect(playerOf(withIt.state, P2).hand.length).toBe(playerOf(without.state, P2).hand.length);
  });
});

describe("Pedestrians 60133", () => {
  const exhaustOption = "Exhaust a character";
  const indirectOption = "Take 1 indirect damage";
  it("60133.when-revealed: taking indirect damage once per speed counter", () => {
    const base = withSpeed(newGame(), 3);
    const without = villainPhase(base, 1, [ENFORCERS], labelled(indirectOption));
    const withIt = villainPhase(base, 1, [PEDESTRIANS], labelled(indirectOption));
    expect(damageOf(withIt.state, hero(withIt.state))).toBe(damageOf(without.state, hero(without.state)) + 3);
  });

  it("60133.when-revealed: exhausting a character you control takes no indirect damage", () => {
    const base = withSpeed(newGame(), 1);
    const without = villainPhase(base, 1, [ENFORCERS], labelled(exhaustOption));
    const withIt = villainPhase(base, 1, [PEDESTRIANS], labelled(exhaustOption));
    expect(damageOf(withIt.state, hero(withIt.state))).toBe(damageOf(without.state, hero(without.state)));
  });

  it("60133.when-revealed: a second pass cannot exhaust the already exhausted hero, so it is only indirect damage", () => {
    const seen: string[][] = [];
    const watch: Picker = (s) => {
      const choice = s.pendingChoice!;
      const ex = choice.options.find((o) => o.label.includes(exhaustOption));
      if (choice.options.some((o) => o.label.includes(indirectOption))) {
        seen.push(choice.options.map((o) => o.label));
        return [ex ? ex.optionId : choice.options.find((o) => o.label.includes(indirectOption))!.optionId];
      }
      return declines(s);
    };
    const base = withSpeed(newGame(), 2);
    const done = villainPhase(base, 1, [PEDESTRIANS], watch);
    const without = villainPhase(base, 1, [ENFORCERS], watch);
    // Only the first pass is a choice (exhaust or indirect); the second has the one option left and takes no prompt.
    expect(seen).toHaveLength(1);
    expect(seen[0]!.some((l) => l.includes(exhaustOption))).toBe(true);
    expect(inst(done.state, hero(done.state)).exhausted).toBe(true);
    // ...and that second pass still resolved: exactly 1 indirect damage.
    expect(damageOf(done.state, hero(done.state))).toBe(damageOf(without.state, hero(without.state)) + 1);
  });

  it("60133.when-revealed: with no speed counters it does nothing", () => {
    const base = withSpeed(newGame(), 0);
    const without = villainPhase(base, 1, [ENFORCERS], labelled(indirectOption));
    const withIt = villainPhase(base, 1, [PEDESTRIANS], labelled(indirectOption));
    expect(damageOf(withIt.state, hero(withIt.state))).toBe(damageOf(without.state, hero(without.state)));
  });

  it("60133.when-revealed: the revealing player's characters and damage only (two players)", () => {
    const base = withSpeed(newGame({ players: 2 }), 2);
    const without = villainPhase(base, 2, [ENFORCERS, ENFORCERS], labelled(indirectOption));
    const withIt = villainPhase(base, 2, [PEDESTRIANS, ENFORCERS], labelled(indirectOption));
    expect(damageOf(withIt.state, hero(withIt.state, P1))).toBe(damageOf(without.state, hero(without.state, P1)) + 2);
    expect(damageOf(withIt.state, hero(withIt.state, P2))).toBe(damageOf(without.state, hero(without.state, P2)));
  });
});
