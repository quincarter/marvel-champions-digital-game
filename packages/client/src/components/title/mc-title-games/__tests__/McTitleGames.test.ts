// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import "@mc/ui";
import "../mc-title-games.js";
import type { TitleGamesInput } from "../mc-title-games.types.js";

afterEach(() => document.body.replaceChildren());

const input = (over: Partial<TitleGamesInput> = {}): TitleGamesInput => ({
  heading: "PARTIDAS EN CURSO (2)",
  rows: [
    {
      id: "a",
      title: "Rhino · Spider-Man",
      detail: "Ronda 4 · hace 2 h",
      needsUpdate: null,
      resume: "Reanudar",
      watch: "Ver",
      remove: "Quitar",
    },
    {
      id: "b",
      title: "Klaw · Storm",
      detail: "Ronda 1",
      needsUpdate: "Jugada en una versión más nueva",
      resume: "Reanudar",
      watch: "Ver",
      remove: "Quitar",
    },
  ],
  confirming: null,
  enabled: true,
  ...over,
});

async function games(value: TitleGamesInput) {
  const el = document.createElement("mc-title-games");
  el.input = value;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const stops = (el: HTMLElement): (string | null)[] =>
  [...el.shadowRoot!.querySelectorAll("[data-stop]")].map((n) => n.getAttribute("data-stop")).filter((k) => k);

describe("mc-title-games", () => {
  it("draws a row per game with Resume, Watch and Remove as focus stops, and says a blocked game needs an update", async () => {
    const el = await games(input());
    expect(stops(el)).toEqual(["game:a", "game-watch:a", "game-remove:a", "game:b", "game-remove:b"]);
    expect(el.shadowRoot!.querySelector(".needs")!.textContent).toBe("Jugada en una versión más nueva");
    expect(el.shadowRoot!.querySelector(".heading .text")!.textContent).toBe("PARTIDAS EN CURSO (2)");
  });

  it("replaces the list with the remove question and its two answers", async () => {
    const el = await games(
      input({
        confirming: {
          id: "a",
          title: "Rhino",
          message: "¿Quitar esta partida?",
          keep: "Conservar",
          remove: "Quitar",
          error: "Fallo",
        },
      }),
    );
    expect(stops(el)).toEqual(["remove-keep", "remove-confirm"]);
    expect(el.shadowRoot!.querySelector(".error")!.textContent).toBe("Fallo");
    expect(el.shadowRoot!.querySelector(".row")).toBeNull();
  });

  it("dims every button while something is starting, and a tap on the row resumes through its hit area", async () => {
    const el = await games(input({ enabled: false }));
    expect([...el.shadowRoot!.querySelectorAll("mc-button")].every((b) => b.hasAttribute("disabled"))).toBe(true);
    const ready = await games(input());
    const seen: unknown[] = [];
    ready.addEventListener("mc-pressed", (e) => seen.push(e.detail.action));
    ready.shadowRoot!.querySelector<HTMLElement>("mc-hit-area")!.click();
    expect(seen).toEqual(["game:a"]);
  });
});
