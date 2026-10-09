import { describe, expect, it } from "vitest";
import {
  action,
  addCounters,
  cannotLeavePlay,
  chosen,
  consideredToHaveResourceIcon,
  constant,
  dealPoolOneAtATime,
  pairCards,
  pairLimit,
  query,
  reduceNextCardCost,
  topOfDeck,
  moveCards,
  totalStatOf,
  varOf,
  you,
} from "./index.js";
import { validateDefinition } from "./validate.js";

/**
 * The builders of docs/phase7-wave8.md §3.35 to §3.37 and §3.42 (engine tasks 34 to 38): what each compiles to, and
 * what the validator knows of the slots and vars the two new effects bind.
 */
const ALLIES = query("ally", { inScenarioPlayArea: "mission" });
const MINIONS = query("minion", { inScenarioPlayArea: "mission" });

describe("§3.35: cannot be discarded; a cost reduction by destination", () => {
  it("cannotLeavePlay by discard is the narrow form of the rule", () => {
    expect(cannotLeavePlay({ self: true }, { by: "discard" })).toEqual({
      rules: [{ kind: "cannotLeavePlay", target: { self: true }, by: "discard" }],
    });
  });

  it("reduceNextCardCost carries the area and 'any player' only when asked", () => {
    expect(
      reduceNextCardCost(you, 2, "phase", query("ally"), { into: { scenarioPlayArea: "mission" }, anyPlayer: true }),
    ).toEqual({
      kind: "reduceNextCardCost",
      player: { kind: "controller" },
      amount: { kind: "const", value: 2 },
      duration: "phase",
      cardFilter: { categories: ["ally"] },
      into: { scenarioPlayArea: "mission" },
      anyPlayer: true,
    });
    const plain = reduceNextCardCost(you, 1, "phase");
    expect(plain).not.toHaveProperty("into");
    expect(plain).not.toHaveProperty("anyPlayer");
  });
});

describe("§3.42 and §3.36: a considered icon, the pairing and its limit", () => {
  it("consideredToHaveResourceIcon and pairLimit are constant rules", () => {
    expect(consideredToHaveResourceIcon(query("ally", { hostOfSelf: true }), "wild")).toEqual({
      rules: [{ kind: "consideredResourceIcon", target: { categories: ["ally"], hostOfSelf: true }, resource: "wild" }],
    });
    expect(pairLimit("mission")).toEqual({
      rules: [{ kind: "pairLimit", area: "mission", limit: { distinctBy: "resourceIcon" } }],
    });
    expect(validateDefinition(constant(pairLimit("mission")))).toEqual([]);
  });

  it("pairCards matches by resource icon with a wild on either side, and the chooser defaults to you", () => {
    expect(pairCards(chosen("discarded"), ALLIES, "pairing")).toEqual({
      kind: "pairCards",
      cards: { kind: "slot", slot: "discarded" },
      with: ALLIES,
      chooser: { kind: "controller" },
      match: "resourceIcon",
      wild: "either",
      bind: "pairing",
    });
  });

  it("the validator knows what a pairing binds: its two slots and two counts, and nothing before it resolves", () => {
    const attempt = action(
      moveCards(topOfDeck(3), "discard", "discarded"),
      pairCards(chosen("discarded"), ALLIES, "pairing"),
      addCounters("in", 1, chosen("pairing.matched")),
      addCounters("given", 1, chosen("pairing.paired")),
      addCounters("pairs", varOf("pairing.pairs")),
      addCounters("matched", varOf("pairing.count")),
    );
    expect(validateDefinition(attempt)).toEqual([]);
    const early = action(
      addCounters("in", 1, chosen("pairing.matched")),
      moveCards(topOfDeck(3), "discard", "discarded"),
      pairCards(chosen("discarded"), ALLIES, "pairing"),
    );
    expect(validateDefinition(early).join("\n")).toMatch(/pairing\.matched/);
    const unbound = action(pairCards(chosen("discarded"), ALLIES, "pairing"));
    expect(validateDefinition(unbound).join("\n")).toMatch(/discarded/);
  });
});

describe("§3.37: a damage pool dealt one character at a time", () => {
  it("dealPoolOneAtATime is assignDamage with `sequential`, and its bind reports the pool", () => {
    expect(dealPoolOneAtATime(6, MINIONS)).toEqual({
      kind: "assignDamage",
      amount: { kind: "const", value: 6 },
      among: MINIONS,
      chooser: { kind: "controller" },
      sequential: true,
    });
    const pool = action(
      moveCards(topOfDeck(3), "discard", "discarded"),
      pairCards(chosen("discarded"), ALLIES, "pairing"),
      dealPoolOneAtATime(totalStatOf(chosen("pairing.matched"), "atk"), MINIONS, { bind: "pool" }),
      addCounters("dealt", varOf("pool.dealt")),
      addCounters("lost", varOf("pool.lost")),
    );
    expect(validateDefinition(pool)).toEqual([]);
  });
});
