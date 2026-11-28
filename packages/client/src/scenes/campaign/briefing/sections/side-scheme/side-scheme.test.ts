// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { campaignCardsById } from "../../../../../content/campaign-pool.js";
import type { SideSchemeBriefing, SideSchemeRow } from "../../../../../view/campaign-side-scheme-model.js";
import { bangersMock, recorder, sectionHarness, textsOf } from "../sections.test-support.js";
import { drawSideScheme, hasSideScheme } from "./side-scheme.js";

vi.mock("phaser", () => ({ default: {}, Scene: class {} }));
vi.mock("../../../../../ui/campaign-chrome.js", () => bangersMock);
vi.mock("../../../../../dom/ui-layer.js", () => ({ uiLayer: () => document.body }));

const [a, b, c] = [...campaignCardsById().values()];
const ref = (card: NonNullable<typeof a>): { cardId: typeof card.id; name: string } => ({
  cardId: card.id,
  name: card.name,
});
const chosen: SideSchemeRow = { name: "Mission Prep", scheme: ref(a!), environment: ref(b!), encounterCard: ref(c!) };
const brief = (over: Partial<SideSchemeBriefing> = {}): SideSchemeBriefing => ({
  nodeId: "n",
  scenarioNumber: 2,
  instructionId: "i",
  text: "",
  citation: "",
  offered: [],
  chosen,
  repeated: false,
  requiredSetIds: [],
  carryIns: [],
  ...over,
});

describe("the settled side scheme", () => {
  it("shows only with a chosen scheme or fixed sets", () => {
    expect(hasSideScheme(brief())).toBe(true);
    expect(hasSideScheme(brief({ chosen: null }))).toBe(false);
    expect(hasSideScheme(brief({ chosen: null, requiredSetIds: ["x"] }))).toBe(true);
  });

  it("draws the chosen row's cards as pictures that read the card and answer nothing", () => {
    const h = sectionHarness();
    const { b: out } = h.run((base) =>
      drawSideScheme({ ...base, scheme: brief({ repeated: true }), setNameOf: (id) => id }, recorder()),
    );
    expect(h.stopKeys()).toEqual(["scheme-chosen:scheme", "scheme-chosen:environment", "scheme-chosen:encounter"]);
    expect(textsOf(out)).toEqual(expect.arrayContaining(["SIDE SCHEME", "SAME AS LAST TIME"]));
    h.press("scheme-chosen:scheme");
    expect(h.inspected.map((open) => open.cardId)).toEqual([a!.id]);
    expect(h.answers).toEqual([]);
  });

  it("lists what carries in as Inspect chips, a repeat as ×2, and names the fixed sets", () => {
    const h = sectionHarness();
    const seen = recorder();
    const carry = { key: "k", title: "Carried", detail: "Two cards.", cards: [ref(a!), ref(a!), ref(b!)] };
    const { b: out } = h.run((base) =>
      drawSideScheme(
        {
          ...base,
          scheme: brief({ chosen: null, carryIns: [carry], requiredSetIds: ["s1", "s2"] }),
          setNameOf: (id) => `Set ${id}`,
        },
        seen,
      ),
    );
    expect(h.stopKeys()).toEqual([`carry:k:${a!.id}`, `carry:k:${b!.id}`]);
    expect(out.nodes.some((node) => node.kind === "button" && node.label === `${a!.name} ×2`)).toBe(true);
    expect(textsOf(out)).toContain("Set s1, Set s2");
    h.press(`carry:k:${a!.id}`);
    expect(seen.cards.map((card) => card.cardId)).toEqual([a!.id]);
  });
});
