/**
 * "How to win" (guided mode G6b, `docs/guided-mode.md` §4, §5.1's lesson 1): P02 "One way to win, two ways to
 * lose", between the chooser's "Learn as you play" and the tutorial board. `view/how-to-win-model.ts`'s own header
 * has the content split this scene shows — every number here (Rhino's stage count, The Break-In!'s target
 * threat, Spider-Man's HP) is real, read from the app's pool, never the design tile's placeholder matchup.
 *
 * There is no wide design tile for this screen (only P02, phone) — the tablet/desktop split is this screen's own
 * best-judgement two-column build from P02's content, order and hierarchy (`docs/guided-mode.md` §1's "designs are
 * intent, not pixels"): the WIN card in a left column, the two LOSE cards stacked in a right column, the EVERY
 * ROUND strip full width below both.
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
 * The whole screen is one page element, `mc-how-to-win-page` (`views/how-to-win/`), made of section elements
 * (`components/learn/`). This scene only mounts it, sets its properties from the content above, and handles its one
 * `mc-learn` event. It keeps the focus route (the page's `data-stop` parts, read by `dom/element-stops.ts`, its ring
 * drawn in the DOM, `dom/dom-ring.ts`), the card hover popover (`dom/card-events.ts`) and navigation. The glossary term
 * "threat" is a dotted word whose tip the scheme card's text element owns; Escape closes the tip before it leaves.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/how-to-win/mc-how-to-win-page/mc-how-to-win-page.js";
import type { PictureSource } from "@mc/ui";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { estimateBangersWidth, sheetThemeFor } from "../ui/campaign-chrome.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { EVERY_ROUND_STEP_KEYS, howToWinContent } from "../view/how-to-win-model.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { termTextRunsOf } from "../view/term-text-runs.js";
import { CARDS_BY_ID } from "../content/pool.js";
import { PackLeases, refreshPackArt } from "../art/pack-art.js";
import { artFor, artLanguageNow, type CardFace } from "../art/art-source.js";
import { cardNamesReady, loadCardNames, localizedNameOf } from "../view/card-names.js";
import { guidePrefs, setGuidePrefs } from "../guide/guide-store.js";
import { markLessonDone } from "../guide/guide-prefs.js";
import { startTutorialGame } from "../guide/start-tutorial.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { settleElements } from "../dom/element-settle.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { t, tPlural } from "../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../language-change.js";
import type { LearnEventDetail } from "../components/learn/shared/learn-events.types.js";
import type { WinCardModel } from "../components/learn/mc-win-cards/mc-win-cards.types.js";
import type { HowToWinPageModel } from "../views/how-to-win/mc-how-to-win-page/mc-how-to-win-page.types.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { RulesSceneData } from "./rules.js";

export interface HowToWinSceneData {
  /** Set when the chooser (`scenes/guide-chooser.ts`) or the "How to play" hub's own lesson 1 row/"Continue
   * learning" (`scenes/how-to-play.ts`, guided mode G6c) launched this screen — Back/×/Escape return there
   * instead of Title. */
  readonly backTo?: "chooser" | "howToPlay";
}

type Page = MountedElement<HTMLElementTagNameMap["mc-how-to-win-page"]>;

/** The ink bar's height, its title's size and the room the progress ticks and the close take. */
const BAR_HEIGHT = 56;
const TITLE_SIZE = 18;
const CLOSE_SIZE = 44;
const TICKS_WIDTH = 140;
/** The height the close's Cancel glyph is drawn for. */
const CLOSE_HINT_HEIGHT = 30;

export class HowToWinScene extends Phaser.Scene {
  #backTo: "chooser" | "howToPlay" | "title" = "title";
  #route: FocusRoute | null = null;
  #starting = false;
  #alive = false;
  #page: Page | null = null;
  #cards: CardEvents | null = null;
  #hover: HoverPreview | null = null;
  #unbind: (() => void) | null = null;
  #glyphs!: ControlGlyphs;
  /** The ink under the bar: the dark mode tab's hole in the panel shows it. */
  #band: Phaser.GameObjects.Rectangle | null = null;
  /** The blob URLs of pack pictures the page shows, held while its lazy images may still load them. */
  readonly #leases = new PackLeases();
  /** The page's focus stops as last read (the dev hook's rects, the route's keys). */
  #stops = new Map<string, FocusStop>();
  #syncing = false;

  constructor() {
    super(SCENES.howToWin);
  }

  create(data: HowToWinSceneData = {}): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#backTo = data.backTo === "chooser" || data.backTo === "howToPlay" ? data.backTo : "title";
    this.#starting = false;
    this.#alive = true;
    this.#page = null;
    this.#band = this.add.rectangle(0, 0, this.scale.gameSize.width, BAR_HEIGHT, surface.ink.hex).setOrigin(0, 0);
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    this.scale.on("resize", this.#compose, this);
    // A card scan that resolves later (a pack's, once loaded) draws in place of "no scan".
    const offArt = onArtChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    const offLanguage = onLanguageChange(() => {
      if (!this.sys.isActive()) return;
      this.#page?.element.closeTip();
      this.#compose();
    });
    resetHoverCards(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#compose, this);
      offArt();
      offLanguage();
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#unbind?.();
      this.#unbind = null;
      this.#leases.dispose();
      this.#glyphs.dispose();
      this.#page = null;
      this.#band = null;
    });
    this.#mount();
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // The Rules reference opens over this screen and owns Escape and the pad until it has closed.
      blocked: () => this.scene.isActive(SCENES.rules),
      // An open glossary tip closes first; the next press leaves.
      onCancel: () => {
        if (!this.#page?.element.closeTip()) this.#leave();
      },
      // Start is "forward": it presses Start the fight.
      primary: () => "start-the-fight",
    });
    // Names in the player's language, drawn English until the table is in.
    const lang = artLanguageNow();
    if (!cardNamesReady(lang)) {
      void loadCardNames(lang).then(() => {
        if (this.#alive && this.sys.isActive()) this.#compose();
      });
    }
    this.#compose();
    fadeScreenIn(this);
  }

  /** Mounts the page and wires what it says and what hovers over it. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-how-to-win-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    const { element, region } = mounted;
    element.addEventListener("mc-learn", (event) => this.#heard(event.detail));
    // A pack picture's blob URL went stale before its lazy image loaded: read it again, once.
    element.addEventListener("mc-image-error", (event) => {
      const { key, src } = (event as CustomEvent<{ key?: string; src: string | null }>).detail;
      if (key) refreshPackArt(key, src ?? undefined);
    });
    this.#unbind = bindStopFocus(element, (key) => this.#route?.focusKey(key));
    // The hover popover is drawn in the canvas, so its box is left out of the panel; the scans raise the events.
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      // The Rules reference opens over this screen; nothing else covers it.
      area: (pointer) => screenHoverArea(this, pointer),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    this.#cards = new CardEvents(region);
    this.#cards.onInspect = (cardId, face) =>
      this.scene.launch(SCENES.inspect, { card: { cardId, face: face ?? { kind: "front" } } });
  }

  /** The page said something (a tap, or the focus route's click on a stop). */
  #heard(detail: LearnEventDetail): void {
    switch (detail.type) {
      case "close":
        return this.#leave();
      case "tell-more":
        return this.#openRules();
      case "start":
        return void this.#startTheFight();
      case "glossary":
        this.scene.launch(SCENES.rules, {
          initialTab: "glossary",
          initialQuery: detail.heading,
        } satisfies RulesSceneData);
        this.#page?.element.closeTip();
        return;
      case "tip":
        return this.#queueStops();
      default:
        return;
    }
  }

  #nameOf(cardId: string, english: string): string {
    return localizedNameOf(cardId, artLanguageNow()) ?? english;
  }

  /** A card's scan: its URL (held while shown), cropped to fill for a portrait card and fitted whole for a landscape one. */
  #pictureOf(cardId: string, face: CardFace, cover: boolean): PictureSource {
    const held = this.#leases.image(artFor(CARDS_BY_ID.get(cardId), face));
    return {
      src: held.src,
      missing: t("rules.noScan"),
      ...(cover ? { cover: { x: 0.5, y: 0.5 } } : {}),
      ...(held.retry !== undefined ? { retry: held.retry } : {}),
    };
  }

  #card(
    key: "win" | "scheme" | "hero",
    cardId: string,
    face: CardFace,
    heading: string,
    body: string,
    terms?: WinCardModel["terms"],
  ): WinCardModel {
    const win = key === "win";
    const landscape = key === "scheme";
    return {
      tag: t(win ? "howToWin.tag.win" : "howToWin.tag.lose"),
      tone: win ? "heal" : "red",
      heading,
      cardId,
      face,
      picture: this.#pictureOf(cardId, face, !landscape),
      // A main scheme scan is a landscape card (`docs/guided-mode.md`'s art convention), unlike the portrait scans.
      art: landscape ? "landscape" : "portrait",
      scanKey: `scan:${key}`,
      body,
      ...(terms ? { terms } : {}),
    };
  }

  #model(width: number, wide: boolean): HowToWinPageModel {
    const content = howToWinContent();
    const pad = wide ? 24 : 16;
    const title = t("howToWin.lesson");
    // Set under the dark mode tab, or stopped before it, when a long (Spanish) title would run under it.
    const left = pad + CLOSE_SIZE + 12;
    const room = width - pad - TICKS_WIDTH - 12 - left;
    const { drop, maxRight } = sheetThemeFor(this, {
      width,
      textLeft: left,
      textRight: left + Math.min(room, estimateBangersWidth(title, TITLE_SIZE)),
      textTop: BAR_HEIGHT / 2 - 12,
      textHeight: 24,
      barHeight: BAR_HEIGHT,
    });
    const scheme = termTextRunsOf(
      t("howToWin.scheme.body", {
        scheme: this.#nameOf(content.mainSchemeCardId, content.mainSchemeName),
        threat: content.threatTarget,
      }),
      t("howToWin.tip.glossary"),
    );
    return {
      header: {
        heading: title,
        closeLabel: t("scenario.back"),
        // The close is a drawn ×, not a button: its Cancel glyph follows the title.
        glyph: this.#glyphs.glyph("close", ["cancel"], "ink", CLOSE_HINT_HEIGHT),
        ticks: { count: 5, filled: 1, label: title },
        drop,
        max: maxRight === null ? 0 : Math.max(40, Math.min(room, maxRight - left)),
      },
      title: { first: t("howToWin.title1"), second: t("howToWin.title2") },
      cards: {
        win: this.#card(
          "win",
          content.villainCardId,
          { kind: "villainStage", sideIndex: 0, stageIndex: 0 },
          t("howToWin.win.title"),
          tPlural("howToWin.win.body", content.stageCount, {
            villain: this.#nameOf(content.villainCardId, content.villainName),
            stages: content.stageCount,
          }),
        ),
        scheme: this.#card(
          "scheme",
          content.mainSchemeCardId,
          { kind: "mainSchemeStage", stageIndex: 0, side: "B" },
          t("howToWin.scheme.title"),
          "",
          scheme,
        ),
        hero: this.#card(
          "hero",
          content.heroCardId,
          { kind: "hero" },
          t("howToWin.hero.title"),
          t("howToWin.hero.body", { hero: this.#nameOf(content.heroCardId, content.heroName) }),
        ),
      },
      round: { label: t("howToWin.everyRound"), steps: EVERY_ROUND_STEP_KEYS.map((key) => t(key)) },
      actions: {
        tellLabel: t("howToWin.tellMore"),
        startLabel: this.#starting ? t("howToPlay.suitingUp") : t("howToWin.start"),
        starting: this.#starting,
      },
    };
  }

  /** Sets the page from the content and the screen's shape. */
  #compose(): void {
    if (!this.#alive || !this.#page) return;
    this.#leases.begin();
    this.#glyphs.reset();
    resetHoverCards(this);
    const { width, height } = this.scale.gameSize;
    const form = formFactorFor(width, height);
    const wide = form === "desktop" || form === "tabletLandscape";
    this.#band?.setSize(width, BAR_HEIGHT);
    const { region, element } = this.#page;
    region.setRect({ x: 0, y: 0, width, height });
    element.mode = wide ? "wide" : "narrow";
    element.model = this.#model(width, wide);
    this.#glyphs.settled();
    this.#leases.end();
    this.#hover?.onDraw();
    this.#queueStops();
    this.#publishDebug();
  }

  /** Reads the page's stops once it has drawn, its parts included (the cards and their term text draw a level down). */
  #queueStops(): void {
    if (this.#syncing || !this.#page) return;
    this.#syncing = true;
    const { element } = this.#page;
    void settleElements(element).then(() => {
      this.#syncing = false;
      if (this.#alive) this.#syncStops();
    });
  }

  #syncStops(): void {
    if (!this.#page || !this.#route) return;
    const { element, region } = this.#page;
    const stops = new Map<string, FocusStop>(focusStopsOf(element, (target) => region.rectOf(target)));
    this.#stops = stops;
    const terms = [...stops.keys()].filter((key) => key.startsWith("term:"));
    this.#route.set(["close", ...terms, "tell-me-more", "start-the-fight"], stops);
  }

  /** Headless click-through hook only (never referenced by product code): each term's screen rect and the tip's. */
  #publishDebug(): void {
    if (!import.meta.env.DEV) return;
    const rectOf = (key: string): Rect | null => {
      const rect = this.#stops.get(key)?.rect;
      return typeof rect === "function" ? rect() : (rect ?? null);
    };
    (window as unknown as { __mcHowToWinDebug?: unknown }).__mcHowToWinDebug = {
      termRects: () =>
        [...this.#stops.keys()]
          .filter((key) => key.startsWith("term:"))
          .map((key) => ({ id: key.slice("term:".length), rect: rectOf(key) })),
      // The tip's link is a stop only while the tip is open.
      tipRect: () => rectOf("tip-link"),
      hoverKey: () => this.#hover?.shownKey ?? null,
    };
  }

  #openRules(): void {
    this.scene.launch(SCENES.rules, { initialTab: "glossary" } satisfies RulesSceneData);
  }

  /** "Start the fight": marks lesson 1 done and starts the tutorial game through the one shared call site. */
  async #startTheFight(): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    setGuidePrefs(markLessonDone(guidePrefs(), "how-to-win"));
    this.#compose();
    await startTutorialGame();
    if (!this.sys.isActive()) return;
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.board);
  }

  #leave(): void {
    this.scale.off("resize", this.#compose, this);
    const target =
      this.#backTo === "chooser" ? SCENES.guideChooser : this.#backTo === "howToPlay" ? SCENES.howToPlay : SCENES.title;
    goToScreen(this, target);
  }
}
