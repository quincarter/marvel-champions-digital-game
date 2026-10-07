import { handSize, hasKeyword, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { P1, P2, identityOf, inst, patchInstance, playerOf } from "../../testing/harness.js";
import { engageMinion } from "../../wave6/mut_gen/project-wideawake-testing.js";
import { WAVE7_DEPS } from "../index.js";
import { MUTANT_INSURRECTION } from "./mutant-insurrection.js";
import {
  SPIDER_MAN,
  TWO,
  type Seats,
  attachmentsOf,
  attacksBy,
  drive,
  events,
  game,
  heroed,
  nameOf,
  playFromHand,
  round,
  setHand,
} from "./superpower-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/** Stryfe with Mutant Insurrection chosen (Stryfe has no tough status card and is no MUTANT LIBERATION FRONT member). */
const stryfe = (players: Seats = [SPIDER_MAN]) => game({ scenario: "stryfe", sets: ["mutant_insurrection"], players });
/**
 * One boost card for the villain (a minion without the villainous keyword is dealt none, RRG 1.8 "Attack", p. 7), then
 * Advance (the villain schemes) as the card dealt to the player, so no encounter card adds an attack of its own.
 */
const QUIET = { boostCards: ["01186"], reveals: ["01186"] } as const;
const minionOf = (s: GameState, player: PlayerId, name: string) =>
  playerOf(s, player).playArea.find((id) => nameOf(s, id) === name)!;

/** Printed icons of `type` on the cards in `player`'s hand (a wild icon is not one). */
const iconsInHand = (s: GameState, player: PlayerId, type: "energy" | "mental" | "physical") =>
  playerOf(s, player).hand.reduce((sum, id) => {
    const card = s.cardPool[s.instances[id]!.cardId] as { resourceIcons?: Partial<Record<string, number>> };
    return sum + (card.resourceIcons?.[type] ?? 0);
  }, 0);

/** Spider-Man's cards by printed resource: [energy] Spider-Tracer x2 / Interrogation Room / Tenacity; [mental] x4; [physical] x2. */
const ENERGY = ["01007", "01007", "01063", "01093"] as const;
const MENTAL = ["01064", "01064", "01005", "01005"] as const;
const PHYSICAL = ["01008", "01009"] as const;

/**
 * `player`'s hand is exactly their hand size (so the end-of-turn draw adds none): `lead` first, then `filler`.
 * Spider-Man's alter-ego and hero forms may differ in hand size: the size is read in the form the game is in.
 */
function fixedHand(s: GameState, player: PlayerId, lead: readonly string[], filler: readonly string[]): GameState {
  const size = handSize(s, player, WAVE7_DEPS);
  return setHand(s, player, [...lead, ...filler].slice(0, size));
}

/** The cards `player` milled from the top of their deck by `abilityId`'s resolution. */
const milledBy = (run: readonly GameEvent[], abilityId: string, player: PlayerId) => {
  const start = run.findIndex((e) => e.type === "abilityResolved" && e.abilityId === abilityId);
  expect(start, `${abilityId} resolved`).toBeGreaterThanOrEqual(0);
  let n = 0;
  for (const e of run.slice(start + 1)) {
    if (e.type === "stepChanged") break;
    if (e.type === "cardMoved" && e.from.kind === "deck" && e.to.kind === "discard" && e.to.playerId === player) n++;
  }
  return n;
};

describe("registry", () => {
  it("registers every ref of the set", () => {
    expect(Object.keys(MUTANT_INSURRECTION).sort()).toEqual(
      [
        "40185.dragoness-forced-interrupt",
        "40186.forearm-forced-response",
        "40187.reaper-forced-interrupt",
        "40188.samurai-forced-response",
        "40189.mutant-insurrection-constant",
        "40189.when-revealed",
      ].sort(),
    );
  });
});

describe("Dragoness (40185)", () => {
  const activation = (state: GameState, player: PlayerId = P1) => {
    const run = round(state, QUIET);
    const dragoness = minionOf(run.state, player, "Dragoness");
    return { run, dragoness };
  };

  it("40185.dragoness-forced-interrupt: attacking, she gets +X ATK, X the [energy] resources in your hand (0: ATK 1)", () => {
    const base = fixedHand(engageMinion(heroed(stryfe()), "40185").state, P1, [], [...MENTAL, ...PHYSICAL]);
    expect(iconsInHand(base, P1, "energy")).toBe(0);
    const { run, dragoness } = activation(base);
    expect(attacksBy(run.events, dragoness)[0]!.baseAtk).toBe(1);
  });

  it("40185.dragoness-forced-interrupt: 3 [energy] resources in hand: ATK 1 + 3 = 4", () => {
    const base = fixedHand(engageMinion(heroed(stryfe()), "40185").state, P1, ENERGY.slice(0, 3), MENTAL);
    expect(iconsInHand(base, P1, "energy")).toBe(3);
    const { run, dragoness } = activation(base);
    expect(attacksBy(run.events, dragoness)[0]!.baseAtk).toBe(4);
  });

  it("40185.dragoness-forced-interrupt: the bonus is for that activation only: 2 [energy] is ATK 3, then 1 [energy] next round is ATK 2", () => {
    const base = fixedHand(engageMinion(heroed(stryfe()), "40185").state, P1, ENERGY.slice(0, 2), MENTAL);
    const first = activation(base);
    expect(attacksBy(first.run.events, first.dragoness)[0]!.baseAtk).toBe(1 + 2);
    const healed = patchInstance(first.run.state, identityOf(first.run.state), { damage: 0 });
    const again = round(fixedHand(healed, P1, ENERGY.slice(0, 1), [...MENTAL, ...PHYSICAL]), QUIET);
    expect(attacksBy(again.events, first.dragoness)[0]!.baseAtk).toBe(2);
  });

  it("40185.dragoness-forced-interrupt: scheming (alter-ego form), she gets +X SCH: 2 [energy] in hand: SCH 1 + 2 = 3", () => {
    const base = fixedHand(engageMinion(stryfe(), "40185").state, P1, ENERGY.slice(0, 2), MENTAL);
    const run = round(base, QUIET);
    const mine = events(run.events, "schemeResolved").filter(
      (e) => e.enemyInstanceId === minionOf(run.state, P1, "Dragoness"),
    );
    expect(mine).toHaveLength(1);
    expect(mine[0]!.baseSch).toBe(1);
    expect(mine[0]!.threatBonus).toBe(2);
    expect(mine[0]!.threatPlaced).toBe(3);
  });

  it("40185.dragoness-forced-interrupt, 2 players: she reads the hand of the player she is engaged with (P2: Tenacity and Emergency, 2 [energy])", () => {
    const engaged = engageMinion(heroed(stryfe(TWO)), "40185", P2).state;
    const p1 = fixedHand(engaged, P1, ENERGY, MENTAL);
    const base = fixedHand(p1, P2, ["01093", "01085"], ["01067", "01068", "01066", "01083", "01011"]);
    const energy = iconsInHand(base, P2, "energy");
    expect(energy).toBeGreaterThan(0);
    expect(iconsInHand(base, P1, "energy")).toBe(4);
    const { run, dragoness } = activation(base, P2);
    expect(attacksBy(run.events, dragoness)[0]!.baseAtk).toBe(1 + energy);
  });
});

describe("Forearm (40186)", () => {
  const milled = (state: GameState, player: PlayerId = P1) => {
    const run = round(state, QUIET);
    return { run, n: milledBy(run.events, "40186.forearm-forced-response", player) };
  };

  it("40186.forearm-forced-response: after he attacks you, discard X cards from the top of your deck, X your [physical] resources in hand (2)", () => {
    const base = fixedHand(engageMinion(heroed(stryfe()), "40186").state, P1, PHYSICAL, MENTAL);
    expect(iconsInHand(base, P1, "physical")).toBe(2);
    const { run, n } = milled(base);
    expect(attacksBy(run.events, minionOf(run.state, P1, "Forearm"))).toHaveLength(1);
    expect(n).toBe(2);
  });

  it("40186.forearm-forced-response: with no [physical] resource nothing is discarded", () => {
    const base = fixedHand(engageMinion(heroed(stryfe()), "40186").state, P1, [], MENTAL);
    expect(iconsInHand(base, P1, "physical")).toBe(0);
    expect(milled(base).n).toBe(0);
  });

  it("40186.forearm-forced-response: other resource types do not count (3 [energy] and 2 [mental] in hand, no [physical])", () => {
    const base = fixedHand(
      engageMinion(heroed(stryfe()), "40186").state,
      P1,
      [...ENERGY.slice(0, 3), ...MENTAL.slice(0, 2)],
      [],
    );
    expect(milled(base).n).toBe(0);
  });

  it("40186.forearm-forced-response, 2 players: only the player he attacks mills (P2: 1 [physical] in hand; P1 holds 2)", () => {
    const engaged = engageMinion(heroed(stryfe(TWO)), "40186", P2).state;
    const p1 = fixedHand(engaged, P1, PHYSICAL, MENTAL);
    const base = fixedHand(p1, P2, ["01087"], ["01067", "01068", "01066", "01083", "01011", "01012"]);
    const physical = iconsInHand(base, P2, "physical");
    const { run } = milled(base, P2);
    expect(milledBy(run.events, "40186.forearm-forced-response", P2)).toBe(physical);
    expect(milledBy(run.events, "40186.forearm-forced-response", P1)).toBe(0);
  });
});

describe("Reaper (40187)", () => {
  const attacked = (mental: number) => {
    const lead = MENTAL.slice(0, mental);
    const base = fixedHand(engageMinion(heroed(stryfe()), "40187").state, P1, lead, ENERGY);
    expect(iconsInHand(base, P1, "mental")).toBe(mental);
    const run = round(base, QUIET);
    expect(attacksBy(run.events, minionOf(run.state, P1, "Reaper"))).toHaveLength(1);
    return inst(run.state, identityOf(run.state));
  };

  it("40187.reaper-forced-interrupt: with 1 [mental] resource nothing happens", () => {
    const hero = attacked(1);
    expect(hero.statuses.stunned).toBe(0);
    expect(hero.exhausted).toBe(false);
  });

  it("40187.reaper-forced-interrupt: with 2 [mental] resources your identity is stunned (not exhausted)", () => {
    const hero = attacked(2);
    expect(hero.statuses.stunned).toBe(1);
    expect(hero.exhausted).toBe(false);
  });

  it("40187.reaper-forced-interrupt: with 3 [mental] resources still only stunned", () => {
    const hero = attacked(3);
    expect(hero.statuses.stunned).toBe(1);
    expect(hero.exhausted).toBe(false);
  });

  it("40187.reaper-forced-interrupt: with 4 [mental] resources both bullets apply: stunned and exhausted", () => {
    const hero = attacked(4);
    expect(hero.statuses.stunned).toBe(1);
    expect(hero.exhausted).toBe(true);
  });

  it("40187.reaper-forced-interrupt, 2 players: reads the hand of the player he attacks (P2 holds 4 [mental]; P1, who holds none, is untouched)", () => {
    const engaged = engageMinion(heroed(stryfe(TWO)), "40187", P2).state;
    const p1 = fixedHand(engaged, P1, [], ENERGY);
    const base = fixedHand(p1, P2, ["01067", "01066", "01011", "01012"], []);
    const mental = iconsInHand(base, P2, "mental");
    const run = round(base, QUIET);
    const hero2 = inst(run.state, identityOf(run.state, P2));
    expect(hero2.statuses.stunned).toBe(mental >= 2 ? 1 : 0);
    expect(inst(run.state, identityOf(run.state, P1)).statuses.stunned).toBe(0);
  });
});

describe("Samurai (40188)", () => {
  const charge = (s: GameState, id: InstanceId) => inst(s, id).counters?.charge ?? 0;
  const samurai = (players: Seats = [SPIDER_MAN], player: PlayerId = P1) =>
    engageMinion(heroed(stryfe(players)), "40188", player);
  /** The hero fully healed again between rounds, so no round defeats it. */
  const healed = (s: GameState, player: PlayerId = P1) => patchInstance(s, identityOf(s, player), { damage: 0 });
  const taken = (run: { readonly events: readonly GameEvent[]; readonly state: GameState }, player: PlayerId = P1) =>
    events(run.events, "damageDealt")
      .filter((e) => e.targetInstanceId === identityOf(run.state, player))
      .map((e) => e.amount);
  /** Spider-Man with Web-Shooter (cost 1) and Tenacity (cost 2) on his hero. */
  const upgraded = (s: GameState): GameState => {
    const first = playFromHand(s, P1, "01008", { host: identityOf(s) });
    return playFromHand(first.state, P1, "01093", { host: identityOf(s) }).state;
  };
  const upgrades = (s: GameState, player: PlayerId = P1) => attachmentsOf(s, identityOf(s, player));

  it("40188.samurai-forced-response: after he attacks you he gets a charge counter; choosing damage, you take 1 (one counter), then 2 (two)", () => {
    const { state, id } = samurai();
    const first = round(state, { ...QUIET, plan: { choose: "Take damage" } });
    expect(charge(first.state, id)).toBe(1);
    expect(taken(first)).toEqual([3, 2, 1]);
    const second = round(healed(first.state), { ...QUIET, plan: { choose: "Take damage" } });
    expect(charge(second.state, id)).toBe(2);
    expect(taken(second)).toEqual([3, 2, 2]);
  });

  it("40188.samurai-forced-response: or discard 1 card you control with printed cost at least the counters: 1 counter, Web-Shooter (1) goes and no damage is taken for it", () => {
    const { state, id } = samurai();
    const run = round(upgraded(state), { ...QUIET, plan: { choose: "Discard", pick: ["Web-Shooter"] } });
    expect(charge(run.state, id)).toBe(1);
    expect(upgrades(run.state)).toEqual(["Tenacity"]);
    expect(taken(run)).toHaveLength(2);
  });

  it("40188.samurai-forced-response: with 2 counters only a card of printed cost 2 or more can be discarded (Tenacity); Web-Shooter (1) is not a choice", () => {
    const { state, id } = samurai();
    const charged = patchInstance(upgraded(state), id, { counters: { charge: 1 } });
    const run = round(charged, { ...QUIET, plan: { choose: "Discard" } });
    expect(charge(run.state, id)).toBe(2);
    expect(upgrades(run.state)).toEqual(["Web-Shooter"]);
    const targetPrompt = run.prompts.find((p) => p.labels.includes("Tenacity"));
    expect(targetPrompt?.labels).not.toContain("Web-Shooter");
    expect(taken(run)).toHaveLength(2);
  });

  it("40188.samurai-forced-response: with no card that qualifies the discard option is not offered: damage only (2 counters, only Web-Shooter)", () => {
    const { state, id } = samurai();
    const first = playFromHand(state, P1, "01008", { host: identityOf(state) }).state;
    const charged = patchInstance(first, id, { counters: { charge: 1 } });
    const run = round(charged, { ...QUIET, plan: { choose: "Discard" } });
    expect(run.prompts.flatMap((p) => p.labels).some((l) => l.startsWith("Discard"))).toBe(false);
    expect(upgrades(run.state)).toEqual(["Web-Shooter"]);
    expect(taken(run)).toEqual([3, 2, 2]);
  });

  it("40188.samurai-forced-response, 2 players: he attacks P2, so P2 takes the damage (1) and P1's upgrades are not hers to lose", () => {
    const { state, id } = samurai(TWO, P2);
    const mine = playFromHand(state, P1, "01093", { host: identityOf(state) }).state;
    const run = round(mine, { ...QUIET, plan: { choose: "Discard" } });
    expect(charge(run.state, id)).toBe(1);
    expect(upgrades(run.state)).toEqual(["Tenacity"]);
    expect(taken(run, P2)).toContain(1);
    expect(taken(run, P1)).not.toContain(1);
  });
});

describe("Mutant Insurrection (40189), a side scheme with assault", () => {
  const BASE_THREAT = 3;
  const schemeOf = (s: GameState) => Object.values(s.instances).find((i) => i.cardId === "40189");
  const revealed = (s: GameState, extra: readonly string[] = []) =>
    round(s, { boostCards: ["01186"], reveals: ["40189", ...extra] });
  /** Juggernaut is no MUTANT LIBERATION FRONT member; Stryfe (the villain of the other scenario) is one. */
  const juggernaut = () => game({ sets: ["mutant_insurrection"] });

  it("40189.when-revealed: Stryfe is a MUTANT LIBERATION FRONT character himself: alone he counts for 1 (3 + 2 = 5), and the card does not surge", () => {
    const run = revealed(heroed(stryfe()));
    expect(schemeOf(run.state)!.threat).toBe(BASE_THREAT + 2);
    expect(events(run.events, "encounterCardRevealed")).toHaveLength(1);
  });

  it("40189.when-revealed: places 2 additional threat for each MUTANT LIBERATION FRONT character in play: Stryfe and one minion, 3 + 4 = 7", () => {
    const run = revealed(engageMinion(heroed(stryfe()), "40187").state);
    expect(schemeOf(run.state)!.threat).toBe(BASE_THREAT + 4);
  });

  it("40189.when-revealed: Stryfe and two minions, 3 + 6 = 9", () => {
    const one = engageMinion(heroed(stryfe()), "40187").state;
    const run = revealed(engageMinion(one, "40188").state);
    expect(schemeOf(run.state)!.threat).toBe(BASE_THREAT + 6);
  });

  it("40189.when-revealed: counts characters wherever they are engaged (2 players: Stryfe and a minion engaged with each, 3 + 6 = 9)", () => {
    const first = engageMinion(heroed(stryfe(TWO)), "40185", P1).state;
    const both = engageMinion(first, "40186", P2).state;
    const run = round(both, { boostCards: ["01186", "01187"], reveals: ["40189", "01186"] });
    expect(schemeOf(run.state)!.threat).toBe(BASE_THREAT + 6);
  });

  it("40189.when-revealed: with no MUTANT LIBERATION FRONT character in play (Juggernaut): no additional threat (3) and the card gains surge", () => {
    const run = revealed(heroed(juggernaut()), ["01186"]);
    expect(schemeOf(run.state)!.threat).toBe(BASE_THREAT);
    expect(events(run.events, "encounterCardRevealed")).toHaveLength(2);
  });

  it("40189.mutant-insurrection-constant: each minion gains toughness: a minion revealed while it is in play enters with a tough status card", () => {
    const inPlay = revealed(heroed(stryfe())).state;
    const run = round(inPlay, { boostCards: ["01186"], reveals: ["40187"] });
    const reaper = minionOf(run.state, P1, "Reaper");
    expect(hasKeyword(run.state, reaper, "toughness", WAVE7_DEPS)).toBe(true);
    expect(inst(run.state, reaper).statuses.tough).toBe(1);
  });

  it("40189.mutant-insurrection-constant: a minion already in play gains the keyword but no tough status card (it is given as a card enters play)", () => {
    const early = engageMinion(heroed(stryfe()), "40187");
    const run = revealed(early.state);
    expect(hasKeyword(run.state, early.id, "toughness", WAVE7_DEPS)).toBe(true);
    expect(inst(run.state, early.id).statuses.tough).toBe(0);
  });

  it("control: without the scheme a revealed minion has no tough status card and no toughness", () => {
    const run = round(heroed(stryfe()), { boostCards: ["01186"], reveals: ["40187"] });
    const reaper = minionOf(run.state, P1, "Reaper");
    expect(hasKeyword(run.state, reaper, "toughness", WAVE7_DEPS)).toBe(false);
    expect(inst(run.state, reaper).statuses.tough).toBe(0);
  });

  it("assault (keyword): a basic thwart against it uses ATK instead of THW: Spider-Man (THW 1, ATK 2) removes 2 threat", () => {
    const run = revealed(heroed(stryfe()));
    const scheme = schemeOf(run.state)!;
    expect(hasKeyword(run.state, scheme.instanceId, "assault", WAVE7_DEPS)).toBe(true);
    const thwart = drive(
      run.state,
      {},
      {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(run.state),
        schemeInstanceId: scheme.instanceId,
      },
    );
    expect(schemeOf(thwart.state)!.threat).toBe(scheme.threat - 2);
  });
});
