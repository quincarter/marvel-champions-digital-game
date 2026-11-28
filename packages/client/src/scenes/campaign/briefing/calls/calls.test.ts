// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { CAMPAIGN_ACCEPT } from "@mc/engine";
import { campaignCardsById } from "../../../../content/campaign-pool.js";
import type { SideSchemeBriefing } from "../../../../view/campaign-side-scheme-model.js";
import { callKindOf } from "./call-kind.js";
import { callSlot } from "./call-slot.js";
import type { CallKind } from "./calls.types.js";
import { callHarness, pendingOf } from "./calls.test-support.js";
import { drawModularCall } from "./modular-call.js";
import { drawSideSchemeCall } from "./side-scheme-call.js";

// A builder measures text in the panel layer; the test DOM has no layout, so any element serves.
vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
// The campaign chrome pulls in Phaser and its UI toolkit; the calls use only its display type.
vi.mock("../../../../ui/campaign-chrome.js", () => ({
  bangers: (size: number) => ({
    family: "Bangers",
    size,
    weight: 400,
    lineHeight: 0.9,
    uppercase: true,
    letterSpacing: 0,
  }),
}));
vi.mock("../../../../dom/ui-layer.js", () => ({ uiLayer: () => document.body }));

const cards = [...campaignCardsById().values()];
const eventsOf = (aspect: string, count: number): string[] =>
  cards
    .filter((card) => card.type === "event" && (card as { aspect?: string }).aspect === aspect)
    .slice(0, count)
    .map((card) => card.id as string);
const heroId = cards.find((card) => card.type === "hero_identity")!.id;

/** A one-seat record of the Mutants Genesis box (the one with roles), the seat's deck running Protection. */
const withSeat = (state: { record: unknown; answers: unknown[] }, answers: unknown[] = []): void => {
  state.record = {
    campaignId: "mut_gen",
    seats: [{ seatNumber: 1, identityCardId: heroId, deck: { aspects: ["protection"] }, fields: {} }],
    position: { nextNodeId: null },
  };
  state.answers = answers;
};

describe("which call is pending", () => {
  const state = callHarness().ctx.state;

  it("is a random draw, a plain list, or a list of cards", () => {
    expect(callKindOf(state, pendingOf({ random: true, options: ["a"] })).kind).toBe("random");
    expect(callKindOf(state, pendingOf({ options: ["x", "y"] }))).toEqual({ kind: "options", cards: null });
    const [first, second] = eventsOf("justice", 2);
    const kind = callKindOf(state, pendingOf({ options: [first!, second!] }));
    expect(kind.kind).toBe("options");
    expect((kind as Extract<CallKind, { kind: "options" }>).cards?.get(first!)?.cardId).toBe(first);
  });

  it("is the role call for a seat of a box with roles, and role-building once the seat has a role", () => {
    const harness = callHarness((s) => withSeat(s));
    const roleIds = ["brawler", "commander", "defender", "peacekeeper"];
    expect(callKindOf(harness.ctx.state, pendingOf({ seatNumber: 1, options: roleIds })).kind).toBe("role");
    const answered = callHarness((s) =>
      withSeat(s, [{ instructionId: "r", slot: "role", seatNumber: 1, picked: ["brawler"] }]),
    );
    const options = [...eventsOf("aggression", 2), ...eventsOf("protection", 2)];
    const build = callKindOf(answered.ctx.state, pendingOf({ seatNumber: 1, optional: true, options }));
    expect(build.kind).toBe("roleBuild");
    expect(callSlot.shape(answered.ctx, pendingOf({ seatNumber: 1, optional: true, options }), false)).toEqual({
      seatCall: false,
      ownsScroll: true,
    });
  });

  it("shapes the page: a per-seat call takes a phone's top, a whole-table call never", () => {
    const { ctx } = callHarness();
    expect(callSlot.shape(ctx, pendingOf({ seatNumber: 2, options: ["x"] }), true)).toEqual({
      seatCall: true,
      ownsScroll: false,
    });
    expect(callSlot.shape(ctx, pendingOf({ seatNumber: 2, options: ["x"] }), false).seatCall).toBe(false);
    expect(callSlot.shape(ctx, pendingOf({ options: ["x"] }), true).seatCall).toBe(false);
  });
});

describe("the option grid", () => {
  it("answers a single pick on the press, with a stop per option", () => {
    const h = callHarness((s) => (s.pending = pendingOf({ options: ["a", "b", "c"] })));
    h.draw((ctx, b, col) => callSlot.draw(ctx, b, col, 80));
    expect(h.stopKeys()).toEqual(["call-option:0", "call-option:1", "call-option:2"]);
    h.press("call-option:1");
    expect(h.answers).toEqual([["b"]]);
  });

  it("toggles a multi pick and offers Confirm only once exactly `count` are chosen", () => {
    const h = callHarness((s) => (s.pending = pendingOf({ options: ["a", "b", "c"], count: 2 })));
    const redraw = (): void => void h.draw((ctx, b, col) => callSlot.draw(ctx, b, col, 80));
    redraw();
    expect(h.stopKeys()).not.toContain("call-confirm");
    h.press("call-option:0");
    redraw();
    expect(h.ctx.state.picking).toEqual(["a"]);
    expect(h.stopKeys()).not.toContain("call-confirm");
    h.press("call-option:2");
    redraw();
    expect(h.stopKeys()).toContain("call-confirm");
    h.press("call-confirm");
    expect(h.answers).toEqual([["a", "c"]]);
    h.press("call-option:0");
    expect(h.ctx.state.picking).toEqual(["c"]);
  });

  it("pages a long list and turns the page from the pager's stops (LB / RB)", () => {
    const options = Array.from({ length: 40 }, (_, index) => `option-${index}`);
    const h = callHarness((s) => (s.pending = pendingOf({ options })));
    h.draw((ctx, b, col) => callSlot.draw(ctx, b, col, 80));
    expect(h.stopKeys()).toContain("call-next");
    expect(h.stopKeys()).not.toContain("call-prev");
    h.press("call-next");
    expect(h.ctx.state.callPage).toBe(1);
    h.draw((ctx, b, col) => callSlot.draw(ctx, b, col, 80));
    expect(h.stopKeys()).toContain("call-prev");
    expect(h.stopKeys()).toContain(
      "call-option:" + String(h.stopKeys().filter((k) => k.startsWith("call-option:")).length),
    );
  });

  it("adds Decline to an optional pick, which answers with nothing", () => {
    const h = callHarness((s) => (s.pending = pendingOf({ options: ["a"], optional: true })));
    h.draw((ctx, b, col) => callSlot.draw(ctx, b, col, 80));
    h.press("call-decline");
    expect(h.answers).toEqual([[]]);
  });

  it("shows a card option beside its picture: the picture reads it, the option's own button takes it", () => {
    const [first, second] = eventsOf("justice", 2);
    const h = callHarness((s) => (s.pending = pendingOf({ options: [first!, second!] })));
    h.draw((ctx, b, col) => callSlot.draw(ctx, b, col, 80));
    expect(h.stopKeys()).toEqual(["call-inspect:0", "call-option:0", "call-inspect:1", "call-option:1"]);
    h.press("call-inspect:0");
    expect(h.inspected).toEqual([{ cardId: first }]);
    expect(h.answers).toEqual([]);
    h.press("call-option:0");
    expect(h.answers).toEqual([[first]]);
  });

  it("labels the Fear No Evil villain methods as the printed options", () => {
    const methods = ["The next villain on the recommended list", "A random unrecorded villain"];
    const h = callHarness((s) => (s.pending = pendingOf({ options: methods })));
    const { b } = h.draw((ctx, bb, col) => callSlot.draw(ctx, bb, col, 80));
    expect(b.nodes.flatMap((node) => (node.kind === "button" ? [node.label] : []))).toEqual(methods);
  });
});

describe("accept or decline", () => {
  it("offers Take it and Decline for a random draw", () => {
    const h = callHarness((s) => (s.pending = pendingOf({ random: true, options: ["a"], optional: true })));
    h.draw((ctx, b, col) => callSlot.draw(ctx, b, col, 80));
    expect(h.stopKeys()).toEqual(["call-decline", "call-accept"]);
    h.press("call-accept");
    h.press("call-decline");
    expect(h.answers).toEqual([[CAMPAIGN_ACCEPT], []]);
  });
});

describe("the role call", () => {
  const roleIds = ["brawler", "commander", "defender", "peacekeeper"];
  it("selects a role on a tap, and only Confirm records it; Back returns to the tiles", () => {
    const h = callHarness((s) => {
      withSeat(s);
      s.pending = pendingOf({ seatNumber: 1, options: roleIds });
    });
    const redraw = (): void => void h.draw((ctx, b, col) => callSlot.draw(ctx, b, col, 80));
    redraw();
    expect(h.stopKeys().filter((key) => key.startsWith("role:"))).toEqual(roleIds.map((id) => `role:${id}`));
    h.press("role:commander");
    expect(h.ctx.state.roleState.selected).toBe("commander");
    redraw();
    expect(h.stopKeys()).toEqual(["role-back", "role-confirm"]);
    h.press("role-back");
    expect(h.ctx.state.roleState.selected).toBeNull();
    redraw();
    h.press("role:defender");
    redraw();
    h.press("role-confirm");
    expect(h.answers).toEqual([["defender"]]);
  });

  it("shows a role an earlier seat took, but gives it no press", () => {
    const h = callHarness((s) => {
      withSeat(s, [{ instructionId: "test.call", slot: "slot", seatNumber: 2, picked: ["brawler"] }]);
      s.pending = pendingOf({ seatNumber: 1, options: roleIds });
    });
    const { b } = h.draw((ctx, bb, col) => callSlot.draw(ctx, bb, col, 80));
    expect(h.stopKeys()).not.toContain("role:brawler");
    expect(h.stopKeys()).toContain("role:commander");
    expect(b.nodes.some((node) => node.kind === "text" && node.text.startsWith("TAKEN"))).toBe(true);
  });
});

describe("role-building", () => {
  const options = [...eventsOf("aggression", 2), ...eventsOf("protection", 2)];
  const setup = (): ReturnType<typeof callHarness> =>
    callHarness((s) => {
      withSeat(s, [{ instructionId: "r", slot: "role", seatNumber: 1, picked: ["brawler"] }]);
      s.pending = pendingOf({ seatNumber: 1, optional: true, options });
    });
  const redraw = (h: ReturnType<typeof callHarness>): void =>
    void h.draw((ctx, b, col) => callSlot.draw(ctx, b, col, 80));

  it("lists chips, every card and Decline, and Take opens the confirm step", () => {
    const h = setup();
    redraw(h);
    const keys = h.stopKeys();
    expect(keys).toEqual(
      expect.arrayContaining(["rb-chip:all", "rb-chip:aggression", "rb-chip:protection", "call-decline"]),
    );
    for (const id of options) expect(keys).toContain(`rb-card:${id}`);
    h.press(`rb-take:${options[0]}`);
    expect(h.ctx.state.roleBuild.selected).toBe(options[0]);
    redraw(h);
    expect(h.stopKeys()).toEqual(expect.arrayContaining(["rb-back", "rb-confirm", "rb-inspect"]));
    expect(h.stopKeys()).not.toContain("call-decline");
    h.press("rb-confirm");
    expect(h.answers).toEqual([[options[0]]]);
  });

  it("filters by a chip, and Back keeps the filter", () => {
    const h = setup();
    redraw(h);
    h.press("rb-chip:protection");
    expect(h.ctx.state.roleBuild.aspect).toBe("protection");
    redraw(h);
    expect(h.stopKeys().filter((key) => key.startsWith("rb-card:")).length).toBe(2);
    h.press("rb-chip:protection");
    expect(h.ctx.state.roleBuild.aspect).toBeNull();
  });

  it("opens Inspect with a 'Take this card' choice from a picture, and the choice opens the confirm step", () => {
    const h = setup();
    redraw(h);
    h.press(`rb-card:${options[1]}`);
    expect(h.inspected).toEqual([{ cardId: options[1], choice: { optionId: options[1], label: "Take this card" } }]);
    callSlot.onInspectTake?.(h.ctx, options[1]!);
    expect(h.ctx.state.roleBuild.selected).toBe(options[1]);
    expect(h.redraw).toHaveBeenCalled();
  });

  it("answers Decline with nothing", () => {
    const h = setup();
    redraw(h);
    h.press("call-decline");
    expect(h.answers).toEqual([[]]);
  });
});

describe("the side-scheme call", () => {
  const ref = (cardId: string, name: string): { cardId: never; name: string } => ({ cardId: cardId as never, name });
  const row = (name: string): SideSchemeBriefing["offered"][number] => ({
    name,
    scheme: ref("90001a", name),
    environment: ref("90001b", `${name}d`),
    encounterCard: ref("90002", `${name} Encounter`),
  });
  const scheme = {
    offered: [row("Gear Up"), row("Prepare")],
    chosen: null,
    repeated: false,
    requiredSetIds: [],
    carryIns: [],
    instructionId: "x",
    nodeId: "n",
    scenarioNumber: 1,
    text: "",
    citation: "",
  } as unknown as SideSchemeBriefing;

  it("gives each row its three pictures and one Pick, and a picture answers nothing", () => {
    const h = callHarness();
    h.draw((ctx, b, col) =>
      drawSideSchemeCall({ ctx, b, col, top: 80, pending: pendingOf() }, 80, { kind: "sideScheme", scheme }),
    );
    expect(h.stopKeys()).toEqual([
      "call-scheme:Gear Up:scheme",
      "call-scheme:Gear Up:environment",
      "call-scheme:Gear Up:encounter",
      "call-option:Gear Up",
      "call-scheme:Prepare:scheme",
      "call-scheme:Prepare:environment",
      "call-scheme:Prepare:encounter",
      "call-option:Prepare",
    ]);
    h.press("call-scheme:Prepare:environment");
    expect(h.answers).toEqual([]);
    expect(h.inspected).toEqual([{ cardId: "90001b" }]);
    h.press("call-option:Prepare");
    expect(h.answers).toEqual([["Prepare"]]);
  });
});

describe("the modular call", () => {
  const tile = (id: string, available: boolean, status: "open" | "chosen" | "checkedOff"): never =>
    ({ id, name: id, detail: "6 cards", status, statusLabel: status === "open" ? "" : status, available }) as never;
  const view = {
    question: "Q",
    explain: "E",
    whatIs: "W",
    rule: null,
    pickNumber: 1,
    pickTotal: 2,
    tiles: [tile("a", true, "open"), tile("b", false, "checkedOff"), tile("c", false, "chosen")],
  };

  it("makes an open set pickable and gives a checked-off or chosen one no press", () => {
    const h = callHarness();
    h.draw((ctx, b, col) =>
      drawModularCall({ ctx, b, col, top: 80, pending: pendingOf() }, 80, { kind: "modular", view }),
    );
    expect(h.stopKeys()).toEqual(["call-option:a"]);
    h.press("call-option:a");
    expect(h.answers).toEqual([["a"]]);
  });
});
