/**
 * `defendChoiceViewOf` against two kinds of fixture:
 *  - a real `declareDefender` choice, played out by real Core content (the same recipe
 *    `villain-walkthrough.test.ts`'s `playThroughDefendedAttack` uses) — proves the wiring end to end;
 *  - hand-built `DefendOptionPreview`/`StackEntry`/`Vars` fixtures, for the RRG cases (Tough, Overkill, Retaliate,
 *    a Boost ability, a forced interrupt) a two-line seed doesn't happen to reach — the same pattern
 *    `ability-label.test.ts` and `choice-source.test.ts` use for a case a real game can't cheaply produce.
 */

import { describe, expect, test } from "vitest";
import type { DefendBand, GameState, InstanceId, PendingChoice, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import {
  bandFactsOf,
  consequenceLinesFrom,
  damageHeadline,
  defendCauseFrom,
  defendChoiceViewOf,
  forcedNotesOf,
  hpAfterFrom,
} from "./defend-choice.js";

async function playToDeclareDefender(): Promise<{ state: GameState; choice: PendingChoice; viewer: PlayerId }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });
  const viewer = store.state.game!.players[0]!.playerId;
  let changedForm = false;

  for (let step = 0; step < 40; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      if (choice.prompt.kind === "declareDefender") {
        return { state: store.state.game!, choice, viewer };
      }
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      continue;
    }
    if (legal.actions.kind !== "turn") break;
    if (!changedForm) {
      changedForm = true;
      const toHero = legal.actions.legal.find((entry) => entry.action.kind === "changeForm");
      if (toHero) {
        await store.dispatch(toHero.example);
        continue;
      }
    }
    const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) break;
    await store.dispatch(end.example);
  }
  throw new Error("never reached a declareDefender choice");
}

describe("defendChoiceViewOf: a real declareDefender choice", () => {
  test("returns null for a choice that isn't declareDefender", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 2026,
    });
    const legal = store.state.legal!.actions;
    if (legal.kind !== "choice") throw new Error("expected the mulligan choice");
    expect(
      defendChoiceViewOf(store.state.game!, legal.choice, POOL_DEPS, store.state.game!.players[0]!.playerId, []),
    ).toBeNull();
  });

  test("names the attacker, the options, the stack and who decides — using only what the engine reports", async () => {
    const { state, choice, viewer } = await playToDeclareDefender();
    const view = defendChoiceViewOf(state, choice, POOL_DEPS, viewer, []);
    expect(view).not.toBeNull();
    const v = view!;

    expect(v.choiceId).toBe(choice.choiceId);
    expect(v.summary.attackerName).toBe("Rhino");
    expect(v.summary.baseAtk).toBeGreaterThan(0);
    expect(v.summary.facedownCount).toBeGreaterThanOrEqual(1);

    // Every option the engine offered is worded, in the engine's own order, with none invented.
    expect(v.options.map((o) => o.optionId)).toEqual(choice.options.map((o) => o.optionId));
    const decline = v.options.find((o) => o.kind === "decline");
    expect(decline?.title).toBe("No defense");
    expect(decline?.exhaustsNames).toEqual([]);
    const defend = v.options.find((o) => o.kind === "defender");
    expect(defend?.title).toBe("You defend");
    expect(defend?.exhaustsNames.length).toBeGreaterThan(0);

    // Every option's damage headline is a real range or a real number, never blank.
    for (const option of v.options) {
      expect(option.damageHeadline).toMatch(/^\d+( damage|–\d+ damage)$/);
    }

    // The stack has exactly one open window, and it belongs to the frame the choice names.
    const open = v.stack.filter((row) => row.openWindow);
    expect(open).toHaveLength(1);
    expect(open[0]!.frameId).toBe(choice.frameId);

    // A choice is open, so nothing else is independently playable right now (see the module's own doc comment).
    expect(v.defenseEventsNote).toBe("Nothing playable in hand right now.");

    expect(v.waitingOn).toContain("Declare your defender");
    expect(v.waitingOn).toContain("other players may still respond");
  });

  test("marks the selected option", async () => {
    const { state, choice, viewer } = await playToDeclareDefender();
    const declineId = choice.options.find((o) => o.optionId === "decline")!.optionId;
    const view = defendChoiceViewOf(state, choice, POOL_DEPS, viewer, [declineId])!;
    expect(view.options.find((o) => o.optionId === declineId)!.selected).toBe(true);
    expect(view.options.filter((o) => o.selected)).toHaveLength(1);
  });

  test("names another seat's defender as themself, not \"you\", when the viewer isn't the attacked player", async () => {
    const { state, choice } = await playToDeclareDefender();
    const otherViewer = state.players.find((p) => p.playerId !== choice.playerId)?.playerId ?? null;
    const view = defendChoiceViewOf(state, choice, POOL_DEPS, otherViewer, [])!;
    const defend = view.options.find((o) => o.kind === "defender");
    expect(defend?.title).not.toBe("You defend");
    expect(defend?.title).toMatch(/defends$/);
  });
});

// ---------------------------------------------------------------------------
// Hand-built band fixtures for the RRG cases a two-line seed doesn't reach —
// `bandFactsOf`/`consequenceLinesFrom`/`damageHeadline`/`hpAfterFrom` are pure
// over `DefendBand[]` and plain names, so none of this needs a `GameState`.
// ---------------------------------------------------------------------------

const band = (over: Partial<DefendBand>): DefendBand => ({
  boostFrom: 0,
  boostTo: 0,
  damageDealt: 0,
  damageTaken: 0,
  toughSpent: false,
  defeated: false,
  overkillToInstanceId: null,
  overkillAmount: 0,
  retaliateToAttacker: 0,
  ...over,
});

describe("damageHeadline", () => {
  test("a single band with no variance reads as one number, including zero", () => {
    expect(damageHeadline([band({ damageTaken: 0 })])).toBe("0 damage");
    expect(damageHeadline([band({ damageTaken: 3 })])).toBe("3 damage");
  });

  test("bands spanning a range read low–high off the first and last band, per defend-preview.ts's own example", () => {
    expect(
      damageHeadline([
        band({ boostFrom: 1, boostTo: 1, damageTaken: 5 }),
        band({ boostFrom: 2, boostTo: 2, damageTaken: 6 }),
        band({ boostFrom: 3, boostTo: 3, damageTaken: 7 }),
      ]),
    ).toBe("5–7 damage");
  });
});

describe("hpAfterFrom", () => {
  test("a fixed outcome reads as one number", () => {
    expect(hpAfterFrom(16, 16, [band({ damageTaken: 4 })])).toBe("12 of 16 HP");
  });

  test("a range subtracts each end of the band range from current HP, worst case first", () => {
    expect(hpAfterFrom(16, 16, [band({ damageTaken: 1 }), band({ damageTaken: 5 })])).toBe("11–15 of 16 HP");
  });

  test("never reports negative HP — a lethal band floors at 0", () => {
    expect(hpAfterFrom(3, 16, [band({ damageTaken: 3 }), band({ damageTaken: 7, defeated: true })])).toBe("0 of 16 HP");
  });
});

describe("bandFactsOf / consequenceLinesFrom", () => {
  test("no consequence at all: every fact is null and there is nothing to say", () => {
    const facts = bandFactsOf([band({ damageTaken: 2 })]);
    expect(facts).toEqual({ defeatAt: null, toughAbsorbsUpTo: null, overkill: null, retaliate: null });
    expect(consequenceLinesFrom(facts, "Spider-Man", null, "Rhino")).toEqual([]);
  });

  test("a defeat threshold — defend-preview.ts's own example, worded", () => {
    const facts = bandFactsOf([
      band({ boostFrom: 1, boostTo: 1, damageTaken: 5 }),
      band({ boostFrom: 2, boostTo: 2, damageTaken: 6, defeated: true }),
      band({ boostFrom: 3, boostTo: 3, damageTaken: 7, defeated: true }),
    ]);
    expect(facts.defeatAt).toBe(6);
    expect(consequenceLinesFrom(facts, "the ally", null, "Rhino")).toEqual(["At 6+ damage, the ally is defeated."]);
  });

  test("Tough (RRG 1.8 p. 44): reads as the worst-case pre-tough damage it protected against, not a range of zeros", () => {
    const facts = bandFactsOf([
      band({ boostFrom: 1, boostTo: 1, damageDealt: 3, damageTaken: 0, toughSpent: true }),
      band({ boostFrom: 2, boostTo: 2, damageDealt: 4, damageTaken: 0, toughSpent: true }),
    ]);
    expect(facts.toughAbsorbsUpTo).toBe(4);
    expect(consequenceLinesFrom(facts, "Captain Marvel", null, "Klaw")).toEqual([
      "Tough absorbs it — up to 4 damage prevented.",
    ]);
  });

  test("a hero's basic defense reducing damage to exactly 0 keeps Tough — not spent, and no callout", () => {
    const facts = bandFactsOf([band({ boostFrom: 1, boostTo: 1, damageDealt: 0, damageTaken: 0, toughSpent: false })]);
    expect(facts.toughAbsorbsUpTo).toBeNull();
  });

  test("Overkill (RRG 1.8 p. 31): only reported with a named recipient, worst case across the range", () => {
    const facts = bandFactsOf([
      band({
        boostFrom: 1,
        boostTo: 1,
        damageTaken: 6,
        defeated: true,
        overkillToInstanceId: "villain" as InstanceId,
        overkillAmount: 1,
      }),
      band({
        boostFrom: 2,
        boostTo: 2,
        damageTaken: 7,
        defeated: true,
        overkillToInstanceId: "villain" as InstanceId,
        overkillAmount: 2,
      }),
    ]);
    expect(facts.overkill).toEqual({ amount: 2, recipientInstanceId: "villain" });
    expect(consequenceLinesFrom(facts, "the minion", "Rhino", "Rhino")).toEqual([
      "At 6+ damage, the minion is defeated.",
      "Overkill could spill up to 2 to Rhino.",
    ]);
  });

  test("no overkill keyword: defeated bands with no recipient report nothing", () => {
    const facts = bandFactsOf([
      band({ damageTaken: 6, defeated: true, overkillToInstanceId: null, overkillAmount: 0 }),
    ]);
    expect(facts.overkill).toBeNull();
  });

  test("Retaliate X (RRG 1.8 p. 38): fixed across a surviving band, 0 (omitted) once the defender is defeated", () => {
    const surviving = bandFactsOf([band({ damageTaken: 2, retaliateToAttacker: 2 })]);
    expect(surviving.retaliate).toBe(2);
    expect(consequenceLinesFrom(surviving, "She-Hulk", null, "Klaw")).toEqual(["Retaliate 2 back to Klaw."]);

    const defeated = bandFactsOf([band({ damageTaken: 9, defeated: true, retaliateToAttacker: 0 })]);
    expect(defeated.retaliate).toBeNull();
  });

  test("every consequence at once, in one fixed order: defeat, Tough, Overkill, Retaliate", () => {
    const facts = bandFactsOf([
      band({
        damageTaken: 6,
        defeated: true,
        retaliateToAttacker: 0,
        overkillToInstanceId: "villain" as InstanceId,
        overkillAmount: 3,
      }),
    ]);
    expect(consequenceLinesFrom(facts, "the ally", "Klaw", "Klaw")).toEqual([
      "At 6+ damage, the ally is defeated.",
      "Overkill could spill up to 3 to Klaw.",
    ]);
  });
});

describe("forcedNotesOf", () => {
  test("no vars at all: nothing to report", () => {
    expect(forcedNotesOf({})).toEqual([]);
  });

  test("an extra boost card, worded singular and plural", () => {
    expect(forcedNotesOf({ extraBoost: 1 })).toEqual([
      "Forced interrupt: +1 additional boost card for this activation.",
    ]);
    expect(forcedNotesOf({ extraBoost: 2 })).toEqual([
      "Forced interrupt: +2 additional boost cards for this activation.",
    ]);
  });

  test("a +ATK bonus and a granted Overkill, both worded, in order", () => {
    expect(forcedNotesOf({ atkBonus: 2, overkill: 1 })).toEqual([
      "Forced interrupt: +2 ATK for this activation.",
      "Forced interrupt: this attack has gained Overkill.",
    ]);
  });
});

describe("defendCauseFrom — why the attack is happening", () => {
  const name = (id: InstanceId): string => `<${id}>`;
  const klaw = "i1" as InstanceId;
  const gangUp = "i9" as InstanceId;

  test("nothing under the attack during step two: the villain's ordinary activation", () => {
    const cause = defendCauseFrom(
      [
        { kind: "window", subjectInstanceId: null },
        { kind: "event", subjectInstanceId: null },
        { kind: "enemyAttack", subjectInstanceId: klaw },
      ],
      klaw,
      "villain",
      true,
      name,
    );
    expect(cause).toEqual({
      kind: "villainActivation",
      eyebrow: "Villain phase · step 2 — the villain activates",
      sourceInstanceId: null,
    });
  });

  test("a minion's activation says so", () => {
    expect(defendCauseFrom([{ kind: "enemyAttack", subjectInstanceId: klaw }], klaw, "minion", true, name).kind).toBe(
      "minionActivation",
    );
  });

  test("a card's frame under the attack: that card's effect, even in step two", () => {
    const cause = defendCauseFrom(
      [
        { kind: "enemyAttack", subjectInstanceId: klaw },
        { kind: "effects", subjectInstanceId: gangUp },
        { kind: "reveal", subjectInstanceId: gangUp },
      ],
      klaw,
      "villain",
      true,
      name,
    );
    expect(cause).toEqual({ kind: "cardEffect", eyebrow: "Card effect — <i9>", sourceInstanceId: gangUp });
  });

  test("frames above the attack (its own windows) are not its cause", () => {
    expect(
      defendCauseFrom(
        [
          { kind: "ability", subjectInstanceId: gangUp },
          { kind: "enemyAttack", subjectInstanceId: klaw },
        ],
        klaw,
        "villain",
        true,
        name,
      ).kind,
    ).toBe("villainActivation");
  });

  test("the attacker's own ability (Quickstrike-style) names the attacker and draws no second scan", () => {
    const cause = defendCauseFrom(
      [
        { kind: "enemyAttack", subjectInstanceId: klaw },
        { kind: "ability", subjectInstanceId: klaw },
      ],
      klaw,
      "minion",
      false,
      name,
    );
    expect(cause).toEqual({ kind: "cardEffect", eyebrow: "Card effect — <i1>'s own ability", sourceInstanceId: null });
  });

  test("outside step two with nothing beneath: a plain enemy attack", () => {
    expect(defendCauseFrom([{ kind: "enemyAttack", subjectInstanceId: klaw }], klaw, "villain", false, name).kind).toBe(
      "attack",
    );
  });
});

describe("defendChoiceViewOf — the matchup", () => {
  test("names the attacker, the character under attack, and the ordinary activation as the cause", async () => {
    const { state, choice, viewer } = await playToDeclareDefender();
    const view = defendChoiceViewOf(state, choice, POOL_DEPS, viewer, [])!;
    if (choice.prompt.kind !== "declareDefender") throw new Error("unreachable");
    expect(view.summary.attackerInstanceId).toBe(choice.prompt.attack.enemyInstanceId);
    expect(view.summary.targetInstanceId).toBe(choice.prompt.attack.targetCharacterInstanceId);
    expect(view.summary.targetCaption).toBe(`Attacking you — ${view.summary.targetCardName}`);
    expect(view.summary.cause.kind).toBe("villainActivation");
    const decline = view.options.find((option) => option.kind === "decline")!;
    expect(decline.pictureInstanceId).toBe(view.summary.targetInstanceId);
    for (const option of view.options.filter((entry) => entry.kind === "defender"))
      expect(option.pictureInstanceId).toBe(option.defenderInstanceId);
  });
});
