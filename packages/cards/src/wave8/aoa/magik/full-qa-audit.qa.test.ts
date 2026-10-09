import { AOA_CARDS, AOA_STARTER_DECKS, CORE_CARDS } from "@mc/content";
import {
  applyCommand,
  createGame,
  getInstance,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import {
  P1,
  endTurn,
  firstLegal,
  inst,
  moveToHand,
  play,
  playerOf,
  putOnTopOfDeck,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { WAVE8_DEPS } from "../../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Full QA audit of Magik's kit (2026-10-09): interactions of "play the top card of your deck" (45030a) with events
 * of both timings, and identity-trait play restrictions across forms. Sources: the printed text in
 * packages/content/src/data/aoa/cards.ts; RRG 1.8 "Form" / "Traits" (a card's traits are those of the face showing);
 * RRG 1.8 "Draw" (an effect that says "draw" draws).
 */
const BARRIER = "45040";
const CLOBBER = "45046";
const STRIKE = "45039";
const TEMPUS = "45042";
const CUCKOOS = "45049";
const SPELL_BASIC = "45051";
const ARMOR = "45035";
const LIMBO = "45032";
const SCRYING = "45036";
const BOOST_2 = "01100";
const DEAL = "01098";

const DECK = AOA_STARTER_DECKS.find((d) => d.id === "magik-aggression")!;
const MAGIK_SEAT = {
  identityCardId: DECK.identityCardId,
  aspects: DECK.aspects,
  deck: DECK.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
};
const DEPS: EngineDeps = WAVE8_DEPS ?? { abilities: mergeRegistries(WAVE7_ABILITIES) };

const codeOf = (s: GameState, id: InstanceId): string => (getInstance(s, id)?.cardId as string | undefined) ?? "?";
const codes = (s: GameState, ids: readonly InstanceId[]): string[] => ids.map((id) => codeOf(s, id));
const handOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).hand);
const discardOf = (s: GameState, p: PlayerId = P1): string[] => codes(s, playerOf(s, p).discard);
const damageOf = (s: GameState): number => inst(s, playerOf(s, P1).identity.instanceId).damage;

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  } as never);
  const created = createGame({ ...config, players: [MAGIK_SEAT] }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}
const heroGame = (): GameState => withForm(setupGame(), { heroForm: 0 });

describe("Tempus (45042) and Stepford Cuckoos (45049): play only if your identity has the X-MEN trait", () => {
  // Illyana Rasputin (alter-ego face) is MUTANT, MYSTIC: no X-MEN; Magik (hero face) is MYSTIC, X-MEN.
  function tryPlay(code: string, form: "hero" | "alterEgo") {
    const base = form === "hero" ? heroGame() : withForm(setupGame(), "alterEgo");
    const { state, ids } = moveToHand(base, P1, code);
    const pay = playerOf(state, P1)
      .hand.filter((i) => i !== ids[0])
      .slice(0, 3);
    return applyCommand(state, play(P1, ids[0]!, pay), DEPS);
  }
  it("Tempus: Magik (hero form, X-MEN) may play her", () => {
    expect(tryPlay(TEMPUS, "hero").ok).toBe(true);
  });
  it("Tempus: Illyana Rasputin (alter-ego form, no X-MEN) may not", () => {
    const r = tryPlay(TEMPUS, "alterEgo");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/trait|X-MEN|play/i);
  });
  it("Cuckoos: Illyana Rasputin (alter-ego form, no X-MEN) may not", () => {
    expect(tryPlay(CUCKOOS, "alterEgo").ok).toBe(false);
  });
  it("Basic Spell: MYSTIC on both faces, but it is a Hero Action, so alter-ego form cannot play it", () => {
    expect(tryPlay(SPELL_BASIC, "alterEgo").ok).toBe(false);
  });
});

describe("Magik plays the top card of her deck: events", () => {
  it("Clobber played from the top of the deck as the first card this round returns to the hand", () => {
    const s = putOnTopOfDeck(heroGame(), P1, CLOBBER, ARMOR).state;
    const top = playerOf(s, P1).deck[0]!;
    const pay = playerOf(s, P1).hand.slice(0, 1); // cost 2, reduced by 1
    const run = driveEventsPicking(DEPS, s, firstLegal, play(P1, top, pay));
    expect(handOf(run.state)).toContain(CLOBBER);
    expect(discardOf(run.state)).not.toContain(CLOBBER);
  });

  it("Soul Strike played from the top reads the NEW top card for its stun (physical or wild), not itself", () => {
    // Soul Strike is mental; the next card, Limbo, is physical: the villain is stunned.
    const s = putOnTopOfDeck(heroGame(), P1, STRIKE, LIMBO).state;
    const top = playerOf(s, P1).deck[0]!;
    const pay = playerOf(s, P1).hand.slice(0, 1);
    const run = driveEventsPicking(DEPS, s, firstLegal, play(P1, top, pay));
    expect(inst(run.state, run.state.activeVillainId!).statuses.stunned).toBe(1);
    // Control: the next card is energy (Mystical Armor), so no stun.
    const c = putOnTopOfDeck(heroGame(), P1, STRIKE, ARMOR).state;
    const ctl = driveEventsPicking(
      DEPS,
      c,
      firstLegal,
      play(P1, playerOf(c, P1).deck[0]!, playerOf(c, P1).hand.slice(0, 1)),
    );
    expect(inst(ctl.state, ctl.state.activeVillainId!).statuses.stunned).toBe(0);
  });

  it("Magic Barrier (an interrupt) played from the top of the deck in the villain phase prevents 3", () => {
    const base = heroGame();
    const withTop = putOnTopOfDeck(base, P1, BARRIER).state;
    // A hand of 5 so ending the turn draws nothing and Barrier stays on top.
    const owner = playerOf(withTop, P1);
    const hand = owner.hand.slice(0, 5);
    const arranged = {
      ...withTop,
      players: withTop.players.map((p) =>
        p.playerId === P1
          ? { ...p, hand, deck: [...p.deck.slice(0, 1), ...owner.hand.slice(5), ...p.deck.slice(1)] }
          : p,
      ),
    };
    const stacked = stackEncounterDeck(arranged, BOOST_2, DEAL);
    const barrier = playerOf(stacked, P1).deck[0]!;
    expect(codeOf(stacked, barrier)).toBe(BARRIER);
    let offered = false;
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") {
        const own = choice.options.find((o) => o.optionId.endsWith("45040.magic-barrier-interrupt"));
        if (own) offered = true;
        return own ? [own.optionId] : [];
      }
      if (choice.prompt.kind === "declareDefender") return ["decline"];
      return firstLegal(s);
    };
    const run = driveEventsPicking(DEPS, stacked, pick, endTurn(P1));
    // Printed text: the top card may be played "as if it was in your hand"; Barrier is a Hero Interrupt.
    expect(offered).toBe(true);
    expect(damageOf(run.state)).toBe(1);
  });
});

describe("Scrying (45036): draw one", () => {
  // RRG 1.8 "Draw": the card Scrying draws is drawn; a "cardDrawn" event is what draw-triggered cards listen to.
  it("the chosen card is drawn (emits cardDrawn), not merely moved to the hand", () => {
    const { state, ids } = moveToHand(heroGame(), P1, SCRYING);
    const run = driveEventsPicking(DEPS, state, firstLegal, play(P1, ids[0]!, []));
    const drawn = run.events.filter((e: GameEvent) => e.type === "cardDrawn");
    expect(discardOf(run.state)).toContain(SCRYING);
    expect(drawn.length).toBe(1);
  });
});
