/**
 * Earned items: cosmetic extras a player earns by playing, and can then turn on or off in Settings ▸ More ▸ Earned
 * items (the owner, 2026-10-20, issue #291).
 *
 * The first one is Hall of Heroes' Drone card art: Ultron's facedown Drone minions draw as a Drone card showing their
 * current ATK rather than a plain player card back (`StandIn`, `art/art-source.ts`). Like the rest of `progression/`,
 * an earned item never changes how a game plays; it only changes a picture.
 *
 * **Earned how.** Each item names the achievement that earns it (`achievements.ts`, read with `isAchievementEarned`),
 * so progress stays derived from the save history. "Unlock everything" opens these too. Promo card art has no one
 * achievement: it opens with the first promo card earned in Extras (`art/promo-art.ts`).
 *
 * Pure: no storage, no Phaser.
 */
import type { StandIn } from "../art/art-source.js";
import type { Settings } from "../settings.js";

export type EarnedItemId = "ultron-drone-art" | "promo-art";

export interface EarnedItem {
  readonly id: EarnedItemId;
  readonly title: string;
  /** What it does, shown once earned. */
  readonly detail: string;
  /** How to earn it, shown in its place until then. */
  readonly howToEarn: string;
  /** The achievement that earns it (`ACHIEVEMENTS` id); absent for promo card art, which earning a promo card opens. */
  readonly achievementId?: string;
  /** The setting that turns it on or off once earned. */
  readonly setting: keyof Pick<Settings, "ultronDroneArt" | "promoArtOn">;
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
  {
    id: "promo-art",
    title: "Promo card art",
    detail: "Cards you picked in Extras ▸ Promos show their promo art.",
    howToEarn: "Earn a promo card: win 3 games with one hero.",
    setting: "promoArtOn",
  },
];

/** The items this player has earned: their achievement is (a promo card, for promo art), or "Unlock everything" is on. */
export function earnedItemIdsOf(
  isEarned: (achievementId: string) => boolean,
  everything = false,
  anyPromoEarned = false,
): ReadonlySet<EarnedItemId> {
  return new Set(
    EARNED_ITEMS.filter(
      (item) => everything || (item.achievementId ? isEarned(item.achievementId) : anyPromoEarned),
    ).map((item) => item.id),
  );
}

/** The stand-in pictures to draw: earned, and switched on. */
export function shownStandInsOf(earned: ReadonlySet<EarnedItemId>, settings: Settings): ReadonlySet<StandIn["kind"]> {
  const kinds = new Set<StandIn["kind"]>();
  for (const item of EARNED_ITEMS) {
    if (item.standIn && earned.has(item.id) && settings[item.setting]) kinds.add(item.standIn);
  }
  return kinds;
}
