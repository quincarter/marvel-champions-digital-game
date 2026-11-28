/**
 * The first-run chooser (guided mode G6a, `docs/guided-mode.md` §3.9, §4): "New to the fight?" — read
 * `guide-chooser-model.ts`'s header for the content split this scene shows.
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
 * The whole screen is one page element, `mc-guide-chooser-page` (`views/guide-chooser/`), made of section elements
 * (`components/learn/`): the picture (the panel-size WebP copy of the title picture, `art/title-art.ts`
 * `displayCopyOf`, a lazy `<img>`), the three guide levels as radio cards and Suit up. This scene only mounts it, sets
 * its properties, and handles its one `mc-learn` event. It keeps the focus route (the page's `data-stop` parts, read by
 * `dom/element-stops.ts`, its ring drawn in the DOM, `dom/dom-ring.ts`), the picked level, the Back glyph and navigation.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/guide-chooser/mc-guide-chooser-page/mc-guide-chooser-page.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { TITLE_ART, displayCopyOf, pickTitleArt, type TitleArt } from "../art/title-art.js";
import {
  GUIDE_CHOOSER_OPTIONS,
  guideChooserFocusOrder,
  guideChooserLessonChips,
  type GuideChooserValue,
} from "../view/guide-chooser-model.js";
import { formFactorFor } from "../view/layout.js";
import { guidePrefs, setGuidePrefs } from "../guide/guide-store.js";
import { withLevel } from "../guide/guide-prefs.js";
import { newGameDraft } from "./title.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { settleElements } from "../dom/element-settle.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import type { LearnEventDetail } from "../components/learn/shared/learn-events.types.js";
import type { GuideChooserPageModel } from "../views/guide-chooser/mc-guide-chooser-page/mc-guide-chooser-page.types.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { HowToWinSceneData } from "./how-to-win.js";

type Page = MountedElement<HTMLElementTagNameMap["mc-guide-chooser-page"]>;

/** The height Back is drawn for, which its Cancel glyph is sized from. */
const BACK_HEIGHT = 52;

export class GuideChooserScene extends Phaser.Scene {
  #glyphs!: ControlGlyphs;
  #route: FocusRoute | null = null;
  #selected: GuideChooserValue = "full";
  #art: TitleArt | null = null;
  #alive = false;
  #page: Page | null = null;
  #unbind: (() => void) | null = null;
  #syncing = false;
  #wide = false;

  constructor() {
    super(SCENES.guideChooser);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#alive = true;
    this.#page = null;
    this.#glyphs = new ControlGlyphs(this, () => this.#compose());
    this.scale.on("resize", this.#compose, this);
    // A language switch (#390): the screen reads again in the new language.
    const unsubscribeLanguage = onLanguageChange(() => {
      if (this.sys.isActive()) this.#compose();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#compose, this);
      unsubscribeLanguage();
      this.#unbind?.();
      this.#unbind = null;
      this.#glyphs.dispose();
      this.#page = null;
    });
    this.#selected = "full";
    this.#art = pickTitleArt(TITLE_ART, null);
    this.#mount();
    // Start is "forward": it presses Suit up.
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => this.#decline(),
      primary: () => "suit-up",
    });
    this.#compose();
    fadeScreenIn(this);
  }

  /** Mounts the page and wires what it says. */
  #mount(): void {
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-guide-chooser-page", { x: 0, y: 0, width, height });
    this.#page = mounted;
    mounted.element.addEventListener("mc-learn", (event) => this.#heard(event.detail));
    this.#unbind = bindStopFocus(mounted.element, (key) => this.#route?.focusKey(key));
  }

  /** The page said something (a tap, or the focus route's click on a stop). */
  #heard(detail: LearnEventDetail): void {
    switch (detail.type) {
      case "option":
        this.#selected = detail.value;
        return this.#compose();
      case "back":
        return this.#decline();
      case "suit-up":
        return this.#chooseGuide();
      default:
        return;
    }
  }

  #model(wide: boolean): GuideChooserPageModel {
    return {
      art: {
        // The panel-size copy of the picture, cover-cropped around its center; it loads when the panel does.
        picture: this.#art ? { src: displayCopyOf(this.#art).url, cover: { x: 0.5, y: 0.5 } } : null,
        heading: t("guide.title"),
      },
      options: {
        subtitle: t("guide.subtitle"),
        options: GUIDE_CHOOSER_OPTIONS.map((option) => ({
          value: option.value,
          label: t(option.labelKey),
          body: t(option.bodyKey),
          selected: this.#selected === option.value,
          recommended: option.recommended,
          recommendedLabel: t("guide.recommended"),
        })),
        // The lesson chips are for the wide layouts: a phone has no room for them.
        chips: wide ? guideChooserLessonChips() : [],
      },
      actions: {
        suitLabel: t("guide.suitUp"),
        backLabel: t("guide.back"),
        backGlyph: this.#glyphs.glyph("back", ["cancel"], "paper", BACK_HEIGHT),
      },
    };
  }

  /** Sets the page from the picked level and the screen's shape. */
  #compose(): void {
    if (!this.#alive || !this.#page) return;
    this.#glyphs.reset();
    const { width, height } = this.scale.gameSize;
    const form = formFactorFor(width, height);
    const wide = form === "desktop" || form === "tabletLandscape";
    this.#wide = wide;
    const { region, element } = this.#page;
    region.setRect({ x: 0, y: 0, width, height });
    element.mode = wide ? "wide" : "narrow";
    element.model = this.#model(wide);
    this.#glyphs.settled();
    this.#queueStops();
  }

  /** Reads the page's stops once it has drawn, its parts included (every card is a level down). */
  #queueStops(): void {
    if (this.#syncing || !this.#page) return;
    this.#syncing = true;
    const { element, region } = this.#page;
    void settleElements(element).then(() => {
      this.#syncing = false;
      if (!this.#alive || !this.#route) return;
      this.#route.set(
        guideChooserFocusOrder(this.#wide),
        focusStopsOf(element, (target) => region.rectOf(target)),
      );
    });
  }

  /** SUIT UP: writes the picked level (`withLevel` marks the chooser seen), then either goes to How to win (G6b) or
   * carries on with the New game the player started (scenario select). */
  #chooseGuide(): void {
    setGuidePrefs(withLevel(guidePrefs(), this.#selected));
    this.scale.off("resize", this.#compose, this);
    if (this.#selected === "full") {
      goToScreen(this, SCENES.howToWin, { backTo: "chooser" } satisfies HowToWinSceneData);
      return;
    }
    goToScreen(this, SCENES.scenarioSelect, { draft: newGameDraft() } satisfies ScenarioSelectData);
  }

  /** Back / Escape: back to Title with nothing saved (§3.10: never a trap). The chooser asks again at the next
   * New game, since no choice was made. */
  #decline(): void {
    this.scale.off("resize", this.#compose, this);
    goToScreen(this, SCENES.title);
  }
}
