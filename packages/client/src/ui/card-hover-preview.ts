/**
 * The desktop card hover popover: rest a mouse on a card and see it larger beside the pointer, with the state it is
 * in (exhausted, damage, threat, counters, attachments). A scene that shows cards creates one, feeds it after each
 * draw, and destroys it on shutdown: the Board for the table (`scenes/board.ts`), the villain phase for its own cards
 * (`scenes/villain-phase.ts`). Nothing here changes the game.
 *
 * It takes no input: its objects are not interactive, so a click, a drag, a target pick or a hold goes to whatever
 * was under the pointer exactly as before. It listens to the scene's pointer moves instead of putting a listener on
 * every card, and reads where cards are from the scene's own rects for its last draw (`HoverPreviewDeps.cards`). The
 * rules for when it may show, how big it is and where it sits are in `view/card-hover.ts`.
 */

import Phaser from "phaser";
import { cardOf, getInstance, type InstanceId } from "@mc/engine";
import { CARD_BACKS, defaultFaceFor, isStandInArt, type CardFace } from "../art/art-source.js";
import { cardArt, drawArt } from "../art/card-art.js";
import { CARDS_BY_ID, POOL_DEPS } from "../content/pool.js";
import type { FacedownHover } from "../scenes/board/context.js";
import { SCENES } from "../scenes/keys.js";
import { appSession } from "../session.js";
import { surface, typeRole } from "../tokens.js";
import { textStyle } from "./theme.js";
import { McHpPlate, paintThreatMeter } from "./widgets.js";
import { schemePanel } from "../view/board-model.js";
import {
  HOVER_DELAY_MS,
  slotOfHoverKey,
  hoverCandidateAt,
  hoverCardIdAt,
  hoverKeyOfCardId,
  hoverSlotOf,
  clipHoverRect,
  type HoverCardIdRect,
  hoverWorthShowing,
  hoverCardSize,
  villainHoverArea,
  hoverPlacement,
  hoverStateLines,
  type Size,
} from "../view/card-hover.js";
import { cardInspectModel, inspectModel, type InspectModel } from "../view/inspect-model.js";
import { formFactorFor, type Rect } from "../view/layout.js";

/** Above every other thing the Board draws (the phase band is 1150). */
const HOVER_DEPTH = 2000;
const STRIP_GAP = 6;
/** A card back's shape, for a popover whose scan has not arrived. */
const BACK_SHAPE: Rect = { x: 0, y: 0, width: 69, height: 100 };
/** The scheme's threat meter under a scheme's popover: the board's own, a little taller to read at a glance. */
const METER_HEIGHT = 26;
/** The health plate a defend option's picture previews (#298): as tall as the table's own, so its numbers read. */
const HP_PLATE_HEIGHT = 44;
const FADE_MS = 90;

export interface HoverPreviewDeps {
  /** Each game card's rect as the scene last drew it, by instance. Absent on a screen with no game (the deck screens). */
  readonly cards?: () => ReadonlyMap<InstanceId, Rect>;
  /**
   * Each game card as the scene shows it now, one entry per picture (`hoverCardHitsOf`): read instead of `cards` when
   * given, for a screen that shows one card more than once (the recap's "Ultron attacks …" rows) or inside a region
   * that scrolls without a redraw.
   */
  readonly hits?: () => readonly HoverCardHit[];
  /**
   * Plain cards by card id, for a screen with no game behind it (Decks, the deck builder, Rules): the popover is the
   * card's scan with no state strip. Called on every pointer move, so a scrolling list computes its on-screen rects
   * here from its own scroll and clips them to its viewport (`clipHoverRect`) rather than noting them at draw time.
   */
  readonly cardIds?: () => ReadonlyMap<string, HoverCardIdRect>;
  /**
   * Piles of facedown encounter cards dealt to a player (`FacedownHover`): the popover shows the encounter card back
   * with the pile's caption under it, never a card's face. Checked before `cards`, since a pile sits on an identity card.
   */
  readonly facedown?: () => readonly FacedownHover[];
  /**
   * The area the popover may use for this pointer, or null when it must not show at all (`view/card-hover.ts`
   * `hoverArea` for the table, `villainHoverArea` for the villain phase).
   */
  readonly area: (pointer: Phaser.Input.Pointer) => Rect | null;
  /**
   * Skip a card already drawn large (`hoverWorthShowing`). Off unless set: every popover is one size, so a large card
   * on the table (the hero panel) still gets a readable, same-size copy.
   */
  readonly skipLarge?: boolean;
}

/** True when the pointer is a mouse (or pen): a touch has long-press Inspect instead. */
export const isMousePointer = (pointer: Phaser.Input.Pointer): boolean =>
  !pointer.wasTouch && (pointer.event as PointerEvent | undefined)?.pointerType !== "touch";

/**
 * Scenes that run over a screen and take its input. Not "any active scene": a screen opened from the Board or Pause
 * (Rules) has scenes beneath it that are active too, and scene order does not say which is on top (Inspect is
 * registered before Rules but sits over it).
 */
const COVERING_SCENES: readonly string[] = [
  SCENES.inspect,
  SCENES.choice,
  SCENES.pause,
  SCENES.rules,
  SCENES.settings,
  SCENES.unlocks,
  SCENES.saveData,
  SCENES.unlockConfirm,
  SCENES.nameConflict,
  SCENES.heroDecks,
  SCENES.endTurnConfirm,
  SCENES.tutorialResumeConfirm,
  SCENES.holdOn,
  SCENES.extrasViewer,
  SCENES.campaignBeat,
  SCENES.teamUpSplash,
  SCENES.teamUpInfo,
  SCENES.evidence,
  SCENES.pileView,
  SCENES.roundDebrief,
  SCENES.villainPhase,
  SCENES.reportIssue,
];

/**
 * The popover's area for a whole-screen scene (the deck screens, Rules, the Aftermath picker): the whole screen on a
 * desktop with a mouse, and nothing while a covering scene (Inspect, Settings, a confirm) is running over this one.
 * `beneath` names covering scenes that sit under this one (Pause under Rules); `blocked` adds the scene's own modals.
 */
export function screenHoverArea(
  scene: Phaser.Scene,
  pointer: Phaser.Input.Pointer,
  options: { readonly beneath?: readonly string[]; readonly blocked?: () => boolean } = {},
): Rect | null {
  if (options.blocked?.()) return null;
  const { width, height } = scene.scale.gameSize;
  const overlays = COVERING_SCENES.filter(
    (key) => key !== scene.scene.key && !options.beneath?.includes(key) && scene.scene.manager.isActive(key),
  );
  return villainHoverArea({
    formFactor: formFactorFor(width, height),
    mouse: isMousePointer(pointer),
    scale: appSession().settings.cardHoverScale,
    overlays,
    viewport: { x: 0, y: 0, width, height },
  });
}

export class HoverPreview {
  #pointer: Phaser.Input.Pointer | null = null;
  /** The card the delay is running for. */
  #pendingId: string | null = null;
  /** The rect of the picture `#candidate` last found, for the popover's size: one card can be shown in several places. */
  #candidateRect: Rect | null = null;
  /** The health preview noted with that picture (a defend option's), if any. */
  #candidateHp: HoverHpPreview | null = null;
  #timer: Phaser.Time.TimerEvent | null = null;
  /** The card the popover is showing. */
  #shownId: string | null = null;
  #visual: Phaser.GameObjects.Container | null = null;
  #size: Size = { width: 0, height: 0 };
  /** A card pressed or scrolled over stays quiet until the pointer moves to another one. */
  #suppressed: string | null = null;
  #destroyed = false;
  /** The scan the shown popover is waiting for (a plain frame stands in until it arrives), if any. */
  #waitingKey: string | null = null;
  readonly #artOff: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: HoverPreviewDeps,
  ) {
    const { input } = scene;
    input.on(Phaser.Input.Events.POINTER_MOVE, this.#onMove, this);
    input.on(Phaser.Input.Events.POINTER_DOWN, this.#onDown, this);
    input.on(Phaser.Input.Events.GAME_OUT, this.#onOut, this);
    input.on("wheel", this.#onWheel, this);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    // A scan that arrives while its popover shows the plain frame replaces it, rather than waiting for the next draw.
    this.#artOff = cardArt(scene).onArrived(() => {
      const key = this.#waitingKey;
      if (this.#destroyed || key === null || !scene.textures.exists(key)) return;
      this.#waitingKey = null;
      const pointer = this.#pointer;
      this.#clear();
      if (pointer) this.#update(pointer, true);
    });
  }

  /** The key of the card the popover is showing, or null: for the e2e debug hooks. */
  get shownKey(): string | null {
    return this.#visual ? this.#shownId : null;
  }

  /** Called at the end of every Board draw: the draw destroyed the popover with the rest of the scene, so it is rebuilt where the pointer still is. */
  onDraw(): void {
    if (this.#destroyed) return;
    const wasShown = this.#shownId !== null;
    this.#clear();
    const pointer = this.#pointer;
    if (pointer) this.#update(pointer, wasShown);
  }

  /** Removes every listener and the popover itself. The Board calls this on shutdown. */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#artOff();
    this.#clear();
    const { input } = this.scene;
    input.off(Phaser.Input.Events.POINTER_MOVE, this.#onMove, this);
    input.off(Phaser.Input.Events.POINTER_DOWN, this.#onDown, this);
    input.off(Phaser.Input.Events.GAME_OUT, this.#onOut, this);
    input.off("wheel", this.#onWheel, this);
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.#onUpdate, this);
    this.#pointer = null;
  }

  #onMove(pointer: Phaser.Input.Pointer): void {
    this.#pointer = pointer;
    // A button held is a press or a drag in progress (a hand scroll, a card pulled): nothing to preview.
    if (pointer.isDown) {
      this.#clear();
      return;
    }
    this.#update(pointer, false);
  }

  #onDown(pointer: Phaser.Input.Pointer): void {
    this.#pointer = pointer;
    this.#suppressed = this.#shownId ?? this.#pendingId ?? this.#suppressed;
    this.#clear();
  }

  #onWheel(): void {
    this.#suppressed = this.#shownId ?? this.#pendingId ?? this.#suppressed;
    this.#clear();
  }

  #onOut(): void {
    this.#suppressed = null;
    this.#clear();
  }

  /** An overlay opening over a popover that is already up (a choice sheet, Pause) takes it down at once. */
  #onUpdate(): void {
    if (this.#shownId === null && this.#pendingId === null) return;
    if (this.#area() === null) this.#clear();
  }

  #area(): Rect | null {
    const pointer = this.#pointer;
    return pointer ? this.deps.area(pointer) : null;
  }

  /** The popover's key for the card the pointer is resting on, or null: outside the area, not over a card, or something else drawn on top. */
  #candidate(pointer: Phaser.Input.Pointer, area: Rect): string | null {
    const { x, y } = pointer;
    if (x < area.x || x > area.x + area.width || y < area.y || y > area.y + area.height) return null;
    const { input } = this.scene;
    const over = input.hitTestPointer(pointer);
    input.sortGameObjects(over, pointer);
    const top = over[0];
    const bounds = top ? (top as Phaser.GameObjects.Zone).getBounds() : null;
    const topmost = bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null;
    const settings = appSession().settings;
    const piles = this.deps.facedown?.() ?? [];
    if (piles.length > 0) {
      const pile = hoverCandidateAt(x, y, new Map(piles.map((entry) => [entry.key, entry.rect])), topmost);
      if (pile !== null) return pile;
    }
    const found = this.#gameCardAt(x, y, topmost);
    if (found !== null) {
      const { id, rect } = found;
      this.#candidateRect = rect;
      this.#candidateHp = found.hp ?? null;
      // The Hero card popover and Villain card popover settings turn those two kinds off.
      const game = appSession().store.state.game;
      const type = game ? cardOf(game, id)?.type : undefined;
      if (type === "hero_identity" && !settings.hoverHeroCard) return null;
      if (type === "villain" && !settings.hoverVillainCard) return null;
      // Every popover is the same size now, so even the hero panel gets one (the owner, 2026-10-14); skipping a card
      // already drawn large is opt-in.
      return this.deps.skipLarge !== true || hoverWorthShowing(rect) ? id : null;
    }
    const plain = this.deps.cardIds?.();
    if (!plain) return null;
    const slot = hoverCardIdAt(x, y, plain, topmost);
    const cardId = slot === null ? undefined : plain.get(slot)?.cardId;
    if (slot === null || cardId === undefined) return null;
    const type = CARDS_BY_ID.get(cardId)?.type;
    if (type === "hero_identity" && !settings.hoverHeroCard) return null;
    if (type === "villain" && !settings.hoverVillainCard) return null;
    return hoverKeyOfCardId(slot);
  }

  /** The game card under the pointer, with the rect of the very picture it is in. */
  #gameCardAt(x: number, y: number, topmost: Rect | null): HoverCardHit | null {
    if (this.deps.hits) {
      const hits = this.deps.hits();
      const at = hoverCandidateAt(x, y, new Map(hits.map((hit, i) => [i, hit.rect])), topmost);
      return at === null ? null : hits[at]!;
    }
    const cards = this.deps.cards?.() ?? EMPTY_RECTS;
    const id = hoverCandidateAt(x, y, cards, topmost);
    const rect = id === null ? undefined : cards.get(id);
    if (id === null || !rect) return null;
    // A health preview noted with that picture (a scene keyed by card still notes each picture's hit).
    const hp = hoverCardHitsOf(this.scene).find(
      (hit) => hit.id === id && hit.rect.x === rect.x && hit.rect.width === rect.width,
    )?.hp;
    return hp ? { id, rect, hp } : { id, rect };
  }

  #update(pointer: Phaser.Input.Pointer, instant: boolean): void {
    const area = this.#area();
    const id = area ? this.#candidate(pointer, area) : null;
    if (!area || id === null) {
      this.#suppressed = null;
      this.#clear();
      return;
    }
    if (id === this.#suppressed) return;
    this.#suppressed = null;
    if (id === this.#shownId) {
      this.#place(pointer, area);
      return;
    }
    if (id === this.#pendingId) return;
    this.#clear();
    this.#pendingId = id;
    if (instant) this.#show(id);
    else this.#timer = this.scene.time.delayedCall(HOVER_DELAY_MS, () => this.#show(id));
  }

  #show(id: string): void {
    this.#timer = null;
    const pointer = this.#pointer;
    const area = this.#area();
    if (this.#destroyed || !pointer || !area || pointer.isDown || this.#candidate(pointer, area) !== id) {
      this.#clear();
      return;
    }
    const pile = this.deps.facedown?.().find((entry) => entry.key === id);
    if (pile) {
      const built = this.#buildFacedown(pile, area);
      this.#pendingId = null;
      this.#shownId = id;
      this.#waitingKey = built.waitingFor;
      this.#visual = built.container;
      this.#size = built.size;
      this.#place(pointer, area);
      if (appSession().settings.reducedMotion) return;
      built.container.setAlpha(0);
      this.scene.tweens.add({ targets: built.container, alpha: 1, duration: FADE_MS });
      return;
    }
    const slot = slotOfHoverKey(id);
    const plain = slot === null ? undefined : this.deps.cardIds?.().get(slot);
    const rect = slot === null ? this.#candidateRect : plain;
    const built = !rect
      ? null
      : plain
        ? this.#buildPlain(plain.cardId, plain.face, rect, area)
        : this.#build(id as InstanceId, rect, area, this.#candidateHp);
    if (!built) {
      this.#clear();
      return;
    }
    this.#pendingId = null;
    this.#shownId = id;
    this.#waitingKey = built.waitingFor;
    this.#visual = built.container;
    this.#size = built.size;
    this.#place(pointer, area);
    if (appSession().settings.reducedMotion) return;
    built.container.setAlpha(0);
    this.scene.tweens.add({ targets: built.container, alpha: 1, duration: FADE_MS });
  }

  #place(pointer: Phaser.Input.Pointer, area: Rect): void {
    const at = hoverPlacement({ x: pointer.x, y: pointer.y }, this.#size, area);
    this.#visual?.setPosition(at.x, at.y);
  }

  #clear(): void {
    this.#timer?.remove(false);
    this.#timer = null;
    this.#pendingId = null;
    this.#shownId = null;
    // Already gone when a Board draw destroyed the scene's children; destroying twice is a no-op.
    this.#visual?.destroy();
    this.#visual = null;
    this.#waitingKey = null;
  }

  /** The popover for one card: its scan (or a plain frame when the scan is missing) with the state strip under it. */
  #build(
    id: InstanceId,
    onTable: Rect,
    area: Rect,
    hp: HoverHpPreview | null = null,
  ): {
    readonly container: Phaser.GameObjects.Container;
    readonly size: Size;
    readonly waitingFor: string | null;
  } | null {
    const state = appSession().store.state;
    const game = state.game;
    if (!game || state.perspectiveId === null) return null;
    const model = inspectModel(game, id, null, state.perspectiveId, POOL_DEPS);
    // A facedown card or pile shows nothing the table doesn't: no popover. A Drone drawn with its earned Drone art
    // (#291) is the exception: the popover shows that picture, which is all the table sees of it too.
    if (model.hidden && !isStandInArt(model.art)) return null;
    const instance = getInstance(game, id);
    // A scheme's threat is drawn as the board draws it, the red meter with its count (the owner, 2026-10-14), not
    // as words in the strip.
    const card0 = cardOf(game, id);
    const isScheme = card0?.type === "main_scheme" || card0?.type === "side_scheme";
    const scheme = isScheme ? schemePanel(game, id, POOL_DEPS, card0?.type === "main_scheme") : null;
    const lines = instance
      ? hoverStateLines({
          exhausted: instance.exhausted,
          damageNote: hp ? null : model.damageNote,
          damage: hp ? 0 : instance.damage,
          threatNote: scheme ? null : model.threatNote,
          threat: scheme ? 0 : instance.threat,
          counterNote: model.counterNote,
          statuses: instance.statuses,
          attachments: model.attached?.attachments.length ?? 0,
        })
      : [];

    const key = cardArt(this.scene).request(this.scene, model.art);
    const source = key && this.scene.textures.exists(key) ? this.scene.textures.get(key).getSourceImage() : null;
    const aspect = source && source.width > 0 && source.height > 0 ? source.width / source.height : null;
    const scale = appSession().settings.cardHoverScale;

    const container = this.scene.add.container(0, 0).setDepth(HOVER_DEPTH);
    let size = hoverCardSize(onTable, aspect, scale, area);
    let strip: Phaser.GameObjects.Text | null = null;
    let stripHeight = 0;
    const meterHeight = hp ? HP_PLATE_HEIGHT + 14 : scheme ? METER_HEIGHT + 14 : 0;
    if ((scheme || hp) && lines.length === 0) {
      const room: Rect = { ...area, height: Math.max(1, area.height - meterHeight - STRIP_GAP) };
      const fitted = hoverCardSize(onTable, aspect, scale, room);
      if (fitted.width < size.width) size = fitted;
    }
    if (lines.length > 0) {
      strip = this.scene.add.text(0, 0, lines.join("  ·  "), {
        ...textStyle({ ...typeRole.body, size: 18, weight: 700 }, surface.paper.hex),
        wordWrap: { width: Math.max(1, size.width - 20) },
      });
      stripHeight = strip.height + 14;
      const room: Rect = { ...area, height: Math.max(1, area.height - stripHeight - meterHeight - STRIP_GAP) };
      const fitted = hoverCardSize(onTable, aspect, scale, room);
      if (fitted.width < size.width) {
        size = fitted;
        strip.setWordWrapWidth(Math.max(1, size.width - 20));
        stripHeight = strip.height + 14;
      }
    }

    const card: Rect = { x: 0, y: 0, width: size.width, height: size.height };
    const shadow = this.scene.add.graphics();
    shadow
      .fillStyle(surface.ink.hex, 0.35)
      .fillRect(5, 6, size.width, size.height + (strip || meterHeight ? STRIP_GAP + stripHeight + meterHeight : 0));
    container.add(shadow);
    const image = drawArt(this.scene, key, card);
    if (image) container.add(image);
    else container.add(this.#plainFrame(card, model));
    const bandTop = size.height + STRIP_GAP;
    if (strip || meterHeight) {
      const bar = this.scene.add.graphics();
      bar.fillStyle(surface.ink.hex, 1).fillRect(0, bandTop, size.width, stripHeight + meterHeight);
      container.add(bar);
    }
    if (scheme && instance) {
      const meter: Rect = { x: 10, y: bandTop + 7, width: size.width - 20, height: METER_HEIGHT };
      const mg = this.scene.add.graphics();
      const meterText = this.scene.add.text(0, 0, "", textStyle(typeRole.threatCount, surface.ink.hex));
      paintThreatMeter(mg, meterText, meter, scheme, instance.threat);
      meterText.setOrigin(0.5).setPosition(meter.x + meter.width / 2, meter.y + meter.height / 2);
      container.add([mg, meterText]);
    }
    if (hp) {
      // What the attack would leave it, as the villain's own plate previews an attack on it: "2→0" with the loss hatched.
      const plate = new McHpPlate(this.scene, {
        rect: { x: 10, y: bandTop + 7, width: size.width - 20, height: HP_PLATE_HEIGHT },
        current: hp.current,
        max: hp.max,
        after: hp.low,
        afterHigh: hp.high,
      });
      container.add(plate.container);
    }
    if (strip) {
      strip.setPosition(10, bandTop + meterHeight + 7);
      container.add(strip);
    }
    const extra = strip || meterHeight ? STRIP_GAP + stripHeight + meterHeight : 0;
    return {
      container,
      size: { width: size.width, height: size.height + extra },
      waitingFor: image ? null : (model.art?.key ?? null),
    };
  }

  /** The popover for a pile of facedown dealt encounter cards: the encounter card back, and under it what it is and why it is there. */
  #buildFacedown(
    pile: FacedownHover,
    area: Rect,
  ): {
    readonly container: Phaser.GameObjects.Container;
    readonly size: Size;
    readonly waitingFor: string | null;
  } {
    const key = cardArt(this.scene).request(this.scene, CARD_BACKS.encounter);
    const source = key && this.scene.textures.exists(key) ? this.scene.textures.get(key).getSourceImage() : null;
    const aspect = source && source.width > 0 && source.height > 0 ? source.width / source.height : null;
    const scale = appSession().settings.cardHoverScale;
    const container = this.scene.add.container(0, 0).setDepth(HOVER_DEPTH);
    // The pile's rect is a small corner, so the popover is sized as a whole card (`BACK_SHAPE` when the scan is not here yet).
    let size = hoverCardSize(BACK_SHAPE, aspect, scale, area);
    const caption = this.scene.add.text(0, 0, pile.caption, {
      ...textStyle({ ...typeRole.body, size: 18, weight: 700 }, surface.paper.hex),
      wordWrap: { width: Math.max(1, size.width - 20) },
    });
    const room: Rect = { ...area, height: Math.max(1, area.height - caption.height - 14 - STRIP_GAP) };
    const fitted = hoverCardSize(BACK_SHAPE, aspect, scale, room);
    if (fitted.width < size.width) {
      size = fitted;
      caption.setWordWrapWidth(Math.max(1, size.width - 20));
    }
    const stripHeight = caption.height + 14;
    const card: Rect = { x: 0, y: 0, width: size.width, height: size.height };
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(surface.ink.hex, 0.35).fillRect(5, 6, size.width, size.height + STRIP_GAP + stripHeight);
    container.add(shadow);
    const image = drawArt(this.scene, key, card);
    if (image) container.add(image);
    else {
      const plain = this.scene.add.graphics();
      plain.fillStyle(surface.paper.hex, 1).fillRect(0, 0, size.width, size.height);
      plain.lineStyle(4, surface.ink.hex, 1).strokeRect(2, 2, size.width - 4, size.height - 4);
      container.add(plain);
    }
    const bandTop = size.height + STRIP_GAP;
    const bar = this.scene.add.graphics();
    bar.fillStyle(surface.ink.hex, 1).fillRect(0, bandTop, size.width, stripHeight);
    caption.setPosition(10, bandTop + 7);
    container.add([bar, caption]);
    return {
      container,
      size: { width: size.width, height: size.height + STRIP_GAP + stripHeight },
      waitingFor: image ? null : key,
    };
  }

  /** The popover for a plain card on a deck screen: its scan (or the plain frame) and nothing else, there being no state. */
  #buildPlain(
    cardId: string,
    face: CardFace | undefined,
    onScreen: Rect,
    area: Rect,
  ): {
    readonly container: Phaser.GameObjects.Container;
    readonly size: Size;
    readonly waitingFor: string | null;
  } | null {
    const card = CARDS_BY_ID.get(cardId);
    if (!card) return null;
    const model = cardInspectModel(card, face ?? defaultFaceFor(card));
    const key = cardArt(this.scene).request(this.scene, model.art);
    const source = key && this.scene.textures.exists(key) ? this.scene.textures.get(key).getSourceImage() : null;
    const aspect = source && source.width > 0 && source.height > 0 ? source.width / source.height : null;
    const size = hoverCardSize(onScreen, aspect, appSession().settings.cardHoverScale, area);
    const container = this.scene.add.container(0, 0).setDepth(HOVER_DEPTH);
    const rect: Rect = { x: 0, y: 0, width: size.width, height: size.height };
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(surface.ink.hex, 0.35).fillRect(5, 6, size.width, size.height);
    container.add(shadow);
    const image = drawArt(this.scene, key, rect);
    container.add(image ?? this.#plainFrame(rect, model));
    return { container, size, waitingFor: image ? null : (model.art?.key ?? null) };
  }

  /** What stands in for a scan that has not arrived or does not exist: name, type line and rules text on paper. */
  #plainFrame(card: Rect, model: InspectModel): Phaser.GameObjects.Container {
    const frame = this.scene.add.container(0, 0);
    const g = this.scene.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(0, 0, card.width, card.height);
    g.lineStyle(4, surface.ink.hex, 1).strokeRect(2, 2, card.width - 4, card.height - 4);
    frame.add(g);
    const pad = 14;
    const wrap = { width: Math.max(1, card.width - pad * 2) };
    const name = this.scene.add.text(pad, pad, model.name, {
      ...textStyle({ ...typeRole.body, size: 20, weight: 800 }, surface.ink.hex),
      wordWrap: wrap,
    });
    const type = this.scene.add.text(pad, name.y + name.height + 4, model.typeLine, {
      ...textStyle({ ...typeRole.body, size: 13, weight: 700 }, surface.ink.hex, 0.75),
      wordWrap: wrap,
    });
    const rules = this.scene.add.text(pad, type.y + type.height + 10, model.rulesText.slice(0, 700), {
      ...textStyle({ ...typeRole.body, size: 14, weight: 400 }, surface.ink.hex),
      wordWrap: wrap,
    });
    rules.setCrop(0, 0, card.width, Math.max(0, card.height - rules.y - pad));
    frame.add([name, type, rules]);
    return frame;
  }
}

const EMPTY_RECTS: ReadonlyMap<InstanceId, Rect> = new Map();
const HOVER_CARDS_KEY = "mc-hover-cards";
const HOVER_HITS_KEY = "mc-hover-hits";
const HOVER_CARD_IDS_KEY = "mc-hover-card-ids";

/**
 * A plain card (by card id) a deck screen drew at `rect`, for a screen with no game: the plain-card twin of
 * `noteHoverCard`, emptied by the same `resetHoverCards`. Cards inside a scrolling list are not noted at draw time
 * (the list scrolls without a draw); the scene returns them from `HoverPreviewDeps.cardIds` instead.
 */
export function noteHoverCardId(
  scene: Phaser.Scene,
  cardId: string,
  rect: Rect,
  through = false,
  face?: CardFace,
): void {
  (scene.data?.get(HOVER_CARD_IDS_KEY) as Map<string, HoverCardIdRect> | undefined)?.set(
    hoverSlotOf(cardId, `${Math.round(rect.x)},${Math.round(rect.y)}`),
    { ...rect, cardId, ...(through ? { through: true } : {}), ...(face ? { face } : {}) },
  );
}

/** The plain cards noted since the last `resetHoverCards`. */
export function hoverCardIdsOf(scene: Phaser.Scene): ReadonlyMap<string, HoverCardIdRect> {
  return (scene.data.get(HOVER_CARD_IDS_KEY) as Map<string, HoverCardIdRect> | undefined) ?? new Map();
}

/**
 * The card rects a scene's popover reads, kept on the scene itself so a drawing helper several calls deep (the
 * villain phase's rail and recap) can note each card it draws without threading a map through every signature. The
 * scene clears it before each draw (`resetHoverCards`); a scene with no popover has none, and noting is a no-op.
 */
export function noteHoverCard(scene: Phaser.Scene, id: InstanceId, rect: Rect, hp?: HoverHpPreview): void {
  (scene.data?.get(HOVER_CARDS_KEY) as Map<InstanceId, Rect> | undefined)?.set(id, rect);
  (scene.data?.get(HOVER_HITS_KEY) as NotedHit[] | undefined)?.push(hp ? { id, rect, hp } : { id, rect });
}

/**
 * The health a picture's popover previews: the character has `current` of `max` now, and the effect the picture
 * stands for (a defend option) leaves it `low` to `high` (issue #298).
 */
export interface HoverHpPreview {
  readonly current: number;
  readonly max: number;
  readonly low: number;
  readonly high: number;
}

/** One picture of a game card the popover can open over, in screen coordinates as it is now. */
export interface HoverCardHit {
  readonly id: InstanceId;
  readonly rect: Rect;
  readonly hp?: HoverHpPreview;
}

interface NotedHit {
  readonly id: InstanceId;
  readonly rect: Rect;
  readonly hp?: HoverHpPreview;
  /** A scrolling region's content and viewport: the card moves with the content and only its visible part counts. */
  scroll?: { readonly content: Phaser.GameObjects.Container; readonly viewport: Rect };
}

/** How many card pictures have been noted since the last `resetHoverCards`: pass it to `scrollHoverCards` later. */
export function hoverCardMark(scene: Phaser.Scene): number {
  return (scene.data?.get(HOVER_HITS_KEY) as NotedHit[] | undefined)?.length ?? 0;
}

/**
 * The cards noted since `mark` were drawn into a scrolling region's `content` (`McScrollRegion`), which scrolls
 * without a redraw: their rects follow the content's offset and are clipped to `viewport`.
 */
export function scrollHoverCards(
  scene: Phaser.Scene,
  mark: number,
  content: Phaser.GameObjects.Container,
  viewport: Rect,
): void {
  const hits = scene.data?.get(HOVER_HITS_KEY) as NotedHit[] | undefined;
  if (!hits) return;
  for (let i = mark; i < hits.length; i++) hits[i]!.scroll = { content, viewport };
}

/** Every card picture noted since the last `resetHoverCards`, where it is on screen now (`HoverPreviewDeps.hits`). */
export function hoverCardHitsOf(scene: Phaser.Scene): readonly HoverCardHit[] {
  const hits = (scene.data?.get(HOVER_HITS_KEY) as NotedHit[] | undefined) ?? [];
  const out: HoverCardHit[] = [];
  for (const { id, rect, scroll, hp } of hits) {
    if (!scroll) {
      out.push(hp ? { id, rect, hp } : { id, rect });
      continue;
    }
    if (!scroll.content.active) continue;
    const moved = { ...rect, x: rect.x + scroll.content.x, y: rect.y + scroll.content.y };
    const shown = clipHoverRect(moved, scroll.viewport);
    if (shown) out.push(hp ? { id, rect: shown, hp } : { id, rect: shown });
  }
  return out;
}

/** The scene's hover card map, created empty on first use and emptied on every later call: call it before a draw. */
export function resetHoverCards(scene: Phaser.Scene): Map<InstanceId, Rect> {
  scene.data.set(HOVER_HITS_KEY, [] as NotedHit[]);
  const ids = scene.data.get(HOVER_CARD_IDS_KEY) as Map<string, HoverCardIdRect> | undefined;
  if (ids) ids.clear();
  else scene.data.set(HOVER_CARD_IDS_KEY, new Map<string, HoverCardIdRect>());
  const existing = scene.data.get(HOVER_CARDS_KEY) as Map<InstanceId, Rect> | undefined;
  if (existing) {
    existing.clear();
    return existing;
  }
  const created = new Map<InstanceId, Rect>();
  scene.data.set(HOVER_CARDS_KEY, created);
  return created;
}

/** The scene's hover card map as its last draw left it (empty before any draw). */
export function hoverCardsOf(scene: Phaser.Scene): ReadonlyMap<InstanceId, Rect> {
  return (scene.data.get(HOVER_CARDS_KEY) as Map<InstanceId, Rect> | undefined) ?? new Map();
}
