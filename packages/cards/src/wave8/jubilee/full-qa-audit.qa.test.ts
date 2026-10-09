import { cardId, WAVE8_STARTER_DECKS } from "@mc/content";
import { applyCommand, createGame, type Command, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  play,
  patchInstance,
  playerOf,
  settle,
  use,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE8_CARDS } from "../cards.js";
import { WAVE8_DEPS } from "../index.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Full QA audit of the Jubilee pack (wave 8). Source for every test: RRG 1.8 and the printed text in
 * packages/content/src/data/jubilee/cards.ts.
 */
const JUBILEE = WAVE8_STARTER_DECKS.find((d) => d.id === "jubilee-justice")!;
const ENERGY = "47019";
const GROUNDED = "47023";
const QUINCARRIER = "08023";

function alterEgoGame(): GameState {
  const config = coreScenario("rhino", {
    players: [
      {
        identityCardId: JUBILEE.identityCardId,
        aspects: JUBILEE.aspects,
        deck: JUBILEE.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
      },
    ],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE8_CARDS,
  } as never);
  const created = createGame({ ...config, requireLegalDecks: false }, WAVE8_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
}

/** Moves the top deck card of `p` into their play area, relabeled `code`, faceup and under their control. */
function intoPlay(s: GameState, code: string, p: PlayerId = P1): { state: GameState; id: InstanceId } {
  const id = playerOf(s, p).deck[0]!;
  const relabeled = patchInstance(s, id, { cardId: cardId(code), controllerId: p, faceup: true });
  return {
    id,
    state: {
      ...relabeled,
      players: relabeled.players.map((pl) =>
        pl.playerId === p ? { ...pl, deck: pl.deck.filter((i) => i !== id), playArea: [...pl.playArea, id] } : pl,
      ),
    },
  };
}

describe("Grounded (47023), Cost paid by Resource abilities", () => {
  // RRG 1.8 "Cost" (p. 13): "To pay a resource cost, a player spends resources that they generate by discarding cards
  // from their hand or by using Resource card abilities." Grounded's "spend 2 resources of the same type" is such a cost.
  it("an unrestricted Resource ability in play (Quincarrier, a wild) plus one [energy] hand card pays Grounded's 2 resources", () => {
    const g = intoPlay(intoPlay(alterEgoGame(), GROUNDED).state, QUINCARRIER);
    const hand = playerOf(g.state, P1).deck[0]!;
    const s = patchInstance(
      {
        ...g.state,
        players: g.state.players.map((pl) => ({ ...pl, deck: pl.deck.filter((i) => i !== hand), hand: [hand] })),
      },
      hand,
      { cardId: cardId(ENERGY) },
    );
    const pay: Command = {
      type: "changeForm",
      playerId: P1,
      payment: [
        { fromHand: hand },
        { ability: { instanceId: g.id, abilityId: "08023.quincarrier-resource" as never } },
      ],
    };
    const r = applyCommand(s, pay, WAVE8_DEPS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(playerOf(r.state, P1).identity.form).toBe("hero");
    // Control: the hand card alone cannot pay (so Grounded is really in force).
    const alone = applyCommand(s, { type: "changeForm", playerId: P1, payment: [{ fromHand: hand }] }, WAVE8_DEPS);
    expect(alone.ok).toBe(false);
  });
});

/** Spider-Man (seat 1) and Jubilee (seat 2), both in alter-ego form, seat 1 to act. */
function twoSeatGame(): GameState {
  const spider = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    modularSetIds: [],
  }).players[0]!;
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE8_CARDS,
  } as never);
  const jubilee = {
    identityCardId: JUBILEE.identityCardId,
    aspects: JUBILEE.aspects,
    deck: JUBILEE.cards.flatMap((c) => Array.from({ length: c.quantity }, () => c.cardId)),
  };
  const created = createGame({ ...config, players: [spider, jubilee], requireLegalDecks: false }, WAVE8_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
}

describe("Disguise (47013): play under any player's control", () => {
  // Printed: "Play under any player's control. Max 1 per player. Action (thwart): Exhaust Disguise and your identity".
  // "Your identity" is the identity of the player who controls the card.
  it("played by Jubilee under Spider-Man's control: Spider-Man's Action exhausts his identity, not hers", () => {
    let s = twoSeatGame();
    const disguise = playerOf(s, P2).deck[0]!;
    const payer = playerOf(s, P2).deck[1]!;
    s = patchInstance(patchInstance(s, disguise, { cardId: cardId("47013") }), payer, { cardId: cardId(ENERGY) });
    s = {
      ...s,
      players: s.players.map((pl) =>
        pl.playerId === P2
          ? { ...pl, deck: pl.deck.filter((i) => i !== disguise && i !== payer), hand: [disguise, payer] }
          : pl,
      ),
    };
    s = driveEventsPicking(WAVE8_DEPS, s, firstLegal, endTurn(P1)).state;
    const played = driveEventsPicking(WAVE8_DEPS, s, firstLegal, {
      type: "playCard",
      playerId: P2,
      cardInstanceId: disguise,
      payment: [{ fromHand: payer }],
      attachToInstanceId: null,
      controllerId: P1,
    });
    expect(inst(played.state, disguise).controllerId).toBe(P1);
    const withThreat = patchInstance(played.state, played.state.mainScheme.instanceId, { threat: 6 });
    const used = driveEventsPicking(WAVE8_DEPS, withThreat, firstLegal, use(P1, disguise, "47013.disguise-action"));
    expect(mainThreat(used.state)).toBe(4);
    expect(inst(used.state, identityOf(used.state, P1)).exhausted).toBe(true);
    expect(inst(used.state, identityOf(used.state, P2)).exhausted).toBe(false);
  });
});

describe("Mutant Mayhem (47028): the owners play the returned allies", () => {
  // Printed: "return them to their owners' hands -> those players play those allies, ignoring their resource costs."
  it("Spider-Man plays it: Jubilee's Wolverine and Siryn's owner each get their own ally back in play (two players)", () => {
    let s = withForm(twoSeatGame(), { heroForm: 0 }, P1);
    // Wolverine (X-MEN) under Jubilee, Siryn 42012 (X-FORCE) under Spider-Man.
    const w = intoPlay(s, "47002", P2);
    const siryn = intoPlay(w.state, "42012", P1);
    s = patchInstance(patchInstance(siryn.state, w.id, { damage: 2 }), siryn.id, { damage: 1 });
    const hand = playerOf(s, P1).deck.slice(0, 4);
    s = {
      ...s,
      players: s.players.map((pl) =>
        pl.playerId === P1 ? { ...pl, deck: pl.deck.filter((i) => !hand.includes(i)), hand } : pl,
      ),
    };
    const [mayhem, ...payers] = hand as [InstanceId, ...InstanceId[]];
    s = patchInstance(s, mayhem, { cardId: cardId("47028") });
    for (const id of payers) s = patchInstance(s, id, { cardId: cardId(ENERGY) });
    const { state } = driveEventsPicking(WAVE8_DEPS, s, firstLegal, play(P1, mayhem, payers));
    expect(playerOf(state, P2).playArea).toContain(w.id);
    expect(playerOf(state, P1).playArea).toContain(siryn.id);
    expect(inst(state, w.id).damage).toBe(0);
    expect(inst(state, siryn.id).damage).toBe(0);
    expect(playerOf(state, P1).hand).not.toContain(siryn.id);
    expect(playerOf(state, P2).hand).not.toContain(w.id);
  });
});
