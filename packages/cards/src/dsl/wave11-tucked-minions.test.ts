/**
 * docs/phase7-wave11-scenarios.md §S3.10 (engine task E10): the DSL shape of "After a player reveals a [Tracksuit]
 * minion from the encounter deck, that player reveals 1 minion tucked here" (Tracksuit Mafia, `fne` 60204). The engine
 * behaviour is proven in `packages/engine/src/tucked-encounter-minions.test.ts`.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { forcedResponse, on } from "./abilities.js";
import { chooseCards, revealCard, tuckedUnder } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, eventPlayer, query, self } from "./values.js";

describe("§S3.10 on.cardRevealedFromEncounterDeck", () => {
  it("hears cardRevealed with from: encounterDeck and narrows the card", () => {
    const minion = query("minion", { trait: trait("TRACKSUIT") });
    expect(on.cardRevealedFromEncounterDeck(minion)).toEqual({
      on: "cardRevealed",
      eventIs: { from: "encounterDeck" },
      targetIs: minion,
    });
    expect(on.cardRevealedFromEncounterDeck()).toEqual({ on: "cardRevealed", eventIs: { from: "encounterDeck" } });
  });

  it("the Tracksuit Mafia response validates: that player picks 1 minion tucked here and reveals it", () => {
    const definition = forcedResponse(
      on.cardRevealedFromEncounterDeck(query("minion", { trait: trait("TRACKSUIT") })),
      chooseCards("pick", tuckedUnder(self, { filter: query("minion") }), { chooser: eventPlayer, min: 1, max: 1 }),
      revealCard(chosen("pick"), eventPlayer),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });
});
