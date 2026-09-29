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
 */
import Phaser from "phaser";
import { accent, dotGrid, ink, signal, surface, typeRole, type TypeSpec } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, paintDotGrid } from "../ui/widgets.js";
import { McTermText } from "../ui/term-text.js";
import { McTooltip } from "../ui/tooltip.js";
import type { TermTextTerm } from "../view/term-text-model.js";
import { tooltipContentOf } from "../view/term-text-model.js";
import { EVERY_ROUND_STEPS, howToWinContent, howToWinLayout, type HowToWinLayout } from "../view/how-to-win-model.js";
import { CARD_ASPECT } from "../view/layout.js";
import { CARDS_BY_ID } from "../content/pool.js";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { guidePrefs, setGuidePrefs } from "../guide/guide-store.js";
import { markLessonDone } from "../guide/guide-prefs.js";
import { startTutorialGame } from "../guide/start-tutorial.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
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

export class HowToWinScene extends Phaser.Scene {
  #backTo: "chooser" | "howToPlay" | "title" = "title";
  #route: FocusRoute | null = null;
  #tooltip: McTooltip | null = null;
  #termBlocks: McTermText[] = [];
  #buttons: McButton[] = [];
  #starting = false;

  constructor() {
    super(SCENES.howToWin);
  }

  create(data: HowToWinSceneData = {}): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#backTo = data.backTo === "chooser" || data.backTo === "howToPlay" ? data.backTo : "title";
    this.#starting = false;
    this.scale.on("resize", this.#rebuild, this);
    const artOff = cardArt(this).onArrived(() => this.#rebuild());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      artOff();
      this.#tooltip?.destroy();
      this.#tooltip = null;
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
    // `destroyChildren` empties the whole display list (`ui/destroy-children.ts`'s own doc comment: every redraw's
    // "start from a blank screen"), so the tooltip — whose title/definition/link are ordinary `scene.add.text`
    // objects, kept alive across redraws — has to be rebuilt here too, not just in `create()`: a stale reference
    // into destroyed Phaser objects is what a term's tooltip crashed into in browser verification otherwise
    // (`McTooltip.show` writing to a `Text` whose frame no longer exists).
    this.#tooltip?.destroy();
    destroyChildren(this);
    this.#tooltip = new McTooltip(this);
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    for (const block of this.#termBlocks) block.destroy();
    this.#termBlocks = [];

    const { width, height } = this.scale.gameSize;
    const layout = howToWinLayout(width, height);
    const content = howToWinContent();

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    this.#drawHeader(layout);
    this.#drawTitle(layout);
    this.#drawWinCard(layout, content);
    this.#drawLoseSchemeCard(layout, content);
    this.#drawLoseHeroCard(layout, content);
    this.#drawEveryRound(layout);
    this.#drawActions(layout);

    // Headless click-through hook only (never referenced by product code): the "threat" term is canvas-drawn, so
    // a test driving real pointer events needs its screen rect rather than a DOM selector (`scenes/term-text-demo.ts`'s
    // own `__mcTermTextDebug` is the pattern this follows).
    if (import.meta.env.DEV) {
      (window as unknown as { __mcHowToWinDebug?: unknown }).__mcHowToWinDebug = {
        termRects: () => this.#termBlocks.flatMap((block) => block.debugTermRects()),
      };
    }
  }

  #drawHeader(layout: HowToWinLayout): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(0, 0, this.scale.gameSize.width, layout.header.height);

    const { close } = layout;
    this.add
      .text(close.x + close.width / 2, close.y + close.height / 2, "×", {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "26px",
      })
      .setOrigin(0.5);

    this.add
      .text(close.x + close.width + 12, layout.header.height / 2, "LESSON 1 OF 5", {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "18px",
      })
      .setOrigin(0, 0.5);

    // A five-segment tick bar, first segment filled (guide caution yellow — this screen is lesson 1 of 5), the
    // rest empty: the same "where am I" signal `docs/guided-mode.md`'s own step labels give inside a lesson, but
    // for the five-lesson run as a whole.
    const segments = 5;
    const gap = 4;
    const segWidth = (layout.progress.width - gap * (segments - 1)) / segments;
    for (let i = 0; i < segments; i++) {
      const sx = layout.progress.x + i * (segWidth + gap);
      g.fillStyle(i === 0 ? signal.caution.hex : surface.paper.hex, i === 0 ? 1 : 0.3).fillRect(
        sx,
        layout.progress.y,
        segWidth,
        layout.progress.height,
      );
    }

    const zone = this.add
      .zone(close.x, close.y, close.width, close.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on("pointerup", () => this.#leave());
  }

  #drawTitle(layout: HowToWinLayout): void {
    this.add
      .text(layout.title.x, layout.title.y, "ONE WAY TO WIN.", { ...textStyle(TITLE_TYPE, surface.ink.hex) })
      .setFontSize(30);
    this.add
      .text(layout.title.x, layout.title.y + 30, "TWO WAYS TO LOSE.", {
        ...textStyle(TITLE_TYPE, accent.heroRed.hex),
      })
      .setFontSize(30);
  }

  /** A card's ink frame, tag stamp, art thumbnail and copy — shared shape for all three (WIN, both LOSE).
   *
   * `"landscape"` (the default, and the only shape on phone/tablet-portrait — P02's own list-row build): art on the
   * left at a small fixed width, title/body filling the rest. `"portrait"`: art fills the top of the card at a real
   * card-scan aspect ratio (`CARD_ASPECT`), title/body below — the shape the wide WIN card needs to read as "a big
   * card", not a cropped sliver of art next to a paragraph (this fix's own brief). */
  #drawCard(
    rect: { x: number; y: number; width: number; height: number },
    tag: { readonly label: string; readonly fill: number },
    title: string,
    artKey: string | null,
    body: () => void,
    orientation: "landscape" | "portrait" = "landscape",
  ): void {
    const g = this.add.graphics();
    g.fillStyle(surface.card.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x + 1.5, rect.y + 1.5, rect.width - 3, rect.height - 3);

    if (orientation === "portrait") {
      this.#drawPortraitCard(rect, g, tag, title, artKey, body);
      return;
    }

    // Sized to the card's own real aspect ratio against the available height, not a flat 120px sliver — a LOSE
    // card on a wide layout is tall enough (the two now split the WIN card's own row height) that a fixed-width
    // thumbnail reads as cramped next to all that empty height. `Math.max(120, …)` keeps the phone/tablet-portrait
    // row (a short, wide strip) at its original size rather than shrinking it.
    const artHeight = rect.height - 20;
    const artWidth = Math.min(rect.width * 0.38, Math.max(120, artHeight * CARD_ASPECT));
    const artRect = { x: rect.x + 10, y: rect.y + 10, width: artWidth, height: artHeight };
    g.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
    drawArt(this, artKey, artRect, { fit: "cover" });

    const textLeft = artRect.x + artRect.width + 14;
    const textWidth = rect.x + rect.width - 10 - textLeft;

    const tagLabel = this.add.text(0, 0, tag.label, textStyle(TAG_TYPE, surface.ink.hex)).setVisible(false);
    const tagWidth = tagLabel.width + 16;
    g.fillStyle(tag.fill, 1).fillRect(textLeft, rect.y + 10, tagWidth, 20);
    tagLabel
      .setPosition(textLeft + tagWidth / 2, rect.y + 20)
      .setOrigin(0.5)
      .setVisible(true);

    this.add
      .text(textLeft, rect.y + 36, title.toUpperCase(), textStyle(CARD_TITLE_TYPE, surface.ink.hex))
      .setWordWrapWidth(textWidth);

    const bodyStartY = rect.y + 66;
    this.#bodyOrigin = { x: textLeft, y: bodyStartY, width: textWidth };
    body();
  }

  #drawPortraitCard(
    rect: { x: number; y: number; width: number; height: number },
    g: Phaser.GameObjects.Graphics,
    tag: { readonly label: string; readonly fill: number },
    title: string,
    artKey: string | null,
    body: () => void,
  ): void {
    const pad = 12;
    // Text area reserved below the art: tag stamp + title + a couple of body lines, same budget the landscape
    // cards give their copy.
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
    g.fillStyle(surface.parchment.hex, 1).fillRect(artRect.x, artRect.y, artRect.width, artRect.height);
    drawArt(this, artKey, artRect, { fit: "cover" });

    const textLeft = rect.x + pad;
    const textWidth = rect.width - pad * 2;
    const tagY = artRect.y + artRect.height + 10;

    const tagLabel = this.add.text(0, 0, tag.label, textStyle(TAG_TYPE, surface.ink.hex)).setVisible(false);
    const tagWidth = tagLabel.width + 16;
    g.fillStyle(tag.fill, 1).fillRect(textLeft, tagY, tagWidth, 20);
    tagLabel
      .setPosition(textLeft + tagWidth / 2, tagY + 10)
      .setOrigin(0.5)
      .setVisible(true);

    this.add
      .text(textLeft, tagY + 26, title.toUpperCase(), textStyle(CARD_TITLE_TYPE, surface.ink.hex))
      .setWordWrapWidth(textWidth);

    this.#bodyOrigin = { x: textLeft, y: tagY + 56, width: textWidth };
    body();
  }

  #bodyOrigin: { x: number; y: number; width: number } = { x: 0, y: 0, width: 0 };

  #drawWinCard(layout: HowToWinLayout, content: ReturnType<typeof howToWinContent>): void {
    const villain = CARDS_BY_ID.get(content.villainCardId);
    const key = cardArt(this).request(this, artFor(villain, { kind: "villainStage", sideIndex: 0, stageIndex: 0 }));
    this.#drawCard(
      layout.win,
      { label: "WIN", fill: signal.heal.hex },
      "Knock out the villain",
      key,
      () => {
        const { x, y, width } = this.#bodyOrigin;
        this.add
          .text(
            x,
            y,
            `Bring ${content.villainName}'s health to 0. He has ${content.stageCount} stages — beat both.`,
            textStyle(typeRole.body, surface.ink.hex),
          )
          .setWordWrapWidth(width);
      },
      layout.wide ? "portrait" : "landscape",
    );
  }

  #drawLoseSchemeCard(layout: HowToWinLayout, content: ReturnType<typeof howToWinContent>): void {
    const mainScheme = CARDS_BY_ID.get(content.mainSchemeCardId);
    const key = cardArt(this).request(this, artFor(mainScheme, { kind: "mainSchemeStage", stageIndex: 0, side: "B" }));
    this.#drawCard(layout.loseScheme, { label: "LOSE", fill: accent.heroRed.hex }, "His plan finishes", key, () => {
      const { x, y, width } = this.#bodyOrigin;
      const block = new McTermText(this, {
        x,
        y,
        width,
        text: `${content.mainSchemeName} reaches ${content.threatTarget} [[threat|threat]].`,
        onTermOpen: (term, rect) => this.#openTooltip(term, rect),
        onTermClose: () => this.#tooltip?.hide(),
      });
      this.#termBlocks.push(block);
    });
  }

  #drawLoseHeroCard(layout: HowToWinLayout, content: ReturnType<typeof howToWinContent>): void {
    const hero = CARDS_BY_ID.get(content.heroCardId);
    const key = cardArt(this).request(this, artFor(hero, { kind: "hero" }));
    this.#drawCard(layout.loseHero, { label: "LOSE", fill: accent.heroRed.hex }, "You go down", key, () => {
      const { x, y, width } = this.#bodyOrigin;
      this.add
        .text(x, y, `${content.heroName}'s health hits 0.`, textStyle(typeRole.body, surface.ink.hex))
        .setWordWrapWidth(width);
    });
  }

  #drawEveryRound(layout: HowToWinLayout): void {
    const rect = layout.everyRound;
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2.5, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    const label = this.add.text(
      rect.x + 14,
      rect.y + 10,
      "EVERY ROUND",
      textStyle(STEP_LABEL_TYPE, surface.ink.hex, ink.secondary),
    );

    const pillHeight = 34;
    // Centred in the space left under the label, not anchored to the strip's bottom edge with a fixed offset — a
    // shorter strip (`EVERY_ROUND_HEIGHT`, trimmed alongside this) otherwise leaves a dead gap above the chips.
    const labelBottom = label.y + label.height + 8;
    const pillY = labelBottom + Math.max(0, rect.y + rect.height - 10 - labelBottom - pillHeight) / 2;
    let px = rect.x + 14;
    const maxRight = rect.x + rect.width - 14;
    EVERY_ROUND_STEPS.forEach((step, index) => {
      const stepLabel = this.add.text(0, 0, step, textStyle(TAG_TYPE, surface.ink.hex)).setVisible(false);
      const pillWidth = Math.min(stepLabel.width + 24, maxRight - px - (EVERY_ROUND_STEPS.length - 1 - index) * 40);
      g.fillStyle(index === 0 ? surface.ink.hex : accent.heroRed.hex, 1).fillRect(px, pillY, pillWidth, pillHeight);
      stepLabel
        .setPosition(px + pillWidth / 2, pillY + pillHeight / 2)
        .setOrigin(0.5)
        .setColor(cssOf(surface.paper.hex))
        .setVisible(true);
      px += pillWidth;
      if (index < EVERY_ROUND_STEPS.length - 1) {
        this.add
          .text(px + 6, pillY + pillHeight / 2, "▸", {
            ...textStyle(typeRole.barTitle, surface.ink.hex),
            fontSize: "18px",
          })
          .setOrigin(0, 0.5);
        px += 26;
      }
    });
  }

  #drawActions(layout: HowToWinLayout): void {
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Tell me more",
        type: typeRole.menuButton,
        rect: layout.tellMeMore,
        onClick: () => this.#openRules(),
      }),
    );
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#starting ? "Suiting up…" : "Start the fight ▸",
        type: typeRole.barTitle,
        rect: layout.startTheFight,
        enabled: !this.#starting,
        onClick: () => this.#startTheFight(),
      }),
    );

    const stops = new Map<string, FocusStop>();
    stops.set("close", { rect: layout.close, activate: () => this.#leave() });
    stops.set("tell-me-more", { rect: layout.tellMeMore, activate: () => this.#openRules() });
    stops.set("start-the-fight", { rect: layout.startTheFight, activate: () => this.#startTheFight() });
    this.#route?.set(["close", "tell-me-more", "start-the-fight"], stops);
  }

  #openTooltip(term: TermTextTerm, anchor: { x: number; y: number; width: number; height: number }): void {
    const content = tooltipContentOf(term);
    if (!content || !this.#tooltip) return;
    for (const block of this.#termBlocks) block.setTermsEnabled((id) => id === term.id);
    const viewport = { x: 0, y: 0, width: this.scale.width, height: this.scale.height };
    this.#tooltip.show(
      anchor,
      content,
      viewport,
      () => {
        this.scene.launch(SCENES.rules, {
          initialTab: "glossary",
          initialQuery: content.title,
        } satisfies RulesSceneData);
      },
      () => {
        for (const block of this.#termBlocks) block.setTermsEnabled(() => true);
      },
    );
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
