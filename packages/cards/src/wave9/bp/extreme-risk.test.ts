import { describe, expect, it, vi } from "vitest";
import { BP_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  createGame,
  handSize,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
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
  use,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { attachToHost, engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
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
import { EXTREME_RISK, EXTREME_RISK_SKIPPED } from "./extreme-risk.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Extreme Risk set (51039 Joystick, 51040 Energy Truncheon, 51041 Playing for Keeps, 51042 Extreme Risk),
 * docs/phase7-wave9.md sections 3.49 and 3.52. Rhino (Core, standard) against a Spider-Man starter deck with the set's
 * cards added to the encounter deck by hand. Core's Rhino is ATK 2 / SCH 1; Joystick is ATK 1 / SCH 1 with 4 boost
 * icons. The pack's own `BP_CARDS` are the pool; the set is not tied to Black Panther.
 */
const JOYSTICK = "51039";
const TRUNCHEON = "51040";
const KEEPS = "51041";
const RISK = "51042";
const SET = [JOYSTICK, TRUNCHEON, KEEPS, RISK];
const REFS = [
  "51039.joystick-forced-interrupt",
  "51040.energy-truncheon-constant",
  "51040.energy-truncheon-action",
  "51041.playing-for-keeps-constant",
  "51041.playing-for-keeps-forced-interrupt",
  "51042.when-revealed",
  "51042.boost",
];
/** Core Charge: a Rhino attachment with 2 boost icons and no Boost ability (BLANK has 0, ONE_ICON 1). */
const TWO_ICON = "01099";

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, EXTREME_RISK) };

const dataOf = (code: string) => BP_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

function setupGame(players: Seats = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...BP_CARDS],
  });
  const cards = BP_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("extreme_risk")),
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

/** Answers a choice with the option whose label starts with `label`. */
const labeled =
  (label: string): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    const option = choice.options.find((o) => o.label.startsWith(label));
    return option ? [option.optionId] : firstLegal(s);
  };

const draws = (events: readonly GameEvent[], player: PlayerId) =>
  types(events, "cardDrawn").filter((e) => e.playerId === player).length;
const handOf = (s: GameState, player = P1) => s.players.find((p) => p.playerId === player)!.hand.length;
const tough = (s: GameState, id: InstanceId) => inst(s, id).statuses.tough;

describe("registry", () => {
  it("registers the seven refs of the four cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(EXTREME_RISK).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(EXTREME_RISK)) expect(validateDefinition(def), id).toEqual([]);
    expect(EXTREME_RISK_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the four cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("setup: all six encounter copies (1 Joystick, 2 Energy Truncheon, 1 Playing for Keeps, 2 Extreme Risk) are in the deck", () => {
    const s = setupGame();
    const counts = SET.map((code) => piles(s).deck.filter((id) => codeOf(s, id) === code).length);
    expect(counts).toEqual([1, 2, 1, 2]);
  });
});

describe("Joystick (51039)", () => {
  it("is data: an Elite Thunderbolt unique minion, ATK 1, SCH 1, 17 hit points, 4 boost icons, Villainous, Victory 1", () => {
    const card = dataOf(JOYSTICK);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([1, 1, 17, 4, true]);
    expect(card.traits).toEqual(["ELITE", "THUNDERBOLT"]);
    expect(card.keywords).toEqual([{ name: "villainous" }, { name: "victory", value: 1 }]);
  });

  it("FORCED INTERRUPT, first option: her scheme gets 1 additional boost card (two flipped: 1 + 2 icons, SCH 1 + 3 = 4 threat) and you draw 1 card", () => {
    const { state: engaged, id } = engageMinion(setupGame(), JOYSTICK, P1);
    const staged = onlyDeck(engaged, BLANK, ONE_ICON, TWO_ICON, FILLER_A, FILLER_B);
    const hand = handOf(staged);
    const run = villainPhase(staged, [], labeled("Give her 1 additional boost card"));
    expect(schemesBy(run.state, run.events, JOYSTICK)).toMatchObject([{ baseSch: 1, boostIcons: 3, threatPlaced: 4 }]);
    expect(tough(run.state, id)).toBe(0);
    expect(handOf(run.state)).toBe(hand + 1);
  });

  it("FORCED INTERRUPT, second option: she gets a tough status card, no additional boost (1 icon, SCH 1 + 1 = 2 threat) and you draw nothing", () => {
    const { state: engaged, id } = engageMinion(setupGame(), JOYSTICK, P1);
    const staged = onlyDeck(engaged, BLANK, ONE_ICON, TWO_ICON, FILLER_A, FILLER_B);
    const hand = handOf(staged);
    const run = villainPhase(staged, [], labeled("Give her a tough"));
    expect(schemesBy(run.state, run.events, JOYSTICK)).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
    expect(tough(run.state, id)).toBe(1);
    expect(handOf(run.state)).toBe(hand);
  });

  it("FORCED INTERRUPT: against a hero her attack gets the additional boost card too (ATK 1 + 1 + 2 icons = 4 damage)", () => {
    const { state: engaged } = engageMinion(heroForm(setupGame()), JOYSTICK, P1);
    const staged = onlyDeck(engaged, BLANK, ONE_ICON, TWO_ICON, FILLER_A, FILLER_B);
    const run = villainPhase(staged, [], labeled("Give her 1 additional boost card"));
    expect(attacksBy(run.state, run.events, JOYSTICK)).toMatchObject([{ baseAtk: 1, boostIcons: 3, damageDealt: 4 }]);
  });

  it("FORCED INTERRUPT: only her own activation asks: with her out of play Rhino's scheme gets its one boost card (1 icon, SCH 1 + 1) and nothing is drawn", () => {
    const staged = onlyDeck(without(setupGame(), JOYSTICK), ONE_ICON, FILLER_A, FILLER_B);
    const hand = handOf(staged);
    const run = villainPhase(staged, [], labeled("Give her 1 additional boost card"));
    expect(schemesBy(run.state, run.events, "01094")).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
    expect(handOf(run.state)).toBe(hand);
  });

  it("FORCED INTERRUPT: engaged with player 2 she activates against player 2, who decides and draws the card", () => {
    const state = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const { state: engaged } = engageMinion(state, JOYSTICK, P2);
    const staged = onlyDeck(engaged, BLANK, BLANK, ONE_ICON, TWO_ICON, FILLER_A, FILLER_B);
    const drawn = (pick: Picker) => {
      const run = villainPhase(staged, [], pick);
      return { run, p1: draws(run.events, P1), p2: draws(run.events, P2) };
    };
    const accepted = drawn(labeled("Give her 1 additional boost card"));
    const declined = drawn(labeled("Give her a tough"));
    expect([accepted.p1 - declined.p1, accepted.p2 - declined.p2]).toEqual([0, 1]);
    expect(attacksBy(accepted.run.state, accepted.run.events, JOYSTICK)).toMatchObject([
      { boostIcons: 3, damageDealt: 4 },
    ]);
  });
});

describe("Energy Truncheon (51040)", () => {
  it("is data: a Tech Weapon attachment with +1 ATK, 2 boost icons, attaching to Joystick, otherwise the villain", () => {
    const card = dataOf(TRUNCHEON);
    expect([card.type, card.boostIcons, card.quantityInSet, card.traits, card.statModifiers]).toEqual([
      "attachment",
      2,
      2,
      ["TECH", "WEAPON"],
      { atk: 1 },
    ]);
    expect(card.attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "Joystick" },
      otherwise: { kind: "villain" },
    });
  });

  it("CONSTANT: the attached enemy's attacks gain piercing: a hero's tough status card is removed and the attack's 3 damage (ATK 2 + 1) is dealt", () => {
    const base = heroForm(setupGame());
    const rhino = base.villains[0]!.instanceId;
    const hero = identityOf(base);
    const tougher = patchInstance(base, hero, { statuses: { ...inst(base, hero).statuses, tough: 1 } });
    const { state } = attachToHost(onlyDeck(tougher, TRUNCHEON, BLANK, FILLER_A), TRUNCHEON, rhino);
    const run = villainPhase(state, []);
    expect(attacksBy(run.state, run.events, "01094")).toMatchObject([{ baseAtk: 3, boostIcons: 0 }]);
    expect(tough(run.state, hero)).toBe(0);
    expect(inst(run.state, hero).damage).toBe(3);
  });

  it("CONSTANT: without the card the same attack (ATK 2) is absorbed by the tough status card: no damage", () => {
    const base = heroForm(setupGame());
    const hero = identityOf(base);
    const tougher = patchInstance(base, hero, { statuses: { ...inst(base, hero).statuses, tough: 1 } });
    const run = villainPhase(onlyDeck(tougher, BLANK, FILLER_A), []);
    expect(tough(run.state, hero)).toBe(0);
    expect(inst(run.state, hero).damage).toBe(0);
  });

  it("HERO ACTION: the attached enemy attacks you (Rhino ATK 2 + 1 from the card + 0 icons = 3), then the card is discarded and you draw 1 card", () => {
    const base = heroForm(setupGame());
    const rhino = base.villains[0]!.instanceId;
    const attached = attachToHost(onlyDeck(base, TRUNCHEON, BLANK, FILLER_A, FILLER_B), TRUNCHEON, rhino);
    const run = driveEventsPicking(
      DEPS,
      attached.state,
      firstLegal,
      use(P1, attached.id, "51040.energy-truncheon-action"),
    );
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ baseAtk: 3, damageDealt: 3 });
    expect(inDiscard(run.state, TRUNCHEON)).toContain(attached.id);
    expect(inst(run.state, rhino).attachments).toEqual([]);
    expect(draws(run.events, P1)).toBe(1);
  });

  it("HERO ACTION: on Joystick (not the villain) she attacks you: ATK 1 + 1 = 2", () => {
    const { state: engaged, id: joystick } = engageMinion(heroForm(setupGame()), JOYSTICK, P1);
    const attached = attachToHost(onlyDeck(engaged, TRUNCHEON, BLANK, FILLER_A, FILLER_B), TRUNCHEON, joystick);
    const run = driveEventsPicking(
      DEPS,
      attached.state,
      labeled("Give her a tough"),
      use(P1, attached.id, "51040.energy-truncheon-action"),
    );
    expect(attacksBy(run.state, run.events, JOYSTICK)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(inDiscard(run.state, TRUNCHEON)).toContain(attached.id);
  });
});

describe("Playing for Keeps (51041)", () => {
  it("is data: a side scheme with 3 threat per hero, 2 boost icons", () => {
    const card = dataOf(KEEPS);
    expect([card.type, card.startingThreat, card.boostIcons]).toEqual(["side_scheme", { base: 0, perPlayer: 3 }, 2]);
  });

  it("CONSTANT: each identity gets +1 hand size, in a two-player game both", () => {
    const solo = setupGame();
    const duo = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const before = [handSize(solo, P1, DEPS), handSize(duo, P1, DEPS), handSize(duo, P2, DEPS)];
    const run = villainPhase(solo, [BLANK, KEEPS, FILLER_A]);
    const runDuo = villainPhase(duo, [BLANK, BLANK, KEEPS, FILLER_A, FILLER_B]);
    expect(inPlayCard(run.state, KEEPS)).toBeDefined();
    expect([handSize(run.state, P1, DEPS), handSize(runDuo.state, P1, DEPS), handSize(runDuo.state, P2, DEPS)]).toEqual(
      before.map((n) => n + 1),
    );
  });

  it("CONSTANT: it enters with 3 threat for one hero and 6 for two", () => {
    const run = villainPhase(setupGame(), [BLANK, KEEPS, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, KEEPS)!).threat).toBe(3);
    const duo = villainPhase(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), [BLANK, BLANK, KEEPS, FILLER_A, FILLER_B]);
    expect(inst(duo.state, inPlayCard(duo.state, KEEPS)!).threat).toBe(6);
  });

  it("FORCED INTERRUPT: every enemy's activation gets 1 additional boost card: Rhino's scheme flips two (1 + 2 icons), SCH 1 + 3", () => {
    const { state } = encounterCardInVillainArea(setupGame(), KEEPS, 3);
    const staged = onlyDeck(state, ONE_ICON, TWO_ICON, FILLER_A, FILLER_B);
    const run = villainPhase(staged, []);
    expect(schemesBy(run.state, run.events, "01094")).toMatchObject([{ baseSch: 1, boostIcons: 3, threatPlaced: 4 }]);
  });

  it("FORCED INTERRUPT: a minion's activation too, and one that already gets an additional boost gets both (Joystick: 3 boost cards)", () => {
    const { state: engaged } = engageMinion(heroForm(setupGame()), JOYSTICK, P1);
    const staged = onlyDeck(
      encounterCardInVillainArea(engaged, KEEPS, 3).state,
      BLANK,
      BLANK,
      ONE_ICON,
      TWO_ICON,
      FILLER_A,
      FILLER_B,
    );
    const run = villainPhase(staged, [], labeled("Give her 1 additional boost card"));
    // Rhino: 2 boosts (blank, blank); Joystick: 1 + 1 (Keeps) + 1 (her own) = 3 boosts, 0 + 1 + 2 icons.
    expect(attacksBy(run.state, run.events, JOYSTICK)).toMatchObject([{ baseAtk: 1, boostIcons: 3, damageDealt: 4 }]);
  });
});

describe("Extreme Risk (51042)", () => {
  it("is data: a treachery with 2 boost icons and a star, two copies", () => {
    const card = dataOf(RISK);
    expect([card.type, card.boostIcons, card.starIcon, card.quantityInSet]).toEqual(["treachery", 2, true, 2]);
  });

  it("WHEN REVEALED (hero): Joystick is found, engages the revealing player and attacks: ATK 1 + 1 icon = 2 damage; no surge", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, RISK, JOYSTICK, ONE_ICON), []);
    const joystick = inPlayCard(run.state, JOYSTICK)!;
    expect(inst(run.state, joystick).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, JOYSTICK)).toMatchObject([{ baseAtk: 1, boostIcons: 1, damageDealt: 2 }]);
    expect(revealedCodes(run.state, run.events)).toEqual([RISK, JOYSTICK]);
    expect(inDiscard(run.state, RISK)).toHaveLength(1);
  });

  it("WHEN REVEALED (alter-ego): Joystick schemes: SCH 1 + 1 icon = 2 threat", () => {
    const run = villainPhase(onlyDeck(setupGame(), BLANK, RISK, JOYSTICK, ONE_ICON), []);
    expect(schemesBy(run.state, run.events, JOYSTICK)).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
  });

  it("WHEN REVEALED: with Joystick already in play (engaged with player 2) she engages the revealing player 1 and attacks them: 1 + 2 icons = 3 damage (after her own 2 against player 2)", () => {
    const { state: engaged, id } = engageMinion(
      heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2),
      JOYSTICK,
      P2,
    );
    const run = villainPhase(
      onlyDeck(engaged, BLANK, BLANK, ONE_ICON, RISK, FILLER_B, TWO_ICON),
      [],
      labeled("Give her a tough"),
    );
    expect(attacksBy(run.state, run.events, JOYSTICK).map((a) => a.damageDealt)).toEqual([2, 3]);
    expect(inst(run.state, id).engagedWith).toBe(P1);
  });

  it("WHEN REVEALED: with no Joystick anywhere nothing activates and this card gains surge: the next card is revealed", () => {
    const run = villainPhase(onlyDeck(without(setupGame(), JOYSTICK), BLANK, RISK, FILLER_A), []);
    expect(inPlayCard(run.state, JOYSTICK)).toBeUndefined();
    expect(revealedCodes(run.state, run.events)).toEqual([RISK, FILLER_A]);
  });

  it("BOOST, accepted: the activating enemy gets an additional boost card and you draw 1 (Rhino: Extreme Risk's 2 icons + 1 icon, ATK 2 + 3 = 5)", () => {
    const run = villainPhase(
      onlyDeck(heroForm(setupGame()), RISK, ONE_ICON, FILLER_A, FILLER_B),
      [],
      labeled("Give the activating enemy"),
    );
    const declined = villainPhase(
      onlyDeck(heroForm(setupGame()), RISK, ONE_ICON, FILLER_A, FILLER_B),
      [],
      labeled("Do not give"),
    );
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 3, damageDealt: 5 });
    expect(draws(run.events, P1) - draws(declined.events, P1)).toBe(1);
  });

  it("BOOST, declined: no additional boost card and nothing drawn (Rhino ATK 2 + 2 icons = 4)", () => {
    const run = villainPhase(
      onlyDeck(heroForm(setupGame()), RISK, ONE_ICON, FILLER_A, FILLER_B),
      [],
      labeled("Do not give"),
    );
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 2, damageDealt: 4 });
    expect(draws(run.events, P1)).toBe(
      draws(villainPhase(onlyDeck(heroForm(setupGame()), BLANK, FILLER_A, FILLER_B), []).events, P1),
    );
  });
});
