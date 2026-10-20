import { describe, expect, test } from "vitest";
import { defaultSettings } from "../settings.js";
import { earnedItemRowInfoOf, nextSettingsAfterToggle } from "../view/settings-rows.js";
import { EARNED_ITEMS, earnedItemIdsOf, shownStandInsOf } from "./earned-items.js";
import { Extras, NO_EXTRAS_PROGRESS } from "./extras.js";

/** Issue #291: the Drone art is earned with a win against Ultron, then switched on or off in Settings ▸ More. */
describe("earned items", () => {
  const fresh = new Extras(NO_EXTRAS_PROGRESS);
  const wonUltron = new Extras({ ...NO_EXTRAS_PROGRESS, wonScenarioIds: ["ultron"] });
  const openIn = (extras: Extras) => earnedItemIdsOf((unlock) => extras.isOpen(unlock));

  test("nothing is earned before a win against Ultron, and the Drone art is after one", () => {
    expect([...openIn(fresh)]).toEqual([]);
    expect([...openIn(new Extras({ ...NO_EXTRAS_PROGRESS, lostScenarioIds: ["ultron"] }))]).toEqual([]);
    expect([...openIn(wonUltron)]).toEqual(["ultron-drone-art"]);
  });

  test("Unlock everything earns them too", () => {
    expect([...openIn(new Extras(NO_EXTRAS_PROGRESS, { everything: true }))]).toEqual(["ultron-drone-art"]);
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
