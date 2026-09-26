import { describe, expect, test } from "vitest";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { CampaignService } from "./campaign-service.js";
import {
  seedDesignRun,
  seedDesignWonGame,
  seedGmwComposed,
  seedGmwRun,
  seedGmwWonGame,
  seedMtsWonGame,
  seedMtsComposed,
  seedMtsRun,
} from "./dev-fixtures.js";
import { frozenNonCampaignCardsOf } from "../view/campaign-deck-edit-model.js";
import { GMW_CAMPAIGN_DEFINITION } from "@mc/cards";
import type { GameState } from "@mc/engine";

/** Every real card instance in `state`, by printed name — the "is this campaign card actually in play" check every
 * test below needs, since the bug this file guards against (`campaignLaunchConfig` dropping a campaign's composed
 * encounter sets) manifests as a setup instruction finding nothing rather than throwing. Takes only `instances`
 * (`Snapshot.state` is `StateWithoutPool`, missing `cardPool`), which is all this needs to read. */
const namesInPlay = (state: Pick<GameState, "instances">): readonly string[] =>
  Object.values(state.instances)
    .map((instance) => CARDS_BY_ID.get(instance.cardId as string)?.name)
    .filter((name): name is string => name !== undefined);

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

describe("seedDesignRun", () => {
  test("after issue #2 matches the design's story: one rewind, the design's picks, issue #3 next", async () => {
    const record = await seedDesignRun(service(), "afterIssue2");
    expect(record.position.nextNodeId).toBe("taskmaster");
    expect(record.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "crossbones:won",
      "absorbing-man:lost",
      "absorbing-man:won",
    ]);
    expect(record.seats.map((seat) => seat.grants.map((grant) => grant.cardId))).toEqual([
      ["04157", "04160a"],
      ["04156", "04159a"],
    ]);
  });

  test("finished is a won run", async () => {
    const record = await seedDesignRun(service(), "finished");
    expect(record.status).toBe("won");
    expect(record.history.filter((entry) => entry.outcome === "won")).toHaveLength(5);
  }, 30_000);
});

describe("seedGmwRun", () => {
  test("afterIssue1 reaches issue 2 with units recorded and unspent", async () => {
    const record = await seedGmwRun(service(), "afterIssue1");
    expect(record.position.nextNodeId).toBe("infiltrate-the-museum");
    expect(record.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual(["brotherhood-of-badoon:won"]);
    for (const seat of record.seats) {
      const units = seat.fields.units;
      expect(units?.kind === "number" ? units.value : 0).toBeGreaterThan(0);
    }
  });

  test("afterIssue2 reaches issue 3, having taken at least one Market card along the way", async () => {
    const record = await seedGmwRun(service(), "afterIssue2");
    expect(record.position.nextNodeId).toBe("escape-the-museum");
    const marketCards = record.seats.flatMap((seat) => {
      const field = seat.fields.marketCards;
      return field?.kind === "cardList" ? field.cardIds : [];
    });
    expect(marketCards.length).toBeGreaterThan(0);
  });

  test("afterIssue2HeadhuntersDown reaches issue 3 with 2 Headhunter marks recorded", async () => {
    const record = await seedGmwRun(service(), "afterIssue2HeadhuntersDown");
    expect(record.position.nextNodeId).toBe("escape-the-museum");
    const marks = record.shared.headhunterDefeated;
    expect(marks?.kind === "number" ? marks.value : 0).toBe(2);
  });

  test("lostIssue3 reaches issue 3 lost once, with issue 3 up next again", async () => {
    const record = await seedGmwRun(service(), "lostIssue3");
    expect(record.position.nextNodeId).toBe("escape-the-museum");
    expect(record.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "brotherhood-of-badoon:won",
      "infiltrate-the-museum:won",
      "escape-the-museum:lost",
    ]);
    expect(record.status).toBe("active");
  });

  test("expertAfterIssue1 gives frozenNonCampaignCardsOf a real snapshot to read", async () => {
    const record = await seedGmwRun(service(), "expertAfterIssue1");
    expect(record.modes.campaign?.expertCampaign).toBe(true);
    const frozen = frozenNonCampaignCardsOf(GMW_CAMPAIGN_DEFINITION, record, 1);
    expect(frozen).not.toBeNull();
    expect(frozen!.length).toBeGreaterThan(0);
  });

  test("finished is a won run through all five issues", async () => {
    const record = await seedGmwRun(service(), "finished");
    expect(record.status).toBe("won");
    expect(record.history.filter((entry) => entry.outcome === "won")).toHaveLength(5);
  }, 30_000);

  test("afterIssue3 reaches issue 4 ('nebula') up next", async () => {
    const record = await seedGmwRun(service(), "afterIssue3");
    expect(record.position.nextNodeId).toBe("nebula");
  });
});

describe("seedGmwWonGame / seedDesignWonGame", () => {
  test("composes issue #4 for real and fabricates its win, without folding it", async () => {
    const { record, won } = await seedGmwWonGame(service());
    expect(record.attempt?.nodeId).toBe("nebula");
    expect(record.status).toBe("active"); // unfolded: still the pre-win status
    expect(won.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });

  test("a later stop composes whatever issue comes after it", async () => {
    const { record } = await seedGmwWonGame(service(), "afterIssue1");
    expect(record.attempt?.nodeId).toBe("infiltrate-the-museum");
  });

  test("MC10's own equivalent composes issue #3 for real (afterIssue2's own next issue)", async () => {
    const { record, won } = await seedDesignWonGame(service());
    expect(record.attempt?.nodeId).toBe("taskmaster");
    expect(won.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });
});

describe("seedMtsWonGame", () => {
  test("composes issue #1 (Ebony Maw) for real and fabricates its win, without folding it", async () => {
    const { record, won } = await seedMtsWonGame(service());
    expect(record.attempt?.nodeId).toBe("ebony-maw");
    expect(record.status).toBe("active");
    expect(won.outcome).toEqual({ result: "win", reason: "villainDefeated" });
  });
});

describe("seedMtsRun", () => {
  test("afterIssue2 plays #1 and #2 for real: two won games, the campaign pool's own four cards resolved", async () => {
    const record = await seedMtsRun(service(), "afterIssue2");
    expect(record.position.nextNodeId).toBe("thanos");
    expect(record.history.map((entry) => `${entry.nodeId}:${entry.outcome}`)).toEqual([
      "ebony-maw:won",
      "tower-defense:won",
    ]);
    expect(record.shared.cosmoInPool).toEqual({ kind: "flag", value: true });
    expect(record.shared.securityBreachInPool).toEqual({ kind: "flag", value: true });
    expect(record.shared.shawarmaInPool).toEqual({ kind: "flag", value: true });
    // Black Swan's own condition ("NOT in the victory display") is free on any fresh, unplayed victory display.
    expect(record.shared.blackSwanInPool).toEqual({ kind: "flag", value: true });
  }, 30_000);

  test("beforeFinale plays on through #3 and #4: Norn Stone and Odin both resolved", async () => {
    const record = await seedMtsRun(service(), "beforeFinale");
    expect(record.position.nextNodeId).toBe("loki");
    expect(record.shared.systemShockInPool).toEqual({ kind: "flag", value: true });
    expect(record.shared.nornStoneInPool).toEqual({ kind: "flag", value: true });
    expect(record.shared.odinInPool).toEqual({ kind: "flag", value: true });
  }, 30_000);
});

describe("seedMtsComposed", () => {
  test("composes issue #3 for real", async () => {
    const record = await seedMtsComposed(service(), "afterIssue2");
    expect(record.attempt?.nodeId).toBe("thanos");
  }, 30_000);

  test("composes the finale (issue #5) for real", async () => {
    const record = await seedMtsComposed(service(), "beforeFinale");
    expect(record.attempt?.nodeId).toBe("loki");
  }, 30_000);
});

// ---------------------------------------------------------------------------------------------------------------
// Regression coverage for the client dropping a campaign's composed encounter sets
// (`campaignLaunchConfig` never read `CampaignGameStart.encounterSets`, so `session-core.ts`'s `scenarioFor` never
// added them to `GameSetupConfig`): a client-launched campaign game must actually contain the campaign cards its
// setup instructions look for, not just a folded log that says it found them.
// ---------------------------------------------------------------------------------------------------------------

describe("a client-launched campaign game actually contains its composed encounter-set cards", () => {
  test("MTS at Hela: Find the Norn Stones is in play (MC21 p. 21's own side scheme, mc21.s4.setup.norn-stones)", async () => {
    const svc = service();
    const composed = await seedMtsComposed(svc, "afterIssue3");
    expect(composed.attempt?.nodeId).toBe("hela");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(svc.launchConfig(composed));
    expect(namesInPlay(started.snapshot.state)).toContain("Find the Norn Stones");
  }, 30_000);

  test("MTS at Loki: Odin (earned at Hela) is put into play on his King side (MC21 p. 25's mc21.s5.setup.odin)", async () => {
    const svc = service();
    const composed = await seedMtsComposed(svc, "beforeFinale");
    expect(composed.attempt?.nodeId).toBe("loki");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(svc.launchConfig(composed));
    expect(namesInPlay(started.snapshot.state)).toContain("Odin");
  }, 30_000);

  test("GMW at Brotherhood of Badoon: its Campaign Challenge side scheme (Badoon Blitz) is in play (MC16 p. 8)", async () => {
    const svc = service();
    const grown = await seedGmwRun(svc, "fresh");
    const composed = await svc.compose(grown, []);
    if (composed.kind !== "done") throw new Error("expected Brotherhood of Badoon to compose without a pending choice");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(svc.launchConfig(composed.record));
    expect(namesInPlay(started.snapshot.state)).toContain("Badoon Blitz");
  }, 30_000);

  // The four tests below extend the Brotherhood of Badoon coverage above to GMW's other four scenarios (the task
  // brief's own follow-up: "verify campaign games actually include their campaign-composed sets" for every
  // scenario, not only the first one a Priority-1 pass happened to name). `seedGmwComposed` reuses `seedGmwRun`'s
  // own win-and-advance path, then composes the next node for real (Market/heal offers answered by `gmwAutoAnswer`,
  // the same policy issue-to-issue transitions already use) without fabricating a win, so `svc.launchConfig` sees a
  // real composed record exactly as the client would build one.

  test('GMW at Infiltrate the Museum: its Campaign Challenge side scheme ("Gallery of Splendor") is in play (MC16 p. 10)', async () => {
    const svc = service();
    const grown = await seedGmwRun(svc, "afterIssue1");
    const composed = await seedGmwComposed(svc, grown);
    expect(composed.attempt?.nodeId).toBe("infiltrate-the-museum");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(svc.launchConfig(composed));
    expect(namesInPlay(started.snapshot.state)).toContain("Gallery of Splendor");
  }, 30_000);

  test('GMW at Escape the Museum: its Campaign Challenge side scheme ("There is No Escape") is in play (MC16 p. 12)', async () => {
    const svc = service();
    const grown = await seedGmwRun(svc, "afterIssue2");
    const composed = await seedGmwComposed(svc, grown);
    expect(composed.attempt?.nodeId).toBe("escape-the-museum");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(svc.launchConfig(composed));
    expect(namesInPlay(started.snapshot.state)).toContain('"There is No Escape"');
  }, 30_000);

  test('GMW at Nebula: its Campaign Challenge side scheme ("Guerrilla Tactics") and Galactic Artifacts are composed (MC16 p. 14)', async () => {
    const svc = service();
    const grown = await seedGmwRun(svc, "afterIssue3");
    const composed = await seedGmwComposed(svc, grown);
    expect(composed.attempt?.nodeId).toBe("nebula");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(svc.launchConfig(composed));
    expect(namesInPlay(started.snapshot.state)).toContain("Guerrilla Tactics");
  }, 30_000);

  test("GMW at Ronan the Accuser: the Badoon Headhunter minion (MC16 p. 18's own headhunterLadder setup) is composed into the game", async () => {
    const svc = service();
    const grown = await seedGmwRun(svc, "afterIssue4");
    const composed = await seedGmwComposed(svc, grown);
    expect(composed.attempt?.nodeId).toBe("ronan-the-accuser");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(svc.launchConfig(composed));
    // Ronan's own scenario prints no Campaign Challenge side scheme (only s1-s4 do, per `gmw.ts`'s own
    // `revealChallengeSideScheme` call sites), but it still composes the Badoon Headhunter set for its own
    // `headhunterLadder` setup instruction to shuffle into the encounter deck — the same `start.encounterSets`
    // plumbing, exercised by a different card.
    expect(namesInPlay(started.snapshot.state)).toContain("Badoon Headhunter");
  }, 30_000);
});

describe("a saved campaign game replays the same composed encounter-set cards", () => {
  test("resuming an MTS Hela save still has Find the Norn Stones in play", async () => {
    const svc = service();
    const composed = await seedMtsComposed(svc, "afterIssue3");
    const storage = new MemoryGameStorage();
    const core = new EngineSessionCore({ storage });
    await core.start(svc.launchConfig(composed));

    const saveMeta = await storage.latestActive();
    if (!saveMeta) throw new Error("expected a saved game");
    const resumedCore = new EngineSessionCore({ storage });
    const resumed = await resumedCore.resume(saveMeta.id);
    expect(namesInPlay(resumed.snapshot.state)).toContain("Find the Norn Stones");
  }, 30_000);
});
