import {
  characterProfile,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  P3,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { HOPE_SUMMERS } from "./hope-summers.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Hope Summers set: Hope Summers (40130, setup-keyword ally, no encounter set) and Captive Hope (40131).
 * Every case runs through `wave7Scenario`, with the real registry (no test doubles).
 *
 * Starter heroes (Core): Spider-Man hero form THW 1 ATK 2, Captain Marvel THW 2 ATK 2; Iron Man fills the third seat.
 */
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const IRON_MAN = { starterDeckId: "core-iron-man-aggression" } as const;
type Scenario = "juggernaut" | "mister-sinister" | "stryfe";
type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL | typeof IRON_MAN;

/** Standard-set boost cards that print no boost icon and no Boost ability. */
const BLANK_BOOSTS = ["01186", "01186", "01187", "01187", "01186", "01187"] as const;
const CAPTIVE_HOPE = "40131";

function game(scenario: Scenario, players: readonly Seat[] = [SPIDER_MAN]): GameState {
  const config = wave7Scenario(scenario, { players, seed: 1, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}

const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
const hopeOf = (s: GameState): InstanceId => {
  const ids = Object.keys(s.instances).filter((id) => nameOf(s, id as InstanceId) === "Hope Summers");
  expect(ids).toHaveLength(1);
  return ids[0] as InstanceId;
};
const playAreaOf = (s: GameState, id: InstanceId): PlayerId | undefined =>
  s.players.find((p) => p.playArea.includes(id))?.playerId;
const stats = (s: GameState, id: InstanceId) => {
  const p = characterProfile(s, id, WAVE7_DEPS)!;
  return { thw: p.thw, atk: p.atk, hp: p.maxHp };
};
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;

function drive(state: GameState, ...commands: Parameters<typeof driveEventsPicking>[3][]) {
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "chooseTriggers") return [];
    return firstLegal(s);
  };
  return driveEventsPicking(WAVE7_DEPS, state, pick, ...commands);
}

/** Every remaining player ends their turn and the villain phase runs, with `reveals` stacked on the encounter deck. */
function round(state: GameState, opts: { reveals?: readonly string[]; keepDamage?: boolean; alterEgo?: boolean } = {}) {
  // Cards not named in `reveals` are whatever the seeded deck deals next.
  const stacked = stackEncounterDeck(state, ...BLANK_BOOSTS.slice(0, state.players.length), ...(opts.reveals ?? []));
  const step = state.step;
  const order =
    step.phase === "player" && step.kind === "turn"
      ? [step.activePlayerId, ...step.remainingPlayerIds]
      : state.players.map((p) => p.playerId);
  // Heroes start the round healthy in hero form (Juggernaut's attacks would eliminate them within two rounds).
  const formed = state.players.reduce((st, p) => {
    const hero = withForm(st, opts.alterEgo ? "alterEgo" : { heroForm: 0 }, p.playerId);
    return opts.keepDamage ? hero : patchInstance(hero, identityOf(hero, p.playerId), { damage: 0 });
  }, stacked);
  return drive(formed, ...order.map((id) => endTurn(id)));
}

describe("registry", () => {
  it("scripts exactly the five refs of the set", () => {
    expect(Object.keys(HOPE_SUMMERS).sort()).toEqual([
      "40130.hope-summers-constant",
      "40130.hope-summers-constant-2",
      "40130.hope-summers-constant-3",
      "40131.captive-hope-constant",
      "40131.when-revealed",
    ]);
  });
});

describe.each(["juggernaut", "mister-sinister", "stryfe"] as const)("Hope Summers in %s", (scenario) => {
  it("setup puts her into play, ready, in the first player's play area, and out of the encounter deck", () => {
    const s = game(scenario);
    const hope = hopeOf(s);
    expect(playAreaOf(s, hope)).toBe(P1);
    expect(inst(s, hope)).toMatchObject({ controllerId: P1, exhausted: false, damage: 0 });
    expect(piles(s).deck).not.toContain(hope);
    expect(piles(s).discard).not.toContain(hope);
  });

  it("does not count against the ally limit: three other allies beside her are fine, a fourth is cut back to three", () => {
    const s = game(scenario, [SPIDER_MAN, CAPTAIN_MARVEL]);
    const allies = Object.keys(s.instances).filter(
      (id) => s.cardPool[s.instances[id as InstanceId]!.cardId]!.type === "ally" && id !== hopeOf(s),
    ) as InstanceId[];
    expect(allies.length).toBeGreaterThanOrEqual(4);
    const withAllies = (n: number) =>
      ({
        ...s,
        players: s.players.map((p) => ({
          ...p,
          hand: p.hand.filter((id) => !allies.includes(id)),
          deck: p.deck.filter((id) => !allies.includes(id)),
          playArea:
            p.playerId === P1
              ? [...p.playArea, ...allies.slice(0, n)]
              : p.playArea.filter((id) => !allies.includes(id)),
        })),
        instances: Object.fromEntries(
          Object.entries(s.instances).map(([id, i]) => [
            id,
            allies.slice(0, n).includes(id as InstanceId)
              ? { ...i, controllerId: P1, faceup: true, exhausted: false }
              : i,
          ]),
        ),
      }) as GameState;
    const three = drive(withAllies(3), endTurn(P1)).state;
    expect(playerOf(three, P1).playArea.filter((id) => allies.slice(0, 3).includes(id))).toHaveLength(3);
    expect(playerOf(three, P1).playArea).toContain(hopeOf(s));
    const four = withAllies(4);
    const over = drive(four, endTurn(P1));
    // Four other allies are over the limit and one is discarded; Hope is never the one.
    const kept = playerOf(over.state, P1).playArea.filter((id) => allies.includes(id));
    expect(kept).toHaveLength(3);
    expect(playerOf(over.state, P1).playArea).toContain(hopeOf(s));
  });

  it("two players: she starts with P1 and moves to P2 when the token passes, then back, keeping damage and exhaustion", () => {
    const s = game(scenario, [SPIDER_MAN, CAPTAIN_MARVEL]);
    const hope = hopeOf(s);
    expect(s.firstPlayerId).toBe(P1);
    expect(playAreaOf(s, hope)).toBe(P1);
    const marked = patchInstance(s, hope, { damage: 1, exhausted: true });
    const r2 = round(marked);
    expect(r2.state.firstPlayerId).toBe(P2);
    expect(playAreaOf(r2.state, hope)).toBe(P2);
    expect(inst(r2.state, hope).controllerId).toBe(P2);
    expect(inst(r2.state, hope).damage).toBe(1);
    expect(events(r2.events, "controllerChanged").filter((e) => e.instanceId === hope)).toEqual([
      expect.objectContaining({ from: P1, to: P2 }),
    ]);
    expect(r2.state.outcome).toBeNull();
    const r3 = round(r2.state);
    expect(r3.state.firstPlayerId).toBe(P1);
    expect(playAreaOf(r3.state, hope)).toBe(P1);
    expect(inst(r3.state, hope).damage).toBe(1);
  });
});

describe("base THW and ATK from her controller's hero (Q14 = B)", () => {
  it("the emitted data carries her stars as 0, so her base THW and ATK follow the hero", () => {
    const s = game("juggernaut");
    const hero = withForm(s, { heroForm: 0 });
    expect(stats(hero, hopeOf(hero))).toEqual({ thw: 1, atk: 2, hp: 3 });
  });

  it("a hero-form Spider-Man: THW 1, ATK 2; Hope has 3 hit points; in alter-ego form she is 0 and 0", () => {
    const s = game("juggernaut");
    const hope = hopeOf(s);
    // Peter Parker (alter ego) at setup: the star is undefined and reads 0.
    expect(stats(s, hope)).toEqual({ thw: 0, atk: 0, hp: 3 });
    const hero = withForm(s, { heroForm: 0 });
    const h = characterProfile(hero, identityOf(hero), WAVE7_DEPS)!;
    expect(h).toMatchObject({ thw: 1, atk: 2 });
    expect(stats(hero, hope)).toEqual({ thw: 1, atk: 2, hp: 3 });
  });

  it("modifiers on the hero are read (a hero's current value), and follow a change of controller", () => {
    const s0 = game("mister-sinister", [SPIDER_MAN, CAPTAIN_MARVEL]);
    const hope = hopeOf(s0);
    const heroes = withForm(withForm(s0, { heroForm: 0 }), { heroForm: 0 }, P2);
    const p1 = characterProfile(heroes, identityOf(heroes, P1), WAVE7_DEPS)!;
    const p2 = characterProfile(heroes, identityOf(heroes, P2), WAVE7_DEPS)!;
    expect(stats(heroes, hope)).toEqual({ thw: p1.thw, atk: p1.atk, hp: 3 });
    expect([p1.thw, p1.atk, p2.thw, p2.atk]).toEqual([1, 2, 2, 2]);
    const passed = round(heroes).state;
    expect(playAreaOf(passed, hope)).toBe(P2);
    expect(stats(passed, hope)).toEqual({ thw: 2, atk: 2, hp: 3 });
  });
});

describe("control follows the first-player token across rounds", () => {
  const three = [SPIDER_MAN, CAPTAIN_MARVEL, IRON_MAN] as const;

  it("three players: P1, P2, P3, then back to P1", () => {
    let s = game("juggernaut", three);
    const hope = hopeOf(s);
    const seen: (PlayerId | undefined)[] = [playAreaOf(s, hope)];
    for (let i = 0; i < 3; i++) {
      s = round(s, { alterEgo: true }).state;
      seen.push(playAreaOf(s, hope));
    }
    expect(seen).toEqual([P1, P2, P3, P1]);
    expect(s.outcome).toBeNull();
  });

  it("a player's elimination: the first player is eliminated, Hope goes to the next first player and stays in play", () => {
    const s0 = game("juggernaut", [SPIDER_MAN, CAPTAIN_MARVEL]);
    const hope = hopeOf(s0);
    // P1 (first player, hero form) is one point from defeat; Juggernaut's attack finishes them.
    const hp = characterProfile(s0, identityOf(s0, P1), WAVE7_DEPS)!;
    const alter = patchInstance(s0, identityOf(s0, P1), { damage: 100 });
    expect(hp.maxHp).toBeGreaterThan(0);
    const run = round(alter, { keepDamage: true });
    expect(run.state.players.find((p) => p.playerId === P1)!.eliminated).toBe(true);
    expect(run.state.outcome).toBeNull();
    expect(run.state.firstPlayerId).toBe(P2);
    expect(playAreaOf(run.state, hope)).toBe(P2);
    expect(inst(run.state, hope).controllerId).toBe(P2);
  });

  it("three players: a non-first player's elimination does not move her; the first player's does", () => {
    const s0 = game("juggernaut", three);
    const hope = hopeOf(s0);
    const killed = patchInstance(s0, identityOf(s0, P2), { damage: 100 });
    const run = round(killed, { keepDamage: true });
    expect(run.state.players.find((p) => p.playerId === P2)!.eliminated).toBe(true);
    // The token passes at the end of the round to the next player still in the game: P3.
    expect(run.state.firstPlayerId).toBe(P3);
    expect(playAreaOf(run.state, hope)).toBe(P3);
    expect(run.state.outcome).toBeNull();
  });
});

describe("if she leaves play the players lose the game", () => {
  it("defeated while defending: the game is lost with Hope as the source", () => {
    const s0 = game("juggernaut");
    const hope = hopeOf(s0);
    const hero = withForm(s0, { heroForm: 0 });
    const stacked = stackEncounterDeck(hero, BLANK_BOOSTS[0]);
    let defended = false;
    const run = driveEventsPicking(
      WAVE7_DEPS,
      patchInstance(stacked, hope, { damage: 2 }),
      (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "declareDefender") {
          const hit = choice.options.find((o) => o.label === "Hope Summers");
          defended = defended || hit !== undefined;
          return [hit ? hit.optionId : "decline"];
        }
        if (choice.prompt.kind === "chooseTriggers") return [];
        return firstLegal(s);
      },
      endTurn(P1),
    );
    expect(defended).toBe(true);
    expect(run.state.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: hope });
    expect(events(run.events, "characterDefeated").some((e) => e.instanceId === hope)).toBe(true);
  });
});

describe("Captive Hope", () => {
  const ready = (s: GameState, hope: InstanceId) => !inst(s, hope).exhausted;

  it.each(["juggernaut", "mister-sinister", "stryfe"] as const)(
    "%s: When Revealed exhausts Hope, and she does not ready at the end of the round",
    (scenario) => {
      const s = game(scenario);
      const hope = hopeOf(s);
      expect(ready(s, hope)).toBe(true);
      const run = round(s, { reveals: [CAPTIVE_HOPE] });
      const captive = Object.keys(run.state.instances).find(
        (id) => nameOf(run.state, id as InstanceId) === "Captive Hope",
      ) as InstanceId;
      expect(captive).toBeDefined();
      expect(inst(run.state, hope).exhausted).toBe(true);
      const again = round(run.state);
      expect(inst(again.state, hope).exhausted).toBe(true);
    },
  );

  it("starting threat is 3 per player: 6 with two players", () => {
    const s = game("mister-sinister", [SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = round(s, { reveals: [CAPTIVE_HOPE] });
    const captive = Object.keys(run.state.instances).find(
      (id) => nameOf(run.state, id as InstanceId) === "Captive Hope",
    ) as InstanceId;
    expect(inst(run.state, captive).threat).toBe(6);
  });

  it("without Captive Hope an exhausted Hope readies at the end of the round", () => {
    const s = patchInstance(game("juggernaut"), hopeOf(game("juggernaut")), {});
    const hope = hopeOf(s);
    const tired = patchInstance(s, hope, { exhausted: true });
    expect(inst(round(tired).state, hope).exhausted).toBe(false);
  });

  it("two players: Captive Hope is in play, the token passes, and the exhausted Hope moves with it still exhausted", () => {
    const s = game("juggernaut", [SPIDER_MAN, CAPTAIN_MARVEL]);
    const hope = hopeOf(s);
    const r1 = round(s, { reveals: [CAPTIVE_HOPE] });
    expect(playAreaOf(r1.state, hope)).toBe(P2);
    expect(inst(r1.state, hope).exhausted).toBe(true);
    const r2 = round(r1.state);
    expect(playAreaOf(r2.state, hope)).toBe(P1);
    expect(inst(r2.state, hope).exhausted).toBe(true);
  });
});
