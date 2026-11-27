import { describe, expect, it } from "vitest";
import { en } from "./en.js";
import { es } from "./es.js";

/** Words the pick-one screens (Scenario select, Take your seats, Deck check) once drew in English only. */
const KEYS = [
  "scenario.customPacks",
  "scenario.buildYourOwnTitle",
  "scenario.buildYourOwnSubtitle",
  "custom.badge",
  "aspectTip.link",
  "aspectTip.soon",
  ...["justice", "aggression", "leadership", "protection", "pool", "basic"].flatMap((a) => [
    `aspectTip.${a}.tagline`,
    `aspectTip.${a}.tip`,
  ]),
] as const;

describe("the pick-one screens' words in Spanish", () => {
  it.each(KEYS)("%s has its own Spanish text", (key) => {
    const spanish = (es as Record<string, string | undefined>)[key];
    expect(spanish, key).toBeTruthy();
    expect(spanish).not.toBe((en as Record<string, string>)[key]);
  });
});
