/**
 * The Balanced prompt (issue #609): shown when a Galaxy's Most Wanted campaign is started, before the Roster. Play as
 * normal (the default) or Rebalance the campaign, with the changes listed and four optional toggles that put some
 * challenge back. Everything it says and every verdict comes from `view/campaign-balanced-model.ts`; where its columns
 * sit comes from `view/campaign-balanced-layout.ts`. This scene draws them and wires the taps.
 *
 * The body scrolls (`McScrollRegion`) when it runs past the action bar; the Continue button lives in the action bar,
 * outside the region, so no control sits over a scrolling area. Every other control uses `McButton`'s press rule.
 */
import Phaser from "phaser";
import { accent, ink, surface, typeRole } from "../../tokens.js";
import {
  actionBarCta,
  bangers,
  campaignCoverPicture,
  campaignFrame,
  drawPicture,
  villainPicture,
  drawActionBar,
  drawTopBar,
  ruleHeading,
} from "../../ui/campaign-chrome.js";
import { campaignActionButton } from "../../ui/campaign-buttons-a.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { McScrollRegion } from "../../ui/scroll-region.js";
import { captureIntoRegion } from "../../ui/scroll-capture.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import {
  PANE_ART_ALPHA,
  PANE_VEIL_ALPHA,
  PANE_VEIL_COLOR,
  campaignFadeFillOf,
} from "../../view/campaign-fade-color.js";
import type { CampaignFadeColor } from "../../settings.js";
import { CAMPAIGN_RECORDS } from "../../campaign/campaign-service.js";
import { appSession } from "../../session.js";
import { fitText, McButton } from "../../ui/widgets.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { openExternal } from "../../platform/platform.js";
import { inputDevice } from "../../platform/input-device.js";
import { VariableListScroll } from "../../view/variable-list-scroll.js";
import type { Rect } from "../../view/layout.js";
import {
  balancedPaneOf,
  balancedScreenOf,
  balancedStartOf,
  balancedStopOrder,
  NORMAL_CHOICE,
  withBalanced,
  withToggle,
  type BalancedChoice,
  type BalancedPane,
  type BalancedScreen,
} from "../../view/campaign-balanced-model.js";
import { balancedLayoutOf, type BalancedLayout } from "../../view/campaign-balanced-layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import type { GlyphHints } from "../../ui/glyph-hints.js";
import { createHints, forwardHint } from "./pad-hints.js";
import { SCENES } from "../keys.js";
import type { CampaignBalancedData } from "./routes.js";

/** A mode card or toggle row never gets shorter than a comfortable touch target. */
const ROW_MIN_HEIGHT = 64;
const ROW_PAD = 14;
/** The radio ring or checkbox at a row's left. */
const MARK_SIZE = 20;
/** The ON / OFF pill at a toggle row's right. */
const PILL_WIDTH = 52;

export class CampaignBalancedScene extends Phaser.Scene {
  #data: CampaignBalancedData = { campaignId: "" };
  #choice: BalancedChoice = NORMAL_CHOICE;
  #route: FocusRoute | null = null;
  #hints: GlyphHints | null = null;
  #buttons: McButton[] = [];
  #scroll = new VariableListScroll();
  #region: McScrollRegion | null = null;
  #firstDraw = true;
  /** The faded-art setting as last drawn; null before the first draw. */
  #artShown: boolean | null = null;
  #fadeShown: CampaignFadeColor = "grey";

  constructor() {
    super(SCENES.campaignBalanced);
  }

  create(data: CampaignBalancedData): void {
    this.#data = data;
    this.#choice = NORMAL_CHOICE;
    this.#scroll = new VariableListScroll();
    this.#firstDraw = true;
    // Settings never opens over this page, so the faded-art choices are read once, as it opens.
    this.#artShown = this.#artOn();
    this.#fadeShown = appSession().settings.campaignFadeColor;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#hints = createHints(this);
    // Start and A with nothing focused: Continue to the roster.
    this.#route = new FocusRoute(this, {
      onCancel: () => this.#back(),
      primary: () => "cta",
      onScroll: (_dx, dy) => this.#region?.scrollByPx(dy),
    });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#destroyButtons();
      this.#region = null;
    });
    this.#draw();
    fadeScreenIn(this);
  }

  #back(): void {
    goToScreen(this, SCENES.campaignCover, { campaignId: this.#data.campaignId });
  }

  #continue(): void {
    const balanced = balancedStartOf(this.#choice);
    goToScreen(this, SCENES.campaignRoster, {
      campaignId: this.#data.campaignId,
      ...(this.#data.expertCampaign ? { expertCampaign: true } : {}),
      ...(balanced ? { balanced } : {}),
    });
  }

  #destroyButtons(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
  }

  #draw(): void {
    this.#hints?.reset();
    this.#destroyButtons();
    this.#region?.destroy();
    this.#region = null;
    destroyChildren(this);
    const frame = campaignFrame(this);
    const layout = balancedLayoutOf(frame.width, frame.gutter);
    const screen = balancedScreenOf(this.#choice, this.#data.expertCampaign === true);
    const stops = new Map<string, FocusStop>();

    const top = drawTopBar(this, {
      backLabel: "◂ Cover",
      onBack: () => this.#back(),
      hints: this.#hints,
      title: screen.title,
    });
    if (top.backRect) stops.set("back", { rect: top.backRect, activate: () => this.#back() });

    const bar = drawActionBar(this);
    const ctaRect = actionBarCta(bar, frame.phone);
    const cta = new McButton(this, {
      kind: "primary",
      label: screen.cta,
      type: typeRole.barTitle,
      rect: ctaRect,
      onClick: () => this.#continue(),
    });
    this.#buttons.push(cta);
    forwardHint(this.#hints, cta, "ink");
    stops.set("cta", { rect: ctaRect, activate: () => this.#continue() });

    const body: Rect = { x: 0, y: top.height, width: frame.width, height: bar.y - top.height };
    // The tablet and desktop pane is fixed: drawn under the scrolling body, as tall as the body.
    if (layout.pane)
      this.#drawPaneBackground({ x: layout.pane.x, y: body.y, width: layout.pane.width, height: body.height });
    const heights: number[] = [1_000_000];
    const region = new McScrollRegion(this, { rect: body, heights, scroll: this.#scroll, clipInteractive: true });
    this.#region = region;
    const contentStart = this.children.list.length;
    const stopsBefore = new Set(stops.keys());

    const pad = frame.gutter;
    const startY = body.y + pad;
    const pane = balancedPaneOf(this.#choice);
    let bottom = this.#drawIntro(layout, screen, startY, body, stops);
    bottom = this.#drawCredit(layout, layout.primary, screen, bottom + layout.gap, body, stops);
    if (layout.pane) {
      bottom = Math.max(bottom, this.#drawPane(layout, screen, pane, layout.paneInner, startY, body, stops));
    } else {
      // A phone: the pane stacks below the choice, full width, scrolling with it.
      const paneTop = bottom + layout.gap;
      const paneStart = this.children.list.length;
      const inner = { x: pad, width: frame.width - pad * 2 };
      const paneBottom = this.#drawPane(layout, screen, pane, inner, paneTop + pad, body, stops);
      this.#drawPaneBackground({ x: 0, y: paneTop, width: frame.width, height: paneBottom + pad - paneTop }, paneStart);
      bottom = paneBottom + pad;
    }

    captureIntoRegion(this, {
      region,
      heights,
      scroll: this.#scroll,
      fromIndex: contentStart,
      stops,
      stopsBefore,
      viewportTop: body.y,
      viewportBottom: body.y + body.height,
      bottom,
      padBottom: layout.pane ? pad : 0,
    });
    region.syncInteractivity();

    const order = balancedStopOrder(this.#choice).filter((key) => stops.has(key));
    this.#route?.set(order, stops);
    // Play as normal is where a controller or keyboard starts; a mouse or touch has no ring to show.
    if (this.#firstDraw) {
      this.#firstDraw = false;
      const mode = inputDevice().mode;
      if (mode === "pad" || mode === "keyboard") this.#route?.focusKey("mode-normal");
    }
  }

  /** The faded-art setting, read as the page is drawn. */
  #artOn(): boolean {
    return appSession().settings.fadedCampaignArt;
  }

  /**
   * The coloured pane's ground: the chosen fade color (Settings, grey to begin with) with the box art faded over it
   * (cover-fitted into the pane, never stretched) unless Settings turns the art off, and a dark veil that keeps the
   * pale text readable on any picture. `moveTo` slots it under text already drawn (the phone's stacked pane).
   */
  #drawPaneBackground(rect: Rect, moveTo?: number): void {
    const made: Phaser.GameObjects.GameObject[] = [];
    const ground = this.add.graphics();
    ground.fillStyle(campaignFadeFillOf(this.#fadeShown), 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    made.push(ground);
    if (this.#artShown) {
      const id = this.#data.campaignId;
      const finale = CAMPAIGN_RECORDS[id]?.scenarioIds.at(-1) as string | undefined;
      const picture = campaignCoverPicture(id) ?? (finale ? villainPicture(finale) : null);
      const image = drawPicture(this, picture, rect, () => this.sys.isActive() && this.#draw(), {
        focusY: 0.2,
        alpha: PANE_ART_ALPHA,
      });
      if (image) made.push(image);
    }
    const veil = this.add.graphics();
    veil.fillStyle(PANE_VEIL_COLOR, PANE_VEIL_ALPHA).fillRect(rect.x, rect.y, rect.width, rect.height);
    veil.lineStyle(3, surface.inkOnHue.hex, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);
    made.push(veil);
    if (moveTo !== undefined) made.forEach((object, index) => this.children.moveTo(object, moveTo + index));
  }

  // ---- Left column: why, the choice, the credit -------------------------------------------------------------------

  #drawIntro(
    layout: BalancedLayout,
    screen: BalancedScreen,
    top: number,
    body: Rect,
    stops: Map<string, FocusStop>,
  ): number {
    const { x, width } = layout.primary;
    const heading = this.add
      .text(x, top, screen.heading.toUpperCase(), textStyle(bangers(layout.headingSize + 6), surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(width);
    let y = top + heading.height + 10;
    y = this.#paragraph(x, y, width, screen.why, layout.textSize, ink.secondary) + 8;
    y = this.#paragraph(x, y, width, screen.unofficial, layout.textSize, ink.secondary) + 8;
    y = this.#paragraph(x, y, width, screen.cost, layout.textSize, 1, true) + layout.gap;
    y = this.#modeCard(layout, "mode-normal", screen.normal, { x, y, width }, () => this.#setMode(false), body, stops);
    y = this.#modeCard(
      layout,
      "mode-rebalance",
      screen.rebalance,
      { x, y: y + 10, width },
      () => this.#setMode(true),
      body,
      stops,
    );
    return y;
  }

  #setMode(balanced: boolean): void {
    if (this.#choice.balanced === balanced) return;
    this.#choice = withBalanced(this.#choice, balanced);
    this.#draw();
  }

  #toggle(id: Parameters<typeof withToggle>[1]): void {
    this.#choice = withToggle(this.#choice, id);
    this.#draw();
  }

  #drawCredit(
    layout: BalancedLayout,
    column: { readonly x: number; readonly width: number },
    screen: BalancedScreen,
    top: number,
    body: Rect,
    stops: Map<string, FocusStop>,
  ): number {
    const rect: Rect = { x: column.x, y: top, width: column.width, height: 60 };
    const open = (): void => openExternal(screen.credit.url);
    this.#buttons.push(
      campaignActionButton(this, {
        kind: "secondary",
        rect,
        title: screen.credit.line,
        subtitle: `${screen.credit.linkLabel} ↗`,
        titleSize: layout.kind === "phone" ? 15 : 17,
        onClick: open,
      }),
    );
    stops.set("credit", { rect, activate: open, view: body });
    return rect.y + rect.height;
  }

  // ---- The pane: more about the option picked, and the toggles --------------------------------------------------------

  #drawPane(
    layout: BalancedLayout,
    screen: BalancedScreen,
    pane: BalancedPane,
    column: { readonly x: number; readonly width: number },
    top: number,
    body: Rect,
    stops: Map<string, FocusStop>,
  ): number {
    const { x, width } = column;
    // Pale on the blue in light and dark mode alike (the ink text color turns light in dark mode, so it is not used).
    const light = surface.paperOnInk.hex;
    const heading = this.add
      .text(x, top, pane.heading.toUpperCase(), textStyle(bangers(layout.headingSize + 6), light))
      .setOrigin(0, 0)
      .setWordWrapWidth(width);
    let y = top + heading.height + 8;
    y = this.#paragraph(x, y, width, pane.intro, layout.textSize, 1, false, light) + 10;
    y = ruleHeading(this, x, y, width, pane.groupsHeading, light, layout.headingSize - 2);
    for (const group of pane.groups) {
      const label = this.add
        .text(x, y, group.heading.toUpperCase(), textStyle(typeRole.label, light, 1))
        .setLetterSpacing(1);
      y += label.height + 2;
      for (const line of group.lines) y = this.#bullet(x, y, width, line, layout.textSize, light) + 2;
      y += 2;
    }
    y = this.#paragraph(x, y, width, pane.footnote, layout.textSize, 1, true, light) + 4;
    if (pane.showToggles) {
      y = ruleHeading(this, x, y + 2, width, screen.togglesHeading, light, layout.headingSize - 2);
      y = this.#paragraph(x, y - 6, width, screen.togglesNote, layout.textSize, 1, false, light) + 4;
      for (const row of screen.toggles) {
        y = this.#toggleRow(layout, row, { x, y, width }, () => this.#toggle(row.id), body, stops) + layout.gap;
      }
    }
    return y;
  }

  // ---- Pieces ------------------------------------------------------------------------------------------------------

  /** Wrapped body text at `(x, y)`; returns its bottom edge. */
  #paragraph(
    x: number,
    y: number,
    width: number,
    text: string,
    size: number,
    alpha: number,
    bold = false,
    color: number = surface.ink.hex,
  ): number {
    const t = this.add.text(x, y, text, {
      ...textStyle(bold ? typeRole.emphasis : typeRole.body, color, alpha),
      fontSize: `${size}px`,
      wordWrap: { width, useAdvancedWrap: true },
    });
    return y + t.height;
  }

  /** A change line with a square bullet (shape, not color, marks the list). */
  #bullet(x: number, y: number, width: number, text: string, size: number, color: number = surface.ink.hex): number {
    this.add.rectangle(x + 4, y + size * 0.6, 5, 5, color).setOrigin(0.5);
    return this.#paragraph(x + 16, y, width - 16, text, size, 1, false, color);
  }

  /**
   * The shared card/row shape: a whole-row button, a frame (heavy red while chosen), a name and one wrapped line. The
   * texts are measured before the frame so the row fits them, then lifted above the button's hover ground.
   */
  #row(
    layout: BalancedLayout,
    key: string,
    spec: {
      readonly title: string;
      readonly detail: string;
      readonly chosen: boolean;
      /** Drawn in the left mark column. */
      readonly mark: (rect: Rect) => void;
      /** Room kept clear at the right edge (the ON / OFF pill). */
      readonly rightRoom: number;
      readonly right?: (rect: Rect) => void;
    },
    at: { readonly x: number; readonly y: number; readonly width: number },
    activate: () => void,
    body: Rect,
    stops: Map<string, FocusStop>,
  ): number {
    const textX = at.x + ROW_PAD + MARK_SIZE + 12;
    const textWidth = at.width - (textX - at.x) - ROW_PAD - spec.rightRoom;
    const size = layout.kind === "phone" ? 15 : 17;
    const name = this.add
      .text(textX, at.y + ROW_PAD, spec.title.toUpperCase(), textStyle(bangers(size), surface.ink.hex, 1))
      .setOrigin(0, 0);
    name.setWordWrapWidth(textWidth);
    const detail = this.add
      .text(textX, name.y + name.height + 4, spec.detail, {
        ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        fontSize: `${layout.textSize - 1}px`,
        wordWrap: { width: textWidth, useAdvancedWrap: true },
      })
      .setOrigin(0, 0);
    const height = Math.max(ROW_MIN_HEIGHT, name.height + 4 + detail.height + ROW_PAD * 2);
    const rect: Rect = { x: at.x, y: at.y, width: at.width, height };
    const ground = this.add.graphics();
    ground.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    // Above the card's ground and below its frame, so the button's hover and press ground shows.
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "", type: typeRole.label, rect, onClick: activate }));
    const g = this.add.graphics();
    if (spec.chosen)
      g.lineStyle(4, accent.heroRed.hex, 1).strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
    else g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    spec.mark(rect);
    spec.right?.(rect);
    // The text goes on top of the frame and the button's hover ground.
    this.children.bringToTop(name);
    this.children.bringToTop(detail);
    stops.set(key, { rect, activate, view: body });
    return rect.y + rect.height;
  }

  /** A mode choice: a radio ring (filled when chosen) and the word SELECTED, so the choice never rests on color. */
  #modeCard(
    layout: BalancedLayout,
    key: string,
    card: BalancedScreen["normal"],
    at: { readonly x: number; readonly y: number; readonly width: number },
    activate: () => void,
    body: Rect,
    stops: Map<string, FocusStop>,
  ): number {
    return this.#row(
      layout,
      key,
      {
        title: card.title,
        detail: card.detail,
        chosen: card.selected,
        rightRoom: card.selected ? 86 : 0,
        mark: (rect) => {
          const g = this.add.graphics();
          const cx = rect.x + ROW_PAD + MARK_SIZE / 2;
          const cy = rect.y + ROW_PAD + 10;
          g.lineStyle(2, surface.ink.hex, 1).strokeCircle(cx, cy, 9);
          if (card.selected) g.fillStyle(accent.heroRed.hex, 1).fillCircle(cx, cy, 5);
        },
        right: (rect) => {
          if (!card.selected) return;
          this.add
            .text(
              rect.x + rect.width - ROW_PAD,
              rect.y + ROW_PAD + 2,
              "✓ SELECTED",
              textStyle(typeRole.label, accent.heroRed.hex, 1),
            )
            .setOrigin(1, 0)
            .setLetterSpacing(0.8);
        },
      },
      at,
      activate,
      body,
      stops,
    );
  }

  /** A toggle row: a checkbox mark and an ON / OFF pill, so its state is shown in words and shape. */
  #toggleRow(
    layout: BalancedLayout,
    row: BalancedScreen["toggles"][number],
    at: { readonly x: number; readonly y: number; readonly width: number },
    activate: () => void,
    body: Rect,
    stops: Map<string, FocusStop>,
  ): number {
    return this.#row(
      layout,
      `toggle-${row.id}`,
      {
        title: row.label,
        detail: row.detail,
        chosen: row.on,
        rightRoom: PILL_WIDTH + 8,
        mark: (rect) => {
          const g = this.add.graphics();
          const bx = rect.x + ROW_PAD;
          const by = rect.y + ROW_PAD + 1;
          g.lineStyle(2, surface.ink.hex, 1).strokeRect(bx, by, 20, 20);
          if (row.on) {
            g.lineStyle(3, accent.heroRed.hex, 1)
              .beginPath()
              .moveTo(bx + 4, by + 10)
              .lineTo(bx + 9, by + 15)
              .lineTo(bx + 17, by + 5)
              .strokePath();
          }
        },
        right: (rect) => {
          const px = rect.x + rect.width - ROW_PAD - PILL_WIDTH;
          const py = rect.y + ROW_PAD;
          const pill = this.add.graphics();
          if (row.on) pill.fillStyle(surface.ink.hex, 1).fillRect(px, py, PILL_WIDTH, 24);
          else pill.lineStyle(2, surface.ink.hex, 1).strokeRect(px + 1, py + 1, PILL_WIDTH - 2, 22);
          const label = this.add
            .text(
              px + PILL_WIDTH / 2,
              py + 12,
              row.on ? "ON" : "OFF",
              textStyle(typeRole.label, row.on ? surface.paper.hex : surface.ink.hex, 1),
            )
            .setOrigin(0.5);
          fitText(label, PILL_WIDTH - 8, 12);
        },
      },
      at,
      activate,
      body,
      stops,
    );
  }
}
