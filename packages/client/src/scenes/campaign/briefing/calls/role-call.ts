/**
 * The role call (MC32 p. 5, "Campaign roles"): four explainer tiles (name, aspect chips, a plain-words summary, how the role sits
 * against the seat's deck, or who already took it) and the "What roles do" note; a tap selects a role and opens its confirm step
 * ("Colossus will be the Brawler"), where only Confirm records it and Back returns to the tiles. What is legal is the engine's
 * offer (`roleCallOf` reads `pending.options`); a role an earlier seat holds is shown, spelled out, and cannot be picked.
 */
import type { CoreAspect } from "@mc/content";
import { artLanguageNow } from "../../../../art/art-source.js";
import { drawChipRun } from "../../../../dom/aspect-chips.js";
import type { SheetBuilder } from "../../../../dom/sheet-builder.js";
import { t } from "../../../../i18n/translate.js";
import { ink, surface, typeRole } from "../../../../tokens.js";
import { bangers } from "../../../../ui/campaign-chrome.js";
import { aspectStampOf } from "../../../../view/aspect-stamp.js";
import {
  backFromRole,
  confirmedRole,
  roleCallOf,
  selectRole,
  type RoleCallView,
  type RoleTileView,
} from "../../../../view/campaign-role-call-model.js";
import type { Rect } from "../../../../view/layout.js";
import { heroNameOf } from "../names.js";
import type { BriefingCtx, Column } from "../context.js";
import { roleExplainerIn, roleRelationIn, roleSummaryIn } from "./call-text.js";
import type { CallInput, CallKind, OptionTileModel } from "./calls.types.js";
import { drawConfirmBar } from "./confirm-bar.js";
import { drawOptionTile } from "./option-tile.js";

type RoleKind = Extract<CallKind, { kind: "role" }>;

const TILE_GAP = 10;

type Aspects = readonly CoreAspect[];

/** The role tiles' own wording in the player's language, from the view's English tile. */
export function roleTileModel(
  ctx: BriefingCtx,
  view: RoleCallView,
  tile: RoleTileView,
  rect: Rect,
  deckAspects: Aspects,
  roleAspects: Aspects,
): OptionTileModel {
  const lang = artLanguageNow();
  const taken = tile.takenBySeat !== null && !tile.available;
  return {
    key: `role:${tile.id}`,
    rect,
    title: tile.name,
    chips: tile.aspects.map((stamp) => aspectStampOf(stamp.aspect, lang)),
    body: taken
      ? (tile.takenByName
          ? t("briefing.call.takenBy", { number: tile.takenBySeat!, hero: tile.takenByName })
          : t("briefing.call.taken", { number: tile.takenBySeat! })
        ).toLocaleUpperCase()
      : roleSummaryIn(tile.id, tile.summary, lang),
    ...(taken ? { bodyWarn: true } : {}),
    ...(taken ? {} : { footer: roleRelationIn(roleAspects, deckAspects, tile.relation, lang) }),
    available: tile.available,
    onPick: () => {
      ctx.state.roleState = selectRole(ctx.state.roleState, view, tile.id);
      ctx.redraw();
    },
  };
}

/** "What roles do": role upgrades and role-building in plain words (MC32 p. 5). */
function drawRoleNote(b: SheetBuilder, col: Column, top: number): number {
  const words = roleExplainerIn();
  const heading = b.text(col.x, top, words.heading.toLocaleUpperCase(), typeRole.label, { color: surface.ink.hex });
  const y = top + heading.height + 6;
  const body = b.text(col.x, y, [words.upgrades, words.building, words.rule].join("\n"), typeRole.body, {
    size: col.phone ? 10 : 11,
    color: surface.ink.hex,
    alpha: ink.secondary,
    wrapWidth: col.width,
    lineSpacing: 4,
  });
  return y + body.height;
}

/** "{hero} will be the {role}": only Confirm records the role. */
function drawRoleConfirm(
  input: CallInput,
  top: number,
  kind: RoleKind,
  view: RoleCallView,
  tile: RoleTileView,
): number {
  const { ctx, b, col } = input;
  const phone = col.width < 560;
  const pad = 14;
  const inner = col.width - pad * 2;
  const lang = artLanguageNow();
  const title = b.text(
    col.x + pad,
    top + pad,
    t("briefing.call.role.confirm", { hero: kind.header.heroName, role: tile.name }).toLocaleUpperCase(),
    bangers(phone ? 24 : 28),
    { color: surface.ink.hex, wrapWidth: inner },
  );
  let y = top + pad + title.height + 8;
  drawChipRun(
    b,
    col.x + pad,
    y,
    tile.aspects.map((stamp) => aspectStampOf(stamp.aspect, lang)),
  );
  y += 18 + 10;
  y +=
    b.text(col.x + pad, y, roleSummaryIn(tile.id, tile.summary, lang), typeRole.emphasis, {
      color: surface.ink.hex,
      wrapWidth: inner,
    }).height + 4;
  const seat = ctx.state.record?.seats.find((candidate) => candidate.seatNumber === kind.header.seatNumber);
  const deck = (seat?.deck?.aspects ?? []) as Aspects;
  const roleAspects = kind.roles.find((role) => role.id === tile.id)?.aspects as Aspects;
  y +=
    b.text(col.x + pad, y, roleRelationIn(roleAspects, deck, tile.relation, lang), typeRole.label, {
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: inner,
    }).height + 10;
  const words = roleExplainerIn();
  y +=
    b.text(col.x + pad, y, `${words.upgrades}\n${words.building}\n${t("briefing.call.role.recorded")}`, typeRole.body, {
      size: phone ? 10 : 11,
      color: surface.ink.hex,
      alpha: ink.secondary,
      wrapWidth: inner,
      lineSpacing: 4,
    }).height + pad;
  b.box({ x: col.x, y: top, width: col.width, height: y - top }, { stroke: surface.ink.hex, strokeWidth: 2 });
  const back = (): void => {
    ctx.state.roleState = backFromRole();
    ctx.redraw();
  };
  const accept = (): void => {
    const role = confirmedRole(ctx.state.roleState, view);
    if (role !== null) ctx.answer([role]);
  };
  return drawConfirmBar(ctx, b, col, y + 12, {
    back: { key: "role-back", run: back },
    confirm: { key: "role-confirm", run: accept },
  });
}

/** The role choice: the tiles and the note, or after a tap the confirm step, from `top`. Returns the bottom. */
export function drawRoleCall(input: CallInput, top: number, kind: RoleKind): number {
  const { ctx, b, col, pending } = input;
  const record = ctx.state.record!;
  const view = roleCallOf(pending, kind.roles, ctx.state.answers, record.seats, heroNameOf);
  const chosen = view.tiles.find((tile) => tile.id === ctx.state.roleState.selected);
  if (chosen) return drawRoleConfirm(input, top, kind, view, chosen);
  const columns = col.phone || col.width < 560 ? 1 : 2;
  const tileWidth = Math.floor((col.width - TILE_GAP * (columns - 1)) / columns);
  const tileHeight = col.phone ? 96 : 98;
  const seat = record.seats.find((candidate) => candidate.seatNumber === pending.seatNumber);
  const deck = (seat?.deck?.aspects ?? []) as Aspects;
  view.tiles.forEach((tile, index) => {
    const rect: Rect = {
      x: col.x + (index % columns) * (tileWidth + TILE_GAP),
      y: top + Math.floor(index / columns) * (tileHeight + TILE_GAP),
      width: tileWidth,
      height: tileHeight,
    };
    const roleAspects = kind.roles.find((role) => role.id === tile.id)?.aspects as Aspects;
    drawOptionTile(b, col, roleTileModel(ctx, view, tile, rect, deck, roleAspects));
  });
  const rows = Math.ceil(view.tiles.length / columns);
  return drawRoleNote(b, col, top + rows * (tileHeight + TILE_GAP) + 2);
}
