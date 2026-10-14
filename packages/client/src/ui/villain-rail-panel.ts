/**
 * Paints the docked villain phase (D1/D2 rail on desktop) into a scene: header, the five steps, the encounter strip and
 * the revealed card, "happening now", the inline interrupt window, the phase log and the AUTO-ADVANCE footer.
 *
 * Geometry is `view/villain-rail-layout.ts`'s, the data is the scene's (read off the walkthrough and the engine state);
 * this file only paints and wires the callbacks it is given, the way `ui/villain-recap-panel.ts` does for the recap.
 */
import type Phaser from "phaser";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { cardOf } from "@mc/engine";
import { artFor, type ArtSource } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { POOL_DEPS } from "../content/pool.js";
import type { FocusStop } from "../scenes/focus-route.js";
import type { VillainAutoAdvance } from "../settings.js";
import { accent, border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { abilityFaceOf } from "../view/board-model.js";
import { abilityFirst } from "../view/choice-source-panel.js";
import { inspectModel, triggerLabel } from "../view/inspect-model.js";
import type { Rect } from "../view/layout.js";
import type { RevealedStep } from "../view/villain-phase-reveal.js";
import { stepCaptionOf } from "../view/villain-phase-reveal.js";
import type { EncounterStrip } from "../view/villain-encounter-strip.js";
import type { VillainRailInterruptLayout, VillainRailLayout } from "../view/villain-rail-layout.js";
import {
  inlineConfirmLabel,
  inlinePickLabel,
  inlineSingle,
  interruptActionLabel,
  windowTitleOf,
  type InlineInterruptOption,
  type Pause,
} from "../view/villain-walkthrough.js";
import { bindHoldTarget } from "./hold-target.js";
import { textStyle } from "./theme.js";
import { McButton, fitText, label } from "./widgets.js";

/** What the body shows: the encounter card being revealed (D2), or the activation / narration happening now (D1). */
export type RailBody =
  | {
      readonly kind: "reveal";
      readonly instanceId: InstanceId;
      /** "BOOST 1 · DEALT TO YOU". */
      readonly footnote: string;
    }
  | {
      readonly kind: "happening";
      /** The enemy whose activation this is, for the thumbnail; null outside an activation. */
      readonly enemyInstanceId: InstanceId | null;
      readonly headline: string;
      readonly text: string;
      /** Boost cards flipped so far, by name ("1 boost card, facedown — flips after interrupts" before any). */
      readonly boostLine: string | null;
    };

export interface RailInterrupt {
  readonly options: readonly InlineInterruptOption[];
  readonly pause: Pause;
  readonly picks: readonly string[];
  readonly onPick: (optionId: string) => void;
  readonly onResolve: (optionIds: readonly string[]) => void;
}

export interface RailPanelArgs {
  readonly layout: VillainRailLayout;
  readonly game: GameState;
  readonly viewerId: PlayerId;
  readonly round: number;
  readonly subtitle: string;
  readonly steps: readonly RevealedStep[];
  /** True while the walkthrough is paused on a decision: a step caption then reads the pause, not a stale result. */
  readonly paused: boolean;
  readonly strip: EncounterStrip | null;
  readonly body: RailBody;
  readonly interrupt: RailInterrupt | null;
  /** The phase log, most recent first: step number and text. */
  readonly log: readonly { readonly step: number; readonly text: string }[];
  /** Next card, while the reveal is held on an encounter card ("Hold encounter cards"); null otherwise. */
  readonly onNext: (() => void) | null;
  readonly autoAdvance: VillainAutoAdvance;
  readonly buttons: McButton[];
  readonly onSkip: () => void;
  readonly onHide: () => void;
  readonly onToggle: () => void;
  readonly onInspect: (instanceId: InstanceId) => void;
}

export function drawVillainRailPanel(scene: Phaser.Scene, args: RailPanelArgs): Map<string, FocusStop> {
  const { layout } = args;
  const stops = new Map<string, FocusStop>();
  const { panel } = layout;

  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
  // The rail is ruled off from the table on its left edge (D1); the band and the tab are framed (T1, T2).
  if (layout.kind === "rail") g.fillStyle(surface.paper.hex, 1).fillRect(panel.x, panel.y, border.object, panel.height);
  else g.lineStyle(border.object, surface.paper.hex, 1).strokeRect(panel.x, panel.y, panel.width, panel.height);

  const title = scene.add
    .text(
      layout.title.x,
      layout.title.y + layout.title.height / 2,
      `VILLAIN PHASE — ROUND ${args.round}`,
      textStyle({ ...typeRole.screenTitle }, accent.heroRed.hex),
    )
    .setOrigin(0, 0.5)
    .setLetterSpacing(1);
  fitText(title, layout.title.width, 40);

  const button = (key: string, text: string, rect: Rect, onClick: () => void): void => {
    args.buttons.push(new McButton(scene, { kind: "onInk", label: text, type: typeRole.label, rect, onClick }));
    stops.set(key, { rect, activate: onClick });
  };
  button("skip", "Skip", layout.skip, args.onSkip);
  button("hide", "Hide ▸", layout.hide, args.onHide);

  if (layout.subtitle.width > 0) drawSubtitle(scene, layout, args.subtitle);

  drawSteps(scene, layout, args.steps, args.paused);
  if (args.strip && layout.encounterLabel && layout.encounterStrip) {
    drawStrip(scene, layout.encounterLabel, layout.encounterStrip, args.strip);
  }
  if (args.body.kind === "reveal") drawReveal(scene, layout, args, args.body, stops);
  else drawHappening(scene, layout, args, args.body);
  if (args.interrupt && layout.interrupt) drawInterrupt(scene, layout.interrupt, args, args.interrupt, stops);
  drawLog(scene, layout.log, args.log);
  drawFooter(scene, layout, args.autoAdvance, args.onToggle);
  stops.set("toggle", { rect: layout.toggle, activate: args.onToggle });
  return stops;
}

function drawSubtitle(scene: Phaser.Scene, layout: VillainRailLayout, text: string): void {
  const subtitle = label(
    scene,
    layout.subtitle.x,
    layout.subtitle.y + 4,
    text,
    { ...typeRole.label, size: 11 },
    surface.paper.hex,
    ink.secondary,
  );
  fitText(subtitle, layout.subtitle.width, 11);
}

function chipColors(status: RevealedStep["revealStatus"]): { fill: number; alpha: number; text: number } {
  switch (status) {
    case "done":
      return { fill: signal.heal.hex, alpha: 1, text: ink.body };
    case "active":
      return { fill: accent.heroRed.hex, alpha: 1, text: ink.body };
    default:
      return { fill: surface.ink.hex, alpha: 0, text: ink.disabled };
  }
}

function drawSteps(
  scene: Phaser.Scene,
  layout: VillainRailLayout,
  steps: readonly RevealedStep[],
  paused: boolean,
): void {
  steps.forEach((step, i) => {
    const rect = layout.steps[i];
    if (!rect) return;
    const colors = chipColors(step.revealStatus);
    const g = scene.add.graphics();
    if (colors.alpha > 0) g.fillStyle(colors.fill, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(border.control, step.revealStatus === "pending" ? surface.paper.hex : colors.fill, 1);
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);
    if (step.revealStatus === "pending") g.setAlpha(0.35);
    const textAlpha = colors.text;

    if (layout.stepMode === "chips") {
      const text =
        step.revealStatus === "done"
          ? `${step.number} ✓`
          : step.revealStatus === "active"
            ? `${step.number} ${shortTitle(step.kind)}`
            : String(step.number);
      const chip = scene.add
        .text(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          text.toUpperCase(),
          textStyle({ ...typeRole.label, size: 11 }, surface.paper.hex, textAlpha),
        )
        .setOrigin(0.5);
      fitText(chip, rect.width - 8, 11);
      return;
    }

    const heading = scene.add
      .text(
        rect.x + 14,
        rect.y + rect.height / 2,
        `${step.number} · ${step.title}`,
        textStyle({ ...typeRole.rowTitle, size: 14 }, surface.paper.hex, textAlpha),
      )
      .setOrigin(0, 0.5);
    const caption =
      step.revealStatus === "active"
        ? "NOW"
        : step.revealStatus === "done"
          ? `${stepCaptionOf(step.beats, paused) || "Done"} ✓`
          : "";
    if (caption) {
      const right = scene.add
        .text(
          rect.x + rect.width - 14,
          rect.y + rect.height / 2,
          caption,
          textStyle(
            step.revealStatus === "active" ? { ...typeRole.label, size: 11 } : { ...typeRole.rowTitle, size: 12 },
            surface.paper.hex,
          ),
        )
        .setOrigin(1, 0.5);
      const room = rect.width - 28 - heading.width - 16;
      if (room < 40) right.setVisible(false);
      else fitText(right, room, step.revealStatus === "active" ? 11 : 12);
    }
  });
}

const SHORT_TITLES: Record<string, string> = {
  placeThreat: "Threat",
  enemyActivations: "Activate",
  dealEncounterCards: "Deal",
  revealEncounterCards: "Reveal",
  passFirstPlayer: "Pass",
};
const shortTitle = (kind: string): string => SHORT_TITLES[kind] ?? "";

function drawStrip(scene: Phaser.Scene, labelRect: Rect, stripRect: Rect, strip: EncounterStrip): void {
  const counter = strip.position
    ? scene.add
        .text(
          labelRect.x + labelRect.width,
          labelRect.y + labelRect.height,
          `${strip.position.index} OF ${strip.position.total}`,
          textStyle({ ...typeRole.barTitle, size: 26 }, surface.paper.hex),
        )
        .setOrigin(1, 1)
    : null;
  const headingRoom = labelRect.width - (counter ? counter.width + 10 : 0);
  // The full words where they fit; the tablet band's narrow column takes the short form.
  const heading = label(
    scene,
    labelRect.x,
    labelRect.y + 6,
    "Encounter cards this round",
    { ...typeRole.label, size: 11 },
    surface.paper.hex,
    ink.secondary,
  );
  if (heading.width > headingRoom) heading.setText("ENCOUNTER CARDS");
  if (heading.width > headingRoom) fitText(heading, headingRoom, 11);
  if (strip.tiles.length === 0) return;
  // A strip with room for two tiles or more stacks them (the tablet band's narrow column); otherwise they sit in a row.
  const tileHeight = 48;
  const vertical = stripRect.height >= tileHeight * 2 + 8;
  const gap = vertical ? 8 : 12;
  const room = vertical ? Math.floor((stripRect.height + gap) / (tileHeight + gap)) : 3;
  const shown = Math.min(strip.tiles.length, Math.max(1, room));
  const more = strip.tiles.length - shown;
  const moreWidth = more > 0 && !vertical ? 44 : 0;
  const tileWidth = vertical ? stripRect.width : (stripRect.width - moreWidth - gap * (shown - 1)) / shown;
  // Keep the card being revealed in view: the window slides so "now" is never past the last tile shown.
  const nowIndex = strip.tiles.findIndex((tile) => tile.status === "now");
  const start = Math.max(0, Math.min(strip.tiles.length - shown, nowIndex - (shown - 1)));
  strip.tiles.slice(start, start + shown).forEach((tile, i) => {
    const rect: Rect = vertical
      ? { x: stripRect.x, y: stripRect.y + i * (tileHeight + gap), width: tileWidth, height: tileHeight }
      : { x: stripRect.x + i * (tileWidth + gap), y: stripRect.y, width: tileWidth, height: stripRect.height };
    const live = tile.status === "now";
    const g = scene.add.graphics();
    g.lineStyle(border.control, surface.paper.hex, live ? 1 : 0.45);
    g.strokeRect(rect.x, rect.y, rect.width, rect.height);
    const swatch: Rect = { x: rect.x + 10, y: rect.y + 10, width: 28, height: rect.height - 20 };
    if (tile.status === "facedown" || tile.status === "next") {
      g.lineStyle(border.detail, surface.paper.hex, 0.6);
      g.strokeRect(swatch.x, swatch.y, swatch.width, swatch.height);
    } else {
      g.fillStyle(live ? accent.heroRed.hex : signal.spent.hex, 1).fillRect(
        swatch.x,
        swatch.y,
        swatch.width,
        swatch.height,
      );
    }
    label(scene, swatch.x + swatch.width + 10, rect.y + 10, tile.seat, typeRole.label, surface.paper.hex, ink.label);
    const status =
      tile.status === "now" ? "now" : tile.status === "next" ? "next" : tile.status === "done" ? "done" : "";
    const line = scene.add
      .text(
        swatch.x + swatch.width + 10,
        rect.y + rect.height - 10,
        status ? `${tile.name} · ${status}` : tile.name,
        textStyle({ ...typeRole.rowTitle, size: 13 }, surface.paper.hex, live ? ink.body : ink.secondary),
      )
      .setOrigin(0, 1);
    fitText(line, rect.x + rect.width - (swatch.x + swatch.width + 10) - 8, 13);
  });
  if (more > 0 && !vertical) {
    label(
      scene,
      stripRect.x + stripRect.width - moreWidth + 6,
      stripRect.y + stripRect.height / 2 - 6,
      `+${more}`,
      { ...typeRole.label, size: 12 },
      surface.paper.hex,
      ink.secondary,
    );
  }
}

/** A card's scan in `rect` with a tap/hold to Inspect, or a labelled blank when the scan is missing. */
function drawCard(
  scene: Phaser.Scene,
  rect: Rect,
  game: GameState,
  instanceId: InstanceId,
  onInspect: (instanceId: InstanceId) => void,
  key: string,
  source: ArtSource | null,
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const g = scene.add.graphics();
  g.fillStyle(signal.spent.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  const art = cardArt(scene).request(scene, source);
  if (!drawArt(scene, art, rect)) {
    const name = scene.add
      .text(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        cardOf(game, instanceId)?.name ?? "",
        textStyle({ ...typeRole.rowTitle, size: 13 }, surface.paper.hex, ink.secondary),
      )
      .setOrigin(0.5)
      .setAlign("center")
      .setWordWrapWidth(rect.width - 12);
    name.setMaxLines(4);
  }
  g.lineStyle(border.object, surface.paper.hex, 1);
  g.strokeRect(rect.x, rect.y, rect.width, rect.height);
  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  const open = (): void => onInspect(instanceId);
  bindHoldTarget(scene, zone, { key, onTap: open, onInspect: open });
}

/** A stamped tag ("TREACHERY", "HERO ABILITY"); returns its width so tags can sit in a row. */
function tag(scene: Phaser.Scene, x: number, y: number, text: string, filled: boolean, color: number): number {
  // The ground goes down first so the text draws over it; it is sized once the text has been measured.
  const g = scene.add.graphics();
  const t = scene.add
    .text(
      x + 8,
      y + 3,
      text.toUpperCase(),
      textStyle({ ...typeRole.label, size: 10 }, filled ? surface.ink.hex : color),
    )
    .setOrigin(0, 0);
  const width = t.width + 16;
  if (filled) g.fillStyle(color, 1).fillRect(x, y, width, t.height + 6);
  else g.lineStyle(border.detail, color, 1).strokeRect(x, y, width, t.height + 6);
  return width;
}

function drawReveal(
  scene: Phaser.Scene,
  layout: VillainRailLayout,
  args: RailPanelArgs,
  body: Extract<RailBody, { kind: "reveal" }>,
  stops: Map<string, FocusStop>,
): void {
  if (layout.body.height <= 0) return;
  const model = inspectModel(args.game, body.instanceId, null, args.viewerId, POOL_DEPS);
  drawCard(scene, layout.bodyArt, args.game, body.instanceId, args.onInspect, `reveal:${body.instanceId}`, model.art);
  const { x, y, width, height } = layout.bodyText;
  const name = scene.add
    .text(x, y, model.name.toUpperCase(), textStyle({ ...typeRole.barTitle, size: 34 }, surface.paper.hex))
    .setOrigin(0, 0);
  fitText(name, width, 34);
  let cursor = y + name.height + 6;
  let tx = x;
  for (const [i, part] of model.typeLine.split(" · ").slice(0, 2).entries()) {
    tx += tag(scene, tx, cursor, part, i === 0, surface.paper.hex) + 6;
  }
  cursor += 28;
  const next = args.onNext;
  const nextHeight = next ? hit.target : 0;
  const footnoteHeight = 18 + (next ? nextHeight + 8 : 0);
  const rules = scene.add
    .text(x, cursor, model.rulesText, textStyle({ ...typeRole.body, size: 14 }, surface.paper.hex))
    .setOrigin(0, 0)
    .setWordWrapWidth(width);
  const lineHeight = rules.height / Math.max(1, rules.getWrappedText(model.rulesText).length);
  const lines = Math.max(1, Math.floor((y + height - footnoteHeight - 8 - cursor) / lineHeight));
  if (rules.getWrappedText(model.rulesText).length > lines) {
    rules.setMaxLines(Math.max(1, lines - 1));
    label(
      scene,
      x,
      cursor + Math.max(1, lines - 1) * lineHeight,
      "Tap the card to read it all",
      typeRole.label,
      surface.paper.hex,
      ink.label,
    );
  }
  label(
    scene,
    x,
    y + height - footnoteHeight,
    body.footnote,
    { ...typeRole.label, size: 10 },
    surface.paper.hex,
    ink.label,
  );
  if (next) {
    const rect: Rect = { x, y: y + height - nextHeight, width: Math.min(width, 200), height: nextHeight };
    args.buttons.push(
      new McButton(scene, { kind: "onInk", label: "Next card ▸", type: typeRole.label, rect, onClick: next }),
    );
    stops.set("next", { rect, activate: next });
  }
}

function drawHappening(
  scene: Phaser.Scene,
  layout: VillainRailLayout,
  args: RailPanelArgs,
  body: Extract<RailBody, { kind: "happening" }>,
): void {
  if (layout.body.height <= 0) return;
  const hasArt = body.enemyInstanceId !== null && layout.bodyArt.width > 0;
  if (hasArt) {
    const enemy = body.enemyInstanceId!;
    const art = inspectModel(args.game, enemy, null, args.viewerId, POOL_DEPS).art;
    drawCard(scene, layout.bodyArt, args.game, enemy, args.onInspect, `happening:${enemy}`, art);
  }
  const x = hasArt ? layout.bodyText.x : layout.body.x;
  const width = hasArt ? layout.bodyText.width : layout.body.width;
  const { y, height } = layout.bodyText;
  label(scene, x, y, "Happening now", { ...typeRole.label, size: 11 }, surface.paper.hex, ink.secondary);
  const headline = scene.add
    .text(x, y + 18, body.headline.toUpperCase(), textStyle({ ...typeRole.barTitle, size: 30 }, surface.paper.hex))
    .setOrigin(0, 0)
    .setWordWrapWidth(width)
    .setMaxLines(2);
  fitText(headline, width, 30);
  let cursor = headline.y + headline.height + 6;
  if (body.text) {
    const text = scene.add
      .text(x, cursor, body.text, textStyle({ ...typeRole.body, size: 14 }, surface.paper.hex, ink.secondary))
      .setOrigin(0, 0)
      .setWordWrapWidth(width);
    const lineHeight = text.height / Math.max(1, text.getWrappedText(body.text).length);
    const room = y + height - cursor - (body.boostLine ? 40 : 0);
    text.setMaxLines(Math.max(1, Math.floor(room / lineHeight)));
    cursor += Math.min(text.height, room) + 8;
  }
  if (body.boostLine && cursor + 30 <= y + height) {
    const box: Rect = { x, y: cursor, width: 26, height: 34 };
    const g = scene.add.graphics();
    g.lineStyle(border.detail, surface.paper.hex, 0.7).strokeRect(box.x, box.y, box.width, box.height);
    scene.add
      .text(
        box.x + box.width / 2,
        box.y + box.height / 2,
        "?",
        textStyle({ ...typeRole.barTitle, size: 18 }, surface.paper.hex),
      )
      .setOrigin(0.5);
    scene.add
      .text(
        box.x + box.width + 10,
        box.y + box.height / 2,
        body.boostLine.toUpperCase(),
        textStyle({ ...typeRole.label, size: 10 }, surface.paper.hex, ink.secondary),
      )
      .setOrigin(0, 0.5)
      .setWordWrapWidth(width - box.width - 10)
      .setMaxLines(2);
  }
}

function drawInterrupt(
  scene: Phaser.Scene,
  layout: VillainRailInterruptLayout,
  args: RailPanelArgs,
  interrupt: RailInterrupt,
  stops: Map<string, FocusStop>,
): void {
  const { frame } = layout;
  const { game, viewerId } = args;
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(frame.x, frame.y, frame.width, frame.height);
  g.lineStyle(border.object, signal.caution.hex, 1).strokeRect(frame.x, frame.y, frame.width, frame.height);
  label(
    scene,
    layout.title.x,
    layout.title.y,
    windowTitleOf(interrupt.pause.timing),
    { ...typeRole.label, size: 11 },
    signal.caution.hex,
    ink.body,
  );

  const { options } = interrupt;
  const multi = !inlineSingle(options);
  const picks = interrupt.picks;
  const first = options[0]!;
  const face = abilityFaceOf(game, first.instanceId, first.abilityId);
  const firstArt = artFor(cardOf(game, first.instanceId), face);
  drawCard(scene, layout.card, game, first.instanceId, args.onInspect, `interrupt:${first.optionId}`, firstArt);
  if (layout.card.width > 0) {
    scene.add
      .graphics()
      .lineStyle(border.object, signal.caution.hex, 1)
      .strokeRect(layout.card.x, layout.card.y, layout.card.width, layout.card.height);
  }

  // Name, tags and the ability on offer, beside the card.
  const model = inspectModel(game, first.instanceId, null, viewerId, POOL_DEPS, { face });
  const { x, y, width, height } = layout.text;
  const inHand = game.players.some((player) => player.hand.includes(first.instanceId));
  const name = scene.add
    .text(
      x,
      y,
      first.abilityId ? abilityName(game, first) : model.name,
      textStyle({ ...typeRole.rowTitle, size: 18 }, surface.paper.hex),
    )
    .setOrigin(0, 0);
  fitText(name, width, 18);
  let cursor = y + name.height + 6;
  let tx = x;
  const kindTag = first.abilityId
    ? inHand
      ? "Card ability"
      : "Hero ability"
    : (model.typeLine.split(" · ")[0] ?? "Card");
  const costTag = model.cost !== null && inHand ? `${kindTag} · cost ${model.currentCost ?? model.cost}` : kindTag;
  tx += tag(scene, tx, cursor, costTag, true, signal.caution.hex) + 6;
  tag(scene, tx, cursor, inHand ? "From your hand" : first.abilityId ? "In play" : "Free", false, surface.paper.hex);
  cursor += 30;
  const trigger = first.abilityId ? POOL_DEPS.abilities[first.abilityId]?.trigger : undefined;
  const rulesText = trigger ? abilityFirst(model.rulesText, triggerLabel(trigger)) : model.rulesText;
  const toggleHeight = multi ? 40 : 0;
  const rules = scene.add
    .text(x, cursor, rulesText, textStyle({ ...typeRole.body, size: 13 }, surface.paper.hex))
    .setOrigin(0, 0)
    .setWordWrapWidth(width);
  const lineHeight = rules.height / Math.max(1, rules.getWrappedText(rulesText).length);
  const lines = Math.floor((y + height - toggleHeight - cursor) / lineHeight);
  if (lines < 1) rules.setVisible(false);
  else if (rules.getWrappedText(rulesText).length > lines) rules.setMaxLines(lines);

  const pickButton = (option: InlineInterruptOption, rect: Rect): void => {
    const onClick = (): void => interrupt.onPick(option.optionId);
    args.buttons.push(
      new McButton(scene, {
        kind: "onInk",
        label: inlinePickLabel(interruptActionLabel(game, option), picks, option.optionId),
        type: typeRole.label,
        rect,
        selected: picks.includes(option.optionId),
        onClick,
      }),
    );
    stops.set(`interrupt:${option.optionId}`, { rect, activate: onClick });
  };
  if (multi) {
    pickButton(first, { x, y: y + height - toggleHeight + 2, width, height: toggleHeight - 4 });
    options.slice(1, 1 + layout.extraRows.length).forEach((option, i) => {
      const row = layout.extraRows[i]!;
      const nameWidth = row.width * 0.45;
      const optionName = scene.add
        .text(
          row.x,
          row.y + row.height / 2,
          cardOf(game, option.instanceId)?.name ?? "",
          textStyle({ ...typeRole.rowTitle, size: 14 }, surface.paper.hex),
        )
        .setOrigin(0, 0.5);
      fitText(optionName, nameWidth - 8, 14);
      pickButton(option, { x: row.x + nameWidth, y: row.y, width: row.width - nameWidth, height: row.height });
    });
  }

  const use = (): void => interrupt.onResolve(multi ? picks : [first.optionId]);
  const useLabel = multi ? inlineConfirmLabel(game, options, picks) : interruptActionLabel(game, first);
  args.buttons.push(
    new McButton(scene, {
      kind: "primary",
      label: useLabel,
      type: { ...typeRole.barTitle, size: 26 },
      rect: layout.use,
      tint: { fill: signal.caution.hex, ink: surface.ink.hex },
      enabled: !multi || picks.length > 0,
      onClick: use,
    }),
  );
  if (!multi) stops.set(`interrupt:${first.optionId}`, { rect: layout.use, activate: use });
  else stops.set("confirm", { rect: layout.use, activate: use });
  const letItResolve = (): void => interrupt.onResolve([]);
  args.buttons.push(
    new McButton(scene, {
      kind: "onInk",
      label: "Let it resolve ▸",
      type: { ...typeRole.label, size: 12 },
      rect: layout.resolve,
      onClick: letItResolve,
    }),
  );
  stops.set("resolve", { rect: layout.resolve, activate: letItResolve });
}

/** "Spider-Sense": the printed name of the ability on offer, else the card's. */
function abilityName(game: GameState, option: InlineInterruptOption): string {
  const label = interruptActionLabel(game, option);
  return label.replace(/^(Use|Play) /, "");
}

function drawLog(scene: Phaser.Scene, rect: Rect, log: RailPanelArgs["log"]): void {
  if (rect.height <= 0) return;
  label(scene, rect.x, rect.y, "Phase log", { ...typeRole.label, size: 11 }, surface.paper.hex, ink.label);
  let y = rect.y + 22;
  for (const entry of log) {
    if (y + 18 > rect.y + rect.height) break;
    label(scene, rect.x, y, `${entry.step} ·`, { ...typeRole.label, size: 11 }, surface.paper.hex, ink.meta);
    const line = scene.add
      .text(rect.x + 24, y - 1, entry.text, textStyle({ ...typeRole.body, size: 13 }, surface.paper.hex, ink.secondary))
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width - 24)
      .setMaxLines(2);
    if (line.y + line.height > rect.y + rect.height) {
      line.setMaxLines(1);
    }
    y += line.height + 6;
  }
}

function drawFooter(
  scene: Phaser.Scene,
  layout: VillainRailLayout,
  mode: VillainAutoAdvance,
  onToggle: () => void,
): void {
  const { footer, toggle } = layout;
  const g = scene.add.graphics();
  const text = layout.footerText;
  if (text) {
    g.fillStyle(surface.paper.hex, 0.25).fillRect(footer.x + border.object, footer.y, footer.width - border.object, 1);
    drawFooterText(scene, text, mode);
  }
  drawToggle(scene, toggle, mode, onToggle);
}

function drawFooterText(scene: Phaser.Scene, rect: Rect, mode: VillainAutoAdvance): void {
  const x = rect.x;
  label(scene, x, rect.y + 6, "Auto-advance", { ...typeRole.label, size: 12 }, surface.paper.hex, ink.body);
  label(
    scene,
    x,
    rect.y + 26,
    mode === "off" ? "Off: the recap waits for you." : "On: the recap closes on its own.",
    { ...typeRole.body, size: 12, uppercase: false },
    surface.paper.hex,
    ink.secondary,
  );
}

/** AUTO-ADVANCE OFF | ON, the side in force filled in paper. */
function drawToggle(scene: Phaser.Scene, toggle: Rect, mode: VillainAutoAdvance, onToggle: () => void): void {
  const on = mode !== "off";
  const half = toggle.width / 2;
  const tg = scene.add.graphics();
  tg.fillStyle(on ? surface.ink.hex : surface.paper.hex, 1).fillRect(toggle.x, toggle.y, half, toggle.height);
  tg.fillStyle(on ? surface.paper.hex : surface.ink.hex, 1).fillRect(toggle.x + half, toggle.y, half, toggle.height);
  tg.lineStyle(border.control, surface.paper.hex, 1).strokeRect(toggle.x, toggle.y, toggle.width, toggle.height);
  const spec = { ...typeRole.label, size: 12 };
  scene.add
    .text(
      toggle.x + half / 2,
      toggle.y + toggle.height / 2,
      "OFF",
      textStyle(spec, on ? surface.paper.hex : surface.ink.hex, on ? ink.meta : ink.body),
    )
    .setOrigin(0.5);
  scene.add
    .text(
      toggle.x + half * 1.5,
      toggle.y + toggle.height / 2,
      "ON",
      textStyle(spec, on ? surface.ink.hex : surface.paper.hex, on ? ink.body : ink.meta),
    )
    .setOrigin(0.5);
  const zone = scene.add
    .zone(toggle.x, toggle.y, toggle.width, toggle.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on("pointerup", onToggle);
}
