import { afterEach, describe, expect, it } from "vitest";
import "./mc-footer-bar.js";
import type { FooterBarModel } from "./mc-footer-bar.types.js";

afterEach(() => document.body.replaceChildren());

const model = (over: Partial<FooterBarModel> = {}): FooterBarModel => ({
  note: "1065 / 3678 cartas listas",
  version: "v1.0.0+abc1234",
  links: [
    { key: "credits", label: "Créditos" },
    { key: "privacy", label: "Privacidad" },
  ],
  aside: null,
  ...over,
});

async function mount(m: FooterBarModel | null) {
  const el = document.createElement("mc-footer-bar");
  el.model = m;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

function tap(element: Element): void {
  const at = { bubbles: true, composed: true, clientX: 5, clientY: 5, pointerId: 1, button: 0 };
  element.dispatchEvent(new PointerEvent("pointerdown", at));
  element.dispatchEvent(new PointerEvent("pointerup", at));
}

describe("mc-footer-bar", () => {
  it("says the note, the version and each link, and finds a link's element by its key", async () => {
    const el = await mount(model());
    const root = el.shadowRoot!;
    expect(root.querySelector(".note")!.textContent).toBe("1065 / 3678 cartas listas");
    expect(root.querySelector(".version")!.textContent).toBe("v1.0.0+abc1234");
    expect([...root.querySelectorAll(".link")].map((l) => l.textContent!.trim())).toEqual(["Créditos", "Privacidad"]);
    expect(el.elementOf("credits")).not.toBeNull();
    expect(el.elementOf("nope")).toBeNull();
  });

  it("reports a tap on a link with its key", async () => {
    const el = await mount(model());
    const seen: string[] = [];
    el.addEventListener("mc-activate", (e) => seen.push((e as CustomEvent<{ key: string }>).detail.key));
    tap(el.elementOf("privacy")!);
    expect(seen).toEqual(["privacy"]);
  });

  it("hangs an aside line above the right end only when there is one, and reflects its ground", async () => {
    const plain = await mount(model());
    expect(plain.shadowRoot!.querySelector(".aside")).toBeNull();
    const aside = await mount(model({ aside: "Modo de ahorro de energía activado" }));
    expect(aside.shadowRoot!.querySelector(".aside")!.textContent).toBe("Modo de ahorro de energía activado");
    aside.ground = "ink";
    await aside.updateComplete;
    expect(aside.getAttribute("ground")).toBe("ink");
    expect((await mount(null)).shadowRoot!.querySelector(".note")).toBeNull();
  });
});
