/**
 * Piece B's slot (`CallSlot`, `briefing/context.ts`): "Your call". It asks `call-kind.ts` which question is pending and hands the
 * column to that kind's own module; the shell keeps the page around it. A call answers with `ctx.answer(picked)`; its own
 * progress (`picking`, `callPage`, `roleState`, `roleBuild`) lives in `ctx.state` and is cleared on every new question.
 */
import type { CallSlot } from "../context.js";
import { callKindFor } from "./call-kind.js";
import { drawCallHead, drawPrompt } from "./call-head.js";
import type { CallInput } from "./calls.types.js";
import { drawModularCall } from "./modular-call.js";
import { drawAcceptDecline, drawOptionGrid } from "./option-grid.js";
import { ROLE_SCROLL } from "../context.js";
import { drawRoleBuild, takeFromInspect } from "./role-build.js";
import { roleWindowMoved } from "./role-build-list.js";
import { drawRoleCall } from "./role-call.js";
import { drawSideSchemeCall } from "./side-scheme-call.js";

export const callSlot: CallSlot = {
  // A per-seat call takes a phone's column top; role-building (which scrolls itself) takes it on every layout.
  shape: (ctx, pending, phone) => ({
    seatCall: pending.seatNumber !== null && phone,
    ownsScroll: callKindFor(ctx.state, pending).kind === "roleBuild",
  }),

  draw(ctx, b, col, top) {
    const pending = ctx.state.pending;
    if (!pending) return top;
    const kind = callKindFor(ctx.state, pending);
    const input: CallInput = { ctx, b, col, top, pending };
    const head = drawCallHead(input);
    switch (kind.kind) {
      case "roleBuild":
        return drawRoleBuild(input, head.y, kind);
      case "sideScheme":
        return drawSideSchemeCall(input, head.y, kind);
      case "modular":
        return drawModularCall(input, head.y, kind);
      case "role":
        return drawRoleCall(input, drawPrompt(input, head.y, head.header), kind);
      case "random":
        return drawAcceptDecline(input, drawPrompt(input, head.y, head.header));
      case "options":
        return drawOptionGrid(input, drawPrompt(input, head.y, head.header), kind);
    }
  },

  // Role-building draws only the rows near its list's view: a scroll that moves that window draws the page again.
  onScroll(ctx, key) {
    if (key === ROLE_SCROLL && roleWindowMoved(ctx)) ctx.redraw();
  },

  isGenreSetPick: (ctx, pending) => callKindFor(ctx.state, pending).kind === "modular",

  onInspectTake(ctx, optionId) {
    const pending = ctx.state.pending;
    if (!pending) return;
    const kind = callKindFor(ctx.state, pending);
    if (kind.kind === "roleBuild") takeFromInspect(ctx, kind, optionId);
  },
};
