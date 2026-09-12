/**
 * The Board's motion: state-change beats floating off a card, and ghosts of
 * cards travelling between zones.
 *
 * Both are held as data with a start time rather than as game objects, because
 * every Board draw clears the display list. Each draw re-creates whatever is
 * still live, already partway through, at its anchor's current position.
 */

import type Phaser from "phaser";
import type { GameEvent, InstanceId, PlayerId, ZoneId } from "@mc/engine";
import { appSession } from "../../session.js";
import { accent, motion, signal, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { beatsFrom, type Beat } from "../../view/beats.js";
import type { BoardLayout, Rect } from "../../view/layout.js";
import { travelsFrom, type Travel } from "../../view/travel.js";

export class BoardMotion {
  readonly #scene: Phaser.Scene;
  /** Beats still floating, with when each started, so a redraw doesn't kill them. */
  #beats: { readonly beat: Beat; readonly startedAt: number }[] = [];
  /**
   * `cardMoved` events from the most recently landed *fresh* state, waiting
   * for the one draw that can turn them into travels — the first draw after
   * they land is the only point that has both this frame's hit rects ("where a
   * card is now") and the frame before it ("where a card was"). Consumed and
   * cleared by `startTravels`.
   */
  #pendingMoves: readonly GameEvent[] = [];
  /** Travels still in flight, with when each started — the same trick as beats, so a redraw mid-flight re-derives the ghost's position instead of losing it. */
  #travels: { readonly travel: Travel; readonly startedAt: number }[] = [];

  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
  }

  /**
   * A fresh state landed. Starts its beats now — reduced motion still gets the
   * beat, it just doesn't travel (`drawBeats`) — and holds its moves for the
   * next draw.
   */
  land(events: readonly GameEvent[]): void {
    this.#beats = beatsFrom(events).map((beat) => ({ beat, startedAt: this.#scene.time.now }));
    this.#pendingMoves = events;
  }

  /**
   * Consumes the pending moves (if this is the first draw since they landed)
   * and turns them into travels, using `previous` for "where a card was" and
   * `current` for "where it is now". A no-op — cheaply, since nothing is
   * pending — on every redraw the command didn't cause (resize, focus
   * movement, a tab switch).
   */
  startTravels(previous: ReadonlyMap<InstanceId, Rect>, current: ReadonlyMap<InstanceId, Rect>, layout: BoardLayout): void {
    if (this.#pendingMoves.length === 0) return;
    const events = this.#pendingMoves;
    this.#pendingMoves = [];

    const perspectiveId = appSession().store.state.perspectiveId;
    if (perspectiveId === null) return;

    const anchorBefore = (instanceId: InstanceId, zone: ZoneId): Rect | null =>
      previous.get(instanceId) ?? pileAnchor(zone, layout, perspectiveId, previous);
    const anchorAfter = (instanceId: InstanceId, zone: ZoneId): Rect | null =>
      current.get(instanceId) ?? pileAnchor(zone, layout, perspectiveId, current);

    const now = this.#scene.time.now;
    this.#travels.push(...travelsFrom(events, anchorBefore, anchorAfter).map((travel) => ({ travel, startedAt: now })));
  }

  /**
   * Floats each live beat off its anchor. A beat whose anchor is off screen —
   * a hidden phone tab, a card that has since left play — is simply not drawn;
   * the tab badge is what reports those.
   */
  drawBeats(hitRects: ReadonlyMap<InstanceId, Rect>): void {
    const scene = this.#scene;
    const now = scene.time.now;
    const reduced = appSession().settings.reducedMotion;
    const lifetime = reduced ? motion.damageMs : motion.damageMs * 2.4;
    this.#beats = this.#beats.filter((entry) => now - entry.startedAt < lifetime);

    this.#beats.forEach(({ beat, startedAt }, index) => {
      const rect = hitRects.get(beat.anchor);
      if (!rect) return;
      const elapsed = now - startedAt;
      const remaining = lifetime - elapsed;

      const text = scene.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2 - elapsed / 14, beat.text, {
          ...textStyle(typeRole.stat, BEAT_COLORS[beat.tone]),
          // A stroke is the only way a number stays readable over card art.
          stroke: cssOf(surface.ink.hex),
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(1000 + index);

      if (reduced) {
        // Held still, then gone: the information without the movement.
        scene.time.delayedCall(remaining, () => text.destroy());
        return;
      }
      scene.tweens.add({
        targets: text,
        y: text.y - 26,
        alpha: { from: 1, to: 0 },
        duration: remaining,
        ease: "Quad.easeOut",
        onComplete: () => text.destroy(),
      });
    });
  }

  /**
   * Draws every live travel as a ghost panel morphing from its "from" rect to
   * its "to" rect, then lets it go. Reduced motion drops the flight entirely —
   * the real card already sits at its destination, drawn moments ago by the
   * rest of the draw — the same "keep the information, drop the movement"
   * rule `drawBeats` follows.
   *
   * Every travel is redrawn from its own elapsed time on every draw, the same
   * trick `drawBeats` uses: the draw's `children.removeAll(true)` destroys last
   * frame's ghost along with everything else, so this recreates it already
   * partway along its path rather than snapping it back to `from`.
   */
  renderTravels(): void {
    const scene = this.#scene;
    const now = scene.time.now;
    this.#travels = this.#travels.filter((entry) => now - entry.startedAt < motion.cardMoveMs);
    if (appSession().settings.reducedMotion) return;

    for (const { travel, startedAt } of this.#travels) {
      const elapsed = now - startedAt;
      const remaining = motion.cardMoveMs - elapsed;
      if (remaining <= 0) continue;
      const progress = elapsed / motion.cardMoveMs;

      const fromCenter = { x: travel.from.x + travel.from.width / 2, y: travel.from.y + travel.from.height / 2 };
      const toCenter = { x: travel.to.x + travel.to.width / 2, y: travel.to.y + travel.to.height / 2 };
      const scaleTo = { x: travel.to.width / travel.from.width, y: travel.to.height / travel.from.height };

      const ghost = scene.add.graphics().setDepth(900);
      ghost.fillStyle(surface.parchment.hex, 0.55).fillRect(-travel.from.width / 2, -travel.from.height / 2, travel.from.width, travel.from.height);
      ghost.lineStyle(3, accent.heroRed.hex, 0.85).strokeRect(-travel.from.width / 2, -travel.from.height / 2, travel.from.width, travel.from.height);
      ghost.setPosition(lerp(fromCenter.x, toCenter.x, progress), lerp(fromCenter.y, toCenter.y, progress));
      ghost.setScale(lerp(1, scaleTo.x, progress), lerp(1, scaleTo.y, progress));

      scene.tweens.add({
        targets: ghost,
        x: toCenter.x,
        y: toCenter.y,
        scaleX: scaleTo.x,
        scaleY: scaleTo.y,
        duration: remaining,
        ease: "Quad.easeOut",
        onComplete: () => ghost.destroy(),
      });
    }
  }
}

/**
 * The coarser rect a whole zone gets when no specific card is drawn there —
 * the encounter deck box, the enemies band, the hand banner a card is about
 * to leave or just arrived from. `attachment`/`boost` resolve to their host's
 * own rect, so an upgrade reads as flying onto the card it attached to.
 *
 * Zones this board draws only as a number, never a box — a player's own deck
 * or discard pile chief among them — resolve to `null`, so a move to or from
 * one of those simply has no travel (see `view/travel.ts`'s file comment).
 */
function pileAnchor(zone: ZoneId, layout: BoardLayout, perspectiveId: PlayerId, rects: ReadonlyMap<InstanceId, Rect>): Rect | null {
  switch (zone.kind) {
    case "encounterDeck":
    case "encounterDiscard":
      return layout.zones.encounter;
    case "villainArea":
      return layout.zones.enemies;
    case "hand":
    case "deck":
    case "discard":
      return zone.playerId === perspectiveId ? layout.zones.hand : layout.zones.team;
    case "playArea":
      return zone.playerId === perspectiveId ? layout.zones.playArea : layout.zones.team;
    case "identity":
      return zone.playerId === perspectiveId ? layout.zones.me : layout.zones.team;
    case "attachment":
    case "boost":
      return rects.get(zone.hostInstanceId) ?? null;
    default:
      return null;
  }
}

/** Each beat speaks in the signal that already means that thing everywhere else. */
const BEAT_COLORS: Record<Beat["tone"], number> = {
  damage: accent.heroRed.hex,
  heal: signal.heal.hex,
  threat: accent.heroRed.hex,
  status: signal.caution.hex,
  defeat: surface.paper.hex,
};

/** Linear interpolation, for a travel ghost recreated partway through its flight. */
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
