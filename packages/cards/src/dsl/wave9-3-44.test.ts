/**
 * docs/phase7-wave9.md §3.44: `on.boostCardGiven` ("After an attacking enemy is given a facedown boost card"),
 * `lookAtAndRearrange` over that card and the deck's top card with `bindAt` ("you may swap those cards … the
 * (current) boost card"), and `printedBoostAreaIconsOn` ("for each printed icon (★ and boost)"): Up, Up, and Away
 * 53005. The engine's `boost-card-given.test.ts` drives them.
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt, heroResponse, on, response } from "./abilities.js";
import {
  anyOfCards,
  cards,
  draw,
  encounterCards,
  lookAt,
  lookAtAndRearrange,
  selectCards,
  swapCards,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, eventTarget, printedBoostAreaIconsOn, query } from "./values.js";

const TOP = encounterCards(["deck"], undefined, 1);
const THAT_CARD_AND_THE_TOP = anyOfCards(cards(eventTarget), TOP);

describe("§3.44 on.boostCardGiven", () => {
  it("any boost card given, to anything", () => {
    expect(on.boostCardGiven()).toEqual({ on: "boostCardGiven" });
  });

  it("an attacking enemy, the villain, an attack against you", () => {
    expect(on.boostCardGiven({ activation: "attack" })).toEqual({ on: "boostCardGiven", activation: "attack" });
    expect(on.boostCardGiven({ activation: "scheme", to: query("villain"), againstYou: true })).toEqual({
      on: "boostCardGiven",
      sourceIs: { categories: ["villain"] },
      activation: "scheme",
      playerIs: "controller",
    });
  });

  it("refuses an interrupt and a pattern narrowed by the facedown card", () => {
    expect(validateDefinition(forcedInterrupt(on.boostCardGiven(), draw(1)))).toContainEqual(
      expect.stringContaining("is a response"),
    );
    expect(
      validateDefinition(response({ ...on.boostCardGiven(), targetIs: query("treachery") }, draw(1))),
    ).toContainEqual(expect.stringContaining("cannot ask targetIs"));
  });
});

describe("§3.44 the look, the swap and the printed icons", () => {
  it("lookAtAndRearrange names a slot for each looked-at position", () => {
    expect(lookAtAndRearrange(THAT_CARD_AND_THE_TOP, { bind: "seen", bindAt: ["boost", "top"] })).toEqual({
      kind: "lookAt",
      cards: THAT_CARD_AND_THE_TOP,
      viewer: { kind: "controller" },
      bind: "seen",
      rearrange: true,
      bindAt: ["boost", "top"],
    });
  });

  it("printedBoostAreaIconsOn counts the printed boost icons and the star", () => {
    expect(printedBoostAreaIconsOn(chosen("boost"))).toEqual({
      kind: "sum",
      values: [
        { kind: "boostIcons", of: { kind: "slot", slot: "boost" }, printed: true },
        { kind: "starIcons", cards: { kind: "slot", slot: "boost" } },
      ],
    });
  });

  it("Up, Up, and Away's shape validates, the label included", () => {
    const away = heroResponse(
      on.boostCardGiven({ activation: "attack" }),
      { label: "defense" },
      lookAtAndRearrange(THAT_CARD_AND_THE_TOP, { bindAt: ["boost", "top"] }),
      draw(printedBoostAreaIconsOn(chosen("boost"))),
    );
    expect(away.label).toEqual(["defense"]);
    expect(validateDefinition(away)).toEqual([]);
  });

  it("the two-step form validates: a plain look, then swapCards", () => {
    const trade = response(
      on.boostCardGiven({ activation: "attack" }),
      lookAt(THAT_CARD_AND_THE_TOP),
      selectCards("top", TOP),
      swapCards(eventTarget, chosen("top")),
    );
    expect(validateDefinition(trade)).toEqual([]);
  });

  it("'that card' is a position to rearrange only in an answer to a boost card being given", () => {
    const elsewhere = response(on.youChangeForm(), lookAtAndRearrange(THAT_CARD_AND_THE_TOP));
    expect(validateDefinition(elsewhere)).toContainEqual(expect.stringContaining("lookAt rearrange"));
    const filtered = response(
      on.boostCardGiven(),
      lookAtAndRearrange(anyOfCards(cards(eventTarget, query("treachery")), TOP)),
    );
    expect(validateDefinition(filtered)).toContainEqual(expect.stringContaining("lookAt rearrange"));
  });

  it("bindAt belongs to a look that rearranges, and its slots are readable after it", () => {
    const plain = response(on.boostCardGiven(), {
      kind: "lookAt",
      cards: THAT_CARD_AND_THE_TOP,
      viewer: { kind: "controller" },
      bindAt: ["boost"],
    });
    expect(validateDefinition(plain)).toContainEqual(expect.stringContaining("lookAt bindAt"));
    const unbound = response(on.boostCardGiven(), draw(printedBoostAreaIconsOn(chosen("boost"))));
    expect(validateDefinition(unbound)).not.toEqual([]);
  });
});
