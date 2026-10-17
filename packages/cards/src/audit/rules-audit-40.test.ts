/**
 * Rules audit chunk 40 (FFG rulings post-RRG 1.5, Jan 25 - May 10, 2024). Audit proofs only: each `it.fails` marks a
 * place the engine does something an official source forbids, and flips to a failure when it is fixed.
 */
import { cardId } from "@mc/content";
import { activeVillain, createGame, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  endTurn,
  firstLegal,
  identityOf,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../testing/harness.js";
import { conjure, drive, intoPlay, rhino, withPatrolMinion } from "../testing/qa-bench.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../wave7/index.js";
import {
  CHARGE,
  attachEncounter,
  attachedCodes,
  attached,
  bothEnd,
  conjure as conjureFor,
  drive as driveRules,
  fillers,
  funded,
  game,
  inPlayArea,
  playCard,
  takes,
  villainOf,
  discardCodes,
  fewest,
} from "../wave7/rulings-2026-10-06-harness.js";

vi.setConfig({ testTimeout: 120_000 });

describe("Ruling 148, Feb 15, 2024 (post-RRG 1.5): a canceled attack still ends, so 'at the end of this attack' effects run (RRG 1.8 p. 9)", () => {
  it.fails("Charge (01099) is discarded when Grasping Tendrils (20003) cancels Rhino's attack", () => {
    const base = game("rhino", ["core-spider-man-justice"], ["the_doomsday_chair"]);
    const rhinoId = villainOf(base);
    const charge = attachEncounter(base, CHARGE, rhinoId);
    const given = conjureFor(funded(charge.state, 4, P1), P1, "20003");
    const staged = fillers(given.state);
    const run = driveRules(staged, { chooseTriggers: takes("20003") }, ...bothEnd(staged));
    // Staging sanity: Tendrils resolved.
    expect(
      run.events.some((e) => e.type === "abilityResolved" && e.abilityId === "20003.grasping-tendrils-interrupt"),
    ).toBe(true);
    // Actual: Charge stays attached (its delayed discard is dropped with the canceled attack).
    expect(attachedCodes(run.state, rhinoId)).not.toContain(CHARGE);
  });
});

describe("Ruling 150, Mar 15, 2024: Deadpool ally healing 3 from excess consequential damage is still defeated if HP is not positive (RRG 1.8 'Damage' p. 14)", () => {
  it("2 damage on him, 4 consequential damage: 2 + 4 - 3 = 3 on 3 hit points, so he is defeated (one token is added)", () => {
    const base = withPatrolMinion(rhino());
    const minion = base.players
      .find((p) => p.playerId === P1)!
      .playArea.find((id) => base.instances[id]!.engagedWith === P1)!;
    const placed = intoPlay(base, "40024");
    // Staging: Wild Wild Mojo's extra consequential damage modeled by printing 4 on the card.
    const card = placed.state.cardPool[cardId("40024")] as unknown as object;
    const pooled = {
      ...placed.state,
      cardPool: {
        ...placed.state.cardPool,
        [cardId("40024")]: { ...card, consequentialDamage: { attack: 4, thwart: 1 } },
      },
    } as unknown as GameState;
    const staged = patchInstance(pooled, placed.id, { damage: 2 });
    const tokens = staged.mainScheme.accelerationTokens;
    const done = drive(
      staged,
      { type: "basicAttack", playerId: P1, attackerInstanceId: placed.id, targetInstanceId: minion },
      { use: ["deadpool"] },
    );
    expect(done.accepted).toBe(true);
    expect(done.state.mainScheme.accelerationTokens - tokens).toBe(1);
    expect(done.events.some((e) => e.type === "characterDefeated" && e.instanceId === placed.id)).toBe(true);
    expect(playerOf(done.state, P1).playArea).not.toContain(placed.id);
  });
});

describe("Ruling 151, Mar 15, 2024: Defiance (26018) cannot be played while an ally defends ('you' is the identity; RRG 1.8 'You, Your' p. 49)", () => {
  it("an ally defends Rhino's attack, Defiance in hand: it is not played", () => {
    const base = rhino(1, "core-black-panther-protection");
    const ally = intoPlay(base, "01058");
    const given = conjure(ally.state, "26018");
    const staged = patchInstance(stackEncounterDeck(given.state, "01109"), given.state.mainScheme.instanceId, {
      threat: 1,
    });
    const done = drive(staged, endTurn(P1), { defend: ally.id, use: ["26018.defiance-interrupt"] });
    expect(done.events.some((e) => e.type === "defenderDeclared")).toBe(true);
    // Before the fix: Defiance was played and discarded the boost card.
    expect(done.events.some((e) => e.type === "boostCancelled" && e.scope === "discarded")).toBe(false);
    expect(playerOf(done.state, P1).discard).not.toContain(given.id);
  });
});

describe("Ruling 152, Mar 22, 2024: Laser Swords counts as two Restricted Weapon cards and interacts with Side Holster", () => {
  it("Captain America's Shield (restricted Item) + Side Holster in play, then Laser Swords: nothing is discarded", () => {
    let s = game("rhino", ["deadpool-pool"], ["the_doomsday_chair"]);
    s = attached(s, "03009").state;
    s = inPlayArea(s, "20021").state;
    const run = playCard(s, "44055", 3, { chooseCards: fewest });
    // Was: the limit stayed 2 (Holster only made room for a restricted-keyword Weapon), load 3: the Shield went.
    expect(attachedCodes(run.state, identityOf(run.state)).sort()).toEqual(["03009", "44055"]);
    expect(discardCodes(run.state)).not.toContain("03009");
  });
});

describe("Ruling 165, 2024 + RRG 1.8 'Permanent' (p. 32): a permanent attachment re-resolves its 'attach to' when its host leaves play", () => {
  it.fails("Flight (40151) on a Morlock Siege villain: the next villain gets it, it is not discarded", () => {
    let s: GameState | null = null;
    for (let seed = 1; seed < 400 && !s; seed++) {
      const created = createGame(
        wave7Scenario("morlock-siege", {
          players: [{ starterDeckId: "core-spider-man-justice" }],
          seed,
          difficulty: "standard",
          modularSetIds: ["flight"],
        }),
        WAVE7_DEPS,
      );
      if (!created.ok) throw new Error(created.error.message);
      if ((created.state.instances[activeVillain(created.state).instanceId]!.cardId as string).startsWith("40071"))
        s = settle(created.state, firstLegal, (x) => x.step.phase === "player", WAVE7_DEPS);
    }
    const base0 = s!;
    const keepOne = {
      ...base0,
      encounterSetAside: base0.encounterSetAside.filter(
        (id) =>
          base0.cardPool[base0.instances[id]!.cardId]!.type !== "villain" ||
          (base0.instances[id]!.cardId as string) === "40072a",
      ),
    };
    const hero = withForm(keepOne, { heroForm: 0 }, P1);
    const target = activeVillain(hero).instanceId;
    const flight = Object.keys(hero.instances).find(
      (id) => hero.instances[id as never]!.cardId === "40151",
    )! as InstanceId;
    const clear = { stunned: 0, confused: 0, tough: 0 };
    const armed = patchInstance(patchInstance(hero, target, { damage: 999, statuses: clear }), identityOf(hero), {
      exhausted: false,
      damage: 0,
      statuses: clear,
    });
    const run = driveEventsPicking(WAVE7_DEPS, armed, firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(armed),
      targetInstanceId: target,
    } as never);
    const next = activeVillain(run.state).instanceId;
    expect(next).not.toBe(target);
    // Actual: Flight goes to the encounter discard pile and the new villain has no attachments.
    expect(run.state.instances[flight]!.attachedTo).toBe(next);
  });
});
