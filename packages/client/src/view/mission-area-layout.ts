/**
 * Where the mission area sits on the board, and how its cards share it (docs/phase7-wave8.md §3.33, MC45 p. 5).
 *
 * The area is a foot strip of the enemies zone: the table keeps its zones, and a game with no scenario play area
 * lays out exactly as before (`splitMissionArea` returns the zone whole). It is taken from the zone's bottom, as the
 * set-aside footer is taken from the log's (`view/encounter-pile-layout.ts`), and it never takes so much that the
 * villain band and a minion row lose their floor (`view/enemies-band.ts`): a short zone gives the area its own
 * minimum and the enemies what is left, drawn smaller. Pure geometry; what is in the area is the board model's.
 */

import { CARD_ASPECT, type Rect } from "./layout.js";

/** The area's share of the enemies zone, its floor (a card still readable) and its ceiling. */
const AREA_SHARE = 0.46;
const AREA_MIN_HEIGHT = 150;
const AREA_MAX_HEIGHT = 230;
/** The zone's gap between the enemies and the area. */
const AREA_GAP = 8;
/** A scheme's panel is wider than a card: art column, name and the threat meter beside it. */
const SCHEME_ASPECT = 2.1;
const SLOT_GAP = 8;

export interface MissionSplit {
  /** The enemies zone without the area's strip. */
  readonly enemies: Rect;
  /** The strip for the area, or null when there is no area to draw. */
  readonly area: Rect | null;
}

/** The enemies zone cut into the enemies and the mission area under them. With no area, the zone is returned whole. */
export function splitMissionArea(enemies: Rect, hasArea: boolean): MissionSplit {
  if (!hasArea) return { enemies, area: null };
  const height = Math.round(Math.min(AREA_MAX_HEIGHT, Math.max(AREA_MIN_HEIGHT, enemies.height * AREA_SHARE)));
  // Never the whole zone: the enemies keep at least a card's worth, and the area gives way past that.
  const taken = Math.min(height, Math.max(80, enemies.height - 120));
  return {
    enemies: { ...enemies, height: enemies.height - taken - AREA_GAP },
    area: { x: enemies.x, y: enemies.y + enemies.height - taken, width: enemies.width, height: taken },
  };
}

export type MissionSlotKind = "scheme" | "card";

/** One rect per card of the area, in order, left to right: schemes wider than cards, all one height that fits `inner`. */
export function missionSlots(inner: Rect, kinds: readonly MissionSlotKind[]): readonly Rect[] {
  if (kinds.length === 0) return [];
  const units = kinds.reduce((sum, kind) => sum + (kind === "scheme" ? SCHEME_ASPECT : CARD_ASPECT), 0);
  const room = inner.width - SLOT_GAP * (kinds.length - 1);
  const height = Math.max(0, Math.min(inner.height, room / units));
  let x = inner.x;
  return kinds.map((kind): Rect => {
    const width = height * (kind === "scheme" ? SCHEME_ASPECT : CARD_ASPECT);
    const slot = { x, y: inner.y, width, height };
    x += width + SLOT_GAP;
    return slot;
  });
}
