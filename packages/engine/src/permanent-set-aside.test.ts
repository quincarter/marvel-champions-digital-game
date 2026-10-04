/**
 * docs/phase7-wave6.md §3.74 (Q15 = B): RRG 1.8 "Permanent" (p. 32): "Permanent cards are set aside before step 1 of
 * setup and are put into play later by abilities on other cards." `createGame` moves each player's permanent cards
 * (the printed keyword) to that player's set-aside area, logged `cardsSetAside { reason: "permanent" }`; they are never
 * shuffled, drawn or mulliganed, and an identity's Setup (Appendix II step 16) takes them from there. The deck-size count
 * already leaves them out (RRG 1.8 Appendix I, p. 50).
 *
 * Synthetic cards only; the engine never names a card.
 */
import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { validateDeck } from "./deck.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubIdentity, stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, MAIN_SCHEME, RESOURCE, VILLAIN } from "./testing/scenario.js";
import { P1 } from "./testing/wave3.js";
import { DEFAULT_DEPS } from "./abilities.js";

const YOUR_IDENTITY: TargetQuery = { categories: ["identity"], controller: "you" };
const FORM = stubUpgrade({ id: "form", cost: 0, keywords: [{ name: "permanent" }] });

/** "Setup: Put your form upgrade into play" (Vision's, Kitty Pryde's, Logan's shape), from the set-aside area. */
const SETUP = stubAbility("hero.setup", {
  trigger: { kind: "setup" },
  effects: [
    {
      kind: "selectCards",
      slot: "form",
      cards: { kind: "setAside", player: { kind: "controller" }, filter: { categories: ["upgrade"], name: "form" } },
    },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "form" }, controller: { kind: "controller" } },
    { kind: "attach", card: { kind: "slot", slot: "form" }, to: { kind: "each", query: YOUR_IDENTITY } },
  ],
});
const HERO_WITH_SETUP = stubIdentity({
  id: "setup-hero",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  alterEgoAbilities: [SETUP.ref],
});
const PLAIN_HERO = stubIdentity({
  id: "plain-hero",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});

const DECK: readonly CardId[] = [FORM.id, ...DEFAULT_DECK];

const config = (identityCardId: CardId, seed = 7): GameSetupConfig => ({
  seed,
  cards: [...DEFAULT_CARDS, FORM, HERO_WITH_SETUP, PLAIN_HERO],
  villainCardId: VILLAIN.id,
  mainSchemeCardId: MAIN_SCHEME.id,
  encounterDeck: [],
  includeIdentitySets: false,
  players: [{ identityCardId, deck: DECK }],
});

function setUp(identityCardId: CardId, deps: EngineDeps, seed?: number) {
  const result = createGame(config(identityCardId, seed), deps);
  if (!result.ok) throw new Error(result.error.message);
  return result;
}
const formId = (state: GameState): InstanceId =>
  (Object.keys(state.instances) as InstanceId[]).find((id) => state.instances[id]?.cardId === FORM.id)!;

describe("§3.74 permanent cards are set aside before setup step 1", () => {
  it("starts set aside, faceup and owned, never in the deck or the opening hand, for every seed; logged once", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { state, events } = setUp(PLAIN_HERO.id, DEFAULT_DEPS, seed);
      const kept = driveSession(startSession(state), DEFAULT_DEPS).session.state;
      const id = formId(kept);
      const player = mustPlayer(kept, P1);
      expect(player.setAside).toEqual([id]);
      expect(player.deck).not.toContain(id);
      expect(player.hand).not.toContain(id);
      // Every other card is in the deck or the hand: 24 of them.
      expect(player.deck.length + player.hand.length).toBe(DEFAULT_DECK.length);
      expect(mustInstance(kept, id)).toMatchObject({ ownerId: P1, faceup: true });
      // Right after gameCreated, before any shuffle.
      const at = events.findIndex((e) => e.type === "cardsSetAside");
      expect(events[at - 1]?.type).toBe("gameCreated");
      expect(events.filter((e) => e.type === "cardsSetAside")).toEqual([
        { type: "cardsSetAside", playerId: P1, instanceIds: [id], reason: "permanent" },
      ]);
      const firstShuffle = events.findIndex((e) => e.type === "deckShuffled");
      if (firstShuffle >= 0) expect(at).toBeLessThan(firstShuffle);
    }
  });

  it("a game with no permanent card logs no cardsSetAside", () => {
    const result = createGame({
      ...config(PLAIN_HERO.id),
      cards: DEFAULT_CARDS.concat(PLAIN_HERO),
      players: [{ identityCardId: PLAIN_HERO.id, deck: DEFAULT_DECK }],
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.events.some((e) => e.type === "cardsSetAside")).toBe(false);
  });

  it("a Setup (Appendix II step 16) puts it into play from set aside, attached; replays deep-equal", () => {
    const deps = depsOf(SETUP);
    const { state } = setUp(HERO_WITH_SETUP.id, deps);
    const { session } = driveSession(startSession(state), deps);
    const after = session.state;
    const id = formId(after);
    const player = mustPlayer(after, P1);
    expect(player.setAside).toEqual([]);
    expect(mustInstance(after, player.identity.instanceId).attachments).toContain(id);
    expect(mustInstance(after, id)).toMatchObject({ faceup: true, attachedTo: player.identity.instanceId });
    expect(player.deck.length + player.hand.length).toBe(DEFAULT_DECK.length);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the deck-size count is unchanged: a permanent card is not counted (RRG 1.8 p. 32, Appendix I p. 50)", () => {
    const pool = [...DEFAULT_CARDS, FORM, PLAIN_HERO];
    const sizeMessage = (cards: readonly { cardId: CardId; quantity: number }[]) => {
      const verdict = validateDeck({ identityCardId: PLAIN_HERO.id, aspects: [], cards }, pool);
      return verdict.ok ? undefined : verdict.problems.find((p) => p.code === "deck_size")?.message;
    };
    const resources = { cardId: RESOURCE.id, quantity: 30 };
    expect(sizeMessage([resources])).toContain("30 cards");
    expect(sizeMessage([resources, { cardId: FORM.id, quantity: 1 }])).toContain("30 cards");
  });
});
