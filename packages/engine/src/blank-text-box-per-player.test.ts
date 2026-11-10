/**
 * `EffectSpec blankTextBox.forPlayers`: a blank for some players only. "Action: Each player may discard 1 card from
 * their hand. Until the end of the phase, each player who discarded a card this way may treat this card's printed text
 * box as if it were blank." (Cemented, a custom-content side scheme; docs/custom-content-packs.md §6.)
 *
 * The card keeps its text for the game and for every other player. For a player who treats it as blank, its constant
 * rules do not bind them (`ActiveRule.blankedFor`: a `player`-scoped rule's players leave them out, and the unscoped
 * "players cannot …" readers ask `ruleBindsPlayer`), and its action abilities are not theirs to trigger.
 *
 * Sources: RRG 1.8 "Blank" (p. 10: a blank text box "is treated as if it does not have any printed card text"),
 * "Lasting Effects" (p. 26), "'Cannot'" (p. 11), "Flip" (p. 20), "Form, Change Form" (p. 21).
 *
 * Synthetic cards, two seats, both in hero form. The side scheme says "Players cannot make basic attacks with heroes or
 * allies or flip upgrades or identities" (no `player` scope on the attack and flip rules; "each player" on the form
 * rule) and has an action that places a counter on itself. p1's event treats it as blank for p1 until the phase ends.
 */

import { type AnyCard, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cannotChangeForm, cannotFlip } from "./rules.js";
import { attackForbiddenBy, textBoxBlankedFor, textBoxBlankFor, textBoxBlankToPlayer } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const scheme = { kind: "named", name: "cemented" } as const;

const CEMENTED_RULES = stubAbility(
  "cemented.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "cannotAttack",
          target: { categories: ["enemy"] },
          attacker: { categories: ["hero", "ally"] },
          basicOnly: true,
        },
        { kind: "cannotFlip", target: { categories: ["upgrade"] } },
        { kind: "cannotChangeForm", player: { kind: "each" } },
      ],
    },
    effects: [],
  }),
);
/** "Action: place 1 used counter here." (stands in for the card's own action). */
const CEMENTED_ACTION = stubAbility(
  "cemented.action",
  def({
    trigger: { kind: "action" },
    effects: [
      { kind: "addCounters", target: { kind: "self" }, counterType: "used", amount: { kind: "const", value: 1 } },
    ],
  }),
);
const CEMENTED = stubSideScheme({
  id: "cemented",
  startingThreat: 2,
  boostIcons: 0,
  abilities: [CEMENTED_RULES.ref, CEMENTED_ACTION.ref],
});
/** "Until the end of the phase, you treat Cemented's printed text box as if it were blank." */
const BREAK_FREE = stubAbility(
  "break-free.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "blankTextBox", target: scheme, until: "endOfPhase", forPlayers: { kind: "controller" } }],
  }),
);
const BREAK = stubEvent({ id: "break-free", cost: 0, abilities: [BREAK_FREE.ref] });
const BOARD: UpgradeCard = {
  ...stubUpgrade({ id: "board", cost: 0 }),
  flipSide: { name: "board-b", traits: [], keywords: [], text: { printed: "", current: "" }, abilities: [] },
};

const deps: EngineDeps = depsOf(CEMENTED_RULES, CEMENTED_ACTION, BREAK_FREE);
const CARDS: readonly AnyCard[] = [CEMENTED, BREAK, BOARD];

interface Table {
  readonly state: GameState;
  readonly scheme: InstanceId;
  readonly villain: InstanceId;
  readonly hero: (player: PlayerId) => InstanceId;
  readonly board: (player: PlayerId) => InstanceId;
}

function table(): Table {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: 2,
    deck: [BREAK.id, BOARD.id],
    encounter: [...copiesOf(CEMENTED.id, 1)],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const placed = encounterCardInVillainArea(state, CEMENTED.id, 2);
  state = placed.state;
  const boards: Record<string, InstanceId> = {};
  for (const player of [P1, P2]) {
    const put = playerCardIntoPlay(state, BOARD.id, player);
    state = put.state;
    boards[player] = put.id;
  }
  const villain = state.villains[0]!.instanceId;
  return {
    state,
    scheme: placed.id,
    villain,
    hero: (player) => mustPlayer(state, player).identity.instanceId,
    board: (player) => boards[player]!,
  };
}

const ok = (state: GameState, command: Command): GameState => {
  const result = applyCommand(state, command, deps);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
  return result.state;
};

/** p1 plays the event that blanks the scheme for p1. */
function breakFree(state: GameState): GameState {
  const given = giveCard(state, P1, BREAK.id);
  return ok(given.state, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  });
}

const useAction = (playerId: PlayerId, scheme: InstanceId): Command => ({
  type: "useAbility",
  playerId,
  cardInstanceId: scheme,
  abilityId: CEMENTED_ACTION.ref.id,
  payment: [],
});

/** Whether a basic attack by this player's hero against the villain is forbidden. */
const basicAttackForbidden = (t: Table, state: GameState, player: PlayerId): boolean =>
  attackForbiddenBy(state, t.hero(player), t.villain, deps, true) !== null;

describe("blankTextBox forPlayers: a blank for some players only (Cemented)", () => {
  it("before the blank, the scheme's rules bind both players", () => {
    const t = table();
    expect(basicAttackForbidden(t, t.state, P1)).toBe(true);
    expect(basicAttackForbidden(t, t.state, P2)).toBe(true);
    expect(cannotFlip(t.state, deps, t.board(P1), P1)).toBe(true);
    expect(cannotChangeForm(t.state, deps, P1)).toBe(true);
    expect(cannotChangeForm(t.state, deps, P2)).toBe(true);
  });

  it("after p1's blank, none of them binds p1; all still bind p2", () => {
    const t = table();
    const state = breakFree(t.state);
    expect(textBoxBlankedFor(state, t.scheme, deps)).toEqual([P1]);
    expect(textBoxBlankToPlayer(state, t.scheme, P1, deps)).toBe(true);
    expect(textBoxBlankToPlayer(state, t.scheme, P2, deps)).toBe(false);
    // The card is not blank to the game.
    expect(textBoxBlankFor(state, t.scheme, deps)).toBe(false);

    expect(basicAttackForbidden(t, state, P1)).toBe(false);
    expect(basicAttackForbidden(t, state, P2)).toBe(true);
    expect(cannotChangeForm(state, deps, P1)).toBe(false);
    expect(cannotChangeForm(state, deps, P2)).toBe(true);
    // A flip is p1's or p2's by who makes it; with nobody named, every rule is read.
    expect(cannotFlip(state, deps, t.board(P1), P1)).toBe(false);
    expect(cannotFlip(state, deps, t.board(P2), P2)).toBe(true);
    expect(cannotFlip(state, deps, t.board(P1))).toBe(true);
  });

  it("p1 can make the basic attack and change form; p1's identity was not blanked", () => {
    const t = table();
    const state = breakFree(t.state);
    const attacked = ok(state, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: t.hero(P1),
      targetInstanceId: t.villain,
    });
    expect(mustInstance(attacked, t.villain).damage).toBeGreaterThan(0);
    const changed = ok(state, { type: "changeForm", playerId: P1 });
    expect(mustPlayer(changed, P1).identity.form).toBe("alterEgo");
  });

  it("p1 cannot trigger the scheme's action while it is blank to p1; without the blank p1 can", () => {
    const t = table();
    const state = breakFree(t.state);
    expect(applyCommand(state, useAction(P1, t.scheme), deps).ok).toBe(false);
    const unblanked = applyCommand(t.state, useAction(P1, t.scheme), deps);
    expect(unblanked.ok).toBe(true);
  });

  it("the blank ends with the phase", () => {
    const t = table();
    const state = breakFree(t.state);
    const { session } = driveSession(startSession(state), deps, [
      { type: "endTurn", playerId: P1 },
      { type: "endTurn", playerId: P2 },
    ]);
    expect(session.state.lastingEffects.some((e) => e.kind === "blankTextBox")).toBe(false);
    expect(textBoxBlankedFor(session.state, t.scheme, deps)).toEqual([]);
  });

  it("replays to the same state", () => {
    const t = table();
    const given = giveCard(t.state, P1, BREAK.id);
    const { session } = driveSession(startSession(given.state), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    ]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
