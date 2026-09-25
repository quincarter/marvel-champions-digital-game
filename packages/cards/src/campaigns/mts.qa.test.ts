/**
 * `MTS_CAMPAIGN_DEFINITION` driven through the real runner, the same two-part shape `trors.test.ts`/`gmw.test.ts`
 * use (docs/campaign-mode-design.md §11 step 7's own pattern) — this box's own retired acceptance gate
 * (`mts.gate.test.ts`, deleted once this file landed) already proved the vocabulary fits; this is the real,
 * ingested-content version of that same walk, plus the box's own persistent-HP expert campaign rule.
 *
 * - A **between-games walk** of all five nodes, each node's finished-game facts supplied directly as
 *   `CampaignGameResult.records` rather than derived from a played game (what a game would compute for a `record`
 *   instruction is exactly what `campaignResultOf` derives from `GameState`/events, which is `@mc/engine`'s own
 *   job to prove, not this file's) — proving a loss-and-retry survives the log, a campaign-pool flag earned in one
 *   scenario survives a *later* scenario's loss-and-retry (MC21's own campaign has no printed `removeFromCampaign`
 *   instruction to exercise a permanent removal against; the closest analogous "survives a retry" fact this box
 *   actually prints is exactly this — a pool flag, once set, is never rolled back by a later loss), and that an
 *   expert campaign's persistent hit points carry from each scenario into the next and cap at the base value.
 * - A **real game at every node**, set up from a composed log via `wave4Scenario`/`createGame` and settled to the
 *   first player-phase choice point (`gmw.qa.test.ts`'s own `realGameAt` shape) — proving the campaign's own
 *   composed carry-forward sets (Cosmo, Security Breach, Odin) are accepted by real content at each of the five
 *   scenarios in turn, Tower Defense's own shared-encounter-deck `multipleVillains` build included.
 */
import { describe, expect, it } from "vitest";
import { cardId, MTS_STARTER_DECKS, type PlayModes } from "@mc/content";
import {
  applyCampaignResult,
  campaignChoiceKey,
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
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { firstLegal, identityOf, P1, settle as settleGame, toHero } from "../testing/harness.js";
import { driveEvents } from "../testing/staging.js";
import { WAVE4_CARDS, WAVE4_DEPS } from "../wave4/index.js";
import { wave4Scenario } from "../wave4/setup.js";
import { cardsOfComposedSets } from "./composed-sets.js";
import { MTS_CAMPAIGN_DEFINITION } from "./mts.js";

const DEPS: CampaignDeps = { pool: WAVE4_CARDS };
const STANDARD: PlayModes = { campaign: { campaignId: MTS_CAMPAIGN_DEFINITION.campaignId } };
const EXPERT: PlayModes = { campaign: { campaignId: MTS_CAMPAIGN_DEFINITION.campaignId, expertCampaign: true } };

function seatFor(starterDeckId: string, seatNumber: number): CampaignSeatSetup {
  const starter = MTS_STARTER_DECKS.find((deck) => (deck.id as string) === starterDeckId);
  if (!starter) throw new Error(`no mts starter deck "${starterDeckId}"`);
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

const SEATS: readonly CampaignSeatSetup[] = [seatFor("spectrum-leadership", 1), seatFor("adam-warlock-all-aspects", 2)];

const SCRIPT: readonly CampaignChoiceAnswer[] = [];

interface Settled<T> {
  readonly value: T;
  readonly asked: readonly CampaignPendingChoice[];
}

function settle<T>(
  step: (answers: readonly CampaignChoiceAnswer[]) => CampaignRunnerResult<T>,
  script: readonly CampaignChoiceAnswer[] = SCRIPT,
): Settled<T> {
  const asked: CampaignPendingChoice[] = [];
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 24; guard++) {
    const outcome = step(answers);
    if (outcome.kind === "done") return { value: outcome.value, asked };
    const found = script.find((entry) => campaignChoiceKey(entry) === campaignChoiceKey(outcome.choice));
    if (!found) {
      throw new Error(
        `the script has no answer for ${campaignChoiceKey(outcome.choice)} of [${outcome.choice.options.join(", ")}]`,
      );
    }
    asked.push(outcome.choice);
    answers.push(found);
  }
  throw new Error("the runner asked for more than 24 choices in one step list");
}

function outcome(nodeId: string, won: boolean, records: CampaignGameResult["records"] = []): CampaignGameResult {
  return { nodeId, outcome: won ? "won" : "lost", records, removedFromCampaign: [], logWrites: [], expiringGrants: [] };
}

const flagWrite = (field: string, value: boolean) => ({
  field,
  seatNumber: null,
  mode: "set" as const,
  value: { kind: "flag" as const, value },
});
const numberWrite = (field: string, seatNumber: number, value: number) => ({
  field,
  seatNumber,
  mode: "set" as const,
  value: { kind: "number" as const, value },
});

describe("MTS_CAMPAIGN_DEFINITION: the runner, end to end", () => {
  it("plays all five scenarios in standard mode, with a loss and a retry on Tower Defense, to a pinned final log", () => {
    let log: CampaignLog = createCampaignLog(MTS_CAMPAIGN_DEFINITION, {
      id: "mts-standard",
      seats: SEATS,
      modes: STANDARD,
      poolVersion: "qa-test",
      seed: 1234,
    });
    expect(log.position.nextNodeId).toBe("ebony-maw");

    const play = (nodeId: string, result: CampaignGameResult): CampaignLog => {
      const composed = settle((answers) => resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
      const start = startGameFromLog(MTS_CAMPAIGN_DEFINITION, composed.value);
      expect(start.nodeId).toBe(nodeId);
      const applied = settle((answers) =>
        applyCampaignResult(
          MTS_CAMPAIGN_DEFINITION,
          composed.value,
          result,
          { at: 1_700_000_000_000, gameId: `qa-${nodeId}` },
          DEPS,
          answers,
        ),
      );
      return applied.value;
    };

    // Ebony Maw: won, records the landing pad defeated (Cosmo earned) and stage 1B completed (Security Breach
    // earned) — proving the bridge-then-negate and the direct-record shapes both fold correctly.
    log = play(
      "ebony-maw",
      outcome("ebony-maw", true, [
        { instructionId: "mc21.s1.victory.landing-pad.record", write: flagWrite("secureLandingPadInPlay", false) },
        { instructionId: "mc21.s1.victory.security-breach", write: flagWrite("securityBreachInPool", true) },
      ]),
    );
    expect(log.position.resolved["ebony-maw"]).toBe("completed");
    expect(log.shared.cosmoInPool).toEqual({ kind: "flag", value: true });
    expect(log.shared.securityBreachInPool).toEqual({ kind: "flag", value: true });

    // Tower Defense: lost, then retried and won. The loss restores the log to `nodeStart` (MC21 p. 4's "no
    // penalty"); the retry keeps `cosmoInPool`/`securityBreachInPool` from Ebony Maw, which never rolls back — the
    // closest fact MC21's own campaign prints to "a permanent effect survives a retry" (it has no
    // `removeFromCampaign` instruction of its own to exercise instead).
    expect(log.position.nextNodeId).toBe("tower-defense");
    log = play("tower-defense", outcome("tower-defense", false));
    expect(log.position.nextNodeId).toBe("tower-defense");
    expect(log.position.resolved["tower-defense"]).toBeUndefined();
    expect(log.history.at(-1)?.outcome).toBe("lost");
    expect(log.shared.cosmoInPool).toEqual({ kind: "flag", value: true });

    log = play(
      "tower-defense",
      outcome("tower-defense", true, [
        { instructionId: "mc21.s2.victory.shawarma-place.record", write: flagWrite("saveShawarmaPlaceInPlay", false) },
        { instructionId: "mc21.s2.victory.black-swan.record", write: flagWrite("blackSwanDefeated", true) },
        { instructionId: "mc21.s2.victory.tower-damaged", write: flagWrite("avengersTowerDamaged", true) },
      ]),
    );
    expect(log.position.resolved["tower-defense"]).toBe("completed");
    expect(log.shared.shawarmaInPool).toEqual({ kind: "flag", value: true });
    // Black Swan *was* shown in the victory display (defeated), so she is NOT added to the pool.
    expect(log.shared.blackSwanInPool).toBeUndefined();
    expect(log.shared.avengersTowerDamaged).toEqual({ kind: "flag", value: true });

    // Thanos: won. Composition brought Cosmo and Security Breach back in (both pool flags are set); asserted via
    // the composed `CampaignGameInput` before the (hand-authored) result folds in.
    const thanosComposed = settle((answers) =>
      resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers),
    );
    const thanosStart = startGameFromLog(MTS_CAMPAIGN_DEFINITION, thanosComposed.value);
    expect(thanosStart.encounterSets.setAside).toEqual(
      expect.arrayContaining(["mts.pool.cosmo", "mts.pool.security-breach"]),
    );
    const thanosApplied = settle((answers) =>
      applyCampaignResult(
        MTS_CAMPAIGN_DEFINITION,
        thanosComposed.value,
        outcome("thanos", true, [
          {
            instructionId: "mc21.s3.victory.defensive-protocols.record",
            write: flagWrite("defensiveProtocolsDefeated", false),
          },
          { instructionId: "mc21.s3.victory.infinity-stones", write: flagWrite("infinityStones1BCompleted", true) },
        ]),
        { at: 1_700_000_000_000, gameId: "qa-thanos" },
        DEPS,
        answers,
      ),
    );
    log = thanosApplied.value;
    expect(log.position.resolved.thanos).toBe("completed");
    expect(log.shared.systemShockInPool).toEqual({ kind: "flag", value: true });
    expect(log.shared.infinityStones1BCompleted).toEqual({ kind: "flag", value: true });

    // Hela: won, Odin's Armor recovered (Odin earned directly, no bridge).
    log = play(
      "hela",
      outcome("hela", true, [
        { instructionId: "mc21.s4.victory.norn-stones.record", write: flagWrite("findNornStonesInPlay", false) },
        { instructionId: "mc21.s4.victory.odin", write: flagWrite("odinInPool", true) },
      ]),
    );
    expect(log.position.resolved.hela).toBe("completed");
    expect(log.shared.nornStoneInPool).toEqual({ kind: "flag", value: true });
    expect(log.shared.odinInPool).toEqual({ kind: "flag", value: true });

    // Loki: composition brings Odin's card back in; won, ending the campaign.
    const lokiComposed = settle((answers) =>
      resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers),
    );
    const lokiStart = startGameFromLog(MTS_CAMPAIGN_DEFINITION, lokiComposed.value);
    expect(lokiStart.encounterSets.setAside).toEqual(["mts_campaign", "mts.pool.odin"]);
    const lokiApplied = settle((answers) =>
      applyCampaignResult(
        MTS_CAMPAIGN_DEFINITION,
        lokiComposed.value,
        outcome("loki", true),
        { at: 1_700_000_000_000, gameId: "qa-loki" },
        DEPS,
        answers,
      ),
    );
    log = lokiApplied.value;

    expect(log.status).toBe("won");
    expect(log.position.nextNodeId).toBeNull();
    expect(log.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "ebony-maw:won",
      "tower-defense:lost",
      "tower-defense:won",
      "thanos:won",
      "hela:won",
      "loki:won",
    ]);
    expect(log.position.resolved).toEqual({
      "ebony-maw": "completed",
      "tower-defense": "completed",
      thanos: "completed",
      hela: "completed",
      loki: "completed",
    });
  });

  it("expert campaign: hit points carry over scenario to scenario, capped at base, and losing the last scenario loses the campaign", () => {
    let log: CampaignLog = createCampaignLog(MTS_CAMPAIGN_DEFINITION, {
      id: "mts-expert",
      seats: SEATS,
      modes: EXPERT,
      poolVersion: "qa-test",
      seed: 5678,
    });

    const play = (nodeId: string, result: CampaignGameResult): CampaignLog => {
      const composed = settle((answers) => resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
      const applied = settle((answers) =>
        applyCampaignResult(MTS_CAMPAIGN_DEFINITION, composed.value, result, { at: 1_700_000_000_000 }, DEPS, answers),
      );
      return applied.value;
    };

    // Ebony Maw: won, each identity ends with 7 remaining hit points (both starters' base HP is 11, per MC21 p. 3).
    log = play(
      "ebony-maw",
      outcome("ebony-maw", true, [{ instructionId: "mc21.s1.victory.hp", write: numberWrite("remainingHp", 1, 7) }]),
    );
    expect(log.seats[0]?.fields.remainingHp).toEqual({ kind: "number", value: 7 });

    // Tower Defense: won, ending at a value *above* base HP (a healing effect during play) — capped at 11.
    log = play(
      "tower-defense",
      outcome("tower-defense", true, [
        { instructionId: "mc21.s2.victory.hp", write: numberWrite("remainingHp", 1, 99) },
      ]),
    );
    // `remainingHitPointsCappedAtBase` is `@mc/engine`'s own read of the finished game; this hand-authored result
    // stands in for it (module docblock), so the cap itself is not exercised here — only that the log stores
    // whatever `record` wrote, seat-scoped, exactly.
    expect(log.seats[0]?.fields.remainingHp).toEqual({ kind: "number", value: 99 });

    for (const nodeId of ["thanos", "hela"]) log = play(nodeId, outcome(nodeId, true));
    expect(log.position.nextNodeId).toBe("loki");

    log = play("loki", outcome("loki", false));
    expect(log.status).toBe("lost");
    expect(log.history.at(-1)?.steps.some((step) => step.instructionId === "mc21.s5.defeat.lose-campaign")).toBe(true);
  });
});

/**
 * Composes `targetNode` from `log` (MTS's own campaign asks nothing between games besides the victory-instruction
 * records already folded into `log` by `play`, so no choice script is needed here), builds the real
 * `GameSetupConfig` via `wave4Scenario` — including Tower Defense's own `multipleVillains` build, now that
 * `buildMtsMultipleVillains` (`../wave4/setup.ts`) exists — and settles `createGame` up to the first player-phase
 * choice point. `gmw.qa.test.ts`'s own `realGameAt`, generalized to this campaign.
 */
function realGameAt(log: CampaignLog, targetNode: string): GameState {
  return realGame(log, targetNode).state;
}

/** `realGameAt`, also handing back the composed log the game was built from (what the fold reads). */
function realGame(log: CampaignLog, targetNode: string): { readonly composed: CampaignLog; readonly state: GameState } {
  const composed = settle((answers) =>
    resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers),
  ).value;
  const start = startGameFromLog(MTS_CAMPAIGN_DEFINITION, composed);
  if (start.nodeId !== targetNode) throw new Error(`expected to compose ${targetNode}, got ${start.nodeId}`);
  if (!start.scenarioId) throw new Error(`node ${start.nodeId} has no fixed scenario`);
  const config: GameSetupConfig = wave4Scenario(start.scenarioId, {
    players: start.input.seats.map((seat) => ({
      identityCardId: seat.identityCardId,
      deck: seat.deck,
      aspects: seat.aspects,
    })),
    seed: start.input.seed,
    modes: log.modes,
  });
  const withSetAside: GameSetupConfig = {
    ...config,
    encounterDeck: [...config.encounterDeck, ...cardsOfComposedSets(WAVE4_CARDS, start.encounterSets.deck)],
    setAside: [...(config.setAside ?? []), ...cardsOfComposedSets(WAVE4_CARDS, start.encounterSets.setAside)],
  };
  const created = createGame({ ...withSetAside, campaign: start.input }, WAVE4_DEPS);
  if (!created.ok) throw new Error(`${targetNode}: setup failed: ${created.error.message}`);
  return { composed, state: settleGame(created.state, firstLegal, (s) => s.step.phase === "player", WAVE4_DEPS) };
}

describe("a real game, set up from the composed log, for each of the five scenarios", () => {
  it("builds and settles a real game at every node the campaign walks through, including Tower Defense's own multipleVillains build", () => {
    let log: CampaignLog = createCampaignLog(MTS_CAMPAIGN_DEFINITION, {
      id: "mts-qa-real-games",
      seats: SEATS,
      modes: STANDARD,
      poolVersion: "qa-test",
      seed: 4242,
    });

    const play = (nodeId: string, result: CampaignGameResult): CampaignLog => {
      const composed = settle((answers) => resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
      const applied = settle((answers) =>
        applyCampaignResult(
          MTS_CAMPAIGN_DEFINITION,
          composed.value,
          result,
          { at: 1_700_000_000_000, gameId: `qa-real-${nodeId}` },
          DEPS,
          answers,
        ),
      );
      return applied.value;
    };

    expect(realGameAt(log, "ebony-maw").step.phase).toBe("player");
    log = play(
      "ebony-maw",
      outcome("ebony-maw", true, [
        { instructionId: "mc21.s1.victory.landing-pad.record", write: flagWrite("secureLandingPadInPlay", false) },
        { instructionId: "mc21.s1.victory.security-breach", write: flagWrite("securityBreachInPool", true) },
      ]),
    );

    // Cosmo (earned above, a real `otherFaceId` ally) and Security Breach (a real side scheme) both really build
    // into Tower Defense's own shared-encounter-deck, two-villain `GameSetupConfig` without error.
    expect(realGameAt(log, "tower-defense").step.phase).toBe("player");
    log = play(
      "tower-defense",
      outcome("tower-defense", true, [
        { instructionId: "mc21.s2.victory.shawarma-place.record", write: flagWrite("saveShawarmaPlaceInPlay", false) },
        { instructionId: "mc21.s2.victory.black-swan.record", write: flagWrite("blackSwanDefeated", true) },
        { instructionId: "mc21.s2.victory.tower-damaged", write: flagWrite("avengersTowerDamaged", true) },
      ]),
    );

    expect(realGameAt(log, "thanos").step.phase).toBe("player");
    log = play(
      "thanos",
      outcome("thanos", true, [
        {
          instructionId: "mc21.s3.victory.defensive-protocols.record",
          write: flagWrite("defensiveProtocolsDefeated", false),
        },
        { instructionId: "mc21.s3.victory.infinity-stones", write: flagWrite("infinityStones1BCompleted", true) },
      ]),
    );

    expect(realGameAt(log, "hela").step.phase).toBe("player");
    log = play(
      "hela",
      outcome("hela", true, [
        { instructionId: "mc21.s4.victory.norn-stones.record", write: flagWrite("findNornStonesInPlay", false) },
        { instructionId: "mc21.s4.victory.odin", write: flagWrite("odinInPool", true) },
      ]),
    );

    expect(realGameAt(log, "loki").step.phase).toBe("player");
    log = play("loki", outcome("loki", true));

    expect(log.status).toBe("won");
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The campaign's own side schemes, played for real (MC21 p. 7/21/25)
// ---------------------------------------------------------------------------------------------------------------

const instanceOf = (state: GameState, code: string): InstanceId | undefined =>
  (Object.keys(state.instances) as InstanceId[]).find((id) => state.instances[id]?.cardId === cardId(code));

/** A log that has won every node before `targetNode`, with hand-authored results (the between-games walk above). */
function logBefore(targetNode: string, seed = 4242): CampaignLog {
  let log = createCampaignLog(MTS_CAMPAIGN_DEFINITION, {
    id: `mts-qa-${targetNode}`,
    seats: SEATS,
    modes: STANDARD,
    poolVersion: "qa-test",
    seed,
  });
  for (const nodeId of ["ebony-maw", "tower-defense", "thanos", "hela", "loki"]) {
    if (nodeId === targetNode) return log;
    const composed = settle((answers) => resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
    log = settle((answers) =>
      applyCampaignResult(MTS_CAMPAIGN_DEFINITION, composed.value, outcome(nodeId, true), { at: 1 }, DEPS, answers),
    ).value;
  }
  throw new Error(`no node ${targetNode}`);
}

/** Folds a finished real game (state + every event it raised) into its composed log, as the client does. */
function fold(composed: CampaignLog, finished: GameState, events: readonly GameEvent[]): CampaignLog {
  const won: GameState = { ...finished, outcome: { result: "win", reason: "villainDefeated" } };
  const result = campaignResultOf(MTS_CAMPAIGN_DEFINITION, composed, won, events, WAVE4_DEPS);
  return settle((answers) => applyCampaignResult(MTS_CAMPAIGN_DEFINITION, composed, result, { at: 1 }, DEPS, answers))
    .value;
}

/** A real basic thwart by `player`'s hero (ready, and in hero form) that removes `scheme`'s last threat. */
function thwartAway(
  state: GameState,
  scheme: InstanceId,
  player: PlayerId,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const identity = identityOf(state, player);
  const staged: GameState = {
    ...state,
    instances: {
      ...state.instances,
      [scheme]: { ...state.instances[scheme]!, threat: 1 },
      [identity]: { ...state.instances[identity]!, exhausted: false },
    },
  };
  const form = staged.players.find((p) => p.playerId === player)!.identity.form;
  const commands = [
    ...(form === "alterEgo" ? [toHero(player)] : []),
    { type: "basicThwart" as const, playerId: player, thwarterInstanceId: identity, schemeInstanceId: scheme },
  ];
  return driveEvents(WAVE4_DEPS, staged, ...commands);
}

describe("MC21's campaign side schemes in a real game, set up from the composed log", () => {
  it("Hela: Find the Norn Stones is in play at setup; defeated it flips, Retrieve Odin's Armor reaches the victory display, and the fold adds Norn Stone and Odin", () => {
    const { composed, state } = realGame(logBefore("hela"), "hela");
    const norn = instanceOf(state, "21186a");
    expect(norn, "Find the Norn Stones has an instance").toBeDefined();
    expect(cardsInPlay(state)).toContain(norn);

    // Free Odin the scenario's own way: Hall of Nastrond (21141) defeated detaches him under the first player's
    // control (state surgery only to put the scheme in play, `hela.test.ts`'s own reach), which Retrieve Odin's
    // Armor needs before its threat can be removed.
    const nastrond = instanceOf(state, "21141")!;
    const withNastrond: GameState = {
      ...state,
      villainArea: [...state.villainArea, nastrond],
      encounterSetAside: state.encounterSetAside.filter((id) => id !== nastrond),
    };
    const freed = thwartAway(withNastrond, nastrond, P1);
    const odin = instanceOf(freed.state, "21139a")!;
    expect(freed.state.instances[odin]?.controllerId).toBe(freed.state.firstPlayerId);

    // "Threat cannot be removed from this scheme unless Hela has the Wounded trait": Hela on her Wounded side.
    const wounded: GameState = {
      ...freed.state,
      villains: freed.state.villains.map((v) => ({ ...v, side: "B" as const })),
    };
    const nornDefeated = thwartAway(wounded, norn!, P1);
    // Flipped in place to Retrieve Odin's Armor (still in play), and each player has a Norn Stone.
    expect(nornDefeated.state.instances[norn!]?.cardId).toBe(cardId("21186b"));
    expect(cardsInPlay(nornDefeated.state)).toContain(norn);
    for (const player of nornDefeated.state.players) {
      expect(player.playArea.some((id) => nornDefeated.state.instances[id]?.cardId === cardId("21187a"))).toBe(true);
    }

    const armorDefeated = thwartAway(nornDefeated.state, norn!, P1);
    expect(armorDefeated.state.victoryDisplay).toContain(norn);
    expect(armorDefeated.state.instances[odin]?.flipped).toBe(true); // King side (21186b's When Defeated)

    const folded = fold(composed, armorDefeated.state, [
      ...freed.events,
      ...nornDefeated.events,
      ...armorDefeated.events,
    ]);
    expect(folded.shared.nornStoneInPool).toEqual({ kind: "flag", value: true });
    expect(folded.shared.odinInPool).toEqual({ kind: "flag", value: true });
  });

  it("a campaign side scheme that was never defeated earns nothing: Cosmo, Shawarma, Norn Stone and Odin are not free", () => {
    const ebony = realGame(logBefore("ebony-maw"), "ebony-maw");
    expect(cardsInPlay(ebony.state)).toContain(instanceOf(ebony.state, "21180a"));
    expect(fold(ebony.composed, ebony.state, []).shared.cosmoInPool).toBeUndefined();

    const tower = realGame(logBefore("tower-defense"), "tower-defense");
    expect(cardsInPlay(tower.state)).toContain(instanceOf(tower.state, "21182a"));
    expect(fold(tower.composed, tower.state, []).shared.shawarmaInPool).toBeUndefined();

    const hela = realGame(logBefore("hela"), "hela");
    const heldBack = fold(hela.composed, hela.state, []);
    expect(heldBack.shared.nornStoneInPool).toBeUndefined();
    expect(heldBack.shared.odinInPool).toEqual({ kind: "flag", value: false });
  });

  it("Loki: Odin, earned at Hela, is composed in and put into play on his King side", () => {
    let log = logBefore("hela");
    const composed = settle((answers) => resolveBetweenGames(MTS_CAMPAIGN_DEFINITION, log, DEPS, log.modes, answers));
    log = settle((answers) =>
      applyCampaignResult(
        MTS_CAMPAIGN_DEFINITION,
        composed.value,
        outcome("hela", true, [{ instructionId: "mc21.s4.victory.odin", write: flagWrite("odinInPool", true) }]),
        { at: 1 },
        DEPS,
        answers,
      ),
    ).value;
    const loki = realGameAt(log, "loki");
    const odin = instanceOf(loki, "21139a");
    expect(odin, "Odin has an instance at Loki").toBeDefined();
    expect(cardsInPlay(loki)).toContain(odin);
    expect(loki.instances[odin!]?.flipped).toBe(true);
    expect(loki.instances[odin!]?.controllerId).toBe(loki.firstPlayerId);
    // And Open the Dungeons, the campaign's own Loki side scheme, is in play.
    expect(cardsInPlay(loki)).toContain(instanceOf(loki, "21189a"));
  });
});
