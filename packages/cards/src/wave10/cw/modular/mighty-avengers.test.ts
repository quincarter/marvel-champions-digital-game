import { CW_CARDS } from "@mc/content";
import { activeEncounterDeckId, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  payWith,
  play,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, withForm } from "../../../testing/staging.js";
import { attacksBy, codeOf, flippedBoosts, inPlayCard, piles, revealedCodes, types } from "../../../wave9/testing.js";
import { IRON_MAN_SCENARIO, WAVE10_DEPS, civilWarHeroGame, stagedInPlay } from "../../testing.js";
import { MODULAR_MIGHTY_AVENGERS, MODULAR_MIGHTY_AVENGERS_SKIPPED } from "./mighty-avengers.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Mighty Avengers modular set (56073 Yellowjacket, 56074 Wasp, 56075 U.S. Agent, 56076 Mighty Avengers, 56077
 * Earth's Mightiest Heroes), docs/phase7-wave10.md sections 3.9, 3.12 and 3.23. Every test is a real game in the
 * `registration-iron-man` scenario (Mighty Avengers is one of its four modular sets), seated with the Tigra precon
 * (an Avenger, so she may play the ally Yellowjacket 56019). Iron Man's attachments are taken off so his activation is
 * ATK 1 and SCH 1. Cooperatively the enemy leader is Iron Man and there is no "your leader" (MC56 p. 6).
 *
 * The villain phase draws the villain's boost card first, then deals each player a card (RRG 1.8 "Villain Phase"), so a
 * stack reads "boost, dealt". Advance 01186 prints no boost icon and no Boost ability. Executive Order 56085 (Maria
 * Hill's set, in this game's deck) puts threat on the schemes and activates nobody: the harmless card to deal.
 */
const YELLOWJACKET = "56073";
const WASP = "56074";
const US_AGENT = "56075";
const MIGHTY = "56076";
const HEROES = "56077";
const ALLY_YELLOWJACKET = "56019";
const BULLSEYE = "56088"; // Dangerous Recruits' minion: a Thunderbolt, not an Avenger
const IRON_MAN = "56059";
const ADVANCE = "01186";
const ORDER = "56085";
const DECOY = "56084";
const SET = [YELLOWJACKET, WASP, US_AGENT, MIGHTY, HEROES];
const REFS = [
  "56073.when-revealed",
  "56073.boost",
  "56074.when-revealed",
  "56074.boost",
  "56075.when-revealed",
  "56075.boost",
  "56076.when-revealed",
  "56077.earths-mightiest-heroes-constant",
];

const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const leaderOf = (s: GameState): InstanceId => s.activeVillainId!;
const hero = (s: GameState) => identityOf(s, P1);
const discardCodes = (s: GameState) => piles(s).discard.map((id) => codeOf(s, id));
const status = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough") => inst(s, id).statuses[name];
const withStatus = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough", n = 1): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [name]: n } });
const idOfCard = (s: GameState, code: string): InstanceId =>
  Object.keys(s.instances).find((i) => codeOf(s, i as InstanceId) === code) as InstanceId;

/**
 * The scenario past setup, hero form, with every attachment taken off Iron Man (and his tough card) and Stark Tower
 * back in the encounter discard pile: its hazard icon deals one player an extra encounter card in the villain phase
 * (RRG 1.8 "Hazard Icon", p. 21), which these stacks do not count on.
 */
function game(opts: { readonly twoPlayers?: boolean } = {}): GameState {
  const start = civilWarHeroGame(IRON_MAN_SCENARIO, {
    leaderSideScheme: "discarded",
    ...(opts.twoPlayers ? { twoPlayers: true } : {}),
  });
  const iron = leaderOf(start);
  let current = patchInstance(start, iron, { attachments: [], statuses: { ...inst(start, iron).statuses, tough: 0 } });
  const deckId = activeEncounterDeckId(current);
  const pile = current.encounterDecks[deckId]!;
  const old = inst(start, iron).attachments;
  for (const id of old) current = patchInstance(current, id, { attachedTo: null });
  current = {
    ...current,
    encounterDecks: { ...current.encounterDecks, [deckId]: { deck: pile.deck, discard: [...old, ...pile.discard] } },
  };
  return opts.twoPlayers ? withForm(current, { heroForm: 0 }, P2) : current;
}

/** Surgery: the encounter deck's own copy of minion `code`, engaged with `player` (no reveal, no When Revealed). */
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

/** Earth's Mightiest Heroes in play (3 threat), as it would be after being revealed. */
const withHeroes = (state: GameState) => encounterCardInVillainArea(state, HEROES, 3);

/** The first player ends the turn and the villain phase runs on the stacked deck (boost card first, then the dealt card). */
const villainPhase = (state: GameState, ...stack: string[]) =>
  driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));

/** Player 1's hero, readied by surgery, makes a basic attack on `target`. */
const attackWith = (state: GameState, target: InstanceId) =>
  driveEventsPicking(WAVE10_DEPS, patchInstance(state, hero(state), { exhausted: false }), firstLegal, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: hero(state),
    targetInstanceId: target,
  });

const toughGiven = (events: Parameters<typeof types>[0], id: InstanceId) =>
  types(events, "statusGiven").filter((e) => e.instanceId === id && e.status === "tough");
const threatFrom = (events: Parameters<typeof types>[0], source: InstanceId) =>
  types(events, "threatPlaced")
    .filter((e) => e.sourceInstanceId === source)
    .map((e) => e.amount);

describe("registry", () => {
  it("registers the eight refs of the five cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(MODULAR_MIGHTY_AVENGERS).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MODULAR_MIGHTY_AVENGERS)) expect(validateDefinition(def), id).toEqual([]);
    expect(MODULAR_MIGHTY_AVENGERS_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    const reg = MODULAR_MIGHTY_AVENGERS;
    for (const ref of REFS.filter((r) => r.endsWith(".when-revealed")))
      expect(reg[ref]!.trigger, ref).toMatchObject({ kind: "whenRevealed" });
    for (const ref of REFS.filter((r) => r.endsWith(".boost")))
      expect(reg[ref]!.trigger, ref).toMatchObject({ kind: "boost" });
    expect(reg["56077.earths-mightiest-heroes-constant"]!.trigger).toMatchObject({ kind: "constant" });
  });

  it("setup: the encounter deck holds one copy of each card", () => {
    const s = game();
    const all = Object.keys(s.instances).map((i) => codeOf(s, i as InstanceId));
    expect(SET.map((code) => all.filter((c) => c === code).length)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("Yellowjacket (56073)", () => {
  it("is data: the erratum's title, a unique Avenger minion, ATK 1, SCH 2, 4 hit points, Toughness and a star icon", () => {
    const card = dataOf(YELLOWJACKET);
    expect([card.name, card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "Yellowjacket",
      "minion",
      1,
      2,
      4,
      0,
      true,
      true,
    ]);
    expect(card.keywords).toEqual([{ name: "toughness" }]);
  });

  it("WHEN REVEALED: the enemy leader is given a tough status card; Yellowjacket enters tough by its own keyword", () => {
    const start = game();
    const { state, events } = villainPhase(start, ADVANCE, YELLOWJACKET, ORDER);
    const minion = inPlayCard(state, YELLOWJACKET)!;
    expect(revealedCodes(state, events)).toEqual([YELLOWJACKET]);
    expect(toughGiven(events, leaderOf(state))).toHaveLength(1);
    expect(status(state, leaderOf(state), "tough")).toBe(1);
    expect(status(state, minion, "tough")).toBe(1);
    expect(status(state, hero(state), "tough")).toBe(0);
    expect(inst(state, minion).engagedWith).toBe(P1);
    // A minion's When Revealed gives no boost card to the leader's activation, and a minion does not activate now.
    expect(flippedBoosts(events)).toHaveLength(1);
    expect(attacksBy(state, events, YELLOWJACKET)).toEqual([]);
  });

  it("WHEN REVEALED with the enemy leader already tough: no second status card", () => {
    const start = withStatus(game(), leaderOf(game()), "tough");
    const { state, events } = villainPhase(start, ADVANCE, YELLOWJACKET, ORDER);
    expect(toughGiven(events, leaderOf(state))).toEqual([]);
    expect(status(state, leaderOf(state), "tough")).toBe(1);
  });

  it("BOOST, as the leader's boost card: Iron Man is given a tough status card; no icon is added to the attack", () => {
    const start = game();
    const { state, events } = villainPhase(start, YELLOWJACKET, ORDER);
    expect(attacksBy(state, events, IRON_MAN)).toMatchObject([{ baseAtk: 1, boostIcons: 0, damageDealt: 1 }]);
    expect(toughGiven(events, leaderOf(state))).toHaveLength(1);
    expect(status(state, leaderOf(state), "tough")).toBe(1);
    expect(status(state, hero(state), "tough")).toBe(0);
    expect(inPlayCard(state, YELLOWJACKET)).toBeUndefined();
    expect(discardCodes(state)).toContain(YELLOWJACKET);
  });

  it("BOOST with the leader already tough: still one tough status card", () => {
    const start = withStatus(game(), leaderOf(game()), "tough");
    const { state, events } = villainPhase(start, YELLOWJACKET, ORDER);
    expect(toughGiven(events, leaderOf(state))).toEqual([]);
    expect(status(state, leaderOf(state), "tough")).toBe(1);
  });

  describe("unique rule (RRG 1.8 p. 70 erratum; 'Unique Icon', pp. 45-46): the minion and the ally share a title, not a name", () => {
    it("the ally Yellowjacket (Hank Pym) in play, the minion revealed: it enters play, engaged, and the ally stays", () => {
      const ally = stagedInPlay(game(), ALLY_YELLOWJACKET);
      expect(dataOf(ALLY_YELLOWJACKET).subtitle).toBe("Hank Pym");
      expect(dataOf(YELLOWJACKET).subtitle).toBeUndefined();
      const { state, events } = villainPhase(ally.state, ADVANCE, YELLOWJACKET, ORDER);
      expect(types(events, "uniqueEntryBlocked")).toEqual([]);
      expect(revealedCodes(state, events)).toEqual([YELLOWJACKET]);
      const minion = inPlayCard(state, YELLOWJACKET)!;
      expect(inst(state, minion)).toMatchObject({ engagedWith: P1, faceup: true });
      expect(state.players[0]!.playArea).toContain(ally.id);
      expect(status(state, leaderOf(state), "tough")).toBe(1);
      expect(discardCodes(state)).not.toContain(YELLOWJACKET);
    });

    it("the minion in play, the ally played from hand: it enters play and the minion stays", () => {
      const minion = engaged(game(), YELLOWJACKET);
      const given = moveToHand(minion.state, P1, ALLY_YELLOWJACKET);
      const id = given.ids[0]!;
      const run = driveEventsPicking(
        WAVE10_DEPS,
        given.state,
        firstLegal,
        play(P1, id, payWith(given.state, P1, 3, [id])),
      );
      expect(types(run.events, "uniqueEntryBlocked")).toEqual([]);
      expect(run.state.players[0]!.playArea).toContain(id);
      expect(run.state.players[0]!.playArea).toContain(minion.id);
      expect(inst(run.state, minion.id).engagedWith).toBe(P1);
    });
  });
});

describe("Wasp (56074)", () => {
  it("is data: a unique Aerial Avenger minion, ATK 2, SCH 1, 3 hit points, Teamwork (Avenger) and a star icon", () => {
    const card = dataOf(WASP);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      2,
      1,
      3,
      0,
      true,
      true,
    ]);
    expect(card.keywords).toEqual([{ name: "teamwork", sharedTrait: expect.anything() }]);
  });

  it("WHEN REVEALED: 1 threat on the main scheme; with no other Avenger in play Teamwork does not activate her", () => {
    const start = game();
    const wasp = idOfCard(start, WASP);
    const { state, events } = villainPhase(start, ADVANCE, WASP, ORDER);
    expect(threatFrom(events, wasp)).toEqual([1]);
    expect(attacksBy(state, events, WASP)).toEqual([]);
    expect(inst(state, wasp)).toMatchObject({ engagedWith: P1, faceup: true });
  });

  it("WHEN REVEALED with another Avenger minion in play: the threat is placed, then Teamwork makes her attack (ATK 2, no boost card)", () => {
    const agent = engaged(game(), US_AGENT);
    const wasp = idOfCard(agent.state, WASP);
    const { state, events } = villainPhase(agent.state, ADVANCE, WASP, ORDER);
    expect(threatFrom(events, wasp)).toEqual([1]);
    expect(attacksBy(state, events, WASP)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(flippedBoosts(events)).toHaveLength(1);
    expect(inst(state, hero(state)).damage).toBe(
      inst(villainPhase(agent.state, ADVANCE, ORDER).state, hero(state)).damage + 2,
    );
  });

  it("BOOST: 1 threat on the main scheme, in addition to the villain phase's own threat", () => {
    const baseline = villainPhase(game(), ADVANCE, ORDER);
    const { state, events } = villainPhase(game(), WASP, ORDER);
    expect(mainThreat(state)).toBe(mainThreat(baseline.state) + 1);
    expect(threatFrom(events, idOfCard(state, WASP))).toEqual([1]);
    expect(attacksBy(state, events, IRON_MAN)).toMatchObject([{ baseAtk: 1, boostIcons: 0, damageDealt: 1 }]);
    expect(inPlayCard(state, WASP)).toBeUndefined();
  });
});

describe("U.S. Agent (56075)", () => {
  it("is data: a unique Avenger minion, ATK 2, SCH 1, 3 hit points, Retaliate 1, Toughness and a star icon", () => {
    const card = dataOf(US_AGENT);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      2,
      1,
      3,
      0,
      true,
      true,
    ]);
    expect(card.keywords).toEqual([{ name: "retaliate", value: 1 }, { name: "toughness" }]);
  });

  it("WHEN REVEALED: 1 damage to your identity, and he enters tough", () => {
    const { state, events } = villainPhase(game(), ADVANCE, US_AGENT, ORDER);
    const agent = inPlayCard(state, US_AGENT)!;
    expect(revealedCodes(state, events)).toEqual([US_AGENT]);
    expect(inst(state, hero(state)).damage).toBe(1 + 1);
    expect(status(state, agent, "tough")).toBe(1);
    expect(inst(state, agent)).toMatchObject({ engagedWith: P1, faceup: true });
  });

  it("BOOST, as the leader's boost card: 1 damage to the hero Iron Man is activating against, on top of the 1 ATK", () => {
    const { state, events } = villainPhase(game(), US_AGENT, ORDER);
    expect(attacksBy(state, events, IRON_MAN)).toMatchObject([{ baseAtk: 1, boostIcons: 0, damageDealt: 1 }]);
    expect(inst(state, hero(state)).damage).toBe(1 + 1);
    expect(inPlayCard(state, US_AGENT)).toBeUndefined();
  });
});

describe("Mighty Avengers (56076)", () => {
  it("is data: a treachery with 2 boost icons and no star", () => {
    const card = dataOf(MIGHTY);
    expect([card.type, card.boostIcons, card.starIcon]).toEqual(["treachery", 2, undefined]);
  });

  it("WHEN REVEALED with all three minions in play: each When Revealed resolves, none is skipped, no surge", () => {
    const yellowjacket = engaged(game(), YELLOWJACKET);
    const wasp = engaged(yellowjacket.state, WASP);
    const agent = engaged(wasp.state, US_AGENT);
    const { state, events } = villainPhase(agent.state, ADVANCE, MIGHTY, ORDER);
    expect(revealedCodes(state, events)).toEqual([MIGHTY]);
    expect(types(events, "surgeTriggered")).toEqual([]);
    expect(status(state, leaderOf(state), "tough")).toBe(1);
    expect(threatFrom(events, wasp.id)).toEqual([1]);
    expect(inst(state, hero(state)).damage).toBe(
      inst(villainPhase(agent.state, ADVANCE, ORDER).state, hero(state)).damage + 1,
    );
    for (const m of [yellowjacket, wasp, agent])
      expect(inst(state, m.id)).toMatchObject({ engagedWith: P1, faceup: true });
    expect(discardCodes(state)).toContain(MIGHTY);
    expect(codeOf(state, piles(state).deck[0]!)).toBe(ORDER);
  });

  it("WHEN REVEALED with only Wasp in play: only her 1 threat is placed; no tough card, no damage to you", () => {
    const wasp = engaged(game(), WASP);
    const { state, events } = villainPhase(wasp.state, ADVANCE, MIGHTY, ORDER);
    expect(threatFrom(events, wasp.id)).toEqual([1]);
    expect(status(state, leaderOf(state), "tough")).toBe(0);
    expect(inst(state, hero(state)).damage).toBe(
      inst(villainPhase(wasp.state, ADVANCE, ORDER).state, hero(state)).damage,
    );
    expect(types(events, "surgeTriggered")).toEqual([]);
  });

  it("WHEN REVEALED with no minion in play: nothing resolves and the card gains surge, so one more card is revealed", () => {
    const { state, events } = villainPhase(game(), ADVANCE, MIGHTY, DECOY);
    expect(types(events, "surgeTriggered").map((e) => codeOf(state, e.instanceId))).toEqual([MIGHTY]);
    expect(revealedCodes(state, events)).toEqual([MIGHTY, DECOY]);
  });

  // RRG 1.8 "Resolve" (p. 37); FFG ruling on Citywide Crisis (RRG 1.0-1.4 era): a When Revealed that changes nothing
  // was not resolved, so it is not counted.
  it("WHEN REVEALED with only Yellowjacket in play and the leader already tough: nothing changes, so it surges", () => {
    const yellowjacket = engaged(game(), YELLOWJACKET);
    const start = withStatus(yellowjacket.state, leaderOf(yellowjacket.state), "tough");
    const { state, events } = villainPhase(start, ADVANCE, MIGHTY, DECOY);
    expect(toughGiven(events, leaderOf(state))).toEqual([]);
    expect(status(state, leaderOf(state), "tough")).toBe(1);
    expect(types(events, "surgeTriggered").map((e) => codeOf(state, e.instanceId))).toEqual([MIGHTY]);
    expect(revealedCodes(state, events)).toEqual([MIGHTY, DECOY]);
  });

  it("WHEN REVEALED with Yellowjacket (leader already tough) and Wasp: Wasp's threat counts, so no surge", () => {
    const yellowjacket = engaged(game(), YELLOWJACKET);
    const wasp = engaged(yellowjacket.state, WASP);
    const start = withStatus(wasp.state, leaderOf(wasp.state), "tough");
    const { state, events } = villainPhase(start, ADVANCE, MIGHTY, DECOY);
    expect(threatFrom(events, wasp.id)).toEqual([1]);
    expect(types(events, "surgeTriggered")).toEqual([]);
    expect(revealedCodes(state, events)).toEqual([MIGHTY]);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Iron Man ATK 1 + 2) and nothing else", () => {
    const wasp = engaged(game(), WASP);
    const { state, events } = villainPhase(wasp.state, MIGHTY, ORDER);
    expect(attacksBy(state, events, IRON_MAN)).toMatchObject([{ baseAtk: 1, boostIcons: 2, damageDealt: 3 }]);
    // It has no Boost ability, so Wasp's When Revealed is not resolved.
    expect(threatFrom(events, wasp.id)).toEqual([]);
    expect(inst(state, hero(state)).damage).toBe(
      inst(villainPhase(wasp.state, ADVANCE, ORDER).state, hero(state)).damage + 2,
    );
  });
});

describe("Earth's Mightiest Heroes (56077): each Avenger minion gains the printed keywords of each other Avenger minion", () => {
  it("is data: a side scheme with 3 threat (none per player), 2 boost icons and Hinder 1 per hero", () => {
    const card = dataOf(HEROES);
    expect([card.type, card.startingThreat, card.boostIcons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      2,
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  it("REVEALED it enters play with 3 threat plus 1 for Hinder (one hero)", () => {
    const run = villainPhase(game(), ADVANCE, HEROES);
    expect(inst(run.state, inPlayCard(run.state, HEROES)!).threat).toBe(4);
  });

  it("Wasp attacked beside U.S. Agent retaliates for 1 (his printed Retaliate 1); without the scheme she does not", () => {
    const agent = engaged(game(), US_AGENT);
    const wasp = engaged(agent.state, WASP);
    const without = attackWith(wasp.state, wasp.id);
    expect(inst(without.state, hero(without.state)).damage).toBe(0);
    const run = attackWith(withHeroes(wasp.state).state, wasp.id);
    expect(inst(run.state, hero(run.state)).damage).toBe(1);
  });

  it("U.S. Agent keeps exactly his own Retaliate 1: the others print none, and he is not his own source", () => {
    const wasp = engaged(game(), WASP);
    const yellowjacket = engaged(wasp.state, YELLOWJACKET);
    const agent = engaged(yellowjacket.state, US_AGENT);
    const run = attackWith(withHeroes(agent.state).state, agent.id);
    expect(inst(run.state, hero(run.state)).damage).toBe(1);
  });

  it("a minion that is not an Avenger gains nothing (Bullseye is attacked beside U.S. Agent: no retaliate)", () => {
    const agent = engaged(game(), US_AGENT);
    const bullseye = engaged(agent.state, BULLSEYE);
    const run = attackWith(withHeroes(bullseye.state).state, bullseye.id);
    expect(inst(run.state, hero(run.state)).damage).toBe(0);
    expect(inst(run.state, bullseye.id).damage).toBeGreaterThan(0);
  });

  it("with a single Avenger minion in play there is no other to take keywords from", () => {
    const wasp = engaged(game(), WASP);
    const run = attackWith(withHeroes(wasp.state).state, wasp.id);
    expect(inst(run.state, hero(run.state)).damage).toBe(0);
  });

  it("a minion revealed afterwards gains Toughness from U.S. Agent and enters with a tough status card; without the scheme it does not", () => {
    const agent = engaged(game(), US_AGENT);
    const plain = villainPhase(agent.state, ADVANCE, WASP, ORDER);
    expect(status(plain.state, inPlayCard(plain.state, WASP)!, "tough")).toBe(0);
    const run = villainPhase(withHeroes(agent.state).state, ADVANCE, WASP, ORDER);
    const wasp = inPlayCard(run.state, WASP)!;
    expect(status(run.state, wasp, "tough")).toBe(1);
  });

  it("the scheme defeated: the gained keywords are gone", () => {
    const agent = engaged(game(), US_AGENT);
    const wasp = engaged(agent.state, WASP);
    const staged = withHeroes(wasp.state);
    const thwarted = driveEventsPicking(
      WAVE10_DEPS,
      patchInstance(staged.state, staged.id, { threat: 1 }),
      firstLegal,
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: hero(staged.state),
        schemeInstanceId: staged.id,
      },
    );
    expect(types(thwarted.events, "schemeDefeated").map((e) => e.instanceId)).toEqual([staged.id]);
    const run = attackWith(thwarted.state, wasp.id);
    expect(inst(run.state, hero(run.state)).damage).toBe(0);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Iron Man ATK 1 + 2)", () => {
    const { state, events } = villainPhase(game(), HEROES, ORDER);
    expect(attacksBy(state, events, IRON_MAN)).toMatchObject([{ baseAtk: 1, boostIcons: 2, damageDealt: 3 }]);
  });
});
