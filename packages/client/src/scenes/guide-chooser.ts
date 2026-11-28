/**
 * The first-run chooser (guided mode G6a, `docs/guided-mode.md` §3.9, §4): "New to the fight?" — read
 * `guide-chooser-model.ts`'s header for the content/layout split this scene draws.
 *
 * Reached from Title's New game while `isFirstLaunch(guidePrefs())` is true (no `mc-guide`
 * record yet). Every other path here is deliberate: `?screen=chooser` (dev jump), and later Settings' "Play the
 * tutorial" / Title's "How to play" hub (G6c).
 *
 * Picking "Learn as you play" and pressing Suit up goes to G6b's "How to win" screen (`scenes/how-to-win.ts`) with
 * `backTo: "chooser"`, so its own Back/×/Escape return here rather than to Title. How to win's own "Start the
 * fight" is what actually starts the tutorial game, the same way the dev jump `?screen=board&tutorial=1` does
 * (`scenes/boot.ts`'s own `startDevTutorialGame`) — both go through `guide/start-tutorial.ts`'s one shared
 * `startTutorialGame`. Hints/No guide record the level and carry on into scenario select.
 *
 * Back or Escape returns to Title with nothing saved (§3.10: "nobody is locked in"); the chooser asks again at the next
 * New game.
 *
 * **One Lit panel over the canvas** (`mc-sheet`, `dom/sheet-builder.ts`, as `scenes/how-to-play.ts` is) at the rects
 * `view/guide-chooser-model.ts` gives: the picture (the panel-size WebP copy of the title picture, `art/title-art.ts`
 * `displayCopyOf`, an `<img>` that loads lazily), its scrim, the banner, the three option cards, Back and Suit up. The
 * scene keeps the focus route (its ring drawn in the DOM, `dom/dom-ring.ts`), the Back glyph and navigation.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { accent, dotGrid, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { isDesktopType } from "../ui/desktop-type.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { TITLE_ART, displayCopyOf, pickTitleArt, type TitleArt } from "../art/title-art.js";
import {
  GUIDE_CHOOSER_OPTIONS,
  guideChooserFocusOrder,
  guideChooserLayout,
  guideChooserLessonChips,
  type GuideChooserLayout,
  type GuideChooserValue,
} from "../view/guide-chooser-model.js";
import type { Rect } from "../view/layout.js";
import { guidePrefs, setGuidePrefs } from "../guide/guide-store.js";
import { withLevel } from "../guide/guide-prefs.js";
import { newGameDraft } from "./title.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { DomRegion, renderNow } from "../dom/dom-region.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { SheetBuilder } from "../dom/sheet-builder.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { HowToWinSceneData } from "./how-to-win.js";

const BODY_TYPE: TypeSpec = typeRole.body;
const TITLE_TYPE: TypeSpec = typeRole.rowTitle;
const CHIP_TYPE: TypeSpec = { ...typeRole.label, size: 9 };
const STAMP_TYPE: TypeSpec = { ...typeRole.label, size: 9 };
const RADIO_RADIUS = 9;
const CHIP_HEIGHT = 20;

export class GuideChooserScene extends Phaser.Scene {
  #glyphs!: SheetGlyphs;
  /** What a hanging glyph must not cover: the option cards and Suit up. */
  #obstacles: Rect[] = [];
  #route: FocusRoute | null = null;
  #selected: GuideChooserValue = "full";
  #art: TitleArt | null = null;
  /** The screen, one Lit panel over the canvas; made on the first draw and kept. */
  #region: DomRegion<McSheet> | null = null;
  /** What each key in the panel does when tapped, this draw. */
  #actions = new Map<string, () => void>();

  constructor() {
    super(SCENES.guideChooser);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#region = null;
    this.scale.on("resize", this.#rebuild, this);
    // A language switch (#390): the screen reads again in the new language.
    const unsubscribeLanguage = onLanguageChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    this.#glyphs = new SheetGlyphs(
      this,
      () => this.#rebuild(),
      () => this.#obstacles,
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      unsubscribeLanguage();
      this.#glyphs.dispose();
      // The panel goes with the scene (`DomRegion`); the next open makes a new one.
      this.#region = null;
    });
    this.#selected = "full";
    this.#art = pickTitleArt(TITLE_ART, null);
    // Start is "forward": it presses Suit up.
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#decline(),
      primary: () => "suit-up",
    });
    this.#rebuild();
    fadeScreenIn(this);
  }

  #rebuild(): void {
    destroyChildren(this);
    this.#glyphs.reset();
    this.#actions = new Map();

    const { width, height } = this.scale.gameSize;
    const layout = guideChooserLayout(width, height);
    this.#obstacles = [...layout.options, layout.suitUp];
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);

    // Ground: paper everywhere (the picture sits over an ink scrim so the yellow banner/paper cards stay legible).
    b.box({ x: 0, y: 0, width, height }, { fill: surface.paper.hex });
    b.box(layout.art, { fill: surface.ink.hex });
    b.dots(layout.art, "ink", dotGrid.onInk.spacing, dotGrid.onInk.radius, dotGrid.onInk.alpha);
    // The panel-size copy of the picture, cover-cropped around its center; it loads when the panel does.
    if (this.#art) b.image(layout.art, { src: displayCopyOf(this.#art).url, cover: { x: 0.5, y: 0.5 }, key: "art" });
    // Scrim so the banner reads over any picture, phone (full-bleed) or wide (left panel) alike.
    b.box(layout.art, { fill: surface.ink.hex, fillAlpha: layout.wide ? 0.28 : 0.5 });

    this.#drawBanner(b, layout);
    b.text(layout.subtitle.x, layout.subtitle.y, t("guide.subtitle"), BODY_TYPE, {
      color: surface.ink.hex,
      wrapWidth: layout.subtitle.width,
    });

    const stops = new Map<string, FocusStop>();
    GUIDE_CHOOSER_OPTIONS.forEach((option, index) => {
      const rect = layout.options[index]!;
      this.#drawOption(b, layout, option.value, rect, index === 0);
      const select = (): void => {
        this.#selected = option.value;
        this.#rebuild();
      };
      b.tap(`option:${option.value}`, rect);
      this.#actions.set(`option:${option.value}`, select);
      stops.set(`option:${option.value}`, { rect, activate: select });
    });

    if (layout.back.width > 0) {
      this.#glyphs.button(b, {
        key: "back",
        rect: layout.back,
        label: t("guide.back"),
        look: "secondary",
        type: typeRole.menuButton,
        ids: ["cancel"],
        ground: "paper",
      });
      this.#actions.set("back", () => this.#decline());
      stops.set("back", { rect: layout.back, activate: () => this.#decline() });
    }

    b.button({
      key: "suit-up",
      rect: layout.suitUp,
      label: t("guide.suitUp"),
      look: "primary",
      type: typeRole.barTitle,
    });
    this.#actions.set("suit-up", () => this.#chooseGuide());
    stops.set("suit-up", { rect: layout.suitUp, activate: () => this.#chooseGuide() });

    this.#mount(width, height, b);
    this.#route?.set(guideChooserFocusOrder(layout.wide), stops);
  }

  /** Hands the built parts to the panel (made once) and renders them now. */
  #mount(width: number, height: number, builder: SheetBuilder): void {
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#region = new DomRegion(this, element, { x: 0, y: 0, width, height });
    }
    const region = this.#region;
    region.setRect({ x: 0, y: 0, width, height });
    region.element.nodes = builder.nodes;
    renderNow(region.element);
  }

  #drawBanner(b: SheetBuilder, layout: GuideChooserLayout): void {
    const { banner } = layout;
    b.box({ ...banner, x: banner.x + 3, y: banner.y + 3 }, { fill: surface.ink.hex });
    b.box(banner, { fill: signal.caution.hex });
    // The 3px outline, centered on the edge as Phaser strokes it.
    b.box(banner, { stroke: surface.ink.hex, strokeWidth: 3 });
    b.text(banner.x + banner.width / 2, banner.y + banner.height / 2, t("guide.title"), typeRole.barTitle, {
      size: 22,
      color: surface.ink.hex,
      origin: [0.5, 0.5],
    });
  }

  #drawOption(b: SheetBuilder, layout: GuideChooserLayout, value: GuideChooserValue, rect: Rect, first: boolean): void {
    const option = GUIDE_CHOOSER_OPTIONS.find((o) => o.value === value)!;
    const selected = this.#selected === value;
    b.box(rect, { fill: surface.card.hex });
    b.box(rect, {
      stroke: selected ? accent.heroRed.hex : surface.ink.hex,
      strokeWidth: selected ? 3 : 1.5,
      key: `card:${value}`,
    });

    const padX = 20;
    const radioCx = rect.x + padX + RADIO_RADIUS;
    const radioCy = rect.y + 26;
    const circle = (radius: number): Rect => ({
      x: radioCx - radius,
      y: radioCy - radius,
      width: radius * 2,
      height: radius * 2,
    });
    b.box(circle(RADIO_RADIUS), { stroke: surface.ink.hex, strokeWidth: 2, round: true });
    if (selected) b.box(circle(RADIO_RADIUS - 4), { fill: accent.heroRed.hex, round: true });

    const textLeft = radioCx + RADIO_RADIUS + 12;
    b.text(textLeft, rect.y + 14, t(option.labelKey), TITLE_TYPE, { size: 16, color: surface.ink.hex });
    b.text(textLeft, rect.y + 36, t(option.bodyKey), BODY_TYPE, {
      color: surface.ink.hex,
      wrapWidth: rect.width - (textLeft - rect.x) - padX - (option.recommended ? 90 : 0),
    });

    if (option.recommended) {
      // Sized to the measured label, not a guessed fixed width (`ui/guide-tag.ts`'s own `STAMP_PAD` convention): a
      // fixed box can run narrower than "RECOMMENDED" actually renders and let the label spill past it.
      const label = t("guide.recommended");
      const stampPad = 10;
      const stampHeight = 20;
      const stampWidth = b.measure(label, STAMP_TYPE).width + stampPad * 2;
      const sx = rect.x + rect.width - stampWidth - 10;
      const sy = rect.y + 10;
      b.box({ x: sx, y: sy, width: stampWidth, height: stampHeight }, { fill: accent.heroRed.hex });
      b.text(sx + stampWidth / 2, sy + stampHeight / 2, label, STAMP_TYPE, {
        color: surface.paper.hex,
        origin: [0.5, 0.5],
      });
    }

    if (layout.chipsRow.width > 0 && first) {
      const chipPadX = 8;
      const chipGap = 6;
      const rowGap = 4;
      let cx = layout.chipsRow.x;
      let cy = layout.chipsRow.y;
      for (const chip of guideChooserLessonChips()) {
        // Measured, not estimated: a chip's real width varies with the actual letters, and a fixed
        // characters-times-px guess either clips the label or leaves the box wider than it needs to be.
        const w = b.measure(chip, CHIP_TYPE).width + chipPadX * 2;
        if (cx > layout.chipsRow.x && cx + w > layout.chipsRow.x + layout.chipsRow.width) {
          cx = layout.chipsRow.x;
          cy += CHIP_HEIGHT + rowGap;
        }
        b.box(
          { x: cx, y: cy, width: w, height: CHIP_HEIGHT },
          { fill: surface.parchment.hex, stroke: surface.ink.hex, strokeWidth: 1 },
        );
        b.text(cx + w / 2, cy + CHIP_HEIGHT / 2, chip, CHIP_TYPE, { color: surface.ink.hex, origin: [0.5, 0.5] });
        cx += w + chipGap;
      }
    }
  }

  /** SUIT UP: writes the picked level (`withLevel` marks the chooser seen), then either goes to How to win (G6b) or
   * carries on with the New game the player started (scenario select). */
  #chooseGuide(): void {
    setGuidePrefs(withLevel(guidePrefs(), this.#selected));
    this.scale.off("resize", this.#rebuild, this);
    if (this.#selected === "full") {
      goToScreen(this, SCENES.howToWin, { backTo: "chooser" } satisfies HowToWinSceneData);
      return;
    }
    goToScreen(this, SCENES.scenarioSelect, { draft: newGameDraft() } satisfies ScenarioSelectData);
  }

  /** Back / Escape: back to Title with nothing saved (§3.10: never a trap). The chooser asks again at the next
   * New game, since no choice was made. */
  #decline(): void {
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.title);
  }
}
