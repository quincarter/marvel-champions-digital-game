// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { setArtLanguage } from "../../../../../art/art-source.js";
import type { IssueModeRow } from "../../../../../view/campaign-modes-model.js";
import { bangersMock, sectionHarness, textsOf } from "../sections.test-support.js";
import { drawModes } from "./modes.js";
import { modeRowTextIn } from "./modes-text.js";

vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
vi.mock("../../../../../ui/campaign-chrome.js", () => bangersMock);
vi.mock("../../../../../dom/ui-layer.js", () => ({ uiLayer: () => document.body }));

const expert: IssueModeRow = {
  id: "expert",
  name: "Difficulty",
  meta: "Standard set only",
  chips: [
    { action: "expert:off", label: "Standard", selected: true, enabled: true },
    { action: "expert:on", label: "Expert", selected: false, enabled: true },
  ],
};
const heroic: IssueModeRow = {
  id: "heroic",
  name: "Heroic level",
  meta: "2 extra encounter cards each",
  chips: [
    { action: "heroic:down", label: "−", selected: false, enabled: true },
    { action: "", label: "2", selected: false, enabled: false },
    { action: "heroic:up", label: "+", selected: false, enabled: true },
  ],
};
const skirmish: IssueModeRow = {
  id: "skirmish",
  name: "Skirmish",
  meta: "Off",
  chips: [
    { action: "", label: "Off", selected: true, enabled: false },
    { action: "skirmish:toggle", label: "On", selected: false, enabled: true },
  ],
};

afterEach(() => {
  setArtLanguage("en");
  vi.unstubAllGlobals();
});

describe("the modes section", () => {
  it("gives every live chip a stop that reports its action, and the rest none", () => {
    const h = sectionHarness();
    const chosen: string[] = [];
    h.run((base) =>
      drawModes({ ...base, rows: [expert, heroic, skirmish] }, { choose: (action) => void chosen.push(action) }),
    );
    expect(h.stopKeys()).toEqual([
      "mode:expert:off",
      "mode:expert:on",
      "mode:heroic:down",
      "mode:heroic:up",
      "mode:skirmish:toggle",
    ]);
    h.press("mode:heroic:up");
    expect(chosen).toEqual(["heroic:up"]);
  });

  it("draws the heading, each row's name and its state in words", () => {
    const { b } = sectionHarness().run((base) =>
      drawModes({ ...base, rows: [expert, skirmish] }, { choose: () => {} }),
    );
    expect(textsOf(b)).toEqual(
      expect.arrayContaining(["MODES FOR THIS ISSUE", "DIFFICULTY", "Standard set only", "SKIRMISH", "Off"]),
    );
  });

  it("says the rows in Spanish by their ids, and leaves a Roman stage and a sign as they are", () => {
    vi.stubGlobal("__CARD_LANGS__", "en,es");
    setArtLanguage("es");
    expect(modeRowTextIn(expert)).toMatchObject({ name: "Dificultad", meta: "Solo el set Estándar" });
    expect(modeRowTextIn(expert).chips.map((chip) => chip.text)).toEqual(["Estándar", "Experto"]);
    expect(modeRowTextIn(heroic)).toMatchObject({
      name: "Nivel heroico",
      meta: "2 cartas de Encuentro extra para cada uno",
    });
    expect(modeRowTextIn(heroic).chips.map((chip) => chip.text)).toEqual(["−", "2", "+"]);
    expect(modeRowTextIn(skirmish)).toMatchObject({ name: "Escaramuza", meta: "No" });
    const staged = { ...skirmish, meta: "Only stage II" };
    expect(modeRowTextIn(staged).meta).toBe("Solo la fase II");
  });
});
