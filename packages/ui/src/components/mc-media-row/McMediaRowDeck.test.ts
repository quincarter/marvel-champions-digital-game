import { afterEach, describe, expect, it } from "vitest";
import "./mc-media-row.js";
import type { McMediaRow } from "./McMediaRow.js";

afterEach(() => document.body.replaceChildren());

async function row(props: Partial<McMediaRow>): Promise<McMediaRow> {
  const el = document.createElement("mc-media-row");
  Object.assign(el, {
    look: "deck",
    heading: "Spider-Man / Justice",
    meta: "Spider-Man · 40 cards · Legal",
    src: "/hero.png",
    focusX: 0.4,
    focusY: 0.1,
    fit: "cover",
    artWidth: 90,
    stamps: [{ label: "Justice", fill: "#fc0", ink: "#000" }],
    badge: "3-1",
    foot: "Never played.",
    ...props,
  });
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-media-row in the deck look", () => {
  it("draws the group label, a cropped picture tile with its stamps, the words, the corner badge and the footer", async () => {
    const el = await row({ group: "Preconstructed" });
    const root = el.shadowRoot!;
    expect(root.querySelector(".group")!.textContent).toBe("Preconstructed");
    const tile = root.querySelector("mc-picture-tile")!;
    await tile.updateComplete;
    const img = tile.shadowRoot!.querySelector("img")!;
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.style.objectPosition).toBe("40% 10%");
    expect(root.querySelector(".art")!.getAttribute("style")).toContain("width:90px");
    expect(root.querySelector(".stamp")!.textContent).toBe("Justice");
    expect(root.querySelector(".heading")!.textContent).toBe("Spider-Man / Justice");
    expect(root.querySelector(".meta")!.textContent).toContain("40 cards");
    expect(root.querySelector(".badge.corner")!.textContent).toBe("3-1");
    expect(root.querySelector(".foot")!.textContent).toBe("Never played.");
    expect(root.querySelector<HTMLElement>(".row")!.style.top).toBe("16px");
    expect(el.artElement?.tagName).toBe("MC-PICTURE-TILE");
  });

  it("starts the card 2px down with no group, and marks a chosen, a problem and a faded row with classes", async () => {
    const chosen = await row({ selected: true });
    expect(chosen.shadowRoot!.querySelector(".row")!.classList.contains("selected")).toBe(true);
    expect(chosen.shadowRoot!.querySelector<HTMLElement>(".row")!.style.top).toBe("2px");
    const bad = await row({ alert: true, dim: true });
    const card = bad.shadowRoot!.querySelector(".row")!;
    expect(card.classList.contains("alert")).toBe(true);
    expect(card.classList.contains("dim")).toBe(true);
    // A chosen row is never faded.
    const both = await row({ selected: true, dim: true });
    expect(both.shadowRoot!.querySelector(".row")!.classList.contains("dim")).toBe(false);
  });

  it("is decorative in the deck look, and has no corner badge in the pack look", async () => {
    const deck = await row({});
    expect(deck.getAttribute("look")).toBe("deck");
    const pack = await row({ look: "pack", stamps: [] });
    expect(pack.shadowRoot!.querySelector(".badge.corner")).toBeNull();
    expect(pack.shadowRoot!.querySelector(".footline .badge")!.textContent).toBe("3-1");
  });
});
