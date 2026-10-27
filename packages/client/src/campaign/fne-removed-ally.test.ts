/**
 * Issue #451's path: Jessica Jones wins a Fear No Evil issue in which her Luke Cage is removed from the game, the
 * next issue's step 8 removes Luke Cage from the campaign (MC60 p. 9) and leaves her deck one card short, and the
 * player fixes the deck from the Briefing. The issue they picked must still open: the same scenario, without asking
 * again, with a legal deck.
 */
import { expect, test } from "vitest";
import type { CampaignChoiceAnswer, GameEvent, GameState } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { MemoryCampaignStorage, type CampaignRecord } from "../engine/campaign-storage.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { answersOfAttempt, deckProblemsOf } from "../view/campaign-briefing-model.js";
import { preconDecks } from "../view/deck-list-model.js";
import { CampaignService, type CampaignStepResult } from "./campaign-service.js";

const LUKE_CAGE = "61003";

const service = () =>
  new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card])) },
    engineDeps: POOL_DEPS,
  });

/** Answers every call: the given scenario, a first playthrough, otherwise the first option (or none when optional). */
async function settle(
  step: (answers: readonly CampaignChoiceAnswer[]) => Promise<CampaignStepResult>,
  scenario: string,
): Promise<CampaignRecord> {
  const answers: CampaignChoiceAnswer[] = [];
  for (let guard = 0; guard < 30; guard++) {
    const result = await step(answers);
    if (result.kind === "done") return result.record;
    const choice = result.choice;
    const picked =
      choice.slot === "node"
        ? [scenario]
        : choice.slot === "playthrough"
          ? ["First playthrough"]
          : choice.optional
            ? []
            : choice.options.slice(0, choice.count);
    answers.push({ instructionId: choice.instructionId, slot: choice.slot, seatNumber: choice.seatNumber, picked });
  }
  throw new Error("the campaign kept asking");
}

const problemsOf = (svc: CampaignService, record: CampaignRecord) => {
  const { players, campaign } = svc.launchConfig(record);
  return deckProblemsOf(record, { players: players as never, ...(campaign ? { campaign } : {}), cards: POOL_CARDS });
};

test("a deck left short by a removed ally is fixed and the picked issue opens (#451)", async () => {
  const svc = service();
  const jj = preconDecks(POOL_VERSION).find((deck) => (deck.identityCardId as string) === "61001a")!;
  const signed = await svc.start({
    campaignId: "fne",
    seats: [{ identityCardId: jj.identityCardId, deck: jj }],
    poolVersion: POOL_VERSION,
    seed: 42,
  });

  // Issue #1, won, with Luke Cage removed from the game along the way (as Bullseye's Raise the Stakes does).
  const first = await settle((answers) => svc.compose(signed, answers), "the-getaway");
  const started = await new EngineSessionCore({ storage: new MemoryGameStorage() }).start(svc.launchConfig(first));
  const state: GameState = { ...started.snapshot.state, cardPool: started.cardPool };
  const [luke] = Object.entries(state.instances).find(([, instance]) => (instance.cardId as string) === LUKE_CAGE)!;
  const removed = [
    {
      type: "cardMoved",
      instanceId: luke,
      cardId: LUKE_CAGE,
      from: { kind: "removedFromGame" },
      to: { kind: "removedFromGame" },
    },
  ] as unknown as GameEvent[];
  const won: GameState = { ...state, outcome: { result: "win", reason: "villainDefeated" } };
  const afterWin = await settle((answers) => svc.foldState(first, won, removed, answers), "the-getaway");

  // Issue #2: the step 8 removal leaves her deck one card short, so the Briefing blocks the issue.
  const second = await settle((answers) => svc.compose(afterWin, answers), "art-museum-heist");
  expect(second.removedFromCampaign.map((face) => face.cardId as string)).toContain(LUKE_CAGE);
  expect([...problemsOf(svc, second).values()]).toEqual(["Has 39 cards, needs 40-50"]);

  // Edit decks (the Briefing throws the issue away and keeps its answers), add one card, compose again.
  const kept = answersOfAttempt(second.attempt!);
  const reset = await svc.discardAttempt(second);
  const seat = reset.seats[0]!;
  const extra = POOL_CARDS.find(
    (card) => card.type === "event" && card.aspect === "basic" && !seat.deck.cards.some((l) => l.cardId === card.id),
  )!;
  const fixed = await svc.setSeatDeck(reset, seat.seatNumber, {
    ...jj,
    aspects: seat.deck.aspects,
    cards: [...seat.deck.cards, { cardId: extra.id, quantity: 1 }],
  });
  const again = await svc.compose(fixed, kept);
  expect(again.kind, "nothing is asked again").toBe("done");
  if (again.kind !== "done") return;

  expect(again.record.attempt!.nodeId).toBe("art-museum-heist");
  expect(again.record.status).toBe("active");
  expect(again.record.position.resolved).toEqual(second.position.resolved);
  expect(problemsOf(svc, again.record).size).toBe(0);
  const opened = await new EngineSessionCore({ storage: new MemoryGameStorage() }).start(
    svc.launchConfig(again.record),
  );
  expect(opened.snapshot.state.outcome ?? null).toBeNull();
});
