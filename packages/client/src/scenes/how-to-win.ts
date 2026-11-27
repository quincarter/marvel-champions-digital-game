/**
 * "How to win" (guided mode G6b, `docs/guided-mode.md` §4, §5.1's lesson 1): P02 "One way to win, two ways to
 * lose", between the chooser's "Learn as you play" and the tutorial board. `view/how-to-win-model.ts`'s own header
 * has the content/layout split this scene draws — every number here (Rhino's stage count, The Break-In!'s target
 * threat, Spider-Man's HP) is real, read from the app's pool, never the design tile's placeholder matchup.
 *
 * There is no wide design tile for this screen (only P02, phone) — the tablet/desktop split is this scene's own
 * best-judgement two-column build from P02's content, order and hierarchy (`docs/guided-mode.md` §1's "designs are
 * intent, not pixels"): the WIN card in a left column, the two LOSE cards stacked in a right column, the EVERY
 * ROUND strip full width below both, same as `guide-chooser.ts`'s own art-left/choices-right wide split.
 *
 * Reached from the chooser's "Learn as you play" (`scenes/guide-chooser.ts`), the "How to play" hub's own lesson 1
 * row/"Continue learning" (`scenes/how-to-play.ts`, guided mode G6c), or `?screen=howtowin` (`scenes/boot.ts`).
 * "Start the fight" is the tutorial's lesson 1 completion point: it marks `"how-to-win"` done
 * (`guide/guide-prefs.ts#markLessonDone`) and starts the tutorial game through `guide/start-tutorial.ts`'s one
 * shared call site. "Tell me more" opens the Rules reference at the glossary, launched over this screen the same
 * way every other overlay in this app launches.
 *
 * Back/×/Escape (§3.10 "every tutorial screen has Back") return to the chooser or the hub if that's where the
 * player came from (`HowToWinSceneData.backTo`), otherwise to Title — never a dead end.
 *
 * **One Lit panel over the canvas** (`mc-sheet`, `dom/sheet-builder.ts`, as `scenes/how-to-play.ts` is) at the rects
 * `view/how-to-win-model.ts` gives: the ink header, the three cards with their card scans (`<img>`s, with the card
 * hover popover shown through a hole), the strip and the two buttons. The "threat" term is a dotted word in the sheet
 * (`view/term-text-layout.ts`) whose tooltip (`view/term-tooltip-layout.ts`) is part of the sheet too. The scene keeps
 * the focus route (its ring drawn in the DOM, `dom/dom-ring.ts`), the glyph beside the title and navigation.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { accent, border, dotGrid, hit, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import type { TermTextTerm } from "../view/term-text-model.js";
import { termTextModelOf, tooltipContentOf } from "../view/term-text-model.js";
import { tooltipHoldRects } from "../view/tooltip-hover.js";
import { layoutTermText, type LaidWord } from "../view/term-text-layout.js";
import { TIP_ARROW, TIP_PAD, TIP_RULE, TIP_WIDTH, termTooltipLayout } from "../view/term-tooltip-layout.js";
import {
  EVERY_ROUND_STEP_KEYS,
  howToWinContent,
  howToWinLayout,
  type HowToWinContent,
  type HowToWinLayout,
} from "../view/how-to-win-model.js";
import { CARD_ASPECT, type Rect } from "../view/layout.js";
import { clipHoverRect, hoverSlotOf, type HoverCardIdRect } from "../view/card-hover.js";
import { CARDS_BY_ID } from "../content/pool.js";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { artFor, artLanguageNow, type CardFace } from "../art/art-source.js";
import { cardNamesReady, loadCardNames, localizedNameOf } from "../view/card-names.js";
import { guidePrefs, setGuidePrefs } from "../guide/guide-store.js";
import { markLessonDone } from "../guide/guide-prefs.js";
import { startTutorialGame } from "../guide/start-tutorial.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder, sheetColor } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t, tPlural } from "../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { RulesSceneData } from "./rules.js";

export interface HowToWinSceneData {
  /** Set when the chooser (`scenes/guide-chooser.ts`) or the "How to play" hub's own lesson 1 row/"Continue
   * learning" (`scenes/how-to-play.ts`, guided mode G6c) launched this screen — Back/×/Escape return there
   * instead of Title. */
  readonly backTo?: "chooser" | "howToPlay";
}

const TITLE_TYPE: TypeSpec = typeRole.pageTitle;
const CARD_TITLE_TYPE: TypeSpec = { ...typeRole.barTitle, size: 18 };
const TAG_TYPE: TypeSpec = typeRole.label;
const STEP_LABEL_TYPE: TypeSpec = typeRole.label;
const TIP_TITLE_TYPE: TypeSpec = { ...typeRole.sectionHeader, size: 16 };
const TIP_BODY_TYPE: TypeSpec = { ...typeRole.body, size: 13 };

/** A card picture's place on the screen and what the hover popover shows for it. */
interface HoverTarget {
  readonly cardId: string;
  readonly face: CardFace;
  readonly rect: Rect;
}

/** The glossary tooltip that is open: the term, where it sits, and what it says. */
interface OpenTip {
  readonly term: TermTextTerm;
  readonly anchor: Rect;
}

export class HowToWinScene extends Phaser.Scene {
  #backTo: "chooser" | "howToPlay" | "title" = "title";
  #route: FocusRoute | null = null;
  #starting = false;
  #glyphs!: SheetGlyphs;
  /** The screen, one Lit panel over the canvas; made on the first draw and kept. */
  #region: DomRegion<McSheet> | null = null;
  /** What each key in the panel does when tapped, this draw. */
  #actions = new Map<string, () => void>();
  /** The blob URLs of pack pictures the panel shows, held while its lazy images may still load them. */
  readonly #leases = new PackLeases();
  /** The desktop hover popover over each card picture. */
  #hover: HoverPreview | null = null;
  #hoverTargets = new Map<string, HoverTarget>();
  /** The open glossary tooltip (at most one), and the panel's rect once drawn. */
  #tip: OpenTip | null = null;
  #tipRect: Rect | null = null;
  /** Every term's rect this draw, for the dev hook. */
  #termRects: { readonly id: string; readonly rect: Rect }[] = [];
  /** The terms this draw laid out, by the key their tap area and stop carry. */
  #terms = new Map<string, { readonly term: TermTextTerm; readonly rect: Rect }>();

  constructor() {
    super(SCENES.howToWin);
  }

  create(data: HowToWinSceneData = {}): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#backTo = data.backTo === "chooser" || data.backTo === "howToPlay" ? data.backTo : "title";
    this.#starting = false;
    this.#region = null;
    this.#tip = null;
    this.scale.on("resize", this.#rebuild, this);
    // A card scan that resolves later (a pack's, once loaded) draws in place of "no scan".
    const offArt = onArtChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    const offLanguage = onLanguageChange(() => {
      if (!this.sys.isActive()) return;
      this.#tip = null;
      this.#rebuild();
    });
    this.#glyphs = new SheetGlyphs(this, () => this.#rebuild());
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#hoverCards(),
      // The Rules reference opens over this screen; nothing else covers it.
      area: (pointer) => screenHoverArea(this, pointer),
    });
    // A tooltip closes when the pointer leaves it and its term (desktop; a touch tap toggles it instead), or on a
    // press outside both: `ui/tooltip.ts`'s rules, now over the panel's rects.
    const inside = (pointer: Phaser.Input.Pointer, rect: Rect): boolean =>
      pointer.x >= rect.x &&
      pointer.x <= rect.x + rect.width &&
      pointer.y >= rect.y &&
      pointer.y <= rect.y + rect.height;
    const onMove = (pointer: Phaser.Input.Pointer): void => {
      const tip = this.#tip;
      const panel = this.#tipRect;
      if (!tip || !panel || pointer.wasTouch) return;
      if (inside(pointer, panel) || tooltipHoldRects(tip.anchor, panel).some((rect) => inside(pointer, rect))) return;
      this.#closeTip();
    };
    const onDown = (pointer: Phaser.Input.Pointer): void => {
      const tip = this.#tip;
      const panel = this.#tipRect;
      if (!tip || !panel || inside(pointer, panel) || inside(pointer, tip.anchor)) return;
      this.#closeTip();
    };
    this.input.on("pointermove", onMove);
    this.input.on("pointerdown", onDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      this.input.off("pointermove", onMove);
      this.input.off("pointerdown", onDown);
      offArt();
      offLanguage();
      this.#leases.dispose();
      this.#glyphs.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
    });
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // The Rules reference opens over this screen and owns Escape and the pad until it has closed.
      blocked: () => this.scene.isActive(SCENES.rules),
      onCancel: () => {
        if (this.#tip) {
          this.#closeTip();
          return;
        }
        this.#leave();
      },
      // Start is "forward": it presses Start the fight.
      primary: () => "start-the-fight",
    });
    // Names in the player's language, drawn English until the table is in.
    const lang = artLanguageNow();
    if (!cardNamesReady(lang)) {
      void loadCardNames(lang).then(() => {
        if (this.sys.isActive()) this.#rebuild();
      });
    }
    this.#rebuild();
    fadeScreenIn(this);
  }

  /** Every card picture, with its place, for the hover popover (read on each pointer move). */
  #hoverCards(): ReadonlyMap<string, HoverCardIdRect> {
    const found = new Map<string, HoverCardIdRect>();
    const { width, height } = this.scale.gameSize;
    for (const [slot, target] of this.#hoverTargets) {
      const rect = clipHoverRect(target.rect, { x: 0, y: 0, width, height });
      if (rect) found.set(slot, { ...rect, cardId: target.cardId, face: target.face, through: true });
    }
    return found;
  }

  #nameOf(cardId: string, english: string): string {
    return localizedNameOf(cardId, artLanguageNow()) ?? english;
  }

  #closeTip(): void {
    if (!this.#tip) return;
    this.#tip = null;
    this.#rebuild();
  }

  #openTip(term: TermTextTerm, anchor: Rect): void {
    if (!tooltipContentOf(term)) return;
    if (this.#tip?.term.id === term.id) return;
    this.#tip = { term, anchor };
    this.#rebuild();
  }

  #rebuild(): void {
    destroyChildren(this);
    this.#actions = new Map();
    this.#hoverTargets = new Map();
    this.#termRects = [];
    this.#terms = new Map();
    this.#tipRect = null;
    this.#leases.begin();
    this.#glyphs.reset();
    resetHoverCards(this);

    const { width, height } = this.scale.gameSize;
    const layout = howToWinLayout(width, height);
    const content = howToWinContent();
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    const stops = new Map<string, FocusStop>();
    const termStops: string[] = [];

    b.box({ x: 0, y: 0, width, height }, { fill: surface.paper.hex });
    b.dots(
      { x: 0, y: 0, width, height },
      "paper",
      dotGrid.onPaper.spacing,
      dotGrid.onPaper.radius,
      dotGrid.onPaper.alpha,
    );

    // The header band under the panel too: the chrome buttons' holes in the panel (the dark mode toggle) show the canvas.
    this.add.rectangle(0, 0, width, layout.header.height, surface.ink.hex).setOrigin(0, 0);
    this.#drawHeader(b, layout);
    stops.set("close", { rect: layout.close, activate: () => this.#leave() });
    this.#drawTitle(b, layout);
    this.#drawWinCard(b, layout, content);
    this.#drawLoseSchemeCard(b, layout, content, stops, termStops);
    this.#drawLoseHeroCard(b, layout, content);
    this.#drawEveryRound(b, layout);

    b.button({
      key: "tell-me-more",
      rect: layout.tellMeMore,
      label: t("howToWin.tellMore"),
      look: "secondary",
      type: typeRole.menuButton,
    });
    this.#actions.set("tell-me-more", () => this.#openRules());
    b.button({
      key: "start-the-fight",
      rect: layout.startTheFight,
      label: this.#starting ? t("howToPlay.suitingUp") : t("howToWin.start"),
      look: "primary",
      type: typeRole.barTitle,
      ...(this.#starting ? { disabled: true as const } : {}),
    });
    this.#actions.set("start-the-fight", () => void this.#startTheFight());
    stops.set("tell-me-more", { rect: layout.tellMeMore, activate: () => this.#openRules() });
    stops.set("start-the-fight", { rect: layout.startTheFight, activate: () => void this.#startTheFight() });

    // Last, so it sits over everything: the open glossary term's tooltip.
    this.#drawTip(b, width, height);

    this.#mount(width, height, b);
    this.#leases.end();
    this.#hover?.onDraw();

    // Headless click-through hook only (never referenced by product code): each term's screen rect.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcHowToWinDebug?: unknown }).__mcHowToWinDebug = {
        termRects: () => this.#termRects,
        tipRect: () => this.#tipRect,
        hoverKey: () => this.#hover?.shownKey ?? null,
      };
    }

    this.#route?.set(["close", ...termStops, "tell-me-more", "start-the-fight"], stops);
  }

  /** Hands the built parts to the panel (made once) and renders them now. */
  #mount(width: number, height: number, builder: SheetBuilder): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      // A pack picture's blob URL went stale before its lazy image loaded: read it again, once (McSheet's retry).
      element.addEventListener("mc-image-error", (event) => {
        const { key, src } = (event as CustomEvent<{ key: string; src: string | null }>).detail;
        refreshPackArt(key, src ?? undefined);
      });
      // A mouse over a term opens its tooltip (a tap does on a touch screen; the closing is the scene's pointer watch).
      element.addEventListener("mc-hover", (event) => {
        const { key, over } = (event as CustomEvent<{ key: string; over: boolean }>).detail;
        if (!over || !key.startsWith("term:")) return;
        const found = this.#terms.get(key);
        if (found) this.#openTip(found.term, found.rect);
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
      // The card hover popover follows Phaser's pointer, which only hears the mouse over the canvas.
      this.#region.forwardMouseMoves();
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    // The hover popover is drawn in the canvas: left out of the panel to be seen through it while it is up.
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    region.element.nodes = builder.nodes;
    renderNow(region.element);
  }

  #drawHeader(b: SheetBuilder, layout: HowToWinLayout): void {
    b.box(layout.header, { fill: surface.ink.hex });
    const { close } = layout;
    b.text(close.x + close.width / 2, close.y + close.height / 2, "×", typeRole.barTitle, {
      size: 26,
      color: surface.paper.hex,
      origin: [0.5, 0.5],
    });
    b.tap("close", close);
    this.#actions.set("close", () => this.#leave());

    const title = b.text(
      close.x + close.width + 12,
      layout.header.height / 2,
      t("howToWin.lesson"),
      typeRole.barTitle,
      {
        size: 18,
        color: surface.paper.hex,
        origin: [0, 0.5],
      },
    );

    // A five-segment tick bar, first segment filled (guide caution yellow — this screen is lesson 1 of 5), the
    // rest empty: the same "where am I" signal `docs/guided-mode.md`'s own step labels give inside a lesson, but
    // for the five-lesson run as a whole.
    const segments = 5;
    const gap = 4;
    const segWidth = (layout.progress.width - gap * (segments - 1)) / segments;
    for (let i = 0; i < segments; i++) {
      b.box(
        {
          x: layout.progress.x + i * (segWidth + gap),
          y: layout.progress.y,
          width: segWidth,
          height: layout.progress.height,
        },
        i === 0 ? { fill: signal.caution.hex } : { fill: surface.paperOnInk.hex, fillAlpha: 0.3 },
      );
    }
    // The close is a drawn ×, not a button: its Cancel glyph follows the title.
    this.#glyphs.hint(b, {
      key: "close",
      x: close.x + close.width + 12 + title.width + 14,
      y: layout.header.y + layout.header.height / 2,
      ids: ["cancel"],
      height: 18,
      ground: "ink",
    });
  }

  #drawTitle(b: SheetBuilder, layout: HowToWinLayout): void {
    b.text(layout.title.x, layout.title.y, t("howToWin.title1"), TITLE_TYPE, { size: 30, color: surface.ink.hex });
    b.text(layout.title.x, layout.title.y + 30, t("howToWin.title2"), TITLE_TYPE, {
      size: 30,
      color: accent.heroRed.hex,
    });
  }

  /** A card's picture (a card scan, fitted `cover` or `contain` into `rect`), with the hover popover's slot noted. */
  #scan(b: SheetBuilder, rect: Rect, cardId: string, face: CardFace, fit: "cover" | "contain", key: string): void {
    const card = CARDS_BY_ID.get(cardId);
    const source = artFor(card, face);
    const slot = hoverSlotOf(cardId, key);
    this.#hoverTargets.set(slot, { cardId, face, rect });
    b.image(rect, {
      ...this.#leases.image(source),
      fill: surface.parchment.hex,
      missing: t("rules.noScan"),
      color: surface.ink.hex,
      ...(fit === "cover" ? { cover: { x: 0.5, y: 0.5 } } : {}),
      key: `scan:${key}`,
    });
  }

  /** The tag stamp (WIN / LOSE) with its box sized to the measured label; returns its width. */
  #tag(b: SheetBuilder, x: number, y: number, tag: { readonly label: string; readonly fill: number }): void {
    const width = b.measure(tag.label, TAG_TYPE).width + 16;
    b.box({ x, y, width, height: 20 }, { fill: tag.fill });
    b.text(x + width / 2, y + 10, tag.label, TAG_TYPE, { color: surface.ink.hex, origin: [0.5, 0.5] });
  }

  /** A card's ink frame, tag stamp, card scan and copy — shared shape for all three (WIN, both LOSE).
   *
   * `"landscape"` (the default, and the only shape on phone/tablet-portrait — P02's own list-row build): art on the
   * left at a small fixed width, title/body filling the rest. `"portrait"`: art fills the top of the card at a real
   * card-scan aspect ratio (`CARD_ASPECT`), title/body below — the shape the wide WIN card needs to read as "a big
   * card", not a cropped sliver of art next to a paragraph. `artAspect` is the source art's own width/height ratio:
   * `CARD_ASPECT` (portrait) for a hero/villain scan, its reciprocal for a main scheme's landscape scan, which is
   * fitted `contain` so the slot never crops it (the LOSE "His plan finishes" card, whose main scheme art once lost its
   * left side). `body` draws the copy at the origin it is given. */
  #drawCard(
    b: SheetBuilder,
    rect: Rect,
    tag: { readonly label: string; readonly fill: number },
    title: string,
    art: { readonly cardId: string; readonly face: CardFace; readonly key: string },
    body: (origin: { x: number; y: number; width: number }) => void,
    orientation: "landscape" | "portrait" = "landscape",
    artAspect: number = CARD_ASPECT,
  ): void {
    b.box(rect, { fill: surface.card.hex });
    b.box(
      { x: rect.x + 1.5, y: rect.y + 1.5, width: rect.width - 3, height: rect.height - 3 },
      { stroke: surface.ink.hex, strokeWidth: 3 },
    );

    if (orientation === "portrait") {
      const pad = 12;
      // Text area reserved below the art: tag stamp + title + a couple of body lines.
      const textAreaHeight = 96;
      const maxArtWidth = rect.width - pad * 2;
      const maxArtHeight = rect.height - pad * 2 - textAreaHeight;
      let artWidth = Math.min(maxArtWidth, maxArtHeight * CARD_ASPECT);
      let artHeight = artWidth / CARD_ASPECT;
      if (artHeight > maxArtHeight) {
        artHeight = maxArtHeight;
        artWidth = artHeight * CARD_ASPECT;
      }
      const artRect = { x: rect.x + (rect.width - artWidth) / 2, y: rect.y + pad, width: artWidth, height: artHeight };
      this.#scan(b, artRect, art.cardId, art.face, "cover", art.key);
      const textLeft = rect.x + pad;
      const textWidth = rect.width - pad * 2;
      const tagY = artRect.y + artRect.height + 10;
      this.#tag(b, textLeft, tagY, tag);
      b.text(textLeft, tagY + 26, title.toUpperCase(), CARD_TITLE_TYPE, {
        color: surface.ink.hex,
        wrapWidth: textWidth,
      });
      body({ x: textLeft, y: tagY + 56, width: textWidth });
      return;
    }

    // Sized to the card's own real aspect ratio against the available height, not a flat 120px sliver — a LOSE
    // card on a wide layout is tall enough that a fixed-width thumbnail reads as cramped. `Math.max(120, …)` keeps
    // the phone/tablet-portrait row (a short, wide strip) at its original size rather than shrinking it.
    const isLandscapeArt = artAspect > 1;
    const artHeight = rect.height - 20;
    const artWidth = Math.min(rect.width * (isLandscapeArt ? 0.55 : 0.38), Math.max(120, artHeight * artAspect));
    const artRect = { x: rect.x + 10, y: rect.y + 10, width: artWidth, height: artHeight };
    this.#scan(b, artRect, art.cardId, art.face, isLandscapeArt ? "contain" : "cover", art.key);

    const textLeft = artRect.x + artRect.width + 14;
    const textWidth = rect.x + rect.width - 10 - textLeft;
    this.#tag(b, textLeft, rect.y + 10, tag);
    b.text(textLeft, rect.y + 36, title.toUpperCase(), CARD_TITLE_TYPE, {
      color: surface.ink.hex,
      wrapWidth: textWidth,
    });
    body({ x: textLeft, y: rect.y + 66, width: textWidth });
  }

  #drawWinCard(b: SheetBuilder, layout: HowToWinLayout, content: HowToWinContent): void {
    this.#drawCard(
      b,
      layout.win,
      { label: t("howToWin.tag.win"), fill: signal.heal.hex },
      t("howToWin.win.title"),
      { cardId: content.villainCardId, face: { kind: "villainStage", sideIndex: 0, stageIndex: 0 }, key: "win" },
      ({ x, y, width }) => {
        b.text(
          x,
          y,
          tPlural("howToWin.win.body", content.stageCount, {
            villain: this.#nameOf(content.villainCardId, content.villainName),
            stages: content.stageCount,
          }),
          typeRole.body,
          { color: surface.ink.hex, wrapWidth: width },
        );
      },
      layout.wide ? "portrait" : "landscape",
    );
  }

  #drawLoseSchemeCard(
    b: SheetBuilder,
    layout: HowToWinLayout,
    content: HowToWinContent,
    stops: Map<string, FocusStop>,
    termStops: string[],
  ): void {
    this.#drawCard(
      b,
      layout.loseScheme,
      { label: t("howToWin.tag.lose"), fill: accent.heroRed.hex },
      t("howToWin.scheme.title"),
      { cardId: content.mainSchemeCardId, face: { kind: "mainSchemeStage", stageIndex: 0, side: "B" }, key: "scheme" },
      (origin) =>
        this.#drawTermText(
          b,
          origin,
          t("howToWin.scheme.body", {
            scheme: this.#nameOf(content.mainSchemeCardId, content.mainSchemeName),
            threat: content.threatTarget,
          }),
          stops,
          termStops,
        ),
      "landscape",
      // A main scheme scan is a landscape card (`docs/guided-mode.md`'s art convention), unlike the hero/villain
      // portrait scans the other two cards draw — the reciprocal of `CARD_ASPECT` sizes this card's own slot to
      // that shape instead of the default portrait box.
      1 / CARD_ASPECT,
    );
  }

  #drawLoseHeroCard(b: SheetBuilder, layout: HowToWinLayout, content: HowToWinContent): void {
    this.#drawCard(
      b,
      layout.loseHero,
      { label: t("howToWin.tag.lose"), fill: accent.heroRed.hex },
      t("howToWin.hero.title"),
      { cardId: content.heroCardId, face: { kind: "hero" }, key: "hero" },
      ({ x, y, width }) => {
        b.text(
          x,
          y,
          t("howToWin.hero.body", { hero: this.#nameOf(content.heroCardId, content.heroName) }),
          typeRole.body,
          { color: surface.ink.hex, wrapWidth: width },
        );
      },
    );
  }

  /**
   * Body copy with glossary terms (`McTermText`'s layout, word by word): each term is a dotted word with a tap area
   * grown to a touch target, a mouse over it opens its tooltip, a tap toggles it, and it is a focus stop.
   */
  #drawTermText(
    b: SheetBuilder,
    origin: { x: number; y: number; width: number },
    source: string,
    stops: Map<string, FocusStop>,
    termStops: string[],
  ): void {
    const spec = typeRole.body;
    const model = termTextModelOf(source);
    const lineHeight = Math.round(spec.size * spec.lineHeight * 1.4);
    const { words } = layoutTermText(model, origin.width, lineHeight, (text) => b.measure(text, spec).width);
    const wordHeight = b.measure("Ag", spec).height;
    for (const word of words) {
      const at: LaidWord = { ...word, x: origin.x + word.x, y: origin.y + word.y };
      b.text(at.x, at.y, at.text, spec, { color: surface.ink.hex, alpha: ink.body });
      if (!at.term) continue;
      const rect: Rect = { x: at.x, y: at.y, width: at.width, height: wordHeight };
      // The dotted rule under the term: the design's dash rhythm, one line.
      b.svg(
        { x: rect.x, y: rect.y + rect.height - 2, width: Math.max(1, rect.width), height: 3 },
        [Math.max(1, rect.width), 3],
        [
          {
            k: "line",
            x1: 0,
            y1: 1.5,
            x2: Math.max(1, rect.width),
            y2: 1.5,
            stroke: sheetColor(surface.ink.hex, "line"),
            sw: 1.5,
            dash: [border.dashSegment, border.dashGap],
          },
        ],
      );
      const key = `term:${at.term.id}`;
      const zoneHeight = Math.max(hit.target, rect.height);
      b.tap(
        key,
        { x: rect.x, y: rect.y + rect.height / 2 - zoneHeight / 2, width: Math.max(rect.width, 1), height: zoneHeight },
        { track: true },
      );
      const term = at.term;
      this.#terms.set(key, { term, rect });
      this.#termRects.push({ id: term.id, rect });
      const toggle = (): void => {
        if (this.#tip?.term.id === term.id) this.#closeTip();
        else this.#openTip(term, rect);
      };
      this.#actions.set(key, toggle);
      stops.set(key, { rect, activate: toggle });
      termStops.push(key);
    }
  }

  /** The open term's tooltip: the term's name, its one-line definition and the "RULES GLOSSARY" link, over everything. */
  #drawTip(b: SheetBuilder, width: number, height: number): void {
    const tip = this.#tip;
    if (!tip) return;
    const content = tooltipContentOf(tip.term);
    if (!content) return;
    const definition = `${content.definition} (${content.citeLabel})`;
    const link = t("howToWin.tip.glossary");
    const measured = {
      title: b.measure(content.title, TIP_TITLE_TYPE).height,
      definition: b.measure(definition, TIP_BODY_TYPE, { wrapWidth: TIP_WIDTH - TIP_PAD * 2 }).height,
      link: b.measure(link, typeRole.label).height,
    };
    const laid = termTooltipLayout(
      tip.anchor,
      { x: 0, y: 0, width, height },
      measured,
      b.measure(link, typeRole.label).width,
    );
    this.#tipRect = laid.panel;
    const { panel } = laid;
    b.box(panel, { fill: surface.ink.hex });
    b.box(
      { x: panel.x, y: panel.y + panel.height - TIP_RULE, width: panel.width, height: TIP_RULE },
      { fill: signal.caution.hex },
    );
    b.box(panel, { stroke: surface.ink.hex, strokeWidth: border.detail });
    // The arrow points at the term's own center.
    b.poly(
      laid.below
        ? [
            [laid.tipX - TIP_ARROW, panel.y],
            [laid.tipX + TIP_ARROW, panel.y],
            [laid.tipX, panel.y - TIP_ARROW],
          ]
        : [
            [laid.tipX - TIP_ARROW, panel.y + panel.height],
            [laid.tipX + TIP_ARROW, panel.y + panel.height],
            [laid.tipX, panel.y + panel.height + TIP_ARROW],
          ],
      { fill: surface.ink.hex },
    );
    b.text(laid.title.x, laid.title.y, content.title, TIP_TITLE_TYPE, { color: surface.paper.hex });
    b.text(laid.definition.x, laid.definition.y, definition, TIP_BODY_TYPE, {
      color: surface.paper.hex,
      alpha: ink.secondary,
      wrapWidth: TIP_WIDTH - TIP_PAD * 2,
    });
    b.text(laid.link.x, laid.link.y, link, typeRole.label, { color: signal.caution.hex });
    b.tap("tip-link", laid.link);
    this.#actions.set("tip-link", () => {
      this.scene.launch(SCENES.rules, { initialTab: "glossary", initialQuery: content.title } satisfies RulesSceneData);
      this.#closeTip();
    });
  }

  #drawEveryRound(b: SheetBuilder, layout: HowToWinLayout): void {
    const rect = layout.everyRound;
    b.box(rect, { fill: surface.parchment.hex });
    b.box(
      { x: rect.x + 1, y: rect.y + 1, width: rect.width - 2, height: rect.height - 2 },
      { stroke: surface.ink.hex, strokeWidth: 2.5 },
    );
    const label = t("howToWin.everyRound");
    const labelSize = b.measure(label, STEP_LABEL_TYPE);
    b.text(rect.x + 14, rect.y + 10, label, STEP_LABEL_TYPE, { color: surface.ink.hex, alpha: ink.secondary });

    const pillHeight = 34;
    // Centered in the space left under the label, not anchored to the strip's bottom edge with a fixed offset — a
    // shorter strip otherwise leaves a dead gap above the chips.
    const labelBottom = rect.y + 10 + labelSize.height + 8;
    const pillY = labelBottom + Math.max(0, rect.y + rect.height - 10 - labelBottom - pillHeight) / 2;
    let px = rect.x + 14;
    const maxRight = rect.x + rect.width - 14;
    EVERY_ROUND_STEP_KEYS.forEach((key, index) => {
      const step = t(key);
      const stepWidth = b.measure(step, TAG_TYPE).width;
      const pillWidth = Math.min(stepWidth + 24, maxRight - px - (EVERY_ROUND_STEP_KEYS.length - 1 - index) * 40);
      b.box(
        { x: px, y: pillY, width: pillWidth, height: pillHeight },
        { fill: index === 0 ? surface.ink.hex : accent.heroRed.hex },
      );
      b.text(px + pillWidth / 2, pillY + pillHeight / 2, step, TAG_TYPE, {
        color: surface.paper.hex,
        origin: [0.5, 0.5],
      });
      px += pillWidth;
      if (index < EVERY_ROUND_STEP_KEYS.length - 1) {
        b.text(px + 6, pillY + pillHeight / 2, "▸", typeRole.barTitle, {
          size: 18,
          color: surface.ink.hex,
          origin: [0, 0.5],
        });
        px += 26;
      }
    });
  }

  #openRules(): void {
    this.scene.launch(SCENES.rules, { initialTab: "glossary" } satisfies RulesSceneData);
  }

  /** "Start the fight": marks lesson 1 done and starts the tutorial game through the one shared call site. */
  async #startTheFight(): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    setGuidePrefs(markLessonDone(guidePrefs(), "how-to-win"));
    this.#rebuild();
    await startTutorialGame();
    if (!this.sys.isActive()) return;
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.board);
  }

  #leave(): void {
    this.scale.off("resize", this.#rebuild, this);
    const target =
      this.#backTo === "chooser" ? SCENES.guideChooser : this.#backTo === "howToPlay" ? SCENES.howToPlay : SCENES.title;
    goToScreen(this, target);
  }
}
