import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setArtLanguage } from "../art/art-source.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { playWorkLifeWithAlly } from "../store/dev-work-life-game.js";
import { SessionStore } from "../store/session-store.js";
import { WAVE10_DEPS } from "@mc/cards";
import type { AbilityId } from "@mc/content";
import { applyCommand, legalActions, type Command, type GameState } from "@mc/engine";
import { heroPackGame } from "./hero-pack-fixture.js";
import { abilityRefusalReason, refusedAbilityLine, queryNounOf } from "./ability-refusal.js";
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

  test("New Labors of Hercules refused: the whole sentence is Spanish, for a Labor in play and for an empty deck", () => {
    const NEW_LABORS = "59001b.new-labors-of-hercules" as AbilityId;
    const game = heroPackGame("hercules");
    const me = game.players[0]!.playerId;
    const identity = game.players[0]!.identity.instanceId;
    const legal = legalActions(game, me, WAVE10_DEPS);
    if (legal.kind !== "turn") throw new Error("expected a turn");
    const entry = legal.legal.find((e) => e.action.kind === "useAbility" && e.action.abilityId === NEW_LABORS)!;
    const run = (state: GameState, command: Command): GameState => {
      const result = applyCommand(state, command, WAVE10_DEPS);
      if (!result.ok) throw new Error(result.error.message);
      return result.state;
    };
    let inPlay = run(game, entry.example);
    for (let guard = 0; guard < 40 && inPlay.pendingChoice; guard++) {
      const choice = inPlay.pendingChoice;
      inPlay = run(inPlay, {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
      });
    }
    const seat = game.players[0]!;
    const emptied = {
      ...game,
      players: game.players.map((p, at) =>
        at === 0
          ? { ...p, separateDecks: { ...p.separateDecks, Labor: { ...seat.separateDecks.Labor!, deck: [] } } }
          : p,
      ),
    } as GameState;
    setArtLanguage("es");
    expect(abilityRefusalReason(inPlay, identity, me, NEW_LABORS, WAVE10_DEPS)).toBe(
      "hay una carta de Trabajo en juego",
    );
    expect(refusedAbilityLine(inPlay, identity, me, NEW_LABORS, WAVE10_DEPS)).toBe(
      "No se puede usar: hay una carta de Trabajo en juego",
    );
    expect(abilityRefusalReason(emptied, identity, me, NEW_LABORS, WAVE10_DEPS)).toBe("el mazo de Trabajos está vacío");
  }, 120_000);
});
