import { afterEach, describe, expect, it } from "vitest";
import "../mc-qr-code";

afterEach(() => document.body.replaceChildren());

describe("mc-qr-code", () => {
  it("draws the dark modules as one path inside a quiet zone", async () => {
    const el = document.createElement("mc-qr-code");
    el.rows = ["110", "001", "100"];
    el.label = "Link";
    document.body.append(el);
    await el.updateComplete;
    const svg = el.shadowRoot!.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 11 11");
    expect(svg.getAttribute("aria-label")).toBe("Link");
    // Runs of dark modules join: "11" is one stroke 2 wide.
    expect(el.shadowRoot!.querySelector(".dark")!.getAttribute("d")).toBe("M4 4h2v1h-2zM6 5h1v1h-1zM4 6h1v1h-1z");
  });

  it("draws nothing without modules", async () => {
    const el = document.createElement("mc-qr-code");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("svg")).toBeNull();
  });
});
