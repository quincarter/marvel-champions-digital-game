import { afterEach, describe, expect, it } from "vitest";
import "./mc-picture-card.js";

afterEach(() => document.body.replaceChildren());

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-picture-card with lines, a stripe and an activate key", () => {
  const mount = async () => {
    const card = document.createElement("mc-picture-card");
    card.picture = { src: "/hero.png", cover: { x: 0.5, y: 0.3 } };
    card.lines = [
      { text: "Spider-Man", size: 14, height: 19, weight: 800 },
      { text: "Justice", size: 11, height: 14, label: true },
    ];
    card.stripe = ["#c62828", "#1565c0"];
    card.artHeight = 100;
    card.activateKey = "open:a";
    document.body.append(card);
    await card.updateComplete;
    return card;
  };

  it("draws the picture tile at its height, a stripe, its lines, and heavier frame when heavy", async () => {
    const card = await mount();
    expect(card.shadowRoot!.querySelector(".art")!.getAttribute("style")).toBe("height:100px");
    expect(card.shadowRoot!.querySelectorAll(".stripe span")).toHaveLength(2);
    expect([...card.shadowRoot!.querySelectorAll(".line")].map((l) => l.textContent)).toEqual([
      "Spider-Man",
      "Justice",
    ]);
    expect(card.artElement?.tagName).toBe("MC-PICTURE-TILE");
    expect(card.style.getPropertyValue("--mc-card-border")).toBe("2px");
    card.heavy = true;
    await card.updateComplete;
    expect(card.style.getPropertyValue("--mc-card-border")).toBe("5px");
  });

  it("raises mc-activate with its key on a tap, and takes no press without a key", async () => {
    const card = await mount();
    const keys: string[] = [];
    card.addEventListener("mc-activate", (e) => keys.push((e as CustomEvent<{ key: string }>).detail.key));
    tap(card.shadowRoot!.querySelector(".tap")!);
    expect(keys).toEqual(["open:a"]);
    card.activateKey = "";
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector(".tap")).toBeNull();
  });
});
