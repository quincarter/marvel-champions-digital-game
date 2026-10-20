/**
 * Draws the held-open villain-phase recap (D3 / T3 / P4) into a scene: the "what changed" tiles, the five step
 * columns (each a scrolling region) and the footer controls. The data is `view/villain-recap.ts`'s, the geometry
 * `view/villain-recap-layout.ts`'s; this file only paints them and wires the buttons to the callbacks it is given.
 */
import Phaser from "phaser";
import type { GameState, InstanceId } from "@mc/engine";
import { cardOf } from "@mc/engine";
import { artFor, isHiddenArt, type CardFace } from "../art/art-source.js";
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
import {
  RECAP_ENTRY_PAD,
  recapNamePlacement,
  villainDockedRecapLayout,
  villainRecapLayout,
  type VillainRecapLayout,
} from "../view/villain-recap-layout.js";
import { fitTileLabel, tileTailVariants } from "../view/villain-recap-tile.js";
import { hoverCardMark, noteHoverCard, scrollHoverCards } from "./card-hover-preview.js";
import { drawSeatAvatar } from "./seat-avatar.js";
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
  /**
   * Drawn in the docked panel (`bounds` is the panel): EXPAND takes Hide's place and opens the full-screen recap. On the
   * rail and the band the steps lay out as the story strip (`villainDockedRecapLayout`); on a tab, as the ordinary
   * layout over the panel.
   */
  readonly docked?: {
    readonly kind: "rail" | "band" | "tab";
    readonly expandLabel: string;
    readonly onExpand: () => void;
  };
}

export interface RecapPanelResult {
  readonly layout: VillainRecapLayout;
  readonly stops: ReadonlyMap<string, FocusStop>;
}

/** How many scroll positions the scene must keep: the most regions any form factor draws. */
export const RECAP_SCROLL_SLOTS = 5;

const PAD = RECAP_ENTRY_PAD;

const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export function drawVillainRecapPanel(scene: Phaser.Scene, args: RecapPanelArgs): RecapPanelResult {
  const { formFactor, recap } = args;
  const phone = formFactor === "phone";
  const dockedKind = args.docked?.kind;
  const layout =
    dockedKind === "rail" || dockedKind === "band"
      ? villainDockedRecapLayout(args.bounds, dockedKind, recap.changes.length)
      : villainRecapLayout(args.bounds, formFactor, recap.changes.length);
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
  if (args.docked)
    button("expand", args.docked.expandLabel, layout.hide, "onInk", typeRole.label, args.docked.onExpand);
  else button("skip", "Hide", layout.hide, "onInk", typeRole.label, args.onHide);
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
    const hoverMark = hoverCardMark(scene);
    let y = region.y;
    const scroll = args.scrolls[regionIndex]!;
    recap.columns.forEach((column, stepIndex) => {
      if (layout.stepRegion[stepIndex] !== regionIndex) return;
      y += drawColumn(scene, region, y, column, args.game, phone, layout.regionAcross?.[regionIndex] ?? 1) + 12;
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
    // The region scrolls without a redraw: the thumbnails' hover rects follow it (a card scrolled up from under the
    // footer bar hovers where it now is).
    scrollHoverCards(scene, hoverMark, scrollRegion.content, region);
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
  const padX = phone || rect.width < 130 ? 8 : 14;
  const labelText = label(
    scene,
    rect.x + padX,
    rect.y + (phone ? 6 : 10),
    change.label,
    typeRole.label,
    accentColor,
    change.highlight ? 1 : ink.secondary,
  );
  // A narrow tile cuts the name only as a last resort, and never its "· YOU" tag (`fitTileLabel`). A tall tile first
  // lets the label take a second line, with its letters closed up: "THE MASTER OF / TIME" reads where "THE MASTE…" does not.
  const labelRoom = rect.width - padX * 2;
  labelText.setText(
    fitTileLabel(change.label, (candidate) => {
      labelText.setText(candidate);
      return labelText.width <= labelRoom;
    }),
  );
  if (labelText.text.includes("…") && !phone && rect.height >= 70) {
    labelText.setLetterSpacing(0).setWordWrapWidth(labelRoom).setText(change.label);
    if (labelText.getWrappedText().length > 2) {
      labelText.setLetterSpacing(typeRole.label.letterSpacing ?? 0).setWordWrapWidth(0);
      labelText.setText(
        fitTileLabel(change.label, (candidate) => {
          labelText.setText(candidate);
          return labelText.width <= labelRoom;
        }),
      );
    }
  }
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
  const room = rect.width - padX * 2;
  // The figures keep their size: the words after them give way first ("/12 THREAT" to "/12" to nothing), and only
  // when the figures alone are too wide do they shrink.
  fitText(bigText, room, size);
  const tailText = scene.add
    .text(
      bigText.x + bigText.width + 6,
      numberY + size - small.size - 1,
      "",
      textStyle(small, surface.paper.hex, ink.secondary),
    )
    .setOrigin(0, 0);
  for (const variant of tileTailVariants(change, phone)) {
    tailText.setText(variant);
    if (variant === "" || bigText.width + 6 + tailText.width <= room) break;
  }
}

function drawColumn(
  scene: Phaser.Scene,
  region: Rect,
  top: number,
  column: RecapColumn,
  game: GameState,
  phone: boolean,
  across: number = 1,
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
    .setWordWrapWidth(width - 20);
  // One line where it reads at 10px or more (step 5 is the last row of a short column); otherwise two.
  const singleLine = (): boolean => {
    for (let size = 11; size >= 10; size--) {
      headerText.setFontSize(size);
      if (headerText.getWrappedText().length <= 1) return true;
    }
    return false;
  };
  if (!singleLine()) headerText.setFontSize(11).setMaxLines(2);
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
  if (across > 1) {
    // Side by side (the docked recap's step 4): rows of `across` entries, each a share of the width.
    const gap = 10;
    const cell = (width - gap * (across - 1)) / across;
    for (let start = 0; start < column.entries.length; start += across) {
      let rowHeight = 0;
      column.entries.slice(start, start + across).forEach((entry, i) => {
        const slot = { x: region.x + i * (cell + gap), y, width: cell };
        rowHeight = Math.max(rowHeight, drawEntry(scene, slot, entry, column.number, game, phone));
      });
      y += rowHeight + 8;
    }
    return y - 8 - top;
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
    drawThumb(
      scene,
      { x: left, y: slot.y + PAD, width: thumbW, height: thumbH },
      entry.cardInstanceId,
      game,
      entry.cardFace,
    );
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
      // The recipient as the hero's face (a name did not fit the chip on a phone), "YOU" across the foot of your own.
      drawSeatAvatar(scene, r, game, card.playerId, inkColor);
      if (card.seat.toUpperCase() === "YOU") {
        const band = scene.add.graphics();
        band.fillStyle(inkColor, 0.85).fillRect(r.x, r.y + h - 16, w, 16);
        scene.add.text(r.x + w / 2, r.y + h - 8, "YOU", textStyle(typeRole.label, surface.paper.hex)).setOrigin(0.5);
      }
      thumbsBottom = Math.max(thumbsBottom, r.y + h);
    });
    // One row of faces with room left beside it keeps the sentence on their line; more, or a narrow column, puts it under.
    const rowWidth = Math.min(entry.dealt.length, perRow) * (w + 6);
    const roomBeside = slot.width - PAD - (left + rowWidth + 4 - slot.x) - PAD;
    if (entry.dealt.length <= perRow && roomBeside >= 110) {
      thumbsRight = left + rowWidth + 4;
    } else {
      thumbsRight = left;
      thumbsBottom += 8;
    }
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
  // A revealed card reads "Name · type" with the seat it was dealt to; the activation or the active counter moving it started reads as itself.
  const cardEntry = entry.kind === "card";
  const headlineText =
    step === 4 && cardEntry && typeWord ? `${entry.headline} · ${typeWord}` : sentence(entry.headline);
  const headlineStyle = textStyle({ ...typeRole.rowTitle, size: phone ? 13 : 14 }, inkColor);
  let headX = textX;
  let stacked = false;
  if (step === 4 && cardEntry && entry.seat) {
    const c = chip(scene, textX, y, entry.seat, entry.seatIsViewer, textWidth);
    // The name beside the chip when both fit on one line; under it when the chip would squeeze it to a sliver.
    const nameWidth = scene.add.text(0, 0, headlineText, headlineStyle).setVisible(false);
    const measured = nameWidth.width;
    nameWidth.destroy();
    stacked = recapNamePlacement(c, measured, textWidth) === "below";
    if (stacked) y += 17 + 4;
    else headX = textX + c + 8;
  }
  const headline = scene.add
    .text(headX, y, headlineText, headlineStyle)
    .setOrigin(0, 0)
    .setWordWrapWidth(textWidth - (headX - textX));
  y += Math.max(headline.height, step === 4 && cardEntry && entry.seat && !stacked ? 18 : 0) + 3;
  if (entry.detail) y += body(entry.detail, inkColor, ink.secondary).height + 3;
  for (const effect of entry.effects) y += body(sentence(effect)).height + 3;
  for (const response of entry.responses) y += drawResponse(scene, textX, y, textWidth, response, phone) + 3;
  if (step === 4 && cardEntry && entry.responses.length === 0) {
    y += body("No responses", inkColor, ink.meta).height + 3;
  }

  const bottom = Math.max(y - 3, thumbsBottom) + PAD;
  bg.fillStyle(surface.paper.hex, 1).fillRect(slot.x, slot.y, slot.width, bottom - slot.y);
  return bottom - slot.y;
}

/**
 * A seat chip: black for the viewer, blue for another hero. Returns its width. A hero name that will not fit even alone
 * loses its parenthetical ("SPIDER-MAN (PETER PARKER)" is "SPIDER-MAN"), then steps down in size.
 */
function chip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  isViewer: boolean,
  maxWidth: number = Number.POSITIVE_INFINITY,
): number {
  const bg = scene.add.graphics();
  const t = scene.add
    .text(x + 6, y + 2, text.toUpperCase(), textStyle({ ...typeRole.label, size: 9 }, surface.paper.hex))
    .setOrigin(0, 0);
  if (t.width + 12 > maxWidth) t.setText(text.replace(/\s*\([^)]*\)/, "").toUpperCase());
  if (t.width + 12 > maxWidth) fitText(t, Math.max(20, maxWidth - 12), 9);
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
function drawThumb(scene: Phaser.Scene, rect: Rect, instanceId: InstanceId, game: GameState, face?: CardFace): void {
  noteHoverCard(scene, instanceId, rect);
  const fill = scene.add.graphics();
  fill.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  fill.lineStyle(border.detail, surface.ink.hex, 1);
  fill.strokeRect(rect.x, rect.y, rect.width, rect.height);
  const card = cardOf(game, instanceId);
  // The face in play: a villain's and a main scheme's picture lives on its stage or side, not on a "front".
  const source = artFor(card, face ?? faceOf(game, instanceId));
  const key = cardArt(scene).request(scene, source);
  if (!drawArt(scene, key, rect)) {
    scene.add
      .text(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        isHiddenArt(source) ? "" : (card?.name ?? ""),
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
