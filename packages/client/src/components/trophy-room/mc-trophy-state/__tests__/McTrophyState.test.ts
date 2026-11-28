// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-trophy-state.js";
import type { McTrophyState } from "../McTrophyState.js";

afterEach(() => document.body.replaceChildren());

async function mount(state: McTrophyState["state"], label: string): Promise<McTrophyState> {
  const el = document.createElement("mc-trophy-state");
  el.state = state;
  el.label = label;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-trophy-state", () => {
  it("marks an earned achievement with a check as well as the word", async () => {
    const el = await mount("earned", "EARNED");
    expect(el.shadowRoot!.querySelector(".chip")!.textContent).toBe("✓ EARNED");
    expect(el.getAttribute("state")).toBe("earned");
  });

  it("says a locked or soon-to-count one in words only", async () => {
    expect((await mount("locked", "LOCKED")).shadowRoot!.querySelector(".chip")!.textContent).toBe("LOCKED");
    const soon = await mount("untracked", "SOON");
    expect(soon.shadowRoot!.querySelector(".chip")!.textContent).toBe("SOON");
    expect(soon.getAttribute("state")).toBe("untracked");
  });
});
