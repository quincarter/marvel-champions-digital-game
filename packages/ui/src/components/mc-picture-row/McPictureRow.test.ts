import { afterEach, describe, expect, it } from "vitest";
import "./mc-picture-row.js";
import type { McPictureRowModel } from "./mc-picture-row.types.js";

afterEach(() => document.body.replaceChildren());

const model: McPictureRowModel = {
  group: "Preconstructed",
  title: "Spider-Man / Justice",
  meta: "Spider-Man · 40 cards · Legal",
  picture: { src: "/hero.png", focus: { x: 0.4, y: 0.1 }, width: 90 },
  stamps: [{ label: "Justice", fill: "#fc0", ink: "#000" }],
  badge: "3-1",
  footer: "Never played.",
  selected: false,
  alert: false,
  dim: false,
};

async function row(m: McPictureRowModel) {
  const el = document.createElement("mc-picture-row");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-picture-row", () => {
  it("draws the group label, a lazy cropped picture with its stamps, the words, the badge and the footer", async () => {
    const el = await row(model);
    const root = el.shadowRoot!;
    expect(root.querySelector(".group")!.textContent).toBe("Preconstructed");
    const img = root.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.style.objectPosition).toBe("40% 10%");
    expect(root.querySelector(".stamp")!.textContent).toBe("Justice");
    expect(root.querySelector(".title")!.textContent).toBe("Spider-Man / Justice");
    expect(root.querySelector(".meta")!.textContent).toContain("40 cards");
    expect(root.querySelector(".badge")!.textContent).toBe("3-1");
    expect(root.querySelector(".footer")!.textContent).toBe("Never played.");
    expect(root.querySelector<HTMLElement>(".card")!.style.top).toBe("16px");
  });

  it("marks a chosen, a problem and a faded row with classes the stylesheet reads", async () => {
    const { group: _group, ...ungrouped } = model;
    const chosen = await row({ ...ungrouped, selected: true });
    expect(chosen.shadowRoot!.querySelector(".card")!.classList.contains("selected")).toBe(true);
    expect(chosen.shadowRoot!.querySelector<HTMLElement>(".card")!.style.top).toBe("2px");
    const bad = await row({ ...model, alert: true, dim: true });
    const card = bad.shadowRoot!.querySelector(".card")!;
    expect(card.classList.contains("alert")).toBe(true);
    expect(card.classList.contains("dim")).toBe(true);
  });
});
