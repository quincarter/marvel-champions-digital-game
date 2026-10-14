/**
 * Draws the held-open villain-phase recap (D3 / T3 / P4) into a scene: the "what changed" tiles, the five step
 * columns (each a scrolling region) and the footer controls. The data is `view/villain-recap.ts`'s, the geometry
 * `view/villain-recap-layout.ts`'s; this file only paints them and wires the buttons to the callbacks it is given.
 */
import Phaser from "phaser";
import type { GameState, InstanceId } from "@mc/engine";
import { cardOf } from "@mc/engine";
import { artFor } from "../art/art-source.js";
import { faceOf } from "../view/board-model.js";
import { cardArt, drawArt } from "../art/card-art.js";
import type { FocusStop } from "../scenes/focus-route.js";
import { SCENES } from "../scenes/keys.js";
import { VILLAIN_RECAP_PAUSE_MS, cardSizeFactor, type VillainAutoAdvance } from "../settings.js";
import { appSession } from "../session.js";
import { accent, border, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import type { FormFactor, Rect } from "../view/layout.js";
import type { VariableListScroll } from "../view/variable-list-scroll.js";
import type { RecapChange, RecapColumn, RecapEntry, RecapResponse, VillainRecap } from "../view/villain-recap.js";
import { villainRecapLayout, type VillainRecapLayout } from "../view/villain-recap-layout.js";
import { noteHoverCard } from "./card-hover-preview.js";
import { bindHoldTarget } from "./hold-target.js";
import { McScrollRegion } from "./scroll-region.js";
import { textStyle } from "./theme.js";
import { McButton, fitText, label } from "./widgets.js";

export interface RecapPanelArgs {
  readonly bounds: Rect;
  readonly formFactor: FormFactor;
  readonly recap: VillainRecap;
  readonly game: GameState;
  readonly autoAdvance: VillainAutoAdvance;
  /** One per steps region, owned by the scene so a redraw keeps the scroll position. */
  readonly scrolls: readonly VariableListScroll[];
  readonly buttons: McButton[];
  readonly onHide: () => void;
  readonly onFullLog: () => void;
  readonly onToggle: () => void;
  readonly onStart: () => void;
  /** The primary button's label: "Start player phase ▸", or "Close" when the recap is reopened for review. */
  readonly ctaLabel?: string;
}

export interface RecapPanelResult {
  readonly layout: VillainRecapLayout;
  readonly stops: ReadonlyMap<string, FocusStop>;
}

/** How many scroll positions the scene must keep: the most regions any form factor draws. */
export const RECAP_SCROLL_SLOTS = 5;

const PAD = 10;

const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export function drawVillainRecapPanel(scene: Phaser.Scene, args: RecapPanelArgs): RecapPanelResult {
  const { formFactor, recap } = args;
  const phone = formFactor === "phone";
  const layout = villainRecapLayout(args.bounds, formFactor, recap.changes.length);
  const stops = new Map<string, FocusStop>();

  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
  g.lineStyle(border.object, surface.paper.hex, 1);
  g.strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);

  const title = scene.add
    .text(
      layout.title.x,
      layout.title.y,
      phone ? `ROUND ${recap.round} RECAP` : `VILLAIN PHASE — ROUND ${recap.round}`,
      textStyle({ ...typeRole.screenTitle }, accent.heroRed.hex),
    )
    .setOrigin(0, 0)
    .setLetterSpacing(1);
  fitText(title, layout.title.width, phone ? 22 : 34);
  if (layout.subtitle.height > 0) {
    label(
      scene,
      layout.subtitle.x,
      layout.subtitle.y,
      "Recap · every card, in the order it happened",
      typeRole.label,
      surface.paper.hex,
      ink.secondary,
    );
  }

  const button = (
    key: string,
    text: string,
    rect: Rect,
    kind: "onInk" | "primary",
    type: TypeSpec,
    onClick: () => void,
  ): void => {
    args.buttons.push(new McButton(scene, { kind, label: text, type, rect, onClick }));
    stops.set(key, { rect, activate: onClick });
  };
  button("skip", "Hide", layout.hide, "onInk", typeRole.label, args.onHide);
  button("full-log", "Full log", layout.fullLog, "onInk", typeRole.label, args.onFullLog);

  // What changed.
  if (layout.tilesLabel.height > 0) {
    label(
      scene,
      layout.tilesLabel.x,
      layout.tilesLabel.y,
      "What changed",
      typeRole.label,
      surface.paper.hex,
      ink.label,
    );
  }
  recap.changes.forEach((change, i) => drawTile(scene, layout.tiles[i]!, change, phone));

  // Steps.
  layout.regions.forEach((region, regionIndex) => {
    const from = scene.children.list.length;
    let y = region.y;
    const scroll = args.scrolls[regionIndex]!;
    recap.columns.forEach((column, stepIndex) => {
      if (layout.stepRegion[stepIndex] !== regionIndex) return;
      y += drawColumn(scene, region, y, column, args.game, phone) + 12;
    });
    const objects = scene.children.list.slice(from);
    const scrollRegion = new McScrollRegion(scene, {
      rect: region,
      heights: [Math.max(0, y - 12 - region.y)],
      scroll,
      clipInteractive: true,
    });
    scrollRegion.content.add(objects);
    scrollRegion.syncInteractivity();
  });

  drawToggle(scene, layout.toggle, args.autoAdvance, args.onToggle, phone);
  stops.set("toggle", { rect: layout.toggle, activate: args.onToggle });
  if (layout.hint.width > 40) {
    const hint =
      args.autoAdvance === "off"
        ? "This recap stays open until you start the player phase."
        : `This recap closes itself after ${Math.round(VILLAIN_RECAP_PAUSE_MS / 1000)} seconds.`;
    scene.add
      .text(
        layout.hint.x,
        layout.hint.y + layout.hint.height / 2,
        hint,
        textStyle(typeRole.body, surface.paper.hex, ink.secondary),
      )
      .setOrigin(0, 0.5)
      .setWordWrapWidth(layout.hint.width)
      .setMaxLines(2);
  }
  button("continue", args.ctaLabel ?? "Start player phase ▸", layout.cta, "primary", typeRole.barTitle, args.onStart);

  return { layout, stops };
}

function drawTile(scene: Phaser.Scene, rect: Rect, change: RecapChange, phone: boolean): void {
  const accentColor = change.highlight ? signal.caution.hex : surface.paper.hex;
  const g = scene.add.graphics();
  g.lineStyle(border.control, accentColor, 1);
  g.strokeRect(rect.x, rect.y, rect.width, rect.height);
  const padX = phone ? 8 : 14;
  const labelText = label(
    scene,
    rect.x + padX,
    rect.y + (phone ? 6 : 10),
    // "SPIDER-MAN (PETER PARKER) · YOU" loses its parenthetical so the "· YOU" survives a narrow tile.
    change.label.replace(/\s*\([^)]*\)/, ""),
    typeRole.label,
    accentColor,
    change.highlight ? 1 : ink.secondary,
  );
  labelText.setWordWrapWidth(rect.width - padX * 2).setMaxLines(1);
  const size = phone ? 18 : rect.height >= 70 ? 26 : 20;
  const numberY = rect.y + rect.height - size - (phone ? 6 : 10);
  const bigSpec = { ...typeRole.barTitle, size };
  const small = { ...typeRole.statSmall, size: Math.round(size * 0.65) };
  if (change.text !== null) {
    const t = scene.add
      .text(rect.x + padX, numberY, change.text, textStyle(bigSpec, surface.paper.hex))
      .setOrigin(0, 0);
    fitText(t, rect.width - padX * 2, size);
    return;
  }
  const unchanged = change.from === change.to;
  const main =
    unchanged && change.kind !== "threat" ? `${change.to ?? "–"}` : `${change.from ?? "–"} → ${change.to ?? "–"}`;
  const bigText = scene.add.text(rect.x + padX, numberY, main, textStyle(bigSpec, surface.paper.hex)).setOrigin(0, 0);
  const tailParts: string[] = [];
  if (change.max !== null) tailParts.push(`/${change.max}${change.kind === "threat" && !phone ? " THREAT" : ""}`);
  if (change.note && !phone) tailParts.push(change.note);
  const room = rect.width - padX * 2;
  const tailText = scene.add
    .text(
      bigText.x + bigText.width + 6,
      numberY + size - small.size - 1,
      tailParts.join(" · "),
      textStyle(small, surface.paper.hex, ink.secondary),
    )
    .setOrigin(0, 0);
  if (bigText.width + 6 + tailText.width > room) {
    fitText(bigText, Math.max(20, room - tailText.width - 6), size);
    tailText.setX(bigText.x + bigText.width + 6);
    if (tailText.x + tailText.width > rect.x + rect.width - padX) tailText.setVisible(false);
  }
}

function drawColumn(
  scene: Phaser.Scene,
  region: Rect,
  top: number,
  column: RecapColumn,
  game: GameState,
  phone: boolean,
): number {
  const g = scene.add.graphics();
  const width = region.width - (phone ? 0 : 0);
  const headerText = scene.add
    .text(
      region.x + 10,
      top + 8,
      `${column.number} · ${column.title}`.toUpperCase(),
      textStyle({ ...typeRole.rowTitle, size: 11, letterSpacing: 1.2 }, surface.paper.hex),
    )
    .setOrigin(0, 0)
    .setWordWrapWidth(width - 20)
    .setMaxLines(2);
  const headerHeight = Math.max(30, headerText.height + 16);
  g.fillStyle(signal.heal.hex, 1).fillRect(region.x, top, width, headerHeight);
  g.lineStyle(border.control, surface.paper.hex, 1);
  g.strokeRect(region.x, top, width, headerHeight);

  let y = top + headerHeight + 8;
  if (column.entries.length === 0) {
    scene.add
      .text(region.x + 4, y, "Nothing this step.", textStyle(typeRole.body, surface.paper.hex, ink.meta))
      .setOrigin(0, 0);
    return y + 18 - top;
  }
  for (const entry of column.entries) {
    y += drawEntry(scene, { x: region.x, y, width }, entry, column.number, game, phone) + 8;
  }
  return y - 8 - top;
}

interface Slot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

function drawEntry(
  scene: Phaser.Scene,
  slot: Slot,
  entry: RecapEntry,
  step: number,
  game: GameState,
  phone: boolean,
): number {
  const bg = scene.add.graphics();
  const inkColor = surface.ink.hex;
  const left = slot.x + PAD;
  const innerWidth = slot.width - PAD * 2;
  // The global Card size draws the recap's cards larger too, never wider than a third of the column.
  const sized = (phone ? 44 : slot.width < 240 ? 48 : 56) * cardSizeFactor(appSession().settings.cardSize);
  const thumbW = Math.round(Math.min(sized, slot.width / 3));
  const thumbH = Math.round(thumbW * 1.4);
  const boostW = Math.round(thumbW * 0.8);
  const boostH = Math.round(boostW * 1.4);
  let thumbsRight = left;
  let thumbsBottom = slot.y + PAD;

  if (entry.cardInstanceId) {
    drawThumb(scene, { x: left, y: slot.y + PAD, width: thumbW, height: thumbH }, entry.cardInstanceId, game);
    thumbsRight = left + thumbW + 8;
    thumbsBottom = slot.y + PAD + thumbH;
    entry.boostInstanceIds.forEach((id, i) => {
      const r: Rect = { x: thumbsRight, y: slot.y + PAD, width: boostW, height: boostH };
      drawThumb(scene, r, id, game);
      thumbsRight += boostW + 6;
      thumbsBottom = Math.max(thumbsBottom, slot.y + PAD + boostH);
      void i;
    });
  } else if (entry.dealt.length > 0) {
    // Step 3: every card dealt is face down; its recipient is the only thing to say about it.
    const w = 40;
    const h = 56;
    const perRow = Math.max(1, Math.floor((innerWidth + 6) / (w + 6)));
    entry.dealt.forEach((card, i) => {
      const r: Rect = {
        x: left + (i % perRow) * (w + 6),
        y: slot.y + PAD + Math.floor(i / perRow) * (h + 6),
        width: w,
        height: h,
      };
      const c = scene.add.graphics();
      c.fillStyle(inkColor, 1).fillRect(r.x, r.y, r.width, r.height);
      const seat = scene.add
        .text(r.x + w / 2, r.y + h / 2, card.seat.toUpperCase(), textStyle(typeRole.label, surface.paper.hex))
        .setOrigin(0.5)
        .setWordWrapWidth(w - 4)
        .setAlign("center");
      // A long hero name ("WONDER MAN") wraps by word, and a word wider than the chip ran past its edges: shrink it.
      fitText(seat, w - 4, typeRole.label.size);
      thumbsBottom = Math.max(thumbsBottom, r.y + h);
    });
    thumbsRight = left;
    thumbsBottom += 8;
  }

  // Beside the thumbs when there is room for a readable line, under them when there is not.
  const besideWidth = slot.width - PAD - (thumbsRight - slot.x) - PAD;
  const beside = thumbsRight > left && besideWidth >= 110;
  const textX = beside ? thumbsRight : left;
  const textWidth = beside ? besideWidth : innerWidth;
  let y = beside || thumbsRight === left ? slot.y + PAD : thumbsBottom + 6;
  if (thumbsRight === left && entry.dealt.length > 0) y = thumbsBottom;

  const body = (text: string, color = inkColor, alpha = 1, x = textX, width = textWidth): Phaser.GameObjects.Text =>
    scene.add
      .text(x, y, text, textStyle({ ...typeRole.body, size: phone ? 12 : 13, lineHeight: 1.35 }, color, alpha))
      .setOrigin(0, 0)
      .setWordWrapWidth(width);

  const typeWord = entry.cardType ? entry.cardType.replace(/_/g, " ") : null;
  let headX = textX;
  if (step === 4 && entry.seat) {
    const c = chip(scene, textX, y, entry.seat, entry.seatIsViewer);
    headX = textX + c + 8;
  }
  const headline = scene.add
    .text(
      headX,
      y,
      step === 4 && typeWord ? `${entry.headline} · ${typeWord}` : sentence(entry.headline),
      textStyle({ ...typeRole.rowTitle, size: phone ? 13 : 14 }, inkColor),
    )
    .setOrigin(0, 0)
    .setWordWrapWidth(textWidth - (headX - textX));
  y += Math.max(headline.height, step === 4 && entry.seat ? 18 : 0) + 3;
  if (entry.detail) y += body(entry.detail, inkColor, ink.secondary).height + 3;
  for (const effect of entry.effects) y += body(sentence(effect)).height + 3;
  for (const response of entry.responses) y += drawResponse(scene, textX, y, textWidth, response, phone) + 3;
  if (step === 4 && entry.responses.length === 0) {
    y += body("No responses", inkColor, ink.meta).height + 3;
  }

  const bottom = Math.max(y - 3, thumbsBottom) + PAD;
  bg.fillStyle(surface.paper.hex, 1).fillRect(slot.x, slot.y, slot.width, bottom - slot.y);
  return bottom - slot.y;
}

/** A seat chip: black for the viewer, blue for another hero. Returns its width. */
function chip(scene: Phaser.Scene, x: number, y: number, text: string, isViewer: boolean): number {
  const bg = scene.add.graphics();
  const t = scene.add
    .text(x + 6, y + 2, text.toUpperCase(), textStyle({ ...typeRole.label, size: 9 }, surface.paper.hex))
    .setOrigin(0, 0);
  const width = t.width + 12;
  bg.fillStyle(isViewer ? surface.ink.hex : signal.cost.hex, 1).fillRect(x, y, width, 17);
  return width;
}

function drawResponse(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  response: RecapResponse,
  phone: boolean,
): number {
  let textX = x;
  if (response.seat) textX += chip(scene, x, y, response.seat, response.isViewer) + 6;
  const t = scene.add
    .text(
      textX,
      y,
      sentence(response.text),
      textStyle({ ...typeRole.body, size: phone ? 12 : 13, lineHeight: 1.35 }, surface.ink.hex),
    )
    .setOrigin(0, 0)
    .setWordWrapWidth(Math.max(40, width - (textX - x)));
  return Math.max(t.height, response.seat ? 18 : 0);
}

/** A card thumbnail: its real scan, or the plain frame with a name label when there is none. Tap to inspect. */
function drawThumb(scene: Phaser.Scene, rect: Rect, instanceId: InstanceId, game: GameState): void {
  noteHoverCard(scene, instanceId, rect);
  const fill = scene.add.graphics();
  fill.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  fill.lineStyle(border.detail, surface.ink.hex, 1);
  fill.strokeRect(rect.x, rect.y, rect.width, rect.height);
  const card = cardOf(game, instanceId);
  // The face in play: a villain's and a main scheme's picture lives on its stage or side, not on a "front".
  const key = cardArt(scene).request(scene, artFor(card, faceOf(game, instanceId)));
  if (!drawArt(scene, key, rect)) {
    scene.add
      .text(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        card?.name ?? "",
        textStyle(typeRole.label, surface.ink.hex, ink.meta),
      )
      .setOrigin(0.5)
      .setWordWrapWidth(rect.width - 4)
      .setAlign("center");
  }
  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  const open = (): void => {
    scene.scene.launch(SCENES.inspect, { instanceId });
  };
  bindHoldTarget(scene, zone, { key: `recap:${instanceId as string}`, onTap: open, onInspect: open });
}

/** "AUTO-ADVANCE OFF | ON": the active state on paper, the other word on ink; one press flips it. */
function drawToggle(
  scene: Phaser.Scene,
  rect: Rect,
  mode: VillainAutoAdvance,
  onToggle: () => void,
  phone: boolean,
): void {
  const on = mode !== "off";
  const sideWidth = phone ? 56 : 64;
  const g = scene.add.graphics();
  g.fillStyle(on ? surface.ink.hex : surface.paper.hex, 1).fillRect(
    rect.x,
    rect.y,
    rect.width - sideWidth,
    rect.height,
  );
  g.fillStyle(on ? surface.paper.hex : surface.ink.hex, 1).fillRect(
    rect.x + rect.width - sideWidth,
    rect.y,
    sideWidth,
    rect.height,
  );
  g.lineStyle(border.control, surface.paper.hex, 1);
  g.strokeRect(rect.x, rect.y, rect.width, rect.height);
  const spec = { ...typeRole.label, size: phone ? 10 : 11 };
  scene.add
    .text(
      rect.x + (rect.width - sideWidth) / 2,
      rect.y + rect.height / 2,
      `AUTO-ADVANCE ${on ? "ON" : "OFF"}`,
      textStyle(spec, on ? surface.paper.hex : surface.ink.hex),
    )
    .setOrigin(0.5);
  scene.add
    .text(
      rect.x + rect.width - sideWidth / 2,
      rect.y + rect.height / 2,
      on ? "OFF" : "ON",
      textStyle(spec, on ? surface.ink.hex : surface.paper.hex, ink.secondary),
    )
    .setOrigin(0.5);
  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on("pointerup", onToggle);
}
