/**
 * Test support for the sections: the call harness's context and column, a section drawn into a fresh builder, and readers for
 * the texts it drew. A test file using this mocks `phaser`, `ui/campaign-chrome.js` (`bangersMock`) and `dom/ui-layer.js` the way
 * `calls/calls.test.ts` does (a builder measures text in the panel layer; the test DOM has no layout).
 */
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import { callHarness, type CallHarness } from "../calls/calls.test-support.js";
import type { BriefingCtx, BriefingState, Column } from "../context.js";
import type { SectionBase, SectionCard } from "./sections.types.js";

/** What the mock of the campaign chrome returns: the display type only. */
export const bangersMock = {
  bangers: (size: number) => ({
    family: "Bangers",
    size,
    weight: 400,
    lineHeight: 0.9,
    uppercase: true,
    letterSpacing: 0,
  }),
};

export interface SectionHarness extends CallHarness {
  /** Draws `section` at y = 100 into a fresh builder; returns the builder and the section's bottom. */
  run(section: (base: SectionBase) => number): { b: SheetBuilder; bottom: number };
}

export function sectionHarness(setup: (state: BriefingState) => void = () => {}, phone = true): SectionHarness {
  const harness = callHarness(setup, phone);
  return {
    ...harness,
    run(section) {
      return harness.draw((ctx: BriefingCtx, b: SheetBuilder, col: Column) => section({ ctx, b, col, top: 100 }));
    },
  };
}

/** Every text the builder drew. */
export const textsOf = (b: SheetBuilder): string[] =>
  b.nodes.flatMap((node) => (node.kind === "text" ? [node.text] : []));

/** A fake `inspect` event that records the card it was given. */
export const recorder = (): { readonly cards: SectionCard[]; readonly inspect: (card: SectionCard) => void } => {
  const cards: SectionCard[] = [];
  return { cards, inspect: (card) => void cards.push(card) };
};
