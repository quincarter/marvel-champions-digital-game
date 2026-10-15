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
import { getInstance, type InstanceId } from "@mc/engine";
import { cardArt, drawArt } from "../art/card-art.js";
import { POOL_DEPS } from "../content/pool.js";
import { appSession } from "../session.js";
import { surface, typeRole } from "../tokens.js";
import { textStyle } from "./theme.js";
import {
  HOVER_DELAY_MS,
  hoverCandidateAt,
  hoverWorthShowing,
  hoverCardSize,
  hoverPlacement,
  hoverStateLines,
  type Size,
} from "../view/card-hover.js";
import { inspectModel, type InspectModel } from "../view/inspect-model.js";
import type { Rect } from "../view/layout.js";

/** Above every other thing the Board draws (the phase band is 1150). */
const HOVER_DEPTH = 2000;
const STRIP_GAP = 6;
const FADE_MS = 90;

export interface HoverPreviewDeps {
  /** Each card's rect as the scene last drew it, by instance. */
  readonly cards: () => ReadonlyMap<InstanceId, Rect>;
  /**
   * The area the popover may use for this pointer, or null when it must not show at all (`view/card-hover.ts`
   * `hoverArea` for the table, `villainHoverArea` for the villain phase).
   */
  readonly area: (pointer: Phaser.Input.Pointer) => Rect | null;
}

/** True when the pointer is a mouse (or pen): a touch has long-press Inspect instead. */
export const isMousePointer = (pointer: Phaser.Input.Pointer): boolean =>
  !pointer.wasTouch && (pointer.event as PointerEvent | undefined)?.pointerType !== "touch";

export class HoverPreview {
  #pointer: Phaser.Input.Pointer | null = null;
  /** The card the delay is running for. */
  #pendingId: InstanceId | null = null;
  #timer: Phaser.Time.TimerEvent | null = null;
  /** The card the popover is showing. */
  #shownId: InstanceId | null = null;
  #visual: Phaser.GameObjects.Container | null = null;
  #size: Size = { width: 0, height: 0 };
  /** A card pressed or scrolled over stays quiet until the pointer moves to another one. */
  #suppressed: InstanceId | null = null;
  #destroyed = false;

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

  /** The card the pointer is resting on, or null: outside the area, not over a card, or something else drawn on top. */
  #candidate(pointer: Phaser.Input.Pointer, area: Rect): InstanceId | null {
    const { x, y } = pointer;
    if (x < area.x || x > area.x + area.width || y < area.y || y > area.y + area.height) return null;
    const { input } = this.scene;
    const over = input.hitTestPointer(pointer);
    input.sortGameObjects(over, pointer);
    const top = over[0];
    const bounds = top ? (top as Phaser.GameObjects.Zone).getBounds() : null;
    const id = hoverCandidateAt(
      x,
      y,
      this.deps.cards(),
      bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null,
    );
    // A card already drawn large (the hero panel, the villain phase's revealed card) needs no larger copy.
    const rect = id === null ? undefined : this.deps.cards().get(id);
    return rect && hoverWorthShowing(rect) ? id : null;
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

  #show(id: InstanceId): void {
    this.#timer = null;
    const pointer = this.#pointer;
    const area = this.#area();
    if (this.#destroyed || !pointer || !area || pointer.isDown || this.#candidate(pointer, area) !== id) {
      this.#clear();
      return;
    }
    const rect = this.deps.cards().get(id);
    const built = rect ? this.#build(id, rect, area) : null;
    if (!built) {
      this.#clear();
      return;
    }
    this.#pendingId = null;
    this.#shownId = id;
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
  }

  /** The popover for one card: its scan (or a plain frame when the scan is missing) with the state strip under it. */
  #build(
    id: InstanceId,
    onTable: Rect,
    area: Rect,
  ): { readonly container: Phaser.GameObjects.Container; readonly size: Size } | null {
    const state = appSession().store.state;
    const game = state.game;
    if (!game || state.perspectiveId === null) return null;
    const model = inspectModel(game, id, null, state.perspectiveId, POOL_DEPS);
    // A facedown card or pile shows nothing the table doesn't: no popover.
    if (model.hidden) return null;
    const instance = getInstance(game, id);
    const lines = instance
      ? hoverStateLines({
          exhausted: instance.exhausted,
          damageNote: model.damageNote,
          damage: instance.damage,
          threatNote: model.threatNote,
          threat: instance.threat,
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
    if (lines.length > 0) {
      strip = this.scene.add.text(0, 0, lines.join("  ·  "), {
        ...textStyle({ ...typeRole.body, size: 18, weight: 700 }, surface.paper.hex),
        wordWrap: { width: Math.max(1, size.width - 20) },
      });
      stripHeight = strip.height + 14;
      const room: Rect = { ...area, height: Math.max(1, area.height - stripHeight - STRIP_GAP) };
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
      .fillRect(5, 6, size.width, size.height + (strip ? STRIP_GAP + stripHeight : 0));
    container.add(shadow);
    const image = drawArt(this.scene, key, card);
    if (image) container.add(image);
    else container.add(this.#plainFrame(card, model));
    if (strip) {
      const bar = this.scene.add.graphics();
      bar.fillStyle(surface.ink.hex, 1).fillRect(0, size.height + STRIP_GAP, size.width, stripHeight);
      container.add(bar);
      strip.setPosition(10, size.height + STRIP_GAP + 7);
      container.add(strip);
    }
    return { container, size: { width: size.width, height: size.height + (strip ? STRIP_GAP + stripHeight : 0) } };
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

const HOVER_CARDS_KEY = "mc-hover-cards";

/**
 * The card rects a scene's popover reads, kept on the scene itself so a drawing helper several calls deep (the
 * villain phase's rail and recap) can note each card it draws without threading a map through every signature. The
 * scene clears it before each draw (`resetHoverCards`); a scene with no popover has none, and noting is a no-op.
 */
export function noteHoverCard(scene: Phaser.Scene, id: InstanceId, rect: Rect): void {
  (scene.data?.get(HOVER_CARDS_KEY) as Map<InstanceId, Rect> | undefined)?.set(id, rect);
}

/** The scene's hover card map, created empty on first use and emptied on every later call: call it before a draw. */
export function resetHoverCards(scene: Phaser.Scene): Map<InstanceId, Rect> {
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
