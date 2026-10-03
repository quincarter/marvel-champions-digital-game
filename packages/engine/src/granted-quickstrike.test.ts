/**
 * A quickstrike a constant ability grants is read as the minion engages, the same as a printed one.
 *
 * RRG 1.8 "Quickstrike" (p. 36): "After a minion with the quickstrike keyword engages a player whose identity is in
 * hero form, that minion attacks that player." The keyword is read as the minion engages, so "Each minion gains
 * quickstrike" on a card already in play counts (The Mojo Files, `mojo` 39047; The Brotherhood, `mut_gen` 32079).
 */

import { flat, type KeywordInstance, type MinionCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import { playerId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { activeEncounterDeck, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubMainScheme, stubMinion, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_DECK, giveCard, newGame, withEncounterPiles } from "./testing/scenario.js";

const p1 = playerId("p1");
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };

const VILLAIN = stubVillain({ id: "boss", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

/** "Each minion gains quickstrike." */
const FILES_CONSTANT = stubAbility("files.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [{ keyword: { name: "quickstrike" }, target: { categories: ["minion"] } }],
  },
  effects: [],
});
const FILES = stubSupport({ id: "files", cost: 0, abilities: [FILES_CONSTANT.ref] });

/** "Boost: Put this card into play engaged with you." — a minion engaging outside a reveal (`putIntoPlay`). */
const LURKER_BOOST = stubAbility("lurker.boost", {
  trigger: { kind: "boost" },
  effects: [{ kind: "putIntoPlay", card: { kind: "self" }, controller: { kind: "controller" } }],
});

const minion = (keywords: readonly KeywordInstance[] = []) =>
  stubMinion({ id: "striker", atk: 3, sch: 1, hp: 5, boostIcons: 0, keywords });
const LURKER = stubMinion({ id: "lurker", atk: 3, sch: 1, hp: 5, boostIcons: 1, abilities: [LURKER_BOOST.ref] });

const deps: EngineDeps = depsOf(FILES_CONSTANT, LURKER_BOOST);

/** p1's first turn, `top` on top of the encounter deck over blanks; `granted` puts the granting card in p1's play area. */
function game(top: MinionCard, granted: boolean): GameState {
  const start = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: [top, BLANK, FILES],
    encounterDeck: [top.id, ...Array.from({ length: 12 }, () => BLANK.id)],
    deck: [...DEFAULT_DECK, FILES.id],
    deps,
  });
  const deck = activeEncounterDeck(start).deck;
  const topId = deck.find((id) => start.instances[id]?.cardId === top.id);
  if (!topId) throw new Error(`no ${top.id}`);
  const state = withEncounterPiles(start, { deck: [topId, ...deck.filter((id) => id !== topId)] });
  if (!granted) return state;
  const given = giveCard(state, p1, FILES.id);
  return runCommands(given.state, deps, {
    type: "playCard",
    playerId: p1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
}

/** How many times the one copy of `card` in p1's play area attacked. */
function attacksBy(state: GameState, events: readonly GameEvent[], card: MinionCard): number {
  const id = mustPlayer(state, p1).playArea.find((i) => state.instances[i]?.cardId === card.id);
  if (!id) throw new Error(`${card.id} is not engaged with p1`);
  expect(hasKeyword(state, id, "quickstrike")).toBe(card.keywords.some((k) => k.name === "quickstrike"));
  return events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === id).length;
}

describe("a granted quickstrike at engagement (RRG 1.8 p. 36)", () => {
  // The blank on top is the villain's boost card, so the minion is the card the player is dealt and reveals.
  const revealed = (card: MinionCard, granted: boolean, ...commands: readonly Command[]) => {
    const start = game(card, granted);
    const deck = activeEncounterDeck(start).deck;
    const swapped = withEncounterPiles(start, { deck: [deck[1]!, deck[0]!, ...deck.slice(2)] });
    const { state, events } = runCommands(swapped, deps, ...commands);
    return attacksBy(state, events, card);
  };

  it("a revealed minion granted quickstrike attacks the hero it engages", () => {
    expect(revealed(minion(), false, toHero, endTurn)).toBe(0);
    expect(revealed(minion(), true, toHero, endTurn)).toBe(1);
  });

  it("it does not attack a player in alter-ego form", () => {
    expect(revealed(minion(), true, endTurn)).toBe(0);
  });

  it("a printed quickstrike still attacks, and a grant on top of it adds no second attack", () => {
    expect(revealed(minion([{ name: "quickstrike" }]), false, toHero, endTurn)).toBe(1);
    expect(revealed(minion([{ name: "quickstrike" }]), true, toHero, endTurn)).toBe(1);
  });

  it("a minion put into play engaged by an effect (not revealed) is read the same way", () => {
    // The villain's attack flips the minion as its boost card; it engages, then activates with the other minions.
    const attacks = (granted: boolean, ...commands: readonly Command[]) => {
      const { state, events } = runCommands(game(LURKER, granted), deps, ...commands);
      return attacksBy(state, events, LURKER);
    };
    const withoutGrant = attacks(false, toHero, endTurn);
    expect(attacks(true, toHero, endTurn)).toBe(withoutGrant + 1);
  });
});
