// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "../mc-title-footer.js";

afterEach(() => document.body.replaceChildren());

async function footer(aside: string | null = null) {
  const el = document.createElement("mc-title-footer");
  el.input = {
    note: "1065 / 3678 cartas listas",
    version: "v1.0.0",
    links: [
      { key: "discord", label: "Discord ↗" },
      { key: "release-notes", label: "Notas de la versión ↗" },
    ],
    aside,
  };
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-title-footer", () => {
  it("says the note, the version and each link as a focus stop", async () => {
    const root = (await footer()).shadowRoot!;
    expect(root.querySelector(".note")!.textContent).toBe("1065 / 3678 cartas listas");
    expect(root.querySelector(".version")!.textContent).toBe("v1.0.0");
    expect([...root.querySelectorAll(".link")].map((l) => l.getAttribute("data-stop"))).toEqual([
      "discord",
      "release-notes",
    ]);
    expect(root.querySelector(".aside")).toBeNull();
  });

  it("hangs the aside line only when there is one", async () => {
    expect((await footer("Modo de ahorro de energía")).shadowRoot!.querySelector(".aside")!.textContent).toBe(
      "Modo de ahorro de energía",
    );
  });

  it("raises the link key as the action on click(), as the focus route presses it", async () => {
    const el = await footer();
    const seen: unknown[] = [];
    el.addEventListener("mc-pressed", (e) => seen.push(e.detail.action));
    el.shadowRoot!.querySelector<HTMLElement>('[data-stop="release-notes"]')!.click();
    expect(seen).toEqual(["release-notes"]);
  });
});
