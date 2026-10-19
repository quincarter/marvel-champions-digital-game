import { CW_CARDS } from "@mc/content";
import { activeEncounterDeckId, type EngineDeps, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import {
  attacksBy,
  codeOf,
  flippedBoosts,
  inDiscardPile,
  piles,
  revealedCodes,
  types,
} from "../../../wave9/testing.js";
import { SPIDER_WOMAN_SCENARIO, WAVE10_DEPS, civilWarHeroGame } from "../../testing.js";
import {
  FREEDOM_FIGHTERS_BORROWED_ICONS,
  FREEDOM_FIGHTERS_BOOST,
  MODULAR_NEW_AVENGERS,
  MODULAR_NEW_AVENGERS_SKIPPED,
  freedomFightersBoost,
} from "./new-avengers.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The New Avengers modular set (56150 Falcon, 56151 Hercules, 56152 Goliath, 56153 Freedom Fighters, 56154 New
 * Avengers), docs/phase7-wave10.md sections 3.9, 3.10 and 3.23. Every test is a real game in the
 * `resistance-spider-woman` scenario with New Avengers picked as a modular set (Captain America's own scenario is not
 * relied on: its leader is unscripted). Cooperatively the enemy leader is Spider-Woman (MC56 p. 6). She starts with
 * Finesse and no skill counter; a boost card is not a revealed card, so her interrupt does not place any.
 *
 * The villain phase draws the villain's boost card first, then deals each player a card (RRG 1.8 "Villain Phase"), so a
 * stack reads "boost, dealt". Advance 01186 prints no boost icon and no Boost ability. Self-propelled Glide 56179
 * (Spider-Woman's own side scheme) is the harmless card to deal. Freedom Fighters (56153; its second code 56157 is
 * tested in secret-avengers.test.ts) prints no boost icon, only a star.
 */
const FALCON = "56150";
const HERCULES = "56151";
const GOLIATH = "56152";
const FIGHTERS = "56153";
const NEW_AVENGERS = "56154";
const SPIDER_WOMAN = "56168";
const ADVANCE = "01186";
const GLIDE = "56179";
const DEFEND = "56193"; // Hell's Kitchen's side scheme: a second harmless card to deal
const SET = [FALCON, HERCULES, GOLIATH, FIGHTERS, NEW_AVENGERS];
const REFS = [
  "56150.when-defeated",
  "56150.boost",
  "56151.when-defeated",
  "56151.boost",
  "56152.when-defeated",
  "56152.boost",
  "56153.when-revealed",
  "56153.boost",
  "56154.when-defeated",
];

const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const leaderOf = (s: GameState): InstanceId => s.activeVillainId!;
const boostsOn = (s: GameState) => inst(s, leaderOf(s)).boostCards;
const hero = (s: GameState) => identityOf(s, P1);
const discardCodes = (s: GameState) => piles(s).discard.map((id) => codeOf(s, id));
const status = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough") => inst(s, id).statuses[name];
const withStatus = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [name]: n } });

/**
 * The Spider-Woman scenario with New Avengers as a modular set, past setup, hero form, Spider-Woman not tough. Stage 1A
 * revealed Self-propelled Glide; it is back in the encounter deck because the stacks deal it as the harmless filler card.
 */
function game(opts: { readonly sets?: string[]; readonly twoPlayers?: boolean } = {}): GameState {
  const start = civilWarHeroGame(SPIDER_WOMAN_SCENARIO, {
    modularSetIds: opts.sets ?? ["new_avengers", "defenders", "hells_kitchen"],
    leaderSideScheme: "discarded",
    ...(opts.twoPlayers ? { twoPlayers: true } : {}),
  });
  const heroes = opts.twoPlayers ? withForm(start, { heroForm: 0 }, P2) : start;
  return withStatus(heroes, leaderOf(heroes), "tough", 0);
}

/** Surgery: the encounter deck's own copy of minion `code`, engaged with player 1 (no reveal, no When Revealed). */
function engaged(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: { ...state.instances[id]!, engagedWith: player, faceup: true } },
    },
  };
}

/** Player 1's hero, readied by surgery, defeats `target` with a real basic attack. */
function defeat(state: GameState, target: InstanceId) {
  const ready = patchInstance(patchInstance(state, target, { damage: 999 }), hero(state), { exhausted: false });
  return driveEventsPicking(WAVE10_DEPS, ready, firstLegal, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: hero(state),
    targetInstanceId: target,
  });
}

/** The first player ends the turn and the villain phase runs on the stacked deck (boost card first, then the dealt card). */
const villainPhase = (state: GameState, ...stack: string[]) =>
  driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));

const flipped = (s: GameState, events: Parameters<typeof flippedBoosts>[0]) =>
  flippedBoosts(events).map((f) => [codeOf(s, f.instanceId), f.boostIcons]);

describe("registry", () => {
  it("registers the nine refs of the scripted cards, each a valid definition", () => {
    expect(Object.keys(MODULAR_NEW_AVENGERS).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MODULAR_NEW_AVENGERS)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("skips nothing: Freedom Fighters' two refs are scripted", () => {
    expect(Object.keys(MODULAR_NEW_AVENGERS_SKIPPED)).toEqual([]);
  });

  it("the data names exactly these refs, for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    for (const ref of ["56150.when-defeated", "56151.when-defeated", "56152.when-defeated", "56154.when-defeated"])
      expect(MODULAR_NEW_AVENGERS[ref]!.trigger, ref).toMatchObject({ kind: "whenDefeated" });
    expect(MODULAR_NEW_AVENGERS["56153.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    for (const ref of ["56150.boost", "56151.boost", "56152.boost", "56153.boost"])
      expect(MODULAR_NEW_AVENGERS[ref]!.trigger, ref).toMatchObject({ kind: "boost" });
  });

  it("the three Teamwork minions share one When Defeated definition", () => {
    expect(MODULAR_NEW_AVENGERS["56151.when-defeated"]).toBe(MODULAR_NEW_AVENGERS["56150.when-defeated"]);
    expect(MODULAR_NEW_AVENGERS["56152.when-defeated"]).toBe(MODULAR_NEW_AVENGERS["56150.when-defeated"]);
  });

  it("setup: the encounter deck holds one copy of each card", () => {
    const s = game();
    const all = Object.keys(s.instances).map((i) => codeOf(s, i as InstanceId));
    expect(SET.map((code) => all.filter((c) => c === code).length)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe.each([
  [FALCON, "Falcon", 2, 2, 3],
  [HERCULES, "Hercules", 3, 1, 4],
] as const)("%s %s: Teamwork minion", (code, _name, atk, sch, hp) => {
  it("is data: a unique Avenger minion with Teamwork (Avenger), no boost icon, a star icon and no Victory", () => {
    const card = dataOf(code);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      atk,
      sch,
      hp,
      0,
      true,
      true,
    ]);
    expect(card.keywords).toEqual([{ name: "teamwork", sharedTrait: expect.anything() }]);
  });

  it("WHEN DEFEATED: Spider-Woman holds it facedown, undamaged and unengaged, and it is in no pile", () => {
    const minion = engaged(game(), code);
    const { state, events } = defeat(minion.state, minion.id);
    expect(types(events, "characterDefeated").map((e) => e.instanceId)).toEqual([minion.id]);
    expect(types(events, "boostCardDealt")).toEqual([
      { type: "boostCardDealt", enemyInstanceId: leaderOf(state), instanceId: minion.id, outsideActivation: true },
    ]);
    expect(boostsOn(state)).toEqual([minion.id]);
    expect(inst(state, minion.id)).toMatchObject({ faceup: false, damage: 0, engagedWith: null });
    expect(discardCodes(state)).not.toContain(code);
    expect(state.players.flatMap((p) => [...p.playArea, ...p.discard, ...p.hand, ...p.deck])).not.toContain(minion.id);
    expect(flippedBoosts(events)).toEqual([]);
  });

  it("a stunned Spider-Woman does not activate: the card stays facedown until her next activation", () => {
    const minion = engaged(game(), code);
    const given = defeat(minion.state, minion.id).state;
    const first = villainPhase(withStatus(given, leaderOf(given), "stunned"), GLIDE);
    expect(flippedBoosts(first.events)).toEqual([]);
    expect(status(first.state, leaderOf(first.state), "stunned")).toBe(0);
    expect(boostsOn(first.state)).toEqual([minion.id]);
    expect(inst(first.state, minion.id).faceup).toBe(false);
    const second = villainPhase(first.state, ADVANCE, DEFEND);
    expect(flipped(second.state, second.events)).toEqual([
      [code, 0],
      [ADVANCE, 0],
    ]);
    expect(boostsOn(second.state)).toEqual([]);
  });
});

describe("Falcon (56150) Boost: you are confused; if you were already confused, this card gains two boost icons", () => {
  it("as the villain's boost card: you become confused and it adds no icon", () => {
    const start = game();
    expect(status(start, hero(start), "confused")).toBe(0);
    const { state, events } = villainPhase(start, FALCON, GLIDE);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(types(events, "statusGiven").filter((e) => e.instanceId === hero(state))).toEqual([
      { type: "statusGiven", instanceId: hero(state), status: "confused" },
    ]);
    expect(status(state, hero(state), "confused")).toBe(1);
    expect(inst(state, hero(state)).damage).toBe(2);
  });

  it("as the villain's boost card with you already confused: it gains two icons (ATK 2 + 2) and you stay confused once", () => {
    const start = withStatus(game(), hero(game()), "confused");
    const { state, events } = villainPhase(start, FALCON, GLIDE);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
    expect(types(events, "statusGiven").filter((e) => e.instanceId === hero(state))).toEqual([]);
    expect(status(state, hero(state), "confused")).toBe(1);
    expect(inst(state, hero(state)).damage).toBe(4);
  });

  it("turned up from the leader's held cards at her next activation: first, with its Boost resolving, then the dealt card", () => {
    const falcon = engaged(game(), FALCON);
    const given = defeat(falcon.state, falcon.id).state;
    const { state, events } = villainPhase(given, ADVANCE, GLIDE);
    expect(flipped(state, events)).toEqual([
      [FALCON, 0],
      [ADVANCE, 0],
    ]);
    expect(status(state, hero(state), "confused")).toBe(1);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(boostsOn(state)).toEqual([]);
    expect(inst(state, falcon.id).faceup).toBe(true);
    // The discard pile is newest-first: Self-propelled Glide stays in play, so the boost cards are on top.
    expect(
      piles(state)
        .discard.slice(0, 2)
        .map((id) => codeOf(state, id)),
    ).toEqual([ADVANCE, FALCON]);
  });
});

describe("Hercules (56151) Boost: you are stunned; if you were already stunned, this card gains two boost icons", () => {
  it("as the villain's boost card: you become stunned and it adds no icon", () => {
    const start = game();
    const { state, events } = villainPhase(start, HERCULES, GLIDE);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(types(events, "statusGiven").filter((e) => e.instanceId === hero(state))).toEqual([
      { type: "statusGiven", instanceId: hero(state), status: "stunned" },
    ]);
    expect(status(state, hero(state), "stunned")).toBe(1);
  });

  it("as the villain's boost card with you already stunned: it gains two icons (ATK 2 + 2) and you stay stunned once", () => {
    const start = withStatus(game(), hero(game()), "stunned");
    const { state, events } = villainPhase(start, HERCULES, GLIDE);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
    expect(types(events, "statusGiven").filter((e) => e.instanceId === hero(state))).toEqual([]);
    expect(status(state, hero(state), "stunned")).toBe(1);
  });

  it("turned up from the leader's held cards at her next activation", () => {
    const hercules = engaged(game(), HERCULES);
    const given = defeat(hercules.state, hercules.id).state;
    const { state, events } = villainPhase(given, ADVANCE, GLIDE);
    expect(flipped(state, events)).toEqual([
      [HERCULES, 0],
      [ADVANCE, 0],
    ]);
    expect(status(state, hero(state), "stunned")).toBe(1);
    expect(boostsOn(state)).toEqual([]);
  });
});

describe("Goliath (56152) Boost: give the enemy leader a tough status card; if they were already tough, two boost icons", () => {
  it("is data: a unique Avenger Giant minion, ATK 2, SCH 1, 5 hit points, no boost icon and no Victory", () => {
    const card = dataOf(GOLIATH);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      2,
      1,
      5,
      0,
      true,
      true,
    ]);
    expect(card.keywords).toEqual([{ name: "teamwork", sharedTrait: expect.anything() }]);
  });

  it("WHEN DEFEATED: Spider-Woman holds it facedown and it is in no pile", () => {
    const goliath = engaged(game(), GOLIATH);
    const { state } = defeat(goliath.state, goliath.id);
    expect(boostsOn(state)).toEqual([goliath.id]);
    expect(inst(state, goliath.id)).toMatchObject({ faceup: false, damage: 0, engagedWith: null });
    expect(discardCodes(state)).not.toContain(GOLIATH);
  });

  it("as the villain's boost card: Spider-Woman is given a tough status card and it adds no icon", () => {
    const start = game();
    expect(status(start, leaderOf(start), "tough")).toBe(0);
    const { state, events } = villainPhase(start, GOLIATH, GLIDE);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(types(events, "statusGiven").filter((e) => e.instanceId === leaderOf(state))).toEqual([
      { type: "statusGiven", instanceId: leaderOf(state), status: "tough" },
    ]);
    expect(status(state, leaderOf(state), "tough")).toBe(1);
  });

  it("as the villain's boost card with her already tough: it gains two icons (ATK 2 + 2) and she stays tough once", () => {
    const start = withStatus(game(), leaderOf(game()), "tough");
    const { state, events } = villainPhase(start, GOLIATH, GLIDE);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
    expect(types(events, "statusGiven").filter((e) => e.instanceId === leaderOf(state))).toEqual([]);
    expect(status(state, leaderOf(state), "tough")).toBe(1);
  });

  it("Goliath leaves your own status cards alone", () => {
    const { state } = villainPhase(game(), GOLIATH, GLIDE);
    expect(status(state, hero(state), "confused")).toBe(0);
    expect(status(state, hero(state), "stunned")).toBe(0);
    expect(status(state, hero(state), "tough")).toBe(0);
  });
});

describe("two Teamwork minions defeated before one activation", () => {
  it("Spider-Woman holds both in the order given; the activation turns up both, then the dealt boost card", () => {
    const falcon = engaged(game(), FALCON);
    const hercules = engaged(falcon.state, HERCULES);
    const one = defeat(hercules.state, falcon.id).state;
    const two = defeat(one, hercules.id).state;
    expect(boostsOn(two)).toEqual([falcon.id, hercules.id]);
    expect([falcon.id, hercules.id].map((id) => inst(two, id).faceup)).toEqual([false, false]);
    const { state, events } = villainPhase(two, ADVANCE, GLIDE);
    expect(flipped(state, events)).toEqual([
      [FALCON, 0],
      [HERCULES, 0],
      [ADVANCE, 0],
    ]);
    expect([status(state, hero(state), "confused"), status(state, hero(state), "stunned")]).toEqual([1, 1]);
    expect(boostsOn(state)).toEqual([]);
    expect(
      piles(state)
        .discard.slice(0, 3)
        .map((id) => codeOf(state, id)),
    ).toEqual([ADVANCE, HERCULES, FALCON]);
  });

  it("each Boost reads its own status: already confused, Falcon gains two icons; not stunned, Hercules gains none", () => {
    const falcon = engaged(game(), FALCON);
    const hercules = engaged(falcon.state, HERCULES);
    const given = defeat(defeat(hercules.state, falcon.id).state, hercules.id).state;
    const { state, events } = villainPhase(withStatus(given, hero(given), "confused"), ADVANCE, GLIDE);
    // Already confused: Falcon gains two icons. You were not stunned: Hercules gains none.
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
  });
});

describe("New Avengers (56154)", () => {
  it("is data: a side scheme with 3 threat (none per player), 2 boost icons and Hinder 1 per hero", () => {
    const card = dataOf(NEW_AVENGERS);
    expect([card.type, card.startingThreat, card.boostIcons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      2,
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  const defeatScheme = (state: GameState, scheme: InstanceId) =>
    driveEventsPicking(WAVE10_DEPS, patchInstance(state, hero(state), { exhausted: false }), firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hero(state),
      schemeInstanceId: scheme,
    });

  it("WHEN DEFEATED: each minion in the encounter discard pile goes back into the encounter deck; other cards stay", () => {
    const staged = inDiscardPile(
      inDiscardPile(inDiscardPile(inDiscardPile(game(), FALCON), HERCULES), GOLIATH),
      ADVANCE,
    );
    expect(discardCodes(staged).sort()).toEqual([ADVANCE, FALCON, GOLIATH, HERCULES].sort());
    const scheme = encounterCardInVillainArea(staged, NEW_AVENGERS, 1);
    const deckBefore = piles(scheme.state).deck.length;
    const run = defeatScheme(scheme.state, scheme.id);
    expect(types(run.events, "schemeDefeated").map((e) => e.instanceId)).toEqual([scheme.id]);
    // The three minions are in the deck; Advance and the scheme itself are the only cards in the discard pile.
    expect(discardCodes(run.state).sort()).toEqual([ADVANCE, NEW_AVENGERS].sort());
    expect(piles(run.state).deck.length).toBe(deckBefore + 3);
    const deckCodes = piles(run.state).deck.map((id) => codeOf(run.state, id));
    for (const code of [FALCON, HERCULES, GOLIATH]) expect(deckCodes.filter((c) => c === code)).toHaveLength(1);
    // Reshuffled: the three do not sit on top in the order they were put in.
    expect(deckCodes.slice(0, 3)).not.toEqual([FALCON, HERCULES, GOLIATH]);
  });

  it("WHEN DEFEATED with no minion in the discard pile: the deck is unchanged in size", () => {
    const staged = inDiscardPile(game(), ADVANCE);
    const scheme = encounterCardInVillainArea(staged, NEW_AVENGERS, 1);
    const deckBefore = piles(scheme.state).deck.length;
    const run = defeatScheme(scheme.state, scheme.id);
    expect(piles(run.state).deck.length).toBe(deckBefore);
    expect(discardCodes(run.state).sort()).toEqual([ADVANCE, NEW_AVENGERS].sort());
  });

  it("WHEN DEFEATED: a Teamwork minion held facedown by the leader is not in the discard pile, so it is not shuffled", () => {
    const falcon = engaged(game(), FALCON);
    const given = defeat(falcon.state, falcon.id).state;
    const scheme = encounterCardInVillainArea(given, NEW_AVENGERS, 1);
    const run = defeatScheme(scheme.state, scheme.id);
    expect(boostsOn(run.state)).toEqual([falcon.id]);
    expect(piles(run.state).deck).not.toContain(falcon.id);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Spider-Woman ATK 2 + 2)", () => {
    const run = villainPhase(game(), NEW_AVENGERS, GLIDE);
    expect(attacksBy(run.state, run.events, SPIDER_WOMAN)).toMatchObject([
      { baseAtk: 2, boostIcons: 2, damageDealt: 4 },
    ]);
  });
});

const ATLANTEAN_GUARD = "56165"; // Atlantean Guard (the Atlanteans set): a minion with a When Revealed and no Boost ability
const hasStatus = (s: GameState, id: InstanceId) => {
  const { stunned, confused, tough } = inst(s, id).statuses;
  return { stunned, confused, tough };
};
/** The Boost abilities that resolved, as the log names them: [card code, ability id]. */
const boostsResolved = (s: GameState, events: Parameters<typeof flippedBoosts>[0]) =>
  types(events, "abilityResolved")
    .filter((e) => (e.abilityId as string).endsWith(".boost"))
    .map((e) => [codeOf(s, e.instanceId), e.abilityId as string]);
const depsWithBoost = (boostAbility: typeof FREEDOM_FIGHTERS_BOOST): EngineDeps => ({
  ...WAVE10_DEPS,
  abilities: { ...WAVE10_DEPS.abilities, "56153.boost": boostAbility },
});
const phase = (deps: EngineDeps, state: GameState, ...stack: string[]) =>
  driveEventsPicking(deps, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));
const DEPS_B = depsWithBoost(freedomFightersBoost("joinActivation"));
const GUARD_SETS = ["new_avengers", "atlanteans", "hells_kitchen"];

describe("Freedom Fighters (56153)", () => {
  it("is data: a treachery with a boost star and no boost icon", () => {
    const card = dataOf(FIGHTERS);
    expect([card.type, card.boostIcons, card.starIcon]).toEqual(["treachery", 0, true]);
    expect(MODULAR_NEW_AVENGERS["56153.when-revealed"]).toBeDefined();
    expect(MODULAR_NEW_AVENGERS["56153.boost"]).toBe(FREEDOM_FIGHTERS_BOOST);
  });

  it("question 10: the module's constant is answer A, the default; B is a valid definition", () => {
    expect(FREEDOM_FIGHTERS_BORROWED_ICONS).toBe("nothing");
    expect(MODULAR_NEW_AVENGERS["56153.boost"]).toEqual(freedomFightersBoost("nothing"));
    expect(validateDefinition(freedomFightersBoost("joinActivation"))).toEqual([]);
  });

  describe("WHEN REVEALED", () => {
    it("Falcon and Hercules in play: both Boost abilities resolve on the revealing player; no surge", () => {
      const falcon = engaged(game(), FALCON);
      const hercules = engaged(falcon.state, HERCULES);
      const { state, events } = phase(WAVE10_DEPS, hercules.state, ADVANCE, FIGHTERS, DEFEND);
      expect(revealedCodes(state, events)).toEqual([FIGHTERS]);
      expect(boostsResolved(state, events)).toEqual([
        [FALCON, "56150.boost"],
        [HERCULES, "56151.boost"],
      ]);
      expect(hasStatus(state, hero(state))).toEqual({ stunned: 1, confused: 1, tough: 0 });
      expect(types(events, "surgeTriggered")).toEqual([]);
      for (const id of [falcon.id, hercules.id]) {
        expect(state.players[0]!.playArea).toContain(id);
        expect(inst(state, id)).toMatchObject({ engagedWith: P1, faceup: true });
      }
    });

    it("Falcon (two halves) with the player not confused: the status is given, the icon half does nothing", () => {
      const falcon = engaged(game(), FALCON);
      const { state, events } = phase(WAVE10_DEPS, falcon.state, ADVANCE, FIGHTERS, DEFEND);
      expect(types(events, "statusGiven").map((e) => [e.instanceId, e.status])).toEqual([[hero(state), "confused"]]);
      expect(hasStatus(state, hero(state))).toEqual({ stunned: 0, confused: 1, tough: 0 });
      expect(types(events, "surgeTriggered")).toEqual([]);
    });

    // RRG 1.8 "Resolve" (p. 37): an ability resolves only if one or more of its effects is applied to the game state.
    // Already confused, Falcon's Boost gives no second status and its "gains [boost][boost]" does nothing (section 4.0
    // question 10, answer A), so it changed nothing: no Boost ability was resolved this way, and the card surges.
    it("Falcon (two halves) with the player already confused: nothing changes, so none resolved and it surges", () => {
      const falcon = engaged(game(), FALCON);
      const confused = withStatus(falcon.state, hero(falcon.state), "confused");
      const { state, events } = phase(WAVE10_DEPS, confused, ADVANCE, FIGHTERS, DEFEND);
      expect(types(events, "statusGiven")).toEqual([]);
      expect(hasStatus(state, hero(state))).toEqual({ stunned: 0, confused: 1, tough: 0 });
      expect(types(events, "surgeTriggered").map((e) => codeOf(state, e.instanceId))).toEqual([FIGHTERS]);
      expect(revealedCodes(state, events)).toEqual([FIGHTERS, DEFEND]);
    });

    it("no minion in play: the card gains surge and exactly one more encounter card is revealed", () => {
      const { state, events } = phase(WAVE10_DEPS, game(), ADVANCE, FIGHTERS, DEFEND);
      expect(boostsResolved(state, events)).toEqual([]);
      expect(types(events, "surgeTriggered").map((e) => codeOf(state, e.instanceId))).toEqual([FIGHTERS]);
      expect(revealedCodes(state, events)).toEqual([FIGHTERS, DEFEND]);
    });

    it("only a minion with no Boost ability in play (Atlantean Guard): nothing resolved, so the card gains surge (spec 3.11 counts Boost abilities)", () => {
      const guard = engaged(game({ sets: GUARD_SETS }), ATLANTEAN_GUARD);
      const { state, events } = phase(WAVE10_DEPS, guard.state, ADVANCE, FIGHTERS, DEFEND);
      expect(boostsResolved(state, events)).toEqual([]);
      expect(types(events, "surgeTriggered").map((e) => codeOf(state, e.instanceId))).toEqual([FIGHTERS]);
      expect(revealedCodes(state, events)).toEqual([FIGHTERS, DEFEND]);
      expect(inst(state, guard.id)).toMatchObject({ engagedWith: P1, faceup: true });
    });

    it("a minion with no Boost ability beside Falcon: only Falcon's resolves, and there is no surge", () => {
      const guard = engaged(game({ sets: GUARD_SETS }), ATLANTEAN_GUARD);
      const falcon = engaged(guard.state, FALCON);
      const { state, events } = phase(WAVE10_DEPS, falcon.state, ADVANCE, FIGHTERS, DEFEND);
      expect(boostsResolved(state, events)).toEqual([[FALCON, "56150.boost"]]);
      expect(types(events, "surgeTriggered")).toEqual([]);
      expect(revealedCodes(state, events)).toEqual([FIGHTERS]);
    });
  });

  describe("BOOST, as the leader's boost card", () => {
    const boosted = (deps: EngineDeps) => {
      const falcon = engaged(game(), FALCON);
      const confused = withStatus(falcon.state, hero(falcon.state), "confused");
      return { ...phase(deps, confused, FIGHTERS, DEFEND), falcon: falcon.id };
    };

    it("question 10, A (the default): Falcon's gained icons do nothing; Spider-Woman attacks for 2 + 0", () => {
      const { state, events, falcon } = boosted(WAVE10_DEPS);
      expect(boostsResolved(state, events)).toEqual([
        [FIGHTERS, "56153.boost"],
        [FALCON, "56150.boost"],
      ]);
      expect(flippedBoosts(events).map((f) => [codeOf(state, f.instanceId), f.boostIcons])).toEqual([[FIGHTERS, 0]]);
      expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
      expect(hasStatus(state, hero(state))).toEqual({ stunned: 0, confused: 1, tough: 0 });
      expect(inst(state, falcon)).toMatchObject({ engagedWith: P1, faceup: true });
      expect(attacksBy(state, events, FALCON)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
      expect(inst(state, hero(state)).damage).toBe(4);
    });

    it('question 10, B (`borrowedBoostIcons: "joinActivation"` built directly): the icons join her attack, 2 + 2', () => {
      const { state, events } = boosted(DEPS_B);
      expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
      expect(attacksBy(state, events, FALCON)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
      expect(hasStatus(state, hero(state))).toEqual({ stunned: 0, confused: 1, tough: 0 });
      expect(inst(state, hero(state)).damage).toBe(6);
    });

    it("question 10, either answer: a player who was not confused becomes confused and no icon is gained", () => {
      for (const deps of [WAVE10_DEPS, DEPS_B]) {
        const falcon = engaged(game(), FALCON);
        const { state, events } = phase(deps, falcon.state, FIGHTERS, DEFEND);
        expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
        expect(hasStatus(state, hero(state))).toEqual({ stunned: 0, confused: 1, tough: 0 });
      }
    });

    it("no minion engaged with you: nothing resolves and Spider-Woman attacks for 2", () => {
      const { state, events } = phase(WAVE10_DEPS, game(), FIGHTERS, DEFEND);
      expect(boostsResolved(state, events)).toEqual([[FIGHTERS, "56153.boost"]]);
      expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    });

    it("two players: only the minion engaged with the attacked player resolves", () => {
      const hercules = engaged(game({ twoPlayers: true }), HERCULES, P1);
      const falcon = engaged(hercules.state, FALCON, P2);
      // Boost cards in order: Spider-Woman on player 1 (Freedom Fighters), on player 2, then each minion's attack.
      const stacked = stackEncounterDeck(falcon.state, FIGHTERS, ADVANCE, GLIDE, DEFEND);
      const { state, events } = driveEventsPicking(WAVE10_DEPS, stacked, firstLegal, endTurn(P1), endTurn(P2));
      expect(boostsResolved(state, events)).toEqual([
        [FIGHTERS, "56153.boost"],
        [HERCULES, "56151.boost"],
      ]);
      expect(types(events, "statusGiven").map((e) => [e.instanceId, e.status])).toEqual([
        [identityOf(state, P1), "stunned"],
      ]);
    });
  });
});
