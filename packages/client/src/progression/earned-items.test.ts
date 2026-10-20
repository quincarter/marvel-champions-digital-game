import { describe, expect, test } from "vitest";
import { defaultSettings } from "../settings.js";
import { earnedItemRowInfoOf, nextSettingsAfterToggle } from "../view/settings-rows.js";
import { EARNED_ITEMS, earnedItemIdsOf, shownStandInsOf } from "./earned-items.js";
import { ACHIEVEMENTS, NO_HISTORY, isAchievementEarned, type AchievementHistory } from "./achievements.js";

/** Issue #291: the Drone art is earned with the Drone On achievement, then switched on or off in Settings ▸ More. */
describe("earned items", () => {
  const game = (scenarioId: string, status: string) => ({ status, config: { scenarioId, players: [{}] } });
  const fresh = NO_HISTORY;
  const wonUltron: AchievementHistory = { saves: [game("ultron", "won")], campaigns: [] };
  const openIn = (history: AchievementHistory) => earnedItemIdsOf((id) => isAchievementEarned(id, history));

  test("nothing is earned before Drone On (a win against Ultron), and the Drone art is after it", () => {
    expect([...openIn(fresh)]).toEqual([]);
    expect([...openIn({ saves: [game("ultron", "lost"), game("rhino", "won")], campaigns: [] })]).toEqual([]);
    expect([...openIn(wonUltron)]).toEqual(["ultron-drone-art"]);
  });

  test("every earned item names an achievement that exists and is tracked", () => {
    for (const item of EARNED_ITEMS) expect(ACHIEVEMENTS.find((a) => a.id === item.achievementId)?.tracked).toBe(true);
  });

  test("Unlock everything earns them too", () => {
    expect([...earnedItemIdsOf(() => false, true)]).toEqual(["ultron-drone-art"]);
  });

  test("the art is drawn only when earned and switched on", () => {
    const on = defaultSettings();
    const off = { ...on, ultronDroneArt: false };
    expect([...shownStandInsOf(openIn(fresh), on)]).toEqual([]);
    expect([...shownStandInsOf(openIn(wonUltron), on)]).toEqual(["ultronDrone"]);
    expect([...shownStandInsOf(openIn(wonUltron), off)]).toEqual([]);
  });

  test("the Settings row says how to earn it until it is earned, then toggles it", () => {
    const settings = defaultSettings();
    const [locked] = earnedItemRowInfoOf(settings, openIn(fresh));
    expect(locked).toMatchObject({ id: "ultron-drone-art", on: false, unavailable: EARNED_ITEMS[0]!.howToEarn });
    const [earned] = earnedItemRowInfoOf(settings, openIn(wonUltron));
    expect(earned).toMatchObject({ id: "ultron-drone-art", on: true });
    expect(earned!.unavailable).toBeUndefined();
    expect(nextSettingsAfterToggle(settings, "ultron-drone-art", 1).ultronDroneArt).toBe(false);
  });
});
