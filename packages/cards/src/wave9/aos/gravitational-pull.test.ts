import { AOS_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
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
  type Picker,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking, playFromHand, withDamage, withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { GRAVITATIONAL_PULL, GRAVITATIONAL_PULL_SKIPPED } from "./gravitational-pull.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Gravitational Pull set (50139 Moonstone, 50140 Rule the Skies, 50141 Gravitational Pull, 50142 Psychological
 * Manipulation), docs/phase7-wave9.md section 3.35. Rhino (Core, standard) against a Core starter deck, the set's cards
 * added to the encounter deck by hand (a Thunderbolt set is not in the modular pool). Every scenario stacks the
 * encounter deck top first: the villain's boost card, a boost card per engaged Villainous minion, then the card each
 * player is dealt, and ends turns for real. A card in play (Black Cat, Aunt May) is played from hand for real; an
 * engaged Moonstone is placed with `engageMinion`.
 */
const MOONSTONE = "50139";
const RULE_THE_SKIES = "50140";
const PULL = "50141";
const MANIPULATION = "50142";
const SET = [MOONSTONE, RULE_THE_SKIES, PULL, MANIPULATION];
const REFS = [
  "50139.moonstone-forced-response",
  "50140.rule-the-skies-constant",
  "50140.boost",
  "50141.when-revealed",
  "50141.boost",
  "50142.when-revealed-alter-ego",
  "50142.when-revealed-hero",
];
/** Core treachery with no boost icons and no Boost ability; the filler for boost cards that should add nothing. */
const BLANK = "01186";
/** Core treachery with 1 boost icon and no Boost ability. */
const ONE_ICON = "01188";
/** Core Rhino attachments: they attach to the villain without touching the players; the filler for dealt cards. */
const FILLER_A = "01098";
const FILLER_B = "01100";
/** Core Rhino attachment with 2 boost icons, two copies. */
const CHARGE = "01099";
const BLACK_CAT = "01002";
const AUNT_MAY = "01006";

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, GRAVITATIONAL_PULL) };
const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
const SHE_HULK = { starterDeckId: "core-she-hulk-aggression" } as const;
const IRON_MAN = { starterDeckId: "core-iron-man-aggression" } as const;
type Seats = readonly (typeof SPIDER_MAN | typeof CAPTAIN_MARVEL | typeof SHE_HULK | typeof IRON_MAN)[];

function setupGame(players: Seats = [SPIDER_MAN]): GameState {
  const config = coreScenario("rhino", {
    players,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOS_CARDS],
  });
  const cards = AOS_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("gravitational_pull")),
  );
  const copies = cards.flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const piles = (s: GameState) => s.encounterDecks[activeEncounterDeckId(s)]!;
const inDiscard = (s: GameState, code: string) => piles(s).discard.filter((id) => codeOf(s, id) === code);
const inPlayCard = (s: GameState, code: string): InstanceId | undefined =>
  cardsInPlay(s).find((id) => codeOf(s, id) === code);
const idOf = (s: GameState, code: string): InstanceId => {
  const id = Object.keys(s.instances).find((i) => codeOf(s, i as InstanceId) === code);
  return id as InstanceId;
};
const dataOf = (code: string) =>
  AOS_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const attacksBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "attackResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
const schemesBy = (s: GameState, events: readonly GameEvent[], code: string) =>
  types(events, "schemeResolved").filter((a) => codeOf(s, a.enemyInstanceId) === code);
const revealedCodes = (s: GameState, events: readonly GameEvent[]) =>
  types(events, "encounterCardRevealed").map((e) => codeOf(s, e.instanceId));
const flippedBoosts = (events: readonly GameEvent[]) => types(events, "boostCardFlipped");
const tough = (s: GameState, id: InstanceId): number => inst(s, id).statuses.tough;

const heroForm = (s: GameState, ...seats: readonly PlayerId[]): GameState =>
  (seats.length > 0 ? seats : [P1]).reduce((acc, p) => withForm(acc, { heroForm: 0 }, p), s);

/** Every player ends their turn, in seat order, and the villain phase runs on the stacked deck. */
function villainPhase(state: GameState, stack: readonly string[], pick: Picker = firstLegal) {
  const staged = stackEncounterDeck(state, ...stack);
  return driveEventsPicking(DEPS, staged, pick, ...state.players.map((p) => endTurn(p.playerId)));
}

/** An encounter card out of the game: `code` removed from the deck and discard pile. */
function without(state: GameState, code: string): GameState {
  const pile = piles(state);
  const keep = (id: InstanceId) => codeOf(state, id) !== code;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { deck: pile.deck.filter(keep), discard: pile.discard.filter(keep) },
    },
  };
}

/** Moonstone placed in the encounter discard pile. */
function inDiscardPile(state: GameState, code: string): GameState {
  const pile = piles(state);
  const id = pile.deck.find((i) => codeOf(state, i) === code)!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { deck: pile.deck.filter((i) => i !== id), discard: [...pile.discard, id] },
    },
  };
}

/** Picks the option naming the card `target`; any other choice is answered as `firstLegal` does. */
const picking =
  (target: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    // Only the effect's own target prompt: a defender or a trigger prompt is declined, as `firstLegal` does.
    if (choice.prompt.kind !== "chooseTarget") return firstLegal(s);
    const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
    return option ? [option.optionId] : firstLegal(s);
  };

/**
 * The encounter deck exactly `codes`, top first (the rest of the deck and the discard pile are dropped). Finding a card
 * shuffles the encounter deck (RRG 1.8 "Find", p. 19; "Search", p. 39), so a test that stacks cards behind a
 * Gravitational Pull leaves at most one card there: a one-card deck shuffles to itself.
 */
function onlyDeck(state: GameState, ...codes: readonly string[]): GameState {
  const pile = piles(state);
  const used: InstanceId[] = [];
  for (const code of codes) {
    const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code && !used.includes(i));
    if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
    used.push(id);
  }
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [activeEncounterDeckId(state)]: { deck: used, discard: [] } },
  };
}

describe("registry", () => {
  it("registers the seven refs of the four cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(GRAVITATIONAL_PULL).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(GRAVITATIONAL_PULL)) expect(validateDefinition(def), id).toEqual([]);
    expect(GRAVITATIONAL_PULL_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the four cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("setup: all five encounter copies (1 Moonstone, 1 Rule the Skies, 2 Gravitational Pull, 2 Psychological Manipulation) are in the deck", () => {
    const s = setupGame();
    const counts = SET.map((code) => piles(s).deck.filter((id) => codeOf(s, id) === code).length);
    expect(counts).toEqual([1, 1, 2, 2]);
  });
});

describe("Moonstone (50139)", () => {
  it("is data: an Aerial, Elite, Thunderbolt unique minion, ATK 2, SCH 2, 16 hit points, 4 boost icons, Villainous, Victory 1", () => {
    const card = dataOf(MOONSTONE);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([2, 2, 16, 4, true]);
    expect(card.traits).toEqual(["AERIAL", "ELITE", "THUNDERBOLT"]);
    expect(card.keywords).toEqual([{ name: "villainous" }, { name: "victory", value: 1 }]);
  });

  it("FORCED RESPONSE: after her attack in the villain phase she gets 1 tough status card (ATK 2, Villainous boost of 0 icons)", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MOONSTONE, P1);
    expect(tough(engaged, id)).toBe(0);
    const run = villainPhase(engaged, [BLANK, BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, MOONSTONE)).toMatchObject([{ baseAtk: 2, boostIcons: 0, damageDealt: 2 }]);
    expect(tough(run.state, id)).toBe(1);
  });

  it("FORCED RESPONSE: after her scheme against an alter-ego she gets a tough status card (SCH 2, 2 threat placed)", () => {
    const { state: engaged, id } = engageMinion(setupGame(), MOONSTONE, P1);
    const run = villainPhase(engaged, [BLANK, BLANK, FILLER_A]);
    expect(schemesBy(run.state, run.events, MOONSTONE)).toMatchObject([{ baseSch: 2, boostIcons: 0, threatPlaced: 2 }]);
    expect(tough(run.state, id)).toBe(1);
  });

  it("a second activation gives no second tough status card (a character holds one)", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MOONSTONE, P1);
    const first = villainPhase(engaged, [BLANK, BLANK, FILLER_A]);
    const second = villainPhase(heroForm(patchInstance(first.state, identityOf(first.state), { damage: 0 })), [
      BLANK,
      BLANK,
      FILLER_B,
    ]);
    expect(attacksBy(second.state, second.events, MOONSTONE)).toHaveLength(1);
    expect(tough(second.state, id)).toBe(1);
  });

  it("no other enemy's activation gives her a status card: Rhino alone activates, Moonstone is not in play", () => {
    const run = villainPhase(setupGame(), [BLANK, FILLER_A]);
    expect(schemesBy(run.state, run.events, MOONSTONE)).toEqual([]);
    expect(inst(run.state, idOf(run.state, MOONSTONE)).statuses.tough).toBe(0);
  });

  it("VILLAINOUS: she is dealt a boost card, so a 1-icon boost makes her attack ATK 2 + 1 = 3 damage", () => {
    const { state: engaged } = engageMinion(heroForm(setupGame()), MOONSTONE, P1);
    const run = villainPhase(engaged, [BLANK, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, MOONSTONE)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
  });

  it("VICTORY 1: defeated, she goes to the victory display", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MOONSTONE, P1);
    const after = defeatWithAttack(DEPS, engaged, id);
    expect(after.victoryDisplay).toContain(id);
    expect(inPlayCard(after, MOONSTONE)).toBeUndefined();
  });
});

describe("Rule the Skies (50140)", () => {
  it("is data: a side scheme with 3 threat per player and a hazard icon, 2 boost icons and a star", () => {
    const card = dataOf(RULE_THE_SKIES);
    expect(card.startingThreat).toEqual({ base: 0, perPlayer: 3 });
    expect([card.icons, card.boostIcons, card.starIcon]).toEqual([["hazard"], 2, true]);
  });

  /** Round 1 reveals Rule the Skies (3 threat for one player), round 2 is `phase`. */
  const withScheme = (players: Seats = [SPIDER_MAN]) => {
    const revealed = villainPhase(setupGame(players), [BLANK, RULE_THE_SKIES, FILLER_A]);
    return revealed.state;
  };

  it("is placed into play with 3 threat for one player, 6 for two", () => {
    const one = withScheme();
    expect(inst(one, inPlayCard(one, RULE_THE_SKIES)!).threat).toBe(3);
    const two = villainPhase(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), [
      BLANK,
      BLANK,
      RULE_THE_SKIES,
      FILLER_A,
      FILLER_B,
    ]);
    expect(inst(two.state, inPlayCard(two.state, RULE_THE_SKIES)!).threat).toBe(6);
  });

  it("CONSTANT: an Aerial character gets +1 ATK: Moonstone attacks with ATK 3, damage 3 (2 without it)", () => {
    const control = engageMinion(heroForm(setupGame()), MOONSTONE, P1);
    const base = villainPhase(control.state, [BLANK, BLANK, FILLER_A]);
    expect(attacksBy(base.state, base.events, MOONSTONE)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);

    const staged = engageMinion(heroForm(withScheme()), MOONSTONE, P1);
    const run = villainPhase(staged.state, [BLANK, BLANK, FILLER_A, FILLER_B]);
    expect(attacksBy(run.state, run.events, MOONSTONE)).toMatchObject([{ baseAtk: 3, damageDealt: 3 }]);
  });

  it("CONSTANT: a character without the Aerial trait gets nothing: Rhino's ATK is the same with and without it", () => {
    const base = villainPhase(heroForm(setupGame()), [BLANK, FILLER_A]);
    const run = villainPhase(heroForm(withScheme()), [BLANK, FILLER_A, FILLER_B]);
    const rhino = (r: typeof base) => types(r.events, "attackResolved").map((a) => a.baseAtk);
    expect(rhino(run)).toEqual(rhino(base));
    expect(rhino(base)).toHaveLength(1);
  });

  it("BOOST on Aerial Moonstone: her attack gets an additional boost card (2 + 1 icons), ATK 2 + 3 = 5 damage", () => {
    const staged = engageMinion(heroForm(setupGame()), MOONSTONE, P1);
    const run = villainPhase(staged.state, [BLANK, RULE_THE_SKIES, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, MOONSTONE)).toMatchObject([{ baseAtk: 2, boostIcons: 3, damageDealt: 5 }]);
    expect(flippedBoosts(run.events)).toHaveLength(3);
  });

  it("BOOST on a non-Aerial enemy (Rhino): no additional boost card, only the card's own 2 icons", () => {
    const run = villainPhase(heroForm(setupGame()), [RULE_THE_SKIES, ONE_ICON, FILLER_A]);
    const [attack] = types(run.events, "attackResolved");
    expect([attack!.boostIcons]).toEqual([2]);
    expect(flippedBoosts(run.events)).toHaveLength(1);
  });

  it("BOOST on Aerial Moonstone's scheme: also an additional boost card (SCH 2 + 3 icons = 5 threat)", () => {
    const staged = engageMinion(setupGame(), MOONSTONE, P1);
    const run = villainPhase(staged.state, [BLANK, RULE_THE_SKIES, ONE_ICON, FILLER_A]);
    expect(schemesBy(run.state, run.events, MOONSTONE)).toMatchObject([{ baseSch: 2, boostIcons: 3, threatPlaced: 5 }]);
    expect(flippedBoosts(run.events)).toHaveLength(3);
  });
});

describe("Gravitational Pull (50141)", () => {
  it("is data: a treachery with 1 boost icon and a star, two copies", () => {
    const card = dataOf(PULL);
    expect([card.type, card.boostIcons, card.starIcon, card.quantityInSet]).toEqual(["treachery", 1, true, 2]);
  });

  // The deck behind the treachery is a single card: the find shuffles it, and one card shuffles to itself.
  it("WHEN REVEALED (hero): Moonstone is found in the deck, engages the revealing player and attacks: ATK 2 + 1 icon = 3 damage; no surge", () => {
    const state = onlyDeck(heroForm(setupGame()), BLANK, PULL, MOONSTONE, ONE_ICON);
    const run = villainPhase(state, []);
    const moonstone = inPlayCard(run.state, MOONSTONE)!;
    expect(inst(run.state, moonstone).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, MOONSTONE)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
    expect(tough(run.state, moonstone)).toBe(1);
    expect(inDiscard(run.state, PULL)).toHaveLength(1);
    expect(revealedCodes(run.state, run.events)).toEqual([PULL, MOONSTONE]);
  });

  it("WHEN REVEALED (alter-ego): Moonstone schemes against the player: SCH 2 + 1 icon = 3 threat placed; no surge", () => {
    const run = villainPhase(onlyDeck(setupGame(), BLANK, PULL, MOONSTONE, ONE_ICON), []);
    const moonstone = inPlayCard(run.state, MOONSTONE)!;
    expect(inst(run.state, moonstone).engagedWith).toBe(P1);
    expect(schemesBy(run.state, run.events, MOONSTONE)).toMatchObject([{ baseSch: 2, boostIcons: 1, threatPlaced: 3 }]);
    expect(tough(run.state, moonstone)).toBe(1);
    expect(revealedCodes(run.state, run.events)).toEqual([PULL, MOONSTONE]);
  });

  it("WHEN REVEALED: Moonstone is found in the encounter discard pile just the same", () => {
    const state = inDiscardPile(onlyDeck(setupGame(), BLANK, PULL, MOONSTONE, ONE_ICON), MOONSTONE);
    expect(inDiscard(state, MOONSTONE)).toHaveLength(1);
    const run = villainPhase(state, []);
    expect(inPlayCard(run.state, MOONSTONE)).toBeDefined();
    expect(schemesBy(run.state, run.events, MOONSTONE)).toMatchObject([{ baseSch: 2, boostIcons: 1, threatPlaced: 3 }]);
  });

  it("WHEN REVEALED: with Moonstone already in play (engaged with player 2) she engages the revealing player 1 and activates against them", () => {
    const { state: engaged, id } = engageMinion(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), MOONSTONE, P2);
    // Rhino activates against each player (boosts: the Suit, 0 icons, and an Advance, 0 icons), then Moonstone against
    // player 2 (the other Advance, 0 icons). Player 1 is dealt the treachery; Moonstone's boost against player 1 and the
    // card dealt to player 2 are the two Charge (2 icons each), alike after the find shuffles them.
    const state = onlyDeck(engaged, FILLER_A, BLANK, BLANK, PULL, CHARGE, CHARGE);
    const run = villainPhase(state, []);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    expect(schemesBy(run.state, run.events, MOONSTONE).map((s) => s.threatPlaced)).toEqual([2, 4]);
    expect(revealedCodes(run.state, run.events)).toEqual([PULL, MOONSTONE, CHARGE]);
  });

  it("WHEN REVEALED: with no Moonstone anywhere nothing activates and this card gains surge: the next card is revealed", () => {
    const run = villainPhase(onlyDeck(without(setupGame(), MOONSTONE), BLANK, PULL, FILLER_A), []);
    expect(inPlayCard(run.state, MOONSTONE)).toBeUndefined();
    expect(revealedCodes(run.state, run.events)).toEqual([PULL, FILLER_A]);
    expect(schemesBy(run.state, run.events, MOONSTONE)).toEqual([]);
  });

  it("BOOST: the player chooses a character they control to exhaust (Black Cat, not the identity); the attack has 1 more icon", () => {
    const { state: withCat, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const state = heroForm(withCat);
    const run = villainPhase(state, [PULL, FILLER_A], picking(cat));
    expect(inst(run.state, cat).exhausted).toBe(true);
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(false);
    const [attack] = types(run.events, "attackResolved");
    expect(attack!.boostIcons).toBe(1);
  });

  it("BOOST: choosing the identity exhausts it instead (the ally stays ready)", () => {
    const { state: withCat, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const state = heroForm(withCat);
    const run = villainPhase(state, [PULL, FILLER_A], picking(identityOf(state)));
    expect(inst(run.state, identityOf(run.state)).exhausted).toBe(true);
    expect(inst(run.state, cat).exhausted).toBe(false);
  });
});

describe("Psychological Manipulation (50142)", () => {
  it("is data: a treachery with 1 boost icon, two copies, one ability for each form", () => {
    const card = dataOf(MANIPULATION);
    expect([card.type, card.boostIcons, card.quantityInSet]).toEqual(["treachery", 1, 2]);
  });

  it("ALTER-EGO: discards the ally the player controls (Black Cat); no surge", () => {
    const { state, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const run = villainPhase(state, [BLANK, MANIPULATION, FILLER_A]);
    expect(playerOf(run.state, P1).discard).toContain(cat);
    expect(playerOf(run.state, P1).playArea).not.toContain(cat);
    expect(revealedCodes(run.state, run.events)).toEqual([MANIPULATION]);
  });

  it("ALTER-EGO: with an ally and a support the player chooses which one is discarded (Aunt May; the ally stays)", () => {
    const first = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const second = playFromHand(DEPS, first.state, AUNT_MAY, 1);
    const run = villainPhase(second.state, [BLANK, MANIPULATION, FILLER_A], picking(second.id));
    expect(playerOf(run.state, P1).discard).toContain(second.id);
    expect(playerOf(run.state, P1).playArea).toContain(first.id);
    expect(playerOf(run.state, P1).playArea).not.toContain(second.id);
  });

  it("ALTER-EGO: with no ally or support, nothing is discarded and this card gains surge (the next card is revealed)", () => {
    const run = villainPhase(setupGame(), [BLANK, MANIPULATION, FILLER_A]);
    expect(revealedCodes(run.state, run.events)).toEqual([MANIPULATION, FILLER_A]);
  });

  it("HERO: deals damage equal to Spider-Man's ATK (2) to the friendly character with the fewest remaining hit points: Black Cat (2) is defeated", () => {
    const { state, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const hero = heroForm(state);
    const run = villainPhase(hero, [BLANK, MANIPULATION, FILLER_A]);
    expect(playerOf(run.state, P1).discard).toContain(cat);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(types(run.events, "attackResolved")[0]!.damageDealt);
  });

  it("HERO: with the identity (3 remaining after Rhino's 2) not the fewest, only Black Cat takes the 2", () => {
    const { state, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const hurt = withDamage(heroForm(state), identityOf(state), 5);
    const run = villainPhase(hurt, [BLANK, MANIPULATION, FILLER_A]);
    expect(playerOf(run.state, P1).discard).toContain(cat);
    // Rhino's attack happened first; the identity took nothing from the treachery.
    const rhinoHit = types(run.events, "attackResolved")[0]!.damageDealt;
    expect(inst(run.state, identityOf(run.state)).damage).toBe(5 + rhinoHit);
  });

  it("HERO: a tie for fewest remaining hit points is the revealing player's choice (identity and Daredevil at 3 remaining)", () => {
    const { state, id: daredevil } = playFromHand(DEPS, setupGame(), "01058", 4);
    // Rhino's attack takes the identity from 5 damage to 7, 3 remaining, the same as Daredevil's 3 hit points.
    const base = withDamage(heroForm(state), identityOf(state), 5);
    const pickDaredevil = villainPhase(base, [BLANK, MANIPULATION, FILLER_A], picking(daredevil));
    expect(inst(pickDaredevil.state, daredevil).damage).toBe(2);
    expect(inst(pickDaredevil.state, identityOf(base)).damage).toBe(7);
    const pickIdentity = villainPhase(base, [BLANK, MANIPULATION, FILLER_A], picking(identityOf(base)));
    expect(inst(pickIdentity.state, daredevil).damage).toBe(0);
    expect(inst(pickIdentity.state, identityOf(base)).damage).toBe(9);
  });

  it("HERO: X is the hero's ATK: She-Hulk (ATK 3) deals 3 to herself, the only friendly character", () => {
    const state = heroForm(setupGame([SHE_HULK]));
    const run = villainPhase(state, [BLANK, MANIPULATION, FILLER_A]);
    const rhinoHit = types(run.events, "attackResolved")[0]!.damageDealt;
    expect(inst(run.state, identityOf(run.state)).damage).toBe(rhinoHit + 3);
  });

  it("HERO: Iron Man (ATK 1) deals 1 to himself", () => {
    const state = heroForm(setupGame([IRON_MAN]));
    const run = villainPhase(state, [BLANK, MANIPULATION, FILLER_A]);
    const rhinoHit = types(run.events, "attackResolved")[0]!.damageDealt;
    expect(inst(run.state, identityOf(run.state)).damage).toBe(rhinoHit + 1);
  });

  it("HERO: the fewest is read over every player's friendly characters: player 2's Black Cat takes it, not the revealer", () => {
    const base = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const caped = playFromHand(DEPS, base, BLACK_CAT, 2, firstLegal, P1);
    // Cat belongs to player 1 here; the revealer (player 2, dealt second) is Captain Marvel with 12 hit points.
    const hero = heroForm(caped.state, P1, P2);
    const run = villainPhase(hero, [BLANK, BLANK, FILLER_A, MANIPULATION]);
    expect(playerOf(run.state, P1).discard).toContain(caped.id);
    expect(inst(run.state, identityOf(run.state, P2)).damage).toBe(
      types(run.events, "attackResolved")
        .filter((a) => a.targetInstanceId === identityOf(run.state, P2))
        .reduce((n, a) => n + a.damageDealt, 0),
    );
  });
});
