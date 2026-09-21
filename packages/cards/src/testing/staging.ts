import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import {
  applyOk,
  firstLegal,
  identityOf,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  type Picker,
} from "./harness.js";

/**
 * Shared scenario-reach helpers for card tests (`docs/card-scripting-process.md` §6, ranked #1 in §3's "what
 * would plausibly pay for itself": getting a test to the point where the card under test can act is the dominant
 * cost of scripting a ref, and every pack agent was re-deriving these from scratch — the `playFromHand` copies
 * across wave 2 packs were byte-identical). Each one is a named, hard-won fact about turn structure or state
 * shape, written once so later tests are cheap.
 *
 * Deps-agnostic where the operation is pure state surgery (no engine dispatch involved) — those are exported
 * directly and any pack test can import them straight from this file. Deps-parameterized (an explicit
 * `deps: EngineDeps` leading parameter, the same convention `./harness.ts`'s `runWith` uses) where a real command
 * has to run against a specific content registry — `../wave1/testing.ts` and `../wave2/testing.ts` re-export
 * deps-bound wrappers of those, so a pack's tests read exactly as they did before this file existed.
 *
 * SHARED FILE: every pack agent imports this, never edits it.
 */

/** Sets an instance's `damage` directly — a thin, readable alias for `patchInstance(state, id, { damage })`. */
export function withDamage(state: GameState, id: InstanceId, damage: number): GameState {
  return patchInstance(state, id, { damage });
}

/**
 * Test-only surgery: sets the identity's current form directly (`heroFormIndex`/`form`) and clears
 * `changedFormThisRound`, so a test can start from a specific face and still issue *one* real `changeForm` command
 * this round to trigger the response under test — a second real command in the same round would otherwise hit the
 * once-per-round voluntary-change limit (RRG 1.8 "Form, Change Form").
 */
export function withForm(
  state: GameState,
  to: { readonly heroForm: number } | "alterEgo",
  player: PlayerId = P1,
): GameState {
  const owner = state.players.find((p) => p.playerId === player)!;
  const identity =
    to === "alterEgo"
      ? { ...owner.identity, form: "alterEgo" as const, heroFormIndex: null }
      : { ...owner.identity, form: "hero" as const, heroFormIndex: to.heroForm };
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, identity: { ...identity, changedFormThisRound: false } } : p,
    ),
  };
}

/** Sets the active villain directly (`GameState.activeVillainId`) — for exercising a specific villain's own per-activation forced abilities in a multi-villain scenario without playing out every other villain's turn first. */
export function withActive(state: GameState, id: InstanceId): GameState {
  return { ...state, activeVillainId: id };
}

/** Test-only surgery: moves a copy of `code` straight from hand or deck to `player`'s discard pile, so a test doesn't have to actually play a card (and juggle hero/alter-ego form restrictions) just to get something into the discard pile to read back out. */
export function moveToDiscard(
  state: GameState,
  player: PlayerId,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const owner = playerOf(state, player);
  const wanted = (id: InstanceId) => state.instances[id]?.cardId === cardId(code);
  const id = owner.hand.find(wanted) ?? owner.deck.find(wanted);
  if (!id) throw new Error(`${player} has no ${code} in hand or deck`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: p.hand.filter((x) => x !== id),
              deck: p.deck.filter((x) => x !== id),
              discard: [...p.discard, id],
            }
          : p,
      ),
    },
  };
}

/**
 * A set-aside nemesis-set card (RRG 1.8 Appendix II step 5, "set aside", kept per-player on `PlayerState.setAside`
 * — never shuffled into the encounter deck at setup) moved onto the top of the encounter deck for a reveal test,
 * the test-only-surgery counterpart of `stackEncounterDeck` for cards that never reach the deck.
 */
export function stackSetAside(state: GameState, code: string, player: PlayerId = P1): GameState {
  const owner = playerOf(state, player);
  const id = owner.setAside.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} set aside for ${player}`);
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, setAside: p.setAside.filter((i) => i !== id) } : p,
    ),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, deck: [id, ...pile.deck] } },
  };
}

/**
 * The trap this file exists to name once, so nobody re-discovers it the expensive way: **bare `stackSetAside`
 * does not reveal the card.** A villain phase runs `enemyActivations` before `dealEncounterCards`/
 * `revealEncounterCards` (`flow.ts`'s villain-phase step order), and a villain's own boost draw is unconditional
 * (`enemy-activation.ts`'s `getsBoostCard`) — so whatever sits on the very top of the encounter deck is eaten as
 * the villain's own boost card, never dealt to a player as their own reveal. Confirmed by instrumenting `04028`/
 * `04030` staged bare (`wave2/trors/hawkeye.test.ts`): both ended up faceup in the encounter deck's own discard,
 * never in `villainArea`/resolving their printed effect, having been drawn and discarded as Rhino's own boost card
 * instead. Two Sniper Shot tests were green for months on exactly this mistake, their loose
 * `toBeGreaterThanOrEqual` assertions satisfied by Rhino's own independent activation rather than by Sniper Shot
 * ever actually resolving (`docs/card-scripting-process.md` §3). One throwaway filler card (whatever was already
 * second from the top) absorbs that boost draw instead, so the staged card lands as the villain phase's actual
 * player reveal.
 */
export function stackSetAsideBehindBoost(state: GameState, code: string, player: PlayerId = P1): GameState {
  const staged = stackSetAside(state, code, player);
  const deckId = activeEncounterDeckId(staged);
  const pile = staged.encounterDecks[deckId]!;
  const [card, filler, ...rest] = pile.deck;
  if (!card || !filler) throw new Error(`no filler card behind the staged ${code} on the encounter deck`);
  return {
    ...staged,
    encounterDecks: { ...staged.encounterDecks, [deckId]: { ...pile, deck: [filler, card, ...rest] } },
  };
}

/**
 * The `stackSetAsideBehindBoost` sibling for staging a nemesis-set card where relying on "whatever's already
 * second from the top" of the deck as filler isn't safe (that card might be something else the test cares about,
 * or the deck's own top few cards aren't already known). Explicitly stacks `fillers` copies of Advance (01186, a
 * Core "Standard" treachery already in every wave 2 scenario's deck, whose "the villain schemes" is never resolved
 * as a boost card) ahead of the staged card instead, so every enemy needing a boost card that villain phase
 * consumes a filler and the nemesis card is dealt to the player as their own encounter card. `fillers` defaults to
 * 1 (one villain alone); pass more once other enemies are also in play and will activate that same phase.
 */
export function stageNemesisCardForReveal(
  state: GameState,
  code: string,
  player: PlayerId = P1,
  fillers = 1,
): GameState {
  const staged = stackSetAside(state, code, player);
  return stackEncounterDeck(staged, ...Array.from({ length: fillers }, () => "01186"));
}

/** Moves `code` into `player`'s hand and plays it, paying with other hand cards, resolving any prompts (targets, optional responses) with `pick`. */
export function playFromHand(
  deps: EngineDeps,
  state: GameState,
  code: string,
  cost: number,
  pick: Picker = firstLegal,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, player, code);
  const [id] = given.ids as [InstanceId];
  const played = settle(
    runWith(deps, given.state, play(player, id, payWith(given.state, player, cost, [id]))),
    pick,
    undefined,
    deps,
  );
  return { state: played, id };
}

/** Reveals a nemesis-set `code` staged by `stageNemesisCardForReveal`, returning the revealed card's in-play instance id. */
export function revealFromEncounterDeck(
  deps: EngineDeps,
  state: GameState,
  code: string,
  pick: Picker = firstLegal,
  fillers = 1,
  player: PlayerId = P1,
): { readonly state: GameState; readonly id: InstanceId } {
  const staged = stageNemesisCardForReveal(state, code, player, fillers);
  const revealed = settle(runWith(deps, staged, { type: "endTurn", playerId: player }), pick, undefined, deps);
  const id = instancesOf(revealed, code).find((candidate) => cardsInPlay(revealed).includes(candidate))!;
  return { state: revealed, id };
}

/** Like `runWith`, but also collects every event along the way (each command, and every choice auto-settled with `firstLegal` in between). */
export function driveEvents(
  deps: EngineDeps,
  state: GameState,
  ...commands: readonly Command[]
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const settleOne = () => {
    while (current.pendingChoice && !current.outcome) {
      const choice = current.pendingChoice;
      const result = applyOk(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: firstLegal(current),
        },
        deps,
      );
      current = result.state;
      events.push(...result.events);
    }
  };
  settleOne();
  for (const command of commands) {
    const result = applyOk(current, command, deps);
    current = result.state;
    events.push(...result.events);
    settleOne();
  }
  return { state: current, events };
}

/** Damages `target` to the brink, then lands the killing blow with a real `basicAttack`, so the engine's own defeat pipeline (When Defeated triggers included) runs normally, instead of removing the instance by surgery. */
export function defeatWithAttack(
  deps: EngineDeps,
  state: GameState,
  target: InstanceId,
  attacker: PlayerId = P1,
): GameState {
  const near = patchInstance(state, target, { damage: 999 });
  const identity = identityOf(near, attacker);
  return settle(
    runWith(deps, near, {
      type: "basicAttack",
      playerId: attacker,
      attackerInstanceId: identity,
      targetInstanceId: target,
    }),
    firstLegal,
    undefined,
    deps,
  );
}
