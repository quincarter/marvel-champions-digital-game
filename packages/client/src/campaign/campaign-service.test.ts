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
import { campaignDefinitionOf } from "@mc/cards";
import { CAMPAIGN_RECORDS, CampaignService } from "./campaign-service.js";

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

const orderOf = (state: Pick<GameState, "players" | "encounterDecks">): string =>
  JSON.stringify({
    players: state.players.map((player) => [player.hand, player.deck]),
    encounter: Object.values(state.encounterDecks).map((deck) => deck.deck),
  });

const playersOf = (state: Pick<GameState, "players">): string =>
  JSON.stringify(state.players.map((player) => [player.hand, player.deck]));

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

  test("loading a run saved with a removed card still in a deck takes it out (RRG 1.8 p. 29, MC10 p. 12)", async () => {
    const campaigns = service();
    const signed = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    const spent = signed.seats[0]!.deck.cards[0]!.cardId;
    await campaigns.storage.put({ ...signed, removedFromCampaign: [{ cardId: spent }] });

    const loaded = await campaigns.load(signed.id);

    for (const seat of loaded?.seats ?? []) expect(seat.deck.cards.map((line) => line.cardId)).not.toContain(spent);
    expect(loaded?.seats[0]?.deck.cards).toEqual(signed.seats[0]?.deck.cards.slice(1));
  });

  test("an issue composed while a removed card was still in a deck is thrown away so it composes again without it", async () => {
    const campaigns = service();
    const signed = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    const composed = await campaigns.compose(signed);
    if (composed.kind !== "done") throw new Error("composing issue #1 asked a question");
    const spent = composed.record.seats[0]!.deck.cards[0]!.cardId;
    // What a save from before the fix holds: the removal recorded, the composed issue still dealing the card.
    await campaigns.storage.put({ ...composed.record, removedFromCampaign: [{ cardId: spent }] });

    const loaded = (await campaigns.load(signed.id))!;
    expect(loaded.attempt?.input.seats[0]?.deck).toContain(spent);
    const fresh = await campaigns.discardStaleAttempt(loaded);
    expect(fresh.attempt).toBeUndefined();
    expect(fresh.seats[0]?.deck.cards.map((line) => line.cardId)).not.toContain(spent);

    const recomposed = await campaigns.compose(fresh);
    if (recomposed.kind !== "done") throw new Error("recomposing issue #1 asked a question");
    expect(recomposed.record.attempt?.input.seats[0]?.deck).not.toContain(spent);
    // A clean record is left alone.
    expect(await campaigns.discardStaleAttempt(recomposed.record)).toBe(recomposed.record);
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

  // A record with no `CampaignDefinition` yet is listed sealed, not playable (campaign-service.ts header).
  test.each(Object.keys(CAMPAIGN_RECORDS).filter((id) => campaignDefinitionOf(id)))(
    "%s: a rewound issue is dealt a fresh shuffle, not the lost attempt's decks again",
    async (campaignId) => {
      const campaigns = service();
      let record = await campaigns.start({ campaignId, seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
      const deals: { seed: number; order: string; players: string }[] = [];
      let nodeId: string | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        const answers: CampaignChoiceAnswer[] = [];
        let composed = await campaigns.compose(record, answers);
        while (composed.kind === "pending") {
          answers.push({ ...composed.choice, picked: composed.choice.options.slice(0, 1) });
          composed = await campaigns.compose(record, answers);
        }
        nodeId ??= composed.record.attempt?.nodeId;
        expect(composed.record.attempt?.nodeId).toBe(nodeId);
        const config = campaigns.launchConfig(composed.record);
        const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
        const { state } = (await core.start(config)).snapshot;
        deals.push({ seed: config.seed, order: orderOf(state), players: playersOf(state) });
        core.dispatch({ type: "concede", playerId: state.firstPlayerId });
        let folded = await campaigns.fold(composed.record, core.save());
        const lossAnswers: CampaignChoiceAnswer[] = [];
        while (folded.kind === "pending") {
          lossAnswers.push({ ...folded.choice, picked: folded.choice.options.slice(0, 1) });
          folded = await campaigns.fold(composed.record, core.save(), lossAnswers);
        }
        record = folded.record;
      }
      expect(new Set(deals.map((deal) => deal.seed)).size).toBe(3);
      expect(new Set(deals.map((deal) => deal.players)).size).toBe(3);
      // Each lost attempt keeps its own seed, which is what Rewind's "Same hands" replays.
      expect(record.history.map((entry) => entry.seed)).toEqual(deals.map((deal) => deal.seed));
      let replay = await campaigns.compose(record);
      const answers: CampaignChoiceAnswer[] = [];
      while (replay.kind === "pending") {
        answers.push({ ...replay.choice, picked: replay.choice.options.slice(0, 1) });
        replay = await campaigns.compose(record, answers);
      }
      const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
      const { state } = (await core.start({ ...campaigns.launchConfig(replay.record), seed: deals[0]!.seed })).snapshot;
      // Age of Apocalypse draws a new mission and Overseer on every attempt (owner Q22), and some missions shuffle a
      // card into the encounter deck (the Sea Wall), so only the players' decks and hands are the same shuffle there.
      if (campaignId === "aoa") expect(playersOf(state)).toBe(deals[0]!.players);
      else expect(orderOf(state)).toBe(deals[0]!.order);
    },
  );

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

  test("a reward is left out of a deck and put back through the service, and a deck saved without it marks it left out (MC45 p. 24; owner decision, 2026-10-08)", async () => {
    const campaigns = service();
    const started = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    // A stand-in reward: an optional grant of a card the seat's deck does not hold, as a won mission leaves it.
    const reward = POOL_CARDS.find(
      (card) => card.type === "upgrade" && !started.seats[0]!.deck.cards.some((line) => line.cardId === card.id),
    )!.id;
    const record = {
      ...started,
      seats: started.seats.map((seat) =>
        seat.seatNumber === 1
          ? {
              ...seat,
              deck: { ...seat.deck, cards: [...seat.deck.cards, { cardId: reward, quantity: 1 }] },
              grants: [
                {
                  cardId: reward,
                  permanence: "campaign" as const,
                  grantedAtNodeId: "crossbones",
                  deckSize: "maximumOnly" as const,
                  optional: true as const,
                },
              ],
            }
          : seat,
      ),
    };
    const holds = (candidate: Pick<typeof started, "seats">): boolean =>
      candidate.seats[0]!.deck.cards.some((line) => line.cardId === reward);

    const out = await campaigns.setSeatRewardIncluded(record, 1, reward, false);
    expect(holds(out)).toBe(false);
    expect(out.seats[0]!.grants).toMatchObject([{ cardId: reward, optional: true, leftOut: true }]);
    expect(await campaigns.load(out.id)).toEqual(out);
    const back = await campaigns.setSeatRewardIncluded(out, 1, reward, true);
    expect(holds(back)).toBe(true);
    expect(back.seats[0]!.grants[0]).not.toHaveProperty("leftOut");
    // Already in: nothing is written.
    expect(await campaigns.setSeatRewardIncluded(back, 1, reward, true)).toBe(back);

    // The deck builder saves a list without the reward's line: the log marks the reward left out to match.
    const hawkeye = ROSTER[0]!.deck;
    const saved = await campaigns.setSeatDeck(back, 1, hawkeye);
    expect(holds(saved)).toBe(false);
    expect(saved.seats[0]!.grants).toMatchObject([{ cardId: reward, leftOut: true }]);
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

  test("MC27 p. 6's optional deck freeze opt-in lives on the record, is idempotent, and persists across a reload", async () => {
    const campaigns = service();
    const started = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    expect(campaigns.isDeckFreezeOptedIn(started, 1)).toBe(false);

    const opted = await campaigns.optIntoDeckFreeze(started, 1);
    expect(campaigns.isDeckFreezeOptedIn(opted, 1)).toBe(true);
    expect(campaigns.isDeckFreezeOptedIn(opted, 2)).toBe(false);

    // Idempotent: opting in again doesn't duplicate the seat number or touch `updatedAt` again.
    const optedAgain = await campaigns.optIntoDeckFreeze(opted, 1);
    expect(optedAgain).toEqual(opted);

    // Survives a fresh load — this is what "travels with the run" means, not just an in-memory return value.
    const reloaded = await campaigns.load(opted.id);
    expect(reloaded && campaigns.isDeckFreezeOptedIn(reloaded, 1)).toBe(true);
  });

  test("a change made through #put (e.g. compose) never drops an already-recorded deck-freeze opt-in", async () => {
    const campaigns = service();
    const started = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    const opted = await campaigns.optIntoDeckFreeze(started, 1);
    const composed = await campaigns.compose(opted);
    if (composed.kind !== "done") throw new Error("issue #1 asks nothing");
    expect(campaigns.isDeckFreezeOptedIn(composed.record, 1)).toBe(true);
  });

  test("migrateLegacyDeckFreezeOptIn folds in a pre-migration seat's localStorage key once, then clears it", async () => {
    const { writeLegacyDeckFreezeOptInForTest, legacyDeckFreezeOptIn } = await import("./deck-freeze-choice.js");
    const campaigns = service();
    const started = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    writeLegacyDeckFreezeOptInForTest(started.id, 2);

    const migrated = await campaigns.migrateLegacyDeckFreezeOptIn(started);
    expect(campaigns.isDeckFreezeOptedIn(migrated, 2)).toBe(true);
    expect(legacyDeckFreezeOptIn(started.id, 2)).toBe(false);

    // A second migration on the now-clean record is a no-op that writes nothing new.
    const migratedAgain = await campaigns.migrateLegacyDeckFreezeOptIn(migrated);
    expect(migratedAgain).toEqual(migrated);
  });

  test("migrateLegacyDeckFreezeOptIn is a no-op when there is nothing to migrate", async () => {
    const campaigns = service();
    const started = await campaigns.start({ campaignId: "trors", seats: ROSTER, poolVersion: POOL_VERSION, seed: 11 });
    expect(await campaigns.migrateLegacyDeckFreezeOptIn(started)).toEqual(started);
  });
});
