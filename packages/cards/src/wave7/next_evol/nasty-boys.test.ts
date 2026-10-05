import { activeVillain, createGame, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
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
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { NASTY_BOYS } from "./nasty-boys.js";

vi.setConfig({ testTimeout: 120_000 });

const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const ONE = [SPIDER_MAN] as const;
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL)[];

const GEORGE = "40112";
const HAIRBAG = "40113";
const RAMROD = "40114";
const RUCKUS = "40115";
const SLAB = "40116";
const GET_NASTY = "40117";
const FILLER = "40145"; // Sinister Soldier: a card to be dealt after the one under test

/** Mister Sinister with the Nasty Boys as the modular set, past setup. */
function game(players: Seats = ONE): GameState {
  const config = wave7Scenario("mister-sinister", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: ["nasty_boys"],
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}

const cardOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
const mainOf = (s: GameState) => s.mainScheme.instanceId;
const events = <T extends GameEvent["type"]>(run: readonly GameEvent[], type: T) =>
  run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const inPlayOf = (s: GameState, p: PlayerId, code: string) =>
  playerOf(s, p).playArea.find((id) => cardOf(s, id) === code);
const where = (s: GameState, code: string): "deck" | "discard" | "play" | "gone" => {
  if (piles(s).deck.some((id) => cardOf(s, id) === code)) return "deck";
  if (piles(s).discard.some((id) => cardOf(s, id) === code)) return "discard";
  if (s.players.some((p) => inPlayOf(s, p.playerId, code))) return "play";
  return "gone";
};
/** No threat on the main scheme, so the villain phase's acceleration completes nothing (it would reshuffle the stacked deck). */
const calm = (s: GameState): GameState => patchInstance(s, mainOf(s), { threat: 0 });
/** Surgery: `code` engaged with `player`, and (when asked) a state of its own. */
const engaged = (s: GameState, code: string, player: PlayerId = P1) => engageMinion(s, code, player);
const withStatus = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough", n = 1) =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [name]: n } });

interface Plan {
  /** Label (start) of the option to pick at a card or target prompt; the first offered otherwise. */
  readonly pick?: readonly string[];
  /** Characters that defend, one per prompt (each only if offered); nobody otherwise. */
  readonly defenders?: readonly InstanceId[];
}
interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly prompts: readonly { readonly kind: string; readonly player: PlayerId; readonly labels: readonly string[] }[];
}
function drive(state: GameState, plan: Plan, ...commands: Parameters<typeof driveEventsPicking>[3][]): Run {
  const prompts: { kind: string; player: PlayerId; labels: readonly string[] }[] = [];
  const picks = [...(plan.pick ?? [])];
  const defenders = [...(plan.defenders ?? [])];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    prompts.push({ kind: choice.prompt.kind, player: choice.playerId, labels: choice.options.map((o) => o.label) });
    switch (choice.prompt.kind) {
      case "declareDefender": {
        const next = defenders.shift();
        return [next && choice.options.some((o) => o.optionId === next) ? next : "decline"];
      }
      case "chooseTriggers":
        return [];
      default: {
        const hit = picks[0] ? choice.options.find((o) => o.label.startsWith(picks[0]!)) : undefined;
        if (hit) {
          picks.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
  const { state: after, events: log } = driveEventsPicking(WAVE7_DEPS, state, pick, ...commands);
  return { state: after, events: log, prompts };
}
/** Hero form, every player ends their turn. `stack` is the top of the encounter deck: the villain's boost card(s), then the deals. */
function round(state: GameState, stack: readonly string[], plan: Plan = {}, form: "hero" | "alterEgo" = "hero"): Run {
  const stacked = stackEncounterDeck(state, ...stack);
  const formed = state.players.reduce(
    (s, p) => withForm(s, form === "alterEgo" ? "alterEgo" : { heroForm: 0 }, p.playerId),
    stacked,
  );
  return drive(formed, plan, ...state.players.map((p) => endTurn(p.playerId)));
}
/** A blank boost card for each of the villain's activations, then `deals`. */
const BLANK = ["01186", "01187"] as const;
const quiet = (s: GameState, deals: readonly string[] = [], plan: Plan = {}) =>
  round(s, [...BLANK.slice(0, s.players.length), ...deals], plan);

const attacksBy = (run: Run, id: InstanceId) =>
  events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === id);
const ids = (s: GameState, code: string) =>
  Object.keys(s.instances).filter((i) => cardOf(s, i as InstanceId) === code) as InstanceId[];

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(NASTY_BOYS).sort()).toEqual(
      [
        "40112.gorgeous-george-forced-interrupt",
        "40112.boost",
        "40113.boost",
        "40114.ramrod-constant",
        "40114.boost",
        "40115.when-revealed",
        "40115.boost",
        "40116.slab-forced-interrupt",
        "40117.get-nasty-constant",
        "40117.when-revealed",
      ].sort(),
    );
  });
});

const villainId = (s: GameState) => activeVillain(s).instanceId;
/** The Sinister attack of the round (the villain is stage I: ATK 2) and its boost cards' icons. */
const sinisterAttack = (s: GameState, run: Run) => attacksBy(run, villainId(s))[0];
const revealedId = (run: Run, code: string): InstanceId =>
  events(run.events, "encounterCardRevealed").find((e) => e.cardId === code)!.instanceId;
const exhaustedIds = (run: Run) => events(run.events, "cardExhausted").map((e) => e.instanceId);
const stunnedOf = (s: GameState, id: InstanceId) => inst(s, id).statuses.stunned;
const hopeOf = (s: GameState, p: PlayerId = P1) => inPlayOf(s, p, "40130")!;
const promptsOf = (run: Run, kind: string) => run.prompts.filter((p) => p.kind === kind);

describe("Gorgeous George (40112): 40112.gorgeous-george-forced-interrupt, 40112.boost", () => {
  it("when he attacks you, you choose a character you control to exhaust: the hero (Hope Summers is the other choice)", () => {
    const { state, id } = engaged(calm(game()), GEORGE);
    const run = quiet(state, [], { pick: ["Spider-Man"] });
    expect(promptsOf(run, "chooseTarget")).toEqual([
      { kind: "chooseTarget", player: P1, labels: ["Spider-Man", "Hope Summers"] },
    ]);
    expect(exhaustedIds(run)).toEqual([identityOf(state, P1)]);
    // The interrupt came first: the hero is exhausted when the attack lands (2 ATK, undefended), and cannot defend.
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
  });

  it("the other choice: Hope Summers is exhausted and the hero is not", () => {
    const { state, id } = engaged(calm(game()), GEORGE);
    const run = quiet(state, [], { pick: ["Hope Summers"] });
    expect(exhaustedIds(run)).toEqual([hopeOf(state)]);
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
  });

  it("2 players: only the attacked player chooses, among their own characters (Hope Summers is the first player's)", () => {
    const { state, id } = engaged(calm(game(TWO)), GEORGE, P2);
    const run = quiet(state);
    expect(promptsOf(run, "chooseTarget")).toEqual([{ kind: "chooseTarget", player: P2, labels: ["Captain Marvel"] }]);
    expect(exhaustedIds(run)).toEqual([identityOf(state, P2)]);
    expect(attacksBy(run, id)).toHaveLength(1);
  });

  it("[star] Boost (on the villain's attack): exhaust a character you control; his 1 boost icon counts", () => {
    const state = calm(game());
    const run = round(state, [GEORGE, FILLER], { pick: ["Hope Summers"] });
    expect(promptsOf(run, "chooseTarget")).toEqual([
      { kind: "chooseTarget", player: P1, labels: ["Spider-Man", "Hope Summers"] },
    ]);
    expect(exhaustedIds(run)).toEqual([hopeOf(state)]);
    expect(sinisterAttack(state, run)).toMatchObject({ baseAtk: 2, boostIcons: 1 });
  });

  it("[star] Boost, the hero choice", () => {
    const state = calm(game());
    const run = round(state, [GEORGE, FILLER], { pick: ["Spider-Man"] });
    expect(exhaustedIds(run)).toEqual([identityOf(state, P1)]);
  });

  it("[star] Boost, 2 players: only the player the villain attacks chooses (the second attack's boost is blank)", () => {
    const state = calm(game(TWO));
    const run = round(state, [GEORGE, "01186", FILLER, FILLER]);
    expect(promptsOf(run, "chooseTarget").map((p) => p.player)).toEqual([P1]);
  });
});

describe("Hairbag (40113): 40113.boost", () => {
  it("after the activation, Hairbag is shuffled into the encounter deck (not discarded); his 2 boost icons count", () => {
    const state = calm(game());
    const hairbag = ids(state, HAIRBAG)[0]!;
    const run = round(state, [HAIRBAG, FILLER]);
    expect(sinisterAttack(state, run)).toMatchObject({ baseAtk: 2, boostIcons: 2 });
    const moves = events(run.events, "cardMoved").filter((e) => e.instanceId === hairbag);
    // The boost card goes to the encounter discard pile as the activation ends, and from there into the deck.
    expect(moves.at(-1)!.to.kind).toBe("encounterDeck");
    const attackAt = run.events.findIndex((e) => e.type === "attackResolved");
    const shuffledAt = run.events.findIndex(
      (e) => e.type === "cardMoved" && e.instanceId === hairbag && e.to.kind === "encounterDeck",
    );
    expect(shuffledAt).toBeGreaterThan(attackAt);
    expect(piles(run.state).discard.some((i) => i === hairbag)).toBe(false);
  });

  it("in play as a minion he attacks for his printed 2 and does nothing else (no boost, no shuffle)", () => {
    const { state, id } = engaged(calm(game()), HAIRBAG);
    const run = quiet(state);
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(where(run.state, HAIRBAG)).toBe("play");
  });
});

describe("Ramrod (40114): 40114.ramrod-constant, 40114.boost", () => {
  // Mister Sinister is stunned so that his own attack does not use up the tough status card first. Piercing discards the
  // tough status card and then deals the damage in full (RRG 1.8 "Piercing"); without it the card prevents the damage.
  const armored = () => {
    const base = calm(game());
    const hero = identityOf(base, P1);
    return withStatus(withStatus(base, hero, "tough"), villainId(base), "stunned");
  };
  const toughRemoved = (run: Run, hero: InstanceId) =>
    events(run.events, "statusRemoved")
      .filter((e) => e.instanceId === hero && e.status === "tough")
      .map((e) => e.reason);

  it("his attacks gain piercing: the tough status card is discarded by it and the full 2 damage is dealt", () => {
    const { state, id } = engaged(armored(), RAMROD);
    const hero = identityOf(state, P1);
    const run = drive(stackEncounterDeck(withForm(state, { heroForm: 0 }), FILLER), {}, endTurn(P1));
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 2 }]);
    expect(toughRemoved(run, hero)).toEqual(["piercing"]);
    expect(inst(run.state, hero).damage).toBe(2);
  });

  it("control: a minion without piercing (George, 2 ATK) has the tough status card prevent the damage", () => {
    const { state, id } = engaged(armored(), GEORGE);
    const hero = identityOf(state, P1);
    const run = drive(
      stackEncounterDeck(withForm(state, { heroForm: 0 }), FILLER),
      { pick: ["Hope Summers"] },
      endTurn(P1),
    );
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 2 }]);
    expect(toughRemoved(run, hero)).toEqual(["preventedDamage"]);
    expect(inst(run.state, hero).damage).toBe(0);
  });

  it("[star] Boost, when the villain is attacking: that attack gains piercing (2 ATK + 1 icon = 3 damage)", () => {
    const base = calm(game());
    const hero = identityOf(base, P1);
    const state = withStatus(base, hero, "tough");
    const run = round(state, [RAMROD, FILLER]);
    expect(sinisterAttack(state, run)).toMatchObject({ baseAtk: 2, boostIcons: 1 });
    expect(toughRemoved(run, hero)).toEqual(["piercing"]);
    expect(inst(run.state, hero).damage).toBe(3);
  });

  it("control: without the piercing boost the same attack's tough status card prevents the damage (a blank boost card)", () => {
    const base = calm(game());
    const hero = identityOf(base, P1);
    const state = withStatus(base, hero, "tough");
    const run = round(state, ["01186", FILLER]);
    expect(sinisterAttack(state, run)).toMatchObject({ baseAtk: 2, boostIcons: 0 });
    expect(toughRemoved(run, hero)).toEqual(["preventedDamage"]);
    expect(inst(run.state, hero).damage).toBe(0);
  });

  it("[star] Boost when the villain schemes (alter-ego): there is no attack to pierce, the scheme resolves with its icon", () => {
    const state = calm(game());
    const run = round(state, [RAMROD, FILLER], {}, "alterEgo");
    expect(events(run.events, "threatPlaced").some((e) => e.amount === 3)).toBe(true);
    expect(events(run.events, "attackResolved").filter((e) => e.enemyInstanceId === villainId(state))).toEqual([]);
  });
});

describe("Ruckus (40115): 40115.when-revealed, 40115.boost", () => {
  it("When Revealed: stun each character you control (the hero and Hope Summers), whether in hero or alter-ego form", () => {
    for (const form of ["hero", "alterEgo"] as const) {
      const state = calm(game());
      const run = round(state, [...BLANK.slice(0, 1), RUCKUS], {}, form);
      const hero = identityOf(state, P1);
      expect(stunnedOf(run.state, hero), form).toBe(1);
      expect(stunnedOf(run.state, hopeOf(state)), form).toBe(1);
      expect(where(run.state, RUCKUS), form).toBe("play");
    }
  });

  it("2 players: only the player who revealed it has their characters stunned", () => {
    const state = calm(game(TWO));
    const run = round(state, [...BLANK, RUCKUS, FILLER]);
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(1);
    expect(stunnedOf(run.state, hopeOf(state))).toBe(1);
    expect(stunnedOf(run.state, identityOf(state, P2))).toBe(0);
  });

  it("a character that is already stunned stays at one stunned status card", () => {
    const base = calm(game());
    const state = withStatus(base, hopeOf(base), "stunned");
    const run = round(state, [...BLANK.slice(0, 1), RUCKUS]);
    expect(stunnedOf(run.state, hopeOf(state))).toBe(1);
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(1);
  });

  it("[star] Boost: you are stunned (your identity only, Hope Summers is not); his 1 boost icon counts", () => {
    const state = calm(game());
    const run = round(state, [RUCKUS, FILLER]);
    expect(sinisterAttack(state, run)).toMatchObject({ baseAtk: 2, boostIcons: 1 });
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(1);
    expect(stunnedOf(run.state, hopeOf(state))).toBe(0);
  });

  it("[star] Boost, 2 players: only the player the villain was attacking is stunned", () => {
    const state = calm(game(TWO));
    const run = round(state, [RUCKUS, "01186", FILLER, FILLER]);
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(1);
    expect(stunnedOf(run.state, identityOf(state, P2))).toBe(0);
  });

  it("in play his printed stats are 1 ATK 2 SCH: he attacks a hero-form player for 1", () => {
    const { state, id } = engaged(calm(game()), RUCKUS);
    const run = quiet(state);
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 1, damageDealt: 1 }]);
  });
});

describe("Slab (40116): 40116.slab-forced-interrupt", () => {
  it("When Slab attacks: 1 growth counter, and +1 ATK per counter on him for this attack (1 ATK + 1 = 2)", () => {
    const { state, id } = engaged(calm(game()), SLAB);
    const run = quiet(state);
    expect(inst(run.state, id).counters.growth).toBe(1);
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
  });

  it("with 2 counters already on him: a third is placed and the attack is 1 + 3 = 4", () => {
    const base = engaged(calm(game()), SLAB);
    const state = patchInstance(base.state, base.id, { counters: { growth: 2 } });
    const run = quiet(state);
    expect(inst(run.state, base.id).counters.growth).toBe(3);
    expect(attacksBy(run, base.id)).toMatchObject([{ baseAtk: 4, damageDealt: 4 }]);
  });

  it("the counters stay: the next round's attack is 1 + 2 = 3", () => {
    const { state, id } = engaged(calm(game()), SLAB);
    const first = quiet(state);
    const second = quiet(calm(first.state));
    expect(attacksBy(first, id)).toMatchObject([{ baseAtk: 2 }]);
    expect(inst(second.state, id).counters.growth).toBe(2);
    expect(attacksBy(second, id)).toMatchObject([{ baseAtk: 3 }]);
  });

  it("2 players: an attack on the second player grows him all the same", () => {
    const { state, id } = engaged(calm(game(TWO)), SLAB, P2);
    const run = quiet(state);
    expect(inst(run.state, id).counters.growth).toBe(1);
    expect(attacksBy(run, id)).toMatchObject([{ baseAtk: 2, targetInstanceId: identityOf(state, P2) }]);
  });
});

describe("Get Nasty (40117): 40117.get-nasty-constant, 40117.when-revealed", () => {
  const MINION_FILLER = FILLER;

  it("constant: each minion gets +1 ATK (George 2 -> 3, Hairbag 2 -> 3)", () => {
    const planted = encounterCardInVillainArea(calm(game()), GET_NASTY, 3);
    const george = engaged(planted.state, GEORGE);
    const run = quiet(george.state);
    expect(attacksBy(run, george.id)).toMatchObject([{ baseAtk: 3, damageDealt: 3 }]);
    const hairbag = engaged(planted.state, HAIRBAG);
    expect(attacksBy(quiet(hairbag.state), hairbag.id)).toMatchObject([{ baseAtk: 3 }]);
  });

  it("constant: the villain is not a minion, so Mister Sinister's attack is unchanged (ATK 2)", () => {
    const planted = encounterCardInVillainArea(calm(game()), GET_NASTY, 3);
    const run = quiet(planted.state);
    expect(sinisterAttack(planted.state, run)).toMatchObject({ baseAtk: 2 });
  });

  it("When Revealed with no minion in play: 0 threat placed (3 on it), then a NASTY BOY is searched for and revealed", () => {
    const state = calm(game());
    const run = round(state, [...BLANK.slice(0, 1), GET_NASTY], { pick: ["Slab"] });
    const scheme = revealedId(run, GET_NASTY);
    expect(inst(run.state, scheme).threat).toBe(3);
    const found = promptsOf(run, "chooseCards");
    expect(found.map((p) => p.labels.slice().sort())).toEqual([
      ["Gorgeous George", "Hairbag", "Ramrod", "Ruckus", "Slab"],
    ]);
    expect(where(run.state, SLAB)).toBe("play");
    expect(events(run.events, "encounterCardRevealed").map((e) => e.cardId)).toEqual([GET_NASTY, SLAB]);
  });

  it("threat: 1 per minion in play, 2 per NASTY BOY (Ramrod and Sinister Soldier: 1 + 2 + 1 = 4 more, 7 in all)", () => {
    const withRamrod = engaged(calm(game()), RAMROD).state;
    const withSoldier = engaged(withRamrod, FILLER).state;
    const run = round(withSoldier, [...BLANK.slice(0, 1), GET_NASTY], { pick: ["Ruckus"] });
    expect(inst(run.state, revealedId(run, GET_NASTY)).threat).toBe(3 + 2 + 1);
    expect(MINION_FILLER).toBe(FILLER);
  });

  it("threat counts every player's minions: George engaged with the second player, Ramrod with the first (2 + 2 = 4 more)", () => {
    const a = engaged(calm(game(TWO)), RAMROD, P1);
    const b = engaged(a.state, GEORGE, P2);
    const run = round(b.state, [...BLANK, GET_NASTY, FILLER], { pick: ["Slab"] });
    expect(inst(run.state, revealedId(run, GET_NASTY)).threat).toBe(3 + 4);
  });

  it("the revealed minion is not counted (threat is placed before the search)", () => {
    const base = engaged(calm(game()), GEORGE);
    const run = round(base.state, [...BLANK.slice(0, 1), GET_NASTY], { pick: ["Ruckus"] });
    expect(inst(run.state, revealedId(run, GET_NASTY)).threat).toBe(3 + 2);
    expect(where(run.state, RUCKUS)).toBe("play");
  });

  it("the search includes the encounter discard pile: the only NASTY BOY left is Ruckus, in the discard", () => {
    const base = calm(game());
    const nasty = [GEORGE, HAIRBAG, RAMROD, RUCKUS, SLAB].flatMap((c) => ids(base, c));
    const ruckus = ids(base, RUCKUS)[0]!;
    const deckId = Object.keys(base.encounterDecks)[0]!;
    const state: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: {
          deck: piles(base).deck.filter((i) => !nasty.includes(i)),
          discard: [...piles(base).discard.filter((i) => !nasty.includes(i)), ruckus],
        },
      },
    };
    const run = round(state, [...BLANK.slice(0, 1), GET_NASTY]);
    expect(events(run.events, "encounterCardRevealed").map((e) => e.cardId)).toEqual([GET_NASTY, RUCKUS]);
    expect(where(run.state, RUCKUS)).toBe("play");
  });

  it("no NASTY BOY left in the deck or discard: the threat is placed and nothing is revealed", () => {
    const base = calm(game());
    const nasty = [GEORGE, HAIRBAG, RAMROD, RUCKUS, SLAB].flatMap((c) => ids(base, c));
    const deckId = Object.keys(base.encounterDecks)[0]!;
    const state: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: {
          deck: piles(base).deck.filter((i) => !nasty.includes(i)),
          discard: piles(base).discard.filter((i) => !nasty.includes(i)),
        },
      },
    };
    const run = round(state, [...BLANK.slice(0, 1), GET_NASTY]);
    expect(events(run.events, "encounterCardRevealed").map((e) => e.cardId)).toEqual([GET_NASTY]);
    expect(inst(run.state, revealedId(run, GET_NASTY)).threat).toBe(3);
  });
});

describe("Teamwork (NASTY BOY) with the set's own reveals", () => {
  it("Ruckus revealed while Ramrod is in play: Ruckus activates against the hero (1 ATK) as his teamwork, and the hero ends stunned", () => {
    const { state } = engaged(calm(game()), RAMROD);
    const run = round(state, [...BLANK.slice(0, 1), RUCKUS]);
    const ruckus = revealedId(run, RUCKUS);
    expect(attacksBy(run, ruckus)).toMatchObject([{ baseAtk: 1 }]);
    expect(stunnedOf(run.state, identityOf(state, P1))).toBe(1);
  });
});
