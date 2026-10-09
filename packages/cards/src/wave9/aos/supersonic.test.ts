import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  picking as pickOption,
  playerOf,
  type Picker,
} from "../../testing/harness.js";
import { playFromHand } from "../../testing/staging.js";
import { attachToHost, engageMinion, handWith } from "../../wave6/mut_gen/project-wideawake-testing.js";
import {
  BLACK_CAT,
  BLANK,
  CAPTAIN_MARVEL,
  CHARGE,
  FILLER_A,
  ONE_ICON,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  dataOf,
  heroAttacks,
  heroForm,
  inDiscard,
  inPlayCard,
  onlyDeck,
  piles,
  revealedCodes,
  schemesBy,
  setKit,
  types,
  without,
} from "../testing.js";
import { SUPERSONIC, SUPERSONIC_SKIPPED } from "./supersonic.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Supersonic set (50156 MACH-IV, 50157 Blasters, 50158 Heat-Seeking Missiles, 50159 Aerial Dogfight, 50160
 * Supersonic), docs/phase7-wave9.md sections 3.25, 3.26, 3.34 and 3.35. Rhino (Core, standard) against a Core starter
 * deck, the set's cards added to the encounter deck by hand. MACH-IV is engaged with `engageMinion`, attachments are
 * placed with `attachToHost` (or dealt for real), and the defender is declared (or refused) through the real prompt.
 * Aerial Dogfight is skipped (see `SUPERSONIC_SKIPPED`).
 */
const MACH_IV = "50156";
const BLASTERS = "50157";
const MISSILES = "50158";
const DOGFIGHT = "50159";
const SUPERSONIC_CARD = "50160";
const SET = [MACH_IV, BLASTERS, MISSILES, DOGFIGHT, SUPERSONIC_CARD];
const REGISTERED = [
  "50156.mach-iv-constant",
  "50157.blasters-constant",
  "50157.blasters-response",
  "50158.heat-seeking-missiles-forced-response",
  "50160.when-revealed",
  "50160.boost",
];
const BACKFLIP = "01003";
const COSMIC_FLIGHT = "01017";

const { deps: DEPS, setupGame, villainPhase } = setKit("supersonic", SUPERSONIC);
const totalAttackDamage = (events: readonly GameEvent[]) =>
  events.reduce((n, e) => n + (e.type === "attackResolved" ? e.damageDealt : 0), 0);
const damageOf = (s: GameState, id: InstanceId) => inst(s, id).damage;
const villainOf = (s: GameState) => s.villains[0]!.instanceId;

/** Defends with the first character offered against `enemy`'s attack (declining every other attack), noting the offers. */
function defendingAgainst(enemy: InstanceId, offers: string[][], prefer?: InstanceId): Picker {
  return (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind !== "declareDefender" || choice.prompt.attack.enemyInstanceId !== enemy)
      return firstLegal(s);
    const ids = choice.options.map((o) => o.optionId).filter((id) => id !== "decline");
    offers.push(ids);
    return [prefer && ids.includes(prefer) ? prefer : (ids[0] ?? "decline")];
  };
}

/** Takes the option naming Backflip (it costs 0) only for damage `enemy` deals, otherwise declines everything. */
const backflipping =
  (backflip: InstanceId, enemy: InstanceId, offered: string[] = []): Picker =>
  (s) => {
    const prompt = s.pendingChoice?.prompt;
    if (prompt?.kind === "payForCard" && prompt.instanceId === backflip) return [];
    if (
      prompt?.kind === "chooseTriggers" &&
      prompt.event.kind === "dealDamage" &&
      prompt.event.sourceInstanceId === enemy
    ) {
      offered.push(...s.pendingChoice!.options.map((o) => o.optionId));
      return pickOption(`${backflip}:${BACKFLIP}.backflip-interrupt`)(s);
    }
    return firstLegal(s);
  };

/** The "defended" announcements of attacks by `enemy` (initiated and resolved). */
const defendedAgainst = (events: readonly GameEvent[], enemy: InstanceId) =>
  events.filter((e) => e.type === "triggerEvent" && e.event.kind === "defended" && e.event.enemyInstanceId === enemy);

/** Resolved damage events of attacks, with the keywords the attack carried. */
const attackDamage = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.event.kind === "dealDamage" && e.phase === "resolved" && e.event.fromAttack
      ? [e.event]
      : [],
  );

describe("registry", () => {
  it("registers the six refs of the five cards, each a valid definition, and skips the Aerial Dogfight constant with its reason", () => {
    expect(Object.keys(SUPERSONIC).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(SUPERSONIC)) expect(validateDefinition(def), id).toEqual([]);
    expect(Object.keys(SUPERSONIC_SKIPPED)).toEqual(["50159.aerial-dogfight-constant"]);
    expect(SUPERSONIC_SKIPPED["50159.aerial-dogfight-constant"]).toContain("reduceDamageTaken");
  });

  it("the data names exactly the registered and skipped refs for the five cards", () => {
    const refs = SET.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REGISTERED, ...Object.keys(SUPERSONIC_SKIPPED)].sort());
  });

  it("setup: every encounter copy of the five cards is in the deck", () => {
    const s = setupGame();
    const counts = SET.map((code) => piles(s).deck.filter((id) => codeOf(s, id) === code).length);
    expect(counts).toEqual(SET.map((code) => dataOf(code).quantityInSet));
  });
});

describe("MACH-IV (50156)", () => {
  it("is data: an Aerial, Elite, Thunderbolt unique minion, ATK 2, SCH 1, 16 hit points, 4 boost icons, Villainous, Victory 1", () => {
    const card = dataOf(MACH_IV);
    expect([card.atk, card.sch, card.hp, card.boostIcons, card.unique]).toEqual([2, 1, 16, 4, true]);
    expect(card.traits).toEqual(["AERIAL", "ELITE", "THUNDERBOLT"]);
    expect(card.keywords).toEqual([{ name: "villainous" }, { name: "victory", value: 1 }]);
  });

  it("CONSTANT: a hero without the Aerial trait is not offered as the defender (the attack is undefended: ATK 2 = 2 damage); Rhino's attack offers him", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACH_IV, P1);
    const rhinoOffers: string[][] = [];
    const alone = heroForm(setupGame());
    const rhino = villainPhase(alone, [BLANK, FILLER_A], defendingAgainst(villainOf(alone), rhinoOffers));
    expect(rhinoOffers).toEqual([[identityOf(alone)]]);
    expect(damageOf(rhino.state, identityOf(rhino.state))).toBe(0);

    const offers: string[][] = [];
    const run = villainPhase(engaged, [BLANK, BLANK, FILLER_A], defendingAgainst(id, offers));
    expect(offers).toEqual([]);
    expect(attacksBy(run.state, run.events, MACH_IV)).toMatchObject([
      { baseAtk: 2, defenseReduction: 0, damageDealt: 2 },
    ]);
  });

  it("CONSTANT: a non-Aerial ally (Black Cat) is not offered either, though she is for Rhino", () => {
    const { state: withCat, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const { state: engaged, id } = engageMinion(heroForm(withCat), MACH_IV, P1);
    const rhinoOffers: string[][] = [];
    villainPhase(heroForm(withCat), [BLANK, FILLER_A], defendingAgainst(villainOf(withCat), rhinoOffers));
    expect(rhinoOffers[0]).toContain(cat);

    const offers: string[][] = [];
    const run = villainPhase(engaged, [BLANK, BLANK, FILLER_A], defendingAgainst(id, offers));
    expect(offers).toEqual([]);
    expect(damageOf(run.state, cat)).toBe(0);
    expect(damageOf(run.state, identityOf(run.state))).toBeGreaterThanOrEqual(2);
  });

  it("CONSTANT (the RRG 1.8 erratum, any defender): a (defense) ability does not make the hero MACH-IV's defender: Backflip still prevents its damage but no defense is recorded; against Rhino one is", () => {
    const given = moveToHand(heroForm(setupGame()), P1, BACKFLIP);
    const [backflip] = given.ids as [InstanceId];
    const { state: engaged, id } = engageMinion(given.state, MACH_IV, P1);

    const control = villainPhase(given.state, [BLANK, FILLER_A], backflipping(backflip, villainOf(given.state)));
    expect(damageOf(control.state, identityOf(control.state))).toBe(0);
    expect(defendedAgainst(control.events, villainOf(given.state))).toHaveLength(2);

    const run = villainPhase(engaged, [BLANK, BLANK, FILLER_A], backflipping(backflip, id));
    expect(attacksBy(run.state, run.events, MACH_IV)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(playerOf(run.state, P1).discard).toContain(backflip);
    expect(defendedAgainst(run.events, id)).toEqual([]);
    // Backflip's own prevention is not a defense: the hero took the rest (Rhino's attack, undefended).
    expect(damageOf(run.state, identityOf(run.state))).toBe(totalAttackDamage(run.events) - 2);
  });

  it("CONSTANT: a character with the Aerial trait still defends: Captain Marvel with Cosmic Flight is offered and the attack is stopped; without it she is not", () => {
    const base = setupGame([CAPTAIN_MARVEL]);
    const { state: flying } = playFromHand(DEPS, base, COSMIC_FLIGHT, 2);
    const { state: engagedFlying, id } = engageMinion(heroForm(flying), MACH_IV, P1);
    const offers: string[][] = [];
    const run = villainPhase(engagedFlying, [BLANK, BLANK, FILLER_A], defendingAgainst(id, offers));
    expect(offers).toEqual([[identityOf(engagedFlying)]]);
    expect(attacksBy(run.state, run.events, MACH_IV)[0]!.defenseReduction).toBeGreaterThan(0);

    const { state: engagedPlain, id: plain } = engageMinion(heroForm(setupGame([CAPTAIN_MARVEL])), MACH_IV, P1);
    const plainOffers: string[][] = [];
    const plainRun = villainPhase(engagedPlain, [BLANK, BLANK, FILLER_A], defendingAgainst(plain, plainOffers));
    expect(plainOffers).toEqual([]);
    expect(attacksBy(plainRun.state, plainRun.events, MACH_IV)).toMatchObject([
      { baseAtk: 2, defenseReduction: 0, damageDealt: 2 },
    ]);
  });

  it("CONSTANT: it is about his attacks: a scheme against an alter-ego has no defender to refuse (SCH 1 places 1 threat)", () => {
    const { state: engaged } = engageMinion(setupGame(), MACH_IV, P1);
    const run = villainPhase(engaged, [BLANK, BLANK, FILLER_A]);
    expect(schemesBy(run.state, run.events, MACH_IV)).toMatchObject([{ baseSch: 1, boostIcons: 0, threatPlaced: 1 }]);
  });

  it("VILLAINOUS: a 1-icon boost makes his attack 2 + 1 = 3", () => {
    const { state: engaged } = engageMinion(heroForm(setupGame()), MACH_IV, P1);
    const run = villainPhase(engaged, [BLANK, ONE_ICON, FILLER_A]);
    expect(attacksBy(run.state, run.events, MACH_IV)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
  });
});

describe("Blasters (50157)", () => {
  it("is data: a Tech Weapon attachment with a +1 ATK box, 1 boost icon, attaching to MACH-IV, otherwise to the enemy with the highest ATK", () => {
    const card = dataOf(BLASTERS);
    expect([card.type, card.boostIcons, card.statModifiers]).toEqual(["attachment", 1, { atk: 1 }]);
    expect(card.attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "MACH-IV" },
      otherwise: { kind: "superlative", among: "enemy", order: "highest", measure: "atk" },
    });
  });

  it("dealt for real with MACH-IV in play it attaches to MACH-IV; without him, to the villain (the highest ATK)", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACH_IV, P1);
    const onMach = villainPhase(engaged, [BLANK, BLANK, BLASTERS]);
    expect(inst(onMach.state, id).attachments.map((a) => codeOf(onMach.state, a))).toEqual([BLASTERS]);

    const alone = heroForm(setupGame());
    const onRhino = villainPhase(alone, [BLANK, BLASTERS]);
    expect(inst(onRhino.state, villainOf(alone)).attachments.map((a) => codeOf(onRhino.state, a))).toContain(BLASTERS);
  });

  it("CONSTANT: MACH-IV's attacks gain overkill and ranged (and the +1 ATK box: 3 damage instead of 2)", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACH_IV, P1);
    const plain = villainPhase(engaged, [BLANK, BLANK, FILLER_A]);
    const plainHit = attackDamage(plain.events).find((d) => d.sourceInstanceId === id)!;
    expect([Boolean(plainHit.overkill), Boolean(plainHit.ranged)]).toEqual([false, false]);

    const { state } = attachToHost(engaged, BLASTERS, id);
    const run = villainPhase(state, [BLANK, BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, MACH_IV)).toMatchObject([{ baseAtk: 3, damageDealt: 3 }]);
    const hit = attackDamage(run.events).find((d) => d.sourceInstanceId === id)!;
    expect([hit.overkill, hit.ranged]).toEqual([true, true]);
  });

  it("CONSTANT: only the attached enemy's attacks gain them: Rhino's attack, with Blasters on MACH-IV, has neither", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACH_IV, P1);
    const { state } = attachToHost(engaged, BLASTERS, id);
    const run = villainPhase(state, [BLANK, BLANK, FILLER_A]);
    const rhinoHit = attackDamage(run.events).find((d) => d.sourceInstanceId === villainOf(state))!;
    expect([Boolean(rhinoHit.overkill), Boolean(rhinoHit.ranged)]).toEqual([false, false]);
  });

  it("CONSTANT, overkill: on Rhino (ATK 2 + 1 = 3) an ally defender (Black Cat, 2 hit points) is defeated and the excess 1 damage goes to the hero", () => {
    const { state: withCat, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const state = heroForm(withCat);
    const { state: armed } = attachToHost(state, BLASTERS, villainOf(state));
    const offers: string[][] = [];
    const run = villainPhase(armed, [BLANK, FILLER_A], defendingAgainst(villainOf(state), offers, cat));
    expect(offers[0]).toContain(cat);
    expect(playerOf(run.state, P1).discard).toContain(cat);
    expect(damageOf(run.state, identityOf(run.state))).toBe(1);
  });

  it("HERO RESPONSE: after you attack and damage the attached enemy, spend 2 energy to discard it (Spider-Man's attack deals 2 to MACH-IV)", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACH_IV, P1);
    const energy = handWith(engaged, P1, "energy", 2);
    const { state: armed, id: blasters } = attachToHost(energy.state, BLASTERS, id);
    const response = `${blasters}:${BLASTERS}.blasters-response`;
    const paying: Picker = (s) =>
      s.pendingChoice!.prompt.kind === "payForAbility"
        ? energy.ids.map((c) => `hand:${c}`).filter((o) => s.pendingChoice!.options.some((x) => x.optionId === o))
        : pickOption(response)(s);
    const run = heroAttacks(DEPS, armed, id, { pick: paying });
    expect(damageOf(run.state, id)).toBe(2);
    expect(inDiscard(run.state, BLASTERS)).toContain(blasters);
    expect(inst(run.state, id).attachments).toEqual([]);
    for (const c of energy.ids) expect(playerOf(run.state, P1).discard).toContain(c);
  });

  it("HERO RESPONSE: left unused (declined) it stays on MACH-IV", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACH_IV, P1);
    const { state: armed, id: blasters } = attachToHost(engaged, BLASTERS, id);
    const run = heroAttacks(DEPS, armed, id);
    expect(damageOf(run.state, id)).toBe(2);
    expect(inst(run.state, id).attachments).toEqual([blasters]);
  });
});

describe("Heat-Seeking Missiles (50158)", () => {
  /** MACH-IV engaged with a hero-form player, Heat-Seeking Missiles on him with `counters` missile counters. */
  function armed(counters: number, players: Parameters<typeof setupGame>[0] = [SPIDER_MAN]) {
    const base = heroForm(setupGame(players), ...(players.length > 1 ? [P1, P2] : [P1]));
    const { state: engaged, id } = engageMinion(base, MACH_IV, P1);
    const { state, id: missiles } = attachToHost(engaged, MISSILES, id);
    return { state: patchCounters(state, missiles, counters), id, missiles };
  }
  const patchCounters = (s: GameState, id: InstanceId, missile: number): GameState => ({
    ...s,
    instances: { ...s.instances, [id]: { ...inst(s, id), counters: { ...inst(s, id).counters, missile } } },
  });

  it("is data: a Tech Weapon attachment, Uses (4 missile counters), attaching to MACH-IV, otherwise to the villain", () => {
    const card = dataOf(MISSILES);
    expect(card.keywords).toEqual([{ name: "uses", count: 4, counterType: "missile" }]);
    expect(card.attachesTo).toEqual({
      kind: "ifAble",
      preferred: { kind: "namedCard", name: "MACH-IV" },
      otherwise: { kind: "villain" },
    });
  });

  it("dealt for real it enters play with 4 missile counters on MACH-IV", () => {
    const { state: engaged, id } = engageMinion(heroForm(setupGame()), MACH_IV, P1);
    const run = villainPhase(engaged, [BLANK, BLANK, MISSILES]);
    const [missiles] = inst(run.state, id).attachments;
    expect(codeOf(run.state, missiles!)).toBe(MISSILES);
    expect(inst(run.state, missiles!).counters.missile).toBe(4);
  });

  it("FORCED RESPONSE: after MACH-IV attacks you, 1 missile counter is removed (4 to 3) and you take 2 indirect damage on top of his 2", () => {
    const { state, id, missiles } = armed(4);
    const run = villainPhase(state, [BLANK, BLANK, FILLER_A]);
    expect(attacksBy(run.state, run.events, MACH_IV)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(inst(run.state, missiles).counters.missile).toBe(3);
    expect(damageOf(run.state, id)).toBe(0);
    expect(damageOf(run.state, identityOf(run.state))).toBe(totalAttackDamage(run.events) + 2);
  });

  it("FORCED RESPONSE: the last missile counter discards the card (Uses), and the indirect damage is still taken", () => {
    const { state, missiles } = armed(1);
    const run = villainPhase(state, [BLANK, BLANK, FILLER_A]);
    expect(inPlayCard(run.state, MISSILES)).toBeUndefined();
    expect(inDiscard(run.state, MISSILES)).toContain(missiles);
    expect(damageOf(run.state, identityOf(run.state))).toBe(totalAttackDamage(run.events) + 2);
  });

  it("FORCED RESPONSE: on the villain (no MACH-IV) it answers Rhino's attacks the same way", () => {
    const base = heroForm(setupGame());
    const { state: withMissiles, id } = attachToHost(base, MISSILES, villainOf(base));
    const state = patchCounters(withMissiles, id, 4);
    const run = villainPhase(state, [BLANK, FILLER_A]);
    const [rhino] = types(run.events, "attackResolved");
    expect(inst(run.state, id).counters.missile).toBe(3);
    expect(damageOf(run.state, identityOf(run.state))).toBe(rhino!.damageDealt + 2);
  });

  it("FORCED RESPONSE: only attacks against you: his scheme against an alter-ego removes no counter and deals no indirect damage", () => {
    const { state: engaged, id } = engageMinion(setupGame(), MACH_IV, P1);
    const { state, id: missiles } = attachToHost(engaged, MISSILES, id);
    const run = villainPhase(patchCounters(state, missiles, 4), [BLANK, BLANK, FILLER_A]);
    expect(schemesBy(run.state, run.events, MACH_IV)).toMatchObject([{ baseSch: 1, threatPlaced: 1 }]);
    expect(inst(run.state, missiles).counters.missile).toBe(4);
    expect(damageOf(run.state, identityOf(run.state))).toBe(0);
  });

  it("FORCED RESPONSE: with MACH-IV engaged with player 2 only that player takes the 2 indirect damage", () => {
    const base = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const { state: engaged, id } = engageMinion(base, MACH_IV, P2);
    const { state, id: missiles } = attachToHost(engaged, MISSILES, id);
    const run = villainPhase(patchCounters(state, missiles, 4), [FILLER_A, BLANK, BLANK, ONE_ICON]);
    const taken = (player: typeof P1) =>
      types(run.events, "attackResolved")
        .filter((a) => a.targetInstanceId === identityOf(run.state, player))
        .reduce((n, a) => n + a.damageDealt, 0);
    expect(damageOf(run.state, identityOf(run.state, P1))).toBe(taken(P1));
    expect(damageOf(run.state, identityOf(run.state, P2))).toBe(taken(P2) + 2);
    expect(inst(run.state, missiles).counters.missile).toBe(3);
  });
});

describe("Aerial Dogfight (50159)", () => {
  it("is data: a side scheme with 3 threat (not per hero), a hazard icon, Hinder 2 per hero", () => {
    const card = dataOf(DOGFIGHT);
    expect([card.type, card.startingThreat, card.icons, card.keywords]).toEqual([
      "side_scheme",
      { base: 3, perPlayer: 0 },
      ["hazard"],
      [{ name: "hinder", value: 0, perPlayer: 2 }],
    ]);
  });
});

describe("Supersonic (50160)", () => {
  it("is data: a treachery with 1 boost icon, a star", () => {
    const card = dataOf(SUPERSONIC_CARD);
    expect([card.type, card.boostIcons, card.starIcon]).toEqual(["treachery", 1, true]);
  });

  it("WHEN REVEALED (hero): MACH-IV is found, engages the revealing player and attacks (no defender is offered): ATK 2 + 1 icon = 3; no surge", () => {
    const run = villainPhase(onlyDeck(heroForm(setupGame()), BLANK, SUPERSONIC_CARD, MACH_IV, ONE_ICON), []);
    const mach = inPlayCard(run.state, MACH_IV)!;
    expect(inst(run.state, mach).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, MACH_IV)).toMatchObject([{ baseAtk: 2, boostIcons: 1, damageDealt: 3 }]);
    expect(revealedCodes(run.state, run.events)).toEqual([SUPERSONIC_CARD, MACH_IV]);
  });

  it("WHEN REVEALED (alter-ego): MACH-IV schemes against the player: SCH 1 + 1 icon = 2 threat", () => {
    const run = villainPhase(onlyDeck(setupGame(), BLANK, SUPERSONIC_CARD, MACH_IV, ONE_ICON), []);
    expect(schemesBy(run.state, run.events, MACH_IV)).toMatchObject([{ baseSch: 1, boostIcons: 1, threatPlaced: 2 }]);
  });

  it("WHEN REVEALED: with MACH-IV already in play (engaged with player 2) he engages the revealing player 1 and attacks them", () => {
    const base = heroForm(setupGame([SPIDER_MAN, CAPTAIN_MARVEL]), P1, P2);
    const { state: engaged, id } = engageMinion(base, MACH_IV, P2);
    const run = villainPhase(onlyDeck(engaged, FILLER_A, BLANK, BLANK, SUPERSONIC_CARD, CHARGE, CHARGE), []);
    expect(inst(run.state, id).engagedWith).toBe(P1);
    expect(attacksBy(run.state, run.events, MACH_IV).map((a) => a.damageDealt)).toEqual([2, 4]);
  });

  it("WHEN REVEALED: with no MACH-IV anywhere nothing activates and this card gains surge: the next card is revealed", () => {
    const run = villainPhase(onlyDeck(without(setupGame(), MACH_IV), BLANK, SUPERSONIC_CARD, FILLER_A), []);
    expect(revealedCodes(run.state, run.events)).toEqual([SUPERSONIC_CARD, FILLER_A]);
    expect(inPlayCard(run.state, MACH_IV)).toBeUndefined();
  });

  it("BOOST: Rhino's attack gains overkill and ranged (1 icon: ATK 2 + 1 = 3, the Black Cat defender's excess 1 goes to the hero)", () => {
    const { state: withCat, id: cat } = playFromHand(DEPS, setupGame(), BLACK_CAT, 2);
    const state = heroForm(withCat);
    const offers: string[][] = [];
    const run = villainPhase(state, [SUPERSONIC_CARD, FILLER_A], defendingAgainst(villainOf(state), offers, cat));
    const hits = attackDamage(run.events).filter((d) => d.sourceInstanceId === villainOf(state));
    expect(hits.some((d) => d.overkill)).toBe(true);
    expect(hits.every((d) => d.ranged)).toBe(true);
    expect(playerOf(run.state, P1).discard).toContain(cat);
    expect(damageOf(run.state, identityOf(run.state))).toBe(1);
  });

  it("BOOST: a scheme activation gains nothing (Rhino schemes: only the 1 boost icon counts)", () => {
    const base = villainPhase(setupGame(), [ONE_ICON, FILLER_A]);
    const run = villainPhase(setupGame(), [SUPERSONIC_CARD, FILLER_A]);
    const threat = (r: typeof run) => types(r.events, "schemeResolved").map((s) => s.threatPlaced);
    expect(threat(run)).toEqual(threat(base));
    expect(attackDamage(run.events)).toEqual([]);
  });
});
