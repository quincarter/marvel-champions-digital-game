// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-stats-record-tile";

afterEach(() => document.body.replaceChildren());

async function tile(fraction: number) {
  const el = document.createElement("mc-stats-record-tile");
  el.stop = "tile:record";
  el.caption = "Wins–losses";
  el.record = "12–5";
  el.rate = "71% win rate";
  el.fraction = fraction;
  el.detail = "Best streak 4";
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-stats-record-tile", () => {
  it("says the record, the rate and the streak, and is a focus stop", async () => {
    const el = await tile(0.7);
    const root = el.shadowRoot!;
    expect(el.getAttribute("data-stop")).toBe("tile:record");
    expect(root.querySelector(".record")!.textContent).toBe("12–5");
    expect([...root.querySelectorAll(".caption")].map((c) => c.textContent)).toEqual(["Wins–losses", "71% win rate"]);
    expect(root.querySelector(".body")!.textContent).toBe("Best streak 4");
  });

  it("fills the track to the share won, and not at all with none", async () => {
    const el = await tile(0.7);
    expect(el.shadowRoot!.querySelector<HTMLElement>(".fill")!.style.width).toBe("70%");
    const none = await tile(0);
    expect(none.shadowRoot!.querySelector(".fill")).toBeNull();
  });
});
