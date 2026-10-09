import { AOA_CARDS, AOA_STARTER_DECKS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../../dsl/index.js";
import {
  P1,
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  moveToHand,
  patchInstance,
  play,
  playerOf,
  settle,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { coreScenario } from "../../../core/setup.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { AOA_ASPECT_BASIC } from "../aspect-basic.js";
import { BISHOP_IDENTITY } from "./identity.js";
import { BISHOP_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Full QA card-text audit of Bishop's kit (wave 8, 2026-10-09). Only what no existing test covers:
 * - Bantam's "find Portal Through Time and reveal it" when the Portal sits in the encounter discard pile (RRG 1.8
 *   "Find": every game area is searched, set aside or not).
 * - Marrow's "Play only if you have the X-FORCE or X-MEN trait" read in Lucas Bishop's alter-ego form (MUTANT,
 *   TEMPORAL: neither trait), where the card cannot be played; in hero form (X-MEN) it can.
 */
const DEPS: EngineDeps = {
  abilities: mergeRegistries(WAVE7_ABILITIES, BISHOP_IDENTITY, BISHOP_OBLIGATION_NEMESIS, AOA_ASPECT_BASIC),
};
const POOL: readonly AnyCard[] = [...WAVE7_CARDS, ...AOA_CARDS];
const PRECON = AOA_STARTER_DECKS.find((d) => d.id === "bishop-leadership")!;
const PRECON_DECK = PRECON.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId));

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = [{ identityCardId: PRECON.identityCardId, aspects: PRECON.aspects, deck: PRECON_DECK }];
  const created = createGame({ ...config, players, requireLegalDecks: false }, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  return patchInstance(settled, settled.mainScheme.instanceId, { threat: -30 });
}

const codeOf = (s: GameState, id: InstanceId): string => s.instances[id]!.cardId as string;
const aside = (s: GameState, code: string): InstanceId => playerOf(s, P1).setAside.find((i) => codeOf(s, i) === code)!;

describe("Bantam (45028): find Portal Through Time wherever it is (RRG 1.8 Find)", () => {
  it("Portal in the encounter discard pile (defeated earlier): Bantam finds it there and reveals it", () => {
    const base = setupGame();
    const bantam = aside(base, "45028");
    const portal = aside(base, "45027");
    const deckId = activeEncounterDeckId(base);
    const pile = base.encounterDecks[deckId]!;
    // Portal out of the set-aside area into the encounter discard pile; Bantam, a boost filler and the deal on top.
    const spare = pile.deck.slice(0, 3);
    const staged: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, setAside: p.setAside.filter((i) => i !== portal && i !== bantam) })),
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: {
          deck: [spare[0]!, bantam, ...pile.deck.filter((i) => !spare.includes(i))],
          discard: [...pile.discard, portal],
        },
      },
    };
    const boosted = patchInstance(staged, spare[0]!, { cardId: cardId("01186") });
    const { events, state } = driveEventsPicking(DEPS, boosted, firstLegal, endTurn(P1));
    const revealed = (id: InstanceId) =>
      events.filter(
        (e: GameEvent): e is Extract<GameEvent, { type: "encounterCardRevealed" }> =>
          e.type === "encounterCardRevealed" && e.instanceId === id,
      );
    expect(revealed(bantam)).toHaveLength(1);
    expect(revealed(portal)).toHaveLength(1);
    expect(state.villainArea).toContain(portal);
  });
});

describe("Marrow (45021): Play only if you have the X-FORCE or X-MEN trait", () => {
  function marrowInHand(form: "alterEgo" | { heroForm: number }) {
    const base = form === "alterEgo" ? setupGame() : withForm(setupGame(), form, P1);
    const given = moveToHand(base, P1, "45021", "45022");
    return { state: given.state, marrow: given.ids[0]!, energy: given.ids[1]! };
  }
  it("hero form (X-MEN): playable, paid with Energy", () => {
    const m = marrowInHand({ heroForm: 0 });
    expect(applyCommand(m.state, play(P1, m.marrow, [m.energy]), DEPS).ok).toBe(true);
    expect(instancesOf(m.state, "45021")).toContain(m.marrow);
    expect(inst(m.state, m.marrow).cardId).toBe(cardId("45021"));
  });
  it("alter-ego form (Lucas Bishop: MUTANT, TEMPORAL): not playable, the card stays in hand", () => {
    const m = marrowInHand("alterEgo");
    expect(applyCommand(m.state, play(P1, m.marrow, [m.energy]), DEPS).ok).toBe(false);
  });
});
