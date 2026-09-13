/**
 * Game over, as the design canvases draw it.
 *
 * Two shapes, chosen by the space available rather than by device:
 *  - **Wide** (Screens - Desktop #12): the whole screen in the outcome's colour
 *    — Hero Red for a loss, green for a win ("win swaps the ink to green") —
 *    a large headline beside a "final blow" box, three stat cards, the rounds
 *    where it turned, the table's seats, and the rematch actions.
 *  - **Tall** (Screens - Phone P11 / P17): ink ground, the villain's card up
 *    top, headline, one summary sentence, three number boxes, actions at the thumb.
 *
 * Every word comes from `view/game-over-model.ts`, which derives it from the
 * game's record; this scene only lays it out. The record is complete even for a
 * game resumed after a refresh, because the host rebuilds it from the saved log.
 *
 * Actions the canvases show that don't exist yet (a replay viewer, a full log
 * reader, a deck tuner, exporting) are drawn unavailable with their reason
 * rather than omitted — the design system's "dashed = not yet real" — so the
 * screen matches the design without pretending those work.
 */

import Phaser from "phaser";
import { CORE_DEPS } from "@mc/cards";
import { artFor } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { caseOf, cssOf, textStyle } from "../ui/theme.js";
import { McButton, fitText, label, paintDotGrid } from "../ui/widgets.js";
import { faceOf } from "../view/board-model.js";
import { gameOverModel, type GameOverModel } from "../view/game-over-model.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { rollSeed } from "../view/seed.js";
import type { SessionConfig } from "../engine/host.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** Dots on the outcome ground, darker than the paper grid so they read on red and green. */
const GROUND_DOTS = { spacing: 9, radius: 1, alpha: 0.22 } as const;

export class GameOverScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #busy = false;
  #status: Phaser.GameObjects.Text | null = null;
  /**
   * Keyboard and pad. The route is the buttons in the order `#button` lays them
   * out, which is the action list's own order (`#actions`) then Back to title —
   * the list is the stated order, so nothing here depends on draw-call order.
   */
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();
  #order: string[] = [];

  constructor() {
    super(SCENES.gameOver);
  }

  create(): void {
    this.#busy = false;
    const onResize = (): void => this.#draw();
    // `this.scale` and the art cache outlive this scene; both are released on
    // shutdown, or every visit to this screen would leak a copy of it.
    this.scale.on("resize", onResize, this);
    const artOff = cardArt(this).onArrived(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      artOff();
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#route = new FocusRoute(this);
    this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.children.removeAll(true);
    this.#status = null;
    this.#stops = new Map();
    this.#order = [];

    const { store } = appSession();
    const { game, record, config } = store.state;
    const { width, height } = this.scale.gameSize;
    let ringColor: number | undefined;
    if (!game) {
      this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
      this.#button("primary", "Back to title", { x: (width - 280) / 2, y: height / 2 - 26, width: 280, height: hit.primary }, () =>
        this.scene.start(SCENES.title),
      );
    } else {
      const model = gameOverModel(game, record, config, CORE_DEPS);
      const formFactor = formFactorFor(width, height);
      const tall = formFactor === "phone" || formFactor === "tabletPortrait";
      if (tall) this.#drawTall(model, config, width, height);
      else this.#drawWide(model, config, width, height);
      // The wide loss screen is Hero Red from edge to edge, which would swallow a red ring.
      if (!tall && model.tone === "loss") ringColor = surface.ink.hex;
    }
    // Last, so the ring sits over the button it frames.
    this.#route?.set(this.#order, this.#stops, ringColor);
  }

  /** Screens - Desktop #12. */
  #drawWide(model: GameOverModel, config: SessionConfig | null, width: number, height: number): void {
    const ground = model.tone === "win" ? signal.heal.hex : accent.heroRed.hex;
    this.cameras.main.setBackgroundColor(cssOf(ground));
    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", GROUND_DOTS);

    const pad = Math.round(Math.min(48, width * 0.034));
    const gap = Math.round(Math.min(20, width * 0.014));
    const blowWidth = Math.round(Math.min(280, width * 0.2));
    const sideWidth = Math.round(Math.min(330, width * 0.24));

    // Header: meta line, headline, and the final blow box on the right.
    label(this, pad, pad, model.meta, typeRole.label, surface.paper.hex, 0.85).setFontSize(12);
    const headlineWidth = width - pad * 2 - blowWidth - gap;
    const headlineSize = Math.round(Math.max(44, Math.min(104, width * 0.072)));
    const headline = this.#display(pad, pad + 22, model.headline, headlineSize, surface.paper.hex, headlineWidth);

    let headerBottom = headline.y + headline.height;
    if (model.finalBlow) {
      const box: Rect = { x: width - pad - blowWidth, y: pad, width: blowWidth, height: 0 };
      const frame = this.add.graphics();
      const caption = label(this, box.x + 16, box.y + 16, "Final blow", typeRole.label, surface.paper.hex, ink.meta);
      const title = this.#display(box.x + 16, caption.y + caption.height + 6, model.finalBlow.title, 22, surface.paper.hex, blowWidth - 32);
      const body = this.add
        .text(box.x + 16, title.y + title.height + 8, model.finalBlow.body, textStyle(typeRole.body, surface.paper.hex, 0.85))
        .setWordWrapWidth(blowWidth - 32);
      const boxHeight = body.y + body.height + 16 - box.y;
      frame.fillStyle(surface.ink.hex, 1).fillRect(box.x, box.y, box.width, boxHeight);
      frame.lineStyle(4, surface.paper.hex, 1).strokeRect(box.x, box.y, box.width, boxHeight);
      headerBottom = Math.max(headerBottom, box.y + boxHeight);
    }

    const bodyTop = headerBottom + 26;
    const bodyBottom = height - pad;
    const mainWidth = width - pad * 2 - sideWidth - gap;

    // Three paper stat cards.
    const cardGap = 14;
    const cardWidth = (mainWidth - cardGap * 2) / 3;
    const cardHeight = 96;
    model.stats.forEach((stat, index) => {
      const x = pad + index * (cardWidth + cardGap);
      const g = this.add.graphics();
      g.fillStyle(surface.paper.hex, 1).fillRect(x, bodyTop, cardWidth, cardHeight);
      g.lineStyle(4, surface.ink.hex, 1).strokeRect(x, bodyTop, cardWidth, cardHeight);
      fitText(label(this, x + 16, bodyTop + 14, stat.label, typeRole.label, surface.ink.hex, ink.meta), cardWidth - 32, typeRole.label.size);
      const value = this.#display(x + 16, bodyTop + 32, stat.value, 30, surface.ink.hex);
      fitText(value, cardWidth - 32, 30);
      fitText(
        this.add.text(x + 16, bodyTop + 68, stat.note, textStyle(typeRole.body, surface.ink.hex, 0.75)),
        cardWidth - 32,
        typeRole.body.size,
      );
    });

    // The rounds where it turned.
    const beatsTop = bodyTop + cardHeight + 16;
    this.#beatsPanel({ x: pad, y: beatsTop, width: mainWidth, height: Math.max(120, bodyBottom - beatsTop) }, model);

    // Right column: the table, then the actions.
    const sideX = width - pad - sideWidth;
    const tablePanel = this.add.graphics();
    const tableTitle = this.#display(sideX + 16, bodyTop + 14, "The table", 20, surface.paper.hex);
    let rowY = tableTitle.y + tableTitle.height + 10;
    for (const seat of model.seats) {
      const alpha = seat.defeated ? 0.55 : 1;
      const name = this.add.text(sideX + 16, rowY, seat.name, textStyle(typeRole.emphasis, surface.paper.hex, alpha));
      const detail = this.add
        .text(sideX + sideWidth - 16, rowY, seat.detail, textStyle(typeRole.emphasis, surface.paper.hex, 0.6 * alpha))
        .setOrigin(1, 0);
      fitText(detail, sideWidth - 32 - name.width - 10, typeRole.emphasis.size);
      rowY += Math.max(name.height, detail.height) + 8;
    }
    const tableHeight = rowY + 8 - bodyTop;
    tablePanel.fillStyle(surface.ink.hex, 1).fillRect(sideX, bodyTop, sideWidth, tableHeight);
    tablePanel.lineStyle(4, surface.paper.hex, 1).strokeRect(sideX, bodyTop, sideWidth, tableHeight);

    const actions = this.#actions(config);
    const buttonHeight = hit.primary;
    const backHeight = hit.target;
    let actionY = bodyBottom - backHeight - (buttonHeight + 10) * actions.length;
    actionY = Math.max(actionY, bodyTop + tableHeight + 14);
    for (const action of actions) {
      this.#button(action.primary ? "secondary" : "quiet", action.label, { x: sideX, y: actionY, width: sideWidth, height: buttonHeight }, action.run, action.unavailable);
      actionY += buttonHeight + 10;
    }
    this.#button("quiet", "Back to title", { x: sideX, y: actionY, width: sideWidth, height: backHeight }, () => this.scene.start(SCENES.title));
    this.#status = this.add
      .text(sideX, bodyTop + tableHeight + 4, "", textStyle(typeRole.emphasis, surface.paper.hex))
      .setWordWrapWidth(sideWidth);
  }

  /** Screens - Phone P11 (loss) / P17 (win). */
  #drawTall(model: GameOverModel, config: SessionConfig | null, width: number, height: number): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    const accentHue = model.tone === "win" ? signal.caution.hex : accent.heroRed.hex;
    const pad = 16;

    // The villain's card, whole, in a band across the top.
    const bandHeight = Math.round(Math.min(250, height * 0.3));
    const band = this.add.graphics();
    band.fillStyle(surface.void.hex, 1).fillRect(0, 0, width, bandHeight);
    const { store } = appSession();
    const game = store.state.game!;
    const villain = game.cardPool[game.instances[model.villainInstanceId]?.cardId ?? ""];
    const key = cardArt(this).request(this, artFor(villain, faceOf(game, model.villainInstanceId)));
    drawArt(this, key, { x: pad, y: 10, width: width - pad * 2, height: bandHeight - 20 }, { fit: "contain" });
    band.fillStyle(accentHue, 1).fillRect(0, bandHeight, width, 3);

    paintDotGrid(this, { x: 0, y: bandHeight + 3, width, height: height - bandHeight - 3 }, "ink", dotGrid.onInk);

    let y = bandHeight + 3 + 18;
    const column = width - pad * 2;
    const kicker = label(this, pad, y, model.kicker, typeRole.label, accentHue, 1).setFontSize(10);
    y = kicker.y + kicker.height + 5;
    const headline = this.#display(pad, y, model.headline, Math.round(Math.min(50, width * 0.13)), surface.paper.hex, column);
    y = headline.y + headline.height + 10;
    const summary = this.add.text(pad, y, model.summary, textStyle(typeRole.body, surface.paper.hex, 0.8)).setWordWrapWidth(column);
    y = summary.y + summary.height + 12;

    const boxGap = 7;
    const boxWidth = (column - boxGap * 2) / 3;
    const boxHeight = 58;
    model.quickStats.forEach((stat, index) => {
      const x = pad + index * (boxWidth + boxGap);
      const g = this.add.graphics();
      g.lineStyle(2.5, model.tone === "win" ? signal.caution.hex : surface.paper.hex, 1).strokeRect(x, y, boxWidth, boxHeight);
      label(this, x + 9, y + 8, stat.label, typeRole.label, surface.paper.hex, ink.meta).setFontSize(8);
      this.#display(x + 9, y + 22, stat.value, 24, surface.paper.hex);
    });
    y += boxHeight + 12;

    if (model.mvp) {
      const row = this.add.graphics();
      row.lineStyle(2.5, surface.paper.hex, 1).strokeRect(pad, y, column, 52);
      label(this, pad + 11, y + 10, "Table MVP", typeRole.label, surface.paper.hex, ink.meta);
      this.add.text(pad + 11, y + 26, `${model.mvp.name} · ${model.mvp.detail}`, textStyle(typeRole.emphasis, surface.paper.hex));
      this.add.text(pad + column - 11, y + 26, "★", textStyle(typeRole.stat, signal.caution.hex)).setOrigin(1, 0.3);
      y += 52 + 12;
    }

    // Actions at the thumb: the rematch in red, the rest beneath it.
    const actions = this.#actions(config);
    const [primary, ...rest] = actions;
    const rowCount = Math.ceil((rest.length + 1) / 2);
    let actionY = height - 20 - hit.primary - 8 - rowCount * (hit.target + 7);
    actionY = Math.max(actionY, y);
    this.#status = this.add.text(pad, actionY - 18, "", textStyle(typeRole.emphasis, accent.heroRed.hex)).setWordWrapWidth(column);
    if (primary) {
      this.#button("primary", primary.label, { x: pad, y: actionY, width: column, height: hit.primary }, primary.run, primary.unavailable);
      actionY += hit.primary + 8;
    }
    const quiet = [...rest, { label: "Back to title", primary: false, run: () => this.scene.start(SCENES.title), unavailable: undefined }];
    const halfWidth = (column - 7) / 2;
    quiet.forEach((action, index) => {
      const x = pad + (index % 2) * (halfWidth + 7);
      const rowY = actionY + Math.floor(index / 2) * (hit.target + 7);
      this.#button("secondary", action.label, { x, y: rowY, width: halfWidth, height: hit.target }, action.run, action.unavailable);
    });
  }

  #beatsPanel(rect: Rect, model: GameOverModel): void {
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(4, surface.paper.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);

    const heading = this.#display(rect.x + 20, rect.y + 18, model.beatsHeading, 22, surface.paper.hex);
    g.fillStyle(surface.paper.hex, 0.3).fillRect(heading.x + heading.width + 10, heading.y + heading.height / 2 - 1, rect.x + rect.width - 20 - (heading.x + heading.width + 10), 3);

    let y = heading.y + heading.height + 14;
    const textWidth = rect.width - 40 - 64;
    if (model.beats.length === 0) {
      this.add.text(rect.x + 20, y, "Nothing in the log stood out as a turning point.", textStyle(typeRole.body, surface.paper.hex, 0.7));
    }
    for (const beat of model.beats) {
      if (y > rect.y + rect.height - 50) break;
      this.#display(rect.x + 20, y - 3, `R${beat.round}`, 22, signal.caution.hex);
      const text = this.add
        .text(rect.x + 20 + 64, y, beat.text, textStyle(typeRole.body, surface.paper.hex, 0.85))
        .setFontSize(12)
        .setWordWrapWidth(textWidth);
      y += Math.max(26, text.height) + 12;
    }
    label(this, rect.x + 20, rect.y + rect.height - 26, "Derived from the game log — no hidden information used", typeRole.label, surface.paper.hex, 0.5);
  }

  /**
   * The rematch actions. "Run it back" keeps the scenario and seats with a fresh
   * shuffle; "Same seed" replays the identical deal. The replay viewer is drawn
   * but unavailable until it exists.
   */
  #actions(config: SessionConfig | null): readonly { label: string; primary: boolean; run: () => void; unavailable: string | undefined }[] {
    const missing = config ? undefined : "this game's setup isn't available";
    return [
      { label: "Run it back", primary: true, run: () => config && void this.#rematch({ ...config, seed: rollSeed() }), unavailable: missing },
      { label: "Same seed, same hands", primary: false, run: () => config && void this.#rematch(config), unavailable: missing },
      { label: "Watch the replay", primary: false, run: () => undefined, unavailable: "replays aren't built yet" },
    ];
  }

  async #rematch(config: SessionConfig): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    const { store } = appSession();
    await store.start(config);
    if (store.state.status === "failed") {
      this.#busy = false;
      this.#status?.setText(store.state.error ?? "could not start the rematch");
      return;
    }
    this.scene.start(SCENES.board);
  }

  /** Bangers display text, uppercased the way the type role asks, wrapped when a width is given. */
  #display(x: number, y: number, text: string, size: number, color: number, wrapWidth?: number): Phaser.GameObjects.Text {
    const object = this.add
      .text(x, y, caseOf(typeRole.screenTitle, text), { ...textStyle(typeRole.screenTitle, color), fontSize: `${size}px` })
      .setLetterSpacing(Math.max(1, Math.round(size * 0.03)))
      .setLineSpacing(-Math.round(size * 0.14));
    if (wrapWidth) object.setWordWrapWidth(wrapWidth);
    return object;
  }

  #button(kind: "primary" | "secondary" | "quiet", text: string, rect: Rect, onClick: () => void, unavailable?: string): void {
    const key = `button:${this.#order.length}`;
    this.#order.push(key);
    // Enter on an unavailable action does what a tap on it does: nothing.
    this.#stops.set(key, { rect, activate: () => (unavailable === undefined ? onClick() : undefined) });
    this.#buttons.push(
      new McButton(this, {
        kind,
        label: text,
        type: kind === "primary" ? typeRole.barTitle : typeRole.rowTitle,
        rect,
        onClick,
        enabled: unavailable === undefined,
        ...(unavailable ? { reason: unavailable } : {}),
      }),
    );
  }
}
