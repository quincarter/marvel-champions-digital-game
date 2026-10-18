import { cardId } from "@mc/content";
import {
  createGame,
  type EngineDeps,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { constant, statusLimit } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../../wave9/falcon/testing.js";
import { WAVE11_ABILITIES, WAVE11_CARDS } from "../../index.js";
import { LUKE_CAGE_LUKE_CAGE_EVENTS as REGISTRY, LUKE_CAGE_LUKE_CAGE_EVENTS_SKIPPED as SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The wave's scripts with Luke Cage's "Unbreakable Skin" stood in for here ("can have any number of tough status
 * cards"), so these tests hold with or without the identity module's own script (an override, never a second merge).
 */
const WAVE11_DEPS: EngineDeps = {
  abilities: {
    ...WAVE11_ABILITIES,
    "62001a.luke-cage-constant": constant(statusLimit("tough", "unlimited", { self: true } as never)),
  },
};

/**
 * Wave 11 `luke_cage/luke-cage/events` (docs/phase7-wave11-hero-packs.md H8.4): Harlem's Hero 62003, Knuckle Sandwich
 * 62004, "Stand with Me!" 62005 and "Sweet Christmas!" 62006, played from the hand of a hand-built Luke Cage deck
 * against Core's Rhino. Luke Cage's own identity script (any number of tough cards) is another module's: tests that
 * need several tough cards put them on directly.
 */
const HARLEMS_HERO = "62003.harlems-hero-action";
const KNUCKLE_SANDWICH = "62004.knuckle-sandwich-action";
const STAND_WITH_ME = "62005.stand-with-me-action";
const SWEET_CHRISTMAS_COST = "62006.sweet-christmas-constant";
const SWEET_CHRISTMAS = "62006.sweet-christmas-action";
const WAR_MACHINE = "01030";
const SHOCKER = "01103"; // Core minion without guard, 3 hit points
const MERCENARY = "01101"; // Core minion with guard, 3 hit points
const MODOK = "01184"; // Core minion, 8 hit points
const FILLER = "01091"; // Avengers Mansion: one resource when paid with, so a hand card is one resource

function lukeGame(twoPlayers = false): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const deck = [
    ...Array(2).fill("62003"),
    "62004",
    ...Array(2).fill("62005"),
    ...Array(2).fill("62006"),
    WAR_MACHINE,
    ...Array(40).fill(FILLER),
  ].slice(0, 40);
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: [
        { identityCardId: cardId("62001a"), aspects: ["leadership"], deck: deck.map((c) => cardId(c)) },
        ...(twoPlayers ? [base.players[0]!] : []),
      ],
    },
    WAVE11_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return withForm(
    settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS),
    { heroForm: 0 },
  );
}

function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, WAVE11_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 100) throw new Error("choices did not settle");
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      WAVE11_DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const rejected = (state: GameState, command: Command): boolean =>
  !sessionApply(startSession(state), command, WAVE11_DEPS).ok;

/** Takes the offered card option for each wanted instance in order; anything else as `firstLegal`. */
const picks =
  (...targets: readonly InstanceId[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const hit =
      choice && targets[0] !== undefined
        ? choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === targets[0])
        : undefined;
    if (hit) {
      targets = targets.slice(1);
      return [hit.optionId];
    }
    return firstLegal(state);
  };
/** Takes the option whose label starts with `label` when offered, else `fallback`. */
const byLabel =
  (label: string, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.label.startsWith(label));
    return hit ? [hit.optionId] : fallback(state);
  };

function staged(state: GameState, code: string, cost: number) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  return { state: given.state, id, command: play(P1, id, payWith(given.state, P1, cost, [id])) };
}
const tough = (s: GameState, id: InstanceId = identityOf(s)): number => inst(s, id).statuses.tough;
const withTough = (s: GameState, n: number): GameState =>
  patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, tough: n } });
const exhausted = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: true });
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

describe("wave 11 luke_cage/luke-cage/events", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("skips only refs it does not register, each with a written reason", () => {
    for (const [id, reason] of Object.entries(SKIPPED)) {
      expect(id in REGISTRY, id).toBe(false);
      expect(reason.length, id).toBeGreaterThan(20);
    }
  });

  it("registers all five printed refs and skips none", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      [HARLEMS_HERO, KNUCKLE_SANDWICH, STAND_WITH_ME, SWEET_CHRISTMAS_COST, SWEET_CHRISTMAS].sort(),
    );
    expect(REGISTRY[SWEET_CHRISTMAS_COST]!.trigger).toMatchObject({ kind: "constant" });
    for (const id of [HARLEMS_HERO, KNUCKLE_SANDWICH, STAND_WITH_ME, SWEET_CHRISTMAS])
      expect(REGISTRY[id]!.trigger, id).toMatchObject({ kind: "action", form: "hero" });
  });
});

describe(`${HARLEMS_HERO}: give Luke Cage a tough card, then ready a character per tough card`, () => {
  it("gives the tough card and readies the exhausted identity", () => {
    const start = lukeGame();
    const base = exhausted(start, identityOf(start));
    const { state, id, command } = staged(base, "62003", 1);
    const { state: after } = drive(state, command);
    expect(tough(after)).toBe(1);
    expect(inst(after, identityOf(after)).exhausted).toBe(false);
    expect(playerOf(after, P1).discard).toContain(id);
  });

  it("is a Hero Action: refused in alter-ego form", () => {
    const { state, command } = staged(withForm(lukeGame(), "alterEgo"), "62003", 1);
    expect(rejected(state, command)).toBe(true);
  });

  it("readies one character for each tough card, each pass its own choice (one held, one given: identity and an ally)", () => {
    const placed = stagedInPlay(withTough(lukeGame(), 1), WAR_MACHINE);
    const identity = identityOf(placed.state);
    const base = exhausted(exhausted(placed.state, identity), placed.id);
    const { state, command } = staged(base, "62003", 1);
    const { state: after } = drive(state, command, picks(identity, placed.id));
    expect(tough(after)).toBe(2);
    expect(inst(after, identity).exhausted).toBe(false);
    expect(inst(after, placed.id).exhausted).toBe(false);
  });
});

describe(`${KNUCKLE_SANDWICH}: deal 3 damage to an enemy; may discard a tough card to return it to hand`, () => {
  it("deals 3 and, with no tough card, goes to the discard pile", () => {
    const { state, id, command } = staged(lukeGame(), "62004", 1);
    const villain = villainOf(state);
    const { state: after } = drive(state, command, picks(villain));
    expect(inst(after, villain).damage).toBe(3);
    expect(playerOf(after, P1).discard).toContain(id);
    expect(playerOf(after, P1).hand).not.toContain(id);
  });

  it("discards the tough card to return the event to hand when chosen", () => {
    const { state, id, command } = staged(withTough(lukeGame(), 1), "62004", 1);
    const villain = villainOf(state);
    const { state: after } = drive(state, command, byLabel("Discard a tough", picks(villain)));
    expect(inst(after, villain).damage).toBe(3);
    expect(playerOf(after, P1).hand).toContain(id);
    expect(playerOf(after, P1).discard).not.toContain(id);
    expect(tough(after)).toBe(0);
  });

  it("keeps the tough card and discards the event when declined", () => {
    const { state, id, command } = staged(withTough(lukeGame(), 1), "62004", 1);
    const villain = villainOf(state);
    const { state: after } = drive(state, command, byLabel("Do not", picks(villain)));
    expect(tough(after)).toBe(1);
    expect(playerOf(after, P1).discard).toContain(id);
  });
});

describe(`${STAND_WITH_ME}: give a tough card, remove 1 threat per tough card up to 5`, () => {
  const run = (toughStart: number) => {
    const start = withTough(lukeGame(), toughStart);
    const { state, command } = staged(patchInstance(start, start.mainScheme.instanceId, { threat: 10 }), "62005", 2);
    const { state: after } = drive(state, command);
    return { toughNow: tough(after), threat: mainThreat(after) };
  };

  it("with no tough card: gains one and removes 1 threat", () => {
    expect(run(0)).toEqual({ toughNow: 1, threat: 9 });
  });

  it("removes one threat per tough card on Luke Cage, the new one included", () => {
    expect(run(3)).toEqual({ toughNow: 4, threat: 6 });
  });

  it("is capped at 5 threat", () => {
    expect(run(7)).toEqual({ toughNow: 8, threat: 5 });
  });
});

describe(`${SWEET_CHRISTMAS_COST}: reduce the cost by 1 for each tough card on Luke Cage`, () => {
  it.each([
    [0, 5],
    [1, 4],
    [3, 2],
    [5, 0],
    [6, 0],
  ])("with %i tough card(s) it costs %i", (n, cost) => {
    const base = withTough(lukeGame(), n);
    const exact = staged(base, "62006", cost);
    const { state: after } = drive(exact.state, exact.command);
    expect(playerOf(after, P1).discard).toContain(exact.id);
    if (cost > 0) {
      const short = staged(base, "62006", cost - 1);
      expect(rejected(short.state, short.command)).toBe(true);
    }
  });
});

describe(`${SWEET_CHRISTMAS}: deal 5 damage to the villain and each minion engaged with you`, () => {
  it("damages the villain and each engaged minion", () => {
    let base = engageMinion(lukeGame(), MODOK, "modok");
    base = engageMinion(base, SHOCKER, "merc");
    const { state, command } = staged(withTough(base, 5), "62006", 0);
    const { state: after } = drive(state, command);
    expect(inst(after, villainOf(after)).damage).toBe(5);
    expect(inst(after, "modok" as InstanceId).damage).toBe(5);
    expect(playerOf(after, P1).playArea).not.toContain("merc"); // 3 hit points: defeated by 5
  });

  // The Knuckle Sandwich / Luke Cage tough-discard interaction (his forced damage) is tested with the identity module.
  it("with a guard minion engaged: the villain takes 0, the guard and other engaged minions take 5, another player's minion none", () => {
    let base = engageMinion(lukeGame(true), MERCENARY, "merc");
    base = engageMinion(base, MODOK, "modok");
    base = engageMinion(base, MODOK, "theirs", "p2" as never);
    const { state, command } = staged(withTough(base, 5), "62006", 0);
    const { state: after } = drive(state, command);
    expect(inst(after, villainOf(after)).damage).toBe(0); // RRG 1.8 "Guard" p. 21; ruling January 11, 2026 (4)
    expect(inst(after, "modok" as InstanceId).damage).toBe(5);
    expect(playerOf(after, P1).playArea).not.toContain("merc"); // 3 hit points: defeated by 5
    expect(inst(after, "theirs" as InstanceId).damage).toBe(0);
  });
});
