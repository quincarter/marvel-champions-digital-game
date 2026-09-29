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
 * Back or Escape returns to Title with nothing saved (§3.10: "nobody is locked in"); the chooser asks again at the
 * next New game.
 */
import Phaser from "phaser";
import { accent, dotGrid, surface, typeRole, type TypeSpec } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, paintDotGrid } from "../ui/widgets.js";
import { TITLE_ART, coverFit, pickTitleArt, type TitleArt } from "../art/title-art.js";
import {
  GUIDE_CHOOSER_OPTIONS,
  guideChooserFocusOrder,
  guideChooserLayout,
  guideChooserLessonChips,
  type GuideChooserLayout,
  type GuideChooserValue,
} from "../view/guide-chooser-model.js";
import { guidePrefs, setGuidePrefs } from "../guide/guide-store.js";
import { withLevel } from "../guide/guide-prefs.js";
import { newGameDraft } from "./title.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { HowToWinSceneData } from "./how-to-win.js";

const BODY_TYPE: TypeSpec = typeRole.body;
const TITLE_TYPE: TypeSpec = typeRole.rowTitle;
const CHIP_TYPE: TypeSpec = { ...typeRole.label, size: 9 };
const RADIO_RADIUS = 9;

export class GuideChooserScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #selected: GuideChooserValue = "full";
  #art: TitleArt | null = null;
  #artPanel: { x: number; y: number; width: number; height: number } | null = null;
  #artGeneration = 0;

  constructor() {
    super(SCENES.guideChooser);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.#rebuild, this));
    this.#selected = "full";
    this.#art = pickTitleArt(TITLE_ART, null);
    this.#route = new FocusRoute(this, { onCancel: () => this.#decline() });
    this.#rebuild();
    fadeScreenIn(this);
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const layout = guideChooserLayout(width, height);
    this.#artPanel = layout.art;

    // Ground: paper everywhere (the picture sits over an ink scrim so the yellow banner/paper cards stay legible).
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0).setDepth(GROUND_DEPTH);
    this.add
      .rectangle(layout.art.x, layout.art.y, layout.art.width, layout.art.height, surface.ink.hex)
      .setOrigin(0, 0)
      .setDepth(ART_GROUND_DEPTH);
    paintDotGrid(this, layout.art, "ink", dotGrid.onInk).setDepth(ART_GROUND_DEPTH);
    // Scrim so the banner reads over any picture, phone (full-bleed) or wide (left panel) alike.
    this.add
      .rectangle(
        layout.art.x,
        layout.art.y,
        layout.art.width,
        layout.art.height,
        surface.ink.hex,
        layout.wide ? 0.28 : 0.5,
      )
      .setOrigin(0, 0)
      .setDepth(ART_SCRIM_DEPTH);

    this.#drawBanner(layout);

    this.add
      .text(
        layout.subtitle.x,
        layout.subtitle.y,
        "Pick how much help you want. You can change this any time from the menu.",
        {
          ...textStyle(BODY_TYPE, surface.ink.hex),
        },
      )
      .setWordWrapWidth(layout.subtitle.width);

    const stops = new Map<string, FocusStop>();
    GUIDE_CHOOSER_OPTIONS.forEach((option, index) => {
      const rect = layout.options[index]!;
      this.#drawOption(layout, option.value, rect, index === 0);
      const select = (): void => {
        this.#selected = option.value;
        this.#rebuild();
      };
      const zone = this.add
        .zone(rect.x, rect.y, rect.width, rect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerup", select);
      stops.set(`option:${option.value}`, { rect, activate: select });
    });

    if (layout.back.width > 0) {
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: "Back",
          type: typeRole.menuButton,
          rect: layout.back,
          onClick: () => this.#decline(),
        }),
      );
      stops.set("back", { rect: layout.back, activate: () => this.#decline() });
    }

    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Suit up",
        type: typeRole.barTitle,
        rect: layout.suitUp,
        onClick: () => this.#chooseGuide(),
      }),
    );
    stops.set("suit-up", { rect: layout.suitUp, activate: () => this.#chooseGuide() });

    this.#route?.set(guideChooserFocusOrder(layout.wide), stops);
    this.#drawArt();
  }

  #drawBanner(layout: GuideChooserLayout): void {
    const g = this.add.graphics().setDepth(BANNER_DEPTH);
    g.fillStyle(surface.ink.hex, 1).fillRect(
      layout.banner.x + 3,
      layout.banner.y + 3,
      layout.banner.width,
      layout.banner.height,
    );
    g.fillStyle(0xf2b01e, 1).fillRect(layout.banner.x, layout.banner.y, layout.banner.width, layout.banner.height);
    g.lineStyle(3, surface.ink.hex, 1).strokeRect(
      layout.banner.x,
      layout.banner.y,
      layout.banner.width,
      layout.banner.height,
    );
    this.add
      .text(
        layout.banner.x + layout.banner.width / 2,
        layout.banner.y + layout.banner.height / 2,
        "NEW TO THE FIGHT?",
        { ...textStyle(typeRole.barTitle, surface.ink.hex), fontSize: "22px" },
      )
      .setOrigin(0.5, 0.5)
      .setDepth(BANNER_DEPTH);
  }

  #drawOption(
    layout: GuideChooserLayout,
    value: GuideChooserValue,
    rect: { x: number; y: number; width: number; height: number },
    first: boolean,
  ): void {
    const option = GUIDE_CHOOSER_OPTIONS.find((o) => o.value === value)!;
    const selected = this.#selected === value;
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(selected ? 3 : 1.5, selected ? accent.heroRed.hex : surface.ink.hex, 1).strokeRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );

    const padX = 20;
    const radioCx = rect.x + padX + RADIO_RADIUS;
    const radioCy = rect.y + 26;
    g.lineStyle(2, surface.ink.hex, 1).strokeCircle(radioCx, radioCy, RADIO_RADIUS);
    if (selected) g.fillStyle(accent.heroRed.hex, 1).fillCircle(radioCx, radioCy, RADIO_RADIUS - 4);

    const textLeft = radioCx + RADIO_RADIUS + 12;
    this.add.text(textLeft, rect.y + 14, option.label, { ...textStyle(TITLE_TYPE, surface.ink.hex), fontSize: "16px" });
    this.add
      .text(textLeft, rect.y + 36, option.body, textStyle(BODY_TYPE, surface.ink.hex))
      .setWordWrapWidth(rect.width - (textLeft - rect.x) - padX - (option.recommended ? 90 : 0));

    if (option.recommended) {
      // Sized to the measured label, not a guessed fixed width (`ui/guide-tag.ts`'s own `STAMP_PAD` convention) —
      // a fixed box can run narrower than "RECOMMENDED" actually renders and let the label spill past it.
      const stampPad = 10;
      const stampHeight = 20;
      const stampLabel = this.add
        .text(0, 0, "RECOMMENDED", textStyle({ ...typeRole.label, size: 9 }, surface.paper.hex))
        .setVisible(false);
      const stampWidth = stampLabel.width + stampPad * 2;
      const sx = rect.x + rect.width - stampWidth - 10;
      const sy = rect.y + 10;
      g.fillStyle(accent.heroRed.hex, 1).fillRect(sx, sy, stampWidth, stampHeight);
      stampLabel
        .setPosition(sx + stampWidth / 2, sy + stampHeight / 2)
        .setOrigin(0.5, 0.5)
        .setVisible(true);
    }

    if (layout.chipsRow.width > 0 && first) {
      const chips = guideChooserLessonChips();
      const chipPadX = 8;
      const chipGap = 6;
      const rowGap = 4;
      let cx = layout.chipsRow.x;
      let cy = layout.chipsRow.y;
      for (const chip of chips) {
        // Measured, not estimated: a chip's real width varies with the actual letters, and a fixed
        // characters-times-px guess either clips the label or leaves the box wider than it needs to be —
        // measuring the text this widget already has to draw settles both at once.
        const chipLabel = this.add.text(0, 0, chip, textStyle(CHIP_TYPE, surface.ink.hex)).setVisible(false);
        const w = chipLabel.width + chipPadX * 2;
        if (cx > layout.chipsRow.x && cx + w > layout.chipsRow.x + layout.chipsRow.width) {
          cx = layout.chipsRow.x;
          cy += CHIP_TYPE_HEIGHT + rowGap;
        }
        g.fillStyle(surface.parchment.hex, 1).fillRect(cx, cy, w, CHIP_TYPE_HEIGHT);
        g.lineStyle(1, surface.ink.hex, 1).strokeRect(cx, cy, w, CHIP_TYPE_HEIGHT);
        chipLabel
          .setPosition(cx + w / 2, cy + CHIP_TYPE_HEIGHT / 2)
          .setOrigin(0.5, 0.5)
          .setVisible(true);
        cx += w + chipGap;
      }
    }
  }

  /** Draws this scene's picture if its texture is ready, otherwise loads it once and draws on arrival — same shape as `TitleScene#drawArt`. */
  #drawArt(): void {
    const art = this.#art;
    const panel = this.#artPanel;
    if (!art || !panel) return;
    const generation = ++this.#artGeneration;
    const place = (): void => {
      if (generation !== this.#artGeneration || !this.sys.isActive() || !this.textures.exists(art.key)) return;
      const frame = this.textures.get(art.key).getSourceImage() as { width: number; height: number };
      const fit = coverFit(frame, panel);
      this.add
        .image(panel.x + panel.width / 2, panel.y + panel.height / 2, art.key)
        .setScale(fit.scale)
        .setCrop(fit.cropX, fit.cropY, fit.cropWidth, fit.cropHeight)
        .setDepth(ART_DEPTH);
    };
    if (this.textures.exists(art.key)) {
      place();
      return;
    }
    this.load.image(art.key, art.url);
    this.load.once(`filecomplete-image-${art.key}`, place);
    this.load.start();
  }

  /** SUIT UP: writes the picked level (`withLevel` marks the chooser seen), then either goes to How to win (G6b) or
   * carries on with the New game the player started (scenario select). */
  #chooseGuide(): void {
    setGuidePrefs(withLevel(guidePrefs(), this.#selected));
    if (this.#selected === "full") {
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.howToWin, { backTo: "chooser" } satisfies HowToWinSceneData);
      return;
    }
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.scenarioSelect, { draft: newGameDraft() } satisfies ScenarioSelectData);
  }

  /** Back / Escape: back to Title with nothing saved (§3.10: never a trap). The chooser asks again at the next
   * New game, since no choice was made. */
  #decline(): void {
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.title);
  }
}

const CHIP_TYPE_HEIGHT = 20;

/** Depth ladder, mirroring `TitleScene`'s own (art ground/dot grid, scrim, picture, banner) below everything else. */
const GROUND_DEPTH = -4;
const ART_GROUND_DEPTH = -3;
const ART_SCRIM_DEPTH = -1;
const ART_DEPTH = -2;
const BANNER_DEPTH = 1;
