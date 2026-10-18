import { PLAYABLE_CARDS } from "@mc/content";
import { characterProfile, createGame, iconsOn, type Command, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../core/setup.js";
import { validateDefinition } from "../../dsl/validate.js";
import { buildCrossHeroDeck } from "../../testing/cross-hero.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  playerOf,
  runWith,
  settle,
  type Picker,
} from "../../testing/harness.js";
import { encounterCardInVillainArea, withForm } from "../../testing/staging.js";
import { engageMinion, stagedInPlay } from "../../wave9/falcon/testing.js";
import { WAVE11_DEPS as DEPS } from "../index.js";
import { JJ_OTHER_ASPECTS as REGISTRY, JJ_OTHER_ASPECTS_SKIPPED as SKIPPED } from "./other-aspects.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Wave 11 `jj/other-aspects` (docs/phase7-wave11-hero-packs.md H8.4), 61034 to 61040. Each aspect card is played from
 * the deck of a Core hero of its aspect (She-Hulk Aggression, Captain Marvel Leadership, Black Panther
 * Protection; definition of done 4b) against Core's Rhino, staged by surgery and used through the engine's commands.
 *
 * The registered ids, each exercised below: "61034.innate-aggression-constant", "61035.shakedown-response",
 * "61037.innate-inspiration-constant", "61038.echo-constant", "61039.when-defeated", "61040.mitigated-threat-constant",
 * "61040.mitigated-threat-forced-response". "61038.echo-constant".
 */
const INNATE_AGGRESSION = "61034";
const SHAKEDOWN = "61035";
const INNATE_INSPIRATION = "61037";
const LAY_LOW = "61039";
const MITIGATED_THREAT = "61040";

const AGGRESSION = "core-she-hulk-aggression";
const LEADERSHIP = "core-captain-marvel-leadership";
const PROTECTION = "core-black-panther-protection";
const SANDMAN = "01102"; // Core minion: SCH 2, 4 hit points
const SHOCKER = "01103"; // Core minion: SCH 1, 3 hit points
const KREE_COMBAT_ARMOR = "16131"; // reduces the damage its host takes from each attack by 1
const PATRIOT = "56041"; // an ally from another set: 3 hit points
const BREAKIN = "01107"; // Core side scheme: hazard
const CROWD_CONTROL = "01108"; // Core side scheme: crisis
const BOMB_SCARE = "01109"; // Core side scheme: acceleration
const RULER_OF_LIMBO = "45055"; // Age of Apocalypse side scheme: one amplify icon
const MINION = "m-sandman" as InstanceId;

/** The minion left play (defeated). */
const defeated = (s: GameState): boolean => !engagedOrInPlay(s);
const engagedOrInPlay = (s: GameState): boolean => s.players.some((p) => p.playArea.includes(MINION));

function coreGame(code: string, starterDeckId: string, twoPlayers = false): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const created = createGame(
    {
      ...config,
      players: [
        buildCrossHeroDeck(PLAYABLE_CARDS, starterDeckId, code),
        ...(twoPlayers
          ? [coreScenario("rhino", { players: [{ starterDeckId: "core-spider-man-justice" }], seed: 1 }).players[0]!]
          : []),
      ],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(`${code}: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  const first = withForm(opened, { heroForm: 0 });
  return twoPlayers ? withForm(first, { heroForm: 0 }, P2) : first;
}

const hero = (s: GameState): InstanceId => identityOf(s, P1);
const profile = (s: GameState, id: InstanceId = hero(s)) => characterProfile(s, id, DEPS)!;
const drive = (s: GameState, pick: Picker, ...commands: Command[]): GameState =>
  settle(runWith(DEPS, s, ...commands), pick, undefined, DEPS);
const basicAttack = (attacker: InstanceId, target: InstanceId, playerId = P1): Command => ({
  type: "basicAttack",
  playerId,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});
const basicThwart = (thwarter: InstanceId, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: scheme,
});

/** Accepts every optional trigger; answers every other prompt with the first legal answer. */
const answering = (): Picker => (s) => {
  const choice = s.pendingChoice!;
  return choice.prompt.kind === "chooseTriggers" ? choice.options.map((o) => o.optionId) : firstLegal(s);
};

/** Surgery: a copy of `code` attached to `host`, controlled by P1. */
function withAttached(state: GameState, host: InstanceId, code: string, id: string): GameState {
  const upgrade = {
    instanceId: id as InstanceId,
    cardId: code,
    ownerId: P1,
    controllerId: P1,
    home: { kind: "playArea", playerId: P1 },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: host,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
  } as never;
  const withInstance = { ...state, instances: { ...state.instances, [id]: upgrade } };
  return patchInstance(withInstance, host, {
    attachments: [...inst(withInstance, host).attachments, id as InstanceId],
  });
}

describe("wave 11 jj/other-aspects", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("skips only refs it does not register, each with a written reason", () => {
    for (const [id, reason] of Object.entries(SKIPPED)) {
      expect(id in REGISTRY, id).toBe(false);
      expect(reason.length, id).toBeGreaterThan(20);
    }
    expect(SKIPPED).toEqual({});
    expect(Object.keys(REGISTRY).sort()).toEqual([
      "61034.innate-aggression-constant",
      "61035.shakedown-response",
      "61037.innate-inspiration-constant",
      "61038.echo-constant",
      "61039.when-defeated",
      "61040.mitigated-threat-constant",
      "61040.mitigated-threat-forced-response",
    ]);
  });

  it("61034.innate-aggression-constant: your hero gets +1 ATK (the alter-ego gets nothing)", () => {
    const start = coreGame(INNATE_AGGRESSION, AGGRESSION);
    const before = profile(start);
    const after = profile(stagedInPlay(start, INNATE_AGGRESSION, { attach: true }).state);
    expect(before.atk).toBe(3);
    expect(after.atk).toBe(4);
    expect(after.thw).toBe(before.thw);
    const egoStart = withForm(start, "alterEgo");
    const ego = profile(egoStart);
    expect(profile(stagedInPlay(egoStart, INNATE_AGGRESSION, { attach: true }).state).atk).toBe(ego.atk);
  });

  it("61037.innate-inspiration-constant: each ally you control gets +1 hit point, another player's ally does not", () => {
    const start = coreGame(INNATE_INSPIRATION, LEADERSHIP, true);
    const withAlly = (s: GameState, controller: typeof P1) => {
      const spare = playerOf(s, controller).deck[0]!;
      const turned = patchInstance(s, spare, { cardId: PATRIOT as never });
      const given = stagedInPlay(turned, PATRIOT);
      return { state: patchInstance(given.state, given.id, { controllerId: controller }), id: given.id };
    };
    const mine = withAlly(start, P1);
    expect(profile(mine.state, mine.id).maxHp).toBe(3);
    const inspired = stagedInPlay(mine.state, INNATE_INSPIRATION, { attach: true });
    expect(profile(inspired.state, mine.id).maxHp).toBe(4);
    // The hero is not an ally.
    expect(profile(inspired.state).maxHp).toBe(profile(mine.state).maxHp);
    // A P2-controlled ally keeps its 3 hit points.
    const theirs = patchInstance(inspired.state, mine.id, { controllerId: P2 });
    expect(profile(theirs, mine.id).maxHp).toBe(3);
  });

  describe("61035.shakedown-response", () => {
    /** Shakedown in P1's play area (not attached), a Sandman (4 hit points, base SCH 2) carrying `damage`, and 9 threat on the main scheme. */
    function setup(damage: number) {
      const shakedown = stagedInPlay(coreGame(SHAKEDOWN, AGGRESSION), SHAKEDOWN, {});
      const withMinion = patchInstance(engageMinion(shakedown.state, SANDMAN, MINION), MINION, { damage });
      const state = patchInstance(withMinion, withMinion.mainScheme.instanceId, { threat: 9 });
      return { state, shakedown: shakedown.id };
    }

    it("after you attack and exactly defeat a minion, exhausts to remove threat equal to its base SCH", () => {
      const { state, shakedown } = setup(1); // 3 remaining hit points, hero ATK 3: exactly defeated
      const after = drive(state, answering(), basicAttack(hero(state), MINION));
      expect(mainThreat(after)).toBe(7);
      expect(inst(after, shakedown).exhausted).toBe(true);
    });

    it("does nothing when the attack deals excess damage", () => {
      const { state, shakedown } = setup(2); // 2 remaining hit points, hero ATK 3: 1 excess
      const after = drive(state, answering(), basicAttack(hero(state), MINION));
      expect(mainThreat(after)).toBe(9);
      expect(inst(after, shakedown).exhausted).toBe(false);
    });

    it("does nothing when the attack does not defeat the minion", () => {
      const { state, shakedown } = setup(0);
      const after = drive(state, answering(), basicAttack(hero(state), MINION));
      expect(inst(after, MINION).damage).toBe(3);
      expect(mainThreat(after)).toBe(9);
      expect(inst(after, shakedown).exhausted).toBe(false);
    });

    it("Ruling 6: ATK 4 against 3 hit points left with damage reduced by 1 takes exactly 3 but deals 1 excess: no trigger", () => {
      const { state, shakedown } = setup(1);
      const spare = playerOf(state, P1).deck[0]!;
      const turned = patchInstance(state, spare, { cardId: INNATE_AGGRESSION as never });
      const armed = stagedInPlay(turned, INNATE_AGGRESSION, { attach: true }).state;
      const armored = withAttached(armed, MINION, KREE_COMBAT_ARMOR, "armor1");
      expect(profile(armored).atk).toBe(4);
      const after = drive(armored, answering(), basicAttack(hero(armored), MINION));
      expect(defeated(after)).toBe(true); // it took exactly its 3 remaining hit points (4 attack - 1)
      expect(mainThreat(after)).toBe(9);
      expect(inst(after, shakedown).exhausted).toBe(false);
    });

    it("under P2's control: P1's exact defeat does not trigger it, P2's does", () => {
      for (const [attacker, threat] of [
        [P1, 9],
        [P2, 7],
      ] as const) {
        const game = coreGame(SHAKEDOWN, AGGRESSION, true);
        const staged = stagedInPlay(game, SHAKEDOWN);
        const theirs = patchInstance(staged.state, staged.id, { controllerId: P2 });
        const attackerHero = identityOf(theirs, attacker);
        const remaining = profile(theirs, attackerHero).atk;
        const withMinion = patchInstance(engageMinion(theirs, SANDMAN, MINION, attacker), MINION, {
          damage: 4 - remaining,
        });
        const state = patchInstance(withMinion, withMinion.mainScheme.instanceId, { threat: 9 });
        const turn = attacker === P2 ? [endTurn(P1)] : [];
        const after = drive(state, answering(), ...turn, basicAttack(attackerHero, MINION, attacker));
        expect(defeated(after), `${attacker}`).toBe(true);
        expect(mainThreat(after), `${attacker}`).toBe(threat);
        expect(inst(after, staged.id).exhausted, `${attacker}`).toBe(attacker === P2);
      }
    });

    it("an ally's exact defeat is not yours: no trigger", () => {
      const { state, shakedown } = setup(2); // 2 hit points left
      const spare = playerOf(state, P1).deck[0]!;
      const ally = stagedInPlay(patchInstance(state, spare, { cardId: PATRIOT as never }), PATRIOT);
      const after = drive(ally.state, answering(), basicAttack(ally.id, MINION)); // Patriot ATK 2
      expect(defeated(after)).toBe(true);
      expect(mainThreat(after)).toBe(9);
      expect(inst(after, shakedown).exhausted).toBe(false);
    });

    it("reads the minion's base SCH: a Shocker (SCH 1) removes 1", () => {
      const { state } = setup(0);
      const shocker = patchInstance(engageMinion(state, SHOCKER, "m-shocker"), "m-shocker" as InstanceId, {
        damage: 0,
      });
      const after = drive(shocker, answering(), basicAttack(hero(shocker), "m-shocker" as InstanceId));
      expect(mainThreat(after)).toBe(8);
    });
  });

  describe("61040.mitigated-threat-constant", () => {
    const iconCases = [
      [BREAKIN, "hazard"],
      [CROWD_CONTROL, "crisis"],
      [BOMB_SCARE, "acceleration"],
    ] as const;
    for (const [code, icon] of iconCases) {
      it(`the attached card loses its ${icon} icon`, () => {
        const start = coreGame(MITIGATED_THREAT, PROTECTION);
        const placed = encounterCardInVillainArea(start, BREAKIN, 2);
        const scheme = { id: placed.id, state: patchInstance(placed.state, placed.id, { cardId: code as never }) };
        expect(iconsOn(scheme.state, DEPS, scheme.id, icon)).toBe(1);
        const attached = withAttached(scheme.state, scheme.id, MITIGATED_THREAT, "mt1");
        expect(iconsOn(attached, DEPS, scheme.id, icon)).toBe(0);
      });
    }

    it("the attached card loses its amplify icon", () => {
      const start = coreGame(MITIGATED_THREAT, PROTECTION);
      const scheme = encounterCardInVillainArea(start, BREAKIN, 2);
      const limbo = patchInstance(scheme.state, scheme.id, { cardId: RULER_OF_LIMBO as never });
      expect(iconsOn(limbo, DEPS, scheme.id, "amplify")).toBe(1);
      const attached = withAttached(limbo, scheme.id, MITIGATED_THREAT, "mt1");
      expect(iconsOn(attached, DEPS, scheme.id, "amplify")).toBe(0);
    });

    it("another card keeps its icons", () => {
      const start = coreGame(MITIGATED_THREAT, PROTECTION);
      const first = encounterCardInVillainArea(start, BREAKIN, 2);
      const placed = encounterCardInVillainArea(first.state, "01186", 2);
      const second = {
        id: placed.id,
        state: patchInstance(placed.state, placed.id, { cardId: CROWD_CONTROL as never }),
      };
      const attached = withAttached(second.state, first.id, MITIGATED_THREAT, "mt1");
      expect(iconsOn(attached, DEPS, second.id, "crisis")).toBe(1);
    });
  });

  describe("61039.when-defeated", () => {
    /** Two players in hero form; Lay Low in P1's play area with 1 threat, P1 and P2 carrying 5 and 4 damage. */
    function setup(p2Form: "hero" | "alterEgo") {
      const start = coreGame(LAY_LOW, PROTECTION, true);
      const given = moveToHand(start, P1, LAY_LOW);
      const lowId = given.ids[0]!;
      const area: GameState = {
        ...given.state,
        players: given.state.players.map((p) => ({ ...p, hand: p.hand.filter((i) => i !== lowId) })),
        villainArea: [...given.state.villainArea, lowId],
      };
      const low = { id: lowId, state: patchInstance(area, lowId, { faceup: true, controllerId: P1 }) };
      const hurt = patchInstance(patchInstance(low.state, low.id, { threat: 1 }), hero(low.state), { damage: 5 });
      const p2 = patchInstance(hurt, identityOf(hurt, P2), { damage: 4 });
      return { state: p2Form === "alterEgo" ? withForm(p2, "alterEgo", P2) : p2, low: low.id };
    }
    const report = (s: GameState) => ({
      p1: [inst(s, identityOf(s, P1)).damage, s.players[0]!.identity.form],
      p2: [inst(s, identityOf(s, P2)).damage, s.players[1]!.identity.form],
    });

    /** P1 answers the form-change prompt with option `p1`, P2 with `p2` (option ids are indices). */
    const byPlayer =
      (p1: number, p2: number): Picker =>
      (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind !== "chooseOption") return answering()(s);
        return [choice.options[choice.playerId === P1 ? p1 : p2]!.optionId];
      };

    it("a player who changes heals REC (4) and one already in alter-ego form heals REC (3) without being asked", () => {
      const { state, low } = setup("alterEgo");
      expect(report(state)).toEqual({ p1: [5, "hero"], p2: [4, "alterEgo"] });
      const after = drive(state, byPlayer(0, 1), basicThwart(hero(state), low));
      expect(report(after)).toEqual({ p1: [1, "alterEgo"], p2: [1, "alterEgo"] });
    });

    it("a player who declines stays a hero and heals nothing", () => {
      const { state, low } = setup("hero");
      const after = drive(state, byPlayer(1, 1), basicThwart(hero(state), low));
      expect(report(after)).toEqual({ p1: [5, "hero"], p2: [4, "hero"] });
    });

    it("each player chooses for themself: one changes and heals, the other declines", () => {
      const { state, low } = setup("hero");
      const after = drive(state, byPlayer(0, 1), basicThwart(hero(state), low));
      expect(report(after)).toEqual({ p1: [1, "alterEgo"], p2: [4, "hero"] });
    });
  });

  describe("61040.mitigated-threat-forced-response", () => {
    /** Mitigated Threat on P1's hero (a second player when asked); every player at the end of the round answers the spend. */
    function endRound(spends: readonly boolean[]) {
      const mt = stagedInPlay(coreGame(MITIGATED_THREAT, PROTECTION, spends.length > 1), MITIGATED_THREAT, {
        attach: true,
      });
      const asked: string[] = [];
      const paid: string[] = [];
      const pick: Picker = (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind !== "spendResources") return answering()(s);
        asked.push(choice.playerId);
        const pays = spends[choice.playerId === P1 ? 0 : 1]!;
        if (pays) paid.push(choice.options[0]!.optionId);
        return pays ? [choice.options[0]!.optionId] : [];
      };
      const after = drive(mt.state, pick, ...mt.state.players.map((p) => endTurn(p.playerId)));
      return { after, asked, paid, id: mt.id };
    }
    const attachedTo = (s: GameState, id: InstanceId) => inst(s, id).attachedTo;

    it("stays when the only player spends 1 resource", () => {
      const r = endRound([true]);
      expect(r.asked).toEqual([P1]);
      expect(r.paid).toHaveLength(1);
      expect(playerOf(r.after, P1).discard).toContain(r.paid[0]!.replace("hand:", ""));
      expect(attachedTo(r.after, r.id)).toBe(hero(r.after));
    });

    it("is discarded when the only player does not spend", () => {
      const r = endRound([false]);
      expect(r.asked).toEqual([P1]);
      expect(playerOf(r.after, P1).discard).toContain(r.id);
    });

    it("stays when both players spend", () => {
      const r = endRound([true, true]);
      expect([...r.asked].sort()).toEqual([P1, P2]); // the first player token has passed, so P2 is asked first
      expect(attachedTo(r.after, r.id)).toBe(hero(r.after));
    });

    it("is discarded when any player does not spend, and every player is still asked", () => {
      for (const spends of [
        [true, false],
        [false, true],
      ]) {
        const r = endRound(spends);
        expect([...r.asked].sort(), JSON.stringify(spends)).toEqual([P1, P2]);
        expect(playerOf(r.after, P1).discard, JSON.stringify(spends)).toContain(r.id);
        expect(r.paid, JSON.stringify(spends)).toHaveLength(1);
      }
    });
  });

  describe("61038.echo-constant", () => {
    const STARSHARK = "16137"; // ATK 3, its attacks deal indirect damage
    /** Echo in play and `minion` engaged; every defender prompt but the `defendAt`-th (0 = the villain's) is declined, which Echo answers. */
    function villainPhase(minion: string, defendAt: number, alterEgo = false) {
      const echo = stagedInPlay(coreGame("61038", PROTECTION), "61038");
      const withMinion = engageMinion(echo.state, minion, "m-attacker");
      const state = alterEgo ? withForm(withMinion, "alterEgo") : withMinion;
      let prompts = 0;
      const pick: Picker = (s) => {
        const c = s.pendingChoice!;
        if (c.prompt.kind === "declareDefender") {
          const mine = prompts++ === defendAt;
          return mine && c.options.some((o) => o.optionId === echo.id) ? [echo.id] : ["decline"];
        }
        if (c.prompt.kind === "assignIndirectDamage") {
          return c.options.filter((o) => o.optionId.startsWith(`${echo.id}#`)).map((o) => o.optionId);
        }
        return answering()(s);
      };
      const after = drive(state, pick, endTurn(P1));
      return { echoDamage: inst(after, echo.id).damage, def: profile(state).def };
    }

    it("reduces the damage she takes defending an enemy attack by your hero's DEF (3 ATK - 2 DEF = 1)", () => {
      expect(villainPhase(SANDMAN, 1)).toEqual({ echoDamage: 1, def: 2 });
    });

    it("reduces indirect damage from an enemy attack: 3 assigned to Echo, she takes 1 (August 3, 2026 - Ruling 2)", () => {
      expect(villainPhase(STARSHARK, 99).echoDamage).toBe(1);
    });

    it("reads 0 DEF while your identity is in alter-ego form, and no enemy attack reaches her then", () => {
      // The amount is your identity's DEF (Black Panther 2, T'Challa 0). Enemies scheme against an alter-ego rather than attack, so
      // Echo takes nothing from the villain phase in that form.
      const echo = stagedInPlay(coreGame("61038", PROTECTION), "61038");
      expect(profile(echo.state).def).toBe(2);
      expect(profile(withForm(echo.state, "alterEgo")).def).toBe(0);
      expect(villainPhase(STARSHARK, 99, true).echoDamage).toBe(0);
    });
  });
});
