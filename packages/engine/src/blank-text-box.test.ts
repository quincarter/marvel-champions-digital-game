/**
 * docs/phase7-wave2.md §8: class-wide text blanking as a constant rule ("Treat the printed text box of each [Tech]
 * player card as if it were blank", Tech Theft 12026), and the ability-lookup layer that makes it possible without
 * recursion or a quadratic cost.
 *
 * Sources: RRG 1.8 "Blank" (p. 10), "Gains" (p. 21), "Constant Ability" (p. 12); ruling, Apr 30, 2026 (3) answer 4
 * (an attachment's printed stat box is outside the text box).
 */

import { flat, trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { characterProfile, mustInstance, mustPlayer } from "./query.js";
import { hasKeyword } from "./keywords.js";
import { activeAbilityRefs, blankedByConstantRules, cardsInPlay } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubMainScheme,
  stubSideScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
  stubUpgrade,
} from "./testing/fixtures.js";
import { giveCard, newGame, RESOURCE, runWith, settle } from "./testing/scenario.js";

const p1 = playerId("p1");
const def = (d: AbilityDefinition) => d;
const toHero: Command = { type: "changeForm", playerId: p1 };
const endTurn: Command = { type: "endTurn", playerId: p1 };
const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);

const TECH = trait("TECH");
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(5), targetThreat: flat(99), acceleration: flat(0) }],
});
const QUIET = stubVillain({ id: "villain", stages: [{ hp: flat(60), atk: 0, sch: 0 }] });

// "Treat the printed text box of each [Tech] player card as if it were blank." (Tech Theft 12026, a side scheme.)
const techTheft = stubAbility(
  "theft.constant",
  def({
    // "each [Tech] player card": the player card types, since an encounter card has no controller to scope "you" to
    // on a rule printed on an encounter card (docs/phase7-wave2.md §8).
    trigger: {
      kind: "constant",
      rules: [{ kind: "blankTextBox", target: { trait: TECH, categories: ["ally", "upgrade", "support"] } }],
    },
    effects: [],
  }),
);
const TECH_THEFT = stubSideScheme({ id: "tech-theft", startingThreat: 9, boostIcons: 0, abilities: [techTheft.ref] });

// A Tech upgrade with one of each kind of text: a constant modifier, an action ability, and a printed keyword.
const gadgetConstant = stubAbility(
  "gadget.constant",
  def({
    trigger: {
      kind: "constant",
      modifiers: [{ stat: "atk", amount: 3, target: { categories: ["identity"], controller: "you" } }],
    },
    effects: [],
  }),
);
const gadgetAction = stubAbility(
  "gadget.action",
  def({
    trigger: { kind: "action", form: "hero" },
    effects: [
      { kind: "addCounters", target: { kind: "self" }, counterType: "used", amount: { kind: "const", value: 1 } },
    ],
  }),
);
const GADGET = {
  ...stubUpgrade({
    id: "gadget",
    cost: 0,
    traits: [TECH],
    abilities: [gadgetConstant.ref, gadgetAction.ref],
    keywords: [{ name: "restricted" }],
  }),
};

const deps: EngineDeps = depsOf(techTheft, gadgetConstant, gadgetAction);

/** A game with the Tech upgrade in play, and Tech Theft in play only when asked for. */
function board(withTheft: boolean): { state: GameState; gadget: InstanceId; theft: InstanceId | null } {
  const start = newGame({
    villain: QUIET,
    mainScheme: SCHEME,
    extraCards: [BLANK, GADGET, TECH_THEFT],
    deck: [...copies(RESOURCE.id, 12), ...copies(GADGET.id, 2)],
    encounterDeck: withTheft ? copies(TECH_THEFT.id, 16) : copies(BLANK.id, 16),
    deps,
  });
  const hero = runWith(deps, start, toHero);
  const given = giveCard(hero, p1, GADGET.id);
  let state = settle(runWith(deps, given.state, play(given.id)), undefined, deps);
  // The villain phase reveals the side scheme (or a blank treachery) — the upgrade is already in play either way.
  state = settle(runWith(deps, state, endTurn), undefined, deps);
  const theft = Object.keys(state.instances).find(
    (id) => state.instances[id as InstanceId]?.cardId === TECH_THEFT.id && state.villainArea.includes(id as InstanceId),
  ) as InstanceId | undefined;
  return { state, gadget: given.id, theft: theft ?? null };
}

describe("§8 a constant rule blanking a whole class of cards", () => {
  it("removes the matching cards' constant modifiers, action abilities and printed keywords", () => {
    const without = board(false);
    const identity = (s: GameState) => mustPlayer(s, p1).identity.instanceId;
    expect(without.theft).toBeNull();
    const baseAtk = characterProfile(without.state, identity(without.state), deps)?.atk;

    const withTheft = board(true);
    expect(withTheft.theft).not.toBeNull();
    // The constant "+3 ATK" is gone.
    expect(characterProfile(withTheft.state, identity(withTheft.state), deps)?.atk).toBe((baseAtk ?? 0) - 3);
    // The action ability is no longer offered.
    const abilityIds = (s: GameState): readonly string[] => {
      const actions = legalActions(s, p1, deps);
      return actions.kind === "turn"
        ? actions.legal.flatMap((a) => (a.action.kind === "useAbility" ? [String(a.action.abilityId)] : []))
        : [];
    };
    expect(abilityIds(without.state)).toContain(String(gadgetAction.ref.id));
    expect(abilityIds(withTheft.state)).not.toContain(String(gadgetAction.ref.id));
    // Using it by command is refused too, not merely hidden.
    const use: Command = {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: withTheft.gadget,
      abilityId: gadgetAction.ref.id,
      payment: [],
    };
    expect(applyCommand(withTheft.state, use, deps)).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    // RRG 1.8 "Blank" (p. 10): a printed keyword is text in the text box, so it goes too.
    expect(hasKeyword(without.state, without.gadget, "restricted", deps)).toBe(true);
    expect(hasKeyword(withTheft.state, withTheft.gadget, "restricted", deps)).toBe(false);
  });

  it("stops the moment the blanking card leaves play", () => {
    const { state, gadget, theft } = board(true);
    expect(blankedByConstantRules(state, deps)).toContain(gadget);
    const gone: GameState = {
      ...state,
      villainArea: state.villainArea.filter((id) => id !== theft),
      instances: Object.fromEntries(Object.entries(state.instances).filter(([id]) => id !== theft)),
    };
    expect(blankedByConstantRules(gone, deps)).not.toContain(gadget);
    expect(hasKeyword(gone, gadget, "restricted", deps)).toBe(true);
  });

  it("matches on printed characteristics, so a granted trait does not make a card blank (no recursion)", () => {
    // A support that grants the Tech trait to your identity. If the blanking rule read *granted* traits, finding it
    // would have to read the very ability lookups it gates. The documented reading is printed-only.
    const granter = stubAbility(
      "granter.constant",
      def({
        trigger: {
          kind: "constant",
          traitGrants: [{ trait: TECH, target: { categories: ["support"], controller: "you" } }],
        },
        effects: [],
      }),
    );
    const badge = stubAbility(
      "badge.constant",
      def({
        trigger: {
          kind: "constant",
          modifiers: [{ stat: "thw", amount: 2, target: { categories: ["identity"], controller: "you" } }],
        },
        effects: [],
      }),
    );
    const GRANTER = stubSupport({ id: "granter", cost: 0, abilities: [granter.ref] });
    const BADGE = stubSupport({ id: "badge", cost: 0, abilities: [badge.ref] });
    const localDeps = depsOf(techTheft, granter, badge);
    const start = newGame({
      villain: QUIET,
      mainScheme: SCHEME,
      extraCards: [BLANK, GRANTER, BADGE, TECH_THEFT],
      deck: [...copies(RESOURCE.id, 12), ...copies(GRANTER.id, 2), ...copies(BADGE.id, 2)],
      encounterDeck: copies(TECH_THEFT.id, 16),
      deps: localDeps,
    });
    let state = runWith(localDeps, start, toHero);
    for (const card of [GRANTER.id, BADGE.id]) {
      const given = giveCard(state, p1, card);
      state = settle(runWith(localDeps, given.state, play(given.id)), undefined, localDeps);
    }
    state = settle(runWith(localDeps, state, endTurn), undefined, localDeps);
    const badgeId = mustPlayer(state, p1).playArea.find(
      (id) => mustInstance(state, id).cardId === BADGE.id,
    ) as InstanceId;
    // Badge only has TECH as a *granted* trait, so it is not blanked and its +2 THW still applies.
    expect(blankedByConstantRules(state, localDeps)).not.toContain(badgeId);
    const identity = mustPlayer(state, p1).identity.instanceId;
    expect(characterProfile(state, identity, localDeps)?.thw).toBeGreaterThan(0);
  });
});

describe("§8 the ability-lookup layer does not become quadratic", () => {
  /**
   * Counts every read of `state.instances[...]` — the single lookup every card read goes through (`cardOf`,
   * `getInstance`, and so every ability lookup). Instrumenting the state rather than the registry is what makes the
   * scan's *shape* visible: the blanked-set scan walks the board, and re-walking it per lookup is the cliff.
   */
  function counting(state: GameState): { state: GameState; reads: () => number } {
    let reads = 0;
    const instances = new Proxy(state.instances, {
      get(target, key, receiver) {
        if (typeof key === "string") reads += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    return { state: { ...state, instances }, reads: () => reads };
  }

  /** A board with `n` ability-carrying supports in play, plus the usual villain/scheme/identity. */
  function fullBoard(withTheft: boolean, n: number): { state: GameState; deps: EngineDeps } {
    const abilities: StubAbility[] = [techTheft];
    const supports = Array.from({ length: n }, (_, i) => {
      const ability = stubAbility(
        `filler${i}.constant`,
        def({
          trigger: {
            kind: "constant",
            modifiers: [{ stat: "thw", amount: 1, target: { categories: ["identity"], controller: "you" } }],
          },
          effects: [],
        }),
      );
      abilities.push(ability);
      return stubSupport({ id: `filler${i}`, cost: 0, abilities: [ability.ref] });
    });
    const localDeps = depsOf(...abilities);
    const start = newGame({
      villain: QUIET,
      mainScheme: SCHEME,
      extraCards: [BLANK, TECH_THEFT, ...supports],
      deck: [...copies(RESOURCE.id, 20), ...supports.flatMap((s) => copies(s.id, 2))],
      encounterDeck: withTheft ? copies(TECH_THEFT.id, 16) : copies(BLANK.id, 16),
      deps: localDeps,
    });
    let state = runWith(localDeps, start, toHero);
    for (const support of supports) {
      const given = giveCard(state, p1, support.id);
      state = settle(runWith(localDeps, given.state, play(given.id)), undefined, localDeps);
    }
    state = settle(runWith(localDeps, state, endTurn), undefined, localDeps);
    return { state, deps: localDeps };
  }

  /**
   * One full ability scan of the board: `activeAbilityRefs` once per card in play, which is exactly what
   * `activeRules`, `traitsOf`, `grantedKeywords` and `statModifiers` each do. Measured in registry reads.
   *
   * This is the cliff. Reading the blanked set from inside `activeAbilityRefs` without the per-state memo makes
   * every one of those lookups re-scan the board, turning a linear scan into a quadratic one.
   */
  const scanReads = (withTheft: boolean, n: number): number => {
    const board = fullBoard(withTheft, n);
    const { state, reads } = counting(board.state);
    for (const id of cardsInPlay(state)) activeAbilityRefs(state, id, board.deps);
    return reads();
  };

  /**
   * Measured both ways while writing this, going from 4 fillers to 20 (`ratio` = reads at 20 / reads at 4):
   *
   * | build | rule in the pool, not in play | rule in play | overhead at n=20 |
   * |---|---|---|---|
   * | memoized (this one) | 3.29 | 3.31 | 1.70 |
   * | per-lookup rescan (the cliff) | 9.86 | 9.94 | 2.39 |
   *
   * Five times the board is five times the reads if the scan is linear, and ~25 if it is quadratic; the bound of 5
   * sits with 50% headroom on either side of the two builds. The overhead ratio is the weaker signal and is here as
   * a second opinion, not the detector.
   */
  it("scales linearly with the cards in play when the rule is in the pool but not on the table", () => {
    expect(scanReads(false, 20) / scanReads(false, 4)).toBeLessThan(5);
  });

  it("still scales linearly with a blanking rule actually in play", () => {
    expect(scanReads(true, 20) / scanReads(true, 4)).toBeLessThan(5);
  });

  it("adds at most a constant multiple on a board of a fixed size", () => {
    // One extra board scan to build the set, not one per lookup.
    expect(scanReads(true, 20) / scanReads(false, 20)).toBeLessThan(2);
  });
});
