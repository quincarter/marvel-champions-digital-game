/**
 * Earned items: cosmetic extras a player earns by playing, and can then turn on or off in Settings ▸ More ▸ Earned
 * items (the owner, 2026-10-20, issue #291).
 *
 * The first one is Hall of Heroes' Drone card art: Ultron's facedown Drone minions draw as a Drone card showing their
 * current ATK rather than a plain player card back (`StandIn`, `art/art-source.ts`). Like the rest of `progression/`,
 * an earned item never changes how a game plays; it only changes a picture.
 *
 * **Earned how.** Each item names the achievement that earns it (`achievements.ts`, read with `isAchievementEarned`),
 * so progress stays derived from the save history. "Unlock everything" opens these too.
 *
 * Pure: no storage, no Phaser.
 */
import type { StandIn } from "../art/art-source.js";
import type { Settings } from "../settings.js";

export type EarnedItemId = "ultron-drone-art";

export interface EarnedItem {
  readonly id: EarnedItemId;
  readonly title: string;
  /** What it does, shown once earned. */
  readonly detail: string;
  /** How to earn it, shown in its place until then. */
  readonly howToEarn: string;
  /** The achievement that earns it (`ACHIEVEMENTS` id). */
  readonly achievementId: string;
  /** The setting that turns it on or off once earned. */
  readonly setting: keyof Pick<Settings, "ultronDroneArt">;
  /** The stand-in picture it shows, when it is one. */
  readonly standIn?: StandIn["kind"];
}

export const EARNED_ITEMS: readonly EarnedItem[] = [
  {
    id: "ultron-drone-art",
    title: "Ultron Drone art",
    detail: "Facedown Drones show a Drone card with their ATK instead of a card back. Art by Hall of Heroes.",
    howToEarn: "Earn the Drone On achievement: win a game against Ultron.",
    achievementId: "ultron-drone",
    setting: "ultronDroneArt",
    standIn: "ultronDrone",
  },
];

/** The items this player has earned: their achievement is, or "Unlock everything" is on. */
export function earnedItemIdsOf(
  isEarned: (achievementId: string) => boolean,
  everything = false,
): ReadonlySet<EarnedItemId> {
  return new Set(EARNED_ITEMS.filter((item) => everything || isEarned(item.achievementId)).map((item) => item.id));
}

/** The stand-in pictures to draw: earned, and switched on. */
export function shownStandInsOf(earned: ReadonlySet<EarnedItemId>, settings: Settings): ReadonlySet<StandIn["kind"]> {
  const kinds = new Set<StandIn["kind"]>();
  for (const item of EARNED_ITEMS) {
    if (item.standIn && earned.has(item.id) && settings[item.setting]) kinds.add(item.standIn);
  }
  return kinds;
}
