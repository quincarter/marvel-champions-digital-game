// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-trophy-group.js";

afterEach(() => document.body.replaceChildren());

describe("mc-trophy-group", () => {
  it("says the pack in capitals and how many it has earned, and takes no stop", async () => {
    const el = document.createElement("mc-trophy-group");
    el.model = { kind: "group", id: "silly", title: "Silly pack", count: "1 of 3" };
    el.label = "From Silly pack";
    document.body.append(el);
    await el.updateComplete;
    const heading = el.shadowRoot!.querySelector<HTMLElement & { label: string; right: string }>("mc-section-heading")!;
    expect(heading.label).toBe("FROM SILLY PACK");
    expect(heading.right).toBe("1 of 3");
    expect(el.hasAttribute("data-stop")).toBe(false);
  });

  it("draws nothing without a model", async () => {
    const el = document.createElement("mc-trophy-group");
    document.body.append(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("mc-section-heading")).toBeNull();
  });
});
