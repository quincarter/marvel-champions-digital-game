/**
 * `forEachPlayer` / `forEachPlayerInChosenOrder` `{ bind }`: the passes' vars come back to the ability under `<bind>.`
 * (Sanctuary, `mts` 21116). The engine's behaviour is pinned in `packages/engine/src/for-each-player-bind.test.ts`;
 * this pins the builder's output and the validator.
 */

import { describe, expect, it } from "vitest";
import {
  each,
  eachPlayer,
  forEachCard,
  forEachPlayer,
  forEachPlayerInChosenOrder,
  heroAction,
  placeThreat,
  query,
  selectCards,
  setVar,
  theMainScheme,
  theVillain,
  validateDefinition,
  varOf,
} from "./index.js";

const SPEND = setVar("spent", 1);
const readAfter = (name: string) => placeThreat(varOf(name), theMainScheme);

describe("forEachPlayer bind", () => {
  it("carries the bind wherever the options sit; without one there is none", () => {
    expect(forEachPlayer(eachPlayer, { bind: "all" }, SPEND)).toEqual({
      kind: "forEachPlayer",
      players: eachPlayer,
      effects: [SPEND],
      bind: "all",
    });
    expect(forEachPlayerInChosenOrder(eachPlayer, SPEND, { bind: "all" })).toMatchObject({
      order: "firstPlayerChooses",
      bind: "all",
      effects: [SPEND],
    });
    expect(forEachPlayer(eachPlayer, SPEND)).not.toHaveProperty("bind");
  });

  it("validates reading `<bind>.<var>` after the loop", () => {
    expect(
      validateDefinition(heroAction(forEachPlayer(eachPlayer, SPEND, { bind: "all" }), readAfter("all.spent"))),
    ).toEqual([]);
  });

  it("flags reading a pass's own var after the loop, and `<bind>.` before it", () => {
    const own = validateDefinition(heroAction(forEachPlayer(eachPlayer, SPEND, { bind: "all" }), readAfter("spent")));
    expect(own).not.toHaveLength(0);
    expect(own[0]).toMatch(/"spent" is read before it is bound/);
    const inside = validateDefinition(
      heroAction(forEachPlayer(eachPlayer, SPEND, readAfter("all.spent"), { bind: "all" })),
    );
    expect(inside[0]).toMatch(/"all.spent" is read before it is bound/);
  });

  it("rejects an empty bind, and a bind already known (an earlier loop's, or an enclosing one's)", () => {
    expect(validateDefinition(heroAction(forEachPlayer(eachPlayer, SPEND, { bind: "" })))[0]).toMatch(/needs a name/);
    const twice = validateDefinition(
      heroAction(forEachPlayer(eachPlayer, SPEND, { bind: "all" }), forEachPlayer(eachPlayer, SPEND, { bind: "all" })),
    );
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatch(/bind "all" is already bound/);
    const nested = validateDefinition(
      heroAction(forEachPlayer(eachPlayer, forEachPlayer(eachPlayer, SPEND, { bind: "all" }), { bind: "all" })),
    );
    expect(nested).toHaveLength(1);
    expect(nested[0]).toMatch(/bind "all" is already bound/);
    expect(
      validateDefinition(
        heroAction(forEachPlayer(eachPlayer, forEachPlayer(eachPlayer, SPEND, { bind: "inner" }), { bind: "all" })),
      ),
    ).toEqual([]);
  });

  it("rejects a pass binding a var or slot the ability already holds (it would come back as unchanged)", () => {
    const rebound = validateDefinition(
      heroAction(setVar("spent", 2), forEachPlayer(eachPlayer, SPEND, { bind: "all" }), readAfter("all.spent")),
    );
    expect(rebound).toHaveLength(1);
    expect(rebound[0]).toMatch(/binds "spent", which the ability already holds/);
    const slot = validateDefinition(
      heroAction(
        selectCards("target", { kind: "ref", ref: theVillain }),
        forEachPlayer(eachPlayer, selectCards("target", { kind: "ref", ref: theVillain }), { bind: "all" }),
      ),
    );
    expect(slot.some((p) => /binds "target", which the ability already holds/.test(p))).toBe(true);
  });

  it("rejects a forEachCard and a forEachPlayer reusing each other's enclosing bind", () => {
    const CARDS = each(query("character", { controller: "you" }));
    const cardInPlayer = validateDefinition(
      heroAction(forEachPlayer(eachPlayer, forEachCard("c", CARDS, SPEND, { bind: "x" }), { bind: "x" })),
    );
    expect(cardInPlayer).toHaveLength(1);
    expect(cardInPlayer[0]).toMatch(/forEachCard bind "x" is already an enclosing loop's bind/);
    const playerInCard = validateDefinition(
      heroAction(forEachCard("c", CARDS, forEachPlayer(eachPlayer, SPEND, { bind: "x" }), { bind: "x" })),
    );
    expect(playerInCard).toHaveLength(1);
    expect(playerInCard[0]).toMatch(/forEachPlayer bind "x" is already bound/);
  });
});
