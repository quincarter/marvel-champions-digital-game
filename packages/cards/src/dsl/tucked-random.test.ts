import { describe, expect, it } from "vitest";
import {
  action,
  chosen,
  dealAsEncounterCard,
  ifThen,
  moveCards,
  query,
  selectCards,
  self,
  tuckedCount,
  tuckedUnder,
  valueAtLeast,
  yourIdentity,
} from "./index.js";
import { validateDefinition } from "./validate.js";

/** docs/phase7-wave9.md §3.39, §3.40: `tuckedUnder(under, { random, filter })`, a pick at random among tucked cards. */
describe("tuckedUnder: a random pick among tucked cards", () => {
  it("with no options it is the plain selector, as before", () => {
    expect(tuckedUnder(self)).toEqual({ kind: "tucked", under: { kind: "self" } });
  });

  it("random and filter are emitted as given: '1 of those cards at random'", () => {
    expect(tuckedUnder(yourIdentity, { random: 1 })).toEqual({
      kind: "tucked",
      under: yourIdentity,
      random: { kind: "const", value: 1 },
    });
    expect(tuckedUnder(self, { random: 1, filter: query("minion") })).toMatchObject({
      kind: "tucked",
      filter: query("minion"),
      random: { kind: "const", value: 1 },
    });
  });

  it("validates in a discard (Hunting the Spider-Bride's shape) and bound for a deal (The Raft's shape)", () => {
    const discard = action(
      ifThen(
        valueAtLeast(tuckedCount(yourIdentity), 4),
        moveCards(tuckedUnder(yourIdentity, { random: 1 }), "discard"),
      ),
    );
    expect(validateDefinition(discard)).toEqual([]);
    const deal = action(
      ifThen(valueAtLeast(tuckedCount(self, query("minion")), 4), [
        selectCards("loose", tuckedUnder(self, { random: 1, filter: query("minion") })),
        dealAsEncounterCard(chosen("loose")),
      ]),
    );
    expect(validateDefinition(deal)).toEqual([]);
  });

  it.each([0, -1, 1.5])("a constant random count of %s is rejected", (count) => {
    const bad = action(moveCards(tuckedUnder(self, { random: count }), "discard"));
    expect(validateDefinition(bad).join("\n")).toContain("random count must be a whole number of at least 1");
  });
});
