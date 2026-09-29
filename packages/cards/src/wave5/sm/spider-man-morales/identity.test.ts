import { describe, expect, it } from "vitest";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { validateDefinition } from "../../../dsl/validate.js";
import { identityOf, inst, P1, run, runWith, settle, type Picker } from "../../../testing/harness.js";
import { moveToDiscard } from "../../../testing/staging.js";
import { WAVE5_DEPS } from "../../index.js";
import { startWave5Game } from "../../testing.js";
import { spiderManMoralesScenario } from "./support.js";
import { SPIDER_MAN_MORALES_IDENTITY } from "./identity.js";

const milesVsRhino = (seed = 1) => startWave5Game(spiderManMoralesScenario("rhino", { seed }));

/**
 * Accepts every optional trigger window offered (there is only ever one candidate in these tests: `27030b`'s own
 * response, or none), then picks `want` (if any) at the `chooseCards` prompt that follows — the same two-step
 * "accept the optional response, then answer its own choice" shape Ghost-Spider's `events-a.test.ts` `accepting()`
 * takes for a reactively played card's own picker, specialized here to this response's own two prompt kinds.
 */
const accepting =
  (...want: readonly InstanceId[]): Picker =>
  (state) => {
    const prompt = state.pendingChoice?.prompt;
    if (prompt?.kind === "chooseTriggers") return state.pendingChoice!.options.map((o) => o.optionId);
    if (prompt?.kind === "chooseCards") return want;
    return [];
  };

/**
 * The engine's own `changeForm` action allows only one voluntary form change per round
 * (`already_changed_form`, `packages/engine/src/actions.ts`). To reach a *second* real form change within one test
 * round (hero, then back to alter-ego, so `27030b`'s "after you change **to** this form" actually fires) this
 * clears the round's bookkeeping flag directly rather than simulate an entire villain phase back to a new round —
 * the same kind of direct state patch Ghost-Spider's own identity test uses (`patchInstance`) to set up a
 * precondition instead of playing it out move by move.
 */
function clearVoluntaryFormChange(state: GameState, player: PlayerId): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, identity: { ...p.identity, changedFormThisRound: false } } : p,
    ),
  };
}

const toHeroCmd = { type: "changeForm" as const, playerId: P1 };

describe("Spider-Man / Miles Morales (identity, 27030a/b)", () => {
  describe("27030a.spider-man-constant / -constant-2 (Venom Blast / Spider Camouflage)", () => {
    // Both are `special()` abilities (RRG 1.8 "Special": text that "resolves only when another ability instructs
    // it to"). Their callers — "Resolve Spider-Man's 'Venom Blast'/'Spider Camouflage' ability" — live in his own
    // kit's signature events (27031-27055) and other `sm` sets, none scripted yet (docs/phase7-wave5.md §1053).
    // With no real caller committed, there is nothing to `use()` through the engine in isolation, so this pins
    // the exact composed effect data instead — the same technique `dsl/wave5-primitives.test.ts` §3.7 uses for
    // Sandslide/City Streets, the one other pack-4 "Special resolved by a not-yet-scripted caller" case. Once his
    // events are scripted, resolving these Specials for real is exercised through that caller's own test.
    it("Venom Blast: deals 2 damage to a chosen enemy, then stuns that enemy", () => {
      const definition = SPIDER_MAN_MORALES_IDENTITY["27030a.spider-man-constant"];
      expect(validateDefinition(definition)).toEqual([]);
      expect(definition.trigger).toEqual({ kind: "special" });
      expect(definition.effects).toEqual([
        { kind: "chooseTarget", slot: "enemy", query: { categories: ["enemy"] }, chooser: { kind: "controller" } },
        { kind: "dealDamage", target: { kind: "slot", slot: "enemy" }, amount: { kind: "const", value: 2 } },
        { kind: "giveStatus", target: { kind: "slot", slot: "enemy" }, status: "stunned" },
      ]);
    });

    it("Spider Camouflage: gives Spider-Man a tough status card, then confuses a chosen enemy", () => {
      const definition = SPIDER_MAN_MORALES_IDENTITY["27030a.spider-man-constant-2"];
      expect(validateDefinition(definition)).toEqual([]);
      expect(definition.trigger).toEqual({ kind: "special" });
      expect(definition.effects).toEqual([
        { kind: "giveStatus", target: { kind: "self" }, status: "tough" },
        {
          kind: "chooseTarget",
          slot: "camouflaged",
          query: { categories: ["enemy"] },
          chooser: { kind: "controller" },
        },
        { kind: "giveStatus", target: { kind: "slot", slot: "camouflaged" }, status: "confused" },
      ]);
    });
  });

  describe("27030b.miles-morales-response (shuffle a Spider-Man card home)", () => {
    it("shuffles a card named 'Spider-Man' from the discard pile into the deck after changing to alter-ego form", () => {
      const state = milesVsRhino(1);
      // 27049, "Spider-Man" (Peter Parker): a real card in Miles's own precon deck, matching the response's
      // by-name filter (docs: this pack alone prints "Spider-Man" on four different cards).
      const { state: withDiscard, id: peterParker } = moveToDiscard(state, P1, "27049");
      const inHero = run(withDiscard, toHeroCmd); // spends the round's one voluntary change.
      const readyForAnotherChange = clearVoluntaryFormChange(inHero, P1);
      const before = {
        deck: readyForAnotherChange.players[0]!.deck.length,
        discard: readyForAnotherChange.players[0]!.discard.length,
      };
      const after = settle(
        runWith(WAVE5_DEPS, readyForAnotherChange, toHeroCmd), // hero -> alter-ego: "after you change to this form".
        accepting(peterParker),
        undefined,
        WAVE5_DEPS,
      );
      expect(after.players[0]!.deck.length).toBe(before.deck + 1);
      expect(after.players[0]!.discard.length).toBe(before.discard - 1);
      expect(inst(after, identityOf(after, P1)).exhausted).toBe(false); // sanity: identity itself untouched.
    });

    it("choosing to change to alter-ego form with no Spider-Man card in the discard pile is a legal no-op", () => {
      const state = milesVsRhino(2);
      const inHero = run(state, toHeroCmd);
      const readyForAnotherChange = clearVoluntaryFormChange(inHero, P1);
      const before = readyForAnotherChange.players[0]!.deck.length;
      const after = settle(runWith(WAVE5_DEPS, readyForAnotherChange, toHeroCmd), accepting(), undefined, WAVE5_DEPS);
      expect(after.players[0]!.deck.length).toBe(before); // nothing found to shuffle: `chooseCards` picked 0.
    });

    it("changing to hero form does not trigger the response (only the alter-ego face's own form)", () => {
      const state = milesVsRhino(3);
      const { state: withDiscard } = moveToDiscard(state, P1, "27049");
      const before = withDiscard.players[0]!.deck.length;
      const after = settle(runWith(WAVE5_DEPS, withDiscard, toHeroCmd), accepting(), undefined, WAVE5_DEPS);
      expect(after.players[0]!.identity.form).toBe("hero");
      // No `chooseTriggers`/`chooseCards` window ever opened: once in hero form, the alter-ego face's own response
      // is no longer active ("hero and alter-ego abilities are only offered in the matching form"), the same way
      // She-Hulk's mirror-image hero-face response ("After you change to this form") only offers itself changing
      // *to* hero, never to alter-ego (`01019a.do-you-even-lift`).
      expect(after.players[0]!.deck.length).toBe(before);
    });
  });
});
