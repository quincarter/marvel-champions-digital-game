import { CORE_CARDS, CW_CARDS, encounterSetId, trait } from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  hasKeyword,
  maxHitPoints,
  traitsOf,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { competitiveOnlyTexts, validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  P2,
  P3,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand } from "../../../testing/staging.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  IRON_MAN,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  heroForm,
  heroThwarts,
  inDiscard,
  inPlayCard,
  piles,
  revealedCodes,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS, engageMinion } from "../../testing.js";
import { MODULAR_THE_INITIATIVE, MODULAR_THE_INITIATIVE_SKIPPED } from "./the-initiative.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Initiative modular set (56078 Doc Samson, 56079 Hellcat, 56080 Drafted, 56081 Mighty Avengers, 56082 The Fifty
 * State Initiative), docs/phase7-wave10.md sections 3.4 and 3.23. The Civil War scenario builder does not exist yet, so
 * the set is tested inside Core's Rhino scenario against Core starter decks, with the set's five cards added to the
 * encounter deck by hand. A minion that is not Villainous is dealt no boost card when it activates (RRG 1.8
 * "Villainous", p. 47), so only Rhino's activation takes a boost card in these games.
 */
const SAMSON = "56078";
const HELLCAT = "56079";
const DRAFTED = "56080";
const MIGHTY = "56081";
const INITIATIVE = "56082";
const SET = [SAMSON, HELLCAT, DRAFTED, MIGHTY, INITIATIVE];
const RHINO = "01094";
const SHOCKER = "01103"; // Core minion, ATK 2, SCH 1, 3 hit points; When Revealed: 1 damage to each hero
const HAWKEYE = "57056"; // Synthezoid minion; When Revealed: choose and discard an upgrade you control
const SANDMAN = "01102"; // Core minion, ATK 3, SCH 2, 4 hit points, Toughness, no When Revealed ability
const BLANK_B = "01104"; // Core treachery with no boost icons
const BLACK_CAT = "01002"; // Core ally, cost 2
const REFS = [
  "56078.when-revealed",
  "56078.boost",
  "56079.when-revealed",
  "56079.boost",
  "56080.drafted-constant",
  "56080.when-revealed",
  "56081.when-revealed",
  "56082.when-defeated",
];
const AVENGER = trait("AVENGER");

type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL | typeof IRON_MAN;
const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;

/** Rhino's game against the Core decks (hero form) with one copy of each of the set's cards in the encounter deck. */
function game(seats: readonly Seat[] = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const copies = CW_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("the_initiative")),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
  return heroForm(settled, ...seats.map((_, i) => [P1, P2, P3][i]!));
}
const alterEgoGame = (): GameState => {
  const s = game();
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, identity: { ...p.identity, form: "alterEgo" as const } })),
  } as GameState;
};

/** Every player ends the turn and the villain phase runs on the stacked deck (top first: Rhino's boost, then the rest). */
function villainPhase(state: GameState, stack: readonly string[]) {
  return driveEventsPicking(
    WAVE10_DEPS,
    stackEncounterDeck(state, ...stack),
    firstLegal,
    ...state.players.map((p) => endTurn(p.playerId)),
  );
}

/** The first copy of `code` in the encounter deck or discard pile removed from it (by surgery). */
function takeFromEncounter(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
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
    },
  };
}
/** A card of the set put straight into play engaged with `player` (surgery, no reveal): the set's real instance. */
function minionInPlay(
  state: GameState,
  code: string,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const taken = takeFromEncounter(state, code);
  const placed: GameState = {
    ...taken.state,
    players: taken.state.players.map((p) =>
      p.playerId === player ? { ...p, playArea: [...p.playArea, taken.id] } : p,
    ),
  };
  return {
    id: taken.id,
    state: patchInstance(placed, taken.id, { faceup: true, engagedWith: player, controllerId: null }),
  };
}
/** `code` of the set moved to the top of the encounter discard pile (the array runs newest-first). */
function discarded(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const taken = takeFromEncounter(state, code);
  const deckId = activeEncounterDeckId(taken.state);
  const pile = taken.state.encounterDecks[deckId]!;
  return {
    id: taken.id,
    state: {
      ...taken.state,
      encounterDecks: {
        ...taken.state.encounterDecks,
        [deckId]: { deck: pile.deck, discard: [taken.id, ...pile.discard] },
      },
    },
  };
}
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "confused" | "tough"): GameState =>
  patchInstance(s, id, { statuses: { ...inst(s, id).statuses, [status]: 1 } });
const hero = (s: GameState, player: PlayerId = P1) => identityOf(s, player);
const statuses = (s: GameState, player: PlayerId = P1) => inst(s, hero(s, player)).statuses;
const attachedCodes = (s: GameState, host: InstanceId) => inst(s, host).attachments.map((a) => codeOf(s, a));
const copies = (s: GameState, code: string) =>
  Object.keys(s.instances).filter((i) => codeOf(s, i as InstanceId) === code) as InstanceId[];

describe("registry", () => {
  it("registers the eight refs of the five cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(MODULAR_THE_INITIATIVE).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MODULAR_THE_INITIATIVE)) expect(validateDefinition(def), id).toEqual([]);
    expect(MODULAR_THE_INITIATIVE_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    expect(MODULAR_THE_INITIATIVE["56078.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(MODULAR_THE_INITIATIVE["56078.boost"]!.trigger).toMatchObject({ kind: "boost" });
    expect(MODULAR_THE_INITIATIVE["56079.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(MODULAR_THE_INITIATIVE["56079.boost"]!.trigger).toMatchObject({ kind: "boost" });
    expect(MODULAR_THE_INITIATIVE["56080.drafted-constant"]!.trigger).toMatchObject({ kind: "constant" });
    expect(MODULAR_THE_INITIATIVE["56080.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(MODULAR_THE_INITIATIVE["56081.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(MODULAR_THE_INITIATIVE["56082.when-defeated"]!.trigger).toMatchObject({ kind: "whenDefeated" });
  });

  it("setup: one copy of each card is in the encounter deck", () => {
    const s = game();
    expect(SET.map((code) => copies(s, code).length)).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("Doc Samson (56078)", () => {
  it("is data: an Avenger Gamma unique minion, ATK 2, SCH 2, 4 hit points, no boost icon but a star, Guard", () => {
    const card = dataOf(SAMSON);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      2,
      2,
      4,
      0,
      true,
      true,
    ]);
    expect(card.traits).toEqual([trait("AVENGER"), trait("GAMMA")]);
    expect(card.keywords).toEqual([{ name: "guard" }]);
  });

  it("WHEN REVEALED: you are confused, and no threat is placed when you were not already", () => {
    const start = game();
    const control = villainPhase(start, [BLANK, FILLER_B]);
    const run = villainPhase(start, [BLANK, SAMSON, FILLER_A]);
    expect(statuses(control.state).confused).toBe(0);
    expect(statuses(run.state).confused).toBe(1);
    expect(mainThreat(run.state)).toBe(mainThreat(control.state));
    const samson = inPlayCard(run.state, SAMSON)!;
    expect(inst(run.state, samson).engagedWith).toBe(P1);
    expect(hasKeyword(run.state, samson, "guard", WAVE10_DEPS)).toBe(true);
  });

  it("WHEN REVEALED: if you were already confused, 2 threat on the main scheme, and you stay confused (one status card)", () => {
    const start = game();
    const confused = withStatus(start, hero(start), "confused");
    const control = villainPhase(confused, [BLANK, FILLER_B]);
    const run = villainPhase(confused, [BLANK, SAMSON, FILLER_A]);
    expect(statuses(run.state).confused).toBe(1);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(2);
  });

  it("WHEN REVEALED in alter-ego form reads the same way", () => {
    const start = alterEgoGame();
    const run = villainPhase(start, [BLANK, SAMSON, FILLER_A]);
    expect(statuses(run.state).confused).toBe(1);
    const again = villainPhase(withStatus(start, hero(start), "confused"), [BLANK, SAMSON, FILLER_A]);
    const control = villainPhase(withStatus(start, hero(start), "confused"), [BLANK, FILLER_B]);
    expect(mainThreat(again.state) - mainThreat(control.state)).toBe(2);
  });

  it("WHEN REVEALED in a 3-player game: only the revealing player (P3) is confused, whoever was confused before", () => {
    const start = game([SPIDER_MAN, CAPTAIN_MARVEL, IRON_MAN]);
    const run = villainPhase(start, [BLANK, BLANK, BLANK_B, FILLER_A, FILLER_B, SAMSON]);
    expect(inst(run.state, inPlayCard(run.state, SAMSON)!).engagedWith).toBe(P3);
    expect([P1, P2, P3].map((p) => statuses(run.state, p).confused)).toEqual([0, 0, 1]);
    // P1, not the revealing player, was already confused: P3's reveal places no threat.
    const marked = withStatus(start, hero(start, P1), "confused");
    const other = villainPhase(marked, [BLANK, BLANK, BLANK_B, FILLER_A, FILLER_B, SAMSON]);
    expect([P1, P2, P3].map((p) => statuses(other.state, p).confused)).toEqual([1, 0, 1]);
    expect(mainThreat(other.state)).toBe(mainThreat(run.state));
  });

  it("BOOST: the player the activation is against is confused (Rhino ATK 2, no icons)", () => {
    const run = villainPhase(game(), [SAMSON, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(statuses(run.state).confused).toBe(1);
    expect(inPlayCard(run.state, SAMSON)).toBeUndefined();
  });

  it("BOOST: an already confused player stays confused and no threat is placed", () => {
    const start = game();
    const confused = withStatus(start, hero(start), "confused");
    const control = villainPhase(confused, [BLANK, FILLER_A]);
    const run = villainPhase(confused, [SAMSON, FILLER_A]);
    expect(statuses(run.state).confused).toBe(1);
    expect(mainThreat(run.state)).toBe(mainThreat(control.state));
  });

  it("BOOST in a 2-player game: Rhino's second activation is against P2, who is the one confused", () => {
    const start = game([SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = villainPhase(start, [BLANK, SAMSON, FILLER_A, FILLER_B]);
    expect([P1, P2].map((p) => statuses(run.state, p).confused)).toEqual([0, 1]);
  });
});

describe("Hellcat (56079)", () => {
  it("is data: an Avenger unique minion, ATK 2, SCH 1, 3 hit points, no boost icon but a star, Quickstrike", () => {
    const card = dataOf(HELLCAT);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      "minion",
      2,
      1,
      3,
      0,
      true,
      true,
    ]);
    expect(card.traits).toEqual([trait("AVENGER")]);
    expect(card.keywords).toEqual([{ name: "quickstrike" }]);
  });

  it("WHEN REVEALED (hero): you are stunned and take no indirect damage, then Quickstrike attacks (2 damage; RRG p. 36)", () => {
    const start = game();
    const run = villainPhase(start, [BLANK, HELLCAT, FILLER_A]);
    const hellcat = inPlayCard(run.state, HELLCAT)!;
    expect(inst(run.state, hellcat).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, HELLCAT)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(statuses(run.state).stunned).toBe(1);
    // Rhino 2 + Hellcat's Quickstrike 2, and nothing from the indirect damage.
    expect(inst(run.state, hero(run.state)).damage).toBe(4);
  });

  // RRG 1.8 "Quickstrike" (p. 36): "If a minion with the quickstrike keyword is being revealed, the quickstrike keyword
  // resolves after any 'When Revealed' abilities on that minion are resolved" (the owner's answer 30B, 2026-10-12, over
  // FFG's February 28, 2026 - Ruling 4, which named Hellcat).
  it("WHEN REVEALED resolves before her Quickstrike (RRG p. 36): the hero holds the stunned card when her attack initiates", () => {
    const run = villainPhase(game(), [BLANK, HELLCAT, FILLER_A]);
    const hellcat = inPlayCard(run.state, HELLCAT)!;
    const at = (pred: (e: (typeof run.events)[number]) => boolean) => run.events.findIndex(pred);
    const stunned = at((e) => e.type === "statusGiven" && e.status === "stunned" && e.instanceId === hero(run.state));
    const whenRevealed = at((e) => e.type === "abilityResolved" && e.abilityId === "56079.when-revealed");
    const initiated = at(
      (e) =>
        e.type === "triggerEvent" &&
        e.phase === "initiated" &&
        e.event.kind === "enemyAttack" &&
        e.event.enemyInstanceId === hellcat,
    );
    expect(stunned).toBeGreaterThanOrEqual(0);
    expect(whenRevealed).toBeGreaterThanOrEqual(0);
    expect(stunned).toBeLessThan(initiated);
    expect(whenRevealed).toBeLessThan(initiated);
    expect(attacksBy(run.state, run.events, HELLCAT)).toHaveLength(1);
  });

  it("WHEN REVEALED resolves before her Quickstrike (RRG p. 36): already stunned, the 2 indirect damage lands before her attack's 2", () => {
    const start = game();
    const run = villainPhase(withStatus(start, hero(start), "stunned"), [BLANK, HELLCAT, FILLER_A]);
    const hellcat = inPlayCard(run.state, HELLCAT)!;
    const hits = run.events.flatMap((e) =>
      e.type === "damageDealt" && e.targetInstanceId === hero(run.state) ? [[e.sourceInstanceId, e.amount]] : [],
    );
    // Rhino's attack, then her When Revealed's indirect damage, then her own attack.
    expect(hits.slice(-2).map(([, amount]) => amount)).toEqual([2, 2]);
    const whenRevealed = run.events.findIndex(
      (e) => e.type === "abilityResolved" && e.abilityId === "56079.when-revealed",
    );
    const attacked = run.events.findIndex((e) => e.type === "attackResolved" && e.enemyInstanceId === hellcat);
    expect(whenRevealed).toBeGreaterThanOrEqual(0);
    expect(whenRevealed).toBeLessThan(attacked);
  });

  it("WHEN REVEALED (hero): if you were already stunned you take 2 indirect damage on top, and stay stunned", () => {
    const start = game();
    const stunned = withStatus(start, hero(start), "stunned");
    const run = villainPhase(stunned, [BLANK, HELLCAT, FILLER_A]);
    expect(statuses(run.state).stunned).toBe(1);
    // Rhino 2 + Quickstrike 2 + 2 indirect.
    expect(inst(run.state, hero(run.state)).damage).toBe(6);
  });

  it("WHEN REVEALED (alter-ego): you are stunned; Quickstrike does nothing against an alter-ego (RRG p. 36)", () => {
    const run = villainPhase(alterEgoGame(), [BLANK, HELLCAT, FILLER_A]);
    expect(statuses(run.state).stunned).toBe(1);
    expect(attacksBy(run.state, run.events, HELLCAT)).toEqual([]);
  });

  it("WHEN REVEALED with an ally in play: the already stunned player divides the 2 indirect damage (asked once)", () => {
    const start = game();
    const withAlly = playFromHand(WAVE10_DEPS, start, BLACK_CAT, 2);
    const stunned = withStatus(withAlly.state, hero(withAlly.state), "stunned");
    const run = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(stunned, BLANK, HELLCAT, FILLER_A),
      firstLegal,
      endTurn(P1),
    );
    const damage = inst(run.state, hero(run.state)).damage + inst(run.state, withAlly.id).damage;
    // Rhino 2 and Quickstrike 2 on the hero (the ally does not defend), 2 indirect among hero and ally.
    expect(damage).toBe(6);
  });

  it("WHEN REVEALED in a 2-player game: only the revealing player (P2) is stunned", () => {
    const start = game([SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = villainPhase(start, [BLANK, BLANK_B, FILLER_A, HELLCAT]);
    expect(inst(run.state, inPlayCard(run.state, HELLCAT)!).engagedWith).toBe(P2);
    expect([P1, P2].map((p) => statuses(run.state, p).stunned)).toEqual([0, 1]);
  });

  it("BOOST: the player the activation is against is stunned (Rhino ATK 2, no icons)", () => {
    const run = villainPhase(game(), [HELLCAT, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(statuses(run.state).stunned).toBe(1);
  });
});

describe("Drafted (56080)", () => {
  it("is data: an attachment with 1 boost icon and no attach text of its own", () => {
    const card = dataOf(DRAFTED);
    expect([card.type, card.boostIcons, card.attachesTo, card.keywords]).toEqual(["attachment", 1, undefined, []]);
  });

  it("WHEN REVEALED (cooperative): discards until a minion is discarded, reveals it and attaches itself to it", () => {
    // Rhino's boost; Drafted dealt; then the discard run: a filler (discarded), Sandman (found).
    const run = villainPhase(game(), [BLANK, DRAFTED, FILLER_A, SANDMAN, FILLER_B]);
    const sandman = inPlayCard(run.state, SANDMAN)!;
    expect(inst(run.state, sandman).engagedWith).toBe(P1);
    expect(attachedCodes(run.state, sandman)).toEqual([DRAFTED]);
    expect(inPlayCard(run.state, DRAFTED)).toBe(inst(run.state, sandman).attachments[0]);
    expect(inDiscard(run.state, FILLER_A)).toHaveLength(1);
    expect(inDiscard(run.state, DRAFTED)).toHaveLength(0);
    expect(inDiscard(run.state, SANDMAN)).toHaveLength(0);
    expect(revealedCodes(run.state, run.events)).toEqual([DRAFTED, SANDMAN]);
  });

  it("WHEN REVEALED: a minion on top is found at once (nothing else is discarded)", () => {
    const run = villainPhase(game(), [BLANK, DRAFTED, SHOCKER, FILLER_A]);
    expect(attachedCodes(run.state, inPlayCard(run.state, SHOCKER)!)).toEqual([DRAFTED]);
    expect(inDiscard(run.state, FILLER_A)).toHaveLength(0);
  });

  it("WHEN REVEALED: the revealed minion resolves its own When Revealed (Doc Samson confuses you) with Drafted on him", () => {
    const run = villainPhase(game(), [BLANK, DRAFTED, FILLER_A, SAMSON, FILLER_B]);
    const samson = inPlayCard(run.state, SAMSON)!;
    expect(attachedCodes(run.state, samson)).toEqual([DRAFTED]);
    expect(statuses(run.state).confused).toBe(1);
    expect(maxHitPoints(run.state, samson, WAVE10_DEPS)).toBe(6);
  });

  it("CONSTANT: the attached minion gets +2 hit points and the Avenger trait; other minions do not", () => {
    const run = villainPhase(game(), [BLANK, DRAFTED, SANDMAN, FILLER_A]);
    const sandman = inPlayCard(run.state, SANDMAN)!;
    expect(maxHitPoints(run.state, sandman, WAVE10_DEPS)).toBe(6);
    expect(traitsOf(run.state, sandman, WAVE10_DEPS)).toContain(AVENGER);
    const other = engageMinion(run.state, SHOCKER, "shocker");
    expect(maxHitPoints(other, "shocker" as InstanceId, WAVE10_DEPS)).toBe(3);
    expect(traitsOf(other, "shocker" as InstanceId, WAVE10_DEPS)).not.toContain(AVENGER);
  });

  it("CONSTANT: without Drafted the same minion has neither", () => {
    const start = engageMinion(game(), SANDMAN, "sandman");
    expect(maxHitPoints(start, "sandman" as InstanceId, WAVE10_DEPS)).toBe(4);
    expect(traitsOf(start, "sandman" as InstanceId, WAVE10_DEPS)).not.toContain(AVENGER);
  });

  it("WHEN REVEALED in a 3-player game: P2 reveals it, the minion engages P2, and nobody is asked", () => {
    const start = game([SPIDER_MAN, CAPTAIN_MARVEL, IRON_MAN]);
    // Rhino's three boosts; the deal is P1 a filler, P2 Drafted, P3 a filler; the discard run takes Sandman next.
    const run = villainPhase(start, [BLANK, BLANK, BLANK_B, FILLER_A, DRAFTED, FILLER_B, SANDMAN]);
    const sandman = inPlayCard(run.state, SANDMAN)!;
    expect(inst(run.state, sandman).engagedWith).toBe(P2);
    expect(attachedCodes(run.state, sandman)).toEqual([DRAFTED]);
    expect(run.state.pendingChoice).toBeNull();
  });

  it("the competitive sentence is kept in full as the branch of 'In competitive mode' that a cooperative game never resolves", () => {
    const definition = MODULAR_THE_INITIATIVE["56080.when-revealed"]!;
    expect(competitiveOnlyTexts(definition)).toEqual([
      "In competitive mode, the enemy team attaches Drafted to a minion engaged with them and that minion engages you.",
    ]);
    expect(definition.effects[0]).toMatchObject({ kind: "if", condition: { kind: "gameMode", is: "competitive" } });
  });

  it("BOOST: 1 icon on the activating enemy's attack (Rhino ATK 2 + 1)", () => {
    const run = villainPhase(game(), [DRAFTED, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
    expect(inPlayCard(run.state, DRAFTED)).toBeUndefined();
  });
});

describe("Mighty Avengers (56081)", () => {
  it("is data: a treachery with 2 boost icons", () => {
    const card = dataOf(MIGHTY);
    expect([card.type, card.boostIcons, card.starIcon, card.keywords]).toEqual(["treachery", 2, undefined, []]);
  });

  it("WHEN REVEALED with no minion in play: nothing resolves, so it gains surge (the next card is revealed too)", () => {
    const run = villainPhase(game(), [BLANK, MIGHTY, FILLER_A]);
    expect(revealedCodes(run.state, run.events)).toEqual([MIGHTY, FILLER_A]);
  });

  it("WHEN REVEALED with a minion that has no When Revealed ability: nothing resolves, so it still gains surge", () => {
    const start = engageMinion(game(), SANDMAN, "sandman");
    const run = villainPhase(start, [BLANK, MIGHTY, FILLER_A]);
    expect(revealedCodes(run.state, run.events)).toEqual([MIGHTY, FILLER_A]);
  });

  // RRG 1.8 "Resolve" (p. 37); FFG ruling on Citywide Crisis (RRG 1.0-1.4 era): a When Revealed that changes nothing
  // was not resolved, so it is not counted. Hawkeye (Synthezoid Smackdown 57056): "discard an upgrade you control".
  it("WHEN REVEALED with only Hawkeye in play and no upgrade: his discard changes nothing, so it gains surge", () => {
    const start = engageMinion(game(), HAWKEYE, "hawk");
    const run = villainPhase(start, [BLANK, MIGHTY, FILLER_A]);
    expect(revealedCodes(run.state, run.events)).toEqual([MIGHTY, FILLER_A]);
  });

  it("WHEN REVEALED with a no-op Hawkeye and Doc Samson: Samson's confused counts, so there is no surge", () => {
    const placed = minionInPlay(engageMinion(game(), HAWKEYE, "hawk"), SAMSON);
    const run = villainPhase(placed.state, [BLANK, MIGHTY, FILLER_A]);
    expect(statuses(run.state).confused).toBe(1);
    expect(revealedCodes(run.state, run.events)).toEqual([MIGHTY]);
  });

  it("WHEN REVEALED with Doc Samson in play: his When Revealed resolves (you are confused) and there is no surge", () => {
    const placed = minionInPlay(game(), SAMSON);
    const run = villainPhase(placed.state, [BLANK, MIGHTY, FILLER_A]);
    expect(statuses(run.state).confused).toBe(1);
    expect(revealedCodes(run.state, run.events)).toEqual([MIGHTY]);
    expect(inPlayCard(run.state, SAMSON)).toBe(placed.id);
  });

  it("WHEN REVEALED with Doc Samson in play and you already confused: his ability places 2 threat", () => {
    const placed = minionInPlay(game(), SAMSON);
    const confused = withStatus(placed.state, hero(placed.state), "confused");
    const control = villainPhase(confused, [BLANK, FILLER_B]);
    const run = villainPhase(confused, [BLANK, MIGHTY, FILLER_A]);
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(2);
  });

  it("WHEN REVEALED resolves each minion's ability: Doc Samson and Hellcat confuse and stun you together", () => {
    const first = minionInPlay(game(), SAMSON);
    const both = minionInPlay(first.state, HELLCAT);
    // Both minions are engaged and activate, but neither is Villainous: Rhino alone is dealt a boost card.
    const run = villainPhase(both.state, [BLANK, MIGHTY, FILLER_A]);
    expect(statuses(run.state)).toMatchObject({ confused: 1, stunned: 1 });
    expect(revealedCodes(run.state, run.events)).toEqual([MIGHTY]);
  });

  it("WHEN REVEALED in a 2-player game: each minion's ability resolves for the player who revealed Mighty Avengers (P2)", () => {
    const placed = minionInPlay(game([SPIDER_MAN, CAPTAIN_MARVEL]), SAMSON, P1);
    const run = villainPhase(placed.state, [BLANK, BLANK_B, FILLER_A, MIGHTY, FILLER_B]);
    expect([P1, P2].map((p) => statuses(run.state, p).confused)).toEqual([0, 1]);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Rhino ATK 2 + 2)", () => {
    const run = villainPhase(game(), [MIGHTY, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
  });
});

describe("The Fifty State Initiative (56082)", () => {
  it("is data: a side scheme with 3 threat (none per player), a crisis icon, 2 boost icons and Hinder 1 per hero", () => {
    const card = dataOf(INITIATIVE);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      ["crisis"],
      2,
      [{ name: "hinder", value: 0, perPlayer: 1 }],
    ]);
  });

  it("REVEALED it enters play with 3 threat plus 1 for Hinder (one hero)", () => {
    const run = villainPhase(game(), [BLANK, INITIATIVE, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, INITIATIVE)!).threat).toBe(4);
  });

  /** Doc Samson, Hellcat (Avengers) and Shocker, Sandman (not) in the encounter discard pile; the scheme at 1 threat. */
  function arena(threat = 1) {
    let state = game();
    const ids: Record<string, InstanceId> = {};
    for (const code of [SAMSON, HELLCAT, SHOCKER, SANDMAN]) {
      const moved = discarded(state, code);
      state = moved.state;
      ids[code] = moved.id;
    }
    const placed = encounterCardInVillainArea(state, INITIATIVE, threat);
    return { state: placed.state, scheme: placed.id, ids };
  }

  it("WHEN DEFEATED: each Avenger minion in the encounter discard pile is shuffled into the encounter deck, the others stay", () => {
    const { state, scheme, ids } = arena();
    const deckBefore = piles(state).deck.length;
    const run = heroThwarts(WAVE10_DEPS, state, scheme);
    expect(inPlayCard(run.state, INITIATIVE)).toBeUndefined();
    const after = piles(run.state);
    expect(after.deck).toEqual(expect.arrayContaining([ids[SAMSON]!, ids[HELLCAT]!]));
    expect(after.deck).toHaveLength(deckBefore + 2);
    expect(after.discard).not.toContain(ids[SAMSON]);
    expect(after.discard).not.toContain(ids[HELLCAT]);
    expect(after.discard).toEqual(expect.arrayContaining([ids[SHOCKER]!, ids[SANDMAN]!]));
    // The defeated scheme itself goes to the discard pile; nothing is revealed.
    expect(after.discard).toContain(scheme);
    expect(after.discard).toHaveLength(3);
  });

  it("WHEN DEFEATED: with no Avenger minion in the discard pile nothing is shuffled in", () => {
    const base = game();
    const shocker = discarded(base, SHOCKER);
    const placed = encounterCardInVillainArea(shocker.state, INITIATIVE, 1);
    const deckBefore = piles(placed.state).deck.length;
    const run = heroThwarts(WAVE10_DEPS, placed.state, placed.id);
    expect(piles(run.state).deck).toHaveLength(deckBefore);
    expect(piles(run.state).discard).toEqual(expect.arrayContaining([shocker.id]));
  });

  it("a thwart that leaves threat on it shuffles nothing", () => {
    const { state, scheme, ids } = arena(2);
    const run = heroThwarts(WAVE10_DEPS, state, scheme);
    expect(inst(run.state, scheme).threat).toBe(1);
    expect(piles(run.state).discard).toEqual(expect.arrayContaining([ids[SAMSON]!, ids[HELLCAT]!]));
  });

  it("BOOST: 2 icons on the activating enemy's attack (Rhino ATK 2 + 2)", () => {
    const run = villainPhase(game(), [INITIATIVE, FILLER_A]);
    expect(attacksBy(run.state, run.events, RHINO)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
  });
});
