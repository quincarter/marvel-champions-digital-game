/**
 * The Mutant Genesis role upgrades 32176-32195 (`role-upgrades.ts`), each used in a real campaign game
 * (`campaign-cards-testing.ts`: seat 1 is the Brawler, seat 2 the Defender; the card under test replaces the seat's dealt
 * upgrade). Using one removes it from the game and the campaign pool; that removal survives a lost-and-retried scenario
 * and an unused upgrade is redealt (docs/phase7-wave6.md §4.1 Q12). A standalone deck refuses them.
 */
import { cardId, MUT_GEN_STARTER_DECKS, type DeckContents } from "@mc/content";
import {
  activeEncounterDeck,
  activeVillain,
  applyCampaignResult,
  applyCommand,
  cardsInPlay,
  characterProfile,
  validateDeck,
  type CampaignChoiceAnswer,
  type CampaignGameResult,
  type CampaignLog,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { MUT_GEN_CAMPAIGN_DEFINITION } from "../../campaigns/mut_gen.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  answer,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  play,
  playerOf,
  resourceAbility,
  runWith,
  settle,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import { WAVE6_CARDS, WAVE6_DEPS } from "../index.js";
import { campaignGame, compose, gameFromComposedLog, logBefore } from "./campaign-cards-testing.js";
import { engageMinion } from "./project-wideawake-testing.js";
import { MUT_GEN_ROLE_UPGRADES } from "./role-upgrades.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const settled = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, WAVE6_DEPS);

const ROLE_UPGRADE_CODES = Array.from({ length: 20 }, (_, index) => String(32176 + index));
const SCRIPTED = [
  "32176.coup-de-grace-interrupt",
  "32181.coup-de-grace-interrupt",
  "32177.swagger-interrupt",
  "32178.brazen-defense-constant",
  "32179.ferocious-attack-action",
  "32180.war-cry-resource",
  "32182.compassion-response",
  "32183.group-assault-action",
  "32184.shock-and-awe-action",
  "32185.improvisation-resource",
  "32186.swagger-interrupt",
  "32187.surprise-response",
  "32188.heroic-intervention-action",
  "32189.determined-defense-constant",
  "32190.bodyguard-resource",
  "32191.surprise-response",
  "32192.compassion-response",
  "32193.rescue-operation-action",
  "32194.mentorship-action",
  "32195.fortitude-resource",
];
const STEEL_FIST = "32008"; // an ATTACK event, cost 2
const INCONSPICUOUS = "04038"; // a THWART event, cost 1: remove 3 threat from among schemes

/** The role upgrade in play under `player`'s control (seat 1 holds a Brawler card, seat 2 a Defender card). */
const roleUpgradeOf = (state: GameState, player: PlayerId): InstanceId =>
  cardsInPlay(state).find(
    (id) =>
      state.instances[id]!.controllerId === player &&
      ROLE_UPGRADE_CODES.includes(state.instances[id]!.cardId as string),
  )!;

/** A campaign game in hero form where P1's role upgrade is `code` (the seat's dealt card is swapped for it). */
function heroGame(code: string): { readonly state: GameState; readonly card: InstanceId } {
  const start = campaignGame(0);
  const card = roleUpgradeOf(start, P1);
  return { state: settled(run(patchInstance(start, card, { cardId: cardId(code) }), toHero(P1))), card };
}

const typeOf = (state: GameState, id: InstanceId) => state.cardPool[state.instances[id]!.cardId]?.type ?? "";
const enemies = (state: GameState) =>
  cardsInPlay(state).filter((id) => ["villain", "minion"].includes(typeOf(state, id)));
const schemes = (state: GameState) => [
  state.mainScheme.instanceId,
  ...cardsInPlay(state).filter((id) => typeOf(state, id) === "side_scheme"),
];
const totalThreat = (state: GameState) => schemes(state).reduce((sum, id) => sum + inst(state, id).threat, 0);
const totalDamage = (state: GameState) => enemies(state).reduce((sum, id) => sum + inst(state, id).damage, 0);
const handPay = (state: GameState, n: number) =>
  playerOf(state, P1)
    .hand.slice(0, n)
    .map((fromHand) => ({ fromHand }));
/** Enough threat on every scheme that dividing 3 or 5 always has room. */
const withThreat = (state: GameState): GameState =>
  schemes(state).reduce((acc, id) => patchInstance(acc, id, { threat: 12 }), state);

/** P1's first hand card made `code` (state surgery), and the instance. */
function handCardAs(state: GameState, code: string, skip = 0): { readonly state: GameState; readonly id: InstanceId } {
  const id = playerOf(state, P1).hand[skip]!;
  return { id, state: patchInstance(state, id, { cardId: cardId(code) }) };
}
/** A damaged, exhausted Nightcrawler of P1's in play (a hand card made one and put into play). */
function withAlly(state: GameState): { readonly state: GameState; readonly ally: InstanceId } {
  const ally = playerOf(state, P1).hand[0]!;
  const moved: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: p.hand.filter((id) => id !== ally), playArea: [...p.playArea, ally] } : p,
    ),
  };
  const ready = patchInstance(moved, ally, {
    cardId: cardId("32011"),
    faceup: true,
    exhausted: true,
    damage: 1,
    controllerId: P1,
  });
  return { state: ready, ally };
}

/** The upgrade left the game, and the campaign pool lost exactly its face. */
function expectRemoved(after: GameState, card: InstanceId, code: string): void {
  expect(after.removedFromGame).toContain(card);
  expect(cardsInPlay(after)).not.toContain(card);
  expect((after.campaignWrites?.removedFromCampaign ?? []).map((face) => face.cardId as string)).toEqual([code]);
}

/** Accepts the named optional response/interrupt (by ability id), and pays/declines everything else. */
const accepting =
  (...wanted: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    const hits = choice.options
      .map((o) => o.optionId)
      .filter((id) => wanted.some((w) => id === w || id.endsWith(`:${w}`)));
    return hits.length > 0 ? hits.slice(0, choice.maxSelections) : firstLegal(state);
  };

describe("role upgrade refs", () => {
  it("scripts all twenty upgrades, each a valid definition", () => {
    expect(Object.keys(MUT_GEN_ROLE_UPGRADES).sort()).toEqual([...SCRIPTED].sort());
    for (const definition of Object.values(MUT_GEN_ROLE_UPGRADES)) expect(validateDefinition(definition)).toEqual([]);
  });

  it("the campaign deals each seat an upgrade of its role into play, under their control", () => {
    const start = campaignGame(0);
    expect(Number(start.instances[roleUpgradeOf(start, P1)]!.cardId)).toBeLessThanOrEqual(32180);
    expect(Number(start.instances[roleUpgradeOf(start, P2)]!.cardId)).toBeGreaterThanOrEqual(32186);
    expect(Number(start.instances[roleUpgradeOf(start, P2)]!.cardId)).toBeLessThanOrEqual(32190);
  });
});

describe("Swagger (32177 Brawler, 32186 Defender)", () => {
  it.each(["32177", "32186"])(
    "%s: on a basic defense, +3 DEF and ready the hero; then the card leaves the game and the pool",
    (code) => {
      const { state, card } = heroGame(code);
      const hero = identityOf(state, P1);
      const turnTwo = settled(run(state, endTurn(P1)));
      const reached = settle(
        run(turnTwo, endTurn(P2)),
        firstLegal,
        (s) => s.pendingChoice?.prompt.kind === "declareDefender",
        WAVE6_DEPS,
      );
      expect(reached.pendingChoice?.prompt.kind, "the villain attacks the first player").toBe("declareDefender");
      const declared = answer(reached, [hero], WAVE6_DEPS);
      const bare = settled(declared, firstLegal);
      const swaggered = settled(declared, accepting(`${code}.swagger-interrupt`));
      expect(inst(bare, hero).damage, "the control takes damage").toBeGreaterThan(0);
      expect(inst(swaggered, hero).damage).toBe(Math.max(0, inst(bare, hero).damage - 3));
      expect(inst(bare, hero).exhausted).toBe(true);
      expect(inst(swaggered, hero).exhausted).toBe(false);
      expectRemoved(swaggered, card, code);
      expect(bare.removedFromGame).not.toContain(card);
    },
  );
});

describe("Brazen Defense (32178 Brawler): prevent 3 damage from this attack (§3.81)", () => {
  /** Answers every choice with `pick` until none is pending, and returns the state and every event on the way. */
  function settleWithEvents(
    state: GameState,
    pick: Picker,
  ): { readonly state: GameState; readonly events: GameEvent[] } {
    const events: GameEvent[] = [];
    let current = state;
    for (let guard = 0; current.pendingChoice && !current.outcome; guard++) {
      if (guard > 500) throw new Error("choices did not settle");
      const choice = current.pendingChoice;
      const result = applyCommand(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(current),
        },
        WAVE6_DEPS,
      );
      if (!result.ok) throw new Error(result.error.message);
      events.push(...result.events);
      current = result.state;
    }
    return { state: current, events };
  }
  /** The first `damageDealt` event to `target`, if any. */
  const firstDamageTo = (events: readonly GameEvent[], target: InstanceId) =>
    events.find((e) => e.type === "damageDealt" && e.targetInstanceId === target);

  it("spend 1: the attack's damage to the hero is 3 less (logged prevented), the attacker takes 3, the card leaves", () => {
    const { state, card } = heroGame("32178");
    const hero = identityOf(state, P1);
    const turnTwo = settled(run(state, endTurn(P1)));
    const villain = activeVillain(turnTwo).instanceId;
    const reached = settle(
      run(turnTwo, endTurn(P2)),
      firstLegal,
      (s) => (s.pendingChoice?.options ?? []).some((o) => o.optionId.endsWith("32178.brazen-defense-constant")),
      WAVE6_DEPS,
    );
    expect(reached.pendingChoice?.prompt.kind, "the villain's attack offers the interrupt").toBe("chooseTriggers");
    // The control declines it; the other accepts and pays its 1 resource with the Energy in hand. Both leave the
    // attack undefended (`firstLegal`), so the same boost card makes the same damage.
    const accept = accepting("32178.brazen-defense-constant");
    const bare = settleWithEvents(reached, firstLegal);
    const brazen = settleWithEvents(reached, (s) =>
      s.pendingChoice?.prompt.kind === "payForAbility"
        ? [(s.pendingChoice.options.find((o) => o.label === "Energy") ?? s.pendingChoice.options[0]!).optionId]
        : accept(s),
    );
    const dealt = firstDamageTo(bare.events, hero);
    expect(dealt?.type === "damageDealt" && dealt.amount, "the control: the attack damages the hero").toBeGreaterThan(
      3,
    );
    const full = dealt?.type === "damageDealt" ? dealt.amount : 0;
    expect(brazen.events).toContainEqual({
      type: "damagePrevented",
      targetInstanceId: hero,
      amount: 3,
      reason: "effect",
    });
    expect(firstDamageTo(brazen.events, hero)).toMatchObject({ amount: full - 3 });
    // "Deal 3 damage to that enemy", as an attack by the hero, before the villain's attack resolves.
    expect(firstDamageTo(brazen.events, villain)).toMatchObject({ amount: 3, sourceInstanceId: hero });
    expect(firstDamageTo(bare.events, villain)).toBeUndefined();
    expectRemoved(brazen.state, card, "32178");
    expect(bare.state.removedFromGame).not.toContain(card);
  });
});

describe("Coup de Grace (32176 Brawler, 32181 Commander)", () => {
  const SHADOWCAT_SURPRISE = "32037"; // Hero Action (attack): deal 3 damage to an enemy, cost 2
  const basicAttack = (state: GameState, target: InstanceId): Command => ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(state, P1),
    targetInstanceId: target,
  });
  /** A Hellfire Pawn (32058, 3 hit points; set aside in this scenario) engaged with P1 (state surgery: no reveal). */
  function withMinion(state: GameState): { readonly state: GameState; readonly minion: InstanceId } {
    const minion = Object.values(state.instances).find((i) => i.cardId === cardId("32058"))!.instanceId;
    const moved: GameState = {
      ...state,
      encounterSetAside: state.encounterSetAside.filter((id) => id !== minion),
      encounterDecks: Object.fromEntries(
        Object.entries(state.encounterDecks).map(([key, piles]) => [
          key,
          { ...piles, deck: piles.deck.filter((id) => id !== minion) },
        ]),
      ),
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, minion] } : p)),
    };
    return { state: patchInstance(moved, minion, { engagedWith: P1, controllerId: null, faceup: true }), minion };
  }

  it.each(["32176", "32181"])(
    "%s: a basic attack deals 3 additional damage; the card leaves the game and the pool",
    (code) => {
      const { state, card } = heroGame(code);
      const villain = activeVillain(state).instanceId;
      const bare = settled(run(state, basicAttack(state, villain)));
      const coup = settled(run(state, basicAttack(state, villain)), accepting(`${code}.coup-de-grace-interrupt`));
      expect(inst(bare, villain).damage, "the control damages the villain").toBeGreaterThan(
        inst(state, villain).damage,
      );
      expect(inst(coup, villain).damage).toBe(inst(bare, villain).damage + 3);
      expectRemoved(coup, card, code);
      expect(bare.removedFromGame).not.toContain(card);
    },
  );

  it("32176: an attack event deals 3 additional damage", () => {
    const base = heroGame("32176");
    const { state, id } = handCardAs(base.state, SHADOWCAT_SURPRISE);
    const villain = activeVillain(state).instanceId;
    const cast = play(P1, id, playerOf(state, P1).hand.slice(1, 3));
    const bare = settled(run(state, cast));
    const coup = settled(run(state, cast), accepting("32176.coup-de-grace-interrupt"));
    expect(inst(bare, villain).damage - inst(state, villain).damage, "the event deals 3").toBe(3);
    expect(inst(coup, villain).damage - inst(state, villain).damage).toBe(3 + 3);
    expectRemoved(coup, base.card, "32176");
  });

  it("32181: the attack gains overkill, and the excess with the 3 additional damage goes to the villain", () => {
    const base = heroGame("32181");
    const { state, minion } = withMinion(base.state);
    const villain = activeVillain(state).instanceId;
    const atk = characterProfile(state, identityOf(state, P1), WAVE6_DEPS)!.atk;
    const remaining = characterProfile(state, minion, WAVE6_DEPS)!.maxHp - inst(state, minion).damage;
    expect(atk + 3, "the control: the boosted attack defeats the minion").toBeGreaterThan(remaining);
    const bare = settled(run(state, basicAttack(state, minion)));
    const coup = settled(run(state, basicAttack(state, minion)), accepting("32181.coup-de-grace-interrupt"));
    expect(activeEncounterDeck(coup).discard).toContain(minion);
    // Without it, no overkill: nothing reaches the villain. With it, the excess of ATK + 3 does (RRG 1.8 p. 31).
    expect(inst(bare, villain).damage).toBe(inst(state, villain).damage);
    expect(inst(coup, villain).damage - inst(state, villain).damage).toBe(atk + 3 - remaining);
    expectRemoved(coup, base.card, "32181");
  });
});

describe("Ferocious Attack (32179) and Shock and Awe (32184)", () => {
  it("32179.ferocious-attack-action: spend 3 resources, deal 6 damage to an enemy, ready the hero, remove the card", () => {
    const { state, card } = heroGame("32179");
    const hero = identityOf(state, P1);
    const tired = patchInstance(state, hero, { exhausted: true });
    const pay = handPay(tired, 3);
    const after = settled(run(tired, use(P1, card, "32179.ferocious-attack-action", pay)));
    expect(totalDamage(after) - totalDamage(tired)).toBe(6);
    expect(inst(after, hero).exhausted).toBe(false);
    expect(playerOf(after, P1).hand).toHaveLength(playerOf(tired, P1).hand.length - 3);
    expectRemoved(after, card, "32179");
  });

  it("32179.ferocious-attack-action: refused when 3 resources are not spent", () => {
    const { state, card } = heroGame("32179");
    expect(applyCommand(state, use(P1, card, "32179.ferocious-attack-action", handPay(state, 0)), WAVE6_DEPS).ok).toBe(
      false,
    );
  });

  it("32184.shock-and-awe-action: spend 3 resources, deal 6 damage to an enemy, ready each ally you control, remove the card", () => {
    const base = heroGame("32184");
    const { state, ally } = withAlly(base.state);
    const pay = handPay(state, 3);
    const after = settled(run(state, use(P1, base.card, "32184.shock-and-awe-action", pay)));
    expect(totalDamage(after) - totalDamage(state)).toBe(6);
    expect(inst(after, ally).exhausted).toBe(false);
    expectRemoved(after, base.card, "32184");
  });
});

describe("Group Assault (32183) and Rescue Operation (32193): prevent consequential damage this phase (§3.31)", () => {
  /** P1's role upgrade made `code`, used; a ready, undamaged Nightcrawler (1 consequential damage each power) in play. */
  function used(code: string, ability: string) {
    const base = heroGame(code);
    const withNightcrawler = withAlly(withThreat(base.state));
    const state = patchInstance(withNightcrawler.state, withNightcrawler.ally, { exhausted: false, damage: 0 });
    const after = settled(run(state, use(P1, base.card, ability, [])));
    expectRemoved(after, base.card, code);
    return { state: after, ally: withNightcrawler.ally };
  }
  const attackWith = (state: GameState, ally: InstanceId): Command => {
    const minion = enemies(state).find((id) => typeOf(state, id) === "minion");
    return {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: ally,
      targetInstanceId: minion ?? activeVillain(state)!.instanceId,
    };
  };
  /** A basic thwart of the first scheme the ally may thwart (a crisis icon can block the main scheme). */
  const thwartWith = (state: GameState, ally: InstanceId): Command => {
    const of = (scheme: InstanceId): Command => ({
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: ally,
      schemeInstanceId: scheme,
    });
    const scheme = schemes(state).find((id) => applyCommand(state, of(id), WAVE6_DEPS).ok);
    return of(scheme!);
  };

  it("32183.group-assault-action: an ally's attack this phase takes no consequential damage; its thwart still does", () => {
    const { state, ally } = used("32183", "32183.group-assault-action");
    const attacked = settled(run(state, attackWith(state, ally)));
    expect(inst(attacked, ally).damage).toBe(0);
    const readied = patchInstance(attacked, ally, { exhausted: false });
    const thwarted = settled(run(readied, thwartWith(readied, ally)));
    expect(inst(thwarted, ally).damage).toBe(1);
  });

  it("32193.rescue-operation-action: an ally's thwart this phase takes no consequential damage; its attack still does", () => {
    const { state, ally } = used("32193", "32193.rescue-operation-action");
    const thwarted = settled(run(state, thwartWith(state, ally)));
    expect(inst(thwarted, ally).damage).toBe(0);
    const readied = patchInstance(thwarted, ally, { exhausted: false });
    const attacked = settled(run(readied, attackWith(readied, ally)));
    expect(inst(attacked, ally).damage).toBe(1);
  });
});

describe("the resource upgrades (32180, 32185, 32190, 32195)", () => {
  it("32180.war-cry-resource: pays 2 for an Attack event, gives the hero a tough status card, removes the card", () => {
    const base = heroGame("32180");
    const { state, id } = handCardAs(base.state, STEEL_FIST);
    const hero = identityOf(state, P1);
    // Read before Steel Fist resolves: it lets the player discard a tough status card from their hero.
    const paid = run(state, play(P1, id, [], { abilities: [resourceAbility(base.card, "32180.war-cry-resource")] }));
    expect(inst(paid, hero).statuses.tough).toBe(inst(state, hero).statuses.tough + 1);
    expectRemoved(paid, base.card, "32180");
    expect(playerOf(settled(paid), P1).discard).toContain(id);
  });

  it("32180.war-cry-resource: only for an Attack or Defense event", () => {
    const base = heroGame("32180");
    const { state, id } = handCardAs(base.state, INCONSPICUOUS);
    const paid = applyCommand(
      state,
      play(P1, id, [], { abilities: [resourceAbility(base.card, "32180.war-cry-resource")] }),
      WAVE6_DEPS,
    );
    expect(paid.ok).toBe(false);
  });

  it("32185.improvisation-resource: pays 2 for an Attack event, readies an ally and heals 2 damage from it", () => {
    const base = heroGame("32185");
    const { state: withNightcrawler, ally } = withAlly(base.state);
    const { state, id } = handCardAs(withNightcrawler, STEEL_FIST);
    const damaged = patchInstance(state, ally, { damage: 3 });
    const after = settled(
      run(damaged, play(P1, id, [], { abilities: [resourceAbility(base.card, "32185.improvisation-resource")] })),
    );
    expect(playerOf(after, P1).discard).toContain(id);
    expect(inst(after, ally).exhausted).toBe(false);
    expect(inst(after, ally).damage).toBe(1);
    expectRemoved(after, base.card, "32185");
  });

  it("32190.bodyguard-resource: pays 2 for a Thwart event and draws 1 card", () => {
    const base = heroGame("32190");
    const { state, id } = handCardAs(base.state, INCONSPICUOUS);
    const threatened = withThreat(state);
    const after = settled(
      run(threatened, play(P1, id, [], { abilities: [resourceAbility(base.card, "32190.bodyguard-resource")] })),
    );
    expect(playerOf(after, P1).discard).toContain(id);
    expect(playerOf(after, P1).deck).toHaveLength(playerOf(threatened, P1).deck.length - 1);
    expect(playerOf(after, P1).hand).toHaveLength(playerOf(threatened, P1).hand.length); // -1 played, +1 drawn
    expectRemoved(after, base.card, "32190");
  });

  it("32195.fortitude-resource: pays 2 for a Thwart event and stuns an enemy", () => {
    const base = heroGame("32195");
    const { state, id } = handCardAs(base.state, INCONSPICUOUS);
    const threatened = withThreat(state);
    const after = settled(
      run(threatened, play(P1, id, [], { abilities: [resourceAbility(base.card, "32195.fortitude-resource")] })),
    );
    const stunned = enemies(after).filter((enemy) => inst(after, enemy).statuses.stunned > 0);
    expect(stunned).toHaveLength(1);
    expect(playerOf(after, P1).discard).toContain(id);
    expectRemoved(after, base.card, "32195");
  });
});

describe("the thwart upgrades (32187, 32191, 32188, 32194)", () => {
  /** Scenario 1's Find the Senator: a side scheme no crisis icon protects (Frightened Police's crisis shields the main scheme). */
  const senator = (state: GameState) => cardsInPlay(state).find((id) => state.instances[id]!.cardId === "32065a")!;
  /** Divides threat onto `scheme` only: a crisis icon in play makes the main scheme's threat unremovable by a thwart. */
  const dividingOnto =
    (scheme: InstanceId, base: Picker = firstLegal): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "divide") return base(state);
      return choice.options
        .map((o) => o.optionId)
        .filter((id) => id.startsWith(`${scheme}#`))
        .slice(0, choice.maxSelections);
    };

  /** P1's basic thwart of Find the Senator, offering the named response. */
  function thwartWith(state: GameState, ability: string): GameState {
    const target = senator(state);
    return settled(
      run(state, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(state, P1),
        schemeInstanceId: target,
      }),
      dividingOnto(target, accepting(ability)),
    );
  }

  it.each(["32187", "32191"])(
    "%s.surprise-response: after you thwart, removes 3 threat from among schemes and confuses an enemy",
    (code) => {
      const base = heroGame(code);
      const state = withThreat(base.state);
      const control = thwartWith(state, "none");
      const after = thwartWith(state, `${code}.surprise-response`);
      expect(totalThreat(control) - totalThreat(after)).toBe(3);
      expect(enemies(control).filter((id) => inst(control, id).statuses.confused > 0)).toHaveLength(0);
      expect(enemies(after).filter((id) => inst(after, id).statuses.confused > 0)).toHaveLength(1);
      expectRemoved(after, base.card, code);
    },
  );

  it("32188.heroic-intervention-action: spend 3, remove 5 threat from among schemes, gain a tough status card", () => {
    const base = heroGame("32188");
    const state = withThreat(base.state);
    const hero = identityOf(state, P1);
    const after = settled(
      run(state, use(P1, base.card, "32188.heroic-intervention-action", handPay(state, 3))),
      dividingOnto(senator(state)),
    );
    expect(totalThreat(state) - totalThreat(after)).toBe(5);
    expect(inst(after, hero).statuses.tough).toBe(inst(state, hero).statuses.tough + 1);
    expectRemoved(after, base.card, "32188");
  });

  // Owner decision (2026-10-03): a "(thwart)"-labeled ability is a real thwart though it uses no THW. RRG 1.8 "Labeled
  // Ability" (p. 26); "Patrol" (p. 32): the engaged player "cannot use cards they control to thwart the main scheme".
  it.each([
    ["32188", "32188.heroic-intervention-action"],
    ["32194", "32194.mentorship-action"],
  ])(
    "%s is a thwart (owner decision; RRG 1.8 pp. 26, 32): an engaged patrol minion stops its removal from the main scheme, not from a side scheme",
    (code, ability) => {
      const base = heroGame(code);
      // No crisis icon, so only patrol protects the main scheme; a Sentinel Mark IV (guard, patrol) engaged with P1.
      const open: GameState = {
        ...base.state,
        cardPool: Object.fromEntries(
          Object.entries(base.state.cardPool).map(([id, card]) => [
            id,
            card.type === "side_scheme" ? { ...card, icons: card.icons.filter((icon) => icon !== "crisis") } : card,
          ]),
        ) as GameState["cardPool"],
      };
      const sentinel = WAVE6_CARDS.find((card) => card.id === cardId("32093"))!;
      const spare = activeEncounterDeck(open).deck[0]!;
      const pooled: GameState = {
        ...patchInstance(open, spare, { cardId: sentinel.id }),
        cardPool: { ...open.cardPool, [sentinel.id]: sentinel },
      };
      const state = withThreat(engageMinion(pooled, "32093").state);
      const main = state.mainScheme.instanceId;
      const using = (from: GameState, scheme: InstanceId) =>
        settled(run(from, use(P1, base.card, ability, handPay(from, 3))), dividingOnto(scheme));
      // All 5 put on the main scheme: none removed, and the rest of the card still resolves.
      const stopped = using(state, main);
      expect(inst(stopped, main).threat).toBe(inst(state, main).threat);
      expect(totalThreat(stopped)).toBe(totalThreat(state));
      expectRemoved(stopped, base.card, code);
      // All 5 put on Find the Senator: removed.
      const side = using(state, senator(state));
      expect(totalThreat(state) - totalThreat(side)).toBe(5);
      // Without the patrol minion the main scheme's 5 come off.
      const free = withThreat(open);
      expect(inst(using(free, main), main).threat).toBe(inst(free, main).threat - 5);
    },
  );

  it("32194.mentorship-action: spend 3, remove 5 threat from among schemes, ready each ally you control", () => {
    const base = heroGame("32194");
    const { state: withNightcrawler, ally } = withAlly(base.state);
    const state = withThreat(withNightcrawler);
    const after = settled(
      run(state, use(P1, base.card, "32194.mentorship-action", handPay(state, 3))),
      dividingOnto(senator(state)),
    );
    expect(totalThreat(state) - totalThreat(after)).toBe(5);
    expect(inst(after, ally).exhausted).toBe(false);
    expectRemoved(after, base.card, "32194");
  });
});

describe("Determined Defense (32189 Defender): the attack removes threat instead of dealing damage", () => {
  const REF = "32189.determined-defense-constant";
  const offered = (state: GameState) => (state.pendingChoice?.options ?? []).some((o) => o.optionId.endsWith(REF));
  /** Answers every choice with `pick` until the attack is over, and returns the state and every event on the way. */
  function settleWithEvents(
    state: GameState,
    pick: Picker,
  ): { readonly state: GameState; readonly events: GameEvent[] } {
    const events: GameEvent[] = [];
    let current = state;
    const attacking = (s: GameState) => s.stack.some((frame) => frame.kind === "enemyAttack");
    for (let guard = 0; current.pendingChoice && attacking(current) && !current.outcome; guard++) {
      if (guard > 500) throw new Error("choices did not settle");
      const choice = current.pendingChoice;
      const result = applyCommand(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(current),
        },
        WAVE6_DEPS,
      );
      if (!result.ok) throw new Error(result.error.message);
      events.push(...result.events);
      current = result.state;
    }
    return { state: current, events };
  }
  /** Accepts the interrupt and pays its 2 resources with as many hand cards as the prompt needs. */
  const determined: Picker = (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "payForAbility") {
      return choice.options.slice(0, Math.max(choice.minSelections, 2)).map((o) => o.optionId);
    }
    return accepting(REF)(state);
  };
  /** The side schemes in play that show a crisis icon (this scenario starts with Find the Senator and a campaign one). */
  const crisisSchemes = (state: GameState) =>
    cardsInPlay(state).filter((id) => {
      const card = state.cardPool[inst(state, id).cardId];
      return card?.type === "side_scheme" && card.icons.includes("crisis");
    });
  /** State surgery: those side schemes' crisis icons are gone from the card pool, so nothing protects the main scheme. */
  const withoutCrisis = (state: GameState): GameState => ({
    ...state,
    cardPool: Object.fromEntries(
      Object.entries(state.cardPool).map(([id, card]) => [
        id,
        card.type === "side_scheme" ? { ...card, icons: card.icons.filter((icon) => icon !== "crisis") } : card,
      ]),
    ) as GameState["cardPool"],
  });
  /**
   * The villain's attack on P1 in the second villain phase, at its defender prompt, with 12 threat on the main scheme
   * (`prepare` changes the state before the round ends: a status card, the crisis icons).
   */
  function attacked(prepare: (state: GameState, hero: InstanceId) => GameState = withoutCrisis) {
    const { state, card } = heroGame("32189");
    const hero = identityOf(state, P1);
    const turnTwo = prepare(settled(run(state, endTurn(P1))), hero);
    const reached = settle(
      run(patchInstance(turnTwo, turnTwo.mainScheme.instanceId, { threat: 12 }), endTurn(P2)),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE6_DEPS,
    );
    expect(reached.pendingChoice?.prompt.kind, "the villain attacks the first player").toBe("declareDefender");
    return { reached, card, hero, scheme: reached.mainScheme.instanceId };
  }
  /** This attack's own events: from the first answer to the attacked character's `characterAttacked`. */
  function ofThisAttack(events: readonly GameEvent[]): readonly GameEvent[] {
    const end = events.findIndex((e) => e.type === "triggerEvent" && e.event.kind === "characterAttacked");
    return end < 0 ? events : events.slice(0, end + 1);
  }
  const resolvedAttack = (events: readonly GameEvent[]) => events.find((e) => e.type === "attackResolved");
  const damageTo = (events: readonly GameEvent[], target: InstanceId) =>
    events.filter((e) => e.type === "damageDealt" && e.targetInstanceId === target);
  const paidFromHand = (events: readonly GameEvent[]) =>
    events.filter((e) => e.type === "cardDiscardedFromHand" && e.playerId === P1).length;

  it("on a basic defense, spend 2: the hero takes none, the damage it would have taken comes off the main scheme", () => {
    const { reached, card, hero, scheme } = attacked();
    const declared = answer(reached, [hero], WAVE6_DEPS);
    expect(offered(declared), "defending offers the interrupt").toBe(true);
    const bare = ofThisAttack(settleWithEvents(declared, firstLegal).events);
    const after = settleWithEvents(declared, determined);
    const defended = ofThisAttack(after.events);
    // The control: the same boost card, so ATK + boost icons - DEF lands on the hero.
    const control = resolvedAttack(bare);
    const amount = control?.type === "attackResolved" ? control.damageDealt : 0;
    expect(amount, "the control takes damage through its defense").toBeGreaterThan(0);
    expect(control?.type === "attackResolved" && control.defenseReduction, "DEF is subtracted").toBeGreaterThan(0);
    expect(damageTo(bare, hero)).toEqual([expect.objectContaining({ amount })]);
    expect(paidFromHand(bare)).toBe(0);

    expect(resolvedAttack(defended)).toMatchObject({
      targetInstanceId: hero,
      damageDealt: 0,
      removesThreatFrom: scheme,
      threatInstead: amount,
    });
    expect(damageTo(defended, hero)).toEqual([]);
    // It is a thwart by the hero (the label), removing what the attack would have dealt; it cost 2 resources.
    const thwart = after.events.find((e) => e.type === "triggerEvent" && e.event.kind === "thwart");
    expect(thwart).toMatchObject({ event: { thwarterInstanceId: hero, schemeInstanceId: scheme, basic: false } });
    expect(after.events).toContainEqual({
      type: "threatRemoved",
      schemeInstanceId: scheme,
      amount,
      sourceInstanceId: hero,
    });
    expect(paidFromHand(defended)).toBe(2);
    expectRemoved(after.state, card, "32189");
  });

  it("with a crisis icon in play no threat is removed, and the attack still deals no damage (RRG 1.8 p. 14)", () => {
    const { reached, card, hero, scheme } = attacked((state) => state);
    expect(crisisSchemes(reached).length, "this scenario's side schemes show crisis icons").toBeGreaterThan(0);
    const after = settleWithEvents(answer(reached, [hero], WAVE6_DEPS), determined);
    const defended = ofThisAttack(after.events);
    expect(resolvedAttack(defended)).toMatchObject({ damageDealt: 0, removesThreatFrom: scheme });
    expect(damageTo(defended, hero)).toEqual([]);
    expect(after.events).toContainEqual({ type: "threatRemovalBlocked", schemeInstanceId: scheme, reason: "crisis" });
    expect(after.events.filter((e) => e.type === "threatRemoved" && e.schemeInstanceId === scheme)).toEqual([]);
    expectRemoved(after.state, card, "32189");
  });

  it("is not offered for an undefended attack: 'when you defend'", () => {
    const { reached, card } = attacked();
    const undefended = settleWithEvents(answer(reached, ["decline"], WAVE6_DEPS), (state) => {
      expect(offered(state)).toBe(false);
      return firstLegal(state);
    });
    expect(resolvedAttack(undefended.events)).toMatchObject({ defenseReduction: 0 });
    expect(undefended.state.removedFromGame).not.toContain(card);
  });

  it("a confused hero: the cost is paid and the ability canceled, so the attack deals its damage and the card stays", () => {
    const { reached, card, hero, scheme } = attacked((state, id) =>
      patchInstance(withoutCrisis(state), id, { statuses: { ...inst(state, id).statuses, confused: 1 } }),
    );
    const declared = answer(reached, [hero], WAVE6_DEPS);
    const bare = ofThisAttack(settleWithEvents(declared, firstLegal).events);
    const after = settleWithEvents(declared, determined);
    const defended = ofThisAttack(after.events);
    // RRG 1.8 "Labeled Ability" (p. 26): "the entire ability (except for its costs) is canceled", and the status card
    // that canceled it is removed. The card's own removal is one of the canceled effects.
    expect(paidFromHand(defended)).toBe(2);
    expect(inst(after.state, hero).statuses.confused).toBe(0);
    expect(resolvedAttack(defended)).toEqual(resolvedAttack(bare));
    expect(damageTo(defended, hero)).toEqual(damageTo(bare, hero));
    expect(damageTo(defended, hero)).toHaveLength(1);
    expect(after.events.filter((e) => e.type === "threatRemoved" && e.schemeInstanceId === scheme)).toEqual([]);
    expect(after.state.removedFromGame).not.toContain(card);
    expect(after.state.campaignWrites?.removedFromCampaign ?? []).toEqual([]);
  });
});

describe("Compassion (32182 Commander, 32192 Peacekeeper)", () => {
  /** A campaign game in alter-ego form where P1's role upgrade is `code`, with `damage` on P1's identity. */
  function alterEgoGame(code: string, damage: number) {
    const start = campaignGame(0);
    const card = roleUpgradeOf(start, P1);
    const identity = identityOf(start, P1);
    expect(playerOf(start, P1).identity.form).toBe("alterEgo");
    const state = patchInstance(patchInstance(start, card, { cardId: cardId(code) }), identity, { damage });
    return { state, card, identity };
  }
  /** P1 recovers; `ability` ("none" to decline) is answered, and a heal division with `shares`. */
  function recoverWith(state: GameState, ability: string, shares: readonly string[] = []) {
    let divided = 0;
    const pick: Picker = (current) => {
      if (current.pendingChoice?.prompt.kind !== "divide") return accepting(ability)(current);
      divided += 1;
      return shares;
    };
    const after = settled(run(state, { type: "basicRecover", playerId: P1 }), pick);
    return { after, divided };
  }
  const handSize = (state: GameState) => playerOf(state, P1).hand.length;

  it.each(["32182", "32192"])(
    "%s.compassion-response: after you recover, 3 damage is healed from among your characters as you choose, and you draw 1 card",
    (code) => {
      const base = alterEgoGame(code, 9);
      const { state, ally } = withAlly(base.state);
      const control = recoverWith(state, "none").after;
      expect(inst(control, base.identity).damage).toBeGreaterThanOrEqual(3);
      const { after, divided } = recoverWith(state, `${code}.compassion-response`, [
        `${base.identity}#1`,
        `${base.identity}#2`,
        `${ally}#1`,
      ]);
      expect(divided).toBe(1);
      expect(inst(after, base.identity).damage).toBe(inst(control, base.identity).damage - 2);
      expect(inst(control, ally).damage).toBe(1);
      expect(inst(after, ally).damage).toBe(0);
      expect(handSize(after)).toBe(handSize(control) + 1);
      expectRemoved(after, base.card, code);
    },
  );

  it("32182: a character is offered no more points than the damage on it, and the whole 3 must be healed", () => {
    const base = alterEgoGame("32182", 9);
    const { state, ally } = withAlly(base.state);
    const asked = settle(
      run(state, { type: "basicRecover", playerId: P1 }),
      accepting("32182.compassion-response"),
      (current) => current.pendingChoice?.prompt.kind === "divide",
      WAVE6_DEPS,
    );
    const choice = asked.pendingChoice!;
    expect(choice.prompt).toMatchObject({ kind: "divide", what: "heal", amount: 3 });
    expect([choice.minSelections, choice.maxSelections]).toEqual([3, 3]);
    expect(choice.options.map((o) => o.optionId).sort()).toEqual(
      [`${ally}#1`, `${base.identity}#1`, `${base.identity}#2`, `${base.identity}#3`].sort(),
    );
  });

  it("32192: with no more than 3 damage left among your characters, all of it is healed without a choice", () => {
    // The recovery heals the identity's 1 damage first; the ally's 1 is all that is left.
    const base = alterEgoGame("32192", 1);
    const { state, ally } = withAlly(base.state);
    const { after, divided } = recoverWith(state, "32192.compassion-response");
    expect(divided).toBe(0);
    expect(inst(after, base.identity).damage).toBe(0);
    expect(inst(after, ally).damage).toBe(0);
    expectRemoved(after, base.card, "32192");
  });

  it("32182: nothing left to heal after the recovery, the card is still drawn and the upgrade removed", () => {
    const base = alterEgoGame("32182", 1);
    const control = recoverWith(base.state, "none").after;
    const { after, divided } = recoverWith(base.state, "32182.compassion-response");
    expect(divided).toBe(0);
    expect(inst(after, base.identity).damage).toBe(0);
    expect(handSize(after)).toBe(handSize(control) + 1);
    expectRemoved(after, base.card, "32182");
  });

  it.each(["32182", "32192"] as const)("%s: an optional Alter-Ego Response", (code) => {
    expect(MUT_GEN_ROLE_UPGRADES[`${code}.compassion-response`].trigger).toMatchObject({
      kind: "response",
      forced: false,
      form: "alterEgo",
    });
  });
});

describe("the campaign pool across a lost game (Q12)", () => {
  const DEF = MUT_GEN_CAMPAIGN_DEFINITION;
  const roleUpgradeField = (log: CampaignLog, seat: number): string | undefined => {
    const value = log.seats[seat]?.fields.roleUpgrade;
    return value?.kind === "cardRef" && value.cardId !== "" ? (value.cardId as string) : undefined;
  };
  function finish(log: CampaignLog, result: CampaignGameResult): CampaignLog {
    const answers: CampaignChoiceAnswer[] = [];
    for (let guard = 0; guard < 64; guard++) {
      const step = applyCampaignResult(
        DEF,
        log,
        result,
        { at: 1, gameId: "role-upgrades" },
        { pool: WAVE6_CARDS },
        answers,
      );
      if (step.kind === "done") return step.value;
      answers.push({
        instructionId: step.choice.instructionId,
        slot: step.choice.slot,
        seatNumber: step.choice.seatNumber,
        picked: [],
      });
    }
    throw new Error("too many choices");
  }
  const lost = (removed: CampaignGameResult["removedFromCampaign"]): CampaignGameResult => ({
    nodeId: "sabretooth",
    outcome: "lost",
    records: [],
    removedFromCampaign: removed,
    logWrites: [],
    expiringGrants: [],
  });

  /** A composed scenario-1 log whose seat 1 was dealt Ferocious Attack (the dealing is seeded). */
  function dealtFerociousAttack(): CampaignLog {
    for (let seed = 1; seed < 200; seed++) {
      const log = compose(logBefore(0, seed));
      if (roleUpgradeField(log, 0) === "32179") return log;
    }
    throw new Error("no seed deals Ferocious Attack to seat 1");
  }

  it("a used upgrade's own removal survives the lost game: it is not dealt again, and the unused one is not removed", () => {
    const log = dealtFerociousAttack();
    const unused = roleUpgradeField(log, 1)!;
    const game = gameFromComposedLog(log);
    const card = roleUpgradeOf(game, P1);
    expect(game.instances[card]!.cardId).toBe("32179");
    const hero = settled(run(game, toHero(P1)));
    const used = settled(run(hero, use(P1, card, "32179.ferocious-attack-action", handPay(hero, 3))));
    expectRemoved(used, card, "32179");

    const after = finish(log, lost(used.campaignWrites!.removedFromCampaign));
    expect(after.position.nextNodeId).toBe("sabretooth");
    expect(after.removedFromCampaign.map((face) => face.cardId as string)).toEqual(["32179"]);
    const retry = compose(after);
    const redealt = Number(roleUpgradeField(retry, 0));
    expect(redealt).not.toBe(32179);
    expect(redealt).toBeGreaterThanOrEqual(32176);
    expect(redealt).toBeLessThanOrEqual(32180);
    expect(retry.removedFromCampaign.map((face) => face.cardId as string)).not.toContain(unused);
  });

  it("an unused upgrade is not removed by a lost game: the retry deals the role's set again", () => {
    const log = dealtFerociousAttack();
    const after = finish(log, lost([]));
    expect(after.removedFromCampaign).toEqual([]);
    const retry = compose(after);
    for (const [seat, [low, high]] of [
      [0, [32176, 32180]],
      [1, [32186, 32190]],
    ] as const) {
      const dealt = Number(roleUpgradeField(retry, seat));
      expect(dealt).toBeGreaterThanOrEqual(low);
      expect(dealt).toBeLessThanOrEqual(high);
    }
  });
});

describe("standalone play", () => {
  it.each(ROLE_UPGRADE_CODES)("a standalone deck cannot include %s", (code) => {
    const starter = MUT_GEN_STARTER_DECKS.find((deck) => (deck.id as string) === "colossus-protection")!;
    const deck: DeckContents = {
      identityCardId: starter.identityCardId,
      aspects: starter.aspects,
      cards: [...starter.cards, { cardId: cardId(code), quantity: 1 }],
    };
    const verdict = validateDeck(deck, WAVE6_CARDS, undefined);
    expect(verdict.ok, code).toBe(false);
    expect(verdict.ok ? [] : verdict.problems.map((p) => p.code), code).toContain("campaign_card");
  });
});
