// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-detail-fact.js";
import type { McDetailFact } from "../McDetailFact.js";

afterEach(() => document.body.replaceChildren());

describe("mc-detail-fact", () => {
  it("shows its label over its words, and follows a change", async () => {
    const fact = document.createElement("mc-detail-fact") as McDetailFact;
    fact.label = "Obligation";
    fact.text = "Hero Obligation: Financial Woes";
    document.body.append(fact);
    await fact.updateComplete;
    expect(fact.shadowRoot!.querySelector(".label")!.textContent).toBe("Obligation");
    expect(fact.shadowRoot!.querySelector(".text")!.textContent).toBe("Hero Obligation: Financial Woes");
    fact.text = "Obligación";
    await fact.updateComplete;
    expect(fact.shadowRoot!.querySelector(".text")!.textContent).toBe("Obligación");
  });
});
