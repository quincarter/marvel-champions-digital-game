import { HERCULES_CARDS, cardId, trait, type AnyCard } from "@mc/content";
import {
  activeEncounterDeck,
  activeEncounterDeckId,
  applyCommand,
  cardsInPlay,
  createGame,
  hasKeyword,
  keywordTotal,
  locateCard,
  maxHitPoints,
  separateDeckOf,
  traitsOf,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { forcedResponse, on, perHero, placeThreat, self } from "../../../dsl/index.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  AMADEUS_CHO,
  DEFEAT_THE_HYDRA,
  DISCARD_LABORS,
  DISCARD_MINIONS,
  EMBODY_PATHOS,
  GIFT,
  LERNEAN_HYDRA,
  PROTECT_HUMANITY,
  REMOVE_LABOR_COUNTER,
  TEST_ACTIONS,
  depsWith,
  drive,
  laborCodes,
  newLabors,
  ofType,
  theCard,
  withLaborOrder,
} from "../../../dsl/wave10-labor.testing.js";
import { coreScenario } from "../../../core/setup.js";
import {
  P1,
  P2,
  changeForm,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { codeOf } from "../../../wave9/testing.js";
import {
  CORE_SPIDER_MAN,
  HERCULES_DECK,
  HERO_PACK_CARDS,
  WAVE10_DEPS,
  engageMinion,
  heroPackSeat,
  herculesGame,
  herculesHeroGame,
  stagedInPlay,
} from "../../testing.js";
import { HERCULES_GIFT_LABOR, HERCULES_GIFT_LABOR_SKIPPED } from "./gift-labor.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Hercules's three Labor cards (59002 Defeat the Hydra, 59003 Embody Pathos, 59004 Protect Humanity) and three Gift
 * cards (59005 Nemean Lion Skin, 59006 Shield of Perseus, 59007 Sword of Peleus), docs/phase7-wave10-hero-packs.md H3.3
 * to H3.8 and H8.4 line HS10, in real games against Core's Rhino with the hand-built Leadership deck `HERCULES_DECK`
 * (his identity module is `identity.ts`; the Labor deck, the reveal and Atonement are proved there as well).
 *
 * Sources: the Hercules pack insert (docs/phase7-wave10-sources.md section 3, the only source of the Gift and Labor
 * rules); RRG 1.8 FAQ p. 65 ("Hercules Hero Pack - Labor Cards"); March 6, 2026 - Ruling 3 (2) (a Labor card that cannot
 * enter play: Lernean Hydra dealt facedown as a boost card cannot be found); February 20, 2026 - Ruling 3 (Protect
 * Humanity needs an ally; "that attack" is the redirected one); June 2, 2026 - Ruling 2 (3) (Embody Pathos finds a
 * set-aside side scheme); RRG 1.8 "Find" (p. 19), "Victory X" (p. 46), "Per Player Icon" (p. 32), "Hinder X" (p. 22),
 * "Assault" (p. 8), "Labeled Ability" (p. 26), "Piercing", "Retaliate", "Steady".
 *
 * Owner's answers: question 3 = B (a Labor card revealed with no valid target is discarded, logged as discarded, and
 * ends on the bottom of the Labor deck); question 19 = A (Embody Pathos's "treating each per-player icon on it as 1"
 * covers only the reveal, a later ability of that scheme reads the real per-player count).
 */
const R = HERCULES_GIFT_LABOR;
const REFS = [
  "59002.defeat-the-hydra-constant",
  "59002.when-revealed",
  "59003.embody-pathos-constant",
  "59003.when-revealed",
  "59004.obligation",
  "59004.when-revealed",
  "59004.protect-humanity-forced-interrupt",
  "59005.nemean-lion-skin-constant",
  "59005.nemean-lion-skin-response",
  "59006.shield-of-perseus-constant",
  "59006.shield-of-perseus-response",
  "59007.sword-of-peleus-constant",
  "59007.sword-of-peleus-response",
];
const ATONEMENT = "59001a.atonement";
const NEMEAN = "59005";
const SHIELD = "59006";
const SWORD = "59007";
const GIFTS = [NEMEAN, SHIELD, SWORD];
const OLYMPIC_FEUD = "59038";
const ALL_VERSUS_ALL = "59041";
const CROWD_CONTROL = "01108";
const TIGER_SHARK = "01131";
const ADVANCE = "01186";
const FOR_JUSTICE = "01060";
const THOR = "59020";
const TEST_SCHEME = "test-riot";
const TEST_SCHEME_RESPONSE = "test-riot.forced-response";
const ELITE = trait("ELITE");

const DEPS: EngineDeps = WAVE10_DEPS;
const TEST_DEPS: EngineDeps = depsWith({
  ...TEST_ACTIONS,
  [TEST_SCHEME_RESPONSE]: forcedResponse(on.characterFlips(), placeThreat(perHero(1), self)),
});
const run = (s: GameState, command: Command, pick: Picker = firstLegal, deps: EngineDeps = DEPS) =>
  drive(s, command, pick, deps);
const picking =
  (id: InstanceId): Picker =>
  (state) =>
    state.pendingChoice?.options.some((o) => o.optionId === id) ? [id] : firstLegal(state);

const handSize = (s: GameState): number => playerOf(s, P1).hand.length;
const giftDeck = (s: GameState): readonly InstanceId[] => separateDeckOf(s, P1, GIFT).deck;
const giftsInPlay = (s: GameState): InstanceId[] => cardsInPlay(s).filter((id) => GIFTS.includes(codeOf(s, id)));
const victoryCodes = (s: GameState): string[] => s.victoryDisplay.map((id) => codeOf(s, id));
const herc = (s: GameState): InstanceId => identityOf(s, P1);
const data = (code: string) => HERCULES_CARDS.find((c) => (c.id as string) === code)! as any;
const inNoPile = (s: GameState, id: InstanceId): boolean =>
  !playerOf(s, P1).discard.includes(id) && !activeEncounterDeck(s).discard.includes(id);

/** Hercules in alter-ego form with the Labor deck in this order from the top. */
const alterEgo = (...order: readonly string[]): GameState => withLaborOrder(herculesGame(), ...order);
/** The same game after New Labors of Hercules, the revealed card in play, Hercules in hero form. */
function revealed(top: string): GameState {
  const start = alterEgo(top, ...[DEFEAT_THE_HYDRA, EMBODY_PATHOS, PROTECT_HUMANITY].filter((c) => c !== top));
  return withForm(run(start, newLabors(start)).state, { heroForm: 0 });
}

/** Hercules (first player) and Core's Spider-Man against Rhino, Hercules in alter-ego form, the Labor deck in this order. */
function twoPlayerGame(...order: readonly string[]): GameState {
  return withLaborOrder(playersGame(2), ...order);
}

/** `count` players (Hercules, Spider-Man, She-Hulk) against Rhino, All Versus All added to the encounter deck. */
function playersGame(count: 1 | 2 | 3, extra: { readonly scheme?: boolean } = {}): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: CORE_SPIDER_MAN }, { starterDeckId: "core-she-hulk-aggression" }].slice(
      0,
      Math.max(count - 1, 1),
    ),
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: HERO_PACK_CARDS,
  } as never);
  const others = count === 1 ? [] : config.players.slice(0, count - 1);
  const created = createGame(
    {
      ...config,
      encounterDeck: [...config.encounterDeck, cardId(ALL_VERSUS_ALL)],
      players: [heroPackSeat(HERCULES_DECK), ...others],
    },
    TEST_DEPS,
  );
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", TEST_DEPS);
  return extra.scheme ? withTestScheme(opened) : opened;
}

/** Surgery: the test's own side scheme (starting threat 3 per player, a per-player Forced Response) in the encounter deck. */
function withTestScheme(state: GameState): GameState {
  const crowd = state.cardPool[inst(state, theCard(state, CROWD_CONTROL)).cardId];
  if (crowd?.type !== "side_scheme") throw new Error("no Crowd Control");
  const card: AnyCard = {
    ...crowd,
    id: TEST_SCHEME as never,
    name: "Riot",
    icons: [],
    startingThreat: { base: 0, perPlayer: 3 },
    abilities: [{ id: TEST_SCHEME_RESPONSE as never }],
  };
  const id = "riot" as InstanceId;
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    cardPool: { ...state.cardPool, [card.id]: card },
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [...pile.deck, id] } },
    instances: {
      ...state.instances,
      [id]: { ...inst(state, theCard(state, CROWD_CONTROL)), instanceId: id, cardId: card.id },
    },
  };
}

/** Surgery on the card pool: Hercules's alter ego also prints the test actions, so a test can discard cards by `useAbility`. */
function withTestActions(state: GameState): GameState {
  const identityCardId = playerOf(state, P1).identity.cardId;
  const identity = state.cardPool[identityCardId];
  if (identity?.type !== "hero_identity") throw new Error("no identity card");
  const refs = Object.keys(TEST_ACTIONS).map((id) => ({ id: id as never }));
  const withRefs = {
    ...identity,
    alterEgo: { ...identity.alterEgo, abilities: [...identity.alterEgo.abilities, ...refs] },
  };
  return { ...state, cardPool: { ...state.cardPool, [identityCardId]: withRefs } };
}
const testAction = (state: GameState, ability: string): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: herc(state),
  abilityId: ability as never,
  payment: [],
});

/** Surgery: `codes` on top of the Gift deck, in this order. */
function withGiftOrder(state: GameState, ...codes: readonly string[]): GameState {
  const top = codes.map((code) => giftDeck(state).find((id) => codeOf(state, id) === code)!);
  const rest = giftDeck(state).filter((id) => !top.includes(id));
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? { ...p, separateDecks: { ...p.separateDecks, [GIFT]: { deck: [...top, ...rest], discard: [] } } }
        : p,
    ),
  };
}

/** Surgery: `code`'s Gift card taken out of the Gift deck and attached to Hercules under his control. */
function withGift(state: GameState, code: string): GameState {
  const id = giftDeck(state).find((i) => codeOf(state, i) === code)!;
  const host = herc(state);
  const moved: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1
        ? {
            ...p,
            separateDecks: {
              ...p.separateDecks,
              [GIFT]: { ...p.separateDecks[GIFT]!, deck: p.separateDecks[GIFT]!.deck.filter((i) => i !== id) },
            },
          }
        : p,
    ),
  };
  const placed = patchInstance(moved, id, { faceup: true, controllerId: P1, attachedTo: host });
  return patchInstance(placed, host, { attachments: [...inst(placed, host).attachments, id] });
}

/** The ruling's case: the Lernean Hydra is a facedown boost card on the villain, where a find cannot look. */
function withHydraAsBoostCard(state: GameState): GameState {
  const hydra = theCard(state, LERNEAN_HYDRA);
  const villain = state.activeVillainId!;
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, setAside: p.setAside.filter((id) => id !== hydra) })),
    instances: {
      ...state.instances,
      [hydra]: { ...inst(state, hydra), faceup: false },
      [villain]: { ...inst(state, villain), boostCards: [hydra] },
    },
  };
}

const basicAttack = (s: GameState, attacker: InstanceId, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const basicThwart = (thwarter: InstanceId, scheme: InstanceId, player = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});

interface Seen {
  readonly offeredIn: string[];
  flipOffered: boolean;
}
const fresh = (): Seen => ({ offeredIn: [], flipOffered: false });
/** Takes every optional response (Atonement among them) and the flip when `flip`; records what was offered. */
const eager =
  (seen: Seen, flip: boolean, base: Picker = firstLegal): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseTriggers") {
      const abilities = choice.options.filter((o) => o.ref.kind === "ability");
      if (abilities.some((o) => o.ref.kind === "ability" && o.ref.abilityId === ATONEMENT))
        seen.offeredIn.push(state.step.phase);
      return abilities.slice(0, Math.max(1, choice.minSelections)).map((o) => o.optionId);
    }
    if (choice.prompt.kind === "chooseOption" && choice.options.some((o) => o.label === "Flip to alter-ego form")) {
      seen.flipOffered = true;
      return [choice.options[flip ? 0 : 1]!.optionId];
    }
    return base(state);
  };

describe("Hercules Gift and Labor cards registry", () => {
  it("every ability validates, with the printed timing", () => {
    expect(HERCULES_GIFT_LABOR_SKIPPED).toEqual({});
    for (const id of REFS) expect(validateDefinition(R[id]!), id).toEqual([]);
    for (const id of REFS.filter((r) => r.endsWith("-constant")))
      expect(R[id]!.trigger, id).toMatchObject({ kind: "constant" });
    expect(R["59002.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(R["59003.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(R["59004.when-revealed"]!.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(R["59004.protect-humanity-forced-interrupt"]!.trigger).toMatchObject({ kind: "interrupt", forced: true });
    for (const id of GIFTS.map((g) => REFS.find((r) => r.startsWith(g) && r.endsWith("-response"))!)) {
      expect(R[id]!.trigger, id).toMatchObject({ kind: "response" });
      expect((R[id]!.trigger as { forced?: boolean }).forced, id).toBeFalsy();
    }
  });

  it("all thirteen printed refs are registered, none is skipped, and the registry holds exactly them", () => {
    const printed = ["59002", "59003", "59004", "59005", "59006", "59007"].flatMap((code) =>
      data(code).abilities.map((a: { id: string }) => a.id as string),
    );
    expect(printed.sort()).toEqual([...REFS].sort());
    expect(Object.keys(R).sort()).toEqual([...REFS].sort());
  });

  it("data: Labor cards are encounter cards with Victory 0 (Protect Humanity also Uses 3 labor counters); Gift cards are permanent dash-cost upgrades", () => {
    expect(["59002", "59003", "59004"].map((c) => data(c).type)).toEqual(["attachment", "attachment", "obligation"]);
    for (const code of ["59002", "59003", "59004"]) {
      expect(data(code).keywords).toContainEqual({ name: "victory", value: 0 });
      expect(data(code).separateDeck).toBe("Labor");
    }
    expect(data("59004").keywords).toContainEqual({ name: "uses", count: 3, counterType: "labor" });
    for (const code of GIFTS) {
      expect(data(code)).toMatchObject({ type: "upgrade", specialCost: "dash", separateDeck: "Gift", unique: true });
      expect(data(code).keywords).toContainEqual({ name: "permanent" });
    }
    expect(data(SWORD).keywords).toContainEqual({ name: "restricted" });
  });
});

describe("59002 Defeat the Hydra", () => {
  const TIGER = "tiger" as InstanceId;
  /** Defeat the Hydra on top; Tiger Shark (6 printed hit points, not Elite) engaged with Spider-Man with 4 damage. */
  function hydraAndShark(): GameState {
    const start = twoPlayerGame(DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS);
    return patchInstance(engageMinion(start, TIGER_SHARK, TIGER, P2), TIGER, { damage: 4, counters: { grudge: 2 } });
  }

  it("When Revealed: the set-aside Lernean Hydra and Tiger Shark are both offered, with where they are", () => {
    const start = hydraAndShark();
    let seen: GameState | undefined;
    run(start, newLabors(start), (s) => {
      if (!seen && s.pendingChoice?.prompt.kind === "chooseCards") seen = s;
      return firstLegal(s);
    });
    expect(seen!.pendingChoice!.options.map((o) => [o.optionId, o.label, o.zone])).toEqual([
      [TIGER, "Tiger Shark", { kind: "playArea", playerId: P2 }],
      [theCard(start, LERNEAN_HYDRA), "Lernean Hydra", { kind: "setAside", playerId: P1 }],
    ]);
  });

  it("the set-aside Hydra chosen: engaged with Hercules, 12 hit points, Elite, with the attachment owned by him and controlled by nobody", () => {
    const start = hydraAndShark();
    const hydra = theCard(start, LERNEAN_HYDRA);
    const { state } = run(start, newLabors(start), picking(hydra));
    const labor = theCard(state, DEFEAT_THE_HYDRA);
    expect(inst(state, hydra)).toMatchObject({ engagedWith: P1, damage: 0, attachments: [labor] });
    expect(inst(state, labor)).toMatchObject({ ownerId: P1, controllerId: null, attachedTo: hydra, faceup: true });
    expect(maxHitPoints(state, hydra, DEPS)).toBe(12);
    expect(traitsOf(state, hydra, DEPS)).toContain(ELITE);
    expect(laborCodes(state)).toEqual([PROTECT_HUMANITY, EMBODY_PATHOS]);
    expect(inst(state, TIGER)).toMatchObject({ engagedWith: P2, damage: 4, attachments: [] });
  });

  it("Tiger Shark chosen, with 4 damage: it moves to Hercules, heals all damage, keeps its counters, and has 12 hit points", () => {
    const start = hydraAndShark();
    const { state } = run(start, newLabors(start), picking(TIGER));
    expect(inst(state, TIGER)).toMatchObject({
      engagedWith: P1,
      damage: 0,
      counters: { grudge: 2 },
      attachments: [theCard(state, DEFEAT_THE_HYDRA)],
    });
    expect(maxHitPoints(state, TIGER, DEPS)).toBe(12);
    expect(traitsOf(state, TIGER, DEPS)).toContain(ELITE);
    expect(playerOf(state, P2).playArea).not.toContain(TIGER);
  });

  it("the minion cannot take damage except from Hercules's attacks: Amadeus Cho's attack is refused (it could deal none), Hercules's basic attack deals 3", () => {
    const attached = revealed(DEFEAT_THE_HYDRA);
    const hydra = theCard(attached, LERNEAN_HYDRA);
    const cho = stagedInPlay(attached, AMADEUS_CHO);
    const refused = applyCommand(cho.state, basicAttack(cho.state, cho.id, hydra), DEPS);
    expect(refused).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(inst(cho.state, hydra).damage).toBe(0);
    expect(inst(cho.state, cho.id).exhausted).toBe(false);
    const hercHit = run(attached, basicAttack(attached, herc(attached), hydra)).state;
    expect(inst(hercHit, hydra).damage).toBe(3);
  });

  it("each of the three ways to a Labor card's end: the minion defeated by Hercules puts it in the victory display, the minion in the encounter discard pile", () => {
    const attached = revealed(DEFEAT_THE_HYDRA);
    const hydra = theCard(attached, LERNEAN_HYDRA);
    const labor = theCard(attached, DEFEAT_THE_HYDRA);
    const brink = patchInstance(attached, hydra, { damage: 10 });
    const { state } = run(brink, basicAttack(brink, herc(brink), hydra), eager(fresh(), false));
    expect(victoryCodes(state)).toEqual([DEFEAT_THE_HYDRA]);
    expect(locateCard(state, labor)).toEqual({ kind: "victoryDisplay" });
    expect(locateCard(state, hydra)?.kind).toBe("encounterDiscard");
    expect(inst(state, labor)).toMatchObject({ ownerId: P1, controllerId: null, attachedTo: null });
    expect(laborCodes(state)).toEqual([EMBODY_PATHOS, PROTECT_HUMANITY]);
    // Atonement was taken: a Gift entered play.
    expect(giftsInPlay(state)).toHaveLength(1);
  });

  it("the minion discarded by a player card, not defeated: the attachment is last in the Labor deck, no Gift, the victory display unchanged", () => {
    const attached = withTestActions(withForm(revealed(DEFEAT_THE_HYDRA), "alterEgo"));
    const labor = theCard(attached, DEFEAT_THE_HYDRA);
    const { state, events } = run(attached, testAction(attached, DISCARD_MINIONS), firstLegal, TEST_DEPS);
    expect(laborCodes(state)).toEqual([EMBODY_PATHOS, PROTECT_HUMANITY, DEFEAT_THE_HYDRA]);
    expect(state.victoryDisplay).toEqual([]);
    expect(inst(state, labor)).toMatchObject({ faceup: false, attachedTo: null, controllerId: null });
    expect(inNoPile(state, labor)).toBe(true);
    expect(giftsInPlay(state)).toEqual([]);
    expect(giftDeck(state)).toHaveLength(3);
    expect(ofType(events, "returnedToSeparateDeck").map((e) => e.cardId)).toEqual([DEFEAT_THE_HYDRA]);
  });

  it("question 3 = B: the Lernean Hydra dealt as a boost card and no other target, the Labor card is discarded (logged) and ends on the bottom of the Labor deck, with no Gift", () => {
    const start = withHydraAsBoostCard(alterEgo(DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS));
    const { state, events } = run(start, newLabors(start));
    const labor = theCard(state, DEFEAT_THE_HYDRA);
    expect(laborCodes(state)).toEqual([PROTECT_HUMANITY, EMBODY_PATHOS, DEFEAT_THE_HYDRA]);
    expect(inst(state, labor)).toMatchObject({ ownerId: P1, controllerId: null, faceup: false, attachedTo: null });
    expect(inNoPile(state, labor)).toBe(true);
    expect(state.victoryDisplay).toEqual([]);
    expect(inst(state, state.activeVillainId!).boostCards).toEqual([theCard(state, LERNEAN_HYDRA)]);
    expect(ofType(events, "revealedCardDiscarded")).toEqual([
      {
        type: "revealedCardDiscarded",
        instanceId: labor,
        cardId: DEFEAT_THE_HYDRA,
        playerId: P1,
        reason: "notAttached",
      },
    ]);
    expect(ofType(events, "returnedToSeparateDeck").map((e) => e.cardId)).toEqual([DEFEAT_THE_HYDRA]);
    // Answer 54B: a minion could be in the encounter deck, never in the Labor or Gift decks; neither is shuffled.
    expect(ofType(events, "deckShuffled").map((e) => e.zone.kind)).toEqual(["encounterDeck"]);
    expect(giftDeck(state)).toEqual(giftDeck(start));
    expect(giftsInPlay(state)).toEqual([]);
    // The action is open again at once and reveals the next card.
    const next = run(state, newLabors(state)).state;
    expect(locateCard(next, theCard(next, PROTECT_HUMANITY))).toEqual({ kind: "playArea", playerId: P1 });
  });

  it("two players: the other player may attack the attached minion, but only Hercules's attacks hurt it; it stays engaged with Hercules and owned by him", () => {
    const start = twoPlayerGame(DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS);
    const hydra = theCard(start, LERNEAN_HYDRA);
    const attached = run(start, newLabors(start), picking(hydra)).state;
    const turn = withForm(run(attached, endTurn(P1)).state, { heroForm: 0 }, P2);
    expect(turn.step).toMatchObject({ phase: "player" });
    const spiderMan = identityOf(turn, P2);
    const refused = applyCommand(turn, { ...basicAttack(turn, spiderMan, hydra), playerId: P2 }, DEPS);
    expect(refused).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(inst(turn, hydra)).toMatchObject({ damage: 0, engagedWith: P1 });
    expect(inst(turn, theCard(turn, DEFEAT_THE_HYDRA))).toMatchObject({ ownerId: P1, controllerId: null });
    // Spider-Man may still attack the villain.
    const villain = turn.activeVillainId!;
    const villainHit = run(turn, { ...basicAttack(turn, spiderMan, villain), playerId: P2 }).state;
    expect(inst(villainHit, villain).damage).toBeGreaterThan(0);
  });
});

describe("59003 Embody Pathos", () => {
  /** Hercules (hero form) and Spider-Man against Rhino; Embody Pathos is on Olympic Feud, which holds 8 threat. */
  function table() {
    const start = twoPlayerGame(EMBODY_PATHOS, PROTECT_HUMANITY, DEFEAT_THE_HYDRA);
    const scheme = theCard(start, OLYMPIC_FEUD);
    const attached = run(start, newLabors(start), picking(scheme)).state;
    expect(inst(attached, scheme).attachments).toEqual([theCard(attached, EMBODY_PATHOS)]);
    return { state: withForm(patchInstance(attached, scheme, { threat: 8 }), { heroForm: 0 }), scheme };
  }
  const threat = (s: GameState, id: InstanceId): number => inst(s, id).threat;
  const blocked = (events: readonly GameEvent[], scheme: InstanceId) =>
    ofType(events, "threatRemovalBlocked").filter((e) => e.schemeInstanceId === scheme);

  it("the attached scheme has assault; Hercules's basic thwart uses his ATK 3 (assault, RRG p. 8), so 8 leaves 5, not 7", () => {
    const { state, scheme } = table();
    expect(hasKeyword(state, scheme, "assault", DEPS)).toBe(true);
    const after = run(state, basicThwart(herc(state), scheme));
    expect(threat(after.state, scheme)).toBe(5);
    expect(blocked(after.events, scheme)).toEqual([]);
  });

  it("Thor, his ally (THW 3): the scheme is not a legal target of Thor's basic thwart, and 8 stays 8", () => {
    const { state, scheme } = table();
    const thor = stagedInPlay(state, THOR);
    const refused = applyCommand(thor.state, basicThwart(thor.id, scheme), DEPS);
    expect(refused).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(threat(thor.state, scheme)).toBe(8);
    const main = thor.state.mainScheme.instanceId;
    const withThreat = patchInstance(thor.state, main, { threat: 5 });
    const after = run(withThreat, basicThwart(thor.id, main)).state;
    expect(threat(after, main)).toBe(2);
    expect(threat(after, scheme)).toBe(8);
  });

  it("another player's thwart (Spider-Man's basic thwart, then his For Justice!) is refused that scheme", () => {
    const { state, scheme } = table();
    const turn = withForm(run(state, endTurn(P1)).state, { heroForm: 0 }, P2);
    expect(turn.step).toMatchObject({ phase: "player" });
    const refused = applyCommand(turn, basicThwart(identityOf(turn, P2), scheme, P2), DEPS);
    expect(refused).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    const given = moveToHand(patchInstance(turn, turn.mainScheme.instanceId, { threat: 5 }), P2, FOR_JUSTICE);
    const card = given.ids[0]!;
    const command = play(P2, card, payWith(given.state, P2, 2, [card]));
    const asked = applyCommand(given.state, command, DEPS);
    if (!asked.ok) throw new Error(`${asked.error.code}: ${asked.error.message}`);
    const offered = (asked.state.pendingChoice?.options ?? []).flatMap((o) =>
      o.ref.kind === "card" ? [o.ref.instanceId] : [],
    );
    expect(offered).toContain(given.state.mainScheme.instanceId);
    expect(offered).not.toContain(scheme);
    expect(threat(run(given.state, command).state, scheme)).toBe(8);
  });

  it("Hercules's thwart defeats the scheme: Embody Pathos is in the victory display (never the encounter discard pile) and Atonement is offered", () => {
    const { state, scheme } = table();
    const low = patchInstance(state, scheme, { threat: 3 });
    const seen = fresh();
    const hand = handSize(low);
    const after = run(low, basicThwart(herc(low), scheme), eager(seen, false)).state;
    const labor = theCard(after, EMBODY_PATHOS);
    expect(after.villainArea).not.toContain(scheme);
    expect(locateCard(after, labor)).toEqual({ kind: "victoryDisplay" });
    expect(inNoPile(after, labor)).toBe(true);
    expect(laborCodes(after)).toEqual([PROTECT_HUMANITY, DEFEAT_THE_HYDRA]);
    expect(seen.offeredIn).toEqual(["player"]);
    expect(giftsInPlay(after)).toHaveLength(1);
    expect(handSize(after)).toBe(hand + 4);
  });

  it("a player card discarding the attachment returns it to the bottom of the Labor deck, facedown, and the scheme loses assault", () => {
    const { state, scheme } = table();
    const staged = withTestActions(withForm(state, "alterEgo"));
    const { state: after } = run(staged, testAction(staged, DISCARD_LABORS), firstLegal, TEST_DEPS);
    expect(laborCodes(after)).toEqual([PROTECT_HUMANITY, DEFEAT_THE_HYDRA, EMBODY_PATHOS]);
    expect(inst(after, theCard(after, EMBODY_PATHOS))).toMatchObject({ faceup: false, attachedTo: null });
    expect(hasKeyword(after, scheme, "assault", DEPS)).toBe(false);
    expect(after.victoryDisplay).toEqual([]);
  });

  describe("question 19 = A: each per-player icon is read as 1 for the reveal only", () => {
    /** The threat on the scheme `code` once Hercules has found it with Embody Pathos in a game of `players`. */
    function pathosThreat(players: 1 | 2 | 3, code: string): { state: GameState; scheme: InstanceId } {
      const base = playersGame(players, { scheme: true });
      const start = withLaborOrder(base, EMBODY_PATHOS, PROTECT_HUMANITY, DEFEAT_THE_HYDRA);
      const scheme = code === TEST_SCHEME ? ("riot" as InstanceId) : theCard(start, code);
      const { state } = run(start, newLabors(start), picking(scheme), TEST_DEPS);
      expect(state.villainArea).toContain(scheme);
      expect(state.startingPlayerCount).toBe(players);
      return { state, scheme };
    }

    it("All Versus All (starting threat 2, Hinder 2 per player): 2 + 2 hinder + 6 additional = 10 with 1, 2 and 3 players", () => {
      for (const players of [1, 2, 3] as const) {
        const found = pathosThreat(players, ALL_VERSUS_ALL);
        expect(inst(found.state, found.scheme).threat, `${players} players`).toBe(10);
        expect(inst(found.state, found.scheme).attachments).toEqual([theCard(found.state, EMBODY_PATHOS)]);
      }
    });

    it("Crowd Control (starting threat 2 per player): 2 + 6 = 8 with 1, 2 and 3 players", () => {
      for (const players of [1, 2, 3] as const) {
        const found = pathosThreat(players, CROWD_CONTROL);
        expect(inst(found.state, found.scheme).threat, `${players} players`).toBe(8);
      }
    });

    it("a side scheme with starting threat 3 per player: 3 + 6 = 9 with any number of players, and its later Forced Response reads the real count", () => {
      for (const [players, later] of [
        [1, 10],
        [2, 11],
        [3, 12],
      ] as const) {
        const found = pathosThreat(players, TEST_SCHEME);
        expect(inst(found.state, found.scheme).threat, `${players} players`).toBe(9);
        // Hercules flips to hero form: "After a character flips, place 1 [per player] threat here."
        const flipped = run(found.state, changeForm(P1), firstLegal, TEST_DEPS).state;
        expect(playerOf(flipped, P1).identity.form).toBe("hero");
        expect(inst(flipped, found.scheme).threat, `${players} players, later`).toBe(later);
        expect(inst(flipped, found.scheme).attachments).toEqual([theCard(flipped, EMBODY_PATHOS)]);
      }
    });
  });
});

describe("59004 Protect Humanity", () => {
  /** Stacks the encounter deck's top with harmless cards (Advance), so boost and dealt cards do nothing. */
  function quietDeck(state: GameState): GameState {
    return activeEncounterDeck(state)
      .deck.slice(0, 12)
      .filter((id) => !codeOf(state, id).startsWith("59"))
      .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), state);
  }
  /** Retags the villain's next boost card (the top of the encounter deck) to a harmless treachery with `icons` boost icons. */
  function withBoostIcons(state: GameState, icons: number): GameState {
    const top = activeEncounterDeck(state).deck[0]!;
    const harmless = Object.values(state.cardPool).find(
      (c) =>
        c.type === "treachery" &&
        (c as { boostIcons?: number }).boostIcons === icons &&
        !(c.id as string).startsWith("59") &&
        !c.abilities.some((a) => (a.id as string).includes("boost")) &&
        !/Boost:/.test(c.text.current),
    );
    if (!harmless) throw new Error("no treachery to retag");
    return patchInstance(state, top, { cardId: harmless.id });
  }
  const defend =
    (who: InstanceId | "none"): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "declareDefender") return [who === "none" ? "decline" : who];
      return firstLegal(state);
    };
  const counters = (s: GameState): number => inst(s, theCard(s, PROTECT_HUMANITY)).counters.labor ?? 0;
  /** Hercules (hero form) with Protect Humanity in play and Amadeus Cho (2 hit points) in play under his control. */
  function inPlayWithCho(): GameState {
    return quietDeck(revealed(PROTECT_HUMANITY));
  }

  it("When Revealed: Amadeus Cho is put into play under Hercules's control; the obligation is in his play area with 3 labor counters", () => {
    const state = revealed(PROTECT_HUMANITY);
    const labor = theCard(state, PROTECT_HUMANITY);
    expect(locateCard(state, labor)).toEqual({ kind: "playArea", playerId: P1 });
    expect(inst(state, labor)).toMatchObject({ ownerId: P1, controllerId: null, counters: { labor: 3 } });
    expect(locateCard(state, theCard(state, AMADEUS_CHO))).toEqual({ kind: "playArea", playerId: P1 });
    expect(inst(state, theCard(state, AMADEUS_CHO)).controllerId).toBe(P1);
  });

  it("question 3 = B: Amadeus Cho removed from the game (nothing to find), the Labor card is discarded and ends on the bottom of the Labor deck, never in play, with no Gift", () => {
    const start0 = alterEgo(PROTECT_HUMANITY, DEFEAT_THE_HYDRA, EMBODY_PATHOS);
    const cho = playerOf(start0, P1).deck.find((i) => codeOf(start0, i) === AMADEUS_CHO)!;
    const start: GameState = {
      ...start0,
      removedFromGame: [...start0.removedFromGame, cho],
      players: start0.players.map((p) => ({ ...p, deck: p.deck.filter((i) => i !== cho) })),
    };
    const { state, events } = run(start, newLabors(start));
    const labor = theCard(state, PROTECT_HUMANITY);
    // Answer 54B (2026-10-13): the find for an ally looks through the player deck, not the Labor or Gift decks, so
    // only the player deck is shuffled (RRG 1.8 "Find", p. 19; "Search", p. 39) and both special decks keep their order.
    expect(ofType(events, "deckShuffled").map((e) => e.zone)).toEqual([{ kind: "deck", playerId: P1 }]);
    expect(giftDeck(state)).toEqual(giftDeck(start));
    expect(laborCodes(state)).toEqual([DEFEAT_THE_HYDRA, EMBODY_PATHOS, PROTECT_HUMANITY]);
    expect(cardsInPlay(state)).not.toContain(labor);
    expect(playerOf(state, P1).playArea).not.toContain(labor);
    expect(inst(state, labor)).toMatchObject({ faceup: false });
    expect(inNoPile(state, labor)).toBe(true);
    expect(state.victoryDisplay).toEqual([]);
    expect(giftsInPlay(state)).toEqual([]);
  });

  it("Cho chosen and Hercules defends (DEF 2): the villain attacks Cho instead, Hercules defended, so counters go 3 to 2 and Cho takes 0", () => {
    const start = inPlayWithCho();
    const cho = theCard(start, AMADEUS_CHO);
    const { state, events } = run(start, endTurn(P1), defend(herc(start)));
    expect(ofType(events, "attackRetargeted")).toEqual([
      { type: "attackRetargeted", enemyInstanceId: start.activeVillainId, targetInstanceId: cho, playerId: P1 },
    ]);
    expect(ofType(events, "attackResolved").map((e) => [e.targetInstanceId, e.damageDealt])).toEqual([
      [herc(start), 0],
    ]);
    expect(counters(state)).toBe(2);
    expect(inst(state, cho).damage).toBe(0);
    expect(locateCard(state, cho)).toEqual({ kind: "playArea", playerId: P1 });
  });

  it("a boost icon makes the difference visible: ATK 2 + 1, Hercules defends the redirected attack and takes 1 himself (DEF 2), Cho takes 0", () => {
    const start = withBoostIcons(inPlayWithCho(), 1);
    const cho = theCard(start, AMADEUS_CHO);
    const { state, events } = run(start, endTurn(P1), defend(herc(start)));
    expect(
      ofType(events, "attackResolved").map((e) => [e.targetInstanceId, e.baseAtk, e.boostIcons, e.damageDealt]),
    ).toEqual([[herc(start), 2, 1, 1]]);
    expect(inst(state, herc(state)).damage).toBe(1);
    expect(inst(state, cho).damage).toBe(0);
    expect(counters(state)).toBe(2);
  });

  it("Cho chosen and nobody defends: Cho takes the attack (2) and is defeated, and the counters stay at 3", () => {
    const start = inPlayWithCho();
    const cho = theCard(start, AMADEUS_CHO);
    const { state, events } = run(start, endTurn(P1), defend("none"));
    expect(ofType(events, "attackResolved").map((e) => [e.targetInstanceId, e.damageDealt])).toEqual([[cho, 2]]);
    expect(counters(state)).toBe(3);
    expect(locateCard(state, cho)?.kind).not.toBe("playArea");
    expect(inst(state, herc(state)).damage).toBe(0);
  });

  it("Cho himself defends the redirected attack: Hercules did not defend, so the counters stay at 3", () => {
    const start = inPlayWithCho();
    const cho = theCard(start, AMADEUS_CHO);
    const { state } = run(start, endTurn(P1), defend(cho));
    expect(counters(state)).toBe(3);
  });

  it("with no ally in play the villain attacks Hercules as normal, nothing is redirected and the counters stay at 3, however he defends (February 20, 2026 - Ruling 3)", () => {
    for (const who of ["hercules", "none"] as const) {
      const start = quietDeck(revealed(PROTECT_HUMANITY));
      const cho = theCard(start, AMADEUS_CHO);
      // Surgery: Cho back in the deck, so Hercules has no ally.
      const noAlly: GameState = {
        ...start,
        players: start.players.map((p) =>
          p.playerId === P1 ? { ...p, playArea: p.playArea.filter((i) => i !== cho), deck: [...p.deck, cho] } : p,
        ),
      };
      const { state, events } = run(noAlly, endTurn(P1), defend(who === "hercules" ? herc(noAlly) : "none"));
      expect(ofType(events, "attackRetargeted"), who).toEqual([]);
      expect(
        ofType(events, "attackResolved").map((e) => e.targetInstanceId),
        who,
      ).toEqual([herc(noAlly)]);
      expect(counters(state), who).toBe(3);
    }
  });

  it("three defended attacks: the last counter goes, Protect Humanity is in the victory display, and Atonement is offered in the villain phase", () => {
    let state = inPlayWithCho();
    const labor = theCard(state, PROTECT_HUMANITY);
    const seen = fresh();
    for (const expected of [2, 1]) {
      state = run(state, endTurn(P1), eager(seen, false, defend(herc(state)))).state;
      expect(counters(state)).toBe(expected);
      expect(state.step.phase).toBe("player");
    }
    expect(seen.offeredIn).toEqual([]);
    expect(giftDeck(state)).toHaveLength(3);
    state = run(quietDeck(state), endTurn(P1), eager(seen, false, defend(herc(state)))).state;
    expect(locateCard(state, labor)).toEqual({ kind: "victoryDisplay" });
    expect(victoryCodes(state)).toEqual([PROTECT_HUMANITY]);
    expect(inNoPile(state, labor)).toBe(true);
    expect(seen.offeredIn).toEqual(["villain"]);
    expect(giftDeck(state)).toHaveLength(2);
    expect(giftsInPlay(state)).toHaveLength(1);
    expect(laborCodes(state)).toEqual([DEFEAT_THE_HYDRA, EMBODY_PATHOS]);
  });

  it("two players: only an attack against Hercules is redirected; the attack against the other player is not", () => {
    const start = withLaborOrder(playersGame(2), PROTECT_HUMANITY, DEFEAT_THE_HYDRA, EMBODY_PATHOS);
    const withLabor = withForm(run(start, newLabors(start)).state, { heroForm: 0 });
    const both = withForm(withLabor, { heroForm: 0 }, P2);
    const first = run(quietDeck(both), endTurn(P1), defend("none"));
    const { events } = run(first.state, endTurn(P2), defend("none"));
    const attacks = ofType([...first.events, ...events], "attackResolved");
    expect(attacks.map((e) => e.targetInstanceId)).toEqual([theCard(both, AMADEUS_CHO), identityOf(both, P2)]);
    expect(ofType([...first.events, ...events], "attackRetargeted").map((e) => e.playerId)).toEqual([P1]);
  });

  it("discarded by a player card: last in the Labor deck, facedown, its counters gone, and no Gift", () => {
    const attached = withTestActions(withForm(revealed(PROTECT_HUMANITY), "alterEgo"));
    const labor = theCard(attached, PROTECT_HUMANITY);
    const { state } = run(attached, testAction(attached, DISCARD_LABORS), firstLegal, TEST_DEPS);
    expect(laborCodes(state)).toEqual([DEFEAT_THE_HYDRA, EMBODY_PATHOS, PROTECT_HUMANITY]);
    expect(inst(state, labor)).toMatchObject({ faceup: false, counters: {}, controllerId: null });
    expect(state.victoryDisplay).toEqual([]);
    expect(inNoPile(state, labor)).toBe(true);
    expect(giftDeck(state)).toHaveLength(3);
  });

  it("the last counter removed by a player card (alter-ego form): the victory display, never the encounter discard pile, and no Gift (Atonement is on the hero face)", () => {
    const attached = withTestActions(withForm(revealed(PROTECT_HUMANITY), "alterEgo"));
    const labor = theCard(attached, PROTECT_HUMANITY);
    const atOne = patchInstance(attached, labor, { counters: { labor: 1 } });
    const seen = fresh();
    const { state } = run(atOne, testAction(atOne, REMOVE_LABOR_COUNTER), eager(seen, true), TEST_DEPS);
    expect(victoryCodes(state)).toEqual([PROTECT_HUMANITY]);
    expect(inNoPile(state, labor)).toBe(true);
    expect(seen.offeredIn).toEqual([]);
    expect(giftsInPlay(state)).toEqual([]);
  });
});

describe("Atonement with two Labor cards in one phase", () => {
  it("a second Labor card finished in the same phase earns nothing more (limit once per phase)", () => {
    const start = alterEgo(DEFEAT_THE_HYDRA, EMBODY_PATHOS, PROTECT_HUMANITY);
    const attached = run(start, newLabors(start)).state;
    const hydra = theCard(attached, LERNEAN_HYDRA);
    const brink = withForm(patchInstance(attached, hydra, { damage: 11 }), { heroForm: 0 });
    const seen = fresh();
    // The first Labor card: Hercules defeats the Hydra's minion, takes the Gift and flips to alter-ego form.
    let state = run(brink, basicAttack(brink, herc(brink), hydra), eager(seen, true)).state;
    expect(giftsInPlay(state)).toHaveLength(1);
    expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    // The second: Embody Pathos, a scheme with 1 threat left, thwarted by Hercules (back in hero form) in the same phase.
    state = run(state, newLabors(state), eager(seen, true)).state;
    const scheme = inst(state, theCard(state, EMBODY_PATHOS)).attachedTo!;
    state = patchInstance(state, scheme, { threat: 1 });
    state = run(state, changeForm(P1)).state;
    expect(playerOf(state, P1).identity.form).toBe("hero");
    const hand = handSize(state);
    state = run(state, basicThwart(herc(state), scheme), eager(seen, true)).state;
    expect(victoryCodes(state)).toEqual([EMBODY_PATHOS, DEFEAT_THE_HYDRA]);
    expect(seen.offeredIn).toEqual(["player"]);
    expect(giftsInPlay(state)).toHaveLength(1);
    expect(giftDeck(state)).toHaveLength(2);
    expect(handSize(state)).toBe(hand);
  });
});

describe("59005 to 59007 the Gift cards", () => {
  /** Hercules in hero form with the Hydra at the brink; the Gift deck has `top` first. Atonement is taken, the flip declined. */
  function earned(top: string) {
    const start = alterEgo(DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS);
    const attached = run(start, newLabors(start)).state;
    const hydra = theCard(attached, LERNEAN_HYDRA);
    const brink = withGiftOrder(withForm(patchInstance(attached, hydra, { damage: 11 }), { heroForm: 0 }), top);
    const hand = handSize(brink);
    const hp = maxHitPoints(brink, herc(brink), DEPS);
    const { state } = run(brink, basicAttack(brink, herc(brink), hydra), eager(fresh(), false));
    return { state, hand, hp, gift: theCard(state, top) };
  }

  it.each([
    [NEMEAN, 2],
    [SHIELD, 1],
    [SWORD, 1],
  ])(
    "%s enters play from the Gift deck under his control: Response draws 4 cards, and Hercules gets +%i hit points",
    (code, bonus) => {
      const { state, hand, hp, gift } = earned(code);
      expect(locateCard(state, gift)).toEqual({ kind: "attachment", hostInstanceId: herc(state) });
      expect(inst(state, gift)).toMatchObject({ controllerId: P1, ownerId: P1, faceup: true });
      expect(handSize(state)).toBe(hand + 4);
      expect(maxHitPoints(state, herc(state), DEPS)).toBe((hp ?? 0) + bonus);
      expect(hp).toBe(14);
    },
  );

  it("the draw is a Response: declined, the Gift is in play and no cards are drawn", () => {
    const start = alterEgo(DEFEAT_THE_HYDRA, PROTECT_HUMANITY, EMBODY_PATHOS);
    const attached = run(start, newLabors(start)).state;
    const hydra = theCard(attached, LERNEAN_HYDRA);
    const brink = withGiftOrder(withForm(patchInstance(attached, hydra, { damage: 11 }), { heroForm: 0 }), NEMEAN);
    const hand = handSize(brink);
    const takeAtonementOnly: Picker = (s) => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind !== "chooseTriggers") return firstLegal(s);
      const atonement = choice.options.find((o) => o.ref.kind === "ability" && o.ref.abilityId === ATONEMENT);
      return atonement ? [atonement.optionId] : [];
    };
    const { state } = run(brink, basicAttack(brink, herc(brink), hydra), takeAtonementOnly);
    expect(giftsInPlay(state)).toEqual([theCard(state, NEMEAN)]);
    expect(handSize(state)).toBe(hand);
  });

  it("Nemean Lion Skin: +2 hit points (16) and steady", () => {
    const state = withGift(herculesHeroGame(), NEMEAN);
    expect(maxHitPoints(state, herc(state), DEPS)).toBe(16);
    expect(hasKeyword(state, herc(state), "steady", DEPS)).toBe(true);
    expect(hasKeyword(herculesHeroGame(), herc(herculesHeroGame()), "steady", DEPS)).toBe(false);
  });

  it("Shield of Perseus: +1 hit point (15) and retaliate 1; the villain takes 1 when it attacks him", () => {
    const start = withGift(herculesHeroGame(), SHIELD);
    expect(maxHitPoints(start, herc(start), DEPS)).toBe(15);
    expect(keywordTotal(start, herc(start), "retaliate", DEPS)).toBe(1);
    const quiet = activeEncounterDeck(start)
      .deck.slice(0, 8)
      .reduce((acc, id) => patchInstance(acc, id, { cardId: cardId(ADVANCE) }), start);
    const villain = quiet.activeVillainId!;
    const { state } = run(quiet, endTurn(P1), (s) =>
      s.pendingChoice?.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s),
    );
    expect(inst(state, villain).damage).toBe(1);
  });

  it("Sword of Peleus: +1 hit point (15) and his basic attacks gain piercing: a tough status is discarded and the 3 damage still lands", () => {
    const base = herculesHeroGame();
    const villain = base.activeVillainId!;
    const toughened = patchInstance(base, villain, { statuses: { ...inst(base, villain).statuses, tough: 1 } });
    const without = run(toughened, basicAttack(toughened, herc(toughened), villain)).state;
    expect(inst(without, villain).damage).toBe(0);
    expect(inst(without, villain).statuses.tough).toBe(0);
    const armed = withGift(toughened, SWORD);
    expect(maxHitPoints(armed, herc(armed), DEPS)).toBe(15);
    const after = run(armed, basicAttack(armed, herc(armed), villain)).state;
    expect(inst(after, villain).damage).toBe(3);
    expect(inst(after, villain).statuses.tough).toBe(0);
  });

  it("the Gift bonuses add: all three in play give 14 + 2 + 1 + 1 = 18 hit points", () => {
    const state = withGift(withGift(withGift(herculesHeroGame(), NEMEAN), SHIELD), SWORD);
    expect(maxHitPoints(state, herc(state), DEPS)).toBe(18);
    expect(giftsInPlay(state)).toHaveLength(3);
  });
});
