import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { P1, P2, identityOf, inst, mainThreat, patchInstance } from "../../testing/harness.js";
import type { GameState, InstanceId } from "@mc/engine";
import { attachToHost, engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  CHARGE,
  FILLER_A,
  FILLER_B,
  SPIDER_MAN,
  ONE_ICON,
  attacksBy,
  codeOf,
  dataOf,
  heroAttacks as sharedHeroAttacks,
  heroForm,
  inDiscard,
  inDiscardPile,
  inPlayCard,
  onlyDeck,
  piles,
  revealedCodes,
  schemesBy,
  setKit,
  types,
  without,
} from "../testing.js";
import { PALE_LITTLE_SPIDER, PALE_LITTLE_SPIDER_SKIPPED } from "./pale-little-spider.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Pale Little Spider set (50148 Black Widow, 50149 Handspring, 50150 Pride of the Red Room, 50151 Pale Little
 * Spider), docs/phase7-wave9.md sections 3.25 and 3.35. Rhino (Core, standard) against a Spider-Man starter deck, the
 * set's cards added to the encounter deck by hand. Black Widow is engaged with `engageMinion`, an attachment is
 * placed with `attachToHost`; the attack on her is a real `basicAttack`.
 */
const BLACK_WIDOW = "50148";
const HANDSPRING = "50149";
const PRIDE = "50150";
const SPIDER = "50151";
const SET = [BLACK_WIDOW, HANDSPRING, PRIDE, SPIDER];
const REFS = [
  "50148.black-widow-forced-response",
  "50149.handspring-forced-interrupt",
  "50150.when-revealed",
  "50151.when-revealed",
  "50151.boost",
];

const { deps: DEPS, setupGame, villainPhase } = setKit("pale_little_spider", PALE_LITTLE_SPIDER);

const heroAttacks = (state: GameState, target: InstanceId) => sharedHeroAttacks(DEPS, state, target);

describe("registry", () => {
  it("registers the five refs of the four cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(PALE_LITTLE_SPIDER).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(PALE_LITTLE_SPIDER)) expect(validateDefinition(def), id).toEqual([]);
    expect(PALE_LITTLE_SPIDER_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the four cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("setup: all six encounter copies (1 Black Widow, 2 Handspring, 1 Pride of the Red Room, 2 Pale Little Spider) are in the deck", () => {
    const s = setupGame();
    const counts = SET.map((code) => piles(s).deck.filter((id) => codeOf(s, id) === code).length);
    expect(counts).toEqual([1, 2, 1, 2]);
  });
});

describe("Black Widow (50148)", () => {
  it("is data: an Elite Thunderbolt unique minion, ATK 1, SCH 2, 14 hit points, 4 boost icons, Retaliate 1, Villainous, Victory 1", () => {
    const card = dataOf(BLACK_WIDOW);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([1, 2, 14, 4, true]);
    expect(card.traits).toEqual(["ELITE", "THUNDERBOLT"]);
    expect(card.keywords).toEqual([
      { name: "retaliate", value: 1 },
      { name: "villainous" },
      { name: "victory", value: 1 },
    ]);
  });

  it("FORCED RESPONSE: after she schemes against you, a Handspring is searched out of the encounter deck and attached to her; you are not confused", () => {
    const { state: engaged, id } = engageMinion(setupGame(), BLACK_WIDOW, P1);
    const run = villainPhase(onlyDeck(engaged, BLANK, BLANK, HANDSPRING, FILLER_A), []);
    expect(schemesBy(run.state, run.events, BLACK_WIDOW)).toMatchObject([
      { baseSch: 2, boostIcons: 0, threatPlaced: 2 },
    ]);
    const [handspring] = inst(run.state, id).attachments;
    expect(inst(run.state, id).attachments).toHaveLength(1);
    expect(codeOf(run.state, handspring!)).toBe(HANDSPRING);
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(0);
  });

  it("FORCED RESPONSE: the discard pile is searched too", () => {
    const { state: engaged, id } = engageMinion(setupGame(), BLACK_WIDOW, P1);
    const state = inDiscardPile(onlyDeck(engaged, BLANK, BLANK, FILLER_A, HANDSPRING), HANDSPRING);
    expect(inDiscard(state, HANDSPRING)).toHaveLength(1);
    const run = villainPhase(state, []);
    expect(inst(run.state, id).attachments.map((a) => codeOf(run.state, a))).toEqual([HANDSPRING]);
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(0);
  });

  it("FORCED RESPONSE: only one copy is attached when two are in the deck", () => {
    const { state: engaged, id } = engageMinion(setupGame(), BLACK_WIDOW, P1);
    const run = villainPhase(onlyDeck(engaged, BLANK, BLANK, HANDSPRING, HANDSPRING, FILLER_A), []);
    // The seeded shuffle of the two cards left leaves the second Handspring in the deck; the dealt card is FILLER_A.
    expect(inst(run.state, id).attachments).toHaveLength(1);
    expect(piles(run.state).deck.filter((i) => codeOf(run.state, i) === HANDSPRING)).toHaveLength(1);
  });

  it("FORCED RESPONSE, otherwise: with no Handspring in the deck or discard pile you are confused", () => {
    const { state: engaged, id } = engageMinion(setupGame(), BLACK_WIDOW, P1);
    const run = villainPhase(without(onlyDeck(engaged, BLANK, BLANK, FILLER_A), HANDSPRING), []);
    expect(inst(run.state, id).attachments).toEqual([]);
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(1);
  });

  it("FORCED RESPONSE: a Handspring already attached to the villain is not searched out (only the deck and discard pile are)", () => {
    const { state: engaged, id } = engageMinion(setupGame(), BLACK_WIDOW, P1);
    const rhino = engaged.villains[0]!.instanceId;
    const placed = attachToHost(onlyDeck(engaged, HANDSPRING, BLANK, BLANK, FILLER_A), HANDSPRING, rhino);
    const run = villainPhase(placed.state, []);
    expect(inst(run.state, id).attachments).toEqual([]);
    expect(inst(run.state, placed.id).attachedTo).toBe(rhino);
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(1);
  });

  it("FORCED RESPONSE: not after her attack on a hero (ATK 1, damage 1, no search, no confusion)", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), BLACK_WIDOW, P1);
    const run = villainPhase(onlyDeck(engaged, BLANK, BLANK, FILLER_A, HANDSPRING), []);
    expect(attacksBy(run.state, run.events, BLACK_WIDOW)).toMatchObject([
      { baseAtk: 1, boostIcons: 0, damageDealt: 1 },
    ]);
    expect(inst(run.state, id).attachments).toEqual([]);
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(0);
  });

  it("RETALIATE 1 and VILLAINOUS: a 1-icon boost makes her scheme 2 + 1 = 3 threat", () => {
    const { state: engaged } = engageMinion(setupGame(), BLACK_WIDOW, P1);
    const run = villainPhase(onlyDeck(engaged, BLANK, ONE_ICON, FILLER_A), []);
    expect(schemesBy(run.state, run.events, BLACK_WIDOW)).toMatchObject([
      { baseSch: 2, boostIcons: 1, threatPlaced: 3 },
    ]);
  });
});

describe("Handspring (50149)", () => {
  it("is data: a Preparation attachment that attaches to Black Widow, otherwise to the villain, two copies, 2 boost icons", () => {
    const card = dataOf(HANDSPRING);
    expect([card.type, card.boostIcons, card.quantityInSet, card.traits]).toEqual([
      "attachment",
      2,
      2,
      ["PREPARATION"],
    ]);
    expect(card.attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "Black Widow" },
      otherwise: { kind: "villain" },
    });
  });

  it("FORCED INTERRUPT: a hero's 2-damage attack on Black Widow deals 0 to her, the 2 to the hero, and Retaliate 1 still answers (3 in all); Handspring is discarded", () => {
    const { state: engaged, id: widow } = engageMinion(heroForm(setupGame()), BLACK_WIDOW, P1);
    const { state, id: handspring } = attachToHost(engaged, HANDSPRING, widow);
    const run = heroAttacks(state, widow);
    expect(inst(run.state, widow).damage).toBe(0);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(3);
    expect(inPlayCard(run.state, HANDSPRING)).toBeUndefined();
    expect(inDiscard(run.state, HANDSPRING)).toContain(handspring);
  });

  it("FORCED INTERRUPT: once discarded, the next attack hurts her (2 damage), the hero takes only Retaliate's 1", () => {
    const { state: engaged, id: widow } = engageMinion(heroForm(setupGame()), BLACK_WIDOW, P1);
    const { state } = attachToHost(engaged, HANDSPRING, widow);
    const first = heroAttacks(state, widow);
    const ready = patchInstance(
      patchInstance(first.state, identityOf(first.state), { exhausted: false, damage: 0 }),
      widow,
      {
        damage: 0,
      },
    );
    const second = heroAttacks(ready, widow);
    expect(inst(second.state, widow).damage).toBe(2);
    expect(inst(second.state, identityOf(second.state)).damage).toBe(1);
  });

  it("FORCED INTERRUPT: on the villain (Rhino, no Black Widow) a 2-damage hero attack is dealt back to the hero: Rhino takes 0, the hero 2", () => {
    const base = heroForm(setupGame());
    const rhino = base.villains[0]!.instanceId;
    const { state } = attachToHost(base, HANDSPRING, rhino);
    const before = inst(state, rhino).damage;
    const run = heroAttacks(state, rhino);
    expect(inst(run.state, rhino).damage).toBe(before);
    expect(inst(run.state, identityOf(run.state)).damage).toBe(2);
    expect(inPlayCard(run.state, HANDSPRING)).toBeUndefined();
  });

  it("FORCED INTERRUPT: it guards only the attached enemy: a hero's attack on Rhino (no Handspring on him) deals its damage to him and Handspring stays", () => {
    const { state: engaged, id: widow } = engageMinion(heroForm(setupGame()), BLACK_WIDOW, P1);
    const { state } = attachToHost(engaged, HANDSPRING, widow);
    const other = state.villains[0]!.instanceId;
    const run = heroAttacks(state, other);
    expect(inst(run.state, other).damage).toBeGreaterThan(0);
    expect(inPlayCard(run.state, HANDSPRING)).toBeDefined();
  });
});

describe("Pride of the Red Room (50150)", () => {
  it("is data: a side scheme with 4 threat (not per hero), 1 boost icon", () => {
    const card = dataOf(PRIDE);
    expect([card.type, card.startingThreat, card.boostIcons]).toEqual(["side_scheme", { base: 4, perPlayer: 0 }, 1]);
  });

  it("WHEN REVEALED: with no Preparation card in play it has its 4 threat", () => {
    const run = villainPhase(setupGame(), [BLANK, PRIDE, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, PRIDE)!).threat).toBe(4);
  });

  it("WHEN REVEALED: 1 additional threat for each Preparation card in play: Handspring on Black Widow = 5", () => {
    const { state: engaged, id: widow } = engageMinion(heroForm(setupGame()), BLACK_WIDOW, P1);
    const { state } = attachToHost(engaged, HANDSPRING, widow);
    const run = villainPhase(state, [BLANK, BLANK, PRIDE, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, PRIDE)!).threat).toBe(5);
  });

  it("WHEN REVEALED: both Handsprings in play = 6", () => {
    const { state: engaged, id: widow } = engageMinion(heroForm(setupGame()), BLACK_WIDOW, P1);
    const one = attachToHost(engaged, HANDSPRING, widow);
    const two = attachToHost(one.state, HANDSPRING, widow);
    const run = villainPhase(two.state, [BLANK, BLANK, PRIDE, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, PRIDE)!).threat).toBe(6);
  });

  it("WHEN REVEALED: a Handspring in the encounter deck is not in play and adds nothing", () => {
    const run = villainPhase(heroForm(setupGame()), [BLANK, PRIDE, HANDSPRING]);
    expect(inst(run.state, inPlayCard(run.state, PRIDE)!).threat).toBe(4);
  });

  it("is 4 threat in a two-player game too (the base is not per hero)", () => {
    const state = setupGame([SPIDER_MAN, CAPTAIN_MARVEL]);
    const run = villainPhase(state, [BLANK, BLANK, PRIDE, FILLER_A, FILLER_B]);
    expect(inst(run.state, inPlayCard(run.state, PRIDE)!).threat).toBe(4);
  });
});

describe("Pale Little Spider (50151)", () => {
  it("is data: a treachery with 1 boost icon and a star, two copies", () => {
    const card = dataOf(SPIDER);
    expect([card.type, card.boostIcons, card.starIcon, card.quantityInSet]).toEqual(["treachery", 1, true, 2]);
  });

  it("WHEN REVEALED (hero): Black Widow is found, engages the revealing player and attacks: ATK 1 + 1 icon = 2 damage; no surge", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, SPIDER, BLACK_WIDOW, ONE_ICON), []);
    const widow = inPlayCard(run.state, BLACK_WIDOW)!;
    expect(inst(run.state, widow).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, BLACK_WIDOW)).toMatchObject([
      { baseAtk: 1, boostIcons: 1, damageDealt: 2 },
    ]);
    expect(revealedCodes(run.state, run.events)).toEqual([SPIDER, BLACK_WIDOW]);
    expect(inDiscard(run.state, SPIDER)).toHaveLength(1);
  });

  it("WHEN REVEALED (alter-ego): Black Widow schemes: SCH 2 + 1 icon = 3 threat; her Forced Response finds no Handspring, so you are confused", () => {
    const run = villainPhase(onlyDeck(setupGame(), BLANK, SPIDER, BLACK_WIDOW, ONE_ICON), []);
    expect(schemesBy(run.state, run.events, BLACK_WIDOW)).toMatchObject([
      { baseSch: 2, boostIcons: 1, threatPlaced: 3 },
    ]);
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(1);
  });

  it("WHEN REVEALED: with Black Widow already in play (engaged with player 2) she engages the revealing player 1 and attacks them: 1 + 2 icons = 3 damage", () => {
    const { state: engaged, id } = engageMinion(
      heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2),
      BLACK_WIDOW,
      P2,
    );
    // Rhino attacks each player (a Suit and a blank boost), Black Widow attacks player 2 (a third), player 1 is dealt the
    // treachery and player 2 a Charge; her second boost card is the other Charge (2 icons each).
    const run = villainPhase(onlyDeck(engaged, FILLER_A, BLANK, BLANK, SPIDER, CHARGE, CHARGE), []);
    expect(attacksBy(run.state, run.events, BLACK_WIDOW).map((a) => a.damageDealt)).toEqual([1, 3]);
    expect(inst(run.state, id).engagedWith).toBe(P1);
  });

  it("WHEN REVEALED: with no Black Widow anywhere nothing activates and this card gains surge: the next card is revealed", () => {
    const run = villainPhase(onlyDeck(without(setupGame(), BLACK_WIDOW), BLANK, SPIDER, FILLER_A), []);
    expect(inPlayCard(run.state, BLACK_WIDOW)).toBeUndefined();
    expect(revealedCodes(run.state, run.events)).toEqual([SPIDER, FILLER_A]);
  });

  it("BOOST: you are confused (Rhino attacks a hero, 1 boost icon: 2 + 1 = 3 damage)", () => {
    const run = villainPhase(heroForm(setupGame()), [SPIDER, FILLER_A]);
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(1);
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ boostIcons: 1 });
  });

  it("BOOST: already confused, you stay confused and 1 threat goes on the main scheme (1 more than with a plain 1-icon boost)", () => {
    const confused = (s: ReturnType<typeof setupGame>) =>
      patchInstance(s, identityOf(s), { statuses: { ...inst(s, identityOf(s)).statuses, confused: 1 } });
    const base = villainPhase(confused(setupGame()), [ONE_ICON, FILLER_A]);
    const run = villainPhase(confused(setupGame()), [SPIDER, FILLER_A]);
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(1);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state) + 1);
  });

  it("BOOST: not already confused, no threat is added to the main scheme", () => {
    const base = villainPhase(setupGame(), [ONE_ICON, FILLER_A]);
    const run = villainPhase(setupGame(), [SPIDER, FILLER_A]);
    expect(inst(run.state, identityOf(run.state)).statuses.confused).toBe(1);
    expect(mainThreat(run.state)).toBe(mainThreat(base.state));
  });
});
