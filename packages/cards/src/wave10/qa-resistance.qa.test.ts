/**
 * Rules QA, wave 10 part 2: the resistance side of Civil War (Captain America and Spider-Woman leaders, the Resistance
 * main schemes, the eight Resistance modular sets). Every test is a real Civil War game driven by real commands. A test
 * marked `it.fails` records a bug: it asserts what the printed card, MC56 or the RRG says, fails today, and flips to a
 * plain `it` when the script is fixed. The plain tests are interactions the module tests do not assert, each with the
 * source that makes the expected result right. Findings: docs/phase7-wave10-qa-resistance.md (ids R1 and up).
 *
 * Page numbers are the RRG 1.8 printed pages (docs/rules/mc_rulesreference_v18_compressed.pdf).
 */
import { activeEncounterDeckId, mainSchemeValue, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  stackEncounterDeck,
} from "../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand, withForm } from "../testing/staging.js";
import { attacksBy, codeOf, inPlayCard, onlyDeck, piles, schemesBy, types } from "../wave9/testing.js";
import {
  HULKLING_DECK,
  SPIDER_WOMAN_SCENARIO,
  WAVE10_DEPS,
  civilWarGame,
  civilWarHeroGame,
  engageMinion,
} from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

const D = WAVE10_DEPS;
const ADVANCE = "01186"; // no boost icon, no Boost ability
const ONE_ICON = "01188"; // Caught Off Guard: one boost icon
const GANG_UP = "01189"; // one boost icon
const GLIDE = "56179"; // Spider-Woman's side scheme: the harmless card to deal
const DEFEND = "56193";
const QUIET = ["56172b", "56173b"] as never;
const COUNTER_PAIR = ["56172b", "56202b"] as never;

const hero = (s: GameState, player: PlayerId = P1): InstanceId => identityOf(s, player);
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;
const damageOn = (s: GameState, id: InstanceId): number => inst(s, id).damage;

/** The first player ends the turn and the villain phase runs on the stacked deck (boost card first, then dealt cards). */
const villainPhase = (state: GameState, ...stack: string[]) =>
  driveEventsPicking(D, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));

/** Spider-Woman scenario, hero form, the quiet stage pair, her side scheme back in the deck. */
const swGame = (opts: Parameters<typeof civilWarHeroGame>[1] = {}) =>
  civilWarHeroGame(SPIDER_WOMAN_SCENARIO, { leaderSideScheme: "discarded", mainSchemeStageIds: QUIET, ...opts });

const setStatus = (s: GameState, id: InstanceId, name: "stunned" | "confused" | "tough", n: number): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [name]: n } });

const turnOrder = (s: GameState): PlayerId[] => {
  const step = s.step as unknown as { activePlayerId: PlayerId; remainingPlayerIds: PlayerId[] };
  return [step.activePlayerId, ...step.remainingPlayerIds];
};

// ---------------------------------------------------------------------------------------------------------------
// R1: Secret Avengers 56159
// ---------------------------------------------------------------------------------------------------------------
describe("R1 Secret Avengers 56159", () => {
  const game = () =>
    civilWarHeroGame(SPIDER_WOMAN_SCENARIO, {
      modularSetIds: ["secret_avengers", "defenders", "hells_kitchen"],
      leaderSideScheme: "discarded",
    });

  it("56159 Secret Avengers: 'searches the top 5 cards of the encounter deck' shuffles the deck afterwards (RRG 1.8 'Search' p. 39; FAQ 'Hawkeye's Quiver', Hero packs)", () => {
    const scheme = encounterCardInVillainArea(game(), "56159", 1);
    const state = stackEncounterDeck(scheme.state, ADVANCE, GLIDE, DEFEND, "56184", "56155", "56156");
    const ready = patchInstance(state, hero(state), { exhausted: false });
    const run = driveEventsPicking(D, ready, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: hero(state),
      schemeInstanceId: scheme.id,
    });
    // Control: the defeat resolved and the chosen card is held facedown by the leader.
    expect(inPlayCard(run.state, "56159")).toBeUndefined();
    expect(inst(run.state, villainOf(run.state)).boostCards).toHaveLength(1);
    // "If any portion of a deck is searched, upon completion ... shuffle that entire deck."
    expect(types(run.events, "deckShuffled").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// R2: Spider-Man 56180 "If no attack was made this way"
// ---------------------------------------------------------------------------------------------------------------
describe("R2 Spider-Man 56180", () => {
  const dealtFacedown = (events: Parameters<typeof types>[0]) =>
    types(events, "cardMoved").filter((e) => e.to.kind === "dealtEncounter" && e.cardId === ("56181" as never));

  function tangled(state: GameState): GameState {
    const deckId = activeEncounterDeckId(state);
    const pile = state.encounterDecks[deckId]!;
    const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === "56181")!;
    const host = hero(state);
    const out: GameState = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
    };
    return patchInstance(patchInstance(out, id, { faceup: true, attachedTo: host }), host, {
      attachments: [...inst(out, host).attachments, id],
    });
  }

  it("56180 Spider-Man: a Tangled Up hero, but his attack is replaced by a stun status card: 'if no attack was made this way' a copy is searched for and dealt (printed text; RRG 'Stun, Stunned')", () => {
    const withTangled = tangled(swGame());
    const spiderMan = piles(withTangled).deck.find((i) => codeOf(withTangled, i) === "56180")!;
    const stunned = setStatus(withTangled, spiderMan, "stunned", 1);
    const { state, events } = villainPhase(stunned, ADVANCE, "56180", GLIDE);
    // Control: the stun was used up instead of the attack, so he attacked nobody.
    expect(attacksBy(state, events, "56180")).toEqual([]);
    expect(inst(state, inPlayCard(state, "56180")!).statuses.stunned).toBe(0);
    // The printed condition ("no attack was made") holds: the second copy is found and dealt facedown to you.
    expect(dealtFacedown(events)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Interactions that pass: recorded so a later change cannot break them unseen
// ---------------------------------------------------------------------------------------------------------------
describe("Venom Blast 56177: ranged ignores retaliate (RRG 1.8 'Ranged' p. 36, 'Retaliate X' p. 38)", () => {
  /** Hulkling in hero form with Armored Shape 56034 (retaliate 1) in play; Spider-Woman stunned so only Venom Blast attacks. */
  function armored(stunSpiderWoman: boolean): GameState {
    const start = swGame({ starterDeckId: HULKLING_DECK });
    const played = playFromHand(D, start, "56034", 2);
    return stunSpiderWoman ? setStatus(played.state, villainOf(played.state), "stunned", 1) : played.state;
  }

  it("control: Spider-Woman's own attack on Hulkling with Armored Shape takes 1 damage from retaliate", () => {
    const run = villainPhase(armored(false), ADVANCE, GLIDE);
    expect(attacksBy(run.state, run.events, "56168")).toHaveLength(1);
    expect(damageOn(run.state, villainOf(run.state))).toBe(1);
  });

  it("Venom Blast with the one skill counter Finesse places (ranged): Hulkling's retaliate 1 does not hurt her", () => {
    const run = villainPhase(armored(true), "56177", GANG_UP);
    expect(attacksBy(run.state, run.events, "56168")).toHaveLength(1);
    expect(damageOn(run.state, villainOf(run.state))).toBe(0);
  });
});

describe("Superhero Jailbreak 56202b (RRG 1.8 'Unique Icon' p. 45, 'Each Player' p. 17, 'Encounter Deck' p. 17)", () => {
  /** Two heroes, stage 2B (Superhero Jailbreak) just revealed: the round after the one that completed stage 1. */
  function jailbreakStage(): GameState {
    const start = civilWarGame(SPIDER_WOMAN_SCENARIO, { twoPlayers: true, mainSchemeStageIds: COUNTER_PAIR });
    const heroes = withForm(withForm(start, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
    const target = mainSchemeValue(heroes, "targetThreat", D);
    const ready = patchInstance(heroes, heroes.mainScheme.instanceId, { threat: target - 3 });
    // Two boost cards, two dealt harmless cards, then everything the later steps need (onlyDeck drops all else).
    const stacked = onlyDeck(
      ready,
      ONE_ICON,
      GANG_UP,
      "56175",
      "56175",
      "56176",
      "56176",
      "56181",
      "56181",
      "56178",
      "56178",
      "56185",
      "56187",
      "56194",
      "56195",
    );
    const run = driveEventsPicking(D, stacked, firstLegal, ...turnOrder(stacked).map((p) => endTurn(p)));
    expect(run.state.mainScheme.stageIndex).toBe(7);
    return run.state;
  }

  it("a minion discarded that matches a unique ally in play is not put into play (Jessica Jones 56185 against the ally 01059)", () => {
    const stage = jailbreakStage();
    const first = stage.firstPlayerId;
    const withAlly = playFromHand(D, withForm(stage, { heroForm: 0 }, first), "01059", 3, firstLegal, first);
    expect(inPlayCard(withAlly.state, "01059")).toBeDefined();
    const deck = onlyDeck(withAlly.state, "56185", "56176", "56181", "56178", "56187", "56194", "56195");
    const run = driveEventsPicking(D, deck, firstLegal, ...turnOrder(deck).map((p) => endTurn(p)));
    expect(inPlayCard(run.state, "56185")).toBeUndefined();
    expect(piles(run.state).discard.map((i) => codeOf(run.state, i))).toContain("56185");
    expect(types(run.events, "uniqueEntryBlocked" as never)).toHaveLength(1);
  });

  it("the encounter deck empties while the first player discards: it is reset (one acceleration token) and the second player resumes", () => {
    const stage = jailbreakStage();
    const pile = piles(stage);
    const all = [...pile.deck, ...pile.discard];
    const last = all.find((i) => codeOf(stage, i) === "56187")!;
    const rest = all.filter((i) => i !== last && ["56185", "56194", "56195", "56176"].includes(codeOf(stage, i)));
    const deckId = activeEncounterDeckId(stage);
    const oneCard: GameState = {
      ...stage,
      encounterDecks: { ...stage.encounterDecks, [deckId]: { deck: [last], discard: rest } },
    };
    const quiet = patchInstance(oneCard, oneCard.mainScheme.instanceId, { threat: 0 });
    const run = driveEventsPicking(D, quiet, firstLegal, ...turnOrder(quiet).map((p) => endTurn(p)));
    const discarded = types(run.events, "cardMoved").filter(
      (e) => e.from.kind === "encounterDeck" && e.to.kind === "encounterDiscard",
    );
    expect(discarded[0]!.cardId).toBe("56187");
    expect(discarded.length).toBeGreaterThanOrEqual(2);
    expect(types(run.events, "accelerationTokenAdded")).toHaveLength(1);
  });
});

describe("Neighborhood Protectors 56173b with fewer side schemes than players (printed: one for each player)", () => {
  it("two players, one side scheme left in the deck and discard pile: the first player's pick is dealt, the second gets none, nothing stalls", () => {
    const start = civilWarGame(SPIDER_WOMAN_SCENARIO, { twoPlayers: true, mainSchemeStageIds: QUIET });
    const heroes = withForm(withForm(start, { heroForm: 0 }, P1), { heroForm: 0 }, P2);
    const target = mainSchemeValue(heroes, "targetThreat", D);
    const ready = patchInstance(heroes, heroes.mainScheme.instanceId, { threat: target - 3 });
    const deck = onlyDeck(ready, ONE_ICON, GANG_UP, "56175", "56175", "56183", "56176", "56176", "56181", "56181");
    const run = driveEventsPicking(D, deck, firstLegal, ...turnOrder(deck).map((p) => endTurn(p)));
    expect(run.state.mainScheme.stageIndex).toBe(3);
    expect(run.state.pendingChoice).toBeNull();
    const dealt = types(run.events, "cardMoved").filter((e) => e.to.kind === "dealtEncounter");
    expect(dealt.filter((e) => e.cardId === ("56183" as never))).toHaveLength(1);
  });
});

describe("Street Defenders 56187 with a villainous minion (RRG 1.8 'Villainous' p. 47; printed: 'Do not give it a boost card')", () => {
  it("Namor activates against his player and is given no boost card by it (his other activation, the control, is)", () => {
    const start = swGame({ modularSetIds: ["namor_modular", "defenders", "hells_kitchen"] });
    const withNamor = engageMinion(start, "56160", "namor1", P1);
    // Spider-Woman's boost, Namor's boost (a villainous activation), the dealt Street Defenders, and a spare.
    const run = driveEventsPicking(
      D,
      stackEncounterDeck(withNamor, ADVANCE, GANG_UP, "56187", ONE_ICON),
      firstLegal,
      endTurn(P1),
    );
    const attacks = attacksBy(run.state, run.events, "56160");
    expect(attacks).toMatchObject([{ boostIcons: 1 }, { boostIcons: 0 }]);
    expect(types(run.events, "boostCardFlipped")).toHaveLength(2);
  });
});

describe("Imperius Rex! 56163 boost on a scheme activation (printed: 'Give the activating enemy an additional boost card')", () => {
  it("an alter-ego player: the leader's scheme turns up two boost cards, 1 icon each", () => {
    const start = civilWarGame(SPIDER_WOMAN_SCENARIO, {
      leaderSideScheme: "discarded",
      mainSchemeStageIds: QUIET,
      modularSetIds: ["namor_modular", "defenders", "hells_kitchen"],
    });
    const run = villainPhase(start, "56163", ONE_ICON, GLIDE);
    expect(types(run.events, "boostCardFlipped")).toHaveLength(2);
    expect(schemesBy(run.state, run.events, "56168")).toMatchObject([{ baseSch: 1, boostIcons: 2 }]);
  });
});

describe("Freedom Fighters 56153 resolving 'reveal this card' boosts of minions already in play (ruling June 25, 2026 R5)", () => {
  it("Cloak and Dagger in play: each is revealed where it is, so each When Revealed resolves again (2 threat; 2 damage to a hero)", () => {
    const start = swGame({ modularSetIds: ["new_avengers", "cloak_and_dagger_modular", "defenders"] });
    const staged = engageMinion(engageMinion(start, "56194", "cloak1", P1), "56195", "dagger1", P1);
    const withFighters = villainPhase(staged, ADVANCE, "56153", GLIDE);
    const baseline = villainPhase(staged, ADVANCE, GLIDE);
    const threat = (s: GameState) => inst(s, s.mainScheme.instanceId).threat;
    // Open Rebellion 56172b: 1 threat for the revealed treachery; Cloak's When Revealed: 2.
    expect(threat(withFighters.state)).toBe(threat(baseline.state) + 3);
    expect(damageOn(withFighters.state, hero(withFighters.state))).toBe(
      damageOn(baseline.state, hero(baseline.state)) + 2,
    );
  });
});
