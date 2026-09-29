/**
 * docs/phase7-wave4.md §3.9 (an ally treated as a minion), the parts `treat-as-minion.test.ts` does not cover, with a
 * synthetic card shaped like Manipulated Mind (`sm` 27171, errata RRG 1.8 p. 67: "Treat attached ally as a minion with a
 * blank text box (except for traits). Attached minion's SCH is equal to its printed THW and it does not take
 * consequential damage. When Revealed: Attach to the ally you control with the lowest cost. Attached ally engages its
 * controller. Otherwise, this card gains surge."):
 *
 * - the `controlledBy: "you"` host qualifier ("the ally **you control**"): RRG 1.8 "Ownership and Control" (p. 31):
 *   "you control" refers "only to cards in play currently under that player's control"; ties are the first player's
 *   choice (RRG 1.8 "First Player", p. 19);
 * - the treated minion activates in the villain phase as any engaged minion does (schemes for its printed THW, attacks
 *   for its printed ATK) and takes no consequential damage for it;
 * - when the attachment goes it keeps its ready/exhausted state (RRG 1.8 "Ownership and Control", p. 31: a character
 *   that changes control "remains in the same state (i.e., readied or exhausted, damaged or not, etc.)"; ruling, Dec 17,
 *   2025 (1) #3: "essentially a status change").
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { characterProfile, isMinion, minionsEngagedWith, mustInstance } from "./query.js";
import { categoriesOf, controllerOf, traitsOf } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubAttachment, stubEvent } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const HERO_TRAIT = trait("HERO");
const host: TargetRef = { kind: "host" };

// cost 1 / ATK 2 / THW 3, consequential damage 1 after it attacks or thwarts.
const CHEAP = stubAlly({ id: "cheap", cost: 1, atk: 2, thw: 3, hp: 5, traits: [HERO_TRAIT] });
const TWIN = stubAlly({ id: "twin", cost: 1, atk: 1, thw: 1, hp: 3 });
const DEAR = stubAlly({ id: "dear", cost: 3, atk: 1, thw: 1, hp: 3 });
const FREEBIE = stubAlly({ id: "freebie", cost: 0, atk: 1, thw: 1, hp: 3 });

const MIND_CONSTANT = stubAbility("mind.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "treatHostAsMinion", traits: [], schFromThw: true, keepPrintedTraits: true }],
  },
  effects: [],
});
const MIND_REVEALED = stubAbility("mind.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "engage", minion: host, player: { kind: "controllerOf", target: host } }],
});
const MIND = stubAttachment({
  id: "mind",
  attachesTo: { kind: "superlative", among: "ally", order: "lowest", measure: "printedCost", controlledBy: "you" },
  abilities: [MIND_CONSTANT.ref, MIND_REVEALED.ref],
});

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const FREE = event("free", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["attachment"] } } },
]);
const deps: EngineDeps = depsOf(MIND_CONSTANT, MIND_REVEALED, REVEAL.ability, FREE.ability);

function table(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: [CHEAP, TWIN, DEAR, FREEBIE, MIND, REVEAL.card, FREE.card],
    deps,
    encounter: [MIND.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [CHEAP.id, TWIN.id, DEAR.id, FREEBIE.id, REVEAL.card.id, FREE.card.id],
  });
}

const withForm = (state: GameState, form: "hero" | "alterEgo"): GameState => ({
  ...state,
  players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form } })),
});

/** P1 reveals Manipulated Mind from the top of the encounter deck; `pick` answers every choice (default: the first). */
function reveal(state: GameState, pick: (state: GameState) => readonly string[] = defaultPick) {
  const given = giveCard(onTopOfEncounterDeck(state, MIND.id), P1, REVEAL.card.id);
  const choices: string[][] = [];
  const recording = (s: GameState): readonly string[] => {
    choices.push((s.pendingChoice?.options ?? []).map((o) => o.optionId));
    return pick(s);
  };
  const play: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  const { state: after } = runCommandsPicking(given.state, deps, recording, play);
  return { state: after, choices };
}

const mindIn = (state: GameState): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === MIND.id)!.instanceId;

describe("§3.9 an ally treated as a minion: 'the ally you control with the lowest cost'", () => {
  it("attaches to the revealing player's cheapest ally, never a cheaper ally another player controls", () => {
    const two = table(2);
    const cheap = playerCardIntoPlay(two, CHEAP.id, P1);
    const dear = playerCardIntoPlay(cheap.state, DEAR.id, P1);
    const other = playerCardIntoPlay(dear.state, FREEBIE.id, P2);
    const { state } = reveal(other.state);
    expect(mustInstance(state, mindIn(state)).attachedTo).toBe(cheap.id);
    expect(isMinion(state, cheap.id)).toBe(true);
    expect(minionsEngagedWith(state, P1)).toContain(cheap.id);
    expect(isMinion(state, dear.id)).toBe(false);
    expect(isMinion(state, other.id)).toBe(false);
  });

  it("with only another player's ally in play, it has no host and is discarded", () => {
    const two = table(2);
    const other = playerCardIntoPlay(two, FREEBIE.id, P2);
    const { state } = reveal(other.state);
    expect(mustInstance(state, mindIn(state)).attachedTo).toBeNull();
    expect(isMinion(state, other.id)).toBe(false);
    expect(controllerOf(state, other.id)).toBe(P2);
  });

  it("a tie on the lowest cost is the first player's choice between the tied allies only", () => {
    const cheap = playerCardIntoPlay(table(), CHEAP.id);
    const twin = playerCardIntoPlay(cheap.state, TWIN.id);
    const dear = playerCardIntoPlay(twin.state, DEAR.id);
    const { state, choices } = reveal(dear.state, (s) => {
      const twinOption = s.pendingChoice?.options.find((o) => o.optionId.includes(twin.id));
      return twinOption ? [twinOption.optionId] : defaultPick(s);
    });
    const hostChoice = choices.find((options) => options.some((o) => o.includes(twin.id)))!;
    expect(hostChoice).toHaveLength(2);
    expect(hostChoice.some((o) => o.includes(cheap.id))).toBe(true);
    expect(hostChoice.some((o) => o.includes(dear.id))).toBe(false);
    expect(mustInstance(state, mindIn(state)).attachedTo).toBe(twin.id);
    expect(isMinion(state, twin.id)).toBe(true);
    expect(isMinion(state, cheap.id)).toBe(false);
  });
});

const villainPhase = (state: GameState) => runCommands(state, deps, { type: "endTurn", playerId: P1 });
const byMinion = (events: readonly GameEvent[], id: InstanceId) => ({
  activations: events.flatMap((e) => (e.type === "enemyActivated" && e.enemyInstanceId === id ? [e.activation] : [])),
  threat: events.flatMap((e) => (e.type === "threatPlaced" && e.sourceInstanceId === id ? [e.amount] : [])),
  damage: events.flatMap((e) => (e.type === "damageDealt" && e.sourceInstanceId === id ? [e.amount] : [])),
});

function manipulated(form: "hero" | "alterEgo"): { state: GameState; ally: InstanceId } {
  const placed = playerCardIntoPlay(withForm(table(), form), CHEAP.id);
  return { state: reveal(placed.state).state, ally: placed.id };
}

describe("§3.9 an ally treated as a minion in the villain phase", () => {
  it("attached: a minion with its printed traits and no text, SCH = printed THW, and no longer a card P1 can use", () => {
    const { state, ally } = manipulated("alterEgo");
    expect(categoriesOf(state, ally)).toEqual(["minion", "enemy", "character"]);
    expect(traitsOf(state, ally)).toEqual([HERO_TRAIT]);
    expect(characterProfile(state, ally, deps)).toMatchObject({ kind: "minion", sch: 3, atk: 2 });
    expect(controllerOf(state, ally)).toBeNull();
    const actions = legalActions(state, P1, deps);
    expect(actions.kind === "turn" && actions.legal.some((a) => JSON.stringify(a.action).includes(`"${ally}"`))).toBe(
      false,
    );
  });

  it("against an alter-ego it schemes for its printed THW and takes no consequential damage", () => {
    const { state, ally } = manipulated("alterEgo");
    const { state: after, events } = villainPhase(state);
    const mine = byMinion(events, ally);
    expect(mine.activations).toEqual(["scheme"]);
    expect(mine.threat).toEqual([3]);
    expect(mustInstance(after, ally).damage).toBe(0);
    expect(isMinion(after, ally)).toBe(true);
  });

  it("against a hero it attacks for its printed ATK and takes no consequential damage", () => {
    const { state, ally } = manipulated("hero");
    const { state: after, events } = villainPhase(state);
    const mine = byMinion(events, ally);
    expect(mine.activations).toEqual(["attack"]);
    expect(mine.damage).toEqual([2]);
    expect(mustInstance(after, ally).damage).toBe(0);
  });

  it("when the attachment goes it is P1's ally again, in the same exhausted state and with its damage", () => {
    const placed = playerCardIntoPlay(withForm(table(), "alterEgo"), CHEAP.id);
    const tired: GameState = {
      ...placed.state,
      instances: {
        ...placed.state.instances,
        [placed.id]: { ...mustInstance(placed.state, placed.id), exhausted: true, damage: 1 },
      },
    };
    const { state } = reveal(tired);
    expect(isMinion(state, placed.id)).toBe(true);
    const freed = playFree(state, deps, FREE.card.id).state;
    expect(categoriesOf(freed, placed.id)).toEqual(["ally", "character"]);
    expect(controllerOf(freed, placed.id)).toBe(P1);
    expect(mustInstance(freed, placed.id).exhausted).toBe(true);
    expect(mustInstance(freed, placed.id).damage).toBe(1);
  });
});
