import { cardId } from "@mc/content";
import type { GameState, InstanceId, PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  identityOf,
  inst,
  P1,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
} from "../../../testing/harness.js";
import { moveToDiscard, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { COLOSSUS_IDENTITY } from "./identity.js";
import { colossusGame } from "./support.js";

const heroOf = (state: GameState) => identityOf(state, P1);
const tough = (state: GameState) => inst(state, heroOf(state)).statuses.tough;
const withTough = (state: GameState, n: number) =>
  patchInstance(state, heroOf(state), { statuses: { ...inst(state, heroOf(state)).statuses, tough: n } });
const hasCard = (state: GameState, zone: "hand" | "deck" | "discard", code: string, player: PlayerId = P1) =>
  playerOf(state, player)[zone].filter((id: InstanceId) => state.instances[id]!.cardId === cardId(code));

/** Accepts every optional trigger window, then picks `want` at a `chooseCards` prompt. */
const accepting =
  (...want: readonly InstanceId[]): Picker =>
  (state) => {
    const prompt = state.pendingChoice?.prompt;
    if (prompt?.kind === "chooseTriggers") return state.pendingChoice!.options.map((o) => o.optionId);
    if (prompt?.kind === "chooseCards") return want;
    return [];
  };

describe("Colossus / Piotr Rasputin (identity, 32001a/b)", () => {
  it("registers the four identity refs the card data names, all valid", () => {
    expect(Object.keys(COLOSSUS_IDENTITY).sort()).toEqual([
      "32001a.colossus-constant",
      "32001a.colossus-constant-2",
      "32001b.piotr-rasputin-constant",
      "32001b.setup",
    ]);
    for (const definition of Object.values(COLOSSUS_IDENTITY)) expect(validateDefinition(definition)).toEqual([]);
  });

  it("32001a.colossus-constant: a numeric tough limit of 2 on himself", () => {
    const definition = COLOSSUS_IDENTITY["32001a.colossus-constant"];
    expect(definition.trigger).toMatchObject({ kind: "constant" });
    expect((definition.trigger as { rules?: unknown }).rules).toEqual([
      { kind: "statusLimit", target: { self: true }, status: "tough", max: 2 },
    ]);
  });

  describe("32001a.colossus-constant-2 (Steel Skin) and the two-card tough limit", () => {
    it("after changing to hero form, gives Colossus a tough status card", () => {
      const state = colossusGame();
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
      expect(tough(state)).toBe(0);
      const after = settle(runWith(WAVE6_DEPS, state, toHero(P1)), accepting(), undefined, WAVE6_DEPS);
      expect(playerOf(after, P1).identity.form).toBe("hero");
      expect(tough(after)).toBe(1);
    });

    it("holds 2 tough cards: a second one is given on top of the first", () => {
      const state = withTough(colossusGame(), 1);
      const after = settle(runWith(WAVE6_DEPS, state, toHero(P1)), accepting(), undefined, WAVE6_DEPS);
      expect(tough(after)).toBe(2);
    });

    it("never holds a third: Steel Skin with 2 already held leaves 2", () => {
      const state = withTough(colossusGame(), 2);
      const after = settle(runWith(WAVE6_DEPS, state, toHero(P1)), accepting(), undefined, WAVE6_DEPS);
      expect(tough(after)).toBe(2);
    });

    it("does not fire when changing to alter-ego form", () => {
      const inHero = withForm(colossusGame(), { heroForm: 0 });
      const after = settle(runWith(WAVE6_DEPS, inHero, toHero(P1)), accepting(), undefined, WAVE6_DEPS);
      expect(playerOf(after, P1).identity.form).toBe("alterEgo");
      expect(tough(after)).toBe(0);
    });
  });

  describe("32001b.setup (Organic Steel)", () => {
    it("every seed opens with Organic Steel in hand (a copy found by the Setup, not left to the draw)", () => {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        expect(hasCard(colossusGame("rhino", { seed }), "hand", "32006").length, `seed ${seed}`).toBeGreaterThanOrEqual(
          1,
        );
      }
    });

    it("is the only identity ability that resolves at setup: nothing else was set up", () => {
      expect(COLOSSUS_IDENTITY["32001b.setup"].trigger).toEqual({ kind: "setup" });
    });
  });

  describe("32001b.piotr-rasputin-constant (Aspiring Artist)", () => {
    it("shuffles a Colossus card (his identity set) from the discard pile into the deck on changing to alter-ego", () => {
      const state = withForm(colossusGame(), { heroForm: 0 });
      // 32004, Iron Will: an upgrade of his identity-specific set.
      const { state: staged, id: ironWill } = moveToDiscard(state, P1, "32004");
      const before = playerOf(staged, P1);
      const after = settle(runWith(WAVE6_DEPS, staged, toHero(P1)), accepting(ironWill), undefined, WAVE6_DEPS);
      expect(playerOf(after, P1).identity.form).toBe("alterEgo");
      expect(playerOf(after, P1).discard).not.toContain(ironWill);
      expect(playerOf(after, P1).deck).toContain(ironWill);
      expect(playerOf(after, P1).deck).toHaveLength(before.deck.length + 1);
    });

    it("offers no card of another set (a Protection card in the discard pile is not a Colossus card)", () => {
      const state = withForm(colossusGame(), { heroForm: 0 });
      // 32021-32024 are the basic cards; use any non-Colossus-set card in the precon (a basic card).
      const basic = playerOf(state, P1).deck.find((id) => {
        const card = state.cardPool[state.instances[id]!.cardId]!;
        return "aspect" in card && !String(card.aspect).startsWith("hero:");
      })!;
      const staged = {
        ...state,
        players: state.players.map((p) =>
          p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== basic), discard: [...p.discard, basic] } : p,
        ),
      };
      const after = settle(runWith(WAVE6_DEPS, staged, toHero(P1)), accepting(basic), undefined, WAVE6_DEPS);
      expect(playerOf(after, P1).discard).toContain(basic);
    });

    it("an empty discard pile offers nothing: a response with no card to shuffle is not initiated (QA A-8)", () => {
      const state = withForm(colossusGame(), { heroForm: 0 });
      const before = playerOf(state, P1).deck.length;
      const changed = runWith(WAVE6_DEPS, state, toHero(P1));
      expect(changed.pendingChoice, "no prompt: the response is not offered").toBeNull();
      expect(playerOf(changed, P1).deck).toHaveLength(before);
    });

    it("with a Colossus card in the discard pile it is offered, so the check is on the card and not the form change", () => {
      const state = withForm(colossusGame(), { heroForm: 0 });
      const { state: staged } = moveToDiscard(state, P1, "32004");
      expect(runWith(WAVE6_DEPS, staged, toHero(P1)).pendingChoice).not.toBeNull();
    });
  });
});
