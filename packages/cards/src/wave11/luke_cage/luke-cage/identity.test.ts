import { cardId } from "@mc/content";
import {
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { anyNumberOfToughStatusCards, constant } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  endTurn,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import { WAVE11_ABILITIES, WAVE11_CARDS } from "../../index.js";
import {
  LUKE_CAGE_LUKE_CAGE_IDENTITY as REGISTRY,
  LUKE_CAGE_LUKE_CAGE_IDENTITY_SKIPPED as SKIPPED,
} from "./identity.js";

vi.setConfig({ testTimeout: 120_000 });

const DEPS: EngineDeps = { abilities: WAVE11_ABILITIES };
const FORCED = "62001a.luke-cage-forced-response";
const ACTION = "62001b.luke-cage-action";
const KNUCKLE_SANDWICH = "62004";
const BURSTEIN = "62008";
const FILLER = "01091";

function lukeGame(): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const deck = [KNUCKLE_SANDWICH, "62003", BURSTEIN, ...Array(40).fill(FILLER)].slice(0, 40);
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: [{ identityCardId: cardId("62001a"), aspects: ["leadership"], deck: deck.map((c) => cardId(c)) }],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return withForm(
    settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS),
    { heroForm: 0 },
  );
}

function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const first = sessionApply(session, command, DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
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
      DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
  }
  const replayed = replay(session.log, DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return session.state;
}
const settleAttack = (deps: EngineDeps, state: GameState) => {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, endTurn(P1), deps);
  if (!first.ok) throw new Error(first.error.message);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && guard < 100; guard++) {
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(session.state),
      },
      deps,
    );
    if (!next.ok) throw new Error(next.error.message);
    session = next.session;
    events.push(...next.events);
  }
  return { state: session.state, events };
};
const rejected = (state: GameState, command: Command): boolean => !sessionApply(startSession(state), command, DEPS).ok;
const byLabel =
  (label: string, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.label.startsWith(label));
    return hit ? [hit.optionId] : fallback(state);
  };
const pickVillain: Picker = (state) => {
  const hit = state.pendingChoice?.options.find(
    (o) => o.ref.kind === "card" && o.ref.instanceId === state.activeVillainId,
  );
  return hit ? [hit.optionId] : firstLegal(state);
};
const tough = (s: GameState): number => inst(s, identityOf(s)).statuses.tough;
const withTough = (s: GameState, n: number): GameState =>
  patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, tough: n } });
const damageOf = (s: GameState): number => inst(s, identityOf(s)).damage;

/**
 * Wave 11 `luke_cage/luke-cage/identity` (docs/phase7-wave11-hero-packs.md H8.4, H3.2, H3.3): Unbreakable Skin on both
 * faces (62001a.luke-cage-constant, 62001b.luke-cage-constant), the Forced Response (62001a.luke-cage-forced-response)
 * and the alter-ego search (62001b.luke-cage-action).
 */
describe("wave 11 luke_cage/luke-cage/identity", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("skips only refs it does not register, each with a written reason", () => {
    for (const [id, reason] of Object.entries(SKIPPED)) {
      expect(id in REGISTRY, id).toBe(false);
      expect(reason.length, id).toBeGreaterThan(20);
    }
  });

  it("registers all four printed refs and skips none", () => {
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual(
      ["62001a.luke-cage-constant", FORCED, "62001b.luke-cage-constant", ACTION].sort(),
    );
    expect(REGISTRY[FORCED]!.trigger).toMatchObject({ kind: "response", forced: true });
    expect(REGISTRY[ACTION]!.trigger).toMatchObject({ kind: "action", form: "alterEgo" });
  });
});

describe("62001a.luke-cage-forced-response: a discarded tough card costs 1 unpreventable damage", () => {
  const knuckle = (state: GameState) => {
    const given = moveToHand(state, P1, KNUCKLE_SANDWICH);
    const [id] = given.ids as [InstanceId];
    return { state: given.state, command: play(P1, id, payWith(given.state, P1, 1, [id])) };
  };

  it("Knuckle Sandwich discarding a tough card (any number held: 3) leaves 2 tough and deals Luke Cage 1", () => {
    const staged = knuckle(withTough(lukeGame(), 3));
    const after = drive(staged.state, staged.command, byLabel("Discard a tough", pickVillain));
    expect(tough(after)).toBe(2);
    expect(damageOf(after)).toBe(1); // ignores tough: the two left stay
  });

  it("deals nothing when the tough card is not discarded", () => {
    const staged = knuckle(withTough(lukeGame(), 1));
    const after = drive(staged.state, staged.command, byLabel("Do not", pickVillain));
    expect(tough(after)).toBe(1);
    expect(damageOf(after)).toBe(0);
  });

  it("with the last tough card gone, still takes the 1 damage", () => {
    const staged = knuckle(withTough(lukeGame(), 1));
    const after = drive(staged.state, staged.command, byLabel("Discard a tough", pickVillain));
    expect(tough(after)).toBe(0);
    expect(damageOf(after)).toBe(1);
  });
});

describe("Unbreakable Skin: any number of tough status cards, through the engine", () => {
  it("Harlem's Hero gives a second tough card to Luke Cage holding one", () => {
    const given = moveToHand(withTough(lukeGame(), 1), P1, "62003");
    const [id] = given.ids as [InstanceId];
    const after = drive(given.state, play(P1, id, payWith(given.state, P1, 2, [id])));
    expect(tough(after)).toBe(2);
  });
});

describe("62001b.luke-cage-action: search for Burstein Process, once per phase", () => {
  it("adds Burstein Process from the deck to the hand, then refuses a second use this phase", () => {
    const start = withForm(lukeGame(), "alterEgo");
    const id = identityOf(start);
    const takeBurstein: Picker = (s) => {
      const hit = s.pendingChoice?.options.find(
        (o) => o.ref.kind === "card" && inst(s, o.ref.instanceId).cardId === cardId(BURSTEIN),
      );
      return hit ? [hit.optionId] : firstLegal(s);
    };
    const after = drive(start, use(P1, id, ACTION), takeBurstein);
    const inHand = playerOf(after, P1).hand.filter((h) => inst(after, h).cardId === cardId(BURSTEIN));
    expect(inHand).toHaveLength(1);
    expect(rejected(after, use(P1, id, ACTION))).toBe(true);
  });

  it("finds Burstein Process in the discard pile too", () => {
    const base = withForm(lukeGame(), "alterEgo");
    const owner = playerOf(base, P1);
    const burstein = owner.deck.find((i) => inst(base, i).cardId === cardId(BURSTEIN))!;
    const state: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== burstein), discard: [...p.discard, burstein] } : p,
      ),
    };
    const takeIt: Picker = (s) => {
      const hit = s.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === burstein);
      return hit ? [hit.optionId] : firstLegal(s);
    };
    const after = drive(state, use(P1, identityOf(state), ACTION), takeIt);
    expect(playerOf(after, P1).hand).toContain(burstein);
    expect(playerOf(after, P1).discard).not.toContain(burstein);
  });

  it("is an alter-ego action: refused in hero form", () => {
    const start = lukeGame();
    expect(rejected(start, use(P1, identityOf(start), ACTION))).toBe(true);
  });
});

describe("Unbreakable Skin: any number of tough cards, attacks lose piercing", () => {
  it("both faces carry the status-limit and attacks-lose-piercing rules", () => {
    for (const id of ["62001a.luke-cage-constant", "62001b.luke-cage-constant"]) {
      const kinds = JSON.stringify(REGISTRY[id]);
      expect(kinds, id).toContain("statusLimit");
      expect(kinds, id).toContain("attacksLoseKeywords");
    }
  });
});

describe("Unbreakable Skin end to end: an enemy attack with piercing", () => {
  const VENOM = "56087"; // "Venom's attacks gain piercing", ATK 3

  const venomAttacks = (withSkin: boolean) => {
    const base = lukeGame();
    const villain = base.activeVillainId!;
    const quiet = patchInstance(base, villain, {
      statuses: { ...inst(base, villain).statuses, stunned: 1 },
    });
    const state = engageMinion(withTough(quiet, 1), VENOM, "venom");
    const deps = withSkin
      ? DEPS
      : {
          abilities: {
            ...WAVE11_ABILITIES,
            "62001a.luke-cage-constant": constant(anyNumberOfToughStatusCards({ self: true })),
          },
        };
    return settleAttack(deps, state);
  };

  it("loses piercing against Luke Cage: the tough card absorbs the attack and is not discarded first", () => {
    const { events, state } = venomAttacks(true);
    const pierced = events.filter((e) => e.type === "statusRemoved" && e.status === "tough" && e.reason === "piercing");
    expect(pierced).toEqual([]);
    // The attack deals nothing; the 1 is the Forced Response to the absorbing tough card being discarded.
    expect(damageOf(state)).toBe(1);
    expect(tough(state)).toBe(0);
  });

  it("control, without the loss: piercing discards the tough card first and he takes the 3 damage", () => {
    const { events, state } = venomAttacks(false);
    const pierced = events.filter((e) => e.type === "statusRemoved" && e.status === "tough" && e.reason === "piercing");
    expect(pierced).toHaveLength(1);
    expect(damageOf(state)).toBe(4);
  });
});
