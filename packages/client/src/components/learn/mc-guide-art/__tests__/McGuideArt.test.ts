// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-guide-art";

afterEach(() => document.body.replaceChildren());

async function art(set: (el: HTMLElementTagNameMap["mc-guide-art"]) => void) {
  const el = document.createElement("mc-guide-art");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-guide-art", () => {
  it("draws the picture, a scrim and the banner's words in a span", async () => {
    const el = await art((a) => {
      a.heading = "NEW TO THE FIGHT?";
      a.picture = { src: "title.webp", cover: { x: 0.5, y: 0.5 } };
    });
    const root = el.shadowRoot!;
    expect(root.querySelector("mc-picture-tile")).not.toBeNull();
    expect(root.querySelector(".scrim")).not.toBeNull();
    expect(root.querySelector(".words")!.textContent).toBe("NEW TO THE FIGHT?");
  });

  it("stands alone on its ground with no picture and reflects the wide panel", async () => {
    const el = await art((a) => {
      a.heading = "¿NUEVO EN LA LUCHA?";
      a.wide = true;
    });
    expect(el.shadowRoot!.querySelector("mc-picture-tile")).toBeNull();
    expect(el.hasAttribute("wide")).toBe(true);
  });
});
