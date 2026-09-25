import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../dsl/validate.js";
import { WAVE4_DEPS } from "../index.js";
import { ADAM_WARLOCK_OBLIGATION_NEMESIS } from "./adam-warlock-obligation-nemesis.js";

const valid = (id: string) => expect(validateDefinition(WAVE4_DEPS.abilities[id]!)).toEqual([]);

describe("Regeneration Cycle (21066)", () => {
  it("21066.obligation: discards the top 5 cards of the deck, placing 1 threat per different aspect discarded", () => {
    valid("21066.obligation");
    const def = ADAM_WARLOCK_OBLIGATION_NEMESIS["21066.obligation"]!;
    expect(def.trigger).toMatchObject({ kind: "whenRevealed" });
    // Two branches (the shared `obligation()` shape, `core/obligations.ts`): exhaust the alter-ego to remove it, or
    // the alternative — discard the top 5, place threat per distinct aspect, discard this obligation.
    const chooseFlip = def.effects[0]!;
    expect(chooseFlip).toMatchObject({ kind: "chooseOne" });
    const chooseBranch = def.effects[1]!;
    expect(chooseBranch).toMatchObject({ kind: "chooseOne" });
    if (chooseBranch.kind === "chooseOne") {
      const alternative = chooseBranch.options[1]!;
      expect(alternative.effects).toEqual([
        {
          kind: "selectCards",
          slot: "discarded",
          cards: { kind: "zone", zone: "deck", top: { kind: "const", value: 5 }, player: { kind: "controller" } },
        },
        { kind: "moveCards", cards: { kind: "ref", ref: { kind: "slot", slot: "discarded" } }, to: "discard" },
        {
          kind: "placeThreat",
          amount: { kind: "distinctAspects", cards: { kind: "slot", slot: "discarded" } },
          target: { kind: "mainScheme" },
        },
        { kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "discard" },
      ]);
    }
  });
});

describe("The Magus (21067)", () => {
  it("21067.the-magus-forced-response: discards the top 5 cards of the deck after it activates against you", () => {
    valid("21067.the-magus-forced-response");
    expect(ADAM_WARLOCK_OBLIGATION_NEMESIS["21067.the-magus-forced-response"]!.effects).toEqual([
      {
        kind: "moveCards",
        cards: { kind: "zone", zone: "deck", top: { kind: "const", value: 5 }, player: { kind: "controller" } },
        to: "discard",
      },
    ]);
  });
});

describe("Universal Church of Truth (21068)", () => {
  it("21068.universal-church-of-truth-forced-response: exhausts and stuns the player who reset their deck", () => {
    valid("21068.universal-church-of-truth-forced-response");
    const def = ADAM_WARLOCK_OBLIGATION_NEMESIS["21068.universal-church-of-truth-forced-response"]!;
    expect(def.trigger).toMatchObject({ on: { on: "deckRanOut", eventIs: { deck: "player" } } });
    expect(def.effects).toEqual([
      { kind: "exhaust", target: { kind: "identityOf", player: { kind: "eventPlayer" } } },
      { kind: "giveStatus", target: { kind: "identityOf", player: { kind: "eventPlayer" } }, status: "stunned" },
    ]);
  });

  it("21068.boost: reveals this card", () => {
    valid("21068.boost");
    expect(ADAM_WARLOCK_OBLIGATION_NEMESIS["21068.boost"]!.effects).toEqual([
      { kind: "revealCard", cards: { kind: "self" }, player: { kind: "firstPlayer" } },
    ]);
  });
});

describe("Zealot of Truth (21069)", () => {
  it("21069.zealot-of-truth-constant: threat cannot be removed from Universal Church of Truth", () => {
    valid("21069.zealot-of-truth-constant");
    expect(ADAM_WARLOCK_OBLIGATION_NEMESIS["21069.zealot-of-truth-constant"]!.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "threatCannotBeRemoved" }],
    });
  });

  it("21069.boost: puts Zealot of Truth into play engaged with you", () => {
    valid("21069.boost");
    expect(ADAM_WARLOCK_OBLIGATION_NEMESIS["21069.boost"]!.effects).toEqual([
      { kind: "putIntoPlay", card: { kind: "self" }, controller: { kind: "controller" } },
      { kind: "engage", minion: { kind: "self" }, player: { kind: "controller" } },
    ]);
  });
});

describe("Cosmic Inquisition (21070)", () => {
  it("21070.when-revealed: discards 10 if the side scheme is in play, else searches for and reveals it", () => {
    valid("21070.when-revealed");
    const def = ADAM_WARLOCK_OBLIGATION_NEMESIS["21070.when-revealed"]!;
    expect(def.trigger).toMatchObject({ kind: "whenRevealed" });
    expect(def.effects[0]).toMatchObject({ kind: "if" });
  });
});
