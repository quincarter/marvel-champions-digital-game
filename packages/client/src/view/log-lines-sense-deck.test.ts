/**
 * Issue #782's game log: Superior Taste (60006) was played, discarded by its own cost, and went to the bottom of the
 * Sense deck instead (60001a/b Forced Interrupt). Both lines read "a facedown card", because by the end of the command
 * the card sat hidden in the deck, though everyone had just seen it in play. A card that went back into its separate
 * deck in the same command is named.
 */
import { cardOf, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { beforeAll, describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { startDevSenseHeroGame } from "../store/dev-sense-game.js";
import { SessionStore } from "../store/session-store.js";
import { logLine } from "./log-lines.js";

let game: GameState;
let me: PlayerId;
/** The Sense deck's bottom card: hidden from everyone (only the top is faceup). */
let bottom: InstanceId;

beforeAll(async () => {
  const store = new SessionStore(new LocalEngineHost());
  await startDevSenseHeroGame(store);
  game = store.state.game!;
  me = game.players[0]!.playerId;
  const deck = game.players[0]!.separateDecks["Sense"]!.deck;
  bottom = deck[deck.length - 1]!;
}, 120_000);

const returned = (replaced = true): GameEvent =>
  ({
    type: "returnedToSeparateDeck",
    instanceId: bottom,
    cardId: game.instances[bottom]!.cardId,
    playerId: me,
    name: "Sense",
    instead: "discard",
    ...(replaced ? { replaced: true } : {}),
  }) as GameEvent;
const resolved = (): GameEvent => {
  const card = cardOf(game, bottom)!;
  const abilityId = (card as { abilities: readonly { id: string }[] }).abilities[0]!.id;
  return { type: "abilityResolved", instanceId: bottom, abilityId } as unknown as GameEvent;
};

describe("a Sense upgrade that goes back into the Sense deck is named in the log", () => {
  test("the return line names it, not 'a facedown card'", () => {
    const name = cardOf(game, bottom)!.name;
    expect(logLine(returned(), game, me, POOL_DEPS)?.text).toBe(
      `${name} goes back into Your Sense deck, facedown, instead of leaving it.`,
    );
  });

  test("its ability's line in the same command names it too", () => {
    const name = cardOf(game, bottom)!.name;
    const events = [returned(), resolved()];
    const text = logLine(events[1]!, game, me, POOL_DEPS, false, undefined, { events, at: 1 })?.text;
    expect(text?.startsWith(`${name} — `)).toBe(true);
  });

  test("a return that was not a card leaving play (a move from a hidden zone) stays unnamed", () => {
    const name = cardOf(game, bottom)!.name;
    const events = [returned(false), resolved()];
    expect(logLine(events[0]!, game, me, POOL_DEPS, false, undefined, { events, at: 0 })?.text).not.toContain(name);
    expect(logLine(events[1]!, game, me, POOL_DEPS, false, undefined, { events, at: 1 })?.text).not.toContain(name);
  });

  test("a card still hidden in the deck with no return in the command stays unnamed", () => {
    const events = [resolved()];
    const text = logLine(events[0]!, game, me, POOL_DEPS, false, undefined, { events, at: 0 })?.text;
    expect(text).not.toContain(cardOf(game, bottom)!.name);
  });
});
