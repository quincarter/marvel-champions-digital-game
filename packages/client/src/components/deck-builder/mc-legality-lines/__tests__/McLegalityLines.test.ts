// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { inner, mount } from "../../shared/test-support.js";
import "../mc-legality-lines.js";
import type { McLegalityLines } from "../McLegalityLines.js";
import type { LegalityModel } from "../mc-legality-lines.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<LegalityModel> = {}): LegalityModel => ({
  text: "Legal: 40 cards",
  ok: true,
  frozen: null,
  dirty: null,
  status: null,
  ...over,
});

describe("mc-legality-lines", () => {
  it("says a legal deck in words, marked ok", async () => {
    const el = await mount<McLegalityLines>("mc-legality-lines", { model: model() });
    expect(inner(el, ".verdict")!.textContent).toBe("Legal: 40 cards");
    expect(inner(el, ".verdict")!.classList.contains("ok")).toBe(true);
  });

  it("says the problems in words, not marked ok", async () => {
    const el = await mount<McLegalityLines>("mc-legality-lines", {
      model: model({ ok: false, text: "2 problems: Too few cards." }),
    });
    expect(inner(el, ".verdict")!.classList.contains("ok")).toBe(false);
    expect(inner(el, ".verdict")!.textContent).toContain("2 problems");
  });

  it("adds a campaign's frozen reason, the unsaved note and the status when there are any", async () => {
    const el = await mount<McLegalityLines>("mc-legality-lines", {
      model: model({ frozen: "Frozen", dirty: "Unsaved changes", status: "Saved" }),
    });
    expect(inner(el, ".frozen")!.textContent).toBe("Frozen");
    expect(inner(el, ".dirty")!.textContent).toBe("Unsaved changes");
    expect(inner(el, ".status")!.textContent).toBe("Saved");
  });
});
