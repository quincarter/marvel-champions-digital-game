// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-title-notice-bar.js";

afterEach(() => document.body.replaceChildren());

async function bar(glyph = false) {
  const el = document.createElement("mc-title-notice-bar");
  el.input = {
    tag: "NUEVO",
    message: "Novedades de v1.2.0",
    link: "Leer más ↗",
    linkShort: "↗",
    glyph: glyph ? { specs: [], height: 16, ground: "ink", openness: 1 } : null,
  };
  el.action = "release-notice";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-title-notice-bar", () => {
  it("says its tag, message and both link forms in words", async () => {
    const el = await bar();
    const root = el.shadowRoot!;
    expect(root.querySelector(".tag")!.textContent).toBe("NUEVO");
    expect(root.querySelector(".message")!.textContent).toBe("Novedades de v1.2.0");
    expect(root.querySelector(".full")!.textContent).toBe("Leer más ↗");
    expect(root.querySelector(".short")!.textContent).toBe("↗");
  });

  it("hangs the glyph only while it has one", async () => {
    expect((await bar()).shadowRoot!.querySelector("mc-glyph-hint")).toBeNull();
    expect((await bar(true)).shadowRoot!.querySelector("mc-glyph-hint")).not.toBeNull();
  });

  it("raises its key as the action on click(), as the focus route presses it", async () => {
    const el = await bar();
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail.action));
    el.click();
    expect(seen).toEqual(["release-notice"]);
  });
});
