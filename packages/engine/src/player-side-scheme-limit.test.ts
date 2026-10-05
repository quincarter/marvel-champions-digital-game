/**
 * docs/phase7-wave7.md §3.2: the player side scheme limit. Synthetic cards: three plain missions, a Victory 0 one with
 * "When Defeated: Deal 2 damage to your hero" (the marker for a defeat), one a constant leaves out of the limit, one
 * nobody owns (in the encounter deck), and events reading "put [it] into play", one of which then attaches an upgrade
 * to the scheme it put into play (Technovirus Resurgence's shape).
 *
 * Sources: RRG 1.8 "Player Side Scheme Limit" (p. 34): "If one or two players started the game, the player side scheme
 * limit is one. If three or four players started the game, the limit is two. If there are ever more player side schemes
 * in play than the limit, the first player chooses and discards player side schemes until there are no longer more in
 * play than the limit. A player may play a player side scheme even while at the player side scheme limit. If they do,
 * they must choose a player side scheme to discard. (The player side scheme discarded this way is not considered
 * defeated.)" MC40 rulebook p. 21: "The first player chooses one player side scheme in play to discard, which could
 * include Technovirus Purge. If Technovirus Purge is discarded, Technovirus Resurgence cannot attach to it". §4.1 Q1:
 * the scheme that just entered play may be the one chosen, by either chooser.
 */

import { flat, type AnyCard, type PlayerSideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { ChoicePrompt, PendingChoice } from "./choices.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { playerSideSchemeLimit } from "./rules.js";
import type { CardSelector, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { DEFAULT_DECK, defaultPick, giveCard, newGame } from "./testing/scenario.js";
import { copiesOf, P1, P2 } from "./testing/wave3.js";

const P3: PlayerId = playerId("p3");

const def = (definition: AbilityDefinition) => definition;
const you = { kind: "controller" } as const;

function playerSideScheme(id: string, extra: Partial<PlayerSideSchemeCard> = {}): PlayerSideSchemeCard {
  return { ...stubSupport({ id, cost: 0 }), type: "player_side_scheme", startingThreat: flat(2), ...extra };
}

const ALPHA = playerSideScheme("alpha");
const BRAVO = playerSideScheme("bravo");
const CHARLIE = playerSideScheme("charlie");
/** Victory 0, and "When Defeated: Deal 2 damage to your hero": both would show if the limit's discard were a defeat. */
const TROPHY_DEFEATED = stubAbility(
  "trophy.when-defeated",
  def({
    trigger: { kind: "whenDefeated" },
    effects: [{ kind: "dealDamage", target: { kind: "identityOf", player: you }, amount: { kind: "const", value: 2 } }],
  }),
);
const TROPHY = playerSideScheme("trophy", {
  abilities: [TROPHY_DEFEATED.ref],
  keywords: [{ name: "victory", value: 0 }],
});
/** "This card does not count toward the player side scheme limit." */
const EXEMPT_RULE = stubAbility(
  "exempt.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "excludedFromPlayerSideSchemeLimit", target: { self: true } }] },
    effects: [],
  }),
);
const EXEMPT = playerSideScheme("exempt", { abilities: [EXEMPT_RULE.ref] });
/** Nobody's deck holds it: it starts in the encounter deck, with no owner (§4.1 Q24). */
const ORPHAN = playerSideScheme("orphan");
const VIRUS = stubUpgrade({ id: "virus", cost: 0 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects: [...effects] });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const inHand = (name: string): CardSelector => ({ kind: "zone", zone: "hand", player: you, filter: { name } });
/** "Put Bravo from your hand into play." */
const SUMMON = actionEvent("summon", [
  { kind: "selectCards", slot: "found", cards: inHand(BRAVO.name) },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: you },
]);
/** "Put Orphan from the encounter deck into play." */
const UNEARTH = actionEvent("unearth", [
  { kind: "selectCards", slot: "found", cards: { kind: "encounter", zones: ["deck"], filter: { name: ORPHAN.name } } },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: you },
]);
/** "Put Bravo from your hand into play. Attach Virus from your hand to it." (Technovirus Resurgence's shape) */
const RELAPSE = actionEvent("relapse", [
  { kind: "selectCards", slot: "found", cards: inHand(BRAVO.name) },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: you },
  { kind: "selectCards", slot: "virus", cards: inHand(VIRUS.name) },
  { kind: "attach", card: { kind: "slot", slot: "virus" }, to: { kind: "slot", slot: "found" } },
]);
const EVENTS = [SUMMON, UNEARTH, RELAPSE];
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(TROPHY_DEFEATED, EXEMPT_RULE, ...EVENTS.map((e) => e.ability));
const PLAYER_CARDS: readonly AnyCard[] = [ALPHA, BRAVO, CHARLIE, TROPHY, EXEMPT, VIRUS, ...EVENTS.map((e) => e.card)];

/** `players` players in hero form at the first player's first turn. */
function start(players: number): GameState {
  const base = newGame({
    players,
    extraCards: [...PLAYER_CARDS, ORPHAN, FILLER],
    deck: [...DEFAULT_DECK, ...PLAYER_CARDS.map((card) => card.id)],
    encounterDeck: [ORPHAN.id, ...copiesOf(FILLER.id, 30)],
    deps,
  });
  expect(base.firstPlayerId).toBe(P1);
  return {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
}

type LimitPrompt = Extract<ChoicePrompt, { kind: "discardOverPlayerSideSchemeLimit" }>;
/** One time a player was asked to discard for the limit: who, the limit shown, the schemes offered, how many to pick. */
interface Asked {
  readonly playerId: PlayerId;
  readonly limit: number;
  readonly options: readonly string[];
  readonly count: readonly [number, number];
}
interface Step {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly asked: readonly Asked[];
}
const isLimitChoice = (choice: PendingChoice | null): choice is PendingChoice & { prompt: LimitPrompt } =>
  choice?.prompt.kind === "discardOverPlayerSideSchemeLimit";

/**
 * Drives `commands`, answering each limit choice with `discard` (default: the first scheme offered) and every other
 * choice with the default pick, and checks the log replays to the same state.
 */
function run(state: GameState, commands: readonly Command[], discard?: InstanceId): Step {
  const asked: Asked[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (!isLimitChoice(choice)) return defaultPick(current);
    asked.push({
      playerId: choice.playerId,
      limit: choice.prompt.limit,
      options: choice.options.map((option) => option.optionId),
      count: [choice.minSelections, choice.maxSelections],
    });
    return discard ? [discard] : defaultPick(current);
  };
  const { session, events } = driveSession(startSession(state), deps, commands, pick);
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events, asked };
}
const playCommand = (player: PlayerId, id: InstanceId): Command => ({
  type: "playCard",
  playerId: player,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
/** `player` plays `card` from hand for 0; `discard` answers a limit choice. The step's `id` is the played card. */
function play(
  state: GameState,
  card: AnyCard,
  player: PlayerId = P1,
  discard?: InstanceId,
): Step & { readonly id: InstanceId } {
  const given = giveCard(state, player, card.id);
  return { ...run(given.state, [playCommand(player, given.id)], discard), id: given.id };
}
const endTurn = (state: GameState, player: PlayerId = P1) => run(state, [{ type: "endTurn", playerId: player }]).state;
const playerSideSchemesInPlay = (state: GameState) =>
  state.villainArea.filter((id) => mustInstance(state, id).cardId !== state.mainScheme.cardId);
const discardOf = (state: GameState, player: PlayerId) => mustPlayer(state, player).discard;
const heroDamage = (state: GameState, player: PlayerId) =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const limitDiscards = (events: readonly GameEvent[]) =>
  events.filter((event) => event.type === "playerSideSchemeLimitDiscard");

describe("the player side scheme limit (RRG 1.8 p. 34)", () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
  ])(
    "with %i player(s) the limit is %i: plays up to it ask nothing, the next asks for exactly one",
    (players, limit) => {
      let state = start(players);
      expect(playerSideSchemeLimit(state)).toBe(limit);
      const inPlay: InstanceId[] = [];
      for (const card of [ALPHA, BRAVO].slice(0, limit)) {
        const played = play(state, card);
        expect(played.asked).toEqual([]);
        inPlay.push(played.id);
        state = played.state;
      }
      expect(playerSideSchemesInPlay(state)).toEqual(inPlay);
      const over = play(state, CHARLIE);
      // The scheme that just entered play is among the choices (§4.1 Q1).
      expect(over.asked).toEqual([{ playerId: P1, limit, options: [...inPlay, over.id], count: [1, 1] }]);
      expect(playerSideSchemesInPlay(over.state)).toHaveLength(limit);
    },
  );

  it("is fixed by the players who started the game, not by those still in it", () => {
    const state = start(3);
    const afterElimination: GameState = {
      ...state,
      players: state.players.map((p) => (p.playerId === P3 ? { ...p, eliminated: true } : p)),
    };
    expect(playerSideSchemeLimit(afterElimination)).toBe(2);
  });

  it("the play is offered while at the limit, and the choice is the pending decision of the playing player", () => {
    const first = play(start(1), ALPHA);
    const given = giveCard(first.state, P1, BRAVO.id);
    const legal = legalActions(given.state, P1, deps);
    expect(legal.kind === "turn" && legal.legal.map((action) => action.example)).toContainEqual(
      expect.objectContaining({ type: "playCard", cardInstanceId: given.id }),
    );
    // Played and not yet answered: the listing shows the limit choice, with both schemes as its legal answers.
    const played = sessionApply(startSession(given.state), playCommand(P1, given.id), deps);
    if (!played.ok) throw new Error(played.error.message);
    const pending = legalActions(played.session.state, P1, deps);
    expect(pending.kind === "choice" && pending.choice).toMatchObject({
      playerId: P1,
      prompt: { kind: "discardOverPlayerSideSchemeLimit", limit: 1 },
      options: [{ optionId: first.id }, { optionId: given.id }],
      minSelections: 1,
      maxSelections: 1,
    });
  });
});

describe("a player plays a player side scheme at the limit: that player chooses", () => {
  /** Two players. P1, the first player, has Alpha in play; it is P2's turn. */
  function p2TurnWithAlpha(): { readonly state: GameState; readonly alpha: InstanceId } {
    const alpha = play(start(2), ALPHA);
    return { state: endTurn(alpha.state), alpha: alpha.id };
  }

  it("the playing player is asked, not the first player, and may discard another player's scheme", () => {
    const { state, alpha } = p2TurnWithAlpha();
    expect(state.firstPlayerId).toBe(P1);
    const played = play(state, BRAVO, P2, alpha);
    expect(played.asked).toEqual([{ playerId: P2, limit: 1, options: [alpha, played.id], count: [1, 1] }]);
    expect(playerSideSchemesInPlay(played.state)).toEqual([played.id]);
    // Its owner's discard pile, its threat cleared; the new one keeps its starting threat.
    expect(discardOf(played.state, P1)).toContain(alpha);
    expect(mustInstance(played.state, alpha).threat).toBe(0);
    expect(mustInstance(played.state, played.id).threat).toBe(2);
    expect(mustInstance(played.state, played.id).controllerId).toBe(P2);
    expect(limitDiscards(played.events)).toEqual([
      { type: "playerSideSchemeLimitDiscard", instanceId: alpha, chosenBy: P2 },
    ]);
  });

  it("may discard the scheme just played: it goes to its owner's discard pile and the other stays", () => {
    const { state, alpha } = p2TurnWithAlpha();
    const given = giveCard(state, P2, BRAVO.id);
    const played = run(given.state, [playCommand(P2, given.id)], given.id);
    expect(played.asked.map((ask) => ask.playerId)).toEqual([P2]);
    expect(playerSideSchemesInPlay(played.state)).toEqual([alpha]);
    expect(discardOf(played.state, P2)).toContain(given.id);
    expect(mustInstance(played.state, given.id).threat).toBe(0);
    expect(mustInstance(played.state, alpha).threat).toBe(2);
    // It was still played: the limit's discard does not undo the play.
    expect(played.events.some((event) => event.type === "cardPlayed" && event.instanceId === given.id)).toBe(true);
  });

  it("the discarded scheme is not defeated: no When Defeated, no victory display even with Victory 0", () => {
    const trophy = play(start(2), TROPHY);
    const played = play(trophy.state, BRAVO, P1, trophy.id);
    expect(played.asked).toHaveLength(1);
    expect(discardOf(played.state, P1)).toContain(trophy.id);
    expect(played.state.victoryDisplay).toEqual([]);
    expect([P1, P2].map((player) => heroDamage(played.state, player))).toEqual([0, 0]);
    expect(played.events.some((event) => event.type === "schemeDefeated")).toBe(false);
    expect(limitDiscards(played.events)).toEqual([
      { type: "playerSideSchemeLimitDiscard", instanceId: trophy.id, chosenBy: P1 },
    ]);
  });

  it.each([
    [3, [P1, P2, P3]],
    [4, [P1, P2, P3]],
  ])("with %i players the third scheme in play is the one that asks, of the player who played it", (players, turns) => {
    let state = start(players);
    const inPlay: InstanceId[] = [];
    const asked: Asked[] = [];
    for (const [index, card] of [ALPHA, BRAVO, CHARLIE].entries()) {
      const player = turns[index] as PlayerId;
      const played = play(state, card, player, inPlay[0]);
      asked.push(...played.asked);
      inPlay.push(played.id);
      state = endTurn(played.state, player);
    }
    expect(asked).toEqual([{ playerId: P3, limit: 2, options: inPlay, count: [1, 1] }]);
    expect(playerSideSchemesInPlay(state)).toEqual(inPlay.slice(1));
    expect(discardOf(state, P1)).toContain(inPlay[0]);
  });
});

describe("an effect puts a player side scheme into play at the limit: the first player chooses", () => {
  /** Two players. P1, the first player, has Alpha in play; it is P2's turn, with Bravo and Virus in P2's hand. */
  function setup(): { readonly state: GameState; readonly alpha: InstanceId; readonly bravo: InstanceId } {
    const alpha = play(start(2), ALPHA);
    const bravo = giveCard(endTurn(alpha.state), P2, BRAVO.id);
    return { state: bravo.state, alpha: alpha.id, bravo: bravo.id };
  }

  it("the first player is asked, not the player whose effect it was, and the new scheme is among the choices", () => {
    const { state, alpha, bravo } = setup();
    const put = play(state, SUMMON.card, P2, alpha);
    expect(put.asked).toEqual([{ playerId: P1, limit: 1, options: [alpha, bravo], count: [1, 1] }]);
    expect(playerSideSchemesInPlay(put.state)).toEqual([bravo]);
    expect(discardOf(put.state, P1)).toContain(alpha);
    expect(limitDiscards(put.events)).toEqual([
      { type: "playerSideSchemeLimitDiscard", instanceId: alpha, chosenBy: P1 },
    ]);
  });

  it("MC40 p. 21: the first player discards the new scheme, so the card that would attach to it cannot", () => {
    const { state, alpha, bravo } = setup();
    const virus = giveCard(state, P2, VIRUS.id);
    const put = play(virus.state, RELAPSE.card, P2, bravo);
    expect(put.asked.map((ask) => ask.playerId)).toEqual([P1]);
    expect(playerSideSchemesInPlay(put.state)).toEqual([alpha]);
    expect(discardOf(put.state, P2)).toContain(bravo);
    expect(mustInstance(put.state, bravo).attachments).toEqual([]);
    expect(mustPlayer(put.state, P2).hand).toContain(virus.id);
  });

  it("MC40 p. 21: the first player discards the other scheme, so the card attaches to the new one", () => {
    const { state, alpha, bravo } = setup();
    const virus = giveCard(state, P2, VIRUS.id);
    const put = play(virus.state, RELAPSE.card, P2, alpha);
    expect(put.asked.map((ask) => ask.playerId)).toEqual([P1]);
    expect(playerSideSchemesInPlay(put.state)).toEqual([bravo]);
    expect(mustInstance(put.state, bravo).attachments).toEqual([virus.id]);
  });

  it("§4.1 Q24: a scheme no player controls counts toward the limit and may be the one discarded", () => {
    const { state, alpha } = setup();
    const put = play(state, UNEARTH.card, P2);
    const orphan = put.asked[0]?.options[1] as InstanceId;
    expect(mustInstance(put.state, orphan).cardId).toBe(ORPHAN.id);
    expect(put.asked).toEqual([{ playerId: P1, limit: 1, options: [alpha, orphan], count: [1, 1] }]);
    // Discarded instead of Alpha: it has no owner, so it goes to the encounter discard pile.
    const kept = play(state, UNEARTH.card, P2, orphan);
    expect(playerSideSchemesInPlay(kept.state)).toEqual([alpha]);
    expect(Object.values(kept.state.encounterDecks).flatMap((piles) => piles.discard)).toContain(orphan);
    for (const player of [P1, P2]) expect(discardOf(kept.state, player)).not.toContain(orphan);
  });
});

describe("a card a rule leaves out of the limit (`excludedFromPlayerSideSchemeLimit`)", () => {
  it("does not count: with it in play, a scheme played up to the limit asks nothing", () => {
    const exempt = play(start(2), EXEMPT);
    const alpha = play(exempt.state, ALPHA);
    expect([...exempt.asked, ...alpha.asked]).toEqual([]);
    expect(playerSideSchemesInPlay(alpha.state)).toEqual([exempt.id, alpha.id]);
  });

  it("does not trigger the check: played at the limit, nothing is discarded", () => {
    const alpha = play(start(1), ALPHA);
    const exempt = play(alpha.state, EXEMPT);
    expect(exempt.asked).toEqual([]);
    expect(playerSideSchemesInPlay(exempt.state)).toEqual([alpha.id, exempt.id]);
    expect(limitDiscards(exempt.events)).toEqual([]);
  });

  it("is not among the schemes offered when another scheme goes over the limit", () => {
    const exempt = play(start(2), EXEMPT);
    const alpha = play(exempt.state, ALPHA);
    const bravo = play(alpha.state, BRAVO);
    expect(bravo.asked).toEqual([{ playerId: P1, limit: 1, options: [alpha.id, bravo.id], count: [1, 1] }]);
    expect(playerSideSchemesInPlay(bravo.state)).toEqual([exempt.id, bravo.id]);
  });
});

describe("'if there are ever more … than the limit': over it with no scheme entering play", () => {
  it("the first player chooses, whoever's turn it is", () => {
    const alpha = play(start(2), ALPHA);
    const p2Turn = endTurn(alpha.state);
    // Surgery: a second scheme is simply there, as when a rule that left one out of the limit stops applying.
    const given = giveCard(p2Turn, P2, BRAVO.id);
    const over: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P2 ? { ...p, hand: p.hand.filter((id) => id !== given.id) } : p,
      ),
      villainArea: [...given.state.villainArea, given.id],
      instances: {
        ...given.state.instances,
        [given.id]: { ...mustInstance(given.state, given.id), controllerId: P2, faceup: true, threat: 2 },
      },
    };
    const after = run(over, [{ type: "endTurn", playerId: P2 }], given.id);
    expect(after.asked).toEqual([{ playerId: P1, limit: 1, options: [alpha.id, given.id], count: [1, 1] }]);
    expect(playerSideSchemesInPlay(after.state)).toEqual([alpha.id]);
    expect(discardOf(after.state, P2)).toContain(given.id);
  });
});
