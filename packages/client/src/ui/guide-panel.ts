/**
 * `McGuidePanel` (guided mode G4b, `docs/guided-mode.md` §4): the collapsible yellow guide side rail
 * for desktop and tablet landscape — D01/D02 (`artifacts/design-screenshots/individual/guided-desktop.dc/`)
 * and T02 (`guided-tablet.dc/`). It's `McGuideCallout`'s (G4a) sibling for the wide form factors: same
 * `GUIDE` stamp/Bangers title/`McTermText` body voice, laid out as a fixed rail instead of an anchored
 * bubble, with an optional lesson list above the step body and a footer that's always pinned to the
 * panel's own bottom edge (`view/guide-panel-model.ts#guidePanelLayoutOf`).
 *
 * **Layout is a full rebuild**, exactly like `McGuideCallout#update` — a guide step changes rarely
 * enough that redrawing every child is simpler than diffing. The step body (step label, Bangers title,
 * `McTermText` body, an optional tip box, an optional extra block) is measured at the origin first, then
 * `guidePanelLayoutOf` says whether it fits the space left after the header/lesson-list block and the
 * pinned footer; when it doesn't, the body is wrapped in an `McScrollRegion` instead of drawn straight
 * into the container.
 *
 * **The lesson list and the extra block share one row renderer** (`#drawStatusRow`): a lesson row's
 * done/current/upcoming states are the same shape as an extra row's own check/current/swatch states — a
 * check (done), a full-row ink highlight with a numbered chip (current), or a plain numbered/swatched
 * row (upcoming) — so D01's lesson list and D02's villain-phase step list read as the same design
 * language instead of two bespoke widgets.
 *
 * **Two exits, always** (§3.10 "never locked in"): the header row always carries "Skip this step"
 * (`onSkip`, `content.skipLabel` overrides the label text only — unconditional whenever `onSkip` is
 * wired) and "Stop tutorial" (`onStop`), right-aligned beside Collapse via `guidePanelHeaderExitsLayoutOf`
 * so all three controls' hit areas (≥ `hit.target` on a side) never overlap.
 *
 * **Keyboard** mirrors G4a's shape (`focusNext`, `activatePrimary`, `handleEscape`) — see that widget's
 * own header and `docs/guided-mode.md` §7's gotcha: the host scene's own keyboard binding must call
 * `handleEscape()` before doing anything else with that key, because Phaser 4 runs each scene's handlers
 * in scene-start order and this widget can't `stopPropagation` an Escape away from the scene under it.
 * **The Escape contract** mirrors G4a's own (`ui/guide-callout.ts`'s header): never returns without
 * acting — a tooltip closes first, then `onSkip` always counts the step as skipped.
 */
import Phaser from "phaser";
import { border, hit, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import {
  guidePanelCollapsedRectOf,
  guidePanelHeaderExitsLayoutOf,
  guidePanelHeaderHeightOf,
  guidePanelLayoutOf,
  GUIDE_PANEL_EXITS_ROW_HEIGHT,
  GUIDE_PANEL_HEADER_HEIGHT,
  GUIDE_PANEL_PAD,
  GUIDE_PANEL_ROW_HEIGHT,
} from "../view/guide-panel-model.js";
import { tooltipContentOf, type TermTextTerm } from "../view/term-text-model.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { dashedRect, McButton } from "./widgets.js";
import { McScrollRegion } from "./scroll-region.js";
import { McTermText } from "./term-text.js";
import { McTooltip } from "./tooltip.js";
import { textStyle } from "./theme.js";

const STAMP_TYPE: TypeSpec = { ...typeRole.label, size: 10 };
const TITLE_TYPE: TypeSpec = { ...typeRole.barTitle };
const BUTTON_TYPE: TypeSpec = { ...typeRole.label, size: 13 };
const ROW_TYPE: TypeSpec = { ...typeRole.rowTitle, size: 12 };
const TIP_TAG_WIDTH = 30;
/** Padding on each side of the `GUIDE` ink stamp's own label, sizing the box to the measured text (G4b desktop overflow fix). */
const STAMP_PAD = 8;
/**
 * Inset applied to a swatch-legend extra row (T02's resource-icon legend) so its swatch doesn't touch the
 * extra block's own left border. A check/number/current row (D02's villain-phase step list) stays flush with
 * the box edge, matching that tile's own full-bleed row highlight — only a `swatch` row gets this inset.
 */
const EXTRA_ROW_SWATCH_INSET = 12;
const FOOTER_PAD_TOP = 16;
const FOOTER_PAD_BOTTOM = 20;
const TICK_HEIGHT = 6;
const TICK_GAP = 4;

export interface GuidePanelLessonRow {
  readonly id: string;
  readonly label: string;
  readonly status: "done" | "current" | "upcoming";
  /** "2 / 3" beside a current row's own label (D01). Ignored for done/upcoming rows. */
  readonly progress?: string | null;
}

export interface GuidePanelExtraRow {
  readonly label: string;
  readonly detail?: string | null;
  /** A colour swatch drawn before the label — T02's resource-icon legend. */
  readonly swatch?: number | null;
  /** A green check instead of a number — D02's "plan advances" row. */
  readonly done?: boolean;
  /** The full-row ink highlight — D02's "he attacks you" row. */
  readonly current?: boolean;
}

export interface McGuidePanelContent {
  /** "FIRST GAME" / "LESSON 3 OF 5", beside the `GUIDE` stamp. */
  readonly contextLabel: string;
  /** The header's collapse control label. Defaults to "COLLAPSE" (left rail) or "HIDE" (right rail, `options.side`); drawn with a `‹`/`▸` glyph pointing toward the collapsed tab's own edge. */
  readonly collapseLabel?: string | null;
  /**
   * Overrides the "Skip this step" exit's own label text (§3.10 "never locked in" — the control itself
   * is unconditional whenever `onSkip` is wired, this only renames it). Kept for content that already
   * passes the older "Skip lesson" wording; new content should leave this unset.
   */
  readonly skipLabel?: string | null;
  /** The lesson list (D01). Omit/null/empty to hide it (D02 uses `extra` instead). */
  readonly lessons?: readonly GuidePanelLessonRow[] | null;
  /** "STEP 2 OF 4" (T02). Omit for a step-less surface. */
  readonly stepLabel?: string | null;
  readonly title: string;
  /** `McTermText` markup — see `view/term-text-model.ts`'s header for `[[id]]` / `[[id|label]]`. */
  readonly body: string;
  /** The ink "TIP" tag plus text (D01). Omit/null to hide it. */
  readonly tip?: string | null;
  /** The generic extra block (T02's resource legend, D02's villain-phase step list). Omit/null to hide it. */
  readonly extraHeading?: string | null;
  readonly extra?: readonly GuidePanelExtraRow[] | null;
  /** Footer progress ticks: how many, and which one (0-based) is current. Omit either to hide the row. */
  readonly progressTicks?: number | null;
  readonly progressCurrent?: number | null;
  /** The footer's Back button label. Omit/null to hide it. Takes the footer's one left-hand secondary slot over
   * `secondaryLabel` when both happen to be set (never happens in practice: `secondaryLabel` only ever appears on
   * a lesson's first step, guided mode G7d, where `backLabel` is always null). */
  readonly backLabel?: string | null;
  /** A second forward button beside the primary one — lesson 5's "How do I stop it?" (guided mode G7d,
   * `docs/guided-mode.md` §5.1 tile P03). Fires `McGuidePanelOptions.onSecondary`, not `onBack`. Shares the
   * footer's left-hand secondary slot with `backLabel`; see that field's own doc comment for why they never
   * collide in the tutorial's own data. */
  readonly secondaryLabel?: string | null;
  /** Shown instead of the "do this to continue" hint box, for a step with its own forward action. */
  readonly primaryLabel?: string | null;
  /** The dashed "do this to continue" hint box's text — mutually exclusive with `primaryLabel`. */
  readonly continueHint?: string | null;
  /**
   * A small line above the footer's own button row — G5c's soft-gate release fills it with "Want to do
   * something else? Skip this step" (`docs/guided-mode.md` §3.10). Omit/null to hide it.
   */
  readonly nudge?: string | null;
}

export interface McGuidePanelOptions {
  readonly onBack?: () => void;
  /** `McGuidePanelContent.secondaryLabel`'s own click (guided mode G7d) — distinct from `onBack`, even though
   * both draw in the footer's same left-hand slot. */
  readonly onSecondary?: () => void;
  readonly onPrimary?: () => void;
  /** Fired when the header's own collapse control is clicked (the widget also collapses itself). */
  readonly onCollapse?: () => void;
  /** Fired when the collapsed tab is clicked (the widget also expands itself). */
  readonly onExpand?: () => void;
  /** "Skip this step" (§3.10). Always shown in the header, right of Collapse, whenever this is wired. */
  readonly onSkip?: () => void;
  /** "Stop tutorial" (§3.10). Always shown in the header, right of Skip, whenever this is wired. */
  readonly onStop?: () => void;
  /** A lesson row was clicked — "replay" (`docs/guided-mode.md` §4 G4b). */
  readonly onLessonSelect?: (id: string) => void;
  /** "RULES GLOSSARY ▸" on a body term's tooltip — the host owns the actual scene launch (`SCENES.rules`). */
  readonly onOpenGlossary?: (query: string) => void;
  /** Which edge of the screen this rail sits on — only matters for the collapsed tab's own position. Default "left". */
  readonly side?: "left" | "right";
}

interface FocusTarget {
  readonly rect: Rect;
  readonly activate: () => void;
}

/** The collapsible yellow guide side rail (desktop, tablet landscape). */
export class McGuidePanel {
  readonly container: Phaser.GameObjects.Container;
  readonly #scene: Phaser.Scene;
  readonly #options: McGuidePanelOptions;
  readonly #tooltip: McTooltip;
  readonly #bodyScroll = new VariableListScroll();
  #objects: Phaser.GameObjects.GameObject[] = [];
  #body: McTermText | null = null;
  #scrollRegion: McScrollRegion | null = null;
  #focusables: FocusTarget[] = [];
  #focusIndex = -1;
  readonly #focusRing: Phaser.GameObjects.Graphics;
  #primaryLabel: string | null = null;
  #collapsed = false;
  #content: McGuidePanelContent | null = null;
  #rect: Rect | null = null;
  #lastTitle: string | null = null;

  constructor(scene: Phaser.Scene, options: McGuidePanelOptions = {}) {
    this.#scene = scene;
    this.#options = options;
    this.container = scene.add.container(0, 0);
    this.#tooltip = new McTooltip(scene);
    this.#focusRing = scene.add.graphics();
  }

  /** Redraws the panel for `content` at `rect` — the rail's own on-screen rect, already sized by `guideRailWidthFor`. */
  update(content: McGuidePanelContent, rect: Rect): void {
    this.#content = content;
    this.#rect = rect;
    if (content.title !== this.#lastTitle) {
      this.#bodyScroll.reset();
      this.#lastTitle = content.title;
    }
    this.#redraw();
  }

  /** Collapses to the slim rail-edge tab. Idempotent. */
  collapse(): void {
    if (this.#collapsed) return;
    this.#collapsed = true;
    this.#redraw();
  }

  /** Expands back to the full panel. Idempotent. */
  expand(): void {
    if (!this.#collapsed) return;
    this.#collapsed = false;
    this.#redraw();
  }

  get collapsed(): boolean {
    return this.#collapsed;
  }

  #redraw(): void {
    this.#tooltip.hide();
    this.#teardown();
    if (!this.#content || !this.#rect) return;
    if (this.#collapsed) this.#drawCollapsed(this.#rect);
    else this.#drawExpanded(this.#content, this.#rect);
    this.#scene.children.bringToTop(this.container);
  }

  #drawCollapsed(rect: Rect): void {
    const scene = this.#scene;
    const side = this.#options.side ?? "left";
    const tabRect = guidePanelCollapsedRectOf(rect, side);
    const objects: Phaser.GameObjects.GameObject[] = [];

    const panel = scene.add.graphics();
    panel
      .fillStyle(signal.caution.hex, 1)
      .fillRect(tabRect.x, tabRect.y, tabRect.width, tabRect.height)
      .lineStyle(border.object, surface.ink.hex, 1)
      .strokeRect(tabRect.x, tabRect.y, tabRect.width, tabRect.height);
    objects.push(panel);

    const label = scene.add
      .text(tabRect.x + tabRect.width / 2, tabRect.y + tabRect.height / 2, "GUIDE ▸", {
        ...textStyle(STAMP_TYPE, surface.ink.hex),
      })
      .setOrigin(0.5, 0.5)
      .setAngle(-90);
    objects.push(label);

    const zone = scene.add
      .zone(tabRect.x, tabRect.y, tabRect.width, tabRect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => {
      this.expand();
      this.#options.onExpand?.();
    });
    objects.push(zone);

    this.#focusables = [{ rect: tabRect, activate: () => zone.emit("pointerup") }];
    this.#focusIndex = -1;
    this.#primaryLabel = null;

    this.#objects = objects;
    this.container.add(objects);
    this.container.add(this.#focusRing);
  }

  #drawExpanded(content: McGuidePanelContent, rect: Rect): void {
    const scene = this.#scene;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const focusables: FocusTarget[] = [];
    const innerWidth = rect.width - GUIDE_PANEL_PAD * 2;

    // --- Base panel fill (drawn first so everything else sits on top of it). ---
    const panel = scene.add.graphics();
    panel.fillStyle(signal.caution.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    objects.push(panel);

    // --- Header row 1: GUIDE stamp, context label, collapse. ---
    const stampHeight = 20;
    const headerCy = rect.y + GUIDE_PANEL_HEADER_HEIGHT / 2;
    // The stamp label is measured first, so the ink box is sized to fit it (plus `STAMP_PAD` on each side)
    // instead of a fixed guess that can overflow a wider "GUIDE" rendering.
    const stampLabel = scene.add.text(0, headerCy, "GUIDE", textStyle(STAMP_TYPE, surface.paper.hex)).setOrigin(0, 0.5);
    const stampWidth = stampLabel.width + STAMP_PAD * 2;
    stampLabel.setPosition(rect.x + GUIDE_PANEL_PAD + STAMP_PAD, headerCy);
    panel
      .fillStyle(surface.ink.hex, 1)
      .fillRect(rect.x + GUIDE_PANEL_PAD, headerCy - stampHeight / 2, stampWidth, stampHeight);
    objects.push(stampLabel);
    const contextLabel = scene.add
      .text(
        rect.x + GUIDE_PANEL_PAD + stampWidth + 10,
        headerCy,
        content.contextLabel.toUpperCase(),
        textStyle(STAMP_TYPE, surface.ink.hex),
      )
      .setOrigin(0, 0.5);
    objects.push(contextLabel);

    const side = this.#options.side ?? "left";
    const collapseLabel = (content.collapseLabel ?? (side === "right" ? "Hide" : "Collapse")).toUpperCase();
    const collapseGlyphText = side === "right" ? `${collapseLabel} ▸` : `‹ ${collapseLabel}`;
    const collapseText = scene.add
      .text(0, headerCy, collapseGlyphText, textStyle(STAMP_TYPE, surface.ink.hex))
      .setOrigin(1, 0.5);
    collapseText.setPosition(rect.x + rect.width - GUIDE_PANEL_PAD, headerCy);
    objects.push(collapseText);
    const collapseZoneWidth = Math.max(collapseText.width, hit.target);
    const collapseZoneHeight = Math.max(collapseText.height, hit.target);
    // `collapseText` has origin (1, 0.5) — its own `.x` is the label's *right* edge, not its center — so the
    // zone's center has to be computed from that right edge minus half the label's width, not added to it
    // (a plain `+ width / 2` here puts the whole hit zone off to the right of the visible label, unclickable).
    const collapseZone = scene.add
      .zone(
        collapseText.x - collapseText.width / 2 - collapseZoneWidth / 2,
        headerCy - collapseZoneHeight / 2,
        collapseZoneWidth,
        collapseZoneHeight,
      )
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    collapseZone.on("pointerup", () => {
      this.collapse();
      this.#options.onCollapse?.();
    });
    objects.push(collapseZone);
    focusables.push({
      rect: { x: collapseText.x - collapseText.width, y: headerCy - 12, width: collapseText.width, height: 24 },
      activate: () => collapseZone.emit("pointerup"),
    });

    // --- Header row 2 (only when at least one §3.10 exit is wired): "Skip this step" / "Stop tutorial",
    // right-aligned, below row 1 rather than sharing it — the `GUIDE` stamp, context label and Collapse
    // already crowd row 1's own ~300px width at the tablet-landscape rail, so spelling out both exits
    // there risks overlapping them (`guidePanelHeaderExitsLayoutOf`'s own header comment). ---
    const hasExitsRow = Boolean(this.#options.onSkip || this.#options.onStop);
    const headerHeight = guidePanelHeaderHeightOf(hasExitsRow);
    if (hasExitsRow) {
      const exitsRowCy = rect.y + GUIDE_PANEL_HEADER_HEIGHT + GUIDE_PANEL_EXITS_ROW_HEIGHT / 2;
      const skipMeasure = this.#options.onSkip
        ? scene.add
            .text(0, 0, (content.skipLabel ?? "Skip this step").toUpperCase(), textStyle(STAMP_TYPE, surface.ink.hex))
            .setOrigin(0.5, 0.5)
        : null;
      // Spelled out, matching "SKIP THIS STEP" — the rail's own ~300px width has room for both (found in
      // browser verification, G5c fix: a bare × read as a stray close button, not "the other exit"). The
      // phone/tablet-portrait callout (`ui/guide-callout.ts`) keeps the × — that surface is already tight
      // with the `GUIDE` stamp, step label and "Skip this step" sharing one row at 390px.
      const stopMeasure = this.#options.onStop
        ? scene.add.text(0, 0, "STOP TUTORIAL", textStyle(STAMP_TYPE, surface.ink.hex)).setOrigin(0.5, 0.5)
        : null;

      const headerExits = guidePanelHeaderExitsLayoutOf({
        rect,
        rowCenterY: exitsRowCy,
        skipLabelWidth: skipMeasure?.width ?? null,
        stopLabelWidth: stopMeasure?.width ?? hit.target,
      });

      if (skipMeasure && headerExits.skip) {
        skipMeasure.setPosition(
          headerExits.skip.x + headerExits.skip.width / 2,
          headerExits.skip.y + headerExits.skip.height / 2,
        );
        objects.push(skipMeasure);
        const skipZone = scene.add
          .zone(headerExits.skip.x, headerExits.skip.y, headerExits.skip.width, headerExits.skip.height)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        skipZone.on("pointerup", () => this.#options.onSkip?.());
        objects.push(skipZone);
        focusables.push({ rect: headerExits.skip, activate: () => skipZone.emit("pointerup") });
      } else {
        skipMeasure?.destroy();
      }

      if (stopMeasure) {
        stopMeasure.setPosition(
          headerExits.stop.x + headerExits.stop.width / 2,
          headerExits.stop.y + headerExits.stop.height / 2,
        );
        objects.push(stopMeasure);
        const stopZone = scene.add
          .zone(headerExits.stop.x, headerExits.stop.y, headerExits.stop.width, headerExits.stop.height)
          .setOrigin(0, 0)
          .setInteractive({ useHandCursor: true });
        stopZone.on("pointerup", () => this.#options.onStop?.());
        objects.push(stopZone);
        focusables.push({ rect: headerExits.stop, activate: () => stopZone.emit("pointerup") });
      }
    }

    panel
      .lineStyle(border.detail, surface.ink.hex, 1)
      .lineBetween(rect.x, rect.y + headerHeight, rect.x + rect.width, rect.y + headerHeight);

    // --- Lesson list (optional). ---
    const lessonRows = content.lessons ?? [];
    const hasLessonList = lessonRows.length > 0;

    // --- Step body, measured at the origin first (mirrors McGuideCallout#update). ---
    const bodyObjects: Phaser.GameObjects.GameObject[] = [];
    let by = 0;
    let stepLabelText: Phaser.GameObjects.Text | null = null;
    if (content.stepLabel) {
      stepLabelText = scene.add.text(0, 0, content.stepLabel.toUpperCase(), textStyle(STAMP_TYPE, surface.ink.hex));
      by += stepLabelText.height + 8;
    }
    const title = scene.add
      .text(0, 0, content.title.toUpperCase(), textStyle(TITLE_TYPE, surface.ink.hex))
      .setWordWrapWidth(innerWidth, true);
    by += title.height + 10;

    const body = new McTermText(scene, {
      x: 0,
      y: 0,
      width: innerWidth,
      text: content.body,
      color: surface.ink.hex,
      onTermOpen: (term, termRect) => this.#openTooltip(term, termRect),
      onTermClose: () => this.#tooltip.hide(),
    });
    this.#body = body;
    by += body.height;

    let tipBox: Phaser.GameObjects.Graphics | null = null;
    let tipTag: Phaser.GameObjects.Text | null = null;
    let tipText: Phaser.GameObjects.Text | null = null;
    if (content.tip) {
      by += 16;
      tipText = scene.add
        .text(0, 0, content.tip, { ...textStyle(typeRole.body, surface.ink.hex) })
        .setWordWrapWidth(innerWidth - TIP_TAG_WIDTH - 24, true);
      const tipHeight = Math.max(TIP_TAG_WIDTH, tipText.height + 16);
      by += tipHeight;
    }

    const extraRows = content.extra ?? [];
    let extraHeadingText: Phaser.GameObjects.Text | null = null;
    if (extraRows.length > 0) {
      by += 16;
      if (content.extraHeading) {
        extraHeadingText = scene.add.text(
          0,
          0,
          content.extraHeading.toUpperCase(),
          textStyle(STAMP_TYPE, surface.ink.hex, ink.label),
        );
        by += extraHeadingText.height + 8;
      }
      by += extraRows.length * GUIDE_PANEL_ROW_HEIGHT + GUIDE_PANEL_PAD;
    }

    const bodyContentHeight = by;

    // --- Nudge line, above the footer's own button row (G5c fills it after a soft-gate release). Measured
    // here, alongside the rest of the step body, so the footer's own fixed height accounts for its wrap. ---
    let nudgeText: Phaser.GameObjects.Text | null = null;
    if (content.nudge) {
      nudgeText = scene.add
        .text(0, 0, content.nudge, { ...textStyle({ ...typeRole.body, size: 11 }, surface.ink.hex, ink.secondary) })
        .setWordWrapWidth(innerWidth, true);
    }
    const nudgeHeight = nudgeText ? nudgeText.height + 8 : 0;

    // --- Ask the model for the section rects, now that everything is measured. ---
    const footerHeight = this.#footerHeightOf(content, nudgeHeight);
    const layout = guidePanelLayoutOf({
      rect,
      hasLessonList,
      lessonRowCount: lessonRows.length,
      bodyContentHeight,
      footerHeight,
      headerHeight,
    });

    // --- Lesson list, drawn at its own rect. ---
    if (layout.lessonList) {
      let ly = layout.lessonList.y + GUIDE_PANEL_PAD * 0.5;
      for (const [index, row] of lessonRows.entries()) {
        const rowResult = this.#drawStatusRow(rect.x + GUIDE_PANEL_PAD, ly, innerWidth, {
          label: row.label,
          trailing: row.status === "current" ? (row.progress ?? null) : null,
          state: row.status,
          index,
          onClick: this.#options.onLessonSelect ? () => this.#options.onLessonSelect?.(row.id) : null,
        });
        objects.push(...rowResult.objects);
        if (rowResult.focusable) focusables.push(rowResult.focusable);
        ly += GUIDE_PANEL_ROW_HEIGHT;
      }
      panel
        .lineStyle(border.detail, surface.ink.hex, 1)
        .lineBetween(
          rect.x,
          layout.lessonList.y + layout.lessonList.height,
          rect.x + rect.width,
          layout.lessonList.y + layout.lessonList.height,
        );
    }

    // --- Position the measured step-body content at its own final, absolute screen coordinates — the same
    // "measure at the origin, then place once" shape `McGuideCallout#update` uses, so both an un-scrolled draw
    // and an `McScrollRegion`'s content (which expects its children at real screen `x`, content-relative `y`,
    // per that widget's own header) can take the identical objects with no extra wrapping container. ---
    const ox = rect.x + GUIDE_PANEL_PAD;
    const oy = layout.body.y;
    let cy = 0;
    if (stepLabelText) {
      stepLabelText.setPosition(ox, oy + cy);
      bodyObjects.push(stepLabelText);
      cy += stepLabelText.height + 8;
    }
    title.setPosition(ox, oy + cy);
    bodyObjects.push(title);
    cy += title.height + 10;
    body.container.setPosition(ox, oy + cy);
    bodyObjects.push(body.container);
    cy += body.height;

    if (content.tip && tipText) {
      cy += 16;
      const tipHeight = Math.max(TIP_TAG_WIDTH, tipText.height + 16);
      tipBox = scene.add.graphics();
      tipBox.lineStyle(border.control, surface.ink.hex, 1).strokeRect(ox, oy + cy, innerWidth, tipHeight);
      tipBox.fillStyle(surface.ink.hex, 1).fillRect(ox, oy + cy, TIP_TAG_WIDTH, tipHeight);
      bodyObjects.push(tipBox);
      tipTag = scene.add
        .text(ox + TIP_TAG_WIDTH / 2, oy + cy + tipHeight / 2, "TIP", { ...textStyle(STAMP_TYPE, surface.paper.hex) })
        .setOrigin(0.5, 0.5)
        .setAngle(-90);
      bodyObjects.push(tipTag);
      tipText.setPosition(ox + TIP_TAG_WIDTH + 12, oy + cy + 8);
      bodyObjects.push(tipText);
      cy += tipHeight;
    }

    if (extraRows.length > 0) {
      cy += 16;
      if (extraHeadingText) {
        extraHeadingText.setPosition(ox, oy + cy);
        bodyObjects.push(extraHeadingText);
        cy += extraHeadingText.height + 8;
      }
      const extraBoxTop = cy;
      let ey = oy + cy + GUIDE_PANEL_PAD * 0.5;
      for (const [index, row] of extraRows.entries()) {
        const rowInset = row.swatch != null ? EXTRA_ROW_SWATCH_INSET : 0;
        const rowResult = this.#drawStatusRow(ox + rowInset, ey, innerWidth - rowInset * 2, {
          label: row.label,
          detail: row.detail ?? null,
          trailing: null,
          state: row.done ? "done" : row.current ? "current" : "upcoming",
          swatch: row.swatch ?? null,
          index,
          onClick: null,
        });
        bodyObjects.push(...rowResult.objects);
        ey += GUIDE_PANEL_ROW_HEIGHT;
      }
      const extraBoxHeight = extraRows.length * GUIDE_PANEL_ROW_HEIGHT + GUIDE_PANEL_PAD;
      const extraBox = scene.add.graphics();
      extraBox
        .lineStyle(border.detail, surface.ink.hex, 1)
        .strokeRect(ox, oy + extraBoxTop, innerWidth, extraBoxHeight);
      bodyObjects.unshift(extraBox);
      cy = extraBoxTop + extraBoxHeight;
    }

    if (layout.scrollable) {
      const region = new McScrollRegion(scene, {
        rect: layout.body,
        heights: [bodyContentHeight],
        scroll: this.#bodyScroll,
      });
      region.content.add(bodyObjects);
      this.#scrollRegion = region;
    } else {
      this.#bodyScroll.reset();
      objects.push(...bodyObjects);
    }

    // --- Footer: progress ticks, Back, and the do-this-to-continue slot. Always pinned to the panel's bottom. ---
    const footer = layout.footer;
    let fy = footer.y + FOOTER_PAD_TOP;
    const ticks = content.progressTicks ?? 0;
    if (ticks > 0) {
      const tickWidth = (innerWidth - TICK_GAP * (ticks - 1)) / ticks;
      for (let i = 0; i < ticks; i++) {
        const tx = rect.x + GUIDE_PANEL_PAD + i * (tickWidth + TICK_GAP);
        const filled = content.progressCurrent != null && i <= content.progressCurrent;
        panel.fillStyle(surface.ink.hex, filled ? 1 : ink.disabled).fillRect(tx, fy, tickWidth, TICK_HEIGHT);
      }
      fy += TICK_HEIGHT + TICK_GAP * 2;
    }

    if (nudgeText) {
      nudgeText.setPosition(rect.x + GUIDE_PANEL_PAD, fy);
      objects.push(nudgeText);
      fy += nudgeText.height + 8;
    }

    // The footer's one left-hand slot is Back, or (only when there's no Back to show) the step's own
    // `secondaryLabel` — see that field's own doc comment for why the tutorial's data never asks for both at once.
    const hasBack = Boolean(content.backLabel);
    const hasAlt = !hasBack && Boolean(content.secondaryLabel);
    const hasLeft = hasBack || hasAlt;
    const hasSlot = Boolean(content.primaryLabel || content.continueHint);
    const gap = 12;
    const backWidth = hasLeft && hasSlot ? (innerWidth - gap) / 2 : innerWidth;
    const slotWidth = hasLeft && hasSlot ? (innerWidth - gap) / 2 : innerWidth;
    let bx = rect.x + GUIDE_PANEL_PAD;
    this.#primaryLabel = content.primaryLabel ?? null;
    if (hasLeft) {
      const leftLabel = hasBack ? content.backLabel! : content.secondaryLabel!;
      const onLeftClick = hasBack ? () => this.#options.onBack?.() : () => this.#options.onSecondary?.();
      const backRect: Rect = { x: bx, y: fy, width: backWidth, height: hit.target };
      const back = new McButton(scene, {
        kind: "secondary",
        label: leftLabel,
        type: BUTTON_TYPE,
        rect: backRect,
        tint: { fill: surface.paper.hex, ink: surface.ink.hex },
        onClick: onLeftClick,
      });
      objects.push(back.container);
      focusables.push({ rect: backRect, activate: onLeftClick });
      bx += backWidth + gap;
    }
    if (hasSlot) {
      const slotRect: Rect = { x: bx, y: fy, width: slotWidth, height: hit.target };
      if (content.primaryLabel) {
        const primary = new McButton(scene, {
          kind: "primary",
          label: content.primaryLabel,
          type: BUTTON_TYPE,
          rect: slotRect,
          tint: { fill: surface.ink.hex, ink: surface.paper.hex },
          onClick: () => this.#options.onPrimary?.(),
        });
        objects.push(primary.container);
        focusables.push({ rect: slotRect, activate: () => this.#options.onPrimary?.() });
      } else if (content.continueHint) {
        const hintBox = scene.add.graphics();
        dashedRect(hintBox, slotRect, border.control, surface.ink.hex);
        objects.push(hintBox);
        const hintText = scene.add
          .text(slotRect.x + slotRect.width / 2, slotRect.y + slotRect.height / 2, content.continueHint, {
            ...textStyle({ ...typeRole.emphasis, size: 10 }, surface.ink.hex),
            align: "center",
          })
          .setOrigin(0.5, 0.5)
          .setWordWrapWidth(slotRect.width - 16, true);
        objects.push(hintText);
      }
    }

    this.#focusables = focusables;
    this.#focusIndex = -1;
    this.#focusRing.clear();

    this.#objects = objects;
    this.container.add(objects);
    this.container.add(this.#focusRing);
  }

  /** The footer's own fixed height for `content` — ticks (if any) + an optional nudge line + the button row, with its own top/bottom padding. */
  #footerHeightOf(content: McGuidePanelContent, nudgeHeight: number): number {
    const ticksHeight = (content.progressTicks ?? 0) > 0 ? TICK_HEIGHT + TICK_GAP * 2 : 0;
    return FOOTER_PAD_TOP + ticksHeight + nudgeHeight + hit.target + FOOTER_PAD_BOTTOM;
  }

  /**
   * One row shared by the lesson list and the extra block: a check (done), a full-row ink highlight with
   * a numbered chip (current), or a plain numbered/swatched row (upcoming) — the design language D01's
   * lesson list and D02's villain-phase step list both use.
   */
  #drawStatusRow(
    x: number,
    y: number,
    width: number,
    opts: {
      readonly label: string;
      readonly detail?: string | null;
      readonly trailing?: string | null;
      readonly state: "done" | "current" | "upcoming";
      readonly swatch?: number | null;
      readonly onClick?: (() => void) | null;
      readonly index?: number;
    },
  ): { readonly objects: Phaser.GameObjects.GameObject[]; readonly focusable: FocusTarget | null } {
    const scene = this.#scene;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const height = GUIDE_PANEL_ROW_HEIGHT;
    const boxSize = 18;
    const boxY = y + (height - boxSize) / 2;
    const current = opts.state === "current";

    if (current) {
      const g = scene.add.graphics();
      g.fillStyle(surface.ink.hex, 1).fillRect(x, y, width, height);
      objects.push(g);
    }

    const textColor = current ? surface.paper.hex : surface.ink.hex;

    if (opts.swatch != null) {
      const swatchBox = scene.add.graphics();
      swatchBox
        .fillStyle(opts.swatch, 1)
        .fillRect(x, boxY, boxSize, boxSize)
        .lineStyle(border.detail, surface.ink.hex, 1)
        .strokeRect(x, boxY, boxSize, boxSize);
      objects.push(swatchBox);
    } else if (opts.state === "done") {
      const box = scene.add.graphics();
      box
        .fillStyle(surface.ink.hex, 1)
        .fillRect(x, boxY, boxSize, boxSize)
        .lineStyle(border.detail, surface.ink.hex, 1)
        .strokeRect(x, boxY, boxSize, boxSize);
      objects.push(box);
      const check = scene.add
        .text(x + boxSize / 2, boxY + boxSize / 2, "✓", { ...textStyle(ROW_TYPE, surface.paper.hex) })
        .setOrigin(0.5, 0.5);
      objects.push(check);
    } else {
      const box = scene.add.graphics();
      box
        .lineStyle(border.detail, current ? surface.paper.hex : surface.ink.hex, 1)
        .strokeRect(x, boxY, boxSize, boxSize);
      objects.push(box);
      const number = scene.add
        .text(x + boxSize / 2, boxY + boxSize / 2, String((opts.index ?? 0) + 1), {
          ...textStyle({ ...ROW_TYPE, size: 10 }, textColor),
        })
        .setOrigin(0.5, 0.5);
      objects.push(number);
    }

    const labelText = scene.add
      .text(x + boxSize + 10, y + height / 2, opts.label, { ...textStyle(ROW_TYPE, textColor) })
      .setOrigin(0, 0.5)
      .setWordWrapWidth(width - boxSize - 10 - (opts.trailing ? 50 : 0), true);
    objects.push(labelText);

    if (opts.trailing) {
      const trailing = scene.add
        .text(x + width, y + height / 2, opts.trailing, { ...textStyle(ROW_TYPE, textColor) })
        .setOrigin(1, 0.5);
      objects.push(trailing);
    }

    if (opts.detail) {
      const detail = scene.add
        .text(x + boxSize + 10, y + height - 4, opts.detail, {
          ...textStyle({ ...typeRole.mono, size: 9 }, textColor, ink.secondary),
        })
        .setOrigin(0, 1);
      objects.push(detail);
    }

    let focusable: FocusTarget | null = null;
    if (opts.onClick) {
      const zoneHeight = Math.max(height, hit.target);
      const zone = scene.add
        .zone(x, y + height / 2 - zoneHeight / 2, width, zoneHeight)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerup", () => opts.onClick?.());
      objects.push(zone);
      focusable = { rect: { x, y, width, height }, activate: () => opts.onClick?.() };
    }

    return { objects, focusable };
  }

  #openTooltip(term: TermTextTerm, anchorRect: Rect): void {
    const content = tooltipContentOf(term);
    if (!content || !this.#rect) return;
    this.#body?.setTermsEnabled((id) => id === term.id);
    this.#tooltip.show(
      anchorRect,
      content,
      this.#rect,
      () => this.#options.onOpenGlossary?.(content.title),
      () => this.#body?.setTermsEnabled(() => true),
    );
  }

  /** Every focusable control's own on-screen rect, for a headless click-through to find canvas-drawn controls. */
  debugRects(): { readonly focusables: readonly Rect[]; readonly tooltipLink: Rect | null } {
    return { focusables: this.#focusables.map((f) => f.rect), tooltipLink: this.#tooltip.linkRect };
  }

  /**
   * Every term the body resolved, in reading order, at their real *on-screen* position (mirrors
   * `McGuideCallout#debugTermRects`) — when the body is scrolling, its objects sit in `McScrollRegion`'s own
   * content-space (`ui/scroll-region.ts`'s header: real `x`, content-relative `y`), so the current scroll
   * offset is subtracted back out here, the same amount `McScrollRegion` itself applies via `content.setPosition`.
   */
  debugTermRects(): readonly { readonly id: string; readonly rect: Rect }[] {
    const body = this.#body;
    if (!body) return [];
    const dx = body.container.x;
    const dy = body.container.y - (this.#scrollRegion ? this.#bodyScroll.offsetPx : 0);
    return body.debugTermRects().map(({ id, rect }) => ({ id, rect: { ...rect, x: rect.x + dx, y: rect.y + dy } }));
  }

  /** Tab-cycles the panel's own buttons/rows — not the body's terms. */
  focusNext(direction: 1 | -1 = 1): boolean {
    if (this.#focusables.length === 0) return false;
    this.#focusIndex = (this.#focusIndex + direction + this.#focusables.length) % this.#focusables.length;
    this.#drawFocusRing();
    return true;
  }

  activateFocused(): void {
    this.#focusables[this.#focusIndex]?.activate();
  }

  /** The Enter shortcut: fires the primary action directly, regardless of Tab focus. No-op with no primary. */
  activatePrimary(): void {
    if (this.#primaryLabel) this.#options.onPrimary?.();
  }

  blur(): void {
    this.#focusIndex = -1;
    this.#focusRing.clear();
  }

  #drawFocusRing(): void {
    this.#focusRing.clear();
    const target = this.#focusables[this.#focusIndex];
    if (!target) return;
    this.#focusRing
      .lineStyle(border.control, surface.ink.hex, 1)
      .strokeRect(target.rect.x - 3, target.rect.y - 3, target.rect.width + 6, target.rect.height + 6);
  }

  /** Mirrors `McGuideCallout#handleEscape` (`docs/guided-mode.md` §7): closes an open tooltip first, then skips. */
  handleEscape(): boolean {
    if (this.#tooltip.handleEscape()) return true;
    if (this.#options.onSkip) {
      this.#options.onSkip();
      return true;
    }
    return false;
  }

  #teardown(): void {
    for (const object of this.#objects) object.destroy();
    this.#objects = [];
    this.#body?.destroy();
    this.#body = null;
    this.#scrollRegion?.destroy();
    this.#scrollRegion = null;
  }

  destroy(): void {
    this.#teardown();
    this.#tooltip.destroy();
    this.#focusRing.destroy();
    this.container.destroy(true);
  }
}
