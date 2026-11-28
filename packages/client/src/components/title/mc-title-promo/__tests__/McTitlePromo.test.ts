// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-title-promo.js";
import type { TitlePromoInput } from "../mc-title-promo.types.js";

afterEach(() => document.body.replaceChildren());

const input = (over: Partial<TitlePromoInput> = {}): TitlePromoInput => ({
  variant: "art",
  title: "Jugar en línea",
  pitch: "Crea una sala o únete a amigos.",
  live: "3 en vivo",
  host: "Crear sala",
  join: "Unirse",
  available: true,
  ...over,
});

async function promo(value: TitlePromoInput) {
  const el = document.createElement("mc-title-promo");
  el.input = value;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-title-promo", () => {
  it("draws the title in capitals on one line, the pitch, the live chip in words and both keyed buttons", async () => {
    const root = (await promo(input())).shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("JUGAR EN LÍNEA!");
    expect(root.querySelector(".pitch")!.textContent).toBe("Crea una sala o únete a amigos.");
    expect(root.querySelector(".chip")!.textContent).toBe("3 en vivo");
    expect([...root.querySelectorAll("mc-button")].map((b) => b.getAttribute("data-stop"))).toEqual([
      "play-online-host",
      "play-online-join",
    ]);
  });

  it("breaks the side title over two lines and draws the table of seats", async () => {
    const root = (await promo(input({ variant: "side" }))).shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("JUGAR EN\nLÍNEA!");
    expect(root.querySelector(".seats")).not.toBeNull();
  });

  it("dims and disables its buttons while offline, and draws no chip without a count", async () => {
    const el = await promo(input({ available: false, live: null }));
    expect(el.hasAttribute("unavailable")).toBe(true);
    expect(el.shadowRoot!.querySelector("mc-button")!.hasAttribute("disabled")).toBe(true);
    expect(el.shadowRoot!.querySelector(".chip")).toBeNull();
  });
});
