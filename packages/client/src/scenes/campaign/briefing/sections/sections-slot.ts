/**
 * The sections slot (`SectionsSlot`, `context.ts`): the thin composer that says which section goes in which block and wires each
 * one's events to the page. `pool` is the left column's own list; `main` is the phone's column and the wide left column when a
 * pool fills it; `aside` sits under the Decks (or Handled) panel in the wide right pane.
 *
 * The scheme, mission, case file and easier start sit in `main` where there is no room beside the decks (a phone, a pool) and
 * in `aside` otherwise; the modes sit at a phone's foot (in `main`) and at the wide right pane's foot (in `aside`) always. A
 * per-seat call takes the column's top, so none of them show under it.
 */
import type { BriefingBlock, BriefingCtx, SectionsSlot } from "../context.js";
import { ENCOUNTER_SET_NAMES } from "../names.js";
import { sectionDataOf } from "./data.js";
import { drawEasierStart } from "./easier-start/easier-start.js";
import { drawMission } from "./mission/mission.js";
import { drawModes } from "./modes/modes.js";
import { drawPool } from "./pool/pool.js";
import type { SectionBase, SectionCard, SectionEvents } from "./sections.types.js";
import { drawShield } from "./shield/shield.js";
import { drawSideScheme, hasSideScheme } from "./side-scheme/side-scheme.js";

const SECTION_GAP = 20;

const eventsOf = (ctx: BriefingCtx): SectionEvents => ({
  inspect: (card: SectionCard) => ctx.inspectCard(card.cardId as string),
});

/** A section's draw: from `at`, returns its bottom (`at` when it draws nothing). */
type Draw = (at: number) => number;

/** Stacks the draws `SECTION_GAP` apart from `top`; returns the bottom (`top` when none drew anything). */
function stackDraws(top: number, draws: readonly Draw[]): number {
  let bottom = top;
  for (const draw of draws) {
    const at = bottom === top ? top : bottom + SECTION_GAP;
    const next = draw(at);
    if (next > at) bottom = next;
  }
  return bottom;
}

/** The scheme, mission, case file and easier start, in the order the old screen drew them. */
const issueSections: BriefingBlock = (ctx, b, col, top) => {
  const data = sectionDataOf(ctx);
  const base = (at: number): SectionBase => ({ ctx, b, col, top: at });
  const events = eventsOf(ctx);
  const { scheme, mission, shield, easier } = data;
  return stackDraws(top, [
    (at) =>
      scheme && hasSideScheme(scheme)
        ? drawSideScheme({ ...base(at), scheme, setNameOf: (id) => ENCOUNTER_SET_NAMES.get(id) ?? id }, events)
        : at,
    (at) => (mission ? drawMission({ ...base(at), mission }, events) : at),
    (at) => (shield ? drawShield({ ...base(at), shield }, events) : at),
    (at) => (easier ? drawEasierStart({ ...base(at), easier }, { toggle: () => ctx.toggleEasierStart() }) : at),
  ]);
};

/** The modes' draw for a column; draws nothing when the issue has none to choose (or its game is already on the table). */
const modesDraw =
  (ctx: BriefingCtx, b: SectionBase["b"], col: SectionBase["col"]): Draw =>
  (at) => {
    const rows = sectionDataOf(ctx).modes;
    if (rows.length === 0) return at;
    return drawModes({ ctx, b, col, top: at, rows }, { choose: (action) => ctx.setIssueMode(action) });
  };

export const sectionsSlot: SectionsSlot = {
  pool: (ctx, b, col, top) => {
    const pool = ctx.plan?.view?.pool;
    return pool ? drawPool({ ctx, b, col, top, pool }, eventsOf(ctx)) : top;
  },
  main: (ctx, b, col, top) => {
    const plan = ctx.plan;
    if (!plan || plan.seatCall) return top;
    const sections: Draw = (at) => issueSections(ctx, b, col, at);
    // A phone's column is the only place its modes can go; a wide left column leaves them to the right pane.
    return stackDraws(top, plan.phone ? [sections, modesDraw(ctx, b, col)] : [sections]);
  },
  aside: (ctx, b, col, top) => {
    const plan = ctx.plan;
    if (!plan || plan.seatCall) return top;
    const sections: Draw[] = plan.hasPool ? [] : [(at) => issueSections(ctx, b, col, at)];
    return stackDraws(top, [...sections, modesDraw(ctx, b, col)]);
  },
};
