import { describe, expect, it } from "vitest";
import {
  FNE_VILLAIN_LISTED,
  FNE_VILLAIN_RANDOM,
  optionLabelIn,
  roleExplainerIn,
  roleRelationIn,
  roleSummaryIn,
} from "./call-text.js";

describe("the calls' words in Spanish", () => {
  it("says the Fear No Evil villain-method buttons in Spanish and leaves any other label alone", () => {
    expect(optionLabelIn(FNE_VILLAIN_LISTED, "x", "es")).toBe("El siguiente villano de la lista recomendada");
    expect(optionLabelIn(FNE_VILLAIN_RANDOM, "x", "es")).toBe("Un villano al azar de los no anotados");
    expect(optionLabelIn("hammerhead", "Hammerhead", "es")).toBe("Hammerhead");
  });

  it("gives each role a Spanish summary, and a pack's own role keeps its English", () => {
    expect(roleSummaryIn("brawler", "english", "es")).toMatch(/^El luchador/);
    expect(roleSummaryIn("brawler", "english", "en")).toBe("english");
    expect(roleSummaryIn("custom", "english", "es")).toBe("english");
  });

  it("words how a role sits against the deck in Spanish, with the aspects' Spanish names", () => {
    const role = ["aggression", "protection"] as const;
    expect(roleRelationIn(role, ["justice"], "en", "es")).toBe("Añade Agresividad y Protección");
    expect(roleRelationIn(role, ["protection"], "en", "es")).toBe(
      "Se apoya en tu mazo de Protección y añade Agresividad",
    );
    expect(roleRelationIn(role, ["protection", "aggression"], "en", "es")).toBe(
      "Se apoya en tu mazo de Agresividad + Protección",
    );
    expect(roleRelationIn(role, [], "Adds Aggression and Protection", "en")).toBe("Adds Aggression and Protection");
  });

  it("keeps the explainer's three lines in both languages", () => {
    expect(roleExplainerIn("en").heading).toBe("What roles do");
    expect(roleExplainerIn("es").heading).toBe("Qué hacen los roles");
    expect(roleExplainerIn("es").rule).toMatch(/rol distinto/);
  });
});
