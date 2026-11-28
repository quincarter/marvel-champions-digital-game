import { afterEach, describe, expect, it } from "vitest";
import "../mc-tip-plate.js";
import type { McTipPlate } from "../McTipPlate.js";
import { stop, tap } from "../../../shared/test-tap.js";

afterEach(() => document.body.replaceChildren());

async function mount(set: Partial<McTipPlate> = {}): Promise<McTipPlate> {
  const plate = document.createElement("mc-tip-plate") as McTipPlate;
  Object.assign(plate, {
    heading: "Justice",
    tagline: "Thwarting",
    body: "Pick it when the villain schemes fast.",
    linkLabel: "Aspects ▸",
    linkAvailable: true,
    linkStop: "aspect-tip-link",
    ...set,
  });
  document.body.append(plate);
  await plate.updateComplete;
  return plate;
}

const events = (plate: McTipPlate): string[] => {
  const seen: string[] = [];
  plate.addEventListener("mc-tip-link", () => seen.push("link"));
  plate.addEventListener("mc-tip-close", () => seen.push("close"));
  return seen;
};

describe("mc-tip-plate", () => {
  it("shows the name, tagline and tip, and places itself once measured", async () => {
    const plate = await mount();
    const root = plate.shadowRoot!;
    expect(root.querySelector(".heading")!.textContent).toBe("Justice");
    expect(root.querySelector(".tagline")!.textContent).toBe("Thwarting");
    expect(root.querySelector(".body")!.textContent).toContain("villain schemes fast");
    await plate.updateComplete;
    expect(plate.placement).not.toBeNull();
  });

  it("raises the link on a tap and on Enter on its stop", async () => {
    const plate = await mount();
    const seen = events(plate);
    tap(stop(plate, "aspect-tip-link"));
    stop(plate, "aspect-tip-link").click();
    expect(seen).toEqual(["link", "link"]);
  });

  it("closes on a tap on the backdrop, which sits over the screen so nothing beneath is pressed", async () => {
    const plate = await mount();
    const seen = events(plate);
    tap(plate.shadowRoot!.querySelector(".backdrop")!);
    expect(seen).toEqual(["close"]);
  });

  it("does not close on a tap on the plate itself", async () => {
    const plate = await mount();
    const seen = events(plate);
    tap(plate.shadowRoot!.querySelector(".plate")!);
    expect(seen).toEqual([]);
  });

  it("shows a link that is not live with its reason, as no stop and no press", async () => {
    const plate = await mount({ linkAvailable: false, linkReason: "Coming soon" });
    const seen = events(plate);
    const link = plate.shadowRoot!.querySelector(".link")!;
    expect(link.textContent).toBe("Aspects ▸ · Coming soon");
    expect(() => stop(plate, "aspect-tip-link")).toThrow();
    tap(link);
    expect(seen).toEqual([]);
  });
});
