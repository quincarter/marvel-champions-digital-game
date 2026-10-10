import { describe, expect, it, vi } from "vitest";
import { CORE_CARDS, SILK_CARDS, encounterSetId } from "@mc/content";
import { createGame, maxHitPoints, type EngineDeps, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { validateDefinition } from "../../dsl/validate.js";
import { mergeRegistries } from "../../dsl/index.js";
import { coreScenario } from "../../core/setup.js";
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
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  ONE_ICON,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroForm,
  inDiscard,
  inPlayCard,
  onlyDeck,
  piles,
  revealedCodes,
  schemesBy,
  type Seats,
  types,
  without,
} from "../testing.js";
import { GROWING_STRONG, GROWING_STRONG_SKIPPED } from "./growing-strong.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Growing Strong set (52035 Atlas, 52036 Grow Invulnerable, 52037 Growing Strong, 52038 Titanic Proportions),
 * docs/phase7-wave9.md sections 3.35 and 3.52. Rhino (Core, standard: ATK 2 / SCH 1, 0 boost cards flipped by
 * `onlyDeck` blanks) against a Spider-Man starter deck with the set's cards added to the encounter deck by hand. Atlas
 * is ATK 3 / SCH 0 with 18 hit points and 4 boost icons.
 */
const ATLAS = "52035";
const SCHEME = "52036";
const STRONG = "52037";
const TITANIC = "52038";
const SET = [ATLAS, SCHEME, STRONG, TITANIC];
const REFS = [
  "52035.atlas-constant",
  "52035.atlas-forced-response",
  "52036.when-revealed",
  "52036.grow-invulnerable-constant",
  "52037.when-revealed",
  "52037.boost",
  "52038.when-revealed",
  "52038.boost",
];

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, GROWING_STRONG) };

const dataOf = (code: string) =>
  SILK_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

function setupGame(players: Seats = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...SILK_CARDS],
  });
  const cards = SILK_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("growing_strong")),
  );
  const copies = cards.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

/** Every player ends their turn, in seat order, and the villain phase runs on the stacked deck. */
function villainPhase(state: GameState, stack: readonly string[], pick: Picker = firstLegal) {
  return driveEventsPicking(
    DEPS,
    stackEncounterDeck(state, ...stack),
    pick,
    ...state.players.map((p) => endTurn(p.playerId)),
  );
}

const growth = (s: GameState, id: InstanceId) => inst(s, id).counters.growth ?? 0;
const withGrowth = (s: GameState, id: InstanceId, n: number) =>
  patchInstance(s, id, { counters: { ...inst(s, id).counters, growth: n } });
const hp = (s: GameState, id: InstanceId) => maxHitPoints(s, id, DEPS);
const damageTaken = (s: GameState, p = P1) => inst(s, identityOf(s, p)).damage;
const tough = (s: GameState, id: InstanceId) => inst(s, id).statuses.tough;
/** Atlas in play, engaged with `player`, by surgery, with `n` growth counters. */
function atlasIn(state: GameState, n = 0, player = P1) {
  const { state: engaged, id } = engageMinion(state, ATLAS, player);
  return { state: withGrowth(engaged, id, n), id };
}

describe("registry", () => {
  it("registers the eight refs of the four cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(GROWING_STRONG).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(GROWING_STRONG)) expect(validateDefinition(def), id).toEqual([]);
    expect(GROWING_STRONG_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the four cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("setup: all six encounter copies (1 Atlas, 1 Grow Invulnerable, 2 Growing Strong, 2 Titanic Proportions) are in the deck", () => {
    const s = setupGame();
    const counts = SET.map((code) => piles(s).deck.filter((id) => codeOf(s, id) === code).length);
    expect(counts).toEqual([1, 1, 2, 2]);
  });
});

describe("data", () => {
  it("Atlas: an Elite Thunderbolt unique minion, ATK 3, SCH 0, 18 hit points, 4 boost icons, Villainous, Victory 1", () => {
    const card = dataOf(ATLAS);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([
      "minion",
      3,
      0,
      18,
      4,
      true,
    ]);
    expect(card.traits).toEqual(["ELITE", "THUNDERBOLT"]);
    expect(card.keywords).toEqual([{ name: "villainous" }, { name: "victory", value: 1 }]);
  });

  it("Grow Invulnerable: a side scheme with 5 threat regardless of players, a crisis icon, 3 boost icons, no traits", () => {
    const card = dataOf(SCHEME);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons, card.traits, card.keywords]).toEqual([
      "side_scheme",
      { base: 5, perPlayer: 0 },
      ["crisis"],
      3,
      [],
      [],
    ]);
  });

  it("Growing Strong: a treachery with 1 boost icon and a star, two copies; Titanic Proportions likewise", () => {
    for (const code of [STRONG, TITANIC]) {
      const card = dataOf(code);
      expect([card.type, card.boostIcons, card.starIcon, card.quantityInSet, card.traits, card.keywords]).toEqual([
        "treachery",
        1,
        true,
        2,
        [],
        [],
      ]);
    }
  });
});

describe("Atlas (52035)", () => {
  it("CONSTANT: +2 hit points for each growth counter: 18 with none, 20 with one, 28 with five", () => {
    const base = setupGame();
    const results = [0, 1, 5].map((n) => {
      const { state, id } = atlasIn(base, n);
      return hp(state, id);
    });
    expect(results).toEqual([18, 20, 28]);
  });

  it("CONSTANT: the bonus follows the counters as they change (7 counters = 32, back to 2 = 22)", () => {
    const { state, id } = atlasIn(setupGame(), 7);
    expect(hp(state, id)).toBe(32);
    expect(hp(withGrowth(state, id, 2), id)).toBe(22);
  });

  it("FORCED RESPONSE: after the villain phase ends he gets 1 growth counter (0 to 1, 3 to 4)", () => {
    for (const [before, after] of [
      [0, 1],
      [3, 4],
    ] as const) {
      const { state, id } = atlasIn(heroForm(setupGame()), before);
      const run = villainPhase(onlyDeck(state, BLANK, BLANK, FILLER_A, FILLER_B), []);
      expect(growth(run.state, id)).toBe(after);
    }
  });

  it("FORCED RESPONSE: the counter comes after the phase, not before: his attack in the phase is ATK 3 + 0 icons = 3", () => {
    const { state, id } = atlasIn(heroForm(setupGame()), 2);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, FILLER_A), []);
    expect(attacksBy(run.state, run.events, ATLAS)).toMatchObject([{ baseAtk: 3, boostIcons: 0, damageDealt: 3 }]);
    expect(growth(run.state, id)).toBe(3);
  });

  it("FORCED RESPONSE: he gets 1 counter per villain phase, once, in a two-player game too", () => {
    const { state, id } = atlasIn(heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2), 0, P2);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, ONE_ICON, FILLER_A, FILLER_B), []);
    expect(growth(run.state, id)).toBe(1);
  });

  it("villain phase, hero form: he attacks his engaged player for ATK 3 + 1 boost icon = 4 damage", () => {
    const { state } = atlasIn(heroForm(setupGame()));
    const run = villainPhase(onlyDeck(state, BLANK, ONE_ICON, FILLER_A), []);
    expect(attacksBy(run.state, run.events, ATLAS)).toMatchObject([{ baseAtk: 3, boostIcons: 1, damageDealt: 4 }]);
    expect(damageTaken(run.state)).toBeGreaterThanOrEqual(4);
  });

  it("villain phase, alter-ego form: SCH 0 means he schemes for 0 base + 1 boost icon = 1 threat", () => {
    const { state } = atlasIn(setupGame());
    const run = villainPhase(onlyDeck(state, BLANK, ONE_ICON, FILLER_A), []);
    expect(schemesBy(run.state, run.events, ATLAS)).toMatchObject([{ baseSch: 0, boostIcons: 1, threatPlaced: 1 }]);
  });
});

describe("Grow Invulnerable (52036)", () => {
  it("WHEN REVEALED: 5 printed threat plus 1 for each growth counter on Atlas (3 counters = 8)", () => {
    const { state } = atlasIn(setupGame(), 3);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, SCHEME, FILLER_A), []);
    expect(inst(run.state, inPlayCard(run.state, SCHEME)!).threat).toBe(8);
  });

  it("WHEN REVEALED: with Atlas in play and no counters, just the printed 5", () => {
    const { state } = atlasIn(setupGame(), 0);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, SCHEME, FILLER_A), []);
    expect(inst(run.state, inPlayCard(run.state, SCHEME)!).threat).toBe(5);
  });

  it("WHEN REVEALED: with Atlas out of play there is nothing to count: 5", () => {
    const run = villainPhase(onlyDeck(without(setupGame(), ATLAS), BLANK, SCHEME, FILLER_A), []);
    expect(inst(run.state, inPlayCard(run.state, SCHEME)!).threat).toBe(5);
  });

  it("WHEN REVEALED: the starting threat is 5 for two players as well (not per player): 5 + 2 counters = 7", () => {
    const { state } = atlasIn(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), 2);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, FILLER_B, SCHEME, FILLER_A), []);
    expect(inst(run.state, inPlayCard(run.state, SCHEME)!).threat).toBe(7);
  });

  it("CONSTANT: while in play with Atlas at 9 counters the game goes on; the villain phase's own counter (10) loses it", () => {
    const { state: withAtlas, id } = atlasIn(heroForm(setupGame()), 9);
    const { state } = encounterCardInVillainArea(withAtlas, SCHEME, 5);
    expect(state.outcome).toBeNull();
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, FILLER_A), []);
    expect(growth(run.state, id)).toBe(10);
    expect(run.state.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });

  it("CONSTANT: with Atlas at 10 counters and the scheme in play the players lose; at 9 they do not", () => {
    const { state: nine } = atlasIn(heroForm(setupGame()), 9);
    const ok = villainPhase(encounterCardInVillainArea(without(nine, STRONG), SCHEME, 5).state, [BLANK, FILLER_A]);
    // Atlas also attacks and the phase ends: his counter reaches 10 there, so this is the same loss as above.
    expect(ok.state.outcome).toMatchObject({ result: "loss" });
    const { state: eight } = atlasIn(heroForm(setupGame()), 8);
    const fine = villainPhase(encounterCardInVillainArea(without(eight, STRONG), SCHEME, 5).state, [BLANK, FILLER_A]);
    expect(fine.state.outcome).toBeNull();
  });

  it("CONSTANT: revealed while Atlas already holds 10 counters, it loses the game at once", () => {
    const { state } = atlasIn(heroForm(setupGame()), 10);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, SCHEME, FILLER_A), []);
    expect(run.state.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });

  it("CONSTANT: Atlas at 10 counters with no scheme in play loses nothing", () => {
    const { state } = atlasIn(heroForm(setupGame()), 10);
    const run = villainPhase(onlyDeck(without(state, SCHEME), BLANK, BLANK, FILLER_A), []);
    expect(run.state.outcome).toBeNull();
  });

  it("CONSTANT: a scheme in play and Atlas out of play (zero counters) loses nothing", () => {
    const { state } = encounterCardInVillainArea(heroForm(without(setupGame(), ATLAS)), SCHEME, 5);
    const run = villainPhase(onlyDeck(state, BLANK, FILLER_A), []);
    expect(run.state.outcome).toBeNull();
  });
});

describe("Growing Strong (52037)", () => {
  it("WHEN REVEALED (hero): Atlas is found, engages the revealing player and attacks: ATK 3 + 1 icon = 4 damage; no surge", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, STRONG, ATLAS, ONE_ICON), []);
    const atlas = inPlayCard(run.state, ATLAS)!;
    expect(inst(run.state, atlas).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, ATLAS)).toMatchObject([{ baseAtk: 3, boostIcons: 1, damageDealt: 4 }]);
    expect(revealedCodes(run.state, run.events)).toEqual([STRONG, ATLAS]);
    expect(inDiscard(run.state, STRONG)).toHaveLength(1);
  });

  it("WHEN REVEALED (alter-ego): Atlas schemes: SCH 0 + 1 icon = 1 threat", () => {
    const run = villainPhase(onlyDeck(setupGame(), BLANK, STRONG, ATLAS, ONE_ICON), []);
    expect(schemesBy(run.state, run.events, ATLAS)).toMatchObject([{ baseSch: 0, boostIcons: 1, threatPlaced: 1 }]);
  });

  it("WHEN REVEALED: with Atlas already in play engaged with player 2 he engages the revealing player 1 and attacks them", () => {
    const { state: engaged, id } = atlasIn(heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2), 0, P2);
    const run = villainPhase(onlyDeck(engaged, BLANK, BLANK, FILLER_B, STRONG, ONE_ICON, FILLER_A), []);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, ATLAS).length).toBeGreaterThanOrEqual(2);
  });

  it("WHEN REVEALED: with no Atlas anywhere nothing activates and this card gains surge: the next card is revealed", () => {
    const run = villainPhase(onlyDeck(without(setupGame(), ATLAS), BLANK, STRONG, FILLER_A), []);
    expect(inPlayCard(run.state, ATLAS)).toBeUndefined();
    expect(revealedCodes(run.state, run.events)).toEqual([STRONG, FILLER_A]);
  });

  it("BOOST: the activating enemy gets a tough status card (Rhino attacks with Growing Strong boosted: ATK 2 + 1 icon = 3)", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), STRONG, FILLER_A, FILLER_B), []);
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 1, damageDealt: 3 });
    expect(tough(run.state, run.state.villains[0]!.instanceId)).toBe(1);
  });

  it("BOOST: on Atlas's activation he is the one that gets the tough status card, not Rhino", () => {
    const { state, id } = atlasIn(heroForm(setupGame()), 0);
    const run = villainPhase(onlyDeck(state, BLANK, STRONG, FILLER_A, FILLER_B), []);
    expect(tough(run.state, id)).toBe(1);
    expect(tough(run.state, run.state.villains[0]!.instanceId)).toBe(0);
  });
});

describe("Titanic Proportions (52038)", () => {
  /** Indirect damage the revealed Titanic Proportions dealt, per character. */
  const titanicDamage = (state: GameState, events: readonly GameEvent[]) => {
    const revealed = types(events, "encounterCardRevealed").find((e) => codeOf(state, e.instanceId) === TITANIC);
    return types(events, "damageDealt").filter((e) => e.sourceInstanceId === revealed?.instanceId);
  };
  const total = (events: readonly { amount: number }[]) => events.reduce((n, e) => n + e.amount, 0);

  it("WHEN REVEALED: X indirect damage where X is Atlas's growth counters: 4 counters = 4 damage on the hero, no surge", () => {
    const { state } = atlasIn(heroForm(setupGame()), 4);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, TITANIC, FILLER_A), []);
    expect(total(titanicDamage(run.state, run.events))).toBe(4);
    expect(revealedCodes(run.state, run.events)).toEqual([TITANIC]);
  });

  it("WHEN REVEALED: exactly 3 counters is not less than 3: 3 damage and no surge", () => {
    const { state } = atlasIn(heroForm(setupGame()), 3);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, TITANIC, FILLER_A), []);
    expect(total(titanicDamage(run.state, run.events))).toBe(3);
    expect(revealedCodes(run.state, run.events)).toEqual([TITANIC]);
  });

  it("WHEN REVEALED: with 2 counters X is 2 and the card gains surge: 2 damage, the next card is revealed", () => {
    const { state } = atlasIn(heroForm(setupGame()), 2);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, TITANIC, FILLER_A), []);
    expect(total(titanicDamage(run.state, run.events))).toBe(2);
    expect(revealedCodes(run.state, run.events)).toEqual([TITANIC, FILLER_A]);
  });

  it("WHEN REVEALED: with Atlas out of play X is 0: no damage and surge", () => {
    const run = villainPhase(onlyDeck(without(heroForm(setupGame()), ATLAS), BLANK, TITANIC, FILLER_A), []);
    expect(titanicDamage(run.state, run.events)).toEqual([]);
    expect(revealedCodes(run.state, run.events)).toEqual([TITANIC, FILLER_A]);
  });

  it("WHEN REVEALED: the players as a group: with two players the group takes X once, not X each (3 counters, 3 in total)", () => {
    const { state } = atlasIn(heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2), 3, P2);
    const run = villainPhase(onlyDeck(state, BLANK, BLANK, ONE_ICON, TITANIC, FILLER_A, FILLER_B), []);
    expect(total(titanicDamage(run.state, run.events))).toBe(3);
  });

  it("BOOST: with Atlas in play he gets 1 growth counter (+1 more after the phase): 2 becomes 4", () => {
    const { state, id } = atlasIn(heroForm(setupGame()), 2);
    const run = villainPhase(onlyDeck(state, TITANIC, BLANK, FILLER_A, FILLER_B), []);
    // Rhino activates first; Titanic is its boost card (1 icon: ATK 2 + 1 = 3).
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 1, damageDealt: 3 });
    expect(growth(run.state, id)).toBe(4);
  });

  it("BOOST: with Atlas out of play nothing happens and nothing is placed", () => {
    const run = villainPhase(onlyDeck(without(heroForm(setupGame()), ATLAS), TITANIC, FILLER_A, FILLER_B), []);
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 1, damageDealt: 3 });
    expect(inPlayCard(run.state, ATLAS)).toBeUndefined();
  });
});
