/**
 * The Briefing's player-side-scheme choice (NeXt Evolution, MC40 p. 7), drawn: the picker while the runner is asking,
 * and the settled section (the chosen row, "Same as last time", what carries in, the fixed sets) once composed. Plain
 * drawing over `SideSchemeBriefing` (`view/campaign-side-scheme-model.ts`); the scene owns the answer, the Inspect
 * launch and the redraw. A row is picked only by its own PICK button: the card chips beside it open Inspect, so
 * reading a card can never answer the question.
 */
import Phaser from "phaser";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
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
import type { FocusStop } from "../focus-route.js";

export interface SideSchemeDrawContext {
  readonly scene: Phaser.Scene;
  readonly rect: Rect;
  readonly phone: boolean;
  readonly buttons: McButton[];
  readonly stops: Map<string, FocusStop>;
  readonly inspect: (card: SchemeCardRef) => void;
}

const CHIP_HEIGHT = 34;
const ROW_GAP = 8;
const WIDE = 600;

/** The three cards a row names, as Inspect chips: its scheme, the environment on its back, and its encounter card. */
function cardChipsOf(
  row: SideSchemeRow,
): readonly { readonly key: string; readonly word: string; readonly card: SchemeCardRef }[] {
  const chips: { key: string; word: string; card: SchemeCardRef }[] = [];
  if (row.scheme.cardId) chips.push({ key: "scheme", word: "Scheme", card: row.scheme });
  if (row.environment) chips.push({ key: "environment", word: "Environment", card: row.environment });
  if (row.encounterCard) chips.push({ key: "encounter", word: "Encounter", card: row.encounterCard });
  return chips;
}

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
  ctx.stops.set(stopKey, { rect, activate: open });
}

/** A row's chips laid left to right inside `width` from `x`, each an equal share. Returns nothing: they draw themselves. */
function chipRow(
  ctx: SideSchemeDrawContext,
  row: SideSchemeRow,
  x: number,
  y: number,
  width: number,
  keyBase: string,
): void {
  const chips = cardChipsOf(row);
  if (chips.length === 0) return;
  const gap = 6;
  const each = Math.floor((width - gap * (chips.length - 1)) / chips.length);
  chips.forEach((entry, index) => {
    chip(
      ctx,
      { x: x + index * (each + gap), y, width: each, height: CHIP_HEIGHT },
      entry.word,
      `${keyBase}:${entry.key}`,
      entry.card,
    );
  });
}

/**
 * The picker: one row per offered scheme, labeled by `labels` ("Mission Prep → Mission Prepped"), its three cards as
 * chips, and a PICK button that answers with the row's name. Returns the bottom edge.
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
      "Its environment is earned by defeating it.",
      textStyle(typeRole.body, surface.ink.hex, ink.secondary),
    )
    .setOrigin(0, 0)
    .setWordWrapWidth(rect.width);
  y += note.height + 10;

  const wide = rect.width >= WIDE;
  const pickWidth = phone ? 84 : 96;
  for (const row of briefing.offered) {
    const text = labels.get(row.name) ?? row.name;
    const keyBase = `call-scheme:${row.name}`;
    const pick = (): void => onPick(row.name);
    const chips = cardChipsOf(row);
    const chipsWidth = wide ? chips.length * 112 + Math.max(0, chips.length - 1) * 6 : rect.width - 24;
    const height = wide ? 52 : 8 + 40 + 6 + CHIP_HEIGHT + 8;
    const g = scene.add.graphics();
    g.fillStyle(0xfffaf0, 1).fillRect(rect.x, y, rect.width, height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, y, rect.width, height);
    const titleWidth = wide ? rect.width - 12 - pickWidth - 12 - chipsWidth - 24 : rect.width - 12 - pickWidth - 24;
    const title = scene.add
      .text(
        rect.x + 12,
        y + (wide ? height / 2 : 8 + 20),
        text,
        textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex),
      )
      .setOrigin(0, 0.5)
      .setWordWrapWidth(titleWidth);
    void title;
    const pickRect: Rect = {
      x: rect.x + rect.width - 12 - pickWidth,
      y: wide ? y + (height - 36) / 2 : y + 8 + 2,
      width: pickWidth,
      height: 36,
    };
    ctx.buttons.push(
      new McButton(scene, { kind: "primary", label: "Pick", type: typeRole.label, rect: pickRect, onClick: pick }),
    );
    ctx.stops.set(`call-option:${row.name}`, { rect: pickRect, activate: pick });
    if (wide) {
      chipRow(ctx, row, pickRect.x - 12 - chipsWidth, y + (height - CHIP_HEIGHT) / 2, chipsWidth, keyBase);
    } else {
      chipRow(ctx, row, rect.x + 12, y + 8 + 40 + 6, chipsWidth, keyBase);
    }
    y += height + ROW_GAP;
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
    const wide = rect.width >= WIDE;
    const chips = cardChipsOf(row);
    const chipsWidth = wide ? chips.length * 112 + Math.max(0, chips.length - 1) * 6 : rect.width - 24;
    const heading = row.environment ? `${row.name} → ${row.environment.name}` : row.name;
    const title = scene.add
      .text(rect.x + 12, 0, heading.toUpperCase(), textStyle(bangers(phone ? 20 : 22), surface.ink.hex))
      .setOrigin(0, 0);
    fitText(title, rect.width - 24, phone ? 20 : 22);
    const marker = briefing.repeated
      ? label(scene, 0, 0, "Same as last time", typeRole.label, signal.cost.hex, 1)
      : null;
    const height = wide ? 52 : 8 + title.height + (marker ? 6 + marker.height : 0) + 12 + CHIP_HEIGHT + 8;
    const g = scene.add.graphics();
    g.fillStyle(0xfffaf0, 1).fillRect(rect.x, y, rect.width, height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, y, rect.width, height);
    g.fillStyle(signal.heal.hex, 1).fillRect(rect.x, y, 6, height);
    scene.children.bringToTop(title);
    if (marker) scene.children.bringToTop(marker);
    if (wide) {
      title.setPosition(rect.x + 16, y + (marker ? 8 : (height - title.height) / 2));
      marker?.setPosition(rect.x + 16, y + 8 + title.height + 2);
      chipRow(
        ctx,
        row,
        rect.x + rect.width - 12 - chipsWidth,
        y + (height - CHIP_HEIGHT) / 2,
        chipsWidth,
        "scheme-chosen",
      );
    } else {
      title.setPosition(rect.x + 16, y + 8);
      marker?.setPosition(rect.x + 16, y + 8 + title.height + 6);
      chipRow(ctx, row, rect.x + 12, y + height - 8 - CHIP_HEIGHT, chipsWidth, "scheme-chosen");
    }
    y += height + 12;
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
