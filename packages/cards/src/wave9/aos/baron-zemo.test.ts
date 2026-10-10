import { AOS_EVIDENCE_COMBINATIONS, type EvidenceCombination } from "@mc/content";
import {
  createGame,
  evidenceRowId,
  hasKeyword,
  maxHitPoints,
  openEvidenceRows,
  remainingHitPoints,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import { applyOk, endTurn, firstLegal, inst, patchInstance, settle, type Picker } from "../../testing/harness.js";
import { withDamage } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { abilityRefIds } from "../../ability-refs.js";
import { wave9Scenario } from "../setup.js";
import { BLANK, IRON_MAN, ONE_ICON, SPIDER_MAN, codeOf, dataOf, heroAttacks, heroForm, onlyDeck } from "../testing.js";
import { BARON_ZEMO, BARON_ZEMO_SKIPPED } from "./baron-zemo.js";
import { EXECUTIVE_BOARD } from "./executive-board.js";

vi.setConfig({ testTimeout: 300_000 });

/**
 * The frame of the Baron Zemo scenario: the villain 50165a/b and 50166a/b, the three main scheme stages 50167 to
 * 50169 and the evidence as hidden piles (docs/phase7-wave9.md sections 3.26, 3.28, 3.29; owner decisions Q1, Q28,
 * Q30). The real scenario (`wave9Scenario("baron-zemo")`) with the Executive Board set, driven through the real
 * Response at the end of the player phase. The encounter deck is cut to a blank card and the Sword so no unscripted
 * second-half card is revealed.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, BARON_ZEMO, EXECUTIVE_BOARD) };

const MEDICAL = "50181a";
const SURVEILLANCE = "50182a";
const TACTICAL = "50183a";
const MEMBERS = [MEDICAL, SURVEILLANCE, TACTICAL];
const SWORD = "50170";
const GRID = AOS_EVIDENCE_COMBINATIONS;
const GUESSES = ["means", "motive", "opportunity"] as const;

const REFS = [
  "50165a.baron-zemo-forced-interrupt",
  "50165b.baron-zemo-forced-interrupt",
  "50166a.baron-zemo-forced-interrupt",
  "50166b.baron-zemo-forced-interrupt",
  "50167a.setup",
  "50167b.zemos-manipulations-response",
  "50168a.when-revealed",
  "50168b.when-revealed",
  "50168b.the-accusation-constant",
  "50168b.the-accusation-constant-2",
  "50168b.the-accusation-constant-3",
  "50168b.the-accusation-constant-4",
  "50169a.when-revealed",
  "50169b.when-revealed",
];

interface Plan {
  /** The first player takes 1B's Response (a plan that never does only ends the player phase). */
  readonly take?: boolean;
  /** Answer the offer to place 2 counters for evidence: yes (default: no). */
  readonly gain?: boolean;
  /** Answer the offer to advance to stage 2A: yes (default: no). */
  readonly advance?: boolean;
  /** The row accused. */
  readonly accuse?: EvidenceCombination;
  /** Zemo's own interrupt (the Unmasked face): the label prefix to answer. */
  readonly zemo?: string;
}

interface Asked {
  readonly kind: string;
  readonly labels: readonly string[];
}

const mkPicker =
  (plan: Plan): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    switch (choice.prompt.kind) {
      case "chooseTriggers": {
        const hit = plan.take
          ? choice.options.find((o) => (o.optionId as string).includes("zemos-manipulations"))
          : undefined;
        return hit ? [hit.optionId] : [];
      }
      case "chooseOption": {
        const wanted = (prefix: string, yes: boolean | undefined) =>
          choice.options.find((o) => (yes ? o.label.startsWith(prefix) : o.label.startsWith("Do not")));
        const gain = choice.options.some((o) => o.label.startsWith("Place 2 secret counters"));
        if (gain) return [wanted("Place 2 secret counters", plan.gain)!.optionId];
        const advance = choice.options.some((o) => o.label.startsWith("Advance to stage 2A"));
        if (advance) return [wanted("Advance to stage 2A", plan.advance)!.optionId];
        const zemo = plan.zemo ? choice.options.find((o) => o.label.startsWith(plan.zemo!)) : undefined;
        return zemo ? [zemo.optionId] : firstLegal(s);
      }
      case "accuse": {
        const row = plan.accuse ?? GRID[0]!;
        const hit = choice.options.find((o) => (o.optionId as string) === evidenceRowId(row));
        if (!hit) throw new Error("the accused row is not offered");
        return [hit.optionId];
      }
      default:
        return firstLegal(s);
    }
  };

interface Sim {
  state: GameState;
  events: GameEvent[];
  asked: Asked[];
}

/** Zemo's own interrupt once the villain phase of a game on stage 3 starts: everything the frame does is done. */
const atZemoInterrupt = (s: GameState): boolean =>
  s.pendingChoice?.prompt.kind === "chooseOption" &&
  s.pendingChoice.options.some((o) => o.label.startsWith("Give Baron Zemo an additional boost card"));

function open(
  players: readonly (typeof SPIDER_MAN | typeof IRON_MAN)[] = [SPIDER_MAN],
  difficulty: "standard" | "expert" = "standard",
): Sim {
  const created = createGame(wave9Scenario("baron-zemo", { players, seed: 1, difficulty }), DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  state = onlyDeck(state, BLANK, BLANK, ONE_ICON, "01187", "01189", "01190", SWORD);
  return { state: heroForm(state), events: [], asked: [] };
}

/** Ends every player's turn and answers prompts by `plan`, until nothing is asked, the game ends, or Zemo's interrupt is. */
function endPlayerPhase(sim: Sim, plan: Plan): void {
  const pick = mkPicker(plan);
  const take = (result: { readonly state: GameState; readonly events: readonly GameEvent[] }) => {
    sim.state = result.state;
    sim.events.push(...result.events);
  };
  for (const p of sim.state.players) take(applyOk(sim.state, endTurn(p.playerId), DEPS));
  for (let guard = 0; sim.state.pendingChoice && !sim.state.outcome && !atZemoInterrupt(sim.state); guard++) {
    if (guard > 200) throw new Error("choices did not settle");
    const choice = sim.state.pendingChoice;
    sim.asked.push({ kind: choice.prompt.kind, labels: choice.options.map((o) => o.label) });
    take(
      applyOk(
        sim.state,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: pick(sim.state),
        },
        DEPS,
      ),
    );
  }
}

const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
/** A Board Member card: the environment in the villain area, or its attachment face once flipped. */
const memberOf = (s: GameState, code: string): InstanceId => {
  const aid = `${code.slice(0, -1)}b`;
  const found = (Object.keys(s.instances) as InstanceId[]).find((i) => {
    const c = codeOf(s, i);
    return (c === code && s.villainArea.includes(i)) || (c === aid && s.instances[i]!.attachedTo !== null);
  });
  if (!found) throw new Error(`no ${code} in play`);
  return found;
};
const secrets = (s: GameState, code: string): number => inst(s, memberOf(s, code)).counters["secret"] ?? 0;
const isAttachment = (s: GameState, code: string): boolean => codeOf(s, memberOf(s, code)) === `${code.slice(0, -1)}b`;
const withSecrets = (s: GameState, counts: Readonly<Record<string, number>>): GameState => {
  let current = s;
  for (const [code, n] of Object.entries(counts))
    current = patchInstance(current, memberOf(current, code), { counters: n > 0 ? { secret: n } : {} });
  return current;
};
const aimOf = (s: GameState): readonly string[] => (s.hiddenPiles?.["aim"] ?? []).map((c) => c as string);
/** The row the A.I.M. pile makes: the mole's. */
const moleRow = (s: GameState): EvidenceCombination => {
  const aim = new Set(aimOf(s));
  return GRID.find((row) => GUESSES.every((g) => aim.has(row[g] as string)))!;
};
const moleCode = (s: GameState): string => moleRow(s).boardMember as string;
const differing = (row: EvidenceCombination, mole: EvidenceCombination) =>
  [...GUESSES, "boardMember" as const].filter((f) => row[f] !== mole[f]);
/** A row that differs from the mole's in exactly the guesses named (the member only when it is named). */
const rowDiffering = (mole: EvidenceCombination, ...fields: readonly string[]): EvidenceCombination =>
  GRID.find((row) => {
    const d = differing(row, mole);
    return d.length === fields.length && fields.every((f) => d.includes(f as (typeof d)[number]));
  })!;
const threatPlacedAfterStage3 = (sim: Sim): number => {
  const start = sim.events.findIndex((e) => e.type === "mainSchemeAdvanced" && e.stageIndex === 2);
  expect(start).toBeGreaterThanOrEqual(0);
  const main = sim.state.mainScheme.instanceId;
  // Only the stage's own When Revealed: up to the villain phase's next step (its acceleration comes after).
  const stop = sim.events.findIndex((e, i) => i > start && e.type === "stepChanged");
  return sim.events
    .slice(start, stop < 0 ? undefined : stop)
    .filter((e): e is Extract<GameEvent, { type: "threatPlaced" }> => e.type === "threatPlaced")
    .filter((e) => e.schemeInstanceId === main)
    .reduce((sum, e) => sum + e.amount, 0);
};
const stage = (s: GameState): number => s.mainScheme.stageIndex + 1;

describe("registry", () => {
  it("registers the fourteen refs of the frame, each a valid definition", () => {
    expect(
      Object.keys(BARON_ZEMO)
        .filter((id) => /^5016[5-9]/.test(id))
        .sort(),
    ).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(BARON_ZEMO)) expect(validateDefinition(def), id).toEqual([]);
  });

  it("the four -constant refs of The Accusation 2B are empty: the steps are 2B's When Revealed", () => {
    for (const suffix of ["", "-2", "-3", "-4"]) {
      expect(BARON_ZEMO[`50168b.the-accusation-constant${suffix}`]!.effects).toEqual([]);
    }
  });

  it("skips only the refs that wait on the engine (the encounter cards are tested in baron-zemo-encounter.test.ts)", () => {
    expect(Object.keys(BARON_ZEMO_SKIPPED).sort()).toEqual(
      [
        "50171.reluctant-foe-constant",
        "50171.when-defeated",
        "50171.when-revealed",
        "50173.divided-loyalties-constant",
        "50175.when-revealed",
      ].sort(),
    );
  });

  it("the data names these refs for the villain faces and the main scheme", () => {
    const refs = ["50165a", "50166a", "50167a"].flatMap((code) => abilityRefIds(dataOf(code) as never));
    expect(refs.filter((id) => /^5016[5-9]/.test(id)).sort()).toEqual([...REFS].sort());
  });
});

describe("1A Setup (50167a)", () => {
  it("deals the aim pile (one evidence card of each kind) and the shield pile (the other six), none in the deck", () => {
    const { state } = open();
    expect(aimOf(state)).toHaveLength(3);
    expect(state.hiddenPiles?.["shield"]).toHaveLength(6);
    const kinds = aimOf(state).map((c) => dataOf(c).evidence);
    expect([...kinds].sort()).toEqual(["means", "motive", "opportunity"]);
    const all = Object.values(state.instances).map((i) => i.cardId as string);
    for (let n = 50185; n <= 50193; n++) expect(all).not.toContain(String(n));
  });

  it("puts each Board Member environment into play with 2 secret counters (standard campaign branch not scripted)", () => {
    const { state } = open();
    for (const code of MEMBERS) {
      expect(isAttachment(state, code)).toBe(false);
      expect(secrets(state, code)).toBe(2);
    }
  });

  it("standard mode starts Zemo on 50165a (12 hit points), expert on 50166a (16)", () => {
    const standard = open();
    expect(codeOf(standard.state, villainOf(standard.state))).toBe("50165a");
    expect(maxHitPoints(standard.state, villainOf(standard.state), DEPS)).toBe(12);
    const expert = open([SPIDER_MAN], "expert");
    expect(codeOf(expert.state, villainOf(expert.state))).toBe("50166a");
    expect(maxHitPoints(expert.state, villainOf(expert.state), DEPS)).toBe(16);
  });
});

describe("1B Response (50167b)", () => {
  it("with no environment bare, only the advance is offered; declining changes nothing", () => {
    const sim = open();
    endPlayerPhase(sim, { take: true });
    const labels = sim.asked.filter((a) => a.kind === "chooseOption").flatMap((a) => a.labels);
    expect(labels.some((l) => l.startsWith("Place 2 secret counters"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Advance to stage 2A"))).toBe(true);
    expect(stage(sim.state)).toBe(1);
    for (const code of MEMBERS) expect(secrets(sim.state, code)).toBe(2);
    expect(sim.state.revealedPileCards?.["shield"] ?? []).toHaveLength(0);
  });

  it("with an environment bare: 2 secret counters on it gain 2 evidence cards, which cross out their rows", () => {
    const sim = open();
    sim.state = withSecrets(sim.state, { [SURVEILLANCE]: 0 });
    endPlayerPhase(sim, { take: true, gain: true });
    expect(secrets(sim.state, SURVEILLANCE)).toBe(2);
    expect(sim.state.hiddenPiles?.["shield"]).toHaveLength(4);
    const gained = sim.state.revealedPileCards?.["shield"] ?? [];
    expect(gained).toHaveLength(2);
    const open27 = openEvidenceRows({}, GRID).length;
    const left = openEvidenceRows(sim.state, GRID);
    expect(left.length).toBeLessThan(open27);
    for (const row of left) for (const g of GUESSES) expect(gained).not.toContain(row[g]);
    expect(stage(sim.state)).toBe(1);
  });

  it("declining the gain places nothing and gains nothing", () => {
    const sim = open();
    sim.state = withSecrets(sim.state, { [SURVEILLANCE]: 0 });
    endPlayerPhase(sim, { take: true });
    expect(secrets(sim.state, SURVEILLANCE)).toBe(0);
    expect(sim.state.hiddenPiles?.["shield"]).toHaveLength(6);
  });

  it("Q30: with the shield pile empty the counters may not be placed for nothing", () => {
    const sim = open();
    sim.state = withSecrets(sim.state, { [SURVEILLANCE]: 0 });
    sim.state = { ...sim.state, hiddenPiles: { ...sim.state.hiddenPiles!, shield: [] } };
    endPlayerPhase(sim, { take: true, gain: true });
    const labels = sim.asked.filter((a) => a.kind === "chooseOption").flatMap((a) => a.labels);
    expect(labels.some((l) => l.startsWith("Place 2 secret counters"))).toBe(false);
    expect(secrets(sim.state, SURVEILLANCE)).toBe(0);
  });

  it("is not offered to be taken when the first player does not take it: the phase just ends", () => {
    const sim = open();
    endPlayerPhase(sim, {});
    expect(stage(sim.state)).toBe(1);
    expect(sim.asked.filter((a) => a.kind === "chooseOption")).toEqual([]);
  });
});

describe("2A and 2B: The Accusation (50168a, 50168b)", () => {
  it("a correct accusation places no counters, advances to 3A and 3B flips the mole with its counters", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    const mole = moleCode(sim.state);
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state), zemo: "Give" });
    expect(stage(sim.state)).toBe(3);
    expect(sim.state.accusation?.wrong).toEqual([]);
    // The A.I.M. pile is faceup now.
    expect(sim.state.revealedPileCards?.["aim"]).toHaveLength(3);
    expect(isAttachment(sim.state, mole)).toBe(true);
    expect(inst(sim.state, memberOf(sim.state, mole)).attachedTo).toBe(villainOf(sim.state));
    expect(secrets(sim.state, mole)).toBe(2);
    for (const code of MEMBERS.filter((c) => c !== mole)) {
      expect(isAttachment(sim.state, code)).toBe(false);
      expect(secrets(sim.state, code)).toBe(2);
    }
    // 1[per_hero] for each of the 2 secret counters on the mole's attachment: 2 players -> 4.
    expect(threatPlacedAfterStage3(sim)).toBe(4);
  });

  it("3A flips Zemo to his Unmasked face at 18 hit points per player and attaches the Sword found in the deck", () => {
    const sim = open([SPIDER_MAN, IRON_MAN]);
    const zemo = villainOf(sim.state);
    sim.state = withDamage(sim.state, zemo, 5);
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    expect(sim.state.villains[0]!.side).toBe("B");
    expect(sim.state.villains[0]!.instanceId).toBe(zemo);
    expect(maxHitPoints(sim.state, zemo, DEPS)).toBe(36);
    expect(remainingHitPoints(sim.state, zemo, DEPS)).toBe(36);
    const sword = sim.state.instances[zemo]!.attachments.find((a) => codeOf(sim.state, a) === SWORD);
    expect(sword).toBeDefined();
  });

  it("expert: 50166a flips to his Steady face at 18 per player", () => {
    const sim = open([SPIDER_MAN], "expert");
    const zemo = villainOf(sim.state);
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    expect(codeOf(sim.state, zemo)).toBe("50166a");
    expect(sim.state.villains[0]!.side).toBe("B");
    expect(maxHitPoints(sim.state, zemo, DEPS)).toBe(18);
    expect(hasKeyword(sim.state, zemo, "steady", DEPS)).toBe(true);
  });

  it("one wrong card, right member: 1 secret counter on each of the three, and the flipped mole carries 3", () => {
    const sim = open();
    const mole = moleRow(sim.state);
    endPlayerPhase(sim, { take: true, advance: true, accuse: rowDiffering(mole, "means"), zemo: "Give" });
    expect(sim.state.accusation?.wrong).toEqual(["means"]);
    for (const code of MEMBERS) expect(secrets(sim.state, code)).toBe(3);
    expect(isAttachment(sim.state, mole.boardMember as string)).toBe(true);
    expect(MEMBERS.filter((c) => isAttachment(sim.state, c))).toEqual([mole.boardMember]);
    expect(threatPlacedAfterStage3(sim)).toBe(3);
  });

  it("the wrong member: 1 counter per wrong guess on each, and 3 more on the accused (which flips and keeps them)", () => {
    const sim = open();
    const mole = moleRow(sim.state);
    const row = GRID.find((r) => {
      const d = differing(r, mole);
      return d.length === 2 && d.includes("boardMember");
    })!;
    const accused = row.boardMember as string;
    const [third] = MEMBERS.filter((c) => c !== accused && c !== mole.boardMember);
    // Every member starts bare so the numbers read: +2 for the two wrong guesses, +3 more on the accused.
    sim.state = withSecrets(sim.state, { [MEDICAL]: 0, [SURVEILLANCE]: 0, [TACTICAL]: 0 });
    endPlayerPhase(sim, { take: true, advance: true, accuse: row, zemo: "Give" });
    expect(sim.state.accusation?.wrong).toEqual(differing(row, mole));
    expect(accused).not.toBe(mole.boardMember);
    expect(secrets(sim.state, accused)).toBe(5);
    expect(isAttachment(sim.state, accused)).toBe(true);
    expect(secrets(sim.state, mole.boardMember as string)).toBe(2);
    expect(third === undefined || secrets(sim.state, third) === 2).toBe(true);
  });

  it("everything wrong in standard mode: 4 on each flips all three and the players lose", () => {
    const sim = open();
    const mole = moleRow(sim.state);
    endPlayerPhase(sim, {
      take: true,
      advance: true,
      accuse: rowDiffering(mole, "means", "motive", "opportunity", "boardMember"),
    });
    expect(sim.state.accusation?.wrong).toHaveLength(4);
    expect(MEMBERS.every((c) => isAttachment(sim.state, c))).toBe(true);
    expect(sim.state.outcome?.result).toBe("loss");
  });

  it("3B on a mole the penalties already flipped leaves it an attachment and counts its counters", () => {
    const sim = open();
    const mole = moleRow(sim.state);
    const code = mole.boardMember as string;
    const others = MEMBERS.filter((c) => c !== code);
    sim.state = withSecrets(sim.state, { [code]: 3, [others[0]!]: 0, [others[1]!]: 0 });
    endPlayerPhase(sim, { take: true, advance: true, accuse: rowDiffering(mole, "motive"), zemo: "Give" });
    expect(sim.state.accusation?.wrong).toEqual(["motive"]);
    // 3 + 1 = 4: flipped by 2B's penalty; 3B finds no environment mole, so nothing flips back.
    expect(isAttachment(sim.state, code)).toBe(true);
    expect(codeOf(sim.state, memberOf(sim.state, code))).toBe(`${code.slice(0, -1)}b`);
    expect(inst(sim.state, memberOf(sim.state, code)).attachedTo).toBe(villainOf(sim.state));
    expect(secrets(sim.state, code)).toBe(4);
    for (const other of others) expect(secrets(sim.state, other)).toBe(1);
    expect(threatPlacedAfterStage3(sim)).toBe(4);
  });
});

describe("the villain's Forced Interrupts (50165a, 50165b, 50166b)", () => {
  it("50165a: when he would be defeated his hit points reset to 12 and 3 secret counters leave the environments", () => {
    const sim = open();
    const zemo = villainOf(sim.state);
    sim.state = withDamage(sim.state, zemo, 11);
    const total = () => MEMBERS.reduce((sum, c) => sum + secrets(sim.state, c), 0);
    expect(total()).toBe(6);
    const result = heroAttacks(DEPS, sim.state, zemo);
    sim.state = result.state;
    expect(sim.state.villains[0]!.defeated).toBe(false);
    expect(remainingHitPoints(sim.state, zemo, DEPS)).toBe(12);
    expect(total()).toBe(3);
  });

  it("50166a: the same reset to 16", () => {
    const sim = open([SPIDER_MAN], "expert");
    const zemo = villainOf(sim.state);
    sim.state = withDamage(sim.state, zemo, 15);
    const result = heroAttacks(DEPS, sim.state, zemo);
    expect(remainingHitPoints(result.state, zemo, DEPS)).toBe(16);
    expect(MEMBERS.reduce((sum, c) => sum + secrets(result.state, c), 0)).toBe(3);
  });

  it("50165b: each activation against a player is a choice of 1 secret counter on a Board Member card or an extra boost card", () => {
    const sim = open();
    const mole = moleCode(sim.state);
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    expect(atZemoInterrupt(sim.state)).toBe(true);
    const choice = sim.state.pendingChoice!;
    expect(choice.options.map((o) => o.label)).toEqual([
      "Place 1 secret counter on a Board Member card",
      "Give Baron Zemo an additional boost card for this activation",
    ]);
    // The counter goes on a Board Member card of either face: the mole's attachment, or an environment.
    const place = applyOk(
      sim.state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: [choice.options[0]!.optionId],
      },
      DEPS,
    );
    const target = place.state.pendingChoice!;
    expect(target.prompt.kind).toBe("chooseTarget");
    expect(target.options).toHaveLength(3);
    const moleCard = memberOf(sim.state, mole);
    const after = applyOk(
      place.state,
      {
        type: "resolveChoice",
        playerId: target.playerId,
        choiceId: target.choiceId,
        selectedOptionIds: [
          target.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === moleCard)!.optionId,
        ],
      },
      DEPS,
    );
    expect(inst(after.state, moleCard).counters["secret"]).toBe(3);
  });

  it("50165b: choosing the boost gives him an additional boost card for the activation", () => {
    const sim = open();
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    const before = sim.events.length;
    const choice = sim.state.pendingChoice!;
    let state = applyOk(
      sim.state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: [choice.options[1]!.optionId],
      },
      DEPS,
    );
    sim.events.push(...state.events);
    let current = state.state;
    for (let guard = 0; current.pendingChoice && !current.outcome && guard < 50; guard++) {
      const c = current.pendingChoice;
      state = applyOk(
        current,
        { type: "resolveChoice", playerId: c.playerId, choiceId: c.choiceId, selectedOptionIds: firstLegal(current) },
        DEPS,
      );
      sim.events.push(...state.events);
      current = state.state;
    }
    const boosts = sim.events.slice(before).filter((e) => e.type === "boostCardFlipped");
    expect(boosts.length).toBeGreaterThanOrEqual(2);
  });

  it("50166b: the expert Unmasked face offers 2 secret counters", () => {
    const sim = open([SPIDER_MAN], "expert");
    endPlayerPhase(sim, { take: true, advance: true, accuse: moleRow(sim.state) });
    expect(sim.state.pendingChoice?.options.map((o) => o.label)).toEqual([
      "Place 2 secret counters on a Board Member card",
      "Give Baron Zemo an additional boost card for this activation",
    ]);
  });
});
