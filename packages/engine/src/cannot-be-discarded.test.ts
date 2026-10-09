/**
 * docs/phase7-wave8.md §3.35 part (a): "[This card] cannot be discarded" is `RuleSpec cannotLeavePlay` with
 * `by: "discard"`.
 *
 * RRG 1.8 "'Cannot'" (p. 11): absolute. No discard moves the card, whoever makes it: a player card's ability, an
 * encounter card's ("discard an upgrade or support you control"), a cost ("Cost", p. 13: a cost is paid in full or not
 * at all, so the card cannot be chosen to pay one) or a game rule's "choose and discard" ("Restricted", p. 38). It is
 * no valid target for a discard ("Target", p. 42). A discard is a move to a discard pile ("Discard", p. 16): removal
 * from the game, a return to hand and a flip ("Flip", p. 20: the card never leaves play) are not discards, and the
 * card's own scenario text may do each. Synthetic cards only.
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import { inPlayCostCandidates } from "./actions.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import { canDiscardFromPlay } from "./resolve/target-validity.js";
import { cannotLeavePlay } from "./rules.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
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
const SUPPORTS: TargetQuery = { categories: ["support"] };
const YOURS: TargetQuery = { categories: ["support"], controlledBy: you };
const EACH: TargetRef = { kind: "each", query: SUPPORTS };

/** "This card cannot be discarded." */
const CREW_RULE = stubAbility("crew.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotLeavePlay", target: SELF, by: "discard" }] },
  effects: [],
});
const CREW = stubSupport({ id: "crew", cost: 0, abilities: [CREW_RULE.ref] });
/** The same rule on both faces of a double-sided support. */
const DUO = {
  ...stubSupport({ id: "duo", cost: 0, abilities: [CREW_RULE.ref] }),
  flipSide: { name: "Duo", traits: [], keywords: [], text: { printed: "", current: "" }, abilities: [CREW_RULE.ref] },
};
/** No rule: the control. */
const SHED = stubSupport({ id: "shed", cost: 0 });
/** A campaign's own support: "[This card] cannot be discarded and the first player gains control of it." */
const TEAM_RULE = stubAbility("team.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "cannotLeavePlay", target: SELF, by: "discard" },
      { kind: "controlledByFirstPlayer", target: SELF },
    ],
  },
  effects: [],
});
const TEAM = {
  ...stubSupport({ id: "team", cost: 0, abilities: [TEAM_RULE.ref] }),
  specificTo: { kind: "campaign" as const, encounterSetId: "outing" as never },
};

const draw: EffectSpec = { kind: "draw", player: you, amount: { kind: "const", value: 1 } };

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
// "Discard each support. Draw 1 card."
const DISCARD = sources("discard", [{ kind: "discardFromPlay", target: EACH }, draw]);
// "Put each support into its owner's discard pile. Draw 1 card."
const TO_DISCARD = sources("to-discard", [
  { kind: "moveCards", cards: { kind: "ref", ref: EACH }, to: "discard" },
  draw,
]);
// "Choose and discard a support you control." (War's "discard an upgrade or support you control".)
const PICK = sources("pick", [
  { kind: "chooseTarget", slot: "t", query: YOURS, chooser: you },
  { kind: "discardFromPlay", target: { kind: "slot", slot: "t" } },
]);
// "Remove each support from the game." / "Return each support to its owner's hand."
const REMOVE = sources("remove", [{ kind: "moveCards", cards: { kind: "ref", ref: EACH }, to: "removedFromGame" }]);
const TO_HAND = sources("to-hand", [{ kind: "moveCards", cards: { kind: "ref", ref: EACH }, to: "hand" }]);
// "Flip each support."
const FLIP = sources("flip", [{ kind: "flipCard", target: EACH }]);
// "Reveal the top card of the encounter deck."
const REVEAL = sources("reveal", [{ kind: "revealEncounterCard", player: you }]);
// "Discard a support you control → draw 1 card." / "Return a support you control to your hand → draw 1 card."
const SUPPORT_PICK = { slot: "paid", query: SUPPORTS, min: 1, max: 1 } as const;
const SACRIFICE = sources("sacrifice", [draw], { discardCards: SUPPORT_PICK });
const RECALL = sources("recall", [draw], { returnToHand: SUPPORT_PICK });

// "Put the team into play under your control." (a campaign instruction: the card starts with no owner)
const MUSTER = sources("muster", [
  { kind: "putIntoPlay", card: { kind: "find", query: { name: TEAM.name } }, controller: you },
]);
// "Deal 99 damage to your identity."
const FALL = sources("fall", [
  { kind: "dealDamage", target: { kind: "identityOf", player: you }, amount: { kind: "const", value: 99 } },
]);
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const ALL = [DISCARD, TO_DISCARD, PICK, REMOVE, TO_HAND, FLIP, REVEAL, SACRIFICE, RECALL, MUSTER, FALL];
const deps: EngineDeps = depsOf(CREW_RULE, TEAM_RULE, ...ALL.flatMap((set) => set.abilities));
const CARDS: readonly AnyCard[] = [CREW, DUO, SHED, TEAM, FILLER, ...ALL.flatMap((set) => [set.event, set.treachery])];

/** CREW, or `card` (and SHED unless `alone`) in P1's play area. */
function table(alone = false, card: AnyCard = CREW) {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [CREW.id, DUO.id, SHED.id, ...ALL.map((set) => set.event.id)],
    encounter: [...ALL.map((set) => set.treachery.id), ...copiesOf(FILLER.id, 20)],
  });
  const crew = playerCardIntoPlay(base, card.id);
  if (alone) return { state: crew.state, crew: crew.id, shed: null as InstanceId | null };
  const shed = playerCardIntoPlay(crew.state, SHED.id);
  return { state: shed.state, crew: crew.id, shed: shed.id as InstanceId | null };
}
function resolve(state: GameState, source: ReturnType<typeof sources>, from: "player" | "encounter") {
  if (from === "player") return playFree(state, deps, source.event.id);
  return playFree(onTopOfEncounterDeck(state, source.treachery.id), deps, REVEAL.event.id);
}
const blocked = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "leavePlayBlocked" ? [[e.instanceId, e.reason]] : []));
const drew = (events: readonly GameEvent[]) => events.some((e) => e.type === "cardDrawn");
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}
const canPlay = (state: GameState, source: ReturnType<typeof sources>): boolean => {
  const given = giveCard(state, P1, source.event.id);
  const listed = legalActions(given.state, P1, deps);
  if (listed.kind !== "turn") throw new Error(listed.kind);
  return listed.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === given.id);
};

describe("§3.35 (a) 'cannot be discarded' (cannotLeavePlay by discard)", () => {
  describe.each(["player", "encounter"] as const)("a discard by a %s card's ability", (from) => {
    it.each([
      ["discard each support", DISCARD],
      ["a move of each support to its discard pile", TO_DISCARD],
    ] as const)("%s: the card stays as it was, the other support is discarded, the rest resolves", (_label, source) => {
      const t = table();
      const before = mustInstance(t.state, t.crew);
      const { state: after, events, session } = resolve(t.state, source, from);
      expect(mustPlayer(after, P1).playArea).toContain(t.crew);
      expect(mustInstance(after, t.crew)).toEqual(before);
      expect(mustPlayer(after, P1).discard).toContain(t.shed);
      expect(blocked(events)).toEqual([[t.crew, "cannotLeavePlay"]]);
      expect(drew(events)).toBe(true);
      expectReplays(session);
    });

    it("'choose and discard a support you control': only the other support is offered; alone, there is no target and nothing is discarded", () => {
      const t = table();
      const offered: string[][] = [];
      const run = resolve(t.state, PICK, from);
      for (const e of run.events) {
        if (e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTarget")
          offered.push(e.choice.options.map((o) => o.optionId));
      }
      // One candidate is taken without asking, or asked with that one option: never the protected card.
      expect(offered.flat()).not.toContain(t.crew);
      expect(mustPlayer(run.state, P1).discard).toContain(t.shed);
      expect(cardsInPlay(run.state)).toContain(t.crew);

      const alone = table(true);
      // RRG 1.8 "Target" (p. 42): with no valid target a player's event cannot be played at all.
      if (from === "player") {
        expect(canPlay(alone.state, PICK)).toBe(false);
        return;
      }
      const lone = resolve(alone.state, PICK, from);
      expect(cardsInPlay(lone.state)).toContain(alone.crew);
      expect(mustPlayer(lone.state, P1).discard).not.toContain(alone.crew);
      expect(lone.events.some((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTarget")).toBe(
        false,
      );
    });
  });

  it("is no valid target for a discard, with or without a source card, and the rule reads only a discard", () => {
    const t = table();
    expect(canDiscardFromPlay(t.state, deps, t.crew)).toBe(false);
    expect(canDiscardFromPlay(t.state, deps, t.crew, t.shed)).toBe(false);
    expect(canDiscardFromPlay(t.state, deps, t.shed!, t.crew)).toBe(true);
    expect(cannotLeavePlay(t.state, deps, t.crew, undefined, true)).toBe(true);
    expect(cannotLeavePlay(t.state, deps, t.crew)).toBe(false);
    expect(cannotLeavePlay(t.state, deps, t.crew, CREW.id)).toBe(false);
  });

  it("cannot pay a discard cost: with another support that one pays; alone the ability cannot be initiated", () => {
    const t = table();
    const given = giveCard(t.state, P1, SACRIFICE.event.id);
    expect(inPlayCostCandidates(given.state, deps, given.id, P1, "discard", SUPPORT_PICK)).toEqual([t.shed]);
    const paid = playFree(t.state, deps, SACRIFICE.event.id);
    expect(mustPlayer(paid.state, P1).discard).toContain(t.shed);
    expect(cardsInPlay(paid.state)).toContain(t.crew);
    expect(drew(paid.events)).toBe(true);

    const alone = table(true);
    expect(canPlay(alone.state, SACRIFICE)).toBe(false);
    // A return to hand is not a discard: that cost can still take it.
    expect(canPlay(alone.state, RECALL)).toBe(true);
    const recalled = playFree(alone.state, deps, RECALL.event.id);
    expect(mustPlayer(recalled.state, P1).hand).toContain(alone.crew);
  });

  it("removal from the game is not a discard: the card is removed", () => {
    const t = table();
    const { state: after, events } = resolve(t.state, REMOVE, "player");
    expect(cardsInPlay(after)).not.toContain(t.crew);
    expect(locateCard(after, t.crew)).toEqual({ kind: "removedFromGame" });
    expect(blocked(events)).toEqual([]);
  });

  it("a return to hand is not a discard: the card goes back", () => {
    const t = table();
    const { state: after } = resolve(t.state, TO_HAND, "encounter");
    expect(mustPlayer(after, P1).hand).toContain(t.crew);
  });

  it("a flip is not a discard: the card turns to its other face, in play, and still cannot be discarded there", () => {
    const t = table(true, DUO);
    const flipped = resolve(t.state, FLIP, "player");
    expect(mustInstance(flipped.state, t.crew).flipped).toBe(true);
    expect(cardsInPlay(flipped.state)).toContain(t.crew);
    const after = resolve(flipped.state, DISCARD, "encounter");
    expect(cardsInPlay(after.state)).toContain(t.crew);
    expect(blocked(after.events)).toEqual([[t.crew, "cannotLeavePlay"]]);
  });

  it("RRG p. 31: a campaign's support the first player controls is that player's own, so when the first player is eliminated it passes to the next first player, owner and controller, before their cards are discarded", () => {
    const base = gameAtFirstTurn({
      players: 2,
      cards: CARDS,
      deps,
      deck: ALL.map((set) => set.event.id),
      encounter: [TEAM.id, ...copiesOf(FILLER.id, 20)],
    });
    const mustered = playFree(base, deps, MUSTER.event.id).state;
    const team = (Object.keys(mustered.instances) as InstanceId[]).find(
      (id) => mustered.instances[id]?.cardId === TEAM.id,
    )!;
    expect(mustInstance(mustered, team)).toMatchObject({ ownerId: P1, controllerId: P1 });
    const run = playFree(mustered, deps, FALL.event.id);
    expect(mustPlayer(run.state, P1).eliminated).toBe(true);
    expect(run.state.firstPlayerId).toBe(P2);
    expect(cardsInPlay(run.state)).toContain(team);
    expect(mustPlayer(run.state, P2).playArea).toContain(team);
    expect(mustInstance(run.state, team)).toMatchObject({ ownerId: P2, controllerId: P2 });
    expect(mustPlayer(run.state, P1).discard).not.toContain(team);
    expect(
      run.events.flatMap((e) => (e.type === "ownershipChanged" && e.instanceId === team ? [e.playerId] : [])),
    ).toEqual([P2]);
  });
});
