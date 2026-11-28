// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-setup-deal-bar";
import type { SetupEventDetail } from "../../shared/setup-events.types";
import type { DealBarInput } from "../mc-setup-deal-bar.types";

afterEach(() => document.body.replaceChildren());

const input = (over: Partial<DealBarInput> = {}): DealBarInput => ({
  starting: false,
  room: false,
  blocked: null,
  status: "",
  footerLine: "RHINO · STAGE I",
  ...over,
});

async function make(i: DealBarInput | null, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-setup-deal-bar");
  el.input = i;
  el.mode = mode;
  document.body.append(el);
  await el.updateComplete;
  const seen: SetupEventDetail[] = [];
  el.addEventListener("mc-setup", (e) => seen.push(e.detail));
  return { el, seen, deal: el.shadowRoot?.querySelector("mc-chip") ?? null };
}

describe("mc-setup-deal-bar", () => {
  it("draws Deal it out as a focus stop that raises deal", async () => {
    const { deal, seen } = await make(input());
    expect(deal!.getAttribute("data-stop")).toBe("deal-it-out");
    expect(deal!.getAttribute("label")).toBe("Deal it out");
    deal!.press();
    expect(seen).toEqual([{ type: "deal" }]);
  });

  it("waits while dealing and says why when blocked, pressing nothing", async () => {
    const dealing = await make(input({ starting: true }));
    expect(dealing.deal!.hasAttribute("disabled")).toBe(true);
    expect(dealing.deal!.getAttribute("label")).not.toBe("Deal it out");
    dealing.deal!.press();
    const blocked = await make(input({ blocked: "Pick 1 more modular set" }));
    expect(blocked.deal!.hasAttribute("disabled")).toBe(true);
    expect(blocked.deal!.getAttribute("title")).toBe("Pick 1 more modular set");
    blocked.deal!.press();
    expect([...dealing.seen, ...blocked.seen]).toEqual([]);
  });

  it("shows the status line over Deal, and the summary line only in the phone footer", async () => {
    const wide = await make(input({ status: "seed must be a whole number" }));
    expect(wide.el.shadowRoot!.querySelector(".status")!.textContent).toBe("seed must be a whole number");
    expect(wide.el.shadowRoot!.querySelector(".line")).toBeNull();
    const phone = await make(input(), "phone");
    expect(phone.el.shadowRoot!.querySelector(".line")!.textContent).toBe("RHINO · STAGE I");
  });

  it("says Back to the room in a room, and draws nothing without an input", async () => {
    const room = await make(input({ room: true }));
    expect(room.deal!.getAttribute("label")).not.toBe("Deal it out");
    expect((await make(null)).el.shadowRoot!.children.length).toBe(0);
  });
});
