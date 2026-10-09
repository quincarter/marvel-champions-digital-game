/**
 * "Preparation" abilities (docs/phase7-wave9.md §3.2). Synthetic cards shaped like Black Widow's set.
 *
 * MC50 rulebook p. 9, "Preparation Abilities": "Encounter cards in Black Widow's encounter set have 'Preparation'
 * abilities in place of 'Boost' abilities. These abilities are **not** resolved when the cards are turned faceup as
 * boost cards. Instead, these abilities are only resolved by the 'Forced Interrupt' on Black Widow's villain cards."
 * The villain: "discard the top card of the encounter deck and resolve each 'Preparation' ability on that card."
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import { labeledResolvedVar, resolvableAs, type EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { keywordTotal } from "./keywords.js";
import { activeEncounterDeck, locateCard, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubAttachment, stubMainScheme, stubSideScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { defaultPick, TREACHERY } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, onTopOfEncounterDeck, P1, P2 } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const one = { kind: "const", value: 1 } as const;

// "When Revealed: You are stunned." / "Preparation: Stun the attacking player's identity." (shaped like Widow's Bite)
const BITE_REVEALED = stubAbility("bite.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "giveStatus", target: yourIdentity, status: "stunned" }],
});
const BITE_PREPARATION = stubAbility("bite.preparation", {
  trigger: { kind: "preparation" },
  effects: [{ kind: "giveStatus", target: yourIdentity, status: "stunned" }],
});
const BITE = stubTreachery({ id: "bite", boostIcons: 2, abilities: [BITE_REVEALED.ref, BITE_PREPARATION.ref] });

// "Preparation: Place 1 threat on each scheme." (Covert Ops)
const OPS_PREPARATION = stubAbility("ops.preparation", {
  trigger: { kind: "preparation" },
  effects: [{ kind: "placeThreat", target: { kind: "each", query: { categories: ["scheme"] } }, amount: one }],
});
const OPS = stubTreachery({ id: "ops", boostIcons: 2, abilities: [OPS_PREPARATION.ref] });

// "Attach to [villain]. [Villain] gains retaliate 1. Preparation: Attach this card to [villain]." (the Gauntlet)
const GAUNTLET_CONSTANT = stubAbility("gauntlet.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [{ keyword: { name: "retaliate", value: 1 }, target: { hostOfSelf: true } }],
  },
  effects: [],
});
const GAUNTLET_PREPARATION = stubAbility("gauntlet.preparation", {
  trigger: { kind: "preparation" },
  effects: [{ kind: "attach", card: self, to: theVillain }],
});
const GAUNTLET = stubAttachment({
  id: "gauntlet",
  attachesTo: { kind: "villain" },
  statModifiers: { atk: 1 },
  boostIcons: 2,
  abilities: [GAUNTLET_CONSTANT.ref, GAUNTLET_PREPARATION.ref],
});

// Two Preparation abilities on one card, as a printed one and a granted one are (§3.3): the resolving player orders.
const TWIN_A = stubAbility("twin.preparation", {
  trigger: { kind: "preparation" },
  effects: [{ kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 2 } }],
});
const TWIN_B = stubAbility("twin.preparation-2", {
  trigger: { kind: "preparation" },
  effects: [{ kind: "dealDamage", target: yourIdentity, amount: { kind: "const", value: 3 } }],
});
const TWIN = stubTreachery({ id: "twin", abilities: [TWIN_A.ref, TWIN_B.ref] });

/**
 * "Forced Interrupt: When a character you control attacks [this villain], discard the top card of the encounter deck
 * and resolve each 'Preparation' ability on that card." Then, to read `<bind>.count` from outside: the main scheme
 * takes 10 threat for each one resolved.
 */
const PREPARE: readonly EffectSpec[] = [
  { kind: "discardEncounterCards", count: one, bind: "top" },
  { kind: "resolveSpecials", of: { kind: "slot", slot: "top" }, trigger: "preparation", bind: "prep" },
  {
    kind: "placeThreat",
    target: { kind: "mainScheme" },
    amount: {
      kind: "product",
      values: [
        { kind: "var", name: "prep.count" },
        { kind: "const", value: 10 },
      ],
    },
  },
];
const WIDOW_INTERRUPT = stubAbility("widow.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "attack", selfIs: "target" } },
  effects: PREPARE,
});
// "After a character attacks [this villain], if a 'Preparation' ability was resolved": the attack's own result.
const WIDOW_RESPONSE = stubAbility("widow.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "attack", selfIs: "target" } },
  effects: [
    {
      kind: "if",
      condition: { kind: "eventResultAtLeast", key: labeledResolvedVar("preparation"), amount: 1 },
      then: [{ kind: "giveStatus", target: self, status: "tough" }],
    },
  ],
});
const WIDOW = stubVillain({
  id: "widow",
  stages: [{ hp: flat(20), atk: 2, sch: 1, abilities: [WIDOW_INTERRUPT.ref, WIDOW_RESPONSE.ref] }],
});
const WEB = stubMainScheme({
  id: "web",
  stages: [{ startingThreat: flat(0), targetThreat: flat(90), acceleration: flat(1) }],
});
const SIDE = stubSideScheme({ id: "side", startingThreat: 0 });

const deps: EngineDeps = depsOf(
  BITE_REVEALED,
  BITE_PREPARATION,
  OPS_PREPARATION,
  GAUNTLET_CONSTANT,
  GAUNTLET_PREPARATION,
  TWIN_A,
  TWIN_B,
  WIDOW_INTERRUPT,
  WIDOW_RESPONSE,
);

/** A game in the first player's turn, in hero form, with `top` on top of the encounter deck. */
function table(top: typeof BITE | typeof OPS | typeof GAUNTLET | typeof TWIN | typeof TREACHERY, players: 1 | 2 = 1) {
  const base = gameAtFirstTurn({
    cards: [BITE, OPS, GAUNTLET, TWIN, SIDE],
    deps,
    villain: WIDOW,
    mainScheme: WEB,
    players,
    encounter: [top.id, SIDE.id, ...Array.from({ length: 12 }, () => TREACHERY.id)],
  });
  const side = encounterCardInVillainArea(base, SIDE.id);
  const ready = onTopOfEncounterDeck(side.state, top.id);
  const topId = activeEncounterDeck(ready).deck[0]!;
  const hero = runCommands(ready, deps, { type: "changeForm", playerId: P1 }).state;
  return { state: hero, top: topId, side: side.id, villain: hero.activeVillainId!, main: mainSchemeOf(hero) };
}
const mainSchemeOf = (state: GameState): InstanceId => state.mainScheme.instanceId;
const identityOf = (state: GameState, player = P1): InstanceId => mustPlayer(state, player).identity.instanceId;
const attackVillain = (state: GameState): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: identityOf(state),
  targetInstanceId: state.activeVillainId!,
});
const threatOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const statuses = (state: GameState, id: InstanceId) => {
  const { stunned, tough } = mustInstance(state, id).statuses;
  return { stunned: stunned > 0, tough: tough > 0 };
};
const resolvedAbilities = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));

describe("the `preparation` trigger kind", () => {
  it("is a kind of its own for `resolveSpecials`: not a boost, a Special or a When Revealed", () => {
    expect(resolvableAs(BITE_PREPARATION.definition, "preparation")).toBe(true);
    expect(resolvableAs(BITE_PREPARATION.definition, "special")).toBe(false);
    expect(resolvableAs(BITE_PREPARATION.definition, "whenRevealed")).toBe(false);
    expect(resolvableAs(BITE_REVEALED.definition, "preparation")).toBe(false);
  });

  it("is not resolved when its card is turned faceup as a boost card: 2 icons counted, nobody stunned", () => {
    const t = table(BITE);
    // The villain phase: the villain (ATK 2) attacks the hero, undefended, with this card as its boost card.
    const { state, events } = runCommands(t.state, deps, { type: "endTurn", playerId: P1 });

    const flipped = events.filter((e) => e.type === "boostCardFlipped");
    expect(flipped).toEqual([
      { type: "boostCardFlipped", enemyInstanceId: t.villain, instanceId: t.top, boostIcons: 2 },
    ]);
    expect(damageOn(state, identityOf(state))).toBe(2 + 2);
    expect(statuses(state, identityOf(state)).stunned).toBe(false);
    expect(resolvedAbilities(events)).not.toContain("bite.preparation");
    expect(resolvedAbilities(events)).not.toContain("bite.when-revealed");
    expect(locateCard(state, t.top)?.kind).toBe("encounterDiscard");
  });
});

describe('`resolveSpecials` with `trigger: "preparation"` on a card in the encounter discard pile', () => {
  it("Covert Ops shape: 1 threat on the main scheme and on the side scheme; `<bind>.count` is 1", () => {
    const t = table(OPS);
    expect([threatOn(t.state, t.main), threatOn(t.state, t.side)]).toEqual([0, 0]);

    const { state, events } = runCommands(t.state, deps, attackVillain(t.state));

    // 1 from the Preparation on each scheme, then 10 x `prep.count` (1) on the main scheme from the villain's text.
    expect(threatOn(state, t.side)).toBe(1);
    expect(threatOn(state, t.main)).toBe(1 + 10);
    expect(resolvedAbilities(events).filter((id) => id === "ops.preparation")).toHaveLength(1);
    // The card stays where it was discarded, and the attack then resolves: ATK 2 on the villain.
    expect(locateCard(state, t.top)?.kind).toBe("encounterDiscard");
    expect(activeEncounterDeck(state).discard).toContain(t.top);
    expect(damageOn(state, t.villain)).toBe(2);
  });

  it("the Gauntlet shape: the card attaches itself to the villain from the discard pile", () => {
    const t = table(GAUNTLET);
    const { state } = runCommands(t.state, deps, attackVillain(t.state));

    expect(mustInstance(state, t.top).attachedTo).toBe(t.villain);
    expect(mustInstance(state, t.villain).attachments).toEqual([t.top]);
    expect(activeEncounterDeck(state).discard).not.toContain(t.top);
    expect(locateCard(state, t.top)).toEqual({ kind: "attachment", hostInstanceId: t.villain });
    // In play, its constant text applies: retaliate 1 on the villain, which answers the attack that attached it.
    expect(keywordTotal(state, t.villain, "retaliate", deps)).toBe(1);
    expect(damageOn(state, identityOf(state))).toBe(1);
    expect(damageOn(state, t.villain)).toBe(2);
    expect(threatOn(state, t.main)).toBe(10);
  });

  it('"you" is the attacking player, and the card is not revealed: no When Revealed resolves', () => {
    const t = table(BITE, 2);
    const { state, events } = runCommands(t.state, deps, attackVillain(t.state));

    expect(statuses(state, identityOf(state, P1)).stunned).toBe(true);
    expect(statuses(state, identityOf(state, P2)).stunned).toBe(false);
    expect(resolvedAbilities(events)).toContain("bite.preparation");
    expect(resolvedAbilities(events)).not.toContain("bite.when-revealed");
    const resolved = events.find((e) => e.type === "abilityResolved" && e.abilityId === BITE_PREPARATION.ref.id);
    expect(resolved).toMatchObject({ instanceId: t.top, controllerId: P1 });
  });

  it("a card with no Preparation ability: `<bind>.count` is 0 and the attack records nothing", () => {
    const t = table(TREACHERY);
    const { state } = runCommands(t.state, deps, attackVillain(t.state));

    expect(threatOn(state, t.main)).toBe(0);
    expect(locateCard(state, t.top)?.kind).toBe("encounterDiscard");
    expect(statuses(state, t.villain).tough).toBe(false);
    expect(damageOn(state, t.villain)).toBe(2);
  });
});

describe("the count on the attack in progress", () => {
  it("the attack's results carry how many resolved, read after the attack", () => {
    const t = table(OPS);
    const { state } = runCommands(t.state, deps, attackVillain(t.state));
    // The villain's Forced Response read `labeledResolved.preparation` >= 1 from the attack and took a tough card.
    expect(statuses(state, t.villain).tough).toBe(true);
  });

  it("two Preparation abilities on one card: the resolving player orders them, and both are counted", () => {
    const t = table(TWIN);
    const orders: string[][] = [];
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice!;
      if (choice.prompt.kind !== "orderSpecials") return defaultPick(state);
      expect(choice.playerId).toBe(P1);
      orders.push(choice.options.map((o) => o.optionId));
      // The second printed one first.
      return [...choice.options].reverse().map((o) => o.optionId);
    };
    const { state, events } = runCommandsPicking(t.state, deps, pick, attackVillain(t.state));

    expect(orders).toEqual([[`${t.top}:twin.preparation`, `${t.top}:twin.preparation-2`]]);
    expect(resolvedAbilities(events).filter((id) => id.startsWith("twin."))).toEqual([
      "twin.preparation-2",
      "twin.preparation",
    ]);
    // 2 from the first Preparation, then 10 x `prep.count` (2).
    expect(threatOn(state, t.main)).toBe(2 + 20);
    expect(damageOn(state, identityOf(state))).toBe(3);
    expect(statuses(state, t.villain).tough).toBe(true);
  });
});
