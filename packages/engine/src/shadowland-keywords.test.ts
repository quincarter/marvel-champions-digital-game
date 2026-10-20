/**
 * docs/phase7-shadowland.md §6 M11 (Krahllak's Interrupt). MC65 FAQ p. 18: "If Krahllak attacks me, but one of my
 * teammates defends against the attack, who resolves Krahllak's ability? Because Krahllak has an Interrupt ability that
 * resolves 'when Krahllak attacks you,' you must choose whether or not to resolve Krahllak's ability before your
 * teammate decides to defend." RRG 1.8 "Attack (Enemy Activation)" (p. 8): step 2 is the attack's start, step 3 is
 * "Declare defender"; "Defend, Defense" (p. 15-16): the 'you' of a 'when ... attacks you' is the attacked player.
 *
 * The other Shadowland keywords (M6 assault, M7 linked, M8 first player action, M9 teamwork, M10 villainous) are proven
 * by assault.test.ts, linked-set-aside.test.ts, first-player-control.test.ts, teamwork.test.ts (the Fabian Cortez
 * case, which has the NINJA shape: a When Defeated that puts a teamwork minion into play) and the villainous-*.test.ts
 * files. Synthetic cards only.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { startSession } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMainScheme, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

/** "Interrupt: When Krahllak attacks you, put a 'blessing' counter on the main scheme." (optional) */
const KRAHLLAK_WHEN = stubAbility("krahllak.when", {
  trigger: {
    kind: "interrupt",
    forced: false,
    on: { on: "enemyAttack", selfIs: "source", playerIs: "controller", usesAttackedPlayer: true },
  },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "mainScheme" },
      counterType: "blessing",
      amount: { kind: "const", value: 1 },
    },
  ],
} satisfies AbilityDefinition);
const ATTACK_ME = stubAbility("attack-me.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "controller" } }],
} satisfies AbilityDefinition);

const KRAHLLAK = stubVillain({
  id: "krahllak",
  stages: [{ hp: flat(40), atk: 3, sch: 2, abilities: [KRAHLLAK_WHEN.ref] }],
});
const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
});
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const BUTTON = stubSupport({ id: "button", cost: 0, abilities: [ATTACK_ME.ref] });
const deps: EngineDeps = depsOf(KRAHLLAK_WHEN, ATTACK_ME);

function table(): GameState {
  const base = gameAtFirstTurn({
    cards: [KRAHLLAK, SCHEME, BLANK, BUTTON],
    deps,
    players: 2,
    villain: KRAHLLAK,
    mainScheme: SCHEME,
    deck: [BUTTON.id],
    encounter: copiesOf(BLANK.id, 30),
  });
  return {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
}

describe("MC65 FAQ p. 18: Krahllak's interrupt is chosen before a teammate decides to defend", () => {
  it.each([
    ["the teammate defends", true],
    ["nobody defends", false],
  ])(
    "%s: the attacked player is asked about the interrupt first, and it has resolved when defense is declared",
    (_n, teammateDefends) => {
      const placed = playerCardIntoPlay(table(), BUTTON.id, P1);
      const command: Command = {
        type: "useAbility",
        playerId: P1,
        cardInstanceId: placed.id,
        abilityId: ATTACK_ME.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
        payment: [],
      };
      const prompts: string[] = [];
      let blessingAtDefense = -1;
      let defenseAskedOf: string | null = null;
      const pick = (state: GameState): readonly string[] => {
        const choice = state.pendingChoice;
        if (choice?.prompt.kind === "chooseTriggers") {
          const krahllak = choice.options.filter((o) => o.optionId.includes(KRAHLLAK_WHEN.ref.id));
          if (krahllak.length > 0) {
            prompts.push(`trigger:${choice.playerId}`);
            return krahllak.map((o) => o.optionId);
          }
        }
        if (choice?.prompt.kind === "declareDefender") {
          prompts.push(`defender:${choice.playerId}`);
          blessingAtDefense = mustInstance(state, state.mainScheme.instanceId).counters.blessing ?? 0;
          defenseAskedOf = choice.playerId;
          return [teammateDefends ? mustPlayer(state, P2).identity.instanceId : "decline"];
        }
        return defaultPick(state);
      };
      const run = driveSession(startSession(placed.state), deps, [command], pick);
      // The attacked player (P1) chooses the interrupt, then Declare Defender comes, with the interrupt already resolved.
      expect(prompts[0]).toBe(`trigger:${P1}`);
      expect(prompts.findIndex((p) => p.startsWith("defender:"))).toBeGreaterThan(0);
      expect(blessingAtDefense).toBe(1);
      expect(defenseAskedOf).toBe(P1);
      expect(mustInstance(run.session.state, run.session.state.mainScheme.instanceId).counters.blessing).toBe(1);
      if (teammateDefends)
        expect(mustInstance(run.session.state, mustPlayer(run.session.state, P2).identity.instanceId).exhausted).toBe(
          true,
        );
    },
  );
});
