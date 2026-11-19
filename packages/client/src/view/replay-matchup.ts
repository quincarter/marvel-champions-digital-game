/**
 * The versus screen a shared replay opens on (issue #858, `scenes/replay-versus.ts`): who fought whom, read from the
 * replay's setup, and where each side's picture goes. The villain takes one half of the screen and the heroes the
 * other, split side by side on a wide screen and top and bottom on a tall one, with VERSUS where they meet.
 */
import type { SessionConfig } from "../engine/host.js";
import type { Rect } from "./layout.js";
import type { PastGameNames } from "./past-games-model.js";

export interface MatchupSide {
  /** The card that pictures this side (the villain, or a hero's identity), when known. */
  readonly cardId: string | null;
  readonly name: string;
}

export interface ReplayMatchup {
  readonly scenarioId: string;
  readonly villain: MatchupSide;
  readonly heroes: readonly MatchupSide[];
}

/** The replay's villain and heroes, named from the pool (and from the game's own packs, for a custom hero or villain). */
export function replayMatchupOf(config: SessionConfig, base: PastGameNames): ReplayMatchup {
  const names = config.packs && config.packs.length > 0 && base.forPacks ? base.forPacks(config.packs) : base;
  const heroes = config.players.flatMap((player): MatchupSide[] => {
    const identity =
      "identityCardId" in player ? (player.identityCardId as string) : names.starterIdentity(player.starterDeckId);
    if (!identity) return [];
    return [{ cardId: identity, name: names.identityName(identity) ?? identity }];
  });
  return {
    scenarioId: config.scenarioId,
    villain: {
      cardId: names.scenarioCardId(config.scenarioId) ?? null,
      name: names.scenarioName(config.scenarioId) ?? config.scenarioId,
    },
    heroes,
  };
}

export const VERSUS_GAP = 6;

export interface VersusLayout {
  /** Side by side (wide) or stacked (tall). */
  readonly wide: boolean;
  readonly villain: Rect;
  /** One picture per hero, in seat order. */
  readonly heroes: readonly Rect[];
  /** The middle of the VERSUS mark, on the seam between the two sides. */
  readonly versus: { readonly x: number; readonly y: number };
  /** The VERSUS mark's font size. */
  readonly versusSize: number;
  /** How far the villain's name is lifted off its picture's foot, to stay clear of VERSUS on the seam. */
  readonly villainNameLift: number;
  /** The same for each hero's name: the hero whose foot meets VERSUS (wide, two rows) lifts its name. */
  readonly heroNameLifts: readonly number[];
  /**
   * How far down each hero's picture starts inside its tile: a tile whose top edge meets VERSUS starts its picture
   * below the mark, so the top of the picture (where a hero's head usually is) isn't under it.
   */
  readonly heroArtDrops: readonly number[];
}

/**
 * Where everything goes on a `width` x `height` screen with `heroCount` heroes. Wide: villain left, heroes right. Tall:
 * villain on top, heroes below. One or two heroes sit side by side; three or four in two rows.
 */
export function versusLayout(width: number, height: number, heroCount: number): VersusLayout {
  const wide = width >= height;
  const count = Math.max(1, heroCount);
  const villain: Rect = wide
    ? { x: 0, y: 0, width: Math.floor(width / 2) - VERSUS_GAP / 2, height }
    : { x: 0, y: 0, width, height: Math.floor(height / 2) - VERSUS_GAP / 2 };
  const side: Rect = wide
    ? { x: villain.width + VERSUS_GAP, y: 0, width: width - villain.width - VERSUS_GAP, height }
    : { x: 0, y: villain.height + VERSUS_GAP, width, height: height - villain.height - VERSUS_GAP };
  // One or two heroes share the side in a row; three or four go two to a row, the last row stretched to fill it.
  const cols = count <= 2 ? count : 2;
  const rows = Math.ceil(count / cols);
  const rowHeight = (side.height - VERSUS_GAP * (rows - 1)) / rows;
  const heroes = Array.from({ length: count }, (_, index): Rect => {
    const row = Math.floor(index / cols);
    const inRow = row === rows - 1 ? count - row * cols : cols;
    const col = index - row * cols;
    const each = (side.width - VERSUS_GAP * (inRow - 1)) / inRow;
    const x = Math.round(side.x + col * (each + VERSUS_GAP));
    const y = Math.round(side.y + row * (rowHeight + VERSUS_GAP));
    return {
      x,
      y,
      width: Math.round(side.x + col * (each + VERSUS_GAP) + each) - x,
      height: Math.round(side.y + row * (rowHeight + VERSUS_GAP) + rowHeight) - y,
    };
  });
  const versus = wide
    ? { x: villain.width + VERSUS_GAP / 2, y: Math.round(height / 2) }
    : { x: Math.round(width / 2), y: villain.height + VERSUS_GAP / 2 };
  const versusSize = Math.round(Math.max(44, Math.min(120, Math.min(width, height) * 0.16)));
  const lift = Math.round(versusSize * 0.6);
  const heroNameLifts = heroes.map((_, index) => (wide && rows > 1 && index === 0 ? lift : 0));
  // VERSUS is about four times as wide as it is tall, centered on `versus`.
  const reach = versusSize * 2.2;
  const heroArtDrops = heroes.map((hero) =>
    Math.abs(hero.y - versus.y) < versusSize && hero.x < versus.x + reach && hero.x + hero.width > versus.x - reach
      ? Math.round(versusSize * 0.7)
      : 0,
  );
  return { wide, villain, heroes, versus, versusSize, villainNameLift: wide ? 0 : lift, heroNameLifts, heroArtDrops };
}
