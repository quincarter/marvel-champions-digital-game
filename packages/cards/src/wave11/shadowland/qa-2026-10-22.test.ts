/**
 * Shadowland (MC65) rules QA, 2026-10-22 (docs/phase7-shadowland-qa.md §6 "QA"). Seeded games built through the real
 * scenario builder (`wave11Scenario`, `createGame`) and driven through the engine's command loop (`sessionApply`, so the
 * session log is the evidence): every game ends by checking that `replay(log)` reproduces the final state exactly.
 *
 * Authorities, in the project's order: RRG 1.8 (mc_rulesreference_v18_compressed.pdf, cited by printed page), the
 * insert (docs/campaign-modes/markdown/mc65_shadowland.md, cited "insert p. N"), then the card text in the data. No
 * FFG ruling on Shadowland exists yet. Where a test stages state by surgery (a damage total, a counter count, a
 * position card flipped), the test says so; everything that follows the surgery is the real engine.
 *
 * Coverage (one `describe` each):
 *  1. scenario matrix: three scenarios x standard/expert x three seeds played by the greedy driver, determinism
 *  2. setup facts of each scenario (insert pp. 8-9, 12-13, 17; card text)
 *  3. the six Dark Protege villains: random pick, linked cards, side A defeat -> side B -> win (Shadows in the Night)
 *  4. trap deck: run-out and reshuffle with no acceleration token and no encounter reset (insert pp. 12-13)
 *  5. Shifting Corridors: passage counters, loss when none remain (insert p. 13); win by Into the Labyrinth
 *  6. Krahllak: standard I -> II and expert II -> III with Dark Invitation 1B -> 2A -> 2B (insert p. 17, RRG p. 47)
 *  7. Creeping Corruption: flip at 5 counters, defeat on 72B at 5 (card text)
 *  8. a full three-scenario campaign, standard and expert, played to real wins with the campaign log checked
 *  9. exploratory probes for suspected script bugs (named `FINDING`; each says what the sources require)
 */
import { PLAYABLE_CARDS, SHADOWLAND_CARDS, SHADOWLAND_SCENARIOS } from "@mc/content";
import {
  activeEncounterDeck,
  characterProfile,
  createGame,
  remainingHitPoints,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { playToOutcome } from "../../testing/driver.js";
import { P1, P2, firstLegal, identityOf, inst, patchInstance, type Picker } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave9/falcon/testing.js";
import {
  EXPERT,
  NODES,
  SEATS,
  STANDARD,
  build,
  compose,
  finish,
  intoPlay,
  listOf,
  newLog,
  resultOf,
  seatField,
  seatListOf,
} from "../../campaigns/shadowland-testing.js";
import { WAVE11_DEPS } from "../index.js";
import { wave11Scenario } from "../setup.js";

vi.setConfig({ testTimeout: 600_000 });

const DEPS = WAVE11_DEPS;
const [S1, S2, S3] = NODES;
const SPIDER = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN = { starterDeckId: "core-captain-marvel-leadership" } as const;
const TWO = [SPIDER, CAPTAIN] as const;

type SeatSpec = { readonly starterDeckId: string };
type Scenario = "shadows-in-the-night" | "shadow-labyrinth" | "heart-of-shadow";
interface OpenOptions {
  readonly seats?: readonly SeatSpec[];
  readonly seed?: number;
  readonly expert?: boolean;
  /** A Dark Protege villain card id ("65013a") or "random" (the engine's seeded draw). */
  readonly villain?: string;
  readonly modular?: readonly string[];
}

// ---------------------------------------------------------------------------------------------------------------
// The command loop
// ---------------------------------------------------------------------------------------------------------------

/** A game under test: every state change goes through `sessionApply`, events are kept, `verify()` replays the log. */
class Table {
  session: GameSession;
  readonly events: GameEvent[];
  /** Called after every command with the new state and that command's events (invariant sweeps). */
  onStep: ((state: GameState, events: readonly GameEvent[]) => void) | null = null;

  constructor(state: GameState, setupEvents: readonly GameEvent[] = []) {
    this.session = startSession(state);
    this.events = [...setupEvents];
  }

  get state(): GameState {
    return this.session.state;
  }

  /** Applies one command or throws with the engine's refusal. */
  do(command: Command): this {
    const result = sessionApply(this.session, command, DEPS);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
    this.session = result.session;
    this.events.push(...result.events);
    this.onStep?.(this.state, result.events);
    return this;
  }

  /** Answers every pending choice with `pick` until none is open, the game ends or `stop` is true. */
  settle(pick: Picker = firstLegal, stop?: (s: GameState) => boolean): this {
    for (let guard = 0; this.state.pendingChoice && !this.state.outcome && !stop?.(this.state); guard++) {
      if (guard > 600) throw new Error(`choices did not settle (stuck on ${this.state.pendingChoice.prompt.kind})`);
      const c = this.state.pendingChoice;
      this.do({
        type: "resolveChoice",
        playerId: c.playerId,
        choiceId: c.choiceId,
        selectedOptionIds: pick(this.state),
      });
    }
    return this;
  }

  /** Runs `commands`, settling every prompt with `pick` after each. */
  run(pick: Picker, ...commands: readonly Command[]): this {
    this.settle(pick);
    for (const command of commands) {
      this.do(command);
      this.settle(pick);
    }
    return this;
  }

  /** Surgery (said so by the caller): replaces the state, keeping the log replayable by restarting it from here. */
  stage(change: (s: GameState) => GameState): this {
    this.session = startSession(change(this.state));
    return this;
  }

  /** The log replays from its first state to exactly the state reached: the determinism evidence. */
  verify(): this {
    const replayed = replay(this.session.log, DEPS);
    if (!replayed.ok) throw new Error(`replay failed at command ${replayed.commandIndex}: ${replayed.error.message}`);
    expect(replayed.state, "replay diverged from the played state").toEqual(this.state);
    return this;
  }
}

/** `createGame` for a Shadowland scenario, setup choices answered through the command loop up to the first player phase. */
function open(scenario: Scenario, options: OpenOptions = {}): Table {
  const config = wave11Scenario(scenario, {
    players: options.seats ?? TWO,
    seed: options.seed ?? 1,
    difficulty: options.expert ? "expert" : "standard",
    modularSetIds: options.modular ?? ["ninja_swarm"],
    ...(options.villain ? { villainCardId: options.villain } : {}),
  } as never);
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(`${scenario}: ${created.error.message}`);
  return new Table(created.state, created.events).settle(firstLegal, (s) => s.step.phase === "player");
}

// ---------------------------------------------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------------------------------------------

const codeOf = (s: GameState, id: InstanceId): string => inst(s, id).cardId as string;
const ids = (s: GameState, code: string): InstanceId[] =>
  (Object.keys(s.instances) as InstanceId[]).filter((i) => codeOf(s, i) === code);
const villainId = (s: GameState): InstanceId => s.activeVillainId!;
const villainSide = (s: GameState): string => s.villains.find((v) => v.instanceId === villainId(s))!.side;
const stageOf = (s: GameState): number => s.villains.find((v) => v.instanceId === villainId(s))!.stageIndex;
const hp = (s: GameState, id: InstanceId): number => characterProfile(s, id, DEPS)!.maxHp;
const encounterDeckCodes = (s: GameState): string[] => activeEncounterDeck(s).deck.map((i) => codeOf(s, i));
const setAsideCodes = (s: GameState): string[] => s.encounterSetAside.map((i) => codeOf(s, i));
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Facedown encounter cards dealt by a card's ability (not step three of the villain phase, which deals one to everybody). */
const dealtByAbility = (events: readonly GameEvent[]): PlayerId[] =>
  ofType(events, "encounterCardDealt")
    .filter((e) => e.source === "ability")
    .map((e) => e.playerId)
    .sort();
/** Every card a seat controls in play (its play area and what is attached to its identity), as printed ids. */
const controlledCodes = (s: GameState, player: PlayerId): string[] => {
  const owner = s.players.find((p) => p.playerId === player)!;
  return [...owner.playArea, ...inst(s, owner.identity.instanceId).attachments].map((i) => codeOf(s, i));
};
const players = (s: GameState): PlayerId[] => s.players.map((p) => p.playerId);

/** Every Creeping Corruption a player controls (either face), on their identity or in their play area. */
const ccOf = (s: GameState, player: PlayerId): InstanceId | undefined =>
  ids(s, "65072a").find(
    (i) =>
      inst(s, i).controllerId === player &&
      !s.encounterSetAside.includes(i) &&
      (inst(s, i).attachedTo !== null || s.players.find((p) => p.playerId === player)!.playArea.includes(i)),
  );
const corruptionOn = (s: GameState, player: PlayerId): number => inst(s, ccOf(s, player)!).counters["corruption"] ?? 0;
const withCounters = (s: GameState, id: InstanceId, counters: Record<string, number>): GameState =>
  patchInstance(s, id, { counters: { ...inst(s, id).counters, ...counters } });

const heroForm = (table: Table, ...who: readonly PlayerId[]): Table => {
  for (const player of who) {
    if (table.state.players.find((p) => p.playerId === player)!.identity.form === "hero") continue;
    table.run(firstLegal, { type: "changeForm", playerId: player });
  }
  return table;
};

/** Every player ends their turn in order; the villain phase runs; returns when the next round's player phase opens. */
function passRound(t: Table, pick: Picker = firstLegal): Table {
  const round = t.state.round;
  for (let guard = 0; guard < 60; guard++) {
    t.settle(pick);
    const s = t.state;
    if (s.outcome || s.round !== round) return t;
    if (s.step.phase !== "player" || s.step.kind !== "turn") throw new Error(`stuck in ${s.step.phase}/${s.step.kind}`);
    t.do({ type: "endTurn", playerId: s.step.activePlayerId });
  }
  throw new Error("the round did not end");
}

/** A basic attack on the active villain by `player`'s identity (a real command). */
const attackVillain = (table: Table, player: PlayerId = P1, pick: Picker = firstLegal): Table => {
  const s = table.state;
  return table.run(pick, {
    type: "basicAttack",
    playerId: player,
    attackerInstanceId: identityOf(s, player),
    targetInstanceId: villainId(s),
  });
};
const ready = (s: GameState, player: PlayerId): GameState =>
  patchInstance(s, identityOf(s, player), { exhausted: false });

/** The villain's name -> card id, for the six Dark Protege villains (insert p. 4). */
const DARK_PROTEGE: readonly { readonly id: string; readonly name: string }[] = [
  { id: "65012a", name: "Archpriestess" },
  { id: "65013a", name: "Daredevil" },
  { id: "65014a", name: "Elektra" },
  { id: "65015a", name: "Gorgon" },
  { id: "65016a", name: "Lady Bullseye" },
  { id: "65017a", name: "White Tiger" },
];
const LINKED_CARDS = ["65018", "65019", "65020", "65021", "65022", "65023", "65024", "65025", "65026", "65027"];

/** The villains a linked card names, read from its printed "Linked (X, Y, or Z)" keyword. */
function linkedTo(code: string): string[] {
  const card = (SHADOWLAND_CARDS as readonly any[]).find((c) => c.id === code)!;
  const title: string = card.keywords.find((k: { name: string }) => k.name === "linked").cardTitle;
  return title.split(/,\s*(?:or\s+)?|\s+or\s+/).filter(Boolean);
}
const linkedFor = (villainName: string): string[] => LINKED_CARDS.filter((c) => linkedTo(c).includes(villainName));

// ---------------------------------------------------------------------------------------------------------------
// 1. Scenario matrix
// ---------------------------------------------------------------------------------------------------------------

describe("1. scenario matrix: each scenario, standard and expert, three seeds, played to an outcome", () => {
  const SCENARIOS: readonly Scenario[] = ["shadows-in-the-night", "shadow-labyrinth", "heart-of-shadow"];
  for (const scenario of SCENARIOS) {
    for (const expert of [false, true]) {
      it(`${scenario} (${expert ? "expert" : "standard"}): ends with an outcome, no open prompt, and the log replays`, () => {
        for (const seed of [1, 2, 3]) {
          const table = open(scenario, { seed, expert });
          const run = playToOutcome(table.state, DEPS, { maxCommands: 4000 });
          expect(run.outcome, `${scenario} seed ${seed}: no outcome after ${run.commands} commands`).not.toBeNull();
          expect(run.session.state.pendingChoice).toBeNull();
          const replayed = replay(run.session.log, DEPS);
          if (!replayed.ok) throw new Error(replayed.error.message);
          expect(replayed.state, `${scenario} seed ${seed}: replay diverged`).toEqual(run.session.state);
          // Shadow Labyrinth's only loss-by-ability is the passage state check: it fires when none remain, never before.
          if (
            scenario === "shadow-labyrinth" &&
            run.outcome!.result === "loss" &&
            run.outcome!.reason === "cardAbility"
          ) {
            const s = run.session.state;
            expect(inst(s, villainId(s)).counters["passage"] ?? 0, `seed ${seed}`).toBe(0);
          }
        }
      });
    }
  }

  it("the same seed gives the same game (final state and outcome), a different seed a different one", () => {
    const finish = (seed: number) => {
      const t = open("shadows-in-the-night", { seed, villain: "random" });
      return playToOutcome(t.state, DEPS, { maxCommands: 4000 });
    };
    const a = finish(4);
    const b = finish(4);
    expect(a.session.state).toEqual(b.session.state);
    expect(a.commands).toBe(b.commands);
    const c = finish(5);
    expect(c.session.state).not.toEqual(a.session.state);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 2. Setup facts, scenario by scenario
// ---------------------------------------------------------------------------------------------------------------

describe("2. setup (insert pp. 8-9, 12-13, 17; card text of 1A / 38A / 60A)", () => {
  for (const expert of [false, true]) {
    const mode = expert ? "expert" : "standard";

    it(`Shadows in the Night (${mode}): both position environments, the chosen villain on side A, its five linked cards in the deck`, () => {
      const s = open("shadows-in-the-night", { villain: "65013a", expert }).state;
      // Insert p. 8: two double-sided environments, one VILLAIN POSITION and one HERO POSITION, both start on
      // The Streets Below (data: 65003a / 65004a are the Streets Below faces).
      expect(s.villainArea.map((i) => codeOf(s, i)).sort()).toEqual(["65003a", "65004a"]);
      for (const i of s.villainArea) expect(inst(s, i).flipped ?? false).toBe(false);
      expect(codeOf(s, villainId(s))).toBe("65013a");
      expect(villainSide(s)).toBe("A");
      expect(s.villains).toHaveLength(1);
      // 1A: "Choose 1 random villain ... reveal its side A, then shuffle each card linked to that villain into the
      // encounter deck" (the other five stay set aside: RRG 1.8 "Linked", p. 27).
      const linked = linkedFor("Daredevil");
      expect(linked).toHaveLength(5);
      expect(
        encounterDeckCodes(s)
          .filter((c) => LINKED_CARDS.includes(c))
          .sort(),
      ).toEqual(linked);
      expect(
        setAsideCodes(s)
          .filter((c) => LINKED_CARDS.includes(c))
          .sort(),
      ).toEqual(LINKED_CARDS.filter((c) => !linked.includes(c)));
      expect(
        setAsideCodes(s)
          .filter((c) => /^6501[2-7]a$/.test(c))
          .sort(),
      ).toEqual(DARK_PROTEGE.map((v) => v.id).filter((c) => c !== "65013a"));
      // 15 hit points per hero on side A; expert +3 per hero and +1 SCH (1B text, 1A/2A text).
      expect(hp(s, villainId(s))).toBe(expert ? 2 * (15 + 3) : 2 * 15);
      expect(characterProfile(s, villainId(s), DEPS)!.sch).toBe(expert ? 2 : 1);
      // 1B: 2[per_hero] starting threat; no corruption in a standalone game without Black Flower.
      expect(inst(s, s.mainScheme.instanceId).threat).toBe(4);
      expect(ids(s, "65072a").filter((i) => !s.encounterSetAside.includes(i))).toEqual([]);
    });

    it(`Shadow Labyrinth (${mode}): Shifting Corridors with its passage counters, the trap deck of eight, the villain set aside`, () => {
      const s = open("shadow-labyrinth", { villain: "65016a", expert }).state;
      expect(codeOf(s, villainId(s))).toBe("65037");
      expect(s.villains).toHaveLength(1);
      // 1B (insert p. 13): 10[per_hero] passage counters, 7[per_hero] in expert mode.
      expect(inst(s, villainId(s)).counters["passage"]).toBe(expert ? 14 : 20);
      expect(inst(s, s.mainScheme.instanceId).threat).toBe(50);
      // Insert p. 12: the seven TRAP! treacheries plus Whisper in the Dark form the 8-card trap deck.
      const trap = s.scenarioDecks["trap"]!;
      expect(trap.deck.map((i) => codeOf(s, i)).sort()).toEqual(
        ["65040", "65050", "65051", "65052", "65053", "65054", "65055", "65056"].sort(),
      );
      expect(trap.discard).toEqual([]);
      // No TRAP! card is left in the encounter deck (it would be revealed twice).
      expect(encounterDeckCodes(s).filter((c) => /^6505[0-6]$|^65040$/.test(c))).toEqual([]);
      // 1A: the chosen villain stays set aside (Lady Bullseye's five linked cards go into the deck).
      expect(
        setAsideCodes(s)
          .filter((c) => /^6501[2-7]a$/.test(c))
          .sort(),
      ).toEqual(DARK_PROTEGE.map((v) => v.id));
      expect(
        encounterDeckCodes(s)
          .filter((c) => LINKED_CARDS.includes(c))
          .sort(),
      ).toEqual(linkedFor("Lady Bullseye"));
      expect(s.villainArea).toEqual([]);
    });

    it(`Heart of Shadow (${mode}): Krahllak ${expert ? "II" : "I"}, a Creeping Corruption under each player, the rest set aside`, () => {
      const s = open("heart-of-shadow", { expert }).state;
      expect(codeOf(s, villainId(s))).toBe("65057");
      // 1A contents: Krahllak (I) and (II); (II) and (III) instead in expert mode.
      expect(stageOf(s)).toBe(expert ? 1 : 0);
      expect(hp(s, villainId(s))).toBe(2 * (expert ? 21 : 18));
      for (const p of players(s)) {
        expect(ccOf(s, p), `${p} has a Creeping Corruption`).toBeDefined();
        expect(corruptionOn(s, p)).toBe(0);
        expect(inst(s, ccOf(s, p)!).flipped ?? false).toBe(false);
      }
      expect(setAsideCodes(s).filter((c) => c === "65072a")).toHaveLength(2);
      expect(inst(s, s.mainScheme.instanceId).threat).toBe(4);
    });
  }

  it("Shadow Labyrinth, one hero: 10 passage counters and a 25-threat main scheme (per_hero scaling)", () => {
    const s = open("shadow-labyrinth", { seats: [SPIDER] }).state;
    expect(inst(s, villainId(s)).counters["passage"]).toBe(10);
    expect(inst(s, s.mainScheme.instanceId).threat).toBe(25);
  });

  it("Heart of Shadow, one hero: one Creeping Corruption in play, three set aside", () => {
    const s = open("heart-of-shadow", { seats: [SPIDER] }).state;
    expect(ccOf(s, P1)).toBeDefined();
    expect(setAsideCodes(s).filter((c) => c === "65072a")).toHaveLength(3);
  });

  it("Black Flower picked as a modular set in a standalone Shadows in the Night: one 72A per player in play, the others aside, the other cards shuffled in (insert p. 5 only bars it in the campaign)", () => {
    const s = open("shadows-in-the-night", { modular: ["black_flower"], villain: "65012a" }).state;
    for (const p of players(s)) expect(ccOf(s, p)).toBeDefined();
    expect(setAsideCodes(s).filter((c) => c === "65072a")).toHaveLength(2);
    const deck = encounterDeckCodes(s);
    for (const c of ["65073", "65074", "65075", "65076", "65077", "65078"]) expect(deck, c).toContain(c);
    expect(deck.filter((c) => c === "65072a")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 3. The six Dark Protege villains
// ---------------------------------------------------------------------------------------------------------------

describe("3. Dark Protege villains in Shadows in the Night", () => {
  it("the printed 'Linked (X, Y, or Z)' keywords give each villain exactly five linked cards, each linked card three villains (insert p. 4)", () => {
    for (const v of DARK_PROTEGE) expect(linkedFor(v.name), v.name).toHaveLength(5);
    for (const c of LINKED_CARDS) expect(linkedTo(c), c).toHaveLength(3);
  });

  it("the scenario records' linked lists agree with the printed keywords for every villain", () => {
    for (const scenario of SHADOWLAND_SCENARIOS) {
      for (const option of scenario.villainOptions?.options ?? []) {
        const name = DARK_PROTEGE.find((v) => v.id === (option.villainCardId as string))!.name;
        expect([...(option.linkedCardIds ?? [])].map(String).sort(), `${scenario.id} ${name}`).toEqual(linkedFor(name));
      }
    }
  });

  it('"random" draws every one of the six villains across seeds, and the same seed draws the same villain', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 36; seed++) {
      const t = open("shadows-in-the-night", { seed, villain: "random", seats: [SPIDER] });
      seen.add(codeOf(t.state, villainId(t.state)));
      if (seed <= 3) {
        const again = open("shadows-in-the-night", { seed, villain: "random", seats: [SPIDER] });
        expect(codeOf(again.state, villainId(again.state))).toBe(codeOf(t.state, villainId(t.state)));
      }
    }
    expect([...seen].sort()).toEqual(DARK_PROTEGE.map((v) => v.id));
  });

  for (const v of DARK_PROTEGE) {
    for (const expert of [false, true]) {
      it(`${v.name} (${expert ? "expert" : "standard"}): side A defeat flips to side B (hit points reset, position changed, each player dealt a facedown card), side B defeat wins`, () => {
        const t = open("shadows-in-the-night", { villain: v.id, expert, seed: 7 });
        const start = t.state;
        const heroes = players(start);
        const vId = villainId(start);
        const perHero = 15 + (expert ? 3 : 0);
        expect(hp(start, vId)).toBe(heroes.length * perHero);
        const vPos = start.villainArea.find((i) => codeOf(start, i) === "65003a")!;
        const hPos = start.villainArea.find((i) => codeOf(start, i) === "65004a")!;

        // P1's hero attacks a villain one hit point from defeat (surgery: the damage total). Both positions are
        // The Streets Below, so the positions are the same and each character gets +1 ATK (65003a).
        heroForm(t, P1);
        t.stage((s) => ready(patchInstance(s, vId, { damage: hp(s, vId) - 1 }), P1));
        // Elektra's interrupt / Daredevil's response may ask for a choice: firstLegal declines or takes the first option.
        attackVillain(t, P1);
        const flipped = t.state;
        expect(flipped.outcome, "side A defeat must not end the game").toBeNull();
        expect(villainSide(flipped)).toBe("B");
        expect(codeOf(flipped, villainId(flipped))).toBe(v.id);
        expect(inst(flipped, villainId(flipped)).damage).toBe(0);
        expect(hp(flipped, villainId(flipped))).toBe(heroes.length * (18 + (expert ? 3 : 0)));
        // Villain position changed (flip of the VILLAIN POSITION card, not the hero's).
        expect(inst(flipped, vPos).flipped).toBe(true);
        expect(inst(flipped, hPos).flipped ?? false).toBe(false);
        // "Deal each player 1 facedown encounter card."
        expect(dealtByAbility(t.events)).toEqual([...heroes].sort());
        // B side Toughness (data) gives no tough status card on a flip: the villain stays in play, and RRG 1.8
        // "Toughness" (p. 45) places one when a character enters play (owner, docs/phase7-shadowland.md §5.1 Q10 = B).
        expect(inst(flipped, villainId(flipped)).statuses.tough ?? 0).toBe(0);

        // Side B: win by defeating it. (Surgery: the hero position flipped so the positions match, a real effect other
        // tests cover; this one is about the win.)
        t.stage((s) => {
          let n = patchInstance(s, villainId(s), { damage: hp(s, villainId(s)) - 1 });
          n = patchInstance(n, hPos, { flipped: true });
          return ready(n, P1);
        });
        attackVillain(t, P1);
        expect(t.state.outcome, `${v.name} side B defeated`).toMatchObject({ result: "win" });
        t.verify();
      });
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------
// 4. The trap deck
// ---------------------------------------------------------------------------------------------------------------

const TRAP_CODES = new Set(
  (SHADOWLAND_CARDS as readonly any[]).filter((c) => (c.traits ?? []).includes("TRAP!")).map((c) => c.id as string),
);
const trapPiles = (s: GameState) => s.scenarioDecks["trap"]!;
const accelerationTokens = (s: GameState): number => s.mainScheme.accelerationTokens;
const encounterDiscardSize = (s: GameState): number => activeEncounterDeck(s).discard.length;

/** Surgery: Whisper in the Dark (65040) leaves the trap deck for the set-aside area (its engine primitive is being reworked). */
const withoutWhisper = (s: GameState): GameState => {
  const whisper = trapPiles(s).deck.find((i) => codeOf(s, i) === "65040")!;
  return {
    ...s,
    encounterSetAside: [...s.encounterSetAside, whisper],
    scenarioDecks: {
      ...s.scenarioDecks,
      trap: { ...trapPiles(s), deck: trapPiles(s).deck.filter((i) => i !== whisper) },
    },
  };
};

describe("4. the trap deck (insert pp. 12-13)", () => {
  it("TRAP! is exactly Deadly Contraptions' seven treacheries and Whisper in the Dark (the insert's 8-card trap deck)", () => {
    expect([...TRAP_CODES].sort()).toEqual(["65040", "65050", "65051", "65052", "65053", "65054", "65055", "65056"]);
  });

  it("a long game: every trap reshuffle puts only TRAP! cards back, takes no acceleration token and no encounter card, and the trap discard pile only ever holds TRAP! cards", () => {
    const t = open("shadow-labyrinth", { seed: 3, villain: "65016a" });
    // Surgery: Whisper aside and 60 passage counters, so the scenario runs long enough to empty the trap deck twice.
    t.stage((s) => withCounters(withoutWhisper(s), villainId(s), { passage: 60 }));
    let resets = 0;
    t.onStep = (s, events) => {
      for (const id of trapPiles(s).discard)
        expect(TRAP_CODES.has(codeOf(s, id)), `${codeOf(s, id)} in the trap discard pile`).toBe(true);
      if (events.some((e) => e.type === "scenarioDeckReset")) {
        resets++;
        // "This is not considered resetting the encounter deck ... and does not place an acceleration token."
        expect(ofType(events, "accelerationTokenAdded"), "acceleration token at a trap reshuffle").toEqual([]);
        expect(trapPiles(s).deck.length).toBeGreaterThan(0);
      }
    };
    const accelerationAtStart = accelerationTokens(t.state);
    for (let round = 0; round < 14 && !t.state.outcome && resets < 2; round++) passRound(t);
    expect(resets, `trap reshuffles seen (outcome ${JSON.stringify(t.state.outcome)})`).toBeGreaterThanOrEqual(1);
    t.onStep = null;
    // The only acceleration the game placed is the villain phase's own (one per round, step 1: RRG 1.8 p. 48) plus
    // whatever an encounter deck reset or a card added; no reshuffle of the trap deck added one (asserted above).
    expect(accelerationTokens(t.state)).toBeGreaterThanOrEqual(accelerationAtStart);
    t.verify();
  });

  it("staged run-out: the last trap card is revealed, the discard pile (three TRAP! cards) is shuffled into a new trap deck at once, the revealed card is not in it", () => {
    const t = open("shadow-labyrinth", { seed: 5, villain: "65016a", seats: [SPIDER] });
    t.stage((s) => {
      const base = withoutWhisper(s);
      const deck = trapPiles(base).deck;
      // 7 TRAP! cards: one stays as the top (the deck's last card), three go to the discard pile, three are removed.
      const [top, d1, d2, d3, ...gone] = deck;
      return {
        ...base,
        encounterSetAside: [...base.encounterSetAside, ...gone],
        scenarioDecks: { ...base.scenarioDecks, trap: { ...trapPiles(base), deck: [top!], discard: [d1!, d2!, d3!] } },
      };
    });
    const before = t.state;
    const topCode = codeOf(before, trapPiles(before).deck[0]!);
    const discardCodes = trapPiles(before)
      .discard.map((i) => codeOf(before, i))
      .sort();
    const accelBefore = accelerationTokens(before);
    const encounterDiscardBefore = encounterDiscardSize(before);
    // Shifting Corridors activates against P1 in the villain phase: one passage counter off, the top trap card revealed.
    passRound(t);
    const events = ofType(t.events, "scenarioDeckReset");
    expect(events).toHaveLength(1);
    expect(events[0]!.name).toBe("trap");
    const after = t.state;
    // The new trap deck is the old discard pile (three cards) minus whatever was revealed from it since, and the card
    // that emptied the deck (topCode) is in the trap discard pile or resolved, never back in the deck.
    const inDeckOrDiscard = [...trapPiles(after).deck, ...trapPiles(after).discard].map((i) => codeOf(after, i));
    for (const c of discardCodes) expect(inDeckOrDiscard).toContain(c);
    expect(trapPiles(after).deck.map((i) => codeOf(after, i))).not.toContain(topCode);
    expect(
      accelerationTokens(after) - accelBefore,
      "acceleration tokens: only the villain phase's own one",
    ).toBeLessThanOrEqual(1);
    expect(
      encounterDiscardSize(after),
      "the encounter discard pile was not shuffled into the trap deck",
    ).toBeGreaterThanOrEqual(encounterDiscardBefore);
    t.verify();
  });

  it("an empty trap deck with an empty trap discard pile does not lose the game (engine reading; the rules brief M3 says the reveal does nothing)", () => {
    const t = open("shadow-labyrinth", { seed: 5, villain: "65016a", seats: [SPIDER] });
    t.stage((s) => ({
      ...s,
      scenarioDecks: { ...s.scenarioDecks, trap: { ...trapPiles(s), deck: [], discard: [] } },
    }));
    passRound(t);
    expect(t.state.outcome, JSON.stringify(t.state.outcome)).toBeNull();
    expect(inst(t.state, villainId(t.state)).counters["passage"]).toBe(9);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 5. Shifting Corridors
// ---------------------------------------------------------------------------------------------------------------

describe("5. Shifting Corridors: passage counters (insert p. 13) and Into the Labyrinth (38A/B)", () => {
  it("each activation removes one passage counter (instead of the activation) and the game is lost the moment none remain", () => {
    const t = open("shadow-labyrinth", { seed: 2, villain: "65015a", seats: TWO });
    const corridors = villainId(t.state);
    // Surgery: three counters left. Two players: the first villain phase removes two, the second removes the third and loses.
    t.stage((s) => withoutWhisper(withCounters(s, corridors, { passage: 3 })));
    const passage = (): number => inst(t.state, corridors).counters["passage"] ?? 0;
    const activations = (): number =>
      ofType(t.events, "enemyActivated").filter((e) => e.enemyInstanceId === corridors).length;
    passRound(t);
    expect(passage()).toBe(1);
    expect(t.state.outcome).toBeNull();
    expect(activations()).toBe(2);
    passRound(t);
    expect(passage()).toBe(0);
    expect(t.state.outcome).toMatchObject({ result: "loss", reason: "cardAbility", sourceInstanceId: corridors });
    // The loss is immediate: Corridors did not go on to activate against the second player.
    expect(activations()).toBe(3);
    t.verify();
  });

  it("damage to Shifting Corridors is removed as threat from Into the Labyrinth instead (it has infinite hit points)", () => {
    const t = open("shadow-labyrinth", { seed: 2, villain: "65015a", seats: [SPIDER] });
    heroForm(t, P1);
    const corridors = villainId(t.state);
    const threat = inst(t.state, t.state.mainScheme.instanceId).threat;
    attackVillain(t, P1);
    const s = t.state;
    const removed = ofType(t.events, "threatRemoved").filter((e) => e.schemeInstanceId === s.mainScheme.instanceId);
    expect(removed).toHaveLength(1);
    // Spider-Man's ATK is 1 (Core): the attack's one damage is the one threat removed.
    expect(removed[0]!.amount).toBeGreaterThanOrEqual(1);
    expect(inst(s, corridors).damage, "no damage stays on Shifting Corridors").toBe(0);
    expect(inst(s, s.mainScheme.instanceId).threat).toBe(threat - removed[0]!.amount);
    expect(s.outcome).toBeNull();
    expect(villainSide(s)).toBe("A");
    t.verify();
  });

  for (const expert of [false, true]) {
    it(`removing the last threat advances to Chamber of Vile Secrets: Corridors is set aside, the chosen villain is revealed on side ${expert ? "B" : "A"}, and defeating it wins (${expert ? "expert" : "standard"})`, () => {
      const t = open("shadow-labyrinth", { seed: 9, villain: "65013a", seats: TWO, expert });
      heroForm(t, P1);
      const main = t.state.mainScheme.instanceId;
      // Surgery: one threat left on 1B.
      t.stage((s) => ready(patchInstance(s, main, { threat: 1 }), P1));
      attackVillain(t, P1);
      const s = t.state;
      expect(s.mainScheme.stageIndex, "advanced to stage 2").toBe(1);
      expect(s.outcome, "advancing is not the win: the chosen villain remains to be defeated").toBeNull();
      // Corridors stays in the list of villains as a set-aside (defeated) entry; the chosen villain is the only live one.
      expect(s.villains.filter((v) => !v.defeated)).toHaveLength(1);
      expect(codeOf(s, villainId(s))).toBe("65013a");
      expect(villainSide(s)).toBe(expert ? "B" : "A");
      expect(hp(s, villainId(s))).toBe(2 * (expert ? 18 : 15));
      expect(setAsideCodes(s)).toContain("65037");
      // 2B: the stage's threat is 1[per_hero] and its target 9[per_hero]; completing it loses (card text).
      // Expert: 2B's When Revealed has the villain activate against each player first, so a scheming activation adds threat.
      if (expert) expect(inst(s, s.mainScheme.instanceId).threat).toBeGreaterThanOrEqual(2);
      else expect(inst(s, s.mainScheme.instanceId).threat).toBe(2);
      if (expert) {
        // P1 is in hero form (the villain attacks) and P2 in alter-ego form (it schemes): one of each, one per player.
        expect(ofType(t.events, "attackResolved")).toHaveLength(1);
        expect(ofType(t.events, "schemeResolved")).toHaveLength(1);
      }
      // Defeat the villain: surgery for its damage, then the real attack. Tough (B side Toughness) is cleared first.
      t.stage((n) =>
        ready(
          patchInstance(n, villainId(n), {
            damage: hp(n, villainId(n)) - 1,
            statuses: { ...inst(n, villainId(n)).statuses, tough: 0 },
          }),
          P1,
        ),
      );
      attackVillain(t, P1);
      expect(t.state.outcome).toMatchObject({ result: "win" });
      t.verify();
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------
// 6. Krahllak and Dark Invitation
// ---------------------------------------------------------------------------------------------------------------

/** At a prompt for a player named in `wanted`, the first option whose label matches their pattern; otherwise `firstLegal`. */
const choose =
  (wanted: Readonly<Record<string, RegExp>>): Picker =>
  (s) => {
    const c = s.pendingChoice;
    const pattern = c ? wanted[c.playerId] : undefined;
    const hit = pattern ? c!.options.find((o) => pattern.test(o.label)) : undefined;
    return hit ? [hit.optionId] : firstLegal(s);
  };

/** Surgery: the active villain one hit point from defeat, no tough status card, the hero ready; then the real attack. */
function strikeVillain(t: Table, who?: PlayerId, pick: Picker = firstLegal): Table {
  const step = t.state.step;
  const player = who ?? (step.phase === "player" && step.kind === "turn" ? step.activePlayerId : P1);
  heroForm(t, player);
  t.stage((s) =>
    ready(
      patchInstance(s, villainId(s), {
        damage: hp(s, villainId(s)) - 1,
        statuses: { ...inst(s, villainId(s)).statuses, tough: 0 },
      }),
      player,
    ),
  );
  return attackVillain(t, player, pick);
}

describe("6. Krahllak and Dark Invitation (insert pp. 16-17, 18; RRG 1.8 'Villain Defeat' p. 47)", () => {
  it("standard: Krahllak I -> II (same title: counters, attachments and statuses carry, excess damage does not), Dark Invitation 1B -> 2A -> 2B, defeating II wins", () => {
    const t = open("heart-of-shadow", { seed: 4, seats: TWO });
    heroForm(t, P1);
    expect(stageOf(t.state)).toBe(0);
    expect(t.state.mainScheme.stageIndex).toBe(0);
    const krahllak = villainId(t.state);
    const countersBefore = [corruptionOn(t.state, P1), corruptionOn(t.state, P2)];

    strikeVillain(t);
    let s = t.state;
    expect(s.outcome, "Krahllak I defeated: not a win").toBeNull();
    // RRG p. 47: the next stage is revealed; the same card is the villain, set to the new stage's hit points.
    expect(stageOf(s)).toBe(1);
    expect(villainId(s)).toBe(krahllak);
    expect(inst(s, krahllak).damage).toBe(0);
    expect(hp(s, krahllak)).toBe(2 * 21);
    // 1B Forced Response: "After Krahllak is defeated, advance this scheme to stage 2A."
    expect(s.mainScheme.stageIndex, "Dark Invitation advanced to 2A/2B").toBe(1);
    expect(s.mainScheme.accelerationTokens).toBe(0);
    // 2A (standard): no facedown cards are dealt; the CC counters are untouched.
    expect(dealtByAbility(t.events)).toEqual([]);
    expect([corruptionOn(s, P1), corruptionOn(s, P2)]).toEqual(countersBefore);

    // 2B Forced Response: after step one of the villain phase each player chooses a counter or 3 threat.
    // P1 (hero form) takes the counter, P2 puts 3 threat on the scheme.
    const threatBefore = inst(s, s.mainScheme.instanceId).threat;
    const phase = choose({ p1: /^Place 1 corruption counter/, p2: /^Place 3 threat here/ });
    // Surgery: P1 back to alter-ego form (the form change is limited to once a round), so Krahllak II schemes instead of
    // attacking with overkill and the test is about 2B.
    t.stage((n) => withForm(n, "alterEgo", P1));
    passRound(t, phase);
    s = t.state;
    expect(corruptionOn(s, P1)).toBeGreaterThanOrEqual(countersBefore[0]! + 1);
    expect(corruptionOn(s, P2)).toBe(countersBefore[1]);
    // Step one places the main scheme's acceleration (1[per_hero] = 2) and 2B adds P2's 3.
    expect(inst(s, s.mainScheme.instanceId).threat).toBeGreaterThanOrEqual(threatBefore + 2 + 3);

    strikeVillain(t);
    expect(t.state.outcome, "the last stage of Krahllak is defeated").toMatchObject({ result: "win" });
    t.verify();
  });

  it("expert: Krahllak II -> III (the interrupt-free carry-over), 2A deals each player a facedown card, defeating III wins", () => {
    const t = open("heart-of-shadow", { seed: 6, seats: TWO, expert: true });
    heroForm(t, P1);
    expect(stageOf(t.state)).toBe(1);
    expect(hp(t.state, villainId(t.state))).toBe(2 * 21);

    strikeVillain(t);
    let s = t.state;
    expect(s.outcome).toBeNull();
    expect(stageOf(s)).toBe(2);
    expect(hp(s, villainId(s))).toBe(2 * 25);
    // "After Krahllak is defeated": II is defeated, so the scheme advances here (not only when III falls).
    expect(s.mainScheme.stageIndex).toBe(1);
    // 2A (expert): "deal each player 1 facedown encounter card".
    expect(dealtByAbility(t.events)).toEqual(["p1", "p2"]);
    // Stage III prints Retaliate 1, Steady, Toughness and overkill+piercing attacks (card text, data).
    const printed = (SHADOWLAND_CARDS as readonly any[]).find((c) => c.id === "65057").sides[0].stages[2];
    expect(printed.keywords.map((k: { name: string }) => k.name).sort()).toEqual(["retaliate", "steady", "toughness"]);

    strikeVillain(t);
    expect(t.state.outcome).toMatchObject({ result: "win" });
    s = t.state;
    expect(s.villains[0]!.defeated).toBe(true);
    t.verify();
  });

  it("1B Forced Interrupt: when the stage would be completed, its threat is removed and each player chooses 2 counters or 3 damage plus a facedown card; the scheme stays at 1B", () => {
    const t = open("heart-of-shadow", { seed: 8, seats: TWO });
    // Surgery: 11 of 12 threat (6 per hero); step one of the villain phase adds the acceleration threat and would complete it.
    t.stage((s) => patchInstance(s, s.mainScheme.instanceId, { threat: 11 }));
    const damageBefore = inst(t.state, identityOf(t.state, P2)).damage;
    const pick = choose({ p1: /^Place 2 corruption counters/, p2: /^Take 3 damage/ });
    passRound(t, pick);
    const s = t.state;
    expect(s.mainScheme.stageIndex, "still stage 1B: the completion was replaced").toBe(0);
    expect(s.outcome).toBeNull();
    expect(
      inst(s, s.mainScheme.instanceId).threat,
      "all threat removed; later villain phase steps add a little",
    ).toBeLessThan(11);
    expect(corruptionOn(s, P1)).toBeGreaterThanOrEqual(2);
    expect(inst(s, identityOf(s, P2)).damage).toBeGreaterThanOrEqual(damageBefore + 3);
    expect(dealtByAbility(t.events)).toEqual(["p2"]);
    t.verify();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 7. Creeping Corruption
// ---------------------------------------------------------------------------------------------------------------

describe("7. Creeping Corruption (72A/72B, Black Flower)", () => {
  const CC_ACTION_A = "65072a.creeping-corruption-action";
  const CC_ACTION_B = "65072b.creeping-corruption-action";
  const useCc = (player: PlayerId, s: GameState, ability: string): Command => ({
    type: "useAbility",
    playerId: player,
    cardInstanceId: ccOf(s, player)!,
    abilityId: ability as never,
    payment: [],
  });
  const handOf = (s: GameState, p: PlayerId): number => s.players.find((x) => x.playerId === p)!.hand.length;

  it("72A: the Action places a corruption counter and draws 1; the 5th counter removes them all and flips the card to its OVERPOWERING side", () => {
    const t = open("heart-of-shadow", { seats: [SPIDER], seed: 12 });
    const cc = ccOf(t.state, P1)!;
    const hand = handOf(t.state, P1);
    t.run(firstLegal, useCc(P1, t.state, CC_ACTION_A));
    expect(corruptionOn(t.state, P1)).toBe(1);
    expect(handOf(t.state, P1)).toBe(hand + 1);
    expect(inst(t.state, cc).exhausted).toBe(true);
    expect(inst(t.state, cc).flipped ?? false).toBe(false);
    // Surgery: four counters, the card ready; the real Action places the fifth.
    t.stage((s) => patchInstance(withCounters(s, cc, { corruption: 4 }), cc, { exhausted: false }));
    t.run(firstLegal, useCc(P1, t.state, CC_ACTION_A));
    const s = t.state;
    expect(inst(s, cc).flipped, "flipped to 72B").toBe(true);
    expect(inst(s, cc).counters["corruption"] ?? 0, "'remove each of them from here'").toBe(0);
    expect(s.outcome).toBeNull();
    t.verify();
  });

  it("72B: the 5th counter on the OVERPOWERING side defeats the hero (solo: the game is lost)", () => {
    const t = open("heart-of-shadow", { seats: [SPIDER], seed: 12 });
    const cc = ccOf(t.state, P1)!;
    t.stage((s) => patchInstance(withCounters(s, cc, { corruption: 4 }), cc, { flipped: true, exhausted: false }));
    t.run(firstLegal, useCc(P1, t.state, CC_ACTION_B));
    expect(t.state.outcome).toMatchObject({ result: "loss" });
    expect(t.state.players[0]!.eliminated).toBe(true);
    t.verify();
  });

  it("72B in a two-player game: only that hero is defeated; the other player carries on", () => {
    const t = open("heart-of-shadow", { seats: TWO, seed: 12 });
    const cc = ccOf(t.state, P1)!;
    t.stage((s) => patchInstance(withCounters(s, cc, { corruption: 4 }), cc, { flipped: true, exhausted: false }));
    t.run(firstLegal, useCc(P1, t.state, CC_ACTION_B));
    expect(t.state.players[0]!.eliminated).toBe(true);
    expect(t.state.players[1]!.eliminated).toBe(false);
    expect(t.state.outcome).toBeNull();
    t.verify();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 8. A whole campaign, played
// ---------------------------------------------------------------------------------------------------------------

/** A support in the seat's precon with a printed cost of 2 or less and a real cost (insert p. 10: no "-" costs). */
function cheapSupport(seat: number): string {
  const deck = SEATS[seat]!.deck.cards.map((line) => line.cardId as string);
  const card = deck
    .map((code) => PLAYABLE_CARDS.find((c) => (c.id as string) === code)!)
    .find((c) => c.type === "support" && !("specialCost" in c) && "cost" in c && c.cost <= 2);
  if (!card) throw new Error(`seat ${seat + 1} has no cheap support`);
  return card.id as string;
}
const hpNow = (s: GameState, player: PlayerId): number => remainingHitPoints(s, identityOf(s, player), DEPS)!;

/** Shadows in the Night to its win: side A defeat (flip), then side B defeat. Surgery as in section 3. */
function winShadowsInTheNight(t: Table): void {
  strikeVillain(t, P1);
  expect(villainSide(t.state)).toBe("B");
  const hPos = t.state.villainArea.find((i) => codeOf(t.state, i) === "65004a")!;
  t.stage((s) => patchInstance(s, hPos, { flipped: true }));
  strikeVillain(t, P1);
}

/** Shadow Labyrinth to its win: the last threat off Into the Labyrinth, then the chosen villain defeated. */
function winShadowLabyrinth(t: Table): void {
  heroForm(t, P1);
  t.stage((s) => ready(patchInstance(s, s.mainScheme.instanceId, { threat: 1 }), P1));
  attackVillain(t, P1);
  expect(t.state.mainScheme.stageIndex).toBe(1);
  strikeVillain(t, P1);
}

/** Heart of Shadow to its win: every stage of Krahllak defeated in turn, one by each active player in turn order. */
function winHeartOfShadow(t: Table, stages: number): void {
  for (let i = 0; i < stages; i++) {
    expect(t.state.outcome, `before Krahllak stage ${i + 1}`).toBeNull();
    const step = t.state.step;
    if (step.phase !== "player" || step.kind !== "turn") throw new Error(`not a player turn: ${step.phase}`);
    const who = step.activePlayerId;
    strikeVillain(t, who);
    if (i < stages - 1) t.run(firstLegal, { type: "endTurn", playerId: who });
  }
}

// RRG 1.8 "Modes of Play" (p. 29): campaign and expert campaign mode do not make a scenario expert; players choose the
// other modes for each scenario. So the persistent-damage rules (expert campaign) and the Expert encounter set / later
// villain stage (expert mode) are separate switches, and the three campaigns below cover both separately and together.
const EXPERT_CAMPAIGN_AND_MODE = { expert: true, campaign: EXPERT.campaign } as typeof EXPERT;
describe.each([
  ["standard", STANDARD, false, false],
  ["expert campaign (standard mode)", EXPERT, true, false],
  ["expert campaign in expert mode", EXPERT_CAMPAIGN_AND_MODE, true, true],
] as const)(
  "8. a three-scenario %s campaign, played to real wins (insert pp. 4-6, 9-10, 14-15, 17, 20)",
  (name, modes, expert, modeExpert) => {
    it("each scenario is set up from the log, played to a genuine win, and its Victory updates the log", () => {
      const [s1Cheap, s2Cheap] = [cheapSupport(0), cheapSupport(1)];
      let log = newLog(modes, SEATS, 770 + name.length);

      // ---- Scenario #1: Shadows in the Night ----------------------------------------------------------------------
      const c1 = compose(log);
      expect(c1.start.nodeId).toBe(S1);
      const built1 = build(c1.log);
      const control1 = build(c1.log, { control: true }).state;
      const t1 = new Table(built1.state, built1.events).settle(firstLegal, (s) => s.step.phase === "player");
      let s = t1.state;
      // p. 9: a Creeping Corruption under each player, the rest set aside; +1[per_hero] threat on the main scheme.
      for (const p of players(s)) expect(ccOf(s, p), p).toBeDefined();
      expect(setAsideCodes(s).filter((c) => c === "65072a")).toHaveLength(2);
      expect(inst(s, s.mainScheme.instanceId).threat).toBe(inst(control1, control1.mainScheme.instanceId).threat + 2);
      expect(codeOf(s, villainId(s))).toBe(c1.start.villain);
      // Seat 1's Creeping Corruption reaches 5 counters through its own Action and flips (OVERPOWERING); seat 2's does not.
      const cc1 = ccOf(s, P1)!;
      t1.stage((n) => withCounters(n, cc1, { corruption: 4 }));
      t1.run(firstLegal, {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: cc1,
        abilityId: "65072a.creeping-corruption-action" as never,
        payment: [],
      });
      expect(inst(t1.state, cc1).flipped).toBe(true);
      // Supports in play (surgery: no play), one of cost <= 2 for each seat; expert: seat 1 is hurt.
      t1.stage((n) => intoPlay(intoPlay(n, P1, s1Cheap), P2, s2Cheap));
      if (expert) t1.stage((n) => patchInstance(n, identityOf(n, P1), { damage: hp(n, identityOf(n, P1)) - 5 }));
      winShadowsInTheNight(t1);
      expect(t1.state.outcome).toMatchObject({ result: "win" });
      t1.verify();
      const final1 = t1.state;
      const hp1 = [hpNow(final1, P1), hpNow(final1, P2)];

      const recordBoth = (choice: { slot: string; options: readonly string[] }): readonly string[] =>
        choice.slot === "recordedCard" && choice.options.length > 0 ? [choice.options[0]!] : [];
      const done1 = finish(c1.log, resultOf(c1.log, final1, t1.events), recordBoth);
      log = done1.log;
      expect(log.position.resolved[S1]).toBe("completed");
      expect(listOf(log, "removedVillains")).toEqual([c1.start.villain]);
      expect(seatField(log, 0, "overpowering1")).toEqual({ kind: "flag", value: true });
      expect(seatField(log, 1, "overpowering1")).toEqual({ kind: "flag", value: false });
      expect(seatListOf(log, 0, "recordedCards")).toEqual([s1Cheap]);
      expect(seatListOf(log, 1, "recordedCards")).toEqual([s2Cheap]);
      if (expert) {
        const base = (p: PlayerId) => hp(final1, identityOf(final1, p));
        expect(seatField(log, 0, "remainingHp")).toEqual({ kind: "number", value: Math.min(hp1[0]!, base(P1)) });
        expect(seatField(log, 1, "remainingHp")).toEqual({ kind: "number", value: Math.min(hp1[1]!, base(P2)) });
      }

      // ---- Scenario #2: Shadow Labyrinth ---------------------------------------------------------------------------
      const c2 = compose(log);
      expect(c2.start.nodeId).toBe(S2);
      expect(c2.start.villain, "scenario 1's villain is removed from the campaign").not.toBe(c1.start.villain);
      const built2 = build(c2.log);
      const control2 = build(c2.log, { control: true }).state;
      // Expert campaign setup offers each player the heal (a facedown encounter card to restore full hit points).
      const takeRecorded =
        (names: readonly string[], heal = false): Picker =>
        (st) => {
          const c = st.pendingChoice;
          const wanted = c?.options.filter((o) => names.some((n) => o.label.includes(n)));
          if (c && c.prompt.kind === "chooseCards" && wanted && wanted.length > 0)
            return wanted.slice(0, c.maxSelections).map((o) => o.optionId);
          const hit = c?.options.find((o) => o.label.startsWith(heal ? "Heal to full" : "Decline"));
          return hit ? [hit.optionId] : firstLegal(st);
        };
      const nameOf = (code: string) => PLAYABLE_CARDS.find((c) => (c.id as string) === code)!.name;
      const t2 = new Table(built2.state, built2.events).settle(
        takeRecorded([nameOf(s1Cheap), nameOf(s2Cheap)]),
        (st) => st.step.phase === "player",
      );
      s = t2.state;
      // p. 14: seat 1 had OVERPOWERING (+1) and took its recorded card (+1); seat 2 only took its card (+1).
      expect(corruptionOn(s, P1)).toBe(2);
      expect(corruptionOn(s, P2)).toBe(1);
      expect(controlledCodes(s, P1)).toContain(s1Cheap);
      expect(controlledCodes(s, P2)).toContain(s2Cheap);
      // +3[per_hero] on the main scheme.
      expect(inst(s, s.mainScheme.instanceId).threat).toBe(inst(control2, control2.mainScheme.instanceId).threat + 6);
      expect(codeOf(s, villainId(s))).toBe("65037");
      expect(inst(s, villainId(s)).counters["passage"]).toBe(modeExpert ? 14 : 20);
      if (expert) expect(hpNow(s, P1)).toBe(hp1[0]);
      // Seat 2's Creeping Corruption flips this time (counter surgery + the real Action).
      const cc2 = ccOf(s, P2)!;
      t2.stage((n) => patchInstance(withCounters(n, cc2, { corruption: 4 }), cc2, { exhausted: false }));
      t2.run(firstLegal, {
        type: "useAbility",
        playerId: P2,
        cardInstanceId: cc2,
        abilityId: "65072a.creeping-corruption-action" as never,
        payment: [],
      });
      expect(inst(t2.state, cc2).flipped).toBe(true);
      winShadowLabyrinth(t2);
      expect(t2.state.outcome).toMatchObject({ result: "win" });
      t2.verify();
      const final2 = t2.state;
      const done2 = finish(c2.log, resultOf(c2.log, final2, t2.events), () => []);
      log = done2.log;
      expect(log.position.resolved[S2]).toBe("completed");
      expect(
        listOf(log, "removedVillains"),
        "scenario 2's villain is not checked off (insert p. 15 prints no such bullet)",
      ).toEqual([c1.start.villain]);
      expect(seatField(log, 0, "overpowering2")).toEqual({ kind: "flag", value: false });
      expect(seatField(log, 1, "overpowering2")).toEqual({ kind: "flag", value: true });

      // ---- Scenario #3: Heart of Shadow ---------------------------------------------------------------------------
      const c3 = compose(log);
      expect(c3.start.nodeId).toBe(S3);
      const built3 = build(c3.log);
      const t3 = new Table(built3.state, built3.events).settle(
        takeRecorded([nameOf(s1Cheap), nameOf(s2Cheap)], true),
        (st) => st.step.phase === "player",
      );
      s = t3.state;
      // p. 17: a counter per earlier OVERPOWERING and per recorded card taken: seat 1 had one flag (+1) and one card (+1);
      // seat 2 had one flag (scenario 2: +1) and one card (+1). (Each seat recorded one card at scenario 1 only when
      // the scenario 2 recording was declined above.)
      expect(corruptionOn(s, P1)).toBe(2);
      expect(corruptionOn(s, P2)).toBe(2);
      // One of the four Dark Protege minions is dealt facedown to each player, the other two are shuffled into the deck.
      const minions = ["65020", "65021", "65022", "65023"];
      // (In an expert campaign each player also dealt themself the heal card, which may be one of the two shuffled-in
      // minions, so the count is of all four across the deck and the facedown cards.)
      const dealt = s.players.map((p) => p.dealtEncounter.map((i) => codeOf(s, i)).filter((c) => minions.includes(c)));
      for (const d of dealt) expect(d.length).toBeGreaterThanOrEqual(1);
      const inDeck = encounterDeckCodes(s).filter((c) => minions.includes(c));
      expect([...dealt.flat(), ...inDeck].sort()).toEqual(minions);
      if (expert) for (const p of players(s)) expect(hpNow(s, p), `${p} healed to full`).toBe(hp(s, identityOf(s, p)));
      expect(codeOf(s, villainId(s))).toBe("65057");
      expect(stageOf(s)).toBe(modeExpert ? 1 : 0);
      winHeartOfShadow(t3, 2);
      expect(t3.state.outcome).toMatchObject({ result: "win" });
      t3.verify();
      const done3 = finish(c3.log, resultOf(c3.log, t3.state, t3.events), () => []);
      expect(done3.log.status).toBe("won");
      expect(done3.log.position.resolved[S3]).toBe("completed");
    });
  },
);

// ---------------------------------------------------------------------------------------------------------------
// 8b. Player counts and a lost campaign scenario
// ---------------------------------------------------------------------------------------------------------------

describe("8b. one and four players, and a lost campaign scenario (insert p. 5)", () => {
  const SHE_HULK = { starterDeckId: "core-she-hulk-aggression" } as const;
  const IRON_MAN = { starterDeckId: "core-iron-man-aggression" } as const;
  const FOUR = [SPIDER, CAPTAIN, SHE_HULK, IRON_MAN] as const;

  for (const n of [1, 4]) {
    const seats = n === 1 ? ([SPIDER] as const) : FOUR;
    it(`${n} player(s): per_hero values scale (threat, passage counters, hit points), and each scenario plays to an outcome that replays`, () => {
      const sitn = open("shadows-in-the-night", { seats, villain: "65014a", seed: 3 }).state;
      expect(inst(sitn, sitn.mainScheme.instanceId).threat).toBe(2 * n);
      expect(hp(sitn, villainId(sitn))).toBe(15 * n);
      const sl = open("shadow-labyrinth", { seats, villain: "65014a", seed: 3 }).state;
      expect(inst(sl, villainId(sl)).counters["passage"]).toBe(10 * n);
      expect(inst(sl, sl.mainScheme.instanceId).threat).toBe(25 * n);
      const hos = open("heart-of-shadow", { seats, seed: 3 }).state;
      expect(hp(hos, villainId(hos))).toBe(18 * n);
      expect(setAsideCodes(hos).filter((c) => c === "65072a")).toHaveLength(4 - n);
      for (const scenario of ["shadows-in-the-night", "shadow-labyrinth", "heart-of-shadow"] as const) {
        const table = open(scenario, { seats, seed: 3 });
        const run = playToOutcome(table.state, DEPS, { maxCommands: 4000 });
        expect(run.outcome, `${scenario} x${n}`).not.toBeNull();
        const replayed = replay(run.session.log, DEPS);
        if (!replayed.ok) throw new Error(replayed.error.message);
        expect(replayed.state).toEqual(run.session.state);
      }
    });
  }

  it("a scenario lost in a real game is reset with no penalty: nothing is checked off or recorded, and the same scenario is set up again", () => {
    const first = compose(newLog(STANDARD, SEATS, 31));
    expect(first.start.nodeId).toBe(S1);
    const built = build(first.log);
    const t = new Table(built.state, built.events).settle(firstLegal, (st) => st.step.phase === "player");
    const run = playToOutcome(t.state, DEPS, { maxCommands: 4000 });
    expect(run.outcome, "the greedy driver's game of scenario 1").toMatchObject({ result: "loss" });
    const replayed = replay(run.session.log, DEPS);
    if (!replayed.ok) throw new Error(replayed.error.message);
    const result = resultOf(first.log, run.session.state, replayed.events);
    const { log } = finish(first.log, result);
    expect(listOf(log, "removedVillains"), "no villain checked off by a loss").toEqual([]);
    expect(seatListOf(log, 0, "recordedCards")).toEqual([]);
    expect(log.status).not.toBe("won");
    const again = compose(log);
    expect(again.start.nodeId, "the same scenario is played again").toBe(S1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// 9. Probes for suspected script bugs (FINDING-n; the docs/phase7-shadowland-qa.md audit has the sources)
// ---------------------------------------------------------------------------------------------------------------

/** Records the labels of every option prompt it is asked (for a prompt of `kind`), answering with `choose`. */
function recordingPicker(into: string[][], kind: string, wanted: Readonly<Record<string, RegExp>> = {}): Picker {
  const chooser = choose(wanted);
  return (s) => {
    const c = s.pendingChoice;
    if (c && c.prompt.kind === kind) into.push(c.options.map((o) => o.label));
    return chooser(s);
  };
}

/** Surgery: card `code` becomes the top card of the trap deck. */
const trapTop = (s: GameState, code: string): GameState => {
  const id = trapPiles(s).deck.find((i) => codeOf(s, i) === code)!;
  return {
    ...s,
    scenarioDecks: {
      ...s.scenarioDecks,
      trap: { ...trapPiles(s), deck: [id, ...trapPiles(s).deck.filter((i) => i !== id)] },
    },
  };
};
/** Surgery: `player`'s hand is emptied (it is refilled only at the end of the round, after the villain phase). */
const emptyHand = (s: GameState, player: PlayerId): GameState => ({
  ...s,
  players: s.players.map((p) => (p.playerId === player ? { ...p, hand: [] } : p)),
});

describe("9. probes", () => {
  it("Oil Slick (65053) Disarm: 'Discard an upgrade you control, then remove 4 threat from the main scheme' must not remove threat when the only upgrade is the Permanent Creeping Corruption, which a Deadly Contraptions card cannot discard (insert p. 3 Permanent; RRG 1.8 'Then' p. 44, 'Target' p. 42)", () => {
    // A standalone Shadow Labyrinth with Black Flower as the modular set: each hero starts with Creeping Corruption (the
    // only upgrade they control; the hand is emptied so Avoid has no upgrade to discard).
    const t = open("shadow-labyrinth", { seats: [SPIDER], seed: 2, villain: "65012a", modular: ["black_flower"] });
    t.stage((s) => emptyHand(trapTop(withoutWhisper(s), "65053"), P1));
    const cc = ccOf(t.state, P1)!;
    const offered: string[][] = [];
    passRound(t, recordingPicker(offered, "chooseOption", { p1: /^Disarm/ }));
    const slick = ids(t.state, "65053")[0]!;
    const removed = ofType(t.events, "threatRemoved").filter(
      (e) => e.schemeInstanceId === t.state.mainScheme.instanceId && e.sourceInstanceId === slick,
    );
    const chosenDisarm = offered.some((labels) => labels.some((l) => l.startsWith("Disarm")));
    // Either the option is not offered (no valid target: RRG p. 12 "Choose (Option)"), or choosing it cannot pay off.
    expect({
      disarmOffered: chosenDisarm,
      threatRemovedByOilSlick: removed.map((e) => e.amount),
      ccInPlay: ccOf(t.state, P1) === cc,
    }).toEqual({
      disarmOffered: false,
      threatRemovedByOilSlick: [],
      ccInPlay: true,
    });
  });

  it("Ghost Maker (65006) When Defeated, Atop the Tenshu: 'discard 1 card you control' offers only what can be discarded: the ally, never the Permanent Creeping Corruption (RRG 1.8 'Target' p. 42)", () => {
    const t = open("shadows-in-the-night", { seats: [SPIDER], seed: 2, villain: "65012a", modular: ["black_flower"] });
    heroForm(t, P1);
    // Surgery: Aunt May (an ally) in play for P1 and Ghost Maker engaged with a lethal amount of damage on it.
    t.stage((s) => ready(engageMinion(intoPlay(s, P1, "01006"), "65006", "ghost1", P1), P1));
    const ghost = "ghost1" as InstanceId;
    t.stage((s) => patchInstance(s, ghost, { damage: 99 }));
    const vPos = t.state.villainArea.find((i) => codeOf(t.state, i) === "65003a")!;
    const offered: string[][] = [];
    t.run(recordingPicker(offered, "chooseTarget"), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(t.state, P1),
      targetInstanceId: ghost,
    });
    const s = t.state;
    // The When Defeated ran: the position changed to Atop the Tenshu, so the discard branch was taken.
    expect(inst(s, vPos).flipped).toBe(true);
    expect(offered.flat()).not.toContain("Creeping Corruption");
    expect(controlledCodes(s, P1)).toContain("65072a");
    expect(controlledCodes(s, P1)).not.toContain("01006");
    t.verify();
  });

  // WHISPER IN THE DARK (65040) is being reworked by another agent (shadow-labyrinth.ts / treat-as / query); this probe
  // exercises the printed card through the real scenario and may fail while that work is mid-change.
  it("WHISPER Whisper in the Dark (65040) revealed from the trap deck with Shifting Corridors in play: the chosen villain enters engaged with the revealer, side A, with Whisper attached, as an Elite minion", () => {
    const t = open("shadow-labyrinth", { seats: [SPIDER], seed: 2, villain: "65016a" });
    t.stage((s) => trapTop(s, "65040"));
    passRound(t);
    const s = t.state;
    const whisper = ids(s, "65040")[0]!;
    const lady = ids(s, "65016a")[0]!;
    expect(inst(s, whisper).attachedTo, "Whisper is attached to the chosen villain").toBe(lady);
    expect(inst(s, lady).engagedWith, "engaged with the revealing player").toBe(P1);
    expect(s.encounterSetAside).not.toContain(lady);
    // Treated as an Elite minion, not as the villain: Shifting Corridors is still the active villain.
    expect(codeOf(s, villainId(s))).toBe("65037");
    expect(s.outcome).toBeNull();
    t.verify();
  });

  it("WHISPER defeating the Whisper minion sets the villain aside again and sends Whisper to the TRAP! discard pile; the scenario can then still be won through Chamber of Vile Secrets", () => {
    const t = open("shadow-labyrinth", { seats: [SPIDER], seed: 2, villain: "65016a" });
    t.stage((s) => trapTop(s, "65040"));
    passRound(t);
    heroForm(t, P1);
    const lady = ids(t.state, "65016a")[0]!;
    const whisper = ids(t.state, "65040")[0]!;
    // Elite minion with 6 printed hit points (card text): one left, then the real attack. Guard: it is the only minion.
    t.stage((s) => ready(patchInstance(s, lady, { damage: 5 }), P1));
    t.run(firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(t.state, P1),
      targetInstanceId: lady,
    });
    let s = t.state;
    expect(s.encounterSetAside, "'When Defeated: Set this minion aside'").toContain(lady);
    expect(trapPiles(s).discard, "Whisper is TRAP!: it goes to the trap discard pile").toContain(whisper);
    expect(s.outcome).toBeNull();
    // Win: the last threat off Into the Labyrinth reveals the villain from the set-aside area; defeat it.
    t.stage((n) => ready(patchInstance(n, n.mainScheme.instanceId, { threat: 1 }), P1));
    attackVillain(t, P1);
    s = t.state;
    expect(s.mainScheme.stageIndex).toBe(1);
    expect(codeOf(s, villainId(s))).toBe("65016a");
    expect(villainSide(s)).toBe("A");
    strikeVillain(t, P1);
    expect(t.state.outcome).toMatchObject({ result: "win" });
    t.verify();
  });
});
