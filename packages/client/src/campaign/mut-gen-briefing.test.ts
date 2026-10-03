/**
 * MC32's issue #1 briefing: the per-seat role choice (MC32 p. 5) is offered first, is recorded, and composition then
 * finishes through role-building, the loop the Briefing scene drives (`scenes/campaign/briefing.ts`).
 */
import { describe, expect, test } from "vitest";
import type { CampaignChoiceAnswer, CampaignPendingChoice } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { preconDecks } from "../view/deck-list-model.js";
import { CampaignService } from "./campaign-service.js";

const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));

const deckNamed = (id: string) => {
  const deck = preconDecks(POOL_VERSION).find((candidate) => (candidate.id as string).includes(id));
  if (!deck) throw new Error(`no precon matching ${id}`);
  return deck;
};

describe("Mutant Genesis briefing", () => {
  test("asks each seat for a role first, records both, and finishes composing", async () => {
    let clock = 1_000;
    const service = new CampaignService({
      storage: new MemoryCampaignStorage(),
      campaignDeps: { pool: POOL },
      engineDeps: POOL_DEPS,
      now: () => (clock += 1),
      newId: () => "run-1",
    });
    const seats = [deckNamed("colossus"), deckNamed("shadowcat")].map((deck) => ({
      identityCardId: deck.identityCardId,
      deck,
    }));
    const signed = await service.start({ campaignId: "mut_gen", seats, poolVersion: POOL_VERSION, seed: 5 });

    const answers: CampaignChoiceAnswer[] = [];
    const asked: CampaignPendingChoice[] = [];
    for (let step = 0; step < 20; step++) {
      const result = await service.compose(signed, answers);
      if (result.kind === "done") {
        expect(asked[0]!.slot).toBe("role");
        expect(asked[0]!.seatNumber).toBe(1);
        expect(asked[1]!.slot).toBe("role");
        expect(asked[1]!.seatNumber).toBe(2);
        // Seat 2 cannot take the role seat 1 did ("each player must choose a different role").
        expect(asked[1]!.options).not.toContain(asked[0]!.options[0]);
        expect(result.record.attempt?.nodeId).toBe("sabretooth");
        expect(result.record.seats.map((seat) => seat.fields?.["role"])).toEqual([
          { kind: "choice", option: asked[0]!.options[0] },
          { kind: "choice", option: asked[1]!.options[0] },
        ]);
        return;
      }
      asked.push(result.choice);
      const { instructionId, slot, seatNumber } = result.choice;
      // The first option for a required pick, a decline for an optional one (role-building).
      answers.push({
        instructionId,
        slot,
        seatNumber,
        picked: result.choice.optional ? [] : [result.choice.options[0]!],
      });
    }
    throw new Error("composition never finished");
  });
});
