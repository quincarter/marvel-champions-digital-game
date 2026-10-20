/**
 * The facedown encounter cards dealt to a player and not yet revealed (`PlayerState.dealtEncounter`, issue #287): one
 * small pile of card backs tucked against the player's identity card, with a "×N" chip when there are several. Nothing
 * here reads a card: the pile is a count, and the words it wears say why the cards are there.
 *
 * The geometry is a pure function of the identity's rect, so the scene draws the pile from it and the deal flight lands
 * on the same rect (`scenes/board/motion.ts`) even on a frame where the pile itself is not drawn (a card dealt and
 * revealed in one command).
 */

import type { GameEvent, GameState, InstanceId } from "@mc/engine";
import type { CardHistoryLog } from "./card-history.js";
import { CARD_ASPECT, PANEL_TEXT_INSETS, PANEL_TEXT_MIN_WIDTH, type Rect } from "./layout.js";
import { cardName } from "./names.js";

/** Where the identity card is drawn: the wide panel (art column beside the text), the villain-band compact row, or a team row. */
export type DealtPileKind = "wide" | "compact" | "seat";

/** The wide identity panel's art column: as tall as the panel allows, leaving the text column its minimum width. */
export function wideArtColumn(rect: Rect): Rect | null {
  const width = Math.max(
    0,
    Math.round(Math.min(rect.width - PANEL_TEXT_MIN_WIDTH - PANEL_TEXT_INSETS, (rect.height - 6) * CARD_ASPECT)),
  );
  if (width <= 0) return null;
  return {
    x: rect.x + 3,
    y: rect.y + 3,
    width,
    height: Math.min(rect.height - 6, Math.round(width / CARD_ASPECT)),
  };
}

/** The compact identity row's thumbnail. */
export function compactThumb(rect: Rect): Rect {
  return {
    x: rect.x + 6,
    y: rect.y + 5,
    width: Math.round((rect.height - 10) * CARD_ASPECT),
    height: rect.height - 10,
  };
}

export interface DealtPileParts {
  /** The whole pile, rear card and chip included: the hover and the flight target. */
  readonly rect: Rect;
  /** The front card back. */
  readonly front: Rect;
  /** A second back peeking out behind the front one, drawn only when there are several cards. */
  readonly rear: Rect;
  /** The "×N" chip's rect (drawn only when there are several cards). */
  readonly chip: Rect;
}

const CHIP_WIDTH = 26;
const CHIP_HEIGHT = 14;
const REAR_OFFSET = 4;

/** The pile tucked into the right edge of an identity's art, just under its printed title band (which stays readable). */
function onArt(art: Rect): DealtPileParts {
  const width = Math.max(22, Math.min(46, Math.round(art.width * 0.34)));
  const height = Math.round(width / CARD_ASPECT);
  const front: Rect = {
    x: art.x + art.width - width - 4,
    y: art.y + Math.max(4, Math.round(art.height * 0.13)),
    width,
    height,
  };
  const rear: Rect = { x: front.x - REAR_OFFSET, y: front.y + REAR_OFFSET, width, height };
  const chip: Rect = {
    x: front.x + width - CHIP_WIDTH,
    y: rear.y + height - CHIP_HEIGHT / 2,
    width: CHIP_WIDTH,
    height: CHIP_HEIGHT,
  };
  const bottom = chip.y + chip.height;
  return {
    front,
    rear,
    chip,
    rect: { x: rear.x, y: front.y, width: width + REAR_OFFSET, height: bottom - front.y },
  };
}

/** Rows narrower than this have no room beside the name for a pile. */
const SEAT_MIN_WIDTH = 150;
/** The width a row keeps free at its right for the first player token. */
const SEAT_TOKEN_RESERVE = 40;
const SEAT_PILE_WIDTH = 40;

/**
 * The pile for a team row: a small back and its "×N" on the name line, left of the first player token. Null for a
 * one-line row or a narrow one, which says it in words instead (`dealtWords`).
 */
function onSeat(row: Rect, oneLine: boolean): DealtPileParts | null {
  if (oneLine || row.width < SEAT_MIN_WIDTH) return null;
  const height = Math.max(14, Math.min(20, row.height - 8));
  const width = Math.round(height * CARD_ASPECT);
  const left = row.x + row.width - 6 - SEAT_TOKEN_RESERVE - SEAT_PILE_WIDTH;
  const top = row.y + 4;
  const front: Rect = { x: left + REAR_OFFSET, y: top, width, height };
  const rear: Rect = { x: left, y: top + 2, width, height: height - 2 };
  const chip: Rect = {
    x: front.x + width + 4,
    y: top + (height - CHIP_HEIGHT) / 2,
    width: CHIP_WIDTH - 4,
    height: CHIP_HEIGHT,
  };
  return { front, rear, chip, rect: { x: left, y: top, width: SEAT_PILE_WIDTH, height } };
}

/**
 * The pile's parts on an identity drawn at `anchor`, or null when that anchor has no room for one. `oneLine` is a team
 * row too short for a second line.
 */
export function dealtPileParts(anchor: Rect, kind: DealtPileKind, oneLine = false): DealtPileParts | null {
  switch (kind) {
    case "wide": {
      const art = wideArtColumn(anchor);
      return art ? onArt(art) : null;
    }
    case "compact":
      return onArt(compactThumb(anchor));
    case "seat":
      return onSeat(anchor, oneLine);
  }
}

/** "×3" for several cards, null for one (a single back needs no count). */
export function dealtChipText(count: number): string | null {
  return count > 1 ? `×${count}` : null;
}

/** The words a row too small for a pile wears in its stead: "FACEDOWN ×2". */
export function dealtWords(count: number): string {
  return `FACEDOWN ×${count}`;
}

/** What `EncounterDealSource` reads as in the caption; an ability is named by the card when the log can say which. */
export function dealtReasonWords(
  source: Extract<GameEvent, { type: "encounterCardDealt" }>["source"],
  abilityCard: string | null,
): string {
  switch (source) {
    case "villainPhase":
      return "villain phase deal";
    case "hazard":
      return "Hazard";
    case "deckReset":
      return "your deck ran out";
    case "surge":
      return "Surge";
    case "uniqueRule":
      return "unique rule";
    case "ability":
      return abilityCard ?? "a card effect";
  }
}

/**
 * Why each of `ids` was dealt, in the order it happened, from the session's event history (`CardHistoryLog`): one phrase
 * per distinct reason. Empty for a resumed game, whose history starts empty. Never names a dealt card, only what dealt it.
 */
export function dealtReasonsOf(log: CardHistoryLog, ids: readonly InstanceId[], state: GameState): readonly string[] {
  const wanted = new Set<InstanceId>(ids);
  const reasons: string[] = [];
  for (const entry of log.entries) {
    for (const event of entry.events) {
      if (event.type !== "encounterCardDealt" || !wanted.has(event.instanceId)) continue;
      let abilityCard: string | null = null;
      if (event.source === "ability") {
        const by = entry.events.find(
          (sibling) =>
            (sibling.type === "abilityResolved" || sibling.type === "cardPlayed") &&
            sibling.instanceId !== event.instanceId,
        );
        if (by && (by.type === "abilityResolved" || by.type === "cardPlayed"))
          abilityCard = cardName(state, by.instanceId);
      }
      const text = dealtReasonWords(event.source, abilityCard);
      if (!reasons.includes(text)) reasons.push(text);
    }
  }
  return reasons;
}

/** The hover caption: "Facedown encounter card · Hazard · revealed in the villain phase". */
export function dealtCaption(count: number, reasons: readonly string[]): string {
  const subject = count > 1 ? `${count} facedown encounter cards` : "Facedown encounter card";
  return [subject, ...reasons, "revealed in the villain phase"].join(" · ");
}
