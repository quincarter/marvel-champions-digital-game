// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-setup-encounter";
import type { EncounterInput } from "../mc-setup-encounter.types";

afterEach(() => document.body.replaceChildren());

const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `Row ${i}`, count: i + 1, red: false }));
const input = (over: Partial<EncounterInput> = {}): EncounterInput => ({
  composition: [...rows(2), { label: "Obligations (shuffled in)", count: 2, red: true }],
  whatsInThere: rows(3),
  nemesis: { sentence: "Nemesis cards stay out.", totalCards: 10 },
  deckSize: 30,
  ...over,
});

async function make(i: EncounterInput | null, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-setup-encounter");
  el.input = i;
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-setup-encounter", () => {
  it("draws Composition, What's in there and the nemesis panel, the obligations row in red, and the deck size", async () => {
    const el = await make(input());
    const root = el.shadowRoot!;
    expect(root.querySelectorAll(".panel").length).toBe(3);
    expect(root.querySelector(".red")!.textContent).toContain("Obligations");
    expect(root.querySelector(".red .count")!.textContent).toBe("2");
    expect(root.querySelector(".nemesis")!.textContent).toContain("Nemesis cards stay out.");
    expect(root.querySelector(".nemesis .foot")!.textContent).toContain("10");
    expect(root.querySelector("mc-section-heading")!.getAttribute("right")).toContain("30");
  });

  it("says the nemesis sets are not used when none are held back, and prints a count's own words in its place", async () => {
    const el = await make(
      input({ nemesis: null, composition: [{ label: "Minions", count: 3, red: false, shown: "hidden" }] }),
    );
    expect(el.shadowRoot!.querySelector(".nemesis .quiet")).not.toBeNull();
    expect(el.shadowRoot!.querySelector(".count")!.textContent).toBe("hidden");
  });

  it("draws one panel with a rule between its two lists and a standby line on a phone", async () => {
    const el = await make(input(), "phone");
    const root = el.shadowRoot!;
    expect(root.querySelectorAll(".panel").length).toBe(1);
    expect(root.querySelector("hr")).not.toBeNull();
    expect(root.querySelectorAll(".row").length).toBe(6);
    expect(root.querySelector(".foot")!.textContent).toContain("10");
  });

  it("draws nothing without an input", async () => {
    expect((await make(null)).shadowRoot!.children.length).toBe(0);
  });
});
