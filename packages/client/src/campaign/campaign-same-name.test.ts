/**
 * Same-name conflicts in a campaign (owner, 2026-10-03): the table rule and a replaced card are stored with the run
 * and reach every issue of it; the player's saved deck is never changed.
 */
import { describe, expect, test } from "vitest";
import { validateDeck } from "@mc/engine";
import type { Deck, HeroIdentityCard } from "@mc/content";
import { CARDS_BY_ID, POOL_CARDS, POOL_DEPS, POOL_VERSION } from "../content/pool.js";
import { MemoryCampaignStorage } from "../engine/campaign-storage.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { preconDecks } from "../view/deck-list-model.js";
import { applyDeckSwaps, nameConflictsOf } from "../view/name-conflicts.js";
import { replacementCandidatesOf } from "../view/replacement-candidates.js";
import { CampaignService } from "./campaign-service.js";

const POOL = Object.fromEntries(POOL_CARDS.map((card) => [card.id as string, card]));
const ON = { sameNameHeroAllyConflict: true } as const;

const service = (): CampaignService => {
  let clock = 1_000;
  return new CampaignService({
    storage: new MemoryCampaignStorage(),
    campaignDeps: { pool: POOL },
    engineDeps: POOL_DEPS,
    now: () => (clock += 1),
    newId: () => "run-1",
  });
};
const precon = (id: string): Deck => preconDecks(POOL_VERSION).find((d) => (d.id as string) === `precon:${id}`)!;
const seat = (deck: Deck) => ({ identityCardId: deck.identityCardId, deck });

describe("a campaign signed with a same-name conflict", () => {
  const valkyrie = precon("valkyrie-aggression");
  const thor = precon("thor-aggression");
  const conflicts = nameConflictsOf([{ deck: valkyrie }, { deck: thor }], CARDS_BY_ID, ON);
  const hero = (deck: Deck) => CARDS_BY_ID.get(deck.identityCardId as string) as HeroIdentityCard;
  const valkyrieAlly = conflicts.find((c) => c.seat === 2)!;
  const replacement = replacementCandidatesOf({
    deck: thor,
    fromCardId: valkyrieAlly.cardId,
    seatedHeroes: [hero(valkyrie), hero(thor)],
    identity: hero(thor),
    pool: POOL_CARDS,
    tableRules: ON,
  })[0]!.card;
  const swaps = [{ deckId: thor.id as string, from: valkyrieAlly.cardId, to: replacement.id as string }];

  test("the run stores the swapped deck and the table rules, and leaves the saved deck as it was", async () => {
    const saved = JSON.stringify(thor);
    const swapped = applyDeckSwaps(thor, swaps);
    expect(validateDeck(swapped, POOL_CARDS).ok).toBe(true);
    const campaigns = service();
    const record = await campaigns.start({
      campaignId: "trors",
      seats: [seat(valkyrie), seat(swapped)],
      poolVersion: POOL_VERSION,
      seed: 5,
      tableRules: ON,
    });
    const stored = record.seats[1]!.deck.cards.map((line) => line.cardId as string);
    expect(stored).not.toContain(valkyrieAlly.cardId);
    expect(stored).toContain(replacement.id as string);
    expect(record.tableRules).toEqual(ON);
    expect(JSON.stringify(thor)).toBe(saved);
    expect((await campaigns.load(record.id))?.tableRules).toEqual(ON);
  });

  test("every issue launches with the table rules, and the engine honors them", async () => {
    const campaigns = service();
    const record = await campaigns.start({
      campaignId: "trors",
      seats: [seat(valkyrie), seat(applyDeckSwaps(thor, swaps))],
      poolVersion: POOL_VERSION,
      seed: 5,
      tableRules: ON,
    });
    const composed = await campaigns.compose(record);
    if (composed.kind !== "done") throw new Error("composing issue #1 asked a question");
    const config = campaigns.launchConfig(composed.record);
    expect(config.tableRules).toEqual(ON);
    const started = await new EngineSessionCore({ storage: new MemoryGameStorage() }).start(config);
    expect(started.snapshot.state.tableRules).toEqual(ON);
  });

  test("a run signed without the option launches as it always did", async () => {
    const campaigns = service();
    const record = await campaigns.start({
      campaignId: "trors",
      seats: [seat(valkyrie), seat(thor)],
      poolVersion: POOL_VERSION,
      seed: 5,
    });
    expect("tableRules" in record).toBe(false);
    const composed = await campaigns.compose(record);
    if (composed.kind !== "done") throw new Error("composing issue #1 asked a question");
    expect("tableRules" in campaigns.launchConfig(composed.record)).toBe(false);
  });
});
