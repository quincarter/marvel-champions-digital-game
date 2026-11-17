import { expect, test } from "vitest";
import { withoutDeckNames } from "./shared-config.js";

test("deck names are dropped from every seat and nothing else is touched", () => {
  const config = {
    scenarioId: "rhino",
    players: [
      { starterDeckId: "core-spider-man-justice" },
      { identityCardId: "cap", deck: ["a"], deckId: "d-cap", deckName: "My secret name" },
    ],
  };
  expect(withoutDeckNames(config)).toEqual({
    scenarioId: "rhino",
    players: [{ starterDeckId: "core-spider-man-justice" }, { identityCardId: "cap", deck: ["a"], deckId: "d-cap" }],
  });
  expect(config.players[1]!.deckName).toBe("My secret name");
});

test("a value that is not a setup comes back as it was", () => {
  expect(withoutDeckNames(undefined)).toBeUndefined();
  expect(withoutDeckNames({ seed: 1 })).toEqual({ seed: 1 });
});
