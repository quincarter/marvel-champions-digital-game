/**
 * docs/phase7-wave5.md §4.1 Q73: a card whose text box is blank has no icons while it is blank — no crisis, hazard,
 * acceleration or amplify icon, printed or gained. RRG 1.8 "Blank" (p. 10) does not settle it; FFG's Game Rules
 * Specialist (Alex Werner) on Vivian (`ironheart` 29024): "Vivian would treat any icons on the attachment or side scheme
 * as blank until the end of the round" (FFG email relayed on Reddit, confirmed by the user 2026-09-28).
 *
 * Synthetic cards: side schemes with a hazard, a crisis and an acceleration icon (Breakin' & Takin' / Crowd Control
 * shapes), an attachment printing a hazard icon, an environment printing an amplify icon, a main scheme stage printing
 * a crisis icon, a support granting each side scheme a hazard icon (a `gainsIcon` rule),
 * a side scheme granting itself one (Rule by Force's shape), a permanent side scheme with a hazard icon in its own
 * modular set, and a basic event: "Until the end of the round, treat the printed text box of each side scheme, each
 * attachment and each environment as if it were blank."
 */

import { flat, type AnyCard, type SchemeIcon } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { amplifyIconsInPlay } from "./modifiers.js";
import { mustInstance } from "./query.js";
import { iconsInPlay, iconsOn } from "./rules.js";
import { textBoxBlankFor } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import {
  stubAttachment,
  stubEnvironment,
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
} from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const constantRules = (rules: NonNullable<Extract<AbilityDefinition["trigger"], { kind: "constant" }>["rules"]>) =>
  ({ trigger: { kind: "constant", rules }, effects: [] }) satisfies AbilityDefinition;

const HAZARD = stubSideScheme({ id: "hazard-scheme", startingThreat: 5, icons: ["hazard"] });
const CRISIS = stubSideScheme({ id: "crisis-scheme", startingThreat: 5, icons: ["crisis"] });
const ACCEL = stubSideScheme({ id: "accel-scheme", startingThreat: 5, icons: ["acceleration"] });
const PLAIN_SCHEME = stubSideScheme({ id: "plain-scheme", startingThreat: 5 });
const SELF_GRANT_RULE = stubAbility(
  "self-grant.constant",
  constantRules([{ kind: "gainsIcon", icon: "hazard", target: { categories: ["sideScheme"], self: true } }]),
);
/** "This card gains a hazard icon" (Rule by Force, `ironheart` 29029, less its condition). */
const SELF_GRANT = stubSideScheme({ id: "self-grant-scheme", startingThreat: 5, abilities: [SELF_GRANT_RULE.ref] });
/** Permanent, in a modular set of its own: a basic event's blank does not reach it (RRG 1.8 "Permanent", p. 32). */
const PERMANENT_HAZARD = stubSideScheme({
  id: "permanent-hazard-scheme",
  encounterSetIds: ["elsewhere"],
  startingThreat: 5,
  icons: ["hazard"],
  keywords: [{ name: "permanent" }],
});
const SUIT: AnyCard = { ...stubAttachment({ id: "suit" }), schemeIcons: ["hazard"] as readonly SchemeIcon[] };
/** An environment printing an amplify icon (RRG 1.8 "Amplify Icon", p. 7). */
const AMP: AnyCard = { ...stubEnvironment({ id: "amp" }), amplifyIcons: 1 };
const GRANTER_RULE = stubAbility(
  "granter.constant",
  constantRules([{ kind: "gainsIcon", icon: "hazard", target: { categories: ["sideScheme"] } }]),
);
/** "Each side scheme gains a hazard icon." */
const GRANTER = stubSupport({ id: "granter", cost: 0, abilities: [GRANTER_RULE.ref] });
const BLANK_ABILITY = stubAbility("blank.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "blankTextBox",
      target: { kind: "each", query: { categories: ["sideScheme", "attachment", "environment"] } },
      until: "endOfRound",
    },
  ],
});
const BLANK = stubEvent({ id: "blank", cost: 0, abilities: [BLANK_ABILITY.ref] });
/** A main scheme stage printing a crisis icon, and an event blanking it for the round. */
const CRISIS_MAIN = stubMainScheme({
  id: "crisis-main",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), icons: ["crisis"] }],
});
const BLANK_MAIN_ABILITY = stubAbility("blank-main.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "blankTextBox", target: { kind: "each", query: { categories: ["mainScheme"] } }, until: "endOfRound" },
  ],
});
const BLANK_MAIN = stubEvent({ id: "blank-main", cost: 0, abilities: [BLANK_MAIN_ABILITY.ref] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(SELF_GRANT_RULE, GRANTER_RULE, BLANK_ABILITY, BLANK_MAIN_ABILITY);
const CARDS: readonly AnyCard[] = [
  HAZARD,
  CRISIS,
  ACCEL,
  PLAIN_SCHEME,
  SELF_GRANT,
  PERMANENT_HAZARD,
  SUIT,
  AMP,
  GRANTER,
  BLANK,
  BLANK_MAIN,
  FILLER,
];

const start = (): GameState =>
  gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [GRANTER.id, BLANK.id],
    encounter: [
      HAZARD.id,
      CRISIS.id,
      ACCEL.id,
      PLAIN_SCHEME.id,
      SELF_GRANT.id,
      PERMANENT_HAZARD.id,
      SUIT.id,
      AMP.id,
      ...copiesOf(FILLER.id, 30),
    ],
  });

/** Each of `cards` from the encounter deck into the villain area (test surgery), in order. */
function inVillainArea(state: GameState, ...cards: readonly AnyCard[]): { state: GameState; ids: InstanceId[] } {
  const ids: InstanceId[] = [];
  let s = state;
  for (const card of cards) {
    const placed = encounterCardInVillainArea(s, card.id);
    s = placed.state;
    ids.push(placed.id);
  }
  return { state: s, ids };
}

const counts = (state: GameState) => ({
  crisis: iconsInPlay(state, deps, "crisis"),
  hazard: iconsInPlay(state, deps, "hazard"),
  acceleration: iconsInPlay(state, deps, "acceleration"),
});

/** Ends P1's turn and runs the villain phase into the next round: step one's threat and the encounter cards dealt. */
function villainPhase(state: GameState) {
  const step = state.step;
  if (step.kind !== "turn") throw new Error(step.kind);
  const before = mustInstance(state, state.mainScheme.instanceId).threat;
  const { session, events } = driveSession(startSession(state), deps, [
    { type: "endTurn", playerId: step.activePlayerId },
  ]);
  const dealt = events.filter(
    (e: GameEvent) => e.type === "cardMoved" && e.to.kind === "dealtEncounter" && e.cardId === FILLER.id,
  ).length;
  const after = session.state;
  return {
    session,
    dealt,
    threat: mustInstance(after, after.mainScheme.instanceId).threat - before,
    state: after,
  };
}

function expectReplays(session: ReturnType<typeof playFree>["session"]) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("§4.1 Q73 a blanked card has no icons (FFG email relayed on Reddit, confirmed by the user 2026-09-28)", () => {
  it("blanked side schemes contribute no crisis, hazard or acceleration icon this round, and do again next round", () => {
    const { state, ids } = inVillainArea(start(), HAZARD, CRISIS, ACCEL);
    expect(counts(state)).toEqual({ crisis: 1, hazard: 1, acceleration: 1 });

    const [hazard, crisis, accel] = ids as [InstanceId, InstanceId, InstanceId];
    expect([iconsOn(state, deps, hazard, "hazard"), iconsOn(state, deps, crisis, "crisis")]).toEqual([1, 1]);
    expect(iconsOn(state, deps, accel, "acceleration")).toBe(1);

    const { session, state: blanked } = playFree(state, deps, BLANK.id);
    for (const id of ids) expect(textBoxBlankFor(blanked, id, deps)).toBe(true);
    expect([iconsOn(blanked, deps, hazard, "hazard"), iconsOn(blanked, deps, crisis, "crisis")]).toEqual([0, 0]);
    expect(iconsOn(blanked, deps, accel, "acceleration")).toBe(0);
    expect(counts(blanked)).toEqual({ crisis: 0, hazard: 0, acceleration: 0 });
    expectReplays(session);

    // The blank lasts through this round's villain phase: step one places no acceleration threat and no hazard card is
    // dealt, exactly as with no side scheme in play.
    const control = villainPhase(start());
    const unblanked = villainPhase(state);
    const run = villainPhase(blanked);
    expect(unblanked.threat).toBe(control.threat + 1);
    expect(unblanked.dealt).toBe(control.dealt + 1);
    expect(run.threat).toBe(control.threat);
    expect(run.dealt).toBe(control.dealt);

    // "Until the end of the round": next round the icons are back.
    expect(run.state.round).toBe(blanked.round + 1);
    expect(run.state.lastingEffects.some((e) => e.kind === "blankTextBox")).toBe(false);
    expect(counts(run.state)).toEqual({ crisis: 1, hazard: 1, acceleration: 1 });
  });

  it("a blanked attachment's printed icon is gone", () => {
    const base = start();
    const placed = encounterCardInVillainArea(base, SUIT.id);
    const villain = placed.state.villains[0]!.instanceId;
    const state: GameState = {
      ...placed.state,
      villainArea: placed.state.villainArea.filter((id) => id !== placed.id),
      instances: {
        ...placed.state.instances,
        [villain]: {
          ...mustInstance(placed.state, villain),
          attachments: [...mustInstance(placed.state, villain).attachments, placed.id],
        },
        [placed.id]: { ...mustInstance(placed.state, placed.id), attachedTo: villain },
      },
    };
    expect(iconsInPlay(state, deps, "hazard")).toBe(1);
    const { state: blanked } = playFree(state, deps, BLANK.id);
    expect(textBoxBlankFor(blanked, placed.id, deps)).toBe(true);
    expect(iconsInPlay(blanked, deps, "hazard")).toBe(0);
    expect([iconsOn(state, deps, placed.id, "hazard"), iconsOn(blanked, deps, placed.id, "hazard")]).toEqual([1, 0]);
  });

  it("a blanked environment's amplify icon is gone", () => {
    const { state, id } = encounterCardInVillainArea(start(), AMP.id);
    expect(amplifyIconsInPlay(state, deps)).toBe(1);
    const { state: blanked } = playFree(state, deps, BLANK.id);
    expect(textBoxBlankFor(blanked, id, deps)).toBe(true);
    expect(amplifyIconsInPlay(blanked, deps)).toBe(0);
  });

  it("a blanked card loses icons it gains, from another card's rule or its own", () => {
    const { state: withSchemes, ids } = inVillainArea(start(), PLAIN_SCHEME, SELF_GRANT);
    const [plain, selfGrant] = ids as [InstanceId, InstanceId];
    // SELF_GRANT gains one from its own rule; GRANTER gives each of the two another.
    const { state } = playerCardIntoPlay(withSchemes, GRANTER.id);
    expect(iconsInPlay(state, deps, "hazard")).toBe(3);
    expect([iconsOn(state, deps, plain, "hazard"), iconsOn(state, deps, selfGrant, "hazard")]).toEqual([1, 2]);

    const { state: blanked } = playFree(state, deps, BLANK.id);
    expect(textBoxBlankFor(blanked, plain, deps)).toBe(true);
    expect(textBoxBlankFor(blanked, selfGrant, deps)).toBe(true);
    // GRANTER (a support) is not blanked, and its rule is live; the side schemes it targets show no icons.
    expect(iconsInPlay(blanked, deps, "hazard")).toBe(0);
    expect([iconsOn(blanked, deps, plain, "hazard"), iconsOn(blanked, deps, selfGrant, "hazard")]).toEqual([0, 0]);
  });

  it("a blanked main scheme stage shows no crisis icon", () => {
    const state = gameAtFirstTurn({ cards: CARDS, deps, mainScheme: CRISIS_MAIN, deck: [BLANK_MAIN.id] });
    const main = state.mainScheme.instanceId;
    expect([iconsInPlay(state, deps, "crisis"), iconsOn(state, deps, main, "crisis")]).toEqual([1, 1]);
    const { state: blanked } = playFree(state, deps, BLANK_MAIN.id);
    expect(textBoxBlankFor(blanked, main, deps)).toBe(true);
    expect([iconsInPlay(blanked, deps, "crisis"), iconsOn(blanked, deps, main, "crisis")]).toEqual([0, 0]);
  });

  it("a permanent side scheme keeps its icons against a blank from outside its set (RRG 1.8 'Permanent', p. 32)", () => {
    const { state, ids } = inVillainArea(start(), PERMANENT_HAZARD, HAZARD);
    const [permanent, plain] = ids as [InstanceId, InstanceId];
    expect(iconsInPlay(state, deps, "hazard")).toBe(2);
    const { state: blanked } = playFree(state, deps, BLANK.id);
    expect(textBoxBlankFor(blanked, permanent, deps)).toBe(false);
    expect(textBoxBlankFor(blanked, plain, deps)).toBe(true);
    expect(iconsInPlay(blanked, deps, "hazard")).toBe(1);
    expect([iconsOn(blanked, deps, permanent, "hazard"), iconsOn(blanked, deps, plain, "hazard")]).toEqual([1, 0]);
  });
});
