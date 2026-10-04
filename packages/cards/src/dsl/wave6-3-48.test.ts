/**
 * docs/phase7-wave6.md §3.48: "find" a card wherever it is in the game. `find(q, { owner })` emits the engine's
 * `TargetRef find`; `findCard(q, to, { owner, bind })` its `EffectSpec findCard`. The engine's `find-card.test.ts`
 * drives both. Shapes only (Rogue's own cards are scripted elsewhere, against their regenerated data).
 */

import { describe, expect, it } from "vitest";
import { heroAction, setup } from "./abilities.js";
import { addCounters, chooseTarget, findCard } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, find, query, yourIdentity, you } from "./values.js";

const TOUCHED = query("upgrade", { name: "Touched" });

describe("§3.48 `find` / `findCard`", () => {
  it("'Setup: Find your Touched upgrade and set it aside' (Anna Marie's shape)", () => {
    const definition = setup(findCard(TOUCHED, "setAside", { owner: you }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "findCard",
        query: { categories: ["upgrade"], name: "Touched" },
        owner: { kind: "controller" },
        to: "setAside",
      },
    ]);
  });

  it("'Find Touched and attach it to another character' (Skin Contact's shape), binding the found card", () => {
    const definition = heroAction(
      chooseTarget("host", query(["identity", "ally", "minion", "villain"], { self: false })),
      findCard(TOUCHED, { attachTo: chosen("host") }, { owner: you, bind: "touched" }),
      addCounters("marker", 1, chosen("touched")),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[1]).toEqual({
      kind: "findCard",
      query: { categories: ["upgrade"], name: "Touched" },
      owner: { kind: "controller" },
      to: { attachTo: { kind: "slot", slot: "host" } },
      bind: "touched",
    });
  });

  it("an unbound slot read after findCard without `bind` is still a validation problem", () => {
    const definition = heroAction(findCard(TOUCHED, "setAside"), addCounters("marker", 1, chosen("touched")));
    expect(validateDefinition(definition)).not.toEqual([]);
  });

  it("find: the ref, owner optional", () => {
    expect(find(TOUCHED)).toEqual({ kind: "find", query: { categories: ["upgrade"], name: "Touched" } });
    expect(find(TOUCHED, { owner: you })).toEqual({
      kind: "find",
      query: { categories: ["upgrade"], name: "Touched" },
      owner: { kind: "controller" },
    });
    expect(yourIdentity).toEqual({ kind: "identityOf", player: { kind: "controller" } });
  });
});
