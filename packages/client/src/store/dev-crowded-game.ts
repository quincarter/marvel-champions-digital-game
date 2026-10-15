/**
 * The `?screen=board&fixture=crowded` dev jump (`scenes/boot.ts`): a real three-seat Rhino game stopped on Spider-Man's
 * turn once the table is full, for checking every Card size setting against a lot of cards at once (Settings > Card
 * size: Fit to screen, Same size, Large, Extra large). `dev-crowded-game.test.ts` proves it reaches the state.
 *
 * Played forward through the store with `SessionConfig.stack` and the engine's own example commands, never a state
 * edit, so it replays byte for byte like any saved game. Every seat stays in alter-ego form (hand size 6, and Rhino only
 * schemes), plays allies, supports and upgrades it can pay for with its other hand cards, and ends its turn. The
 * stacked encounter deck puts two minions and two side schemes on the table by round 3.
 */
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

/** The permanents a seat can put on the table in alter-ego form. */
const PLAYABLE = new Set(["ally", "support", "upgrade"]);

const typeOf = (game: GameState, id: string): string => game.cardPool[codeOf(game, id)]?.type ?? "";

/** Boost card, then one reveal per seat, for each of the first rounds (the stack is read in draw order). */
export const CROWDED_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [
    { starterDeckId: "drs-protection" },
    { starterDeckId: "core-spider-man-justice" },
    { starterDeckId: "core-captain-marvel-leadership" },
  ],
  seed: 7,
  stack: {
    // Cheap permanents on top of each hand, so three plays fit in a turn.
    players: {
      0: ids(
        "09008",
        "09019",
        "09009",
        "09017",
        "09017",
        "09015",
        "09011",
        "09013",
        "09022",
        "09023",
        "09024",
        "09016",
      ),
      1: ids("01006", "01007", "01008", "01063"),
      2: ids("01015", "01018", "01018", "01073"),
    },
    // Three boosts with no icons (one per seat, so the main scheme gets no extra threat), then one reveal per seat:
    // Hydra Mercenary, Sandman, Breakin' & Takin'; round 2 the same shape with Crowd Control.
    encounter: ids("01104", "01104", "01105", "01101", "01102", "01107", "01105", "01106", "01106", "01108"),
  },
};

/** True once the table holds what the fixture promises (the test and the stop condition read the same thing). */
/** The cards a seat put in play, upgrades on its identity included: engaged minions share the zone and are not counted. */
export const ownCards = (game: GameState, seat: GameState["players"][number]): number =>
  seat.playArea.filter((id) => PLAYABLE.has(typeOf(game, id))).length +
  (game.instances[seat.identity.instanceId]?.attachments.length ?? 0);

/** Minions engaged with any seat. */
export const minionCount = (game: GameState): number =>
  game.players.reduce(
    (sum, seat) => sum + seat.playArea.filter((id) => game.cardPool[codeOf(game, id)]?.type === "minion").length,
    0,
  );

/** Side schemes in play. */
export const sideSchemeCount = (game: GameState): number =>
  game.villainArea.filter((id) => game.cardPool[codeOf(game, id)]?.type === "side_scheme").length;

export function crowdedReached(game: GameState): boolean {
  return (
    game.players.length === 3 &&
    ownCards(game, game.players[0]!) >= 4 &&
    game.players.slice(1).every((player) => ownCards(game, player) >= 2) &&
    game.players[0]!.hand.length >= 6 &&
    minionCount(game) >= 2 &&
    sideSchemeCount(game) >= 2
  );
}

/** Starts the game and plays it forward to Doctor Strange's turn with the table full. */
export async function startCrowdedGame(store: SessionStore): Promise<void> {
  await store.start(CROWDED_CONFIG);
  for (let step = 0; step < 120; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const active = game.players.find((player) => player.playerId === store.state.legal?.playerId);
    if (!active) return;
    if (active === game.players[0] && game.round >= 3 && crowdedReached(game)) {
      // Doctor Strange discards the top card of his Invocation deck (Natural Talent, once per phase), so both piles show.
      const talent = turn.legal.find(
        (entry) => entry.action.kind === "useAbility" && /natural-talent/.test(String(entry.action.abilityId)),
      );
      if (talent) await store.dispatch(talent.example);
      return;
    }
    // Play what can be paid for, one card at a time, re-reading the (changed) state after each play.
    let played = false;
    for (const entry of turn.legal) {
      const action = entry.action;
      if (action.kind !== "playCard" || entry.example.type !== "playCard") continue;
      if (!PLAYABLE.has(typeOf(game, action.instanceId))) continue;
      // Pay with cards that are not themselves permanents first, so the cheap permanents stay for later turns.
      const others = active.hand
        .filter((id) => id !== action.instanceId)
        .sort((a, b) => Number(PLAYABLE.has(typeOf(game, a))) - Number(PLAYABLE.has(typeOf(game, b))));
      for (let count = 0; count <= others.length && !played; count++) {
        await store.dispatch({ ...entry.example, payment: others.slice(0, count).map((id) => ({ fromHand: id })) });
        if (!store.state.error) played = true;
      }
      if (played) break;
    }
    if (played) continue;
    // The teammates flip to hero form on their first turn (Captain Marvel reads as a hero beside an alter-ego Spider-Man).
    if (active !== game.players[0]) {
      const flip = turn.legal.find((entry) => entry.action.kind === "changeForm");
      if (flip) {
        await store.dispatch(flip.example);
        continue;
      }
    }
    const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
