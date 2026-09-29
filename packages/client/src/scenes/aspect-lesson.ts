/**
 * The per-aspect lesson page (guided mode G10c, `docs/guided-mode.md` §3.7, §3.10, §5.4): "what Justice is for,
 * when to pick it, and its signature Core Set cards", then a "Try it" hand-off. `view/aspect-lesson-model.ts`'s
 * own header has the content/layout split this scene draws; visual voice follows `scenes/guide-chooser.ts` and
 * `scenes/how-to-win.ts` (paper ground, Bangers, ink/paper buttons, one red primary) with the aspect's own colour
 * (`view/aspect-stamp.ts`) as the page's accent — there is no design tile for this screen (§1: "the designs are
 * intent, not pixels").
 *
 * **Standalone for this box.** Wiring it into the "How to play" hub (`scenes/how-to-play.ts`'s own `#openAspectLesson`
 * wiring point, G6c) and the aspect chips' "Aspects ▸" link (`view/aspect-tip-model.ts`'s `linkAvailable`/
 * `linkReason`, G10b) is a follow-up once G6c lands. Reachable today only via `?screen=aspect&aspect=<id>`
 * (`scenes/boot.ts`).
 *
 * **Signature cards** are real scans (`art/card-art.ts`), each tappable to `SCENES.inspect`'s static-card mode
 * (`{ card: { cardId, face: { kind: "front" } } }`, the same call `scenes/decks.ts#inspectCard` and
 * `scenes/deck-check.ts` already make for a card with no live instance behind it).
 *
 * **"Try it with <Hero>"** is drawn dashed and unavailable ("Coming soon") — the guided Rhino run with that
 * aspect's Core precon is G10d, which doesn't exist yet (§4). `#onTryIt` below is the one wiring point: G10d only
 * has to flip the button's `enabled` and fill in that method's body, the same shape `how-to-play.ts`'s own
 * `#openAspectLesson` note leaves for this box. Never fake a game here (brief).
 *
 * **Mark as done** (§3.7: "ends with Try it") happens on "Got it", or the moment the page's own content is fully
 * visible with nothing left to scroll to — either the text column already fit without scrolling, or scrolling
 * reached its bottom. `guide/guide-prefs.ts#markAspectLessonDone` via `guide/guide-store.ts`, the same read/write
 * shape `scenes/how-to-win.ts#startTheFight` uses for `markLessonDone`.
 *
 * Back/×/Escape (§3.10 "every tutorial screen has Back") return to `AspectLessonSceneData.backTo`, Title by
 * default.
 */
import Phaser from "phaser";
import type { CoreAspect } from "@mc/content";
import { dotGrid, ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, label, paintDotGrid } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { McTermText } from "../ui/term-text.js";
import { McTooltip } from "../ui/tooltip.js";
import type { TermTextTerm } from "../view/term-text-model.js";
import { tooltipContentOf } from "../view/term-text-model.js";
import {
  aspectLessonContent,
  aspectLessonLayout,
  type AspectLessonContent,
  type AspectLessonLayout,
} from "../view/aspect-lesson-model.js";
import { aspectStampOf } from "../view/aspect-stamp.js";
import { CARD_ASPECT, type Rect } from "../view/layout.js";
import { CARDS_BY_ID } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { guidePrefs, setGuidePrefs } from "../guide/guide-store.js";
import { markAspectLessonDone } from "../guide/guide-prefs.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { InspectData } from "./inspect.js";

export interface AspectLessonSceneData {
  readonly aspect: CoreAspect;
  /** Set when the "How to play" hub or a chip's own "Aspects ▸" link launched this screen — Back/×/Escape
   * return there instead of Title. `"title"` (the default) covers every other entry point, including the
   * `?screen=aspect` dev jump. */
  readonly backTo?: "title" | "howToPlay";
}

const TITLE_TYPE: TypeSpec = typeRole.pageTitle;
const HEADING_TYPE: TypeSpec = typeRole.label;
const CARD_TITLE_TYPE: TypeSpec = { ...typeRole.barTitle, size: 16 };
const COLUMN_PAD = 4;
const SECTION_GAP = 18;

export class AspectLessonScene extends Phaser.Scene {
  #aspect: CoreAspect = "justice";
  #backTo: "title" | "howToPlay" = "title";
  #content: AspectLessonContent | null = null;
  #route: FocusRoute | null = null;
  #tooltip: McTooltip | null = null;
  #termBlocks: McTermText[] = [];
  #buttons: McButton[] = [];
  #textRegion: McScrollRegion | null = null;
  #cardsRegion: McScrollRegion | null = null;
  readonly #textScroll = new VariableListScroll();
  readonly #cardsScroll = new VariableListScroll();
  #done = false;

  constructor() {
    super(SCENES.aspectLesson);
  }

  create(data: AspectLessonSceneData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#aspect = data.aspect;
    this.#backTo = data.backTo === "howToPlay" ? "howToPlay" : "title";
    this.#content = aspectLessonContent(this.#aspect);
    this.#textScroll.reset();
    this.#cardsScroll.reset();
    this.#done = false;
    this.scale.on("resize", this.#rebuild, this);
    const artOff = cardArt(this).onArrived(() => this.#rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      artOff();
      this.#tooltip?.destroy();
      this.#tooltip = null;
      this.#textRegion?.destroy();
      this.#cardsRegion?.destroy();
    });
    this.#route = new FocusRoute(this, {
      onCancel: () => {
        if (this.#tooltip?.handleEscape()) return;
        this.#leave();
      },
    });
    this.#rebuild();
    fadeScreenIn(this);
  }

  #rebuild(): void {
    this.#tooltip?.destroy();
    this.#textRegion?.destroy();
    this.#textRegion = null;
    this.#cardsRegion?.destroy();
    this.#cardsRegion = null;
    destroyChildren(this);
    this.#tooltip = new McTooltip(this);
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    for (const block of this.#termBlocks) block.destroy();
    this.#termBlocks = [];

    const { width, height } = this.scale.gameSize;
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    const content = this.#content;
    if (!content) {
      this.#drawMissingContent(width, height);
      return;
    }

    const layout = aspectLessonLayout(width, height);
    const stamp = aspectStampOf(content.aspect);
    this.#drawHeader(layout, content, stamp);
    this.#drawBody(layout, content, stamp);
    this.#drawFooter(layout, content);

    // Headless click-through hook only, mirroring `scenes/how-to-win.ts`'s own `__mcHowToWinDebug`.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcAspectLessonDebug?: unknown }).__mcAspectLessonDebug = {
        termRects: () => this.#termBlocks.flatMap((block) => block.debugTermRects()),
      };
    }
  }

  #drawMissingContent(width: number, height: number): void {
    // 'Pool has no `AspectGuide` yet (§3.7) — this screen should never be reached for it, but fail visibly rather
    // than draw an empty page if it is (a stale link, a future 'Pool chip before its guide lands).
    this.add
      .text(width / 2, height / 2, "No lesson for this aspect yet.", textStyle(TITLE_TYPE, surface.ink.hex))
      .setOrigin(0.5);
    const back: Rect = { x: 16, y: 16, width: 100, height: 40 };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Back",
        type: typeRole.menuButton,
        rect: back,
        onClick: () => this.#leave(),
      }),
    );
    this.#route?.set(["back"], new Map([["back", { rect: back, activate: () => this.#leave() }]]));
  }

  #drawHeader(layout: AspectLessonLayout, content: AspectLessonContent, stamp: { fill: number; ink: number }): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(0, 0, this.scale.gameSize.width, layout.header.height);
    g.fillStyle(stamp.fill, 1).fillRect(0, layout.header.height - 4, this.scale.gameSize.width, 4);

    const { close } = layout;
    this.add
      .text(close.x + close.width / 2, close.y + close.height / 2, "×", {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "26px",
      })
      .setOrigin(0.5);

    this.add
      .text(close.x + close.width + 12, layout.header.height / 2, `ASPECT · ${content.name.toUpperCase()}`, {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "16px",
      })
      .setOrigin(0, 0.5);

    const zone = this.add
      .zone(close.x, close.y, close.width, close.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => this.#leave());
  }

  /**
   * Wide: the text block (tagline/"What it's for"/"Pick it when") and the cards block (signature cards/Try it)
   * sit side by side, each starting at its own column's own top and independently scrollable. Narrow: `layout.text`
   * and `layout.cards` are the same rect (`aspect-lesson-model.ts`'s own doc comment), so the cards block starts
   * below wherever the text block's own content actually ends, and both share one scroll region — two regions
   * layered over the same rect would draw on top of each other rather than stack.
   */
  #drawBody(layout: AspectLessonLayout, content: AspectLessonContent, stamp: { fill: number; ink: number }): void {
    const text = this.#buildTextBlock(
      layout.text.x + COLUMN_PAD,
      layout.text.y,
      layout.text.width - COLUMN_PAD * 2,
      content,
      stamp,
    );

    if (layout.wide) {
      const cardsRect = layout.cards;
      const cardsX = cardsRect.x + COLUMN_PAD;
      const cardsWidth = cardsRect.width - COLUMN_PAD * 2;
      const cards = this.#buildCardsBlock(cardsX, cardsRect.y, cardsWidth, content);

      const textRegion = new McScrollRegion(this, {
        rect: layout.text,
        heights: [text.height],
        scroll: this.#textScroll,
        onScroll: (offset) => this.#onColumnScroll(offset, text.height, layout.text.height),
      });
      textRegion.content.add(text.objects);
      this.#textRegion = textRegion;
      this.#onColumnScroll(0, text.height, layout.text.height);

      const cardsRegion = new McScrollRegion(this, {
        rect: cardsRect,
        heights: [cards.height],
        scroll: this.#cardsScroll,
      });
      cardsRegion.content.add(cards.objects);
      this.#addZones(cardsRegion, cards.zones);
      this.#cardsRegion = cardsRegion;
      return;
    }

    const rect = layout.text; // == layout.cards on narrow layouts
    const x = rect.x + COLUMN_PAD;
    const width = rect.width - COLUMN_PAD * 2;
    const cardsStartY = text.y + text.height + SECTION_GAP;
    const cards = this.#buildCardsBlock(x, cardsStartY, width, content);
    const contentHeight = cardsStartY + cards.height - rect.y;

    const region = new McScrollRegion(this, {
      rect,
      heights: [contentHeight],
      scroll: this.#textScroll,
      onScroll: (offset) => this.#onColumnScroll(offset, contentHeight, rect.height),
    });
    region.content.add([...text.objects, ...cards.objects]);
    this.#addZones(region, cards.zones);
    this.#textRegion = region;
    this.#onColumnScroll(0, contentHeight, rect.height);
  }

  #addZones(region: McScrollRegion, zones: readonly { readonly rect: Rect; readonly activate: () => void }[]): void {
    for (const zone of zones) {
      const z = this.add
        .zone(zone.rect.x, zone.rect.y, zone.rect.width, zone.rect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      z.on("pointerup", zone.activate);
      region.content.add(z);
    }
  }

  #onColumnScroll(offsetPx: number, contentHeight: number, viewportHeight: number): void {
    const maxOffset = Math.max(0, contentHeight - viewportHeight);
    if (offsetPx >= maxOffset - 0.5) this.#markDone();
  }

  /** The tagline/"What it's for"/"Pick it when" block, measured cumulatively from `(x, startY)` (`ui/guide-panel.ts`'s
   * own "measure at the origin, place once" pattern) — never creates its own scroll region, so the caller can put
   * it in a wide column of its own or stack it ahead of the cards block on a narrow one. */
  #buildTextBlock(
    x: number,
    startY: number,
    width: number,
    content: AspectLessonContent,
    stamp: { fill: number; ink: number },
  ): { readonly objects: Phaser.GameObjects.GameObject[]; readonly y: number; readonly height: number } {
    const objects: Phaser.GameObjects.GameObject[] = [];
    let y = startY;

    const title = this.add
      .text(x, y, content.name.toUpperCase(), textStyle(TITLE_TYPE, surface.ink.hex))
      .setFontSize(32);
    objects.push(title);
    y += title.height + 6;

    const tagline = this.add
      .text(x, y, content.tagline, { ...textStyle(typeRole.body, surface.ink.hex, ink.secondary), fontSize: "14px" })
      .setWordWrapWidth(width);
    objects.push(tagline);
    y += tagline.height + SECTION_GAP;

    const whatHeading = label(this, x, y, "What it's for", HEADING_TYPE, surface.ink.hex, ink.secondary);
    objects.push(whatHeading);
    y += whatHeading.height + 6;

    const whatBody = new McTermText(this, {
      x,
      y,
      width,
      text: content.whatItsFor,
      onTermOpen: (term, anchor) => this.#openTooltip(term, anchor),
      onTermClose: () => this.#tooltip?.hide(),
    });
    this.#termBlocks.push(whatBody);
    objects.push(whatBody.container);
    y += whatBody.height + SECTION_GAP;

    const pickHeading = label(this, x, y, "Pick it when", HEADING_TYPE, surface.ink.hex, ink.secondary);
    objects.push(pickHeading);
    y += pickHeading.height + 6;

    for (const bullet of content.pickItWhen) {
      const bulletMark = this.add.text(x, y, "•", { ...textStyle(typeRole.body, stamp.fill), fontSize: "13px" });
      objects.push(bulletMark);
      const bulletBody = new McTermText(this, {
        x: x + 16,
        y,
        width: width - 16,
        text: bullet,
        onTermOpen: (term, anchor) => this.#openTooltip(term, anchor),
        onTermClose: () => this.#tooltip?.hide(),
      });
      this.#termBlocks.push(bulletBody);
      objects.push(bulletBody.container);
      y += Math.max(bulletMark.height, bulletBody.height) + 10;
    }

    return { objects, y, height: y - startY };
  }

  /** The signature cards + "Try it" block, measured cumulatively from `(x, startY)` — same shape as
   * `#buildTextBlock`, and likewise never creates its own scroll region. */
  #buildCardsBlock(
    x: number,
    startY: number,
    width: number,
    content: AspectLessonContent,
  ): {
    readonly objects: Phaser.GameObjects.GameObject[];
    readonly zones: readonly { readonly rect: Rect; readonly activate: () => void }[];
    readonly height: number;
  } {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const zones: { readonly rect: Rect; readonly activate: () => void }[] = [];
    let y = startY;

    if (content.signatureCards.length > 0) {
      const heading = label(this, x, y, "Signature cards", HEADING_TYPE, surface.ink.hex, ink.secondary);
      objects.push(heading);
      y += heading.height + 8;

      const rowHeight = 76;
      for (const card of content.signatureCards) {
        const cardRect: Rect = { x, y, width, height: rowHeight };
        objects.push(...this.#drawSignatureCardRow(cardRect, card.cardId, card.name, card.cost));
        zones.push({ rect: cardRect, activate: () => this.#inspectCard(card.cardId) });
        y += rowHeight + 10;
      }
      y += SECTION_GAP - 10;
    }

    const heading = label(
      this,
      x,
      y,
      content.heroName ? `Try it with ${content.heroName}` : "Try it",
      HEADING_TYPE,
      surface.ink.hex,
      ink.secondary,
    );
    objects.push(heading);
    y += heading.height + 8;

    const tryItHeight = 120;
    objects.push(...this.#drawTryItCard({ x, y, width, height: tryItHeight }, content));
    y += tryItHeight;

    return { objects, zones, height: y - startY };
  }

  #drawSignatureCardRow(
    rect: Rect,
    cardId: string,
    name: string,
    cost: number | null,
  ): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    objects.push(g);

    const artHeight = rect.height - 12;
    const artWidth = Math.min(rect.width * 0.3, artHeight * CARD_ASPECT);
    const artRect: Rect = { x: rect.x + 6, y: rect.y + 6, width: artWidth, height: artHeight };
    const bg = this.add
      .rectangle(artRect.x, artRect.y, artRect.width, artRect.height, surface.parchment.hex)
      .setOrigin(0, 0);
    objects.push(bg);
    const card = CARDS_BY_ID.get(cardId);
    const key = cardArt(this).request(this, artFor(card, { kind: "front" }));
    const artImage = drawArt(this, key, artRect, { fit: "cover" });
    if (artImage) objects.push(artImage);

    const textLeft = artRect.x + artRect.width + 12;
    const nameText = this.add
      .text(textLeft, rect.y + 14, name, textStyle(CARD_TITLE_TYPE, surface.ink.hex))
      .setWordWrapWidth(rect.x + rect.width - 10 - textLeft);
    objects.push(nameText);

    if (cost !== null) {
      const costText = this.add.text(
        textLeft,
        rect.y + 14 + nameText.height + 6,
        `Cost ${cost}`,
        textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      );
      objects.push(costText);
    }
    return objects;
  }

  #drawTryItCard(rect: Rect, content: AspectLessonContent): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    objects.push(g);

    const artWidth = Math.min(rect.width * 0.32, rect.height * CARD_ASPECT);
    const artRect: Rect = { x: rect.x + 8, y: rect.y + 8, width: artWidth, height: rect.height - 16 };
    if (content.heroCardId) {
      const bg = this.add
        .rectangle(artRect.x, artRect.y, artRect.width, artRect.height, surface.parchment.hex)
        .setOrigin(0, 0);
      objects.push(bg);
      const hero = CARDS_BY_ID.get(content.heroCardId);
      const key = cardArt(this).request(this, artFor(hero, { kind: "hero" }));
      const artImage = drawArt(this, key, artRect, { fit: "cover" });
      if (artImage) objects.push(artImage);
    } else {
      // Basic has no precon/hero — dashed placeholder box rather than a blank rectangle.
      g.lineStyle(2, surface.ink.hex, 1);
      dashedBox(g, artRect);
    }

    const buttonWidth = Math.min(180, rect.width - artRect.width - 24);
    const buttonRect: Rect = {
      x: artRect.x + artRect.width + 12,
      y: rect.y + rect.height / 2 - 22,
      width: buttonWidth,
      height: 44,
    };
    const aspect = content.aspect;
    const tryItButton = new McButton(this, {
      kind: "primary",
      label: "Try it ▸",
      type: typeRole.menuButton,
      rect: buttonRect,
      enabled: false,
      reason: "Coming soon",
      onClick: () => this.#onTryIt(aspect),
    });
    this.#buttons.push(tryItButton);
    // Reparented into the same scroll region as the card behind it (`#drawBody`), in the same call and after the
    // background/art above — a button created before that reparenting, but never itself moved into the region,
    // would sit at a *lower* display-list depth than the region's own root container (added later) and end up
    // drawn under its own card's background.
    objects.push(tryItButton.container);
    return objects;
  }

  #drawFooter(layout: AspectLessonLayout, content: AspectLessonContent): void {
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Got it",
        type: typeRole.barTitle,
        rect: layout.gotIt,
        onClick: () => {
          this.#markDone();
          this.#leave();
        },
      }),
    );

    const stops = new Map<string, FocusStop>();
    stops.set("close", { rect: layout.close, activate: () => this.#leave() });
    let index = 0;
    for (const card of content.signatureCards) {
      stops.set(`card:${index}`, {
        rect: { x: layout.cards.x, y: layout.cards.y, width: layout.cards.width, height: 40 },
        activate: () => this.#inspectCard(card.cardId),
      });
      index += 1;
    }
    stops.set("got-it", { rect: layout.gotIt, activate: () => this.#leave() });
    this.#route?.set(["close", "got-it"], stops);
  }

  #inspectCard(cardId: string): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: cardId as never, face: { kind: "front" } },
    } satisfies InspectData);
  }

  /** The wiring point G10d fills in — starts a guided Rhino game with this aspect's Core precon
   * (`AspectGuide.preconId`). No-op today: the button that calls it is always drawn disabled (brief: "don't fake a
   * game"). */
  #onTryIt(_aspect: CoreAspect): void {
    // Intentionally empty — see the module header and G10d in docs/guided-mode.md §4.
  }

  #markDone(): void {
    if (this.#done) return;
    this.#done = true;
    setGuidePrefs(markAspectLessonDone(guidePrefs(), this.#aspect));
  }

  #openTooltip(term: TermTextTerm, anchor: Rect): void {
    const content = tooltipContentOf(term);
    if (!content || !this.#tooltip) return;
    for (const block of this.#termBlocks) block.setTermsEnabled((id) => id === term.id);
    const viewport: Rect = { x: 0, y: 0, width: this.scale.width, height: this.scale.height };
    this.#tooltip.show(
      anchor,
      content,
      viewport,
      () => {
        this.scene.launch(SCENES.rules, { initialTab: "glossary", initialQuery: content.title });
      },
      () => {
        for (const block of this.#termBlocks) block.setTermsEnabled(() => true);
      },
    );
  }

  #leave(): void {
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, this.#backTo === "howToPlay" ? SCENES.howToPlay : SCENES.title);
  }
}

function dashedBox(g: Phaser.GameObjects.Graphics, rect: Rect): void {
  const dash = 6;
  const gap = 4;
  for (let x = rect.x; x < rect.x + rect.width; x += dash + gap) {
    g.lineBetween(x, rect.y, Math.min(x + dash, rect.x + rect.width), rect.y);
    g.lineBetween(x, rect.y + rect.height, Math.min(x + dash, rect.x + rect.width), rect.y + rect.height);
  }
  for (let y = rect.y; y < rect.y + rect.height; y += dash + gap) {
    g.lineBetween(rect.x, y, rect.x, Math.min(y + dash, rect.y + rect.height));
    g.lineBetween(rect.x + rect.width, y, rect.x + rect.width, Math.min(y + dash, rect.y + rect.height));
  }
}
