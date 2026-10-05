/**
 * Real one-seat games stopped on the board where a play's cost leaves a choice among cards in play: the hero in hero
 * form with ready allies out and a card in hand whose cost is "exhaust any number of allies". Played forward through
 * the store with `SessionConfig.stack` (the opening hand) and the engine's own example commands, never a state edit, so
 * each replays byte for byte like any saved game. Kept out of `boot.ts`; `dev-in-play-cost-games.test.ts` proves each
 * reaches the state it claims.
 *
 * - `startPeacekeepersDevGame`: Phoenix with Cyclops and Marvel Girl in play and Mutant Peacekeepers (34018, "any number
 *   of X-MEN allies") in hand.
 * - `startStrengthInNumbersDevGame`: Captain America with Squirrel Girl and Wonder Man and Strength in Numbers (03017,
 *   "any number of allies", a card drawn for each) in hand; it costs nothing to play.
 * - `startTeamStrikeDevGame`: Wolverine with Jubilee and Sunfire and Team Strike (32045, "any number of X-MEN allies")
 *   in hand.
 */
import { WAVE6_STARTER_DECKS } from "@mc/content";
import { cardsInPlay } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, copies, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const PEACEKEEPERS_CARD = "34018";
const CYCLOPS = "34003";
const MARVEL_GIRL = "34015";

export const PEACEKEEPERS_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "phoenix-justice" }],
  seed: 3,
  stack: {
    players: {
      0: ids(CYCLOPS, MARVEL_GIRL, ...copies("34016", 3), ...copies("34024", 3), ...copies(PEACEKEEPERS_CARD, 3)),
    },
  },
};

/**
 * Plays a one-seat game forward on the engine's own example commands until the hero is in hero form on its own turn
 * with every ally in play, ready, and `held` in hand: each turn flips once, plays an ally paid for with other cards only
 * (every card but the allies and the held one), and otherwise ends the turn.
 */
async function playAlliesForward(
  store: SessionStore,
  setup: {
    readonly allies: readonly string[];
    readonly held: string;
    readonly cost: number;
  },
): Promise<void> {
  for (let step = 0; step < 40; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const me = game.players[0]!;
    const inPlay = (code: string): boolean => cardsInPlay(game).some((id) => codeOf(game, id) === code);
    const held = me.hand.some((id) => codeOf(game, id) === setup.held);
    if (me.identity.form === "hero" && setup.allies.every(inPlay) && held) return;
    const flip = me.identity.form === "alterEgo" ? turn.legal.find((e) => e.action.kind === "changeForm") : undefined;
    if (flip) {
      await store.dispatch(flip.example);
      continue;
    }
    const ally = turn.legal.find(
      (e) => e.action.kind === "playCard" && setup.allies.includes(codeOf(game, e.action.instanceId)),
    );
    if (ally?.example.type === "playCard") {
      const filler = me.hand.filter((id) => ![...setup.allies, setup.held].includes(codeOf(game, id)));
      if (filler.length >= setup.cost) {
        await store.dispatch({
          ...ally.example,
          payment: filler.slice(0, setup.cost).map((fromHand) => ({ fromHand })),
        });
        continue;
      }
    }
    const end = turn.legal.find((e) => e.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}

export async function startPeacekeepersDevGame(store: SessionStore): Promise<void> {
  await store.start(PEACEKEEPERS_DEV_CONFIG);
  await playAlliesForward(store, {
    allies: [CYCLOPS, MARVEL_GIRL],
    held: PEACEKEEPERS_CARD,
    cost: 3, // Cyclops and Marvel Girl both cost 3.
  });
}

export const TEAM_STRIKE_CARD = "32045";
const WOLVERINE_DECK = WAVE6_STARTER_DECKS.find((deck) => (deck.id as string) === "wolverine-aggression")!;

/** Wolverine's precon with his three Mean Swing (35019) swapped for three Team Strike, which keeps the deck legal at 40. */
export const TEAM_STRIKE_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [
    {
      identityCardId: WOLVERINE_DECK.identityCardId as string,
      deck: [
        ...WOLVERINE_DECK.cards
          .flatMap((entry) => Array<string>(entry.quantity).fill(entry.cardId as string))
          .filter((code) => code !== "35019"),
        ...copies(TEAM_STRIKE_CARD, 3),
      ],
      aspects: ["aggression"],
    },
  ],
  seed: 3,
  stack: {
    players: { 0: ids("35003", "35014", TEAM_STRIKE_CARD, ...copies("35015", 3), ...copies("35016", 3)) },
  },
};

/** Wolverine (hero side) with Jubilee and Sunfire, two X-MEN allies, ready in play and Team Strike in hand. */
export async function startTeamStrikeDevGame(store: SessionStore): Promise<void> {
  await store.start(TEAM_STRIKE_DEV_CONFIG);
  await playAlliesForward(store, {
    allies: ["35003", "35014"],
    held: TEAM_STRIKE_CARD,
    cost: 2, // Jubilee and Sunfire both cost 2.
  });
}

export const STRENGTH_IN_NUMBERS_CARD = "03017";
export const STRENGTH_IN_NUMBERS_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "cap-leadership" }],
  seed: 3,
  stack: {
    players: {
      0: ids("03013", "03014", STRENGTH_IN_NUMBERS_CARD, ...copies("03004", 3), ...copies("03018", 2)),
    },
  },
};

/** Captain America (hero side) with Squirrel Girl and Wonder Man ready in play and Strength in Numbers in hand. */
export async function startStrengthInNumbersDevGame(store: SessionStore): Promise<void> {
  await store.start(STRENGTH_IN_NUMBERS_DEV_CONFIG);
  await playAlliesForward(store, {
    allies: ["03013", "03014"],
    held: STRENGTH_IN_NUMBERS_CARD,
    cost: 2, // Squirrel Girl and Wonder Man both cost 2.
  });
}
