// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount, press, tap } from "../../shared/test-support.js";
import "../mc-identity-tile.js";
import type { McIdentityTile } from "../McIdentityTile.js";
import type { PressDetail } from "@mc/ui";

afterEach(() => document.body.replaceChildren());

const model = { id: "01001a", name: "Spider-Man", picture: { src: "a.png" } };

const heard = (el: HTMLElement): PressDetail[] => {
  const seen: PressDetail[] = [];
  el.addEventListener("mc-pressed", (e) => seen.push((e as CustomEvent<PressDetail>).detail));
  return seen;
};

describe("mc-identity-tile", () => {
  it("is the identity:<id> stop and shows the name over the art", async () => {
    const el = await mount<McIdentityTile>("mc-identity-tile", { model });
    expect(el.dataset.stop).toBe("identity:01001a");
    expect(inner(el, ".bar")!.textContent).toBe("Spider-Man");
    expect(inner(el, "mc-card-art")!.getAttribute("card-id")).toBe("01001a");
  });

  it("picks the hero on a tap and on the route's Enter, and inspects on the route's Inspect", async () => {
    const el = await mount<McIdentityTile>("mc-identity-tile", { model });
    const seen = heard(el);
    tap(el);
    press(el);
    el.inspect();
    expect(seen).toEqual([
      { action: { type: "pick-hero", id: "01001a" }, hold: false },
      { action: { type: "pick-hero", id: "01001a" }, hold: false },
      { action: { type: "hero-inspect", id: "01001a" }, hold: true },
    ]);
  });
});
