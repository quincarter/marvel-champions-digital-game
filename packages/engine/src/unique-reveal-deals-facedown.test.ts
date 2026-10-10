/**
 * The unique rule's replacement card is dealt facedown and reveals nothing (the owner's decision,
 * docs/phase7-wave9.md §4.1 Q38 = A, following Q22 = B: "Dealing a facedown encounter card is not revealing it").
 *
 * Sources: RRG 1.8 "Unique Icon" (p. 46): a non-villain encounter card that matches a card in play "is discarded and
 * any effects of it entering play are ignored. If it was being revealed, any effects of it being revealed are ignored
 * and the player revealing it is dealt a facedown encounter card."; "Deal, Deal an Encounter Card" (p. 15): "This card
 * is not revealed at this time. This card is added to the queue of cards that player resolves during the villain
 * phase. If a player is dealt an encounter card during step three or four of the villain phase, the extra encounter
 * card is added to the queue of cards that are being dealt and revealed in those same steps."; "Villain Phase" (p. 47)
 * step four: "one card at a time in the order in which they were dealt … until no dealt encounter cards remain."
 *
 * Synthetic cards only. Every card here has 0 boost icons, and the villain's activation takes 1 boost card off the
 * encounter deck before step three.
 */

import type { CardId, MinionCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playFree } from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;
const self = { kind: "self" } as const;

/** "When Revealed: place 1 seen counter here." It must not resolve for the copy the unique rule turns away. */
const SEEN = stubAbility("twin.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: n(1) }],
});
/** A unique minion (0 ATK, 0 SCH); two copies are in the encounter deck. */
const TWIN: MinionCard = {
  ...stubMinion({ id: "twin", atk: 0, sch: 0, hp: 9, boostIcons: 0, abilities: [SEEN.ref] }),
  unique: true,
};
const A = stubTreachery({ id: "a", boostIcons: 0 });
const B = stubTreachery({ id: "b", boostIcons: 0 });
const C = stubTreachery({ id: "c", boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "Deal yourself 2 facedown encounter cards."
const DEAL_TWO = event("deal-two", [{ kind: "dealEncounterCard", player: you, count: n(2) }]);
// "Reveal the top card of the encounter deck."
const REVEAL_TOP = event("reveal-top", [{ kind: "revealEncounterCard", player: you }]);
const EVENTS = [DEAL_TWO, REVEAL_TOP];
const deps: EngineDeps = depsOf(SEEN, ...EVENTS.map((e) => e.ability));

/** P1's turn, one copy of the unique minion engaged with them, the other still in the encounter deck. */
function start(): { readonly state: GameState; readonly inPlay: InstanceId } {
  const state = gameAtFirstTurn({
    cards: [TWIN, A, B, C, FILLER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: EVENTS.map((e) => e.card.id),
    encounter: [...copiesOf(FILLER.id, 20), TWIN.id, TWIN.id, A.id, B.id, C.id],
  });
  const engaged = minionEngagedWith(state, TWIN.id);
  return { state: engaged.state, inPlay: engaged.id };
}

/** The encounter deck with a card of each of `codes` on top, the first of them topmost (test surgery). */
const stacked = (state: GameState, ...codes: readonly CardId[]): GameState => {
  const [deckId, piles] = Object.entries(state.encounterDecks)[0]!;
  const rest = [...piles.deck];
  const top = codes.map((code) => {
    const at = rest.findIndex((id) => mustInstance(state, id).cardId === code);
    if (at < 0) throw new Error(`no ${code} left in the encounter deck`);
    return rest.splice(at, 1)[0]!;
  });
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: [...top, ...rest] } } };
};
const playRound = (state: GameState) => runCommands(state, deps, { type: "endTurn", playerId: P1 });
const reveals = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [e.cardId as string] : []));
const blocked = (events: readonly GameEvent[]) => events.filter((e) => e.type === "uniqueEntryBlocked");
const dealtTo = (state: GameState, player: PlayerId = P1) =>
  mustPlayer(state, player).dealtEncounter.map((id) => mustInstance(state, id).cardId as string);
const twinsInPlay = (state: GameState): readonly InstanceId[] =>
  mustPlayer(state, P1).playArea.filter((id) => mustInstance(state, id).cardId === TWIN.id);
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("Q38: the card dealt for an encounter card the unique rule turned away waits facedown", () => {
  it("in the player phase: the copy is discarded, 1 card is dealt facedown, and nothing more is revealed", () => {
    const { state: base, inPlay } = start();
    const out = playFree(stacked(base, TWIN.id, A.id), deps, REVEAL_TOP.card.id);
    // Only the copy was revealed: A is dealt, facedown, and not revealed.
    expect(reveals(out.events)).toEqual(["twin"]);
    expect(blocked(out.events)).toHaveLength(1);
    expect(blocked(out.events)[0]).toMatchObject({ matchedInstanceId: inPlay, disposition: "discarded" });
    expect(dealtTo(out.state)).toEqual(["a"]);
    const [dealt] = mustPlayer(out.state, P1).dealtEncounter;
    expect(mustInstance(out.state, dealt!).faceup).toBe(false);
    // The copy is in the encounter discard pile; its When Revealed did not resolve; one copy is in play.
    expect(twinsInPlay(out.state)).toEqual([inPlay]);
    const discard = activeEncounterDeck(out.state).discard.map((id) => mustInstance(out.state, id));
    expect(discard.map((i) => i.cardId)).toEqual([TWIN.id]);
    expect(discard[0]!.counters.seen ?? 0).toBe(0);
    expect(mustInstance(out.state, inPlay).counters.seen ?? 0).toBe(0);
    expect(out.state.step.phase).toBe("player");
    expectReplays(out.session);

    // It is revealed by the next step four, before the card step three deals (B; the boost card is a filler).
    const round = playRound(stacked(out.state, FILLER.id, B.id));
    expect(reveals(round.events)).toEqual(["a", "b"]);
    expect(dealtTo(round.state)).toEqual([]);
    expectReplays(round.session);
  });

  it("in step four of the villain phase: it joins the back of the queue and is revealed in that same step", () => {
    const { state: base, inPlay } = start();
    // P1 is dealt the copy and A in the player phase; the boost card is a filler; step three deals B; the unique
    // rule's replacement is C.
    const dealt = playFree(stacked(base, TWIN.id, A.id, FILLER.id, B.id, C.id), deps, DEAL_TWO.card.id);
    expect(dealtTo(dealt.state)).toEqual(["twin", "a"]);
    const { state, events, session } = playRound(dealt.state);
    expect(reveals(events)).toEqual(["twin", "a", "b", "c"]);
    expect(blocked(events)).toHaveLength(1);
    // The deal comes after the copy is turned away and before the next card is revealed.
    const at = (match: (e: GameEvent) => boolean) => events.findIndex(match);
    const dealtAt = at(
      (e) =>
        e.type === "cardMoved" && e.to.kind === "dealtEncounter" && mustInstance(state, e.instanceId).cardId === C.id,
    );
    expect(dealtAt).toBeGreaterThan(at((e) => e.type === "uniqueEntryBlocked"));
    expect(dealtAt).toBeLessThan(at((e) => e.type === "encounterCardRevealed" && e.cardId === A.id));
    expect(twinsInPlay(state)).toEqual([inPlay]);
    expect(dealtTo(state)).toEqual([]);
    expect(state.step.phase).toBe("player");
    expectReplays(session);
  });

  it("with no matching card in play the copy is revealed as usual and nothing is dealt for it", () => {
    const state = gameAtFirstTurn({
      cards: [TWIN, A, FILLER, ...EVENTS.map((e) => e.card)],
      deps,
      deck: EVENTS.map((e) => e.card.id),
      encounter: [...copiesOf(FILLER.id, 20), TWIN.id, A.id],
    });
    const out = playFree(stacked(state, TWIN.id, A.id), deps, REVEAL_TOP.card.id);
    expect(blocked(out.events)).toEqual([]);
    expect(dealtTo(out.state)).toEqual([]);
    const [twin] = twinsInPlay(out.state);
    expect(mustInstance(out.state, twin!).counters.seen).toBe(1);
  });
});
