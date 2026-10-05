/**
 * docs/phase7-wave7.md §3.81: the DSL side of "search your collection" (Armed to the Teeth 44009). The engine's
 * `search-collection.test.ts` drives the behavior.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { action } from "./abilities.js";
import { attachCard, fromAnyAspect, placeThreat, searchCollection } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, self, theMainScheme, varOf } from "./values.js";

const weaponUpgrade = { categories: ["upgrade"], aspects: fromAnyAspect, traits: [trait("WEAPON")] } as const;

describe("§3.81 searchCollection", () => {
  it("compiles to the engine effect, searching for you by default", () => {
    expect(searchCollection(weaponUpgrade, "found")).toEqual({
      kind: "searchCollection",
      player: { kind: "controller" },
      filter: {
        categories: ["upgrade"],
        aspects: ["aggression", "justice", "leadership", "protection", "pool"],
        traits: ["WEAPON"],
      },
      bind: "found",
    });
  });

  it("names another player when asked to", () => {
    expect(searchCollection(weaponUpgrade, "found", { kind: "scoped" })).toMatchObject({
      player: { kind: "scoped" },
    });
  });

  it("binds the found card as a slot and its count as a var for the effects that follow", () => {
    const definition = action(
      searchCollection(weaponUpgrade, "found"),
      attachCard(chosen("found"), self, { facedown: true }),
      placeThreat(varOf("found.count"), theMainScheme),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("reading the slot or the count with no search before it is a validation error", () => {
    expect(validateDefinition(action(attachCard(chosen("found"), self, { facedown: true })))).not.toEqual([]);
    expect(validateDefinition(action(placeThreat(varOf("found.count"), theMainScheme)))).not.toEqual([]);
  });
});
