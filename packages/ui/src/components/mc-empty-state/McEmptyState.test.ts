import { afterEach, describe, expect, it } from "vitest";
import "./mc-empty-state.js";

afterEach(() => document.body.replaceChildren());

describe("mc-empty-state", () => {
  it("says its message at its size, as a status", async () => {
    const empty = document.createElement("mc-empty-state");
    empty.message = "Nothing here yet.";
    empty.size = 16;
    document.body.append(empty);
    await empty.updateComplete;
    const line = empty.shadowRoot!.querySelector(".message")!;
    expect(line.textContent).toBe("Nothing here yet.");
    expect(line.getAttribute("role")).toBe("status");
    expect(empty.style.getPropertyValue("--mc-empty-size")).toBe("16px");
    expect(empty.shadowRoot!.querySelector(".detail")).toBeNull();
  });

  it("adds a smaller second line when there is a detail, and centers when asked", async () => {
    const empty = document.createElement("mc-empty-state");
    empty.message = "Nothing matches";
    empty.detail = "Clear a filter";
    empty.align = "center";
    document.body.append(empty);
    await empty.updateComplete;
    expect(empty.shadowRoot!.querySelector(".detail")?.textContent).toBe("Clear a filter");
    expect(empty.getAttribute("align")).toBe("center");
  });
});
