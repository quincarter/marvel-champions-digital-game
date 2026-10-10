import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { P1, identityOf, inst, patchInstance, playerOf } from "../../testing/harness.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLANK,
  FILLER_A,
  FILLER_B,
  attacksBy,
  codeOf,
  dataOf,
  flippedBoosts,
  heroAttacks,
  heroForm,
  inDiscard,
  inPlayCard,
  intoVictoryDisplay,
  onlyDeck,
  piles,
  revealedCodes,
  setKit,
  stunWith,
  tough,
  types,
} from "../testing.js";
import { SCIENTIST_SUPREME, SCIENTIST_SUPREME_SKIPPED } from "./scientist-supreme.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Scientist Supreme set (50125 Scientist Supreme, 50126 Monica Rappaccini, 50127 Diplomatic Immunity, 50128
 * Diplomatic Sanctions), docs/phase7-wave9.md sections 3.1 and 3.35. Rhino (Core, standard) against a Spider-Man starter
 * deck, the set's cards added to the encounter deck by hand. The two minions are the A.I.M. cards that reach the
 * victory display (Victory -1), put there by surgery (`intoVictoryDisplay`) or by a real defeat. Every ref is scripted.
 */
const SUPREME = "50125";
const MONICA = "50126";
const IMMUNITY = "50127";
const SANCTIONS = "50128";
const SET = [SUPREME, MONICA, IMMUNITY, SANCTIONS];
const REGISTERED = [
  "50125.scientist-supreme-constant",
  "50126.monica-rappaccini-constant",
  "50127.when-revealed",
  "50128.when-revealed",
  "50128.boost",
];
const HYDRA_MERCENARY = "01101";

const { deps: DEPS, setupGame, villainPhase } = setKit("scientist_supreme", SCIENTIST_SUPREME);
const damageOf = (s: GameState, id: InstanceId) => inst(s, id).damage;
const villainOf = (s: GameState) => s.villains[0]!.instanceId;
const inDisplay = (s: GameState, code: string) => s.victoryDisplay.filter((id) => codeOf(s, id) === code);

describe("registry", () => {
  it("registers the four refs of the four cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(SCIENTIST_SUPREME).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(SCIENTIST_SUPREME)) expect(validateDefinition(def), id).toEqual([]);
    expect(SCIENTIST_SUPREME_SKIPPED).toEqual({});
  });

  it("the data names exactly the registered and skipped refs for the four cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REGISTERED, ...Object.keys(SCIENTIST_SUPREME_SKIPPED)].sort());
  });

  it("setup: every encounter copy of the four cards is in the deck (1, 1, 1 and 2 Diplomatic Sanctions)", () => {
    const s = setupGame();
    const counts = SET.map((code) => piles(s).deck.filter((id) => codeOf(s, id) === code).length);
    expect(counts).toEqual([1, 1, 1, 2]);
  });
});

describe("Scientist Supreme (50125)", () => {
  it("is data: an A.I.M. Genius minion, ATK 1, SCH 2, 6 hit points, 3 boost icons, Victory -1, Villainous and Vulnerable", () => {
    const card = dataOf(SUPREME);
    expect([card.atk, card.sch, card.hp, card.boostIcons]).toEqual([1, 2, 6, 3]);
    expect(card.traits).toEqual(["A.I.M.", "GENIUS"]);
    expect(card.keywords).toEqual([{ name: "victory", value: -1 }, { name: "villainous" }, { name: "vulnerable" }]);
  });

  /** Spider-Man holds a tough status card, Rhino is stunned (so his attack removes the stun instead), `code` is engaged. */
  function toughHero(code: string) {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), code, P1);
    const hero = identityOf(engaged);
    const rhino = villainOf(engaged);
    const state = patchInstance(
      patchInstance(engaged, hero, { statuses: { ...inst(engaged, hero).statuses, tough: 1 } }),
      rhino,
      { statuses: { ...inst(engaged, rhino).statuses, stunned: 1 } },
    );
    return { state, id, hero };
  }

  it("CONSTANT: his attacks gain piercing: against a hero with a tough status card he discards it and deals ATK 1 + 1 boost icon = 2", () => {
    const { state, id, hero } = toughHero(SUPREME);
    const run = villainPhase(state, ["01188", FILLER_A]);
    expect(attacksBy(run.state, run.events, SUPREME)).toMatchObject([{ baseAtk: 1, boostIcons: 1, damageDealt: 2 }]);
    expect(damageOf(run.state, hero)).toBe(2);
    expect(tough(run.state, hero)).toBe(0);
    const hit = run.events.flatMap((e) =>
      e.type === "triggerEvent" &&
      e.event.kind === "dealDamage" &&
      e.phase === "resolved" &&
      e.event.sourceInstanceId === id
        ? [e.event]
        : [],
    )[0]!;
    expect(hit.piercing).toBe(true);
  });

  it("CONSTANT: his attacks gain ranged (stamped on the attack he makes; Rhino's has none)", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), SUPREME, P1);
    const run = villainPhase(engaged, [BLANK, BLANK, FILLER_A]);
    const attacked = run.events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked" ? [e.event] : [],
    );
    expect(attacked.find((a) => a.attackerInstanceId === id)!.ranged).toBe(true);
    expect(attacked.find((a) => a.attackerInstanceId === villainOf(engaged))!.ranged).toBeUndefined();
  });

  it("VILLAINOUS: he is dealt a boost card when he activates (the 1-icon card makes his attack 1 + 1)", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), SUPREME, P1);
    const run = villainPhase(engaged, [BLANK, "01188", FILLER_A]);
    expect(flippedBoosts(run.events).filter((b) => b.enemyInstanceId === id)).toHaveLength(1);
    expect(attacksBy(run.state, run.events, SUPREME)).toMatchObject([{ baseAtk: 1, boostIcons: 1, damageDealt: 2 }]);
  });

  it("VULNERABLE (Mockingbird stuns him): discarded at once, not defeated, so no victory display entry despite Victory -1: in the encounter discard pile with no damage", () => {
    const { state, id } = engageMinion(heroForm(setupGame()), SUPREME, P1);
    const run = stunWith(DEPS, state, id);
    expect(types(run.events, "characterDefeated")).toEqual([]);
    expect(inPlayCard(run.state, SUPREME)).toBeUndefined();
    expect(inDiscard(run.state, SUPREME)).toEqual([id]);
    expect(run.state.victoryDisplay).toEqual([]);
  });

  it("DEFEAT: defeated by damage (5 on him, Spider-Man's 2 more against 6 hit points) he goes to the victory display", () => {
    const { state, id } = engageMinion(heroForm(setupGame()), SUPREME, P1);
    const run = heroAttacks(DEPS, patchInstance(state, id, { damage: 5 }), id);
    expect(types(run.events, "characterDefeated")).toHaveLength(1);
    expect(inDisplay(run.state, SUPREME)).toEqual([id]);
    expect(inDiscard(run.state, SUPREME)).toEqual([]);
  });
});

describe("Monica Rappaccini (50126)", () => {
  /** Monica engaged, with `display` codes in the victory display; one villain phase with a boost card for her if she gets one. */
  function phase(...display: string[]) {
    let state = heroForm(setupGame());
    const { state: engaged, id } = engageMinion(state, MONICA, P1);
    state = engaged;
    for (const code of display) state = intoVictoryDisplay(state, code);
    const run = villainPhase(state, [BLANK, "01188", FILLER_A]);
    return { run, id };
  }

  it("is data: an A.I.M. Genius minion, ATK 1, SCH 3, 5 hit points, 2 boost icons, Victory -1 and Vulnerable, and no printed Villainous (the scan, docs/phase7-wave9.md section 1.14 item 2)", () => {
    const card = dataOf(MONICA);
    expect([card.atk, card.sch, card.hp, card.boostIcons]).toEqual([1, 3, 5, 2]);
    expect(card.keywords).toEqual([{ name: "victory", value: -1 }, { name: "vulnerable" }]);
  });

  it("CONSTANT: without Scientist Supreme in the victory display she is not villainous: no boost card is dealt to her and her attack is her printed 1", () => {
    const { run, id } = phase();
    expect(flippedBoosts(run.events).filter((b) => b.enemyInstanceId === id)).toEqual([]);
    expect(attacksBy(run.state, run.events, MONICA)).toMatchObject([{ baseAtk: 1, boostIcons: 0, damageDealt: 1 }]);
  });

  it("CONSTANT: with Scientist Supreme in the victory display she gains villainous: a boost card is dealt to her (the 1-icon card: 1 + 1 = 2)", () => {
    const { run, id } = phase(SUPREME);
    expect(flippedBoosts(run.events).filter((b) => b.enemyInstanceId === id)).toHaveLength(1);
    expect(attacksBy(run.state, run.events, MONICA)).toMatchObject([{ baseAtk: 1, boostIcons: 1, damageDealt: 2 }]);
  });

  it("CONSTANT: another card in the display is not enough (a Hydra Mercenary there leaves her without villainous)", () => {
    const { run, id } = phase(HYDRA_MERCENARY);
    expect(flippedBoosts(run.events).filter((b) => b.enemyInstanceId === id)).toEqual([]);
  });

  it("CONSTANT: she gains it the moment Scientist Supreme is defeated for real (a defeated Supreme enters the display)", () => {
    const base = heroForm(setupGame());
    const { state: withMonica, id: monica } = engageMinion(base, MONICA, P1);
    const { state: both, id: supreme } = engageMinion(withMonica, SUPREME, P1);
    const defeated = heroAttacks(DEPS, patchInstance(both, supreme, { damage: 5 }), supreme);
    expect(inDisplay(defeated.state, SUPREME)).toEqual([supreme]);
    const run = villainPhase(defeated.state, [BLANK, "01188", FILLER_A]);
    expect(flippedBoosts(run.events).filter((b) => b.enemyInstanceId === monica)).toHaveLength(1);
  });

  it("VULNERABLE (Mockingbird stuns her): discarded without being defeated: not in the victory display, no damage", () => {
    const { state, id } = engageMinion(heroForm(setupGame()), MONICA, P1);
    const run = stunWith(DEPS, state, id);
    expect(types(run.events, "characterDefeated")).toEqual([]);
    expect(inDiscard(run.state, MONICA)).toEqual([id]);
    expect(run.state.victoryDisplay).toEqual([]);
  });
});

describe("Diplomatic Immunity (50127)", () => {
  it("is data: a side scheme with 3 threat per hero, an acceleration icon and 2 boost icons", () => {
    const card = dataOf(IMMUNITY);
    expect([card.type, card.startingThreat, card.icons, card.boostIcons]).toEqual([
      "side_scheme",
      { base: 0, perPlayer: 3 },
      ["acceleration"],
      2,
    ]);
  });
});

describe("Diplomatic Immunity (50127) When Revealed", () => {
  /** Immunity revealed from the top of the encounter deck with `display` in the victory display. */
  function reveal(...display: string[]) {
    let state = heroForm(setupGame());
    for (const code of display) state = intoVictoryDisplay(state, code);
    const run = villainPhase(onlyDeck(state, BLANK, IMMUNITY, FILLER_A, FILLER_B), []);
    const id = inPlayCard(run.state, IMMUNITY)!;
    return { run, id, tokens: inst(run.state, id).counters["acceleration"] ?? 0 };
  }

  it("with no A.I.M. minion in the victory display it places no token (control)", () => {
    expect(reveal().tokens).toBe(0);
  });

  it("with 1 A.I.M. minion in the display it places 1 token on this side scheme", () => {
    expect(reveal(SUPREME).tokens).toBe(1);
  });

  it("with 2 A.I.M. minions in the display it places 2 tokens", () => {
    expect(reveal(SUPREME, MONICA).tokens).toBe(2);
  });

  it("only A.I.M. minions count: a Hydra Mercenary beside Supreme still gives 1", () => {
    expect(reveal(HYDRA_MERCENARY, SUPREME).tokens).toBe(1);
  });

  it("the tokens land on the side scheme, not the main scheme", () => {
    const before = heroForm(setupGame()).mainScheme.accelerationTokens;
    const { run } = reveal(SUPREME, MONICA);
    expect(run.state.mainScheme.accelerationTokens).toBe(before);
  });
});

describe("Diplomatic Sanctions (50128)", () => {
  it("is data: a treachery with 2 boost icons and Surge, two copies", () => {
    const card = dataOf(SANCTIONS);
    expect([card.type, card.boostIcons, card.keywords, card.quantityInSet]).toEqual([
      "treachery",
      2,
      [{ name: "surge" }],
      2,
    ]);
  });

  /** The first player's hand and discard pile sizes after revealing Sanctions with `display` in the victory display. */
  function reveal(...display: string[]) {
    let state = heroForm(setupGame());
    for (const code of display) state = intoVictoryDisplay(state, code);
    const run = villainPhase(onlyDeck(state, BLANK, SANCTIONS, FILLER_A, FILLER_B), []);
    return run;
  }
  const handOf = (s: GameState) => playerOf(s, P1).hand.length;
  const discardOf = (s: GameState) => playerOf(s, P1).discard.length;

  it("WHEN REVEALED: with no A.I.M. minion in the victory display nothing is discarded (control)", () => {
    const run = reveal();
    const control = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, FILLER_A, FILLER_B), []);
    expect(handOf(run.state)).toBe(handOf(control.state));
    expect(discardOf(run.state)).toBe(discardOf(control.state));
  });

  it("WHEN REVEALED: with 1 A.I.M. minion in the display you discard 1 card from your hand", () => {
    const run = reveal(SUPREME);
    const control = reveal();
    expect(handOf(control.state) - handOf(run.state)).toBe(1);
    expect(discardOf(run.state) - discardOf(control.state)).toBe(1);
  });

  it("WHEN REVEALED: with 2 A.I.M. minions in the display you discard 2 cards", () => {
    const run = reveal(SUPREME, MONICA);
    const control = reveal();
    expect(handOf(control.state) - handOf(run.state)).toBe(2);
    expect(discardOf(run.state) - discardOf(control.state)).toBe(2);
  });

  it("WHEN REVEALED: only A.I.M. minions count: a Hydra Mercenary in the display adds nothing", () => {
    const run = reveal(HYDRA_MERCENARY, SUPREME);
    const control = reveal();
    expect(handOf(control.state) - handOf(run.state)).toBe(1);
  });

  it("SURGE: the next card is revealed too", () => {
    const run = reveal();
    expect(revealedCodes(run.state, run.events)).toEqual([SANCTIONS, FILLER_A]);
  });

  /** Rhino's attack with Sanctions as its boost card, `display` in the victory display. */
  function boosted(...display: string[]) {
    let state = heroForm(setupGame());
    for (const code of display) state = intoVictoryDisplay(state, code);
    return villainPhase(state, [SANCTIONS, FILLER_A]);
  }
  const rhinoAttack = (run: ReturnType<typeof boosted>) => types(run.events, "attackResolved")[0];

  it("BOOST: with none in the display it adds only its own 2 icons (Rhino 2 + 2 = 4)", () => {
    expect(rhinoAttack(boosted())).toMatchObject({ baseAtk: 2, boostIcons: 2, damageDealt: 4 });
  });

  it("BOOST: it gains 1 icon for each A.I.M. minion in the display: 2 in it, 2 + 2 = 4 icons (Rhino 2 + 4 = 6)", () => {
    expect(rhinoAttack(boosted(SUPREME, MONICA))).toMatchObject({ baseAtk: 2, boostIcons: 4, damageDealt: 6 });
  });

  it("BOOST: only A.I.M. minions count: Supreme and a Hydra Mercenary give 3 icons (Rhino 2 + 3 = 5)", () => {
    expect(rhinoAttack(boosted(SUPREME, HYDRA_MERCENARY))).toMatchObject({ baseAtk: 2, boostIcons: 3, damageDealt: 5 });
  });

  it("BOOST: a scheme activation counts them too (alter-ego, 2 in the display: Rhino SCH 1 + 4 icons = 5 threat on the scheme)", () => {
    let state = setupGame();
    for (const code of [SUPREME, MONICA]) state = intoVictoryDisplay(state, code);
    const run = villainPhase(state, [SANCTIONS, FILLER_A]);
    expect(types(run.events, "schemeResolved")[0]).toMatchObject({ baseSch: 1, boostIcons: 4, threatPlaced: 5 });
  });
});
