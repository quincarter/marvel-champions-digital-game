/**
 * Rules audit chunk 09 (Glossary: IN PLAYER ORDER ... LEADER). Audit proofs only: each `it.fails` marks a place the
 * engine does something the RRG forbids, and flips to a failure when it is fixed.
 *
 * RRG 1.8 "Indirect Damage" (p. 24): "Only the defending character, or the attacked player's identity if the attack
 * was undefended, is considered to have been attacked, even if other characters were assigned some or all of the
 * indirect damage." RRG 1.8 "Piercing" (p. 32): "An attack with the piercing keyword discards any tough status cards
 * from the attacked character before dealing damage." So an undefended piercing attack that deals indirect damage
 * pierces the identity only; an ally assigned the damage keeps its tough status card, which prevents the damage.
 * NOTE (order of authority): the Piercing entry's "equivalent ability" bullet says "discard each tough status card from
 * that character" (any character the attack deals damage to), so the RRG supports a second reading; this test pins the
 * reading taken from the Piercing summary sentence ("the attacked character") plus the Indirect Damage bullet. Treat
 * as an Interpretation proof, not a settled bug.
 * (`resolve/effects-frame.ts` `executeDealIndirectDamage` builds the shares with `fromAttack: true` and never
 * `notAttacked: true`, so `attackPierces` in `resolve/event.ts` treats every share as pierced.)
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import { startSession } from "../engine.js";
import type { InstanceId } from "../ids.js";
import { mustInstance, mustPlayer } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { driveSession } from "../testing/drive.js";
import { stubMinion, stubVillain } from "../testing/fixtures.js";
import { ALLY, defaultPick } from "../testing/scenario.js";
import { gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "../testing/wave3.js";

const RULE = stubAbility("sandman.constant", {
  trigger: { kind: "constant", rules: [{ kind: "attacksDealIndirectDamage", attacker: { self: true } }] },
  effects: [],
});
const SANDMAN = stubMinion({
  id: "sandman-ish",
  atk: 3,
  sch: 1,
  hp: 7,
  boostIcons: 0,
  keywords: [{ name: "piercing" }],
  abilities: [RULE.ref],
});
const QUIET = stubVillain({ id: "quiet", stages: [{ hp: flat(30), atk: 0, sch: 0, dashedStats: ["atk"] }] });
const deps: EngineDeps = depsOf(RULE);

describe("undefended piercing attack that deals indirect damage (RRG 1.8 pp. 24, 32)", () => {
  it.fails("an ally assigned the damage was not attacked: its tough status card is not pierced and prevents it", () => {
    const base = gameAtFirstTurn({ cards: [SANDMAN, QUIET], deps, villain: QUIET, encounter: [SANDMAN.id] });
    const heroes: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    };
    const ally = playerCardIntoPlay(heroes, ALLY.id);
    const toughAlly: GameState = {
      ...ally.state,
      instances: {
        ...ally.state.instances,
        [ally.id]: {
          ...mustInstance(ally.state, ally.id),
          statuses: { stunned: 0, confused: 0, tough: 1 },
        },
      },
    };
    const engaged = minionEngagedWith(toughAlly, SANDMAN.id);
    const allyId: InstanceId = ally.id;
    const pick = (current: GameState): readonly string[] => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind !== "assignIndirectDamage") return defaultPick(current);
      return choice.options
        .filter((o) => o.optionId.startsWith(`${allyId}#`))
        .slice(0, choice.minSelections)
        .map((o) => o.optionId);
    };
    const { session } = driveSession(startSession(engaged.state), deps, [{ type: "endTurn", playerId: P1 }], pick);
    const after = session.state;
    // Expected: Tough absorbed all 3, ally undamaged and still in play. Actual: tough discarded first, ally defeated.
    expect(mustPlayer(after, P1).discard).not.toContain(allyId);
    expect(mustInstance(after, allyId).damage).toBe(0);
  });
});
