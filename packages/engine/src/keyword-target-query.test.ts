/**
 * `TargetQuery.withKeyword` / `withoutKeyword` / `anyOf`, built for Vivian (`ironheart` 29024): "choose an attachment,
 * non-Elite minion, or non-permanent side scheme". A keyword clause reads keywords the way the engine reads them
 * elsewhere: printed less a blank (RRG 1.8 "Blank", p. 10), plus granted (RRG 1.8 "Gains", p. 21); Permanent as
 * `isPermanent` reads it (printed even through a blank, docs/phase7-wave4.md §4 Q25; granted counts,
 * docs/phase7-wave5.md §4.1 Q45).
 */
import { trait, type AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { hasKeyword } from "./keywords.js";
import { explainQuery, matchesQuery, type EffectContext } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubMinion, stubSideScheme, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playFree,
} from "./testing/wave3.js";

const ELITE = trait("ELITE");
const PERMANENT = [{ name: "permanent" }] as const;
const constantOf = (trigger: Omit<Extract<AbilityDefinition["trigger"], { kind: "constant" }>, "kind">) =>
  ({ trigger: { kind: "constant", ...trigger }, effects: [] }) satisfies AbilityDefinition;

const GUARD_MINION = stubMinion({ id: "guard-minion", atk: 1, sch: 1, hp: 3, keywords: [{ name: "guard" }] });
const PLAIN_MINION = stubMinion({ id: "plain-minion", atk: 1, sch: 1, hp: 3 });
const ELITE_MINION = stubMinion({ id: "elite-minion", atk: 1, sch: 1, hp: 3, traits: [ELITE] });
const PLAIN_SCHEME = stubSideScheme({ id: "plain-scheme", encounterSetIds: ["other"], startingThreat: 3 });
const OTHER_SCHEME = stubSideScheme({ id: "other-scheme", encounterSetIds: ["other"], startingThreat: 3 });
/** Permanent, in the "thieves" set. */
const PERMANENT_SCHEME = stubSideScheme({
  id: "permanent-scheme",
  encounterSetIds: ["thieves"],
  startingThreat: 3,
  keywords: PERMANENT,
});
/** A constant blank on each side scheme, in the "thieves" set, so it reaches PERMANENT_SCHEME (same set). */
const SCHEME_BLANK_RULE = stubAbility(
  "scheme-blank.constant",
  constantOf({ rules: [{ kind: "blankTextBox", target: { categories: ["sideScheme"] } }] }),
);
const SCHEME_BLANK = stubSideScheme({
  id: "scheme-blank",
  encounterSetIds: ["thieves"],
  startingThreat: 3,
  abilities: [SCHEME_BLANK_RULE.ref],
});
/** An attachment (encounter), attached to the villain in `start`. */
const GEAR = stubAttachment({ id: "gear" });
/** A constant "the plain side scheme gains permanent" on a side scheme. */
const GRANT_PERMANENT_RULE = stubAbility(
  "grant-permanent.constant",
  constantOf({ keywordGrants: [{ keyword: { name: "permanent" }, target: { name: "plain-scheme" } }] }),
);
const GRANTER = stubSideScheme({
  id: "granter",
  encounterSetIds: ["other"],
  startingThreat: 3,
  abilities: [GRANT_PERMANENT_RULE.ref],
});
/** "Each minion without guard gains guard": a grant whose own target asks about keywords (the re-entrancy cut). */
const GUARD_FOR_UNGUARDED_RULE = stubAbility(
  "guard-for-unguarded.constant",
  constantOf({
    keywordGrants: [{ keyword: { name: "guard" }, target: { categories: ["minion"], withoutKeyword: "guard" } }],
  }),
);
const GUARD_GRANTER = stubSideScheme({
  id: "guard-granter",
  encounterSetIds: ["other"],
  startingThreat: 3,
  abilities: [GUARD_FOR_UNGUARDED_RULE.ref],
});
/** "Until the end of the round, each side scheme gains permanent" (a lasting grant). */
const GRANT_UNTIL_ABILITY = stubAbility("grant-until.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "grantKeywordUntil",
      keyword: { name: "permanent" },
      affects: { categories: ["sideScheme"] },
      until: "endOfRound",
    },
  ],
});
const GRANT_UNTIL = stubEvent({ id: "grant-until", cost: 0, abilities: [GRANT_UNTIL_ABILITY.ref] });
/** "Until the end of the phase, treat each minion's printed text box as if it were blank" (a basic event). */
const BLANK_MINIONS_ABILITY = stubAbility("blank-minions.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "blankTextBox", target: { kind: "each", query: { categories: ["minion"] } }, until: "endOfPhase" }],
});
const BLANK_MINIONS = stubEvent({ id: "blank-minions", cost: 0, abilities: [BLANK_MINIONS_ABILITY.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(
  SCHEME_BLANK_RULE,
  GRANT_PERMANENT_RULE,
  GUARD_FOR_UNGUARDED_RULE,
  GRANT_UNTIL_ABILITY,
  BLANK_MINIONS_ABILITY,
);
const CARDS: readonly AnyCard[] = [
  GUARD_MINION,
  PLAIN_MINION,
  ELITE_MINION,
  PLAIN_SCHEME,
  OTHER_SCHEME,
  PERMANENT_SCHEME,
  SCHEME_BLANK,
  GEAR,
  GRANTER,
  GUARD_GRANTER,
  GRANT_UNTIL,
  BLANK_MINIONS,
  FILLER,
];

interface Board {
  readonly state: GameState;
  readonly guard: InstanceId;
  readonly plain: InstanceId;
  readonly elite: InstanceId;
  readonly plainScheme: InstanceId;
  readonly otherScheme: InstanceId;
  readonly permanentScheme: InstanceId;
  readonly gear: InstanceId;
}

function start(): Board {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [GRANT_UNTIL.id, BLANK_MINIONS.id],
    encounter: [
      GUARD_MINION.id,
      PLAIN_MINION.id,
      ELITE_MINION.id,
      PLAIN_SCHEME.id,
      OTHER_SCHEME.id,
      PERMANENT_SCHEME.id,
      SCHEME_BLANK.id,
      GEAR.id,
      GRANTER.id,
      GUARD_GRANTER.id,
      ...copiesOf(FILLER.id, 20),
    ],
  });
  const guard = minionEngagedWith(state, GUARD_MINION.id);
  const plain = minionEngagedWith(guard.state, PLAIN_MINION.id);
  const elite = minionEngagedWith(plain.state, ELITE_MINION.id);
  const plainScheme = encounterCardInVillainArea(elite.state, PLAIN_SCHEME.id, 3);
  const otherScheme = encounterCardInVillainArea(plainScheme.state, OTHER_SCHEME.id, 3);
  const permanentScheme = encounterCardInVillainArea(otherScheme.state, PERMANENT_SCHEME.id, 3);
  const gear = encounterCardInVillainArea(permanentScheme.state, GEAR.id, 0);
  const villain = gear.state.activeVillainId;
  state = {
    ...gear.state,
    villainArea: gear.state.villainArea.filter((id) => id !== gear.id),
    instances: {
      ...gear.state.instances,
      [gear.id]: { ...gear.state.instances[gear.id]!, attachedTo: villain },
      [villain]: {
        ...gear.state.instances[villain]!,
        attachments: [...gear.state.instances[villain]!.attachments, gear.id],
      },
    },
  };
  return {
    state,
    guard: guard.id,
    plain: plain.id,
    elite: elite.id,
    plainScheme: plainScheme.id,
    otherScheme: otherScheme.id,
    permanentScheme: permanentScheme.id,
    gear: gear.id,
  };
}

const context: EffectContext = { selfInstanceId: null, controllerId: P1, event: null, bindings: {}, deps };
const nonPermanentScheme: TargetQuery = { categories: ["sideScheme"], withoutKeyword: "permanent" };

describe("TargetQuery.withKeyword / withoutKeyword", () => {
  it("reads a printed keyword, reporting which clause said no", () => {
    const { state, guard, plain } = start();
    expect(matchesQuery(state, guard, { categories: ["minion"], withKeyword: "guard" }, context)).toBe(true);
    expect(explainQuery(state, plain, { categories: ["minion"], withKeyword: "guard" }, context)).toBe(
      "missingKeyword",
    );
    expect(matchesQuery(state, plain, { categories: ["minion"], withoutKeyword: "guard" }, context)).toBe(true);
    expect(explainQuery(state, guard, { categories: ["minion"], withoutKeyword: "guard" }, context)).toBe(
      "hasExcludedKeyword",
    );
  });

  it("a blanked text box has no printed keyword (RRG 1.8 'Blank', p. 10)", () => {
    const board = start();
    const { state } = playFree(board.state, deps, BLANK_MINIONS.id);
    expect(hasKeyword(state, board.guard, "guard", deps)).toBe(false);
    expect(matchesQuery(state, board.guard, { categories: ["minion"], withKeyword: "guard" }, context)).toBe(false);
    expect(matchesQuery(state, board.guard, { categories: ["minion"], withoutKeyword: "guard" }, context)).toBe(true);
  });

  it("excludes a printed-permanent side scheme and keeps a plain one", () => {
    const { state, plainScheme, permanentScheme } = start();
    expect(matchesQuery(state, plainScheme, nonPermanentScheme, context)).toBe(true);
    expect(explainQuery(state, permanentScheme, nonPermanentScheme, context)).toBe("hasExcludedKeyword");
  });

  it("a permanent side scheme blanked by its own set's rule still counts as permanent (§4 Q25, as isPermanent)", () => {
    const board = start();
    const { state } = encounterCardInVillainArea(board.state, SCHEME_BLANK.id, 3);
    // The blank reaches it (same set), so its printed keyword is gone from `hasKeyword` …
    expect(hasKeyword(state, board.permanentScheme, "permanent", deps)).toBe(false);
    // … but it is still a permanent card.
    expect(matchesQuery(state, board.permanentScheme, nonPermanentScheme, context)).toBe(false);
    expect(matchesQuery(state, board.permanentScheme, { withKeyword: "permanent" }, context)).toBe(true);
  });

  it("a Permanent granted by a constant rule counts (§4.1 Q45)", () => {
    const board = start();
    expect(matchesQuery(board.state, board.plainScheme, nonPermanentScheme, context)).toBe(true);
    const { state } = encounterCardInVillainArea(board.state, GRANTER.id, 3);
    expect(explainQuery(state, board.plainScheme, nonPermanentScheme, context)).toBe("hasExcludedKeyword");
    expect(matchesQuery(state, board.otherScheme, nonPermanentScheme, context)).toBe(true);
  });

  it("a Permanent granted by a lasting effect counts (§4.1 Q45)", () => {
    const board = start();
    const { state } = playFree(board.state, deps, GRANT_UNTIL.id);
    expect(matchesQuery(state, board.plainScheme, nonPermanentScheme, context)).toBe(false);
    expect(matchesQuery(state, board.otherScheme, nonPermanentScheme, context)).toBe(false);
  });

  it("a keyword grant whose own target asks about keywords reads printed keywords only, and terminates", () => {
    const board = start();
    const { state } = encounterCardInVillainArea(board.state, GUARD_GRANTER.id, 3);
    // "Each minion without guard gains guard": the plain minion lacks printed guard, so it gains it.
    expect(hasKeyword(state, board.plain, "guard", deps)).toBe(true);
    expect(matchesQuery(state, board.plain, { categories: ["minion"], withKeyword: "guard" }, context)).toBe(true);
    expect(matchesQuery(state, board.guard, { categories: ["minion"], withKeyword: "guard" }, context)).toBe(true);
  });
});

describe("TargetQuery.anyOf", () => {
  const vivian: TargetQuery = {
    anyOf: [
      { categories: ["attachment"] },
      { categories: ["minion"], withoutTrait: ELITE },
      { categories: ["sideScheme"], withoutKeyword: "permanent" },
    ],
  };

  it("matches a card any alternative matches, with each alternative's own filters", () => {
    const { state, gear, plain, guard, elite, plainScheme, permanentScheme } = start();
    expect(matchesQuery(state, gear, vivian, context)).toBe(true);
    expect(matchesQuery(state, plain, vivian, context)).toBe(true);
    expect(matchesQuery(state, guard, vivian, context)).toBe(true);
    expect(matchesQuery(state, plainScheme, vivian, context)).toBe(true);
    expect(explainQuery(state, elite, vivian, context)).toBe("matchesNoAlternative");
    expect(explainQuery(state, permanentScheme, vivian, context)).toBe("matchesNoAlternative");
    expect(explainQuery(state, state.activeVillainId, vivian, context)).toBe("matchesNoAlternative");
  });

  it("is ANDed with the query's other fields, and an empty list matches nothing", () => {
    const { state, gear, plain } = start();
    expect(matchesQuery(state, gear, { ...vivian, categories: ["minion"] }, context)).toBe(false);
    expect(matchesQuery(state, plain, { ...vivian, categories: ["minion"] }, context)).toBe(true);
    expect(matchesQuery(state, plain, { anyOf: [] }, context)).toBe(false);
  });
});
