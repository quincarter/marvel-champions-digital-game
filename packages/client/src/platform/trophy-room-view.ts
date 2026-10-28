/**
 * The Trophy Room's view between visits (#479): its sort, and which families the player opened (every one starts
 * folded). Kept in `localStorage`, with the storage passed in so the rule is tested without a browser. A view that
 * cannot be read is the default one.
 */
import { ACHIEVEMENT_FAMILIES, type AchievementFamily } from "../progression/achievements.js";
import { DEFAULT_TROPHY_VIEW, TROPHY_SORTS, type TrophySort, type TrophyView } from "../view/trophy-room-model.js";

export const TROPHY_ROOM_VIEW_KEY = "mc-trophy-room-view";

type PrefStorage = Pick<Storage, "getItem" | "setItem">;

const browserStorage = (): PrefStorage | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

const FAMILY_IDS = new Set<string>(ACHIEVEMENT_FAMILIES.map((f) => f.id));
const SORT_IDS = new Set<string>(TROPHY_SORTS.map((s) => s.id));

export function trophyRoomView(storage: PrefStorage | null = browserStorage()): TrophyView {
  try {
    const raw = storage?.getItem(TROPHY_ROOM_VIEW_KEY);
    if (!raw) return DEFAULT_TROPHY_VIEW;
    const parsed = JSON.parse(raw) as { sort?: unknown; descending?: unknown; expanded?: unknown };
    const expanded = Array.isArray(parsed.expanded)
      ? parsed.expanded.filter((id): id is AchievementFamily => typeof id === "string" && FAMILY_IDS.has(id))
      : [];
    return {
      sort: typeof parsed.sort === "string" && SORT_IDS.has(parsed.sort) ? (parsed.sort as TrophySort) : "category",
      descending: parsed.descending === true,
      expanded: new Set(expanded),
    };
  } catch {
    return DEFAULT_TROPHY_VIEW;
  }
}

export function rememberTrophyRoomView(view: TrophyView, storage: PrefStorage | null = browserStorage()): void {
  try {
    storage?.setItem(
      TROPHY_ROOM_VIEW_KEY,
      JSON.stringify({ sort: view.sort, descending: view.descending, expanded: [...view.expanded].sort() }),
    );
  } catch {
    // A full or blocked store only means the room opens folded next time.
  }
}
