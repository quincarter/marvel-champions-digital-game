/**
 * The Briefing's player-side-scheme choice (NeXt Evolution, MC40 p. 7), drawn: the picker while the runner is asking,
 * and the settled section (the chosen row, "Same as last time", what carries in, the fixed sets) once composed. Plain
 * drawing over `SideSchemeBriefing` (`view/campaign-side-scheme-model.ts`); the scene owns the answer, the Inspect
 * launch and the redraw. A row shows its cards as pictures (`view/campaign-briefing-model.ts`'s `sideSchemePickCards`
 * and `pickRowLayout`): the scheme, the environment it earns and the encounter card it brings. A row is picked only
 * by its own PICK button: a picture opens Inspect, so reading a card can never answer the question.
 */
import Phaser from "phaser";
import { accent, hit, ink, signal, surface, typeRole } from "../../tokens.js";
import { bangers, ruleHeading } from "../../ui/campaign-chrome.js";
import { textStyle } from "../../ui/theme.js";
import { McButton, fitText, label } from "../../ui/widgets.js";
import type { Rect } from "../../view/layout.js";
import type {
  CarryInRow,
  SchemeCardRef,
  SideSchemeBriefing,
  SideSchemeRow,
} from "../../view/campaign-side-scheme-model.js";
import { pickRowLayout, sideSchemePickCards, type PickCard } from "../../view/campaign-briefing-model.js";
import { CARDS_BY_ID } from "../../content/pool.js";
import type { FocusStop } from "../focus-route.js";
import { drawPickCards } from "./briefing-pick-cards.js";

export interface SideSchemeDrawContext {
  readonly scene: Phaser.Scene;
  readonly rect: Rect;
  readonly phone: boolean;
  readonly buttons: McButton[];
  readonly stops: Map<string, FocusStop>;
  readonly inspect: (card: SchemeCardRef) => void;
}

/** Inspect chips and Pick are full touch targets. */
const CHIP_HEIGHT = hit.target;
const ROW_GAP = 8;

const pickCardsOf = (row: SideSchemeRow): readonly PickCard[] =>
  sideSchemePickCards(row, (id) => CARDS_BY_ID.get(id)?.type);

function chip(ctx: SideSchemeDrawContext, rect: Rect, word: string, stopKey: string, card: SchemeCardRef): void {
  const open = (): void => ctx.inspect(card);
  ctx.buttons.push(
    new McButton(ctx.scene, {
      kind: "quiet",
      label: word,
      type: { ...typeRole.label, size: 11 },
      rect,
      onClick: open,
    }),
  );
  ctx.stops.set(stopKey, { rect, activate: open, inspect: open });
}

/**
 * The picker: one row per offered scheme with its cards as pictures (each opens Inspect) and a PICK button that
 * answers with the row's name. A stacked row is headed by `labels` ("Mission Prep → Mission Prepped"); a wide row
 * names each card beside its picture instead. Returns the bottom edge.
 */
export function drawSideSchemeCall(
  ctx: SideSchemeDrawContext,
  top: number,
  briefing: SideSchemeBriefing,
  labels: ReadonlyMap<string, string>,
  onPick: (name: string) => void,
): number {
  const { scene, rect, phone } = ctx;
  let y = top;
  const prompt = scene.add
    .text(rect.x, y, "Pick one side scheme.", textStyle(typeRole.rowTitle, surface.ink.hex))
    .setOrigin(0, 0)
    .setWordWrapWidth(rect.width);
  y += prompt.height + 2;
  const note = scene.add
    .text(
      rect.x,
      y,
      "Its environment is earned by defeating it. Tap a card to read it.",
      textStyle(typeRole.body, surface.ink.hex, ink.secondary),
    )
    .setOrigin(0, 0)
    .setWordWrapWidth(rect.width);
  y += note.height + 10;

  const pickWidth = phone ? 84 : 96;
  for (const row of briefing.offered) {
    const cards = pickCardsOf(row);
    const layout = pickRowLayout(
      rect.width,
      cards.map((card) => card.shape),
      { pickWidth },
    );
    const pick = (): void => onPick(row.name);
    const g = scene.add.graphics();
    g.fillStyle(0xfffaf0, 1).fillRect(rect.x, y, rect.width, layout.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, y, rect.width, layout.height);
    if (layout.title) {
      scene.add
        .text(
          rect.x + layout.title.x,
          y + layout.title.y + layout.title.height / 2,
          labels.get(row.name) ?? row.name,
          textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex),
        )
        .setOrigin(0, 0.5)
        .setWordWrapWidth(layout.title.width);
    }
    drawPickCards(scene, rect.x, y, cards, layout, `call-scheme:${row.name}`, ctx.stops, ctx.inspect);
    if (layout.pick) {
      const pickRect: Rect = { ...layout.pick, x: rect.x + layout.pick.x, y: y + layout.pick.y };
      ctx.buttons.push(
        new McButton(scene, { kind: "primary", label: "Pick", type: typeRole.label, rect: pickRect, onClick: pick }),
      );
      ctx.stops.set(`call-option:${row.name}`, { rect: pickRect, activate: pick });
    }
    y += layout.height + ROW_GAP;
  }
  return y;
}

/** What the answered choice leaves on the Briefing: the chosen row, its repeat marker, the carry-ins, the fixed sets. Returns the bottom edge. */
export function drawSideSchemeSettled(
  ctx: SideSchemeDrawContext,
  top: number,
  briefing: SideSchemeBriefing,
  setNameOf: (id: string) => string,
): number {
  const { scene, rect, phone } = ctx;
  let y = ruleHeading(scene, rect.x, top, rect.width, "Side scheme", surface.ink.hex, 20) + 2;
  const row = briefing.chosen;
  if (row) {
    const cards = pickCardsOf(row);
    const heading = row.environment ? `${row.name} → ${row.environment.name}` : row.name;
    const title = scene.add
      .text(rect.x + 16, y + 8, heading.toUpperCase(), textStyle(bangers(phone ? 20 : 22), surface.ink.hex))
      .setOrigin(0, 0);
    fitText(title, rect.width - 28, phone ? 20 : 22);
    const marker = briefing.repeated
      ? label(scene, rect.x + 16, y + 8 + title.height + 2, "Same as last time", typeRole.label, signal.cost.hex, 1)
      : null;
    // The heading is the row's title line; the pictures sit under it, as on a stacked picker row with no Pick.
    const layout = pickRowLayout(
      rect.width,
      cards.map((card) => card.shape),
      { withPick: false, titleHeight: title.height + (marker ? 2 + marker.height : 0), stacked: true },
    );
    const g = scene.add.graphics();
    g.fillStyle(0xfffaf0, 1).fillRect(rect.x, y, rect.width, layout.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, y, rect.width, layout.height);
    g.fillStyle(signal.heal.hex, 1).fillRect(rect.x, y, 6, layout.height);
    scene.children.bringToTop(title);
    if (marker) scene.children.bringToTop(marker);
    drawPickCards(scene, rect.x + 4, y, cards, layout, "scheme-chosen", ctx.stops, ctx.inspect);
    y += layout.height + 12;
  }
  for (const carry of briefing.carryIns) y = drawCarryIn(ctx, y, carry) + 8;
  if (briefing.requiredSetIds.length > 0) {
    const names = briefing.requiredSetIds.map(setNameOf).join(", ");
    const height = 44;
    const g = scene.add.graphics();
    g.fillStyle(0xe4dcc6, 1).fillRect(rect.x, y, rect.width, height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, y, rect.width, height);
    label(scene, rect.x + 12, y + 8, "Fixed set", typeRole.label, accent.heroRed.hex, 1);
    const text = scene.add
      .text(rect.x + 12, y + 24, names, textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex))
      .setOrigin(0, 0);
    fitText(text, rect.width - 24, 14);
    y += height + 8;
  }
  return y;
}

/** One carried-in fact: its few words, a detail line, and each card it names as an Inspect chip. Returns the bottom edge. */
function drawCarryIn(ctx: SideSchemeDrawContext, top: number, carry: CarryInRow): number {
  const { scene, rect } = ctx;
  const title = scene.add
    .text(rect.x + 12, top + 8, carry.title, textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex))
    .setOrigin(0, 0)
    .setWordWrapWidth(rect.width - 24);
  let y = top + 8 + title.height;
  if (carry.detail) {
    const detail = scene.add
      .text(rect.x + 12, y + 2, carry.detail, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width - 24);
    y += 2 + detail.height;
  }
  y += 6;
  if (carry.cards.length > 0) {
    // Each distinct card once, wrapped across lines; a repeat reads "×2".
    const counts = new Map<string, { card: SchemeCardRef; count: number }>();
    for (const card of carry.cards) {
      const seen = counts.get(card.cardId as string);
      if (seen) seen.count += 1;
      else counts.set(card.cardId as string, { card, count: 1 });
    }
    const chipWidth = Math.min(160, rect.width - 24);
    const perLine = Math.max(1, Math.floor((rect.width - 24 + 6) / (chipWidth + 6)));
    [...counts.values()].forEach(({ card, count }, index) => {
      const chipRect: Rect = {
        x: rect.x + 12 + (index % perLine) * (chipWidth + 6),
        y: y + Math.floor(index / perLine) * (CHIP_HEIGHT + 6),
        width: chipWidth,
        height: CHIP_HEIGHT,
      };
      chip(
        ctx,
        chipRect,
        count > 1 ? `${card.name} ×${count}` : card.name,
        `carry:${carry.key}:${card.cardId as string}`,
        card,
      );
    });
    y += Math.ceil(counts.size / perLine) * (CHIP_HEIGHT + 6);
  }
  y += 6;
  const g = scene.add.graphics();
  g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, top, rect.width, y - top);
  return y;
}
