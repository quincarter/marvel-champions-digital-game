/**
 * The Mutant Genesis role upgrades 32176-32195 (`role-upgrades.ts`), each used in a real campaign game
 * (`campaign-cards-testing.ts`: seat 1 is the Brawler, seat 2 the Defender; the card under test replaces the seat's dealt
 * upgrade). Using one removes it from the game and the campaign pool; that removal survives a lost-and-retried scenario
 * and an unused upgrade is redealt (docs/phase7-wave6.md §4.1 Q12). A standalone deck refuses them.
 */
import { cardId, MUT_GEN_STARTER_DECKS, type DeckContents } from "@mc/content";
import {
  applyCampaignResult,
  applyCommand,
  cardsInPlay,
  validateDeck,
  type CampaignChoiceAnswer,
  type CampaignGameResult,
  type CampaignLog,
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
import { MUT_GEN_ROLE_UPGRADES } from "./role-upgrades.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const settled = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, WAVE6_DEPS);

const ROLE_UPGRADE_CODES = Array.from({ length: 20 }, (_, index) => String(32176 + index));
const SCRIPTED = [
  "32177.swagger-interrupt",
  "32179.ferocious-attack-action",
  "32180.war-cry-resource",
  "32184.shock-and-awe-action",
  "32185.improvisation-resource",
  "32186.swagger-interrupt",
  "32187.surprise-response",
  "32188.heroic-intervention-action",
  "32190.bodyguard-resource",
  "32191.surprise-response",
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
  it("scripts exactly the twelve expressible upgrades, each a valid definition", () => {
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
