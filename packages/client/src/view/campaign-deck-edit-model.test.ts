import { describe, expect, it } from "vitest";
import {
  cardId,
  AOA_CAMPAIGN,
  AOA_STARTER_DECKS,
  SM_CAMPAIGN,
  SM_STARTER_DECKS,
  TRORS_CAMPAIGN,
  TRORS_STARTER_DECKS,
  type DeckCardEntry,
  type StarterDeck,
} from "@mc/content";
import { createCampaignLog, type CampaignGrant, type CampaignLog, type CampaignSeatSetup } from "@mc/engine";
import { AOA_CAMPAIGN_DEFINITION, SM_CAMPAIGN_DEFINITION, TRORS_CAMPAIGN_DEFINITION } from "@mc/cards";
import { POOL_CARDS } from "../content/pool.js";
import {
  campaignDeckContextOf,
  campaignDeckContextWithGrants,
  campaignDeckEditModel,
  campaignDeckSizeLabel,
  campaignDeckSizeSplit,
  deckFreezePolicyOf,
  prohibitedCampaignCardIds,
  reconcileRewards,
  removedFromCampaignCardIds,
  seatDeckSizeSplit,
  setRewardIncluded,
} from "./campaign-deck-edit-model.js";

function requireStarter(id: string): StarterDeck {
  const found = TRORS_STARTER_DECKS.find((deck) => (deck.id as string) === id);
  if (!found) throw new Error(`no trors starter deck "${id}"`);
  return found;
}

const STARTER = requireStarter("hawkeye-leadership");
const TECH_UPGRADE = cardId("04155");

function seatFor(starter: StarterDeck, seatNumber: number): CampaignSeatSetup {
  return {
    seatNumber,
    identityCardId: starter.identityCardId,
    deck: { identityCardId: starter.identityCardId, aspects: starter.aspects, cards: starter.cards },
  };
}

function freshLog(): CampaignLog {
  return createCampaignLog(TRORS_CAMPAIGN_DEFINITION, {
    id: "deck-model-test",
    seats: [seatFor(STARTER, 1)],
    modes: { campaign: { campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId } },
    poolVersion: "deck-model-test",
    seed: 1,
  });
}

/** A log whose seat 1 was granted the first TECH upgrade, as `mc10.s1.victory.tech` would leave it. */
function grantedLog(): CampaignLog {
  const log = freshLog();
  return {
    ...log,
    seats: log.seats.map((seat) =>
      seat.seatNumber === 1
        ? {
            ...seat,
            grants: [{ cardId: TECH_UPGRADE, permanence: "campaign" as const, grantedAtNodeId: "crossbones" }],
          }
        : seat,
    ),
  };
}

describe("campaignDeckContextOf: Age of Apocalypse's deck-size rules (MC45 p. 24; owner decisions, 2026-10-08)", () => {
  const bishop = AOA_STARTER_DECKS[0]!;
  const logWith = (grants: readonly CampaignGrant[]): CampaignLog => {
    const log = createCampaignLog(AOA_CAMPAIGN_DEFINITION, {
      id: "aoa-deck-model-test",
      seats: [seatFor(bishop as unknown as StarterDeck, 1)],
      modes: { campaign: { campaignId: AOA_CAMPAIGN_DEFINITION.campaignId } },
      poolVersion: "deck-model-test",
      seed: 1,
    });
    return { ...log, seats: log.seats.map((seat) => ({ ...seat, grants })) };
  };

  it("names the box's campaign sets and passes a reward's rule, and that it may be left out, to validateDeck", () => {
    const grants: CampaignGrant[] = [
      {
        cardId: cardId("45174"),
        permanence: "campaign",
        grantedAtNodeId: "unus",
        deckSize: "maximumOnly",
        optional: true,
      },
      { cardId: cardId("45175"), permanence: "campaign", grantedAtNodeId: "unus" },
    ];
    const context = campaignDeckContextOf(AOA_CAMPAIGN, logWith(grants), 1);
    expect(context.campaignSetIds).toEqual(expect.arrayContaining([...AOA_CAMPAIGN.campaignSetIds]));
    expect(context.grantedCardIds).toEqual([cardId("45174"), cardId("45175")]);
    expect(context.grantDeckSizes).toEqual([{ cardId: cardId("45174"), deckSize: "maximumOnly" }]);
    expect(context.optionalGrantCardIds).toEqual([cardId("45174")]);
  });

  it("a reward left out of the deck is no granted copy of it: not in the ids, the size rules or the optional list", () => {
    const grants: CampaignGrant[] = [
      {
        cardId: cardId("45174"),
        permanence: "campaign",
        grantedAtNodeId: "unus",
        deckSize: "maximumOnly",
        optional: true,
        leftOut: true,
      },
    ];
    const context = campaignDeckContextOf(AOA_CAMPAIGN, logWith(grants), 1);
    expect(context.grantedCardIds).toEqual([]);
    expect(context.grantDeckSizes).toBeUndefined();
    expect(context.optionalGrantCardIds).toBeUndefined();
  });

  it("carries no deck-size rules when no grant has one (every earlier box)", () => {
    const context = campaignDeckContextOf(
      AOA_CAMPAIGN,
      logWith([{ cardId: cardId("45175"), permanence: "campaign", grantedAtNodeId: "unus" }]),
      1,
    );
    expect(context.grantDeckSizes).toBeUndefined();
  });
});

describe("an Age of Apocalypse reward in the deck editor (MC45 p. 24; owner decisions, 2026-10-08, rows 63, 67 and 68)", () => {
  const bishop = AOA_STARTER_DECKS[0]!;
  const BLINK = cardId("45173");
  const reward = (id: string, leftOut = false): CampaignGrant => ({
    cardId: cardId(id),
    permanence: "campaign",
    grantedAtNodeId: "unus",
    deckSize: "maximumOnly",
    optional: true,
    ...(leftOut ? { leftOut: true as const } : {}),
  });
  const base = { identityCardId: bishop.identityCardId, aspects: bishop.aspects, cards: [...bishop.cards] };
  const sizeOf = (deck: { readonly cards: readonly DeckCardEntry[] }): number =>
    deck.cards.reduce((n, line) => n + line.quantity, 0);
  const logOf = (deck: typeof base, grants: readonly CampaignGrant[]): CampaignLog => {
    const log = createCampaignLog(AOA_CAMPAIGN_DEFINITION, {
      id: "aoa-reward-test",
      seats: [seatFor(bishop as unknown as StarterDeck, 1)],
      modes: { campaign: { campaignId: AOA_CAMPAIGN_DEFINITION.campaignId } },
      poolVersion: "deck-model-test",
      seed: 1,
    });
    return { ...log, seats: log.seats.map((seat) => ({ ...seat, deck, grants })) };
  };
  const modelOf = (deck: typeof base, grants: readonly CampaignGrant[]) =>
    campaignDeckEditModel(deck, POOL_CARDS, campaignDeckContextOf(AOA_CAMPAIGN, logOf(deck, grants), 1), grants);
  const messagesOf = (model: ReturnType<typeof modelOf>): readonly string[] =>
    model.validation.ok ? [] : model.validation.problems.map((problem) => problem.message);
  /** A non-unique line of the starter with a deck limit of 3 that is not of the identity set. */
  const title = bishop.cards
    .map((line) => ({ line, card: POOL_CARDS.find((card) => card.id === line.cardId)! }))
    .find(
      ({ card }) =>
        "deckLimit" in card &&
        card.deckLimit === 3 &&
        !card.unique &&
        "aspect" in card &&
        card.aspect !== undefined &&
        (bishop.aspects as readonly string[]).includes(card.aspect),
    )!;
  const withTitle = (quantity: number): typeof base => ({
    ...base,
    cards: base.cards.map((line) => (line.cardId === title.line.cardId ? { ...line, quantity } : line)),
  });

  it("the fixture: Bishop's starter is 40 cards and holds a three-copy title of its aspect", () => {
    expect(sizeOf(base)).toBe(40);
    expect(title).toBeDefined();
  });

  it("the reward's line is not locked: it carries its own note, counts apart, and is listed with a way to leave it out", () => {
    const deck = { ...base, cards: [...base.cards, { cardId: BLINK, quantity: 1 }] };
    const model = modelOf(deck, [reward("45173")]);
    expect(model.validation.ok).toBe(true);
    const row = model.rows.find((candidate) => candidate.cardId === BLINK)!;
    expect(row).toMatchObject({
      locked: false,
      lockedReason: null,
      rewardCopies: 1,
      rewardNote: "Campaign reward. Not one of your 40 cards; one of your 50.",
    });
    expect(model.rewards).toEqual([
      { cardId: BLINK, included: true, status: "In your deck", toggleLabel: "Leave out" },
    ]);
    const split = campaignDeckSizeSplit(model);
    expect(split).toEqual({ counted: 40, pinned: 0, rewards: 1 });
    expect(campaignDeckSizeLabel(split)).toBe("40 cards + 1 reward");
    expect(campaignDeckSizeLabel({ counted: 40, pinned: 2, rewards: 2 })).toBe("40 cards + 2 pinned + 2 rewards");
    expect(campaignDeckSizeLabel({ counted: 40, pinned: 0, rewards: 0 })).toBe("40 cards");
  });

  it("leaving the reward out takes the copy off the list and keeps the grant; adding it puts the same deck back", () => {
    const deck = { ...base, cards: [...base.cards, { cardId: BLINK, quantity: 1 }] };
    const grants = [reward("45173")];
    const out = setRewardIncluded(deck, grants, BLINK, false);
    expect(out.deck.cards.some((line) => line.cardId === BLINK)).toBe(false);
    expect(out.grants).toEqual([reward("45173", true)]);
    const model = modelOf(out.deck as typeof base, out.grants);
    expect(model.validation.ok).toBe(true);
    expect(model.rewards).toEqual([
      { cardId: BLINK, included: false, status: "Left out of your deck", toggleLabel: "Add to deck" },
    ]);
    expect(campaignDeckSizeSplit(model)).toEqual({ counted: 40, pinned: 0, rewards: 0 });
    const back = setRewardIncluded(out.deck, out.grants, BLINK, true);
    expect(back).toEqual({ deck, grants });
    // Asking for the state it is already in changes nothing, and neither does a card that is no reward.
    expect(setRewardIncluded(deck, grants, BLINK, true)).toEqual({ deck, grants });
    expect(setRewardIncluded(deck, grants, title.line.cardId, false)).toEqual({ deck, grants });
  });

  it("the context follows the grants when a reward is flipped, so the editor can rebuild it without reloading the run", () => {
    const deck = { ...base, cards: [...base.cards, { cardId: BLINK, quantity: 1 }] };
    const inGrants = [reward("45173")];
    const outGrants = [reward("45173", true)];
    const context = campaignDeckContextOf(AOA_CAMPAIGN, logOf(deck, inGrants), 1);
    expect(context.grantedCardIds).toEqual([BLINK]);
    const out = campaignDeckContextWithGrants(context, outGrants);
    expect(out).toEqual(campaignDeckContextOf(AOA_CAMPAIGN, logOf(deck, outGrants), 1));
    expect(out.grantedCardIds).toEqual([]);
    expect(out.optionalGrantCardIds).toBeUndefined();
    expect(out.grantDeckSizes).toBeUndefined();
    expect(campaignDeckContextWithGrants(out, inGrants)).toEqual(context);
  });

  it("a deck needs 40 cards besides the reward: 39 and the reward is one short, and 50 and the reward is one over", () => {
    const short = {
      ...withTitle(title.line.quantity - 1),
      cards: [
        ...withTitle(title.line.quantity - 1).cards.filter((line) => line.quantity > 0),
        { cardId: BLINK, quantity: 1 },
      ],
    };
    expect(sizeOf(short)).toBe(40);
    expect(messagesOf(modelOf(short, [reward("45173")]))).toEqual([
      "The deck has 39 cards besides 1 campaign card that does not count against the minimum; a deck must have at least 40 (the identity and permanent cards do not count).",
    ]);
  });

  it("a reward of a title the deck holds three copies of: the problem says how to fix it, and both fixes work", () => {
    const id = title.line.cardId;
    const four = withTitle(4);
    const grants = [reward(id as string)];
    const model = modelOf(four, grants);
    expect(messagesOf(model)).toEqual([
      `${title.card.name} has 4 copies; a deck may include no more than 3 copies of a non-unique card (by title). 1 of them is a campaign reward: remove a copy of your own, or leave the reward out of the deck.`,
    ]);
    // The line can be changed by hand: it is a reward's line, not a locked one.
    expect(model.rows.find((row) => row.cardId === id)).toMatchObject({ locked: false, quantity: 4, rewardCopies: 1 });
    // Fix 1: leave the reward out. Three copies of the player's own, and the deck is legal.
    const out = setRewardIncluded(four, grants, id, false);
    expect(out.deck.cards.find((line) => line.cardId === id)?.quantity).toBe(3);
    const without = modelOf(out.deck as typeof base, out.grants);
    expect(without.validation.ok).toBe(true);
    expect(without.rows.find((row) => row.cardId === id)).toMatchObject({ rewardCopies: 0, rewardNote: null });
    // Fix 2: drop a copy of the player's own. The reward is still in the deck and the copy limit is met.
    const dropped = modelOf(withTitle(3), grants);
    expect(dropped.rows.find((row) => row.cardId === id)).toMatchObject({ quantity: 3, rewardCopies: 1 });
    expect(messagesOf(dropped).some((message) => /no more than 3 copies/.test(message))).toBe(false);
  });

  it("a deck saved without the reward's copy marks the reward left out; the player's own copies are not mistaken for it", () => {
    const id = title.line.cardId;
    const grants = [reward(id as string), reward("45173")];
    // Blink's line is gone from the list; the title still has its three own copies and the reward.
    const edited = withTitle(4);
    const reconciled = reconcileRewards(edited, grants);
    expect(reconciled).toEqual([reward(id as string), reward("45173", true)]);
    // Nothing to reconcile returns the same list.
    expect(reconcileRewards(edited, reconciled)).toBe(reconciled);
    // A must-keep grant of the same card takes its copy first.
    const pinned: CampaignGrant = { cardId: id, permanence: "campaign", grantedAtNodeId: "unus" };
    expect(reconcileRewards(withTitle(1), [pinned, reward(id as string)])).toEqual([
      pinned,
      reward(id as string, true),
    ]);
  });

  it("the Briefing's split pins a reward copy by copy, and pins nothing for a reward left out", () => {
    const id = title.line.cardId;
    expect(seatDeckSizeSplit({ deck: withTitle(4), grants: [reward(id as string)] })).toEqual({
      counted: sizeOf(withTitle(4)) - 1,
      pinned: 1,
    });
    expect(seatDeckSizeSplit({ deck: withTitle(3), grants: [reward(id as string, true)] })).toEqual({
      counted: sizeOf(withTitle(3)),
      pinned: 0,
    });
  });
});

describe("campaignDeckContextOf: MC10's real content record and definition", () => {
  it("assembles the campaign set ids, identity lock and grants from the log", () => {
    const context = campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1);
    expect(context).toMatchObject({
      campaignId: TRORS_CAMPAIGN_DEFINITION.campaignId,
      campaignSetIds: ["hydra_camp", "expcamp"],
      identityCardId: STARTER.identityCardId,
      grantedCardIds: [TECH_UPGRADE],
      removedFromCampaign: [],
    });
    expect(context.frozenNonCampaignCards).toBeUndefined();
  });

  it("carries frozenNonCampaignCards only when the caller supplies it (MC10 never does)", () => {
    const frozen: readonly DeckCardEntry[] = STARTER.cards.map((line) => ({ ...line }));
    const context = campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1, { frozenNonCampaignCards: frozen });
    expect(context.frozenNonCampaignCards).toEqual(frozen);
  });

  it("throws for a seat the log doesn't have", () => {
    expect(() => campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 9)).toThrow(/seat 9/);
  });
});

describe("campaignDeckEditModel", () => {
  it("marks a granted line locked and leaves it out of the deck-size/copy problems validateDeck would raise standalone", () => {
    const context = campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1);
    const deck = {
      identityCardId: STARTER.identityCardId,
      aspects: STARTER.aspects,
      cards: [...STARTER.cards, { cardId: TECH_UPGRADE, quantity: 1 }],
    };
    const model = campaignDeckEditModel(deck, POOL_CARDS, context);
    expect(model.validation.ok).toBe(true);
    const row = model.rows.find((candidate) => candidate.cardId === TECH_UPGRADE);
    expect(row).toMatchObject({
      locked: true,
      lockedReason: "Added by the campaign — does not count toward deck size",
    });
    const starterRow = model.rows.find((candidate) => candidate.cardId === STARTER.cards[0]?.cardId);
    expect(starterRow?.locked).toBe(false);
  });

  it("refuses the same card outside the campaign context, naming why (validateDeck's own verdict, not re-derived)", () => {
    const deck = {
      identityCardId: STARTER.identityCardId,
      aspects: STARTER.aspects,
      cards: [...STARTER.cards, { cardId: TECH_UPGRADE, quantity: 1 }],
    };
    const verdict = campaignDeckEditModel(deck, POOL_CARDS, {
      campaignId: "x",
      campaignSetIds: [],
      identityCardId: STARTER.identityCardId,
      grantedCardIds: [],
    }).validation;
    expect(verdict.ok).toBe(false);
  });

  it("marks a line removed from the campaign refused, with validateDeck's own message", () => {
    const removedCardId = STARTER.cards[0]!.cardId;
    const context = {
      ...campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1),
      removedFromCampaign: [{ cardId: removedCardId }],
    };
    const deck = { identityCardId: STARTER.identityCardId, aspects: STARTER.aspects, cards: STARTER.cards };
    const model = campaignDeckEditModel(deck, POOL_CARDS, context);
    expect(model.validation.ok).toBe(false);
    const row = model.rows.find((candidate) => candidate.cardId === removedCardId);
    expect(row?.refused).toBe(true);
    expect(row?.refusedReason).toMatch(/removed from this campaign/);
    const otherRow = model.rows.find((candidate) => candidate.cardId !== removedCardId);
    expect(otherRow?.refused).toBe(false);
    expect(otherRow?.refusedReason).toBeNull();
  });

  it("removedFromCampaignCardIds only counts a faceless removal (a same-card, other-face removal leaves it usable)", () => {
    const cardId = STARTER.cards[0]!.cardId;
    const context = {
      ...campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1),
      removedFromCampaign: [{ cardId, face: "back" }],
    };
    expect(removedFromCampaignCardIds(context).has(cardId)).toBe(false);
    const facelessContext = { ...context, removedFromCampaign: [{ cardId }] };
    expect(removedFromCampaignCardIds(facelessContext).has(cardId)).toBe(true);
  });

  it("campaignDeckSizeSplit counts a granted line as pinned, not toward the deck-size count (MC10 p. 3)", () => {
    const context = campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1);
    const deck = {
      identityCardId: STARTER.identityCardId,
      aspects: STARTER.aspects,
      cards: [...STARTER.cards, { cardId: TECH_UPGRADE, quantity: 1 }],
    };
    const totalCards = deck.cards.reduce((n, line) => n + line.quantity, 0);
    const model = campaignDeckEditModel(deck, POOL_CARDS, context);
    const split = campaignDeckSizeSplit(model);
    expect(split.pinned).toBe(1);
    expect(split.counted).toBe(totalCards - 1);
    // A deck with no grants at all has nothing pinned.
    const ungranted = campaignDeckSizeSplit(
      campaignDeckEditModel(
        { identityCardId: STARTER.identityCardId, aspects: STARTER.aspects, cards: STARTER.cards },
        POOL_CARDS,
        campaignDeckContextOf(TRORS_CAMPAIGN, freshLog(), 1),
      ),
    );
    expect(ungranted.pinned).toBe(0);
  });

  it("disables editing, with the printed reason, only when a freeze is supplied", () => {
    const baseDeck = { identityCardId: STARTER.identityCardId, aspects: STARTER.aspects, cards: STARTER.cards };
    const open = campaignDeckEditModel(baseDeck, POOL_CARDS, campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1));
    expect(open.editingDisabled).toBe(false);
    expect(open.editingDisabledReason).toBeNull();

    const frozen = campaignDeckEditModel(
      baseDeck,
      POOL_CARDS,
      campaignDeckContextOf(TRORS_CAMPAIGN, grantedLog(), 1, {
        frozenNonCampaignCards: STARTER.cards.map((line) => ({ ...line })),
      }),
    );
    expect(frozen.editingDisabled).toBe(true);
    expect(frozen.editingDisabledReason).toMatch(/frozen for the rest/);
  });
});

describe("deckFreezePolicyOf", () => {
  it("names each box's own freeze rule, and null for a box with none", () => {
    expect(deckFreezePolicyOf("gmw")).toBe("mandatory");
    expect(deckFreezePolicyOf("sm")).toBe("optional");
    expect(deckFreezePolicyOf("trors")).toBeNull();
  });
});

describe("MC27 p. 4's prohibited cards (Venom the ally 27190, Symbiote Suit 27191), against SM's real Campaign record", () => {
  const SM_STARTER = SM_STARTER_DECKS.find((deck) => (deck.id as string) === "ghost-spider")!;
  const VENOM_ALLY = cardId("27190");

  function smSeat(seatNumber: number): CampaignSeatSetup {
    return {
      seatNumber,
      identityCardId: SM_STARTER.identityCardId,
      deck: { identityCardId: SM_STARTER.identityCardId, aspects: SM_STARTER.aspects, cards: SM_STARTER.cards },
    };
  }

  function smLog(): CampaignLog {
    return createCampaignLog(SM_CAMPAIGN_DEFINITION, {
      id: "sm-prohibited-test",
      seats: [smSeat(1)],
      modes: { campaign: { campaignId: SM_CAMPAIGN_DEFINITION.campaignId } },
      poolVersion: "deck-model-test",
      seed: 1,
    });
  }

  it("prohibitedCampaignCardIds reads SM_CAMPAIGN's own prohibited.cardIds", () => {
    const context = campaignDeckContextOf(SM_CAMPAIGN, smLog(), 1);
    const ids = prohibitedCampaignCardIds(context);
    expect(ids.has(VENOM_ALLY)).toBe(true);
    expect(ids.has(cardId("27191"))).toBe(true);
  });

  it("refuses a deck line naming the prohibited Venom ally, with validateDeck's own player-readable reason", () => {
    const context = campaignDeckContextOf(SM_CAMPAIGN, smLog(), 1);
    const deck = { ...smSeat(1).deck, cards: [...SM_STARTER.cards, { cardId: VENOM_ALLY, quantity: 1 }] };
    const model = campaignDeckEditModel(deck, POOL_CARDS, context);
    expect(model.validation.ok).toBe(false);
    const row = model.rows.find((candidate) => candidate.cardId === VENOM_ALLY);
    expect(row?.refused).toBe(true);
    expect(row?.refusedReason).toMatch(/cannot be used during this campaign/);
    const otherRow = model.rows.find((candidate) => candidate.cardId !== VENOM_ALLY);
    expect(otherRow?.refused).toBe(false);
  });
});

describe("MC27 p. 22's Enhanced S.H.I.E.L.D. Tech face, on `CampaignDeckEditRow.face`", () => {
  const SM_STARTER = SM_STARTER_DECKS.find((deck) => (deck.id as string) === "ghost-spider")!;
  const COMPACT_DARTS = cardId("27182a");

  function smContextWith(grants: readonly CampaignGrant[]) {
    const seat: CampaignSeatSetup = {
      seatNumber: 1,
      identityCardId: SM_STARTER.identityCardId,
      deck: { identityCardId: SM_STARTER.identityCardId, aspects: SM_STARTER.aspects, cards: SM_STARTER.cards },
    };
    const log = createCampaignLog(SM_CAMPAIGN_DEFINITION, {
      id: "sm-face-test",
      seats: [seat],
      modes: { campaign: { campaignId: SM_CAMPAIGN_DEFINITION.campaignId } },
      poolVersion: "deck-model-test",
      seed: 1,
    });
    return {
      ...campaignDeckContextOf(SM_CAMPAIGN, log, 1),
      grantedCardIds: grants.map((g) => g.cardId),
    };
  }

  it("is null for a grant still on its front face", () => {
    const grants: CampaignGrant[] = [{ cardId: COMPACT_DARTS, permanence: "campaign", grantedAtNodeId: "sandman" }];
    const context = smContextWith(grants);
    const deck = { ...SM_STARTER, cards: [...SM_STARTER.cards, { cardId: COMPACT_DARTS, quantity: 1 }] };
    const model = campaignDeckEditModel(deck, POOL_CARDS, context, grants);
    const row = model.rows.find((candidate) => candidate.cardId === COMPACT_DARTS);
    expect(row?.locked).toBe(true);
    expect(row?.face).toBeNull();
  });

  it("carries the grant's own face once node 13 has flipped it (`setGrantFace`)", () => {
    const grants: CampaignGrant[] = [
      { cardId: COMPACT_DARTS, permanence: "campaign", grantedAtNodeId: "sandman", face: "Compact Darts" },
    ];
    const context = smContextWith(grants);
    const deck = { ...SM_STARTER, cards: [...SM_STARTER.cards, { cardId: COMPACT_DARTS, quantity: 1 }] };
    const model = campaignDeckEditModel(deck, POOL_CARDS, context, grants);
    const row = model.rows.find((candidate) => candidate.cardId === COMPACT_DARTS);
    expect(row?.face).toBe("Compact Darts");
  });

  it("defaults to no face when the caller passes no grants (every existing non-SM call site)", () => {
    const context = smContextWith([]);
    const deck = { ...SM_STARTER, cards: [...SM_STARTER.cards, { cardId: COMPACT_DARTS, quantity: 1 }] };
    const model = campaignDeckEditModel(deck, POOL_CARDS, context);
    const row = model.rows.find((candidate) => candidate.cardId === COMPACT_DARTS);
    expect(row?.face).toBeNull();
  });
});
