import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setArtLanguage } from "../art/art-source.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { playWorkLifeWithAlly } from "../store/dev-work-life-game.js";
import { SessionStore } from "../store/session-store.js";
import { queryNounOf } from "./ability-refusal.js";
import { loadCardText, resetCardTextForTest } from "./card-text.js";
import { optionNoticesOf } from "./option-notice.js";
import { localizedTraitOf } from "./trait-names.js";

beforeEach(() => vi.stubGlobal("__CARD_LANGS__", "en,es"));

afterEach(() => {
  setArtLanguage("en");
  vi.unstubAllGlobals();
  resetCardTextForTest();
});

describe("refusal wording in Spanish", () => {
  test("traits read as printed: Vengador, X-Men and S.H.I.E.L.D. keep their form; an unlisted multiword trait stays English", () => {
    setArtLanguage("es");
    expect(queryNounOf({ categories: ["ally"], trait: "AVENGER" as never })?.noun).toBe("aliado Vengador");
    expect(queryNounOf({ categories: ["ally"], trait: "X-MEN" as never })?.noun).toBe("aliado X-Men");
    expect(queryNounOf({ categories: ["ally"], trait: "S.H.I.E.L.D." as never })?.noun).toBe("aliado S.H.I.E.L.D.");
    expect(queryNounOf({ categories: ["ally"], trait: "HERO FOR HIRE" as never })?.noun).toBe("aliado Hero for Hire");
    expect(localizedTraitOf("Avenger", "en")).toBeNull();
    setArtLanguage("en");
    expect(queryNounOf({ categories: ["ally"], trait: "AVENGER" as never })?.noun).toBe("Avenger ally");
  });

  test("Work-Life Balance: the card and the stalwart character in Spanish, with the Estado wording", async () => {
    const store = new SessionStore(new LocalEngineHost());
    const events = (await playWorkLifeWithAlly(store))!;
    const game = store.state.game!;
    const table = Object.fromEntries(
      Object.values(game.cardPool).map((card) => [card.id as string, { n: `ES ${card.name}` }]),
    );
    await loadCardText("es", () => Promise.resolve(table));
    setArtLanguage("es");
    const [notice] = optionNoticesOf(events, game, null, POOL_DEPS);
    expect(notice!.title).toBe("ES Work-Life Balance: solo una opción");
    const unavailable = notice!.rows.find((row) => row.kind === "unavailable");
    expect(unavailable).toMatchObject({
      why: "ES Jessica Jones tiene Firmeza y no puede recibir cartas de Estado «Confundido»",
    });
    // Option labels are the engine's English: no Spanish text exists for them.
    expect(unavailable!.label).toBe("Confuse your identity");
  }, 120_000);
});
