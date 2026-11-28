// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-setup-seat";
import type { SeatInput } from "../mc-setup-seat.types";

afterEach(() => document.body.replaceChildren());

const input = (selected: boolean): SeatInput => ({
  seat: {
    index: 1,
    name: "Captain Marvel",
    meta: selected ? "First player" : "Seat 2",
    chipLabel: "S2",
    selected,
    identityCardId: "01010a",
  },
  picture: { src: "cm.jpg" },
});

async function make(i: SeatInput | null, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-setup-seat");
  el.input = i;
  el.mode = mode;
  el.action = { type: "seat-pick", index: 1 };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-setup-seat", () => {
  it("shows the hero's name over its seat line on wide, and reflects whether it holds the token", async () => {
    const el = await make(input(true));
    const root = el.shadowRoot!;
    expect(root.querySelector(".name")!.textContent).toBe("Captain Marvel");
    expect(root.querySelector(".label")!.textContent).toBe("First player");
    expect(el.hasAttribute("selected")).toBe(true);
    expect(root.querySelector("slot[name=token]")).not.toBeNull();
    expect((await make(input(false))).hasAttribute("selected")).toBe(false);
  });

  it("shows the chip label over the hero's name on a phone", async () => {
    const el = await make(input(false), "phone");
    expect(el.shadowRoot!.querySelector(".name")!.textContent).toBe("S2");
    expect(el.shadowRoot!.querySelector(".label")!.textContent).toBe("Captain Marvel");
  });

  it("is a press that raises its action, and draws nothing without an input", async () => {
    const el = await make(input(false));
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail.action));
    el.press();
    expect(seen).toEqual([{ type: "seat-pick", index: 1 }]);
    expect((await make(null)).shadowRoot!.children.length).toBe(0);
  });

  it("raises the identity card's hover from the hero's picture for a mouse", async () => {
    const el = await make(input(false));
    const hovered: string[] = [];
    el.addEventListener("mc-card-hover", (e) => hovered.push(e.detail.cardId));
    el.shadowRoot!.querySelector(".avatar")!.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
    expect(hovered).toEqual(["01010a"]);
  });
});
