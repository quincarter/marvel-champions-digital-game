/**
 * Rules audit chunk 34 (FFG rulings post-RRG 1.6, July 25 - October 10, 2025).
 *
 * Ruling 69.82 (July 25, 2025, Alex), question 2: Hope Summers is a minion engaged with a player (an ally under
 * 'Pool-ized) while Sinister Ends is in play. "Yes, in that case Mister Sinister will attack the Hope Summers minion.
 * As this is still an enemy attack activation, a player can still defend against this attack." RRG 1.8 is silent
 * on a forced interrupt that moves an enemy attack onto a minion (p. 8 "Attack (Enemy Activation)" only names a
 * player's alter-ego or an ally), so the ruling stands.
 *
 * The engine's `retargetAttack` (enemy form, `resolve/apply-effect.ts`) drops any target whose `controllerOf` is
 * null, and an engaged minion has no controller (`engageInPlayMinion` sets `controllerId: null`), so the attack
 * stays on the player's hero.
 */
import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "../abilities.js";
import type { Command } from "../commands.js";
import { startSession } from "../engine.js";
import type { GameEvent } from "../events.js";
import type { InstanceId } from "../ids.js";
import { mustPlayer } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { driveSession } from "../testing/drive.js";
import {
  stubMainScheme,
  stubMinion,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "../testing/fixtures.js";
import { defaultPick } from "../testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "../testing/wave3.js";

const SNARE_RULE = stubAbility("snare.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "enemyAttack", sourceIs: { categories: ["villain"] } } },
  effects: [{ kind: "retargetAttack", character: { kind: "named", name: "grunt" } }],
} satisfies AbilityDefinition);
const ATTACK_ME = stubAbility("attack-me.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: { kind: "controller" } }],
} satisfies AbilityDefinition);

const BOSS = stubVillain({ id: "boss", stages: [{ hp: flat(40), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "plot",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(0) }],
});
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 0, hp: 9, boostIcons: 0 });
const SNARE = stubSideScheme({ id: "snare", startingThreat: 5, abilities: [SNARE_RULE.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const BUTTON = stubSupport({ id: "attack-me", cost: 0, abilities: [ATTACK_ME.ref] });
const deps = depsOf(SNARE_RULE, ATTACK_ME);

describe("audit 34: an enemy attack moved onto a minion (ruling July 25, 2025, 69.82)", () => {
  it.fails("a forced interrupt that makes the villain attack an engaged minion moves the attack onto that minion", () => {
    const base = gameAtFirstTurn({
      cards: [BOSS, SCHEME, GRUNT, SNARE, BLANK, BUTTON],
      deps,
      players: 1,
      villain: BOSS,
      mainScheme: SCHEME,
      deck: [BUTTON.id],
      encounter: [GRUNT.id, SNARE.id, ...copiesOf(BLANK.id, 20)],
    });
    const hero: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    };
    const engaged = minionEngagedWith(hero, GRUNT.id, P1);
    const snared = encounterCardInVillainArea(engaged.state, SNARE.id, 5).state;
    const placed = playerCardIntoPlay(snared, BUTTON.id, P1);
    const command: Command = {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: placed.id,
      abilityId: ATTACK_ME.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
      payment: [],
    };
    const run = driveSession(startSession(placed.state), deps, [command], (s) => {
      const choice = s.pendingChoice;
      return choice?.prompt.kind === "declareDefender" ? ["decline"] : defaultPick(s);
    });
    const events: readonly GameEvent[] = run.events;
    const hero1: InstanceId = mustPlayer(placed.state, P1).identity.instanceId;
    expect(events.some((e) => e.type === "attackRetargeted" && e.targetInstanceId === engaged.id)).toBe(true);
    expect(events.some((e) => e.type === "damageDealt" && e.targetInstanceId === hero1)).toBe(false);
  });
});

/*
 * Ruling 69.111 (October 10, 2025, Alex), question 2: Tower Defense (two main schemes), M.U.S.I.C. is defeated while
 * Manipulated M.U.S.I.C. is in play: "move all threat from Manipulated M.U.S.I.C. to just the main scheme with the
 * Focused Defense attachment. (Since threat is being 'moved' from one scheme to another, the number of tokens placed
 * should be fixed; and the player should not be able to split the tokens, so this is the simplest way to progress.)"
 * RRG 1.8 p. 30 "Move" is silent on two main schemes; MC21 p. 10 says an encounter card's "the main scheme" is both
 * schemes, which the ruling narrows for this move.
 *
 * The shipped script is `51034.when-defeated` = `whenDefeated(moveThreat(find(Manipulated M.U.S.I.C.), theMainScheme))`
 * (`cards/src/wave9/bp/black-panther/obligation-nemesis.ts`); this is its shape on synthetic cards. The engine's
 * `moveThreat` takes the first of the targets `{ kind: "mainScheme" }` resolves to for an encounter card, which is
 * both main schemes in `sharedMainSchemes` order, not the one holding Focused Defense.
 */
import { createGame } from "../setup.js";
import { mustInstance } from "../query.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO } from "../testing/scenario.js";
import { stubAttachment, stubEvent } from "../testing/fixtures.js";
import { playFree } from "../testing/wave3.js";

const PROXIMA = stubVillain({ id: "proxima", name: "Proxima Midnight", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const CORVUS = stubVillain({ id: "corvus", name: "Corvus Glaive", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const FOCUSED_RULE = stubAbility("focused-defense.constant", {
  trigger: { kind: "constant", rules: [{ kind: "focusedMainScheme", scheme: { kind: "host" } }] },
  effects: [],
});
const FOCUSED = stubAttachment({
  id: "focused-defense",
  name: "Focused Defense",
  attachesTo: { kind: "mainScheme" },
  keywords: [{ name: "permanent" }],
  abilities: [FOCUSED_RULE.ref],
});
const SETUP = stubAbility("under-siege.setup", {
  trigger: { kind: "setup" },
  effects: [{ kind: "putMainSchemeStageIntoPlay", stageNumber: 2 }],
});
const ARMIES = stubAbility("armies.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    { kind: "selectCards", slot: "focused", cards: { kind: "encounterSetAside", filter: { name: "Focused Defense" } } },
    { kind: "attach", card: { kind: "slot", slot: "focused" }, to: { kind: "self" } },
  ],
});
const stageOf = (aSide: typeof SETUP) => ({
  startingThreat: flat(1),
  targetThreat: flat(50),
  acceleration: flat(1),
  aSideAbilities: [aSide.ref],
});
const TOWER = (() => {
  const card = stubMainScheme({ id: "tower-defense", stages: [stageOf(SETUP), stageOf(ARMIES)] });
  const [underSiege, armies] = card.stages;
  return {
    ...card,
    stages: [
      { ...underSiege!, villainOf: "Proxima Midnight" },
      { ...armies!, villainOf: "Corvus Glaive" },
    ] as const,
  };
})();
const MANIPULATED = stubSideScheme({ id: "manipulated-music", startingThreat: 3 });
const WHEN_DEFEATED = stubAbility("music.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "moveThreat", from: { kind: "named", name: "manipulated-music" }, to: { kind: "mainScheme" } }],
});
const MUSIC = stubMinion({ id: "music", atk: 0, sch: 0, hp: 1, boostIcons: 0, abilities: [WHEN_DEFEATED.ref] });
const FILLER2 = stubTreachery({ id: "filler2", boostIcons: 0 });
const KILL_ABILITY = stubAbility("kill.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "each", query: { categories: ["minion"] } },
      amount: { kind: "const", value: 5 },
    },
  ],
});
const KILL = stubEvent({ id: "kill", cost: 0, abilities: [KILL_ABILITY.ref] });
const deps2 = depsOf(FOCUSED_RULE, SETUP, ARMIES, WHEN_DEFEATED, KILL_ABILITY);

describe("audit 34: M.U.S.I.C. defeated in Tower Defense moves the threat to the Focused Defense scheme (ruling Oct 10, 2025, 69.111)", () => {
  it.fails("all 3 threat go to the main scheme with Focused Defense, none to the other", () => {
    const result = createGame(
      {
        seed: 11,
        cards: [...DEFAULT_CARDS, PROXIMA, CORVUS, TOWER, FOCUSED, MUSIC, MANIPULATED, FILLER2, KILL],
        villainCardId: PROXIMA.id,
        villains: [
          { villainCardId: PROXIMA.id, encounterDeck: [] },
          { villainCardId: CORVUS.id, encounterDeck: [] },
        ],
        sharedEncounterDeck: true,
        encounterDeck: [...copiesOf(FILLER2.id, 20), MUSIC.id, MANIPULATED.id],
        setAside: [FOCUSED.id],
        mainSchemeCardId: TOWER.id,
        includeIdentitySets: false,
        players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, ...copiesOf(KILL.id, 2)] }],
      },
      deps2,
    );
    if (!result.ok) throw new Error(result.error.message);
    const started = driveSession(startSession(result.state), deps2).session.state;
    const focusedId = Object.values(started.instances).find((i) => i.cardId === FOCUSED.id)!;
    const focusedScheme = focusedId.attachedTo!;
    const all = [started.mainScheme, ...(started.extraMainSchemes ?? [])].map((s) => s.instanceId);
    const other = all.find((id) => id !== focusedScheme)!;
    const withSide = encounterCardInVillainArea(started, MANIPULATED.id, 3).state;
    const engaged = minionEngagedWith(withSide, MUSIC.id).state;
    const before = mustInstance(engaged, focusedScheme).threat;
    const beforeOther = mustInstance(engaged, other).threat;
    const after = playFree(engaged, deps2, KILL.id).state;
    expect(mustInstance(after, focusedScheme).threat).toBe(before + 3);
    expect(mustInstance(after, other).threat).toBe(beforeOther);
  });
});

/*
 * Ruling 69.114 (October 10, 2025, Alex), question 2: Vivian blanks Boarding Party ("Magneto cannot have more than
 * 6[per_hero] sustained damage"), damage on Magneto then exceeds that. "Yes; once Boarding Party's ability is back in
 * effect, it will immediately affect the amount of sustained damage Magneto has, possibly resulting in less damage on
 * Magneto." RRG 1.8 "Sustained Damage" (p. 42) is silent on a cap coming back after damage was placed.
 *
 * The engine held the cap only as damage was dealt, so damage taken while the scheme was blanked stayed once the blank
 * ended. Fixed: `applySustainedDamageCaps` (`resolve/state-checks.ts`) lowers it between frames.
 */
import { stubSideScheme as stubSide2, stubVillain as stubVillain2 } from "../testing/fixtures.js";
import {
  gameAtFirstTurn as gameAtFirstTurn2,
  copiesOf as copiesOf2,
  encounterCardInVillainArea as inVillainArea2,
} from "../testing/wave3.js";

const CAP = stubAbility("boarding2.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "maxSustainedDamage",
        target: { categories: ["villain"] },
        amount: { kind: "perPlayer", base: 0, perPlayer: 6 },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const BOARDING2 = stubSide2({ id: "boarding2", startingThreat: 3, abilities: [CAP.ref] });
const MAGNETO2 = stubVillain2({ id: "magneto2", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const act2 = (id: string, effects: readonly import("../spec.js").EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const BLANK_IT = act2("blank-it", [
  { kind: "blankTextBox", target: { kind: "each", query: { categories: ["sideScheme"] } }, until: "endOfPhase" },
] as never);
const HIT_5 = act2("hit-5", [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 5 } }]);
const deps3 = depsOf(CAP, BLANK_IT.ability, HIT_5.ability);

describe("audit 34: a sustained-damage cap that comes back after a blank applies at once (ruling Oct 10, 2025, 69.114)", () => {
  it("5 + 5 damage dealt while blanked drops to the 6 cap when the blank ends", () => {
    const base = gameAtFirstTurn2({
      cards: [MAGNETO2, BOARDING2, BLANK_IT.card, HIT_5.card],
      deps: deps3,
      villain: MAGNETO2,
      players: 1,
      deck: [...copiesOf2(HIT_5.card.id, 4), BLANK_IT.card.id],
      encounter: [BOARDING2.id],
    });
    const hero: GameState = {
      ...base,
      players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
    };
    const withScheme = inVillainArea2(hero, BOARDING2.id, 3).state;
    const blanked = playFree(withScheme, deps3, BLANK_IT.card.id).state;
    const hit1 = playFree(blanked, deps3, HIT_5.card.id).state;
    const hit2 = playFree(hit1, deps3, HIT_5.card.id).state;
    const villain = hit2.villains[0]!.instanceId;
    expect(mustInstance(hit2, villain).damage, "damage over the cap while blanked").toBe(10);
    const ended = driveSession(startSession(hit2), deps3, [{ type: "endTurn", playerId: P1 }], defaultPick).session
      .state;
    expect(ended.round, "the round turned, so the end-of-phase blank is over").toBeGreaterThan(hit2.round);
    expect(mustInstance(ended, villain).damage).toBe(6);
  });
});
