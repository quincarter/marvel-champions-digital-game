/**
 * docs/phase7-wave6.md §3.66: the DSL side of the show deck. `toScenarioDeck` is the `CardDestination` for a named
 * scenario deck, `on.encounterCardDiscardedFromPlay` hears 1B's "would be discarded", and
 * `lookAtTopOfScenarioDeckThenPlace` is Erratic Teleportation's look. The engine's `show-deck.test.ts` drives these
 * same shapes.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { forcedInterrupt, on, whenRevealed } from "./abilities.js";
import {
  cards,
  instead,
  lookAtTopOfScenarioDeckThenPlace,
  moveCards,
  revealCard,
  scenarioDeck,
  selectCards,
  toScenarioDeck,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, eventTarget, query, self, you } from "./values.js";

const SHOW_ENVIRONMENT = query("environment", { trait: trait("SHOW") });

describe("§3.66 toScenarioDeck", () => {
  it("names the deck and where the card goes; shuffled in by default", () => {
    expect(toScenarioDeck("show")).toEqual({ scenarioDeck: "show", at: "shuffle" });
    expect(toScenarioDeck("show", "top")).toEqual({ scenarioDeck: "show", at: "top" });
    expect(toScenarioDeck("show", "bottom")).toEqual({ scenarioDeck: "show", at: "bottom" });
  });

  it("Cornered!: reveal the top card of the show deck, then shuffle this card into it", () => {
    const definition = whenRevealed(
      selectCards("top", scenarioDeck("show", { top: 1 })),
      revealCard(chosen("top")),
      moveCards(cards(self), toScenarioDeck("show")),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[2]).toEqual({
      kind: "moveCards",
      cards: { kind: "ref", ref: { kind: "self" } },
      to: { scenarioDeck: "show", at: "shuffle" },
    });
  });

  it("Across the Mojoverse 1B: a discarded SHOW environment goes to the bottom of the show deck instead", () => {
    const definition = forcedInterrupt(
      on.encounterCardDiscardedFromPlay(SHOW_ENVIRONMENT),
      instead(moveCards(cards(eventTarget), toScenarioDeck("show", "bottom"))),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toMatchObject({
      kind: "interrupt",
      forced: true,
      on: {
        on: "cardLeavesPlay",
        targetIs: SHOW_ENVIRONMENT,
        eventIs: { to: ["encounterDiscard", "scenarioDiscard"] },
      },
    });
    expect(definition.effects).toEqual([
      {
        kind: "replaceTriggeringEvent",
        with: [
          {
            kind: "moveCards",
            cards: { kind: "ref", ref: { kind: "eventTarget" } },
            to: { scenarioDeck: "show", at: "bottom" },
          },
        ],
      },
    ]);
  });
});

describe("§3.66 lookAtTopOfScenarioDeckThenPlace", () => {
  it("Erratic Teleportation: look at the top card, then put it on the top or the bottom", () => {
    const definition = whenRevealed(lookAtTopOfScenarioDeckThenPlace("show"));
    expect(validateDefinition(definition)).toEqual([]);
    const seen = { kind: "ref", ref: { kind: "slot", slot: "show.seen" } };
    expect(definition.effects).toEqual([
      {
        kind: "lookAt",
        cards: { kind: "scenarioDeck", name: "show", top: { kind: "const", value: 1 } },
        viewer: you,
        bind: "show.seen",
      },
      {
        kind: "if",
        condition: {
          kind: "compare",
          left: { kind: "var", name: "show.seen.count" },
          op: "atLeast",
          right: { kind: "const", value: 1 },
        },
        then: [
          {
            kind: "chooseOne",
            chooser: you,
            options: [
              {
                label: "Put it on top of the show deck",
                effects: [{ kind: "moveCards", cards: seen, to: { scenarioDeck: "show", at: "top" } }],
              },
              {
                label: "Put it on the bottom of the show deck",
                effects: [{ kind: "moveCards", cards: seen, to: { scenarioDeck: "show", at: "bottom" } }],
              },
            ],
          },
        ],
      },
    ]);
  });
});
