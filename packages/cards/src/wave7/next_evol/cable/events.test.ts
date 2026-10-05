import { applyCommand, createGame, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../../index.js";
import { CABLE_EVENTS } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Cable's hero events (40002-40005), docs/phase7-wave7.md §7.1. Cable's real precon (`cable-leadership`) against
 * Juggernaut, through `wave7Scenario` with the real registry. Cable in hero form has a hand of 5 and THW 2 / ATK 2.
 * The victory display is staged by surgery (`toVictory`): the cards of the display are a count the events read.
 */
const BODYSLIDE = "40002.bodyslide-action";
const MIND_SCAN = "40003.mind-scan-action";
const PRECOGNITION = "40004.precognition-action";
const BLAST = "40005.telekinetic-blast-action";
const CABLE = { starterDeckId: "cable-leadership" } as const;
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const PURGE = "40006";
const BREAKIN = "40131"; // Captive Hope: an encounter side scheme, staged
const PLAYER_SCHEMES = ["40018", "40019", "40020", "40027"]; // more side schemes of Cable's deck, for the display

type Seat = typeof CABLE | typeof SPIDER_MAN;
const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;

/** Soldier X's setup search picks Technovirus Purge. */
const choosingPurge: Picker = (state) => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseCards") {
    const hit = choice.options.find((o) => codeOf(state, o.optionId as InstanceId) === PURGE);
    if (hit) return [hit.optionId];
  }
  return firstLegal(state);
};

/** Cable in hero form with Technovirus Purge in play (5 threat), the main scheme at 20. */
function heroGame(players: readonly Seat[] = [CABLE], seed = 1): GameState {
  const config = wave7Scenario("juggernaut", { players, seed, difficulty: "standard", modularSetIds: [] });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, choosingPurge, (s) => s.step.phase === "player", WAVE7_DEPS);
  const hero = withForm(settled, { heroForm: 0 });
  return patchInstance(hero, hero.mainScheme.instanceId, { threat: 20 });
}
const purgeOf = (s: GameState): InstanceId => instancesOf(s, PURGE)[0]!;
const mainOf = (s: GameState): InstanceId => s.mainScheme.instanceId;
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
/** Juggernaut starts with a tough status card, which would absorb the whole blast: take it off. */
const withoutTough = (s: GameState): GameState =>
  patchInstance(s, villainOf(s), { statuses: { ...inst(s, villainOf(s)).statuses, tough: 0 } });

/** Moves a side scheme (wherever it is: in play, a deck, a hand, a discard pile) into the victory display. */
function toVictory(state: GameState, id: InstanceId): GameState {
  return {
    ...state,
    villainArea: state.villainArea.filter((x) => x !== id),
    victoryDisplay: [...state.victoryDisplay, id],
    players: state.players.map((p) => ({
      ...p,
      deck: p.deck.filter((x) => x !== id),
      hand: p.hand.filter((x) => x !== id),
      discard: p.discard.filter((x) => x !== id),
    })),
  };
}
/** `n` side schemes in the victory display: Purge (from play), Captive Hope (an encounter scheme), then Cable's own. */
function withVictory(state: GameState, n: number): GameState {
  let s = state;
  const sources: InstanceId[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) sources.push(purgeOf(s));
    else if (i === 1) {
      const staged = encounterCardInVillainArea(s, BREAKIN, 2);
      s = staged.state;
      sources.push(staged.id);
    } else sources.push(instancesOf(s, PLAYER_SCHEMES[i - 2]!)[0]!);
  }
  for (const id of sources) s = toVictory(s, id);
  return s;
}

/** Plays `code` from hand paying `cost` with other hand cards, answering prompts with `pick`. */
function playEvent(
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  player: typeof P1 = P1,
): { state: GameState; id: InstanceId; before: GameState } {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const payment = payWith(given.state, player, cost, [id]);
  const driven = driveEventsPicking(WAVE7_DEPS, given.state, pick, play(player, id, payment));
  return { state: driven.state, id, before: given.state };
}
const rejected = (state: GameState, command: Command): boolean => !applyCommand(state, command, WAVE7_DEPS).ok;
/** Whether playing `code` as `player` is refused right now. */
function playRefused(state: GameState, code: string, cost: number, player: typeof P1 = P1): boolean {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  return rejected(given.state, play(player, id, payWith(given.state, player, cost, [id])));
}

const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;

describe("Cable events registry", () => {
  it.each([BODYSLIDE, MIND_SCAN, PRECOGNITION, BLAST])("%s validates", (id) => {
    expect(validateDefinition(CABLE_EVENTS[id]!)).toEqual([]);
  });
  it("holds exactly the four event refs", () => {
    expect(Object.keys(CABLE_EVENTS).sort()).toEqual([BODYSLIDE, MIND_SCAN, PRECOGNITION, BLAST].sort());
  });
});

describe("Bodyslide (40002)", () => {
  it("costs 0: from hero form Cable changes to alter-ego without using his change of the round", () => {
    const base = heroGame();
    const { state, id, before } = playEvent(base, "40002", 0);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(playerOf(state, P1).identity.changedFormThisRound).toBe(false);
    expect(playerOf(state, P1).discard).toContain(id);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(before, P1).hand.length - 1);
  });

  it("is an Action, so it can be played in alter-ego form too: Cable changes to hero form", () => {
    const base = withForm(heroGame(), "alterEgo");
    const { state } = playEvent(base, "40002", 0);
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(playerOf(state, P1).identity.changedFormThisRound).toBe(false);
  });

  it("two players: each other player may change to the form Cable is now in (hero to alter-ego), and one who accepts does", () => {
    const base = withForm(heroGame([CABLE, SPIDER_MAN]), { heroForm: 0 }, P2);
    let asked: string[] = [];
    const accept: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption") {
        asked = s.pendingChoice.options.map((o) => o.label);
        expect(s.pendingChoice.playerId).toBe(P2);
        return [s.pendingChoice.options.find((o) => o.label === "Change to alter-ego form")!.optionId];
      }
      return firstLegal(s);
    };
    const { state } = playEvent(base, "40002", 0, accept);
    expect(asked).toEqual(["Change to alter-ego form", "Do not change form"]);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(playerOf(state, P2).identity.form).toBe("alterEgo");
    expect(playerOf(state, P2).identity.changedFormThisRound).toBe(false);
  });

  it("two players: the other player may decline and stays in hero form", () => {
    const base = withForm(heroGame([CABLE, SPIDER_MAN]), { heroForm: 0 }, P2);
    const decline: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "chooseOption"
        ? [s.pendingChoice.options.find((o) => o.label === "Do not change form")!.optionId]
        : firstLegal(s);
    const { state } = playEvent(base, "40002", 0, decline);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(playerOf(state, P2).identity.form).toBe("hero");
  });

  it("two players: from alter-ego Cable goes to hero form and a player in alter-ego may follow him", () => {
    const base = withForm(heroGame([CABLE, SPIDER_MAN]), "alterEgo");
    let asked: string[] = [];
    const accept: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption") {
        asked = s.pendingChoice.options.map((o) => o.label);
        return [s.pendingChoice.options[0]!.optionId];
      }
      return firstLegal(s);
    };
    const { state } = playEvent(base, "40002", 0, accept);
    expect(asked).toEqual(["Change to hero form", "Do not change form"]);
    expect(playerOf(state, P1).identity.form).toBe("hero");
    expect(playerOf(state, P2).identity.form).toBe("hero");
  });

  it("a player already in the form Cable changes to is not asked", () => {
    const base = withForm(heroGame([CABLE, SPIDER_MAN]), "alterEgo");
    expect(playerOf(base, P2).identity.form).toBe("alterEgo");
    // Cable goes hero -> alter-ego while Spider-Man (alter-ego) is already there.
    const hero = withForm(base, { heroForm: 0 });
    let prompts = 0;
    const count: Picker = (s) => {
      if (s.pendingChoice?.prompt.kind === "chooseOption") prompts++;
      return firstLegal(s);
    };
    const { state } = playEvent(hero, "40002", 0, count);
    expect(prompts).toBe(0);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    expect(playerOf(state, P2).identity.form).toBe("alterEgo");
  });
});

describe("Mind Scan (40003)", () => {
  const scan = (state: GameState, target: InstanceId, pick: Picker = firstLegal) =>
    playEvent(state, "40003", 2, (s) =>
      s.pendingChoice?.prompt.kind === "chooseTarget" ? picking(target)(s) : pick(s),
    );

  it("with no side scheme in the victory display removes 3 threat; the cost of 2 is paid from hand", () => {
    const base = heroGame();
    const { state, id, before } = scan(base, mainOf(base));
    expect(threat(state, mainOf(state))).toBe(17);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(before, P1).hand.length - 3);
    expect(playerOf(state, P1).discard).toContain(id);
  });

  it.each([
    [1, 16],
    [2, 15],
    [3, 14],
  ])("with %i side schemes in the victory display removes 3 + that many (main scheme 20 -> %i)", (n, left) => {
    const base = withVictory(heroGame(), n);
    expect(base.victoryDisplay).toHaveLength(n);
    const { state } = scan(base, mainOf(base));
    expect(threat(state, mainOf(state))).toBe(left);
  });

  it("can only be played in hero form", () => {
    const alterEgo = withForm(heroGame(), "alterEgo");
    expect(playRefused(alterEgo, "40003", 2)).toBe(true);
    expect(playRefused(heroGame(), "40003", 2)).toBe(false);
  });

  it("threat removed from a player side scheme: 4 threat left on Technovirus Purge is defeated only with a scheme in the display", () => {
    const base = patchInstance(heroGame(), purgeOf(heroGame()), { threat: 4 });
    const plain = scan(base, purgeOf(base));
    expect(threat(plain.state, purgeOf(plain.state))).toBe(1);
    expect(plain.state.victoryDisplay).toHaveLength(0);
    // One side scheme (an encounter one) in the display: 3 + 1 = 4 defeats it.
    const staged = encounterCardInVillainArea(base, BREAKIN, 2);
    const withOne = toVictory(staged.state, staged.id);
    const bumped = scan(withOne, purgeOf(withOne));
    expect(bumped.state.victoryDisplay).toContain(purgeOf(bumped.state));
    expect(bumped.state.victoryDisplay).toHaveLength(2);
  });

  it("Cable's identity response hears it: defeating a scheme with Mind Scan readies him", () => {
    const base = heroGame();
    const cable = identityOf(base, P1);
    const staged = patchInstance(patchInstance(base, purgeOf(base), { threat: 3 }), cable, { exhausted: true });
    const accept: Picker = (s) =>
      s.pendingChoice?.prompt.kind === "chooseTriggers"
        ? s.pendingChoice.options.filter((o) => o.optionId.includes("40001a.cable-response")).map((o) => o.optionId)
        : firstLegal(s);
    const { state } = scan(staged, purgeOf(staged), accept);
    expect(state.victoryDisplay).toContain(purgeOf(state));
    expect(inst(state, cable).exhausted).toBe(false);
  });

  it("two players: schemes in the shared victory display count whoever defeated them", () => {
    const base = withVictory(heroGame([CABLE, SPIDER_MAN]), 2);
    const { state } = scan(base, mainOf(base));
    expect(threat(state, mainOf(state))).toBe(15);
    expect(playerOf(state, P2).hand).toHaveLength(playerOf(base, P2).hand.length);
  });
});

describe("Precognition (40004)", () => {
  const topIds = (s: GameState, n: number): InstanceId[] => {
    const deck = s.encounterDecks[Object.keys(s.encounterDecks)[0]!]!.deck;
    return deck.slice(0, n);
  };
  const deckOf = (s: GameState): readonly InstanceId[] => s.encounterDecks[Object.keys(s.encounterDecks)[0]!]!.deck;
  const discardOf = (s: GameState): readonly InstanceId[] =>
    s.encounterDecks[Object.keys(s.encounterDecks)[0]!]!.discard;

  it("costs 0 and with no side scheme in the victory display looks at nothing", () => {
    const base = heroGame();
    let prompts = 0;
    const count: Picker = (s) => {
      if (s.pendingChoice) prompts++;
      return firstLegal(s);
    };
    const { state, id } = playEvent(base, "40004", 0, count);
    expect(prompts).toBe(0);
    expect(deckOf(state)).toEqual(deckOf(base));
    expect(playerOf(state, P1).discard).toContain(id);
  });

  it("with 2 side schemes in the display: looks at the top 2, may discard 1, the other stays on top", () => {
    const base = withVictory(heroGame(), 2);
    const [first, second] = topIds(base, 2) as [InstanceId, InstanceId];
    const third = deckOf(base)[2]!;
    const seen: InstanceId[] = [];
    const discardSecond: Picker = (s) => {
      const c = s.pendingChoice;
      if (c?.prompt.kind === "chooseCards") {
        seen.push(...(c.options.map((o) => o.optionId) as InstanceId[]));
        return [second];
      }
      return firstLegal(s);
    };
    const { state } = playEvent(base, "40004", 0, discardSecond);
    expect(seen.sort()).toEqual([first, second].sort());
    expect(discardOf(state)).toContain(second);
    expect(deckOf(state).slice(0, 2)).toEqual([first, third]);
    expect(deckOf(state)).toHaveLength(deckOf(base).length - 1);
  });

  it("the discard is optional: declining it leaves both cards on top", () => {
    const base = withVictory(heroGame(), 2);
    const [first, second] = topIds(base, 2) as [InstanceId, InstanceId];
    const { state } = playEvent(base, "40004", 0, firstLegal);
    expect(deckOf(state).slice(0, 2).sort()).toEqual([first, second].sort());
    expect(discardOf(state)).toEqual(discardOf(base));
  });

  it("with 3 side schemes it looks at the top 3 and puts the other two back in the order chosen", () => {
    const base = withVictory(heroGame(), 3);
    const [a, b, c] = topIds(base, 3) as [InstanceId, InstanceId, InstanceId];
    const pick: Picker = (s) => {
      const ch = s.pendingChoice;
      if (!ch) return [];
      if (ch.prompt.kind === "chooseCards") return [a];
      return ch.options
        .map((o) => o.optionId)
        .sort()
        .reverse()
        .slice(0, ch.minSelections);
    };
    const { state } = playEvent(base, "40004", 0, pick);
    expect(discardOf(state)).toContain(a);
    expect(deckOf(state).slice(0, 2).sort()).toEqual([b, c].sort());
    expect(deckOf(state)).toHaveLength(deckOf(base).length - 1);
  });

  it("can only be played in hero form", () => {
    expect(playRefused(withForm(heroGame(), "alterEgo"), "40004", 0)).toBe(true);
  });

  it("two players: Cable's look is his own; the other player's hand and prompts are untouched", () => {
    const base = withVictory(heroGame([CABLE, SPIDER_MAN]), 1);
    const owners = new Set<string>();
    const pick: Picker = (s) => {
      if (s.pendingChoice) owners.add(s.pendingChoice.playerId);
      return firstLegal(s);
    };
    const { state } = playEvent(base, "40004", 0, pick);
    expect([...owners]).toEqual([P1]);
    expect(playerOf(state, P2).hand).toEqual(playerOf(base, P2).hand);
  });
});

describe("Telekinetic Blast (40005)", () => {
  const blast = (staged: GameState) => {
    const state = withoutTough(staged);
    return playEvent(state, "40005", 3, (s) =>
      s.pendingChoice?.prompt.kind === "chooseTarget" ? picking(villainOf(state))(s) : firstLegal(s),
    );
  };

  it("an attack: Juggernaut's tough status card absorbs the blast (the damage is prevented, the card discarded)", () => {
    const base = heroGame();
    expect(inst(base, villainOf(base)).statuses.tough).toBe(1);
    const { state } = playEvent(base, "40005", 3, (s) =>
      s.pendingChoice?.prompt.kind === "chooseTarget" ? picking(villainOf(base))(s) : firstLegal(s),
    );
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(inst(state, villainOf(state)).statuses.tough).toBe(0);
  });

  it("with no side scheme in the victory display deals 6 damage to the villain; the cost of 3 is paid from hand", () => {
    const base = heroGame();
    const { state, id, before } = blast(base);
    expect(inst(state, villainOf(state)).damage).toBe(inst(base, villainOf(base)).damage + 6);
    expect(playerOf(state, P1).hand).toHaveLength(playerOf(before, P1).hand.length - 4);
    expect(playerOf(state, P1).discard).toContain(id);
  });

  it.each([1, 2, 3])("with %i side schemes in the victory display deals 6 + that many", (n) => {
    const base = withVictory(heroGame(), n);
    const { state } = blast(base);
    expect(inst(state, villainOf(state)).damage).toBe(inst(base, villainOf(base)).damage + 6 + n);
  });

  it("can only be played in hero form", () => {
    expect(playRefused(withForm(heroGame(), "alterEgo"), "40005", 3)).toBe(true);
  });

  it("two players: another player's side scheme in the display adds to Cable's blast", () => {
    const base = withVictory(heroGame([CABLE, SPIDER_MAN]), 1);
    const { state } = blast(base);
    expect(inst(state, villainOf(state)).damage).toBe(inst(base, villainOf(base)).damage + 7);
  });
});
