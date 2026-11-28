
// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { CAMPAIGN_ACCEPT, type CampaignPendingChoice } from "@mc/engine";
import { campaignCardsById } from "../../../../content/campaign-pool.js";
import type { PictureLeases } from "../../../../dom/picture-leases.js";
import type { BriefingHints } from "../hints.js";
import { newBriefingState, type BriefingState } from "../context.js";
import { callKindOf } from "./call-kind.js";
import { callModelOf, callShapeOf } from "./call-model.js";
import type { CallKind } from "./calls.types.js";

// The call model reads the session (the campaign service) through the sections; the campaign chrome pulls in Phaser.
vi.mock("phaser", () => ({ default: {}, Scene: class {} }));

const cards = [...campaignCardsById().values()];
const eventsOf = (aspect: string, count: number): string[] =>
  cards
    .filter((card) => card.type === "event" && (card as { aspect?: string }).aspect === aspect)
    .slice(0, count)
    .map((card) => card.id as string);
const heroId = cards.find((card) => card.type === "hero_identity")!.id;

function pendingOf(over: Partial<CampaignPendingChoice> = {}): CampaignPendingChoice {
  return {
    instructionId: "test.call",
    slot: "slot",
    seatNumber: null,
    text: "Choose.",
    citation: "T p. 1",
    chooser: "group",
    options: [],
    count: 1,
    optional: false,
    random: false,
    ...over,
  } as CampaignPendingChoice;
}

/** A one-seat record of the Mutants Genesis box (the one with roles), the seat deck running Protection. */
function stateWithSeat(answers: unknown[] = []): BriefingState {
  const state = newBriefingState({ runId: "run" }, false);
  state.record = {
    campaignId: "mut_gen",
    seats: [{ seatNumber: 1, identityCardId: heroId, deck: { aspects: ["protection"] }, fields: {} }],
    position: { nextNodeId: null },
  } as never;
  state.answers = answers as never;
  return state;
}

const leases = { image: () => ({ src: "/card.png" }) } as unknown as PictureLeases;
const hints = { glyph: () => null } as unknown as BriefingHints;
const ROLES = ["brawler", "commander", "defender", "peacekeeper"];

describe("which call is pending", () => {
  const state = newBriefingState({ runId: "run" }, false);

  it("is a random draw, a plain list, or a list of cards", () => {
    expect(callKindOf(state, pendingOf({ random: true, options: ["a"] })).kind).toBe("random");
    expect(callKindOf(state, pendingOf({ options: ["x", "y"] }))).toEqual({ kind: "options", cards: null });
    const [first, second] = eventsOf("justice", 2);
    const kind = callKindOf(state, pendingOf({ options: [first!, second!] }));
    expect(kind.kind).toBe("options");
    expect((kind as Extract<CallKind, { kind: "options" }>).cards?.get(first!)?.cardId).toBe(first);
  });

  it("is the role call for a seat of a box with roles, and role-building once the seat has a role", () => {
    expect(callKindOf(stateWithSeat(), pendingOf({ seatNumber: 1, options: ROLES })).kind).toBe("role");
    const answered = stateWithSeat([{ instructionId: "r", slot: "role", seatNumber: 1, picked: ["brawler"] }]);
    const options = [...eventsOf("aggression", 2), ...eventsOf("protection", 2)];
    expect(callKindOf(answered, pendingOf({ seatNumber: 1, optional: true, options })).kind).toBe("roleBuild");
    expect(callShapeOf(answered, pendingOf({ seatNumber: 1, optional: true, options }), false)).toEqual({
      seatCall: false,
      ownsScroll: true,
    });
  });

  it("shapes the page: a per-seat call takes a phone top, a whole-table call never", () => {
    expect(callShapeOf(state, pendingOf({ seatNumber: 2, options: ["x"] }), true)).toEqual({
      seatCall: true,
      ownsScroll: false,
    });
    expect(callShapeOf(state, pendingOf({ seatNumber: 2, options: ["x"] }), false).seatCall).toBe(false);
    expect(callShapeOf(state, pendingOf({ options: ["x"] }), true).seatCall).toBe(false);
  });
});

describe("the call model", () => {
  it("a plain list is options the engine offered, a card option beside its picture, and a new question has a new key", () => {
    const state = newBriefingState({ runId: "run" }, false);
    const [first, second] = eventsOf("justice", 2);
    const pending = pendingOf({ options: [first!, second!] });
    const call = callModelOf({ state, pending, leases, hints, phone: false });
    expect(call.body.kind).toBe("options");
    const options = (call.body as Extract<typeof call.body, { kind: "options" }>).model;
    expect(options.options.map((option) => option.id)).toEqual([first, second]);
    expect(options.options[0]!.card?.cardId).toBe(first);
    expect(call.prompt?.rule).toBe("Choose.");
    expect(call.prompt?.who).toBe("Everyone decides together");
    const next = callModelOf({ state, pending: pendingOf({ slot: "other", options: ["x"] }), leases, hints, phone: false });
    expect(next.key).not.toBe(call.key);
  });

  it("a random draw is accept (the engine accept value) and decline", () => {
    const state = newBriefingState({ runId: "run" }, false);
    const call = callModelOf({ state, pending: pendingOf({ random: true, options: ["a"] }), leases, hints, phone: false });
    const model = (call.body as Extract<typeof call.body, { kind: "options" }>).model;
    expect(model.random).toBe(true);
    expect(model.acceptValue).toBe(CAMPAIGN_ACCEPT);
  });

  it("the role call has a tile per role, each available one with its confirm step", () => {
    const state = stateWithSeat();
    const call = callModelOf({ state, pending: pendingOf({ seatNumber: 1, options: ROLES }), leases, hints, phone: true });
    expect(call.head.seat?.title).toContain("SEAT 1");
    const body = call.body as Extract<typeof call.body, { kind: "role" }>;
    expect(body.tiles.tiles.map((tile) => tile.stop)).toEqual(ROLES.map((id) => `role:${id}`));
    expect([...body.confirms.keys()]).toEqual(ROLES);
    expect(body.confirms.get("brawler")!.bar.stops).toEqual({ back: "role-back", confirm: "role-confirm" });
    expect(call.ownsScroll).toBe(false);
  });

  it("role-building owns its scroll and has no prompt of its own", () => {
    const state = stateWithSeat([{ instructionId: "r", slot: "role", seatNumber: 1, picked: ["brawler"] }]);
    const options = [...eventsOf("aggression", 2), ...eventsOf("protection", 2)];
    const call = callModelOf({
      state,
      pending: pendingOf({ seatNumber: 1, optional: true, options }),
      leases,
      hints,
      phone: false,
    });
    expect(call.ownsScroll).toBe(true);
    expect(call.prompt).toBeNull();
    const body = call.body as Extract<typeof call.body, { kind: "roleBuild" }>;
    expect([...body.model.pictures.keys()]).toEqual(options);
  });
});
