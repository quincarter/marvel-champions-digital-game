/**
 * The Civil War scenario builder (docs/phase7-wave10-client.md section 2): five steps (side, leader, main scheme, modular
 * sets, review and play) over one draft. A thin view: `view/civil-war-builder-model.ts` decides every row, tile, reason and
 * action string, `view/civil-war-builder-layout.ts` every rectangle, and `@mc/cards`' offer (through the model) every
 * refusal. This scene draws them, sends the action string a tap or key names to `applyBuilderAction`, and carries out the
 * navigation effects it returns. It counts nothing and checks no side or stage itself.
 *
 * Start hands the draft to Take your seats (docs 2.10), the way Scenario select's "Choose heroes" does. While the Civil War
 * scenarios are not in the client pool (`content/pool.ts`; task C10) the hand-off is `blocked` and says so on the status
 * line rather than starting a game the seats screen cannot build (`view/civil-war-entry.ts#handoffOf`).
 *
 * Scrolling content (the active step) is drawn at the layout's content-space positions inside an `McScrollRegion`; the
 * header, step rail, review column and sticky foot are fixed. Every control is also a focus stop keyed by its action string.
 */
import Phaser from "phaser";
import { CW_SCENARIOS, type CardId } from "@mc/content";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";
import { dotGrid, ink, surface, typeRole, type TypeSpec } from "../tokens.js";
import { artFor } from "../art/art-source.js";
import { cardFaces } from "../art/card-face-baker.js";
import { ART_CATALOG, villainArtFor } from "../art/scenario-art.js";
import { artThumbSpec } from "./roster-panel.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, fitText, paintDotGrid } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { onTap } from "../ui/tap.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { Rect } from "../view/layout.js";
import {
  applyBuilderAction,
  builderViewOf,
  defaultStatusOf,
  refusalOf,
  type BuilderContext,
  type BuilderView,
  type RandomPins,
  type SetTileView,
  setSheetFor,
} from "../view/civil-war-builder-model.js";
import {
  civilWarBuilderLayout,
  leaderCardParts,
  setSheetLayout,
  setTileParts,
  sideCardParts,
  stageOptionParts,
  summaryParts,
  type BuilderLayout,
  type BuilderStep,
} from "../view/civil-war-builder-layout.js";
import { centeredCard, fanRects, rectsNearViewport, type FaceRef } from "../view/civil-war-builder-art.js";
import { cardsRandomizer } from "../view/civil-war-random.js";
import { handoffOf, lastBuilderOrigin, rememberBuild, type BuilderHandoff } from "../view/civil-war-entry.js";
import { offerOf } from "../view/setup-options.js";
import type { SetupDraft } from "../view/setup-draft.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { InspectData } from "./inspect.js";
import type { SeatsData } from "./seats.js";
import type { ScenarioSelectData } from "./scenario-select.js";

export interface CivilWarBuilderData {
  readonly draft: SetupDraft;
  /** The step to open on: the review for "Customize", the side step for "Build your own". */
  readonly step?: BuilderStep;
}

const NAME: TypeSpec = typeRole.rowTitle;
const DETAIL: TypeSpec = typeRole.body;
const HATCH_SPACING = 10;

interface TextOptions {
  readonly width?: number;
  readonly maxLines?: number;
  readonly color?: number;
  readonly alpha?: number;
}

/** A picture waiting for its baked face: drawn when it is on hand and, in a scrolling region, near what is on screen. */
interface ThumbSlot {
  readonly rect: Rect;
  readonly url: string | null;
  readonly fit: "cover" | "contain";
  readonly focusY: number;
  readonly alpha: number;
  readonly parent: Phaser.GameObjects.Container | null;
  /** Which scroll region the rect lives in (content space); null for a fixed picture. */
  readonly region: "step" | "sheet" | null;
  /** What it shows, for the dev hook: a leader picture, a card face, or a card back. */
  readonly tag: "leader" | "card" | "back";
  done: boolean;
}

/** Faces this far (px) outside the scrolled view still load, so a flick does not scroll into blank tiles. */
const LOAD_MARGIN = 240;
const PICTURE_FOCUS_Y = 0.12;

export class CivilWarBuilderScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #step: BuilderStep = 5;
  #status: string | null = null;
  #otherSideExpanded = false;
  #pins: RandomPins = {};
  #view: BuilderView | null = null;
  #layout: BuilderLayout | null = null;
  #statusShown = "";
  #handoff: BuilderHandoff | null = null;
  #statusText: Phaser.GameObjects.Text | null = null;
  #buttons: McButton[] = [];
  #stops = new Map<string, FocusStop>();
  #region: McScrollRegion | null = null;
  #route: FocusRoute | null = null;
  readonly #scroll = new VariableListScroll();
  /** The open "cards in this set" sheet, by set id; null when closed. */
  #sheet: string | null = null;
  #sheetRegion: McScrollRegion | null = null;
  readonly #sheetScroll = new VariableListScroll();
  #thumbs: ThumbSlot[] = [];
  readonly #leaderUrls = new Map<string, string | null>();

  constructor() {
    super(SCENES.civilWarBuilder);
  }

  init(data: CivilWarBuilderData): void {
    this.#draft = data.draft;
    this.#step = data.step ?? 5;
    this.#status = null;
    this.#otherSideExpanded = false;
    this.#pins = {};
    this.#handoff = null;
    this.#sheet = null;
    this.#sheetScroll.reset();
    this.#leaderUrls.clear();
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    // A face baked off the main thread arrives: fill the pictures waiting for it. Never a rebuild (a rebuild of ~120
    // tiles per arriving face is what a long list of thumbnails cannot afford).
    const offBaked = cardFaces(this).onBaked(() => this.#fillThumbs());
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offBaked();
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this);
      this.scale.off("resize", this.#rebuild, this);
      this.#sheetRegion?.destroy();
      this.#sheetRegion = null;
      this.#region?.destroy();
      this.#region = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#route = new FocusRoute(this, {
      // Inspect opens over this screen and owns Escape and the arrows while it is up.
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => (this.#sheet !== null ? this.#closeSheet() : this.#act("civil:back")),
      // A keyboard or pad user reads a disabled tile's reason by moving onto it.
      onFocusChange: (key) => {
        const reason = key && this.#view ? refusalOf(this.#view, key) : null;
        if (reason !== null) this.#showNotice(reason);
      },
    });
    if (import.meta.env.DEV) this.#publishDebug();
    this.#rebuild();
    fadeScreenIn(this);
  }

  // ---- state ----

  #context(): BuilderContext {
    return {
      cards: CARDS_BY_ID,
      scenarios: CW_SCENARIOS,
      encounterSets: POOL_ENCOUNTER_SETS,
      offer: offerOf(this.#draft),
      step: this.#step,
      otherSideExpanded: this.#otherSideExpanded,
      status: this.#status,
      extraSets: 0,
      pins: this.#pins,
      random: cardsRandomizer,
    };
  }

  /** Sends one action string through the model and carries out what it asks of the scene. */
  #act(action: string): void {
    const ctx = this.#context();
    const refusal = this.#view ? refusalOf(this.#view, action) : null;
    const result = applyBuilderAction(this.#draft, action, ctx);
    this.#draft = result.draft;
    this.#status = result.status ?? refusal;
    const effect = result.effect;
    if (effect?.kind === "step") {
      this.#step = effect.step;
      this.#scroll.reset();
    } else if (effect?.kind === "toggleOtherSide") {
      this.#otherSideExpanded = !this.#otherSideExpanded;
    } else if (effect?.kind === "back") {
      this.#leave();
      return;
    } else if (effect?.kind === "start") {
      if (this.#start()) return;
    } else if (effect?.kind === "pins") {
      this.#pins = effect.pins;
    } else if (effect?.kind === "random" && !result.status) {
      // The roll is an ordinary set of picks: show it on the review, where the player can read it and still edit.
      this.#step = 5;
      this.#scroll.reset();
    }
    this.#rebuild();
  }

  /** True when the scene navigated away. */
  #start(): boolean {
    const view = builderViewOf(this.#draft, this.#context());
    if (!view?.canStart) {
      this.#status = view?.startProblem ?? null;
      return false;
    }
    rememberBuild(this.#draft);
    const handoff = handoffOf(this.#draft, new Set(POOL_SCENARIOS.map((s) => s.id as string)));
    this.#handoff = handoff;
    if (handoff.kind === "blocked") {
      this.#status = handoff.message;
      return false;
    }
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.seats, { draft: handoff.draft, backTo: "civil-war-builder" } satisfies SeatsData);
    return true;
  }

  #leave(): void {
    rememberBuild(this.#draft);
    this.scale.off("resize", this.#rebuild, this);
    if (lastBuilderOrigin() === "title") {
      goToScreen(this, SCENES.title);
      return;
    }
    goToScreen(this, SCENES.scenarioSelect, { draft: this.#draft } satisfies ScenarioSelectData);
  }

  #showNotice(text: string): void {
    this.#status = text;
    this.#statusShown = text;
    this.#statusText?.setText(text);
  }

  // ---- drawing ----

  #rebuild(): void {
    this.#region?.destroy();
    this.#region = null;
    this.#sheetRegion?.destroy();
    this.#sheetRegion = null;
    this.#thumbs = [];
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    destroyChildren(this);

    const view = builderViewOf(this.#draft, this.#context());
    if (!view) {
      this.#leave();
      return;
    }
    const { width, height } = this.scale.gameSize;
    const layout = civilWarBuilderLayout({ width, height, ...view.layout });
    this.#view = view;
    this.#layout = layout;

    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);
    paintDotGrid(
      this,
      { x: 0, y: layout.headerBar.height, width, height: height - layout.headerBar.height },
      "paper",
      dotGrid.onPaper,
    );
    this.#drawHeader(view, layout);
    this.#drawContent(view, layout);
    if (layout.rail) this.#drawRail(view, layout);
    if (layout.stepBar) this.#drawStepBar(view, layout);
    if (layout.review) this.#drawSummaryCard(layout.review, view);
    this.#drawFoot(view, layout);
    let order = view.focusOrder;
    if (this.#sheet !== null) order = this.#drawSheet(view);
    this.#route?.set(order, this.#stops);
    this.#fillThumbs();
  }

  // ---- pictures ----

  /** The scan URL of a card face, or null when the content has none (the slot keeps its parchment frame). */
  #urlOf(face: FaceRef | null): string | null {
    if (!face) return null;
    return artFor(CARDS_BY_ID.get(face.cardId), face.face)?.url ?? null;
  }

  /** The leader picture (art/scenarios/<id>/villain.*), else the leader card stage I scan. */
  #leaderUrl(scenarioId: string, cardId: string): string | null {
    const key = `${scenarioId}|${cardId}`;
    if (!this.#leaderUrls.has(key)) {
      const picture = villainArtFor(ART_CATALOG, scenarioId);
      const card = CARDS_BY_ID.get(cardId);
      this.#leaderUrls.set(
        key,
        picture?.url ??
          (card ? artFor(card, { kind: "villainStage", sideIndex: 0, stageIndex: 0 })?.url : null) ??
          null,
      );
    }
    return this.#leaderUrls.get(key) ?? null;
  }

  #backUrl(): string | null {
    return artFor(undefined, { kind: "back", back: "encounter" })?.url ?? null;
  }

  /**
   * A picture in rect: a parchment frame now, the baked face as soon as it is on hand. region names the scroll
   * region the rect is in, so only what is near the view is asked for.
   */
  #thumb(
    rect: Rect,
    url: string | null,
    parent: Phaser.GameObjects.Container | null,
    region: ThumbSlot["region"],
    o: {
      fit?: "cover" | "contain";
      focusY?: number;
      alpha?: number;
      label?: string | undefined;
      tag?: ThumbSlot["tag"];
    } = {},
  ): void {
    const frame = this.add.graphics();
    frame.fillStyle(surface.parchment.hex, o.alpha ?? 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    frame
      .lineStyle(1.5, surface.ink.hex, ink.label)
      .strokeRect(rect.x + 0.75, rect.y + 0.75, rect.width - 1.5, rect.height - 1.5);
    if (o.label && url === null && rect.width >= 60) {
      const text = this.#text(rect.x + 4, rect.y + rect.height / 2, o.label, typeRole.label, {
        width: rect.width - 8,
        maxLines: 3,
        alpha: ink.secondary,
      });
      text.setOrigin(0, 0.5);
    }
    if (url === null) return;
    this.#thumbs.push({
      rect: { x: rect.x, y: rect.y, width: Math.round(rect.width), height: Math.round(rect.height) },
      url,
      fit: o.fit ?? "contain",
      focusY: o.focusY ?? PICTURE_FOCUS_Y,
      alpha: o.alpha ?? 1,
      parent,
      region,
      tag: o.tag ?? "card",
      done: false,
    });
  }

  /** Draws every waiting picture whose baked face is on hand and whose slot is near what is on screen. */
  #fillThumbs(): void {
    const layout = this.#layout;
    if (!layout) return;
    const faces = cardFaces(this);
    const stepView = { top: layout.content.y + this.#scroll.offsetPx, height: layout.content.height };
    const sheet = this.#sheet !== null ? setSheetLayout(this.scale.gameSize, 0) : null;
    const sheetView = sheet
      ? { top: sheet.body.y + this.#sheetScroll.offsetPx, height: sheet.body.height }
      : { top: 0, height: 0 };
    for (const slot of this.#thumbs) {
      if (slot.done) continue;
      if (slot.region !== null) {
        const view = slot.region === "step" ? stepView : sheetView;
        if (rectsNearViewport([slot.rect], view, LOAD_MARGIN).length === 0) continue;
      }
      const key = faces.request(artThumbSpec(slot.rect, slot.url, slot.focusY, slot.fit));
      if (!key) continue;
      const image = this.add
        .image(slot.rect.x, slot.rect.y, key)
        .setOrigin(0, 0)
        .setDisplaySize(slot.rect.width, slot.rect.height)
        .setAlpha(slot.alpha);
      faces.hold(key, image);
      slot.parent?.add(image);
      slot.done = true;
    }
  }

  #inspect(face: FaceRef | null, choice?: { optionId: string; label: string }, note?: string): void {
    if (!face) return;
    this.scene.launch(SCENES.inspect, {
      card: { cardId: face.cardId as CardId, face: face.face },
      ...(choice ? { choice } : {}),
      ...(note ? { note } : {}),
    } satisfies InspectData);
    this.scene.bringToTop(SCENES.inspect);
  }

  /** Inspect's "Choose this ..." button: the same action string a tap on the choice sends. */
  #onInspectChoose(optionId: string): void {
    if (optionId.startsWith("civil:")) this.#act(optionId);
  }

  /** A plain tap zone (no focus stop), for a picture or strip that reads a card. */
  #zone(rect: Rect, id: string, run: () => void, container: Phaser.GameObjects.Container | null, sheet = false): void {
    if (this.#sheet !== null && !sheet) return;
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    onTap(zone, run, id);
    container?.add(zone);
  }

  #openSheet(setId: string): void {
    this.#sheet = setId;
    this.#sheetScroll.reset();
    this.#rebuild();
  }

  #closeSheet(): void {
    this.#sheet = null;
    this.#rebuild();
  }

  #text(x: number, y: number, text: string, type: TypeSpec, o: TextOptions = {}): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, {
      ...textStyle(type, o.color ?? surface.ink.hex, o.alpha ?? 1),
      ...(o.width ? { wordWrap: { width: o.width } } : {}),
      ...(o.maxLines ? { maxLines: o.maxLines } : {}),
    });
  }

  /** A tap zone plus its focus stop, keyed by the action string. `scrolls`: the rect is in the scroll region's content space. */
  /**
   * zones: the parts of the rect that answer a tap (default all of it). A tall card names its own header and text
   * rows rather than its whole height, so it is tappable as soon as the part the player sees is fully in the region
   * (the scroll region holds controls inert until they are wholly inside it), and its faces keep their own zones.
   */
  #control(
    rect: Rect,
    action: string,
    container: Phaser.GameObjects.Container | null,
    inspect?: () => void,
    zones: readonly Rect[] = [rect],
  ): void {
    // The sheet owns every tap and key while it is open: what is under it is drawn but not a control.
    if (this.#sheet !== null) return;
    for (const area of zones) {
      const zone = this.add
        .zone(area.x, area.y, area.width, area.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      onTap(zone, () => this.#act(action), action);
      container?.add(zone);
    }
    this.#stops.set(
      action,
      container
        ? {
            rect: () => ({ ...rect, y: rect.y - this.#scroll.offsetPx }),
            activate: () => this.#act(action),
            ...(inspect ? { inspect } : {}),
            ensureVisible: () => this.#ensureVisible(rect),
          }
        : { rect, activate: () => this.#act(action), ...(inspect ? { inspect } : {}) },
    );
  }

  #ensureVisible(rect: Rect): void {
    const layout = this.#layout;
    if (!layout || !this.#region) return;
    const top = rect.y - this.#scroll.offsetPx;
    const bottom = top + rect.height;
    const region = layout.content;
    if (top < region.y) this.#region.scrollByPx(top - region.y);
    else if (bottom > region.y + region.height) this.#region.scrollByPx(bottom - (region.y + region.height));
  }

  /** The face of a choice: white card, a thick ink border and a check when chosen, hatching and a padlock when disabled. */
  #card(rect: Rect, state: { selected?: boolean; disabled?: boolean; fill?: number }): void {
    const g = this.add.graphics();
    g.fillStyle(state.disabled ? surface.parchment.hex : (state.fill ?? surface.card.hex), 1).fillRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
    );
    if (state.disabled) {
      g.lineStyle(1, surface.ink.hex, ink.disabled);
      for (let d = HATCH_SPACING; d < rect.width + rect.height; d += HATCH_SPACING) {
        const t0 = Math.max(0, d - rect.width);
        const t1 = Math.min(rect.height, d);
        if (t0 < t1) g.lineBetween(rect.x + d - t0, rect.y + t0, rect.x + d - t1, rect.y + t1);
      }
      const lx = rect.x + rect.width - 22;
      const ly = rect.y + 8;
      g.fillStyle(surface.ink.hex, ink.label).fillRect(lx, ly + 8, 14, 10);
      g.lineStyle(2, surface.ink.hex, ink.label)
        .beginPath()
        .arc(lx + 7, ly + 8, 4.5, Math.PI, 0, false)
        .strokePath();
    }
    if (state.selected) {
      g.lineStyle(4, surface.ink.hex, 1).strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
      this.add
        .text(rect.x + rect.width - 8, rect.y + 6, "✓", textStyle(typeRole.barTitle, surface.ink.hex))
        .setOrigin(1, 0);
    } else {
      g.lineStyle(1.5, surface.ink.hex, state.disabled ? ink.disabled : ink.label).strokeRect(
        rect.x + 0.75,
        rect.y + 0.75,
        rect.width - 1.5,
        rect.height - 1.5,
      );
    }
  }

  /** Runs `draw`, then reparents everything it just added into `container`. */
  #captureInto(container: Phaser.GameObjects.Container, draw: () => void): void {
    const before = this.children.list.length;
    draw();
    const added = this.children.list.slice(before);
    if (added.length > 0) container.add(added);
  }

  #drawHeader(view: BuilderView, layout: BuilderLayout): void {
    const { width } = this.scale.gameSize;
    this.add.rectangle(0, 0, width, layout.headerBar.height, surface.ink.hex).setOrigin(0, 0);
    const back = (): void => this.#act("civil:back");
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "◂ Back",
        type: typeRole.backLabel,
        rect: layout.back,
        onClick: back,
        enabled: this.#sheet === null,
      }),
    );
    this.#stops.set("civil:back", { rect: layout.back, activate: back });

    // "Show me" (a blind scenario's reveal) sits at the header's right edge on every step.
    let right = layout.title.x + layout.title.width;
    if (view.blind) {
      const show: Rect = { x: right - 110, y: layout.back.y, width: 110, height: layout.back.height };
      right = show.x - 8;
      const reveal = (): void => this.#act("civil:blind:show");
      this.#buttons.push(
        new McButton(this, { kind: "onInk", label: "Show me", type: typeRole.rowTitle, rect: show, onClick: reveal }),
      );
      this.#stops.set("civil:blind:show", { rect: show, activate: reveal });
    }
    const textWidth = Math.max(40, right - layout.title.x);
    const title = layout.mode === "phone" ? `Step ${view.step} · ${view.steps[view.step - 1]!.title}` : view.title;
    const titleText = this.#text(layout.title.x, 6, title, typeRole.barTitle, { color: surface.paper.hex });
    fitText(titleText, textWidth, 20);

    // The status line: the notice from the last action, else the one sentence that reads the whole scenario.
    this.#statusShown = view.statusLine ?? defaultStatusOf(view);
    const status = this.#text(layout.title.x, 30, this.#statusShown, DETAIL, {
      color: surface.paper.hex,
      alpha: ink.secondary,
      width: textWidth,
    });
    for (let size = DETAIL.size; size > 9 && status.height > 34; size--) status.setFontSize(size);
    this.#statusText = status;
  }

  #drawRail(view: BuilderView, layout: BuilderLayout): void {
    view.steps.forEach((step, i) => {
      const rect = layout.stepButtons[i]!;
      this.#card(rect, { selected: step.active, fill: step.active ? surface.card.hex : surface.parchment.hex });
      this.#text(rect.x + 10, rect.y + 8, `${step.step}. ${step.title}`, NAME, { width: rect.width - 40 });
      const line = this.#text(rect.x + 10, rect.y + 28, step.line, DETAIL, {
        alpha: ink.secondary,
        width: rect.width - 20,
        maxLines: 2,
      });
      line.setLineSpacing(0);
      if (!step.complete) this.#text(rect.x + rect.width - 14, rect.y + 8, "!", NAME, { alpha: ink.label });
      this.#control(rect, step.action, null);
    });
  }

  #drawStepBar(view: BuilderView, layout: BuilderLayout): void {
    const bar = layout.stepBar!;
    this.add.rectangle(bar.x, bar.y, bar.width, bar.height, surface.parchment.hex).setOrigin(0, 0);
    view.steps.forEach((step, i) => {
      const rect = layout.stepButtons[i]!;
      if (step.active) this.add.rectangle(rect.x, rect.y, rect.width, rect.height, surface.ink.hex).setOrigin(0, 0);
      const mark = step.complete ? `${step.step}` : `${step.step}!`;
      this.add
        .text(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          mark,
          textStyle(typeRole.barTitle, step.active ? surface.paper.hex : surface.ink.hex),
        )
        .setOrigin(0.5);
      this.#control(rect, step.action, null);
    });
    const g = this.add.graphics();
    g.lineStyle(1.5, surface.ink.hex, ink.label).lineBetween(bar.x, bar.y, bar.x + bar.width, bar.y);
  }

  #drawFoot(view: BuilderView, layout: BuilderLayout): void {
    const { width } = this.scale.gameSize;
    const foot = layout.foot;
    this.add.rectangle(0, foot.y, width, foot.height, surface.paper.hex).setOrigin(0, 0);
    this.add.graphics().lineStyle(2, surface.ink.hex, 1).lineBetween(0, foot.y, width, foot.y);
    const button = (
      rect: Rect,
      label: string,
      action: string,
      kind: "primary" | "secondary",
      enabled = true,
      reason?: string,
    ): void => {
      const run = (): void => this.#act(action);
      this.#buttons.push(
        new McButton(this, {
          kind,
          label,
          type: kind === "primary" ? typeRole.barTitle : typeRole.rowTitle,
          rect,
          onClick: run,
          enabled: enabled && this.#sheet === null,
          ...(reason ? { reason } : {}),
        }),
      );
      this.#stops.set(action, { rect, activate: run });
    };
    button(layout.random, "Random", "civil:random", "secondary");
    button(layout.randomBlind, "Random and blind", "civil:random-blind", "secondary");
    button(
      layout.start,
      "Continue to heroes ▸",
      "civil:start",
      "primary",
      view.canStart,
      view.startProblem ?? undefined,
    );
  }

  #drawContent(view: BuilderView, layout: BuilderLayout): void {
    const region = new McScrollRegion(this, {
      rect: layout.content,
      heights: [layout.contentHeight],
      scroll: this.#scroll,
      clipInteractive: true,
      enabled: () => this.#sheet === null,
      onScroll: () => this.#fillThumbs(),
    });
    this.#region = region;
    const container = region.content;
    this.#captureInto(container, () => {
      if (view.step === 1) this.#drawSides(view, layout, container);
      else if (view.step === 2) this.#drawLeaders(view, layout, container);
      else if (view.step === 3) this.#drawStages(view, layout, container);
      else if (view.step === 4) this.#drawSets(view, layout, container);
      else this.#drawReview(view, layout, container);
    });
    region.refresh();
    region.syncInteractivity();
  }

  #drawSides(view: BuilderView, layout: BuilderLayout, container: Phaser.GameObjects.Container): void {
    view.sideChoices.forEach((side, i) => {
      const rect = layout.choiceCards[i]!;
      this.#card(rect, { selected: side.selected });
      const parts = sideCardParts(rect);
      // A distinct shape per side, never colour alone: a square for one, a triangle for the other.
      const g = this.add.graphics();
      const sh = parts.shape;
      g.fillStyle(surface.ink.hex, 1);
      if (i === 0) g.fillRect(sh.x, sh.y, 22, 22);
      else g.fillTriangle(sh.x, sh.y + 22, sh.x + 22, sh.y + 22, sh.x + 11, sh.y);
      this.#text(parts.name.x, parts.name.y, side.name, typeRole.barTitle, { width: parts.name.width });
      side.leaders.forEach((leader, j) => {
        this.#thumb(parts.pictures[j]!, this.#leaderUrl(leader.scenarioId, leader.cardId), container, "step", {
          tag: "leader",
          fit: "cover",
        });
        const caption = parts.captions[j]!;
        const name = this.#text(caption.x, caption.y, leader.name, NAME);
        fitText(name, caption.width, NAME.size);
      });
      this.#control(rect, side.action, container);
    });
  }

  #drawLeaders(view: BuilderView, layout: BuilderLayout, container: Phaser.GameObjects.Container): void {
    view.leaderChoices.forEach((leader, i) => {
      const rect = layout.choiceCards[i]!;
      this.#card(rect, { selected: leader.selected });
      const parts = leaderCardParts(rect);
      this.#thumb(parts.picture, this.#leaderUrl(leader.scenarioId, leader.cardId), container, "step", {
        tag: "leader",
        fit: "cover",
      });
      this.#text(parts.name.x, parts.name.y, leader.name, typeRole.barTitle, { width: parts.name.width });
      this.#text(parts.word.x, parts.word.y, leader.word, typeRole.label, { alpha: ink.label });
      leader.stages.forEach((stage, j) =>
        this.#text(parts.stageLines.x, parts.stageLines.y + j * 16, `Stage ${stage.numeral}: ${stage.hp} HP`, DETAIL, {
          width: parts.stageLines.width,
        }),
      );
      if (view.expertNote)
        this.#text(parts.expertNote.x, parts.expertNote.y, view.expertNote, DETAIL, {
          alpha: ink.secondary,
          width: parts.expertNote.width,
          maxLines: 2,
        });
      const always = this.#text(parts.alwaysIn.x, parts.alwaysIn.y, `Always in: ${leader.ownSet}`, NAME, {
        width: parts.alwaysIn.width,
        maxLines: 1,
      });
      fitText(always, parts.alwaysIn.width, NAME.size);
      const choice = leader.selected ? undefined : { optionId: leader.action, label: "Choose this leader" };
      // The card is the choice; its stage faces (zones added after, so they sit on top) read the leader's own cards.
      this.#control(rect, leader.action, container, () => this.#inspect(leader.stages[0]?.face ?? null, choice), [
        { x: rect.x, y: rect.y, width: rect.width, height: parts.faces[0].y - rect.y - 2 },
        { x: rect.x, y: parts.alwaysIn.y - 4, width: rect.width, height: rect.y + rect.height - parts.alwaysIn.y + 4 },
      ]);
      leader.stages.forEach((stage, j) => {
        const face = parts.faces[j]!;
        const caption = parts.captions[j]!;
        this.#thumb(face, this.#urlOf(stage.face), container, "step", { fit: "contain", label: stage.face?.name });
        const read = this.#text(caption.x, caption.y, `Read stage ${stage.numeral} ▸`, typeRole.label, {
          alpha: ink.secondary,
        });
        fitText(read, caption.width, typeRole.label.size);
        if (stage.face) {
          const zone: Rect = { x: face.x, y: face.y, width: face.width, height: caption.y + caption.height - face.y };
          const faceRef = stage.face;
          this.#zone(zone, `civil:read:${leader.scenarioId}:${j}`, () => this.#inspect(faceRef, choice), container);
        }
      });
    });
  }

  #drawStages(view: BuilderView, layout: BuilderLayout, container: Phaser.GameObjects.Container): void {
    view.stageRows.forEach((row, i) => {
      const geometry = layout.stageRows[i]!;
      this.#text(geometry.label.x, geometry.label.y + 4, row.label, typeRole.label, { alpha: ink.label });
      if (row.hidden) {
        // Blind: a card back and the word, never the face (owner answer 24A).
        const back: Rect = { x: geometry.label.x, y: geometry.label.y + 30, width: 70, height: 98 };
        this.#thumb(back, this.#backUrl(), container, "step", { tag: "back", fit: "contain" });
        this.#text(back.x + back.width + 14, back.y + 8, "Stage 2: hidden", NAME);
        return;
      }
      row.options.forEach((option, j) => {
        const rect = geometry.cards[j]!;
        this.#card(rect, { selected: option.selected });
        const parts = stageOptionParts(rect);
        this.#thumb(parts.face, this.#urlOf(option.face), container, "step", {
          fit: "contain",
          label: option.name,
        });
        this.#text(parts.name.x, parts.name.y, option.name, NAME, { width: parts.name.width, maxLines: 2 });
        const threat = this.#text(
          parts.threat.x,
          parts.threat.y,
          `${option.targetThreat}${option.recommended ? " · Recommended" : ""}`,
          typeRole.label,
          { alpha: ink.secondary },
        );
        fitText(threat, parts.threat.width, typeRole.label.size);
        this.#text(parts.gist.x, parts.gist.y, option.gist, DETAIL, {
          width: parts.gist.width,
          maxLines: 2,
          alpha: ink.secondary,
        });
        const choice = option.selected ? undefined : { optionId: option.action, label: "Choose this stage" };
        const read = (): void => this.#inspect(option.face, choice);
        const strip = parts.read;
        this.add
          .graphics()
          .lineStyle(1, surface.ink.hex, ink.label)
          .lineBetween(strip.x + 8, strip.y, strip.x + strip.width - 8, strip.y);
        this.#text(strip.x + 8, strip.y + strip.height / 2, "Read card ▸", NAME).setOrigin(0, 0.5);
        this.#control(rect, option.action, container, read, [
          { x: rect.x, y: rect.y, width: rect.width, height: parts.face.y + parts.face.height + 4 - rect.y },
          { x: rect.x, y: parts.name.y, width: rect.width, height: parts.read.y - parts.name.y },
        ]);
        if (option.face) this.#zone(strip, `civil:read:${option.action}`, read, container);
      });
    });
    this.#text(layout.stageSummary.x, layout.stageSummary.y + 4, view.stageSummary || "Stage 2 is hidden.", NAME, {
      width: layout.stageSummary.width,
    });
  }

  #drawTile(rect: Rect, tile: SetTileView, container: Phaser.GameObjects.Container): void {
    this.#card(rect, { selected: tile.selected, disabled: !tile.enabled });
    const parts = setTileParts(rect);
    // "Recommended" is its own line above the picture, so a narrow tile never cuts it.
    if (tile.recommended)
      this.#text(parts.recommended.x, parts.recommended.y, "Recommended", typeRole.label, { alpha: ink.secondary });
    // A set that cannot be picked (another product, not unlocked; the other side) shows its cards dimmed, not hidden.
    const alpha = tile.enabled ? 1 : 0.5;
    const rects = fanRects(parts.fan, tile.faces);
    for (let i = tile.faces.length - 1; i >= 0; i--) {
      this.#thumb(rects[i]!, this.#urlOf(tile.faces[i]!), container, "step", { fit: "contain", alpha });
    }
    this.#text(parts.name.x, parts.name.y, tile.name, NAME, { width: parts.name.width, maxLines: 2 });
    const strip = parts.strip;
    // The strip is a button: a tinted band under a rule, so it reads as something to tap.
    this.add
      .graphics()
      .fillStyle(surface.parchment.hex, tile.enabled ? 0.9 : 0.5)
      .fillRect(strip.x + 2, strip.y, strip.width - 4, strip.height - 2)
      .lineStyle(1, surface.ink.hex, ink.label)
      .lineBetween(strip.x + 2, strip.y, strip.x + strip.width - 2, strip.y);
    const detail = [`${tile.cardCount} cards`, tile.descriptor].filter((x): x is string => Boolean(x)).join(" · ");
    const line = this.#text(strip.x + 8, strip.y + strip.height / 2, detail, typeRole.label, {
      alpha: ink.secondary,
    });
    line.setOrigin(0, 0.5);
    fitText(line, strip.width - 16, typeRole.label.size);
    const open = (): void => this.#openSheet(tile.id);
    this.#control(rect, tile.action, container, open);
    this.#zone(strip, `civil:cards:${tile.id}`, open, container);
  }

  #drawSets(view: BuilderView, layout: BuilderLayout, container: Phaser.GameObjects.Container): void {
    const counter = view.modular.hidden
      ? `${view.modular.chosen} modular sets chosen, hidden.`
      : `${view.modular.counterLine}${view.modular.hint ? ` ${view.modular.hint}.` : ""}`;
    this.#text(layout.modularCounter.x, layout.modularCounter.y + 4, counter, NAME, {
      width: layout.modularCounter.width,
    });
    for (const section of layout.modularSections) {
      const data = view.modular.sections.find((s) => s.key === section.key);
      if (!data) continue;
      if (section.key === "otherSide") {
        const rect = section.label;
        this.#card(rect, { fill: surface.parchment.hex });
        const text = data.expanded
          ? `▾ ${data.label}: not used with this leader`
          : `▸ ${data.collapsedLine ?? data.label}`;
        const line = this.#text(rect.x + 10, rect.y + rect.height / 2, text, NAME, { width: rect.width - 20 });
        line.setOrigin(0, 0.5);
        this.#control(rect, "civil:other-side", container);
      } else {
        this.#text(section.label.x, section.label.y + 4, data.label, typeRole.label, { alpha: ink.label });
      }
      data.tiles.forEach((tile, i) => {
        const rect = section.tiles[i];
        if (rect) this.#drawTile(rect, tile, container);
      });
    }
  }

  /**
   * The summary: the leader picture with the first facts beside it, the two main scheme stage faces, the chosen sets
   * as thumbnails, then the rest of the facts. A hidden item (Random and blind) is a card back, never its face.
   */
  #drawSummary(
    rect: Rect,
    view: BuilderView,
    container: Phaser.GameObjects.Container | null,
    region: ThumbSlot["region"],
  ): void {
    const parts = summaryParts(rect);
    const art = view.summaryArt;
    this.#thumb(parts.picture, this.#leaderUrl(art.leader.scenarioId, art.leader.cardId), container, region, {
      tag: "leader",
      fit: "cover",
    });
    let y = parts.beside.y;
    view.summary.slice(0, 3).forEach((line, i) => {
      const t = this.#text(parts.beside.x, y, line, DETAIL, {
        alpha: i === 0 ? 1 : ink.secondary,
        width: parts.beside.width,
      });
      y += t.height + 3;
    });

    art.stages.forEach((stage, i) => {
      const face = parts.stageFaces[i]!;
      const caption = parts.stageCaptions[i]!;
      if (stage.hidden) {
        // A card back (portrait), never the face; the caption under it says "Hidden".
        this.#thumb(centeredCard(face, false), this.#backUrl(), container, region, { tag: "back", fit: "contain" });
      } else {
        this.#thumb(face, this.#urlOf(stage.face), container, region, { fit: "contain", label: stage.name });
        if (stage.face) {
          const ref = stage.face;
          this.#zone(face, `civil:summary-stage:${i}`, () => this.#inspect(ref), container);
        }
      }
      const name = this.#text(caption.x, caption.y, stage.name, typeRole.label, { alpha: ink.secondary });
      fitText(name, caption.width, typeRole.label.size);
    });

    if (art.setsHidden) {
      const backs = parts.setThumbs(art.setCount);
      backs.forEach((slot) =>
        this.#thumb(centeredCard(slot, false), this.#backUrl(), container, region, { tag: "back", fit: "contain" }),
      );
    } else {
      const slots = parts.setThumbs(art.sets.length);
      art.sets.forEach((set, i) => {
        const face = set.faces[0];
        const slot = slots[i]!;
        this.#thumb(centeredCard(slot, face?.landscape ?? false), this.#urlOf(face ?? null), container, region, {
          fit: "contain",
        });
      });
    }

    let fy = parts.facts.y;
    for (const line of view.summary.slice(3)) {
      const t = this.#text(parts.facts.x, fy, line, DETAIL, { alpha: ink.secondary, width: parts.facts.width });
      fy += t.height + 3;
    }
    if (view.expertNote) {
      this.#text(parts.facts.x, fy, view.expertNote, DETAIL, { width: parts.facts.width, alpha: ink.secondary });
    }
  }

  #drawSummaryCard(rect: Rect, view: BuilderView): void {
    this.#card(rect, {});
    this.#drawSummary(rect, view, null, null);
  }

  /** The "cards in this set" sheet over the dimmed screen; returns its own focus order. */
  #drawSheet(view: BuilderView): readonly string[] {
    const setId = this.#sheet!;
    const sheet = setSheetFor(this.#context(), setId);
    const { width, height } = this.scale.gameSize;
    const L = setSheetLayout({ width, height }, sheet.cards.length);

    this.add.rectangle(0, 0, width, height, surface.ink.hex, 0.62).setOrigin(0, 0);
    this.#zone({ x: 0, y: 0, width, height }, "civil:sheet:scrim", () => this.#closeSheet(), null, true);
    this.#card(L.panel, {});
    this.#zone(L.panel, "civil:sheet:panel", () => undefined, null, true);

    const title = this.#text(L.header.x + 16, L.header.y + 8, sheet.name, typeRole.barTitle);
    fitText(title, L.close.x - L.header.x - 32, 22);
    const different = sheet.cards.length;
    this.#text(
      L.header.x + 16,
      L.header.y + 36,
      `${sheet.totalCards} cards, ${different} different. Tap a card to read it.`,
      DETAIL,
      { alpha: ink.secondary, width: L.close.x - L.header.x - 32 },
    );
    const close = (): void => this.#closeSheet();
    this.#buttons.push(
      new McButton(this, { kind: "secondary", label: "Close", type: typeRole.rowTitle, rect: L.close, onClick: close }),
    );
    this.#stops.set("civil:sheet:close", { rect: L.close, activate: close });

    const region = new McScrollRegion(this, {
      rect: L.body,
      heights: [L.contentHeight],
      scroll: this.#sheetScroll,
      clipInteractive: true,
      onScroll: () => this.#fillThumbs(),
    });
    this.#sheetRegion = region;
    const order: string[] = [];
    this.#captureInto(region.content, () => {
      sheet.cards.forEach((card, i) => {
        const cell = L.cells[i]!;
        const image: Rect = { x: cell.x, y: cell.y, width: cell.width, height: L.imageHeight };
        this.#thumb(image, this.#urlOf(card.face), region.content, "sheet", { fit: "contain", label: card.face.name });
        const name = this.#text(cell.x, cell.y + L.imageHeight + 4, card.face.name, typeRole.label, {
          width: cell.width,
          maxLines: 2,
        });
        name.setLineSpacing(0);
        const read = (): void => this.#inspect(card.face);
        this.#zone(cell, `civil:sheet:read:${i}`, read, region.content, true);
        const key = `civil:sheet:card:${i}`;
        order.push(key);
        this.#stops.set(key, {
          rect: () => ({ ...cell, y: cell.y - this.#sheetScroll.offsetPx }),
          activate: read,
          inspect: read,
          ensureVisible: () => {
            const top = cell.y - this.#sheetScroll.offsetPx;
            const bottom = top + cell.height;
            if (top < L.body.y) region.scrollByPx(top - L.body.y);
            else if (bottom > L.body.y + L.body.height) region.scrollByPx(bottom - (L.body.y + L.body.height));
          },
        });
        // The copy count is a printed fact of the set: "x2" next to the type word.
        const copies = card.copies > 1 ? `x${card.copies} · ` : "";
        this.#text(cell.x, cell.y + L.imageHeight + 32, `${copies}${card.typeWord}`, typeRole.label, {
          alpha: ink.label,
          width: cell.width,
          maxLines: 1,
        });
      });
    });
    region.refresh();
    region.syncInteractivity();

    this.add
      .graphics()
      .lineStyle(2, surface.ink.hex, 1)
      .lineBetween(L.footer.x, L.footer.y, L.footer.x + L.footer.width, L.footer.y);
    const tile = view.modular.sections.flatMap((s) => s.tiles).find((t) => t.id === setId);
    const picked = tile?.selected ?? false;
    const run = (): void => this.#act(`civil:set:${setId}`);
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: picked ? "Remove this set" : "Add this set",
        type: typeRole.barTitle,
        rect: L.action,
        onClick: run,
        enabled: tile?.enabled ?? false,
        ...(tile && !tile.enabled && tile.disabledReason ? { reason: tile.disabledReason } : {}),
      }),
    );
    this.#stops.set("civil:sheet:action", { rect: L.action, activate: run });
    return [...order, "civil:sheet:action", "civil:sheet:close"];
  }

  #drawReview(view: BuilderView, layout: BuilderLayout, container: Phaser.GameObjects.Container): void {
    // Desktop has the summary in its review column; phone and tablet carry it here.
    if (layout.summaryInStep) {
      this.#card(layout.reviewBody, {});
      this.#drawSummary(layout.reviewBody, view, container, "step");
    }
    const pre = layout.preconstructed;
    this.#card(pre, { disabled: !view.preconstructedEnabled });
    const label = this.#text(pre.x + pre.width / 2, pre.y + pre.height / 2, "Preconstructed", NAME);
    label.setOrigin(0.5);
    this.#control(pre, "civil:preconstructed", container);

    view.difficultyChoices.forEach((choice, i) => {
      const rect = layout.difficulty[i]!;
      this.#card(rect, { selected: choice.selected });
      const name = this.#text(rect.x + 10, rect.y + 6, choice.name, NAME, { width: rect.width - 44 });
      fitText(name, rect.width - 44, NAME.size);
      this.#text(rect.x + 10, rect.y + 28, choice.description, typeRole.label, {
        width: rect.width - 20,
        maxLines: 3,
        alpha: ink.secondary,
      });
      this.#control(rect, choice.action, container);
    });

    view.randomPins.forEach((pin, i) => {
      const rect = layout.randomPins[i]!;
      this.#card(rect, { selected: pin.on });
      const text = this.#text(rect.x + 8, rect.y + rect.height / 2, pin.label, typeRole.label, {
        width: rect.width - 16,
      });
      text.setOrigin(0, 0.5);
      fitText(text, rect.width - 16, typeRole.label.size);
      this.#control(rect, pin.action, container);
    });

    view.modeOptions.forEach((mode, i) => {
      const rect = layout.gameMode[i]!;
      this.#card(rect, { selected: mode.selected, disabled: !mode.enabled });
      const text = this.#text(rect.x + 10, rect.y + rect.height / 2, `${mode.label} · ${mode.note}`, NAME, {
        width: rect.width - 50,
      });
      text.setOrigin(0, 0.5);
      fitText(text, rect.width - 50, NAME.size);
      this.#control(rect, `civil:mode:${mode.id}`, container);
    });
  }

  // ---- dev hook ----

  /** Dev e2e hook (never referenced by product code): the view, the layout, the draft, and `act` to send an action string. */
  #publishDebug(): void {
    (window as unknown as { __mcBuilderDebug?: unknown }).__mcBuilderDebug = {
      view: () => this.#view,
      layout: () => this.#layout,
      draft: () => this.#draft,
      act: (action: string) => this.#act(action),
      status: () => this.#statusShown,
      thumbs: () => {
        const count = (tag: ThumbSlot["tag"], done: boolean): number =>
          this.#thumbs.filter((t) => t.tag === tag && t.done === done).length;
        return {
          leader: { drawn: count("leader", true), waiting: count("leader", false) },
          card: { drawn: count("card", true), waiting: count("card", false) },
          back: { drawn: count("back", true), waiting: count("back", false) },
          sheet: this.#sheet,
        };
      },
      focused: () => this.#route?.focused ?? null,
      handoff: () => this.#handoff,
      stops: () =>
        [...this.#stops].map(([key, stop]) => ({
          key,
          ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
        })),
    };
  }
}
