import { describe, expect, it } from "vitest";
import "./mc-aspect-chip.js";

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

async function chip(props: Partial<{ aspect: string; label: string; pressable: boolean; height: number }>) {
  const el = document.createElement("mc-aspect-chip");
  Object.assign(el, props);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-aspect-chip", () => {
  it("is a decorative span with the translated label and the aspect's fill and ink", async () => {
    const el = await chip({ aspect: "justice", label: "Justicia" });
    const inner = el.shadowRoot!.querySelector<HTMLElement>(".chip")!;
    expect(inner.tagName).toBe("SPAN");
    expect(inner.getAttribute("role")).toBeNull();
    expect(inner.textContent?.trim()).toBe("Justicia");
    expect(inner.getAttribute("style")).toContain("--mc-fill-justice");
    expect(inner.getAttribute("style")).toContain("--mc-text-on-justice");
    el.remove();
  });

  it("is sized by its properties", async () => {
    const el = await chip({ aspect: "pool", label: "'Pool", height: 24 });
    expect(el.shadowRoot!.querySelector<HTMLElement>(".chip")!.getAttribute("style")).toContain("--chip-height:24px");
    el.remove();
  });

  it("does nothing on a tap unless pressable", async () => {
    const el = await chip({ aspect: "justice", label: "Justice" });
    let fired = 0;
    el.addEventListener("mc-activate", () => fired++);
    tap(el.shadowRoot!.querySelector(".chip")!);
    expect(fired).toBe(0);
    el.remove();
  });

  it("is a button that raises mc-activate on a tap when pressable", async () => {
    const el = await chip({ aspect: "aggression", label: "Aggression", pressable: true });
    el.value = "aggression";
    const keys: string[] = [];
    el.addEventListener("mc-activate", (e) => keys.push((e as CustomEvent<{ key: string }>).detail.key));
    const inner = el.shadowRoot!.querySelector(".chip")!;
    expect(inner.tagName).toBe("BUTTON");
    tap(inner);
    expect(keys).toEqual(["aggression"]);
    el.remove();
  });
});
