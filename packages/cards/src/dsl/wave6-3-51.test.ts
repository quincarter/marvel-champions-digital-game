/**
 * docs/phase7-wave6.md §3.51: the DSL side of "search its owner's discard pile for an event that belong's to the same
 * classification as that character (identity-specific, aspect, or basic)" (Superpower Adaptation, `rogue` 38009).
 * `sameClassificationAs(ref)` emits the engine's `TargetQuery.sameClassificationAs`; the engine's
 * `same-classification.test.ts` drives the behavior (§4.1 Q29: the five aspects are one classification). Shapes only
 * (Rogue's own cards are scripted elsewhere).
 */

import { describe, expect, it } from "vitest";
import { heroAction } from "./abilities.js";
import { cards, chooseCards, ifThen, moveCardsInto, zone } from "./effects.js";
import { validateDefinition } from "./validate.js";
import {
  chosen,
  each,
  exists,
  hasAttachment,
  ownerOf,
  query,
  refMatches,
  sameClassificationAs,
  you,
} from "./values.js";

const TOUCHED = query("upgrade", { name: "Touched" });
/** "The character Touched is attached to". */
const TOUCHED_HOST = each(query("character", hasAttachment(TOUCHED)));

describe("§3.51 sameClassificationAs", () => {
  it("is the query field, ref as given", () => {
    expect(sameClassificationAs(TOUCHED_HOST)).toEqual({
      sameClassificationAs: {
        kind: "each",
        query: { categories: ["character"], hasAttachment: { categories: ["upgrade"], name: "Touched" } },
      },
    });
    expect(query("event", sameClassificationAs(chosen("host")))).toEqual({
      categories: ["event"],
      sameClassificationAs: { kind: "slot", slot: "host" },
    });
  });

  it("Superpower Adaptation's shape validates", () => {
    const definition = heroAction(
      ifThen(exists(query(["identity", "ally"], hasAttachment(TOUCHED))), [
        chooseCards(
          "found",
          zone("discard", ownerOf(TOUCHED_HOST), { filter: query("event", sameClassificationAs(TOUCHED_HOST)) }),
          {
            min: 1,
            max: 1,
          },
        ),
        moveCardsInto(cards(chosen("found")), "hand", you),
      ]),
    );
    expect(validateDefinition(definition)).toEqual([]);
    const [only] = definition.effects;
    expect(only).toMatchObject({
      kind: "if",
      then: [
        {
          kind: "chooseCards",
          from: {
            kind: "zone",
            zone: "discard",
            player: { kind: "ownerOf", target: TOUCHED_HOST },
            filter: { categories: ["event"], sameClassificationAs: TOUCHED_HOST },
          },
        },
        { kind: "moveCards", to: "hand", into: { kind: "controller" } },
      ],
    });
  });

  it("the host-type lines stay refMatches over categories (§3.58), hero and alterEgo apart", () => {
    expect(refMatches(TOUCHED_HOST, query("hero"))).toEqual({
      kind: "refMatches",
      ref: TOUCHED_HOST,
      query: { categories: ["hero"] },
    });
    expect(refMatches(TOUCHED_HOST, query("alterEgo"))).not.toEqual(refMatches(TOUCHED_HOST, query("hero")));
  });
});
