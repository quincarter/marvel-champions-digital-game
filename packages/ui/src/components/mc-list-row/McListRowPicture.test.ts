import { afterEach, describe, expect, it } from "vitest";
import "./mc-list-row.js";

afterEach(() => document.body.replaceChildren());

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-list-row as a picture row", () => {
  const mount = async () => {
    const row = document.createElement("mc-list-row");
    row.picture = { src: "/hero.png", cover: { x: 0.5, y: 0.3 } };
    row.lines = [{ text: "Deck A", size: 14, height: 19 }];
    row.activateKey = "open:a";
    const pick = document.createElement("button");
    pick.slot = "trailing";
    row.append(pick);
    document.body.append(row);
    await row.updateComplete;
    return row;
  };

  it("composes its picture from mc-picture-tile, reflects rich, and offers a trailing slot", async () => {
    const row = await mount();
    expect(row.hasAttribute("rich")).toBe(true);
    expect(row.artElement?.tagName).toBe("MC-PICTURE-TILE");
    expect(row.shadowRoot!.querySelector("slot[name=trailing]")).not.toBeNull();
    expect(row.shadowRoot!.querySelector(".badge")).toBeNull();
    expect([...row.shadowRoot!.querySelectorAll(".line")].map((l) => l.textContent)).toEqual(["Deck A"]);
  });

  it("raises mc-activate on a tap of the row, and uses the heavy frame", async () => {
    const row = await mount();
    const keys: string[] = [];
    row.addEventListener("mc-activate", (e) => keys.push((e as CustomEvent<{ key: string }>).detail.key));
    tap(row.shadowRoot!.querySelector(".tap")!);
    expect(keys).toEqual(["open:a"]);
    row.heavy = true;
    await row.updateComplete;
    expect(row.style.getPropertyValue("--mc-row-border")).toBe("5px");
  });

  it("goes back to a badge row when it has only a model", async () => {
    const row = document.createElement("mc-list-row");
    row.model = { leading: "✓", title: "T", detail: "d", open: true, active: false };
    document.body.append(row);
    await row.updateComplete;
    expect(row.hasAttribute("rich")).toBe(false);
    expect(row.shadowRoot!.querySelector(".badge")!.textContent).toBe("✓");
  });
});
