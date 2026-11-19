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
}

/**
 * Where everything goes on a `width` x `height` screen with `heroCount` heroes. Wide: villain left, heroes right in a
 * column each. Tall: villain on top, heroes below in a row each.
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
  const each = (side.width - VERSUS_GAP * (count - 1)) / count;
  const heroes = Array.from({ length: count }, (_, index): Rect => {
    const x = Math.round(side.x + index * (each + VERSUS_GAP));
    return { x, y: side.y, width: Math.round(side.x + index * (each + VERSUS_GAP) + each) - x, height: side.height };
  });
  const versus = wide
    ? { x: villain.width + VERSUS_GAP / 2, y: Math.round(height / 2) }
    : { x: Math.round(width / 2), y: villain.height + VERSUS_GAP / 2 };
  const versusSize = Math.round(Math.max(44, Math.min(120, Math.min(width, height) * 0.16)));
  return { wide, villain, heroes, versus, versusSize };
}
