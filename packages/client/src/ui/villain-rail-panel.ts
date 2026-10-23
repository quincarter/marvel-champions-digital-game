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
import { artFor, CARD_BACKS, isHiddenArt, type ArtSource, type CardFace } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { flipLabel } from "../view/villain-phase-reveal.js";
import { drawFlipCard } from "./flip-card.js";
import { POOL_DEPS } from "../content/pool.js";
import type { FocusStop } from "../scenes/focus-route.js";
import type { VillainAutoAdvance } from "../settings.js";
import { accent, border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { abilityFaceOf } from "../view/board-model.js";
import { abilityFirst } from "../view/choice-source-panel.js";
import { inspectModel, triggerLabel } from "../view/inspect-model.js";
import type { Rect } from "../view/layout.js";
import { preventedAmountLine, type PreventionPreview } from "../view/interrupt-prevention.js";
import { BOOST_THUMB_HEIGHT, boostThumbsLayout } from "../view/villain-phase-boosts.js";
import { isLandscapeCard } from "../view/civil-war-builder-art.js";
import type { RevealedStep } from "../view/villain-phase-reveal.js";
import { stepCaptionOf } from "../view/villain-phase-reveal.js";
import type { EncounterStrip } from "../view/villain-encounter-strip.js";
import type { VillainRailInterruptLayout, VillainRailLayout } from "../view/villain-rail-layout.js";
import {
  inlineConfirmLabel,
  inlinePickLabel,
  inlineSingle,
  interruptActionLabel,
  offeredFrom,
  windowTitleOf,
  type InlineInterruptOption,
  type Pause,
} from "../view/villain-walkthrough.js";
import { noteHoverCard } from "./card-hover-preview.js";
import { shortSeatName } from "../view/names.js";
import { drawSeatAvatar } from "./seat-avatar.js";
import { bindHoldTarget } from "./hold-target.js";
import { textStyle } from "./theme.js";
import { McButton, fitText, fitWrapped, label } from "./widgets.js";

/** What the body shows: the encounter card being revealed (D2), or the activation / narration happening now (D1). */
export type RailBody =
  | {
      readonly kind: "reveal";
      readonly instanceId: InstanceId;
      /** "BOOST 1 · DEALT TO YOU". */
      readonly footnote: string;
      /**
       * A card the player was dealt facedown (#287): its back where the face goes and no name or rules yet, waiting on
       * Flip Encounter Card (`elapsedMs` null) or turning over (`elapsedMs` since the press).
       */
      readonly flip?: {
        readonly elapsedMs: number | null;
        /** How long the turn takes, from `settings.flipEncounterSpeed`. */
        readonly durationMs: number;
        /** The same player's cards still facedown behind this one, in deal order (the next to flip is up front). */
        readonly waiting: number;
      };
    }
  | {
      readonly kind: "happening";
      /** The enemy whose activation this is, for the thumbnail; null outside an activation. */
      readonly enemyInstanceId: InstanceId | null;
      /** The face to draw for that enemy when it was facedown and has left play since (#291); absent otherwise. */
      readonly enemyFace?: CardFace;
      readonly headline: string;
      readonly text: string;
      /** `text` with the breakdown's total first, drawn instead where `text` would be cut (#394); absent without one. */
      readonly cutText?: string;
      /** Boost cards flipped so far, by name ("1 boost card, facedown — flips after interrupts" before any). */
      readonly boostLine: string | null;
      /** The faceup boost cards flipped so far, drawn as cards beside the boost line (issue #172). */
      readonly boosts?: readonly InstanceId[];
      /** The one a boost-count window (Chaos Control, Scarlet Witch's Crest) is counting, framed; null otherwise. */
      readonly countedBoostId?: InstanceId | null;
    };

export interface RailInterrupt {
  readonly options: readonly InlineInterruptOption[];
  readonly pause: Pause;
  /** What the first option would prevent of the damage about to be dealt, for the green stamp (#394); null if none. */
  readonly prevention?: PreventionPreview | null;
  readonly picks: readonly string[];
  readonly onPick: (optionId: string) => void;
  readonly onResolve: (optionIds: readonly string[]) => void;
}

/**
 * The window in the interrupt window's place while the phase waits on the player for something that is not an
 * interrupt (the owner's call, 2026-10-14): START VILLAIN PHASE before anything plays, or a decision someone has to make
 * (a revealed card's choice, a defender) announced with ANSWER, which opens its sheet. Never both.
 */
export type RailGate =
  | {
      readonly kind: "start";
      /** What ended the player phase ("You drew 3 cards: …"), said first; empty when nothing did. */
      readonly lead: string;
      readonly onPress: () => void;
    }
  | {
      readonly kind: "decision";
      /** "SONIC BOOM · CAPTAIN MARVEL DECIDES". */
      readonly title: string;
      /** What there is to decide, in the pause's own words. */
      readonly text: string;
      /** The card the decision is about (the revealed card, the attacking enemy); null when there is none. */
      readonly cardInstanceId: InstanceId | null;
      readonly onPress: () => void;
    };

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
  /** START or ANSWER, drawn where the interrupt window goes (`layout.interrupt`); null when neither waits. */
  readonly gate?: RailGate | null;
  /** Hears the objects the gate drew, so the scene can slide a decision's notice in. */
  readonly onGateDrawn?: (objects: readonly Phaser.GameObjects.GameObject[]) => void;
  /** The phase log, most recent first: step number and text. */
  /** The phase log, most recent first; `step` is the step's number, or a word for what came before step 1 ("Draw"). */
  readonly log: readonly { readonly step: number | string; readonly text: string }[];
  /** Next card, while the reveal is held on an encounter card ("Hold encounter cards"); null otherwise. */
  readonly onNext: (() => void) | null;
  /** Flip Encounter Card, while the reveal waits on a facedown card (#287); null otherwise. */
  readonly onFlip?: (() => void) | null;
  readonly autoAdvance: VillainAutoAdvance;
  readonly buttons: McButton[];
  readonly onSkip: () => void;
  readonly onHide: () => void;
  readonly onToggle: () => void;
  readonly onInspect: (instanceId: InstanceId) => void;
}

/**
 * The last "happening now" drawn with both a breakdown and boost cards, and the body it was drawn in: kept for the e2e
 * specs (#285), since the beat can be gone again before a spec reads the screen.
 */
export const happeningDebug: {
  boosted: {
    readonly text: string;
    /** The lines actually drawn: `text`'s first lines, or its total-first form's when cut (#394). */
    readonly shown: string;
    readonly breakdown: Rect;
    /** True when the breakdown was cut short of its last line. */
    readonly cut: boolean;
    readonly boosts: readonly Rect[];
    readonly body: Rect;
  } | null;
} = { boosted: null };

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
      // The tab's header is narrow, and the round is already in the chrome beside it ("RD 1", P1).
      layout.kind === "tab" ? "VILLAIN PHASE" : `VILLAIN PHASE — ROUND ${args.round}`,
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
  button("hide", layout.kind === "tab" ? "Peek at table ▾" : "Hide ▸", layout.hide, args.onHide);

  if (layout.subtitle.width > 0) drawSubtitle(scene, layout, args.subtitle);

  drawSteps(scene, layout, args.steps, args.paused);
  if (args.strip && layout.encounterLabel && layout.encounterStrip) {
    drawStrip(scene, layout.encounterLabel, layout.encounterStrip, args.strip, args.game);
  }
  if (args.body.kind === "reveal") drawReveal(scene, layout, args, args.body, stops);
  else drawHappening(scene, layout, args, args.body, stops);
  if (args.interrupt && layout.interrupt) drawInterrupt(scene, layout.interrupt, args, args.interrupt, stops);
  else if (args.gate && layout.interrupt) {
    const from = scene.children.list.length;
    drawGate(scene, layout.interrupt, args, args.gate, stops);
    args.onGateDrawn?.(scene.children.list.slice(from));
  }
  drawLog(scene, layout.log, args.log);
  drawFooter(scene, layout, args.autoAdvance, args.onToggle);
  if (layout.toggle.width > 0) stops.set("toggle", { rect: layout.toggle, activate: args.onToggle });
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

function drawStrip(
  scene: Phaser.Scene,
  labelRect: Rect,
  stripRect: Rect,
  strip: EncounterStrip,
  game: GameState,
): void {
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
    // Whose card it is, as the hero's face: a hero's name did not fit a tile on a phone (the owner, 2026-10-14).
    const side = Math.max(0, rect.height - 12);
    const swatch: Rect = { x: rect.x + 6, y: rect.y + 6, width: side, height: side };
    const frame = live ? accent.heroRed.hex : tile.status === "done" ? surface.paper.hex : surface.paper.hex;
    drawSeatAvatar(scene, swatch, game, tile.playerId, frame, tile.status === "facedown" ? 0.6 : 1);
    if (tile.isViewer) {
      label(scene, swatch.x + swatch.width + 10, rect.y + 10, "YOU", typeRole.label, surface.paper.hex, ink.label);
    }
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
  noteHoverCard(scene, instanceId, rect);
  const g = scene.add.graphics();
  g.fillStyle(signal.spent.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  const art = cardArt(scene).request(scene, source);
  if (!drawArt(scene, art, rect)) {
    const name = scene.add
      .text(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        isHiddenArt(source) ? "" : (cardOf(game, instanceId)?.name ?? ""),
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

/** The stamp's tilt in degrees, rising to the right (the owner's pick, option D). */
const STAMP_ANGLE = -10;
/** The stamp's text and edge: white, as the owner asked, not the paper cream of the rest of the panel. */
const STAMP_INK = 0xffffff;

/**
 * The green stamp across the interrupt window's top-right corner (#394): "PREVENTS" over "2 DAMAGE", so the player sees
 * what the card saves before choosing. Built at the corner and returned with its left edge, which the window's title
 * must stop short of.
 */
function drawPreventionStamp(scene: Phaser.Scene, frame: Rect, preview: PreventionPreview): number {
  const small = scene.add
    .text(0, 0, "PREVENTS", textStyle({ ...typeRole.label, size: 11 }, STAMP_INK))
    .setOrigin(0.5, 1);
  const big = scene.add
    .text(0, 0, preventedAmountLine(preview).toUpperCase(), textStyle({ ...typeRole.barTitle, size: 22 }, STAMP_INK))
    .setOrigin(0.5, 0);
  const width = Math.max(small.width, big.width) + 24;
  const height = small.height + big.height + 8;
  small.setY(-height / 2 + 4 + small.height);
  big.setY(small.y);
  const ground = scene.add
    .graphics()
    .fillStyle(signal.heal.hex, 1)
    .fillRect(-width / 2, -height / 2, width, height)
    .lineStyle(border.detail, STAMP_INK, 1)
    .strokeRect(-width / 2, -height / 2, width, height);
  // Where the tilted stamp reaches, so it overhangs the window's corner by a little and never the panel's edge.
  const angle = (Math.abs(STAMP_ANGLE) * Math.PI) / 180;
  const reachX = (width * Math.cos(angle) + height * Math.sin(angle)) / 2;
  const centerX = frame.x + frame.width + 6 - reachX;
  scene.add.container(centerX, frame.y + 6, [ground, small, big]).setAngle(STAMP_ANGLE);
  return centerX - reachX;
}

/** How wide `tag` draws `text`. */
function tagWidth(scene: Phaser.Scene, text: string): number {
  const t = scene.add.text(0, 0, text.toUpperCase(), textStyle({ ...typeRole.label, size: 10 }, surface.paper.hex));
  const width = t.width + 16;
  t.destroy();
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
  if (body.flip) {
    // Facedown: the back, and no hover or inspect until it is turned (they would show the face).
    drawFlipCard(
      scene,
      layout.bodyArt,
      CARD_BACKS.encounter,
      model.art,
      model.name,
      body.flip.elapsedMs,
      body.flip.durationMs,
    );
    drawFacedownText(scene, layout, args, body, stops);
    return;
  }
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

/** The text beside a facedown encounter card: what it is, whose it is, and the Flip Encounter Card button. */
function drawFacedownText(
  scene: Phaser.Scene,
  layout: VillainRailLayout,
  args: RailPanelArgs,
  body: Extract<RailBody, { kind: "reveal" }>,
  stops: Map<string, FocusStop>,
): void {
  const { x, y, width, height } = layout.bodyText;
  const name = scene.add
    .text(x, y, "ENCOUNTER CARD", textStyle({ ...typeRole.barTitle, size: 34 }, surface.paper.hex))
    .setOrigin(0, 0);
  fitText(name, width, 34);
  tag(scene, x, y + name.height + 6, "Facedown", true, surface.paper.hex);
  const waiting = body.flip?.waiting ?? 0;
  if (waiting > 0) {
    // The cards still to come as a short row of backs, the front card being the one above (RRG p. 47: dealt order).
    const backHeight = Math.min(44, Math.max(24, height - name.height - 130));
    const backWidth = Math.round(backHeight * (63 / 88));
    const rowY = y + name.height + 40;
    const shown = Math.min(waiting, 4, Math.max(1, Math.floor((width - 90) / (backWidth * 0.6))));
    const backKey = cardArt(scene).request(scene, CARD_BACKS.encounter);
    for (let i = shown - 1; i >= 0; i--) {
      const rect: Rect = { x: x + i * backWidth * 0.6, y: rowY, width: backWidth, height: backHeight };
      if (!drawArt(scene, backKey, rect, { fit: "cover" })) {
        scene.add.graphics().fillStyle(signal.spent.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
      }
      scene.add
        .graphics()
        .lineStyle(border.detail, surface.paper.hex, 1)
        .strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    label(
      scene,
      x + (shown - 1) * backWidth * 0.6 + backWidth + 8,
      rowY + backHeight / 2 - 6,
      `+${waiting} WAITING`,
      { ...typeRole.label, size: 11 },
      surface.paper.hex,
      ink.secondary,
    );
  }
  const flip = args.onFlip;
  const flipHeight = flip ? hit.target : 0;
  label(
    scene,
    x,
    y + height - 18 - (flip ? flipHeight + 8 : 0),
    body.footnote,
    { ...typeRole.label, size: 10 },
    surface.paper.hex,
    ink.label,
  );
  if (flip && body.flip?.elapsedMs === null) {
    const rect: Rect = { x, y: y + height - flipHeight, width: Math.min(width, 240), height: flipHeight };
    args.buttons.push(
      new McButton(scene, {
        kind: "primary",
        label: flipLabel,
        type: typeRole.label,
        rect,
        tint: { fill: signal.caution.hex, ink: surface.ink.hex },
        onClick: flip,
      }),
    );
    stops.set("flip", { rect, activate: flip });
  }
}

function drawHappening(
  scene: Phaser.Scene,
  layout: VillainRailLayout,
  args: RailPanelArgs,
  body: Extract<RailBody, { kind: "happening" }>,
  stops: Map<string, FocusStop>,
): void {
  if (layout.body.height <= 0) return;
  const hasArt = body.enemyInstanceId !== null && layout.bodyArt.width > 0;
  if (hasArt) {
    const enemy = body.enemyInstanceId!;
    const art = body.enemyFace
      ? artFor(undefined, body.enemyFace)
      : inspectModel(args.game, enemy, null, args.viewerId, POOL_DEPS).art;
    drawCard(scene, layout.bodyArt, args.game, enemy, args.onInspect, `happening:${enemy}`, art);
  }
  const x = hasArt ? layout.bodyText.x : layout.body.x;
  const width = hasArt ? layout.bodyText.width : layout.body.width;
  const { y, height } = layout.bodyText;
  label(scene, x, y, "Happening now", { ...typeRole.label, size: 11 }, surface.paper.hex, ink.secondary);
  const headline = scene.add
    .text(x, y + 18, body.headline.toUpperCase(), textStyle({ ...typeRole.barTitle, size: 30 }, surface.paper.hex))
    .setOrigin(0, 0);
  // The breakdown goes under the headline, so it is measured first: the headline takes up to three lines of what the
  // breakdown (all its lines) and the boost card leave, two where that is all the room holds, and one (shrinking
  // first) where even two would push the boost card onto the breakdown (#285). The target ends the sentence and must
  // not be what is cut, and the damage total ends the breakdown.
  const detail = body.text
    ? scene.add
        .text(x, y, body.text, textStyle({ ...typeRole.body, size: 14 }, surface.paper.hex, ink.secondary))
        .setOrigin(0, 0)
        .setWordWrapWidth(width)
    : null;
  const detailLines = detail ? Math.max(1, detail.getWrappedText(body.text).length) : 0;
  const lineHeight = detail ? detail.height / detailLines : 0;
  // A faceup boost card is drawn as the card (tap or hover to read it), so the row is taller than the facedown "?".
  const faceup = body.boosts ?? [];
  const boostRow = body.boostLine ? (faceup.length > 0 ? BOOST_THUMB_HEIGHT + 6 : 40) : 0;
  const spare = height - 18 - 6 - (detail ? detailLines * lineHeight + 8 : 0) - boostRow;
  fitWrapped(headline, width, Math.max(1, Math.min(3, Math.floor(spare / 34))), 30);
  let cursor = headline.y + headline.height + 6;
  let detailShown = detailLines;
  if (detail) {
    detail.setY(cursor);
    // Whatever the breakdown is cut to, the boost row starts under what it shows, never on it (#285).
    const room = y + height - cursor - boostRow;
    detailShown = Math.max(1, Math.floor(room / lineHeight));
    detail.setMaxLines(detailShown);
    // Cut, the line would lose its end, the damage or threat total; the total-first wording keeps it (#394).
    if (detailShown < detailLines && body.cutText) detail.setText(body.cutText);
    cursor += detail.height + 8;
  }
  if (body.boostLine && cursor + 30 <= y + height) {
    const landscape = (id: InstanceId): boolean => {
      const card = cardOf(args.game, id);
      return card ? isLandscapeCard(card) : false;
    };
    const thumbs =
      faceup.length > 0 ? boostThumbsLayout(x, cursor, width, y + height - cursor, faceup, landscape) : null;
    let textX = x;
    let textMid = cursor + 17;
    if (thumbs) {
      for (const { instanceId, rect } of thumbs.cards) {
        const art = inspectModel(args.game, instanceId, null, args.viewerId, POOL_DEPS).art;
        drawCard(scene, rect, args.game, instanceId, args.onInspect, `boost:${instanceId}`, art);
        if (instanceId === body.countedBoostId) {
          scene.add
            .graphics()
            .lineStyle(border.object, signal.caution.hex, 1)
            .strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
      }
      textX = thumbs.textX;
      textMid = cursor + thumbs.height / 2;
      if (detail) {
        happeningDebug.boosted = {
          text: body.text,
          shown: detail.getWrappedText(detail.text).slice(0, detailShown).join(" "),
          breakdown: { x: detail.x, y: detail.y, width: detail.width, height: detail.height },
          cut: detailShown < detailLines,
          boosts: thumbs.cards.map((card) => card.rect),
          body: layout.body,
        };
      }
    } else {
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
      textX = box.x + box.width + 10;
    }
    const counting = body.countedBoostId != null;
    scene.add
      .text(
        textX,
        textMid,
        body.boostLine.toUpperCase(),
        textStyle(
          { ...typeRole.label, size: counting ? 11 : 10 },
          counting ? signal.caution.hex : surface.paper.hex,
          counting ? ink.body : ink.secondary,
        ),
      )
      .setOrigin(0, 0.5)
      .setWordWrapWidth(Math.max(40, x + width - textX))
      .setMaxLines(thumbs ? Math.max(2, Math.floor(thumbs.height / 14)) : 2);
  }
  // Held on an encounter card whose last beat is this one (the active counter moving): the way on is still NEXT CARD.
  const next = args.onNext;
  if (next) {
    const rect: Rect = { x, y: y + height - hit.target, width: Math.min(width, 200), height: hit.target };
    args.buttons.push(
      new McButton(scene, { kind: "onInk", label: "Next card ▸", type: typeRole.label, rect, onClick: next }),
    );
    stops.set("next", { rect, activate: next });
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
  // With more than one seat the window names whose it is: "your" is whoever holds the shared screen.
  const seat = game.players.length > 1 ? shortSeatName(game, interrupt.pause.playerId, null) : null;
  const windowTitle = label(
    scene,
    layout.title.x,
    layout.title.y,
    windowTitleOf(interrupt.pause.timing, seat),
    { ...typeRole.label, size: 11 },
    signal.caution.hex,
    ink.body,
  );
  fitText(windowTitle, layout.title.width, 11);
  if (interrupt.prevention) {
    const stampLeft = drawPreventionStamp(scene, frame, interrupt.prevention);
    fitText(windowTitle, Math.min(layout.title.width, stampLeft - 8 - layout.title.x), 11);
  }

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
  const from = offeredFrom(game, first.instanceId);
  const inHand = from === "hand";
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
    ? from !== null
      ? "Card ability"
      : "Hero ability"
    : (model.typeLine.split(" · ")[0] ?? "Card");
  const costTag = model.cost !== null && inHand ? `${kindTag} · cost ${model.currentCost ?? model.cost}` : kindTag;
  tx += tag(scene, tx, cursor, costTag, true, signal.caution.hex) + 6;
  // The top of the deck is played "as if it was in your hand" at a reduced cost: no printed cost here, which it is not.
  const fromTag = inHand
    ? "From your hand"
    : from === "deckTop"
      ? "From your deck"
      : first.abilityId
        ? "In play"
        : "Free";
  // Where the two tags don't fit one row beside the card (a phone), the second stacks under the first rather than
  // running off the panel (#394).
  if (tx + tagWidth(scene, fromTag) > x + width) {
    tx = x;
    cursor += 24;
  }
  tag(scene, tx, cursor, fromTag, false, surface.paper.hex);
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
  const hp = interrupt.prevention?.hp;
  if (layout.hpLine && hp) {
    // What the player is choosing between, in hit points (#394): where the hero is, and where letting it resolve
    // leaves them; with the interrupt too, when it would not keep them where they are (a partial prevention).
    const parts = [`${hp.targetName}: ${hp.now} HP now`, `${hp.ifResolves} HP if it resolves`];
    if (hp.withInterrupt !== hp.now) parts.push(`${hp.withInterrupt} HP with ${model.name}`);
    const line = scene.add
      .text(
        layout.hpLine.x,
        layout.hpLine.y + layout.hpLine.height / 2,
        parts.join(" · "),
        textStyle({ ...typeRole.label, size: 12 }, surface.paper.hex),
      )
      .setOrigin(0, 0.5);
    fitText(line, layout.hpLine.width, 12);
  }

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

  drawInterruptAnswer(scene, { use: layout.use, resolve: layout.resolve }, game, interrupt, args.buttons, stops, {
    thumb: args.layout.kind === "tab",
  });
}

/**
 * The window's two answers: the yellow USE / PLAY (or, with several options to pick from, the one control that answers
 * them), and LET IT RESOLVE ▸. `thumb` is the phone and tablet portrait shape, where they sit in the action bar's place
 * (P1/P2/P3): a red RESOLVE ▸ in the design's display type.
 */
export function drawInterruptAnswer(
  scene: Phaser.Scene,
  rects: { readonly use: Rect; readonly resolve: Rect },
  game: GameState,
  interrupt: RailInterrupt,
  buttons: McButton[],
  stops: Map<string, FocusStop>,
  options: { readonly thumb: boolean },
): void {
  const multi = !inlineSingle(interrupt.options);
  const picks = interrupt.picks;
  const first = interrupt.options[0]!;
  if (options.thumb) {
    // The action bar's place: cover the bar underneath so none of its buttons show around these two.
    const ground = scene.add.graphics();
    const top = Math.min(rects.use.y, rects.resolve.y) - 6;
    const left = rects.use.x - 8;
    const right = rects.resolve.x + rects.resolve.width + 8;
    const bottom = Math.max(rects.use.y + rects.use.height, rects.resolve.y + rects.resolve.height) + 6;
    ground.fillStyle(surface.ink.hex, 1).fillRect(left, top, right - left, bottom - top);
  }
  const use = (): void => interrupt.onResolve(multi ? picks : [first.optionId]);
  const useLabel = multi ? inlineConfirmLabel(game, interrupt.options, picks) : interruptActionLabel(game, first);
  buttons.push(
    new McButton(scene, {
      kind: "primary",
      label: useLabel,
      type: { ...typeRole.barTitle, size: options.thumb ? 22 : 26 },
      rect: rects.use,
      tint: { fill: signal.caution.hex, ink: surface.ink.hex },
      enabled: !multi || picks.length > 0,
      onClick: use,
    }),
  );
  if (!multi) stops.set(`interrupt:${first.optionId}`, { rect: rects.use, activate: use });
  else stops.set("confirm", { rect: rects.use, activate: use });
  const letItResolve = (): void => interrupt.onResolve([]);
  buttons.push(
    new McButton(scene, {
      kind: options.thumb ? "primary" : "onInk",
      label: options.thumb ? "Resolve ▸" : "Let it resolve ▸",
      type: options.thumb ? { ...typeRole.barTitle, size: 22 } : { ...typeRole.label, size: 12 },
      rect: rects.resolve,
      onClick: letItResolve,
    }),
  );
  stops.set("resolve", { rect: rects.resolve, activate: letItResolve });
}

/** START VILLAIN PHASE, or a decision's notice with ANSWER, in the interrupt window's frame. */
function drawGate(
  scene: Phaser.Scene,
  layout: VillainRailInterruptLayout,
  args: RailPanelArgs,
  gate: RailGate,
  stops: Map<string, FocusStop>,
): void {
  const { frame } = layout;
  const g = scene.add.graphics();
  g.fillStyle(surface.ink.hex, 1).fillRect(frame.x, frame.y, frame.width, frame.height);
  g.lineStyle(border.object, signal.caution.hex, 1).strokeRect(frame.x, frame.y, frame.width, frame.height);
  const title = gate.kind === "start" ? "Ready when you are" : gate.title;
  const heading = label(
    scene,
    layout.title.x,
    layout.title.y,
    title,
    { ...typeRole.label, size: 11 },
    signal.caution.hex,
    1,
  );
  fitText(heading, layout.title.width, 11);
  const cardId = gate.kind === "decision" ? gate.cardInstanceId : null;
  if (cardId) {
    drawCard(
      scene,
      layout.card,
      args.game,
      cardId,
      args.onInspect,
      `gate:${cardId}`,
      inspectModel(args.game, cardId, null, args.viewerId, POOL_DEPS).art,
    );
  }
  const textRect = cardId
    ? layout.text
    : { ...layout.text, x: layout.card.x, width: layout.text.x + layout.text.width - layout.card.x };
  const body =
    gate.kind === "start"
      ? `${gate.lead ? `End of your turn: ${gate.lead} ` : ""}Next, threat goes on, the villain and minions activate, then the encounter cards are dealt and revealed.`
      : gate.text;
  const text = scene.add
    .text(textRect.x, textRect.y, body, textStyle({ ...typeRole.body, size: 14 }, surface.paper.hex))
    .setOrigin(0, 0)
    .setWordWrapWidth(Math.max(1, textRect.width));
  const lineHeight = text.height / Math.max(1, text.getWrappedText(body).length);
  text.setMaxLines(Math.max(1, Math.floor(textRect.height / lineHeight)));

  // One wide button: the use and resolve rects together.
  const left = Math.min(layout.use.x, layout.resolve.x);
  const right = Math.max(layout.use.x + layout.use.width, layout.resolve.x + layout.resolve.width);
  const rect: Rect = { x: left, y: layout.use.y, width: right - left, height: layout.use.height };
  if (args.layout.kind === "tab") {
    // The action bar's place: cover the bar underneath, as the interrupt's answers do.
    const ground = scene.add.graphics();
    ground.fillStyle(surface.ink.hex, 1).fillRect(rect.x - 8, rect.y - 6, rect.width + 16, rect.height + 12);
  }
  const key = gate.kind === "start" ? "start" : "answer";
  args.buttons.push(
    new McButton(scene, {
      kind: "primary",
      label: gate.kind === "start" ? "Start villain phase ▸" : "Answer ▸",
      type: { ...typeRole.barTitle, size: args.layout.kind === "tab" ? 22 : 26 },
      rect,
      tint: { fill: signal.caution.hex, ink: surface.ink.hex },
      onClick: gate.onPress,
    }),
  );
  stops.set(key, { rect, activate: gate.onPress });
}

/** "Spider-Sense": the printed name of the ability on offer, else the card's. */
export function abilityName(game: GameState, option: InlineInterruptOption): string {
  const label = interruptActionLabel(game, option);
  return label.replace(/^(Use|Play) /, "");
}

function drawLog(scene: Phaser.Scene, rect: Rect, log: RailPanelArgs["log"]): void {
  if (rect.height <= 0) return;
  label(scene, rect.x, rect.y, "Phase log", { ...typeRole.label, size: 11 }, surface.paper.hex, ink.label);
  let y = rect.y + 22;
  for (const entry of log) {
    if (y + 18 > rect.y + rect.height) break;
    const tagText = typeof entry.step === "number" ? `${entry.step} ·` : entry.step;
    const tag = label(scene, rect.x, y, tagText, { ...typeRole.label, size: 11 }, surface.paper.hex, ink.meta);
    const indent = Math.max(24, tag.width + 8);
    const line = scene.add
      .text(
        rect.x + indent,
        y - 1,
        entry.text,
        textStyle({ ...typeRole.body, size: 13 }, surface.paper.hex, ink.secondary),
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width - indent)
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
  if (toggle.width > 0) drawToggle(scene, toggle, mode, onToggle);
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
