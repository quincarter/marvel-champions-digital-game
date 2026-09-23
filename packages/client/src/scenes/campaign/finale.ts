/**
 * C11 — Finale: the campaign's own last page (docs/campaign-mode-design.md §10.2). Reached only for a won run
 * (`Aftermath`'s `#onFolded` routes here the moment `record.status === "won"`); this screen only reads the
 * finished record (`view/campaign-finale-model.ts`) and the box's story (`campaign/story.ts`).
 *
 * Handles 1, 3 or 4 heroes gracefully: the design's own comic grid is drawn for MC10's two heroes, but the hero
 * panel column simply stacks however many seats the run actually had, and `finaleHeroLineFor` reuses the story's
 * last written line for a roster longer than the box wrote dialogue for.
 */
import Phaser from "phaser";
import { storyFor } from "../../campaign/story.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { campaignService } from "../../session.js";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import { campaignFrame, drawPicture, heroPicture, speechBubble, villainPicture } from "../../ui/campaign-chrome.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { McButton, fitText, label } from "../../ui/widgets.js";
import { finaleHeroLineFor, finaleViewOf, type FinaleView } from "../../view/campaign-finale-model.js";
import type { Rect } from "../../view/layout.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignFinaleData } from "./routes.js";

export class CampaignFinaleScene extends Phaser.Scene {
  #data!: CampaignFinaleData;
  #record: CampaignRecord | null = null;
  #view: FinaleView | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.campaignFinale);
  }

  init(data: CampaignFinaleData): void {
    this.#data = data;
    this.#record = null;
    this.#view = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(signal.caution.hex));
    this.scale.on("resize", this.#draw, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#draw, this));
    void this.#load();
    fadeScreenIn(this);
  }

  async #load(): Promise<void> {
    const service = campaignService();
    const record = await service.load(this.#data.runId);
    if (!this.sys.isActive()) return;
    if (!record) {
      goToScreen(this, SCENES.campaignSaga);
      return;
    }
    this.#record = record;
    const definition = service.definitionFor(record);
    this.#view = finaleViewOf(definition, record);
    this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    const { width, height, phone } = campaignFrame(this);
    this.add.rectangle(0, 0, width, height, signal.caution.hex).setOrigin(0, 0);
    this.#dotGrid(width, height);

    const record = this.#record;
    const view = this.#view;
    if (!record || !view) return;
    const story = storyFor(record.campaignId as string)?.finale ?? null;
    const lastNodeId = campaignService().definitionFor(record).graph.nodes.at(-1)?.id ?? "";

    const order: string[] = [];
    const stops = new Map<string, FocusStop>();
    if (phone) this.#drawPhone(width, height, view, story, lastNodeId, order, stops);
    else this.#drawWide(width, height, view, story, lastNodeId, order, stops);

    this.#route = this.#route ?? new FocusRoute(this);
    this.#route.set(order, stops);
  }

  #dotGrid(width: number, height: number): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 0.18);
    for (let y = 6; y < height; y += 10) for (let x = 6; x < width; x += 10) g.fillCircle(x, y, 1);
  }

  /** The tile's own margin around the comic grid — and the gutter before the right column. */
  static readonly #MARGIN = 24;

  #drawWide(
    width: number,
    height: number,
    view: FinaleView,
    story: NonNullable<ReturnType<typeof storyFor>>["finale"] | null,
    lastNodeId: string,
    order: string[],
    stops: Map<string, FocusStop>,
  ): void {
    const m = CampaignFinaleScene.#MARGIN;
    const gridRect: Rect = { x: m, y: m, width: Math.round(width * 0.585) - m, height: height - m * 2 };
    this.#drawComicGrid(gridRect, story, lastNodeId);

    const rightX = gridRect.x + gridRect.width + m;
    this.#drawCopy(
      { x: rightX, y: m, width: width - rightX - m, height: height - m * 2 },
      view,
      story,
      order,
      stops,
      false,
    );
  }

  #drawPhone(
    width: number,
    height: number,
    view: FinaleView,
    story: NonNullable<ReturnType<typeof storyFor>>["finale"] | null,
    lastNodeId: string,
    order: string[],
    stops: Map<string, FocusStop>,
  ): void {
    const m = CampaignFinaleScene.#MARGIN;
    const gridHeight = Math.round(height * 0.42);
    this.#drawComicGrid({ x: m, y: m, width: width - m * 2, height: gridHeight }, story, lastNodeId);
    this.#drawCopy(
      { x: m, y: gridHeight + m * 2, width: width - m * 2, height: height - gridHeight - m * 3 },
      view,
      story,
      order,
      stops,
      true,
    );
  }

  /** The comic grid: a tall villain panel on the left, one stacked hero panel per seat on the right. */
  #drawComicGrid(
    rect: Rect,
    story: NonNullable<ReturnType<typeof storyFor>>["finale"] | null,
    lastNodeId: string,
  ): void {
    const record = this.#record;
    const border = this.add.graphics();
    border.lineStyle(3, surface.ink.hex, 1);

    // A thin yellow gutter between panels — the tile's own comic-grid gaps, not panels touching edge to edge.
    const gap = 8;
    const villainWidth = Math.round(rect.width * 0.58) - gap / 2;
    const villainRect: Rect = { x: rect.x, y: rect.y, width: villainWidth, height: rect.height };
    border.strokeRect(villainRect.x, villainRect.y, villainRect.width, villainRect.height);
    const picture = villainPicture(lastNodeId);
    drawPicture(this, picture, villainRect, () => this.#draw(), { focusY: 0.2 });
    if (story) {
      speechBubble(
        this,
        villainRect.x + 8,
        villainRect.y + 8,
        Math.min(320, villainRect.width - 16),
        story.villainLine,
        {
          tail: "none",
        },
      );
      // Bottom-left, big and tilted — the tile's own lettered SFX, not a corner caption.
      this.add
        .text(villainRect.x + 12, villainRect.y + villainRect.height - 16, story.sfx.toUpperCase(), {
          ...textStyle({ ...typeRole.barTitle, size: 60 }, accent.heroRed.hex),
          stroke: cssOf(surface.paper.hex),
          strokeThickness: 5,
        })
        .setOrigin(0, 1)
        .setAngle(-8);
    }

    const heroX = villainRect.x + villainRect.width + gap;
    const heroWidth = rect.x + rect.width - heroX;
    const seats = record?.seats ?? [];
    const count = Math.max(1, seats.length);
    const heroHeight = (rect.height - gap * (count - 1)) / count;
    seats.forEach((seat, index) => {
      const heroRect: Rect = { x: heroX, y: rect.y + index * (heroHeight + gap), width: heroWidth, height: heroHeight };
      border.strokeRect(heroRect.x, heroRect.y, heroRect.width, heroRect.height);
      const heroArt = heroPicture(seat.identityCardId as string);
      drawPicture(this, heroArt, heroRect, () => this.#draw(), { focusY: 0.1 });
      const line = story ? finaleHeroLineFor(story.heroLines, index) : "";
      if (line) {
        speechBubble(
          this,
          heroRect.x + 8,
          heroRect.y + heroRect.height - 46,
          Math.min(260, heroRect.width - 16),
          line,
          {
            tail: "none",
            size: 12,
          },
        );
      }
    });
    // The pictures are separate display objects added after `border`, so they'd otherwise paint over its lines.
    this.children.bringToTop(border);
  }

  /**
   * The caption/headline/stats/CTAs block, bottom-aligned within `rect` — the tile ends it near the bottom of the
   * screen, not pinned to the top. Laid out once at `rect.y` to get its real height (the caption box and headline
   * both wrap), then every object it created is shifted down by the leftover headroom.
   */
  #drawCopy(
    rect: Rect,
    view: FinaleView,
    story: NonNullable<ReturnType<typeof storyFor>>["finale"] | null,
    order: string[],
    stops: Map<string, FocusStop>,
    phone: boolean,
  ): void {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const buttons: { readonly button: McButton; readonly rect: Rect }[] = [];
    const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
      objects.push(object);
      return object;
    };
    const button = (options: import("../../ui/widgets.js").McButtonOptions): McButton => {
      const instance = new McButton(this, options);
      this.#buttons.push(instance);
      buttons.push({ button: instance, rect: options.rect });
      return instance;
    };

    let y = rect.y;
    if (story) {
      const box = add(this.add.graphics());
      const text = add(
        this.add
          .text(rect.x + 12, y + 10, story.caption.toUpperCase(), {
            ...textStyle(typeRole.label, surface.ink.hex, 1),
            fontStyle: "italic 700",
          })
          .setFontSize(12)
          .setWordWrapWidth(rect.width - 24),
      );
      const boxHeight = text.height + 20;
      box.fillStyle(surface.paper.hex, 1).fillRect(rect.x, y, rect.width, boxHeight);
      box.lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x, y, rect.width, boxHeight);
      this.children.bringToTop(text);
      y += boxHeight + 16;
    }

    const headline = add(
      this.add
        .text(rect.x, y, (story?.headline ?? "The campaign is won.").split(" ").join("\n"), {
          ...textStyle({ ...typeRole.barTitle, size: phone ? 44 : 64 }, surface.ink.hex),
        })
        .setOrigin(0, 0)
        .setLineSpacing(-8),
    );
    fitText(headline, rect.width, phone ? 44 : 64);
    y = headline.y + headline.height + 20;

    const stats: readonly { readonly label: string; readonly value: string }[] = [
      { label: "Issues", value: `${view.stats.issuesCompleted}/${view.stats.issuesTotal}` },
      { label: "Rewinds", value: String(view.stats.rewinds) },
      { label: "Allies freed", value: String(view.stats.alliesFreed) },
    ];
    const statGap = 10;
    const boxWidth = (rect.width - statGap * 2) / 3;
    stats.forEach((stat, index) => {
      const x = rect.x + index * (boxWidth + statGap);
      const g = add(this.add.graphics());
      g.fillStyle(surface.paper.hex, 1).fillRect(x, y, boxWidth, 66);
      g.lineStyle(2, surface.ink.hex, 1).strokeRect(x, y, boxWidth, 66);
      add(label(this, x + 10, y + 8, stat.label, typeRole.label, surface.ink.hex, ink.meta)).setFontSize(10);
      fitText(
        add(this.add.text(x + 10, y + 24, stat.value, textStyle({ ...typeRole.barTitle, size: 26 }, surface.ink.hex))),
        boxWidth - 20,
        26,
      );
    });
    y += 66 + 20;

    const primaryLabel = view.alreadyExpert ? "Back to the saga ▸" : "Expert campaign unlocked ▸";
    const primaryRect: Rect = { x: rect.x, y, width: rect.width, height: 54 };
    button({
      kind: "primary",
      label: primaryLabel,
      type: typeRole.barTitle,
      rect: primaryRect,
      onClick: () => this.#onPrimary(),
    });
    order.push("primary");
    stops.set("primary", { rect: primaryRect, activate: () => this.#onPrimary() });
    y += 54 + 10;

    // "Reread the run" reads as an outline on the page itself — the tile's ground colour, an ink border, a Bangers
    // label — not the paper-filled "secondary" skin, which none of `skin()`'s kinds draw, so this is hand-drawn.
    const rereadRect: Rect = { x: rect.x, y, width: rect.width, height: 48 };
    this.#drawOutlineButton(rereadRect, "Reread the run", () => this.#reread(), order, stops, "reread", add);
    y += 48;

    const bottom = y;
    const offset = Math.max(0, rect.y + rect.height - bottom);
    if (offset <= 0) return;
    for (const object of objects) {
      const positioned = object as Phaser.GameObjects.GameObject & { y?: number; setY?: (y: number) => unknown };
      if (typeof positioned.y === "number" && positioned.setY) positioned.setY(positioned.y + offset);
    }
    for (const { button: instance, rect: buttonRect } of buttons) {
      instance.update({ rect: { ...buttonRect, y: buttonRect.y + offset } });
    }
    const reread = stops.get("reread");
    if (reread) stops.set("reread", { ...reread, rect: { ...rereadRect, y: rereadRect.y + offset } });
  }

  /** A ground-coloured, ink-outlined Bangers button — `skin()` has no kind that draws this, so it's hand-drawn. */
  #drawOutlineButton(
    rect: Rect,
    text: string,
    onClick: () => void,
    order: string[],
    stops: Map<string, FocusStop>,
    key: string,
    add: <T extends Phaser.GameObjects.GameObject>(object: T) => T,
  ): void {
    const g = add(this.add.graphics());
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    add(
      this.add
        .text(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          text.toUpperCase(),
          textStyle(typeRole.barTitle, surface.ink.hex),
        )
        .setOrigin(0.5),
    );
    const zone = add(this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive());
    (zone as Phaser.GameObjects.Zone).on("pointerup", onClick);
    order.push(key);
    stops.set(key, { rect, activate: onClick });
  }

  #onPrimary(): void {
    const record = this.#record;
    const view = this.#view;
    if (!record || !view) return;
    if (view.alreadyExpert) {
      goToScreen(this, SCENES.campaignSaga);
    } else {
      goToScreen(this, SCENES.campaignRoster, { campaignId: record.campaignId as string, expertCampaign: true });
    }
  }

  #reread(): void {
    const record = this.#record;
    if (!record) return;
    goToScreen(this, SCENES.campaignRun, { runId: record.id });
  }
}
