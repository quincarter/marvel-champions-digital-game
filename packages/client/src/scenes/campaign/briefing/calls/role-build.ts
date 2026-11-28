/**
 * Role-building (MC32 p. 5): each player may take up to 1 event and 1 upgrade from their role's two aspects. The call takes the
 * whole screen under the heading and the seat's header: an intro, the aspect filter chips, the card list in its own scroller and
 * Decline pinned at the foot; a card chosen with Take (or from Inspect's "Take this card") opens the confirm step instead.
 * The engine decides what may be chosen (`pending.options` already skips cards in the deck); the model only presents it.
 * Stop keys: `rb-chip:<aspect|all>`, `rb-card:<id>`, `call-decline`, then `rb-back` / `rb-confirm` / `rb-inspect`.
 */
import { artLanguageNow } from "../../../../art/art-source.js";
import { sheetColor } from "../../../../dom/sheet-builder.js";
import { t } from "../../../../i18n/translate.js";
import { hit, ink, surface, typeRole } from "../../../../tokens.js";
import { aspectStampOf } from "../../../../view/aspect-stamp.js";
import {
  roleBuildOf,
  selectRoleBuildCard,
  setRoleBuildFilter,
  type RoleBuildView,
} from "../../../../view/campaign-role-build-model.js";
import type { Rect } from "../../../../view/layout.js";
import { makeColumn } from "../column.js";
import { ROLE_CONFIRM_SCROLL, ROLE_SCROLL, SCROLL_GUTTER, type BriefingCtx } from "../context.js";
import { drawDecline } from "./option-grid.js";
import type { CallInput, CallKind } from "./calls.types.js";
import { drawRoleBuildConfirm } from "./role-build-confirm.js";
import { drawRoleBuildRows } from "./role-build-list.js";

type BuildKind = Extract<CallKind, { kind: "roleBuild" }>;

const CHIP_GAP = 6;

/** The list's view for the open call: what a card chosen in Inspect is looked up in. */
export function roleBuildViewOf(ctx: BriefingCtx, kind: BuildKind): RoleBuildView {
  return roleBuildOf(kind.build.cards, kind.build.ctx, ctx.state.roleBuild);
}

/** A card chosen in the Inspect sheet opens its confirm step (the same as Take on the list). */
export function takeFromInspect(ctx: BriefingCtx, kind: BuildKind, optionId: string): void {
  ctx.state.roleBuild = selectRoleBuildCard(ctx.state.roleBuild, roleBuildViewOf(ctx, kind), optionId);
  ctx.redraw();
}

/** The filter chips, one row of equal widths, each in its aspect's own colors (the chosen one is the ink fill, with a tick). */
function drawChips(input: CallInput, top: number, view: RoleBuildView): number {
  const { ctx, b, col } = input;
  const lang = artLanguageNow();
  const count = view.chips.length;
  const width = Math.floor((col.width - CHIP_GAP * (count - 1)) / count);
  const bar: Rect = { x: col.x, y: top, width: col.width, height: hit.target };
  b.filterBar(
    "rb-chips",
    bar,
    view.chips.map((chip) => {
      const stamp = chip.aspect ? aspectStampOf(chip.aspect, lang) : null;
      return {
        id: chip.aspect ?? "all",
        label: stamp ? stamp.label : t("briefing.call.build.all"),
        count: chip.count,
        selected: chip.selected,
        width,
        ...(stamp ? { tint: { fill: sheetColor(stamp.fill, "fill"), ink: sheetColor(stamp.ink, "text") } } : {}),
      };
    }),
    { prefix: "rb-chip:", rows: 1, rowHeight: hit.target, gap: CHIP_GAP },
  );
  view.chips.forEach((chip, index) => {
    const apply = (): void => {
      ctx.state.roleBuild = setRoleBuildFilter(ctx.state.roleBuild, chip.aspect);
      const list = ctx.scroller(ROLE_SCROLL);
      if (list) list.scrollTop = 0;
      ctx.redraw();
    };
    const key = `rb-chip:${chip.aspect ?? "all"}`;
    col.control(key, { x: col.x + index * (width + CHIP_GAP), y: top, width, height: hit.target }, apply);
  });
  return top + hit.target + 8;
}

/** Draws the call from `top` (under the heading and the seat header) to the foot of the column's view. */
export function drawRoleBuild(input: CallInput, top: number, kind: BuildKind): number {
  const { ctx, b, col } = input;
  const { build } = kind;
  const view = roleBuildViewOf(ctx, kind);
  const viewBottom = col.view.y + col.view.height;
  const selected = view.all.find((card) => card.id === ctx.state.roleBuild.selected);
  if (selected) {
    const rect: Rect = { x: col.x, y: top, width: col.width, height: Math.max(120, viewBottom - top) };
    const inner = makeColumn(ctx, {
      x: col.x,
      width: col.width - SCROLL_GUTTER,
      phone: col.phone,
      view: rect,
      scrollKey: ROLE_CONFIRM_SCROLL,
    });
    b.scrollFit(ROLE_CONFIRM_SCROLL, rect, (scrollB) =>
      drawRoleBuildConfirm(ctx, scrollB, inner, 0, build.ctx.heroName, view, selected),
    );
    return viewBottom;
  }
  const lang = artLanguageNow();
  const aspects = build.ctx.roleAspects.map((aspect) => aspectStampOf(aspect, lang).label).join(" + ");
  let y = top;
  y +=
    b.text(
      col.x,
      y,
      t(`briefing.call.build.intro_${view.noun}`, { role: build.ctx.roleName, aspects }),
      typeRole.body,
      {
        size: col.phone ? 11 : 12,
        color: surface.ink.hex,
        alpha: ink.secondary,
        wrapWidth: col.width,
        lineSpacing: 2,
      },
    ).height + 8;
  y = drawChips(input, y, view);
  const decline: Rect = { x: col.x, y: viewBottom - hit.primary, width: col.width, height: hit.primary };
  const list: Rect = { x: col.x, y, width: col.width, height: Math.max(140, decline.y - 8 - y) };
  if (view.rest.length + view.recommended.length === 0) {
    b.text(col.x, y, t(`briefing.call.build.none_${view.noun}`), typeRole.label, {
      color: surface.ink.hex,
      alpha: ink.secondary,
    });
  } else {
    const inner = makeColumn(ctx, {
      x: col.x,
      width: col.width - SCROLL_GUTTER,
      phone: col.phone,
      view: list,
      scrollKey: ROLE_SCROLL,
    });
    b.scrollFit(ROLE_SCROLL, list, (scrollB) =>
      drawRoleBuildRows(ctx, scrollB, inner, view, list.width - SCROLL_GUTTER, list.height),
    );
  }
  drawDecline(ctx, b, col, decline, "secondary", t(`briefing.call.build.decline_${view.noun}`));
  return viewBottom;
}
