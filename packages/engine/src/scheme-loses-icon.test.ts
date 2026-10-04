/**
 * docs/phase7-wave6.md §3.38: "While there is no threat here, this scheme loses the [amplify] icon" (Consume the World,
 * 34030). `RuleSpec gainsIcon.loses`: a matching card shows none of the icon, printed or gained, while the rule is
 * active. Losing beats gaining: a lost characteristic "cannot be regained while the ability causing it to be lost is in
 * effect" (RRG 1.8 "'Loses'", p. 27), as with a lost keyword (§3.13).
 *
 * Synthetic cards: a side scheme printing one amplify icon that loses it at no threat; a side scheme printing a hazard
 * icon that always loses it; a plain side scheme; a support granting each side scheme an amplify icon and a hazard icon.
 */

import { type AnyCard, type SideSchemeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { amplifyIconsInPlay } from "./modifiers.js";
import { mustInstance, mustPlayer } from "./query.js";
import { iconsInPlay, iconsOn } from "./rules.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const constantRules = (rules: NonNullable<Extract<AbilityDefinition["trigger"], { kind: "constant" }>["rules"]>) =>
  ({ trigger: { kind: "constant", rules }, effects: [] }) satisfies AbilityDefinition;

/** "While there is no threat here, this scheme loses the [amplify] icon." */
const CONSUME_RULE = stubAbility(
  "consume.constant",
  constantRules([
    {
      kind: "gainsIcon",
      icon: "amplify",
      target: { self: true },
      loses: true,
      while: {
        kind: "compare",
        left: { kind: "threat", of: { kind: "self" } },
        op: "atMost",
        right: { kind: "const", value: 0 },
      },
    },
  ]),
);
const CONSUME: SideSchemeCard = {
  ...stubSideScheme({ id: "consume", startingThreat: 0, abilities: [CONSUME_RULE.ref] }),
  amplifyIcons: 1,
};
/** "This scheme loses the [hazard] icon." */
const NO_HAZARD_RULE = stubAbility(
  "no-hazard.constant",
  constantRules([{ kind: "gainsIcon", icon: "hazard", target: { self: true }, loses: true }]),
);
const NO_HAZARD = stubSideScheme({
  id: "no-hazard",
  startingThreat: 3,
  icons: ["hazard"],
  abilities: [NO_HAZARD_RULE.ref],
});
const PLAIN = stubSideScheme({ id: "plain", startingThreat: 3 });
const GRANTER_RULE = stubAbility(
  "granter.constant",
  constantRules([
    { kind: "gainsIcon", icon: "amplify", target: { categories: ["sideScheme"] } },
    { kind: "gainsIcon", icon: "hazard", target: { categories: ["sideScheme"] } },
  ]),
);
/** "Each side scheme gains an amplify icon and a hazard icon." */
const GRANTER = stubSupport({ id: "granter", cost: 0, abilities: [GRANTER_RULE.ref] });

const deps: EngineDeps = depsOf(CONSUME_RULE, NO_HAZARD_RULE, GRANTER_RULE);
const CARDS: readonly AnyCard[] = [CONSUME, NO_HAZARD, PLAIN, GRANTER];

interface Setup {
  readonly state: GameState;
  readonly consume: InstanceId;
}

function setup(options: { readonly threat: number; readonly granter?: boolean }): Setup {
  let state = gameAtFirstTurn({ cards: CARDS, deps, deck: [GRANTER.id], encounter: [CONSUME.id, PLAIN.id] });
  if (options.granter) state = playerCardIntoPlay(state, GRANTER.id).state;
  const placed = encounterCardInVillainArea(state, CONSUME.id, options.threat);
  return { state: placed.state, consume: placed.id };
}

describe("gainsIcon loses — 'while there is no threat here, this scheme loses the [amplify] icon' (§3.38)", () => {
  it("with no threat, the scheme shows no amplify icon and none counts in play", () => {
    const { state, consume } = setup({ threat: 0 });
    expect(iconsOn(state, deps, consume, "amplify")).toBe(0);
    expect(amplifyIconsInPlay(state, deps)).toBe(0);
  });

  it("with threat, its printed amplify icon counts", () => {
    const { state, consume } = setup({ threat: 2 });
    expect(iconsOn(state, deps, consume, "amplify")).toBe(1);
    expect(amplifyIconsInPlay(state, deps)).toBe(1);
  });

  it("losing beats gaining: a granted amplify icon is not regained at no threat, and counts again with threat", () => {
    const empty = setup({ threat: 0, granter: true });
    expect(iconsOn(empty.state, deps, empty.consume, "amplify")).toBe(0);
    expect(amplifyIconsInPlay(empty.state, deps)).toBe(0);
    const withThreat = setup({ threat: 2, granter: true });
    expect(iconsOn(withThreat.state, deps, withThreat.consume, "amplify")).toBe(2);
    expect(amplifyIconsInPlay(withThreat.state, deps)).toBe(2);
  });

  it("another side scheme's gained amplify icon still counts", () => {
    const { state } = setup({ threat: 0, granter: true });
    const plain = encounterCardInVillainArea(state, PLAIN.id, 3);
    expect(iconsOn(plain.state, deps, plain.id, "amplify")).toBe(1);
    expect(amplifyIconsInPlay(plain.state, deps)).toBe(1);
  });

  it("a scheme icon (hazard) is lost from the icon count, printed and gained", () => {
    const base = gameAtFirstTurn({ cards: CARDS, deps, deck: [GRANTER.id], encounter: [NO_HAZARD.id] });
    const placed = encounterCardInVillainArea(base, NO_HAZARD.id, 3);
    expect(iconsOn(placed.state, deps, placed.id, "hazard")).toBe(0);
    expect(iconsInPlay(placed.state, deps, "hazard")).toBe(0);
    const granted = playerCardIntoPlay(placed.state, GRANTER.id).state;
    expect(iconsOn(granted, deps, placed.id, "hazard")).toBe(0);
    expect(iconsInPlay(granted, deps, "hazard")).toBe(0);
  });

  it("thwarting the last threat off it removes the icon; replays deep-equal", () => {
    const s = setup({ threat: 1 });
    const hero = {
      ...s.state,
      players: s.state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    const identity = mustPlayer(hero, P1).identity.instanceId;
    expect(amplifyIconsInPlay(hero, deps)).toBe(1);
    const { session } = driveSession(
      startSession(hero),
      deps,
      [{ type: "basicThwart", playerId: P1, thwarterInstanceId: identity, schemeInstanceId: s.consume }],
      defaultPick,
    );
    expect(mustInstance(session.state, s.consume).threat).toBe(0);
    expect(amplifyIconsInPlay(session.state, deps)).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
