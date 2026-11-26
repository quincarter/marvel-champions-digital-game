/**
 * An `enemyAttack` effect's `bind` reports the players its attacks attacked, kept apart from the players they were
 * initiated against (`ATTACKED_PLAYERS_SLOT` / `INITIATED_AGAINST_SLOT`, `select.ts`): Hail Hydra! (`cap` 03030),
 * "Each Hydra minion engaged with a hero attacks that hero. Each player who was not attacked this way searches …"
 * (issue #1012 §4, owner decision C).
 *
 * Sources: FFG ruling July 25, 2024 (docs/rulings/post-rrg-1-6/01-july-2024.md), "Once a player defends an attack with
 * a character they control, that player is the 'attacked player'"; RRG 1.8 "Defend, Defense" (p. 16), the defending
 * player "becomes the new target of that attack".
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { PlayerId } from "./ids.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const notInSlot = (slot: string) =>
  ({
    kind: "where",
    predicate: {
      kind: "not",
      of: { kind: "refMatches", ref: { kind: "identityOf", player: { kind: "scoped" } }, query: { inSlot: slot } },
    },
  }) as const;
/**
 * "Action: Each minion engaged with a player attacks that player. Each player who was not attacked this way draws 1
 * card. Each player an attack was initiated against draws 2 cards." (a test card shaped like Hail Hydra!).
 */
const MUSTER = stubAbility(
  "muster.action",
  def({
    trigger: { kind: "action" },
    effects: [
      {
        kind: "enemyAttack",
        enemies: { kind: "each", query: { categories: ["minion"], engagedWith: "any" } },
        bind: "m",
      },
      {
        kind: "forEachPlayer",
        players: notInSlot("m.attackedPlayers"),
        effects: [{ kind: "draw", player: { kind: "scoped" }, amount: { kind: "const", value: 1 } }],
      },
      { kind: "draw", player: { kind: "slot", slot: "m.initiatedAgainst" }, amount: { kind: "const", value: 2 } },
    ],
  }),
);
const MUSTER_CARD = stubEvent({ id: "muster", cost: 0, abilities: [MUSTER.ref] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const deps = depsOf(MUSTER);

function start(): GameState {
  const base = gameAtFirstTurn({
    cards: [MUSTER_CARD, GRUNT, BLANK],
    deps,
    deck: [MUSTER_CARD.id],
    players: 2,
    encounter: [GRUNT.id, ...copiesOf(BLANK.id, 20)],
  });
  return { ...base, players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const identity = (state: GameState, player: PlayerId) => mustPlayer(state, player).identity.instanceId;
const handSize = (state: GameState, player: PlayerId) => mustPlayer(state, player).hand.length;

function playMuster(state: GameState, pick: (s: GameState) => readonly string[]) {
  const given = giveCard(state, P1, MUSTER_CARD.id);
  const commands: Command[] = [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ];
  const driven = driveSession(startSession(given.state), deps, commands, pick);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { before: given.state, after: driven.session.state };
}

describe("enemyAttack bind: <bind>.attackedPlayers vs <bind>.initiatedAgainst", () => {
  it("P2 defends the attack initiated against P1: P2 was attacked, P1 was not (ruling July 25, 2024)", () => {
    const base = minionEngagedWith(start(), GRUNT.id, P1).state;
    const p2Hero = identity(base, P2);
    const pick = (s: GameState): readonly string[] =>
      s.pendingChoice?.prompt.kind === "declareDefender" && s.pendingChoice.options.some((o) => o.optionId === p2Hero)
        ? [p2Hero]
        : defaultPick(s);
    const { before, after } = playMuster(base, pick);
    // P1 (not attacked) draws 1 and, as the player the attack was initiated against, 2 more; P2 draws nothing. P1's
    // hand also lost the played event.
    expect(handSize(after, P1)).toBe(handSize(before, P1) - 1 + 1 + 2);
    expect(handSize(after, P2)).toBe(handSize(before, P2));
  });

  it("undefended: P1 was attacked and the attack was initiated against P1; P2, with no minion, was not attacked", () => {
    const base = minionEngagedWith(start(), GRUNT.id, P1).state;
    const { before, after } = playMuster(base, defaultPick);
    expect(handSize(after, P1)).toBe(handSize(before, P1) - 1 + 2);
    expect(handSize(after, P2)).toBe(handSize(before, P2) + 1);
  });
});
