/**
 * The deck editor after Fear No Evil's Campaign Setup step 8 removes a recorded title (MC60 p. 9 step 8: "must add
 * cards to their deck until they satisfy normal deck customization rules"; RRG 1.8 "Copy" p. 13, Appendix I p. 50).
 * The engine's `removeFromCampaign { byTitle }` records every printing of the title (Core Daredevil 01058 beside
 * 60039), so a deck that held the Core copy drops to 39, the editor reports it short, never offers either printing,
 * and refuses one added by hand.
 */
import { describe, expect, it } from "vitest";
import { MUT_GEN_CAMPAIGN, type AnyCard, type Deck } from "@mc/content";
import type { CampaignLog } from "@mc/engine";
import { POOL_CARDS, POOL_VERSION } from "../content/pool.js";
import {
  campaignDeckContextOf,
  campaignDeckEditModel,
  removedFromCampaignCardIds,
} from "./campaign-deck-edit-model.js";
import { addCard, browsablePool } from "./deck-builder-model.js";
import { preconDecks } from "./deck-list-model.js";

const CORE_DAREDEVIL = "01058";
const FNE_DAREDEVIL = "60039";
const codesOf = (model: ReturnType<typeof campaignDeckEditModel>): readonly string[] =>
  model.validation.ok ? [] : model.validation.problems.map((problem) => problem.code);

describe("a deck short after a title was removed from the campaign (MC60 p. 9 step 8)", () => {
  it("blocks at 39, never offers or accepts either printing, and clears with one legal added card", () => {
    const precon = preconDecks(POOL_VERSION).find((deck) => (deck.id as string).includes("spider-man-justice"));
    if (!precon) throw new Error("no spider-man justice precon");
    const identity = POOL_CARDS.find((card) => card.id === precon.identityCardId);
    if (identity?.type !== "hero_identity") throw new Error("no identity");
    const held = precon.cards.find((line) => (line.cardId as string) === CORE_DAREDEVIL);
    if (!held) throw new Error("the precon holds no Core Daredevil");
    // The deck as step 8 leaves it: every copy of the title gone.
    const cards = precon.cards.filter((line) => (line.cardId as string) !== CORE_DAREDEVIL);
    const log = {
      campaignId: "mut_gen",
      removedFromCampaign: [],
      seats: [{ seatNumber: 1, identityCardId: precon.identityCardId, deck: { ...precon, cards }, grants: [] }],
    } as unknown as CampaignLog;
    const context = {
      ...campaignDeckContextOf(MUT_GEN_CAMPAIGN, log, 1),
      removedFromCampaign: [{ cardId: FNE_DAREDEVIL }, { cardId: CORE_DAREDEVIL }] as never,
    };
    const deck: Deck = {
      id: "campaign-deck" as Deck["id"],
      name: "Spider-Man",
      identityCardId: precon.identityCardId,
      aspects: precon.aspects,
      cards,
      poolVersion: POOL_VERSION,
      source: { kind: "userBuilt", createdAt: "2026-10-20T00:00:00.000Z" },
      updatedAt: "2026-10-20T00:00:00.000Z",
    };
    const total = cards.reduce((sum, line) => sum + line.quantity, 0);
    const opened = campaignDeckEditModel(deck, POOL_CARDS, context);
    expect(total).toBeLessThan(40);
    expect(codesOf(opened)).toContain("deck_size");

    const gone = removedFromCampaignCardIds(context);
    expect(gone.has(FNE_DAREDEVIL as never) && gone.has(CORE_DAREDEVIL as never)).toBe(true);
    const offered: readonly AnyCard[] = browsablePool(POOL_CARDS, identity, deck.aspects).filter(
      (card) => !gone.has(card.id),
    );
    expect(offered.some((card) => card.name === "Daredevil" && card.type === "ally")).toBe(false);

    // Adding the Core copy anyway is refused and does not fix the size.
    const forced = campaignDeckEditModel(addCard(deck, CORE_DAREDEVIL as never), POOL_CARDS, context);
    expect(codesOf(forced)).toContain("campaign_removed_card");
    expect(forced.rows.find((row) => (row.cardId as string) === CORE_DAREDEVIL)?.refused).toBe(true);

    // Enough legal cards from the editor's own list and the seat is clear.
    const names = new Set(cards.map((line) => POOL_CARDS.find((card) => card.id === line.cardId)?.name));
    const picks = offered.filter((card) => card.type === "event" && card.aspect === "basic" && !names.has(card.name));
    let fixed = deck;
    for (const pick of picks.slice(0, 40 - total)) fixed = addCard(fixed, pick.id);
    expect(codesOf(campaignDeckEditModel(fixed, POOL_CARDS, context))).toEqual([]);
  });
});
