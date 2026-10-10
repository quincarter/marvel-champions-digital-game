import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import {
  attachCard,
  chosen,
  each,
  engage,
  engagedPlayerOf,
  forcedInterrupt,
  holdMinion,
  on,
  query,
  revealCard,
  revealHeldMinion,
  self,
  validateDefinition,
  whenRevealed,
} from "./index.js";

const THUNDERBOLT_MINIONS = query("minion", { trait: trait("THUNDERBOLT") });

describe("holdMinion: a minion an environment holds (Thunderbolt Backup, aos 50131b; MC50 p. 15)", () => {
  it("builds an attach that keeps the minion a minion, on this card by default", () => {
    expect(holdMinion(chosen("most"))).toEqual({
      kind: "attach",
      card: { kind: "slot", slot: "most" },
      to: { kind: "self" },
      as: "heldMinion",
    });
    expect(holdMinion(chosen("most"), chosen("environment"))).toMatchObject({
      to: { kind: "slot", slot: "environment" },
      as: "heldMinion",
    });
  });

  it("attachCard takes the same option, and leaves it off otherwise", () => {
    expect(attachCard(chosen("most"), self, { as: "heldMinion" })).toEqual(holdMinion(chosen("most")));
    expect(attachCard(chosen("card"), self)).toEqual({ kind: "attach", card: chosen("card"), to: self });
  });

  it("validates beside the engage that swaps the minion already held", () => {
    const swap = forcedInterrupt(
      on.phaseEnding("villain"),
      engage(each(THUNDERBOLT_MINIONS), engagedPlayerOf(self)),
      holdMinion(each(THUNDERBOLT_MINIONS)),
    );
    expect(validateDefinition(swap)).toEqual([]);
  });

  it("refuses a held minion attached facedown: it is in play", () => {
    const problems = validateDefinition(
      forcedInterrupt(on.phaseEnding("villain"), attachCard(self, self, { as: "heldMinion", facedown: true })),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/held minion is attached faceup/);
  });
});

describe("revealHeldMinion: 'Reveal and attach … here' (Justice, Like Lightning, aos 50131a; owner decision Q26 = B)", () => {
  it("builds a reveal whose minion is held by this card, resolved by you by default", () => {
    expect(revealHeldMinion(chosen("held"))).toEqual({
      kind: "revealCard",
      cards: { kind: "slot", slot: "held" },
      player: { kind: "controller" },
      heldBy: { kind: "self" },
    });
    expect(revealHeldMinion(chosen("held"), { kind: "firstPlayer" }, chosen("environment"))).toEqual({
      kind: "revealCard",
      cards: { kind: "slot", slot: "held" },
      player: { kind: "firstPlayer" },
      heldBy: { kind: "slot", slot: "environment" },
    });
  });

  it("a plain reveal names no holder, and the held reveal validates in a When Revealed", () => {
    expect(revealCard(chosen("held"))).not.toHaveProperty("heldBy");
    expect(
      validateDefinition(whenRevealed(revealHeldMinion(each(THUNDERBOLT_MINIONS), { kind: "firstPlayer" }))),
    ).toEqual([]);
  });
});
