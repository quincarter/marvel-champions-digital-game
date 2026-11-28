// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-pause-rules";
import type { PauseRulesInput } from "../../pause.types";
import type { PauseEventDetail } from "../../shared/pause-events.types";

afterEach(() => document.body.replaceChildren());

const input = (entries: PauseRulesInput["entries"]): PauseRulesInput => ({
  title: "Rules reference",
  filtered: "Filtered to what's on your table",
  empty: "Nothing on the table carries a keyword.",
  entries,
});

async function rules(i: PauseRulesInput) {
  const el = document.createElement("mc-pause-rules");
  el.input = i;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-pause-rules", () => {
  it("draws the title, the filter line and a card per entry", async () => {
    const el = await rules(
      input([
        { id: "stunned", term: "Stunned", definition: "x", tone: "stunned", tail: null },
        { id: "guard", term: "Guard", definition: "y", tone: "plain", tail: null },
      ]),
    );
    const root = el.shadowRoot!;
    expect(root.querySelector(".title")!.textContent).toBe("Rules reference");
    expect(root.querySelector(".filtered")!.textContent).toContain("Filtered");
    expect(root.querySelectorAll("mc-pause-keyword").length).toBe(2);
    expect(root.querySelector(".empty")).toBeNull();
  });

  it("says what is missing when there are no cards, and relays a card's press", async () => {
    const empty = await rules(input([]));
    expect(empty.shadowRoot!.querySelector(".empty")!.textContent).toContain("Nothing");
    const el = await rules(input([{ id: "guard", term: "Guard", definition: "y", tone: "plain", tail: null }]));
    const seen: PauseEventDetail[] = [];
    el.addEventListener("mc-pause", (e) => seen.push(e.detail));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="keyword:guard"]')!.click();
    expect(seen).toEqual([{ type: "keyword", id: "guard" }]);
  });
});
