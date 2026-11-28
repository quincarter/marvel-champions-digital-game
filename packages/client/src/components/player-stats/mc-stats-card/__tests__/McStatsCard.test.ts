// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-card";
import type { PressDetail } from "@mc/ui";

afterEach(() => document.body.replaceChildren());

async function card() {
  const el = document.createElement("mc-stats-card");
  el.card = {
    key: "card:all:played:strip:0:01008",
    cardId: "01008",
    value: "12 played",
    detail: "In 5 games",
    picture: { src: "/c.png" },
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const heard = (el: HTMLElement): PressDetail[] => {
  const seen: PressDetail[] = [];
  el.addEventListener("mc-pressed", (e) => seen.push(e.detail));
  return seen;
};

describe("mc-stats-card", () => {
  it("is a focus stop under its key and shows its picture and what you did with it", async () => {
    const el = await card();
    const root = el.shadowRoot!;
    expect(el.getAttribute("data-stop")).toBe("card:all:played:strip:0:01008");
    expect(root.querySelector("mc-picture-tile")!.getAttribute("data-card-id")).toBe("01008");
    expect(root.querySelector(".value")!.textContent).toBe("12 played");
    expect(root.querySelector(".detail")!.textContent).toBe("In 5 games");
  });

  it("does nothing on a tap, and opens the card on Enter, Inspect and a hold", async () => {
    const el = await card();
    const seen = heard(el);
    el.press();
    expect(seen).toEqual([]);
    el.click();
    el.inspect();
    expect(seen).toEqual([
      { action: { type: "card", cardId: "01008" }, hold: true },
      { action: { type: "card", cardId: "01008" }, hold: true },
    ]);
  });
});
