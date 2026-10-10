import { AOS_CARDS, CORE_CARDS } from "@mc/content";
import type { GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { P1, P2, P3, identityOf, inst, mainThreat, type Picker } from "../../testing/harness.js";
import { encounterCardInVillainArea } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  CHARGE,
  FILLER_A,
  FILLER_B,
  ONE_ICON,
  SHE_HULK,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  dataOf,
  heroAttacks as sharedHeroAttacks,
  heroForm,
  inDiscard,
  inPlayCard,
  onlyDeck,
  picking,
  revealedCodes,
  schemesBy,
  setKit,
  types,
  without,
} from "../testing.js";
import { THE_LEAPER, THE_LEAPER_SKIPPED } from "./the-leaper.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Leaper set (50161 Batroc, 50162 Coup de Foudre, 50163 Batroc the Leaper, 50164 Parcours du Combattant),
 * docs/phase7-wave9.md sections 3.24 and 3.35. Rhino (Core, standard) against Core starter decks, the set's cards added
 * to the encounter deck by hand. Engaged minions are placed with `engageMinion`; Coup de Foudre is placed with
 * `encounterCardInVillainArea` (no threat, so its own count shows); a villain phase runs for real.
 *
 * Rhino activates once against each player, then each engaged minion, and each activation turns up one boost card, so
 * a stacked encounter deck starts with that many boost cards, then the cards dealt to the players in seat order.
 */
const BATROC = "50161";
const COUP = "50162";
const LEAPER = "50163";
const PARCOURS = "50164";
const SET = [BATROC, COUP, LEAPER, PARCOURS];
const REFS = [
  "50161.batroc-forced-interrupt",
  "50162.coup-de-foudre-forced-interrupt",
  "50163.when-revealed",
  "50163.boost",
  "50164.when-revealed",
  "50164.boost",
];
/** Core minions (ATK/SCH/HP/boost): Hydra Mercenary 1/0/3/1, Shocker 2/1/3/2, Sandman 3/2/4/2. */
const MERCENARY = "01101";
const SANDMAN = "01102";
const SHOCKER = "01103";
/** Basic cards every Core starter deck holds, by printed resource: physical 01092, mental 01084, energy 01085, 01087, 01093. */
const PHYSICAL = "01092";
const MENTAL = "01084";
const ENERGY_A = "01085";
const ENERGY_B = "01087";
const ENERGY_C = "01093";

const { deps: DEPS, setupGame, villainPhase } = setKit("the_leaper", THE_LEAPER);

const heroAttacks = (state: GameState, target: InstanceId) => sharedHeroAttacks(DEPS, state, target);
/**
 * `n` boost cards that add nothing: no icons and no Boost ability (Advance, Hard to Keep Down, "I'm Tough!", Assault;
 * two copies each, the most a stacked deck can hold).
 */
const blanks = (n: number) => ["01186", "01186", "01104", "01104", "01105", "01105", "01187", "01187"].slice(0, n);
const discardOf = (s: GameState, p: PlayerId) => s.players.find((x) => x.playerId === p)!.discard;
const handOf = (s: GameState, p: PlayerId) => s.players.find((x) => x.playerId === p)!.hand;
const engagedWith = (s: GameState, code: string) => inst(s, inPlayCard(s, code)!).engagedWith;
const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
const THREE = [SPIDER_MAN, CAPTAIN_MARVEL, SHE_HULK] as const;
const dataByCode = (code: string) =>
  [...CORE_CARDS, ...AOS_CARDS].find((c) => (c.id as string) === code) as unknown as {
    resourceIcons?: Record<string, number>;
    atk?: number;
    sch?: number;
    keywords?: readonly { name: string }[];
  };
const iconsOf = (code: string) => (dataByCode(code).resourceIcons ?? {}) as Record<string, number>;

/**
 * Boost cards drawn before the encounter cards are dealt: Rhino's one activation against each player, then one for each
 * Villainous minion (only a villain or a Villainous minion is dealt a boost card, RRG 1.8 "Boost", p. 11) engaged with a
 * player, that has an ATK (hero form) or SCH (alter-ego) to use.
 */
const boostsBefore = (s: GameState): number =>
  s.players.length +
  Object.values(s.instances).filter((i) => {
    if (!i.engagedWith) return false;
    const card = dataByCode(i.cardId as string);
    if (!card.keywords?.some((k) => k.name === "villainous")) return false;
    const hero = s.players.find((p) => p.playerId === i.engagedWith)!.identity.form === "hero";
    return ((hero ? card.atk : card.sch) ?? 0) > 0;
  }).length;
/** A villain phase on a stacked deck: harmless boost cards for every activation, then `dealt` in seat order. */
const phase = (state: GameState, dealt: readonly string[], pick?: Picker) =>
  villainPhase(state, [...blanks(boostsBefore(state)), ...dealt], pick);

/**
 * The player's deck with these cards on top, in order: for each kind, a card from the deck (not the hand, so the
 * hand stays full and nothing is drawn before the villain phase) printing exactly one resource of that type.
 */
function deckTop(state: GameState, player: PlayerId, ...kinds: readonly ("energy" | "mental" | "physical")[]) {
  const owner = state.players.find((p) => p.playerId === player)!;
  const ids: InstanceId[] = [];
  for (const kind of kinds) {
    const id = owner.deck.find((i) => {
      const icons = iconsOf(codeOf(state, i));
      return !ids.includes(i) && Object.keys(icons).length === 1 && icons[kind] === 1;
    });
    if (!id) throw new Error(`${player} has no further ${kind} card in their deck`);
    ids.push(id);
  }
  return {
    ids,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, deck: [...ids, ...p.deck.filter((i) => !ids.includes(i))] } : p,
      ),
    },
  };
}
/** The cards that left the player's deck for their discard pile, in order. */
const milled = (events: readonly GameEvent[], player: PlayerId) =>
  types(events, "cardMoved")
    .filter((e) => e.from.kind === "deck" && e.to.kind === "discard" && "playerId" in e.to && e.to.playerId === player)
    .map((e) => e.instanceId);

describe("registry", () => {
  it("registers the six refs of the four cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(THE_LEAPER).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(THE_LEAPER)) expect(validateDefinition(def), id).toEqual([]);
    expect(THE_LEAPER_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the four cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("setup: all six encounter copies (1 Batroc, 1 Coup de Foudre, 2 Batroc the Leaper, 2 Parcours du Combattant) are in the deck", () => {
    const s = setupGame();
    const deck = s.encounterDecks[Object.keys(s.encounterDecks)[0]!]!.deck;
    expect(SET.map((code) => deck.filter((id) => codeOf(s, id) === code).length)).toEqual([1, 1, 2, 2]);
  });

  it("the test's resource assumptions hold: 01085, 01087, 01093 print one energy, 01084 one mental, 01092 one physical", () => {
    expect([ENERGY_A, ENERGY_B, ENERGY_C].map(iconsOf)).toEqual([{ energy: 1 }, { energy: 1 }, { energy: 1 }]);
    expect(iconsOf(MENTAL)).toEqual({ mental: 1 });
    expect(iconsOf(PHYSICAL)).toEqual({ physical: 1 });
  });
});

describe("Batroc (50161)", () => {
  it("is data: an Elite Thunderbolt unique minion, ATK 2, SCH 1, 16 hit points, 4 boost icons, Villainous, Victory 1", () => {
    const card = dataOf(BATROC);
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([
      "minion",
      2,
      1,
      16,
      4,
      true,
    ]);
    expect(card.traits).toEqual(["ELITE", "THUNDERBOLT"]);
    expect(card.keywords).toEqual([{ name: "villainous" }, { name: "victory", value: 1 }]);
  });

  it("FORCED INTERRUPT: revealed into play he engages the player it was dealt to, who discards 1 card from their hand", () => {
    const run = phase(setupGame(), [BATROC, FILLER_A]);
    expect(engagedWith(run.state, BATROC)).toBe(P1);
    expect(discardOf(run.state, P1)).toHaveLength(1);
    expect(handOf(run.state, P1)).toHaveLength(5);
    expect(revealedCodes(run.state, run.events)).toEqual([BATROC]);
  });

  it("FORCED INTERRUPT: in a two-player game only the player he engages discards (player 2 is dealt him)", () => {
    const run = phase(setupGame(TWO), [FILLER_A, BATROC, FILLER_B]);
    expect(engagedWith(run.state, BATROC)).toBe(P2);
    expect([P1, P2].map((p) => discardOf(run.state, p).length)).toEqual([0, 1]);
  });

  it("is not triggered by a minion already engaged: Batroc in play with player 1 and nobody discards", () => {
    const { state } = engageMinion(setupGame(), BATROC, P1);
    const run = phase(state, [FILLER_A]);
    expect(discardOf(run.state, P1)).toHaveLength(0);
  });

  it("alter-ego villain phase: SCH 1 + 1 boost icon = 2 threat on the main scheme (he does not attack)", () => {
    const { state } = engageMinion(setupGame(), BATROC, P1);
    const run = villainPhase(state, [BLANK, ONE_ICON, FILLER_A]);
    expect(schemesBy(run.state, run.events, BATROC)).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
    expect(attacksBy(run.state, run.events, BATROC)).toEqual([]);
    expect(discardOf(run.state, P1)).toHaveLength(0);
  });

  it("hero villain phase: ATK 2 + 1 boost icon = 3 damage", () => {
    const { state } = engageMinion(heroForm(setupGame()), BATROC, P1);
    const run = villainPhase(state, [BLANK, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, BATROC)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
  });

  it("has 16 hit points: a hero's attack of 2 leaves him with 2 damage", () => {
    const { state, id } = engageMinion(heroForm(setupGame()), BATROC, P1);
    const run = heroAttacks(state, id);
    expect(inst(run.state, id).damage).toBe(2);
    expect(inPlayCard(run.state, BATROC)).toBe(id);
  });

  it("FORCED INTERRUPT: moved by a rotation from player 1 to player 2, player 2 discards 1 card and player 1 none", () => {
    const { state } = engageMinion(setupGame(TWO), BATROC, P1);
    const run = phase(state, [PARCOURS, FILLER_A, FILLER_B]);
    expect(engagedWith(run.state, BATROC)).toBe(P2);
    expect([P1, P2].map((p) => discardOf(run.state, p).length)).toEqual([0, 1]);
  });
});

describe("Coup de Foudre (50162)", () => {
  it("is data: a side scheme with 5 threat (not per hero), the acceleration icon, 2 boost icons", () => {
    const card = dataOf(COUP);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons]).toEqual([
      "side_scheme",
      { base: 5, perPlayer: 0 },
      ["acceleration"],
      2,
    ]);
  });

  it("revealed it has its 5 threat, and no deck is discarded from", () => {
    const run = phase(setupGame(), [COUP, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, COUP)!).threat).toBe(5);
    expect(milled(run.events, P1)).toEqual([]);
  });

  it("FORCED INTERRUPT: Batroc (4 icons) engages player 1: the top 4 cards are discarded, 3 of them energy = 3 threat; the 5th card stays", () => {
    const stacked = deckTop(setupGame(), P1, "energy", "mental", "energy", "energy", "physical");
    const { state, id: coup } = encounterCardInVillainArea(stacked.state, COUP);
    const run = phase(state, [BATROC, FILLER_A]);
    expect(milled(run.events, P1)).toEqual(stacked.ids.slice(0, 4));
    expect(discardOf(run.state, P1)).not.toContain(stacked.ids[4]);
    // Four cards from the deck and Batroc's one from the hand.
    expect(discardOf(run.state, P1)).toHaveLength(5);
    expect(inst(run.state, coup).threat).toBe(3);
  });

  it("FORCED INTERRUPT: no energy among the 4 cards discarded places 0 threat", () => {
    const stacked = deckTop(setupGame(), P1, "mental", "physical", "mental", "physical", "energy");
    const { state, id: coup } = encounterCardInVillainArea(stacked.state, COUP);
    const run = phase(state, [BATROC, FILLER_A]);
    expect(milled(run.events, P1)).toEqual(stacked.ids.slice(0, 4));
    expect(inst(run.state, coup).threat).toBe(0);
  });

  it("FORCED INTERRUPT: all 4 cards energy = 4 threat", () => {
    const stacked = deckTop(setupGame(), P1, "energy", "energy", "energy", "energy", "mental");
    const { state, id: coup } = encounterCardInVillainArea(stacked.state, COUP);
    const run = phase(state, [BATROC, FILLER_A]);
    expect(inst(run.state, coup).threat).toBe(4);
  });

  it("FORCED INTERRUPT: Hydra Mercenary (1 icon) rotated to player 2: player 2 discards the top card only, an energy card = 1 threat; player 1 discards nothing", () => {
    const { state: engaged } = engageMinion(setupGame(TWO), MERCENARY, P1);
    const stacked = deckTop(engaged, P2, "energy", "energy", "energy");
    const { state, id: coup } = encounterCardInVillainArea(stacked.state, COUP);
    const run = phase(state, [PARCOURS, FILLER_A, FILLER_B]);
    expect(engagedWith(run.state, MERCENARY)).toBe(P2);
    expect(milled(run.events, P2)).toEqual([stacked.ids[0]]);
    expect(milled(run.events, P1)).toEqual([]);
    expect(inst(run.state, coup).threat).toBe(1);
  });

  it("FORCED INTERRUPT: Sandman (2 icons) rotated to player 2: two cards, energy + mental = 1 threat", () => {
    const { state: engaged } = engageMinion(setupGame(TWO), SANDMAN, P1);
    const stacked = deckTop(engaged, P2, "energy", "mental", "energy");
    const { state, id: coup } = encounterCardInVillainArea(stacked.state, COUP);
    const run = phase(state, [PARCOURS, FILLER_A, FILLER_B]);
    expect(milled(run.events, P2)).toEqual([stacked.ids[0], stacked.ids[1]]);
    expect(inst(run.state, coup).threat).toBe(1);
  });

  it("FORCED INTERRUPT: Batroc rotated to player 2: player 2 discards 4 deck cards (3 energy = 3 threat) and 1 card from hand", () => {
    const { state: engaged } = engageMinion(setupGame(TWO), BATROC, P1);
    const stacked = deckTop(engaged, P2, "energy", "mental", "energy", "energy", "physical");
    const { state, id: coup } = encounterCardInVillainArea(stacked.state, COUP);
    const run = phase(state, [PARCOURS, FILLER_A, FILLER_B]);
    expect(milled(run.events, P2)).toEqual(stacked.ids.slice(0, 4));
    expect(milled(run.events, P1)).toEqual([]);
    expect(discardOf(run.state, P2)).toHaveLength(5);
    expect(discardOf(run.state, P1)).toEqual([]);
    expect(inst(run.state, coup).threat).toBe(3);
  });

  it("FORCED INTERRUPT: the threat is placed on Coup de Foudre, not on the main scheme", () => {
    const stacked = deckTop(setupGame(), P1, "energy", "energy", "energy", "energy", "mental");
    const { state } = encounterCardInVillainArea(stacked.state, COUP);
    const withBatroc = phase(state, [BATROC, FILLER_A]);
    const without = phase(state, [FILLER_A, FILLER_B]);
    expect(mainThreat(withBatroc.state)).toBe(mainThreat(without.state));
  });

  it("FORCED INTERRUPT: fewer cards in the deck than icons discards what is there", () => {
    const base = setupGame();
    const thin = { ...base, players: base.players.map((p) => ({ ...p, deck: p.deck.slice(0, 2) })) };
    const { state, id: coup } = encounterCardInVillainArea(thin, COUP);
    const deckCards = state.players[0]!.deck;
    const run = phase(state, [BATROC, FILLER_A]);
    expect(milled(run.events, P1)).toEqual(deckCards);
    expect(inst(run.state, coup).threat).toBe(
      deckCards.filter((id) => (iconsOf(codeOf(state, id)).energy ?? 0) > 0).length,
    );
  });
});

describe("Batroc the Leaper (50163)", () => {
  it("is data: a treachery with 1 boost icon and a star, two copies", () => {
    const card = dataOf(LEAPER);
    expect([card.type, card.boostIcons, card.starIcon, card.quantityInSet]).toEqual(["treachery", 1, true, 2]);
  });

  it("WHEN REVEALED (alter-ego): Batroc is found, engages the revealing player (who discards 1 card) and schemes: SCH 1 + 1 icon = 2 threat; no surge", () => {
    const run = villainPhase(onlyDeck(setupGame(), BLANK, LEAPER, BATROC, ONE_ICON), []);
    expect(engagedWith(run.state, BATROC)).toBe(P1);
    expect(schemesBy(run.state, run.events, BATROC)).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
    expect(discardOf(run.state, P1)).toHaveLength(1);
    expect(revealedCodes(run.state, run.events)).toEqual([LEAPER, BATROC]);
    expect(inDiscard(run.state, LEAPER)).toHaveLength(1);
  });

  it("WHEN REVEALED (hero): Batroc attacks the revealing player: ATK 2 + 1 icon = 3 damage", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, LEAPER, BATROC, ONE_ICON), []);
    expect(attacksBy(run.state, run.events, BATROC)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
  });

  it("WHEN REVEALED: with Batroc already in play engaged with player 2, he engages the revealing player 1 (who discards 1) and schemes against them", () => {
    const { state: engaged } = engageMinion(setupGame(TWO), BATROC, P2);
    // Rhino x2 and Batroc's scheme against player 2 each turn a boost card; player 1 is dealt the treachery, whose
    // find-and-reveal activates Batroc against them (boost: one icon).
    const run = villainPhase(onlyDeck(engaged, ...blanks(3), LEAPER, FILLER_A, ONE_ICON), []);
    expect(engagedWith(run.state, BATROC)).toBe(P1);
    expect(schemesBy(run.state, run.events, BATROC).map((a) => a.threatPlaced)).toEqual([1, 2]);
    expect([P1, P2].map((p) => discardOf(run.state, p).length)).toEqual([1, 0]);
  });

  it("WHEN REVEALED: with no Batroc anywhere nothing activates and this card gains surge: the next card is revealed", () => {
    const run = villainPhase(onlyDeck(without(setupGame(), BATROC), BLANK, LEAPER, FILLER_A), []);
    expect(inPlayCard(run.state, BATROC)).toBeUndefined();
    expect(revealedCodes(run.state, run.events)).toEqual([LEAPER, FILLER_A]);
  });

  it("BOOST: the attacked player discards 1 card from their hand (Rhino's scheme in alter-ego, 1 icon)", () => {
    const base = villainPhase(setupGame(), [ONE_ICON, FILLER_A]);
    const run = villainPhase(setupGame(), [LEAPER, FILLER_A]);
    expect(discardOf(base.state, P1)).toHaveLength(0);
    expect(discardOf(run.state, P1)).toHaveLength(1);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
  });

  it("BOOST: in hero form the hand-size discard at the end of the turn is the only other discard: the boost makes 2", () => {
    const base = villainPhase(heroForm(setupGame()), [ONE_ICON, FILLER_A]);
    const run = villainPhase(heroForm(setupGame()), [LEAPER, FILLER_A]);
    expect(discardOf(run.state, P1).length).toBe(discardOf(base.state, P1).length + 1);
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ boostIcons: 1 });
  });
});

describe("Parcours du Combattant (50164)", () => {
  it("is data: a treachery with Surge, 1 boost icon and a star, two copies", () => {
    const card = dataOf(PARCOURS);
    expect([card.type, card.boostIcons, card.starIcon, card.quantityInSet, card.keywords]).toEqual([
      "treachery",
      1,
      true,
      2,
      [{ name: "surge" }],
    ]);
  });

  it("WHEN REVEALED, one player: nothing moves, and Surge reveals the next card", () => {
    const { state } = engageMinion(setupGame(), BATROC, P1);
    const run = phase(state, [PARCOURS, FILLER_A]);
    expect(engagedWith(run.state, BATROC)).toBe(P1);
    expect(discardOf(run.state, P1)).toHaveLength(0);
    expect(revealedCodes(run.state, run.events)).toEqual([PARCOURS, FILLER_A]);
  });

  it("WHEN REVEALED, two players: player 1's minion goes to player 2 and player 2's to player 1, all at once", () => {
    const one = engageMinion(setupGame(TWO), SANDMAN, P1);
    const two = engageMinion(one.state, SHOCKER, P2);
    const run = phase(two.state, [PARCOURS, FILLER_A, FILLER_B]);
    expect(engagedWith(run.state, SANDMAN)).toBe(P2);
    expect(engagedWith(run.state, SHOCKER)).toBe(P1);
    // Both players are dealt a card first; the Surge reveal then takes the third.
    expect(revealedCodes(run.state, run.events)).toEqual([PARCOURS, FILLER_B, FILLER_A]);
  });

  it("WHEN REVEALED, two players: both of player 1's minions go to player 2, player 1 has none", () => {
    const one = engageMinion(setupGame(TWO), SANDMAN, P1);
    const two = engageMinion(one.state, SHOCKER, P1);
    const run = phase(two.state, [PARCOURS, FILLER_A, FILLER_B]);
    expect([SANDMAN, SHOCKER].map((c) => engagedWith(run.state, c))).toEqual([P2, P2]);
  });

  it("WHEN REVEALED, three players (player 1: A, player 2: B and C, player 3: none): player 1 has B and C, player 2 none, player 3 has A", () => {
    const a = engageMinion(setupGame(THREE), MERCENARY, P1);
    const b = engageMinion(a.state, SANDMAN, P2);
    const c = engageMinion(b.state, SHOCKER, P2);
    const run = phase(c.state, [PARCOURS, FILLER_A, FILLER_B, CHARGE]);
    expect(engagedWith(run.state, MERCENARY)).toBe(P3);
    expect(engagedWith(run.state, SANDMAN)).toBe(P1);
    expect(engagedWith(run.state, SHOCKER)).toBe(P1);
  });

  it("WHEN REVEALED, three players with Batroc as A: player 3 (the new player) discards 1 card, players 1 and 2 none", () => {
    const a = engageMinion(setupGame(THREE), BATROC, P1);
    const b = engageMinion(a.state, SANDMAN, P2);
    const run = phase(b.state, [PARCOURS, FILLER_A, FILLER_B, CHARGE]);
    expect(engagedWith(run.state, BATROC)).toBe(P3);
    expect(engagedWith(run.state, SANDMAN)).toBe(P1);
    expect([P1, P2, P3].map((p) => discardOf(run.state, p).length)).toEqual([0, 0, 1]);
  });

  it("WHEN REVEALED, two players, no minions anywhere: nothing happens, Surge still reveals the next card", () => {
    const run = phase(setupGame(TWO), [PARCOURS, FILLER_A, FILLER_B]);
    expect(revealedCodes(run.state, run.events)).toEqual([PARCOURS, FILLER_B, FILLER_A]);
  });

  it("BOOST (attack): after Rhino's attack on a hero resolves, the attacked player engages a minion not engaged with them: Mercenary from player 2 comes to player 1", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame(TWO), P1, P2), MERCENARY, P2);
    const run = villainPhase(engaged, [PARCOURS, BLANK, BLANK, FILLER_A, FILLER_B]);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    // Rhino hit player 1 for 3 (ATK 2 + 1 icon).
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ boostIcons: 1, damageDealt: 3 });
  });

  it("BOOST (attack): with two candidates the attacked player chooses which one: Sandman, not Mercenary", () => {
    const a = engageMinion(heroForm(setupGame(TWO), P1, P2), MERCENARY, P2);
    const b = engageMinion(a.state, SANDMAN, P2);
    const run = villainPhase(b.state, [PARCOURS, ...blanks(3), FILLER_A, FILLER_B], picking(b.id));
    expect(inst(run.state, b.id).engagedWith).toBe(P1);
    expect(inst(run.state, a.id).engagedWith).toBe(P2);
  });

  it("BOOST (attack): Batroc brought this way engages the player, who discards 1 card (one more than when Mercenary is brought)", () => {
    const stage = (code: string) =>
      villainPhase(engageMinion(heroForm(setupGame(TWO), P1, P2), code, P2).state, [
        PARCOURS,
        ...blanks(3),
        FILLER_A,
        FILLER_B,
      ]);
    const batroc = stage(BATROC);
    const mercenary = stage(MERCENARY);
    expect(engagedWith(batroc.state, BATROC)).toBe(P1);
    expect(discardOf(batroc.state, P1).length).toBe(discardOf(mercenary.state, P1).length + 1);
  });

  it("BOOST (attack): a minion already engaged with the attacked player is not a choice: nothing moves", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MERCENARY, P1);
    const run = villainPhase(engaged, [PARCOURS, BLANK, FILLER_A]);
    expect(inst(run.state, id).engagedWith).toBe(P1);
  });

  it("BOOST (scheme): in alter-ego the activation is a scheme, so the boost does nothing: the minion stays with player 2", () => {
    const { state: engaged, id } = engageMinion(setupGame(TWO), SANDMAN, P2);
    const run = villainPhase(engaged, [PARCOURS, ...blanks(3), FILLER_A, FILLER_B]);
    expect(inst(run.state, id).engagedWith).toBe(P2);
  });

  it("a rotation leaves the identities alone: player 2's identity is the same instance and form", () => {
    const { state } = engageMinion(setupGame(TWO), MERCENARY, P1);
    const run = phase(state, [PARCOURS, FILLER_A, FILLER_B]);
    expect(identityOf(run.state, P2)).toBe(identityOf(state, P2));
  });
});
