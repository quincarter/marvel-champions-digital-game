import {
  createGame,
  hasKeyword,
  keywordTotal,
  mainSchemeValue,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { competitiveOnlyTexts, validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  inst,
  mainThreat,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import {
  codeOf,
  inDiscardPile,
  inPlayCard,
  onlyDeck,
  piles,
  stunWith,
  types,
  without,
} from "../../../wave9/testing.js";
import { wave10Scenario } from "../../setup.js";
import {
  SPIDER_WOMAN_SCENARIO,
  WAVE10_DEPS,
  civilWarGame,
  civilWarSetup,
  engageMinion,
  type CivilWarGameOptions,
} from "../../testing.js";
import { MAIN_SCHEMES_RESISTANCE, MAIN_SCHEMES_RESISTANCE_SKIPPED } from "./resistance.js";

vi.setConfig({ testTimeout: 240_000 });

/**
 * The Civil War resistance main scheme (56141a to 56202b, docs/phase7-wave10.md sections 1.2, 2.6, 7.6; MC56 pp. 4-5):
 * one card of eight stages, a scenario choosing one stage 1 and one stage 2 by the id of their B faces. Every test
 * plays the real `resistance-spider-woman` scenario (`civilWarGame`: the Tigra starter deck, with `twoPlayers` the Core
 * Spider-Man deck beside it, seed 1, cooperative mode) through real commands. Only the encounter deck's order and
 * contents (`stackEncounterDeck`, `onlyDeck`) and a threat count are surgery. Spider-Woman's and the modular sets'
 * scripts are in the registry; nothing here depends on them beyond the cards named.
 *
 * The villain phase, with both heroes in hero form, is: step 1 (the main scheme's threat: 1 per player for the stage's
 * escalation, plus 1 for Self-propelled Glide's acceleration icon, 3 with two players); each villain activation
 * draws its boost card; then each player is dealt a card. Spider-Woman I attacks (ATK 2) a hero in hero form.
 */
const REFS = [
  "56141a.setup",
  "56141b.gathering-support-constant",
  "56141b.when-revealed",
  "56142b.secret-avengers-constant",
  "56172a.setup",
  "56172b.open-rebellion-constant",
  "56172b.open-rebellion-forced-interrupt",
  "56173b.when-revealed",
  "56199a.setup",
  "56199b.rallying-call-constant",
  "56199b.rallying-call-constant-2",
  "56200a.setup",
  "56200b.going-underground-constant",
  "56200b.going-underground-constant-2",
  "56201b.guerilla-warfare-forced-response",
  "56202b.superhero-jailbreak-forced-response",
];
/** The four stage 1 B faces with their index among the card's eight stages. */
const STAGE_1S = [
  ["56141b", 0],
  ["56172b", 2],
  ["56199b", 4],
  ["56200b", 5],
] as const;
/** Each stage 1 with a stage 2. The ready-made pair of the Spider-Woman scenario is the second, the others are custom. */
const PAIRS = [
  ["56141b", "56142b"],
  ["56172b", "56173b"],
  ["56199b", "56201b"],
  ["56200b", "56202b"],
] as const;
const STAGE_2_INDEX: Readonly<Record<string, number>> = { "56142b": 1, "56173b": 3, "56201b": 6, "56202b": 7 };

const GLIDE = "56179";
const ASSAULT = "01187"; // alter-ego: this card gains surge. Hero: the villain attacks you.
const ADVANCE = "01186"; // boost 0
const CAUGHT_OFF_GUARD = "01188"; // boost 1
const GANG_UP = "01189"; // boost 1
const PHEROMONES = "56176";
const NEIGHBORHOOD_HERO = "56183"; // side scheme
const DEFENDERS = "56188"; // side scheme
const HELLS_KITCHEN = "56193"; // side scheme
const CLOAK_AND_DAGGER = "56198"; // side scheme
const SPIDER_MAN_MINION = "56180"; // minion, no guard of its own
const CONTAMINANT = "56175"; // attachment on the villain
const TANGLED_UP = "56181"; // attachment
const INCONSPICUOUS = "56178"; // treachery

const deps = WAVE10_DEPS;
const SETUP_SENTENCE =
  "In competitive mode, the enemy team finds the Choosing Sides side scheme and your team reveals it.";

type Pair = readonly [string, string];
const opts = (pair: Pair, more: CivilWarGameOptions = {}): CivilWarGameOptions => ({
  twoPlayers: true,
  ...more,
  mainSchemeStageIds: [pair[0], pair[1]] as never,
});
const open = (pair: Pair, more: CivilWarGameOptions = {}): GameState =>
  civilWarGame(SPIDER_WOMAN_SCENARIO, opts(pair, more));

type Driven = { readonly state: GameState; readonly events: readonly GameEvent[] };
const drive = (state: GameState, pick: Picker, ...commands: Parameters<typeof driveEventsPicking>[3][]): Driven =>
  driveEventsPicking(deps, state, pick, ...commands);

const scheme = (s: GameState): InstanceId => s.mainScheme.instanceId;
const villain = (s: GameState): InstanceId => s.activeVillainId!;
const target = (s: GameState): number => mainSchemeValue(s, "targetThreat", deps);
const hinder = (s: GameState): number => keywordTotal(s, scheme(s), "hinder", deps);
const heroes = (s: GameState): GameState => withForm(withForm(s, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
const alterEgos = (s: GameState): GameState => withForm(withForm(s, "alterEgo", P1), "alterEgo", P2);
const identityOf = (s: GameState, p: PlayerId): InstanceId =>
  s.players.find((x) => x.playerId === p)!.identity.instanceId;
const revealed = (s: GameState, events: readonly GameEvent[]) =>
  types(events, "encounterCardRevealed").map((e) => [codeOf(s, e.instanceId), e.playerId]);
const placedByStage = (s: GameState, events: readonly GameEvent[]): number[] =>
  types(events, "threatPlaced")
    .filter((e) => e.sourceInstanceId === scheme(s))
    .map((e) => e.amount);

/** The players in turn order (the first player changes each round). */
const turnOrder = (s: GameState): PlayerId[] => {
  const step = s.step as unknown as { activePlayerId: PlayerId; remainingPlayerIds: PlayerId[] };
  return [step.activePlayerId, ...step.remainingPlayerIds];
};

/** Both players end their turn: the villain phase with the encounter deck's top cards as given, then the next round. */
const villainPhase = (s: GameState, pick: Picker, ...top: string[]): Driven =>
  drive(top.length > 0 ? stackEncounterDeck(s, ...top) : s, pick, ...turnOrder(s).map((p) => endTurn(p)));

/** Stage 1 to stage 2: threat 3 short of the target with two players, then a villain phase with harmless cards on top. */
function advanced(s: GameState, ...top: string[]): Driven {
  const ready = patchInstance(heroes(s), scheme(s), { threat: target(s) - 3 });
  return villainPhase(
    ready,
    firstLegal,
    ...(top.length > 0 ? top : [CAUGHT_OFF_GUARD, GANG_UP, NEIGHBORHOOD_HERO, CLOAK_AND_DAGGER]),
  );
}

describe("the resistance main scheme: registry", () => {
  it("scripts every ref the data names, none skipped, each valid", () => {
    expect(Object.keys(MAIN_SCHEMES_RESISTANCE).sort()).toEqual([...REFS].sort());
    expect(MAIN_SCHEMES_RESISTANCE_SKIPPED).toEqual({});
    for (const ref of REFS) {
      const definition = MAIN_SCHEMES_RESISTANCE[ref]!;
      expect(validateDefinition(definition), ref).toEqual([]);
      expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
    }
  });

  it("each 1A Setup scripts the printed competitive sentence, with no marker left (competitive plan M1)", () => {
    for (const ref of REFS.filter((r) => r.endsWith("a.setup"))) {
      expect(competitiveOnlyTexts(MAIN_SCHEMES_RESISTANCE[ref]!), `${ref}: ${SETUP_SENTENCE}`).toEqual([]);
      expect(JSON.stringify(MAIN_SCHEMES_RESISTANCE[ref]), ref).toContain('"names":["Choosing Sides"]');
    }
  });
});

describe("1A Setup in a cooperative game: the chosen leader's side scheme is found and revealed", () => {
  it.each(STAGE_1S)("stage 1 %s: Self-propelled Glide is in play with 6 threat, none left in the deck", (s1, index) => {
    const s = open([s1, "56173b"]);
    expect(s.mainScheme.stageIndex).toBe(index);
    const glide = inPlayCard(s, GLIDE)!;
    expect(glide).toBeDefined();
    expect(inst(s, glide).threat).toBe(6);
    expect([...piles(s).deck, ...piles(s).discard].filter((i) => codeOf(s, i) === GLIDE)).toEqual([]);
    expect(s.step.phase).toBe("player");
  });
});

/** Four starter decks for the four-player game. */
const SEATS = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
  { starterDeckId: "core-she-hulk-aggression" },
  { starterDeckId: "core-iron-man-aggression" },
] as const;
function fourPlayers(s1: string): GameState {
  const config = wave10Scenario(SPIDER_WOMAN_SCENARIO, {
    players: SEATS,
    seed: 3,
    mainSchemeStageIds: [s1, "56173b"] as never,
  });
  const created = createGame(config, deps);
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", deps);
}

describe("stage 1 B sides: 'If there is more than 1 player on your team, this stage gains hinder 2[per_hero]'", () => {
  it.each(STAGE_1S)("%s opens with 0 threat and target 7 for one player, no hinder", (s1) => {
    const s = civilWarGame(SPIDER_WOMAN_SCENARIO, { mainSchemeStageIds: [s1, "56173b"] as never });
    expect(hinder(s)).toBe(0);
    expect(mainThreat(s)).toBe(0);
    expect(target(s)).toBe(7);
  });

  it.each(STAGE_1S)("%s opens with 4 threat and target 14 for two players", (s1) => {
    const s = open([s1, "56173b"]);
    expect(hinder(s)).toBe(4);
    expect(mainThreat(s)).toBe(4);
    expect(target(s)).toBe(14);
  });

  it.each(STAGE_1S)("%s opens with 8 threat and target 28 for four players", (s1) => {
    const s = fourPlayers(s1);
    expect(hinder(s)).toBe(8);
    expect(mainThreat(s)).toBe(8);
    expect(target(s)).toBe(28);
  });

  it.each(PAIRS)("%s completes at the exact threshold and the chosen stage 2 follows (%s)", (s1, s2) => {
    const s = heroes(open([s1, s2]));
    const goal = target(s);
    const filler = [CAUGHT_OFF_GUARD, GANG_UP, NEIGHBORHOOD_HERO, CLOAK_AND_DAGGER];
    // One short of the target after the 3 threat of step 1: not completed.
    const below = villainPhase(patchInstance(s, scheme(s), { threat: goal - 4 }), firstLegal, ...filler);
    expect(below.state.mainScheme.stageIndex).toBe(STAGE_1S.find((x) => x[0] === s1)![1]);
    expect(types(below.events, "mainSchemeCompleted")).toEqual([]);
    // Exactly the target: completed, and stage 2 is the one chosen, at target 18.
    const exact = advanced(open([s1, s2]));
    expect(types(exact.events, "mainSchemeCompleted")).toHaveLength(1);
    expect(types(exact.events, "mainSchemeAdvanced").map((e) => e.stageIndex)).toEqual([STAGE_2_INDEX[s2]]);
    expect(exact.state.mainScheme.stageIndex).toBe(STAGE_2_INDEX[s2]);
    expect(target(exact.state)).toBe(18);
    expect(hinder(exact.state)).toBe(0);
    expect(exact.state.outcome).toBeNull();
  });
});

describe("Gathering Support 56141b: the enemy team deals one minion from the deck to each player on your team", () => {
  it("with the second seat as first player, they pick both minions and the player they are dealt to is not the chooser for the second", () => {
    const asked: { readonly chooser: string; readonly authority: string; readonly labels: readonly string[] }[] = [];
    const wanted = ["Luke Cage", "Daredevil"];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind !== "chooseCards") return firstLegal(s);
      asked.push({
        chooser: choice.playerId,
        authority: (choice as unknown as { authority: string }).authority,
        labels: choice.options.map((o) => o.label),
      });
      const label = wanted[asked.length - 1]!;
      return [choice.options.find((o) => o.label === label)!.optionId];
    };
    const s = settle(
      civilWarSetup(SPIDER_WOMAN_SCENARIO, opts(["56141b", "56142b"], { firstPlayerIndex: 1 })),
      pick,
      (x) => x.step.phase === "player",
      deps,
    );
    expect(asked.map((a) => [a.chooser, a.authority])).toEqual([
      ["p2", "enemyTeam"],
      ["p2", "enemyTeam"],
    ]);
    // Seven minions are offered the first time, and the one dealt is no longer offered to the next player.
    expect(asked[0]!.labels).toHaveLength(7);
    expect(asked[1]!.labels).toHaveLength(6);
    expect(asked[1]!.labels).not.toContain("Luke Cage");
    const dealt = (p: PlayerId) => playerOf(s, p).dealtEncounter.map((i) => codeOf(s, i));
    expect(dealt(P2)).toEqual(["56184"]);
    expect(dealt(P1)).toEqual(["56189"]);
    // The stage 1 hinder (4 for two players) is on the scheme, and the deck was searched, not just drawn from.
    expect(mainThreat(s)).toBe(4);
    const other = open(["56172b", "56173b"], { firstPlayerIndex: 1 });
    expect(piles(s).deck.length).toBe(piles(other).deck.length - 2);
  });

  it("one player: one minion is dealt, and the stage has no hinder", () => {
    const s = civilWarGame(SPIDER_WOMAN_SCENARIO, { mainSchemeStageIds: ["56141b", "56142b"] });
    expect(playerOf(s, P1).dealtEncounter).toHaveLength(1);
    expect(types([], "encounterCardRevealed")).toEqual([]);
    expect(mainThreat(s)).toBe(0);
  });
});

describe("Open Rebellion 56172b: 'when a player reveals a treachery, place 1 threat here (limit once per phase per player)'", () => {
  it("one threat for a player who reveals two treacheries in the villain phase, one more for the other player's", () => {
    const s = alterEgos(open(["56172b", "56173b"]));
    // Two boost cards (the villain schemes against each player), then each player is dealt Assault, which gains surge in alter-ego form: the first
    // player's surge reveals Pheromones (two treacheries), the second's a side scheme (one).
    const r = villainPhase(s, firstLegal, CAUGHT_OFF_GUARD, GANG_UP, ASSAULT, ASSAULT, PHEROMONES, NEIGHBORHOOD_HERO);
    expect(revealed(r.state, r.events).slice(0, 4)).toEqual([
      [ASSAULT, "p1"],
      [PHEROMONES, "p1"],
      [ASSAULT, "p2"],
      [NEIGHBORHOOD_HERO, "p2"],
    ]);
    expect(
      types(r.events, "abilityResolved").filter((e) => e.abilityId === "56172b.open-rebellion-forced-interrupt"),
    ).toHaveLength(2);
    expect(placedByStage(r.state, r.events)).toEqual([1, 1]);
    // The count started again with the next phase: the player phase has none left.
    expect(r.state.step.phase).toBe("player");
    expect(Object.keys(r.state.abilityUses).filter((k) => k.includes("56172b.open-rebellion"))).toEqual([]);
  });

  it("a card that is not a treachery places nothing", () => {
    const s = alterEgos(open(["56172b", "56173b"]));
    const r = villainPhase(s, firstLegal, CAUGHT_OFF_GUARD, GANG_UP, NEIGHBORHOOD_HERO, CLOAK_AND_DAGGER);
    expect(revealed(r.state, r.events).slice(0, 2)).toEqual([
      [NEIGHBORHOOD_HERO, "p1"],
      [CLOAK_AND_DAGGER, "p2"],
    ]);
    expect(placedByStage(r.state, r.events)).toEqual([]);
  });
});

describe("Rallying Call 56199b: each minion gains guard", () => {
  it("a minion in play has guard, and does not under another stage 1", () => {
    const rallying = engageMinion(open(["56199b", "56201b"]), SPIDER_MAN_MINION, "m1", P1);
    expect(hasKeyword(rallying, "m1" as InstanceId, "guard", deps)).toBe(true);
    const underground = engageMinion(open(["56200b", "56201b"]), SPIDER_MAN_MINION, "m1", P1);
    expect(hasKeyword(underground, "m1" as InstanceId, "guard", deps)).toBe(false);
    expect(hasKeyword(rallying, villain(rallying), "guard", deps)).toBe(false);
  });
});

describe("Going Underground 56200b: the enemy leader gains steady", () => {
  it("the villain has steady, a minion does not, and no other stage 1 gives it", () => {
    const underground = engageMinion(open(["56200b", "56201b"]), SPIDER_MAN_MINION, "m1", P1);
    expect(hasKeyword(underground, villain(underground), "steady", deps)).toBe(true);
    expect(hasKeyword(underground, "m1" as InstanceId, "steady", deps)).toBe(false);
    const rebellion = open(["56172b", "56173b"]);
    expect(hasKeyword(rebellion, villain(rebellion), "steady", deps)).toBe(false);
  });
});

/** Player 2 defends with their hero; any other defender prompt is declined. */
const p2Defends: Picker = (s) => {
  const choice = s.pendingChoice!;
  if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
  const mine = choice.options.find((o) => o.optionId === identityOf(s, P2));
  return choice.playerId === P2 && mine ? [mine.optionId] : ["decline"];
};

describe("Secret Avengers 56142b: the enemy leader gets +1 ATK while attacking (+2 instead if the attack is undefended)", () => {
  it("Spider-Woman's attack is 2 + 2 against a player who does not defend and 2 + 1 against one who does", () => {
    const stage2 = advanced(open(["56172b", "56142b"])).state;
    expect(stage2.mainScheme.stageIndex).toBe(1);
    expect(stage2.round).toBeGreaterThan(1);
    const r = villainPhase(stage2, p2Defends, ADVANCE, ADVANCE, DEFENDERS, HELLS_KITCHEN);
    const attacks = types(r.events, "attackResolved").filter((a) => codeOf(r.state, a.enemyInstanceId) === "56168");
    const against = (p: PlayerId) => attacks.find((a) => a.targetInstanceId === identityOf(stage2, p));
    // The side scheme dealt to finish the stage 1 round, Neighborhood Hero, has the amplify icon: 1 boost icon each.
    expect(against(P1)).toMatchObject({ baseAtk: 4, boostIcons: 1, defenseReduction: 0, damageDealt: 5 });
    expect(against(P2)).toMatchObject({ baseAtk: 3, boostIcons: 1, defenseReduction: 3, damageDealt: 1 });
  });

  it("without the stage (stage 1, and Guerilla Warfare as stage 2) the attack is 2", () => {
    const one = villainPhase(
      heroes(open(["56172b", "56142b"])),
      firstLegal,
      ADVANCE,
      ADVANCE,
      DEFENDERS,
      HELLS_KITCHEN,
    );
    expect(types(one.events, "attackResolved").map((a) => a.baseAtk)).toEqual([2, 2]);
    const stage2 = advanced(open(["56172b", "56201b"])).state;
    const r = villainPhase(stage2, firstLegal, ADVANCE, ADVANCE, DEFENDERS, HELLS_KITCHEN);
    const attacks = types(r.events, "attackResolved").filter((a) => codeOf(r.state, a.enemyInstanceId) === "56168");
    expect(attacks.map((a) => a.baseAtk)).toEqual([2, 2]);
  });
});

describe("Neighborhood Protectors 56173b: the enemy team deals one side scheme from the deck and discard pile to each player", () => {
  it("both side schemes left are offered (one from the discard pile), one is dealt to each player, and both come into play", () => {
    // Only Neighborhood Hero (deck) and The Defenders (discard pile) are left to find.
    let s = heroes(open(["56172b", "56173b"]));
    s = inDiscardPile(without(without(s, HELLS_KITCHEN), CLOAK_AND_DAGGER), DEFENDERS);
    expect(piles(s).discard.map((i) => codeOf(s, i))).toEqual([DEFENDERS]);
    const asked: string[][] = [];
    const wanted = ["The Defenders", "Neighborhood Hero"];
    const pick: Picker = (x) => {
      const choice = x.pendingChoice!;
      if (choice.prompt.kind !== "chooseCards") return firstLegal(x);
      asked.push(choice.options.map((o) => o.label).sort());
      return [choice.options.find((o) => o.label === wanted[asked.length - 1])!.optionId];
    };
    const r = villainPhase(patchInstance(s, scheme(s), { threat: target(s) - 3 }), pick);
    // The first search finds two and the first player picks for the enemy team; the second finds the one left, which
    // is no choice, so nobody is asked (RRG 1.8 "Search", p. 39: a player chooses among multiple finds).
    expect(asked).toEqual([["Neighborhood Hero", "The Defenders"]]);
    expect(r.state.mainScheme.stageIndex).toBe(3);
    // The first player (p1) is dealt The Defenders (the choice order is the team's order), the second the other.
    const dealtTo = (p: PlayerId) =>
      types(r.events, "encounterCardRevealed")
        .filter((e) => e.playerId === p && [NEIGHBORHOOD_HERO, DEFENDERS].includes(codeOf(r.state, e.instanceId)))
        .map((e) => codeOf(r.state, e.instanceId));
    expect(dealtTo(P1)).toEqual([DEFENDERS]);
    expect(dealtTo(P2)).toEqual([NEIGHBORHOOD_HERO]);
    expect(inPlayCard(r.state, DEFENDERS)).toBeDefined();
    expect(inPlayCard(r.state, NEIGHBORHOOD_HERO)).toBeDefined();
  });
});

describe("Guerilla Warfare 56201b: after a status card is placed on the enemy leader, place 1 threat here", () => {
  it("a stun on Spider-Woman places 1 threat, a stun on a minion places none", () => {
    const stage2 = advanced(open(["56172b", "56201b"])).state;
    expect(stage2.mainScheme.stageIndex).toBe(6);
    const stunnedVillain = stunWith(deps, stage2, villain(stage2), P2);
    expect(inst(stunnedVillain.state, villain(stage2)).statuses.stunned).toBe(1);
    expect(placedByStage(stunnedVillain.state, stunnedVillain.events)).toEqual([1]);
    expect(mainThreat(stunnedVillain.state)).toBe(mainThreat(stage2) + 1);

    const withMinion = engageMinion(stage2, SPIDER_MAN_MINION, "m1", P1);
    const stunnedMinion = stunWith(deps, withMinion, "m1" as InstanceId, P2);
    expect(inst(stunnedMinion.state, "m1" as InstanceId).statuses.stunned).toBe(1);
    expect(placedByStage(stunnedMinion.state, stunnedMinion.events)).toEqual([]);
    expect(mainThreat(stunnedMinion.state)).toBe(mainThreat(withMinion));
  });
});

describe("Superhero Jailbreak 56202b: after step 1 of the villain phase each player discards the top card of the encounter deck", () => {
  /** The stage turns to 2B in the round that reaches it, and its Forced Response discards that round's first two cards. */
  const stage2 = (): GameState =>
    advanced(open(["56172b", "56202b"]), CAUGHT_OFF_GUARD, GANG_UP, ADVANCE, ADVANCE, CONTAMINANT, CONTAMINANT).state;
  // Three boost cards (the villain against each player, the minion), two dealt, and enough left that the deck does not run
  // out and take the discard pile back (a reshuffle would take the side scheme discarded).
  const TAIL = [ADVANCE, ADVANCE, PHEROMONES, PHEROMONES, TANGLED_UP, TANGLED_UP, INCONSPICUOUS, INCONSPICUOUS];
  const engagedWith = (s: GameState, code: string) =>
    inst(s, Object.keys(s.instances).find((i) => codeOf(s, i as InstanceId) === code) as InstanceId).engagedWith;

  it("in the round that reaches 2B, the first two cards are discarded", () => {
    const r = advanced(
      open(["56172b", "56202b"]),
      CAUGHT_OFF_GUARD,
      GANG_UP,
      ADVANCE,
      ADVANCE,
      CONTAMINANT,
      CONTAMINANT,
    );
    expect(r.state.mainScheme.stageIndex).toBe(7);
    expect(
      types(r.events, "abilityResolved").filter((e) => e.abilityId === "56202b.superhero-jailbreak-forced-response"),
    ).toHaveLength(1);
    // The two cards discarded are the boost cards stacked first; the next two were the villain's boost cards.
    expect(
      piles(r.state)
        .discard.map((i) => codeOf(r.state, i))
        .sort(),
    ).toEqual([ADVANCE, ADVANCE, CAUGHT_OFF_GUARD, GANG_UP]);
    expect(types(r.events, "boostCardFlipped").map((e) => codeOf(r.state, e.instanceId))).toEqual([ADVANCE, ADVANCE]);
  });

  it("a minion discarded goes into play engaged with the player who discarded it, a side scheme stays in the discard pile", () => {
    const start = stage2();
    const first = start.firstPlayerId;
    const ready = onlyDeck(heroes(start), SPIDER_MAN_MINION, DEFENDERS, ...TAIL);
    const r = villainPhase(ready, firstLegal);
    const minion = Object.keys(r.state.instances).find(
      (i) => codeOf(r.state, i as InstanceId) === SPIDER_MAN_MINION,
    ) as InstanceId;
    // The first player discards first: the minion is theirs, and it activates in the same villain phase.
    expect(inst(r.state, minion).engagedWith).toBe(first);
    expect(types(r.events, "enemyActivated").some((e) => e.enemyInstanceId === minion)).toBe(true);
    expect(piles(r.state).discard.map((i) => codeOf(r.state, i))).toContain(DEFENDERS);
    expect(inPlayCard(r.state, DEFENDERS)).toBeUndefined();
  });

  it("two minions discarded: each is engaged with its own player", () => {
    const start = stage2();
    const first = start.firstPlayerId;
    const second = first === P1 ? P2 : P1;
    const ready = onlyDeck(heroes(start), SPIDER_MAN_MINION, "56184", ...TAIL);
    const r = villainPhase(ready, firstLegal);
    expect(engagedWith(r.state, SPIDER_MAN_MINION)).toBe(first);
    expect(engagedWith(r.state, "56184")).toBe(second);
  });
});

describe("completing a stage 2 loses the game", () => {
  it.each(PAIRS)("%s then %s: the villain phase that reaches the target loses", (s1, s2) => {
    const stage2 = heroes(advanced(open([s1, s2])).state);
    expect(stage2.outcome).toBeNull();
    const goal = target(stage2);
    expect(goal).toBe(18);
    const r = villainPhase(patchInstance(stage2, scheme(stage2), { threat: goal - 3 }), firstLegal);
    expect(types(r.events, "mainSchemeCompleted")).toHaveLength(1);
    expect(r.state.outcome).toMatchObject({ result: "loss" });
  });
});
