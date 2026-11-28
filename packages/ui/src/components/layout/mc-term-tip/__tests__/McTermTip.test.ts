import { afterEach, describe, expect, it } from "vitest";
import "../mc-term-tip";

afterEach(() => document.body.replaceChildren());

async function tip(set: (el: HTMLElementTagNameMap["mc-term-tip"]) => void) {
  const el = document.createElement("mc-term-tip");
  set(el);
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-term-tip", () => {
  it("draws the term, its definition and the glossary link as a stop", async () => {
    const el = await tip((t) => {
      t.heading = "Threat";
      t.body = "Pressure toward the scheme. (RRG p. 1)";
      t.linkLabel = "Rules glossary";
      t.linkStop = "tip-link";
    });
    const root = el.shadowRoot!;
    expect(root.querySelector(".heading")!.textContent).toBe("Threat");
    expect(root.querySelector(".body")!.textContent).toBe("Pressure toward the scheme. (RRG p. 1)");
    expect(root.querySelector<HTMLElement>(".link")!.dataset.stop).toBe("tip-link");
  });

  it("raises mc-term-link when the link is pressed by the route (click with no pointer)", async () => {
    const el = await tip((t) => (t.linkLabel = "Rules glossary"));
    let heard = 0;
    el.addEventListener("mc-term-link", () => heard++);
    el.shadowRoot!.querySelector<HTMLElement>(".link")!.click();
    expect(heard).toBe(1);
  });

  it("is hidden until it has measured where it goes", async () => {
    const el = await tip(() => undefined);
    expect(el.shadowRoot!.querySelector<HTMLElement>(".plate")!.style.visibility).toBe("hidden");
  });
});
