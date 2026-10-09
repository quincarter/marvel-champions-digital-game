import type { GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  patchInstance,
  picking as pickOption,
  playerOf,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, playFromHand } from "../../testing/staging.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLACK_CAT,
  BLACK_PANTHER_CORE,
  BLANK,
  CAPTAIN_MARVEL,
  CHARGE,
  FILLER_A,
  FILLER_B,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  dataOf,
  heroAttacks,
  heroForm,
  inDiscard,
  inDiscardPile,
  inPlayCard,
  onlyDeck,
  piles,
  revealedCodes,
  setKit,
  stunWith,
  tough,
  types,
  without,
} from "../testing.js";
import { BATROCS_BRIGADE, BATROCS_BRIGADE_SKIPPED } from "./batrocs-brigade.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Batroc's Brigade set (50098 Machete, 50099 Rapido, 50100 Zaran, 50101 Batroc's Brigade, 50102 Soldiers of
 * Fortune), docs/phase7-wave9.md sections 3.1, 3.20, 3.33 and 3.35. Rhino (Core, standard) against a Core starter
 * deck, the set's cards added to the encounter deck by hand. Minions are engaged with `engageMinion`; Vulnerable is
 * exercised with a real Mockingbird (`stunWith`); choices and payments are answered through the real prompts.
 */
const MACHETE = "50098";
const RAPIDO = "50099";
const ZARAN = "50100";
const BRIGADE = "50101";
const SOLDIERS = "50102";
const SET = [MACHETE, RAPIDO, ZARAN, BRIGADE, SOLDIERS];
const REFS = [
  "50098.machete-constant",
  "50098.when-defeated",
  "50099.rapido-constant",
  "50099.when-revealed",
  "50099.boost",
  "50100.zaran-constant",
  "50100.when-revealed",
  "50101.batrocs-brigade-constant",
  "50101.when-revealed",
  "50101.batrocs-brigade-interrupt",
  "50102.when-revealed",
  "50102.boost",
];
const SANDMAN = "01102";
const ENERGY_DAGGERS = "01046";
const PANTHER_CLAWS = "01047";

const { deps: DEPS, setupGame, villainPhase } = setKit("batrocs_brigade", BATROCS_BRIGADE);
const damageOf = (s: GameState, id: InstanceId) => inst(s, id).damage;
const villainOf = (s: GameState) => s.villains[0]!.instanceId;
const attackDamage = (events: ReturnType<typeof villainPhase>["events"]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.event.kind === "dealDamage" && e.phase === "resolved" && e.event.fromAttack
      ? [e.event]
      : [],
  );

/** What a scripted picker answers: a `chooseOption` index, a `chooseCards` card, a trigger, and cards to pay with. */
interface Script {
  readonly option?: string;
  readonly card?: InstanceId;
  readonly trigger?: string;
  readonly pay?: number;
  readonly indirect?: readonly string[];
  /** Filled with the hand cards the picker paid with. */
  readonly paid?: string[];
}
function scripted(script: Script): Picker {
  return (s) => {
    const choice = s.pendingChoice!;
    const ids = choice.options.map((o) => o.optionId);
    switch (choice.prompt.kind) {
      case "chooseOption":
        return script.option !== undefined && ids.includes(script.option) ? [script.option] : firstLegal(s);
      case "chooseCards":
        return script.card !== undefined && ids.includes(script.card) ? [script.card] : firstLegal(s);
      case "chooseTriggers":
        return script.trigger !== undefined ? pickOption(script.trigger)(s) : firstLegal(s);
      case "assignIndirectDamage":
        return script.indirect ?? firstLegal(s);
      case "spendResources":
      case "payForAbility": {
        const hand = ids.filter((id) => id.startsWith("hand:")).slice(0, script.pay ?? 0);
        script.paid?.push(...hand.map((id) => id.slice("hand:".length)));
        return hand;
      }
      default:
        return firstLegal(s);
    }
  };
}

describe("registry", () => {
  it("registers the twelve refs of the five cards, each a valid definition, and skips nothing", () => {
    expect(Object.keys(BATROCS_BRIGADE).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(BATROCS_BRIGADE)) expect(validateDefinition(def), id).toEqual([]);
    expect(BATROCS_BRIGADE_SKIPPED).toEqual({});
  });

  it("the data names exactly the registered refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("setup: every encounter copy of the five cards is in the deck (one of each)", () => {
    const s = setupGame();
    const counts = SET.map((code) => piles(s).deck.filter((id) => codeOf(s, id) === code).length);
    expect(counts).toEqual([1, 1, 1, 1, 1]);
  });
});

describe("Machete (50098)", () => {
  it("is data: a unique Batroc's Brigade Mercenary minion, ATK 2, SCH 1, 3 hit points, 2 boost icons, Surge and Vulnerable", () => {
    const card = dataOf(MACHETE);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([2, 1, 3, 2, true]);
    expect(card.traits).toEqual(["BATROC'S BRIGADE", "MERCENARY"]);
    expect(card.keywords).toEqual([{ name: "surge" }, { name: "vulnerable" }]);
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

  it("CONSTANT: his attacks gain piercing: against a hero with a tough status card he discards it before dealing his 2 damage (a tough card alone would have stopped all of it)", () => {
    const { state, id, hero } = toughHero(MACHETE);
    const run = villainPhase(state, [BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, MACHETE)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(damageOf(run.state, hero)).toBe(2);
    expect(tough(run.state, hero)).toBe(0);
    expect(attackDamage(run.events).find((d) => d.sourceInstanceId === id)!.piercing).toBe(true);
  });

  it("CONSTANT: only his own attacks: Zaran (no piercing, ATK 1) against the same tough card deals 0 and uses it up", () => {
    const { state, hero } = toughHero(ZARAN);
    const run = villainPhase(state, [BLANK, FILLER_A]);
    expect(damageOf(run.state, hero)).toBe(0);
    expect(tough(run.state, hero)).toBe(0);
  });

  it("WHEN DEFEATED: defeated by an attack (1 damage + Spider-Man's 2 against 3 hit points) he is shuffled into the encounter deck, not discarded and not in the victory display", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACHETE, P1);
    const wounded = patchInstance(engaged, id, { damage: 1 });
    const run = heroAttacks(DEPS, wounded, id);
    expect(types(run.events, "characterDefeated")).toHaveLength(1);
    expect(inPlayCard(run.state, MACHETE)).toBeUndefined();
    expect(piles(run.state).deck).toContain(id);
    expect(inDiscard(run.state, MACHETE)).toEqual([]);
    expect(run.state.victoryDisplay).not.toContain(id);
    expect(damageOf(run.state, id)).toBe(0);
  });

  it("VULNERABLE: stunned by Mockingbird he is discarded without being defeated: in the encounter discard pile, not in the deck, no When Defeated shuffle", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACHETE, P1);
    const run = stunWith(DEPS, engaged, id);
    expect(types(run.events, "characterDefeated")).toEqual([]);
    expect(inPlayCard(run.state, MACHETE)).toBeUndefined();
    expect(inDiscard(run.state, MACHETE)).toEqual([id]);
    expect(piles(run.state).deck).not.toContain(id);
    expect(damageOf(run.state, id)).toBe(0);
  });

  it("SURGE: revealed he engages the player and the next card is revealed too", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, MACHETE, FILLER_A), []);
    expect(revealedCodes(run.state, run.events)).toEqual([MACHETE, FILLER_A]);
    expect(inst(run.state, inPlayCard(run.state, MACHETE)!).engagedWith).toBe(P1);
  });
});

describe("Rapido (50099)", () => {
  it("is data: a unique Batroc's Brigade Mercenary minion, ATK 3, SCH 1, 4 hit points, no boost icons and a star", () => {
    const card = dataOf(RAPIDO);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.starIcon, card.unique]).toEqual([
      3,
      1,
      4,
      0,
      true,
      true,
    ]);
    expect(card.keywords).toEqual([]);
  });

  it("CONSTANT: his attacks deal indirect damage: the 3 is assigned by the player (2 to Black Cat, who is defeated, and 1 to the hero) though the attack is undefended", () => {
    const { state: withCat, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const { state: engaged } = engageMinion(heroForm(withCat), RAPIDO, P1);
    const hero = identityOf(engaged);
    const prompts: number[] = [];
    const base = scripted({ indirect: [`${cat}#1`, `${cat}#2`, `${hero}#1`] });
    const run = villainPhase(engaged, [BLANK, FILLER_A], (s) => {
      if (s.pendingChoice!.prompt.kind === "assignIndirectDamage") prompts.push(s.pendingChoice!.prompt.amount);
      return base(s);
    });
    expect(prompts).toEqual([3]);
    expect(playerOf(run.state, P1).discard).toContain(cat);
    // Rhino's undefended 2, plus the 1 assigned to the hero.
    expect(damageOf(run.state, hero)).toBe(3);
  });

  it("CONSTANT: his attacks gain ranged (stamped on the attack he makes; Rhino's is not)", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), RAPIDO, P1);
    const run = villainPhase(engaged, [BLANK, FILLER_A]);
    const attacked = run.events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked" ? [e.event] : [],
    );
    expect(attacked.find((a) => a.attackerInstanceId === id)!.ranged).toBe(true);
    expect(attacked.find((a) => a.attackerInstanceId === villainOf(engaged))!.ranged).toBeUndefined();
  });

  it("WHEN REVEALED: 1 damage to each character you control (hero 1, Black Cat 1)", () => {
    const { state: withCat, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const state = heroForm(withCat);
    const run = villainPhase(onlyDeck(state, BLANK, RAPIDO), []);
    const hero = identityOf(run.state);
    // Rhino's undefended attack (2) lands first; Rapido's reveal adds the 1.
    expect(damageOf(run.state, hero)).toBe(3);
    expect(damageOf(run.state, cat)).toBe(1);
    expect(inst(run.state, inPlayCard(run.state, RAPIDO)!).engagedWith).toBe(P1);
  });

  it("WHEN REVEALED: only characters you control: with two players the other player's hero takes nothing", () => {
    const base = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const control = villainPhase(onlyDeck(base, BLANK, FILLER_A, BLANK), []);
    const run = villainPhase(onlyDeck(base, BLANK, FILLER_A, RAPIDO), []);
    const revealer = types(run.events, "encounterCardRevealed").find(
      (e) => codeOf(run.state, e.instanceId) === RAPIDO,
    )!.playerId;
    const other = revealer === P1 ? P2 : P1;
    expect(
      damageOf(run.state, identityOf(run.state, revealer)) -
        damageOf(control.state, identityOf(control.state, revealer)),
    ).toBe(1);
    expect(damageOf(run.state, identityOf(run.state, other))).toBe(
      damageOf(control.state, identityOf(control.state, other)),
    );
  });

  it("BOOST: revealed as Rhino's boost card it deals 1 damage to each character the attacked player controls (hero 2 + 1 = 3, Black Cat 1), and adds no icons", () => {
    const { state: withCat, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const state = heroForm(withCat);
    const run = villainPhase(state, [RAPIDO, FILLER_A]);
    const hero = identityOf(run.state);
    expect(damageOf(run.state, hero)).toBe(3);
    expect(damageOf(run.state, cat)).toBe(1);
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 0, damageDealt: 2 });
  });
});

describe("Zaran (50100)", () => {
  /** Black Panther (Core) with `codes` upgrades played in hero form. */
  function withWeapons(...codes: string[]) {
    let state = heroForm(setupGame([BLACK_PANTHER_CORE]));
    const ids: InstanceId[] = [];
    for (const code of codes) {
      const played = playFromHand(DEPS, state, code, 2);
      state = played.state;
      ids.push(played.id);
    }
    return { state, ids };
  }
  /** Zaran's attack in the next villain phase. */
  const zaranHits = (state: GameState) => {
    const run = villainPhase(state, [BLANK, FILLER_A]);
    return attacksBy(run.state, run.events, ZARAN).map((a) => a.baseAtk);
  };

  it("is data: a unique Batroc's Brigade Mercenary minion, ATK 1, SCH 1, 5 hit points, 2 boost icons", () => {
    const card = dataOf(ZARAN);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([1, 1, 5, 2, true]);
  });

  it("CONSTANT: with nothing tucked under him his ATK is the printed 1", () => {
    const { state } = engageMinion(heroForm(setupGame()), ZARAN, P1);
    expect(zaranHits(state)).toEqual([1]);
  });

  it("WHEN REVEALED: a Weapon upgrade you control is tucked under him (faceup, out of play, not discarded) and he gets +2 ATK (Energy Daggers cost 2): 1 + 2 = 3", () => {
    const { state, ids } = withWeapons(ENERGY_DAGGERS);
    expect(ids.every((u) => inPlayCard(state, ENERGY_DAGGERS) === u)).toBe(true);
    const revealed = villainPhase(onlyDeck(state, BLANK, ZARAN, FILLER_A), []);
    const zaran = inPlayCard(revealed.state, ZARAN)!;
    expect(inst(revealed.state, zaran).tucked).toEqual(ids);
    expect(inPlayCard(revealed.state, ENERGY_DAGGERS)).toBeUndefined();
    expect(playerOf(revealed.state, P1).discard).not.toContain(ids[0]);
    expect(zaranHits(revealed.state)).toEqual([3]);
  });

  it("WHEN REVEALED: with two Weapon upgrades the player chooses which one: Panther Claws is tucked and Energy Daggers stays in play", () => {
    const { state, ids } = withWeapons(ENERGY_DAGGERS, PANTHER_CLAWS);
    const [daggers, claws] = ids as [InstanceId, InstanceId];
    const revealed = villainPhase(onlyDeck(state, BLANK, ZARAN, FILLER_A), [], (s) => {
      const choice = s.pendingChoice!;
      return choice.prompt.kind === "chooseTarget" && choice.options.some((o) => o.optionId === `${claws}`)
        ? [`${claws}`]
        : firstLegal(s);
    });
    const zaran = inPlayCard(revealed.state, ZARAN)!;
    expect(inst(revealed.state, zaran).tucked).toEqual([claws]);
    expect(inPlayCard(revealed.state, ENERGY_DAGGERS)).toBe(daggers);
  });

  it("WHEN REVEALED, otherwise: with no Weapon upgrade the top card of your deck is tucked under him and its printed cost is his bonus", () => {
    const state = heroForm(setupGame());
    const deckBefore = playerOf(state, P1).deck;
    const revealed = villainPhase(onlyDeck(state, BLANK, ZARAN, FILLER_A), []);
    const zaran = inPlayCard(revealed.state, ZARAN)!;
    const [tucked] = inst(revealed.state, zaran).tucked;
    expect(inst(revealed.state, zaran).tucked).toHaveLength(1);
    // The card came off the top of the deck, below whatever the end-of-turn draw took.
    const deckAfter = playerOf(revealed.state, P1).deck;
    expect(deckAfter).toEqual(deckBefore.slice(deckBefore.indexOf(tucked!) + 1));
    const card = revealed.state.cardPool[inst(revealed.state, tucked!).cardId]!;
    const cost = "cost" in card && typeof card.cost === "number" ? card.cost : 0;
    expect(zaranHits(revealed.state)).toEqual([1 + cost]);
  });
});

describe("Batroc's Brigade (50101)", () => {
  it("is data: a side scheme with 6 threat (not per hero) and 2 boost icons", () => {
    const card = dataOf(BRIGADE);
    expect([card.type, card.startingThreat, card.boostIcons]).toEqual(["side_scheme", { base: 6, perPlayer: 0 }, 2]);
  });

  it("WHEN REVEALED: each enemy gets a tough status card: Rhino and a minion in play (Machete) both end with 1", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACHETE, P1);
    expect([tough(engaged, id), tough(engaged, villainOf(engaged))]).toEqual([0, 0]);
    const run = villainPhase(engaged, [BLANK, BRIGADE]);
    expect([tough(run.state, id), tough(run.state, villainOf(engaged))]).toEqual([1, 1]);
    expect(inPlayCard(run.state, BRIGADE)).toBeDefined();
  });

  it("CONSTANT: each minion gains toughness: Rapido revealed while it is in play enters play with a tough status card (and without it he has none)", () => {
    const control = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, RAPIDO), []);
    expect(tough(control.state, inPlayCard(control.state, RAPIDO)!)).toBe(0);
    const { state } = encounterCardInVillainArea(heroForm(setupGame()), BRIGADE, 6);
    const run = villainPhase(onlyDeck(state, BLANK, RAPIDO), []);
    expect(tough(run.state, inPlayCard(run.state, RAPIDO)!)).toBe(1);
  });

  it("CONSTANT: it gives toughness to minions only: a villain Rhino is not given a tough status card by it", () => {
    const { state } = encounterCardInVillainArea(heroForm(setupGame()), BRIGADE, 6);
    const run = villainPhase(state, [BLANK, FILLER_A]);
    expect(tough(run.state, villainOf(state))).toBe(0);
  });

  /** Brigade in play, Spider-Man to reveal `code` as the only dealt card, paying `pay` hand cards for the interrupt. */
  function revealing(code: string, script: Script = {}) {
    const { state, id: brigade } = encounterCardInVillainArea(heroForm(setupGame()), BRIGADE, 6);
    const interrupt = `${brigade}:${BRIGADE}.batrocs-brigade-interrupt`;
    const run = villainPhase(onlyDeck(state, BLANK, code, FILLER_A), [], scripted({ trigger: interrupt, ...script }));
    return { run, brigade };
  }

  it("HERO INTERRUPT: when you reveal a non-Elite minion, spend 3 resources to cancel its effects and discard it: Rapido's reveal damage is not dealt and he is in the discard pile", () => {
    const paid: string[] = [];
    const { run } = revealing(RAPIDO, { pay: 3, paid });
    expect(paid).toHaveLength(3);
    for (const card of paid) expect(playerOf(run.state, P1).discard).toContain(card);
    expect(inPlayCard(run.state, RAPIDO)).toBeUndefined();
    expect(inDiscard(run.state, RAPIDO)).toHaveLength(1);
    // Only Rhino's undefended 2 reached the hero.
    expect(damageOf(run.state, identityOf(run.state))).toBe(2);
  });

  it("HERO INTERRUPT: cancelling Machete cancels his surge too: the next card is not revealed", () => {
    const { run } = revealing(MACHETE, { pay: 3 });
    expect(inDiscard(run.state, MACHETE)).toHaveLength(1);
    expect(revealedCodes(run.state, run.events)).toEqual([MACHETE]);
  });

  it("HERO INTERRUPT: declined, the minion resolves as usual (Rapido: 1 damage reveal, 3 in all) and no resource is spent", () => {
    const { run } = revealing(RAPIDO);
    expect(inPlayCard(run.state, RAPIDO)).toBeDefined();
    expect(damageOf(run.state, identityOf(run.state))).toBe(3);
  });

  it("HERO INTERRUPT: an Elite minion cannot be cancelled with it (Sandman is not offered the interrupt)", () => {
    const { state, id: brigade } = encounterCardInVillainArea(heroForm(setupGame()), BRIGADE, 6);
    const offered: string[] = [];
    const run = villainPhase(onlyDeck(state, BLANK, SANDMAN), [], (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") offered.push(...choice.options.map((o) => o.optionId));
      return firstLegal(s);
    });
    expect(offered.filter((o) => o.startsWith(`${brigade}:`))).toEqual([]);
    expect(inPlayCard(run.state, SANDMAN)).toBeDefined();
  });

  it("HERO INTERRUPT: a treachery is not a minion: Soldiers of Fortune's reveal does not offer it", () => {
    const { state, id: brigade } = encounterCardInVillainArea(heroForm(setupGame()), BRIGADE, 6);
    const offered: string[] = [];
    villainPhase(onlyDeck(state, BLANK, SOLDIERS), [], (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") offered.push(...choice.options.map((o) => o.optionId));
      return firstLegal(s);
    });
    expect(offered.filter((o) => o.startsWith(`${brigade}:`))).toEqual([]);
  });

  it("HERO INTERRUPT: only for your own reveals: with two players, the interrupt is offered to the player who reveals the minion", () => {
    const { state, id: brigade } = encounterCardInVillainArea(
      heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2),
      BRIGADE,
      6,
    );
    const offeredTo: string[] = [];
    villainPhase(onlyDeck(state, BLANK, FILLER_B, MACHETE, FILLER_A), [], (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers" && choice.options.some((o) => o.optionId.startsWith(`${brigade}:`)))
        offeredTo.push(choice.playerId);
      return firstLegal(s);
    });
    expect(offeredTo).toHaveLength(1);
  });
});

describe("Soldiers of Fortune (50102)", () => {
  it("is data: a treachery with no boost icons and a star, no keywords", () => {
    const card = dataOf(SOLDIERS);
    expect([card.type, card.boostIcons, card.starIcon, card.keywords]).toEqual(["treachery", 0, true, []]);
  });

  it("WHEN REVEALED, first option: spend 3 resources of any type: three hand cards are discarded and no Mercenary is found", () => {
    const paid: string[] = [];
    const run = villainPhase(
      onlyDeck(heroForm(setupGame()), BLANK, SOLDIERS, FILLER_A),
      [],
      scripted({ option: "0", pay: 3, paid }),
    );
    expect(paid).toHaveLength(3);
    for (const card of paid) expect(playerOf(run.state, P1).discard).toContain(card);
    expect(revealedCodes(run.state, run.events)).toEqual([SOLDIERS]);
    for (const code of [MACHETE, RAPIDO, ZARAN]) expect(inPlayCard(run.state, code)).toBeUndefined();
  });

  it("WHEN REVEALED, second option: the player picks a Mercenary minion from the deck (Zaran), it is revealed (tucks the top card) and engages them; no surge", () => {
    const state = heroForm(setupGame());
    const zaran = piles(state).deck.find((id) => codeOf(state, id) === ZARAN)!;
    const run = villainPhase(
      onlyDeck(state, BLANK, SOLDIERS, ZARAN, MACHETE, FILLER_A),
      [],
      scripted({ option: "1", card: zaran }),
    );
    expect(inst(run.state, zaran).engagedWith).toBe(P1);
    expect(inst(run.state, zaran).tucked).toHaveLength(1);
    expect(revealedCodes(run.state, run.events)).toEqual([SOLDIERS, ZARAN]);
    expect(inPlayCard(run.state, MACHETE)).toBeUndefined();
  });

  it("WHEN REVEALED, second option: a Mercenary with surge (Machete) is revealed and so the next card is revealed too", () => {
    const state = heroForm(setupGame());
    const machete = piles(state).deck.find((id) => codeOf(state, id) === MACHETE)!;
    const run = villainPhase(
      onlyDeck(state, BLANK, SOLDIERS, MACHETE, FILLER_A),
      [],
      scripted({ option: "1", card: machete }),
    );
    expect(revealedCodes(run.state, run.events)).toEqual([SOLDIERS, MACHETE, FILLER_A]);
  });

  it("WHEN REVEALED, second option: a Mercenary found in the encounter discard pile (Zaran) is revealed from there and engages you", () => {
    const base = heroForm(setupGame());
    const zaran = piles(base).deck.find((id) => codeOf(base, id) === ZARAN)!;
    const state = inDiscardPile(onlyDeck(base, BLANK, SOLDIERS, ZARAN, FILLER_A), ZARAN);
    expect(piles(state).discard).toEqual([zaran]);
    const run = villainPhase(state, [], scripted({ option: "1", card: zaran }));
    expect(inst(run.state, zaran).engagedWith).toBe(P1);
    expect(piles(run.state).discard).not.toContain(zaran);
  });

  it("WHEN REVEALED, second option: with no Mercenary anywhere nothing enters play and this card gains surge", () => {
    let state = heroForm(setupGame());
    for (const code of [MACHETE, RAPIDO, ZARAN]) state = without(state, code);
    const run = villainPhase(onlyDeck(state, BLANK, SOLDIERS, FILLER_A), [], scripted({ option: "1" }));
    expect(revealedCodes(run.state, run.events)).toEqual([SOLDIERS, FILLER_A]);
  });

  it("WHEN REVEALED, second option: a Mercenary already in play (engaged with player 2) engages the revealing player instead, which is not entering play, so this card gains surge", () => {
    const base = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const { state: engaged, id } = engageMinion(base, RAPIDO, P2);
    let state = engaged;
    for (const code of [MACHETE, ZARAN]) state = without(state, code);
    // Rhino attacks each player in turn, so two boost cards come first; then each player is dealt a card.
    const run = villainPhase(
      onlyDeck(state, BLANK, FILLER_B, SOLDIERS, FILLER_A, CHARGE),
      [],
      scripted({ option: "1", card: id }),
    );
    const revealed = types(run.events, "encounterCardRevealed");
    const soldiers = revealed.find((e) => codeOf(run.state, e.instanceId) === SOLDIERS)!;
    expect(inst(run.state, id).engagedWith).toBe(soldiers.playerId);
    // Surge: the revealing player revealed a further card after this one, and Rapido did not enter play again.
    const after = revealed.slice(revealed.indexOf(soldiers) + 1);
    expect(after.some((e) => e.playerId === soldiers.playerId)).toBe(true);
    expect(run.state.instances[id]!.cardId).toBe(RAPIDO);
  });

  it("WHEN REVEALED: the spend option is not offered to a player who cannot pay for it (no cards in hand, deck or discard to pay with)", () => {
    const state = heroForm(setupGame());
    const empty = {
      ...state,
      players: state.players.map((p) => ({ ...p, hand: [], deck: [], discard: [] })),
    } as GameState;
    const kinds: string[] = [];
    const run = villainPhase(onlyDeck(empty, BLANK, SOLDIERS, MACHETE, RAPIDO, ZARAN, FILLER_A), [], (s) => {
      kinds.push(s.pendingChoice!.prompt.kind);
      return firstLegal(s);
    });
    // Only the Mercenary option remains, so the engine does not ask which option; it goes straight to the pick.
    expect(kinds).not.toContain("chooseOption");
    expect(kinds).toContain("chooseCards");
    expect(
      [MACHETE, RAPIDO, ZARAN].filter((code) => inPlayCard(run.state, code) !== undefined).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("BOOST, first option: spend 1 resource of any type: Rhino's attack gains no icons (2 damage) and one hand card is discarded", () => {
    const paid: string[] = [];
    const state = heroForm(setupGame());
    const run = villainPhase(state, [SOLDIERS, FILLER_A], scripted({ option: "0", pay: 1, paid }));
    expect(paid).toHaveLength(1);
    expect(playerOf(run.state, P1).discard).toContain(paid[0]);
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 0, damageDealt: 2 });
  });

  it("BOOST, second option: this card gains 3 boost icons: Rhino's attack is 2 + 3 = 5", () => {
    const run = villainPhase(heroForm(setupGame()), [SOLDIERS, FILLER_A], scripted({ option: "1" }));
    expect(types(run.events, "attackResolved")[0]).toMatchObject({ baseAtk: 2, boostIcons: 3, damageDealt: 5 });
  });

  it("BOOST: a scheme activation counts the icons too (alter-ego, Rhino SCH 1 + 3 = 4 threat more than the same phase with a blank boost)", () => {
    const base = setupGame();
    const control = villainPhase(base, [BLANK, FILLER_A]);
    const run = villainPhase(base, [SOLDIERS, FILLER_A], scripted({ option: "1" }));
    expect(mainThreat(run.state) - mainThreat(control.state)).toBe(3);
    expect(types(run.events, "schemeResolved")[0]).toMatchObject({ boostIcons: 3 });
  });
});
