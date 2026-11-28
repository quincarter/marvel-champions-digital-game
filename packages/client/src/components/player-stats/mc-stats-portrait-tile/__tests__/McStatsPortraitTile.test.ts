// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-stats-portrait-tile";

afterEach(() => document.body.replaceChildren());

async function tile(variant: "hero" | "stack", extra = "") {
  const el = document.createElement("mc-stats-portrait-tile");
  el.stop = "tile:hero";
  el.variant = variant;
  el.label = "Favorite hero";
  el.name = "Spider-Man";
  el.detail = "9 games · 7 won";
  el.extra = extra;
  el.picture = { src: "/hero.png", cover: { x: 0.5, y: 0.2 } };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-portrait-tile", () => {
  it("gives the picture to a picture tile and the words under it", async () => {
    const el = await tile("stack", "Best against Rhino");
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-picture-tile")!.picture!.src).toBe("/hero.png");
    expect(root.querySelector(".caption")!.textContent).toBe("Favorite hero");
    expect(root.querySelector(".name")!.textContent).toBe("Spider-Man");
    expect(root.querySelector(".extra")!.textContent).toBe("Best against Rhino");
  });

  it("leaves the extra line out when there is none, and reflects the variant", async () => {
    const el = await tile("hero");
    expect(el.getAttribute("variant")).toBe("hero");
    expect(el.shadowRoot!.querySelector(".extra")).toBeNull();
  });
});
