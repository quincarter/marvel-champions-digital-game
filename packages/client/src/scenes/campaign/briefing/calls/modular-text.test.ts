import { describe, expect, it } from "vitest";
import type { CampaignPendingChoice } from "@mc/engine";
import { modularSetCallOf } from "../../../../view/campaign-modular-call-model.js";
import { modularViewIn } from "./modular-text.js";

const pending = (options: string[]): CampaignPendingChoice =>
  ({ instructionId: "m", slot: "set", seatNumber: null, text: "", options, count: 1, optional: false }) as never;

const view = (over: Partial<Parameters<typeof modularSetCallOf>[0]> = {}): ReturnType<typeof modularSetCallOf> =>
  modularSetCallOf({
    pending: pending(["crime", "horror"]),
    answers: [],
    universe: ["crime", "horror"],
    checkedOff: [],
    scenario: undefined,
    seatCount: 2,
    setNameOf: (id) => id,
    cardCountOf: () => 6,
    descriptorOf: () => "Side schemes",
    ...over,
  });

/** No sentence the model words may be left in English: a changed English sentence fails here, not on a player's screen. */
const english = /\b(the|of|set|sets|cards?|choose|chosen|checked)\b/i;

describe("the modular call in Spanish", () => {
  it("passes English through untouched", () => {
    const first = view();
    expect(modularViewIn(first, "en")).toBe(first);
  });

  it("says the question, explanation, rule and tiles of an open first pick", () => {
    const spanish = modularViewIn(view(), "es");
    expect(spanish.question).toBe("Elige el conjunto de género de este número.");
    expect(spanish.explain).toMatch(/^Cada conjunto/);
    expect(spanish.whatIs).toMatch(/^Un conjunto de género/);
    expect(spanish.rule).toMatch(/^Todavía no hay ninguno tachado/);
    expect(spanish.tiles[0]!.detail).toBe("6 cartas · planes secundarios");
    for (const text of [spanish.question, spanish.explain, spanish.whatIs, spanish.rule ?? ""]) {
      expect(text).not.toMatch(english);
    }
  });

  it("numbers a later pick, and says a chosen and a checked-off set in words", () => {
    const later = view({
      pending: pending(["horror", "western"]),
      answers: [{ instructionId: "m", slot: "set", seatNumber: null, picked: ["crime"] }],
      universe: ["crime", "horror", "western", "fantasy"],
      checkedOff: ["fantasy"],
    });
    const spanish = modularViewIn(later, "es");
    expect(spanish.tiles.find((tile) => tile.id === "crime")!.statusLabel).toBe("ELEGIDO · ELECCIÓN 1");
    expect(spanish.tiles.find((tile) => tile.id === "fantasy")!.statusLabel).toBe("TACHADO");
    expect(spanish.rule).toMatch(/^Un conjunto usado en un número anterior/);
  });

  it("says a reusable set in words", () => {
    const reusing = modularViewIn(
      view({ universe: ["crime", "horror"], checkedOff: ["crime", "horror"], pending: pending(["crime"]) }),
      "es",
    );
    expect(reusing.tiles[0]!.statusLabel).toBe("TACHADO · SE PUEDE REUTILIZAR");
    expect(reusing.rule).toMatch(/^Todos los conjuntos que no están tachados/);
  });
});
