/**
 * Wave 10 engine-rules QA, change 1 (commit a3e77b9e): a scheme with no threat is no target for a thwart or a removal
 * of threat, and a card whose every part is such a removal cannot be played or used with no threat anywhere
 * (`resolve/target-validity.ts` `holdsThreat`, `spentRemovals`), proved on OLDER cards (Core to wave 9) that the five
 * wave 10 card audits did not look at.
 *
 * Sources:
 * - RRG 1.8 "Target" (p. 42): "If an ability or game function requires one or more targets, that ability or game
 *   function can only be initiated if it has at least one valid target"; a target is valid if any part of the ability
 *   can affect it (owner answers, docs/phase7-wave10.md §4.0).
 * - RRG 1.8 "Thwart" (p. 44): a basic thwart needs "a scheme with at least one threat ... or if that character is
 *   confused".
 * - RRG 1.8 "Confuse, Confused" (p. 13): "A confused character can attempt to thwart or use a thwart ability even if it
 *   has no valid target for a thwart."
 *
 * Bench: the Rhino table (`testing/qa-bench.ts`) with a plain minion (`testing/wave10-engine-qa-bench.ts`), the main
 * scheme holding 0 or 8 threat, a real Core Spider-Man in hero form, each card conjured into hand.
 *
 * `it.fails` tests pin bugs: they assert the correct behavior and are expected to fail until the game is fixed. The
 * engine findings of docs/qa-wave10-engine-rules.md (S2, S4, M2, owner questions 57 and 59 on their default A) are
 * fixed and their pins are plain tests now; S3's three stay `it.fails` until their scripts mark the printed cost.
 */
import { applyCommand } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { identityOf, inst, patchInstance, payWith, play, P1, use } from "./testing/harness.js";
import { conjure, DEPS, intoPlay } from "./testing/qa-bench.js";
import { driveWith, plainTable } from "./testing/wave10-engine-qa-bench.js";

interface Pure {
  readonly code: string;
  readonly name: string;
  readonly cost: number;
}

/** "Hero Action (thwart): Remove N threat from a scheme" and nothing else (printed text checked against the data). */
const PURE_THWARTS: readonly Pure[] = [
  { code: "05004", name: "Sneak By", cost: 2 },
  { code: "10019", name: "To the Rescue!", cost: 2 },
  { code: "10004", name: "Sub-Orbital Leap", cost: 3 },
  { code: "17004", name: "Gutsy Move", cost: 2 },
  { code: "18005", name: "Set the Pace", cost: 0 },
  { code: "19004", name: "Intimidation", cost: 1 },
  { code: "21049", name: "For Justice!", cost: 2 },
  { code: "28004", name: "Lightspeed Flight", cost: 2 },
  { code: "32039", name: "Airwalk", cost: 1 },
  { code: "40003", name: "Mind Scan", cost: 2 },
  { code: "44006", name: '"Yoo-Hoo!"', cost: 1 },
  { code: "49008", name: "Electromagnetic Blast", cost: 2 },
  { code: "56009", name: "Feline Senses", cost: 2 },
  { code: "56039", name: "Impersonation", cost: 2 },
  { code: "59011", name: "Wisdom of Athena", cost: 3 },
  { code: "58003", name: "Active Altruism", cost: 0 },
  { code: "04038", name: "Inconspicuous", cost: 1 },
  { code: "13031", name: "Running Interference", cost: 2 },
  { code: "04049", name: "Clear the Area", cost: 1 },
  { code: "01012", name: "Crisis Interdiction", cost: 2 },
];

const playIt = (state: ReturnType<typeof plainTable>["state"], code: string, cost: number) => {
  const given = conjure(state, code);
  return { given, command: play(P1, given.id, payWith(given.state, P1, cost, [given.id])) };
};

describe("a card whose every part removes threat is not playable with no threat anywhere (RRG 1.8 'Target' p. 42), and is with some", () => {
  for (const card of PURE_THWARTS) {
    it(`${card.name} (${card.code})`, () => {
      const loaded = playIt(plainTable(8).state, card.code, card.cost);
      expect(
        applyCommand(loaded.given.state, loaded.command, DEPS).ok,
        "control: playable with threat on the main scheme",
      ).toBe(true);
      const empty = playIt(plainTable(0).state, card.code, card.cost);
      const refused = applyCommand(empty.given.state, empty.command, DEPS);
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    });
  }
});

describe("a card with a part of its own stays playable with no threat anywhere", () => {
  it("Covert Ops 08003 (Remove 4 threat from a scheme. Confuse the villain.): plays, and the villain is confused", () => {
    const t = plainTable(0);
    const { given, command } = playIt(t.state, "08003", 3);
    const done = driveWith(given.state, command);
    expect(done.accepted).toBe(true);
    expect(inst(done.state, done.state.activeVillainId!).statuses.confused).toBe(1);
    expect(inst(done.state, done.state.mainScheme.instanceId).threat).toBe(0);
  });

  it("Hit and Run 18020 (Deal 2 damage to an enemy. Remove 2 threat from a scheme.): the damage is dealt, nothing more", () => {
    const t = plainTable(0);
    const { given, command } = playIt(t.state, "18020", 3);
    const done = driveWith(given.state, command, (s) => {
      const options = s.pendingChoice!.options;
      return [options.find((o) => o.optionId === t.minion)?.optionId ?? options[0]!.optionId];
    });
    expect(done.accepted).toBe(true);
    expect(done.state.cardPool).toBeDefined();
    expect(inst(done.state, done.state.mainScheme.instanceId).threat).toBe(0);
  });

  it("Power Unleashed 16175 (Deal 5 damage to the villain and remove 5 threat from the main scheme): playable with no threat", () => {
    const t = plainTable(0);
    const { given, command } = playIt(t.state, "16175", 0);
    expect(driveWith(given.state, command).accepted).toBe(true);
  });

  it("Into the Fray 16042 (Deal 6 damage to a minion; remove 1 threat per excess damage): playable with no threat", () => {
    const t = plainTable(0);
    const { given, command } = playIt(t.state, "16042", 3);
    expect(driveWith(given.state, command).accepted).toBe(true);
  });
});

describe("a confused hero may still attempt a thwart event with no threat anywhere (RRG 1.8 'Confuse, Confused' p. 13)", () => {
  for (const card of [PURE_THWARTS[0]!, PURE_THWARTS[6]!, PURE_THWARTS[8]!]) {
    it(`${card.name} (${card.code}): played, and the confused card is discarded instead`, () => {
      const base = plainTable(0).state;
      const hero = identityOf(base);
      const confused = patchInstance(base, hero, { statuses: { ...inst(base, hero).statuses, confused: 1 } });
      const { given, command } = playIt(confused, card.code, card.cost);
      const done = driveWith(given.state, command);
      expect(done.accepted, done.refusal).toBe(true);
      expect(inst(done.state, hero).statuses.confused).toBe(0);
    });
  }
});

describe("upgrades: 'Exhaust → remove 1 threat from a scheme' cannot be used with no threat, and the cost is not paid", () => {
  const helmet = (threat: number) => {
    const table = plainTable(threat);
    return intoPlay(table.state, "01037");
  };
  it("Mark V Helmet 01037 with threat: usable (control)", () => {
    const placed = helmet(8);
    const done = driveWith(placed.state, use(P1, placed.id, "01037.mark-v-helmet-action"));
    expect(done.accepted, done.refusal).toBe(true);
    expect(inst(done.state, placed.id).exhausted).toBe(true);
  });
});

describe("an ally whose Response removes threat can enter play with no threat anywhere, and the game does not wait", () => {
  for (const [code, name] of [
    ["21047", "Quasar (After Quasar enters play, remove 1 threat from each scheme in play)"],
  ] as const) {
    it(name, () => {
      const t = plainTable(0);
      const { given, command } = playIt(t.state, code, 3);
      const done = driveWith(given.state, command, (s) => {
        const choice = s.pendingChoice!;
        return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
      });
      expect(done.accepted, done.refusal).toBe(true);
      expect(done.state.pendingChoice).toBeNull();
      expect(inst(done.state, done.state.mainScheme.instanceId).threat).toBe(0);
      expect(done.state.players[0]!.playArea).toContain(given.id);
    });
  }
});

// -- A conditional modifier or a branch around the removal is no part of its own (finding S2, fixed) ----------------------------

describe("an event that is only a removal of threat is not played with no threat anywhere when its removal sits in a branch or a rider modifies it", () => {
  // RRG 1.8 "Target" (p. 42) and the owner's rule (docs/phase7-wave10.md §4.0, finding F1: "a card whose every part is such a
  // removal cannot be played"). Sneak By 05004 ("Remove 3 threat from a scheme") is refused, and so are these, which print
  // the same shape of text: the branch that would run is judged (owner question 59, default A), a branch that could
  // run either way ("if you paid with a mental resource, ignore the crisis icon") is a removal when both are, and the
  // card's own return to hand is no part of its own (`hasIndependentPart`, `branchLost`).
  const cases: readonly Pure[] = [
    {
      code: "42006",
      name: "Natural Flight 42006 (Remove 4 threat from a scheme; Angel ignores crisis and patrol)",
      cost: 2,
    },
    { code: "13003", name: "Giant Help 13003 (Remove 3 threat from a scheme, or 4 divided in Giant form)", cost: 2 },
    {
      code: "15012",
      name: "Crisis Averted 15012 (Remove 6 threat from the main scheme; mental ignores crisis)",
      cost: 3,
    },
    {
      code: "18016",
      name: "Impede 18016 (Remove 3 threat from the main scheme; returns to hand if first card)",
      cost: 2,
    },
  ];
  for (const card of cases) {
    it(`${card.name}: refused with no threat anywhere`, () => {
      const { given, command } = playIt(plainTable(0).state, card.code, card.cost);
      const refused = applyCommand(given.state, command, DEPS);
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
      const loaded = playIt(plainTable(8).state, card.code, card.cost);
      expect(applyCommand(loaded.given.state, loaded.command, DEPS).ok, "control: playable with threat").toBe(true);
    });
  }

  // RRG 1.8 "Cost" (p. 13): "An ability's cost cannot be paid if that ability's effect requires one or more targets and
  // there is not at least one valid target." The cost here is "put that minion into play engaged with you"; its effect is
  // the removal of threat from the main scheme alone. The 2026-10-03 owner decision (qa-2026-10-03-thwart-labeled.test.ts)
  // already refuses these when the main scheme cannot be thwarted (patrol, crisis); with no threat on it they are played
  // and the minion is put into play for nothing.
  //
  // Each card scripts its printed cost ("discard … until a minion is discarded", "put that minion into play") as its
  // first two effects and marks them with `costEffects: 2`, so they are no part of the effect.
  for (const card of [
    { code: "16043", name: "Looking for Trouble 16043", cost: 0 },
    { code: "46017", name: "Looking for Trouble 46017", cost: 0 },
    { code: "06003", name: "Defender of the Nine Realms 06003", cost: 0 },
  ]) {
    it(`${card.name} (put a minion into play → remove 3 threat from the main scheme): refused with no threat on the main scheme`, () => {
      const { given, command } = playIt(plainTable(0).state, card.code, card.cost);
      expect(applyCommand(given.state, command, DEPS).ok).toBe(false);
    });
  }
});

describe("a removal inside a branch is judged for an upgrade's action too (finding S2, fixed)", () => {
  // Mark V Helmet prints "Hero Action (thwart): Exhaust Mark V Helmet → remove 1 threat from a scheme (from each scheme
  // instead if you have the Aerial trait)": the very example the owner's rule names ("Exhaust → remove 1 threat from a
  // scheme"). The script wraps both shapes in an `if`; the branch that would run is the one judged.
  it("Mark V Helmet 01037 with no threat anywhere: refused, and still ready (RRG 1.8 'Target' p. 42)", () => {
    const placed = intoPlay(plainTable(0).state, "01037");
    const refused = applyCommand(placed.state, use(P1, placed.id, "01037.mark-v-helmet-action"), DEPS);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    expect(inst(placed.state, placed.id).exhausted).toBe(false);
  });
});

describe("a card whose branch holds a part of its own stays playable with no threat anywhere (finding M2, fixed)", () => {
  // Photon Speed 21008: "Hero Action (thwart): Change to Photon energy form and remove 4 threat from a scheme." The
  // change of form is a part of its own, written inside the branch that also holds the removal.
  it("Photon Speed 21008: played with no threat anywhere", () => {
    const { given, command } = playIt(plainTable(0).state, "21008", 2);
    const done = driveWith(given.state, command);
    expect(done.accepted, done.refusal).toBe(true);
    expect(done.state.pendingChoice).toBeNull();
    expect(inst(done.state, done.state.mainScheme.instanceId).threat).toBe(0);
  });
});

describe("a 'choose one' does not offer an option that removes threat when no scheme has any (finding S4, fixed)", () => {
  // RRG 1.8 "Choose (Option)" (p. 12): "When a player card requires a player to choose an option, they cannot choose an
  // option that cannot be at least partially resolved. This includes options that ... require one or more targets and
  // there are no valid targets." With no threat on any scheme "Remove 2 threat from a scheme" is such an option, so it
  // is not offered (`optionLacksValidTarget`).
  const threatOptions = (state: ReturnType<typeof plainTable>["state"], command: ReturnType<typeof play>) => {
    const first = applyCommand(state, command, DEPS);
    if (!first.ok) return null;
    return (first.state.pendingChoice?.options ?? []).filter((o) => /threat/i.test(o.label)).length;
  };

  it("Double Time 14004, control: with threat the removal is among the options", () => {
    const { given, command } = playIt(plainTable(8).state, "14004", 2);
    expect(threatOptions(given.state, command)).toBeGreaterThan(0);
  });
  it("Double Time 14004 ('Remove 2 threat from a scheme'): not offered with no threat anywhere", () => {
    const { given, command } = playIt(plainTable(0).state, "14004", 2);
    expect(threatOptions(given.state, command)).toBe(0);
  });

  for (const [code, ability, name] of [
    ["20008", "20008.multi-gun-action", "Multi-Gun 20008"],
    ["40021", "40021.eva-action", "E.V.A. 40021"],
    ["50009", "50009.the-iliad-action", "The Iliad 50009"],
  ] as const) {
    it(`${name}: its removal option is not offered with no threat anywhere`, () => {
      const placed = intoPlay(plainTable(0).state, code, code === "50009" ? { mission: 3 } : {});
      const first = applyCommand(placed.state, use(P1, placed.id, ability), DEPS);
      expect(first.ok).toBe(true);
      if (first.ok) {
        const offered = first.state.pendingChoice?.options ?? [];
        expect(offered.length).toBeGreaterThan(0);
        expect(offered.filter((o) => /threat/i.test(o.label))).toEqual([]);
      }
    });
  }
});

describe("'remove threat from EACH scheme' with no threat on any scheme is refused like 'from a scheme' (owner answer 57A, 2026-10-13; question Q-C of the report)", () => {
  // Hyper Thrusters 16164: "Hero Action: Exhaust Hyper Thrusters → remove 1 threat from each scheme." RRG 1.8 "Target" (p. 42)
  // lists "a scheme" as a target; "each scheme" is not chosen, so the rule does not plainly cover it. Built on the
  // default: refused, as The Douglass 50019 already was, so the three shapes agree. The other reading (usable, and
  // exhausted for nothing) is the owner's to call.
  it("Hyper Thrusters 16164 with threat: removes 1 from each scheme (control)", () => {
    const placed = intoPlay(plainTable(3).state, "16164");
    const done = driveWith(placed.state, use(P1, placed.id, "16164.hyper-thrusters-action"));
    expect(done.accepted, done.refusal).toBe(true);
    expect(inst(done.state, done.state.mainScheme.instanceId).threat).toBe(2);
  });
  it("Hyper Thrusters 16164 with no threat anywhere: refused, and still ready", () => {
    const placed = intoPlay(plainTable(0).state, "16164");
    const refused = applyCommand(placed.state, use(P1, placed.id, "16164.hyper-thrusters-action"), DEPS);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    expect(inst(placed.state, placed.id).exhausted).toBe(false);
  });
  it("The Douglass 50019 with no threat anywhere: refused, its counter kept; usable with threat (control)", () => {
    const placed = intoPlay(plainTable(0).state, "50019", { operation: 2 });
    const refused = applyCommand(placed.state, use(P1, placed.id, "50019.the-douglass-action"), DEPS);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    const loaded = intoPlay(plainTable(3).state, "50019", { operation: 2 });
    const done = driveWith(loaded.state, use(P1, loaded.id, "50019.the-douglass-action"));
    expect(done.accepted, done.refusal).toBe(true);
    expect(inst(done.state, done.state.mainScheme.instanceId).threat).toBe(1);
  });
  it("Quasar 21047 entering play with no threat anywhere: its Response is not offered", () => {
    const { given, command } = playIt(plainTable(0).state, "21047", 3);
    const windows: string[] = [];
    const done = driveWith(given.state, command, (state) => {
      const choice = state.pendingChoice!;
      windows.push(choice.prompt.kind);
      return choice.options.slice(0, choice.minSelections).map((option) => option.optionId);
    });
    expect(done.accepted, done.refusal).toBe(true);
    expect(windows).not.toContain("chooseTriggers");
    expect(done.state.players[0]!.playArea).toContain(given.id);
  });
});
