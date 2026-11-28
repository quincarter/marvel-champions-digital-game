// @vitest-environment happy-dom
import "@mc/ui";
import { afterEach, describe, expect, it } from "vitest";
import "../mc-win-card";

afterEach(() => document.body.replaceChildren());

async function card(set: (el: HTMLElementTagNameMap["mc-win-card"]) => void) {
  const el = document.createElement("mc-win-card");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-win-card", () => {
  it("draws the stamp, the title, the scan and a slot for the words", async () => {
    const el = await card((c) => {
      c.tag = "WIN";
      c.tone = "heal";
      c.heading = "Knock out the villain";
      c.picture = { src: "rhino.webp", missing: "No scan" };
      c.scanKey = "scan:win";
    });
    const root = el.shadowRoot!;
    const stamp = root.querySelector("mc-stamp")!;
    expect(stamp.getAttribute("label")).toBe("WIN");
    expect(stamp.getAttribute("tone")).toBe("heal");
    expect(root.querySelector(".heading")!.textContent).toBe("Knock out the villain");
    expect(root.querySelector(".art")!.getAttribute("data-key")).toBe("scan:win");
    expect(root.querySelector("mc-picture-tile")).not.toBeNull();
    expect(root.querySelector("slot")).not.toBeNull();
  });

  it("raises the card hover events from the scan for the card it names, and none without a card", async () => {
    const el = await card((c) => {
      c.cardId = "rhino";
      c.face = { kind: "villainStage" };
      c.picture = { src: "rhino.webp" };
    });
    const seen: { cardId: string; face?: unknown }[] = [];
    el.addEventListener("mc-card-hover", (e) => seen.push(e.detail));
    const art = el.shadowRoot!.querySelector(".art")!;
    const enter = new Event("pointerenter");
    Object.defineProperty(enter, "pointerType", { value: "mouse" });
    art.dispatchEvent(enter);
    expect(seen.map((s) => s.cardId)).toEqual(["rhino"]);
    expect(seen[0]!.face).toEqual({ kind: "villainStage" });
    el.cardId = "";
    art.dispatchEvent(enter);
    expect(seen).toHaveLength(1);
  });

  it("draws no scan box content without a picture", async () => {
    const el = await card((c) => (c.picture = null));
    expect(el.shadowRoot!.querySelector("mc-picture-tile")).toBeNull();
  });
});
