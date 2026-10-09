/**
 * `announceDeckTops` (`deck-top.ts`) is called after every move of a card. Its gate, `deckTopRuleCanHold`: a game none
 * of whose cards prints "play with the top card of your deck faceup" (`RuleSpec topOfDeckFaceup`,
 * docs/phase7-wave8.md §3.48) never reads the rules in force, even when the ability registry holds that rule for some
 * other game's card, and is the same game it would be with a registry that has no such rule. A card of the game's own
 * pool, a scenario rule or a lasting grant opens it.
 */
import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { deckTopRuleCanHold } from "./deck-top.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const FACEUP = stubAbility("scope.constant", {
  trigger: { kind: "constant", rules: [{ kind: "topOfDeckFaceup", player: you }] },
  effects: [],
});
const SCOPE = stubSupport({ id: "scope", cost: 0, abilities: [FACEUP.ref] });
const NOTHING = stubAbility("nothing.action", { trigger: { kind: "action" }, effects: [] });
const NOTE = stubEvent({ id: "note", cost: 0, abilities: [NOTHING.ref] });

/** The registry holds the rule (for `scope`), as a registry assembled for every pack does. */
const withRule: EngineDeps = depsOf(FACEUP, NOTHING);
const withoutRule: EngineDeps = depsOf(NOTHING);

describe("announceDeckTops reads the rules in force only in a game that can have the rule", () => {
  it("the registry has the rule and no card of the game prints it: the gate is shut, and the game is unchanged", () => {
    const game = (deps: EngineDeps) => {
      const start = gameAtFirstTurn({ cards: [NOTE], deps, deck: [NOTE.id] });
      return playFree(start, deps, NOTE.id);
    };
    const gated = game(withRule);
    expect(deckTopRuleCanHold(gated.state, withRule)).toBe(false);
    expect(gated.state.deckTopsAnnounced).toBeUndefined();
    expect(gated.events.some((e) => e.type === "deckTopShown" || e.type === "deckTopHidden")).toBe(false);
    const plain = game(withoutRule);
    expect(gated.state).toEqual(plain.state);
    expect(gated.events).toEqual(plain.events);
  });

  it("a card of the game's own pool prints it: open before the card is in play, and shown once it is", () => {
    const start = gameAtFirstTurn({ cards: [SCOPE, NOTE], deps: withRule, deck: [SCOPE.id, NOTE.id] });
    expect(deckTopRuleCanHold(start, withRule)).toBe(true);
    // The same pool against a registry without the rule: shut.
    expect(deckTopRuleCanHold(start, withoutRule)).toBe(false);
    // Not in play yet: nothing is showing.
    expect(start.deckTopsAnnounced).toBeUndefined();
    const placed = playerCardIntoPlay(start, SCOPE.id);
    const { state, events } = playFree(placed.state, withRule, NOTE.id);
    expect(state.deckTopsAnnounced).toEqual({ [P1]: state.players[0]!.deck[0]! });
    expect(events.filter((e) => e.type === "deckTopShown")).toHaveLength(1);
  });

  it("the answer does not depend on the state object: a state loaded from a save reads the same", () => {
    const start = gameAtFirstTurn({ cards: [SCOPE, NOTE], deps: withRule, deck: [SCOPE.id, NOTE.id] });
    const loaded = JSON.parse(JSON.stringify(start)) as GameState;
    expect(deckTopRuleCanHold(loaded, withRule)).toBe(true);
    const bare = gameAtFirstTurn({ cards: [NOTE], deps: withRule, deck: [NOTE.id] });
    expect(deckTopRuleCanHold(JSON.parse(JSON.stringify(bare)) as GameState, withRule)).toBe(false);
  });

  it("a scenario rule or a lasting grant opens it with no such card in the pool", () => {
    const rule: RuleSpec = { kind: "topOfDeckFaceup", player: { kind: "firstPlayer" } };
    const start = gameAtFirstTurn({ cards: [NOTE], deps: withoutRule, deck: [NOTE.id], scenarioRuleSpecs: [rule] });
    expect(deckTopRuleCanHold(start, withoutRule)).toBe(true);
    expect(start.deckTopsAnnounced).toEqual({ [P1]: start.players[0]!.deck[0]! });

    const bare = gameAtFirstTurn({ cards: [NOTE], deps: withoutRule, deck: [NOTE.id] });
    expect(deckTopRuleCanHold(bare, withoutRule)).toBe(false);
    const granted: GameState = {
      ...bare,
      lastingEffects: [
        ...bare.lastingEffects,
        { id: "test.grant", kind: "ruleGrant", rule, scope: null, duration: { kind: "endOfPhase" } } as never,
      ],
    };
    expect(deckTopRuleCanHold(granted, withoutRule)).toBe(true);
  });
});
