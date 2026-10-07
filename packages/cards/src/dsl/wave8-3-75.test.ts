/**
 * docs/phase7-wave8.md §3.75: the builders for a card in play dealt to a player as a facedown encounter card and
 * passed to the next player. `dealAsEncounterCard(find(...), player)`, `passEncounterCard(cards, from, to)` and
 * `nextAfter(player)` emit the engine's plain specs (`deal-card-in-play.test.ts` and `pass-encounter-card.test.ts` in
 * the engine drive them).
 */

import { describe, expect, it } from "vitest";
import { forcedResponse, on, whenDefeated } from "./abilities.js";
import { dealAsEncounterCard, passEncounterCard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { defeatingPlayer, eventPlayer, eventSource, find, nextAfter, query, you } from "./values.js";

describe("§3.75 `dealAsEncounterCard` of a find, `passEncounterCard`, `nextAfter`", () => {
  it("Brimstone Dimension's shape: the defeating player finds a minion and deals him to themself", () => {
    const definition = whenDefeated(dealAsEncounterCard(find(query("minion", { name: "Azazel" })), defeatingPlayer));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "dealAsEncounterCard",
        cards: { kind: "find", query: { categories: ["minion"], name: "Azazel" } },
        player: { kind: "defeatingPlayer" },
      },
    ]);
  });

  it("The Crazy Gang's shape: the minion that schemed is dealt to that player and passed to the next", () => {
    const definition = forcedResponse(
      on.enemySchemes(query("minion")),
      dealAsEncounterCard(eventSource, eventPlayer),
      passEncounterCard(eventSource, eventPlayer, nextAfter(eventPlayer)),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "dealAsEncounterCard", cards: { kind: "eventSource" }, player: { kind: "eventPlayer" } },
      {
        kind: "passEncounterCard",
        cards: { kind: "eventSource" },
        from: { kind: "eventPlayer" },
        to: { kind: "nextAfter", of: { kind: "eventPlayer" } },
      },
    ]);
  });

  it("`nextAfter` wraps any player ref", () => {
    expect(nextAfter(you)).toEqual({ kind: "nextAfter", of: { kind: "controller" } });
  });
});
