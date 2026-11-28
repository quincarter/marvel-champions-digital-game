// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@mc/ui";
import "../mc-rules-scope.js";

afterEach(() => document.body.replaceChildren());

describe("mc-rules-scope", () => {
  it("shows only the caption with no game", async () => {
    const el = document.createElement("mc-rules-scope");
    el.caption = "Showing the card pool";
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".caption")!.textContent).toBe("Showing the card pool");
    expect(el.shadowRoot!.querySelector(".toggle")).toBeNull();
  });

  it("marks the chosen scope and says which one was pressed, by the focus route's click too", async () => {
    const el = document.createElement("mc-rules-scope");
    el.toggle = { scope: "table", allLabel: "All rules", tableLabel: "On your table" };
    document.body.append(el);
    await el.updateComplete;
    const [all, table] = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".option")];
    expect(all!.dataset.stop).toBe("scope:all");
    expect(table!.classList.contains("on")).toBe(true);
    const heard = vi.fn();
    el.addEventListener("mc-rules", (event) => heard(event.detail));
    all!.click();
    expect(heard).toHaveBeenCalledWith({ type: "scope", scope: "all" });
  });
});
