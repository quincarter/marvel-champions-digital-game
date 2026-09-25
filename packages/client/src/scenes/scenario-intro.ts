/**
 * A one-off scenario's intro (`campaign/scenario-intros.ts`): its artboard read beat by beat — the camera pans and
 * zooms from one crop to the next, then the reader's own caption, SFX and speech bubbles letter the beat — before
 * the deal. The same guided comic reader a campaign issue opens on (`ui/comic-reader.ts`), without a run behind it.
 *
 * Reached from Table setup once the game has started, so leaving (the last beat's "SUIT UP ▸", SKIP, or Escape)
 * goes wherever that screen would have: the deal & mulligan while the game is still in setup, else the Board.
 */
import Phaser from "phaser";
import { introArtFor, ART_CATALOG } from "../art/scenario-art.js";
import type { ComicBeat } from "../campaign/story.js";
import { scenarioIntroFor, type ScenarioIntro } from "../campaign/scenario-intros.js";
import { appSession } from "../session.js";
import { ink, surface, typeRole } from "../tokens.js";
import { campaignFrame } from "../ui/campaign-chrome.js";
import { drawComicLettering, drawComicReaderPicture, type ComicReaderTween } from "../ui/comic-reader.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { McButton, fitText, label } from "../ui/widgets.js";
import {
  comicReaderViewOf,
  nextComicBeat,
  prevComicBeat,
  resolveComicBeats,
  type ResolvedComicBeat,
} from "../view/comic-reader-model.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface ScenarioIntroData {
  readonly scenarioId: string;
}

/** Slower than a campaign page's 450 ms: one picture, so each move is a camera move and should read as one. */
const PAN_MS = 700;

export class ScenarioIntroScene extends Phaser.Scene {
  #intro: ScenarioIntro | null = null;
  #steps: readonly ResolvedComicBeat[] = [];
  #current = 0;
  #panFrom: ComicBeat["panel"] | null = null;
  #panProgress = 1;
  #panTween: Phaser.Tweens.Tween | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.scenarioIntro);
  }

  init(data: ScenarioIntroData): void {
    this.#intro = scenarioIntroFor(data.scenarioId);
    const page = this.#intro?.page;
    this.#steps = page
      ? resolveComicBeats(
          [page],
          page.beats.map((_, beatIndex) => ({ page: page.file, beatIndex })),
        )
      : [];
    this.#current = 0;
    this.#panFrom = null;
    this.#panProgress = 1;
    this.#panTween = null;
    this.#route = null;
  }

  create(): void {
    if (!this.#intro || this.#steps.length === 0) {
      this.#leave();
      return;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    // As a campaign issue's opener does: the comic opens on the villain's theme, which Setup and the Board then keep.
    appSession().music?.playVillainTheme(this.#intro.scenarioId);
    this.scale.on("resize", this.#draw, this);
    const onArrow = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        this.#advance();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.#back();
      }
    };
    this.input.keyboard?.on("keydown", onArrow);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#draw, this);
      this.input.keyboard?.off("keydown", onArrow);
      this.#panTween?.stop();
    });
    // `#draw` only draws a running scene, which this isn't until `create` returns.
    this.events.once(Phaser.Scenes.Events.CREATE, () => this.#draw());
    fadeScreenIn(this);
  }

  /** Where Table setup would have gone: the deal while the game is still in setup, else the Board. */
  #leave(): void {
    this.scale.off("resize", this.#draw, this);
    const phase = appSession().store.state.game?.step.phase;
    goToScreen(this, phase === "setup" ? SCENES.setupDeal : SCENES.board);
  }

  #advance(): void {
    if (this.#current >= this.#steps.length - 1) {
      this.#leave();
      return;
    }
    const from = this.#steps[this.#current]!.beat.panel;
    this.#current = nextComicBeat(this.#current, this.#steps.length);
    this.#pan(from);
  }

  #back(): void {
    if (this.#current === 0) return;
    const from = this.#steps[this.#current]!.beat.panel;
    this.#current = prevComicBeat(this.#current);
    this.#pan(from);
  }

  /** Pans the camera from `from` to the current beat's crop; instant under reduced motion. */
  #pan(from: ComicBeat["panel"]): void {
    this.#panTween?.stop();
    this.#panTween = null;
    if (appSession().settings.reducedMotion) {
      this.#panFrom = null;
      this.#panProgress = 1;
      this.#draw();
      return;
    }
    this.#panFrom = from;
    this.#panProgress = 0;
    const state = { t: 0 };
    this.#panTween = this.tweens.add({
      targets: state,
      t: 1,
      duration: PAN_MS,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        this.#panProgress = state.t;
        this.#draw();
      },
      onComplete: () => {
        this.#panFrom = null;
        this.#panTween = null;
        this.#draw();
      },
    });
    this.#draw();
  }

  #draw(): void {
    if (!this.sys.isActive()) return;
    const intro = this.#intro;
    if (!intro) return;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height, phone } = campaignFrame(this);
    const { game } = appSession().store.state;
    const rosterIds = game?.players.map((player) => game.instances[player.identity.instanceId]?.cardId ?? "") ?? [];
    const view = comicReaderViewOf(this.#steps, this.#current, rosterIds);
    const stops = new Map<string, FocusStop>();

    this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0);

    // Header: the fight's billing and SKIP, on ink like the campaign reader.
    const headerPad = phone ? 16 : 24;
    const skipRect: Rect = { x: width - headerPad - (phone ? 78 : 96), y: 14, width: phone ? 78 : 96, height: 30 };
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "SKIP ▸▸",
        type: typeRole.label,
        rect: skipRect,
        onClick: () => this.#leave(),
      }),
    );
    stops.set("skip", { rect: skipRect, activate: () => this.#leave() });
    label(this, headerPad, 14, "ONE-SHOT", typeRole.label, surface.paper.hex, ink.label);
    const title = this.add
      .text(
        headerPad,
        26,
        intro.title.toUpperCase(),
        textStyle({ ...typeRole.barTitle, size: phone ? 22 : 30 }, surface.paper.hex),
      )
      .setOrigin(0, 0);
    fitText(title, skipRect.x - headerPad - 12, phone ? 22 : 30);
    const headerBottom = Math.max(title.y + title.height, 60) + 12;

    const actionBarHeight = phone ? 68 : 88;
    const dotsHeight = 22;
    const readingRect: Rect = {
      x: 0,
      y: headerBottom,
      width,
      height: Math.max(0, height - actionBarHeight - dotsHeight - headerBottom),
    };
    const panning = this.#panFrom !== null && this.#panProgress < 1;
    const tween: ComicReaderTween | undefined = panning
      ? { fromPanel: this.#panFrom!, progress: this.#panProgress }
      : undefined;
    const { lit } = drawComicReaderPicture(
      this,
      readingRect,
      introArtFor(ART_CATALOG, intro.scenarioId),
      view.step,
      () => this.#draw(),
      tween,
    );
    // The artboard carries no lettering of its own, so the reader letters it — once the camera has settled.
    if (lit && !panning) drawComicLettering(this, readingRect, lit, view.step);

    this.#drawDots(width, height - actionBarHeight - dotsHeight / 2);

    const barY = height - actionBarHeight;
    this.add.rectangle(0, barY, width, actionBarHeight, surface.ink.hex).setOrigin(0, 0);
    const ctaPad = phone ? 12 : 16;
    const ctaHeight = phone ? 52 : 62;
    const ctaY = barY + (actionBarHeight - ctaHeight) / 2;
    const hasBack = !view.isFirst;
    const backWidth = hasBack ? (phone ? 64 : 110) : 0;
    const backGap = hasBack ? 10 : 0;
    const ctaWidth = phone
      ? width - ctaPad * 2 - backWidth - backGap
      : Math.min(425, width - ctaPad * 2 - backWidth - backGap);
    const ctaRect: Rect = { x: width - ctaPad - ctaWidth, y: ctaY, width: ctaWidth, height: ctaHeight };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: view.ctaLabel,
        type: typeRole.barTitle,
        rect: ctaRect,
        onClick: () => this.#advance(),
      }),
    );
    stops.set("next", { rect: ctaRect, activate: () => this.#advance() });
    if (hasBack) {
      const backRect: Rect = { x: ctaPad, y: ctaY, width: backWidth, height: ctaHeight };
      this.#buttons.push(
        new McButton(this, {
          kind: "onInk",
          label: "◂ BACK",
          type: typeRole.label,
          rect: backRect,
          onClick: () => this.#back(),
        }),
      );
      stops.set("back", { rect: backRect, activate: () => this.#back() });
    }

    // Tapping the picture advances too, under the buttons so it never steals their clicks.
    const tapZone = this.add.zone(0, 0, width, barY).setOrigin(0, 0).setInteractive();
    tapZone.on("pointerup", () => this.#advance());
    this.children.sendToBack(tapZone);

    this.#route = this.#route ?? new FocusRoute(this, { onCancel: () => this.#leave() });
    this.#route.set(hasBack ? ["back", "next", "skip"] : ["next", "skip"], stops);
  }

  #drawDots(width: number, y: number): void {
    const total = this.#steps.length;
    if (total <= 1) return;
    const size = 8;
    const gap = 10;
    let x = width / 2 - (total * size + (total - 1) * gap) / 2 + size / 2;
    for (let index = 0; index < total; index += 1) {
      this.add.circle(x, y, size / 2, surface.paper.hex, index === this.#current ? 1 : 0.3);
      x += size + gap;
    }
  }
}
