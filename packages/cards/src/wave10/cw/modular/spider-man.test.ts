import { CW_CARDS } from "@mc/content";
import { activeEncounterDeckId, createGame, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
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
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { attacksBy, codeOf, flippedBoosts, inPlayCard, piles, revealedCodes, types } from "../../../wave9/testing.js";
import {
  HULKLING_DECK,
  SPIDER_WOMAN_SCENARIO,
  WAVE10_DEPS,
  civilWarConfig,
  civilWarHeroGame,
  cwSeat,
  withoutLeaderSideScheme,
} from "../../testing.js";
import { MODULAR_SPIDER_MAN, MODULAR_SPIDER_MAN_SKIPPED } from "./spider-man.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Spider-Man modular set (56180 Spider-Man, 56181 Tangled Up, 56182 Spectacular!, 56183 Neighborhood Hero),
 * docs/phase7-wave10.md sections 3.4 and 3.21. Every test is a real game in the `resistance-spider-woman` scenario
 * (Spider-Man is one of its modular sets), seated with the Tigra precon, with the quiet stage pair (Open Rebellion
 * `56172b`, Neighborhood Protectors `56173b`). Cooperatively the enemy leader is Spider-Woman and there is no "your
 * leader" (MC56 p. 6). She starts with Finesse and no skill counter; a boost card is not a revealed card, so her
 * interrupt does not place any.
 *
 * The villain phase draws the villain's boost card first, then deals each player a card (RRG 1.8 "Villain Phase"), so a
 * stack reads "boost, dealt". Advance 01186 prints no boost icon and no Boost ability. Self-propelled Glide 56179
 * (Spider-Woman's own side scheme) is the harmless card to deal; Defenders' Street Defenders is avoided.
 */
const SPIDER_MAN = "56180";
const TANGLED_UP = "56181";
const SPECTACULAR = "56182";
const NEIGHBORHOOD = "56183";
const SPIDER_WOMAN = "56168";
const ADVANCE = "01186";
const ONE_ICON = "01188";
const GLIDE = "56179";
const DEFEND = "56193"; // Hell's Kitchen's side scheme: a second harmless card to deal
const SET = [SPIDER_MAN, TANGLED_UP, SPECTACULAR, NEIGHBORHOOD];
const REFS = [
  "56180.when-revealed",
  "56181.tangled-up-forced-interrupt",
  "56181.boost",
  "56182.when-revealed",
  "56183.when-revealed",
];
const QUIET = ["56172b", "56173b"] as never;

const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const hero = (s: GameState, player: PlayerId = P1) => identityOf(s, player);
const discardCodes = (s: GameState) => piles(s).discard.map((id) => codeOf(s, id));
const deckCodes = (s: GameState) => piles(s).deck.map((id) => codeOf(s, id));
const copies = (s: GameState, code: string) =>
  Object.keys(s.instances).filter((i) => codeOf(s, i as InstanceId) === code) as InstanceId[];
const threatFrom = (events: Parameters<typeof types>[0], source: InstanceId) =>
  types(events, "threatPlaced")
    .filter((e) => e.sourceInstanceId === source)
    .map((e) => e.amount);

/**
 * The Spider-Woman scenario past setup, hero form, Spider-Woman not tough. Stage 1A revealed Self-propelled Glide; it
 * is back in the encounter deck because the stacks deal it as the harmless filler card.
 */
function game(opts: { readonly twoPlayers?: boolean } = {}): GameState {
  const start = civilWarHeroGame(SPIDER_WOMAN_SCENARIO, {
    leaderSideScheme: "discarded",
    mainSchemeStageIds: QUIET,
    ...(opts.twoPlayers ? { twoPlayers: true } : {}),
  });
  return opts.twoPlayers ? withForm(start, { heroForm: 0 }, P2) : start;
}

/** Three players: the Tigra and Hulkling precons and the Core Spider-Man deck, all in hero form (the scenario's seats are the config's players). */
function threePlayerGame(): GameState {
  const config = civilWarConfig(SPIDER_WOMAN_SCENARIO, {
    leaderSideScheme: "discarded",
    mainSchemeStageIds: QUIET,
    twoPlayers: true,
  });
  const created = createGame(
    {
      ...config,
      players: [...config.players, cwSeat(HULKLING_DECK)],
    },
    WAVE10_DEPS,
  );
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  let current = withoutLeaderSideScheme(
    settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS),
  );
  for (const player of [P1, P2, P3]) current = withForm(current, { heroForm: 0 }, player);
  return current;
}

/** Surgery: the encounter deck's own copy of `code`, engaged with `player` (no reveal, no When Revealed). */
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

/** Surgery: a copy of Tangled Up from the encounter deck or discard pile, attached faceup to `host`'s identity. */
function tangle(state: GameState, player: PlayerId = P1): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === TANGLED_UP);
  if (!id) throw new Error("no Tangled Up in the encounter deck or discard");
  const host = hero(state, player);
  const out: GameState = {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
    },
  };
  const attached = patchInstance(patchInstance(out, id, { faceup: true, attachedTo: host }), host, {
    attachments: [...inst(out, host).attachments, id],
  });
  return { state: attached, id };
}

/** Surgery: every copy of `code` still in the encounter deck moved to the front of its discard pile. */
function copiesToDiscard(state: GameState, code: string): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const moved = pile.deck.filter((i) => codeOf(state, i) === code);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => !moved.includes(i)), discard: [...moved, ...pile.discard] },
    },
  };
}

/** Surgery: every copy of `code` in the encounter deck or discard pile taken out of the game's piles. */
function copiesGone(state: GameState, code: string): GameState {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const keep = (i: InstanceId) => codeOf(state, i) !== code;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { deck: pile.deck.filter(keep), discard: pile.discard.filter(keep) },
    },
  };
}

/** The first player ends the turn and the villain phase runs on the stacked deck (boost card first, then the dealt card). */
const villainPhase = (state: GameState, ...stack: string[]) =>
  driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));

const dealtFacedown = (events: Parameters<typeof types>[0]) =>
  types(events, "cardMoved").filter((e) => e.to.kind === "dealtEncounter" && e.cardId === (TANGLED_UP as never));

describe("registry", () => {
  it("registers the five refs of the four cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(MODULAR_SPIDER_MAN).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(MODULAR_SPIDER_MAN)) expect(validateDefinition(def), id).toEqual([]);
    expect(MODULAR_SPIDER_MAN_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the four cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("carries the printed timing of each ability", () => {
    const reg = MODULAR_SPIDER_MAN;
    for (const ref of ["56180.when-revealed", "56182.when-revealed", "56183.when-revealed"])
      expect(reg[ref]!.trigger, ref).toMatchObject({ kind: "whenRevealed" });
    expect(reg["56181.boost"]!.trigger).toMatchObject({ kind: "boost" });
    expect(reg["56181.tangled-up-forced-interrupt"]!.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
      on: { on: "characterWouldAct" },
    });
  });

  it("the competitive sentences are scripted against your leader's main scheme (M3), no marker left", () => {
    for (const ref of ["56182.when-revealed", "56183.when-revealed"]) {
      expect(competitiveOnlyTexts(MODULAR_SPIDER_MAN[ref]!)).toEqual([]);
      expect(JSON.stringify(MODULAR_SPIDER_MAN[ref])).toContain('"of":"yourLeader"');
    }
  });

  it("setup: the encounter deck holds one copy of each card, and two of Tangled Up", () => {
    const s = game();
    expect([SPIDER_MAN, TANGLED_UP, SPECTACULAR, NEIGHBORHOOD].map((code) => copies(s, code).length)).toEqual([
      1, 2, 1, 1,
    ]);
  });
});

describe("Spider-Man (56180)", () => {
  it("is data: a unique Avenger Elite minion, ATK 2, SCH 2, 4 hit points, 2 boost icons and no keywords", () => {
    const card = dataOf(SPIDER_MAN);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique, card.keywords]).toEqual([
      "minion",
      2,
      2,
      4,
      2,
      true,
      [],
    ]);
  });

  it("WHEN REVEALED with Tangled Up on your hero: he attacks that hero for 2 (no boost card); no copy is searched for", () => {
    const tangled = tangle(game());
    const baseline = villainPhase(tangled.state, ADVANCE, GLIDE);
    const { state, events } = villainPhase(tangled.state, ADVANCE, SPIDER_MAN, GLIDE);
    expect(revealedCodes(state, events)).toEqual([SPIDER_MAN]);
    expect(attacksBy(state, events, SPIDER_MAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(inst(state, hero(state)).damage).toBe(inst(baseline.state, hero(baseline.state)).damage + 2);
    expect(flippedBoosts(events)).toHaveLength(1);
    expect(dealtFacedown(events)).toEqual([]);
    // The hero is not the one attacking, so Tangled Up is not discarded.
    expect(inst(state, tangled.id).attachedTo).toBe(hero(state));
    expect(inst(state, inPlayCard(state, SPIDER_MAN)!)).toMatchObject({ engagedWith: P1, faceup: true });
    expect(copies(state, TANGLED_UP)).toHaveLength(2);
  });

  it("WHEN REVEALED with a copy attached to each of two heroes: he attacks both (he is engaged with the revealing one)", () => {
    const one = tangle(game({ twoPlayers: true }), P1);
    const two = tangle(one.state, P2);
    const baseline = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(two.state, ADVANCE, ADVANCE, GLIDE, DEFEND),
      firstLegal,
      endTurn(P1),
      endTurn(P2),
    );
    const { state, events } = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(two.state, ADVANCE, ADVANCE, SPIDER_MAN, DEFEND),
      firstLegal,
      endTurn(P1),
      endTurn(P2),
    );
    expect(attacksBy(state, events, SPIDER_MAN)).toMatchObject([
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
      { baseAtk: 2, boostIcons: 0, damageDealt: 2 },
    ]);
    expect(
      [P1, P2].map((p) => inst(state, hero(state, p)).damage - inst(baseline.state, hero(baseline.state, p)).damage),
    ).toEqual([2, 2]);
    expect(dealtFacedown(events)).toEqual([]);
    expect(inst(state, one.id).attachedTo).toBe(hero(state, P1));
    expect(inst(state, two.id).attachedTo).toBe(hero(state, P2));
  });

  it("WHEN REVEALED with Tangled Up on the other player's hero only: he attacks that hero, not the one he is engaged with", () => {
    const two = tangle(game({ twoPlayers: true }), P2);
    const { state, events } = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(two.state, ADVANCE, ADVANCE, SPIDER_MAN, DEFEND),
      firstLegal,
      endTurn(P1),
      endTurn(P2),
    );
    const spiderMan = inPlayCard(state, SPIDER_MAN)!;
    expect(inst(state, spiderMan).engagedWith).toBe(P1);
    expect(attacksBy(state, events, SPIDER_MAN)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(dealtFacedown(events)).toEqual([]);
  });

  it("WHEN REVEALED with no Tangled Up in play: no attack; a copy is found and dealt to you as a facedown encounter card, then revealed", () => {
    const start = game();
    const { state, events } = villainPhase(start, ADVANCE, SPIDER_MAN, GLIDE);
    expect(attacksBy(state, events, SPIDER_MAN)).toEqual([]);
    expect(
      dealtFacedown(events).map((e) => [codeOf(state, e.instanceId), (e.to as { playerId: string }).playerId]),
    ).toEqual([[TANGLED_UP, P1]]);
    // The dealt card is revealed in the same villain phase and, with no leader to attach to, attaches to the hero.
    const attached = inst(state, hero(state)).attachments.filter((id) => codeOf(state, id) === TANGLED_UP);
    expect(attached).toHaveLength(1);
    expect(inst(state, attached[0]!)).toMatchObject({ faceup: true, attachedTo: hero(state) });
    expect(copies(state, TANGLED_UP)).toHaveLength(2);
    expect(inst(state, hero(state)).damage).toBe(inst(villainPhase(start, ADVANCE, GLIDE).state, hero(state)).damage);
  });

  it("WHEN REVEALED: the copy may be in the encounter discard pile instead of the deck, and only one is dealt", () => {
    const start = copiesToDiscard(game(), TANGLED_UP);
    expect(deckCodes(start)).not.toContain(TANGLED_UP);
    expect(discardCodes(start).filter((c) => c === TANGLED_UP)).toHaveLength(2);
    const { state, events } = villainPhase(start, ADVANCE, SPIDER_MAN, GLIDE);
    expect(dealtFacedown(events)).toHaveLength(1);
    expect(inst(state, hero(state)).attachments.filter((id) => codeOf(state, id) === TANGLED_UP)).toHaveLength(1);
    expect(discardCodes(state).filter((c) => c === TANGLED_UP)).toHaveLength(1);
  });

  it("WHEN REVEALED: the search shuffles the encounter deck", () => {
    const start = game();
    const stacked = stackEncounterDeck(start, SPIDER_MAN, GLIDE, DEFEND, ADVANCE);
    const before = piles(stacked).deck.map((id) => codeOf(stacked, id));
    const { state } = villainPhase(start, ADVANCE, SPIDER_MAN);
    const after = deckCodes(state);
    expect(after.slice(0, 3)).not.toEqual(before.slice(2, 5));
  });

  /** Surgery: the Spider-Man still in the encounter deck holds one stunned status card when he is revealed. */
  const stunnedInDeck = (state: GameState): GameState => {
    const id = piles(state).deck.find((i) => codeOf(state, i) === SPIDER_MAN)!;
    return patchInstance(state, id, { statuses: { ...inst(state, id).statuses, stunned: 1 } });
  };

  it("WHEN REVEALED stunned, Tangled Up on your hero: the stun card is removed instead of the attack, so no attack was made this way and a copy is found and dealt to you (RRG 1.8 'Stun, Stunned' p. 41)", () => {
    const tangled = tangle(game());
    const baseline = villainPhase(tangled.state, ADVANCE, GLIDE);
    const { state, events } = villainPhase(stunnedInDeck(tangled.state), ADVANCE, SPIDER_MAN, GLIDE);
    expect(attacksBy(state, events, SPIDER_MAN)).toEqual([]);
    expect(inst(state, inPlayCard(state, SPIDER_MAN)!).statuses.stunned).toBe(0);
    expect(inst(state, hero(state)).damage).toBe(inst(baseline.state, hero(baseline.state)).damage);
    expect(
      dealtFacedown(events).map((e) => [codeOf(state, e.instanceId), (e.to as { playerId: string }).playerId]),
    ).toEqual([[TANGLED_UP, P1]]);
    // The second copy is revealed in the same phase and attaches to the hero beside the first.
    expect(inst(state, hero(state)).attachments.filter((id) => codeOf(state, id) === TANGLED_UP)).toHaveLength(2);
  });

  it("WHEN REVEALED stunned, a copy on each of two heroes: the stun card replaces the first attack only, the second is made, so no copy is searched for", () => {
    const one = tangle(game({ twoPlayers: true }), P1);
    const two = tangle(one.state, P2);
    const { state, events } = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(stunnedInDeck(two.state), ADVANCE, ADVANCE, SPIDER_MAN, DEFEND),
      firstLegal,
      endTurn(P1),
      endTurn(P2),
    );
    expect(attacksBy(state, events, SPIDER_MAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(inst(state, inPlayCard(state, SPIDER_MAN)!).statuses.stunned).toBe(0);
    expect(dealtFacedown(events)).toEqual([]);
    expect(types(events, "deckShuffled")).toEqual([]);
  });

  it("WHEN REVEALED with no copy left to find and none attached: nothing is dealt and he attacks nobody", () => {
    const start = copiesGone(game(), TANGLED_UP);
    const { state, events } = villainPhase(start, ADVANCE, SPIDER_MAN, GLIDE);
    expect(attacksBy(state, events, SPIDER_MAN)).toEqual([]);
    expect(dealtFacedown(events)).toEqual([]);
    expect(inPlayCard(state, SPIDER_MAN)).toBeDefined();
  });
});

describe("Tangled Up (56181)", () => {
  it("is data: a Condition attachment with a boost star, no boost icon, attaching to your leader, otherwise your hero", () => {
    const card = dataOf(TANGLED_UP);
    expect([card.type, card.boostIcons, card.starIcon, card.quantityInSet]).toEqual(["attachment", 0, true, 2]);
    expect(card.attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "leader", of: "yours" },
      otherwise: { kind: "yourIdentity", form: "hero" },
    });
  });

  it("FORCED INTERRUPT: the attached hero's basic attack is exhausted for, deals nothing, and discards Tangled Up; the next attack works", () => {
    const tangled = tangle(game());
    const target = engaged(tangled.state, SPIDER_MAN);
    const attack = (s: GameState) =>
      driveEventsPicking(WAVE10_DEPS, patchInstance(s, hero(s), { exhausted: false }), firstLegal, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hero(s),
        targetInstanceId: target.id,
      });
    const first = attack(target.state);
    expect(inst(first.state, target.id).damage).toBe(0);
    expect(inst(first.state, hero(first.state)).exhausted).toBe(true);
    expect(inst(first.state, tangled.id).attachedTo).toBeNull();
    expect(piles(first.state).discard).toContain(tangled.id);
    const second = attack(first.state);
    expect(inst(second.state, target.id).damage).toBeGreaterThan(0);
  });

  it("BOOST with the Spider-Man minion in play: this card is revealed and attaches to the hero the leader is activating against", () => {
    const spiderMan = engaged(game(), SPIDER_MAN);
    const { state, events } = villainPhase(spiderMan.state, TANGLED_UP, GLIDE);
    expect(flippedBoosts(events).map((f) => [codeOf(state, f.instanceId), f.boostIcons])).toEqual([[TANGLED_UP, 0]]);
    const attached = inst(state, hero(state)).attachments.filter((id) => codeOf(state, id) === TANGLED_UP);
    expect(attached).toHaveLength(1);
    expect(inst(state, attached[0]!)).toMatchObject({ faceup: true, attachedTo: hero(state) });
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
  });

  it("BOOST without the Spider-Man minion in play: nothing is revealed and the card is discarded", () => {
    const { state, events } = villainPhase(game(), TANGLED_UP, GLIDE);
    expect(inst(state, hero(state)).attachments.filter((id) => codeOf(state, id) === TANGLED_UP)).toEqual([]);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(discardCodes(state)).toContain(TANGLED_UP);
  });
});

describe("Spectacular! (56182)", () => {
  it("is data: a treachery with 2 boost icons and no star", () => {
    const card = dataOf(SPECTACULAR);
    expect([card.type, card.boostIcons, card.starIcon]).toEqual(["treachery", 2, undefined]);
  });

  it("WHEN REVEALED (cooperative): 2 threat on the main scheme and nothing else; no threat is removed anywhere", () => {
    const start = game();
    const card = copies(start, SPECTACULAR)[0]!;
    const baseline = villainPhase(start, ADVANCE, GLIDE);
    const { state, events } = villainPhase(start, ADVANCE, SPECTACULAR, GLIDE);
    expect(threatFrom(events, card)).toEqual([2]);
    // Open Rebellion (56172b): "When a player reveals a treachery, place 1 threat here" adds its own 1 to the main scheme.
    expect(threatFrom(events, state.mainScheme.instanceId)).toEqual([1]);
    expect(mainThreat(state)).toBe(mainThreat(baseline.state) + 2 + 1);
    expect(types(events, "threatRemoved")).toEqual([]);
    expect(discardCodes(state)).toContain(SPECTACULAR);
    expect(inst(state, hero(state)).damage).toBe(inst(baseline.state, hero(baseline.state)).damage);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Spider-Woman ATK 2 + 2)", () => {
    const { state, events } = villainPhase(game(), SPECTACULAR, GLIDE);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
  });
});

describe("Neighborhood Hero (56183)", () => {
  it("is data: a side scheme with 2 threat (none per player), 2 boost icons and no keywords", () => {
    const card = dataOf(NEIGHBORHOOD);
    expect([card.type, card.startingThreat, card.boostIcons, card.keywords]).toEqual([
      "side_scheme",
      { base: 2, perPlayer: 0 },
      2,
      [],
    ]);
  });

  it("WHEN REVEALED, one player: its 2 starting threat plus 2 per player (2) is 4, and the main scheme is untouched", () => {
    const start = game();
    const baseline = villainPhase(start, ADVANCE, GLIDE);
    const { state, events } = villainPhase(start, ADVANCE, NEIGHBORHOOD);
    const scheme = inPlayCard(state, NEIGHBORHOOD)!;
    expect(inst(state, scheme).threat).toBe(2 + 2);
    expect(threatFrom(events, scheme)).toEqual([2]);
    expect(mainThreat(state)).toBe(mainThreat(baseline.state));
    expect(types(events, "threatRemoved")).toEqual([]);
  });

  it("WHEN REVEALED, two players: 2 + 4 = 6", () => {
    const start = game({ twoPlayers: true });
    const { state } = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(start, ADVANCE, ADVANCE, NEIGHBORHOOD, GLIDE),
      firstLegal,
      endTurn(P1),
      endTurn(P2),
    );
    expect(inst(state, inPlayCard(state, NEIGHBORHOOD)!).threat).toBe(2 + 4);
  });

  it("WHEN REVEALED, three players (cooperative): 2 + 6 = 8 threat here, none moved from the main scheme", () => {
    const start = threePlayerGame();
    expect(start.players).toHaveLength(3);
    const { state, events } = driveEventsPicking(
      WAVE10_DEPS,
      stackEncounterDeck(start, ADVANCE, ADVANCE, ONE_ICON, NEIGHBORHOOD, GLIDE, DEFEND),
      firstLegal,
      endTurn(P1),
      endTurn(P2),
      endTurn(P3),
    );
    const scheme = inPlayCard(state, NEIGHBORHOOD)!;
    expect(inst(state, scheme).threat).toBe(2 + 6);
    expect(types(events, "threatRemoved")).toEqual([]);
    expect(threatFrom(events, state.mainScheme.instanceId)).toEqual([]);
    expect(threatFrom(events, scheme)).toEqual([6]);
  });

  it("BOOST: 2 icons on the activating enemy's attack (Spider-Woman ATK 2 + 2)", () => {
    const { state, events } = villainPhase(game(), NEIGHBORHOOD, GLIDE);
    expect(attacksBy(state, events, SPIDER_WOMAN)).toMatchObject([{ baseAtk: 2, boostIcons: 2, damageDealt: 4 }]);
  });
});
