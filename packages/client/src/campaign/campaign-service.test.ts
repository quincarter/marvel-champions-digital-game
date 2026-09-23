/**
 * The client's campaign loop against the real MC10 definition, through the same `EngineSessionCore` the app plays
 * on: sign a roster, compose issue #1, launch it, lose it (the campaign stays on #1, MC10 p. 3), then fold a win and
 * answer the TECH picks (MC10 p. 5) — proving the service's persistence rules, not the runner's (which
 * `@mc/cards`' own `trors.qa.test.ts` already covers).
 */
import { describe, expect, test } from "vitest";
import type { CampaignChoiceAnswer, GameState } from "@mc/engine";
import { preconDecks } from "../view/deck-list-model.js";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { CampaignService } from "./campaign-service.js";

const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));

function service(): CampaignService {
  let clock = 1_000;
  let ids = 0;
  return new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: POOL },
    engineDeps: POOL_DEPS,
    now: () => (clock += 1),
    newId: () => `run-${++ids}`,
  });
}

const deckNamed = (id: string) => {
  const deck = preconDecks(POOL_VERSION).find((candidate) => (candidate.id as string).includes(id));
  if (!deck) throw new Error(`no precon matching ${id}`);
  return deck;
};

const ROSTER = [deckNamed("hawkeye"), deckNamed("spider-woman")].map((deck) => ({
  identityCardId: deck.identityCardId,
  deck,
}));

describe("CampaignService", () => {
  test("signing the roster stores a fresh log on issue #1 with each seat's own deck copy", async () => {
    const campaigns = service();
    const record = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    expect(record.position.nextNodeId).toBe("crossbones");
    expect(record.name).toBe("The Rise of Red Skull");
    expect(record.box).toBe("MC10");
    expect(record.seats.map((seat) => seat.seatNumber)).toEqual([1, 2]);
    expect("id" in record.seats[0]!.deck).toBe(false);
    expect(await campaigns.load(record.id)).toEqual(record);
  });

  test("an issue composes, launches through the app's session core, and a loss leaves the campaign on it", async () => {
    const campaigns = service();
    const signed = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    const composed = await campaigns.compose(signed);
    expect(composed.kind).toBe("done");
    if (composed.kind !== "done") return;
    expect(composed.record.attempt?.nodeId).toBe("crossbones");
    expect(await campaigns.recordForGame({ campaignId: signed.campaignId, nodeId: "crossbones" })).toEqual(
      composed.record,
    );

    const config = campaigns.launchConfig(composed.record);
    expect(config.scenarioId).toBe("crossbones");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(config);
    const conceded = core.dispatch({ type: "concede", playerId: started.snapshot.state.firstPlayerId });
    expect(conceded.ok).toBe(true);

    const folded = await campaigns.fold(composed.record, core.save());
    expect(folded.kind).toBe("done");
    if (folded.kind !== "done") return;
    expect(folded.record.attempt).toBeUndefined();
    expect(folded.record.position.nextNodeId).toBe("crossbones");
    expect(folded.record.history.map((entry) => entry.outcome)).toEqual(["lost"]);
  });

  test("a win asks each seat for a TECH upgrade before anything is stored, then advances to issue #2", async () => {
    const campaigns = service();
    const signed = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    const composed = await campaigns.compose(signed);
    if (composed.kind !== "done") throw new Error("issue #1 asks nothing on standard");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(campaigns.launchConfig(composed.record));
    // The same substitution `@mc/cards`' trors.test.ts makes: a real game state, with only the verdict set to a win.
    const won: GameState = {
      ...started.snapshot.state,
      cardPool: started.cardPool,
      outcome: { result: "win", reason: "villainDefeated" },
    };

    const answers: CampaignChoiceAnswer[] = [];
    const first = await campaigns.foldState(composed.record, won, [], answers);
    expect(first.kind).toBe("pending");
    if (first.kind !== "pending") return;
    expect(first.choice.seatNumber).toBe(1);
    expect(first.choice.options).toHaveLength(4);
    // Pending results are never written.
    expect((await campaigns.load(signed.id))?.history).toHaveLength(0);

    answers.push({ ...first.choice, picked: [first.choice.options[1]!] });
    const second = await campaigns.foldState(composed.record, won, [], answers);
    if (second.kind !== "pending") throw new Error("seat 2 still has to choose");
    expect(second.choice.seatNumber).toBe(2);
    // One of each exists: seat 1's pick is gone from seat 2's list.
    expect(second.choice.options).not.toContain(first.choice.options[1]);

    answers.push({ ...second.choice, picked: [second.choice.options[0]!] });
    const done = await campaigns.foldState(composed.record, won, [], answers);
    expect(done.kind).toBe("done");
    if (done.kind !== "done") return;
    expect(done.record.position.nextNodeId).toBe("absorbing-man");
    expect(done.record.seats.map((seat) => seat.grants.length)).toEqual([1, 1]);
  });

  test("a discarded attempt restores the log it was composed from, and a deck edit keeps the identity locked", async () => {
    const campaigns = service();
    const signed = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    const composed = await campaigns.compose(signed);
    if (composed.kind !== "done") throw new Error("issue #1 asks nothing on standard");
    const discarded = await campaigns.discardAttempt(composed.record);
    expect(discarded.attempt).toBeUndefined();
    expect(discarded.rng).toEqual(signed.rng);

    const hawkeye = ROSTER[0]!.deck;
    const edited = await campaigns.setSeatDeck(discarded, 1, { ...hawkeye, aspects: ["justice"] });
    expect(edited.seats[0]!.deck.aspects).toEqual(["justice"]);
    await expect(campaigns.setSeatDeck(edited, 1, ROSTER[1]!.deck)).rejects.toThrow(/locked/);
  });

  test("an Expert Campaign run stores the modifier where the runner reads it, so expert-only instructions run", async () => {
    const campaigns = service();
    const record = await campaigns.start({
      campaignId: "trors",
      seats: ROSTER,
      expertCampaign: true,
      poolVersion: POOL_VERSION,
      seed: 11,
    });
    expect(record.modes).toEqual({ campaign: { campaignId: record.campaignId, expertCampaign: true } });
    const composed = await campaigns.compose(record);
    if (composed.kind !== "done") throw new Error("issue #1 asks nothing");
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const started = await core.start(campaigns.launchConfig(composed.record));
    const won: GameState = {
      ...started.snapshot.state,
      cardPool: started.cardPool,
      outcome: { result: "win", reason: "villainDefeated" },
    };
    const answers: CampaignChoiceAnswer[] = [];
    let folded = await campaigns.foldState(composed.record, won, [], answers);
    while (folded.kind === "pending") {
      answers.push({ ...folded.choice, picked: folded.choice.options.slice(0, 1) });
      folded = await campaigns.foldState(composed.record, won, [], answers);
    }
    // MC10 p. 5's "Expert Campaign Only: Record each identity's remaining hit points" wrote a value for each seat.
    expect(folded.record.seats.map((seat) => seat.fields.remainingHp?.kind)).toEqual(["number", "number"]);
  });

  test("a Standard run carries no expert modifier", async () => {
    const record = await service().start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    expect(record.modes).toEqual({ campaign: { campaignId: record.campaignId } });
  });
});
