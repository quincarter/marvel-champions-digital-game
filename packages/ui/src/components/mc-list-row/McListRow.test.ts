import { afterEach, describe, expect, it } from "vitest";
import "./mc-list-row.js";

afterEach(() => document.body.replaceChildren());

describe("mc-list-row", () => {
  it("marks a closed row (dim title, red detail) and the active row", async () => {
    const row = document.createElement("mc-list-row");
    document.body.append(row);
    row.model = { leading: "▶", title: "Song", detail: "Beat Rhino", open: false, active: false };
    await row.updateComplete;
    expect(row.classList.contains("closed")).toBe(true);
    expect(row.shadowRoot!.querySelector(".detail.alert")!.textContent).toBe("Beat Rhino");
    row.model = { leading: "■", title: "Song", detail: "Now playing", open: true, active: true };
    await row.updateComplete;
    expect(row.classList.contains("active")).toBe(true);
    expect(row.classList.contains("closed")).toBe(false);
    expect(row.shadowRoot!.querySelector(".badge")!.textContent).toBe("■");
  });

  it("draws nothing without a model", async () => {
    const row = document.createElement("mc-list-row");
    document.body.append(row);
    await row.updateComplete;
    expect(row.shadowRoot!.querySelector(".badge")).toBeNull();
  });
});
