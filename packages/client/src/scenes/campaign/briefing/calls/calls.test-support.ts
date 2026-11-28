/**
 * Test support for the calls: a `BriefingCtx` whose parts are plain maps and recorders, a builder that measures nothing (the test
 * DOM has no layout) and a column over a phone-sized view. A call is drawn into it and its stops, actions and answers read back.
 * Needs `vi.mock("../../../../dom/ui-layer.js", ...)` in the test file, since a builder measures text in the panel layer.
 */
import { vi } from "vitest";
import type { CampaignPendingChoice } from "@mc/engine";
import { SheetBuilder } from "../../../../dom/sheet-builder.js";
import type { FocusStop } from "../../../focus-route.js";
import { makeColumn } from "../column.js";
import { newBriefingState, type BriefingCtx, type BriefingState, type Column } from "../context.js";

export interface CallHarness {
  readonly ctx: BriefingCtx;
  readonly col: Column;
  readonly answers: (readonly string[])[];
  readonly inspected: { cardId: string; choice?: { optionId: string; label: string } }[];
  readonly redraw: ReturnType<typeof vi.fn>;
  /** Draws with a fresh builder and clears what the last draw registered, as the scene does on every redraw. */
  draw(drawer: (ctx: BriefingCtx, b: SheetBuilder, col: Column) => number): { b: SheetBuilder; bottom: number };
  stopKeys(): string[];
  /** Presses the control `key`, as a tap on it does. */
  press(key: string): void;
}

export function pendingOf(over: Partial<CampaignPendingChoice> = {}): CampaignPendingChoice {
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

export function callHarness(setup: (state: BriefingState) => void = () => {}, phone = true): CallHarness {
  const state = newBriefingState({ runId: "run" }, false);
  setup(state);
  const answers: (readonly string[])[] = [];
  const inspected: CallHarness["inspected"] = [];
  const redraw = vi.fn();
  const actions = new Map<string, () => void>();
  const stops = new Map<string, FocusStop>();
  const ctx = {
    state,
    actions,
    stops,
    inspects: new Map<string, () => void>(),
    hoverCards: new Map(),
    obstacles: [],
    glyphs: { hint: () => {} },
    leases: { image: () => ({ src: "/card.png" }) },
    scroller: () => null,
    redraw,
    answer: (picked: readonly string[]) => void answers.push(picked),
    inspectCard: (cardId: string, choice?: { optionId: string; label: string }) =>
      void inspected.push({ cardId, ...(choice ? { choice } : {}) }),
  } as unknown as BriefingCtx;
  const col = makeColumn(ctx, {
    x: 16,
    width: phone ? 343 : 560,
    phone,
    view: { x: 0, y: 60, width: phone ? 375 : 600, height: 520 },
    scrollKey: null,
  });
  return {
    ctx,
    col,
    answers,
    inspected,
    redraw,
    draw(drawer) {
      actions.clear();
      stops.clear();
      const b = new SheetBuilder({} as never, { x: 0, y: 0 }, () => false);
      return { b, bottom: drawer(ctx, b, col) };
    },
    stopKeys: () => [...stops.keys()],
    press: (key) => {
      const action = actions.get(key);
      if (!action) throw new Error(`no control ${key}`);
      action();
    },
  };
}
