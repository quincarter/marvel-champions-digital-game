// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pack-status.js";
import { mount } from "../../shared/__tests__/test-mount.js";
import type { McPackStatus } from "../McPackStatus.js";

describe("mc-pack-status", () => {
  it("says a failure with a ! mark, so it never rests on colour alone", async () => {
    const el = await mount<McPackStatus>("mc-pack-status", { status: { kind: "failure", text: "Install failed." } });
    const line = el.shadowRoot!.querySelector(".line")!;
    expect(line.textContent).toBe("! Install failed.");
    expect(line.classList.contains("failure")).toBe(true);
    el.remove();
  });

  it("says a requirement the same way, without the failure look", async () => {
    const el = await mount<McPackStatus>("mc-pack-status", { status: { kind: "requirement", text: "Needs 0.9." } });
    const line = el.shadowRoot!.querySelector(".line")!;
    expect(line.textContent).toBe("! Needs 0.9.");
    expect(line.classList.contains("failure")).toBe(false);
    el.remove();
  });

  it("shows progress with its words, its percentage and a bar", async () => {
    const el = await mount<McPackStatus>("mc-pack-status", {
      status: { kind: "progress", text: "Downloading", fraction: 0.25 },
    });
    expect(el.shadowRoot!.querySelector(".words")!.textContent).toContain("25%");
    expect(el.shadowRoot!.querySelector(".track")!.getAttribute("aria-valuenow")).toBe("25");
    el.remove();
  });

  it("draws nothing when there is nothing to say, but keeps its height", async () => {
    const el = await mount<McPackStatus>("mc-pack-status", { status: { kind: "none" } });
    expect(el.shadowRoot!.querySelector(".line, .words, .track")).toBeNull();
    el.remove();
  });
});
