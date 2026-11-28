// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-title-page.js";
import type { TitlePageInput } from "../mc-title-page.types.js";

afterEach(() => document.body.replaceChildren());

const input = (over: Partial<TitlePageInput> = {}): TitlePageInput => ({
  notice: { tag: "NUEVO", message: "Novedades", link: "Leer más ↗", linkShort: "↗" },
  logo: { eyebrow: "EDICIÓN DIGITAL" },
  icons: { buttons: [{ key: "chrome:theme", icon: "moon", name: "Modo oscuro" }] },
  banner: null,
  menu: {
    rows: [
      { key: "new-game", label: "Nueva partida", kind: "primary", width: "full", tall: true },
      { key: "decks", label: "Mazos", kind: "secondary", width: "full" },
    ],
  },
  games: null,
  promo: null,
  rank: {
    compact: false,
    up: false,
    label: "RANGO 1",
    title: "Compañero en prácticas",
    points: "0 pts",
    next: "100 para el siguiente",
    fraction: 0,
    summary: "Rango 1.",
  },
  footer: {
    note: "1 / 2 cartas listas",
    version: "v1",
    links: [{ key: "release-notes", label: "Notas ↗" }],
    aside: null,
  },
  status: null,
  problem: null,
  ...over,
});

async function page(value: TitlePageInput, mode: "wide" | "phone" = "wide") {
  const el = document.createElement("mc-title-page");
  el.mode = mode;
  el.input = value;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("mc-title-page", () => {
  it("composes the notice bar, the logo with its icon row, the menu, the rank card and the footer", async () => {
    const root = (await page(input())).shadowRoot!;
    for (const tag of [
      "mc-title-notice-bar",
      "mc-title-logo",
      "mc-title-icon-row",
      "mc-title-menu",
      "mc-title-rank",
      "mc-title-footer",
    ])
      expect(root.querySelector(tag), tag).not.toBeNull();
    expect(root.querySelector("mc-title-icon-row")!.getAttribute("slot")).toBe("top-end");
    expect(root.querySelector("mc-title-rank")!.getAttribute("data-stop")).toBe("rank-badge");
    expect(root.querySelector("mc-title-banner")).toBeNull();
    expect(root.querySelector("mc-title-games")).toBeNull();
  });

  it("puts the rank card in the art column on a wide screen and above the footer on a phone", async () => {
    const wide = (await page(input())).shadowRoot!;
    expect(wide.querySelector(".art mc-title-rank")).not.toBeNull();
    const phone = (await page(input(), "phone")).shadowRoot!;
    expect(phone.querySelector(".art")).toBeNull();
    expect(phone.querySelector(".cols mc-title-rank")).not.toBeNull();
  });

  it("stands the Play online panel beside the menu for the side placement, and the banner and games in the art column", async () => {
    const promo = {
      variant: "side" as const,
      title: "Jugar en línea",
      pitch: "x",
      live: null,
      host: "Crear",
      join: "Unirse",
      available: true,
    };
    const el = await page(
      input({
        promo,
        banner: {
          heading: "H",
          detail: "D",
          buttons: [],
          dismiss: { key: "update-dismiss", label: "×", kind: "secondary" },
        },
        games: { heading: "PARTIDAS", rows: [], confirming: null, enabled: true },
      }),
    );
    const root = el.shadowRoot!;
    expect(el.getAttribute("placement")).toBe("side");
    expect(root.querySelector(".cols mc-title-promo")).not.toBeNull();
    expect(root.querySelector(".art mc-title-banner")).not.toBeNull();
    expect(root.querySelector(".art mc-title-games")).not.toBeNull();
  });

  it("says one mc-title press with the key of whatever was pressed, and stops the part's own events", async () => {
    const el = await page(input());
    const seen: unknown[] = [];
    el.addEventListener("mc-title", (e) => seen.push(e.detail));
    const raw: unknown[] = [];
    document.body.addEventListener("mc-pressed", () => raw.push(1));
    el.shadowRoot!.querySelector<HTMLElement>("mc-title-rank")!.click();
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLElement>("mc-title-footer")!
      .shadowRoot!.querySelector<HTMLElement>(".link")!
      .click();
    expect(seen).toEqual([
      { type: "press", key: "rank-badge" },
      { type: "press", key: "release-notes" },
    ]);
    expect(raw).toEqual([]);
  });
});
