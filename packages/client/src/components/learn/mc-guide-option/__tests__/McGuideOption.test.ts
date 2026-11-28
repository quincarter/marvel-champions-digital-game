// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-guide-option";
import type { GuideOptionModel } from "../mc-guide-option.types";

afterEach(() => document.body.replaceChildren());

const FULL: GuideOptionModel = {
  value: "full",
  label: "Learn as you play",
  body: "A real first game against Rhino.",
  selected: true,
  recommended: true,
  recommendedLabel: "RECOMMENDED",
};

async function option(model: GuideOptionModel) {
  const el = document.createElement("mc-guide-option");
  el.model = model;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-guide-option", () => {
  it("draws its name and line, its stop and its chosen state three ways", async () => {
    const el = await option(FULL);
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("Learn as you play");
    expect(root.querySelector(".body")!.textContent).toBe("A real first game against Rhino.");
    expect(el.dataset.stop).toBe("option:full");
    expect(el.getAttribute("role")).toBe("radio");
    expect(el.getAttribute("aria-checked")).toBe("true");
    expect(el.hasAttribute("selected")).toBe(true);
    expect(root.querySelector(".radio")!.hasAttribute("data-on")).toBe(true);
  });

  it("stamps the guide's pick RECOMMENDED and no other", async () => {
    const full = await option(FULL);
    expect(full.shadowRoot!.querySelector("mc-stamp")!.getAttribute("label")).toBe("RECOMMENDED");
    const off = await option({ ...FULL, value: "off", selected: false, recommended: false });
    expect(off.shadowRoot!.querySelector("mc-stamp")).toBeNull();
    expect(off.getAttribute("aria-checked")).toBe("false");
  });

  it("raises its level as the pressed action", async () => {
    const el = await option({ ...FULL, value: "hints", selected: false });
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent).detail));
    el.click();
    expect(seen).toEqual([{ action: { type: "option", value: "hints" }, hold: false }]);
  });
});
