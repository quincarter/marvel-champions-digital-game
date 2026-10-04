/**
 * Second rules-QA file for the Mutant Genesis (MC32) campaign (`mut_gen.qa.test.ts` has the five-scenario walk, the
 * lost-and-retried scenario, Q12 and the expert rules; docs/phase7-wave6-qa-mutgen-campaign.md maps every rule to its
 * test). Everything here is short and deterministic: setup-only games and single-round games, no played-out campaigns.
 *
 * - **Compassion (32182) and Determined Defense (32189) through the campaign**: the card is dealt by the campaign into
 *   a real game, used there, `campaignResultOf` reads its removal off the real state, a lost game keeps it (RRG 1.8
 *   p. 11 "Modes of Play": "If a card is removed from a campaign, that card can no longer be used ... even if players
 *   retry the scenario"), and the retry never deals it again.
 * - **Jubilee and the Captive allies at scenarios 4 and 5** (MC32 pp. 16, 19), role choices for one and four players
 *   (MC32 p. 5), role-building's aspect restriction (p. 5), expert setup instructions per scenario, and identities
 *   that cannot change (p. 7).
 */
import { describe, expect, it } from "vitest";
import { MUT_GEN_STARTER_DECKS, type PlayModes } from "@mc/content";
import {
  activeVillain,
  applyCampaignResult,
  applyCommand,
  campaignResultOf,
  cardsInPlay,
  createCampaignLog,
  createGame,
  resolveBetweenGames,
  startGameFromLog,
  type CampaignChoiceAnswer,
  type CampaignDeps,
  type CampaignGameResult,
  type CampaignLog,
  type CampaignPendingChoice,
  type CampaignRunnerResult,
  type CampaignSeatSetup,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
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
  runWith,
  settle,
  toHero,
  type Picker,
} from "../testing/harness.js";
import { campaignGame, gameFromComposedLog, logBefore } from "../wave6/mut_gen/campaign-cards-testing.js";
import { WAVE6_CARDS, WAVE6_DEPS, wave6Scenario } from "../wave6/index.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { MUT_GEN_CAMPAIGN_DEFINITION as DEF } from "./mut_gen.js";

const DEPS: CampaignDeps = { pool: WAVE6_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: DEF.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: DEF.campaignId, expertCampaign: true } };
const NODES = ["sabretooth", "project-wideawake", "master-mold", "mansion-attack", "magneto"] as const;

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = MUT_GEN_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no mut_gen starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}
const COLOSSUS = (seat: number) => seatFor("colossus-protection", seat);
const SHADOWCAT = (seat: number) => seatFor("shadowcat-aggression", seat);

function settleBy<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  pick: (choice: CampaignPendingChoice) => readonly string[],
): { readonly value: T; readonly asked: readonly CampaignPendingChoice[] } {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const result = step(answers);
    if (result.kind === "done") return { value: result.value, asked };
    asked.push(result.choice);
    answers.push({
      instructionId: result.choice.instructionId,
      slot: result.choice.slot,
      seatNumber: result.choice.seatNumber,
      picked: pick(result.choice),
    });
  }
  throw new Error("the runner asked for more than 64 choices");
}

type Plan = Readonly<Record<number, string>>;
const planPicker =
  (plan: Plan) =>
  (choice: CampaignPendingChoice): readonly string[] =>
    choice.slot === "role" ? [plan[choice.seatNumber ?? 0] ?? choice.options[0]!] : [];

const newLog = (seats: readonly CampaignSeatSetup[], modes: PlayModes, seed: number): CampaignLog =>
  createCampaignLog(DEF, { id: `mut-gen-qa2-${seed}`, seats, modes, poolVersion: "qa-test", seed });
const composeWith = (log: CampaignLog, plan: Plan) =>
  settleBy((answers) => resolveBetweenGames(DEF, log, DEPS, log.modes, answers), planPicker(plan));
const compose = (log: CampaignLog, plan: Plan = { 1: "brawler", 2: "defender" }): CampaignLog =>
  composeWith(log, plan).value;
const fold = (composed: CampaignLog, result: CampaignGameResult): CampaignLog =>
  settleBy(
    (answers) => applyCampaignResult(DEF, composed, result, { at: 1_700_000_000_000, gameId: "qa2" }, DEPS, answers),
    () => [],
  ).value;

type RecordEntry = CampaignGameResult["records"][number];
const flag = (instructionId: string, field: string, value: boolean): RecordEntry => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "flag", value } },
});
const list = (instructionId: string, field: string, ids: readonly string[]): RecordEntry => ({
  instructionId,
  write: { field, seatNumber: null, mode: "set", value: { kind: "cardList", cardIds: ids as never } },
});
const hp = (instructionId: string, seatNumber: number, value: number): RecordEntry => ({
  instructionId,
  write: { field: "remainingHp", seatNumber, mode: "set", value: { kind: "number", value } },
});
const bare = (nodeId: string, won: boolean, records: readonly RecordEntry[] = []): CampaignGameResult => ({
  nodeId,
  outcome: won ? "won" : "lost",
  records,
  removedFromCampaign: [],
  logWrites: [],
  expiringGrants: [],
});

const roleUpgradeOf = (log: CampaignLog, seatIndex: number): string | undefined => {
  const value = log.seats[seatIndex]?.fields.roleUpgrade;
  return value?.kind === "cardRef" && value.cardId !== "" ? (value.cardId as string) : undefined;
};
const removedIds = (log: CampaignLog): readonly string[] =>
  log.removedFromCampaign.map((face) => face.cardId as string);
const ids = (log: CampaignLog): readonly string[] =>
  startGameFromLog(DEF, log).input.instructions.map((instruction) => instruction.instructionId);
const cardById = (id: string) => WAVE6_CARDS.find((card) => (card.id as string) === id);
const anywhere = (state: GameState, code: string): InstanceId[] =>
  Object.values(state.instances)
    .filter((instance) => (instance.cardId as string) === code)
    .map((instance) => instance.instanceId);
const inPlayOf = (state: GameState, code: string): InstanceId[] =>
  anywhere(state, code).filter((id) => cardsInPlay(state).includes(id));

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const settled = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, WAVE6_DEPS);
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

/** The first seed whose scenario-1 deal gives seat 1 the upgrade `code` (the deal is seeded). */
function logDealing(code: string, plan: Plan): CampaignLog {
  for (let seed = 1; seed < 300; seed++) {
    const composed = compose(newLog([COLOSSUS(1), SHADOWCAT(2)], STANDARD, seed), plan);
    if (roleUpgradeOf(composed, 0) === code) return composed;
  }
  throw new Error(`no seed deals ${code} to seat 1`);
}

/** A real game's result with the outcome forced to a loss, read off the real state (as `mut_gen.qa.test.ts` does). */
const lostResult = (composed: CampaignLog, state: GameState, events: readonly GameEvent[] = []): CampaignGameResult =>
  campaignResultOf(
    DEF,
    composed,
    state.outcome ? state : { ...state, outcome: { result: "loss", reason: "allPlayersDefeated" } },
    events,
    WAVE6_DEPS,
  );

// ---------------------------------------------------------------------------------------------------------------
// 1. Compassion and Determined Defense, dealt by the campaign and used in a real game
// ---------------------------------------------------------------------------------------------------------------

describe("Compassion 32182 through the campaign (MC32 p. 5; RRG 1.8 'Heal' p. 22, Modes of Play p. 11)", () => {
  const PLAN: Plan = { 1: "commander", 2: "peacekeeper" };
  const REF = "32182.compassion-response";

  it("dealt to a Commander, used after a recover: 3 damage healed, 1 card drawn, removed from the game and the pool, never redealt", () => {
    const composed = logDealing("32182", PLAN);
    const start = gameFromComposedLog(composed);
    const card = inPlayOf(start, "32182")[0]!;
    expect(inst(start, card).controllerId, "dealt into play under the seat's control").toBe(P1);
    expect(playerOf(start, P1).identity.form).toBe("alterEgo");
    const identity = identityOf(start, P1);
    // 12 damage on the identity: the recovery heals REC, then Compassion heals exactly 3 more, all on the identity.
    const hurt = patchInstance(start, identity, { damage: 12 });
    const recover = { type: "basicRecover", playerId: P1 } as const;
    const control = settled(run(hurt, recover), accepting("none"));
    const used = settled(run(hurt, recover), (state) =>
      state.pendingChoice?.prompt.kind === "divide"
        ? state.pendingChoice.options.slice(0, state.pendingChoice.minSelections).map((o) => o.optionId)
        : accepting(REF)(state),
    );
    expect(inst(control, identity).damage, "the control only recovers").toBeLessThan(12);
    expect(inst(used, identity).damage).toBe(inst(control, identity).damage - 3);
    expect(playerOf(used, P1).hand.length).toBe(playerOf(control, P1).hand.length + 1);
    expect(used.removedFromGame).toContain(card);
    expect(cardsInPlay(used)).not.toContain(card);
    expect((used.campaignWrites?.removedFromCampaign ?? []).map((face) => face.cardId as string)).toEqual(["32182"]);
    // The unused control keeps the card in play and writes nothing.
    expect(cardsInPlay(control)).toContain(card);
    expect(control.campaignWrites?.removedFromCampaign ?? []).toEqual([]);

    // A lost game keeps the removal (RRG p. 11), the retry deals the Commander set without it.
    const real = lostResult(composed, used);
    expect(real.outcome).toBe("lost");
    expect(real.removedFromCampaign.map((face) => face.cardId as string)).toEqual(["32182"]);
    const lost = fold(composed, real);
    expect(lost.position.nextNodeId).toBe("sabretooth");
    expect(removedIds(lost)).toEqual(["32182"]);
    const retry = compose(lost, PLAN);
    const redealt = Number(roleUpgradeOf(retry, 0));
    expect([32181, 32183, 32184, 32185]).toContain(redealt);
    expect(inPlayOf(gameFromComposedLog(retry), "32182")).toEqual([]);
  }, 60_000);
});

describe("Determined Defense 32189 through the campaign (RRG 1.8 p. 9 Attack step 4, p. 43 Target)", () => {
  const PLAN: Plan = { 1: "defender", 2: "peacekeeper" };
  const REF = "32189.determined-defense-constant";
  const offered = (state: GameState) => (state.pendingChoice?.options ?? []).some((o) => o.optionId.endsWith(REF));
  const determined: Picker = (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "payForAbility") {
      return choice.options.slice(0, Math.max(choice.minSelections, 2)).map((o) => o.optionId);
    }
    return accepting(REF)(state);
  };
  /** The side schemes show crisis icons at Sabretooth's start; surgery removes them from the pool so the main scheme
   * is a valid thwart target (the negative below runs without it). */
  const withoutCrisis = (state: GameState): GameState => ({
    ...state,
    cardPool: Object.fromEntries(
      Object.entries(state.cardPool).map(([id, card]) => [
        id,
        card.type === "side_scheme" ? { ...card, icons: card.icons.filter((icon) => icon !== "crisis") } : card,
      ]),
    ) as GameState["cardPool"],
  });

  function settleAttack(state: GameState, pick: Picker): { readonly state: GameState; readonly events: GameEvent[] } {
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

  /** The villain's attack on P1 at its defender prompt, 12 threat on the main scheme. */
  function attacked(composed: CampaignLog, prepare: (state: GameState) => GameState) {
    const start = gameFromComposedLog(composed);
    const card = inPlayOf(start, "32189")[0]!;
    const hero = identityOf(start, P1);
    const heroGame = settled(run(start, toHero(P1)));
    const turnTwo = prepare(settled(run(heroGame, endTurn(P1))));
    const reached = settle(
      run(patchInstance(turnTwo, turnTwo.mainScheme.instanceId, { threat: 12 }), endTurn(P2)),
      firstLegal,
      (s) => s.pendingChoice?.prompt.kind === "declareDefender",
      WAVE6_DEPS,
    );
    expect(reached.pendingChoice?.prompt.kind, "the villain attacks the first player").toBe("declareDefender");
    return { reached, card, hero, scheme: reached.mainScheme.instanceId };
  }

  it("dealt to a Defender, used on a basic defense: no damage to the hero, the damage comes off the main scheme, removed from the game and the pool, never redealt", () => {
    const composed = logDealing("32189", PLAN);
    const { reached, card, hero, scheme } = attacked(composed, withoutCrisis);
    const declared = answer(reached, [hero], WAVE6_DEPS);
    expect(offered(declared), "defending offers the interrupt").toBe(true);
    const threatBefore = inst(declared, scheme).threat;
    const damageBefore = inst(declared, hero).damage;
    const after = settleAttack(declared, determined);
    const resolved = after.events.find((e) => e.type === "attackResolved");
    expect(resolved).toMatchObject({ targetInstanceId: hero, damageDealt: 0, removesThreatFrom: scheme });
    const instead = resolved?.type === "attackResolved" ? (resolved.threatInstead ?? 0) : 0;
    expect(instead, "ATK + boost - DEF, at least 1").toBeGreaterThan(0);
    expect(inst(after.state, hero).damage).toBe(damageBefore);
    // The settle loop runs on past the attack into the villain's scheme step, whose placements are in the events.
    const removed = after.events.filter((e) => e.type === "threatRemoved" && e.schemeInstanceId === scheme);
    expect(removed).toEqual([
      { type: "threatRemoved", schemeInstanceId: scheme, amount: instead, sourceInstanceId: hero },
    ]);
    const placed = after.events.reduce(
      (sum, e) => (e.type === "threatPlaced" && e.schemeInstanceId === scheme ? sum + e.amount : sum),
      0,
    );
    expect(inst(after.state, scheme).threat).toBe(threatBefore - instead + placed);
    expect(after.state.removedFromGame).toContain(card);
    expect((after.state.campaignWrites?.removedFromCampaign ?? []).map((face) => face.cardId as string)).toEqual([
      "32189",
    ]);

    const lost = fold(composed, lostResult(composed, after.state, after.events));
    expect(lost.position.nextNodeId).toBe("sabretooth");
    expect(removedIds(lost)).toEqual(["32189"]);
    const retry = compose(lost, PLAN);
    expect([32186, 32187, 32188, 32190]).toContain(Number(roleUpgradeOf(retry, 0)));
    expect(inPlayOf(gameFromComposedLog(retry), "32189")).toEqual([]);
  }, 60_000);

  it("with a crisis icon in play (RRG p. 43 'Target'; Wasp FAQ p. 61) it is never offered, nothing is removed from the pool, and the unused card is redealt after a loss", () => {
    const composed = logDealing("32189", PLAN);
    const { reached, card, hero, scheme } = attacked(composed, (state) => state);
    const crisis = cardsInPlay(reached).filter((id) =>
      (reached.cardPool[inst(reached, id).cardId] as { icons?: readonly string[] } | undefined)?.icons?.includes(
        "crisis",
      ),
    );
    expect(crisis.length, "Sabretooth starts with a crisis icon in play").toBeGreaterThan(0);
    const after = settleAttack(reached, (state) => {
      if (state.pendingChoice?.prompt.kind === "declareDefender") return [hero];
      expect(offered(state)).toBe(false);
      return firstLegal(state);
    });
    expect(after.events.some((e) => e.type === "attackResolved" && e.damageDealt > 0)).toBe(true);
    expect(after.events.filter((e) => e.type === "threatRemoved" && e.schemeInstanceId === scheme)).toEqual([]);
    expect(cardsInPlay(after.state)).toContain(card);
    const lost = fold(composed, lostResult(composed, after.state, after.events));
    expect(removedIds(lost)).toEqual([]);
    expect([32186, 32187, 32188, 32189, 32190]).toContain(Number(roleUpgradeOf(compose(lost, PLAN), 0)));
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 2. Roles (MC32 p. 5) and identities (p. 7)
// ---------------------------------------------------------------------------------------------------------------

describe("roles for one and four players (MC32 p. 5: 'Each player must choose a different role')", () => {
  it("a solo campaign: all four roles are offered, one upgrade is dealt from the chosen role's set, and the scenario starts", () => {
    const log = newLog([COLOSSUS(1)], STANDARD, 71);
    const { value: composed, asked } = composeWith(log, { 1: "peacekeeper" });
    expect(asked.filter((choice) => choice.slot === "role").map((choice) => choice.options)).toEqual([
      ["brawler", "commander", "defender", "peacekeeper"],
    ]);
    const upgrade = roleUpgradeOf(composed, 0)!;
    expect(Number(upgrade)).toBeGreaterThanOrEqual(32191);
    expect(Number(upgrade)).toBeLessThanOrEqual(32195);
    const game = gameFromComposedLog(composed);
    expect(game.players).toHaveLength(1);
    expect(inPlayOf(game, upgrade)).toHaveLength(1);
  }, 60_000);

  it("four players: the options shrink 4, 3, 2, 1 and the last seat is left the one role no one took", () => {
    const seats = [COLOSSUS(1), SHADOWCAT(2), COLOSSUS(3), SHADOWCAT(4)];
    const { value: composed, asked } = composeWith(newLog(seats, STANDARD, 72), {
      1: "defender",
      2: "brawler",
      3: "peacekeeper",
    });
    expect(asked.filter((choice) => choice.slot === "role").map((choice) => choice.options)).toEqual([
      ["brawler", "commander", "defender", "peacekeeper"],
      ["brawler", "commander", "peacekeeper"],
      ["commander", "peacekeeper"],
      ["commander"],
    ]);
    expect(composed.seats.map((seat) => seat.fields.role)).toEqual([
      { kind: "choice", option: "defender" },
      { kind: "choice", option: "brawler" },
      { kind: "choice", option: "peacekeeper" },
      { kind: "choice", option: "commander" },
    ]);
    const sets = [0, 1, 2, 3].map((seat) => {
      const code = Number(roleUpgradeOf(composed, seat));
      return code >= 32191 ? "peacekeeper" : code >= 32186 ? "defender" : code >= 32181 ? "commander" : "brawler";
    });
    expect(sets).toEqual(["defender", "brawler", "peacekeeper", "commander"].map((role) => role));
  }, 60_000);

  it("role-building offers only events (roleEvent) and upgrades (roleUpgradeCard) of the role's two aspects", () => {
    const aspectsOf: Record<string, readonly string[]> = {
      brawler: ["aggression", "protection"],
      commander: ["aggression", "leadership"],
      defender: ["justice", "protection"],
      peacekeeper: ["justice", "leadership"],
    };
    for (const plan of [
      { 1: "brawler", 2: "commander" },
      { 1: "defender", 2: "peacekeeper" },
    ] satisfies Plan[]) {
      const { asked } = composeWith(newLog([COLOSSUS(1), SHADOWCAT(2)], STANDARD, 73), plan);
      const building = asked.filter((choice) => choice.slot === "roleEvent" || choice.slot === "roleUpgradeCard");
      expect(building).toHaveLength(4);
      for (const choice of building) {
        const role = plan[choice.seatNumber as 1 | 2];
        expect(choice.options.length).toBeGreaterThan(0);
        for (const option of choice.options) {
          const card = cardById(option) as { type?: string; aspect?: string } | undefined;
          expect(card?.type, `${option} for ${choice.slot}`).toBe(choice.slot === "roleEvent" ? "event" : "upgrade");
          expect(aspectsOf[role]).toContain(card?.aspect);
        }
      }
    }
  }, 60_000);

  it("identities are fixed for the campaign (MC32 p. 7): every scenario starts the seats' recorded identities", () => {
    let log = newLog([COLOSSUS(1), SHADOWCAT(2)], STANDARD, 74);
    const identities = log.seats.map((seat) => seat.identityCardId);
    for (const node of NODES) {
      const composed = compose(log);
      const start = startGameFromLog(DEF, composed);
      expect(start.nodeId).toBe(node);
      expect(start.input.seats.map((seat) => seat.identityCardId)).toEqual(identities);
      log = fold(composed, bare(node, true));
    }
    expect(log.status).toBe("won");
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 3. Jubilee and the Captive allies at scenarios 4 and 5 (MC32 pp. 12, 16, 19)
// ---------------------------------------------------------------------------------------------------------------

describe("Jubilee and Captive carry-over past scenario 3", () => {
  const SEATS = [COLOSSUS(1), SHADOWCAT(2)];
  /** A log that has won scenarios 1-3, with Jubilee recorded in play at 2 and at 3 and the two captives recorded. */
  function atScenario4(jubilee3: boolean): CampaignLog {
    let log = fold(compose(newLog(SEATS, STANDARD, 81)), bare("sabretooth", true));
    log = fold(
      compose(log),
      bare("project-wideawake", true, [
        flag("mc32.s2.victory.jubilee", "jubilee", true),
        list("mc32.s2.victory.captives", "captives", ["32089", "32091"]),
      ]),
    );
    return fold(compose(log), bare("master-mold", true, [flag("mc32.s3.victory.jubilee", "jubilee", jubilee3)]));
  }
  const shuffleCaptives: Picker = (state) => {
    const shuffle = state.pendingChoice?.options.find((option) => option.label.startsWith("Shuffle"));
    return shuffle ? [shuffle.optionId] : firstLegal(state);
  };

  it("scenario 4 puts Jubilee into play and offers each Captive recorded in the log (MC32 p. 16)", () => {
    const composed = compose(atScenario4(true));
    expect(startGameFromLog(DEF, composed).nodeId).toBe("mansion-attack");
    expect(ids(composed)).toEqual(expect.arrayContaining(["mc32.s4.setup.jubilee", "mc32.s4.setup.captives"]));
    const game = gameFromComposedLog(composed, shuffleCaptives);
    expect(inPlayOf(game, "32088b")).toHaveLength(1);
    for (const captive of ["32089", "32091"]) {
      const [instance] = anywhere(game, captive);
      expect(instance, `${captive} is in the game`).toBeDefined();
      const holder = game.players.find((player) => player.playerId === inst(game, instance!).ownerId)!;
      expect([...holder.deck, ...holder.hand]).toContain(instance);
    }
    expect(anywhere(game, "32090").filter((id) => game.players.some((p) => p.deck.includes(id)))).toEqual([]);
  }, 60_000);

  it("scenario 5 keeps Jubilee only if scenario 4 recorded her in play, otherwise she is removed from the log (MC32 pp. 16, 19)", () => {
    const four = compose(atScenario4(true));
    const kept = compose(fold(four, bare("mansion-attack", true, [flag("mc32.s4.victory.jubilee", "jubilee", true)])));
    expect(startGameFromLog(DEF, kept).nodeId).toBe("magneto");
    expect(inPlayOf(gameFromComposedLog(kept, shuffleCaptives), "32088b")).toHaveLength(1);

    const dropped = compose(
      fold(four, bare("mansion-attack", true, [flag("mc32.s4.victory.jubilee", "jubilee", false)])),
    );
    expect(ids(dropped)).not.toContain("mc32.s5.setup.jubilee");
    expect(anywhere(gameFromComposedLog(dropped, shuffleCaptives), "32088b").filter(Boolean)).toEqual([]);
  }, 60_000);

  it("a Jubilee removed at scenario 3 stays gone at scenarios 4 and 5, even if a later game records nothing (MC32 p. 12)", () => {
    let log = atScenario4(false);
    expect(startGameFromLog(DEF, compose(log)).nodeId).toBe("mansion-attack");
    expect(inPlayOf(gameFromComposedLog(compose(log), shuffleCaptives), "32088b")).toEqual([]);
    log = fold(compose(log), bare("mansion-attack", true, [flag("mc32.s4.victory.jubilee", "jubilee", false)]));
    expect(inPlayOf(gameFromComposedLog(compose(log), shuffleCaptives), "32088b")).toEqual([]);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 4. Expert campaign setup per scenario (MC32 pp. 10, 12, 16, 19) and the Future Past deck
// ---------------------------------------------------------------------------------------------------------------

describe("expert campaign setup instructions exist exactly where the rulebook prints them", () => {
  const SEATS = [COLOSSUS(1), SHADOWCAT(2)];
  function walk(modes: PlayModes, wins: number, seed: number): CampaignLog {
    let log = newLog(SEATS, modes, seed);
    for (const [index, node] of NODES.slice(0, wins).entries()) {
      const records =
        modes === EXPERT ? [hp(`mc32.s${index + 1}.victory.hp`, 1, 5), hp(`mc32.s${index + 1}.victory.hp`, 2, 6)] : [];
      log = fold(compose(log), bare(node, true, records));
    }
    return log;
  }

  it("scenarios 2-5 set each seat's hit points and offer the acceleration-token heal; scenario 1 has neither", () => {
    expect(ids(compose(walk(EXPERT, 0, 91)))).not.toEqual(expect.arrayContaining(["mc32.s1.setup.hp-set"]));
    expect(ids(compose(walk(EXPERT, 0, 91))).filter((id) => /hp-set|heal/.test(id))).toEqual([]);
    for (const wins of [1, 2, 3, 4]) {
      const composed = compose(walk(EXPERT, wins, 91));
      const n = wins + 1;
      expect(ids(composed), `scenario ${n}`).toEqual(
        expect.arrayContaining([`mc32.s${n}.setup.hp-set`, `mc32.s${n}.setup.heal`]),
      );
    }
  }, 120_000);

  it("a standard campaign has no hit-point instruction at any scenario", () => {
    for (const wins of [0, 1, 2, 3, 4]) {
      const composed = compose(walk(STANDARD, wins, 92));
      expect(
        ids(composed).filter((id) => /hp-set|heal|\.hp$/.test(id)),
        `scenario ${wins + 1}`,
      ).toEqual([]);
    }
  }, 120_000);

  it("each Future Past card recorded in the log is shuffled into the next encounter deck and is not in the Future Past deck (MC32 p. 10)", () => {
    const futurePast = WAVE6_CARDS.filter(
      (card) => "encounterSetIds" in card && card.encounterSetIds.includes("future_past" as never),
    ).map((card) => card.id as string);
    const recorded = [...new Set(futurePast)].slice(0, 2);
    expect(recorded).toHaveLength(2);
    const log = fold(
      compose(newLog(SEATS, STANDARD, 93)),
      bare("sabretooth", true, [list("mc32.s1.victory.future-past-display", "futurePast", recorded)]),
    );
    expect(log.shared.futurePast).toEqual({ kind: "cardList", cardIds: recorded });
    const game = gameFromComposedLog(compose(log));
    const deckIds = Object.values(game.encounterDecks).flatMap((deck) => [...deck.deck, ...deck.discard]);
    const futureDeck = game.scenarioDecks["Future Past"]?.deck ?? [];
    for (const code of recorded) {
      const copies = anywhere(game, code);
      expect(copies.length, `${code} has an instance`).toBeGreaterThan(0);
      expect(
        copies.filter((id) => deckIds.includes(id)),
        `${code} is in the encounter deck`,
      ).toHaveLength(1);
      expect(
        copies.filter((id) => futureDeck.includes(id)),
        `${code} is not in the Future Past deck`,
      ).toEqual([]);
    }
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 5. Where campaign setup falls in the setup order (RRG 1.8 p. 51, steps 12-14)
// ---------------------------------------------------------------------------------------------------------------

describe("campaign setup is step 13 of setup (RRG 1.8 p. 51; MC32 p. 4 'follow that scenario's setup instructions')", () => {
  it("Sabretooth's own setup (Robert Kelly into play) comes first, then the campaign instructions (Frightened Police revealed), then the opening hands are drawn", () => {
    const composed = compose(newLog([COLOSSUS(1)], STANDARD, 95), { 1: "brawler" });
    const start = startGameFromLog(DEF, composed);
    const config = wave6Scenario(start.scenarioId!, {
      players: start.input.seats.map((seat) => ({
        identityCardId: seat.identityCardId,
        deck: seat.deck,
        aspects: seat.aspects,
      })),
      seed: start.input.seed,
      modes: composed.modes,
    });
    const created = createGame(
      {
        ...config,
        encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE6_CARDS, start.encounterSets.deck, [])],
        setAside: [...(config.setAside ?? []), ...cardsOfComposedSets(WAVE6_CARDS, start.encounterSets.setAside, [])],
        campaign: start.input,
      },
      WAVE6_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const at = (match: (event: GameEvent) => boolean) => created.events.findIndex(match);
    const kellyInPlay = at((e) => e.type === "cardMoved" && (e.cardId as string) === "32066");
    const firstInstruction = at((e) => e.type === "campaignInstructionResolved");
    const policeRevealed = at((e) => e.type === "encounterCardRevealed" && (e.cardId as string) === "32171a");
    const firstDraw = at((e) => e.type === "cardDrawn");
    for (const [label, index] of Object.entries({ kellyInPlay, firstInstruction, policeRevealed, firstDraw })) {
      expect(index, label).toBeGreaterThanOrEqual(0);
    }
    expect(kellyInPlay).toBeLessThan(firstInstruction);
    expect(firstInstruction).toBeLessThan(policeRevealed);
    expect(policeRevealed).toBeLessThan(firstDraw);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------------------------
// 6. Victory records derived from real game states and events (MC32 pp. 7, 10, 12), and the upgrade gates
// ---------------------------------------------------------------------------------------------------------------

describe("Victory records read off a real game, not supplied", () => {
  const winOf = (state: GameState): GameState => ({
    ...state,
    players: state.players.map((player) => ({ ...player, eliminated: false })),
    outcome: { result: "win", reason: "villainDefeated" },
  });
  const recordOf = (result: CampaignGameResult, fieldId: string) =>
    result.records.find((entry) => entry.write.field === fieldId)?.write.value;

  it("Frightened Police defeated by a real thwart is recorded (MC32 p. 7: 'If ... was defeated, record it')", () => {
    const composed = compose(logBefore(0));
    const game = settled(run(gameFromComposedLog(composed), toHero(P1)));
    const [police] = anywhere(game, "32171a").filter((id) => cardsInPlay(game).includes(id));
    expect(police, "Frightened Police is in play at setup").toBeDefined();
    const hero = identityOf(game, P1);
    const thwarted = applyCommand(
      patchInstance(game, police!, { threat: 1 }),
      { type: "basicThwart", playerId: P1, thwarterInstanceId: hero, schemeInstanceId: police! },
      WAVE6_DEPS,
    );
    if (!thwarted.ok) throw new Error(thwarted.error.message);
    const after = settled(thwarted.state);
    const real = campaignResultOf(DEF, composed, winOf(after), thwarted.events, WAVE6_DEPS);
    expect(recordOf(real, "frightenedPolice")).toEqual({ kind: "flag", value: true });
    // The control: the same game without the thwart did not defeat it.
    const control = campaignResultOf(DEF, composed, winOf(game), [], WAVE6_DEPS);
    expect(recordOf(control, "frightenedPolice")).toEqual({ kind: "flag", value: false });
  }, 60_000);

  it("a CAPTIVE ally that entered play is recorded, and only a CAPTIVE (MC32 p. 10)", () => {
    const composed = compose(logBefore(1));
    const game = settled(run(gameFromComposedLog(composed), toHero(P1)));
    const [rictor, other, pay1, pay2] = playerOf(game, P1).hand;
    const staged = patchInstance(patchInstance(game, rictor!, { cardId: "32089" as never }), other!, {
      cardId: "01009" as never,
    });
    const played = applyCommand(staged, play(P1, rictor!, [pay1!, pay2!]), WAVE6_DEPS);
    if (!played.ok) throw new Error(played.error.message);
    const real = campaignResultOf(DEF, composed, winOf(played.state), played.events, WAVE6_DEPS);
    expect(recordOf(real, "captives")).toEqual({ kind: "cardList", cardIds: ["32089"] });
    const control = campaignResultOf(DEF, composed, winOf(game), [], WAVE6_DEPS);
    expect(recordOf(control, "captives")).toEqual({ kind: "cardList", cardIds: [] });
  }, 60_000);

  it("allies tucked under Find the Prisoners at the end are recorded and then removed from the campaign (MC32 p. 12)", () => {
    const composed = compose(logBefore(2));
    expect(startGameFromLog(DEF, composed).nodeId).toBe("master-mold");
    const game = gameFromComposedLog(composed);
    const real = campaignResultOf(DEF, composed, winOf(game), [], WAVE6_DEPS);
    const held = recordOf(real, "heldAllies");
    expect(held?.kind).toBe("cardList");
    const heldIds = held?.kind === "cardList" ? (held.cardIds as readonly string[]) : [];
    // "each player searches their deck for an ally and places it facedown under the scheme" (32173a): one per seat.
    expect(heldIds).toHaveLength(2);
    for (const code of heldIds) expect(cardById(code)?.type, `${code} is an ally`).toBe("ally");
    const log = fold(composed, real);
    expect(removedIds(log)).toEqual(expect.arrayContaining([...heldIds]));
  }, 60_000);

  it("Jubilee in play at the end is recorded; a game without her records that she is not (MC32 p. 12)", () => {
    const withJubilee = fold(compose(newLog([COLOSSUS(1), SHADOWCAT(2)], STANDARD, 96)), bare("sabretooth", true));
    const second = fold(
      compose(withJubilee),
      bare("project-wideawake", true, [flag("mc32.s2.victory.jubilee", "jubilee", true)]),
    );
    const composed = compose(second);
    const inGame = campaignGame(2);
    expect(inPlayOf(inGame, "32088b")).toEqual([]); // the helper's log never recorded her
    const game = gameFromComposedLog(composed);
    expect(inPlayOf(game, "32088b")).toHaveLength(1);
    expect(recordOf(campaignResultOf(DEF, composed, winOf(game), [], WAVE6_DEPS), "jubilee")).toEqual({
      kind: "flag",
      value: true,
    });
    expect(recordOf(campaignResultOf(DEF, composed, winOf(inGame), [], WAVE6_DEPS), "jubilee")).toEqual({
      kind: "flag",
      value: false,
    });
  }, 60_000);
});

describe("role upgrades are dealt at scenarios 2-5 only if the previous campaign side scheme was defeated (MC32 pp. 10, 12, 16, 19)", () => {
  const SEATS = [COLOSSUS(1), SHADOWCAT(2)];
  const GATES = [
    { node: "sabretooth", record: flag("mc32.s1.victory.frightened-police", "frightenedPolice", false), next: 2 },
    { node: "project-wideawake", record: flag("mc32.s2.victory.enemy-of-my-enemy", "enemyOfMyEnemy", false), next: 3 },
    { node: "master-mold", record: flag("mc32.s3.victory.find-the-prisoners", "findThePrisoners", false), next: 4 },
    { node: "mansion-attack", record: flag("mc32.s4.victory.surprise-attack", "surpriseAttack", false), next: 5 },
  ] as const;

  it("a scenario won without its campaign side scheme defeated deals no upgrade at the next scenario, and one won with it does", () => {
    for (const defeated of [false, true]) {
      let log = newLog(SEATS, STANDARD, defeated ? 97 : 98);
      for (const gate of GATES) {
        const record: RecordEntry = {
          ...gate.record,
          write: { ...gate.record.write, value: { kind: "flag", value: defeated } },
        };
        log = fold(compose(log), bare(gate.node, true, [record]));
        const composed = compose(log);
        const dealt = ids(composed).includes(`mc32.s${gate.next}.setup.role-upgrade`);
        expect(dealt, `scenario ${gate.next} after defeated=${defeated}`).toBe(defeated);
        expect(roleUpgradeOf(composed, 0) !== undefined, `scenario ${gate.next} seat 1`).toBe(defeated);
      }
    }
  }, 120_000);
});

describe("expert campaign is not expert mode (RRG 1.8 p. 61 FAQ 'Campaign Mode'; MC32 p. 5)", () => {
  it("an expert campaign's first scenario starts the standard villain stage; adding expert mode starts a later one", () => {
    const villainOf = (modes: PlayModes): number => {
      const game = gameFromComposedLog(compose(newLog([COLOSSUS(1)], modes, 99), { 1: "brawler" }));
      return activeVillain(game).stageIndex;
    };
    const standard = villainOf(STANDARD);
    expect(villainOf(EXPERT), "expert campaign alone changes nothing about the villain").toBe(standard);
    expect(villainOf({ ...EXPERT, expert: true }), "expert mode is chosen per scenario").toBe(standard + 1);
  }, 60_000);
});
