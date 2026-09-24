/**
 * docs/phase7-wave3.md §3.35: a player-level superlative (`PlayerRef superlative`) and `choosePlayer.among` for its
 * ties. Synthetic cards shaped like Drang III (`gmw` 16060): "When Revealed: Discard the top 4[per_hero] cards of the
 * encounter deck. Each time a minion is discarded this way, put it into play engaged with the player who is engaged
 * with the fewest minions."
 *
 * Sources: RRG 1.8 "First Player" (p. 19): "If an encounter card targets a specific player or card, and there are
 * multiple eligible targets, the first player selects among the eligible options"; "Each Time" (p. 7).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { ChoicePrompt, DecisionAuthority } from "./choices.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { activeEncounterDeckId, mustInstance } from "./query.js";
import { resolvePlayers } from "./select.js";
import type { PlayerRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;

/** "Engaged with the fewest minions": each player measured as the scoped player. */
const MINIONS_ENGAGED: ValueSpec = {
  kind: "count",
  query: { categories: ["minion"], engagedWithPlayer: { kind: "scoped" } },
};
const FEWEST_MINIONS: PlayerRef = { kind: "superlative", order: "lowest", measure: MINIONS_ENGAGED };

const DRANG_ABILITY = stubAbility(
  "drang.when-revealed",
  def({
    trigger: { kind: "whenRevealed" },
    effects: [
      {
        kind: "discardEncounterCards",
        count: n(4),
        forEachDiscarded: {
          slot: "discarded",
          effects: [
            {
              kind: "if",
              condition: {
                kind: "refMatches",
                ref: { kind: "slot", slot: "discarded" },
                query: { categories: ["minion"] },
                anywhere: true,
              },
              then: [
                { kind: "choosePlayer", slot: "fewest", chooser: { kind: "firstPlayer" }, among: FEWEST_MINIONS },
                {
                  kind: "putIntoPlay",
                  card: { kind: "slot", slot: "discarded" },
                  controller: { kind: "slot", slot: "fewest" },
                },
              ],
            },
          ],
        },
      },
    ],
  }),
);
const DRANG = stubTreachery({ id: "drang", boostIcons: 0, abilities: [DRANG_ABILITY.ref] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** "Action: reveal an encounter card." — a way to reveal the Drang card on the first turn. */
const REVEAL_ABILITY = stubAbility(
  "reveal.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }] }),
);
const REVEAL = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL_ABILITY.ref] });
const deps = depsOf(DRANG_ABILITY, REVEAL_ABILITY);

/**
 * Two players; p1 already engaged with one minion; the encounter deck is Drang, then grunt, grunt, then blanks. The
 * discard of 4 reaches both grunts whether or not the revealed Drang has left the deck by then (see §4 Q14: an
 * encounter card revealed by `revealEncounterCard` is still on top of the deck while it resolves).
 */
function start(): GameState {
  let state = gameAtFirstTurn({
    cards: [DRANG, GRUNT, BLANK, REVEAL],
    deps,
    players: 2,
    encounter: [DRANG.id, ...copiesOf(GRUNT.id, 3), ...copiesOf(BLANK.id, 20)],
    deck: [REVEAL.id],
  });
  state = minionEngagedWith(state, GRUNT.id, P1).state;
  return stackEncounterDeck(state, [DRANG.id, GRUNT.id, GRUNT.id]);
}
/** Test surgery: these cards (distinct copies) on top of the active encounter deck, in this order. */
function stackEncounterDeck(state: GameState, order: readonly CardId[]): GameState {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const picked: InstanceId[] = [];
  for (const card of order) {
    const id = piles.deck.find(
      (candidate) => !picked.includes(candidate) && state.instances[candidate]?.cardId === card,
    );
    if (!id) throw new Error(`no ${card} left in the encounter deck`);
    picked.push(id);
  }
  const deck = [...picked, ...piles.deck.filter((id) => !picked.includes(id))];
  return { ...state, encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck } } };
}
const engagedWith = (state: GameState, player: PlayerId): readonly InstanceId[] =>
  Object.values(state.instances)
    .filter((i) => i.engagedWith === player && state.cardPool[i.cardId]?.type === "minion")
    .map((i) => i.instanceId);

describe("§3.35 'the player who is engaged with the fewest minions'", () => {
  it("ranks the players afresh for each minion, and the first player breaks a tie (RRG 1.8 'First Player', p. 19)", () => {
    const base = start();
    const reveal = giveCard(base, P1, REVEAL.id);
    const asked: { prompt: ChoicePrompt; options: readonly string[]; authority: DecisionAuthority | undefined }[] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "choosePlayer") {
        asked.push({
          prompt: choice.prompt,
          options: choice.options.map((o) => o.optionId),
          authority: choice.authority,
        });
        return [P1];
      }
      return defaultPick(state);
    };
    const { session } = driveSession(
      startSession(reveal.state),
      deps,
      [{ type: "playCard", playerId: P1, cardInstanceId: reveal.id, payment: [], attachToInstanceId: null }],
      pick,
    );
    // The first grunt goes to p2 (0 against p1's 1) without a question; then both hold 1 and the first player picks.
    expect(asked).toHaveLength(1);
    expect(asked[0]!.options).toEqual([P1, P2]);
    expect(asked[0]!.authority).toBe("firstPlayerTargets");
    expect(engagedWith(session.state, P1)).toHaveLength(2);
    expect(engagedWith(session.state, P2)).toHaveLength(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("resolves to every tied player by default, the first in player order with ties 'first', and the most with 'highest'", () => {
    const state = start();
    const context = { selfInstanceId: null, controllerId: P1, event: null, bindings: {} };
    expect(resolvePlayers(state, FEWEST_MINIONS, context)).toEqual([P2]);
    expect(resolvePlayers(state, { ...FEWEST_MINIONS, order: "highest" }, context)).toEqual([P1]);
    const tied = minionEngagedWith(state, GRUNT.id, P2).state;
    expect(resolvePlayers(tied, FEWEST_MINIONS, context)).toEqual([P1, P2]);
    expect(resolvePlayers(tied, { ...FEWEST_MINIONS, ties: "first" }, context)).toEqual([P1]);
    expect(resolvePlayers(tied, { ...FEWEST_MINIONS, among: { kind: "id", playerId: P2 } }, context)).toEqual([P2]);
    // Surgery sanity: the engaged minions are real instances.
    for (const id of engagedWith(tied, P2)) expect(mustInstance(tied, id).engagedWith).toBe(P2);
  });
});
