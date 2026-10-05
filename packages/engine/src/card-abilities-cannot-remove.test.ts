/**
 * docs/phase7-wave7.md §3.10, §4.1 Q7: "Card abilities cannot remove this ally from play" is `RuleSpec cannotLeavePlay`
 * with `by: "cardAbilities"`. An effect that moves the card out of play (discard, return to hand or deck, removal from
 * the game, a swap with a card out of play) or says "defeat" does nothing to it when a card's ability resolves it or
 * pays it as a cost. The source is the card whose ability is resolving, as the Permanent keyword's protection reads it
 * (`effects.ts` `permanentStopsLeaving`, docs/phase7-wave5.md §4.1 Q46).
 *
 * The game's own rules have no source card and still remove it. RRG 1.8 "Ally" (p. 7) tells the two apart: an ally
 * "remains in play until a card ability or game effect causes it to leave play. If an ally's remaining hit points are
 * reduced to zero, it is defeated and discarded from play." So damage from any source still defeats it ("Defeat",
 * p. 15), the ally limit's discard still takes it ("Ally Limit", p. 7: the player "must immediately choose and discard
 * from play ally cards they control"; the RRG does not call that a card ability), and so does its controller's
 * elimination ("Player Elimination", p. 34). The unqualified rule stays absolute (RRG 1.8 "'Cannot'", p. 11).
 *
 * Synthetic cards only: a guarded ally, the same with Victory 1, an ally under the unqualified rule and a plain one.
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import { inPlayCostCandidates } from "./actions.js";
import { applyCommand, replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { canDiscardFromPlay } from "./resolve/target-validity.js";
import { cannotLeavePlay, cardAbilitiesCannotRemove } from "./rules.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  playerCardIntoPlay,
  playFree,
  P1,
  P2,
} from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const SELF = { self: true } as const;

// "Card abilities cannot remove this ally from play."
const GUARDED_RULE = stubAbility("guarded.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotLeavePlay", target: SELF, by: "cardAbilities" }] },
  effects: [],
});
// "This ally cannot leave play."
const ROOTED_RULE = stubAbility("rooted.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotLeavePlay", target: SELF }] },
  effects: [],
});
const GUARDED = stubAlly({ id: "guarded", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [GUARDED_RULE.ref] });
/** "Victory 1." as well: defeated, it goes to the victory display. */
const TROPHY = stubAlly({
  id: "trophy",
  cost: 0,
  atk: 1,
  thw: 1,
  hp: 2,
  keywords: [{ name: "victory", value: 1 }],
  abilities: [GUARDED_RULE.ref],
});
const ROOTED = stubAlly({ id: "rooted", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [ROOTED_RULE.ref] });
/** No rule: the control. */
const PLAIN = stubAlly({ id: "plain", cost: 0, atk: 1, thw: 1, hp: 2 });
const EXTRA = stubAlly({ id: "extra", cost: 0, atk: 1, thw: 1, hp: 2 });
const GEAR = stubUpgrade({ id: "gear", cost: 0 });

const draw: EffectSpec = { kind: "draw", player: you, amount: { kind: "const", value: 1 } };
const BOTH: TargetRef = { kind: "each", query: { categories: ["ally"] } };
const moveBoth = (to: "hand" | "deckShuffle" | "deckTop" | "removedFromGame"): readonly EffectSpec[] => [
  { kind: "moveCards", cards: { kind: "ref", ref: BOTH }, to },
  draw,
];

/** A player event and a treachery (When Revealed) that each resolve `effects`. */
function sources(id: string, effects: readonly EffectSpec[], cost?: AbilityCost) {
  const action = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...(cost ? { cost } : {}) });
  const revealed = stubAbility(`bad-${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects });
  return {
    abilities: [action, revealed],
    event: stubEvent({ id, cost: 0, abilities: [action.ref] }),
    treachery: stubTreachery({ id: `bad-${id}`, boostIcons: 0, abilities: [revealed.ref] }),
  };
}

// "Discard each ally. Draw 1 card."
const DISCARD = sources("discard", [{ kind: "discardFromPlay", target: BOTH }, draw]);
// "Defeat each ally. Draw 1 card."
const DEFEAT = sources("defeat", [{ kind: "defeat", target: BOTH }, draw]);
// "Return each ally to its owner's hand." / "Shuffle each ally into its owner's deck." / "Put each ally on top of its
// owner's deck." / "Remove each ally from the game." Each then "Draw 1 card."
const TO_HAND = sources("to-hand", moveBoth("hand"));
const TO_DECK = sources("to-deck", moveBoth("deckShuffle"));
const TO_DECK_TOP = sources("to-deck-top", moveBoth("deckTop"));
const REMOVE = sources("remove", moveBoth("removedFromGame"));
// "Take each ally into your hand. Draw 1 card."
const TAKE = sources("take", [{ kind: "takeIntoHand", cards: { kind: "ref", ref: BOTH }, player: you }, draw]);
// "Deal 2 damage to each ally."
const ZAP = sources("zap", [{ kind: "dealDamage", target: BOTH, amount: { kind: "const", value: 2 } }]);
// "Deal 2 indirect damage to you."
const SPREAD = sources("spread", [{ kind: "dealIndirectDamage", to: you, amount: { kind: "const", value: 2 } }]);
// "The villain attacks you."
const SMITE = sources("smite", [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: you }]);
// "Reveal the top card of the encounter deck."
const REVEAL = sources("reveal", [{ kind: "revealEncounterCard", player: you }]);
// "Deal 99 damage to your identity."
const FALL = sources("fall", [
  { kind: "dealDamage", target: { kind: "identityOf", player: you }, amount: { kind: "const", value: 99 } },
]);
// "Discard an ally you control → draw 1 card." / "Return an ally you control to your hand → draw 1 card."
const ALLY_PICK = { slot: "paid", query: { categories: ["ally"] }, min: 1, max: 1 } as const;
const SACRIFICE = sources("sacrifice", [draw], { discardCards: ALLY_PICK });
const RECALL = sources("recall", [draw], { returnToHand: ALLY_PICK });
// "Discard the guarded ally → draw 1 card."
const SACRIFICE_GUARDED = sources("sacrifice-guarded", [draw], {
  discardCards: { slot: "paid", query: { categories: ["ally"], name: "guarded" }, min: 1, max: 1 },
});

const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const MOVES = [DISCARD, TO_HAND, TO_DECK, TO_DECK_TOP, REMOVE, TAKE];
const ALL = [...MOVES, DEFEAT, ZAP, SPREAD, SMITE, REVEAL, FALL, SACRIFICE, RECALL, SACRIFICE_GUARDED];
const ALLIES = [GUARDED, TROPHY, ROOTED, PLAIN, EXTRA];

const deps: EngineDeps = depsOf(GUARDED_RULE, ROOTED_RULE, ...ALL.flatMap((set) => set.abilities));
const CARDS: readonly AnyCard[] = [...ALLIES, GEAR, FILLER, ...ALL.flatMap((set) => [set.event, set.treachery])];

function start(players: 1 | 2 = 1): GameState {
  return gameAtFirstTurn({
    players,
    cards: CARDS,
    deps,
    deck: [...ALLIES.map((ally) => ally.id), ...copiesOf(EXTRA.id, 2), GEAR.id, ...ALL.map((set) => set.event.id)],
    encounter: [...ALL.map((set) => set.treachery.id), ...copiesOf(FILLER.id, 20)],
  });
}

/** `protectedCard` with 1 damage and GEAR attached, and PLAIN, in P1's play area. */
function table(protectedCard: AnyCard = GUARDED, players: 1 | 2 = 1) {
  const guarded = playerCardIntoPlay(start(players), protectedCard.id);
  const plain = playerCardIntoPlay(guarded.state, PLAIN.id);
  const gear = playerCardIntoPlay(plain.state, GEAR.id);
  const state: GameState = {
    ...gear.state,
    players: gear.state.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== gear.id) } : p,
    ),
    instances: {
      ...gear.state.instances,
      [gear.id]: { ...mustInstance(gear.state, gear.id), attachedTo: guarded.id },
      [guarded.id]: { ...mustInstance(gear.state, guarded.id), damage: 1, attachments: [gear.id] },
    },
  };
  return { state, guarded: guarded.id, plain: plain.id, gear: gear.id };
}

/** Resolves a source's effects from its player event, or from its treachery revealed off the encounter deck. */
function resolve(state: GameState, source: ReturnType<typeof sources>, from: "player" | "encounter") {
  if (from === "player") return playFree(state, deps, source.event.id);
  return playFree(onTopOfEncounterDeck(state, source.treachery.id), deps, REVEAL.event.id);
}

const blocked = (events: readonly GameEvent[]) => events.filter((e) => e.type === "leavePlayBlocked");
const defeats = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "characterDefeated" ? [e.instanceId] : []));
const drew = (events: readonly GameEvent[]) => events.some((e) => e.type === "cardDrawn");

function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

/** The guarded ally is in P1's play area exactly as `table` left it. */
function expectUntouched(before: GameState, after: GameState, t: ReturnType<typeof table>) {
  expect(mustPlayer(after, P1).playArea.indexOf(t.guarded)).toBe(mustPlayer(before, P1).playArea.indexOf(t.guarded));
  expect(mustInstance(after, t.guarded)).toEqual(mustInstance(before, t.guarded));
  expect(mustInstance(after, t.gear)).toEqual(mustInstance(before, t.gear));
}

describe("§3.10 'Card abilities cannot remove this ally from play' (cannotLeavePlay by cardAbilities)", () => {
  describe.each(["player", "encounter"] as const)("an effect of a %s card's ability", (from) => {
    it.each([
      ["discard", DISCARD],
      ["return to hand", TO_HAND],
      ["shuffle into a deck", TO_DECK],
      ["put on top of a deck", TO_DECK_TOP],
      ["remove from the game", REMOVE],
      ["take into hand", TAKE],
    ] as const)(
      "%s: the guarded ally stays as it was, the plain one moves, the rest resolves; replay deep-equal",
      (_label, source) => {
        const t = table();
        const { state: after, events, session } = resolve(t.state, source, from);

        expectUntouched(t.state, after, t);
        expect(blocked(events)).toEqual([
          { type: "leavePlayBlocked", instanceId: t.guarded, reason: "cannotLeavePlay" },
        ]);
        expect(cardsInPlay(after)).not.toContain(t.plain);
        expect(drew(events)).toBe(true);
        expect(events.some((e) => e.type === "ownershipChanged")).toBe(false);
        expectReplays(session);
      },
    );

    it("'defeat': the guarded ally is not defeated, the plain one is, the rest resolves; replay deep-equal", () => {
      const t = table();
      const { state: after, events, session } = resolve(t.state, DEFEAT, from);

      expectUntouched(t.state, after, t);
      expect(defeats(events)).toEqual([t.plain]);
      expect(blocked(events)).toEqual([{ type: "leavePlayBlocked", instanceId: t.guarded, reason: "cannotLeavePlay" }]);
      expect(mustPlayer(after, P1).discard).toContain(t.plain);
      expect(drew(events)).toBe(true);
      expectReplays(session);
    });

    it("damage still defeats it at 0 hit points: it is discarded with its attachment; replay deep-equal", () => {
      const t = table();
      const { state: after, events, session } = resolve(t.state, ZAP, from);

      expect(defeats(events)).toEqual(expect.arrayContaining([t.guarded, t.plain]));
      expect(blocked(events)).toEqual([]);
      expect(cardsInPlay(after)).not.toContain(t.guarded);
      expect(mustPlayer(after, P1).discard).toEqual(expect.arrayContaining([t.guarded, t.gear, t.plain]));
      expectReplays(session);
    });

    it("with Victory 1, damage sends it to the victory display, where a defeated card of its kind goes", () => {
      const t = table(TROPHY);
      const { state: after, events } = resolve(t.state, ZAP, from);

      expect(defeats(events)).toContain(t.guarded);
      expect(after.victoryDisplay).toContain(t.guarded);
      expect(mustPlayer(after, P1).discard).not.toContain(t.guarded);
    });
  });

  it("an enemy attack it defends still defeats it; replay deep-equal", () => {
    const t = table();
    const given = giveCard(t.state, P1, SMITE.event.id);
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "declareDefender") return defaultPick(state);
      const defend = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === t.guarded);
      return defend ? [defend.optionId] : ["decline"];
    };
    const {
      state: after,
      events,
      session,
    } = runCommandsPicking(given.state, deps, pick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });

    expect(defeats(events)).toEqual([t.guarded]);
    expect(mustPlayer(after, P1).discard).toEqual(expect.arrayContaining([t.guarded, t.gear]));
    expect(cardsInPlay(after)).toContain(t.plain);
    expectReplays(session);
  });

  it("indirect damage assigned to it still defeats it; replay deep-equal", () => {
    const t = table();
    const given = giveCard(t.state, P1, SPREAD.event.id);
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "assignIndirectDamage") return defaultPick(state);
      return choice.options
        .filter((o) => o.optionId.startsWith(`${t.guarded}#`))
        .slice(0, 1)
        .concat(choice.options.filter((o) => o.optionId.startsWith(`${t.plain}#`)).slice(0, 1))
        .map((o) => o.optionId);
    };
    const {
      state: after,
      events,
      session,
    } = runCommandsPicking(given.state, deps, pick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });

    // It had 1 damage of its 2 hit points: 1 more defeats it. The plain ally, undamaged, takes 1 and stays.
    expect(defeats(events)).toEqual([t.guarded]);
    expect(mustPlayer(after, P1).discard).toContain(t.guarded);
    expect(mustInstance(after, t.plain).damage).toBe(1);
    expectReplays(session);
  });

  it("its controller's elimination removes it from play (RRG 1.8 'Player Elimination', p. 34); replay deep-equal", () => {
    const t = table(GUARDED, 2);
    const { state: after, events, session } = playFree(t.state, deps, FALL.event.id);

    expect(mustPlayer(after, P1).eliminated).toBe(true);
    expect(cardsInPlay(after)).not.toContain(t.guarded);
    expect(blocked(events)).toEqual([]);
    expect(after.outcome).toBeFalsy();
    expectReplays(session);
  });

  it("eliminated while a player who does not own it controls it, it leaves play too", () => {
    const t = table(GUARDED, 2);
    // Test surgery: P2's card, under P1's control in P1's play area.
    const borrowed: GameState = {
      ...t.state,
      instances: { ...t.state.instances, [t.guarded]: { ...mustInstance(t.state, t.guarded), ownerId: P2 } },
    };
    const { state: after, events } = playFree(borrowed, deps, FALL.event.id);

    expect(cardsInPlay(after)).not.toContain(t.guarded);
    expect(mustPlayer(after, P2).discard).toContain(t.guarded);
    expect(blocked(events)).toEqual([]);
  });

  it("the ally limit's discard is a game rule: it is offered and, chosen, discarded (RRG 1.8 'Ally Limit', p. 7); replay deep-equal", () => {
    let state = table().state;
    const guarded = mustPlayer(state, P1).playArea.find((id) => mustInstance(state, id).cardId === GUARDED.id)!;
    for (let i = 0; i < 2; i++) state = playerCardIntoPlay(state, EXTRA.id).state;
    const offered: string[] = [];
    const pick = (now: GameState): readonly string[] => {
      const choice = now.pendingChoice;
      if (choice?.prompt.kind !== "discardOverAllyLimit") return defaultPick(now);
      offered.push(...choice.options.map((o) => o.optionId));
      return [guarded];
    };
    // Any command lets the check between frames run: four allies over a limit of three.
    const given = giveCard(state, P1, REVEAL.event.id);
    const {
      state: after,
      events,
      session,
    } = runCommandsPicking(given.state, deps, pick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });

    expect(offered).toContain(guarded);
    expect(mustPlayer(after, P1).discard).toContain(guarded);
    expect(defeats(events)).toEqual([]);
    expect(blocked(events)).toEqual([]);
    expectReplays(session);
  });

  it("a cost that discards or returns an ally cannot be paid with it: it is not offered (RRG 1.8 'Cost', p. 13)", () => {
    const t = table();
    const options = (source: ReturnType<typeof sources>, mode: "discard" | "return") => {
      const card = giveCard(t.state, P1, source.event.id);
      return inPlayCostCandidates(card.state, deps, card.id, P1, mode, ALLY_PICK);
    };
    expect(options(SACRIFICE, "discard")).toEqual([t.plain]);
    expect(options(RECALL, "return")).toEqual([t.plain]);

    // Only the guarded ally will do: the cost cannot be paid, so the card cannot be played and nothing is drawn.
    const only = giveCard(t.state, P1, SACRIFICE_GUARDED.event.id);
    const play = (paid?: readonly InstanceId[]) => ({
      type: "playCard" as const,
      playerId: P1,
      cardInstanceId: only.id,
      payment: [],
      attachToInstanceId: null,
      ...(paid ? { costChoices: { paid } } : {}),
    });
    expect(applyCommand(only.state, play(), deps).ok).toBe(false);
    expect(applyCommand(only.state, play([t.guarded]), deps).ok).toBe(false);

    // The plain ally pays, and the guarded one is as it was.
    const paid = playFree(t.state, deps, SACRIFICE.event.id);
    expect(mustPlayer(paid.state, P1).discard).toContain(t.plain);
    expectUntouched(t.state, paid.state, t);
    expect(drew(paid.events)).toBe(true);
  });

  it("is no target for a card ability's discard, and is one for a discard with no source card", () => {
    const t = table();
    const source = giveCard(t.state, P1, DISCARD.event.id);
    expect(canDiscardFromPlay(source.state, deps, t.guarded, source.id)).toBe(false);
    expect(canDiscardFromPlay(source.state, deps, t.plain, source.id)).toBe(true);
    expect(canDiscardFromPlay(source.state, deps, t.guarded)).toBe(true);

    expect(cardAbilitiesCannotRemove(t.state, deps, t.guarded)).toBe(true);
    expect(cardAbilitiesCannotRemove(t.state, deps, t.plain)).toBe(false);
    expect(cannotLeavePlay(t.state, deps, t.guarded)).toBe(false);
    expect(cannotLeavePlay(t.state, deps, t.guarded, DISCARD.event.id)).toBe(true);
    expect(cannotLeavePlay(t.state, deps, t.plain, DISCARD.event.id)).toBe(false);
  });

  it.todo(
    "a 'then' after a blocked move is skipped: no blocked leave marks pre-'then' text unresolved yet, for Permanent or either cannotLeavePlay",
  );
  it.todo("a swap with a card out of play is refused for it (swapCards passes the source; no fixture here)");
});

describe("§3.10 the unqualified cannotLeavePlay is unchanged (RRG 1.8 \"'Cannot'\", p. 11)", () => {
  it("reads as absolute with or without a source card, and is not the card-abilities rule", () => {
    const t = table(ROOTED);
    expect(cannotLeavePlay(t.state, deps, t.guarded)).toBe(true);
    expect(cannotLeavePlay(t.state, deps, t.guarded, DISCARD.event.id)).toBe(true);
    expect(cardAbilitiesCannotRemove(t.state, deps, t.guarded)).toBe(false);
    expect(canDiscardFromPlay(t.state, deps, t.guarded)).toBe(false);
  });

  it.each([
    ["discard", DISCARD],
    ["remove from the game", REMOVE],
  ] as const)("a card ability's %s leaves it in play, as before", (_label, source) => {
    const t = table(ROOTED);
    const { state: after, events } = resolve(t.state, source, "player");

    expectUntouched(t.state, after, t);
    expect(blocked(events)).toEqual([{ type: "leavePlayBlocked", instanceId: t.guarded, reason: "cannotLeavePlay" }]);
  });

  it("at 0 hit points it is defeated but its leaving step is stopped, as before: it stays in play with its damage", () => {
    const t = table(ROOTED);
    const { state: after, events } = resolve(t.state, ZAP, "player");

    expect(defeats(events)).toContain(t.guarded);
    expect(blocked(events)).toContainEqual({
      type: "leavePlayBlocked",
      instanceId: t.guarded,
      reason: "cannotLeavePlay",
    });
    expect(cardsInPlay(after)).toContain(t.guarded);
    expect(mustInstance(after, t.guarded).damage).toBeGreaterThanOrEqual(2);
  });

  it("a 'defeat' effect defeats it but its leaving step is stopped, as before", () => {
    const t = table(ROOTED);
    const { state: after, events } = resolve(t.state, DEFEAT, "player");

    expect(defeats(events)).toEqual(expect.arrayContaining([t.guarded, t.plain]));
    expect(cardsInPlay(after)).toContain(t.guarded);
    expect(cardsInPlay(after)).not.toContain(t.plain);
  });

  it("a cost cannot be paid with it, as before", () => {
    const t = table(ROOTED);
    const card = giveCard(t.state, P1, SACRIFICE.event.id);
    expect(inPlayCostCandidates(card.state, deps, card.id, P1, "discard", ALLY_PICK)).toEqual([t.plain]);
  });
});
