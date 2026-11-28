import { afterEach, describe, expect, it } from "vitest";
import "../mc-toast.js";

afterEach(() => document.body.replaceChildren());

describe("mc-toast", () => {
  it("says its text, and nothing while the text is empty", async () => {
    const el = document.createElement("mc-toast");
    document.body.append(el);
    await el.updateComplete;
    expect(el.hidden).toBe(true);
    expect(el.shadowRoot!.querySelector(".note")).toBeNull();
    el.text = "Link copied";
    await el.updateComplete;
    expect(el.hidden).toBe(false);
    expect(el.shadowRoot!.querySelector(".note")!.textContent).toBe("Link copied");
    expect(el.getAttribute("role")).toBe("status");
  });
});
